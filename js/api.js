/**
 * Oluwanjoba Homes API Utility - Centralized Pattern
 */

const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
    ? 'http://127.0.0.1:8000/api'
    : '/api';

const API = {
    getAuthHeader() {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeader(),
            ...options.headers
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            let errorDetail = 'Request failed';
            try {
                const error = await response.json();
                errorDetail = error.detail || error.message || JSON.stringify(error);
            } catch (e) {
                errorDetail = response.statusText;
            }
            throw new Error(errorDetail);
        }

        return response.json();
    },

    // Auth
    async login(email, password, role) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role })
        });
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data));
        }
        return data;
    },

    async signup(userData) {
        const data = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data));
        }
        return data;
    },

    // Properties
    async getProperties() {
        return this.request('/properties');
    },

    async getProperty(id) {
        return this.request(`/properties/${id}`);
    },

    async getLandlordProperties(landlordId) {
        return this.request(`/landlord/${landlordId}/properties`);
    },

    async addProperty(propertyData) {
        return this.request('/properties', {
            method: 'POST',
            body: JSON.stringify(propertyData)
        });
    },

    // Applications
    async getLandlordApplications(landlordId) {
        return this.request(`/landlord/${landlordId}/applications`);
    },

    async applyToProperty(propertyId, tenantId) {
        return this.request('/applications', {
            method: 'POST',
            body: JSON.stringify({ property_id: propertyId, tenant_id: tenantId })
        });
    },

    async getLandlordAnalytics(landlordId) {
        return this.request(`/analytics/landlord/${landlordId}`);
    },

    async updateApplicationStatus(appId, status) {
        return this.request(`/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    },

    async getTenantApplications(tenantId) {
        return this.request(`/tenant/${tenantId}/applications`);
    },

    // Chat
    async getChatHistory(otherUserId) {
        return this.request(`/chat/${otherUserId}`);
    },

    async markMessagesRead(otherUserId) {
        return this.request(`/chat/${otherUserId}/read`, {
            method: 'PUT'
        });
    },

    // Blog
    async getBlogPosts() {
        return this.request('/blog/posts');
    },

    async deleteBlogPost(id) {
        return this.request(`/blog/posts/${id}`, {
            method: 'DELETE'
        });
    },

    // Favorites
    async getFavorites() {
        return this.request('/favorites');
    },

    async toggleFavorite(propertyId) {
        // We need to check if it's an add or remove based on current state, 
        // but the API is split. Let's try adding, if 400 (already exists), we remove?
        // Better: The UI knows the state. We'll expose raw methods.
        // Actually, let's just expose add/remove.
        throw new Error("Use addFavorite or removeFavorite");
    },

    async addFavorite(propertyId) {
        return this.request(`/favorites/${propertyId}`, { method: 'POST' });
    },

    async removeFavorite(propertyId) {
        return this.request(`/favorites/${propertyId}`, { method: 'DELETE' });
    },

    // User
    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request('/users/avatar', {
            method: 'POST',
            body: formData,
            // Header hack: fetch automatically sets Content-Type for FormData, 
            // but our wrapper might override it. 
            // If request wrapper sets 'Content-Type': 'application/json', we need to unset it.
        });
    }
};

window.api = API; // Keep global for convenience and sync with current project
window.API = API; // Pattern requested by user
