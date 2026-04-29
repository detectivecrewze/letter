/**
 * autosave.js — Background debounced saving — Letter Edition Studio
 */
const Autosave = (() => {
  let _debounceTimer = null;
  const DEBOUNCE_MS  = 2500;

  function init() { /* nothing to init */ }

  function trigger() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _setSaveStatus('Menyimpan...');
    _debounceTimer = setTimeout(_saveConfiguration, DEBOUNCE_MS);
  }

  function cancel() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _setSaveStatus('', true);
  }

  async function saveNow() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _setSaveStatus('Menyimpan...');
    await _saveConfiguration();
  }

  async function _saveConfiguration() {
    if (Music.isUploading()) { trigger(); return; }

    const token = Auth.getToken();
    if (!token) return;

    try {
      const res  = await fetch(`${Auth.getWorkerUrl()}/save-config?id=${encodeURIComponent(token)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildState()),
      });
      const data = await res.json();

      if (data.success) {
        _setSaveStatus('Tersimpan Otomatis ✓');
        setTimeout(() => _setSaveStatus('', true), 2500);
      } else throw new Error(data.error || 'Unknown error');

    } catch (e) {
      console.warn('[Autosave]', e);
      _setSaveStatus('Gagal Menyimpan');
      setTimeout(() => _setSaveStatus('', true), 4000);
    }
  }

  function _setSaveStatus(text, hide = false) {
    const el = document.getElementById('save-status');
    if (!el) return;
    if (hide) { el.style.opacity = '0'; return; }
    el.textContent = text;
    el.style.opacity = '1';
  }

  function buildState() {
    const token = Auth.getToken();
    return {
      // Token
      studioToken:    token,
      giftId:         token,
      studioPassword: Studio.getStudioPassword(),

      // Section 1 — Penerima
      recipientName: document.getElementById('input-recipient-name')?.value.trim() || '',
      to:            document.getElementById('input-recipient-name')?.value.trim() || '',
      title:         document.getElementById('input-letter-title')?.value.trim() || '',
      date:          document.getElementById('input-letter-date')?.value.trim() || '',

      // Section 2 — Surat
      letterTo:      document.getElementById('input-letter-to')?.value.trim()  || '',
      salutation:    document.getElementById('input-letter-to')?.value.trim()  || '',
      message:       document.getElementById('input-letter-msg')?.value        || '',
      letter_body:   document.getElementById('input-letter-msg')?.value        || '',
      from:          document.getElementById('input-letter-from')?.value.trim() || '',
      
      // Auth Settings
      login_password: document.getElementById('input-login-password')?.value.trim() || '',
      login_hint:     document.getElementById('input-login-hint')?.value.trim()     || '',

      // Section 3 — Music
      playlist: Music.getPlaylistArray(),
      theme:    Studio.getActiveTheme(),
      paperTexture: Studio.getActiveTexture(),

      // Section 4 — Memori Rahasia (multi-photo carousel)
      // Only include if admin has whitelisted this letter for secret memory
      secretMediaList: Studio.isMemoryEnabled() ? Studio.getMediaList() : [],

      // Preserve server-controlled flags — never overwrite from studio
      secretMemoryEnabled: Auth.getInitialConfig()?.secretMemoryEnabled || false,
      isPremium:           Auth.getInitialConfig()?.isPremium           || false,

      // Meta
      status:         Auth.getInitialConfig()?.status || 'draft',
      is_active:      true,
      show_watermark: true,
      _meta:          { theme_folder: 'letter' },
      publishedAt:    Auth.getInitialConfig()?.publishedAt || null,
    };

    // Client-side free-tier guard (worker also enforces this server-side)
    if (!Studio.isPremium()) {
      state.login_password = '';
      state.login_hint     = '';
      state.playlist = (state.playlist || []).filter(t => t.isLibrary);
      if (['dusty-rose', 'midnight'].includes(state.theme)) {
        state.theme = 'blush-cream';
      }
      // Strip media if not premium and not explicitly enabled
      if (!Studio.isMemoryEnabled()) {
        state.secretMediaList = [];
      }
    } else {
      // Premium users ALWAYS send their media list
      state.secretMediaList = Studio.getMediaList();
    }

    return state;
  }

  return { init, trigger, cancel, saveNow, buildState };
})();
