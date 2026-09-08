const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables! Ensure .env contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const trelicaModels = [
    { cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', peso_final: '5,502', peso_superior: '2,158', peso_senozoide: '1,828', peso_inferior: '1,517' },
    { cod: 'H6_12', modelo: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,288', peso_superior: '2,322', peso_senozoide: '1,828', peso_inferior: '2,138' },
    { cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '2,898', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '0,758' },
    { cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '5,797', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '1,517' },
    { cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '3,209', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '1,069' },
    { cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,418', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '2,138' },
    { cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '4,087', peso_superior: '1,333', peso_senozoide: '1,685', peso_inferior: '1,069' },
    { cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '8,174', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,138' },
    { cod: 'H8SP6', modelo: 'H-8 SUPER PESADO', tamanho: '6', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '4,324', peso_superior: '1,333', peso_senozoide: '1,686', peso_inferior: '1,305' },
    { cod: 'H8SP12', modelo: 'H-8 SUPER PESADO', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '8,647', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,611' },
    { cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '3,843', peso_superior: '1,246', peso_senozoide: '1,528', peso_inferior: '1,069' },
    { cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '7,686', peso_superior: '2,491', peso_senozoide: '3,057', peso_inferior: '2,138' },
    { cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '9,057', peso_superior: '2,665', peso_senozoide: '3,780', peso_inferior: '2,611' },
    { cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '3,522', peso_superior: '1,246', peso_senozoide: '1,207', peso_inferior: '1,069' },
    { cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '7,044', peso_superior: '2,491', peso_senozoide: '2,414', peso_inferior: '2,138' },
    { cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '5,270', peso_superior: '1,333', peso_senozoide: '2,086', peso_inferior: '1,852' },
    { cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '10,540', peso_superior: '2,665', peso_senozoide: '4,172', peso_inferior: '3,703' },
    { cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '11,263', peso_superior: '2,665', peso_senozoide: '4,894', peso_inferior: '3,703' },
    { cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', peso_final: '20,042', peso_superior: '4,739', peso_senozoide: '9,973', peso_inferior: '5,330' }
];

async function seedData() {
    console.log(`Inserindo ${trelicaModels.length} modelos de treliça no banco de dados...`);
    
    for (const model of trelicaModels) {
        const { data, error } = await supabase
            .from('trelica_models')
            .upsert(model, { onConflict: 'cod' });
            
        if (error) {
            console.error(`Erro ao inserir modelo ${model.cod}:`, error.message);
        } else {
            console.log(`Modelo ${model.cod} inserido/atualizado com sucesso.`);
        }
    }
    
    console.log("Processo concluído.");
}

seedData();
