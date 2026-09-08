const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lumgdncfbznjgvtsriwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .order('creation_date', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Supabase error:', error);
    } else {
        console.log('Found orders:', data.length);
        data.forEach(o => {
            console.log({
                id: o.id,
                order_number: o.order_number,
                machine: o.machine,
                scheduled_machine: o.scheduled_machine,
                planned_start_date: o.planned_start_date,
                planned_end_date: o.planned_end_date,
                status: o.status,
                creation_date: o.creation_date
            });
        });
    }
}

check();
