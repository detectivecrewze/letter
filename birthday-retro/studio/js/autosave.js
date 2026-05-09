/**
 * autosave.js — Background debounced saving
 * Birthday Retro Studio
 */
const Autosave = (() => {
  let _debounceTimer = null;
  const DEBOUNCE_MS = 2500;

  function init() {}

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
    const token = Auth.getToken();
    if (!token) return;
    try {
      const res = await fetch(`${Auth.getWorkerUrl()}/save-config?id=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildState()),
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
    const state = {
      studioToken: token,
      giftId: token,
      studioPassword: Auth.getInitialConfig()?.studioPassword || null,
      // Theme
      theme: document.getElementById('input-theme')?.value || 'classic',
      
      // Login Gate
      giftPassword: document.getElementById('input-gift-password')?.value.trim() || null,
      giftHint: document.getElementById('input-gift-hint')?.value.trim() || null,

      // Recipient
      recipientName: document.getElementById('input-recipient-name')?.value.trim() || '',
      age: document.getElementById('input-age')?.value.trim() || '',

      // Stage content
      stage1_heading: document.getElementById('input-stage1-heading')?.value.trim() || '',
      stage2_question: document.getElementById('input-stage2-question')?.value.trim() || 'i have a surprise for\nyou, wanna see it?',
      stage4_reveal_text: document.getElementById('input-stage4-text')?.value.trim() || "it's a birthday surprise!! :D",
      stage5_wishes: document.getElementById('input-stage5-wishes')?.value || '',

      // Secret Media
      secretMediaList: typeof Studio !== 'undefined' && Studio.getMediaList ? Studio.getMediaList() : [],

      // Music
      playlist: Studio.getPlaylistArray ? Studio.getPlaylistArray() : [],

      // Preserve server-controlled flags
      isPremium: Auth.getInitialConfig()?.isPremium || false,
      status: Auth.getInitialConfig()?.status || 'draft',
      is_active: true,
      _meta: { theme_folder: 'birthday-retro' },
    };
    return state;
  }

  return { init, trigger, cancel, saveNow, buildState };
})();
