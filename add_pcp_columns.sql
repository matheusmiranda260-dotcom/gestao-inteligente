-- Script para adicionar colunas de programação PCP à tabela production_orders no Supabase
-- Execute este script no SQL Editor do painel do Supabase

ALTER TABLE public.production_orders 
ADD COLUMN IF NOT EXISTS scheduled_machine TEXT,
ADD COLUMN IF NOT EXISTS planned_start_date DATE,
ADD COLUMN IF NOT EXISTS planned_end_date DATE,
ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER DEFAULT 1;

-- Comentários descritivos para documentação das colunas
COMMENT ON COLUMN public.production_orders.scheduled_machine IS 'Máquina específica agendada para produção (ex: Trefila 1, Trefila 2, Treliça 1, Treliça 2, Desbobinadeira 1)';
COMMENT ON COLUMN public.production_orders.planned_start_date IS 'Data de início planejada para a produção (formato YYYY-MM-DD)';
COMMENT ON COLUMN public.production_orders.planned_end_date IS 'Data de término planejada para a produção (formato YYYY-MM-DD)';
COMMENT ON COLUMN public.production_orders.estimated_duration_days IS 'Duração estimada da produção em dias úteis/planejados';
