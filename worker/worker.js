/**
 * Letter Edition — Cloudflare Worker
 * Backend API untuk template surat digital premium.
 *
 * Routes:
 *  POST   /upload                  Upload audio ke R2
 *  PUT    /upload-direct/:key      Direct upload audio ke R2
 *  GET    /get-config?id=xxx       Ambil config letter dari KV
 *  POST   /save-config?id=xxx      Simpan config letter ke KV
 *  POST   /login                   Admin auth
 *  POST   /generator-login         Generator auth
 *  GET    /list-configs            List semua letters (admin)
 *  GET    /admin/list-gifts        Detail list + metadata (admin)
 *  POST   /admin/delete-gifts      Batch delete letters (admin)
 *  POST   /submit-premium          Submit order premium → Telegram
 *  POST   /generate-ai             Proxy ke Qwen AI
 *  GET    /debug                   Debug info (admin)
 */

// CDN domain untuk akses file R2 langsung (musik)
const CDN_URL = 'https://letter-assets.for-you-always.my.id';

var index_default = {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    // ── SECURITY: Origin Validation ────────────────────────────
    const isAllowedOrigin = (req) => {
      const origin = req.headers.get('Origin') || '';
      const allowed = [
        'https://letter.for-you-always.my.id',
        'https://for-you-always.my.id',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:5501',
        'http://127.0.0.1:5501',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      // Izinkan semua *.vercel.app untuk kado premium customer
      if (origin.endsWith('.vercel.app')) return true;
      return allowed.includes(origin);
    };

    const url = new URL(request.url);

    // ── POST /upload ─────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/upload') {
      if (!isAllowedOrigin(request)) {
        return new Response(JSON.stringify({ error: 'Akses ditolak.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Limit 30MB untuk audio
        if (file.size > 30 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'File terlalu besar. Maksimal 30MB.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop().toLowerCase();
        const filename = `${timestamp}-${randomStr}.${ext}`;

        await env.BUCKET.put(filename, file.stream(), {
          httpMetadata: { contentType: file.type || 'audio/mpeg' },
        });

        const publicUrl = `${CDN_URL}/${filename}`;

        return new Response(JSON.stringify({ success: true, url: publicUrl, filename, size: file.size }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── PUT /upload-direct/:key — Direct upload ke R2 ────────
    if (request.method === 'PUT' && url.pathname.startsWith('/upload-direct/')) {
      if (!isAllowedOrigin(request)) {
        return new Response(JSON.stringify({ error: 'Akses ditolak.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        let key = url.pathname.replace('/upload-direct/', '');
        if (!key || key.includes('..')) {
          return new Response(JSON.stringify({ error: 'Invalid key' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Pastikan masuk ke folder letters/
        if (!key.startsWith('letters/')) {
          key = 'letters/' + key;
        }

        const contentLength = parseInt(request.headers.get('Content-Length') || '0');
        if (contentLength > 30 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'File terlalu besar. Maksimal 30MB.' }), {
            status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const contentType = request.headers.get('Content-Type') || 'audio/mpeg';
        await env.BUCKET.put(key, request.body, { httpMetadata: { contentType } });

        return new Response(JSON.stringify({ success: true, url: `${CDN_URL}/${key}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── GET /get-config ──────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/get-config') {
      const pwd = url.searchParams.get('pwd');
      const isOwnerBypass = pwd && env.ADMIN_SECRET && (pwd === env.ADMIN_SECRET);

      if (!isOwnerBypass && !isAllowedOrigin(request)) {
        return new Response(JSON.stringify({ error: 'Akses ditolak.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { value: data } = await env.LETTER_DATA.getWithMetadata(id);
        if (!data) {
          return new Response(JSON.stringify({ error: 'Config not found', id }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /save-config ────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/save-config') {
      if (!isAllowedOrigin(request)) {
        return new Response(JSON.stringify({ error: 'Akses ditolak.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body = await request.json();

        // ── Free-tier sanitization (server-side guard) ──────────
        // Read existing config to get the authoritative isPremium flag
        const existingRaw = await env.LETTER_DATA.get(id);
        const existingConfig = existingRaw ? JSON.parse(existingRaw) : {};
        const isPremium = existingConfig.isPremium === true;

        // Preserve server-controlled flags (client must never overwrite them)
        body.isPremium           = existingConfig.isPremium           ?? false;
        body.secretMemoryEnabled = existingConfig.secretMemoryEnabled ?? false;

        if (!isPremium) {
          // Strip password lock
          body.login_password = '';
          body.login_hint     = '';
          // Strip any custom-uploaded audio — allow library tracks only
          if (Array.isArray(body.playlist)) {
            body.playlist = body.playlist.filter(t => t.isLibrary === true);
          }
          // Strip secret memory photos
          body.secretMediaList = [];
        }
        // ────────────────────────────────────────────────────────

        await env.LETTER_DATA.put(id, JSON.stringify(body));

        return new Response(JSON.stringify({
          success: true,
          message: 'Letter saved!',
          id,
          previewUrl: `https://letter.for-you-always.my.id/?to=${id}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /login ──────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/login') {
      try {
        const { password } = await request.json();
        const expected = env.ADMIN_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ success: false, error: 'ADMIN_SECRET not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (password !== expected) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, token: btoa(password + Date.now()) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /generator-login ────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/generator-login') {
      try {
        const { password } = await request.json();
        const expected = env.GENERATOR_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ success: false, error: 'GENERATOR_SECRET not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (password === expected) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: false, error: 'Password salah' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /generate-link ────────────────────────────────
    if (request.method === "POST" && url.pathname === "/generate-link") {
      try {
        const authHeader = request.headers.get("Authorization");
        const secret = env.GENERATOR_SECRET;
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const body = await request.json();
        const customId = body.id?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const studioPassword = body.studioPassword || null;

        if (!customId || customId.length < 3) {
          return new Response(JSON.stringify({ error: "ID minimal 3 karakter" }), { status: 400, headers: corsHeaders });
        }

        const existing = await env.LETTER_DATA.get(customId);
        if (existing) {
          return new Response(JSON.stringify({ error: `ID '${customId}' sudah digunakan.` }), { status: 409, headers: corsHeaders });
        }

        const initialConfig = {
          id: customId,
          studioPassword: studioPassword,
          recipientName: "",
          letterTo: "",
          message: "",
          from: "",
          playlist: [],
          status: "draft",
          is_active: true,
          secretMemoryEnabled: false,
          created_at: new Date().toISOString()
        };

        await env.LETTER_DATA.put(customId, JSON.stringify(initialConfig));

        const domainUrl = 'https://letter.for-you-always.my.id';
        return new Response(JSON.stringify({
          success: true,
          id: customId,
          studioUrl: `${domainUrl}/studio/${customId}`,
          giftUrl: `${domainUrl}/?to=${customId}`,
          message: `Link berhasil dibuat`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ── POST /change-id ────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/change-id") {
      try {
        const authHeader = request.headers.get("Authorization");
        const secret = env.GENERATOR_SECRET;
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const body = await request.json();
        const oldId = body.oldId?.trim().toLowerCase();
        const newId = body.newId?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

        if (!oldId || !newId) {
          return new Response(JSON.stringify({ error: "Isi kedua ID!" }), { status: 400, headers: corsHeaders });
        }

        const existingOld = await env.LETTER_DATA.get(oldId);
        if (!existingOld) {
          return new Response(JSON.stringify({ error: `ID '${oldId}' tidak ditemukan.` }), { status: 404, headers: corsHeaders });
        }

        const existingNew = await env.LETTER_DATA.get(newId);
        if (existingNew) {
          return new Response(JSON.stringify({ error: `ID '${newId}' sudah digunakan.` }), { status: 409, headers: corsHeaders });
        }

        const data = JSON.parse(existingOld);
        data.id = newId;
        data.updated_at = new Date().toISOString();

        await env.LETTER_DATA.put(newId, JSON.stringify(data));
        await env.LETTER_DATA.delete(oldId);

        const domainUrl = 'https://letter.for-you-always.my.id';
        return new Response(JSON.stringify({
          success: true,
          id: newId,
          studioUrl: `${domainUrl}/studio/${newId}`,
          giftUrl: `${domainUrl}/?to=${newId}`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ── GET /list-configs ────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/list-configs') {
      const authHeader = request.headers.get('Authorization');
      const pwd = url.searchParams.get('pwd');
      const secret = env.ADMIN_SECRET;
      const isAuthenticated = secret && (authHeader === `Bearer ${secret}` || pwd === secret);

      if (!isAuthenticated) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const list = await env.LETTER_DATA.list();
        const ids = list.keys.map(k => k.name);
        return new Response(JSON.stringify({ configs: ids, count: ids.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── GET /admin/list-gifts ────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/admin/list-gifts') {
      const authHeader = request.headers.get('Authorization');
      const secret = env.ADMIN_SECRET;

      if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const list = await env.LETTER_DATA.list();
        const detailPromises = list.keys.map(async (keyObj) => {
          try {
            const { value: data } = await env.LETTER_DATA.getWithMetadata(keyObj.name);
            if (data) {
              const config = JSON.parse(data);
              return {
                id: keyObj.name,
                recipientName: config.recipientName || config.to || 'Unknown',
                title: config.title || '',
                from: config.from || '',
                status: config.status || 'unknown',
                theme: config.theme || 'blush-cream',
                playlist: config.playlist || [],
                lastOpened: config.lastOpened || null,
                isPremium: config.isPremium || false,
                secretMemoryEnabled: config.secretMemoryEnabled === true,
                publishedAt: config.publishedAt || config.createdAt || null,
              };
            }
          } catch (e) { return null; }
          return null;
        });

        const results = (await Promise.all(detailPromises)).filter(r => r !== null);
        return new Response(JSON.stringify({ success: true, gifts: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /admin/delete-gifts ─────────────────────────────
    if (request.method === 'POST' && url.pathname === '/admin/delete-gifts') {
      const authHeader = request.headers.get('Authorization');
      const secret = env.ADMIN_SECRET;

      if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids)) {
          return new Response(JSON.stringify({ success: false, error: 'Tentukan ID yang akan dihapus.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await Promise.all(ids.map(id => env.LETTER_DATA.delete(id)));
        return new Response(JSON.stringify({ success: true, message: `${ids.length} surat berhasil dihapus.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /admin/toggle-memory ─────────────────────────────
    // Enable / disable secretMemoryEnabled flag for a letter (admin only)
    if (request.method === 'POST' && url.pathname === '/admin/toggle-memory') {
      const authHeader = request.headers.get('Authorization');
      const secret = env.ADMIN_SECRET;

      if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { id, enabled } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: 'ID diperlukan.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existing = await env.LETTER_DATA.get(id);
        if (!existing) {
          return new Response(JSON.stringify({ success: false, error: `Letter '${id}' tidak ditemukan.` }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const config = JSON.parse(existing);
        config.secretMemoryEnabled = enabled === true;
        config.updated_at = new Date().toISOString();
        await env.LETTER_DATA.put(id, JSON.stringify(config));

        return new Response(JSON.stringify({
          success: true,
          id,
          secretMemoryEnabled: config.secretMemoryEnabled,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /admin/toggle-premium ────────────────────────────
    // Enable / disable isPremium + secretMemoryEnabled flags (admin only)
    if (request.method === 'POST' && url.pathname === '/admin/toggle-premium') {
      const authHeader = request.headers.get('Authorization');
      const secret = env.ADMIN_SECRET;

      if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { id, enabled } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: 'ID diperlukan.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existing = await env.LETTER_DATA.get(id);
        if (!existing) {
          return new Response(JSON.stringify({ success: false, error: `Letter '${id}' tidak ditemukan.` }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const config = JSON.parse(existing);
        config.isPremium           = enabled === true;
        // When premium is enabled, secret memory is also enabled (and vice versa)
        config.secretMemoryEnabled = enabled === true;
        config.updated_at = new Date().toISOString();
        await env.LETTER_DATA.put(id, JSON.stringify(config));

        return new Response(JSON.stringify({
          success: true,
          id,
          isPremium: config.isPremium,
          secretMemoryEnabled: config.secretMemoryEnabled,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /submit-premium ─────────────────────────────────
    // Submit request order premium (+10K) → Telegram notification
    if (request.method === 'POST' && url.pathname === '/submit-premium') {
      try {
        const body = await request.json();
        const { id, studioPassword, requestDomain, ...configData } = body;

        if (!id) {
          return new Response(JSON.stringify({ error: "Missing 'id' parameter." }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID   = env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
          return new Response(JSON.stringify({ error: 'Telegram belum dikonfigurasi di server.' }), {
            status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const TG_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

        const timestamp = new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short',
        });

        // ── Pesan 1: Ringkasan Order ──
        const msg1 =
          `💌 <b>ORDER LETTER PREMIUM BARU (+10K)</b>\n\n` +
          `👤 Penerima: <b>${configData.recipientName || configData.to || '-'}</b>\n` +
          `📅 Tanggal: ${configData.date || '-'}\n` +
          `✍️ Judul: ${configData.title || '-'}\n` +
          `💝 Pengirim: ${configData.from || '-'}\n` +
          `🎨 Tema: ${configData.theme || 'blush-cream'}\n` +
          `🔑 Letter ID: <code>${id}</code>\n` +
          `🌐 Request Domain: <code>${requestDomain || '-'}</code>\n` +
          `🕐 Waktu: ${timestamp} WIB\n\n` +
          `🎵 Musik: ${configData.playlist?.length > 0 ? `${configData.playlist.length} lagu ✅` : 'Tidak ada ❌'}\n` +
          `🔒 Password: <b>${configData.login_password || '(Tanpa Password)'}</b>\n` +
          `━━━━━━━━━━━━━━━━━━\nCek pesan berikutnya untuk config.js`;

        await fetch(TG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: msg1, parse_mode: 'HTML' }),
        });

        // ── Pesan 2: config.js sebagai file ──
        const configContent = `window.STANDALONE_CONFIG = ${JSON.stringify(configData, null, 2)};`;
        const fileName = `config-${id}.js`;
        const fileCaption = `📋 config.js untuk ${id}\n🌐 Domain: ${requestDomain || '-'}.vercel.app\nSimpan sebagai config.js di root folder letter/`;

        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('caption', fileCaption);
        formData.append('document', new Blob([configContent], { type: 'text/javascript' }), fileName);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST', body: formData,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message || 'Gagal memproses order premium.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /generate-ai — Proxy ke Qwen AI ────────────────
    if (request.method === 'POST' && url.pathname === '/generate-ai') {
      try {
        const apiKey = env.QWEN_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'QWEN_API_KEY belum dikonfigurasi.' }), {
            status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = await request.json();
        const userPrompt = body.prompt;
        const requestedTone = body.tone || 'tulus';

        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'Prompt tidak boleh kosong.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let toneInstruction = '';
        switch (requestedTone) {
          case 'romantis':
            toneInstruction = 'Bergaya ROMANTIS dan manis, cocok untuk pasangan. Gunakan "aku" dan "kamu". Hangat, tulus, dan sedikit puitis.';
            break;
          case 'semangat':
            toneInstruction = 'Bergaya MOTIVASI dan menyemangati. Positif, energetik, dan penuh harapan. Cocok untuk wisuda, ujian, atau momen perjuangan.';
            break;
          case 'bersahabat':
            toneInstruction = 'Bergaya KASUAL dan bersahabat seperti sahabat lama. Santai, hangat, dan penuh ketulusan.';
            break;
          case 'tulus':
          default:
            toneInstruction = 'Bergaya FORMAL TAPI TULUS. Kata-kata dipilih dengan hati-hati, sopan namun menyentuh. Cocok untuk semua konteks.';
            break;
        }

        const systemInstruction = `Kamu adalah penulis surat digital premium untuk "Letter Edition by For You, Always."
Tugasmu: Tulis isi surat yang personal dan menyentuh dengan gaya: [${toneInstruction}]
ATURAN WAJIB:
1. Panjang isi surat: 80–120 kata (2 paragraf).
2. Tulis dalam 2 PARAGRAF dipisahkan baris kosong.
3. Jangan potong di tengah kalimat. Akhiri dengan tanda titik.
4. Tanpa format markdown. Tanpa sapaan pembuka (sudah ada di template).
5. Langsung tulis isi pesan.`;

        const qwenPayload = {
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `[KONTEKS/TEMA DARI PENGIRIM:]\\n${userPrompt.trim()}` },
          ],
          temperature: 0.85,
          top_p: 0.95,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const qwenResponse = await fetch(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(qwenPayload),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (!qwenResponse.ok) {
          const errText = await qwenResponse.text();
          return new Response(JSON.stringify({ error: `Qwen AI error (${qwenResponse.status}): ${errText.substring(0, 150)}` }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const qwenData = await qwenResponse.json();
        const generatedText = qwenData?.choices?.[0]?.message?.content || '';

        return new Response(JSON.stringify({ success: true, text: generatedText.trim() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: error.name === 'AbortError' ? 'AI terlalu lama merespons. Coba lagi.' : (error.message || 'Gagal menghubungi AI.'),
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── GET /debug ───────────────────────────────────────────
    if (url.pathname === '/debug') {
      const authHeader = request.headers.get('Authorization');
      const pwd = url.searchParams.get('pwd');
      const secret = env.ADMIN_SECRET;
      const isAuthenticated = secret && (authHeader === `Bearer ${secret}` || pwd === secret);

      if (!isAuthenticated) {
        return new Response('Not found', { status: 404, headers: corsHeaders });
      }

      const debug = {
        service: 'Letter Edition Worker',
        hasBucket: !!env.BUCKET,
        hasKV: !!env.LETTER_DATA,
        hasTelegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        hasQwen: !!env.QWEN_API_KEY,
        cdnUrl: CDN_URL,
        url: request.url,
        method: request.method,
      };
      return new Response(JSON.stringify(debug, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 404 Default ──────────────────────────────────────────
    return new Response(
      `<html><head><title>Letter Edition API</title>
      <style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:20px;line-height:1.7}
      h1{color:#a83a23}code{background:#f5f0eb;padding:2px 6px;border-radius:3px}
      .ok{background:#4caf50;color:#fff;padding:10px;border-radius:6px;text-align:center;margin-bottom:1rem}</style></head>
      <body><h1>💌 Letter Edition API</h1>
      <div class="ok">✅ API is running!</div>
      <h2>Endpoints:</h2>
      <ul>
        <li><code>GET  /get-config?id=xxx</code> — Ambil config surat</li>
        <li><code>POST /save-config?id=xxx</code> — Simpan config surat</li>
        <li><code>POST /upload</code> — Upload musik (R2)</li>
        <li><code>POST /submit-premium</code> — Order premium → Telegram</li>
        <li><code>POST /generate-ai</code> — Generate surat via AI</li>
        <li><code>GET  /admin/list-gifts</code> — List semua surat (admin)</li>
      </ul></body></html>`,
      { headers: { 'Content-Type': 'text/html', ...corsHeaders } }
    );
  },
};

export { index_default as default };
