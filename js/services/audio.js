// Web Audio API utility
export class AudioService {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    _init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
    }

    playClick() {
        if (this.isMuted) return;
        this._init();
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
    
    playSuccess() {
        if (this.isMuted) return;
        this._init();
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, this.ctx.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playEpicSuccess() {
        if (this.isMuted) return;
        this._init();
        
        // Fast Arpeggio (C5 -> E5 -> G5 -> C6) for "Hurray!"
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        const times = [0, 0.1, 0.2, 0.35];
        
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + times[i]);
            
            gainNode.gain.setValueAtTime(0, this.ctx.currentTime + times[i]);
            gainNode.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + times[i] + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + times[i] + 0.3);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start(this.ctx.currentTime + times[i]);
            osc.stop(this.ctx.currentTime + times[i] + 0.3);
        });
    }
}

export const audioService = new AudioService();
