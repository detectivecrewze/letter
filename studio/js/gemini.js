/**
 * gemini.js — AI Letter Generator — Letter Edition Studio
 * Exact same pattern as Loves Project gemini.js
 * Target: #input-letter-msg (Caveat font textarea)
 */
const GeminiAI = (() => {
  let currentTone = 'romantis';

  function _openModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;
    _setView('input');
    document.getElementById('ai-prompt-input').value   = '';
    document.getElementById('ai-result-text').textContent = '';
    document.getElementById('ai-error-msg').textContent   = '';
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      const card = modal.querySelector('.ai-modal-card');
      card?.classList.remove('scale-95','opacity-0');
      card?.classList.add('scale-100','opacity-100');
    });
    setTimeout(() => document.getElementById('ai-prompt-input')?.focus(), 300);
  }

  function _closeModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;
    const card = modal.querySelector('.ai-modal-card');
    card?.classList.add('scale-95','opacity-0');
    card?.classList.remove('scale-100','opacity-100');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function _setView(view) {
    document.getElementById('ai-view-input')?.classList.toggle('hidden',   view !== 'input');
    document.getElementById('ai-view-loading')?.classList.toggle('hidden', view !== 'loading');
    document.getElementById('ai-view-result')?.classList.toggle('hidden',  view !== 'result');
    document.getElementById('ai-error-msg').textContent = '';
  }

  async function _generate() {
    const prompt  = document.getElementById('ai-prompt-input')?.value?.trim();
    const errorEl = document.getElementById('ai-error-msg');
    if (!prompt) { if (errorEl) errorEl.textContent = 'Ceritakan dulu konteksnya ya 😊'; return; }

    _setView('loading');

    try {
      const res  = await fetch(`${Auth.getWorkerUrl()}/generate-ai`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, tone: currentTone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Terjadi kesalahan.');

      document.getElementById('ai-result-text').textContent = data.text;
      _setView('result');

    } catch (err) {
      _setView('input');
      document.getElementById('ai-error-msg').textContent = err.message || 'Gagal menghubungi AI. Coba lagi.';
    }
  }

  function _applyResult() {
    const text     = document.getElementById('ai-result-text')?.textContent?.trim();
    const textarea = document.getElementById('input-letter-msg');
    if (!textarea || !text) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    _closeModal();
    Studio.showToast('✨ Surat AI berhasil diterapkan!');
    Autosave.trigger();
  }

  function init() {
    document.getElementById('btn-open-ai-generator')?.addEventListener('click', _openModal);
    document.getElementById('btn-ai-close')?.addEventListener('click',          _closeModal);
    document.getElementById('btn-ai-generate')?.addEventListener('click',       _generate);
    document.getElementById('btn-ai-apply')?.addEventListener('click',          _applyResult);
    document.getElementById('btn-ai-retry')?.addEventListener('click', () => _setView('input'));

    // Close on backdrop
    document.getElementById('modal-ai-generator')?.addEventListener('click', function(e) {
      if (e.target === this) _closeModal();
    });

    // Enter to generate
    document.getElementById('ai-prompt-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _generate(); }
    });

    // Tone selector — same exact behavior as Loves
    document.querySelectorAll('#ai-tone-selector button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ai-tone-selector button').forEach(b => {
          b.className = 'px-4 py-2 text-[10px] rounded-full border border-gray-200 bg-white text-gray-500 font-bold transition-all hover:border-[#d4a373] hover:text-[#d4a373]';
        });
        btn.className = 'px-4 py-2 text-[10px] rounded-full border border-[#d4a373] bg-[#d4a373] text-white font-bold transition-all';
        currentTone = btn.dataset.tone;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
