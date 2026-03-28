import { db, auth } from '../config/firebase-config.js';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const socialStreakService = {
    async getStreakData(friendshipId) {
        const streakRef = doc(db, "social_streaks", friendshipId);
        const snap = await getDoc(streakRef);
        if (!snap.exists()) return null;
        return snap.data();
    },

    async updateActiveState(friendshipId) {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        const todayStr = new Date().toISOString().split('T')[0];
        
        const streakRef = doc(db, "social_streaks", friendshipId);
        const snap = await getDoc(streakRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const activeStates = data.active_states || {};
        
        // If already active today, do nothing
        if (activeStates[uid] === todayStr) return;

        activeStates[uid] = todayStr;
        
        // Check if other user is also active today
        const otherUid = friendshipId.split('_').find(id => id !== uid);
        const isOtherActive = activeStates[otherUid] === todayStr;

        const updateData = { active_states: activeStates };
        if (isOtherActive) {
            updateData.streak_count = (data.streak_count || 0) + 1;
            updateData.last_increment_date = todayStr;
        }

        await updateDoc(streakRef, updateData);
        return { success: true, isComplete: isOtherActive };
    },

    async checkAndApplyFreezes(friends) {
        // This would ideally be a cloud function, but we can check on load for all friends
        // For each accepted friendship, check if streak should be preserved or reset
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        for (const f of friends) {
            const streakRef = doc(db, "social_streaks", f.id);
            const sSnap = await getDoc(streakRef);
            if (!sSnap.exists()) continue;

            const sData = sSnap.data();
            const lastInc = sData.last_increment_date;

            // If last increment wasn't today or yesterday, check freezes
            if (lastInc !== yesterdayStr && lastInc !== today.toISOString().split('T')[0] && lastInc) {
                // Determine who missed it? Actually both must be active. 
                // Simple logic: if anyone missed yesterday, check if collective freezes exist
                // The user said "3 freezes for EACH friend per month"
                // Let's assume a shared pool of 3 per friendship
                let freezes = sData.freezes_remaining ?? 3;
                if (freezes > 0) {
                    await updateDoc(streakRef, {
                        freezes_remaining: freezes - 1,
                        last_increment_date: yesterdayStr, // Artificial preserve
                        status_type: 'freeze'
                    });
                } else {
                    await updateDoc(streakRef, { streak_count: 0, last_increment_date: null });
                }
            }
        }
    },

    getStreakIcon(streakData, uid) {
        if (!streakData || streakData.streak_count === 0) return { icon: 'fa-fire', color: 'var(--text-secondary)', opacity: 0.3 };
        
        const todayStr = new Date().toISOString().split('T')[0];
        const isTodayActive = streakData.last_increment_date === todayStr;
        const isFrozen = streakData.status_type === 'freeze'; // Simplified

        if (isTodayActive) return { icon: 'fa-fire', color: 'var(--danger-color)', opacity: 1 };
        if (isFrozen) return { icon: 'fa-snowflake', color: 'var(--secondary-color)', opacity: 1 };
        return { icon: 'fa-fire', color: 'var(--text-secondary)', opacity: 1 };
    }
};
