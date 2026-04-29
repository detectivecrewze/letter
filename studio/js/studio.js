/**
 * studio.js — Main coordinator for Letter Edition Studio
 */
const Studio = (() => {

  let _studioPassword = '';
  let _activeTheme = 'blush-cream';
  let _activeTexture = 'normal';

  function initPostAuth() {
    const config = Auth.getInitialConfig() || {};
    _populate(config);
    Music.init(config);
    Autosave.init();
    _bindInputs();
    _initCollapse();
    showToast('Studio siap ✨');
  }

  function _populate(config) {
    _studioPassword = config.studioPassword || '';
    _setVal('input-recipient-name', config.recipientName || config.to || '');
    _setVal('input-letter-title', config.title || '');
    _setVal('input-letter-date', config.date || '');
    _setVal('input-letter-to', config.letterTo || config.salutation || '');
    _setVal('input-letter-msg', config.message || config.letter_body || '');
    _setVal('input-letter-from', config.from || '');
    _setVal('input-login-password', config.login_password || '');
    _setVal('input-login-hint', config.login_hint || '');

    // Section 4 — Memori Rahasia (multi-photo)
    const isEnabled = config.secretMemoryEnabled === true;
    _applyMemoryLock(isEnabled);

    // Premium locks — theme, password, music
    const isPrem = config.isPremium === true;
    _applyPremiumLock(isPrem);
    Music.setPremiumMode(isPrem);

    const existingList = config.secretMediaList || [];
    if (isEnabled && existingList.length) {
      setTimeout(() => {
        _mediaList = existingList.slice(0, 10);
        _renderGallery();
      }, 0);
    }

    // Theme Initial State
    _activeTheme = config.theme || 'blush-cream';
    document.querySelectorAll('.theme-option').forEach(btn => {
      if (btn.dataset.theme === _activeTheme) btn.classList.add('active');
    });

    // Texture Initial State (Default always 'normal' unless specifically saved as 'handmade')
    _activeTexture = config.paperTexture || 'normal';
    document.querySelectorAll('.texture-option').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.texture === _activeTexture) btn.classList.add('active');
    });
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function _bindInputs() {
    [
      'input-recipient-name',
      'input-letter-title',
      'input-letter-date',
      'input-letter-to',
      'input-letter-msg',
      'input-letter-from',
      'input-login-password',
      'input-login-hint',
    ].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => Autosave.trigger());
    });

    // Upload binding
    _initMemoryUpload();

    // Manual Save Button
    document.getElementById('btn-save-draft')?.addEventListener('click', async () => {
      showToast('Menyimpan draft...');
      await Autosave.saveNow();
      showToast('Draft berhasil disimpan! ✓');
    });

    // Theme Selection Binding
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _activeTheme = btn.dataset.theme;
        Autosave.trigger();
        showToast(`Tema '${_activeTheme}' dipilih`);
      });
    });

    // Texture Selection Binding
    document.querySelectorAll('.texture-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.texture-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _activeTexture = btn.dataset.texture;
        Autosave.trigger();
        showToast(`Tekstur '${_activeTexture}' dipilih`);
      });
    });
  }

  function _applyPremiumLock(isPrem) {
    // ── 1. Premium Upgrade Button vs Badge & VIP Link ──────────
    const upgSection = document.getElementById('premium-upgrade-section');
    const actBadge = document.getElementById('premium-active-badge');
    const btnVip = document.getElementById('btn-publish-vip');

    if (upgSection && actBadge && btnVip) {
      const lockIcon = btnVip.querySelector('.vip-lock-icon');
      if (isPrem) {
        upgSection.classList.add('hidden');
        actBadge.classList.remove('hidden');
        btnVip.disabled = false;
        btnVip.style.opacity = '1';
        btnVip.style.pointerEvents = 'auto';
        if (lockIcon) lockIcon.classList.add('hidden');
      } else {
        upgSection.classList.remove('hidden');
        actBadge.classList.add('hidden');
        btnVip.disabled = true;
        btnVip.style.opacity = '0.5';
        btnVip.style.pointerEvents = 'none';
        if (lockIcon) lockIcon.classList.remove('hidden');
      }
    }

    // ── 2. Password section — show content but block interaction ──
    const passSection = document.getElementById('password-lock-section');
    if (passSection) {
      passSection.querySelector('.password-lock-badge')?.remove();
      if (!isPrem) {
        // Make inputs visible but non-interactable
        passSection.querySelectorAll('input').forEach(el => {
          el.style.pointerEvents = 'none';
          el.style.opacity = '0.45';
          el.readOnly = true;
        });
        // Small premium badge inserted nicely below the header
        const badge = document.createElement('div');
        badge.className = 'password-lock-badge mb-4 inline-flex items-center gap-1.5 bg-gray-800 text-white text-[8px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full shadow-md pointer-events-none';
        badge.innerHTML = `<span class="text-[10px]">🔒</span> Fitur Premium`;

        const header = passSection.querySelector('.flex.items-center');
        if (header) {
          // Reset any flexWrap we might have added before
          header.style.flexWrap = '';
          // Insert right after the header
          header.insertAdjacentElement('afterend', badge);
        } else {
          passSection.insertBefore(badge, passSection.firstChild);
        }
      } else {
        passSection.querySelectorAll('input').forEach(el => {
          el.style.pointerEvents = '';
          el.style.opacity = '';
          el.readOnly = false;
        });
      }
    }

    // ── 3. Theme Locking ───────────────────────────────────────
    const premiumThemes = ['dusty-rose', 'midnight', 'crimson', 'obsidian'];
    document.querySelectorAll('.theme-option').forEach(btn => {
      const theme = btn.dataset.theme;
      // Remove existing locks
      const existingLock = btn.querySelector('.theme-lock-badge');
      if (existingLock) existingLock.remove();
      const existingPreview = btn.querySelector('.theme-preview-badge');
      if (existingPreview) existingPreview.remove();

      if (!isPrem && premiumThemes.includes(theme)) {
        // Block the main button click (selecting the theme)
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';

        // Lock badge (top-left, non-interactive label)
        const lockBadge = document.createElement('div');
        lockBadge.className = 'theme-lock-badge';
        lockBadge.style.cssText = [
          'position:absolute', 'top:-6px', 'left:-6px',
          'background:#1f2937', 'color:white', 'font-size:7px',
          'padding:2px 5px', 'border-radius:999px', 'font-weight:bold',
          'box-shadow:0 2px 4px rgba(0,0,0,0.2)', 'z-index:10',
          'pointer-events:none', 'white-space:nowrap'
        ].join(';');
        lockBadge.innerHTML = '🔒 PRO';
        btn.appendChild(lockBadge);

        // Preview button — overlay di dalam button (kanan bawah), tidak overflow keluar
        const previewBadge = document.createElement('div');
        previewBadge.className = 'theme-preview-badge';
        previewBadge.style.cssText = [
          'position:absolute', 'bottom:0', 'left:0', 'right:0',
          'background:rgba(212,163,115,0.92)',
          'color:white', 'font-size:6px',
          'padding:2px 0', 'font-weight:bold',
          'border-radius:0 0 999px 999px',
          'z-index:10',
          'pointer-events:auto', 'cursor:pointer', 'white-space:nowrap',
          'text-align:center',
          'transition:background 0.2s',
          'letter-spacing:0.05em'
        ].join(';');
        previewBadge.innerHTML = '👁 lihat';
        previewBadge.title = `Preview tema ${theme}`;

        previewBadge.addEventListener('mouseenter', () => { previewBadge.style.background = 'rgba(181,135,86,0.95)'; });
        previewBadge.addEventListener('mouseleave', () => { previewBadge.style.background = 'rgba(212,163,115,0.92)'; });
        previewBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          Preview.openThemePreview(theme);
        });
        btn.appendChild(previewBadge);

        // Revert to blush-cream if currently active theme is premium
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          const defaultThemeBtn = document.querySelector('.theme-option[data-theme="blush-cream"]');
          if (defaultThemeBtn) defaultThemeBtn.classList.add('active');
          _activeTheme = 'blush-cream';
        }
      }
    });

    // ── 4. Texture Locking ──────────────────────────────────────
    document.querySelectorAll('.texture-option').forEach(btn => {
      const existingLock = btn.querySelector('.texture-lock-badge');
      if (existingLock) existingLock.remove();

      if (!isPrem) {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
        const lockBadge = document.createElement('div');
        lockBadge.className = 'texture-lock-badge';
        lockBadge.style.cssText = 'position:absolute; top:-6px; right:-6px; background:#1f2937; color:white; font-size:7px; padding:2px 5px; border-radius:999px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:10; pointer-events:none;';
        lockBadge.innerHTML = '🔒 PRO';
        btn.appendChild(lockBadge);
        
        // Revert to normal if currently active texture is handmade
        if (btn.classList.contains('active') && btn.dataset.texture === 'handmade') {
          btn.classList.remove('active');
          const defaultBtn = document.querySelector('.texture-option[data-texture="normal"]');
          if (defaultBtn) defaultBtn.classList.add('active');
          _activeTexture = 'normal';
        }
      } else {
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
      }
    });
  }

  function _applyMemoryLock(isEnabled) {
    const lockOverlay = document.getElementById('memory-lock-overlay');
    const contentWrap = document.getElementById('memory-content-wrap');
    const previewBtn = document.getElementById('btn-preview-memory');

    if (isEnabled) {
      // Unlocked: hide overlay, show content
      if (lockOverlay) lockOverlay.classList.add('hidden');
      if (contentWrap) contentWrap.classList.remove('hidden');
      if (previewBtn) previewBtn.style.display = '';
    } else {
      // Locked: show overlay, hide actual content
      if (lockOverlay) lockOverlay.classList.remove('hidden');
      if (contentWrap) contentWrap.classList.add('hidden');
      if (previewBtn) previewBtn.style.display = 'none';
    }
  }

  function _initCollapse() {
    document.querySelectorAll('.section-collapse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.section-card');
        const body = card?.querySelector('.section-body');
        if (!body) return;
        const isCollapsed = body.classList.toggle('collapsed');
        btn.classList.toggle('collapsed', isCollapsed);
        card.classList.toggle('is-collapsed', isCollapsed);
      });
    });
  }

  function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  function showError(inputId, msg) {
    const el = document.getElementById(inputId);
    const errEl = document.getElementById(inputId + '-error');
    if (el) el.style.borderBottomColor = '#e57373';
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
  }

  function clearErrors() {
    document.querySelectorAll('[id$="-error"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.input-minimal').forEach(el => el.style.borderBottomColor = '');
  }

  // ── Secret Memory — Multi-Photo Gallery ─────────────────
  let _mediaList = []; // [{url, caption}, ...]
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
      div.className = 'flex items-center gap-3 p-3 bg-[#fdf9f4] rounded-2xl border border-[#d4a373]/10';
      div.innerHTML = `
        <!-- Thumbnail -->
        <div style="width:52px;height:52px;flex-shrink:0;border-radius:4px;overflow:hidden;background:#e8e0d8;">
          ${isVideo
          ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#d4a373;font-size:1.4rem;">▶</div>`
          : `<img src="${item.url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`
        }
        </div>
        <!-- Caption Input -->
        <input type="text" maxlength="40" placeholder="Caption (opsional)…"
          value="${item.caption || ''}"
          class="input-minimal flex-1"
          style="font-family: 'Caveat', cursive; font-size: 1.15rem; color: #4a3f35;"
          data-idx="${idx}" />
        <!-- Drag handle hint + Remove -->
        <div class="flex flex-col items-center gap-1 flex-shrink-0">
          <span class="text-gray-300 text-[9px] font-bold">${idx + 1}</span>
          <button data-remove="${idx}"
            class="text-red-300 hover:text-red-500 transition text-[11px] font-bold leading-none">✕</button>
        </div>
      `;

      // Caption change listener
      const captionInput = div.querySelector(`input[data-idx="${idx}"]`);
      captionInput?.addEventListener('input', (e) => {
        _mediaList[idx].caption = e.target.value;
        Autosave.trigger();
      });

      // Remove listener
      div.querySelector(`[data-remove="${idx}"]`)?.addEventListener('click', () => {
        _mediaList.splice(idx, 1);
        _renderGallery();
        Autosave.trigger();
        showToast('Foto dihapus');
      });

      listEl.appendChild(div);
    });

    // Update counter
    const count = _mediaList.length;
    if (countEl) {
      if (count > 0) {
        countEl.textContent = `${count} / ${MAX_PHOTOS} foto`;
        countEl.classList.remove('hidden');
      } else {
        countEl.classList.add('hidden');
      }
    }

    // Hide add button when at max
    if (addWrap) addWrap.style.display = count >= MAX_PHOTOS ? 'none' : '';
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
      if (files.length > slots) showToast(`Hanya ${slots} foto lagi yang bisa ditambahkan`);

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
    if (!workerUrl || !token) { showToast('Autentikasi diperlukan'); return null; }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) { showToast(`Tipe file tidak didukung: ${file.type}`); return null; }

    // Set limit to 15 MB for short videos/photos
    if (file.size > 15 * 1024 * 1024) { showToast(`File terlalu besar (maks 15 MB): ${file.name}`); return null; }

    const progressWrap = document.getElementById('memory-upload-progress-wrap');
    const progressBar = document.getElementById('memory-upload-progress-bar');
    const statusText = document.getElementById('memory-upload-status');
    const addWrap = document.getElementById('memory-add-wrap');

    if (progressWrap) progressWrap.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '10%';
    if (statusText) statusText.textContent = `Mengupload ${file.name}…`;
    if (addWrap) addWrap.style.pointerEvents = 'none';

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

      if (!res.ok) throw new Error('Upload gagal');

      if (progressBar) progressBar.style.width = '90%';
      const data = await res.json();
      const rawUrl = data.url || data.publicUrl || '';
      const cdnUrl = rawUrl.replace('letter-assets', 'arcade-assets') + '?v=' + timestamp;

      if (progressBar) progressBar.style.width = '100%';
      if (statusText) statusText.textContent = `${file.name} ✓`;
      showToast(`${file.name} berhasil diupload ✓`);

      setTimeout(() => {
        if (progressWrap) progressWrap.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (addWrap) addWrap.style.pointerEvents = '';
      }, 1000);

      return cdnUrl;
    } catch (err) {
      console.error('[MemoryUpload]', err);
      showToast(`Upload gagal: ${file.name}`);
      if (progressWrap) progressWrap.classList.add('hidden');
      if (addWrap) addWrap.style.pointerEvents = '';
      return null;
    }
  }

  function getMediaList() { return _mediaList; }
  function isMemoryEnabled() {
    return (Auth.getInitialConfig()?.secretMemoryEnabled === true);
  }
  function isPremium() {
    return (Auth.getInitialConfig()?.isPremium === true);
  }

  function getStudioPassword() { return _studioPassword; }
  function getActiveTheme() { return _activeTheme; }
  function getActiveTexture() { return _activeTexture; }

  return { initPostAuth, showToast, showError, clearErrors, getStudioPassword, getActiveTheme, getActiveTexture, getMediaList, isMemoryEnabled, isPremium };
})();

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.init();
  if (ok) Studio.initPostAuth();
});