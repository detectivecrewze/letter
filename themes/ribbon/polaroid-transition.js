/**
 * polaroid-transition.js — Ribbon Theme
 *
 * Self-contained Polaroid Scatter transition.
 * Exported as: window.RibbonPolaroid.play(envRect, config, onSwitchState)
 *
 * Mirrors _playFlowerTransition logic EXACTLY — same physics, same timing,
 * same vortex — but replaces flower images with polaroid cards.
 *
 * Timeline (~10s total):
 *  0.0–3.6s  : Burst + settle  (photos erupt from envelope, fill screen)
 *  3.4–5.6s  : Vortex sweep-out (photos spiral off screen)
 *  5.6–9.0s  : Heart formation (same as flower heart, using polaroid cards)
 *  9.0–10.5s : Fade out + resolve
 */

'use strict';

window.RibbonPolaroid = (() => {

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

      ._pol-card {
        position: absolute;
        background: #fff;
        will-change: transform, opacity;
        transform-origin: center center;
        /* Polaroid: thin sides/top, thick bottom for caption */
        padding: 7px 7px 32px 7px;
        border-radius: 2px;
        box-shadow:
          0 6px 20px rgba(0,0,0,0.22),
          0 2px 6px rgba(0,0,0,0.14),
          0 0 0 1px rgba(0,0,0,0.04);
      }

      ._pol-card img {
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
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Caveat', cursive, sans-serif;
        font-size: 11px;
        color: #4a3f35;
        text-align: center;
        padding: 0 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @keyframes _pol-spin     { to { transform: rotate(360deg);  } }
      @keyframes _pol-spin-rev { to { transform: rotate(-360deg); } }
    `;
    document.head.appendChild(style);
  }

  // ── Seeded RNG (same seed as script.js for consistency) ───────────────────
  function _makeRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  function play(envRect, config, onSwitchState) {
    return new Promise(resolve => {
      _injectStyles();

      const rng = _makeRng(42); // same seed as flower burst
      const W = window.innerWidth;
      const H = window.innerHeight;

      // Burst origin: envelope flap center (identical to flower burst)
      const cx = envRect ? (envRect.left + envRect.width / 2) : W / 2;
      const cy = envRect ? (envRect.top  + envRect.height * 0.35) : H / 2;

      // ── Build photo pool — loop raw photos to reach COUNT ─────────────────
      const rawList = (config.secretMediaList || []).filter(item => item && item.url);
      if (rawList.length === 0) { resolve(); return; }

      const COUNT = 200; // same ballpark as flower (300 flowers → 200 polaroids feels equiv.)
      const pool  = [];
      while (pool.length < COUNT) rawList.forEach(item => pool.push(item));
      const photos = pool.slice(0, COUNT);

      // Polaroid dimensions (compact — allows many on screen without clutter)
      const PHOTO_W = 78;  // photo area width
      const PHOTO_H = 63;  // photo area height
      const CARD_W  = PHOTO_W + 14;       // 7px each side
      const CARD_H  = PHOTO_H + 14 + 32;  // 7px top + 32px caption bottom

      // ── Overlay ───────────────────────────────────────────────────────────
      const overlay = document.createElement('div');
      overlay.id = '_polaroid-overlay';
      document.body.appendChild(overlay);

      // ── Build particles — IDENTICAL math to _playFlowerTransition ─────────
      const particles = photos.map((item, i) => {
        const frac = i / COUNT;

        // Fan angle: 200° upward arc — nothing goes downward
        const spread      = 200;
        const baseAngleDeg = -90 + (frac - 0.5) * spread;
        const jitter       = (rng() - 0.5) * 18;
        const angleRad     = ((baseAngleDeg + jitter) * Math.PI) / 180;

        // Distance & trajectory (identical to flower)
        const sidePull = 1 + Math.abs(frac - 0.5) * 1.8;
        const dist     = 350 + rng() * 650;
        const xEnd     = Math.cos(angleRad) * dist * sidePull + (rng() - 0.5) * 100;
        const yPeak    = Math.sin(angleRad) * dist - 50 - rng() * 150;
        const yFinal   = yPeak + 400 + rng() * 650; // gravity brings down

        const finalScale   = 1.0 + rng() * 0.5;
        const rotStart     = (rng() - 0.5) * 20;
        const rotFinal     = (rng() - 0.5) * 35; // slight tilt when settled
        const delay        = frac * 1.6 + rng() * 0.15;
        const duration     = 2.0 + rng() * 1.6;

        return { i, item, frac, xEnd, yPeak, yFinal, finalScale, rotStart, rotFinal, delay, duration };
      });

      // ── Create DOM elements ───────────────────────────────────────────────
      const cards = particles.map(p => {
        const half_w = CARD_W / 2;
        const half_h = CARD_H / 2;

        const card = document.createElement('div');
        card.className = '_pol-card';
        card.style.cssText = `
          width: ${CARD_W}px;
          height: ${CARD_H}px;
          left: ${cx - half_w}px;
          top:  ${cy - half_h}px;
          opacity: 0;
          transform: translate(0,0) scale(0.12) rotate(${p.rotStart}deg);
        `;

        const img = document.createElement('img');
        img.src = p.item.url;
        img.alt = p.item.caption || '';
        img.draggable = false;
        img.decoding  = 'async';
        img.width  = PHOTO_W;
        img.height = PHOTO_H;

        const cap = document.createElement('div');
        cap.className = '_pol-caption';
        cap.textContent = p.item.caption || '';

        card.appendChild(img);
        card.appendChild(cap);
        overlay.appendChild(card);

        return { el: card, p };
      });

      // ── PHASE 1: Burst — same 3-keyframe parabola as flowers ──────────────
      cards.forEach(({ el, p }) => {
        el.animate([
          {
            transform: `translate(0px, 0px) scale(0.12) rotate(${p.rotStart}deg)`,
            opacity: 0
          },
          {
            transform: `translate(${p.xEnd * 0.4}px, ${p.yPeak}px) scale(0.80) rotate(${p.rotFinal * 0.5}deg)`,
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

      // ── Timing (mirrors flower burst exactly) ─────────────────────────────
      const SETTLE_MS  = 3600;
      const VORTEX_MS  = SETTLE_MS + 400;
      const HEART_MS   = VORTEX_MS + 2000;
      const HEART_STAY = 4500;
      const RESOLVE_MS = HEART_MS + HEART_STAY + 800;

      // Switch state while photos cover the screen
      setTimeout(() => { if (onSwitchState) onSwitchState(); }, SETTLE_MS - 200);

      // ── PHASE 2: Vortex (identical to flower vortex) ──────────────────────
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

      // ── PHASE 3: "a letter from / for" text card ──────────────────────────
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

        // Light/dark detection by theme name
        const theme = (config.ribbonTheme || '').toLowerCase();
        const lightThemes = ['crimson', 'rose', 'forest', 'violet', 'parchment', 'sunflower'];
        const isLight = lightThemes.some(t => theme.includes(t));

        const introColor = isLight ? 'rgba(90, 55, 30, 0.75)'  : 'rgba(255,225,185,0.8)';
        const nameColor  = isLight ? 'rgba(50, 30, 15, 0.92)'  : 'rgba(255,240,220,0.95)';
        const dividerBg  = isLight ? 'rgba(100, 60, 20, 0.3)'  : 'rgba(255,210,160,0.35)';
        const nameShadow = isLight
          ? '0 1px 8px rgba(255,255,255,0.5)'
          : '0 2px 20px rgba(0,0,0,0.4)';

        const S_val = Math.min(13, W * 0.028);
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
          transition: opacity 1500ms ease, transform 1500ms cubic-bezier(0.2,0.8,0.2,1), filter 1500ms ease;
          display: flex; flex-direction: column; align-items: center; gap: 0;
          width: 60%; max-width: 300px;
        `;

        const introStyle = `
          font-family:'Cormorant Garamond','Georgia',serif;
          font-style:italic; text-transform:lowercase; letter-spacing:0.12em;
          line-height:1.3; font-size:clamp(12px,1.8vw,15px);
          color:${introColor}; font-weight:400; display:block;
        `;
        const nameStyle = `
          font-family:'Cormorant Garamond','Georgia',serif;
          letter-spacing:0.15em; text-transform:uppercase; line-height:1.3;
          text-shadow:${nameShadow}; font-size:clamp(14px,2.5vw,22px);
          color:${nameColor}; font-weight:600;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
          overflow:hidden; word-wrap:break-word; overflow-wrap:break-word;
        `;

        card.innerHTML = `
          ${fromName ? `
            <span style="${introStyle} margin-bottom:6px;">a letter from</span>
            <span style="${nameStyle} margin-bottom:16px;">${fromName}</span>
          ` : ''}
          <span style="width:32px;height:1px;background:${dividerBg};margin-bottom:16px;display:block;"></span>
          ${toName ? `
            <span style="${introStyle} margin-bottom:6px;">for</span>
            <span style="${nameStyle}">${toName}</span>
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

      // ── PHASE 4: Heart formation from polaroids ────────────────────────────
      // Uses the same arc-length heart parameterisation as the flower version
      setTimeout(() => {
        const heartWrapper = document.createElement('div');
        heartWrapper.style.cssText = `
          position:absolute;width:100%;height:100%;top:0;left:0;
          pointer-events:none;z-index:100;
        `;
        overlay.appendChild(heartWrapper);

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

        // Use smaller polaroid cards for the heart
        const H_W  = 36; // heart-polaroid photo width
        const H_H  = 30; // heart-polaroid photo height
        const H_CW = H_W + 8;
        const H_CH = H_H + 8 + 18; // 4px top, 18px caption

        const HEART_COUNT = 54;
        const S = Math.min(13, W * 0.028);
        const heartPts  = [];
        const heartEls  = [];
        let sampleIdx = 0;

        for (let j = 0; j < HEART_COUNT; j++) {
          const targetLen = (j / HEART_COUNT) * totalLen;
          while (sampleIdx < SAMPLES - 1 && arcLens[sampleIdx + 1] < targetLen) sampleIdx++;
          const pt = rawPts[sampleIdx];
          const px = cx + pt.x * S;
          const py = cy + pt.y * S - 30;
          heartPts.push({ px, py });

          const photo = rawList[j % rawList.length];
          const hCard = document.createElement('div');
          hCard.className = '_pol-card';
          hCard.style.cssText = `
            width:${H_CW}px; height:${H_CH}px;
            left:${px - H_CW/2}px; top:${py - H_CH/2}px;
            opacity:0; transform:scale(0.1) rotate(0deg);
          `;

          const hImg = document.createElement('img');
          hImg.src = photo.url;
          hImg.alt = photo.caption || '';
          hImg.decoding = 'async';
          hImg.width  = H_W;
          hImg.height = H_H;
          hImg.style.display = 'block';

          const hCap = document.createElement('div');
          hCap.className = '_pol-caption';
          hCap.style.fontSize = '8px';
          hCap.style.height   = '18px';
          hCap.textContent = photo.caption || '';

          hCard.appendChild(hImg);
          hCard.appendChild(hCap);
          heartWrapper.appendChild(hCard);
          heartEls.push(hCard);

          const staggerIn = (j / HEART_COUNT) * 600;
          setTimeout(() => {
            hCard.animate([
              { transform: 'scale(0) rotate(-30deg)', opacity: 0 },
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
