import { authService } from '../services/auth.js';
import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';
import { renderTasksView } from './tasks.js';
import { renderShopView } from './shop.js';
import { renderLibraryView } from './library.js';
import { renderStreakView } from './streak.js';
import { renderFriendsView } from './friends.js';
import { socialService } from '../services/social.js';
import { streakService } from '../services/streak.js';
import { openStreakClaimModal } from '../components/modals.js';
import { renderSettingsView } from './settings.js';

export async function renderHome(container) {
    container.innerHTML = `
        <div class="app-layout fade-in">
            <!-- Sidebar / Top Nav (Desktop) or Bottom Nav (Mobile) -->
            <nav class="main-nav">
                <div class="nav-brand desktop-flex">
                    <div class="nav-brand-logo">
                        <i class="fas fa-sparkles"></i>
                    </div>
                </div>
                
                <div class="nav-links">
                    <button class="nav-item active" data-view="tasks" title="Quests">
                        <i class="fas fa-home"></i>
                    </button>
                    <button class="nav-item" data-view="streak" title="My Streak">
                        <i class="fas fa-fire"></i>
                    </button>
                    <button class="nav-item" data-view="friends" title="Buddies" style="position:relative;">
                        <i class="fas fa-user-friends"></i>
                        <span id="nav-noti-dot" style="display:none; position:absolute; top:8px; right:8px; width:8px; height:8px; background:var(--danger-color); border-radius:50%; border:1px solid var(--surface-color);"></span>
                    </button>
                    <button class="nav-item desktop-only" data-view="shop" title="Shop">
                        <i class="fas fa-store"></i>
                    </button>
                    <button class="nav-item" data-view="library" title="Library">
                        <i class="fas fa-book"></i>
                    </button>
                </div>
                
                <div class="nav-footer desktop-flex">
                    <button class="nav-item" data-view="settings" id="btn-settings" title="Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </nav>
            
            <!-- Main Content Area -->
            <main class="main-content">
                <header class="content-header mobile-flex">
                    <!-- Shop and Settings top 2 sides for Mobile -->
                    <button class="btn-icon" data-view="shop" id="btn-mobile-shop" title="Shop">
                        <i class="fas fa-store"></i>
                    </button>
                    <div class="nav-brand-logo" style="width:40px; height:40px; font-size:1.2rem;">
                         <i class="fas fa-sparkles"></i>
                    </div>
                    <button class="btn-icon" data-view="settings" id="btn-mobile-settings" title="Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                </header>
                
                <div id="view-container" class="view-content">
                    <!-- Views render here -->
                </div>
            </main>
        </div>
    `;

    const viewContainer = container.querySelector('#view-container');
    
    // Check Streak on Load
    (async () => {
        const streakStatus = await streakService.checkStreakStatus();
        if (streakStatus && streakStatus.needsClaim) {
            openStreakClaimModal(streakStatus.currentStreak);
        }
    })();

    // Load default view
    renderTasksView(viewContainer);

    // Listen for notifications for the Nav Badge
    socialService.getNotifications((notis) => {
        const hasUnreadInbox = notis.some(n => !n.is_read);
        
        // Also listen for unread chats
        socialService.getFriendships((friendships) => {
            const myUid = auth.currentUser.uid;
            const hasUnreadChat = friendships.some(f => {
                const lastRead = f.last_read?.[myUid]?.toMillis() || 0;
                const lastMsg = f.last_message_at?.toMillis() || 0;
                return lastMsg > lastRead;
            });

            const hasAnything = hasUnreadInbox || hasUnreadChat;
            const dot = container.querySelector('#nav-noti-dot');
            const mDot = container.querySelector('#mobile-noti-dot');
            if(dot) dot.style.display = hasAnything ? 'block' : 'none';
            if(mDot) mDot.style.display = hasAnything ? 'block' : 'none';
        });
    });

    // Event Listeners for Nav interactions (Include icons in mobile header)
    const navItems = container.querySelectorAll('.nav-item, .btn-icon[data-view]'); // Include mobile icons using data-view
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if(!view) return;
            
            haptics.vibrate();
            audioService.playClick();
            
            // visually update main nav buttons
            container.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            if (item.classList.contains('nav-item')) {
                item.classList.add('active');
            } else {
                // If it was a mobile top nav, we could force the corresponding bottom icon actve or just let it float
            }
            
            if (view === 'tasks') {
                renderTasksView(viewContainer);
            } else if (view === 'shop') {
                renderShopView(viewContainer);
            } else if (view === 'library') {
                renderLibraryView(viewContainer);
            } else if (view === 'streak') {
                renderStreakView(viewContainer);
            } else if (view === 'friends') {
                renderFriendsView(viewContainer);
            } else if (view === 'settings') {
                renderSettingsView(viewContainer);
            } else {
            viewContainer.innerHTML = `<div class="fade-in" style="padding: 24px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;"> 
                <div style="width: 80px; height: 80px; background: rgba(99, 102, 241, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-color); margin-bottom: 24px;"> 
                    <i class="fas fa-tools fa-2x"></i> 
                </div> 
                <h2>${view.toUpperCase()} module coming soon...</h2> 
                <p style="color: var(--text-secondary); margin-top: 12px; margin-bottom: 32px;">Stay tuned for updates.</p> 
            </div>`;
        }
        });
    });

    // Global listener for stat triggers (like clicking the fire icon)
    container.addEventListener('click', (e) => {
        const trigger = e.target.closest('.streak-trigger');
        if (trigger) {
            const view = trigger.getAttribute('data-view');
            const navBtn = container.querySelector(`.nav-item[data-view="${view}"]`);
            if (navBtn) navBtn.click();
        }
    });
}
