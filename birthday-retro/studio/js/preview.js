/**
 * preview.js — Opens gift viewer in new tab
 * Birthday Retro Studio
 */
const Preview = (() => {
  function init() {
    // Main full preview (bottom button)
    document.getElementById('btn-preview')?.addEventListener('click', () => openPreview());

    // Preview Wishes → skip to stage-5 directly (skipTW=1 to speed up)
    document.getElementById('btn-preview-wishes')?.addEventListener('click', () => openPreview(true));

    // Preview Secret Media → skip to end + auto-open modal
    document.getElementById('btn-preview-memory')?.addEventListener('click', () => openMemoryPreview());
  }

  async function openPreview(skipTW = false) {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview...');

    try {
      await Autosave.saveNow();
      let previewUrl = `../index.html?to=${token}`;
      if (skipTW) previewUrl += '&skipAuth=1';
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview.');
    }
  }

  async function openMemoryPreview() {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview foto...');

    try {
      await Autosave.saveNow();
      // skipAuth=1 to skip password, openMemory=1 to auto-open the secret memory modal
      const previewUrl = `../index.html?to=${token}&skipAuth=1&openMemory=1`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview.');
    }
  }

  return { init, openPreview, openMemoryPreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
