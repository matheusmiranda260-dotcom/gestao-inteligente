/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const directSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lumgdncfbznjgvtsriwp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn("Using fallback Supabase configuration.");
}

// Proxy via Vercel para contornar bloqueio do firewall Fortinet em *.supabase.co na rede da fábrica.
// Quando o TI liberar *.supabase.co no FortiGate, basta mudar para false.
const USE_VERCEL_PROXY = true;

const isBrowserRemoteHost =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

export const isUsingSupabaseProxy = USE_VERCEL_PROXY && isBrowserRemoteHost;
const supabaseUrl = isUsingSupabaseProxy
    ? `${window.location.origin}/supabase-proxy`
    : directSupabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
