ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS location TEXT;

-- Create an index for faster lookups by location if needed
CREATE INDEX IF NOT EXISTS idx_stock_items_location ON public.stock_items (location);
