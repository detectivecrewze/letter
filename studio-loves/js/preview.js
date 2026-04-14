/**
 * preview.js — Opens app in new tab for live preview
 * Loves Edition Studio
 */

const Preview = (() => {
  function init() {
    document.getElementById('btn-preview-loves')?.addEventListener('click', openPreview);

    // Section-specific preview buttons
    document.body.addEventListener('click', e => {
      const btn = e.target.closest('.btn-section-preview');
      if (btn) {
        const page = btn.dataset.previewPage;
        if (page) openPagePreview(page);
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
      // URL ke app Loves dengan token
      const previewUrl = `../index.html?to=${token}&preview=true&t=${Date.now()}`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview. Coba lagi.');
    }
  }

  async function openPagePreview(page) {
    const token = Auth.getToken();
    if (!token) return Studio.showToast('Token tidak ditemukan.');

    const previewWin = window.open('about:blank', '_blank');
    if (!previewWin) { Studio.showToast('Browser memblokir popup.'); return; }

    Studio.showToast(`Preview ${page.toUpperCase()}...`);

    try {
      await Autosave.saveNow();
      const previewUrl = `../index.html?to=${token}&preview=true&page=${page}&t=${Date.now()}`;
      previewWin.location.href = previewUrl;
    } catch (e) {
      previewWin.close();
      Studio.showToast('Gagal membuka preview.');
    }
  }

  return { init, openPreview };
})();
