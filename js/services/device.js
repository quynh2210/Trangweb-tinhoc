export const haptics = {
    vibrate(pattern = 50) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    },
    
    success() {
        this.vibrate([30, 50, 30]);
    },
    
    error() {
        this.vibrate([50, 100, 50, 100, 50]);
    }
};

export const notifications = {
    async requestPermission() {
        if (!('Notification' in window)) return false;
        
        if (Notification.permission === 'granted') return true;
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    },
    
    send(title, options = {}) {
        if (Notification.permission === 'granted') {
            new Notification(title, options);
        }
    }
};
