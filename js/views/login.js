import { authService } from '../services/auth.js';
import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';

export function renderLogin(container, onNavigate) {
    container.innerHTML = `
        <div class="auth-page fade-in">
            <div class="auth-box">
                <div class="auth-banner">
                    <button class="btn-back" id="btn-back" aria-label="Go back">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <div class="illustration-circle" style="width: 120px; height: 120px; background: rgba(255,255,255,0.2);">
                        <i class="fas fa-gamepad fa-3x"></i>
                    </div>
                    <h2 style="margin-top: 24px; font-size: 1.8rem; font-weight:700;">Sign In</h2>
                    <p style="opacity: 0.9; margin-top: 8px;">Your quests are waiting for you.</p>
                </div>
                
                <div class="auth-form-section">
                    <div class="auth-header">
                        <h1 class="title">Welcome Back</h1>
                        <p class="subtitle">Enter your credentials to continue.</p>
                    </div>
                    
                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="login-email" required placeholder="hero@example.com">
                        </div>
                        
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="login-password" required placeholder="Your secret password">
                        </div>
                        
                        <div id="login-error" class="error-message" style="color:var(--danger-color); font-size: 0.9rem; min-height: 20px; margin-top:8px;"></div>
                        
                        <button type="submit" class="btn btn-primary btn-large" id="btn-submit" style="margin-top: 16px;">
                            Sign In
                        </button>
                    </form>
                    
                    <div class="auth-footer" style="margin-top: 32px; text-align:center;">
                        <p>New here? <span id="link-register" style="color:var(--primary-color); font-weight:600; cursor:pointer;">Create Account</span></p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const btnBack = container.querySelector('#btn-back');
    const linkRegister = container.querySelector('#link-register');
    const form = container.querySelector('#login-form');
    const errorDiv = container.querySelector('#login-error');
    const btnSubmit = container.querySelector('#btn-submit');

    btnBack.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        onNavigate('ONBOARDING');
    });

    linkRegister.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        onNavigate('REGISTER');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        haptics.vibrate();
        audioService.playClick();
        errorDiv.textContent = '';
        
        const email = container.querySelector('#login-email').value.trim();
        const password = container.querySelector('#login-password').value;

        btnSubmit.textContent = "Logging In...";
        btnSubmit.disabled = true;

        const res = await authService.login(email, password);
        if (res.success) {
            haptics.success();
            audioService.playSuccess();
            // App Auth Listener will redirect
        } else {
            haptics.error();
            btnSubmit.textContent = "Sign In";
            btnSubmit.disabled = false;
            errorDiv.textContent = res.message;
        }
    });
}
