import React, { useState, useMemo } from 'react';
import type { StockItem, StockGauge } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, CA60BitolaOptions, DefaultTrelicaGauges } from '../types';
import { PrinterIcon, XIcon } from './icons';

interface StockPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    stock: StockItem[];
    gauges: StockGauge[];
    initialMaterial?: string;
    initialBitola?: string;
    initialSteelType?: string;
}

export const StockPrintModal: React.FC<StockPrintModalProps> = ({
    isOpen,
    onClose,
    stock,
    gauges,
    initialMaterial = '',
    initialBitola = '',
    initialSteelType = ''
}) => {
    // Filtros de seleção no modal
    const [selectedMaterial, setSelectedMaterial] = useState<string>(initialMaterial || 'CA-60');
    const [selectedSteelType] = useState<string>(initialSteelType || '');
    const [selectedStatuses] = useState<string[]>(['Disponível', 'Disponível - Suporte Treliça']);
    
    // Configurações inteligentes de impressão A4 Retrato
    const [itemsPerColumn, setItemsPerColumn] = useState<number>(30); // Limite de linhas por coluna
    const [columnsPerPage, setColumnsPerPage] = useState<number>(3); // 3 ou 4 colunas por folha A4 retrato
    const [showCorrida, setShowCorrida] = useState(false);
    const [showData, setShowData] = useState(false);

    // Todas as bitolas/modelos possíveis para o material selecionado
    const availableBitolasForMaterial = useMemo(() => {
        if (!selectedMaterial) return [];

        const bitolasSet = new Map<string, { label: string; count: number; weight: number }>();

        // 1. Bitolas do estoque ativo
        stock.forEach(item => {
            if (item.materialType === selectedMaterial && item.status !== 'Consumido') {
                const key = item.bitola;
                const existing = bitolasSet.get(key) || { label: key, count: 0, weight: 0 };
                existing.count += 1;
                existing.weight += item.remainingQuantity;
                bitolasSet.set(key, existing);
            }
        });

        // 2. Bitolas cadastradas nos gauges
        gauges.filter(g => g.materialType === selectedMaterial).forEach(g => {
            if (!bitolasSet.has(g.gauge)) {
                bitolasSet.set(g.gauge, { label: g.description ? `${g.gauge} - ${g.description}` : g.gauge, count: 0, weight: 0 });
            }
        });

        // 3. Padrões caso seja vazio
        if (selectedMaterial === 'CA-60') {
            CA60BitolaOptions.forEach(b => {
                if (!bitolasSet.has(b)) bitolasSet.set(b, { label: `${b.replace('.', ',')} mm`, count: 0, weight: 0 });
            });
        } else if (selectedMaterial === 'Fio Máquina') {
            FioMaquinaBitolaOptions.forEach(b => {
                if (!bitolasSet.has(b)) bitolasSet.set(b, { label: `${b.replace('.', ',')} mm`, count: 0, weight: 0 });
            });
        } else if (selectedMaterial === 'Treliça') {
            DefaultTrelicaGauges.forEach(t => {
                const key = t.gauge;
                if (!bitolasSet.has(key)) bitolasSet.set(key, { label: `${t.description} ${t.tamanho}m`, count: 0, weight: 0 });
            });
        }

        // Ordenação
        return Array.from(bitolasSet.entries()).map(([key, data]) => ({
            key,
            label: data.label,
            count: data.count,
            weight: data.weight
        })).sort((a, b) => {
            const numA = parseFloat(a.key.replace(',', '.'));
            const numB = parseFloat(b.key.replace(',', '.'));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.key.localeCompare(b.key);
        });
    }, [selectedMaterial, stock, gauges]);

    // Bitolas marcadas pelo usuário
    const [selectedBitolas, setSelectedBitolas] = useState<string[]>(() => {
        if (initialBitola) {
            const clean = initialBitola.includes('::') ? initialBitola.split('::')[1] : initialBitola;
            return [clean];
        }
        return [];
    });

    // Atualiza bitolas selecionadas ao trocar de material
    const handleMaterialChange = (newMat: string) => {
        setSelectedMaterial(newMat);
        const withStock = stock
            .filter(i => i.materialType === newMat && i.status !== 'Consumido')
            .map(i => i.bitola);
        const uniqueWithStock = Array.from(new Set(withStock));
        setSelectedBitolas(uniqueWithStock.length > 0 ? uniqueWithStock : []);
    };

    const selectAllBitolas = () => {
        setSelectedBitolas(availableBitolasForMaterial.map(b => b.key));
    };

    const selectOnlyWithStock = () => {
        const withStock = availableBitolasForMaterial.filter(b => b.count > 0).map(b => b.key);
        setSelectedBitolas(withStock);
    };

    const clearAllBitolas = () => {
        setSelectedBitolas([]);
    };

    const toggleBitola = (bitolaKey: string) => {
        if (selectedBitolas.includes(bitolaKey)) {
            setSelectedBitolas(selectedBitolas.filter(b => b !== bitolaKey));
        } else {
            setSelectedBitolas([...selectedBitolas, bitolaKey]);
        }
    };

    // Estrutura de sub-coluna inteligente (que quebra e continua ao lado)
    interface PrintColumn {
        id: string;
        bitolaKey: string;
        displayName: string;
        displaySize?: number;
        partIndex: number;
        totalParts: number;
        lots: StockItem[];
        isLastPart: boolean;
        isFirstPart: boolean;
        totalGaugeLots: number;
        totalGaugeWeight: number;
        partWeight: number;
    }

    // DIVISÃO INTELIGENTE DOS LOTES EM COLUNAS LADO A LADO
    const generatedColumns = useMemo(() => {
        const cols: PrintColumn[] = [];

        selectedBitolas.forEach(bitola => {
            const lots = stock.filter(item => {
                if (item.status === 'Consumido') return false;
                if (selectedMaterial && item.materialType !== selectedMaterial) return false;
                if (item.bitola !== bitola) return false;
                if (selectedSteelType && item.steelType !== selectedSteelType) return false;
                if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) return false;
                return true;
            }).sort((a, b) => {
                const numA = parseInt(a.internalLot) || 0;
                const numB = parseInt(b.internalLot) || 0;
                if (numA !== numB) return numA - numB;
                return a.internalLot.localeCompare(b.internalLot);
            });

            const gaugeInfo = gauges.find(g => g.materialType === selectedMaterial && g.gauge === bitola);
            const defaultTrelica = selectedMaterial === 'Treliça' ? DefaultTrelicaGauges.find(t => t.gauge === bitola) : null;
            const displayName = gaugeInfo?.description || defaultTrelica?.description || `${bitola} mm`;
            const displaySize = gaugeInfo?.tamanho || defaultTrelica?.tamanho;
            const totalGaugeWeight = lots.reduce((sum, i) => sum + i.remainingQuantity, 0);
            const totalGaugeLots = lots.length;

            if (lots.length === 0) {
                cols.push({
                    id: `${bitola}-empty`,
                    bitolaKey: bitola,
                    displayName,
                    displaySize,
                    partIndex: 1,
                    totalParts: 1,
                    lots: [],
                    isFirstPart: true,
                    isLastPart: true,
                    totalGaugeLots: 0,
                    totalGaugeWeight: 0,
                    partWeight: 0
                });
            } else {
                // Divide em partes conforme o limite da folha (itemsPerColumn)
                const chunks: StockItem[][] = [];
                for (let i = 0; i < lots.length; i += itemsPerColumn) {
                    chunks.push(lots.slice(i, i + itemsPerColumn));
                }

                chunks.forEach((chunkLots, idx) => {
                    const partWeight = chunkLots.reduce((sum, i) => sum + i.remainingQuantity, 0);
                    cols.push({
                        id: `${bitola}-part-${idx + 1}`,
                        bitolaKey: bitola,
                        displayName,
                        displaySize,
                        partIndex: idx + 1,
                        totalParts: chunks.length,
                        lots: chunkLots,
                        isFirstPart: idx === 0,
                        isLastPart: idx === chunks.length - 1,
                        totalGaugeLots,
                        totalGaugeWeight,
                        partWeight
                    });
                });
            }
        });

        return cols;
    }, [selectedBitolas, stock, selectedMaterial, selectedSteelType, selectedStatuses, gauges, itemsPerColumn]);

    // PAGINAÇÃO INTELIGENTE POR FOLHA A4 RETRATO
    const printPages = useMemo(() => {
        const pages: PrintColumn[][] = [];
        for (let i = 0; i < generatedColumns.length; i += columnsPerPage) {
            pages.push(generatedColumns.slice(i, i + columnsPerPage));
        }
        return pages;
    }, [generatedColumns, columnsPerPage]);

    // Totais consolidados gerais
    const consolidatedTotals = useMemo(() => {
        let totalLots = 0;
        let totalWeight = 0;
        
        selectedBitolas.forEach(bitola => {
            stock.forEach(item => {
                if (item.status !== 'Consumido' && item.materialType === selectedMaterial && item.bitola === bitola) {
                    totalLots += 1;
                    totalWeight += item.remainingQuantity;
                }
            });
        });

        return { totalLots, totalWeight };
    }, [selectedBitolas, stock, selectedMaterial]);

    const handleExecutePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
            {/* CSS específico de impressão para folhas A4 Retrato Inteligente */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 5mm 5mm 6mm 5mm;
                    }
                    html, body {
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .stock-printable-area, .stock-printable-area * {
                        visibility: visible;
                    }
                    .stock-printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-sheet {
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        min-height: 275mm;
                        padding: 2mm 0;
                        box-sizing: border-box;
                    }
                    .print-sheet:last-of-type {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .print-col-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header da Central de Impressão */}
                <div className="no-print p-4 md:px-6 md:py-3.5 bg-gradient-to-r from-slate-900 via-[#0F3F5C] to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">
                            🖨️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">Impressão Inteligente de Estoque</h3>
                                <span className="text-[11px] font-black bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                                    A4 Retrato • Fluxo Lado a Lado
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80">Lotes que ultrapassam a altura da folha continuam na coluna ao lado automaticamente.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            <span>Imprimir Agora</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
                        >
                            <XIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Corpo do Modal: Painel de Configurações + Pré-Visualização das Folhas */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* BARRA DE CONFIGURAÇÕES INTELIGENTES (NO-PRINT) */}
                    <div className="no-print p-4 bg-slate-50 border-b border-slate-200 space-y-3.5 shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                            {/* 1. Seleção de Material */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                    1. Material Principal
                                </label>
                                <select
                                    value={selectedMaterial}
                                    onChange={e => handleMaterialChange(e.target.value)}
                                    className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F3F5C] shadow-2xs cursor-pointer"
                                >
                                    {MaterialOptions.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Colunas por Folha A4 Retrato */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                    2. Colunas por Folha (A4 Retrato)
                                </label>
                                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setColumnsPerPage(3)}
                                        className={`py-1 text-xs font-black rounded-lg transition ${
                                            columnsPerPage === 3
                                                ? 'bg-[#0F3F5C] text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        3 Colunas (Ideal)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setColumnsPerPage(4)}
                                        className={`py-1 text-xs font-black rounded-lg transition ${
                                            columnsPerPage === 4
                                                ? 'bg-[#0F3F5C] text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        4 Colunas (Máx)
                                    </button>
                                </div>
                            </div>

                            {/* 3. Limite de Linhas por Coluna */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                    3. Linhas por Coluna (Cálculo Folha)
                                </label>
                                <select
                                    value={itemsPerColumn}
                                    onChange={e => setItemsPerColumn(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F3F5C] shadow-2xs cursor-pointer"
                                >
                                    <option value={26}>26 linhas (Mais folgado)</option>
                                    <option value={30}>30 linhas (Padrão A4 Retrato)</option>
                                    <option value={34}>34 linhas (Super Compacto)</option>
                                    <option value={40}>40 linhas (Densidade Máxima)</option>
                                </select>
                            </div>

                            {/* 4. Colunas Opcionais */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                    4. Campos Opcionais
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <label className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-2 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition shadow-2xs">
                                        <input
                                            type="checkbox"
                                            checked={showCorrida}
                                            onChange={e => setShowCorrida(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded accent-[#0F3F5C]"
                                        />
                                        <span>Corrida</span>
                                    </label>
                                    <label className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-2 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition shadow-2xs">
                                        <input
                                            type="checkbox"
                                            checked={showData}
                                            onChange={e => setShowData(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded accent-[#0F3F5C]"
                                        />
                                        <span>Data</span>
                                    </label>
                                </div>
                            </div>

                            {/* 5. Resumo da Distribuição */}
                            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2 flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] font-black text-blue-900 uppercase block">Total a Imprimir</span>
                                    <span className="text-xs font-black text-blue-900">{consolidatedTotals.totalLots} lotes • {printPages.length} {printPages.length === 1 ? 'Folha' : 'Folhas'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-emerald-800 uppercase block">Peso Consolidado</span>
                                    <span className="text-xs font-black text-emerald-700">
                                        {consolidatedTotals.totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SELETOR DE BITOLAS COM CHIPS */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Bitolas selecionadas para o fluxo de impressão:
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectOnlyWithStock}
                                        className="text-[11px] font-bold text-blue-700 hover:underline"
                                    >
                                        Apenas com Estoque ({availableBitolasForMaterial.filter(b => b.count > 0).length})
                                    </button>
                                    <span className="text-slate-300">•</span>
                                    <button
                                        type="button"
                                        onClick={selectAllBitolas}
                                        className="text-[11px] font-bold text-slate-600 hover:underline"
                                    >
                                        Marcar Todas
                                    </button>
                                    <span className="text-slate-300">•</span>
                                    <button
                                        type="button"
                                        onClick={clearAllBitolas}
                                        className="text-[11px] font-bold text-slate-500 hover:underline"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white shadow-2xs">
                                {availableBitolasForMaterial.length === 0 && (
                                    <span className="text-xs text-slate-400 p-1">Nenhuma bitola encontrada para este material.</span>
                                )}
                                {availableBitolasForMaterial.map(b => {
                                    const isSelected = selectedBitolas.includes(b.key);
                                    return (
                                        <button
                                            key={b.key}
                                            type="button"
                                            onClick={() => toggleBitola(b.key)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                                                isSelected
                                                    ? 'bg-[#0F3F5C] text-white border-[#0F3F5C] shadow-2xs'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                className="h-3 w-3 rounded accent-white pointer-events-none"
                                            />
                                            <span>{b.label}</span>
                                            <span className={`text-[10px] px-1 py-0 rounded-full font-black ${
                                                isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : b.count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {b.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ÁREA DE PRÉ-VISUALIZAÇÃO / FOLHAS A4 DE IMPRESSÃO */}
                    <div className="p-3 md:p-6 bg-slate-300/70 overflow-y-auto flex-1 flex flex-col items-center gap-6">
                        <div className="stock-printable-area w-full max-w-4xl flex flex-col gap-6">
                            {selectedBitolas.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-bold border-2 border-dashed border-slate-400 bg-white rounded-2xl shadow-sm">
                                    Nenhuma bitola selecionada. Marque as bitolas no painel acima para calcular as colunas.
                                </div>
                            ) : (
                                printPages.map((pageColumns, pageIdx) => {
                                    const pageNum = pageIdx + 1;
                                    const totalPages = printPages.length;
                                    const isFirstPage = pageNum === 1;
                                    const isLastPage = pageNum === totalPages;

                                    return (
                                        <div
                                            key={`sheet-${pageNum}`}
                                            className="print-sheet bg-white text-slate-900 w-full shadow-xl rounded-xl p-5 md:p-6 border border-slate-300 flex flex-col justify-between"
                                        >
                                            <div>
                                                {/* CABEÇALHO DO DOCUMENTO: Detalhado na Folha 1, Compacto nas demais folhas */}
                                                {isFirstPage ? (
                                                    <div className="border-b-2 border-slate-800 pb-3 mb-4">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
                                                                    MSM <span className="text-slate-500 font-normal">Gestão Inteligente</span>
                                                                </h1>
                                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                                                                    Relatório de Inventário Físico de Estoque • {selectedMaterial}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[11px] font-black text-slate-900">
                                                                    {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                                <p className="text-[10px] text-slate-600 font-bold">
                                                                    Folha <span className="text-blue-900 font-black">{pageNum} de {totalPages}</span> • Retrato
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Faixa Resumo Executivo */}
                                                        <div className="mt-2.5 bg-slate-100 rounded-lg p-2 border border-slate-300 flex flex-wrap items-center justify-between text-xs">
                                                            <div className="flex items-center gap-4">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Material</span>
                                                                    <span className="font-black text-slate-900 text-xs">{selectedMaterial}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Bitolas Marcadas</span>
                                                                    <span className="font-bold text-slate-800 text-xs">{selectedBitolas.length} selecionadas</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Organização</span>
                                                                    <span className="font-bold text-blue-900 text-xs">Lado a Lado ({itemsPerColumn} linhas/coluna)</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Geral Lotes</span>
                                                                    <span className="font-black text-slate-900 text-sm">{consolidatedTotals.totalLots}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Peso Consolidado</span>
                                                                    <span className="font-black text-blue-900 text-sm">
                                                                        {consolidatedTotals.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-900 uppercase">MSM Gestão Inteligente</span>
                                                            <span className="text-slate-400">•</span>
                                                            <span className="font-bold text-slate-700">{selectedMaterial} (Continuação)</span>
                                                        </div>
                                                        <div className="text-right font-black text-slate-900 text-[11px]">
                                                            Folha {pageNum} de {totalPages}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* GRID DE COLUNAS LADO A LADO DA FOLHA */}
                                                <div 
                                                    className={`grid gap-2.5 items-start ${
                                                        columnsPerPage === 4 ? 'grid-cols-4' : 'grid-cols-3'
                                                    }`}
                                                >
                                                    {pageColumns.map(col => (
                                                        <div
                                                            key={col.id}
                                                            className="print-col-box border border-slate-700 rounded-md overflow-hidden bg-white shadow-2xs flex flex-col"
                                                        >
                                                            {/* CABEÇALHO DA COLUNA: Cor Clara, Nítida e Elegante (Economiza Toner e Alta Leitura) */}
                                                            <div className="bg-slate-100 text-slate-900 px-2 py-1.5 border-b-2 border-slate-700 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <h3 className="text-xs font-black uppercase tracking-tight text-slate-900">
                                                                        {col.displayName}
                                                                    </h3>
                                                                    {col.totalParts > 1 && (
                                                                        <span className="text-[9px] font-black bg-blue-100 text-blue-900 px-1 py-0.2 rounded border border-blue-300">
                                                                            {col.partIndex}/{col.totalParts} {col.partIndex > 1 ? '(Cont.)' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-600 uppercase block">
                                                                    {selectedMaterial} {col.displaySize ? `• ${col.displaySize}m` : ''}
                                                                </span>
                                                            </div>

                                                            {/* Tabela Ultra-Compacta: Máximo de linhas por folha */}
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-200/90 border-b border-slate-300 text-slate-800 font-black text-[9px] uppercase tracking-wider">
                                                                        {showData && <th className="py-1 px-1 text-center border-r border-slate-300">Data</th>}
                                                                        <th className="py-1 px-1.5 text-center border-r border-slate-300">Lote</th>
                                                                        {showCorrida && <th className="py-1 px-1 text-center border-r border-slate-300">Corrida</th>}
                                                                        <th className="py-1 px-1.5 text-right">Peso (kg)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-200">
                                                                    {col.lots.length === 0 ? (
                                                                        <tr>
                                                                            <td colSpan={2 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} className="py-6 text-center text-slate-400 italic font-medium text-[10px]">
                                                                                Sem lotes em estoque
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        col.lots.map((lot, lIdx) => (
                                                                            <tr key={lot.id} className={lIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                                                                                {showData && (
                                                                                    <td className="py-0.5 px-1 text-center font-medium text-slate-600 border-r border-slate-200 text-[9px]">
                                                                                        {new Date(lot.entryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                                                    </td>
                                                                                )}
                                                                                <td className="py-0.5 px-1.5 text-center font-black text-slate-900 border-r border-slate-200 text-[11px] font-mono">
                                                                                    {lot.internalLot}
                                                                                </td>
                                                                                {showCorrida && (
                                                                                    <td className="py-0.5 px-1 text-center font-bold text-amber-900 border-r border-slate-200 text-[9px]">
                                                                                        {lot.runNumber || '-'}
                                                                                    </td>
                                                                                )}
                                                                                <td className="py-0.5 px-1.5 text-right font-black text-slate-800 text-[11px] font-mono">
                                                                                    {lot.remainingQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))
                                                                    )}
                                                                </tbody>
                                                                {/* Rodapé da Coluna */}
                                                                <tfoot>
                                                                    <tr className="bg-slate-100 border-t-2 border-slate-700 font-black text-[10px] text-slate-900">
                                                                        <td colSpan={1 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} className="py-1 px-1.5 text-center border-r border-slate-300 uppercase">
                                                                            {col.totalParts > 1 ? (
                                                                                <span>{col.lots.length} lotes ({col.partIndex}/{col.totalParts})</span>
                                                                            ) : (
                                                                                <span>{col.totalGaugeLots} {col.totalGaugeLots === 1 ? 'lote' : 'lotes'}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-1 px-1.5 text-right font-black text-blue-900">
                                                                            {col.isLastPart || col.totalParts === 1 ? (
                                                                                <span>{col.totalGaugeWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</span>
                                                                            ) : (
                                                                                <span className="text-slate-600 font-medium">Sub: {col.partWeight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* RODAPÉ DA FOLHA / ASSINATURA */}
                                            {isLastPage ? (
                                                <div className="mt-5 pt-3 border-t border-dashed border-slate-400 flex justify-between items-end text-[9px] text-slate-500">
                                                    <div>
                                                        <p className="font-bold uppercase text-slate-700">Conferente / Responsável pelo Estoque:</p>
                                                        <div className="w-52 border-b border-slate-600 mt-5" />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-700">MSM Gestão Inteligente • Relatório Oficial</p>
                                                        <p className="font-mono">Página {pageNum} de {totalPages} • A4 Retrato</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
                                                    <span>Continua na próxima folha...</span>
                                                    <span>Folha {pageNum} de {totalPages}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Rodapé do Modal (no-print) */}
                <div className="no-print p-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>
                            Cálculo inteligente ativo: <strong>{printPages.length} {printPages.length === 1 ? 'folha' : 'folhas'}</strong> geradas em formato A4 Retrato.
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                        >
                            Fechar
                        </button>
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-6 py-2 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            <span>Imprimir / Gerar PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
