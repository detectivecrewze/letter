/**
 * preview.js — Opens gift viewer in new tab
 * Birthday Retro Studio
 */
const Preview = (() => {
  function init() {
    document.getElementById('btn-preview')?.addEventListener('click', () => openPreview());
  }

  async function openPreview() {
    const token = Auth.getToken();
    if (!token) { Studio.showToast('Token tidak ditemukan.'); return; }

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Izinkan popup untuk preview.'); return; }

    Studio.showToast('Menyimpan & membuka preview...');

    try {
      await Autosave.saveNow();
      const previewUrl = `../index.html?to=${token}`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview.');
    }
  }

  return { init, openPreview };
})();

document.addEventListener('DOMContentLoaded', Preview.init);
