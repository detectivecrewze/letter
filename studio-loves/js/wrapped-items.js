/**
 * wrapped-items.js — Manages Top Places & Core Memories add-item UI
 * Loves Edition Studio
 */
const WrappedItems = (() => {
  let _places = [];
  let _memories = [];

  function init(placesArr, memoriesArr) {
    _places = Array.isArray(placesArr) ? [...placesArr] : [];
    _memories = Array.isArray(memoriesArr) ? [...memoriesArr] : [];
    _bindButtons();
    _renderPlaces();
    _renderMemories();
  }

  function _bindButtons() {
    document.getElementById('btn-add-place')?.addEventListener('click', () => {
      if (_places.length >= 5) {
        if (typeof Studio !== 'undefined' && Studio.showToast) Studio.showToast('Maksimal 5 tempat ✨');
        return;
      }
      _places.push('');
      _renderPlaces();
      // Focus last input
      const inputs = document.querySelectorAll('#wrapped-places-container .item-input');
      inputs[inputs.length - 1]?.focus();
      Autosave.trigger();
    });

    document.getElementById('btn-add-memory')?.addEventListener('click', () => {
      if (_memories.length >= 5) {
        if (typeof Studio !== 'undefined' && Studio.showToast) Studio.showToast('Maksimal 5 kenangan ✨');
        return;
      }
      _memories.push('');
      _renderMemories();
      const inputs = document.querySelectorAll('#wrapped-memories-container .item-input');
      inputs[inputs.length - 1]?.focus();
      Autosave.trigger();
    });
  }

  function _getPlaceholder(type) {
    const label = document.getElementById(`select-${type === 'place' ? 'top-places' : 'core-memories'}-label`)?.value || '';
    
    if (type === 'place') {
      if (label === 'Bucket List') return 'e.g. Ke Korea Bareng ✈️';
      if (label === 'Top Activities') return 'e.g. Main Ice Skating';
      return 'e.g. Blok M';
    } else {
      if (label === 'Top Song') return 'e.g. Die With A Smile — Bruno Mars';
      if (label === 'Favorite Movie') return 'e.g. Interstellar 🌌';
      return 'e.g. Strolling around the city';
    }
  }

  function _renderPlaces() {
    const container = document.getElementById('wrapped-places-container');
    const empty = document.getElementById('wrapped-places-empty');
    if (!container || !empty) return;

    empty.classList.toggle('hidden', _places.length > 0);
    const btn = document.getElementById('btn-add-place');
    if (btn) btn.classList.toggle('hidden', _places.length >= 5);

    const placeholder = _getPlaceholder('place');

    container.innerHTML = _places.map((place, i) => `
      <div class="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
        <span class="text-[#d4a373] text-[10px] font-bold flex-shrink-0 w-4">${i + 1}</span>
        <input type="text" value="${_escHtml(place)}" placeholder="${placeholder}"
          class="item-input flex-1 text-[11px] font-medium text-gray-800 bg-transparent border-none outline-none placeholder-gray-300"
          data-index="${i}" data-type="place" />
        <button class="btn-remove-item text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0 w-5 h-5 flex items-center justify-center text-[12px] font-bold"
          data-index="${i}" data-type="place">✕</button>
      </div>
    `).join('');

    _bindItemEvents(container, _places, 'place');
  }

  function _renderMemories() {
    const container = document.getElementById('wrapped-memories-container');
    const empty = document.getElementById('wrapped-memories-empty');
    if (!container || !empty) return;

    empty.classList.toggle('hidden', _memories.length > 0);
    const btn = document.getElementById('btn-add-memory');
    if (btn) btn.classList.toggle('hidden', _memories.length >= 5);

    const placeholder = _getPlaceholder('memory');

    container.innerHTML = _memories.map((mem, i) => `
      <div class="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
        <span class="text-[#d4a373] text-[10px] font-bold flex-shrink-0 w-4">${i + 1}</span>
        <input type="text" value="${_escHtml(mem)}" placeholder="${placeholder}"
          class="item-input flex-1 text-[11px] font-medium text-gray-800 bg-transparent border-none outline-none placeholder-gray-300"
          data-index="${i}" data-type="memory" />
        <button class="btn-remove-item text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0 w-5 h-5 flex items-center justify-center text-[12px] font-bold"
          data-index="${i}" data-type="memory">✕</button>
      </div>
    `).join('');

    _bindItemEvents(container, _memories, 'memory');
  }

  function _bindItemEvents(container, arr, type) {
    container.querySelectorAll('.item-input').forEach(input => {
      input.addEventListener('input', e => {
        arr[parseInt(e.target.dataset.index)] = e.target.value;
        Autosave.trigger();
      });
    });

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.currentTarget.dataset.index);
        arr.splice(idx, 1);
        if (type === 'place') _renderPlaces();
        else _renderMemories();
        Autosave.trigger();
      });
    });
  }

  function _escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getPlaces() { return _places.map(s => s.trim()).filter(Boolean); }
  function getMemories() { return _memories.map(s => s.trim()).filter(Boolean); }
  function refresh() { _renderPlaces(); _renderMemories(); }

  return { init, getPlaces, getMemories, refresh };
})();
