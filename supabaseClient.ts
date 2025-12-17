/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables!");
}

export const supabase = createClient(supabaseUrl || 'https://lumgdncfbznjgvtsriwp.supabase.co', supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU');
