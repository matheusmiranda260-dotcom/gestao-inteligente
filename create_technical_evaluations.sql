-- Tabela de Avaliações Técnicas (Domínio Técnico da Trefila)
CREATE TABLE IF NOT EXISTS public.technical_evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    month_num INTEGER NOT NULL, -- 1º, 2º ou 3º Mês de experiência
    
    -- Respostas e Notas
    q1_answer TEXT NOT NULL,
    q1_score NUMERIC NOT NULL DEFAULT 0,
    q2_answer TEXT NOT NULL,
    q2_score NUMERIC NOT NULL DEFAULT 0,
    q3_answer TEXT NOT NULL,
    q3_score NUMERIC NOT NULL DEFAULT 0,
    q4_answer TEXT NOT NULL,
    q4_score NUMERIC NOT NULL DEFAULT 0,
    q5_answer TEXT NOT NULL,
    q5_score NUMERIC NOT NULL DEFAULT 0,
    
    -- Resultados e Observações
    total_score NUMERIC NOT NULL DEFAULT 0, -- Média das notas (0 a 10)
    note TEXT
);

-- RLS (Segurança) - Permissiva para o App
ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access technical_evaluations" ON public.technical_evaluations FOR ALL USING (true);
