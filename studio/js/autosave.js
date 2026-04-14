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

      // Meta
      status:         'published',
      is_active:      true,
      show_watermark: true,
      isPremium:      false,
      _meta:          { theme_folder: 'letter' },
      updatedAt:      new Date().toISOString(),
    };
  }

  return { init, trigger, cancel, saveNow, buildState };
})();
