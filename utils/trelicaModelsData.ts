import { TrelicaModel, StockGauge } from '../types';

export const DEFAULT_TRELICA_MODELS: TrelicaModel[] = [
    { id: '1', cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '5,667', peso_superior: '2,322', peso_senozoide: '1,828', peso_inferior: '1,517', pesoFinal: '5,667', pesoSuperior: '2,322', pesoSenozoide: '1,828', pesoInferior: '1,517' },
    { id: '2', cod: 'H6_6', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '2,833', peso_superior: '1,161', peso_senozoide: '0,914', peso_inferior: '0,758', pesoFinal: '2,833', pesoSuperior: '1,161', pesoSenozoide: '0,914', pesoInferior: '0,758' },
    { id: '3', cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '2,898', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '0,758', pesoFinal: '2,898', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '0,758' },
    { id: '4', cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '5,797', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '1,517', pesoFinal: '5,797', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '1,517' },
    { id: '5', cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '3,209', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '1,069', pesoFinal: '3,209', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '1,069' },
    { id: '6', cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,418', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '2,138', pesoFinal: '6,418', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '2,138' },
    { id: '7', cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '4,087', peso_superior: '1,333', peso_senozoide: '1,685', peso_inferior: '1,069', pesoFinal: '4,087', pesoSuperior: '1,333', pesoSenozoide: '1,685', pesoInferior: '1,069' },
    { id: '8', cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '8,174', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,138', pesoFinal: '8,174', pesoSuperior: '2,665', pesoSenozoide: '3,371', pesoInferior: '2,138' },
    { id: '9', cod: 'H8SP6', modelo: 'H-8 SUPER PESADO', tamanho: '6', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '4,412', peso_superior: '1,333', peso_senozoide: '1,773', peso_inferior: '1,306', pesoFinal: '4,412', pesoSuperior: '1,333', pesoSenozoide: '1,773', pesoInferior: '1,306' },
    { id: '10', cod: 'H8SP12', modelo: 'H-8 SUPER PESADO', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '8,823', peso_superior: '2,665', peso_senozoide: '3,547', peso_inferior: '2,611', pesoFinal: '8,823', pesoSuperior: '2,665', pesoSenozoide: '3,547', pesoInferior: '2,611' },
    { id: '11', cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '3,843', peso_superior: '1,246', peso_senozoide: '1,528', peso_inferior: '1,069', pesoFinal: '3,843', pesoSuperior: '1,246', pesoSenozoide: '1,528', pesoInferior: '1,069' },
    { id: '12', cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '7,686', peso_superior: '2,491', peso_senozoide: '3,057', peso_inferior: '2,138', pesoFinal: '7,686', pesoSuperior: '2,491', pesoSenozoide: '3,057', pesoInferior: '2,138' },
    { id: '13', cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '9,057', peso_superior: '2,665', peso_senozoide: '3,780', peso_inferior: '2,611', pesoFinal: '9,057', pesoSuperior: '2,665', pesoSenozoide: '3,780', pesoInferior: '2,611' },
    { id: '14', cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '3,522', peso_superior: '1,246', peso_senozoide: '1,207', peso_inferior: '1,069', pesoFinal: '3,522', pesoSuperior: '1,246', pesoSenozoide: '1,207', pesoInferior: '1,069' },
    { id: '15', cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '7,044', peso_superior: '2,491', peso_senozoide: '2,414', peso_inferior: '2,138', pesoFinal: '7,044', pesoSuperior: '2,491', pesoSenozoide: '2,414', pesoInferior: '2,138' },
    { id: '16', cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '5,270', peso_superior: '1,333', peso_senozoide: '2,086', peso_inferior: '1,852', pesoFinal: '5,270', pesoSuperior: '1,333', pesoSenozoide: '2,086', pesoInferior: '1,852' },
    { id: '17', cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '10,540', peso_superior: '2,665', peso_senozoide: '4,172', peso_inferior: '3,703', pesoFinal: '10,540', pesoSuperior: '2,665', pesoSenozoide: '4,172', pesoInferior: '3,703' },
    { id: '18', cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '11,263', peso_superior: '2,665', peso_senozoide: '4,894', peso_inferior: '3,703', pesoFinal: '11,263', pesoSuperior: '2,665', pesoSenozoide: '4,894', pesoInferior: '3,703' },
    { id: '19', cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', peso_final: '20,042', peso_superior: '4,739', peso_senozoide: '9,973', peso_inferior: '5,330', pesoFinal: '20,042', pesoSuperior: '4,739', pesoSenozoide: '9,973', pesoInferior: '5,330' },
    { id: '20', cod: 'H12SP6', modelo: 'H-12 SUPER PESADA', tamanho: '6', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '4,724', peso_superior: '1,333', peso_senozoide: '2,086', peso_inferior: '1,306', pesoFinal: '4,724', pesoSuperior: '1,333', pesoSenozoide: '2,086', pesoInferior: '1,306' },
    { id: '21', cod: 'H12SP12', modelo: 'H-12 SUPER PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '9,448', peso_superior: '2,665', peso_senozoide: '4,172', peso_inferior: '2,611', pesoFinal: '9,448', pesoSuperior: '2,665', pesoSenozoide: '4,172', pesoInferior: '2,611' },
];

export const trelicaModels = DEFAULT_TRELICA_MODELS;

// Tabela oficial de Massa Linear por Bitola (kg/m) da planilha de engenharia
const OFFICIAL_LINEAR_MASS_BY_BITOLA: Record<string, number> = {
    '3.20': 0.0632,
    '3.40': 0.0713,
    '3.80': 0.0891,
    '4.20': 0.1088,
    '5.00': 0.1543,
    '5.40': 0.1799,
    '5.60': 0.1935,
    '5.80': 0.2076,
    '6.00': 0.2221,
    '8.00': 0.3949,
};

const getWeightPerMeter = (d: string) => {
    const dNum = parseFloat((d || '').replace(',', '.'));
    if (isNaN(dNum) || dNum <= 0) return 0;
    const key = dNum.toFixed(2);
    if (OFFICIAL_LINEAR_MASS_BY_BITOLA[key] !== undefined) {
        return OFFICIAL_LINEAR_MASS_BY_BITOLA[key];
    }
    return Number((dNum * dNum * 0.0061705).toFixed(4));
};

export const isLegacyAutoCalculatedWeight = (
    pesoFinalStr: string | undefined,
    tamanhoStr: string,
    superior: string,
    inferior: string,
    senozoide: string
): boolean => {
    if (!pesoFinalStr) return true;
    const saved = parseFloat(String(pesoFinalStr).replace(',', '.'));
    return isNaN(saved) || saved <= 0;
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
    const tamanho = parseFloat((tamanhoStr || '12').replace(',', '.')) || 12;
    const nameUpper = (trName || '').toUpperCase();
    const isSuperPesada = nameUpper.includes('SUPER');
    const isPesada = !isSuperPesada && nameUpper.includes('PESAD');

    // Metragem exata de USO CA60 da Sinuzoide conforme planilha oficial (para 12m, proporcional ao comprimento)
    let sinuzoideMeters12m = 30.979; // H-8 / ET8 padrão
    if (nameUpper.includes('H6') || nameUpper.includes('H-6') || nameUpper.includes('ET6') || nameUpper.includes('ET-6') || nameUpper.includes('TR6') || nameUpper.includes('TR-6') || nameUpper.includes('664')) {
        sinuzoideMeters12m = 28.920;
    } else if (nameUpper.includes('H8') || nameUpper.includes('H-8') || nameUpper.includes('ET8') || nameUpper.includes('ET-8') || nameUpper.includes('TR8') || nameUpper.includes('TR-8') || nameUpper.includes('864')) {
        sinuzoideMeters12m = isSuperPesada ? 32.600 : 30.979;
    } else if (nameUpper.includes('H10') || nameUpper.includes('H-10') || nameUpper.includes('ET10') || nameUpper.includes('ET-10') || nameUpper.includes('TR10') || nameUpper.includes('TR-10') || nameUpper.includes('1064')) {
        sinuzoideMeters12m = (isPesada || isSuperPesada) ? 34.747 : 34.305;
    } else if (nameUpper.includes('H12') || nameUpper.includes('H-12') || nameUpper.includes('ET12') || nameUpper.includes('ET-12') || nameUpper.includes('TR12') || nameUpper.includes('TR-12') || nameUpper.includes('1264')) {
        sinuzoideMeters12m = (isPesada || isSuperPesada) ? 38.343 : 38.197;
    } else if (nameUpper.includes('H16') || nameUpper.includes('H-16') || nameUpper.includes('ET16') || nameUpper.includes('ET-16') || nameUpper.includes('TR16') || nameUpper.includes('TR-16') || nameUpper.includes('1664')) {
        sinuzoideMeters12m = 44.983;
    } else if (nameUpper.includes('H25') || nameUpper.includes('H-25') || nameUpper.includes('ET25') || nameUpper.includes('ET-25') || nameUpper.includes('TR25') || nameUpper.includes('TR-25') || nameUpper.includes('2564')) {
        sinuzoideMeters12m = 64.633;
    }

    const scale = tamanho / 12;
    const sinuzoideMeters = Number((sinuzoideMeters12m * scale).toFixed(3));

    const rawSup = getWeightPerMeter(cleanSup) * tamanho;
    const rawInf = getWeightPerMeter(cleanInf) * (tamanho * 2);
    const rawSen = getWeightPerMeter(cleanSen) * sinuzoideMeters;
    const rawTotal = rawSup + rawInf + rawSen;

    const wSup = Number(rawSup.toFixed(3));
    const wInf = Number(rawInf.toFixed(3));
    const wSen = Number(rawSen.toFixed(3));
    const wTotal = Number(rawTotal.toFixed(3));

    return {
        pesoSuperior: (wSup > 0 ? wSup : 2.322).toFixed(3).replace('.', ','),
        pesoInferior: (wInf > 0 ? wInf : 1.517).toFixed(3).replace('.', ','),
        pesoSenozoide: (wSen > 0 ? wSen : 1.828).toFixed(3).replace('.', ','),
        pesoFinal: (wTotal > 0 ? wTotal : 5.667).toFixed(3).replace('.', ',')
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
            const useRecalculated = isLegacyAutoCalculatedWeight(g.peso_final, tamanho, sup, inf, sen);

            const pFinal = (!useRecalculated && g.peso_final) ? g.peso_final : calc.pesoFinal;
            const pSup = (!useRecalculated && g.peso_superior) ? g.peso_superior : calc.pesoSuperior;
            const pInf = (!useRecalculated && g.peso_inferior) ? g.peso_inferior : calc.pesoInferior;
            const pSen = (!useRecalculated && g.peso_senozoide) ? g.peso_senozoide : calc.pesoSenozoide;

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
