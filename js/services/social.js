import { db, auth } from '../config/firebase-config.js';
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, 
    query, where, serverTimestamp, arrayUnion, onSnapshot, orderBy, limit, addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const socialService = {
    // --- User Search & Friend Requests ---
    async searchUserByUsername(username) {
        const q = query(collection(db, "users"), where("username", "==", username));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data();
    },

    async sendFriendRequest(targetUid) {
        if (!auth.currentUser) return;
        const currentUid = auth.currentUser.uid;
        
        // Prevent adding self
        if (currentUid === targetUid) return { success: false, message: "You can't add yourself!" };

        // Check if already friends or pending
        const friendshipId = [currentUid, targetUid].sort().join('_');
        const friendshipRef = doc(db, "friendships", friendshipId);
        const fSnap = await getDoc(friendshipRef);

        if (fSnap.exists()) {
            return { success: false, message: "Request already exists or already friends." };
        }

        // Create friendship doc (pending)
        await setDoc(friendshipRef, {
            uids: [currentUid, targetUid],
            status: 'pending',
            requester_uid: currentUid,
            created_at: serverTimestamp(),
            last_message_at: serverTimestamp()
        });

        // Add notification for target
        await addDoc(collection(db, "notifications"), {
            target_uid: targetUid,
            from_uid: currentUid,
            type: 'friend_request',
            is_read: false,
            timestamp: serverTimestamp()
        });

        return { success: true };
    },

    async acceptFriendRequest(requesterUid) {
        if (!auth.currentUser) return;
        const currentUid = auth.currentUser.uid;
        const friendshipId = [currentUid, requesterUid].sort().join('_');
        
        await updateDoc(doc(db, "friendships", friendshipId), {
            status: 'accepted',
            accepted_at: serverTimestamp(),
            last_interaction: serverTimestamp()
        });

        // Initialize social streak
        await setDoc(doc(db, "social_streaks", friendshipId), {
            friendship_id: friendshipId,
            streak_count: 0,
            active_states: {}, // uid -> last_active_date_str
            freezes: { [currentUid]: 3, [requesterUid]: 3 },
            last_freeze_reset: serverTimestamp()
        });

        // Notify requester
        await addDoc(collection(db, "notifications"), {
            target_uid: requesterUid,
            from_uid: currentUid,
            type: 'request_accepted',
            is_read: false,
            timestamp: serverTimestamp()
        });

        // Mark all friend requests from this user as actioned
        const q = query(collection(db, "notifications"), 
            where("target_uid", "==", currentUid), 
            where("from_uid", "==", requesterUid), 
            where("type", "==", "friend_request"));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await updateDoc(doc(db, "notifications", d.id), { actioned: true });
        }
    },

    async deleteNotification(notiId) {
        // Soft delete for now or use a 'deleted' flag
        await updateDoc(doc(db, "notifications", notiId), { deleted: true });
    },

    // --- Nudges ---
    async canNudge(friendshipId) {
        const uid = auth.currentUser.uid;
        const nudgeRef = doc(db, "nudges", `${friendshipId}_${uid}`);
        const snap = await getDoc(nudgeRef);
        if (!snap.exists()) return true;
        
        const data = snap.data();
        const lastNudge = data.last_nudge?.toDate();
        if (!lastNudge) return true;

        const isToday = lastNudge.toDateString() === new Date().toDateString();
        return !isToday || (data.count < 3);
    },

    async sendNudge(friendshipId, targetUid) {
        const uid = auth.currentUser.uid;
        const nudgeRef = doc(db, "nudges", `${friendshipId}_${uid}`);
        const snap = await getDoc(nudgeRef);
        
        let count = 1;
        if (snap.exists() && snap.data().last_nudge?.toDate().toDateString() === new Date().toDateString()) {
            count = snap.data().count + 1;
        }

        await setDoc(nudgeRef, {
            friendship_id: friendshipId,
            uid: uid,
            count: count,
            last_nudge: serverTimestamp()
        });

        await addDoc(collection(db, "notifications"), {
            target_uid: targetUid,
            from_uid: uid,
            type: 'nudge',
            is_read: false,
            timestamp: serverTimestamp()
        });
    },

    // --- Chat & Real-time Listeners ---
    getFriendships(callback) {
        if (!auth.currentUser) return;
        // REMOVED orderBy to avoid manual index creation requirement
        const q = query(collection(db, "friendships"), where("uids", "array-contains", auth.currentUser.uid));
        return onSnapshot(q, async (snap) => {
            const friendships = [];
            for (const d of snap.docs) {
                const data = d.data();
                const otherUid = data.uids.find(id => id !== auth.currentUser.uid);
                // Fetch other user's info
                const otherUser = await getDoc(doc(db, "users", otherUid));
                friendships.push({ id: d.id, ...data, otherUser: otherUser.data() });
            }
            // Sort client-side
            friendships.sort((a,b) => (b.last_message_at?.toMillis() || 0) - (a.last_message_at?.toMillis() || 0));
            callback(friendships);
        });
    },

    getNotifications(callback) {
        if (!auth.currentUser) return;
        // REMOVED orderBy to avoid manual index creation requirement
        const q = query(collection(db, "notifications"), where("target_uid", "==", auth.currentUser.uid));
        return onSnapshot(q, async (snap) => {
            const notis = [];
            for (const d of snap.docs) {
                const data = d.data();
                if (data.deleted) continue;
                const fromUser = await getDoc(doc(db, "users", data.from_uid));
                notis.push({ id: d.id, ...data, fromUser: fromUser.data() });
            }
            // Sort client-side
            notis.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            callback(notis);
        });
    },

    markNotificationsRead() {
        if (!auth.currentUser) return;
        const q = query(collection(db, "notifications"), where("target_uid", "==", auth.currentUser.uid), where("is_read", "==", false));
        getDocs(q).then(snap => {
            snap.forEach(d => {
                updateDoc(doc(db, "notifications", d.id), { is_read: true });
            });
        });
    },

    async markChatAsRead(friendshipId) {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        await updateDoc(doc(db, "friendships", friendshipId), {
            [`last_read.${uid}`]: serverTimestamp()
        });
    }
};
