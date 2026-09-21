import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { StockItem, StockGauge } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, CA60BitolaOptions, DefaultTrelicaGauges, DefaultElectrodeGauges, DefaultSabaoGauges } from '../types';
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

export interface ProductOption {
    key: string;
    materialType: string;
    gauge: string;
    productCode: string;
    description: string;
    label: string;
    count: number;
    weight: number;
    tamanho?: string;
    superior?: string;
    inferior?: string;
    senozoide?: string;
    peso_final?: string;
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
    
    // PADRÃO DEFINITIVO PARA A4 RETRATO (3 COLUNAS LADO A LADO - ESCALA 100% NATIVA)
    const columnsPerPage = 3; // Fixo em 3 colunas: largura perfeita de ~62mm por coluna em A4
    const maxItemsPerColumn = 30; // Capacidade ideal de linhas em A4 Retrato com escala 100%
    const [showCorrida, setShowCorrida] = useState(false);
    const [showData, setShowData] = useState(false);

    // =========================================================================
    // 1. MAPEAMENTO DE PRODUTOS / BITOLAS / TRELIÇAS (COM CÓD. E DESCRIÇÃO)
    // =========================================================================
    const availableProductOptions = useMemo<ProductOption[]>(() => {
        if (!selectedMaterial) return [];

        const optionsMap = new Map<string, ProductOption>();

        // 1. Gauges cadastrados no banco para o material selecionado
        const relevantGauges = gauges.filter(g => g.materialType === selectedMaterial);
        
        relevantGauges.forEach(g => {
            const key = `${g.materialType}::${g.gauge}::${g.productCode || ''}::${g.description || ''}`;
            const codeText = g.productCode ? ` (Cód. ${g.productCode})` : '';
            
            let label = '';
            if (g.materialType === 'Treliça') {
                const desc = g.description || `Treliça ${g.gauge}`;
                const tam = g.tamanho ? ` ${g.tamanho}m` : (g.gauge.includes('m') ? ` ${g.gauge}` : '');
                label = `📐 ${desc}${tam}${codeText}`;
            } else if (g.materialType === 'Eletrodos Treliças') {
                const desc = g.description || `Eletrodo ${g.productCode || g.gauge}`;
                label = `⚡ ${desc}${codeText}`;
            } else if (g.materialType === 'Sabão') {
                label = `🧼 ${g.gauge} - ${g.description || 'Condat'}${codeText}`;
            } else {
                const descText = g.description ? ` - ${g.description}` : '';
                label = `${g.gauge.replace('.', ',')} mm${descText}${codeText}`;
            }

            optionsMap.set(key, {
                key,
                materialType: g.materialType,
                gauge: g.gauge,
                productCode: g.productCode || '',
                description: g.description || '',
                label,
                count: 0,
                weight: 0,
                tamanho: g.tamanho || (g.gauge.includes('m') ? g.gauge.replace('m', '') : undefined),
                superior: g.superior,
                inferior: g.inferior,
                senozoide: g.senozoide,
                peso_final: g.peso_final
            });
        });

        // 2. Defaults de Treliça
        if (selectedMaterial === 'Treliça') {
            DefaultTrelicaGauges.forEach(tg => {
                const key = `Treliça::${tg.gauge}::${tg.productCode}::${tg.description}`;
                if (!optionsMap.has(key)) {
                    const tam = tg.tamanho ? ` ${tg.tamanho}m` : '';
                    const code = tg.productCode ? ` (Cód. ${tg.productCode})` : '';
                    optionsMap.set(key, {
                        key,
                        materialType: 'Treliça',
                        gauge: tg.gauge,
                        productCode: tg.productCode || '',
                        description: tg.description || '',
                        label: `📐 ${tg.description}${tam}${code}`,
                        count: 0,
                        weight: 0,
                        tamanho: tg.tamanho,
                        superior: tg.superior,
                        inferior: tg.inferior,
                        senozoide: tg.senozoide,
                        peso_final: tg.peso_final
                    });
                }
            });
        }

        // 3. Defaults para CA-60 e Fio Máquina
        if (selectedMaterial === 'CA-60') {
            CA60BitolaOptions.forEach(b => {
                const hasExisting = Array.from(optionsMap.values()).some(o => o.gauge === b);
                if (!hasExisting) {
                    const key = `CA-60::${b}::::CA-60 ${b.replace('.', ',')}mm`;
                    optionsMap.set(key, {
                        key,
                        materialType: 'CA-60',
                        gauge: b,
                        productCode: '',
                        description: `CA-60 ${b.replace('.', ',')}mm`,
                        label: `${b.replace('.', ',')} mm`,
                        count: 0,
                        weight: 0
                    });
                }
            });
        } else if (selectedMaterial === 'Fio Máquina') {
            FioMaquinaBitolaOptions.forEach(b => {
                const hasExisting = Array.from(optionsMap.values()).some(o => o.gauge === b);
                if (!hasExisting) {
                    const key = `Fio Máquina::${b}::::Fio Máquina ${b.replace('.', ',')}mm`;
                    optionsMap.set(key, {
                        key,
                        materialType: 'Fio Máquina',
                        gauge: b,
                        productCode: '',
                        description: `Fio Máquina ${b.replace('.', ',')}mm`,
                        label: `${b.replace('.', ',')} mm`,
                        count: 0,
                        weight: 0
                    });
                }
            });
        } else if (selectedMaterial === 'Eletrodos Treliças') {
            DefaultElectrodeGauges.forEach(eg => {
                const key = `Eletrodos Treliças::${eg.gauge}::${eg.productCode}::${eg.description}`;
                if (!optionsMap.has(key)) {
                    optionsMap.set(key, {
                        key,
                        materialType: 'Eletrodos Treliças',
                        gauge: eg.gauge,
                        productCode: eg.productCode,
                        description: eg.description,
                        label: `⚡ ${eg.description} (Cód. ${eg.productCode})`,
                        count: 0,
                        weight: 0
                    });
                }
            });
        } else if (selectedMaterial === 'Sabão') {
            DefaultSabaoGauges.forEach(sg => {
                const key = `Sabão::${sg.gauge}::${sg.productCode}::${sg.description}`;
                if (!optionsMap.has(key)) {
                    optionsMap.set(key, {
                        key,
                        materialType: 'Sabão',
                        gauge: sg.gauge,
                        productCode: sg.productCode,
                        description: sg.description,
                        label: `🧼 ${sg.gauge} - ${sg.description} (Cód. ${sg.productCode})`,
                        count: 0,
                        weight: 0
                    });
                }
            });
        }

        // 4. Mapear itens reais de estoque ativo
        const activeItems = stock.filter(item => item.materialType === selectedMaterial && item.status !== 'Consumido');

        activeItems.forEach(item => {
            let matchedOption: ProductOption | undefined;

            if (item.productCode) {
                matchedOption = Array.from(optionsMap.values()).find(o => o.productCode && o.productCode.trim() === item.productCode?.trim());
            }

            if (!matchedOption && item.description) {
                matchedOption = Array.from(optionsMap.values()).find(o => 
                    o.description && o.description.trim().toLowerCase() === item.description?.trim().toLowerCase()
                );
            }

            if (!matchedOption && item.bitola) {
                const cleanBitola = item.bitola.replace(',', '.').replace(' mm', '').trim();
                matchedOption = Array.from(optionsMap.values()).find(o => {
                    const cleanGauge = o.gauge.replace(',', '.').replace(' mm', '').trim();
                    return cleanGauge === cleanBitola && !o.description?.includes('ROLO');
                });
            }

            if (matchedOption) {
                matchedOption.count += 1;
                matchedOption.weight += item.remainingQuantity;
            } else {
                const key = `${item.materialType}::${item.bitola}::${item.productCode || ''}::${item.description || ''}`;
                const codeText = item.productCode ? ` (Cód. ${item.productCode})` : '';
                const descText = item.description ? ` - ${item.description}` : '';
                const dynamicOpt: ProductOption = {
                    key,
                    materialType: item.materialType,
                    gauge: item.bitola,
                    productCode: item.productCode || '',
                    description: item.description || '',
                    label: `${item.bitola.replace('.', ',')} mm${descText}${codeText}`,
                    count: 1,
                    weight: item.remainingQuantity
                };
                optionsMap.set(key, dynamicOpt);
            }
        });

        // Ordenação
        return Array.from(optionsMap.values()).sort((a, b) => {
            if (selectedMaterial === 'Treliça') {
                return a.label.localeCompare(b.label);
            }
            const numA = parseFloat(a.gauge.replace(',', '.'));
            const numB = parseFloat(b.gauge.replace(',', '.'));
            if (!isNaN(numA) && !isNaN(numB)) {
                if (numA !== numB) return numA - numB;
                return (a.productCode || '').localeCompare(b.productCode || '');
            }
            return a.label.localeCompare(b.label);
        });
    }, [selectedMaterial, stock, gauges]);

    // Opções marcadas pelo usuário
    const [selectedOptionKeys, setSelectedOptionKeys] = useState<string[]>(() => {
        if (!initialBitola) return [];
        return [initialBitola];
    });

    // Pré-seleção automática inicial de produtos com estoque
    React.useEffect(() => {
        if (availableProductOptions.length > 0 && selectedOptionKeys.length === 0) {
            const withStock = availableProductOptions.filter(o => o.count > 0).map(o => o.key);
            if (withStock.length > 0) {
                setSelectedOptionKeys(withStock);
            } else {
                setSelectedOptionKeys([availableProductOptions[0].key]);
            }
        }
    }, [availableProductOptions]);

    const handleMaterialChange = (newMat: string) => {
        setSelectedMaterial(newMat);
        setSelectedOptionKeys([]);
    };

    const selectAllOptions = () => {
        setSelectedOptionKeys(availableProductOptions.map(o => o.key));
    };

    const selectOnlyWithStock = () => {
        const withStock = availableProductOptions.filter(o => o.count > 0).map(o => o.key);
        setSelectedOptionKeys(withStock);
    };

    const clearAllOptions = () => {
        setSelectedOptionKeys([]);
    };

    const toggleOption = (key: string) => {
        if (selectedOptionKeys.includes(key)) {
            setSelectedOptionKeys(selectedOptionKeys.filter(k => k !== key));
        } else {
            setSelectedOptionKeys([...selectedOptionKeys, key]);
        }
    };

    // =========================================================================
    // 2. ESTRUTURA DE COLUNA COM DIVISÃO E BALANCEAMENTO INTELIGENTE
    // =========================================================================
    interface PrintColumn {
        id: string;
        optionKey: string;
        materialType: string;
        gauge: string;
        productCode: string;
        description: string;
        displayName: string;
        displaySize?: string;
        partIndex: number;
        totalParts: number;
        lots: StockItem[];
        isLastPart: boolean;
        isFirstPart: boolean;
        totalGaugeLots: number;
        totalGaugeWeight: number;
        partWeight: number;
        superior?: string;
        inferior?: string;
        senozoide?: string;
        peso_final?: string;
    }

    const isLotForOption = (lot: StockItem, opt: ProductOption) => {
        if (lot.status === 'Consumido') return false;
        if (lot.materialType !== opt.materialType) return false;
        if (selectedSteelType && lot.steelType !== selectedSteelType) return false;
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(lot.status)) return false;

        if (lot.productCode && opt.productCode) {
            return lot.productCode.trim() === opt.productCode.trim();
        }

        if (opt.productCode && !lot.productCode) {
            if (lot.description && opt.description) {
                return lot.description.trim().toLowerCase() === opt.description.trim().toLowerCase();
            }
            if (opt.description?.includes('ROLO') || opt.label.includes('ROLO')) return false;
        }

        if (lot.description && opt.description && lot.description.trim().toLowerCase() === opt.description.trim().toLowerCase()) {
            return true;
        }

        const cleanBitola = lot.bitola.replace(',', '.').replace(' mm', '').trim();
        const cleanGauge = opt.gauge.replace(',', '.').replace(' mm', '').trim();
        if (cleanBitola === cleanGauge) {
            if (opt.description?.includes('ROLO') && !lot.description?.includes('ROLO')) return false;
            return true;
        }

        return false;
    };

    // DIVISÃO INTELIGENTE E BALANCEADA EM COLUNAS LADO A LADO
    const generatedColumns = useMemo(() => {
        const cols: PrintColumn[] = [];

        selectedOptionKeys.forEach(optKey => {
            const opt = availableProductOptions.find(o => o.key === optKey);
            if (!opt) return;

            const matchingLots = stock.filter(item => isLotForOption(item, opt)).sort((a, b) => {
                const numA = parseInt(a.internalLot) || 0;
                const numB = parseInt(b.internalLot) || 0;
                if (numA !== numB) return numA - numB;
                return a.internalLot.localeCompare(b.internalLot);
            });

            const totalGaugeWeight = matchingLots.reduce((sum, i) => sum + i.remainingQuantity, 0);
            const totalGaugeLots = matchingLots.length;

            if (matchingLots.length === 0) {
                cols.push({
                    id: `${opt.key}-empty`,
                    optionKey: opt.key,
                    materialType: opt.materialType,
                    gauge: opt.gauge,
                    productCode: opt.productCode,
                    description: opt.description,
                    displayName: opt.description || `${opt.gauge} mm`,
                    displaySize: opt.tamanho,
                    partIndex: 1,
                    totalParts: 1,
                    lots: [],
                    isFirstPart: true,
                    isLastPart: true,
                    totalGaugeLots: 0,
                    totalGaugeWeight: 0,
                    partWeight: 0,
                    superior: opt.superior,
                    inferior: opt.inferior,
                    senozoide: opt.senozoide,
                    peso_final: opt.peso_final
                });
            } else {
                // Algoritmo de Balanceamento Inteligente: divide igualmente
                const numParts = Math.max(1, Math.ceil(matchingLots.length / maxItemsPerColumn));
                const itemsPerPart = Math.ceil(matchingLots.length / numParts);

                const chunks: StockItem[][] = [];
                for (let i = 0; i < matchingLots.length; i += itemsPerPart) {
                    chunks.push(matchingLots.slice(i, i + itemsPerPart));
                }

                chunks.forEach((chunkLots, idx) => {
                    const partWeight = chunkLots.reduce((sum, i) => sum + i.remainingQuantity, 0);
                    cols.push({
                        id: `${opt.key}-part-${idx + 1}`,
                        optionKey: opt.key,
                        materialType: opt.materialType,
                        gauge: opt.gauge,
                        productCode: opt.productCode,
                        description: opt.description,
                        displayName: opt.description || `${opt.gauge} mm`,
                        displaySize: opt.tamanho,
                        partIndex: idx + 1,
                        totalParts: chunks.length,
                        lots: chunkLots,
                        isFirstPart: idx === 0,
                        isLastPart: idx === chunks.length - 1,
                        totalGaugeLots,
                        totalGaugeWeight,
                        partWeight,
                        superior: opt.superior,
                        inferior: opt.inferior,
                        senozoide: opt.senozoide,
                        peso_final: opt.peso_final
                    });
                });
            }
        });

        return cols;
    }, [selectedOptionKeys, availableProductOptions, stock, selectedSteelType, selectedStatuses]);

    // PAGINAÇÃO EM FOLHAS A4 COM 3 COLUNAS RÍGIDAS LADO A LADO
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

        selectedOptionKeys.forEach(optKey => {
            const opt = availableProductOptions.find(o => o.key === optKey);
            if (opt) {
                totalLots += opt.count;
                totalWeight += opt.weight;
            }
        });

        return { totalLots, totalWeight };
    }, [selectedOptionKeys, availableProductOptions]);

    const handleExecutePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    // RENDERIZADO VIA PORTAL DIRETAMENTE EM document.body PARA ISOLAR COMPLETAMENTE DO RESTANTE DO APP
    return createPortal(
        <div className="stock-print-portal-root fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
            {/* CSS FÍSICO INFALÍVEL DE IMPRESSÃO: OCULTA COMPLETAMENTE O APP DE TRÁS E IMPRIME APENAS O PORTAL */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait !important;
                        margin: 6mm 6mm 6mm 6mm !important;
                    }
                    /* ELIMINA 100% DO APP PRINCIPAL (TABELA DE ESTOQUE DE TRÁS, MENUS, HEADERS) */
                    #root {
                        display: none !important;
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
                    .no-print {
                        display: none !important;
                    }
                    .stock-print-portal-root {
                        position: static !important;
                        display: block !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        z-index: auto !important;
                    }
                    .stock-print-modal-box {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                        max-height: none !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .stock-printable-area {
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        color: #0f172a !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .print-sheet {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        min-height: 280mm !important;
                        padding: 2mm 0 !important;
                        margin-bottom: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .print-sheet:last-of-type {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .print-row-3cols {
                        display: flex !important;
                        flex-direction: row !important;
                        flex-wrap: nowrap !important;
                        justify-content: space-between !important;
                        align-items: flex-start !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        gap: 8px !important;
                    }
                    .print-col-fixed {
                        flex: 0 0 32.5% !important;
                        width: 32.5% !important;
                        max-width: 32.8% !important;
                        min-width: 32% !important;
                        box-sizing: border-box !important;
                    }
                    .print-table {
                        width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                    }
                    .print-table th, .print-table td {
                        border: 1px solid #cbd5e1 !important;
                        color: #0f172a !important;
                    }
                }
            `}</style>

            <div className="stock-print-modal-box bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header do Modal (no-print) */}
                <div className="no-print p-4 md:px-6 md:py-3.5 bg-gradient-to-r from-slate-900 via-[#0F3F5C] to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">
                            🖨️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">Impressão Padronizada de Estoque</h3>
                                <span className="text-[11px] font-black bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                                    A4 Retrato • 3 Colunas Lado a Lado
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80">Impressão isolada e limpa: apenas as folhas necessárias, sem duplicar com a tela de trás.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            <span>Imprimir Agora</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        >
                            <XIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Painel de Controles + Pré-Visualização */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* BARRA DE CONFIGURAÇÕES (NO-PRINT) */}
                    <div className="no-print p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
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

                            {/* 2. Colunas Opcionais */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                    2. Campos Extras
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

                            {/* 3. Resumo da Distribuição */}
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

                        {/* SELETOR DE PRODUTOS COM CHIPS */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Modelos e Códigos de {selectedMaterial} ({availableProductOptions.length} produtos):
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectOnlyWithStock}
                                        className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                                    >
                                        Apenas com Estoque ({availableProductOptions.filter(b => b.count > 0).length})
                                    </button>
                                    <span className="text-slate-300">•</span>
                                    <button
                                        type="button"
                                        onClick={selectAllOptions}
                                        className="text-[11px] font-bold text-slate-600 hover:underline cursor-pointer"
                                    >
                                        Marcar Todos
                                    </button>
                                    <span className="text-slate-300">•</span>
                                    <button
                                        type="button"
                                        onClick={clearAllOptions}
                                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white shadow-2xs">
                                {availableProductOptions.length === 0 && (
                                    <span className="text-xs text-slate-400 p-1">Nenhum produto cadastrado para este material.</span>
                                )}
                                {availableProductOptions.map(opt => {
                                    const isSelected = selectedOptionKeys.includes(opt.key);
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => toggleOption(opt.key)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
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
                                            <span>{opt.label}</span>
                                            <span className={`text-[10px] px-1 py-0 rounded-full font-black ${
                                                isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : opt.count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {opt.count}
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
                            {selectedOptionKeys.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-bold border-2 border-dashed border-slate-400 bg-white rounded-2xl shadow-sm">
                                    Nenhum produto selecionado. Marque os produtos no painel acima para calcular as colunas.
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
                                            style={{ minHeight: '280mm', boxSizing: 'border-box' }}
                                        >
                                            <div>
                                                {/* CABEÇALHO DO DOCUMENTO */}
                                                {isFirstPage ? (
                                                    <div className="border-b-2 border-slate-800 pb-2 mb-3">
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
                                                        <div className="mt-2 bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-300 flex flex-wrap items-center justify-between text-xs">
                                                            <div className="flex items-center gap-4">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Material</span>
                                                                    <span className="font-black text-slate-900 text-xs">{selectedMaterial}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Produtos Marcados</span>
                                                                    <span className="font-bold text-slate-800 text-xs">{selectedOptionKeys.length} selecionados</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Formato</span>
                                                                    <span className="font-bold text-blue-900 text-xs">A4 Retrato (3 Colunas Lado a Lado)</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Lotes</span>
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
                                                    <div className="border-b-2 border-slate-800 pb-1.5 mb-3 flex justify-between items-center text-xs">
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

                                                {/* GRID DE COLUNAS LADO A LADO DA FOLHA COM FLEXBOX RÍGIDO DE 3 COLUNAS */}
                                                <div 
                                                    className="print-row-3cols w-full"
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        flexWrap: 'nowrap',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        width: '100%',
                                                        gap: '8px',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    {pageColumns.map(col => (
                                                        <div
                                                            key={col.id}
                                                            className="print-col-fixed border-2 border-slate-700 rounded-md overflow-hidden bg-white shadow-2xs flex flex-col"
                                                            style={{
                                                                flex: '0 0 32.5%',
                                                                width: '32.5%',
                                                                maxWidth: '32.8%',
                                                                minWidth: '32%',
                                                                boxSizing: 'border-box'
                                                            }}
                                                        >
                                                            {/* CABEÇALHO DA COLUNA: Cor Clara, CÓDIGO DO PRODUTO DESTACADO NO CANTO SUPERIOR */}
                                                            <div className="bg-slate-100 text-slate-900 px-2 py-1.5 border-b-2 border-slate-700">
                                                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                                                                            {col.gauge ? `${col.gauge.replace('.', ',')}${!col.gauge.includes('mm') && !col.gauge.includes('m') ? ' mm' : ''}` : ''}
                                                                        </span>
                                                                        {col.totalParts > 1 && (
                                                                            <span className="text-[9px] font-black bg-blue-100 text-blue-900 px-1 py-0.2 rounded border border-blue-300">
                                                                                {col.partIndex}/{col.totalParts} {col.partIndex > 1 ? '(Cont.)' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {col.productCode && (
                                                                        <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.2 rounded shadow-2xs">
                                                                            CÓD. {col.productCode}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Descrição Completa do Produto */}
                                                                {col.description && (
                                                                    <div className="text-[10px] font-extrabold text-blue-950 truncate" title={col.description}>
                                                                        {col.description}
                                                                    </div>
                                                                )}

                                                                {/* Ficha Técnica para Treliças */}
                                                                {col.materialType === 'Treliça' && (col.displaySize || col.superior) && (
                                                                    <div className="text-[9px] text-slate-600 font-bold mt-0.5">
                                                                        {col.displaySize ? `Tam: ${col.displaySize}m ` : ''}
                                                                        {col.superior ? `• Sup: ${col.superior} | Inf: ${col.inferior} | Sen: ${col.senozoide}` : ''}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* TABELA COM LARGURAS FIXAS INFALÍVEIS (LOTE 52% | PESO 48%) */}
                                                            <table 
                                                                className="print-table w-full text-left"
                                                                style={{
                                                                    width: '100%',
                                                                    tableLayout: 'fixed',
                                                                    borderCollapse: 'collapse'
                                                                }}
                                                            >
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #64748b' }}>
                                                                        {showData && (
                                                                            <th style={{ width: '22%', padding: '4px 2px', textAlign: 'center', fontSize: '9px', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                                                                                DATA
                                                                            </th>
                                                                        )}
                                                                        <th style={{ width: showData || showCorrida ? '48%' : '52%', padding: '4px 4px', textAlign: 'center', fontSize: '10px', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                                                                            LOTE
                                                                        </th>
                                                                        {showCorrida && (
                                                                            <th style={{ width: '22%', padding: '4px 2px', textAlign: 'center', fontSize: '9px', fontWeight: 900, color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                                                                                CORR.
                                                                            </th>
                                                                        )}
                                                                        <th style={{ width: showData || showCorrida ? '30%' : '48%', padding: '4px 6px', textAlign: 'right', fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>
                                                                            PESO (KG)
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {col.lots.length === 0 ? (
                                                                        <tr>
                                                                            <td colSpan={2 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} style={{ padding: '16px 4px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '11px' }}>
                                                                                Sem lotes em estoque
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        col.lots.map((lot, lIdx) => (
                                                                            <tr key={lot.id} style={{ backgroundColor: lIdx % 2 === 1 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                                                                                {showData && (
                                                                                    <td style={{ width: '22%', padding: '2px 2px', textAlign: 'center', fontSize: '9px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                                                                                        {new Date(lot.entryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                                                    </td>
                                                                                )}
                                                                                <td style={{ width: showData || showCorrida ? '48%' : '52%', padding: '3px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 900, fontFamily: 'monospace', color: '#0f172a', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                    {lot.internalLot}
                                                                                </td>
                                                                                {showCorrida && (
                                                                                    <td style={{ width: '22%', padding: '2px 2px', textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#78350f', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                        {lot.runNumber || '-'}
                                                                                    </td>
                                                                                )}
                                                                                <td style={{ width: showData || showCorrida ? '30%' : '48%', padding: '3px 6px', textAlign: 'right', fontSize: '11px', fontWeight: 900, fontFamily: 'monospace', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                                                                    {lot.remainingQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))
                                                                    )}
                                                                </tbody>
                                                                {/* Rodapé da Coluna com Totais */}
                                                                <tfoot>
                                                                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #334155', fontWeight: 900, color: '#0f172a' }}>
                                                                        <td colSpan={1 + (showData ? 1 : 0) + (showCorrida ? 1 : 0)} style={{ padding: '4px 6px', textAlign: 'center', fontSize: '10px', borderRight: '1px solid #cbd5e1' }}>
                                                                            {col.totalParts > 1 ? (
                                                                                <span>{col.lots.length} lotes ({col.partIndex}/{col.totalParts})</span>
                                                                            ) : (
                                                                                <span>{col.totalGaugeLots} {col.totalGaugeLots === 1 ? 'lote' : 'lotes'}</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: '11px', fontWeight: 900, color: '#0F3F5C' }}>
                                                                            {col.isLastPart || col.totalParts === 1 ? (
                                                                                <span>{col.totalGaugeWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</span>
                                                                            ) : (
                                                                                <span style={{ color: '#475569', fontSize: '9px' }}>Sub: {col.partWeight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</span>
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
                                                <div className="mt-4 pt-2 border-t border-dashed border-slate-400 flex justify-between items-end text-[9px] text-slate-500">
                                                    <div>
                                                        <p className="font-bold uppercase text-slate-700">Conferente / Responsável pelo Estoque:</p>
                                                        <div className="w-52 border-b border-slate-600 mt-5" />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-700">MSM Gestão Inteligente • Relatório Oficial</p>
                                                        <p className="font-mono">Página {pageNum} de {totalPages} • A4 Retrato (3 Colunas)</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 pt-1.5 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
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
                            Layout padrão de 3 colunas A4 Retrato: <strong>{printPages.length} {printPages.length === 1 ? 'folha' : 'folhas'}</strong> calculadas. Pronto para imprimir sem ajustes manuais.
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition cursor-pointer"
                        >
                            Fechar
                        </button>
                        <button
                            type="button"
                            onClick={handleExecutePrint}
                            className="px-6 py-2 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            <span>Imprimir / Gerar PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
