-- Add new ideal setup fields to lab_analysis table
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS bitola_saida_ideal text;
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS qtd_k7_ideal text;
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS k7_1_ideal numeric;
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS k7_2_ideal numeric;
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS k7_3_ideal numeric;
ALTER TABLE lab_analysis ADD COLUMN IF NOT EXISTS k7_4_ideal numeric;
