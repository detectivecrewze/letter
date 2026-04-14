/**
 * app-manager.js — Master Control Panel: Toggle pages ON/OFF
 * Loves Edition Studio
 */
const AppManager = (() => {

  const DEFAULT_PAGES = {
    login:      true,
    music:      true,  // Wajib, tidak bisa dimatikan
    gallery:    true,
    wrapped:    true,
    surat:      true,
    invitation: true,
  };

  // Map: data-app value → ID section di editor
  const SECTION_MAP = {
    login:      'section-login',
    music:      'section-music',
    gallery:    'section-gallery',
    wrapped:    'section-wrapped',
    surat:      'section-surat',
    invitation: 'section-invitation',
  };

  let _activePages = { ...DEFAULT_PAGES };

  function init(savedPages) {
    _activePages = { ...DEFAULT_PAGES, ...(savedPages || {}) };
    _bindMasterPanel();
    _bindCollapseBtns();
    _applyAllStates();
  }

  function getActivePages() {
    return { ..._activePages };
  }

  function _bindMasterPanel() {
    document.querySelectorAll('.master-app-toggle').forEach(checkbox => {
      const key = checkbox.dataset.app;
      if (!key) return;
      // Sync visual state dari KV
      checkbox.checked = _activePages[key] !== false;
      _updateStatusDot(checkbox, checkbox.checked);

      // Bind perubahan
      checkbox.addEventListener('change', () => {
        _activePages[key] = checkbox.checked;
        _updateStatusDot(checkbox, checkbox.checked);
        _applySectionVisibility(key);
        Autosave.trigger();
      });
    });
  }

  function _updateStatusDot(checkbox, isOn) {
    const item = checkbox.closest('.master-panel-item');
    if (!item) return;
    const dot = item.querySelector('.master-status-dot');
    if (dot) {
      dot.className = isOn
        ? 'master-status-dot w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5'
        : 'master-status-dot w-1.5 h-1.5 rounded-full bg-gray-300 mt-0.5';
    }
  }

  function _applySectionVisibility(key) {
    const sectionId = SECTION_MAP[key];
    if (!sectionId) return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    const isActive = _activePages[key] !== false;
    if (isActive) {
      section.style.display = '';
      requestAnimationFrame(() => {
        section.style.opacity = '1';
        section.style.transform = 'translateY(0)';
        section.style.maxHeight = '10000px';
        section.style.marginBottom = '';
        section.style.overflow = '';
      });
    } else {
      section.style.opacity = '0';
      section.style.transform = 'translateY(-12px)';
      section.style.overflow = 'hidden';
      section.style.maxHeight = '0';
      section.style.marginBottom = '0';
      setTimeout(() => {
        if (_activePages[key] === false) section.style.display = 'none';
      }, 350);
    }
  }

  function _applyAllStates() {
    Object.keys(SECTION_MAP).forEach(key => _applySectionVisibility(key));
  }

  function _bindCollapseBtns() {
    document.querySelectorAll('.section-collapse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.section-card');
        if (!section) return;
        const body = section.querySelector('.section-body');
        const isCollapsed = body?.classList.contains('collapsed');
        if (isCollapsed) {
          body.classList.remove('collapsed');
          btn.classList.remove('collapsed');
          section.classList.remove('is-collapsed');
        } else {
          body.classList.add('collapsed');
          btn.classList.add('collapsed');
          section.classList.add('is-collapsed');
        }
      });
    });
  }

  return { init, getActivePages };
})();
