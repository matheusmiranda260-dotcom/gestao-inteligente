import { TrelicaModel, StockGauge } from '../types';

export const DEFAULT_TRELICA_MODELS: TrelicaModel[] = [
    { id: '1', cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', peso_final: '5,502', peso_superior: '2,158', peso_senozoide: '1,828', peso_inferior: '1,517', pesoFinal: '5,502', pesoSuperior: '2,158', pesoSenozoide: '1,828', pesoInferior: '1,517' },
    { id: '2', cod: 'H6_12', modelo: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,288', peso_superior: '2,322', peso_senozoide: '1,828', peso_inferior: '2,138', pesoFinal: '6,288', pesoSuperior: '2,322', pesoSenozoide: '1,828', pesoInferior: '2,138' },
    { id: '3', cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '2,898', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '0,758', pesoFinal: '2,898', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '0,758' },
    { id: '4', cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '5,797', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '1,517', pesoFinal: '5,797', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '1,517' },
    { id: '5', cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '3,209', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '1,069', pesoFinal: '3,209', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '1,069' },
    { id: '6', cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,418', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '2,138', pesoFinal: '6,418', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '2,138' },
    { id: '7', cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '4,087', peso_superior: '1,333', peso_senozoide: '1,685', peso_inferior: '1,069', pesoFinal: '4,087', pesoSuperior: '1,333', pesoSenozoide: '1,685', pesoInferior: '1,069' },
    { id: '8', cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '8,174', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,138', pesoFinal: '8,174', pesoSuperior: '2,665', pesoSenozoide: '3,371', pesoInferior: '2,138' },
    { id: '9', cod: 'H8SP6', modelo: 'H-8 SUPER PESADO', tamanho: '6', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '4,324', peso_superior: '1,333', peso_senozoide: '1,686', peso_inferior: '1,305', pesoFinal: '4,324', pesoSuperior: '1,333', pesoSenozoide: '1,686', pesoInferior: '1,305' },
    { id: '10', cod: 'H8SP12', modelo: 'H-8 SUPER PESADO', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '8,647', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,611', pesoFinal: '8,647', pesoSuperior: '2,665', pesoSenozoide: '3,371', pesoInferior: '2,611' },
    { id: '11', cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '3,843', peso_superior: '1,246', peso_senozoide: '1,528', peso_inferior: '1,069', pesoFinal: '3,843', pesoSuperior: '1,246', pesoSenozoide: '1,528', pesoInferior: '1,069' },
    { id: '12', cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '7,686', peso_superior: '2,491', peso_senozoide: '3,057', peso_inferior: '2,138', pesoFinal: '7,686', pesoSuperior: '2,491', pesoSenozoide: '3,057', pesoInferior: '2,138' },
    { id: '13', cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '9,057', peso_superior: '2,665', peso_senozoide: '3,780', peso_inferior: '2,611', pesoFinal: '9,057', pesoSuperior: '2,665', pesoSenozoide: '3,780', pesoInferior: '2,611' },
    { id: '14', cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '3,522', peso_superior: '1,246', peso_senozoide: '1,207', peso_inferior: '1,069', pesoFinal: '3,522', pesoSuperior: '1,246', pesoSenozoide: '1,207', pesoInferior: '1,069' },
    { id: '15', cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '7,044', peso_superior: '2,491', peso_senozoide: '2,414', peso_inferior: '2,138', pesoFinal: '7,044', pesoSuperior: '2,491', pesoSenozoide: '2,414', pesoInferior: '2,138' },
    { id: '16', cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '5,270', peso_superior: '1,333', peso_senozoide: '2,086', peso_inferior: '1,852', pesoFinal: '5,270', pesoSuperior: '1,333', pesoSenozoide: '2,086', pesoInferior: '1,852' },
    { id: '17', cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '10,540', peso_superior: '2,665', peso_senozoide: '4,172', peso_inferior: '3,703', pesoFinal: '10,540', pesoSuperior: '2,665', pesoSenozoide: '4,172', pesoInferior: '3,703' },
    { id: '18', cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '11,263', peso_superior: '2,665', peso_senozoide: '4,894', peso_inferior: '3,703', pesoFinal: '11,263', pesoSuperior: '2,665', pesoSenozoide: '4,894', pesoInferior: '3,703' },
    { id: '19', cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', peso_final: '20,042', peso_superior: '4,739', peso_senozoide: '9,973', peso_inferior: '5,330', pesoFinal: '20,042', pesoSuperior: '4,739', pesoSenozoide: '9,973', pesoInferior: '5,330' },
];

export const trelicaModels = DEFAULT_TRELICA_MODELS;

/**
 * Mescla e unifica modelos de treliça oriundos de:
 * 1. Modelos padrão fixos
 * 2. Cache local (localStorage)
 * 3. Tabela trelica_models do Supabase
 * 4. Tabela stock_gauges do Supabase (Configuração de Bitolas / Estoque)
 */
export const buildMergedTrelicaModels = (
    dbModels: any[] = [], 
    stockGaugesList: StockGauge[] = [], 
    cachedList: any[] = []
): TrelicaModel[] => {
    const map = new Map<string, TrelicaModel>();

    // 1. Modelos padrão (fallback base)
    DEFAULT_TRELICA_MODELS.forEach(m => {
        const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
        map.set(key, { ...m });
    });

    // 2. Cache local do navegador
    cachedList.forEach(m => {
        if (!m) return;
        const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
        map.set(key, {
            ...m,
            pesoFinal: m.pesoFinal || m.peso_final,
            pesoSuperior: m.pesoSuperior || m.peso_superior,
            pesoSenozoide: m.pesoSenozoide || m.peso_senozoide,
            pesoInferior: m.pesoInferior || m.peso_inferior
        });
    });

    // 3. Tabela dedicada trelica_models do Supabase
    dbModels.forEach(m => {
        if (!m) return;
        const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
        map.set(key, {
            ...m,
            pesoFinal: m.peso_final || m.pesoFinal,
            pesoSuperior: m.peso_superior || m.pesoSuperior,
            pesoSenozoide: m.peso_senozoide || m.pesoSenozoide,
            pesoInferior: m.peso_inferior || m.pesoInferior
        });
    });

    // 4. Cadastros em stock_gauges (Configurações de Bitolas / Estoque)
    (stockGaugesList || [])
        .filter(g => (g.materialType === 'Treliça' || (g.materialType as string) === 'Trelica'))
        .forEach(g => {
            const cod = g.productCode || g.code || '';
            const modelo = g.description || g.name || g.gauge;
            const tamanho = g.tamanho || (g.gauge ? g.gauge.replace(/\D/g, '') : '12') || '12';
            const key = (cod || `${modelo}_${tamanho}`).toUpperCase();
            
            const existing = map.get(key) || {} as Partial<TrelicaModel>;
            const pFinal = g.peso_final || existing.peso_final || existing.pesoFinal || '5,502';
            const pSup = g.peso_superior || existing.peso_superior || existing.pesoSuperior || '';
            const pInf = g.peso_inferior || existing.peso_inferior || existing.pesoInferior || '';
            const pSen = g.peso_senozoide || existing.peso_senozoide || existing.pesoSenozoide || '';

            map.set(key, {
                id: g.id || existing.id || String(Date.now()),
                cod: cod || existing.cod || key,
                modelo: modelo,
                tamanho: tamanho,
                superior: g.superior || existing.superior || '5,6',
                inferior: g.inferior || existing.inferior || '3,2',
                senozoide: g.senozoide || existing.senozoide || '3,2',
                peso_final: pFinal,
                peso_superior: pSup,
                peso_inferior: pInf,
                peso_senozoide: pSen,
                pesoFinal: pFinal,
                pesoSuperior: pSup,
                pesoInferior: pInf,
                pesoSenozoide: pSen
            });
        });

    return Array.from(map.values());
};
