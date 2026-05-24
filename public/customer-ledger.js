// ============================================
// js/customer-ledger.js
// Customer ledger — credit, dues, advance tracking
// This is the #1 feature missing vs Vyapar
// ============================================

const CustomerLedger = {

    // ── Get all customers ──────────────────────────────────────────────
    getAll() {
        try { return JSON.parse(localStorage.getItem(storage.currentUser + '_customers') || '[]'); }
        catch(e) { return []; }
    },

    save(customers) {
        localStorage.setItem(storage.currentUser + '_customers', JSON.stringify(customers));
    },

    getById(id) {
        return this.getAll().find(c => c.id === id) || null;
    },

    // Find customer by phone (used when generating invoices)
    findByPhone(phone) {
        if (!phone) return null;
        return this.getAll().find(c => c.phone === phone.trim()) || null;
    },

    // ── Add or update customer ─────────────────────────────────────────
    upsert(data) {
        const customers = this.getAll();
        const existing = customers.findIndex(c => c.id === data.id);
        if (existing >= 0) {
            customers[existing] = { ...customers[existing], ...data, updatedAt: new Date().toISOString() };
        } else {
            const newCustomer = {
                id: 'cust_' + Date.now(),
                name: data.name || 'Unknown',
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                balance: 0, // positive = they owe us, negative = we owe them (advance)
                totalPurchases: 0,
                totalPaid: 0,
                notes: data.notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                transactions: []
            };
            customers.unshift({ ...newCustomer, ...data, id: newCustomer.id });
        }
        this.save(customers);
        return existing >= 0 ? customers[existing] : customers[0];
    },

    delete(id) {
        const customers = this.getAll().filter(c => c.id !== id);
        this.save(customers);
    },

    // ── Record a transaction (sale, payment, advance) ──────────────────
    addTransaction(customerId, txn) {
        const customers = this.getAll();
        const idx = customers.findIndex(c => c.id === customerId);
        if (idx < 0) return;

        const entry = {
            id: 'txn_' + Date.now(),
            type: txn.type,       // 'sale' | 'payment' | 'advance' | 'return'
            amount: txn.amount,
            note: txn.note || '',
            invoiceId: txn.invoiceId || null,
            date: txn.date || new Date().toISOString()
        };

        customers[idx].transactions = customers[idx].transactions || [];
        customers[idx].transactions.unshift(entry);

        // Update running balance
        if (txn.type === 'sale')    customers[idx].balance += txn.amount;    // they owe more
        if (txn.type === 'payment') customers[idx].balance -= txn.amount;    // they paid
        if (txn.type === 'advance') customers[idx].balance -= txn.amount;    // advance paid
        if (txn.type === 'return')  customers[idx].balance -= txn.amount;    // goods returned

        customers[idx].totalPurchases = (customers[idx].totalPurchases || 0) + (txn.type === 'sale' ? txn.amount : 0);
        customers[idx].totalPaid = (customers[idx].totalPaid || 0) + (txn.type === 'payment' ? txn.amount : 0);
        customers[idx].updatedAt = new Date().toISOString();

        this.save(customers);
    },

    // ── Auto-link invoice to customer by phone ─────────────────────────
    linkInvoice(invoice) {
        if (!invoice.customerPhone && !invoice.customerName) return;
        let customer = this.findByPhone(invoice.customerPhone);

        if (!customer) {
            // Auto-create the customer
            customer = this.upsert({
                name: invoice.customerName || 'Unknown',
                phone: invoice.customerPhone || '',
            });
        }

        this.addTransaction(customer.id, {
            type: 'sale',
            amount: invoice.total,
            invoiceId: invoice.id,
            note: `Invoice ${invoice.id}`,
            date: invoice.createdAt
        });

        return customer.id;
    },

    // ── Render the full ledger page ────────────────────────────────────
    render(containerId = 'customerLedgerContent') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const customers = this.getAll();
        const totalDues = customers.reduce((s, c) => s + Math.max(0, c.balance || 0), 0);
        const totalAdvance = customers.reduce((s, c) => s + Math.max(0, -(c.balance || 0)), 0);
        const overdue = customers.filter(c => (c.balance || 0) > 0).length;

        container.innerHTML = `
        <div style="padding:20px;display:flex;flex-direction:column;gap:16px;height:100%;overflow-y:auto;">

            <!-- Summary cards -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
                <div style="background:#0f0f1e;border:1px solid #1e1e38;border-left:3px solid #ff4444;border-radius:12px;padding:14px 16px;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:8px;">TOTAL DUES</div>
                    <div style="font-family:'Space Mono',monospace;font-size:1.4rem;font-weight:700;color:#ff4444;">₹${totalDues.toFixed(0)}</div>
                    <div style="font-size:11px;color:#5a5a7a;margin-top:4px;">${overdue} customers owe you</div>
                </div>
                <div style="background:#0f0f1e;border:1px solid #1e1e38;border-left:3px solid #00ff88;border-radius:12px;padding:14px 16px;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:8px;">ADVANCE COLLECTED</div>
                    <div style="font-family:'Space Mono',monospace;font-size:1.4rem;font-weight:700;color:#00ff88;">₹${totalAdvance.toFixed(0)}</div>
                    <div style="font-size:11px;color:#5a5a7a;margin-top:4px;">you owe them</div>
                </div>
                <div style="background:#0f0f1e;border:1px solid #1e1e38;border-left:3px solid #6c63ff;border-radius:12px;padding:14px 16px;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:8px;">TOTAL CUSTOMERS</div>
                    <div style="font-family:'Space Mono',monospace;font-size:1.4rem;font-weight:700;color:#6c63ff;">${customers.length}</div>
                    <div style="font-size:11px;color:#5a5a7a;margin-top:4px;">in your ledger</div>
                </div>
            </div>

            <!-- Controls -->
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <input type="text" id="ledgerSearch" placeholder="Search by name or phone..." oninput="CustomerLedger.search(this.value)"
                    style="flex:1;min-width:180px;background:#0f0f1e;border:1px solid #1e1e38;border-radius:8px;padding:8px 14px;font-size:13px;color:#e8e8f0;font-family:'Space Mono',monospace;outline:none;">
                <button onclick="CustomerLedger.showAddModal()"
                    style="padding:8px 18px;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);color:#a78bfa;border-radius:8px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;">
                    + Add Customer
                </button>
                <button onclick="CustomerLedger.exportLedgerCSV()"
                    style="padding:8px 14px;background:#0f0f1e;border:1px solid #1e1e38;color:#5a5a7a;border-radius:8px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">
                    ↓ Export
                </button>
            </div>

            <!-- Customer list -->
            <div id="ledgerCustomerList">
                ${this._renderCustomerList(customers)}
            </div>
        </div>`;
    },

    search(query) {
        const q = (query || '').toLowerCase();
        const results = q
            ? this.getAll().filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
            : this.getAll();
        const list = document.getElementById('ledgerCustomerList');
        if (list) list.innerHTML = this._renderCustomerList(results);
    },

    _renderCustomerList(customers) {
        if (customers.length === 0) return `
            <div style="text-align:center;padding:3rem;color:#5a5a7a;font-family:'Space Mono',monospace;font-size:0.82rem;">
                No customers yet. Customers are auto-added when you create invoices with a phone number,<br>or add them manually above.
            </div>`;

        return customers.map(c => {
            const balance = c.balance || 0;
            const isDue = balance > 0;
            const isAdv = balance < 0;
            const balColor = isDue ? '#ff4444' : isAdv ? '#00ff88' : '#5a5a7a';
            const balLabel = isDue ? `Owes ₹${balance.toFixed(0)}` : isAdv ? `Advance ₹${Math.abs(balance).toFixed(0)}` : 'Settled';
            const avatar = c.name.charAt(0).toUpperCase();

            return `
            <div style="background:#0f0f1e;border:1px solid #1e1e38;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s;"
                onmouseover="this.style.borderColor='rgba(108,99,255,0.4)'"
                onmouseout="this.style.borderColor='#1e1e38'"
                onclick="CustomerLedger.showDetail('${esc(c.id)}')">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#00d4ff);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:#000;flex-shrink:0;">${avatar}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Space Mono',monospace;font-size:0.88rem;font-weight:700;color:#e8e8f0;margin-bottom:2px;">${esc(c.name)}</div>
                    <div style="font-size:12px;color:#5a5a7a;">${c.phone ? '📞 ' + esc(c.phone) : 'No phone'} · ${(c.transactions||[]).length} transactions</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-family:'Space Mono',monospace;font-size:0.95rem;font-weight:700;color:${balColor};">${balLabel}</div>
                    <div style="font-size:11px;color:#5a5a7a;margin-top:2px;">Total bought: ₹${(c.totalPurchases||0).toFixed(0)}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    ${isDue ? `<button onclick="event.stopPropagation();CustomerLedger.showPaymentModal('${esc(c.id)}')"
                        style="padding:5px 10px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88;border-radius:7px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">💰 Collect</button>` : ''}
                    ${isDue ? `<button onclick="event.stopPropagation();CustomerLedger.sendWhatsAppReminder('${esc(c.id)}')"
                        style="padding:5px 10px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;border-radius:7px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">📲 WA</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    showDetail(customerId) {
        const c = this.getById(customerId);
        if (!c) return;
        const balance = c.balance || 0;
        const txns = (c.transactions || []).slice(0, 30);

        const txnRows = txns.length === 0
            ? '<div style="text-align:center;padding:2rem;color:#5a5a7a;font-size:12px;">No transactions yet</div>'
            : txns.map(t => {
                const isCredit = t.type === 'payment' || t.type === 'advance' || t.type === 'return';
                const color = isCredit ? '#00ff88' : '#ff4444';
                const prefix = isCredit ? '−' : '+';
                const label = { sale:'Sale', payment:'Payment', advance:'Advance', return:'Return' }[t.type] || t.type;
                return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1e1e38;">
                    <div style="flex:1;">
                        <div style="font-size:12px;color:#e8e8f0;font-weight:600;">${label}${t.note ? ' — ' + esc(t.note) : ''}</div>
                        <div style="font-size:11px;color:#5a5a7a;margin-top:2px;">${new Date(t.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${color};">${prefix}₹${t.amount.toFixed(0)}</div>
                </div>`;
            }).join('');

        const modal = document.createElement('div');
        modal.id = 'customerDetailModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
        modal.innerHTML = `
        <div style="background:#0a0a14;border:1px solid #2a2a44;border-radius:18px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:20px 24px;border-bottom:1px solid #1e1e38;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-family:'Space Mono',monospace;font-size:1rem;font-weight:700;color:#e8e8f0;">${esc(c.name)}</div>
                    <div style="font-size:12px;color:#5a5a7a;margin-top:3px;">${c.phone || 'No phone'}</div>
                </div>
                <button onclick="document.getElementById('customerDetailModal').remove()" style="background:none;border:none;color:#5a5a7a;font-size:1.5rem;cursor:pointer;">×</button>
            </div>
            <div style="padding:16px 24px;border-bottom:1px solid #1e1e38;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:#0f0f1e;border-radius:10px;padding:12px 14px;">
                    <div style="font-size:10px;color:#5a5a7a;font-family:'Space Mono',monospace;letter-spacing:0.1em;margin-bottom:6px;">BALANCE</div>
                    <div style="font-family:'Space Mono',monospace;font-size:1.2rem;font-weight:700;color:${balance > 0 ? '#ff4444' : balance < 0 ? '#00ff88' : '#5a5a7a'};">
                        ${balance > 0 ? 'Owes ₹' + balance.toFixed(0) : balance < 0 ? 'Advance ₹' + Math.abs(balance).toFixed(0) : 'Settled'}
                    </div>
                </div>
                <div style="background:#0f0f1e;border-radius:10px;padding:12px 14px;">
                    <div style="font-size:10px;color:#5a5a7a;font-family:'Space Mono',monospace;letter-spacing:0.1em;margin-bottom:6px;">TOTAL BOUGHT</div>
                    <div style="font-family:'Space Mono',monospace;font-size:1.2rem;font-weight:700;color:#00d4ff;">₹${(c.totalPurchases||0).toFixed(0)}</div>
                </div>
            </div>
            <div style="padding:16px 24px;display:flex;gap:8px;border-bottom:1px solid #1e1e38;">
                <button onclick="CustomerLedger.showPaymentModal('${esc(c.id)}')"
                    style="flex:1;padding:9px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88;border-radius:9px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">💰 Record Payment</button>
                <button onclick="CustomerLedger.showPaymentModal('${esc(c.id)}','advance')"
                    style="flex:1;padding:9px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.3);color:#a78bfa;border-radius:9px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">⬆️ Add Advance</button>
                ${c.phone ? `<button onclick="CustomerLedger.sendWhatsAppReminder('${esc(c.id)}')"
                    style="flex:1;padding:9px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;border-radius:9px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">📲 WhatsApp</button>` : ''}
            </div>
            <div style="flex:1;overflow-y:auto;padding:16px 24px;">
                <div style="font-size:10px;color:#5a5a7a;font-family:'Space Mono',monospace;letter-spacing:0.1em;margin-bottom:12px;">TRANSACTION HISTORY</div>
                ${txnRows}
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },

    showPaymentModal(customerId, defaultType = 'payment') {
        const c = this.getById(customerId);
        if (!c) return;
        document.getElementById('customerDetailModal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'paymentEntryModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
        modal.innerHTML = `
        <div style="background:#0a0a14;border:1px solid #2a2a44;border-radius:18px;width:100%;max-width:360px;padding:24px;">
            <div style="font-family:'Space Mono',monospace;font-size:0.95rem;font-weight:700;color:#e8e8f0;margin-bottom:4px;">Record Transaction</div>
            <div style="font-size:12px;color:#5a5a7a;margin-bottom:18px;">${esc(c.name)} · Balance: ₹${(c.balance||0).toFixed(0)}</div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px;color:#5a5a7a;display:block;margin-bottom:6px;font-family:'Space Mono',monospace;">TYPE</label>
                <select id="payTxnType" style="width:100%;background:#0f0f1e;border:1px solid #1e1e38;border-radius:8px;padding:9px 12px;color:#e8e8f0;font-family:'Space Mono',monospace;font-size:13px;outline:none;">
                    <option value="payment" ${defaultType==='payment'?'selected':''}>💰 Payment received</option>
                    <option value="advance" ${defaultType==='advance'?'selected':''}>⬆️ Advance received</option>
                    <option value="return">↩️ Goods returned</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px;color:#5a5a7a;display:block;margin-bottom:6px;font-family:'Space Mono',monospace;">AMOUNT (₹)</label>
                <input type="number" id="payAmount" placeholder="0" min="1"
                    style="width:100%;background:#0f0f1e;border:1px solid #1e1e38;border-radius:8px;padding:9px 12px;color:#e8e8f0;font-family:'Space Mono',monospace;font-size:1rem;outline:none;">
            </div>
            <div style="margin-bottom:18px;">
                <label style="font-size:11px;color:#5a5a7a;display:block;margin-bottom:6px;font-family:'Space Mono',monospace;">NOTE (optional)</label>
                <input type="text" id="payNote" placeholder="e.g. Cash payment, UPI, etc."
                    style="width:100%;background:#0f0f1e;border:1px solid #1e1e38;border-radius:8px;padding:9px 12px;color:#e8e8f0;font-family:'Space Mono',monospace;font-size:13px;outline:none;">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('paymentEntryModal').remove()"
                    style="flex:1;padding:10px;background:#0f0f1e;border:1px solid #1e1e38;color:#5a5a7a;border-radius:10px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;">Cancel</button>
                <button onclick="CustomerLedger._savePayment('${esc(c.id)}')"
                    style="flex:1;padding:10px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);color:#00ff88;border-radius:10px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;font-weight:700;">Save</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('payAmount').focus();
    },

    _savePayment(customerId) {
        const amount = parseFloat(document.getElementById('payAmount').value);
        const type = document.getElementById('payTxnType').value;
        const note = document.getElementById('payNote').value.trim();
        if (!amount || amount <= 0) { alert('Enter a valid amount'); return; }
        this.addTransaction(customerId, { type, amount, note });
        document.getElementById('paymentEntryModal')?.remove();
        window.app && window.app.showNotification('Transaction saved!', 'success');
        // Refresh whichever ledger modal is open
        if (typeof _refreshCustomerLedger === 'function') {
            _refreshCustomerLedger();
        } else {
            const ledgerPage = document.getElementById('customerLedgerContent');
            if (ledgerPage) this.render('customerLedgerContent');
        }
    },

    showAddModal() {
        const modal = document.createElement('div');
        modal.id = 'addCustomerModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
        modal.innerHTML = `
        <div style="background:#0a0a14;border:1px solid #2a2a44;border-radius:18px;width:100%;max-width:360px;padding:24px;">
            <div style="font-family:'Space Mono',monospace;font-size:0.95rem;font-weight:700;color:#e8e8f0;margin-bottom:18px;">Add Customer</div>
            ${['Name *', 'Phone', 'Address', 'Notes'].map((label, i) => {
                const ids = ['custName','custPhone','custAddress','custNotes'];
                const types = ['text','tel','text','text'];
                return `<div style="margin-bottom:12px;">
                    <label style="font-size:11px;color:#5a5a7a;display:block;margin-bottom:6px;font-family:'Space Mono',monospace;">${label.toUpperCase()}</label>
                    <input type="${types[i]}" id="${ids[i]}" placeholder="${label.replace(' *','')}"
                        style="width:100%;background:#0f0f1e;border:1px solid #1e1e38;border-radius:8px;padding:9px 12px;color:#e8e8f0;font-family:'Space Mono',monospace;font-size:13px;outline:none;">
                </div>`;
            }).join('')}
            <div style="display:flex;gap:10px;margin-top:6px;">
                <button onclick="document.getElementById('addCustomerModal').remove()"
                    style="flex:1;padding:10px;background:#0f0f1e;border:1px solid #1e1e38;color:#5a5a7a;border-radius:10px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;">Cancel</button>
                <button onclick="CustomerLedger._saveNewCustomer()"
                    style="flex:1;padding:10px;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);color:#a78bfa;border-radius:10px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;font-weight:700;">Add</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('custName').focus();
    },

    _saveNewCustomer() {
        const name = document.getElementById('custName').value.trim();
        if (!name) { alert('Name is required'); return; }
        this.upsert({
            name,
            phone: document.getElementById('custPhone').value.trim(),
            address: document.getElementById('custAddress').value.trim(),
            notes: document.getElementById('custNotes').value.trim()
        });
        document.getElementById('addCustomerModal')?.remove();
        window.app && window.app.showNotification('Customer added!', 'success');
        if (typeof _refreshCustomerLedger === 'function') {
            _refreshCustomerLedger();
        } else {
            this.render('customerLedgerContent');
        }
    },

    // ── WhatsApp payment reminder ──────────────────────────────────────
    sendWhatsAppReminder(customerId) {
        const c = this.getById(customerId);
        if (!c || !c.phone) { alert('No phone number for this customer'); return; }
        const balance = (c.balance || 0).toFixed(0);
        const storeName = localStorage.getItem('storeName') || 'our shop';
        const msg = `Hello ${c.name},\n\nThis is a friendly reminder that you have a pending amount of *₹${balance}* at ${storeName}.\n\nKindly clear your dues at your earliest convenience.\n\nThank you! 🙏`;
        const url = `https://wa.me/91${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    },

    // ── Export ledger as CSV ───────────────────────────────────────────
    exportLedgerCSV() {
        const customers = this.getAll();
        const rows = [['Name','Phone','Balance (₹)','Total Purchased (₹)','Total Paid (₹)','Status']];
        customers.forEach(c => {
            const balance = (c.balance || 0);
            const status = balance > 0 ? 'Dues Pending' : balance < 0 ? 'Advance' : 'Settled';
            rows.push([c.name, c.phone || '', balance.toFixed(0), (c.totalPurchases||0).toFixed(0), (c.totalPaid||0).toFixed(0), status]);
        });
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `customer-ledger-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    }
};
