// ============================================
// js/features.js — New competitive features
// v5.0 — Beats Vyapar & myBillBook
//
// 1. WhatsApp Invoice (complete)
// 2. Customer Ledger + Credit Tracking
// 3. Sales Analytics Dashboard
// 4. Cloud Backup (JSON export/import)
// 5. Size Variants (S/M/L/XL + custom)
// 6. Smart Low Stock Alerts (push-style)
// ============================================


// ══════════════════════════════════════════
// 1. WHATSAPP INVOICE — Complete
// ══════════════════════════════════════════

function sendWhatsAppInvoice(invoiceId) {
    if (!invoiceId) {
        window.app && window.app.showNotification('No invoice selected', 'warning');
        return;
    }

    const invoices = storage.getInvoices();
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) {
        window.app && window.app.showNotification('Invoice not found — try refreshing', 'error');
        return;
    }

    const storeName    = localStorage.getItem('storeName')    || 'Our Shop';
    const storePhone   = localStorage.getItem('storePhone')   || '';
    const storeAddress = localStorage.getItem('storeAddress') || '';

    // Detect invoice type
    const isPurchase = inv.type === 'purchase';

    // Build items list
    // Purchase invoices use: item.cartQuantity, item.price, item.name (already includes colour)
    // Sale invoices use:     item.qty (or item.cartQuantity), item.price, item.name, item.color
    const items = inv.items || inv.cart || inv.products || [];
    const itemLines = items.length > 0
        ? items.map(item => {
            const name  = item.name  || 'Item';
            // cartQuantity is used by BOTH sale and purchase — check it first
            const qty   = Number(item.cartQuantity || item.qty || item.quantity || 0);
            const price = Number(item.price || 0);
            const total_item = (qty && price) ? (price * qty).toFixed(0) : '?';
            // For sale invoices, color is stored separately
            const color = item.color || item.colorName || item.selectedColor || '';
            const size  = item.size  || item.sizeName  || '';
            const extra = [color, size].filter(Boolean).join(', ');
            // Purchase invoice already puts colour in the name (e.g. "Silk — Red")
            // so only append extra if it is not already in the name
            const showExtra = extra && !name.includes(extra);
            return '  * ' + name + (showExtra ? ' (' + extra + ')' : '') + ' x' + qty + ' = Rs.' + total_item;
          }).join('\n')
        : '  (No items)';

    const total    = Number(inv.total    || 0);
    const subtotal = Number(inv.subtotal || total);
    const discount = Number(inv.discount || 0);
    const gst      = Number(inv.gst      || inv.tax || 0);
    const invNum   = (inv.invoiceNumber  || inv.id  || '').toString().slice(-6).padStart(4, '0');
    const payment  = inv.paymentMethod   || inv.payment || '';

    // Party — supplier for purchase, customer for sale
    const partyLabel = isPurchase ? 'Supplier' : 'Customer';
    const partyName  = isPurchase
        ? (inv.supplierName    || 'Supplier')
        : (inv.customerName    || 'Walk-in');
    const partyPhone = isPurchase
        ? (inv.supplierContact || inv.supplierPhone || '')
        : (inv.customerPhone   || '');

    const date = inv.date || inv.createdAt
        ? new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Build message — plain string concat, zero escaping issues
    var msg = '';
    msg += 'Shop: ' + storeName + '\n';
    if (storeAddress) msg += storeAddress + '\n';
    if (storePhone)   msg += 'Phone: ' + storePhone + '\n';
    msg += '\n';
    msg += '----------------------------\n';
    msg += (isPurchase ? 'PURCHASE INVOICE #' : 'INVOICE #') + invNum + '\n';
    msg += 'Date: ' + date + '\n';
    msg += partyLabel + ': ' + partyName + '\n';
    if (partyPhone)   msg += 'Contact: ' + partyPhone + '\n';
    msg += '----------------------------\n';
    msg += '\nItems:\n';
    msg += itemLines + '\n';
    msg += '\n----------------------------\n';
    if (discount > 0) msg += 'Discount: -Rs.' + discount.toFixed(0) + '\n';
    if (gst > 0)      msg += 'GST: +Rs.' + gst.toFixed(0) + '\n';
    msg += (isPurchase ? 'PURCHASE TOTAL' : 'TOTAL') + ': Rs.' + total.toFixed(0) + '\n';
    msg += '----------------------------\n';
    if (payment)      msg += 'Payment: ' + payment + '\n';
    if (isPurchase) {
        msg += '\nStock updated in inventory.\n';
    } else {
        msg += '\nThank you! See you again :)\n';
        if (storePhone) msg += 'For queries: ' + storePhone;
    }

    // Store globally for the Send button to access
    window._waPendingMessage = msg;

    // Pre-fill phone number if we have one
    const prefillPhone = partyPhone || '';
    _showWhatsAppModal(msg, prefillPhone);
}

function _showWhatsAppModal(message, prefillPhone) {
    document.getElementById('waInvoiceModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'waInvoiceModal';
    modal.className = 'si-modal active';

    // Build modal HTML safely — set preview text via DOM after appending
    modal.innerHTML = [
        '<div class="si-modal-box" style="max-width:500px;">',
        `  <button class="si-modal-close" onclick="document.getElementById('waInvoiceModal').remove();window.app&&window.app.refreshActivePage()">×</button>`,
        '<h2 class="si-modal-title">📲 Send Invoice on WhatsApp</h2>',

        '  <div style="margin-bottom:14px;">',
        `    <label style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;">Customer WhatsApp Number</label>`,
        '    <div style="display:flex;gap:8px;">',
        `      <span style="padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-family:'Space Mono',monospace;font-size:13px;color:var(--text-muted);">+91</span>`,
        '      <input type="tel" id="waPhoneInput" placeholder="Enter 10-digit number" maxlength="10"',
        `        style="flex:1;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-family:'Space Mono',monospace;font-size:13px;color:var(--text-light);outline:none;">`,
        '    </div>',
        `    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:5px;">Leave blank to choose contact inside WhatsApp</div>`,
        '  </div>',

        '  <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px;max-height:220px;overflow-y:auto;">',
        `    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.08em;">MESSAGE PREVIEW</div>`,
        `    <pre id="waMessagePreview" style="font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-light);white-space:pre-wrap;word-break:break-word;margin:0;line-height:1.6;"></pre>`,
        '  </div>',

        '  <textarea id="waCustomMsg" rows="6"',
        `    style="display:none;width:100%;padding:10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-light);resize:vertical;box-sizing:border-box;margin-bottom:8px;"></textarea>`,
        '  <button onclick="_toggleWAEdit()" id="waEditBtn"',
        `    style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;margin-bottom:14px;display:block;">✏️ Edit message</button>`,

        '  <div style="display:flex;gap:10px;">',
        '    <button onclick="_openWhatsApp()"',
        `      style="flex:1;padding:12px;background:linear-gradient(135deg,rgba(37,211,102,0.25),rgba(37,211,102,0.15));border:1px solid rgba(37,211,102,0.5);border-radius:10px;color:#25D366;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">`,
        '      📲 Open WhatsApp',
        '    </button>',
        '    <button onclick="_copyWAText()"',
        `      style="padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">`,
        '      📋 Copy',
        '    </button>',
        '  </div>',
        '</div>'
    ].join('\n');

    document.body.appendChild(modal);

    // Set preview text safely via textContent — avoids ALL escaping issues
    const preview   = document.getElementById('waMessagePreview');
    const textarea  = document.getElementById('waCustomMsg');
    const phoneInp  = document.getElementById('waPhoneInput');
    if (preview)  preview.textContent  = message;
    if (textarea) textarea.value       = message;
    // Pre-fill phone if available (customer/supplier contact)
    if (phoneInp && prefillPhone) {
        phoneInp.value = prefillPhone.replace(/\D/g,'').slice(-10);
    }

    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

function _toggleWAEdit() {
    const previewBox = document.getElementById('waMessagePreview').parentElement;
    const textarea   = document.getElementById('waCustomMsg');
    const btn        = document.getElementById('waEditBtn');
    if (!textarea || !btn) return;

    if (textarea.style.display === 'none') {
        textarea.style.display = 'block';
        previewBox.style.display = 'none';
        btn.textContent = '👁 Preview';
        textarea.focus();
    } else {
        // Sync edited text back to preview and global store
        window._waPendingMessage = textarea.value;
        const preview = document.getElementById('waMessagePreview');
        if (preview) preview.textContent = textarea.value;
        textarea.style.display = 'none';
        previewBox.style.display = 'block';
        btn.textContent = '✏️ Edit message';
    }
}

function _openWhatsApp() {
    // Always read the latest message — either from edited textarea or global store
    const textarea = document.getElementById('waCustomMsg');
    const msg = (textarea && textarea.style.display !== 'none')
        ? textarea.value
        : (window._waPendingMessage || '');

    if (!msg) {
        window.app && window.app.showNotification('Message is empty', 'warning');
        return;
    }

    const phoneRaw = (document.getElementById('waPhoneInput')?.value || '').trim();
    const digits   = phoneRaw.replace(/\D/g, '');
    const encoded  = encodeURIComponent(msg);

    let url;
    if (digits.length >= 10) {
        // Add India country code
        const phone = '91' + digits.slice(-10);
        url = 'https://wa.me/' + phone + '?text=' + encoded;
    } else {
        // No number — open WhatsApp with message, user picks contact
        url = 'https://wa.me/?text=' + encoded;
    }

    window.open(url, '_blank');
    document.getElementById('waInvoiceModal')?.remove();
    window.app && window.app.showNotification('Opening WhatsApp...', 'success');
}

function _copyWAText() {
    const msg = window._waPendingMessage || '';
    if (!msg) return;
    navigator.clipboard.writeText(msg)
        .then(() => window.app && window.app.showNotification('Copied to clipboard!', 'success'))
        .catch(() => window.app && window.app.showNotification('Copy failed — select text manually', 'warning'));
}

// _copyInvoiceText renamed to _copyWAText above


// ══════════════════════════════════════════
// 2. CUSTOMER LEDGER + CREDIT TRACKING
// ══════════════════════════════════════════

function getCustomers() {
    try { return JSON.parse(localStorage.getItem(storage.currentUser + '_customers') || '[]'); }
    catch(e) { return []; }
}

function saveCustomers(list) {
    localStorage.setItem(storage.currentUser + '_customers', JSON.stringify(list));
}

function getCustomerById(id) {
    return getCustomers().find(c => c.id === id) || null;
}

function upsertCustomer(data) {
    const list = getCustomers();
    const idx = list.findIndex(c => c.id === data.id);
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    } else {
        list.unshift({ ...data, id: 'cust_' + Date.now(), createdAt: new Date().toISOString(), balance: 0, transactions: [] });
    }
    saveCustomers(list);
}

function addCustomerTransaction(customerId, type, amount, note, invoiceId) {
    const list = getCustomers();
    const c = list.find(c => c.id === customerId);
    if (!c) return;
    if (!c.transactions) c.transactions = [];
    const txn = { id: 'txn_' + Date.now(), type, amount: parseFloat(amount), note: note || '', invoiceId: invoiceId || null, date: new Date().toISOString() };
    c.transactions.unshift(txn);
    // type: 'sale' adds to balance (they owe us), 'payment' reduces balance
    if (type === 'sale') c.balance = (c.balance || 0) + parseFloat(amount);
    if (type === 'payment') c.balance = (c.balance || 0) - parseFloat(amount);
    if (type === 'advance') c.balance = (c.balance || 0) - parseFloat(amount);
    saveCustomers(list);
}

function openCustomerLedger() {
    document.getElementById('customerLedgerModal')?.remove();
    const customers = getCustomers();
    const totalDue = customers.reduce((s, c) => s + (c.balance || 0), 0);
    const overdue = customers.filter(c => (c.balance || 0) > 0);

    const modal = document.createElement('div');
    modal.id = 'customerLedgerModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:620px;max-height:90vh;overflow-y:auto;">
            <button class="si-modal-close" onclick="document.getElementById('customerLedgerModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">👥 Customer Ledger</h2>

            <!-- Stats row -->
            <div id="ledgerStats" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">TOTAL CUSTOMERS</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:var(--cyan);">${customers.length}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">TOTAL DUE</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${totalDue > 0 ? '#ff6b6b' : '#00ff88'};">₹${Math.abs(totalDue).toFixed(0)}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">WITH DUES</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#ff6b6b;">${overdue.length}</div>
                </div>
            </div>

            <!-- Add Customer -->
            <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px;margin-bottom:16px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#00d4ff;font-weight:700;margin-bottom:10px;">➕ ADD / UPDATE CUSTOMER</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <input type="text" id="custName" placeholder="Customer name *"
                        style="padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                    <input type="tel" id="custPhone" placeholder="Phone (WhatsApp)"
                        style="padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <input type="number" id="custOpeningBalance" placeholder="Opening balance (₹)" min="0"
                        style="padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                    <input type="text" id="custCity" placeholder="City / Area"
                        style="padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                </div>
                <button onclick="_saveNewCustomer()" style="width:100%;padding:10px;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">Save Customer</button>
            </div>

            <!-- Customer List -->
            <div id="customerListContainer">
                ${_renderCustomerList(customers)}
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

function _renderCustomerList(customers) {
    if (customers.length === 0) {
        return `<div style="text-align:center;padding:40px 0;font-family:'Space Mono',monospace;font-size:12px;color:var(--text-muted);">No customers yet. Add one above.</div>`;
    }
    return customers.map(c => {
        const bal = c.balance || 0;
        const balColor = bal > 0 ? '#ff6b6b' : bal < 0 ? '#00ff88' : 'var(--text-muted)';
        const balLabel = bal > 0 ? `Owes ₹${bal.toFixed(0)}` : bal < 0 ? `Advance ₹${Math.abs(bal).toFixed(0)}` : 'Settled ✓';
        return `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <div>
                    <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--text-light);">${esc(c.name)}</div>
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">${c.phone ? '📞 ' + esc(c.phone) : ''}${c.city ? ' · ' + esc(c.city) : ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${balColor};">${balLabel}</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button onclick="_recordPayment('${c.id}')" style="padding:5px 10px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:7px;color:#00ff88;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;font-weight:700;">💰 Record Payment</button>
                <button onclick="_viewCustomerHistory('${c.id}')" style="padding:5px 10px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:7px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;">📋 History</button>
                ${c.phone ? `<button onclick="_waReminder('${c.id}')" style="padding:5px 10px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:7px;color:#25D366;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;">📲 WA Reminder</button>` : ''}
                <button onclick="_deleteCustomer('${c.id}')" style="padding:5px 10px;background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:7px;color:#f87171;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// Re-renders the ENTIRE ledger modal content (stats + list) without closing it
function _refreshCustomerLedger() {
    // Check if modal is still in DOM
    const modal = document.getElementById('customerLedgerModal');
    if (!modal) {
        // Modal is closed, silently return (user can reopen it)
        return;
    }
    
    // Use new CustomerLedger system
    if (typeof CustomerLedger !== 'undefined') {
        const customers = CustomerLedger.getAll();
        const totalDue  = customers.reduce((s, c) => s + Math.max(0, c.balance || 0), 0);
        const overdue   = customers.filter(c => (c.balance || 0) > 0);

        // Update stats
        const statsEl = document.getElementById('ledgerStats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">TOTAL CUSTOMERS</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:var(--cyan);">${customers.length}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">TOTAL DUE</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${totalDue > 0 ? '#ff6b6b' : '#00ff88'};">₹${totalDue.toFixed(0)}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">WITH DUES</div>
                    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#ff6b6b;">${overdue.length}</div>
                </div>`;
        }

        // Update list - rebuild the list dynamically
        const listEl = document.getElementById('customerListContainer');
        if (listEl) {
            listEl.innerHTML = customers.map(c => {
                const isDue = (c.balance || 0) > 0;
                const balColor = isDue ? '#ff6b6b' : '#00ff88';
                const avatar = c.name.charAt(0).toUpperCase();
                return `
                    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;"
                        onmouseover="this.style.borderColor='rgba(108,99,255,0.4)'"
                        onmouseout="this.style.borderColor='var(--border)'"
                        onclick="CustomerLedger.showDetail('${esc(c.id)}')">
                        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#00d4ff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;flex-shrink:0;">${avatar}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-family:'Space Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--text-light);">${esc(c.name)}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${c.phone ? '📞 ' + esc(c.phone) : 'No phone'}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${balColor};">₹${Math.abs(c.balance || 0).toFixed(0)}</div>
                            <div style="font-size:11px;color:var(--text-muted);">${isDue ? 'Owes' : 'Advance'}</div>
                        </div>
                    </div>`;
            }).join('');
        }

        // Clear form inputs
        ['custName','custPhone','custCity','custOpeningBalance'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
    }
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function _saveNewCustomer() {
    const name = document.getElementById('custName')?.value.trim();
    if (!name) { window.app?.showNotification('Customer name is required', 'warning'); return; }
    const phone = document.getElementById('custPhone')?.value.trim() || '';
    const city = document.getElementById('custCity')?.value.trim() || '';
    const opening = parseFloat(document.getElementById('custOpeningBalance')?.value) || 0;
    
    if (typeof CustomerLedger !== 'undefined') {
        CustomerLedger.upsert({ name, phone, email: '', address: city });
        if (opening > 0) {
            const c = CustomerLedger.findByPhone(phone);
            if (c) {
                CustomerLedger.addTransaction(c.id, { type: 'sale', amount: opening, note: 'Opening balance' });
            }
        }
        _refreshCustomerLedger();
        window.app?.showNotification('Customer saved!', 'success');
    }
}

function _recordPayment(customerId) {
    // Use new CustomerLedger system for consistency
    if (typeof CustomerLedger === 'undefined') {
        window.app?.showNotification('Customer Ledger not loaded', 'error');
        return;
    }
    
    const c = CustomerLedger.getById(customerId);
    if (!c) return;
    
    const amount = parseFloat(prompt(`Record payment from ${c.name}\nCurrent balance: ₹${(c.balance||0).toFixed(0)}\n\nEnter amount received:`));
    if (isNaN(amount) || amount <= 0) return;
    
    const note = prompt('Payment note (e.g. "Cash", "UPI", "Cheque"):') || 'Cash payment';
    
    // Record transaction in CustomerLedger
    CustomerLedger.addTransaction(customerId, {
        type: 'payment',
        amount: amount,
        note: note,
        date: new Date().toISOString()
    });
    
    // Mark pending invoices as paid when payment is recorded
    if (typeof storage !== 'undefined' && storage.updateInvoiceStatus) {
        const allInvoices = storage.getInvoices();
        let remainingAmount = amount;
        
        // Find all pending invoices for this customer, sorted by date (oldest first)
        const pendingInvoices = allInvoices
            .filter(inv => inv.status === 'pending' && inv.customerPhone === c.phone)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Mark invoices as paid starting from the oldest one
        for (const inv of pendingInvoices) {
            if (remainingAmount <= 0) break;
            
            if (remainingAmount >= inv.total) {
                // Fully paid
                storage.updateInvoiceStatus(inv.id, 'paid');
                remainingAmount -= inv.total;
                console.log(`[Credit Billing] Invoice ${inv.id} marked as PAID`);
            } else if (remainingAmount > 0) {
                // Partial payment - mark as partial
                storage.updateInvoiceStatus(inv.id, 'partial');
                console.log(`[Credit Billing] Invoice ${inv.id} marked as PARTIAL (₹${remainingAmount} of ₹${inv.total})`);
                remainingAmount = 0;
            }
        }
    }
    
    _refreshCustomerLedger();
    window.app?.showNotification(`₹${amount} payment recorded for ${c.name}`, 'success');
}

function _viewCustomerHistory(customerId) {
    if (typeof CustomerLedger !== 'undefined') {
        const c = CustomerLedger.getById(customerId);
        if (!c) return;
        const txns = (c.transactions || []).slice(0, 20);
        const rows = txns.map(t => {
            const isDebit = t.type === 'sale';
            const color = isDebit ? '#ff6b6b' : '#00ff88';
            const sign = isDebit ? '+' : '-';
            const date = new Date(t.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <div>
                    <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-light);">${esc(t.note || t.type)}</div>
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">${date}</div>
                </div>
                <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${color};">${sign}₹${t.amount.toFixed(0)}</div>
            </div>`;
        }).join('');
        alert(`Transaction history for ${c.name}\n\n` + txns.map(t => `${new Date(t.date).toLocaleDateString('en-IN')} | ${t.type.toUpperCase()} | ₹${t.amount} | ${t.note||''}`).join('\n'));
    }
}

function _waReminder(customerId) {
    if (typeof CustomerLedger !== 'undefined') {
        const c = CustomerLedger.getById(customerId);
        if (!c || !c.phone) return;
        const storeName = localStorage.getItem('storeName') || 'Our Shop';
        const bal = (c.balance || 0).toFixed(0);
        const msg = `Dear ${c.name},\n\nThis is a gentle reminder from *${storeName}*.\n\nYour outstanding balance is *₹${bal}*.\n\nPlease make the payment at your earliest convenience.\n\nThank you 🙏`;
        const phone = '91' + c.phone.replace(/\D/g,'').slice(-10);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

function _deleteCustomer(customerId) {
    if (typeof CustomerLedger !== 'undefined') {
        const c = CustomerLedger.getById(customerId);
        if (!c) return;
        if (!confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
        CustomerLedger.delete(customerId);
        _refreshCustomerLedger();
        window.app?.showNotification('Customer deleted', 'success');
    }
}


// ══════════════════════════════════════════
// 3. SALES ANALYTICS DASHBOARD
// ══════════════════════════════════════════

function openAnalytics() {
    document.getElementById('analyticsModal')?.remove();
    const invoices = storage.getInvoices();
    const products = storage.getProducts();

    // Revenue by month (last 6 months)
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), revenue: 0, count: 0 };
    });
    invoices.forEach(inv => {
        if (inv.type === 'purchase') return; // exclude purchase invoices from revenue
        if (inv.status === 'pending') return; // exclude pending (unpaid) invoices from revenue
        const d = new Date(inv.createdAt || inv.date);
        if (isNaN(d.getTime())) return;
        const m = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
        if (m) { m.revenue += inv.total || 0; m.count++; }
    });

    // Top 5 products by revenue
    const productRevenue = {};
    invoices.forEach(inv => {
        if (inv.type === 'purchase') return;
        if (inv.status === 'pending') return; // exclude pending invoices
        const items = inv.items || inv.cart || inv.products || [];
        items.forEach(item => {
            if (!item.name) return;
            const qty = Number(item.cartQuantity || item.qty || item.quantity || 0);
            if (!productRevenue[item.name]) productRevenue[item.name] = 0;
            productRevenue[item.name] += (item.price * qty) || 0;
        });
    });
    const topProducts = Object.entries(productRevenue)
        .sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Top colours
    const colorRevenue = {};
    invoices.forEach(inv => {
        if (inv.type === 'purchase') return;
        if (inv.status === 'pending') return; // exclude pending invoices
        const items = inv.items || inv.cart || inv.products || [];
        items.forEach(item => {
            const color = item.color || item.colorName || item.selectedColor || '';
            if (color) {
                const qty = Number(item.cartQuantity || item.qty || item.quantity || 0);
                if (!colorRevenue[color]) colorRevenue[color] = 0;
                colorRevenue[color] += (item.price * qty) || 0;
            }
        });
    });
    const topColors = Object.entries(colorRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Peak day of week
    const dayRevenue = Array(7).fill(0);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    invoices.forEach(inv => { 
        if (inv.type === 'purchase') return;
        if (inv.status === 'pending') return; // exclude pending invoices
        const d = new Date(inv.createdAt || inv.date);
        if (!isNaN(d.getTime())) dayRevenue[d.getDay()] += inv.total || 0;
    });
    const peakDay = dayNames[dayRevenue.indexOf(Math.max(...dayRevenue))];

    const maxRevenue = Math.max(...months.map(m => m.revenue), 1);
    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
    const totalOrders = months.reduce((s, m) => s + m.count, 0);
    const avgOrder = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    const barWidth = 36;
    const chartHeight = 120;
    const bars = months.map((m, i) => {
        const h = Math.max(4, Math.round((m.revenue / maxRevenue) * chartHeight));
        const x = 40 + i * 60;
        const y = chartHeight - h + 20;
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">₹${m.revenue >= 1000 ? (m.revenue/1000).toFixed(1)+'k' : m.revenue.toFixed(0)}</div>
                <div style="width:${barWidth}px;height:${h}px;background:linear-gradient(to top,rgba(0,255,136,0.6),rgba(0,212,255,0.4));border-radius:4px 4px 0 0;border:1px solid rgba(0,255,136,0.3);min-height:4px;"></div>
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">${m.label}</div>
            </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'analyticsModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:640px;max-height:92vh;overflow-y:auto;">
            <button class="si-modal-close" onclick="document.getElementById('analyticsModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">📊 Sales Analytics</h2>

            <!-- KPIs -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
                ${[
                    ['6-Month Revenue', '₹' + (totalRevenue >= 1000 ? (totalRevenue/1000).toFixed(1)+'k' : totalRevenue.toFixed(0)), '#00ff88'],
                    ['Total Orders', totalOrders, '#00d4ff'],
                    ['Avg Order Value', '₹' + avgOrder.toFixed(0), '#ffd700'],
                    ['Peak Day', peakDay, '#a78bfa']
                ].map(([label, val, color]) => `
                    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                        <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:4px;">${label}</div>
                        <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${color};">${val}</div>
                    </div>`).join('')}
            </div>

            <!-- Revenue chart -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);letter-spacing:0.1em;margin-bottom:14px;">MONTHLY REVENUE (Last 6 months)</div>
                <div style="display:flex;align-items:flex-end;gap:8px;height:${chartHeight + 40}px;">
                    ${bars}
                </div>
            </div>

            <!-- Top products + Top colours side by side -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <!-- Top products -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:14px;">
                    <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);letter-spacing:0.1em;margin-bottom:12px;">🏆 TOP PRODUCTS</div>
                    ${topProducts.length === 0 ? '<div style="font-family:\'Space Mono\',monospace;font-size:10px;color:var(--text-muted);">No sales data yet</div>' :
                    topProducts.map(([name, rev], i) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${i+1}. ${esc(name)}</div>
                            <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00ff88;font-weight:700;">₹${rev >= 1000 ? (rev/1000).toFixed(1)+'k' : rev.toFixed(0)}</div>
                        </div>`).join('')}
                </div>

                <!-- Top colours -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:14px;">
                    <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);letter-spacing:0.1em;margin-bottom:12px;">🎨 TOP COLOURS</div>
                    ${topColors.length === 0 ? '<div style="font-family:\'Space Mono\',monospace;font-size:10px;color:var(--text-muted);">No colour data yet<br><span style="font-size:9px;">Add colours to products and generate invoices</span></div>' :
                    topColors.map(([color, rev], i) => {
                        const sw = window.app ? window.app.getColorSwatch(color) : '#888';
                        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="width:10px;height:10px;border-radius:50%;background:${sw};flex-shrink:0;"></span>
                            <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-light);flex:1;">${esc(color)}</div>
                            <div style="font-family:'Space Mono',monospace;font-size:10px;color:#ffd700;font-weight:700;">₹${rev >= 1000 ? (rev/1000).toFixed(1)+'k' : rev.toFixed(0)}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Day of week breakdown -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:14px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);letter-spacing:0.1em;margin-bottom:12px;">📅 REVENUE BY DAY OF WEEK</div>
                <div style="display:flex;gap:6px;align-items:flex-end;height:80px;">
                    ${dayRevenue.map((rev, i) => {
                        const maxD = Math.max(...dayRevenue, 1);
                        const h = Math.max(4, Math.round((rev / maxD) * 60));
                        const isToday = i === new Date().getDay();
                        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                            <div style="width:100%;height:${h}px;background:${isToday ? 'rgba(0,255,136,0.5)' : 'rgba(108,99,255,0.35)'};border-radius:3px 3px 0 0;min-height:4px;border:1px solid ${isToday ? 'rgba(0,255,136,0.4)' : 'rgba(108,99,255,0.3)'}"></div>
                            <div style="font-family:'Space Mono',monospace;font-size:8px;color:${isToday ? '#00ff88' : 'var(--text-muted)'};">${dayNames[i]}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}


// ══════════════════════════════════════════
// 4. CLOUD BACKUP — Full export/import
// ══════════════════════════════════════════

function openBackupModal() {
    document.getElementById('backupModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'backupModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:480px;">
            <button class="si-modal-close" onclick="document.getElementById('backupModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">💾 Backup & Restore</h2>

            <!-- Export -->
            <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.25);border-radius:12px;padding:16px;margin-bottom:14px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#00ff88;font-weight:700;margin-bottom:6px;">📤 EXPORT BACKUP</div>
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:12px;line-height:1.6;">Downloads ALL your data — all profiles, products, invoices, suppliers, customers, bookings — as a single JSON file. Save this file somewhere safe (Google Drive, WhatsApp to yourself, email).</div>
                <button onclick="_downloadFullBackup()" style="width:100%;padding:11px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:0.04em;">↓ Download Full Backup (.json)</button>
            </div>

            <!-- Import -->
            <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.25);border-radius:12px;padding:16px;margin-bottom:14px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#00d4ff;font-weight:700;margin-bottom:6px;">📥 RESTORE FROM BACKUP</div>
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:12px;line-height:1.6;">⚠️ This will overwrite ALL current data. Only use a backup file created by this app.</div>
                <input type="file" id="backupFileInput" accept=".json"
                    style="display:block;width:100%;padding:10px;background:var(--bg-primary);border:1px dashed var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;box-sizing:border-box;margin-bottom:10px;">
                <button onclick="_restoreBackup()" style="width:100%;padding:11px;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">↑ Restore Backup</button>
            </div>

            <!-- Auto-reminder status -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:4px;">AUTO BACKUP REMINDER</div>
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-light);">You'll be reminded every 7 days to download a backup.</div>
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:6px;">Last backup: ${_getLastBackupDate()}</div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

function _getLastBackupDate() {
    const ts = localStorage.getItem('lastManualBackup');
    if (!ts) return 'Never';
    return new Date(parseInt(ts)).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function _downloadFullBackup() {
    // Include customers in backup
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        profiles: storage.getAllProfiles(),
        activeProfile: localStorage.getItem('activeProfile'),
        store: {}
    };
    storage.getAllProfiles().forEach(p => {
        data.store[p.id] = {
            products:  JSON.parse(localStorage.getItem(p.id + '_products')  || '[]'),
            invoices:  JSON.parse(localStorage.getItem(p.id + '_invoices')  || '[]'),
            bookings:  JSON.parse(localStorage.getItem(p.id + '_bookings')  || '[]'),
            suppliers: JSON.parse(localStorage.getItem(p.id + '_suppliers') || '[]'),
            customers: JSON.parse(localStorage.getItem(p.id + '_customers') || '[]'),
        };
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shop-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    localStorage.setItem('lastManualBackup', Date.now());
    localStorage.setItem('lastBackupReminder', Date.now());
    window.app?.showNotification('✅ Backup downloaded! Save it to Google Drive or WhatsApp.', 'success');
}

function _restoreBackup() {
    const file = document.getElementById('backupFileInput')?.files[0];
    if (!file) { window.app?.showNotification('Select a backup file first', 'warning'); return; }
    if (!confirm('⚠️ This will REPLACE all your current data.\n\nAre you absolutely sure?')) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.profiles || !data.store) throw new Error('Invalid backup file');
            localStorage.setItem('allProfiles', JSON.stringify(data.profiles));
            if (data.activeProfile) localStorage.setItem('activeProfile', data.activeProfile);
            Object.entries(data.store).forEach(([profileId, d]) => {
                localStorage.setItem(profileId + '_products',  JSON.stringify(d.products  || []));
                localStorage.setItem(profileId + '_invoices',  JSON.stringify(d.invoices  || []));
                localStorage.setItem(profileId + '_bookings',  JSON.stringify(d.bookings  || []));
                localStorage.setItem(profileId + '_suppliers', JSON.stringify(d.suppliers || []));
                localStorage.setItem(profileId + '_customers', JSON.stringify(d.customers || []));
            });
            alert('✅ Backup restored! The app will now reload.');
            location.reload();
        } catch(err) {
            window.app?.showNotification('❌ Invalid backup file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}


// ══════════════════════════════════════════
// 5. SIZE VARIANTS (S/M/L/XL + custom)
// ══════════════════════════════════════════

const STANDARD_SIZES = ['XS','S','M','L','XL','XXL','3XL','Free Size'];

function renderSizePicker(containerId, existingSizes = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentSizes = existingSizes.length > 0 ? existingSizes
        : JSON.parse(container.dataset.sizes || '[]');

    container.innerHTML = `
        <div style="margin-bottom:8px;">
            <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.08em;">STANDARD SIZES</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                ${STANDARD_SIZES.map(s => {
                    const active = currentSizes.find(cs => cs.name === s);
                    return `<button onclick="_toggleSize('${containerId}','${s}')"
                        data-size="${s}"
                        style="padding:5px 12px;border-radius:20px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;transition:all 0.2s;
                        background:${active ? 'rgba(0,255,136,0.2)' : 'var(--bg-secondary)'};
                        border:1px solid ${active ? 'rgba(0,255,136,0.5)' : 'var(--border)'};
                        color:${active ? '#00ff88' : 'var(--text-muted)'};">
                        ${s}${active && active.qty > 0 ? ' ·' + active.qty : ''}
                    </button>`;
                }).join('')}
            </div>
        </div>

        <!-- Size stock table -->
        ${currentSizes.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;">
            <thead><tr>
                <th style="text-align:left;padding:4px 6px;font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">Size</th>
                <th style="text-align:center;padding:4px 6px;font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">Stock</th>
                <th style="padding:4px;"></th>
            </tr></thead>
            <tbody>
                ${currentSizes.map((s, i) => `
                <tr style="background:var(--bg-secondary);border-radius:6px;">
                    <td style="padding:5px 8px;font-family:'Space Mono',monospace;font-size:11px;color:var(--text-light);">${esc(s.name)}</td>
                    <td style="padding:5px 8px;text-align:center;">
                        <input type="number" min="0" value="${s.qty || 0}"
                            onchange="_updateSizeQty('${containerId}',${i},this.value)"
                            style="width:60px;padding:3px 6px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;font-size:11px;">
                    </td>
                    <td style="padding:5px 6px;text-align:center;">
                        <button onclick="_removeSize('${containerId}',${i})" style="background:none;border:none;color:var(--pink);cursor:pointer;font-size:13px;">✕</button>
                    </td>
                </tr><tr style="height:3px;"></tr>`).join('')}
            </tbody>
        </table>` : ''}

        <!-- Custom size -->
        <div style="display:flex;gap:8px;">
            <input type="text" id="${containerId}_customSize" placeholder="Custom size (e.g. 38, 40)"
                style="flex:1;padding:7px 10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:11px;"
                onkeydown="if(event.key==='Enter'){event.preventDefault();_addCustomSize('${containerId}');}">
            <button onclick="_addCustomSize('${containerId}')"
                style="padding:7px 14px;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);border-radius:8px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;font-weight:700;">+ Add</button>
        </div>`;

    container.dataset.sizes = JSON.stringify(currentSizes);
}

function _toggleSize(containerId, sizeName) {
    const container = document.getElementById(containerId);
    let sizes = JSON.parse(container.dataset.sizes || '[]');
    const idx = sizes.findIndex(s => s.name === sizeName);
    if (idx >= 0) {
        sizes.splice(idx, 1);
    } else {
        sizes.push({ name: sizeName, qty: 0 });
    }
    renderSizePicker(containerId, sizes);
}

function _addCustomSize(containerId) {
    const input = document.getElementById(containerId + '_customSize');
    const val = input?.value.trim();
    if (!val) return;
    const container = document.getElementById(containerId);
    let sizes = JSON.parse(container.dataset.sizes || '[]');
    if (sizes.find(s => s.name.toLowerCase() === val.toLowerCase())) {
        window.app?.showNotification('Size already added', 'warning'); return;
    }
    sizes.push({ name: val, qty: 0 });
    renderSizePicker(containerId, sizes);
}

function _updateSizeQty(containerId, idx, val) {
    const container = document.getElementById(containerId);
    let sizes = JSON.parse(container.dataset.sizes || '[]');
    if (sizes[idx]) sizes[idx].qty = parseInt(val) || 0;
    container.dataset.sizes = JSON.stringify(sizes);
    _syncSizeTotalQty(containerId);
}

function _removeSize(containerId, idx) {
    const container = document.getElementById(containerId);
    let sizes = JSON.parse(container.dataset.sizes || '[]');
    sizes.splice(idx, 1);
    renderSizePicker(containerId, sizes);
}

function _syncSizeTotalQty(containerId) {
    const container = document.getElementById(containerId);
    const sizes = JSON.parse(container.dataset.sizes || '[]');
    const total = sizes.reduce((s, sz) => s + (sz.qty || 0), 0);
    const qtyField = document.getElementById('productQuantity');
    if (qtyField && sizes.length > 0) {
        qtyField.value = total;
        qtyField.readOnly = true;
        qtyField.style.opacity = '0.7';
    }
}

function getSizesFromPicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return JSON.parse(container.dataset.sizes || '[]');
}


// ══════════════════════════════════════════
// 6. SMART LOW STOCK ALERTS
// ══════════════════════════════════════════

function checkLowStockAlerts() {
    const products = storage.getProducts();
    const threshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
    const dismissed = JSON.parse(localStorage.getItem('dismissedLowStockAlerts') || '[]');

    const critical = products.filter(p =>
        p.quantity <= 0 && !dismissed.includes(p.id)
    );
    const low = products.filter(p =>
        p.quantity > 0 && p.quantity <= threshold && !dismissed.includes(p.id)
    );

    if (critical.length === 0 && low.length === 0) return;

    // Show a non-intrusive banner instead of alert()
    const existing = document.getElementById('lowStockBanner');
    if (existing) return; // already showing

    const banner = document.createElement('div');
    banner.id = 'lowStockBanner';
    banner.style.cssText = `
        position:fixed;bottom:80px;right:20px;z-index:9999;
        max-width:320px;
        background:var(--bg-primary);
        border:1px solid ${critical.length > 0 ? 'rgba(255,68,68,0.5)' : 'rgba(255,165,0,0.4)'};
        border-radius:14px;padding:14px 16px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        animation:slideInRight 0.3s ease;
    `;
    banner.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${critical.length > 0 ? '#ff6b6b' : '#ffd700'};">
                ${critical.length > 0 ? '🔴 STOCK ALERT' : '🟡 LOW STOCK'}
            </div>
            <button onclick="document.getElementById('lowStockBanner').remove();window.app&&window.app.refreshActivePage()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0;">✕</button>
        </div>
        ${critical.length > 0 ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#ff6b6b;margin-bottom:6px;">${critical.length} product${critical.length>1?'s':''} out of stock!</div>` : ''}
        ${low.length > 0 ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#ffd700;margin-bottom:6px;">${low.length} product${low.length>1?'s':''} below threshold (${threshold} units)</div>` : ''}
        <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:10px;">
            ${[...critical.slice(0,2), ...low.slice(0,2)].map(p => `• ${p.name} (${p.quantity} left)`).join('<br>')}
            ${(critical.length + low.length) > 4 ? `<br>...and ${(critical.length + low.length) - 4} more` : ''}
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="app&&app.changePage('lowstock');document.getElementById('lowStockBanner').remove();"
                style="flex:1;padding:7px;background:rgba(255,68,68,0.15);border:1px solid rgba(255,68,68,0.35);border-radius:8px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;cursor:pointer;">View All</button>
            <button onclick="_dismissAllAlerts()"
                style="padding:7px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;">Dismiss</button>
        </div>`;
    document.body.appendChild(banner);

    // Auto-hide after 8 seconds
    setTimeout(() => { banner.style.opacity = '0'; banner.style.transition = 'opacity 0.5s'; setTimeout(() => banner.remove(), 500); }, 8000);
}

function _dismissAllAlerts() {
    const products = storage.getProducts();
    const threshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
    const toDissmiss = products.filter(p => p.quantity <= threshold).map(p => p.id);
    localStorage.setItem('dismissedLowStockAlerts', JSON.stringify(toDissmiss));
    document.getElementById('lowStockBanner')?.remove();
}

// Reset dismissed alerts when stock is restocked
function resetDismissedAlerts(productId) {
    const dismissed = JSON.parse(localStorage.getItem('dismissedLowStockAlerts') || '[]');
    const updated = dismissed.filter(id => id !== productId);
    localStorage.setItem('dismissedLowStockAlerts', JSON.stringify(updated));
}

// ── Boot: run stock check after 2s so app loads first ─────────────────────
setTimeout(() => checkLowStockAlerts(), 2000);
