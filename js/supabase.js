// ============================================
// MS CODEFORGE - Supabase Client
// ============================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class MS_CodeForge_API {
    // ==========================================
    // AUTH - Check admin_users table directly
    // ==========================================
    
    static async signIn(username, password) {
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Invalid credentials');
        }

        sessionStorage.setItem('admin_user', JSON.stringify(data));
        return data;
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
        return !!sessionStorage.getItem('admin_user');
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
        data.forEach(item => {
            settings[item.key] = item.value;
        });
        return settings;
    }

    static async updateSetting(key, value) {
        const { data, error } = await supabase
            .from('company_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}