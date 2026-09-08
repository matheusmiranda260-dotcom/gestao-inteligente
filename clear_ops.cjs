const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://lumgdncfbznjgvtsriwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Buscando OPs...");
    const { data: ops, error: fetchErr } = await supabase.from('production_orders').select('*');
    
    if (fetchErr) {
        console.error("Erro ao buscar OPs", fetchErr);
        return;
    }
    
    if (!ops || ops.length === 0) {
        console.log("Nenhuma OP encontrada.");
        return;
    }

    const pendingOps = ops.filter(op => {
        const isNotScheduled = !op.planned_start_date || !op.scheduled_machine;
        const isNotCompleted = op.status !== 'completed' && op.status !== 'Finalizado' && op.status !== 'Cancelada';
        return isNotScheduled && isNotCompleted;
    });

    console.log(`Foram encontradas ${pendingOps.length} OPs pendentes para deletar (das ${ops.length} totais).`);

    let successCount = 0;
    for (const op of pendingOps) {
        const { error } = await supabase.from('production_orders').delete().eq('id', op.id);
        if (error) {
            console.error("Erro ao deletar OP " + op.order_number, error);
        } else {
            successCount++;
        }
    }
    console.log(`Limpeza concluída. ${successCount} OPs deletadas com sucesso.`);
}

run();
