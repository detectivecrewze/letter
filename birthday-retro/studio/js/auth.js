/**
 * auth.js — Token validation & initial config loading
 * Birthday Retro Studio
 */
const Auth = (() => {
  const WORKER_URL = 'https://birthday-retro.aldoramadhan16.workers.dev';
  let _token = null;
  let _initialConfig = null;

  function getToken() { return _token; }
  function getInitialConfig() { return _initialConfig; }
  function getWorkerUrl() { return WORKER_URL; }

  async function init() {
    _token = _getTokenFromURL();
    if (!_token) {
      _showError('Token tidak ditemukan di URL. Minta link Studio baru dari admin.');
      return false;
    }
    try {
      const cacheBuster = `&_cb=${Date.now()}`;
      const res = await fetch(`${WORKER_URL}/get-config?id=${encodeURIComponent(_token)}${cacheBuster}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      if (res.status === 404) { _showError('Project tidak ditemukan.'); return false; }
      if (!res.ok) throw new Error(`Server error (${res.status})`);

      const data = await res.json();
      _initialConfig = data;

      if (data.studioPassword) {
        let isAuthed = false;
        try { isAuthed = sessionStorage.getItem(`bday_auth_${_token}`) === 'true'; } catch (e) {}
        const passFromUrl = new URLSearchParams(window.location.search).get('pass');
        if (passFromUrl === data.studioPassword) {
          try { sessionStorage.setItem(`bday_auth_${_token}`, 'true'); } catch (e) {}
          _showStudio();
          return true;
        }
        if (!isAuthed) { _setupAuthGate(data.studioPassword); _showAuthGate(); return false; }
      }
      _showStudio();
      return true;
    } catch (err) {
      _showError('Gagal terhubung ke server. Coba muat ulang halaman.');
      return false;
    }
  }

  function _setupAuthGate(correctPass) {
    const input = document.getElementById('studio-pass-input');
    const btn = document.getElementById('btn-unlock-studio');
    const errorMsg = document.getElementById('studio-pass-error');
    const tryUnlock = () => {
      if (input.value === correctPass) {
        try { sessionStorage.setItem(`bday_auth_${_token}`, 'true'); } catch (e) {}
        document.getElementById('auth-gate').classList.add('hidden');
        Studio.initPostAuth();
      } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        input.style.borderBottomColor = '#e57373';
        setTimeout(() => { input.style.borderBottomColor = ''; if (errorMsg) errorMsg.classList.add('hidden'); }, 2000);
      }
    };
    btn?.addEventListener('click', tryUnlock);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  }

  function _showStudio() {
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('studio-main')?.classList.remove('hidden');
  }
  function _showAuthGate() {
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('auth-gate')?.classList.remove('hidden');
  }
  function _showError(msg) {
    document.getElementById('loading-screen')?.classList.add('hidden');
    const errScrn = document.getElementById('error-screen');
    const errMsg = document.getElementById('error-message');
    if (errScrn) errScrn.classList.remove('hidden');
    if (errMsg) errMsg.textContent = msg;
  }

  function _getTokenFromURL() {
    const path = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (path.length >= 2 && path[0] === 'studio') {
      const token = path[1];
      if (token && !token.includes('.')) return token;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || params.get('to') || params.get('id') || null;
  }

  return { init, getToken, getInitialConfig, getWorkerUrl };
})();
