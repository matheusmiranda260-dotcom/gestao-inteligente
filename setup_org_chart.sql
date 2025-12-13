-- Tabela de Unidades Organizacionais (As caixas LARANJA - Ex: Máquina Trefila 01)
CREATE TABLE IF NOT EXISTS public.org_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- Ex: "Máquina Trefila 01"
    unit_type TEXT, -- 'machine', 'department', 'sector'
    parent_id TEXT REFERENCES public.org_units(id), -- Para hierarquias de setores (opcional)
    display_order INTEGER DEFAULT 0
);

-- Tabela de Cargos/Funções vinculados a uma Unidade (As caixas AZUIS - Ex: Operador de Máquina na Trefila 01)
CREATE TABLE IF NOT EXISTS public.org_positions (
    id TEXT PRIMARY KEY,
    org_unit_id TEXT REFERENCES public.org_units(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- Ex: "Operador de Máquina"
    is_leadership BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0
);

-- Vincular Funcionário à Posição (As caixas BRANCAS - Ex: Andrius ocupa a vaga de Operador)
-- Vamos alterar a tabela de employees para ter um link direto ou usar uma tabela de ocupação?
-- Melhor adicionar uma coluna position_id na tabela employees para saber onde ele está "sentado" no organograma.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_position_id TEXT REFERENCES public.org_positions(id);

-- RLS
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access org_units" ON public.org_units FOR ALL USING (true);
CREATE POLICY "Access org_positions" ON public.org_positions FOR ALL USING (true);
