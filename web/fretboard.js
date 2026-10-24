'use strict';
// Explore view: fretboard with scale / chord / note filters, piano-key note picker,
// continuous per-string detuning (drag a string sideways) and tuning-aware chord shapes.
// Shares globals with app.js (strings, stringOff, setStringOff, store, $, css, ...).

// ---------- music data ----------
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const IV_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
const BLACK_PCS = [1, 3, 6, 8, 10];
const SCALE_DEFS = [
  ['chromatic', 'Chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
  ['major', 'Major (Ionian)', [0, 2, 4, 5, 7, 9, 11]],
  ['minor', 'Natural minor (Aeolian)', [0, 2, 3, 5, 7, 8, 10]],
  ['harmonic', 'Harmonic minor', [0, 2, 3, 5, 7, 8, 11]],
  ['melodic', 'Melodic minor', [0, 2, 3, 5, 7, 9, 11]],
  ['majpent', 'Major pentatonic', [0, 2, 4, 7, 9]],
  ['minpent', 'Minor pentatonic', [0, 3, 5, 7, 10]],
  ['blues', 'Blues', [0, 3, 5, 6, 7, 10]],
  ['dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10]],
  ['lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10]],
  ['locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10]],
  ['whole', 'Whole tone', [0, 2, 4, 6, 8, 10]],
];
const CHORD_DEFS = [
  ['maj', 'Major', '', [0, 4, 7]],
  ['min', 'Minor', 'm', [0, 3, 7]],
  ['7', 'Dominant 7', '7', [0, 4, 7, 10]],
  ['maj7', 'Major 7', 'maj7', [0, 4, 7, 11]],
  ['m7', 'Minor 7', 'm7', [0, 3, 7, 10]],
  ['dim', 'Diminished', 'dim', [0, 3, 6]],
  ['aug', 'Augmented', 'aug', [0, 4, 8]],
  ['sus2', 'Suspended 2', 'sus2', [0, 2, 7]],
  ['sus4', 'Suspended 4', 'sus4', [0, 5, 7]],
  ['5', 'Power chord', '5', [0, 7]],
  ['6', 'Major 6', '6', [0, 4, 7, 9]],
  ['add9', 'Add 9', 'add9', [0, 2, 4, 7]],
  ['9', 'Dominant 9', '9', [0, 2, 4, 7, 10]],
];

// ---------- state ----------
const ex = Object.assign(
  { mode: 'scale', root: 0, scale: 'major', chord: 'maj', notes: [0, 4, 7], accid: 'sharp', nat: false, label: 'note', shape: 0 },
  (() => { try { return JSON.parse(store.get('ex', '{}')); } catch { return {}; } })());
const saveEx = () => store.set('ex', JSON.stringify(ex));
const pcName = pc => (ex.accid === 'flat' ? FLAT : SHARP)[((pc % 12) + 12) % 12];
const scaleDef = () => SCALE_DEFS.find(d => d[0] === ex.scale) || SCALE_DEFS[1];
const chordDef = () => CHORD_DEFS.find(d => d[0] === ex.chord) || CHORD_DEFS[0];

// pitch classes currently shown: Map pc -> interval from root (or null in Notes mode)
function activeSet() {
  const m = new Map();
  if (ex.mode === 'notes') ex.notes.forEach(pc => m.set(pc, null));
  else (ex.mode === 'scale' ? scaleDef()[2] : chordDef()[3]).forEach(iv => m.set((ex.root + iv) % 12, iv % 12));
  if (ex.nat) BLACK_PCS.forEach(pc => m.delete(pc));
  return m;
}

function toneColor(iv) {
  if (iv === 0) return css('--accent');
  if (iv === null) return '#d8dee9';
  if (ex.mode === 'scale') return '#d8dee9';
  if (iv === 3 || iv === 4) return '#4fd1c5';
  if (iv === 6 || iv === 7 || iv === 8) return '#6ea8ff';
  if (iv >= 9) return '#b58cff';
  return '#aeb6c4';
}

// ---------- chord shapes that follow the current tuning ----------
// Search every fret window for one-note-per-string shapes that contain the chord's tones.
function findVoicings(pitches, chordIvs, rootPc) {
  const n = pitches.length;
  const pcs = chordIvs.map(iv => (rootPc + iv) % 12);
  const need = new Set(pcs), fifth = (rootPc + 7) % 12;
  if (pcs.length >= 4) need.delete(fifth); // 4+ note chords may drop the fifth
  const minSounded = n >= 5 ? 4 : 3;
  const found = new Map();

  for (let base = 0; base <= 14; base++) {
    const lo = Math.max(1, base), hi = lo + 3;
    const opts = pitches.map(p => {
      const o = [-1];
      if (base <= 4 && pcs.includes(p % 12)) o.push(0);
      for (let f = lo; f <= hi; f++) if (pcs.includes((p + f) % 12)) o.push(f);
      return o;
    });
    const cur = new Array(n);
    const rec = i => {
      if (i === n) { evaluate(cur.slice()); return; }
      for (const f of opts[i]) { cur[i] = f; rec(i + 1); }
    };
    rec(0);
  }

  function evaluate(v) {
    const sounded = v.map((f, i) => (f >= 0 ? i : -1)).filter(i => i >= 0);
    if (sounded.length < minSounded) return;
    if (sounded[sounded.length - 1] - sounded[0] + 1 !== sounded.length) return; // no muted string in the middle
    const have = new Set(sounded.map(i => (pitches[i] + v[i]) % 12));
    for (const pc of need) if (!have.has(pc)) return;
    const fretted = v.filter(f => f > 0);
    const minF = fretted.length ? Math.min(...fretted) : 0, maxF = fretted.length ? Math.max(...fretted) : 0;
    if (maxF - minF > 3) return;
    const bass = sounded[0], bassPc = (pitches[bass] + v[bass]) % 12;
    const opens = v.filter(f => f === 0).length;
    const barre = fretted.length && fretted.filter(f => f === minF).length >= 3 ? 0.8 : 0;
    const score = (maxF - minF) * 0.6 + minF * 0.35 + (n - sounded.length) * 0.8 + (bassPc === rootPc ? 0 : 2.5) - opens * 0.25 + barre;
    const key = v.join(',');
    if (!found.has(key)) found.set(key, { v, score });
  }
  return [...found.values()].sort((a, b) => a.score - b.score).slice(0, 8).map(x => x.v);
}

let voicingCache = { key: '', list: [] };
function currentVoicings() {
  if (ex.mode !== 'chord' || !strings.length) return [];
  const pitches = strings.map(s => Math.round(s.midi));
  const key = pitches.join() + '|' + ex.root + '|' + ex.chord + '|' + ex.nat;
  if (voicingCache.key !== key) voicingCache = { key, list: findVoicings(pitches, chordDef()[3], ex.root) };
  return voicingCache.list;
}

// ---------- controls ----------
const exScale = $('exScale'), exChord = $('exChord');
SCALE_DEFS.forEach(d => exScale.add(new Option(d[1], d[0])));
CHORD_DEFS.forEach(d => exChord.add(new Option(d[1], d[0])));

function setSeg(id, attr, val) {
  document.querySelectorAll('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset[attr] === val));
}

function chordName() { return pcName(ex.root) + chordDef()[2]; }

function renderControls() {
  setSeg('exMode', 'm', ex.mode); setSeg('exAcc', 'a', ex.accid); setSeg('exLabel', 'l', ex.label);
  exScale.value = ex.scale; exChord.value = ex.chord; $('exNat').checked = ex.nat;
  exScale.style.display = ex.mode === 'scale' ? '' : 'none';
  exChord.style.display = ex.mode === 'chord' ? '' : 'none';

  const set = activeSet();
  const order = [...set.keys()].sort((a, b) => ((a - ex.root + 12) % 12) - ((b - ex.root + 12) % 12));
  const names = order.map(pc => pcName(pc)).join('  ');
  $('exInfo').innerHTML = ex.mode === 'scale' ? `<b>${pcName(ex.root)} ${scaleDef()[1]}</b> &nbsp; ${names}`
    : ex.mode === 'chord' ? `<b>${chordName()}</b> &nbsp; ${names}`
    : `<b>Notes</b> &nbsp; ${names || 'tap piano keys to pick notes'}`;

  // piano keys: root, members, and (with "naturals only") dimmed accidentals
  document.querySelectorAll('.pk').forEach(k => {
    const pc = +k.dataset.pc;
    k.classList.toggle('in', set.has(pc));
    k.classList.toggle('root', ex.mode !== 'notes' && pc === ex.root);
    k.classList.toggle('dim', ex.nat && BLACK_PCS.includes(pc));
    const lbl = k.querySelector('b, .nm');
    if (lbl) lbl.textContent = pcName(pc);
  });

  // chord shape stepper
  const v = currentVoicings();
  $('shapeNav').style.display = ex.mode === 'chord' ? '' : 'none';
  if (ex.mode === 'chord') {
    ex.shape = v.length ? ((ex.shape % v.length) + v.length) % v.length : 0;
    $('shapeLabel').textContent = v.length
      ? `${chordName()} · shape ${ex.shape + 1}/${v.length} · ${v[ex.shape].map(f => (f < 0 ? 'x' : f)).join(' ')}`
      : 'no playable shape in this tuning';
  }
  saveEx();
}

function buildPiano() {
  const p = $('piano');
  p.innerHTML = '';
  [0, 2, 4, 5, 7, 9, 11].forEach(pc => {
    const k = document.createElement('div');
    k.className = 'pk w'; k.dataset.pc = pc;
    k.innerHTML = `<b></b><small>${midiFreq(60 + pc).toFixed(2)}</small>`; // octave 4
    k.onclick = () => pickKey(pc);
    p.appendChild(k);
  });
  [[1, 0.7], [3, 1.7], [6, 3.7], [8, 4.7], [10, 5.7]].forEach(([pc, pos]) => {
    const k = document.createElement('div');
    k.className = 'pk b'; k.dataset.pc = pc;
    k.style.left = (pos / 7 * 100) + '%';
    k.innerHTML = `<div class="nm"></div><span>${midiFreq(60 + pc).toFixed(1)}</span>`;
    k.onclick = e => { e.stopPropagation(); pickKey(pc); };
    p.appendChild(k);
  });
}

function pickKey(pc) {
  if (ex.mode === 'notes') {
    const i = ex.notes.indexOf(pc);
    if (i >= 0) ex.notes.splice(i, 1); else ex.notes.push(pc);
  } else { ex.root = pc; ex.shape = 0; }
  renderControls();
}

$('exMode').onclick = e => { const b = e.target.closest('button'); if (b) { ex.mode = b.dataset.m; ex.shape = 0; renderControls(); } };
$('exAcc').onclick = e => { const b = e.target.closest('button'); if (b) { ex.accid = b.dataset.a; renderControls(); } };
$('exLabel').onclick = e => { const b = e.target.closest('button'); if (b) { ex.label = b.dataset.l; renderControls(); } };
exScale.onchange = () => { ex.scale = exScale.value; renderControls(); };
exChord.onchange = () => { ex.chord = exChord.value; ex.shape = 0; renderControls(); };
$('exNat').onchange = () => { ex.nat = $('exNat').checked; renderControls(); };
$('shapePrev').onclick = () => { ex.shape--; renderControls(); };
$('shapeNext').onclick = () => { ex.shape++; renderControls(); };
$('exReset').onclick = () => { strings.forEach((_, i) => setStringOff(i, 0)); };

// view tabs
function setTab(v) {
  document.documentElement.dataset.view = v;
  store.set('tab', v);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
}
$('tabs').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.view); };

// ---------- fretboard canvas ----------
const FRETS = 24, PADR = 16;
let GUT = 92, TOP = 30, ROW = 46, SC = 1;
const bc = $('board'), bg = bc.getContext('2d'), wrap = $('boardWrap');
let BW = 720, BH = 300, boardW = 0, hover = null, drag = null;
const NORM = 1 - Math.pow(2, -FRETS / 12);
const xF = f => GUT + boardW * (1 - Math.pow(2, -f / 12)) / NORM;                 // real fret spacing, any fractional fret
const dxF = f => boardW * Math.LN2 / 12 * Math.pow(2, -f / 12) / NORM;              // width of one fret at f
const fOfX = x => -12 * Math.log2(Math.max(1e-6, 1 - (x - GUT) / boardW * NORM));
const rowY = i => TOP + (strings.length - 1 - i) * ROW + ROW / 2;                   // high string on top
const fmtF = f => (f >= 1000 ? f.toFixed(0) : f >= 100 ? f.toFixed(1) : f.toFixed(2));

function sizeBoard() {
  const dpr = window.devicePixelRatio || 1;
  BW = Math.max(wrap.clientWidth, 720);
  SC = Math.min(1.8, Math.max(1, BW / 900));
  GUT = Math.round(92 * Math.min(SC, 1.35)); TOP = Math.round(30 * Math.min(SC, 1.3)); ROW = Math.round(46 * SC);
  BH = TOP + Math.max(strings.length, 1) * ROW + Math.round(22 * SC);
  if (bc.width !== Math.round(BW * dpr) || bc.height !== Math.round(BH * dpr)) {
    bc.width = BW * dpr; bc.height = BH * dpr;
    bc.style.width = BW + 'px'; bc.style.height = BH + 'px';
  }
  bg.setTransform(dpr, 0, 0, dpr, 0, 0);
  boardW = BW - GUT - PADR;
}

function rrect(x, y, w, h, r) { bg.beginPath(); bg.roundRect(x, y, w, h, r); }

// every dot to draw: each active note at each fret it falls on, with fractional frets while a string is detuned
function collectDots(set, voicing) {
  const dots = [];
  strings.forEach((s, i) => {
    const p = s.midi;
    for (let m = Math.ceil(p - 0.5); m <= Math.floor(p + FRETS + 0.5); m++) {
      const pc = ((m % 12) + 12) % 12;
      if (!set.has(pc)) continue;
      const f = m - p;
      const iv = set.get(pc);
      let alpha = 1;
      if (f < 0) alpha = Math.max(0, 1 + f / 0.5);
      if (f > FRETS) alpha = Math.max(0, 1 - (f - FRETS) / 0.5);
      if (alpha <= 0) continue;
      const fc = Math.max(0, Math.min(FRETS, f));
      const r = Math.max(9 * SC, Math.min(14 * SC, dxF(fc) * 0.46));
      // open-string dots sit just left of the nut and slide onto the board as the string goes flat
      const x = xF(fc) - r * 1.35 * Math.max(0, 1 - fc / 0.6);
      let voiced = true;
      if (voicing) voiced = Math.abs(f - Math.round(f)) < 0.5 && voicing[i] === Math.round(f);
      dots.push({ i, x, y: rowY(i), r, pc, m, f, iv, alpha: alpha * (voiced ? 1 : 0.14), voiced });
    }
  });
  return dots;
}

function dotLabel(d) {
  if (ex.label === 'hz') return fmtF(midiFreq(d.m));
  if (ex.label === 'interval') return IV_NAMES[((d.pc - ex.root) % 12 + 12) % 12];
  return pcName(d.pc);
}

function drawBoard() {
  if (document.documentElement.dataset.view !== 'explore') return;
  sizeBoard();
  const g2 = bg, n = strings.length;
  g2.clearRect(0, 0, BW, BH);
  const accent = css('--accent'), dim = css('--dim');
  if (!n) {
    g2.fillStyle = dim; g2.font = '14px -apple-system, sans-serif'; g2.textAlign = 'center';
    g2.fillText('Pick a string instrument to see the fretboard', BW / 2, BH / 2);
    return;
  }

  // board
  const bgrad = g2.createLinearGradient(0, TOP, 0, BH);
  bgrad.addColorStop(0, '#171a21'); bgrad.addColorStop(1, '#0f1116');
  g2.fillStyle = bgrad; rrect(GUT - 8, TOP - 2, boardW + 8 + PADR - 4, n * ROW + 4, 10); g2.fill();

  // inlays
  g2.fillStyle = 'rgba(255,255,255,.07)';
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(f => { g2.beginPath(); g2.arc((xF(f - 1) + xF(f)) / 2, TOP + n * ROW / 2, 5 * SC, 0, 7); g2.fill(); });
  [-1, 1].forEach(k => { g2.beginPath(); g2.arc((xF(11) + xF(12)) / 2, TOP + n * ROW / 2 + k * ROW * Math.min(1, n / 4) * 0.9, 5 * SC, 0, 7); g2.fill(); });

  // fret numbers + wires + nut
  g2.textAlign = 'center'; g2.font = `500 ${Math.round(10 * SC)}px -apple-system, sans-serif`;
  for (let f = 1; f <= FRETS; f++) {
    const x = Math.round(xF(f)) + .5;
    g2.strokeStyle = '#2f3540'; g2.lineWidth = 1.2;
    g2.beginPath(); g2.moveTo(x, TOP); g2.lineTo(x, TOP + n * ROW); g2.stroke();
    g2.fillStyle = [3, 5, 7, 9, 12, 15, 17, 19, 21].includes(f) ? '#9aa3b2' : '#566070';
    g2.fillText(f, (xF(f - 1) + xF(f)) / 2, TOP - 10 * Math.min(SC, 1.3));
  }
  g2.fillStyle = '#c9ced8'; g2.fillRect(GUT - 3, TOP, Math.round(5 * Math.sqrt(SC)), n * ROW);

  // strings
  strings.forEach((s, i) => {
    const y = rowY(i), w = Math.sqrt(SC) * Math.max(1.2, Math.min(4, (inst.wires[i] || 2) * 0.55));
    const gr = g2.createLinearGradient(0, y - w, 0, y + w);
    gr.addColorStop(0, '#6f7480'); gr.addColorStop(.5, '#d6dae3'); gr.addColorStop(1, '#6f7480');
    g2.fillStyle = gr; g2.fillRect(GUT, y - w / 2, boardW + PADR - 8, w);
  });

  // dots
  const voicings = currentVoicings();
  const voicing = ex.mode === 'chord' && voicings.length ? voicings[ex.shape % voicings.length] : null;
  const set = activeSet();
  const dots = collectDots(set, voicing);
  const dpc = detected ? ((Math.round(69 + 12 * Math.log2(detected.freq / 440)) % 12) + 12) % 12 : -1;
  const hz = ex.label === 'hz';
  g2.textBaseline = 'middle';
  dots.forEach(d => {
    const col = toneColor(d.iv);
    g2.globalAlpha = d.alpha;
    if (d.iv === 0) { g2.shadowColor = col; g2.shadowBlur = 14; }
    g2.fillStyle = col;
    const pw = hz ? Math.max(34 * SC, d.r * 2.6) : d.r * 2;
    if (hz) rrect(d.x - pw / 2, d.y - d.r, pw, d.r * 2, d.r); else { g2.beginPath(); g2.arc(d.x, d.y, d.r, 0, 7); }
    g2.fill();
    g2.shadowBlur = 0;
    if (d.pc === dpc && d.voiced) { g2.strokeStyle = '#fff'; g2.lineWidth = 2; g2.stroke(); }
    g2.fillStyle = '#0d0f13';
    g2.font = `700 ${hz ? Math.max(10 * SC, d.r * 0.85) : Math.max(10 * SC, d.r * 0.95)}px -apple-system, "SF Pro Text", sans-serif`;
    g2.fillText(dotLabel(d), d.x, d.y + 0.5);
    g2.globalAlpha = 1;
  });

  // muted strings in the shown chord shape
  if (voicing) {
    g2.fillStyle = dim; g2.font = `600 ${Math.round(14 * SC)}px -apple-system, sans-serif`;
    voicing.forEach((f, i) => { if (f < 0) g2.fillText('×', GUT - 18, rowY(i)); });
  }

  // string labels (gutter): open note, live frequency, detune
  g2.textAlign = 'left';
  strings.forEach((s, i) => {
    const y = rowY(i), off = stringOff[i] || 0;
    g2.fillStyle = off ? accent : '#e8eaee';
    const fs = Math.min(SC, 1.35); g2.font = `700 ${Math.round(14 * fs)}px -apple-system, "SF Pro Text", sans-serif`;
    g2.fillText(`${pcName(Math.round(s.midi))}${s.oct}${s.cents ? ' ' + fmtCents(s.cents) : ''}`, 8, y - 7 * fs);
    g2.fillStyle = dim; g2.font = `500 ${Math.round(11 * fs)}px -apple-system, sans-serif`;
    g2.fillText(`${s.freq.toFixed(2)} Hz`, 8, y + 9 * fs);
  });

  // hover tooltip
  if (hover && !drag) {
    const d = dots.filter(x => x.voiced && x.alpha > .5).find(x => Math.hypot(x.x - hover.x, x.y - hover.y) <= x.r + 3);
    if (d) {
      const lines = [`${pcName(d.pc)}${Math.floor(d.m / 12) - 1}`, `${midiFreq(d.m).toFixed(2)} Hz`,
        `fret ${Math.abs(d.f - Math.round(d.f)) < 0.005 ? Math.round(d.f) : d.f.toFixed(2)} · ${IV_NAMES[((d.pc - ex.root) % 12 + 12) % 12]}`];
      const ts = Math.min(SC, 1.5);
      g2.font = `600 ${Math.round(12 * ts)}px -apple-system, sans-serif`;
      const tw = Math.max(...lines.map(l => g2.measureText(l).width)) + 18 * ts, th = 58 * ts;
      const tx = Math.min(BW - tw - 4, Math.max(4, d.x - tw / 2)), ty = d.y - d.r - th - 6 < 2 ? d.y + d.r + 6 : d.y - d.r - th - 6;
      g2.fillStyle = '#0b0c0f'; g2.strokeStyle = '#3a404b'; g2.lineWidth = 1;
      rrect(tx, ty, tw, th, 8); g2.fill(); g2.stroke();
      g2.textAlign = 'left';
      lines.forEach((l, k) => { g2.fillStyle = k === 0 ? '#fff' : k === 1 ? accent : dim; g2.fillText(l, tx + 9 * ts, ty + 14 * ts + k * 16 * ts); });
    }
  }
  g2.textBaseline = 'alphabetic';
}

// drag a string sideways: its notes slide along it and the string detunes continuously
const ptr = e => { const r = bc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const rowAt = y => { const r = Math.floor((y - TOP) / ROW), i = strings.length - 1 - r; return r >= 0 && i >= 0 && i < strings.length ? i : -1; };
bc.addEventListener('pointerdown', e => {
  const { x, y } = ptr(e), i = rowAt(y);
  if (i < 0 || x < GUT - 8) return;
  drag = { i, f0: fOfX(Math.min(x, GUT + boardW * 0.995)), off0: stringOff[i] || 0 };
  bc.setPointerCapture(e.pointerId);
});
bc.addEventListener('pointermove', e => {
  const { x, y } = ptr(e);
  hover = { x, y };
  if (!drag) return;
  let off = drag.off0 - (fOfX(Math.min(Math.max(x, GUT), GUT + boardW * 0.995)) - drag.f0);
  const r = Math.round(off);
  if (Math.abs(off - r) < 0.09) off = r; // magnet to whole semitones
  setStringOff(drag.i, off);
});
bc.addEventListener('pointerup', () => { drag = null; });
bc.addEventListener('pointerleave', () => { hover = null; });
bc.addEventListener('dblclick', e => { const i = rowAt(ptr(e).y); if (i >= 0) setStringOff(i, 0); });

// ---------- boot ----------
let lastPitchKey = '';
function exLoop() {
  const k = strings.map(s => Math.round(s.midi)).join();
  if (k !== lastPitchKey) { lastPitchKey = k; renderControls(); } // chord shapes follow the tuning
  drawBoard();
  requestAnimationFrame(exLoop);
}
buildPiano();
renderControls();
setTab(store.get('tab', 'tune') === 'explore' ? 'explore' : 'tune');
exLoop();
