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

const getWeightPerMeter = (d: string) => {
    const dNum = parseFloat((d || '').replace(',', '.'));
    if (isNaN(dNum) || dNum <= 0) return 0;
    return dNum * dNum * 0.0061654;
};

export const calculateTrelicaWeightsFromGauges = (
    tamanhoStr: string,
    superior: string,
    inferior: string,
    senozoide: string,
    trName: string
) => {
    const cleanSup = (superior || '').trim().replace('.', ',');
    const cleanInf = (inferior || '').trim().replace('.', ',');
    const cleanSen = (senozoide || '').trim().replace('.', ',');
    const cleanTam = (tamanhoStr || '12').replace(/\D/g, '') || '12';

    // 1. Se bater exatamente com as bitolas e tamanho de algum modelo da tabela técnica de referência, usa os pesos oficiais
    const nameUpper = (trName || '').toUpperCase();
    const exactDefault = DEFAULT_TRELICA_MODELS.find(d => {
        if (d.tamanho !== cleanTam || d.superior !== cleanSup || d.inferior !== cleanInf || d.senozoide !== cleanSen) {
            return false;
        }
        // Se houver menção à altura (ET6/H6, ET8/H8, ET10/H10, ET12/H12, ET16/H16, ET25/H25), valida também
        if ((nameUpper.includes('ET6') || nameUpper.includes('H-6') || nameUpper.includes('H6')) && !d.modelo.includes('H-6')) return false;
        if ((nameUpper.includes('ET8') || nameUpper.includes('H-8') || nameUpper.includes('H8')) && !d.modelo.includes('H-8')) return false;
        if ((nameUpper.includes('ET10') || nameUpper.includes('H-10') || nameUpper.includes('H10')) && !d.modelo.includes('H-10')) return false;
        if ((nameUpper.includes('ET12') || nameUpper.includes('H-12') || nameUpper.includes('H12')) && !d.modelo.includes('H-12')) return false;
        if ((nameUpper.includes('ET16') || nameUpper.includes('H-16') || nameUpper.includes('H16')) && !d.modelo.includes('H-16')) return false;
        if ((nameUpper.includes('ET25') || nameUpper.includes('H-25') || nameUpper.includes('H25')) && !d.modelo.includes('H-25')) return false;
        return true;
    });

    if (exactDefault) {
        return {
            pesoSuperior: exactDefault.pesoSuperior,
            pesoInferior: exactDefault.pesoInferior,
            pesoSenozoide: exactDefault.pesoSenozoide,
            pesoFinal: exactDefault.pesoFinal
        };
    }

    // 2. Cálculo geométrico pelas bitolas e comprimento
    const tamanho = parseFloat((tamanhoStr || '12').replace(',', '.')) || 12;
    let senozoideMultiplier = 2.58; // padrão H-8 / ET8
    if (nameUpper.includes('H6') || nameUpper.includes('H-6') || nameUpper.includes('ET6') || nameUpper.includes('ET-6') || nameUpper.includes('TR6') || nameUpper.includes('TR-6') || nameUpper.includes('664')) senozoideMultiplier = 2.41;
    else if (nameUpper.includes('H8') || nameUpper.includes('H-8') || nameUpper.includes('ET8') || nameUpper.includes('ET-8') || nameUpper.includes('TR8') || nameUpper.includes('TR-8') || nameUpper.includes('864')) senozoideMultiplier = 2.58;
    else if (nameUpper.includes('H10') || nameUpper.includes('H-10') || nameUpper.includes('ET10') || nameUpper.includes('ET-10') || nameUpper.includes('TR10') || nameUpper.includes('TR-10') || nameUpper.includes('1064')) senozoideMultiplier = 2.86;
    else if (nameUpper.includes('H12') || nameUpper.includes('H-12') || nameUpper.includes('ET12') || nameUpper.includes('ET-12') || nameUpper.includes('TR12') || nameUpper.includes('TR-12') || nameUpper.includes('1264')) senozoideMultiplier = 3.19;
    else if (nameUpper.includes('H16') || nameUpper.includes('H-16') || nameUpper.includes('ET16') || nameUpper.includes('ET-16') || nameUpper.includes('TR16') || nameUpper.includes('TR-16') || nameUpper.includes('1664')) senozoideMultiplier = 3.74;
    else if (nameUpper.includes('H20') || nameUpper.includes('H-20') || nameUpper.includes('ET20') || nameUpper.includes('ET-20') || nameUpper.includes('TR20') || nameUpper.includes('TR-20')) senozoideMultiplier = 4.50;
    else if (nameUpper.includes('H25') || nameUpper.includes('H-25') || nameUpper.includes('ET25') || nameUpper.includes('ET-25') || nameUpper.includes('TR25') || nameUpper.includes('TR-25') || nameUpper.includes('2564')) senozoideMultiplier = 5.40;
    else if (nameUpper.includes('H30') || nameUpper.includes('H-30') || nameUpper.includes('ET30') || nameUpper.includes('ET-30') || nameUpper.includes('TR30') || nameUpper.includes('TR-30')) senozoideMultiplier = 6.30;

    const wSup = getWeightPerMeter(cleanSup) * tamanho;
    const wInf = getWeightPerMeter(cleanInf) * tamanho * 2;
    const wSen = getWeightPerMeter(cleanSen) * tamanho * senozoideMultiplier;
    const wTotal = wSup + wInf + wSen;

    return {
        pesoSuperior: (wSup > 0 ? wSup : 2.322).toFixed(3).replace('.', ','),
        pesoInferior: (wInf > 0 ? wInf : 1.517).toFixed(3).replace('.', ','),
        pesoSenozoide: (wSen > 0 ? wSen : 1.958).toFixed(3).replace('.', ','),
        pesoFinal: (wTotal > 0 ? wTotal : 5.797).toFixed(3).replace('.', ',')
    };
};

/**
 * Retorna os modelos de treliça priorizando EXCLUSIVAMENTE os itens cadastrados
 * no catálogo oficial de produtos (stock_gauges onde materialType === 'Treliça').
 * Apenas se não houver nenhum item cadastrado em stock_gauges usa dbModels/cache/defaults.
 */
export const buildMergedTrelicaModels = (
    dbModels: any[] = [], 
    stockGaugesList: StockGauge[] = [], 
    cachedList: any[] = []
): TrelicaModel[] => {
    const registeredGauges = (stockGaugesList || []).filter(
        g => g && (g.materialType === 'Treliça' || (g.materialType as string) === 'Trelica')
    );

    // Se existem treliças cadastradas no catálogo de produtos (stock_gauges), exibe APENAS os itens do cadastro!
    if (registeredGauges.length > 0) {
        const dbLookup = new Map<string, any>();
        (dbModels || []).forEach(m => {
            if (!m) return;
            const k = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
            dbLookup.set(k, m);
        });

        const sortedGauges = [...registeredGauges].sort((a, b) => {
            const compDesc = (a.description || '').localeCompare(b.description || '');
            if (compDesc !== 0) return compDesc;
            const sizeA = parseInt(a.tamanho || a.gauge || '0', 10) || 0;
            const sizeB = parseInt(b.tamanho || b.gauge || '0', 10) || 0;
            return sizeA - sizeB;
        });

        const map = new Map<string, TrelicaModel>();
        sortedGauges.forEach((g, idx) => {
            const rawCod = (g.productCode || (g as any).code || '').trim();
            const modelo = (g.description || (g as any).name || g.gauge || 'Treliça').trim();
            const tamanho = (g.tamanho || (g.gauge ? g.gauge.replace(/\D/g, '') : '12') || '12').trim();
            const sup = (g.superior || '5,6').trim();
            const inf = (g.inferior || '3,2').trim();
            const sen = (g.senozoide || '3,2').trim();

            let cod = rawCod || `${modelo}_${tamanho}`;
            let key = cod.toUpperCase();
            if (map.has(key)) {
                cod = rawCod ? `${rawCod}_${tamanho}M` : `${modelo}_${tamanho}_${idx + 1}`;
                key = `${cod}_${g.id || idx}`.toUpperCase();
            }

            const existingDb = dbLookup.get(rawCod.toUpperCase()) || dbLookup.get(`${modelo}_${tamanho}`.toUpperCase()) || {};
            const calc = calculateTrelicaWeightsFromGauges(tamanho, sup, inf, sen, `${rawCod} ${modelo}`);

            const pFinal = g.peso_final || existingDb.peso_final || existingDb.pesoFinal || calc.pesoFinal;
            const pSup = g.peso_superior || existingDb.peso_superior || existingDb.pesoSuperior || calc.pesoSuperior;
            const pInf = g.peso_inferior || existingDb.peso_inferior || existingDb.pesoInferior || calc.pesoInferior;
            const pSen = g.peso_senozoide || existingDb.peso_senozoide || existingDb.pesoSenozoide || calc.pesoSenozoide;

            map.set(key, {
                id: g.id || existingDb.id || String(idx + 1),
                cod,
                modelo,
                tamanho,
                superior: sup,
                inferior: inf,
                senozoide: sen,
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
    }

    // Fallback caso stock_gauges ainda não tenha carregado ou esteja vazio:
    const map = new Map<string, TrelicaModel>();

    // Se houver cache vindo de cadastros reais (que não sejam os 19 códigos legados H6LE12S/H8L6/etc.)
    const defaultCodes = new Set(DEFAULT_TRELICA_MODELS.map(d => d.cod.toUpperCase()));
    const customCached = (cachedList || []).filter(m => m && m.cod && !defaultCodes.has(String(m.cod).toUpperCase()));

    if (customCached.length > 0) {
        customCached.forEach(m => {
            const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
            const calc = calculateTrelicaWeightsFromGauges(m.tamanho || '12', m.superior || '5,6', m.inferior || '3,2', m.senozoide || '3,2', `${m.cod || ''} ${m.modelo || ''}`);
            map.set(key, {
                ...m,
                pesoFinal: m.pesoFinal || m.peso_final || calc.pesoFinal,
                pesoSuperior: m.pesoSuperior || m.peso_superior || calc.pesoSuperior,
                pesoSenozoide: m.pesoSenozoide || m.peso_senozoide || calc.pesoSenozoide,
                pesoInferior: m.pesoInferior || m.peso_inferior || calc.pesoInferior
            });
        });
        return Array.from(map.values());
    }

    if (dbModels && dbModels.length > 0) {
        dbModels.forEach(m => {
            if (!m) return;
            const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
            const calc = calculateTrelicaWeightsFromGauges(m.tamanho || '12', m.superior || '5,6', m.inferior || '3,2', m.senozoide || '3,2', `${m.cod || ''} ${m.modelo || ''}`);
            map.set(key, {
                ...m,
                pesoFinal: m.peso_final || m.pesoFinal || calc.pesoFinal,
                pesoSuperior: m.peso_superior || m.pesoSuperior || calc.pesoSuperior,
                pesoSenozoide: m.peso_senozoide || m.pesoSenozoide || calc.pesoSenozoide,
                pesoInferior: m.peso_inferior || m.pesoInferior || calc.pesoInferior
            });
        });
        return Array.from(map.values());
    }

    DEFAULT_TRELICA_MODELS.forEach(m => {
        const key = (m.cod || `${m.modelo}_${m.tamanho}`).toUpperCase();
        map.set(key, { ...m });
    });

    return Array.from(map.values());
};
