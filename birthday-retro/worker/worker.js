/**
 * Birthday Retro — Cloudflare Worker
 * Backend API untuk template birthday card retro.
 *
 * Routes:
 *  POST   /upload                  Upload media ke R2
 *  PUT    /upload-direct/:key      Direct upload media ke R2
 *  GET    /get-config?id=xxx       Ambil config birthday dari KV
 *  POST   /save-config?id=xxx      Simpan config birthday ke KV
 *  POST   /login                   Admin auth
 *  POST   /generator-login         Generator auth
 *  POST   /generate-link           Buat link baru
 *  POST   /change-id               Ganti ID link
 *  GET    /list-configs             List semua cards (admin)
 *  GET    /admin/list-gifts         Detail list (admin)
 *  POST   /admin/delete-gifts       Batch delete (admin)
 *  GET    /debug                    Debug info
 *
 * KV: BIRTHDAY_DATA
 * R2: BUCKET
 */

const CDN_URL = 'https://birthday-assets.for-you-always.my.id';

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
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── SECURITY: Origin Validation ──
    const isAllowedOrigin = (req) => {
      const o = req.headers.get('Origin') || '';
      const allowed = [
        'https://birthday.for-you-always.my.id',
        'https://for-you-always.my.id',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:5501',
        'http://127.0.0.1:5501',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (o.endsWith('.vercel.app')) return true;
      return allowed.includes(o);
    };

    const url = new URL(request.url);

    // ══════════════════════════════════════════════════════
    //  POST /upload — Upload media (audio/image) ke R2
    // ══════════════════════════════════════════════════════
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
        if (file.size > 30 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'File terlalu besar. Maksimal 30MB.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop().toLowerCase();
        const filename = `birthday/${timestamp}-${randomStr}.${ext}`;

        await env.BUCKET.put(filename, file.stream(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream' },
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

    // ══════════════════════════════════════════════════════
    //  PUT /upload-direct/:key — Direct upload ke R2
    // ══════════════════════════════════════════════════════
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
        if (!key.startsWith('birthday/')) key = 'birthday/' + key;

        const contentLength = parseInt(request.headers.get('Content-Length') || '0');
        if (contentLength > 30 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'File terlalu besar. Maksimal 30MB.' }), {
            status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
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

    // ══════════════════════════════════════════════════════
    //  GET /get-config?id=xxx — Ambil config birthday
    // ══════════════════════════════════════════════════════
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
        const { value: data } = await env.BIRTHDAY_DATA.getWithMetadata(id);
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

    // ══════════════════════════════════════════════════════
    //  POST /save-config?id=xxx — Simpan config birthday
    // ══════════════════════════════════════════════════════
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

        // Read existing config for server-controlled flags
        const existingRaw = await env.BIRTHDAY_DATA.get(id);
        const existingConfig = existingRaw ? JSON.parse(existingRaw) : {};
        const isPremium = existingConfig.isPremium === true;

        // Preserve server-controlled flags
        body.isPremium = existingConfig.isPremium ?? false;

        if (!isPremium) {
          // Free-tier sanitization
          body.login_password = '';
          body.login_hint = '';
          if (Array.isArray(body.playlist)) {
            body.playlist = body.playlist.filter(t => t.isLibrary === true);
          }
        }

        await env.BIRTHDAY_DATA.put(id, JSON.stringify(body));

        return new Response(JSON.stringify({
          success: true,
          message: 'Birthday card saved!',
          id,
          previewUrl: `https://birthday.for-you-always.my.id/?to=${id}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ══════════════════════════════════════════════════════
    //  POST /login — Admin auth
    // ══════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════
    //  POST /generator-login — Generator auth
    // ══════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════
    //  POST /generate-link — Buat link baru
    // ══════════════════════════════════════════════════════
    if (request.method === 'POST' && url.pathname === '/generate-link') {
      try {
        const authHeader = request.headers.get('Authorization');
        const secret = env.GENERATOR_SECRET;
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const body = await request.json();
        const customId = body.id?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const studioPassword = body.studioPassword || null;
        const isPremium = body.isPremium === true;

        if (!customId || customId.length < 3) {
          return new Response(JSON.stringify({ error: 'ID minimal 3 karakter' }), { status: 400, headers: corsHeaders });
        }

        const existing = await env.BIRTHDAY_DATA.get(customId);
        if (existing) {
          return new Response(JSON.stringify({ error: `ID '${customId}' sudah digunakan.` }), { status: 409, headers: corsHeaders });
        }

        const initialConfig = {
          id: customId,
          studioPassword: studioPassword,
          isPremium: isPremium,
          recipientName: '',
          age: '',
          stage1_heading: '',
          stage2_question: 'i have a surprise for\nyou, wanna see it?',
          stage4_reveal_text: "it's a birthday surprise!! :D",
          stage5_wishes: '',
          playlist: [],
          status: 'draft',
          is_active: true,
          created_at: new Date().toISOString(),
        };

        await env.BIRTHDAY_DATA.put(customId, JSON.stringify(initialConfig));

        const domainUrl = 'https://birthday.for-you-always.my.id';
        return new Response(JSON.stringify({
          success: true,
          id: customId,
          studioUrl: `${domainUrl}/studio/${customId}`,
          giftUrl: `${domainUrl}/?to=${customId}`,
          message: 'Link berhasil dibuat',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ══════════════════════════════════════════════════════
    //  POST /change-id — Ganti ID link
    // ══════════════════════════════════════════════════════
    if (request.method === 'POST' && url.pathname === '/change-id') {
      try {
        const authHeader = request.headers.get('Authorization');
        const secret = env.GENERATOR_SECRET;
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }
        const body = await request.json();
        const oldId = body.oldId?.trim().toLowerCase();
        const newId = body.newId?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (!oldId || !newId) {
          return new Response(JSON.stringify({ error: 'Isi kedua ID!' }), { status: 400, headers: corsHeaders });
        }
        const existingOld = await env.BIRTHDAY_DATA.get(oldId);
        if (!existingOld) {
          return new Response(JSON.stringify({ error: `ID '${oldId}' tidak ditemukan.` }), { status: 404, headers: corsHeaders });
        }
        const existingNew = await env.BIRTHDAY_DATA.get(newId);
        if (existingNew) {
          return new Response(JSON.stringify({ error: `ID '${newId}' sudah digunakan.` }), { status: 409, headers: corsHeaders });
        }
        const data = JSON.parse(existingOld);
        data.id = newId;
        data.updated_at = new Date().toISOString();
        await env.BIRTHDAY_DATA.put(newId, JSON.stringify(data));
        await env.BIRTHDAY_DATA.delete(oldId);

        const domainUrl = 'https://birthday.for-you-always.my.id';
        return new Response(JSON.stringify({
          success: true, id: newId,
          studioUrl: `${domainUrl}/studio/${newId}`,
          giftUrl: `${domainUrl}/?to=${newId}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ══════════════════════════════════════════════════════
    //  GET /list-configs — List all IDs (admin)
    // ══════════════════════════════════════════════════════
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
        const list = await env.BIRTHDAY_DATA.list();
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

    // ══════════════════════════════════════════════════════
    //  GET /admin/list-gifts — Detail list (admin)
    // ══════════════════════════════════════════════════════
    if (request.method === 'GET' && url.pathname === '/admin/list-gifts') {
      const authHeader = request.headers.get('Authorization');
      const secret = env.ADMIN_SECRET;
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ success: false, error: 'Akses ditolak.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const list = await env.BIRTHDAY_DATA.list();
        const detailPromises = list.keys.map(async (keyObj) => {
          try {
            const { value: data } = await env.BIRTHDAY_DATA.getWithMetadata(keyObj.name);
            if (data) {
              const config = JSON.parse(data);
              return {
                id: keyObj.name,
                recipientName: config.recipientName || 'Unknown',
                age: config.age || '',
                status: config.status || 'unknown',
                isPremium: config.isPremium || false,
                playlist: config.playlist || [],
                created_at: config.created_at || null,
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

    // ══════════════════════════════════════════════════════
    //  POST /admin/delete-gifts — Batch delete (admin)
    // ══════════════════════════════════════════════════════
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
        await Promise.all(ids.map(id => env.BIRTHDAY_DATA.delete(id)));
        return new Response(JSON.stringify({ success: true, message: `${ids.length} card berhasil dihapus.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ══════════════════════════════════════════════════════
    //  GET /debug — Debug info
    // ══════════════════════════════════════════════════════
    if (request.method === 'GET' && url.pathname === '/debug') {
      const debug = {
        service: 'Birthday Retro API',
        status: 'running',
        kvBound: !!env.BIRTHDAY_DATA,
        r2Bound: !!env.BUCKET,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(debug, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ══════════════════════════════════════════════════════
    //  404 Default
    // ══════════════════════════════════════════════════════
    return new Response(
      `<html><head><title>Birthday Retro API</title>
      <style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:20px;line-height:1.7}
      h1{color:#9b1dea}code{background:#f5f0eb;padding:2px 6px;border-radius:3px}
      .ok{background:#4caf50;color:#fff;padding:10px;border-radius:6px;text-align:center;margin-bottom:1rem}</style></head>
      <body><h1>🎂 Birthday Retro API</h1>
      <div class="ok">✅ API is running!</div>
      <h2>Endpoints:</h2>
      <ul>
        <li><code>GET  /get-config?id=xxx</code> — Ambil config card</li>
        <li><code>POST /save-config?id=xxx</code> — Simpan config card</li>
        <li><code>POST /upload</code> — Upload media (R2)</li>
        <li><code>POST /generate-link</code> — Buat link baru</li>
        <li><code>GET  /admin/list-gifts</code> — List semua card (admin)</li>
      </ul></body></html>`,
      { headers: { 'Content-Type': 'text/html', ...corsHeaders } }
    );
  },
};

export { index_default as default };
