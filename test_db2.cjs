const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lumgdncfbznjgvtsriwp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bWdkbmNmYnpuamd2dHNyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTMyNDgsImV4cCI6MjA3OTE2OTI0OH0.z66FVw-bMWlQbWBotC7_c_pjR9XMU--QMLMr4S5u9NU');

async function run() {
    console.log("Fetching org_units...");
    const { data: units } = await supabase.from('org_units').select('*');
    console.log("units:", units);
    if (!units || units.length === 0) {
        console.log("No units found! Cannot insert org_positions without a unit.");
        return;
    }
    const unitId = units[0].id;

    console.log("Testing insert into org_positions...");
    const { data, error } = await supabase.from('org_positions').insert({
        id: 'test_slot_123',
        org_unit_id: unitId,
        title: 'Slot'
    }).select();

    if (error) {
        console.error("FAILED!", error);
    } else {
        console.log("SUCCESS!", data);
    }
}
run();
