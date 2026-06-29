/**
 * polaroid-transition.js — Ribbon Theme
 *
 * Self-contained Polaroid Scatter transition.
 * Exported as: window.RibbonPolaroid.play(envRect, config, onSwitchState)
 *
 * Timeline (~10.5s total):
 *  0.0–2.5s  : Polaroid Burst  — foto menyembur dari amplop ke segala arah
 *  2.5–5.5s  : Scatter + Settle — foto jatuh, berserakan di layar
 *  5.5–7.5s  : Heart Moment    — teks "a letter from / for" muncul di tengah
 *  7.5–9.5s  : Sweep Out       — semua foto tersapu diagonal keluar
 *  9.5s      : Resolve         — overlay dihapus, letter sudah muncul
 */

'use strict';

window.RibbonPolaroid = (() => {

  // ── CSS yang diinjeksikan sekali ──────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('_polaroid-styles')) return;
    const style = document.createElement('style');
    style.id = '_polaroid-styles';
    style.textContent = `
      #_polaroid-overlay {
        position: fixed;
        inset: 0;
        z-index: 9998;
        pointer-events: none;
        overflow: hidden;
      }

      ._polaroid-card {
        position: absolute;
        background: #ffffff;
        padding: 10px 10px 40px;
        border-radius: 2px;
        box-shadow:
          0 4px 16px rgba(0,0,0,0.18),
          0 2px 6px rgba(0,0,0,0.12),
          0 0 0 1px rgba(0,0,0,0.04);
        will-change: transform, opacity;
        transform-origin: center center;
        cursor: default;
        user-select: none;
      }

      ._polaroid-img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 1px;
        background: #e8e0d8;
      }

      ._polaroid-caption {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        font-family: 'Caveat', cursive, sans-serif;
        font-size: 13px;
        color: #4a3f35;
        text-align: center;
        letter-spacing: 0.02em;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Seeded RNG ────────────────────────────────────────────────────────────
  function _makeRng(seed = 42) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ── Detect light vs dark theme (reuse same logic from script.js) ──────────
  function _isLightTheme(config, overlayEl) {
    const bgColor = overlayEl ? window.getComputedStyle(overlayEl).backgroundColor : '';
    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    let isLight = false;
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      isLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
    }
    const theme = (config.ribbonTheme || '').toLowerCase();
    const lightThemes = ['crimson', 'rose', 'forest', 'violet', 'parchment', 'sunflower'];
    if (lightThemes.some(t => theme.includes(t))) isLight = true;
    return isLight;
  }

  // ── Main function ─────────────────────────────────────────────────────────
  function play(envRect, config, onSwitchState) {
    return new Promise(resolve => {
      _injectStyles();

      const rng = _makeRng(123);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isMobile = W < 600;

      // Origin = center of envelope flap
      const cx = envRect ? (envRect.left + envRect.width / 2) : W / 2;
      const cy = envRect ? (envRect.top  + envRect.height * 0.35) : H / 2;

      // ── Build photo list — loop if fewer than 8 photos ──────────────────
      const rawList = (config.secretMediaList || []).filter(item => item && item.url);
      if (rawList.length === 0) { resolve(); return; } // safety fallback

      const TARGET_COUNT = 40; // total polaroid particles
      const photoPool = [];
      while (photoPool.length < TARGET_COUNT) {
        rawList.forEach(item => photoPool.push(item));
      }
      const photos = photoPool.slice(0, TARGET_COUNT);

      // ── Polaroid dimensions ──────────────────────────────────────────────
      const PHOTO_W = isMobile ? 110 : 140; // photo area width
      const PHOTO_H = isMobile ? 90  : 115; // photo area height
      const CARD_W  = PHOTO_W + 20;         // +10px each side
      const CARD_H  = PHOTO_H + 50;         // +10px top, +40px caption

      // ── Overlay ──────────────────────────────────────────────────────────
      const overlay = document.createElement('div');
      overlay.id = '_polaroid-overlay';
      document.body.appendChild(overlay);

      // ── Build particles ──────────────────────────────────────────────────
      const particles = photos.map((item, i) => {
        const frac = i / TARGET_COUNT;

        // Fan angle: 270-degree upward arc (same as flower)
        const spread = 270;
        const baseAngleDeg = -90 + (frac - 0.5) * spread;
        const jitter = (rng() - 0.5) * 22;
        const angleRad = ((baseAngleDeg + jitter) * Math.PI) / 180;

        const sidePull = 1 + Math.abs(frac - 0.5) * 1.6;
        const dist = 320 + rng() * 600;
        const xEnd = Math.cos(angleRad) * dist * sidePull + (rng() - 0.5) * 80;
        const yPeak = Math.sin(angleRad) * dist - 60 - rng() * 120;
        // Final "scattered" resting position — spread more naturally across screen
        const xFinal = (rng() - 0.5) * W * 0.9;
        const yFinal = (rng() - 0.55) * H * 0.9;

        const rotFinal = (rng() - 0.5) * 40; // final tilt: -20° to +20°
        const delay    = frac * 1.8 + rng() * 0.2; // burst stagger: 0–2s
        const duration = 1.8 + rng() * 1.4;

        return { i, item, frac, xEnd, yPeak, xFinal, yFinal, rotFinal, delay, duration };
      });

      // ── Create DOM elements ──────────────────────────────────────────────
      const cards = particles.map(p => {
        const card = document.createElement('div');
        card.className = '_polaroid-card';
        card.style.cssText = `
          width: ${CARD_W}px;
          height: ${CARD_H}px;
          left: ${cx - CARD_W / 2}px;
          top:  ${cy - CARD_H / 2}px;
          opacity: 0;
          transform: translate(0,0) scale(0.05) rotate(0deg);
        `;

        // Photo image
        const img = document.createElement('img');
        img.className = '_polaroid-img';
        img.src = p.item.url;
        img.alt = p.item.caption || '';
        img.draggable = false;
        img.decoding  = 'async';
        img.style.cssText = `
          width: ${PHOTO_W}px;
          height: ${PHOTO_H}px;
        `;

        // Caption
        const caption = document.createElement('div');
        caption.className = '_polaroid-caption';
        caption.textContent = p.item.caption || '';

        card.appendChild(img);
        card.appendChild(caption);
        overlay.appendChild(card);

        return { el: card, p };
      });

      // ── PHASE 1: Burst from envelope (0 → 2.5s) ─────────────────────────
      cards.forEach(({ el, p }) => {
        el.animate([
          { transform: `translate(0,0) scale(0.05) rotate(${p.rotFinal * 0.5}deg)`, opacity: 0 },
          { transform: `translate(${p.xEnd * 0.4}px, ${p.yPeak}px) scale(0.75) rotate(${p.rotFinal * 0.8}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${p.xEnd}px, ${p.yPeak + 80}px) scale(0.9) rotate(${p.rotFinal}deg)`, opacity: 1 }
        ], {
          duration: p.duration * 1000,
          delay: p.delay * 1000,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'both'
        });
      });

      // Timing constants
      const BURST_END_MS   = 2500;  // burst selesai
      const SETTLE_MS      = 3200;  // foto settle ke posisi final
      const SWITCH_MS      = SETTLE_MS - 200; // switch ke letter state
      const TEXT_MS        = SETTLE_MS + 400;  // teks muncul
      const TEXT_STAY_MS   = 2800;             // durasi teks terlihat
      const SWEEP_MS       = TEXT_MS + TEXT_STAY_MS; // mulai sweep out
      const RESOLVE_MS     = SWEEP_MS + 2200; // selesai

      // ── PHASE 2: Scatter — drift to final scattered positions ────────────
      setTimeout(() => {
        cards.forEach(({ el, p }) => {
          el.animate([
            { transform: `translate(${p.xEnd}px, ${p.yPeak + 80}px) scale(0.9) rotate(${p.rotFinal}deg)` },
            { transform: `translate(${p.xFinal}px, ${p.yFinal}px) scale(1.0) rotate(${p.rotFinal}deg)` }
          ], {
            duration: 800 + p.i * 10,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'both'
          });
        });
      }, BURST_END_MS);

      // ── Switch state while photos cover screen ────────────────────────────
      setTimeout(() => { if (onSwitchState) onSwitchState(); }, SWITCH_MS);

      // ── PHASE 3: "a letter from / for" card ─────────────────────────────
      setTimeout(() => {
        const rawTo = (config.recipientName || config.to || config.letterTo || config.salutation || '')
          .replace(/^(Dearest|Dear|To|For)[,:\s]+/i, '')
          .replace(/[,;:.]+$/, '')
          .trim();
        const toName   = rawTo;
        const fromName = (config.senderName || config.from || config.sender || '').trim();
        if (!toName && !fromName) return;

        const isLight = _isLightTheme(config, null);
        const introColor = isLight ? 'rgba(90, 55, 30, 0.80)' : 'rgba(255,225,185,0.85)';
        const nameColor  = isLight ? 'rgba(50, 30, 15, 0.95)' : 'rgba(255,240,220,0.98)';
        const dividerBg  = isLight ? 'rgba(100, 60, 20, 0.3)' : 'rgba(255,210,160,0.35)';
        const nameShadow = isLight
          ? '0 1px 12px rgba(255,255,255,0.7)'
          : '0 2px 24px rgba(0,0,0,0.5)';

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
          display: block;
          word-wrap: break-word;
          overflow-wrap: break-word;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, calc(-50% + 15px));
          z-index: 9999;
          text-align: center;
          pointer-events: none;
          opacity: 0;
          filter: blur(4px);
          transition: opacity 1500ms ease, transform 1500ms cubic-bezier(0.2,0.8,0.2,1), filter 1500ms ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          width: 60%;
          max-width: 300px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 12px;
          padding: 20px 24px;
        `;
        card.innerHTML = `
          ${fromName ? `
            <span style="${introStyle} margin-bottom: 6px;">a letter from</span>
            <span style="${nameStyle} margin-bottom: 16px;">${fromName}</span>
          ` : ''}
          <span style="width:32px;height:1px;background:${dividerBg};margin-bottom:16px;display:block;"></span>
          ${toName ? `
            <span style="${introStyle} margin-bottom: 6px;">for</span>
            <span style="${nameStyle}">${toName}</span>
          ` : ''}
        `;

        document.body.appendChild(card);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.filter  = 'blur(0px)';
          card.style.transform = 'translate(-50%, -50%)';
        }));

        setTimeout(() => {
          card.style.opacity   = '0';
          card.style.filter    = 'blur(4px)';
          card.style.transform = 'translate(-50%, -60%)';
          setTimeout(() => card.remove(), 1500);
        }, TEXT_STAY_MS - 500);

      }, TEXT_MS);

      // ── PHASE 4: Sweep Out ───────────────────────────────────────────────
      setTimeout(() => {
        cards.forEach(({ el, p }) => {
          const sweepAngle = Math.PI * 0.5 + (rng() - 0.5) * 1.2;
          const sweepDist  = 2000 + rng() * 800;
          const sweepX = p.xFinal + Math.cos(sweepAngle) * sweepDist;
          const sweepY = p.yFinal + Math.sin(sweepAngle) * sweepDist;
          const stagger = rng() * 400;

          setTimeout(() => {
            el.animate([
              { transform: `translate(${p.xFinal}px, ${p.yFinal}px) scale(1.0) rotate(${p.rotFinal}deg)`, opacity: 1 },
              { transform: `translate(${sweepX}px, ${sweepY}px) scale(0.6) rotate(${p.rotFinal + 30}deg)`, opacity: 0 }
            ], {
              duration: 900 + rng() * 500,
              easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
              fill: 'both'
            });
          }, stagger);
        });
      }, SWEEP_MS);

      // ── Cleanup ──────────────────────────────────────────────────────────
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, RESOLVE_MS);
    });
  }

  return { play };
})();
