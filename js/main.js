// ============================================
// MS CODEFORGE - Public Website
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadCompanyData();
    loadFeaturedWork();
    loadPortfolio();
    loadInsights();
    initContactForm();
});

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileMenu = document.getElementById('mobileMenu');
    const navLinks = document.querySelector('.nav-links');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// ============================================
// LOAD COMPANY DATA
// ============================================

async function loadCompanyData() {
    try {
        const settings = await MS_CodeForge_API.getSettings();
        
        if (settings.hero_title) {
            document.getElementById('heroTitle').textContent = settings.hero_title;
        }
        if (settings.hero_subtitle) {
            document.getElementById('heroSubtitle').textContent = settings.hero_subtitle;
        }
        if (settings.contact_email) {
            document.getElementById('contactEmail').textContent = settings.contact_email;
            document.getElementById('contactEmail').href = `mailto:${settings.contact_email}`;
        }
        if (settings.contact_phone) {
            document.getElementById('contactPhone').textContent = settings.contact_phone;
        }
        if (settings.contact_address) {
            document.getElementById('contactAddress').textContent = settings.contact_address;
        }
        if (settings.accent_color) {
            document.documentElement.style.setProperty('--accent', settings.accent_color);
        }
        
        if (settings.stats) {
            const stats = settings.stats;
            if (stats.systems_built) {
                document.getElementById('statSystems').textContent = stats.systems_built;
            }
            if (stats.client_satisfaction) {
                document.getElementById('statSatisfaction').textContent = stats.client_satisfaction;
            }
            if (stats.support_availability) {
                document.getElementById('statSupport').textContent = stats.support_availability;
            }
        }
    } catch (error) {
        console.error('Failed to load company data:', error);
    }
}

// ============================================
// LOAD FEATURED WORK
// ============================================

async function loadFeaturedWork() {
    try {
        const project = await MS_CodeForge_API.getFeaturedProject();
        const container = document.getElementById('featuredProjectContainer');
        
        if (!project) {
            container.innerHTML = `
                <div class="featured-project">
                    <div class="project-details" style="padding: 32px;">
                        <h3>Featured Project</h3>
                        <p class="project-description">Explore our portfolio to see our engineering capabilities.</p>
                    </div>
                </div>
            `;
            return;
        }

        const media = project.project_media || [];
        const primaryImage = media.find(m => m.is_primary) || media[0];
        const techStack = project.tech_stack || [];

        container.innerHTML = `
            <div class="featured-project">
                <div class="project-image">
                    ${primaryImage ? `<img src="${primaryImage.url}" alt="${project.title}">` : '🏗️'}
                </div>
                <div class="project-details">
                    <span class="project-status">${project.status || 'Development'}</span>
                    <h3>${project.title}</h3>
                    ${project.subtitle ? `<p style="color: var(--gray-400); font-size: 0.875rem; margin-bottom: 8px;">${project.subtitle}</p>` : ''}
                    <p class="project-description">${project.description || 'Enterprise-grade system engineering.'}</p>
                    ${techStack.length > 0 ? `
                        <div class="project-tech">
                            ${techStack.map(tech => `<span>${tech}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load featured work:', error);
    }
}

// ============================================
// LOAD PORTFOLIO
// ============================================

async function loadPortfolio() {
    try {
        const projects = await MS_CodeForge_API.getProjects({ limit: 6 });
        const grid = document.getElementById('portfolioGrid');
        
        if (!projects || projects.length === 0) {
            grid.innerHTML = `
                <div class="portfolio-card">
                    <div class="card-content" style="padding:24px;">
                        <h3>No Projects Yet</h3>
                        <p>Check back soon for our latest engineering work.</p>
                    </div>
                </div>
            `;
            return;
        }

        grid.innerHTML = projects.map(project => {
            const media = project.project_media || [];
            const primaryImage = media.find(m => m.is_primary) || media[0];
            const techStack = project.tech_stack || [];

            return `
                <div class="portfolio-card">
                    <div class="card-image">
                        ${primaryImage ? `<img src="${primaryImage.url}" alt="${project.title}">` : '📦'}
                    </div>
                    <div class="card-content">
                        <span class="project-status status-${project.status?.toLowerCase()}">${project.status || 'Concept'}</span>
                        <h3>${project.title}</h3>
                        <p>${project.description || 'Enterprise system engineering.'}</p>
                        ${techStack.length > 0 ? `
                            <div class="card-tags">
                                ${techStack.map(tech => `<span>${tech}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load portfolio:', error);
    }
}

// ============================================
// LOAD INSIGHTS
// ============================================

async function loadInsights() {
    try {
        const posts = await MS_CodeForge_API.getBlogPosts({ limit: 3 });
        const grid = document.getElementById('insightsGrid');
        
        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div class="insight-card">
                    <div class="insight-content" style="padding:24px;">
                        <h3>Engineering Insights</h3>
                        <p>Stay tuned for our latest perspectives on software engineering.</p>
                    </div>
                </div>
            `;
            return;
        }

        grid.innerHTML = posts.map(post => `
            <div class="insight-card">
                <div class="insight-image">
                    ${post.featured_image ? `<img src="${post.featured_image}" alt="${post.title}">` : '📄'}
                </div>
                <div class="insight-content">
                    <div class="insight-date">${formatDate(post.published_at || post.created_at)}</div>
                    <h3>${post.title}</h3>
                    <p>${post.excerpt || post.content?.substring(0, 120) + '...' || ''}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load insights:', error);
    }
}

// ============================================
// CONTACT FORM
// ============================================

function initContactForm() {
    const form = document.getElementById('contactForm');
    const feedback = document.getElementById('formFeedback');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmailInput').value.trim();
        const company = document.getElementById('contactCompany').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!name || !email || !message) {
            showFeedback('Please complete all required fields.', 'error');
            return;
        }

        const submitBtn = form.querySelector('.btn-primary');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            showFeedback('Thank you. Our engineering team will respond within 24 hours.', 'success');
            form.reset();
        } catch (error) {
            showFeedback('Failed to submit. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function showFeedback(message, type) {
    const feedback = document.getElementById('formFeedback');
    feedback.textContent = message;
    feedback.className = `form-feedback ${type}`;
    feedback.style.display = 'block';
    
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 6000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}