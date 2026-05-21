/**
 * Vintage Airmail — script.js
 * "A letter from across the distance."
 *
 * Architecture:
 *  - Same dual mode as letter-project: Online (Worker KV) + Standalone (config.js)
 *  - Same Worker URL & data schema
 *  - State machine: loading → envelope → letter
 *  - Swipe-to-tear envelope mechanic
 *  - Typewriter effect with mechanical keyboard SFX
 *  - Polaroid secret memory modal
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */
const WORKER_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

// Typewriter speed (ms per character)
const TW_CHAR_DELAY = 42;
// Pause between paragraphs (ms)
const TW_PARA_PAUSE = 800;

/* ════════════════════════════════════════════════════════════
   STATE MACHINE
   ════════════════════════════════════════════════════════════ */
function showState(stateId) {
  ['loading', 'envelope', 'letter', 'maintenance'].forEach(id => {
    const el = document.getElementById(`state-${id}`);
    if (!el) return;
    el.classList.toggle('hidden', id !== stateId);
  });
}

/* ════════════════════════════════════════════════════════════
   INIT — ENTRY POINT
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  showState('loading');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('to') || params.get('token') || params.get('id') || _getTokenFromPath();

  let config = null;

  // ── 1. Online Mode (fetch from KV) ──
  if (token) {
    try {
      const cacheBuster = `&_cb=${Date.now()}`;
      const res = await fetch(`${WORKER_URL}/get-config?id=${encodeURIComponent(token)}${cacheBuster}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        config = _normalizeConfig(await res.json());
      }
    } catch (err) {
      console.warn('[Airmail] Database fetch failed, falling back...', err.message);
    }
  }

  // ── 2. Standalone Mode (config.js) ──
  if (!config) {
    if (window.STANDALONE_CONFIG && Object.keys(window.STANDALONE_CONFIG).length > 0) {
      config = _normalizeConfig(window.STANDALONE_CONFIG);
    }
  }

  // ── 3. Demo Mode ──
  if (!config) {
    config = _demoConfig();
  }

  // ── Maintenance Mode ──
  if (config.is_active === false) {
    showState('maintenance');
    return;
  }

  // Apply colour palette before rendering
  _applyAirmailTheme(config.airmailTheme || 'airmail-parchment');

  // Render static skeleton
  _renderLetterSkeleton(config);

  // Init music player
  const isPreviewOnly = params.get('previewOnly') === '1';
  if (!isPreviewOnly) {
    if (config.playlist && config.playlist.length > 0) {
      const audio = _audioEl();
      audio.src = config.playlist[0].src || config.playlist[0].url || '';
      audio.load();
    }
    _initMusicPlayer(config);
  }

  _initDownloadButton(config);

  // Set envelope recipient name
  const envName = document.getElementById('env-to-name');
  if (envName) {
    let displayName = (config.recipientName || config.to || '')
      .replace(/^(Dearest|Dear|To)[:,\s]+/i, '')
      .replace(/[,;:.]\\s*$/, '');
    envName.textContent = displayName.trim() || 'Kamu';
  }

  // Set postmark date
  const postmarkDate = document.getElementById('postmark-date');
  if (postmarkDate && config.date) {
    postmarkDate.textContent = config.date.toUpperCase();
  }

  // ── Handle openMemory shortcut ──
  const isOpenMemory = params.get('openMemory') === '1';
  if (isOpenMemory) {
    config._forceSkipTW = true;
    showState('letter');
    const paper = document.getElementById('letter-paper');
    if (paper) {
      requestAnimationFrame(() => requestAnimationFrame(() => paper.classList.add('is-revealing')));
    }
    await _delay(400);
    await _typewriteLetter(config);
    return;
  }

  // ── Show Envelope ──
  showState('envelope');
  await _waitForEnvelopeOpen(config);

  // Transition to letter
  showState('letter');

  // Start background planes
  _startBackgroundPlanes(config.airmailTheme || 'airmail-parchment');

  // Trigger paper rise animation
  const paper = document.getElementById('letter-paper');
  if (paper) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        paper.classList.add('is-revealing');
      });
    });
  }

  // Wait for paper to finish rising (2.0s transition) then start typewriter
  await _delay(2200);
  await _typewriteLetter(config);
}

/* ════════════════════════════════════════════════════════════
   AIRMAIL COLOUR THEME
   ════════════════════════════════════════════════════════════ */
function _applyAirmailTheme(theme) {
  const validThemes = ['airmail-parchment', 'airmail-lilac', 'airmail-sage', 'airmail-rose', 'airmail-midnight', 'airmail-bordeaux'];
  const t = validThemes.includes(theme) ? theme : 'airmail-parchment';
  if (t === 'airmail-parchment') {
    // Default — remove attribute so :root CSS applies
    document.body.removeAttribute('data-airmail-theme');
  } else {
    document.body.setAttribute('data-airmail-theme', t);
  }
}

/* ════════════════════════════════════════════════════════════
   URL TOKEN PARSING
   ════════════════════════════════════════════════════════════ */
function _getTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const reserved = ['index.html', 'studio', 'generator', 'admin', 'letter', 'themes', 'airmail'];
  if (reserved.includes(last.toLowerCase())) return null;
  if (last.includes('.')) return null;
  return last;
}

/* ════════════════════════════════════════════════════════════
   CONFIG NORMALIZATION (same schema as letter-project)
   ════════════════════════════════════════════════════════════ */
function _normalizeConfig(raw) {
  return {
    recipientName: raw.recipientName || raw.to || raw.recipient || '',
    to: raw.to || raw.recipient || 'Dear,',
    title: raw.title || '',
    from: raw.from || raw.sender || '',
    letter_body: raw.letter_body || raw.message || '',
    date: raw.date || '',
    playlist: Array.isArray(raw.playlist) ? raw.playlist : [],
    theme: raw.theme || 'blush-cream',
    show_watermark: raw.show_watermark !== false,
    is_active: raw.is_active !== false,
    salutation: raw.letterTo || raw.salutation || raw.to || 'Dear,',
    fontFamily: raw.fontFamily || 'caveat',
    fontSize: raw.fontSize || 'size-medium',
    login_password: raw.login_password || '',
    login_hint: raw.login_hint || '',
    isPremium: raw.isPremium === true || raw.is_premium === true,
    secretMediaList: _normalizeMediaList(raw),
    paperTexture: raw.paperTexture || '',
    airmailTheme: raw.airmailTheme || 'airmail-parchment',
  };
}

function _normalizeMediaList(raw) {
  if (Array.isArray(raw.secretMediaList) && raw.secretMediaList.length) {
    return raw.secretMediaList.slice(0, 10).filter(m => m && m.url);
  }
  if (raw.secretMedia || raw.secret_media) {
    return [{ url: raw.secretMedia || raw.secret_media, caption: raw.secretCaption || raw.secret_caption || '' }];
  }
  return [];
}

function _demoConfig() {
  return _normalizeConfig({
    to: 'Dear Traveler,',
    from: 'Someone Far Away',
    letter_body: 'This is a placeholder letter sent across the distance.\n\nOpen via a link with a valid token to see real content.\n\nThis template holds words that travel — the kind that cross oceans and arrive right on time.',
    date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(),
    playlist: [],
    theme: 'blush-cream',
    show_watermark: true,
    secretMediaList: [
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80', caption: 'Us. Always. ♡' },
    ],
  });
}

/* ════════════════════════════════════════════════════════════
   TYPEWRITER SOUND ENGINE
   ════════════════════════════════════════════════════════════ */
let _typeAudioCtx;

function _playTypeSound() {
  try {
    if (!_typeAudioCtx) {
      _typeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_typeAudioCtx.state === 'suspended') {
      _typeAudioCtx.resume().catch(() => {});
    }

    const t = _typeAudioCtx.currentTime;
    const osc = _typeAudioCtx.createOscillator();
    const gain = _typeAudioCtx.createGain();
    const filter = _typeAudioCtx.createBiquadFilter();

    // Mechanical typewriter clack
    osc.type = 'square';
    osc.frequency.setValueAtTime(80 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.03);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(_typeAudioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  } catch (e) { /* silent */ }
}

function _playTearSound() {
  try {
    if (!_typeAudioCtx) {
      _typeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_typeAudioCtx.state === 'suspended') {
      _typeAudioCtx.resume().catch(() => {});
    }

    const t = _typeAudioCtx.currentTime;
    // White noise burst (paper tear)
    const bufferSize = _typeAudioCtx.sampleRate * 0.3;
    const buffer = _typeAudioCtx.createBuffer(1, bufferSize, _typeAudioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = _typeAudioCtx.createBufferSource();
    noise.buffer = buffer;

    const gain = _typeAudioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    const filter = _typeAudioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(_typeAudioCtx.destination);
    noise.start(t);
    noise.stop(t + 0.3);
  } catch (e) { /* silent */ }
}

/* ════════════════════════════════════════════════════════════
   ENVELOPE — CLICK TO OPEN (Flap + Letter Pop-Up)
   ════════════════════════════════════════════════════════════ */
function _waitForEnvelopeOpen(config) {
  return new Promise(resolve => {
    const envelope = document.getElementById('airmail-envelope');
    const scene    = document.getElementById('envelope-scene');
    const tapHint  = document.getElementById('tap-hint');
    let opened = false;

    async function attemptOpen() {
      if (opened) return;

      // Check password first
      if (config.login_password && config.login_password.trim() !== '') {
        await _handleAuthentication(config);
      }

      opened = true;

      // Hide tap hint
      if (tapHint) tapHint.style.opacity = '0';

      // Play paper tear sound
      _playTearSound();

      // Start music
      _loadTrack(0, true);

      // Animate envelope flap open
      if (envelope) envelope.classList.add('is-opening');

      // After flap (~550ms), launch planes + fade scene simultaneously
      setTimeout(async () => {
        if (scene) scene.classList.add('is-exit');

        // Paper planes burst — resolves once safe to show letter behind them
        await _playPaperPlaneTransition(config.airmailTheme || 'airmail-parchment');

        resolve();
      }, 550);
    }

    if (envelope) {
      envelope.addEventListener('click', () => attemptOpen());
      envelope.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') attemptOpen();
      });
      envelope.addEventListener('touchend', (e) => {
        e.preventDefault();
        attemptOpen();
      }, { passive: false });
    }
  });
}


/* ════════════════════════════════════════════════════════════
   PAPER PLANE TRANSITION  (canvas-based, 60 fps)
   ════════════════════════════════════════════════════════════ */
async function _playPaperPlaneTransition(airmailTheme) {

  /* ── 1. Theme palette ─────────────────────────────────── */
  const PALETTES = {
    'airmail-parchment': { plane: '#fdf6e3', ink: '#5a3e28', s1: '#c0392b', s2: '#2c3e80' },
    'airmail-lilac':     { plane: '#f7f0fc', ink: '#4a3060', s1: '#9b59b6', s2: '#5b4a8a' },
    'airmail-sage':      { plane: '#f3faf5', ink: '#2a4a35', s1: '#3a7d54', s2: '#2a5c44' },
    'airmail-rose':      { plane: '#fdf0f3', ink: '#5a2535', s1: '#c04060', s2: '#8a3050' },
    'airmail-midnight':  { plane: '#1e293b', ink: '#8da4c4', s1: '#e11d48', s2: '#3b82f6' },
    'airmail-bordeaux':  { plane: '#2d0a14', ink: '#d4a090', s1: '#e11d48', s2: '#c084fc' }
  };
  const C = PALETTES[airmailTheme] || PALETTES['airmail-parchment'];

  /* ── 2. Full-screen canvas overlay ───────────────────── */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;pointer-events:none;';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.hypot(cx, cy);

  /* ── 3. Draw one paper plane (dart silhouette) ────────
     Origin = centre of plane body, pointing RIGHT (angle=0).
     Caller rotates ctx before calling this.                */
  function drawPlaneMesh(alpha) {
    // Upper wing — swept-back, lancip, elegant
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(-20, -28);
    ctx.lineTo(-8, -5);
    ctx.lineTo(10, -1);
    ctx.closePath();
    ctx.fillStyle   = C.plane;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 1.1;
    ctx.globalAlpha = alpha;
    ctx.fill(); ctx.stroke();

    // Lower wing — mirror
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(-20, 28);
    ctx.lineTo(-8, 5);
    ctx.lineTo(10, 1);
    ctx.closePath();
    ctx.fillStyle   = C.plane;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 1.1;
    ctx.globalAlpha = alpha;
    ctx.fill(); ctx.stroke();

    // Belly shadow — tipis, elegan
    ctx.beginPath();
    ctx.moveTo(-20, -28);
    ctx.lineTo(-20, 28);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fillStyle   = C.ink;
    ctx.globalAlpha = alpha * 0.38;
    ctx.fill();

    // Centre crease — sangat tipis
    ctx.beginPath();
    ctx.moveTo(44, 0); ctx.lineTo(-8, 0);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 0.8;
    ctx.globalAlpha = alpha * 0.5;
    ctx.stroke();

    // Primary stripe — satu, subtle
    ctx.beginPath();
    ctx.moveTo(28, -4); ctx.lineTo(-12, -20);
    ctx.strokeStyle = C.s1;
    ctx.lineWidth   = 1.8;
    ctx.globalAlpha = alpha * 0.7;
    ctx.stroke();

    // Hairline stripe kedua
    ctx.beginPath();
    ctx.moveTo(28, -7); ctx.lineTo(-12, -23);
    ctx.strokeStyle = C.s2;
    ctx.lineWidth   = 1.0;
    ctx.globalAlpha = alpha * 0.45;
    ctx.stroke();
  }

  /* ── 4. Plane entity ──────────────────────────────────── */
  class Plane {
    constructor(idx, total) {
      // Even spread around full circle + small jitter
      this.angle = (idx / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      this.x     = cx;
      this.y     = cy;
      // Slower, more graceful speed — 2.5 to 4.5 px/frame
      this.speed = 2.5 + Math.random() * 2.0;
      // Slightly stronger arc for more visible curves
      this.turn  = (Math.random() - 0.5) * 0.018;
      // Scale bigger: planes are 1.4x larger than before
      this.scale = 0;
      this.targetScale = 1.2 + Math.random() * 0.3;
      this.alpha = 1;
      this.life  = 0;
      // Wider cascade stagger: planes launch over ~1.5s total
      this.delay = idx * 7 + Math.floor(Math.random() * 10);
      this.trail = []; // past positions
    }

    update() {
      if (this.delay-- > 0) return;
      this.life++;
      // Scale in smoothly (not pop — gradual grow)
      this.scale = Math.min(this.targetScale, this.scale + 0.08);
      // Fly with gentle arc
      this.angle += this.turn;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      // Record longer trail (38 points for sweeping dashes)
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 38) this.trail.pop();
      // Start fading only when very close to edge or if life is too long
      if (this.life > 160) {
        this.alpha -= 0.03;
      } else {
        const d = Math.hypot(this.x - cx, this.y - cy);
        if (d > maxR * 0.70) {
          this.alpha = Math.max(0, 1 - (d - maxR * 0.70) / (maxR * 0.30));
        }
      }
    }

    draw() {
      if (this.life <= 0) return;
      // Elegant, solid wind vapor trail instead of dashed dots
      if (this.trail.length > 2) {
        ctx.save();
        ctx.strokeStyle = C.plane; // Vapor trail color
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth   = 2.0;
        ctx.globalAlpha = this.alpha * 0.45;
        ctx.beginPath();
        this.trail.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.restore();
      }
      // Plane body — rotated to face direction of travel
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(this.scale, this.scale);
      drawPlaneMesh(this.alpha);
      ctx.restore();
    }

    get done() {
      return this.life > 0 &&
        (this.x < -100 || this.x > W + 100 || this.y < -100 || this.y > H + 100 || this.alpha <= 0);
    }
  }

  /* ── 5. Expanding cloud puff / paper dust ─────────────── */
  class CloudPuff {
    constructor(delay = 0) {
      this.del = delay;
      // Soft circular cloud blobs
      this.blobs = Array.from({length: 12}, () => ({
        a: Math.random() * Math.PI * 2,
        d: 10 + Math.random() * 15,
        v: 4 + Math.random() * 7,
        s: 15 + Math.random() * 25, // blob size
        alpha: 0.6 + Math.random() * 0.3
      }));
      // Dynamic wind fibers shooting outwards
      this.fibers = Array.from({length: 8}, () => ({
        a: Math.random() * Math.PI * 2,
        d: 20 + Math.random() * 20,
        v: 8 + Math.random() * 6,
        len: 15 + Math.random() * 20,
        alpha: 0.8
      }));
    }
    update() {
      if (this.del-- > 0) return;
      this.blobs.forEach(b => {
        b.d += b.v;
        b.v *= 0.90; // drag
        b.s += 0.8;  // clouds expand
        b.alpha *= 0.88; // fade out
      });
      this.fibers.forEach(f => {
        f.d += f.v;
        f.v *= 0.92; // drag
        f.len *= 0.85; // shrink
        f.alpha *= 0.86; // fade out
      });
    }
    draw() {
      if (this.del > 0) return;
      ctx.save();
      
      // Draw clouds using paper color
      ctx.fillStyle = C.plane;
      this.blobs.forEach(b => {
        if (b.alpha < 0.01) return;
        ctx.globalAlpha = b.alpha;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(b.a) * b.d, cy + Math.sin(b.a) * b.d, b.s, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw wind fibers
      ctx.strokeStyle = C.plane;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;
      this.fibers.forEach(f => {
        if (f.alpha < 0.01) return;
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        const sx = cx + Math.cos(f.a) * f.d;
        const sy = cy + Math.sin(f.a) * f.d;
        const ex = cx + Math.cos(f.a) * (f.d + f.len);
        const ey = cy + Math.sin(f.a) * (f.d + f.len);
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });

      ctx.restore();
    }
    get done() {
      return this.blobs.every(b => b.alpha < 0.01) && this.fibers.every(f => f.alpha < 0.01);
    }
  }

  /* ── 6. Spawn all entities ─────────────────────────────── */
  const isMobile    = W < 600;
  // More planes for a dramatic sweep
  const PLANE_COUNT = isMobile ? 12 : 18;

  const planes = Array.from({ length: PLANE_COUNT }, (_, i) => new Plane(i, PLANE_COUNT));
  // Staggered cloud puffs for a soft, explosive smoke bloom
  const waves  = [new CloudPuff(0), new CloudPuff(8), new CloudPuff(18)];

  /* ── 7. RAF loop ───────────────────────────────────────── */
  return new Promise(resolveTransition => {
    let frame    = 0;
    let resolved = false;

    function tick() {
      ctx.clearRect(0, 0, W, H);

      waves.forEach(w => { w.update(); w.draw(); });
      planes.forEach(p => { p.update(); p.draw(); });

      frame++;

      // Resolve at ~2500ms (frame 150 @ 60fps) — letter rises AFTER planes
      // have swept across most of the screen, just like Classic Letter flowers
      if (!resolved && frame >= 150) {
        resolved = true;
        resolveTransition();
      }

      const allGone =
        planes.every(p => p.done) &&
        waves.every(w => w.done);

      if (allGone && frame > 200) {
        canvas.remove();
        return;
      }

      requestAnimationFrame(tick);
    }

    tick();
  });
}


/* ════════════════════════════════════════════════════════════
   BACKGROUND PAPER PLANES
   ════════════════════════════════════════════════════════════ */
let _bgPlanesAnimId = null;

function _startBackgroundPlanes(airmailTheme) {
  const bgCanvas = document.getElementById('bg-planes-canvas');
  const fgCanvas = document.getElementById('fg-planes-canvas');
  if (!bgCanvas) return;

  const bgCtx = bgCanvas.getContext('2d');
  const fgCtx = fgCanvas ? fgCanvas.getContext('2d') : null;
  let W = window.innerWidth;
  let H = window.innerHeight;
  
  bgCanvas.width = W; bgCanvas.height = H;
  if (fgCanvas) { fgCanvas.width = W; fgCanvas.height = H; }

  window.addEventListener('resize', () => {
    W = window.innerWidth;
    H = window.innerHeight;
    bgCanvas.width = W; bgCanvas.height = H;
    if (fgCanvas) { fgCanvas.width = W; fgCanvas.height = H; }
  });

  const PALETTES = {
    'airmail-parchment': { plane: '#fdf6e3', ink: '#5a3e28', s1: '#c0392b', s2: '#2c3e80' },
    'airmail-lilac':     { plane: '#f7f0fc', ink: '#4a3060', s1: '#9b59b6', s2: '#5b4a8a' },
    'airmail-sage':      { plane: '#f3faf5', ink: '#2a4a35', s1: '#3a7d54', s2: '#2a5c44' },
    'airmail-rose':      { plane: '#fdf0f3', ink: '#5a2535', s1: '#c04060', s2: '#8a3050' },
    'airmail-midnight':  { plane: '#1e293b', ink: '#8da4c4', s1: '#e11d48', s2: '#3b82f6' },
    'airmail-bordeaux':  { plane: '#2d0a14', ink: '#d4a090', s1: '#e11d48', s2: '#c084fc' }
  };
  const C = PALETTES[airmailTheme] || PALETTES['airmail-parchment'];

  function drawPlaneMesh(ctx, alpha) {
    // Upper wing — swept-back, lancip, elegant
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(-20, -28);
    ctx.lineTo(-8, -5);
    ctx.lineTo(10, -1);
    ctx.closePath();
    ctx.fillStyle   = C.plane;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 1.1;
    ctx.globalAlpha = alpha;
    ctx.fill(); ctx.stroke();

    // Lower wing — mirror
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(-20, 28);
    ctx.lineTo(-8, 5);
    ctx.lineTo(10, 1);
    ctx.closePath();
    ctx.fillStyle   = C.plane;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 1.1;
    ctx.globalAlpha = alpha;
    ctx.fill(); ctx.stroke();

    // Belly shadow — tipis, elegan
    ctx.beginPath();
    ctx.moveTo(-20, -28);
    ctx.lineTo(-20, 28);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fillStyle   = C.ink;
    ctx.globalAlpha = alpha * 0.38;
    ctx.fill();

    // Centre crease — sangat tipis
    ctx.beginPath();
    ctx.moveTo(44, 0); ctx.lineTo(-8, 0);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth   = 0.8;
    ctx.globalAlpha = alpha * 0.5;
    ctx.stroke();

    // Primary stripe — satu, subtle
    ctx.beginPath();
    ctx.moveTo(28, -4); ctx.lineTo(-12, -20);
    ctx.strokeStyle = C.s1;
    ctx.lineWidth   = 1.8;
    ctx.globalAlpha = alpha * 0.7;
    ctx.stroke();

    // Hairline stripe kedua
    ctx.beginPath();
    ctx.moveTo(28, -7); ctx.lineTo(-12, -23);
    ctx.strokeStyle = C.s2;
    ctx.lineWidth   = 1.0;
    ctx.globalAlpha = alpha * 0.45;
    ctx.stroke();
  }

  class BgPlane {
    constructor(isForeground) {
      this.isForeground = isForeground;
      this.reset(true);
    }
    reset(initial = false) {
      this.scale = 0.35 + Math.random() * 0.3;
      this.speed = 0.5 + Math.random() * 0.7;
      if (this.isForeground) {
        this.scale *= 1.3;
        this.speed *= 1.2;
      }
      
      let angleBase = (Math.random() - 0.5) * Math.PI * 0.5;
      if (Math.random() > 0.5) {
        angleBase += Math.PI; 
        this.x = initial ? Math.random() * W : W + 50;
      } else {
        this.x = initial ? Math.random() * W : -50;
      }
      this.y = Math.random() * H;
      this.angle = angleBase;
      this.turn = (Math.random() - 0.5) * 0.003;
      this.baseAlpha = 0.12 + Math.random() * 0.18;
      if (this.isForeground) {
        this.baseAlpha *= 1.2;
      }
      this.swayPhase = Math.random() * Math.PI * 2;
      this.swaySpeed = 0.01 + Math.random() * 0.02;
    }
    update() {
      this.angle += this.turn;
      this.swayPhase += this.swaySpeed;
      const sway = Math.sin(this.swayPhase) * 0.4;
      this.x += Math.cos(this.angle) * this.speed + Math.cos(this.angle + Math.PI/2) * sway;
      this.y += Math.sin(this.angle) * this.speed + Math.sin(this.angle + Math.PI/2) * sway;
      if (this.x < -150 || this.x > W + 150 || this.y < -150 || this.y > H + 150) {
        this.reset();
      }
    }
    draw() {
      const ctx = this.isForeground ? fgCtx : bgCtx;
      if (!ctx) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(this.scale, this.scale);
      drawPlaneMesh(ctx, this.baseAlpha);
      ctx.restore();
    }
  }

  const isMobile = window.innerWidth < 600;
  const count = isMobile ? 12 : 24;
  const fgCount = isMobile ? 1 : 2; // Very few planes in the foreground
  
  const planes = Array.from({ length: count }, () => new BgPlane(false));
  const fgPlanes = Array.from({ length: fgCount }, () => new BgPlane(true));

  setTimeout(() => {
    bgCanvas.classList.add('is-visible');
    if (fgCanvas) fgCanvas.classList.add('is-visible');
  }, 500);

  if (_bgPlanesAnimId) cancelAnimationFrame(_bgPlanesAnimId);
  
  function tick() {
    bgCtx.clearRect(0, 0, W, H);
    if (fgCtx) fgCtx.clearRect(0, 0, W, H);
    
    planes.forEach(p => { p.update(); p.draw(); });
    fgPlanes.forEach(p => { p.update(); p.draw(); });
    
    _bgPlanesAnimId = requestAnimationFrame(tick);
  }
  tick();
}

/* ════════════════════════════════════════════════════════════
   RENDER SKELETON
   ════════════════════════════════════════════════════════════ */
function _renderLetterSkeleton(config) {
  _setText('letter-date', '');
  _setText('letter-title', '');
  _setText('letter-to', '');
  _setText('letter-from', '');
  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) bodyEl.innerHTML = '';
}

/* ════════════════════════════════════════════════════════════
   TYPEWRITER ENGINE
   ════════════════════════════════════════════════════════════ */
async function _typewriteLetter(config) {
  const params = new URLSearchParams(window.location.search);
  const skipTW = params.get('skipTW') === '1' || config._forceSkipTW === true;

  if (skipTW) {
    // ── Instant Render ──
    if (config.title) _setText('letter-title', config.title);
    if (config.date) _setText('letter-date', config.date);
    if (config.salutation) _setText('letter-to', config.salutation);

    const bodyEl = document.getElementById('letter-body');
    if (bodyEl) {
      if (config.fontFamily) bodyEl.classList.add(`font-${config.fontFamily}`);
      if (config.fontSize) bodyEl.classList.add(config.fontSize);
      const raw = (config.letter_body || '').trim();
      const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      bodyEl.innerHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }

    if (config.from) _setText('letter-from', config.from);

    const saveBtnContainer = document.getElementById('save-letter-container');
    const secretBtn = document.getElementById('btn-secret-memory');
    if (saveBtnContainer) {
      if (config.secretMediaList && config.secretMediaList.length && secretBtn) {
        secretBtn.style.display = 'inline-flex';
      }
      saveBtnContainer.style.display = 'block';
      saveBtnContainer.style.opacity = '1';
    }
    _initSecretMemory(config);

    if (params.get('openMemory') === '1' && config.secretMediaList && config.secretMediaList.length) {
      setTimeout(() => {
        document.getElementById('letter-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        if (secretBtn) secretBtn.click();
      }, 100);
    }
    return;
  }

  // ── Typewriter Mode ──

  // 1. Type Date
  if (config.date) {
    await _typewriteSimple('letter-date', config.date, 50, true);
    await _delay(300);
  }

  // 2. Type Salutation
  if (config.salutation) {
    await _typewriteSimple('letter-to', config.salutation, 60, true);
    await _delay(600);
  }

  // 4. Type Body
  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) {
    if (config.fontFamily) bodyEl.classList.add(`font-${config.fontFamily}`);
    if (config.fontSize) bodyEl.classList.add(config.fontSize);

    const raw = (config.letter_body || '').trim();
    const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi];
      const p = document.createElement('p');
      p.style.opacity = '0';
      bodyEl.appendChild(p);
      p.appendChild(cursor);

      await _delay(150);
      p.style.transition = 'opacity 0.4s';
      p.style.opacity = '1';

      for (const ch of para) {
        const textNode = document.createTextNode(ch);
        p.insertBefore(textNode, cursor);

        // Play typewriter sound on non-space chars
        if (ch !== ' ' && ch !== '\n') _playTypeSound();

        // Smart autoscroll
        const isAtBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 120);
        if (isAtBottom) cursor.scrollIntoView({ block: 'nearest', behavior: 'auto' });

        const delay = ch === '.' || ch === ',' || ch === '!' || ch === '?'
          ? TW_CHAR_DELAY * 4
          : TW_CHAR_DELAY + (Math.random() * 12 - 6);
        await _delay(delay);
      }
      cursor.remove();
      await _delay(TW_PARA_PAUSE);
    }
  }

  // 5. Type Signature
  if (config.from) {
    await _delay(800);
    await _typewriteSimple('letter-from', config.from, 100, false);
  }

  // 6. Dramatic pause
  await _delay(1500);

  // 7. Reveal action buttons
  const saveBtnContainer = document.getElementById('save-letter-container');
  const secretBtn = document.getElementById('btn-secret-memory');

  if (saveBtnContainer) {
    if (config.secretMediaList && config.secretMediaList.length && secretBtn) {
      secretBtn.style.display = 'inline-flex';
    }
    saveBtnContainer.style.display = 'block';
    setTimeout(() => { saveBtnContainer.style.opacity = '1'; }, 50);
  }

  // 8. Init Secret Memory Modal
  _initSecretMemory(config);

  // 9. Auto-open Secret Memory
  if (config.secretMediaList && config.secretMediaList.length && secretBtn) {
    setTimeout(() => {
      document.getElementById('letter-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      secretBtn.click();
    }, 150);
  }
}

async function _typewriteSimple(elId, text, speed, withSound = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.display = '';
  el.textContent = '';

  for (const ch of text) {
    el.textContent += ch;
    if (withSound && ch !== ' ') _playTypeSound();
    await _delay(speed);
  }
}

/* ════════════════════════════════════════════════════════════
   SECRET MEMORY MODAL
   ════════════════════════════════════════════════════════════ */
function _initSecretMemory(config) {
  const modal = document.getElementById('modal-secret-memory');
  const openBtn = document.getElementById('btn-secret-memory');
  const closeBtn = document.getElementById('btn-close-memory');
  const mediaWrap = document.getElementById('polaroid-media-wrap');
  const captionEl = document.getElementById('polaroid-caption');
  const polaroid = document.getElementById('polaroid-frame');
  const prevBtn = document.getElementById('btn-memory-prev');
  const nextBtn = document.getElementById('btn-memory-next');
  const counterEl = document.getElementById('polaroid-counter');

  const list = config.secretMediaList || [];
  if (!modal || !openBtn || list.length === 0) return;

  let currentIndex = 0;

  function _renderSlide(idx) {
    const item = list[idx];
    if (!item) return;

    const oldVid = mediaWrap.querySelector('video');
    if (oldVid) oldVid.pause();
    mediaWrap.innerHTML = '';

    const isVideo = /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(item.url);
    if (isVideo) {
      const vid = document.createElement('video');
      vid.src = item.url;
      vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:1px;';
      mediaWrap.appendChild(vid);
      vid.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.caption || 'Memory';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:1px;';
      mediaWrap.appendChild(img);
    }

    if (captionEl) captionEl.textContent = item.caption || '';

    if (list.length > 1 && counterEl) {
      counterEl.textContent = `${idx + 1} / ${list.length}`;
      counterEl.style.display = 'block';
    }

    const rot = idx % 2 === 0 ? '-2.5deg' : '2deg';
    if (polaroid) polaroid.style.transform = `rotate(${rot}) translateY(0) scale(1)`;
  }

  function _goTo(idx) {
    currentIndex = (idx + list.length) % list.length;
    _renderSlide(currentIndex);
  }

  function _openModal() {
    currentIndex = 0;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    if (list.length > 1) {
      if (prevBtn) prevBtn.style.display = 'flex';
      if (nextBtn) nextBtn.style.display = 'flex';
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.background = 'rgba(20, 14, 8, 0.92)';
        modal.style.backdropFilter = 'blur(12px)';
        modal.style.webkitBackdropFilter = 'blur(12px)';
      });
    });

    setTimeout(() => {
      if (polaroid) {
        polaroid.style.opacity = '1';
        polaroid.style.filter = 'blur(0px)';
      }
      _renderSlide(0);
    }, 120);
  }

  function _closeModal() {
    if (polaroid) {
      polaroid.style.transform = 'rotate(-2.5deg) translateY(40px) scale(0.88)';
      polaroid.style.opacity = '0';
      polaroid.style.filter = 'blur(8px)';
    }
    modal.style.background = 'rgba(20, 14, 8, 0)';
    modal.style.backdropFilter = 'blur(0px)';
    modal.style.webkitBackdropFilter = 'blur(0px)';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (counterEl) counterEl.style.display = 'none';

    setTimeout(() => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      const vid = mediaWrap ? mediaWrap.querySelector('video') : null;
      if (vid) vid.pause();
      if (mediaWrap) mediaWrap.innerHTML = '';
    }, 750);
  }

  openBtn.addEventListener('click', _openModal);
  if (closeBtn) closeBtn.addEventListener('click', _closeModal);
  if (prevBtn) prevBtn.addEventListener('click', () => _goTo(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => _goTo(currentIndex + 1));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) _closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (modal.style.display === 'none') return;
    if (e.key === 'Escape') _closeModal();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') _goTo(currentIndex + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') _goTo(currentIndex - 1);
  });
}

/* ════════════════════════════════════════════════════════════
   DOWNLOAD / SCREENSHOT
   ════════════════════════════════════════════════════════════ */
const _THEME_BG = {
  'sage': ['#dce8da', '#c8d8c6'],
  'dusty-rose': ['#f5dada', '#ead0d0'],
  'midnight': ['#1a1f2e', '#111624'],
  'blush-cream': ['#f5e8d8', '#ecdccb'],
  'crimson': ['#1a050a', '#120308'],
  'obsidian': ['#050a07', '#0a100c'],
  'default': ['#3a2a1a', '#2e2014'],
};

function _initDownloadButton(config) {
  const btn = document.getElementById('btn-save-letter');
  if (!btn) return;

  // ── CSS INJECTION FOR ROTATE HINT ──
  if (!document.getElementById('_rotate-hint-css')) {
    const s = document.createElement('style');
    s.id = '_rotate-hint-css';
    s.textContent = `
      @keyframes _phoneRotate {
        0%   { transform: rotate(0deg); }
        35%  { transform: rotate(-90deg); }
        65%  { transform: rotate(-90deg); }
        100% { transform: rotate(0deg); }
      }
      #_rotate-overlay {
        position: fixed; inset: 0; z-index: 99999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 24px;
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        padding: 48px 36px; text-align: center;
        opacity: 0; transition: opacity 0.3s ease;
      }
      #_rotate-overlay .rh-emoji {
        font-size: 54px;
        animation: _phoneRotate 2s ease-in-out infinite;
        display: block;
      }
      #_rotate-overlay .rh-title {
        font-family: var(--font-display, 'Playfair Display', serif);
        font-size: 1.3rem; font-weight: 600;
        margin: 0 0 6px; letter-spacing: 0.01em;
      }
      #_rotate-overlay .rh-sub {
        font-family: var(--font-ui, 'DM Sans', sans-serif);
        font-size: 0.78rem; line-height: 1.65;
        margin: 0; letter-spacing: 0.02em; opacity: 0.65;
      }
      #_rotate-overlay .rh-divider {
        width: 40px; height: 2px; border-radius: 2px; opacity: 0.4;
      }
      #_rotate-overlay .rh-skip {
        font-family: var(--font-ui, 'DM Sans', sans-serif);
        font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.18em;
        padding: 10px 26px; border-radius: 30px; cursor: pointer;
        background: transparent; transition: opacity 0.2s;
      }
      #_rotate-overlay .rh-skip:hover { opacity: 0.75; }
    `;
    document.head.appendChild(s);
  }

  const _doCapture = async () => {
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Saving... ⏳';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';

    try {
      const targetEl = document.getElementById('letter-paper');
      const btnContainer = document.getElementById('save-letter-container');
      const scrollWrapper = document.querySelector('.letter-scroll');

      if (scrollWrapper) scrollWrapper.style.overflow = 'hidden';
      if (btnContainer) btnContainer.style.display = 'none';

      const letterCanvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        onclone: (clonedDoc) => {
          const paper = clonedDoc.getElementById('letter-paper');
          if (paper) {
            paper.style.animation = 'none';
            paper.style.filter = 'none';
            paper.style.transform = 'none';
            paper.style.opacity = '1';
          }
        }
      });

      if (btnContainer) btnContainer.style.display = 'block';
      if (scrollWrapper) scrollWrapper.style.overflow = 'auto';

      const STORY_W = 1080;
      const STORY_H = 1920;
      const PADDING = 80;

      const story = document.createElement('canvas');
      story.width = STORY_W;
      story.height = STORY_H;
      const ctx = story.getContext('2d');

      // Desk-colored background
      const computedStyle = getComputedStyle(document.body);
      const bgTop = computedStyle.getPropertyValue('--bg-top').trim() || '#f0e6ef';
      const bgBot = computedStyle.getPropertyValue('--bg-bottom').trim() || '#e8ddd5';
      const grad = ctx.createLinearGradient(0, 0, 0, STORY_H);
      grad.addColorStop(0, bgTop);
      grad.addColorStop(0.5, bgBot);
      grad.addColorStop(1, bgTop);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, STORY_W, STORY_H);

      const maxW = STORY_W - PADDING * 2;
      const maxH = STORY_H - PADDING * 2;
      const scale = Math.min(maxW / letterCanvas.width, maxH / letterCanvas.height, 1);
      const drawW = Math.round(letterCanvas.width * scale);
      const drawH = Math.round(letterCanvas.height * scale);
      const drawX = Math.round((STORY_W - drawW) / 2);
      const drawY = Math.round((STORY_H - drawH) / 2);

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 48;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.drawImage(letterCanvas, drawX, drawY, drawW, drawH);

      await new Promise(resolve => {
        story.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const safeName = (config.recipientName || config.to || 'Kamu').replace(/[^a-zA-Z0-9]/g, '_');
          link.download = `Airmail_Untuk_${safeName}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 500);
          resolve();
        }, 'image/png');
      });

      letterCanvas.width = 0; letterCanvas.height = 0;
      story.width = 0; story.height = 0;

    } catch (e) {
      console.error('Screenshot failed:', e);
      alert('Failed to save. You can still screenshot this screen manually.');
    } finally {
      btn.innerHTML = originalText;
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  };

  btn.addEventListener('click', async () => {
    if (typeof html2canvas === 'undefined') {
      alert('System is loading... please try again in a moment.');
      return;
    }

    // Already landscape → langsung capture tanpa modal
    if (window.innerWidth > window.innerHeight) {
      await _doCapture();
      return;
    }

    // ── Build modal overlay ───────────────────────────────────────
    const accent = '#c0392b';
    const bg = 'rgba(253, 250, 245, 0.96)';
    const textColor = '#1a1610';

    const overlay = document.createElement('div');
    overlay.id = '_rotate-overlay';
    overlay.style.background = bg;
    overlay.innerHTML = `
      <span class="rh-emoji">📱</span>
      <div>
        <p class="rh-title" style="color:${textColor};">Untuk hasil terbaik,<br>miringkan HP kamu dulu 🔁</p>
        <p class="rh-sub" style="color:${textColor};">Surat tampil lebih lebar &amp; proporsional saat landscape ✨<br>Pastikan <em>rotation lock</em> tidak aktif.</p>
      </div>
      <div class="rh-divider" style="background:${accent};"></div>
      <button class="rh-skip" id="_rotate-skip"
        style="border:1px solid ${accent}; color:${accent};">
        Tetap Simpan (Portrait)
      </button>
    `;
    document.body.appendChild(overlay);
    // Fade in
    requestAnimationFrame(() => requestAnimationFrame(() => { overlay.style.opacity = '1'; }));

    let done = false;

    const closeModal = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 320);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrient);
    };

    const trigger = async () => {
      if (done) return;
      done = true;
      closeModal();
      // Tunggu sebentar agar layout selesai rotate sebelum capture
      await new Promise(r => setTimeout(r, 350));
      await _doCapture();
    };

    // Auto-detect rotate
    const onResize = () => {
      if (window.innerWidth > window.innerHeight) trigger();
    };
    const onOrient = () => {
      // orientationchange butuh delay kecil agar innerWidth sudah update
      setTimeout(() => { if (window.innerWidth > window.innerHeight) trigger(); }, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);

    // Fallback button
    document.getElementById('_rotate-skip').addEventListener('click', () => {
      if (done) return;
      done = true;
      closeModal();
      _doCapture();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   MUSIC PLAYER (Background audio, same as letter-project)
   ════════════════════════════════════════════════════════════ */
let _currentTrack = 0;
let _playlist = [];

const _audioEl = () => document.getElementById('audio-player');

function _initMusicPlayer(config) {
  _playlist = (config.playlist || []).filter(t => t.src || t.url);
  if (_playlist.length === 0) return;

  const audio = _audioEl();
  audio.volume = 0.2;
  _loadTrack(0, false);
  audio.addEventListener('ended', () => _loadTrack(_currentTrack + 1, true));
}

function _loadTrack(idx, autoplay) {
  const len = _playlist.length;
  if (len === 0) return;
  _currentTrack = ((idx % len) + len) % len;

  const track = _playlist[_currentTrack];
  const src = track.src || track.url || '';

  const audio = _audioEl();
  const href = new URL(src, window.location.href).href;

  if (audio.getAttribute('data-src') !== href) {
    audio.setAttribute('data-src', href);
    audio.src = src;
    audio.load();
  }

  if (autoplay) audio.play().catch(() => {});
}

/* ════════════════════════════════════════════════════════════
   PASSWORD AUTHENTICATION
   ════════════════════════════════════════════════════════════ */
function _handleAuthentication(config) {
  const params = new URLSearchParams(window.location.search);
  const skipAuth = params.get('skipAuth') === '1';

  const gateEl = document.getElementById('password-gate');
  const passInput = document.getElementById('gate-password-input');
  const verifyBtn = document.getElementById('btn-gate-verify');
  const hintContainer = document.getElementById('gate-hint-container');
  const hintText = document.getElementById('gate-hint-text');
  const errorEl = document.getElementById('gate-error');

  if (skipAuth || !config.login_password || config.login_password.trim() === '') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    gateEl.classList.remove('hidden');
    gateEl.style.opacity = '0';
    gateEl.style.display = 'flex';

    void gateEl.offsetWidth;
    gateEl.style.opacity = '1';

    if (config.login_hint) {
      hintText.textContent = config.login_hint;
      hintContainer.classList.remove('hidden');
    }

    verifyBtn.addEventListener('click', () => {
      const inputPass = passInput.value.trim().toLowerCase();
      const actualPass = config.login_password.trim().toLowerCase();
      const card = gateEl.querySelector('.gate-card');

      if (inputPass === actualPass) {
        gateEl.style.opacity = '0';
        setTimeout(() => {
          gateEl.classList.add('hidden');
          resolve();
        }, 700);
      } else {
        errorEl.classList.remove('hidden');
        passInput.value = '';
        passInput.focus();
        card.classList.remove('gate-shake');
        void card.offsetWidth;
        card.classList.add('gate-shake');
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
      }
    });

    passInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyBtn.click();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.style.display = '';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
