/**
 * particles.js — Letter Edition
 * High-performance lightweight canvas particle system.
 * v2 — organic shapes, depth parallax, fade lifecycle
 */

'use strict';

window.Particles = (function () {
  const canvas = document.getElementById('particles-canvas');
  const canvasFg = document.getElementById('particles-canvas-fg');
  if (!canvas) return { init: () => { }, stop: () => { } };

  const ctx = canvas.getContext('2d');
  const ctxFg = canvasFg ? canvasFg.getContext('2d') : null;

  // ~15% of particles are "foreground" — drift over the letter paper
  // with very low opacity to feel like they're inside the scene
  const FG_RATIO = 0.15;
  const FG_OPACITY_MULT = 0.35; // foreground particles are much more subtle

  let particles = [];
  let animationId = null;
  let width, height;

  const THEME_CONFIGS = {
    'blush-cream': {
      count: 26,
      type: 'petal',
      colors: ['#f5d0d0', '#efbcbc', '#e8a8a8', '#fce4e4'],
      speedRange: [0.5, 1.2],
      sizeRange: [5, 10],
      wind: 0.25,
      opacityRange: [0.35, 0.7]
    },
    'sage': {
      count: 20,
      type: 'leaf',
      colors: ['#c8ddc9', '#b2ccb4', '#9cbf9e', '#daeadb'],
      speedRange: [0.4, 1.0],
      sizeRange: [5, 11],
      wind: 0.18,
      opacityRange: [0.3, 0.65]
    },
    'dusty-rose': {
      count: 28,
      type: 'petal',
      colors: ['#d4919a', '#b87880', '#c9828b', '#e0a8b0', '#bf6d76'],
      speedRange: [0.55, 1.35],
      sizeRange: [6, 13],
      wind: 0.35,
      opacityRange: [0.4, 0.75]
    },
    'midnight': {
      count: 35,
      type: 'star',
      colors: ['#ffd700', '#ffffff', '#fff5cc', '#ffe066'],
      speedRange: [-0.15, -0.55],
      sizeRange: [1, 3],
      wind: 0,
      opacityRange: [0.4, 0.85]
    }
  };

  // Asymmetric petal path shapes — pre-defined offsets for variety
  const PETAL_VARIANTS = [
    // [cpx1, cpy1, cpx2, cpy2, ex, ey, cpx3, cpy3, cpx4, cpy4] — two bezier curves
    [1.1, -0.45, 0.9, 0.55, 0, 1, -0.95, 0.5, -1.05, -0.4],
    [1.0, -0.55, 1.1, 0.45, 0, 1, -0.85, 0.6, -1.1, -0.35],
    [0.95, -0.5, 1.0, 0.6, 0, 1, -1.1, 0.4, -0.9, -0.5],
    [1.15, -0.4, 0.85, 0.5, 0, 1, -0.9, 0.55, -1.0, -0.45],
  ];

  class Particle {
    constructor(config) {
      this.config = config;
      this.petalVariant = PETAL_VARIANTS[Math.floor(Math.random() * PETAL_VARIANTS.length)];
      // Depth layer: 0 = far (slow, small, dim), 1 = near (fast, big, bright)
      this.depth = Math.random();
      this.reset(true);
    }

    reset(initial = false) {
      const d = this.depth;

      // Depth affects size, speed multiplier, and opacity ceiling
      const depthSizeMult = 0.55 + d * 0.85;  // far: 0.55x, near: 1.4x
      const depthSpeedMult = 0.5 + d * 0.8;    // far: 0.5x, near: 1.3x

      const sizeMin = this.config.sizeRange[0];
      const sizeMax = this.config.sizeRange[1];
      this.size = (Math.random() * (sizeMax - sizeMin) + sizeMin) * depthSizeMult;

      this.x = Math.random() * width;

      const isUpward = this.config.speedRange[0] < 0;

      if (initial) {
        this.y = Math.random() * height;
      } else {
        this.y = isUpward ? height + this.size + 5 : -(this.size + 5);
      }

      const baseSpeed = Math.random() *
        (this.config.speedRange[1] - this.config.speedRange[0]) +
        this.config.speedRange[0];

      this.speedY = baseSpeed * depthSpeedMult;
      this.speedX = ((Math.random() - 0.5) * 0.7 + (this.config.wind || 0)) * depthSpeedMult;

      // Opacity — depth-scaled ceiling
      const [oMin, oMax] = this.config.opacityRange;
      const depthOpacityCeil = oMin + (oMax - oMin) * (0.3 + d * 0.7);
      this.maxOpacity = depthOpacityCeil;
      this.opacity = 0; // start transparent for fade-in

      this.color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.04 * (0.5 + d * 0.8);

      // Gentle sway
      this.swayPhase = Math.random() * Math.PI * 2;
      this.swaySpeed = 0.008 + Math.random() * 0.012;
      this.swayAmp = (0.15 + Math.random() * 0.25) * depthSpeedMult;

      // Lifecycle state
      this.isUpward = isUpward;
      this.fadeDist = this.size * 6 + 20; // fade in/out over this many px
    }

    update() {
      this.y += this.speedY;
      this.swayPhase += this.swaySpeed;
      this.x += this.speedX + Math.sin(this.swayPhase) * this.swayAmp;
      this.rotation += this.rotationSpeed;

      // Fade lifecycle based on position
      if (this.isUpward) {
        // Moving up: fade in from bottom, fade out near top
        const distFromBottom = height - this.y;
        const distFromTop = this.y;
        const fadeIn = Math.min(1, distFromBottom / this.fadeDist);
        const fadeOut = Math.min(1, distFromTop / this.fadeDist);
        this.opacity = Math.min(fadeIn, fadeOut) * this.maxOpacity;

        if (this.y < -(this.size + 5)) this.reset();
      } else {
        // Moving down: fade in from top, fade out near bottom
        const distFromTop = this.y;
        const distFromBottom = height - this.y;
        const fadeIn = Math.min(1, distFromTop / this.fadeDist);
        const fadeOut = Math.min(1, distFromBottom / this.fadeDist);
        this.opacity = Math.min(fadeIn, fadeOut) * this.maxOpacity;

        if (this.y > height + this.size + 5) this.reset();
      }

      // Wrap horizontally without pop
      if (this.x > width + this.size + 10) this.x = -(this.size + 10);
      else if (this.x < -(this.size + 10)) this.x = width + this.size + 10;
    }

    drawOn(targetCtx) {
      targetCtx.save();
      targetCtx.translate(this.x, this.y);
      targetCtx.rotate(this.rotation);
      targetCtx.globalAlpha = Math.max(0, this.opacity);
      targetCtx.fillStyle = this.color;

      const s = this.size;
      const v = this.petalVariant;

      if (this.config.type === 'petal') {
        // Asymmetric organic petal using variant offsets
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.bezierCurveTo(
          s * v[0], s * v[1],
          s * v[2], s * v[3],
          s * v[4], s * v[5]
        );
        targetCtx.bezierCurveTo(
          s * v[6], s * v[7],
          s * v[8], s * v[9],
          0, 0
        );
        targetCtx.fill();

        // Subtle inner vein highlight
        targetCtx.globalAlpha = Math.max(0, this.opacity * 0.18);
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 0.5;
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.quadraticCurveTo(s * 0.2, s * 0.5, s * v[4], s * v[5]);
        targetCtx.stroke();

      } else if (this.config.type === 'leaf') {
        // Asymmetric leaf
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.bezierCurveTo(s * 0.9, s * 0.1, s * 0.85, s * 0.75, 0, s);
        targetCtx.bezierCurveTo(-s * 0.75, s * 0.8, -s * 0.7, s * 0.2, 0, 0);
        targetCtx.fill();

        // Midrib
        targetCtx.globalAlpha = Math.max(0, this.opacity * 0.2);
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 0.45;
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(0, s);
        targetCtx.stroke();

      } else if (this.config.type === 'star') {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, s, 0, Math.PI * 2);
        targetCtx.fill();

        // Glow for large/near stars
        if (s > 2 && this.depth > 0.65) {
          targetCtx.shadowBlur = s * 5;
          targetCtx.shadowColor = this.color;
          targetCtx.globalAlpha = Math.max(0, this.opacity * 0.6);
          targetCtx.beginPath();
          targetCtx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
        }
      }

      targetCtx.restore();
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (canvasFg) {
      canvasFg.width = width;
      canvasFg.height = height;
    }
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    if (ctxFg) ctxFg.clearRect(0, 0, width, height);

    // Sort back-to-front by depth for correct layering
    const sorted = particles.slice().sort((a, b) => a.depth - b.depth);

    sorted.forEach(p => {
      p.update();

      if (p.isForeground && ctxFg) {
        // Draw on fg canvas — override opacity to be very subtle
        const savedOpacity = p.opacity;
        p.opacity = savedOpacity * FG_OPACITY_MULT;
        p.drawOn(ctxFg);
        p.opacity = savedOpacity;
      } else {
        p.drawOn(ctx);
      }
    });

    animationId = requestAnimationFrame(loop);
  }

  return {
    init: function (theme) {
      this.stop();
      resize();
      window.addEventListener('resize', resize);

      const config = THEME_CONFIGS[theme] || THEME_CONFIGS['blush-cream'];

      const isMobile = window.innerWidth < 768;
      const isLowSpec = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
      const countMult = isMobile ? 0.6 : isLowSpec ? 0.75 : 1;
      const count = Math.floor(config.count * countMult);
      const fgCount = ctxFg ? Math.max(1, Math.round(count * FG_RATIO)) : 0;

      particles = [];
      for (let i = 0; i < count; i++) {
        const p = new Particle(config);
        p.depth = Math.pow(Math.random(), 0.7); // bias towards mid-near depth
        // First fgCount particles are foreground (float above the letter)
        p.isForeground = (i < fgCount);
        particles.push(p);
      }

      loop();
    },
    stop: function () {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (width && height) {
        ctx.clearRect(0, 0, width, height);
        if (ctxFg) ctxFg.clearRect(0, 0, width, height);
      }
      window.removeEventListener('resize', resize);
    }
  };
})();