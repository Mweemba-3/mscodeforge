// ============================================
// MS CODEFORGE - Supabase Client
// ============================================

const SUPABASE_URL = 'https://abdvokmzvnezyijebxmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHZva216dm5lenlpamVieG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODQ2ODAsImV4cCI6MjA5OTQ2MDY4MH0.iWUs4fInt8oQZm4Bo2Ql7TA1p98fN5BbyQ2ZGAC_Wio';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class MS_CodeForge_API {
    // ==========================================
    // AUTH - Check admin_users table directly
    // ==========================================
    
    static async signIn(username, password) {
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !data) {
                throw new Error('Invalid credentials');
            }

            // Store session
            sessionStorage.setItem('admin_user', JSON.stringify(data));
            return data;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    static async signOut() {
        sessionStorage.removeItem('admin_user');
        return true;
    }

    static async getCurrentUser() {
        const user = sessionStorage.getItem('admin_user');
        return user ? JSON.parse(user) : null;
    }

    static async isAuthenticated() {
        const user = sessionStorage.getItem('admin_user');
        return user !== null && user !== undefined;
    }

    // ==========================================
    // PROJECTS
    // ==========================================
    
    static async getProjects(options = {}) {
        let query = supabase
            .from('projects')
            .select('*, project_media(*)')
            .eq('published', true)
            .order('display_order', { ascending: true });

        if (options.featured) query = query.eq('featured', true);
        if (options.status) query = query.eq('status', options.status);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async getFeaturedProject() {
        const { data, error } = await supabase
            .from('projects')
            .select('*, project_media(*)')
            .eq('featured', true)
            .eq('published', true)
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }

    static async getAllProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select('*, project_media(*)')
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data;
    }

    static async createProject(projectData) {
        const { data, error } = await supabase
            .from('projects')
            .insert([projectData])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async updateProject(id, projectData) {
        const { data, error } = await supabase
            .from('projects')
            .update(projectData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async deleteProject(id) {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    // ==========================================
    // BLOG
    // ==========================================
    
    static async getBlogPosts(options = {}) {
        let query = supabase
            .from('blog_posts')
            .select('*')
            .eq('status', 'Published')
            .order('published_at', { ascending: false });

        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async getAllBlogPosts() {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    static async createBlogPost(postData) {
        const { data, error } = await supabase
            .from('blog_posts')
            .insert([postData])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async updateBlogPost(id, postData) {
        const { data, error } = await supabase
            .from('blog_posts')
            .update(postData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async deleteBlogPost(id) {
        const { error } = await supabase
            .from('blog_posts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    // ==========================================
    // SETTINGS
    // ==========================================
    
    static async getSettings() {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*');

        if (error) throw error;
        
        const settings = {};
        data.forEach(function(item) {
            settings[item.key] = item.value;
        });
        return settings;
    }

    static async updateSetting(key, value) {
        const { data, error } = await supabase
            .from('company_settings')
            .update({ value: value, updated_at: new Date().toISOString() })
            .eq('key', key)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}
