# tunIN

A guitar, bass and ukulele tuner that runs as a PWA and as a desktop app.

- **Tune:** pitch detection (YIN + FFT refinement), a non-linear cents meter centred on the target note, and a live spectrum with Full / Focus / Lens views.
- **Tunings:** grouped by family (Standard, Drop, Open, Alternate) plus a slide control that shifts every string together, so Drop C is just Drop D slid down two semitones.
- **Explore:** a fretboard with scale, chord and note filters, a piano-key note picker, continuous per-string detuning (drag a string sideways) and chord shapes that follow the tuning.

## Run

Web / PWA (no build step):

```bash
cd web && python3 -m http.server 5173
```

Then open http://localhost:5173 and press **Start listening**. The microphone needs `localhost` or HTTPS.

Desktop (Electron):

```bash
cd desktop && npm install && npm start
```

## Layout

- `web/`: the app (`app.js` tuner, `fretboard.js` Explore tab, `sw.js` service worker, manifest and icons)
- `desktop/`: Electron wrapper that bundles `web/`
