/**
 * wrapped-uploader.js & letter-uploader.js
 * Helper modules untuk upload foto di Wrapped dan Surat
 * Loves Edition Studio
 */

// ── Wrapped Photo Uploader ────────────────────────────────────────────────
const WrappedUploader = (() => {
  let _imageUrl = null;
  let _isUploading = false;

  function init(savedUrl) {
    _imageUrl = savedUrl || null;
    _render();
    _bindEvents();
  }

  function _render() {
    const zone = document.getElementById('wrapped-photo-dropzone');
    if (!zone) return;

    if (_imageUrl) {
      zone.innerHTML = `
        <div class="relative">
          <img src="${_imageUrl}" class="w-full h-40 object-cover rounded-xl" alt="Wrapped Photo">
          <button class="btn-remove-wrapped-img absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full text-[10px] flex items-center justify-center hover:bg-rose-500 hover:text-white shadow-sm">✕</button>
        </div>
      `;
      zone.querySelector('.btn-remove-wrapped-img')?.addEventListener('click', () => {
        _imageUrl = null;
        _render();
        Autosave.trigger();
      });
    } else {
      zone.innerHTML = `<p class="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-medium">Upload Foto Utama</p>`;
    }
  }

  function _bindEvents() {
    const zone = document.getElementById('wrapped-photo-dropzone');
    const fileInput = document.getElementById('file-wrapped-photo');
    if (!fileInput) return;

    // Create hidden file input if not exists
    if (!document.getElementById('file-wrapped-photo')) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'file-wrapped-photo'; inp.accept = 'image/*'; inp.className = 'hidden';
      document.body.appendChild(inp);
    }

    zone?.addEventListener('click', (e) => {
      if (!e.target.classList.contains('btn-remove-wrapped-img')) {
        document.getElementById('file-wrapped-photo')?.click();
      }
    });

    document.getElementById('file-wrapped-photo')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { Studio.showToast('Foto terlalu besar (maks 10MB)'); return; }
      _isUploading = true;
      zone.innerHTML = `<div class="flex items-center justify-center gap-2"><div class="w-4 h-4 border-2 border-gray-200 border-t-[#d4a373] rounded-full animate-spin"></div><p class="text-[9px] uppercase tracking-widest text-gray-400">Uploading...</p></div>`;
      try {
        _imageUrl = await uploadToR2(file);
        _render();
        Autosave.trigger();
      } catch (err) {
        Studio.showToast('Upload gagal: ' + err.message);
        _render();
      }
      _isUploading = false;
      e.target.value = '';
    });
  }

  function getImageUrl() { return _imageUrl; }
  function isUploading() { return _isUploading; }

  return { init, getImageUrl, isUploading };
})();


// ── Letter Attachment Uploader ────────────────────────────────────────────
const LetterUploader = (() => {
  let _attachmentUrl = null;
  let _isUploading = false;

  function init(savedUrl) {
    _attachmentUrl = savedUrl || null;
    _render();
    _bindEvents();
  }

  function _render() {
    const zone = document.getElementById('letter-attachment-zone');
    if (!zone) return;

    if (_attachmentUrl) {
      zone.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${_attachmentUrl}" class="w-12 h-12 object-cover rounded-lg border border-gray-100 shadow-sm" alt="Lampiran">
          <div class="flex-1">
            <p class="text-[10px] font-bold text-gray-700">Foto Lampiran</p>
            <p class="text-[9px] text-[#d4a373]">✓ Tersimpan di cloud</p>
          </div>
          <button class="btn-remove-attachment text-[9px] text-gray-400 hover:text-rose-500 flex-shrink-0">Ganti</button>
        </div>
      `;
      zone.querySelector('.btn-remove-attachment')?.addEventListener('click', () => {
        _attachmentUrl = null; _render(); Autosave.trigger();
      });
    } else {
      zone.innerHTML = `
        <h3 class="font-bold text-[#b58756] text-[9px] mb-2 uppercase tracking-[0.2em]">Upload Foto Lampiran</h3>
        <p class="text-[9.5px] text-gray-500 leading-relaxed italic">Upload foto polaroid untuk disisipkan di dalam amplop surat.</p>
      `;
    }
  }

  function _bindEvents() {
    const zone = document.getElementById('letter-attachment-zone');
    const fileInput = document.getElementById('file-letter-attachment');

    zone?.addEventListener('click', (e) => {
      if (!e.target.classList.contains('btn-remove-attachment')) {
        fileInput?.click();
      }
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      _isUploading = true;
      zone.innerHTML = `<div class="flex items-center justify-center gap-2"><div class="w-4 h-4 border-2 border-gray-200 border-t-[#d4a373] rounded-full animate-spin"></div><p class="text-[9px] text-gray-400">Uploading...</p></div>`;
      try {
        _attachmentUrl = await uploadToR2(file);
        _render();
        Autosave.trigger();
      } catch (err) {
        Studio.showToast('Upload gagal: ' + err.message);
        _render();
      }
      _isUploading = false;
      e.target.value = '';
    });
  }

  function getAttachmentUrl() { return _attachmentUrl; }
  function isUploading() { return _isUploading; }

  return { init, getAttachmentUrl, isUploading };
})();
