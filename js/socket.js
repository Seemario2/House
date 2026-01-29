/**
 * WebSocket service for real-time sync
 */
const DashboardSocket = {
    socket: null,

    connect(userId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? '127.0.0.1:8000'
            : window.location.host;
        const wsUrl = `${protocol}//${host}/ws/chat/${userId}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WS Message:', data);

            if (data.type === 'notification') {
                window.DashboardState.notifications.unshift({
                    id: Date.now(),
                    message: data.message,
                    read: false,
                    time: new Date().toISOString()
                });
                document.dispatchEvent(new Event('stateUpdated'));
                document.dispatchEvent(new Event('notificationsUpdated'));
            }

            if (data.type === 'chat') {
                const chatId = data.sender_id;
                if (!window.DashboardState.chats[chatId]) {
                    window.DashboardState.chats[chatId] = [];
                }
                window.DashboardState.chats[chatId].push({
                    sender_id: data.sender_id,
                    content: data.content,
                    timestamp: new Date().toISOString()
                });
                document.dispatchEvent(new Event('chatUpdated'));
            }

            if (data.type === 'application_update') {
                // Dispatch specific event for the UI
                document.dispatchEvent(new CustomEvent('applicationUpdated', { detail: data }));

                // Add to notifications
                window.DashboardState.notifications.unshift({
                    id: Date.now(),
                    message: `Application status for ${data.property_title} changed to ${data.status}`,
                    read: false,
                    time: new Date().toISOString()
                });
                document.dispatchEvent(new Event('notificationsUpdated'));
            }
        };

        this.socket.onclose = () => {
            console.log('WS connection closed. Reconnecting...');
            setTimeout(() => this.connect(userId), 3000);
        };
    },

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }
};

window.DashboardSocket = DashboardSocket;
