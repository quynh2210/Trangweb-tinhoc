import { openTaskModal, openQuestModal, openTaskDetailModal, openCongratsModal } from '../components/modals.js';
import { db, auth } from '../config/firebase-config.js';
import { collection, query, where, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { quoteService } from '../services/quotes.js';
import { haptics } from '../services/device.js';
import { audioService } from '../services/audio.js';

let deadlineTimer = null;
let currentQuests = [];
let currentTasks = [];
let listContainerElement = null;

// Toggles for viewing all tasks in a quest block
let expandedQuests = new Set();
let collapsedQuests = new Set();

export function renderTasksView(container) {
    container.innerHTML = `
        <div class="tasks-dashboard fade-in">
            <!-- Header Stats -->
            <div class="dashboard-stats" style="display:flex; gap:12px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center;">
                <div class="stat-badge" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; box-shadow: var(--shadow-sm);">
                    Lv. <span id="ui-level">1</span>
                </div>
                <div class="stat-badge" style="background: var(--surface-color); padding: 8px 16px; border-radius: 20px; font-weight: 600; border: 1px solid var(--border-color); display: flex; align-items:center; gap:8px;">
                    <i class="fas fa-star" style="color: var(--warning-color);"></i> <span id="ui-exp">0 / 100</span> EXP
                </div>
                <div class="stat-badge streak-trigger" style="background: var(--surface-color); padding: 8px 16px; border-radius: 20px; font-weight: 600; border: 1px solid var(--border-color); display: flex; align-items:center; gap:8px; cursor:pointer;" data-view="streak">
                    <i class="fas fa-fire" style="color: var(--danger-color);"></i> <span id="ui-streak">0</span> Days
                </div>
            </div>

            <!-- New Quote Widget -->
            <div id="daily-quote-container" class="fade-in" style="background: var(--surface-color); padding: 20px; border-radius: var(--border-radius-lg); margin-bottom: 32px; border: 1px dashed var(--border-color); position:relative; min-height: 100px; display:flex; flex-direction:column; justify-content:center;">
                <div id="quote-content" style="text-align:center;">
                    <p style="font-style: italic; color: var(--text-primary); margin-bottom: 8px; font-size: 1.05rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" id="quote-text">"Loading inspiration..."</p>
                    <cite style="font-size: 0.85rem; color: var(--text-secondary); display:block;" id="quote-author">- ...</cite>
                </div>
                <button id="btn-save-quote" class="btn-icon" style="position:absolute; top:8px; right:8px; width:32px; height:32px; font-size:0.9rem; box-shadow:none; background:transparent;">
                    <i class="far fa-bookmark"></i>
                </button>
            </div>

            <div class="flex-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
                <h2 style="font-size: 1.5rem; color: var(--text-primary);">Quest Board</h2>
                <div style="display:flex; gap: 8px;">
                    <button class="btn btn-secondary" id="btn-new-task" style="padding: 10px 16px;">
                        <i class="fas fa-plus"></i> Task
                    </button>
                    <button class="btn btn-primary" id="btn-new-quest" style="padding: 10px 16px;">
                        <i class="fas fa-folder-plus"></i> Quest
                    </button>
                </div>
            </div>
            
            <div id="quests-list" style="display:flex; flex-direction:column; gap: 24px;">
                <div class="text-center fade-in" style="text-align:center; padding: 40px; color: var(--text-secondary);">Loading...</div>
            </div>
        </div>
    `;

    listContainerElement = container.querySelector('#quests-list');

    container.querySelector('#btn-new-task').addEventListener('click', () => openTaskModal('general'));
    container.querySelector('#btn-new-quest').addEventListener('click', () => openQuestModal());

    // Load Quote
    loadDailyQuote(container);

    // Listen to Quests
    const qQuests = query(collection(db, "quests"), where("user_id", "==", auth.currentUser.uid), where("status", "==", "active"));
    onSnapshot(qQuests, (snapshot) => {
        currentQuests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        buildDashboardUI();
    }, (error) => {
        console.error("Firestore Quests Error:", error);
        if(listContainerElement) listContainerElement.innerHTML = `<div class="text-danger" style="padding:24px; text-align:center;"><i class="fas fa-exclamation-triangle"></i> Database Error: ${error.message} - Please check Firebase Security Rules.</div>`;
    });

    // Listen to User Stats
    const userRef = doc(db, "users", auth.currentUser.uid);
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
           const userData = docSnap.data();
           const exp = userData.exp || 0;
           const level = userData.level || 1;
           const streak = userData.current_streak || 0;
           
           const uiLevel = container.querySelector('#ui-level');
           const uiExp = container.querySelector('#ui-exp');
           const uiStreak = container.querySelector('#ui-streak');
           
           // T(n) = 10n^2 + 90n
           const expNeeded = 10 * Math.pow(level, 2) + 90 * level;

           if(uiLevel) uiLevel.textContent = level;
           if(uiExp) uiExp.textContent = `${exp} / ${expNeeded}`;
           if(uiStreak) uiStreak.textContent = streak;
        }
    });

    // Listen to Tasks
    const qTasks = query(collection(db, "tasks"), where("user_id", "==", auth.currentUser.uid), where("status", "==", "pending"));
    onSnapshot(qTasks, (snapshot) => {
        currentTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        buildDashboardUI();
    }, (error) => {
        console.error("Firestore Tasks Error:", error);
        if(listContainerElement) listContainerElement.innerHTML = `<div class="text-danger" style="padding:24px; text-align:center;"><i class="fas fa-exclamation-triangle"></i> Database Error: ${error.message} - Please check Firebase Security Rules.</div>`;
    });
}

function buildDashboardUI() {
    if(!listContainerElement) return;

    if (currentTasks.length === 0 && currentQuests.length === 0) {
        listContainerElement.innerHTML = `
            <div class="empty-state fade-in" style="text-align:center; padding: 48px 16px; border: 2px dashed var(--border-color); border-radius: var(--border-radius-lg);">
                <div style="width: 64px; height: 64px; background: rgba(99, 102, 241, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-color); margin: 0 auto 16px auto;">
                    <i class="fas fa-compass fa-2x"></i>
                </div>
                <h3 style="margin-bottom: 8px;">Your Board is Empty</h3>
                <p style="color: var(--text-secondary);">Start your journey by creating a Quest folder or a Task.</p>
            </div>
        `;
        return;
    }

    const qPrioMap = { "high": 3, "med": 2, "low": 1 };
    
    // Sort Quests
    let sortedQuests = [...currentQuests].sort((a,b) => {
        return (qPrioMap[b.priority] || 0) - (qPrioMap[a.priority] || 0);
    });

    // Sort Tasks
    let sortedTasks = [...currentTasks].sort((a,b) => {
        const pa = qPrioMap[a.priority] || 0;
        const pb = qPrioMap[b.priority] || 0;
        if (pa !== pb) return pb - pa;
        
        const dateA = a.created_at ? a.created_at.toMillis() : 0;
        const dateB = b.created_at ? b.created_at.toMillis() : 0;
        return dateB - dateA;
    });

    // 2. Group by quest_id
    const groups = { "general": [] };
    sortedTasks.forEach(t => {
        const qId = t.quest_id || "general";
        if(!groups[qId]) groups[qId] = [];
        groups[qId].push(t);
    });

    // 3. Build HTML blocks
    let html = '';

    const renderQuestBlock = (qObj, isGeneral = false) => {
        const qId = isGeneral ? "general" : qObj.id;
        const qName = isGeneral ? "General Board" : qObj.name;
        const tasks = groups[qId] || [];
        
        if(tasks.length === 0 && isGeneral) return;
        
        let qPrioColor = "transparent";
        let prioLabel = "";
        if(!isGeneral) {
            if(qObj.priority === 'low') { qPrioColor = "var(--success-color)"; prioLabel = "Low" }
            if(qObj.priority === 'med') { qPrioColor = "var(--warning-color)"; prioLabel = "Med" }
            if(qObj.priority === 'high') { qPrioColor = "var(--danger-color)"; prioLabel = "Epic" }
        }

        const isExpanded = expandedQuests.has(qId);
        const isCollapsed = collapsedQuests.has(qId);
        const visibleTasks = isExpanded ? tasks : tasks.slice(0, 3);
        const hiddenCount = tasks.length - visibleTasks.length;

        html += `
            <div class="quest-group fade-in" style="background: var(--surface-color); padding: 20px; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); border: 1.5px solid ${qPrioColor !== 'transparent' ? qPrioColor : 'var(--border-color)'};">
                <div class="quest-header" style="display:flex; justify-content:space-between; align-items:center; ${isCollapsed ? '' : 'margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;'}">
                    <h3 class="btn-toggle-folder" data-qid="${qId}" style="cursor:pointer; font-size: 1.15rem; color: var(--text-primary); display:flex; align-items:center; gap:8px; margin:0; flex:1;">
                        <i class="fas ${isCollapsed ? 'fa-folder' : (isGeneral ? 'fa-inbox' : 'fa-folder-open')}" style="color: ${qPrioColor !== 'transparent' ? qPrioColor : 'var(--primary-color)'};"></i> 
                        ${qName}
                        ${!isGeneral ? `<span style="font-size:0.65rem; border:1px solid ${qPrioColor}; color:${qPrioColor}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${prioLabel}</span>` : ''}
                    </h3>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size: 0.8rem; background: var(--bg-color); color:var(--text-secondary); padding: 4px 10px; border-radius: 12px; font-weight:bold;">${tasks.length}</span>
                        <button class="btn-toggle-folder btn-icon" data-qid="${qId}" style="width:32px; height:32px; background:transparent; font-size:1rem; box-shadow:none;"><i class="fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                    </div>
                </div>
        `;

        if (!isCollapsed) {
            html += `<div class="quest-tasks-list" style="display:flex; flex-direction:column; gap:10px;">`;

        if(tasks.length === 0) {
            if (!isGeneral && qObj.has_tasks === true) {
                window['__questCache_' + qId] = qObj;
                html += `
                    <div class="fade-in" style="text-align:center; padding:24px 16px; background: rgba(16, 185, 129, 0.05); border-radius: var(--border-radius-sm); border: 2px dashed rgba(16,185,129,0.3);">
                        <p style="color:var(--success-color); font-weight:600; margin-bottom:16px;">This quest has no pending tasks!</p>
                        <button class="btn" onclick="window.handleCompleteQuest('${qId}')" style="background:var(--success-color); color:white; border:none; padding:10px 16px; border-radius: var(--border-radius-md); font-weight:bold; cursor:pointer;">
                            <i class="fas fa-check-double"></i> Complete & Archive Quest
                        </button>
                    </div>
                `;
            }
        } else {
            visibleTasks.forEach(task => {
                const dl = task.deadline ? task.deadline : 0;
                let prioColor = "var(--border-color)";
                if(task.priority === 'low') prioColor = "var(--success-color)";
                if(task.priority === 'med') prioColor = "var(--warning-color)";
                if(task.priority === 'high') prioColor = "var(--danger-color)";

                // We serialize JSON directly to attribute or attach listener later.
                // Attach via global window function hook because injecting objects is tricky.
                window['__taskCache_' + task.id] = task;

                html += `
                    <div class="task-card" onclick="window.handleOpenTaskDetail('${task.id}')" style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all var(--transition-fast); border-left: 4px solid ${prioColor};">
                        <h4 style="font-size: 1rem; color: var(--text-primary); font-weight:500; margin:0;">${task.title}</h4>
                        ${dl > 0 ? `<div style="font-size: 0.85rem; color: var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="far fa-clock"></i> <span class="deadline-timer" data-time="${dl}"></span></div>` : ''}
                    </div>
                `;
            });
        }

            html += `</div>`;

            if (hiddenCount > 0) {
                html += `
                    <button class="btn-expand-quest" data-qid="${qId}" style="width:100%; margin-top:12px; background:transparent; border:1px dashed var(--border-color); color:var(--text-secondary); padding:8px; border-radius:var(--border-radius-md); cursor:pointer;">
                        View ${hiddenCount} more task(s) <i class="fas fa-chevron-down" style="margin-left:4px;"></i>
                    </button>
                `;
            } else if (isExpanded && tasks.length > 3) {
                html += `
                    <button class="btn-collapse-quest" data-qid="${qId}" style="width:100%; margin-top:12px; background:transparent; border:1px dashed var(--border-color); color:var(--text-secondary); padding:8px; border-radius:var(--border-radius-md); cursor:pointer;">
                        Show less <i class="fas fa-chevron-up" style="margin-left:4px;"></i>
                    </button>
                `;
            }
        }
        
        html += `</div>`;
    };

    sortedQuests.forEach(q => renderQuestBlock(q));
    renderQuestBlock({}, true); // Render general

    listContainerElement.innerHTML = html;

    // Attach listeners for expanding
    const btnExpands = listContainerElement.querySelectorAll('.btn-expand-quest');
    btnExpands.forEach(b => b.addEventListener('click', (e) => {
        expandedQuests.add(b.getAttribute('data-qid'));
        buildDashboardUI();
    }));

    const btnCollapses = listContainerElement.querySelectorAll('.btn-collapse-quest');
    btnCollapses.forEach(b => b.addEventListener('click', (e) => {
        expandedQuests.delete(b.getAttribute('data-qid'));
        buildDashboardUI();
    }));
    
    listContainerElement.querySelectorAll('.btn-toggle-folder').forEach(b => b.addEventListener('click', (e) => {

        const qId = b.getAttribute('data-qid');
        if(collapsedQuests.has(qId)) collapsedQuests.delete(qId);
        else collapsedQuests.add(qId);
        buildDashboardUI();
    }));
    
    // Restart Timer Logic
    if(deadlineTimer) clearInterval(deadlineTimer);
    startTimerLoop(listContainerElement);
}

window.handleCompleteQuest = (questId) => {
    const questData = window['__questCache_' + questId];
    if(questData) openCongratsModal(questData);
}

// Attach a global hook for inline html onclicks
window.handleOpenTaskDetail = (taskId) => {
    const taskData = window['__taskCache_' + taskId];
    if(taskData) {
        openTaskDetailModal(taskId, taskData);
    }
};

function startTimerLoop(container) {
    const update = () => {
        const timers = container.querySelectorAll('.deadline-timer');
        if(timers.length === 0) return;
        
        const now = Date.now();
        timers.forEach(el => {
            const time = parseInt(el.getAttribute('data-time'));
            const diff = time - now;
            
            if (diff <= 0) {
                el.textContent = "Overdue";
                el.style.color = "var(--danger-color)";
            } else {
                const hrs = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff / (1000 * 60)) % 60);
                const secs = Math.floor((diff / 1000) % 60);
                if (hrs > 24) {
                    const days = Math.floor(hrs / 24);
                    el.textContent = `${days}d ${hrs%24}h`;
                } else if (hrs > 0) {
                    el.textContent = `${hrs}h ${mins}m`;
                } else {
                    el.textContent = `${mins}m ${secs}s`;
                    el.style.color = "var(--danger-color)";
                }
            }
        });
    };
    
    update(); // first run
    deadlineTimer = setInterval(update, 1000);
}

async function loadDailyQuote(container) {
    const quoteData = await quoteService.fetchRandomQuote();
    const qText = container.querySelector('#quote-text');
    const qAuthor = container.querySelector('#quote-author');
    const btnSave = container.querySelector('#btn-save-quote');

    if (qText) qText.textContent = `"${quoteData.text}"`;
    if (qAuthor) qAuthor.textContent = `- ${quoteData.author}`;

    // Check if already saved
    const isSaved = await quoteService.isQuoteSaved(quoteData.text);
    updateBookmarkUI(btnSave, isSaved);

    btnSave.addEventListener('click', async () => {
        haptics.vibrate();
        audioService.playClick();
        const currentlySaved = await quoteService.isQuoteSaved(quoteData.text);
        if (currentlySaved) {
            await quoteService.unsaveQuote(quoteData.text);
            updateBookmarkUI(btnSave, false);
        } else {
            await quoteService.saveQuote(quoteData);
            updateBookmarkUI(btnSave, true);
        }
    });
}

function updateBookmarkUI(btn, isSaved) {
    if(!btn) return;
    const icon = btn.querySelector('i');
    if (isSaved) {
        icon.className = 'fas fa-bookmark';
        btn.style.color = 'var(--primary-color)';
    } else {
        icon.className = 'far fa-bookmark';
        btn.style.color = 'var(--text-secondary)';
    }
}
