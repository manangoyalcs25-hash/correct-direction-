// modules/analytics.js — Sales Analytics
// Opens analytics modal from features.js

function openAnalytics() {
    // Analytics modal implementation
    document.getElementById('analyticsModal')?.remove();
    
    const invoices = storage.getInvoices();
    const products = storage.getProducts();
    
    // Calculate stats
    // Revenue only counts PAID invoices (status: 'paid' or no status = legacy paid)
    const totalRevenue = invoices
        .filter(i => i.type !== 'purchase' && (i.status === 'paid' || !i.status))
        .reduce((s, i) => s + (i.total || 0), 0);
    const totalPurchases = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + (i.total || 0), 0);
    const profit = totalRevenue - totalPurchases;
    const totalItems = invoices.reduce((s, i) => s + ((i.items || i.cart || []).length), 0);
    
    const modal = document.createElement('div');
    modal.id = 'analyticsModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:600px;max-height:90vh;overflow-y:auto;">
            <button class="si-modal-close" onclick="document.getElementById('analyticsModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">📊 Sales Analytics</h2>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:6px;">TOTAL REVENUE</div>
                    <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#00ff88;">₹${totalRevenue.toLocaleString('en-IN')}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:6px;">TOTAL PURCHASES</div>
                    <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#ff6b6b;">₹${totalPurchases.toLocaleString('en-IN')}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:6px;">NET PROFIT</div>
                    <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:${profit >= 0 ? '#00ff88' : '#ff6b6b'};">₹${profit.toLocaleString('en-IN')}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:6px;">ITEMS SOLD</div>
                    <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#00d4ff;">${totalItems}</div>
                </div>
            </div>
            
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);margin-bottom:12px;">QUICK STATS</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:'Space Mono',monospace;font-size:12px;">
                    <div style="color:var(--text-muted);">Total Products:</div>
                    <div style="color:var(--text-light);text-align:right;">${products.length}</div>
                    <div style="color:var(--text-muted);">Total Invoices:</div>
                    <div style="color:var(--text-light);text-align:right;">${invoices.length}</div>
                    <div style="color:var(--text-muted);">Avg Invoice Value:</div>
                    <div style="color:var(--text-light);text-align:right;">₹${invoices.length > 0 ? Math.round(totalRevenue / invoices.filter(i => i.type !== 'purchase' && (i.status === 'paid' || !i.status)).length || 1) : 0}</div>
                </div>
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

window.openAnalytics = openAnalytics;
console.log('[ShopInventory] Analytics module loaded');
