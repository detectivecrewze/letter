/**
 * preview.js — Opens app in new tab for live preview
 * Letter Edition Studio
 */

const Preview = (() => {
  function _getBaseUrl(template) {
    if (template === 'airmail') return '../themes/airmail/index.html';
    if (template === 'ribbon')  return '../themes/ribbon/index.html';
    return '../index.html';
  }

  function init() {
    // Main Preview (bottom button) -> Normal with typewriter
    document.getElementById('btn-preview-letter')?.addEventListener('click', () => openPreview(false));

    // Section-specific preview buttons -> Fast skip typewriter
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.btn-section-preview');
      if (btn) {
        const targetPage = btn.dataset.previewPage || null;
        openPreview(true, targetPage);
      }
    });

    // Secret Memory preview button -> Skip typewriter + scroll to end + open modal
    document.getElementById('btn-preview-memory')?.addEventListener('click', () => openMemoryPreview());
  }

  async function openPreview(skipTW = false, targetPage = null) {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Browser memblokir popup. Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview...');

    try {
      await Autosave.saveNow();
      const base = _getBaseUrl(Studio.getActiveTemplate());
      let previewUrl = `${base}?to=${token}`;
      if (skipTW) previewUrl += '&skipTW=1&skipAuth=1';
      if (targetPage) previewUrl += `&previewPage=${encodeURIComponent(targetPage)}`;

      // Pass themes so template can set background before first paint
      const activeTheme = Studio.getActiveTheme() || '';
      const activeRibbon = Studio.getActiveRibbonTheme() || '';
      previewUrl += `&theme=${encodeURIComponent(activeTheme)}&ribbonTheme=${encodeURIComponent(activeRibbon)}`;

      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  async function openMemoryPreview() {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Browser memblokir popup. Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview memori...');

    try {
      await Autosave.saveNow();
      const base = _getBaseUrl(Studio.getActiveTemplate());
      const previewUrl = `${base}?to=${token}&skipTW=1&skipAuth=1&openMemory=1`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  /**
   * Opens a live preview for a specific template (without changing the saved config).
   * Used by the "Preview" buttons inside the template selector cards.
   */
  async function openTemplatePreview(template) {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Izinkan popup untuk preview template.'); return; }

    const labels = { airmail: 'Vintage Airmail', ribbon: 'Ribbon & Seal' };
    const label = labels[template] || 'Classic Letter';
    Studio.showToast(`Membuka preview ${label}...`);

    try {
      await Autosave.saveNow();
      const base = _getBaseUrl(template);
      let previewUrl = `${base}?to=${token}&skipTW=1&skipAuth=1`;

      const activeTheme = Studio.getActiveTheme() || '';
      const activeRibbon = Studio.getActiveRibbonTheme() || '';
      previewUrl += `&theme=${encodeURIComponent(activeTheme)}&ribbonTheme=${encodeURIComponent(activeRibbon)}`;

      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  /**
   * Opens a read-only theme preview for free users.
   * They see their own letter content in a premium theme — triggering upgrade FOMO.
   * Uses ?theme= override already supported by the gift page (script.js line ~114).
   */
  async function openThemePreview(theme) {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Izinkan popup untuk preview tema.'); return; }

    const themeLabels = {
      'dusty-rose': 'Dusty Rose',
      'midnight': 'Midnight',
      'crimson': 'Crimson',
      'obsidian': 'Obsidian',
    };
    Studio.showToast(`Membuka preview ${themeLabels[theme] || theme}...`);

    // Langsung buka dengan ?theme= override — tidak perlu save dulu.
    // Theme override dibaca di gift page (script.js) tanpa mengubah config tersimpan.
    // ?previewOnly=1 → musik tidak dimainkan (free-user preview mode)
    const previewUrl = `../index.html?to=${token}&skipTW=1&skipAuth=1&theme=${encodeURIComponent(theme)}&previewOnly=1`;
    previewWin.location.href = previewUrl;
  }

  return { init, openPreview, openMemoryPreview, openTemplatePreview, openThemePreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);