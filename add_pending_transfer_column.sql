-- Adiciona a coluna pending_transfer_quantity na tabela finished_goods
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;

-- Adiciona a coluna pending_transfer_quantity na tabela pontas_stock
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;
