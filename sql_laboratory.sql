-- Script para criar a tabela de Laboratório (lab_analysis)
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.lab_analysis (
    id TEXT PRIMARY KEY,
    lote TEXT NOT NULL,
    fornecedor TEXT NOT NULL,
    k7_1_entrada DOUBLE PRECISION,
    k7_1_saida DOUBLE PRECISION,
    k7_2_entrada DOUBLE PRECISION,
    k7_2_saida DOUBLE PRECISION,
    k7_3_entrada DOUBLE PRECISION,
    k7_3_saida DOUBLE PRECISION,
    k7_4_entrada DOUBLE PRECISION,
    k7_4_saida DOUBLE PRECISION,
    velocidade DOUBLE PRECISION,
    comprimento DOUBLE PRECISION,
    massa DOUBLE PRECISION,
    escoamento DOUBLE PRECISION,
    resistencia DOUBLE PRECISION,
    alongamento DOUBLE PRECISION,
    date TIMESTAMPTZ DEFAULT NOW(),
    operator TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configura permissões (RLS)
ALTER TABLE public.lab_analysis ENABLE ROW LEVEL SECURITY;

-- Permite todas as operações para usuários autenticados (ou todos para testes locais)
CREATE POLICY "Enable all for authenticated users" ON public.lab_analysis
    FOR ALL
    USING (true)
    WITH CHECK (true);
