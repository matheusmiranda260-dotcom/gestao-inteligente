-- Script para adicionar a coluna 'quantity' na tabela 'stock_items'
-- Permite armazenar a quantidade de barras de treliças (ou peças) por lote/pacote diretamente no banco

ALTER TABLE IF EXISTS public.stock_items 
ADD COLUMN IF NOT EXISTS quantity NUMERIC;

COMMENT ON COLUMN public.stock_items.quantity IS 'Quantidade de peças/barras por pacote ou lote (ex: 100 barras)';
