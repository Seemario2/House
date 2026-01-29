/**
 * Chat Component Logic
 */

const ChatComponent = {
    activeReceiverId: null,

    init() {
        const chatInput = document.querySelector('.chat-input');
        const sendBtn = document.querySelector('.send-btn');
        const chatMessages = document.querySelector('.chat-messages, .chat-messages-full');

        // Connect to local state/socket
        const user = JSON.parse(localStorage.getItem('user'));

        // Auto-connect socket if possible
        if (user && window.DashboardSocket && !window.DashboardSocket.socket) {
            window.DashboardSocket.connect(user.id);
        }

        // Listen for incoming messages via Socket.js event
        document.addEventListener('chatUpdated', () => {
            // Re-render based on local state update from socket.js.
            // Ideally we just append the last message if it matches active receiver
            // But for simplicity/robustness, we can re-fetch or check the latest in state.

            // Check generic state or specific event detail if we improved socket.js dispatch
            // For now, let's assume we can just check the latest message in state for the active receiver
            if (this.activeReceiverId) {
                const chats = window.DashboardState.chats[this.activeReceiverId];
                if (chats && chats.length > 0) {
                    const lastMsg = chats[chats.length - 1];
                    // Avoid duplicates if we just sent it ourselves (optimistic UI)
                    // A simple check: if timestamp is very recent and we just sent one? 
                    // Or just check if it's already in DOM? 
                    // Let's just re-render the last message if it's not from 'me' to avoid duplicate from optimistic add
                    // OR, better: Only separate "incoming" logic.

                    // If the last message is from the other person, append it.
                    if (lastMsg.sender_id == this.activeReceiverId) {
                        // Check if already displayed (simple de-dupe for now, though IDs would be better)
                        const displayed = document.querySelectorAll('.message-received .message-bubble p');
                        const lastDisplayed = displayed.length > 0 ? displayed[displayed.length - 1].textContent : '';

                        if (lastDisplayed !== lastMsg.content) {
                            this.appendMessage(chatMessages, lastMsg.content, 'received');
                        }
                    }
                }
            }
        });

        const sendMessage = () => {
            if (!this.activeReceiverId) {
                alert('Please select a chat first.');
                return;
            }

            const content = chatInput.value.trim();
            if (content) {
                // Optimistic UI update
                this.appendMessage(chatMessages, content, 'sent');

                // Send via Socket
                window.DashboardSocket.send({
                    type: 'chat',
                    content,
                    receiver_id: this.activeReceiverId,
                    sender_id: user.id
                });

                // Also update local state so history remains consistent
                if (!window.DashboardState.chats[this.activeReceiverId]) {
                    window.DashboardState.chats[this.activeReceiverId] = [];
                }
                window.DashboardState.chats[this.activeReceiverId].push({
                    sender_id: user.id,
                    content: content,
                    timestamp: new Date().toISOString()
                });

                chatInput.value = '';
            }
        };

        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }
    },

    async setActiveReceiver(id, name, avatar) {
        this.activeReceiverId = id;

        // Update Header if exists
        const headerName = document.querySelector('.chat-main-header h4');
        const headerAvatar = document.querySelector('.chat-main-header .user-avatar');
        if (headerName) headerName.textContent = name;
        if (headerAvatar) headerAvatar.src = avatar;

        const chatMessages = document.querySelector('.chat-messages, .chat-messages-full');
        if (!chatMessages) return;

        chatMessages.innerHTML = '<div class="text-center" style="padding:2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        try {
            // Fetch History from API
            // Check if we have an API available, otherwise fallback to local/mock
            let history = [];
            if (window.api && window.api.getChatHistory) {
                try {
                    history = await window.api.getChatHistory(id);
                    // Store in local state cache
                    if (!window.DashboardState.chats) window.DashboardState.chats = {};
                    window.DashboardState.chats[id] = history;
                } catch (e) {
                    console.warn('Failed to load chat history from API', e);
                    // Fallback to local state if exists?
                    history = (window.DashboardState.chats && window.DashboardState.chats[id]) || [];
                }
            } else {
                history = (window.DashboardState.chats && window.DashboardState.chats[id]) || [];
            }

            chatMessages.innerHTML = ''; // Clear loading

            if (history && history.length > 0) {
                history.forEach(msg => {
                    this.appendMessage(chatMessages, msg.content, msg.sender_id == this.activeReceiverId ? 'received' : 'sent');
                });
                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } else {
                // Show welcome/empty state
                const info = document.createElement('div');
                info.className = 'text-center';
                info.style.padding = '2rem';
                info.style.color = 'var(--text-muted)';
                info.innerHTML = `<p>Start conversing with <strong>${name}</strong></p>`;
                chatMessages.appendChild(info);
            }
        } catch (err) {
            chatMessages.innerHTML = '';
            console.error(err);
        }
    },

    appendMessage(container, content, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message message-${type}`;
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <p>${content}</p>
            </div>
            <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        `;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', () => ChatComponent.init());
window.ChatComponent = ChatComponent;

function showGlobalNotification(message) {
    const toast = document.createElement('div');
    toast.className = 'glass-dark notification-toast';
    toast.innerHTML = `<i class="fas fa-bell"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('active'), 100);
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
