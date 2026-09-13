-- =========================================================================
-- CRIAÇÃO DAS TABELAS DE ELETRODOS E HISTÓRICO DE SOLDA DA TRELIÇA
-- =========================================================================

-- 1. Tabela de Eletrodos Instalados na Máquina (12 Posições por Treliça)
CREATE TABLE IF NOT EXISTS public.trelica_machine_electrodes (
    id TEXT PRIMARY KEY,
    machine_name TEXT NOT NULL, -- 'Treliça 1' ou 'Treliça 2'
    position TEXT NOT NULL,
    position_label TEXT NOT NULL,
    electrode_type TEXT NOT NULL,
    lot_id TEXT,
    lot_number TEXT,
    installed_at TIMESTAMPTZ DEFAULT now(),
    installed_by TEXT,
    meters_produced NUMERIC DEFAULT 0,
    pieces_produced NUMERIC DEFAULT 0,
    benchmark_meters NUMERIC DEFAULT 15000,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'warning', 'critical'
    clean_count INTEGER DEFAULT 0,
    last_cleaned_at TIMESTAMPTZ,
    last_cleaned_by TEXT,
    dress_count INTEGER DEFAULT 0,
    last_dressed_at TIMESTAMPTZ,
    last_adjusted_at TIMESTAMPTZ,
    last_adjusted_by TEXT,
    last_adjustment_type TEXT,
    last_adjustment_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Histórico de Eventos (Trocas, Limpezas, Ajustes Mecânicos e Retíficas)
CREATE TABLE IF NOT EXISTS public.trelica_electrodes_history (
    id TEXT PRIMARY KEY,
    machine_name TEXT NOT NULL, -- 'Treliça 1' ou 'Treliça 2'
    position TEXT NOT NULL,
    position_label TEXT NOT NULL,
    lot_id TEXT,
    lot_number TEXT,
    electrode_type TEXT NOT NULL,
    installed_at TIMESTAMPTZ DEFAULT now(),
    removed_at TIMESTAMPTZ DEFAULT now(),
    installed_by TEXT,
    removed_by TEXT,
    meters_produced NUMERIC DEFAULT 0,
    pieces_produced NUMERIC DEFAULT 0,
    reason TEXT NOT NULL, -- 'Limpeza de Eletrodo', 'Ajuste de Altura / Ângulo', 'Troca de Eletrodo', 'Retífica / Lixamento', etc.
    destination TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.trelica_machine_electrodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trelica_electrodes_history ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Permitir leitura de eletrodos para todos" ON public.trelica_machine_electrodes;
CREATE POLICY "Permitir leitura de eletrodos para todos" ON public.trelica_machine_electrodes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteração de eletrodos para todos" ON public.trelica_machine_electrodes;
CREATE POLICY "Permitir alteração de eletrodos para todos" ON public.trelica_machine_electrodes
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura de historico de eletrodos para todos" ON public.trelica_electrodes_history;
CREATE POLICY "Permitir leitura de historico de eletrodos para todos" ON public.trelica_electrodes_history
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteração de historico de eletrodos para todos" ON public.trelica_electrodes_history;
CREATE POLICY "Permitir alteração de historico de eletrodos para todos" ON public.trelica_electrodes_history
    FOR ALL USING (true);

-- Habilitar Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trelica_machine_electrodes;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trelica_electrodes_history;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;
