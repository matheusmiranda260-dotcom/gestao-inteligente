-- Atualiza itens presos na Trefila
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção - Trefila';

-- Atualiza itens presos na Treliça
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção - Treliça';

-- Opcional: Atualiza o status genérico "Em Produção" se houver
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção';
