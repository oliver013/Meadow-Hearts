# Pixel Realm — Development Guide

## Cursor Cloud specific instructions

### Project overview

Pixel Realm is a zero-build, zero-dependency browser RPG. All game code is vanilla JS loaded via `<script>` tags in `index.html`. There is no bundler, no framework, and no `package.json` committed (it's in `.gitignore`).

### Running the game

Serve the repo root with any static HTTP server:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome.

### Tests

All test dependencies are installed via `npm install` (the `package.json`/`node_modules` are gitignored and ephemeral):

| Test | Command | Dependencies |
|------|---------|--------------|
| Smoke (logic) | `node test/smoke.js` | Node.js only |
| Render (sprites) | `node test/render.js` | `canvas` npm package + system libs (`libcairo2-dev`, `libjpeg-dev`, `libpango1.0-dev`, `libgif-dev`, `librsvg2-dev`) |
| Integration (E2E) | `node test/integration.js` | `puppeteer` npm package + Chrome at `/usr/local/bin/google-chrome` + HTTP server on port 8000 |

### Gotchas

- **Integration test favicon 404**: The integration test counts all console errors, including the browser's automatic `favicon.ico` request. If a `favicon.ico` file doesn't exist, the test reports 1 error. Creating an empty `touch favicon.ico` in the repo root resolves this. This is a pre-existing test quirk, not a real failure.
- **Chrome path**: The integration test hardcodes `/usr/local/bin/google-chrome`. The VM has Chrome installed at `/usr/bin/google-chrome-stable`. A symlink is created by the update script: `ln -sf /usr/bin/google-chrome-stable /usr/local/bin/google-chrome`.
- **No linter**: There is no ESLint or other linter configured for this project.
- **Code is on a feature branch**: The `main` branch contains only a readme placeholder. All product code is on `origin/cursor/pixel-rpg-game-afd2`.
