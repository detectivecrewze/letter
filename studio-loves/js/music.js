/**
 * music.js — Multi-track Audio Management for Arcade Edition
 * v3: Song Library (kurasi dari R2) + Upload MP3 redesign
 */

const Music = (() => {
   const MAX_SIZE = 10 * 1024 * 1024; // 10MB
   const MAX_TRACKS = 3;
   const KURASI_URL = './playlist.json';

   let playlist = [];
   let _kurasiFetched = false;
   let _kurasiData = [];

   // ── Init ──────────────────────────────────────────────────
   function init(existingConfig) {
      playlist = [];

      if (existingConfig && existingConfig.playlist && Array.isArray(existingConfig.playlist)) {
         existingConfig.playlist.forEach((track, i) => {
            if (i >= MAX_TRACKS) return;
            playlist.push(createTrackState(track));
         });
      } else if (existingConfig && (existingConfig.url || existingConfig.title)) {
         playlist.push(createTrackState(existingConfig));
      }

      if (playlist.length === 0) playlist.push(createTrackState());

      // Pre-fetch kurasi data in background
      fetchKurasiData();

      renderAll();
   }

   // ── Fetch kurasi JSON from R2 ─────────────────────────────
   async function fetchKurasiData() {
      if (_kurasiFetched) return;
      try {
         const res = await fetch(KURASI_URL + '?t=' + Date.now());
         if (res.ok) {
            _kurasiData = await res.json();
         }
      } catch (e) {
         console.warn('[Music] Gagal fetch kurasi:', e);
         // Fallback demo data jika R2 belum ada file-nya
         _kurasiData = [
            { title: 'Always With Me', artist: 'Joe Hisaishi', genre: 'OST', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273e1c0e2bfef52c6a8b25bd4a6', audioUrl: '' },
            { title: 'A Thousand Years', artist: 'Christina Perri', genre: 'International', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273367e06a229244f0c9f7d59d7', audioUrl: '' },
            { title: 'Sudah', artist: 'Hindia', genre: 'Indonesia', coverUrl: 'https://i.scdn.co/image/ab67616d0000b2736a796c1e0e41197e5f6ed07a', audioUrl: '' },
            { title: "Can't Help Falling In Love", artist: 'Elvis Presley', genre: 'Classic', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273bb7b6e4c0b27ae46be1a63fa', audioUrl: '' },
            { title: 'Perfect', artist: 'Ed Sheeran', genre: 'International', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273bb7b6e4c0b27ae46be1a63fa', audioUrl: '' },
            { title: 'All of Me', artist: 'John Legend', genre: 'International', coverUrl: 'https://i.scdn.co/image/ab67616d0000b2731049e4aafc9f25c0e72f9c68', audioUrl: '' },
            { title: 'Ruang Sendiri', artist: 'Sal Priadi', genre: 'Indonesia', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273d4a1e5ea65f26c79c47c47b5', audioUrl: '' },
            { title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'International', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273e3e3b64cea45265469d4cde5', audioUrl: '' },
            { title: 'Selamat Tinggal', artist: 'NIKI', genre: 'Indonesia', coverUrl: 'https://i.scdn.co/image/ab67616d0000b2735ef878a782c987d7a3a0a635', audioUrl: '' },
            { title: 'Aku Milikmu', artist: 'Iwan Fals', genre: 'Indonesia', coverUrl: '', audioUrl: '' },
         ];
      }
      _kurasiFetched = true;
   }

   // ── Track State ───────────────────────────────────────────
   function createTrackState(data = {}) {
      // mode: 'library' | 'upload'
      const hasLibrary = data.isLibrary || false;
      return {
         id: 'track_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
         mode: hasLibrary ? 'library' : 'upload',
         isManualMode: false, // legacy compat
         audio: { url: (data.url && data.url !== 'manual_search') ? data.url : null, name: data.name || null },
         cover: { url: data.coverUrl || null },
         title: data.title || '',
         artist: data.artist || '',
         quotes: data.quotes || '',
         isPlaying: false,
         uploading: false,
      };
   }

   // ── Render All ────────────────────────────────────────────
   function renderAll() {
      const container = document.getElementById('music-slots-container');
      if (!container) return;

      container.innerHTML = '';
      playlist.forEach((track, index) => {
         const el = document.createElement('div');
         el.innerHTML = getTrackHTML(track, index);
         container.appendChild(el.firstElementChild);
         bindTrackEvents(track, index);
      });

      if (playlist.length < MAX_TRACKS) {
         const addBtnWrap = document.createElement('div');
         addBtnWrap.className = 'text-center mt-6 fade-in';
         addBtnWrap.innerHTML = `<button id="btn-add-track" class="text-[9px] uppercase tracking-widest font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:text-black hover:border-black transition-all px-8 py-3 rounded-xl">+ Tambah Lagu Tambahan</button>`;
         container.appendChild(addBtnWrap);
         document.getElementById('btn-add-track')?.addEventListener('click', () => {
            if (playlist.length < MAX_TRACKS) {
               playlist.push(createTrackState());
               renderAll();
               Autosave.trigger();
            }
         });
      }
   }

   // ── Track HTML ────────────────────────────────────────────
   function getTrackHTML(track, index) {
      const isLibraryMode = track.mode === 'library';
      const hasAudio = !!track.audio.url;
      const hasCover = !!track.cover.url;

      return `
    <div id="${track.id}" class="p-6 bg-white border border-gray-100 rounded-2xl relative shadow-sm hover:shadow-md transition-shadow">
      ${index > 0 || playlist.length > 1 ? `<button class="btn-remove-track absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 border border-gray-100 hover:border-red-100">✕</button>` : ''}

      <h3 class="text-[10px] font-bold text-[#d4a373] uppercase tracking-[0.2em] mb-4">Lagu ${index + 1}</h3>

      <!-- Tab Bar -->
      <div class="flex bg-gray-50 rounded-lg p-1 mb-6 max-w-sm">
        <button class="tab-library flex-1 py-1.5 min-w-0 text-[8px] sm:text-[9px] uppercase tracking-widest font-bold ${isLibraryMode ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'} rounded-md transition-all truncate px-2">Song Library</button>
        <button class="tab-upload flex-1 py-1.5 min-w-0 text-[8px] sm:text-[9px] uppercase tracking-widest font-bold ${!isLibraryMode ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'} rounded-md transition-all truncate px-2">Upload MP3</button>
      </div>

      <!-- ── SONG LIBRARY MODE ── -->
      <div class="mode-library ${isLibraryMode ? '' : 'hidden'} fade-in">
        ${track.title ? `
        <!-- Selected Song Preview -->
        <div class="library-selected flex items-center gap-3 p-3 bg-[#fdf9f4] border border-[#d4a373]/20 rounded-xl mb-3">
          <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            ${hasCover ? `<img src="${track.cover.url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-gray-300 text-lg">🎵</div>`}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold text-gray-800 truncate">${track.title}</p>
            <p class="text-[9px] text-gray-500 mt-0.5">${track.artist}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button class="btn-open-library text-[8px] uppercase tracking-widest font-bold text-[#d4a373] hover:text-[#b8895a] transition-colors">Ganti</button>
            <button class="btn-clear-library text-[8px] uppercase tracking-widest font-bold text-gray-300 hover:text-red-400 transition-colors">✕</button>
          </div>
        </div>

        <!-- Quotes Input -->
        <textarea class="input-quotes w-full p-3 bg-[#fdf9f4] border border-[#d4a373]/20 rounded-xl mb-3 text-[10px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#d4a373] resize-none shadow-sm transition-colors" rows="2" placeholder="Tulis lirik atau quotes untuk lagu ini...">${track.quotes || ''}</textarea>
        ` : `
        <!-- Empty Library State -->
        <div class="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 mb-3">
          <p class="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-3">Belum ada lagu dipilih</p>
          <button class="btn-open-library text-[8px] uppercase tracking-widest font-bold bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors">Pilih dari Song Library</button>
        </div>
        `}
      </div>

      <!-- ── UPLOAD MP3 MODE ── -->
      <div class="mode-upload ${!isLibraryMode ? '' : 'hidden'} fade-in">
        ${track.uploading ? `
        <div class="flex flex-col items-center justify-center py-10 text-center">
          <div class="w-8 h-8 border-2 border-gray-100 border-t-[#d4a373] rounded-full animate-spin mb-3"></div>
          <p class="text-[8px] uppercase tracking-widest text-[#d4a373] font-bold">Mengupload lagu...</p>
        </div>
        ` : hasAudio ? `
        <!-- Filled State -->
        <div class="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl mb-3 shadow-sm">
          <!-- Cover -->
          <div class="cover-dropzone relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer bg-gray-50 border border-gray-100 group">
            ${hasCover
               ? `<img class="cover-img w-full h-full object-cover" src="${track.cover.url}">`
               : `<div class="cover-empty w-full h-full flex items-center justify-center text-gray-300 text-base">🖼️</div>`
            }
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
              <span class="text-[7px] text-white uppercase tracking-widest font-bold">Edit</span>
            </div>
            <input type="file" accept="image/*" class="input-cover hidden">
          </div>
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <input type="text" placeholder="Judul Lagu..." value="${track.title}" class="input-title w-full text-[11px] font-bold border-b border-gray-100 pb-1 focus:outline-none focus:border-[#d4a373] text-gray-800 bg-transparent placeholder-gray-300 truncate" autocomplete="off">
            <input type="text" placeholder="Nama Artis..." value="${track.artist}" class="input-artist w-full text-[9px] text-gray-500 border-none focus:outline-none bg-transparent placeholder-gray-300 mt-1" autocomplete="off">
          </div>
          <!-- Remove -->
          <button class="btn-remove-audio text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-[10px]">✕</button>
        </div>

        <!-- Audio Player -->
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

        <!-- Quotes Input -->
        <textarea class="input-quotes w-full p-3 bg-white border border-gray-100 rounded-xl mb-3 text-[10px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#d4a373] resize-none shadow-sm transition-colors" rows="2" placeholder="Tulis lirik atau quotes untuk lagu ini...">${track.quotes || ''}</textarea>

        <!-- Re-upload link -->
        <div class="text-center">
          <button class="btn-reupload text-[8px] uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors font-bold underline underline-offset-2">Ganti file MP3</button>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav" class="input-audio hidden">
        </div>
        ` : `
        <!-- Empty Upload State -->
        <div class="audio-dropzone border-2 border-dashed border-gray-100 rounded-xl py-8 text-center cursor-pointer hover:border-[#d4a373] hover:bg-[#fdf9f4] transition-all bg-gray-50/50 mb-3">
          <div class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </div>
          <p class="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">Klik untuk upload MP3</p>
          <p class="text-[8px] text-gray-300 mt-1">Maks 10MB</p>
        </div>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav" class="input-audio hidden">
        `}
      </div>
    </div>
    `;
   }

   // ── Bind Events ───────────────────────────────────────────
   function bindTrackEvents(track, index) {
      const el = document.getElementById(track.id);
      if (!el) return;

      // ── Tabs
      el.querySelector('.tab-library')?.addEventListener('click', () => {
         track.mode = 'library';
         renderAll();
         Autosave.trigger();
      });
      el.querySelector('.tab-upload')?.addEventListener('click', () => {
         track.mode = 'upload';
         renderAll();
         Autosave.trigger();
      });

      // ── Remove Track
      el.querySelector('.btn-remove-track')?.addEventListener('click', () => {
         if (!confirm('Hapus lagu ini dari playlist?')) return;
         playlist.splice(index, 1);
         if (playlist.length === 0) playlist.push(createTrackState());
         renderAll();
         Autosave.trigger();
      });

      // ── Open Library Modal
      el.querySelector('.btn-open-library')?.addEventListener('click', () => {
         openLibraryModal(track);
      });

      // ── Clear Library Selection
      el.querySelector('.btn-clear-library')?.addEventListener('click', () => {
         track.title = '';
         track.artist = '';
         track.quotes = '';
         track.cover.url = null;
         track.audio.url = null;
         track.audio.name = null;
         renderAll();
         Autosave.trigger();
      });

      // ── Upload MP3 (empty state)
      const dzAudio = el.querySelector('.audio-dropzone');
      const inAudio = el.querySelector('.input-audio');
      dzAudio?.addEventListener('click', () => inAudio?.click());
      el.querySelector('.btn-reupload')?.addEventListener('click', () => inAudio?.click());
      inAudio?.addEventListener('change', async (e) => {
         const f = e.target.files[0];
         if (!f) return;
         if (f.size > MAX_SIZE) return Studio.showToast('Audio maksimal 10MB');
         Studio.showToast('Mengupload lagu... 🎶');
         track.uploading = true;
         renderAll();
         try {
            const url = await uploadToR2(f, 'audio');
            track.audio.url = url;
            track.audio.name = f.name;
            // Auto fill title from filename if empty
            if (!track.title) track.title = f.name.replace(/\.[^/.]+$/, '');
            track.uploading = false;
            renderAll();
            Studio.showToast('Lagu berhasil diupload! 🎶');
            Autosave.trigger();
         } catch (err) {
            track.uploading = false;
            renderAll();
            Studio.showToast('Gagal upload audio.');
         }
         inAudio.value = '';
      });

      // ── Remove Audio
      el.querySelector('.btn-remove-audio')?.addEventListener('click', () => {
         if (!confirm('Hapus audio yang sudah diupload?')) return;
         track.audio.url = null;
         track.audio.name = null;
         renderAll();
         Autosave.trigger();
      });

      // ── Cover Upload
      const dzCover = el.querySelector('.cover-dropzone');
      const inCover = el.querySelector('.input-cover');
      dzCover?.addEventListener('click', () => inCover?.click());
      inCover?.addEventListener('change', async (e) => {
         const f = e.target.files[0];
         if (!f) return;
         if (!f.type.startsWith('image/')) return Studio.showToast('Format cover harus gambar');
         if (f.size > 5 * 1024 * 1024) return Studio.showToast('Cover maksimal 5MB');
         Studio.showToast('Mengupload cover...');
         const oldUrl = track.cover.url;
         track.cover.url = URL.createObjectURL(f);
         renderAll();
         try {
            const url = await uploadToR2(f, 'photo');
            track.cover.url = url;
            renderAll();
            Studio.showToast('Cover tersimpan!');
            Autosave.trigger();
         } catch (err) {
            track.cover.url = oldUrl;
            renderAll();
            Studio.showToast('Gagal upload cover.');
         }
         inCover.value = '';
      });

      // ── Title & Artist Inputs
      el.querySelector('.input-title')?.addEventListener('input', (e) => {
         track.title = e.target.value;
         Autosave.trigger();
      });
      el.querySelector('.input-artist')?.addEventListener('input', (e) => {
         track.artist = e.target.value;
         Autosave.trigger();
      });
      el.querySelectorAll('.input-quotes').forEach(input => {
         input.addEventListener('input', (e) => {
            track.quotes = e.target.value;
            Autosave.trigger();
         });
      });

      // ── Audio Player
      const player = el.querySelector('.audio-player');
      const plyBtn = el.querySelector('.btn-play');
      const progressBar = el.querySelector('.audio-progress');
      const durationEl = el.querySelector('.audio-duration');

      if (player && plyBtn) {
         // Set duration once metadata loaded
         player.addEventListener('loadedmetadata', () => {
            const m = Math.floor(player.duration / 60);
            const s = Math.floor(player.duration % 60).toString().padStart(2, '0');
            if (durationEl) durationEl.textContent = `${m}:${s}`;
         });

         player.addEventListener('timeupdate', () => {
            if (player.duration && progressBar) {
               progressBar.style.width = (player.currentTime / player.duration * 100) + '%';
            }
         });

         player.addEventListener('ended', () => {
            track.isPlaying = false;
            plyBtn.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>';
            if (progressBar) progressBar.style.width = '0%';
         });

         plyBtn.addEventListener('click', () => {
            if (!player.src) return;
            playlist.forEach(t => t.isPlaying = false);
            document.querySelectorAll('audio').forEach(a => { if (a !== player) a.pause(); });
            document.querySelectorAll('.btn-play').forEach(b => {
               if (b !== plyBtn) b.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>';
            });
            if (player.paused) {
               player.play();
               track.isPlaying = true;
               plyBtn.innerHTML = '<span class="text-white text-[8px]">⏸</span>';
            } else {
               player.pause();
               track.isPlaying = false;
               plyBtn.innerHTML = '<span class="text-white text-[8px] ml-0.5">▶</span>';
            }
         });
      }
   }

   // ── Song Library Modal ────────────────────────────────────
   function openLibraryModal(track) {
      // Remove old modal if exists
      document.getElementById('music-library-modal')?.remove();

      const modal = document.createElement('div');
      modal.id = 'music-library-modal';
      modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm';
      modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style="max-height: 80vh;">
        <!-- Header -->
        <div class="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-800">Song Library</h3>
            <p class="text-[9px] text-gray-400 mt-0.5">Pilih satu lagu untuk Arcade kamu</p>
          </div>
          <button id="library-modal-close" class="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-[11px] font-bold">✕</button>
        </div>

        <!-- Song List -->
        <div class="overflow-y-auto flex-1 py-1" id="library-songs-list">
          <div class="flex items-center justify-center py-10">
            <div class="w-6 h-6 border-2 border-gray-100 border-t-[#d4a373] rounded-full animate-spin"></div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-gray-100 flex-shrink-0">
          <button id="library-confirm-btn" class="w-full py-3 bg-black text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled>Pilih Lagu Ini</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);

      let selectedSong = null;

      // Close
      modal.querySelector('#library-modal-close')?.addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      // Confirm
      modal.querySelector('#library-confirm-btn')?.addEventListener('click', () => {
         if (!selectedSong) return;
         track.mode = 'library';
         track.title = selectedSong.title;
         track.artist = selectedSong.artist;
         track.quotes = selectedSong.quotes || '';
         track.cover.url = selectedSong.coverUrl || null;
         track.audio.url = selectedSong.audioUrl || null;
         track.audio.name = selectedSong.title;
         modal.remove();
         renderAll();
         Autosave.trigger();
         Studio.showToast(`"${selectedSong.title}" dipilih! 🎶`);
      });

      // Render songs
      const renderSongs = (songs) => {
         const list = modal.querySelector('#library-songs-list');
         if (!songs || songs.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-[9px] text-gray-400 uppercase tracking-widest">Playlist kosong</div>`;
            return;
         }

         list.innerHTML = songs.map((song, i) => `
        <div class="library-song-item flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0" data-idx="${i}">
          <div class="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
            ${song.coverUrl
               ? `<img src="${song.coverUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-gray-300 text-base\'>🎵</div>'">`
               : `<div class="w-full h-full flex items-center justify-center text-gray-300 text-base">🎵</div>`
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold text-gray-800 truncate">${song.title}</p>
            <p class="text-[9px] text-gray-400 mt-0.5">${song.artist} · ${song.genre || ''}</p>
            ${song.quotes ? `<p class="text-[8px] text-[#d4a373] mt-1 truncate italic">"${song.quotes}"</p>` : ''}
          </div>
          <div class="song-check w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0 transition-all">
            <span class="check-icon text-[8px] text-white hidden">✓</span>
          </div>
        </div>
      `).join('');

         // Bind song selection
         list.querySelectorAll('.library-song-item').forEach(item => {
            item.addEventListener('click', () => {
               const idx = parseInt(item.dataset.idx);
               selectedSong = songs[idx];

               // Update visual
               list.querySelectorAll('.library-song-item').forEach(el => {
                  el.classList.remove('bg-[#fdf9f4]');
                  const chk = el.querySelector('.song-check');
                  chk.style.background = '';
                  chk.style.borderColor = '#e5e7eb';
                  el.querySelector('.check-icon').classList.add('hidden');
               });

               item.classList.add('bg-[#fdf9f4]');
               const chk = item.querySelector('.song-check');
               chk.style.background = '#d4a373';
               chk.style.borderColor = '#d4a373';
               item.querySelector('.check-icon').classList.remove('hidden');

               modal.querySelector('#library-confirm-btn').disabled = false;
            });
         });
      };

      // Load songs
      if (_kurasiFetched && _kurasiData.length > 0) {
         renderSongs(_kurasiData);
      } else {
         fetchKurasiData().then(() => renderSongs(_kurasiData));
      }
   }

   // ── Get Playlist Array (for save/publish) ─────────────────
   function getPlaylistArray() {
      return playlist.map(track => ({
         type: 'mp3',
         isLibrary: track.mode === 'library',
         url: track.audio.url || null,
         name: track.audio.name || null,
         coverUrl: track.cover.url || null,
         title: track.title.trim(),
         artist: track.artist.trim(),
         quotes: track.quotes || null,
      }));
   }

   function getMusicConfig() {
      return getPlaylistArray()[0] || null;
   }

   function isUploading() {
      return playlist.some(t => t.uploading);
   }

   return { init, getMusicConfig, getPlaylistArray, isUploading };
})();