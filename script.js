/**
 * Digital Letter — script.js
 * "Words that stay, long after the moment."
 *
 * Architecture:
 *  - Dual mode: Online (fetch Worker) + Standalone (window.STANDALONE_CONFIG)
 *  - State machine: loading → envelope → letter
 *  - Typewriter effect renders letter body character by character
 *  - Minimal floating music player
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */
const WORKER_URL = 'https://letter-edition.aldoramadhan16.workers.dev';
// TODO: Ganti URL ini setelah deploy worker letter-edition ke Cloudflare

// Typewriter speed (ms per character)
const TW_CHAR_DELAY  = 28;
// Pause between paragraphs (ms)
const TW_PARA_PAUSE  = 550;

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
   THEME
   ════════════════════════════════════════════════════════════ */
const THEME_MAP = {
  'blush-cream':   null,
  'cream':         null,
  'sage':          'sage',
  'dusty-rose':    'dusty-rose',
  'midnight':      'midnight',
  'midnight-blue': 'midnight',
};

function applyTheme(theme) {
  const attr = THEME_MAP.hasOwnProperty(theme) ? THEME_MAP[theme] : null;
  if (attr) {
    document.documentElement.setAttribute('data-theme', attr);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/* ════════════════════════════════════════════════════════════
   INIT — ENTRY POINT
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  showState('loading');

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('to') || params.get('token') || params.get('id') || _getTokenFromPath();

  let config = null;

  if (token) {
    // ── Online Mode ──────────────────────────────────────────
    try {
      const res = await fetch(`${WORKER_URL}/get-config?id=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('not_found');
      config = _normalizeConfig(await res.json());
    } catch (err) {
      console.warn('[Letter] Worker fetch failed:', err.message);
    }
  }

  // ── Standalone / Demo Mode ───────────────────────────────
  if (!config) {
    if (window.STANDALONE_CONFIG && Object.keys(window.STANDALONE_CONFIG).length > 0) {
      config = _normalizeConfig(window.STANDALONE_CONFIG);
    } else {
      config = _demoConfig();
    }
  }

  // ── Maintenance Mode Check ──────────────────────────────
  // If is_active is explicitly false, show maintenance screen
  if (config.is_active === false) {
    showState('maintenance');
    return;
  }

  // Apply theme
  applyTheme(config.theme || 'blush-cream');

  // Prebuffer first song
  if (config.playlist && config.playlist.length > 0) {
    const audio = _audioEl();
    audio.src = config.playlist[0].src || config.playlist[0].url || '';
    audio.load();
  }

  // Render static skeleton (invisible until shown)
  _renderLetterSkeleton(config);

  // Initialize music player early (so it's ready for the iOS gesture trigger)
  _initMusicPlayer(config);

  // Set recipient name on envelope
  const envName = document.getElementById('env-to-name');
  if (envName) {
    let displayName = (config.recipientName || config.to || '')
      .replace(/^(Dearest|Dear|To)[:,\s]+/i, '') // Remove prefixes like Dearest, Dear, etc.
      .replace(/[,;:.]\s*$/, '');                // Remove trailing punctuation
    
    const cleanName = displayName.trim();
    envName.textContent = cleanName ? cleanName : 'kamu';
  }

  // Show envelope — wait for user tap
  showState('envelope');
  await _waitForEnvelopeOpen();

  // Transition to letter
  showState('letter');
  await _delay(500); // Wait for envelope to vanish

  await _typewriteLetter(config);
}

/* ════════════════════════════════════════════════════════════
   URL TOKEN PARSING
   ════════════════════════════════════════════════════════════ */
function _getTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const reserved = ['index.html', 'studio', 'generator', 'admin', 'letter'];
  if (reserved.includes(last.toLowerCase())) return null;
  if (last.includes('.')) return null;
  return last;
}

/* ════════════════════════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════════════════════════ */
function _normalizeConfig(raw) {
  return {
    recipientName: raw.recipientName || raw.to || raw.recipient || '',
    to:            raw.to           || raw.recipient || 'Dear,',
    title:         raw.title        || '',
    from:          raw.from         || raw.sender    || '',
    letter_body:   raw.letter_body  || raw.message   || '',
    date:          raw.date         || '',
    playlist:      Array.isArray(raw.playlist) ? raw.playlist : [],
    theme:         raw.theme        || 'blush-cream',
    show_watermark: raw.show_watermark !== false,
    is_active:      raw.is_active !== false,
    // Dedicated salutation for the letter body
    salutation:    raw.letterTo || raw.salutation || raw.to || 'Dear,'
  };
}

function _demoConfig() {
  return _normalizeConfig({
    to: 'Dear Reader,',
    from: 'Someone',
    letter_body: 'This is a placeholder letter.\n\nAdd a config.js or open via a link with a valid token to see real content.\n\nThis template is designed to hold words that matter — the kind that stay.',
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    playlist: [],
    theme: 'blush-cream',
    show_watermark: true,
  });
}

/* ════════════════════════════════════════════════════════════
   ENVELOPE ANIMATION
   ════════════════════════════════════════════════════════════ */
let _renderLetterTimeStart = 0;

function _waitForEnvelopeOpen() {
  return new Promise(resolve => {
    const scene   = document.getElementById('envelope-scene');
    const wrapper = document.getElementById('envelope-wrapper');
    const hint    = document.getElementById('envelope-hint');

    function openEnvelope() {
      // Prevent double-trigger
      wrapper.removeEventListener('click',   openEnvelope);
      wrapper.removeEventListener('keydown', onKeydown);

      // Hide hint immediately
      if (hint) hint.style.opacity = '0';

      // 1. Add opening class — CSS handles flap + letter-peek animations
      wrapper.classList.add('is-opening');

      // 2. iOS FIX: Start music immediately on user gesture
      _loadTrack(0, true);

      // 3. After flap finishes (~700ms), start exit fade
      setTimeout(() => {
        if (scene) scene.classList.add('is-exit');
      }, 600);

      // 3. Resolve (switch to letter state) after exit animation
      setTimeout(resolve, 1150);
    }

    function onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ') openEnvelope();
    }

    wrapper.addEventListener('click',   openEnvelope);
    wrapper.addEventListener('keydown', onKeydown);
  });
}

/* ════════════════════════════════════════════════════════════
   RENDER SKELETON
   ════════════════════════════════════════════════════════════ */
function _renderLetterSkeleton(config) {
  // Elements exist but are empty for typewriter
  _setText('letter-date',    '');
  _setText('letter-title',   '');
  _setText('letter-to',      '');
  _setText('letter-from',    '');

  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) bodyEl.innerHTML = '';
}

/* ════════════════════════════════════════════════════════════
   TYPEWRITER ENGINE
   ════════════════════════════════════════════════════════════ */
async function _typewriteLetter(config) {
  const params = new URLSearchParams(window.location.search);
  const skipTW = params.get('skipTW') === '1';

  if (skipTW) {
    // ── Instant Render Mode ──────────────────────────────
    if (config.title) _setText('letter-title', config.title);
    if (config.date) _setText('letter-date', config.date);
    if (config.salutation) _setText('letter-to', config.salutation);

    const bodyEl = document.getElementById('letter-body');
    if (bodyEl) {
      const raw = (config.letter_body || '').trim();
      const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      bodyEl.innerHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }

    if (config.from) _setText('letter-from', config.from);
    return;
  }

  // ── Typewriter Mode (Normal) ───────────────────────────
  // 1. Type Title (Top)
  if (config.title) {
    await _typewriteSimple('letter-title', config.title, 80);
    await _delay(600);
  }

  // 1.5 Type Date
  if (config.date) {
    await _typewriteSimple('letter-date', config.date, 60);
    await _delay(300);
  }

  // 2. Type Recipient Name / Salutation
  if (config.salutation) {
    await _typewriteSimple('letter-to', config.salutation, 80);
    await _delay(800);
  }

  // 3. Type Body
  const bodyEl = document.getElementById('letter-body');
  if (bodyEl) {
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
      p.style.opacity    = '1';

      for (let ci = 0; ci < para.length; ci++) {
        const ch = para[ci];
        const textNode = document.createTextNode(ch);
        p.insertBefore(textNode, cursor);

        // Smart autoscroll: only if user is already near the bottom
        const isAtBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 120);
        if (isAtBottom) {
          cursor.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }

        const delay = ch === '.' || ch === ',' || ch === '!' || ch === '?'
          ? TW_CHAR_DELAY * 4 
          : TW_CHAR_DELAY + (Math.random() * 12 - 6);

        await _delay(delay);
      }
      cursor.remove();
      await _delay(TW_PARA_PAUSE);
    }
  }

  // 4. Type Signature (Bottom)
  if (config.from) {
    await _delay(800);
    await _typewriteSimple('letter-from', config.from, 110);
  }
}

async function _typewriteSimple(elId, text, speed) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.display = '';
  el.textContent = '';

  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await _delay(speed);
  }
}

/* ════════════════════════════════════════════════════════════
   MUSIC PLAYER
   ════════════════════════════════════════════════════════════ */
let _currentTrack = 0;
let _playlist     = [];

const _audioEl = () => document.getElementById('audio-player');

function _initMusicPlayer(config) {
  _playlist = (config.playlist || []).filter(t => t.src || t.url);
  if (_playlist.length === 0) return;

  const audio = _audioEl();
  audio.volume = 0.5; // Set backsound volume to 50%
  
  _loadTrack(0, false);

  audio.addEventListener('ended', () => _loadTrack(_currentTrack + 1, true));
}

function _loadTrack(idx, autoplay) {
  const len = _playlist.length;
  if (len === 0) return; // Safety check
  _currentTrack = ((idx % len) + len) % len;

  const track = _playlist[_currentTrack];
  const src   = track.src || track.url || '';

  _setText('mp-title',  track.title  || track.name || 'Untitled');
  _setText('mp-artist', track.artist || '');

  const audio = _audioEl();
  const href  = new URL(src, window.location.href).href;

  if (audio.getAttribute('data-src') !== href) {
    audio.setAttribute('data-src', href);
    audio.src = src;
    audio.load();
  }

  if (autoplay) audio.play().catch(() => {});

  // Reset progress
  const bar = document.getElementById('mp-progress-bar');
  if (bar) bar.style.width = '0%';
}

function _togglePlay() {
  const audio = _audioEl();
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function _setPlayState(playing) {
  const playIcon  = document.querySelector('#mp-play .mp-play-icon');
  const pauseIcon = document.querySelector('#mp-play .mp-pause-icon');
  if (playIcon)  playIcon.classList.toggle('hidden', playing);
  if (pauseIcon) pauseIcon.classList.toggle('hidden', !playing);
}

function _updateProgress() {
  const audio = _audioEl();
  if (!audio.duration) return;
  const bar = document.getElementById('mp-progress-bar');
  if (bar) bar.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
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
