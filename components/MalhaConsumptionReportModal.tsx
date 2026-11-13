import React, { useState, useMemo, useEffect } from 'react';
import type { ProductionOrderData, StockItem, ShiftReport } from '../types';
import { DefaultMalhaGauges } from '../types';
import { updateItem } from '../services/supabaseService';
import { supabase } from '../supabaseClient';

export interface MalhaLotSupplyItem {
    id: string;
    lot: string; // Ex: 7505, 7594
    weight: number; // Peso do rolo/lote em kg (Ex: 2075)
    addedAt?: string;
}

export interface MalhaPackageLotSplit {
    lot: string;
    consumedKg: number;
    lotInitialKg: number;
    balanceAfterKg: number;
    exhausted: boolean;
}

export interface MalhaPackageRow {
    id: string;
    packageCode: string; // p1, p2, p3...
    finishedLotNumber: string; // Ex: 88846, 88849...
    quantity: number; // Padrão: 50 malhas
    measuredPackageWeight?: number | null; // Peso real do pacote na balança (kg)
    longLot: string; // Ex: 7594
    longLotWeight: number; // Ex: 2075
    transLot: string; // Ex: 7804
    transLotWeight: number; // Ex: 2071
    confirmed?: boolean;
    recordedAt?: string;
    operator?: string;
}

export interface MalhaTechnicalConfig {
    bitola: number; // Ex: 4.9 ou 5.0
    longQnt: number; // Ex: 25 fios
    longTam: number; // Ex: 6.00 m
    transQnt: number; // Ex: 60 fios
    transTam: number; // Ex: 2.45 m
    defaultQtyPerPackage: number; // Padrão: 50 malhas
}

export interface MalhaPackagesReportData {
    version?: number;
    techConfig: MalhaTechnicalConfig;
    longLotsQueue: MalhaLotSupplyItem[];
    transLotsQueue: MalhaLotSupplyItem[];
    packages: MalhaPackageRow[];
    updatedAt?: string;
}

export const inferDefaultMalhaTechConfig = (op?: ProductionOrderData | null): MalhaTechnicalConfig => {
    const desc = String(op?.malhaModel || (op as any)?.malha_model || op?.productDescription || '').toUpperCase();
    const rawBitola = String(op?.targetBitola || (op as any)?.target_bitola || '').replace(/mm/gi, '').replace(',', '.').trim();

    let bitolaFromDesc = 0;
    const mmMatch = desc.match(/(\d+(?:[.,]\d+)?)\s*MM/i);
    if (mmMatch && mmMatch[1]) {
        bitolaFromDesc = parseFloat(mmMatch[1].replace(',', '.'));
    }
    if (!bitolaFromDesc || isNaN(bitolaFromDesc)) {
        const matched = DefaultMalhaGauges.find(g =>
            (g.productCode && desc.includes(g.productCode.toUpperCase())) ||
            (g.description && desc.includes(g.description.toUpperCase()))
        );
        if (matched && matched.gauge) {
            bitolaFromDesc = parseFloat(matched.gauge.replace(/mm/gi, '').replace(',', '.').trim()) || 0;
        }
    }

    let parsedTarget = parseFloat(rawBitola);
    if (parsedTarget === 6 && bitolaFromDesc > 0 && bitolaFromDesc !== 6) {
        parsedTarget = bitolaFromDesc;
    }

    let bitola = bitolaFromDesc > 0 ? bitolaFromDesc : parsedTarget;
    if (isNaN(bitola) || bitola <= 0 || bitola >= 6) {
        if (desc.includes('4,2') || desc.includes('4.2')) {
            bitola = 4.2;
        } else if (desc.includes('3,4') || desc.includes('3.4')) {
            bitola = 3.4;
        } else {
            bitola = 5.0;
        }
    }

    const is15x15 = desc.includes('15X15');
    const longTam = 6.0;
    const transTam = 2.45;
    const longQnt = is15x15 ? 17 : 25;
    const transQnt = is15x15 ? 40 : 60;

    return {
        bitola,
        longQnt,
        longTam,
        transQnt,
        transTam,
        defaultQtyPerPackage: 50
    };
};

const cleanLotCode = (val: any): string => String(val ?? '').replace(/^LOTE\s+/i, '').trim();

export const getSavedMalhaPackagesData = (op?: ProductionOrderData | null, stock?: StockItem[]): MalhaPackagesReportData => {
    const defaultTech = inferDefaultMalhaTechConfig(op);
    if (!op) {
        return { version: 2, techConfig: defaultTech, longLotsQueue: [], transLotsQueue: [], packages: [] };
    }

    const stockWeightMap = new Map<string, number>();
    (stock || []).forEach(item => {
        if (item && item.internalLot) {
            const c = cleanLotCode(item.internalLot).toLowerCase();
            const w = Number(item.initialQuantity || item.remainingQuantity || 0);
            if (c && w > 0) stockWeightMap.set(c, w);
        }
    });

    const summary: any = op.summary || {};
    const saved = summary.malhaPackagesData || summary.malha_packages_data;
    const activeLots = summary.malhaActiveLots || summary.malha_active_lots || {};

    let localSaved: any = null;
    try {
        const rawLocal = localStorage.getItem(`malha_packages_data_${op.id || op.orderNumber}`);
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

    const buildDefaultQueuesFromActive = (existingLong: MalhaLotSupplyItem[], existingTrans: MalhaLotSupplyItem[]) => {
        const lQueue = [...existingLong];
        const tQueue = [...existingTrans];

        const activeLong = cleanLotCode(activeLots.longitudinal);
        const activeTrans = cleanLotCode(activeLots.transversal);

        if (activeLong && !lQueue.some(item => cleanLotCode(item.lot) === activeLong)) {
            lQueue.push({
                id: `lq-${Date.now()}-1`,
                lot: activeLong,
                weight: stockWeightMap.get(activeLong.toLowerCase()) || 0,
                addedAt: new Date().toISOString()
            });
        }
        if (activeTrans && !tQueue.some(item => cleanLotCode(item.lot) === activeTrans)) {
            tQueue.push({
                id: `tq-${Date.now()}-1`,
                lot: activeTrans,
                weight: stockWeightMap.get(activeTrans.toLowerCase()) || 0,
                addedAt: new Date().toISOString()
            });
        }

        lQueue.forEach(item => {
            if (!item.weight && item.lot) {
                const found = stockWeightMap.get(cleanLotCode(item.lot).toLowerCase());
                if (found) item.weight = found;
            }
        });
        tQueue.forEach(item => {
            if (!item.weight && item.lot) {
                const found = stockWeightMap.get(cleanLotCode(item.lot).toLowerCase());
                if (found) item.weight = found;
            }
        });

        return { lQueue, tQueue };
    };

    if (source) {
        const rawTech = source.techConfig || source.tech_config || {};
        let savedBitola = Number(rawTech.bitola ?? defaultTech.bitola) || defaultTech.bitola;
        if (savedBitola === 6 && defaultTech.bitola !== 6) {
            savedBitola = defaultTech.bitola;
        }

        const techConfig: MalhaTechnicalConfig = {
            bitola: savedBitola,
            longQnt: Number(rawTech.longQnt ?? rawTech.long_qnt ?? defaultTech.longQnt) || defaultTech.longQnt,
            longTam: Number(rawTech.longTam ?? rawTech.long_tam ?? defaultTech.longTam) || defaultTech.longTam,
            transQnt: Number(rawTech.transQnt ?? rawTech.trans_qnt ?? defaultTech.transQnt) || defaultTech.transQnt,
            transTam: Number(rawTech.transTam ?? rawTech.trans_tam ?? defaultTech.transTam) || defaultTech.transTam,
            defaultQtyPerPackage: Number(rawTech.defaultQtyPerPackage ?? rawTech.default_qty_per_package ?? 50) || 50
        };

        const rawPackages: any[] = Array.isArray(source.packages) ? source.packages : [];
        const isV2 = Number(source.version || 0) >= 2;

        const validPackages = isV2
            ? rawPackages
            : rawPackages.filter((p: any) =>
                  Boolean(
                      p.confirmed ||
                      p.finishedLotNumber ||
                      Number(p.measuredPackageWeight) > 0 ||
                      Number(p.longLotWeight) > 0 ||
                      Number(p.transLotWeight) > 0
                  )
              );

        const packages: MalhaPackageRow[] = validPackages.map((p: any, idx: number) => ({
            id: p.id || `mpkg-${idx + 1}`,
            packageCode: `p${idx + 1}`,
            finishedLotNumber: String(p.finishedLotNumber ?? p.finished_lot_number ?? ''),
            quantity: Number(p.quantity ?? 50) || 50,
            measuredPackageWeight: p.measuredPackageWeight ?? p.measured_package_weight ?? null,
            longLot: cleanLotCode(p.longLot ?? p.long_lot ?? ''),
            longLotWeight: Number(p.longLotWeight ?? p.long_lot_weight ?? 0) || 0,
            transLot: cleanLotCode(p.transLot ?? p.trans_lot ?? ''),
            transLotWeight: Number(p.transLotWeight ?? p.trans_lot_weight ?? 0) || 0,
            confirmed: true,
            recordedAt: p.recordedAt || p.recorded_at,
            operator: p.operator
        }));

        let rawLongQ: MalhaLotSupplyItem[] = Array.isArray(source.longLotsQueue)
            ? source.longLotsQueue.map((item: any, i: number) => ({
                  id: item.id || `lq-${i}`,
                  lot: cleanLotCode(item.lot),
                  weight: Number(item.weight) || 0,
                  addedAt: item.addedAt
              })).filter((x: MalhaLotSupplyItem) => Boolean(x.lot))
            : [];

        let rawTransQ: MalhaLotSupplyItem[] = Array.isArray(source.transLotsQueue)
            ? source.transLotsQueue.map((item: any, i: number) => ({
                  id: item.id || `tq-${i}`,
                  lot: cleanLotCode(item.lot),
                  weight: Number(item.weight) || 0,
                  addedAt: item.addedAt
              })).filter((x: MalhaLotSupplyItem) => Boolean(x.lot))
            : [];

        packages.forEach((p, idx) => {
            if (p.longLot && !rawLongQ.some(q => q.lot === p.longLot)) {
                rawLongQ.push({ id: `lq-pkg-${idx}`, lot: p.longLot, weight: p.longLotWeight || 0 });
            } else if (p.longLot && p.longLotWeight > 0) {
                const found = rawLongQ.find(q => q.lot === p.longLot);
                if (found && !found.weight) found.weight = p.longLotWeight;
            }
            if (p.transLot && !rawTransQ.some(q => q.lot === p.transLot)) {
                rawTransQ.push({ id: `tq-pkg-${idx}`, lot: p.transLot, weight: p.transLotWeight || 0 });
            } else if (p.transLot && p.transLotWeight > 0) {
                const found = rawTransQ.find(q => q.lot === p.transLot);
                if (found && !found.weight) found.weight = p.transLotWeight;
            }
        });

        const { lQueue, tQueue } = buildDefaultQueuesFromActive(rawLongQ, rawTransQ);

        return {
            version: 2,
            techConfig,
            longLotsQueue: lQueue,
            transLotsQueue: tQueue,
            packages,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    const { lQueue, tQueue } = buildDefaultQueuesFromActive([], []);

    return {
        version: 2,
        techConfig: defaultTech,
        longLotsQueue: lQueue,
        transLotsQueue: tQueue,
        packages: []
    };
};

export const saveMalhaPackagesData = async (op: ProductionOrderData, data: MalhaPackagesReportData) => {
    const payload: MalhaPackagesReportData = {
        ...data,
        version: 2,
        updatedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(`malha_packages_data_${op.id || op.orderNumber}`, JSON.stringify(payload));
    } catch (e) {}

    if (op.id) {
        try {
            const currentSummary = (op.summary && typeof op.summary === 'object') ? op.summary : {};
            const updatedSummary = {
                ...currentSummary,
                malhaPackagesData: payload
            };
            op.summary = updatedSummary;
            await updateItem('production_orders', op.id, {
                summary: updatedSummary
            } as any);
        } catch (err) {
            console.warn('Erro ao salvar pacotes de malha no Supabase:', err);
        }
    }
    return payload;
};

// Constante física oficial do aço CA-60 da planilha: Massa Linear (kg/m) = Bitola(mm)^2 * 0.006162
export const STEEL_LINEAR_MASS_CONSTANT = 0.006162;

export const calculateMalhaPhysics = (techConfig: MalhaTechnicalConfig, overrideBitola?: number) => {
    const effectiveBitola = (overrideBitola && overrideBitola > 0) ? overrideBitola : techConfig.bitola;
    const massaLinear = (effectiveBitola ** 2) * STEEL_LINEAR_MASS_CONSTANT;
    const longLinear = techConfig.longQnt * techConfig.longTam; // Ex: 25 * 6 = 150 m
    const transLinear = techConfig.transQnt * techConfig.transTam; // Ex: 60 * 2.45 = 147 m
    const totalLinear = longLinear + transLinear; // Ex: 297 m

    const longPesoUnit = longLinear * massaLinear;
    const transPesoUnit = transLinear * massaLinear;
    const totalPesoUnit = longPesoUnit + transPesoUnit;

    return {
        effectiveBitola,
        massaLinear,
        longLinear,
        transLinear,
        totalLinear,
        longPesoUnit,
        transPesoUnit,
        totalPesoUnit
    };
};

/**
 * Dado o Peso Real do Pacote (ex: 2.197 kg) e a Quantidade de Malhas no pacote (ex: 50 malhas),
 * calcula:
 * 1) A Massa Linear Real (kg/m) = PesoPacote / (QtdMalhas * MetrosLinearesPorMalha)
 * 2) A Bitola Exata que deu no fio (mm) = sqrt(MassaLinearReal / 0.006162)
 * 3) O Peso Longitudinal do pacote (kg) = PesoPacote * (LongLinear / TotalLinear)
 * 4) O Peso Transversal do pacote (kg) = PesoPacote * (TransLinear / TotalLinear)
 */
export const calculateFromPackageWeight = (
    packageWeightKg: number,
    quantity: number,
    techConfig: MalhaTechnicalConfig
) => {
    const basePhysics = calculateMalhaPhysics(techConfig);
    const qty = Math.max(1, Number(quantity) || 50);
    const hasRealWeight = Number(packageWeightKg) > 0;

    if (hasRealWeight && basePhysics.totalLinear > 0) {
        const wPkg = Number(packageWeightKg);
        const unitMeshWeight = wPkg / qty; // Peso de 1 painel de malha
        const realMassaLinear = unitMeshWeight / basePhysics.totalLinear; // kg/m
        const realBitola = Math.sqrt(realMassaLinear / STEEL_LINEAR_MASS_CONSTANT); // mm
        const longKgCons = wPkg * (basePhysics.longLinear / basePhysics.totalLinear);
        const transKgCons = wPkg * (basePhysics.transLinear / basePhysics.totalLinear);

        return {
            hasRealWeight: true,
            packageWeightKg: wPkg,
            calculatedBitola: realBitola,
            calculatedMassaLinear: realMassaLinear,
            longKgCons,
            transKgCons,
            unitLongWeight: longKgCons / qty,
            unitTransWeight: transKgCons / qty,
            unitTotalWeight: unitMeshWeight
        };
    }

    const longKgCons = qty * basePhysics.longPesoUnit;
    const transKgCons = qty * basePhysics.transPesoUnit;
    return {
        hasRealWeight: false,
        packageWeightKg: longKgCons + transKgCons,
        calculatedBitola: techConfig.bitola,
        calculatedMassaLinear: basePhysics.massaLinear,
        longKgCons,
        transKgCons,
        unitLongWeight: basePhysics.longPesoUnit,
        unitTransWeight: basePhysics.transPesoUnit,
        unitTotalWeight: basePhysics.totalPesoUnit
    };
};

export interface ComputedPackageRow extends MalhaPackageRow {
    packageWeightKg: number;
    hasRealWeight: boolean;
    calculatedBitola: number;
    calculatedMassaLinear: number;
    longKgCons: number;
    longPesoInicial: number; // Saldo restante após este pacote
    longSplits: MalhaPackageLotSplit[];
    transKgCons: number;
    transPesoInicial: number;
    transSplits: MalhaPackageLotSplit[];
}

export interface ConsumedLotSummaryRow {
    id: string;
    direction: 'LONGITUDINAL' | 'TRANSVERSAL';
    lot: string;
    kgEntra: number;
    cons: number;
    sobra: number;
    roleStatus: 'CONSUMED' | 'ACTIVE' | 'RESERVE';
}

export const computeMalhaPackagesAndLots = (
    packages: MalhaPackageRow[],
    techConfig: MalhaTechnicalConfig,
    longLotsQueue: MalhaLotSupplyItem[] = [],
    transLotsQueue: MalhaLotSupplyItem[] = []
): {
    computedRows: ComputedPackageRow[];
    consumedLots: ConsumedLotSummaryRow[];
    longStatusList: ConsumedLotSummaryRow[];
    transStatusList: ConsumedLotSummaryRow[];
    activeLongLot: ConsumedLotSummaryRow | null;
    reserveLongLot: ConsumedLotSummaryRow | null;
    activeTransLot: ConsumedLotSummaryRow | null;
    reserveTransLot: ConsumedLotSummaryRow | null;
    effectiveBitola: number;
    effectiveMassaLinear: number;
    totalQuantity: number;
    totalLongCons: number;
    totalTransCons: number;
    totalWeightKg: number;
    totalLotEntraKg: number;
    totalLotConsKg: number;
    totalLotSobraKg: number;
} => {
    // 1. Pré-calcular a conversão física de cada pacote (pelo Peso Real do Pacote na balança ou pelo teórico)
    const pkgConversions = packages.map(pkg =>
        calculateFromPackageWeight(Number(pkg.measuredPackageWeight) || 0, Number(pkg.quantity) || 50, techConfig)
    );

    const buildEffectiveQueue = (queue: MalhaLotSupplyItem[], dir: 'LONG' | 'TRANS'): MalhaLotSupplyItem[] => {
        const list: MalhaLotSupplyItem[] = queue.map(q => ({
            ...q,
            lot: cleanLotCode(q.lot),
            weight: Number(q.weight) || 0
        })).filter(q => Boolean(q.lot));

        packages.forEach((p, idx) => {
            const lCode = cleanLotCode(dir === 'LONG' ? p.longLot : p.transLot);
            const lWeight = Number(dir === 'LONG' ? p.longLotWeight : p.transLotWeight) || 0;
            if (!lCode) return;
            const existing = list.find(x => x.lot === lCode);
            if (!existing) {
                list.push({ id: `auto-${dir}-${idx}`, lot: lCode, weight: lWeight });
            } else if (existing.weight <= 0 && lWeight > 0) {
                existing.weight = lWeight;
            }
        });

        return list;
    };

    const effLongQueue = buildEffectiveQueue(longLotsQueue, 'LONG');
    const effTransQueue = buildEffectiveQueue(transLotsQueue, 'TRANS');

    // 2. Simular abatimento em cascata FIFO (suportando 2 lotes num mesmo pacote: Ativo + Reserva)
    const simulateDirection = (queue: MalhaLotSupplyItem[], dir: 'LONG' | 'TRANS') => {
        const lotTrackers = queue.map(q => ({
            id: q.id,
            lot: q.lot,
            kgEntra: Number(q.weight) || 0,
            cons: 0,
            remaining: Number(q.weight) || 0
        }));

        let currentIdx = 0;

        const packageResults = packages.map((_, pkgIdx) => {
            const conv = pkgConversions[pkgIdx];
            const totalNeed = dir === 'LONG' ? conv.longKgCons : conv.transKgCons;
            let needed = totalNeed;
            const splits: MalhaPackageLotSplit[] = [];

            if (lotTrackers.length === 0) {
                return {
                    kgCons: totalNeed,
                    balanceAfter: -totalNeed,
                    splits: [],
                    primaryLot: '',
                    primaryLotWeight: 0
                };
            }

            while (needed > 0.0001) {
                if (currentIdx >= lotTrackers.length) {
                    currentIdx = lotTrackers.length - 1;
                }
                const tracker = lotTrackers[currentIdx];
                const hasNextLotWithWeight =
                    currentIdx + 1 < lotTrackers.length &&
                    lotTrackers[currentIdx + 1].kgEntra > 0;

                if (tracker.remaining > 0.0001) {
                    if (tracker.remaining >= needed - 0.0001) {
                        tracker.cons += needed;
                        tracker.remaining -= needed;
                        const isExhausted = tracker.remaining <= 0.05;
                        splits.push({
                            lot: tracker.lot,
                            consumedKg: needed,
                            lotInitialKg: tracker.kgEntra,
                            balanceAfterKg: tracker.remaining,
                            exhausted: isExhausted
                        });
                        needed = 0;
                        if (isExhausted && currentIdx + 1 < lotTrackers.length) {
                            currentIdx++;
                        }
                    } else if (hasNextLotWithWeight) {
                        // O pacote consome o saldo final do Lote Ativo e puxa a diferença automaticamente do Lote Reserva!
                        const usedFromCurrent = tracker.remaining;
                        tracker.cons += usedFromCurrent;
                        tracker.remaining = 0;
                        splits.push({
                            lot: tracker.lot,
                            consumedKg: usedFromCurrent,
                            lotInitialKg: tracker.kgEntra,
                            balanceAfterKg: 0,
                            exhausted: true
                        });
                        needed -= usedFromCurrent;
                        currentIdx++;
                    } else {
                        tracker.cons += needed;
                        tracker.remaining -= needed;
                        splits.push({
                            lot: tracker.lot,
                            consumedKg: needed,
                            lotInitialKg: tracker.kgEntra,
                            balanceAfterKg: tracker.remaining,
                            exhausted: true
                        });
                        needed = 0;
                    }
                } else {
                    if (currentIdx + 1 < lotTrackers.length && lotTrackers[currentIdx + 1].remaining > 0) {
                        currentIdx++;
                        continue;
                    }
                    tracker.cons += needed;
                    tracker.remaining -= needed;
                    splits.push({
                        lot: tracker.lot,
                        consumedKg: needed,
                        lotInitialKg: tracker.kgEntra,
                        balanceAfterKg: tracker.remaining,
                        exhausted: true
                    });
                    needed = 0;
                }
            }

            const lastSplit = splits[splits.length - 1];
            const balanceAfter = lastSplit ? lastSplit.balanceAfterKg : 0;

            return {
                kgCons: totalNeed,
                balanceAfter,
                splits,
                primaryLot: splits.map(s => s.lot).join(' + '),
                primaryLotWeight: splits[0]?.lotInitialKg || 0
            };
        });

        let foundActive = false;
        const statusList: ConsumedLotSummaryRow[] = lotTrackers.map((t, idx) => {
            const isExhausted = t.kgEntra > 0 && t.remaining <= 0.05 && idx < lotTrackers.length - 1;
            let roleStatus: 'CONSUMED' | 'ACTIVE' | 'RESERVE' = 'RESERVE';
            if (isExhausted) {
                roleStatus = 'CONSUMED';
            } else if (!foundActive) {
                roleStatus = 'ACTIVE';
                foundActive = true;
            } else {
                roleStatus = 'RESERVE';
            }

            return {
                id: t.id,
                direction: dir === 'LONG' ? 'LONGITUDINAL' : 'TRANSVERSAL',
                lot: t.lot,
                kgEntra: t.kgEntra,
                cons: t.cons,
                sobra: Math.max(0, t.remaining),
                roleStatus
            };
        });

        return { packageResults, statusList };
    };

    const longSim = simulateDirection(effLongQueue, 'LONG');
    const transSim = simulateDirection(effTransQueue, 'TRANS');

    const seenLongLots = new Set<string>();
    const seenTransLots = new Set<string>();

    const computedRows: ComputedPackageRow[] = packages.map((pkg, idx) => {
        const conv = pkgConversions[idx];
        const lRes = longSim.packageResults[idx];
        const tRes = transSim.packageResults[idx];

        const newLongSplit = lRes.splits.find(s => !seenLongLots.has(s.lot));
        lRes.splits.forEach(s => seenLongLots.add(s.lot));

        const newTransSplit = tRes.splits.find(s => !seenTransLots.has(s.lot));
        tRes.splits.forEach(s => seenTransLots.add(s.lot));

        return {
            ...pkg,
            packageWeightKg: conv.packageWeightKg,
            hasRealWeight: conv.hasRealWeight,
            calculatedBitola: conv.calculatedBitola,
            calculatedMassaLinear: conv.calculatedMassaLinear,
            longLot: newLongSplit ? newLongSplit.lot : (lRes.splits[0]?.lot || pkg.longLot || ''),
            longLotWeight: newLongSplit ? newLongSplit.lotInitialKg : (pkg.longLotWeight || 0),
            longKgCons: lRes.kgCons,
            longPesoInicial: lRes.balanceAfter,
            longSplits: lRes.splits,
            transLot: newTransSplit ? newTransSplit.lot : (tRes.splits[0]?.lot || pkg.transLot || ''),
            transLotWeight: newTransSplit ? newTransSplit.lotInitialKg : (pkg.transLotWeight || 0),
            transKgCons: tRes.kgCons,
            transPesoInicial: tRes.balanceAfter,
            transSplits: tRes.splits
        };
    });

    const totalQuantity = computedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
    const totalLongCons = computedRows.reduce((acc, r) => acc + r.longKgCons, 0);
    const totalTransCons = computedRows.reduce((acc, r) => acc + r.transKgCons, 0);
    const totalWeightKg = totalLongCons + totalTransCons;

    // Bitola efetiva ponderada pelos pacotes pesados (ou bitola padrão se ainda não houver pacote pesado)
    const basePhysics = calculateMalhaPhysics(techConfig);
    const weighedRows = computedRows.filter(r => r.hasRealWeight);
    let effectiveBitola = techConfig.bitola;
    let effectiveMassaLinear = basePhysics.massaLinear;

    if (weighedRows.length > 0 && basePhysics.totalLinear > 0) {
        const sumWeighedKg = weighedRows.reduce((acc, r) => acc + r.packageWeightKg, 0);
        const sumWeighedQty = weighedRows.reduce((acc, r) => acc + (Number(r.quantity) || 50), 0);
        if (sumWeighedQty > 0) {
            effectiveMassaLinear = (sumWeighedKg / sumWeighedQty) / basePhysics.totalLinear;
            effectiveBitola = Math.sqrt(effectiveMassaLinear / STEEL_LINEAR_MASS_CONSTANT);
        }
    }

    const consumedLots = [...longSim.statusList, ...transSim.statusList];
    const totalLotEntraKg = consumedLots.reduce((acc, l) => acc + l.kgEntra, 0);
    const totalLotConsKg = consumedLots.reduce((acc, l) => acc + l.cons, 0);
    const totalLotSobraKg = consumedLots.reduce((acc, l) => acc + l.sobra, 0);

    const activeLongLot = longSim.statusList.find(s => s.roleStatus === 'ACTIVE') || null;
    const reserveLongLot = longSim.statusList.find(s => s.roleStatus === 'RESERVE') || null;
    const activeTransLot = transSim.statusList.find(s => s.roleStatus === 'ACTIVE') || null;
    const reserveTransLot = transSim.statusList.find(s => s.roleStatus === 'RESERVE') || null;

    return {
        computedRows,
        consumedLots,
        longStatusList: longSim.statusList,
        transStatusList: transSim.statusList,
        activeLongLot,
        reserveLongLot,
        activeTransLot,
        reserveTransLot,
        effectiveBitola,
        effectiveMassaLinear,
        totalQuantity,
        totalLongCons,
        totalTransCons,
        totalWeightKg,
        totalLotEntraKg,
        totalLotConsKg,
        totalLotSobraKg
    };
};

// Extrai YYYY-MM-DD em horário local sem deslocar strings YYYY-MM-DD em -3h (UTC-3)
const extractLocalIsoDateStr = (raw: any): string => {
    if (!raw) return '';
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split('/');
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(str)) {
        const [dd, mm, yy] = str.split('/');
        return `20${yy}-${mm}-${dd}`;
    }
    if (/^\d{2}\/\d{2}$/.test(str)) {
        const [dd, mm] = str.split('/');
        const yyyy = new Date().getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatIsoToBrDate = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
};

export interface UnifiedDailyUpdateRow {
    isoDate: string;
    date: string; // DD/MM/YYYY
    qty: number;
    weightKg: number;
    avgKgPerPiece: number;
}

export const useUnifiedMalhaDailyUpdates = (
    op: ProductionOrderData,
    shiftReports: ShiftReport[] = [],
    unitWeightKg: number = 65.8841,
    activeTrigger: boolean = true
) => {
    const [remoteShiftReports, setRemoteShiftReports] = useState<any[]>([]);
    const [remoteDailyReports, setRemoteDailyReports] = useState<any[]>([]);
    const [freshOperatorLogs, setFreshOperatorLogs] = useState<any[] | null>(null);
    const [isSyncingDaily, setIsSyncingDaily] = useState<boolean>(false);
    const [syncTick, setSyncTick] = useState<number>(0);

    const reloadDailyUpdates = () => setSyncTick(t => t + 1);

    useEffect(() => {
        if (!activeTrigger || !op) return;
        let isMounted = true;
        const cleanOpNum = String(op.orderNumber || (op as any).order_number || '').trim();

        const fetchAllDailySources = async () => {
            setIsSyncingDaily(true);
            try {
                const promises: Promise<any>[] = [];

                // 1. Buscar shift_reports atualizados da OP no Supabase
                if (op.id || cleanOpNum) {
                    const query = supabase.from('shift_reports').select('*');
                    if (op.id && cleanOpNum) {
                        promises.push(query.or(`production_order_id.eq.${op.id},order_number.eq.${cleanOpNum}`) as any);
                    } else if (op.id) {
                        promises.push(query.eq('production_order_id', op.id) as any);
                    } else {
                        promises.push(query.eq('order_number', cleanOpNum) as any);
                    }
                } else {
                    promises.push(Promise.resolve({ data: [] }));
                }

                // 2. Buscar trelica_daily_reports (Relatório Diário) desta OP no Supabase
                if (cleanOpNum) {
                    promises.push(
                        supabase
                            .from('trelica_daily_reports')
                            .select('date, production_order, stats_shift_a, stats_shift_b, production_updates')
                            .eq('production_order', cleanOpNum) as any
                    );
                } else {
                    promises.push(Promise.resolve({ data: [] }));
                }

                // 3. Buscar operator_logs mais recentes da OP em production_orders
                if (op.id) {
                    promises.push(
                        supabase
                            .from('production_orders')
                            .select('operator_logs, actual_produced_quantity')
                            .eq('id', op.id)
                            .single() as any
                    );
                } else {
                    promises.push(Promise.resolve({ data: null }));
                }

                const [srRes, drRes, opRes] = await Promise.all(promises);
                if (!isMounted) return;

                if (Array.isArray(srRes?.data)) {
                    setRemoteShiftReports(srRes.data);
                }
                if (Array.isArray(drRes?.data)) {
                    setRemoteDailyReports(drRes.data);
                }
                if (opRes?.data && Array.isArray(opRes.data.operator_logs)) {
                    setFreshOperatorLogs(opRes.data.operator_logs);
                }
            } catch (err) {
                console.warn('Erro ao sincronizar marcações diárias da OP:', err);
            } finally {
                if (isMounted) setIsSyncingDaily(false);
            }
        };

        fetchAllDailySources();
        return () => {
            isMounted = false;
        };
    }, [activeTrigger, op?.id, op?.orderNumber, syncTick]);

    const dailyUpdates = useMemo<UnifiedDailyUpdateRow[]>(() => {
        const dayQtyMap = new Map<string, number>();
        const daySavedWeightMap = new Map<string, number>();
        const cleanOpNum = String(op?.orderNumber || (op as any)?.order_number || '').trim();

        // 1. Consolidar Shift Reports (props + banco) deduplicados por data + turno + operador
        const allShiftReps = [...(shiftReports || []), ...(remoteShiftReports || [])];
        const dedupedRepMap = new Map<string, any>();

        allShiftReps.forEach(r => {
            if (!r) return;
            const rOpId = r.productionOrderId || r.production_order_id;
            const rOpNum = String(r.orderNumber || r.order_number || '').trim();
            const isThisOp = (op?.id && rOpId === op.id) || (cleanOpNum && rOpNum === cleanOpNum);
            if (!isThisOp) return;

            const isoD = extractLocalIsoDateStr(r.date || r.shiftStartTime || r.shift_start_time || r.shiftEndTime || r.shift_end_time);
            if (!isoD) return;
            const shiftKey = String(r.shift || '').toLowerCase().trim();
            const opKey = String(r.operator || '').toLowerCase().trim();
            const key = `${isoD}_${shiftKey}_${opKey}`;
            const qty = Number(r.totalProducedQuantity ?? r.total_produced_quantity ?? 0) || 0;

            if (!dedupedRepMap.has(key) || qty > (Number(dedupedRepMap.get(key)?.qty) || 0)) {
                dedupedRepMap.set(key, { isoD, qty });
            }
        });

        dedupedRepMap.forEach(({ isoD, qty }) => {
            if (qty > 0) {
                dayQtyMap.set(isoD, (dayQtyMap.get(isoD) || 0) + qty);
            }
        });

        // 2. Consolidar Operator Logs (somando múltiplos turnos do mesmo dia sem descartar dias que estão em shift_reports!)
        const logsSource: any[] = freshOperatorLogs || op?.operatorLogs || (op as any)?.operator_logs || [];
        const logsByDay = new Map<string, number>();
        logsSource.forEach(l => {
            if (!l || l.action === 'Criada no PCP' || l.operator === 'GHOST_ORDER_FLAG') return;
            const rawStart = l.startTime || l.start_time;
            const rawEnd = l.endTime || l.end_time;
            const isoD = extractLocalIsoDateStr(rawStart || rawEnd);
            if (!isoD) return;

            const startQ = Number(l.startQuantity ?? l.start_quantity ?? 0) || 0;
            const endQ = rawEnd
                ? (Number(l.endQuantity ?? l.end_quantity ?? startQ) || 0)
                : (Number(op?.actualProducedQuantity ?? (op as any)?.actual_produced_quantity ?? 0) || 0);
            const diff = Math.max(0, endQ - startQ);
            if (diff > 0) {
                logsByDay.set(isoD, (logsByDay.get(isoD) || 0) + diff);
            }
        });

        logsByDay.forEach((logQty, isoD) => {
            dayQtyMap.set(isoD, Math.max(dayQtyMap.get(isoD) || 0, logQty));
        });

        // 3. Consolidar Relatórios Diários salvos (trelica_daily_reports: production_updates e stats_shift_a/b)
        (remoteDailyReports || []).forEach(dr => {
            if (!dr) return;
            const repIsoDate = extractLocalIsoDateStr(dr.date);
            const piecesA = Number(dr.stats_shift_a?.pecasProduzidas || 0) || 0;
            const piecesB = Number(dr.stats_shift_b?.pecasProduzidas || 0) || 0;
            const sumShiftStats = piecesA + piecesB;
            if (repIsoDate && sumShiftStats > 0) {
                dayQtyMap.set(repIsoDate, Math.max(dayQtyMap.get(repIsoDate) || 0, sumShiftStats));
            }

            if (Array.isArray(dr.production_updates)) {
                dr.production_updates.forEach((u: any) => {
                    if (!u) return;
                    const uIso = extractLocalIsoDateStr(u.data);
                    const uQty = Number(u.qnt ?? u.quantity ?? 0) || 0;
                    const uPeso = Number(u.peso ?? u.weight ?? 0) || 0;
                    if (uIso && uQty > 0) {
                        dayQtyMap.set(uIso, Math.max(dayQtyMap.get(uIso) || 0, uQty));
                        if (uPeso > 0) {
                            daySavedWeightMap.set(uIso, uPeso);
                        }
                    }
                });
            }
        });

        // 4. Pacotes pesados (weighedPackages) caso alguma data ainda não conste no mapa
        (op?.weighedPackages || []).forEach((p: any) => {
            if (!p?.timestamp) return;
            const isoD = extractLocalIsoDateStr(p.timestamp);
            const q = Number(p.quantity) || 50;
            if (isoD && q > 0 && !dayQtyMap.has(isoD)) {
                dayQtyMap.set(isoD, q);
            }
        });

        const effectiveUnitW = unitWeightKg > 0 ? unitWeightKg : 65.8841;
        const sortedIsoDates = Array.from(dayQtyMap.keys()).sort();

        return sortedIsoDates.map(isoDate => {
            const qty = dayQtyMap.get(isoDate) || 0;
            const savedW = daySavedWeightMap.get(isoDate);
            const weightKg = (savedW && savedW > 0 && Math.abs(savedW / qty - effectiveUnitW) < 5)
                ? savedW
                : Math.round(qty * effectiveUnitW * 100) / 100;
            const avgKgPerPiece = qty > 0 ? weightKg / qty : effectiveUnitW;
            return {
                isoDate,
                date: formatIsoToBrDate(isoDate),
                qty,
                weightKg,
                avgKgPerPiece
            };
        });
    }, [op, shiftReports, remoteShiftReports, remoteDailyReports, freshOperatorLogs, unitWeightKg]);

    const totalDailyQty = useMemo(
        () => dailyUpdates.reduce((acc, u) => acc + u.qty, 0),
        [dailyUpdates]
    );
    const totalDailyWeightKg = useMemo(
        () => dailyUpdates.reduce((acc, u) => acc + u.weightKg, 0),
        [dailyUpdates]
    );
    const avgDailyWeightPerPiece = useMemo(
        () => (totalDailyQty > 0 ? totalDailyWeightKg / totalDailyQty : (unitWeightKg > 0 ? unitWeightKg : 65.8841)),
        [totalDailyQty, totalDailyWeightKg, unitWeightKg]
    );

    return {
        dailyUpdates,
        totalDailyQty,
        totalDailyWeightKg,
        avgDailyWeightPerPiece,
        reloadDailyUpdates,
        isSyncingDaily
    };
};

interface MalhaConsumptionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    op: ProductionOrderData;
    stock: StockItem[];
    shiftReports?: ShiftReport[];
}

const MalhaConsumptionReportModal: React.FC<MalhaConsumptionReportModalProps> = ({
    isOpen,
    onClose,
    op,
    stock,
    shiftReports = []
}) => {
    const [reportData, setReportData] = useState<MalhaPackagesReportData>(() => getSavedMalhaPackagesData(op, stock));
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    useEffect(() => {
        if (isOpen && op) {
            setReportData(getSavedMalhaPackagesData(op, stock));
        }
    }, [isOpen, op?.id]);

    const stockLotMap = useMemo(() => {
        const map = new Map<string, number>();
        (stock || []).forEach(item => {
            if (item && item.internalLot) {
                const clean = cleanLotCode(item.internalLot);
                const weight = Number(item.initialQuantity || item.remainingQuantity || 0);
                if (clean && weight > 0) {
                    map.set(clean.toLowerCase(), weight);
                }
            }
        });
        return map;
    }, [stock]);

    const handleSave = async (nextData: MalhaPackagesReportData) => {
        setReportData(nextData);
        setSaveStatus('saving');
        await saveMalhaPackagesData(op, nextData);
        setSaveStatus('saved');
    };

    const updateTechField = (field: keyof MalhaTechnicalConfig, value: number) => {
        const next: MalhaPackagesReportData = {
            ...reportData,
            techConfig: {
                ...reportData.techConfig,
                [field]: value
            }
        };
        handleSave(next);
    };

    const updatePackageRow = (id: string, field: keyof MalhaPackageRow, value: any) => {
        const nextPackages = reportData.packages.map(pkg => {
            if (pkg.id !== id) return pkg;
            const updated: MalhaPackageRow = { ...pkg, [field]: value, confirmed: true };

            if (field === 'longLot') {
                const clean = cleanLotCode(value).toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.longLotWeight || updated.longLotWeight === 0)) {
                    updated.longLotWeight = foundWeight;
                }
            }
            if (field === 'transLot') {
                const clean = cleanLotCode(value).toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.transLotWeight || updated.transLotWeight === 0)) {
                    updated.transLotWeight = foundWeight;
                }
            }
            return updated;
        });

        const targetPkg = nextPackages.find(p => p.id === id);
        let nextLongQ = [...(reportData.longLotsQueue || [])];
        let nextTransQ = [...(reportData.transLotsQueue || [])];

        if (targetPkg && (field === 'longLot' || field === 'longLotWeight')) {
            const cLot = cleanLotCode(targetPkg.longLot);
            if (cLot) {
                const existing = nextLongQ.find(q => cleanLotCode(q.lot) === cLot);
                if (existing) {
                    if (targetPkg.longLotWeight > 0) existing.weight = targetPkg.longLotWeight;
                } else {
                    nextLongQ.push({ id: `lq-${Date.now()}`, lot: cLot, weight: targetPkg.longLotWeight || 0 });
                }
            }
        }
        if (targetPkg && (field === 'transLot' || field === 'transLotWeight')) {
            const cLot = cleanLotCode(targetPkg.transLot);
            if (cLot) {
                const existing = nextTransQ.find(q => cleanLotCode(q.lot) === cLot);
                if (existing) {
                    if (targetPkg.transLotWeight > 0) existing.weight = targetPkg.transLotWeight;
                } else {
                    nextTransQ.push({ id: `tq-${Date.now()}`, lot: cLot, weight: targetPkg.transLotWeight || 0 });
                }
            }
        }

        handleSave({
            ...reportData,
            longLotsQueue: nextLongQ,
            transLotsQueue: nextTransQ,
            packages: nextPackages
        });
    };

    const handleAddPackage = () => {
        const nextNum = reportData.packages.length + 1;
        const newRow: MalhaPackageRow = {
            id: `mpkg-${Date.now()}`,
            packageCode: `p${nextNum}`,
            finishedLotNumber: '',
            quantity: reportData.techConfig.defaultQtyPerPackage || 50,
            measuredPackageWeight: null,
            longLot: '',
            longLotWeight: 0,
            transLot: '',
            transLotWeight: 0,
            confirmed: true,
            recordedAt: new Date().toISOString()
        };
        handleSave({
            ...reportData,
            packages: [...reportData.packages, newRow]
        });
    };

    const handleRemovePackage = (id: string) => {
        const filtered = reportData.packages
            .filter(p => p.id !== id)
            .map((p, idx) => ({ ...p, packageCode: `p${idx + 1}` }));
        handleSave({
            ...reportData,
            packages: filtered
        });
    };

    const computed = useMemo(
        () => computeMalhaPackagesAndLots(reportData.packages, reportData.techConfig, reportData.longLotsQueue, reportData.transLotsQueue),
        [reportData.packages, reportData.techConfig, reportData.longLotsQueue, reportData.transLotsQueue]
    );
    const physics = useMemo(
        () => calculateMalhaPhysics(reportData.techConfig, computed.effectiveBitola),
        [reportData.techConfig, computed.effectiveBitola]
    );

    const {
        dailyUpdates,
        totalDailyQty,
        totalDailyWeightKg,
        avgDailyWeightPerPiece,
        reloadDailyUpdates,
        isSyncingDaily
    } = useUnifiedMalhaDailyUpdates(op, shiftReports, physics.totalPesoUnit, isOpen);

    const displayPackageQty = useMemo(() => {
        if (reportData.packages.length > 0) {
            const firstQty = Number(reportData.packages[0].quantity) || 0;
            const allSame = reportData.packages.every(p => (Number(p.quantity) || 0) === firstQty);
            if (allSame && firstQty > 0) return firstQty;
            return Math.round(computed.totalQuantity / reportData.packages.length);
        }
        return reportData.techConfig.defaultQtyPerPackage || 50;
    }, [reportData.packages, reportData.techConfig.defaultQtyPerPackage, computed.totalQuantity]);

    const pendingPiecesToPackage = Math.max(0, totalDailyQty - computed.totalQuantity);

    if (!isOpen) return null;

    const modelName = (op.malhaModel || (op as any).malha_model || op.productDescription || 'MALHA SOLDADA PAINEL SOB MEDIDA').toUpperCase();

    return (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[160] p-2 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border-2 border-slate-300 my-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-[#0A1B27] text-white px-4 py-3 flex items-center justify-between gap-3 flex-wrap print:hidden">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 text-lg">📊</span>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                                Relatório de Consumo por Lote & Pacotes (50 Malhas) • OP #{op.orderNumber}
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Pelo peso do pacote, o sistema calcula a bitola exata do fio e divide o peso Longitudinal e Transversal automaticamente
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold ${
                            saveStatus === 'saved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                            {saveStatus === 'saved' ? '✓ Salvo Automaticamente' : 'Salvando...'}
                        </span>
                        <button
                            type="button"
                            onClick={handleAddPackage}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                            + Pacote (50 pçs)
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                            🖨️ Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                        >
                            ✕ Fechar
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50 flex-1">
                    {/* 1. CABEÇALHO DO MODELO / BITOLA / MASSA / ORDEM */}
                    <div className="overflow-x-auto">
                        <table className="w-full max-w-4xl mx-auto border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                            <tbody>
                                <tr>
                                    <td className="bg-[#1F3864] text-white font-black uppercase px-3 py-1.5 text-center w-28 border border-[#1F3864]">
                                        MODELO
                                    </td>
                                    <td colSpan={5} className="font-bold text-slate-800 px-3 py-1.5 text-center border border-slate-400">
                                        {modelName}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="bg-[#1F3864] text-white font-black uppercase px-3 py-1.5 text-center border border-[#1F3864]">
                                        BITOLA (mm)
                                    </td>
                                    <td className="px-2 py-1.5 text-center border border-slate-400 bg-emerald-50/70 w-32 font-mono font-black text-emerald-900">
                                        {computed.effectiveBitola.toFixed(2).replace('.', ',')} mm
                                    </td>
                                    <td className="bg-[#1F3864] text-white font-black uppercase px-3 py-1.5 text-center w-28 border border-[#1F3864]">
                                        MASSA (kg/m)
                                    </td>
                                    <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-800 border border-slate-400 w-36 bg-slate-100">
                                        {physics.massaLinear.toFixed(8).replace('.', ',')}
                                    </td>
                                    <td className="bg-[#1F3864] text-white font-black uppercase px-3 py-1.5 text-center w-28 border border-[#1F3864]">
                                        ORDEM
                                    </td>
                                    <td className="px-3 py-1.5 text-center font-black text-slate-900 border border-slate-400 w-32">
                                        {op.orderNumber}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 2. DESCRIÇÃO TÉCNICA & RESUMO DA ORDEM */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-7 overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={5} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            DESCRIÇÃO TÉCNICA (POR 1 PAINEL DE MALHA)
                                        </th>
                                    </tr>
                                    <tr className="bg-[#2F5597] text-white font-bold uppercase text-[11px]">
                                        <th className="py-1 px-2 border border-slate-400 text-left">DIREÇÃO</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">QNT. (Fios)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">TAM (m)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">LINEAR (m)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">PESO (kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-1.5 px-2 font-bold border border-slate-400">LONGITUDINAL</td>
                                        <td className="py-1 px-2 border border-slate-400 bg-amber-50/50 text-center">
                                            <input
                                                type="number"
                                                value={reportData.techConfig.longQnt}
                                                onChange={e => updateTechField('longQnt', parseFloat(e.target.value) || 0)}
                                                className="w-16 text-center font-bold bg-transparent outline-none"
                                            />
                                        </td>
                                        <td className="py-1 px-2 border border-slate-400 bg-amber-50/50 text-center">
                                            <input
                                                type="number"
                                                step="0.05"
                                                value={reportData.techConfig.longTam}
                                                onChange={e => updateTechField('longTam', parseFloat(e.target.value) || 0)}
                                                className="w-16 text-center font-bold bg-transparent outline-none"
                                            />
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono font-semibold bg-slate-50">
                                            {physics.longLinear.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono font-bold bg-slate-50">
                                            {physics.longPesoUnit.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-1.5 px-2 font-bold border border-slate-400">TRANSVERSAL</td>
                                        <td className="py-1 px-2 border border-slate-400 bg-amber-50/50 text-center">
                                            <input
                                                type="number"
                                                value={reportData.techConfig.transQnt}
                                                onChange={e => updateTechField('transQnt', parseFloat(e.target.value) || 0)}
                                                className="w-16 text-center font-bold bg-transparent outline-none"
                                            />
                                        </td>
                                        <td className="py-1 px-2 border border-slate-400 bg-amber-50/50 text-center">
                                            <input
                                                type="number"
                                                step="0.05"
                                                value={reportData.techConfig.transTam}
                                                onChange={e => updateTechField('transTam', parseFloat(e.target.value) || 0)}
                                                className="w-16 text-center font-bold bg-transparent outline-none"
                                            />
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono font-semibold bg-slate-50">
                                            {physics.transLinear.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono font-bold bg-slate-50">
                                            {physics.transPesoUnit.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                                        </td>
                                    </tr>
                                    <tr className="bg-[#D9E1F2] font-black text-slate-900">
                                        <td className="py-1.5 px-2 border border-slate-400 text-center">TOTAL</td>
                                        <td className="py-1.5 px-2 border border-slate-400"></td>
                                        <td className="py-1.5 px-2 border border-slate-400"></td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {physics.totalLinear.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {physics.totalPesoUnit.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 8 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="lg:col-span-5 overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={4} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            RESUMO DA ORDEM
                                        </th>
                                    </tr>
                                    <tr className="bg-[#2F5597] text-white font-bold uppercase text-[11px]">
                                        <th className="py-1 px-2 border border-slate-400 text-center">Pacotes</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Quantidade</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Total (Malhas)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">Peso (kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold">
                                            {reportData.packages.length}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold">
                                            {displayPackageQty}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold">
                                            {computed.totalQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono font-bold">
                                            {computed.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    <tr className="bg-[#D9E1F2] font-black text-slate-900">
                                        <td className="py-1.5 px-2 border border-slate-400 text-center">Total Pesado:</td>
                                        <td className="py-1.5 px-2 border border-slate-400"></td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {computed.totalQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {computed.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {totalDailyQty > 0 && (
                                        <tr className="bg-emerald-50 font-black text-emerald-950">
                                            <td colSpan={2} className="py-1.5 px-2 border border-slate-400 text-center text-[11px]">
                                                Produzido (Marcações Diárias):
                                            </td>
                                            <td className="py-1.5 px-2 border border-slate-400 text-center font-mono text-emerald-800">
                                                {totalDailyQty}
                                            </td>
                                            <td className="py-1.5 px-2 border border-slate-400 text-right font-mono text-emerald-800">
                                                {totalDailyWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    {pendingPiecesToPackage > 0 && (
                                        <tr className="bg-amber-50 font-black text-amber-900">
                                            <td colSpan={2} className="py-1 px-2 border border-slate-400 text-center text-[10px]">
                                                Saldo p/ Fechar Pacote:
                                            </td>
                                            <td colSpan={2} className="py-1 px-2 border border-slate-400 text-center font-mono text-[11px]">
                                                {pendingPiecesToPackage} malhas em máquina
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. CONSUMÍVEIS POR LOTE */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                            <thead>
                                <tr>
                                    <th colSpan={14} className="bg-[#1F3864] text-white font-black uppercase py-2 px-3 text-center tracking-wider border border-[#1F3864]">
                                        CONSUMÍVEIS POR LOTE (PACOTES DE 50 MALHAS • CONVERSÃO AUTOMÁTICA PELO PESO DO PACOTE)
                                    </th>
                                </tr>
                                <tr className="bg-[#2F5597] text-white font-black uppercase text-[11px]">
                                    <th colSpan={5} className="py-1 px-2 border border-slate-400 text-center">PACOTE DE 50 MALHAS & BITOLA REAL</th>
                                    <th colSpan={4} className="py-1 px-2 border border-slate-400 text-center bg-[#1F4E79]">LONGITUDINAL</th>
                                    <th colSpan={4} className="py-1 px-2 border border-slate-400 text-center bg-[#2E75B6]">TRANSVERSAL</th>
                                    <th className="py-1 px-1 border border-slate-400 text-center print:hidden w-8"></th>
                                </tr>
                                <tr className="bg-[#D9E1F2] text-slate-900 font-black uppercase text-[10px]">
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-20">LOTE (Etiq.)</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-12">PCT</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-14">QUNT.</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-emerald-200/80">PESO PCT (kg)</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-20 bg-emerald-100">BITOLA CALC.</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-20 bg-yellow-200/80">PESO LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-24">PESO INICIAL</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-24">KG CONS.</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-20 bg-yellow-200/80">PESO LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-24">PESO INICIAL</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-24">KG CONS.</th>
                                    <th className="py-1.5 px-1 border border-slate-400 text-center print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {computed.computedRows.length > 0 ? (
                                    computed.computedRows.map((row, idx, rows) => {
                                        const cleanLongLot = (row.longLot || '').trim();
                                        const prevLongLot = idx > 0 ? (rows[idx - 1].longLot || '').trim() : '';
                                        let longSpan = 1;
                                        if (cleanLongLot && cleanLongLot === prevLongLot) {
                                            longSpan = 0;
                                        } else if (cleanLongLot) {
                                            while (
                                                idx + longSpan < rows.length &&
                                                (rows[idx + longSpan].longLot || '').trim() === cleanLongLot
                                            ) {
                                                longSpan++;
                                            }
                                        }
                                        const longGroupRows = longSpan > 0 ? rows.slice(idx, idx + longSpan) : [row];
                                        const longWeightRow = longGroupRows.find(r => r.longLotWeight > 0) || row;
                                        const hasLongEntry = Boolean(cleanLongLot || longWeightRow.longLotWeight > 0);

                                        const cleanTransLot = (row.transLot || '').trim();
                                        const prevTransLot = idx > 0 ? (rows[idx - 1].transLot || '').trim() : '';
                                        let transSpan = 1;
                                        if (cleanTransLot && cleanTransLot === prevTransLot) {
                                            transSpan = 0;
                                        } else if (cleanTransLot) {
                                            while (
                                                idx + transSpan < rows.length &&
                                                (rows[idx + transSpan].transLot || '').trim() === cleanTransLot
                                            ) {
                                                transSpan++;
                                            }
                                        }
                                        const transGroupRows = transSpan > 0 ? rows.slice(idx, idx + transSpan) : [row];
                                        const transWeightRow = transGroupRows.find(r => r.transLotWeight > 0) || row;
                                        const hasTransEntry = Boolean(cleanTransLot || transWeightRow.transLotWeight > 0);

                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50">
                                                <td className="p-1 border border-slate-400 text-center">
                                                    <input
                                                        type="text"
                                                        value={row.finishedLotNumber}
                                                        onChange={e => updatePackageRow(row.id, 'finishedLotNumber', e.target.value)}
                                                        placeholder="Ex: 88846"
                                                        className="w-full text-center font-bold text-slate-800 bg-transparent outline-none focus:bg-amber-50 rounded py-0.5"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-400 text-center font-bold text-slate-700 bg-slate-50">
                                                    {row.packageCode}
                                                </td>
                                                <td className="p-1 border border-slate-400 text-center bg-amber-50/30">
                                                    <input
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={e => updatePackageRow(row.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                                                        className="w-full text-center font-black text-slate-900 bg-transparent outline-none focus:bg-amber-100 rounded py-0.5"
                                                    />
                                                </td>
                                                {/* Peso do Pacote (Balança) */}
                                                <td className="p-1 border border-slate-400 text-center bg-emerald-100/70">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={row.measuredPackageWeight ?? ''}
                                                        onChange={e => updatePackageRow(row.id, 'measuredPackageWeight', parseFloat(e.target.value) || null)}
                                                        placeholder={row.packageWeightKg.toFixed(0)}
                                                        className="w-full text-center font-black text-emerald-950 bg-transparent outline-none py-0.5"
                                                    />
                                                </td>
                                                {/* Bitola Calculada Exata do Fio */}
                                                <td className="p-1 border border-slate-400 text-center font-mono font-black text-emerald-800 bg-emerald-50/50">
                                                    {row.calculatedBitola.toFixed(2).replace('.', ',')} mm
                                                </td>

                                                {/* LONGITUDINAL (Mesclado quando mesmo lote em pacotes seguidos) */}
                                                {longSpan > 0 && (
                                                    <>
                                                        <td
                                                            rowSpan={longSpan}
                                                            className={`p-1 border border-slate-400 text-center align-middle ${hasLongEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}
                                                        >
                                                            <input
                                                                type="text"
                                                                list="malha-stock-lots-datalist"
                                                                value={row.longLot}
                                                                onChange={e => updatePackageRow(row.id, 'longLot', e.target.value)}
                                                                placeholder="Nº Lote"
                                                                className="w-full text-center font-black text-slate-900 bg-transparent outline-none py-0.5"
                                                            />
                                                            {longGroupRows
                                                                .filter(r => r.longSplits.length > 1)
                                                                .map(r => (
                                                                    <div key={r.id} className="text-[9px] font-bold text-amber-900 leading-tight">
                                                                        {r.longSplits.map(s => `${s.lot} (${s.consumedKg.toFixed(0)}kg)`).join(' + ')}
                                                                    </div>
                                                                ))}
                                                        </td>
                                                        <td
                                                            rowSpan={longSpan}
                                                            className={`p-1 border border-slate-400 text-center align-middle ${hasLongEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}
                                                        >
                                                            <input
                                                                type="number"
                                                                value={longWeightRow.longLotWeight || ''}
                                                                onChange={e => updatePackageRow(longWeightRow.id, 'longLotWeight', parseFloat(e.target.value) || 0)}
                                                                placeholder="Kg Lote"
                                                                className="w-full text-center font-bold text-slate-900 bg-transparent outline-none py-0.5"
                                                            />
                                                        </td>
                                                    </>
                                                )}
                                                <td className={`p-1.5 border border-slate-400 text-right font-mono font-bold ${
                                                    row.longPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800 bg-slate-50'
                                                }`}>
                                                    {row.longPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border border-slate-400 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                                                    {row.longKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* TRANSVERSAL (Mesclado quando mesmo lote em pacotes seguidos) */}
                                                {transSpan > 0 && (
                                                    <>
                                                        <td
                                                            rowSpan={transSpan}
                                                            className={`p-1 border border-slate-400 text-center align-middle ${hasTransEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}
                                                        >
                                                            <input
                                                                type="text"
                                                                list="malha-stock-lots-datalist"
                                                                value={row.transLot}
                                                                onChange={e => updatePackageRow(row.id, 'transLot', e.target.value)}
                                                                placeholder="Nº Lote"
                                                                className="w-full text-center font-black text-slate-900 bg-transparent outline-none py-0.5"
                                                            />
                                                            {transGroupRows
                                                                .filter(r => r.transSplits.length > 1)
                                                                .map(r => (
                                                                    <div key={r.id} className="text-[9px] font-bold text-blue-900 leading-tight">
                                                                        {r.transSplits.map(s => `${s.lot} (${s.consumedKg.toFixed(0)}kg)`).join(' + ')}
                                                                    </div>
                                                                ))}
                                                        </td>
                                                        <td
                                                            rowSpan={transSpan}
                                                            className={`p-1 border border-slate-400 text-center align-middle ${hasTransEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}
                                                        >
                                                            <input
                                                                type="number"
                                                                value={transWeightRow.transLotWeight || ''}
                                                                onChange={e => updatePackageRow(transWeightRow.id, 'transLotWeight', parseFloat(e.target.value) || 0)}
                                                                placeholder="Kg Lote"
                                                                className="w-full text-center font-bold text-slate-900 bg-transparent outline-none py-0.5"
                                                            />
                                                        </td>
                                                    </>
                                                )}
                                                <td className={`p-1.5 border border-slate-400 text-right font-mono font-bold ${
                                                    row.transPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800 bg-slate-50'
                                                }`}>
                                                    {row.transPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border border-slate-400 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                                                    {row.transKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                <td className="p-1 border border-slate-400 text-center print:hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePackage(row.id)}
                                                        className="text-rose-500 hover:text-rose-700 font-bold px-1 cursor-pointer"
                                                        title="Remover pacote"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={14} className="py-6 text-center text-slate-400 italic">
                                            Nenhum pacote confirmado ainda. Confirme os pacotes com o peso no app do operador.
                                        </td>
                                    </tr>
                                )}

                                <tr className="bg-[#2F5597] text-white font-black">
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center">TOTAL</td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                        {computed.totalQuantity}
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                        {computed.totalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                        Ø {computed.effectiveBitola.toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                        {computed.totalLongCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                        {computed.totalTransCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-1.5 px-1 border border-slate-400 print:hidden"></td>
                                </tr>
                            </tbody>
                        </table>

                        <datalist id="malha-stock-lots-datalist">
                            {(stock || [])
                                .filter(s => s && s.internalLot && !String(s.status || '').toLowerCase().includes('consumido'))
                                .map(s => (
                                    <option key={s.id} value={s.internalLot}>
                                        Lote {s.internalLot} • {s.bitola}mm • {Number(s.initialQuantity || s.remainingQuantity || 0).toFixed(0)}kg
                                    </option>
                                ))}
                        </datalist>
                    </div>

                    {/* 4. LOTES CONSUMIDOS & ATUALIZAÇÃO PRODUÇÃO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={5} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            LOTES CONSUMIDOS (CONVERSÃO E SOBRA)
                                        </th>
                                    </tr>
                                    <tr className="bg-[#2F5597] text-white font-bold uppercase text-[11px]">
                                        <th className="py-1 px-2 border border-slate-400 text-center">Posição</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Lote</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">kg. entra.</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">cons.</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">sobra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {computed.consumedLots.length > 0 ? (
                                        computed.consumedLots.map((item, idx) => (
                                            <tr key={`${item.direction}-${item.lot}-${idx}`} className="hover:bg-slate-50">
                                                <td className="py-1 px-2 border border-slate-400 text-center text-[10px] font-bold text-slate-500">
                                                    {item.direction === 'LONGITUDINAL' ? 'LONG.' : 'TRANS.'}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-center font-black text-slate-900">
                                                    {item.lot}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-right font-mono">
                                                    {item.kgEntra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-right font-mono font-bold text-rose-700">
                                                    {item.cons.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-right font-mono font-black text-emerald-700">
                                                    {item.sobra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                                                Defina o Lote Ativo e o Peso para ver o cálculo de consumo e sobra.
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="bg-[#D9E1F2] font-black text-slate-900">
                                        <td colSpan={2} className="py-1.5 px-2 border border-slate-400 text-center">Total</td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {computed.totalLotEntraKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {computed.totalLotConsKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono text-emerald-800">
                                            {computed.totalLotSobraKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={4} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            <div className="flex items-center justify-between gap-2">
                                                <span>ATUALIZAÇÃO DA PRODUÇÃO (MARCAÇÕES DIÁRIAS)</span>
                                                <button
                                                    type="button"
                                                    onClick={reloadDailyUpdates}
                                                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase print:hidden cursor-pointer"
                                                    title="Sincronizar marcações com o Relatório Diário"
                                                >
                                                    {isSyncingDaily ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
                                                </button>
                                            </div>
                                        </th>
                                    </tr>
                                    <tr className="bg-[#2F5597] text-white font-bold uppercase text-[11px]">
                                        <th className="py-1 px-2 border border-slate-400 text-center">Qnt.</th>
                                        <th className="py-1 px-2 border border-slate-400 text-right">Peso (kg)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Média (kg/peça)</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyUpdates.length > 0 ? (
                                        dailyUpdates.map((u, idx) => (
                                            <tr key={u.isoDate || idx} className="hover:bg-slate-50">
                                                <td className="py-1 px-2 border border-slate-400 text-center font-black text-[#002060]">
                                                    {u.qty}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-right font-mono font-bold text-[#002060]">
                                                    {u.weightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-center font-mono text-slate-600">
                                                    {u.avgKgPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-center font-mono font-bold text-[#002060]">
                                                    {u.date}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                                                Sem apontamentos diários registrados.
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="bg-[#002060] text-white font-black">
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {totalDailyQty || op.actualProducedQuantity || 0}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {totalDailyWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {avgDailyWeightPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center uppercase text-[10px]">
                                            Total / Média
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// PAINEL DO OPERADOR NO APP:
// 1. Lote Ativo + Lote Reserva (Longitudinal & Transversal) com Peso e Saldo
// 2. Apontamento do Pacote (50 peças + Peso do Pacote) -> Calcula Bitola do Fio + Divide Peso Longitudinal e Transversal Automaticamente!
// ============================================================================
export const MalhaPackagesOperatorPanel: React.FC<{
    op: ProductionOrderData;
    stock: StockItem[];
    shiftReports?: ShiftReport[];
    machineName?: string;
}> = ({ op, stock, shiftReports = [], machineName = 'Malha 1' }) => {
    const [reportData, setReportData] = useState<MalhaPackagesReportData>(() => getSavedMalhaPackagesData(op, stock));
    const [showFullModal, setShowFullModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    // Estado para Fechar Novo Pacote de 50 Malhas + Peso do Pacote
    const [newPkgQty, setNewPkgQty] = useState<number>(50);
    const [newPkgWeight, setNewPkgWeight] = useState<string>('');
    const [newPkgTag, setNewPkgTag] = useState<string>('');
    const [validationError, setValidationError] = useState<{
        message: string;
        missingDir?: 'LONGITUDINAL' | 'TRANSVERSAL';
        missingSlot?: 'ACTIVE' | 'RESERVE';
    } | null>(null);

    // Estado para modal/painel rápido de seleção de lote (Ativo ou Reserva)
    const [pickerTarget, setPickerTarget] = useState<{
        dir: 'LONGITUDINAL' | 'TRANSVERSAL';
        slot: 'ACTIVE' | 'RESERVE';
    } | null>(null);
    const [pickerLotInput, setPickerLotInput] = useState<string>('');
    const [pickerWeightInput, setPickerWeightInput] = useState<string>('');
    const [pickerError, setPickerError] = useState<string | null>(null);
    const [showAllStockGauges, setShowAllStockGauges] = useState<boolean>(false);

    useEffect(() => {
        setReportData(getSavedMalhaPackagesData(op, stock));
    }, [op?.id, (op?.summary as any)?.malhaPackagesData?.updatedAt, (op?.summary as any)?.malhaActiveLots?.updatedAt]);

    const stockLotMap = useMemo(() => {
        const map = new Map<string, number>();
        (stock || []).forEach(item => {
            if (item && item.internalLot) {
                const clean = cleanLotCode(item.internalLot);
                const weight = Number(item.initialQuantity || item.remainingQuantity || 0);
                if (clean && weight > 0) {
                    map.set(clean.toLowerCase(), weight);
                }
            }
        });
        return map;
    }, [stock]);

    const computed = useMemo(
        () => computeMalhaPackagesAndLots(reportData.packages, reportData.techConfig, reportData.longLotsQueue, reportData.transLotsQueue),
        [reportData.packages, reportData.techConfig, reportData.longLotsQueue, reportData.transLotsQueue]
    );
    const panelPhysics = useMemo(
        () => calculateMalhaPhysics(reportData.techConfig, computed.effectiveBitola),
        [reportData.techConfig, computed.effectiveBitola]
    );
    const {
        dailyUpdates,
        totalDailyQty,
        totalDailyWeightKg,
        avgDailyWeightPerPiece,
        reloadDailyUpdates,
        isSyncingDaily
    } = useUnifiedMalhaDailyUpdates(op, shiftReports, panelPhysics.totalPesoUnit, true);
    const pendingPiecesToPackage = Math.max(0, totalDailyQty - computed.totalQuantity);

    // Conjunto de todos os lotes já cadastrados/utilizados nesta OP (Ativos, Reservas ou já Finalizados com Sobra 0)
    const usedLotCodesMap = useMemo(() => {
        const map = new Map<string, string>(); // lotCodeLower -> descrição de onde está sendo usado
        computed.longStatusList.forEach(item => {
            if (!item.lot) return;
            const label = item.roleStatus === 'CONSUMED'
                ? 'Já consumido (Sobra 0) no Longitudinal'
                : item.roleStatus === 'ACTIVE'
                    ? 'Já está ATIVO no Longitudinal'
                    : 'Já está na RESERVA do Longitudinal';
            map.set(cleanLotCode(item.lot).toLowerCase(), label);
        });
        computed.transStatusList.forEach(item => {
            if (!item.lot) return;
            const label = item.roleStatus === 'CONSUMED'
                ? 'Já consumido (Sobra 0) no Transversal'
                : item.roleStatus === 'ACTIVE'
                    ? 'Já está ATIVO no Transversal'
                    : 'Já está na RESERVA do Transversal';
            map.set(cleanLotCode(item.lot).toLowerCase(), label);
        });
        return map;
    }, [computed.longStatusList, computed.transStatusList]);

    const availableStockLots = useMemo(() => {
        const targetB = String(reportData.techConfig.bitola || 5).replace(',', '.');
        return (stock || [])
            .filter(item => {
                if (!item || !item.internalLot) return false;
                const st = String(item.status || '').toLowerCase();
                if (st.includes('consumido') || st.includes('sucata')) return false;
                const mat = String(item.materialType || '').toUpperCase();
                if (mat.includes('FIO MÁQUINA')) return false;
                // Não listar lotes que já foram usados/finalizados ou que já estão em operação/reserva na máquina
                const cLotLower = cleanLotCode(item.internalLot).toLowerCase();
                if (usedLotCodesMap.has(cLotLower)) return false;

                if (!showAllStockGauges) {
                    const itemB = parseFloat(String(item.bitola || '').replace(',', '.'));
                    const reqB = parseFloat(targetB);
                    if (!isNaN(itemB) && !isNaN(reqB) && Math.abs(itemB - reqB) > 0.25) return false;
                }
                if (pickerLotInput.trim()) {
                    return String(item.internalLot).toLowerCase().includes(pickerLotInput.trim().toLowerCase());
                }
                return true;
            })
            .sort((a, b) => String(b.internalLot).localeCompare(String(a.internalLot), undefined, { numeric: true }))
            .slice(0, 20);
    }, [stock, reportData.techConfig.bitola, showAllStockGauges, pickerLotInput, usedLotCodesMap]);

    // Simulação em tempo real do pacote que o operador está preenchendo agora (50 peças + Peso do Pacote)
    const livePreview = useMemo(
        () => calculateFromPackageWeight(parseFloat(newPkgWeight.replace(',', '.')) || 0, Number(newPkgQty) || 50, reportData.techConfig),
        [newPkgWeight, newPkgQty, reportData.techConfig]
    );

    const persistDataAndSyncActiveLots = async (nextData: MalhaPackagesReportData) => {
        setReportData(nextData);
        setSaveStatus('saving');

        const sim = computeMalhaPackagesAndLots(nextData.packages, nextData.techConfig, nextData.longLotsQueue, nextData.transLotsQueue);
        const currentActiveLong = sim.activeLongLot?.lot || nextData.longLotsQueue[nextData.longLotsQueue.length - 1]?.lot || '';
        const currentActiveTrans = sim.activeTransLot?.lot || nextData.transLotsQueue[nextData.transLotsQueue.length - 1]?.lot || '';

        const currentSummary: any = (op.summary && typeof op.summary === 'object') ? op.summary : {};
        const prevActiveLots = currentSummary.malhaActiveLots || {};
        const nextActiveLots = {
            ...prevActiveLots,
            longitudinal: currentActiveLong,
            transversal: currentActiveTrans,
            reserveLongitudinal: sim.reserveLongLot?.lot || '',
            reserveTransversal: sim.reserveTransLot?.lot || '',
            updatedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(`malha_active_lots_${machineName}_${op.id || 'default'}`, JSON.stringify(nextActiveLots));
            localStorage.setItem(`malha_packages_data_${op.id || op.orderNumber}`, JSON.stringify({ ...nextData, version: 2, updatedAt: new Date().toISOString() }));
        } catch (e) {}

        if (op.id) {
            try {
                const updatedSummary = {
                    ...currentSummary,
                    malhaActiveLots: nextActiveLots,
                    malhaPackagesData: {
                        ...nextData,
                        version: 2,
                        updatedAt: new Date().toISOString()
                    }
                };
                op.summary = updatedSummary;
                await updateItem('production_orders', op.id, {
                    summary: updatedSummary
                } as any);
            } catch (err) {
                console.warn('Erro ao sincronizar pacotes e lotes da malha:', err);
            }
        }
        setSaveStatus('saved');
    };

    const handleUpdateLotWeightInQueue = (dir: 'LONGITUDINAL' | 'TRANSVERSAL', lotId: string, newWeight: number) => {
        setValidationError(null);
        if (dir === 'LONGITUDINAL') {
            const nextQ = reportData.longLotsQueue.map(item => item.id === lotId ? { ...item, weight: newWeight } : item);
            persistDataAndSyncActiveLots({ ...reportData, longLotsQueue: nextQ });
        } else {
            const nextQ = reportData.transLotsQueue.map(item => item.id === lotId ? { ...item, weight: newWeight } : item);
            persistDataAndSyncActiveLots({ ...reportData, transLotsQueue: nextQ });
        }
    };

    const openLotPicker = (dir: 'LONGITUDINAL' | 'TRANSVERSAL', slot: 'ACTIVE' | 'RESERVE') => {
        const currentLotObj = dir === 'LONGITUDINAL'
            ? (slot === 'ACTIVE' ? computed.activeLongLot : computed.reserveLongLot)
            : (slot === 'ACTIVE' ? computed.activeTransLot : computed.reserveTransLot);

        setPickerTarget({ dir, slot });
        setPickerLotInput(currentLotObj?.lot || '');
        setPickerWeightInput(currentLotObj?.kgEntra ? String(currentLotObj.kgEntra) : '');
        setPickerError(null);
    };

    const handleConfirmPickerLot = () => {
        if (!pickerTarget) return;
        const cleanLot = cleanLotCode(pickerLotInput);
        if (!cleanLot) {
            setPickerError('⚠️ Informe o número do lote!');
            return;
        }

        const isLong = pickerTarget.dir === 'LONGITUDINAL';
        const currentActive = isLong ? computed.activeLongLot : computed.activeTransLot;
        const currentReserve = isLong ? computed.reserveLongLot : computed.reserveTransLot;
        const editingLotObj = pickerTarget.slot === 'ACTIVE' ? currentActive : currentReserve;

        // Bloquear se o operador tentar selecionar um lote que JÁ está em uso (Ativo/Reserva) ou JÁ foi consumido nesta OP!
        const existingUsage = usedLotCodesMap.get(cleanLot.toLowerCase());
        const isSameSlotEdit = editingLotObj && cleanLotCode(editingLotObj.lot).toLowerCase() === cleanLot.toLowerCase();
        if (existingUsage && !isSameSlotEdit) {
            setPickerError(`🚫 O Lote ${cleanLot} não pode ser selecionado novamente (${existingUsage})!`);
            return;
        }

        const autoWeight = stockLotMap.get(cleanLot.toLowerCase()) || 0;
        const weightVal = parseFloat(pickerWeightInput) || autoWeight || 0;
        if (weightVal <= 0) {
            setPickerError(`⚠️ Informe o Peso Inicial (kg) do Lote ${cleanLot}!`);
            return;
        }

        const queue = [...(isLong ? reportData.longLotsQueue : reportData.transLotsQueue)];

        if (pickerTarget.slot === 'ACTIVE') {
            if (currentActive && currentActive.cons > 0 && !isSameSlotEdit) {
                // Se o lote ativo atual já teve consumo parcial e o operador está trocando por um novo lote, adicionar na fila
                queue.push({ id: `q-${Date.now()}`, lot: cleanLot, weight: weightVal, addedAt: new Date().toISOString() });
            } else if (currentActive) {
                const idx = queue.findIndex(q => q.id === currentActive.id);
                if (idx >= 0) {
                    queue[idx] = { ...queue[idx], lot: cleanLot, weight: weightVal };
                } else {
                    queue.push({ id: `q-${Date.now()}`, lot: cleanLot, weight: weightVal, addedAt: new Date().toISOString() });
                }
            } else {
                queue.push({ id: `q-${Date.now()}`, lot: cleanLot, weight: weightVal, addedAt: new Date().toISOString() });
            }
        } else {
            if (currentReserve) {
                const idx = queue.findIndex(q => q.id === currentReserve.id);
                if (idx >= 0) {
                    queue[idx] = { ...queue[idx], lot: cleanLot, weight: weightVal };
                } else {
                    queue.push({ id: `q-${Date.now()}`, lot: cleanLot, weight: weightVal, addedAt: new Date().toISOString() });
                }
            } else {
                queue.push({ id: `q-${Date.now()}`, lot: cleanLot, weight: weightVal, addedAt: new Date().toISOString() });
            }
        }

        const nextData: MalhaPackagesReportData = {
            ...reportData,
            longLotsQueue: isLong ? queue : reportData.longLotsQueue,
            transLotsQueue: !isLong ? queue : reportData.transLotsQueue
        };

        persistDataAndSyncActiveLots(nextData);
        setPickerTarget(null);
        setPickerError(null);
        setValidationError(null);
    };

    const handleConfirmNewPackage = () => {
        const parsedWeight = parseFloat(newPkgWeight.replace(',', '.'));
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            setValidationError({
                message: '⚠️ Informe o Peso do Pacote (kg) que deu na balança antes de confirmar!'
            });
            return;
        }

        const activeLong = computed.activeLongLot;
        const reserveLong = computed.reserveLongLot;
        const activeTrans = computed.activeTransLot;
        const reserveTrans = computed.reserveTransLot;

        // 1. Verificar se existe Lote Ativo Longitudinal com peso informado
        if (!activeLong || !activeLong.lot || activeLong.kgEntra <= 0) {
            setValidationError({
                message: '🚫 Informe o LOTE ATIVO LONGITUDINAL e o seu Peso (kg) antes de fechar o pacote!',
                missingDir: 'LONGITUDINAL',
                missingSlot: 'ACTIVE'
            });
            return;
        }

        // 2. Verificar se existe Lote Ativo Transversal com peso informado
        if (!activeTrans || !activeTrans.lot || activeTrans.kgEntra <= 0) {
            setValidationError({
                message: '🚫 Informe o LOTE ATIVO TRANSVERSAL e o seu Peso (kg) antes de fechar o pacote!',
                missingDir: 'TRANSVERSAL',
                missingSlot: 'ACTIVE'
            });
            return;
        }

        const neededLong = livePreview.longKgCons;
        const neededTrans = livePreview.transKgCons;

        // 3. Verificar se o saldo do Lote Ativo Longitudinal dá para abater ou se exige Lote Reserva Longitudinal
        if (neededLong > activeLong.sobra + 0.05) {
            const deficitLong = neededLong - activeLong.sobra;
            if (!reserveLong || !reserveLong.lot || reserveLong.kgEntra <= 0) {
                setValidationError({
                    message: `🚫 SALDO INSUFICIENTE NO FIO LONGITUDINAL! O Lote Ativo (${activeLong.lot}) só tem ${activeLong.sobra.toFixed(1)} kg restantes e este pacote precisa de ${neededLong.toFixed(1)} kg (faltam ${deficitLong.toFixed(1)} kg). Selecione o LOTE RESERVA Longitudinal e informe o peso dele antes de continuar!`,
                    missingDir: 'LONGITUDINAL',
                    missingSlot: 'RESERVE'
                });
                return;
            }
            const totalAvailableLong = activeLong.sobra + reserveLong.sobra;
            if (neededLong > totalAvailableLong + 0.05) {
                setValidationError({
                    message: `🚫 PESO INSUFICIENTE NO FIO LONGITUDINAL! Somando o Lote Ativo (${activeLong.sobra.toFixed(1)} kg) + Lote Reserva ${reserveLong.lot} (${reserveLong.sobra.toFixed(1)} kg) temos ${totalAvailableLong.toFixed(1)} kg, mas o pacote precisa de ${neededLong.toFixed(1)} kg. Verifique o peso do Lote Reserva!`,
                    missingDir: 'LONGITUDINAL',
                    missingSlot: 'RESERVE'
                });
                return;
            }
        }

        // 4. Verificar se o saldo do Lote Ativo Transversal dá para abater ou se exige Lote Reserva Transversal
        if (neededTrans > activeTrans.sobra + 0.05) {
            const deficitTrans = neededTrans - activeTrans.sobra;
            if (!reserveTrans || !reserveTrans.lot || reserveTrans.kgEntra <= 0) {
                setValidationError({
                    message: `🚫 SALDO INSUFICIENTE NO FIO TRANSVERSAL! O Lote Ativo (${activeTrans.lot}) só tem ${activeTrans.sobra.toFixed(1)} kg restantes e este pacote precisa de ${neededTrans.toFixed(1)} kg (faltam ${deficitTrans.toFixed(1)} kg). Selecione o LOTE RESERVA Transversal e informe o peso dele antes de continuar!`,
                    missingDir: 'TRANSVERSAL',
                    missingSlot: 'RESERVE'
                });
                return;
            }
            const totalAvailableTrans = activeTrans.sobra + reserveTrans.sobra;
            if (neededTrans > totalAvailableTrans + 0.05) {
                setValidationError({
                    message: `🚫 PESO INSUFICIENTE NO FIO TRANSVERSAL! Somando o Lote Ativo (${activeTrans.sobra.toFixed(1)} kg) + Lote Reserva ${reserveTrans.lot} (${reserveTrans.sobra.toFixed(1)} kg) temos ${totalAvailableTrans.toFixed(1)} kg, mas o pacote precisa de ${neededTrans.toFixed(1)} kg. Verifique o peso do Lote Reserva!`,
                    missingDir: 'TRANSVERSAL',
                    missingSlot: 'RESERVE'
                });
                return;
            }
        }

        setValidationError(null);
        const nextNum = reportData.packages.length + 1;
        const newPkg: MalhaPackageRow = {
            id: `mpkg-${Date.now()}`,
            packageCode: `p${nextNum}`,
            finishedLotNumber: newPkgTag.trim(),
            quantity: Number(newPkgQty) || 50,
            measuredPackageWeight: parsedWeight,
            longLot: '',
            longLotWeight: 0,
            transLot: '',
            transLotWeight: 0,
            confirmed: true,
            recordedAt: new Date().toISOString()
        };

        persistDataAndSyncActiveLots({
            ...reportData,
            packages: [...reportData.packages, newPkg]
        });
        setNewPkgTag('');
        setNewPkgWeight('');
        setNewPkgQty(50);
    };

    const handleUpdatePackageField = (id: string, field: 'finishedLotNumber' | 'quantity' | 'measuredPackageWeight', value: any) => {
        const nextPackages = reportData.packages.map(p => p.id === id ? { ...p, [field]: value } : p);
        persistDataAndSyncActiveLots({ ...reportData, packages: nextPackages });
    };

    const handleRemovePackage = (id: string) => {
        const filtered = reportData.packages
            .filter(p => p.id !== id)
            .map((p, idx) => ({ ...p, packageCode: `p${idx + 1}` }));
        persistDataAndSyncActiveLots({ ...reportData, packages: filtered });
    };

    const nextPackageNumber = reportData.packages.length + 1;

    const renderDirectionSupplyCard = (dir: 'LONGITUDINAL' | 'TRANSVERSAL') => {
        const isLong = dir === 'LONGITUDINAL';
        const activeItem = isLong ? computed.activeLongLot : computed.activeTransLot;
        const reserveItem = isLong ? computed.reserveLongLot : computed.reserveTransLot;
        const consumedHistory = (isLong ? computed.longStatusList : computed.transStatusList).filter(x => x.roleStatus === 'CONSUMED');
        const packageNeedKg = isLong ? livePreview.longKgCons : livePreview.transKgCons;

        const willSplitNextPackage =
            activeItem &&
            activeItem.kgEntra > 0 &&
            activeItem.sobra > 0 &&
            activeItem.sobra < packageNeedKg;

        const pctRemaining = activeItem && activeItem.kgEntra > 0
            ? Math.max(0, Math.min(100, (activeItem.sobra / activeItem.kgEntra) * 100))
            : 0;

        return (
            <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm space-y-3 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                            isLong ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                        }`}>
                            {isLong ? '↔️ Fio Longitudinal' : '↕️ Fio Transversal'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Ø {computed.effectiveBitola.toFixed(2).replace('.', ',')}mm
                        </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                        ~{packageNeedKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg / pct
                    </span>
                </div>

                {/* 1. SLOT LOTE ATIVO (EM MÁQUINA) */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border-2 border-emerald-300 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>🟢 1º Lote Ativo (Em Máquina)</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => openLotPicker(dir, 'ACTIVE')}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase cursor-pointer transition active:scale-95"
                        >
                            {activeItem ? '🔄 Trocar Lote' : '+ Selecionar Lote'}
                        </button>
                    </div>

                    {activeItem ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 items-end">
                                <div>
                                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                        Lote em Operação
                                    </span>
                                    <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                                        LOTE {activeItem.lot}
                                    </span>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-emerald-800 block mb-0.5">
                                        ⚖️ Peso do Lote (kg) *
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={activeItem.kgEntra || ''}
                                        onChange={e => handleUpdateLotWeightInQueue(dir, activeItem.id, parseFloat(e.target.value) || 0)}
                                        placeholder="Ex: 2075"
                                        className="w-full px-2.5 py-1.5 rounded-lg border-2 border-emerald-400 bg-white font-mono font-black text-sm text-slate-900 outline-none focus:border-emerald-600 text-center"
                                    />
                                </div>
                            </div>

                            {activeItem.kgEntra > 0 ? (
                                <div className="space-y-1.5 pt-1">
                                    <div className="grid grid-cols-3 gap-1.5 text-center bg-white/90 p-2 rounded-xl border border-emerald-200">
                                        <div>
                                            <span className="text-[8px] font-black uppercase text-slate-400 block">Peso Inicial</span>
                                            <span className="text-xs font-mono font-bold text-slate-700">{activeItem.kgEntra.toFixed(0)} kg</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black uppercase text-rose-500 block">Já Abatido</span>
                                            <span className="text-xs font-mono font-bold text-rose-600">-{activeItem.cons.toFixed(0)} kg</span>
                                        </div>
                                        <div className="bg-emerald-100/80 rounded-lg py-0.5 px-1">
                                            <span className="text-[8px] font-black uppercase text-emerald-800 block">Sobrou (Saldo)</span>
                                            <span className={`text-xs sm:text-sm font-mono font-black ${activeItem.sobra < packageNeedKg ? 'text-amber-700' : 'text-emerald-800'}`}>
                                                {activeItem.sobra.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-emerald-200/70 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                activeItem.sobra < packageNeedKg ? 'bg-amber-500' : 'bg-emerald-600'
                                            }`}
                                            style={{ width: `${pctRemaining}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                                    👆 Digite o Peso do Lote {activeItem.lot} acima (ex: 2075 kg) para o sistema abater sozinho!
                                </p>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => openLotPicker(dir, 'ACTIVE')}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-emerald-400 text-emerald-700 font-black text-xs uppercase hover:bg-emerald-100/50 transition cursor-pointer"
                        >
                            + Definir Lote Ativo ({dir})
                        </button>
                    )}
                </div>

                {/* 2. SLOT LOTE RESERVA (PRÓXIMO A ENTRAR) */}
                <div className={`p-3 rounded-xl border-2 space-y-2 ${
                    willSplitNextPackage
                        ? 'bg-amber-50 border-amber-400 shadow-sm'
                        : 'bg-slate-50 border-slate-200 border-dashed'
                }`}>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                            <span>🟡 2º Lote Reserva (Próximo da Fila)</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => openLotPicker(dir, 'RESERVE')}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase cursor-pointer transition active:scale-95"
                        >
                            {reserveItem ? '✏️ Trocar Reserva' : '+ Lote Reserva'}
                        </button>
                    </div>

                    {willSplitNextPackage && (
                        <div className="p-2 rounded-lg bg-amber-200/70 border border-amber-400 text-[10px] font-bold text-amber-950 leading-snug">
                            ⚡ O Lote Ativo ({activeItem?.lot}) tem <strong>{activeItem?.sobra.toFixed(0)} kg</strong> e o próximo pacote precisa de <strong>{packageNeedKg.toFixed(0)} kg</strong>.
                            {reserveItem
                                ? ` Vai usar ${activeItem?.sobra.toFixed(0)} kg do Lote ${activeItem?.lot} + ${(packageNeedKg - (activeItem?.sobra || 0)).toFixed(0)} kg do Reserva (Lote ${reserveItem.lot})!`
                                : ` Cadastre o Lote Reserva abaixo para abater os ${(packageNeedKg - (activeItem?.sobra || 0)).toFixed(0)} kg restantes!`}
                        </div>
                    )}

                    {reserveItem ? (
                        <div className="grid grid-cols-2 gap-2 items-end">
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-500 block">
                                    Próximo Lote Engatilhado
                                </span>
                                <span className="text-base sm:text-lg font-black font-mono text-slate-800">
                                    LOTE {reserveItem.lot}
                                </span>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase text-amber-900 block mb-0.5">
                                    ⚖️ Peso Reserva (kg) *
                                </label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={reserveItem.kgEntra || ''}
                                    onChange={e => handleUpdateLotWeightInQueue(dir, reserveItem.id, parseFloat(e.target.value) || 0)}
                                    placeholder="Ex: 2066"
                                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-amber-400 bg-white font-mono font-black text-sm text-slate-900 outline-none focus:border-amber-600 text-center"
                                />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 italic">
                            Nenhum lote reserva engatilhado. Clique em <strong>+ Lote Reserva</strong> para deixar o próximo rolo pronto.
                        </p>
                    )}
                </div>

                {consumedHistory.length > 0 && (
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase text-slate-400">Lotes finalizados (Sobra 0):</span>
                        {consumedHistory.map(h => (
                            <span key={h.id} className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-mono font-bold text-slate-600">
                                Lote {h.lot} ({h.kgEntra.toFixed(0)}kg ✓)
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4 w-full max-w-full overflow-hidden text-left">
            {/* BLOCO 1: ABASTECIMENTO DE LOTES (ATIVO + RESERVA) */}
            <div className="bg-slate-100/80 p-3.5 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                            <span>🔄 1. Lotes na Máquina (Ativo & Reserva)</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Aponte apenas o Lote Ativo e o Reserva com seus pesos. O sistema abate automaticamente conforme você pesa os pacotes!
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            {saveStatus === 'saved' ? '✓ Sincronizado' : 'Salvando...'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowFullModal(true)}
                            className="px-3 py-1.5 rounded-xl bg-[#1F3864] hover:bg-[#2F5597] text-white font-black text-[11px] uppercase tracking-wider transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                            <span>📊</span>
                            <span>Relatório Completo</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {renderDirectionSupplyCard('LONGITUDINAL')}
                    {renderDirectionSupplyCard('TRANSVERSAL')}
                </div>
            </div>

            {/* MODAL/PAINEL DE SELEÇÃO DE LOTE (ATIVO OU RESERVA) */}
            {pickerTarget && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white border-2 border-amber-400 space-y-3 shadow-xl animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            {pickerTarget.slot === 'ACTIVE'
                                ? `🟢 Selecionar Lote ATIVO • FIO ${pickerTarget.dir}`
                                : `🟡 Selecionar Lote RESERVA (Próximo) • FIO ${pickerTarget.dir}`}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPickerTarget(null)}
                            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-0.5"
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
                                value={pickerLotInput}
                                onChange={e => {
                                    const val = e.target.value;
                                    setPickerLotInput(val);
                                    setPickerError(null);
                                    const foundW = stockLotMap.get(cleanLotCode(val).toLowerCase());
                                    if (foundW) setPickerWeightInput(String(foundW));
                                }}
                                placeholder="Ex: 7505"
                                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-amber-400/60 text-sm font-mono font-black text-white outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-emerald-300 block mb-1">
                                Peso do Lote (kg) *
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                value={pickerWeightInput}
                                onChange={e => {
                                    setPickerWeightInput(e.target.value);
                                    setPickerError(null);
                                }}
                                placeholder="Ex: 2075"
                                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-400/60 text-sm font-mono font-black text-emerald-300 outline-none"
                            />
                        </div>
                    </div>

                    {pickerError && (
                        <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-500 text-rose-200 text-xs font-black">
                            {pickerError}
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">
                                Ou toque num lote do estoque abaixo (já preenche o peso):
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowAllStockGauges(!showAllStockGauges)}
                                className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-cyan-300"
                            >
                                {showAllStockGauges ? 'Mostrando Todos' : 'Ver Todas Bitolas'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-1 bg-black/40 rounded-xl">
                            {availableStockLots.map(item => {
                                const cLot = cleanLotCode(item.internalLot);
                                const wKg = Number(item.initialQuantity || item.remainingQuantity || 0);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setPickerLotInput(cLot);
                                            if (wKg > 0) setPickerWeightInput(String(wKg));
                                        }}
                                        className={`p-2 rounded-lg border text-left transition active:scale-95 cursor-pointer flex flex-col ${
                                            cleanLotCode(pickerLotInput) === cLot
                                                ? 'bg-amber-500/20 border-amber-400'
                                                : 'bg-slate-950 border-white/10 hover:border-amber-400'
                                        }`}
                                    >
                                        <span className="text-xs font-black font-mono text-white truncate">Lote {cLot}</span>
                                        <span className="text-[9px] font-mono text-emerald-300 truncate">
                                            {item.bitola}mm • {wKg > 0 ? `${wKg.toFixed(0)} kg` : 'S/ peso'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setPickerTarget(null)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmPickerLot}
                            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer"
                        >
                            ✓ Salvar Lote & Peso
                        </button>
                    </div>
                </div>
            )}

            {/* BLOCO 2: FECHAR PACOTE DE 50 MALHAS + PESO DO PACOTE -> CALCULA BITOLA E PESOS LONG/TRANS AUTOMATICAMENTE */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-black uppercase text-slate-800">
                                ⚖️ 2. Apontar Peso do Pacote (50 Malhas)
                            </h3>
                            <span className="text-xs font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                {reportData.packages.length} pacotes • {computed.totalQuantity} malhas • {computed.totalWeightKg.toFixed(0)} kg
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Digite o <strong>Peso do Pacote</strong> que deu na balança: o sistema descobre sozinho a <strong>Bitola Real do fio (mm)</strong> e calcula quanto descontar do <strong>Longitudinal</strong> e do <strong>Transversal</strong>!
                        </p>
                    </div>
                </div>

                {/* Card de Lançamento Rápido com Calculadora Ao Vivo */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0F2437] to-slate-900 text-white space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black font-mono text-sm uppercase">
                                PACOTE P{nextPackageNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-300">
                                Informe o peso do pacote para converter automaticamente
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                        <div>
                            <label className="text-[9px] font-black uppercase text-emerald-300 block mb-1">
                                ⚖️ Peso do Pacote (kg) *
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={newPkgWeight}
                                onChange={e => setNewPkgWeight(e.target.value)}
                                placeholder={`Ex: ${livePreview.packageWeightKg.toFixed(0)}`}
                                className="w-full px-3 py-2.5 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200 font-mono font-black text-base text-center outline-none focus:border-emerald-300"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                Qtd. Malhas
                            </label>
                            <input
                                type="number"
                                value={newPkgQty}
                                onChange={e => setNewPkgQty(parseInt(e.target.value, 10) || 0)}
                                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono font-black text-sm text-center outline-none focus:border-amber-400"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                                Nº Etiqueta (Opcional)
                            </label>
                            <input
                                type="text"
                                value={newPkgTag}
                                onChange={e => setNewPkgTag(e.target.value)}
                                placeholder="Ex: 88846"
                                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono font-bold text-sm text-center outline-none focus:border-amber-400"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirmNewPackage}
                            className="col-span-2 sm:col-span-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>✅</span>
                            <span>Confirmar P{nextPackageNumber}</span>
                        </button>
                    </div>

                    {/* Alerta de Bloqueio quando faltar Lote Reserva ou Peso */}
                    {validationError && (
                        <div className="p-3.5 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 space-y-2.5 animate-fade-in">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-black leading-relaxed text-rose-200">
                                    {validationError.message}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setValidationError(null)}
                                    className="text-xs font-bold text-rose-300 hover:text-white px-1.5 shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                            {validationError.missingDir && validationError.missingSlot && (
                                <button
                                    type="button"
                                    onClick={() => openLotPicker(validationError.missingDir!, validationError.missingSlot!)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <span>🟡</span>
                                    <span>
                                        {validationError.missingSlot === 'RESERVE'
                                            ? `+ Selecionar Lote Reserva (${validationError.missingDir}) Agora`
                                            : `+ Selecionar Lote Ativo (${validationError.missingDir}) Agora`}
                                    </span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Faixa de Resultado Automático da Conversão (Bitola que deu no fio + Peso Longitudinal + Peso Transversal) */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-[9px] font-black uppercase text-amber-300 block">
                                📏 Bitola que deu no fio
                            </span>
                            <span className="text-sm sm:text-base font-black font-mono text-white">
                                {livePreview.calculatedBitola.toFixed(2).replace('.', ',')} mm
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                                {livePreview.calculatedMassaLinear.toFixed(5).replace('.', ',')} kg/m
                            </span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/30">
                            <span className="text-[9px] font-black uppercase text-amber-300 block">
                                ↔️ Peso Longitudinal
                            </span>
                            <span className="text-sm sm:text-base font-black font-mono text-amber-200">
                                {livePreview.longKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                                ({livePreview.unitLongWeight.toFixed(2).replace('.', ',')} kg/malha)
                            </span>
                        </div>
                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-400/30">
                            <span className="text-[9px] font-black uppercase text-cyan-300 block">
                                ↕️ Peso Transversal
                            </span>
                            <span className="text-sm sm:text-base font-black font-mono text-cyan-200">
                                {livePreview.transKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 block">
                                ({livePreview.unitTransWeight.toFixed(2).replace('.', ',')} kg/malha)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Lista de Cards dos Pacotes Já Confirmados */}
                {computed.computedRows.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {computed.computedRows.map((row) => {
                            const usedTwoLong = row.longSplits.length > 1;
                            const usedTwoTrans = row.transSplits.length > 1;

                            return (
                                <div
                                    key={row.id}
                                    className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-2.5 flex flex-col justify-between"
                                >
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2.5 py-1 rounded-lg bg-[#1F3864] text-white font-black font-mono text-xs uppercase">
                                                {row.packageCode.toUpperCase()}
                                            </span>
                                            <span className="text-xs font-black text-slate-800">
                                                {row.quantity} pçs
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-black">
                                                📏 Bitola: {row.calculatedBitola.toFixed(2).replace('.', ',')} mm
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                value={row.finishedLotNumber}
                                                onChange={e => handleUpdatePackageField(row.id, 'finishedLotNumber', e.target.value)}
                                                placeholder="Etiqueta..."
                                                className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono font-bold text-center text-slate-800 outline-none"
                                                title="Etiqueta do pacote pronto"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePackage(row.id)}
                                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer"
                                                title="Excluir pacote"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    {/* Campo para ajustar ou informar o Peso do Pacote na Balança */}
                                    <div className="flex items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 rounded-xl">
                                        <span className="text-[10px] font-black uppercase text-emerald-900">
                                            ⚖️ Peso do Pacote (kg):
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={row.measuredPackageWeight ?? ''}
                                                onChange={e => handleUpdatePackageField(row.id, 'measuredPackageWeight', parseFloat(e.target.value) || null)}
                                                placeholder={row.packageWeightKg.toFixed(1)}
                                                className="w-24 px-2 py-1 rounded-lg border border-emerald-400 bg-white font-mono font-black text-xs text-center text-slate-900 outline-none"
                                            />
                                            <span className="text-[10px] font-mono font-bold text-emerald-800">kg</span>
                                        </div>
                                    </div>

                                    {/* Resumo Automático do Desconto Longitudinal */}
                                    <div className={`p-2 rounded-xl border text-[11px] ${
                                        usedTwoLong ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
                                    }`}>
                                        <div className="flex items-center justify-between font-bold text-slate-700">
                                            <span>↔️ Longitudinal (-{row.longKgCons.toFixed(1)} kg):</span>
                                            {usedTwoLong && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                                                    Usou 2 Lotes (Ativo + Reserva)
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 space-y-0.5 font-mono text-[10px]">
                                            {row.longSplits.map((sp, i) => (
                                                <div key={i} className="flex items-center justify-between text-slate-600">
                                                    <span>
                                                        • Lote <strong>{sp.lot}</strong>: abateu <strong>{sp.consumedKg.toFixed(1)} kg</strong>
                                                    </span>
                                                    <span className={sp.exhausted ? 'text-rose-600 font-black' : 'text-emerald-700 font-bold'}>
                                                        {sp.exhausted && sp.balanceAfterKg === 0
                                                            ? 'Zerou (0 kg)'
                                                            : `Restou ${sp.balanceAfterKg.toFixed(1)} kg`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Resumo Automático do Desconto Transversal */}
                                    <div className={`p-2 rounded-xl border text-[11px] ${
                                        usedTwoTrans ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
                                    }`}>
                                        <div className="flex items-center justify-between font-bold text-slate-700">
                                            <span>↕️ Transversal (-{row.transKgCons.toFixed(1)} kg):</span>
                                            {usedTwoTrans && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                                                    Usou 2 Lotes (Ativo + Reserva)
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 space-y-0.5 font-mono text-[10px]">
                                            {row.transSplits.map((sp, i) => (
                                                <div key={i} className="flex items-center justify-between text-slate-600">
                                                    <span>
                                                        • Lote <strong>{sp.lot}</strong>: abateu <strong>{sp.consumedKg.toFixed(1)} kg</strong>
                                                    </span>
                                                    <span className={sp.exhausted ? 'text-rose-600 font-black' : 'text-emerald-700 font-bold'}>
                                                        {sp.exhausted && sp.balanceAfterKg === 0
                                                            ? 'Zerou (0 kg)'
                                                            : `Restou ${sp.balanceAfterKg.toFixed(1)} kg`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-xs">
                        Nenhum pacote de 50 malhas fechado ainda. Digite o <strong>Peso do Pacote (kg)</strong> acima e confirme o <strong>Pacote P1</strong>!
                    </div>
                )}
            </div>

            {/* BLOCO 3: MARCAÇÕES DIÁRIAS DE PRODUÇÃO (SINCRONIZADO COM RELATÓRIO DIÁRIO) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm sm:text-base font-black uppercase text-[#002060] flex items-center gap-2">
                            <span>📅 3. Atualização da Produção (Marcações Diárias)</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Todas as marcações diárias da OP sincronizadas com o Relatório Diário e comparadas com os pacotes pesados.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {totalDailyQty > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#002060] border border-blue-200 text-[11px] font-mono font-black">
                                Produzido: {totalDailyQty} pçs • Em Pacotes: {computed.totalQuantity} pçs
                            </span>
                        )}
                        {pendingPiecesToPackage > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-mono font-black">
                                Saldo p/ Pacote: {pendingPiecesToPackage} pçs
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={reloadDailyUpdates}
                            className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
                        >
                            {isSyncingDaily ? '⏳ Sincronizando...' : '🔄 Sincronizar OP'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-[#002060] rounded-xl">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-[#002060] text-white text-[10px] font-black uppercase">
                                <th className="py-2 px-3 border-r border-slate-700 text-center w-1/4">Qnt.</th>
                                <th className="py-2 px-3 border-r border-slate-700 text-center w-1/4">Peso (kg)</th>
                                <th className="py-2 px-3 border-r border-slate-700 text-center w-1/4">Média (kg/peça)</th>
                                <th className="py-2 px-3 text-center w-1/4">Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyUpdates.length > 0 ? (
                                dailyUpdates.map((u, idx) => (
                                    <tr key={u.isoDate || idx} className="border-b border-slate-200 hover:bg-slate-50 font-bold text-[#002060]">
                                        <td className="py-2 px-3 border-r border-slate-200 text-center font-black">
                                            {u.qty}
                                        </td>
                                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">
                                            {u.weightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-600">
                                            {u.avgKgPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono font-black">
                                            {u.date}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                                        Nenhuma marcação diária registrada para esta OP ainda.
                                    </td>
                                </tr>
                            )}
                            <tr className="bg-[#002060] text-white font-black">
                                <td className="py-2 px-3 border-r border-slate-700 text-center font-mono">
                                    {totalDailyQty || op.actualProducedQuantity || 0}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-700 text-center font-mono">
                                    {totalDailyWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-700 text-center font-mono">
                                    {avgDailyWeightPerPiece.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-3 text-center uppercase text-[10px]">
                                    Total / Média
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {showFullModal && (
                <MalhaConsumptionReportModal
                    isOpen={showFullModal}
                    onClose={() => setShowFullModal(false)}
                    op={op}
                    stock={stock}
                    shiftReports={shiftReports}
                />
            )}
        </div>
    );
};

export default MalhaConsumptionReportModal;
