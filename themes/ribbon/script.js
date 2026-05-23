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

  // Handle password gate
  if (config.password) {
    const unlocked = await _handlePasswordGate(config.password, config.passwordHint);
    if (!unlocked) return;
  }

  // Apply Theme Colors
  document.body.setAttribute('data-ribbon-theme', config.ribbonTheme || 'ribbon-crimson');

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

  // Transition to letter
  showState('letter');
  await _delay(300);

  // Trigger paper reveal
  const paper = document.getElementById('letter-paper');
  if (paper) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        paper.classList.add('is-revealing');
      });
    });
  }

  await _delay(1800);
  await _typewriteLetter(config);
}

/* ════════════════════════════════════════════════════════════
   SPARKLE PARTICLES (Removed for static aesthetic)
   ════════════════════════════════════════════════════════════ */

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

    const open = () => {
      if (opened) return;
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

      // 4. Envelope lifts and fades
      setTimeout(() => {
        if (env) {
          env.style.transition = 'transform 0.8s ease, opacity 0.8s ease';
          env.style.transform = 'scale(1.04) translateY(-25px)';
          env.style.opacity = '0';
        }
      }, 650);

      // 5. Resolve
      setTimeout(resolve, 1400);
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

    const fromStr = config.senderName || config.from || '';
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
  const fromStr = config.senderName || config.from || '';
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

  const hasPhotos = config.photos && config.photos.length > 0;
  const memBtn = document.getElementById('btn-secret-memory');
  if (memBtn) memBtn.style.display = hasPhotos ? 'inline-flex' : 'none';

  container.style.display = 'block';
  void container.offsetWidth;
  container.style.opacity = '1';

  if (hasPhotos) _initSecretMemory(config.photos);

  const scrollEl = document.querySelector('.letter-scroll');
  if (scrollEl) {
    setTimeout(() => scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }), 600);
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
      const grad = ctx.createLinearGradient(0, 0, storyW, storyH);
      grad.addColorStop(0, '#eeeadd');
      grad.addColorStop(1, '#ded9cb');
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
function _initSecretMemory(photos) {
  const modal    = document.getElementById('modal-secret-memory');
  const openBtn  = document.getElementById('btn-secret-memory');
  const closeBtn = document.getElementById('btn-close-memory');
  const prevBtn  = document.getElementById('btn-memory-prev');
  const nextBtn  = document.getElementById('btn-memory-next');
  const frame    = document.getElementById('polaroid-frame');
  const mediaWrap= document.getElementById('polaroid-media-wrap');
  const caption  = document.getElementById('polaroid-caption');
  const counter  = document.getElementById('polaroid-counter');

  if (!modal || !openBtn) return;

  let current = 0;

  const render = (idx) => {
    const photo = photos[idx];
    if (!photo) return;

    mediaWrap.innerHTML = '';
    const src = photo.url || photo.src || photo;
    const isVideo = typeof src === 'string' && /\.(mp4|webm|mov)$/i.test(src);

    if (isVideo) {
      const vid = document.createElement('video');
      vid.src = src;
      vid.autoplay = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.controls = false;
      mediaWrap.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = photo.caption || `Photo ${idx + 1}`;
      mediaWrap.appendChild(img);
    }

    caption.textContent = photo.caption || '';
    counter.textContent = `${idx + 1} / ${photos.length}`;

    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === photos.length - 1;

    const tilt = (idx % 2 === 0 ? 1 : -1) * (0.5 + (idx % 3));
    frame.style.transform = `rotate(${tilt}deg)`;
  };

  const open = () => {
    current = 0;
    render(0);
    modal.setAttribute('aria-hidden', 'false');
    _burstSparkles(15);
  };

  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  prevBtn.addEventListener('click', () => {
    if (current > 0) { current--; render(current); }
  });

  nextBtn.addEventListener('click', () => {
    if (current < photos.length - 1) { current++; render(current); }
  });

  document.addEventListener('keydown', (e) => {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'ArrowLeft'  && current > 0)               { current--; render(current); }
    if (e.key === 'ArrowRight' && current < photos.length - 1){ current++; render(current); }
    if (e.key === 'Escape') close();
  });

  let touchStartX = 0;
  modal.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && current < photos.length - 1) { current++; render(current); }
    if (dx > 0 && current > 0)                 { current--; render(current); }
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
  fab.innerHTML = `<span id="music-fab-icon">♪</span>`;
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
      iconEl.textContent = '♪';
    } catch (_) { playing = false; }
  };

  // Auto-play when letter state becomes visible
  const observer = new MutationObserver(() => {
    const letterState = document.getElementById('state-letter');
    if (letterState && !letterState.classList.contains('hidden')) {
      setTimeout(tryPlay, 1200);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  fab.addEventListener('click', async () => {
    if (playing) {
      audio.pause();
      playing = false;
      iconEl.textContent = '♪';
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
      iconEl.textContent = '♪';
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

