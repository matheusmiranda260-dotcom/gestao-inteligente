-- Create a new table for simple user management
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user', 'gestor')),
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DANGER: Drop existing policies to ensure clean slate (safe for this table)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.app_users;

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Create explicit policies for 'anon' and 'authenticated' roles
-- This allows anyone (even without login) to read/write to this table
-- Crucial for the custom auth system to work
CREATE POLICY "Enable read access for all users" ON public.app_users
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.app_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.app_users
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.app_users
    FOR DELETE USING (true);


-- Insert the default admin/gestor if not exists
INSERT INTO public.app_users (id, username, password, role, permissions)
VALUES 
    ('admin-001', 'gestor', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb),
    ('admin-002', 'matheusmiranda357@gmail.com', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb)
ON CONFLICT (username) DO NOTHING;
