import { socialService } from '../services/social.js';
import { socialStreakService } from '../services/socialStreak.js';
import { db, auth } from '../config/firebase-config.js';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, query, orderBy, limit, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { haptics } from '../services/device.js';
import { showModal, closeModal } from '../components/modals.js';

let activeFriendshipId = null;

export function renderFriendsView(container) {
    container.innerHTML = `
        <div class="friends-view fade-in">
            <div class="streak-tabs" style="display:flex; margin-bottom: 24px; border-bottom: 2px solid var(--border-color); position:sticky; top:0; background:var(--bg-color); z-index:10; padding-top:8px;">
                <div class="friend-tab active" data-tab="list" style="flex:1; text-align:center; padding: 12px; font-weight:800; color: var(--primary-color); border-bottom: 4px solid var(--primary-color); cursor:pointer; text-transform:uppercase; letter-spacing:1px;">Your Friends</div>
                <div class="friend-tab" data-tab="inbox" style="flex:1; text-align:center; padding: 12px; font-weight:800; color: var(--text-secondary); cursor:pointer; text-transform:uppercase; letter-spacing:1px; position:relative;">
                    Inbox
                    <span id="noti-badge" style="display:none; position:absolute; top:8px; right:20px; width:10px; height:10px; background:var(--danger-color); border-radius:50%; border:2px solid var(--surface-color);"></span>
                </div>
            </div>

            <div id="friends-content">
                <!-- Tab content will be rendered here -->
            </div>

        </div>
    `;

    const friendsContent = container.querySelector('#friends-content');
    const tabs = container.querySelectorAll('.friend-tab');
    const notiBadge = container.querySelector('#noti-badge');

    // Subscribe to notifications for badge
    socialService.getNotifications((notis) => {
        const hasUnread = notis.some(n => !n.is_read);
        notiBadge.style.display = hasUnread ? 'block' : 'none';
        
        // If we are currently on the Inbox tab, we might want to refresh it
        const activeTab = container.querySelector('.friend-tab.active').getAttribute('data-tab');
        if (activeTab === 'inbox') renderInbox(friendsContent, notis);
    });

    const switchTab = (tabName) => {
        tabs.forEach(t => {
            t.classList.remove('active');
            t.style.color = 'var(--text-secondary)';
            t.style.borderBottom = 'none';
        });
        const activeItem = container.querySelector(`.friend-tab[data-tab="${tabName}"]`);
        activeItem.classList.add('active');
        activeItem.style.color = 'var(--primary-color)';
        activeItem.style.borderBottom = '4px solid var(--primary-color)';

        if (tabName === 'list') {
            renderFriendList(friendsContent);
        } else {
            // Logic for Inbox
            socialService.getNotifications((notis) => {
                renderInbox(friendsContent, notis);
                socialService.markNotificationsRead();
            });
        }
    };

    tabs.forEach(tab => tab.addEventListener('click', () => {
        haptics.vibrate();
        switchTab(tab.getAttribute('data-tab'));
    }));

    // Search Friend Listener: Moved into individual tabs to avoid null errors

    // Initial load
    switchTab('list');
}

async function renderFriendList(container) {
    container.innerHTML = `
        <div style="padding: 0 16px 16px;">
            <button class="btn btn-primary" id="btn-search-friend" style="width: 100%; height: 52px; border-radius: 26px; box-shadow: var(--shadow-sm); font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; background: var(--primary-color);">
                <i class="fas fa-plus"></i> Add Friend
            </button>
            <div id="friend-list-items">
                <div class="loading-spinner" style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>
            </div>
        </div>
    `;
    
    const listItems = container.querySelector('#friend-list-items');
    container.querySelector('#btn-search-friend').addEventListener('click', openSearchModal);

    socialService.getFriendships(async (friendships) => {
        const activeFriendships = friendships.filter(f => f.status === 'accepted');

        if (activeFriendships.length === 0) {
            listItems.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
                <i class="fas fa-ghost fa-3x" style="margin-bottom: 16px; opacity:0.3;"></i>
                <p>No buddies yet. Time to recruit your team!</p>
            </div>`;
            return;
        }

        let html = '';
        for (const f of activeFriendships) {
            const streakData = await socialStreakService.getStreakData(f.id);
            const iconData = socialStreakService.getStreakIcon(streakData, auth.currentUser.uid);
            
            // Check for unread messages
            const myUid = auth.currentUser.uid;
            const lastRead = f.last_read?.[myUid]?.toMillis() || 0;
            const lastMsg = f.last_message_at?.toMillis() || 0;
            const hasUnread = lastMsg > lastRead;

            html += `
                <div class="friend-card" data-id="${f.id}" style="background:var(--surface-color); padding: 16px; border-radius: 20px; border: 1px solid var(--border-color); display:flex; align-items:center; gap:12px; cursor:pointer; transition: transform 0.2s; position:relative; margin-bottom:12px;">
                    ${hasUnread ? `<div class="unread-dot" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); width:10px; height:10px; background:var(--danger-color); border-radius:50%; border:2px solid var(--surface-color);"></div>` : ''}
                    <div style="width:52px; height:52px; background: var(--bg-color); border-radius: 50%; display:flex; align-items:center; justify-content:center; border: 2px solid var(--primary-color);">
                        ${f.otherUser.avatar_url ? `<img src="${f.otherUser.avatar_url}" style="width:100%; height:100%; border-radius:50%;">` : `<i class="fas fa-user" style="color:var(--primary-color);"></i>`}
                    </div>
                    <div style="flex:1;">
                        <h4 style="margin:0; color:var(--text-primary);">${f.otherUser.username}</h4>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                            <i class="fas ${iconData.icon}" style="color:${iconData.color}; font-size:0.8rem; opacity:${iconData.opacity};"></i>
                            <span style="font-size:0.8rem; color:var(--text-secondary); font-weight:800;">${streakData?.streak_count || 0} streak</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-chevron-right" style="color:var(--border-color);"></i>
                    </div>
                </div>
            `;
        }
        listItems.innerHTML = html;

        listItems.querySelectorAll('.friend-card').forEach(card => {
            card.addEventListener('click', () => {
                haptics.vibrate();
                const fId = card.getAttribute('data-id');
                const friendship = friendships.find(f => f.id === fId);
                openChatView(friendship);
            });
        });
    });
}

function renderInbox(container, notifications) {
    if (notifications.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
            <i class="fas fa-envelope-open fa-3x" style="margin-bottom: 16px; opacity:0.3;"></i>
            <p>Your inbox is quiet for now.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 12px;">
            ${notifications.map(n => {
                let text = "";
                let actions = "";
                if (n.type === 'friend_request') {
                    text = `<b>${n.fromUser.username}</b> sent you a friend request.`;
                    actions = `<button class="btn btn-primary btn-sm btn-accept" data-uid="${n.from_uid}" style="padding:6px 12px; font-size:0.8rem;">Accept</button>`;
                } else if (n.type === 'request_accepted') {
                    text = `<b>${n.fromUser.username}</b> accepted your friend request! 🎉`;
                } else if (n.type === 'nudge') {
                    text = `<b>${n.fromUser.username}</b> nudged you! ⚡`;
                }

                const isActioned = n.actioned || n.type === 'request_accepted';

                return `
                    <div class="noti-item" style="background:var(--surface-color); padding: 16px; border-radius: 16px; border-left: 4px solid var(--primary-color); display:flex; align-items:center; gap:12px; position:relative;">
                        ${!n.is_read ? `<div style="position:absolute; right:12px; top:12px; width:8px; height:8px; background:var(--danger-color); border-radius:50%;"></div>` : ''}
                        <div style="flex:1;">
                            <p style="margin:0; font-size:0.95rem;">${text}</p>
                            <small style="color:var(--text-secondary);">${new Date(n.timestamp?.toMillis() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${n.type === 'friend_request' ? `
                                <button class="btn ${isActioned ? 'btn-secondary' : 'btn-primary'} btn-sm btn-accept" 
                                    data-uid="${n.from_uid}" 
                                    ${isActioned ? 'disabled' : ''} 
                                    style="padding:6px 12px; font-size:0.8rem;">
                                    ${isActioned ? 'Accepted' : 'Accept'}
                                </button>
                            ` : ''}
                            <button class="btn-icon btn-delete-noti" data-id="${n.id}" style="color:var(--danger-color); background:transparent; box-shadow:none; opacity:0.6;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('') || ''}
        </div>
    `;

    container.querySelectorAll('.btn-delete-noti').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            haptics.vibrate();
            const id = btn.getAttribute('data-id');
            await socialService.deleteNotification(id);
        });
    });

    container.querySelectorAll('.btn-accept').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            haptics.success();
            const uid = btn.getAttribute('data-uid');
            btn.disabled = true;
            btn.textContent = "Adding...";
            await socialService.acceptFriendRequest(uid);
        });
    });
}

function openSearchModal() {
    const html = `
        <div class="modal-body" style="text-align:center;">
            <i class="fas fa-user-plus fa-2x" style="color:var(--primary-color); margin-bottom:16px;"></i>
            <h3>Find User</h3>
            <p style="color:var(--text-secondary); margin-bottom:20px;">Search by exact username</p>
            <div style="display:flex; gap:8px;">
                <input type="text" id="search-username-input" placeholder="e.g. quynh" style="flex:1; padding: 12px; border-radius:12px; border:2px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                <button class="btn btn-primary" id="btn-do-search" style="padding:0 20px;"><i class="fas fa-search"></i></button>
            </div>
            <div id="search-results" style="margin-top:24px; min-height:100px;"></div>
        </div>
    `;
    
    showModal(html, (modalNode) => {
        const input = modalNode.querySelector('#search-username-input');
        const results = modalNode.querySelector('#search-results');
        const btnSearch = modalNode.querySelector('#btn-do-search');

        btnSearch.addEventListener('click', async () => {
            const username = input.value.trim();
            if(!username) return;
            results.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            const user = await socialService.searchUserByUsername(username);
            
            if(!user) {
                results.innerHTML = `<p style="color:var(--text-secondary);">User not found.</p>`;
            } else {
                results.innerHTML = `
                    <div style="display:flex; align-items:center; gap:16px; padding:12px; background:var(--bg-color); border-radius:12px; text-align:left;">
                        <div style="width:48px; height:48px; border-radius:50%; background:var(--bg-color); display:flex; align-items:center; justify-content:center; border:2px solid var(--primary-color); overflow:hidden;">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fas fa-user" style="color:var(--primary-color);"></i>`}
                        </div>
                        <div style="flex:1;">
                            <h4 style="margin:0;">${user.username}</h4>
                            <small style="color:var(--text-secondary);">Level ${user.level || 1}</small>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btn-fire-request" data-uid="${user.uid}">Add</button>
                    </div>
                `;
                
                modalNode.querySelector('#btn-fire-request').addEventListener('click', async (e) => {
                    const btn = e.target;
                    btn.disabled = true;
                    btn.textContent = "Sending...";
                    const res = await socialService.sendFriendRequest(user.uid);
                    if(res && !res.success) {
                        alert(res.message);
                        btn.disabled = false;
                        btn.textContent = "Add";
                    } else {
                        btn.textContent = "Sent!";
                        setTimeout(closeModal, 1000);
                    }
                });
            }
        });
    });
}

function openChatView(friendship) {
    const viewContainer = document.querySelector('#view-container');
    socialService.markChatAsRead(friendship.id);
    
    let unsubscribeMessages = null;

    const render = async () => {
        if (unsubscribeMessages) unsubscribeMessages();
        const streakData = await socialStreakService.getStreakData(friendship.id);
        const iconData = socialStreakService.getStreakIcon(streakData, auth.currentUser.uid);
        const todayStr = new Date().toISOString().split('T')[0];
        const isMeActive = streakData?.active_states?.[auth.currentUser.uid] === todayStr;

        viewContainer.innerHTML = `
            <div class="chat-view fade-in" style="height:100%; display:flex; flex-direction:column; background:var(--bg-color);">
                <div class="chat-header" style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:12px; background:var(--surface-color); position:sticky; top:0; z-index:5;">
                    <button class="btn-icon" id="btn-close-chat" style="box-shadow:none;"><i class="fas fa-arrow-left"></i></button>
                    <div style="width:40px; height:40px; background:var(--bg-color); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid var(--primary-color);">
                       ${friendship.otherUser.avatar_url ? `<img src="${friendship.otherUser.avatar_url}" style="width:100%; height:100%; border-radius:50%;">` : `<i class="fas fa-user" style="color:var(--primary-color);"></i>`}
                    </div>
                    <div style="flex:1;">
                        <h4 style="margin:0;">${friendship.otherUser.username}</h4>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fas ${iconData.icon}" style="color:${iconData.color}; font-size:0.75rem; opacity:${iconData.opacity};"></i>
                            <small style="color:var(--text-secondary); font-weight:800;">${streakData?.streak_count || 0}</small>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm" id="btn-add-social-task" style="width:36px; height:36px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; background:rgba(99,102,241,0.05); color:var(--primary-color); border:none; box-shadow:none;" title="Create Shared Task">
                            <i class="fas fa-tasks"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm nudge-btn" id="btn-nudge" style="background:rgba(99,102,241,0.05); color:var(--primary-color); box-shadow:none; border-radius:20px; padding: 4px 12px; display:flex; align-items:center; gap:4px; font-weight:800; border:none;">
                            <i class="fas fa-bolt"></i> Nudge
                        </button>
                    </div>
                </div>

                ${!isMeActive ? `
                <div id="active-streak-bar" style="background:rgba(99,102,241,0.05); padding:12px; text-align:center; border-bottom:1px solid var(--border-color);">
                    <button class="btn btn-primary btn-sm" id="btn-social-active" style="width:100%; max-width:200px; border-radius:30px; font-weight:800; font-size:0.75rem;">
                       <i class="fas fa-fire"></i> STAY ACTIVE
                    </button>
                </div>
                ` : ''}

                <div id="chat-messages" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <!-- Messages here -->
                </div>

                <div class="chat-input" style="padding:16px; background:var(--surface-color); border-top:1px solid var(--border-color); display:flex; gap:12px;">
                    <input type="text" id="msg-input" placeholder="Type a message..." style="flex:1; padding:12px; border-radius:24px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                    <button class="btn-icon" id="btn-send-msg" style="width:48px; height:48px; border-radius:50%; background:var(--primary-color); color:white;"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        const chatMessages = viewContainer.querySelector('#chat-messages');
        const msgInput = viewContainer.querySelector('#msg-input');
        const btnSend = viewContainer.querySelector('#btn-send-msg');
        const btnNudge = viewContainer.querySelector('#btn-nudge');
        const btnActive = viewContainer.querySelector('#btn-social-active');
        const btnAddTask = viewContainer.querySelector('#btn-add-social-task');
        
        // Active Logic
        if (btnActive) {
            btnActive.addEventListener('click', async () => {
                haptics.vibrate();
                btnActive.disabled = true;
                btnActive.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ACTIVATING...`;
                const res = await socialStreakService.updateActiveState(friendship.id);
                if (res.isComplete) {
                    haptics.success();
                    alert("STREAK INCREASED! 🔥🔥");
                }
                render(); // Refresh UI
            });
        }

        // Nudge Logic
        socialService.canNudge(friendship.id).then(can => {
            if(!can) {
                btnNudge.style.opacity = '0.3';
                btnNudge.style.background = 'var(--border-color)';
                btnNudge.style.color = 'var(--text-secondary)';
            }
        });

        btnNudge.addEventListener('click', async () => {
            if (await socialService.canNudge(friendship.id)) {
                haptics.vibrate();
                await socialService.sendNudge(friendship.id, friendship.otherUser.uid);
                alert("Nudge sent! ⚡");
                btnNudge.style.opacity = '0.3';
            }
        });

        // Add Shared Task Logic
        btnAddTask.addEventListener('click', () => {
            haptics.vibrate();
            openCreateSharedTaskModal(friendship);
        });

        // Close Chat
        viewContainer.querySelector('#btn-close-chat').addEventListener('click', () => {
            if (unsubscribeMessages) unsubscribeMessages();
            haptics.vibrate();
            renderFriendsView(viewContainer);
        });

        // Send Message
        const sendMessage = async () => {
            const text = msgInput.value.trim();
            if(!text) return;
            msgInput.value = '';
            await addDoc(collection(db, "friendships", friendship.id, "messages"), {
                sender_uid: auth.currentUser.uid,
                text: text,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, "friendships", friendship.id), {
                last_message_at: serverTimestamp()
            });
        };

        btnSend.addEventListener('click', sendMessage);
        msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

        // Listen for messages
        const q = query(collection(db, "friendships", friendship.id, "messages"), orderBy("timestamp", "asc"), limit(50));
        unsubscribeMessages = onSnapshot(q, (snap) => {
            chatMessages.innerHTML = snap.docs.map(d => {
                const data = d.data();
                const isMe = data.sender_uid === auth.currentUser.uid;
                
                if (data.type === 'social_task') {
                    const t = data.task_data;
                    const isCompleted = t.status === 'completed';
                    const bg = isCompleted ? 'var(--bg-color)' : 'var(--surface-color)';
                    const opacity = isCompleted ? '0.6' : '1';
                    const border = isCompleted ? '1px solid var(--border-color)' : '2px solid var(--primary-color)';
                    
                    return `
                        <div class="social-task-card" data-msg-id="${d.id}" style="align-self: center; width: 90%; background: ${bg}; padding: 16px; border-radius: 16px; border: ${border}; opacity: ${opacity}; cursor: pointer; transition: transform 0.2s; position:relative; margin: 8px 0;">
                            ${isCompleted ? `<div style="position:absolute; right:12px; top:12px; color:var(--success-color); font-weight:800; font-size:0.7rem;"><i class="fas fa-check-circle"></i> COMPLETED</div>` : ''}
                            <h4 style="margin:0; font-size:1rem; color:${isCompleted ? 'var(--text-secondary)' : 'var(--primary-color)'};">${t.title}</h4>
                            <p style="margin:4px 0 0; font-size:0.85rem; color:var(--text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${t.detail}</p>
                            ${!isCompleted ? `<div style="margin-top:8px; font-size:0.75rem; color:var(--secondary-color); font-weight:800;"><i class="fas fa-gift"></i> ${t.reward}</div>` : ''}
                        </div>
                    `;
                }

                if (data.sender_uid === 'system') {
                    return `
                        <div style="align-self: center; font-size: 0.75rem; color: var(--text-secondary); background: rgba(99, 102, 241, 0.05); padding: 4px 12px; border-radius: 12px; margin: 4px 0; border: 1px dashed var(--border-color);">
                            ${data.text}
                        </div>
                    `;
                }

                if (!data.text) return '';
                const align = isMe ? 'flex-end' : 'flex-start';
                const bg = isMe ? 'var(--primary-color)' : 'var(--bg-color)';
                const color = isMe ? 'white' : 'var(--text-primary)';
                return `
                    <div style="align-self: ${align}; max-width: 80%; padding: 10px 14px; border-radius: 18px; background: ${bg}; color: ${color}; box-shadow: var(--shadow-sm); font-size: 0.95rem;">
                        ${data.text}
                    </div>
                `;
            }).join('');

            chatMessages.querySelectorAll('.social-task-card').forEach(card => {
                card.addEventListener('click', () => {
                    const msgId = card.getAttribute('data-msg-id');
                    const msg = snap.docs.find(doc => doc.id === msgId);
                    openSharedTaskDetailModal(msg, friendship);
                });
            });

            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    };

    render();
}

function openCreateSharedTaskModal(friendship) {
    const html = `
        <div class="modal-body" style="text-align:center; padding: 24px;">
             <div style="width: 64px; height: 64px; background: rgba(99, 102, 241, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-color); margin: 0 auto 16px;">
                <i class="fas fa-tasks fa-2x"></i>
             </div>
             <h3 style="margin-bottom: 8px;">Create Shared Task</h3>
             <p style="color:var(--text-secondary); margin-bottom:24px; font-size: 0.9rem;">Assign a quest for both of you to complete!</p>
             
             <div style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                <div>
                    <label style="display:block; font-size:0.75rem; font-weight:800; margin-bottom:4px; color:var(--text-secondary);">TASK TITLE</label>
                    <input type="text" id="shared-task-title" placeholder="e.g. Study for 1 hour" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                </div>
                <div>
                    <label style="display:block; font-size:0.75rem; font-weight:800; margin-bottom:4px; color:var(--text-secondary);">DETAILS</label>
                    <textarea id="shared-task-detail" placeholder="What needs to be done?" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border-color); background:var(--bg-color); color:var(--text-primary); height:100px; resize:none;"></textarea>
                </div>
                <div>
                    <label style="display:block; font-size:0.75rem; font-weight:800; margin-bottom:4px; color:var(--text-secondary);">REWARD</label>
                    <input type="text" id="shared-task-reward" placeholder="e.g. 100 EXP or a Coffee" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border-color); background:var(--bg-color); color:var(--text-primary);">
                </div>
             </div>
             
             <button class="btn btn-primary" id="btn-save-shared-task" style="width:100%; padding:16px; border-radius:30px; font-weight:800; margin-top:24px; box-shadow: var(--shadow-md);">
                 <i class="fas fa-plus"></i> ADD QUEST
             </button>
        </div>
    `;

    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-save-shared-task').addEventListener('click', async () => {
            const title = modalNode.querySelector('#shared-task-title').value.trim();
            const detail = modalNode.querySelector('#shared-task-detail').value.trim();
            const reward = modalNode.querySelector('#shared-task-reward').value.trim();
            
            if(!title) return;
            
            haptics.vibrate();
            await addDoc(collection(db, "friendships", friendship.id, "messages"), {
                sender_uid: auth.currentUser.uid,
                type: 'social_task',
                task_data: {
                    title,
                    detail,
                    reward,
                    status: "pending",
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp()
                },
                timestamp: serverTimestamp()
            });
            
            closeModal();
            haptics.success();
        });
    });
}

function openSharedTaskDetailModal(messageDoc, friendship) {
    const data = messageDoc.data();
    const t = data.task_data;
    const isCompleted = t.status === 'completed';

    const html = `
        <div class="modal-body" style="text-align:left; padding: 24px;">
             <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:16px;">
                <h2 style="color:var(--primary-color); margin:0; flex:1;">${t.title}</h2>
                ${isCompleted ? `<span style="background:var(--success-color); color:white; padding:4px 12px; border-radius:20px; font-size:0.65rem; font-weight:800;">COMPLETED</span>` : ''}
             </div>
             
             <p style="color:var(--text-primary); margin-bottom:24px; line-height:1.6; font-size:1rem; opacity:0.8;">${t.detail || 'No additional details.'}</p>
             
             <div style="background:rgba(99,102,241,0.05); padding:16px; border-radius:16px; margin-bottom:32px; border:1px dashed var(--secondary-color);">
                 <small style="color:var(--text-secondary); display:block; margin-bottom:4px; font-weight:800; letter-spacing:1px; font-size:0.7rem;">QUEST REWARD</small>
                 <span style="font-weight:800; color:var(--secondary-color); font-size:1.2rem; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-gift"></i> ${t.reward || 'Eternal Glory'}
                 </span>
             </div>
             
             <div style="display:flex; gap:12px;">
                 <button class="btn btn-secondary" id="btn-cancel-task" style="flex:1; border-radius:30px; font-weight:800;">Close</button>
                 ${!isCompleted ? `
                 <button class="btn btn-primary" id="btn-complete-task" style="flex:2; border-radius:30px; font-weight:800; box-shadow: var(--shadow-md);">
                     <i class="fas fa-check"></i> MARK AS DONE
                 </button>
                 ` : ''}
             </div>
        </div>
    `;

    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-cancel-task').addEventListener('click', () => {
             haptics.vibrate();
             closeModal();
        });

        if (!isCompleted) {
            modalNode.querySelector('#btn-complete-task').addEventListener('click', async () => {
                haptics.success();
                // We update the message document itself
                await updateDoc(doc(db, "friendships", friendship.id, "messages", messageDoc.id), {
                    "task_data.status": "completed",
                    "task_data.completed_by": auth.currentUser.uid,
                    "task_data.completed_at": serverTimestamp()
                });
                
                // Also add a system notification message
                await addDoc(collection(db, "friendships", friendship.id, "messages"), {
                    sender_uid: "system",
                    text: `✅ Task completed: ${t.title}`,
                    timestamp: serverTimestamp()
                });

                closeModal();
            });
        }
    });
}
