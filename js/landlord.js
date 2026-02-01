/**
 * Main Landlord Dashboard Controller
 */

const Dashboard = {
    async init() {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            window.location.href = '../../login.html';
            return;
        }
        try {
            const user = JSON.parse(userStr);
            if (!user.id && !user.userId) { // Check for ID variants
                console.error("User object missing ID:", user);
                throw new Error("Invalid user data");
            }
            // Normalize ID
            user.id = user.id || user.userId;
            window.DashboardState.user = user;

            // Update Profile UI
            const nameDisplay = document.getElementById('userNameDisplay');
            const avatarDisplay = document.getElementById('userAvatar');

            if (nameDisplay) nameDisplay.textContent = user.full_name || 'Landlord';
            if (avatarDisplay) avatarDisplay.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'User')}&background=4F46E5&color=fff`;
        } catch (e) {
            console.error(e);
            localStorage.removeItem('user');
            window.location.href = '../../login.html';
            return;
        }

        // Sidebar Navigation
        document.querySelectorAll('.menu-item[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadPage(link.dataset.page);
            });
        });

        // Initialize WebSocket
        window.DashboardSocket.connect(window.DashboardState.user.id);

        // Initial page load
        this.loadPage('analytics');
    },

    async loadPage(page) {
        const contentArea = document.getElementById('dashboard-content');
        contentArea.innerHTML = `<div class="flex-center" style="height: 300px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>`;

        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        try {
            const response = await fetch(`pages/${page}.html`);
            const html = await response.text();
            contentArea.innerHTML = html;
            window.DashboardState.currentPage = page;

            // Re-init shared UI components (modals)
            if (window.sharedInitModals) window.sharedInitModals();

            // Page specific init
            this.initPageScripts(page);
        } catch (err) {
            console.error('Page load failed:', err);
            contentArea.innerHTML = `<div class="flex-center" style="height: 300px; color: var(--danger)">Failed to load page content.</div>`;
        }
    },

    initPageScripts(page) {
        const userId = window.DashboardState.user.id;

        if (page === 'analytics') {
            this.loadAnalyticsData(userId);
        } else if (page === 'properties') {
            this.loadPropertiesData(userId);
            // Initialize modal upload zone after a short delay to ensure modal is in DOM
            setTimeout(() => this.initModalUploadZone(), 100);
        } else if (page === 'add-property') {
            this.initUploadZone();
        } else if (page === 'applications') {
            this.loadApplicationsData(userId);
        } else if (page === 'chat') {
            window.ChatComponent.init(); // Re-bind listeners to new DOM
            this.loadChatContacts(userId);
        }
    },

    async loadChatContacts(landlordId) {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        try {
            const apps = await window.api.getLandlordApplications(landlordId);

            // Deduplicate tenants
            const tenants = {};
            apps.forEach(app => {
                if (!tenants[app.tenant_id]) {
                    tenants[app.tenant_id] = {
                        id: app.tenant_id,
                        name: app.tenant_name,
                        email: app.tenant_email,
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(app.tenant_name)}&background=random&color=fff`,
                        property: app.property_title
                    };
                }
            });

            const tenantIds = Object.keys(tenants);
            chatList.innerHTML = '';

            if (tenantIds.length === 0) {
                chatList.innerHTML = '<div style="padding:1rem; text-align:center;">No tenants found. Wait for applications!</div>';
                return;
            }

            tenantIds.forEach(id => {
                const t = tenants[id];
                const div = document.createElement('div');
                div.className = 'contact-item'; // Use css/components/chat.css class
                div.innerHTML = `
                    <div style="position:relative;">
                        <img src="${t.avatar}" class="user-avatar" style="width:40px; height:40px; border-radius:50%;">
                        <!-- <span class="status-indicator online"></span> --> 
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${t.name} <span class="msg-time"></span></div>
                        <div class="last-msg">Interested in ${t.property}</div>
                    </div>
                `;
                div.onclick = () => {
                    document.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
                    div.classList.add('active');
                    window.ChatComponent.setActiveReceiver(t.id, t.name, t.avatar);
                };
                chatList.appendChild(div);
            });

        } catch (err) {
            console.error('Failed to load contacts', err);
            chatList.innerHTML = '<div style="padding:1rem; color:red;">Failed to load contacts</div>';
        }
    },

    async loadAnalyticsData(landlordId) {
        // Fetch and setup charts
        // This is a simplified version of the previous chart logic
        this.initCharts();

        // Load recent apps for the analytics card
        const apps = await window.api.getLandlordApplications(landlordId);
        const container = document.getElementById('recentAppsContainer');
        if (container) {
            container.innerHTML = apps.slice(0, 5).map(app => `
                <div class="property-item">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(app.tenant_name)}" class="user-img" alt="">
                    <div>
                        <div style="font-weight: 600;">${app.tenant_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted)">Applied for ${app.property_title}</div>
                    </div>
                    <div class="badge badge-${app.status}" style="margin-left: auto;">${app.status}</div>
                </div>
            `).join('') || '<div style="text-align: center; padding: 1rem;">No recent applications</div>';
        }
    },

    async loadPropertiesData(landlordId) {
        const properties = await window.api.getLandlordProperties(landlordId);
        window.DashboardState.properties = properties;
        this.renderPropertyList(properties);
    },

    renderPropertyList(properties) {
        const container = document.getElementById('propertyListContainer');
        if (!container) return;

        if (!properties || properties.length === 0) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No properties listed yet.</div>`;
            return;
        }

        container.innerHTML = properties.map(prop => `
            <div class="property-item">
                <img src="${prop.image_url}" class="property-thumb" alt="${prop.title}">
                <div>
                    <strong>${prop.title}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">0 Applications | ₦${prop.price}/mo</div>
                </div>
                <div class="property-actions">
                    <a href="../../property-detail.html?id=${prop.id}" class="btn-icon"><i class="fas fa-external-link-alt"></i></a>
                    <button class="btn-icon" onclick="Dashboard.handleEditProperty(${prop.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" style="color: var(--danger)" onclick="Dashboard.handleDeleteProperty(${prop.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    },

    async loadApplicationsData(landlordId) {
        const apps = await window.api.getLandlordApplications(landlordId);
        window.DashboardState.applications = apps;
        this.renderApplications(apps);
    },

    renderApplications(apps) {
        const container = document.getElementById('applicationsListContainer');
        if (!container) return;

        if (apps.length === 0) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No applications received yet.</div>`;
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Tenant</th>
                        <th>Property</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${apps.map(app => `
                        <tr>
                            <td>
                                <div style="font-weight: 600;">${app.tenant_name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted)">${app.tenant_email}</div>
                            </td>
                            <td>${app.property_title}</td>
                            <td>${new Date(app.applied_at).toLocaleDateString()}</td>
                            <td><span class="badge badge-${app.status}">${app.status}</span></td>
                            <td>
                                <div class="flex-center" style="gap: 0.5rem; justify-content: flex-start;">
                                    ${app.status === 'pending' ? `
                                        <button class="btn btn-primary btn-sm" onclick="Dashboard.handleApplicationAction(${app.id}, 'approved')">Approve</button>
                                        <button class="btn btn-outline btn-sm" onclick="Dashboard.handleApplicationAction(${app.id}, 'declined')" style="color: var(--danger)">Decline</button>
                                    ` : `
                                        <button class="btn btn-outline btn-sm" disabled>${app.status.charAt(0).toUpperCase() + app.status.slice(1)}</button>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async handleApplicationAction(appId, status) {
        try {
            await window.api.updateApplicationStatus(appId, status);
            alert(`Application ${status}!`);
            this.loadPage('applications'); // Refresh
        } catch (err) {
            alert('Action failed: ' + err.message);
        }
    },

    // Helper for validation
    validatePropertyForm(formData, imageFiles) {
        // 1. Basic Fields
        if (!formData.get('title') || formData.get('title').length < 5) return 'Title must be at least 5 characters.';
        if (!formData.get('location') || formData.get('location').length < 3) return 'Please provide a valid location.';

        // 2. Numeric Validation
        const price = parseFloat(formData.get('price'));
        const sqft = parseFloat(formData.get('sqft'));
        const beds = parseInt(formData.get('bedrooms'));
        const baths = parseInt(formData.get('bathrooms'));

        if (isNaN(price) || price <= 0) return 'Price must be a positive number.';
        if (isNaN(sqft) || sqft <= 0) return 'Square footage must be a positive number.';
        if (isNaN(beds) || beds < 0) return 'Bedrooms cannot be negative.';
        if (isNaN(baths) || baths < 0) return 'Bathrooms cannot be negative.';

        // 3. File Validation
        if (imageFiles.length > 0) {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    return `File "${file.name}" exceeds the 5MB size limit.`;
                }
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    return `File "${file.name}" is not a supported image type (JPG, PNG, WebP only).`;
                }
            }
        } else {
            // Optional: Require at least one image? 
            // return 'Please upload at least one image of the property.';
        }

        return null; // No errors
    },

    async handleDedicatedAddProperty(event) {
        event.preventDefault();
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.owner_id = window.DashboardState.user.id;

        const imageFiles = document.getElementById('propertyImages').files;

        // Validate
        const error = this.validatePropertyForm(formData, imageFiles);
        if (error) {
            alert(error);
            return;
        }

        // Lock UI
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

        if (imageFiles.length > 0) {
            // Process all images
            try {
                const imagePromises = Array.from(imageFiles).map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsDataURL(file);
                    });
                });

                const base64Images = await Promise.all(imagePromises);
                data.images = base64Images; // Send array of base64 strings
                data.image_url = base64Images[0]; // Keep primary for backward compatibility
            } catch (e) {
                console.error("Image processing error", e);
                alert("Failed to process images. Please try again.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                return;
            }
        } else {
            // Default if no image
            data.image_url = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800';
            data.images = [];
        }

        try {
            await window.api.addProperty(data);
            alert('Property published successfully!');
            this.loadPage('properties');
        } catch (err) {
            alert('Failed to publish property: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    },

    async handleAddProperty(event) {
        event.preventDefault();
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.owner_id = window.DashboardState.user.id;

        const imageFiles = document.getElementById('modalPropertyImages').files;

        // Validate
        const error = this.validatePropertyForm(formData, imageFiles);
        if (error) {
            alert(error);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        if (imageFiles.length > 0) {
            data.image_url = document.getElementById('modalFeaturedImageUrl').value || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800';
        } else {
            data.image_url = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800';
        }

        try {
            await window.api.addProperty(data);
            alert('Property added successfully!');
            document.getElementById('addPropertyModal').classList.remove('active');
            this.loadPage('properties');
        } catch (err) {
            alert('Failed to add property: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    },

    initModalUploadZone() {
        const zone = document.getElementById('modalImageUploadZone');
        const input = document.getElementById('modalPropertyImages');
        const previewContainer = document.getElementById('modalImagePreviewContainer');
        const featuredInput = document.getElementById('modalFeaturedImageUrl');

        if (!zone || !input) return;

        // Drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.add('dragover'));
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.remove('dragover'));
        });

        zone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files, previewContainer, featuredInput);
        });

        input.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, previewContainer, featuredInput);
        });
    },

    initCharts() {
        // Placeholder chart logic from previous implementation
        const ctxApp = document.getElementById('applicationsChart');
        if (!ctxApp) return;

        new Chart(ctxApp.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Applications',
                    data: [12, 19, 15, 25, 22, 30, 28],
                    borderColor: '#4F46E5',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(79, 70, 229, 0.1)'
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        const ctxViews = document.getElementById('viewsChart');
        if (!ctxViews) return;

        new Chart(ctxViews.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Villa', 'Studio', 'House'],
                datasets: [{
                    label: 'Views',
                    data: [850, 620, 480],
                    backgroundColor: '#4F46E5',
                    borderRadius: 5
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });
    }
};

window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', () => Dashboard.init());
