'use strict';

// ---------- instruments & tunings (strings listed as on the instrument) ----------
const GUITAR_WIRES = [4.5, 4, 3.4, 2.8, 2.2, 1.8];
const BASS_WIRES = [6, 5, 4.2, 3.4, 2.8, 2.2];
const INSTRUMENTS = [
  {
    id: 'guitar', name: 'Guitar', wires: GUITAR_WIRES, tunings: [
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
    ],
  },
  {
    id: 'bass', name: 'Bass', wires: BASS_WIRES, tunings: [
      { id: 'standard', name: 'Standard', notes: ['E1', 'A1', 'D2', 'G2'] },
      { id: 'half-down', name: 'Half step down', notes: ['D#1', 'G#1', 'C#2', 'F#2'] },
      { id: 'drop-d', name: 'Drop D', notes: ['D1', 'A1', 'D2', 'G2'] },
      { id: 'd-standard', name: 'D Standard', notes: ['D1', 'G1', 'C2', 'F2'] },
    ],
  },
  {
    id: 'bass5', name: 'Bass 5', wires: BASS_WIRES, tunings: [
      { id: 'standard', name: 'Standard', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
      { id: 'half-down', name: 'Half step down', notes: ['A#0', 'D#1', 'G#1', 'C#2', 'F#2'] },
      { id: 'high-c', name: 'High C', notes: ['E1', 'A1', 'D2', 'G2', 'C3'] },
    ],
  },
  {
    id: 'bass6', name: 'Bass 6', wires: BASS_WIRES, tunings: [
      { id: 'standard', name: 'Standard', notes: ['B0', 'E1', 'A1', 'D2', 'G2', 'C3'] },
    ],
  },
  {
    id: 'ukulele', name: 'Ukulele', wires: [2, 2.6, 2.2, 1.8], tunings: [
      { id: 'standard', name: 'Standard (GCEA)', notes: ['G4', 'C4', 'E4', 'A4'] },
      { id: 'baritone', name: 'Baritone', notes: ['D3', 'G3', 'B3', 'E4'] },
    ],
  },
  { id: 'chromatic', name: 'Chromatic', wires: [], tunings: [{ id: 'any', name: 'Any note', notes: [] }] },
];
const IN_TUNE_CENTS = 5;
const AUTO = -1;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const noteOfMidi = m => ({ midi: m, name: NAMES[((m % 12) + 12) % 12], oct: Math.floor(m / 12) - 1, freq: midiFreq(m) });

function parseNote(s) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(s);
  return noteOfMidi((+m[3] + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
}

// ---------- state ----------
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
let inst = INSTRUMENTS.find(i => i.id === store.get('inst')) || INSTRUMENTS[0];
let tuning, strings, selected = AUTO;
let view = store.get('view', 'full');
let detected = null; // { freq, at }
let smoothFreq = null;
let range = { lo: 28, hi: 1500 }; // pitch-detector search range

function applyTuning(t) {
  tuning = t;
  strings = t.notes.map(parseNote);
  const freqs = strings.map(s => s.freq);
  range = strings.length
    ? { lo: Math.min(...freqs) * 0.8, hi: Math.max(...freqs) * 2.5 }
    : { lo: 28, hi: 1500 };
}
applyTuning(inst.tunings.find(t => t.id === store.get('tuning:' + inst.id)) || inst.tunings[0]);

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const elInst = $('instruments'), elStrings = $('strings'), elTunings = $('tunings'), elButtons = $('buttons');
const elNote = $('note'), elHz = $('hz'), elCents = $('cents'), elNeedle = $('needle');
const elStart = $('start'), canvas = $('spectrum'), g = canvas.getContext('2d');

function buildInstruments() {
  elInst.innerHTML = '';
  INSTRUMENTS.forEach(i => {
    const b = document.createElement('button');
    b.className = 'chip' + (i.id === inst.id ? ' active' : '');
    b.textContent = i.name;
    b.onclick = () => setInstrument(i);
    elInst.appendChild(b);
  });
}

function buildStrings() {
  const n = strings.length;
  elStrings.innerHTML = '';
  elStrings.style.gridTemplateColumns = `repeat(${n || 1}, 1fr)`;
  strings.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'str';
    d.dataset.i = i;
    d.innerHTML = `<div class="peg">${s.name}</div><div class="wire" style="--w:${inst.wires[i] || 2}px"></div><div class="num">${n - i}</div>`;
    d.onclick = () => select(i);
    elStrings.appendChild(d);
  });
}

function buildTunings() {
  elTunings.innerHTML = '';
  inst.tunings.forEach(t => {
    const b = document.createElement('button');
    b.className = 'chip' + (t.id === tuning.id ? ' active' : '');
    b.innerHTML = `${t.name}<small>${t.notes.map(n => parseNote(n).name).join(' ')}</small>`;
    b.onclick = () => setTuning(t);
    elTunings.appendChild(b);
  });
}

function buildButtons() {
  const n = strings.length;
  elButtons.innerHTML = '';
  elButtons.style.gridTemplateColumns = `repeat(${n}, 1fr) 1.3fr`;
  strings.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'sbtn';
    b.dataset.i = i;
    b.innerHTML = `${s.name}<small>${n - i}</small>`;
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

function rebuild() {
  document.documentElement.dataset.inst = inst.id;
  buildInstruments(); buildStrings(); buildTunings(); buildButtons();
  lastLit = -2;
  refreshSelection();
}

function setInstrument(i) {
  inst = i;
  store.set('inst', i.id);
  selected = AUTO;
  applyTuning(i.tunings.find(t => t.id === store.get('tuning:' + i.id)) || i.tunings[0]);
  detected = null; smoothFreq = null;
  rebuild();
}

function setTuning(t) {
  applyTuning(t);
  store.set('tuning:' + inst.id, t.id);
  selected = AUTO;
  rebuild();
}

function select(i) {
  selected = i;
  lastLit = -2;
  refreshSelection();
}

// distance in octaves, folded so a 2nd harmonic / octave still counts as the same note
const foldErr = (f, ref) => { const e = Math.log2(f / ref); return e - Math.round(e); };

// which string is "current": manual choice, or in Auto the closest to what we hear
function currentIndex() {
  if (!strings.length) return -1;
  if (selected !== AUTO) return selected;
  if (!detected) return -1;
  let best = 0, bestErr = Infinity;
  strings.forEach((s, i) => {
    const e = Math.abs(foldErr(detected.freq, s.freq));
    if (e < bestErr) { bestErr = e; best = i; }
  });
  return best;
}

// the note we're aiming at right now
function currentTarget() {
  const idx = currentIndex();
  if (idx >= 0) return strings[idx];
  if (!strings.length && detected) return noteOfMidi(Math.round(69 + 12 * Math.log2(detected.freq / 440)));
  return null;
}

let lastLit = -2, lastState = '';
function refreshSelection(centsNow) {
  const idx = currentIndex();
  const state = centsNow !== undefined && Math.abs(centsNow) <= IN_TUNE_CENTS ? 'good' : 'off';
  if (idx !== lastLit || state !== lastState) {
    document.documentElement.dataset.state = state;
    document.querySelectorAll('.str').forEach(e => e.classList.toggle('lit', +e.dataset.i === idx));
    document.querySelectorAll('.sbtn').forEach(e => e.classList.toggle('active', +e.dataset.i === selected));
    lastLit = idx; lastState = state;
  }
}

// ---------- audio ----------
const FFT_SIZE = 32768; // ~1.5 Hz bins: enough to separate low bass notes
let ctx = null, analyser = null, freqData = null, peakData = null, timeData = null, running = false, micStream = null;

async function start() {
  if (running) return stop();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(micStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.6;
    analyser.minDecibels = -110;
    analyser.maxDecibels = -20;
    src.connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    peakData = new Float32Array(analyser.frequencyBinCount).fill(-200);
    timeData = new Float32Array(FFT_SIZE);
    running = true;
    elStart.textContent = 'Stop';
    elStart.classList.add('on');
    elCents.textContent = 'pluck a string…';
  } catch (e) {
    elCents.textContent = 'Microphone unavailable: ' + (e.message || e.name);
  }
}

function stop() {
  running = false;
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (ctx) ctx.close();
  ctx = analyser = micStream = null; detected = null; smoothFreq = null;
  elStart.textContent = 'Start listening';
  elStart.classList.remove('on');
  elNote.textContent = '–'; elHz.textContent = '0.0 Hz'; elCents.textContent = 'stopped';
  elNeedle.classList.remove('live');
  refreshSelection();
}

// YIN pitch detector on the most recent samples, searching only [fLo, fHi]
const YIN_WINDOW = 4096;
function detectPitch(buf, sr, fLo, fHi) {
  const tauMax = Math.min(Math.floor(sr / fLo), 2400), tauMin = Math.max(2, Math.floor(sr / fHi));
  const n = YIN_WINDOW + tauMax;
  const x = buf.subarray(buf.length - n);
  let rms = 0;
  for (let i = 0; i < n; i++) rms += x[i] * x[i];
  if (Math.sqrt(rms / n) < 0.004) return null; // too quiet

  const d = new Float32Array(tauMax + 2);
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
    if (d[t] < 0.15) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 1) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return sr / (tau + shift);
}

// YIN finds the right note; the FFT peak next to it gives a finer frequency (parabolic interpolation)
function refineWithFft(f) {
  const binHz = ctx.sampleRate / FFT_SIZE;
  const c = Math.round(f / binHz), w = Math.max(2, Math.round(c * 0.03));
  let p = c;
  for (let i = c - w; i <= c + w; i++) if (freqData[i] > freqData[p]) p = i;
  if (p <= 0 || p >= freqData.length - 1 || freqData[p] < -95) return f;
  const a = freqData[p - 1], b = freqData[p], d = freqData[p + 1];
  const fr = (p + 0.5 * (a - d) / ((a - 2 * b + d) || -1)) * binHz;
  return Math.abs(Math.log2(fr / f)) < 0.02 ? fr : f;
}

let frame = 0;
function analyse() {
  if (!running) return;
  analyser.getFloatFrequencyData(freqData);
  for (let i = 0; i < freqData.length; i++) peakData[i] = Math.max(freqData[i], peakData[i] - 0.35);
  if (frame++ % 3 === 0) {
    analyser.getFloatTimeDomainData(timeData);
    let f = detectPitch(timeData, ctx.sampleRate, range.lo, range.hi);
    if (f) {
      f = refineWithFft(f);
      smoothFreq = smoothFreq && Math.abs(Math.log2(f / smoothFreq)) < 0.04 ? smoothFreq * 0.6 + f * 0.4 : f;
      detected = { freq: smoothFreq, at: performance.now() };
    }
  }
  if (detected && performance.now() - detected.at > 1200) { detected = null; smoothFreq = null; }
}

function setNote(t) {
  elNote.innerHTML = t ? `${t.name}<sub>${t.oct}</sub>` : '–';
}

function updateReadout() {
  const t = currentTarget();
  if (!detected || !t) {
    elNeedle.classList.remove('live');
    if (running) { elCents.textContent = 'pluck a string…'; setNote(strings.length ? t : null); }
    refreshSelection();
    return;
  }
  const cents = 1200 * foldErr(detected.freq, t.freq);
  setNote(t);
  elHz.textContent = `${detected.freq.toFixed(1)} Hz  →  ${t.freq.toFixed(1)}`;
  elCents.textContent = Math.abs(cents) <= IN_TUNE_CENTS ? 'in tune'
    : `${Math.abs(cents).toFixed(0)} cents ${cents < 0 ? 'flat – tighten' : 'sharp – loosen'}`;
  elNeedle.classList.add('live');
  elNeedle.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  refreshSelection(cents);
}

// ---------- spectrum ----------
let F_MIN = 20, F_MAX = 8000;
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
const fmtHz = f => f >= 1000 ? (f / 1000) + 'k' : f + '';
const GRID = [20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 800, 1000, 2000, 3000, 5000, 8000, 12000];

function setRange() {
  if (view === 'full') { F_MIN = 20; F_MAX = Math.min(8000, ctx ? ctx.sampleRate / 2 : 8000); return; }
  if (strings.length) {
    const fs = strings.map(s => s.freq);
    F_MIN = Math.min(...fs) * 0.75; F_MAX = Math.max(...fs) * 2.2;
  } else { F_MIN = 30; F_MAX = 2000; }
}

// loudest value of `arr` between two frequencies (keeps narrow peaks visible when zoomed out)
function sampleDb(arr, f0, f1, binHz) {
  const b0 = f0 / binHz, b1 = f1 / binHz;
  if (b1 - b0 < 1) {
    const b = (b0 + b1) / 2, i = Math.floor(b), t = b - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }
  let m = -200;
  for (let i = Math.floor(b0); i <= Math.ceil(b1) && i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

function drawSpectrum() {
  setRange();
  const accent = css('--accent'), state = css('--state'), dim = css('--dim'), line = css('--line');
  const top = 20, bottom = H - 20, plotH = bottom - top;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = '11px -apple-system, sans-serif';

  // frequency grid
  g.lineWidth = 1;
  let lastX = -99;
  GRID.forEach(f => {
    if (f < F_MIN * 1.02 || f > F_MAX) return;
    const x = Math.round(xOf(f)) + .5;
    g.strokeStyle = line; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
    if (x - lastX > 34) { g.fillStyle = dim; g.fillText(fmtHz(f), x, H - 5); lastX = x; }
  });

  // live spectrum (+ faint peak hold)
  if (running && freqData) {
    const binHz = ctx.sampleRate / FFT_SIZE, lo = analyser.minDecibels, hi = analyser.maxDecibels;
    const yOf = db => bottom - Math.max(0, Math.min(1, (db - lo) / (hi - lo))) * plotH;
    const trace = arr => {
      g.beginPath();
      for (let x = 8; x <= W - 8; x += 1.5) {
        const y = yOf(sampleDb(arr, fOf(x - .75), fOf(x + .75), binHz));
        x === 8 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
    };
    trace(peakData);
    g.strokeStyle = dim; g.globalAlpha = .45; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
    trace(freqData);
    g.strokeStyle = accent; g.lineWidth = 1.5; g.stroke();
    g.lineTo(W - 8, bottom); g.lineTo(8, bottom); g.closePath();
    const grad = g.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, accent); grad.addColorStop(1, 'transparent');
    g.globalAlpha = .3; g.fillStyle = grad; g.fill(); g.globalAlpha = 1;
  }

  // target lines: one per string (or the nearest note in chromatic mode)
  const idx = currentIndex();
  const targets = strings.length ? strings : (currentTarget() ? [currentTarget()] : []);
  targets.forEach((s, i) => {
    if (s.freq < F_MIN || s.freq > F_MAX) return;
    const on = strings.length ? i === idx : true;
    const x = Math.round(xOf(s.freq)) + .5;
    g.strokeStyle = g.fillStyle = on ? state : dim;
    g.globalAlpha = on ? 1 : .6;
    g.lineWidth = on ? 2.5 : 1;
    g.setLineDash(on ? [] : [4, 4]);
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
    g.setLineDash([]);
    g.font = (on ? 'bold 12px' : '11px') + ' -apple-system, sans-serif';
    g.fillText(s.name + s.oct, x, 13);
    g.globalAlpha = 1;
  });

  // what we're hearing
  if (detected && detected.freq >= F_MIN && detected.freq <= F_MAX) {
    const x = xOf(detected.freq);
    g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
    g.beginPath(); g.moveTo(x - 4, top); g.lineTo(x + 4, top); g.lineTo(x, top + 6); g.fill();
  }
}

function loop() {
  analyse();
  updateReadout();
  drawSpectrum();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
function setView(v) {
  view = v;
  store.set('view', v);
  document.querySelectorAll('#view button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
document.querySelectorAll('#view button').forEach(b => { b.onclick = () => setView(b.dataset.v); });
setView(view);
rebuild();
elStart.onclick = start;
window.addEventListener('keydown', e => {
  const n = strings.length;
  if (e.key >= '1' && e.key <= '9' && +e.key <= n) select(n - +e.key);
  else if (e.key === '0' || e.key.toLowerCase() === 'a') select(AUTO);
});
resize();
requestAnimationFrame(loop);
