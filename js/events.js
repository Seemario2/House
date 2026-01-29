/**
 * Global events system for cross-page sync
 */
const DashboardEvents = {
    init() {
        document.addEventListener('stateUpdated', () => {
            console.log('State updated, re-rendering components...');
            this.syncUI();
        });

        document.addEventListener('applicationsUpdated', () => {
            this.updateNotificationsBadge();
        });
    },

    syncUI() {
        this.updateNotificationsBadge();
    },

    updateNotificationsBadge() {
        const count = (window.DashboardState.notifications || []).filter(n => !n.read).length;
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        });
    }
};

window.DashboardEvents = DashboardEvents;
DashboardEvents.init();
