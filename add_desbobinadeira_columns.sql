-- Migration to add Desbobinadeira support
-- 1. Expand machine check constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'production_orders'::regclass
      AND contype = 'c'
      AND conname LIKE 'production_orders_machine_check%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE production_orders DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE production_orders
    ALTER COLUMN machine TYPE TEXT,
    ADD CONSTRAINT production_orders_machine_check
        CHECK (machine IN ('Trefila', 'Treliça', 'Desbobinadeira 1'));

-- 2. New columns for Desbobinadeira
ALTER TABLE production_orders
    ADD COLUMN IF NOT EXISTS input_bitola TEXT,
    ADD COLUMN IF NOT EXISTS os_items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_ghost_order BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS summary JSONB;
