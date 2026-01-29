/**
 * Admin Dashboard Logic
 */

const AdminDashboard = {
    init() {
        this.checkAuth();
        this.loadBlogPosts();
        this.initForms();

        // Expose to window for inline onclicks
        window.AdminDashboard = this;
    },

    checkAuth() {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            window.location.href = '../../login.html';
            return;
        }
        const user = JSON.parse(userStr);
        if (user.role !== 'admin') {
            alert('Access Denied: Admins Only');
            window.location.href = '../../index.html';
        }

        // Update UI
        document.getElementById('userName').textContent = user.full_name;
    },

    async loadBlogPosts() {
        const tbody = document.getElementById('blogTableBody');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const posts = await window.api.getBlogPosts(); // Reuse existing generic getter

            if (posts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3">No posts found.</td></tr>';
                return;
            }

            tbody.innerHTML = posts.map(post => `
                <tr>
                    <td>
                        <div style="font-weight: 500;">${post.title}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 300px;">
                            ${post.content.substring(0, 50)}...
                        </div>
                    </td>
                    <td>${new Date(post.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline text-danger" onclick="window.AdminDashboard.deletePost(${post.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger p-3">Failed to load posts.</td></tr>';
        }
    },

    openCreateModal() {
        document.getElementById('createPostModal').classList.add('active');
    },

    initForms() {
        document.getElementById('createPostForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerHTML;

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            const user = JSON.parse(localStorage.getItem('user'));

            const data = {
                title: formData.get('title'),
                content: formData.get('content'),
                image_url: formData.get('image_url') || null,
                author_id: user.id
            };

            try {
                // We reuse the existing endpoint via API utility
                // NOTE: We need to add createBlogPost to api.js or just use request directly if not there
                // We added it directly in main.py, let's assume we add to api.js or call generic
                await window.api.request('/blog/posts', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });

                alert('Post published successfully!');
                document.getElementById('createPostModal').classList.remove('active');
                e.target.reset();
                this.loadBlogPosts(); // Refresh list

            } catch (err) {
                alert('Failed to publish: ' + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    },

    async deletePost(id) {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

        try {
            await window.api.deleteBlogPost(id);
            this.loadBlogPosts(); // Refresh
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminDashboard.init();
});
