/**
 * autosave.js — Background state saving với debounce
 * Loves Edition Studio
 *
 * Mengumpulkan state dari semua modul lalu POST ke /save-config
 */

const Autosave = (() => {
  let _debounceTimer = null;
  const DEBOUNCE_MS = 2500;

  function trigger() {
    if (_debounceTimer) clearTimeout(_debounceTimer);

    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.textContent = 'Menyimpan...';
      saveStatus.classList.remove('opacity-0');
    }

    _debounceTimer = setTimeout(saveConfiguration, DEBOUNCE_MS);
  }

  function cancel() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) saveStatus.classList.add('opacity-0');
  }

  async function saveNow() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.textContent = 'Menyimpan...';
      saveStatus.classList.remove('opacity-0');
    }
    await saveConfiguration();
  }

  async function saveConfiguration() {
    // Tunggu kalau masih ada upload yang berjalan
    if (Uploader.isUploading() || Music.isUploading()) {
      trigger(); // Retry setelah upload selesai
      return;
    }

    const token = Auth.getToken();
    if (!token) return;

    // Kumpulkan semua state
    const state = _buildState(token);

    try {
      const res = await fetch(`${Auth.getWorkerUrl()}/save-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      const data = await res.json();

      const saveStatus = document.getElementById('save-status');
      if (data.success && saveStatus) {
        saveStatus.textContent = 'Tersimpan Otomatis ✓';
        setTimeout(() => saveStatus.classList.add('opacity-0'), 2000);
      } else if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (e) {
      console.warn('Autosave failed:', e);
      const saveStatus = document.getElementById('save-status');
      if (saveStatus) {
        saveStatus.textContent = 'Gagal Menyimpan';
        saveStatus.classList.remove('opacity-0');
        setTimeout(() => saveStatus.classList.add('opacity-0'), 4000);
      }
    }
  }

  function _buildState(token) {
    // Bagian Wrapped
    const placesRaw = document.getElementById('input-wrapped-places')?.value || '';
    const memoriesRaw = document.getElementById('input-wrapped-memories')?.value || '';

    return {
      id: token,
      studioPassword: document.getElementById('input-studio-password') ? document.getElementById('input-studio-password').value : Studio.getStudioPassword(),
      active_pages: AppManager.getActivePages(),

      login: {
        password:    document.getElementById('input-login-password')?.value.trim() || '',
        instruction: document.getElementById('input-login-hint')?.value.trim() || '',
      },

      music: Music.getPlaylistArray().map(t => ({
        ...t,
        songTitle: t.title,
        audioSrc: t.url,
        coverSrc: t.coverUrl,
        lyrics: t.quotes
      })),

      gallery: {
        title:    document.getElementById('input-gallery-title')?.value.trim() || '',
        subtitle: document.getElementById('input-gallery-subtitle')?.value.trim() || '',
        photos:   Uploader.getPhotos(),
      },

      wrapped: {
        imageUrl:        WrappedUploader.getImageUrl(),
        minutesTogether: document.getElementById('input-wrapped-date')?.value || '',
        vibe:            document.getElementById('input-wrapped-vibe')?.value.trim() || '',
        topPlaces:       WrappedItems.getPlaces(),
        coreMemories:    WrappedItems.getMemories(),
        topPlacesLabel:  document.getElementById('select-top-places-label')?.value || 'Top Places',
        coreMemoriesLabel: document.getElementById('select-core-memories-label')?.value || 'Core Memories',
      },

      surat: {
        to:            document.getElementById('input-letter-to')?.value.trim() || '',
        message:       document.getElementById('input-letter-msg')?.value || '',
        from:          document.getElementById('input-letter-from')?.value.trim() || '',
      },

      invitation: {
        question:       document.getElementById('input-inv-question')?.value.trim() || '',
        successMessage: document.getElementById('input-inv-success')?.value.trim() || '',
      },
    };
  }

  // Expose untuk dipakai Publisher
  function buildState() {
    return _buildState(Auth.getToken());
  }

  return { trigger, cancel, saveNow, buildState };
})();
