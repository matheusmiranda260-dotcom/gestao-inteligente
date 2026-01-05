-- Adiciona a coluna total_produced_quantity à tabela shift_reports
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_quantity NUMERIC DEFAULT 0;
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_weight NUMERIC DEFAULT 0;
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_meters NUMERIC DEFAULT 0;
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_scrap_weight NUMERIC DEFAULT 0;
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS scrap_percentage NUMERIC DEFAULT 0;
