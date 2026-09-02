(function (global) {
  const supportedLocales = ['id', 'en'];
  let locale = 'en';
  function normalize(value, fallback = 'en') {
    const clean = String(value || '').trim().toLowerCase();
    return supportedLocales.includes(clean) ? clean : fallback;
  }

  const htmlPhrases = {
    'memory-desc-hint': {
      id: '<strong>Optional:</strong> Kosongkan jika tidak ingin menambahkan foto/video. Jika diisi, Polaroid akan muncul otomatis di akhir surat — penerima bisa swipe antar foto dengan tombol panah.',
      en: '<strong>Optional:</strong> Leave blank if you do not want to add photos/videos. If filled, Polaroids will appear automatically at the end of the letter — recipients can swipe between photos with arrow buttons.'
    },
    'memory-upload-specs': {
      id: 'Maks. 10 File · Video Maks 15 MB (Ideal 1-10 Detik)<br>JPG · PNG · WEBP · MP4',
      en: 'Max. 10 Files · Video Max 15 MB (Ideal 1-10 Seconds)<br>JPG · PNG · WEBP · MP4'
    },
    'envelope-name-hint': {
      id: '<strong>Nama Amplop</strong> adalah teks yang muncul secara eksklusif pada tampilan depan fisik amplop surat digital Anda.',
      en: '<strong>Envelope Name</strong> is the text that appears exclusively on the physical front of your digital letter envelope.'
    },
    'gif-footer-hint': {
      id: '💡 <strong>Petunjuk:</strong> Jika mengambil dari web/Tenor/Giphy, <strong>klik kanan pada gambar GIF &rarr; pilih "Copy Image Address"</strong> (bukan Copy Link web-nya). Atau klik "Cari via Giphy" di atas.',
      en: '💡 <strong>Hint:</strong> When getting from web/Tenor/Giphy, <strong>right-click the GIF image &rarr; choose "Copy Image Address"</strong> (not the page link). Or click "Search with Giphy" above.'
    },
    'typewriter-hint-desc': {
      id: 'Efek mengetik muncul di <strong>Preview Akhir</strong> &amp; <strong>Surat Terkirim</strong>.',
      en: 'Typing effect appears in <strong>Final Preview</strong> &amp; <strong>Delivered Letter</strong>.'
    },
    'studio-security-desc': {
      id: 'Password ini digunakan untuk <strong>mengunci akses ke Studio Editor ini</strong>, sehingga orang lain yang memiliki link Anda tidak dapat mengubah isi surat tanpa password.',
      en: 'This password is used to <strong>lock access to this Studio Editor</strong>, so others with your link cannot modify the letter without the password.'
    },
    'vip-link-desc': {
      id: 'Dapatkan link kado dengan domain sendiri (contoh: <em>nama-kamu.vercel.app</em>) dan buat pengalaman yang terasa lebih personal.<br><br>Selain link eksklusif, kamu juga otomatis bisa membuat surat baru dari studio editor ini.',
      en: 'Get a gift link with your own domain (e.g. <em>your-name.vercel.app</em>) and create an experience that feels truly personal.<br><br>In addition to an exclusive link, you can also automatically create new letters from this studio editor.'
    },
    'multi-device-desc': {
      id: 'Surat ini sudah dioptimalkan sepenuhnya untuk pengalaman <strong>Desktop & Mobile terbaik</strong>.',
      en: 'This letter is fully optimized for the <strong>best Desktop & Mobile experience</strong>.'
    }
  };

  const studioPairs = [
    ['Memuat Studio...', 'Loading Studio...'], ['Akses Ditolak', 'Access Denied'],
    ['Project tidak ditemukan atau token tidak valid.', 'Project not found or token is invalid.'],
    ['Akses Terkunci', 'Access Locked'], ['Masukkan Password Studio Anda', 'Enter your Studio Password'],
    ['Buka Kunci', 'Unlock'], ['Password Salah', 'Incorrect Password'],
    ['Pilih Template', 'Choose a Template'], ['Tampilan Amplop & Surat', 'Envelope & Letter Design'],
    ['Fitur Premium', 'Premium Feature'], ['Pilihan template tersedia untuk akun Premium.', 'Template choices are available for Premium accounts.'],
    ['Hubungi admin untuk mengaktifkan.', 'Contact the admin to activate it.'], ['Geser', 'Swipe'],
    ['Penerima Surat', 'Letter Recipient'], ['Nama di Amplop', 'Name on the Envelope'],
    ['Mood & Visual Theme', 'Mood & Visual Theme'], ['Warna Template', 'Template Colors'],
    ['Warna Amplop', 'Envelope Color'], ['Pilihan Bunga', 'Flower Selection'],
    ['Bisa memilih lebih dari satu tipe bunga.', 'You can choose more than one flower type.'],
    ['Tipe 1', 'Type 1'], ['Tipe 2', 'Type 2'], ['Tipe 3', 'Type 3'], ['Tipe 4', 'Type 4'], ['Tipe 5', 'Type 5'],
    ['Tipe 6', 'Type 6'], ['Tipe 7', 'Type 7'], ['Tipe 8', 'Type 8'], ['Tipe 9', 'Type 9'], ['Tipe 10', 'Type 10'],
    ['Paper Texture (Premium Option)', 'Paper Texture (Premium Option)'], ['Kertas Biasa', 'Regular Paper'],
    ['Pilih tekstur kertas yang paling sesuai dengan mood suratmu.', 'Choose the paper texture that best matches your letter.'],
    ['Dari', 'From'], ['(Nama pendek)', '(Short name)'], ['Nama Penerima', 'Recipient Name'],
    ['GIF Sticker Amplop', 'Envelope GIF Sticker'], ['Opsional', 'Optional'],
    ['Tampil di depan amplop bersegel', 'Shown on the front of the sealed envelope'],
    ['GIF Amplop Terpasang', 'Envelope GIF Attached'], ['Hapus', 'Remove'],
    ['Password Akses', 'Access Password'], ['Surat', 'Letter'], ['Pesan dari Hati', 'Message from the Heart'],
    ['Simpan Draft', 'Save Draft'], ['Judul Surat', 'Letter Title'], ['Tanggal Surat', 'Letter Date'],
    ['GIF Sticker Header', 'Header GIF Sticker'], ['Pojok kanan atas penerima', 'Recipient’s top-right corner'],
    ['GIF Header Terpasang', 'Header GIF Attached'], ['Buat dengan AI', 'Create with AI'],
    ['Tipografi & Ukuran Teks', 'Typography & Text Size'], ['S - Kecil', 'S - Small'], ['M - Sedang', 'M - Medium'], ['L - Besar', 'L - Large'],
    ['GIF Sticker Footer', 'Footer GIF Sticker'], ['Muncul di bagian akhir surat', 'Appears at the end of the letter'],
    ['GIF Terpilih', 'GIF Selected'], ['Akan muncul di akhir surat', 'Will appear at the end of the letter'],
    ['Cari', 'Search'],
    ['Lihat Contoh Hasil Jadi', 'View Finished Example'],
    ['(Hanya sebagai referensi / contoh hasil akhir)', '(For reference only / an example of the final result)'],
    ['Music (Optional)', 'Music (Optional)'], ['Soundtrack Surat', 'Letter Soundtrack'], ['Memuat daftar putar...', 'Loading playlist...'],
    ['Song Library', 'Song Library'], ['Upload MP3', 'Upload MP3'],
    ['Belum ada lagu dipilih', 'No song selected yet'], ['Pilih dari Song Library', 'Choose from Song Library'],
    ['Ganti', 'Change'], ['Pilih Lagu', 'Select Song'],
    ['Memori Rahasia', 'Secret Memories'], ['Foto / Video di Akhir Surat', 'Photos / Videos at the End of the Letter'],
    ['Tambah Foto / Video', 'Add Photos / Videos'], ['Hubungi admin untuk\nmengaktifkan fitur ini.', 'Contact the admin to\nactivate this feature.'],
    ['Mengupload...', 'Uploading...'],
    ['Maks. 10 File · Video Maks 15 MB (Ideal 1-10 Detik)', 'Max 10 Files · Video Max 15 MB (Ideal 1-10 Seconds)'],
    ['Caption (opsional)…', 'Caption (optional)…'], ['Caption (opsional)...', 'Caption (optional)...'],
    ['Geser ke atas', 'Move up'], ['Geser ke bawah', 'Move down'],
    ['Yakin ingin menghapus foto ini?', 'Are you sure you want to delete this photo?'], ['Foto dihapus', 'Photo deleted'],
    ['Keamanan Studio', 'Studio Security'], ['Kunci Akses Editor Anda', 'Protect Your Editor Access'],
    ['Password Studio', 'Studio Password'], ['Lihat Live Preview', 'View Live Preview'], ['Publikasikan Surat', 'Publish Letter'],
    ['Upgrade ke Premium (+10K)', 'Upgrade to Premium (+10K)'], ['Termasuk Upload Musik, Password, & Link Pribadi', 'Includes Music Upload, Password, & Private Link'],
    ['Akun Premium Aktif', 'Premium Account Active'], ['Semua fitur premium telah terbuka', 'All premium features are unlocked'],
    ['Bonus Surat Aktif!', 'Bonus Letter Active!'], ['Kamu berhak mendapatkan 1 surat tambahan secara gratis untuk orang lain.', 'You are eligible for one free additional letter for someone else.'],
    ['Buat Surat Bonus Sekarang', 'Create a Bonus Letter Now'], ['Surat Bonus Dibuat', 'Bonus Letter Created'],
    ['Buka Studio Bonus', 'Open Bonus Studio'], ['Request Link Pribadi (+5K)', 'Request a Private Link (+5K)'],
    ['Tersimpan Otomatis', 'Saved Automatically'], ['Surat akan dipublish dan siap dikirimkan', 'The letter will be published and ready to send'],
    ['Dukungan Multi-Perangkat', 'Multi-Device Support'], ['Lanjutkan & Publish', 'Continue & Publish'], ['Batal', 'Cancel'],
    ['Surat Tercipta', 'Letter Created'], ['Download Barcode', 'Download Barcode'], ['Salin', 'Copy'], ['Lihat Surat', 'View Letter'],
    ['Khusus Pembeli Paket Gift Box Fisik:', 'For Physical Gift Box Buyers Only:'],
    ['Sudah selesai mengedit surat? Beritahu admin atelier lewat WhatsApp agar hampers fisikmu segera dirakit dan dikirimkan.', 'Finished editing your letter? Tell the atelier admin via WhatsApp so your physical hamper can be assembled and sent.'],
    ['Beritahu Admin Lewat WhatsApp', 'Tell the Admin via WhatsApp'], ['Tutup', 'Close'], ['Buat Surat Bonus', 'Create a Bonus Letter'],
    ['Tentukan link/ID unik untuk surat bonus premium Anda', 'Set a unique link/ID for your premium bonus letter'],
    ['Link Surat Bonus Baru', 'New Bonus Letter Link'], ['Gunakan huruf kecil, angka, atau tanda strip (-) saja.', 'Use lowercase letters, numbers, or hyphens (-) only.'],
    ['Buat Surat Premium', 'Create Premium Letter'], ['Sudah Selesai?', 'All Done?'], ['Apakah anda sudah yakin dengan desain surat ini?', 'Are you sure you are happy with this letter design?'],
    ['Request Nama Domain Vercel', 'Request a Vercel Domain Name'], ['Rekomendasi Nama', 'Name Suggestions'], ['Pilih nama yang unik dan bermakna!', 'Choose a name that is unique and meaningful!'],
    ['Lanjutkan & Request', 'Continue & Request'], ['Request Terkirim!', 'Request Sent!'], ['Upgrade Premium Sedang Diproses', 'Premium Upgrade Is Being Processed'],
    ['Terima kasih! Request Upgrade Premium Anda sedang diproses. Admin akan mengaktifkan fitur premium (Password, Upload Musik) dan menghubungkan ke domain pilihanmu setelah konfirmasi via WhatsApp.', 'Thank you! Your Premium Upgrade request is being processed. The admin will activate premium features (Password, Music Upload) and connect your chosen domain after WhatsApp confirmation.'],
    ['Kabari Admin di WhatsApp', 'Notify the Admin on WhatsApp'], ['Selesai', 'Done'], ['Tulis dengan AI', 'Write with AI'],
    ['Asisten Penulis Surat', 'Letter Writing Assistant'], ['Mode Cepat', 'Quick Mode'], ['Mode Interaktif', 'Interactive Mode'],
    ['Penerima & Momen', 'Recipient & Occasion'], ['Hubungan', 'Relationship'], ['Pacar / Pasangan', 'Boyfriend / Girlfriend'],
    ['Sahabat / Teman', 'Best Friend / Friend'], ['Keluarga', 'Family'], ['Rekan Kerja', 'Colleague'],
    ['Kenangan / Kebiasaan Unik', 'Unique Memories / Habits'], ['(opsional)', '(optional)'], ['Doa & Harapan Khusus', 'Special Wishes & Hopes'],
    ['Instruksi Bebas', 'Free-form Instructions'], ['Gaya Bahasa', 'Writing Style'], ['Bisa pilih lebih dari 1', 'You can choose more than one'],
    ['Romantis', 'Romantic'], ['Santai (Aku/Kamu)', 'Casual (I/You)'], ['Lucu / Canda', 'Funny / Playful'], ['Formal & Tulus', 'Formal & Sincere'],
    ['Generate Surat', 'Generate Letter'], ['AI sedang merangkai pesan...', 'AI is writing your message...'],
    ['Memproses detail & gaya bahasa pilihanmu', 'Processing your selected details and writing style'], ['Hasil dari AI :', 'Result from AI:'],
    ['Coba Lagi', 'Try Again'], ['Gunakan Surat', 'Use This Letter'], ['Beberapa fitur eksklusif menunggumu.', 'Exclusive features are waiting for you.'],
    ['Upgrade untuk membuka semuanya.', 'Upgrade to unlock them all.'], ['Kertas Handmade', 'Handmade Paper'],
    ['Tekstur kertas premium yang mewah', 'Luxurious premium paper texture'], ['Link Pribadi & Password', 'Private Link & Password'],
    ['Request nama URL khusus & proteksi surat rahasia', 'Request a custom URL name & protect your secret letter'],
    ['Tambahkan foto & video di akhir surat', 'Add photos & videos at the end of your letter'], ['Upgrade ke Premium', 'Upgrade to Premium'], ['Nanti saja', 'Maybe Later'],
    ['Simpan perubahan sebagai draft', 'Save changes as a draft'], ['Buat pesan dengan bantuan AI', 'Create a message with AI'],
    ['Lihat/Sembunyikan password', 'Show/Hide password'], ['Contoh : Lisa', 'Example: Lisa'],
    ['Masukkan nama (cth: Natasya)', 'Enter a name (e.g. Natasya)'], ['Momen (cth: Ultah ke-19)', 'Occasion (e.g. 19th birthday)'],
    ['Cth: Suka makan ramen bareng, sering ketiduran pas vcall', 'E.g. We love eating ramen together, often fall asleep on video calls'],
    ['Cth: Semoga lulus sidang skripsi tahun ini, sehat selalu', 'E.g. I hope you pass your thesis defense this year and stay healthy'],
    ['Contoh: Buatkan surat ucapan ulang tahun untuk pacar saya Natasya yang ke-19...', 'Example: Write a birthday letter for my 19-year-old girlfriend, Natasya...'],
    ['Studio siap', 'Studio ready'], ['Menyimpan...', 'Saving...'], ['Tersimpan Otomatis', 'Saved Automatically'], ['Gagal Menyimpan', 'Could not save'],
    ['Menyimpan draft...', 'Saving draft...'], ['Draft berhasil disimpan! ✓', 'Draft saved! ✓'],
    ['Token tidak ditemukan di URL. Minta link Studio baru dari admin.', 'Token was not found in the URL. Ask the admin for a new Studio link.'],
    ['Project tidak ditemukan. Silakan minta link baru dari admin.', 'Project not found. Please ask the admin for a new link.'],
    ['Gagal terhubung ke server. Coba muat ulang halaman.', 'Could not connect to the server. Please reload the page.'],
    ['Isi surat tidak boleh kosong', 'Letter message cannot be empty'],
    ['Tunggu upload musik selesai dulu', 'Please wait for music upload to finish'],
    ['Salin Link', 'Copy Link'], ['TERSALIN ✓', 'COPIED ✓'],
    ['Gagal salin. Coba manual.', 'Failed to copy. Try manually.'],
    ['Gagal mendownload barcode.', 'Failed to download barcode.'],
    ['Nama domain tidak boleh kosong!', 'Domain name cannot be empty!'],
    ['Nama domain minimal 3 karakter.', 'Domain name must be at least 3 characters.'],
    ['Mengirim...', 'Sending...'],
    ['Lagu berhasil diupload!', 'Song uploaded successfully!'],
    ['Gagal upload audio. Coba lagi.', 'Failed to upload audio. Try again.'],
    ['Audio maksimal 30MB.', 'Audio must be under 30MB.'],
    ['Mengupload lagu...', 'Uploading song...'],
    ['Cari sticker Giphy (cth: cute cat, love)...', 'Search Giphy stickers (e.g. cute cat, love)...'],
    ['Paste URL GIF (https://media.giphy.com/...)', 'Paste GIF URL (https://media.giphy.com/...)'],
    ['Aku mau bilang kalau selama ini...', 'I just wanted to say that all this time...'],
    ['Pengirim (e.g. Your Biggest Fans, Rey)', 'From (e.g. Your Biggest Fan, Rey)']
  ];

  const studioText = Object.fromEntries(studioPairs.flatMap(([id, en]) => [[id, { id, en }], [en, { id, en }]]));
  function t(value) {
    const item = studioText[value];
    return item ? item[get()] : value;
  }

  function applyStudioCopy() {
    const isEn = get() === 'en';
    Object.entries(htmlPhrases).forEach(([id, phrase]) => {
      const el = document.getElementById(id);
      if (el) {
        const target = isEn ? phrase.en : phrase.id;
        if (el.innerHTML !== target) el.innerHTML = target;
      }
    });

    const skipSelector = '#memory-desc-hint, #memory-upload-specs, #envelope-name-hint, #gif-footer-hint, #typewriter-hint-desc, #studio-security-desc, #vip-link-desc, #multi-device-desc, #ai-result-text';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) || parent.isContentEditable || parent.closest(skipSelector)) continue;
      const source = node.nodeValue;
      const key = source.replace(/\s+/g, ' ').trim();
      const translated = t(key);
      if (translated !== key) node.nodeValue = source.replace(key, translated);
    }
    document.querySelectorAll('[placeholder], [title], [aria-label]').forEach((element) => {
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        const source = element.getAttribute(attribute);
        if (source) {
          const translated = t(source);
          if (translated !== source) element.setAttribute(attribute, translated);
        }
      });
    });
  }

  function set(value, fallback) {
    locale = normalize(value, fallback);
    document.documentElement.lang = locale;
    return locale;
  }

  function get() { return locale; }

  function initGift(config) {
    document.getElementById('letter-language-picker')?.remove();
    set(config?.locale, 'en');

    function applyCopy() {
      const locale = get();
      const isId = locale === 'id';
      const text = isId
        ? {
            open: 'Buka Surat',
            loading: 'Membuka suratmu…',
            close: 'Tutup memori',
            previous: 'Memori sebelumnya',
            next: 'Memori berikutnya',
            forLabel: 'untuk',
            tapHint: 'ketuk untuk membuka',
            gentlyOpen: 'buka perlahan',
            secretMemory: 'Buka Memori Rahasia',
            saveLetter: 'Simpan Surat Ini',
            gateTitle: 'Surat Terlindungi',
            gateDesc: 'Masukkan password untuk membuka surat spesial ini.',
            gateHintLabel: 'Petunjuk:',
            gatePlaceholder: 'Masukkan password...',
            gateError: 'Password salah. Coba lagi.'
          }
        : {
            open: 'Open Letter',
            loading: 'Opening your letter…',
            close: 'Close memory',
            previous: 'Previous memory',
            next: 'Next memory',
            forLabel: 'for',
            tapHint: 'tap to open',
            gentlyOpen: 'gently open',
            secretMemory: 'Open Secret Memory',
            saveLetter: 'Save This Letter',
            gateTitle: 'Letter Protected',
            gateDesc: 'Please enter the password to unlock this special message.',
            gateHintLabel: 'Secret Clue:',
            gatePlaceholder: 'Enter password...',
            gateError: 'Invalid password. Try again.'
          };

      const open = document.getElementById('btn-gate-verify');
      if (open) open.textContent = text.open;
      const loading = document.querySelector('.loading-label');
      if (loading) loading.textContent = text.loading;

      const gateTitle = document.querySelector('.gate-title');
      if (gateTitle) gateTitle.textContent = text.gateTitle;
      const gateDesc = document.querySelector('.gate-desc');
      if (gateDesc) gateDesc.textContent = text.gateDesc;
      const gateHint = document.querySelector('.hint-label');
      if (gateHint) gateHint.textContent = text.gateHintLabel;
      const gateInput = document.getElementById('gate-password-input');
      if (gateInput) gateInput.placeholder = text.gatePlaceholder;
      const gateError = document.getElementById('gate-error');
      if (gateError) gateError.textContent = text.gateError;

      const envToLabel = document.querySelector('.env-to-label');
      if (envToLabel) envToLabel.textContent = text.forLabel;

      const envHint = document.getElementById('envelope-hint');
      if (envHint) envHint.innerHTML = `<span aria-hidden="true">❦</span>&ensp;${text.tapHint}&ensp;<span aria-hidden="true">❦</span>`;
      const tapHintText = document.querySelector('.tap-hint-text');
      if (tapHintText) tapHintText.textContent = text.gentlyOpen;

      const btnSecret = document.getElementById('btn-secret-memory');
      if (btnSecret) {
        const svg = btnSecret.querySelector('svg');
        btnSecret.innerHTML = '';
        if (svg) btnSecret.appendChild(svg);
        btnSecret.appendChild(document.createTextNode(' ' + text.secretMemory));
      }

      const btnSave = document.getElementById('btn-save-letter');
      if (btnSave) {
        const svg = btnSave.querySelector('svg');
        btnSave.innerHTML = '';
        if (svg) btnSave.appendChild(svg);
        btnSave.appendChild(document.createTextNode(' ' + text.saveLetter));
      }

      document.querySelectorAll('[aria-label="Open this letter"], [aria-label="Buka surat ini"]').forEach((el) => el.setAttribute('aria-label', isId ? 'Buka surat ini' : 'Open this letter'));
      document.querySelectorAll('[aria-label="Close memory"], [aria-label="Tutup memori"]').forEach((el) => el.setAttribute('aria-label', text.close));
      document.querySelectorAll('[aria-label="Previous memory"], [aria-label="Memori sebelumnya"]').forEach((el) => el.setAttribute('aria-label', text.previous));
      document.querySelectorAll('[aria-label="Next memory"], [aria-label="Memori berikutnya"]').forEach((el) => el.setAttribute('aria-label', text.next));
    }
    applyCopy();
  }

  function initStudio(config, onChange) {
    set(config?.locale, 'en');
    let wrap = document.getElementById('letter-studio-language');
    if (!wrap) {
      if (!document.getElementById('letter-studio-language-style')) {
        const style = document.createElement('style');
        style.id = 'letter-studio-language-style';
        style.textContent = `
          #letter-studio-language { position:fixed; top:14px; right:14px; z-index:9999; display:flex; gap:6px; align-items:center; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,.94); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); box-shadow:0 4px 16px rgba(0,0,0,.12); font:600 12px system-ui,-apple-system,sans-serif; color:#4b352d; border:1px solid rgba(0,0,0,.06); }
          #letter-studio-language select { background:transparent; border:none; font:inherit; color:inherit; cursor:pointer; outline:none; }
          @media (max-width: 480px) {
            #letter-studio-language { top:10px; right:10px; padding:4px 8px; gap:0; }
            #letter-studio-language > span { display:none !important; }
          }
        `;
        document.head.appendChild(style);
      }
      wrap = document.createElement('label');
      wrap.id = 'letter-studio-language';
      wrap.innerHTML = '<span></span><select aria-label="Studio language"><option value="id">Indonesia</option><option value="en">English</option></select>';
      document.body.appendChild(wrap);
      wrap.querySelector('select').addEventListener('change', (event) => {
        onChange(event.target.value);
        wrap.querySelector('span').textContent = get() === 'id' ? 'Bahasa' : 'Language';
        applyStudioCopy();
        if (typeof Studio !== 'undefined' && typeof Studio.renderGallery === 'function') {
          Studio.renderGallery();
        }
      });
    }
    wrap.querySelector('select').value = get();
    wrap.querySelector('span').textContent = get() === 'id' ? 'Bahasa' : 'Language';
    applyStudioCopy();
  }

  global.LetterI18n = { normalize, set, get, t, initGift, initStudio, applyStudioCopy };
})(window);
