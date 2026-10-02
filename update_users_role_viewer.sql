-- ==============================================================================
-- Script para atualizar a restrição do campo role na tabela app_users do Supabase
-- Permite cadastrar usuários com o perfil 'viewer' (Visualizador Somente Leitura)
-- ==============================================================================

-- 1. Remove a restrição antiga que permitia apenas ('admin', 'user', 'gestor')
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

-- 2. Adiciona a nova restrição incluindo o perfil 'viewer'
ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('admin', 'user', 'gestor', 'viewer'));
