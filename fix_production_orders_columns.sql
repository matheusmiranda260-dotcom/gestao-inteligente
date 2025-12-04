-- Allow active_lot_processing to be NULL
ALTER TABLE production_orders ALTER COLUMN active_lot_processing DROP NOT NULL;

-- Ensure processed_lots is JSONB and nullable (just in case)
ALTER TABLE production_orders ALTER COLUMN processed_lots DROP NOT NULL;

-- Ensure downtime_events is JSONB and nullable
ALTER TABLE production_orders ALTER COLUMN downtime_events DROP NOT NULL;
