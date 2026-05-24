// ============================================
// js/utils.js — Shared helpers
// Used by all other modules
// ============================================

/**
 * Safely escape user input before inserting into innerHTML.
 * Use this on ANY data that came from a user (names, SKUs, descriptions, etc.)
 * Prevents XSS attacks.
 */
function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

/**
 * Show a toast notification at the bottom of the screen.
 * @param {string} message
 * @param {'success'|'error'|'warning'} type
 */
function showNotification(message, type = 'success') {
    const existing = document.getElementById('globalNotification');
    if (existing) existing.remove();

    const n = document.createElement('div');
    n.id = 'globalNotification';
    n.className = `notification ${type}`;
    n.textContent = message;
    document.body.appendChild(n);

    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

/**
 * Format a number as Indian rupees.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toFixed(0);
}

/**
 * Format an ISO date string for display in en-IN locale.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

/**
 * Generate a simple unique ID.
 * Combines timestamp + random suffix to avoid collisions on rapid calls.
 * @returns {string}
 */
function generateId() {
    return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

/**
 * Backup reminder — shows a toast every 7 days prompting the user to export data.
 * Call once after app boots.
 */
function checkBackupReminder() {
    const lastBackup = localStorage.getItem('lastBackupReminder');
    const daysSince = lastBackup
        ? Math.floor((Date.now() - Number(lastBackup)) / 86400000)
        : 999;

    if (daysSince >= 7) {
        setTimeout(() => {
            showNotification('💾 Backup reminder — export your data from Settings to avoid data loss', 'warning');
            localStorage.setItem('lastBackupReminder', Date.now());
        }, 4000);
    }
}
