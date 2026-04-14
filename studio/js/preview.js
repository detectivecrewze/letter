/**
 * preview.js — Opens app in new tab for live preview
 * Letter Edition Studio
 */

const Preview = (() => {
  function init() {
    document.getElementById('btn-preview-letter')?.addEventListener('click', openPreview);

    // Section-specific preview buttons
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.btn-section-preview');
      if (btn) {
        openPreview();
      }
    });
  }

  async function openPreview() {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Browser memblokir popup. Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview...');

    try {
      await Autosave.saveNow();
      // URL ke letter
      const previewUrl = `../index.html?to=${token}`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  return { init, openPreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
