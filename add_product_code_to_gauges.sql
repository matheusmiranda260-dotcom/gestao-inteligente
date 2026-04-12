-- Add product_code column to stock_gauges table
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS product_code TEXT;
