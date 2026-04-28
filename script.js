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
   THEME
   ════════════════════════════════════════════════════════════ */
const THEME_MAP = {
  'blush-cream': null,
  'cream': null,
  'sage': 'sage',
  'dusty-rose': 'dusty-rose',
  'midnight': 'midnight',
  'midnight-blue': 'midnight',
  'crimson': 'crimson',
  'obsidian': 'obsidian',
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
  const token = params.get('to') || params.get('token') || params.get('id') || _getTokenFromPath();

  let config = null;

  // ── 1. Online Mode (Prioritaskan KV jika ada Token/ID di URL) ──
  if (token) {
    try {
      // Tambahkan cache-breaker agar tidak terkena cache browser/HP
      const cacheBuster = `&_cb=${Date.now()}`;
      const res = await fetch(`${WORKER_URL}/get-config?id=${encodeURIComponent(token)}${cacheBuster}`, {
        cache: 'no-store', // Paksa browser ambil data terbaru
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      if (res.ok) {
        config = _normalizeConfig(await res.json());
      }
    } catch (err) {
      console.warn('[Letter] Database fetch failed, falling back...', err.message);
    }
  }

  // ── 2. Standalone Mode (Gunakan config.js jika KV gagal/tidak ada token) ──
  if (!config) {
    if (window.STANDALONE_CONFIG && Object.keys(window.STANDALONE_CONFIG).length > 0) {
      config = _normalizeConfig(window.STANDALONE_CONFIG);
    }
  }

  // ── 3. Fallback / Demo Mode ──
  if (!config) {
    config = _demoConfig();
  }

  // ── Maintenance Mode Check ──────────────────────────────
  // If is_active is explicitly false, show maintenance screen
  if (config.is_active === false) {
    showState('maintenance');
    return;
  }

  // Apply theme (Prioritize URL param for testing/preview)
  const themeOverride = params.get('theme');
  const isPreviewOnly = params.get('previewOnly') === '1';
  const activeTheme = themeOverride || config.theme || 'blush-cream';
  applyTheme(activeTheme);

  // Render static skeleton (invisible until shown)
  _renderLetterSkeleton(config);

  // Initialize music player early (so it's ready for the iOS gesture trigger)
  // Skip jika ini adalah free-user theme preview (?previewOnly=1)
  if (!isPreviewOnly) {
    if (config.playlist && config.playlist.length > 0) {
      const audio = _audioEl();
      audio.src = config.playlist[0].src || config.playlist[0].url || '';
      audio.load();
    }
    _initMusicPlayer(config);
  }

  // Inject activeTheme ke config agar _initDownloadButton pakai tema yang benar
  // (termasuk saat ?theme= override aktif untuk free-user preview)
  config.theme = activeTheme;

  // Jika ?theme= override aktif → ini adalah free-user premium preview
  // Sembunyikan tombol "Simpan Surat Ini" agar user tidak bisa screenshot tema premium
  if (themeOverride) {
    const saveContainer = document.getElementById('save-letter-container');
    const saveBtn = document.getElementById('btn-save-letter');
    if (saveBtn) saveBtn.style.display = 'none';
    if (saveContainer) saveContainer.dataset.noSave = '1'; // flag untuk _initDownloadButton
  }

  // Initialize download button logic
  _initDownloadButton(config);

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
  // Exception: ?openMemory=1 → skip amplop & bunga, langsung ke surat + memori
  const isOpenMemory = params.get('openMemory') === '1';

  if (isOpenMemory) {
    // Langsung render surat (instant, tanpa typewriter)
    config._forceSkipTW = true;
    showState('letter');
    if (window.Particles) window.Particles.init(activeTheme);
    const paper = document.getElementById('letter-paper');
    if (paper) {
      requestAnimationFrame(() => requestAnimationFrame(() => paper.classList.add('is-revealing')));
    }
    await _delay(400);
    await _typewriteLetter(config);
    return;
  }

  showState('envelope');
  await _waitForEnvelopeOpen(config, activeTheme);

  // TUNGGU sampai bunga benar-benar rontok dan hilang
  await new Promise(resolve => {
    window.addEventListener('flowers-gone', resolve, { once: true });
  });

  // Transition to letter
  showState('letter');

  // Trigger Falling Particles
  if (window.Particles) {
    window.Particles.init(activeTheme);
  }

  // Trigger animasi "Rising from Depth" pada kertas surat
  const paper = document.getElementById('letter-paper');
  if (paper) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        paper.classList.add('is-revealing');
      });
    });
  }

  // Tunggu animasi paperRise selesai (1.3 detik) baru mulai mengetik
  await _delay(1350);

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
    to: raw.to || raw.recipient || 'Dear,',
    title: raw.title || '',
    from: raw.from || raw.sender || '',
    letter_body: raw.letter_body || raw.message || '',
    date: raw.date || '',
    playlist: Array.isArray(raw.playlist) ? raw.playlist : [],
    theme: raw.theme || 'blush-cream',
    show_watermark: raw.show_watermark !== false,
    is_active: raw.is_active !== false,
    // Dedicated salutation for the letter body
    salutation: raw.letterTo || raw.salutation || raw.to || 'Dear,',

    // Auth
    login_password: raw.login_password || '',
    login_hint: raw.login_hint || '',
    // Secret Memory — normalise into array of {url, caption}
    secretMediaList: _normalizeMediaList(raw),
  };
}

function _normalizeMediaList(raw) {
  // New format: secretMediaList = [{url, caption}, ...]
  if (Array.isArray(raw.secretMediaList) && raw.secretMediaList.length) {
    return raw.secretMediaList.slice(0, 10).filter(m => m && m.url);
  }
  // Legacy format: single secretMedia + secretCaption
  if (raw.secretMedia || raw.secret_media) {
    return [{ url: raw.secretMedia || raw.secret_media, caption: raw.secretCaption || raw.secret_caption || '' }];
  }
  return [];
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
    secretMediaList: [
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80', caption: 'Us. Always. ♡' },
      { url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80', caption: 'Every moment ♡' },
    ],
  });
}

/* ════════════════════════════════════════════════════════════
   ENVELOPE ANIMATION
   ════════════════════════════════════════════════════════════ */
let _renderLetterTimeStart = 0;

function _waitForEnvelopeOpen(config, activeTheme) {
  return new Promise(resolve => {
    const scene = document.getElementById('envelope-scene');
    const wrapper = document.getElementById('envelope-wrapper');
    const hint = document.getElementById('envelope-hint');

    async function openEnvelope() {
      // 1. Check for Password Gate before anything else
      if (config.login_password && config.login_password.trim() !== '') {
        await _handleAuthentication(config);
      }

      // Prevent double-trigger
      wrapper.removeEventListener('click', openEnvelope);
      wrapper.removeEventListener('keydown', onKeydown);

      // Hide hint immediately
      if (hint) hint.style.opacity = '0';

      // 2. Add opening class — CSS handles flap + letter-peek animations
      wrapper.classList.add('is-opening');

      // 3. Langsung putar lagu saat amplop diklik (seperti sebelumnya)
      _loadTrack(0, true);

      // 4. After flap finishes (~1100ms), start flower transition
      setTimeout(async () => {
        if (scene) scene.classList.add('is-exit');

        // Mulai transisi bunga — pakai activeTheme agar ?theme= override ikut
        await _playFlowerTransition(activeTheme || config.theme);

        // Resolve (switch to letter state) SETELAH seluruh transisi bunga selesai
        resolve();
      }, 1100);
    }

    function onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ') openEnvelope();
    }

    wrapper.addEventListener('click', openEnvelope);
    wrapper.addEventListener('keydown', onKeydown);
  });
}

async function _playFlowerTransition(theme) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.zIndex = '9999';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  let flowerAssets = ['./assets/flower1.png', './assets/flower2.png'];
  if (theme && theme.toLowerCase().includes('midnight')) {
    flowerAssets = ['./assets/flower_midnight1.png', './assets/flower_midnight2.png'];
  } else if (theme && theme.toLowerCase().includes('sage')) {
    flowerAssets = ['./assets/flowers_sage1.png', './assets/flowers_sage2.png'];
  } else if (theme && theme.toLowerCase().includes('crimson')) {
    flowerAssets = ['./assets/crimson1.png', './assets/crimson2.png'];
  } else if (theme && theme.toLowerCase().includes('obsidian')) {
    flowerAssets = ['./assets/obsidian1.png', './assets/obsidian2.png'];
  }

  // === KONFIGURASI KERAPATAN ===
  // Ukuran "slot" untuk setiap bunga — semakin kecil, semakin padat tumpukannya
  const slotSize = 100; // px
  const cols = Math.ceil(window.innerWidth / slotSize) + 2;
  const rows = Math.ceil(window.innerHeight / slotSize) + 2;

  // Buat daftar semua bunga beserta posisi dan delay-nya
  const flowers = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Titik tengah slot + sedikit pengacakan agar tidak terlihat seperti grid
      const x = (c - 0.5) * slotSize + (Math.random() - 0.5) * slotSize * 0.8;
      const y = (r - 0.5) * slotSize + (Math.random() - 0.5) * slotSize * 0.8;

      // Hitung jarak dari pusat layar untuk efek gelombang (ripple)
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      const maxDist = Math.sqrt(Math.pow(cx, 2) + Math.pow(cy, 2));

      // Delay berdasarkan jarak: pusat muncul dulu, tepi belakangan
      // Ripple dipercepat menjadi 1200ms agar gelombangnya terasa pas
      const rippleDelay = (dist / maxDist) * 1200;
      // Tambahkan sedikit noise agar tidak terlalu rapi/mekanis
      const jitter = Math.random() * 200;
      const delay = rippleDelay + jitter;

      flowers.push({ x, y, delay, rippleDelay });
    }
  }

  const totalFlowers = flowers.length;

  return new Promise(resolveTransition => {
    let bloomed = 0;

    flowers.forEach((f, i) => {
      const img = document.createElement('img');
      f.img = img; // Simpan referensi gambar ke objek flower
      img.src = flowerAssets[i % flowerAssets.length];
      img.style.position = 'absolute';

      // Posisi TETAP — bunga tidak bergerak
      img.style.left = `${f.x}px`;
      img.style.top = `${f.y}px`;

      const rotation = Math.random() * 360;
      // Berputar perlahan 180 hingga 360 derajat saat mekar
      f.finalRotation = rotation + (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 180);
      // Skala bervariasi agar tumpukan terlihat natural
      f.finalScale = 1.0 + Math.random() * 1.8;

      // Mulai dari ukuran 0, diam di tempat
      img.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(0)`;
      img.style.opacity = '0';
      img.style.willChange = 'transform, opacity';

      // Animasi membesar dan berputar dibuat lebih pas (1.2 detik)
      img.style.transition = 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.8s ease-in-out';
      img.style.width = '150px';
      img.style.height = 'auto';

      container.appendChild(img);

      setTimeout(() => {
        // Tumbuh (mekar) di tempat tanpa pindah posisi
        img.style.opacity = '1';
        img.style.transform = `translate(-50%, -50%) rotate(${f.finalRotation}deg) scale(${f.finalScale})`;
        bloomed++;

        // Tunggu bunga TERAKHIR (yang paling jauh dari pusat) selesai mekar
        if (bloomed === totalFlowers) {
          // 1. Resolve SEKARANG agar Surat (Kertas) & Lagu muncul di belakang tumpukan bunga
          resolveTransition();

          // 2. Mulai proses gugur setelah hold sejenak
          setTimeout(() => {

            let maxFallDelay = 0;

            // Animasi berguguran bergelombang (dari tengah ke pinggir)
            flowers.forEach((flower) => {
              // Delay gugur menggunakan pola rippleDelay agar pusat runtuh duluan
              const fallDelay = flower.rippleDelay + Math.random() * 100;
              if (fallDelay > maxFallDelay) maxFallDelay = fallDelay;

              setTimeout(() => {
                // Transisi memudar dan melayang turun perlahan
                const fallDuration = 2.0 + Math.random();
                flower.img.style.transition = `transform ${fallDuration}s ease-in, opacity ${fallDuration - 0.5}s ease-in-out`;
                flower.img.style.opacity = '0';

                // Jatuh ke bawah 100-250px dan sedikit berputar tambahan
                const fallY = 100 + Math.random() * 150;
                const extraRotation = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 30);

                flower.img.style.transform = `translate(-50%, calc(-50% + ${fallY}px)) rotate(${flower.finalRotation + extraRotation}deg) scale(${flower.finalScale})`;
              }, fallDelay);
            });

            // Hapus container dan beri sinyal bahwa layar sudah bersih
            // Dipercepat agar surat muncul saat bunga-bunga terakhir masih memudar (overlap yang cantik)
            setTimeout(() => {
              container.remove();
              window.dispatchEvent(new CustomEvent('flowers-gone'));
            }, maxFallDelay + 1200);

          }, 600); // Waktu tahan (hold)
        }
      }, f.delay);
    });
  });
}

/* ════════════════════════════════════════════════════════════
   RENDER SKELETON
   ════════════════════════════════════════════════════════════ */
function _renderLetterSkeleton(config) {
  // Elements exist but are empty for typewriter
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

    // Show buttons instantly
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
      p.style.opacity = '1';

      for (const ch of para) {
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

  // 5. Dramatic pause — let the reader breathe and absorb the last words
  await _delay(1500);

  // 6. Reveal the action buttons
  const saveBtnContainer = document.getElementById('save-letter-container');
  const secretBtn = document.getElementById('btn-secret-memory');

  if (saveBtnContainer) {
    // Only show the secret button if secretMediaList has items
    if (config.secretMediaList && config.secretMediaList.length && secretBtn) {
      secretBtn.style.display = 'inline-flex';
    }
    saveBtnContainer.style.display = 'block';
    setTimeout(() => { saveBtnContainer.style.opacity = '1'; }, 50);
  }

  // 7. Init Secret Memory Modal
  _initSecretMemory(config);

  // 8. Auto-open Secret Memory
  if (config.secretMediaList && config.secretMediaList.length && secretBtn) {
    setTimeout(() => {
      document.getElementById('letter-end')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      secretBtn.click();
    }, 150);
  }
}

async function _typewriteSimple(elId, text, speed) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.display = '';
  el.textContent = '';

  for (const ch of text) {
    el.textContent += ch;
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

    // Stop any playing video first
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
      vid.play().catch(() => { });
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.caption || 'Memory';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:1px;';
      mediaWrap.appendChild(img);
    }

    if (captionEl) captionEl.textContent = item.caption || '';

    // Update counter
    if (list.length > 1 && counterEl) {
      counterEl.textContent = `${idx + 1} / ${list.length}`;
      counterEl.style.display = 'block';
    }

    // Subtle polaroid slight rotation alternation per slide
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

    // Show arrows only when multiple photos
    if (list.length > 1) {
      if (prevBtn) prevBtn.style.display = 'flex';
      if (nextBtn) nextBtn.style.display = 'flex';
    }

    // Staggered: backdrop first, then polaroid rises
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.background = 'rgba(10, 8, 6, 0.92)';
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
    modal.style.background = 'rgba(10, 8, 6, 0)';
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

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) _closeModal();
  });

  // Keyboard navigation
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
// ── Theme background colors for the IG Story canvas ────────────
const _THEME_BG = {
  'sage': ['#dce8da', '#c8d8c6'],
  'dusty-rose': ['#f5dada', '#ead0d0'],
  'midnight': ['#1a1f2e', '#111624'],
  'blush-cream': ['#f5e8d8', '#ecdccb'],
  'crimson': ['#1a050a', '#120308'],
  'obsidian': ['#050a07', '#0a100c'],
  'default': ['#f5e8d8', '#ecdccb'],
};

function _initDownloadButton(config) {
  const btn = document.getElementById('btn-save-letter');
  if (!btn) return;

  // ─── Inject rotate animation CSS (once) ──────────────────────────────────
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
        font-family: var(--font-display, 'DM Serif Display', serif);
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

  // ─── The actual capture + download — UNTOUCHED ───────────────────────────
  const _doCapture = async () => {
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Menyimpan... ⏳';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';

    try {
      const targetEl = document.getElementById('letter-paper');
      const btnContainer = document.getElementById('save-letter-container');
      const scrollWrapper = document.querySelector('.letter-scroll');

      // Hide UI chrome before capture
      if (scrollWrapper) scrollWrapper.style.overflow = 'hidden';
      if (btnContainer) btnContainer.style.display = 'none';

      // ── Step 1: capture the letter at 2× scale ───────────────
      const letterCanvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        onclone: (clonedDoc) => {
          const currentTheme = document.documentElement.getAttribute('data-theme');
          if (currentTheme) {
            clonedDoc.documentElement.setAttribute('data-theme', currentTheme);
            clonedDoc.body.setAttribute('data-theme', currentTheme);
            const paper = clonedDoc.getElementById('letter-paper');
            if (paper) {
              paper.setAttribute('data-theme', currentTheme);
              // CRITICAL: Remove filter/animation that breaks html2canvas text anti-aliasing!
              paper.style.animation = 'none';
              paper.style.filter = 'none';
              paper.style.transform = 'none';
              paper.style.opacity = '1';
            }
          }

          clonedDoc.querySelectorAll('svg path').forEach(el => {
            el.style.animation = 'none';
            el.style.strokeDashoffset = '0';
            el.style.strokeDasharray = 'none';
            el.style.opacity = '1';
          });
          clonedDoc.querySelectorAll('svg circle').forEach(el => {
            el.style.animation = 'none';
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';
          });
          clonedDoc.querySelectorAll('.ornament-top, .letter-title-underline').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
            el.style.animation = 'none';
          });
        }
      });

      // Restore DOM
      if (btnContainer) btnContainer.style.display = 'block';
      if (scrollWrapper) scrollWrapper.style.overflow = 'auto';

      // ── Step 2: compose into a 9:16 IG Story canvas ──────────
      const STORY_W = 1080;
      const STORY_H = 1920;
      const PADDING = 80; // px breathing room on each side

      const story = document.createElement('canvas');
      story.width = STORY_W;
      story.height = STORY_H;
      const ctx = story.getContext('2d');

      // Background gradient (theme-aware)
      const themeKey = (config.theme || 'default').replace('midnight-blue', 'midnight');
      const [bgTop, bgBot] = _THEME_BG[themeKey] || _THEME_BG['default'];
      const grad = ctx.createLinearGradient(0, 0, 0, STORY_H);
      grad.addColorStop(0, bgTop);
      grad.addColorStop(0.5, bgBot);
      grad.addColorStop(1, bgTop);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, STORY_W, STORY_H);

      // Subtle noise texture overlay
      const noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = 200;
      noiseCanvas.height = 200;
      const nctx = noiseCanvas.getContext('2d');
      const imgData = nctx.createImageData(200, 200);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
        imgData.data[i + 3] = 8; // very faint
      }
      nctx.putImageData(imgData, 0, 0);
      const noisePat = ctx.createPattern(noiseCanvas, 'repeat');
      ctx.fillStyle = noisePat;
      ctx.fillRect(0, 0, STORY_W, STORY_H);

      // ── Scale letter to fit with padding ──────────────────────
      const maxW = STORY_W - PADDING * 2;
      const maxH = STORY_H - PADDING * 2;

      const scale = Math.min(maxW / letterCanvas.width, maxH / letterCanvas.height, 1);
      const drawW = Math.round(letterCanvas.width * scale);
      const drawH = Math.round(letterCanvas.height * scale);

      // Center vertically
      const drawX = Math.round((STORY_W - drawW) / 2);
      const drawY = Math.round((STORY_H - drawH) / 2);

      const isDark = ['midnight', 'midnight-blue', 'crimson', 'obsidian'].includes(themeKey);

      // Soft drop shadow behind the letter card
      ctx.save();
      ctx.shadowColor = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(60,30,20,0.18)';
      ctx.shadowBlur = 48;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.restore();

      // Draw the letter
      ctx.drawImage(letterCanvas, drawX, drawY, drawW, drawH);

      // ── Download menggunakan Blob (Jauh Lebih Aman untuk RAM iPhone) ─────────
      await new Promise(resolve => {
        story.toBlob((blob) => {
          if (!blob) {
            console.error('Canvas toBlob failed (Memory limit or empty canvas)');
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const safeName = (config.recipientName || config.to || 'Kamu').replace(/[^a-zA-Z0-9]/g, '_');
          link.download = `Surat_Untuk_${safeName}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Bersihkan memory virtual URL agar tidak nyangkut (Memory Leak di iOS)
          setTimeout(() => URL.revokeObjectURL(url), 500);
          resolve();
        }, 'image/png');
      });

      // PENTING UNTUK iOS: Kosongkan secara paksa pixel buffer canvas
      // Jika tidak dilakukan, menekan donwload 2x / ganti template akan menyebabkan freeze
      letterCanvas.width = 0; letterCanvas.height = 0;
      story.width = 0; story.height = 0;
      noiseCanvas.width = 0; noiseCanvas.height = 0;

    } catch (e) {
      console.error('Screenshot failed:', e);
      alert('Ouch! Gambar gagal disimpan. Anda masih bisa men-screenshot layar ini secara manual.');
    } finally {
      btn.innerHTML = originalText;
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  };

  // ─── Click handler: show modal in portrait, skip in landscape ────────────
  btn.addEventListener('click', async () => {
    if (typeof html2canvas === 'undefined') {
      alert('Sistem sedang memuat.. silakan tunggu sebentar dan coba lagi.');
      return;
    }

    // Already landscape → langsung capture tanpa modal
    if (window.innerWidth > window.innerHeight) {
      await _doCapture();
      return;
    }

    // ── Build modal overlay ───────────────────────────────────────
    const themeKey = (config.theme || 'default').replace('midnight-blue', 'midnight');
    const isDark = ['midnight', 'midnight-blue', 'crimson', 'obsidian'].includes(themeKey);
    const accent = '#c9a96e';
    const bg = isDark ? 'rgba(12,14,26,0.96)' : 'rgba(252,242,232,0.96)';
    const textColor = isDark ? '#f5e8d8' : '#3a2012';

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
   MUSIC PLAYER
   ════════════════════════════════════════════════════════════ */
let _currentTrack = 0;
let _playlist = [];

const _audioEl = () => document.getElementById('audio-player');

function _initMusicPlayer(config) {
  _playlist = (config.playlist || []).filter(t => t.src || t.url);
  if (_playlist.length === 0) return;

  const audio = _audioEl();
  audio.volume = 0.2; // Set backsound volume to 20% (diperlembut)

  _loadTrack(0, false);

  audio.addEventListener('ended', () => _loadTrack(_currentTrack + 1, true));
}

function _loadTrack(idx, autoplay) {
  const len = _playlist.length;
  if (len === 0) return; // Safety check
  _currentTrack = ((idx % len) + len) % len;

  const track = _playlist[_currentTrack];
  const src = track.src || track.url || '';

  _setText('mp-title', track.title || track.name || 'Untitled');
  _setText('mp-artist', track.artist || '');

  const audio = _audioEl();
  const href = new URL(src, window.location.href).href;

  if (audio.getAttribute('data-src') !== href) {
    audio.setAttribute('data-src', href);
    audio.src = src;
    audio.load();
  }

  if (autoplay) audio.play().catch(() => { });

  // Reset progress
  const bar = document.getElementById('mp-progress-bar');
  if (bar) bar.style.width = '0%';
}

function _togglePlay() {
  const audio = _audioEl();
  if (audio.paused) {
    audio.play().catch(() => { });
  } else {
    audio.pause();
  }
}

function _setPlayState(playing) {
  const playIcon = document.querySelector('#mp-play .mp-play-icon');
  const pauseIcon = document.querySelector('#mp-play .mp-pause-icon');
  if (playIcon) playIcon.classList.toggle('hidden', playing);
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
async function _handleAuthentication(config) {
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
    // Reset state
    gateEl.classList.remove('hidden');
    gateEl.style.opacity = '0';
    gateEl.style.display = 'flex';

    // Force reflow for transition
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

        // Shake animation
        card.classList.remove('gate-shake');
        void card.offsetWidth; // Trigger reflow
        card.classList.add('gate-shake');

        // Vibrate if mobile
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