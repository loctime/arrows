/**
 * ui.js — ARROWZ · User Interface layer
 *
 * Responsibilities
 * ─────────────────────────────────────────────────────
 *  • HUD updates (level, score, lives, progress bar)
 *  • Overlay management (start screen, win, lose)
 *  • Button handlers (reset, hint, skip)
 *  • Wires to Engine via Engine.on() events
 *
 * Dependencies
 *  • engine.js  → Engine
 *  • levels.js  → LEVELS
 *
 * Extending for a new game
 * ─────────────────────────────────────────────────────
 *  1. Replace the HTML overlay markup in index.html
 *  2. Update the showOverlay() / _bindEvents() functions here
 *  3. The HUD and engine wiring remain reusable as-is
 */

const UI = (() => {

  // ── DOM references ──────────────────────────────────
  const $ = id => document.getElementById(id);

  const elLevel    = $('h-lv');
  const elScore    = $('h-sc');
  const elLives    = $('h-li');
  const elProgBar  = $('prog-bar');
  const elOverlay  = $('ov');
  const elOvTitle  = $('ov-title');
  const elOvSub    = $('ov-sub');
  const elOvHow    = $('ov-how');
  const elOvStars  = $('ov-stars');
  const elOvBtn    = $('ov-btn');
  const starEls    = [1, 2, 3].map(i => $('s' + i));

  // ── Internal state ──────────────────────────────────
  let _currentLevel = 0;
  let _ovMode       = 'start'; // 'start' | 'win' | 'lose'

  // ── HUD ─────────────────────────────────────────────

  function _updateHUD({ level, lives, score, done, total }) {
    elLevel.textContent = level + 1;
    elScore.textContent = score;
    elLives.textContent = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives));
    elProgBar.style.width = total > 0 ? (done / total * 100) + '%' : '0%';
  }

  // ── Overlays ────────────────────────────────────────

  function _showOverlay(type, data = {}) {
    if (type === 'start') {
      elOvTitle.textContent  = 'ARROWZ';
      elOvTitle.className    = 'ov-title cyan';
      elOvSub.innerHTML      = 'TAP A SNAKE — IT SLITHERS OUT<br>TAIL FADES · HEAD EXITS THE BOARD<br>EVERY LEVEL HAS A SOLUTION';
      elOvHow.style.display  = 'flex';
      elOvStars.style.display = 'none';
      elOvBtn.textContent    = 'PLAY';
      _ovMode = 'start';

    } else if (type === 'win') {
      const stars = data.mistakes === 0 ? 3 : data.mistakes <= 1 ? 2 : 1;
      elOvTitle.textContent   = 'CLEARED!';
      elOvTitle.className     = 'ov-title cyan';
      elOvSub.innerHTML       = `LEVEL ${data.level + 1} COMPLETE<br>${data.score} PTS`;
      elOvHow.style.display   = 'none';
      elOvStars.style.display = 'flex';
      starEls.forEach((el, i) => {
        el.classList.remove('on');
        if (i < stars) setTimeout(() => el.classList.add('on'), (i + 1) * 300);
      });
      elOvBtn.textContent = _currentLevel < LEVELS.length - 1 ? 'NEXT LEVEL' : 'REPLAY';
      _ovMode = 'win';

      // Notify ControlGames platform if running inside an iframe
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: 'CONTROLGAMES_SCORE', gameId: 'arrowz', score: data.score, label: 'ARROWZ' },
          '*'
        );
      }

    } else if (type === 'lose') {
      elOvTitle.textContent   = 'FAILED';
      elOvTitle.className     = 'ov-title red';
      elOvSub.innerHTML       = 'OUT OF LIVES<br>TRY AGAIN';
      elOvHow.style.display   = 'none';
      elOvStars.style.display = 'none';
      elOvBtn.textContent     = 'RETRY';
      _ovMode = 'lose';
    }

    elOverlay.classList.remove('off');
  }

  function _hideOverlay() {
    elOverlay.classList.add('off');
    // Always restore how-to for future overlays triggered by win/lose
    elOvHow.style.display = 'none';
  }

  // ── Button actions ──────────────────────────────────

  function _onOverlayBtn() {
    _hideOverlay();
    if (_ovMode === 'win') {
      _currentLevel = (_currentLevel + 1) % LEVELS.length;
    }
    Engine.loadLevel(_currentLevel);
  }

  function _onReset() {
    _hideOverlay();
    Engine.restart();
  }

  function _onHint() {
    Engine.hint();
  }

  function _onSkip() {
    _hideOverlay();
    _currentLevel = (_currentLevel + 1) % LEVELS.length;
    Engine.loadLevel(_currentLevel);
  }

  // ── Engine event wiring ─────────────────────────────

  function _bindEngineEvents() {
    Engine.on('hud',       data => _updateHUD({ ...data }));
    Engine.on('win',       data => _showOverlay('win',  data));
    Engine.on('lose',      data => _showOverlay('lose', data));
  }

  // ── DOM event wiring ────────────────────────────────

  function _bindDOMEvents() {
    elOvBtn.addEventListener('click', _onOverlayBtn);
    $('btn-reset')?.addEventListener('click', _onReset);
    $('btn-hint')?.addEventListener('click',  _onHint);
    $('btn-skip')?.addEventListener('click',  _onSkip);
  }

  // ── Init ────────────────────────────────────────────

  function init() {
    _bindEngineEvents();
    _bindDOMEvents();
    _showOverlay('start');
  }

  // ── Public API ──────────────────────────────────────
  return {
    init,

    /** Programmatically navigate to a specific level */
    goToLevel(idx) {
      _currentLevel = idx % LEVELS.length;
      _hideOverlay();
      Engine.loadLevel(_currentLevel);
    },

    /** Show any overlay type externally (e.g. 'pause') */
    showOverlay: _showOverlay,
    hideOverlay: _hideOverlay,
  };

})();
