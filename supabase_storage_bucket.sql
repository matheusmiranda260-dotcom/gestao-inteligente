
-- Create a public bucket for spare parts images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spare-parts', 'spare-parts', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access
CREATE POLICY "Public Read Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'spare-parts');

-- Policy to allow authenticated uploads
CREATE POLICY "Authenticated Upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

-- Policy to allow authenticated updates
CREATE POLICY "Authenticated Update" ON storage.objects 
FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');
