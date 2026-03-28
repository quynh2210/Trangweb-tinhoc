import { db, auth } from '../config/firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { haptics } from '../services/device.js';
import { socialService } from '../services/social.js';
import { socialStreakService } from '../services/socialStreak.js';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

export function renderStreakView(container) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    
    // Header setup
    container.innerHTML = `
        <div class="streak-view fade-in" style="padding-bottom: 40px;">
            <div class="streak-tabs" style="display:flex; margin-bottom: 24px; border-bottom: 2px solid var(--border-color); position:sticky; background:var(--bg-color); z-index:10; padding-top:8px;">
                <div class="streak-tab active" data-tab="personal" style="flex:1; text-align:center; padding: 12px; font-weight:800; color: var(--primary-color); border-bottom: 4px solid var(--primary-color); cursor:pointer; text-transform:uppercase; letter-spacing:1px;">Personal</div>
                <div class="streak-tab" data-tab="friends" style="flex:1; text-align:center; padding: 12px; font-weight:800; color: var(--text-secondary); cursor:pointer; text-transform:uppercase; letter-spacing:1px; opacity:0.6;">Friends</div>
            </div>

            <div id="streak-tab-content">
                </div>
        </div>
    `;

    const tabs = container.querySelectorAll('.streak-tab');
    const content = container.querySelector('#streak-tab-content');

    // Khởi tạo tab cá nhân mặc định
    renderPersonalTab(content, userRef);

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            haptics.vibrate();
            const tabName = tab.getAttribute('data-tab');
            
            tabs.forEach(t => {
                const isActive = t.getAttribute('data-tab') === tabName;
                t.classList.toggle('active', isActive);
                t.style.color = isActive ? 'var(--primary-color)' : 'var(--text-secondary)';
                t.style.borderBottom = isActive ? '4px solid var(--primary-color)' : 'none';
                t.style.opacity = isActive ? '1' : '0.6';
            });

            if (tabName === 'friends') {
                content.innerHTML = `<div class="loading-spinner" style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>`;
                
                socialService.getFriendships(async (friendships) => {
                    const activeFriends = friendships.filter(f => f.status === 'accepted');
                    if (activeFriends.length === 0) {
                        content.innerHTML = `
                            <div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
                                <i class="fas fa-user-friends fa-3x" style="margin-bottom: 16px; opacity:0.3;"></i>
                                <h3>No Social Streaks yet!</h3>
                                <p>Add friends and stay active together to build streaks.</p>
                            </div>`;
                        return;
                    }

                    let listHtml = `<div style="display:flex; flex-direction:column; gap:12px; padding: 4px;">`;
                    for (const f of activeFriends) {
                        const streakData = await socialStreakService.getStreakData(f.id);
                        const count = streakData?.streak_count || 0;
                        const iconData = socialStreakService.getStreakIcon(streakData, auth.currentUser.uid);
                        
                        listHtml += `
                            <div style="background:var(--surface-color); padding: 16px; border-radius: 20px; border: 1px solid var(--border-color); display:flex; align-items:center; gap:16px;">
                                <div style="width:48px; height:48px; border-radius:50%; background:var(--bg-color); display:flex; align-items:center; justify-content:center; border:2px solid var(--primary-color); overflow:hidden;">
                                    ${f.otherUser.avatar_url ? `<img src="${f.otherUser.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fas fa-user" style="color:var(--primary-color);"></i>`}
                                </div>
                                <div style="flex:1;">
                                    <h4 style="margin:0;">${f.otherUser.username}</h4>
                                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Last active: ${f.last_message_at ? new Date(f.last_message_at.toMillis()).toLocaleDateString() : 'New friend'}</p>
                                </div>
                                <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:1.2rem; color:${iconData.color}; opacity:${iconData.opacity};">
                                    <i class="fas ${iconData.icon}"></i>
                                    <span>${count}</span>
                                </div>
                            </div>
                        `;
                    }
                    listHtml += `</div>`;
                    content.innerHTML = listHtml;
                });
            } else {
                renderPersonalTab(content, userRef);
            }
        });
    });
}

function renderPersonalTab(content, userRef) {
    content.innerHTML = `
        <div id="streak-banner" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); padding: 32px 20px; border-radius: 20px; color: white; text-align: center; margin-bottom: 32px; box-shadow: var(--shadow-lg); position:relative; overflow:hidden;">
            <div style="position:absolute; right: -20px; top: -20px; opacity: 0.2; transform: rotate(15deg);">
                <i class="fas fa-fire fa-10x"></i>
            </div>
            <div style="position:relative; z-index:1;">
                <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">STREAK SOCIETY</div>
                <h1 id="banner-streak-count" style="font-size: 3rem; margin-bottom: 4px;">... day streak</h1>
                <p id="banner-subtext" style="opacity: 0.9; font-weight: 500;">You're doing amazing!</p>
            </div>
        </div>

        <div class="calendar-card" style="background: var(--surface-color); padding: 24px; border-radius: 20px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="font-size: 1.2rem; display:flex; align-items:center; gap:8px;">
                    <i class="far fa-calendar-alt" style="color: var(--primary-color);"></i>
                    Calendar
                </h2>
                <div style="display:flex; align-items:center; gap:16px;">
                    <button class="btn-icon" id="prev-month" style="width:32px; height:32px; box-shadow:none;"><i class="fas fa-chevron-left"></i></button>
                    <span id="calendar-month-year" style="font-weight: 700; min-width: 120px; text-align: center; font-size: 1.1rem; color: var(--text-primary);">...</span>
                    <button class="btn-icon" id="next-month" style="width:32px; height:32px; box-shadow:none;"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>

            <div id="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center;"></div>

            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color); display:flex; justify-content: space-around;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:12px; height:12px; background:var(--primary-color); border-radius:50%;"></div>
                    <span style="font-size:0.85rem; color:var(--text-secondary);">Active Day</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:12px; height:12px; background:var(--secondary-color); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.5rem;"><i class="fas fa-snowflake"></i></div>
                    <span style="font-size:0.85rem; color:var(--text-secondary);">Frozen Day</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 24px; background: rgba(99, 102, 241, 0.05); padding: 20px; border-radius: 20px; border: 1px dashed var(--primary-color); display:flex; align-items:center; gap:16px;">
            <div style="width: 48px; height: 48px; background: var(--surface-color); border-radius: 12px; display:flex; align-items:center; justify-content:center; color: var(--primary-color);">
                <i class="fas fa-snowflake fa-lg"></i>
            </div>
            <div>
                <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Streak Freezes</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);"><span id="freeze-count">0</span> left this month. Resets on the 1st.</p>
            </div>
        </div>
    `;

    const grid = content.querySelector('#calendar-grid');
    const monthYear = content.querySelector('#calendar-month-year');
    const streakCount = content.querySelector('#banner-streak-count');
    const freezeBadge = content.querySelector('#freeze-count');

    onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if(streakCount) streakCount.textContent = `${data.current_streak || 0} day streak`;
        if(freezeBadge) freezeBadge.textContent = data.freezes_available ?? 3;
        if(grid && monthYear) renderCalendar(grid, monthYear, data.streak_history || []);
    });

    content.querySelector('#prev-month').addEventListener('click', () => {
        haptics.vibrate();
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderPersonalTab(content, userRef);
    });

    content.querySelector('#next-month').addEventListener('click', () => {
        haptics.vibrate();
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderPersonalTab(content, userRef);
    });
}

function renderCalendar(grid, label, history) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    label.textContent = `${months[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let html = ['S','M','T','W','T','F','S'].map(d => `<div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; padding-bottom: 8px;">${d}</div>`).join('');

    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const historyItem = history.find(h => h.date === dateStr);
        
        let style = "width: 40px; height: 40px; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; cursor: default; transition: all 0.3s; color: var(--text-primary);";
        let innerHtml = d;

        if (historyItem) {
            if (historyItem.type === 'active') {
                style += "background: var(--primary-color); color: white; box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);";
            } else if (historyItem.type === 'freeze') {
                style += "background: var(--secondary-color); color: white;";
                innerHtml = `<i class="fas fa-snowflake" style="font-size:0.7rem;"></i>`;
            }
        }

        html += `<div style="${style}">${innerHtml}</div>`;
    }

    grid.innerHTML = html;
}