import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';
import { db, auth } from '../config/firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { streakService } from '../services/streak.js';

const modalContainer = document.getElementById('modal-container');

export function showModal(contentHtml, initScript) {
    modalContainer.innerHTML = `
        <div class="modal-overlay" id="generic-modal">
            <div class="modal-content" onclick="event.stopPropagation()">
                ${contentHtml}
            </div>
        </div>
    `;
    const overlay = document.getElementById('generic-modal');
    void overlay.offsetWidth; // Trigger reflow
    overlay.classList.add('active');

    // Click outside to close
    overlay.addEventListener('click', () => {
        closeModal();
    });

    const closeBtns = overlay.querySelectorAll('.btn-close');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            haptics.vibrate();
            audioService.playClick();
            closeModal();
        });
    });

    if(initScript) initScript(overlay);
}

export function closeModal() {
    const overlay = document.getElementById('generic-modal');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            modalContainer.innerHTML = '';
        }, 250);
    }
}

// -------------------------------------
// TASK MODAL
// -------------------------------------
export async function openTaskModal(preselectedQuestId = "general") {
    // Fetch user quests for dropdown
    const questsRef = collection(db, "quests");
    const q = query(questsRef, where("user_id", "==", auth.currentUser.uid), where("status", "==", "active"));
    let quests = [{ id: "general", name: "General Board" }];
    try {
        const snap = await getDocs(q);
        snap.forEach(d => quests.push({ id: d.id, name: d.data().name }));
    } catch(e) { console.error(e); }
    
    let optionsHtml = '';
    quests.forEach(qItem => {
         const sel = (qItem.id === preselectedQuestId) ? "selected" : "";
         optionsHtml += `<option value="${qItem.id}" ${sel}>${qItem.name}</option>`;
    });

    const html = `
        <div class="modal-header">
            <h2 style="font-size: 1.25rem;">New Task</h2>
            <button class="btn-close" type="button"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <form id="form-add-task" style="overflow-x:hidden;display:flex; flex-direction:column; gap: 16px;">
                <div class="form-group">
                    <label>Quest (Folder)</label>
                    <select id="task-quest-id">
                        ${optionsHtml}
                    </select>
                </div>

                <div class="form-group">
                    <label>Title <span class="text-danger">*</span></label>
                    <input type="text" id="task-title" required placeholder="What needs to be done?">
                </div>
                
                <div class="form-group">
                    <label>Detail (Optional)</label>
                    <input type="text" id="task-detail" placeholder="Additional context">
                </div>
                
                <div class="form-group">
                    <label>Reward / Motivation</label>
                    <input type="text" id="task-reward" placeholder="e.g. Watch 1 ep of Netflix">
                </div>
                <div class="form-group">
                    <label>Deadline (Timer)</label>
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="task-deadline-num" min="1" placeholder="e.g. 2" style="flex:1;" onkeypress="return event.charCode >= 48 && event.charCode <= 57">
                        <select id="task-deadline-unit" style="flex:1;">
                            <option value="min">Minutes</option>
                            <option value="hour">Hours</option>
                            <option value="day" selected>Days</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <div class="radio-group" id="priority-group">
                        <div class="radio-btn low" data-val="low">Low</div>
                        <div class="radio-btn active med" data-val="med">Med</div>
                        <div class="radio-btn high" data-val="high">High</div>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-large" id="btn-submit-task" style="margin-top: 16px;">
                    Add Task
                </button>
            </form>
        </div>
    `;

    showModal(html, (modalNode) => {
        let selectedPriority = 'med';
        
        const radios = modalNode.querySelectorAll('.radio-btn');
        radios.forEach(radio => {
            radio.addEventListener('click', () => {
                haptics.vibrate([20]);
                radios.forEach(r => r.classList.remove('active'));
                radio.classList.add('active');
                selectedPriority = radio.getAttribute('data-val');
            });
        });

        const form = modalNode.querySelector('#form-add-task');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            haptics.vibrate();
            audioService.playClick();
            
            const btnSubmit = modalNode.querySelector('#btn-submit-task');
            btnSubmit.textContent = "Adding...";
            btnSubmit.disabled = true;

            const selectedQuestId = modalNode.querySelector('#task-quest-id').value;
            const title = modalNode.querySelector('#task-title').value.trim();
            const detail = modalNode.querySelector('#task-detail').value.trim();
            const reward = modalNode.querySelector('#task-reward').value.trim();
            
            const dlNum = parseInt(modalNode.querySelector('#task-deadline-num').value);
            const dlUnit = modalNode.querySelector('#task-deadline-unit').value;
            let deadlineTimestamp = null;
            
            if (!isNaN(dlNum) && dlNum > 0) {
                const now = Date.now();
                let multiplier = 1;
                if(dlUnit === 'min') multiplier = 60 * 1000;
                else if(dlUnit === 'hour') multiplier = 60 * 60 * 1000;
                else if(dlUnit === 'day') multiplier = 24 * 60 * 60 * 1000;
                deadlineTimestamp = now + (dlNum * multiplier);
            }

            try {
                await addDoc(collection(db, "tasks"), {
                    user_id: auth.currentUser.uid,
                    quest_id: selectedQuestId,
                    title: title,
                    description: detail,
                    reward: reward,
                    priority: selectedPriority,
                    deadline: deadlineTimestamp,
                    is_completed: false,
                    status: "pending",
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp()
                });
                
                // NEW: Mark quest as started if it's not the general board
                if (selectedQuestId !== "general") {
                    await updateDoc(doc(db, "quests", selectedQuestId), {
                        has_tasks: true,
                        updated_at: serverTimestamp()
                    });
                }
                
                haptics.success();
                audioService.playSuccess();
                closeModal();
            } catch(error) {
                console.error(error);
                haptics.error();
                btnSubmit.textContent = "Error. Try again";
                btnSubmit.disabled = false;
            }
        });
    });
}

// -------------------------------------
// QUEST MODAL
// -------------------------------------
export function openQuestModal() {
    const html = `
        <div class="modal-header">
            <h2 style="font-size: 1.25rem;">New Quest Board</h2>
            <button class="btn-close" type="button"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <form id="form-add-quest" style="display:flex; flex-direction:column; gap: 16px;">
                <div class="form-group">
                    <label>Quest Category Name <span class="text-danger">*</span></label>
                    <input type="text" id="quest-title" required placeholder="e.g. Learn React, Health & Fitness">
                </div>
                
                <div class="form-group">
                    <label>Detail (Optional)</label>
                    <input type="text" id="quest-detail" placeholder="Purpose of this quest folder">
                </div>
                
                <div class="form-group">
                    <label>Completion Reward</label>
                    <input type="text" id="quest-reward" placeholder="e.g. Buy a new game">
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <div class="radio-group" id="quest-priority-group">
                        <div class="radio-btn low" data-val="low">Low</div>
                        <div class="radio-btn med" data-val="med">Med</div>
                        <div class="radio-btn active high" data-val="high">High</div>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary btn-large" id="btn-submit-quest" style="margin-top: 24px;">
                    Create Quest Board
                </button>
            </form>
        </div>
    `;
    showModal(html, (modalNode) => {
        let questPriority = 'high';
        
        const radios = modalNode.querySelectorAll('#quest-priority-group .radio-btn');
        radios.forEach(radio => {
            radio.addEventListener('click', () => {
                haptics.vibrate([20]);
                radios.forEach(r => r.classList.remove('active'));
                radio.classList.add('active');
                questPriority = radio.getAttribute('data-val');
            });
        });

        const form = modalNode.querySelector('#form-add-quest');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            haptics.vibrate();
            audioService.playClick();
            
            const btnSubmit = modalNode.querySelector('#btn-submit-quest');
            btnSubmit.textContent = "Forging Quest...";
            btnSubmit.disabled = true;

            try {
                // Creates quest folder directly
                await addDoc(collection(db, "quests"), {
                    user_id: auth.currentUser.uid,
                    name: modalNode.querySelector('#quest-title').value.trim(),
                    description: modalNode.querySelector('#quest-detail').value.trim(),
                    reward: modalNode.querySelector('#quest-reward').value.trim(),
                    priority: questPriority,
                    progress: 0,
                    status: "active",
                    is_deleted: false,
                    created_at: serverTimestamp()
                });
                
                haptics.success();
                audioService.playSuccess();
                closeModal();
            } catch(error) {
                console.error(error);
                haptics.error();
                btnSubmit.textContent = "Error. Try again";
                btnSubmit.disabled = false;
            }
        });
    });
}

export function getLevelThreshold(level) {
    // T(n) = 10n^2 + 90n
    return 10 * Math.pow(level, 2) + 90 * level;
}

export function addExpLogic(currentExp, currentLevel, addedExp) {
    const totalExp = currentExp + addedExp;
    let lvl = currentLevel;
    
    // Check if we reached the next level threshold
    while (totalExp >= getLevelThreshold(lvl)) {
        lvl++;
    }
    
    return { exp: totalExp, level: lvl };
}

export function openCongratsModal(questData) {
    audioService.playEpicSuccess();
    haptics.success();
    
    const html = `
        <div class="modal-body" style="text-align:center; padding: 32px 16px;">
            <div style="font-size: 4rem; color: var(--warning-color); margin-bottom: 16px; animation: bounce 1s infinite;">🏆</div>
            <h2 style="font-size: 1.8rem; margin-bottom: 8px; color: var(--primary-color);">Quest Cleared!</h2>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">You have conquered <b style="color:var(--text-primary);">${questData.name}</b>!</p>
            ${questData.reward ? `<div style="background: var(--bg-color); border:1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 24px; font-weight: bold; color: var(--text-primary);"><i class="fas fa-gift" style="color:var(--secondary-color);"></i> Reward: ${questData.reward}</div>` : ''}
            <button class="btn btn-primary btn-large" id="btn-archive-quest" style="background:var(--success-color); border:none; color:white; padding:12px 24px; border-radius:30px; box-shadow:0 4px 12px rgba(16,185,129,0.3);">Claim & Archive</button>
        </div>
    `;
    showModal(html, (modalNode) => {
        const btn = modalNode.querySelector('#btn-archive-quest');
        btn.addEventListener('click', async () => {
             haptics.vibrate();
             btn.disabled = true;
             btn.textContent = "Archiving...";
             try {
                 await updateDoc(doc(db, "quests", questData.id), {
                     status: "completed",
                     updated_at: serverTimestamp()
                 });
                 // Quest grants fixed 50 EXP
                 const userRef = doc(db, "users", auth.currentUser.uid);
                 const userSnap = await getDoc(userRef);
                 if(userSnap.exists()) {
                     const uData = userSnap.data();
                     const next = addExpLogic(uData.exp || 0, uData.level || 1, 50);
                     await updateDoc(userRef, {
                         exp: next.exp,
                         level: next.level
                     });
                 }
                 closeModal();
             } catch(e) {
                 console.error(e);
                 btn.disabled = false;
                 btn.textContent = "Error!";
             }
        });
    });
}

// -------------------------------------
// TASK DETAIL MODAL
// -------------------------------------
export function openTaskDetailModal(taskId, taskData) {
    const isHigh = taskData.priority === 'high';
    const isLow = taskData.priority === 'low';
    let prioColor = "var(--warning-color)";
    if(isHigh) prioColor = "var(--danger-color)";
    if(isLow) prioColor = "var(--success-color)";
    
    let deadlineText = "";
    if (taskData.deadline) {
        deadlineText = new Date(taskData.deadline).toLocaleString();
    }

    const html = `
        <div class="modal-header">
            <h2 style="font-size: 1.25rem;">Task Intel</h2>
            <button class="btn-close" type="button"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" style="text-align: left;">
            <div style="display:flex; flex-direction:column; gap: 16px;">
                <div>
                    <span style="font-size:0.75rem; font-weight:bold; color:${prioColor}; text-transform:uppercase; border:1px solid ${prioColor}; border-radius:4px; padding:2px 6px;">${taskData.priority}</span>
                </div>
                <h3 style="font-size: 1.5rem; color: var(--text-primary); margin-top: -8px;">${taskData.title}</h3>
                
                ${taskData.description ? `
                <div style="background: var(--bg-color); padding: 16px; border-radius: var(--border-radius-sm); border-left: 3px solid var(--primary-color);">
                    <p style="color: var(--text-secondary); font-size: 0.95rem; margin:0;">${taskData.description}</p>
                </div>` : ''}
                
                ${taskData.reward ? `
                <div style="display:flex; align-items:center; gap:12px; font-size: 0.95rem;">
                    <i class="fas fa-gift" style="color: var(--primary-color);"></i>
                    <span style="color:var(--text-secondary);"><b style="color:var(--text-primary);">Reward:</b> ${taskData.reward}</span>
                </div>` : ''}
                
                ${taskData.deadline ? `
                <div style="display:flex; align-items:center; gap:12px; font-size: 0.95rem;">
                    <i class="far fa-clock" style="color: var(--danger-color);"></i>
                    <span style="color:var(--text-secondary);"><b style="color:var(--text-primary);">Deadline:</b> ${deadlineText}</span>
                </div>` : ''}
                
                <div style="display:flex; align-items:center; gap:12px; font-size: 0.95rem;">
                    <i class="fas fa-gem" style="color: var(--warning-color);"></i>
                    <span style="color:var(--text-secondary);"><b style="color:var(--text-primary);">EXP:</b> +10 EXP</span>
                </div>
            </div>
            
            <div style="display:flex; gap:12px; margin-top: 40px;">
                <button class="btn btn-secondary" id="btn-cancel-task" style="flex:1;">Close</button>
                <button class="btn btn-primary" id="btn-complete-task" style="flex:2; background:var(--success-color); box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                    <i class="fas fa-check" style="margin-right:8px;"></i> Complete
                </button>
            </div>
        </div>
    `;

    showModal(html, (modalNode) => {
        const btnComplete = modalNode.querySelector('#btn-complete-task');
        btnComplete.addEventListener('click', async () => {
            haptics.vibrate();
            audioService.playSuccess();
            btnComplete.disabled = true;
            btnComplete.textContent = "Processing...";
            try {
                const taskRef = doc(db, "tasks", taskId);
                const userRef = doc(db, "users", auth.currentUser.uid);
                
                const userSnap = await getDoc(userRef);
                if(userSnap.exists()) {
                    const userData = userSnap.data();
                    const next = addExpLogic(userData.exp || 0, userData.level || 1, 10);
                    
                    await updateDoc(userRef, {
                        exp: next.exp,
                        level: next.level
                    });
                }

                await updateDoc(taskRef, {
                    is_completed: true,
                    status: "completed",
                    updated_at: serverTimestamp()
                });
                closeModal();
            } catch(e) {
                console.error(e);
                haptics.error();
                btnComplete.disabled = false;
                btnComplete.textContent = "Error!";
            }
        });

        const btnCancel = modalNode.querySelector('#btn-cancel-task');
        btnCancel.addEventListener('click', () => {
            haptics.vibrate();
            closeModal();
        });
    });
}
export function openStreakClaimModal(currentStreak) {
    const isNew = currentStreak === 0;
    const message = streakService.getProvocativeMessage(currentStreak);
    
    const html = `
        <div class="modal-body" style="text-align:center; padding-top:24px;">
            <div style="font-size: 5rem; color: var(--danger-color); margin-bottom: 24px; animation: bounce 1.5s infinite;">🔥</div>
            <h2 style="font-size: 1.8rem; margin-bottom: 12px; color: var(--text-primary);">${isNew ? 'Ready to Start?' : 'Welcome Back!'}</h2>
            <p style="color:var(--text-secondary); margin-bottom:32px; font-size: 1.1rem; line-height: 1.5;">${message}</p>
            
            ${!isNew ? `<div style="font-size: 2.5rem; font-weight: 800; color: var(--primary-color); margin-bottom: 32px;">${currentStreak + 1} DAY STREAK</div>` : ''}

            <button class="btn btn-primary" id="btn-claim-streak" style="width: 100%; padding: 16px; border-radius: 40px; font-size: 1.2rem; font-weight: 800; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);">
                ${isNew ? "START MY JOURNEY" : "KEEP THE FIRE BURNING!"}
            </button>
        </div>
    `;

    showModal(html, (modalNode) => {
        modalNode.querySelector('#btn-claim-streak').addEventListener('click', async (e) => {
            haptics.vibrate();
            audioService.playEpicSuccess();
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = "CLAIMING...";
            
            await streakService.claimStreak();
            haptics.success();
            closeModal();
        });
    });
}
