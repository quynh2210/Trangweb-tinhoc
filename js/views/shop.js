import { db, auth } from '../config/firebase-config.js';
import { doc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showModal, closeModal } from '../components/modals.js';
import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';

export const themesDb = [
    { id: 'default', name: 'Original Light', price: 0, reqLevel: 1, icon: 'fa-sun', bg: '#f8fafc', color: '#6366f1', desc: "The clean start. Simple and effective." },
    { id: 'dark', name: 'Midnight Eclipse', price: 100, reqLevel: 1, icon: 'fa-moon', bg: '#1e293b', color: '#e94560', desc: "Embrace the mystic shadows. Dark mode for the night owls." },
    { id: 'minty', name: 'Minty Breeze', price: 200, reqLevel: 1, icon: 'fa-leaf', bg: '#f0fdfa', color: '#2dd4bf', desc: "Refreshing minty tones for a clear mind." },
    { id: 'lavender', name: 'Lavender Dream', price: 300, reqLevel: 1, icon: 'fa-wind', bg: '#faf5ff', color: '#a78bfa', desc: "Soothing purple vibes to help you focus." },
    { id: 'peach', name: 'Peach Sunset', price: 400, reqLevel: 1, icon: 'fa-cloud-sun', bg: '#fff7ed', color: '#fb923c', desc: "Warm and cozy sunset hues." },
    { id: 'rose', name: 'Rose Quartz', price: 500, reqLevel: 1, icon: 'fa-heart', bg: '#fff1f2', color: '#fb7185', desc: "Soft and elegant rose quartz palette." },
    { id: 'sky', name: 'Sky High', price: 600, reqLevel: 1, icon: 'fa-cloud', bg: '#f0f9ff', color: '#38bdf8', desc: "Clear sky blues to lift your productivity." },
    { id: 'cyber', name: 'Neon Cyber', price: 1000, reqLevel: 5, icon: 'fa-user-astronaut', bg: '#020617', color: '#06b6d4', desc: "High-voltage neon grid. The future is here.", isRare: true },
    { id: 'royal', name: 'Golden Royal', price: 1000, reqLevel: 5, icon: 'fa-chess-queen', bg: '#fffbeb', color: '#eab308', desc: "Pure gold accents for the most persistent heroes.", isRare: true }
];

let shopListener = null;

function openShopItemModal(theme, userData) {
    const isUnlocked = (userData.unlocked_themes || []).includes(theme.id);
    const isEquipped = userData.active_theme === theme.id;
    const isLevelLocked = theme.reqLevel > (userData.level || 1);
    const canAfford = (userData.exp || 0) >= theme.price;
    
    let actionBtnHtml = '';
    if (isLevelLocked) {
        actionBtnHtml = `<button class="btn btn-secondary w-100" disabled><i class="fas fa-lock"></i> Requires Level ${theme.reqLevel}</button>`;
    } else if (isEquipped) {
        actionBtnHtml = `<button class="btn btn-secondary w-100" disabled>Currently Applied</button>`;
    } else if (isUnlocked) {
        actionBtnHtml = `<button class="btn btn-primary w-100" id="btn-apply-theme" style="background:var(--success-color); border:none;"><i class="fas fa-paint-brush"></i> Apply Theme</button>`;
    } else {
        actionBtnHtml = canAfford 
            ? `<button class="btn btn-primary w-100" id="btn-buy-theme"><i class="fas fa-shopping-cart"></i> Buy for ${theme.price} EXP</button>`
            : `<button class="btn btn-secondary w-100" disabled>Insufficent EXP (${userData.exp || 0}/${theme.price})</button>`;
    }

    const html = `
        <div class="modal-header">
            <h2 style="font-size: 1.25rem;">Theme Preview</h2>
            <button class="btn-close" type="button" onclick="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" style="text-align:center;">
            <div style="background:${theme.bg}; width: 96px; height: 96px; border-radius: 50%; margin: 0 auto 24px auto; display:flex; align-items:center; justify-content:center; color:${theme.color}; border: 3px solid var(--border-color);">
                <i class="fas ${theme.icon} fa-3x"></i>
            </div>
            <h3 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 8px;">${theme.name}</h3>
            ${theme.isRare ? '<span style="background:var(--warning-color); color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem; text-transform:uppercase; font-weight:bold;">RARE</span>' : ''}
            <p style="color: var(--text-secondary); margin-top: 12px; margin-bottom: 32px; font-size: 0.95rem;">${theme.desc}</p>
            
            <div style="background: var(--bg-color); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span style="color:var(--text-secondary);">Your EXP:</span>
                    <span style="font-weight:bold; color:var(--text-primary);">${userData.exp || 0}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
                    <span style="color:var(--text-secondary);">Price:</span>
                    <span style="font-weight:bold; color:var(--danger-color);">${isUnlocked ? 'Owned' : '-' + theme.price}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-secondary);">Remaining:</span>
                    <span style="font-weight:bold; color:${canAfford ? 'var(--success-color)' : 'var(--danger-color)'};">${isUnlocked ? (userData.exp||0) : ((userData.exp||0) - theme.price)}</span>
                </div>
            </div>
            ${actionBtnHtml}
        </div>`;

    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-buy-theme')?.addEventListener('click', () => {
            haptics.vibrate();
            audioService.playClick();
            openConfirmBuyModal(theme, userData.exp);
        });

        modalNode.querySelector('#btn-apply-theme')?.addEventListener('click', async (e) => {
            haptics.vibrate();
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = "Applying...";
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { active_theme: theme.id });
                audioService.playSuccess();
                haptics.success();
                closeModal();
            } catch(err) { console.error(err); btn.disabled = false; }
        });
    });
}

function openConfirmBuyModal(theme, currentExp) {
    const html = `
        <div class="modal-body" style="text-align:center; padding-top:24px;">
            <i class="fas fa-shopping-bag fa-3x" style="color:var(--primary-color); margin-bottom:16px;"></i>
            <h3 style="margin-bottom:8px; font-size:1.4rem;">Confirm Purchase</h3>
            <p style="color:var(--text-secondary); margin-bottom:24px;">Are you sure you want to spend <b>${theme.price} EXP</b> to unlock <b style="color:${theme.color}">${theme.name}</b>?</p>
            <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary" style="flex:1;" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" id="btn-confirm-purchase" style="flex:1;">Confirm</button>
            </div>
        </div>`;

    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-confirm-purchase').addEventListener('click', async (e) => {
            haptics.vibrate();
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = "Processing...";
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    exp: currentExp - theme.price,
                    unlocked_themes: arrayUnion(theme.id),
                    active_theme: theme.id 
                });
                audioService.playEpicSuccess();
                haptics.success();
                closeModal();
            } catch(err) { console.error(err); btn.disabled = false; btn.textContent = "Error"; }
        });
    });
}

export function renderShopView(container) {
    container.innerHTML = `
        <style>
            .shop-item:hover {
                transform: translateY(-8px);
                border-color: var(--item-color) !important;
                box-shadow: var(--shadow-lg) !important;
            }
        </style>
        <div class="shop-dashboard fade-in" style="padding-bottom: 32px;">
            <div style="text-align:center; padding: 24px 0 32px 0;">
                <h1 style="font-size: 2.2rem; color: var(--primary-color); margin-bottom: 8px;">Theme Boutique</h1>
                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">Customize your interface with beautiful pastel themes.</p>
            </div>
            <div id="shop-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px;">
                <div style="text-align:center; padding: 40px; color:var(--text-secondary); grid-column: 1 / -1;">Loading inventory...</div>
            </div>
        </div>`;

    const userRef = doc(db, "users", auth.currentUser.uid);
    shopListener = onSnapshot(userRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const uData = docSnap.data();
        const grid = container.querySelector('#shop-grid');
        let html = '';
        
        themesDb.forEach(theme => {
            const isUnlocked = (uData.unlocked_themes || []).includes(theme.id);
            const isEquipped = uData.active_theme === theme.id;
            const isLevelLocked = theme.reqLevel > (uData.level || 1);
            
            let statusText = isUnlocked ? (isEquipped ? 'Equipped' : 'Owned') : `<i class="fas fa-star" style="font-size:0.8rem;"></i> ${theme.price}`;
            let opacity = isLevelLocked ? '0.7' : '1';

            html += `
                <div class="shop-item" data-id="${theme.id}" style="--item-color:${theme.color}; position:relative; background: var(--surface-color); border-radius: 20px; overflow:hidden; text-align:center; box-shadow: var(--shadow-md); cursor:pointer; opacity: ${opacity}; border: 2px solid ${isEquipped ? 'var(--primary-color)' : 'transparent'}; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); min-height: 260px; display:flex; flex-direction:column;">
                    ${isLevelLocked ? `<div style="position:absolute; inset:0; background:rgba(15, 23, 42, 0.4); z-index:2; backdrop-filter:blur(2px); display:flex; flex-direction:column; align-items:center; justify-content:center; color:white;"><i class="fas fa-lock fa-2x" style="margin-bottom:8px;"></i><b style="font-size:0.9rem;">LV ${theme.reqLevel}+</b></div>` : ''}
                    
                    <!-- Top Fill (85%) -->
                    <div style="background:${theme.bg}; flex: 0 0 75%; display:flex; align-items:center; justify-content:center; color:${theme.color}; border-bottom: 1px solid var(--border-color);">
                        <i class="fas ${theme.icon} fa-3x" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));"></i>
                    </div>

                    <!-- Bottom Info (25%) -->
                    <div style="flex: 1; display:flex; flex-direction:column; justify-content:center; padding: 10px; background: var(--surface-color);">
                        <h4 style="font-size:0.95rem; margin-bottom:4px; color:var(--text-primary); font-weight:700;">${theme.name}</h4>
                        <div style="font-size:0.85rem; font-weight:bold; color: ${isUnlocked ? 'var(--success-color)' : 'var(--warning-color)'};">
                            ${statusText}
                        </div>
                    </div>
                </div>`;
        });
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.shop-item').forEach(el => {
            el.addEventListener('click', () => {
                const theme = themesDb.find(t => t.id === el.dataset.id);
                if(theme) {
                    haptics.vibrate();
                    openShopItemModal(theme, uData);
                }
            });
        });
    });
}