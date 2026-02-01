/**
 * Shared logic for Property Rental Management Platform
 */

document.addEventListener('DOMContentLoaded', () => {
    // Sidebar Toggle Logic
    const initSidebar = () => {
        // Support multiple toggle buttons (e.g. if we add one in sidebar)
        const toggleBtns = document.querySelectorAll('.sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');

        if (toggleBtns.length > 0 && sidebar) {
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent immediate closing if bubbling
                    sidebar.classList.toggle('active');
                    if (overlay) overlay.classList.toggle('active');
                    console.log('Sidebar toggled via', btn);
                });
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        // Close when clicking menu items on mobile
        if (window.innerWidth < 1024) {
            const menuItems = document.querySelectorAll('.menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    // Don't close if it's a dropdown toggle (if any)
                    sidebar.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                });
            });
        }
    };

    // Notification Badge Update Simulation
    const updateNotifBadges = (count) => {
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        });
    };

    // Modal Manager
    const initModals = () => {
        const modalTriggers = document.querySelectorAll('[data-modal]');
        const closeTriggers = document.querySelectorAll('.modal-close');

        modalTriggers.forEach(trigger => {
            trigger.onclick = () => {
                const target = document.getElementById(trigger.dataset.modal);
                if (target) target.classList.add('active');
            };
        });

        closeTriggers.forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal');
                if (modal) modal.classList.remove('active');
            };
        });
    };

    window.sharedInitModals = initModals;

    // Mobile Menu Toggle
    const initMobileMenu = () => {
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');

        if (mobileBtn && navLinks) {
            // Initial state
            mobileBtn.setAttribute('aria-expanded', 'false');
            mobileBtn.setAttribute('aria-label', 'Toggle navigation menu');

            mobileBtn.addEventListener('click', () => {
                const isExpanded = navLinks.classList.toggle('active');
                mobileBtn.setAttribute('aria-expanded', isExpanded);

                // Toggle icon
                const icon = mobileBtn.querySelector('i');
                if (icon) {
                    if (isExpanded) {
                        icon.classList.remove('fa-bars');
                        icon.classList.add('fa-times');
                    } else {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }
            });
        }
    };

    // Initialize components
    initSidebar();
    initMobileMenu();
    initModals();

    // Simulate real-time notification update
    setTimeout(() => updateNotifBadges(3), 2000);

    // Global Avatar Helper
    window.renderUserAvatar = (user, size = 100) => {
        if (user && user.avatar_url) {
            return user.avatar_url;
        }
        const name = user ? user.full_name : 'User';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&size=${size}`;
    };

    // Update Sidebar Avatar on Load
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        // Sidebar usually not accessible here easily without selector, 
        // relying on specific pages to set it, or common layout.
        // Let's try to update common elements if they exist
        const topNavImg = document.querySelector('.user-profile .user-img');
        if (topNavImg) topNavImg.src = window.renderUserAvatar(user, 100);

        const sidebarName = document.querySelector('.user-profile-preview h4');
        const sidebarImg = document.querySelector('.user-profile-preview .avatar-sm');

        if (sidebarName) sidebarName.textContent = user.full_name;
        if (sidebarImg) sidebarImg.src = window.renderUserAvatar(user, 100);
    }
});
