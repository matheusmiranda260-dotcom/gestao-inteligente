-- Script para atualizar a tabela technical_evaluations
-- Adiciona a coluna para armazenar os dados qualitativos de habilidade (JSON)

ALTER TABLE public.technical_evaluations
ADD COLUMN IF NOT EXISTS habilidade_data JSONB DEFAULT '{}'::jsonb;
