// modules/backup.js — Backup & Restore module

function openBackupModal() {
    document.getElementById('backupModal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'backupModal';
    modal.className = 'si-modal active';
    modal.innerHTML = `
        <div class="si-modal-box" style="max-width:480px;">
            <button class="si-modal-close" onclick="document.getElementById('backupModal').remove();window.app&&window.app.refreshActivePage()">×</button>
            <h2 class="si-modal-title">💾 Backup & Restore</h2>
            
            <div style="display:flex;flex-direction:column;gap:12px;">
                <!-- Export Backup -->
                <div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:16px;">
                    <div style="font-family:'Space Mono',monospace;font-size:12px;color:#00ff88;font-weight:700;margin-bottom:8px;">📤 EXPORT BACKUP</div>
                    <p style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);margin-bottom:12px;">Download all your data as a JSON file. Includes all profiles, products, invoices, customers, and settings.</p>
                    <button onclick="_downloadBackup()" style="width:100%;padding:10px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:8px;color:#00ff88;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">Download Full Backup</button>
                </div>
                
                <!-- Import Backup -->
                <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:16px;">
                    <div style="font-family:'Space Mono',monospace;font-size:12px;color:#00d4ff;font-weight:700;margin-bottom:8px;">📥 RESTORE BACKUP</div>
                    <p style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text-muted);margin-bottom:12px;">Import a previously exported backup file. This will replace all current data.</p>
                    <input type="file" id="backupFileInput" accept=".json" style="display:none;" onchange="_importBackup(this)">
                    <button onclick="document.getElementById('backupFileInput').click()" style="width:100%;padding:10px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:8px;color:#00d4ff;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">Select Backup File</button>
                </div>
                
                <!-- Warning -->
                <div style="background:rgba(255,68,68,0.06);border:1px solid rgba(255,68,68,0.2);border-radius:12px;padding:12px;">
                    <div style="font-family:'Space Mono',monospace;font-size:10px;color:#ff6b6b;">⚠️ IMPORTANT: Restoring a backup will overwrite all existing data. Make sure to export your current data first!</div>
                </div>
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); window.app && window.app.refreshActivePage(); } });
}

function _downloadBackup() {
    const data = storage.exportFullBackup();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopinventory-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.app?.showNotification('Backup downloaded!', 'success');
}

function _importBackup(input) {
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const success = storage.importFullBackup(e.target.result);
            if (success) {
                window.app?.showNotification('Backup restored! Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                window.app?.showNotification('Invalid backup file', 'error');
            }
        } catch (err) {
            window.app?.showNotification('Failed to restore backup', 'error');
        }
    };
    reader.readAsText(file);
}

window.openBackupModal = openBackupModal;
console.log('[ShopInventory] Backup module loaded');
