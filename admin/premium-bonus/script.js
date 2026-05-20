/**
 * admin/premium-bonus/script.js
 * Letter Edition Insights Dashboard JS for Premium Bonus
 */

const API_BASE_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    const btnRefresh = document.getElementById('btn-refresh');
    const adminSecretInput = document.getElementById('admin-secret');
    const tableBody = document.getElementById('gift-table-body');

    let allGiftsRaw = [];

    // Recover secret
    if (localStorage.getItem('letter_admin_secret') && adminSecretInput) {
        adminSecretInput.value = localStorage.getItem('letter_admin_secret');
    }

    const fetchGifts = async () => {
        const secret = adminSecretInput ? adminSecretInput.value.trim() : '';
        if (!secret) return alert('Access Key diperlukan.');

        localStorage.setItem('letter_admin_secret', secret);

        btnRefresh.innerText = 'MEMUAT...';
        btnRefresh.disabled = true;

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
                processAndRender(data.gifts);
            } else {
                alert('Akses Ditolak: ' + (data.error || 'Autentikasi gagal.'));
                tableBody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-red-400 text-xs font-bold uppercase tracking-widest">ACCESS DENIED: ${data.error}</td></tr>`;
            }
        } catch (err) {
            console.error('[Admin] Fetch detail:', err);
            alert('Gangguan koneksi antar dimensi. Silakan coba lagi.');
        } finally {
            btnRefresh.innerText = 'SYNCHRONIZE';
            btnRefresh.disabled = false;
        }
    };

    const processAndRender = (gifts) => {
        // Find all letters that are bonuses
        const bonusLetters = gifts.filter(g => g.isBonus === true || g.parentId);
        
        // Find all premium letters that have created a bonus
        const premiumWithBonus = gifts.filter(g => g.bonusCreatedId);

        // We can display based on premiumWithBonus to show the mapping
        const mappedData = premiumWithBonus.map(premium => {
            const bonusId = premium.bonusCreatedId;
            const bonusData = bonusLetters.find(b => b.id === bonusId) || {};
            
            return {
                premiumId: premium.id,
                premiumRecipient: premium.recipientName || premium.to || '<i>(No Name)</i>',
                bonusId: bonusId,
                bonusRecipient: bonusData.recipientName || bonusData.to || '<i>(No Name)</i>',
                claimedAt: bonusData.publishedAt || bonusData.createdAt || null,
                bonusStatus: bonusData.id ? (bonusData.lastOpened ? 'Dibuka' : 'Belum Dibuka') : 'Draft / Belum Dipublish'
            };
        });

        renderSummary(mappedData);
        renderTable(mappedData);
    };

    const renderSummary = (mappedData) => {
        const summarySection = document.getElementById('summary-section');
        if (!mappedData || mappedData.length === 0) {
            summarySection.classList.add('hidden');
            return;
        }
        summarySection.classList.remove('hidden');

        // Total
        document.getElementById('stat-total').innerText = mappedData.length;

        // Today
        const now = new Date();
        const firstTimeToday = now.setHours(0,0,0,0);
        const newToday = mappedData.filter(g => g.claimedAt && new Date(g.claimedAt).getTime() > firstTimeToday).length;
        document.getElementById('stat-today').innerText = newToday;
    };

    const renderTable = (mappedData) => {
        if (!mappedData || mappedData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-slate-600 text-[11px] italic">Tidak ada pengguna premium yang mengklaim bonus.</td></tr>`;
            return;
        }

        // Sort descending by claim date (if available)
        mappedData.sort((a, b) => new Date(b.claimedAt || 0) - new Date(a.claimedAt || 0));

        tableBody.innerHTML = mappedData.map(data => {
            const timeStr = data.claimedAt ? new Date(data.claimedAt).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '<span class="opacity-30 italic">Belum Dipublish</span>';

            const premiumUrl = `${window.location.origin}/index.html?to=${data.premiumId}`;
            const bonusUrl = data.bonusId ? `${window.location.origin}/index.html?to=${data.bonusId}` : '#';
            
            const premiumEditor = `../../studio/index.html?token=${data.premiumId}`;
            const bonusEditor = data.bonusId ? `../../studio/index.html?token=${data.bonusId}` : '#';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-mono font-bold text-slate-100 tracking-tight">${data.premiumId}</span>
                            <a href="${premiumUrl}" target="_blank" class="text-[9px] text-[#d4a373] font-bold uppercase tracking-widest hover:underline w-max">Tinjau ↗</a>
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-mono font-bold text-amber-400 tracking-tight">${data.bonusId || '-'}</span>
                            ${data.bonusId ? `<a href="${bonusUrl}" target="_blank" class="text-[9px] text-amber-500 font-bold uppercase tracking-widest hover:underline w-max">Tinjau ↗</a>` : ''}
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-xs font-bold text-slate-300">${data.premiumRecipient}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-xs font-bold text-amber-400">${data.bonusRecipient}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-[10px] uppercase tracking-widest font-bold ${data.bonusStatus === 'Dibuka' ? 'text-emerald-400' : 'text-slate-400'}">${data.bonusStatus}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-2">
                            <a href="${premiumEditor}" target="_blank" class="bg-slate-800/50 text-slate-300 border border-white/10 text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all text-center">Edit Utama</a>
                            ${data.bonusId ? `<a href="${bonusEditor}" target="_blank" class="bg-amber-900/30 text-amber-400 border border-amber-500/30 text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg hover:bg-amber-900/50 transition-all text-center">Edit Bonus</a>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // ── Bindings ──
    btnRefresh.addEventListener('click', fetchGifts);

    if (adminSecretInput) {
        adminSecretInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchGifts(); });
    }
});
