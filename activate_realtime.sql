-- Habilitar Realtime para todas as tabelas principais
-- Execute isso no SQL Editor do Supabase

-- Primeiro, garante que a publicação existe (padrão no Supabase)
-- Se der erro dizendo que já existe, ignore
-- create publication supabase_realtime;

-- Adiciona as tabelas à publicação
alter publication supabase_realtime add table stock_items;
alter publication supabase_realtime add table conferences;
alter publication supabase_realtime add table production_orders;
alter publication supabase_realtime add table transfers;
alter publication supabase_realtime add table finished_goods;
alter publication supabase_realtime add table pontas_stock;
alter publication supabase_realtime add table finished_goods_transfers;
alter publication supabase_realtime add table parts_requests;
alter publication supabase_realtime add table shift_reports;
alter publication supabase_realtime add table production_records;
alter publication supabase_realtime add table messages;

-- Verifica quais tabelas estão habilitadas
select * from pg_publication_tables where pubname = 'supabase_realtime';
