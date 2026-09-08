-- create_trelica_models.sql
CREATE TABLE IF NOT EXISTS public.trelica_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cod TEXT UNIQUE NOT NULL,
    modelo TEXT NOT NULL,
    tamanho TEXT NOT NULL,
    superior TEXT NOT NULL,
    inferior TEXT NOT NULL,
    senozoide TEXT NOT NULL,
    peso_final TEXT NOT NULL,
    peso_superior TEXT NOT NULL,
    peso_senozoide TEXT NOT NULL,
    peso_inferior TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar permissões e RLS
ALTER TABLE public.trelica_models ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Enable read access for all users on trelica_models" ON public.trelica_models
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users on trelica_models" ON public.trelica_models
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users on trelica_models" ON public.trelica_models
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users on trelica_models" ON public.trelica_models
    FOR DELETE USING (true);
