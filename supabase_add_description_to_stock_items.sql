-- 1. Adiciona as colunas description e product_code na tabela stock_items caso não existam
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS product_code TEXT;

-- 2. Cria índices para consultas rápidas por código de produto ou descrição
CREATE INDEX IF NOT EXISTS idx_stock_items_product_code ON public.stock_items (product_code);
CREATE INDEX IF NOT EXISTS idx_stock_items_description ON public.stock_items (description);

-- 3. Atualiza os lotes existentes para preencher a descrição padrão baseada na tabela stock_gauges
UPDATE public.stock_items si
SET 
    description = COALESCE(sg.description, si.material_type || ' ' || REPLACE(si.bitola, '.', ',') || 'mm'),
    product_code = COALESCE(sg.product_code, si.product_code)
FROM (
    SELECT DISTINCT ON (material_type, gauge) material_type, gauge, description, product_code
    FROM public.stock_gauges
    ORDER BY material_type, gauge, created_at ASC
) sg
WHERE si.material_type = sg.material_type 
  AND si.bitola = sg.gauge
  AND (si.description IS NULL OR si.description = '');
