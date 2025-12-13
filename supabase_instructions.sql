-- Work Instructions Table
CREATE TABLE IF NOT EXISTS public.work_instructions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    machine TEXT, -- The machine or function this applies to
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb, -- Array of { title, description, photoUrl, order }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.work_instructions ENABLE ROW LEVEL SECURITY;

-- Clean slate policies
DROP POLICY IF EXISTS "Public Select Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Insert Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Update Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Delete Instructions" ON public.work_instructions;

-- Permissive Policies
CREATE POLICY "Public Select Instructions" ON public.work_instructions FOR SELECT USING (true);
CREATE POLICY "Public Insert Instructions" ON public.work_instructions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Instructions" ON public.work_instructions FOR UPDATE USING (true);
CREATE POLICY "Public Delete Instructions" ON public.work_instructions FOR DELETE USING (true);

-- Storage for Instruction Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('instruction-images', 'instruction-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Instructions Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Instructions Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Instructions Public Update" ON storage.objects;

CREATE POLICY "Instructions Public Select" ON storage.objects 
FOR SELECT USING ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Insert" ON storage.objects 
FOR INSERT WITH CHECK ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Update" ON storage.objects 
FOR UPDATE USING ( bucket_id = 'instruction-images' );
