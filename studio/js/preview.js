/**
 * preview.js — Two-stage preview experience for Letter Edition Studio
 *
 * Stage 1: field, section, memory, template, and theme previews stay inside
 *          the Studio in a mobile-first modal.
 * Stage 2: the final "Live Preview" keeps opening in a separate browser tab.
 */

const Preview = (() => {
  let _isBound = false;
  let _lastModalRequest = null;
  let _previousFocus = null;
  let _previewRequestId = 0;

  function _getBaseUrl(template) {
    if (template === 'airmail') return '../themes/airmail/index.html';
    if (template === 'ribbon') return '../themes/ribbon/index.html';
    if (template === 'vintage') return '../themes/vintage/index.html';
    return '../index.html';
  }

  function _themeQuery(themeOverride = null) {
    const activeTheme = themeOverride ?? Studio.getActiveTheme() ?? '';
    const activeRibbon = Studio.getActiveRibbonTheme() || '';
    const activeVintageFlower = Studio.getActiveVintageFlower() || '';
    const activeVintageColor = Studio.getActiveVintageColor() || '';

    return `&theme=${encodeURIComponent(activeTheme)}`
      + `&ribbonTheme=${encodeURIComponent(activeRibbon)}`
      + `&vintageFlower=${encodeURIComponent(activeVintageFlower)}`
      + `&vintageColor=${encodeURIComponent(activeVintageColor)}`;
  }

  function _buildPreviewUrl({
    template = Studio.getActiveTemplate(),
    skipTW = false,
    targetPage = null,
    openMemory = false,
    themeOverride = null,
    previewOnly = false,
  } = {}) {
    const token = Auth.getToken();
    const base = _getBaseUrl(template);
    let previewUrl = `${base}?to=${encodeURIComponent(token)}`;

    if (skipTW) previewUrl += '&skipTW=1&skipAuth=1';
    if (targetPage) previewUrl += `&previewPage=${encodeURIComponent(targetPage)}`;
    if (openMemory) previewUrl += '&openMemory=1';
    if (previewOnly) previewUrl += '&previewOnly=1';

    return previewUrl + _themeQuery(themeOverride);
  }

  function _elements() {
    return {
      modal: document.getElementById('letter-preview-modal'),
      card: document.querySelector('#letter-preview-modal .letter-preview-card'),
      title: document.getElementById('letter-preview-title'),
      subtitle: document.getElementById('letter-preview-subtitle'),
      status: document.getElementById('letter-preview-status'),
      statusText: document.getElementById('letter-preview-status-text'),
      retry: document.getElementById('letter-preview-retry'),
      stage: document.getElementById('letter-preview-stage'),
      device: document.getElementById('letter-preview-device'),
      close: document.getElementById('letter-preview-close'),
    };
  }

  function _setStatus(message, state = 'loading') {
    const { status, statusText, retry } = _elements();
    if (status) status.dataset.state = state;
    if (statusText) statusText.textContent = LetterI18n.t(message);
    if (retry) retry.hidden = state !== 'error';
  }

  function _detectedViewport() {
    return window.matchMedia('(min-width: 721px)').matches ? 'desktop' : 'mobile';
  }

  function _setViewport(viewport = _detectedViewport()) {
    const safeViewport = viewport === 'desktop' ? 'desktop' : 'mobile';
    const { stage } = _elements();
    if (stage) stage.dataset.previewViewport = safeViewport;
  }

  function _removeFrame() {
    const { device } = _elements();
    if (!device) return;
    const frame = device.querySelector('iframe');
    if (frame) {
      frame.src = 'about:blank';
      frame.remove();
    }
  }

  function _showModal(title, subtitle) {
    const { modal, title: titleEl, subtitle: subtitleEl, close } = _elements();
    if (!modal) return false;

    const isFirstOpen = modal.classList.contains('hidden');
    if (isFirstOpen) _previousFocus = document.activeElement;
    if (titleEl) titleEl.textContent = LetterI18n.t(title);
    if (subtitleEl) subtitleEl.textContent = LetterI18n.t(subtitle);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('letter-preview-open');
    document.body.classList.add('letter-preview-open');
    _setViewport();
    if (isFirstOpen) requestAnimationFrame(() => close?.focus());
    return true;
  }

  function closeModal() {
    const { modal } = _elements();
    if (!modal || modal.classList.contains('hidden')) return;

    _previewRequestId += 1;
    _removeFrame();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('letter-preview-open');
    document.body.classList.remove('letter-preview-open');
    _lastModalRequest = null;

    if (_previousFocus && typeof _previousFocus.focus === 'function') {
      _previousFocus.focus({ preventScroll: true });
    }
    _previousFocus = null;
  }

  function _mountFrame(url, title, requestId) {
    const { device } = _elements();
    if (!device) return;

    _removeFrame();
    const frame = document.createElement('iframe');
    frame.title = LetterI18n.t(title);
    frame.loading = 'eager';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.addEventListener('load', () => {
      const { modal } = _elements();
      if (requestId !== _previewRequestId || modal?.classList.contains('hidden')) return;
      try {
        frame.contentWindow?.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') closeModal();
        });
      } catch (error) {
        console.debug('[Preview modal] iframe keyboard bridge unavailable', error);
      }
      _setStatus('Preview siap. Semua interaksi dapat dicoba di dalam layar.', 'ready');
    }, { once: true });
    frame.src = url;
    device.appendChild(frame);
  }

  async function _loadModalRequest(request) {
    if (!Auth.getToken()) {
      Studio.showToast('Token tidak ditemukan.');
      return;
    }

    const requestId = ++_previewRequestId;
    _lastModalRequest = request;
    if (!_showModal(request.title, request.subtitle)) {
      Studio.showToast('Modal preview tidak tersedia.');
      return;
    }

    _removeFrame();
    _setStatus(request.save === false ? 'Menyiapkan preview...' : 'Menyimpan perubahan...', 'loading');

    try {
      if (request.save !== false) {
        const saved = await Autosave.saveNow();
        if (!saved) throw new Error('SAVE_FAILED');
        if (requestId !== _previewRequestId) return;
        _setStatus('Menyiapkan preview...', 'loading');
      }

      if (requestId !== _previewRequestId) return;
      const previewUrl = _buildPreviewUrl(request.urlOptions);
      _mountFrame(previewUrl, request.frameTitle || request.title, requestId);
    } catch (error) {
      if (requestId !== _previewRequestId) return;
      console.warn('[Preview modal]', error);
      _setStatus('Perubahan belum berhasil disimpan. Coba lagi agar preview memakai data terbaru.', 'error');
    }
  }

  function _retryModalPreview() {
    if (!_lastModalRequest) return;
    const request = _lastModalRequest;
    _loadModalRequest(request);
  }

  function _handleModalKeydown(event) {
    const { modal, card } = _elements();
    if (!modal || modal.classList.contains('hidden')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== 'Tab' || !card) return;
    const focusable = [...card.querySelectorAll('button:not([disabled]):not([hidden]), iframe')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function _templateLabel(template) {
    const labels = {
      classic: 'Classic Letter',
      airmail: 'Vintage Airmail',
      ribbon: 'Ribbon & Seal',
      vintage: 'Vintage Flowers',
    };
    return labels[template] || labels.classic;
  }

  function init() {
    if (_isBound) return;
    _isBound = true;

    // Stage 2 — the final experience intentionally stays in a new browser tab.
    document.getElementById('btn-preview-letter')?.addEventListener('click', openFinalPreview);

    // Stage 1 — contextual field previews stay inside the Studio modal.
    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('.btn-section-preview');
      if (!button) return;
      openSectionPreview(button.dataset.previewPage || null);
    });

    document.getElementById('btn-preview-memory')?.addEventListener('click', openMemoryPreview);
    document.getElementById('letter-preview-close')?.addEventListener('click', closeModal);
    document.getElementById('letter-preview-backdrop')?.addEventListener('click', closeModal);
    document.getElementById('letter-preview-retry')?.addEventListener('click', _retryModalPreview);
    document.addEventListener('keydown', _handleModalKeydown);
    window.addEventListener('resize', () => {
      const { modal } = _elements();
      if (modal && !modal.classList.contains('hidden')) _setViewport();
    });
  }

  async function openFinalPreview() {
    const token = Auth.getToken();
    if (!token) {
      Studio.showToast('Token tidak ditemukan.');
      return;
    }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) {
      Studio.showToast('Browser memblokir popup. Izinkan popup untuk preview.');
      return;
    }

    Studio.showToast('Menyimpan & membuka preview...');
    try {
      const saved = await Autosave.saveNow();
      if (!saved) throw new Error('SAVE_FAILED');
      previewWin.location.href = _buildPreviewUrl();
    } catch (error) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  function openSectionPreview(targetPage = null) {
    const isLetter = targetPage === 'page-surat';
    return _loadModalRequest({
      title: isLetter ? 'Preview Surat' : 'Preview Penerima',
      subtitle: 'Perubahan terbaru disimpan sebelum preview dimuat.',
      frameTitle: isLetter ? 'Preview Surat' : 'Preview Penerima',
      urlOptions: { skipTW: true, targetPage },
    });
  }

  function openMemoryPreview() {
    return _loadModalRequest({
      title: 'Preview Memori Rahasia',
      subtitle: 'Perubahan terbaru disimpan sebelum preview dimuat.',
      frameTitle: 'Preview Memori Rahasia',
      urlOptions: { skipTW: true, openMemory: true },
    });
  }

  function openTemplatePreview(template) {
    const label = _templateLabel(template);
    return _loadModalRequest({
      title: `Preview ${label}`,
      subtitle: 'Template dicoba tanpa mengubah pilihan yang tersimpan.',
      frameTitle: `Preview ${label}`,
      urlOptions: { template, skipTW: true },
    });
  }

  function openThemePreview(theme) {
    const labels = {
      'dusty-rose': 'Dusty Rose',
      midnight: 'Midnight',
      crimson: 'Crimson',
      obsidian: 'Obsidian',
    };
    const label = labels[theme] || theme;

    return _loadModalRequest({
      title: `Preview ${label}`,
      subtitle: 'Tema dicoba tanpa mengubah pilihan yang tersimpan.',
      frameTitle: `Preview tema ${label}`,
      urlOptions: {
        template: 'classic',
        skipTW: true,
        themeOverride: theme,
        previewOnly: true,
      },
    });
  }

  // Backward-compatible entry point: direct/field preview opens the modal,
  // while the unmodified final call keeps the browser-tab experience.
  function openPreview(skipTW = false, targetPage = null) {
    if (skipTW || targetPage) return openSectionPreview(targetPage);
    return openFinalPreview();
  }

  return {
    init,
    closeModal,
    openPreview,
    openFinalPreview,
    openSectionPreview,
    openMemoryPreview,
    openTemplatePreview,
    openThemePreview,
  };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
