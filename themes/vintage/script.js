/**
 * Vintage PNG — script.js
 * Envelope: real PNG images with shake + crossfade open animation.
 * Transition: Flower burst (1:1 identical to ribbon), NO heart, NO name card.
 * Letter: Same paper, typewriter, music player as ribbon.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */
const WORKER_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

const _SCRIPT_BASE = (() => {
  try {
    const src = document.currentScript && document.currentScript.src;
    if (src) return src.substring(0, src.lastIndexOf('/') + 1);
  } catch(e) {}
  return '';
})();

// Flower assets map based on selection
const VINTAGE_FLOWER_ASSETS = {
  'flower1': [
    _SCRIPT_BASE + 'assets/test1.webp',
    _SCRIPT_BASE + 'assets/test1.webp'
  ],
  'flower2': [
    _SCRIPT_BASE + 'assets/test2.webp',
    _SCRIPT_BASE + 'assets/test2.webp'
  ],
  'flower3': [
    _SCRIPT_BASE + 'assets/test3.png',
    _SCRIPT_BASE + 'assets/test3.png'
  ],
  'flower4': [
    _SCRIPT_BASE + 'assets/test4.png',
    _SCRIPT_BASE + 'assets/test4.png'
  ],
  'flower5': [
    _SCRIPT_BASE + 'assets/test5.png',
    _SCRIPT_BASE + 'assets/test5.png'
  ]
};

// Get all selected flowers
function getFlowerSrcs(config) {
  const flowerStr = config.vintageFlower || 'flower1,flower2,flower3,flower4,flower5';
  const flowerTypes = flowerStr.split(',');
  let srcs = [];
  flowerTypes.forEach(t => {
    if (VINTAGE_FLOWER_ASSETS[t]) {
      srcs.push(...VINTAGE_FLOWER_ASSETS[t]);
    }
  });
  if (srcs.length === 0) srcs = VINTAGE_FLOWER_ASSETS['flower1'];
  return srcs;
}

const TW_CHAR_DELAY = 38;
const TW_PARA_PAUSE = 700;

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
      console.warn('[Vintage] Database fetch failed, falling back...', err.message);
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

  // Render static letter skeleton (clears any previous text)
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

  // Set recipient name on envelope tag
  const tagName = document.getElementById('vintage-to-name');
  if (tagName) {
    let displayName = (config.recipientName || config.to || '')
      .replace(/^(Dearest|Dear|To)[:,\s]+/i, '')
      .replace(/[,;:.]$/, '');
    tagName.textContent = displayName.trim() || 'Kamu';
  }

  // ── Handle skipTW / direct-to-letter preview modes ──
  const isSkipTW    = params.get('skipTW') === '1';
  const isOpenMemory = params.get('openMemory') === '1';
  const previewPage  = params.get('previewPage');

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

  // ── Get envelope position for flower burst origin ──
  const envEl   = document.getElementById('vintage-envelope-wrap');
  const envRect = envEl ? envEl.getBoundingClientRect() : null;

  // ── Flower Transition (1:1 ribbon, no heart/name card) ──
  await _playFlowerTransition(envRect, config, () => showState('letter'));

  // ── Reveal letter paper ──
  const paper = document.getElementById('letter-paper');
  if (paper) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        paper.classList.add('is-revealing');
      });
    });
  }

  // ── Wait for paper rise, then start typewriter ──
  await _delay(1600);
  await _typewriteLetter(config);
}

/* ════════════════════════════════════════════════════════════
   ENVELOPE OPEN (PNG crossfade version)
   ════════════════════════════════════════════════════════════ */
function _waitForEnvelopeOpen(config) {
  return new Promise(resolve => {
    const wrap = document.getElementById('vintage-envelope-wrap');
    const hint = document.getElementById('vintage-tap-hint');
    if (!wrap) { resolve(); return; }

    let opened = false;

    const open = async () => {
      if (opened) return;

      // Check password
      const params   = new URLSearchParams(window.location.search);
      const skipAuth = params.get('skipAuth') === '1';
      if (!skipAuth && config.login_password && config.login_password.trim() !== '') {
        const unlocked = await _handlePasswordGate(config.login_password, config.login_hint);
        if (!unlocked) return;
      }

      if (window.__playMusic) window.__playMusic();

      opened = true;

      // Hide tap hint
      if (hint) { hint.style.opacity = '0'; hint.style.transition = 'opacity 0.3s'; }

      // Remove listeners immediately
      wrap.removeEventListener('click', open);
      wrap.removeEventListener('keydown', onKey);

      // Stop the floating animation cleanly
      wrap.style.animation = 'none';

      // 1. Shake animation (0 – 500ms)
      wrap.classList.add('is-shaking');

      // 2. After shake, start crossfade closed → open (~500ms after click)
      setTimeout(() => {
        wrap.classList.remove('is-shaking');
        wrap.classList.add('is-opening'); // CSS handles opacity transition (0.55s)
      }, 500);

      // 3. Resolve after crossfade finishes (500 + 600ms = 1100ms total)
      setTimeout(resolve, 1200);
    };

    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') open(); };

    wrap.addEventListener('click', open);
    wrap.addEventListener('keydown', onKey);
  });
}

/* ════════════════════════════════════════════════════════════
   FLORAL FOUNTAIN TRANSITION
   Identical to ribbon/script.js — EXCEPT:
   - No heart formation block
   - No "a letter from / for" name card block
   - RESOLVE_MS is shorter (vortex + small buffer)
   ════════════════════════════════════════════════════════════ */
function _playFlowerTransition(envRect, config, onSwitchState) {
  return new Promise(resolve => {

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

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const cx = envRect ? (envRect.left + envRect.width / 2)   : W / 2;
    const cy = envRect ? (envRect.top  + envRect.height * 0.35) : H / 2;
    const COUNT = 300;

    // ── Preload images ───────────────────────────────────────────
    const srcs = getFlowerSrcs(config);
    srcs.forEach(src => { const img = new Image(); img.src = src; });

    // ── Seeded RNG ───────────────────────────────────────────────
    let seed = 42;
    const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

    // ── Build particles ──────────────────────────────────────────
    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const frac = i / COUNT;

      const spread = 240;
      const baseAngleDeg = -90 + (frac - 0.5) * spread;
      const jitter = (rng() - 0.5) * 18;
      const angleRad = ((baseAngleDeg + jitter) * Math.PI) / 180;

      const sidePull = 1 + Math.abs(frac - 0.5) * 1.8;
      const dist  = 350 + rng() * 650;
      const xEnd  = Math.cos(angleRad) * dist * sidePull + (rng() - 0.5) * 100;
      const yPeak = Math.sin(angleRad) * dist - 50 - rng() * 150;
      const yFinal = yPeak + 400 + rng() * 650;

      const size       = 240 + rng() * 240;
      const finalScale = 1.0 + rng() * 0.6;

      const rotateDir   = rng() > 0.5 ? 1 : -1;
      const rotateSpeed = (6 + rng() * 10).toFixed(2);

      const delay    = frac * 1.6 + rng() * 0.15;
      const duration = 2.0 + rng() * 1.6;

      particles.push({ i, frac, xEnd, yPeak, yFinal, size, finalScale, rotateDir, rotateSpeed, delay, duration });
    }

    // ── Create & animate DOM elements ───────────────────────────
    const els = particles.map(p => {
      const wrapper = document.createElement('div');
      wrapper.className = '_floral-img';

      const half = p.size / 2;
      wrapper.style.cssText = `
        position:absolute;
        width:${p.size}px;
        left:${cx - half}px;
        top:${cy - half}px;
        opacity:0;
        transform:translate(0,0) scale(0.12);
        will-change:transform,opacity;
      `;

      const img = document.createElement('img');
      const srcs = getFlowerSrcs(config);
      img.src = srcs[p.i % srcs.length];
      img.draggable = false;
      img.decoding  = 'async';
      img.style.cssText = `
        width:100%;
        height:auto;
        display:block;
        animation:${p.rotateDir > 0 ? '_floral-spin' : '_floral-spin-rev'} ${p.rotateSpeed}s linear ${p.delay}s infinite;
        will-change:transform;
      `;

      wrapper.appendChild(img);
      overlay.appendChild(wrapper);

      return { el: wrapper, p };
    });

    // ── Trigger burst ────────────────────────────────────────────
    els.forEach(({ el, p }) => {
      el.animate([
        { transform: `translate(0px, 0px) scale(0.12)`, opacity: 0 },
        { transform: `translate(${p.xEnd * 0.4}px, ${p.yPeak}px) scale(0.85)`, opacity: 1, offset: 0.38 },
        { transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale})`, opacity: 1 }
      ], {
        duration: p.duration * 1000,
        delay:    p.delay * 1000,
        easing:   'ease-out',
        fill:     'both'
      });
    });

    // ── Timing ───────────────────────────────────────────────────
    const SETTLE_MS  = 3600;
    const VORTEX_MS  = SETTLE_MS + 1200;  // 1.2s pause before vortex
    const RESOLVE_MS = VORTEX_MS + 2400;  // vortex sweep (~2s) + 400ms buffer

    // Switch page state while flowers cover screen
    setTimeout(() => { if (onSwitchState) onSwitchState(); }, SETTLE_MS - 200);

    // ── Vortex sweep ─────────────────────────────────────────────
    setTimeout(() => {
      els.forEach(({ el, p }) => {
        const angle = Math.atan2(p.yFinal, p.xEnd);
        const swirlAngle = angle + (Math.PI / 2);
        const dist = 2500;

        const vortexX = p.xEnd + Math.cos(swirlAngle) * dist + (Math.random() - 0.5) * 500;
        const vortexY = p.yFinal + Math.sin(swirlAngle) * dist + (Math.random() - 0.5) * 500;

        const staggerDelay  = Math.random() * 400;
        const sweepDuration = 1000 + Math.random() * 600;

        setTimeout(() => {
          el.animate([
            { transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale}) rotate(0deg)` },
            { transform: `translate(${vortexX}px, ${vortexY}px) scale(${p.finalScale}) rotate(360deg)` }
          ], {
            duration: sweepDuration,
            easing:   'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
            fill:     'both'
          });
        }, staggerDelay);
      });
    }, VORTEX_MS);

    // ── Cleanup & resolve ─────────────────────────────────────────
    setTimeout(() => {
      overlay.remove();
      resolve();
    }, RESOLVE_MS);
  });
}

/* ════════════════════════════════════════════════════════════
   RENDER LETTER SKELETON
   ════════════════════════════════════════════════════════════ */
function _renderLetterSkeleton(config) {
  _setText('letter-title', '');
  _setText('letter-date', '');
  _setText('letter-to', '');
  _setText('letter-from', '');
  document.getElementById('letter-to')?.classList.remove('has-content');
  document.getElementById('letter-from')?.classList.remove('has-content');
  document.querySelector('.title-underline')?.classList.remove('is-visible');
  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) bodyEl.innerHTML = '';
  const footerFlower = document.getElementById('footer-flower');
  if (footerFlower) {
    const srcs = getFlowerSrcs(config);
    footerFlower.src = srcs[0];
  }
}

/* ════════════════════════════════════════════════════════════
   TYPEWRITER EFFECT
   ════════════════════════════════════════════════════════════ */
async function _typewriteLetter(config) {
  const body = document.getElementById('letter-body');
  if (!body) return;

  body.innerHTML = '';

  const params = new URLSearchParams(window.location.search);
  const skipTW = params.get('skipTW') === '1' || config._forceSkipTW === true;

  if (skipTW) {
    const titleEl = document.getElementById('letter-title');
    if (titleEl && config.title) {
      titleEl.textContent = config.title;
      document.querySelector('.title-underline')?.classList.add('is-visible');
    }
    const dateEl = document.getElementById('letter-date');
    if (dateEl) dateEl.textContent = config.date || _formatDate(new Date());

    const salutation = (config.salutation || config.letterTo || config.recipientName || config.to || '').trim() || 'Kamu';
    const toEl = document.getElementById('letter-to');
    if (toEl) { toEl.textContent = salutation; toEl.classList.add('has-content'); }

    body.innerHTML = _formatContent(config.letterContent || config.letter_body || '');

    const fromStr = config.from || config.senderName || '';
    const fromEl  = document.getElementById('letter-from');
    if (fromEl && fromStr) { fromEl.textContent = fromStr; fromEl.classList.add('has-content'); }

    _showSaveContainer(config);
    return;
  }

  // ── 0. Type the title ──
  if (config.title) {
    const titleEl = document.getElementById('letter-title');
    if (titleEl) {
      titleEl.textContent = '';
      await _typewriteSimple('letter-title', config.title, 55);
      document.querySelector('.title-underline')?.classList.add('is-visible');
      await _delay(400);
    }
  }

  // ── 1. Type the date ──
  const dateEl = document.getElementById('letter-date');
  if (dateEl) {
    dateEl.textContent = '';
    await _typewriteSimple('letter-date', config.date || _formatDate(new Date()), 45);
    await _delay(300);
  }

  // ── 2. Type salutation ──
  const salutation = (config.salutation || config.letterTo || config.recipientName || config.to || '').trim() || 'Dear Kamu';
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

  const hasMedia = config.secretMediaList && config.secretMediaList.length > 0;
  const memBtn   = document.getElementById('btn-secret-memory');
  if (memBtn) memBtn.style.display = hasMedia ? 'inline-flex' : 'none';

  container.style.display = 'block';
  setTimeout(() => { container.style.opacity = '1'; }, 50);

  _initSecretMemory(config);

  const scrollEl = document.querySelector('.letter-scroll');
  if (scrollEl) {
    setTimeout(() => scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }), 600);
  }

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
      const targetEl     = document.getElementById('letter-paper');
      const btnContainer = document.getElementById('save-letter-container');
      const scrollWrapper = document.querySelector('.letter-scroll');

      if (scrollWrapper) scrollWrapper.style.overflow = 'hidden';
      if (btnContainer)  btnContainer.style.display   = 'none';

      const letterCanvas = await html2canvas(targetEl, {
        scale: window.devicePixelRatio > 1 ? 1.5 : 2,
        useCORS: true,
        backgroundColor: null,
        onclone: (clonedDoc) => {
          const paper = clonedDoc.getElementById('letter-paper');
          if (paper) {
            paper.style.animation  = 'none';
            paper.style.filter     = 'none';
            paper.style.transform  = 'none';
            paper.style.opacity    = '1';
          }
          clonedDoc.querySelectorAll('*').forEach(el => {
            el.style.animation  = 'none';
            el.style.transition = 'none';
          });
        }
      });

      if (btnContainer)  btnContainer.style.display  = 'block';
      if (scrollWrapper) scrollWrapper.style.overflow = 'auto';

      // Compose 9:16 story canvas
      const storyW = 1080, storyH = 1920;
      const story  = document.createElement('canvas');
      story.width  = storyW;
      story.height = storyH;
      const ctx = story.getContext('2d');

      const computedStyle = getComputedStyle(document.body);
      const bgTop    = computedStyle.getPropertyValue('--bg-top').trim()    || '#f5f0e8';
      const bgBottom = computedStyle.getPropertyValue('--bg-bottom').trim() || '#e8e0d0';

      const grad = ctx.createLinearGradient(0, 0, storyW, storyH);
      grad.addColorStop(0, bgTop);
      grad.addColorStop(1, bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, storyW, storyH);

      const maxW  = storyW * 0.84;
      const maxH  = storyH * 0.78;
      const scale = Math.min(maxW / letterCanvas.width, maxH / letterCanvas.height);
      const dw = letterCanvas.width  * scale;
      const dh = letterCanvas.height * scale;
      const dx = (storyW - dw) / 2;
      const dy = (storyH - dh) / 2;

      ctx.save();
      ctx.shadowColor   = 'rgba(60,40,20,0.3)';
      ctx.shadowBlur    = 50;
      ctx.shadowOffsetY = 16;
      ctx.drawImage(letterCanvas, dx, dy, dw, dh);
      ctx.restore();

      const a = document.createElement('a');
      a.download = 'vintage-letter.png';
      a.href = story.toDataURL('image/png');
      a.click();

    } catch (err) {
      console.error('[Vintage] Download failed:', err);
      const btnContainer  = document.getElementById('save-letter-container');
      const scrollWrapper = document.querySelector('.letter-scroll');
      if (btnContainer)  btnContainer.style.display  = 'block';
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
      console.error('[Vintage] html2canvas not loaded');
      btn.innerHTML = '❌ Try again';
      setTimeout(() => { btn.innerHTML = originalText; }, 2500);
      return;
    }
    _doCapture();
  });
}

/* ════════════════════════════════════════════════════════════
   FEATHER BURST (for secret memory modal open)
   ════════════════════════════════════════════════════════════ */
function _burstFeathers() {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const el    = document.createElement('div');
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
      el.style.opacity   = '0';
      el.style.transform = `rotate(${angle}deg) translateY(-${dist + 40}px)`;
    }));
    setTimeout(() => el.remove(), dur + 100);
  }
}

/* ════════════════════════════════════════════════════════════
   SECRET MEMORY MODAL
   ════════════════════════════════════════════════════════════ */
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

    const oldVid = mediaWrap.querySelector('video');
    if (oldVid) oldVid.pause();
    mediaWrap.innerHTML = '';

    const src     = item.url || item.src || item;
    const isVideo = typeof src === 'string' && /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(src);

    if (isVideo) {
      const vid = document.createElement('video');
      vid.src = src; vid.autoplay = true; vid.loop = true;
      vid.muted = true; vid.playsInline = true;
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

  prevBtn.addEventListener('click', () => { if (current > 0) { current--; render(current); } });
  nextBtn.addEventListener('click', () => { if (current < list.length - 1) { current++; render(current); } });

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
   ════════════════════════════════════════════════════════════ */
function _initMusicPlayer(config) {
  const audio = _audioEl();
  if (!audio) return;

  const playlist = config.playlist || [];
  if (playlist.length === 0) return;

  let trackIdx = 0;
  let playing  = false;

  const fab = document.createElement('button');
  fab.id = 'music-player-fab';
  fab.setAttribute('aria-label', 'Toggle music');
  fab.innerHTML = `<span id="music-fab-icon">♪</span><div class="music-slash"></div>`;
  document.body.appendChild(fab);

  const setTrack = (idx) => {
    trackIdx = idx;
    const t  = playlist[idx];
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
    gate.style.opacity    = '0';
    gate.style.transition = 'opacity 0.4s ease';
    void gate.offsetWidth;
    gate.style.opacity = '1';

    const verify = () => {
      const val      = (input.value || '').trim().toLowerCase();
      const expected = (password || '').trim().toLowerCase();
      if (val === expected) {
        gate.style.opacity    = '0';
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

  if (!c.photos)        c.photos        = [];
  if (!c.recipientName) c.recipientName = c.to  || c.recipient || '';
  if (!c.senderName)    c.senderName    = c.from || c.sender   || '';
  if (!c.letterContent) c.letterContent = c.message || c.content || '';

  return c;
}

function _getTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last  = parts[parts.length - 1];
  if (last && last.length > 4 && !last.includes('.')) return last;
  return null;
}

function _formatDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _audioEl() { return document.getElementById('audio-player'); }

function _delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
