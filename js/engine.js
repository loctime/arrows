/**
 * engine.js — ARROWZ · Game Engine
 *
 * Responsibilities
 * ─────────────────────────────────────────────────────
 *  • Grid state management
 *  • Snake activation & arc-length animation
 *  • Collision detection
 *  • Canvas rendering (grid, snakes, particles, arrows)
 *  • RAF loop
 *
 * Dependencies (must be loaded before this file)
 *  • audio.js   → SFX
 *  • levels.js  → LEVELS, COLS (optional — engine accepts any level object)
 *
 * Public API  (accessed via the global `Engine` object)
 * ─────────────────────────────────────────────────────
 *  Engine.loadLevel(levelIndex)
 *  Engine.restart()
 *  Engine.hint()
 *  Engine.on(event, callback)   — event bus: 'exit'|'collision'|'win'|'lose'|'hud'
 *
 * Extending for a new game
 * ─────────────────────────────────────────────────────
 *  1. Pass a custom level object to Engine.loadLevel()
 *  2. Override the draw* functions or inject a custom renderer via Engine.setRenderer()
 *  3. Listen to events via Engine.on() to drive your own UI layer
 */

const Engine = (() => {

  // ── Constants ──────────────────────────────────────
  const PAD  = 10;
  const SNAKE_SPEED_FACTOR = 5;   // cells-per-second multiplier (× CS)
  const PARTICLE_COUNT     = 22;
  const PARTICLE_DECAY     = 0.04;

  /** Direction vectors */
  const DV = {
    U: { dx:  0, dy: -1 },
    D: { dx:  0, dy:  1 },
    L: { dx: -1, dy:  0 },
    R: { dx:  1, dy:  0 },
  };

  // ── Canvas & context ──────────────────────────────
  const canvas = document.getElementById('c');
  const ctx    = canvas.getContext('2d');

  // ── State ─────────────────────────────────────────
  let CS       = 44;   // cell size in pixels
  let N        = 8;    // grid dimension
  let level    = 0;
  let lives    = 3;
  let score    = 0;
  let mistakes = 0;
  let hintId   = -1;

  let grid      = [];   // grid[y][x] = snake id | null
  let snakes    = [];
  let moving    = [];   // snakes currently animating
  let particles = [];
  let rafId     = null;
  let lastTs    = null;

  // ── Event bus ─────────────────────────────────────
  const _listeners = {};

  function _emit(event, data) {
    (_listeners[event] || []).forEach(cb => cb(data));
  }

  // ── Helpers ───────────────────────────────────────

  /** Grid cell center → canvas pixel */
  const toPx = g => PAD + g * CS + CS / 2;

  function mkGrid(n) {
    return Array.from({ length: n }, () => Array(n).fill(null));
  }

  function placeSnake(s) {
    for (const c of s.body)
      if (c.x >= 0 && c.x < N && c.y >= 0 && c.y < N)
        grid[c.y][c.x] = s.id;
  }

  function freeSnake(s) {
    for (const c of s.body)
      if (grid[c.y]?.[c.x] === s.id) grid[c.y][c.x] = null;
  }

  function setCanvasSize(n) {
    N = n;
    const avail = Math.min(window.innerWidth - 16, window.innerHeight - 148, 600);
    CS = Math.floor((avail - PAD * 2) / n);
    const tot = CS * n + PAD * 2;
    canvas.width = tot;
    canvas.height = tot;
  }

  // ── Polyline utilities ────────────────────────────

  /**
   * Convert grid-cell array to a pixel-space polyline with arc-lengths.
   * Returns { pts: [{x,y}], cum: [distances], total: number }
   */
  function buildPolyline(cells) {
    const pts = cells.map(c => ({ x: toPx(c.x), y: toPx(c.y) }));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const ddx = pts[i].x - pts[i-1].x;
      const ddy = pts[i].y - pts[i-1].y;
      cum.push(cum[i-1] + Math.sqrt(ddx*ddx + ddy*ddy));
    }
    return { pts, cum, total: cum[cum.length - 1] };
  }

  /** Interpolate a point at arc-length `d` along poly */
  function sampleAt(poly, d) {
    d = Math.max(0, Math.min(d, poly.total));
    for (let i = 1; i < poly.pts.length; i++) {
      if (poly.cum[i] >= d || i === poly.pts.length - 1) {
        const seg = poly.cum[i] - poly.cum[i-1];
        const t   = seg > 0 ? (d - poly.cum[i-1]) / seg : 0;
        const a   = poly.pts[i-1], b = poly.pts[i];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return poly.pts[poly.pts.length - 1];
  }

  /** Return a sub-array of pixel points for poly[d0..d1] */
  function slicePoly(poly, d0, d1) {
    if (d1 <= d0) return [];
    const out = [sampleAt(poly, d0)];
    for (let i = 0; i < poly.pts.length; i++) {
      if (poly.cum[i] > d0 && poly.cum[i] < d1)
        out.push({ x: poly.pts[i].x, y: poly.pts[i].y });
    }
    out.push(sampleAt(poly, d1));
    return out;
  }

  // ── Activation ────────────────────────────────────

  function activate(id) {
    const s = snakes[id];
    if (!s || s.state !== 'idle') return;

    // Guard: block backward movement
    if (s.body.length >= 2) {
      const head = s.body[s.body.length - 1];
      const prev = s.body[s.body.length - 2];
      const { dx, dy } = DV[s.dir];
      if (dx === -(head.x - prev.x) && dy === -(head.y - prev.y)) return;
    }

    SFX.tap();
    const { dx, dy } = DV[s.dir];
    const head = s.body[s.body.length - 1];

    // Extend path forward until fully off-board
    const extended = s.body.map(c => ({ ...c }));
    let ex = head.x, ey = head.y;
    for (let i = 0; i < s.body.length + N + 2; i++) {
      ex += dx; ey += dy;
      extended.push({ x: ex, y: ey });
    }

    const poly    = buildPolyline(extended);
    const bodyLen = (s.body.length - 1) * CS;

    // Detect first collision along path
    let collideAt = null;
    let cx = head.x + dx, cy = head.y + dy, steps = 1;
    while (cx >= 0 && cx < N && cy >= 0 && cy < N && steps <= N * 2) {
      const occ = grid[cy]?.[cx];
      if (occ !== null && occ !== s.id) { collideAt = steps * CS; break; }
      cx += dx; cy += dy; steps++;
    }

    freeSnake(s);
    s.state = 'moving';
    s.anim  = {
      poly,
      bodyLen,
      headTravel: 0,
      speed: CS * SNAKE_SPEED_FACTOR,
      collideAt,
      dir: { x: dx, y: dy },
    };

    hintId = -1;
    moving.push(s);
    if (!rafId) { lastTs = null; rafId = requestAnimationFrame(_loop); }
  }

  // ── Animation loop ────────────────────────────────

  function _loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    for (let i = moving.length - 1; i >= 0; i--) {
      const s = moving[i];
      const a = s.anim;
      a.headTravel += a.speed * dt;

      if (a.collideAt !== null && a.headTravel >= a.collideAt) {
        a.headTravel = a.collideAt;
        moving.splice(i, 1);
        _draw();
        _doCollision(s);
        continue;
      }

      const tailD = a.headTravel;
      if (tailD >= a.poly.total - a.bodyLen) {
        moving.splice(i, 1);
        _draw();
        _doExit(s);
        continue;
      }
    }

    _draw();

    if (moving.length > 0 || particles.length > 0)
      rafId = requestAnimationFrame(_loop);
    else
      rafId = null;
  }

  function _doExit(s) {
    s.state = 'done';
    score += 100 + s.body.length * 5;
    SFX.exit();
    _floatPop(toPx(s.body[s.body.length-1].x), toPx(s.body[s.body.length-1].y), '+100', s.color);
    _emitHUD();
    _draw();
    _emit('exit', { snake: s, score, lives });
    _checkBoard();
  }

  function _doCollision(s) {
    s.state = 'done';
    lives = Math.max(0, lives - 1);
    mistakes++;
    const headPt = sampleAt(s.anim.poly, s.anim.bodyLen + s.anim.headTravel);
    _spawnParticles(headPt.x, headPt.y, s.color);
    SFX.boom();
    _floatPop(headPt.x, headPt.y, 'BOOM!', '#ff2d6b');
    _emitHUD();
    _draw();
    _emit('collision', { snake: s, score, lives });
    if (!rafId && particles.length > 0) rafId = requestAnimationFrame(_loop);
    _checkBoard();
  }

  function _checkBoard() {
    const idle    = snakes.filter(s => s.state === 'idle').length;
    const inMotion = snakes.filter(s => s.state === 'moving').length;
    if (idle === 0 && inMotion === 0) {
      setTimeout(() => { SFX.win(); _emit('win', { score, mistakes, level }); }, 350);
    } else if (lives <= 0 && inMotion === 0) {
      setTimeout(() => { SFX.lose(); _emit('lose', { score, level }); }, 350);
    }
  }

  function _emitHUD() {
    _emit('hud', { level, lives, score, mistakes, total: snakes.length,
      done: snakes.filter(s => s.state === 'done').length });
  }

  // ── Rendering ─────────────────────────────────────

  function _draw() {
    ctx.fillStyle = '#07071a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dot grid
    ctx.fillStyle = '#14143a';
    for (let r = 0; r <= N; r++)
      for (let c = 0; c <= N; c++) {
        ctx.beginPath();
        ctx.arc(PAD + c*CS, PAD + r*CS, 1.2, 0, Math.PI*2);
        ctx.fill();
      }

    // Cell backgrounds
    ctx.fillStyle = 'rgba(255,255,255,.007)';
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        ctx.beginPath();
        ctx.roundRect(PAD + c*CS + 1, PAD + r*CS + 1, CS - 2, CS - 2, 3);
        ctx.fill();
      }

    const ordered = [...snakes].sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1));
    for (const s of ordered) _drawSnake(s);
    _drawParticles();
  }

  function _drawSnake(s) {
    if (s.state === 'done') return;

    const col    = s.color;
    const scale  = s.scale ?? 1;
    const layer  = s.layer ?? 1;
    const lw     = Math.max(3, CS * 0.16 * scale);
    const hl     = s.id === hintId;
    const dv     = DV[s.dir];
    const dirVec = { x: dv.dx, y: dv.dy };
    const alphaMul = layer === 0 ? 0.65 : layer === 1 ? 0.9 : 1;
    const glowMul  = layer === 0 ? 0.6 : 1;

    let allPts, arrowDir;

    if (s.state === 'idle') {
      const poly = buildPolyline(s.body);
      if (!poly.pts?.length) return;
      allPts   = poly.pts;
      arrowDir = dirVec;
    } else {
      const a     = s.anim;
      const tailD = a.headTravel;
      const headD = a.bodyLen + a.headTravel;
      if (tailD >= headD) return;
      allPts = slicePoly(a.poly, tailD, headD);
      if (!allPts?.length) return;
      arrowDir = a.dir;
    }

    // Body line
    if (allPts.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = col;
      ctx.lineWidth = lw + 8; ctx.shadowColor = col;
      ctx.shadowBlur = (hl ? 28 : 14) * glowMul; ctx.globalAlpha = (hl ? 0.4 : 0.18) * alphaMul;
      _strokePts(allPts);
      ctx.lineWidth = lw; ctx.shadowBlur = (hl ? 18 : 7) * glowMul; ctx.globalAlpha = 1 * alphaMul;
      _strokePts(allPts);
      ctx.shadowBlur = 0; ctx.fillStyle = col; ctx.globalAlpha = 0.22 * alphaMul;
      for (let i = 0; i < allPts.length; i += 2) {
        const r = Math.max(0.1, lw * 0.4);
        ctx.beginPath(); ctx.arc(allPts[i].x, allPts[i].y, r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    const headPt = allPts[allPts.length - 1];
    _drawArrow(headPt.x, headPt.y, arrowDir, col, lw, hl, scale, alphaMul, glowMul);
  }

  function _drawArrow(cx, cy, dir, col, lw, hl, scale = 1, alphaMul = 1, glowMul = 1) {
    const adx      = dir.x, ady = dir.y;
    const perp     = { x: -ady, y: adx };
    const neckLen  = CS * 0.32 * scale;
    const wingHalf = lw * 1.6;
    const tipExtra = CS * 0.32 * scale;
    const neckEndX = cx + adx * neckLen, neckEndY = cy + ady * neckLen;
    const tipX     = neckEndX + adx * tipExtra, tipY = neckEndY + ady * tipExtra;

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = col;
    // Neck glow
    ctx.strokeStyle = col; ctx.lineWidth = lw + 8;
    ctx.shadowBlur = (hl ? 24 : 12) * glowMul; ctx.globalAlpha = (hl ? 0.4 : 0.18) * alphaMul;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(neckEndX, neckEndY); ctx.stroke();
    // Neck
    ctx.lineWidth = lw; ctx.shadowBlur = (hl ? 16 : 8) * glowMul; ctx.globalAlpha = 1 * alphaMul;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(neckEndX, neckEndY); ctx.stroke();
    // Triangle (with outline for clarity)
    const tri = () => {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(neckEndX + perp.x * wingHalf, neckEndY + perp.y * wingHalf);
      ctx.lineTo(neckEndX - perp.x * wingHalf, neckEndY - perp.y * wingHalf);
      ctx.closePath();
    };
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, lw * 0.45);
    ctx.strokeStyle = 'rgba(6,6,18,0.85)';
    ctx.globalAlpha = 0.9 * alphaMul;
    tri(); ctx.stroke();
    ctx.fillStyle = col; ctx.shadowBlur = (hl ? 20 : 10) * glowMul; ctx.globalAlpha = 1 * alphaMul;
    tri(); ctx.fill();
    ctx.restore();
  }

  function _strokePts(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  // ── Particles ─────────────────────────────────────

  function _spawnParticles(x, y, col) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a  = (i / PARTICLE_COUNT) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 1, col, r: 2 + Math.random()*3 });
    }
    if (!rafId) rafId = requestAnimationFrame(_loop);
  }

  function _drawParticles() {
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.9;  p.vy *= 0.9;
      p.life -= PARTICLE_DECAY;
      const r = Math.max(0, p.r * p.life);
      if (r < 0.01) { p.life = 0; continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.shadowColor = p.col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    particles = particles.filter(p => p.life > 0.01);
  }

  // ── Float popup ───────────────────────────────────

  function _floatPop(x, y, text, col) {
    const r  = canvas.getBoundingClientRect();
    const el = document.createElement('div');
    el.className    = 'fpop';
    el.textContent  = text;
    el.style.color  = col;
    el.style.left   = (r.left + x - 24) + 'px';
    el.style.top    = (r.top  + y - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 820);
  }

  // ── Input ─────────────────────────────────────────

  function _distPointToSeg(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t, cy = ay + aby * t;
    const dx = px - cx, dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function _minDistToPolyline(pts, px, py) {
    if (!pts || pts.length < 2) return Infinity;
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = _distPointToSeg(px, py, a.x, a.y, b.x, b.y);
      if (d < best) best = d;
    }
    return best;
  }

  function _onTap(ex, ey) {
    // Require proximity to a snake line to activate (tighter hitbox).
    let bestId = null;
    let bestDist = Infinity;

    for (const s of snakes) {
      if (s.state !== 'idle') continue;
      const poly = buildPolyline(s.body);
      const d = _minDistToPolyline(poly.pts, ex, ey);
      const scale = s.scale ?? 1;
      const hit = Math.max(4, CS * 0.12 * scale);
      if (d <= hit && d < bestDist) {
        bestDist = d;
        bestId = s.id;
      }
    }

    if (bestId !== null) activate(bestId);
  }

  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    _onTap(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0], r = canvas.getBoundingClientRect();
    _onTap(t.clientX - r.left, t.clientY - r.top);
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (snakes.length) _reloadCurrentLevel();
  });

  // ── Level loading ─────────────────────────────────

  const SNAKE_COLORS = [
    '#00f5c8','#ff2d6b','#ffc940','#a78bfa',
    '#38bdf8','#fb923c','#4ade80','#f472b6',
    '#e879f9','#34d399','#22d3ee','#fde047',
    '#f97316','#60a5fa','#a3e635','#f43f5e',
    '#c084fc','#14b8a6',
  ];

  let _currentLevelData = null;

  function _reloadCurrentLevel() {
    if (_currentLevelData) _loadLevelData(_currentLevelData, level);
  }

  function _loadLevelData(lv, idx) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    moving.length = 0; particles.length = 0; hintId = -1; lastTs = null;

    _currentLevelData = lv;
    level    = idx;
    lives    = 3;
    score    = 0;
    mistakes = 0;

    setCanvasSize(lv.size);
    grid = mkGrid(lv.size);

    snakes = lv.snakes.map((s, i) => {
      const body = s.cells.map(c => ({ ...c }));

      // Sanitize: fix backward dirs
      let dir = s.dir;
      if (body.length >= 2) {
        const head = body[body.length - 1];
        const prev = body[body.length - 2];
        const { dx, dy } = DV[dir];
        if (dx === -(head.x - prev.x) && dy === -(head.y - prev.y)) {
          dir = ['U','D','L','R'].find(d => {
            const v = DV[d];
            return !(v.dx === -(head.x-prev.x) && v.dy === -(head.y-prev.y));
          }) || dir;
        }
      }

      const sn = {
        id: i,
        color: SNAKE_COLORS[i % SNAKE_COLORS.length],
        dir,
        body,
        scale: s.scale ?? 1,
        layer: s.layer ?? 1,
        state: 'idle',
        anim: null
      };
      placeSnake(sn);
      return sn;
    });

    _emitHUD();
    _draw();
  }

  // ── Public API ────────────────────────────────────

  return {
    /**
     * Load a level by index from the global LEVELS array,
     * or pass a raw level object as the second argument.
     *
     * @param {number}  idx       - Level index
     * @param {object}  [lvData]  - Optional: custom level data object
     */
    loadLevel(idx, lvData) {
      const data = lvData ?? LEVELS[idx % LEVELS.length];
      _loadLevelData(data, idx);
      SFX.start();
    },

    /** Reload the current level from scratch */
    restart() {
      if (_currentLevelData) _loadLevelData(_currentLevelData, level);
      SFX.start();
    },

    /**
     * Highlight the next snake to move according to the solution order.
     * Requires the level data to include a `solution` array.
     */
    hint() {
      if (!_currentLevelData?.solution) return;
      const target = _currentLevelData.solution.find(i => snakes[i]?.state === 'idle');
      if (target === undefined) return;
      hintId = target;
      _draw();
      setTimeout(() => { hintId = -1; _draw(); }, 2500);
    },

    /**
     * Subscribe to an engine event.
     *
     * Events:
     *   'hud'       — { level, lives, score, mistakes, total, done }
     *   'exit'      — { snake, score, lives }
     *   'collision' — { snake, score, lives }
     *   'win'       — { score, mistakes, level }
     *   'lose'      — { score, level }
     *
     * @param {string}   event
     * @param {Function} callback
     */
    on(event, callback) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(callback);
    },

    /** Remove a previously registered listener */
    off(event, callback) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(cb => cb !== callback);
    },

    /** Read-only snapshot of current state (useful for custom UIs) */
    get state() {
      return { level, lives, score, mistakes };
    },
  };

})();
