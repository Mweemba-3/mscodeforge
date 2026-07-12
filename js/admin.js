// ============================================
// MS CODEFORGE - Admin Dashboard
// ============================================

document.addEventListener('DOMContentLoaded', function() {
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

    // FIXED: Use event listener properly
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // THIS PREVENTS PAGE REFRESH
            
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const errorEl = document.getElementById('loginError');
            
            // Hide any previous error
            errorEl.style.display = 'none';
            
            // Validate inputs
            if (!username || !password) {
                errorEl.textContent = 'Please enter both username and password';
                errorEl.style.display = 'block';
                return;
            }
            
            try {
                // Show loading state
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Signing in...';
                submitBtn.disabled = true;
                
                // Attempt login
                await MS_CodeForge_API.signIn(username, password);
                
                // Show dashboard
                showDashboard();
                loadDashboardData();
                
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                
            } catch (error) {
                errorEl.textContent = error.message || 'Invalid credentials';
                errorEl.style.display = 'block';
                
                // Reset button
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Sign In';
                submitBtn.disabled = false;
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            await MS_CodeForge_API.signOut();
            showLogin();
        });
    }
}

function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboardScreen) dashboardScreen.style.display = 'block';
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboardScreen) dashboardScreen.style.display = 'none';
    
    // Clear form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
}

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            document.querySelectorAll('.view-panel').forEach(function(p) {
                p.classList.remove('active');
            });
            document.getElementById('view-' + this.dataset.view).classList.add('active');
        });
    });

    document.querySelectorAll('.action-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            document.querySelectorAll('.nav-item').forEach(function(b) {
                b.classList.remove('active');
            });
            document.querySelector('.nav-item[data-view="' + view + '"]').classList.add('active');
            
            document.querySelectorAll('.view-panel').forEach(function(p) {
                p.classList.remove('active');
            });
            document.getElementById('view-' + view).classList.add('active');
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
        
        const totalProjects = document.getElementById('totalProjects');
        const publishedProjects = document.getElementById('publishedProjects');
        const totalBlogPosts = document.getElementById('totalBlogPosts');
        const publishedPosts = document.getElementById('publishedPosts');
        
        if (totalProjects) totalProjects.textContent = projects?.length || 0;
        if (publishedProjects) publishedProjects.textContent = projects?.filter(function(p) { return p.published; }).length || 0;
        if (totalBlogPosts) totalBlogPosts.textContent = posts?.length || 0;
        if (publishedPosts) publishedPosts.textContent = posts?.filter(function(p) { return p.status === 'Published'; }).length || 0;
        
        const user = await MS_CodeForge_API.getCurrentUser();
        const adminUser = document.getElementById('adminUser');
        if (adminUser && user) adminUser.textContent = user.username;
        
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
    const addBtn = document.getElementById('addProjectBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            document.getElementById('projectModalTitle').textContent = 'New Project';
            document.getElementById('projectForm').reset();
            document.getElementById('projectFormId').value = '';
            document.getElementById('projectModal').classList.add('active');
        });
    }

    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
        projectForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('projectFormId').value;
            const data = {
                title: document.getElementById('projectTitle').value,
                slug: document.getElementById('projectSlug').value,
                description: document.getElementById('projectDescription').value,
                status: document.getElementById('projectStatus').value,
                tech_stack: document.getElementById('projectTechStack').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
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
}

function renderProjectsAdmin(projects) {
    const grid = document.getElementById('projectsAdminGrid');
    if (!grid) return;
    
    if (!projects || projects.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-500);">No projects yet.</p>';
        return;
    }

    grid.innerHTML = projects.map(function(p) {
        return `
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
        `;
    }).join('');
}

async function editProject(id) {
    const projects = await MS_CodeForge_API.getAllProjects();
    const project = projects.find(function(p) { return p.id === id; });
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
    const addBtn = document.getElementById('addBlogBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            document.getElementById('blogModalTitle').textContent = 'New Blog Post';
            document.getElementById('blogForm').reset();
            document.getElementById('blogFormId').value = '';
            document.getElementById('blogModal').classList.add('active');
        });
    }

    const blogForm = document.getElementById('blogForm');
    if (blogForm) {
        blogForm.addEventListener('submit', async function(e) {
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
}

function renderBlogAdmin(posts) {
    const grid = document.getElementById('blogAdminGrid');
    if (!grid) return;
    
    if (!posts || posts.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-500);">No blog posts yet.</p>';
        return;
    }

    grid.innerHTML = posts.map(function(p) {
        return `
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
        `;
    }).join('');
}

async function editBlogPost(id) {
    const posts = await MS_CodeForge_API.getAllBlogPosts();
    const post = posts.find(function(p) { return p.id === id; });
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
        const fields = {
            settingsCompanyName: 'company_name',
            settingsTagline: 'tagline',
            settingsEmail: 'contact_email',
            settingsPhone: 'contact_phone',
            settingsAddress: 'contact_address',
            settingsAccentColor: 'accent_color',
            settingsHeroTitle: 'hero_title',
            settingsHeroSubtitle: 'hero_subtitle'
        };
        
        for (const [id, key] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.value = settings[key] || '';
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

function initSettings() {
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
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
                
                setTimeout(function() {
                    feedback.style.display = 'none';
                }, 3000);
            } catch (error) {
                feedback.textContent = 'Failed to save settings: ' + error.message;
                feedback.className = 'form-feedback error';
                feedback.style.display = 'block';
            }
        });
    }
}

// ============================================
// MODAL HELPERS
// ============================================

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modals on outside click
document.querySelectorAll('.modal-overlay').forEach(function(modal) {
    modal.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

// Make functions global for onclick attributes
window.editProject = editProject;
window.deleteProject = deleteProject;
window.editBlogPost = editBlogPost;
window.deleteBlogPost = deleteBlogPost;
window.closeModal = closeModal;
