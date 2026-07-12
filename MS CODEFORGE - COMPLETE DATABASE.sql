-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE project_status AS ENUM (
    'Concept', 'Research', 'Planning', 'Development',
    'Testing', 'Production', 'Maintenance', 'Archived'
);

CREATE TABLE projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    client_name VARCHAR(255),
    client_industry VARCHAR(100),
    status project_status DEFAULT 'Concept',
    category VARCHAR(100),
    featured BOOLEAN DEFAULT FALSE,
    published BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    tech_stack TEXT[],
    key_features TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    alt_text TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    status VARCHAR(20) DEFAULT 'Draft',
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[]
);

CREATE TABLE company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO admin_users (username, password, email) VALUES 
('mscodeforge369', '@dmin321', 'admin@mscodeforge.com');

INSERT INTO company_settings (key, value) VALUES
    ('company_name', '"MS CodeForge"'),
    ('tagline', '"Engineering Digital Infrastructure"'),
    ('description', '"We design, build and scale intelligent software systems that power businesses, homes, individuals and institutions worldwide."'),
    ('contact_email', '"info@mscodeforge369@gmail.com"'),
    ('contact_phone', '"+260 97 123 4567"'),
    ('contact_address', '"Lusaka, Zambia"'),
    ('accent_color', '"#2563EB"'),
    ('hero_title', '"ENGINEERING DIGITAL INFRASTRUCTURE"'),
    ('hero_subtitle', '"We design, build and scale intelligent software systems that power businesses and institutions worldwide."'),
    ('stats', '{"systems_built": 4, "client_satisfaction": "100%", "support_availability": "24/7"}');

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_projects" ON projects FOR SELECT USING (published = true);
CREATE POLICY "public_read_media" ON project_media FOR SELECT USING (true);
CREATE POLICY "public_read_blog" ON blog_posts FOR SELECT USING (status = 'Published');
CREATE POLICY "public_read_settings" ON company_settings FOR SELECT USING (true);
CREATE POLICY "admin_all_projects" ON projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_media" ON project_media FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_blog" ON blog_posts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_settings" ON company_settings FOR ALL USING (auth.role() = 'authenticated');