import { db, auth } from './config/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { authService } from './services/auth.js';
import { audioService } from './services/audio.js';
import { haptics } from './services/device.js';

import { renderOnboarding } from './views/onboarding.js';
import { renderLogin } from './views/login.js';
import { renderRegister } from './views/register.js';
import { renderHome } from './views/home.js';

class App {
    constructor() {
        this.appContainer = document.getElementById('app');
        this.init();
    }

    init() {
        console.log("App initializing...");
        this.setupAuthListener();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User logged in:", user.uid);
                
                if (this.unsubUser) this.unsubUser();
                this.unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        document.body.setAttribute('data-theme', data.active_theme || 'default');
                    }
                });

                this.navigate('HOME');
            } else {
                console.log("User not logged in. Showing Onboarding.");
                if (this.unsubUser) this.unsubUser();
                document.body.setAttribute('data-theme', 'default');
                this.navigate('ONBOARDING');
            }
        });
    }

    navigate(view) {
        this.appContainer.innerHTML = ''; // Clear container
        switch(view) {
            case 'ONBOARDING':
                renderOnboarding(this.appContainer, (nextView) => this.navigate(nextView));
                break;
            case 'LOGIN':
                renderLogin(this.appContainer, (nextView) => this.navigate(nextView));
                break;
            case 'REGISTER':
                renderRegister(this.appContainer, (nextView) => this.navigate(nextView));
                break;
            case 'HOME':
                renderHome(this.appContainer);
            default:
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.taskApp = new App();
});
