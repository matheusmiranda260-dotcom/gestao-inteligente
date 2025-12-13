-- 1. Cria o Bucket 'kb-files' (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-files', 'kb-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remove políticas antigas (se existirem) para evitar conflito
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;

-- 3. Cria as novas políticas (agora sem mexer na estrutura da tabela para evitar erros de permissão)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Updates" ON storage.objects FOR UPDATE USING ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Deletes" ON storage.objects FOR DELETE USING ( bucket_id = 'kb-files' );
