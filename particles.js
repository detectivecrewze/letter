/**
 * particles.js — Letter Edition
 * High-performance lightweight canvas particle system.
 */

'use strict';

window.Particles = (function() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return { init: () => {}, stop: () => {} };

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId = null;
  let width, height;

  const THEME_CONFIGS = {
    'blush-cream': {
      count: 22,
      type: 'petal',
      colors: ['#f8dada', '#f2caca', '#e6b8b8'],
      speedRange: [0.5, 1.2],
      sizeRange: [4, 8],
      wind: 0.3
    },
    'sage': {
      count: 18,
      type: 'leaf',
      colors: ['#cce0cd', '#b8ccb9', '#a4b8a5'],
      speedRange: [0.4, 1.0],
      sizeRange: [5, 10],
      wind: 0.2
    },
    'dusty-rose': {
      count: 25,
      type: 'petal',
      colors: ['#c4858a', '#a36d71', '#8b5d61'],
      speedRange: [0.6, 1.4],
      sizeRange: [6, 12],
      wind: 0.4
    },
    'midnight': {
      count: 30,
      type: 'star',
      colors: ['#ffd700', '#ffffff', '#fff9d6'],
      speedRange: [-0.2, -0.6],
      sizeRange: [1, 2.5],
      wind: 0
    }
  };

  class Particle {
    constructor(config) {
      this.config = config;
      this.reset(true);
    }

    reset(initial = false) {
      this.size = Math.random() * (this.config.sizeRange[1] - this.config.sizeRange[0]) + this.config.sizeRange[0];
      this.x = Math.random() * width;
      
      const isUpward = this.config.speedRange[0] < 0;

      if (initial) {
        // Balance: some start on screen, some start far out
        if (Math.random() > 0.6) {
          // 40% start already visible for instant impact
          this.y = Math.random() * height;
        } else {
          // 60% start staggered outside
          if (isUpward) {
            this.y = height + 20 + Math.random() * height;
          } else {
            this.y = -20 - Math.random() * height;
          }
        }
      } else {
        this.y = isUpward ? height + 20 : -20;
      }

      this.speedY = Math.random() * (this.config.speedRange[1] - this.config.speedRange[0]) + this.config.speedRange[0];
      this.speedX = (Math.random() - 0.5) * 0.8 + (this.config.wind || 0);
      this.opacity = Math.random() * 0.4 + 0.2; // Slightly more visible (0.2 - 0.6)
      this.color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.05;
    }

    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.rotation += this.rotationSpeed;

      // Handle recycling
      if (this.config.speedRange[0] < 0) {
        if (this.y < -20) this.reset();
      } else {
        if (this.y > height + 20) this.reset();
      }
      
      if (this.x > width + 20) this.x = -20;
      else if (this.x < -20) this.x = width + 20;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;

      if (this.config.type === 'petal') {
        // Draw elegant petal shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(this.size, -this.size/2, this.size, this.size/2, 0, this.size);
        ctx.bezierCurveTo(-this.size, this.size/2, -this.size, -this.size/2, 0, 0);
        ctx.fill();
      } else if (this.config.type === 'leaf') {
        // Draw leaf shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(this.size, this.size/2, 0, this.size);
        ctx.quadraticCurveTo(-this.size, this.size/2, 0, 0);
        ctx.fill();
      } else if (this.config.type === 'star') {
        // Star / Stardust
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        // Add tiny glow
        if (Math.random() > 0.95) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = this.color;
        }
      }

      ctx.restore();
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    animationId = requestAnimationFrame(loop);
  }

  return {
    init: function(theme) {
      this.stop();
      resize();
      window.addEventListener('resize', resize);
      
      const config = THEME_CONFIGS[theme] || THEME_CONFIGS['blush-cream'];
      
      // Smart Scaling for Mobile/Low-spec
      const isMobile = window.innerWidth < 768;
      const count = isMobile ? Math.floor(config.count * 0.6) : config.count;
      
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(config));
      }
      
      loop();
    },
    stop: function() {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      ctx.clearRect(0, 0, width, height);
      window.removeEventListener('resize', resize);
    }
  };
})();
