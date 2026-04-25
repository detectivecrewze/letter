/**
 * admin/script.js
 * Letter Edition Insights Dashboard JS
 */

const API_BASE_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    const btnRefresh = document.getElementById('btn-refresh');
    const adminSecretInput = document.getElementById('admin-secret');
    const tableBody = document.getElementById('gift-table-body');

    // Bulk elements
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');
    const btnBulkDelete = document.getElementById('btn-bulk-delete');
    const selectAllCheckbox = document.getElementById('select-all');

    // Filters
    const searchInput = document.getElementById('search-input');
    const filterTheme = document.getElementById('filter-theme');
    const filterStatus = document.getElementById('filter-status');

    let allGiftsRaw = [];
    let allGifts = [];
    let selectedIds = new Set();

    // Recover secret
    if (localStorage.getItem('letter_admin_secret') && adminSecretInput) {
        adminSecretInput.value = localStorage.getItem('letter_admin_secret');
    }

    const updateBulkActionsUI = () => {
        if (selectedIds.size > 0) {
            bulkActions.classList.remove('hidden');
            selectedCount.innerText = `${selectedIds.size} Item Terpilih`;
        } else {
            bulkActions.classList.add('hidden');
        }

        if (allGifts.length > 0) {
            selectAllCheckbox.checked = selectedIds.size === allGifts.length;
        } else {
            selectAllCheckbox.checked = false;
        }
    };

    const fetchGifts = async () => {
        const secret = adminSecretInput ? adminSecretInput.value.trim() : '';
        if (!secret) return alert('Access Key diperlukan.');

        localStorage.setItem('letter_admin_secret', secret);

        btnRefresh.innerText = 'MEMUAT...';
        btnRefresh.disabled = true;
        selectedIds.clear();
        updateBulkActionsUI();

        try {
            const response = await fetch(`${API_BASE_URL}/admin/list-gifts`, {
                method: 'GET',
                mode:   'cors',
                headers: { 
                    'Authorization': `Bearer ${secret}`,
                    'Cache-Control': 'no-cache'
                }
            });

            const data = await response.json();

            if (data.success) {
                allGiftsRaw = data.gifts;
                renderSummary(data.gifts);
                applyFilters();
            } else {
                alert('Akses Ditolak: ' + (data.error || 'Autentikasi gagal.'));
                tableBody.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-red-400 text-xs font-bold uppercase tracking-widest">ACCESS DENIED: ${data.error}</td></tr>`;
            }
        } catch (err) {
            console.error('[Admin] Fetch detail:', err);
            alert('Gangguan koneksi antar dimensi. Silakan coba lagi.');
        } finally {
            btnRefresh.innerText = 'SYNCHRONIZE';
            btnRefresh.disabled = false;
        }
    };

    const renderSummary = (gifts) => {
        const summarySection = document.getElementById('summary-section');
        if (!gifts || gifts.length === 0) {
            summarySection.classList.add('hidden');
            return;
        }
        summarySection.classList.remove('hidden');

        // Total
        document.getElementById('stat-total').innerText = gifts.length;

        // Today
        const now = new Date();
        const firstTimeToday = now.setHours(0,0,0,0);
        const newToday = gifts.filter(g => new Date(g.updatedAt || g.publishedAt).getTime() > firstTimeToday).length;
        document.getElementById('stat-today').innerText = newToday;

        // Top Theme
        const themeCounts = {};
        gifts.forEach(g => {
            const t = String(g.theme || 'blush-cream').toLowerCase();
            themeCounts[t] = (themeCounts[t] || 0) + 1;
        });
        const topThemeRaw = Object.keys(themeCounts).reduce((a, b) => themeCounts[a] > themeCounts[b] ? a : b, 'blush-cream');
        const themeNames = {
            'sage-green': 'Sage', 
            'rose-petal': 'Rose', 
            'blush-cream': 'Blush', 
            'midnight-blue': 'Midnight'
        };
        document.getElementById('stat-theme').innerText = (themeNames[topThemeRaw] || topThemeRaw.split('-')[0]).toUpperCase();

        // Top Audio
        const audioCounts = {};
        gifts.forEach(g => {
            const p = g.playlist && g.playlist[0] ? g.playlist[0].title : 'None';
            audioCounts[p] = (audioCounts[p] || 0) + 1;
        });
        let topAudio = Object.keys(audioCounts).reduce((a, b) => audioCounts[a] > audioCounts[b] ? a : b, 'None');
        document.getElementById('stat-audio').innerText = topAudio.toUpperCase();
    };

    const renderTable = (gifts) => {
        allGifts = gifts;
        if (!gifts || gifts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-600 text-[11px] italic">No letters found matching filters.</td></tr>`;
            return;
        }

        // Sort descending by date
        gifts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

        tableBody.innerHTML = gifts.map(gift => {
            const isSelected = selectedIds.has(gift.id);
            const timeStr = gift.publishedAt ? new Date(gift.publishedAt).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';

            const lastOpenedStr = gift.lastOpened ? new Date(gift.lastOpened).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '<span class="opacity-30 italic">Not opened yet</span>';

            const isStale = gift.lastOpened && (new Date() - new Date(gift.lastOpened)) > (30 * 24 * 60 * 60 * 1000);

            const theme = String(gift.theme || 'blush-cream').toLowerCase();
            let badgeClass = 'badge-blush';
            let themeName = 'Blush';

            if (theme.includes('sage')) { badgeClass = 'badge-sage'; themeName = 'Sage'; }
            else if (theme.includes('rose')) { badgeClass = 'badge-rose'; themeName = 'Rose'; }
            else if (theme.includes('midnight')) { badgeClass = 'badge-midnight'; themeName = 'Midnight'; }

            const giftUrl = `${window.location.origin}/index.html?to=${gift.id}`;
            const editorUrl = `../studio/index.html?token=${gift.id}`;

            // Music Info
            const songName = gift.playlist && gift.playlist[0] ? gift.playlist[0].title : 'Hening';
            const isCustom = gift.playlist && gift.playlist[0] && !gift.playlist[0].isLibrary;

            const isMemoryEnabled = gift.secretMemoryEnabled === true;
            const memoryBtnClass = isMemoryEnabled
                ? 'bg-[#d4a373] text-white border-[#d4a373]'
                : 'bg-slate-800/40 text-slate-500 border-white/10';
            const memoryLabel = isMemoryEnabled ? '✓ Aktif' : '✗ Terkunci';

            const isPremiumEnabled = gift.isPremium === true;
            const premiumBtnClass = isPremiumEnabled
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-slate-800/40 text-slate-500 border-white/10';
            const premiumLabel = isPremiumEnabled ? '⭐ Premium' : '○ Free';

            return `
                <tr class="${isSelected ? 'bg-white/5' : ''}">
                    <td class="p-5 border-b border-white/5 text-center">
                        <input type="checkbox" data-id="${gift.id}" ${isSelected ? 'checked' : ''} class="custom-checkbox row-checkbox">
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-mono font-bold text-slate-100 tracking-tight">${gift.id}</span>
                            <a href="${giftUrl}" target="_blank" class="text-[9px] text-[#d4a373] font-bold uppercase tracking-widest hover:underline w-max">Tinjau ↗</a>
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-xs font-bold text-slate-300">${gift.recipientName || gift.to || '<i>(No Name)</i>'}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1.5 items-start">
                            <span class="badge-tag ${badgeClass}">${themeName}</span>
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${songName}</span>
                            ${isCustom ? '<span class="text-[8px] text-[#d4a373]/50 uppercase font-bold">Custom MP3</span>' : ''}
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-0.5">
                            <span class="text-[10px] ${isStale ? 'text-red-400' : 'text-slate-400'} font-mono">${lastOpenedStr}</span>
                            ${isStale ? '<span class="text-[7.5px] uppercase tracking-[0.1em] text-red-500 font-bold">Dormant</span>' : ''}
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5 text-center">
                        <button
                            class="memory-toggle-btn text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg border transition-all ${memoryBtnClass}"
                            data-id="${gift.id}"
                            data-enabled="${isMemoryEnabled ? 'true' : 'false'}"
                        >${memoryLabel}</button>
                    </td>
                    <td class="p-5 border-b border-white/5 text-center">
                        <button
                            class="premium-toggle-btn text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg border transition-all ${premiumBtnClass}"
                            data-id="${gift.id}"
                            data-enabled="${isPremiumEnabled ? 'true' : 'false'}"
                        >${premiumLabel}</button>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <a href="${editorUrl}" target="_blank" class="bg-white/5 text-slate-300 border border-white/10 text-[9px] uppercase tracking-widest font-bold px-4 py-2 rounded-lg hover:bg-[#d4a373] hover:text-white transition-all whitespace-nowrap inline-block">Bongkar</a>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const toggleMemory = async (id, currentEnabled) => {
        const newEnabled = !currentEnabled;
        const secret = adminSecretInput ? adminSecretInput.value.trim() : '';
        if (!secret) return alert('Access Key diperlukan.');

        try {
            const res = await fetch(`${API_BASE_URL}/admin/toggle-memory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${secret}`
                },
                body: JSON.stringify({ id, enabled: newEnabled })
            });
            const data = await res.json();
            if (data.success) {
                const gift = allGiftsRaw.find(g => g.id === id);
                if (gift) gift.secretMemoryEnabled = newEnabled;
                applyFilters();
            } else {
                alert('Gagal: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Gagal terhubung ke server.');
        }
    };

    const togglePremium = async (id, currentEnabled) => {
        const newEnabled = !currentEnabled;
        const secret = adminSecretInput ? adminSecretInput.value.trim() : '';
        if (!secret) return alert('Access Key diperlukan.');

        try {
            const res = await fetch(`${API_BASE_URL}/admin/toggle-premium`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${secret}`
                },
                body: JSON.stringify({ id, enabled: newEnabled })
            });
            const data = await res.json();
            if (data.success) {
                // Update both flags locally since toggle-premium sets both
                const gift = allGiftsRaw.find(g => g.id === id);
                if (gift) {
                    gift.isPremium = newEnabled;
                    gift.secretMemoryEnabled = newEnabled;
                }
                applyFilters();
            } else {
                alert('Gagal: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Gagal terhubung ke server.');
        }
    };

    const applyFilters = () => {
        const query = searchInput.value.toLowerCase().trim();
        const themeFilter = filterTheme.value;
        const statusFilter = filterStatus.value;

        const filtered = allGiftsRaw.filter(g => {
            const matchesSearch = g.id.toLowerCase().includes(query) || (g.recipientName || g.to || '').toLowerCase().includes(query);

            let matchesTheme = true;
            if (themeFilter !== 'all') {
                const t = String(g.theme || 'blush-cream').toLowerCase();
                matchesTheme = t.includes(themeFilter);
            }

            let matchesStatus = true;
            if (statusFilter !== 'all') {
                const now = new Date();
                const lo = g.lastOpened ? new Date(g.lastOpened) : null;
                const days = lo ? (now - lo) / (1000 * 60 * 60 * 24) : null;
                if (statusFilter === 'active') matchesStatus = (lo && days <= 30);
                else if (statusFilter === 'stale') matchesStatus = (lo && days > 30);
                else if (statusFilter === 'never') matchesStatus = !lo;
            }

            return matchesSearch && matchesTheme && matchesStatus;
        });

        renderTable(filtered);
    };

    // ── Bindings ──
    btnRefresh.addEventListener('click', fetchGifts);

    if (adminSecretInput) {
        adminSecretInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchGifts(); });
    }

    searchInput.addEventListener('input', applyFilters);
    filterTheme.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);

    selectAllCheckbox.addEventListener('change', e => {
        if (e.target.checked) allGifts.forEach(g => selectedIds.add(g.id));
        else selectedIds.clear();
        renderTable(allGifts);
        updateBulkActionsUI();
    });

    tableBody.addEventListener('change', e => {
        if (e.target.classList.contains('row-checkbox')) {
            const id = e.target.dataset.id;
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            renderTable(allGifts);
            updateBulkActionsUI();
        }
    });

    tableBody.addEventListener('click', e => {
        const memBtn = e.target.closest('.memory-toggle-btn');
        if (memBtn) {
            const id = memBtn.dataset.id;
            const currentEnabled = memBtn.dataset.enabled === 'true';
            memBtn.textContent = 'Memproses...';
            memBtn.disabled = true;
            toggleMemory(id, currentEnabled);
        }

        const premBtn = e.target.closest('.premium-toggle-btn');
        if (premBtn) {
            const id = premBtn.dataset.id;
            const currentEnabled = premBtn.dataset.enabled === 'true';
            premBtn.textContent = 'Memproses...';
            premBtn.disabled = true;
            togglePremium(id, currentEnabled);
        }
    });

    btnBulkDelete.addEventListener('click', async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        if (!confirm(`⚠️ WARNING!\nAnda akan menghapus ${ids.length} data surat secara permanen.\nTindakan ini tidak bisa dibatalkan. Lanjutkan?`)) return;

        const secret = adminSecretInput.value.trim();
        btnBulkDelete.innerText = 'MENGHAPUS...';
        btnBulkDelete.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/admin/delete-gifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
                body: JSON.stringify({ ids })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Surat berhasil dihapus.`);
                fetchGifts();
            } else {
                alert(`Gagal menghapus: ${data.error}`);
            }
        } catch (e) {
            alert('Gangguan saat menghapus data.');
        } finally {
            btnBulkDelete.innerText = 'Hapus Terpilih';
            btnBulkDelete.disabled = false;
        }
    });

});
