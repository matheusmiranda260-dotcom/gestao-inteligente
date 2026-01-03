-- Migration to add applied_to_stock column and set up inventory_sessions table correctly
-- Run this in the Supabase SQL Editor

-- 1. Create the table if it doesn't exist (safety)
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
    id TEXT PRIMARY KEY,
    material_type TEXT NOT NULL,
    bitola TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open',
    operator TEXT,
    items_count INTEGER DEFAULT 0,
    checked_count INTEGER DEFAULT 0,
    audited_lots JSONB DEFAULT '[]'::jsonb,
    applied_to_stock BOOLEAN DEFAULT FALSE
);

-- 2. Add the column if it's missing (it likely is)
ALTER TABLE public.inventory_sessions 
ADD COLUMN IF NOT EXISTS applied_to_stock BOOLEAN DEFAULT FALSE;

-- 3. Enable RLS and add policies
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;
CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true);

-- 4. Enable Realtime
ALTER publication supabase_realtime ADD TABLE inventory_sessions;
