-- Atualização da tabela de Funcionários com dados detalhados
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_title TEXT; -- Cargo
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT; -- Solteiro(a), Casado(a), etc
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id TEXT REFERENCES public.employees(id); -- Para o Organograma

-- Tabela de Cursos e Treinamentos
CREATE TABLE IF NOT EXISTS public.employee_courses (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    course_name TEXT NOT NULL,
    institution TEXT,
    completion_date DATE,
    expiry_date DATE, -- Para cursos com validade (NRs)
    status TEXT CHECK (status IN ('Concluído', 'Em Andamento', 'Pendente'))
);

-- Tabela de Faltas e Ausências
CREATE TABLE IF NOT EXISTS public.employee_absences (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT NOT NULL, -- Doença, Falta Injustificada, Motivos Pessoais
    type TEXT -- Atestado, Falta, Licença
);

-- Tabela de Férias
CREATE TABLE IF NOT EXISTS public.employee_vacations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK (status IN ('Programada', 'Gozada', 'Vendida', 'Cancelada'))
);

-- Tabela de Responsabilidades/Atribuições da Função
CREATE TABLE IF NOT EXISTS public.employee_responsibilities (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    description TEXT NOT NULL,
    is_critical BOOLEAN DEFAULT FALSE -- Se é uma função chave
);

-- RLS Policies para as novas tabelas
ALTER TABLE public.employee_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employee_courses" ON public.employee_courses FOR ALL USING (true);
CREATE POLICY "Access employee_absences" ON public.employee_absences FOR ALL USING (true);
CREATE POLICY "Access employee_vacations" ON public.employee_vacations FOR ALL USING (true);
CREATE POLICY "Access employee_responsibilities" ON public.employee_responsibilities FOR ALL USING (true);
