# 📋 Letter_Project — Analisis Mendalam

---

## 📁 FOLDER 1: for-you-always (Voices Gift)

### Tujuan & Tema
Platform kado digital **emosional berbasis foto dan suara**. Pengirim mengunggah 12–15 foto kenangan, merekam voice note pribadi, memilih musik latar (ambient/custom), dan menulis pesan cinta. Penerima membuka hadiah lewat link unik yang dilindungi password.

### Target Penerima
Pasangan romantis — nuansa **intimate, nostalgic, sentimental**. Seperti membuka kotak kenangan analog dalam bentuk digital. Bahasa dominan: Indonesia, sangat warm dan personal.

### Struktur File

```
for-you-always/
├── index.html              ← Root landing (redirect ke gift/)
├── gift/                   ← Template utama (tema: rose/gold/mocha)
│   ├── index.html          ← Player utama
│   ├── style.css           ← 1680 baris, CSS skeuomorphic
│   └── js/
│       ├── gift.js         ← State router (loading/password/render)
│       ├── player.js       ← 1240 baris! Voice player + crank engine
│       └── gallery.js      ← Photo lightbox dengan swipe
├── camera/                 ← 5 sub-tema kamera (silver, midnight, mossy, rosewood, magenta)
│   ├── camera.css          ← Shared styling kamera
│   └── player.js           ← Per-tema player
├── gift-beige/gift-blanc/gift-pinky/gift-sage/  ← Varian warna
├── shared/                 ← ambient-data.js (suara ambient global)
├── studio/                 ← Studio Editor (customer isi konten)
├── studio-premium/         ← Studio Premium (kirim ke Telegram admin)
├── generator/              ← Tool generator link
├── worker/                 ← Cloudflare Worker (API + R2 storage)
├── bundle/                 ← Portal bundling premium (token-based)
└── admin-insights/         ← Dashboard admin
```

### Animasi & Interaksi

| Elemen | Deskripsi |
|--------|-----------|
| **Music Box Crank** | UI utama — user **memutar tuas engkol** (drag/touch) untuk memutar foto & memutar voice note. Rotasi tuas = geser foto + play audio. Sinkronisasi via `totalCrankAngle`. |
| **Auto-Play** | Tombol AUTO dengan countdown 3-2-1, efek TV static, lalu auto-rotate. Delta-time normalized ke 60fps. |
| **Waveform Visualizer** | 24 bar frekuensi real-time via Web Audio API `AnalyserNode`. Fallback gelombang palsu untuk iOS/WebM. |
| **Bokeh Particles** | 4 partikel besar blur bereaksi terhadap volume audio rata-rata. |
| **Light Leak Overlay** | Efek analog — flicker cahaya oranye saat cranking (color-dodge blend). |
| **Mechanical Jitter** | Seluruh viewport bergetar halus 0.5px saat aktif. |
| **Glass Lens Overlay** | Efek lensa konveks dengan refleksi diagonal dan tint anti-reflective. |
| **Analog Noise** | Scanline overlay + fractal noise SVG (opacity 0.08). |
| **Polaroid Modal** | Setelah voice note selesai: kartu polaroid muncul (eject animation), bisa di-flip front↔back. Front: foto, Back: surat. |
| **Countdown** | 3-2-1 + static noise sebelum auto-play dimulai. |

### Elemen Visual

| Aspek | Detail |
|-------|--------|
| **Fonts** | `Cormorant Garamond` (display), `DM Sans` (body), `Space Mono` (timer) |
| **Warna** | 7 tema: rose, gold/original, midnight, mossy/sage, silver/camera, pinky/magenta. Semua menggunakan CSS custom properties (`--bg`, `--primary`, `--accent`, `--text`, `--mesh`). |
| **Layout** | Centered single-column, max-width 420px. Skeuomorphic music box dengan screws, slots, brass crank. |
| **Motion** | Smooth cubic-bezier transitions, `will-change: transform, opacity`, GPU-accelerated `translate3d`. |
| **Texture** | Fractal noise overlay, mesh gradient backgrounds, glass lens reflection, radial gradients berlapis. |

### Alur UX
1. **Loading** → spinner saat fetch config dari API
2. **Preloading** → progress bar "Mempersiapkan kenangan... X%"
3. **Password Gate** → input password (opsional) + hint
4. **Gift Page** → Music Box muncul: press AUTO atau putar tuas manual
5. **Slideshow** → foto bergeser di viewport 240px sesuai rotasi tuas
6. **Voice Note** → audio dimainkan bersamaan dengan slideshow
7. **Polaroid** → setelah voice note selesai, kartu polaroid muncul otomatis

### Teknologi
- **Vanilla JS** (module pattern IIFE)
- **Web Audio API** (AudioContext, AnalyserNode, GainNode, MediaElementSource)
- **Cloudflare Workers + R2** (storage foto/audio)
- **Cloudflare KV** (config per customer)
- **Vercel** (hosting + routing)
- **Qwen AI** (message generator di studio)
- **Telegram Bot API** (notifikasi order premium)

### Fitur Unik
- **Dual Mode**: Online (fetch dari KV) dan Standalone (config.js lokal untuk premium)
- **Crank Mechanics**: Interaksi fisik unik — user harus "memutar" tuas untuk melihat foto
- **Ambient Soundscapes**: rain, cafe, waves, fireplace, forest + custom MP3
- **iOS Audio Workarounds**: Silent unlock hack, WebM duration hack, tab background recovery
- **Haptic Feedback**: `navigator.vibrate(5)` saat crank
- **Infinite Photo Loop**: Double-buffer foto untuk seamless looping

---

## 📁 FOLDER 2: Loves-Project

### Tujuan & Tema
Template kado digital bergaya **"Spotify Wrapped" untuk pasangan**. Multi-halaman SPA dengan alur naratif: login → musik → galeri → wrapped stats → surat cinta → invitation. Nuansa: **romantic, Valentine, cute/playful**.

### Perbedaan dari for-you-always
| Aspek | for-you-always | Loves-Project |
|-------|---------------|---------------|
| **Metafora UI** | Music box/mesin analog | Spotify Wrapped + scrapbook |
| **Mode warna** | Dark (mocha, midnight, mossy) | Light (pink, cream, pastel) |
| **Konten** | Voice note + foto slideshow | Multi-playlist + galeri + stats + surat + invitation |
| **Interaksi** | Single-page, crank-based | SPA 6 halaman, swipe/tap/scratch |
| **Tone** | Intimate, vintage, mechanical | Playful, cute, modern romantic |
| **Background** | Mesh gradients gelap | Gradient pastel cerah (pink→cream→lavender) |

### Struktur File

```
Loves-Project/
├── index.html          ← 2965 baris! Semua CSS+HTML+JS dalam 1 file (SPA monolith)
├── shared.css          ← CSS variabel global, nav bar, glass card, washi tape
├── data.js             ← Config data (window.VALENTINE_DATA)
├── pages/              ← 7 halaman modular (HTML fragments)
│   ├── 01-login/       ← Password gate dengan partikel floating
│   ├── 02-music/       ← Music player card ala Polaroid
│   ├── 03-gallery/     ← Scrapbook dengan scratch-to-reveal
│   ├── 04-wrapped/     ← Printer animation + stats card
│   ├── 05-surat/       ← Envelope buka + surat kertas
│   ├── 06-invitation/  ← "Maukah kamu jadi Valentine?" + yes/no
│   └── 07-bucketlist/  ← (Dihapus/unused)
├── studio/             ← Studio editor
├── free-studio/        ← Studio gratis
├── generator/          ← Link generator
├── loves-worker/       ← Cloudflare Worker
└── assets/             ← gambar, musik, SFX, favicon
```

### Animasi & Interaksi

| Halaman | Interaksi |
|---------|-----------|
| **Login** | Floating emoji hearts/stars, shake animation saat salah, lock icon berubah |
| **Music** | Polaroid-style music card (miring rotasi), cover art, visualizer bars, progress bar, prev/next/play, song dots |
| **Gallery** | **Scratch-to-reveal** — user menggaruk lapisan abu-abu untuk membuka foto (canvas-based). Sound effect scratching. Polaroid frame + washi tape. Modal lightbox. Mendukung **video + image**. |
| **Wrapped** | **Printer animation** — mesin cetak bergetar, LED berkedip, kartu statistik "tercetak" slide-up dari slot printer. Sound effect printer. Counter animasi (minutes together tick-up). |
| **Surat** | **Envelope buka** — tap untuk buka flap envelope (3D perspective rotateX). Surat dengan ruled lines, red margin line, typewriter-style font. |
| **Invitation** | "Maukah kamu...?" dengan bear GIF bouncing, tombol Yes (shimmer glow) dan No (shrinking away). Confetti explosion saat Yes. |

### Elemen Visual

| Aspek | Detail |
|-------|--------|
| **Fonts** | `Cinzel` (display), `Inter` (sans), `Caveat` (handwriting), `Cormorant Garamond` (editorial), `Mrs Saint Delafield` (signature), `Dancing Script` (lyrics) |
| **Warna** | `--primary: #7e0c23` (deep red), `--rosegold: #B76E79`, cream/pink pastels. Background: `linear-gradient(135deg, #fadceb, #fef3e2, #e0e7ff)`. |
| **Layout** | Mobile-first SPA, max-width 420-460px, glass cards (backdrop-filter blur) |
| **Motion** | `fadeInUp`, shimmer button effects, printer vibration, envelope 3D flip, confetti cascade |
| **Texture** | Grain overlay (external image), washi tape CSS (complex clip-path), ruled paper lines |

### Alur UX
1. **Login** → password + hint + floating particles
2. **Music** → pilih lagu dari playlist, play/pause, swipe dots
3. **Gallery** → scratch foto untuk reveal, tap untuk modal besar
4. **Wrapped** → printer cetak stats (minutes together, vibe, top places, core memories)
5. **Surat** → buka amplop → baca surat cinta
6. **Invitation** → "Maukah kamu jadi Valentine?" → Yes (confetti!) / No (kabur)

### Teknologi
- **Vanilla JS** (semua inline di index.html, ~2965 baris)
- **SPA di single file** — halaman di-fetch dari `pages/XX/index.html` dan di-inject
- **Canvas API** — scratch-to-reveal di galeri
- **Cloudflare Workers + R2 + KV** (backend serupa)
- **Dual Mode** — Online (token fetch) dan Standalone (data.js lokal)

### Fitur Unik
- **Scratch-to-Reveal Gallery**: User menggaruk foto ala tiket lotere
- **Printer Animation**: Statistik hubungan "dicetak" keluar dari printer virtual
- **Envelope 3D Flip**: Amplop terbuka dengan perspective 3D
- **No-Button Chase**: Tombol "No" di invitation semakin mengecil/kabur saat di-hover
- **Live Counter**: Minutes together di-hitung real-time dari tanggal anniversary
- **Video Support** di galeri (bukan hanya foto)
- **Audio Pre-buffering**: Lagu pertama di-load sejak awal, sebelum user sampai halaman musik

---

## 📁 FOLDER 3: Arcade

### Tujuan & Tema
Platform kado interaktif **bergaya pixel-art Studio Ghibli** dengan **10 ruangan** yang masing-masing berisi aktivitas berbeda. Metafora: masuk ke sebuah dunia fantasi dan menjelajahi "ruangan-ruangan" kenangan.

### Elemen Game/Arcade
**Ya, sangat banyak:**
- **Star Catcher** — mini-game tangkap bintang jatuh
- **Fortune Cookie** — buka ramalan romantis acak
- **Quiz** — tebak jawaban tentang pasangan (scorecard)
- **Room Locking** — semua room terkunci sampai Music room dimainkan dulu (gamification)
- **Menu grid** — layout ala arcade cabinet dengan icon pixel-art

### Struktur File

```
Arcade/
├── arcade/
│   ├── index.html          ← Main player (loading → password → menu)
│   ├── config.js           ← Demo config (window.STANDALONE_CONFIG)
│   ├── script.js           ← 473 baris — state machine, parallax, room navigation
│   ├── style.css           ← 30K — Ghibli theme, lanterns, god rays, parallax
│   ├── assets/
│   │   ├── bg_ghibli.webp  ← Background utama pixel-art Ghibli
│   │   ├── wood_sign.webp  ← Papan kayu nama penerima
│   │   └── icons/          ← 10 icon webp per room
│   ├── rooms/              ← 10 room (masing-masing HTML mandiri, dimuat dalam iframe)
│   │   ├── music/          ← Star visualizer + playlist
│   │   ├── journey/        ← Timeline hubungan
│   │   ├── moments/        ← Galeri foto sinematik
│   │   ├── quiz/           ← Quiz interaktif (10 pertanyaan)
│   │   ├── Atlas-Of-Us/    ← Peta interaktif (Leaflet.js + OpenStreetMap, tema Windows 98)
│   │   ├── star-catcher/   ← Mini-game tangkap bintang
│   │   ├── fortune-cookie/ ← Kartu ramalan romantis
│   │   ├── things-i-love/  ← Flip cards
│   │   ├── bucket-list/    ← Journal diary vertical (ruled lines, book spine)
│   │   └── message/        ← Pesan cinta penutup
│   └── constellation/      ← (Unused/reverted)
├── studio/                  ← Studio Editor
├── studio-premium/          ← Studio Premium
├── admin/                   ← Admin dashboard + Song Library Manager
├── generator/               ← Link generator
├── barcode/                 ← QR Code generator aesthetic
├── premium_kit/             ← Template config deploy manual
└── worker/                  ← Cloudflare Worker
```

### Animasi & Interaksi

| Elemen | Deskripsi |
|--------|-----------|
| **Loading Screen** | Emblem ring animasi + floating lanterns + sparkle dust. Loading bar progressif. |
| **Password Gate** | SVG crystal ball animated (floating particles, glowing stars di dalam bola kaca).|
| **Parallax Menu** | 4 layer parallax (bg, god rays, petals, menu). Mengikuti mouse/gyroscope device. LERP smoothing. |
| **God Rays** | Cahaya diagonal animasi — efek sinar matahari menembus pohon Ghibli. |
| **Floating Petals** | 10-18 kelopak bunga melayang naik dengan random speed/delay/color. |
| **Wood Sign** | Papan kayu dengan nama penerima ("For *Lisa*, Always"). Auto-shrink font untuk nama panjang. |
| **Room Locking** | Semua room terkunci (kecuali Music). Unlock setelah music dimainkan (postMessage dari iframe Music). |
| **Room Modal** | Iframe-based modal. Each room adalah HTML mandiri yang di-load dalam iframe. |
| **Star Catcher** | Game HTML5 dengan bintang jatuh, drag untuk tangkap. |
| **Atlas** | Peta interaktif Leaflet.js, tema Windows 98, flyTo animation antar pin, Haversine distance calculator. |

### Elemen Visual

| Aspek | Detail |
|-------|--------|
| **Fonts** | `Press Start 2P` (pixel/retro), `Dancing Script` (handwriting), `Caveat` (pesan personal), `Cormorant Garamond` (italic display), `DM Sans` (UI body) |
| **Warna** | Warm Ghibli palette: amber, cream, soft orange. God rays: warm golden. Petals: `rgba(255, 196, 147)` dsb. Password: deep purple crystal ball. |
| **Layout** | Fullscreen viewport, layered parallax, 2-row grid menu (4+6). Each room fullscreen dalam iframe. |
| **Motion** | Parallax (mouse/gyro), floating petals, god ray animation, screen fade transitions, room modal slide. |
| **Texture** | Pixel-art Ghibli background, wooden sign texture, crystal ball SVG, lantern glow effects. |

### Alur UX
1. **Loading** → emblem animasi + progress bar + nama penerima
2. **Password** → crystal ball SVG + hint
3. **Main Menu** → parallax Ghibli scene, papan kayu, 10 room icons (Music harus dibuka duluan)
4. **Music Room** → play lagu → unlock semua room lain
5. **Explore Rooms** → navigasi bebas ke 9 room lainnya via modal iframe
6. **Close** → kembali ke menu, room state persistent (things-i-love)

### Teknologi
- **Vanilla JS** (module pattern, `const $ = (sel) => document.querySelector(sel)`)
- **Iframe Architecture** — setiap room adalah HTML terpisah, dimuat dalam iframe modal
- **sessionStorage** — config dikirim antar parent↔iframe lewat sessionStorage
- **postMessage** — komunikasi parent↔iframe (unlock rooms, visualizer state)
- **Leaflet.js + OpenStreetMap** (Atlas room)
- **Haversine Formula** (hitung jarak antar pin)
- **Cloudflare Workers + R2 + KV** (backend)
- **Vercel** (hosting + clean URL routing)

### Fitur Unik
- **10 Unique Rooms**: Setiap room adalah mini-app mandiri
- **Room Locking System**: Gamification — harus "unlock" lewat Music
- **Parallax Engine**: Multi-layer dengan LERP smoothing + gyroscope support
- **Atlas with Real Maps**: Peta interaktif sungguhan dengan OpenStreetMap
- **Star Catcher Game**: Mini-game HTML5 nyata
- **Windows 98 UI**: Atlas room menggunakan tema retro Win98
- **Persistent Iframe**: Things I Love room tidak reset saat ditutup.

---

## 📁 FOLDER 4: letter (Premium Digital Letter)

### Tujuan & Tema
Platform surat digital **minimalis & premium** yang berfokus pada keindahan tipografi dan tekstur kertas sejati. Metafora: menerima sepucuk surat fisik yang sangat personal, lengkap dengan amplop bergaya Pinterest dan segel lilin (*wax seal*). Memberikan kesan eksklusif, tenang, dan sangat intim.

### Target Penerima
Pasangan atau sahabat — nuansa **timeless, clean, editorial**. Cocok untuk ungkapan perasaan yang panjang dan mendalam tanpa gangguan visual yang ramai.

### Struktur File

```
letter/
├── index.html          ← Entry point (Envelope → Letter state)
├── style.css           ← Tipografi, tekstur kertas, & geometri amplop
├── script.js           ← Typewriter engine + iOS audio compatible logic
├── config.js           ← Demo data (window.STANDALONE_CONFIG)
└── assets/             ← Seal SVG, icons
```

### Animasi & Interaksi

| Elemen | Deskripsi |
|--------|-----------|
| **Interactive Envelope** | Tap amplop untuk membuka flap (3D perspective) dengan transisi mulus ke mode surat. |
| **Wax Seal Animation** | Segel lilin yang memudar dan mengecil saat amplop diketuk. |
| **Dramatical Typewriter** | Isi surat diketik karakter demi karakter dengan jeda acak dan pause pada tanda baca untuk kesan manusiawi. |
| **Sync Audio Trigger** | Musik diputar **sinkron** tepat saat amplop diketuk (user gesture) untuk 100% kompatibilitas pada **iPhone/iOS**. |
| **Scrolling Paper** | Kertas surat yang panjang dengan efek tumpukan kertas (*paper stack*) di bawahnya. |

### Elemen Visual

| Aspek | Detail |
|-------|--------|
| **Fonts** | `Sacramento` (Signature/Sender), `Caveat` (Body & Envelope), `Cormorant Garamond` (Editorial Date). |
| **Geometry** | Amplop 420px x 280px (Premium Aspect Ratio). |
| **Texture** | Natural paper grain, subtle ruled lines (tanpa garis margin merah untuk kesan clean). |
| **Prefix Stripping** | Logika cerdas: menghapus "Dearest," di amplop, tapi menampilkannya di dalam surat. |

### Teknologi & Pola
- **Vanilla JS** (Module pattern)
- **State Machine**: loading → envelope → letter
- **Mobile Optimized**: Clamp typography, mobile-first layouts
- **Standalone Mode Support** via config.js

---

## 🔍 IDENTIFIKASI POLA (Kesamaan)

### 1. Arsitektur Backend Identik
Ketiga template menggunakan stack **Cloudflare Workers + R2 + KV** yang sama:
- Foto/audio/video disimpan di **R2**
- Config per-customer disimpan di **KV**
- Worker menangani upload, get-config, dan resize
- CDN: `cdn.for-you-always.my.id` / `arcade-assets.for-you-always.my.id`

### 2. Dual Mode (Online + Standalone)
Semua template punya mekanisme yang sama:
- Jika ada `?to=ID` → fetch config dari Worker API (Online Mode)
- Jika tidak ada token tapi ada `config.js`/`data.js` → baca lokal (Standalone/Premium Mode)
- Ini memungkinkan deploy mandiri per-customer untuk tier premium

### 3. Password Gate Pattern
Semua template memiliki:
- Input password + tombol unlock + error shake animation
- Password hint (opsional)
- Preview bypass (`?preview=true`)
- Password disimpan di config, diverifikasi client-side

### 4. State Machine UI
Semua menggunakan pola `showState('loading' | 'error' | 'password' | 'gift')` dengan `.hidden` class toggle:
```js
const showState = (stateId) => {
  ['loading', 'error', 'password', 'gift'].forEach(id => {
    document.getElementById(`state-${id}`)?.classList.toggle('hidden', id !== stateId);
  });
};
```

### 5. Studio Editor Pattern
Setiap produk dilengkapi:
- **Studio Regular** (`/studio/:token`) — self-serve editor
- **Studio Premium** (`/studio-premium/:token`) — kirim ke Telegram admin
- **Generator** — tool buat generate link baru
- **Admin Dashboard** — monitoring customer
- **playlist.json** — Song Library kurasi

### 6. Hosting & Routing (Vercel)
Semua menggunakan `vercel.json` dengan rewrite rules untuk clean URLs:
- `/studio/:token` → `/studio/index.html`
- `/:id` → `/arcade/index.html?id=$id`

### 7. Vanilla JS Stack
**Zero framework**, **zero bundler**. Semua ditulis dalam Vanilla JS murni:
- Module pattern (IIFE / object literal)
- DOM manipulation langsung
- CSS Variables untuk theming
- Google Fonts via CDN

### 8. Mobile-First Design
Target audience: **90% perempuan, pakai HP**, non-IT:
- `user-scalable=no`
- Touch-optimized interactions
- iOS-specific audio workarounds (autoplay policy)
- `will-change` hints untuk GPU acceleration

### 9. Identity & Branding
Semua produk di bawah umbrella brand **"For You, Always."**:
- Watermark badge dengan ikon diamond (💎)
- SEO: `noindex, nofollow` (private gift links)
- OG tags untuk preview WhatsApp: "Ada hadiah untukmu 💕"

---

## 🔀 IDENTIFIKASI PERBEDAAN

| Aspek | for-you-always | Loves-Project | Arcade |
|-------|---------------|---------------|--------|
| **Mood** | Dark, intimate, vintage | Light, cute, playful | Fantasy, warm, whimsical | Minimalist, premium, editorial |
| **Color Mode** | Dark themes (7 palet) | Light pink/cream | Warm amber Ghibli | Blush-Cream / Sage / Rose |
| **Jumlah Halaman** | 1 (single-page) | 6 (SPA multi-page) | 10 (iframe rooms) | 2 states (Env → Letter) |
| **Interaksi Utama** | Crank rotation | Tap/scratch/swipe | Explore rooms | Tap envelope |
| **Audio** | Voice note + ambient | Multi-song playlist | Multi-song + star visualizer | Emotional background music |
| **Media** | Foto saja | Foto + Video | Foto + Video | Text-focused (minimalist) |
| **Gamification** | Tidak ada | Bear GIF invitation | Room locking + mini-games | Tidak ada (fokus emosi) |
| **Konten Unik** | Polaroid flip, crank | Printer stats, envelope | Atlas peta, quiz, star catcher | Typewriter, physical envelope |
| **Arsitektur** | Multi-file, tema varian | Monolith (1 HTML besar) | Iframe modular (10 rooms) | Multi-file logic |
| **Font Utama** | Cormorant Garamond | Cinzel + Caveat | Press Start 2P + Caveat | Sacramento + Caveat |
| **Complexity** | Medium | High | Very High | Light (Elegant/High-end) |

---

## 💎 DNA PROJECT: "Jiwa" Letter_Project

### Misi Inti
> **Mengubah fragmen digital (foto, suara, teks) menjadi artefak kasih sayang yang bermakna dan tahan lama.**

### Karakter Brand
1. **Intimate, bukan transaksional** — setiap template dirancang agar penerima *merasakan* kasih sayang pengirim, bukan sekadar melihat konten.
2. **Analog di dunia digital** — kerinduan terhadap hal-hal fisik: music box (crank), printer stats, 3D envelope, scratch tickets.
3. **Progresif & berlapis** — alur naratif: loading anticipation → password mystery → konten reveal.
4. **Warm, feminine, romantic** — palet warna hangat, font serif/handwriting, tekstur analog (noise, grain).
5. **Mobile-native** — dirancang untuk dibuka via link WhatsApp di HP, tanpa install apapun.
6. **Premium craftsmanship** — detail tinggi di setiap pixel dan animasi.

### Filosofi Desain
- **"A memory to keep, a voice to remember."**
- Setiap detail dirancang untuk membuat penerima merasa: *"seseorang benar-benar memikirkan aku."*
- Bukan sekadar "digital card" — ini adalah **pengalaman** imersif.
