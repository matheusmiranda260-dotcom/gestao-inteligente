-- ==============================================================================
-- SCRIPT DE ATUALIZAÇÃO: TABELA stock_gauges (Treliças, Eletrodos, Sabão e Bitolas)
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Garante colunas de descrição e código de produto
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS product_code TEXT;

-- 2. Adiciona colunas técnicas da Ficha Técnica de Treliças
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS tamanho TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS superior TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS inferior TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS senozoide TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS peso_final TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS peso_superior TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS peso_inferior TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS peso_senozoide TEXT;

-- 3. Remove restrição UNIQUE antiga que impedia produtos com mesmo diâmetro e descrições/códigos diferentes
ALTER TABLE public.stock_gauges DROP CONSTRAINT IF EXISTS stock_gauges_material_type_gauge_key;

-- 4. Habilita RLS e garante permissões totais para o painel operacional
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users on stock_gauges" ON public.stock_gauges;
DROP POLICY IF EXISTS "Allow all access to stock_gauges" ON public.stock_gauges;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.stock_gauges;

CREATE POLICY "Enable all access for all users on stock_gauges" 
ON public.stock_gauges FOR ALL USING (true) WITH CHECK (true);

-- 5. Cria a tabela trelica_models caso deseje sincronia dedicada para o PCP
CREATE TABLE IF NOT EXISTS public.trelica_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cod TEXT NOT NULL UNIQUE,
    modelo TEXT NOT NULL,
    tamanho TEXT NOT NULL,
    superior TEXT,
    inferior TEXT,
    senozoide TEXT,
    peso_final TEXT,
    peso_superior TEXT,
    peso_senozoide TEXT,
    peso_inferior TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.trelica_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users on trelica_models" ON public.trelica_models;
CREATE POLICY "Enable all access for all users on trelica_models" 
ON public.trelica_models FOR ALL USING (true) WITH CHECK (true);

SELECT 'Tabela stock_gauges e trelica_models atualizadas com sucesso!' as status;
