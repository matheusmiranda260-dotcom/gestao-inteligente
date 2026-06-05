-- Tabela de Avaliações CHA (Conhecimento, Habilidade e Atitude)
DROP TABLE IF EXISTS public.technical_evaluations;

CREATE TABLE IF NOT EXISTS public.technical_evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    month_num INTEGER NOT NULL, -- 1º, 2º ou 3º Mês de experiência
    machine_type TEXT NOT NULL, -- 'Trefila' ou 'Treliça'
    
    -- 1. CONHECIMENTO (Questões Específicas)
    q1_answer TEXT,
    q1_score NUMERIC NOT NULL DEFAULT 0,
    q2_answer TEXT,
    q2_score NUMERIC NOT NULL DEFAULT 0,
    q3_answer TEXT,
    q3_score NUMERIC NOT NULL DEFAULT 0,
    q4_answer TEXT,
    q4_score NUMERIC NOT NULL DEFAULT 0,
    q5_answer TEXT, -- Pode ser NULL na Treliça
    q5_score NUMERIC NOT NULL DEFAULT 0, -- Pode ser 0 na Treliça
    
    -- 2. HABILIDADE (Prática e Operação)
    h1_score NUMERIC NOT NULL DEFAULT 0, -- Setup e Ajustes da Máquina
    h2_score NUMERIC NOT NULL DEFAULT 0, -- Ritmo de Trabalho e Produtividade
    h3_score NUMERIC NOT NULL DEFAULT 0, -- Controle de Qualidade e Bitolas
    h4_score NUMERIC NOT NULL DEFAULT 0, -- Segurança e Operação Segura
    
    -- 3. ATITUDE (Comportamento e Postura)
    a1_score NUMERIC NOT NULL DEFAULT 0, -- Organização e Limpeza (5S)
    a2_score NUMERIC NOT NULL DEFAULT 0, -- Assiduidade e Disciplina
    a3_score NUMERIC NOT NULL DEFAULT 0, -- Iniciativa e Melhoria Contínua
    a4_score NUMERIC NOT NULL DEFAULT 0, -- Trabalho em Equipe e Colaboração
    
    -- Geral
    total_score NUMERIC NOT NULL DEFAULT 0, -- Média geral ponderada/aritmética
    note TEXT
);

-- RLS (Segurança) - Permissiva para o App
ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access technical_evaluations" ON public.technical_evaluations FOR ALL USING (true);
