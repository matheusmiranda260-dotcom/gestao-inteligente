-- Adicionar colunas de rastreamento de tempo ativo e ações na tabela user_access_logs
ALTER TABLE public.user_access_logs 
ADD COLUMN IF NOT EXISTS logout_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS device_info TEXT,
ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;

-- Comentários informativos das colunas
COMMENT ON COLUMN public.user_access_logs.logout_at IS 'Data/hora de encerramento da sessão do usuário';
COMMENT ON COLUMN public.user_access_logs.last_activity_at IS 'Data/hora da última atividade registrada';
COMMENT ON COLUMN public.user_access_logs.duration_seconds IS 'Tempo ativo da sessão em segundos';
COMMENT ON COLUMN public.user_access_logs.actions IS 'Lista de ações e páginas acessadas durante a sessão';
