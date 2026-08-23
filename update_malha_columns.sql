-- 1. Adicionar novas colunas para Malha
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS malha_model TEXT;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS malha_pieces INTEGER;

-- 2. Remover a restrição da coluna 'machine' caso ela ainda exista
-- (Ela limitava a inserir apenas 'Trefila' ou 'Treliça')
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;
  EXCEPTION
    WHEN undefined_object THEN
      -- A constraint pode ter um nome gerado automaticamente se não foi nomeada, então tentamos remover o check genérico caso dê erro.
      NULL;
  END;
END $$;
