import { db, auth } from '../config/firebase-config.js';
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const streakService = {
    async checkStreakStatus() {
        if (!auth.currentUser) return null;
        const userRef = doc(db, "users", auth.currentUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return null;

        const data = snap.data();
        const now = new Date();
        const todayStr = this.formatDate(now);
        
        const lastClaim = data.last_streak_claim ? data.last_streak_claim.toDate() : null;
        const lastClaimStr = lastClaim ? this.formatDate(lastClaim) : null;

        // Check Monthly Freeze Reset
        let freezes = data.freezes_available ?? 3;
        const lastReset = data.last_freeze_reset ? data.last_freeze_reset.toDate() : null;
        if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
            freezes = 3;
            await updateDoc(userRef, { 
                freezes_available: 3, 
                last_freeze_reset: serverTimestamp() 
            });
        }

        // If claimed today, we are safe
        if (lastClaimStr === todayStr) {
            return { needsClaim: false, currentStreak: data.current_streak || 0, freezes };
        }

        // If not claimed today, check if yesterday was missed
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.formatDate(yesterday);

        if (lastClaimStr === yesterdayStr || !lastClaimStr) {
            // Either new user or just need to claim today's streak
            return { needsClaim: true, currentStreak: data.current_streak || 0, freezes };
        }

        // Missed yesterday! Check for freezes
        const daysMissed = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
        
        if (daysMissed > 0 && freezes > 0) {
            // Use freeze for yesterday
            const freezeDate = new Date();
            freezeDate.setDate(freezeDate.getDate() - 1);
            
            await updateDoc(userRef, {
                freezes_available: freezes - 1,
                streak_history: arrayUnion({ date: this.formatDate(freezeDate), type: 'freeze' })
            });
            
            return { needsClaim: true, currentStreak: data.current_streak || 0, freezes: freezes - 1 };
        } else if (daysMissed > 0) {
            // Reset streak
            await updateDoc(userRef, { current_streak: 0 });
            return { needsClaim: true, currentStreak: 0, freezes };
        }

        return { needsClaim: true, currentStreak: data.current_streak || 0, freezes };
    },

    async claimStreak() {
        if (!auth.currentUser) return;
        const userRef = doc(db, "users", auth.currentUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const todayStr = this.formatDate(new Date());
        
        await updateDoc(userRef, {
            current_streak: (data.current_streak || 0) + 1,
            last_streak_claim: serverTimestamp(),
            streak_history: arrayUnion({ date: todayStr, type: 'active' })
        });
    },

    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    getProvocativeMessage(streak) {
        const newMessages = [
            "Every legend starts with a single step. Shall we begin yours?",
            "The first spark is always the hardest. Ready to light it up?",
            "A blank page is just an opportunity. Start your streak today!",
            "Small wins lead to big victories. Ready for win #1?"
        ];

        const existingMessages = [
            "Don't let the fire go out! Your streak is waiting.",
            "You were doing so well! Keep the momentum alive.",
            "Consistency is king. Ready to add another day?",
            "The fire is cooling down... feed it with a claim!",
            "Your streak is calling your name. Don't leave it hanging!",
            "One click to keep the magic alive. You've got this!"
        ];

        if (streak === 0) {
            return newMessages[Math.floor(Math.random() * newMessages.length)];
        } else {
            return existingMessages[Math.floor(Math.random() * existingMessages.length)];
        }
    }
};
