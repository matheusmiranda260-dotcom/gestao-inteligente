-- Create General Company Documents Table
CREATE TABLE IF NOT EXISTS public.company_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    author TEXT,
    file_type TEXT
);

-- Enable RLS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- Policy for everything (keeping consistent with existing patterns in the project)
DROP POLICY IF EXISTS "Access company_documents" ON public.company_documents;
CREATE POLICY "Access company_documents" ON public.company_documents FOR ALL USING (true);
