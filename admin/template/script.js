/**
 * admin/template/script.js
 * Template Analytics Dashboard JS
 */

const API_BASE_URL = 'https://letter-edition.aldoramadhan16.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    const btnRefresh = document.getElementById('btn-refresh');
    const adminSecretInput = document.getElementById('admin-secret');
    const tableBody = document.getElementById('template-table-body');
    const summarySection = document.getElementById('summary-section');

    let allGifts = [];

    // Recover secret from localStorage
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
                mode: 'cors',
                headers: { 
                    'Authorization': `Bearer ${secret}`,
                    'Cache-Control': 'no-cache'
                }
            });

            const data = await response.json();

            if (data.success) {
                allGifts = data.gifts;
                
                // Sort descending by date
                allGifts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

                renderSummary(allGifts);
                renderTable(allGifts);
            } else {
                alert('Akses Ditolak: ' + (data.error || 'Autentikasi gagal.'));
                tableBody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-red-400 text-xs font-bold uppercase tracking-widest">ACCESS DENIED: ${data.error}</td></tr>`;
                summarySection.classList.add('hidden');
            }
        } catch (err) {
            console.error('[Admin] Fetch detail:', err);
            alert('Gangguan koneksi antar dimensi. Silakan coba lagi.');
        } finally {
            btnRefresh.innerText = 'SYNCHRONIZE';
            btnRefresh.disabled = false;
        }
    };

    let currentFilter = 'all';

    window.filterTable = (type) => {
        currentFilter = type;
        renderTable(allGifts);
    };

    const renderSummary = (gifts) => {
        if (!gifts || gifts.length === 0) {
            summarySection.classList.add('hidden');
            return;
        }
        summarySection.classList.remove('hidden');

        const total = gifts.length;
        
        // Count templates
        let airmailCount = 0;
        let ribbonCount = 0;
        let classicCount = 0;

        gifts.forEach(g => {
            if (g.templateType === 'airmail') {
                airmailCount++;
            } else if (g.templateType === 'ribbon') {
                ribbonCount++;
            } else {
                classicCount++;
            }
        });

        const pctAirmail = total > 0 ? Math.round((airmailCount / total) * 100) : 0;
        const pctRibbon = total > 0 ? Math.round((ribbonCount / total) * 100) : 0;
        const pctClassic = total > 0 ? Math.round((classicCount / total) * 100) : 0;

        document.getElementById('stat-total').innerText = total;
        
        document.getElementById('stat-classic').innerText = classicCount;
        document.getElementById('pct-classic').innerText = `${pctClassic}% dari total`;

        document.getElementById('stat-airmail').innerText = airmailCount;
        document.getElementById('pct-airmail').innerText = `${pctAirmail}% dari total`;

        const statRibbon = document.getElementById('stat-ribbon');
        if (statRibbon) {
            statRibbon.innerText = ribbonCount;
            document.getElementById('pct-ribbon').innerText = `${pctRibbon}% dari total`;
        }
    };

    const renderTable = (gifts) => {
        if (!gifts || gifts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-600 text-[11px] italic">No letters found.</td></tr>`;
            return;
        }

        let filteredGifts = gifts;
        if (currentFilter !== 'all') {
            filteredGifts = gifts.filter(g => {
                if (currentFilter === 'classic') return !g.templateType || g.templateType === 'classic';
                return g.templateType === currentFilter;
            });
        }

        if (filteredGifts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-600 text-[11px] italic">Tidak ada user yang memakai template ini.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filteredGifts.map(gift => {
            const timeStr = gift.publishedAt ? new Date(gift.publishedAt).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';

            const isAirmail = gift.templateType === 'airmail';
            const isRibbon = gift.templateType === 'ribbon';
            let theme = gift.theme || 'blush-cream';
            if (isAirmail) theme = gift.airmailTheme || 'airmail-parchment';
            if (isRibbon) theme = gift.ribbonTheme || 'ribbon-crimson';
            theme = String(theme).toLowerCase();
            
            let badgeClass = 'badge-blush';
            let themeName = 'Blush';

            if (theme.includes('sage') || theme.includes('forest')) { badgeClass = 'badge-sage'; themeName = theme.includes('forest') ? 'Forest' : 'Sage'; }
            else if (theme.includes('rose')) { badgeClass = 'badge-rose'; themeName = 'Rose'; }
            else if (theme.includes('midnight')) { badgeClass = 'badge-midnight'; themeName = 'Midnight'; }
            else if (theme.includes('crimson')) { badgeClass = 'badge-crimson'; themeName = 'Crimson'; }
            else if (theme.includes('obsidian')) { badgeClass = 'badge-obsidian'; themeName = 'Obsidian'; }
            else if (theme.includes('lilac') || theme.includes('violet')) { badgeClass = 'badge-lilac'; themeName = theme.includes('violet') ? 'Violet' : 'Lilac'; }
            else if (theme.includes('parchment')) { badgeClass = 'badge-parchment'; themeName = 'Parchment'; }
            else if (theme.includes('bordeaux')) { badgeClass = 'badge-bordeaux'; themeName = 'Bordeaux'; }

            let templateType = 'Classic Letter';
            let templateBadgeClass = 'bg-[#d4a373]/20 text-[#d4a373] border border-[#d4a373]/30';
            
            if (isAirmail) {
                templateType = 'Vintage Airmail';
                templateBadgeClass = 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
            } else if (isRibbon) {
                templateType = 'Ribbon & Seal';
                templateBadgeClass = 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30';
            }

            const giftUrl = `${window.location.origin}/index.html?to=${gift.id}`;
            const editorUrl = `../../studio/index.html?token=${gift.id}`;

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-5 border-b border-white/5">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-mono font-bold text-slate-100 tracking-tight">${gift.id}</span>
                        </div>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-xs font-bold text-slate-300">${gift.recipientName || gift.to || '<i>(No Name)</i>'}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg ${templateBadgeClass}">
                            ${templateType}
                        </span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="badge-tag ${badgeClass}">${themeName}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
                    </td>
                    <td class="p-5 border-b border-white/5">
                        <div class="flex items-center gap-3">
                            <a href="${giftUrl}" target="_blank" class="text-[9px] text-slate-400 font-bold uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                                <span>Tinjau</span> <span class="text-xs">↗</span>
                            </a>
                            <span class="text-white/10">|</span>
                            <a href="${editorUrl}" target="_blank" class="text-[9px] text-[#d4a373] font-bold uppercase tracking-widest hover:text-[#e5bc94] transition-colors flex items-center gap-1">
                                <span>Bongkar</span> <span class="text-xs">↗</span>
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // ── Bindings ──
    if (btnRefresh) btnRefresh.addEventListener('click', fetchGifts);

    if (adminSecretInput) {
        adminSecretInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchGifts(); });
    }
});
