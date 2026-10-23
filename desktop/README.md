# tunIN desktop (Electron wrapper)
Run: `cd desktop && npm install && npm start`
Loads `desktop/web/` if present, otherwise `../web/`.
Build installers: `npm run dist` (copies ../web to desktop/web first).
The app only grants the microphone permission.
