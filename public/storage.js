// Storage Manager - Handles all local storage operations
class StorageManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.productsKey = this.currentUser + '_products';
        this.invoicesKey = this.currentUser + '_invoices';
        this.initializeStorage();
    }

    // ── IndexedDB for videos (no size limit) ──────────────────────────────
    _getVideoDB() {
        return new Promise((resolve, reject) => {
            if (this._videoDB) { resolve(this._videoDB); return; }
            const req = indexedDB.open('shopInventoryVideos', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('videos', { keyPath: 'id' });
            req.onsuccess = e => { this._videoDB = e.target.result; resolve(this._videoDB); };
            req.onerror = () => reject(req.error);
        });
    }

    async saveVideo(productId, base64) {
        if (!base64) return;
        const db = await this._getVideoDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('videos', 'readwrite');
            tx.objectStore('videos').put({ id: productId, data: base64 });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async getVideo(productId) {
        try {
            const db = await this._getVideoDB();
            return new Promise((resolve) => {
                const tx = db.transaction('videos', 'readonly');
                const req = tx.objectStore('videos').get(productId);
                req.onsuccess = () => resolve(req.result ? req.result.data : null);
                req.onerror = () => resolve(null);
            });
        } catch { return null; }
    }

    async deleteVideo(productId) {
        try {
            const db = await this._getVideoDB();
            return new Promise((resolve) => {
                const tx = db.transaction('videos', 'readwrite');
                tx.objectStore('videos').delete(productId);
                tx.oncomplete = resolve;
                tx.onerror = resolve;
            });
        } catch {}
    }
    // ───────────────────────────────────────────────────────────────────────

    getCurrentUser() {
        return localStorage.getItem('activeProfile') || 'default';
    }

    switchUser(profileId) {
        localStorage.setItem('activeProfile', profileId);
        this.currentUser = profileId;
        this.productsKey = profileId + '_products';
        this.invoicesKey = profileId + '_invoices';
        this.initializeStorage();
    }

    getAllProfiles() {
        return JSON.parse(localStorage.getItem('allProfiles') || '[]');
    }

    addProfile(profile) {
        const profiles = this.getAllProfiles();
        if (profiles.find(p => p.id === profile.id)) return false;
        profiles.push(profile);
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        return true;
    }

    updateProfile(id, data) {
        const profiles = this.getAllProfiles();
        const idx = profiles.findIndex(p => p.id === id);
        if (idx === -1) return false;
        profiles[idx] = { ...profiles[idx], ...data };
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        return true;
    }

    deleteProfile(id) {
        let profiles = this.getAllProfiles();
        profiles = profiles.filter(p => p.id !== id);
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        localStorage.removeItem(id + '_products');
        localStorage.removeItem(id + '_invoices');
        localStorage.removeItem(id + '_bookings');
        localStorage.removeItem(id + '_suppliers');
        localStorage.removeItem(id + '_customers');
    }

    initializeStorage() {
        if (!localStorage.getItem(this.productsKey)) {
            localStorage.setItem(this.productsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.invoicesKey)) {
            localStorage.setItem(this.invoicesKey, JSON.stringify([]));
        }
    }

    addProduct(product) {
        const products = this.getProducts();
        // Use Date.now() + random suffix to guarantee uniqueness even in rapid bulk imports
        product.id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        product.createdAt = new Date().toISOString();
        if (!product.colors) product.colors = [];
        // Normalize colors to [{name, qty}] format
        product.colors = product.colors.map(c =>
            typeof c === 'string' ? { name: c, qty: 0 } : c
        );
        products.push(product);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
        return product;
    }

    getProducts() {
        const products = localStorage.getItem(this.productsKey);
        return products ? JSON.parse(products) : [];
    }

    getProductById(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    }

    updateProduct(id, updatedProduct) {
        updatedProduct.updatedAt = new Date().toISOString();
        let products = this.getProducts();
        products = products.map(p => p.id === id ? { ...p, ...updatedProduct } : p);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
    }

    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
    }

    searchProducts(query) {
        const products = this.getProducts();
        const lowerQuery = query.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.sku.toLowerCase().includes(lowerQuery) ||
            (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
            (p.colors && p.colors.some(c => {
                const name = typeof c === 'string' ? c : c.name;
                return name.toLowerCase().includes(lowerQuery);
            }))
        );
    }

    getLowStockProducts(threshold = 10) {
        return this.getProducts().filter(p => {
            if (p.quantity < threshold) return true;
            // Also flag if any color variant is at 0 stock
            if (p.colors && p.colors.length > 0) {
                return p.colors.some(c => (typeof c === 'string' ? 0 : (c.qty || 0)) === 0);
            }
            return false;
        });
    }

    getLowStockColorProducts(threshold = 10) {
        return this.getProducts().filter(p => p.quantity < threshold);
    }

    updateStock(productId, newQuantity) {
        this.updateProduct(productId, { quantity: newQuantity });
    }

    removeColorFromProduct(productId, colorName, decrementQty = 1) {
        const p = this.getProductById(productId);
        if (!p || !p.colors) return;
        const colors = p.colors.map(c => {
            const name = typeof c === 'string' ? c : c.name;
            if (name.toLowerCase() === colorName.toLowerCase()) {
                const currentQty = typeof c === 'string' ? 0 : (c.qty || 0);
                const newQty = Math.max(0, currentQty - decrementQty);
                return { name, qty: newQty };
            }
            return typeof c === 'string' ? { name: c, qty: 0 } : c;
        });
        // Recalculate total quantity as sum of all colour qtys
        const newTotal = colors.reduce((s, c) => s + (c.qty || 0), 0);
        this.updateProduct(productId, { colors, quantity: newTotal });
    }

    addStockToColorProduct(productId, colorName, addQty = 1) {
        const p = this.getProductById(productId);
        if (!p) return;
        let colors = (p.colors || []).map(c => typeof c === 'string' ? { name: c, qty: 0 } : { ...c });
        const found = colors.find(c => c.name.toLowerCase() === colorName.toLowerCase());
        if (found) {
            found.qty = (found.qty || 0) + addQty;
        } else {
            colors.push({ name: colorName, qty: addQty });
        }
        const newTotal = colors.reduce((s, c) => s + (c.qty || 0), 0);
        this.updateProduct(productId, { colors, quantity: newTotal });
    }

    addInvoice(invoice) {
        const invoices = this.getInvoices();
        const prefix = localStorage.getItem(this.currentUser + '_invoicePrefix') || localStorage.getItem('invoicePrefix') || 'INV';
        invoice.id = prefix + '-' + Date.now();
        invoice.createdAt = new Date().toISOString();
        invoices.push(invoice);
        
        try {
            localStorage.setItem(this.invoicesKey, JSON.stringify(invoices));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // Storage quota exceeded - delete old invoices and retry
                console.warn('Storage quota exceeded, cleaning up old invoices...');
                
                // Keep only last 50 invoices
                const sortedInvoices = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const keptInvoices = sortedInvoices.slice(0, 50);
                
                try {
                    localStorage.setItem(this.invoicesKey, JSON.stringify(keptInvoices));
                    console.log('Cleaned up old invoices, kept last 50');
                } catch (retryError) {
                    // If still failing, remove photos to reduce size
                    console.warn('Still quota exceeded, removing photos from invoices...');
                    const noPhotoInvoices = keptInvoices.map(inv => ({
                        ...inv,
                        items: inv.items ? inv.items.map(item => ({...item, photo: null})) : []
                    }));
                    
                    try {
                        localStorage.setItem(this.invoicesKey, JSON.stringify(noPhotoInvoices));
                        console.log('Removed photos from invoices to save space');
                    } catch (finalError) {
                        throw new Error('Storage is full. Please delete old invoices or clear data.');
                    }
                }
                
                // Try adding the new invoice again
                const finalInvoices = this.getInvoices();
                finalInvoices.push(invoice);
                localStorage.setItem(this.invoicesKey, JSON.stringify(finalInvoices));
            } else {
                throw e;
            }
        }
        
        return invoice;
    }

    getInvoices() {
        const invoices = localStorage.getItem(this.invoicesKey);
        return invoices ? JSON.parse(invoices) : [];
    }

    getInvoiceById(id) {
        const invoices = this.getInvoices();
        return invoices.find(inv => inv.id === id);
    }

    deleteInvoice(id) {
        let invoices = this.getInvoices();
        invoices = invoices.filter(inv => inv.id !== id);
        localStorage.setItem(this.invoicesKey, JSON.stringify(invoices));
    }

    // Update invoice status (pending → paid, etc)
    updateInvoiceStatus(id, status) {
        const invoices = this.getInvoices();
        const inv = invoices.find(i => i.id === id);
        if (inv) {
            inv.status = status;
            inv.updatedAt = new Date().toISOString();
            localStorage.setItem(this.invoicesKey, JSON.stringify(invoices));
            return inv;
        }
        return null;
    }

    searchInvoices(query) {
        const invoices = this.getInvoices();
        const lowerQuery = query.toLowerCase();
        return invoices.filter(inv =>
            inv.id.toLowerCase().includes(lowerQuery) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(lowerQuery)) ||
            (inv.customerPhone && inv.customerPhone.includes(query))
        );
    }

    getTotalRevenue() {
        const invoices = this.getInvoices();
        return invoices.reduce((sum, inv) => {
            if (inv.type === 'purchase') return sum - (inv.total || 0);
            // Only count PAID invoices (status: 'paid' or no status = legacy paid)
            if (inv.status === 'pending') return sum;
            return sum + (inv.total || 0);
        }, 0);
    }

    getRecentInvoices(limit = 5) {
        const invoices = this.getInvoices();
        return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    exportData() {
        const data = {
            products: this.getProducts(),
            invoices: this.getInvoices(),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    // ── FULL BACKUP: exports ALL profiles + their data ────────────────────
    exportFullBackup() {
        const data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            profiles: this.getAllProfiles(),
            activeProfile: localStorage.getItem('activeProfile'),
            store: {}
        };
        this.getAllProfiles().forEach(p => {
            data.store[p.id] = {
                products:  JSON.parse(localStorage.getItem(p.id + '_products')  || '[]'),
                invoices:  JSON.parse(localStorage.getItem(p.id + '_invoices')  || '[]'),
                bookings:  JSON.parse(localStorage.getItem(p.id + '_bookings')  || '[]'),
                suppliers: JSON.parse(localStorage.getItem(p.id + '_suppliers') || '[]'),
                customers: JSON.parse(localStorage.getItem(p.id + '_customers') || '[]'),
            };
        });
        return JSON.stringify(data, null, 2);
    }

    importFullBackup(jsonText) {
        try {
            const data = JSON.parse(jsonText);
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
            return true;
        } catch(e) {
            console.error('Backup import failed:', e);
            return false;
        }
    }
    // ─────────────────────────────────────────────────────────────────────

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.products) {
                localStorage.setItem(this.productsKey, JSON.stringify(data.products));
            }
            if (data.invoices) {
                localStorage.setItem(this.invoicesKey, JSON.stringify(data.invoices));
            }
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    clearAllData() {
        localStorage.removeItem(this.productsKey);
        localStorage.removeItem(this.invoicesKey);
        this.initializeStorage();
        return true;
    }

    // ── PENDING ORDERS (reorder tracking) ─────────────────────────────────
    getPendingOrders() {
        try { return JSON.parse(localStorage.getItem('pendingOrders') || '[]'); }
        catch(e) { return []; }
    }

    addPendingOrder(order) {
        const orders = this.getPendingOrders();
        order.id = 'ORD-' + Date.now();
        order.status = 'pending'; // pending | arrived
        order.createdAt = new Date().toISOString();
        orders.unshift(order);
        localStorage.setItem('pendingOrders', JSON.stringify(orders));
        return order;
    }

    updatePendingOrderStatus(orderId, status) {
        const orders = this.getPendingOrders().map(o =>
            o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
        );
        localStorage.setItem('pendingOrders', JSON.stringify(orders));
    }

    deletePendingOrder(orderId) {
        const orders = this.getPendingOrders().filter(o => o.id !== orderId);
        localStorage.setItem('pendingOrders', JSON.stringify(orders));
    }

    // ── SUPPLIER TRACKER ────────────────────────────────────────────────
    getSuppliers() {
        try { return JSON.parse(localStorage.getItem(this.currentUser + '_suppliers') || '[]'); }
        catch(e) { return []; }
    }

    addSupplier(supplier) {
        const suppliers = this.getSuppliers();
        supplier.id = 'SUP-' + Date.now();
        supplier.createdAt = new Date().toISOString();
        supplier.lastOrderDate = supplier.lastOrderDate || null;
        supplier.designCount = supplier.designCount || 0;
        suppliers.unshift(supplier);
        localStorage.setItem(this.currentUser + '_suppliers', JSON.stringify(suppliers));
        return supplier;
    }

    updateSupplier(id, data) {
        const suppliers = this.getSuppliers().map(s =>
            s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
        );
        localStorage.setItem(this.currentUser + '_suppliers', JSON.stringify(suppliers));
    }

    deleteSupplier(id) {
        const suppliers = this.getSuppliers().filter(s => s.id !== id);
        localStorage.setItem(this.currentUser + '_suppliers', JSON.stringify(suppliers));
        // Remove supplier link from products
        const products = this.getProducts().map(p =>
            p.supplierId === id ? { ...p, supplierId: null, supplierName: null } : p
        );
        localStorage.setItem(this.productsKey, JSON.stringify(products));
    }

    getSupplierById(id) {
        return this.getSuppliers().find(s => s.id === id) || null;
    }

    getProductsBySupplier(supplierId) {
        return this.getProducts().filter(p => p.supplierId === supplierId);
    }

    // ── ADVANCE BOOKINGS ─────────────────────────────────────────────────
    getBookings() {
        try { return JSON.parse(localStorage.getItem(this.currentUser + '_bookings') || '[]'); }
        catch(e) { return []; }
    }

    addBooking(booking) {
        const bookings = this.getBookings();
        booking.id = 'BK-' + Date.now();
        booking.status = 'ordered'; // ordered | arrived | delivered | paid
        booking.createdAt = new Date().toISOString();
        bookings.unshift(booking);
        localStorage.setItem(this.currentUser + '_bookings', JSON.stringify(bookings));
        return booking;
    }

    updateBooking(id, data) {
        const bookings = this.getBookings().map(b =>
            b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
        );
        localStorage.setItem(this.currentUser + '_bookings', JSON.stringify(bookings));
    }

    deleteBooking(id) {
        const bookings = this.getBookings().filter(b => b.id !== id);
        localStorage.setItem(this.currentUser + '_bookings', JSON.stringify(bookings));
    }

    getBookingById(id) {
        return this.getBookings().find(b => b.id === id) || null;
    }

    // ── CSV EXPORT with photo & colours ───────────────────────────────────
    exportProductsCSV() {
        const products = this.getProducts();
        const header = 'Name,SKU,Category,Price,WholesalePrice,Quantity,Description,Colors,Photo';
        const rows = products.map(p => {
            const colorsStr = (p.colors || []).map(c => {
                const name = typeof c === 'string' ? c : c.name;
                const qty  = typeof c === 'string' ? 0  : (c.qty || 0);
                return `${name}:${qty}`;
            }).join('|');
            // photo stored as base64 — keep it so CSV round-trips
            const photoStr = p.photo ? p.photo.replace(/,/g, '') : '';
            const escape = v => `"${String(v||'').replace(/"/g,'""')}"`;
            return [
                escape(p.name), escape(p.sku), escape(p.category||''),
                p.price, p.wholesalePrice||p.price, p.quantity,
                escape(p.description||''), escape(colorsStr), escape(photoStr)
            ].join(',');
        });
        return [header, ...rows].join('\n');
    }

    importProductsCSV(csvText, mergeMode = true) {
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return { imported: 0, skipped: 0 };
        const header = lines[0].toLowerCase();
        const hasPhoto  = header.includes('photo');
        const hasColors = header.includes('color');
        const dataLines = lines.slice(1);

        const existing = this.getProducts();
        const existingBySKU = {};
        existing.forEach(p => { existingBySKU[p.sku.toLowerCase()] = p; });

        let imported = 0, skipped = 0;
        const newProducts = [];

        dataLines.forEach(line => {
            // CSV-aware split that handles quoted commas
            const cols = [];
            let inQ = false, cur = '';
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') { inQ = !inQ; }
                else if (ch === ',' && !inQ) { cols.push(cur.replace(/^"|"$/g,'').replace(/""/g,'"')); cur = ''; }
                else { cur += ch; }
            }
            cols.push(cur.replace(/^"|"$/g,'').replace(/""/g,'"'));

            const [name, sku, category, price, wholesalePrice, quantity, description, colorsRaw, photoRaw] = cols;
            if (!name || !sku) { skipped++; return; }

            // Parse colours: "Red:10|Blue:5" or "Red|Blue"
            const colors = (colorsRaw || '').split('|').filter(Boolean).map(part => {
                const [cname, qty] = part.split(':');
                return { name: cname.trim(), qty: parseInt(qty) || 0 };
            });

            const product = {
                name: name.trim(), sku: sku.trim(),
                category: (category||'').trim(),
                price: parseFloat(price) || 0,
                wholesalePrice: parseFloat(wholesalePrice) || parseFloat(price) || 0,
                quantity: parseInt(quantity) || 0,
                description: (description||'').trim(),
                colors,
                photo: photoRaw && photoRaw.startsWith('data:') ? photoRaw : null
            };

            if (mergeMode && existingBySKU[sku.toLowerCase()]) {
                // Update existing product by SKU — preserve existing photo and non-empty fields
                const existingProduct = existingBySKU[sku.toLowerCase()];
                const updateData = {
                    name: product.name,
                    sku: product.sku,
                    category: product.category || existingProduct.category,
                    price: product.price || existingProduct.price,
                    wholesalePrice: product.wholesalePrice || existingProduct.wholesalePrice,
                    quantity: product.quantity,
                    description: product.description || existingProduct.description,
                    colors: product.colors.length > 0 ? product.colors : existingProduct.colors,
                    photo: product.photo || existingProduct.photo || null
                };
                this.updateProduct(existingProduct.id, updateData);
                imported++;
            } else if (!mergeMode || !existingBySKU[sku.toLowerCase()]) {
                newProducts.push(product);
                imported++;
            } else {
                skipped++;
            }
        });

        newProducts.forEach(p => this.addProduct(p));
        return { imported, skipped };
    }
    // ── PURCHASE ORDER DRAFTS (New Inventory) ─────────────────────────────
    getPurchaseDrafts() {
        try { return JSON.parse(localStorage.getItem(this.currentUser + '_purchaseDrafts') || '[]'); }
        catch(e) { return []; }
    }

    addPurchaseDraft(draft) {
        const drafts = this.getPurchaseDrafts();
        draft.id = 'PO-' + Date.now();
        draft.status = 'draft'; // draft | received
        draft.createdAt = new Date().toISOString();
        drafts.unshift(draft);
        localStorage.setItem(this.currentUser + '_purchaseDrafts', JSON.stringify(drafts));
        return draft;
    }

    updatePurchaseDraft(id, data) {
        const drafts = this.getPurchaseDrafts().map(d =>
            d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d
        );
        localStorage.setItem(this.currentUser + '_purchaseDrafts', JSON.stringify(drafts));
    }

    deletePurchaseDraft(id) {
        const drafts = this.getPurchaseDrafts().filter(d => d.id !== id);
        localStorage.setItem(this.currentUser + '_purchaseDrafts', JSON.stringify(drafts));
    }

    getPurchaseDraftById(id) {
        return this.getPurchaseDrafts().find(d => d.id === id) || null;
    }
}

const storage = new StorageManager();
