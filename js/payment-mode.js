// ============================================
// payment-mode.js  — Payment Mode Selector
// NEW FILE — link in index.html before app.js
//
// Adds Cash / UPI / Card / Credit payment mode
// buttons to the billing form, saves selection
// on every invoice, and shows it on the invoice
// print template.
//
// HOW IT WORKS:
//   1. Injects a "PAYMENT MODE" card into the
//      billing form right above the GST input.
//   2. Reads the selected mode in generateInvoice
//      via window.PaymentMode.getSelected().
//   3. Resets to Cash on newInvoice / clearCart.
// ============================================

window.PaymentMode = (() => {

    // ── Config ────────────────────────────────────────────────────────────
    const MODES = [
        { id: 'cash',   icon: '💵', label: 'CASH'   },
        { id: 'upi',    icon: '📱', label: 'UPI'    },
        { id: 'card',   icon: '💳', label: 'CARD'   },
        { id: 'credit', icon: '📒', label: 'CREDIT' },
    ];

    const STORAGE_KEY = 'lastPaymentMode';
    let _current = localStorage.getItem(STORAGE_KEY) || 'cash';

    // ── Internal helpers ──────────────────────────────────────────────────

    function _select(modeId) {
        _current = modeId;
        localStorage.setItem(STORAGE_KEY, modeId);

        // Update button states
        MODES.forEach(m => {
            const btn = document.getElementById('pm_btn_' + m.id);
            if (!btn) return;
            if (m.id === modeId) {
                btn.classList.add('active');
                btn.style.background    = 'rgba(0,255,136,0.1)';
                btn.style.borderColor   = 'rgba(0,255,136,0.4)';
                btn.style.color         = '#00ff88';
            } else {
                btn.classList.remove('active');
                btn.style.background    = '#141428';
                btn.style.borderColor   = '#2a2a44';
                btn.style.color         = '#5a5a7a';
            }
        });

        // Show/hide credit-note input
        const creditNote = document.getElementById('pm_credit_note');
        if (creditNote) {
            creditNote.style.display = modeId === 'credit' ? 'block' : 'none';
        }

        // Show/hide UPI ref input
        const upiNote = document.getElementById('pm_upi_note');
        if (upiNote) {
            upiNote.style.display = modeId === 'upi' ? 'block' : 'none';
        }
    }

    function _buildHTML() {
        const buttonsHTML = MODES.map(m => `
            <button
                id="pm_btn_${m.id}"
                class="hp-type-btn"
                onclick="window.PaymentMode.select('${m.id}')"
                title="${m.label}"
                style="
                    flex:1;padding:7px 4px;
                    background:#141428;border:1px solid #2a2a44;
                    color:#5a5a7a;border-radius:8px;
                    font-family:'Space Mono',monospace;font-size:10px;
                    cursor:pointer;transition:all 0.2s;
                ">
                ${m.icon} ${m.label}
            </button>
        `).join('');

        return `
        <div id="paymentModeCard" class="hp-card" style="margin-top:0;">
            <div class="hp-card-label">PAYMENT MODE</div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                ${buttonsHTML}
            </div>

            <!-- UPI reference (shown only for UPI) -->
            <div id="pm_upi_note" style="display:none;margin-top:4px;">
                <input
                    id="pm_upi_ref"
                    type="text"
                    placeholder="UPI Ref / Transaction ID (optional)"
                    class="hp-input"
                    style="width:100%;"
                >
            </div>

            <!-- Credit due-date (shown only for Credit) -->
            <div id="pm_credit_note" style="display:none;margin-top:4px;">
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;white-space:nowrap;">Due date:</label>
                    <input
                        id="pm_due_date"
                        type="date"
                        class="hp-input"
                        style="flex:1;"
                    >
                </div>
                <div style="margin-top:6px;">
                    <input
                        id="pm_partial_paid"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount paid now (₹0 = fully on credit)"
                        class="hp-input"
                        style="width:100%;"
                    >
                </div>
            </div>
        </div>`;
    }

    // ── Inject card into billing form ─────────────────────────────────────

    function _inject() {
        // Don't double-inject
        if (document.getElementById('paymentModeCard')) return;

        // Target: inject BEFORE the billing options card (discount/GST section)
        // We find the cart section's first hp-card (which contains BILLING OPTIONS)
        const cartSection = document.getElementById('billingCartSection');
        if (!cartSection) {
            // Retry once DOM is ready
            setTimeout(_inject, 300);
            return;
        }

        const billingOptionsCard = cartSection.querySelector('.hp-card');
        if (!billingOptionsCard) return;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = _buildHTML();
        const card = wrapper.firstElementChild;
        cartSection.insertBefore(card, billingOptionsCard);

        // Set initial state
        _select(_current);
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Call from onclick handlers.
     * @param {string} modeId  — 'cash' | 'upi' | 'card' | 'credit'
     */
    function select(modeId) {
        _select(modeId);
    }

    /**
     * Returns the full payment info object to attach to an invoice.
     * Call this inside generateInvoice() and spread into the invoice object.
     *
     * @returns {{
     *   paymentMethod: string,
     *   upiRef: string,
     *   dueDate: string,
     *   partialPaid: number,
     *   balanceDue: number
     * }}
     */
    function getPaymentData(invoiceTotal = 0) {
        const mode       = _current;
        const upiRef     = (document.getElementById('pm_upi_ref')?.value || '').trim();
        const dueDate    = (document.getElementById('pm_due_date')?.value || '');
        const partialPaid = parseFloat(document.getElementById('pm_partial_paid')?.value || 0) || 0;
        const balanceDue  = mode === 'credit' ? Math.max(0, invoiceTotal - partialPaid) : 0;

        return {
            paymentMethod: mode.charAt(0).toUpperCase() + mode.slice(1), // "Cash", "Upi" etc.
            upiRef:        mode === 'upi'    ? upiRef    : '',
            dueDate:       mode === 'credit' ? dueDate   : '',
            partialPaid:   mode === 'credit' ? partialPaid : invoiceTotal,
            balanceDue,
        };
    }

    /**
     * Convenience getter — just the mode string e.g. 'cash'
     */
    function getSelected() {
        return _current;
    }

    /**
     * Reset to Cash. Call this from newInvoice() and clearCart().
     */
    function reset() {
        // Clear extra fields
        const upiRef = document.getElementById('pm_upi_ref');
        if (upiRef) upiRef.value = '';
        const dueDate = document.getElementById('pm_due_date');
        if (dueDate) dueDate.value = '';
        const partial = document.getElementById('pm_partial_paid');
        if (partial) partial.value = '';
        _select('cash');
    }

    /**
     * Generates the HTML snippet shown on the invoice print for payment details.
     * Call this inside your invoice print template builder.
     *
     * @param {object} inv  — saved invoice object
     * @returns {string}    — HTML string
     */
    function invoicePrintHTML(inv) {
        const methodLabel = inv.paymentMethod || 'Cash';
        const iconMap = { Cash:'💵', Upi:'📱', Card:'💳', Credit:'📒' };
        const icon = iconMap[methodLabel] || '💵';

        let extraHTML = '';
        if (methodLabel === 'Upi' && inv.upiRef) {
            extraHTML = `<div style="font-size:10px;color:#555;margin-top:2px;">UPI Ref: <b>${inv.upiRef}</b></div>`;
        }
        if (methodLabel === 'Credit') {
            extraHTML = `
                <div style="font-size:10px;color:#c0392b;margin-top:2px;font-weight:700;">
                    Balance Due: ₹${(inv.balanceDue || 0).toFixed(2)}
                    ${inv.dueDate ? ' · Due: ' + new Date(inv.dueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : ''}
                </div>`;
        }

        return `
            <div style="font-size:11px;color:#555;margin-top:4px;">
                ${icon} Payment: <span style="font-weight:700;color:#111;">${methodLabel}</span>
                ${extraHTML}
            </div>`;
    }

    // ── Boot ──────────────────────────────────────────────────────────────

    // Inject as soon as billing page is first opened
    // (billing page is a hidden-page, not always in DOM at load)
    document.addEventListener('DOMContentLoaded', () => {
        // Watch for billing page becoming visible
        const billingPage = document.getElementById('billing');
        if (!billingPage) return;

        const observer = new MutationObserver(() => {
            if (billingPage.style.display !== 'none' && billingPage.style.display !== '') {
                _inject();
            }
        });
        observer.observe(billingPage, { attributes: true, attributeFilter: ['style', 'class'] });

        // Also try immediately in case billing is the start page
        setTimeout(_inject, 500);
    });

    return { select, getSelected, getPaymentData, reset, invoicePrintHTML };

})();
