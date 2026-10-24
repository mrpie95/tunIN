# Changelog

All notable changes to tunIN are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Put new changes under **Unreleased**.

## [Unreleased]

## [0.2.0] - 2026-10-24

### Added
- Explore tab: fretboard that shows a scale, chord or hand-picked notes, with a piano-key note picker, sharp/flat names, a naturals-only filter and note / interval / Hz labels.
- Drag a string sideways on the fretboard to detune it continuously; its notes slide along the string.
- Chord shapes that follow the current tuning, with a stepper for alternative shapes.
- Meter on a non-linear scale centred on the target note, and a Lens spectrum view on the same scale.
- Tuning families sidebar (Standard, Drop, Open, Alternate) and a slide control that shifts every string together, with the resulting tuning name (for example Drop C).
- Smoothing control for the pitch reading, meter and spectrum.
- Bass, Bass 5, Bass 6, Ukulele and Chromatic modes.
- About dialog with the version number and this build log.

### Changed
- Explore uses the full window width on desktop, with a larger fretboard (24 frets, bigger dots and strings).
- Pitch detection locks on faster (per-frame detection, pluck-onset reset, shorter hold) and is refined with the FFT peak for bass accuracy.
- The service worker is network-first, so updates appear on the next load.

## [0.1.0] - 2026-10-23

### Added
- Guitar tuner PWA: microphone pitch detection (YIN), six-string display, string buttons and a frequency spectrum with target lines.
- Electron desktop wrapper.
