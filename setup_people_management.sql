-- Tabela de Funcionários (Perfil Completo)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    photo_url TEXT,
    sector TEXT NOT NULL, -- Setor/Máquina
    shift TEXT NOT NULL, -- Turno
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE,
    app_user_id TEXT -- Opcional: Link com o login do sistema se houver
);

-- Tabela de Avaliações (Histórico)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    evaluator TEXT NOT NULL, -- Quem avaliou (nome do gestor)
    date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Critérios (1-5)
    organization_score INTEGER NOT NULL,
    cleanliness_score INTEGER NOT NULL,
    effort_score INTEGER NOT NULL,
    communication_score INTEGER NOT NULL,
    improvement_score INTEGER NOT NULL,
    
    -- Dados extras
    total_score INTEGER GENERATED ALWAYS AS (organization_score + cleanliness_score + effort_score + communication_score + improvement_score) STORED,
    note TEXT,
    photo_url TEXT -- Evidência opcional
);

-- Tabela de Conquistas/Gamificação
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    type TEXT NOT NULL, -- 'model_area', 'idea_month', 'highlight_week', 'custom'
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Segurança) - Permissiva para o App
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Access evaluations" ON public.evaluations FOR ALL USING (true);
CREATE POLICY "Access achievements" ON public.achievements FOR ALL USING (true);
