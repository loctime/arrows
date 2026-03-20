# ARROWZ — Modular Game Platform

Snake-path arrow puzzle. Tap a snake and it slides smoothly out of the board.
Every level is procedurally verified to have a solution.

---

## File structure

```
arrowz/
├── index.html          — Shell: HTML layout + script tags (no logic)
├── sw.js               — Service Worker (PWA / offline)
├── css/
│   └── style.css       — All styles + CSS custom properties (design tokens)
└── js/
    ├── audio.js        — Web Audio SFX engine (no deps)
    ├── levels.js       — Level data + LevelGenerator class (no deps)
    ├── engine.js       — Game logic, renderer, RAF loop
    ├── ui.js           — DOM overlay, HUD, button wiring
    └── main.js         — Bootstrap entry point (3 lines)
```

---

## Module responsibilities

| File | Knows about | Does NOT know about |
|---|---|---|
| `audio.js` | Web Audio API | DOM, canvas, game state |
| `levels.js` | Level data format | DOM, canvas, engine |
| `engine.js` | Canvas, grid, snakes | DOM overlays, button labels |
| `ui.js` | DOM, Engine events | Canvas, game math |
| `main.js` | Everything (bootstrap) | Nothing (just calls init) |

---

## Engine event bus

The Engine emits these events. Subscribe with `Engine.on(event, callback)`.

```js
Engine.on('hud',       ({ level, lives, score, mistakes, total, done }) => { ... });
Engine.on('exit',      ({ snake, score, lives }) => { ... });
Engine.on('collision', ({ snake, score, lives }) => { ... });
Engine.on('win',       ({ score, mistakes, level }) => { ... });
Engine.on('lose',      ({ score, level }) => { ... });
```

---

## Level format

```js
{
  size:     8,              // grid is size × size
  solution: [2, 0, 1, 3],  // snake indices in correct activation order
  snakes: [
    {
      cells: [{x,y}, ...], // body from TAIL to HEAD
      dir:   'R'           // 'U' | 'D' | 'L' | 'R'  — launch direction
    }
  ]
}
```

### Guarantees (enforced at generation time)
1. Zero cell overlaps between snakes
2. At least one valid solution order exists
3. No two snakes face each other head-on on the same row/column
4. No snake's `dir` points backward into its own body

---

## Generate new levels at runtime

```js
const gen   = new LevelGenerator(/* optional seed */);
const level = gen.generate({ N: 9, count: 6, minLen: 5, maxLen: 11 });
if (level) {
  LEVELS.push(level);
  Engine.loadLevel(LEVELS.length - 1);
}
```

---

## Building a new game on this platform

1. **Copy this folder** and rename it.
2. **Replace `levels.js`** — define your own level format and data.
3. **Replace `engine.js`** — write your game logic + canvas renderer.
   - Keep the `Engine.on()` event bus pattern so `ui.js` keeps working.
   - Required events: `hud`, `win`, `lose`.
4. **Keep `audio.js`** — it's game-agnostic. Add new sounds by adding methods.
5. **Keep `ui.js` + `style.css`** — update labels and CSS tokens as needed.
6. **Update `index.html`** — change logo text and how-to copy.

### Minimum engine contract for `ui.js` to work

```js
const Engine = {
  loadLevel(idx, levelData) { ... },
  restart() { ... },
  hint()    { ... },
  on(event, cb) { ... },
  off(event, cb) { ... },
};
```

---

## Running locally

```bash
# Any static file server works:
npx serve .
python3 -m http.server 8080
```

Open `http://localhost:8080` — no build step required.

---

## PWA / offline

The included `sw.js` caches all assets on first load.
Bump `CACHE_VERSION` in `sw.js` whenever you deploy updated files.
