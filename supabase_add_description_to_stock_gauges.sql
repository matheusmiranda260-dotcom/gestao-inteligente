-- Script para adicionar a coluna description e permitir bitolas iguais com descrições diferentes
-- Execute este script no SQL Editor do Supabase

-- 1. Adiciona a coluna description na tabela stock_gauges caso não exista
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Remove a constraint UNIQUE restritiva antiga que impedia ter a mesma bitola com descrições diferentes (ex: rolo 2000kg vs rolo 200kg)
ALTER TABLE public.stock_gauges DROP CONSTRAINT IF EXISTS stock_gauges_material_type_gauge_key;

-- 3. Atualiza os registros existentes sem descrição com um valor padrão amigável
UPDATE public.stock_gauges 
SET description = material_type || ' ' || REPLACE(gauge, '.', ',') || 'mm'
WHERE description IS NULL OR description = '';

-- Mensagem de confirmação
SELECT 'Coluna description adicionada e constraint UNIQUE flexibilizada com sucesso!' as status;
