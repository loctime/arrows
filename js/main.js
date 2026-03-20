/**
 * main.js — ARROWZ · Entry point
 *
 * This file is intentionally tiny.
 * All logic lives in audio.js / levels.js / engine.js / ui.js.
 *
 * Boot sequence
 * ─────────────────────────────────────────────────────
 *  1. UI.init()         — wires engine events, shows start overlay
 *  2. (user taps PLAY)
 *  3. Engine.loadLevel  — called by UI._onOverlayBtn()
 *
 * To add a new game on this platform
 * ─────────────────────────────────────────────────────
 *  1. Copy this folder
 *  2. Replace levels.js with your own level data / generator
 *  3. Replace engine.js with your game's logic + renderer
 *  4. Keep audio.js, ui.js, style.css — they're generic enough to reuse
 *  5. Update index.html labels (logo, how-to text)
 */

// Register service worker for PWA support (optional, requires sw.js)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // sw.js is optional — silently skip if not present
  });
}

// Boot
UI.init();
