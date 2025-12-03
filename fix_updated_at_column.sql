-- Script para corrigir o erro "record "new" has no field "updated_at""
-- Este erro ocorre porque a tabela production_orders já existia sem a coluna updated_at,
-- e o comando CREATE TABLE IF NOT EXISTS não adiciona colunas a tabelas existentes.

-- 1. Adicionar a coluna updated_at se ela não existir
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Garantir que a função do trigger existe e está correta
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar o trigger para garantir que ele está associado corretamente
DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;

CREATE TRIGGER update_production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Confirmação
COMMENT ON COLUMN production_orders.updated_at IS 'Data da última atualização do registro';
