import { auth, db } from '../config/firebase-config.js';
import { doc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { authService } from '../services/auth.js';
import { haptics } from '../services/device.js';
import { audioService } from '../services/audio.js';
import { showModal, closeModal } from '../components/modals.js';

export function renderSettingsView(container) {
    const user = auth.currentUser;
    if (!user) return;

    container.innerHTML = `
        <div class="settings-view fade-in" style="padding: 24px; max-width: 900px; margin: 0 auto;">
            <h1 style="margin-bottom: 32px; font-weight: 800; display:flex; align-items:center; gap:12px;">
               <i class="fas fa-cog" style="color:var(--primary-color);"></i> Settings
            </h1>

            <div class="settings-layout" style="display: flex; gap: 32px; flex-wrap: wrap;">
                <!-- Profile Section -->
                <div class="settings-card profile-card" style="flex: 1; min-width: 300px; background: var(--surface-color); padding: 32px; border-radius: 24px; border: 1px solid var(--border-color); text-align: center;">
                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 20px;">
                        <div id="settings-avatar-container" style="width: 100%; height: 100%; border-radius: 50%; background: var(--bg-color); border: 4px solid var(--primary-color); overflow: hidden; display: flex; align-items: center; justify-content: center;">
                             <i class="fas fa-user fa-3x" style="color: var(--primary-color);"></i>
                        </div>
                        <label for="avatar-upload" style="position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 3px solid var(--surface-color); box-shadow: var(--shadow-sm);">
                            <i class="fas fa-camera fa-sm"></i>
                        </label>
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    </div>
                    
                    <h2 id="settings-username" style="margin: 0; font-size: 1.5rem; font-weight: 800;">...</h2>
                    <p id="settings-email" style="color: var(--text-secondary); margin: 4px 0 24px;">...</p>

                    <div id="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                         <div class="stat-box" style="padding: 12px; background: var(--bg-color); border-radius: 16px; border: 1px solid var(--primary-color); opacity: 0.8;">
                            <small style="display: block; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--primary-color);">Level</small>
                            <span id="stat-level" style="font-size: 1.2rem; font-weight: 800;">1</span>
                         </div>
                         <div class="stat-box" style="padding: 12px; background: var(--bg-color); border-radius: 16px; border: 1px solid var(--primary-color); opacity: 0.8;">
                            <small style="display: block; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--primary-color);">Streak</small>
                            <span id="stat-streak" style="font-size: 1.2rem; font-weight: 800;">0</span>
                         </div>
                         <div class="stat-box" style="padding: 12px; background: var(--bg-color); border-radius: 16px; border: 1px solid var(--primary-color); opacity: 0.8;">
                            <small style="display: block; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--primary-color);">EXP</small>
                            <span id="stat-exp" style="font-size: 1.2rem; font-weight: 800;">0</span>
                         </div>
                         <div class="stat-box" style="padding: 12px; background: var(--bg-color); border-radius: 16px; border: 1px solid var(--primary-color); opacity: 0.8;">
                            <small style="display: block; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--primary-color);">Friends</small>
                            <span id="stat-friends" style="font-size: 1.2rem; font-weight: 800;">0</span>
                         </div>
                    </div>
                </div>

                <!-- Actions Section -->
                <div style="flex: 1.5; min-width: 300px; display: flex; flex-direction: column; gap: 20px;">
                    <div style="background: var(--surface-color); padding: 24px; border-radius: 24px; border: 1px solid var(--border-color);">
                        <h3 style="margin-bottom: 20px; font-weight: 800;">Account Security</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <button class="btn btn-secondary" id="btn-change-password" style="width: 100%; justify-content: space-between; padding: 16px 20px;">
                                <span><i class="fas fa-key" style="margin-right: 12px; opacity: 0.6;"></i> Change Password</span>
                                <i class="fas fa-chevron-right fa-sm"></i>
                            </button>
                            <button class="btn btn-secondary" id="btn-logout" style="width: 100%; justify-content: space-between; padding: 16px 20px;">
                                <span><i class="fas fa-sign-out-alt" style="margin-right: 12px; opacity: 0.6;"></i> Logout</span>
                                <i class="fas fa-chevron-right fa-sm"></i>
                            </button>
                        </div>
                    </div>

                    <div style="background: rgba(239, 68, 68, 0.05); padding: 24px; border-radius: 24px; border: 1px dashed var(--danger-color);">
                        <h3 style="color: var(--danger-color); margin-bottom: 8px; font-weight: 800;">Danger Zone</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        <button class="btn btn-danger" id="btn-delete-account" style="color:red;width: 100%; padding: 14px;">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const usernameEl = container.querySelector('#settings-username');
    const emailEl = container.querySelector('#settings-email');
    const avatarContainer = container.querySelector('#settings-avatar-container');
    const fileInput = container.querySelector('#avatar-upload');
    
    const statLevel = container.querySelector('#stat-level');
    const statStreak = container.querySelector('#stat-streak');
    const statExp = container.querySelector('#stat-exp');
    const statFriends = container.querySelector('#stat-friends');

    // Load Data
    onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        
        usernameEl.textContent = data.username;
        emailEl.textContent = data.email;
        statLevel.textContent = data.level || 1;
        statStreak.textContent = data.current_streak || 0;
        statExp.textContent = data.exp || 0;

        if (data.avatar_url) {
            avatarContainer.innerHTML = `<img src="${data.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
    });

    // Count Friends
    const friendQuery = query(collection(db, "friendships"), where("uids", "array-contains", user.uid), where("status", "==", "accepted"));
    getDocs(friendQuery).then(snap => {
        statFriends.textContent = snap.size;
    });

    // Avatar Upload
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        haptics.vibrate();
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            // Crop/Resize could be done here, but for now just save
            await authService.updateUserProfile({ avatar_url: base64 });
        };
        reader.readAsDataURL(file);
    });

    // Buttons
    container.querySelector('#btn-change-password').addEventListener('click', openChangePasswordModal);
    container.querySelector('#btn-logout').addEventListener('click', openLogoutModal);
    container.querySelector('#btn-delete-account').addEventListener('click', openDeleteAccountModal);
}

function openChangePasswordModal() {
    const html = `
        <div class="modal-body" style="text-align:center;">
             <i class="fas fa-key fa-2x" style="color:var(--primary-color); margin-bottom:16px;"></i>
             <h3>Change Password</h3>
             <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px; text-align:left;">
                <input type="password" id="old-pass" placeholder="Current Password" style="padding:12px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                <input type="password" id="new-pass" placeholder="New Password (min 8 chars)" style="padding:12px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                <input type="password" id="confirm-pass" placeholder="Confirm New Password" style="padding:12px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
             </div>
             <p id="pass-error" style="color:var(--danger-color); font-size:0.8rem; margin-top:8px; min-height:16px;"></p>
             <button class="btn btn-primary" id="btn-do-change-pass" style="width:100%; margin-top:20px; padding:14px; border-radius:30px; font-weight:800;">Update Password</button>
        </div>
    `;

    showModal(html, (modalNode) => {
        const btn = modalNode.querySelector('#btn-do-change-pass');
        const oldP = modalNode.querySelector('#old-pass');
        const newP = modalNode.querySelector('#new-pass');
        const confP = modalNode.querySelector('#confirm-pass');
        const err = modalNode.querySelector('#pass-error');

        btn.addEventListener('click', async () => {
             const old = oldP.value;
             const n = newP.value;
             const c = confP.value;

             if (n !== c) { err.textContent = "Passwords don't match."; return; }
             if (n.length < 8) { err.textContent = "New password too short."; return; }

             btn.textContent = "Updating...";
             btn.disabled = true;
             const res = await authService.updateUserPassword(old, n);
             if (res.success) {
                 haptics.success();
                 closeModal();
                 alert("Password updated successfully!");
             } else {
                 haptics.error();
                 err.textContent = res.message;
                 btn.textContent = "Update Password";
                 btn.disabled = false;
             }
        });
    });
}

function openLogoutModal() {
    const html = `
        <div class="modal-body" style="text-align:center; padding: 20px;">
             <i class="fas fa-sign-out-alt fa-2x" style="color:var(--primary-color); margin-bottom:16px;"></i>
             <h3>Ready to leave?</h3>
             <p style="color:var(--text-secondary); margin-bottom:24px;">Don't worry, your streaks will be safe until tomorrow!</p>
             <div style="display:flex; gap:12px;">
                 <button class="btn btn-secondary" id="btn-cancel-logout" style="flex:1;">Stay</button>
                 <button class="btn btn-primary" id="btn-confirm-logout" style="flex:1;">Logout</button>
             </div>
        </div>
    `;
    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-cancel-logout').addEventListener('click', closeModal);
        modalNode.querySelector('#btn-confirm-logout').addEventListener('click', async () => {
            haptics.vibrate();
            await authService.logout();
            closeModal();
        });
    });
}

function openDeleteAccountModal() {
    const html = `
        <div class="modal-body" style="text-align:center; padding: 20px;">
             <i class="fas fa-exclamation-triangle fa-2x" style="color:var(--danger-color); margin-bottom:16px;"></i>
             <h3 style="color:var(--danger-color);">Delete Account?</h3>
             <p style="color:var(--text-secondary); margin-bottom:20px; font-size:0.9rem;">This will permanently wipe your profile, streaks, and data. Enter your password to confirm.</p>
             <input type="password" id="delete-confirm-pass" placeholder="Your Password" style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary); margin-bottom:12px;">
             <div style="display:flex; gap:12px;">
                 <button class="btn btn-secondary" id="btn-cancel-delete" style="flex:1;">Cancel</button>
                 <button class="btn btn-danger" id="btn-confirm-delete" style="flex:1;">Delete Me</button>
             </div>
        </div>
    `;
    showModal(html, (modalNode) => {
        const passInput = modalNode.querySelector('#delete-confirm-pass');
        modalNode.querySelector('#btn-cancel-delete').addEventListener('click', closeModal);
        modalNode.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
            const pass = passInput.value;
            if(!pass) return;

            haptics.vibrate();
            const res = await authService.deleteUserAccount(pass);
            if (res.success) {
                haptics.success();
                closeModal();
            } else {
                haptics.error();
                alert(res.message);
            }
        });
    });
}
