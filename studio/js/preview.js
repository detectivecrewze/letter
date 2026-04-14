/**
 * preview.js — Opens app in new tab for live preview
 * Letter Edition Studio
 */

const Preview = (() => {
  function init() {
    // Main Preview (bottom button) -> Normal with typewriter
    document.getElementById('btn-preview-letter')?.addEventListener('click', () => openPreview(false));

    // Section-specific preview buttons -> Fast skip typewriter
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.btn-section-preview');
      if (btn) {
        openPreview(true);
      }
    });
  }

  async function openPreview(skipTW = false) {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Browser memblokir popup. Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview...');

    try {
      await Autosave.saveNow();
      // URL ke letter
      let previewUrl = `../index.html?to=${token}`;
      if (skipTW) previewUrl += '&skipTW=1&skipAuth=1';
      
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  return { init, openPreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
