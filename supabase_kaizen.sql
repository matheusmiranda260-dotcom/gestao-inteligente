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

-- Create policies (permissive for this app's context)
CREATE POLICY "Enable all access for authenticated users" ON public.kaizen_problems
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.kaizen_problems
    FOR SELECT USING (true);

-- Create storage bucket for kaizen images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('kaizen-images', 'kaizen-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'kaizen-images' );
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'kaizen-images' AND auth.role() = 'authenticated' );
