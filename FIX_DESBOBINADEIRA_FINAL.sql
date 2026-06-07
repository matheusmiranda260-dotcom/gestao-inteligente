-- ============================================================
-- CORREÇÃO COMPLETA PARA DESBOBINADEIRA
-- Execute este script inteiro no SQL Editor do Supabase
-- ============================================================

-- 1. Remover constraint antiga de machine e criar nova que aceita Desbobinadeira
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;

ALTER TABLE public.production_orders
    ADD CONSTRAINT production_orders_machine_check 
    CHECK (machine IN ('Trefila', 'Treliça', 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2', 'Desbobinadeira 1'));

-- 2. Tornar quantity_to_produce opcional (Desbobinadeira não usa)
ALTER TABLE public.production_orders
    ALTER COLUMN quantity_to_produce SET DEFAULT 0;

-- 3. Adicionar novas colunas para Desbobinadeira (se ainda não existirem)
ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS is_ghost_order BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS input_bitola TEXT,
    ADD COLUMN IF NOT EXISTS os_items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS summary JSONB;

-- 4. Verificação: mostrar estrutura atual da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'production_orders'
ORDER BY ordinal_position;
