/**
 * uploader.js — Photo & Video Upload & Management (Direct to R2)
 * Loves Edition Studio
 *
 * Alur:
 * 1. POST /presign  → Dapat key unik (prefix loves/) + CDN URL
 * 2. PUT  /upload-direct/:key → Upload binary LANGSUNG ke R2
 */

const Uploader = (() => {
  const MAX_ITEMS = 20;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB
  const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

  let _photos = []; // [{ id, url, caption, uploading, isVideo }]
  let _uploadingCount = 0;
  let _sortable = null;

  function init(existingPhotos) {
    if (existingPhotos && Array.isArray(existingPhotos)) {
      _photos = existingPhotos.map(p => ({
        id: Math.random().toString(36).substr(2, 9),
        url: typeof p === 'string' ? p : (p.url || ''),
        caption: typeof p === 'object' ? (p.caption || '') : '',
        isVideo: _isVideoUrl(typeof p === 'string' ? p : (p.url || '')),
        uploading: false
      }));
    }
    _bindEvents();
    _renderGrid();
  }

  function _isVideoUrl(url) {
    return /\.(mp4|webm|ogg|mov|qt)(\?|$)/i.test(url);
  }

  function _isVideoFile(file) {
    return ACCEPTED_VIDEO_TYPES.includes(file.type);
  }

  function _bindEvents() {
    const dropzone = document.getElementById('photo-dropzone');
    const fileInput = document.getElementById('file-gallery');
    const addBtn = document.getElementById('btn-add-moment');

    addBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', () => fileInput?.click());

    if (dropzone) {
      dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('border-[#d4a373]', 'bg-white');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-[#d4a373]', 'bg-white');
      });
      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('border-[#d4a373]', 'bg-white');
        _handleFiles(e.dataTransfer.files);
      });
    }

    fileInput?.addEventListener('change', e => {
      _handleFiles(e.target.files);
      fileInput.value = '';
    });
  }

  async function _handleFiles(fileList) {
    const files = Array.from(fileList).filter(f =>
      f.type.startsWith('image/') || _isVideoFile(f)
    );
    const remaining = MAX_ITEMS - _photos.length;
    if (remaining <= 0) { Studio.showToast('Maksimal 20 foto/video!'); return; }

    for (const file of files.slice(0, remaining)) {
      const isVideo = _isVideoFile(file);
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      const label = isVideo ? 'video' : 'foto';

      if (file.size > maxSize) {
        Studio.showToast(`${file.name} terlalu besar (maks ${isVideo ? '50' : '10'}MB untuk ${label})`);
        continue;
      }
      await _uploadItem(file, isVideo);
    }
  }

  async function _uploadItem(file, isVideo) {
    const localUrl = URL.createObjectURL(file);
    const placeholder = {
      id: Math.random().toString(36).substr(2, 9),
      url: localUrl,
      caption: '',
      isVideo,
      uploading: true
    };
    _photos.push(placeholder);
    _renderGrid();
    _uploadingCount++;

    try {
      const cdnUrl = await uploadToR2(file);
      placeholder.url = cdnUrl;
      placeholder.uploading = false;
      _renderGrid();
      Autosave.trigger();
    } catch (err) {
      _photos = _photos.filter(p => p !== placeholder);
      _renderGrid();
      Studio.showToast(`Gagal upload ${isVideo ? 'video' : 'foto'}: ` + err.message);
    }
    _uploadingCount--;
  }

  function _renderGrid() {
    const grid = document.getElementById('photo-grid');
    const dropzone = document.getElementById('photo-dropzone');
    const reorderHint = document.getElementById('gallery-reorder-hint');
    if (!grid) return;

    grid.innerHTML = '';
    const hasItems = _photos.length > 0;
    dropzone?.classList.toggle('hidden', hasItems);
    if (reorderHint) reorderHint.classList.toggle('hidden', !hasItems);

    _photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'relative group bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing';
      item.dataset.id = photo.id;

      const mediaEl = photo.isVideo
        ? `<video src="${photo.url}" class="w-full h-full object-cover" muted playsinline loop preload="metadata"></video>
           <div class="absolute bottom-2 left-2 bg-black/50 text-white text-[7px] uppercase tracking-widest px-1.5 py-0.5 rounded-full font-bold">Video</div>`
        : `<img src="${photo.url}" class="w-full h-full object-cover" alt="Photo ${i+1}" loading="lazy">`;

      item.innerHTML = `
        <div class="aspect-square relative overflow-hidden bg-gray-50">
          ${mediaEl}
          ${photo.uploading ? `
            <div class="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div class="w-5 h-5 border-2 border-gray-200 border-t-[#d4a373] rounded-full animate-spin"></div>
            </div>
          ` : ''}
          <div class="photo-number absolute top-2 left-2 w-5 h-5 bg-[#d4a373] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">${i+1}</div>
          <button class="btn-remove-photo absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full items-center justify-center text-[10px] hidden group-hover:flex hover:bg-rose-500 hover:text-white shadow-sm" data-id="${photo.id}">✕</button>
          <!-- Drag indicator -->
          <div class="drag-handle absolute bottom-2 right-2 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Geser untuk atur urutan">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="3" cy="2.5" r="1" fill="#d4a373"/><circle cx="7" cy="2.5" r="1" fill="#d4a373"/>
              <circle cx="3" cy="5" r="1" fill="#d4a373"/><circle cx="7" cy="5" r="1" fill="#d4a373"/>
              <circle cx="3" cy="7.5" r="1" fill="#d4a373"/><circle cx="7" cy="7.5" r="1" fill="#d4a373"/>
            </svg>
          </div>
        </div>
        <div class="px-3 py-2">
          <textarea class="photo-caption w-full text-[11px] text-center text-gray-600 bg-transparent border-b border-gray-100 focus:border-[#d4a373] focus:outline-none placeholder-gray-300 resize-none leading-relaxed italic" placeholder="Tulis cerita di sini..." maxlength="120" rows="2" data-id="${photo.id}">${(photo.caption || '').replace(/"/g, '&quot;')}</textarea>
        </div>
      `;
      grid.appendChild(item);
    });

    // Init / re-init sortable drag-to-reorder
    if (_sortable) _sortable.destroy();
    if (hasItems && typeof Sortable !== 'undefined') {
      _sortable = new Sortable(grid, {
        animation: 180,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 120,             // slight delay so tap doesn't drag accidentally
        delayOnTouchOnly: true, // on desktop: drag immediately; touch: wait 120ms
        forceFallback: false,
        onEnd(evt) {
          // Re-order internal array to match new DOM order
          const newOrder = Array.from(grid.children).map(el => el.dataset.id);
          _photos.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
          _updateNumbers();
          Autosave.trigger();
        }
      });
    }

    // Play video on hover for preview
    grid.querySelectorAll('video').forEach(vid => {
      const wrapper = vid.closest('.aspect-square');
      wrapper?.addEventListener('mouseenter', () => vid.play().catch(() => {}));
      wrapper?.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    });

    grid.querySelectorAll('.btn-remove-photo').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('Hapus item ini?')) return;
        _photos = _photos.filter(p => p.id !== btn.dataset.id);
        _renderGrid();
        Autosave.trigger();
      });
    });

    grid.querySelectorAll('.photo-caption').forEach(inp => {
      inp.addEventListener('input', () => {
        const p = _photos.find(p => p.id === inp.dataset.id);
        if (p) { p.caption = inp.value; Autosave.trigger(); }
      });
    });
  }

  // Re-number the badges without full re-render (fast update after drag)
  function _updateNumbers() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return;
    grid.querySelectorAll('.photo-number').forEach((el, i) => { el.textContent = i + 1; });
  }

  function getPhotos() {
    return _photos.filter(p => !p.uploading).map(p => ({
      url: p.url,
      caption: p.caption || '',
      type: p.isVideo ? 'video' : 'image'
    }));
  }

  function isUploading() { return _uploadingCount > 0; }

  return { init, getPhotos, isUploading };
})();

// ── Shared R2 Upload Utility (dipakai juga oleh music.js) ──────────────────
async function uploadToR2(file) {
  const workerUrl = Auth.getWorkerUrl();

  // Step 1: Presign — minta key unik dari Worker
  const presignRes = await fetch(`${workerUrl}/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || `Presign gagal (${presignRes.status})`);
  }

  const { key, publicUrl } = await presignRes.json();

  // Step 2: Upload binary langsung ke R2 (tidak lewat FormData/memori Worker)
  const uploadRes = await fetch(`${workerUrl}/upload-direct/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error || `Upload gagal (${uploadRes.status})`);
  }

  return publicUrl;
}

// Alias untuk dipakai oleh modul lain
Uploader._uploadToR2 = uploadToR2;
