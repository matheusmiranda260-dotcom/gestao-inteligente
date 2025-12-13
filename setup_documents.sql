-- Tabela de Documentos do Funcionário
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    title TEXT NOT NULL, -- Ex: "Carteira de Vacinação"
    type TEXT NOT NULL, -- Ex: "Atestado", "Pessoal", "Outros"
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access employee_documents" ON public.employee_documents FOR ALL USING (true);
