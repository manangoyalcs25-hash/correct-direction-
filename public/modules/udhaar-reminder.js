// modules/udhaar-reminder.js — Hindu Udhaar (Credit) Reminder Module
// Tracks outstanding credits and displays reminders

console.log('[ShopInventory] Udhaar Reminder module loaded');

// Safe escape function if not defined globally
if (typeof esc === 'undefined') {
    window.esc = function(str) {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    };
}

class UdhaarReminder {
    constructor() {
        this.storageKey = 'udhaarRecords';
        this.reminderKey = 'udhaarReminders';
    }

    // Load all udhaar records
    loadUdhaarRecords() {
        const activeProfile = localStorage.getItem('activeProfile');
        if (!activeProfile) return [];
        
        const allRecords = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        return allRecords[activeProfile] || [];
    }

    // Save udhaar records
    saveUdhaarRecords(records) {
        const activeProfile = localStorage.getItem('activeProfile');
        if (!activeProfile) return;

        const allRecords = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        allRecords[activeProfile] = records;
        localStorage.setItem(this.storageKey, JSON.stringify(allRecords));
        
        this.updateUdhaarDisplay();
        this.notifyUdhaarUpdates();
    }

    // Add new udhaar record
    addUdhaarRecord(sourceCustomer, amount, dateReceived, dueDate, notes = '') {
        const records = this.loadUdhaarRecords();
        
        const newRecord = {
            id: 'udhaar_' + Date.now(),
            sourceCustomer: esc(sourceCustomer),  // Who gave the money
            amount: parseFloat(amount),
            dateReceived: dateReceived,           // When received
            dueDate: dueDate,                      // When to return
            createdAt: new Date().toISOString(),
            status: 'outstanding',
            notes: esc(notes)
        };

        records.push(newRecord);
        this.saveUdhaarRecords(records);
        
        // Refresh the ledger modal if it's open
        this.refreshLedgerModal();
        
        return newRecord;
    }

    // Mark udhaar as settled
    settleUdhaar(recordId) {
        const records = this.loadUdhaarRecords();
        const record = records.find(r => r.id === recordId);
        
        if (record) {
            record.status = 'settled';
            record.settledAt = new Date().toISOString();
            this.saveUdhaarRecords(records);
            
            // Refresh the ledger modal if it's open
            this.refreshLedgerModal();
        }
    }

    // Delete udhaar record
    deleteUdhaar(recordId) {
        const records = this.loadUdhaarRecords();
        const filtered = records.filter(r => r.id !== recordId);
        this.saveUdhaarRecords(filtered);
        
        // Refresh the ledger modal if it's open
        this.refreshLedgerModal();
    }

    // Refresh the ledger modal if it's open
    refreshLedgerModal() {
        const modal = document.getElementById('udhaarLedgerModal');
        if (modal) {
            // Remove old modal
            modal.remove();
            // Show updated modal
            this.showUdhaarLedger();
        }
    }

    // Update the display
    updateUdhaarDisplay() {
        const records = this.loadUdhaarRecords();
        const outstandingRecords = records.filter(r => r.status === 'outstanding');
        const udhaarList = document.getElementById('udhaarList');

        if (!udhaarList) return;

        if (outstandingRecords.length === 0) {
            udhaarList.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;font-family:var(--mono);">No outstanding credit</div>';
            return;
        }

        const totalAmount = outstandingRecords.reduce((sum, r) => sum + r.amount, 0);

        const html = outstandingRecords.map(record => {
            const receivedDate = new Date(record.dateReceived);
            const dueDate = new Date(record.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today;
            const daysHeld = Math.floor((today - receivedDate) / (1000 * 60 * 60 * 24));
            
            return `
                <div style="background:var(--panel);border-left:3px solid ${isOverdue ? 'var(--fire)' : 'var(--neon2)'};border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:start;gap:10px;font-size:11px;font-family:var(--mono);">
                    <div style="flex:1;min-width:0;">
                        <div style="color:var(--neon);font-weight:600;word-break:break-word;">From: ${record.sourceCustomer}</div>
                        <div style="color:var(--ink);font-weight:600;margin-top:4px;">₹${record.amount.toFixed(2)}</div>
                        <div style="color:var(--muted);margin-top:4px;font-size:10px;">
                            📥 Received: ${receivedDate.toLocaleDateString()} (${daysHeld} days ago)
                        </div>
                        <div style="color:${isOverdue ? 'var(--fire)' : 'var(--neon2)'};margin-top:3px;font-size:10px;">
                            ${isOverdue ? '⚠️ Overdue: ' : '📅 Return by: '}${dueDate.toLocaleDateString()}
                        </div>
                        ${record.notes ? `<div style="color:var(--muted);margin-top:4px;font-style:italic;font-size:10px;">"${record.notes}"</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button onclick="if(window.udhaarReminder) window.udhaarReminder.settleUdhaar('${record.id}')" 
                            title="Mark as returned" style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--neon);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;transition:all 0.2s;">
                            ✓
                        </button>
                        <button onclick="if(window.udhaarReminder) window.udhaarReminder.deleteUdhaar('${record.id}')" 
                            title="Delete record" style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:var(--fire);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;transition:all 0.2s;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        udhaarList.innerHTML = html + `
            <div style="background:var(--panel);border:1px solid rgba(0,212,255,0.3);border-radius:8px;padding:12px;font-family:var(--mono);font-size:11px;color:var(--neon2);font-weight:600;text-align:right;">
                Total Outstanding: ₹${totalAmount.toFixed(2)}
            </div>
        `;
    }

    // Show form to add udhaar record
    showAddUdhaarForm() {
        const modal = document.createElement('div');
        modal.id = 'udhaarFormModal';
        modal.style.cssText = `
            position:fixed;top:0;left:0;right:0;bottom:0;
            background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;
            backdrop-filter:blur(4px);
        `;

        modal.innerHTML = `
            <div style="background:var(--surface);border:1px solid var(--rim);border-radius:14px;padding:28px;width:90%;max-width:450px;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:85vh;overflow-y:auto;">
                <div style="font-family:var(--mono);font-size:13px;color:var(--ink);font-weight:700;margin-bottom:20px;">📥 Add Udhaar Record (Credit Received)</div>
                
                <form onsubmit="event.preventDefault(); if(window.udhaarReminder) window.udhaarReminder.submitUdhaarForm();" id="udhaarForm">
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-family:var(--mono);font-size:11px;color:var(--neon2);margin-bottom:6px;">💰 Source/Who Gave Money? *</label>
                        <input type="text" id="udhaarSource" placeholder="Enter customer/person name" 
                            style="width:100%;background:var(--panel);border:1px solid var(--faint);color:var(--ink);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box;" required>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-family:var(--mono);font-size:11px;color:var(--gold);margin-bottom:6px;">💵 Amount (₹) *</label>
                        <input type="number" id="udhaarAmount" placeholder="0.00" min="0" step="0.01"
                            style="width:100%;background:var(--panel);border:1px solid var(--faint);color:var(--ink);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box;" required>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-family:var(--mono);font-size:11px;color:var(--neon);margin-bottom:6px;">📥 Date Received *</label>
                        <input type="date" id="udhaarDateReceived"
                            style="width:100%;background:var(--panel);border:1px solid var(--faint);color:var(--ink);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box;" required>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-family:var(--mono);font-size:11px;color:var(--fire);margin-bottom:6px;">📅 Return/Due Date *</label>
                        <input type="date" id="udhaarDueDate"
                            style="width:100%;background:var(--panel);border:1px solid var(--faint);color:var(--ink);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box;" required>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block;font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:6px;">📝 Notes (Optional)</label>
                        <textarea id="udhaarNotes" placeholder="Add any notes (e.g., purpose, payment method)..."
                            style="width:100%;background:var(--panel);border:1px solid var(--faint);color:var(--ink);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box;resize:vertical;min-height:60px;"></textarea>
                    </div>

                    <div style="display:flex;gap:12px;">
                        <button type="submit" style="flex:1;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--neon);border-radius:8px;padding:12px;cursor:pointer;font-family:var(--mono);font-size:12px;font-weight:600;transition:all 0.2s;">
                            Save Record
                        </button>
                        <button type="button" onclick="document.getElementById('udhaarFormModal').remove();" 
                            style="flex:1;background:var(--panel);border:1px solid var(--faint);color:var(--muted);border-radius:8px;padding:12px;cursor:pointer;font-family:var(--mono);font-size:12px;transition:all 0.2s;">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Set today's date as default for date received
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('udhaarDateReceived').value = today;
        document.getElementById('udhaarSource').focus();
    }

    // Submit udhaar form
    submitUdhaarForm() {
        const source = document.getElementById('udhaarSource').value.trim();
        const amount = document.getElementById('udhaarAmount').value.trim();
        const dateReceived = document.getElementById('udhaarDateReceived').value.trim();
        const dueDate = document.getElementById('udhaarDueDate').value.trim();
        const notes = document.getElementById('udhaarNotes').value.trim();

        if (!source || !amount || !dateReceived || !dueDate) {
            alert('Please fill in all required fields');
            return;
        }

        if (new Date(dateReceived) > new Date(dueDate)) {
            alert('Due date must be after or same as received date');
            return;
        }

        this.addUdhaarRecord(source, amount, dateReceived, dueDate, notes);
        
        // Close the form modal
        const formModal = document.getElementById('udhaarFormModal');
        if (formModal) {
            formModal.remove();
        }
        
        // Show success message
        console.log('[Udhaar] Record added successfully');
    }

    // Notify about udhaar updates
    notifyUdhaarUpdates() {
        const records = this.loadUdhaarRecords();
        const outstandingRecords = records.filter(r => r.status === 'outstanding');
        const overdueRecords = outstandingRecords.filter(r => new Date(r.dueDate) < new Date());

        // Update dashboard title badge if exists
        if (window.app && window.app.updateDashboard) {
            // This allows integration with dashboard notifications
        }

        // Log for debugging
        if (overdueRecords.length > 0) {
            console.warn(`[Udhaar] ${overdueRecords.length} overdue payment(s) found`);
        }
    }

    // Get summary for dashboard
    getUdhaarSummary() {
        const records = this.loadUdhaarRecords();
        const outstanding = records.filter(r => r.status === 'outstanding');
        const overdue = outstanding.filter(r => new Date(r.dueDate) < new Date());

        return {
            totalOutstanding: outstanding.reduce((sum, r) => sum + r.amount, 0),
            outstandingCount: outstanding.length,
            overdueCount: overdue.length,
            overdueAmount: overdue.reduce((sum, r) => sum + r.amount, 0)
        };
    }

    // Show detailed Udhaar Ledger
    showUdhaarLedger() {
        const records = this.loadUdhaarRecords();
        const outstanding = records.filter(r => r.status === 'outstanding');
        const settled = records.filter(r => r.status === 'settled');

        const modal = document.createElement('div');
        modal.id = 'udhaarLedgerModal';
        modal.style.cssText = `
            position:fixed;top:0;left:0;right:0;bottom:0;
            background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;
            backdrop-filter:blur(4px);
        `;

        const totalOutstanding = outstanding.reduce((sum, r) => sum + r.amount, 0);
        const totalSettled = settled.reduce((sum, r) => sum + r.amount, 0);

        const outstandingHTML = outstanding.length === 0 
            ? '<div style="text-align:center;color:var(--muted);padding:20px;font-family:var(--mono);font-size:12px;">✓ No outstanding records</div>'
            : outstanding.map(record => {
                const receivedDate = new Date(record.dateReceived);
                const dueDate = new Date(record.dueDate);
                const today = new Date();
                const isOverdue = dueDate < today;
                const daysHeld = Math.floor((today - receivedDate) / (1000 * 60 * 60 * 24));
                
                return `
                    <div style="background:var(--panel);border-left:4px solid ${isOverdue ? 'var(--fire)' : 'var(--neon2)'};border-radius:8px;padding:14px;margin-bottom:12px;font-family:var(--mono);font-size:11px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">
                            <div>
                                <div style="color:var(--muted);font-size:10px;margin-bottom:4px;">FROM (Source)</div>
                                <div style="color:var(--neon2);font-weight:600;word-break:break-word;">${record.sourceCustomer}</div>
                            </div>
                            <div>
                                <div style="color:var(--muted);font-size:10px;margin-bottom:4px;">AMOUNT</div>
                                <div style="color:var(--gold);font-weight:600;font-size:13px;">₹${record.amount.toFixed(2)}</div>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">
                            <div>
                                <div style="color:var(--muted);font-size:10px;margin-bottom:4px;">📥 RECEIVED</div>
                                <div style="color:var(--ink);">${receivedDate.toLocaleDateString()}</div>
                                <div style="color:var(--muted);font-size:10px;margin-top:2px;">${daysHeld} days held</div>
                            </div>
                            <div>
                                <div style="color:var(--muted);font-size:10px;margin-bottom:4px;">📅 DUE DATE</div>
                                <div style="color:${isOverdue ? 'var(--fire)' : 'var(--neon2)'};">${dueDate.toLocaleDateString()}</div>
                                ${isOverdue ? `<div style="color:var(--fire);font-size:10px;margin-top:2px;font-weight:600;">⚠️ OVERDUE</div>` : ''}
                            </div>
                        </div>
                        ${record.notes ? `<div style="background:rgba(0,255,136,0.05);border-left:2px solid var(--neon);padding:8px 10px;border-radius:4px;margin-bottom:10px;color:var(--ink);font-size:10px;"><strong>Note:</strong> ${record.notes}</div>` : ''}
                        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--faint);">
                            <button onclick="if(window.udhaarReminder) window.udhaarReminder.settleUdhaar('${record.id}')" 
                                style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--neon);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--mono);font-size:10px;transition:all 0.2s;">
                                ✓ Mark Returned
                            </button>
                            <button onclick="if(window.udhaarReminder) window.udhaarReminder.deleteUdhaar('${record.id}')" 
                                style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:var(--fire);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--mono);font-size:10px;transition:all 0.2s;">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

        const settledHTML = settled.length === 0 
            ? ''
            : `
                <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--rim);">
                    <div style="color:var(--neon);font-family:var(--mono);font-size:12px;font-weight:600;margin-bottom:16px;">📋 Settled Records (${settled.length})</div>
                    ${settled.map(record => {
                        const receivedDate = new Date(record.dateReceived);
                        const settledDate = new Date(record.settledAt);
                        
                        return `
                            <div style="background:var(--panel);border-left:4px solid var(--neon);border-radius:8px;padding:12px;margin-bottom:10px;font-family:var(--mono);font-size:10px;opacity:0.7;">
                                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                                    <div>
                                        <div style="color:var(--muted);font-size:9px;margin-bottom:3px;">FROM</div>
                                        <div style="color:var(--ink);">${record.sourceCustomer}</div>
                                    </div>
                                    <div>
                                        <div style="color:var(--muted);font-size:9px;margin-bottom:3px;">AMOUNT</div>
                                        <div style="color:var(--gold);">₹${record.amount.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div style="color:var(--muted);font-size:9px;margin-bottom:3px;">✓ RETURNED</div>
                                        <div style="color:var(--neon);">${settledDate.toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

        modal.innerHTML = `
            <div style="background:var(--surface);border:1px solid var(--rim);border-radius:14px;padding:28px;width:90%;max-width:700px;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:80vh;overflow-y:auto;display:flex;flex-direction:column;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                    <div style="font-family:var(--mono);font-size:14px;color:var(--ink);font-weight:700;">📊 Udhaar Ledger</div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="if(window.udhaarReminder) window.udhaarReminder.showAddUdhaarForm()" 
                            style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--neon);border-radius:6px;padding:6px 10px;cursor:pointer;font-family:var(--mono);font-size:11px;white-space:nowrap;">
                            + Add Record
                        </button>
                        <button onclick="document.getElementById('udhaarLedgerModal').remove();" 
                            style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:var(--fire);border-radius:6px;padding:6px 10px;cursor:pointer;font-family:var(--mono);font-size:11px;">
                            ✕ Close
                        </button>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
                    <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.3);border-radius:8px;padding:14px;">
                        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:6px;">OUTSTANDING</div>
                        <div style="color:var(--neon);font-family:var(--mono);font-size:16px;font-weight:700;">₹${totalOutstanding.toFixed(2)}</div>
                        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:4px;">${outstanding.length} record(s)</div>
                    </div>
                    <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.3);border-radius:8px;padding:14px;">
                        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:6px;">SETTLED</div>
                        <div style="color:var(--neon);font-family:var(--mono);font-size:16px;font-weight:700;">₹${totalSettled.toFixed(2)}</div>
                        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:4px;">${settled.length} record(s)</div>
                    </div>
                </div>

                <div style="color:var(--gold);font-family:var(--mono);font-size:12px;font-weight:600;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--faint);">📥 Outstanding Records (${outstanding.length})</div>
                ${outstandingHTML}
                ${settledHTML}
            </div>
        `;

        document.body.appendChild(modal);
    }
}

// Initialize Udhaar Reminder when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.udhaarReminder) {
            window.udhaarReminder = new UdhaarReminder();
            console.log('[ShopInventory] Udhaar Reminder initialized successfully');
        }
    } catch (error) {
        console.error('[ShopInventory] Error initializing Udhaar Reminder:', error);
        // Fallback: try again after a brief delay
        setTimeout(() => {
            try {
                if (!window.udhaarReminder) {
                    window.udhaarReminder = new UdhaarReminder();
                    console.log('[ShopInventory] Udhaar Reminder initialized (retry)');
                }
            } catch (retryError) {
                console.error('[ShopInventory] Error during retry:', retryError);
            }
        }, 500);
    }
});

// Also expose function to window for direct call
window.openUdhaarLedger = function() {
    try {
        if (window.udhaarReminder && typeof window.udhaarReminder.showUdhaarLedger === 'function') {
            window.udhaarReminder.showUdhaarLedger();
        } else {
            console.warn('Udhaar module not initialized, initializing now...');
            if (!window.udhaarReminder) {
                window.udhaarReminder = new UdhaarReminder();
            }
            if (window.udhaarReminder && typeof window.udhaarReminder.showUdhaarLedger === 'function') {
                window.udhaarReminder.showUdhaarLedger();
            }
        }
    } catch (error) {
        console.error('[ShopInventory] Error opening Udhaar Ledger:', error);
        alert('Error opening Udhaar Ledger. Please refresh the page and try again.');
    }
};

// Also expose add form function to window
window.addUdhaarRecord = function() {
    try {
        if (window.udhaarReminder && typeof window.udhaarReminder.showAddUdhaarForm === 'function') {
            window.udhaarReminder.showAddUdhaarForm();
        } else {
            console.warn('Udhaar module not initialized, initializing now...');
            if (!window.udhaarReminder) {
                window.udhaarReminder = new UdhaarReminder();
            }
            if (window.udhaarReminder && typeof window.udhaarReminder.showAddUdhaarForm === 'function') {
                window.udhaarReminder.showAddUdhaarForm();
            }
        }
    } catch (error) {
        console.error('[ShopInventory] Error adding Udhaar Record:', error);
        alert('Error adding Udhaar Record. Please refresh the page and try again.');
    }
};
