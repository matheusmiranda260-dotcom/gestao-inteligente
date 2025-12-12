
-- Fix Storage Policies for 'spare-parts'

-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spare-parts', 'spare-parts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop potential conflicting policies for this bucket
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_read" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_insert" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_update" ON storage.objects;

-- 3. Create Permissive Policies for 'spare-parts' bucket (Allow Anon + Auth)
CREATE POLICY "spare_parts_read" ON storage.objects 
FOR SELECT USING (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_insert" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_update" ON storage.objects 
FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');
