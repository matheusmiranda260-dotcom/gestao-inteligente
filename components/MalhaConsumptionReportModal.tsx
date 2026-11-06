import React, { useState, useMemo, useEffect } from 'react';
import type { ProductionOrderData, StockItem, ShiftReport } from '../types';
import { DefaultMalhaGauges } from '../types';
import { updateItem } from '../services/supabaseService';

export interface MalhaPackageRow {
    id: string;
    packageCode: string; // p1, p2, p3...
    finishedLotNumber: string; // Ex: 88846, 88849...
    quantity: number; // Padrão: 50 malhas
    measuredPackageWeight?: number | null; // Peso real na balança (opcional)
    longLot: string; // Ex: 7594
    longLotWeight: number; // Ex: 2075
    transLot: string; // Ex: 7804
    transLotWeight: number; // Ex: 2071
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
    techConfig: MalhaTechnicalConfig;
    packages: MalhaPackageRow[];
    updatedAt?: string;
}

export const inferDefaultMalhaTechConfig = (op?: ProductionOrderData | null): MalhaTechnicalConfig => {
    const desc = String(op?.malhaModel || (op as any)?.malha_model || op?.productDescription || '').toUpperCase();
    const rawBitola = String(op?.targetBitola || (op as any)?.target_bitola || '').replace(',', '.').trim();

    let bitola = parseFloat(rawBitola);
    if (isNaN(bitola) || bitola <= 0) {
        const matched = DefaultMalhaGauges.find(g => desc.includes(g.code.toUpperCase()) || desc.includes(g.description.toUpperCase()));
        if (matched) {
            bitola = parseFloat(matched.longitudinal.replace(',', '.')) || 5.0;
        } else if (desc.includes('4,2') || desc.includes('4.2')) {
            bitola = 4.2;
        } else if (desc.includes('3,4') || desc.includes('3.4')) {
            bitola = 3.4;
        } else {
            bitola = 4.9;
        }
    }

    // Inferir espaçamento (10x10 vs 15x15) e dimensões (6,00 x 2,45)
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

export const getSavedMalhaPackagesData = (op?: ProductionOrderData | null): MalhaPackagesReportData => {
    const defaultTech = inferDefaultMalhaTechConfig(op);
    if (!op) {
        return { techConfig: defaultTech, packages: [] };
    }

    const summary: any = op.summary || {};
    const saved = summary.malhaPackagesData || summary.malha_packages_data;

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

    if (source && Array.isArray(source.packages) && source.packages.length > 0) {
        const rawTech = source.techConfig || source.tech_config || {};
        const techConfig: MalhaTechnicalConfig = {
            bitola: Number(rawTech.bitola ?? defaultTech.bitola) || defaultTech.bitola,
            longQnt: Number(rawTech.longQnt ?? rawTech.long_qnt ?? defaultTech.longQnt) || defaultTech.longQnt,
            longTam: Number(rawTech.longTam ?? rawTech.long_tam ?? defaultTech.longTam) || defaultTech.longTam,
            transQnt: Number(rawTech.transQnt ?? rawTech.trans_qnt ?? defaultTech.transQnt) || defaultTech.transQnt,
            transTam: Number(rawTech.transTam ?? rawTech.trans_tam ?? defaultTech.transTam) || defaultTech.transTam,
            defaultQtyPerPackage: Number(rawTech.defaultQtyPerPackage ?? rawTech.default_qty_per_package ?? 50) || 50
        };

        const packages: MalhaPackageRow[] = source.packages.map((p: any, idx: number) => ({
            id: p.id || `mpkg-${idx + 1}`,
            packageCode: p.packageCode || p.package_code || `p${idx + 1}`,
            finishedLotNumber: String(p.finishedLotNumber ?? p.finished_lot_number ?? ''),
            quantity: Number(p.quantity ?? 50) || 50,
            measuredPackageWeight: p.measuredPackageWeight ?? p.measured_package_weight ?? null,
            longLot: String(p.longLot ?? p.long_lot ?? ''),
            longLotWeight: Number(p.longLotWeight ?? p.long_lot_weight ?? 0) || 0,
            transLot: String(p.transLot ?? p.trans_lot ?? ''),
            transLotWeight: Number(p.transLotWeight ?? p.trans_lot_weight ?? 0) || 0,
            recordedAt: p.recordedAt || p.recorded_at,
            operator: p.operator
        }));

        return {
            techConfig,
            packages,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    // Se ainda não houver pacotes salvos, gerar pacotes iniciais de 50 malhas com base na meta ou quantidade produzida
    const activeLots = summary.malhaActiveLots || summary.malha_active_lots || {};
    const totalProduced = Number(op.actualProducedQuantity || 0);
    const numInitialPackages = Math.max(4, Math.ceil((totalProduced || 200) / 50));

    const initialPackages: MalhaPackageRow[] = Array.from({ length: numInitialPackages }, (_, idx) => ({
        id: `mpkg-${idx + 1}`,
        packageCode: `p${idx + 1}`,
        finishedLotNumber: '',
        quantity: 50,
        measuredPackageWeight: null,
        longLot: idx === 0 ? String(activeLots.longitudinal || '') : '',
        longLotWeight: 0,
        transLot: idx === 0 ? String(activeLots.transversal || '') : '',
        transLotWeight: 0
    }));

    return {
        techConfig: defaultTech,
        packages: initialPackages
    };
};

export const saveMalhaPackagesData = async (op: ProductionOrderData, data: MalhaPackagesReportData) => {
    const payload: MalhaPackagesReportData = {
        ...data,
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

export const calculateMalhaPhysics = (techConfig: MalhaTechnicalConfig) => {
    // Massa linear (kg/m): bitola^2 * 0.006162 (mesma constante física exata da planilha: 4,9^2 * 0,006162 = 0,14794962 kg/m)
    const massaLinear = (techConfig.bitola ** 2) * 0.006162;
    const longLinear = techConfig.longQnt * techConfig.longTam; // Ex: 25 * 6 = 150 m
    const transLinear = techConfig.transQnt * techConfig.transTam; // Ex: 60 * 2.45 = 147 m
    const totalLinear = longLinear + transLinear; // Ex: 297 m

    const longPesoUnit = longLinear * massaLinear; // Ex: 150 * 0.14794962 = 22.19244 kg
    const transPesoUnit = transLinear * massaLinear; // Ex: 147 * 0.14794962 = 21.74859 kg
    const totalPesoUnit = longPesoUnit + transPesoUnit; // Ex: 43.94104 kg

    return {
        massaLinear,
        longLinear,
        transLinear,
        totalLinear,
        longPesoUnit,
        transPesoUnit,
        totalPesoUnit
    };
};

export interface ComputedPackageRow extends MalhaPackageRow {
    longKgCons: number;
    longPesoInicial: number; // Saldo calculado na linha (igual à coluna PESO INICIAL da planilha)
    transKgCons: number;
    transPesoInicial: number;
}

export interface ConsumedLotSummaryRow {
    direction: 'LONGITUDINAL' | 'TRANSVERSAL';
    lot: string;
    kgEntra: number;
    cons: number;
    sobra: number;
}

export const computeMalhaPackagesAndLots = (
    packages: MalhaPackageRow[],
    techConfig: MalhaTechnicalConfig
): {
    computedRows: ComputedPackageRow[];
    consumedLots: ConsumedLotSummaryRow[];
    totalQuantity: number;
    totalLongCons: number;
    totalTransCons: number;
    totalWeightKg: number;
    totalLotEntraKg: number;
    totalLotConsKg: number;
    totalLotSobraKg: number;
} => {
    const physics = calculateMalhaPhysics(techConfig);

    // Cálculo em cascata idêntico à planilha Excel do gestor:
    // A cada pacote, soma eventual novo PESO LOTE informado na linha e desconta o KG CONS. daquele pacote.
    let runningLongBalance = 0;
    let runningTransBalance = 0;

    const computedRows: ComputedPackageRow[] = packages.map((pkg) => {
        const qty = Number(pkg.quantity) || 0;
        // Se o operador informou um peso real de balança no pacote, podemos ratear proporcionalmente ou usar o peso técnico padrão
        const longKgCons = qty * physics.longPesoUnit;
        const transKgCons = qty * physics.transPesoUnit;

        const enteredLongWeight = Number(pkg.longLotWeight) || 0;
        const enteredTransWeight = Number(pkg.transLotWeight) || 0;

        // Se na linha anterior o saldo ficou negativo (ex: -144,24 kg no p2) e o operador colocou o novo lote na mesma linha (p2) ou na próxima,
        // o acumulado soma os pesos dos lotes que entraram e subtrai o consumo acumulado!
        runningLongBalance = runningLongBalance + enteredLongWeight - longKgCons;
        runningTransBalance = runningTransBalance + enteredTransWeight - transKgCons;

        return {
            ...pkg,
            longKgCons,
            longPesoInicial: runningLongBalance,
            transKgCons,
            transPesoInicial: runningTransBalance
        };
    });

    const totalQuantity = computedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
    const totalLongCons = computedRows.reduce((acc, r) => acc + r.longKgCons, 0);
    const totalTransCons = computedRows.reduce((acc, r) => acc + r.transKgCons, 0);
    const totalWeightKg = totalLongCons + totalTransCons;

    // Construir tabela "LOTES CONSUMIDOS" (agrupando lotes Longitudinais e depois Transversais)
    const buildDirectionLots = (dir: 'LONGITUDINAL' | 'TRANSVERSAL', totalDirCons: number): ConsumedLotSummaryRow[] => {
        const uniqueLots: { lot: string; kgEntra: number }[] = [];
        packages.forEach(p => {
            const lotNum = (dir === 'LONGITUDINAL' ? p.longLot : p.transLot || '').trim();
            const lotW = Number(dir === 'LONGITUDINAL' ? p.longLotWeight : p.transLotWeight) || 0;
            if (!lotNum && lotW <= 0) return;
            const existing = uniqueLots.find(u => u.lot === lotNum && lotNum !== '');
            if (existing) {
                if (lotW > 0 && existing.kgEntra === 0) existing.kgEntra = lotW;
            } else {
                uniqueLots.push({ lot: lotNum || 'S/ LOTE', kgEntra: lotW });
            }
        });

        let remainingToConsume = totalDirCons;
        return uniqueLots.map((item, idx) => {
            const isLast = idx === uniqueLots.length - 1;
            let cons = 0;
            let sobra = 0;

            if (!isLast && item.kgEntra > 0) {
                // Se já entrou outro lote depois deste, este lote foi consumido por completo (ou até o limite do consumo total)
                cons = Math.min(item.kgEntra, Math.max(0, remainingToConsume));
                sobra = Math.max(0, item.kgEntra - cons);
                remainingToConsume = Math.max(0, remainingToConsume - cons);
            } else {
                // Último lote (atual em máquina): consome o saldo restante necessário para fechar o consumo total da direção
                cons = Math.max(0, remainingToConsume);
                sobra = Math.max(0, item.kgEntra - cons);
                remainingToConsume = 0;
            }

            return {
                direction: dir,
                lot: item.lot,
                kgEntra: item.kgEntra,
                cons,
                sobra
            };
        });
    };

    const longLotsSummary = buildDirectionLots('LONGITUDINAL', totalLongCons);
    const transLotsSummary = buildDirectionLots('TRANSVERSAL', totalTransCons);
    const consumedLots = [...longLotsSummary, ...transLotsSummary];

    const totalLotEntraKg = consumedLots.reduce((acc, l) => acc + l.kgEntra, 0);
    const totalLotConsKg = consumedLots.reduce((acc, l) => acc + l.cons, 0);
    const totalLotSobraKg = consumedLots.reduce((acc, l) => acc + l.sobra, 0);

    return {
        computedRows,
        consumedLots,
        totalQuantity,
        totalLongCons,
        totalTransCons,
        totalWeightKg,
        totalLotEntraKg,
        totalLotConsKg,
        totalLotSobraKg
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
    const [reportData, setReportData] = useState<MalhaPackagesReportData>(() => getSavedMalhaPackagesData(op));
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    useEffect(() => {
        if (isOpen && op) {
            setReportData(getSavedMalhaPackagesData(op));
        }
    }, [isOpen, op?.id]);

    // Lotes CA-60 do estoque para auto-preencher o peso do lote quando digitar o número do lote
    const stockLotMap = useMemo(() => {
        const map = new Map<string, number>();
        (stock || []).forEach(item => {
            if (item && item.internalLot) {
                const clean = String(item.internalLot).replace(/^LOTE\s+/i, '').trim();
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
            const updated: MalhaPackageRow = { ...pkg, [field]: value };

            // Se alterou o número do lote Longitudinal ou Transversal, busca automaticamente o peso do lote no estoque!
            if (field === 'longLot') {
                const clean = String(value).replace(/^LOTE\s+/i, '').trim().toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.longLotWeight || updated.longLotWeight === 0)) {
                    updated.longLotWeight = foundWeight;
                }
            }
            if (field === 'transLot') {
                const clean = String(value).replace(/^LOTE\s+/i, '').trim().toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.transLotWeight || updated.transLotWeight === 0)) {
                    updated.transLotWeight = foundWeight;
                }
            }
            return updated;
        });

        handleSave({
            ...reportData,
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
            recordedAt: new Date().toISOString()
        };
        handleSave({
            ...reportData,
            packages: [...reportData.packages, newRow]
        });
    };

    const handleRemovePackage = (id: string) => {
        if (reportData.packages.length <= 1) return;
        const filtered = reportData.packages
            .filter(p => p.id !== id)
            .map((p, idx) => ({ ...p, packageCode: `p${idx + 1}` }));
        handleSave({
            ...reportData,
            packages: filtered
        });
    };

    const physics = useMemo(() => calculateMalhaPhysics(reportData.techConfig), [reportData.techConfig]);
    const computed = useMemo(
        () => computeMalhaPackagesAndLots(reportData.packages, reportData.techConfig),
        [reportData.packages, reportData.techConfig]
    );

    // Histórico de Produção Diária da OP (Tabela "ATUALIZAÇÃO PRODUÇÃO")
    const dailyUpdates = useMemo(() => {
        const byDate = new Map<string, number>();
        const logs: any[] = op.operatorLogs || (op as any).operator_logs || [];
        logs.forEach(l => {
            const rawStart = l.startTime || l.start_time;
            if (!rawStart || l.action === 'Criada no PCP' || l.operator === 'GHOST_ORDER_FLAG') return;
            const d = new Date(rawStart);
            if (isNaN(d.getTime())) return;
            const dateBr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const startQ = Number(l.startQuantity ?? l.start_quantity ?? 0) || 0;
            const endQ = (l.endTime || l.end_time)
                ? (Number(l.endQuantity ?? l.end_quantity ?? startQ) || 0)
                : (Number(op.actualProducedQuantity) || 0);
            const diff = Math.max(0, endQ - startQ);
            if (diff > 0) {
                byDate.set(dateBr, (byDate.get(dateBr) || 0) + diff);
            }
        });

        if (byDate.size === 0) {
            (shiftReports || [])
                .filter(r => r.productionOrderId === op.id || r.orderNumber === op.orderNumber)
                .forEach(r => {
                    const rawD = r.date || r.shiftStartTime;
                    if (!rawD) return;
                    const d = new Date(rawD);
                    const dateBr = !isNaN(d.getTime())
                        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : String(rawD);
                    const qty = Number(r.totalProducedQuantity || 0);
                    if (qty > 0) {
                        byDate.set(dateBr, (byDate.get(dateBr) || 0) + qty);
                    }
                });
        }

        return Array.from(byDate.entries()).map(([date, qty]) => ({ date, qty }));
    }, [op, shiftReports]);

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
                {/* Barra de Topo de Ações (Não sai na impressão) */}
                <div className="bg-[#0A1B27] text-white px-4 py-3 flex items-center justify-between gap-3 flex-wrap print:hidden">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 text-lg">📊</span>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                                Planilha de Consumo por Lote & Pacotes (50 Malhas) • OP #{op.orderNumber}
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Conversão automática de peso longitudinal e transversal com desconto de saldo por pacote
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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

                {/* Conteúdo estilo Planilha Excel (Fiel ao modelo da foto) */}
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
                                    <td className="px-2 py-1 text-center border border-slate-400 bg-amber-50/60 w-28">
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={reportData.techConfig.bitola}
                                            onChange={e => updateTechField('bitola', parseFloat(e.target.value) || 0)}
                                            className="w-full text-center font-black text-slate-900 bg-transparent outline-none focus:bg-amber-100 rounded px-1"
                                            title="Bitola em mm para cálculo de massa linear"
                                        />
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

                    {/* 2. DESCRIÇÃO TÉCNICA & RESUMO DA ORDEM (Lado a Lado) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* DESCRIÇÃO TÉCNICA */}
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

                        {/* RESUMO DA ORDEM */}
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
                                            {reportData.techConfig.defaultQtyPerPackage || 50}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold">
                                            {computed.totalQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono font-bold">
                                            {computed.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                        </td>
                                    </tr>
                                    <tr className="bg-[#D9E1F2] font-black text-slate-900">
                                        <td className="py-1.5 px-2 border border-slate-400 text-center">Total:</td>
                                        <td className="py-1.5 px-2 border border-slate-400"></td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {computed.totalQuantity}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                            {computed.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. CONSUMÍVEIS POR LOTE (TABELA PRINCIPAL DE PACOTES DE 50 MALHAS) */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                            <thead>
                                <tr>
                                    <th colSpan={12} className="bg-[#1F3864] text-white font-black uppercase py-2 px-3 text-center tracking-wider border border-[#1F3864]">
                                        CONSUMÍVEIS POR LOTE (PACOTES DE 50 MALHAS)
                                    </th>
                                </tr>
                                <tr className="bg-[#2F5597] text-white font-black uppercase text-[11px]">
                                    <th colSpan={3} className="py-1 px-2 border border-slate-400 text-center">IDENTIFICAÇÃO DO PACOTE</th>
                                    <th colSpan={4} className="py-1 px-2 border border-slate-400 text-center bg-[#1F4E79]">LONGITUDINAL</th>
                                    <th colSpan={4} className="py-1 px-2 border border-slate-400 text-center bg-[#2E75B6]">TRANSVERSAL</th>
                                    <th className="py-1 px-1 border border-slate-400 text-center print:hidden w-8"></th>
                                </tr>
                                <tr className="bg-[#D9E1F2] text-slate-900 font-black uppercase text-[10px]">
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24">LOTE (Etiqueta)</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-16">PACOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-16">QUNT.</th>
                                    {/* Longitudinal */}
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">PESO LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-28">PESO INICIAL (Saldo)</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-28">KG CONS.</th>
                                    {/* Transversal */}
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-center w-24 bg-yellow-200/80">PESO LOTE</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-28">PESO INICIAL (Saldo)</th>
                                    <th className="py-1.5 px-2 border border-slate-400 text-right w-28">KG CONS.</th>
                                    <th className="py-1.5 px-1 border border-slate-400 text-center print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {computed.computedRows.map((row) => {
                                    const hasLongEntry = Boolean(row.longLot || row.longLotWeight > 0);
                                    const hasTransEntry = Boolean(row.transLot || row.transLotWeight > 0);

                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50">
                                            {/* Lote Etiqueta do Pacote */}
                                            <td className="p-1 border border-slate-400 text-center">
                                                <input
                                                    type="text"
                                                    value={row.finishedLotNumber}
                                                    onChange={e => updatePackageRow(row.id, 'finishedLotNumber', e.target.value)}
                                                    placeholder="Ex: 88846"
                                                    className="w-full text-center font-bold text-slate-800 bg-transparent outline-none focus:bg-amber-50 rounded py-0.5"
                                                />
                                            </td>
                                            {/* Código Pacote (p1, p2...) */}
                                            <td className="p-1 border border-slate-400 text-center font-bold text-slate-700 bg-slate-50">
                                                {row.packageCode}
                                            </td>
                                            {/* Quantidade de malhas no pacote (50) */}
                                            <td className="p-1 border border-slate-400 text-center bg-amber-50/30">
                                                <input
                                                    type="number"
                                                    value={row.quantity}
                                                    onChange={e => updatePackageRow(row.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                                                    className="w-full text-center font-black text-slate-900 bg-transparent outline-none focus:bg-amber-100 rounded py-0.5"
                                                />
                                            </td>

                                            {/* LONGITUDINAL: LOTE */}
                                            <td className={`p-1 border border-slate-400 text-center ${hasLongEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}>
                                                <input
                                                    type="text"
                                                    list="malha-stock-lots-datalist"
                                                    value={row.longLot}
                                                    onChange={e => updatePackageRow(row.id, 'longLot', e.target.value)}
                                                    placeholder="Nº Lote"
                                                    className="w-full text-center font-black text-slate-900 bg-transparent outline-none py-0.5"
                                                />
                                            </td>
                                            {/* LONGITUDINAL: PESO LOTE */}
                                            <td className={`p-1 border border-slate-400 text-center ${hasLongEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}>
                                                <input
                                                    type="number"
                                                    value={row.longLotWeight || ''}
                                                    onChange={e => updatePackageRow(row.id, 'longLotWeight', parseFloat(e.target.value) || 0)}
                                                    placeholder="Kg Lote"
                                                    className="w-full text-center font-bold text-slate-900 bg-transparent outline-none py-0.5"
                                                />
                                            </td>
                                            {/* LONGITUDINAL: PESO INICIAL (Saldo após pacote) */}
                                            <td className={`p-1.5 border border-slate-400 text-right font-mono font-bold ${
                                                row.longPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800 bg-slate-50'
                                            }`}>
                                                {row.longPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                            </td>
                                            {/* LONGITUDINAL: KG CONS. */}
                                            <td className="p-1.5 border border-slate-400 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                                                {row.longKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                            </td>

                                            {/* TRANSVERSAL: LOTE */}
                                            <td className={`p-1 border border-slate-400 text-center ${hasTransEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}>
                                                <input
                                                    type="text"
                                                    list="malha-stock-lots-datalist"
                                                    value={row.transLot}
                                                    onChange={e => updatePackageRow(row.id, 'transLot', e.target.value)}
                                                    placeholder="Nº Lote"
                                                    className="w-full text-center font-black text-slate-900 bg-transparent outline-none py-0.5"
                                                />
                                            </td>
                                            {/* TRANSVERSAL: PESO LOTE */}
                                            <td className={`p-1 border border-slate-400 text-center ${hasTransEntry ? 'bg-yellow-300/70' : 'bg-yellow-50/40'}`}>
                                                <input
                                                    type="number"
                                                    value={row.transLotWeight || ''}
                                                    onChange={e => updatePackageRow(row.id, 'transLotWeight', parseFloat(e.target.value) || 0)}
                                                    placeholder="Kg Lote"
                                                    className="w-full text-center font-bold text-slate-900 bg-transparent outline-none py-0.5"
                                                />
                                            </td>
                                            {/* TRANSVERSAL: PESO INICIAL (Saldo após pacote) */}
                                            <td className={`p-1.5 border border-slate-400 text-right font-mono font-bold ${
                                                row.transPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800 bg-slate-50'
                                            }`}>
                                                {row.transPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                            </td>
                                            {/* TRANSVERSAL: KG CONS. */}
                                            <td className="p-1.5 border border-slate-400 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                                                {row.transKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                            </td>

                                            {/* Botão remover linha */}
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
                                })}

                                {/* Linha de Totais da Tabela CONSUMÍVEIS POR LOTE */}
                                <tr className="bg-[#2F5597] text-white font-black">
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center">TOTAL</td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                        {computed.totalQuantity}
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                        {computed.totalLongCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400"></td>
                                    <td className="py-1.5 px-2 border border-slate-400 text-right font-mono">
                                        {computed.totalTransCons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </td>
                                    <td className="py-1.5 px-1 border border-slate-400 print:hidden"></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Datalist de lotes do estoque para autopreenchimento rápido */}
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

                    {/* 4. LOTES CONSUMIDOS (Entrada, Consumo e Sobra) & ATUALIZAÇÃO PRODUÇÃO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
                        {/* TABELA LOTES CONSUMIDOS */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={5} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            LOTES CONSUMIDOS (CÁLCULO DE CONVERSÃO E SOBRA)
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
                                                Informe os lotes e pesos na tabela acima para calcular o consumo e a sobra automaticamente.
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

                        {/* TABELA ATUALIZAÇÃO PRODUÇÃO */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-[#1F3864] text-xs bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-[#1F3864] text-white font-black uppercase py-1.5 px-3 text-center tracking-wider border border-[#1F3864]">
                                            ATUALIZAÇÃO PRODUÇÃO
                                        </th>
                                    </tr>
                                    <tr className="bg-[#2F5597] text-white font-bold uppercase text-[11px]">
                                        <th className="py-1 px-2 border border-slate-400 text-center">Peças Produzidas</th>
                                        <th className="py-1 px-2 border border-slate-400 text-center">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyUpdates.length > 0 ? (
                                        dailyUpdates.map((u, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="py-1 px-2 border border-slate-400 text-center font-black text-slate-900">
                                                    {u.qty}
                                                </td>
                                                <td className="py-1 px-2 border border-slate-400 text-center font-mono text-slate-700">
                                                    {u.date}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="py-4 text-center text-slate-400 italic">
                                                Sem apontamentos diários registrados.
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="bg-[#D9E1F2] font-black text-slate-900">
                                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono">
                                            {dailyUpdates.reduce((acc, u) => acc + u.qty, 0) || op.actualProducedQuantity || 0}
                                        </td>
                                        <td className="py-1.5 px-2 border border-slate-400 text-center">Total Produzido</td>
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

export const MalhaPackagesOperatorPanel: React.FC<{
    op: ProductionOrderData;
    stock: StockItem[];
    shiftReports?: ShiftReport[];
}> = ({ op, stock, shiftReports = [] }) => {
    const [reportData, setReportData] = useState<MalhaPackagesReportData>(() => getSavedMalhaPackagesData(op));
    const [showFullModal, setShowFullModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    useEffect(() => {
        setReportData(getSavedMalhaPackagesData(op));
    }, [op?.id, (op?.summary as any)?.malhaPackagesData?.updatedAt]);

    const stockLotMap = useMemo(() => {
        const map = new Map<string, number>();
        (stock || []).forEach(item => {
            if (item && item.internalLot) {
                const clean = String(item.internalLot).replace(/^LOTE\s+/i, '').trim();
                const weight = Number(item.initialQuantity || item.remainingQuantity || 0);
                if (clean && weight > 0) {
                    map.set(clean.toLowerCase(), weight);
                }
            }
        });
        return map;
    }, [stock]);

    const persistData = async (nextData: MalhaPackagesReportData) => {
        setReportData(nextData);
        setSaveStatus('saving');
        await saveMalhaPackagesData(op, nextData);
        setSaveStatus('saved');
    };

    const updatePackageField = (id: string, field: keyof MalhaPackageRow, value: any) => {
        const nextPackages = reportData.packages.map(pkg => {
            if (pkg.id !== id) return pkg;
            const updated: MalhaPackageRow = { ...pkg, [field]: value };
            if (field === 'longLot') {
                const clean = String(value).replace(/^LOTE\s+/i, '').trim().toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.longLotWeight || updated.longLotWeight === 0)) {
                    updated.longLotWeight = foundWeight;
                }
            }
            if (field === 'transLot') {
                const clean = String(value).replace(/^LOTE\s+/i, '').trim().toLowerCase();
                const foundWeight = stockLotMap.get(clean);
                if (foundWeight && (!updated.transLotWeight || updated.transLotWeight === 0)) {
                    updated.transLotWeight = foundWeight;
                }
            }
            return updated;
        });

        persistData({
            ...reportData,
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
            recordedAt: new Date().toISOString()
        };
        persistData({
            ...reportData,
            packages: [...reportData.packages, newRow]
        });
    };

    const computed = useMemo(
        () => computeMalhaPackagesAndLots(reportData.packages, reportData.techConfig),
        [reportData.packages, reportData.techConfig]
    );

    return (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span>📦 Registro de Pacotes da Malha</span>
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                50 malhas / pacote
                            </span>
                        </h3>
                        <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            {reportData.packages.length} pacotes • {computed.totalQuantity} malhas • {computed.totalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Selecione o Lote Longitudinal e Transversal, a quantidade (50) e o peso do lote para o sistema converter e descontar automaticamente
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                        {saveStatus === 'saved' ? '✓ Sincronizado' : 'Salvando...'}
                    </span>
                    <button
                        type="button"
                        onClick={handleAddPackage}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer shadow-sm"
                    >
                        + Pacote (50)
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowFullModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-[#1F3864] hover:bg-[#2F5597] text-white font-black text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                        <span>📊</span>
                        <span>Ver Planilha Completa</span>
                    </button>
                </div>
            </div>

            {/* Tabela de Pacotes de 50 Malhas */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-[#1F3864] text-white font-black uppercase text-[10px]">
                            <th colSpan={3} className="p-2 border border-slate-400 text-center">PACOTE (50 MALHAS)</th>
                            <th colSpan={4} className="p-2 border border-slate-400 text-center bg-[#1F4E79]">↔️ FIO LONGITUDINAL</th>
                            <th colSpan={4} className="p-2 border border-slate-400 text-center bg-[#2E75B6]">↕️ FIO TRANSVERSAL</th>
                        </tr>
                        <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                            <th className="p-2 border border-slate-300 text-center">Lote (Pkt)</th>
                            <th className="p-2 border border-slate-300 text-center">Pct</th>
                            <th className="p-2 border border-slate-300 text-center">Qnt.</th>
                            <th className="p-2 border border-slate-300 text-center bg-yellow-100">Lote Long.</th>
                            <th className="p-2 border border-slate-300 text-center bg-yellow-100">Peso Lote (kg)</th>
                            <th className="p-2 border border-slate-300 text-right">Saldo (kg)</th>
                            <th className="p-2 border border-slate-300 text-right">Kg Cons.</th>
                            <th className="p-2 border border-slate-300 text-center bg-yellow-100">Lote Trans.</th>
                            <th className="p-2 border border-slate-300 text-center bg-yellow-100">Peso Lote (kg)</th>
                            <th className="p-2 border border-slate-300 text-right">Saldo (kg)</th>
                            <th className="p-2 border border-slate-300 text-right">Kg Cons.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computed.computedRows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                                <td className="p-1.5 border border-slate-200 text-center">
                                    <input
                                        type="text"
                                        value={row.finishedLotNumber}
                                        onChange={e => updatePackageField(row.id, 'finishedLotNumber', e.target.value)}
                                        placeholder="Ex: 88846"
                                        className="w-20 p-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:border-indigo-500 outline-none"
                                    />
                                </td>
                                <td className="p-1.5 border border-slate-200 text-center font-black text-slate-700 bg-slate-50">
                                    {row.packageCode}
                                </td>
                                <td className="p-1.5 border border-slate-200 text-center">
                                    <input
                                        type="number"
                                        value={row.quantity}
                                        onChange={e => updatePackageField(row.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                                        className="w-16 p-1.5 border border-slate-300 rounded-lg text-center font-black text-slate-900 focus:border-indigo-500 outline-none"
                                    />
                                </td>

                                {/* Longitudinal */}
                                <td className="p-1.5 border border-slate-200 text-center bg-yellow-50/70">
                                    <input
                                        type="text"
                                        list="malha-op-stock-lots"
                                        value={row.longLot}
                                        onChange={e => updatePackageField(row.id, 'longLot', e.target.value)}
                                        placeholder="Nº Lote"
                                        className="w-20 p-1.5 border border-amber-300 rounded-lg text-center font-black text-slate-900 bg-white focus:border-amber-500 outline-none"
                                    />
                                </td>
                                <td className="p-1.5 border border-slate-200 text-center bg-yellow-50/70">
                                    <input
                                        type="number"
                                        value={row.longLotWeight || ''}
                                        onChange={e => updatePackageField(row.id, 'longLotWeight', parseFloat(e.target.value) || 0)}
                                        placeholder="Kg Lote"
                                        className="w-20 p-1.5 border border-amber-300 rounded-lg text-center font-bold text-slate-900 bg-white focus:border-amber-500 outline-none"
                                    />
                                </td>
                                <td className={`p-2 border border-slate-200 text-right font-mono font-bold ${
                                    row.longPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800'
                                }`}>
                                    {row.longPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 border border-slate-200 text-right font-mono font-semibold text-slate-600 bg-slate-50">
                                    {row.longKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </td>

                                {/* Transversal */}
                                <td className="p-1.5 border border-slate-200 text-center bg-yellow-50/70">
                                    <input
                                        type="text"
                                        list="malha-op-stock-lots"
                                        value={row.transLot}
                                        onChange={e => updatePackageField(row.id, 'transLot', e.target.value)}
                                        placeholder="Nº Lote"
                                        className="w-20 p-1.5 border border-amber-300 rounded-lg text-center font-black text-slate-900 bg-white focus:border-amber-500 outline-none"
                                    />
                                </td>
                                <td className="p-1.5 border border-slate-200 text-center bg-yellow-50/70">
                                    <input
                                        type="number"
                                        value={row.transLotWeight || ''}
                                        onChange={e => updatePackageField(row.id, 'transLotWeight', parseFloat(e.target.value) || 0)}
                                        placeholder="Kg Lote"
                                        className="w-20 p-1.5 border border-amber-300 rounded-lg text-center font-bold text-slate-900 bg-white focus:border-amber-500 outline-none"
                                    />
                                </td>
                                <td className={`p-2 border border-slate-200 text-right font-mono font-bold ${
                                    row.transPesoInicial < 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-800'
                                }`}>
                                    {row.transPesoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 border border-slate-200 text-right font-mono font-semibold text-slate-600 bg-slate-50">
                                    {row.transKgCons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <datalist id="malha-op-stock-lots">
                    {(stock || [])
                        .filter(s => s && s.internalLot && !String(s.status || '').toLowerCase().includes('consumido'))
                        .map(s => (
                            <option key={s.id} value={s.internalLot}>
                                Lote {s.internalLot} • {s.bitola}mm • {Number(s.initialQuantity || s.remainingQuantity || 0).toFixed(0)}kg
                            </option>
                        ))}
                </datalist>
            </div>

            {/* Resumo Rápido de Lotes Consumidos e Sobra */}
            {computed.consumedLots.length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        ⚖️ Resumo de Lotes Consumidos e Sobra (Conversão Automática)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {computed.consumedLots.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                        {item.direction === 'LONGITUDINAL' ? '↔️ LONG.' : '↕️ TRANS.'}
                                    </span>
                                    <span className="text-xs font-black font-mono text-slate-900">Lote {item.lot}</span>
                                </div>
                                <div className="mt-1.5 space-y-0.5 text-[10px] font-mono">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Entra:</span>
                                        <strong>{item.kgEntra.toFixed(0)} kg</strong>
                                    </div>
                                    <div className="flex justify-between text-rose-600">
                                        <span>Cons.:</span>
                                        <strong>{item.cons.toFixed(0)} kg</strong>
                                    </div>
                                    <div className="flex justify-between text-emerald-700 border-t border-slate-100 pt-0.5">
                                        <span>Sobra:</span>
                                        <strong className="font-black">{item.sobra.toFixed(0)} kg</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
