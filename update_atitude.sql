-- Script para atualizar a tabela technical_evaluations
-- Adiciona a coluna para armazenar os dados qualitativos de atitude (JSON)

ALTER TABLE public.technical_evaluations
ADD COLUMN IF NOT EXISTS atitude_data JSONB DEFAULT '{}'::jsonb;
