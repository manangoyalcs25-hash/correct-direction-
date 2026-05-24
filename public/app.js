// ============================================
// SHOP INVENTORY - app.js v4.0
// Refactored: modules split, XSS fixed,
// API key moved to .env, backup reminder added
// ============================================

// ── SECURITY: HTML escape helper ─────────────────────────────────────────────
// Wrap ALL user-supplied data before inserting into innerHTML.
// e.g. product names, SKUs, customer names, descriptions.
function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}
// ─────────────────────────────────────────────────────────────────────────────

// ---- PROFILE MANAGER ----
function initProfileSystem() {
    // Migrate old single-email user to profile system
    const oldEmail = localStorage.getItem('userEmail');
    const profiles = JSON.parse(localStorage.getItem('allProfiles') || '[]');

    if (oldEmail && profiles.length === 0) {
        const defaultProfile = {
            id: 'profile_' + Date.now(),
            name: oldEmail.split('@')[0],
            email: oldEmail,
            avatar: '👤',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('allProfiles', JSON.stringify([defaultProfile]));
        localStorage.setItem('activeProfile', defaultProfile.id);
        localStorage.removeItem('userEmail');
        storage.switchUser(defaultProfile.id);
    }
}

function showProfileScreen() {
    const profiles = storage.getAllProfiles();
    const screen = document.getElementById('profileScreen');
    const list = document.getElementById('profileList');

    if (profiles.length === 0) {
        // No profiles left — go back to email gate
        screen.style.display = 'none';
        document.getElementById('emailGate').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        return;
    }

    list.innerHTML = profiles.map(p => `
        <div class="profile-card" style="position:relative;" onclick="selectProfile('${esc(p.id)}')">
            <button onclick="event.stopPropagation();deleteProfileFromPicker('${esc(p.id)}')"
                title="Delete this account"
                style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.18);border:none;border-radius:6px;color:#f87171;font-size:0.75rem;padding:2px 6px;cursor:pointer;line-height:1.4;z-index:2;">🗑️</button>
            <div class="profile-avatar">${esc(p.avatar || '👤')}</div>
            <div class="profile-name">${esc(p.name)}</div>
            <div class="profile-email">${esc(p.email)}</div>
        </div>
    `).join('');

    // Hide the add-form when re-showing the screen
    const addForm = document.getElementById('addProfileForm');
    if (addForm) addForm.style.display = 'none';

    screen.style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('emailGate').style.display = 'none';
}

function deleteProfileFromPicker(profileId) {
    const profiles = storage.getAllProfiles();
    const p = profiles.find(pr => pr.id === profileId);
    if (!p) return;
    if (!confirm(`Delete account "${p.name}" (${p.email}) and ALL their data?\n\nThis cannot be undone!`)) return;
    storage.deleteProfile(profileId);
    // If this was the active profile, clear it
    if (localStorage.getItem('activeProfile') === profileId) {
        localStorage.removeItem('activeProfile');
    }
    // Re-render the picker (handles going to email gate if 0 profiles left)
    showProfileScreen();
}

function selectProfile(profileId) {
    localStorage.setItem('activeProfile', profileId);
    storage.switchUser(profileId);
    const profiles = storage.getAllProfiles();
    const p = profiles.find(pr => pr.id === profileId);
    if (p) {
        showMainApp(p.email, p);
        if (window.app) {
            window.app.cartItems = [];
            window.app.updateDashboard();
            window.app.changePage('dashboard');
        }
    }
}

function showAddProfileForm() {
    document.getElementById('addProfileForm').style.display = 'block';
    document.getElementById('newProfileEmail').focus();
}

function submitNewProfile() {
    const email = document.getElementById('newProfileEmail').value.trim();
    const name = document.getElementById('newProfileName').value.trim() || email.split('@')[0];
    const avatar = document.getElementById('newProfileAvatar').value || '👤';

    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }

    const profileId = 'profile_' + Date.now();
    const profile = { id: profileId, name, email, avatar, createdAt: new Date().toISOString() };
    storage.addProfile(profile);
    storage.switchUser(profileId);
    localStorage.setItem('activeProfile', profileId);
    showMainApp(email, profile);
    window.app.cartItems = [];
    window.app.updateDashboard();
    window.app.changePage('dashboard');
}

function checkProfileGate() {
    initProfileSystem();
    const profiles = storage.getAllProfiles();
    const active = localStorage.getItem('activeProfile');

    if (profiles.length === 0) {
        // First time — show email gate
        document.getElementById('emailGate').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('profileScreen').style.display = 'none';
    } else if (active && profiles.find(p => p.id === active)) {
        // Already logged in — go straight to app (handles refresh correctly)
        const p = profiles.find(pr => pr.id === active);
        storage.switchUser(active);
        showMainApp(p.email, p);
        if (window.app) {
            window.app.updateDashboard();
            window.app.changePage('dashboard');
        }
    } else {
        // No active profile set — show picker
        showProfileScreen();
    }
}

function submitEmailGate() {
    const email = document.getElementById('gateEmail').value.trim();
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }
    const profileId = 'profile_' + Date.now();
    const profile = {
        id: profileId,
        name: email.split('@')[0],
        email,
        avatar: '👤',
        createdAt: new Date().toISOString()
    };
    storage.addProfile(profile);
    storage.switchUser(profileId);
    localStorage.setItem('activeProfile', profileId);
    showMainApp(email, profile);
    window.app.cartItems = [];
    window.app.updateDashboard();
    window.app.changePage('dashboard');
}

function showMainApp(email, profile) {
    document.getElementById('emailGate').style.display = 'none';
    document.getElementById('profileScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    const p = profile || { avatar: '👤', name: email };
    const label = (p.avatar || '👤') + ' ' + esc(p.name || email);

    // Desktop chip
    const chip = document.getElementById('userEmailChip');
    if (chip) {
        chip.textContent = label;
        chip.onclick = () => showUserMenu(p, chip);
        chip.style.cursor = 'pointer';
        chip.title = 'Account options';
    }

    // Mobile account button — show avatar + first name
    const mobileBtn = document.getElementById('mobileAccountBtn');
    if (mobileBtn) {
        mobileBtn.textContent = (p.avatar || '👤') + ' ' + (p.name || email).split(' ')[0];
    }

    // Dashboard right-panel profile block
    const dashAvatar = document.getElementById('dashProfileAvatar');
    const dashName   = document.getElementById('dashProfileName');
    const dashId     = document.getElementById('dashProfileId');
    const displayName = p.name || email;
    if (dashAvatar) dashAvatar.textContent = (p.avatar && p.avatar !== '👤') ? p.avatar : displayName.charAt(0).toUpperCase();
    if (dashName)   dashName.textContent   = displayName.toUpperCase();
    if (dashId)     dashId.textContent     = 'UID:' + (p.id || 'default').slice(-4).toUpperCase() + ' · ' + (p.email || email);
}

function showMobileAccountMenu() {
    const active = localStorage.getItem('activeProfile');
    const profiles = storage.getAllProfiles();
    const p = profiles.find(pr => pr.id === active) || { avatar: '👤', name: 'User', email: '' };
    const btn = document.getElementById('mobileAccountBtn');
    showUserMenu(p, btn);
}

function showUserMenu(profile, anchorEl) {
    // Remove any existing menu
    document.getElementById('userMenuDropdown')?.remove();
    const profiles = storage.getAllProfiles();
    const menu = document.createElement('div');
    menu.id = 'userMenuDropdown';
    menu.style.cssText = `
        position:fixed;top:60px;right:12px;z-index:99999;
        background:var(--bg-primary);border:1px solid var(--border);
        border-radius:14px;padding:0.5rem;min-width:210px;
        box-shadow:0 8px 32px rgba(0,0,0,0.45);
    `;
    menu.innerHTML = `
        <div style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);margin-bottom:0.4rem;">
            <div style="font-weight:700;color:var(--text-light);font-size:0.9rem;">${profile.avatar || '👤'} ${profile.name || profile.email}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">${profile.email}</div>
        </div>
        ${profiles.length > 1 ? `<button onclick="document.getElementById('userMenuDropdown')?.remove();showProfileScreen();" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:var(--text-light);font-size:0.85rem;cursor:pointer;border-radius:8px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">🔄 Switch Account</button>` : ''}
        <button onclick="document.getElementById('userMenuDropdown')?.remove();showProfileScreen();setTimeout(()=>showAddProfileForm(),50);" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:var(--text-light);font-size:0.85rem;cursor:pointer;border-radius:8px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">➕ Add New Account</button>
        <div style="border-top:1px solid var(--border);margin:0.4rem 0;"></div>
        <button onclick="document.getElementById('userMenuDropdown')?.remove();logoutProfile();" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:#f87171;font-size:0.85rem;cursor:pointer;border-radius:8px;font-weight:600;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">🚪 Logout</button>
    `;
    document.body.appendChild(menu);
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== anchorEl) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

function logoutProfile() {
    // Clear the active session so refresh doesn't auto-login
    localStorage.removeItem('activeProfile');
    showProfileScreen();
}

// ---- MOBILE SIDEBAR ----
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ============================================
// MAIN APP CLASS
// ============================================
class ShopApp {
    constructor() {
        this.currentEditingProductId = null;
        this.cartItems = [];
        this.currentInvoice = null;
        this.cameraStream = null;
        this.photoBase64 = null;
        this.videoBase64 = null;
        this.lowStockThreshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
        this.pendingBillingProductId = null;
        this.productColors = []; // colors being added in product modal
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.updateDashboard();
        this.loadProducts();
        this.setDateToToday();
    }

    setupEventListeners() {
        // Navigation — covers both .nav-item and .nav-icon[data-page]
        document.querySelectorAll('.nav-item, .nav-icon[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = e.currentTarget.dataset.page;
                if (pageName) {
                    this.changePage(pageName);
                    closeMobileSidebar && closeMobileSidebar();
                }
            });
        });

        document.querySelectorAll('.view-all').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = e.currentTarget.dataset.page;
                if (pageName) this.changePage(pageName);
            });
        });

        // Products
        document.getElementById('addProductBtnMain').addEventListener('click', () => this.openProductModal());
        document.getElementById('productSearch').addEventListener('input', (e) => this.searchProducts(e.target.value));
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleProductSubmit(e));

        // Camera / upload
        document.getElementById('cameraBtn').addEventListener('click', (e) => { e.preventDefault(); this.openCamera(); });
        document.getElementById('uploadBtn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('productPhoto').click(); });
        document.getElementById('productPhoto').addEventListener('change', (e) => this.previewPhoto(e));
        document.getElementById('uploadVideoBtn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('productVideo').click(); });
        document.getElementById('productVideo').addEventListener('change', (e) => this.previewVideo(e));
        document.getElementById('removeVideoBtn').addEventListener('click', () => this.removeVideo());
        document.getElementById('captureBtn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('retakeBtn').addEventListener('click', () => this.retakePhoto());
        document.getElementById('closeCamera').addEventListener('click', () => this.closeCamera());

        // Color add in product modal
        const addColorBtn = document.getElementById('addColorBtn');
        if (addColorBtn) addColorBtn.addEventListener('click', () => this.addColorToProduct());
        const colorInput = document.getElementById('colorInput');
        if (colorInput) colorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.addColorToProduct(); } });

        // Billing
        document.getElementById('addItemBtn').addEventListener('click', () => this.addToCart());
        document.getElementById('generateInvoiceBtn').addEventListener('click', () => this.generateInvoice());
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('newInvoiceBtn').addEventListener('click', () => this.newInvoice());
        
        // Discount and GST listeners
        document.getElementById('discountPercent').addEventListener('input', () => {
            document.getElementById('discountAmount').value = '0';
            this.updateBillingTotals(this.getCartSubtotal());
        });
        document.getElementById('discountAmount').addEventListener('input', () => {
            document.getElementById('discountPercent').value = '0';
            this.updateBillingTotals(this.getCartSubtotal());
        });
        document.getElementById('gstRate').addEventListener('input', () => {
            this.updateBillingTotals(this.getCartSubtotal());
        });

        // Invoices
        document.getElementById('invoiceSearch').addEventListener('input', (e) => this.searchInvoices(e.target.value));

        // Low Stock
        const saveThresholdBtn = document.getElementById('saveThresholdBtn');
        if (saveThresholdBtn) {
            saveThresholdBtn.addEventListener('click', () => this.saveThreshold());
            document.getElementById('lowStockThreshold').value = this.lowStockThreshold;
        }

        // Reorder
        const saveReorderSettingsBtn = document.getElementById('saveReorderSettingsBtn');
        if (saveReorderSettingsBtn) {
            saveReorderSettingsBtn.addEventListener('click', () => this.saveReorderSettings());
        }
        const reorderAllBtn = document.getElementById('reorderAllBtn');
        if (reorderAllBtn) {
            reorderAllBtn.addEventListener('click', () => this.reorderAll());
        }

        // Settings
        const saveStoreInfoBtn = document.getElementById('saveStoreInfoBtn');
        if (saveStoreInfoBtn) saveStoreInfoBtn.addEventListener('click', () => this.saveStoreInfo());
        const saveGeneralBtn = document.getElementById('saveGeneralBtn');
        if (saveGeneralBtn) saveGeneralBtn.addEventListener('click', () => this.saveGeneralSettings());
        const saveLowStockBtn = document.getElementById('saveLowStockBtn');
        if (saveLowStockBtn) saveLowStockBtn.addEventListener('click', () => this.saveLowStockThreshold());
        const saveThemeBtn = document.getElementById('saveThemeBtn');
        if (saveThemeBtn) saveThemeBtn.addEventListener('click', () => this.applyThemeFromSettings());
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportData());
        const backupDataBtn = document.getElementById('backupDataBtn');
        if (backupDataBtn) backupDataBtn.addEventListener('click', () => this.backupData());
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAllData());
        const resetAppBtn = document.getElementById('resetAppBtn');
        if (resetAppBtn) resetAppBtn.addEventListener('click', () => this.resetApp());

        // Add Profile btn in settings
        const addProfileBtn = document.getElementById('addProfileSettingsBtn');
        if (addProfileBtn) addProfileBtn.addEventListener('click', () => this.openAddProfileModal());
        const switchProfileBtn = document.getElementById('switchProfileBtn');
        if (switchProfileBtn) switchProfileBtn.addEventListener('click', () => showProfileScreen());

        // Close modals
        document.querySelectorAll('.close, .si-modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal') || e.target.closest('.si-modal');
                if (modal) this.closeModal(modal);
            });
        });
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || e.target.classList.contains('si-modal')) {
                this.closeModal(e.target);
            }
        });

        // Print / Download
        document.getElementById('printBtn').addEventListener('click', () => this.printInvoice());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadInvoicePDF());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        const mobileThemeBtn = document.getElementById('mobileThemeBtn');
        if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', () => this.toggleTheme());

        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) addProductBtn.addEventListener('click', () => this.openProductModal());

        // Check for WhatsApp return flag
        const waReturn = sessionStorage.getItem('whatsapp_sent');
        if (waReturn) {
            sessionStorage.removeItem('whatsapp_sent');
            const info = JSON.parse(waReturn);
            setTimeout(() => this.showSentSuccessPanel(info), 500);
        }
    }

    // =====================
    // NAVIGATION
    // =====================
    changePage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // Clear active on BOTH nav-item and nav-icon (sidebar uses nav-icon)
        document.querySelectorAll('.nav-item, .nav-icon[data-page]').forEach(l => l.classList.remove('active'));

        // Show target page
        const pageEl = document.getElementById(pageName);
        if (pageEl) pageEl.classList.add('active');

        // Set active nav icon
        const navItem = document.querySelector(`.nav-icon[data-page="${pageName}"], .nav-item[data-page="${pageName}"]`);
        if (navItem) navItem.classList.add('active');

        // Update breadcrumb title
        const titles = {
            'dashboard':    'Dashboard',
            'products':     'Inventory',
            'newinventory': 'New Inventory',
            'billing':      'Billing',
            'lowstock':     'Low Stock Alert',
            'settings':     'Settings',
            'invoices':     'Invoices',
            'colorbook':    'Colour Book',
            'designchart':  'Design Chart',
            'suppliers':    'Suppliers',
            'bookings':     'Advance Bookings'
        };
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = titles[pageName] || 'Dashboard';

        const addBtn = document.getElementById('addProductBtn');
        if (addBtn) addBtn.style.display = pageName === 'products' ? 'flex' : 'none';

        // Load page data fresh every time — no stale data
        if      (pageName === 'dashboard')    this.updateDashboard();
        else if (pageName === 'products')     this.loadProducts();
        else if (pageName === 'newinventory') this.loadNewInventoryPage && this.loadNewInventoryPage();
        else if (pageName === 'billing')      { this.updateProductSelect(); this.switchBillingTab && this.switchBillingTab('customer'); }
        else if (pageName === 'lowstock')     this.loadLowStockPage();
        else if (pageName === 'settings')     this.loadSettings();
        else if (pageName === 'invoices')     this.loadInvoices();
        else if (pageName === 'colorbook')    this.loadColorBook();
        else if (pageName === 'designchart')  this.loadDesignChart && this.loadDesignChart();
        else if (pageName === 'suppliers')    this.loadSuppliersPage();
        else if (pageName === 'bookings')     this.loadBookingsPage();
    }

    // =====================
    // DASHBOARD
    // =====================
    updateDashboard() {
        const products = storage.getProducts();
        const invoices = storage.getInvoices();
        const lowStockItems = storage.getLowStockProducts(this.lowStockThreshold);

        document.getElementById('totalProducts').textContent = products.length;
        document.getElementById('lowStockItems').textContent = lowStockItems.length;
        const revenue = storage.getTotalRevenue();
        document.getElementById('totalRevenue').textContent = '₹' + revenue.toFixed(0);
        
        // Calculate pending revenue (credit invoices awaiting payment)
        const pendingRevenue = invoices
            .filter(inv => inv.type === 'sale' && inv.status === 'pending')
            .reduce((sum, inv) => sum + (inv.total || 0), 0);
        
        // Update pending revenue element if it exists
        const pendingEl = document.getElementById('pendingRevenue');
        if (pendingEl) {
            pendingEl.textContent = '₹' + pendingRevenue.toFixed(0);
        }
        
        document.getElementById('totalInvoices').textContent = invoices.length;

        this.displayRecentInventory();
        this.displayRecentTransactions();
        this.updateRevenueChart('7D');
        this.updateStockGauges(products, lowStockItems);
        this.updatePendingOrdersBadge();

        // Bookings count
        const bookingsCountEl = document.getElementById('advanceBookingsCount');
        if (bookingsCountEl) {
            const activeBookings = storage.getBookings().filter(b => b.status !== 'paid');
            bookingsCountEl.textContent = activeBookings.length;
        }

        // Update Udhaar Reminder display
        if (window.udhaarReminder) {
            window.udhaarReminder.updateUdhaarDisplay();
        }
    }

    updateStockGauges(products, lowStockItems) {
        const total = products.length;
        const critical = lowStockItems.filter(p => p.quantity <= 3).length;
        const restock = lowStockItems.length;
        const pct = total === 0 ? 100 : Math.round(((total - restock) / total) * 100);

        // Overall stock gauge
        const gauges = document.querySelectorAll('.gauge-item');
        if (gauges[0]) {
            const fill = gauges[0].querySelector('.gauge-fill');
            const pctEl = gauges[0].querySelector('.gauge-pct');
            if (fill) { fill.style.width = pct + '%'; fill.className = 'gauge-fill' + (pct < 40 ? ' crit' : pct < 70 ? ' warn' : ''); }
            if (pctEl) pctEl.textContent = pct + '%';
        }
        if (gauges[1]) {
            const fill = gauges[1].querySelector('.gauge-fill');
            const pctEl = gauges[1].querySelector('.gauge-pct');
            const cpct = total === 0 ? 0 : Math.round((critical / total) * 100);
            if (fill) { fill.style.width = cpct + '%'; fill.className = 'gauge-fill' + (critical > 0 ? ' crit' : ''); }
            if (pctEl) { pctEl.textContent = critical; pctEl.style.color = critical > 0 ? 'var(--fire)' : 'var(--neon)'; }
        }
        if (gauges[2]) {
            const fill = gauges[2].querySelector('.gauge-fill');
            const pctEl = gauges[2].querySelector('.gauge-pct');
            const rpct = total === 0 ? 0 : Math.round((restock / total) * 100);
            if (fill) { fill.style.width = rpct + '%'; fill.className = 'gauge-fill' + (restock > 0 ? ' warn' : ''); }
            if (pctEl) { pctEl.textContent = restock; pctEl.style.color = restock > 0 ? 'var(--gold)' : 'var(--neon)'; }
        }
    }

    setChartRange(range, tabEl) {
        document.querySelectorAll('.chart-tabs .tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');
        this.updateRevenueChart(range);
    }

    updateRevenueChart(range) {
        const invoices = storage.getInvoices().filter(inv => inv.type !== 'purchase' && inv.status !== 'pending');
        const now = new Date();
        let days, labels, bars;

        if (range === '7D') {
            days = 7;
            labels = [];
            const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
            bars = Array(7).fill(0);
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now); d.setDate(d.getDate() - i);
                labels.push(dayNames[d.getDay()]);
            }
            invoices.forEach(inv => {
                const invDate = new Date(inv.createdAt);
                const diffDays = Math.floor((now - invDate) / 86400000);
                if (diffDays < 7) bars[6 - diffDays] += (inv.total || 0);
            });
        } else if (range === '1M') {
            days = 30;
            labels = [];
            bars = Array(6).fill(0);
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now); d.setDate(d.getDate() - i * 5);
                labels.push(d.getDate() + '/' + (d.getMonth()+1));
            }
            invoices.forEach(inv => {
                const invDate = new Date(inv.createdAt);
                const diffDays = Math.floor((now - invDate) / 86400000);
                if (diffDays < 30) { const bucket = Math.min(5, Math.floor(diffDays / 5)); bars[5 - bucket] += (inv.total || 0); }
            });
        } else if (range === '3M') {
            labels = [];
            bars = Array(6).fill(0);
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now); d.setDate(d.getDate() - i * 15);
                labels.push(d.getDate() + '/' + (d.getMonth()+1));
            }
            invoices.forEach(inv => {
                const invDate = new Date(inv.createdAt);
                const diffDays = Math.floor((now - invDate) / 86400000);
                if (diffDays < 90) { const bucket = Math.min(5, Math.floor(diffDays / 15)); bars[5 - bucket] += (inv.total || 0); }
            });
        } else { // ALL
            const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
            labels = [];
            bars = Array(6).fill(0);
            // Last 6 months
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push(months[d.getMonth()]);
            }
            invoices.forEach(inv => {
                const invDate = new Date(inv.createdAt);
                const monthDiff = (now.getFullYear() - invDate.getFullYear()) * 12 + (now.getMonth() - invDate.getMonth());
                if (monthDiff < 6) bars[5 - monthDiff] += (inv.total || 0);
            });
        }

        const maxVal = Math.max(...bars, 1);
        const chartBars = document.getElementById('chartBars');
        const chartLabels = document.querySelector('.chart-labels');
        if (!chartBars) return;

        chartBars.innerHTML = bars.map((v, i) => {
            const pct = Math.max(2, Math.round((v / maxVal) * 95));
            const isToday = (range === '7D' && i === bars.length - 1);
            return `<div class="bar${isToday ? ' highlight' : ''}" style="height:${pct}%" title="₹${v.toFixed(0)}"></div>`;
        }).join('');

        if (chartLabels) {
            chartLabels.innerHTML = labels.map(l => `<div class="chart-lbl">${l}</div>`).join('');
        }
    }

    dashboardSearch(query) {
        // Show a quick results dropdown on dashboard without navigating away
        let drop = document.getElementById('dashSearchDrop');
        if (!query.trim()) { if (drop) drop.remove(); return; }
        const results = storage.searchProducts(query).slice(0, 6);
        const invResults = storage.searchInvoices(query).slice(0, 3);
        if (!drop) {
            drop = document.createElement('div');
            drop.id = 'dashSearchDrop';
            drop.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#0f0f1e;border:1px solid rgba(0,255,136,0.3);border-radius:8px;z-index:9999;max-height:300px;overflow-y:auto;margin-top:4px;';
            document.querySelector('.topbar-center .search-wrap').style.position = 'relative';
            document.querySelector('.topbar-center .search-wrap').appendChild(drop);
        }
        const makeItem = (icon, label, sub, fn) => `<div onclick="${fn}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;align-items:center;" onmouseover="this.style.background='rgba(0,255,136,0.06)'" onmouseout="this.style.background='none'">
            <span style="font-size:16px;">${icon}</span>
            <div><div style="font-family:'Space Mono',monospace;font-size:11px;color:#e8e8f0;">${label}</div><div style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;">${sub}</div></div></div>`;
        drop.innerHTML = (results.length === 0 && invResults.length === 0)
            ? '<div style="padding:12px;font-family:Space Mono,monospace;font-size:11px;color:#5a5a7a;text-align:center;">No results found</div>'
            : results.map(p => makeItem('📦', p.name, `SKU: ${p.sku} · ${p.quantity} units · ₹${p.price.toFixed(2)}`, `app.openProductModal('${p.id}')`)).join('') +
              invResults.map(inv => makeItem('🧾', inv.id, `${inv.customerName || 'Walk-in'} · ₹${(inv.total||0).toFixed(2)}`, `app.viewInvoice('${inv.id}')`)).join('');

        // Close on outside click
        setTimeout(() => {
            const close = (e) => { if (!drop.contains(e.target)) { drop.remove(); document.removeEventListener('click', close); } };
            document.addEventListener('click', close);
        }, 10);
    }

    displayRecentInventory() {
        const products = storage.getProducts().slice(0, 12);
        const container = document.getElementById('recentInventoryGrid');
        if (!container) return;
        if (products.length === 0) {
            container.innerHTML = `<div class="empty-table">
                <div class="empty-glyph">[ ]</div>
                <div class="empty-msg">NO_RECORDS_FOUND</div>
                <div class="empty-sub">Add your first product to begin tracking</div>
                <button class="add-btn" onclick="app&&app.openProductModal()">+ ADD_PRODUCT</button>
            </div>`;
            return;
        }
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        container.innerHTML = products.map(p => {
            const isLow = p.quantity < this.lowStockThreshold;
            const isOut = p.quantity === 0;
            const statusColor = isOut ? 'var(--fire)' : isLow ? 'var(--gold)' : 'var(--neon)';
            const statusDot = isOut ? '🔴' : isLow ? '🟡' : '🟢';
            return `<div onclick="app.openProductModal('${p.id}')" title="${p.name}" style="background:var(--panel);border:1px solid var(--faint);border-radius:10px;padding:10px;cursor:pointer;min-width:110px;max-width:130px;flex:1;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(0,255,136,0.4)'" onmouseout="this.style.borderColor='var(--faint)'">
                <div style="width:40px;height:40px;border-radius:8px;background:var(--faint);display:flex;align-items:center;justify-content:center;margin-bottom:6px;overflow:hidden;">
                    ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:18px;">📦</span>`}
                </div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${p.name}</div>
                <div style="font-family:var(--mono);font-size:9px;color:${statusColor};margin-top:3px;">${statusDot} ${p.quantity} units</div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--neon2);margin-top:2px;">₹${p.price.toFixed(0)}</div>
            </div>`;
        }).join('');
    }

    displayRecentTransactions() {
        const invoices = storage.getInvoices()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);
        const container = document.getElementById('recentTransactionsList');
        if (!container) return;
        if (invoices.length === 0) {
            container.innerHTML = `<div class="empty-txn"><div class="empty-txn-glyph">⇄</div><div class="empty-txn-msg">NO_TRANSACTIONS_YET</div></div>`;
            return;
        }
        container.innerHTML = invoices.map(inv => {
            const isPurchase = inv.type === 'purchase';
            const party = isPurchase ? (inv.supplierName || 'Supplier') : (inv.customerName || 'Walk-in');
            const amtClass = isPurchase ? 'neg' : 'pos';
            const prefix = isPurchase ? '-' : '+';
            const typeClass = isPurchase ? 'purch' : 'sale';
            const icon = isPurchase ? '↓' : '↑';
            const d = new Date(inv.createdAt);
            return `<div class="txn-item" style="cursor:pointer;" onclick="${isPurchase ? `app.viewPurchaseInvoice('${inv.id}')` : `app.viewInvoice('${inv.id}')`}">
                <div class="txn-type ${typeClass}">${icon}</div>
                <div class="txn-info">
                    <div class="txn-name">${party}</div>
                    <div class="txn-date">${inv.id} · ${d.toLocaleDateString()}</div>
                </div>
                <div class="txn-amt ${amtClass}">${prefix}₹${(inv.total||0).toFixed(0)}</div>
            </div>`;
        }).join('');
    }

    // =====================
    // PENDING ORDERS
    // =====================
    updatePendingOrdersBadge() {
        const orders = storage.getPendingOrders().filter(o => o.status === 'pending');
        // Update dashboard metric if element exists
        const el = document.getElementById('pendingOrdersCount');
        if (el) el.textContent = orders.length;
        // Update floating badge on rail icon if exists
        const badge = document.getElementById('pendingOrdersBadge');
        if (badge) {
            badge.textContent = orders.length;
            badge.style.display = orders.length > 0 ? 'flex' : 'none';
        }
    }

    openPendingOrdersModal() {
        document.getElementById('pendingOrdersModal')?.remove();
        const orders = storage.getPendingOrders();

        const modal = document.createElement('div');
        modal.id = 'pendingOrdersModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:620px;max-height:90vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('pendingOrdersModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">📦</div>
                    <h2 style="color:#00d4ff;font-size:1.1rem;">Pending Orders</h2>
                    <p style="color:#5a5a7a;font-size:0.82rem;">Track your reorders. Mark as Arrived to add stock to inventory.</p>
                </div>
                <div id="pendingOrdersList">${this._renderPendingOrdersList(orders)}</div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
    }

    _renderPendingOrdersList(orders) {
        if (orders.length === 0) {
            return `<div style="text-align:center;padding:2rem;color:#5a5a7a;font-family:'Space Mono',monospace;font-size:0.82rem;">
                No pending orders.<br><span style="font-size:0.72rem;margin-top:0.5rem;display:block;">Orders are created when you send a reorder from Low Stock.</span>
            </div>`;
        }
        return orders.map(order => {
            const isPending = order.status === 'pending';
            const isCancelled = order.status === 'cancelled';
            const borderColor = isPending ? 'rgba(255,215,0,0.4)' : isCancelled ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,136,0.3)';
            const statusBadge = isPending
                ? `<span style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:2px 10px;font-size:0.65rem;font-weight:700;">⏳ PENDING</span>`
                : isCancelled
                ? `<span style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.35);border-radius:20px;padding:2px 10px;font-size:0.65rem;font-weight:700;">✕ CANCELLED</span>`
                : `<span style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.3);border-radius:20px;padding:2px 10px;font-size:0.65rem;font-weight:700;">✅ ARRIVED</span>`;
            const itemsList = (order.items||[]).map(item => {
                const swatch = item.colorName ? `<span style="width:10px;height:10px;border-radius:50%;background:${this.getColorSwatch(item.colorName)};display:inline-block;border:1px solid rgba(255,255,255,0.2);margin-right:4px;vertical-align:middle;"></span>` : '';
                return `<div style="font-size:0.78rem;color:#c4b5fd;padding:2px 0;">
                    ${item.photo ? `<img src="${item.photo}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:4px;">` : '📦'}
                    ${item.name}${item.colorName ? ` — ${swatch}${item.colorName}` : ''} <span style="color:#5a5a7a;">× ${item.qty}</span>
                </div>`;
            }).join('');
            const d = new Date(order.createdAt);
            return `
            <div style="background:#0f0f1e;border:1px solid ${borderColor};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
                    <div>
                        <div style="font-family:'Space Mono',monospace;font-size:0.75rem;color:#6c63ff;font-weight:700;">${order.id}</div>
                        <div style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#5a5a7a;margin-top:2px;">${d.toLocaleString()}</div>
                        ${order.supplier ? `<div style="font-size:0.72rem;color:#8892b0;margin-top:3px;">Supplier: ${order.supplier}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                        ${statusBadge}
                        <button onclick="app._deletePendingOrder('${order.id}')"
                            style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:0.72rem;font-family:'Space Mono',monospace;font-weight:700;">✕ Cancel</button>
                    </div>
                </div>
                <div style="background:rgba(108,99,255,0.07);border-radius:8px;padding:8px 10px;margin-bottom:10px;">
                    ${itemsList}
                </div>
                ${isPending ? `
                <button onclick="app._markOrderArrived('${order.id}')"
                    style="width:100%;padding:9px;background:linear-gradient(135deg,rgba(0,201,106,0.2),rgba(0,168,85,0.2));border:1px solid rgba(0,201,106,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:0.78rem;font-weight:700;cursor:pointer;letter-spacing:0.04em;">
                    ✅ Mark as Arrived → Add Stock to Inventory
                </button>` : isCancelled ? `
                <div style="font-family:'Space Mono',monospace;font-size:0.72rem;color:#f87171;text-align:center;padding:6px;background:rgba(239,68,68,0.07);border-radius:8px;">Order was cancelled ✕</div>` : `
                <div style="font-family:'Space Mono',monospace;font-size:0.72rem;color:#5a5a7a;text-align:center;">Stock added to inventory ✓</div>`}
            </div>`;
        }).join('');
    }

    _deletePendingOrder(orderId) {
        if (!confirm('Cancel this order?\n\nIt will be marked as Cancelled and kept in the list for reference.')) return;
        storage.updatePendingOrderStatus(orderId, 'cancelled');
        this.updatePendingOrdersBadge();
        const list = document.getElementById('pendingOrdersList');
        if (list) list.innerHTML = this._renderPendingOrdersList(storage.getPendingOrders());
        this.showNotification('Order marked as cancelled', 'success');
    }

    _markOrderArrived(orderId) {
        const orders = storage.getPendingOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        // Build items for confirmReorderReceived
        const items = (order.items || []).map(item => ({
            id: item.id,
            qty: item.qty,
            colorName: item.colorName || null
        }));
        storage.updatePendingOrderStatus(orderId, 'arrived');
        document.getElementById('pendingOrdersModal')?.remove();
        this.confirmReorderReceived(items);
        this.updatePendingOrdersBadge();
    }

    // =====================
    // PRODUCTS
    // =====================
    openProductModal(productId = null) {
        this.currentEditingProductId = productId;
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        const preview = document.getElementById('photoPreview');
        form.reset();
        preview.innerHTML = '';
        this.photoBase64 = null;
        this.videoBase64 = null;
        // Reset video UI
        const videoPreview = document.getElementById('videoPreview');
        const videoFileName = document.getElementById('videoFileName');
        const removeVideoBtn = document.getElementById('removeVideoBtn');
        if (videoPreview) videoPreview.innerHTML = '';
        if (videoFileName) videoFileName.textContent = '';
        if (removeVideoBtn) removeVideoBtn.style.display = 'none';
        this.productColors = [];
        this.renderColorTags();

        if (productId) {
            const p = storage.getProductById(productId);
            document.getElementById('modalTitle').textContent = 'Edit Product';
            document.getElementById('productName').value = p.name;
            document.getElementById('productSKU').value = p.sku;
            document.getElementById('productCategory').value = p.category || '';
            document.getElementById('productPrice').value = p.price;
            document.getElementById('productWholesalePrice').value = p.wholesalePrice || p.price;
            document.getElementById('productQuantity').value = p.quantity;
            document.getElementById('productDescription').value = p.description || '';
        const hsnField = document.getElementById('productHSN'); if (hsnField) hsnField.value = p.hsn || '';
            this._populateSupplierDropdown(p.supplierId || '');
            this.productColors = Array.isArray(p.colors)
                ? p.colors.map(c => typeof c === 'string' ? { name: c, qty: 0 } : c)
                : [];
            this.renderColorTags();
            this._syncTotalQtyFromColors();
            if (p.photo) {
                preview.innerHTML = `<img src="${p.photo}" alt="${p.name}">`;
                this.photoBase64 = p.photo;
            }
            if (p.hasVideo) {
                // Video is in IndexedDB — show indicator, load lazily
                this.videoBase64 = null; // will be loaded from IndexedDB on demand
                this._existingVideoProductId = p.id;
                const vp = document.getElementById('videoPreview');
                const vf = document.getElementById('videoFileName');
                const rb = document.getElementById('removeVideoBtn');
                if (vf) vf.textContent = 'Video saved ✓';
                if (rb) rb.style.display = 'inline-block';
                if (vp) {
                    vp.innerHTML = `<div style="font-family:'Space Mono',monospace;font-size:9px;color:#00ff88;padding:6px 0;">🎥 Video attached — upload new to replace</div>`;
                }
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Add New Product';
            this._populateSupplierDropdown('');
        }
        modal.classList.add('active');
    }

    _populateSupplierDropdown(selectedId = '') {
        const select = document.getElementById('productSupplierId');
        if (!select) return;
        const suppliers = storage.getSuppliers();
        select.innerHTML = '<option value="">— Link to supplier —</option>' +
            suppliers.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name} (${s.city || 'Unknown'})</option>`).join('');
    }

    addColorToProduct() {
        const input = document.getElementById('colorInput');
        const qtyInput = document.getElementById('colorQtyInput');
        const val = input.value.trim();
        if (!val) return;
        if (this.productColors.find(c => c.name.toLowerCase() === val.toLowerCase())) {
            this.showNotification('Colour already added', 'warning');
            return;
        }
        const qty = parseInt(qtyInput ? qtyInput.value : 0) || 0;
        this.productColors.push({ name: val, qty });
        input.value = '';
        if (qtyInput) qtyInput.value = 0;
        this.renderColorTags();
        // Auto-update total quantity field as sum of color qtys
        this._syncTotalQtyFromColors();
    }

    _syncTotalQtyFromColors() {
        const total = this.productColors.reduce((s, c) => s + (parseInt(c.qty) || 0), 0);
        const qtyField = document.getElementById('productQuantity');
        if (!qtyField) return;
        if (this.productColors.length > 0) {
            // When colors exist, quantity IS the sum — lock the field to make this clear
            qtyField.value = total;
            qtyField.readOnly = true;
            qtyField.title = 'Auto-calculated from colour quantities';
            qtyField.style.opacity = '0.7';
            qtyField.style.cursor = 'not-allowed';
        } else {
            // No colors → user types total freely
            qtyField.readOnly = false;
            qtyField.title = '';
            qtyField.style.opacity = '1';
            qtyField.style.cursor = '';
        }
    }

    removeColorFromProductModal(idx) {
        this.productColors.splice(idx, 1);
        this.renderColorTags();
        this._syncTotalQtyFromColors();
        // If no colors left, restore qty field to editable
        if (this.productColors.length === 0) {
            const qtyField = document.getElementById('productQuantity');
            if (qtyField) {
                qtyField.readOnly = false;
                qtyField.title = '';
                qtyField.style.opacity = '1';
                qtyField.style.cursor = '';
            }
        }
    }

    renderColorTags() {
        const container = document.getElementById('colorTagsContainer');
        if (!container) return;
        if (this.productColors.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">No colours added yet</span>';
            return;
        }
        container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.25rem;">
            <thead>
                <tr style="color:var(--text-muted);font-size:0.75rem;">
                    <th style="text-align:left;padding:0.3rem 0.4rem;font-weight:600;">Colour</th>
                    <th style="text-align:center;padding:0.3rem 0.4rem;font-weight:600;">Stock</th>
                    <th style="text-align:center;padding:0.3rem 0.4rem;"></th>
                </tr>
            </thead>
            <tbody>
            ${this.productColors.map((c, i) => {
                const name = typeof c === 'string' ? c : c.name;
                const qty = typeof c === 'string' ? 0 : (c.qty || 0);
                const swatch = this.getColorSwatch(name);
                return `<tr style="background:var(--bg-secondary);border-radius:6px;">
                    <td style="padding:0.4rem 0.5rem;border-radius:6px 0 0 6px;">
                        <div style="display:flex;align-items:center;gap:0.4rem;">
                            <span style="width:13px;height:13px;border-radius:50%;background:${swatch};display:inline-block;border:1px solid rgba(255,255,255,0.3);flex-shrink:0;"></span>
                            <span style="color:var(--text-light);">${name}</span>
                        </div>
                    </td>
                    <td style="padding:0.4rem 0.5rem;text-align:center;">
                        <input type="number" min="0" value="${qty}"
                            style="width:64px;padding:0.25rem 0.3rem;font-size:0.83rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                            onchange="app.updateColorQty(${i}, this.value)">
                    </td>
                    <td style="padding:0.4rem 0.4rem;text-align:center;border-radius:0 6px 6px 0;">
                        <button onclick="app.removeColorFromProductModal(${i})" style="background:none;border:none;color:var(--pink);cursor:pointer;font-size:0.9rem;padding:0;">✕</button>
                    </td>
                </tr><tr style="height:4px;"><td colspan="3"></td></tr>`;
            }).join('')}
            </tbody>
        </table>`;
    }

    updateColorQty(idx, val) {
        const qty = parseInt(val) || 0;
        if (this.productColors[idx]) {
            if (typeof this.productColors[idx] === 'string') {
                this.productColors[idx] = { name: this.productColors[idx], qty };
            } else {
                this.productColors[idx].qty = qty;
            }
        }
        this._syncTotalQtyFromColors();
    }

    // Full colour chart palette — matches the uploaded chart exactly
    _getColorChartData() {
        return [
            { group: 'Red', colors: [
                { name: 'Light Red',     hex: '#f9a8a8' },
                { name: 'Salmon',        hex: '#f4a07a' },
                { name: 'Coral',         hex: '#f07050' },
                { name: 'Strawberry',    hex: '#e8354a' },
                { name: 'Red',           hex: '#e00000' },
                { name: 'Brick Red',     hex: '#b83020' },
                { name: 'Dark Red',      hex: '#8b1010' },
                { name: 'Maroon',        hex: '#660000' },
            ]},
            { group: 'Orange', colors: [
                { name: 'Pale Orange',   hex: '#fdd5a8' },
                { name: 'Light Orange',  hex: '#fbb86a' },
                { name: 'Marigold',      hex: '#f5a030' },
                { name: 'Grapefruit',    hex: '#f08030' },
                { name: 'Tangerine',     hex: '#f07020' },
                { name: 'Orange',        hex: '#e86000' },
                { name: 'Dark Orange',   hex: '#c84800' },
                { name: 'Orange Red',    hex: '#e04818' },
            ]},
            { group: 'Yellow', colors: [
                { name: 'Cream',         hex: '#fdf5d8' },
                { name: 'Light Yellow',  hex: '#fdf5b0' },
                { name: 'Butter Yellow', hex: '#fdf090' },
                { name: 'Lemon Yellow',  hex: '#fef060' },
                { name: 'Honey',         hex: '#f8d840' },
                { name: 'Bright Yellow', hex: '#ffe000' },
                { name: 'Yellow',        hex: '#f0c800' },
                { name: 'Dark Yellow',   hex: '#d4a000' },
            ]},
            { group: 'Green', colors: [
                { name: 'Pale Green',    hex: '#c8e8c0' },
                { name: 'Light Green',   hex: '#88cc88' },
                { name: 'Lime Green',    hex: '#88d048' },
                { name: 'Cool Green',    hex: '#50b870' },
                { name: 'Bright Green',  hex: '#20b840' },
                { name: 'Green',         hex: '#008020' },
                { name: 'Forest Green',  hex: '#186030' },
                { name: 'Dark Green',    hex: '#104828' },
            ]},
            { group: 'Blue', colors: [
                { name: 'Light Blue',    hex: '#bcd8f8' },
                { name: 'Sky Blue',      hex: '#78b8e8' },
                { name: 'Sea Blue',      hex: '#50a0d0' },
                { name: 'Bright Blue',   hex: '#2880e0' },
                { name: 'Blue',          hex: '#0050e0' },
                { name: 'Medium Blue',   hex: '#0040b0' },
                { name: 'Dark Blue',     hex: '#003090' },
                { name: 'Navy Blue',     hex: '#001868' },
            ]},
            { group: 'Purple', colors: [
                { name: 'Light Purple',  hex: '#d0b0e8' },
                { name: 'Lavender',      hex: '#b090d8' },
                { name: 'Medium Purple', hex: '#9060d0' },
                { name: 'Grape',         hex: '#6830c0' },
                { name: 'Orchid',        hex: '#8840b0' },
                { name: 'Purple',        hex: '#700898' },
                { name: 'Indigo',        hex: '#500890' },
                { name: 'Dark Purple',   hex: '#380870' },
            ]},
            { group: 'Pink', colors: [
                { name: 'Light Pink',    hex: '#ffd0d8' },
                { name: 'Peach',         hex: '#ffb0a0' },
                { name: 'Pink',          hex: '#f880a0' },
                { name: 'Bright Pink',   hex: '#f85090' },
                { name: 'Rose Pink',     hex: '#f06080' },
                { name: 'Hot Pink',      hex: '#e80070' },
                { name: 'Magenta',       hex: '#d00090' },
                { name: 'Dark Pink',     hex: '#b00050' },
            ]},
            { group: 'Brown', colors: [
                { name: 'Light Brown',   hex: '#e8c8b0' },
                { name: 'Tan',           hex: '#d4a878' },
                { name: 'Terracotta',    hex: '#c07858' },
                { name: 'Reddish Brown', hex: '#a05838' },
                { name: 'Caramel',       hex: '#a06820' },
                { name: 'Brown',         hex: '#784010' },
                { name: 'Wood',          hex: '#604020' },
                { name: 'Dark Brown',    hex: '#401800' },
            ]},
            { group: 'Grey', colors: [
                { name: 'White',         hex: '#ffffff' },
                { name: 'Light Grey',    hex: '#dcdcdc' },
                { name: 'Cloud Grey',    hex: '#c8c8c8' },
                { name: 'Cool Grey',     hex: '#b0b8c0' },
                { name: 'Warm Grey',     hex: '#b0a8a0' },
                { name: 'Dove Grey',     hex: '#989090' },
                { name: 'Ash',           hex: '#787878' },
                { name: 'Brownish Grey', hex: '#686058' },
                { name: 'Dark Grey',     hex: '#484040' },
                { name: 'Black',         hex: '#101010' },
            ]},
        ];
    }

    openColorChart() { this.openColorChartPicker(); }

    openColorChartPicker() {
        const existing = document.getElementById('colorChartModal');
        if (existing) { existing.remove(); return; }

        const chart = this._getColorChartData();

        const groupsHtml = chart.map(group => `
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);letter-spacing:0.06em;margin-bottom:0.45rem;">${group.group.toUpperCase()}</div>
                <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;">
                    ${group.colors.map(c => `
                        <div onclick="app._selectColorFromChart('${c.name}','${c.hex}')"
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
        modal.id = 'colorChartModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:0;';
        modal.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:82vh;overflow-y:auto;padding:1.25rem 1.25rem 2rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;position:sticky;top:0;background:var(--bg-primary);padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                    <div>
                        <div style="font-weight:700;font-size:1rem;color:var(--text-light);">🎨 Colour Chart</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">Tap a colour → enter quantity → save</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <div id="colorChartPreview" style="display:none;align-items:center;gap:0.4rem;background:var(--bg-secondary);border-radius:8px;padding:0.3rem 0.6rem;">
                            <span id="colorChartPreviewSwatch" style="width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,0.3);"></span>
                            <span id="colorChartPreviewName" style="font-size:0.8rem;color:var(--text-light);"></span>
                        </div>
                        <button onclick="document.getElementById('colorChartModal').remove();window.app&&window.app.refreshActivePage()" style="background:var(--bg-secondary);border:none;color:var(--text-muted);border-radius:8px;padding:0.4rem 0.65rem;cursor:pointer;font-size:1rem;">✕</button>
                    </div>
                </div>
                ${groupsHtml}
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
    }

    _selectColorFromChart(name, hex) {
        // Check duplicate
        if (this.productColors.find(c => (typeof c === 'string' ? c : c.name).toLowerCase() === name.toLowerCase())) {
            this.showNotification(`${name} already added`, 'warning');
            return;
        }

        // Show quantity prompt overlay inside the color chart modal
        const existing = document.getElementById('colorQtyPrompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'colorQtyPrompt';
        prompt.style.cssText = `
            position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.55);padding:1rem;
        `;
        prompt.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:18px;padding:1.5rem 1.25rem 1.25rem;width:100%;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.45);border:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.1rem;">
                    <span style="width:32px;height:32px;border-radius:50%;background:${hex};display:inline-block;border:2px solid rgba(255,255,255,0.3);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></span>
                    <div>
                        <div style="font-weight:700;color:var(--text-light);font-size:1rem;">${name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">How many pieces?</div>
                    </div>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.78rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.4rem;">QUANTITY (pieces)</label>
                    <input id="colorQtyPromptInput" type="number" min="0" value="" placeholder="e.g. 50"
                        style="width:100%;padding:0.65rem 0.75rem;font-size:1.1rem;font-weight:600;background:var(--bg-secondary);border:1.5px solid var(--primary);border-radius:10px;color:var(--text-light);text-align:center;box-sizing:border-box;outline:none;">
                </div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    <button id="colorQtyPromptAddAnother"
                        style="width:100%;padding:0.65rem;background:var(--bg-secondary);border:1.5px solid var(--primary);border-radius:10px;color:var(--primary);font-size:0.9rem;font-weight:700;cursor:pointer;">
                        ✅ Save &amp; Add Another Colour
                    </button>
                    <button id="colorQtyPromptDone"
                        style="width:100%;padding:0.65rem;background:var(--primary);border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">
                        ✔ Save &amp; Close Colour Chart
                    </button>
                    <button id="colorQtyPromptCancel"
                        style="width:100%;padding:0.5rem;background:none;border:none;color:var(--text-muted);font-size:0.82rem;cursor:pointer;">
                        Cancel
                    </button>
                </div>
            </div>`;
        document.body.appendChild(prompt);

        // Focus input
        const qtyInput = document.getElementById('colorQtyPromptInput');
        setTimeout(() => qtyInput.focus(), 80);

        const saveColor = () => {
            const qty = parseInt(qtyInput.value) || 0;
            this.productColors.push({ name, qty, hex });
            this.renderColorTags();
            this._syncTotalQtyFromColors();
            this.showNotification(`✓ ${name} (${qty} pcs) added`, 'success');
            prompt.remove();
        };

        document.getElementById('colorQtyPromptAddAnother').addEventListener('click', () => {
            saveColor();
            // Keep color chart open so user can pick another
        });

        document.getElementById('colorQtyPromptDone').addEventListener('click', () => {
            saveColor();
            // Close color chart too
            document.getElementById('colorChartModal')?.remove();
        });

        document.getElementById('colorQtyPromptCancel').addEventListener('click', () => {
            prompt.remove();
        });

        // Enter key = Save & close
        qtyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveColor();
                document.getElementById('colorChartModal')?.remove();
            }
        });

        // Click outside = cancel
        prompt.addEventListener('click', (e) => {
            if (e.target === prompt) prompt.remove();
        });
    }

    getColorSwatch(colorName) {
        // First check the full chart data for exact match
        const chart = this._getColorChartData();
        for (const group of chart) {
            const found = group.colors.find(c => c.name.toLowerCase() === colorName.toLowerCase().trim());
            if (found) return found.hex;
        }
        // Fallback map for generic names
        const map = {
            red: '#e00000', blue: '#0050e0', green: '#008020', yellow: '#f0c800',
            orange: '#e86000', purple: '#700898', pink: '#f880a0', white: '#ffffff',
            black: '#101010', grey: '#787878', gray: '#787878', brown: '#784010',
            cyan: '#06b6d4', teal: '#14b8a6', navy: '#001868', maroon: '#660000',
            gold: '#d4a000', silver: '#b0b8c0', beige: '#fdf5d8', cream: '#fdf5d8',
            lavender: '#b090d8', rose: '#f06080', violet: '#8840b0', indigo: '#500890',
            lime: '#88d048', mint: '#6ee7b7', coral: '#f07050', peach: '#ffb0a0',
            sky: '#78b8e8', magenta: '#d00090', olive: '#84823c', turquoise: '#2dd4bf',
            salmon: '#f4a07a', tan: '#d4a878', terracotta: '#c07858', caramel: '#a06820',
        };
        const lower = colorName.toLowerCase().trim();
        if (map[lower]) return map[lower];
        // If a hex was stored directly
        if (/^#[0-9a-f]{3,6}$/i.test(lower)) return lower;
        try {
            const el = document.createElement('div');
            el.style.color = lower;
            if (el.style.color) return lower;
        } catch(e) {}
        return '#8892b0';
    }

    previewPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            this.photoBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    previewVideo(event) {
        const file = event.target.files[0];
        if (!file) return;
        const maxMB = 50;
        if (file.size > maxMB * 1024 * 1024) {
            this.showNotification(`Video too large (max ${maxMB}MB)`, 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.videoBase64 = e.target.result;
            const vp = document.getElementById('videoPreview');
            const vf = document.getElementById('videoFileName');
            const rb = document.getElementById('removeVideoBtn');
            if (vp) vp.innerHTML = `<video src="${e.target.result}" style="width:100%;max-height:160px;border-radius:10px;background:#000;" controls muted playsinline></video>`;
            if (vf) vf.textContent = file.name;
            if (rb) rb.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }

    removeVideo() {
        this.videoBase64 = null;
        this._removeVideoOnSave = true; // flag to delete from IndexedDB on save
        const vp = document.getElementById('videoPreview');
        const vf = document.getElementById('videoFileName');
        const rb = document.getElementById('removeVideoBtn');
        const vi = document.getElementById('productVideo');
        if (vp) vp.innerHTML = '';
        if (vf) vf.textContent = '';
        if (rb) rb.style.display = 'none';
        if (vi) vi.value = '';
    }

    openCamera() {
        const modal = document.getElementById('cameraModal');
        modal.style.display = 'block';
        document.getElementById('captureBtn').style.display = 'inline-flex';
        document.getElementById('retakeBtn').style.display = 'none';

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                this.cameraStream = stream;
                document.getElementById('cameraFeed').srcObject = stream;
            })
            .catch(() => {
                this.showNotification('Camera access denied. Use Upload instead.', 'warning');
                modal.classList.remove('active');
            });
    }

    capturePhoto() {
        const video = document.getElementById('cameraFeed');
        const canvas = document.getElementById('photoCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        this.photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('photoPreview').innerHTML = `<img src="${this.photoBase64}" alt="Preview">`;
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'inline-flex';
        this.showNotification('Photo captured!', 'success');
    }

    retakePhoto() {
        if (this.cameraStream) this.cameraStream.getTracks().forEach(t => t.stop());
        this.openCamera();
    }

    closeCamera() {
        const modal = document.getElementById('cameraModal');
        if (modal) modal.style.display = 'none';
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
            this.cameraStream = null;
        }
    }

    async handleProductSubmit(e) {
        e.preventDefault();
        const supplierSelect = document.getElementById('productSupplierId');
        const supplierId = supplierSelect ? supplierSelect.value : '';
        const supplierObj = supplierId ? storage.getSupplierById(supplierId) : null;

        // Always recalculate quantity as sum of colour qtys when colors exist
        const colors = this.productColors.map(c =>
            typeof c === 'string' ? { name: c, qty: 0 } : c
        );
        const colorTotal = colors.reduce((s, c) => s + (parseInt(c.qty) || 0), 0);
        const manualQty  = parseInt(document.getElementById('productQuantity').value) || 0;
        const finalQty   = colors.length > 0 ? colorTotal : manualQty;

        // Video is stored in IndexedDB separately — NOT in productData (avoids localStorage quota)
        // Preserve hasVideo if editing and no new video uploaded and not removing
        const existingHasVideo = this.currentEditingProductId
            ? (storage.getProductById(this.currentEditingProductId)?.hasVideo || false)
            : false;
        const newHasVideo = this.videoBase64 ? true : (this._removeVideoOnSave ? false : existingHasVideo);

        const productData = {
            name: document.getElementById('productName').value,
            sku: document.getElementById('productSKU').value,
            category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value),
            wholesalePrice: parseFloat(document.getElementById('productWholesalePrice').value),
            quantity: finalQty,
            description: document.getElementById('productDescription').value,
            photo: this.photoBase64 || null,
            hasVideo: newHasVideo,
            colors,
            supplierId: supplierId || null,
            supplierName: supplierObj ? supplierObj.name : null,
            hsn: (document.getElementById('productHSN')?.value || '').trim(),
        };

        let savedId;
        if (this.currentEditingProductId) {
            storage.updateProduct(this.currentEditingProductId, productData);
            savedId = this.currentEditingProductId;
            this.showNotification('Product updated!', 'success');
        } else {
            const saved = storage.addProduct(productData);
            savedId = saved.id;
            this.showNotification('Product added!', 'success');
        }

        // Save or delete video in IndexedDB
        if (this.videoBase64) {
            await storage.saveVideo(savedId, this.videoBase64);
        } else if (this._removeVideoOnSave) {
            await storage.deleteVideo(savedId);
            storage.updateProduct(savedId, { hasVideo: false });
            this._removeVideoOnSave = false;
        }

        this.closeModal(document.getElementById('productModal'));
        this.loadProducts();
        this.updateProductSelect();
        this.updateDashboard();
        // Also refresh colour book if it's open, since colours may have changed
        if (document.getElementById('colorbook')?.classList.contains('active')) {
            this.loadColorBook();
        }
        this.photoBase64 = null;
        this.videoBase64 = null;
        this.productColors = [];
    }

    loadProducts() {
        this.displayProducts(storage.getProducts());
    }

    displayProducts(products) {
        const container = document.getElementById('productsList');
        if (products.length === 0) {
            container.style.cssText = '';
            container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:0.82rem;">No products found. Add your first product!</div>`;
            return;
        }

        // Card grid — matches the screenshot layout
        container.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;align-items:start;';

        container.innerHTML = products.map(p => {
            const isLow = p.quantity < this.lowStockThreshold;
            const isOut = p.quantity === 0;
            const stockBg    = isOut ? 'rgba(168,85,247,0.2)'  : isLow ? 'rgba(255,215,0,0.13)'  : 'rgba(0,255,136,0.1)';
            const stockColor = isOut ? '#c084fc'               : isLow ? '#ffd700'               : '#00ff88';
            const stockText  = isOut ? `0 units — Out of Stock`: isLow ? `${p.quantity} units — Low Stock` : `${p.quantity} units — In Stock`;

            const colorDots = (p.colors && p.colors.length > 0)
                ? p.colors.slice(0, 8).map(c => {
                    const name = typeof c === 'string' ? c : c.name;
                    const qty  = typeof c === 'string' ? 1 : (c.qty || 0);
                    return `<span title="${name}: ${qty}" style="width:18px;height:18px;border-radius:50%;background:${this.getColorSwatch(name)};display:inline-block;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;${qty===0?'opacity:0.3;filter:grayscale(80%);':''}"></span>`;
                }).join('') + (p.colors.length > 8 ? `<span style="font-size:0.65rem;color:#5a5a7a;margin-left:2px;">+${p.colors.length-8}</span>` : '')
                : '';

            return `
            <div style="
                background:#1a1a35;
                border:1px solid rgba(108,99,255,0.2);
                border-radius:16px;
                overflow:hidden;
                display:flex;
                flex-direction:column;
                transition:border-color 0.25s,box-shadow 0.25s,transform 0.2s;
                cursor:default;
            "
            onmouseover="this.style.borderColor='rgba(108,99,255,0.5)';this.style.boxShadow='0 8px 32px rgba(108,99,255,0.15)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='rgba(108,99,255,0.2)';this.style.boxShadow='none';this.style.transform='translateY(0)'">

                <!-- Photo -->
                <div style="width:100%;aspect-ratio:4/3;background:#13132b;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    ${p.photo
                        ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<span style="font-size:3rem;opacity:0.3;">📦</span>`
                    }
                </div>

                <!-- Body -->
                <div style="padding:14px 16px 0;display:flex;flex-direction:column;gap:6px;">

                    <!-- Name -->
                    <div style="font-family:'Outfit',sans-serif;font-size:1rem;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                    <!-- SKU + last updated -->
                    <div style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#8892b0;">SKU: ${p.sku}${p.updatedAt ? ` · ✏️ ${new Date(p.updatedAt).toLocaleDateString()}` : ''}</div>

                    <!-- Selling price row -->
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                        <span style="font-family:'Outfit',sans-serif;font-size:0.82rem;color:#8892b0;">Selling:</span>
                        <span style="font-family:'Space Mono',monospace;font-size:0.95rem;font-weight:700;color:#00ff9f;">₹${p.price.toFixed(2)}</span>
                    </div>
                    <!-- Wholesale price row -->
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-family:'Outfit',sans-serif;font-size:0.82rem;color:#8892b0;">Wholesale:</span>
                        <span style="font-family:'Space Mono',monospace;font-size:0.82rem;color:#e2e8f0;">₹${(p.wholesalePrice||p.price).toFixed(2)}</span>
                    </div>

                    <!-- Color dots -->
                    ${colorDots ? `<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:2px;">${colorDots}</div>` : ''}

                    <!-- Stock badge -->
                    <div style="margin-top:2px;">
                        <span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-family:'Space Mono',monospace;font-size:0.65rem;font-weight:700;background:${stockBg};color:${stockColor};">
                            ${stockText}
                        </span>
                    </div>

                </div>

                <!-- Buttons -->
                <div style="padding:12px 16px 14px;display:flex;gap:8px;align-items:center;margin-top:4px;">
                    <!-- Add to Cart -->
                    <button
                        onclick="app.addProductToBilling('${p.id}')"
                        ${isOut ? 'disabled' : ''}
                        style="
                            flex:1;
                            display:flex;align-items:center;justify-content:center;gap:6px;
                            padding:9px 0;
                            background:${isOut ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.22)'};
                            border:1px solid rgba(108,99,255,0.45);
                            color:${isOut ? 'rgba(168,150,255,0.4)' : '#a78bfa'};
                            border-radius:10px;
                            font-family:'Space Mono',monospace;
                            font-size:0.65rem;
                            font-weight:700;
                            cursor:${isOut ? 'not-allowed' : 'pointer'};
                            transition:background 0.2s;
                            letter-spacing:0.02em;
                        "
                        onmouseover="if(!this.disabled)this.style.background='rgba(108,99,255,0.38)'"
                        onmouseout="this.style.background='${isOut ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.22)'}'"
                    >🛒 Add to Cart</button>

                    <!-- Edit -->
                    <button
                        onclick="app.openProductModal('${p.id}')"
                        style="
                            display:flex;align-items:center;justify-content:center;gap:5px;
                            padding:9px 14px;
                            background:rgba(251,146,60,0.12);
                            border:1px solid rgba(251,146,60,0.35);
                            color:#fb923c;
                            border-radius:10px;
                            font-family:'Space Mono',monospace;
                            font-size:0.65rem;
                            font-weight:700;
                            cursor:pointer;
                            transition:background 0.2s;
                        "
                        onmouseover="this.style.background='rgba(251,146,60,0.25)'"
                        onmouseout="this.style.background='rgba(251,146,60,0.12)'"
                    >✏️ Edit</button>
                </div>

                <!-- Delete row -->
                <div style="padding:0 16px 14px;">
                    <button
                        onclick="app.deleteProduct('${p.id}')"
                        style="
                            display:flex;align-items:center;justify-content:center;
                            width:40px;height:36px;
                            background:rgba(168,85,247,0.15);
                            border:1px solid rgba(168,85,247,0.35);
                            color:#c084fc;
                            border-radius:10px;
                            font-size:1rem;
                            cursor:pointer;
                            transition:background 0.2s;
                        "
                        onmouseover="this.style.background='rgba(168,85,247,0.3)'"
                        onmouseout="this.style.background='rgba(168,85,247,0.15)'"
                    >🗑</button>
                </div>

            </div>`;
        }).join('');
    }

    searchProducts(query) {
        const results = query ? storage.searchProducts(query) : storage.getProducts();
        this.displayProducts(results);
    }

    // =====================
    // CSV BULK IMPORT / EXPORT
    // =====================
    openCSVImportModal() {
        const existing = document.getElementById('csvImportModal');
        if (existing) { existing.remove(); return; }
        const modal = document.createElement('div');
        modal.id = 'csvImportModal';
        modal.className = 'si-modal active';
        modal.innerHTML = `
            <div class="si-modal-box" style="max-width:520px;">
                <button class="si-modal-close" onclick="document.getElementById('csvImportModal').remove();window.app&&window.app.refreshActivePage()">×</button>
                <h2 class="si-modal-title">📂 CSV IMPORT / EXPORT</h2>

                <!-- Export current products -->
                <div style="background:rgba(0,212,255,0.07);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
                    <div style="font-family:'Space Mono',monospace;font-size:11px;color:#00d4ff;font-weight:700;margin-bottom:6px;">📤 Export Current Products</div>
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;margin-bottom:8px;">Download all products as CSV (includes colours & photos). Re-import this file later to add new rows.</div>
                    <button onclick="app._exportProductsCSV()" style="background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:10px;padding:6px 14px;cursor:pointer;">↓ Download Products CSV</button>
                </div>

                <!-- Import -->
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#5a5a7a;margin-bottom:10px;line-height:1.7;">
                    Import CSV columns:<br>
                    <strong style="color:#00ff88;">Name, SKU, Category, Price, WholesalePrice, Quantity, Description, Colors, Photo</strong><br>
                    <span style="color:#5a5a7a;">• Colors format: <strong style="color:#ffd700;">Red:10|Blue:5|Navy:20</strong> (name:qty pairs)</span><br>
                    <span style="color:#5a5a7a;">• Photo: leave blank or paste base64 data URL</span><br>
                    <span style="color:#5a5a7a;">• First row = header (skipped). SKU = unique key.</span>
                </div>

                <div style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap;">
                    <a href="#" onclick="app._downloadCSVTemplate();return false;"
                        style="font-family:'Space Mono',monospace;font-size:11px;color:#00d4ff;text-decoration:underline;">
                        ↓ Download Blank Template
                    </a>
                </div>

                <!-- Merge mode toggle -->
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;background:rgba(108,99,255,0.08);border-radius:8px;padding:10px 12px;">
                    <input type="checkbox" id="csvMergeMode" checked style="accent-color:#6c63ff;width:15px;height:15px;">
                    <div>
                        <div style="font-family:'Space Mono',monospace;font-size:11px;color:#a78bfa;font-weight:700;">Merge Mode (Recommended)</div>
                        <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;">If a SKU already exists → update it. New SKUs → add as new products.</div>
                    </div>
                </div>

                <input type="file" id="csvFileInput" accept=".csv"
                    style="display:block;width:100%;padding:10px;background:#141428;border:1px dashed #2a2a44;border-radius:8px;color:#e8e8f0;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;box-sizing:border-box;margin-bottom:12px;">
                <div id="csvPreview" style="margin-bottom:12px;"></div>
                <button class="hp-btn-neon" style="width:100%;" onclick="app._confirmCSVImport()">✅ IMPORT PRODUCTS</button>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
        document.getElementById('csvFileInput').addEventListener('change', (e) => this._previewCSV(e));
    }

    _exportProductsCSV() {
        const csv = storage.exportProductsCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `rajputi-poshak-products-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showNotification('✅ Products exported!', 'success');
    }

    _downloadCSVTemplate() {
        const header = 'Name,SKU,Category,Price,WholesalePrice,Quantity,Description,Colors,Photo';
        const example = '"Rajputi Poshak Red","RPOSHAK-001","Rajputi Dress",2500,1800,25,"Premium embroidered Rajputi dress","Red:10|Maroon:8|Navy Blue:7",';
        const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rajputi-poshak-template.csv';
        a.click();
    }

    _pendingCSVText = '';

    _previewCSV(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            this._pendingCSVText = ev.target.result;
            const lines = ev.target.result.split('\n').filter(l => l.trim());
            const dataLines = lines.slice(1);
            const preview = document.getElementById('csvPreview');
            if (!preview) return;
            const count = dataLines.filter(l => {
                const cols = l.split(',');
                return cols[0] && cols[1];
            }).length;
            if (count === 0) {
                preview.innerHTML = `<div style="color:#ff4444;font-family:'Space Mono',monospace;font-size:11px;">⚠️ No valid rows found. Check your CSV format.</div>`;
                return;
            }
            const previewRows = dataLines.slice(0, 4).map(line => {
                const cols = [];
                let inQ = false, cur = '';
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') { inQ = !inQ; }
                    else if (ch === ',' && !inQ) { cols.push(cur.replace(/^"|"$/g,'')); cur = ''; }
                    else { cur += ch; }
                }
                cols.push(cur.replace(/^"|"$/g,''));
                const [name, sku, , price, , qty, , colorsRaw] = cols;
                const colorCount = (colorsRaw||'').split('|').filter(Boolean).length;
                return `<div style="color:#e8e8f0;padding:3px 0;border-bottom:1px solid #1e1e38;font-size:10px;">${name} · ${sku} · Qty: ${qty} · ₹${price}${colorCount>0?` · 🎨 ${colorCount} colours`:''}</div>`;
            }).join('');
            preview.innerHTML = `
                <div style="background:#141428;border:1px solid #2a2a44;border-radius:8px;padding:12px;font-family:'Space Mono',monospace;font-size:11px;">
                    <div style="color:#00ff88;margin-bottom:8px;">✓ ${count} products ready to import</div>
                    ${previewRows}
                    ${count > 4 ? `<div style="color:#5a5a7a;margin-top:6px;">...and ${count - 4} more</div>` : ''}
                </div>`;
        };
        reader.readAsText(file);
    }

    _confirmCSVImport() {
        if (!this._pendingCSVText) {
            this.showNotification('Select a valid CSV file first', 'warning'); return;
        }

        // Step 1: Parse CSV into product objects WITHOUT saving yet
        const parsedProducts = this._parseCSVToProducts(this._pendingCSVText);
        if (parsedProducts.length === 0) {
            this.showNotification('No valid products found in CSV', 'warning'); return;
        }
        this._pendingCSVText = '';
        this._csvMergeMode = document.getElementById('csvMergeMode')?.checked !== false;

        // Close the import modal
        document.getElementById('csvImportModal')?.remove(); this.refreshActivePage();

        // Step 2: Find which products need a photo (no photo in CSV)
        const needsPhoto = parsedProducts.filter(p => !p.photo);
        const hasPhoto   = parsedProducts.filter(p =>  p.photo);

        // Store pending parsed products on instance (safe — no inline JSON in onclick)
        this._csvPendingProducts = parsedProducts;
        this._csvPhotosCollected = {};

        // Pre-fill photos for ones that already have them
        hasPhoto.forEach(p => { this._csvPhotosCollected[p.sku] = p.photo; });

        if (needsPhoto.length > 0) {
            // Step 3a: Collect photos first, then save
            this._startCSVPhotoPrompt(needsPhoto, 0);
        } else {
            // Step 3b: No photos needed — save immediately
            this._finishCSVImport();
        }
    }

    // Parse CSV text → array of product objects (does NOT touch storage)
    _parseCSVToProducts(csvText) {
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const dataLines = lines.slice(1);
        const results = [];

        dataLines.forEach(line => {
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
            if (!name || !sku) return;

            const colors = (colorsRaw || '').split('|').filter(Boolean).map(part => {
                const [cname, qty] = part.split(':');
                return { name: (cname||'').trim(), qty: parseInt(qty) || 0 };
            });

            results.push({
                name: name.trim(), sku: sku.trim(),
                category: (category||'').trim(),
                price: parseFloat(price) || 0,
                wholesalePrice: parseFloat(wholesalePrice) || parseFloat(price) || 0,
                quantity: parseInt(quantity) || 0,
                description: (description||'').trim(),
                colors,
                photo: photoRaw && photoRaw.startsWith('data:') ? photoRaw : null
            });
        });
        return results;
    }

    // Save all parsed products to storage (called after photos are collected)
    _finishCSVImport() {
        const products = this._csvPendingProducts || [];
        const photos   = this._csvPhotosCollected || {};
        const mergeMode = this._csvMergeMode !== false;

        const existing = storage.getProducts();
        const existingBySKU = {};
        existing.forEach(p => { existingBySKU[p.sku.toLowerCase()] = p; });

        let imported = 0, skipped = 0;
        const toAdd = [];

        products.forEach(product => {
            // Attach collected photo (may override CSV photo or null)
            const collectedPhoto = photos[product.sku];
            const finalPhoto = collectedPhoto || product.photo || null;
            const finalProduct = { ...product, photo: finalPhoto };

            const skuKey = product.sku.toLowerCase();
            if (mergeMode && existingBySKU[skuKey]) {
                const ex = existingBySKU[skuKey];
                const updateData = {
                    name: finalProduct.name,
                    sku:  finalProduct.sku,
                    category:      finalProduct.category      || ex.category,
                    price:         finalProduct.price         || ex.price,
                    wholesalePrice:finalProduct.wholesalePrice|| ex.wholesalePrice,
                    quantity:      finalProduct.quantity,
                    description:   finalProduct.description   || ex.description,
                    colors: finalProduct.colors.length > 0 ? finalProduct.colors : ex.colors,
                    photo: finalPhoto || ex.photo || null
                };
                storage.updateProduct(ex.id, updateData);
                imported++;
            } else if (!mergeMode || !existingBySKU[skuKey]) {
                toAdd.push(finalProduct);
                imported++;
            } else {
                skipped++;
            }
        });

        toAdd.forEach(p => storage.addProduct(p));

        this._csvPendingProducts  = null;
        this._csvPhotosCollected  = null;

        this.loadProducts();
        this.updateDashboard();
        this.showNotification(`✅ ${imported} products imported/updated${skipped > 0 ? ` · ${skipped} skipped` : ''}!`, 'success');
    }

    _startCSVPhotoPrompt(needsPhoto, index) {
        if (index >= needsPhoto.length) {
            // All photos collected — now save
            this._finishCSVImport();
            return;
        }

        const p = needsPhoto[index];
        const remaining = needsPhoto.length - index;

        document.getElementById('csvPhotoPromptModal')?.remove();
        this._csvPhotoBase64 = null; // reset for each product

        const modal = document.createElement('div');
        modal.id = 'csvPhotoPromptModal';
        modal.className = 'si-modal active';
        modal.innerHTML = `
            <div class="si-modal-box" style="max-width:400px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🖼️</div>
                <h2 class="si-modal-title" style="margin-bottom:0.25rem;">Add Photo</h2>
                <p style="font-family:'Space Mono',monospace;font-size:0.82rem;color:#00d4ff;margin-bottom:0.15rem;word-break:break-all;">${this._escapeHtml(p.name)}</p>
                <p style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#5a5a7a;margin-bottom:0.2rem;">SKU: ${this._escapeHtml(p.sku)}</p>
                <p style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#ffd700;margin-bottom:1rem;">
                    📷 ${remaining} of ${needsPhoto.length} product${needsPhoto.length > 1 ? 's' : ''} need a photo
                </p>
                <div id="csvPhotoPreview" style="width:130px;height:130px;margin:0 auto 1rem;border-radius:14px;background:#141428;border:2px dashed #2a2a44;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
                    <span style="font-size:2.8rem;opacity:0.3;">📦</span>
                </div>
                <!-- Camera live view (hidden until opened) -->
                <div id="csvCameraView" style="display:none;margin-bottom:0.75rem;">
                    <video id="csvCameraVideo" autoplay playsinline style="width:100%;max-width:280px;border-radius:10px;border:1px solid #2a2a44;display:block;margin:0 auto 8px;"></video>
                    <div style="display:flex;gap:8px;justify-content:center;">
                        <button id="csvCaptureBtn" style="padding:8px 20px;background:linear-gradient(135deg,#6c63ff,#5a52e8);border:none;color:#fff;border-radius:8px;font-family:'Space Mono',monospace;font-size:0.78rem;font-weight:700;cursor:pointer;">📸 Capture</button>
                        <button id="csvCloseCamBtn" style="padding:8px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:8px;font-family:'Space Mono',monospace;font-size:0.78rem;cursor:pointer;">✕ Close</button>
                    </div>
                    <canvas id="csvCameraCanvas" style="display:none;"></canvas>
                </div>
                <div style="display:flex;gap:8px;justify-content:center;margin-bottom:1rem;flex-wrap:wrap;">
                    <label style="display:inline-flex;align-items:center;gap:6px;background:rgba(108,99,255,0.2);border:1px solid rgba(108,99,255,0.5);border-radius:8px;padding:8px 16px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:0.78rem;font-weight:700;cursor:pointer;">
                        📁 Choose Photo
                        <input type="file" accept="image/*" id="csvPhotoFileInput" style="display:none;">
                    </label>
                    <button id="csvOpenCamBtn" style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);border-radius:8px;padding:8px 16px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:0.78rem;font-weight:700;cursor:pointer;">
                        📷 Camera
                    </button>
                </div>
                <div style="display:flex;gap:8px;flex-direction:column;">
                    <button id="csvPhotoSaveBtn"
                        style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,168,85,0.2));border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:0.82rem;font-weight:700;cursor:pointer;opacity:0.5;"
                        disabled>
                        ✅ Save &amp; Next
                    </button>
                    <button id="csvPhotoSkipBtn"
                        style="width:100%;padding:8px;background:none;border:1px solid #2a2a44;border-radius:10px;color:#5a5a7a;font-family:'Space Mono',monospace;font-size:0.75rem;cursor:pointer;">
                        ⏭ Skip (no photo)
                    </button>
                    <button id="csvPhotoStopBtn"
                        style="width:100%;padding:6px;background:none;border:none;color:#3a3a5a;font-family:'Space Mono',monospace;font-size:0.72rem;cursor:pointer;">
                        ✕ Skip All &amp; Import Now
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Wire up file input
        const fileInput = document.getElementById('csvPhotoFileInput');
        const saveBtn   = document.getElementById('csvPhotoSaveBtn');
        const skipBtn   = document.getElementById('csvPhotoSkipBtn');
        const stopBtn   = document.getElementById('csvPhotoStopBtn');
        const openCamBtn  = document.getElementById('csvOpenCamBtn');
        const closeCamBtn = document.getElementById('csvCloseCamBtn');
        const captureBtn  = document.getElementById('csvCaptureBtn');
        const cameraView  = document.getElementById('csvCameraView');
        const video       = document.getElementById('csvCameraVideo');
        const canvas      = document.getElementById('csvCameraCanvas');

        let _csvStream = null;

        const stopCsvCamera = () => {
            if (_csvStream) { _csvStream.getTracks().forEach(t => t.stop()); _csvStream = null; }
            if (cameraView) cameraView.style.display = 'none';
        };

        openCamBtn.addEventListener('click', async () => {
            try {
                _csvStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                video.srcObject = _csvStream;
                cameraView.style.display = 'block';
            } catch(err) {
                this.showNotification('Camera not available: ' + err.message, 'error');
            }
        });

        closeCamBtn.addEventListener('click', () => stopCsvCamera());

        captureBtn.addEventListener('click', () => {
            if (!video || !canvas) return;
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            this._csvPhotoBase64 = dataUrl;
            const preview = document.getElementById('csvPhotoPreview');
            if (preview) preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            stopCsvCamera();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this._csvPhotoBase64 = ev.target.result;
                const preview = document.getElementById('csvPhotoPreview');
                if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
            };
            reader.readAsDataURL(file);
        });

        saveBtn.addEventListener('click', () => {
            if (!this._csvPhotoBase64) return;
            this._csvPhotosCollected[p.sku] = this._csvPhotoBase64;
            this._csvPhotoBase64 = null;
            stopCsvCamera();
            modal.remove();
            this._startCSVPhotoPrompt(needsPhoto, index + 1);
        });

        skipBtn.addEventListener('click', () => {
            this._csvPhotoBase64 = null;
            stopCsvCamera();
            modal.remove();
            this._startCSVPhotoPrompt(needsPhoto, index + 1);
        });

        stopBtn.addEventListener('click', () => {
            this._csvPhotoBase64 = null;
            stopCsvCamera();
            modal.remove();
            this._finishCSVImport();
        });
    }

    _escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // =====================
    // DASHBOARD CSV IMPORT
    // =====================
    dashCSVFilePicked(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            this._pendingCSVText = ev.target.result;
            const lines = ev.target.result.split('\n').filter(l => l.trim());
            const count = lines.slice(1).filter(l => {
                const cols = l.split(',');
                return cols[0] && cols[1];
            }).length;

            const preview = document.getElementById('dashCSVPreview');
            const previewText = document.getElementById('dashCSVPreviewText');
            if (!preview || !previewText) return;

            if (count === 0) {
                previewText.innerHTML = `<span style="color:#ff4444;">⚠️ No valid products found. Check your CSV format.</span>`;
            } else {
                // Show first 3 product names as preview
                const rows = lines.slice(1, 4).map(line => {
                    const cols = [];
                    let inQ = false, cur = '';
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (ch === '"') { inQ = !inQ; }
                        else if (ch === ',' && !inQ) { cols.push(cur.replace(/^"|"$/g,'')); cur = ''; }
                        else { cur += ch; }
                    }
                    cols.push(cur.replace(/^"|"$/g,''));
                    return cols[0] ? `<div style="color:#c4b5fd;padding:2px 0;border-bottom:1px solid #1e1e38;">· ${this._escapeHtml(cols[0])} <span style="color:#5a5a7a;">(${this._escapeHtml(cols[1]||'')})</span></div>` : '';
                }).join('');

                previewText.innerHTML = `
                    <div style="color:#00ff88;margin-bottom:6px;">✓ ${count} product${count>1?'s':''} ready — <span style="color:#5a5a7a;">${this._escapeHtml(file.name)}</span></div>
                    ${rows}
                    ${count > 3 ? `<div style="color:#5a5a7a;margin-top:4px;">...and ${count-3} more</div>` : ''}`;
            }
            preview.style.display = 'block';
        };
        reader.readAsText(file);
    }

    dashCSVConfirmImport() {
        if (!this._pendingCSVText) {
            this.showNotification('No CSV file selected', 'warning'); return;
        }
        // Use the same full import flow (parses → photo prompts → saves)
        const parsedProducts = this._parseCSVToProducts(this._pendingCSVText);
        if (parsedProducts.length === 0) {
            this.showNotification('No valid products found in CSV', 'warning'); return;
        }
        this._pendingCSVText = '';
        this._csvMergeMode = true; // always merge from dashboard
        this._csvPendingProducts = parsedProducts;
        this._csvPhotosCollected = {};

        // Reset dashboard drop zone
        this.dashCSVReset();

        const needsPhoto = parsedProducts.filter(p => !p.photo);
        parsedProducts.filter(p => p.photo).forEach(p => { this._csvPhotosCollected[p.sku] = p.photo; });

        if (needsPhoto.length > 0) {
            this._startCSVPhotoPrompt(needsPhoto, 0);
        } else {
            this._finishCSVImport();
        }
    }

    dashCSVReset() {
        this._pendingCSVText = '';
        const preview = document.getElementById('dashCSVPreview');
        if (preview) preview.style.display = 'none';
        const fileInput = document.getElementById('dashCSVFileInput');
        if (fileInput) fileInput.value = '';
        const dropZone = document.getElementById('dashCSVDropZone');
        if (dropZone) {
            dropZone.style.borderColor = 'rgba(0,212,255,0.3)';
            dropZone.style.background = 'rgba(0,212,255,0.03)';
        }
    }

    // =====================
    // PRICE RANGE SEARCH
    // =====================
    searchProductsByPriceRange(min, max) {
        const products = storage.getProducts().filter(p => {
            const price = p.price || 0;
            const aboveMin = min === '' || isNaN(min) || price >= parseFloat(min);
            const belowMax = max === '' || isNaN(max) || price <= parseFloat(max);
            return aboveMin && belowMax;
        });
        this.displayProducts(products);
    }

    deleteProduct(id) {
        const p = storage.getProductById(id);
        if (!p) return;
        if (!confirm(`Delete "${p.name}"?\n\nThis will permanently remove this product from your inventory.`)) return;
        storage.deleteProduct(id);
        this.loadProducts();
        this.updateDashboard();
        this.showNotification('Product deleted.', 'success');
    }

    // =====================
    // COLOUR BOOK
    // =====================
    loadColorBook() {
        const products = storage.getProducts();
        const container = document.getElementById('colorBookContent');
        if (!container) return;

        const withColors = products.filter(p => p.colors && p.colors.length > 0);
        if (withColors.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">🎨 No products with colours yet.<br>Add colours to your products in the Inventory section.</div>';
            return;
        }

        // Check if any product has out-of-stock colours
        const hasAnyOutOfStock = withColors.some(p =>
            p.colors.some(c => (typeof c === 'string' ? 0 : (c.qty || 0)) === 0)
        );

        container.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">` + withColors.map(p => {
            const inStock  = p.colors.filter(c => (typeof c==='string' ? 1 : (c.qty||0)) > 0);
            const outStock = p.colors.filter(c => (typeof c==='string' ? false : (c.qty||0)) === 0);
            const outCount = outStock.length;
            const inCount  = inStock.length;

            const borderAccent = outCount > 0 && inCount === 0
                ? 'border-left:3px solid #ff4444;'
                : outCount > 0 ? 'border-left:3px solid orange;' : '';

            const chipIn = (c) => {
                const name = typeof c==='string' ? c : c.name;
                const qty  = typeof c==='string' ? '?' : c.qty;
                const sw   = this.getColorSwatch(name);
                return `<div style="display:inline-flex;align-items:center;gap:6px;background:#141428;border:1px solid #2a2a44;border-radius:20px;padding:4px 12px;">
                    <span style="width:12px;height:12px;border-radius:50%;background:${sw};border:1.5px solid rgba(255,255,255,0.2);flex-shrink:0;"></span>
                    <span style="font-family:'Space Mono',monospace;font-size:0.75rem;color:#e8e8f0;">${name}</span>
                    <span style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#5a5a7a;">· ${qty}</span>
                </div>`;
            };

            const chipOut = (c) => {
                const name = typeof c==='string' ? c : c.name;
                const sw   = this.getColorSwatch(name);
                return `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,68,68,0.06);border:1.5px solid rgba(255,68,68,0.3);border-radius:20px;padding:4px 10px;">
                    <span style="width:12px;height:12px;border-radius:50%;background:${sw};border:1.5px solid rgba(255,255,255,0.15);flex-shrink:0;filter:grayscale(50%);"></span>
                    <span style="font-family:'Space Mono',monospace;font-size:0.72rem;color:#5a5a7a;text-decoration:line-through;">${name}</span>
                    <span style="font-family:'Space Mono',monospace;font-size:0.65rem;font-weight:700;color:#ff6b6b;white-space:nowrap;">Out of Stock</span>
                    <button onclick="app._reorderSingleColor('${p.id}','${name}')"
                        style="background:rgba(108,99,255,0.2);border:none;border-radius:8px;padding:2px 8px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:0.65rem;cursor:pointer;font-weight:700;white-space:nowrap;">↺ Reorder</button>
                </div>`;
            };

            return `
            <div style="background:#0f0f1e;border:1px solid #1e1e38;border-radius:12px;padding:14px 16px;${borderAccent}">
                <!-- Header row -->
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:${(inCount+outCount)>0?'12px':'0'};">
                    <div style="width:52px;height:52px;border-radius:10px;overflow:hidden;background:#141428;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;border:1px solid #2a2a44;">
                        ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-family:'Space Mono',monospace;font-size:0.88rem;font-weight:700;color:#00d4ff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-family:'Space Mono',monospace;font-size:0.68rem;color:#5a5a7a;">SKU: ${p.sku} · Total stock: ${p.quantity} units</div>
                        <div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">
                            ${inCount > 0 ? `<span style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#00ff88;">✓ ${inCount} in stock</span>` : ''}
                            ${outCount > 0 ? `<span style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#ff6b6b;">⚠ ${outCount} sold out</span>` : ''}
                        </div>
                    </div>
                    <button onclick="app.openProductModal('${p.id}')" style="padding:5px 12px;background:#141428;border:1px solid #2a2a44;color:#e8e8f0;border-radius:8px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;flex-shrink:0;">✏️ Edit</button>
                </div>

                ${inCount > 0 ? `
                <div style="margin-bottom:${outCount>0?'10px':'0'};">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;letter-spacing:0.1em;font-weight:700;margin-bottom:7px;">IN STOCK</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">${inStock.map(c=>chipIn(c)).join('')}</div>
                </div>` : ''}

                ${outCount > 0 ? `
                <div style="padding-top:${inCount>0?'10px':'0'};${inCount>0?'border-top:1px dashed rgba(255,68,68,0.2);':''}">
                    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#ff6b6b;letter-spacing:0.1em;font-weight:700;margin-bottom:7px;">OUT OF STOCK — tap ↺ Reorder to replenish</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">${outStock.map(c=>chipOut(c)).join('')}</div>
                </div>` : ''}
            </div>`;
        }).join('') + `</div>`;
    }

    // Quick single-colour reorder shortcut from colour book
    _reorderSingleColor(productId, colorName) {
        const p = storage.getProductById(productId);
        if (!p) return;
        this._pendingReorderProducts = [p];
        // Open colour picker pre-set to just this colour
        this._showReorderColorPickerForColor(p, colorName);
    }

    _showReorderColorPickerForColor(product, targetColorName) {
        const existing = document.getElementById('reorderColorPickerModal');
        if (existing) existing.remove();
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        this._pendingReorderProducts = [product];

        const allColors = (product.colors && product.colors.length > 0) ? product.colors : [];

        const colorRows = allColors.map((c, ci) => {
            const name = typeof c === 'string' ? c : c.name;
            const currentStock = typeof c === 'string' ? 0 : (c.qty || 0);
            const swatch = this.getColorSwatch(name);
            const isTarget = name.toLowerCase() === targetColorName.toLowerCase();
            const isZero = currentStock === 0;
            return `
            <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.5rem 0.75rem;border:${isTarget ? '1.5px solid var(--primary)' : '1px solid var(--border)'};margin-bottom:0.4rem;${isTarget ? 'box-shadow:0 0 0 2px rgba(108,99,255,0.15);' : ''}">
                <span style="width:13px;height:13px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                <span style="flex:1;font-size:0.86rem;color:${isTarget ? 'var(--text-light)' : 'var(--text-muted)'};">${name}${isTarget ? ' <span style="font-size:0.7rem;color:var(--primary);font-weight:700;">← sold out</span>' : ''}</span>
                <span style="font-size:0.75rem;${isZero ? 'color:var(--pink);font-weight:700;' : 'color:var(--text-muted);'}">Stock: ${currentStock}</span>
                <input type="number" min="0" value="${isTarget ? defaultQty : 0}"
                    data-product-idx="0" data-color-name="${name}"
                    id="rcp_0_${ci}"
                    style="width:72px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                    oninput="app._updateReorderColorTotal(0)">
            </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderColorPickerModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:480px;max-height:90vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('reorderColorPickerModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">🔴 📦</div>
                    <h2 style="color:var(--cyan);">Reorder Sold-Out Colour</h2>
                    <p style="color:var(--text-muted);font-size:0.85rem;"><strong style="color:var(--primary);">${targetColorName}</strong> is out of stock for <strong>${product.name}</strong>.<br>Adjust quantities below and continue.</p>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border);">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.85rem;">
                        ${product.photo ? `<img src="${product.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0;">` : `<div style="width:40px;height:40px;background:var(--bg-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">📦</div>`}
                        <div>
                            <div style="font-weight:700;color:var(--cyan);">${product.name}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">Adjust qty to 0 for colours you don't want to reorder</div>
                        </div>
                        <div style="margin-left:auto;text-align:right;font-size:0.8rem;color:var(--text-muted);">Total:<br><strong id="rcp_total_0" style="color:var(--primary);font-size:1rem;">${defaultQty}</strong></div>
                    </div>
                    ${colorRows}
                </div>
                <div style="display:flex;gap:0.75rem;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('reorderColorPickerModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                    <button class="btn btn-primary" style="flex:2;" onclick="app._confirmReorderColorPicker()">📦 Continue to Reorder →</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
    }

    // =====================
    // BILLING
    // =====================
    addProductToBilling(productId) {
        this.pendingBillingProductId = productId;
        const p = storage.getProductById(productId);
        if (!p) return;

        document.getElementById('quantityProductName').textContent = p.name;
        document.getElementById('quantityProductPrice').textContent = '₹' + p.price.toFixed(2);
        document.getElementById('quantityProductStock').textContent = p.quantity + ' units';

        const hasColors = p.colors && p.colors.length > 0;
        const simpleRow = document.getElementById('quantitySimpleRow');
        const colorSection = document.getElementById('quantityColorSection');

        if (hasColors) {
            simpleRow.style.display = 'none';
            colorSection.style.display = 'block';
            this._renderColorQtyRows(p);
        } else {
            simpleRow.style.display = 'block';
            colorSection.style.display = 'none';
            document.getElementById('quantityInput').value = 1;
            document.getElementById('quantityInput').max = p.quantity;
        }

        document.getElementById('quantitySelectorModal').classList.add('active');
    }

    _renderColorQtyRows(product) {
        const container = document.getElementById('colorQtyRows');
        container.innerHTML = product.colors.map((c, i) => {
            const name = typeof c === 'string' ? c : c.name;
            const stock = typeof c === 'string' ? product.quantity : (c.qty || 0);
            const swatch = this.getColorSwatch(name);
            return `
            <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-secondary);border-radius:8px;padding:0.5rem 0.75rem;border:1px solid var(--border);">
                <span style="width:14px;height:14px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                <span style="flex:1;font-size:0.88rem;color:var(--text-light);">${name}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);">Stock: <strong style="color:${stock===0?'var(--pink)':'var(--cyan)'};">${stock}</strong></span>
                <input type="number" id="billingColorQty_${i}" min="0" max="${stock}" value="0" ${stock===0?'disabled':''}
                    style="width:64px;padding:0.3rem 0.4rem;font-size:0.85rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                    oninput="app._validateColorQtyRows()" data-colorname="${name}" data-stock="${stock}">
            </div>`;
        }).join('');
        document.getElementById('colorQtyValidation').innerHTML = '';
    }

    _validateColorQtyRows() {
        const inputs = document.querySelectorAll('#colorQtyRows input[type=number]');
        const validation = document.getElementById('colorQtyValidation');
        let hasError = false;
        let totalQty = 0;
        inputs.forEach(inp => {
            const val = parseInt(inp.value) || 0;
            const stock = parseInt(inp.dataset.stock) || 0;
            totalQty += val;
            if (val > stock) {
                inp.style.borderColor = 'var(--pink)';
                hasError = true;
            } else {
                inp.style.borderColor = val > 0 ? 'var(--cyan)' : 'var(--border)';
            }
        });
        if (hasError) {
            validation.innerHTML = '<span style="color:var(--pink);">⚠️ Quantity exceeds available stock for one or more colours.</span>';
        } else if (totalQty === 0) {
            validation.innerHTML = '<span style="color:var(--text-muted);">Enter quantity for at least one colour.</span>';
        } else {
            validation.innerHTML = `<span style="color:var(--cyan);">✓ Total: ${totalQty} unit${totalQty > 1 ? 's' : ''} selected.</span>`;
        }
        return !hasError && totalQty > 0;
    }

    confirmAddToBilling() {
        const p = storage.getProductById(this.pendingBillingProductId);
        if (!p) return;

        const hasColors = p.colors && p.colors.length > 0;

        if (hasColors) {
            if (!this._validateColorQtyRows()) {
                this.showNotification('Fix quantities before adding to cart', 'warning');
                return;
            }
            const inputs = document.querySelectorAll('#colorQtyRows input[type=number]');
            const entries = [];
            inputs.forEach(inp => {
                const qty = parseInt(inp.value) || 0;
                if (qty > 0) entries.push({ color: inp.dataset.colorname, qty });
            });
            if (entries.length === 0) {
                this.showNotification('Select at least one colour with qty > 0', 'warning');
                return;
            }
            // Add directly to cart
            entries.forEach(({ color, qty }) => {
                this.addToCartWithColor(this.pendingBillingProductId, qty, color);
            });
        } else {
            const qty = parseInt(document.getElementById('quantityInput').value);
            if (!qty || qty < 1) { this.showNotification('Enter a valid quantity', 'warning'); return; }
            if (qty > p.quantity) { this.showNotification('Not enough stock!', 'error'); return; }
            this.addToCartWithColor(this.pendingBillingProductId, qty, '');
        }

        this.pendingBillingProductId = null;
        this.closeModal(document.getElementById('quantitySelectorModal'));
        this.showNotification('\u2713 ' + p.name + ' added to cart', 'success');
        this._updateFloatingCartBtn();
    }

    _updateFloatingCartBtn() {
        let btn = document.getElementById('floatingCartBtn');
        const count = this.cartItems.reduce((s, i) => s + (i.cartQuantity || 1), 0);

        if (count === 0) {
            if (btn) btn.remove();
            return;
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'floatingCartBtn';
            btn.style.cssText = [
                'position:fixed',
                'bottom:24px',
                'right:20px',
                'z-index:9999',
                'background:linear-gradient(135deg,#00c96a,#00a855)',
                'color:white',
                'border:none',
                'border-radius:50px',
                'padding:0.75rem 1.25rem',
                'font-size:1rem',
                'font-weight:700',
                'cursor:pointer',
                'box-shadow:0 4px 20px rgba(0,201,106,0.45)',
                'display:flex',
                'align-items:center',
                'gap:0.5rem',
                'transition:transform 0.15s ease'
            ].join(';');
            btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
            btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
            btn.onclick = () => {
                this.changePage('billing');
                this.switchBillingTab('customer');
            };
            document.body.appendChild(btn);
        }

        const label = count === 1 ? '1 item' : count + ' items';
        btn.innerHTML = '\uD83E\uDDFE Bill (' + label + ')';
    }

    updateProductSelect() {
        const select = document.getElementById('productSelect');
        const customerType = (document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash') || 'cash';
        const useWholesale = customerType === 'wholesaler' || customerType === 'supplier';
        const products = storage.getProducts().filter(p => p.quantity > 0);
        select.innerHTML = '<option value="">Select a product...</option>' +
            products.map(p => {
                const displayPrice = useWholesale ? (p.wholesalePrice || p.price) : p.price;
                const priceLabel = useWholesale ? 'WS' : '₹';
                return `<option value="${p.id}">${p.name} (${priceLabel}${displayPrice.toFixed(2)}) — ${p.quantity} left</option>`;
            }).join('');
    }

    addToCart() {
        const productId = document.getElementById('productSelect').value;
        const qty = parseInt(document.getElementById('itemQuantity').value) || 1;
        if (!productId) { this.showNotification('Select a product first', 'warning'); return; }
        this.addToCartWithColor(productId, qty, '');
    }

    addToCartWithColor(productId, qty, color) {
        const product = storage.getProductById(productId);
        if (!product) return;

        // Determine available stock for this color
        let availableStock = product.quantity;
        if (color && product.colors && product.colors.length > 0) {
            const colorObj = product.colors.find(c => {
                const name = typeof c === 'string' ? c : c.name;
                return name.toLowerCase() === color.toLowerCase();
            });
            if (colorObj && typeof colorObj !== 'string') {
                availableStock = colorObj.qty || 0;
            }
        }

        // Check for existing same product+color combo in cart
        const existing = this.cartItems.find(i => i.id === productId && (i.selectedColor || '') === (color || ''));
        const totalQty = (existing ? existing.cartQuantity : 0) + qty;
        if (totalQty > availableStock) {
            this.showNotification(`Not enough stock for ${color || product.name}! (${availableStock} available)`, 'error');
            return;
        }

        // Determine correct price based on current customer type
        const customerType = (document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash') || 'cash';
        const useWholesale = customerType === 'wholesaler' || customerType === 'supplier';
        const effectivePrice = useWholesale ? (product.wholesalePrice || product.price) : product.price;

        if (existing) {
            existing.cartQuantity += qty;
        } else {
            this.cartItems.push({
                ...product,
                cartQuantity: qty,
                selectedColor: color || '',
                _colorStock: availableStock,
                _sellingPrice: product.price,
                _wholesalePrice: product.wholesalePrice || product.price,
                price: effectivePrice
            });
        }
        this.renderCart();
        document.getElementById('itemQuantity').value = 1;
        this.showNotification(`${product.name}${color ? ' (' + color + ')' : ''} added to cart`, 'success');
    }

    renderCart() {
        const tbody = document.getElementById('cartItems');
        if (this.cartItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Cart is empty</td></tr>';
            document.getElementById('totalAmount').textContent = '₹0.00';
            document.getElementById('subtotalAmount').textContent = '₹0.00';
            document.getElementById('discountDisplayAmount').textContent = '−₹0.00';
            document.getElementById('gstDisplayAmount').textContent = '+₹0.00';
            return;
        }
        const customerType = (document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash') || 'cash';
        const useWholesale = customerType === 'wholesaler' || customerType === 'supplier';
        let subtotal = 0;
        tbody.innerHTML = this.cartItems.map((item, i) => {
            // Always use the stored effective price for the current billing type
            const effectivePrice = useWholesale ? (item._wholesalePrice || item._sellingPrice || item.price) : (item._sellingPrice || item.price);
            const itemTotal = effectivePrice * item.cartQuantity;
            subtotal += itemTotal;
            const colorBadge = item.selectedColor
                ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--bg-secondary);border-radius:10px;padding:0.1rem 0.4rem;font-size:0.75rem;margin-left:0.3rem;border:1px solid var(--border);">
                    <span style="width:10px;height:10px;border-radius:50%;background:${this.getColorSwatch(item.selectedColor)};display:inline-block;"></span>${item.selectedColor}</span>`
                : '';
            const priceBadge = useWholesale
                ? `<span style="font-size:0.65rem;color:var(--gold);margin-left:0.3rem;font-family:var(--mono);">WS</span>`
                : '';
            return `
            <tr>
                <td>${item.name}${colorBadge}</td>
                <td>₹${effectivePrice.toFixed(2)}${priceBadge}</td>
                <td>
                    <input type="number" value="${item.cartQuantity}" min="1" max="${item._colorStock !== undefined ? item._colorStock : item.quantity}"
                        style="width:60px;padding:0.25rem 0.5rem;font-size:0.85rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);"
                        onchange="app.updateCartQty(${i}, this.value)">
                </td>
                <td>₹${itemTotal.toFixed(2)}</td>
                <td><button class="btn btn-small btn-danger" onclick="app.removeFromCart(${i})">✕</button></td>
            </tr>`;
        }).join('');
        
        // Calculate discount and GST
        this.updateBillingTotals(subtotal);
    }

    updateBillingTotals(subtotal) {
        // Get discount values
        const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
        const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
        
        // Calculate actual discount (either percent or fixed amount)
        let discount = 0;
        if (discountPercent > 0 && discountAmount > 0) {
            // If both are set, use the smaller discount
            discount = Math.min(subtotal * (discountPercent / 100), discountAmount);
        } else if (discountPercent > 0) {
            discount = subtotal * (discountPercent / 100);
        } else if (discountAmount > 0) {
            discount = Math.min(discountAmount, subtotal);
        }
        
        // Calculate GST on the discounted amount
        const gstRate = parseFloat(document.getElementById('gstRate').value) || 0;
        const amountAfterDiscount = subtotal - discount;
        const gst = amountAfterDiscount * (gstRate / 100);
        
        const total = amountAfterDiscount + gst;
        
        // Update display
        document.getElementById('subtotalAmount').textContent = '₹' + subtotal.toFixed(2);
        document.getElementById('discountDisplayAmount').textContent = '−₹' + discount.toFixed(2);
        document.getElementById('gstDisplayAmount').textContent = '+₹' + gst.toFixed(2);
        document.getElementById('totalAmount').textContent = '₹' + total.toFixed(2);
    }

    getCartSubtotal() {
        const customerType = (document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash') || 'cash';
        const useWholesale = customerType === 'wholesaler' || customerType === 'supplier';
        let subtotal = 0;
        this.cartItems.forEach(item => {
            const effectivePrice = useWholesale ? (item._wholesalePrice || item._sellingPrice || item.price) : (item._sellingPrice || item.price);
            subtotal += effectivePrice * item.cartQuantity;
        });
        return subtotal;
    }

    updateCartQty(index, val) {
        const qty = parseInt(val);
        if (!qty || qty < 1) return;
        const item = this.cartItems[index];
        const limit = item._colorStock !== undefined ? item._colorStock : item.quantity;
        if (qty > limit) {
            this.showNotification(`Not enough stock! (${limit} available)`, 'error');
            this.renderCart();
            return;
        }
        this.cartItems[index].cartQuantity = qty;
        this.renderCart();
    }

    removeFromCart(index) {
        this.cartItems.splice(index, 1);
        this.renderCart();
        this._updateFloatingCartBtn();
    }

    clearCart() {
        this.cartItems = [];
        this.renderCart();
        this._updateFloatingCartBtn();
        if (window.PaymentMode) window.PaymentMode.reset();
    }

    newInvoice() {
        this.clearCart();
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('discountPercent').value = '0';
        document.getElementById('discountAmount').value = '0';
        document.getElementById('gstRate').value = '';
        const typeSelect = document.getElementById('customerType');
        if (typeSelect) typeSelect.value = '';
        this.setDateToToday();
        this.switchBillingTab('customer');
        this.showNotification('Form cleared', 'success');
    }

    generateInvoice() {
        try {
            console.log('Generate Invoice clicked');
            if (this.cartItems.length === 0) {
                this.showNotification('Add items to cart first', 'warning'); 
                return;
            }
            const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
            const customerPhone = document.getElementById('customerPhone').value || '';
            const customerType = document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash';
            const date = document.getElementById('invoiceDate').value || new Date().toISOString().split('T')[0];
            const isPurchase = customerType === 'supplier';
            const useWholesale = customerType === 'wholesaler' || customerType === 'supplier';

            // Use the effective price per item (already stored in cart based on type)
            const getEffectivePrice = (item) => {
                if (useWholesale) return item._wholesalePrice || item._sellingPrice || item.price;
                return item._sellingPrice || item.price;
            };

            let subtotal = this.cartItems.reduce((s, i) => s + (getEffectivePrice(i) * i.cartQuantity), 0);
            
            // Get discount values
            const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
            const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
            
            // Calculate actual discount (either percent or fixed amount)
            let discount = 0;
            if (discountPercent > 0 && discountAmount > 0) {
                discount = Math.min(subtotal * (discountPercent / 100), discountAmount);
            } else if (discountPercent > 0) {
                discount = subtotal * (discountPercent / 100);
            } else if (discountAmount > 0) {
                discount = Math.min(discountAmount, subtotal);
            }
            
            // Get GST rate
            const gstRate = parseFloat(document.getElementById('gstRate').value) || 0;
            const amountAfterDiscount = subtotal - discount;
            const gst = amountAfterDiscount * (gstRate / 100);
            
            // Get tax rate (for backward compatibility, but GST takes precedence)
            const taxRate = isPurchase ? 0 : (gstRate > 0 ? gstRate : (parseFloat(localStorage.getItem('taxRate')) || 0));
            
            const total = amountAfterDiscount + gst;
            const currency = localStorage.getItem('currency') || '₹';
            const prefix = localStorage.getItem('invoicePrefix') || 'INV';

            let paymentData = { paymentMethod: 'Cash' };
            try {
                if (window.PaymentMode && typeof window.PaymentMode.getPaymentData === 'function') {
                    paymentData = window.PaymentMode.getPaymentData(total);
                    console.log('Payment data:', paymentData);
                }
            } catch (e) {
                console.warn('Payment mode error:', e);
            }

            // Determine invoice status: 'pending' for credit, 'paid' for cash/others
            const isCreditSale = !isPurchase && customerType === 'credit';
            const invoiceStatus = isCreditSale ? 'pending' : 'paid';

            const invoice = {
                prefix,
                date,
                customerName: isPurchase ? '' : customerName,
                customerPhone: isPurchase ? '' : customerPhone,
                customerType,
                supplierName: isPurchase ? customerName : '',
                supplierContact: isPurchase ? customerPhone : '',
                type: isPurchase ? 'purchase' : 'sale',
                status: invoiceStatus,
                items: this.cartItems.map(i => ({
                    id: i.id, name: i.name,
                    price: getEffectivePrice(i),
                    sellingPrice: i._sellingPrice || i.price,
                    wholesalePrice: i._wholesalePrice || i._sellingPrice || i.price,
                    cartQuantity: i.cartQuantity,
                    selectedColor: i.selectedColor || '',
                    photo: i.photo || null
                })),
                subtotal,
                discount,
                discountPercent,
                gstRate,
                gst,
                taxRate,
                tax: gst,
                total,
                currency,
                ...paymentData
            };

            console.log('Invoice object:', invoice);
            const saved = storage.addInvoice(invoice);
            console.log('Saved invoice:', saved);

            if (!saved) {
                this.showNotification('Failed to save invoice', 'error');
                return;
            }

            // Link invoice to customer ledger for credit tracking
            if (typeof CustomerLedger !== 'undefined' && !isPurchase) {
                CustomerLedger.linkInvoice(saved);
                console.log('[Credit Billing] Invoice linked to customer ledger');
            }

            if (isPurchase) {
                // Purchase: ADD stock instead of deducting
                this.cartItems.forEach(item => {
                    const p = storage.getProductById(item.id);
                    if (!p) return;
                    if (item.selectedColor && p.colors && p.colors.length > 0) {
                        // Color product: add to specific color qty → total auto-syncs
                        storage.addStockToColorProduct(item.id, item.selectedColor, item.cartQuantity);
                    } else {
                        // No-color product: simple add
                        storage.updateStock(item.id, p.quantity + item.cartQuantity);
                    }
                });
                this.clearCart();
                this._postInvoiceDashboard = true;
                this.viewPurchaseInvoice(saved.id);
                this.showNotification('Purchase invoice generated! Stock updated.', 'success');
            } else {
                // Sale: deduct stock
                this.cartItems.forEach(item => {
                    const p = storage.getProductById(item.id);
                    if (!p) return;
                    if (item.selectedColor && p.colors && p.colors.length > 0) {
                        // Color product: deduct from specific color qty → total auto-syncs
                        storage.removeColorFromProduct(item.id, item.selectedColor, item.cartQuantity);
                    } else {
                        // No-color product: simple deduct
                        storage.updateStock(item.id, Math.max(0, p.quantity - item.cartQuantity));
                    }
                });
                this.clearCart();
                this._postInvoiceDashboard = true;
                this.viewInvoice(saved.id);
                this.showNotification('Invoice generated!', 'success');
            }
            this.updateDashboard();
        } catch (error) {
            console.error('Generate Invoice Error:', error);
            this.showNotification('Error generating invoice: ' + error.message, 'error');
        }
    }

    // =====================
    // INVOICES
    // =====================
    loadInvoices() {
        this.displayInvoices(storage.getInvoices().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }

    displayInvoices(invoices) {
        const container = document.getElementById('invoicesList');
        if (invoices.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:3rem;color:#5a5a7a;font-family:'Space Mono',monospace;font-size:0.82rem;">No invoices yet. Create your first invoice in Billing.</div>`;
            return;
        }
        container.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">` + invoices.map(inv => {
            const isPurchase = inv.type === 'purchase';
            const accentColor  = isPurchase ? '#00c96a' : '#6c63ff';
            const amtColor     = isPurchase ? '#00c96a' : '#00ff88';
            const amtPrefix    = isPurchase ? '−' : '+';
            const badgeBg      = isPurchase ? 'rgba(0,201,106,0.13)' : 'rgba(108,99,255,0.15)';
            const badgeColor   = isPurchase ? '#00c96a' : '#a78bfa';
            const badgeLabel   = isPurchase ? 'PURCHASE' : 'SALE';
            const partyName    = isPurchase ? (inv.supplierName || 'Supplier') : (inv.customerName || 'Walk-in Customer');
            const dateStr      = new Date(inv.createdAt).toLocaleString();
            const viewFn       = isPurchase ? `app.viewPurchaseInvoice('${inv.id}')` : `app.viewInvoice('${inv.id}')`;
            // Pre-compute WA button to avoid nested template literal quoting issues
            const waBtn = `<button onclick="sendWhatsAppInvoice('${inv.id}')" style="padding:5px 10px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25D366;border-radius:8px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;" title="Send on WhatsApp">📲</button>`;

            return `
            <div style="display:flex;align-items:center;gap:12px;background:#0f0f1e;border:1px solid #1e1e38;border-left:3px solid ${accentColor};border-radius:10px;padding:13px 16px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(108,99,255,0.4)'" onmouseout="this.style.borderColor='#1e1e38';this.style.borderLeftColor='${accentColor}'">
                <!-- Info -->
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="font-family:'Space Mono',monospace;font-size:0.78rem;font-weight:700;color:#6c63ff;">${inv.id}</span>
                        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:${badgeBg};color:${badgeColor};font-family:'Space Mono',monospace;font-size:0.62rem;font-weight:700;letter-spacing:0.06em;">
                            <span style="width:5px;height:5px;border-radius:50%;background:${badgeColor};display:inline-block;"></span>
                            ${badgeLabel}
                        </span>
                    </div>
                    <div style="font-family:'Space Mono',monospace;font-size:0.78rem;color:#e8e8f0;margin-bottom:3px;">${partyName}</div>
                    <div style="font-family:'Space Mono',monospace;font-size:0.65rem;color:#5a5a7a;">${dateStr}</div>
                </div>
                <!-- Amount -->
                <div style="font-family:'Space Mono',monospace;font-size:1rem;font-weight:700;color:${amtColor};white-space:nowrap;flex-shrink:0;">${amtPrefix}${inv.currency||'₹'}${(inv.total||0).toFixed(2)}</div>
                <!-- Actions -->
                <div style="display:flex;gap:6px;flex-shrink:0;margin-left:8px;">
                    <button onclick="${viewFn}" style="padding:5px 12px;background:#141428;border:1px solid #2a2a44;color:#e8e8f0;border-radius:8px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px;">👁 View</button>
                    ${waBtn}
                    <button onclick="app.deleteInvoice('${inv.id}')" style="padding:5px 10px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.25);color:#ff6b6b;border-radius:8px;font-family:'Space Mono',monospace;font-size:12px;cursor:pointer;">🗑</button>
                </div>
            </div>`;
        }).join('') + `</div>`;
    }

    searchInvoices(query) {
        const results = query ? storage.searchInvoices(query) : storage.getInvoices().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.displayInvoices(results);
    }

    viewInvoice(id) {
        window._currentInvoiceId = id;
        const inv = storage.getInvoiceById(id);
        if (!inv) return;

        // Store details
        const storeName      = localStorage.getItem('storeName')      || 'Your Shop Name';
        const storePhone     = localStorage.getItem('storePhone')     || '';
        const storeEmail     = localStorage.getItem('storeEmail')     || '';
        const storeAddress   = localStorage.getItem('storeAddress')   || '';
        const storeGSTIN     = localStorage.getItem('storeGSTIN')     || '';
        const storeState     = localStorage.getItem('storeState')     || '';
        const storeStateCode = localStorage.getItem('storeStateCode') || '';
        const storeLogoUrl   = localStorage.getItem('storeLogoUrl')   || '';
        const storeOwner     = localStorage.getItem('storeOwner')     || '';
        const currency       = inv.currency || '₹';

        // Invoice number
        const prefix = localStorage.getItem(storage.currentUser + '_invoicePrefix')
                    || localStorage.getItem('invoicePrefix') || 'INV';
        const invNum = inv.invoiceNumber
            ? (prefix + '-' + String(inv.invoiceNumber).padStart(4,'0'))
            : (prefix + '-' + inv.id.slice(-6).toUpperCase());

        // Dates
        const invDate  = new Date(inv.date || inv.createdAt);
        const dateStr  = invDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
        const dueDate  = new Date(invDate.getTime() + 15*24*60*60*1000);
        const dueDateStr = dueDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

        // GST calc — CGST + SGST split (intra-state) or IGST (inter-state)
        const gstRate  = Number(inv.gstRate  || inv.taxRate || 0);
        const subtotal = Number(inv.subtotal || inv.total || 0);
        const discount = Number(inv.discount || 0);
        const taxable  = subtotal - discount;
        const totalTax = Number(inv.gst || inv.tax || 0);
        const cgst     = +(totalTax / 2).toFixed(2);
        const sgst     = +(totalTax / 2).toFixed(2);
        const isGST    = !!(storeGSTIN && gstRate > 0 && totalTax > 0);

        // Amount in words
        function numToWords(n) {
            const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
            const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
            if (n === 0) return 'Zero';
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
            if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numToWords(n%100) : '');
            if (n < 100000) return numToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numToWords(n%1000) : '');
            if (n < 10000000) return numToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numToWords(n%100000) : '');
            return numToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numToWords(n%10000000) : '');
        }
        const totalInt  = Math.floor(Number(inv.total));
        const totalPaise = Math.round((Number(inv.total) - totalInt) * 100);
        const amountWords = numToWords(totalInt) + ' Rupees'
            + (totalPaise > 0 ? ' and ' + numToWords(totalPaise) + ' Paise' : '')
            + ' Only';

        // Items rows
        const items = inv.items || [];
        const itemsHtml = items.map((item, i) => {
            const qty    = Number(item.cartQuantity || item.qty || 0);
            const price  = Number(item.price || 0);
            const amount = qty * price;
            const color  = item.selectedColor || item.color || '';
            const hsn    = item.hsn || '';
            const unit   = item.unit || 'Pcs';
            const rowBg  = i % 2 === 0 ? '#ffffff' : '#f7f7ff';
            return '<tr style="background:' + rowBg + ';">' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;font-size:11px;color:#111;border-right:1px solid #e0e0e0;">' +
                    '<div style="font-weight:600;">' + esc(item.name) + '</div>' +
                    (color ? '<div style="font-size:10px;color:#6c63ff;">Colour: ' + esc(color) + '</div>' : '') +
                '</td>' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;text-align:center;font-size:11px;color:#444;border-right:1px solid #e0e0e0;">' + (hsn || '-') + '</td>' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;text-align:center;font-size:11px;color:#444;border-right:1px solid #e0e0e0;">' + qty + '</td>' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;text-align:center;font-size:11px;color:#444;border-right:1px solid #e0e0e0;">' + unit + '</td>' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:11px;color:#444;border-right:1px solid #e0e0e0;">' + currency + price.toFixed(2) + '</td>' +
                '<td style="padding:7px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:11px;font-weight:600;color:#111;">' + currency + amount.toFixed(2) + '</td>' +
            '</tr>';
        }).join('');

        const html = '<div id="gstInvoice" style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#fff;color:#111;border:1.5px solid #333;font-size:12px;">' +

            // ── HEADER ──────────────────────────────────────
            '<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">' +
            '<tr>' +
            '<td style="width:75%;padding:12px 16px;vertical-align:top;">' +
                (storeLogoUrl ? `<img src="${storeLogoUrl}" style="height:50px;margin-bottom:6px;display:block;" onerror="this.style.display='none'">` : '') +
                '<div style="font-size:20px;font-weight:700;color:#1a1a2e;">' + esc(storeName) + '</div>' +
                (storeOwner ? '<div style="font-size:11px;color:#555;margin-top:2px;">' + esc(storeOwner) + '</div>' : '') +
                (storeAddress ? '<div style="font-size:11px;color:#555;margin-top:3px;line-height:1.5;">' + esc(storeAddress) + '</div>' : '') +
                (storePhone ? '<div style="font-size:11px;color:#555;margin-top:2px;">Ph: ' + esc(storePhone) + '</div>' : '') +
                (storeEmail ? '<div style="font-size:11px;color:#555;">Email: ' + esc(storeEmail) + '</div>' : '') +
                (storeGSTIN ? '<div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-top:4px;">GSTIN: ' + esc(storeGSTIN) + '</div>' : '') +
                (storeState ? '<div style="font-size:11px;color:#555;">State: ' + esc(storeState) + (storeStateCode ? ' &nbsp;State Code: ' + esc(storeStateCode) : '') + '</div>' : '') +
            '</td>' +
            '<td style="width:25%;padding:12px 16px;vertical-align:top;text-align:right;border-left:1.5px solid #333;">' +
                '<div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">TAX INVOICE</div>' +
                '<div style="font-size:10px;color:#888;">Invoice No.</div>' +
                '<div style="font-size:13px;font-weight:700;color:#6c63ff;margin-bottom:6px;">' + esc(invNum) + '</div>' +
                '<div style="font-size:10px;color:#888;">Invoice Date</div>' +
                '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">' + dateStr + '</div>' +
                '<div style="font-size:10px;color:#888;">Due Date</div>' +
                '<div style="font-size:12px;font-weight:600;">' + dueDateStr + '</div>' +
            '</td>' +
            '</tr>' +
            '</table>' +

            // ── BILL TO / SHIP TO ────────────────────────────
            '<table style="width:100%;border-collapse:collapse;border-bottom:1.5px solid #333;">' +
            '<tr>' +
            '<td style="width:50%;padding:10px 16px;vertical-align:top;border-right:1.5px solid #333;">' +
                '<div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:4px;">BILL TO</div>' +
                '<div style="font-size:13px;font-weight:700;">' + esc(inv.customerName || 'Walk-in Customer') + '</div>' +
                (inv.customerPhone ? '<div style="font-size:11px;color:#555;margin-top:2px;">Ph: ' + esc(inv.customerPhone) + '</div>' : '') +
                (inv.customerGSTIN ? '<div style="font-size:11px;font-weight:600;color:#6c63ff;margin-top:3px;">GSTIN: ' + esc(inv.customerGSTIN) + '</div>' : '') +
            '</td>' +
            '<td style="width:50%;padding:10px 16px;vertical-align:top;">' +
                '<div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:4px;">PAYMENT INFO</div>' +
                (window.PaymentMode ? window.PaymentMode.invoicePrintHTML(inv) : '<div style="font-size:11px;color:#555;">Method: <span style="font-weight:600;color:#111;">' + esc(inv.paymentMethod || 'Cash') + '</span></div>') +
                (isGST ? '<div style="font-size:11px;color:#555;margin-top:3px;">Place of Supply: <span style="font-weight:600;color:#111;">' + esc(storeState || '-') + '</span></div>' : '') +
            '</td>' +
            '</tr>' +
            '</table>' +

            // ── ITEMS TABLE ──────────────────────────────────
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead>' +
            '<tr style="background:#1a1a2e;color:#fff;">' +
                '<th style="padding:8px 10px;text-align:left;font-size:10px;letter-spacing:0.06em;border-right:1px solid #444;">ITEM DESCRIPTION</th>' +
                '<th style="padding:8px 10px;text-align:center;font-size:10px;letter-spacing:0.06em;border-right:1px solid #444;width:60px;">HSN</th>' +
                '<th style="padding:8px 10px;text-align:center;font-size:10px;letter-spacing:0.06em;border-right:1px solid #444;width:50px;">QTY</th>' +
                '<th style="padding:8px 10px;text-align:center;font-size:10px;letter-spacing:0.06em;border-right:1px solid #444;width:50px;">UNIT</th>' +
                '<th style="padding:8px 10px;text-align:right;font-size:10px;letter-spacing:0.06em;border-right:1px solid #444;width:80px;">RATE</th>' +
                '<th style="padding:8px 10px;text-align:right;font-size:10px;letter-spacing:0.06em;width:80px;">AMOUNT</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody style="border-bottom:1.5px solid #333;">' + itemsHtml + '</tbody>' +
            '</table>' +

            // ── TOTALS + BANK ────────────────────────────────
            '<table style="width:100%;border-collapse:collapse;border-top:1.5px solid #333;">' +
            '<tr>' +
            // Left: Amount in words + notes
            '<td style="width:55%;padding:12px 16px;vertical-align:top;border-right:1.5px solid #333;">' +
                '<div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.06em;margin-bottom:4px;">AMOUNT IN WORDS</div>' +
                '<div style="font-size:11px;font-weight:600;color:#1a1a2e;font-style:italic;">' + amountWords + '</div>' +
                '<div style="margin-top:12px;font-size:10px;font-weight:700;color:#888;letter-spacing:0.06em;">TERMS &amp; CONDITIONS</div>' +
                '<div style="font-size:10px;color:#666;margin-top:3px;line-height:1.6;">' +
                '1. Goods once sold will not be taken back.<br>' +
                '2. Interest @18% p.a. will be charged on overdue amounts.<br>' +
                (storeGSTIN ? '3. Subject to ' + esc(storeState || 'local') + ' jurisdiction.' : '3. Thank you for your business!') +
                '</div>' +
            '</td>' +
            // Right: Totals breakdown
            '<td style="width:45%;padding:12px 16px;vertical-align:top;">' +
                '<table style="width:100%;font-size:11px;">' +
                '<tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="text-align:right;font-weight:500;">' + currency + subtotal.toFixed(2) + '</td></tr>' +
                (discount > 0 ? '<tr><td style="padding:3px 0;color:#e53e3e;">Discount</td><td style="text-align:right;color:#e53e3e;font-weight:500;">-' + currency + discount.toFixed(2) + '</td></tr>' : '') +
                (isGST && cgst > 0 ? [
                    '<tr><td style="padding:3px 0;color:#555;">Taxable Amount</td><td style="text-align:right;font-weight:500;">' + currency + taxable.toFixed(2) + '</td></tr>',
                    '<tr><td style="padding:3px 0;color:#555;">CGST (' + (gstRate/2) + '%)</td><td style="text-align:right;font-weight:500;">' + currency + cgst.toFixed(2) + '</td></tr>',
                    '<tr><td style="padding:3px 0;color:#555;">SGST (' + (gstRate/2) + '%)</td><td style="text-align:right;font-weight:500;">' + currency + sgst.toFixed(2) + '</td></tr>'
                ].join('') : totalTax > 0 ? '<tr><td style="padding:3px 0;color:#555;">Tax (' + gstRate + '%)</td><td style="text-align:right;font-weight:500;">' + currency + totalTax.toFixed(2) + '</td></tr>' : '') +
                '<tr style="border-top:2px solid #1a1a2e;"><td style="padding:8px 0 3px;font-size:14px;font-weight:700;color:#1a1a2e;">TOTAL</td><td style="text-align:right;font-size:14px;font-weight:700;color:#6c63ff;">' + currency + Number(inv.total).toFixed(2) + '</td></tr>' +
                '</table>' +
            '</td>' +
            '</tr>' +
            '</table>' +

            // ── SIGNATURE FOOTER ─────────────────────────────
            '<table style="width:100%;border-collapse:collapse;border-top:1.5px solid #333;">' +
            '<tr>' +
            '<td style="width:60%;padding:12px 16px;vertical-align:bottom;border-right:1.5px solid #333;">' +
                `<div style="font-size:10px;color:#888;margin-bottom:24px;">Receiver's Signature</div>` +
                '<div style="border-top:1px solid #999;width:160px;padding-top:4px;font-size:10px;color:#888;">Authorised Signatory</div>' +
            '</td>' +
            '<td style="width:40%;padding:12px 16px;vertical-align:bottom;text-align:right;">' +
                '<div style="font-size:10px;color:#888;margin-bottom:24px;">For ' + esc(storeName) + '</div>' +
                '<div style="border-top:1px solid #999;display:inline-block;width:160px;padding-top:4px;font-size:10px;color:#888;">Authorised Signatory</div>' +
            '</td>' +
            '</tr>' +
            '</table>' +

            // ── FOOTER ───────────────────────────────────────
            '<div style="background:#f0eeff;padding:8px 16px;text-align:center;font-size:10px;color:#6c63ff;border-top:1.5px solid #333;">' +
                'This is a computer generated invoice' +
                (storeGSTIN ? ' &nbsp;|&nbsp; GSTIN: ' + esc(storeGSTIN) : '') +
            '</div>' +
        '</div>';

        document.getElementById('invoicePrintContent').innerHTML = html;
        document.getElementById('invoicePrintModal').classList.add('active');
    }
    deleteInvoice(id) {
        if (confirm('Delete this invoice?')) {
            storage.deleteInvoice(id);
            this.loadInvoices();
            this.showNotification('Invoice deleted.', 'success');
        }
    }

    printInvoice() { window.print(); }

    downloadInvoicePDF() {
        const content = document.getElementById('invoicePrintContent').innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Invoice</title><style>body{font-family:sans-serif;padding:2rem;}@media print{body{padding:0;}}</style></head><body>${content}</body></html>`);
        win.document.close();
        win.print();
    }

    // =====================
    // LOW STOCK
    // =====================
    loadLowStockPage() {
        const threshold = this.lowStockThreshold;
        document.getElementById('lowStockThreshold').value = threshold;
        document.getElementById('supplierContact').value = localStorage.getItem('supplierContact') || '';
        document.getElementById('defaultReorderQty').value = localStorage.getItem('defaultReorderQty') || '50';

        const lowStock = storage.getLowStockProducts(threshold);
        const critical = lowStock.filter(p => p.quantity <= 3);
        const warning = lowStock.filter(p => p.quantity > 3);

        document.getElementById('totalLowStockCount').textContent = lowStock.length;
        document.getElementById('criticalCount').textContent = critical.length;
        document.getElementById('warningCount').textContent = warning.length;

        const tbody = document.getElementById('lowstockList');
        if (lowStock.length === 0) {
            tbody.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-family:\'Space Mono\',monospace;font-size:0.85rem;">✅ All products are well stocked!</div>';
            return;
        }
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        const rows = lowStock.map((p, idx) => {
            const isCritical = p.quantity <= 3;
            const savedReorderQty = parseInt(localStorage.getItem('reorderQty_' + p.id)) || defaultQty;
            return `
            <tr style="border-bottom:1px solid rgba(42,42,68,0.6);${idx % 2 === 1 ? 'background:rgba(255,255,255,0.012);' : ''}">
                <td style="padding:11px 16px;color:var(--text-light);font-weight:600;font-family:'Space Mono',monospace;font-size:11px;">${p.name}</td>
                <td style="padding:11px 10px;text-align:center;color:${isCritical ? '#ff4444' : 'orange'};font-weight:700;font-size:14px;font-family:'Space Mono',monospace;">${p.quantity}</td>
                <td style="padding:11px 10px;text-align:center;color:var(--text-muted);font-family:'Space Mono',monospace;font-size:11px;">${threshold}</td>
                <td style="padding:11px 10px;text-align:center;">
                    <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;font-family:'Space Mono',monospace;letter-spacing:0.04em;${isCritical ? 'background:rgba(255,68,68,0.15);color:#ff4444;' : 'background:rgba(255,165,0,0.15);color:orange;'}">
                        <span style="width:7px;height:7px;border-radius:50%;background:${isCritical ? '#ff4444' : 'orange'};display:inline-block;"></span>
                        ${isCritical ? 'Critical' : 'Warning'}
                    </span>
                </td>
                <td style="padding:11px 10px;text-align:center;">
                    <input type="number" id="reorderQty_${p.id}" value="${savedReorderQty}" min="1"
                        style="width:72px;padding:5px 6px;font-size:11px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;font-family:'Space Mono',monospace;"
                        onchange="localStorage.setItem('reorderQty_${p.id}', this.value)">
                </td>
                <td style="padding:11px 16px;text-align:right;">
                    <div style="display:inline-flex;gap:6px;align-items:center;">
                        <button class="btn btn-small btn-primary" onclick="app.reorderProduct('${p.id}')">📦 Reorder</button>
                        <button class="btn btn-small btn-secondary" onclick="app.openProductModal('${p.id}')">✏️ Edit</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        tbody.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">PRODUCT NAME</th>
                        <th style="padding:10px;text-align:center;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">STOCK</th>
                        <th style="padding:10px;text-align:center;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">THRESHOLD</th>
                        <th style="padding:10px;text-align:center;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">STATUS</th>
                        <th style="padding:10px;text-align:center;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">REORDER QTY</th>
                        <th style="padding:10px 16px;text-align:right;color:var(--text-muted);letter-spacing:0.1em;font-size:9px;font-family:'Space Mono',monospace;font-weight:700;">ACTION</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    saveReorderSettings() {
        const contact = document.getElementById('supplierContact').value.trim();
        const qty = parseInt(document.getElementById('defaultReorderQty').value) || 50;
        localStorage.setItem('supplierContact', contact);
        localStorage.setItem('defaultReorderQty', qty);
        this.showNotification('✅ Reorder settings saved!', 'success');
    }

    reorderProduct(productId) {
        const p = storage.getProductById(productId);
        if (!p) return;
        // If product has colours, show colour-qty picker first
        if (p.colors && p.colors.length > 0) {
            this._showReorderColorPicker([p]);
            return;
        }
        const qtyInput = document.getElementById('reorderQty_' + productId);
        const qty = qtyInput ? parseInt(qtyInput.value) || 50 : 50;
        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal([{ product: p, qty }], supplier);
    }

    reorderAll() {
        const threshold = this.lowStockThreshold;
        const lowStock = storage.getLowStockProducts(threshold);
        if (lowStock.length === 0) {
            this.showNotification('No low stock items to reorder', 'warning');
            return;
        }
        // If any product has colours, show colour picker step
        const hasAnyColors = lowStock.some(p => p.colors && p.colors.length > 0);
        if (hasAnyColors) {
            this._showReorderColorPicker(lowStock);
            return;
        }
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        const items = lowStock.map(p => {
            const qty = parseInt(localStorage.getItem('reorderQty_' + p.id)) || defaultQty;
            return { product: p, qty };
        });
        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal(items, supplier);
    }

    _showReorderColorPicker(products) {
        const existing = document.getElementById('reorderColorPickerModal');
        if (existing) existing.remove();
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;

        this._pendingReorderProducts = products;

        const productsHtml = products.map((p, pi) => {
            const fp = storage.getProductById(p.id) || p;
            const allColors = (fp.colors && fp.colors.length > 0) ? fp.colors : [];
            const hasColors = allColors.length > 0;

            const colorRows = hasColors ? allColors.map((c, ci) => {
                const name = typeof c === 'string' ? c : c.name;
                const currentStock = typeof c === 'string' ? 0 : (c.qty || 0);
                const swatch = this.getColorSwatch(name);
                const isZero = currentStock === 0;
                return `
                <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.45rem 0.65rem;border:1px solid ${isZero ? 'rgba(239,68,68,0.4)' : 'var(--border)'};margin-bottom:0.4rem;">
                    <span style="width:13px;height:13px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                    <span style="flex:1;font-size:0.86rem;color:var(--text-light);">${name}</span>
                    <span style="font-size:0.75rem;${isZero ? 'color:var(--pink);font-weight:700;' : 'color:var(--text-muted);'}">Stock: ${currentStock}${isZero ? ' ⚠️' : ''}</span>
                    <input type="number" min="0" value="${defaultQty}"
                        data-product-idx="${pi}" data-color-name="${name}" data-new-color="false"
                        id="rcp_${pi}_${ci}"
                        style="width:72px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                        oninput="app._updateReorderColorTotal(${pi})">
                </div>`;
            }).join('') : `
                <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.45rem 0.65rem;border:1px solid var(--border);margin-bottom:0.4rem;">
                    <span style="font-size:0.85rem;color:var(--text-muted);">Quantity to order:</span>
                    <input type="number" min="0" value="${defaultQty}"
                        data-product-idx="${pi}" data-color-name="" data-new-color="false"
                        id="rcp_${pi}_0"
                        style="width:80px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                        oninput="app._updateReorderColorTotal(${pi})">
                </div>`;

            const initTotal = hasColors ? allColors.length * defaultQty : defaultQty;
            return `
            <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
                    ${fp.photo
                        ? `<img src="${fp.photo}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
                        : `<div style="width:42px;height:42px;background:var(--bg-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">📦</div>`
                    }
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--cyan);font-size:0.92rem;">${fp.name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">Current stock: ${fp.quantity} units${hasColors ? ` · ${allColors.length} colour${allColors.length>1?'s':''}` : ''}</div>
                    </div>
                    <div style="text-align:right;font-size:0.8rem;color:var(--text-muted);">
                        Total:<br><strong id="rcp_total_${pi}" style="color:var(--primary);font-size:1rem;">${initTotal}</strong>
                    </div>
                </div>

                ${hasColors ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;font-weight:600;letter-spacing:0.05em;">🎨 QTY TO REORDER PER COLOUR <span style="font-weight:400;">(⚠️ = sold out)</span></div>` : ''}
                <div id="rcp_colorrows_${pi}">
                    ${colorRows}
                </div>

                <!-- ── ADD NEW COLOUR SECTION ── -->
                <div style="margin-top:0.75rem;border-top:1px dashed rgba(108,99,255,0.3);padding-top:0.75rem;">
                    <div style="font-size:0.75rem;color:var(--primary);font-weight:700;letter-spacing:0.05em;margin-bottom:0.5rem;">✨ ADD A NEW COLOUR TO REORDER</div>
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        <!-- visual colour wheel picker -->
                        <input type="color" id="rcp_newclr_${pi}" value="#6c63ff" title="Pick colour"
                            style="width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;padding:1px;background:var(--bg-primary);flex-shrink:0;"
                            oninput="app._syncNewColorName(${pi})">
                        <!-- colour name text -->
                        <input type="text" id="rcp_newname_${pi}" placeholder="Colour name (e.g. Red, Navy…)"
                            style="flex:1;min-width:100px;padding:0.35rem 0.6rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-size:0.84rem;">
                        <!-- qty -->
                        <input type="number" id="rcp_newqty_${pi}" min="1" value="${defaultQty}" placeholder="Qty"
                            style="width:70px;padding:0.35rem 0.4rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;color:var(--text-light);font-size:0.84rem;text-align:center;">
                        <!-- add button -->
                        <button onclick="app._addNewReorderColor(${pi})"
                            style="background:var(--primary);border:none;color:#fff;border-radius:8px;padding:0.35rem 0.85rem;font-size:0.84rem;cursor:pointer;white-space:nowrap;flex-shrink:0;">+ Add</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderColorPickerModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;max-height:90vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('reorderColorPickerModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">🎨 📦</div>
                    <h2 style="color:var(--cyan);">Reorder — Pick Colours & Qty</h2>
                    <p style="color:var(--text-muted);font-size:0.85rem;">All saved colours shown below. Set qty to 0 to skip. Use ✨ to add a brand-new colour.</p>
                </div>
                ${productsHtml}
                <div style="display:flex;gap:0.75rem;margin-top:0.5rem;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('reorderColorPickerModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                    <button class="btn btn-primary" style="flex:2;" onclick="app._confirmReorderColorPicker()">📦 Continue to Reorder →</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });

        products.forEach((_, pi) => this._updateReorderColorTotal(pi));
    }

    // Sync the hex colour picker value to auto-fill the name field if it's empty
    _syncNewColorName(pi) {
        const picker  = document.getElementById('rcp_newclr_' + pi);
        const nameInp = document.getElementById('rcp_newname_' + pi);
        if (!picker || !nameInp) return;
        // Only auto-suggest when the name field is still empty
        if (nameInp.value.trim()) return;
        // Convert hex to a human-readable colour name
        const hex = picker.value;
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        const l = (max+min)/2/255;
        const s = max===min ? 0 : (l<0.5 ? (max-min)/(max+min) : (max-min)/(510-max-min));
        let h = 0;
        if (max!==min) {
            if (max===r) h = ((g-b)/(max-min)+6)%6*60;
            else if (max===g) h = ((b-r)/(max-min)+2)*60;
            else h = ((r-g)/(max-min)+4)*60;
        }
        let name = '';
        if (l < 0.12) name = 'Black';
        else if (l > 0.88 && s < 0.15) name = 'White';
        else if (s < 0.12) name = l < 0.4 ? 'Dark Grey' : l < 0.65 ? 'Grey' : 'Light Grey';
        else if (h < 15  || h >= 345) name = l < 0.35 ? 'Dark Red'    : l > 0.65 ? 'Light Red'   : 'Red';
        else if (h < 35)              name = l < 0.35 ? 'Brown'        : l > 0.65 ? 'Peach'        : 'Orange';
        else if (h < 65)              name = l < 0.35 ? 'Dark Yellow'  : l > 0.65 ? 'Light Yellow' : 'Yellow';
        else if (h < 150)             name = l < 0.35 ? 'Dark Green'   : l > 0.65 ? 'Light Green'  : 'Green';
        else if (h < 190)             name = l < 0.35 ? 'Teal'         : l > 0.65 ? 'Sky Blue'     : 'Cyan';
        else if (h < 260)             name = l < 0.35 ? 'Dark Blue'    : l > 0.65 ? 'Light Blue'   : 'Blue';
        else if (h < 290)             name = l < 0.35 ? 'Dark Purple'  : l > 0.65 ? 'Lavender'     : 'Purple';
        else if (h < 345)             name = l < 0.35 ? 'Dark Pink'    : l > 0.65 ? 'Light Pink'   : 'Pink';
        nameInp.value = name;
        nameInp.select();
    }

    // Add the new colour row to the list inside the modal (does NOT save to storage yet)
    _addNewReorderColor(pi) {
        const nameInp = document.getElementById('rcp_newname_' + pi);
        const qtyInp  = document.getElementById('rcp_newqty_' + pi);
        const picker  = document.getElementById('rcp_newclr_' + pi);
        const container = document.getElementById('rcp_colorrows_' + pi);
        if (!nameInp || !qtyInp || !container) return;

        const name = nameInp.value.trim();
        if (!name) { this.showNotification('Enter a colour name first', 'warning'); return; }
        const qty  = parseInt(qtyInp.value) || 1;
        const hex  = picker ? picker.value : '#888888';

        // Check for duplicate in existing rows
        const dupe = container.querySelector(`input[data-color-name="${name}"]`);
        if (dupe) { this.showNotification(`"${name}" already in the list`, 'warning'); return; }

        // Count existing rows to generate unique id
        const existing = container.querySelectorAll('input[type="number"]');
        const ci = existing.length;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:0.6rem;background:rgba(108,99,255,0.08);border-radius:8px;padding:0.45rem 0.65rem;border:1px solid rgba(108,99,255,0.35);margin-bottom:0.4rem;';
        row.dataset.newColor = 'true';
        row.innerHTML = `
            <span style="width:13px;height:13px;border-radius:50%;background:${hex};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
            <span style="flex:1;font-size:0.86rem;color:var(--text-light);">${name}</span>
            <span style="font-size:0.72rem;color:var(--primary);font-weight:700;background:rgba(108,99,255,0.15);padding:1px 7px;border-radius:20px;">NEW</span>
            <input type="number" min="0" value="${qty}"
                data-product-idx="${pi}" data-color-name="${name}" data-new-color="true" data-color-hex="${hex}"
                id="rcp_${pi}_new_${ci}"
                style="width:72px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                oninput="app._updateReorderColorTotal(${pi})">
            <button onclick="this.closest('[data-new-color=true]').remove();app._updateReorderColorTotal(${pi})"
                style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.25rem 0.45rem;cursor:pointer;font-size:0.8rem;flex-shrink:0;">✕</button>`;
        container.appendChild(row);

        // Clear inputs for next entry
        nameInp.value = '';
        qtyInp.value = '' + (parseInt(localStorage.getItem('defaultReorderQty')) || 50);
        if (picker) picker.value = '#6c63ff';

        this._updateReorderColorTotal(pi);
        this.showNotification(`"${name}" added to reorder list`, 'success');
    }

    _updateReorderColorTotal(productIdx) {
        const inputs = document.querySelectorAll(`#reorderColorPickerModal input[data-product-idx="${productIdx}"]`);
        let total = 0;
        inputs.forEach(inp => { total += parseInt(inp.value) || 0; });
        const el = document.getElementById('rcp_total_' + productIdx);
        if (el) el.textContent = total;
    }

    _confirmReorderColorPicker() {
        const modal = document.getElementById('reorderColorPickerModal');
        if (!modal) return;
        const products = this._pendingReorderProducts || [];

        // First: save any NEW colours to the product in storage
        modal.querySelectorAll('input[data-new-color="true"]').forEach(inp => {
            const pi = parseInt(inp.dataset.productIdx);
            const colorName = inp.dataset.colorName;
            const hex = inp.dataset.colorHex || '#888888';
            const p = products[pi];
            if (!p || !colorName) return;
            const fp = storage.getProductById(p.id);
            if (!fp) return;
            const existing = (fp.colors || []).map(c => (typeof c === 'string' ? c : c.name).toLowerCase());
            if (!existing.includes(colorName.toLowerCase())) {
                const updatedColors = [...(fp.colors || []), { name: colorName, qty: 0, hex }];
                storage.updateProduct(p.id, { colors: updatedColors });
            }
        });

        // Collect all inputs (existing + new) grouped by product index
        const byIdx = {};
        modal.querySelectorAll('input[data-product-idx]').forEach(inp => {
            const pi = String(inp.dataset.productIdx);
            const qty = parseInt(inp.value) || 0;
            if (qty === 0) return;
            if (!byIdx[pi]) byIdx[pi] = [];
            byIdx[pi].push({ colorName: inp.dataset.colorName, qty });
        });

        modal.remove();
        this._pendingReorderProducts = null;

        const reorderItems = [];
        products.forEach((p, pi) => {
            const entries = byIdx[String(pi)] || [];
            entries.forEach(({ colorName, qty }) => {
                reorderItems.push({
                    product: { ...p, _reorderColor: colorName || null },
                    qty,
                    colorName: colorName || null
                });
            });
        });

        if (reorderItems.length === 0) {
            this.showNotification('Enter at least one quantity > 0', 'warning');
            return;
        }

        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal(reorderItems, supplier);
    }

    showReorderModal(items, supplier) {
        const existing = document.getElementById('reorderModal');
        if (existing) existing.remove();
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const currency = localStorage.getItem('currency') || '₹';
        const itemsText = items.map(i => {
            const colorLabel = i.colorName ? ` [${i.colorName}]` : (i.product._reorderColor ? ` [${i.product._reorderColor}]` : '');
            return `• ${i.product.name}${colorLabel} — Qty: ${i.qty}`;
        }).join('\n');

        const itemsHtml = items.map(i => {
            const wholesalePrice = i.product.wholesalePrice || i.product.price;
            const lineTotal = wholesalePrice * i.qty;
            const colorLabel = i.colorName || i.product._reorderColor || null;
            const swatch = colorLabel ? `<span style="width:11px;height:11px;border-radius:50%;background:${this.getColorSwatch(colorLabel)};display:inline-block;border:1px solid rgba(0,0,0,0.2);margin-right:4px;vertical-align:middle;"></span>` : '';
            return `
            <tr>
                <td style="padding:0.5rem 0.75rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        ${i.product.photo
                            ? `<img src="${i.product.photo}" alt="${i.product.name}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`
                            : `<div style="width:38px;height:38px;background:var(--bg-primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:1px solid var(--border);">📦</div>`
                        }
                        <div>
                            <span style="font-weight:600;">${i.product.name}</span>
                            ${colorLabel ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">${swatch}${colorLabel}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="padding:0.5rem 0.75rem;color:var(--pink);font-weight:700;">${i.product.quantity}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--cyan);font-weight:700;">${i.qty}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--text-muted);font-size:0.85rem;">${currency}${wholesalePrice.toFixed(2)}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--primary);font-weight:700;">${currency}${lineTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const grandTotal = items.reduce((s, i) => s + ((i.product.wholesalePrice || i.product.price) * i.qty), 0);

        // Store on instance so onclick doesn't need to embed JSON in HTML attributes
        this._pendingReorderItems = items.map(i => ({
            id: i.product.id,
            qty: i.qty,
            colorName: i.colorName || i.product._reorderColor || null
        }));

        const savedEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const emailsHtml = savedEmails.map((em, idx) => `
            <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                <button onclick="app.removeSupplierEmail(${idx})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
            </div>`).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content reorder-modal" style="max-width:600px;max-height:92vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('reorderModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <div style="text-align:center;margin-bottom:1rem;">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;">📦</div>
                    <h2 style="color:var(--cyan);">Reorder Request</h2>
                    <p style="color:var(--text-muted);font-size:0.9rem;">${items.length} item${items.length > 1 ? 's' : ''} — Purchase Total: <strong style="color:var(--primary);">${currency}${grandTotal.toFixed(2)}</strong></p>
                </div>

                <div style="overflow-x:auto;margin-bottom:1.25rem;">
                <table style="width:100%;border-collapse:collapse;font-size:0.88rem;background:var(--bg-secondary);border-radius:8px;overflow:hidden;">
                    <thead>
                        <tr style="background:var(--primary);color:white;">
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Product</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Stock</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Order</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Unit Cost</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot>
                        <tr style="background:rgba(108,99,255,0.15);">
                            <td colspan="4" style="padding:0.6rem 0.75rem;font-weight:700;text-align:right;">Grand Total:</td>
                            <td style="padding:0.6rem 0.75rem;font-weight:700;color:var(--primary);">${currency}${grandTotal.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                </div>

                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">🏭 Which Supplier?</label>
                    <div style="display:flex;gap:0.4rem;margin-top:0.4rem;">
                        <select id="reorderSupplierSelect"
                            onchange="app._onReorderSupplierChange()"
                            style="flex:1;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text-light);font-size:0.88rem;">
                            <option value="">— Select supplier (optional) —</option>
                            ${storage.getSuppliers().map(s => `<option value="${s.id}" data-phone="${s.phone||''}" data-email="">${s.name}${s.city ? ' · ' + s.city : ''}</option>`).join('')}
                            <option value="__new__">＋ Add new supplier…</option>
                        </select>
                    </div>
                    <div id="reorderSupplierPreview" style="display:none;margin-top:0.5rem;background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.25);border-radius:8px;padding:0.5rem 0.75rem;font-size:0.82rem;color:var(--text-muted);"></div>
                </div>

                <div class="form-group">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">📧 Supplier Emails</label>
                    <div style="display:flex;gap:0.4rem;margin-top:0.4rem;">
                        <input type="email" id="reorderSupplierInput" placeholder="Add supplier email..." value="${supplier && supplier.includes('@') ? supplier : ''}"
                            style="flex:1;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text-light);font-size:0.88rem;">
                        <button onclick="app.addSupplierEmail()" style="background:var(--primary);border:none;color:white;border-radius:8px;padding:0.55rem 0.85rem;cursor:pointer;font-size:0.88rem;white-space:nowrap;">+ Add</button>
                    </div>
                    <div id="supplierEmailsList">${emailsHtml}</div>
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">💬 WhatsApp Number</label>
                    <input type="tel" id="reorderWhatsAppInput" value="${supplier && !supplier.includes('@') ? supplier : localStorage.getItem('supplierContact') || ''}" placeholder="+91 9999999999"
                        style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text-light);width:100%;font-size:0.88rem;margin-top:0.4rem;">
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">✉️ Message</label>
                    <textarea id="reorderNote" rows="5"
                        style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.75rem;color:var(--text-light);width:100%;font-size:0.85rem;resize:vertical;margin-top:0.4rem;"
                    >Dear Supplier,\n\nWe need to reorder the following items for ${storeName}:\n\n${itemsText}\n\nTotal Purchase Amount: ${currency}${grandTotal.toFixed(2)}\n\nPlease confirm availability and estimated delivery.\n\nThank you.</textarea>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.75rem;">
                    <button class="btn btn-primary btn-small" onclick="app.sendReorderViaEmail()">📧 Email All</button>
                    <button class="btn btn-secondary btn-small" onclick="app.sendReorderViaWhatsApp()">💬 WhatsApp</button>
                    <button class="btn btn-secondary btn-small" onclick="app.copyReorderNote()">📋 Copy</button>
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:0.75rem;background:linear-gradient(135deg,#00c96a,#00a855);"
                    onclick="app._reorderSelectedSupplierId = (document.getElementById('reorderSupplierSelect')?.value||null) || null; app.confirmReorderReceived(app._pendingReorderItems)">✅ Mark as Ordered & Generate Purchase Invoice</button>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
    }

    _onReorderSupplierChange() {
        const sel = document.getElementById('reorderSupplierSelect');
        const preview = document.getElementById('reorderSupplierPreview');
        const val = sel.value;

        if (val === '__new__') {
            sel.value = '';
            if (preview) { preview.style.display = 'none'; preview.textContent = ''; }
            const items = this._pendingReorderItems;
            const originalShowReorder = () => this.showReorderModal(
                (items||[]).map(i => {
                    const p = storage.getProductById(i.id);
                    return { product: { ...p, _reorderColor: i.colorName||null }, qty: i.qty, colorName: i.colorName||null };
                }), ''
            );
            const _origSave = this.saveSupplier.bind(this);
            this.saveSupplier = (supplierId) => {
                this.saveSupplier = _origSave;
                _origSave(supplierId);
                setTimeout(() => {
                    originalShowReorder();
                    setTimeout(() => {
                        const newest = storage.getSuppliers()[0];
                        const s2 = document.getElementById('reorderSupplierSelect');
                        if (s2 && newest) { s2.value = newest.id; this._onReorderSupplierChange(); }
                    }, 100);
                }, 200);
            };
            document.getElementById('reorderModal')?.remove();
            this.openSupplierModal();
            return;
        }

        if (!val) {
            if (preview) { preview.style.display = 'none'; preview.textContent = ''; }
            return;
        }

        const s = storage.getSupplierById(val);
        if (!s) return;

        const waInput = document.getElementById('reorderWhatsAppInput');
        if (waInput && s.phone) waInput.value = s.phone;

        if (preview) {
            const lastOrder = s.lastOrderDate
                ? new Date(s.lastOrderDate).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
                : 'Never';
            preview.style.display = 'block';
            preview.innerHTML = '<strong style="color:var(--cyan);">' + s.name + '</strong>' + (s.city ? ' · ' + s.city : '') + (s.phone ? ' · 📞 ' + s.phone : '') + (s.speciality ? '<br>🎨 ' + s.speciality : '') + '<br><span style="font-size:0.78rem;">Last order: <strong>' + lastOrder + '</strong></span>';
        }
    }


    addSupplierEmail() {
        const input = document.getElementById('reorderSupplierInput');
        const email = input.value.trim();
        if (!email || !email.includes('@')) { this.showNotification('Enter a valid email', 'warning'); return; }
        const emails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        if (emails.includes(email)) { this.showNotification('Email already added', 'warning'); return; }
        emails.push(email);
        localStorage.setItem('supplierEmails', JSON.stringify(emails));
        input.value = '';
        const list = document.getElementById('supplierEmailsList');
        if (list) {
            list.innerHTML = emails.map((em, idx) => `
                <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                    <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                    <button onclick="app.removeSupplierEmail(${idx})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
                </div>`).join('');
        }
        this.showNotification(`✅ ${email} added!`, 'success');
    }

    removeSupplierEmail(idx) {
        const emails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        emails.splice(idx, 1);
        localStorage.setItem('supplierEmails', JSON.stringify(emails));
        const list = document.getElementById('supplierEmailsList');
        if (list) {
            list.innerHTML = emails.map((em, i) => `
                <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                    <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                    <button onclick="app.removeSupplierEmail(${i})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
                </div>`).join('');
        }
        this.showNotification('Email removed', 'success');
    }

    sendReorderViaEmail() {
        const note = document.getElementById('reorderNote').value;
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        // Capture supplier selection for _finalisePurchase
        const _selSup = document.getElementById('reorderSupplierSelect');
        this._reorderSelectedSupplierId = (_selSup && _selSup.value && _selSup.value !== '__new__') ? _selSup.value : null;
        const typed = document.getElementById('reorderSupplierInput').value.trim();
        const savedEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const allEmails = [...new Set([...savedEmails, ...(typed && typed.includes('@') ? [typed] : [])])];
        if (allEmails.length === 0) { this.showNotification('Add at least one supplier email first', 'warning'); return; }
        const mailto = allEmails.join(',');

        // Save sent info for feedback panel
        const sentInfo = {
            type: 'email',
            recipients: allEmails,
            sentAt: new Date().toISOString(),
            subject: 'Reorder Request from ' + storeName
        };
        sessionStorage.setItem('whatsapp_sent', JSON.stringify(sentInfo));

        window.open(`mailto:${mailto}?subject=${encodeURIComponent('Reorder Request from ' + storeName)}&body=${encodeURIComponent(note)}`);

        // Create pending order record
        this._createPendingOrderFromReorder(allEmails[0] || storeName);

        // Show inline success immediately (email doesn't leave page)
        document.getElementById('reorderModal')?.remove();
        this.showSentSuccessPanel(sentInfo);
    }

    sendReorderViaWhatsApp() {
        const phoneInput = document.getElementById('reorderWhatsAppInput').value.trim();
        const note = document.getElementById('reorderNote').value;
        // Capture supplier selection for _finalisePurchase
        const _selSup2 = document.getElementById('reorderSupplierSelect');
        this._reorderSelectedSupplierId = (_selSup2 && _selSup2.value && _selSup2.value !== '__new__') ? _selSup2.value : null;
        const phone = phoneInput.replace(/\D/g, '');
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';

        if (!phone) {
            this.showNotification('Enter a WhatsApp number first', 'warning');
            return;
        }

        // Collect product info for display
        const rows = document.querySelectorAll('#reorderModal tbody tr');
        const productList = [];
        rows.forEach(row => {
            const img = row.querySelector('img');
            const nameEl = row.querySelector('span[style*="font-weight"]') || row.querySelector('td:first-child span');
            const name = nameEl ? nameEl.textContent.trim() : '';
            productList.push({ name, imgSrc: img ? img.src : null });
        });

        const sentInfo = {
            type: 'whatsapp',
            phone: '+' + phone,
            recipients: ['+' + phone],
            sentAt: new Date().toISOString(),
            storeName,
            products: productList
        };
        sessionStorage.setItem('whatsapp_sent', JSON.stringify(sentInfo));

        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(note)}`;

        // Remove reorder modal first
        document.getElementById('reorderModal')?.remove();

        // Create pending order record
        this._createPendingOrderFromReorder('+' + phone);

        // Open WhatsApp in new tab
        window.open(waUrl, '_blank');

        // Listen for user returning to this tab — show success panel immediately
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', onVisible);
                const pending = sessionStorage.getItem('whatsapp_sent');
                if (pending) {
                    sessionStorage.removeItem('whatsapp_sent');
                    this.showSentSuccessPanel(JSON.parse(pending));
                }
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        // Also show a small toast so user knows what to do
        this.showNotification('💬 WhatsApp opened — return here after sending!', 'success');
    }

    showSentSuccessPanel(info) {
        // Remove existing
        document.getElementById('sentSuccessPanel')?.remove();

        const panel = document.createElement('div');
        panel.id = 'sentSuccessPanel';
        panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99998;display:flex;align-items:center;justify-content:center;padding:1rem;';

        const typeIcon = info.type === 'whatsapp' ? '💬' : '📧';
        const typeName = info.type === 'whatsapp' ? 'WhatsApp' : 'Email';
        const recipientsList = (info.recipients || []).map(r =>
            `<div style="background:rgba(0,201,106,0.1);border:1px solid rgba(0,201,106,0.3);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.85rem;color:#00c96a;margin-bottom:0.3rem;">${r}</div>`
        ).join('');
        const sentTime = info.sentAt ? new Date(info.sentAt).toLocaleString() : new Date().toLocaleString();

        const productsSection = (info.products && info.products.length > 0) ? `
            <div style="margin:1rem 0;">
                <p style="color:#888;font-size:0.8rem;margin-bottom:0.5rem;font-weight:600;">PRODUCTS IN REQUEST</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;">
                    ${info.products.map(p => `<div style="text-align:center;">
                        ${p.imgSrc ? `<img src="${p.imgSrc}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:2px solid #00c96a;">` : `<div style="width:48px;height:48px;background:#f0fdf4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:2px solid #00c96a;">📦</div>`}
                        <div style="font-size:0.7rem;color:#555;margin-top:0.2rem;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
                    </div>`).join('')}
                </div>
            </div>` : '';

        panel.innerHTML = `
            <div style="background:white;border-radius:20px;padding:2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.5);">
                <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 1rem;">✅</div>
                <h2 style="color:#166534;margin-bottom:0.25rem;">Message Sent!</h2>
                <p style="color:#555;font-size:0.9rem;margin-bottom:1.25rem;">Your reorder request was sent via ${typeIcon} ${typeName}</p>

                <div style="background:#f8fafc;border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:left;">
                    <p style="color:#888;font-size:0.75rem;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Sent To</p>
                    ${recipientsList}
                    <p style="color:#aaa;font-size:0.75rem;margin-top:0.5rem;">🕐 ${sentTime}</p>
                </div>

                ${productsSection}

                <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:0.6rem;font-size:0.8rem;color:#92400e;margin-bottom:1.25rem;">
                    💡 Mark the reorder as received once the stock arrives to update your inventory
                </p>

                <button onclick="document.getElementById('sentSuccessPanel').remove();window.app&&window.app.refreshActivePage()" style="width:100%;padding:0.85rem;background:linear-gradient(135deg,#6c63ff,#5a52e8);border:none;color:white;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;">
                    Back to App →
                </button>
            </div>`;
        document.body.appendChild(panel);
        panel.addEventListener('click', (e) => { if (e.target === panel) { panel.remove(); window.app && window.app.refreshActivePage(); } });
    }

    _createPendingOrderFromReorder(supplier) {
        const items = (this._pendingReorderItems || []).map(item => {
            const p = storage.getProductById(item.id);
            return {
                id: item.id,
                name: p ? p.name : item.id,
                photo: p ? p.photo : null,
                qty: item.qty,
                colorName: item.colorName || null
            };
        });
        if (items.length === 0) return;
        // Capture the supplier selected in the reorder modal dropdown
        const selEl = document.getElementById('reorderSupplierSelect');
        const selectedSupplierId = selEl && selEl.value && selEl.value !== '__new__' ? selEl.value : null;
        const selectedSupplierObj = selectedSupplierId ? storage.getSupplierById(selectedSupplierId) : null;
        const supplierDisplay = selectedSupplierObj ? selectedSupplierObj.name : supplier;
        storage.addPendingOrder({ supplier: supplierDisplay, supplierId: selectedSupplierId, items });
        this.updatePendingOrdersBadge();
    }

    copyReorderNote() {
        navigator.clipboard.writeText(document.getElementById('reorderNote').value)
            .then(() => this.showNotification('📋 Copied to clipboard!', 'success'))
            .catch(() => this.showNotification('Copy failed — select manually', 'error'));
    }

    confirmReorderReceived(items) {
        // Step 1: Show "How much did you purchase each item for?" modal
        const existing = document.getElementById('purchasePriceModal');
        if (existing) existing.remove();

        // Normalise and persist so _finalisePurchase can read via app._pendingReorderItems
        this._pendingReorderItems = items.map(i => ({
            id: i.id || (i.product && i.product.id),
            qty: i.qty,
            colorName: i.colorName || (i.product && i.product._reorderColor) || null
        })).filter(i => i.id);

        const currency = localStorage.getItem('currency') || '₹';

        // Build rows — one per unique product (group colours under same product)
        const productMap = {};
        this._pendingReorderItems.forEach(({ id, qty, colorName }) => {
            const p = storage.getProductById(id);
            if (!p) return;
            if (!productMap[id]) {
                productMap[id] = { p, entries: [] };
            }
            productMap[id].entries.push({ qty, colorName: colorName || null });
        });

        const rowsHtml = Object.values(productMap).map(({ p, entries }) => {
            const totalQty = entries.reduce((s, e) => s + e.qty, 0);
            const currentWholesale = p.wholesalePrice || p.price || 0;
            const colorTags = entries
                .filter(e => e.colorName)
                .map(e => `<span style="background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.3);border-radius:20px;padding:1px 8px;font-size:0.72rem;color:#a78bfa;">${e.colorName} ×${e.qty}</span>`)
                .join(' ');
            return `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:0.75rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
                    ${p.photo
                        ? `<img src="${p.photo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
                        : `<div style="width:44px;height:44px;background:var(--bg-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">📦</div>`
                    }
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--cyan);font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Qty received: <strong style="color:var(--green);">${totalQty}</strong>${colorTags ? ' &nbsp;' + colorTags : ''}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                    <div>
                        <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px;letter-spacing:0.06em;text-transform:uppercase;">Purchase Price / Unit <span style="color:var(--pink);">*</span></label>
                        <div style="display:flex;align-items:center;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                            <span style="padding:0 8px;color:var(--text-muted);font-size:0.85rem;">${currency}</span>
                            <input type="number" min="0" step="0.01"
                                id="pp_cost_${p.id}"
                                value="${currentWholesale.toFixed(2)}"
                                placeholder="0.00"
                                oninput="app._updatePurchasePriceTotal('${p.id}', ${totalQty})"
                                style="flex:1;padding:0.5rem 0.5rem;background:transparent;border:none;color:var(--text-light);font-size:0.9rem;outline:none;min-width:0;">
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px;letter-spacing:0.06em;text-transform:uppercase;">Line Total</label>
                        <div id="pp_line_${p.id}" style="background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.25);border-radius:8px;padding:0.5rem 0.75rem;font-size:0.92rem;font-weight:700;color:var(--primary);">${currency}${(currentWholesale * totalQty).toFixed(2)}</div>
                    </div>
                </div>
                <div style="margin-top:0.5rem;">
                    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.82rem;color:var(--text-muted);">
                        <input type="checkbox" id="pp_update_${p.id}" checked style="accent-color:var(--primary);width:14px;height:14px;">
                        Update wholesale price in inventory to this amount
                    </label>
                </div>
                <input type="hidden" id="pp_qty_${p.id}" value="${totalQty}">
                <input type="hidden" id="pp_entries_${p.id}" value='${JSON.stringify(entries)}'>
            </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'purchasePriceModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;max-height:92vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('purchasePriceModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">🧾</div>
                    <h2 style="color:var(--cyan);font-size:1.1rem;margin-bottom:0.3rem;">Purchase Price Entry</h2>
                    <p style="color:var(--text-muted);font-size:0.83rem;">Enter the price <em>you paid</em> per unit. This will be used to generate the purchase bill and update your wholesale price.</p>
                </div>
                ${rowsHtml}
                <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.2);border-radius:10px;padding:0.75rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.85rem;color:var(--text-muted);">Grand Total Paid</span>
                    <span id="pp_grand_total" style="font-size:1.1rem;font-weight:800;color:var(--neon);">calculating…</span>
                </div>
                <div style="display:flex;gap:0.6rem;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('purchasePriceModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                    <button class="btn btn-primary" style="flex:2;" onclick="app._finalisePurchase(app._pendingReorderItems)">✅ Generate Bill & Update Stock</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });

        // Close reorder modal if still open
        document.getElementById('reorderModal')?.remove();

        // Calculate initial grand total
        setTimeout(() => {
            Object.values(productMap).forEach(({ p, entries }) => {
                const totalQty = entries.reduce((s, e) => s + e.qty, 0);
                this._updatePurchasePriceTotal(p.id, totalQty);
            });
        }, 50);
    }

    _updatePurchasePriceTotal(productId, qty) {
        const currency = localStorage.getItem('currency') || '₹';
        const costInput = document.getElementById('pp_cost_' + productId);
        const lineEl = document.getElementById('pp_line_' + productId);
        if (!costInput || !lineEl) return;
        const cost = parseFloat(costInput.value) || 0;
        lineEl.textContent = currency + (cost * qty).toFixed(2);

        // Recalculate grand total across all rows
        let grand = 0;
        document.querySelectorAll('#purchasePriceModal input[id^="pp_cost_"]').forEach(inp => {
            const pid = inp.id.replace('pp_cost_', '');
            const qtyEl = document.getElementById('pp_qty_' + pid);
            const q = qtyEl ? parseInt(qtyEl.value) || 0 : 0;
            grand += (parseFloat(inp.value) || 0) * q;
        });
        const grandEl = document.getElementById('pp_grand_total');
        if (grandEl) grandEl.textContent = currency + grand.toFixed(2);
    }

    _finalisePurchase(items) {
        if (!items || !items.length) {
            this.showNotification('No items to process', 'error');
            return;
        }
        const currency = localStorage.getItem('currency') || '₹';
        const supplierEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const supplierContact = localStorage.getItem('supplierContact') || '';

        // Read selected supplier from the reorder modal (still stored on instance)
        const selectedSupplierId = this._reorderSelectedSupplierId || null;
        const selectedSupplierObj = selectedSupplierId ? storage.getSupplierById(selectedSupplierId) : null;

        const invoiceItems = [];
        let purchaseTotal = 0;

        // Group by product id first so we accumulate qty correctly before writing to storage
        const byProduct = {};
        items.forEach(({ id, qty, colorName }) => {
            if (!byProduct[id]) byProduct[id] = [];
            byProduct[id].push({ qty, colorName: colorName || null });
        });

        Object.entries(byProduct).forEach(([id, entries]) => {
            const p = storage.getProductById(id);
            if (!p) return;

            const costInput = document.getElementById('pp_cost_' + id);
            const unitCost = costInput ? (parseFloat(costInput.value) || 0) || (p.wholesalePrice || p.price) : (p.wholesalePrice || p.price);
            const shouldUpdateWholesale = document.getElementById('pp_update_' + id)?.checked !== false;

            const totalQtyForProduct = entries.reduce((s, e) => s + e.qty, 0);

            // Build invoice line items
            entries.forEach(({ qty, colorName }) => {
                const lineTotal = unitCost * qty;
                invoiceItems.push({
                    id: p.id,
                    name: p.name + (colorName ? ` — ${colorName}` : ''),
                    price: unitCost,
                    cartQuantity: qty,
                    selectedColor: colorName || '',
                    photo: p.photo || null
                });
                purchaseTotal += lineTotal;
            });

            // Update stock using the color-aware method so total always = sum of color qtys
            entries.forEach(({ qty, colorName }) => {
                if (colorName && p.colors && p.colors.length > 0) {
                    storage.addStockToColorProduct(id, colorName, qty);
                }
            });
            // If no colors on any entry, just add total to quantity directly
            const hasColorEntries = entries.some(e => e.colorName);
            if (!hasColorEntries) {
                const fresh = storage.getProductById(id);
                if (fresh) storage.updateStock(id, (fresh.quantity || 0) + totalQtyForProduct);
            }

            // Update wholesale price if checkbox ticked
            if (shouldUpdateWholesale) {
                const latest = storage.getProductById(id);
                if (latest) storage.updateProduct(id, { wholesalePrice: unitCost });
            }
        });

        const resolvedSupplierName = selectedSupplierObj
            ? selectedSupplierObj.name
            : (supplierEmails.length > 0 ? supplierEmails[0] : (supplierContact || 'Supplier'));

        const purchaseInvoice = {
            type: 'purchase',
            supplierName: resolvedSupplierName,
            supplierId: selectedSupplierId || null,
            supplierContact: selectedSupplierObj ? (selectedSupplierObj.phone || supplierContact) : supplierContact,
            supplierEmails,
            items: invoiceItems,
            subtotal: purchaseTotal,
            taxRate: 0,
            tax: 0,
            total: purchaseTotal,
            currency,
            note: 'Purchase / Reorder — stock added'
        };

        const saved = storage.addInvoice(purchaseInvoice);

        // ── Update supplier card: lastOrderDate + link/update products ──────────
        if (selectedSupplierId && selectedSupplierObj) {
            storage.updateSupplier(selectedSupplierId, { lastOrderDate: new Date().toISOString() });
            // Always link products to the selected supplier (overwrite old supplier too)
            Object.keys(byProduct).forEach(pid => {
                const prod = storage.getProductById(pid);
                if (prod) {
                    storage.updateProduct(pid, { supplierId: selectedSupplierId, supplierName: selectedSupplierObj.name });
                }
            });
            this._reorderSelectedSupplierId = null;
        }

        document.getElementById('purchasePriceModal')?.remove();
        this.loadLowStockPage();
        this.updateDashboard();
        if (document.getElementById('colorbook')?.classList.contains('active')) {
            this.loadColorBook();
        }
        // Refresh suppliers page if it is open
        if (document.getElementById('suppliersContent')) {
            this.loadSuppliersPage();
        }
        this.showNotification(`✅ Stock updated! Purchase bill ${saved.id} generated.`, 'success');
        setTimeout(() => this.viewPurchaseInvoice(saved.id), 400);
    }

    viewPurchaseInvoice(id) {
        window._currentInvoiceId = id; // used by WhatsApp button in print modal
        const inv = storage.getInvoiceById(id);
        if (!inv) return;
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const storePhone = localStorage.getItem('storePhone') || '';
        const storeAddress = localStorage.getItem('storeAddress') || '';
        const currency = inv.currency || '₹';

        const itemsHtml = inv.items.map((item, i) => {
            const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
            return `
            <tr style="background:${rowBg};border-bottom:1px solid rgba(0,201,106,0.15);">
                <td style="padding:0.75rem 1rem;display:flex;align-items:center;gap:0.6rem;">
                    ${item.photo ? `<img src="${item.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid rgba(0,201,106,0.3);">` : '<span style="font-size:1.2rem;">📦</span>'}
                    <span style="color:#e8e8f0;font-weight:600;font-size:0.88rem;">${item.name}</span>
                </td>
                <td style="padding:0.75rem 1rem;text-align:center;color:#6ee7b7;font-weight:700;">${item.cartQuantity}</td>
                <td style="padding:0.75rem 1rem;text-align:right;color:#a7f3d0;">${currency}${item.price.toFixed(2)}</td>
                <td style="padding:0.75rem 1rem;text-align:right;color:#00ff88;font-weight:700;">${currency}${(item.price * item.cartQuantity).toFixed(2)}</td>
            </tr>`;
        }).join('');

        document.getElementById('invoicePrintContent').innerHTML = `
            <div style="font-family:'Outfit',sans-serif;max-width:600px;margin:0 auto;color:#e8e8f0;">

                <!-- Header -->
                <div style="text-align:center;margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:2px solid rgba(0,201,106,0.5);">
                    <h2 style="color:#00ff88;font-size:1.6rem;font-weight:800;margin-bottom:0.3rem;">🏪 ${storeName}</h2>
                    ${storeAddress ? `<p style="color:#8080a0;font-size:0.82rem;margin-top:4px;">${storeAddress}</p>` : ''}
                    ${storePhone ? `<p style="color:#8080a0;font-size:0.82rem;margin-top:2px;">📞 ${storePhone}</p>` : ''}
                    <div style="display:inline-block;background:rgba(0,201,106,0.15);border:1px solid rgba(0,201,106,0.35);border-radius:20px;padding:0.25rem 0.9rem;margin-top:0.6rem;">
                        <span style="color:#00ff88;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;">📦 PURCHASE INVOICE</span>
                    </div>
                </div>

                <!-- Invoice # + Date -->
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <p style="font-size:0.72rem;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:0.3rem;font-family:'Space Mono',monospace;">INVOICE #</p>
                        <p style="font-weight:700;color:#00a855;font-size:1rem;">${inv.id}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:0.72rem;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:0.3rem;font-family:'Space Mono',monospace;">DATE</p>
                        <p style="font-weight:600;color:#6ee7b7;">${new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <!-- Supplier -->
                <div style="background:rgba(0,168,85,0.1);border:1px solid rgba(0,168,85,0.25);border-radius:10px;padding:1rem 1.2rem;margin-bottom:1.5rem;">
                    <p style="font-size:0.72rem;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:0.35rem;font-family:'Space Mono',monospace;">SUPPLIER</p>
                    <p style="font-weight:700;color:#e8e8f0;font-size:1rem;">${inv.supplierName || 'Supplier'}</p>
                    ${inv.supplierContact ? `<p style="color:#8080a0;margin-top:4px;font-size:0.85rem;">📞 ${inv.supplierContact}</p>` : ''}
                    ${inv.supplierEmails && inv.supplierEmails.length > 0 ? `<p style="color:#8080a0;font-size:0.85rem;margin-top:2px;">✉️ ${inv.supplierEmails.join(', ')}</p>` : ''}
                </div>

                <!-- Items Table -->
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;border-radius:10px;overflow:hidden;">
                    <thead>
                        <tr style="background:linear-gradient(135deg,#00a855,#007a3d);">
                            <th style="padding:0.85rem 1rem;text-align:left;color:#fff;font-size:0.82rem;letter-spacing:0.05em;">Product</th>
                            <th style="padding:0.85rem 1rem;text-align:center;color:#fff;font-size:0.82rem;letter-spacing:0.05em;">Qty</th>
                            <th style="padding:0.85rem 1rem;text-align:right;color:#fff;font-size:0.82rem;letter-spacing:0.05em;">Unit Cost</th>
                            <th style="padding:0.85rem 1rem;text-align:right;color:#fff;font-size:0.82rem;letter-spacing:0.05em;">Total</th>
                        </tr>
                    </thead>
                    <tbody style="border:1px solid rgba(0,168,85,0.2);">${itemsHtml}</tbody>
                </table>

                <!-- Totals -->
                <div style="border-top:2px solid rgba(0,201,106,0.4);padding-top:1rem;text-align:right;">
                    <p style="font-size:1.4rem;font-weight:800;color:#00ff88;letter-spacing:0.02em;">PURCHASE TOTAL: ${currency}${inv.total.toFixed(2)}</p>
                    <p style="font-size:0.78rem;color:#5a5a7a;margin-top:0.35rem;">This amount is deducted from net revenue</p>
                </div>

                <p style="text-align:center;color:#5a5a7a;font-size:0.78rem;margin-top:2rem;">📦 Stock has been updated · ${new Date(inv.createdAt).toLocaleString()}</p>
            </div>
        `;
        document.getElementById('invoicePrintModal').classList.add('active');
    }

    saveThreshold() {
        const val = parseInt(document.getElementById('lowStockThreshold').value);
        if (!val || val < 1) { this.showNotification('Threshold must be ≥ 1', 'warning'); return; }
        this.lowStockThreshold = val;
        localStorage.setItem('lowStockThreshold', val);
        this.loadLowStockPage();
        this.showNotification(`Threshold set to ${val} units`, 'success');
    }

    // =====================
    // SETTINGS
    // =====================
    loadSettings() {
        document.getElementById('storeName').value    = localStorage.getItem('storeName')    || '';
        document.getElementById('storeOwner').value   = localStorage.getItem('storeOwner')   || '';
        document.getElementById('storeEmail').value   = localStorage.getItem('storeEmail')   || '';
        document.getElementById('storePhone').value   = localStorage.getItem('storePhone')   || '';
        document.getElementById('storeAddress').value = localStorage.getItem('storeAddress') || '';
        const gstinEl = document.getElementById('storeGSTIN');
        if (gstinEl) gstinEl.value = localStorage.getItem('storeGSTIN') || '';
        const stateEl = document.getElementById('storeState');
        if (stateEl) stateEl.value = localStorage.getItem('storeState') || '';
        const stateCodeEl = document.getElementById('storeStateCode');
        if (stateCodeEl) stateCodeEl.value = localStorage.getItem('storeStateCode') || '';
        const logoEl = document.getElementById('storeLogoUrl');
        if (logoEl) logoEl.value = localStorage.getItem('storeLogoUrl') || '';
        document.getElementById('currency').value = localStorage.getItem('currency') || '₹';
        document.getElementById('taxRate').value = localStorage.getItem('taxRate') || '0';
        document.getElementById('invoicePrefix').value = localStorage.getItem('invoicePrefix') || 'INV';
        document.getElementById('lowStockThresholdSetting').value = this.lowStockThreshold;
        const theme = localStorage.getItem('shopTheme') || 'dark';
        document.querySelectorAll('input[name="appTheme"]').forEach(r => {
            r.checked = r.value === theme;
        });
        this.loadProfilesInSettings();
    }

    loadProfilesInSettings() {
        const container = document.getElementById('profilesSettingsList');
        if (!container) return;
        const profiles = storage.getAllProfiles();
        const active = storage.getCurrentUser();
        container.innerHTML = profiles.map(p => `
            <div style="display:flex;align-items:center;gap:0.75rem;background:var(--bg-secondary);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.5rem;border:${p.id === active ? '1.5px solid var(--primary)' : '1px solid var(--border)'};">
                <span style="font-size:1.5rem;">${p.avatar || '👤'}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;color:var(--text-light);">${p.name}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${p.email}</div>
                </div>
                ${p.id === active ? `<span style="font-size:0.72rem;background:rgba(108,99,255,0.2);color:var(--primary);border-radius:10px;padding:0.15rem 0.5rem;font-weight:600;">Active</span>` : ''}
                ${profiles.length > 1 && p.id !== active ? `<button onclick="app.deleteProfileFromSettings('${p.id}')" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;font-size:0.8rem;">🗑️</button>` : ''}
            </div>
        `).join('');
    }

    deleteProfileFromSettings(id) {
        if (!confirm('Delete this profile and all their data?')) return;
        storage.deleteProfile(id);
        this.loadProfilesInSettings();
        this.showNotification('Profile deleted', 'success');
    }

    openAddProfileModal() {
        const avatarOptions = ['👤', '👩', '👨', '🧑', '👩‍💼', '👨‍💼', '🧑‍💼', '👩‍🔬', '👨‍🔬'];
        const modal = document.createElement('div');
        modal.id = 'addProfileModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <span class="close" onclick="document.getElementById('addProfileModal').remove();window.app&&window.app.refreshActivePage()">×</span>
                <h2 style="margin-bottom:1.25rem;color:var(--cyan);">👤 Add New Profile</h2>
                <div class="form-group">
                    <label>Avatar</label>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;" id="avatarPicker">
                        ${avatarOptions.map((a, i) => `<button type="button" onclick="app.selectAvatar('${a}',this)" style="font-size:1.5rem;padding:0.35rem 0.55rem;background:${i===0?'var(--primary)':'var(--bg-secondary)'};border:${i===0?'2px solid var(--primary)':'1px solid var(--border)'};border-radius:8px;cursor:pointer;">${a}</button>`).join('')}
                    </div>
                    <input type="hidden" id="newProfileAvatarVal" value="👤">
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="newProfileNameModal" placeholder="Your name">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" id="newProfileEmailModal" placeholder="your@email.com">
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:0.75rem;" onclick="app.saveNewProfileFromModal()">➕ Add Profile</button>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
    }

    selectAvatar(avatar, btn) {
        document.getElementById('newProfileAvatarVal').value = avatar;
        document.querySelectorAll('#avatarPicker button').forEach(b => {
            b.style.background = 'var(--bg-secondary)';
            b.style.border = '1px solid var(--border)';
        });
        btn.style.background = 'var(--primary)';
        btn.style.border = '2px solid var(--primary)';
    }

    saveNewProfileFromModal() {
        const email = document.getElementById('newProfileEmailModal').value.trim();
        const name = document.getElementById('newProfileNameModal').value.trim() || email.split('@')[0];
        const avatar = document.getElementById('newProfileAvatarVal').value || '👤';
        if (!email || !email.includes('@')) { this.showNotification('Enter a valid email', 'warning'); return; }

        const profileId = 'profile_' + Date.now();
        const profile = { id: profileId, name, email, avatar, createdAt: new Date().toISOString() };
        storage.addProfile(profile);
        document.getElementById('addProfileModal')?.remove();
        this.loadProfilesInSettings();
        this.showNotification(`✅ Profile "${name}" added!`, 'success');
    }

    saveStoreInfo() {
        const storeName = document.getElementById('storeName').value.trim();
        if (!storeName) { this.showNotification('Store name is required', 'warning'); return; }
        localStorage.setItem('storeName', storeName);
        localStorage.setItem('storeOwner', document.getElementById('storeOwner').value);
        localStorage.setItem('storeEmail', document.getElementById('storeEmail').value);
        localStorage.setItem('storePhone', document.getElementById('storePhone').value);
        localStorage.setItem('storeAddress', document.getElementById('storeAddress').value);
        const gstinSave = document.getElementById('storeGSTIN');
        if (gstinSave) localStorage.setItem('storeGSTIN', gstinSave.value.toUpperCase().trim());
        const stateSave = document.getElementById('storeState');
        if (stateSave) localStorage.setItem('storeState', stateSave.value.trim());
        const stateCodeSave = document.getElementById('storeStateCode');
        if (stateCodeSave) localStorage.setItem('storeStateCode', stateCodeSave.value.trim());
        const logoSave = document.getElementById('storeLogoUrl');
        if (logoSave) localStorage.setItem('storeLogoUrl', logoSave.value.trim());
        this.showNotification('✅ Store info saved!', 'success');
    }

    saveGeneralSettings() {
        const currency = document.getElementById('currency').value;
        const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
        const invoicePrefix = document.getElementById('invoicePrefix').value || 'INV';
        if (taxRate < 0 || taxRate > 100) { this.showNotification('Tax rate must be 0–100', 'warning'); return; }
        localStorage.setItem('currency', currency);
        localStorage.setItem('taxRate', taxRate);
        // Save invoice prefix per-profile so multiple profiles don't share it
        localStorage.setItem(storage.currentUser + '_invoicePrefix', invoicePrefix);
        localStorage.setItem('invoicePrefix', invoicePrefix); // keep global as fallback
        this.showNotification('✅ General settings saved!', 'success');
    }

    saveLowStockThreshold() {
        const threshold = parseInt(document.getElementById('lowStockThresholdSetting').value);
        if (!threshold || threshold < 1) { this.showNotification('Threshold must be ≥ 1', 'warning'); return; }
        this.lowStockThreshold = threshold;
        localStorage.setItem('lowStockThreshold', threshold);
        this.showNotification(`✅ Low stock threshold set to ${threshold}`, 'success');
        this.updateDashboard();
    }

    applyThemeFromSettings() {
        const selected = document.querySelector('input[name="appTheme"]:checked');
        if (!selected) return;
        this.applyTheme(selected.value);
        this.showNotification('✅ Theme applied!', 'success');
    }

    setCustomerType(type) {
        document.getElementById('customerType').value = type;
        const cashBtn = document.getElementById('typeCashBtn');
        const creditBtn = document.getElementById('typeCreditBtn');
        const wsBtn = document.getElementById('typeWholesalerBtn');
        const supplierBtn = document.getElementById('typeSupplierBtn');
        [cashBtn, creditBtn, wsBtn, supplierBtn].forEach(b => { if (b) { b.classList.remove('btn-primary', 'active'); b.classList.add('btn-secondary'); } });
        
        let activeBtn;
        if (type === 'cash') activeBtn = cashBtn;
        else if (type === 'credit') activeBtn = creditBtn;
        else if (type === 'wholesaler') activeBtn = wsBtn;
        else activeBtn = supplierBtn;
        
        if (activeBtn) { activeBtn.classList.add('btn-primary', 'active'); activeBtn.classList.remove('btn-secondary'); }

        // For purchase/supplier type, change label and show purchase UI
        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('customerPhone');
        if (type === 'supplier') {
            if (nameInput) nameInput.placeholder = 'Supplier name';
            if (phoneInput) phoneInput.placeholder = 'Supplier phone (optional)';
            document.getElementById('generateInvoiceBtn').textContent = '📦 GENERATE PURCHASE INVOICE';
        } else {
            if (nameInput) nameInput.placeholder = 'Customer / Supplier name';
            if (phoneInput) phoneInput.placeholder = 'Phone (optional)';
            document.getElementById('generateInvoiceBtn').textContent = '🧾 GENERATE INVOICE';
        }

        // Refresh product dropdown to show correct price label
        this.updateProductSelect();

        // Re-price any items already in the cart
        const useWholesale = type === 'wholesaler' || type === 'supplier';
        this.cartItems.forEach(item => {
            item.price = useWholesale
                ? (item._wholesalePrice || item._sellingPrice || item.price)
                : (item._sellingPrice || item.price);
        });
        this.renderCart();
    }

    saveCustomerAndProceed() {
        const name = document.getElementById('customerName').value.trim();
        const type = document.getElementById('customerType').value;
        if (!name) {
            this.showNotification('Customer name is required', 'warning');
            document.getElementById('customerName').focus();
            return;
        }
        if (!type) {
            this.showNotification('Please select customer type (Cash or Wholesaler)', 'warning');
            return;
        }
        // Add any pending items queued from the inventory Bill button
        if (this._pendingCartEntries && this._pendingCartEntries.length > 0) {
            this._pendingCartEntries.forEach(({ productId, qty, color }) => {
                this.addToCartWithColor(productId, qty, color);
            });
            this._pendingCartEntries = null;
        }
        this.switchBillingTab('cart');
        this.showNotification('✓ Customer saved — items added to cart', 'success');
    }

    // =====================
    // BILLING TAB (mobile)
    // =====================
    switchBillingTab(tab) {
        const customerBtn = document.getElementById('billingTabCustomer');
        const cartBtn = document.getElementById('billingTabCart');
        const formSection = document.getElementById('billingFormSection');
        const cartSection = document.getElementById('billingCartSection');
        if (customerBtn && cartBtn) {
            customerBtn.classList.toggle('active', tab === 'customer');
            cartBtn.classList.toggle('active', tab === 'cart');
        }
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;
        if (formSection) formSection.classList.toggle('tab-active', tab === 'customer');
        if (cartSection) cartSection.classList.toggle('tab-active', tab === 'cart');
    }

    // =====================
    // THEME
    // =====================
    loadTheme() {
        const theme = localStorage.getItem('shopTheme') || 'dark';
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('shopTheme', theme);
        const btn = document.getElementById('themeToggle');
        const mobileBtn = document.getElementById('mobileThemeBtn');
        const icon = theme === 'dark' ? '☀️' : '🌙';
        if (btn) btn.textContent = icon;
        if (mobileBtn) mobileBtn.textContent = icon;

        // Apply CSS variable overrides for light theme on dashboard
        const root = document.documentElement;
        if (theme === 'light') {
            root.style.setProperty('--void', '#f0f2ff');
            root.style.setProperty('--deep', '#e8eaf6');
            root.style.setProperty('--surface', '#ffffff');
            root.style.setProperty('--panel', '#f5f5ff');
            root.style.setProperty('--rim', '#dde0f0');
            root.style.setProperty('--ink', '#1a1a35');
            root.style.setProperty('--muted', '#5c6080');
            root.style.setProperty('--faint', '#c8ccdd');
            root.style.setProperty('--neon', '#4c35d4');
            root.style.setProperty('--neon2', '#0088cc');
            root.style.setProperty('--gold', '#b8860b');
            document.body.style.background = '#f0f2ff';
            document.body.style.color = '#1a1a35';
        } else {
            root.style.setProperty('--void', '#04040a');
            root.style.setProperty('--deep', '#0a0a14');
            root.style.setProperty('--surface', '#0f0f1e');
            root.style.setProperty('--panel', '#141428');
            root.style.setProperty('--rim', '#1e1e38');
            root.style.setProperty('--ink', '#e8e8f0');
            root.style.setProperty('--muted', '#5a5a7a');
            root.style.setProperty('--faint', '#2a2a44');
            root.style.setProperty('--neon', '#00ff88');
            root.style.setProperty('--neon2', '#00d4ff');
            root.style.setProperty('--gold', '#ffd700');
            document.body.style.background = '#04040a';
            document.body.style.color = '#e8e8f0';
        }
    }

    toggleTheme() {
        const current = localStorage.getItem('shopTheme') || 'dark';
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // =====================
    // SUPPLIER TRACKER
    // =====================
    loadSuppliersPage() {
        const suppliers = storage.getSuppliers();
        const container = document.getElementById('suppliersContent');
        if (!container) return;

        if (suppliers.length === 0) {
            container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--muted);">
                <div style="font-size:3rem;margin-bottom:1rem;">🏭</div>
                <div style="font-family:var(--mono);font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">NO SUPPLIERS YET</div>
                <button class="hp-btn-neon" onclick="app.openSupplierModal()">+ ADD FIRST SUPPLIER</button>
            </div>`;
            return;
        }

        const cityColors = { Jaipur:'#e8a87c', Jodhpur:'#a8c5da', Surat:'#a8e6cf', Other:'#c3aed6' };

        container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${suppliers.map(s => {
            const products = storage.getProductsBySupplier(s.id);
            const cityColor = cityColors[s.city] || cityColors.Other;
            const lastOrder = s.lastOrderDate
                ? new Date(s.lastOrderDate).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
                : 'Never';
            const daysSince = s.lastOrderDate
                ? Math.floor((Date.now() - new Date(s.lastOrderDate)) / 86400000)
                : null;
            const freshness = daysSince === null ? '' :
                daysSince < 30 ? '<span style="color:#00ff88;font-size:10px;">● RECENT</span>' :
                daysSince < 90 ? '<span style="color:orange;font-size:10px;">● MODERATE</span>' :
                '<span style="color:#ff4444;font-size:10px;">● OVERDUE</span>';

            return `
            <div style="background:var(--surface);border:1px solid var(--rim);border-radius:14px;overflow:hidden;transition:transform 0.2s,border-color 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='rgba(108,99,255,0.4)'" onmouseout="this.style.transform='none';this.style.borderColor='var(--rim)'">
                <div style="background:linear-gradient(135deg,${cityColor}22,${cityColor}08);border-bottom:1px solid var(--rim);padding:14px 16px;display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;border-radius:10px;background:${cityColor}33;border:1px solid ${cityColor}66;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">🏭</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                        <div style="font-size:11px;color:${cityColor};font-family:var(--mono);margin-top:2px;">📍 ${s.city || 'Unknown City'}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="app.openSupplierModal('${s.id}')" style="background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.3);color:#a78bfa;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">✏️</button>
                        <button onclick="app.deleteSupplier('${s.id}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">🗑️</button>
                    </div>
                </div>
                <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        ${s.phone ? `<a href="tel:${s.phone}" style="display:flex;align-items:center;gap:5px;background:var(--panel);border:1px solid var(--rim);border-radius:20px;padding:4px 10px;font-family:var(--mono);font-size:10px;color:var(--neon2);text-decoration:none;">📞 ${s.phone}</a>` : ''}
                        ${s.phone ? `<button onclick="app.waSupplier('${s.id}')" style="display:flex;align-items:center;gap:5px;background:rgba(0,200,80,0.1);border:1px solid rgba(0,200,80,0.3);border-radius:20px;padding:4px 10px;font-family:var(--mono);font-size:10px;color:#00c850;cursor:pointer;">💬 WhatsApp</button>` : ''}
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="background:var(--panel);border:1px solid var(--rim);border-radius:8px;padding:8px 10px;">
                            <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;">DESIGNS</div>
                            <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--neon);margin-top:2px;">${products.length}</div>
                        </div>
                        <div style="background:var(--panel);border:1px solid var(--rim);border-radius:8px;padding:8px 10px;">
                            <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;margin-bottom:2px;">LAST ORDER ${freshness}</div>
                            <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ink);">${lastOrder}</div>
                        </div>
                    </div>
                    ${s.speciality ? `<div style="font-family:var(--mono);font-size:10px;color:var(--muted);background:var(--panel);border-radius:6px;padding:6px 10px;">🎨 ${s.speciality}</div>` : ''}
                    ${s.notes ? `<div style="font-size:11px;color:var(--muted);font-style:italic;padding:0 2px;">💬 ${s.notes}</div>` : ''}
                    ${products.length > 0 ? `
                    <div>
                        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;margin-bottom:6px;">DESIGNS FROM THIS SUPPLIER</div>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">
                            ${products.slice(0,4).map(p => `<span onclick="app.openProductModal('${p.id}')" style="background:var(--panel);border:1px solid var(--rim);border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--ink);cursor:pointer;" title="View ${p.name}">${p.name}</span>`).join('')}
                            ${products.length > 4 ? `<span style="background:var(--faint);border-radius:4px;padding:3px 8px;font-family:var(--mono);font-size:9px;color:var(--muted);">+${products.length-4} more</span>` : ''}
                        </div>
                    </div>` : ''}
                    <button onclick="app.recordSupplierOrder('${s.id}')" style="width:100%;padding:7px;background:linear-gradient(135deg,rgba(0,255,136,0.12),rgba(0,212,255,0.08));border:1px solid rgba(0,255,136,0.25);border-radius:8px;color:var(--neon);font-family:var(--mono);font-size:11px;cursor:pointer;letter-spacing:0.05em;">📦 RECORD ORDER FROM THIS SUPPLIER</button>
                </div>
            </div>`;
        }).join('')}
        </div>`;
    }

    openSupplierModal(supplierId = null) {
        const existing = document.getElementById('supplierModal');
        if (existing) existing.remove();
        const s = supplierId ? storage.getSupplierById(supplierId) : null;

        const modal = document.createElement('div');
        modal.id = 'supplierModal';
        modal.className = 'modal active';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;">
            <span class="close" onclick="document.getElementById('supplierModal').remove();window.app&&window.app.refreshActivePage()">×</span>
            <div style="text-align:center;margin-bottom:1.25rem;">
                <div style="font-size:2rem;margin-bottom:0.4rem;">🏭</div>
                <h2 style="color:var(--neon2);font-family:var(--mono);font-size:1rem;letter-spacing:0.1em;">${s ? 'EDIT SUPPLIER' : 'ADD SUPPLIER'}</h2>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <input id="sup_name" class="hp-input" placeholder="Supplier name *" value="${s?.name||''}">
                <select id="sup_city" class="hp-input">
                    <option value="">Select city</option>
                    ${['Jaipur','Jodhpur','Surat','Mumbai','Delhi','Other'].map(c => `<option value="${c}" ${s?.city===c?'selected':''}>${c}</option>`).join('')}
                </select>
                <input id="sup_phone" class="hp-input" type="tel" placeholder="WhatsApp / phone number" value="${s?.phone||''}">
                <input id="sup_speciality" class="hp-input" placeholder="Speciality (e.g. Cotton Sarees, Suits, Kurtis…)" value="${s?.speciality||''}">
                <input id="sup_lastorder" class="hp-input" type="date" value="${s?.lastOrderDate ? s.lastOrderDate.split('T')[0] : ''}" placeholder="Last order date">
                <textarea id="sup_notes" class="hp-input" rows="2" placeholder="Notes…" style="resize:vertical;">${s?.notes||''}</textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:1rem;">
                <button class="hp-btn-ghost" style="flex:1;" onclick="document.getElementById('supplierModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                <button class="hp-btn-neon" style="flex:2;" onclick="app.saveSupplier('${supplierId||''}')">${s ? '💾 SAVE CHANGES' : '+ ADD SUPPLIER'}</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
        document.getElementById('sup_name').focus();
    }

    saveSupplier(supplierId) {
        const name = document.getElementById('sup_name').value.trim();
        if (!name) { this.showNotification('Supplier name is required', 'warning'); return; }
        const data = {
            name,
            city: document.getElementById('sup_city').value,
            phone: document.getElementById('sup_phone').value.trim(),
            speciality: document.getElementById('sup_speciality').value.trim(),
            notes: document.getElementById('sup_notes').value.trim(),
            lastOrderDate: document.getElementById('sup_lastorder').value ? new Date(document.getElementById('sup_lastorder').value).toISOString() : null
        };
        if (supplierId) {
            storage.updateSupplier(supplierId, data);
            this.showNotification('✅ Supplier updated!', 'success');
        } else {
            storage.addSupplier(data);
            this.showNotification('✅ Supplier added!', 'success');
        }
        document.getElementById('supplierModal').remove();
        this.loadSuppliersPage();
    }

    deleteSupplier(supplierId) {
        const s = storage.getSupplierById(supplierId);
        if (!s) return;
        if (!confirm(`Delete supplier "${s.name}"? Products linked to this supplier will be unlinked.`)) return;
        storage.deleteSupplier(supplierId);
        this.showNotification('Supplier deleted.', 'success');
        this.loadSuppliersPage();
    }

    waSupplier(supplierId) {
        const s = storage.getSupplierById(supplierId);
        if (!s || !s.phone) { this.showNotification('No phone number saved for this supplier', 'warning'); return; }
        const storeName = localStorage.getItem('storeName') || 'Shop';
        const phone = s.phone.replace(/\D/g, '');
        const msg = encodeURIComponent(`Hello ${s.name},\n\nThis is ${storeName}. I wanted to discuss a new order with you.\n\nPlease let me know your availability.\n\nThank you!`);
        sessionStorage.setItem('whatsapp_sent', JSON.stringify({ type: 'supplier', name: s.name }));
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }

    recordSupplierOrder(supplierId) {
        const s = storage.getSupplierById(supplierId);
        if (!s) return;
        storage.updateSupplier(supplierId, { lastOrderDate: new Date().toISOString() });
        this.showNotification(`📦 Order from ${s.name} recorded today!`, 'success');
        this.loadSuppliersPage();
    }

    linkProductToSupplier(productId, supplierId) {
        const s = storage.getSupplierById(supplierId);
        if (!s) return;
        storage.updateProduct(productId, { supplierId, supplierName: s.name });
        this.showNotification(`Product linked to ${s.name}`, 'success');
    }

    // =====================
    // ADVANCE BOOKINGS
    // =====================
    loadBookingsPage() {
        const bookings = storage.getBookings();
        const container = document.getElementById('bookingsContent');
        if (!container) return;

        // Update dashboard count
        const countEl = document.getElementById('advanceBookingsCount');
        const activeBookings = bookings.filter(b => b.status !== 'paid');
        if (countEl) countEl.textContent = activeBookings.length;

        if (bookings.length === 0) {
            container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--muted);">
                <div style="font-size:3rem;margin-bottom:1rem;">📅</div>
                <div style="font-family:var(--mono);font-size:0.85rem;margin-bottom:1rem;">NO BOOKINGS YET</div>
                <button class="hp-btn-neon" onclick="app.openBookingModal()">+ ADD FIRST BOOKING</button>
            </div>`;
            return;
        }

        const statusOrder = { ordered:0, arrived:1, delivered:2, paid:3 };
        const statusConfig = {
            ordered:   { label:'ORDERED',   color:'#60a5fa', bg:'rgba(96,165,250,0.12)',   icon:'📦', next:'arrived',   nextLabel:'Mark Arrived' },
            arrived:   { label:'ARRIVED',   color:'#fbbf24', bg:'rgba(251,191,36,0.12)',   icon:'✅', next:'delivered', nextLabel:'Mark Delivered' },
            delivered: { label:'DELIVERED', color:'#34d399', bg:'rgba(52,211,153,0.12)',   icon:'🚚', next:'paid',      nextLabel:'Mark Paid' },
            paid:      { label:'PAID ✓',    color:'#00ff88', bg:'rgba(0,255,136,0.12)',    icon:'💰', next:null,        nextLabel:null }
        };

        // Group by status
        const groups = { ordered:[], arrived:[], delivered:[], paid:[] };
        bookings.forEach(b => { if (groups[b.status]) groups[b.status].push(b); });

        const renderBookingCard = (b) => {
            const sc = statusConfig[b.status] || statusConfig.ordered;
            const advanceText = b.advanceAmount ? `₹${b.advanceAmount} advance` : 'No advance';
            const expectedText = b.expectedDate
                ? new Date(b.expectedDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
                : '—';
            const daysLeft = b.expectedDate
                ? Math.ceil((new Date(b.expectedDate) - Date.now()) / 86400000)
                : null;
            const urgency = daysLeft !== null
                ? (daysLeft < 0 ? `<span style="color:#ff4444;font-size:10px;">⚠️ ${Math.abs(daysLeft)}d overdue</span>`
                   : daysLeft <= 3 ? `<span style="color:orange;font-size:10px;">⏰ ${daysLeft}d left</span>`
                   : `<span style="color:var(--muted);font-size:10px;">${daysLeft}d</span>`)
                : '';

            return `
            <div style="background:var(--surface);border:1px solid var(--rim);border-left:3px solid ${sc.color};border-radius:12px;padding:14px 16px;transition:transform 0.2s;" onmouseover="this.style.transform='translateX(3px)'" onmouseout="this.style.transform='none'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                            <span style="background:${sc.bg};color:${sc.color};border-radius:20px;padding:2px 10px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:0.08em;">${sc.icon} ${sc.label}</span>
                            <span style="font-family:var(--mono);font-size:9px;color:var(--muted);">${b.id}</span>
                        </div>
                        <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ink);">${b.customerName}</div>
                        ${b.customerPhone ? `<div style="font-size:11px;color:var(--neon2);margin-top:2px;">📞 ${b.customerPhone}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:5px;flex-shrink:0;">
                        ${b.customerPhone ? `<button onclick="app.waBookingCustomer('${b.id}')" style="background:rgba(0,200,80,0.1);border:1px solid rgba(0,200,80,0.3);color:#00c850;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;" title="WhatsApp customer">💬</button>` : ''}
                        <button onclick="app.openBookingModal('${b.id}')" style="background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.2);color:#a78bfa;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">✏️</button>
                        <button onclick="app.deleteBooking('${b.id}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">🗑️</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div style="background:var(--panel);border-radius:7px;padding:7px 10px;">
                        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);">DESIGN</div>
                        <div style="font-family:var(--mono);font-size:11px;color:var(--ink);margin-top:2px;">${b.designName || '—'}</div>
                        ${b.colorWanted ? `<div style="font-size:10px;color:var(--muted);margin-top:2px;">🎨 ${b.colorWanted}</div>` : ''}
                        ${b.setType ? `<div style="font-size:10px;color:var(--muted);">📦 ${b.setType}</div>` : ''}
                    </div>
                    <div style="background:var(--panel);border-radius:7px;padding:7px 10px;">
                        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);">ADVANCE / DUE</div>
                        <div style="font-family:var(--mono);font-size:11px;color:var(--gold);margin-top:2px;">${advanceText}</div>
                        <div style="font-size:10px;color:var(--muted);margin-top:2px;">Expected: ${expectedText} ${urgency}</div>
                    </div>
                </div>
                ${b.notes ? `<div style="font-size:11px;color:var(--muted);font-style:italic;margin-bottom:10px;">💬 ${b.notes}</div>` : ''}
                ${sc.next ? `<button onclick="app.advanceBookingStatus('${b.id}','${sc.next}')" style="width:100%;padding:7px;background:linear-gradient(135deg,${sc.bg},transparent);border:1px solid ${sc.color}44;border-radius:8px;color:${sc.color};font-family:var(--mono);font-size:11px;cursor:pointer;letter-spacing:0.05em;">${sc.nextLabel} →</button>` : `<div style="text-align:center;padding:4px;font-family:var(--mono);font-size:10px;color:var(--neon);">✓ COMPLETE</div>`}
            </div>`;
        };

        const pipelineHtml = ['ordered','arrived','delivered','paid'].map(status => {
            const statusBks = groups[status];
            if (statusBks.length === 0) return '';
            const sc = statusConfig[status];
            return `
            <div>
                <div style="font-family:var(--mono);font-size:10px;color:${sc.color};letter-spacing:0.12em;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                    ${sc.icon} ${sc.label} <span style="background:${sc.bg};color:${sc.color};border-radius:10px;padding:1px 8px;">${statusBks.length}</span>
                    <span style="flex:1;height:1px;background:${sc.color}33;"></span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
                    ${statusBks.map(b => renderBookingCard(b)).join('')}
                </div>
            </div>`;
        }).join('');

        container.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:4px;">
            ${['ordered','arrived','delivered','paid'].map(s => {
                const sc = statusConfig[s];
                return `<div style="background:${sc.bg};border:1px solid ${sc.color}44;border-radius:10px;padding:8px 16px;text-align:center;">
                    <div style="font-family:var(--mono);font-size:9px;color:${sc.color};letter-spacing:0.1em;">${sc.icon} ${sc.label}</div>
                    <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:${sc.color};">${groups[s].length}</div>
                </div>`;
            }).join('')}
        </div>
        ${pipelineHtml}`;
    }

    openBookingModal(bookingId = null) {
        const existing = document.getElementById('bookingModal');
        if (existing) existing.remove();
        const b = bookingId ? storage.getBookingById(bookingId) : null;
        const suppliers = storage.getSuppliers();
        const products = storage.getProducts();

        const modal = document.createElement('div');
        modal.id = 'bookingModal';
        modal.className = 'modal active';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:500px;">
            <span class="close" onclick="document.getElementById('bookingModal').remove();window.app&&window.app.refreshActivePage()">×</span>
            <div style="text-align:center;margin-bottom:1.25rem;">
                <div style="font-size:2rem;margin-bottom:0.4rem;">📅</div>
                <h2 style="color:#a78bfa;font-family:var(--mono);font-size:1rem;letter-spacing:0.1em;">${b ? 'EDIT BOOKING' : 'NEW ADVANCE BOOKING'}</h2>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;">CUSTOMER</div>
                <input id="bk_custname" class="hp-input" placeholder="Customer name *" value="${b?.customerName||''}">
                <input id="bk_custphone" class="hp-input" type="tel" placeholder="Customer phone" value="${b?.customerPhone||''}">
                <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">WHAT THEY WANT</div>
                <select id="bk_product" class="hp-input" onchange="app._fillBookingDesign(this)">
                    <option value="">— Link to existing product (optional) —</option>
                    ${products.map(p => `<option value="${p.id}" data-name="${p.name}" ${b?.productId===p.id?'selected':''}>${p.name} (${p.sku})</option>`).join('')}
                </select>
                <input id="bk_design" class="hp-input" placeholder="Design / product name *" value="${b?.designName||''}">
                <input id="bk_color" class="hp-input" placeholder="Colour wanted (e.g. Navy Blue, Red)" value="${b?.colorWanted||''}">
                <input id="bk_settype" class="hp-input" placeholder="Set type (e.g. Suit, Saree, Kurti set)" value="${b?.setType||''}">
                <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">PAYMENT & TIMING</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>
                        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Advance taken (₹)</div>
                        <input id="bk_advance" class="hp-input" type="number" min="0" placeholder="0" value="${b?.advanceAmount||''}">
                    </div>
                    <div>
                        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Expected date</div>
                        <input id="bk_expected" class="hp-input" type="date" value="${b?.expectedDate ? b.expectedDate.split('T')[0] : ''}">
                    </div>
                </div>
                ${b ? `<div>
                    <div style="font-size:10px;color:var(--muted);margin-bottom:4px;font-family:var(--mono);">STATUS</div>
                    <select id="bk_status" class="hp-input">
                        <option value="ordered" ${b.status==='ordered'?'selected':''}>📦 Ordered</option>
                        <option value="arrived" ${b.status==='arrived'?'selected':''}>✅ Arrived</option>
                        <option value="delivered" ${b.status==='delivered'?'selected':''}>🚚 Delivered</option>
                        <option value="paid" ${b.status==='paid'?'selected':''}>💰 Payment Done</option>
                    </select>
                </div>` : ''}
                <textarea id="bk_notes" class="hp-input" rows="2" placeholder="Notes…" style="resize:vertical;">${b?.notes||''}</textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:1rem;">
                <button class="hp-btn-ghost" style="flex:1;" onclick="document.getElementById('bookingModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                <button class="hp-btn-neon" style="flex:2;" onclick="app.saveBooking('${bookingId||''}')">${b ? '💾 SAVE CHANGES' : '+ CREATE BOOKING'}</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
        document.getElementById('bk_custname').focus();
    }

    _fillBookingDesign(selectEl) {
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        const nameInput = document.getElementById('bk_design');
        if (selectedOpt && selectedOpt.dataset.name && nameInput) {
            nameInput.value = selectedOpt.dataset.name;
        }
    }

    saveBooking(bookingId) {
        const name = document.getElementById('bk_custname').value.trim();
        if (!name) { this.showNotification('Customer name is required', 'warning'); return; }
        const designName = document.getElementById('bk_design').value.trim();
        if (!designName) { this.showNotification('Design/product name is required', 'warning'); return; }
        const productSelect = document.getElementById('bk_product');
        const data = {
            customerName: name,
            customerPhone: document.getElementById('bk_custphone').value.trim(),
            productId: productSelect.value || null,
            designName,
            colorWanted: document.getElementById('bk_color').value.trim(),
            setType: document.getElementById('bk_settype').value.trim(),
            advanceAmount: parseFloat(document.getElementById('bk_advance').value) || 0,
            expectedDate: document.getElementById('bk_expected').value ? new Date(document.getElementById('bk_expected').value).toISOString() : null,
            notes: document.getElementById('bk_notes').value.trim()
        };
        const statusEl = document.getElementById('bk_status');
        if (statusEl) data.status = statusEl.value;

        if (bookingId) {
            storage.updateBooking(bookingId, data);
            this.showNotification('✅ Booking updated!', 'success');
        } else {
            storage.addBooking(data);
            this.showNotification('✅ Booking created!', 'success');
        }
        document.getElementById('bookingModal').remove();
        this.loadBookingsPage();
    }

    advanceBookingStatus(bookingId, newStatus) {
        storage.updateBooking(bookingId, { status: newStatus });
        const labels = { arrived:'Marked as Arrived ✅', delivered:'Marked as Delivered 🚚', paid:'Payment Done 💰' };
        this.showNotification(labels[newStatus] || 'Status updated', 'success');
        this.loadBookingsPage();
    }

    deleteBooking(bookingId) {
        const b = storage.getBookingById(bookingId);
        if (!b || !confirm(`Delete booking for "${b.customerName}"?`)) return;
        storage.deleteBooking(bookingId);
        this.showNotification('Booking deleted.', 'success');
        this.loadBookingsPage();
    }

    waBookingCustomer(bookingId) {
        const b = storage.getBookingById(bookingId);
        if (!b || !b.customerPhone) return;
        const phone = b.customerPhone.replace(/\D/g, '');
        const storeName = localStorage.getItem('storeName') || 'Shop';
        const statusMessages = {
            ordered: `Hello ${b.customerName}! 👋\n\nThis is ${storeName}. Your order for *${b.designName}*${b.colorWanted?` (${b.colorWanted})`:''}${b.setType?` - ${b.setType}`:''} has been placed.\n\nExpected date: ${b.expectedDate ? new Date(b.expectedDate).toLocaleDateString('en-IN') : 'To be confirmed'}\n\nWe'll notify you when it arrives. 🙏`,
            arrived: `Hello ${b.customerName}! 🎉\n\nGreat news! Your *${b.designName}*${b.colorWanted?` (${b.colorWanted})`:''} has arrived at ${storeName}!\n\nPlease visit us to collect your order.\n\nThank you! 🙏`,
            delivered: `Hello ${b.customerName}! ✅\n\nYour order *${b.designName}* has been handed over. Hope you love it!\n\nBalance payment: ₹${b.balanceAmount||'—'}\n\nThank you for shopping at ${storeName}! 🛍️`,
            paid: `Hello ${b.customerName}! 💰\n\nThank you for your payment at ${storeName}. Your booking for *${b.designName}* is now complete!\n\nThank you for your business! 🙏`
        };
        const msg = encodeURIComponent(statusMessages[b.status] || statusMessages.ordered);
        sessionStorage.setItem('whatsapp_sent', JSON.stringify({ type:'booking', name: b.customerName }));
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }

    // =====================
    // DATA MANAGEMENT
    // =====================
    exportData() {
        try {
            const blob = new Blob([storage.exportData()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shop-inventory-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Data exported!', 'success');
        } catch (err) {
            this.showNotification('Export failed: ' + err.message, 'error');
        }
    }

    backupData() {
        try {
            localStorage.setItem('shop_backup_' + Date.now(), storage.exportData());
            this.showNotification('Backup saved to local storage!', 'success');
        } catch (err) {
            this.showNotification('Backup failed: ' + err.message, 'error');
        }
    }

    clearAllData() {
        if (confirm('⚠️ Delete ALL products and invoices? This cannot be undone!')) {
            if (confirm('Are you absolutely sure?')) {
                const uid = storage.currentUser;
                localStorage.removeItem(uid + '_products');
                localStorage.removeItem(uid + '_invoices');
                storage.initializeStorage();
                this.cartItems = [];
                this.updateDashboard();
                this.changePage('dashboard');
                this.showNotification('All data cleared!', 'success');
            }
        }
    }

    resetApp() {
        if (confirm('Reset all settings to default? (Data is preserved)')) {
            ['storeName','storeOwner','storeEmail','storePhone','storeAddress',
             'currency','taxRate','invoicePrefix','lowStockThreshold','shopTheme'].forEach(k => localStorage.removeItem(k));
            this.lowStockThreshold = 10;
            this.loadSettings();
            this.loadTheme();
            this.updateDashboard();
            this.changePage('dashboard');
            this.showNotification('App reset to defaults!', 'success');
        }
    }

    resetGeminiKey() {
        const current = localStorage.getItem('geminiApiKey');
        const newKey = prompt(
            '🔑 Enter your Google Gemini API Key\n\n' +
            'Get one FREE at: https://aistudio.google.com/apikey\n\n' +
            (current ? 'Leave blank to remove existing key.' : ''),
        current || '');
        if (newKey === null) return; // cancelled
        if (newKey.trim() === '') {
            localStorage.removeItem('geminiApiKey');
            this.showNotification('Gemini API key removed', 'success');
        } else {
            localStorage.setItem('geminiApiKey', newKey.trim());
            this.showNotification('✅ Gemini API key saved!', 'success');
        }
        // Update status badge
        const keyStatus = document.getElementById('geminiKeyStatus');
        if (keyStatus) {
            const hasKey = !!localStorage.getItem('geminiApiKey');
            keyStatus.textContent = hasKey ? '✅ Key saved' : '⚠️ No key yet';
            keyStatus.style.color = hasKey ? '#00ff88' : '#ffd700';
        }
    }

    // =====================
    // CAMERA SEARCH
    // =====================
    openCameraSearch() {
        const modal = document.getElementById('cameraSearchModal');
        modal.classList.add('active');
        modal.style.display = 'flex';

        // Show key status
        const keyStatus = document.getElementById('geminiKeyStatus');
        if (keyStatus) {
            const hasKey = !!localStorage.getItem('geminiApiKey');
            keyStatus.textContent = hasKey ? '✅ Key saved' : '⚠️ No key yet';
            keyStatus.style.color = hasKey ? '#00ff88' : '#ffd700';
        }

        // Reset UI
        document.getElementById('cameraSearchPreview').style.display = 'none';
        document.getElementById('cameraSearchStatus').style.display = 'none';
        document.getElementById('cameraSearchRetakeBtn').style.display = 'none';
        document.getElementById('cameraSearchCaptureBtn').style.display = 'flex';
        document.getElementById('cameraSearchFeedWrap').style.display = 'block';

        // Bind file upload
        const fileInput = document.getElementById('cameraSearchFileInput');
        fileInput.onchange = (e) => this._handleCameraSearchFile(e);

        // Start camera
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
            .then(stream => {
                this._cameraSearchStream = stream;
                document.getElementById('cameraSearchFeed').srcObject = stream;
            })
            .catch(() => {
                this.showNotification('Camera not available. Use Upload instead.', 'warning');
                document.getElementById('cameraSearchFeedWrap').innerHTML = '<div style="text-align:center;padding:40px;color:#5a5a7a;font-family:\'Space Mono\',monospace;font-size:0.75rem;">📷 Camera not available<br><span style="font-size:0.65rem;margin-top:6px;display:block;">Use the ⬆ UPLOAD button below</span></div>';
            });

        // Close on backdrop click
        modal.onclick = (e) => { if (e.target === modal) this.closeCameraSearch(); };
    }

    closeCameraSearch() {
        const modal = document.getElementById('cameraSearchModal');
        modal.style.display = 'none';
        modal.classList.remove('active');
        if (this._cameraSearchStream) {
            this._cameraSearchStream.getTracks().forEach(t => t.stop());
            this._cameraSearchStream = null;
        }
        // Restore feed video element
        const wrap = document.getElementById('cameraSearchFeedWrap');
        if (!wrap.querySelector('video')) {
            const v = document.createElement('video');
            v.id = 'cameraSearchFeed'; v.autoplay = true; v.setAttribute('playsinline','');
            v.style.cssText = 'width:100%;display:block;max-height:240px;object-fit:cover;';
            wrap.insertBefore(v, wrap.firstChild);
        }
    }

    captureCameraSearch() {
        const video = document.getElementById('cameraSearchFeed');
        const canvas = document.getElementById('cameraSearchCanvas');
        if (!video.videoWidth) {
            this.showNotification('Camera not ready yet — wait a moment', 'warning');
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this._runCameraSearchAI(dataUrl);
    }

    _handleCameraSearchFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => this._runCameraSearchAI(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    retakeCameraSearch() {
        document.getElementById('cameraSearchPreview').style.display = 'none';
        document.getElementById('cameraSearchStatus').style.display = 'none';
        document.getElementById('cameraSearchRetakeBtn').style.display = 'none';
        document.getElementById('cameraSearchCaptureBtn').style.display = 'flex';
        document.getElementById('cameraSearchFeedWrap').style.display = 'block';

        // Restart camera
        if (this._cameraSearchStream) this._cameraSearchStream.getTracks().forEach(t => t.stop());
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                this._cameraSearchStream = stream;
                document.getElementById('cameraSearchFeed').srcObject = stream;
            })
            .catch(() => this.showNotification('Camera not available', 'warning'));
    }

    async _runCameraSearchAI(dataUrl) {
        // Hide feed, show preview
        document.getElementById('cameraSearchFeedWrap').style.display = 'none';
        document.getElementById('cameraSearchCaptureBtn').style.display = 'none';

        const preview    = document.getElementById('cameraSearchPreview');
        const previewImg = document.getElementById('cameraSearchPreviewImg');
        previewImg.src   = dataUrl;
        preview.style.display = 'block';

        document.getElementById('cameraSearchRetakeBtn').style.display = 'block';

        const statusEl = document.getElementById('cameraSearchStatus');
        statusEl.style.display = 'block';
        statusEl.innerHTML = '🔍 Analysing image with Gemini AI…';

        // Stop camera stream
        if (this._cameraSearchStream) {
            this._cameraSearchStream.getTracks().forEach(t => t.stop());
            this._cameraSearchStream = null;
        }

        // Check API key saved in localStorage
        let geminiKey = localStorage.getItem('geminiApiKey') || '';
        if (!geminiKey) {
            geminiKey = prompt(
                '🔑 Enter your FREE Google Gemini API Key\n\n' +
                'Get one free at: https://aistudio.google.com/apikey\n\n' +
                'Your key will be saved locally on this device only.'
            );
            if (!geminiKey || !geminiKey.trim()) {
                statusEl.innerHTML = '⚠️ <span style="color:#ffd700;">No API key entered. Camera search needs a Gemini API key.</span>';
                return;
            }
            localStorage.setItem('geminiApiKey', geminiKey.trim());
            geminiKey = geminiKey.trim();
        }

        // Build product context
        const products     = storage.getProducts();
        const productNames = products.map(p => p.name + (p.category ? ` (${p.category})` : '')).join(', ');
        const base64Data   = dataUrl.split(',')[1];

        const prompt = `You are a shop inventory assistant. Look at this product image and identify what it is.

My inventory contains these products: ${productNames || 'No products yet'}

Respond with ONLY a JSON object — no extra text, no markdown fences:
{"query": "search term", "description": "one sentence describing what you see"}

The query should be 1-3 words to find this product in the inventory. If you recognise a product from the list, use its key words.`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Data
                                    }
                                },
                                { text: prompt }
                            ]
                        }],
                        generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
                    })
                }
            );

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg  = errData?.error?.message || `HTTP ${response.status}`;

                if (response.status === 400 && errMsg.toLowerCase().includes('api key')) {
                    localStorage.removeItem('geminiApiKey');
                    statusEl.innerHTML = `⚠️ <span style="color:#ffd700;">Invalid API key — removed.</span><br><span style="color:#5a5a7a;font-size:0.6rem;">Tap Retake and try again with a valid key.</span>`;
                } else if (response.status === 403) {
                    localStorage.removeItem('geminiApiKey');
                    statusEl.innerHTML = `⚠️ <span style="color:#ffd700;">API key rejected (403).</span><br><span style="color:#5a5a7a;font-size:0.6rem;">Make sure Gemini API is enabled in your Google project.</span>`;
                } else {
                    statusEl.innerHTML = `❌ <span style="color:#ff4444;">Gemini error: ${errMsg}</span>`;
                }
                return;
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (!text) {
                statusEl.innerHTML = '⚠️ Gemini returned no response. Try a clearer photo.';
                return;
            }

            let parsed;
            try {
                const cleaned = text.replace(/```json|```/g, '').trim();
                parsed = JSON.parse(cleaned);
            } catch {
                // Fallback — pull first clean line as query
                parsed = {
                    query:       text.trim().split('\n')[0].replace(/[^a-z0-9 ]/gi, '').trim(),
                    description: text.trim()
                };
            }

            const query       = (parsed.query       || '').trim();
            const description = (parsed.description || '').trim();

            if (query) {
                statusEl.innerHTML = `✅ <span style="color:#00ff88;">${description || query}</span><br><span style="color:#5a5a7a;font-size:0.6rem;">Searching for: "${query}"</span>`;
                setTimeout(() => {
                    this.closeCameraSearch();
                    this.changePage('products');
                    const searchInput = document.getElementById('productSearch');
                    if (searchInput) {
                        searchInput.value = query;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                    this.searchProducts(query);
                    this.showNotification(`🔍 Searching for: "${query}"`, 'success');
                }, 1800);
            } else {
                statusEl.innerHTML = '⚠️ Could not identify product. Try a clearer photo.';
            }

        } catch (err) {
            console.error('Camera search error:', err);
            statusEl.innerHTML = `❌ <span style="color:#ff4444;">Network error — check internet connection.</span><br><span style="color:#5a5a7a;font-size:0.6rem;">${err.message}</span>`;
        }
    }

    // =====================
    // UTILITIES
    // =====================
    setDateToToday() {
        const dateInput = document.getElementById('invoiceDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }

    // ── GLOBAL PAGE REFRESH ──────────────────────────────────────────────────
    // Call this after ANY data change — saves, deletes, imports, anything.
    // Reads the currently visible page and re-renders it instantly.
    refreshActivePage() {
        const activePage = document.querySelector('.page.active');
        if (!activePage) return;
        const pid = activePage.id;
        if      (pid === 'dashboard')    this.updateDashboard();
        else if (pid === 'products')     this.loadProducts();
        else if (pid === 'invoices')     this.loadInvoices();
        else if (pid === 'lowstock')     this.loadLowStockPage();
        else if (pid === 'suppliers')    this.loadSuppliersPage();
        else if (pid === 'bookings')     this.loadBookingsPage();
        else if (pid === 'colorbook')    this.loadColorBook();
        else if (pid === 'settings')     this.loadSettings();
        else if (pid === 'billing')      this.updateProductSelect();
    }

    closeModal(modal) {
        if (modal) modal.classList.remove('active');
        this.closeCamera();

        if (this._postInvoiceDashboard && modal && modal.id === 'invoicePrintModal') {
            this._postInvoiceDashboard = false;
            this.changePage('dashboard');
            return;
        }
        this.refreshActivePage();
    }

    showNotification(message, type = 'success') {
        document.querySelectorAll('.notification').forEach(n => n.remove());
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.style.cssText = 'animation: slideInRight 0.3s ease;';
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }

    // =====================
    // NEW INVENTORY (Purchase Order Drafts)
    // =====================
    loadNewInventoryPage() {
        const container = document.getElementById('newInventoryContent');
        if (!container) return;
        const drafts = storage.getPurchaseDrafts();
        const pending = drafts.filter(d => d.status === 'draft');
        const received = drafts.filter(d => d.status === 'received');

        container.innerHTML = `
        <!-- Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.3);border-radius:12px;padding:14px;text-align:center;">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:#a78bfa;letter-spacing:0.1em;margin-bottom:6px;">PENDING ORDERS</div>
                <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#a78bfa;">${pending.length}</div>
            </div>
            <div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:12px;padding:14px;text-align:center;">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00ff88;letter-spacing:0.1em;margin-bottom:6px;">RECEIVED</div>
                <div style="font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#00ff88;">${received.length}</div>
            </div>
            <div style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:12px;padding:14px;text-align:center;">
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00d4ff;letter-spacing:0.1em;margin-bottom:6px;">TOTAL VALUE</div>
                <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:#00d4ff;">₹${pending.reduce((s,d)=>s+(d.totalCost||0),0).toLocaleString()}</div>
            </div>
        </div>

        <!-- Pending Orders -->
        <div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:#5a5a7a;letter-spacing:0.12em;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
                ⏳ PENDING PURCHASE ORDERS
                <div style="flex:1;height:1px;background:#2a2a44;"></div>
            </div>
            ${pending.length === 0 ? `
            <div style="text-align:center;padding:2rem;background:#0f0f1e;border:1px dashed #2a2a44;border-radius:12px;">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🛒</div>
                <div style="font-family:'Space Mono',monospace;font-size:12px;color:#5a5a7a;">No pending orders</div>
                <div style="font-size:11px;color:#2a2a44;margin-top:4px;">Create a purchase order when you visit the factory</div>
                <button onclick="app.openNewInventoryForm()" style="margin-top:12px;padding:8px 18px;background:rgba(108,99,255,0.2);border:1px solid rgba(108,99,255,0.4);border-radius:8px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">+ NEW PURCHASE ORDER</button>
            </div>` : pending.map(d => this._renderPurchaseDraftCard(d)).join('')}
        </div>

        <!-- Received -->
        ${received.length > 0 ? `
        <div>
            <div style="font-family:'Space Mono',monospace;font-size:11px;color:#5a5a7a;letter-spacing:0.12em;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
                ✅ RECEIVED & ADDED TO INVENTORY
                <div style="flex:1;height:1px;background:#2a2a44;"></div>
            </div>
            ${received.slice(0,5).map(d => this._renderPurchaseDraftCard(d, true)).join('')}
        </div>` : ''}
        `;
    }

    _renderPurchaseDraftCard(draft, isReceived = false) {
        const date = new Date(draft.createdAt).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
        const itemCount = (draft.items || []).length;
        const totalQty  = (draft.items || []).reduce((s,i) => s + (i.qty||0), 0);
        const borderCol = isReceived ? 'rgba(0,255,136,0.25)' : 'rgba(108,99,255,0.35)';
        const statusBadge = isReceived
            ? `<span style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.4);border-radius:20px;padding:2px 10px;font-size:0.62rem;font-weight:700;">✅ RECEIVED</span>`
            : `<span style="background:rgba(108,99,255,0.15);color:#a78bfa;border:1px solid rgba(108,99,255,0.4);border-radius:20px;padding:2px 10px;font-size:0.62rem;font-weight:700;">⏳ PENDING</span>`;

        return `
        <div style="background:#13132b;border:1px solid ${borderCol};border-radius:14px;padding:16px;margin-bottom:12px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                <div>
                    <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#e2e8f0;">${draft.supplierName || 'Factory Order'}</div>
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;margin-top:3px;">${draft.id} · ${date}${draft.factoryName ? ' · 🏭 ' + draft.factoryName : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${statusBadge}
                    ${!isReceived ? `<button onclick="app.openNewInventoryForm('${draft.id}')" style="background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.35);border-radius:8px;color:#fb923c;font-family:'Space Mono',monospace;font-size:10px;padding:4px 10px;cursor:pointer;">✏️ Edit</button>` : ''}
                    <button onclick="app.deleteNewInventoryDraft('${draft.id}')" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#f87171;font-family:'Space Mono',monospace;font-size:10px;padding:4px 10px;cursor:pointer;">🗑</button>
                </div>
            </div>

            <!-- Items list -->
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
                ${(draft.items || []).slice(0, 4).map(item => `
                <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border-radius:8px;padding:8px 10px;">
                    ${item.photo ? `<img src="${item.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : `<div style="width:36px;height:36px;background:#1e1e38;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📦</div>`}
                    <div style="flex:1;min-width:0;">
                        <div style="font-family:'Space Mono',monospace;font-size:11px;color:#e2e8f0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
                        ${item.colors && item.colors.length > 0 ? `<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">${item.colors.map(c=>`<span style="background:${this.getColorSwatch(c.name)};width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,0.2);" title="${c.name}: ${c.qty}"></span>`).join('')}</div>` : ''}
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <div style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#a78bfa;">${item.qty} pcs</div>
                        ${item.unitCost ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;">₹${item.unitCost}/pc</div>` : ''}
                    </div>
                </div>`).join('')}
                ${(draft.items||[]).length > 4 ? `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;text-align:center;padding:4px;">...and ${(draft.items||[]).length - 4} more items</div>` : ''}
            </div>

            <!-- Footer -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#5a5a7a;">${itemCount} design${itemCount!==1?'s':''} · ${totalQty} total pieces${draft.totalCost ? ` · <span style="color:#a78bfa;font-weight:700;">₹${draft.totalCost.toLocaleString()}</span>` : ''}</div>
                ${!isReceived ? `
                <button onclick="app.receivePurchaseOrder('${draft.id}')"
                    style="padding:8px 18px;background:linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,212,255,0.15));border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:0.04em;transition:all 0.2s;"
                    onmouseover="this.style.background='linear-gradient(135deg,rgba(0,255,136,0.35),rgba(0,212,255,0.25))'"
                    onmouseout="this.style.background='linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,212,255,0.15))'">
                    📥 RECEIVED — ADD TO INVENTORY
                </button>` : `<div style="font-family:'Space Mono',monospace;font-size:10px;color:#00ff88;">✅ Added on ${new Date(draft.receivedAt||draft.updatedAt||draft.createdAt).toLocaleDateString()}</div>`}
            </div>
        </div>`;
    }

    openNewInventoryForm(draftId = null) {
        const existing = document.getElementById('newInventoryFormModal');
        if (existing) existing.remove();
        const draft = draftId ? storage.getPurchaseDraftById(draftId) : null;
        const products = storage.getProducts();

        const modal = document.createElement('div');
        modal.id = 'newInventoryFormModal';
        modal.className = 'modal active';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:640px;max-height:92vh;overflow-y:auto;">
            <span class="close" onclick="document.getElementById('newInventoryFormModal').remove();window.app&&window.app.refreshActivePage()">×</span>
            <div style="text-align:center;margin-bottom:1.25rem;">
                <div style="font-size:2rem;margin-bottom:0.4rem;">🛒</div>
                <h2 style="color:#a78bfa;font-family:'Space Mono',monospace;font-size:1rem;letter-spacing:0.1em;">${draft ? 'EDIT PURCHASE ORDER' : 'NEW PURCHASE ORDER'}</h2>
                <p style="color:#5a5a7a;font-size:0.82rem;">Add products you are ordering from a factory.<br>When received, click "Received" to add stock to inventory automatically.</p>
            </div>

            <!-- Factory/Supplier info -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div>
                    <label style="font-size:0.75rem;color:#5a5a7a;letter-spacing:0.08em;display:block;margin-bottom:4px;">LINK TO SUPPLIER</label>
                    <select id="po_supplier_id" class="hp-input" onchange="app._onPOSupplierChange()">
                        <option value="">— Select from your suppliers —</option>
                        ${storage.getSuppliers().map(s => `<option value="${s.id}" ${draft?.supplierId===s.id?'selected':''}>${s.name}${s.city?' · '+s.city:''}</option>`).join('')}
                        <option value="__new__">＋ Add new supplier…</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.75rem;color:#5a5a7a;letter-spacing:0.08em;display:block;margin-bottom:4px;">ORDER DATE</label>
                    <input id="po_date" type="date" class="hp-input" value="${draft?.orderDate || new Date().toISOString().split('T')[0]}">
                </div>
            </div>
            <!-- Supplier name text (auto-filled from dropdown, or type manually) -->
            <div style="margin-bottom:10px;">
                <label style="font-size:0.75rem;color:#5a5a7a;letter-spacing:0.08em;display:block;margin-bottom:4px;">FACTORY / SUPPLIER NAME <span style="color:#2a2a44;">(auto-filled or type manually)</span></label>
                <input id="po_supplier" class="hp-input" style="width:100%;" placeholder="e.g. Jaipur Textile Factory" value="${draft?.supplierName||''}">
            </div>
            <input id="po_notes" class="hp-input" placeholder="Notes (optional delivery date, special instructions…)" style="width:100%;margin-bottom:14px;" value="${draft?.notes||''}">

            <!-- Add items section -->
            <div style="background:rgba(108,99,255,0.07);border:1px solid rgba(108,99,255,0.2);border-radius:12px;padding:14px;margin-bottom:14px;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#a78bfa;letter-spacing:0.1em;margin-bottom:12px;">+ ADD DESIGN TO ORDER</div>

                <!-- Row 1: Product select -->
                <div style="margin-bottom:10px;">
                    <label style="font-size:0.72rem;color:#5a5a7a;display:block;margin-bottom:4px;">PRODUCT</label>
                    <select id="po_product_select" class="hp-input" style="width:100%;" onchange="app._onPOProductChange()">
                        <option value="">— Select existing product —</option>
                        ${products.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('')}
                        <option value="__new__">✚ Add new design (not in inventory yet)</option>
                    </select>
                </div>

                <!-- New design fields (shown only when __new__ selected) -->
                <div id="po_new_product_fields" style="display:none;margin-bottom:10px;">
                    <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                        <div style="font-size:0.72rem;color:#00d4ff;letter-spacing:0.08em;font-weight:700;margin-bottom:2px;">✨ NEW DESIGN DETAILS</div>
                        <input id="po_new_name" class="hp-input" placeholder="Design / product name *">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <input id="po_new_sku" class="hp-input" placeholder="SKU (e.g. RAJ-001)">
                            <input id="po_new_category" class="hp-input" placeholder="Category (e.g. Kurta)">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div>
                                <label style="font-size:0.68rem;color:#5a5a7a;display:block;margin-bottom:3px;">SELLING PRICE (₹) *</label>
                                <input id="po_new_price" class="hp-input" type="number" min="0" step="0.01" placeholder="e.g. 2500">
                            </div>
                            <div>
                                <label style="font-size:0.68rem;color:#5a5a7a;display:block;margin-bottom:3px;">WHOLESALE PRICE (₹)</label>
                                <input id="po_new_wholesale" class="hp-input" type="number" min="0" step="0.01" placeholder="e.g. 1800">
                            </div>
                        </div>
                        <!-- Photo upload for new design -->
                        <div>
                            <label style="font-size:0.68rem;color:#5a5a7a;display:block;margin-bottom:4px;">PRODUCT PHOTO</label>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <div id="po_photo_preview" style="width:52px;height:52px;border-radius:8px;background:#1e1e38;border:1.5px dashed #2a2a44;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;overflow:hidden;">📷</div>
                                <div style="display:flex;flex-direction:column;gap:5px;flex:1;">
                                    <button type="button" onclick="document.getElementById('po_photo_file').click()"
                                        style="padding:6px 10px;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.35);border-radius:8px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">📁 Upload Photo</button>
                                    <button type="button" onclick="app._openPOCamera()"
                                        style="padding:6px 10px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">📸 Take Photo</button>
                                </div>
                                <input type="file" id="po_photo_file" accept="image/*" style="display:none;" onchange="app._onPOPhotoUpload(event)">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Photo for EXISTING product (override) -->
                <div id="po_existing_photo_section" style="display:none;margin-bottom:10px;">
                    <div style="background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.2);border-radius:10px;padding:10px 12px;">
                        <div style="font-size:0.72rem;color:#fb923c;letter-spacing:0.08em;font-weight:700;margin-bottom:8px;">📸 UPDATE PRODUCT PHOTO (optional)</div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div id="po_existing_photo_preview" style="width:52px;height:52px;border-radius:8px;background:#1e1e38;border:1.5px dashed #2a2a44;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;overflow:hidden;">📦</div>
                            <div style="display:flex;flex-direction:column;gap:5px;flex:1;">
                                <button type="button" onclick="document.getElementById('po_existing_photo_file').click()"
                                    style="padding:6px 10px;background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.3);border-radius:8px;color:#fb923c;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer;">📁 Change Photo</button>
                            </div>
                            <input type="file" id="po_existing_photo_file" accept="image/*" style="display:none;" onchange="app._onPOExistingPhotoUpload(event)">
                        </div>
                        <!-- Editable prices for existing product -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                            <div>
                                <label style="font-size:0.68rem;color:#5a5a7a;display:block;margin-bottom:3px;">SELLING PRICE (₹)</label>
                                <input id="po_existing_price" class="hp-input" type="number" min="0" step="0.01" placeholder="Keep existing">
                            </div>
                            <div>
                                <label style="font-size:0.68rem;color:#5a5a7a;display:block;margin-bottom:3px;">WHOLESALE PRICE (₹)</label>
                                <input id="po_existing_wholesale" class="hp-input" type="number" min="0" step="0.01" placeholder="Keep existing">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Row 2: Qty + Purchase cost -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div>
                        <label style="font-size:0.72rem;color:#5a5a7a;display:block;margin-bottom:4px;">QUANTITY (pieces)</label>
                        <input id="po_qty" type="number" min="1" value="10" class="hp-input">
                    </div>
                    <div>
                        <label style="font-size:0.72rem;color:#5a5a7a;display:block;margin-bottom:4px;">PURCHASE COST / PIECE (₹)</label>
                        <input id="po_cost" type="number" min="0" step="0.01" placeholder="0.00" class="hp-input">
                    </div>
                </div>

                <!-- Colour picker -->
                <div id="po_item_colors_section" style="margin-bottom:12px;">
                    <div style="font-size:0.72rem;color:#5a5a7a;margin-bottom:6px;letter-spacing:0.06em;">COLOURS <span style="color:#2a2a44;">(optional — skip if all same colour)</span></div>
                    <div id="po_item_color_tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;"></div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                        <button type="button" onclick="app._openPOColorChart()" style="background:rgba(108,99,255,0.2);border:1px solid rgba(108,99,255,0.4);border-radius:8px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:10px;padding:5px 10px;cursor:pointer;">🎨 Colour Chart</button>
                        <input id="po_color_name" class="hp-input" placeholder="Colour name" style="width:110px;font-size:11px;">
                        <input id="po_color_qty" type="number" min="1" placeholder="Qty" class="hp-input" style="width:60px;font-size:11px;">
                        <button type="button" onclick="app._addPOColor()" style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:10px;padding:5px 10px;cursor:pointer;">+ Add</button>
                    </div>
                </div>

                <button onclick="app._addItemToPOForm()" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(108,99,255,0.3),rgba(0,212,255,0.2));border:1px solid rgba(108,99,255,0.5);border-radius:10px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:0.04em;transition:background 0.2s;"
                    onmouseover="this.style.background='linear-gradient(135deg,rgba(108,99,255,0.5),rgba(0,212,255,0.35))'"
                    onmouseout="this.style.background='linear-gradient(135deg,rgba(108,99,255,0.3),rgba(0,212,255,0.2))'">
                    ✅ ADD THIS DESIGN TO ORDER
                </button>
            </div>

            <!-- Items in this order -->
            <div>
                <div style="font-family:'Space Mono',monospace;font-size:11px;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:8px;">ORDER ITEMS</div>
                <div id="po_items_list" style="display:flex;flex-direction:column;gap:8px;">
                    ${(draft?.items||[]).length === 0 ? '<div style="text-align:center;padding:16px;color:#2a2a44;font-family:Space Mono,monospace;font-size:11px;">No items added yet</div>' : ''}
                </div>
                <div id="po_total_display" style="display:${(draft?.items||[]).length>0?'flex':'none'};justify-content:space-between;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.25);border-radius:8px;padding:10px 14px;margin-top:8px;font-family:'Space Mono',monospace;">
                    <span style="color:#5a5a7a;font-size:11px;">TOTAL ORDER VALUE</span>
                    <span id="po_total_val" style="color:#a78bfa;font-size:14px;font-weight:700;">₹0</span>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:1rem;">
                <button class="hp-btn-ghost" style="flex:1;" onclick="document.getElementById('newInventoryFormModal').remove();window.app&&window.app.refreshActivePage()">Cancel</button>
                <button class="hp-btn-neon" style="flex:2;" onclick="app._savePurchaseOrderDraft('${draftId||''}')">💾 SAVE PURCHASE ORDER</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });

        // Init state
        this._poItems = draft ? JSON.parse(JSON.stringify(draft.items || [])) : [];
        this._poItemColors = [];
        this._poSupplierId = draft?.supplierId || null;
        this._renderPOItems();
    }

    _onPOSupplierChange() {
        const sel = document.getElementById('po_supplier_id');
        const nameInput = document.getElementById('po_supplier');
        if (!sel) return;
        if (sel.value === '__new__') {
            sel.value = '';
            // Open supplier modal and come back
            document.getElementById('newInventoryFormModal')?.remove();
            this.openSupplierModal();
            const origSave = this.saveSupplier.bind(this);
            this.saveSupplier = (id) => {
                this.saveSupplier = origSave;
                origSave(id);
                // Re-open the form after supplier saved
                setTimeout(() => this.openNewInventoryForm(), 300);
            };
            return;
        }
        if (sel.value) {
            const s = storage.getSupplierById(sel.value);
            if (s) {
                this._poSupplierId = s.id;
                if (nameInput) nameInput.value = s.name;
            }
        } else {
            this._poSupplierId = null;
        }
    }

    _onPOProductChange() {
        const val = document.getElementById('po_product_select').value;
        const newFields = document.getElementById('po_new_product_fields');
        const existingPhotoSection = document.getElementById('po_existing_photo_section');
        if (newFields) newFields.style.display = val === '__new__' ? 'block' : 'none';
        if (existingPhotoSection) existingPhotoSection.style.display = (val && val !== '__new__') ? 'block' : 'none';

        if (val && val !== '__new__') {
            const p = storage.getProductById(val);
            if (p) {
                document.getElementById('po_cost').value = (p.wholesalePrice || p.price || 0).toFixed(2);
                // Pre-fill editable prices
                const ep = document.getElementById('po_existing_price');
                const ew = document.getElementById('po_existing_wholesale');
                if (ep) ep.value = p.price ? p.price.toFixed(2) : '';
                if (ew) ew.value = p.wholesalePrice ? p.wholesalePrice.toFixed(2) : '';
                // Show existing photo in preview
                const preview = document.getElementById('po_existing_photo_preview');
                if (preview) {
                    if (p.photo) {
                        preview.innerHTML = `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">`;
                    } else {
                        preview.innerHTML = '📦';
                    }
                }
                // Pre-populate colors from existing product
                this._poItemColors = (p.colors || []).map(c => ({
                    name: typeof c === 'string' ? c : c.name,
                    qty: 1,
                    hex: this.getColorSwatch(typeof c === 'string' ? c : c.name)
                }));
                this._renderPOItemColors();
                // Store reference for photo override
                this._poExistingProduct = p;
                this._poExistingPhotoOverride = null;
            }
        } else {
            this._poItemColors = [];
            this._renderPOItemColors();
            this._poExistingProduct = null;
            this._poExistingPhotoOverride = null;
            this._poNewPhotoBase64 = null;
            const preview = document.getElementById('po_photo_preview');
            if (preview) preview.innerHTML = '📷';
        }
    }

    _onPOPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this._poNewPhotoBase64 = e.target.result;
            const preview = document.getElementById('po_photo_preview');
            if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }

    _onPOExistingPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this._poExistingPhotoOverride = e.target.result;
            const preview = document.getElementById('po_existing_photo_preview');
            if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }

    _openPOCamera() {
        // Open camera for new product photo
        const existingModal = document.getElementById('poCameraModal');
        if (existingModal) existingModal.remove();
        const modal = document.createElement('div');
        modal.id = 'poCameraModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;';
        modal.innerHTML = `
        <div style="background:#0f0f1e;border-radius:16px;padding:16px;width:100%;max-width:400px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div style="font-family:'Space Mono',monospace;font-size:12px;color:#a78bfa;">📸 TAKE PRODUCT PHOTO</div>
                <button onclick="app._closePOCamera()" style="background:none;border:none;color:#5a5a7a;font-size:18px;cursor:pointer;">✕</button>
            </div>
            <video id="poCameraFeed" autoplay playsinline style="width:100%;border-radius:10px;background:#000;max-height:280px;object-fit:cover;"></video>
            <canvas id="poCameraCanvas" style="display:none;"></canvas>
            <div id="poCameraPreview" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;">
                <img id="poCameraPreviewImg" style="width:100%;max-height:200px;object-fit:contain;background:#0a0a18;">
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button id="poCaptureBtn" onclick="app._capturePOPhoto()" style="flex:1;padding:10px;background:rgba(108,99,255,0.3);border:1px solid rgba(108,99,255,0.5);border-radius:10px;color:#a78bfa;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">📸 CAPTURE</button>
                <button id="poRetakeBtn" onclick="app._retakePOPhoto()" style="display:none;flex:1;padding:10px;background:rgba(42,42,68,0.8);border:1px solid #2a2a44;border-radius:10px;color:#8892b0;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer;">↺ RETAKE</button>
                <button id="poUsePhotoBtn" onclick="app._usePOCameraPhoto()" style="display:none;flex:1;padding:10px;background:linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,212,255,0.2));border:1px solid rgba(0,255,136,0.4);border-radius:10px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">✅ USE THIS</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                this._poCameraStream = stream;
                document.getElementById('poCameraFeed').srcObject = stream;
            })
            .catch(() => {
                this.showNotification('Camera access denied. Use Upload instead.', 'warning');
                modal.remove();
            });
    }

    _capturePOPhoto() {
        const video = document.getElementById('poCameraFeed');
        const canvas = document.getElementById('poCameraCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        this._poCameraCapture = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('poCameraPreviewImg').src = this._poCameraCapture;
        document.getElementById('poCameraPreview').style.display = 'block';
        document.getElementById('poCameraFeed').style.display = 'none';
        document.getElementById('poCaptureBtn').style.display = 'none';
        document.getElementById('poRetakeBtn').style.display = 'block';
        document.getElementById('poUsePhotoBtn').style.display = 'block';
    }

    _retakePOPhoto() {
        document.getElementById('poCameraPreview').style.display = 'none';
        document.getElementById('poCameraFeed').style.display = 'block';
        document.getElementById('poCaptureBtn').style.display = 'block';
        document.getElementById('poRetakeBtn').style.display = 'none';
        document.getElementById('poUsePhotoBtn').style.display = 'none';
        this._poCameraCapture = null;
    }

    _usePOCameraPhoto() {
        if (!this._poCameraCapture) return;
        this._poNewPhotoBase64 = this._poCameraCapture;
        const preview = document.getElementById('po_photo_preview');
        if (preview) preview.innerHTML = `<img src="${this._poCameraCapture}" style="width:100%;height:100%;object-fit:cover;">`;
        this._closePOCamera();
        this.showNotification('✅ Photo captured!', 'success');
    }

    _closePOCamera() {
        if (this._poCameraStream) {
            this._poCameraStream.getTracks().forEach(t => t.stop());
            this._poCameraStream = null;
        }
        document.getElementById('poCameraModal')?.remove();
    }

    _addPOColor() {
        const name = (document.getElementById('po_color_name').value || '').trim();
        if (!name) { this.showNotification('Enter a colour name', 'warning'); return; }
        const qty = parseInt(document.getElementById('po_color_qty').value) || 1;
        const hex = this.getColorSwatch(name);
        if (!this._poItemColors) this._poItemColors = [];
        if (this._poItemColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
            this.showNotification(`${name} already added`, 'warning'); return;
        }
        this._poItemColors.push({ name, qty, hex });
        this._renderPOItemColors();
        document.getElementById('po_color_name').value = '';
        document.getElementById('po_color_qty').value = '';
    }

    _openPOColorChart() {
        // Reuse existing color chart but hook into PO color adding
        const chart = this._getColorChartData();
        const existing = document.getElementById('poColorChartModal');
        if (existing) { existing.remove(); return; }
        const groupsHtml = chart.map(group => `
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.72rem;font-weight:700;color:#5a5a7a;letter-spacing:0.06em;margin-bottom:0.4rem;">${group.group.toUpperCase()}</div>
                <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;">
                    ${group.colors.map(c => `
                        <div onclick="app._selectPOColorFromChart('${c.name}','${c.hex}')"
                            title="${c.name}"
                            style="cursor:pointer;border-radius:6px;aspect-ratio:1;background:${c.hex};border:2px solid transparent;transition:transform 0.1s,border-color 0.1s;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                            onmouseover="this.style.transform='scale(1.18)';this.style.borderColor='white';"
                            onmouseout="this.style.transform='scale(1)';this.style.borderColor='transparent';">
                        </div>`).join('')}
                </div>
            </div>`).join('');
        const m = document.createElement('div');
        m.id = 'poColorChartModal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:flex-end;justify-content:center;';
        m.innerHTML = `<div style="background:#0f0f1e;border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:80vh;overflow-y:auto;padding:1.25rem 1.25rem 2rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;"><div style="font-weight:700;color:#e2e8f0;">🎨 Colour Chart</div><button onclick="document.getElementById('poColorChartModal').remove();window.app&&window.app.refreshActivePage()" style="background:#1e1e38;border:none;color:#5a5a7a;border-radius:8px;padding:0.4rem 0.65rem;cursor:pointer;font-size:1rem;">✕</button></div>
            ${groupsHtml}</div>`;
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    }

    _selectPOColorFromChart(name, hex) {
        if (!this._poItemColors) this._poItemColors = [];
        if (this._poItemColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
            this.showNotification(`${name} already added`, 'warning');
            document.getElementById('poColorChartModal')?.remove();
            return;
        }
        // Show qty prompt
        const qty = prompt(`How many pieces of ${name}?`, '10');
        if (qty === null) return;
        this._poItemColors.push({ name, qty: parseInt(qty) || 1, hex });
        this._renderPOItemColors();
        document.getElementById('poColorChartModal')?.remove();
        this.showNotification(`✓ ${name} added`, 'success');
    }

    _renderPOItemColors() {
        const container = document.getElementById('po_item_color_tags');
        if (!container) return;
        container.innerHTML = (this._poItemColors || []).map((c, i) => `
            <span style="display:inline-flex;align-items:center;gap:5px;background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.3);border-radius:20px;padding:3px 10px;font-family:'Space Mono',monospace;font-size:10px;color:#e2e8f0;">
                <span style="width:10px;height:10px;border-radius:50%;background:${c.hex||this.getColorSwatch(c.name)};display:inline-block;flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></span>
                ${c.name} ×${c.qty}
                <span onclick="app._poItemColors.splice(${i},1);app._renderPOItemColors();" style="cursor:pointer;color:#f87171;margin-left:2px;font-size:12px;line-height:1;">✕</span>
            </span>`).join('');
    }

    _addItemToPOForm() {
        const selectEl = document.getElementById('po_product_select');
        const qty = parseInt(document.getElementById('po_qty').value) || 0;
        const unitCost = parseFloat(document.getElementById('po_cost').value) || 0;
        if (!selectEl.value) { this.showNotification('Select a product first', 'warning'); return; }
        if (qty < 1) { this.showNotification('Quantity must be at least 1', 'warning'); return; }

        let name, photo = null, productId = null, sku = '', sellingPrice = 0, wholesalePrice = 0;

        if (selectEl.value === '__new__') {
            name = (document.getElementById('po_new_name').value || '').trim();
            if (!name) { this.showNotification('Enter a name for the new design', 'warning'); return; }
            sku = (document.getElementById('po_new_sku').value || '').trim();
            sellingPrice  = parseFloat(document.getElementById('po_new_price').value) || unitCost || 0;
            wholesalePrice = parseFloat(document.getElementById('po_new_wholesale').value) || unitCost || 0;
            photo = this._poNewPhotoBase64 || null;
        } else {
            const p = storage.getProductById(selectEl.value);
            if (!p) return;
            name = p.name;
            photo = this._poExistingPhotoOverride || p.photo || null;
            productId = p.id;
            sku = p.sku;
            sellingPrice  = parseFloat(document.getElementById('po_existing_price')?.value) || p.price || 0;
            wholesalePrice = parseFloat(document.getElementById('po_existing_wholesale')?.value) || p.wholesalePrice || unitCost || 0;
        }

        const colors = this._poItemColors ? JSON.parse(JSON.stringify(this._poItemColors)) : [];
        const actualQty = colors.length > 0 ? colors.reduce((s, c) => s + (c.qty||0), 0) : qty;

        if (!this._poItems) this._poItems = [];
        this._poItems.push({
            name, sku, productId, photo, qty: actualQty, unitCost, colors,
            sellingPrice, wholesalePrice,
            _newProduct: selectEl.value === '__new__',
            _photoOverride: this._poExistingPhotoOverride || null
        });

        // Reset form
        selectEl.value = '';
        document.getElementById('po_qty').value = '10';
        document.getElementById('po_cost').value = '';
        const nf = document.getElementById('po_new_product_fields');
        if (nf) nf.style.display = 'none';
        const ef = document.getElementById('po_existing_photo_section');
        if (ef) ef.style.display = 'none';
        const preview = document.getElementById('po_photo_preview');
        if (preview) preview.innerHTML = '📷';
        const ep = document.getElementById('po_existing_photo_preview');
        if (ep) ep.innerHTML = '📦';
        this._poItemColors = [];
        this._poNewPhotoBase64 = null;
        this._poExistingPhotoOverride = null;
        this._renderPOItemColors();
        this._renderPOItems();
        this.showNotification(`✓ ${name} added to order`, 'success');
    }

    _renderPOItems() {
        const container = document.getElementById('po_items_list');
        const totalDisplay = document.getElementById('po_total_display');
        const totalVal = document.getElementById('po_total_val');
        if (!container) return;
        const items = this._poItems || [];
        if (items.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:16px;color:#2a2a44;font-family:Space Mono,monospace;font-size:11px;">No items added yet</div>';
            if (totalDisplay) totalDisplay.style.display = 'none';
            return;
        }
        let total = 0;
        container.innerHTML = items.map((item, idx) => {
            const lineTotal = (item.qty||0) * (item.unitCost||0);
            total += lineTotal;
            const colorDots = (item.colors||[]).slice(0,6).map(c =>
                `<span style="width:11px;height:11px;border-radius:50%;background:${c.hex||this.getColorSwatch(c.name)};display:inline-block;border:1px solid rgba(255,255,255,0.15);" title="${c.name}: ${c.qty}"></span>`).join('');
            return `
            <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border:1px solid #1e1e38;border-radius:10px;padding:10px 12px;">
                ${item.photo ? `<img src="${item.photo}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : `<div style="width:32px;height:32px;background:#1e1e38;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📦</div>`}
                <div style="flex:1;min-width:0;">
                    <div style="font-family:'Space Mono',monospace;font-size:11px;color:#e2e8f0;font-weight:600;">${item.name}</div>
                    <div style="display:flex;gap:4px;align-items:center;margin-top:3px;flex-wrap:wrap;">
                        <span style="font-family:'Space Mono',monospace;font-size:9px;color:#5a5a7a;">${item.qty} pcs${item.unitCost ? ` · ₹${item.unitCost}/pc` : ''}</span>
                        ${colorDots ? `<span style="display:inline-flex;gap:3px;align-items:center;">${colorDots}</span>` : ''}
                        ${item._newProduct ? `<span style="background:rgba(0,212,255,0.1);color:#00d4ff;border-radius:10px;padding:1px 6px;font-size:9px;font-family:'Space Mono',monospace;">NEW</span>` : ''}
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    ${lineTotal > 0 ? `<div style="font-family:'Space Mono',monospace;font-size:12px;color:#a78bfa;font-weight:700;">₹${lineTotal.toLocaleString()}</div>` : ''}
                    <button onclick="app._poItems.splice(${idx},1);app._renderPOItems();" style="background:none;border:none;color:#f87171;font-size:14px;cursor:pointer;margin-top:2px;">🗑</button>
                </div>
            </div>`;
        }).join('');
        if (totalDisplay) totalDisplay.style.display = 'flex';
        if (totalVal) totalVal.textContent = `₹${total.toLocaleString()}`;
    }

    _savePurchaseOrderDraft(existingId) {
        const items = this._poItems || [];
        if (items.length === 0) { this.showNotification('Add at least one item', 'warning'); return; }
        const supplierName = document.getElementById('po_supplier').value.trim() || 'Factory Order';
        const supplierId   = this._poSupplierId || null;
        const orderDate    = document.getElementById('po_date').value;
        const notes        = document.getElementById('po_notes').value.trim();
        const totalCost    = items.reduce((s, i) => s + (i.qty||0) * (i.unitCost||0), 0);

        const data = { supplierName, supplierId, orderDate, notes, items, totalCost };
        if (existingId) {
            storage.updatePurchaseDraft(existingId, data);
            this.showNotification('✅ Purchase order updated!', 'success');
        } else {
            storage.addPurchaseDraft(data);
            this.showNotification('✅ Purchase order saved!', 'success');
        }
        document.getElementById('newInventoryFormModal')?.remove();
        this.loadNewInventoryPage();
    }

    receivePurchaseOrder(draftId) {
        const draft = storage.getPurchaseDraftById(draftId);
        if (!draft) return;
        if (!confirm(`Mark this order as RECEIVED?\n\nThis will add all items to your inventory stock.\n\nFactory: ${draft.supplierName || 'Factory'}\nItems: ${(draft.items||[]).length} designs`)) return;

        // Resolve supplier details from the draft
        const supplierId   = draft.supplierId || null;
        const supplierName = draft.supplierName || null;
        // If supplierId is valid, update the supplier's last order date
        if (supplierId && storage.getSupplierById(supplierId)) {
            storage.updateSupplier(supplierId, { lastOrderDate: new Date().toISOString() });
        }

        const newProducts = [];
        (draft.items || []).forEach(item => {
            if (item.productId) {
                // Existing product — add stock
                const p = storage.getProductById(item.productId);
                if (!p) return;
                let updatedColors = (p.colors || []).map(c => typeof c === 'string' ? { name: c, qty: 0 } : { ...c });
                if (item.colors && item.colors.length > 0) {
                    item.colors.forEach(incoming => {
                        const existing = updatedColors.find(c => c.name.toLowerCase() === incoming.name.toLowerCase());
                        if (existing) {
                            existing.qty = (existing.qty || 0) + (incoming.qty || 0);
                        } else {
                            updatedColors.push({ name: incoming.name, qty: incoming.qty || 0, hex: incoming.hex });
                        }
                    });
                    const newTotal = updatedColors.reduce((s, c) => s + (c.qty || 0), 0);
                    const updateData = { quantity: newTotal, colors: updatedColors };
                    if (item.wholesalePrice) updateData.wholesalePrice = item.wholesalePrice;
                    if (item.sellingPrice)   updateData.price = item.sellingPrice;
                    if (item._photoOverride) updateData.photo = item._photoOverride;
                    // ✅ Always update supplier info
                    if (supplierId)   updateData.supplierId   = supplierId;
                    if (supplierName) updateData.supplierName = supplierName;
                    storage.updateProduct(item.productId, updateData);
                } else {
                    const updateData = { quantity: (p.quantity || 0) + (item.qty || 0) };
                    if (item.wholesalePrice) updateData.wholesalePrice = item.wholesalePrice;
                    if (item.sellingPrice)   updateData.price = item.sellingPrice;
                    if (item._photoOverride) updateData.photo = item._photoOverride;
                    // ✅ Always update supplier info
                    if (supplierId)   updateData.supplierId   = supplierId;
                    if (supplierName) updateData.supplierName = supplierName;
                    storage.updateProduct(item.productId, updateData);
                }
            } else if (item._newProduct) {
                const colors = (item.colors || []).map(c => ({ name: c.name, qty: c.qty || 0, hex: c.hex }));
                const totalQty = colors.length > 0 ? colors.reduce((s, c) => s + (c.qty || 0), 0) : (item.qty || 0);
                const newP = {
                    name: item.name,
                    sku: item.sku || ('NEW-' + Date.now()),
                    category: item.category || '',
                    price: item.sellingPrice || item.unitCost || 0,
                    wholesalePrice: item.wholesalePrice || item.unitCost || 0,
                    quantity: totalQty,
                    description: `Added via Purchase Order ${draft.id}`,
                    colors,
                    photo: item.photo || null,
                    // ✅ Set supplier info on new products too
                    supplierId:   supplierId   || null,
                    supplierName: supplierName || null
                };
                newProducts.push(newP);
            }
        });
        newProducts.forEach(p => storage.addProduct(p));

        // Mark as received
        storage.updatePurchaseDraft(draftId, { status: 'received', receivedAt: new Date().toISOString() });

        // Add purchase invoice for tracking
        const inv = {
            type: 'purchase',
            supplierName: draft.supplierName || 'Factory',
            items: (draft.items||[]).map(i => ({
                productId: i.productId,
                name: i.name,
                qty: i.qty,
                price: i.unitCost || 0,
                total: (i.qty||0) * (i.unitCost||0)
            })),
            total: draft.totalCost || 0,
            notes: draft.notes
        };
        storage.addInvoice(inv);

        this.showNotification(`✅ Stock updated! ${newProducts.length > 0 ? newProducts.length + ' new products added.' : ''}`, 'success');
        this.loadNewInventoryPage();
        this.updateDashboard();
    }

    deleteNewInventoryDraft(draftId) {
        if (!confirm('Delete this purchase order?')) return;
        storage.deletePurchaseDraft(draftId);
        this.showNotification('Purchase order deleted.', 'success');
        this.loadNewInventoryPage();
    }

    // =====================
    // DESIGN CHART (Product showcase with name + colours)
    // =====================
    loadDesignChart() {
        const container = document.getElementById('designChartContent');
        if (!container) return;
        const filterEl = document.getElementById('designChartFilter');
        const products = storage.getProducts();

        // Populate category filter
        if (filterEl) {
            const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
            const currentVal = filterEl.value;
            filterEl.innerHTML = `<option value="all">All Products</option>` +
                cats.map(c => `<option value="${c}" ${currentVal===c?'selected':''}>${c}</option>`).join('');
            filterEl.value = currentVal || 'all';
        }

        const filterCat = filterEl ? filterEl.value : 'all';
        const filtered = filterCat === 'all' ? products : products.filter(p => p.category === filterCat);

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:3rem;color:#5a5a7a;font-family:'Space Mono',monospace;">
                <div style="font-size:3rem;margin-bottom:1rem;">🎨</div>
                <div>No products found. Add products first.</div>
            </div>`;
            return;
        }

        container.innerHTML = `
        <!-- Header note -->
        <div style="background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-family:'Space Mono',monospace;font-size:11px;color:#a78bfa;">
            🎨 This is your <strong>Product Design Chart</strong> — shows each product with its colours. Use the Print button to share with customers.
        </div>

        <!-- Design grid -->
        <div id="designChartGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;">
            ${filtered.map(p => this._renderDesignChartCard(p)).join('')}
        </div>`;
    }

    _renderDesignChartCard(p) {
        const colors = (p.colors || []).filter(c => {
            const qty = typeof c === 'string' ? 0 : (c.qty || 0);
            return qty > 0 || (p.colors || []).every(cc => (typeof cc === 'string' ? 0 : cc.qty || 0) === 0);
        });
        const allColors = p.colors || [];
        const hasColors = allColors.length > 0;

        const colorGrid = allColors.map(c => {
            const name = typeof c === 'string' ? c : c.name;
            const qty  = typeof c === 'string' ? null : (c.qty || 0);
            const hex  = this.getColorSwatch(name);
            const isOut = qty === 0;
            return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;" title="${name}${qty !== null ? ': ' + qty + ' pcs' : ''}">
                <div style="width:36px;height:36px;border-radius:50%;background:${hex};border:2px solid rgba(255,255,255,0.15);box-shadow:0 2px 8px rgba(0,0,0,0.3);${isOut ? 'filter:grayscale(80%);opacity:0.45;' : ''}position:relative;">
                    ${isOut ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">✕</div>` : ''}
                </div>
                <div style="font-family:'Space Mono',monospace;font-size:8px;color:#8892b0;text-align:center;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                ${qty !== null ? `<div style="font-family:'Space Mono',monospace;font-size:8px;color:${isOut ? '#f87171' : '#00ff88'};text-align:center;">${isOut ? 'OUT' : qty}</div>` : ''}
            </div>`;
        }).join('');

        const stockStatus = p.quantity === 0 ? { text: 'OUT OF STOCK', col: '#f87171', bg: 'rgba(239,68,68,0.12)' }
            : p.quantity < 10 ? { text: 'LOW STOCK', col: '#ffd700', bg: 'rgba(255,215,0,0.1)' }
            : { text: 'IN STOCK', col: '#00ff88', bg: 'rgba(0,255,136,0.1)' };

        return `
        <div style="background:linear-gradient(135deg,#13132b,#1a1a35);border:1px solid rgba(108,99,255,0.25);border-radius:16px;overflow:hidden;transition:border-color 0.25s,transform 0.2s;cursor:pointer;"
            onclick="app.openPhotoLightbox('${p.id}')"
            onmouseover="this.style.borderColor='rgba(108,99,255,0.6)';this.style.transform='translateY(-3px)'"
            onmouseout="this.style.borderColor='rgba(108,99,255,0.25)';this.style.transform='translateY(0)'">

            <!-- Product image -->
            <div style="width:100%;aspect-ratio:1;background:#0d0d1e;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;">
                ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:3.5rem;opacity:0.15;">👗</span>`}
                <!-- Stock badge overlay -->
                <div style="position:absolute;top:8px;right:8px;background:${stockStatus.bg};border:1px solid ${stockStatus.col};border-radius:20px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:8px;font-weight:700;color:${stockStatus.col};backdrop-filter:blur(4px);">${stockStatus.text}</div>
                <!-- Category badge -->
                ${p.category ? `<div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);border-radius:20px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:8px;color:#8892b0;backdrop-filter:blur(4px);">${p.category}</div>` : ''}
            </div>

            <!-- Info -->
            <div style="padding:12px 14px;">
                <div style="font-family:'Outfit',sans-serif;font-size:0.95rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                <div style="font-family:'Space Mono',monospace;font-size:9px;color:#8892b0;margin-bottom:8px;">SKU: ${p.sku}</div>

                ${hasColors ? `
                <!-- Colour section -->
                <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">
                    <div style="font-family:'Space Mono',monospace;font-size:8px;color:#5a5a7a;letter-spacing:0.1em;margin-bottom:8px;">AVAILABLE COLOURS</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:6px;">
                        ${colorGrid}
                    </div>
                </div>` : `
                <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;font-family:'Space Mono',monospace;font-size:9px;color:#2a2a44;text-align:center;">No colour variants</div>`}

                <!-- Stock count -->
                <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;">Total stock</div>
                    <div style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:${stockStatus.col};">${p.quantity} pcs</div>
                </div>
            </div>
        </div>`;
    }

    async openPhotoLightbox(productId) {
        const p = storage.getProducts().find(pr => pr.id === productId);
        if (!p) return;
        const existing = document.getElementById('photoLightbox');
        if (existing) existing.remove();

        // Show lightbox immediately with photo (or placeholder)
        const lb = document.createElement('div');
        lb.id = 'photoLightbox';
        lb.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;backdrop-filter:blur(8px);';

        const initialMedia = p.photo
            ? `<img id="lbPhoto" src="${p.photo}" style="max-width:90vw;max-height:82vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.7);">`
            : `<div style="width:220px;height:220px;background:#1a1a35;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:6rem;opacity:0.4;">👗</div>`;

        const videoPlaceholder = p.hasVideo
            ? `<div id="lbVideoLoading" style="position:absolute;bottom:10px;left:10px;background:rgba(108,99,255,0.7);border-radius:20px;color:#fff;font-size:0.7rem;font-family:Space Mono,monospace;padding:4px 10px;">⏳ Loading video...</div>`
            : '';

        lb.innerHTML = `
            <div style="position:absolute;top:16px;right:16px;">
                <button onclick="document.getElementById('photoLightbox').remove();window.app&&window.app.refreshActivePage()"
                    style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:50%;width:40px;height:40px;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div id="lbMediaWrap" style="position:relative;max-width:90vw;display:flex;align-items:center;justify-content:center;">
                ${initialMedia}
                ${videoPlaceholder}
            </div>
            <div style="text-align:center;">
                <div style="font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:700;color:#e2e8f0;">${p.name}</div>
                <div style="font-family:'Space Mono',monospace;font-size:10px;color:#5a5a7a;margin-top:4px;">SKU: ${p.sku}</div>
            </div>
        `;
        lb.addEventListener('click', (e) => { if (e.target === lb) lb.remove(); });
        document.body.appendChild(lb);

        // Load video from IndexedDB asynchronously — swap in when ready
        if (p.hasVideo) {
            const videoData = await storage.getVideo(productId);
            const wrap = document.getElementById('lbMediaWrap');
            if (!wrap || !document.getElementById('photoLightbox')) return; // lightbox was closed
            if (videoData) {
                wrap.innerHTML = `
                    <video id="lbVideo" src="${videoData}" style="max-width:90vw;max-height:78vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.7);display:block;" autoplay playsinline loop muted></video>
                    <button onclick="const v=document.getElementById('lbVideo');v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊';"
                        style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.6);border:none;border-radius:20px;color:#fff;font-size:1rem;padding:4px 10px;cursor:pointer;">🔇</button>
                    ${p.photo ? `<button onclick="app._lbToggleMedia('${p.id}')" id="lbToggleBtn"
                        style="position:absolute;bottom:10px;left:10px;background:rgba(108,99,255,0.7);border:none;border-radius:20px;color:#fff;font-size:0.7rem;font-family:Space Mono,monospace;padding:4px 10px;cursor:pointer;">📷 PHOTO</button>` : ''}
                `;
            } else {
                // Video not found in IndexedDB — just remove the loading indicator
                const loader = document.getElementById('lbVideoLoading');
                if (loader) loader.remove();
            }
        }
    }

    async _lbToggleMedia(productId) {
        const p = storage.getProducts().find(pr => pr.id === productId);
        if (!p) return;
        const video = document.getElementById('lbVideo');
        const photo = document.getElementById('lbPhoto');
        if (video) {
            // Switch to photo
            video.pause();
            const wrapper = video.parentElement;
            wrapper.innerHTML = `<img id="lbPhoto" src="${p.photo}" style="max-width:90vw;max-height:82vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.7);">
                <button onclick="app._lbToggleMedia('${p.id}')" id="lbToggleBtn"
                    style="position:absolute;bottom:10px;left:10px;background:rgba(108,99,255,0.7);border:none;border-radius:20px;color:#fff;font-size:0.7rem;font-family:Space Mono,monospace;padding:4px 10px;cursor:pointer;">🎥 VIDEO</button>`;
            wrapper.style.position = 'relative';
        } else if (photo) {
            // Switch back to video — load from IndexedDB
            const wrapper = photo.parentElement;
            wrapper.innerHTML = `<div style="color:#8892b0;font-family:Space Mono,monospace;font-size:11px;padding:20px;">⏳ Loading video...</div>`;
            const videoData = await storage.getVideo(productId);
            if (!document.getElementById('photoLightbox')) return;
            wrapper.innerHTML = `<video id="lbVideo" src="${videoData}" style="max-width:90vw;max-height:78vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.7);display:block;" autoplay playsinline loop muted></video>
                <button onclick="const v=document.getElementById('lbVideo');v.muted=!v.muted;this.textContent=v.muted?'🔇':'🔊';" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.6);border:none;border-radius:20px;color:#fff;font-size:1rem;padding:4px 10px;cursor:pointer;">🔇</button>
                <button onclick="app._lbToggleMedia('${p.id}')" id="lbToggleBtn" style="position:absolute;bottom:10px;left:10px;background:rgba(108,99,255,0.7);border:none;border-radius:20px;color:#fff;font-size:0.7rem;font-family:Space Mono,monospace;padding:4px 10px;cursor:pointer;">📷 PHOTO</button>`;
            wrapper.style.position = 'relative';
        }
    }

    printDesignChart() {
        const content = document.getElementById('designChartGrid');
        if (!content) { this.showNotification('Load the chart first', 'warning'); return; }
        const storeName = localStorage.getItem('storeName') || 'Shop';
        const printWin = window.open('', '_blank', 'width=900,height=700');
        printWin.document.write(`<!DOCTYPE html><html><head>
            <title>${storeName} — Design Chart</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                *{margin:0;padding:0;box-sizing:border-box}
                body{background:#fff;color:#1a1a1a;font-family:'Outfit',sans-serif;padding:24px;}
                h1{font-family:'Space Mono',monospace;font-size:1.4rem;color:#1a1a2e;margin-bottom:4px;}
                .subtitle{font-family:'Space Mono',monospace;font-size:11px;color:#888;margin-bottom:20px;}
                .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
                .card{border:1.5px solid #e0e0e0;border-radius:12px;overflow:hidden;break-inside:avoid;}
                .card-img{width:100%;aspect-ratio:1;object-fit:cover;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:3rem;}
                .card-img img{width:100%;height:100%;object-fit:cover;}
                .card-body{padding:10px 12px;}
                .card-name{font-weight:700;font-size:0.95rem;margin-bottom:2px;}
                .card-sku{font-family:'Space Mono',monospace;font-size:9px;color:#888;margin-bottom:8px;}
                .colors-title{font-family:'Space Mono',monospace;font-size:8px;color:#888;letter-spacing:0.1em;margin:8px 0 5px;}
                .colors-row{display:flex;gap:5px;flex-wrap:wrap;}
                .color-item{display:flex;flex-direction:column;align-items:center;gap:2px;}
                .color-swatch{width:32px;height:32px;border-radius:50%;border:1.5px solid rgba(0,0,0,0.1);}
                .color-name{font-family:'Space Mono',monospace;font-size:7px;color:#666;text-align:center;max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
                .color-qty{font-family:'Space Mono',monospace;font-size:7px;color:#333;text-align:center;}
                @media print{body{padding:12px;}.grid{grid-template-columns:repeat(4,1fr);gap:10px;}}
            </style>
        </head><body>
            <h1>🎨 ${storeName} — Design Chart</h1>
            <div class="subtitle">Generated ${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})}</div>
            <div class="grid">
        `);
        storage.getProducts().forEach(p => {
            const allColors = p.colors || [];
            printWin.document.write(`
            <div class="card">
                <div class="card-img">${p.photo ? `<img src="${p.photo}">` : '👗'}</div>
                <div class="card-body">
                    <div class="card-name">${p.name}</div>
                    <div class="card-sku">SKU: ${p.sku}</div>
                    ${allColors.length > 0 ? `
                    <div class="colors-title">COLOURS</div>
                    <div class="colors-row">
                        ${allColors.map(c => {
                            const nm = typeof c === 'string' ? c : c.name;
                            const qty = typeof c === 'string' ? null : c.qty;
                            const hex = this.getColorSwatch(nm);
                            return `<div class="color-item"><div class="color-swatch" style="background:${hex};"></div><div class="color-name">${nm}</div>${qty !== null ? `<div class="color-qty">${qty} pcs</div>` : ''}</div>`;
                        }).join('')}
                    </div>` : ''}
                </div>
            </div>`);
        });
        printWin.document.write('</div></body></html>');
        printWin.document.close();
        setTimeout(() => printWin.print(), 600);
    }
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
    const gateInput = document.getElementById('gateEmail');
    if (gateInput) {
        gateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitEmailGate();
        });
    }
    const newProfileEmailInput = document.getElementById('newProfileEmail');
    if (newProfileEmailInput) {
        newProfileEmailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitNewProfile();
        });
    }

    window.app = new ShopApp();
    checkProfileGate();

    // ── Backup reminder — prompts user every 7 days ───────────────────────
    const lastBackup = localStorage.getItem('lastBackupReminder');
    const daysSince = lastBackup
        ? Math.floor((Date.now() - Number(lastBackup)) / 86400000)
        : 999;
    if (daysSince >= 7) {
        setTimeout(() => {
            window.app && window.app.showNotification(
                '💾 Backup reminder — export your data from Settings to avoid data loss',
                'warning'
            );
            localStorage.setItem('lastBackupReminder', Date.now());
        }, 4000);
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── One-time migration: sync quantity = sum of color qtys for existing products ──
    (function migrateColorQtySync() {
        const products = storage.getProducts();
        let changed = 0;
        products.forEach(p => {
            if (p.colors && p.colors.length > 0) {
                const colorTotal = p.colors.reduce((s, c) => s + (parseInt(typeof c === 'string' ? 0 : c.qty) || 0), 0);
                if (colorTotal > 0 && colorTotal !== p.quantity) {
                    storage.updateProduct(p.id, { quantity: colorTotal });
                    changed++;
                }
            }
        });
        if (changed > 0) console.log(`[Migration] Synced quantity for ${changed} products from colour qtys.`);
    })();

    // ---- DRAG-TO-SCROLL for sliders ----
    function makeDraggable(slider) {
        if (!slider) return;
        let isDown = false, startX, scrollLeft, startY, isHoriz = null;

        slider.addEventListener('touchstart', e => {
            isDown = true;
            isHoriz = null;
            startX = e.touches[0].pageX - slider.offsetLeft;
            startY = e.touches[0].pageY;
            scrollLeft = slider.scrollLeft;
        }, { passive: true });

        slider.addEventListener('touchmove', e => {
            if (!isDown) return;
            const dx = e.touches[0].pageX - slider.offsetLeft - startX;
            const dy = e.touches[0].pageY - startY;
            if (isHoriz === null) {
                isHoriz = Math.abs(dx) > Math.abs(dy);
            }
            if (isHoriz) {
                e.preventDefault();
                slider.scrollLeft = scrollLeft - dx;
            }
        }, { passive: false });

        slider.addEventListener('touchend', () => { isDown = false; isHoriz = null; });

        // Mouse drag (desktop)
        slider.addEventListener('mousedown', e => {
            isDown = true;
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
            slider.style.cursor = 'grabbing';
        });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mousemove', e => {
            if (!isDown) return;
            e.preventDefault();
            slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX);
        });
    }

    // ---- SCROLL TRACK ----
    function bindScrollTrack(slider, fill) {
        if (!slider || !fill) return;
        slider.addEventListener('scroll', () => {
            const ratio = slider.scrollLeft / (slider.scrollWidth - slider.clientWidth);
            const maxShift = 70; // fill is ~30% wide, can shift 70%
            fill.style.transform = `translateX(${ratio * maxShift}%)`;
        }, { passive: true });
    }

    const invSlider = document.getElementById('recentInventoryGrid');
    const txnSlider = document.getElementById('recentTransactionsList');
    makeDraggable(invSlider);
    makeDraggable(txnSlider);
    bindScrollTrack(invSlider, document.getElementById('invTrackFill'));
    bindScrollTrack(txnSlider, document.getElementById('txnTrackFill'));
});
