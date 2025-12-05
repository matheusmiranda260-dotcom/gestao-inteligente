-- Garante permissões de leitura para o Realtime funcionar
-- ATENÇÃO: Isso libera leitura pública. Em produção, ajuste conforme necessário.

-- Stock Items
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read stock_items" ON stock_items FOR SELECT USING (true);

-- Conferences
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read conferences" ON conferences FOR SELECT USING (true);

-- Production Orders
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read production_orders" ON production_orders FOR SELECT USING (true);

-- Finished Goods
ALTER TABLE finished_goods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read finished_goods" ON finished_goods FOR SELECT USING (true);

-- Pontas Stock
ALTER TABLE pontas_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read pontas_stock" ON pontas_stock FOR SELECT USING (true);

-- Transfers
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read transfers" ON transfers FOR SELECT USING (true);

-- Finished Goods Transfers
ALTER TABLE finished_goods_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read finished_goods_transfers" ON finished_goods_transfers FOR SELECT USING (true);

-- Parts Requests
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read parts_requests" ON parts_requests FOR SELECT USING (true);

-- Shift Reports
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read shift_reports" ON shift_reports FOR SELECT USING (true);

-- Production Records
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read production_records" ON production_records FOR SELECT USING (true);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read messages" ON messages FOR SELECT USING (true);
