-- Adiciona o campo bitola_mp à tabela lab_analysis caso não exista
ALTER TABLE public.lab_analysis ADD COLUMN IF NOT EXISTS bitola_mp TEXT;
