-- Create a new table for simple user management
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user', 'gestor')),
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (permissive for now as per previous instructions)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON public.app_users
    FOR ALL USING (true) WITH CHECK (true);

-- Insert the default admin/gestor if not exists
INSERT INTO public.app_users (id, username, password, role, permissions)
VALUES 
    ('admin-001', 'gestor', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb),
    ('admin-002', 'matheusmiranda357@gmail.com', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb)
ON CONFLICT (username) DO NOTHING;
