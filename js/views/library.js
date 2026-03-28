import { quoteService } from '../services/quotes.js';
import { db, auth } from '../config/firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { haptics } from '../services/device.js';
import { audioService } from '../services/audio.js';
import { showModal, closeModal } from '../components/modals.js';

let activeTab = 'quotes'; // 'quotes' or 'diary'
let libraryListener = null;

export function renderLibraryView(container) {
    renderBaseLayout(container);
    switchTab(activeTab, container);
}

function renderBaseLayout(container) {
    container.innerHTML = `
        <div class="library-view fade-in" style="height: 100%; display: flex; flex-direction: column;">
            <div class="library-header" style="padding: 16px 0 24px 0; text-align: center;">
                <div class="tab-switcher" style="display: inline-flex; background: var(--surface-color); padding: 4px; border-radius: 30px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
                    <button class="tab-btn ${activeTab === 'quotes' ? 'active' : ''}" data-tab="quotes" style="padding: 8px 24px; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; transition: all 0.3s; background: ${activeTab === 'quotes' ? 'var(--primary-color)' : 'transparent'}; color: ${activeTab === 'quotes' ? 'white' : 'var(--text-secondary)'};">
                        <i class="fas fa-quote-left" style="margin-right: 8px;"></i> Quotes
                    </button>
                    <button class="tab-btn ${activeTab === 'diary' ? 'active' : ''}" data-tab="diary" style="padding: 8px 24px; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; transition: all 0.3s; background: ${activeTab === 'diary' ? 'var(--primary-color)' : 'transparent'}; color: ${activeTab === 'diary' ? 'white' : 'var(--text-secondary)'};">
                        <i class="fas fa-book" style="margin-right: 8px;"></i> Diary
                    </button>
                </div>
            </div>
            
            <div id="library-content" style="flex: 1; overflow-y: auto;">
                <!-- Content injection point -->
            </div>
        </div>
    `;

    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab === activeTab) return;
            haptics.vibrate();
            audioService.playClick();
            activeTab = tab;
            renderLibraryView(container);
        });
    });
}

function switchTab(tab, container) {
    const content = container.querySelector('#library-content');
    if (tab === 'quotes') {
        renderQuotesTab(content);
    } else {
        renderDiaryTab(content);
    }
}

// ---------------------------------------------------------
// QUOTES TAB
// ---------------------------------------------------------
function renderQuotesTab(container) {
    container.innerHTML = `
        <div class="quotes-tab fade-in" style="padding: 8px;">
            <div class="search-bar" style="margin-bottom: 24px; position:relative;">
                <input type="text" id="quote-search" placeholder="Search my saved quotes..." style="width: 100%; padding: 12px 16px 12px 44px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--surface-color); color: var(--text-primary);">
                <i class="fas fa-search" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color: var(--text-secondary);"></i>
            </div>
            <div id="quotes-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                <div class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--text-secondary);">Loading your collection...</div>
            </div>
        </div>
    `;

    const list = container.querySelector('#quotes-list');
    const searchInput = container.querySelector('#quote-search');

    if (libraryListener) libraryListener(); // Clean up

    const q = query(collection(db, "saved_quotes"), where("user_id", "==", auth.currentUser.uid));
    libraryListener = onSnapshot(q, (snapshot) => {
        const quotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const renderList = (filterText = '') => {
            const filtered = quotes.filter(q => q.text.toLowerCase().includes(filterText.toLowerCase()) || q.author.toLowerCase().includes(filterText.toLowerCase()));
            
            if (filtered.length === 0) {
                list.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--text-secondary); border: 2px dashed var(--border-color); border-radius: 12px;">No quotes found. Save some from the dashboard!</div>`;
                return;
            }

            list.innerHTML = filtered.sort((a,b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).map(quote => `
                <div class="quote-card fade-in" style="background: var(--surface-color); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); position:relative; min-height: 140px; display:flex; flex-direction:column; justify-content:space-between; transition: transform 0.2s;">
                    <style>
                        .quote-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
                    </style>
                    <div style="margin-bottom: 12px;">
                        <p style="font-style: italic; color: var(--text-primary); margin-bottom: 8px;">"${quote.text}"</p>
                        <cite style="font-size: 0.85rem; color: var(--text-secondary);">- ${quote.author}</cite>
                    </div>
                    <div style="display:flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-icon btn-pin" data-id="${quote.id}" data-pinned="${quote.is_pinned}" style="width:32px; height:32px; font-size: 0.85rem; background: ${quote.is_pinned ? 'rgba(99,102,241,0.1)' : 'transparent'}; color: ${quote.is_pinned ? 'var(--primary-color)' : 'var(--text-secondary)'};">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="btn-icon btn-copy" data-text="${quote.text} - ${quote.author}" style="width:32px; height:32px; font-size: 0.85rem; background:transparent;">
                            <i class="far fa-copy"></i>
                        </button>
                        <button class="btn-icon btn-delete-quote" data-id="${quote.id}" style="width:32px; height:32px; font-size: 0.85rem; background:transparent; color: var(--danger-color);">
                            <i class="far fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            // Listeners
            list.querySelectorAll('.btn-pin').forEach(btn => btn.addEventListener('click', () => {
                haptics.vibrate();
                const isPinned = btn.getAttribute('data-pinned') === 'true';
                updateDoc(doc(db, "saved_quotes", btn.getAttribute('data-id')), { is_pinned: !isPinned });
            }));
            list.querySelectorAll('.btn-copy').forEach(btn => btn.addEventListener('click', () => {
                haptics.vibrate();
                navigator.clipboard.writeText(btn.getAttribute('data-text'));
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i>', 2000);
            }));
            list.querySelectorAll('.btn-delete-quote').forEach(btn => btn.addEventListener('click', () => {
                haptics.vibrate();
                if(confirm("Delete this quote?")) {
                    deleteDoc(doc(db, "saved_quotes", btn.getAttribute('data-id')));
                }
            }));
        };

        renderList(searchInput.value);
        searchInput.oninput = (e) => renderList(e.target.value);
    });
}

// ---------------------------------------------------------
// DIARY TAB
// ---------------------------------------------------------
function renderDiaryTab(container) {
    container.innerHTML = `
        <div class="diary-tab fade-in" style="height: 100%; display: flex; flex-direction: column;">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 0 8px;">
                <h3 style="color: var(--text-primary); margin:0;">Personal Diary</h3>
                <button class="btn btn-primary" id="btn-new-diary" style="padding: 8px 16px; border-radius: 20px;">
                    <i class="fas fa-plus"></i> Write Entry
                </button>
            </div>
            
            <div id="diary-list" style="display: flex; flex-direction: column; gap: 12px; padding: 0 8px;">
                <!-- List of diaries -->
            </div>
        </div>
    `;

    const list = container.querySelector('#diary-list');
    
    if (libraryListener) libraryListener(); // Clean up

    const q = query(collection(db, "diaries"), where("user_id", "==", auth.currentUser.uid));
    libraryListener = onSnapshot(q, (snapshot) => {
        const diaries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (diaries.length === 0) {
            list.innerHTML = `<div class="text-center" style="padding: 60px 20px; border: 2px dashed var(--border-color); border-radius: 20px; color: var(--text-secondary);">Your history is a blank page. Start writing today!</div>`;
        } else {
            list.innerHTML = diaries.sort((a,b) => {
                // Pin priority first, then date
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return (b.created_at || 0) - (a.created_at || 0);
            }).map(d => `
                <div class="diary-card fade-in" data-id="${d.id}" style="background: var(--surface-color); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color); display:flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;">
                    <div style="display:flex; align-items: center; gap: 16px; flex: 1;">
                        <div style="width: 44px; height: 44px; background: rgba(99,102,241,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                            <i class="fas ${d.is_locked ? 'fa-lock' : 'fa-feather'}"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0; color: var(--text-primary); font-size: 1rem;">${d.title || 'Untitled Entry'}</h4>
                            <small style="color: var(--text-secondary);">${new Date(d.created_at?.toMillis() || Date.now()).toLocaleDateString()}</small>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <button class="btn-pin-diary btn-icon" data-id="${d.id}" data-pinned="${d.is_pinned}" style="background:transparent; box-shadow:none; width:32px; height:32px; color: ${d.is_pinned ? 'var(--primary-color)' : 'var(--border-color)'};">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <i class="fas fa-chevron-right" style="color: var(--border-color);"></i>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.btn-pin-diary').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Don't open editor
                    haptics.vibrate();
                    const isPinned = btn.getAttribute('data-pinned') === 'true';
                    updateDoc(doc(db, "diaries", btn.getAttribute('data-id')), { is_pinned: !isPinned });
                });
            });

            list.querySelectorAll('.diary-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.getAttribute('data-id');
                    const entry = diaries.find(x => x.id === id);
                    if (entry.is_locked) {
                        openPinModal(entry);
                    } else {
                        openDiaryEditor(entry);
                    }
                });
            });
        }
    });

    container.querySelector('#btn-new-diary').addEventListener('click', () => {
        openDiaryEditor(null);
    });
}

function openDiaryEditor(entry) {
    const mainContent = document.querySelector('#library-content');
    const isNew = !entry;
    
    mainContent.innerHTML = `
        <div class="diary-editor fade-in" style="height: 100%; display: flex; flex-direction: column; padding: 16px;">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <button id="btn-back-to-library" class="btn-icon" style="background:transparent; box-shadow:none;"><i class="fas fa-arrow-left"></i></button>
                <div style="display:flex; gap: 8px;">
                    <button class="btn-icon" id="btn-lock-toggle" title="Password Lock" style="background: ${entry?.is_locked ? 'rgba(239,68,68,0.1)' : 'transparent'}; color: ${entry?.is_locked ? 'var(--danger-color)' : 'var(--text-secondary)'};">
                        <i class="fas ${entry?.is_locked ? 'fa-lock' : 'fa-lock-open'}"></i>
                    </button>
                    ${!isNew ? `<button class="btn-icon" id="btn-delete-diary" style="background:transparent; color: var(--danger-color);"><i class="far fa-trash-alt"></i></button>` : ''}
                    <button class="btn btn-primary" id="btn-save-diary" style="padding: 8px 20px; border-radius: 20px;">Save</button>
                </div>
            </div>
            
            <input type="text" id="diary-title" value="${entry?.title || ''}" placeholder="Entry Title..." style="background:transparent; border:none; border-bottom: 1px solid var(--border-color); font-size: 1.5rem; font-weight: 700; color: var(--text-primary); padding: 8px 0; margin-bottom: 16px; width: 100%; outline: none;">
            
            <textarea id="diary-body" placeholder="Start writing your thoughts..." style="flex: 1; background: transparent; border: none; resize: none; font-size: 1.1rem; color: var(--text-primary); line-height: 1.6; outline: none;">${entry?.content || ''}</textarea>
            
            <div style="margin-top: 16px; display:flex; gap: 12px; font-size: 0.8rem; color: var(--text-secondary);">
                <span>Created: ${entry ? new Date(entry.created_at?.toMillis()).toLocaleString() : 'Now'}</span>
                ${entry?.updated_at ? `<span>Updated: ${new Date(entry.updated_at?.toMillis()).toLocaleString()}</span>` : ''}
            </div>
        </div>
    `;

    document.querySelector('#btn-back-to-library').addEventListener('click', () => {
        haptics.vibrate();
        renderDiaryTab(mainContent);
    });

    let pendingPin = entry?.pin || '';
    let isLocked = entry?.is_locked || false;

    document.querySelector('#btn-lock-toggle').addEventListener('click', () => {
        haptics.vibrate();
        const html = `
            <div class="modal-body" style="text-align:center;">
                <i class="fas fa-key fa-2x" style="color:var(--primary-color); margin-bottom:16px;"></i>
                <h3 style="margin-bottom:8px;">Set PIN Lock</h3>
                <p style="color:var(--text-secondary); margin-bottom:20px;">Enter a 4-digit PIN to secure this entry.</p>
                <input type="password" id="new-pin-input" maxlength="4" style="font-size: 2rem; width: 140px; text-align: center; border: 2px solid var(--border-color); border-radius: 12px; background: var(--bg-color); color: var(--text-primary); padding: 8px;">
                <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:12px;">Leave empty and click 'Save' to remove lock.</p>
                <div style="display:flex; gap:12px; margin-top:24px;">
                    <button class="btn btn-secondary btn-close" style="flex:1;">Cancel</button>
                    <button class="btn btn-primary" id="btn-set-pin" style="flex:1;">Save PIN</button>
                </div>
            </div>`;
        
        showModal(html, (modalNode) => {
            const input = modalNode.querySelector('#new-pin-input');
            input.value = pendingPin;
            input.focus();
            modalNode.querySelector('#btn-set-pin').addEventListener('click', () => {
                const pinValue = input.value;
                if (pinValue === "") {
                    isLocked = false;
                    pendingPin = "";
                    updateLockUI(false);
                    closeModal();
                } else if (pinValue.length === 4 && !isNaN(pinValue)) {
                    isLocked = true;
                    pendingPin = pinValue;
                    updateLockUI(true);
                    closeModal();
                } else {
                    alert("PIN must be 4 digits.");
                }
            });
        });
    });

    function updateLockUI(locked) {
        const btn = document.querySelector('#btn-lock-toggle');
        if(!btn) return;
        btn.style.background = locked ? 'rgba(239,68,68,0.1)' : 'transparent';
        btn.style.color = locked ? 'var(--danger-color)' : 'var(--text-secondary)';
        btn.innerHTML = `<i class="fas ${locked ? 'fa-lock' : 'fa-lock-open'}"></i>`;
    }

    if (!isNew) {
        document.querySelector('#btn-delete-diary').addEventListener('click', async () => {
            if(confirm("Permanently delete this entry?")) {
                haptics.vibrate();
                await deleteDoc(doc(db, "diaries", entry.id));
                renderDiaryTab(mainContent);
            }
        });
    }

    document.querySelector('#btn-save-diary').addEventListener('click', async () => {
        haptics.vibrate();
        audioService.playSuccess();
        const title = document.querySelector('#diary-title').value.trim();
        const content = document.querySelector('#diary-body').value.trim();
        
        const diaryData = {
            user_id: auth.currentUser.uid,
            title,
            content,
            is_locked: isLocked,
            pin: pendingPin,
            updated_at: serverTimestamp()
        };

        if (isNew) {
            diaryData.created_at = serverTimestamp();
            await addDoc(collection(db, "diaries"), diaryData);
        } else {
            await updateDoc(doc(db, "diaries", entry.id), diaryData);
        }
        
        renderDiaryTab(mainContent);
    });
}

function openPinModal(entry) {
    const html = `
        <div class="modal-body" style="text-align:center; padding-top:24px;">
            <i class="fas fa-lock fa-3x" style="color:var(--primary-color); margin-bottom:16px;"></i>
            <h3>Locked Entry</h3>
            <p style="color:var(--text-secondary); margin-bottom:24px;">Enter the 4-digit PIN to read this diary.</p>
            <input type="password" id="diary-pin-input" maxlength="4" style="font-size: 2rem; width: 140px; text-align: center; border: 2px solid var(--border-color); border-radius: 12px; background: var(--bg-color); color: var(--text-primary); padding: 8px;">
            <div id="pin-error" style="color: var(--danger-color); margin-top: 12px; height: 20px;"></div>
            <div style="display:flex; gap:12px; margin-top:24px;">
                <button class="btn btn-secondary btn-close" style="flex:1;">Cancel</button>
                <button class="btn btn-primary" id="btn-verify-pin" style="flex:1;">Unlock</button>
            </div>
        </div>
    `;
    showModal(html, (modalNode) => {
        const input = modalNode.querySelector('#diary-pin-input');
        input.focus();
        
        modalNode.querySelector('#btn-verify-pin').addEventListener('click', () => {
            if (input.value === entry.pin) {
                haptics.success();
                closeModal();
                openDiaryEditor(entry);
            } else {
                haptics.error();
                modalNode.querySelector('#pin-error').textContent = "Incorrect PIN!";
                input.value = "";
                input.focus();
            }
        });
    });
}
