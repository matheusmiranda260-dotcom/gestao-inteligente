-- =========================================================================
-- CRIAÇÃO DAS TABELAS DE JORNADA DE TRABALHO E FERIADOS DO PCP
-- =========================================================================

-- 1. Tabela de Configuração da Jornada de Trabalho (Compartilhada entre computadores)
CREATE TABLE IF NOT EXISTS public.pcp_shift_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    work_start TEXT NOT NULL DEFAULT '07:00',
    lunch_start TEXT NOT NULL DEFAULT '12:00',
    lunch_end TEXT NOT NULL DEFAULT '13:00',
    work_end TEXT NOT NULL DEFAULT '17:00',
    work_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb, -- 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir registro padrão caso não exista
INSERT INTO public.pcp_shift_config (id, work_start, lunch_start, lunch_end, work_end, work_days)
VALUES ('default', '07:00', '12:00', '13:00', '17:00', '[1,2,3,4,5]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS e criar políticas públicas/autenticadas
ALTER TABLE public.pcp_shift_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de jornada para todos" ON public.pcp_shift_config;
CREATE POLICY "Permitir leitura de jornada para todos" ON public.pcp_shift_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteração de jornada para todos" ON public.pcp_shift_config;
CREATE POLICY "Permitir alteração de jornada para todos" ON public.pcp_shift_config
    FOR ALL USING (true);


-- 2. Tabela de Feriados e Dias Sem Expediente
CREATE TABLE IF NOT EXISTS public.pcp_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e criar políticas públicas/autenticadas
ALTER TABLE public.pcp_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de feriados para todos" ON public.pcp_holidays;
CREATE POLICY "Permitir leitura de feriados para todos" ON public.pcp_holidays
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificação de feriados para todos" ON public.pcp_holidays;
CREATE POLICY "Permitir modificação de feriados para todos" ON public.pcp_holidays
    FOR ALL USING (true);

-- 3. Habilitar Realtime para ambas as tabelas (se a publicação supabase_realtime existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pcp_shift_config;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pcp_holidays;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;

-- 4. Inserir Feriados Nacionais Padrão (2026 e 2027) para conveniência
INSERT INTO public.pcp_holidays (date, description)
VALUES 
    -- 2026
    ('2026-01-01', 'Ano Novo / Confraternização Universal'),
    ('2026-02-16', 'Carnaval (Segunda-feira)'),
    ('2026-02-17', 'Carnaval (Terça-feira)'),
    ('2026-04-03', 'Sexta-feira Santa'),
    ('2026-04-21', 'Tiradentes'),
    ('2026-05-01', 'Dia do Trabalhador'),
    ('2026-06-04', 'Corpus Christi'),
    ('2026-09-07', 'Independência do Brasil'),
    ('2026-10-12', 'Nossa Senhora Aparecida'),
    ('2026-11-02', 'Finados'),
    ('2026-11-15', 'Proclamação da República'),
    ('2026-11-20', 'Dia da Consciência Negra'),
    ('2026-12-25', 'Natal'),

    -- 2027
    ('2027-01-01', 'Ano Novo / Confraternização Universal'),
    ('2027-02-08', 'Carnaval (Segunda-feira)'),
    ('2027-02-09', 'Carnaval (Terça-feira)'),
    ('2027-03-26', 'Sexta-feira Santa'),
    ('2027-04-21', 'Tiradentes'),
    ('2027-05-01', 'Dia do Trabalhador'),
    ('2027-05-27', 'Corpus Christi'),
    ('2027-09-07', 'Independência do Brasil'),
    ('2027-10-12', 'Nossa Senhora Aparecida'),
    ('2027-11-02', 'Finados'),
    ('2027-11-15', 'Proclamação da República'),
    ('2027-11-20', 'Dia da Consciência Negra'),
    ('2027-12-25', 'Natal')
ON CONFLICT (date) DO NOTHING;
