const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching org_units...");
    const { data: units } = await supabase.from('org_units').select('*');
    if (!units || units.length === 0) {
        console.log("No units found! Cannot insert org_positions without a unit.");
        // Try to insert one
        console.log("Inserting a default unit...");
        await supabase.from('org_units').insert({ id: 'default_unit', name: 'Default', unit_type: 'sector' });
    }
    const unitId = units && units.length > 0 ? units[0].id : 'default_unit';

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
