import React, { useState, useMemo } from 'react';
import type { StockItem, StockGauge, MaterialType } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, CA60BitolaOptions, DefaultTrelicaGauges, DefaultElectrodeGauges, DefaultSabaoGauges } from '../types';
import { PrinterIcon, XIcon, CheckCircleIcon, AdjustmentsIcon } from './icons';

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
    // Modo de Impressão: 'side_by_side' (Lado a Lado - Estilo Excel) ou 'full_table' (Lista Contínua)
    const [printMode, setPrintMode] = useState<'side_by_side' | 'full_table'>('side_by_side');

    // Filtros de seleção no modal
    const [selectedMaterial, setSelectedMaterial] = useState<string>(initialMaterial || 'CA-60');
    const [selectedSteelType, setSelectedSteelType] = useState<string>(initialSteelType || '');
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Disponível', 'Disponível - Suporte Treliça']);
    
    // Opções de colunas na mini-tabela
    const [showCorrida, setShowCorrida] = useState(false);
    const [showData, setShowData] = useState(false);
    const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('landscape');

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

    // Bitolas marcadas pelo usuário (por padrão, as que têm estoque ou a inicial)
    const [selectedBitolas, setSelectedBitolas] = useState<string[]>(() => {
        if (initialBitola) {
            // Extrai bitola limpa se vier em formato chave
            const clean = initialBitola.includes('::') ? initialBitola.split('::')[1] : initialBitola;
            return [clean];
        }
        return [];
    });

    // Atualiza bitolas selecionadas ao trocar de material
    const handleMaterialChange = (newMat: string) => {
        setSelectedMaterial(newMat);
        // Pré-seleciona todas as bitolas que possuem estoque desse material
        const withStock = stock
            .filter(i => i.materialType === newMat && i.status !== 'Consumido')
            .map(i => i.bitola);
        const uniqueWithStock = Array.from(new Set(withStock));
        setSelectedBitolas(uniqueWithStock.length > 0 ? uniqueWithStock : []);
    };

    // Marcar / Desmarcar todas
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

    // Agrupamento dos lotes para o relatório Lado a Lado
    const groupedData = useMemo(() => {
        return selectedBitolas.map(bitola => {
            const lots = stock.filter(item => {
                if (item.status === 'Consumido') return false;
                if (selectedMaterial && item.materialType !== selectedMaterial) return false;
                if (item.bitola !== bitola) return false;
                if (selectedSteelType && item.steelType !== selectedSteelType) return false;
                if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) return false;
                return true;
            }).sort((a, b) => {
                // Ordena por lote numérico
                const numA = parseInt(a.internalLot) || 0;
                const numB = parseInt(b.internalLot) || 0;
                if (numA !== numB) return numA - numB;
                return a.internalLot.localeCompare(b.internalLot);
            });

            const totalWeight = lots.reduce((sum, i) => sum + i.remainingQuantity, 0);

            // Informações extras da bitola (ex: descrição, tamanho)
            const gaugeInfo = gauges.find(g => g.materialType === selectedMaterial && g.gauge === bitola);
            const defaultTrelica = selectedMaterial === 'Treliça' ? DefaultTrelicaGauges.find(t => t.gauge === bitola) : null;
            const displayName = gaugeInfo?.description || defaultTrelica?.description || `${bitola} mm`;
            const displaySize = gaugeInfo?.tamanho || defaultTrelica?.tamanho;

            return {
                bitola,
                displayName,
                displaySize,
                lots,
                totalLots: lots.length,
                totalWeight
            };
        });
    }, [selectedBitolas, stock, selectedMaterial, selectedSteelType, selectedStatuses, gauges]);

    // Totais consolidados
    const consolidatedTotals = useMemo(() => {
        let totalLots = 0;
        let totalWeight = 0;
        groupedData.forEach(g => {
            totalLots += g.totalLots;
            totalWeight += g.totalWeight;
        });
        return { totalLots, totalWeight };
    }, [groupedData]);

    const handleExecutePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
            {/* CSS específico de impressão para este modal */}
            <style>{`
                @media print {
                    @page {
                        size: A4 ${pageOrientation};
                        margin: 6mm 6mm 8mm 6mm;
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
                    .print-break-inside-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header da Central de Impressão */}
                <div className="no-print p-4 md:px-6 md:py-4 bg-gradient-to-r from-slate-900 via-[#0F3F5C] to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">
                            🖨️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">Central de Impressão de Estoque</h3>
                                <span className="text-[11px] font-bold bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                                    A4 Otimizado
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80">Configure o material, as bitolas e o layout resumido em colunas lado a lado.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
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

                {/* Corpo do Modal: Painel de Configurações (Topo) + Pré-Visualização (Abaixo) */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* BARRA DE CONFIGURAÇÕES (NO-PRINT) */}
                    <div className="no-print p-4 md:p-5 bg-slate-50 border-b border-slate-200 space-y-4 shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            {/* 1. Seleção de Material */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
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

                            {/* 2. Formato de Página */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                                    2. Orientação do Papel
                                </label>
                                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setPageOrientation('landscape')}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition ${
                                            pageOrientation === 'landscape'
                                                ? 'bg-[#0F3F5C] text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        📄 Paisagem (Ideal)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPageOrientation('portrait')}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition ${
                                            pageOrientation === 'portrait'
                                                ? 'bg-[#0F3F5C] text-white shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        📜 Retrato
                                    </button>
                                </div>
                            </div>

                            {/* 3. Campos Extras */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                                    3. Colunas Opcionais
                                </label>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition shadow-2xs">
                                        <input
                                            type="checkbox"
                                            checked={showCorrida}
                                            onChange={e => setShowCorrida(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded accent-[#0F3F5C]"
                                        />
                                        <span>🏷️ Corrida</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition shadow-2xs">
                                        <input
                                            type="checkbox"
                                            checked={showData}
                                            onChange={e => setShowData(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded accent-[#0F3F5C]"
                                        />
                                        <span>📅 Data</span>
                                    </label>
                                </div>
                            </div>

                            {/* 4. Resumo de Seleção */}
                            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-blue-900 uppercase block">Bitolas Marcadas</span>
                                    <span className="text-base font-black text-blue-900">{selectedBitolas.length} de {availableBitolasForMaterial.length}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-blue-900 uppercase block">Total a Imprimir</span>
                                    <span className="text-sm font-black text-emerald-700">{consolidatedTotals.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</span>
                                </div>
                            </div>
                        </div>

                        {/* SELETOR DE BITOLAS COM CHIPS */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                                    <span>Selecione as bitolas que deseja imprimir lado a lado:</span>
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

                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-white shadow-2xs">
                                {availableBitolasForMaterial.length === 0 && (
                                    <span className="text-xs text-slate-400 p-2">Nenhuma bitola encontrada para este material.</span>
                                )}
                                {availableBitolasForMaterial.map(b => {
                                    const isSelected = selectedBitolas.includes(b.key);
                                    return (
                                        <button
                                            key={b.key}
                                            type="button"
                                            onClick={() => toggleBitola(b.key)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
                                                isSelected
                                                    ? 'bg-[#0F3F5C] text-white border-[#0F3F5C] shadow-xs'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                className="h-3.5 w-3.5 rounded accent-white pointer-events-none"
                                            />
                                            <span>{b.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                                isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : b.count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {b.count} {b.count === 1 ? 'lote' : 'lotes'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ÁREA DE PRÉ-VISUALIZAÇÃO / IMPRESSÃO REAL */}
                    <div className="p-4 md:p-8 bg-slate-200/60 overflow-y-auto flex-1 flex justify-center">
                        <div className="stock-printable-area bg-white text-slate-900 w-full max-w-6xl shadow-xl rounded-xl p-6 md:p-8 border border-slate-300">
                            {/* Cabeçalho do Relatório Impresso */}
                            <div className="border-b-2 border-slate-900 pb-4 mb-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                                            MSM <span className="text-slate-500 font-light">Gestão Inteligente</span>
                                        </h1>
                                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                                            Relatório de Inventário Resumido por Bitola (Lado a Lado)
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-900">
                                            {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-[10px] text-slate-500 italic">MSM Control • Setor Produção / Estoque</p>
                                    </div>
                                </div>

                                {/* Faixa de Parâmetros e Totais Consolidados */}
                                <div className="mt-4 bg-slate-100 rounded-lg p-3 border border-slate-300 flex flex-wrap items-center justify-between gap-4 text-xs">
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Material</span>
                                            <span className="font-black text-slate-900 text-sm">{selectedMaterial}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Bitolas Impressas</span>
                                            <span className="font-bold text-slate-800">{selectedBitolas.length} selecionadas</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total de Lotes</span>
                                            <span className="font-black text-slate-900 text-base">{consolidatedTotals.totalLots}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Peso Total Consolidado</span>
                                            <span className="font-black text-blue-900 text-base">
                                                {selectedMaterial === 'Eletrodos Treliças'
                                                    ? `${consolidatedTotals.totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} un`
                                                    : `${consolidatedTotals.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* GRADE DAS COLUNAS LADO A LADO (EXATAMENTE COMO O DESENHO DO USUÁRIO NO EXCEL) */}
                            {selectedBitolas.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-300 rounded-xl">
                                    Nenhuma bitola selecionada. Marque as bitolas acima para gerar as colunas de impressão.
                                </div>
                            ) : (
                                <div className={`grid gap-4 items-start ${
                                    groupedData.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                                    groupedData.length === 2 ? 'grid-cols-2' :
                                    groupedData.length === 3 ? 'grid-cols-3' :
                                    groupedData.length === 4 ? 'grid-cols-4' :
                                    'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                                }`}>
                                    {groupedData.map(group => (
                                        <div 
                                            key={group.bitola}
                                            className="print-break-inside-avoid border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-xs"
                                        >
                                            {/* Cabeçalho da Caixa de Bitola (Ex: 3,20 mm (ca60)) */}
                                            <div className="bg-slate-900 text-white p-2 text-center border-b-2 border-slate-900">
                                                <h3 className="text-sm font-black tracking-tight leading-tight">
                                                    {group.displayName}
                                                </h3>
                                                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">
                                                    {selectedMaterial} {group.displaySize ? `• ${group.displaySize}m` : ''}
                                                </span>
                                            </div>

                                            {/* Tabela Lote x Peso */}
                                            <table className="w-full text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-black text-[10px] uppercase">
                                                        {showData && <th className="p-1.5 text-center border-r border-slate-300">Data</th>}
                                                        <th className="p-1.5 text-center border-r border-slate-300">Lote</th>
                                                        {showCorrida && <th className="p-1.5 text-center border-r border-slate-300">Corrida</th>}
                                                        <th className="p-1.5 text-right pr-2.5">
                                                            {selectedMaterial === 'Eletrodos Treliças' ? 'Qtd (un)' : 'Peso (kg)'}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {group.lots.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={2 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} className="p-4 text-center text-slate-400 italic font-medium text-[11px]">
                                                                Sem lotes no momento
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        group.lots.map(lot => (
                                                            <tr key={lot.id} className="hover:bg-slate-50">
                                                                {showData && (
                                                                    <td className="p-1 text-center font-medium text-slate-500 border-r border-slate-200 text-[10px]">
                                                                        {new Date(lot.entryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                                    </td>
                                                                )}
                                                                <td className="p-1.5 text-center font-black text-slate-900 border-r border-slate-200 text-xs">
                                                                    {lot.internalLot}
                                                                </td>
                                                                {showCorrida && (
                                                                    <td className="p-1 text-center font-bold text-amber-800 border-r border-slate-200 text-[10px]">
                                                                        {lot.runNumber || '-'}
                                                                    </td>
                                                                )}
                                                                <td className="p-1.5 text-right font-black text-slate-800 pr-2.5 text-xs">
                                                                    {selectedMaterial === 'Eletrodos Treliças'
                                                                        ? `${lot.remainingQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
                                                                        : `${lot.remainingQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                {/* Rodapé da Coluna com Totais da Bitola */}
                                                <tfoot>
                                                    <tr className="bg-slate-100 border-t-2 border-slate-900 font-black text-xs text-slate-900">
                                                        <td colSpan={1 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} className="p-1.5 text-center border-r border-slate-300 text-[10px] uppercase">
                                                            {group.totalLots} {group.totalLots === 1 ? 'lote' : 'lotes'}
                                                        </td>
                                                        <td className="p-1.5 text-right pr-2.5 font-black text-blue-900">
                                                            {selectedMaterial === 'Eletrodos Treliças'
                                                                ? `${group.totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} un`
                                                                : `${group.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Assinatura / Rodapé de Impressão */}
                            <div className="mt-8 pt-4 border-t border-dashed border-slate-400 flex justify-between items-end text-[10px] text-slate-500">
                                <div>
                                    <p className="font-bold uppercase">Conferente / Responsável pelo Estoque:</p>
                                    <div className="w-56 border-b border-slate-600 mt-6" />
                                </div>
                                <div className="text-right">
                                    <p>Página gerada via Sistema de Gestão Inteligente MSM</p>
                                    <p className="font-mono font-bold">Relatório Oficial de Conferência Física</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Rodapé do Modal (no-print) */}
                <div className="no-print p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        Dica: para caber mais bitolas lado a lado, use a orientação <strong>Paisagem</strong>.
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                        >
                            Fechar
                        </button>
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-6 py-2.5 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
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
