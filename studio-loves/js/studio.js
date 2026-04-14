/**
 * studio.js — Main Controller
 * Loves Edition Studio
 *
 * Urutan init:
 * 1. Auth.init() → fetch config dari KV
 * 2. initPostAuth() → populate semua modul dengan data dari KV
 * 3. Bind global events (autosave triggers)
 */

const Studio = (() => {
  let _studioPassword = null;

  async function init() {
    const isReady = await Auth.init();
    if (isReady) initPostAuth();
    // Kalau false, Auth sudah handle auth-gate — initPostAuth dipanggil dari auth.js setelah unlock
  }

  function initPostAuth() {
    const config = Auth.getInitialConfig();
    _studioPassword = config?.studioPassword || null;

    // Init semua modul dengan data dari KV
    AppManager.init(config?.active_pages || null);
    Uploader.init(config?.gallery?.photos || []);
    Music.init({ playlist: config?.music || [] });
    WrappedUploader.init(config?.wrapped?.imageUrl || null);
    WrappedItems.init(config?.wrapped?.topPlaces || [], config?.wrapped?.coreMemories || []);
    Preview.init();
    Publisher.init();

    // Populate form fields dari config KV
    _populateForm(config || {});

    // Bind autosave ke semua input teks
    _bindGlobalInputs();

    // Tampilkan studio
    document.getElementById('studio-main')?.classList.remove('hidden');
    document.getElementById('loading-screen')?.classList.add('hidden');
  }

  function _populateForm(config) {
    // LOGIN
    _setVal('input-login-password', config.login?.password);
    _setVal('input-login-hint', config.login?.instruction);
    _setVal('input-studio-password', config.studioPassword);

    // MUSIC — handled entirely by music.js (arcade-style), no form fields to populate

    // GALLERY
    _setVal('input-gallery-title', config.gallery?.title);
    _setVal('input-gallery-subtitle', config.gallery?.subtitle);

    // WRAPPED
    const dateInput = document.getElementById('input-wrapped-date');
    if (dateInput) {
      dateInput.max = new Date().toISOString().split('T')[0]; // Max today
    }
    _setVal('input-wrapped-date', config.wrapped?.minutesTogether);
    _setVal('input-wrapped-vibe', config.wrapped?.vibe);
    
    // Set labels
    const tpLabel = config.wrapped?.topPlacesLabel || 'Top Places';
    const cmLabel = config.wrapped?.coreMemoriesLabel || 'Core Memories';
    _setVal('select-top-places-label', tpLabel);
    _setVal('select-core-memories-label', cmLabel);
    
    // Update displays
    const tpDisp = document.getElementById('label-display-top-places');
    const cmDisp = document.getElementById('label-display-core-memories');
    if (tpDisp) tpDisp.textContent = tpLabel;
    if (cmDisp) cmDisp.textContent = cmLabel;

    // Places & memories handled by WrappedItems module

    // SURAT
    _setVal('input-letter-to', config.surat?.to);
    _setVal('input-letter-msg', config.surat?.message);
    _setVal('input-letter-from', config.surat?.from);

    // INVITATION
    _setVal('input-inv-question', config.invitation?.question);
    _setVal('input-inv-success', config.invitation?.successMessage);
  }

  function _setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  function _bindGlobalInputs() {
    // Semua input teks, textarea, & select di editor → trigger autosave
    document.querySelectorAll('#editor-panel input:not([type="file"]):not([type="checkbox"]), #editor-panel textarea, #editor-panel select').forEach(el => {
      el.addEventListener('input', Autosave.trigger);
      el.addEventListener('change', Autosave.trigger);
    });

    // ── Label Selector Logic ──
    const labelModal = document.getElementById('modal-label-selector');
    const labelModalTitle = document.getElementById('label-modal-title');
    const optionsContainer = document.getElementById('label-options-container');
    const closeBtn = document.getElementById('btn-close-label-modal');

    const labelSets = {
      'top-places': ['Top Places', 'Bucket List', 'Top Activities'],
      'core-memories': ['Core Memories', 'Top Song', 'Favorite Movie']
    };

    document.querySelectorAll('.btn-change-label').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target; // 'top-places' or 'core-memories'
        const options = labelSets[target];
        
        labelModalTitle.textContent = target === 'top-places' ? 'Ganti Judul Top Places' : 'Ganti Judul Core Memories';
        optionsContainer.innerHTML = '';
        
        options.forEach(opt => {
          const optBtn = document.createElement('button');
          optBtn.className = 'w-full py-4 px-6 text-[10px] uppercase tracking-widest font-bold bg-[#fdf9f4] border border-[#d4a373]/20 text-[#b58756] rounded-2xl hover:bg-[#d4a373] hover:text-white transition-all text-left shadow-sm flex items-center justify-between group';
          optBtn.innerHTML = `<span>${opt}</span><span class="opacity-0 group-hover:opacity-100 transition-opacity">→</span>`;
          
          optBtn.onclick = () => {
            // Update hidden input
            const hiddenInput = document.getElementById(`select-${target}-label`);
            if (hiddenInput) hiddenInput.value = opt;
            
            // Update UI display
            const display = document.getElementById(`label-display-${target}`);
            if (display) display.textContent = opt;
            
            // Refresh placeholders
            WrappedItems.refresh();
            
            // Close & Save
            labelModal.classList.add('hidden');
            Autosave.trigger();
          };
          optionsContainer.appendChild(optBtn);
        });

        labelModal.classList.remove('hidden');
      });
    });

    closeBtn?.addEventListener('click', () => labelModal.classList.add('hidden'));
  }

  // ── Toast Notification ────────────────────────────────────────────────
  let _toastTimer = null;
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    if (_toastTimer) clearTimeout(_toastTimer);
    t.textContent = msg;
    t.classList.remove('hidden');
    _toastTimer = setTimeout(() => { t.classList.add('hidden'); _toastTimer = null; }, 3000);
  }

  function showError(inputId, msg) {
    const el = document.getElementById(inputId);
    if (el) {
      el.classList.add('border-rose-400');
      el.focus();
      setTimeout(() => el.classList.remove('border-rose-400'), 3000);
    }
    showToast(msg);
  }

  function clearErrors() {
    document.querySelectorAll('.border-rose-400').forEach(el => el.classList.remove('border-rose-400'));
  }

  function getStudioPassword() { return _studioPassword; }

  return { init, initPostAuth, showToast, showError, clearErrors, getStudioPassword };
})();

// ── Entrypoint ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', Studio.init);
