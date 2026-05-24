// ============================================
// HOW TO INTEGRATE payment-mode.js
// Apply these 4 small edits to link everything
// ============================================

// ─────────────────────────────────────────────
// CHANGE 1 — index.html
// Add the script tag BEFORE the closing </body>
// (or just before the line that loads app.js)
// ─────────────────────────────────────────────

// FIND this line in index.html:
//   <script src="js/app.js"></script>
//
// ADD this line directly BEFORE it:
//   <script src="js/payment-mode.js"></script>
//
// Result should look like:
//   <script src="js/payment-mode.js"></script>
//   <script src="js/app.js"></script>


// ─────────────────────────────────────────────
// CHANGE 2 — app.js → generateInvoice()
// Spread payment data into invoice object
// ─────────────────────────────────────────────

// FIND this block inside generateInvoice() in app.js
// (around line 2648):
//
//   const invoice = {
//       prefix,
//       date,
//       customerName: isPurchase ? '' : customerName,
//       ...
//       currency
//   };
//
// ADD this ONE LINE after the `currency` line, before the closing `}`:
//
//   ...(window.PaymentMode ? window.PaymentMode.getPaymentData(total) : { paymentMethod: 'Cash' }),
//
// Result:
//   const invoice = {
//       prefix,
//       date,
//       customerName: isPurchase ? '' : customerName,
//       customerPhone: isPurchase ? '' : customerPhone,
//       customerType,
//       supplierName: isPurchase ? customerName : '',
//       supplierContact: isPurchase ? customerPhone : '',
//       type: isPurchase ? 'purchase' : 'sale',
//       items: this.cartItems.map(i => ({ ... })),
//       subtotal,
//       discount,
//       discountPercent,
//       gstRate,
//       gst,
//       taxRate,
//       tax: gst,
//       total,
//       currency,
//       ...(window.PaymentMode ? window.PaymentMode.getPaymentData(total) : { paymentMethod: 'Cash' }),
//   };


// ─────────────────────────────────────────────
// CHANGE 3 — app.js → clearCart() and newInvoice()
// Reset payment mode to Cash on new bill
// ─────────────────────────────────────────────

// FIND clearCart() in app.js (around line 2585):
//   clearCart() {
//       this.cartItems = [];
//       ...
//   }
//
// ADD this line at the END of clearCart(), just before the closing }:
//   if (window.PaymentMode) window.PaymentMode.reset();


// ─────────────────────────────────────────────
// CHANGE 4 — app.js → invoice print template
// Show payment details on printed invoice
// ─────────────────────────────────────────────

// FIND this line in app.js inside the invoice print HTML builder
// (around line 2897):
//   '<div style="font-size:11px;color:#555;">Method: <span style="font-weight:600;color:#111;">' + esc(inv.paymentMethod || 'Cash') + '</span></div>' +
//
// REPLACE it with:
//   (window.PaymentMode ? window.PaymentMode.invoicePrintHTML(inv) : '<div style="font-size:11px;color:#555;">Method: <span style="font-weight:600;color:#111;">' + esc(inv.paymentMethod || 'Cash') + '</span></div>') +
