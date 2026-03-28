import { authService } from '../services/auth.js';
import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';

export function renderRegister(container, onNavigate) {
    container.innerHTML = `
        <div class="auth-page fade-in">
            <div class="auth-box">
                <div class="auth-banner" style="background: linear-gradient(135deg, var(--secondary-color), var(--primary-color));">
                    <button class="btn-back" id="btn-back" aria-label="Go back">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <div class="illustration-circle" style="width: 120px; height: 120px; background: rgba(255,255,255,0.2);">
                        <i class="fas fa-shield-alt fa-3x"></i>
                    </div>
                    <h2 style="margin-top: 24px; font-size: 1.8rem; font-weight:700;">Sign Up</h2>
                    <p style="opacity: 0.9; margin-top: 8px;">Create an account to track your quests and build streaks.</p>
                </div>
                
                <div class="auth-form-section">
                    <div class="auth-header">
                        <h1 class="title">Create Hero</h1>
                        <p style="margin-top:100px;" class="subtitle">Fill in the details to create your account.</p>
                    </div>
                    
                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" id="reg-username" required placeholder="Choose a username">
                        </div>
                        
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="reg-email" required placeholder="hero@example.com">
                        </div>
                        
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="reg-password" required placeholder="Min 8 chars, 1 uppercase, 1 special">
                        </div>

                        <div class="form-group">
                            <label>Confirm Password</label>
                            <input type="password" id="reg-confirm-password" required placeholder="Retype password">
                        </div>
                        
                        <div id="reg-error" class="error-message" style="color:var(--danger-color); font-size: 0.9rem; min-height: 20px; margin-top:8px;"></div>
                        
                        <button type="submit" class="btn btn-primary btn-large" id="btn-submit" style="margin-top: 8px;">
                            Create Account
                        </button>
                    </form>
                    
                    <div class="auth-footer" style="margin-top: 24px; text-align:center;">
                        <p>Already have an account? <span id="link-login" style="color:var(--primary-color); font-weight:600; cursor:pointer;">Log in</span></p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const btnBack = container.querySelector('#btn-back');
    const linkLogin = container.querySelector('#link-login');
    const form = container.querySelector('#register-form');
    const errorDiv = container.querySelector('#reg-error');
    const btnSubmit = container.querySelector('#btn-submit');

    btnBack.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        onNavigate('ONBOARDING');
    });

    linkLogin.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        onNavigate('LOGIN');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        haptics.vibrate();
        audioService.playClick();
        errorDiv.textContent = '';
        
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;
        const confirmPassword = container.querySelector('#reg-confirm-password').value;

        if (password !== confirmPassword) {
            haptics.error();
            errorDiv.textContent = "Passwords do not match.";
            return;
        }

        // Password rules: Min 8 chars, 1 uppercase, 1 special
        const pwdRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

        if (!pwdRegex.test(password)) {
            haptics.error();
            errorDiv.textContent = "Password must be min 8 chars with 1 uppercase and 1 special character.";
            return;
        }

        btnSubmit.textContent = "Checking...";
        btnSubmit.disabled = true;

        try {
            // NEW: Early uniqueness check to prevent onboarding loop
            const isUnique = await authService.checkUsernameUnique(username);
            if (!isUnique) {
                haptics.error();
                errorDiv.textContent = "Username already taken.";
                btnSubmit.textContent = "Create Account";
                btnSubmit.disabled = false;
                return;
            }
        } catch (err) {
            console.error("Username check failed:", err);
            // On error, let the main register handle it to avoid blocking user
        }

        const res = await authService.register(email, password, username);
        if (res.success) {
            haptics.success();
            audioService.playSuccess();
            // Auth listener will handle redirect
        } else {
            haptics.error();
            btnSubmit.textContent = "Create Account";
            btnSubmit.disabled = false;
            errorDiv.textContent = res.message;
        }
    });

    // Real-time check (optional but helpful)
    const usernameInput = container.querySelector('#reg-username');
    let debounceTimer;
    usernameInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const val = usernameInput.value.trim();
                if (val.length < 3) return;
                const isUnique = await authService.checkUsernameUnique(val);
                if (!isUnique) {
                    errorDiv.textContent = "Username already taken.";
                    usernameInput.style.borderColor = 'var(--danger-color)';
                } else {
                    errorDiv.textContent = "";
                    usernameInput.style.borderColor = 'var(--success-color)';
                }
            } catch (e) { /* silent fail for real-time */ }
        }, 500);
    });
}
