import React, { useState, useMemo, useEffect } from 'react';
import type { ProductionOrderData, StockItem, ShiftReport } from '../types';
import { DefaultTrelicaGauges } from '../types';
import { updateItem } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { STEEL_LINEAR_MASS_CONSTANT } from './MalhaConsumptionReportModal';

export type TrelicaWirePositionKey =
    | 'superior'
    | 'senoide_esq'
    | 'senoide_dir'
    | 'inferior_esq'
    | 'inferior_dir';

export const TRELICA_WIRE_POSITIONS: Array<{
    key: TrelicaWirePositionKey;
    label: string;
    shortLabel: string;
    group: 'superior' | 'senozoide' | 'inferior';
    standIndex: number;
    badgeColor: string;
}> = [
    { key: 'superior', label: '1. Banzo Superior', shortLabel: 'SUPERIOR', group: 'superior', standIndex: 1, badgeColor: 'amber' },
    { key: 'senoide_esq', label: '2. Senoide Esq.', shortLabel: 'SENOIDE ESQ', group: 'senozoide', standIndex: 2, badgeColor: 'purple' },
    { key: 'senoide_dir', label: '3. Senoide Dir.', shortLabel: 'SENOIDE DIR', group: 'senozoide', standIndex: 3, badgeColor: 'indigo' },
    { key: 'inferior_esq', label: '4. Inferior Esq.', shortLabel: 'INFERIOR ESQ', group: 'inferior', standIndex: 4, badgeColor: 'emerald' },
    { key: 'inferior_dir', label: '5. Inferior Dir.', shortLabel: 'INFERIOR DIR', group: 'inferior', standIndex: 5, badgeColor: 'teal' }
];

export interface TrelicaLotSupplyItem {
    id: string;
    lot: string;
    weight: number;
    bitola?: string;
    addedAt?: string;
}

export interface TrelicaPackageLotSplit {
    lot: string;
    consumedKg: number;
    lotInitialKg: number;
    balanceAfterKg: number;
    exhausted: boolean;
}

export interface TrelicaPackageRow {
    id: string;
    packageCode: string; // p1, p2...
    finishedLotNumber: string; // Ex: 88901
    quantity: number; // Padrão: 200 peças
    measuredPackageWeight?: number | null; // Peso real do pacote na balança (kg)
    lotsByPosition?: Partial<Record<TrelicaWirePositionKey, { lot: string; weight: number }>>;
    confirmed?: boolean;
    recordedAt?: string;
    operator?: string;
}

export interface TrelicaTechnicalConfig {
    modelCode: string;
    modelName: string;
    tamanhoMeters: number; // Ex: 6 ou 12 m
    bitolaSuperior: number; // Ex: 5.6 mm
    bitolaSenoide: number; // Ex: 3.2 mm
    bitolaInferior: number; // Ex: 3.2 mm
    pesoSuperiorUnit: number; // kg por peça (1 fio)
    pesoSenoideEsqUnit: number; // kg por peça (1 fio)
    pesoSenoideDirUnit: number; // kg por peça (1 fio)
    pesoInferiorEsqUnit: number; // kg por peça (1 fio)
    pesoInferiorDirUnit: number; // kg por peça (1 fio)
    pesoFinalUnit: number; // kg total de 1 peça
    defaultQtyPerPackage: number; // Padrão: 200 peças
}

export interface TrelicaPackagesReportData {
    version?: number;
    techConfig: TrelicaTechnicalConfig;
    queues: Record<TrelicaWirePositionKey, TrelicaLotSupplyItem[]>;
    packages: TrelicaPackageRow[];
    updatedAt?: string;
}

const cleanLotCode = (val: any): string => String(val ?? '').replace(/^LOTE\s+/i, '').trim();

const parseNum = (val: any, fallback = 0): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    const cleaned = String(val ?? '').replace(/mm|m|kg/gi, '').replace(',', '.').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? fallback : n;
};

export const inferDefaultTrelicaTechConfig = (op?: ProductionOrderData | null): TrelicaTechnicalConfig => {
    const modelStr = String(op?.trelicaModel || (op as any)?.trelica_model || op?.productDescription || '').toUpperCase();
    const rawTam = parseNum(op?.tamanho || (op as any)?.tamanho, 0);

    // Procura modelo correspondente em DefaultTrelicaGauges
    const matched = DefaultTrelicaGauges.find(g => {
        const desc = String(g.description || '').toUpperCase();
        const code = String(g.productCode || '').toUpperCase();
        const tamMatch = rawTam > 0 ? parseNum(g.tamanho) === rawTam : modelStr.includes(`${g.tamanho}M`) || modelStr.includes(` ${g.tamanho} `);
        return (code && modelStr.includes(code)) || (desc && modelStr.includes(desc) && tamMatch);
    }) || DefaultTrelicaGauges.find(g => {
        const desc = String(g.description || '').toUpperCase();
        return desc && modelStr.includes(desc);
    });

    const tamanhoMeters = rawTam > 0 ? rawTam : (matched ? parseNum(matched.tamanho, 12) : (modelStr.includes('6M') || modelStr.includes(' 6 ') ? 6 : 12));
    const bitolaSuperior = parseNum(op?.trelicaSuperior || (op as any)?.trelica_superior || matched?.superior, 5.6);
    const bitolaSenoide = parseNum(op?.trelicaSinusoide || (op as any)?.trelica_sinusoide || matched?.senozoide, 3.2);
    const bitolaInferior = parseNum(op?.trelicaInferior || (op as any)?.trelica_inferior || matched?.inferior, 3.2);

    // Pesos teóricos de 1 peça de treliça
    const calcWireLinearWeight = (bitolaMm: number, lengthM: number) =>
        (bitolaMm ** 2) * STEEL_LINEAR_MASS_CONSTANT * lengthM;

    const scaleRatio = matched && parseNum(matched.tamanho, 0) > 0
        ? tamanhoMeters / parseNum(matched.tamanho, tamanhoMeters)
        : 1;

    const pesoSuperiorUnit = matched?.peso_superior
        ? parseNum(matched.peso_superior) * scaleRatio
        : calcWireLinearWeight(bitolaSuperior, tamanhoMeters);

    const totalSenoideUnit = matched?.peso_senozoide
        ? parseNum(matched.peso_senozoide) * scaleRatio
        : calcWireLinearWeight(bitolaSenoide, tamanhoMeters * 1.18) * 2;

    const totalInferiorUnit = matched?.peso_inferior
        ? parseNum(matched.peso_inferior) * scaleRatio
        : calcWireLinearWeight(bitolaInferior, tamanhoMeters) * 2;

    const pesoSenoideEsqUnit = totalSenoideUnit / 2;
    const pesoSenoideDirUnit = totalSenoideUnit / 2;
    const pesoInferiorEsqUnit = totalInferiorUnit / 2;
    const pesoInferiorDirUnit = totalInferiorUnit / 2;

    const pesoFinalUnit = pesoSuperiorUnit + totalSenoideUnit + totalInferiorUnit;

    return {
        modelCode: matched?.productCode || op?.productCode || 'TRELIÇA',
        modelName: op?.trelicaModel || matched?.description || op?.productDescription || 'TRELIÇA',
        tamanhoMeters,
        bitolaSuperior,
        bitolaSenoide,
        bitolaInferior,
        pesoSuperiorUnit,
        pesoSenoideEsqUnit,
        pesoSenoideDirUnit,
        pesoInferiorEsqUnit,
        pesoInferiorDirUnit,
        pesoFinalUnit,
        defaultQtyPerPackage: 200
    };
};

export const getEmptyTrelicaQueues = (): Record<TrelicaWirePositionKey, TrelicaLotSupplyItem[]> => ({
    superior: [],
    senoide_esq: [],
    senoide_dir: [],
    inferior_esq: [],
    inferior_dir: []
});

export const getSavedTrelicaPackagesData = (
    op?: ProductionOrderData | null,
    stock?: StockItem[]
): TrelicaPackagesReportData => {
    const defaultTech = inferDefaultTrelicaTechConfig(op);
    if (!op) {
        return {
            version: 1,
            techConfig: defaultTech,
            queues: getEmptyTrelicaQueues(),
            packages: []
        };
    }

    const stockMap = new Map<string, { weight: number; bitola: string }>();
    (stock || []).forEach(item => {
        if (item && item.internalLot) {
            const code = cleanLotCode(item.internalLot).toLowerCase();
            const w = Number(item.initialQuantity || item.remainingQuantity || item.labelWeight || 0);
            if (code && w > 0) {
                stockMap.set(code, { weight: w, bitola: String(item.bitola || '') });
            }
        }
    });

    const summary: any = op.summary || {};
    const saved = summary.trelicaPackagesData || summary.trelica_packages_data;

    let localSaved: any = null;
    try {
        const rawLocal = localStorage.getItem(`trelica_packages_data_${op.id || op.orderNumber}`);
        if (rawLocal) localSaved = JSON.parse(rawLocal);
    } catch (e) {}

    const source = (() => {
        if (saved && localSaved) {
            const tSaved = new Date(saved.updatedAt || saved.updated_at || 0).getTime();
            const tLocal = new Date(localSaved.updatedAt || localSaved.updated_at || 0).getTime();
            return tLocal > tSaved ? localSaved : saved;
        }
        return saved || localSaved;
    })();

    const queues = getEmptyTrelicaQueues();

    if (source) {
        const rawTech = source.techConfig || source.tech_config || {};
        const techConfig: TrelicaTechnicalConfig = {
            ...defaultTech,
            ...rawTech,
            tamanhoMeters: Number(rawTech.tamanhoMeters ?? defaultTech.tamanhoMeters) || defaultTech.tamanhoMeters,
            bitolaSuperior: Number(rawTech.bitolaSuperior ?? defaultTech.bitolaSuperior) || defaultTech.bitolaSuperior,
            bitolaSenoide: Number(rawTech.bitolaSenoide ?? defaultTech.bitolaSenoide) || defaultTech.bitolaSenoide,
            bitolaInferior: Number(rawTech.bitolaInferior ?? defaultTech.bitolaInferior) || defaultTech.bitolaInferior,
            pesoSuperiorUnit: Number(rawTech.pesoSuperiorUnit ?? defaultTech.pesoSuperiorUnit) || defaultTech.pesoSuperiorUnit,
            pesoSenoideEsqUnit: Number(rawTech.pesoSenoideEsqUnit ?? defaultTech.pesoSenoideEsqUnit) || defaultTech.pesoSenoideEsqUnit,
            pesoSenoideDirUnit: Number(rawTech.pesoSenoideDirUnit ?? defaultTech.pesoSenoideDirUnit) || defaultTech.pesoSenoideDirUnit,
            pesoInferiorEsqUnit: Number(rawTech.pesoInferiorEsqUnit ?? defaultTech.pesoInferiorEsqUnit) || defaultTech.pesoInferiorEsqUnit,
            pesoInferiorDirUnit: Number(rawTech.pesoInferiorDirUnit ?? defaultTech.pesoInferiorDirUnit) || defaultTech.pesoInferiorDirUnit,
            pesoFinalUnit: Number(rawTech.pesoFinalUnit ?? defaultTech.pesoFinalUnit) || defaultTech.pesoFinalUnit,
            defaultQtyPerPackage: Number(rawTech.defaultQtyPerPackage ?? 200) || 200
        };

        const rawQueues = source.queues || {};
        TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
            const arr = Array.isArray(rawQueues[key]) ? rawQueues[key] : [];
            queues[key] = arr
                .map((item: any, idx: number) => {
                    const lot = cleanLotCode(item?.lot);
                    const stockInfo = stockMap.get(lot.toLowerCase());
                    return {
                        id: item?.id || `${key}-q-${idx}`,
                        lot,
                        weight: Number(item?.weight) || stockInfo?.weight || 0,
                        bitola: item?.bitola || stockInfo?.bitola || '',
                        addedAt: item?.addedAt
                    };
                })
                .filter((x: TrelicaLotSupplyItem) => Boolean(x.lot));
        });

        const rawPackages = Array.isArray(source.packages) ? source.packages : [];
        const packages: TrelicaPackageRow[] = rawPackages.map((p: any, idx: number) => ({
            id: p.id || `tpkg-${idx + 1}`,
            packageCode: `p${idx + 1}`,
            finishedLotNumber: String(p.finishedLotNumber ?? p.finished_lot_number ?? ''),
            quantity: Number(p.quantity ?? 200) || 200,
            measuredPackageWeight: p.measuredPackageWeight ?? p.measured_package_weight ?? null,
            lotsByPosition: p.lotsByPosition || {},
            confirmed: true,
            recordedAt: p.recordedAt || p.recorded_at,
            operator: p.operator
        }));

        return {
            version: 1,
            techConfig,
            queues,
            packages,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    // Se ainda não houver trelicaPackagesData mas houver weighedPackages legados na OP, converte-os
    const legacyWeighed: any[] = Array.isArray(op.weighedPackages) ? op.weighedPackages : [];
    const initialPackages: TrelicaPackageRow[] = legacyWeighed
        .filter((wp: any) => Number(wp.weight || wp.packageWeightKg) > 0 || Number(wp.quantity) > 0)
        .map((wp: any, idx: number) => ({
            id: wp.id || `tpkg-legacy-${idx + 1}`,
            packageCode: `p${idx + 1}`,
            finishedLotNumber: String(wp.finishedLotNumber || wp.lotNumber || ''),
            quantity: Number(wp.quantity || 200) || 200,
            measuredPackageWeight: Number(wp.weight || wp.packageWeightKg) || null,
            lotsByPosition: {},
            confirmed: true,
            recordedAt: wp.timestamp || wp.recordedAt
        }));

    return {
        version: 1,
        techConfig: defaultTech,
        queues,
        packages: initialPackages
    };
};

export const saveTrelicaPackagesData = async (op: ProductionOrderData, data: TrelicaPackagesReportData) => {
    const payload: TrelicaPackagesReportData = {
        ...data,
        version: 1,
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(`trelica_packages_data_${op.id || op.orderNumber}`, JSON.stringify(payload));
    } catch (e) {}

    // Sincroniza também com weighedPackages na OP para manter 100% compatível com os cards e gráficos existentes
    const syncedWeighedPackages = payload.packages.map((pkg, idx) => ({
        id: pkg.id || `tpkg-${idx + 1}`,
        packageNumber: idx + 1,
        packageCode: pkg.packageCode || `p${idx + 1}`,
        finishedLotNumber: pkg.finishedLotNumber || '',
        quantity: Number(pkg.quantity || 200) || 200,
        weight: Number(pkg.measuredPackageWeight || 0),
        timestamp: pkg.recordedAt || new Date().toISOString()
    }));

    const totalPackagedWeight = syncedWeighedPackages.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);

    if (op.id) {
        try {
            const currentSummary = op.summary && typeof op.summary === 'object' ? op.summary : {};
            const updatedSummary = {
                ...currentSummary,
                trelicaPackagesData: payload
            };
            op.summary = updatedSummary;
            op.weighedPackages = syncedWeighedPackages;
            if (totalPackagedWeight > 0) {
                op.actualProducedWeight = totalPackagedWeight;
            }
            await updateItem('production_orders', op.id, {
                summary: updatedSummary,
                weighedPackages: syncedWeighedPackages,
                ...(totalPackagedWeight > 0 ? { actualProducedWeight: totalPackagedWeight } : {})
            } as any);
        } catch (err) {
            console.warn('Erro ao salvar pacotes de treliça no Supabase:', err);
        }
    }
    return payload;
};

export const getWireShareByPosition = (
    techConfig: TrelicaTechnicalConfig
): Record<TrelicaWirePositionKey, { unitWeight: number; ratio: number; bitola: number; linearMeters: number }> => {
    const sup = Math.max(0.001, Number(techConfig.pesoSuperiorUnit) || 1);
    const senE = Math.max(0.001, Number(techConfig.pesoSenoideEsqUnit) || 0.5);
    const senD = Math.max(0.001, Number(techConfig.pesoSenoideDirUnit) || 0.5);
    const infE = Math.max(0.001, Number(techConfig.pesoInferiorEsqUnit) || 0.5);
    const infD = Math.max(0.001, Number(techConfig.pesoInferiorDirUnit) || 0.5);
    const total = sup + senE + senD + infE + infD;

    const tam = Number(techConfig.tamanhoMeters) || 12;

    return {
        superior: {
            unitWeight: sup,
            ratio: sup / total,
            bitola: techConfig.bitolaSuperior,
            linearMeters: tam
        },
        senoide_esq: {
            unitWeight: senE,
            ratio: senE / total,
            bitola: techConfig.bitolaSenoide,
            linearMeters: +(tam * 1.18).toFixed(2)
        },
        senoide_dir: {
            unitWeight: senD,
            ratio: senD / total,
            bitola: techConfig.bitolaSenoide,
            linearMeters: +(tam * 1.18).toFixed(2)
        },
        inferior_esq: {
            unitWeight: infE,
            ratio: infE / total,
            bitola: techConfig.bitolaInferior,
            linearMeters: tam
        },
        inferior_dir: {
            unitWeight: infD,
            ratio: infD / total,
            bitola: techConfig.bitolaInferior,
            linearMeters: tam
        }
    };
};

export const calculateTrelicaFromPackageWeight = (
    packageWeightKg: number,
    quantity: number,
    techConfig: TrelicaTechnicalConfig
) => {
    const shares = getWireShareByPosition(techConfig);
    const qty = Math.max(1, Number(quantity) || 200);
    const hasRealWeight = Number(packageWeightKg) > 0;
    const theoreticalPkgWeight = qty * techConfig.pesoFinalUnit;
    const effectivePkgWeight = hasRealWeight ? Number(packageWeightKg) : theoreticalPkgWeight;
    const unitPieceWeight = effectivePkgWeight / qty;

    const kgConsByPosition: Record<TrelicaWirePositionKey, number> = {
        superior: effectivePkgWeight * shares.superior.ratio,
        senoide_esq: effectivePkgWeight * shares.senoide_esq.ratio,
        senoide_dir: effectivePkgWeight * shares.senoide_dir.ratio,
        inferior_esq: effectivePkgWeight * shares.inferior_esq.ratio,
        inferior_dir: effectivePkgWeight * shares.inferior_dir.ratio
    };

    return {
        hasRealWeight,
        packageWeightKg: effectivePkgWeight,
        unitPieceWeight,
        kgConsByPosition,
        shares
    };
};

export interface ComputedTrelicaPositionCell {
    lot: string;
    lotInitialWeight: number;
    kgCons: number;
    balanceAfterKg: number;
    splits: TrelicaPackageLotSplit[];
}

export interface ComputedTrelicaPackageRow extends TrelicaPackageRow {
    packageWeightKg: number;
    hasRealWeight: boolean;
    unitPieceWeight: number;
    positions: Record<TrelicaWirePositionKey, ComputedTrelicaPositionCell>;
}

export interface TrelicaConsumedLotSummaryRow {
    id: string;
    positionKey: TrelicaWirePositionKey;
    positionLabel: string;
    bitola: number;
    lot: string;
    kgEntra: number;
    cons: number;
    sobra: number;
    roleStatus: 'CONSUMED' | 'ACTIVE' | 'RESERVE';
}

export const computeTrelicaPackagesAndLots = (
    packages: TrelicaPackageRow[],
    techConfig: TrelicaTechnicalConfig,
    queues: Record<TrelicaWirePositionKey, TrelicaLotSupplyItem[]>
): {
    computedRows: ComputedTrelicaPackageRow[];
    consumedLots: TrelicaConsumedLotSummaryRow[];
    totals: {
        totalPackages: number;
        totalPieces: number;
        totalWeightKg: number;
        avgPieceWeightKg: number;
        totalConsByPos: Record<TrelicaWirePositionKey, number>;
        totalEntra: number;
        totalCons: number;
        totalSobra: number;
    };
    activeStateByPos: Record<
        TrelicaWirePositionKey,
        {
            activeLot: TrelicaConsumedLotSummaryRow | null;
            reserveLot: TrelicaConsumedLotSummaryRow | null;
            consumedHistory: TrelicaConsumedLotSummaryRow[];
        }
    >;
} => {
    const shares = getWireShareByPosition(techConfig);

    type PoolEntry = {
        lot: string;
        initialWeight: number;
        consumed: number;
        remaining: number;
    };

    const pools: Record<TrelicaWirePositionKey, PoolEntry[]> = {
        superior: [],
        senoide_esq: [],
        senoide_dir: [],
        inferior_esq: [],
        inferior_dir: []
    };

    TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
        const q = queues[key] || [];
        q.forEach(item => {
            const code = cleanLotCode(item.lot);
            if (!code) return;
            const existing = pools[key].find(p => p.lot === code);
            if (!existing) {
                const w = Number(item.weight) || 0;
                pools[key].push({
                    lot: code,
                    initialWeight: w,
                    consumed: 0,
                    remaining: w
                });
            } else if (Number(item.weight) > 0 && existing.initialWeight === 0) {
                existing.initialWeight = Number(item.weight);
                existing.remaining = Number(item.weight);
            }
        });

        // Garante que lotes salvos dentro dos pacotes também existam no pool
        packages.forEach(pkg => {
            const posInfo = pkg.lotsByPosition?.[key];
            const c = cleanLotCode(posInfo?.lot);
            const w = Number(posInfo?.weight) || 0;
            if (c) {
                const ex = pools[key].find(p => p.lot === c);
                if (!ex) {
                    pools[key].push({ lot: c, initialWeight: w, consumed: 0, remaining: w });
                } else if (w > 0 && ex.initialWeight === 0) {
                    ex.initialWeight = w;
                    ex.remaining = w;
                }
            }
        });
    });

    const consumeFromPool = (pool: PoolEntry[], neededKg: number, fallbackLot: string, fallbackWeight: number) => {
        let remainingToConsume = neededKg;
        const splits: TrelicaPackageLotSplit[] = [];

        for (let i = 0; i < pool.length && remainingToConsume > 0.0001; i++) {
            const entry = pool[i];
            if (entry.initialWeight > 0 && entry.remaining <= 0.0001) {
                continue;
            }

            if (entry.initialWeight > 0) {
                const hasNextLotInPool = i < pool.length - 1;
                if (entry.remaining >= remainingToConsume - 0.0001 || !hasNextLotInPool) {
                    const taken = remainingToConsume;
                    entry.consumed += taken;
                    entry.remaining = entry.initialWeight - entry.consumed;
                    remainingToConsume = 0;
                    splits.push({
                        lot: entry.lot,
                        consumedKg: taken,
                        lotInitialKg: entry.initialWeight,
                        balanceAfterKg: entry.remaining,
                        exhausted: entry.remaining <= 0.01
                    });
                } else {
                    const taken = entry.remaining;
                    entry.consumed += taken;
                    entry.remaining = 0;
                    remainingToConsume -= taken;
                    splits.push({
                        lot: entry.lot,
                        consumedKg: taken,
                        lotInitialKg: entry.initialWeight,
                        balanceAfterKg: 0,
                        exhausted: true
                    });
                }
            } else {
                const taken = remainingToConsume;
                entry.consumed += taken;
                entry.remaining = -entry.consumed;
                remainingToConsume = 0;
                splits.push({
                    lot: entry.lot,
                    consumedKg: taken,
                    lotInitialKg: 0,
                    balanceAfterKg: 0,
                    exhausted: false
                });
            }
        }

        if (splits.length === 0) {
            return {
                primaryLot: fallbackLot || '',
                primaryLotWeight: fallbackWeight || 0,
                balanceAfter: (fallbackWeight || 0) - neededKg,
                splits: fallbackLot
                    ? [
                          {
                              lot: fallbackLot,
                              consumedKg: neededKg,
                              lotInitialKg: fallbackWeight || 0,
                              balanceAfterKg: (fallbackWeight || 0) - neededKg,
                              exhausted: false
                          }
                      ]
                    : []
            };
        }

        const lastSplit = splits[splits.length - 1];
        return {
            primaryLot: lastSplit.lot,
            primaryLotWeight: lastSplit.lotInitialKg,
            balanceAfter: lastSplit.balanceAfterKg,
            splits
        };
    };

    const totalConsByPos: Record<TrelicaWirePositionKey, number> = {
        superior: 0,
        senoide_esq: 0,
        senoide_dir: 0,
        inferior_esq: 0,
        inferior_dir: 0
    };

    const computedRows: ComputedTrelicaPackageRow[] = packages.map((pkg, idx) => {
        const calc = calculateTrelicaFromPackageWeight(
            Number(pkg.measuredPackageWeight) || 0,
            pkg.quantity || techConfig.defaultQtyPerPackage || 200,
            techConfig
        );

        const positions = {} as Record<TrelicaWirePositionKey, ComputedTrelicaPositionCell>;

        TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
            const neededKg = calc.kgConsByPosition[key];
            totalConsByPos[key] += neededKg;
            const savedPos = pkg.lotsByPosition?.[key];
            const res = consumeFromPool(
                pools[key],
                neededKg,
                cleanLotCode(savedPos?.lot),
                Number(savedPos?.weight) || 0
            );
            positions[key] = {
                lot: res.primaryLot,
                lotInitialWeight: res.primaryLotWeight,
                kgCons: neededKg,
                balanceAfterKg: res.balanceAfter,
                splits: res.splits
            };
        });

        return {
            ...pkg,
            packageCode: `p${idx + 1}`,
            packageWeightKg: calc.packageWeightKg,
            hasRealWeight: calc.hasRealWeight,
            unitPieceWeight: calc.unitPieceWeight,
            positions
        };
    });

    const consumedLots: TrelicaConsumedLotSummaryRow[] = [];
    const activeStateByPos = {} as Record<
        TrelicaWirePositionKey,
        {
            activeLot: TrelicaConsumedLotSummaryRow | null;
            reserveLot: TrelicaConsumedLotSummaryRow | null;
            consumedHistory: TrelicaConsumedLotSummaryRow[];
        }
    >;

    TRELICA_WIRE_POSITIONS.forEach(({ key, shortLabel }) => {
        const pool = pools[key];
        let foundActive = false;
        let foundReserve = false;
        let activeLot: TrelicaConsumedLotSummaryRow | null = null;
        let reserveLot: TrelicaConsumedLotSummaryRow | null = null;
        const consumedHistory: TrelicaConsumedLotSummaryRow[] = [];

        pool.forEach((entry, idx) => {
            const isExhausted = entry.initialWeight > 0 && entry.remaining <= 0.05 && entry.consumed > 0;
            let roleStatus: 'CONSUMED' | 'ACTIVE' | 'RESERVE' = 'RESERVE';
            if (isExhausted) {
                roleStatus = 'CONSUMED';
            } else if (!foundActive) {
                roleStatus = 'ACTIVE';
                foundActive = true;
            } else if (!foundReserve) {
                roleStatus = 'RESERVE';
                foundReserve = true;
            }

            const row: TrelicaConsumedLotSummaryRow = {
                id: `${key}-lot-${idx}-${entry.lot}`,
                positionKey: key,
                positionLabel: shortLabel,
                bitola: shares[key].bitola,
                lot: entry.lot,
                kgEntra: entry.initialWeight,
                cons: entry.consumed,
                sobra: entry.initialWeight > 0 ? entry.remaining : 0,
                roleStatus
            };

            consumedLots.push(row);
            if (roleStatus === 'ACTIVE') activeLot = row;
            else if (roleStatus === 'RESERVE' && !reserveLot) reserveLot = row;
            else if (roleStatus === 'CONSUMED') consumedHistory.push(row);
        });

        activeStateByPos[key] = { activeLot, reserveLot, consumedHistory };
    });

    const totalPackages = computedRows.length;
    const totalPieces = computedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
    const totalWeightKg = computedRows.reduce((acc, r) => acc + r.packageWeightKg, 0);
    const avgPieceWeightKg = totalPieces > 0 ? totalWeightKg / totalPieces : techConfig.pesoFinalUnit;

    const totalEntra = consumedLots.reduce((acc, r) => acc + r.kgEntra, 0);
    const totalCons = consumedLots.reduce((acc, r) => acc + r.cons, 0);
    const totalSobra = consumedLots.reduce((acc, r) => acc + r.sobra, 0);

    return {
        computedRows,
        consumedLots,
        totals: {
            totalPackages,
            totalPieces,
            totalWeightKg,
            avgPieceWeightKg,
            totalConsByPos,
            totalEntra,
            totalCons,
            totalSobra
        },
        activeStateByPos
    };
};

const formatBR = (val: number, decimals = 2) =>
    Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

const formatInt = (val: number) => Math.round(Number(val || 0)).toLocaleString('pt-BR');

export interface DailyProductionMarking {
    dateKey: string;
    displayDate: string;
    quantity: number;
    weightKg: number;
    avgWeightPerPiece: number;
}

export const extractDailyMarkingsForTrelicaOp = (
    op: ProductionOrderData,
    shiftReports: ShiftReport[] | undefined,
    unitWeightFallback: number
): DailyProductionMarking[] => {
    const byDate = new Map<string, { qty: number; weight: number }>();
    const targetOpId = String(op.id || '').trim();
    const targetOrderNum = String(op.orderNumber || '').replace(/^#/, '').trim().toLowerCase();

    const addEntry = (rawDate: string | undefined, qty: number, weight?: number) => {
        if (!rawDate || qty <= 0) return;
        let dateKey = rawDate.slice(0, 10);
        if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
                const dd = parts[0].padStart(2, '0');
                const mm = parts[1].padStart(2, '0');
                const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                dateKey = `${yyyy}-${mm}-${dd}`;
            }
        }
        const prev = byDate.get(dateKey) || { qty: 0, weight: 0 };
        const calcW = Number(weight) > 0 ? Number(weight) : qty * unitWeightFallback;
        // Usa o maior apontamento ou soma turnos distintos do mesmo dia
        byDate.set(dateKey, {
            qty: prev.qty + qty,
            weight: prev.weight + calcW
        });
    };

    const matchingShifts = (shiftReports || []).filter(sr => {
        const srOpId = String(sr.productionOrderId || (sr as any).production_order_id || '').trim();
        const srOrderNum = String(sr.orderNumber || (sr as any).order_number || '').replace(/^#/, '').trim().toLowerCase();
        if (targetOpId && srOpId && srOpId === targetOpId) return true;
        if (targetOrderNum && srOrderNum && srOrderNum === targetOrderNum) return true;
        return false;
    });

    if (matchingShifts.length > 0) {
        matchingShifts.forEach(sr => {
            const qty = Number(sr.totalProducedQuantity ?? sr.totalPcs ?? (sr as any).total_produced_quantity ?? 0);
            const w = Number(sr.totalProducedWeight ?? sr.totalWeight ?? (sr as any).total_produced_weight ?? 0);
            const d = sr.date || (sr.shiftStartTime ? sr.shiftStartTime.slice(0, 10) : '') || (sr.startTime ? sr.startTime.slice(0, 10) : '');
            if (qty > 0 && d) {
                addEntry(d, qty, w);
            }
        });
    }

    // Fallback: operatorLogs ou summary.dailyProductionHistory
    if (byDate.size === 0 && Array.isArray(op.operatorLogs)) {
        op.operatorLogs.forEach((log: any) => {
            const q = Number(log.producedQuantity ?? log.quantity ?? 0);
            const d = String(log.date || log.timestamp || '').slice(0, 10);
            if (q > 0 && d) {
                byDate.set(d, { qty: q, weight: q * unitWeightFallback });
            }
        });
    }

    if (byDate.size === 0 && Number(op.actualProducedQuantity || 0) > 0) {
        const fallbackDate = (op.lastQuantityUpdate || op.startTime || new Date().toISOString()).slice(0, 10);
        const q = Number(op.actualProducedQuantity || 0);
        byDate.set(fallbackDate, { qty: q, weight: q * unitWeightFallback });
    }

    return Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dateKey, val]) => {
            const [y, m, d] = dateKey.split('-');
            const displayDate = d && m && y ? `${d}/${m}/${y}` : dateKey;
            const avg = val.qty > 0 ? val.weight / val.qty : unitWeightFallback;
            return {
                dateKey,
                displayDate,
                quantity: val.qty,
                weightKg: val.weight,
                avgWeightPerPiece: avg
            };
        });
};

// ============================================================================
// 1. PAINEL SIMPLIFICADO DO OPERADOR & GESTOR (5 POSIÇÕES + PACOTES DE 200 PÇS)
// ============================================================================

interface TrelicaPackagesOperatorPanelProps {
    op: ProductionOrderData;
    stock?: StockItem[];
    shiftReports?: ShiftReport[];
    machineName?: string;
    showManagerControls?: boolean;
    onOpenFullSheet?: () => void;
}

export const TrelicaPackagesOperatorPanel: React.FC<TrelicaPackagesOperatorPanelProps> = ({
    op,
    stock = [],
    shiftReports = [],
    machineName,
    showManagerControls = false,
    onOpenFullSheet
}) => {
    const [reportData, setReportData] = useState<TrelicaPackagesReportData>(() =>
        getSavedTrelicaPackagesData(op, stock)
    );
    const [fetchedShifts, setFetchedShifts] = useState<ShiftReport[]>([]);
    const [showFullSheetModal, setShowFullSheetModal] = useState(false);

    // Formulário de Novo Pacote (Padrão 200 peças)
    const [newPkgWeight, setNewPkgWeight] = useState<string>('');
    const [newPkgQty, setNewPkgQty] = useState<string>('200');
    const [newPkgLabelLot, setNewPkgLabelLot] = useState<string>('');
    const [packageValidationError, setPackageValidationError] = useState<{
        message: string;
        missingPositions: TrelicaWirePositionKey[];
    } | null>(null);

    // Seleção / Edição de Lote Ativo ou Reserva de uma das 5 posições
    const [editingSlot, setEditingSlot] = useState<{
        positionKey: TrelicaWirePositionKey;
        slotType: 'ACTIVE' | 'RESERVE';
    } | null>(null);
    const [lotInputText, setLotInputText] = useState<string>('');
    const [lotWeightText, setLotWeightText] = useState<string>('');
    const [showAllGaugesInPicker, setShowAllGaugesInPicker] = useState<boolean>(false);
    const [slotError, setSlotError] = useState<string | null>(null);

    useEffect(() => {
        setReportData(getSavedTrelicaPackagesData(op, stock));
    }, [op?.id, op?.orderNumber]);

    useEffect(() => {
        let cancelled = false;
        const loadShifts = async () => {
            if (!op?.id && !op?.orderNumber) return;
            try {
                const { data } = await supabase
                    .from('shift_reports')
                    .select('*')
                    .order('created_at', { ascending: true });
                if (!cancelled && Array.isArray(data)) {
                    setFetchedShifts(data as any[]);
                }
            } catch (e) {}
        };
        loadShifts();
        return () => {
            cancelled = true;
        };
    }, [op?.id, op?.orderNumber]);

    const computed = useMemo(
        () => computeTrelicaPackagesAndLots(reportData.packages, reportData.techConfig, reportData.queues),
        [reportData]
    );

    const shares = useMemo(() => getWireShareByPosition(reportData.techConfig), [reportData.techConfig]);

    const allShiftReports = useMemo(() => {
        const map = new Map<string, ShiftReport>();
        (shiftReports || []).forEach(s => {
            if (s?.id) map.set(s.id, s);
        });
        (fetchedShifts || []).forEach(s => {
            if (s?.id) map.set(s.id, s);
        });
        return Array.from(map.values());
    }, [shiftReports, fetchedShifts]);

    // Lotes já em uso ou já esgotados em qualquer uma das 5 posições
    const usedOrActiveLotsSet = useMemo(() => {
        const map = new Map<string, { posLabel: string; status: string }>();
        computed.consumedLots.forEach(row => {
            const code = cleanLotCode(row.lot).toLowerCase();
            if (code) {
                map.set(code, {
                    posLabel: row.positionLabel,
                    status: row.roleStatus === 'CONSUMED' ? 'ESGOTADO' : row.roleStatus === 'ACTIVE' ? 'EM MÁQUINA' : 'NA RESERVA'
                });
            }
        });
        return map;
    }, [computed.consumedLots]);

    const persistData = async (next: TrelicaPackagesReportData) => {
        setReportData(next);
        await saveTrelicaPackagesData(op, next);
    };

    const openLotPicker = (positionKey: TrelicaWirePositionKey, slotType: 'ACTIVE' | 'RESERVE') => {
        const state = computed.activeStateByPos[positionKey];
        const current = slotType === 'ACTIVE' ? state?.activeLot : state?.reserveLot;
        setEditingSlot({ positionKey, slotType });
        setLotInputText(current?.lot || '');
        setLotWeightText(current?.kgEntra ? String(current.kgEntra) : '');
        setShowAllGaugesInPicker(false);
        setSlotError(null);
    };

    const handleDirectWeightChange = async (
        positionKey: TrelicaWirePositionKey,
        lotCode: string,
        newWeight: number
    ) => {
        const cleanTarget = cleanLotCode(lotCode);
        const currentQueue = (reportData.queues[positionKey] || []).map(item =>
            cleanLotCode(item.lot) === cleanTarget ? { ...item, weight: Math.max(0, newWeight) } : item
        );
        await persistData({
            ...reportData,
            queues: {
                ...reportData.queues,
                [positionKey]: currentQueue
            }
        });
    };

    const handleSaveLotSlot = async () => {
        if (!editingSlot) return;
        const { positionKey, slotType } = editingSlot;
        const code = cleanLotCode(lotInputText);
        const weight = parseNum(lotWeightText, 0);

        if (!code) {
            setSlotError('Informe o número do Lote CA-60.');
            return;
        }
        if (weight <= 0) {
            setSlotError('Informe o peso inicial do rolo (kg).');
            return;
        }

        const currentPosState = computed.activeStateByPos[positionKey];
        const currentEditingLot =
            slotType === 'ACTIVE'
                ? cleanLotCode(currentPosState?.activeLot?.lot).toLowerCase()
                : cleanLotCode(currentPosState?.reserveLot?.lot).toLowerCase();

        const existingUsage = usedOrActiveLotsSet.get(code.toLowerCase());
        if (existingUsage && code.toLowerCase() !== currentEditingLot) {
            setSlotError(
                `O Lote #${code} já está ${existingUsage.status} na posição ${existingUsage.posLabel}. Selecione outro rolo.`
            );
            return;
        }

        const currentQueue = [...(reportData.queues[positionKey] || [])];
        const activeLotObj = currentPosState?.activeLot;
        const reserveLotObj = currentPosState?.reserveLot;

        if (slotType === 'ACTIVE') {
            if (activeLotObj) {
                const idx = currentQueue.findIndex(q => cleanLotCode(q.lot) === cleanLotCode(activeLotObj.lot));
                if (idx >= 0) {
                    currentQueue[idx] = { ...currentQueue[idx], lot: code, weight };
                } else {
                    currentQueue.unshift({ id: `${positionKey}-${Date.now()}`, lot: code, weight, addedAt: new Date().toISOString() });
                }
            } else {
                currentQueue.push({ id: `${positionKey}-${Date.now()}`, lot: code, weight, addedAt: new Date().toISOString() });
            }
        } else {
            if (reserveLotObj) {
                const idx = currentQueue.findIndex(q => cleanLotCode(q.lot) === cleanLotCode(reserveLotObj.lot));
                if (idx >= 0) {
                    currentQueue[idx] = { ...currentQueue[idx], lot: code, weight };
                } else {
                    currentQueue.push({ id: `${positionKey}-res-${Date.now()}`, lot: code, weight, addedAt: new Date().toISOString() });
                }
            } else {
                currentQueue.push({ id: `${positionKey}-res-${Date.now()}`, lot: code, weight, addedAt: new Date().toISOString() });
            }
        }

        const nextData: TrelicaPackagesReportData = {
            ...reportData,
            queues: {
                ...reportData.queues,
                [positionKey]: currentQueue
            }
        };

        await persistData(nextData);
        setEditingSlot(null);
        setPackageValidationError(null);
    };

    const handleRemoveReserveSlot = async (positionKey: TrelicaWirePositionKey) => {
        const resLot = computed.activeStateByPos[positionKey]?.reserveLot;
        if (!resLot) return;
        const nextQueue = (reportData.queues[positionKey] || []).filter(
            q => cleanLotCode(q.lot) !== cleanLotCode(resLot.lot)
        );
        await persistData({
            ...reportData,
            queues: {
                ...reportData.queues,
                [positionKey]: nextQueue
            }
        });
    };

    // Preview em tempo real da distribuição do pacote que o operador está digitando
    const livePreview = useMemo(() => {
        const w = parseNum(newPkgWeight, 0);
        const q = Math.max(1, Math.round(parseNum(newPkgQty, 200)));
        return calculateTrelicaFromPackageWeight(w, q, reportData.techConfig);
    }, [newPkgWeight, newPkgQty, reportData.techConfig]);

    const handleConfirmNewPackage = async () => {
        const weightKg = parseNum(newPkgWeight, 0);
        const qty = Math.max(1, Math.round(parseNum(newPkgQty, 200)));

        if (weightKg <= 0) {
            setPackageValidationError({
                message: 'Digite o Peso do Pacote na balança (kg) antes de confirmar!',
                missingPositions: []
            });
            return;
        }

        const calc = calculateTrelicaFromPackageWeight(weightKg, qty, reportData.techConfig);
        const missingActive: TrelicaWirePositionKey[] = [];
        const deficitPositions: Array<{
            posKey: TrelicaWirePositionKey;
            label: string;
            needed: number;
            available: number;
        }> = [];

        TRELICA_WIRE_POSITIONS.forEach(({ key, shortLabel }) => {
            const st = computed.activeStateByPos[key];
            const active = st?.activeLot;
            const reserve = st?.reserveLot;
            const needed = calc.kgConsByPosition[key];

            if (!active || !active.lot || active.kgEntra <= 0) {
                missingActive.push(key);
                return;
            }

            const totalAvailableInPosition = (Number(active.sobra) || 0) + (reserve ? Number(reserve.sobra) || 0 : 0);
            if (totalAvailableInPosition < needed - 0.05) {
                deficitPositions.push({
                    posKey: key,
                    label: shortLabel,
                    needed,
                    available: totalAvailableInPosition
                });
            }
        });

        if (missingActive.length > 0) {
            const names = missingActive
                .map(k => TRELICA_WIRE_POSITIONS.find(p => p.key === k)?.shortLabel || k)
                .join(', ');
            setPackageValidationError({
                message: `Selecione primeiro o Lote Ativo (e seu Peso) para: ${names}.`,
                missingPositions: missingActive
            });
            return;
        }

        if (deficitPositions.length > 0) {
            const details = deficitPositions
                .map(
                    d =>
                        `${d.label} (precisa ${formatBR(d.needed, 0)} kg, saldo ${formatBR(d.available, 0)} kg)`
                )
                .join(' • ');
            setPackageValidationError({
                message: `Saldo insuficiente no rolo ativo! Cadastre o 2º Lote Reserva para: ${details}`,
                missingPositions: deficitPositions.map(d => d.posKey)
            });
            return;
        }

        const lotsByPosition: Partial<Record<TrelicaWirePositionKey, { lot: string; weight: number }>> = {};
        TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
            const act = computed.activeStateByPos[key]?.activeLot;
            if (act) {
                lotsByPosition[key] = { lot: act.lot, weight: act.kgEntra };
            }
        });

        const nextIndex = reportData.packages.length + 1;
        const newRow: TrelicaPackageRow = {
            id: `tpkg-${Date.now()}`,
            packageCode: `p${nextIndex}`,
            finishedLotNumber: newPkgLabelLot.trim(),
            quantity: qty,
            measuredPackageWeight: weightKg,
            lotsByPosition,
            confirmed: true,
            recordedAt: new Date().toISOString(),
            operator: op.operator || 'Operador'
        };

        const nextData: TrelicaPackagesReportData = {
            ...reportData,
            packages: [...reportData.packages, newRow]
        };

        await persistData(nextData);
        setNewPkgWeight('');
        setNewPkgLabelLot('');
        setPackageValidationError(null);
    };

    const handleUpdateSavedPkgWeight = async (pkgId: string, newWeight: number | null) => {
        const nextPackages = reportData.packages.map(p =>
            p.id === pkgId ? { ...p, measuredPackageWeight: newWeight } : p
        );
        await persistData({ ...reportData, packages: nextPackages });
    };

    const handleDeletePackage = async (pkgId: string) => {
        const nextPackages = reportData.packages
            .filter(p => p.id !== pkgId)
            .map((p, idx) => ({ ...p, packageCode: `p${idx + 1}` }));
        await persistData({
            ...reportData,
            packages: nextPackages
        });
    };

    // Lista de lotes CA-60 disponíveis no estoque para o seletor rápido por toque
    const availableStockForEditingSlot = useMemo(() => {
        if (!editingSlot) return [];
        const targetBitola = shares[editingSlot.positionKey].bitola;
        const normalizeB = (b: any) => parseNum(b, 0).toFixed(2);
        const targetBStr = normalizeB(targetBitola);

        return (stock || [])
            .filter(item => {
                if (!item || !item.internalLot) return false;
                const mat = String(item.materialType || '').toUpperCase();
                const isWire = mat.includes('CA-60') || mat.includes('CA60') || mat.includes('ARAME') || mat.includes('TRELI');
                if (!isWire) return false;
                const rem = Number(item.remainingQuantity ?? item.initialQuantity ?? 0);
                if (rem <= 0) return false;
                if (!showAllGaugesInPicker && targetBitola > 0) {
                    return normalizeB(item.bitola) === targetBStr;
                }
                return true;
            })
            .sort((a, b) => String(a.internalLot).localeCompare(String(b.internalLot), undefined, { numeric: true }));
    }, [editingSlot, stock, shares, showAllGaugesInPicker]);

    const nextPkgNumber = reportData.packages.length + 1;
    const configuredActiveCount = TRELICA_WIRE_POSITIONS.filter(
        p => Boolean(computed.activeStateByPos[p.key]?.activeLot?.lot)
    ).length;

    return (
        <div className="space-y-4 w-full max-w-full overflow-hidden text-left">
            {/* BLOCO 1: OS 5 LOTES NA MÁQUINA (VISUAL LIMPO E DIRETO PARA CELULAR) */}
            <div className="bg-slate-100/90 p-3.5 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-800">
                                🔄 1. Os 5 Lotes na Máquina (Ativo & Reserva)
                            </h3>
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                    configuredActiveCount === 5
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                            >
                                {configuredActiveCount}/5 Lotes Ativos
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Toque para informar os 5 rolos em máquina. Quando um rolo estiver acabando, cadastre o <strong>2º Lote Reserva</strong>.
                        </p>
                    </div>

                    {showManagerControls && (
                        <button
                            type="button"
                            onClick={() => {
                                if (onOpenFullSheet) onOpenFullSheet();
                                else setShowFullSheetModal(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#1F3864] hover:bg-[#2F5597] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer self-start"
                        >
                            <span>📊 Fechamento & Impressão A4</span>
                        </button>
                    )}
                </div>

                {/* MODAL / SELETOR POR TOQUE (APARECE NO TOPO QUANDO O OPERADOR TOCA EM TROCAR LOTE OU + RESERVA) */}
                {editingSlot && (
                    <div className="p-4 rounded-2xl bg-slate-900 text-white border-2 border-amber-400 space-y-3 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300">
                                {editingSlot.slotType === 'ACTIVE'
                                    ? `🟢 1º Lote ATIVO • ${TRELICA_WIRE_POSITIONS.find(p => p.key === editingSlot.positionKey)?.label}`
                                    : `🟡 2º Lote RESERVA • ${TRELICA_WIRE_POSITIONS.find(p => p.key === editingSlot.positionKey)?.label}`}
                                {' '}
                                (Ø {formatBR(shares[editingSlot.positionKey].bitola, 2)} mm)
                            </span>
                            <button
                                type="button"
                                onClick={() => setEditingSlot(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            >
                                ✕ Fechar
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-amber-300 block mb-1">
                                    Número do Lote *
                                </label>
                                <input
                                    type="text"
                                    value={lotInputText}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setLotInputText(val);
                                        setSlotError(null);
                                        const clean = cleanLotCode(val).toLowerCase();
                                        const match = (stock || []).find(
                                            s => cleanLotCode(s.internalLot).toLowerCase() === clean
                                        );
                                        if (match) {
                                            const w = Number(
                                                match.initialQuantity || match.remainingQuantity || match.labelWeight || 0
                                            );
                                            if (w > 0) setLotWeightText(String(w));
                                        }
                                    }}
                                    placeholder="Ex: 7660"
                                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border-2 border-amber-400/70 text-base font-mono font-black text-white text-center outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-emerald-300 block mb-1">
                                    Peso do Rolo (kg) *
                                </label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={lotWeightText}
                                    onChange={e => {
                                        setLotWeightText(e.target.value);
                                        setSlotError(null);
                                    }}
                                    placeholder="Ex: 2075"
                                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border-2 border-emerald-400/70 text-base font-mono font-black text-emerald-300 text-center outline-none"
                                />
                            </div>
                        </div>

                        {slotError && (
                            <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-500 text-rose-200 text-xs font-black">
                                ⚠️ {slotError}
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold uppercase text-slate-300">
                                    👇 Ou toque num lote do estoque abaixo (já preenche o peso):
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowAllGaugesInPicker(!showAllGaugesInPicker)}
                                    className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-white/10 text-cyan-300"
                                >
                                    {showAllGaugesInPicker ? 'Mostrando Todas Bitolas' : 'Ver Todas Bitolas'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1.5 bg-black/40 rounded-xl">
                                {availableStockForEditingSlot.length === 0 ? (
                                    <div className="col-span-full text-center py-3 text-xs text-slate-400">
                                        Nenhum lote desta bitola no estoque. Digite o número acima ou toque em "Ver Todas Bitolas".
                                    </div>
                                ) : (
                                    availableStockForEditingSlot.map(item => {
                                        const cLot = cleanLotCode(item.internalLot);
                                        const wKg = Number(item.initialQuantity || item.remainingQuantity || 0);
                                        const usage = usedOrActiveLotsSet.get(cLot.toLowerCase());
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                disabled={Boolean(usage)}
                                                onClick={() => {
                                                    setLotInputText(cLot);
                                                    if (wKg > 0) setLotWeightText(String(wKg));
                                                    setSlotError(null);
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition active:scale-95 flex flex-col ${
                                                    usage
                                                        ? 'opacity-40 bg-slate-900 border-slate-800 cursor-not-allowed'
                                                        : cleanLotCode(lotInputText) === cLot
                                                        ? 'bg-amber-500/25 border-2 border-amber-400'
                                                        : 'bg-slate-950 border-white/15 hover:border-amber-400 cursor-pointer'
                                                }`}
                                            >
                                                <span className="text-xs font-black font-mono text-white">
                                                    Lote {cLot}
                                                </span>
                                                <span className="text-[10px] font-mono text-emerald-300">
                                                    Ø{item.bitola}mm • {wKg > 0 ? `${wKg.toFixed(0)} kg` : ''}
                                                </span>
                                                {usage && (
                                                    <span className="text-[9px] text-amber-300 font-bold">
                                                        {usage.status} ({usage.posLabel})
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setEditingSlot(null)}
                                className="py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveLotSlot}
                                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg cursor-pointer"
                            >
                                ✓ Salvar Lote & Peso
                            </button>
                        </div>
                    </div>
                )}

                {/* LISTA DE CARTÕES CLAROS PARA AS 5 POSIÇÕES (1 COLUNA NO CELULAR, 2 OU 3 NO DESKTOP) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {TRELICA_WIRE_POSITIONS.map(pos => {
                        const posState = computed.activeStateByPos[pos.key];
                        const activeLot = posState?.activeLot;
                        const reserveLot = posState?.reserveLot;
                        const wireShare = shares[pos.key];
                        const consPer200Pkg = wireShare.unitWeight * 200;
                        const willNeedReserveNextPkg =
                            activeLot && activeLot.kgEntra > 0 && activeLot.sobra < consPer200Pkg;
                        const pctRemaining =
                            activeLot && activeLot.kgEntra > 0
                                ? Math.max(0, Math.min(100, (activeLot.sobra / activeLot.kgEntra) * 100))
                                : 0;

                        return (
                            <div
                                key={pos.key}
                                className="p-3.5 rounded-2xl border-2 border-slate-200 bg-white shadow-sm space-y-2.5"
                            >
                                {/* Título da Posição e Bitola */}
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-slate-900 text-white">
                                            {pos.label}
                                        </span>
                                        <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                            Ø {formatBR(wireShare.bitola, 2)} mm
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-slate-500">
                                        ~{formatBR(consPer200Pkg, 0)} kg/pct
                                    </span>
                                </div>

                                {/* 1º LOTE ATIVO (EM MÁQUINA) */}
                                <div className="p-3 rounded-xl bg-emerald-50/70 border-2 border-emerald-300 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-black uppercase text-emerald-900 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                            <span>🟢 1º Lote Ativo</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openLotPicker(pos.key, 'ACTIVE')}
                                            className="px-3 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-400 text-[11px] font-black uppercase shadow-xs active:scale-95 cursor-pointer"
                                        >
                                            {activeLot ? '🔄 Trocar' : '+ Selecionar'}
                                        </button>
                                    </div>

                                    {activeLot ? (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2 items-end">
                                                <div>
                                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                                        Lote em Máquina
                                                    </span>
                                                    <span className="text-lg font-black font-mono text-slate-900">
                                                        LOTE {activeLot.lot}
                                                    </span>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-emerald-900 block mb-0.5">
                                                        ⚖️ Peso Rolo (kg)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        value={activeLot.kgEntra || ''}
                                                        onChange={e =>
                                                            handleDirectWeightChange(
                                                                pos.key,
                                                                activeLot.lot,
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        placeholder="Ex: 2075"
                                                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-emerald-400 bg-white font-mono font-black text-sm text-slate-900 text-center outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1 text-center bg-white p-2 rounded-xl border border-emerald-200">
                                                <div>
                                                    <span className="text-[8px] font-black uppercase text-slate-400 block">
                                                        Entrou
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-slate-700">
                                                        {formatBR(activeLot.kgEntra, 0)} kg
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black uppercase text-rose-500 block">
                                                        Usado
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-rose-600">
                                                        -{formatBR(activeLot.cons, 0)} kg
                                                    </span>
                                                </div>
                                                <div className="bg-emerald-100/90 rounded-lg py-0.5 px-1">
                                                    <span className="text-[8px] font-black uppercase text-emerald-900 block">
                                                        Sobrou
                                                    </span>
                                                    <span
                                                        className={`text-xs sm:text-sm font-mono font-black ${
                                                            willNeedReserveNextPkg
                                                                ? 'text-amber-700'
                                                                : 'text-emerald-900'
                                                        }`}
                                                    >
                                                        {formatBR(activeLot.sobra, 0)} kg
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="w-full h-2 bg-emerald-200/70 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${
                                                        willNeedReserveNextPkg ? 'bg-amber-500' : 'bg-emerald-600'
                                                    }`}
                                                    style={{ width: `${pctRemaining}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => openLotPicker(pos.key, 'ACTIVE')}
                                            className="w-full py-3 rounded-xl border-2 border-dashed border-emerald-400 text-emerald-800 font-black text-xs uppercase hover:bg-emerald-100/50 transition cursor-pointer"
                                        >
                                            + Informar 1º Lote ({pos.shortLabel})
                                        </button>
                                    )}
                                </div>

                                {/* 2º LOTE RESERVA (PRÓXIMO DA FILA) */}
                                <div
                                    className={`p-2.5 rounded-xl border-2 space-y-1.5 ${
                                        willNeedReserveNextPkg && !reserveLot
                                            ? 'bg-amber-50 border-amber-400'
                                            : 'bg-slate-50 border-slate-200 border-dashed'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase text-amber-900">
                                            🟡 2º Lote Reserva (Próximo)
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openLotPicker(pos.key, 'RESERVE')}
                                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase cursor-pointer active:scale-95"
                                            >
                                                {reserveLot ? '✏️ Trocar' : '+ Reserva'}
                                            </button>
                                            {reserveLot && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveReserveSlot(pos.key)}
                                                    className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-black"
                                                    title="Remover reserva"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {reserveLot ? (
                                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-200">
                                            <span className="text-sm font-black font-mono text-slate-900">
                                                LOTE {reserveLot.lot}
                                            </span>
                                            <span className="text-xs font-mono font-black text-emerald-700">
                                                {formatBR(reserveLot.kgEntra, 0)} kg
                                            </span>
                                        </div>
                                    ) : willNeedReserveNextPkg ? (
                                        <p className="text-[11px] font-bold text-amber-900">
                                            ⚠️ Saldo baixo p/ fechar 200 pçs! Toque em <strong>+ Reserva</strong>.
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400">
                                            Opcional até o 1º lote estar acabando.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BLOCO 2: FECHAR PACOTE DE 200 PEÇAS (VISUAL SIMPLES E DIRETO PARA O OPERADOR NO CELULAR) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-black uppercase text-slate-800">
                                📦 2. Fechar Pacote de 200 Peças
                            </h3>
                            <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                {computed.totals.totalPackages} pacotes • {formatInt(computed.totals.totalPieces)} pçs •{' '}
                                {formatBR(computed.totals.totalWeightKg, 0)} kg
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Basta digitar o <strong>Peso do Pacote (kg)</strong> na balança e confirmar. O sistema desconta sozinho dos 5 lotes!
                        </p>
                    </div>
                </div>

                {/* Card de Lançamento Rápido do Pacote */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0F2437] to-slate-900 text-white space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black font-mono text-sm uppercase">
                            PACOTE P{nextPkgNumber} (PADRÃO 200 PEÇAS)
                        </span>
                        <span className="text-xs font-bold text-cyan-300">
                            Peso estimado: ~{Math.round(reportData.techConfig.pesoFinalUnit * 200)} kg
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-black uppercase text-emerald-300 block mb-1">
                                ⚖️ Peso do Pacote (kg) *
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={newPkgWeight}
                                onChange={e => {
                                    setNewPkgWeight(e.target.value);
                                    setPackageValidationError(null);
                                }}
                                placeholder={`Ex: ${Math.round(reportData.techConfig.pesoFinalUnit * 200)}`}
                                className="w-full px-3 py-3 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200 font-mono font-black text-lg text-center outline-none focus:border-emerald-300"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-300 block mb-1">
                                Qtd. Peças
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={newPkgQty}
                                onChange={e => setNewPkgQty(e.target.value)}
                                className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-mono font-black text-base text-center outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-300 block mb-1">
                                Etiqueta (Opcional)
                            </label>
                            <input
                                type="text"
                                value={newPkgLabelLot}
                                onChange={e => setNewPkgLabelLot(e.target.value)}
                                placeholder="Ex: 88910"
                                className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-mono font-bold text-sm text-center outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleConfirmNewPackage}
                            className="col-span-2 sm:col-span-1 py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>✅</span>
                            <span>Confirmar P{nextPkgNumber}</span>
                        </button>
                    </div>

                    {packageValidationError && (
                        <div className="p-3.5 rounded-xl bg-rose-950 border-2 border-rose-500 text-rose-100 space-y-2.5">
                            <p className="text-xs font-black leading-relaxed text-rose-200">
                                ⚠️ {packageValidationError.message}
                            </p>
                            {packageValidationError.missingPositions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {packageValidationError.missingPositions.map(posKey => {
                                        const posInfo = TRELICA_WIRE_POSITIONS.find(p => p.key === posKey);
                                        const hasActive = Boolean(
                                            computed.activeStateByPos[posKey]?.activeLot?.lot &&
                                                (computed.activeStateByPos[posKey]?.activeLot?.kgEntra || 0) > 0
                                        );
                                        return (
                                            <button
                                                key={posKey}
                                                type="button"
                                                onClick={() =>
                                                    openLotPicker(posKey, hasActive ? 'RESERVE' : 'ACTIVE')
                                                }
                                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                                            >
                                                + Informar {hasActive ? 'Lote Reserva' : 'Lote Ativo'}:{' '}
                                                {posInfo?.shortLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* CARTÕES SIMPLES DOS PACOTES JÁ FECHADOS (SEM PLANILHA COMPLEXA NO CELULAR) */}
                {computed.computedRows.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {computed.computedRows.map(row => (
                            <div
                                key={row.id}
                                className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg bg-[#1F3864] text-white font-black font-mono text-xs uppercase">
                                            {row.packageCode.toUpperCase()}
                                        </span>
                                        <span className="text-xs font-black text-slate-800">
                                            {row.quantity} peças
                                        </span>
                                        {row.finishedLotNumber && (
                                            <span className="text-[11px] font-mono font-bold text-slate-500">
                                                • Etiq: {row.finishedLotNumber}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePackage(row.id)}
                                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-bold"
                                        title="Excluir pacote"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                                    <span className="text-xs font-black uppercase text-emerald-900">
                                        ⚖️ Peso na Balança:
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.1"
                                            value={row.measuredPackageWeight ?? ''}
                                            onChange={e =>
                                                handleUpdateSavedPkgWeight(
                                                    row.id,
                                                    parseFloat(e.target.value) || null
                                                )
                                            }
                                            className="w-24 px-2 py-1 rounded-lg border border-emerald-400 bg-white font-mono font-black text-sm text-center text-slate-900"
                                        />
                                        <span className="text-xs font-bold text-emerald-900">kg</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono">
                                    {TRELICA_WIRE_POSITIONS.map(pos => {
                                        const c = row.positions[pos.key];
                                        return (
                                            <span
                                                key={pos.key}
                                                className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-bold"
                                            >
                                                {pos.shortLabel}: <strong>#{c.lot || '-'}</strong> (-{formatBR(c.kgCons, 0)}kg)
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-xs">
                        Nenhum pacote de 200 peças fechado ainda. Digite o <strong>Peso do Pacote (kg)</strong> acima e toque em <strong>Confirmar P1</strong>!
                    </div>
                )}
            </div>

            {showFullSheetModal && (
                <TrelicaConsumptionReportModal
                    op={op}
                    stock={stock}
                    shiftReports={allShiftReports}
                    onClose={() => {
                        setShowFullSheetModal(false);
                        setReportData(getSavedTrelicaPackagesData(op, stock));
                    }}
                />
            )}
        </div>
    );
};

// ============================================================================
// 2. MODAL OFICIAL DE FECHAMENTO DE ORDEM DE PRODUÇÃO TRELIÇA (A4 + IMPRESSÃO)
// ============================================================================

interface TrelicaConsumptionReportModalProps {
    op: ProductionOrderData;
    stock?: StockItem[];
    shiftReports?: ShiftReport[];
    onClose: () => void;
    onSaved?: (data: TrelicaPackagesReportData) => void;
}

export const TrelicaConsumptionReportModal: React.FC<TrelicaConsumptionReportModalProps> = ({
    op,
    stock = [],
    shiftReports = [],
    onClose,
    onSaved
}) => {
    const [reportData, setReportData] = useState<TrelicaPackagesReportData>(() =>
        getSavedTrelicaPackagesData(op, stock)
    );
    const [fetchedShifts, setFetchedShifts] = useState<ShiftReport[]>([]);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    useEffect(() => {
        let cancelled = false;
        const loadShifts = async () => {
            try {
                const { data } = await supabase
                    .from('shift_reports')
                    .select('*')
                    .order('created_at', { ascending: true });
                if (!cancelled && Array.isArray(data)) {
                    setFetchedShifts(data as any[]);
                }
            } catch (e) {}
        };
        loadShifts();
        return () => {
            cancelled = true;
        };
    }, [op?.id]);

    const persistReport = async (next: TrelicaPackagesReportData) => {
        setSaveStatus('saving');
        setReportData(next);
        await saveTrelicaPackagesData(op, next);
        setSaveStatus('saved');
        if (onSaved) onSaved(next);
    };

    const computed = useMemo(
        () => computeTrelicaPackagesAndLots(reportData.packages, reportData.techConfig, reportData.queues),
        [reportData]
    );

    const shares = useMemo(() => getWireShareByPosition(reportData.techConfig), [reportData.techConfig]);

    // Cálculo de rowSpan para mesclar verticalmente LOTE e PESO LOTE de cada uma das 5 posições quando pacotes consecutivos usam o mesmo rolo
    const rowSpansByPos = useMemo(() => {
        const rows = computed.computedRows;
        const result: Record<TrelicaWirePositionKey, number[]> = {
            superior: new Array(rows.length).fill(1),
            senoide_esq: new Array(rows.length).fill(1),
            senoide_dir: new Array(rows.length).fill(1),
            inferior_esq: new Array(rows.length).fill(1),
            inferior_dir: new Array(rows.length).fill(1)
        };

        TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
            const spans = result[key];
            for (let i = 0; i < rows.length; i++) {
                if (spans[i] === 0) continue;
                const cellI = rows[i].positions[key];
                const lotI = cleanLotCode(cellI.lot);
                const hasSplitI = cellI.splits.length > 1;
                if (!lotI || hasSplitI) {
                    spans[i] = 1;
                    continue;
                }
                let count = 1;
                for (let j = i + 1; j < rows.length; j++) {
                    const cellJ = rows[j].positions[key];
                    const lotJ = cleanLotCode(cellJ.lot);
                    const hasSplitJ = cellJ.splits.length > 1;
                    if (lotJ === lotI && !hasSplitJ) {
                        count++;
                        spans[j] = 0;
                    } else {
                        break;
                    }
                }
                spans[i] = count;
            }
        });

        return result;
    }, [computed.computedRows]);

    const allShiftReports = useMemo(() => {
        const map = new Map<string, ShiftReport>();
        (shiftReports || []).forEach(s => {
            if (s?.id) map.set(s.id, s);
        });
        (fetchedShifts || []).forEach(s => {
            if (s?.id) map.set(s.id, s);
        });
        return Array.from(map.values());
    }, [shiftReports, fetchedShifts]);

    const dailyMarkings = useMemo(
        () =>
            extractDailyMarkingsForTrelicaOp(
                op,
                allShiftReports,
                computed.totals.avgPieceWeightKg || reportData.techConfig.pesoFinalUnit
            ),
        [op, allShiftReports, computed.totals.avgPieceWeightKg, reportData.techConfig.pesoFinalUnit]
    );

    const totalDailyQty = dailyMarkings.reduce((acc, d) => acc + d.quantity, 0);
    const totalDailyWeight = dailyMarkings.reduce((acc, d) => acc + d.weightKg, 0);
    const displayPackageQty = useMemo(() => {
        if (computed.computedRows.length > 0) {
            return Number(computed.computedRows[0].quantity) || 200;
        }
        return Number(reportData.techConfig.defaultQtyPerPackage) || 200;
    }, [computed.computedRows, reportData.techConfig.defaultQtyPerPackage]);

    const handleAddRowInSheet = async () => {
        const lotsByPosition: Partial<Record<TrelicaWirePositionKey, { lot: string; weight: number }>> = {};
        TRELICA_WIRE_POSITIONS.forEach(({ key }) => {
            const act = computed.activeStateByPos[key]?.activeLot;
            if (act) {
                lotsByPosition[key] = { lot: act.lot, weight: act.kgEntra };
            }
        });

        const nextIdx = reportData.packages.length + 1;
        const newPkg: TrelicaPackageRow = {
            id: `tpkg-${Date.now()}`,
            packageCode: `p${nextIdx}`,
            finishedLotNumber: '',
            quantity: displayPackageQty,
            measuredPackageWeight: Math.round(reportData.techConfig.pesoFinalUnit * displayPackageQty),
            lotsByPosition,
            confirmed: true,
            recordedAt: new Date().toISOString()
        };

        await persistReport({
            ...reportData,
            packages: [...reportData.packages, newPkg]
        });
    };

    const handleUpdatePackageField = async (
        pkgId: string,
        field: 'finishedLotNumber' | 'quantity' | 'measuredPackageWeight',
        rawVal: string
    ) => {
        const nextPackages = reportData.packages.map(pkg => {
            if (pkg.id !== pkgId) return pkg;
            if (field === 'finishedLotNumber') {
                return { ...pkg, finishedLotNumber: rawVal };
            }
            if (field === 'quantity') {
                return { ...pkg, quantity: Math.max(1, Math.round(parseNum(rawVal, 200))) };
            }
            return { ...pkg, measuredPackageWeight: parseNum(rawVal, 0) };
        });
        await persistReport({
            ...reportData,
            packages: nextPackages
        });
    };

    const handleDeleteRow = async (pkgId: string) => {
        const nextPackages = reportData.packages
            .filter(p => p.id !== pkgId)
            .map((p, idx) => ({ ...p, packageCode: `p${idx + 1}` }));
        await persistReport({
            ...reportData,
            packages: nextPackages
        });
    };

    const emissionDateStr = new Date().toLocaleDateString('pt-BR');
    const weekDayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();

    return (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 overflow-y-auto">
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 6mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #trelica-closing-sheet-print,
                    #trelica-closing-sheet-print * {
                        visibility: visible !important;
                    }
                    #trelica-closing-sheet-print {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        background: #ffffff !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-[1440px] max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
                {/* BARRA DE AÇÕES SUPERIOR (NÃO IMPRIME) */}
                <div className="no-print bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                            {saveStatus === 'saving' ? '⏳ Salvando...' : '✓ Salvo Automaticamente'}
                        </span>
                        <span className="text-xs text-slate-300 font-bold">
                            Pelo peso do pacote ({displayPackageQty} pçs), o sistema rateia automaticamente o consumo entre os 5 fios da treliça.
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAddRowInSheet}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow"
                        >
                            + Pacote ({displayPackageQty} Pçs)
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase shadow flex items-center gap-1.5"
                        >
                            <span>🖨️ Imprimir A4</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                        >
                            ✕ Fechar
                        </button>
                    </div>
                </div>

                {/* CORPO DA PLANILHA OFICIAL GRUPO ITA AÇOS */}
                <div className="p-3 md:p-5 overflow-y-auto bg-slate-200 flex-1">
                    <div
                        id="trelica-closing-sheet-print"
                        className="bg-white text-slate-900 rounded-xl shadow-xl p-4 md:p-5 mx-auto max-w-[1380px] border border-slate-300"
                    >
                        {/* CABEÇALHO OFICIAL GRUPO ITA AÇOS */}
                        <div className="border-2 border-[#0c2340] rounded-lg overflow-hidden mb-3">
                            <div className="grid grid-cols-12 bg-[#0c2340] text-white items-center">
                                <div className="col-span-3 bg-white p-2.5 flex items-center justify-center border-r-2 border-[#0c2340]">
                                    <div className="text-center leading-tight">
                                        <div className="text-[10px] font-black tracking-widest text-orange-600 uppercase">
                                            GRUPO
                                        </div>
                                        <div className="text-xl font-black tracking-tight text-[#0c2340]">
                                            ITA AÇOS
                                        </div>
                                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                                            ITAPETININGA • SOROCABA • ITAPEVA • TATUÍ
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-6 px-4 py-2">
                                    <div className="text-base md:text-lg font-black uppercase tracking-wide text-white">
                                        FECHAMENTO ORDEM DE PRODUÇÃO TRELIÇA
                                    </div>
                                    <div className="text-xs font-bold text-cyan-200 uppercase">
                                        SETOR LAMINAÇÃO – {op.machine || 'TRELIÇA 1'} • CONTROLE DE LOTES CA-60 & PACOTES ({displayPackageQty} PEÇAS)
                                    </div>
                                </div>
                                <div className="col-span-3 px-3 py-2 border-l border-slate-600 text-right">
                                    <div className="text-[9px] uppercase text-slate-300 font-bold">Data de Emissão</div>
                                    <div className="text-sm font-black text-white">{emissionDateStr}</div>
                                    <div className="text-[9px] text-cyan-200 font-bold">{weekDayStr}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 bg-slate-50 text-slate-900 border-t border-[#0c2340] divide-x divide-slate-300 text-xs">
                                <div className="col-span-2 p-2">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                        Ordem de Produção
                                    </span>
                                    <span className="text-sm font-black text-[#0c2340]">#{op.orderNumber}</span>
                                </div>
                                <div className="col-span-5 p-2">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                        Descrição do Produto / Modelo
                                    </span>
                                    <span className="text-sm font-black text-[#0c2340]">
                                        {reportData.techConfig.modelName} ({reportData.techConfig.tamanhoMeters} METROS)
                                    </span>
                                </div>
                                <div className="col-span-3 p-2">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                        Bitolas (Sup / Sen / Inf)
                                    </span>
                                    <span className="text-sm font-black text-emerald-700">
                                        ø{formatBR(reportData.techConfig.bitolaSuperior, 1)} / ø{formatBR(reportData.techConfig.bitolaSenoide, 1)} / ø{formatBR(reportData.techConfig.bitolaInferior, 1)} mm
                                    </span>
                                </div>
                                <div className="col-span-2 p-2 text-right">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                        Peso Médio Real / Peça
                                    </span>
                                    <span className="text-sm font-black text-[#0c2340]">
                                        {formatBR(computed.totals.avgPieceWeightKg, 3)} kg/pç
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* BLOCO DUPLO: DESCRIÇÃO TÉCNICA DOS 5 FIOS & RESUMO DA ORDEM */}
                        <div className="grid grid-cols-12 gap-3 mb-3">
                            {/* DESCRIÇÃO TÉCNICA (POR 1 PEÇA DE TRELIÇA) */}
                            <div className="col-span-7 border border-[#0c2340] rounded overflow-hidden">
                                <div className="bg-[#0c2340] text-white text-[11px] font-black uppercase px-2.5 py-1 text-center">
                                    DESCRIÇÃO TÉCNICA (POR 1 PEÇA DE TRELIÇA DE {reportData.techConfig.tamanhoMeters}M)
                                </div>
                                <table className="w-full text-[11px] border-collapse">
                                    <thead>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                                            <th className="p-1 text-left">POSIÇÃO DO ARAME</th>
                                            <th className="p-1 text-center">BITOLA (MM)</th>
                                            <th className="p-1 text-center">LINEAR (M)</th>
                                            <th className="p-1 text-right">PESO/PEÇA (KG)</th>
                                            <th className="p-1 text-right">RATEIO (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-slate-900">
                                        {TRELICA_WIRE_POSITIONS.map(pos => {
                                            const s = shares[pos.key];
                                            return (
                                                <tr key={pos.key}>
                                                    <td className="p-1 font-bold">{pos.shortLabel}</td>
                                                    <td className="p-1 text-center font-bold">
                                                        {formatBR(s.bitola, 2)} mm
                                                    </td>
                                                    <td className="p-1 text-center">{formatBR(s.linearMeters, 2)} m</td>
                                                    <td className="p-1 text-right font-bold">
                                                        {formatBR(s.unitWeight, 3)} kg
                                                    </td>
                                                    <td className="p-1 text-right font-bold text-slate-700">
                                                        {(s.ratio * 100).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-slate-200 font-black text-slate-900 border-t border-slate-400">
                                            <td className="p-1">TOTAL (5 FIOS)</td>
                                            <td className="p-1 text-center">—</td>
                                            <td className="p-1 text-center">
                                                {formatBR(
                                                    Object.values(shares).reduce((a, b) => a + b.linearMeters, 0),
                                                    2
                                                )}{' '}
                                                m
                                            </td>
                                            <td className="p-1 text-right">
                                                {formatBR(reportData.techConfig.pesoFinalUnit, 3)} kg
                                            </td>
                                            <td className="p-1 text-right">100,0%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* RESUMO DA ORDEM */}
                            <div className="col-span-5 border border-[#0c2340] rounded overflow-hidden flex flex-col justify-between">
                                <div className="bg-[#0c2340] text-white text-[11px] font-black uppercase px-2.5 py-1 text-center">
                                    RESUMO DA ORDEM DE PRODUÇÃO
                                </div>
                                <table className="w-full text-[11px] border-collapse flex-1">
                                    <thead>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                                            <th className="p-1 text-center">PACOTES</th>
                                            <th className="p-1 text-center">PÇS / PCT</th>
                                            <th className="p-1 text-center">TOTAL PEÇAS</th>
                                            <th className="p-1 text-right">PESO TOTAL (KG)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-slate-900">
                                        <tr>
                                            <td className="p-1.5 text-center font-black">
                                                {computed.totals.totalPackages}
                                            </td>
                                            <td className="p-1.5 text-center font-bold">{displayPackageQty}</td>
                                            <td className="p-1.5 text-center font-black">
                                                {formatInt(computed.totals.totalPieces)}
                                            </td>
                                            <td className="p-1.5 text-right font-black">
                                                {formatBR(computed.totals.totalWeightKg, 2)}
                                            </td>
                                        </tr>
                                        <tr className="bg-emerald-50 font-bold text-emerald-900">
                                            <td colSpan={2} className="p-1.5 text-left">
                                                Produzido (Marcações Diárias):
                                            </td>
                                            <td className="p-1.5 text-center font-black">
                                                {formatInt(totalDailyQty)} pçs
                                            </td>
                                            <td className="p-1.5 text-right font-black">
                                                {formatBR(totalDailyWeight, 2)}
                                            </td>
                                        </tr>
                                        <tr className="bg-amber-50 font-bold text-amber-900">
                                            <td colSpan={2} className="p-1.5 text-left">
                                                Saldo em Máquina (Pendente Pacote):
                                            </td>
                                            <td colSpan={2} className="p-1.5 text-center font-black">
                                                {formatInt(Math.max(0, totalDailyQty - computed.totals.totalPieces))}{' '}
                                                treliças em máquina
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* TABELA PRINCIPAL: CONSUMÍVEIS POR LOTE (PACOTES DE 200 TRELIÇAS • 5 FIOS) */}
                        <div className="border border-[#0c2340] rounded overflow-hidden mb-3">
                            <div className="bg-[#0c2340] text-white text-[11px] font-black uppercase px-2.5 py-1 text-center">
                                CONSUMÍVEIS POR LOTE (PACOTES DE {displayPackageQty} TRELIÇAS • CONVERSÃO AUTOMÁTICA PELO PESO DO PACOTE)
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px] border-collapse">
                                    <thead>
                                        <tr className="bg-[#1b3a63] text-white font-black uppercase">
                                            <th colSpan={5} className="p-1 border border-slate-400 text-center bg-slate-100 text-slate-900">
                                                PACOTE DE {displayPackageQty} TRELIÇAS & PESO REAL
                                            </th>
                                            {TRELICA_WIRE_POSITIONS.map(pos => (
                                                <th
                                                    key={pos.key}
                                                    colSpan={4}
                                                    className="p-1 border border-slate-400 text-center"
                                                >
                                                    {pos.shortLabel} (ø{formatBR(shares[pos.key].bitola, 1)}mm)
                                                </th>
                                            ))}
                                            <th className="p-1 border border-slate-400 no-print"></th>
                                        </tr>
                                        <tr className="bg-slate-200 text-slate-900 font-black uppercase text-[9px]">
                                            <th className="p-1 border border-slate-300">LOTE ETIQ.</th>
                                            <th className="p-1 border border-slate-300">PCT</th>
                                            <th className="p-1 border border-slate-300">QUNT.</th>
                                            <th className="p-1 border border-slate-300 bg-emerald-100">PESO PCT</th>
                                            <th className="p-1 border border-slate-300">KG/PEÇA</th>
                                            {TRELICA_WIRE_POSITIONS.map(pos => (
                                                <React.Fragment key={`${pos.key}-sub`}>
                                                    <th className="p-1 border border-slate-300 bg-amber-100">LOTE</th>
                                                    <th className="p-1 border border-slate-300 bg-amber-100">PESO LOTE</th>
                                                    <th className="p-1 border border-slate-300">SALDO</th>
                                                    <th className="p-1 border border-slate-300">KG CONS.</th>
                                                </React.Fragment>
                                            ))}
                                            <th className="p-1 border border-slate-300 no-print"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-900">
                                        {computed.computedRows.map((row, rIdx) => (
                                            <tr key={row.id} className="border-b border-slate-300">
                                                <td className="p-1 border border-slate-300 text-center">
                                                    <input
                                                        type="text"
                                                        value={row.finishedLotNumber}
                                                        onChange={e =>
                                                            handleUpdatePackageField(
                                                                row.id,
                                                                'finishedLotNumber',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Etiqueta"
                                                        className="w-14 text-center font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-300 text-center font-black">
                                                    {row.packageCode}
                                                </td>
                                                <td className="p-1 border border-slate-300 text-center">
                                                    <input
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={e =>
                                                            handleUpdatePackageField(row.id, 'quantity', e.target.value)
                                                        }
                                                        className="w-10 text-center font-black text-slate-900 bg-transparent"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-300 text-center bg-emerald-50 font-black">
                                                    <input
                                                        type="number"
                                                        value={Math.round(row.packageWeightKg)}
                                                        onChange={e =>
                                                            handleUpdatePackageField(
                                                                row.id,
                                                                'measuredPackageWeight',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-12 text-center font-black text-emerald-900 bg-transparent"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-300 text-center font-bold">
                                                    {formatBR(row.unitPieceWeight, 3)}
                                                </td>

                                                {TRELICA_WIRE_POSITIONS.map(pos => {
                                                    const cell = row.positions[pos.key];
                                                    const span = rowSpansByPos[pos.key][rIdx];
                                                    const hasSplit = cell.splits.length > 1;
                                                    return (
                                                        <React.Fragment key={`${row.id}-${pos.key}`}>
                                                            {span > 0 && (
                                                                <>
                                                                    <td
                                                                        rowSpan={span}
                                                                        className="p-1 border border-slate-300 bg-amber-100/80 text-center align-middle font-black text-slate-900"
                                                                    >
                                                                        <div>{cell.lot || '-'}</div>
                                                                        {hasSplit && (
                                                                            <div className="text-[8px] font-bold text-amber-900 leading-tight mt-0.5">
                                                                                {cell.splits
                                                                                    .map(
                                                                                        s =>
                                                                                            `${s.lot}(${Math.round(
                                                                                                s.consumedKg
                                                                                            )}kg)`
                                                                                    )
                                                                                    .join(' + ')}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td
                                                                        rowSpan={span}
                                                                        className="p-1 border border-slate-300 bg-amber-100/80 text-center align-middle font-black text-slate-900"
                                                                    >
                                                                        {cell.lotInitialWeight > 0
                                                                            ? formatInt(cell.lotInitialWeight)
                                                                            : '-'}
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="p-1 border border-slate-300 text-right font-semibold">
                                                                {formatBR(cell.balanceAfterKg, 1)}
                                                            </td>
                                                            <td className="p-1 border border-slate-300 text-right font-bold">
                                                                {formatBR(cell.kgCons, 1)}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                <td className="p-1 border border-slate-300 text-center no-print">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRow(row.id)}
                                                        className="text-rose-600 hover:text-rose-800 font-black"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-[#1b3a63] text-white font-black">
                                            <td colSpan={2} className="p-1 border border-slate-400 text-center">
                                                TOTAL
                                            </td>
                                            <td className="p-1 border border-slate-400 text-center">
                                                {formatInt(computed.totals.totalPieces)}
                                            </td>
                                            <td className="p-1 border border-slate-400 text-center">
                                                {formatBR(computed.totals.totalWeightKg, 0)} kg
                                            </td>
                                            <td className="p-1 border border-slate-400 text-center">
                                                {formatBR(computed.totals.avgPieceWeightKg, 3)}
                                            </td>
                                            {TRELICA_WIRE_POSITIONS.map(pos => (
                                                <React.Fragment key={`foot-${pos.key}`}>
                                                    <td colSpan={3} className="p-1 border border-slate-400"></td>
                                                    <td className="p-1 border border-slate-400 text-right">
                                                        {formatBR(computed.totals.totalConsByPos[pos.key], 1)}
                                                    </td>
                                                </React.Fragment>
                                            ))}
                                            <td className="p-1 border border-slate-400 no-print"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* TABELAS INFERIORES: LOTES CONSUMIDOS (CONVERSÃO E SOBRA) & ATUALIZAÇÃO DA PRODUÇÃO */}
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-7 border border-[#0c2340] rounded overflow-hidden">
                                <div className="bg-[#0c2340] text-white text-[11px] font-black uppercase px-2.5 py-1 text-center">
                                    LOTES CONSUMIDOS NAS 5 POSIÇÕES (CONVERSÃO E SOBRA)
                                </div>
                                <table className="w-full text-[11px] border-collapse text-slate-900">
                                    <thead>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                                            <th className="p-1 text-left">POSIÇÃO</th>
                                            <th className="p-1 text-center">BITOLA</th>
                                            <th className="p-1 text-center">LOTE</th>
                                            <th className="p-1 text-right">KG. ENTRA.</th>
                                            <th className="p-1 text-right">CONS.</th>
                                            <th className="p-1 text-right">SOBRA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {computed.consumedLots.map(row => (
                                            <tr key={row.id}>
                                                <td className="p-1 font-bold">{row.positionLabel}</td>
                                                <td className="p-1 text-center">ø{formatBR(row.bitola, 2)}</td>
                                                <td className="p-1 text-center font-black">{row.lot}</td>
                                                <td className="p-1 text-right font-semibold">
                                                    {formatInt(row.kgEntra)}
                                                </td>
                                                <td className="p-1 text-right font-bold text-rose-700">
                                                    {formatInt(row.cons)}
                                                </td>
                                                <td className="p-1 text-right font-black text-emerald-700">
                                                    {formatInt(row.sobra)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-t border-slate-400">
                                            <td colSpan={3} className="p-1 text-center">
                                                Total
                                            </td>
                                            <td className="p-1 text-right">{formatInt(computed.totals.totalEntra)}</td>
                                            <td className="p-1 text-right text-rose-800">
                                                {formatInt(computed.totals.totalCons)}
                                            </td>
                                            <td className="p-1 text-right text-emerald-800">
                                                {formatInt(computed.totals.totalSobra)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="col-span-5 border border-[#0c2340] rounded overflow-hidden">
                                <div className="bg-[#0c2340] text-white text-[11px] font-black uppercase px-2.5 py-1 text-center">
                                    ATUALIZAÇÃO DA PRODUÇÃO (MARCAÇÕES DIÁRIAS)
                                </div>
                                <table className="w-full text-[11px] border-collapse text-slate-900">
                                    <thead>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                                            <th className="p-1 text-center">QNT.</th>
                                            <th className="p-1 text-right">PESO (KG)</th>
                                            <th className="p-1 text-right">MÉDIA (KG/PÇ)</th>
                                            <th className="p-1 text-center">DATA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {dailyMarkings.map(d => (
                                            <tr key={d.dateKey}>
                                                <td className="p-1 text-center font-black">{d.quantity}</td>
                                                <td className="p-1 text-right font-semibold">
                                                    {formatBR(d.weightKg, 2)}
                                                </td>
                                                <td className="p-1 text-right">
                                                    {formatBR(d.avgWeightPerPiece, 3)}
                                                </td>
                                                <td className="p-1 text-center font-bold">{d.displayDate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-200 text-slate-900 font-black border-t border-slate-400">
                                            <td className="p-1 text-center">{formatInt(totalDailyQty)}</td>
                                            <td className="p-1 text-right">{formatBR(totalDailyWeight, 2)}</td>
                                            <td className="p-1 text-right">
                                                {formatBR(
                                                    computed.totals.avgPieceWeightKg ||
                                                        reportData.techConfig.pesoFinalUnit,
                                                    3
                                                )}
                                            </td>
                                            <td className="p-1 text-center uppercase text-[10px]">TOTAL / MÉDIA</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default TrelicaConsumptionReportModal;

