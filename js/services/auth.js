import { auth, db } from '../config/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const authService = {
    async register(email, password, username) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Secondary check: ensure username isn't taken by another UID
            const q = query(collection(db, "users"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
                // Highly unlikely race condition or afterauth check
                // In a production app, we'd use a Cloud Function for this
                await user.delete();
                return { success: false, message: "Username already taken." };
            }
            
            // Explicitly map UI data to Firestore keys
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                username: username,
                email: email,
                avatar_url: "",
                exp: 0,
                level: 1,
                current_streak: 0,
                longest_streak: 0,
                freeze_count: 2, // 2 freezes allowed by default
                freeze_last_reset: Date.now(),
                unlocked_themes: ['default'],
                active_theme: 'default',
                is_global_muted: false,
                has_completed_onboarding: true,
                created_at: Date.now(),
                last_login: Date.now()
            });
            
            return { success: true, user };
        } catch (error) {
            let message = error.message;
            if(error.code === 'auth/email-already-in-use') message = "This email is already registered.";
            if(error.code === 'auth/weak-password') message = "Password is too weak.";
            return { success: false, message };
        }
    },
    
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Optionally update last login in Firestore here
            await setDoc(doc(db, "users", userCredential.user.uid), {
                last_login: Date.now()
            }, { merge: true });

            return { success: true, user: userCredential.user };
        } catch (error) {
            let message = "Invalid email or password.";
            return { success: false, message };
        }
    },
    
    async logout() {
        await signOut(auth);
    },

    async checkUsernameUnique(username) {
        const q = query(collection(db, "users"), where("username", "==", username));
        const snap = await getDocs(q);
        return snap.empty;
    },

    async updateUserProfile(data) {
        if (!auth.currentUser) return { success: false };
        await setDoc(doc(db, "users", auth.currentUser.uid), data, { merge: true });
        return { success: true };
    },

    async updateUserPassword(oldPassword, newPassword) {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "No user logged in." };
        
        try {
            const credential = EmailAuthProvider.credential(user.email, oldPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, message: "Old password incorrect." };
        }
    },

    async deleteUserAccount(password) {
        const user = auth.currentUser;
        if (!user) return { success: false };

        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            const uid = user.uid;
            
            // Cleanup Firestore (Simplified: Main user doc and their tasks)
            await deleteDoc(doc(db, "users", uid));
            // In a real app, you'd use a Cloud Function or a batch for subcollections
            
            await deleteUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, message: "Password incorrect or deletion failed." };
        }
    }
};
