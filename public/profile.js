// ============================================
// js/profile.js — Profile system, login gate,
// user menu, account switching
// ============================================

function initProfileSystem() {
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
    if (localStorage.getItem('activeProfile') === profileId) {
        localStorage.removeItem('activeProfile');
    }
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
        document.getElementById('emailGate').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('profileScreen').style.display = 'none';
    } else if (active && profiles.find(p => p.id === active)) {
        const p = profiles.find(pr => pr.id === active);
        storage.switchUser(active);
        showMainApp(p.email, p);
        if (window.app) {
            window.app.updateDashboard();
            window.app.changePage('dashboard');
        }
    } else {
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
    const label = (p.avatar || '👤') + ' ' + (p.name || email);

    const chip = document.getElementById('userEmailChip');
    if (chip) {
        chip.textContent = label;
        chip.onclick = () => showUserMenu(p, chip);
        chip.style.cursor = 'pointer';
        chip.title = 'Account options';
    }

    const mobileBtn = document.getElementById('mobileAccountBtn');
    if (mobileBtn) {
        mobileBtn.textContent = (p.avatar || '👤') + ' ' + (p.name || email).split(' ')[0];
    }

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
            <div style="font-weight:700;color:var(--text-light);font-size:0.9rem;">${esc(profile.avatar || '👤')} ${esc(profile.name || profile.email)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">${esc(profile.email)}</div>
        </div>
        ${profiles.length > 1 ? `<button onclick="document.getElementById('userMenuDropdown')?.remove();showProfileScreen();" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:var(--text-light);font-size:0.85rem;cursor:pointer;border-radius:8px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">🔄 Switch Account</button>` : ''}
        <button onclick="document.getElementById('userMenuDropdown')?.remove();showProfileScreen();setTimeout(()=>showAddProfileForm(),50);" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:var(--text-light);font-size:0.85rem;cursor:pointer;border-radius:8px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">➕ Add New Account</button>
        <div style="border-top:1px solid var(--border);margin:0.4rem 0;"></div>
        <button onclick="document.getElementById('userMenuDropdown')?.remove();logoutProfile();" style="width:100%;text-align:left;padding:0.55rem 0.75rem;background:none;border:none;color:#f87171;font-size:0.85rem;cursor:pointer;border-radius:8px;font-weight:600;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">🚪 Logout</button>
    `;
    document.body.appendChild(menu);
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
