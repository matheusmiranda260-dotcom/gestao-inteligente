-- Verifica configuração de Realtime e RLS para as principais tabelas
SELECT
  t.tablename,
  coalesce(in_publication.is_published, false) as realtime_ativo,
  t.rowsecurity as rls_ativo,
  (SELECT count(*) FROM pg_policies WHERE tablename = t.tablename) as qtd_politicas
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, true as is_published
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
) in_publication ON in_publication.tablename = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN ('stock_items', 'production_orders', 'conferences', 'transfers', 'messages');
