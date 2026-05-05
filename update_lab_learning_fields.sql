-- Adiciona novos campos para controle de Ordem de Produção e registro de aprendizado na tabela lab_analysis
-- Execute este script no SQL Editor do Supabase para atualizar a tabela

ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS production_order_id TEXT;
ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS production_order_number TEXT;
ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS setup_profile TEXT;
ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS action_result TEXT;
