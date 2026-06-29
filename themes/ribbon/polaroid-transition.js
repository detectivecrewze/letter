/**
 * polaroid-transition.js — Ribbon Theme
 *
 * Self-contained Polaroid Scatter transition.
 * Exported as: window.RibbonPolaroid.play(envRect, config, onSwitchState)
 *
 * Phase 1  (0–3.6s) : Polaroid Burst — foto menyembur dari amplop ke atas
 * Phase 2  (4.0–5.6s): Vortex — polaroid tersapu spiral keluar layar
 * Phase 3  (5.6–10s) : Flower Heart — bunga membentuk hati (IDENTIK dengan flower burst)
 * Phase 3b (6.1–9.4s): Teks "a letter from / for" muncul
 * Phase 4  (10.0s)   : Resolve
 */

'use strict';

// Compute base path once at parse time (document.currentScript only works then)
const _POL_BASE = (() => {
  try {
    const src = document.currentScript && document.currentScript.src;
    if (src) return src.substring(0, src.lastIndexOf('/') + 1);
  } catch (e) {}
  return '/themes/ribbon/';
})();

window.RibbonPolaroid = (() => {

  // ── Flower sources (same assets as script.js) ─────────────────────────────
  const FLOWER_SRCS = [
    _POL_BASE + 'assets/flower_daisy-removebg-preview.png',
    _POL_BASE + 'assets/flower_hydrangea-removebg-preview.png',
    _POL_BASE + 'assets/flower_rose-removebg-preview.png',
    _POL_BASE + 'assets/flower_sunflower-removebg-preview.png',
  ];

  // ── Inject CSS once ────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('_polaroid-styles')) return;
    const style = document.createElement('style');
    style.id = '_polaroid-styles';
    style.textContent = `
      #_polaroid-overlay {
        position: fixed; inset: 0;
        z-index: 9998;
        pointer-events: none;
        overflow: hidden;
      }

      ._pol-card-wrapper {
        position: absolute;
        will-change: transform, opacity;
        transform-origin: center center;
      }

      ._pol-card-inner {
        width: 100%; height: 100%;
        background: #ffffff;
        padding: 10px 10px 42px 10px;
        border-radius: 2px;
        box-shadow:
          0 8px 28px rgba(0,0,0,0.22),
          0 3px 8px rgba(0,0,0,0.14),
          0 0 0 1px rgba(0,0,0,0.04);
        transform-origin: center center;
      }

      ._pol-card-inner img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #e8e0d8;
        border-radius: 1px;
      }

      ._pol-caption {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Caveat', cursive, sans-serif;
        font-size: 13px;
        color: #4a3f35;
        text-align: center;
        padding: 0 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @keyframes _pol-float {
        0%   { transform: translateY(-6px) rotate(-3deg); }
        100% { transform: translateY(6px) rotate(3deg); }
      }
      @keyframes _pol-spin     { to { transform: rotate(360deg);  } }
      @keyframes _pol-spin-rev { to { transform: rotate(-360deg); } }
      @keyframes _floral-spin     { to { transform: rotate(360deg);  } }
      @keyframes _floral-spin-rev { to { transform: rotate(-360deg); } }
    `;
    document.head.appendChild(style);
  }

  // ── Seeded RNG ─────────────────────────────────────────────────────────────
  function _makeRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  function play(envRect, config, onSwitchState) {
    return new Promise(resolve => {
      _injectStyles();

      const rng = _makeRng(42);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isMobile = W < 600;

      const cx = envRect ? (envRect.left + envRect.width / 2) : W / 2;
      const cy = envRect ? (envRect.top  + envRect.height * 0.35) : H / 2;

      // ── Build photo pool — loop to reach COUNT ────────────────────────────
      const rawList = (config.secretMediaList || []).filter(item => item && item.url);
      if (rawList.length === 0) { resolve(); return; }

      const COUNT = 150;
      const pool  = [];
      while (pool.length < COUNT) rawList.forEach(item => pool.push(item));
      const photos = pool.slice(0, COUNT);

      // ── Polaroid card dimensions (BIGGER) ────────────────────────────────
      // Photo area: 170x135px on desktop, 125x100px on mobile
      const PHOTO_W = isMobile ? 125 : 170;
      const PHOTO_H = isMobile ? 100 : 135;
      const CARD_W  = PHOTO_W + 20;       // 10px each side
      const CARD_H  = PHOTO_H + 10 + 42; // 10px top + 42px caption bottom

      // ── Overlay ───────────────────────────────────────────────────────────
      const overlay = document.createElement('div');
      overlay.id = '_polaroid-overlay';
      document.body.appendChild(overlay);

      // ── Build particles — same math as _playFlowerTransition ─────────────
      const particles = photos.map((item, i) => {
        const frac = i / COUNT;

        // 200° upward fan
        const spread       = 200;
        const baseAngleDeg = -90 + (frac - 0.5) * spread;
        const jitter       = (rng() - 0.5) * 18;
        const angleRad     = ((baseAngleDeg + jitter) * Math.PI) / 180;

        const sidePull   = 1 + Math.abs(frac - 0.5) * 1.8;
        const dist       = 350 + rng() * 650;
        const xEnd       = Math.cos(angleRad) * dist * sidePull + (rng() - 0.5) * 100;
        const yPeak      = Math.sin(angleRad) * dist - 50 - rng() * 150;
        const yFinal     = yPeak + 400 + rng() * 650; // gravity

        const finalScale = 1.0 + rng() * 0.5;
        const rotFinal   = (rng() - 0.5) * 32; // final tilt
        
        // Sway amount during burst: overshoot the rotation by up to 40 degrees
        const swayAmount = (rng() > 0.5 ? 1 : -1) * (20 + rng() * 20); 

        const delay      = frac * 1.6 + rng() * 0.15;
        const duration   = 2.0 + rng() * 1.6;

        return { i, item, frac, xEnd, yPeak, yFinal, finalScale, rotFinal, swayAmount, delay, duration };
      });

      // ── Create DOM elements ───────────────────────────────────────────────
      const cards = particles.map(p => {
        const wrapper = document.createElement('div');
        wrapper.className = '_pol-card-wrapper';
        wrapper.style.cssText = `
          width:${CARD_W}px; height:${CARD_H}px;
          left:${cx - CARD_W / 2}px; top:${cy - CARD_H / 2}px;
          opacity:0;
          transform:translate(0,0) scale(0.12) rotate(${p.rotFinal * 0.3}deg);
        `;

        const inner = document.createElement('div');
        inner.className = '_pol-card-inner';
        // Random float animation timing
        const floatDelay = -(Math.random() * 4);
        const floatDur   = 3 + Math.random() * 2;
        // Start the float animation slightly after the burst
        const startFloat = p.delay + p.duration;
        // We set the animation directly via inline style
        inner.style.animation = `_pol-float ${floatDur}s ease-in-out ${floatDelay}s infinite alternate`;

        const img = document.createElement('img');
        img.src       = p.item.url;
        img.alt       = p.item.caption || '';
        img.draggable = false;
        img.decoding  = 'async';
        img.width     = PHOTO_W;
        img.height    = PHOTO_H;

        const cap = document.createElement('div');
        cap.className   = '_pol-caption';
        cap.textContent = p.item.caption || '';

        inner.appendChild(img);
        inner.appendChild(cap);
        wrapper.appendChild(inner);
        overlay.appendChild(wrapper);

        return { el: wrapper, p };
      });

      // ── PHASE 1: Burst — identical 3-keyframe parabola as flowers ─────────
      cards.forEach(({ el, p }) => {
        el.animate([
          {
            transform: `translate(0px, 0px) scale(0.12) rotate(${p.rotFinal * 0.3}deg)`,
            opacity: 0
          },
          {
            transform: `translate(${p.xEnd * 0.4}px, ${p.yPeak}px) scale(0.78) rotate(${p.rotFinal + p.swayAmount}deg)`,
            opacity: 1,
            offset: 0.38
          },
          {
            transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale}) rotate(${p.rotFinal}deg)`,
            opacity: 1
          }
        ], {
          duration: p.duration * 1000,
          delay:    p.delay   * 1000,
          easing:   'ease-out',
          fill:     'both'
        });
      });

      // ── Timing — mirrors _playFlowerTransition ────────────────────────────
      const SETTLE_MS  = 3600;
      const VORTEX_MS  = SETTLE_MS + 2500; // Stay longer on screen before sweeping out
      const HEART_MS   = VORTEX_MS + 2000;
      const HEART_STAY = 4500;
      const RESOLVE_MS = HEART_MS + HEART_STAY + 800;

      // Switch state while polaroids cover screen
      setTimeout(() => { if (onSwitchState) onSwitchState(); }, SETTLE_MS - 200);

      // ── PHASE 2: Vortex — identical to flower vortex ──────────────────────
      setTimeout(() => {
        cards.forEach(({ el, p }) => {
          const angle      = Math.atan2(p.yFinal, p.xEnd);
          const swirlAngle = angle + Math.PI / 2;
          const dist2      = 2500;
          const vortexX    = p.xEnd   + Math.cos(swirlAngle) * dist2 + (Math.random() - 0.5) * 500;
          const vortexY    = p.yFinal + Math.sin(swirlAngle) * dist2 + (Math.random() - 0.5) * 500;
          const stagger    = Math.random() * 400;
          const dur        = 1000 + Math.random() * 600;

          setTimeout(() => {
            el.animate([
              {
                transform: `translate(${p.xEnd}px, ${p.yFinal}px) scale(${p.finalScale}) rotate(${p.rotFinal}deg)`
              },
              {
                transform: `translate(${vortexX}px, ${vortexY}px) scale(${p.finalScale}) rotate(${p.rotFinal + 360}deg)`
              }
            ], {
              duration: dur,
              easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
              fill: 'both'
            });
          }, stagger);
        });
      }, VORTEX_MS);

      // ── PHASE 3a: "a letter from / for" text card ─────────────────────────
      const TEXT_MS     = HEART_MS + 500;
      const TEXT_OUT_MS = HEART_MS + HEART_STAY - 600;

      setTimeout(() => {
        const rawTo = (config.recipientName || config.to || config.letterTo || config.salutation || '')
          .replace(/^(Dearest|Dear|To|For)[,:\s]+/i, '')
          .replace(/[,;:.]+$/, '')
          .trim();
        const toName   = rawTo;
        const fromName = (config.senderName || config.from || config.sender || '').trim();
        if (!toName && !fromName) return;

        const theme       = (config.ribbonTheme || '').toLowerCase();
        const lightThemes = ['crimson', 'rose', 'forest', 'violet', 'parchment', 'sunflower'];
        const isLight     = lightThemes.some(t => theme.includes(t));

        const introColor = isLight ? 'rgba(90,55,30,0.75)'  : 'rgba(255,225,185,0.8)';
        const nameColor  = isLight ? 'rgba(50,30,15,0.92)'  : 'rgba(255,240,220,0.95)';
        const dividerBg  = isLight ? 'rgba(100,60,20,0.3)'  : 'rgba(255,210,160,0.35)';
        const nameShadow = isLight
          ? '0 1px 8px rgba(255,255,255,0.5)'
          : '0 2px 20px rgba(0,0,0,0.4)';

        const S_val = Math.min(13, W * 0.028);
        const heartCenterY = cy + (2.35 * S_val) - 30;

        const card = document.createElement('div');
        card.style.cssText = `
          position:absolute; top:${heartCenterY}px; left:${cx}px;
          transform:translate(-50%, calc(-50% + 15px));
          z-index:200; text-align:center; pointer-events:none;
          opacity:0; filter:blur(4px);
          transition:opacity 1500ms ease, transform 1500ms cubic-bezier(0.2,0.8,0.2,1), filter 1500ms ease;
          display:flex; flex-direction:column; align-items:center; gap:0;
          width:60%; max-width:300px;
        `;

        const iS = `font-family:'Cormorant Garamond','Georgia',serif;font-style:italic;
          text-transform:lowercase;letter-spacing:0.12em;line-height:1.3;
          font-size:clamp(12px,1.8vw,15px);color:${introColor};font-weight:400;display:block;`;
        const nS = `font-family:'Cormorant Garamond','Georgia',serif;letter-spacing:0.15em;
          text-transform:uppercase;line-height:1.3;text-shadow:${nameShadow};
          font-size:clamp(14px,2.5vw,22px);color:${nameColor};font-weight:600;
          display:block;word-wrap:break-word;overflow-wrap:break-word;`;

        card.innerHTML = `
          ${fromName ? `
            <span style="${iS} margin-bottom:6px;">a letter from</span>
            <span style="${nS} margin-bottom:16px;">${fromName}</span>
          ` : ''}
          <span style="width:32px;height:1px;background:${dividerBg};margin-bottom:16px;display:block;"></span>
          ${toName ? `
            <span style="${iS} margin-bottom:6px;">for</span>
            <span style="${nS}">${toName}</span>
          ` : ''}
        `;

        overlay.appendChild(card);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.style.opacity   = '1';
          card.style.filter    = 'blur(0px)';
          card.style.transform = 'translate(-50%, -50%)';
        }));

        setTimeout(() => {
          card.style.opacity   = '0';
          card.style.filter    = 'blur(4px)';
          card.style.transform = 'translate(-50%, -60%)';
          setTimeout(() => card.remove(), 1500);
        }, TEXT_OUT_MS - TEXT_MS);

      }, TEXT_MS);

      // ── PHASE 3b: FLOWER Heart Formation — identical to _playFlowerTransition
      // Uses real flower images, not polaroids
      setTimeout(() => {
        const heartWrapper = document.createElement('div');
        heartWrapper.style.cssText = `
          position:absolute;width:100%;height:100%;top:0;left:0;
          pointer-events:none;z-index:100;
        `;
        overlay.appendChild(heartWrapper);

        // Pre-sample heart curve
        const SAMPLES = 2000;
        const rawPts  = [];
        for (let k = 0; k < SAMPLES; k++) {
          const t = (k / SAMPLES) * Math.PI * 2;
          rawPts.push({
            x: 16 * Math.pow(Math.sin(t), 3),
            y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))
          });
        }
        const arcLens = [0];
        for (let k = 1; k < SAMPLES; k++) {
          const dx = rawPts[k].x - rawPts[k-1].x;
          const dy = rawPts[k].y - rawPts[k-1].y;
          arcLens.push(arcLens[k-1] + Math.sqrt(dx*dx + dy*dy));
        }
        const totalLen = arcLens[SAMPLES - 1];

        const HEART_COUNT  = 54;
        const FLOWER_SIZE  = Math.min(46, W * 0.1);
        const S            = Math.min(13, W * 0.028);
        const heartEls     = [];
        let sampleIdx      = 0;

        for (let j = 0; j < HEART_COUNT; j++) {
          const targetLen = (j / HEART_COUNT) * totalLen;
          while (sampleIdx < SAMPLES - 1 && arcLens[sampleIdx + 1] < targetLen) sampleIdx++;
          const pt = rawPts[sampleIdx];

          const px = cx + pt.x * S;
          const py = cy + pt.y * S - 30;

          const el = document.createElement('div');
          el.style.cssText = `
            position:absolute;
            width:${FLOWER_SIZE}px; height:${FLOWER_SIZE}px;
            left:${px - FLOWER_SIZE/2}px; top:${py - FLOWER_SIZE/2}px;
            opacity:0; transform:scale(0.1) rotate(0deg);
            will-change:transform,opacity;
          `;

          const rotDir   = j % 2 === 0 ? 1 : -1;
          const rotSpeed = (4 + (j % 3) * 2).toFixed(2);

          const img = document.createElement('img');
          img.src      = FLOWER_SRCS[j % FLOWER_SRCS.length];
          img.decoding = 'async';
          img.style.cssText = `
            width:100%; height:100%; display:block; border-radius:50%;
            animation: ${rotDir > 0 ? '_floral-spin' : '_floral-spin-rev'} ${rotSpeed}s linear infinite;
            will-change:transform;
          `;

          el.appendChild(img);
          heartWrapper.appendChild(el);
          heartEls.push(el);

          const staggerIn = (j / HEART_COUNT) * 600;
          setTimeout(() => {
            el.animate([
              { transform: 'scale(0) rotate(-30deg)',  opacity: 0 },
              { transform: 'scale(1.25) rotate(5deg)', opacity: 1, offset: 0.65 },
              { transform: 'scale(1.0) rotate(0deg)',  opacity: 1 }
            ], { duration: 550, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'both' });
          }, staggerIn);
        }

        // Gentle pulse
        setTimeout(() => {
          heartEls.forEach(el => {
            el.animate([
              { transform: 'scale(1.0)' },
              { transform: 'scale(1.08)' },
              { transform: 'scale(1.0)' }
            ], { duration: 900, easing: 'ease-in-out', iterations: 3 });
          });
        }, 700);

        // Fade out heart
        setTimeout(() => {
          heartEls.forEach((el, k) => {
            setTimeout(() => {
              el.animate([
                { transform: 'scale(1.0)', opacity: 1 },
                { transform: 'scale(0.3) rotate(20deg)', opacity: 0 }
              ], { duration: 400, easing: 'ease-in', fill: 'both' });
            }, (k / HEART_COUNT) * 300);
          });
        }, HEART_STAY);

      }, HEART_MS);

      // ── Cleanup ───────────────────────────────────────────────────────────
      setTimeout(() => { overlay.remove(); resolve(); }, RESOLVE_MS);
    });
  }

  return { play };
})();
