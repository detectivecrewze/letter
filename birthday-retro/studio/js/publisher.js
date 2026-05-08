/**
 * publisher.js — Publish flow for Birthday Retro Studio
 */
const Publisher = (() => {
  let _isPublishing = false;

  function init() {
    document.getElementById('btn-publish')?.addEventListener('click', _handlePublishClick);

    // Success modal
    document.getElementById('btn-copy-link')?.addEventListener('click', _handleCopyLink);
    document.getElementById('btn-close-success')?.addEventListener('click', () => _toggleModal('modal-success', false));
  }

  function _toggleModal(id, show) {
    document.getElementById(id)?.classList.toggle('hidden', !show);
  }

  // ── Step 1: Validate & Do actual publish ──────────────────────────────
  async function _handlePublishClick() {
    if (_isPublishing) return;

    if (typeof Music !== 'undefined' && Music.isUploading()) {
      Studio.showToast('Tunggu upload musik selesai dulu ⏳');
      return;
    }

    _isPublishing = true;
    const submitBtn = document.getElementById('btn-publish');
    const originalText = submitBtn.textContent;
    if (submitBtn) {
      submitBtn.textContent = 'Mempublish...';
      submitBtn.disabled = true;
    }

    try {
      const token = Auth.getToken();
      const state = Autosave.buildState();
      state.status = 'published';
      state.publishedAt = new Date().toISOString();

      const res = await fetch(`${Auth.getWorkerUrl()}/save-config?id=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server error: Could not parse response. Pastikan Worker sudah berjalan dengan benar.');
      }

      if (data.success) {
        Autosave.cancel();
        const url = `https://birthday.for-you-always.my.id/?to=${encodeURIComponent(token)}`;
        _showSuccessModal(url);
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (e) {
      Studio.showToast('Gagal publish: ' + e.message);
      console.error(e);
    } finally {
      _isPublishing = false;
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  function _showSuccessModal(url) {
    const urlEl = document.getElementById('modal-gift-url');
    const viewBtn = document.getElementById('btn-view-gift');
    const qrBox = document.getElementById('qr-code-box');

    if (urlEl) urlEl.textContent = url;
    if (viewBtn) viewBtn.href = url;

    // Generate QR Code
    if (qrBox && typeof QRCode !== 'undefined') {
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: url,
        width: 148,
        height: 148,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      
      // Fix for mobile: qrcode.js might use canvas instead of img on some devices.
      const styleTag = document.createElement('style');
      styleTag.textContent = '#qr-code-box img, #qr-code-box canvas { margin: 0 auto !important; display: block; }';
      qrBox.appendChild(styleTag);
    }

    // Bind Download QR Button
    const downloadBtn = document.getElementById('btn-download-qr');
    if (downloadBtn) {
      const newBtn = downloadBtn.cloneNode(true);
      downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
      newBtn.addEventListener('click', _handleDownloadQR);
    }

    _toggleModal('modal-success', true);
  }

  async function _handleDownloadQR() {
    const exportNode = document.getElementById('qr-export-container');
    const btn = document.getElementById('btn-download-qr');

    if (!exportNode || typeof html2canvas === 'undefined') {
      Studio.showToast('Fitur download belum siap. Silakan screenshot manual.');
      return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = 'Menyiapkan...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
      const canvas = await html2canvas(exportNode, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Birthday_QR_${Math.floor(Date.now() / 1000)}.png`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating QR PNG:', err);
      Studio.showToast('Gagal mendownload barcode.');
    } finally {
      requestAnimationFrame(() => {
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.disabled = false;
      });
    }
  }

  function _handleCopyLink() {
    const url = document.getElementById('modal-gift-url')?.textContent?.trim();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('btn-copy-link');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'TERSALIN ✓';
        setTimeout(() => btn.textContent = originalText, 2000);
      }
    }).catch(() => Studio.showToast('Gagal salin. Coba manual.'));
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Wait for Studio to be ready before init
  setTimeout(() => Publisher.init(), 100);
});
