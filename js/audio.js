/**
 * audio.js — ARROWZ · Web Audio SFX engine
 *
 * Exposes a single global `SFX` object with named sound methods.
 * All synthesis is procedural (no audio files needed).
 * AudioContext is lazy-initialized on first call (browser autoplay policy).
 *
 * Usage:
 *   SFX.tap();   SFX.exit();   SFX.boom();
 *   SFX.win();   SFX.lose();   SFX.start();
 *
 * To add a new sound:
 *   1. Add a method to the returned object.
 *   2. Use the `tone(freq, duration, type, volume, delay)` helper.
 */

const SFX = (() => {
  let AC = null;

  /** Lazy-init AudioContext (required by browser autoplay policy) */
  const getCtx = () => {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    return AC;
  };

  /**
   * Play a single synthesized tone.
   * @param {number} freq    - Frequency in Hz
   * @param {number} dur     - Duration in seconds
   * @param {string} type    - OscillatorType: 'sine'|'square'|'sawtooth'|'triangle'
   * @param {number} vol     - Peak gain (0–1)
   * @param {number} delay   - Start delay in seconds from now
   */
  const tone = (freq, dur, type = 'sine', vol = 0.1, delay = 0) => {
    try {
      const c = getCtx();
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime + delay);
      gain.gain.setValueAtTime(vol, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + dur);
    } catch (e) {
      // Silently ignore — audio is non-critical
    }
  };

  return {
    /** Short click when tapping a snake */
    tap()   { tone(500, 0.05, 'square',   0.08); },

    /** Ascending chord when a snake exits the board */
    exit()  {
      [880, 1100, 1320, 1760].forEach((f, i) =>
        tone(f, 0.1, 'sine', 0.12, i * 0.05)
      );
    },

    /** Low thud on collision */
    boom()  {
      tone(100, 0.4, 'sawtooth', 0.25);
      tone(70,  0.5, 'square',   0.20, 0.1);
    },

    /** Victory fanfare on level clear */
    win()   {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(f, 0.2, 'sine', 0.15, i * 0.1)
      );
    },

    /** Descending tones on game over */
    lose()  {
      tone(220, 0.2, 'sawtooth', 0.20);
      tone(150, 0.3, 'sawtooth', 0.20, 0.20);
      tone(100, 0.4, 'square',   0.20, 0.38);
    },

    /** Rising intro when starting/restarting a level */
    start() {
      [330, 440, 550, 660].forEach((f, i) =>
        tone(f, 0.1, 'sine', 0.1, i * 0.07)
      );
    },
  };
})();
