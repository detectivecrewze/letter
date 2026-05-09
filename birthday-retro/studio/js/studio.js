/**
 * studio.js — Main Studio controller
 * Birthday Retro Studio
 */
const Studio = (() => {
  let _isPremium = false;
  let _playlist = [];

  function isPremium() { return _isPremium; }
  function getPlaylistArray() { return typeof Music !== 'undefined' ? Music.getPlaylistArray() : _playlist; }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.classList.add('hidden'), 300); }, 2500);
  }

  async function init() {
    const ok = await Auth.init();
    if (ok) initPostAuth();
  }

  function initPostAuth() {
    const cfg = Auth.getInitialConfig() || {};
    _isPremium = cfg.isPremium === true;

    // Populate fields from saved config
    _setVal('input-recipient-name', cfg.recipientName);
    _setVal('input-age', cfg.age);
    _setVal('input-stage1-heading', cfg.stage1_heading || `Happy ${cfg.age || '?'}th Birthday!`);
    _setVal('input-stage2-question', cfg.stage2_question || 'i have a surprise for\nyou, wanna see it?');
    _setVal('input-stage4-text', cfg.stage4_reveal_text || "it's a birthday surprise!! :D");
    _setVal('input-stage5-wishes', cfg.stage5_wishes);

    // Initialize Music Manager
    if (typeof Music !== 'undefined') {
      Music.setPremiumMode(_isPremium);
      Music.init(cfg);
    }

    // Theme & Premium Lock
    const themeOverlay = document.getElementById('theme-lock-overlay');
    const themeInput = document.getElementById('input-theme');
    
    _setVal('input-theme', cfg.theme || 'classic');
    
    function applyStudioTheme() {
      const val = themeInput?.value || 'classic';
      let color = '#008080';
      if (val === 'rosepink') color = '#e8a8b8';
      else if (val === 'y2k') color = '#c8bfe7';
      else if (val === 'sky') color = '#99b4d1';
      else if (val === 'midnight') color = '#1a252c';
      document.documentElement.style.setProperty('--desktop', color);
    }
    
    applyStudioTheme(); // Apply immediately
    themeInput?.addEventListener('change', applyStudioTheme);

    if (!_isPremium) {
      if (themeOverlay) themeOverlay.classList.remove('hidden');
      if (themeInput) themeInput.disabled = true;
    } else {
      if (themeOverlay) themeOverlay.classList.add('hidden');
      if (themeInput) themeInput.disabled = false;
    }
    
    // Login & Premium Lock
    const loginOverlay = document.getElementById('login-lock-overlay');
    const passwordInput = document.getElementById('input-gift-password');
    const hintInput = document.getElementById('input-gift-hint');
    
    _setVal('input-gift-password', cfg.giftPassword || '');
    _setVal('input-gift-hint', cfg.giftHint || '');
    
    if (!_isPremium) {
      if (loginOverlay) loginOverlay.classList.remove('hidden');
      if (passwordInput) passwordInput.disabled = true;
      if (hintInput) hintInput.disabled = true;
    } else {
      if (loginOverlay) loginOverlay.classList.add('hidden');
      if (passwordInput) passwordInput.disabled = false;
      if (hintInput) hintInput.disabled = false;
    }

    // Auto-generate heading when name/age changes
    const nameInput = document.getElementById('input-recipient-name');
    const ageInput = document.getElementById('input-age');
    const headingInput = document.getElementById('input-stage1-heading');

    function autoHeading() {
      const name = nameInput?.value.trim() || '';
      const age = ageInput?.value.trim() || '';
      if (headingInput && !headingInput.dataset.userEdited) {
        const suffix = age ? `${age}th` : '';
        headingInput.value = `Happy ${suffix} Birthday${name ? ', ' + name : ''}!`;
      }
    }
    nameInput?.addEventListener('input', () => { autoHeading(); Autosave.trigger(); });
    ageInput?.addEventListener('input', () => { autoHeading(); Autosave.trigger(); });
    headingInput?.addEventListener('input', () => { headingInput.dataset.userEdited = '1'; Autosave.trigger(); });

    // Bind autosave to all inputs and selects
    document.querySelectorAll('#studio-main textarea, #studio-main input[type="text"]').forEach(el => {
      el.addEventListener('input', () => Autosave.trigger());
    });
    document.querySelectorAll('#studio-main select').forEach(el => {
      el.addEventListener('change', () => Autosave.trigger());
    });

    // Secret Media (Premium Lock)
    const memoryOverlay = document.getElementById('memory-lock-overlay');
    const memoryFileInput = document.getElementById('input-memory-file');
    if (!_isPremium) {
      if (memoryOverlay) memoryOverlay.classList.remove('hidden');
      if (memoryFileInput) memoryFileInput.disabled = true;
    } else {
      if (memoryOverlay) memoryOverlay.classList.add('hidden');
      if (memoryFileInput) memoryFileInput.disabled = false;
    }
    
    _mediaList = cfg.secretMediaList || [];
    _renderGallery();
    _initMemoryUpload();

    // Premium badge
    const badge = document.getElementById('premium-badge');
    if (badge) badge.textContent = _isPremium ? '✨ Premium' : 'Free';

    // Show studio
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('studio-main')?.classList.remove('hidden');

    showToast('Studio siap! 🎂');
  }

  // ── Secret Memory — Multi-Photo Gallery ─────────────────
  let _mediaList = [];
  const MAX_PHOTOS = 10;

  function _renderGallery() {
    const listEl = document.getElementById('memory-gallery-list');
    const addWrap = document.getElementById('memory-add-wrap');
    const countEl = document.getElementById('memory-count-label');
    if (!listEl) return;

    listEl.innerHTML = '';

    _mediaList.forEach((item, idx) => {
      const isVideo = /\.(mp4|webm|mov|ogg)/i.test(item.url);
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '8px';
      div.style.background = '#fff';
      div.style.border = '2px inset #d4d0c8';
      div.style.padding = '8px';
      
      div.innerHTML = `
        <div style="width:48px;height:48px;flex-shrink:0;background:#000;border:2px inset #fff;border-color:#808080 #fff #fff #808080;">
          ${isVideo
          ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;">▶</div>`
          : `<img src="${item.url}" alt="" style="width:100%;height:100%;object-fit:cover;">`
        }
        </div>
        <input type="text" maxlength="60" placeholder="Caption..." value="${item.caption || ''}" class="win-input" style="flex:1;" data-idx="${idx}">
        <button data-remove="${idx}" class="win-btn" style="min-width:32px; font-weight:bold; color:red;">✕</button>
      `;

      const captionInput = div.querySelector(`input[data-idx="${idx}"]`);
      captionInput?.addEventListener('input', (e) => {
        _mediaList[idx].caption = e.target.value;
        Autosave.trigger();
      });

      div.querySelector(`[data-remove="${idx}"]`)?.addEventListener('click', () => {
        _mediaList.splice(idx, 1);
        _renderGallery();
        Autosave.trigger();
      });

      listEl.appendChild(div);
    });

    const count = _mediaList.length;
    if (countEl) {
      if (count > 0) {
        countEl.textContent = `${count} / ${MAX_PHOTOS} media`;
        countEl.style.display = 'block';
      } else {
        countEl.style.display = 'none';
      }
    }

    if (addWrap) addWrap.style.display = count >= MAX_PHOTOS ? 'none' : 'block';

    // Show/hide Preview Foto button
    const previewBtnWrap = document.getElementById('memory-preview-btn-wrap');
    if (previewBtnWrap) {
      previewBtnWrap.style.display = (_isPremium && count > 0) ? 'block' : 'none';
    }
  }

  function _initMemoryUpload() {
    const fileInput = document.getElementById('input-memory-file');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      fileInput.value = '';
      if (!files.length) return;

      const slots = MAX_PHOTOS - _mediaList.length;
      const toUpload = files.slice(0, slots);
      if (files.length > slots) showToast(`Max ${slots} media left!`);

      for (const file of toUpload) {
        const url = await _uploadOneToR2(file);
        if (url) {
          _mediaList.push({ url, caption: '' });
          _renderGallery();
        }
      }
      Autosave.trigger();
    });
  }

  async function _uploadOneToR2(file) {
    const workerUrl = Auth.getWorkerUrl();
    const token = Auth.getToken();
    if (!workerUrl || !token) { showToast('Auth error'); return null; }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) { showToast('Invalid file type'); return null; }
    if (file.size > 15 * 1024 * 1024) { showToast('File too large (> 15MB)'); return null; }

    const progressWrap = document.getElementById('memory-upload-progress-wrap');
    const progressBar = document.getElementById('memory-upload-progress-bar');
    const statusText = document.getElementById('memory-upload-status');

    if (progressWrap) progressWrap.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '10%';
    if (statusText) statusText.textContent = `Uploading ${file.name}...`;

    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const ext = file.name.split('.').pop().toLowerCase();
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const key = `letters/${timestamp}-${randomStr}-${baseName}.${ext}`;

      if (progressBar) progressBar.style.width = '40%';

      const res = await fetch(`${workerUrl}/upload-direct/${key}?id=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!res.ok) throw new Error('Upload failed');

      if (progressBar) progressBar.style.width = '90%';
      const data = await res.json();
      const rawUrl = data.url || data.publicUrl || '';
      const cdnUrl = rawUrl.replace('letter-assets', 'arcade-assets') + '?v=' + timestamp;

      if (progressBar) progressBar.style.width = '100%';
      if (statusText) statusText.textContent = `Success ✓`;
      showToast('Media uploaded!');

      setTimeout(() => {
        if (progressWrap) progressWrap.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (statusText) statusText.textContent = '';
      }, 1000);

      return cdnUrl;
    } catch (err) {
      console.error(err);
      showToast('Upload failed');
      if (progressWrap) progressWrap.classList.add('hidden');
      return null;
    }
  }

  function getMediaList() { return _mediaList; }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  return { init, initPostAuth, isPremium, getPlaylistArray, showToast, getMediaList };
})();

document.addEventListener('DOMContentLoaded', Studio.init);
