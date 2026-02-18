-- Adicionar coluna de descrição de cargo na tabela de posições do organograma
ALTER TABLE public.org_positions ADD COLUMN IF NOT EXISTS description TEXT;
