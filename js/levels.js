/**
 * levels.js — ARROWZ · Level data & generator utilities
 *
 * LEVEL FORMAT
 * ─────────────────────────────────────────────────────
 * {
 *   size:     number          — grid is size × size
 *   solution: number[]        — snake indices in correct activation order
 *   snakes: [{
 *     cells: [{x,y}, ...]    — body from TAIL to HEAD
 *     dir:   'U'|'D'|'L'|'R' — direction the head launches
 *   }]
 * }
 *
 * GUARANTEES (enforced at generation time)
 * ─────────────────────────────────────────────────────
 *  1. Zero cell overlaps between snakes
 *  2. Every level has at least one valid solution order (greedy-verified)
 *  3. No two snakes face each other head-on on the same row/column
 *  4. No snake's `dir` points backward into its own body
 *
 * EXPORTS
 * ─────────────────────────────────────────────────────
 *  LEVELS          — Array of pre-generated, verified levels
 *  LevelGenerator  — Class for runtime level generation
 */

// ─────────────────────────────────────────────────────────────────
// PRE-GENERATED LEVELS (7 levels, difficulty ramp 7×7 → 10×10)
// ─────────────────────────────────────────────────────────────────
const LEVELS = [
  // LV 1 · 7×7 · 4 snakes
  {"size":7,"solution":[0,1,2,3],"snakes":[{"cells":[{"x":4,"y":0},{"x":5,"y":0},{"x":5,"y":1},{"x":6,"y":1}],"dir":"R"},{"cells":[{"x":0,"y":1},{"x":1,"y":1},{"x":2,"y":1},{"x":2,"y":0}],"dir":"U"},{"cells":[{"x":1,"y":3},{"x":0,"y":3},{"x":0,"y":4},{"x":1,"y":4}],"dir":"D"},{"cells":[{"x":6,"y":3},{"x":6,"y":2},{"x":5,"y":2},{"x":4,"y":2}],"dir":"D"}]},
  // LV 2 · 8×8 · 5 snakes
  {"size":8,"solution":[0,2,1,3,4],"snakes":[{"cells":[{"x":6,"y":4},{"x":5,"y":4},{"x":5,"y":5},{"x":4,"y":5},{"x":3,"y":5},{"x":2,"y":5},{"x":2,"y":4},{"x":1,"y":4},{"x":1,"y":5}],"dir":"L"},{"cells":[{"x":5,"y":0},{"x":6,"y":0},{"x":7,"y":0},{"x":7,"y":1},{"x":6,"y":1},{"x":5,"y":1}],"dir":"L"},{"cells":[{"x":1,"y":0},{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2},{"x":0,"y":3},{"x":0,"y":4}],"dir":"R"},{"cells":[{"x":7,"y":7},{"x":7,"y":6},{"x":6,"y":6},{"x":6,"y":7},{"x":5,"y":7},{"x":5,"y":6},{"x":4,"y":6},{"x":4,"y":7}],"dir":"D"},{"cells":[{"x":3,"y":3},{"x":4,"y":3},{"x":4,"y":2},{"x":3,"y":2},{"x":2,"y":2}],"dir":"U"}]},
  // LV 3 · 8×8 · 6 snakes
  {"size":8,"solution":[0,3,4,5,2,1],"snakes":[{"cells":[{"x":6,"y":5},{"x":5,"y":5},{"x":4,"y":5},{"x":4,"y":6},{"x":4,"y":7}],"dir":"R"},{"cells":[{"x":4,"y":2},{"x":3,"y":2},{"x":2,"y":2},{"x":2,"y":3},{"x":1,"y":3},{"x":1,"y":2},{"x":0,"y":2},{"x":0,"y":3},{"x":0,"y":4}],"dir":"D"},{"cells":[{"x":0,"y":6},{"x":1,"y":6},{"x":2,"y":6},{"x":2,"y":5},{"x":2,"y":4}],"dir":"R"},{"cells":[{"x":2,"y":1},{"x":2,"y":0},{"x":3,"y":0},{"x":4,"y":0},{"x":4,"y":1},{"x":3,"y":1}],"dir":"L"},{"cells":[{"x":7,"y":1},{"x":6,"y":1},{"x":6,"y":2},{"x":5,"y":2},{"x":5,"y":1}],"dir":"R"},{"cells":[{"x":3,"y":4},{"x":3,"y":5},{"x":3,"y":6},{"x":3,"y":7},{"x":2,"y":7}],"dir":"L"}]},
  // LV 4 · 9×9 · 6 snakes
  {"size":9,"solution":[0,1,2,3,4,5],"snakes":[{"cells":[{"x":5,"y":0},{"x":5,"y":1},{"x":5,"y":2},{"x":5,"y":3},{"x":5,"y":4},{"x":5,"y":5},{"x":6,"y":5},{"x":6,"y":6},{"x":7,"y":6},{"x":8,"y":6},{"x":8,"y":7}],"dir":"R"},{"cells":[{"x":5,"y":6},{"x":4,"y":6},{"x":3,"y":6},{"x":3,"y":5},{"x":2,"y":5},{"x":2,"y":6},{"x":2,"y":7},{"x":1,"y":7},{"x":1,"y":6},{"x":1,"y":5},{"x":0,"y":5},{"x":0,"y":6}],"dir":"R"},{"cells":[{"x":6,"y":3},{"x":7,"y":3},{"x":7,"y":2},{"x":7,"y":1},{"x":8,"y":1},{"x":8,"y":2},{"x":8,"y":3},{"x":8,"y":4},{"x":8,"y":5},{"x":7,"y":5},{"x":7,"y":4},{"x":6,"y":4}],"dir":"U"},{"cells":[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2},{"x":0,"y":1},{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":2,"y":1},{"x":2,"y":2}],"dir":"L"},{"cells":[{"x":4,"y":2},{"x":4,"y":1},{"x":3,"y":1},{"x":3,"y":0},{"x":4,"y":0}],"dir":"U"},{"cells":[{"x":3,"y":7},{"x":3,"y":8},{"x":4,"y":8},{"x":5,"y":8},{"x":6,"y":8},{"x":6,"y":7},{"x":5,"y":7},{"x":4,"y":7}],"dir":"U"}]},
  // LV 5 · 9×9 · 7 snakes
  {"size":9,"solution":[0,1,2,4,5,3,6],"snakes":[{"cells":[{"x":7,"y":1},{"x":7,"y":2},{"x":6,"y":2},{"x":6,"y":1},{"x":5,"y":1},{"x":5,"y":0},{"x":6,"y":0},{"x":7,"y":0},{"x":8,"y":0}],"dir":"R"},{"cells":[{"x":1,"y":3},{"x":0,"y":3},{"x":0,"y":2},{"x":1,"y":2},{"x":2,"y":2},{"x":3,"y":2},{"x":3,"y":1},{"x":3,"y":0}],"dir":"R"},{"cells":[{"x":6,"y":3},{"x":5,"y":3},{"x":4,"y":3},{"x":3,"y":3},{"x":3,"y":4},{"x":2,"y":4},{"x":2,"y":5},{"x":3,"y":5},{"x":3,"y":6},{"x":4,"y":6}],"dir":"D"},{"cells":[{"x":0,"y":7},{"x":1,"y":7},{"x":2,"y":7},{"x":2,"y":6},{"x":1,"y":6},{"x":1,"y":5},{"x":0,"y":5}],"dir":"D"},{"cells":[{"x":7,"y":5},{"x":7,"y":6},{"x":6,"y":6},{"x":6,"y":5},{"x":5,"y":5},{"x":4,"y":5},{"x":4,"y":4},{"x":5,"y":4}],"dir":"D"},{"cells":[{"x":3,"y":7},{"x":3,"y":8},{"x":2,"y":8},{"x":1,"y":8},{"x":0,"y":8}],"dir":"D"},{"cells":[{"x":6,"y":8},{"x":6,"y":7},{"x":7,"y":7},{"x":8,"y":7},{"x":8,"y":8},{"x":7,"y":8}],"dir":"U"}]},
  // LV 6 · 10×10 · 7 snakes
  {"size":10,"solution":[0,1,2,4,5,3,6],"snakes":[{"cells":[{"x":5,"y":9},{"x":6,"y":9},{"x":7,"y":9},{"x":8,"y":9},{"x":9,"y":9},{"x":9,"y":8},{"x":9,"y":7},{"x":8,"y":7},{"x":8,"y":6},{"x":9,"y":6},{"x":9,"y":5},{"x":9,"y":4},{"x":8,"y":4}],"dir":"D"},{"cells":[{"x":1,"y":4},{"x":2,"y":4},{"x":2,"y":3},{"x":3,"y":3},{"x":3,"y":4},{"x":3,"y":5},{"x":4,"y":5},{"x":4,"y":4},{"x":5,"y":4}],"dir":"R"},{"cells":[{"x":2,"y":7},{"x":2,"y":6},{"x":2,"y":5},{"x":1,"y":5},{"x":1,"y":6},{"x":1,"y":7},{"x":1,"y":8},{"x":1,"y":9},{"x":2,"y":9},{"x":2,"y":8}],"dir":"L"},{"cells":[{"x":5,"y":3},{"x":4,"y":3},{"x":4,"y":2},{"x":3,"y":2},{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0},{"x":3,"y":0},{"x":3,"y":1},{"x":4,"y":1},{"x":4,"y":0},{"x":5,"y":0}],"dir":"D"},{"cells":[{"x":3,"y":7},{"x":3,"y":6},{"x":4,"y":6},{"x":4,"y":7},{"x":4,"y":8},{"x":3,"y":8},{"x":3,"y":9},{"x":4,"y":9}],"dir":"D"},{"cells":[{"x":7,"y":5},{"x":7,"y":6},{"x":7,"y":7},{"x":7,"y":8},{"x":6,"y":8},{"x":6,"y":7},{"x":5,"y":7},{"x":5,"y":6},{"x":6,"y":6},{"x":6,"y":5},{"x":5,"y":5}],"dir":"L"},{"cells":[{"x":1,"y":0},{"x":0,"y":0},{"x":0,"y":1},{"x":1,"y":1},{"x":1,"y":2},{"x":1,"y":3},{"x":0,"y":3}],"dir":"D"}]},
  // LV 7 · 10×10 · 8 snakes
  {"size":10,"solution":[4,1,5,3,0,2,6,7],"snakes":[{"cells":[{"x":2,"y":5},{"x":2,"y":6},{"x":1,"y":6},{"x":0,"y":6},{"x":0,"y":5},{"x":1,"y":5},{"x":1,"y":4},{"x":2,"y":4},{"x":3,"y":4}],"dir":"U"},{"cells":[{"x":4,"y":8},{"x":4,"y":7},{"x":4,"y":6},{"x":5,"y":6},{"x":5,"y":7},{"x":5,"y":8},{"x":6,"y":8},{"x":6,"y":7},{"x":6,"y":6},{"x":6,"y":5}],"dir":"R"},{"cells":[{"x":0,"y":2},{"x":0,"y":3},{"x":0,"y":4}],"dir":"D"},{"cells":[{"x":2,"y":3},{"x":2,"y":2},{"x":3,"y":2},{"x":3,"y":3},{"x":4,"y":3},{"x":4,"y":2},{"x":5,"y":2}],"dir":"U"},{"cells":[{"x":7,"y":8},{"x":7,"y":7},{"x":8,"y":7},{"x":8,"y":8},{"x":9,"y":8},{"x":9,"y":7},{"x":9,"y":6},{"x":9,"y":5},{"x":8,"y":5}],"dir":"U"},{"cells":[{"x":1,"y":3},{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":1},{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":1},{"x":5,"y":1},{"x":5,"y":0},{"x":4,"y":0},{"x":3,"y":0}],"dir":"L"},{"cells":[{"x":4,"y":9},{"x":3,"y":9},{"x":2,"y":9},{"x":1,"y":9},{"x":1,"y":8},{"x":1,"y":7},{"x":2,"y":7},{"x":3,"y":7},{"x":3,"y":8},{"x":2,"y":8}],"dir":"U"},{"cells":[{"x":6,"y":2},{"x":6,"y":3},{"x":7,"y":3},{"x":7,"y":2},{"x":7,"y":1},{"x":6,"y":1},{"x":6,"y":0}],"dir":"U"}]},
];

// ─────────────────────────────────────────────────────────────────
// LEVEL GENERATOR  (optional — use at runtime to create new levels)
// ─────────────────────────────────────────────────────────────────

/**
 * Runtime procedural level generator.
 * All generated levels satisfy the same 4 guarantees as the built-in ones.
 *
 * @example
 *   const gen = new LevelGenerator();
 *   const level = gen.generate({ N: 8, count: 5, minLen: 5, maxLen: 10 });
 *   if (level) LEVELS.push(level);
 */
class LevelGenerator {
  constructor(seed = null) {
    // Simple seedable RNG (xorshift32) so levels are reproducible
    this._state = seed ?? (Date.now() & 0xffffffff);
  }

  /** Seeded random float [0, 1) */
  _rand() {
    let x = this._state;
    x ^= x << 13; x ^= x >> 17; x ^= x << 5;
    this._state = x >>> 0;
    return (x >>> 0) / 0x100000000;
  }

  _randInt(n) { return Math.floor(this._rand() * n); }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this._randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  static DIRS = ['U', 'D', 'L', 'R'];
  static DV   = { U:{dx:0,dy:-1}, D:{dx:0,dy:1}, L:{dx:-1,dy:0}, R:{dx:1,dy:0} };
  static OPP  = { U:'D', D:'U', L:'R', R:'L' };

  /** Build a random winding path starting at (sx,sy) */
  _buildPath(sx, sy, length, occupied, N) {
    const cells = [{ x: sx, y: sy }];
    const seen  = new Set([`${sx},${sy}`]);
    let x = sx, y = sy;
    const dirs = [...LevelGenerator.DIRS];
    for (let i = 1; i < length; i++) {
      this._shuffle(dirs);
      let moved = false;
      for (const d of dirs) {
        const { dx, dy } = LevelGenerator.DV[d];
        const nx = x + dx, ny = y + dy;
        const k = `${nx},${ny}`;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
        if (seen.has(k) || occupied.has(k)) continue;
        cells.push({ x: nx, y: ny });
        seen.add(k); x = nx; y = ny; moved = true; break;
      }
      if (!moved) break;
    }
    return cells;
  }

  /** True if a snake can exit the board without hitting `occupied` */
  _canExit(body, dir, occupied, N) {
    const head = body[body.length - 1];
    const { dx, dy } = LevelGenerator.DV[dir];
    let cx = head.x + dx, cy = head.y + dy;
    while (cx >= 0 && cx < N && cy >= 0 && cy < N) {
      if (occupied.has(`${cx},${cy}`)) return false;
      cx += dx; cy += dy;
    }
    return true;
  }

  /** True if dir points backward into the snake's own body */
  _isBackward(body, dir) {
    if (body.length < 2) return false;
    const head = body[body.length - 1];
    const prev = body[body.length - 2];
    const { dx, dy } = LevelGenerator.DV[dir];
    return dx === -(head.x - prev.x) && dy === -(head.y - prev.y);
  }

  /** True if any two snakes in the list face each other head-on */
  _facingEachOther(snakes) {
    const OPP = LevelGenerator.OPP;
    const DV  = LevelGenerator.DV;
    for (let i = 0; i < snakes.length; i++) {
      for (let j = i + 1; j < snakes.length; j++) {
        const a = snakes[i], b = snakes[j];
        if (OPP[a.dir] !== b.dir) continue;
        const ah = a.body[a.body.length - 1];
        const bh = b.body[b.body.length - 1];
        const { dx, dy } = DV[a.dir];
        if (dx !== 0) {
          if (ah.y !== bh.y) continue;
          if (dx > 0 && bh.x > ah.x) return true;
          if (dx < 0 && bh.x < ah.x) return true;
        } else {
          if (ah.x !== bh.x) continue;
          if (dy > 0 && bh.y > ah.y) return true;
          if (dy < 0 && bh.y < ah.y) return true;
        }
      }
    }
    return false;
  }

  /**
   * Generate a single verified level.
   * Returns null if it can't satisfy all constraints within `attempts`.
   *
   * @param {object} opts
   * @param {number} opts.N        - Grid size (e.g. 8)
   * @param {number} opts.count    - Number of snakes
   * @param {number} opts.minLen   - Minimum snake length in cells
   * @param {number} opts.maxLen   - Maximum snake length in cells
   * @param {number} opts.attempts - Max generation attempts (default 400)
   */
  generate({ N, count, minLen, maxLen, attempts = 400 } = {}) {
    const DIRS = LevelGenerator.DIRS;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const occupied = new Set();
      const snakes   = [];
      let ok = true;

      for (let si = 0; si < count; si++) {
        // Pick a random free starting cell
        const free = [];
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++)
            if (!occupied.has(`${x},${y}`)) free.push({ x, y });
        if (free.length === 0) { ok = false; break; }
        const start = free[this._randInt(free.length)];
        const len   = minLen + this._randInt(maxLen - minLen + 1);
        const body  = this._buildPath(start.x, start.y, len, occupied, N);
        if (body.length < 3) { ok = false; break; }

        // Pick a valid direction (not backward, not creating head-on)
        const validDirs = this._shuffle([...DIRS]).filter(d => !this._isBackward(body, d));
        if (validDirs.length === 0) { ok = false; break; }

        let chosenDir = null;
        for (const d of validDirs) {
          if (!this._facingEachOther([...snakes, { body, dir: d }])) {
            chosenDir = d; break;
          }
        }
        if (!chosenDir) chosenDir = validDirs[0]; // fallback — solver will reject if unsolvable

        for (const c of body) occupied.add(`${c.x},${c.y}`);
        snakes.push({ body, dir: chosenDir });
      }
      if (!ok || snakes.length < count) continue;

      // Greedy solvability check
      const occ = new Set();
      for (const s of snakes) for (const c of s.body) occ.add(`${c.x},${c.y}`);
      const remaining  = new Set(snakes.map((_, i) => i));
      const solOrder   = [];
      let solvable = true;

      for (let round = 0; round < count; round++) {
        let found = false;
        for (const i of remaining) {
          const s   = snakes[i];
          const tmp = new Set(occ);
          for (const c of s.body) tmp.delete(`${c.x},${c.y}`);
          if (this._canExit(s.body, s.dir, tmp, N)) {
            solOrder.push(i);
            remaining.delete(i);
            for (const c of s.body) occ.delete(`${c.x},${c.y}`);
            found = true; break;
          }
        }
        if (!found) { solvable = false; break; }
      }
      if (!solvable) continue;
      if (this._facingEachOther(snakes)) continue;

      return {
        size:     N,
        solution: solOrder,
        snakes:   snakes.map(s => ({
          cells: s.body.map(c => ({ x: c.x, y: c.y })),
          dir:   s.dir,
        })),
      };
    }
    return null; // generation failed
  }
}
