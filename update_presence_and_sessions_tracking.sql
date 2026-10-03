-- Script completo para rastreamento inteligente de presença, dispositivos simultâneos e engajamento

-- 1. Atualizar tabela app_users com colunas de presença e engajamento
ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_page TEXT,
ADD COLUMN IF NOT EXISTS focus_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS active_sessions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Atualizar tabela user_access_logs com colunas de rastreamento de dispositivos e sessões
ALTER TABLE public.user_access_logs 
ADD COLUMN IF NOT EXISTS logout_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS current_page TEXT,
ADD COLUMN IF NOT EXISTS focus_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS device_info TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;

-- Comentários explicativos
COMMENT ON COLUMN public.app_users.last_seen_at IS 'Data/hora do último pulso (heartbeat) de presença enviado pelo navegador';
COMMENT ON COLUMN public.app_users.current_page IS 'Última tela que o usuário acessou ou está visualizando';
COMMENT ON COLUMN public.app_users.focus_status IS 'Estado de engajamento do usuário (active = ativo na tela, background = aba em 2º plano, idle = ausente/sem mexer)';
COMMENT ON COLUMN public.user_access_logs.device_id IS 'Identificador único do dispositivo/computador para detecção de múltiplos acessos simultâneos';
COMMENT ON COLUMN public.user_access_logs.device_info IS 'Navegador, Sistema Operacional e Resolução da tela do dispositivo';
COMMENT ON COLUMN public.user_access_logs.is_active IS 'Indica se a sessão ainda está ativa em tempo real';

-- 3. Garantir publicação realtime para ambas as tabelas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'app_users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_access_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_access_logs;
    END IF;
END $$;
