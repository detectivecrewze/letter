/**
 * Birthday Retro Admin — script.js
 * Handles: login, cards list, generator, change-id
 */

'use strict';

const WORKER_URL = 'https://birthday-retro.aldoramadhan16.workers.dev';
let adminSecret = '';
let generatorSecret = '';

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initTabs();
  initGenerator();
  initCardActions();
});

/* ═══════════════════════════════════════════════
   ADMIN LOGIN
═══════════════════════════════════════════════ */
function initLogin() {
  const btn = document.getElementById('btn-login');
  const input = document.getElementById('admin-pass');
  const error = document.getElementById('login-error');

  async function tryLogin() {
    const pw = input.value.trim();
    if (!pw) return;
    error.classList.add('hidden');
    try {
      const res = await fetch(`${WORKER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        adminSecret = pw;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadCards();
      } else {
        error.classList.remove('hidden');
      }
    } catch (e) {
      error.textContent = 'Connection error.';
      error.classList.remove('hidden');
    }
  }

  btn?.addEventListener('click', tryLogin);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
}

/* ═══════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════
   CARDS LIST
═══════════════════════════════════════════════ */
async function loadCards() {
  const tbody = document.getElementById('cards-tbody');
  const status = document.getElementById('status-text');
  const count = document.getElementById('gift-count');

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Loading...</td></tr>';
  status.textContent = 'Loading cards...';

  try {
    const res = await fetch(`${WORKER_URL}/admin/list-gifts`, {
      headers: { 'Authorization': `Bearer ${adminSecret}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const gifts = data.gifts || [];
    count.textContent = `${gifts.length} cards`;
    status.textContent = `${gifts.length} card(s) loaded.`;

    if (gifts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No cards yet.</td></tr>';
      return;
    }

    tbody.innerHTML = gifts.map(g => `
      <tr>
        <td><input type="checkbox" class="card-check" value="${g.id}"></td>
        <td><a href="../studio/?to=${g.id}" target="_blank">${g.id}</a></td>
        <td>${g.recipientName || '—'}</td>
        <td>${g.age || '—'}</td>
        <td>${g.status || 'draft'}</td>
        <td>${g.isPremium ? '✨ Yes' : 'No'}</td>
        <td>
          <a href="../index.html?to=${g.id}" target="_blank">👁 View</a> |
          <a href="../studio/?to=${g.id}" target="_blank">✏️ Edit</a>
        </td>
      </tr>
    `).join('');

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red;padding:20px;">Error: ${e.message}</td></tr>`;
    status.textContent = 'Error loading cards.';
  }
}

function initCardActions() {
  // Check all
  document.getElementById('check-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.card-check').forEach(cb => cb.checked = e.target.checked);
  });

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', loadCards);

  // Delete selected
  document.getElementById('btn-delete-selected')?.addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.card-check:checked')].map(cb => cb.value);
    if (checked.length === 0) return alert('Select at least one card.');
    if (!confirm(`Delete ${checked.length} card(s)?`)) return;

    try {
      const res = await fetch(`${WORKER_URL}/admin/delete-gifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminSecret}` },
        body: JSON.stringify({ ids: checked }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadCards();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });
}

/* ═══════════════════════════════════════════════
   GENERATOR
═══════════════════════════════════════════════ */
function initGenerator() {
  // Generator login
  document.getElementById('btn-gen-login')?.addEventListener('click', async () => {
    const pw = document.getElementById('gen-password').value.trim();
    if (!pw) return;
    const error = document.getElementById('gen-login-error');
    error.classList.add('hidden');
    try {
      const res = await fetch(`${WORKER_URL}/generator-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        generatorSecret = pw;
        document.getElementById('gen-login-section').classList.add('hidden');
        document.getElementById('gen-form-section').classList.remove('hidden');
        document.getElementById('gen-change-section').classList.remove('hidden');
      } else {
        error.classList.remove('hidden');
      }
    } catch (e) {
      error.textContent = 'Connection error.';
      error.classList.remove('hidden');
    }
  });

  // Generate link
  document.getElementById('btn-generate')?.addEventListener('click', async () => {
    const id = document.getElementById('gen-id').value.trim();
    const studioPass = document.getElementById('gen-studio-pass').value.trim();
    const isPremium = document.getElementById('gen-premium').checked;
    const error = document.getElementById('gen-error');
    const result = document.getElementById('gen-result');
    error.classList.add('hidden');
    result.classList.add('hidden');

    if (!id || id.length < 3) { error.textContent = 'ID minimal 3 karakter.'; error.classList.remove('hidden'); return; }

    try {
      const res = await fetch(`${WORKER_URL}/generate-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${generatorSecret}` },
        body: JSON.stringify({ id, studioPassword: studioPass || null, isPremium }),
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('gen-studio-url').href = data.studioUrl;
        document.getElementById('gen-studio-url').textContent = data.studioUrl;
        document.getElementById('gen-gift-url').href = data.giftUrl;
        document.getElementById('gen-gift-url').textContent = data.giftUrl;
        result.classList.remove('hidden');
        loadCards(); // refresh
      } else {
        error.textContent = data.error;
        error.classList.remove('hidden');
      }
    } catch (e) {
      error.textContent = 'Error: ' + e.message;
      error.classList.remove('hidden');
    }
  });

  // Change ID
  document.getElementById('btn-change-id')?.addEventListener('click', async () => {
    const oldId = document.getElementById('change-old-id').value.trim();
    const newId = document.getElementById('change-new-id').value.trim();
    const result = document.getElementById('change-result');
    result.classList.add('hidden');

    if (!oldId || !newId) { result.textContent = 'Fill both IDs.'; result.style.color = 'red'; result.classList.remove('hidden'); return; }

    try {
      const res = await fetch(`${WORKER_URL}/change-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${generatorSecret}` },
        body: JSON.stringify({ oldId, newId }),
      });
      const data = await res.json();
      if (data.success) {
        result.textContent = `✅ Changed: ${oldId} → ${newId}`;
        result.style.color = 'green';
        loadCards();
      } else {
        result.textContent = data.error;
        result.style.color = 'red';
      }
      result.classList.remove('hidden');
    } catch (e) {
      result.textContent = 'Error: ' + e.message;
      result.style.color = 'red';
      result.classList.remove('hidden');
    }
  });
}
