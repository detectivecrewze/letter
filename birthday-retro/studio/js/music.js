/**
 * music.js — Music Manager for Letter Edition Studio
 * Song Library (kurasi) + Upload MP3
 * Max 3 tracks per letter.
 */
const Music = (() => {
  const MAX_SIZE   = 30 * 1024 * 1024; // 30MB
  const MAX_TRACKS = 3;
  const PLAYLIST_URL = './playlist.json';

  let playlist      = [];
  let _kurasiFetched = false;
  let _kurasiData   = [];
  let _isPremium    = false; // set by Studio after auth

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
      mode:       (data.isLibrary === true || !data.url) ? 'library' : 'upload',
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
    <div id="${track.id}" style="margin-bottom:20px; padding:12px; border:2px solid var(--gray); box-shadow:var(--sink); background:var(--white);">

      <!-- Tab Bar -->
      <div style="display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid #808080; padding-bottom:4px;">
        <button class="tab-library win-btn" style="${isLib ? 'font-weight:bold;box-shadow:var(--sink);' : ''}">Library</button>
        ${_isPremium
          ? `<button class="tab-upload win-btn" style="${!isLib ? 'font-weight:bold;box-shadow:var(--sink);' : ''}">Upload MP3</button>`
          : `<button class="tab-upload-locked win-btn" disabled style="color:#808080;" title="Premium">Upload 🔒</button>`
        }
        <button class="btn-remove-track win-btn" style="margin-left:auto; color:red;" title="Hapus Lagu">✕</button>
      </div>

      <!-- LIBRARY MODE -->
      <div class="mode-library ${isLib ? '' : 'hidden'}">
        ${track.title ? `
        <div style="display:flex; align-items:center; gap:12px; background:#f0f0f0; border:1px solid #808080; padding:8px; margin-bottom:8px;">
          <div style="width:40px; height:40px; background:var(--gray); flex-shrink:0; border:1px solid #404040;">
            ${hasCover ? `<img src="${track.cover.url}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="text-align:center;line-height:40px;">🎵</div>`}
          </div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.title}</div>
            <div style="font-size:0.9rem; color:#404040;">${track.artist}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
            <button class="btn-open-library win-btn" style="padding:2px 8px;">Ganti</button>
            <button class="btn-clear-library win-btn" style="padding:2px 8px;">Clear</button>
          </div>
        </div>
        ` : `
        <div style="text-align:center; padding:16px; background:var(--gray); border:1px dashed #808080; margin-bottom:8px;">
          <p style="margin-bottom:8px; color:#404040;">Belum ada lagu dipilih</p>
          <button class="btn-open-library win-btn">Pilih dari Library</button>
        </div>
        `}
      </div>

      <!-- UPLOAD MODE -->
      <div class="mode-upload ${!isLib ? '' : 'hidden'}">
        ${track.uploading ? `
        <div style="text-align:center; padding:20px;">
          <p>Mengupload lagu... ⏳</p>
        </div>` : hasAudio ? `
        <div style="margin-bottom:12px;">
          <div class="field-row" style="margin-bottom:4px;">
            <label style="width:50px;">Judul:</label>
            <input type="text" value="${track.title}" class="input-title win-input" style="flex:1;">
          </div>
          <div class="field-row">
            <label style="width:50px;">Artis:</label>
            <input type="text" value="${track.artist}" class="input-artist win-input" style="flex:1;">
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; background:var(--gray); padding:6px; border:1px solid #808080; margin-bottom:12px;">
          <button class="btn-play win-btn" style="min-width:30px; padding:2px;">▶</button>
          <div style="flex:1; height:12px; background:#fff; border:1px solid #808080; position:relative;">
            <div class="audio-progress" style="background:var(--blue); height:100%; width:0%;"></div>
          </div>
          <span class="audio-duration" style="font-size:0.9rem;">--:--</span>
          <audio class="audio-player hidden" src="${track.audio.url || ''}"></audio>
          <button class="btn-remove-audio win-btn" style="min-width:30px; padding:2px; color:red;">✕</button>
        </div>
        <div style="text-align:right;">
          <button class="btn-reupload win-btn">Ganti File</button>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav" class="input-audio hidden">
        </div>` : `
        <div class="audio-dropzone" style="text-align:center; padding:20px; background:var(--gray); border:1px dashed #808080; cursor:pointer; margin-bottom:8px;">
          <p>📁 Klik untuk upload MP3</p>
          <p style="font-size:0.85rem; color:#404040; margin-top:4px;">(Max 30MB)</p>
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
    // Only bind upload tab if premium
    if (_isPremium) {
      el.querySelector('.tab-upload')?.addEventListener('click',  () => { track.mode = 'upload';  renderAll(); Autosave.trigger(); });
    }

    el.querySelector('.btn-remove-track')?.addEventListener('click', () => {
      if (!confirm('Hapus lagu ini dari surat?')) return;
      playlist.splice(index, 1);
      if (playlist.length === 0) playlist.push(_createTrack());
      renderAll(); Autosave.trigger();
    });

    el.querySelector('.btn-open-library')?.addEventListener('click', () => _openLibraryModal(track));
    el.querySelector('.btn-clear-library')?.addEventListener('click', () => {
      track.title = ''; track.artist = ''; 
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
      } catch (err) {
        console.error("[Music Upload Error]", err);
        track.uploading = false; renderAll();
        Studio.showToast('Gagal upload: ' + err.message);
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


    // Audio player
    const player  = el.querySelector('.audio-player');
    const plyBtn  = el.querySelector('.btn-play');
    const bar     = el.querySelector('.audio-progress');
    const durEl   = el.querySelector('.audio-duration');

    if (player && plyBtn) {
      player.volume = 0.5; // Set preview volume to 50%
      player.addEventListener('loadedmetadata', () => {
        const m = Math.floor(player.duration / 60);
        const s = Math.floor(player.duration % 60).toString().padStart(2, '0');
        if (durEl) durEl.textContent = `${m}:${s}`;
      });
      player.addEventListener('timeupdate', () => {
        if (player.duration && bar) bar.style.width = (player.currentTime / player.duration * 100) + '%';
      });
      player.addEventListener('ended', () => {
        plyBtn.innerHTML = '▶';
        if (bar) bar.style.width = '0%';
      });
      plyBtn.addEventListener('click', () => {
        if (!player.src) return;
        if (player.paused) {
          player.play();
          plyBtn.textContent = '⏸';
        } else {
          player.pause();
          plyBtn.textContent = '▶';
        }
      });
    }
  }

  // ── Song Library Modal ────────────────────────────────────
  function _openLibraryModal(track) {
    document.getElementById('music-library-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'music-library-modal';
    modal.className = 'screen-overlay';
    modal.style.zIndex = '200';
    modal.innerHTML = `
    <div class="win-dialog" style="width:400px; max-height:85vh; display:flex; flex-direction:column;">
      <div class="win-titlebar">
        <span class="win-title-text">🎵 Song Library</span>
        <button id="library-modal-close" class="win-controls" style="background:none;border:none;color:#fff;cursor:pointer;">✕</button>
      </div>
      <div class="win-body" style="padding:10px; display:flex; flex-direction:column; flex:1; overflow:hidden;">
        <p style="margin-bottom:8px;">Pilih lagu dari library:</p>
        <div id="library-songs-list" style="flex:1; overflow-y:auto; border:2px solid #808080; background:#fff; padding:2px; box-shadow:var(--sink);">
          <div style="padding:20px; text-align:center;">Loading...</div>
        </div>
        <div style="margin-top:12px; text-align:right;">
          <button id="library-confirm-btn" class="win-btn" disabled>Pilih</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);

    let selectedSong = null;
    const libAudio = new Audio();
    libAudio.volume = 0.5;

    const stopPreview = () => {
      libAudio.pause();
      libAudio.src = "";
    };

    modal.querySelector('#library-modal-close')?.addEventListener('click', () => { 
      stopPreview();
      modal.remove(); 
    });

    modal.addEventListener('click', e => { 
      if (e.target === modal) {
        stopPreview();
        modal.remove(); 
      }
    });

    modal.querySelector('#library-confirm-btn')?.addEventListener('click', () => {
      if (!selectedSong) return;
      stopPreview();
      track.mode       = 'library';
      track.title      = selectedSong.title;
      track.artist     = selectedSong.artist;
      track.quotes     = selectedSong.quotes || '';
      track.isLibrary  = true;
      track.cover.url  = selectedSong.coverUrl || null;
      track.audio.url  = selectedSong.audioUrl || null;
      track.audio.name = selectedSong.title;
      modal.remove(); renderAll(); Autosave.trigger();
      Studio.showToast(`"${selectedSong.title}" dipilih!`);
    });

    const renderSongs = (songs) => {
      const list = modal.querySelector('#library-songs-list');
      if (!songs || songs.length === 0) {
        list.innerHTML = `<div style="padding:20px; text-align:center;">Playlist kosong</div>`;
        return;
      }

      list.innerHTML = songs.map((song, i) => {
        const isLocked = !_isPremium && i > 9;
        return `
        <div class="library-song-item" style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; border-bottom:1px solid #ccc; ${isLocked ? 'opacity:0.6;' : ''}" data-idx="${i}">
          <button class="lib-play-btn win-btn" style="min-width:30px; padding:2px;" data-idx="${i}">
            <span class="play-icon">${isLocked ? '🔒' : '▶'}</span>
          </button>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${song.title}</div>
            <div style="font-size:0.85rem; color:#404040;">${song.artist}</div>
          </div>
          <div class="song-check" style="font-weight:bold; color:var(--blue); display:none;">✓</div>
        </div>`;
      }).join('');

      list.querySelectorAll('.library-song-item').forEach(item => {
        const idx = parseInt(item.dataset.idx);
        const song = songs[idx];
        const isLocked = !_isPremium && idx > 9;
        const playBtn = item.querySelector('.lib-play-btn');

        // Playback logic
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation(); 
          if (isLocked) return Studio.showToast('Lagu ini hanya untuk Premium');
          
          if (libAudio.src !== song.audioUrl && song.audioUrl) libAudio.src = song.audioUrl;

          if (libAudio.paused) {
            document.querySelectorAll('audio').forEach(a => a.pause());
            list.querySelectorAll('.play-icon').forEach(icon => {
               if (icon.textContent !== '🔒') icon.textContent = '▶';
            });
            libAudio.play();
            playBtn.querySelector('.play-icon').textContent = '⏸';
          } else {
            libAudio.pause();
            playBtn.querySelector('.play-icon').textContent = '▶';
          }
        });

        libAudio.addEventListener('ended', () => {
          if (playBtn.querySelector('.play-icon').textContent !== '🔒') {
            playBtn.querySelector('.play-icon').textContent = '▶';
          }
        });

        // Selection logic
        item.addEventListener('click', () => {
          if (isLocked) return Studio.showToast('Upgrade ke Premium untuk membuka semua lagu');
          
          selectedSong = song;
          list.querySelectorAll('.library-song-item').forEach(el => {
            el.style.background = '';
            el.style.color = '';
            const icon = el.querySelector('.song-check');
            if (icon) icon.style.display = 'none';
          });
          item.style.background = 'var(--blue)';
          item.style.color = '#fff';
          const icon = item.querySelector('.song-check');
          if (icon) icon.style.display = 'block';
          modal.querySelector('#library-confirm-btn').disabled = false;
        });
      });

    };

    // Show all songs in library, but they will be greyed out inside renderSongs
    if (_kurasiFetched && _kurasiData.length > 0) {
      renderSongs(_kurasiData);
    } else {
      fetchKurasi().then(() => renderSongs(_kurasiData));
    }
  }

  // ── Upload to R2 via Worker ───────────────────────────────
  async function _uploadToR2(file) {
    const workerUrl = Auth.getWorkerUrl();
    const token     = Auth.getToken();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext       = file.name.split('.').pop().toLowerCase();
    
    const baseName  = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const key       = `letters/${timestamp}-${randomStr}-${baseName}.${ext}`;

    const res = await fetch(`${workerUrl}/upload-direct/${key}?id=${encodeURIComponent(token)}`, {
      method:  'PUT',
      headers: { 
        'Content-Type': file.type || 'audio/mpeg'
      },
      body:    file,
    });

    if (!res.ok) throw new Error('Upload gagal (Server Error)');
    
    const data = await res.json();
    let rawUrl = (data.url || data.publicUrl);
    
    return rawUrl + '?v=' + timestamp;
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

  function setPremiumMode(isPrem) {
    _isPremium = isPrem === true;
    // If not premium and current track is in upload mode, switch it to library
    if (!_isPremium) {
      playlist.forEach(t => { if (t.mode === 'upload' && !t.audio.url) t.mode = 'library'; });
    }
  }

  function isUploading() {
    return playlist.some(t => t.uploading);
  }

  return { init, fetchKurasi, getPlaylistArray, isUploading, setPremiumMode };
})();
