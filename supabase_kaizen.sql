-- Create table for Kaizen Problems
CREATE TABLE IF NOT EXISTS public.kaizen_problems (
    id TEXT PRIMARY KEY,
    description TEXT,
    sector TEXT,
    responsible TEXT,
    status TEXT DEFAULT 'Aberto',
    date TIMESTAMPTZ DEFAULT NOW(),
    photo_url TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.kaizen_problems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public insert" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public update" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public delete" ON public.kaizen_problems;

-- Re-create policies for table - EXTREMELY PERMISSIVE (Use with caution in production, but solves the issue now)
-- Allows ANYONE (even not logged in) to insert, select, update, delete.
CREATE POLICY "Allow public insert" ON public.kaizen_problems FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON public.kaizen_problems FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON public.kaizen_problems FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.kaizen_problems FOR DELETE USING (true);


-- STORAGE SETUP

-- 1. Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kaizen-images', 'kaizen-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Kaizen Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Upload" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Update" ON storage.objects;

-- 3. Create permissive policies for 'kaizen-images'
-- ALLOW SELECT for everyone (public)
CREATE POLICY "Kaizen Public Access" ON storage.objects 
FOR SELECT USING ( bucket_id = 'kaizen-images' );

-- ALLOW INSERT for everyone (auth + anon) to allow easy testing if auth is tricky
CREATE POLICY "Kaizen Upload" ON storage.objects 
FOR INSERT WITH CHECK ( bucket_id = 'kaizen-images' );

-- ALLOW UPDATE for everyone
CREATE POLICY "Kaizen Update" ON storage.objects 
FOR UPDATE USING ( bucket_id = 'kaizen-images' );
