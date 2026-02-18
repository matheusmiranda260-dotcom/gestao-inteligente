-- Create Meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    author TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Create Policy for open access (as per existing project pattern)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.meetings;
CREATE POLICY "Enable all access for all users" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

-- Insert a sample meeting if table is empty
INSERT INTO public.meetings (title, meeting_date, author, items)
SELECT 'Reunião Semanal 18/02', now(), 'Gestor', 
'[{"id": "1", "content": "Definir metas de produção", "completed": false}, {"id": "2", "content": "Revisar segurança da trefila", "completed": true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.meetings);
