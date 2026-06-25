/**
 * Secret Garden — script.js
 * Kiki's Delivery Service inspired letter theme.
 *
 * Architecture:
 *  - Same dual mode: Online (Worker KV) + Standalone (config.js)
 *  - State machine: loading → envelope → letter
 *  - Kraft envelope with ribbon untie + wax seal break
 *  - Golden dust sparkle particles (no emoji)
 *  - Typewriter effect with handwritten drop cap
 *  - Photo memory modal
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */
const WORKER_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

// Capture the base URL of THIS script at load time, so asset paths
// are always resolved relative to the script folder — not the page URL.
// (document.currentScript is only available synchronously at parse time)
const _SCRIPT_BASE = (() => {
  try {
    const src = document.currentScript && document.currentScript.src;
    if (src) return src.substring(0, src.lastIndexOf('/') + 1);
  } catch(e) {}
  return '';
})();

const TW_CHAR_DELAY = 38;
const TW_PARA_PAUSE = 700;

let _bgDovesAnimId = null; // background doves RAF handle

/* ════════════════════════════════════════════════════════════
   STATE MACHINE
   ════════════════════════════════════════════════════════════ */
function showState(stateId, options = {}) {
  const { duration = 500 } = options;
  const ids = ['loading', 'envelope', 'letter', 'maintenance'];

  const incoming = document.getElementById(`state-${stateId}`);
  if (!incoming) return;

  const outgoing = ids
    .filter(id => id !== stateId)
    .map(id => document.getElementById(`state-${id}`))
    .find(el => el && !el.classList.contains('hidden') && !el.classList.contains('is-exiting'));

  incoming.classList.remove('hidden', 'is-exiting');
  incoming.classList.add('is-entering');
  void incoming.offsetWidth;

  if (outgoing) {
    outgoing.classList.add('is-exiting');
    setTimeout(() => {
      outgoing.classList.add('hidden');
      outgoing.classList.remove('is-exiting');
    }, duration);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      incoming.classList.remove('is-entering');
    });
  });
}

/* ════════════════════════════════════════════════════════════
   INIT — ENTRY POINT
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  showState('loading');

  // (Sparkles removed)

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
      console.warn('[Garden] Database fetch failed, falling back...', err.message);
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

  // Apply Theme Colors
  const activeTheme = config.ribbonTheme || 'ribbon-crimson';
  document.documentElement.setAttribute('data-ribbon-theme', activeTheme);
  document.body.setAttribute('data-ribbon-theme', activeTheme);
  _applyEnvelopeTheme(activeTheme);

  // Update theme-color meta tag to lock Safari's status bar
  const themeHexMap = {
    'ribbon-crimson':  '#eeeadd',
    'ribbon-rose':     '#f0e0e8',
    'ribbon-forest':   '#dde8e0',
    'ribbon-midnight': '#1a2240',
    'ribbon-bordeaux': '#2d0f18',
    'ribbon-violet':   '#ece4f4'
  };
  const exactHex = themeHexMap[activeTheme] || '#eeeadd';

  let metaTheme = document.getElementById('theme-color-meta');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.id = 'theme-color-meta';
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', exactHex);

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
      .replace(/[,;:.]\s*$/, '');
    envName.textContent = displayName.trim() || 'Kamu';
  }

  // ── Handle skipTW (preview from studio section buttons) ──
  const isSkipTW = params.get('skipTW') === '1';
  const isOpenMemory = params.get('openMemory') === '1';
  const previewPage = params.get('previewPage');

  const shouldDirectToLetter = isOpenMemory || (isSkipTW && previewPage === 'page-surat');

  if (shouldDirectToLetter) {
    config._forceSkipTW = true;
    showState('letter');
    const paper = document.getElementById('letter-paper');
    if (paper) {
      requestAnimationFrame(() => requestAnimationFrame(() => paper.classList.add('is-revealing')));
    }
    await _delay(400);
    await _typewriteLetter(config);
    if (isOpenMemory) {
      setTimeout(() => {
        document.getElementById('letter-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        document.getElementById('btn-secret-memory')?.click();
      }, 300);
    }
    return;
  }

  // ── Show Envelope ──
  await _delay(200);
  showState('envelope');
  await _waitForEnvelopeOpen(config);

  // ── Flap is now open. Get envelope position for flower burst origin ──
  const envEl = document.getElementById('ribbon-envelope');
  const envRect = envEl ? envEl.getBoundingClientRect() : null;

  // Delay showState('letter') until flowers fully cover the screen.
  // The overlay is transparent — envelope stays visible below during burst.
  await _playFlowerTransition(envRect, config, () => showState('letter'));

  // Reveal paper after flowers have cleared
  const paper = document.getElementById('letter-paper');
  if (paper) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        paper.classList.add('is-revealing');
      });
    });
  }

  // Start persistent background doves alongside paper reveal
  _startBackgroundDoves(config.ribbonTheme || 'ribbon-crimson');

  // Wait for paper rise animation to finish, then start typewriter
  await _delay(1600);
  await _typewriteLetter(config);
}

/* ════════════════════════════════════════════════════════════
   SPARKLE PARTICLES (Removed for static aesthetic)
   ════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   ENVELOPE THEME — wax seal emblem + vine tint per theme
   ════════════════════════════════════════════════════════════ */
function _applyEnvelopeTheme(theme) {
  const emblemEl = document.getElementById('seal-emblem');
  if (!emblemEl) return;

  // SVG inner paths for each theme emblem (all use rgba(255,228,210,0.75) fill by default)
  const emblems = {
    'ribbon-crimson': `
      <!-- Dove: body + two wings spread + head + eye -->
      <ellipse cx="36" cy="31" rx="7" ry="4.5" fill="rgba(255,228,210,0.75)"/>
      <path d="M36 28 C30 23 22 25 20 29 C25 27 31 28 36 28Z" fill="rgba(255,228,210,0.75)"/>
      <path d="M36 28 C42 23 50 25 52 29 C47 27 41 28 36 28Z" fill="rgba(255,228,210,0.75)"/>
      <circle cx="32" cy="26.5" r="2" fill="rgba(255,228,210,0.8)"/>
      <circle cx="31.2" cy="26" r="0.7" fill="rgba(100,40,20,0.5)"/>
      <path d="M30.5 27 L28.5 28.5" stroke="rgba(255,228,210,0.8)" stroke-width="0.8" stroke-linecap="round"/>`,

    'ribbon-forest': `
      <!-- Leaf branch with 3 leaves and a central stem -->
      <line x1="36" y1="38" x2="36" y2="22" stroke="rgba(255,228,210,0.75)" stroke-width="1.2" stroke-linecap="round"/>
      <ellipse cx="31" cy="28" rx="5" ry="2.8" fill="rgba(255,228,210,0.7)" transform="rotate(-35 31 28)"/>
      <ellipse cx="41" cy="26" rx="5" ry="2.8" fill="rgba(255,228,210,0.7)" transform="rotate(35 41 26)"/>
      <ellipse cx="36" cy="22" rx="5" ry="2.8" fill="rgba(255,228,210,0.75)" transform="rotate(0 36 22)"/>
      <line x1="36" y1="38" x2="31" y2="28" stroke="rgba(255,228,210,0.5)" stroke-width="0.7"/>
      <line x1="36" y1="35" x2="41" y2="26" stroke="rgba(255,228,210,0.5)" stroke-width="0.7"/>`,

    'ribbon-midnight': `
      <!-- Crescent moon + small star cluster -->
      <path d="M40 24 A9 9 0 1 1 31 37 A6 6 0 1 0 40 24Z" fill="rgba(255,228,210,0.75)"/>
      <circle cx="28" cy="24" r="1.5" fill="rgba(255,228,210,0.8)"/>
      <circle cx="33" cy="20" r="1" fill="rgba(255,228,210,0.65)"/>
      <circle cx="44" cy="38" r="1" fill="rgba(255,228,210,0.55)"/>
      <path d="M26 31 L27.2 34 L30.5 34 L27.9 36 L28.8 39.5 L26 37.5 L23.2 39.5 L24.1 36 L21.5 34 L24.8 34Z"
        fill="rgba(255,228,210,0.55)" transform="scale(0.55) translate(23 20)"/>`,

    'ribbon-rose': `
      <!-- Rose bud: layered petals -->
      <ellipse cx="36" cy="35" rx="4.5" ry="5.5" fill="rgba(255,228,210,0.7)"/>
      <ellipse cx="32" cy="33" rx="4" ry="5" fill="rgba(255,228,210,0.65)" transform="rotate(-15 32 33)"/>
      <ellipse cx="40" cy="33" rx="4" ry="5" fill="rgba(255,228,210,0.65)" transform="rotate(15 40 33)"/>
      <ellipse cx="36" cy="30" rx="3.5" ry="4" fill="rgba(255,228,210,0.75)"/>
      <ellipse cx="36" cy="28.5" rx="2" ry="2.5" fill="rgba(255,228,210,0.8)"/>
      <line x1="36" y1="40" x2="36" y2="44" stroke="rgba(255,228,210,0.6)" stroke-width="1" stroke-linecap="round"/>
      <ellipse cx="32" cy="42" rx="3.5" ry="2" fill="rgba(255,228,210,0.5)" transform="rotate(-30 32 42)"/>`,

    'ribbon-bordeaux': `
      <!-- Fleur-de-lis stylized -->
      <line x1="36" y1="22" x2="36" y2="42" stroke="rgba(255,228,210,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="36" cy="25" rx="2.5" ry="5" fill="rgba(255,228,210,0.75)"/>
      <path d="M36 29 C30 26 25 28 24 33 C27 31 32 30 36 32Z" fill="rgba(255,228,210,0.7)"/>
      <path d="M36 29 C42 26 47 28 48 33 C45 31 40 30 36 32Z" fill="rgba(255,228,210,0.7)"/>
      <ellipse cx="36" cy="38" rx="3.5" ry="2" fill="rgba(255,228,210,0.6)"/>
      <circle cx="36" cy="31" r="2" fill="rgba(255,228,210,0.8)"/>`,

    'ribbon-violet': `
      <!-- Butterfly wings: 4 wing lobes + body -->
      <path d="M36 30 C30 22 20 20 18 28 C16 34 24 38 36 34Z" fill="rgba(255,228,210,0.7)"/>
      <path d="M36 30 C42 22 52 20 54 28 C56 34 48 38 36 34Z" fill="rgba(255,228,210,0.7)"/>
      <path d="M36 34 C30 36 22 40 24 44 C28 46 34 42 36 38Z" fill="rgba(255,228,210,0.6)"/>
      <path d="M36 34 C42 36 50 40 48 44 C44 46 38 42 36 38Z" fill="rgba(255,228,210,0.6)"/>
      <!-- Body -->
      <ellipse cx="36" cy="33" rx="2" ry="5" fill="rgba(255,228,210,0.85)"/>
      <!-- Antennae -->
      <path d="M35 28 C33 24 30 22 29 20" stroke="rgba(255,228,210,0.6)" stroke-width="0.8" fill="none" stroke-linecap="round"/>
      <path d="M37 28 C39 24 42 22 43 20" stroke="rgba(255,228,210,0.6)" stroke-width="0.8" fill="none" stroke-linecap="round"/>
      <circle cx="29" cy="20" r="1.2" fill="rgba(255,228,210,0.6)"/>
      <circle cx="43" cy="20" r="1.2" fill="rgba(255,228,210,0.6)"/>`
  };

  const emblem = emblems[theme] || emblems['ribbon-crimson'];
  emblemEl.innerHTML = emblem;

  // Update vine stroke color to match theme sage/accent
  const vineThemeColors = {
    'ribbon-crimson':  { stroke: '#7a9e7e', berry: '#d4b8c8', flower: '#d4b8c8' },
    'ribbon-forest':   { stroke: '#4a7a58', berry: '#9cb8a0', flower: '#c8d8c0' },
    'ribbon-midnight': { stroke: '#6a8ab8', berry: '#c8d4e8', flower: '#b0c0d8' },
    'ribbon-rose':     { stroke: '#9a7880', berry: '#e8c0c8', flower: '#e8c0cc' },
    'ribbon-bordeaux': { stroke: '#7a5040', berry: '#c8a888', flower: '#d4b898' },
    'ribbon-violet':   { stroke: '#7a68a0', berry: '#c8b8e0', flower: '#d0c0e8' },
    'ribbon-sunflower':{ stroke: '#8a6b1c', berry: '#e0a618', flower: '#fcf2d4' },
  };
  const vc = vineThemeColors[theme] || vineThemeColors['ribbon-crimson'];

  // Update all vine strokes and fills
  const vine = document.querySelector('.envelope-vine');
  if (vine) {
    vine.querySelectorAll('path').forEach(p => {
      if (p.getAttribute('fill') === 'none') p.setAttribute('stroke', vc.stroke);
      else if (p.getAttribute('fill') && p.getAttribute('fill').includes('#9cb8a0')) p.setAttribute('fill', vc.stroke);
    });
    vine.querySelectorAll('ellipse').forEach(el => {
      const f = el.getAttribute('fill');
      if (f && f.includes('#9cb8a0')) el.setAttribute('fill', vc.stroke);
    });
    vine.querySelectorAll('circle').forEach(c => {
      const f = c.getAttribute('fill');
      if (f && (f.includes('#d4b8c8') || f.includes('#c9a0a0'))) c.setAttribute('fill', vc.berry);
    });
    // Flower petals
    vine.querySelectorAll('g circle').forEach(c => {
      const f = c.getAttribute('fill');
      if (f && f.includes('#d4b8c8')) c.setAttribute('fill', vc.flower);
    });
  }
}


/* ════════════════════════════════════════════════════════════
   FLORAL FOUNTAIN TRANSITION
   Replaces dove animation with a popcorn-style flower burst.
   Flowers erupt from the envelope flap, spin, fill the screen,
   then swipe left/right to reveal the letter.
   ════════════════════════════════════════════════════════════ */
function _playFlowerTransition(envRect, config, onSwitchState) {
  return new Promise(resolve => {
    // ── Asset paths (relative to the ribbon theme folder) ────────
    const FLOWER_SRCS = [
      _SCRIPT_BASE + 'assets/flower_daisy-removebg-preview.png',
      _SCRIPT_BASE + 'assets/flower_hydrangea-removebg-preview.png',
      _SCRIPT_BASE + 'assets/flower_rose-removebg-preview.png',
      _SCRIPT_BASE + 'assets/flower_sunflower-removebg-preview.png',
    ];

    // ── Inject required keyframes & styles once ──────────────────
    if (!document.getElementById('_floral-styles')) {
      const style = document.createElement('style');
      style.id = '_floral-styles';
      style.textContent = `
        @keyframes _floral-spin { to { transform: rotate(360deg); } }
        @keyframes _floral-spin-rev { to { transform: rotate(-360deg); } }
        #_floral-overlay { position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden; }
        ._floral-img {
          position: absolute;
          will-change: transform, opacity;
          transform-origin: center center;
        }
      `;
      document.head.appendChild(style);
    }

    // ── Overlay container ────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = '_floral-overlay';
    document.body.appendChild(overlay);

    const W = window.innerWidth;
    const H = window.innerHeight;
    // Use the envelope's center as the burst origin, fallback to window center
    const cx = envRect ? (envRect.left + envRect.width / 2) : W / 2;
    const cy = envRect ? (envRect.top + envRect.height * 0.35) : H / 2; // top-third = flap area
    const isMobile = W < 600;
    const COUNT = 300;


    // ── Preload images ───────────────────────────────────────────
    const images = FLOWER_SRCS.map(src => {
      const img = new Image();
      img.src = src;
      return img;
    });

    // ── Seeded RNG (same as loves-edition for consistency) ───────
    let seed = 42;
    const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

    // ── Build particles ──────────────────────────────────────────
    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const frac = i / COUNT;

      // Fan angle: sweeping 240-degree upward arc
      const spread = 240;
      const baseAngleDeg = -90 + (frac - 0.5) * spread;
      const jitter = (rng() - 0.5) * 18;
      const angleRad = ((baseAngleDeg + jitter) * Math.PI) / 180;

      // Distance & end positions
      const sidePull = 1 + Math.abs(frac - 0.5) * 1.8;
      const dist = 350 + rng() * 650;
      const xEnd = Math.cos(angleRad) * dist * sidePull + (rng() - 0.5) * 100;
      const yPeak = Math.sin(angleRad) * dist - 50 - rng() * 150;
      const yFinal = yPeak + 400 + rng() * 650;

      // EXACT SAME SIZES AS PREVIOUSLY APPROVED MEDIUM in loves-edition
      const size = 140 + rng() * 140; // 140–280px
      const finalScale = 1.0 + rng() * 0.6;

      const rotateDir = rng() > 0.5 ? 1 : -1;
      const rotateSpeed = (6 + rng() * 10).toFixed(2); // seconds per 360deg

      // Dramatic popcorn stagger over 1.6s
      const delay = frac * 1.6 + rng() * 0.15;
      const duration = 2.0 + rng() * 1.6;

      particles.push({ i, frac, xEnd, yPeak, yFinal, size, finalScale, rotateDir, rotateSpeed, delay, duration });
    }

    // ── Create & animate DOM elements ───────────────────────────
    const els = particles.map(p => {
      // Outer wrapper: handles position (translate) + opacity via transition
      const wrapper = document.createElement('div');
      wrapper.className = '_floral-img';

      const half = p.size / 2;
      wrapper.style.cssText = `
        position:absolute;
        width:${p.size}px;
        height:${p.size}px;
        left:${cx - half}px;
        top:${cy - half}px;
        opacity:0;
        transform:translate(0,0) scale(0.12);
        will-change:transform,opacity;
      `;

      // Inner img: handles continuous spin only (no translate/scale)
      const img = document.createElement('img');
      img.src = FLOWER_SRCS[p.i % FLOWER_SRCS.length];
      img.draggable = false;
      img.decoding = 'async'; // optimize loading
      img.style.cssText = `
        width:100%;height:100%;
        display:block;
        animation:${p.rotateDir > 0 ? '_floral-spin' : '_floral-spin-rev'} ${p.rotateSpeed}s linear ${p.delay}s infinite;
        will-change:transform;
      `;

      wrapper.appendChild(img);
      overlay.appendChild(wrapper);

      return { el: wrapper, p };
    });

    // ── Trigger burst (Web Animations API) ───────────────────────
    els.forEach(({ el, p }) => {
      el.animate([
        { transform: `translate(0px, 0px) scale(0.12)`, opacity: 0 },
        { transform: `translate(${p.xEnd * 0.4}px, ${p.yPeak}px) scale(0.85)`, opacity: 1, offset: 0.38 },
        { transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale})`, opacity: 1 }
      ], {
        duration: p.duration * 1000,
        delay: p.delay * 1000,
        easing: 'ease-out',
        fill: 'both' // Keeps the final state after animation
      });
    });

    // ── The Whirlwind / Vortex (Tersapu Pusaran Angin) ───────────
    // After flowers settle (~3.6s), they are swept off-screen in a swirling motion
    const SETTLE_MS   = 3600;
    const VORTEX_MS   = SETTLE_MS + 400;   // When the vortex starts
    const HEART_MS    = VORTEX_MS + 2000;  // When vortex finishes, heart starts
    const HEART_STAY  = 4500;              // How long the heart stays (increased from 2500)
    const RESOLVE_MS  = HEART_MS + HEART_STAY + 800; // Allow time to fade out the heart

    // Switch page state while flowers fully cover the screen (invisible to user)
    setTimeout(() => { if (onSwitchState) onSwitchState(); }, SETTLE_MS - 200);

    setTimeout(() => {
      els.forEach(({ el, p }) => {
        // Calculate current angle from center
        const angle = Math.atan2(p.yFinal, p.xEnd);
        
        // Add a 90-degree twist to the angle to create a spiral/vortex tangential trajectory
        // Math.PI / 2 is 90 degrees in radians. We make them all swirl in the same direction.
        const swirlAngle = angle + (Math.PI / 2); 
        const dist = 2500; // Push them very far off-screen
        
        const vortexX = p.xEnd + Math.cos(swirlAngle) * dist + (Math.random() - 0.5) * 500;
        const vortexY = p.yFinal + Math.sin(swirlAngle) * dist + (Math.random() - 0.5) * 500;
        
        // Fast, chaotic duration with slight stagger
        const staggerDelay = Math.random() * 400; 
        const sweepDuration = 1000 + Math.random() * 600; 

        setTimeout(() => {
          el.animate([
            { transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale}) rotate(0deg)` },
            { transform: `translate(${vortexX}px, ${vortexY}px) scale(${p.finalScale}) rotate(360deg)` }
          ], {
            duration: sweepDuration,
            easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', // ease-in for acceleration
            fill: 'both' // Opacity remains 100% (solid), no fading out
          });
        }, staggerDelay);
      });
    }, VORTEX_MS);

    // ── From / To Card — appears after vortex, lingers through heart ─
    const TEXT_MS   = HEART_MS + 500;
    const TEXT_OUT_MS = HEART_MS + HEART_STAY - 600;
    setTimeout(() => {
      // toName: strip salutation prefixes
      const rawTo = (config.letterTo || config.salutation || config.recipientName || config.to || '')
        .replace(/^(Dearest|Dear|To|For)[,:\s]+/i, '')
        .replace(/[,;:.]+$/, '')
        .trim();
      const toName = rawTo;
      const fromName = (config.senderName || config.from || config.sender || '').trim();
      if (!toName && !fromName) return;

      // ── Detect if current theme is light or dark ──────────────────
      // Check the overlay's background color to determine luminance
      const bgColor = window.getComputedStyle(overlay).backgroundColor;
      const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      let isLightTheme = false;
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        // Relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        isLightTheme = luminance > 0.5;
      }
      // Also check via config ribbonTheme key (light themes: rose, forest, violet/parchment, sunflower)
      const theme = (config.ribbonTheme || config.theme || '').toLowerCase();
      if (['ribbon-rose', 'ribbon-forest', 'ribbon-violet', 'ribbon-parchment', 'ribbon-crimson', 'ribbon-sunflower'].some(t => theme.includes(t.replace('ribbon-','')))) {
        if (['rose', 'forest', 'violet', 'parchment', 'crimson', 'sunflower'].some(t => theme.includes(t))) {
          isLightTheme = true;
        }
      }

      // ── Adaptive palette ──────────────────────────────────────────
      const introColor  = isLightTheme ? 'rgba(90, 55, 30, 0.75)'    : 'rgba(255,225,185,0.8)';
      const nameColor   = isLightTheme ? 'rgba(50, 30, 15, 0.92)'    : 'rgba(255,240,220,0.95)';
      const dividerBg   = isLightTheme ? 'rgba(100, 60, 20, 0.3)'    : 'rgba(255,210,160,0.35)';
      const nameShadow  = isLightTheme ? '0 1px 8px rgba(255,255,255,0.5)' : '0 2px 20px rgba(0,0,0,0.4)';

      const S_val = Math.min(13, window.innerWidth * 0.028);
      // Heart parametric y ranges roughly from -12.3 (lobes) to +17 (bottom tip). Center is ~ +2.35
      const heartCenterY = cy + (2.35 * S_val) - 30;

      const card = document.createElement('div');
      card.style.cssText = `
        position: absolute;
        top: ${heartCenterY}px; left: ${cx}px;
        transform: translate(-50%, calc(-50% + 15px));
        z-index: 200;
        text-align: center;
        pointer-events: none;
        opacity: 0;
        filter: blur(4px);
        transition: opacity 1500ms ease, transform 1500ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 1500ms ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        width: 60%;
        max-width: 300px;
      `;

      const introStyle = `
        font-family: 'Cormorant Garamond', 'Georgia', serif;
        font-style: italic;
        text-transform: lowercase;
        letter-spacing: 0.12em;
        line-height: 1.3;
        font-size: clamp(12px, 1.8vw, 15px);
        color: ${introColor};
        font-weight: 400;
        display: block;
      `;
      const nameStyle = `
        font-family: 'Cormorant Garamond', 'Georgia', serif;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        line-height: 1.3;
        text-shadow: ${nameShadow};
        font-size: clamp(14px, 2.5vw, 22px);
        color: ${nameColor};
        font-weight: 600;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-wrap: break-word;
        overflow-wrap: break-word;
      `;
      card.innerHTML = `
        ${fromName ? `
          <span style="${introStyle} margin-bottom: 6px;">a letter from</span>
          <span style="${nameStyle} margin-bottom: 16px;">${fromName}</span>
        ` : ''}
        <span style="width: 32px; height: 1px; background: ${dividerBg}; margin-bottom: 16px; display: block;"></span>
        ${toName ? `
          <span style="${introStyle} margin-bottom: 6px;">for</span>
          <span style="${nameStyle}">${toName}</span>
        ` : ''}
      `;

      overlay.appendChild(card);
      requestAnimationFrame(() => requestAnimationFrame(() => { 
        card.style.opacity = '1'; 
        card.style.filter = 'blur(0px)';
        card.style.transform = 'translate(-50%, -50%)'; 
      }));

      setTimeout(() => {
        card.style.opacity = '0';
        card.style.filter = 'blur(4px)';
        card.style.transform = 'translate(-50%, -60%)';
        setTimeout(() => card.remove(), 1500);
      }, TEXT_OUT_MS - TEXT_MS);

    }, TEXT_MS);


    // ── Heart Formation (Formasi Hati) ───────────────────────────
    // Uses arc-length parameterization for perfectly even flower spacing
    setTimeout(() => {
      const heartWrapper = document.createElement('div');
      heartWrapper.style.cssText = `position:absolute;width:100%;height:100%;top:0;left:0;pointer-events:none;z-index:100;`;
      overlay.appendChild(heartWrapper);

      // --- Step 1: Pre-sample many raw points along the heart curve ---
      const SAMPLES = 2000;
      const rawPts = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = (i / SAMPLES) * Math.PI * 2;
        rawPts.push({
          x: 16 * Math.pow(Math.sin(t), 3),
          y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))
        });
      }

      // --- Step 2: Compute cumulative arc-lengths ---
      const arcLens = [0];
      for (let i = 1; i < SAMPLES; i++) {
        const dx = rawPts[i].x - rawPts[i-1].x;
        const dy = rawPts[i].y - rawPts[i-1].y;
        arcLens.push(arcLens[i-1] + Math.sqrt(dx*dx + dy*dy));
      }
      const totalLen = arcLens[SAMPLES - 1];

      // --- Step 3: Sample evenly spaced points ---
      const HEART_COUNT = 54; // Even number for clean petal cycling
      const FLOWER_SIZE = Math.min(46, window.innerWidth * 0.1); // Slightly smaller on mobile
      const S = Math.min(13, window.innerWidth * 0.028);         // Responsive scale multiplier
      
      const heartEls   = [];
      const heartPts   = [];
      let sampleIdx = 0;

      for (let i = 0; i < HEART_COUNT; i++) {
        const targetLen = (i / HEART_COUNT) * totalLen;
        while (sampleIdx < SAMPLES - 1 && arcLens[sampleIdx + 1] < targetLen) sampleIdx++;
        const pt = rawPts[sampleIdx];

        const px = cx + pt.x * S;
        const py = cy + pt.y * S - 30; // Shift up slightly for visual centering

        heartPts.push({ px, py });

        const el = document.createElement('div');
        el.className = '_floral-img';
        el.style.cssText = `
          position:absolute;
          width:${FLOWER_SIZE}px; height:${FLOWER_SIZE}px;
          left:${px - FLOWER_SIZE/2}px; top:${py - FLOWER_SIZE/2}px;
          opacity:0; transform:scale(0.1) rotate(0deg);
          will-change:transform,opacity;
        `;

        const rotateDir = i % 2 === 0 ? 1 : -1;
        const rotateSpeed = (4 + (i % 3) * 2).toFixed(2); // Varied speeds: 4s, 6s, 8s

        const img = document.createElement('img');
        img.src = FLOWER_SRCS[i % FLOWER_SRCS.length];
        img.decoding = 'async';
        img.style.cssText = `
          width:100%;height:100%;display:block;border-radius:50%;
          animation: ${rotateDir > 0 ? '_floral-spin' : '_floral-spin-rev'} ${rotateSpeed}s linear infinite;
          will-change: transform;
        `;

        el.appendChild(img);
        heartWrapper.appendChild(el);
        heartEls.push(el);

        // Staggered pop-in radiating from the top of the heart (index 0) clockwise
        const staggerIn = (i / HEART_COUNT) * 600;
        setTimeout(() => {
          el.animate([
            { transform: 'scale(0) rotate(-30deg)', opacity: 0 },
            { transform: 'scale(1.25) rotate(5deg)', opacity: 1, offset: 0.65 },
            { transform: 'scale(1.0) rotate(0deg)', opacity: 1 }
          ], {
            duration: 550,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring-like pop
            fill: 'both'
          });
        }, staggerIn);
      }

      // Gentle collective pulse while the heart is displayed
      setTimeout(() => {
        heartEls.forEach(el => {
          el.animate([
            { transform: 'scale(1.0)' },
            { transform: 'scale(1.08)' },
            { transform: 'scale(1.0)' }
          ], { duration: 900, easing: 'ease-in-out', iterations: 3 });
        });
      }, 700); // Start pulsing after all flowers have popped in

      // Fade out the heart before revealing the letter
      setTimeout(() => {
        heartEls.forEach((el, i) => {
          const staggerOut = (i / HEART_COUNT) * 300;
          setTimeout(() => {
            el.animate([
              { transform: 'scale(1.0)', opacity: 1 },
              { transform: 'scale(0.3) rotate(20deg)', opacity: 0 }
            ], { duration: 400, easing: 'ease-in', fill: 'both' });
          }, staggerOut);
        });
      }, HEART_STAY);

    }, HEART_MS);

    // ── Cleanup & resolve ────────────────────────────────────────
    setTimeout(() => {
      overlay.remove();
      resolve();
    }, RESOLVE_MS);
  });
}

/* ════════════════════════════════════════════════════════════
   BACKGROUND DOVES
   ════════════════════════════════════════════════════════════ */
function _startBackgroundDoves(ribbonTheme) {
  const bgCanvas = document.getElementById('bg-doves-canvas');
  const fgCanvas = document.getElementById('fg-doves-canvas');
  if (!bgCanvas) return;

  const bgCtx = bgCanvas.getContext('2d');
  const fgCtx = fgCanvas ? fgCanvas.getContext('2d') : null;
  let W = window.innerWidth;
  let H = window.innerHeight;

  bgCanvas.width = W; bgCanvas.height = H;
  if (fgCanvas) { fgCanvas.width = W; fgCanvas.height = H; }

  window.addEventListener('resize', () => {
    W = window.innerWidth; H = window.innerHeight;
    bgCanvas.width = W; bgCanvas.height = H;
    if (fgCanvas) { fgCanvas.width = W; fgCanvas.height = H; }
  });

  // ── Per-theme palette (light themes get darker doves for visibility) ──
  const PALETTES = {
    'ribbon-crimson':  { wing: '#c4956a', body: '#b88050', isLight: true  },
    'ribbon-forest':   { wing: '#c8e8d0', body: '#b0d4b8', isLight: false },
    'ribbon-midnight': { wing: '#b8c8f0', body: '#a0b0e0', isLight: false },
    'ribbon-rose':     { wing: '#d09098', body: '#c07888', isLight: true  },
    'ribbon-bordeaux': { wing: '#f0d8c0', body: '#e0c4a0', isLight: false },
    'ribbon-violet':   { wing: '#a880c8', body: '#9870b8', isLight: true  },
  };
  const C = PALETTES[ribbonTheme] || PALETTES['ribbon-crimson'];

  // ── Draw a small dove silhouette (simplified for bg ambient use) ──
  function drawBgDove(ctx, alpha, scale) {
    const flap = Math.sin(Date.now() * 0.003 + scale * 10) * 5;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.body;
    if (!C.isLight) {
      ctx.shadowColor = 'rgba(255,255,255,0.2)';
      ctx.shadowBlur = 4;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Top wing
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(-1, -8 - flap * 0.9, 6, -14 - flap * 1.2, 10, -7 - flap * 0.6);
    ctx.bezierCurveTo(7, -3, 3, -1, 0, -1);
    ctx.fillStyle = C.wing;
    ctx.fill();

    // Bottom wing
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(-1, 8 + flap * 0.6, 6, 12 + flap * 0.9, 10, 5 + flap * 0.5);
    ctx.bezierCurveTo(7, 2, 3, 1, 0, 1);
    ctx.fillStyle = C.wing;
    ctx.globalAlpha = alpha * 0.8;
    ctx.fill();

    // Outline stroke for light themes
    if (C.isLight) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = 'rgba(100,65,35,0.5)';
      ctx.lineWidth = 0.6 / scale;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Dove class ──
  class BgDove {
    constructor(isForeground) {
      this.isFg = isForeground;
      this.reset(true);
    }
    reset(initial = false) {
      // FG doves are slightly bigger/faster
      this.scale = this.isFg
        ? 0.5 + Math.random() * 0.3
        : 0.22 + Math.random() * 0.28;
      this.speed = (this.isFg ? 0.6 : 0.35) + Math.random() * 0.45;

      // Random direction — mostly drifting diagonally
      const angle = (Math.random() - 0.5) * Math.PI * 0.55;
      if (Math.random() > 0.5) {
        this.x = initial ? Math.random() * W : W + 60;
        this.angle = Math.PI + angle;
      } else {
        this.x = initial ? Math.random() * W : -60;
        this.angle = angle;
      }
      this.y = initial ? Math.random() * H : Math.random() * H;

      this.turn = (Math.random() - 0.5) * 0.002;
      this.baseAlpha = this.isFg
        ? 0.18 + Math.random() * 0.14
        : 0.08 + Math.random() * 0.10;
      this.swayPhase = Math.random() * Math.PI * 2;
      this.swaySpeed = 0.008 + Math.random() * 0.015;
    }
    update() {
      this.angle += this.turn;
      this.swayPhase += this.swaySpeed;
      const sway = Math.sin(this.swayPhase) * 0.3;
      this.x += Math.cos(this.angle) * this.speed + Math.cos(this.angle + Math.PI / 2) * sway;
      this.y += Math.sin(this.angle) * this.speed + Math.sin(this.angle + Math.PI / 2) * sway;
      if (this.x < -120 || this.x > W + 120 || this.y < -120 || this.y > H + 120) {
        this.reset();
      }
    }
    draw() {
      const ctx = this.isFg ? fgCtx : bgCtx;
      if (!ctx) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      drawBgDove(ctx, this.baseAlpha, this.scale);
      ctx.restore();
    }
  }

  const isMobile = W < 600;
  const bgCount = isMobile ? 16 : 32;
  const fgCount = isMobile ? 2 : 4;

  const bgDoves = Array.from({ length: bgCount }, () => new BgDove(false));
  const fgDoves = Array.from({ length: fgCount }, () => new BgDove(true));

  // Fade canvases in after a short delay
  setTimeout(() => {
    bgCanvas.classList.add('is-visible');
    if (fgCanvas) fgCanvas.classList.add('is-visible');
  }, 600);

  if (_bgDovesAnimId) cancelAnimationFrame(_bgDovesAnimId);

  function tick() {
    bgCtx.clearRect(0, 0, W, H);
    if (fgCtx) fgCtx.clearRect(0, 0, W, H);

    bgDoves.forEach(d => { d.update(); d.draw(); });
    fgDoves.forEach(d => { d.update(); d.draw(); });

    _bgDovesAnimId = requestAnimationFrame(tick);
  }
  tick();
}

/* ════════════════════════════════════════════════════════════
   ENVELOPE OPEN
   ════════════════════════════════════════════════════════════ */
function _waitForEnvelopeOpen(config) {
  return new Promise(resolve => {
    const env    = document.getElementById('ribbon-envelope');
    const ribbon = document.getElementById('ribbon-wrap');
    const seal   = document.getElementById('wax-seal');
    const hint   = document.getElementById('tap-hint');

    if (!env) { resolve(); return; }

    let opened = false;

    const open = async () => {
      if (opened) return;

      // Check password first
      const params = new URLSearchParams(window.location.search);
      const skipAuth = params.get('skipAuth') === '1';
      if (!skipAuth && config.login_password && config.login_password.trim() !== '') {
        const unlocked = await _handlePasswordGate(config.login_password, config.login_hint);
        if (!unlocked) return;
      }

      if (window.__playMusic) window.__playMusic();

      opened = true;

      // Hide hint
      if (hint) { hint.style.opacity = '0'; hint.style.transition = 'opacity 0.3s'; }

      env.removeEventListener('click', open);
      env.removeEventListener('keydown', onKey);

      // 1. Untie ribbon
      if (ribbon) ribbon.classList.add('untying');

      // 2. Break seal
      setTimeout(() => {
        if (seal) seal.classList.add('breaking');
      }, 300);

      // 3. (Sparkles removed)

      // 4. Open flap with 3D flip — flowers will erupt from here!
      setTimeout(() => {
        const envBody = env.querySelector('.envelope-body');
        if (envBody) envBody.classList.add('flap-opening');
        env.classList.add('popping'); // little physical "pop" shake
      }, 650);

      // 5. Resolve after flap is open (flowers can now burst)
      setTimeout(resolve, 1250);
    };

    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') open();
    };

    env.addEventListener('click', open);
    env.addEventListener('keydown', onKey);
  });
}

/* ════════════════════════════════════════════════════════════
   RENDER LETTER SKELETON
   ════════════════════════════════════════════════════════════ */
function _renderLetterSkeleton(config) {
  // Clear everything — typewriter will fill in sequence
  _setText('letter-title', '');
  _setText('letter-date', '');
  _setText('letter-to',   '');
  _setText('letter-from', '');
  // Remove has-content so underlines are hidden again
  document.getElementById('letter-to')?.classList.remove('has-content');
  document.getElementById('letter-from')?.classList.remove('has-content');
  // Hide title underline until typed
  document.querySelector('.title-underline')?.classList.remove('is-visible');
  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) bodyEl.innerHTML = '';
}


/* ════════════════════════════════════════════════════════════
   TYPEWRITER EFFECT
   ════════════════════════════════════════════════════════════ */
async function _typewriteLetter(config) {
  const body = document.getElementById('letter-body');
  if (!body) return;

  body.innerHTML = '';

  // ── Skip mode: skipTW=1 param OR _forceSkipTW flag ──
  const params = new URLSearchParams(window.location.search);
  const skipTW = params.get('skipTW') === '1' || config._forceSkipTW === true;

  if (skipTW) {
    // Instant fill — no animation
    const titleEl = document.getElementById('letter-title');
    if (titleEl && config.title) {
      titleEl.textContent = config.title;
      document.querySelector('.title-underline')?.classList.add('is-visible');
    }

    const dateEl = document.getElementById('letter-date');
    if (dateEl) dateEl.textContent = config.date || _formatDate(new Date());

    const salutation = (config.salutation || config.letterTo || config.recipientName || config.to || '').trim() || 'Kamu';
    const toEl = document.getElementById('letter-to');
    if (toEl) {
      toEl.textContent = salutation;
      toEl.classList.add('has-content');
    }

    body.innerHTML = _formatContent(config.letterContent || config.letter_body || '');

    const fromStr = config.from || config.senderName || '';
    const fromEl = document.getElementById('letter-from');
    if (fromEl && fromStr) {
      fromEl.textContent = fromStr;
      fromEl.classList.add('has-content');
    }

    _showSaveContainer(config);
    return;
  }

  // ── 0. Type the title ──
  if (config.title) {
    const titleEl = document.getElementById('letter-title');
    if (titleEl) {
      titleEl.textContent = '';
      await _typewriteSimple('letter-title', config.title, 55);
      // Reveal underline after title is typed
      const tuEl = document.querySelector('.title-underline');
      if (tuEl) tuEl.classList.add('is-visible');
      await _delay(400);
    }
  }

  // ── 1. Type the date ──
  const dateEl = document.getElementById('letter-date');
  if (dateEl) {
    const dateStr = config.date || _formatDate(new Date());
    dateEl.textContent = '';
    await _typewriteSimple('letter-date', dateStr, 45);
    await _delay(300);
  }

  // ── 2. Type salutation ──
  const salutation = (config.salutation || config.letterTo || config.recipientName || config.to || '')
    .trim() || 'Dear Kamu';

  const toEl = document.getElementById('letter-to');
  if (toEl) {
    toEl.textContent = '';
    await _typewriteSimple('letter-to', salutation, 60);
    toEl.classList.add('has-content');
    await _delay(500);
  }

  // ── 3. Type body paragraphs ──
  const raw = (config.letterContent || config.letter_body || '').trim();
  const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const cursor = document.createElement('span');
  cursor.className = 'tw-cursor';
  cursor.setAttribute('aria-hidden', 'true');

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = document.createElement('p');
    body.appendChild(p);
    p.appendChild(cursor);

    for (const ch of paragraphs[pi]) {
      const textNode = document.createTextNode(ch);
      p.insertBefore(textNode, cursor);

      // Auto-scroll
      const scrollEl = document.querySelector('.letter-scroll');
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;

      const delay = (ch === '.' || ch === ',' || ch === '!' || ch === '?')
        ? TW_CHAR_DELAY * 3.5
        : TW_CHAR_DELAY + (Math.random() * 10 - 5);
      await _delay(delay);
    }

    cursor.remove();
    if (pi < paragraphs.length - 1) {
      await _delay(TW_PARA_PAUSE);
      body.appendChild(cursor);
    }
  }

  // ── 4. Type signature ──
  const fromStr = config.from || config.senderName || '';
  if (fromStr) {
    await _delay(800);
    const fromEl = document.getElementById('letter-from');
    if (fromEl) {
      fromEl.textContent = '';
      await _typewriteSimple('letter-from', fromStr, 80);
      fromEl.classList.add('has-content');
    }
  }

  await _delay(600);
  _showSaveContainer(config);
}

async function _typewriteSimple(elId, text, speed) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = '';
  for (const ch of text) {
    el.textContent += ch;
    await _delay(speed);
  }
}

function _formatContent(text) {
  return text.split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, ' ')}</p>`)
    .join('');
}

/* ════════════════════════════════════════════════════════════
   SAVE / DOWNLOAD BUTTON
   ════════════════════════════════════════════════════════════ */
function _showSaveContainer(config) {
  const container = document.getElementById('save-letter-container');
  if (!container) return;

  // Use secretMediaList (same field as airmail/classic)
  const hasMedia = config.secretMediaList && config.secretMediaList.length > 0;
  const memBtn = document.getElementById('btn-secret-memory');
  if (memBtn) memBtn.style.display = hasMedia ? 'inline-flex' : 'none';

  container.style.display = 'block';
  setTimeout(() => { container.style.opacity = '1'; }, 50);

  _initSecretMemory(config);

  const scrollEl = document.querySelector('.letter-scroll');
  if (scrollEl) {
    setTimeout(() => scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }), 600);
  }

  // Auto-open polaroid memory modal (same as classic letter & airmail)
  if (hasMedia && memBtn) {
    setTimeout(() => {
      document.getElementById('letter-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      memBtn.click();
    }, 150);
  }
}

function _initDownloadButton(config) {
  const btn = document.getElementById('btn-save-letter');
  if (!btn) return;

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
        scale: window.devicePixelRatio > 1 ? 1.5 : 2,
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
          clonedDoc.querySelectorAll('*').forEach(el => {
            el.style.animation = 'none';
            el.style.transition = 'none';
          });
        }
      });

      if (btnContainer) btnContainer.style.display = 'block';
      if (scrollWrapper) scrollWrapper.style.overflow = 'auto';

      // Compose 9:16 canvas with Ghibli sky background
      const storyW = 1080;
      const storyH = 1920;
      const story = document.createElement('canvas');
      story.width = storyW;
      story.height = storyH;
      const ctx = story.getContext('2d');

      // Aesthetic static background (matching style.css)
      const computedStyle = getComputedStyle(document.body);
      const bgTop = computedStyle.getPropertyValue('--bg-top').trim() || '#eeeadd';
      const bgBottom = computedStyle.getPropertyValue('--bg-bottom').trim() || '#ded9cb';

      const grad = ctx.createLinearGradient(0, 0, storyW, storyH);
      grad.addColorStop(0, bgTop);
      grad.addColorStop(1, bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, storyW, storyH);

      // Center letter
      const maxW  = storyW * 0.84;
      const maxH  = storyH * 0.78;
      const scale = Math.min(maxW / letterCanvas.width, maxH / letterCanvas.height);
      const dw    = letterCanvas.width  * scale;
      const dh    = letterCanvas.height * scale;
      const dx    = (storyW - dw) / 2;
      const dy    = (storyH - dh) / 2;

      // Drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(60, 40, 20, 0.3)';
      ctx.shadowBlur  = 50;
      ctx.shadowOffsetY = 16;
      ctx.drawImage(letterCanvas, dx, dy, dw, dh);
      ctx.restore();

      // Download
      const a = document.createElement('a');
      a.download = 'secret-garden-letter.png';
      a.href = story.toDataURL('image/png');
      a.click();

    } catch (err) {
      console.error('[Garden] Download failed:', err);
      const btnContainer = document.getElementById('save-letter-container');
      const scrollWrapper = document.querySelector('.letter-scroll');
      if (btnContainer) btnContainer.style.display = 'block';
      if (scrollWrapper) scrollWrapper.style.overflow = 'auto';

      btn.innerHTML = '❌ Failed to save';
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      setTimeout(() => { btn.innerHTML = originalText; }, 3000);
      return;
    }

    btn.innerHTML = '✓ Saved!';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    setTimeout(() => { btn.innerHTML = originalText; }, 2500);
  };

  btn.addEventListener('click', () => {
    if (typeof html2canvas === 'undefined') {
      console.error('[Garden] html2canvas not loaded');
      btn.innerHTML = '❌ Try again';
      setTimeout(() => { btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Save This Letter'; }, 2500);
      return;
    }
    _doCapture();
  });
}

/* ════════════════════════════════════════════════════════════
   SECRET MEMORY MODAL
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   FEATHER BURST (ribbon version of sparkle burst)
   ════════════════════════════════════════════════════════════ */
function _burstFeathers() {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const angle = (i / count) * 360;
    const dist  = 60 + Math.random() * 80;
    const size  = 6 + Math.random() * 8;
    const dur   = 600 + Math.random() * 400;
    el.style.cssText = [
      'position:fixed',
      `left:${window.innerWidth / 2}px`,
      `top:${window.innerHeight / 2}px`,
      `width:${size}px`,
      `height:${size * 2.5}px`,
      'border-radius:50%',
      'background:var(--ribbon-red,#c0392b)',
      'opacity:0.85',
      'pointer-events:none',
      'z-index:99999',
      `transform:rotate(${angle}deg) translateY(-${dist}px)`,
      `transition:transform ${dur}ms cubic-bezier(0.2,0.8,0.4,1), opacity ${dur}ms ease`,
    ].join(';');
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '0';
      el.style.transform = `rotate(${angle}deg) translateY(-${dist + 40}px)`;
    }));
    setTimeout(() => el.remove(), dur + 100);
  }
}

function _initSecretMemory(config) {
  const modal     = document.getElementById('modal-secret-memory');
  const openBtn   = document.getElementById('btn-secret-memory');
  const closeBtn  = document.getElementById('btn-close-memory');
  const prevBtn   = document.getElementById('btn-memory-prev');
  const nextBtn   = document.getElementById('btn-memory-next');
  const frame     = document.getElementById('polaroid-frame');
  const mediaWrap = document.getElementById('polaroid-media-wrap');
  const caption   = document.getElementById('polaroid-caption');
  const counter   = document.getElementById('polaroid-counter');

  const list = config.secretMediaList || [];
  if (!modal || !openBtn || list.length === 0) return;

  let current = 0;

  const render = (idx) => {
    const item = list[idx];
    if (!item) return;

    // Pause any playing video before switching
    const oldVid = mediaWrap.querySelector('video');
    if (oldVid) oldVid.pause();
    mediaWrap.innerHTML = '';

    const src = item.url || item.src || item;
    const isVideo = typeof src === 'string' && /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(src);

    if (isVideo) {
      const vid = document.createElement('video');
      vid.src = src;
      vid.autoplay = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      mediaWrap.appendChild(vid);
      vid.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.caption || `Memory ${idx + 1}`;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      mediaWrap.appendChild(img);
    }

    if (caption) caption.textContent = item.caption || '';

    if (list.length > 1 && counter) {
      counter.textContent = `${idx + 1} / ${list.length}`;
      counter.style.display = 'block';
    }

    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === list.length - 1;

    const tilt = idx % 2 === 0 ? '-2.5deg' : '2deg';
    if (frame) frame.style.transform = `rotate(${tilt})`;
  };

  const open = () => {
    current = 0;
    render(0);
    _burstFeathers();
    modal.setAttribute('aria-hidden', 'false');
    if (list.length > 1) {
      if (prevBtn) prevBtn.style.display = 'flex';
      if (nextBtn) nextBtn.style.display = 'flex';
    }
  };

  const close = () => {
    const vid = mediaWrap.querySelector('video');
    if (vid) vid.pause();
    modal.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  prevBtn.addEventListener('click', () => {
    if (current > 0) { current--; render(current); }
  });

  nextBtn.addEventListener('click', () => {
    if (current < list.length - 1) { current++; render(current); }
  });

  document.addEventListener('keydown', (e) => {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'ArrowLeft'  && current > 0)               { current--; render(current); }
    if (e.key === 'ArrowRight' && current < list.length - 1) { current++; render(current); }
    if (e.key === 'Escape') close();
  });

  let touchStartX = 0;
  modal.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && current < list.length - 1) { current++; render(current); }
    if (dx > 0 && current > 0)               { current--; render(current); }
  });
}

/* ════════════════════════════════════════════════════════════
   MUSIC PLAYER FAB
   (icon only, no track title — same as classic/airmail)
   ════════════════════════════════════════════════════════════ */
function _initMusicPlayer(config) {
  const audio = _audioEl();
  if (!audio) return;

  const playlist = config.playlist || [];
  if (playlist.length === 0) return;

  let trackIdx = 0;
  let playing   = false;

  // Small circular FAB — icon only, no text
  const fab = document.createElement('button');
  fab.id = 'music-player-fab';
  fab.setAttribute('aria-label', 'Toggle music');
  fab.innerHTML = `<span id="music-fab-icon">♪</span><div class="music-slash"></div>`;
  document.body.appendChild(fab);

  const iconEl = fab.querySelector('#music-fab-icon');

  const setTrack = (idx) => {
    trackIdx = idx;
    const t = playlist[idx];
    audio.src = t.src || t.url || t;
    audio.load();
  };

  setTrack(0);

  const tryPlay = async () => {
    try {
      await audio.play();
      playing = true;
      fab.classList.remove('muted');
    } catch (_) { 
      playing = false; 
      fab.classList.add('muted');
    }
  };

  // Auto-play when letter state becomes visible
  window.__playMusic = tryPlay;

  fab.addEventListener('click', async () => {
    if (playing) {
      audio.pause();
      playing = false;
      fab.classList.add('muted');
    } else {
      await tryPlay();
    }
  });

  audio.addEventListener('ended', () => {
    if (trackIdx < playlist.length - 1) {
      setTrack(trackIdx + 1);
      tryPlay();
    } else {
      playing = false;
      fab.classList.add('muted');
    }
  });

  setTimeout(() => fab.classList.add('visible'), 2000);
}

/* ════════════════════════════════════════════════════════════
   PASSWORD GATE
   ════════════════════════════════════════════════════════════ */
function _handlePasswordGate(password, hint) {
  return new Promise(resolve => {
    const gate     = document.getElementById('password-gate');
    const input    = document.getElementById('gate-password-input');
    const btn      = document.getElementById('btn-gate-verify');
    const errorEl  = document.getElementById('gate-error');
    const hintCont = document.getElementById('gate-hint-container');
    const hintText = document.getElementById('gate-hint-text');

    if (!gate) { resolve(true); return; }

    if (hint && hintText && hintCont) {
      hintText.textContent = hint;
      hintCont.classList.remove('hidden');
    }

    gate.classList.remove('hidden');
    gate.style.opacity = '0';
    gate.style.transition = 'opacity 0.4s ease';
    
    // Force reflow to ensure transition applies
    void gate.offsetWidth;
    gate.style.opacity = '1';

    const verify = () => {
      const val = (input.value || '').trim().toLowerCase();
      const expected = (password || '').trim().toLowerCase();
      if (val === expected) {
        gate.style.opacity = '0';
        gate.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { gate.classList.add('hidden'); resolve(true); }, 400);
      } else {
        errorEl.classList.remove('hidden');
        input.value = '';
        input.focus();
        setTimeout(() => errorEl.classList.add('hidden'), 2500);
      }
    };

    btn.addEventListener('click', verify);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
  });
}

/* ════════════════════════════════════════════════════════════
   DEMO CONFIG
   ════════════════════════════════════════════════════════════ */
function _demoConfig() {
  return {
    recipientName: 'Kamu',
    senderName:    'Seseorang yang menyayangimu',
    date:          _formatDate(new Date()),
    letterContent: `Kadang aku bertanya-tanya, apakah angin yang berhembus di tempatmu sama hangatnya dengan yang kurasakan di sini saat memikirkanmu.

Sore ini langit berwarna keemasan, dan aku duduk di dekat jendela sambil menulis surat ini untukmu. Ada banyak hal yang ingin kusampaikan, tapi entah kenapa, yang paling terasa hanyalah rindu yang sederhana.

Semoga surat ini bisa menyampaikan sedikit kehangatan dari tempatku kepadamu. Seperti kiriman kecil yang terbang melintasi langit, membawa pesan yang tak terucapkan.

Kamu selalu ada di dalam pikiranku, di setiap helaan napas dan di setiap detik yang berlalu.

Dengan sepenuh hati,`,
    photos:   [],
    playlist: []
  };
}

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function _normalizeConfig(raw) {
  if (!raw) return {};
  const c = { ...raw };

  if (!c.playlist) {
    if (c.musicUrl) {
      c.playlist = [{ src: c.musicUrl, title: c.musicTitle || '' }];
    } else {
      c.playlist = [];
    }
  }

  if (!c.photos) c.photos = [];
  if (!c.recipientName) c.recipientName = c.to || c.recipient || '';
  if (!c.senderName)    c.senderName    = c.from || c.sender   || '';
  if (!c.letterContent) c.letterContent = c.message || c.content || '';

  return c;
}

function _getTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last.length > 4 && !last.includes('.')) return last;
  return null;
}

function _formatDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _audioEl() {
  return document.getElementById('audio-player');
}

function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}