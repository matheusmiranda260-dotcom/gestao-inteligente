-- Script para criar/atualizar a tabela production_orders no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Dropar a tabela se existir (CUIDADO: isso apaga todos os dados!)
-- DROP TABLE IF EXISTS production_orders CASCADE;

-- 2. Criar a tabela production_orders
CREATE TABLE IF NOT EXISTS production_orders (
    -- Campos principais
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    machine TEXT NOT NULL CHECK (machine IN ('Trefila', 'Treliça')),
    target_bitola TEXT NOT NULL,
    
    -- Campos específicos para Treliça
    trelica_model TEXT,
    tamanho TEXT,
    quantity_to_produce INTEGER,
    
    -- Seleção de lotes (pode ser array ou JSONB para objeto)
    selected_lot_ids JSONB NOT NULL,
    
    -- Pesos
    total_weight NUMERIC NOT NULL DEFAULT 0,
    planned_output_weight NUMERIC,
    actual_produced_weight NUMERIC,
    actual_produced_quantity INTEGER,
    scrap_weight NUMERIC,
    
    -- Status e datas
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    
    -- Arrays complexos (JSONB)
    downtime_events JSONB DEFAULT '[]'::jsonb,
    processed_lots JSONB DEFAULT '[]'::jsonb,
    operator_logs JSONB DEFAULT '[]'::jsonb,
    weighed_packages JSONB DEFAULT '[]'::jsonb,
    pontas JSONB DEFAULT '[]'::jsonb,
    
    -- Processamento ativo
    active_lot_processing JSONB,
    
    -- Timestamps automáticos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_orders_order_number ON production_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_production_orders_machine ON production_orders(machine);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_creation_date ON production_orders(creation_date);

-- 4. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;
CREATE TRIGGER update_production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de acesso
-- Política para SELECT (leitura) - todos podem ler
DROP POLICY IF EXISTS "Allow read access to production_orders" ON production_orders;
CREATE POLICY "Allow read access to production_orders"
    ON production_orders
    FOR SELECT
    USING (true);

-- Política para INSERT (criação) - todos podem criar
DROP POLICY IF EXISTS "Allow insert access to production_orders" ON production_orders;
CREATE POLICY "Allow insert access to production_orders"
    ON production_orders
    FOR INSERT
    WITH CHECK (true);

-- Política para UPDATE (atualização) - todos podem atualizar
DROP POLICY IF EXISTS "Allow update access to production_orders" ON production_orders;
CREATE POLICY "Allow update access to production_orders"
    ON production_orders
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Política para DELETE (exclusão) - todos podem deletar
DROP POLICY IF EXISTS "Allow delete access to production_orders" ON production_orders;
CREATE POLICY "Allow delete access to production_orders"
    ON production_orders
    FOR DELETE
    USING (true);

-- 7. Comentários na tabela (documentação)
COMMENT ON TABLE production_orders IS 'Tabela de ordens de produção para Trefila e Treliça';
COMMENT ON COLUMN production_orders.id IS 'ID único da ordem (UUID)';
COMMENT ON COLUMN production_orders.order_number IS 'Número da ordem de produção (único)';
COMMENT ON COLUMN production_orders.machine IS 'Tipo de máquina: Trefila ou Treliça';
COMMENT ON COLUMN production_orders.target_bitola IS 'Bitola alvo a ser produzida';
COMMENT ON COLUMN production_orders.selected_lot_ids IS 'IDs dos lotes selecionados (array ou objeto JSON)';
COMMENT ON COLUMN production_orders.status IS 'Status da ordem: pending, in_progress, completed';
