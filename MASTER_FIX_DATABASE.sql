-- MASTER SUPABASE FIX SCRIPT v2
-- Execute este script no SQL Editor do Supabase para corrigir colunas e permissões de acesso (RLS).

-- 1. Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Correção da tabela stock_items (Lotes no Estoque)
-- Garante que todas as colunas necessárias existam
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "label_weight" NUMERIC DEFAULT 0;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "production_order_ids" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "history" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "last_audit_date" TIMESTAMPTZ;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "internal_lot" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "supplier_lot" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "conference_number" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "initial_quantity" NUMERIC;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "remaining_quantity" NUMERIC;

-- Habilita RLS e cria políticas de acesso total (IMPORTANTE: Corrige bugs de inserção/deleção)
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;
DROP POLICY IF EXISTS "Allow all access to stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_items;

CREATE POLICY "Enable all access for all users" ON public.stock_items 
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Correção da tabela conferences (Conferências de Recebimento)
ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS "conference_number" TEXT;

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to conferences" ON public.conferences;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.conferences;

CREATE POLICY "Enable all access for all users" ON public.conferences 
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Correção da tabela production_orders (Ordens de Produção)
-- Garante colunas de peso real se não existirem
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_weight" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_quantity" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "scrap_weight" NUMERIC;

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow insert access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow update access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow delete access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_orders;

CREATE POLICY "Enable all access for all users" ON public.production_orders 
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Outras tabelas de movimento e estoque
-- Finished Goods
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods;
CREATE POLICY "Enable all access for all users" ON public.finished_goods FOR ALL USING (true) WITH CHECK (true);

-- Pontas
ALTER TABLE public.pontas_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for pontas_stock" ON public.pontas_stock;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.pontas_stock;
CREATE POLICY "Enable all access for all users" ON public.pontas_stock FOR ALL USING (true) WITH CHECK (true);

-- Transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to transfers" ON public.transfers;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.transfers;
CREATE POLICY "Enable all access for all users" ON public.transfers FOR ALL USING (true) WITH CHECK (true);

-- FG Transfers
ALTER TABLE public.finished_goods_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to finished_goods_transfers" ON public.finished_goods_transfers;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods_transfers;
CREATE POLICY "Enable all access for all users" ON public.finished_goods_transfers FOR ALL USING (true) WITH CHECK (true);

-- 6. Tabelas Auxiliares (Relatórios, Peças, Ganchos, etc)
-- Shift Reports
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.shift_reports;
CREATE POLICY "Enable all access for all users" ON public.shift_reports FOR ALL USING (true) WITH CHECK (true);

-- Production Records
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to production_records" ON public.production_records;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_records;
CREATE POLICY "Enable all access for all users" ON public.production_records FOR ALL USING (true) WITH CHECK (true);

-- Inventory Sessions
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to inventory_sessions" ON public.inventory_sessions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;
CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true) WITH CHECK (true);

-- Sticky Notes
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sticky_notes" ON public.sticky_notes;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.sticky_notes;
CREATE POLICY "Enable all access for all users" ON public.sticky_notes FOR ALL USING (true) WITH CHECK (true);

-- Stock Gauges
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to stock_gauges" ON public.stock_gauges;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_gauges;
CREATE POLICY "Enable all access for all users" ON public.stock_gauges FOR ALL USING (true) WITH CHECK (true);

-- 7. Tabelas de RH e Gestão de Pessoas (Se existirem)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees') THEN
        ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Access employees" ON public.employees;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employees;
        CREATE POLICY "Enable all access for all users" ON public.employees FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_courses') THEN
        ALTER TABLE public.employee_courses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_courses;
        CREATE POLICY "Enable all access for all users" ON public.employee_courses FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_absences') THEN
        ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_absences;
        CREATE POLICY "Enable all access for all users" ON public.employee_absences FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_vacations') THEN
        ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_vacations;
        CREATE POLICY "Enable all access for all users" ON public.employee_vacations FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_responsibilities') THEN
        ALTER TABLE public.employee_responsibilities ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_responsibilities;
        CREATE POLICY "Enable all access for all users" ON public.employee_responsibilities FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 8. Mensagem de Sucesso
SELECT 'Master Fix aplicado com sucesso!' as status;
