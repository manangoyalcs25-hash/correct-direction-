// ============================================
// modules/meter-billing.js — Fabric Meter Billing
// v1.0 — For cloth/fabric shops selling unstitched fabric by meter
//
// Features:
// 1. Add fabric types with price per meter
// 2. Create meter-based invoices
// 3. Customer selection with credit tracking
// 4. Multiple fabric items per bill
// 5. Discounts and GST support
// 6. WhatsApp invoice sharing
// ============================================

// ══════════════════════════════════════════
// STORAGE FUNCTIONS
// ══════════════════════════════════════════

function getMeterBills() {
    try {
        return JSON.parse(localStorage.getItem(storage.currentUser + '_meterBills') || '[]');
    } catch(e) {
        return [];
    }
}

function saveMeterBills(list) {
    localStorage.setItem(storage.currentUser + '_meterBills', JSON.stringify(list));
}

function getFabricInventory() {
    try {
        return JSON.parse(localStorage.getItem(storage.currentUser + '_fabricInventory') || '[]');
    } catch(e) {
        return [];
    }
}

function saveFabricInventory(list) {
    localStorage.setItem(storage.currentUser + '_fabricInventory', JSON.stringify(list));
}

function addMeterBill(bill) {
    const bills = getMeterBills();
    bill.id = 'MBL-' + Date.now();
    bill.invoiceNo = 'MTR-' + (bills.length + 1001);
    bill.createdAt = new Date().toISOString();
    bill.status = bill.status || 'unpaid';
    bills.unshift(bill);
    saveMeterBills(bills);
    
    // Update fabric stock
    if (bill.items && bill.items.length > 0) {
        const fabrics = getFabricInventory();
        bill.items.forEach(item => {
            const fabric = fabrics.find(f => f.id === item.fabricId);
            if (fabric) {
                fabric.stockMeters = Math.max(0, (fabric.stockMeters || 0) - (item.meters || 0));
            }
        });
        saveFabricInventory(fabrics);
    }
    
    return bill;
}

function updateMeterBill(id, data) {
    const bills = getMeterBills().map(b =>
        b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
    );
    saveMeterBills(bills);
}

function deleteMeterBill(id) {
    const bills = getMeterBills().filter(b => b.id !== id);
    saveMeterBills(bills);
}

function addFabric(fabric) {
    const fabrics = getFabricInventory();
    fabric.id = 'FAB-' + Date.now();
    fabric.createdAt = new Date().toISOString();
    fabric.stockMeters = fabric.stockMeters || 0;
    fabrics.unshift(fabric);
    saveFabricInventory(fabrics);
    return fabric;
}

function updateFabric(id, data) {
    const fabrics = getFabricInventory().map(f =>
        f.id === id ? { ...f, ...data, updatedAt: new Date().toISOString() } : f
    );
    saveFabricInventory(fabrics);
}

function deleteFabric(id) {
    const fabrics = getFabricInventory().filter(f => f.id !== id);
    saveFabricInventory(fabrics);
}

// ══════════════════════════════════════════
// TEMPORARY CART FOR CURRENT BILL
// ══════════════════════════════════════════

let meterBillCart = [];
let meterBillCustomer = null;

function clearMeterBillCart() {
    meterBillCart = [];
    meterBillCustomer = null;
}

// ══════════════════════════════════════════
// UI - MAIN MODAL
// ══════════════════════════════════════════

function openMeterBilling() {
    document.getElementById('meterBillingModal')?.remove();
    clearMeterBillCart();
    
    const bills = getMeterBills();
    const fabrics = getFabricInventory();
    const todayBills = bills.filter(b => {
        const d = new Date(b.createdAt);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    });
    const todayRevenue = todayBills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const totalMeters = todayBills.reduce((s, b) => s + (b.totalMeters || 0), 0);
    
    const modal = document.createElement('div');
    modal.id = 'meterBillingModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:900px;max-height:94vh;overflow-y:auto;">
            <button class="si-modal-close" onclick="document.getElementById('meterBillingModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">📏 Meter Billing - Fabric Sales</h2>
            
            <!-- Stats Row -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:4px;">TODAY'S BILLS</div>
                    <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:var(--cyan);">${todayBills.length}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:4px;">METERS SOLD</div>
                    <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:var(--green);">${totalMeters.toFixed(1)}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:4px;">TODAY'S REVENUE</div>
                    <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:#00ff88;">₹${todayRevenue.toFixed(0)}</div>
                </div>
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:4px;">FABRIC TYPES</div>
                    <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:#ffd700;">${fabrics.length}</div>
                </div>
            </div>
            
            <!-- Tabs -->
            <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
                <button id="tabNewBill" onclick="_switchMeterTab('newBill')" class="meter-tab active" style="padding:10px 20px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">+ NEW BILL</button>
                <button id="tabBillHistory" onclick="_switchMeterTab('history')" class="meter-tab" style="padding:10px 20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">BILL HISTORY</button>
                <button id="tabFabrics" onclick="_switchMeterTab('fabrics')" class="meter-tab" style="padding:10px 20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">FABRIC INVENTORY</button>
            </div>
            
            <!-- Tab Content -->
            <div id="meterTabContent">
                ${_renderNewBillTab()}
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

function _switchMeterTab(tab) {
    // Update tab styles
    document.querySelectorAll('.meter-tab').forEach(t => {
        t.style.background = 'var(--bg-secondary)';
        t.style.border = '1px solid var(--border)';
        t.style.color = 'var(--text-muted)';
    });
    
    const activeTab = document.getElementById('tab' + (tab === 'newBill' ? 'NewBill' : tab === 'history' ? 'BillHistory' : 'Fabrics'));
    if (activeTab) {
        activeTab.style.background = 'rgba(0,255,136,0.15)';
        activeTab.style.border = '1px solid rgba(0,255,136,0.4)';
        activeTab.style.color = '#00ff88';
    }
    
    const content = document.getElementById('meterTabContent');
    if (tab === 'newBill') {
        content.innerHTML = _renderNewBillTab();
    } else if (tab === 'history') {
        content.innerHTML = _renderBillHistoryTab();
    } else if (tab === 'fabrics') {
        content.innerHTML = _renderFabricsTab();
    }
}

// ══════════════════════════════════════════
// UI - NEW BILL TAB
// ══════════════════════════════════════════

function _renderNewBillTab() {
    const fabrics = getFabricInventory();
    const customers = typeof getCustomers === 'function' ? getCustomers() : [];
    
    const cartTotal = meterBillCart.reduce((s, item) => s + (item.total || 0), 0);
    const cartMeters = meterBillCart.reduce((s, item) => s + (item.meters || 0), 0);
    
    return `
        <div style="display:grid;grid-template-columns:1fr 350px;gap:16px;">
            <!-- Left: Add Items -->
            <div>
                <!-- Customer Selection -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:8px;">CUSTOMER (OPTIONAL)</div>
                    <div style="display:flex;gap:8px;">
                        <select id="meterCustomerSelect" onchange="_selectMeterCustomer(this.value)" style="flex:1;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                            <option value="">Walk-in Customer</option>
                            ${customers.map(c => `<option value="${c.id}" ${meterBillCustomer?.id === c.id ? 'selected' : ''}>${esc(c.name)} ${c.phone ? '(' + c.phone + ')' : ''}</option>`).join('')}
                        </select>
                        <button onclick="_openQuickCustomerAdd()" style="padding:10px 14px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">+ New</button>
                    </div>
                    ${meterBillCustomer ? `
                    <div style="margin-top:8px;padding:8px;background:var(--bg-primary);border-radius:6px;font-family:'Space Mono',monospace;font-size:10px;">
                        <span style="color:var(--text-muted);">Balance:</span>
                        <span style="color:${(meterBillCustomer.balance || 0) > 0 ? '#ff6b6b' : '#00ff88'};font-weight:700;">
                            ₹${Math.abs(meterBillCustomer.balance || 0).toFixed(0)} ${(meterBillCustomer.balance || 0) > 0 ? 'due' : 'credit'}
                        </span>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Add Fabric Item -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:10px;">ADD FABRIC ITEM</div>
                    
                    ${fabrics.length === 0 ? `
                    <div style="text-align:center;padding:20px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;">
                        No fabrics added yet. Go to "Fabric Inventory" tab to add fabrics.
                    </div>
                    ` : `
                    <div class="form-group" style="margin-bottom:10px;">
                        <label style="font-size:9px;">SELECT FABRIC *</label>
                        <select id="meterFabricSelect" onchange="_onFabricSelect(this.value)" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                            <option value="">-- Choose Fabric --</option>
                            ${fabrics.map(f => `<option value="${f.id}" data-price="${f.pricePerMeter}" data-stock="${f.stockMeters}">${esc(f.name)} (₹${f.pricePerMeter}/m) - ${f.stockMeters}m in stock</option>`).join('')}
                        </select>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                        <div class="form-group">
                            <label style="font-size:9px;">METERS *</label>
                            <input type="number" id="meterQuantity" placeholder="0.00" step="0.25" min="0.25" value="" 
                                onchange="_calculateItemTotal()"
                                style="padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:14px;font-weight:700;text-align:center;">
                        </div>
                        <div class="form-group">
                            <label style="font-size:9px;">RATE/METER</label>
                            <input type="number" id="meterRate" placeholder="0" step="1" min="0" value=""
                                onchange="_calculateItemTotal()"
                                style="padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:14px;text-align:center;">
                        </div>
                        <div class="form-group">
                            <label style="font-size:9px;">TOTAL</label>
                            <input type="text" id="meterItemTotal" readonly value="₹0"
                                style="padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:14px;font-weight:700;text-align:center;">
                        </div>
                    </div>
                    
                    <button onclick="_addToMeterCart()" style="width:100%;padding:12px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">
                        + ADD TO BILL
                    </button>
                    `}
                </div>
            </div>
            
            <!-- Right: Cart / Bill Preview -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:var(--text-light);">BILL ITEMS</div>
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--cyan);">${meterBillCart.length} item${meterBillCart.length !== 1 ? 's' : ''}</div>
                </div>
                
                <div id="meterCartItems" style="max-height:250px;overflow-y:auto;margin-bottom:12px;">
                    ${meterBillCart.length === 0 ? `
                    <div style="text-align:center;padding:30px 0;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;">
                        No items added yet
                    </div>
                    ` : meterBillCart.map((item, idx) => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
                        <div style="flex:1;">
                            <div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:var(--text-light);">${esc(item.fabricName)}</div>
                            <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">${item.meters}m × ₹${item.rate}/m</div>
                        </div>
                        <div style="text-align:right;display:flex;align-items:center;gap:10px;">
                            <div style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#00ff88;">₹${item.total.toFixed(0)}</div>
                            <button onclick="_removeFromMeterCart(${idx})" style="width:24px;height:24px;background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:6px;color:#ff6b6b;cursor:pointer;font-size:12px;">×</button>
                        </div>
                    </div>
                    `).join('')}
                </div>
                
                <!-- Totals -->
                <div style="border-top:1px solid var(--border);padding-top:12px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-family:'Space Mono',monospace;font-size:11px;">
                        <span style="color:var(--text-muted);">Total Meters:</span>
                        <span style="color:var(--cyan);font-weight:700;">${cartMeters.toFixed(2)}m</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-family:'Space Mono',monospace;font-size:11px;">
                        <span style="color:var(--text-muted);">Subtotal:</span>
                        <span style="color:var(--text-light);">₹${cartTotal.toFixed(0)}</span>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                        <div>
                            <label style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">DISCOUNT (%)</label>
                            <input type="number" id="meterDiscount" value="0" min="0" max="100" onchange="_updateMeterTotals()"
                                style="width:100%;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;text-align:center;">
                        </div>
                        <div>
                            <label style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">GST (%)</label>
                            <input type="number" id="meterGst" value="0" min="0" max="28" onchange="_updateMeterTotals()"
                                style="width:100%;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;text-align:center;">
                        </div>
                    </div>
                    
                    <div id="meterGrandTotalDisplay" style="display:flex;justify-content:space-between;padding:12px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:8px;margin-bottom:12px;">
                        <span style="font-family:'Space Mono',monospace;font-size:12px;color:var(--text-light);font-weight:700;">GRAND TOTAL:</span>
                        <span style="font-family:'Space Mono',monospace;font-size:16px;color:#00ff88;font-weight:700;">₹${cartTotal.toFixed(0)}</span>
                    </div>
                    
                    <!-- Payment Method -->
                    <div style="margin-bottom:12px;">
                        <label style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">PAYMENT METHOD</label>
                        <select id="meterPaymentMethod" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                            <option value="credit">Credit (Add to Ledger)</option>
                        </select>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <button onclick="_saveMeterBill()" ${meterBillCart.length === 0 ? 'disabled' : ''} style="padding:12px;background:${meterBillCart.length > 0 ? 'rgba(0,255,136,0.15)' : 'var(--bg-tertiary)'};border:1px solid ${meterBillCart.length > 0 ? 'rgba(0,255,136,0.4)' : 'var(--border)'};border-radius:8px;color:${meterBillCart.length > 0 ? '#00ff88' : 'var(--text-muted)'};font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:${meterBillCart.length > 0 ? 'pointer' : 'not-allowed'};">
                            SAVE BILL
                        </button>
                        <button onclick="_saveMeterBillAndPrint()" ${meterBillCart.length === 0 ? 'disabled' : ''} style="padding:12px;background:${meterBillCart.length > 0 ? 'rgba(0,212,255,0.15)' : 'var(--bg-tertiary)'};border:1px solid ${meterBillCart.length > 0 ? 'rgba(0,212,255,0.4)' : 'var(--border)'};border-radius:8px;color:${meterBillCart.length > 0 ? '#00d4ff' : 'var(--text-muted)'};font-family:'Space Mono',monospace;font-size:11px;cursor:${meterBillCart.length > 0 ? 'pointer' : 'not-allowed'};">
                            SAVE & PRINT
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function _selectMeterCustomer(customerId) {
    if (!customerId) {
        meterBillCustomer = null;
    } else {
        const customers = typeof getCustomers === 'function' ? getCustomers() : [];
        meterBillCustomer = customers.find(c => c.id === customerId) || null;
    }
    _refreshNewBillTab();
}

function _onFabricSelect(fabricId) {
    if (!fabricId) {
        document.getElementById('meterRate').value = '';
        document.getElementById('meterQuantity').value = '';
        document.getElementById('meterItemTotal').value = '₹0';
        return;
    }
    
    const fabrics = getFabricInventory();
    const fabric = fabrics.find(f => f.id === fabricId);
    if (fabric) {
        document.getElementById('meterRate').value = fabric.pricePerMeter || 0;
        document.getElementById('meterQuantity').value = '';
        document.getElementById('meterQuantity').focus();
        _calculateItemTotal();
    }
}

function _calculateItemTotal() {
    const meters = parseFloat(document.getElementById('meterQuantity')?.value) || 0;
    const rate = parseFloat(document.getElementById('meterRate')?.value) || 0;
    const total = meters * rate;
    document.getElementById('meterItemTotal').value = '₹' + total.toFixed(0);
}

function _addToMeterCart() {
    const fabricId = document.getElementById('meterFabricSelect')?.value;
    const meters = parseFloat(document.getElementById('meterQuantity')?.value) || 0;
    const rate = parseFloat(document.getElementById('meterRate')?.value) || 0;
    
    if (!fabricId) {
        showNotification('Please select a fabric', 'error');
        return;
    }
    if (meters <= 0) {
        showNotification('Please enter meters quantity', 'error');
        return;
    }
    if (rate <= 0) {
        showNotification('Please enter rate per meter', 'error');
        return;
    }
    
    const fabrics = getFabricInventory();
    const fabric = fabrics.find(f => f.id === fabricId);
    if (!fabric) {
        showNotification('Fabric not found', 'error');
        return;
    }
    
    // Check stock
    if (meters > fabric.stockMeters) {
        showNotification(`Only ${fabric.stockMeters}m available in stock`, 'error');
        return;
    }
    
    meterBillCart.push({
        fabricId,
        fabricName: fabric.name,
        meters,
        rate,
        total: meters * rate
    });
    
    // Reset form
    document.getElementById('meterFabricSelect').value = '';
    document.getElementById('meterQuantity').value = '';
    document.getElementById('meterRate').value = '';
    document.getElementById('meterItemTotal').value = '₹0';
    
    _refreshNewBillTab();
    showNotification(`Added ${meters}m of ${fabric.name}`, 'success');
}

function _removeFromMeterCart(index) {
    meterBillCart.splice(index, 1);
    _refreshNewBillTab();
}

function _updateMeterTotals() {
    const subtotal = meterBillCart.reduce((s, item) => s + (item.total || 0), 0);
    const discount = parseFloat(document.getElementById('meterDiscount')?.value) || 0;
    const gst = parseFloat(document.getElementById('meterGst')?.value) || 0;
    
    const discountAmount = (subtotal * discount) / 100;
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = (afterDiscount * gst) / 100;
    const grandTotal = afterDiscount + gstAmount;
    
    const display = document.getElementById('meterGrandTotalDisplay');
    if (display) {
        display.innerHTML = `
            <span style="font-family:'Space Mono',monospace;font-size:12px;color:var(--text-light);font-weight:700;">GRAND TOTAL:</span>
            <span style="font-family:'Space Mono',monospace;font-size:16px;color:#00ff88;font-weight:700;">₹${grandTotal.toFixed(0)}</span>
        `;
    }
}

function _refreshNewBillTab() {
    document.getElementById('meterTabContent').innerHTML = _renderNewBillTab();
}

function _saveMeterBill(print = false) {
    if (meterBillCart.length === 0) {
        showNotification('Add items to bill first', 'error');
        return;
    }
    
    const subtotal = meterBillCart.reduce((s, item) => s + (item.total || 0), 0);
    const totalMeters = meterBillCart.reduce((s, item) => s + (item.meters || 0), 0);
    const discount = parseFloat(document.getElementById('meterDiscount')?.value) || 0;
    const gst = parseFloat(document.getElementById('meterGst')?.value) || 0;
    const paymentMethod = document.getElementById('meterPaymentMethod')?.value || 'cash';
    
    const discountAmount = (subtotal * discount) / 100;
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = (afterDiscount * gst) / 100;
    const grandTotal = afterDiscount + gstAmount;
    
    const bill = {
        items: [...meterBillCart],
        customer: meterBillCustomer ? {
            id: meterBillCustomer.id,
            name: meterBillCustomer.name,
            phone: meterBillCustomer.phone
        } : null,
        subtotal,
        totalMeters,
        discountPercent: discount,
        discountAmount,
        gstPercent: gst,
        gstAmount,
        grandTotal,
        paymentMethod,
        status: paymentMethod === 'credit' ? 'unpaid' : 'paid'
    };
    
    const savedBill = addMeterBill(bill);
    
    // Update customer ledger if credit sale
    if (paymentMethod === 'credit' && meterBillCustomer && typeof addCustomerTransaction === 'function') {
        addCustomerTransaction(meterBillCustomer.id, {
            type: 'sale',
            amount: grandTotal,
            description: `Meter Bill: ${savedBill.invoiceNo} (${totalMeters}m fabric)`,
            reference: savedBill.id
        });
    }
    
    showNotification(`Bill ${savedBill.invoiceNo} saved! Total: ₹${grandTotal.toFixed(0)}`, 'success');
    
    if (print) {
        _printMeterBill(savedBill);
    }
    
    clearMeterBillCart();
    _switchMeterTab('history');
}

function _saveMeterBillAndPrint() {
    _saveMeterBill(true);
}

// ══════════════════════════════════════════
// UI - BILL HISTORY TAB
// ══════════════════════════════════════════

function _renderBillHistoryTab() {
    const bills = getMeterBills();
    
    return `
        <div style="margin-bottom:12px;">
            <input type="text" id="billSearchInput" placeholder="Search by invoice no, customer name..."
                onkeyup="_filterMeterBills(this.value)"
                style="width:100%;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
        </div>
        
        <div id="billHistoryList">
            ${bills.length === 0 ? `
            <div style="text-align:center;padding:40px 0;font-family:'Space Mono',monospace;font-size:12px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:12px;opacity:0.3;">📋</div>
                No bills yet. Create your first meter bill!
            </div>
            ` : bills.map(b => _renderBillCard(b)).join('')}
        </div>
    `;
}

function _renderBillCard(bill) {
    const date = new Date(bill.createdAt);
    const statusColor = bill.status === 'paid' ? '#00ff88' : bill.status === 'partial' ? '#ffd700' : '#ff6b6b';
    
    return `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
                <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--cyan);">${bill.invoiceNo}</div>
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">
                    ${date.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})} at ${date.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:#00ff88;">₹${bill.grandTotal.toFixed(0)}</div>
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:${statusColor};text-transform:uppercase;">${bill.status}</div>
            </div>
        </div>
        
        ${bill.customer ? `
        <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-light);margin-bottom:8px;">
            👤 ${esc(bill.customer.name)} ${bill.customer.phone ? '· ' + bill.customer.phone : ''}
        </div>
        ` : ''}
        
        <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-bottom:6px;">ITEMS (${bill.totalMeters.toFixed(1)}m total)</div>
            ${bill.items.slice(0, 3).map(item => `
            <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:10px;margin-bottom:2px;">
                <span style="color:var(--text-light);">${esc(item.fabricName)} (${item.meters}m)</span>
                <span style="color:var(--text-muted);">₹${item.total.toFixed(0)}</span>
            </div>
            `).join('')}
            ${bill.items.length > 3 ? `<div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-top:4px;">+${bill.items.length - 3} more items</div>` : ''}
        </div>
        
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="_printMeterBill(getMeterBills().find(b => b.id === '${bill.id}'))" style="padding:6px 12px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:6px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">🖨️ Print</button>
            <button onclick="_shareMeterBillWhatsApp('${bill.id}')" style="padding:6px 12px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:6px;color:#25d366;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">📱 WhatsApp</button>
            ${bill.status !== 'paid' ? `<button onclick="_markMeterBillPaid('${bill.id}')" style="padding:6px 12px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:6px;color:#00ff88;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">✓ Mark Paid</button>` : ''}
            <button onclick="_deleteMeterBillConfirm('${bill.id}')" style="padding:6px 12px;background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:6px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">🗑️</button>
        </div>
    </div>
    `;
}

function _filterMeterBills(query) {
    const bills = getMeterBills();
    const q = query.toLowerCase().trim();
    const filtered = q ? bills.filter(b =>
        (b.invoiceNo || '').toLowerCase().includes(q) ||
        (b.customer?.name || '').toLowerCase().includes(q) ||
        (b.customer?.phone || '').includes(q)
    ) : bills;
    document.getElementById('billHistoryList').innerHTML = filtered.length === 0 
        ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:\'Space Mono\',monospace;font-size:11px;">No bills found</div>'
        : filtered.map(b => _renderBillCard(b)).join('');
}

function _markMeterBillPaid(billId) {
    updateMeterBill(billId, { status: 'paid', paidAt: new Date().toISOString() });
    showNotification('Bill marked as paid', 'success');
    _switchMeterTab('history');
}

function _deleteMeterBillConfirm(billId) {
    if (confirm('Delete this bill? This cannot be undone.')) {
        deleteMeterBill(billId);
        showNotification('Bill deleted', 'success');
        _switchMeterTab('history');
    }
}

// ══════════════════════════════════════════
// UI - FABRIC INVENTORY TAB
// ══════════════════════════════════════════

function _renderFabricsTab() {
    const fabrics = getFabricInventory();
    
    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <input type="text" id="fabricSearchInput" placeholder="Search fabrics..."
                onkeyup="_filterFabrics(this.value)"
                style="flex:1;max-width:300px;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:12px;">
            <button onclick="_openAddFabricForm()" style="padding:10px 16px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">+ Add Fabric</button>
        </div>
        
        <div id="fabricList">
            ${fabrics.length === 0 ? `
            <div style="text-align:center;padding:40px 0;font-family:'Space Mono',monospace;font-size:12px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:12px;opacity:0.3;">🧵</div>
                No fabrics added yet. Add your first fabric type!
            </div>
            ` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
                ${fabrics.map(f => _renderFabricCard(f)).join('')}
            </div>
            `}
        </div>
    `;
}

function _renderFabricCard(fabric) {
    const stockColor = fabric.stockMeters <= 5 ? '#ff6b6b' : fabric.stockMeters <= 20 ? '#ffd700' : '#00ff88';
    
    return `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;">
        <!-- Fabric Photo -->
        ${fabric.photo ? `
        <div style="width:100%;height:150px;border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid var(--border);">
            <img src="${fabric.photo}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        ` : `
        <div style="width:100%;height:150px;border-radius:8px;overflow:hidden;margin-bottom:10px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;background:var(--bg-primary);">
            <span style="font-size:40px;opacity:0.3;">🧵</span>
        </div>
        `}
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
                <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--text-light);">${esc(fabric.name)}</div>
                ${fabric.category ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-muted);">${esc(fabric.category)}</div>` : ''}
            </div>
            ${fabric.color ? `<div style="width:24px;height:24px;border-radius:6px;background:${fabric.color};border:1px solid var(--border);"></div>` : ''}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">RATE/METER</div>
                <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:var(--cyan);">₹${fabric.pricePerMeter}</div>
            </div>
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);">IN STOCK</div>
                <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${stockColor};">${fabric.stockMeters}m</div>
            </div>
        </div>
        
        <div style="display:flex;gap:6px;">
            <button onclick="_openAddFabricForm('${fabric.id}')" style="flex:1;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">✏️ Edit</button>
            <button onclick="_addFabricStock('${fabric.id}')" style="flex:1;padding:8px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:6px;color:#00ff88;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">+ Stock</button>
            <button onclick="_deleteFabricConfirm('${fabric.id}')" style="padding:8px;background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:6px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">🗑️</button>
        </div>
    </div>
    `;
}

function _filterFabrics(query) {
    const fabrics = getFabricInventory();
    const q = query.toLowerCase().trim();
    const filtered = q ? fabrics.filter(f =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q)
    ) : fabrics;
    
    document.getElementById('fabricList').innerHTML = filtered.length === 0 
        ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:\'Space Mono\',monospace;font-size:11px;">No fabrics found</div>'
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">${filtered.map(f => _renderFabricCard(f)).join('')}</div>`;
}

function _openAddFabricForm(editId = null) {
    const fabrics = getFabricInventory();
    const existing = editId ? fabrics.find(f => f.id === editId) : null;
    
    // Reset temporary state
    window._fabricPhotoBase64 = existing?.photo || null;
    window._fabricColors = existing?.colors ? [...existing.colors] : [];
    
    document.getElementById('addFabricFormModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'addFabricFormModal';
    modal.className = 'si-modal active';
    modal.style.zIndex = '100001';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:500px;max-height:90vh;overflow-y:auto;">
            <button class="si-modal-close" onclick="document.getElementById('addFabricFormModal').remove()">×</button>
            <h2 class="si-modal-title">${existing ? '✏️ Edit Fabric' : '🧵 Add New Fabric'}</h2>
            
            <!-- Photo Section -->
            <div class="form-group">
                <label>FABRIC PHOTO</label>
                <div style="display:flex;gap:10px;align-items:flex-start;">
                    <div id="fabricPhotoPreview" style="width:100px;height:100px;background:var(--bg-primary);border:2px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                        ${existing?.photo 
                            ? `<img src="${existing.photo}" style="width:100%;height:100%;object-fit:cover;">` 
                            : `<span style="font-size:28px;opacity:0.4;">🧵</span>`}
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                        <button type="button" onclick="_openFabricCamera()" style="padding:10px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            CAMERA
                        </button>
                        <button type="button" onclick="document.getElementById('fabricPhotoInput').click()" style="padding:10px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            UPLOAD
                        </button>
                        <input type="file" id="fabricPhotoInput" accept="image/*" onchange="_handleFabricPhotoUpload(event)" style="display:none;">
                        ${existing?.photo ? `<button type="button" onclick="_removeFabricPhoto()" style="padding:6px;background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);border-radius:6px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">Remove Photo</button>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>FABRIC NAME *</label>
                <input type="text" id="fabricName" placeholder="e.g. Cotton Print, Silk, Rayon..." value="${esc(existing?.name || '')}">
            </div>
            
            <div class="form-group">
                <label>CATEGORY</label>
                <input type="text" id="fabricCategory" placeholder="e.g. Cotton, Silk, Synthetic..." value="${esc(existing?.category || '')}">
            </div>
            
            <!-- Multiple Colors Section -->
            <div class="form-group">
                <label>COLOURS & STOCK PER COLOUR</label>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input type="text" id="fabricColorName" placeholder="Colour name" style="flex:2;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:11px;">
                    <input type="number" id="fabricColorStock" placeholder="Meters" min="0" step="0.5" style="width:70px;padding:8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);font-family:'Space Mono',monospace;font-size:11px;text-align:center;">
                    <button type="button" onclick="_addFabricColor()" style="padding:8px 12px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:6px;color:#00ff88;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">ADD</button>
                    <button type="button" onclick="_openFabricColorChart()" style="padding:8px 10px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:6px;color:#ffd700;font-family:'Space Mono',monospace;font-size:14px;cursor:pointer;" title="Open Colour Chart">🎨</button>
                </div>
                <div id="fabricColorsContainer" style="min-height:40px;">
                    ${_renderFabricColors()}
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group">
                    <label>PRICE PER METER (₹) *</label>
                    <input type="number" id="fabricPrice" placeholder="0" min="0" step="1" value="${existing?.pricePerMeter || ''}">
                </div>
                <div class="form-group">
                    <label>TOTAL STOCK (METERS)</label>
                    <input type="number" id="fabricStock" placeholder="Auto-calculated" min="0" step="0.5" value="${existing?.stockMeters || 0}" ${window._fabricColors.length > 0 ? 'readonly style="background:var(--bg-tertiary);cursor:not-allowed;"' : ''}>
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-top:4px;">${window._fabricColors.length > 0 ? 'Auto-calculated from colours' : 'Or add colours above'}</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>DESCRIPTION</label>
                <textarea id="fabricDescription" rows="2" placeholder="Optional description...">${esc(existing?.description || '')}</textarea>
            </div>
            
            <button onclick="_saveFabric(${existing ? `'${existing.id}'` : 'null'})" 
                style="width:100%;padding:12px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;margin-top:8px;">
                ${existing ? 'Update Fabric' : 'Add Fabric'}
            </button>
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Render fabric colors list
function _renderFabricColors() {
    if (!window._fabricColors || window._fabricColors.length === 0) {
        return `<div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);padding:10px;text-align:center;background:var(--bg-primary);border-radius:6px;">No colours added yet</div>`;
    }
    
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${window._fabricColors.map((c, idx) => {
            const swatch = _getFabricColorSwatch(c.name);
            return `<div style="display:flex;align-items:center;gap:6px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:6px 10px;">
                <span style="width:14px;height:14px;border-radius:50%;background:${swatch};display:inline-block;border:1px solid rgba(255,255,255,0.2);"></span>
                <span style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-light);">${esc(c.name)}</span>
                <span style="font-family:'Space Mono',monospace;font-size:10px;color:var(--cyan);">${c.stock}m</span>
                <button onclick="_removeFabricColor(${idx})" style="width:18px;height:18px;background:rgba(255,68,68,0.15);border:none;border-radius:4px;color:#ff6b6b;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;">×</button>
            </div>`;
        }).join('')}
    </div>`;
}

// Get color swatch from name
function _getFabricColorSwatch(colorName) {
    const colorMap = {
        'red': '#ef4444', 'light red': '#f9a8a8', 'salmon': '#f4a07a', 'coral': '#f07050', 'tomato': '#e85535', 'crimson': '#d02b45', 'cherry': '#b31832', 'maroon': '#802040', 'burgundy': '#6b1834',
        'orange': '#f97316', 'peach': '#f8c29a', 'apricot': '#f5b076', 'tangerine': '#f08040', 'rust': '#b04520', 'terracotta': '#cc5533', 'copper': '#a84420', 'burnt orange': '#c04820',
        'yellow': '#facc15', 'cream': '#f9f0c8', 'butter': '#f5e18a', 'lemon': '#f3d855', 'gold': '#d9a028', 'mustard': '#d19525', 'amber': '#bf7e18', 'bronze': '#9c6516',
        'green': '#22c55e', 'mint': '#a8e6cf', 'lime': '#98d955', 'pistachio': '#88cc45', 'olive': '#708238', 'sage': '#87a06a', 'forest': '#355025', 'emerald': '#208050', 'teal': '#207060', 'hunter': '#254a28',
        'blue': '#3b82f6', 'sky': '#a8d4f5', 'aqua': '#70c8dc', 'turquoise': '#40b8b0', 'ocean': '#2898b8', 'cerulean': '#2088b0', 'cobalt': '#1860a8', 'royal': '#2048a0', 'navy': '#102848', 'indigo': '#2e2070',
        'purple': '#a855f7', 'lavender': '#c8a8e8', 'lilac': '#b898d8', 'orchid': '#a068c0', 'violet': '#7848a8', 'plum': '#683890', 'grape': '#582078', 'eggplant': '#402858',
        'pink': '#ec4899', 'blush': '#f5c8d8', 'rose': '#e8a0b8', 'watermelon': '#e07088', 'hot pink': '#d84080', 'fuchsia': '#c03070', 'magenta': '#a03068', 'raspberry': '#882858',
        'brown': '#78350f', 'beige': '#e8d8c0', 'tan': '#d0b898', 'camel': '#c0a070', 'mocha': '#906848', 'chocolate': '#704028', 'coffee': '#583018', 'espresso': '#382010', 'walnut': '#503020',
        'grey': '#6b7280', 'gray': '#6b7280', 'white': '#f8f8f8', 'ivory': '#f0f0e8', 'silver': '#c0c0c0', 'ash': '#909090', 'charcoal': '#484848', 'slate': '#383838', 'black': '#101010',
        'multi': 'linear-gradient(135deg, #ff6b6b, #ffd700, #00ff88, #00d4ff, #a855f7)'
    };
    const lower = (colorName || '').toLowerCase().trim();
    return colorMap[lower] || '#6b7280';
}

// Add color to fabric
function _addFabricColor() {
    const nameInput = document.getElementById('fabricColorName');
    const stockInput = document.getElementById('fabricColorStock');
    const name = nameInput.value.trim();
    const stock = parseFloat(stockInput.value) || 0;
    
    if (!name) {
        showNotification('Please enter a colour name', 'warning');
        return;
    }
    
    // Check duplicate
    if (window._fabricColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`${name} already added`, 'warning');
        return;
    }
    
    window._fabricColors.push({ name, stock });
    nameInput.value = '';
    stockInput.value = '';
    
    _refreshFabricColorsUI();
    showNotification(`Added ${name}`, 'success');
}

// Remove color from fabric
function _removeFabricColor(idx) {
    window._fabricColors.splice(idx, 1);
    _refreshFabricColorsUI();
}

// Refresh colors UI
function _refreshFabricColorsUI() {
    const container = document.getElementById('fabricColorsContainer');
    if (container) {
        container.innerHTML = _renderFabricColors();
    }
    
    // Update total stock
    const stockInput = document.getElementById('fabricStock');
    if (stockInput && window._fabricColors.length > 0) {
        const totalStock = window._fabricColors.reduce((sum, c) => sum + (c.stock || 0), 0);
        stockInput.value = totalStock;
        stockInput.readOnly = true;
        stockInput.style.background = 'var(--bg-tertiary)';
        stockInput.style.cursor = 'not-allowed';
    } else if (stockInput) {
        stockInput.readOnly = false;
        stockInput.style.background = '';
        stockInput.style.cursor = '';
    }
}

// Open fabric color chart (uses app's color chart)
function _openFabricColorChart() {
    const chart = _getFabricColorChartData();
    
    document.getElementById('fabricColorChartModal')?.remove();
    
    const groupsHtml = chart.map(group => `
        <div style="margin-bottom:1rem;">
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);letter-spacing:0.06em;margin-bottom:0.45rem;">${group.group.toUpperCase()}</div>
            <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;">
                ${group.colors.map(c => `
                    <div onclick="_selectFabricColorFromChart('${c.name}','${c.hex}')"
                        title="${c.name}"
                        style="cursor:pointer;border-radius:6px;aspect-ratio:1;background:${c.hex};border:2px solid transparent;transition:transform 0.1s,border-color 0.1s;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                        onmouseover="this.style.transform='scale(1.18)';this.style.borderColor='white';this.style.zIndex=2;this.style.position='relative';"
                        onmouseout="this.style.transform='scale(1)';this.style.borderColor='transparent';this.style.zIndex=0;">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    const modal = document.createElement('div');
    modal.id = 'fabricColorChartModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100002;display:flex;align-items:flex-end;justify-content:center;padding:0;';
    modal.innerHTML = `
        <div style="background:var(--bg-primary);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:82vh;overflow-y:auto;padding:1.25rem 1.25rem 2rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;position:sticky;top:0;background:var(--bg-primary);padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                <div>
                    <div style="font-weight:700;font-size:1rem;color:var(--text-light);">🎨 Colour Chart</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">Tap a colour to add it</div>
                </div>
                <button onclick="document.getElementById('fabricColorChartModal').remove()" style="background:var(--bg-secondary);border:none;color:var(--text-muted);border-radius:8px;padding:0.4rem 0.65rem;cursor:pointer;font-size:1rem;">✕</button>
            </div>
            ${groupsHtml}
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Select color from chart
function _selectFabricColorFromChart(name, hex) {
    // Check duplicate
    if (window._fabricColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`${name} already added`, 'warning');
        return;
    }
    
    // Prompt for stock
    const stockStr = prompt(`Enter stock in meters for "${name}":`, '0');
    if (stockStr === null) return;
    
    const stock = parseFloat(stockStr) || 0;
    window._fabricColors.push({ name, stock, hex });
    
    _refreshFabricColorsUI();
    showNotification(`Added ${name} (${stock}m)`, 'success');
}

// Color chart data
function _getFabricColorChartData() {
    return [
        { group: 'Red', colors: [
            { name: 'Light Red', hex: '#f9a8a8' }, { name: 'Salmon', hex: '#f4a07a' }, { name: 'Coral', hex: '#f07050' },
            { name: 'Tomato', hex: '#e85535' }, { name: 'Crimson', hex: '#d02b45' }, { name: 'Cherry', hex: '#b31832' },
            { name: 'Maroon', hex: '#802040' }, { name: 'Burgundy', hex: '#6b1834' }
        ]},
        { group: 'Orange', colors: [
            { name: 'Peach', hex: '#f8c29a' }, { name: 'Apricot', hex: '#f5b076' }, { name: 'Tangerine', hex: '#f08040' },
            { name: 'Orange', hex: '#f06020' }, { name: 'Rust', hex: '#b04520' }, { name: 'Terracotta', hex: '#cc5533' },
            { name: 'Copper', hex: '#a84420' }, { name: 'Burnt Orange', hex: '#c04820' }
        ]},
        { group: 'Yellow', colors: [
            { name: 'Cream', hex: '#f9f0c8' }, { name: 'Butter', hex: '#f5e18a' }, { name: 'Lemon', hex: '#f3d855' },
            { name: 'Yellow', hex: '#f0c825' }, { name: 'Gold', hex: '#d9a028' }, { name: 'Mustard', hex: '#d19525' },
            { name: 'Amber', hex: '#bf7e18' }, { name: 'Bronze', hex: '#9c6516' }
        ]},
        { group: 'Green', colors: [
            { name: 'Mint', hex: '#a8e6cf' }, { name: 'Lime', hex: '#98d955' }, { name: 'Pistachio', hex: '#88cc45' },
            { name: 'Green', hex: '#50b848' }, { name: 'Olive', hex: '#708238' }, { name: 'Sage', hex: '#87a06a' },
            { name: 'Forest', hex: '#355025' }, { name: 'Emerald', hex: '#208050' }
        ]},
        { group: 'Blue', colors: [
            { name: 'Sky', hex: '#a8d4f5' }, { name: 'Aqua', hex: '#70c8dc' }, { name: 'Turquoise', hex: '#40b8b0' },
            { name: 'Ocean', hex: '#2898b8' }, { name: 'Cerulean', hex: '#2088b0' }, { name: 'Cobalt', hex: '#1860a8' },
            { name: 'Royal', hex: '#2048a0' }, { name: 'Navy', hex: '#102848' }
        ]},
        { group: 'Purple', colors: [
            { name: 'Lavender', hex: '#c8a8e8' }, { name: 'Lilac', hex: '#b898d8' }, { name: 'Orchid', hex: '#a068c0' },
            { name: 'Violet', hex: '#7848a8' }, { name: 'Plum', hex: '#683890' }, { name: 'Grape', hex: '#582078' },
            { name: 'Purple', hex: '#502868' }, { name: 'Eggplant', hex: '#402858' }
        ]},
        { group: 'Pink', colors: [
            { name: 'Blush', hex: '#f5c8d8' }, { name: 'Rose', hex: '#e8a0b8' }, { name: 'Pink', hex: '#e07898' },
            { name: 'Watermelon', hex: '#e07088' }, { name: 'Hot Pink', hex: '#d84080' }, { name: 'Fuchsia', hex: '#c03070' },
            { name: 'Magenta', hex: '#a03068' }, { name: 'Raspberry', hex: '#882858' }
        ]},
        { group: 'Brown', colors: [
            { name: 'Beige', hex: '#e8d8c0' }, { name: 'Tan', hex: '#d0b898' }, { name: 'Camel', hex: '#c0a070' },
            { name: 'Mocha', hex: '#906848' }, { name: 'Brown', hex: '#785038' }, { name: 'Chocolate', hex: '#704028' },
            { name: 'Coffee', hex: '#583018' }, { name: 'Walnut', hex: '#503020' }
        ]},
        { group: 'Neutral', colors: [
            { name: 'White', hex: '#f8f8f8' }, { name: 'Ivory', hex: '#f0f0e8' }, { name: 'Silver', hex: '#c0c0c0' },
            { name: 'Grey', hex: '#909090' }, { name: 'Ash', hex: '#707070' }, { name: 'Charcoal', hex: '#484848' },
            { name: 'Slate', hex: '#383838' }, { name: 'Black', hex: '#101010' }
        ]}
    ];
}

// Camera functionality for fabric photos
function _openFabricCamera() {
    document.getElementById('fabricCameraModal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'fabricCameraModal';
    modal.className = 'si-modal active';
    modal.style.zIndex = '100002';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:500px;padding:0;overflow:hidden;">
            <div style="position:relative;background:#000;">
                <video id="fabricCameraFeed" autoplay playsinline style="width:100%;max-height:60vh;display:block;"></video>
                <canvas id="fabricPhotoCanvas" style="display:none;"></canvas>
                <button onclick="_closeFabricCamera()" style="position:absolute;top:10px;right:10px;width:36px;height:36px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;color:white;font-size:18px;cursor:pointer;">×</button>
            </div>
            <div style="padding:16px;background:var(--bg-primary);display:flex;justify-content:center;gap:12px;">
                <button id="fabricCaptureBtn" onclick="_captureFabricPhoto()" style="padding:14px 28px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                    CAPTURE
                </button>
                <button id="fabricRetakeBtn" onclick="_retakeFabricPhoto()" style="display:none;padding:14px 28px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;">
                    RETAKE
                </button>
                <button id="fabricUseBtn" onclick="_useFabricPhoto()" style="display:none;padding:14px 28px;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);border-radius:10px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">
                    USE PHOTO
                </button>
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    
    // Start camera
    const video = document.getElementById('fabricCameraFeed');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(stream => {
            window._fabricCameraStream = stream;
            video.srcObject = stream;
        })
        .catch(err => {
            showNotification('Camera access denied. Use Upload instead.', 'warning');
            modal.remove();
        });
}

function _captureFabricPhoto() {
    const video = document.getElementById('fabricCameraFeed');
    const canvas = document.getElementById('fabricPhotoCanvas');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // Show captured image
    video.style.display = 'none';
    canvas.style.display = 'block';
    
    // Toggle buttons
    document.getElementById('fabricCaptureBtn').style.display = 'none';
    document.getElementById('fabricRetakeBtn').style.display = 'inline-flex';
    document.getElementById('fabricUseBtn').style.display = 'inline-flex';
    
    showNotification('Photo captured!', 'success');
}

function _retakeFabricPhoto() {
    const video = document.getElementById('fabricCameraFeed');
    const canvas = document.getElementById('fabricPhotoCanvas');
    
    video.style.display = 'block';
    canvas.style.display = 'none';
    
    document.getElementById('fabricCaptureBtn').style.display = 'inline-flex';
    document.getElementById('fabricRetakeBtn').style.display = 'none';
    document.getElementById('fabricUseBtn').style.display = 'none';
}

function _useFabricPhoto() {
    const canvas = document.getElementById('fabricPhotoCanvas');
    window._fabricPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
    
    // Update preview
    const preview = document.getElementById('fabricPhotoPreview');
    if (preview) {
        preview.innerHTML = `<img src="${window._fabricPhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
    }
    
    _closeFabricCamera();
    showNotification('Photo saved!', 'success');
}

function _closeFabricCamera() {
    if (window._fabricCameraStream) {
        window._fabricCameraStream.getTracks().forEach(t => t.stop());
        window._fabricCameraStream = null;
    }
    document.getElementById('fabricCameraModal')?.remove();
}

function _handleFabricPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        window._fabricPhotoBase64 = e.target.result;
        const preview = document.getElementById('fabricPhotoPreview');
        if (preview) {
            preview.innerHTML = `<img src="${window._fabricPhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        showNotification('Photo uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function _removeFabricPhoto() {
    window._fabricPhotoBase64 = null;
    const preview = document.getElementById('fabricPhotoPreview');
    if (preview) {
        preview.innerHTML = `<span style="font-size:28px;opacity:0.4;">🧵</span>`;
    }
}

function _saveFabric(editId) {
    const name = document.getElementById('fabricName').value.trim();
    const category = document.getElementById('fabricCategory').value.trim();
    const pricePerMeter = parseFloat(document.getElementById('fabricPrice').value) || 0;
    const stockMeters = parseFloat(document.getElementById('fabricStock').value) || 0;
    const description = document.getElementById('fabricDescription').value.trim();
    const photo = window._fabricPhotoBase64 || null;
    const colors = window._fabricColors || [];
    
    if (!name) {
        showNotification('Please enter fabric name', 'error');
        return;
    }
    if (pricePerMeter <= 0) {
        showNotification('Please enter price per meter', 'error');
        return;
    }
    
    const fabricData = { 
        name, 
        category, 
        pricePerMeter, 
        stockMeters, 
        description, 
        photo,
        colors 
    };
    
    if (editId) {
        updateFabric(editId, fabricData);
        showNotification('Fabric updated', 'success');
    } else {
        addFabric(fabricData);
        showNotification('Fabric added', 'success');
    }
    
    // Clear temporary state
    window._fabricPhotoBase64 = null;
    window._fabricColors = [];
    
    document.getElementById('addFabricFormModal').remove();
    _switchMeterTab('fabrics');
}

function _addFabricStock(fabricId) {
    const meters = prompt('Enter meters to add to stock:');
    if (meters && !isNaN(parseFloat(meters))) {
        const fabrics = getFabricInventory();
        const fabric = fabrics.find(f => f.id === fabricId);
        if (fabric) {
            updateFabric(fabricId, { stockMeters: (fabric.stockMeters || 0) + parseFloat(meters) });
            showNotification(`Added ${meters}m to ${fabric.name}`, 'success');
            _switchMeterTab('fabrics');
        }
    }
}

function _deleteFabricConfirm(fabricId) {
    if (confirm('Delete this fabric? This cannot be undone.')) {
        deleteFabric(fabricId);
        showNotification('Fabric deleted', 'success');
        _switchMeterTab('fabrics');
    }
}

// ══════════════════════════════════════════
// PRINT & SHARE
// ══════════════════════════════════════════

function _printMeterBill(bill) {
    if (!bill) return;
    
    const shopInfo = typeof storage !== 'undefined' ? storage.getProfile() : {};
    const date = new Date(bill.createdAt);
    
    const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Invoice ${bill.invoiceNo}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .shop-name { font-size: 16px; font-weight: bold; }
            .info-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
            .item { margin: 6px 0; }
            .item-name { font-weight: bold; }
            .item-details { display: flex; justify-content: space-between; font-size: 11px; color: #555; }
            .totals { margin-top: 10px; }
            .grand-total { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
            .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
            @media print { body { padding: 0; } }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="shop-name">${esc(shopInfo.shopName || 'SHOP INVENTORY')}</div>
            ${shopInfo.address ? `<div>${esc(shopInfo.address)}</div>` : ''}
            ${shopInfo.phone ? `<div>Ph: ${esc(shopInfo.phone)}</div>` : ''}
            ${shopInfo.gstin ? `<div>GSTIN: ${esc(shopInfo.gstin)}</div>` : ''}
        </div>
        
        <div class="info-row"><span>Invoice:</span><span>${bill.invoiceNo}</span></div>
        <div class="info-row"><span>Date:</span><span>${date.toLocaleDateString('en-IN')}</span></div>
        <div class="info-row"><span>Time:</span><span>${date.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</span></div>
        ${bill.customer ? `<div class="info-row"><span>Customer:</span><span>${esc(bill.customer.name)}</span></div>` : ''}
        
        <div class="items">
            ${bill.items.map(item => `
            <div class="item">
                <div class="item-name">${esc(item.fabricName)}</div>
                <div class="item-details">
                    <span>${item.meters}m × ₹${item.rate}</span>
                    <span>₹${item.total.toFixed(0)}</span>
                </div>
            </div>
            `).join('')}
        </div>
        
        <div class="totals">
            <div class="info-row"><span>Total Meters:</span><span>${bill.totalMeters.toFixed(2)}m</span></div>
            <div class="info-row"><span>Subtotal:</span><span>₹${bill.subtotal.toFixed(0)}</span></div>
            ${bill.discountAmount > 0 ? `<div class="info-row"><span>Discount (${bill.discountPercent}%):</span><span>-₹${bill.discountAmount.toFixed(0)}</span></div>` : ''}
            ${bill.gstAmount > 0 ? `<div class="info-row"><span>GST (${bill.gstPercent}%):</span><span>₹${bill.gstAmount.toFixed(0)}</span></div>` : ''}
            <div class="info-row grand-total"><span>GRAND TOTAL:</span><span>₹${bill.grandTotal.toFixed(0)}</span></div>
            <div class="info-row"><span>Payment:</span><span>${bill.paymentMethod.toUpperCase()}</span></div>
        </div>
        
        <div class="footer">
            Thank you for your purchase!<br>
            Visit again!
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

function _shareMeterBillWhatsApp(billId) {
    const bills = getMeterBills();
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const shopInfo = typeof storage !== 'undefined' ? storage.getProfile() : {};
    const date = new Date(bill.createdAt);
    
    let message = `*${shopInfo.shopName || 'SHOP INVENTORY'}*\n`;
    message += `Invoice: ${bill.invoiceNo}\n`;
    message += `Date: ${date.toLocaleDateString('en-IN')}\n`;
    if (bill.customer) message += `Customer: ${bill.customer.name}\n`;
    message += `\n*ITEMS:*\n`;
    
    bill.items.forEach(item => {
        message += `• ${item.fabricName}: ${item.meters}m × ₹${item.rate} = ₹${item.total.toFixed(0)}\n`;
    });
    
    message += `\n*Total Meters:* ${bill.totalMeters.toFixed(2)}m\n`;
    message += `*Subtotal:* ₹${bill.subtotal.toFixed(0)}\n`;
    if (bill.discountAmount > 0) message += `Discount: -₹${bill.discountAmount.toFixed(0)}\n`;
    if (bill.gstAmount > 0) message += `GST: ₹${bill.gstAmount.toFixed(0)}\n`;
    message += `\n*GRAND TOTAL: ₹${bill.grandTotal.toFixed(0)}*\n`;
    message += `Payment: ${bill.paymentMethod.toUpperCase()}\n`;
    message += `\nThank you for your purchase!`;
    
    const phone = bill.customer?.phone || '';
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ══════════════════════════════════════════
// QUICK CUSTOMER ADD
// ══════════════════════════════════════════

function _openQuickCustomerAdd() {
    document.getElementById('quickCustomerModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'quickCustomerModal';
    modal.className = 'si-modal active';
    modal.style.zIndex = '100001';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:350px;">
            <button class="si-modal-close" onclick="document.getElementById('quickCustomerModal').remove()">×</button>
            <h2 class="si-modal-title">👤 Quick Add Customer</h2>
            
            <div class="form-group">
                <label>NAME *</label>
                <input type="text" id="quickCustomerName" placeholder="Customer name">
            </div>
            
            <div class="form-group">
                <label>PHONE</label>
                <input type="tel" id="quickCustomerPhone" placeholder="Mobile number">
            </div>
            
            <button onclick="_saveQuickCustomer()" style="width:100%;padding:12px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">
                Add Customer
            </button>
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _saveQuickCustomer() {
    const name = document.getElementById('quickCustomerName').value.trim();
    const phone = document.getElementById('quickCustomerPhone').value.trim();
    
    if (!name) {
        showNotification('Please enter customer name', 'error');
        return;
    }
    
    if (typeof addCustomer === 'function') {
        const customer = addCustomer({ name, phone });
        meterBillCustomer = customer;
        showNotification('Customer added', 'success');
        document.getElementById('quickCustomerModal').remove();
        _refreshNewBillTab();
    } else {
        showNotification('Customer ledger not available', 'error');
    }
}

// Make functions globally available
window.openMeterBilling = openMeterBilling;
window.getMeterBills = getMeterBills;
window._switchMeterTab = _switchMeterTab;
window._selectMeterCustomer = _selectMeterCustomer;
window._onFabricSelect = _onFabricSelect;
window._calculateItemTotal = _calculateItemTotal;
window._addToMeterCart = _addToMeterCart;
window._removeFromMeterCart = _removeFromMeterCart;
window._updateMeterTotals = _updateMeterTotals;
window._saveMeterBill = _saveMeterBill;
window._saveMeterBillAndPrint = _saveMeterBillAndPrint;
window._filterMeterBills = _filterMeterBills;
window._markMeterBillPaid = _markMeterBillPaid;
window._deleteMeterBillConfirm = _deleteMeterBillConfirm;
window._filterFabrics = _filterFabrics;
window._openAddFabricForm = _openAddFabricForm;
window._saveFabric = _saveFabric;
window._addFabricStock = _addFabricStock;
window._deleteFabricConfirm = _deleteFabricConfirm;
window._printMeterBill = _printMeterBill;
window._shareMeterBillWhatsApp = _shareMeterBillWhatsApp;
window._openQuickCustomerAdd = _openQuickCustomerAdd;
window._saveQuickCustomer = _saveQuickCustomer;

console.log('📏 Meter Billing module loaded - Fabric sales by meter');
