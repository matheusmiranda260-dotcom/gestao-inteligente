-- Script para adicionar o status 'cancelled' à tabela production_orders
-- Execute este script no SQL Editor do Supabase

-- 1. Remover a constraint antiga de status
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;

-- 2. Adicionar a nova constraint com 'cancelled' incluído
ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

-- Verificação: listar as constraints atuais
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.production_orders'::regclass 
AND contype = 'c';
