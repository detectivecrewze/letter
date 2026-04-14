/**
 * gemini.js — AI Message Generator for Loves Studio
 * Calls POST /generate-ai on the Cloudflare Worker.
 * API Key TIDAK pernah menyentuh browser — tersimpan di Cloudflare Secrets.
 *
 * Disesuaikan untuk Loves Edition:
 * - Target textarea: #input-letter-msg
 */

const GeminiAI = (() => {

  let currentTone = 'romantis'; // Gaya bahasa default

  // ── Open modal ────────────────────────────────────────────
  function openModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;

    // Reset state setiap kali dibuka
    _setView('input');
    const promptEl = document.getElementById('ai-prompt-input');
    const resultEl = document.getElementById('ai-result-text');
    const errorEl = document.getElementById('ai-error-msg');
    if (promptEl) promptEl.value = '';
    if (resultEl) resultEl.textContent = '';
    if (errorEl) errorEl.textContent = '';

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      const card = modal.querySelector('.ai-modal-card');
      if (card) {
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
      }
    });

    setTimeout(() => document.getElementById('ai-prompt-input')?.focus(), 300);
  }

  // ── Close modal ───────────────────────────────────────────
  function closeModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;
    const card = modal.querySelector('.ai-modal-card');
    if (card) {
      card.classList.add('scale-95', 'opacity-0');
      card.classList.remove('scale-100', 'opacity-100');
    }
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  // ── Switch views: 'input' | 'loading' | 'result' ─────────
  function _setView(view) {
    const viewInput   = document.getElementById('ai-view-input');
    const viewLoading = document.getElementById('ai-view-loading');
    const viewResult  = document.getElementById('ai-view-result');
    const errorEl     = document.getElementById('ai-error-msg');

    if (viewInput)   viewInput.classList.toggle('hidden', view !== 'input');
    if (viewLoading) viewLoading.classList.toggle('hidden', view !== 'loading');
    if (viewResult)  viewResult.classList.toggle('hidden', view !== 'result');
    if (errorEl)     errorEl.textContent = '';
  }

  // ── Generate pesan ────────────────────────────────────────
  async function generate() {
    const prompt = document.getElementById('ai-prompt-input')?.value?.trim();
    const errorEl = document.getElementById('ai-error-msg');

    if (!prompt) {
      if (errorEl) errorEl.textContent = 'Tuliskan dulu instruksinya ya 😊';
      return;
    }

    _setView('loading');

    try {
      const workerUrl = Auth.getWorkerUrl();
      const response = await fetch(`${workerUrl}/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, tone: currentTone })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Terjadi kesalahan. Coba lagi.');
      }

      const resultEl = document.getElementById('ai-result-text');
      if (resultEl) resultEl.textContent = data.text;
      _setView('result');

    } catch (err) {
      _setView('input');
      const errorEl = document.getElementById('ai-error-msg');
      if (errorEl) errorEl.textContent = err.message || 'Gagal menghubungi AI. Coba lagi.';
    }
  }

  // ── Apply hasil ke textarea pesan ─────────────────────────
  function applyResult() {
    const resultText = document.getElementById('ai-result-text')?.textContent?.trim();
    // Target: textarea utama di Loves Studio (Surat Cinta)
    const textarea = document.getElementById('input-letter-msg');
    if (!textarea || !resultText) return;

    // Flash animasi untuk konfirmasi visual
    textarea.style.transition = 'background-color 0.3s ease';
    textarea.style.backgroundColor = '#fffbf5';
    textarea.value = resultText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { textarea.style.backgroundColor = ''; }, 600);

    closeModal();

    if (typeof Studio !== 'undefined' && Studio.showToast) {
      Studio.showToast('✨ Pesan AI berhasil diterapkan!');
    }

    // Trigger autosave
    if (typeof Autosave !== 'undefined') {
      Autosave.trigger();
    }
  }

  // ── Coba lagi dari view result ────────────────────────────
  function tryAgain() {
    _setView('input');
    document.getElementById('ai-prompt-input')?.focus();
  }

  // ── Bind events setelah DOM siap ─────────────────────────
  function init() {
    document.getElementById('btn-open-ai-generator')?.addEventListener('click', openModal);
    document.getElementById('btn-ai-close')?.addEventListener('click', closeModal);
    document.getElementById('btn-ai-generate')?.addEventListener('click', generate);
    document.getElementById('btn-ai-apply')?.addEventListener('click', applyResult);
    document.getElementById('btn-ai-retry')?.addEventListener('click', tryAgain);

    // Tutup saat klik backdrop
    document.getElementById('modal-ai-generator')?.addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

    // Enter untuk generate
    document.getElementById('ai-prompt-input')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generate();
      }
    });

    // Tone selector
    const toneButtons = document.querySelectorAll('#ai-tone-selector button');
    toneButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toneButtons.forEach(b => {
          b.className = 'px-4 py-2 text-[10px] rounded-full border border-gray-200 bg-white text-gray-500 font-bold transition-all hover:border-[#d4a373] hover:text-[#d4a373]';
        });
        btn.className = 'px-4 py-2 text-[10px] rounded-full border border-[#d4a373] bg-[#d4a373] text-white font-bold transition-all';
        currentTone = btn.dataset.tone;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openModal, closeModal, generate, applyResult };
})();
