import { db, auth } from '../config/firebase-config.js';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const quoteService = {
    async fetchRandomQuote() {
        try {
            // Fetching from a large pool of ~1600 quotes for better variety
            const response = await fetch('https://type.fit/api/quotes');
            if (!response.ok) throw new Error('API limit or error');
            const data = await response.json();
            
            // Pick a random one from the massive array
            const randomIndex = Math.floor(Math.random() * data.length);
            const rawQuote = data[randomIndex];
            
            return {
                text: rawQuote.text,
                author: rawQuote.author ? rawQuote.author.split(',')[0] : "Unknown" // Clean up author names
            };
        } catch (error) {
            console.error("Quote Fetch Error:", error);
            const fallbacks = [
                { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
                { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
                { text: "Wisdom begins in wonder.", author: "Socrates" },
                { text: "The unexamined life is not worth living.", author: "Socrates" },
                { text: "Be kind, for everyone you meet is fighting a hard battle.", author: "Plato" },
                { text: "Happiness depends upon ourselves.", author: "Aristotle" }
            ];
            return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
    },

    async saveQuote(quote) {
        if (!auth.currentUser) return;
        try {
            await addDoc(collection(db, "saved_quotes"), {
                user_id: auth.currentUser.uid,
                text: quote.text,
                author: quote.author,
                is_pinned: false,
                created_at: serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async unsaveQuote(quoteText) {
        if (!auth.currentUser) return;
        try {
            const q = query(collection(db, "saved_quotes"), 
                where("user_id", "==", auth.currentUser.uid), 
                where("text", "==", quoteText));
            const snap = await getDocs(q);
            snap.forEach(async (d) => {
                await deleteDoc(doc(db, "saved_quotes", d.id));
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async isQuoteSaved(quoteText) {
        if (!auth.currentUser) return false;
        const q = query(collection(db, "saved_quotes"), 
            where("user_id", "==", auth.currentUser.uid), 
            where("text", "==", quoteText));
        const snap = await getDocs(q);
        return !snap.empty;
    }
};
