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
      let previewUrl = `../index.html?to=${token}`;
      if (skipTW) previewUrl += '&skipTW=1&skipAuth=1';
      
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
      // skipTW=1 to render instantly, openMemory=1 to auto-open the modal
      const previewUrl = `../index.html?to=${token}&skipTW=1&skipAuth=1&openMemory=1`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  return { init, openPreview, openMemoryPreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
