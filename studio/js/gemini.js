/**
 * gemini.js — AI Letter Generator — Letter Edition Studio
 * Guided Interactive Wizard, Relation Selection, Multi-select Tone & Dual AI Model Support
 */
const GeminiAI = (() => {
  let activeMode = 'quick'; // 'quick' | 'interactive'
  let selectedTones = new Set(['romantis']); // multi-select set
  let selectedAIModel = 'gemini'; // 'gemini' | 'qwen'
  let selectedRelation = 'Pacar / Pasangan'; // relation state

  function _openModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;
    _setView('input');
    
    // Clear inputs
    const recipientInput = document.getElementById('ai-input-recipient');
    const occasionInput  = document.getElementById('ai-input-occasion');
    const memoriesInput  = document.getElementById('ai-input-memories');
    const wishesInput    = document.getElementById('ai-input-wishes');
    const quickInput     = document.getElementById('ai-prompt-input');

    // Auto-fill recipient name if available from recipient input in studio
    const studioRecipient = document.getElementById('input-recipient-name')?.value?.trim();
    if (recipientInput) recipientInput.value = studioRecipient || '';
    if (occasionInput)  occasionInput.value  = '';
    if (memoriesInput)  memoriesInput.value  = '';
    if (wishesInput)    wishesInput.value    = '';
    if (quickInput)     quickInput.value     = '';

    document.getElementById('ai-result-text').textContent = '';
    document.getElementById('ai-error-msg').textContent   = '';

    _setMode('quick');
    _updateModelUI();
    _updateRelationUI();
    _updateToneUI();

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      const card = modal.querySelector('.ai-modal-card');
      card?.classList.remove('scale-95','opacity-0');
      card?.classList.add('scale-100','opacity-100');
    });
    setTimeout(() => {
      if (activeMode === 'interactive') {
        document.getElementById('ai-input-recipient')?.focus();
      } else {
        document.getElementById('ai-prompt-input')?.focus();
      }
    }, 300);
  }

  function _closeModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;
    const card = modal.querySelector('.ai-modal-card');
    card?.classList.add('scale-95','opacity-0');
    card?.classList.remove('scale-100','opacity-100');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function _setMode(mode) {
    activeMode = mode;
    const tabInteractive = document.getElementById('tab-ai-mode-interactive');
    const tabQuick       = document.getElementById('tab-ai-mode-quick');
    const containerInteractive = document.getElementById('ai-container-interactive');
    const containerQuick       = document.getElementById('ai-container-quick');

    if (mode === 'interactive') {
      tabInteractive?.classList.remove('bg-white', 'text-gray-500', 'border-gray-200');
      tabInteractive?.classList.add('bg-[#d4a373]', 'text-white', 'border-[#d4a373]', 'shadow-sm');

      tabQuick?.classList.remove('bg-[#d4a373]', 'text-white', 'border-[#d4a373]', 'shadow-sm');
      tabQuick?.classList.add('bg-white', 'text-gray-500', 'border-gray-200');

      containerInteractive?.classList.remove('hidden');
      containerQuick?.classList.add('hidden');
    } else {
      tabQuick?.classList.remove('bg-white', 'text-gray-500', 'border-gray-200');
      tabQuick?.classList.add('bg-[#d4a373]', 'text-white', 'border-[#d4a373]', 'shadow-sm');

      tabInteractive?.classList.remove('bg-[#d4a373]', 'text-white', 'border-[#d4a373]', 'shadow-sm');
      tabInteractive?.classList.add('bg-white', 'text-gray-500', 'border-gray-200');

      containerQuick?.classList.remove('hidden');
      containerInteractive?.classList.add('hidden');
    }
  }

  function _setView(view) {
    document.getElementById('ai-view-input')?.classList.toggle('hidden',   view !== 'input');
    document.getElementById('ai-view-loading')?.classList.toggle('hidden', view !== 'loading');
    document.getElementById('ai-view-result')?.classList.toggle('hidden',  view !== 'result');
    document.getElementById('ai-error-msg').textContent = '';
  }

  function _updateModelUI() {
    document.querySelectorAll('#ai-model-selector .ai-model-btn').forEach(btn => {
      const model = btn.dataset.model;
      if (model === selectedAIModel) {
        btn.className = 'ai-model-btn px-3 py-1 text-[9px] rounded-full border border-[#d4a373] bg-[#d4a373] text-white font-bold transition-all flex items-center gap-1 shadow-sm';
      } else {
        btn.className = 'ai-model-btn px-3 py-1 text-[9px] rounded-full border border-gray-200 bg-white text-gray-500 font-bold transition-all hover:border-[#d4a373] hover:text-[#d4a373] flex items-center gap-1';
      }
    });
  }

  function _updateRelationUI() {
    document.querySelectorAll('#ai-relation-selector .ai-relation-btn').forEach(btn => {
      const relation = btn.dataset.relation;
      if (relation === selectedRelation) {
        btn.className = 'ai-relation-btn px-3 py-1.5 text-[10px] rounded-full border border-[#d4a373] bg-[#d4a373] text-white font-bold transition-all';
      } else {
        btn.className = 'ai-relation-btn px-3 py-1.5 text-[10px] rounded-full border border-gray-200 bg-white text-gray-500 font-bold transition-all hover:border-[#d4a373]';
      }
    });
  }

  function _updateToneUI() {
    document.querySelectorAll('#ai-tone-selector .ai-tone-btn').forEach(btn => {
      const tone = btn.dataset.tone;
      if (selectedTones.has(tone)) {
        btn.className = 'ai-tone-btn px-3.5 py-1.5 text-[10px] rounded-full border border-[#d4a373] bg-[#d4a373] text-white font-bold transition-all';
      } else {
        btn.className = 'ai-tone-btn px-3.5 py-1.5 text-[10px] rounded-full border border-gray-200 bg-white text-gray-500 font-bold transition-all hover:border-[#d4a373] hover:text-[#d4a373]';
      }
    });
  }

  function _toggleTone(tone) {
    if (selectedTones.has(tone)) {
      if (selectedTones.size > 1) {
        selectedTones.delete(tone);
      }
    } else {
      selectedTones.add(tone);
    }
    _updateToneUI();
  }

  async function _generate() {
    const errorEl = document.getElementById('ai-error-msg');
    let prompt = '';

    if (activeMode === 'interactive') {
      const recipient = document.getElementById('ai-input-recipient')?.value?.trim();
      const occasion  = document.getElementById('ai-input-occasion')?.value?.trim();
      const memories  = document.getElementById('ai-input-memories')?.value?.trim();
      const wishes    = document.getElementById('ai-input-wishes')?.value?.trim();

      if (!recipient && !occasion) {
        if (errorEl) errorEl.textContent = 'Mohon isi nama penerima atau momen terlebih dahulu.';
        return;
      }

      let promptParts = [];
      if (recipient) promptParts.push(`Penerima: ${recipient}`);
      if (selectedRelation) promptParts.push(`Hubungan dengan penerima: ${selectedRelation}`);
      if (occasion)  promptParts.push(`Momen/Acara: ${occasion}`);
      if (memories)  promptParts.push(`Detail kenangan/kebiasaan unik: ${memories}`);
      if (wishes)    promptParts.push(`Doa/harapan khusus: ${wishes}`);
      
      prompt = promptParts.join('. ');
    } else {
      prompt = document.getElementById('ai-prompt-input')?.value?.trim();
      if (!prompt) {
        if (errorEl) errorEl.textContent = 'Mohon isi instruksi surat terlebih dahulu.';
        return;
      }
    }

    _setView('loading');

    try {
      const res  = await fetch(`${Auth.getWorkerUrl()}/generate-ai`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ 
          prompt,
          model: selectedAIModel,
          tones: Array.from(selectedTones),
          tone: Array.from(selectedTones)[0] || 'tulus'
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Terjadi kesalahan.');

      document.getElementById('ai-result-text').textContent = data.text;
      _setView('result');

    } catch (err) {
      _setView('input');
      if (errorEl) errorEl.textContent = err.message || 'Gagal menghubungi AI. Coba lagi.';
    }
  }

  function _applyResult() {
    const text     = document.getElementById('ai-result-text')?.textContent?.trim();
    const textarea = document.getElementById('input-letter-msg');
    if (!textarea || !text) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    _closeModal();
    Studio.showToast('Surat AI berhasil diterapkan!');
    Autosave.trigger();
  }

  function init() {
    document.getElementById('btn-open-ai-generator')?.addEventListener('click', _openModal);
    document.getElementById('btn-ai-close')?.addEventListener('click',          _closeModal);
    document.getElementById('btn-ai-generate')?.addEventListener('click',       _generate);
    document.getElementById('btn-ai-apply')?.addEventListener('click',          _applyResult);
    document.getElementById('btn-ai-retry')?.addEventListener('click', () => _setView('input'));

    // Mode tabs
    document.getElementById('tab-ai-mode-interactive')?.addEventListener('click', () => _setMode('interactive'));
    document.getElementById('tab-ai-mode-quick')?.addEventListener('click', () => _setMode('quick'));

    // Model engine selector
    document.querySelectorAll('#ai-model-selector .ai-model-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const model = btn.dataset.model;
        if (model) {
          selectedAIModel = model;
          _updateModelUI();
        }
      });
    });

    // Relation selector
    document.querySelectorAll('#ai-relation-selector .ai-relation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const relation = btn.dataset.relation;
        if (relation) {
          selectedRelation = relation;
          _updateRelationUI();
        }
      });
    });

    // Close on backdrop
    document.getElementById('modal-ai-generator')?.addEventListener('click', function(e) {
      if (e.target === this) _closeModal();
    });

    // Tone selector (multi-select)
    document.querySelectorAll('#ai-tone-selector .ai-tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tone = btn.dataset.tone;
        if (tone) _toggleTone(tone);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
