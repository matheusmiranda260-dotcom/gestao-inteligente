import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lumgdncfbznjgvtsriwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    const evalDataToSave = {
        employee_id: 'd9b2d63d-a233-4123-8478-f7b8a78e2abc', // dummy
        evaluator: 'Test',
        date: new Date().toISOString(),
        month_num: 1,
        machine_type: 'Trefila',
        q1_answer: 'Yes', q1_score: 10,
        habilidade_data: {},
        atitude_data: {},
        total_score: 10,
        note: 'Test'
    };

    const { data, error } = await supabase.from('technical_evaluations').insert(evalDataToSave).select().single();
    if (error) {
        console.error("SUPABASE ERROR:", error);
    } else {
        console.log("SUCCESS:", data);
        await supabase.from('technical_evaluations').delete().eq('id', data.id);
    }
}

test();
