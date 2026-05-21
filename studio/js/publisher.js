/**
 * publisher.js — Publish & VIP flow for Letter Edition Studio
 * Mirrors the Loves Project publisher pattern exactly.
 */
const Publisher = (() => {
  let _isPublishing = false;

  function init() {
    document.getElementById('submit-btn')?.addEventListener('click', _handlePublishClick);
    document.getElementById('btn-publish-vip')?.addEventListener('click', _handleVipClick);

    // Publish modal
    document.getElementById('btn-confirm-name')?.addEventListener('click', _doPublish);
    document.getElementById('btn-cancel-name')?.addEventListener('click', () => _toggleModal('modal-name', false));

    // VIP & Premium Modals
    document.getElementById('btn-confirm-name-vip')?.addEventListener('click', _doVipSubmit);
    document.getElementById('btn-cancel-name-vip')?.addEventListener('click', () => _toggleModal('modal-name-vip', false));
    
    // Premium Upgrade Direct WhatsApp
    document.getElementById('btn-upgrade-premium')?.addEventListener('click', () => {
      const token = Auth.getToken();
      const waMsg = encodeURIComponent(
        `REQUEST UPGRADE PREMIUM — LETTER EDITION (+10K)\n\n` +
        `Letter ID: ${token}\n\n` +
        `Halo admin, saya ingin request upgrade akun Premium untuk membuka fitur Upload Musik dan Password Lock.`
      );
      window.open(`https://wa.me/6281381543981?text=${waMsg}`, '_blank');
    });

    // Success modal
    document.getElementById('btn-copy-link')?.addEventListener('click', _handleCopyLink);
    document.getElementById('btn-close-success')?.addEventListener('click', () => _toggleModal('modal-success', false));

    // Bonus claim modal
    const showClaimModal = () => {
      document.getElementById('input-bonus-id').value = '';
      _toggleModal('modal-bonus-claim', true);
    };
    document.getElementById('btn-sidebar-claim-bonus')?.addEventListener('click', showClaimModal);
    document.getElementById('btn-confirm-bonus-claim')?.addEventListener('click', _doClaimBonus);
    document.getElementById('btn-cancel-bonus-claim')?.addEventListener('click', () => _toggleModal('modal-bonus-claim', false));
  }

  function _toggleModal(id, show) {
    document.getElementById(id)?.classList.toggle('hidden', !show);
  }

  // ── Step 1: Validate & show confirm modal ──────────────────
  function _handlePublishClick() {
    if (_isPublishing) return;
    Studio.clearErrors();

    const letterMsg = document.getElementById('input-letter-msg')?.value.trim();
    if (!letterMsg) {
      Studio.showToast('Isi surat tidak boleh kosong');
      return;
    }
    if (Music.isUploading()) {
      Studio.showToast('Tunggu upload musik selesai dulu');
      return;
    }

    _toggleModal('modal-name', true);
  }

  // ── Step 2: Do actual publish ──────────────────────────────
  async function _doPublish() {
    _isPublishing = true;
    _toggleModal('modal-name', false);

    const submitBtn  = document.getElementById('submit-btn');
    const submitText = submitBtn?.querySelector('.submit-text');
    if (submitText) submitText.textContent = 'Mempublish...';
    if (submitBtn)  submitBtn.disabled = true;

    try {
      const token = Auth.getToken();
      const state = Autosave.buildState();
      state.status      = 'published';
      state.publishedAt = new Date().toISOString();

      const res  = await fetch(`${Auth.getWorkerUrl()}/save-config?id=${encodeURIComponent(token)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(state),
      });
      const data = await res.json();

      if (data.success) {
        Autosave.cancel();
        // Update local initial config status so that checks work properly
        const config = Auth.getInitialConfig();
        if (config) {
          config.status = 'published';
          config.publishedAt = state.publishedAt;
        }
        // Build URL based on template type
        const templateType = state.templateType || 'classic';
        const basePath = templateType === 'airmail' ? `/airmail/${token}` : `/${token}`;
        const url = `${location.protocol}//${location.host}${basePath}`;
        _showSuccessModal(url, templateType);
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (e) {
      Studio.showToast('Gagal publish: ' + e.message);
    } finally {
      _isPublishing = false;
      if (submitText) submitText.textContent = 'Publikasikan Surat';
      if (submitBtn)  submitBtn.disabled = false;
    }
  }

  function _showSuccessModal(url, templateType) {
    const urlEl   = document.getElementById('modal-gift-url');
    const viewBtn = document.getElementById('btn-view-gift');
    const waBtn   = document.getElementById('btn-share-whatsapp');
    const qrBox   = document.getElementById('qr-code-box');
    const exportContainer = document.getElementById('qr-export-container');

    if (urlEl)   urlEl.textContent = url;
    if (viewBtn) viewBtn.href = url;
    if (waBtn) {
      const msg = encodeURIComponent(`Ada surat untukmu...\n\n${url}`);
      waBtn.href = `https://wa.me/?text=${msg}`;
    }

    // ── QR export card design styling based on template ──
    const topAccent = document.getElementById('qr-top-accent');
    const title = document.getElementById('qr-title');
    const subtitle = document.getElementById('qr-subtitle');
    const branding = document.getElementById('qr-branding');

    if (templateType === 'airmail') {
      // Vintage Airmail Design
      if (exportContainer) {
        exportContainer.style.background = 'linear-gradient(160deg, #fdf6e3 0%, #f4ebd8 100%)';
        exportContainer.style.border = '2px dashed #b58756';
        exportContainer.style.borderRadius = '8px';
        exportContainer.style.boxShadow = '0 20px 50px -15px rgba(0,0,0,0.15), 0 4px 12px rgba(181,135,86,0.15)';
      }
      if (topAccent) {
        topAccent.style.width = '100%';
        topAccent.style.height = '8px';
        topAccent.style.borderRadius = '0';
        topAccent.style.left = '0';
        topAccent.style.transform = 'none';
        topAccent.style.background = 'transparent';
        topAccent.style.display = 'flex';
        topAccent.style.overflow = 'hidden';
        topAccent.innerHTML = '';
        for (let i = 0; i < 15; i++) {
          const b1 = document.createElement('div');
          b1.style.minWidth = '16px'; b1.style.height = '100%'; b1.style.backgroundColor = '#c0392b'; b1.style.transform = 'skewX(-45deg)'; b1.style.marginLeft = i === 0 ? '-8px' : '0';
          const b2 = document.createElement('div');
          b2.style.minWidth = '16px'; b2.style.height = '100%'; b2.style.backgroundColor = 'transparent'; b2.style.transform = 'skewX(-45deg)';
          const b3 = document.createElement('div');
          b3.style.minWidth = '16px'; b3.style.height = '100%'; b3.style.backgroundColor = '#2c3e80'; b3.style.transform = 'skewX(-45deg)';
          const b4 = document.createElement('div');
          b4.style.minWidth = '16px'; b4.style.height = '100%'; b4.style.backgroundColor = 'transparent'; b4.style.transform = 'skewX(-45deg)';
          topAccent.appendChild(b1); topAccent.appendChild(b2); topAccent.appendChild(b3); topAccent.appendChild(b4);
        }
      }
      if (title) {
        title.textContent = 'AIRMAIL';
        title.style.fontFamily = '"Courier New", Courier, monospace';
        title.style.fontStyle = 'normal';
        title.style.fontWeight = '900';
        title.style.fontSize = '24px';
        title.style.color = '#c0392b';
        title.style.letterSpacing = '0.15em';
      }
      if (subtitle) {
        subtitle.textContent = 'PAR AVION ✦ PRIORITY';
        subtitle.style.color = '#2c3e80';
      }
      if (branding) {
        branding.textContent = 'POSTAGE PAID';
        branding.style.color = '#5a3e28';
        branding.style.fontWeight = 'bold';
      }
    } else {
      // Classic Letter Design (Restore defaults)
      if (exportContainer) {
        exportContainer.style.background = 'linear-gradient(160deg, #fffaf5 0%, #fff8f0 50%, #f5efe6 100%)';
        exportContainer.style.border = '1px solid rgba(212,174,106,0.2)';
        exportContainer.style.borderRadius = '16px';
        exportContainer.style.boxShadow = '0 20px 50px -15px rgba(0,0,0,0.12), 0 4px 12px rgba(212,174,106,0.08)';
      }
      if (topAccent) {
        topAccent.style.width = '40px';
        topAccent.style.height = '3px';
        topAccent.style.borderRadius = '0 0 4px 4px';
        topAccent.style.left = '50%';
        topAccent.style.transform = 'translateX(-50%)';
        topAccent.style.background = 'linear-gradient(90deg, transparent, #d4a373, transparent)';
        topAccent.style.display = 'block';
        topAccent.innerHTML = '';
      }
      if (title) {
        title.textContent = 'A Letter';
        title.style.fontFamily = 'serif';
        title.style.fontStyle = 'italic';
        title.style.fontWeight = 'normal';
        title.style.fontSize = '22px';
        title.style.color = '#1a1a1a';
        title.style.letterSpacing = '-0.02em';
      }
      if (subtitle) {
        subtitle.textContent = '✦ scan to open your letter ✦';
        subtitle.style.color = '#d4a373';
      }
      if (branding) {
        branding.textContent = 'letter edition';
        branding.style.color = '#c4b49a';
        branding.style.fontWeight = 'normal';
      }
    }
    // Generate QR Code
    if (qrBox && typeof QRCode !== 'undefined') {
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: url,
        width: 148,
        height: 148,
        colorDark: '#1a1a1a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      
      // Fix for mobile: qrcode.js might use canvas instead of img on some devices.
      const styleTag = document.createElement('style');
      styleTag.textContent = '#qr-code-box img, #qr-code-box canvas { margin: 0 auto !important; display: block; border-radius: 8px; }';
      qrBox.appendChild(styleTag);
    }

    // Bind Download QR Button
    const downloadBtn = document.getElementById('btn-download-qr');
    if (downloadBtn) {
      const newBtn = downloadBtn.cloneNode(true);
      downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
      newBtn.addEventListener('click', _handleDownloadQR);
    }

    // Toggle sidebar bonus section/history visibility in real-time
    if (typeof Studio !== 'undefined' && Studio.updateSidebarBonusStatus) {
      Studio.updateSidebarBonusStatus();
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

    try {
      const canvas = await html2canvas(exportNode, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Letter_QR_${Math.floor(Date.now() / 1000)}.png`;
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
      });
    }
  }

  function _handleCopyLink() {
    const url = document.getElementById('modal-gift-url')?.textContent;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('btn-copy-link');
      if (btn) { btn.textContent = 'TERSALIN ✓'; setTimeout(() => btn.textContent = 'Salin Link', 2000); }
    }).catch(() => Studio.showToast('Gagal salin. Coba manual.'));
  }

  // ── VIP Flow ───────────────────────────────────────────────
  function _handleVipClick() {
    if (Music.isUploading()) {
      Studio.showToast('Tunggu upload musik selesai dulu');
      return;
    }
    document.getElementById('input-request-domain').value = '';
    _toggleModal('modal-name-vip', true);
  }

  async function _doVipSubmit() {
    const domainRaw = document.getElementById('input-request-domain')?.value.trim().toLowerCase();
    if (!domainRaw) { Studio.showToast('Nama domain tidak boleh kosong!'); return; }

    const domain = domainRaw.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (domain.length < 3) { Studio.showToast('Nama domain minimal 3 karakter.'); return; }

    const btn = document.getElementById('btn-confirm-name-vip');
    if (btn) { btn.textContent = 'Mengirim...'; btn.disabled = true; }

    try {
      const token   = Auth.getToken();
      const payload = { id: token, ...Autosave.buildState(), requestDomain: domain, requestedAt: new Date().toISOString() };

      const res  = await fetch(`${Auth.getWorkerUrl()}/submit-premium`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal mengirim.');

      _toggleModal('modal-name-vip', false);
      _showVipSuccess(token, domain);

    } catch (err) {
      Studio.showToast(err.message || 'Gagal mengirim. Coba lagi.');
    } finally {
      if (btn) { btn.textContent = 'Lanjutkan & Request'; btn.disabled = false; }
    }
  }

  function _showVipSuccess(token, domain) {
    const state = Autosave.buildState();
    const waMsg = encodeURIComponent(
      `REQUEST LINK PERSONAL — LETTER EDITION (+5K)\n\n` +
      `Letter ID: ${token}\n` +
      `Request Domain: ${domain}.vercel.app\n` +
      `Font: ${state.fontFamily}\n` +
      `Size: ${state.fontSize}\n\n` +
      `Halo admin, saya ingin request link personal untuk surat digital saya.`
    );
    const waBtn = document.getElementById('btn-contact-admin-vip');
    if (waBtn) waBtn.href = `https://wa.me/6281381543981?text=${waMsg}`;
    _toggleModal('modal-success-vip', true);
  }

  async function _doClaimBonus() {
    const bonusIdRaw = document.getElementById('input-bonus-id')?.value.trim().toLowerCase();
    if (!bonusIdRaw) { Studio.showToast('ID surat tidak boleh kosong!'); return; }

    const newId = bonusIdRaw.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (newId.length < 3) { Studio.showToast('ID surat minimal 3 karakter.'); return; }

    const btn = document.getElementById('btn-confirm-bonus-claim');
    if (btn) { btn.textContent = 'Membuat...'; btn.disabled = true; }

    try {
      const parentId = Auth.getToken();
      const res = await fetch(`${Auth.getWorkerUrl()}/create-bonus-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, newId })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal membuat surat bonus.');

      Studio.showToast('Surat bonus berhasil dibuat! Mengalihkan...');

      // Update local configuration state
      const initConfig = Auth.getInitialConfig();
      if (initConfig) initConfig.bonusCreatedId = newId;

      _toggleModal('modal-bonus-claim', false);
      _toggleModal('modal-success', false);

      if (typeof Studio !== 'undefined' && Studio.updateSidebarBonusStatus) {
        Studio.updateSidebarBonusStatus();
      }

      // Redirect to the new studio URL
      setTimeout(() => {
        window.location.href = `${window.location.protocol}//${window.location.host}/studio/${newId}`;
      }, 1500);

    } catch (err) {
      Studio.showToast(err.message || 'Gagal membuat surat bonus. Coba lagi.');
    } finally {
      if (btn) { btn.textContent = 'Buat Surat Bonus'; btn.disabled = false; }
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Publisher.init);
