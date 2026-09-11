-- =========================================================================
-- CRIAÇÃO DA TABELA DE HISTÓRICO DE TROCA DE ROLOS DA TRELIÇA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.trelica_spool_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_name TEXT NOT NULL, -- 'Treliça 1' ou 'Treliça 2'
    order_id TEXT,
    order_number TEXT,
    trelica_model TEXT,
    stand_index INTEGER NOT NULL, -- 1 a 5
    role_name TEXT NOT NULL, -- 'Banzo Superior (1x)', etc.
    role_type TEXT NOT NULL, -- 'superior', 'senozoide_left', etc.
    lot_id TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    gauge TEXT NOT NULL,
    start_produced_pieces INTEGER DEFAULT 0,
    end_produced_pieces INTEGER,
    pieces_produced INTEGER DEFAULT 0,
    installed_at TIMESTAMPTZ DEFAULT now(),
    removed_at TIMESTAMPTZ,
    installed_by TEXT,
    removed_by TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' ou 'completed'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.trelica_spool_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de historico de rolos para todos" ON public.trelica_spool_history;
CREATE POLICY "Permitir leitura de historico de rolos para todos" ON public.trelica_spool_history
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteração de historico de rolos para todos" ON public.trelica_spool_history;
CREATE POLICY "Permitir alteração de historico de rolos para todos" ON public.trelica_spool_history
    FOR ALL USING (true);

-- Habilitar Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trelica_spool_history;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;
