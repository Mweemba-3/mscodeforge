// ============================================
// MS CODEFORGE - Admin Dashboard
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initProjects();
    initBlog();
    initSettings();
});

// ============================================
// AUTH
// ============================================

async function initAuth() {
    const isAuth = await MS_CodeForge_API.isAuthenticated();
    
    if (isAuth) {
        showDashboard();
    } else {
        showLogin();
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        
        try {
            errorEl.style.display = 'none';
            await MS_CodeForge_API.signIn(username, password);
            showDashboard();
        } catch (error) {
            errorEl.textContent = error.message || 'Invalid credentials';
            errorEl.style.display = 'block';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await MS_CodeForge_API.signOut();
        showLogin();
    });
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'block';
    loadDashboardData();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardScreen').style.display = 'none';
}

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
        });
    });

    // Quick action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');
            
            document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');
        });
    });
}

// ============================================
// DASHBOARD DATA
// ============================================

async function loadDashboardData() {
    try {
        const projects = await MS_CodeForge_API.getAllProjects();
        const posts = await MS_CodeForge_API.getAllBlogPosts();
        
        document.getElementById('totalProjects').textContent = projects?.length || 0;
        document.getElementById('publishedProjects').textContent = projects?.filter(p => p.published).length || 0;
        document.getElementById('totalBlogPosts').textContent = posts?.length || 0;
        document.getElementById('publishedPosts').textContent = posts?.filter(p => p.status === 'Published').length || 0;
        
        const user = await MS_CodeForge_API.getCurrentUser();
        if (user) document.getElementById('adminUser').textContent = user.username;
        
        renderProjectsAdmin(projects);
        renderBlogAdmin(posts);
        loadSettings();
    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}

// ============================================
// PROJECTS ADMIN
// ============================================

function initProjects() {
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        document.getElementById('projectModalTitle').textContent = 'New Project';
        document.getElementById('projectForm').reset();
        document.getElementById('projectFormId').value = '';
        document.getElementById('projectModal').classList.add('active');
    });

    document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('projectFormId').value;
        const data = {
            title: document.getElementById('projectTitle').value,
            slug: document.getElementById('projectSlug').value,
            description: document.getElementById('projectDescription').value,
            status: document.getElementById('projectStatus').value,
            tech_stack: document.getElementById('projectTechStack').value.split(',').map(s => s.trim()).filter(Boolean),
            featured: document.getElementById('projectFeatured').checked,
            published: document.getElementById('projectPublished').checked
        };

        try {
            if (id) {
                await MS_CodeForge_API.updateProject(id, data);
            } else {
                await MS_CodeForge_API.createProject(data);
            }
            document.getElementById('projectModal').classList.remove('active');
            loadDashboardData();
        } catch (error) {
            alert('Failed to save project: ' + error.message);
        }
    });
}

function renderProjectsAdmin(projects) {
    const grid = document.getElementById('projectsAdminGrid');
    if (!projects || projects.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-500);">No projects yet.</p>';
        return;
    }

    grid.innerHTML = projects.map(p => `
        <div class="admin-item">
            <div>
                <h4>${p.title}</h4>
                <span class="item-meta">${p.status || 'Concept'}${p.published ? ' ● Published' : ''}</span>
            </div>
            <div class="item-actions">
                <button class="edit-btn" onclick="editProject('${p.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteProject('${p.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editProject(id) {
    const projects = await MS_CodeForge_API.getAllProjects();
    const project = projects.find(p => p.id === id);
    if (!project) return;

    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectFormId').value = project.id;
    document.getElementById('projectTitle').value = project.title;
    document.getElementById('projectSlug').value = project.slug;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectStatus').value = project.status || 'Concept';
    document.getElementById('projectTechStack').value = (project.tech_stack || []).join(', ');
    document.getElementById('projectFeatured').checked = project.featured || false;
    document.getElementById('projectPublished').checked = project.published || false;
    document.getElementById('projectModal').classList.add('active');
}

async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    await MS_CodeForge_API.deleteProject(id);
    loadDashboardData();
}

// ============================================
// BLOG ADMIN
// ============================================

function initBlog() {
    document.getElementById('addBlogBtn').addEventListener('click', () => {
        document.getElementById('blogModalTitle').textContent = 'New Blog Post';
        document.getElementById('blogForm').reset();
        document.getElementById('blogFormId').value = '';
        document.getElementById('blogModal').classList.add('active');
    });

    document.getElementById('blogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('blogFormId').value;
        const data = {
            title: document.getElementById('blogTitle').value,
            slug: document.getElementById('blogSlug').value,
            excerpt: document.getElementById('blogExcerpt').value,
            content: document.getElementById('blogContent').value,
            status: document.getElementById('blogStatus').value
        };

        try {
            if (id) {
                await MS_CodeForge_API.updateBlogPost(id, data);
            } else {
                await MS_CodeForge_API.createBlogPost(data);
            }
            document.getElementById('blogModal').classList.remove('active');
            loadDashboardData();
        } catch (error) {
            alert('Failed to save blog post: ' + error.message);
        }
    });
}

function renderBlogAdmin(posts) {
    const grid = document.getElementById('blogAdminGrid');
    if (!posts || posts.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-500);">No blog posts yet.</p>';
        return;
    }

    grid.innerHTML = posts.map(p => `
        <div class="admin-item">
            <div>
                <h4>${p.title}</h4>
                <span class="item-meta">${p.status || 'Draft'}${p.status === 'Published' ? ' ● Published' : ''}</span>
            </div>
            <div class="item-actions">
                <button class="edit-btn" onclick="editBlogPost('${p.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteBlogPost('${p.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editBlogPost(id) {
    const posts = await MS_CodeForge_API.getAllBlogPosts();
    const post = posts.find(p => p.id === id);
    if (!post) return;

    document.getElementById('blogModalTitle').textContent = 'Edit Blog Post';
    document.getElementById('blogFormId').value = post.id;
    document.getElementById('blogTitle').value = post.title;
    document.getElementById('blogSlug').value = post.slug;
    document.getElementById('blogExcerpt').value = post.excerpt || '';
    document.getElementById('blogContent').value = post.content || '';
    document.getElementById('blogStatus').value = post.status || 'Draft';
    document.getElementById('blogModal').classList.add('active');
}

async function deleteBlogPost(id) {
    if (!confirm('Delete this post?')) return;
    await MS_CodeForge_API.deleteBlogPost(id);
    loadDashboardData();
}

// ============================================
// SETTINGS
// ============================================

async function loadSettings() {
    try {
        const settings = await MS_CodeForge_API.getSettings();
        document.getElementById('settingsCompanyName').value = settings.company_name || '';
        document.getElementById('settingsTagline').value = settings.tagline || '';
        document.getElementById('settingsEmail').value = settings.contact_email || '';
        document.getElementById('settingsPhone').value = settings.contact_phone || '';
        document.getElementById('settingsAddress').value = settings.contact_address || '';
        document.getElementById('settingsAccentColor').value = settings.accent_color || '#2563EB';
        document.getElementById('settingsHeroTitle').value = settings.hero_title || '';
        document.getElementById('settingsHeroSubtitle').value = settings.hero_subtitle || '';
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

function initSettings() {
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('settingsFeedback');
        
        try {
            const settings = {
                company_name: document.getElementById('settingsCompanyName').value,
                tagline: document.getElementById('settingsTagline').value,
                contact_email: document.getElementById('settingsEmail').value,
                contact_phone: document.getElementById('settingsPhone').value,
                contact_address: document.getElementById('settingsAddress').value,
                accent_color: document.getElementById('settingsAccentColor').value,
                hero_title: document.getElementById('settingsHeroTitle').value,
                hero_subtitle: document.getElementById('settingsHeroSubtitle').value
            };

            for (const [key, value] of Object.entries(settings)) {
                await MS_CodeForge_API.updateSetting(key, value);
            }

            feedback.textContent = 'Settings saved successfully!';
            feedback.className = 'form-feedback success';
            feedback.style.display = 'block';
            
            setTimeout(() => {
                feedback.style.display = 'none';
            }, 3000);
        } catch (error) {
            feedback.textContent = 'Failed to save settings: ' + error.message;
            feedback.className = 'form-feedback error';
            feedback.style.display = 'block';
        }
    });
}

// ============================================
// MODAL HELPERS
// ============================================

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modals on outside click
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
});