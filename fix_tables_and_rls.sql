-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or Update 'finished_goods' table
CREATE TABLE IF NOT EXISTS public.finished_goods (
    id TEXT PRIMARY KEY,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    production_order_id TEXT,
    order_number TEXT,
    product_type TEXT,
    model TEXT,
    size TEXT,
    quantity NUMERIC,
    total_weight NUMERIC,
    status TEXT DEFAULT 'Disponível'
);

-- Ensure RLS is enabled
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for finished_goods
DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;
CREATE POLICY "Enable read access for all users" ON public.finished_goods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;
CREATE POLICY "Enable insert access for all users" ON public.finished_goods FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;
CREATE POLICY "Enable update access for all users" ON public.finished_goods FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;
CREATE POLICY "Enable delete access for all users" ON public.finished_goods FOR DELETE USING (true);


-- 2. Ensure 'stock_items' has correct policies (just in case)
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;
CREATE POLICY "Enable read access for all users" ON public.stock_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;
CREATE POLICY "Enable update access for all users" ON public.stock_items FOR UPDATE USING (true);


-- 3. Verify 'production_orders' columns
-- Sometimes columns might be missing if schema evolved
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_weight" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_quantity" NUMERIC;

-- 4. Create or Update 'pontas_stock' table
CREATE TABLE IF NOT EXISTS public.pontas_stock (
    id TEXT PRIMARY KEY,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    production_order_id TEXT,
    order_number TEXT,
    product_type TEXT,
    model TEXT,
    size TEXT,
    quantity NUMERIC,
    total_weight NUMERIC,
    status TEXT DEFAULT 'Disponível'
);

ALTER TABLE public.pontas_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for pontas_stock" ON public.pontas_stock;
CREATE POLICY "Enable all access for pontas_stock" ON public.pontas_stock FOR ALL USING (true);
