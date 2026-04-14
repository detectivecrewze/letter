/**
 * studio.js — Main coordinator for Letter Edition Studio
 */
const Studio = (() => {

  let _studioPassword = '';

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
    _setVal('input-letter-title',    config.title || '');
    _setVal('input-letter-date',     config.date || '');
    _setVal('input-letter-to',      config.letterTo || config.salutation || '');
    _setVal('input-letter-msg',     config.message  || config.letter_body || '');
    _setVal('input-letter-from',    config.from     || '');
    _setVal('input-login-password', config.login_password || '');
    _setVal('input-login-hint',     config.login_hint     || '');
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
      'input-login-hint'
    ].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => Autosave.trigger());
    });
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
    const el    = document.getElementById(inputId);
    const errEl = document.getElementById(inputId + '-error');
    if (el) el.style.borderBottomColor = '#e57373';
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
  }

  function clearErrors() {
    document.querySelectorAll('[id$="-error"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.input-minimal').forEach(el => el.style.borderBottomColor = '');
  }

  function getStudioPassword() { return _studioPassword; }

  return { initPostAuth, showToast, showError, clearErrors, getStudioPassword };
})();

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.init();
  if (ok) Studio.initPostAuth();
});
