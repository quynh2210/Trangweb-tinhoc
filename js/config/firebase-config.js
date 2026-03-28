import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5Set9hHKO3XFCJSq2I16q5iQZpz4Pp5Y",
  authDomain: "task-6dfb6.firebaseapp.com",
  projectId: "task-6dfb6",
  storageBucket: "task-6dfb6.firebasestorage.app",
  messagingSenderId: "219938846990",
  appId: "1:219938846990:web:91e765b5c55d6f19d03f5f",
  measurementId: "G-9K24VPLY6D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
