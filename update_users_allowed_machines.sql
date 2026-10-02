-- Script para adicionar a coluna allowed_machines na tabela app_users do Supabase
-- Permite parametrizar quais máquinas cada usuário (especialmente do perfil 'viewer') pode visualizar no quadro PCP

ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS allowed_machines TEXT[];

COMMENT ON COLUMN public.app_users.allowed_machines IS 'Lista de máquinas permitidas para visualização pelo usuário (Ex: ["Trefila 1", "Treliça 1"])';
