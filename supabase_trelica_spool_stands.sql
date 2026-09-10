-- =========================================================================
-- CRIAÇÃO DA TABELA DE PORTA-ROLOS (DESBOBINADORES) DA TRELIÇA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.trelica_spool_stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_name TEXT NOT NULL, -- 'Treliça 1' ou 'Treliça 2'
    stand_index INTEGER NOT NULL, -- 1 a 5
    role_name TEXT NOT NULL, -- 'Banzo Superior', 'Senoide 1', 'Senoide 2', 'Inferior 1', 'Inferior 2'
    role_type TEXT NOT NULL, -- 'superior', 'senozoide_left', 'senozoide_right', 'inferior_left', 'inferior_right'
    current_lot_id TEXT,
    current_lot_number TEXT,
    current_gauge TEXT,
    initial_weight NUMERIC DEFAULT 0,
    remaining_weight NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'empty', -- 'active', 'empty', 'warning', 'changing'
    last_changed_at TIMESTAMPTZ DEFAULT now(),
    last_changed_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_machine_stand UNIQUE(machine_name, stand_index)
);

-- Habilitar RLS
ALTER TABLE public.trelica_spool_stands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de porta rolos para todos" ON public.trelica_spool_stands;
CREATE POLICY "Permitir leitura de porta rolos para todos" ON public.trelica_spool_stands
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteração de porta rolos para todos" ON public.trelica_spool_stands;
CREATE POLICY "Permitir alteração de porta rolos para todos" ON public.trelica_spool_stands
    FOR ALL USING (true);

-- Habilitar Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trelica_spool_stands;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;

-- Inserir os 5 Porta-Rolos padrão para Treliça 1
INSERT INTO public.trelica_spool_stands 
    (machine_name, stand_index, role_name, role_type, status)
VALUES
    ('Treliça 1', 1, 'Banzo Superior (1x)', 'superior', 'empty'),
    ('Treliça 1', 2, 'Senoide Lado 1 (1x)', 'senozoide_left', 'empty'),
    ('Treliça 1', 3, 'Senoide Lado 2 (1x)', 'senozoide_right', 'empty'),
    ('Treliça 1', 4, 'Inferior Lado 1 (1x)', 'inferior_left', 'empty'),
    ('Treliça 1', 5, 'Inferior Lado 2 (1x)', 'inferior_right', 'empty')
ON CONFLICT (machine_name, stand_index) DO NOTHING;

-- Inserir os 5 Porta-Rolos padrão para Treliça 2
INSERT INTO public.trelica_spool_stands 
    (machine_name, stand_index, role_name, role_type, status)
VALUES
    ('Treliça 2', 1, 'Banzo Superior (1x)', 'superior', 'empty'),
    ('Treliça 2', 2, 'Senoide Lado 1 (1x)', 'senozoide_left', 'empty'),
    ('Treliça 2', 3, 'Senoide Lado 2 (1x)', 'senozoide_right', 'empty'),
    ('Treliça 2', 4, 'Inferior Lado 1 (1x)', 'inferior_left', 'empty'),
    ('Treliça 2', 5, 'Inferior Lado 2 (1x)', 'inferior_right', 'empty')
ON CONFLICT (machine_name, stand_index) DO NOTHING;
