/**
 * Birthday Retro — script.js
 * State machine with 5 stages + typing animations + confetti
 */

'use strict';

const WORKER_URL = 'https://birthday-retro.aldoramadhan16.workers.dev';

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  initClock();

  // Check for ?to= parameter → load from Worker
  const params = new URLSearchParams(window.location.search);
  const giftId = params.get('to');
  let cfg = window.BIRTHDAY_CONFIG || {};

  if (giftId) {
    try {
      const res = await fetch(`${WORKER_URL}/get-config?id=${encodeURIComponent(giftId)}&_cb=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        cfg = { ...cfg, ...data };
      }
    } catch (e) {
      console.warn('[Birthday] Failed to load config from Worker:', e);
    }
  }

  initStage1(cfg);
  bindNavigation(cfg);
  initCDPlayer(cfg);
});


/* ═══════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════ */
function initClock() {
  const el = document.getElementById('taskbar-clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30000);
}

/* ═══════════════════════════════════════════════
   STAGE MANAGEMENT
═══════════════════════════════════════════════ */
function goToStage(id) {
  document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  // Update taskbar label
  const labels = {
    'stage-1': '🎂 Birthday Card',
    'stage-2': '❓ Question',
    'stage-3': '📁 gift.exe',
    'stage-4': '🎉 surprise.exe',
    'stage-5': '📝 wishes.txt — Notepad',
    'no-dialog': '⚠️ Error',
  };
  const win = document.getElementById('taskbar-win-label');
  if (win && labels[id]) win.textContent = labels[id];
}

/* ═══════════════════════════════════════════════
   TYPING ENGINE
═══════════════════════════════════════════════ */
function typeText(elementId, text, speed = 65) {
  return new Promise(resolve => {
    const el = document.getElementById(elementId);
    if (!el) return resolve();
    el.textContent = '';
    let i = 0;

    // Add blinking cursor
    const cursor = document.createElement('span');
    cursor.className = 'notepad-cursor';
    el.appendChild(cursor);

    function type() {
      if (i < text.length) {
        // Insert char before cursor
        const char = text[i];
        if (char === '\n') {
          el.insertBefore(document.createElement('br'), cursor);
        } else {
          el.insertBefore(document.createTextNode(char), cursor);
        }
        i++;
        setTimeout(type, speed);
      } else {
        // Remove cursor after done
        setTimeout(() => {
          cursor.remove();
          resolve();
        }, 400);
      }
    }
    type();
  });
}

/* ═══════════════════════════════════════════════
   STAGE 1 — Welcome
═══════════════════════════════════════════════ */
async function initStage1(cfg) {
  const heading = cfg.stage1_heading || 'Happy Birthday!';
  const btn = document.getElementById('btn-next-1');
  const charEl = document.getElementById('stage1-char');

  // Start typing
  await typeText('stage1-text', heading, 80);

  // Show character
  if (charEl) {
    charEl.classList.add('visible');
  }

  // Show button
  if (btn) {
    btn.style.opacity = '1';
    btn.classList.add('fade-in-up');
  }
}

/* ═══════════════════════════════════════════════
   STAGE 2 — Question
═══════════════════════════════════════════════ */
async function initStage2(cfg) {
  const question = cfg.stage2_question || 'i have a surprise for\nyou, wanna see it?';
  await typeText('stage2-text', question, 55);
}

/* ═══════════════════════════════════════════════
   STAGE 4 — Confetti
═══════════════════════════════════════════════ */
function launchConfetti(colors) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const TOTAL = 150;
  const GRAVITY = 0.15;

  for (let i = 0; i < TOTAL; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 4,
      vy: 1 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.15,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
    });
  }

  let frame = 0;
  const MAX_FRAMES = 300; // ~5 seconds at 60fps

  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;
      p.rot += p.rotV;

      // Fade out in last 60 frames
      if (frame > MAX_FRAMES - 60) {
        p.opacity = Math.max(0, p.opacity - 0.017);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (frame < MAX_FRAMES) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  draw();
}

async function initStage4(cfg) {
  const text = cfg.stage4_reveal_text || "it's a surprise!! :D";
  const colors = cfg.confetti_colors || ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bb5'];
  launchConfetti(colors);
  await typeText('stage4-title', text, 50);
}

/* ═══════════════════════════════════════════════
   STAGE 5 — Birthday wishes (Notepad typing)
═══════════════════════════════════════════════ */
async function initStage5(cfg) {
  const wishes = cfg.stage5_wishes || 'Happy birthday! 🎂\n\nWith love ♡';
  await typeText('stage5-message', wishes, 25);

  // Update line/col counter
  const lines = wishes.split('\n').length;
  const cols = wishes.split('\n').pop().length;
  const status = document.getElementById('stage5-status');
  if (status) status.textContent = `Ln ${lines}, Col ${cols}`;

}



/* ═══════════════════════════════════════════════
   NAVIGATION BINDINGS
═══════════════════════════════════════════════ */
function bindNavigation(cfg) {
  // Stage 1 → Stage 2
  // Stage 1 → Stage Music (handled dynamically by CD Player engine)
  // if no music, skips to Stage 2.

  // Stage 2 — Yes → Stage 3
  document.getElementById('btn-yes')?.addEventListener('click', () => {
    goToStage('stage-3');
  });

  // Stage 2 — No → Error dialog
  document.getElementById('btn-no')?.addEventListener('click', () => {
    goToStage('no-dialog');
  });

  // Error dialog → back to Stage 2
  document.getElementById('btn-no-ok')?.addEventListener('click', () => {
    goToStage('stage-2');
  });

  // Stage 3 → Stage 4
  document.getElementById('btn-open-gift')?.addEventListener('click', () => {
    goToStage('stage-4');
    initStage4(cfg);
  });

  // Stage 4 → Stage 5
  document.getElementById('btn-wishes')?.addEventListener('click', () => {
    goToStage('stage-5');
    initStage5(cfg);
  });

}

/* ═══════════════════════════════════════════════
   CD PLAYER ENGINE
═══════════════════════════════════════════════ */
function initCDPlayer(cfg) {
  const playlist = Array.isArray(cfg.playlist) ? cfg.playlist.filter(t => t && (t.url || t.audioUrl || t.src)) : [];
  const audio = document.getElementById('bday-audio');
  let currentIdx = 0;
  
  // If no music, btn-next-1 goes straight to question
  if (playlist.length === 0) {
    document.getElementById('btn-next-1')?.addEventListener('click', () => {
      goToStage('stage-2');
      initStage2(cfg);
    });
    return;
  }

  // Bind btn-next-1 to open CD Player
  document.getElementById('btn-next-1')?.addEventListener('click', () => {
    goToStage('stage-music');
    // Auto play first track if browser allows
    if (audio.paused) playTrack(0);
  });

  // Next button inside CD player goes to question
  document.getElementById('btn-next-music')?.addEventListener('click', () => {
    goToStage('stage-2');
    initStage2(cfg);
  });

  const timeEl = document.getElementById('cd-time');
  const trackEl = document.getElementById('cd-track-num');
  const artistEl = document.getElementById('cd-artist');
  const titleEl = document.getElementById('cd-title');
  const discIcon = document.querySelector('.spinning-cd');

  function playTrack(idx) {
    const t = playlist[idx];
    if (!t) return;
    audio.src = t.url || t.audioUrl || t.src;
    audio.play().catch(()=>{}); // Catch autoplay policy errors
    
    trackEl.textContent = String(idx + 1).padStart(2, '0');
    artistEl.textContent = t.artist || 'Unknown Artist';
    titleEl.textContent = t.title || 'Track ' + (idx + 1);
  }

  audio.addEventListener('play', () => discIcon?.classList.remove('paused'));
  audio.addEventListener('pause', () => discIcon?.classList.add('paused'));
  
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
    if(timeEl) timeEl.textContent = `${m.toString().padStart(2, '0')}:${s}`;
  });

  audio.addEventListener('ended', () => {
    currentIdx = (currentIdx + 1) % playlist.length;
    playTrack(currentIdx);
  });

  document.getElementById('cd-play')?.addEventListener('click', () => { if(audio.paused) audio.play(); else if(!audio.src) playTrack(0); });
  document.getElementById('cd-pause')?.addEventListener('click', () => audio.pause());
  document.getElementById('cd-stop')?.addEventListener('click', () => { audio.pause(); audio.currentTime = 0; });
  document.getElementById('cd-prev')?.addEventListener('click', () => { currentIdx = (currentIdx - 1 + playlist.length) % playlist.length; playTrack(currentIdx); });
  document.getElementById('cd-next')?.addEventListener('click', () => { currentIdx = (currentIdx + 1) % playlist.length; playTrack(currentIdx); });

  // Initialize UI without playing
  const first = playlist[0];
  if(first) {
    trackEl.textContent = '01';
    artistEl.textContent = first.artist || 'Unknown Artist';
    titleEl.textContent = first.title || 'Track 1';
  }
}
