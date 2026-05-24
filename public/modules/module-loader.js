// modules/module-loader.js — Module loader and initialization

console.log('[ShopInventory] All modules loaded successfully');

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check profile gate first
    if (typeof checkProfileGate === 'function') {
        checkProfileGate();
    }
    
    // Initialize main app
    if (typeof ShopApp !== 'undefined') {
        window.app = new ShopApp();
        window.storage = storage;
    }

    // Initialize Udhaar Reminder (after app is ready)
    if (typeof UdhaarReminder !== 'undefined' && !window.udhaarReminder) {
        try {
            window.udhaarReminder = new UdhaarReminder();
            console.log('[ShopInventory] Udhaar Reminder initialized');
        } catch (error) {
            console.error('[ShopInventory] Error initializing Udhaar:', error);
        }
    }
});
