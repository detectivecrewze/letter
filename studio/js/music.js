/**
 * music.js — Music Manager for Letter Edition Studio
 * Song Library (kurasi) + Upload MP3
 * Max 3 tracks per letter.
 */
const Music = (() => {
  const MAX_SIZE   = 30 * 1024 * 1024; // 30MB
  const MAX_TRACKS = 1;
  const PLAYLIST_URL = './playlist.json';

  let playlist      = [];
  let _kurasiFetched = false;
  let _kurasiData   = [];

  // ── Init ─────────────────────────────────────────────────
  function init(existingConfig) {
    playlist = [];

    const src = existingConfig?.playlist;
    if (Array.isArray(src)) {
      src.forEach((track, i) => {
        if (i >= MAX_TRACKS) return;
        playlist.push(_createTrack(track));
      });
    }

    if (playlist.length === 0) playlist.push(_createTrack());

    fetchKurasi(); // background
    renderAll();
  }

  // ── Fetch Song Library ────────────────────────────────────
  async function fetchKurasi() {
    if (_kurasiFetched) return;
    try {
      const res = await fetch(PLAYLIST_URL + '?t=' + Date.now());
      if (res.ok) _kurasiData = await res.json();
    } catch (e) {
      // Fallback data
      _kurasiData = [
        { title: 'Everything u are', artist: 'Hindia',  genre: 'Indonesia', coverUrl: '', audioUrl: '', quotes: '♪ Bahwa aku pernah dicintai ♪' },
        { title: 'Bertaut',          artist: 'Nadin Amizah', genre: 'Indonesia', coverUrl: '', audioUrl: '', quotes: '♪ Nyawaku nyala karena denganmu ♪' },
        { title: 'From The Start',   artist: 'Laufey',  genre: 'International', coverUrl: '', audioUrl: '', quotes: '♪ Don\'t you notice how I get quiet? ♪' },
        { title: 'Always With Me',   artist: 'Spirited Away', genre: 'OST', coverUrl: '', audioUrl: '', quotes: '♪ You will always be with me ♪' },
        { title: 'About You',        artist: 'The 1975', genre: 'International', coverUrl: '', audioUrl: '', quotes: '♪ Do you think I have forgotten? ♪' },
      ];
    }
    _kurasiFetched = true;
  }

  // ── Track State ───────────────────────────────────────────
  function _createTrack(data = {}) {
    return {
      id:         'track_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      mode:       data.isLibrary ? 'library' : 'upload',
      audio:      { url: data.url || data.src || null, name: data.audioName || data.name || null },
      cover:      { url: data.coverUrl || null },
      title:      data.title || '',
      artist:     data.artist || '',
      quotes:     data.quotes || '',
      isPlaying:  false,
      uploading:  false,
    };
  }

  // ── Render ────────────────────────────────────────────────
  function renderAll() {
    const container = document.getElementById('music-slots-container');
    if (!container) return;
    container.innerHTML = '';

    playlist.forEach((track, index) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = _getTrackHTML(track, index);
      container.appendChild(wrap.firstElementChild);
      _bindTrackEvents(track, index);
    });

    if (playlist.length < MAX_TRACKS) {
      const addBtn = document.createElement('div');
      addBtn.className = 'text-center mt-6';
      addBtn.innerHTML = `<button id="btn-add-track" class="text-[9px] uppercase tracking-widest font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:text-black hover:border-black transition-all px-8 py-3 rounded-xl">+ Tambah Lagu</button>`;
      container.appendChild(addBtn);
      document.getElementById('btn-add-track')?.addEventListener('click', () => {
        if (playlist.length < MAX_TRACKS) {
          playlist.push(_createTrack());
          renderAll();
          Autosave.trigger();
        }
      });
    }
  }

  function _getTrackHTML(track, index) {
    const isLib     = track.mode === 'library';
    const hasAudio  = !!track.audio.url;
    const hasCover  = !!track.cover.url;

    return `
    <div id="${track.id}" class="p-6 bg-white border border-gray-100 rounded-2xl relative shadow-sm hover:shadow-md transition-shadow mb-4">

      <!-- Tab Bar -->
      <div class="flex bg-gray-50 rounded-lg p-1 mb-5 max-w-xs">
        <button class="tab-library flex-1 py-1.5 text-[9px] uppercase tracking-widest font-bold ${isLib ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-black'} rounded-md transition-all">Song Library</button>
        <button class="tab-upload flex-1 py-1.5 text-[9px] uppercase tracking-widest font-bold ${!isLib ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-black'} rounded-md transition-all">Upload MP3</button>
      </div>

      <!-- LIBRARY MODE -->
      <div class="mode-library ${isLib ? '' : 'hidden'}">
        ${track.title ? `
        <div class="flex items-center gap-3 p-3 bg-[#fdf9f4] border border-[#d4a373]/20 rounded-xl mb-3">
          <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            ${hasCover ? `<img src="${track.cover.url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-gray-300 text-lg">🎵</div>`}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold text-gray-800 truncate">${track.title}</p>
            <p class="text-[9px] text-gray-500 mt-0.5">${track.artist}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button class="btn-open-library text-[8px] uppercase tracking-widest font-bold text-[#d4a373] hover:text-[#b8895a] transition-colors">Ganti</button>
            <button class="btn-clear-library text-[8px] font-bold text-gray-300 hover:text-red-400 transition-colors">✕</button>
          </div>
        </div>
        <textarea class="input-quotes w-full p-3 bg-[#fdf9f4] border border-[#d4a373]/20 rounded-xl text-[10px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#d4a373] resize-none" rows="2" placeholder="Tambah lirik atau quotes untuk lagu ini...">${track.quotes || ''}</textarea>
        ` : `
        <div class="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 mb-3">
          <p class="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-3">Belum ada lagu dipilih</p>
          <button class="btn-open-library text-[8px] uppercase tracking-widest font-bold bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors">Pilih dari Song Library</button>
        </div>
        `}
      </div>

      <!-- UPLOAD MODE -->
      <div class="mode-upload ${!isLib ? '' : 'hidden'}">
        ${track.uploading ? `
        <div class="flex flex-col items-center justify-center py-10 text-center">
          <div class="w-8 h-8 border-2 border-gray-100 border-t-[#d4a373] rounded-full animate-spin mb-3"></div>
          <p class="text-[8px] uppercase tracking-widest text-[#d4a373] font-bold">Mengupload lagu...</p>
        </div>` : hasAudio ? `
        <div class="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl mb-3 shadow-sm">
          <div class="flex-1 min-w-0">
            <input type="text" placeholder="Judul Lagu..." value="${track.title}" class="input-title w-full text-[11px] font-bold border-b border-gray-100 pb-1 focus:outline-none focus:border-[#d4a373] text-gray-800 bg-transparent placeholder-gray-300">
            <input type="text" placeholder="Nama Artis..." value="${track.artist}" class="input-artist w-full text-[9px] text-gray-500 border-none focus:outline-none bg-transparent placeholder-gray-300 mt-1">
          </div>
          <button class="btn-remove-audio text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-[10px]">✕</button>
        </div>
        <div class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl mb-3 border border-gray-100">
          <button class="btn-play w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 hover:bg-gray-700 transition-colors">
            <span class="text-white text-[8px] ml-0.5">▶</span>
          </button>
          <div class="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-[#d4a373] rounded-full w-0 audio-progress"></div>
          </div>
          <span class="audio-duration text-[9px] text-gray-400 font-mono flex-shrink-0">--:--</span>
          <audio class="audio-player hidden" src="${track.audio.url || ''}"></audio>
        </div>
        <div class="text-center">
          <button class="btn-reupload text-[8px] uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors font-bold underline underline-offset-2">Ganti file MP3</button>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav" class="input-audio hidden">
        </div>` : `
        <div class="audio-dropzone border-2 border-dashed border-gray-100 rounded-xl py-8 text-center cursor-pointer hover:border-[#d4a373] hover:bg-[#fdf9f4] transition-all bg-gray-50/50 mb-3">
          <div class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </div>
          <p class="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">Klik untuk upload MP3</p>
          <p class="text-[8px] text-gray-300 mt-1">Maks 30MB</p>
        </div>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav" class="input-audio hidden">`}
      </div>
    </div>`;
  }

  // ── Bind Events ───────────────────────────────────────────
  function _bindTrackEvents(track, index) {
    const el = document.getElementById(track.id);
    if (!el) return;

    el.querySelector('.tab-library')?.addEventListener('click', () => { track.mode = 'library'; renderAll(); Autosave.trigger(); });
    el.querySelector('.tab-upload')?.addEventListener('click',  () => { track.mode = 'upload';  renderAll(); Autosave.trigger(); });

    el.querySelector('.btn-remove-track')?.addEventListener('click', () => {
      if (!confirm('Hapus lagu ini dari surat?')) return;
      playlist.splice(index, 1);
      if (playlist.length === 0) playlist.push(_createTrack());
      renderAll(); Autosave.trigger();
    });

    el.querySelector('.btn-open-library')?.addEventListener('click', () => _openLibraryModal(track));
    el.querySelector('.btn-clear-library')?.addEventListener('click', () => {
      track.title = ''; track.artist = ''; track.quotes = '';
      track.cover.url = null; track.audio.url = null; track.audio.name = null;
      renderAll(); Autosave.trigger();
    });

    // Upload MP3
    const dzAudio = el.querySelector('.audio-dropzone');
    const inAudio = el.querySelector('.input-audio');
    dzAudio?.addEventListener('click', () => inAudio?.click());
    el.querySelector('.btn-reupload')?.addEventListener('click', () => inAudio?.click());
    inAudio?.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > MAX_SIZE) return Studio.showToast('Audio maksimal 30MB.');
      Studio.showToast('Mengupload lagu... 🎶');
      track.uploading = true; renderAll();
      try {
        const url = await _uploadToR2(f);
        track.audio.url = url; track.audio.name = f.name;
        if (!track.title) track.title = f.name.replace(/\.[^/.]+$/, '');
        track.uploading = false; renderAll();
        Studio.showToast('Lagu berhasil diupload! 🎶'); Autosave.trigger();
      } catch {
        track.uploading = false; renderAll();
        Studio.showToast('Gagal upload audio. Coba lagi.');
      }
      inAudio.value = '';
    });

    el.querySelector('.btn-remove-audio')?.addEventListener('click', () => {
      if (!confirm('Hapus audio ini?')) return;
      track.audio.url = null; track.audio.name = null;
      renderAll(); Autosave.trigger();
    });

    el.querySelector('.input-title')?.addEventListener('input',  e => { track.title  = e.target.value; Autosave.trigger(); });
    el.querySelector('.input-artist')?.addEventListener('input', e => { track.artist = e.target.value; Autosave.trigger(); });
    el.querySelector('.input-quotes')?.addEventListener('input', e => { track.quotes = e.target.value; Autosave.trigger(); });

    // Audio player
    const player  = el.querySelector('.audio-player');
    const plyBtn  = el.querySelector('.btn-play');
    const bar     = el.querySelector('.audio-progress');
    const durEl   = el.querySelector('.audio-duration');

    if (player && plyBtn) {
      player.addEventListener('loadedmetadata', () => {
        const m = Math.floor(player.duration / 60);
        const s = Math.floor(player.duration % 60).toString().padStart(2, '0');
        if (durEl) durEl.textContent = `${m}:${s}`;
      });
      player.addEventListener('timeupdate', () => {
        if (player.duration && bar) bar.style.width = (player.currentTime / player.duration * 100) + '%';
      });
      player.addEventListener('ended', () => {
        plyBtn.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>';
        if (bar) bar.style.width = '0%';
      });
      plyBtn.addEventListener('click', () => {
        if (!player.src) return;
        document.querySelectorAll('audio').forEach(a => { if (a !== player) a.pause(); });
        document.querySelectorAll('.btn-play').forEach(b => { if (b !== plyBtn) b.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>'; });
        if (player.paused) {
          player.play();
          plyBtn.innerHTML = '<span class="text-white text-[8px]">⏸</span>';
        } else {
          player.pause();
          plyBtn.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>';
        }
      });
    }
  }

  // ── Song Library Modal ────────────────────────────────────
  function _openLibraryModal(track) {
    document.getElementById('music-library-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'music-library-modal';
    modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style="max-height:82vh;">
      <div class="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-800">Song Library</h3>
          <p class="text-[9px] text-gray-400 mt-0.5">Pilih lagu untuk surat kamu</p>
        </div>
        <button id="library-modal-close" class="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-[11px] font-bold">✕</button>
      </div>
      <div class="overflow-y-auto flex-1 py-1" id="library-songs-list">
        <div class="flex items-center justify-center py-10">
          <div class="w-6 h-6 border-2 border-gray-100 border-t-[#d4a373] rounded-full animate-spin"></div>
        </div>
      </div>
      <div class="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <button id="library-confirm-btn" class="w-full py-3 bg-black text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled>Pilih Lagu Ini</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    let selectedSong = null;

    modal.querySelector('#library-modal-close')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#library-confirm-btn')?.addEventListener('click', () => {
      if (!selectedSong) return;
      track.mode       = 'library';
      track.title      = selectedSong.title;
      track.artist     = selectedSong.artist;
      track.quotes     = selectedSong.quotes || '';
      track.cover.url  = selectedSong.coverUrl || null;
      track.audio.url  = selectedSong.audioUrl || null;
      track.audio.name = selectedSong.title;
      modal.remove(); renderAll(); Autosave.trigger();
      Studio.showToast(`"${selectedSong.title}" dipilih! 🎶`);
    });

    const renderSongs = (songs) => {
      const list = modal.querySelector('#library-songs-list');
      if (!songs || songs.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-[9px] text-gray-400 uppercase tracking-widest">Playlist kosong</div>`;
        return;
      }
      list.innerHTML = songs.map((song, i) => `
      <div class="library-song-item flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0" data-idx="${i}">
        <div class="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          ${song.coverUrl ? `<img src="${song.coverUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300 text-base\\'>🎵</div>'">` : `<div class="w-full h-full flex items-center justify-center text-gray-300 text-base">🎵</div>`}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-bold text-gray-800 truncate">${song.title}</p>
          <p class="text-[9px] text-gray-400 mt-0.5">${song.artist} · ${song.genre || ''}</p>
          ${song.quotes ? `<p class="text-[8px] text-[#d4a373] mt-1 truncate italic">"${song.quotes}"</p>` : ''}
        </div>
        <div class="song-check w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0 transition-all">
          <span class="check-icon text-[8px] text-white hidden">✓</span>
        </div>
      </div>`).join('');

      list.querySelectorAll('.library-song-item').forEach(item => {
        item.addEventListener('click', () => {
          selectedSong = songs[parseInt(item.dataset.idx)];
          list.querySelectorAll('.library-song-item').forEach(el => {
            el.classList.remove('bg-[#fdf9f4]');
            const chk = el.querySelector('.song-check');
            chk.style.background = ''; chk.style.borderColor = '#e5e7eb';
            el.querySelector('.check-icon').classList.add('hidden');
          });
          item.classList.add('bg-[#fdf9f4]');
          const chk = item.querySelector('.song-check');
          chk.style.background = '#d4a373'; chk.style.borderColor = '#d4a373';
          item.querySelector('.check-icon').classList.remove('hidden');
          modal.querySelector('#library-confirm-btn').disabled = false;
        });
      });
    };

    if (_kurasiFetched && _kurasiData.length > 0) {
      renderSongs(_kurasiData);
    } else {
      fetchKurasi().then(() => renderSongs(_kurasiData));
    }
  }

  // ── Upload to R2 via Worker ───────────────────────────────
  async function _uploadToR2(file) {
    const workerUrl = Auth.getWorkerUrl();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext       = file.name.split('.').pop().toLowerCase();
    const key       = `letters/${timestamp}-${randomStr}.${ext}`;

    const res = await fetch(`${workerUrl}/upload-direct/${key}`, {
      method:  'PUT',
      headers: { 'Content-Type': file.type || 'audio/mpeg', 'Content-Length': file.size },
      body:    file,
    });

    if (!res.ok) throw new Error('Upload gagal');
    const data = await res.json();
    return data.url;
  }

  // ── Getters ───────────────────────────────────────────────
  function getPlaylistArray() {
    return playlist.map(t => ({
      type:       'mp3',
      isLibrary:  t.mode === 'library',
      url:        t.audio.url || null,
      src:        t.audio.url || null,
      name:       t.audio.name || null,
      audioName:  t.audio.name || null,
      coverUrl:   t.cover.url || null,
      title:      t.title.trim(),
      artist:     t.artist.trim(),
      quotes:     t.quotes || null,
    }));
  }

  function isUploading() {
    return playlist.some(t => t.uploading);
  }

  return { init, fetchKurasi, getPlaylistArray, isUploading };
})();
