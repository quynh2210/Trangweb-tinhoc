import { audioService } from '../services/audio.js';
import { haptics } from '../services/device.js';

export function renderOnboarding(container, onNavigate) {
    container.innerHTML = `
        <div class="onboarding-page fade-in">
            <div class="onboarding-content">
                <div class="illustration">
                    <div class="illustration-circle">
                        <i class="fas fa-tasks fa-4x"></i>
                    </div>
                </div>
                
                <h1 class="title">Level Up Your Productivity</h1>
                <p class="subtitle">Complete tasks, earn EXP, and build streaks in a gamified experience.</p>
                
                <div class="features-list desktop-hide">
                    <div class="feature-item">
                        <i class="fas fa-fire fa-lg" style="color: var(--warning-color); width: 24px; text-align: center;"></i>
                        <span>Keep your streaks alive</span>
                    </div>
                    <div class="feature-item mobile-flex">
                        <i class="fas fa-gem fa-lg" style="color: var(--primary-color); width: 24px; text-align: center;"></i>
                        <span>Earn EXP & Level Up</span>
                    </div>
                    <div class="feature-item mobile-flex">
                        <i class="fas fa-user-friends fa-lg" style="color: var(--secondary-color); width: 24px; text-align: center;"></i>
                        <span>Motivate your buddies</span>
                    </div>
                </div>
            </div>
            
            <div class="button-group bottom-actions">
                <button id="btn-register" class="btn btn-primary btn-large">
                    Get Started
                </button>
                <button id="btn-login" class="btn btn-secondary btn-large" style="margin-top: 16px;">
                    I Already Have an Account
                </button>
            </div>
        </div>
    `;

    // Interaction Listeners
    const btnRegister = container.querySelector('#btn-register');
    const btnLogin = container.querySelector('#btn-login');

    btnRegister.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        if(onNavigate) onNavigate('REGISTER');
    });

    btnLogin.addEventListener('click', () => {
        haptics.vibrate();
        audioService.playClick();
        if(onNavigate) onNavigate('LOGIN');
    });
}
