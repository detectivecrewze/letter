/**
 * studio.js — Main Studio controller
 * Birthday Retro Studio
 */
const Studio = (() => {
  let _isPremium = false;
  let _playlist = [];

  function isPremium() { return _isPremium; }
  function getPlaylistArray() { return typeof Music !== 'undefined' ? Music.getPlaylistArray() : _playlist; }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.classList.add('hidden'), 300); }, 2500);
  }

  async function init() {
    const ok = await Auth.init();
    if (ok) initPostAuth();
  }

  function initPostAuth() {
    const cfg = Auth.getInitialConfig() || {};
    _isPremium = cfg.isPremium === true;

    // Populate fields from saved config
    _setVal('input-recipient-name', cfg.recipientName);
    _setVal('input-age', cfg.age);
    _setVal('input-stage1-heading', cfg.stage1_heading || `Happy ${cfg.age || '?'}th Birthday!`);
    _setVal('input-stage2-question', cfg.stage2_question || 'i have a surprise for\nyou, wanna see it?');
    _setVal('input-stage4-text', cfg.stage4_reveal_text || "it's a birthday surprise!! :D");
    _setVal('input-stage5-wishes', cfg.stage5_wishes);

    // Initialize Music Manager
    if (typeof Music !== 'undefined') {
      Music.setPremiumMode(_isPremium);
      Music.init(cfg);
    }

    // Theme & Premium Lock
    const themeOverlay = document.getElementById('theme-lock-overlay');
    const themeInput = document.getElementById('input-theme');
    
    _setVal('input-theme', cfg.theme || 'classic');
    
    function applyStudioTheme() {
      const val = themeInput?.value || 'classic';
      let color = '#008080';
      if (val === 'rosepink') color = '#e8a8b8';
      else if (val === 'y2k') color = '#c8bfe7';
      else if (val === 'sky') color = '#99b4d1';
      else if (val === 'midnight') color = '#1a252c';
      document.documentElement.style.setProperty('--desktop', color);
    }
    
    applyStudioTheme(); // Apply immediately
    themeInput?.addEventListener('change', applyStudioTheme);

    if (!_isPremium) {
      if (themeOverlay) themeOverlay.classList.remove('hidden');
      if (themeInput) themeInput.disabled = true;
    } else {
      if (themeOverlay) themeOverlay.classList.add('hidden');
      if (themeInput) themeInput.disabled = false;
    }

    // Auto-generate heading when name/age changes
    const nameInput = document.getElementById('input-recipient-name');
    const ageInput = document.getElementById('input-age');
    const headingInput = document.getElementById('input-stage1-heading');

    function autoHeading() {
      const name = nameInput?.value.trim() || '';
      const age = ageInput?.value.trim() || '';
      if (headingInput && !headingInput.dataset.userEdited) {
        const suffix = age ? `${age}th` : '';
        headingInput.value = `Happy ${suffix} Birthday${name ? ', ' + name : ''}!`;
      }
    }
    nameInput?.addEventListener('input', () => { autoHeading(); Autosave.trigger(); });
    ageInput?.addEventListener('input', () => { autoHeading(); Autosave.trigger(); });
    headingInput?.addEventListener('input', () => { headingInput.dataset.userEdited = '1'; Autosave.trigger(); });

    // Bind autosave to all inputs and selects
    document.querySelectorAll('#studio-main textarea, #studio-main input[type="text"]').forEach(el => {
      el.addEventListener('input', () => Autosave.trigger());
    });
    document.querySelectorAll('#studio-main select').forEach(el => {
      el.addEventListener('change', () => Autosave.trigger());
    });

    // Premium badge
    const badge = document.getElementById('premium-badge');
    if (badge) badge.textContent = _isPremium ? '✨ Premium' : 'Free';

    // Show studio
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('studio-main')?.classList.remove('hidden');

    showToast('Studio siap! 🎂');
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  return { init, initPostAuth, isPremium, getPlaylistArray, showToast };
})();

document.addEventListener('DOMContentLoaded', Studio.init);
