(function () {
  'use strict';

  let activeDialog = null;
  let activeObjectUrl = null;

  const ICONS = {
    rotate: '<svg class="letter-rotate-svg" viewBox="0 0 48 48" aria-hidden="true"><g class="letter-rotate-arrows"><path d="M8 21a16 16 0 0 1 25-12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="m30 5 4 4-5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 27a16 16 0 0 1-25 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="m18 43-4-4 5-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g><g class="letter-rotate-phone"><rect x="15" y="7" width="18" height="30" rx="3" fill="#fffaf4" stroke="currentColor" stroke-width="2.4"/><circle cx="24" cy="32.5" r="1" fill="currentColor"/></g></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.7 10.7 6.6-4.2m-6.6 6.8 6.6 4.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  function installStyles() {
    if (document.getElementById('letter-download-flow-styles')) return;
    const style = document.createElement('style');
    style.id = 'letter-download-flow-styles';
    style.textContent = `
      .letter-download-dialog{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,13,12,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#312923}
      .letter-download-panel{width:min(100%,420px);max-height:min(720px,calc(100dvh - 32px));overflow:auto;background:#fffaf4;border:1px solid rgba(91,67,50,.16);border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.3);padding:26px;position:relative;text-align:center}
      .letter-download-close{position:absolute;top:14px;right:14px;width:40px;height:40px;border-radius:999px;border:1px solid rgba(91,67,50,.18);background:transparent;color:#493c33;display:grid;place-items:center;cursor:pointer}
      .letter-download-close svg{width:18px;height:18px}.letter-download-icon{width:72px;height:72px;margin:8px auto 18px;color:#9c554f;display:grid;place-items:center}.letter-download-icon svg{width:100%;height:100%;overflow:visible}
      .letter-rotate-phone{transform-box:view-box;transform-origin:24px 22px;animation:letterPhoneRotate 2.4s cubic-bezier(.65,0,.35,1) infinite}.letter-rotate-arrows{transform-box:view-box;transform-origin:center;animation:letterRotateArrows 2.4s ease-in-out infinite}
      .letter-download-dialog.is-landscape .letter-download-icon{color:#47745d}.letter-download-title{font-family:Georgia,"Times New Roman",serif;font-size:1.55rem;line-height:1.2;margin:0 30px 10px;color:#302720}
      .letter-download-copy{font-size:.9rem;line-height:1.65;color:#706158;margin:0 auto 20px;max-width:330px}.letter-download-state{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:12px;background:#f3e7dd;color:#80534d;font-size:.78rem;font-weight:700;letter-spacing:.04em;margin-bottom:18px}.letter-download-state svg{width:17px;height:17px;flex:none}
      .letter-download-dialog.is-landscape .letter-download-state{background:#e7f1ea;color:#3e6b54}.letter-download-actions{display:grid;gap:10px}.letter-download-action{min-height:48px;border-radius:999px;border:1px solid rgba(91,67,50,.2);font:700 .82rem/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;cursor:pointer;padding:0 20px}.letter-download-action svg{width:18px;height:18px}
      .letter-download-primary{background:#49332d;color:#fff;border-color:#49332d}.letter-download-secondary{background:#fffaf4;color:#49332d}.letter-download-action:disabled{opacity:.42;cursor:not-allowed}.letter-download-progress{height:3px;background:#eaded5;border-radius:999px;overflow:hidden;margin:0 0 18px;display:none}.letter-download-progress::after{content:"";display:block;width:42%;height:100%;background:#9c554f;border-radius:inherit;animation:letterDownloadProgress 1.1s ease-in-out infinite}.letter-download-dialog.is-working .letter-download-progress{display:block}
      .letter-download-preview{display:none;width:90px;aspect-ratio:9/16;object-fit:cover;margin:0 auto 16px;border-radius:8px;border:1px solid rgba(91,67,50,.16);box-shadow:0 8px 22px rgba(50,30,20,.14)}.letter-download-dialog.is-ready .letter-download-preview{display:block}.letter-download-note{font-size:.72rem;line-height:1.5;color:#8a7a70;margin:14px 0 0}
      @keyframes letterPhoneRotate{0%,16%{transform:rotate(0deg)}45%,72%{transform:rotate(90deg)}100%{transform:rotate(0deg)}}
      @keyframes letterRotateArrows{0%,100%{opacity:.3;transform:translateY(-4px) scale(.94)}24%,72%{opacity:1;transform:translateY(-4px) scale(1)}85%{opacity:.45;transform:translateY(-4px) scale(.96)}}
      @keyframes letterDownloadProgress{0%{transform:translateX(-110%)}100%{transform:translateX(250%)}}
      @media (orientation:landscape) and (max-height:520px){.letter-download-panel{width:min(620px,calc(100% - 24px));padding:20px 24px}.letter-download-icon{width:48px;height:48px;margin:0 auto 8px}.letter-download-title{font-size:1.25rem}.letter-download-copy{margin-bottom:12px}.letter-download-state{margin-bottom:12px}.letter-download-actions{grid-template-columns:1fr 1fr}.letter-download-preview{width:54px;position:absolute;left:24px;bottom:20px;margin:0}}
    `;
    document.head.appendChild(style);
  }

  function isMobileDevice() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      Math.max(window.innerWidth, window.innerHeight) <= 900 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 1024);
  }

  function isLandscape() { return window.innerWidth > window.innerHeight; }
  function safeFilename(name) { return String(name || 'surat.png').replace(/[\\/:*?"<>|]+/g, '_'); }

  async function waitForAssets(target, timeoutMs = 4000) {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, timeoutMs))]);
    }
    if (!target) return;
    await Promise.all(Array.from(target.querySelectorAll('img')).map(async (img) => {
      if (!img.complete) {
        await Promise.race([
          new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
          new Promise(resolve => setTimeout(resolve, timeoutMs))
        ]);
      }
      if (img.complete && img.naturalWidth > 0 && img.decode) {
        await Promise.race([img.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, timeoutMs))]);
      }
    }));
  }

  function releaseObjectUrl() {
    if (!activeObjectUrl) return;
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }

  function closeDialog() {
    if (!activeDialog) return;
    const { root, onResize, previousFocus } = activeDialog;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    root.remove();
    activeDialog = null;
    releaseObjectUrl();
    document.documentElement.style.overflow = '';
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
  }

  function directDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename(filename);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function openMobileDialog(options) {
    closeDialog();
    installStyles();
    const previousFocus = document.activeElement;
    const root = document.createElement('div');
    root.className = 'letter-download-dialog';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'letter-download-title');
    root.innerHTML = `<div class="letter-download-panel"><button type="button" class="letter-download-close" aria-label="Tutup">${ICONS.close}</button><div class="letter-download-icon">${ICONS.rotate}</div><h2 class="letter-download-title" id="letter-download-title">Miringkan HP ke landscape</h2><p class="letter-download-copy">Posisi landscape wajib agar surat tersimpan lebih lebar, proporsional, dan tetap mudah dibaca.</p><div class="letter-download-state" aria-live="polite"></div><div class="letter-download-progress" aria-hidden="true"></div><img class="letter-download-preview" alt="Preview PNG surat"><div class="letter-download-actions"><button type="button" class="letter-download-action letter-download-primary letter-download-generate">Buat PNG</button></div><p class="letter-download-note">Jika rotasi tidak berubah, matikan kunci orientasi layar lalu putar HP.</p></div>`;
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';

    const state = root.querySelector('.letter-download-state');
    const icon = root.querySelector('.letter-download-icon');
    const title = root.querySelector('.letter-download-title');
    const copy = root.querySelector('.letter-download-copy');
    const actions = root.querySelector('.letter-download-actions');
    const generate = root.querySelector('.letter-download-generate');
    const preview = root.querySelector('.letter-download-preview');
    const note = root.querySelector('.letter-download-note');
    let busy = false;

    const updateOrientation = () => {
      const ready = isLandscape();
      root.classList.toggle('is-landscape', ready);
      const nextIconState = ready ? 'ready' : 'rotate';
      if (icon.dataset.state !== nextIconState) {
        icon.dataset.state = nextIconState;
        icon.innerHTML = ready ? ICONS.check : ICONS.rotate;
      }
      generate.disabled = !ready || busy;
      state.innerHTML = ready ? `${ICONS.check}<span>Landscape terdeteksi. PNG siap dibuat.</span>` : `${ICONS.rotate}<span>Masih portrait. Putar HP 90 derajat.</span>`;
    };
    const onResize = () => window.setTimeout(updateOrientation, 120);
    activeDialog = { root, onResize, previousFocus };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const closeButton = root.querySelector('.letter-download-close');
    closeButton.addEventListener('click', () => { if (!busy) closeDialog(); });
    root.addEventListener('click', (event) => { if (event.target === root && !busy) closeDialog(); });
    root.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !busy) closeDialog(); });

    generate.addEventListener('click', async () => {
      if (!isLandscape() || busy) return;
      busy = true;
      generate.disabled = true;
      closeButton.disabled = true;
      root.classList.add('is-working');
      title.textContent = 'Sedang membuat PNG';
      copy.textContent = 'Tunggu sebentar dan pertahankan posisi HP tetap landscape.';
      state.innerHTML = '<span>Merender surat dan menyiapkan file…</span>';
      try {
        const blob = await options.createBlob();
        if (!blob) throw new Error('PNG_EMPTY');
        releaseObjectUrl();
        activeObjectUrl = URL.createObjectURL(blob);
        preview.src = activeObjectUrl;
        root.classList.remove('is-working');
        root.classList.add('is-ready');
        title.textContent = 'PNG surat sudah siap';
        copy.textContent = 'Tekan Simpan PNG. Pada iPhone, kamu juga dapat memakai menu Bagikan lalu memilih Simpan Gambar atau Simpan ke File.';
        state.innerHTML = `${ICONS.check}<span>File berhasil dibuat.</span>`;
        actions.innerHTML = '';

        const download = document.createElement('a');
        download.className = 'letter-download-action letter-download-primary';
        download.href = activeObjectUrl;
        download.download = safeFilename(options.filename);
        download.rel = 'noopener';
        download.innerHTML = `${ICONS.download}<span>Simpan PNG</span>`;
        actions.appendChild(download);

        const file = new File([blob], safeFilename(options.filename), { type: 'image/png' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          const share = document.createElement('button');
          share.type = 'button';
          share.className = 'letter-download-action letter-download-secondary';
          share.innerHTML = `${ICONS.share}<span>Bagikan / Simpan</span>`;
          share.addEventListener('click', async () => {
            try { await navigator.share({ files: [file], title: 'Surat untukmu' }); }
            catch (error) { if (error && error.name !== 'AbortError') console.warn('[Letter PNG] Share failed', error); }
          });
          actions.appendChild(share);
        }
        note.textContent = 'Jika tombol Simpan membuka gambar, tekan dan tahan gambarnya lalu pilih Simpan ke Foto.';
        download.focus();
      } catch (error) {
        console.error('[Letter PNG] Export failed', error);
        root.classList.remove('is-working');
        title.textContent = 'PNG belum berhasil dibuat';
        copy.textContent = 'Pastikan koneksi stabil dan seluruh gambar surat sudah tampil, lalu coba kembali.';
        state.innerHTML = '<span>Terjadi masalah saat merender surat.</span>';
        generate.disabled = false;
        generate.textContent = 'Coba Lagi';
      } finally {
        busy = false;
        closeButton.disabled = false;
      }
    });

    updateOrientation();
    closeButton.focus();
  }

  async function run(options) {
    if (!options || typeof options.createBlob !== 'function') return;
    if (isMobileDevice()) { openMobileDialog(options); return; }
    const button = options.button;
    const original = button ? button.innerHTML : '';
    if (button) { button.disabled = true; button.style.pointerEvents = 'none'; button.textContent = 'Membuat PNG…'; }
    try {
      const blob = await options.createBlob();
      if (!blob) throw new Error('PNG_EMPTY');
      directDownload(blob, options.filename);
    } catch (error) {
      console.error('[Letter PNG] Export failed', error);
      alert('PNG belum berhasil dibuat. Silakan coba kembali.');
    } finally {
      if (button) { button.disabled = false; button.style.pointerEvents = ''; button.innerHTML = original; }
    }
  }

  window.LetterDownloadFlow = { run, close: closeDialog, waitForAssets };
})();
