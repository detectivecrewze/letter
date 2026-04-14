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

    // VIP modal
    document.getElementById('btn-confirm-name-vip')?.addEventListener('click', _doVipSubmit);
    document.getElementById('btn-cancel-name-vip')?.addEventListener('click', () => _toggleModal('modal-name-vip', false));

    // Success modal
    document.getElementById('btn-copy-link')?.addEventListener('click', _handleCopyLink);
    document.getElementById('btn-close-success')?.addEventListener('click', () => _toggleModal('modal-success', false));
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
      Studio.showToast('Isi surat tidak boleh kosong 📝');
      return;
    }
    if (Music.isUploading()) {
      Studio.showToast('Tunggu upload musik selesai dulu ⏳');
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
        const url = `${location.protocol}//${location.host}/?to=${token}`;
        _showSuccessModal(url);
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (e) {
      Studio.showToast('Gagal publish: ' + e.message);
    } finally {
      _isPublishing = false;
      if (submitText) submitText.textContent = 'Publikasikan Surat 💌';
      if (submitBtn)  submitBtn.disabled = false;
    }
  }

  function _showSuccessModal(url) {
    const urlEl   = document.getElementById('modal-gift-url');
    const viewBtn = document.getElementById('btn-view-gift');
    const waBtn   = document.getElementById('btn-share-whatsapp');

    if (urlEl)   urlEl.textContent = url;
    if (viewBtn) viewBtn.href = url;
    if (waBtn) {
      const msg = encodeURIComponent(`💌 Ada surat untukmu...\n\n${url}`);
      waBtn.href = `https://wa.me/?text=${msg}`;
    }
    _toggleModal('modal-success', true);
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
      Studio.showToast('Tunggu upload musik selesai dulu ⏳');
      return;
    }
    document.getElementById('input-request-domain').value = '';
    _toggleModal('modal-name-vip', true);
  }

  async function _doVipSubmit() {
    const domainRaw = document.getElementById('input-request-domain')?.value.trim().toLowerCase();
    if (!domainRaw) { Studio.showToast('Nama domain tidak boleh kosong! 🌐'); return; }

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
    const waMsg = encodeURIComponent(
      `REQUEST LINK PERSONAL — LETTER EDITION (+10K)\n\n` +
      `Letter ID: ${token}\n` +
      `Request Domain: ${domain}.vercel.app\n\n` +
      `Halo admin, saya ingin request link personal untuk surat digital saya.`
    );
    const waBtn = document.getElementById('btn-contact-admin-vip');
    if (waBtn) waBtn.href = `https://wa.me/6281381543981?text=${waMsg}`;
    _toggleModal('modal-success-vip', true);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Publisher.init);
