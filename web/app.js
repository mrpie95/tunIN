'use strict';

// ---------- tunings (low string -> high string) ----------
const TUNINGS = [
  { id: 'standard', name: 'Standard', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'half-down', name: 'Half step down', notes: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
  { id: 'full-down', name: 'Full step down', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'drop-d', name: 'Drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'double-drop-d', name: 'Double Drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'dadgad', name: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  { id: 'open-g', name: 'Open G', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'open-d', name: 'Open D', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  { id: 'open-e', name: 'Open E', notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] },
  { id: 'open-c', name: 'Open C', notes: ['C2', 'G2', 'C3', 'G3', 'C4', 'E4'] },
];
const WIRE_PX = [4.5, 4, 3.4, 2.8, 2.2, 1.8]; // string thickness, low -> high
const IN_TUNE_CENTS = 5;
const AUTO = -1;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseNote(s) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(s);
  const midi = (+m[3] + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { midi, name: NAMES[midi % 12], oct: +m[3], freq: 440 * Math.pow(2, (midi - 69) / 12) };
}

// ---------- state ----------
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
let tuning = TUNINGS.find(t => t.id === store.get('tuning')) || TUNINGS[0];
let strings = tuning.notes.map(parseNote);
let selected = +store.get('selected', AUTO); // 0..5 or AUTO
if (!(selected >= -1 && selected <= 5)) selected = AUTO;
let detected = null; // { freq, at }
let smoothFreq = null;

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const elStrings = $('strings'), elTunings = $('tunings'), elButtons = $('buttons');
const elNote = $('note'), elHz = $('hz'), elCents = $('cents'), elNeedle = $('needle');
const elStart = $('start'), canvas = $('spectrum'), g = canvas.getContext('2d');

function buildStrings() {
  elStrings.innerHTML = '';
  strings.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'str';
    d.dataset.i = i;
    d.innerHTML = `<div class="peg">${s.name}</div><div class="wire" style="--w:${WIRE_PX[i]}px"></div><div class="num">${6 - i}</div>`;
    d.onclick = () => select(i);
    elStrings.appendChild(d);
  });
}

function buildTunings() {
  elTunings.innerHTML = '';
  TUNINGS.forEach(t => {
    const b = document.createElement('button');
    b.className = 'chip' + (t.id === tuning.id ? ' active' : '');
    b.innerHTML = `${t.name}<small>${t.notes.map(n => parseNote(n).name).join(' ')}</small>`;
    b.onclick = () => { setTuning(t); };
    elTunings.appendChild(b);
  });
}

function buildButtons() {
  elButtons.innerHTML = '';
  strings.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'sbtn';
    b.dataset.i = i;
    b.innerHTML = `${s.name}<small>${6 - i}</small>`;
    b.onclick = () => select(i);
    elButtons.appendChild(b);
  });
  const a = document.createElement('button');
  a.className = 'sbtn auto';
  a.dataset.i = AUTO;
  a.textContent = 'Auto';
  a.onclick = () => select(AUTO);
  elButtons.appendChild(a);
}

function setTuning(t) {
  tuning = t;
  strings = t.notes.map(parseNote);
  store.set('tuning', t.id);
  buildStrings(); buildTunings(); buildButtons();
  refreshSelection();
}

function select(i) {
  selected = i;
  store.set('selected', i);
  refreshSelection();
}

// which string is "current": manual choice, or in Auto the closest to what we hear
function currentIndex() {
  if (selected !== AUTO) return selected;
  if (!detected) return -1;
  let best = 0, bestErr = Infinity;
  strings.forEach((s, i) => {
    const e = Math.abs(Math.log2(detected.freq / s.freq));
    if (e < bestErr) { bestErr = e; best = i; }
  });
  return best;
}

let lastLit = -2, lastState = '';
function refreshSelection(centsNow) {
  const idx = currentIndex();
  const state = centsNow !== undefined && Math.abs(centsNow) <= IN_TUNE_CENTS ? 'good' : 'off';
  if (idx !== lastLit || state !== lastState || centsNow === undefined) {
    document.documentElement.dataset.state = state;
    document.querySelectorAll('.str').forEach(e => e.classList.toggle('lit', +e.dataset.i === idx));
    document.querySelectorAll('.sbtn').forEach(e => e.classList.toggle('active',
      e.dataset.i == selected));
    lastLit = idx; lastState = state;
  }
}

// ---------- audio ----------
const FFT_SIZE = 16384;
let ctx = null, analyser = null, freqData = null, timeData = null, running = false;

async function start() {
  if (running) return stop();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.7;
    analyser.minDecibels = -110;
    analyser.maxDecibels = -30;
    src.connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(FFT_SIZE);
    running = true;
    elStart.textContent = 'Stop';
    elStart.classList.add('on');
    elCents.textContent = 'pluck a string…';
    start.stream = stream;
  } catch (e) {
    elCents.textContent = 'Microphone unavailable: ' + (e.message || e.name);
  }
}

function stop() {
  running = false;
  if (start.stream) start.stream.getTracks().forEach(t => t.stop());
  if (ctx) ctx.close();
  ctx = analyser = null; detected = null; smoothFreq = null;
  elStart.textContent = 'Start listening';
  elStart.classList.remove('on');
  elNote.textContent = '–'; elHz.textContent = '0.0 Hz'; elCents.textContent = 'stopped';
  elNeedle.classList.remove('live');
  refreshSelection();
}

// YIN pitch detector on the most recent samples
const YIN_WINDOW = 4096;
function detectPitch(buf, sr) {
  const tauMax = Math.min(Math.floor(sr / 50), 1400), tauMin = Math.floor(sr / 700);
  const n = YIN_WINDOW + tauMax;
  const x = buf.subarray(buf.length - n);
  let rms = 0;
  for (let i = 0; i < n; i++) rms += x[i] * x[i];
  if (Math.sqrt(rms / n) < 0.008) return null; // too quiet

  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < YIN_WINDOW; j++) { const v = x[j] - x[j + tau]; sum += v * v; }
    d[tau] = sum;
  }
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }

  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (d[t] < 0.12) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return sr / (tau + shift);
}

let frame = 0;
function analyse() {
  if (!running) return;
  analyser.getFloatFrequencyData(freqData);
  if (frame++ % 2 === 0) {
    analyser.getFloatTimeDomainData(timeData);
    const f = detectPitch(timeData, ctx.sampleRate);
    if (f) {
      smoothFreq = smoothFreq && Math.abs(Math.log2(f / smoothFreq)) < 0.04 ? smoothFreq * 0.6 + f * 0.4 : f;
      detected = { freq: smoothFreq, at: performance.now() };
    }
  }
  if (detected && performance.now() - detected.at > 1200) { detected = null; smoothFreq = null; }
}

function updateReadout() {
  const idx = currentIndex();
  if (!detected || idx < 0) {
    elNeedle.classList.remove('live');
    if (running && !detected) { elCents.textContent = 'pluck a string…'; elNote.textContent = idx >= 0 ? strings[idx].name : '–'; }
    refreshSelection();
    return;
  }
  const t = strings[idx];
  const cents = 1200 * Math.log2(detected.freq / t.freq);
  elNote.textContent = t.name;
  elHz.textContent = `${detected.freq.toFixed(1)} Hz  →  ${t.freq.toFixed(1)}`;
  elCents.textContent = Math.abs(cents) <= IN_TUNE_CENTS ? 'in tune'
    : `${Math.abs(cents).toFixed(0)} cents ${cents < 0 ? 'flat – tighten' : 'sharp – loosen'}`;
  elNeedle.classList.add('live');
  elNeedle.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  refreshSelection(cents);
}

// ---------- spectrum ----------
const F_MIN = 55, F_MAX = 520;
let W = 0, H = 0;
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(canvas);

const xOf = f => 8 + Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN) * (W - 16);
const fOf = x => F_MIN * Math.pow(F_MAX / F_MIN, (x - 8) / (W - 16));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function drawSpectrum() {
  const accent = css('--accent'), state = css('--state'), dim = css('--dim'), line = css('--line');
  const plotH = H - 22, top = 18;
  g.clearRect(0, 0, W, H);
  g.font = '11px -apple-system, sans-serif';
  g.textAlign = 'center';

  // Hz grid
  g.fillStyle = dim; g.strokeStyle = line; g.lineWidth = 1;
  [100, 200, 300, 400, 500].forEach(f => {
    const x = Math.round(xOf(f)) + .5;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, plotH + top - 4); g.stroke();
    g.fillText(f + '', x, H - 4);
  });

  // FFT curve
  if (running && freqData) {
    const binHz = ctx.sampleRate / FFT_SIZE, lo = analyser.minDecibels, hi = analyser.maxDecibels;
    const yOf = db => top + plotH - 4 - Math.max(0, Math.min(1, (db - lo) / (hi - lo))) * (plotH - 4);
    g.beginPath();
    for (let x = 8; x <= W - 8; x += 2) {
      const b = fOf(x) / binHz, i = Math.floor(b), t = b - i;
      const db = freqData[i] * (1 - t) + freqData[i + 1] * t;
      x === 8 ? g.moveTo(x, yOf(db)) : g.lineTo(x, yOf(db));
    }
    const grad = g.createLinearGradient(0, top, 0, top + plotH);
    grad.addColorStop(0, accent); grad.addColorStop(1, 'transparent');
    g.strokeStyle = accent; g.lineWidth = 1.5; g.stroke();
    g.lineTo(W - 8, top + plotH); g.lineTo(8, top + plotH); g.closePath();
    g.globalAlpha = .28; g.fillStyle = grad; g.fill(); g.globalAlpha = 1;
  }

  // target lines, one per string
  const idx = currentIndex();
  strings.forEach((s, i) => {
    const x = Math.round(xOf(s.freq)) + .5, on = i === idx;
    g.strokeStyle = on ? state : dim;
    g.fillStyle = on ? state : dim;
    g.globalAlpha = on ? 1 : .55;
    g.lineWidth = on ? 2.5 : 1;
    g.setLineDash(on ? [] : [4, 4]);
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + plotH - 4); g.stroke();
    g.setLineDash([]);
    g.font = (on ? 'bold 12px' : '11px') + ' -apple-system, sans-serif';
    g.fillText(s.name, x, 12);
    g.globalAlpha = 1;
  });

  // what we're hearing
  if (detected) {
    const x = xOf(detected.freq);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + plotH - 4); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 4, top); g.lineTo(x + 4, top); g.lineTo(x, top + 6); g.fill();
  }
}

function loop() {
  analyse();
  updateReadout();
  drawSpectrum();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
buildStrings(); buildTunings(); buildButtons(); refreshSelection();
elStart.onclick = start;
window.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '6') select(6 - +e.key);
  else if (e.key === '0' || e.key.toLowerCase() === 'a') select(AUTO);
});
resize();
requestAnimationFrame(loop);
