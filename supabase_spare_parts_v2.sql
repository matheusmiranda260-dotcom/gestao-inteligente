
-- Add image_url to spare_parts for model photos
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add type to part_usage_history to distinguish Entrada (IN) and Saída (OUT)
-- Default is 'OUT' to correspond to existing 'usage' records
ALTER TABLE part_usage_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'OUT';

-- Update RLS if needed (already permissive)
