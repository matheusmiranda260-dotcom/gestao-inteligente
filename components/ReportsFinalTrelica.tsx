import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, StockItem, StockGauge } from '../types';
import html2canvas from 'html2canvas';
import { trelicaModels } from './ProductionOrderTrelica';

interface ReportsFinalTrelicaProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
    gauges?: StockGauge[];
}

interface ProductionRow {
    id: string;
    qnt: number | '';
    peso: number | '';
    data: string;
}

interface GaugeRow {
    id: string;
    lote: string;
    peso: number | '';
    usado: number | '';
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

const matchBitola = (itemBitola: string, selectedBitola: string): boolean => {
    if (!itemBitola || !selectedBitola) return false;
    const normalize = (val: string) => val.replace('mm', '').trim().replace(',', '.');
    try {
        return parseFloat(normalize(itemBitola)) === parseFloat(normalize(selectedBitola));
    } catch {
        return false;
    }
};

const ReportsFinalTrelica: React.FC<ReportsFinalTrelicaProps> = ({ stock = [], setPage, gauges = [] }) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('sv'));
    const [ordemProducao, setOrdemProducao] = useState<string>('');
    const [responsavel, setResponsavel] = useState<string>('');
    
    // Meta de produção
    const [piecesToProduce, setPiecesToProduce] = useState<number | ''>('');

    // Modelo de Treliça Selecionado
    const [selectedModelCod, setSelectedModelCod] = useState<string>('');

    const normalizeBitolaVal = (val: string): string => {
        if (!val) return '';
        const num = parseFloat(val.replace(',', '.'));
        return isNaN(num) ? '' : num.toFixed(2);
    };

    const handleModelChange = (cod: string) => {
        setSelectedModelCod(cod);
        if (cod) {
            const model = trelicaModels.find(m => m.cod === cod);
            if (model) {
                setBitolaBlock1(normalizeBitolaVal(model.superior));
                setBitolaBlock2(normalizeBitolaVal(model.inferior));
                setBitolaBlock3(normalizeBitolaVal(model.senozoide));
            }
        }
    };

    // Bitolas disponíveis de CA-60 no sistema (combinando padrão + DB + estoque)
    const CA60Bitolas = useMemo(() => {
        const defaultOptions = ['3.20', '3.40', '3.80', '4.20', '4.40', '4.90', '5.00', '5.50', '5.60', '5.80', '6.00', '6.35', '7.00'];
        const dbGauges = gauges
            ? gauges.filter(g => g.materialType === 'CA-60').map(g => g.gauge)
            : [];
        const stockGauges = stock
            ? stock.filter(i => i.materialType === 'CA-60' && i.bitola).map(i => i.bitola)
            : [];
            
        const all = [...new Set([...defaultOptions, ...dbGauges, ...stockGauges])];
        return all
            .filter(Boolean)
            .sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
    }, [gauges, stock]);

    // Bitolas selecionadas para cada bloco
    const [bitolaBlock1, setBitolaBlock1] = useState<string>('6.00');
    const [bitolaBlock2, setBitolaBlock2] = useState<string>('3.80');
    const [bitolaBlock3, setBitolaBlock3] = useState<string>('4.20');

    // Linhas vazias de controle
    const createEmptyProductionRow = (): ProductionRow => ({
        id: Math.random().toString(36).substring(2, 9),
        qnt: '',
        peso: '',
        data: ''
    });

    const createEmptyGaugeRow = (): GaugeRow => ({
        id: Math.random().toString(36).substring(2, 9),
        lote: '',
        peso: '',
        usado: ''
    });

    // Tabelas principais
    const [prodRows, setProdRows] = useState<ProductionRow[]>(() => Array.from({ length: 6 }, createEmptyProductionRow));
    const [rows6mm, setRows6mm] = useState<GaugeRow[]>(() => Array.from({ length: 5 }, createEmptyGaugeRow));
    const [rows3_8mm, setRows3_8mm] = useState<GaugeRow[]>(() => Array.from({ length: 5 }, createEmptyGaugeRow));
    const [rows4_2mm, setRows4_2mm] = useState<GaugeRow[]>(() => Array.from({ length: 5 }, createEmptyGaugeRow));

    // Pesos previstos (manuais)
    const [previsto6mm, setPrevisto6mm] = useState<number | ''>('');
    const [previsto3_8mm, setPrevisto3_8mm] = useState<number | ''>('');
    const [previsto4_2mm, setPrevisto4_2mm] = useState<number | ''>('');

    // Autocomplete State
    const [activeSuggestion, setActiveSuggestion] = useState<{
        tableType: '6mm' | '3_8mm' | '4_2mm';
        rowId: string;
    } | null>(null);
    const [filterText, setFilterText] = useState<string>('');
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Sistema de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    // Fechar sugestões no clique externo
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setActiveSuggestion(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Lógica do autocomplete de Lote
    const suggestions = useMemo(() => {
        if (!activeSuggestion) return [];
        const lower = filterText.toLowerCase().trim();

        // Determinar a bitola selecionada para o bloco atual
        let selectedBitola = '';
        if (activeSuggestion.tableType === '6mm') selectedBitola = bitolaBlock1;
        else if (activeSuggestion.tableType === '3_8mm') selectedBitola = bitolaBlock2;
        else selectedBitola = bitolaBlock3;

        return stock
            .filter(item => {
                // 1. Filtrar pelo tipo de material (CA-60)
                const isCA60 = item.materialType === 'CA-60';
                if (!isCA60) return false;

                // 2. Filtrar pelo status e saldo (lotes disponíveis)
                const isAvailable = item.status && item.status.includes('Disponível') && item.remainingQuantity > 0;
                if (!isAvailable) return false;

                // 3. Filtrar pela bitola selecionada
                const isMatchingBitola = matchBitola(item.bitola, selectedBitola);
                if (!isMatchingBitola) return false;

                // 4. Filtrar pelo lote digitado (busca parcial se houver texto)
                if (lower) {
                    const matchesSearch = (item.internalLot && item.internalLot.toLowerCase().includes(lower)) || 
                                          (item.supplierLot && item.supplierLot.toLowerCase().includes(lower));
                    if (!matchesSearch) return false;
                }

                return true;
            })
            .slice(0, 6);
    }, [stock, filterText, activeSuggestion, bitolaBlock1, bitolaBlock2, bitolaBlock3]);

    const handleLoteChange = (tableType: '6mm' | '3_8mm' | '4_2mm', rowId: string, value: string) => {
        const updater = (rows: GaugeRow[]) => rows.map(r => r.id === rowId ? { ...r, lote: value } : r);
        if (tableType === '6mm') setRows6mm(updater);
        else if (tableType === '3_8mm') setRows3_8mm(updater);
        else setRows4_2mm(updater);

        setFilterText(value);
        setActiveSuggestion({ tableType, rowId });
    };

    const handleSelectSuggestion = (tableType: '6mm' | '3_8mm' | '4_2mm', rowId: string, item: StockItem) => {
        const selectedLot = item.internalLot || item.supplierLot || '';
        const lotWeight = item.remainingQuantity || item.weight || item.labelWeight || '';

        const updater = (rows: GaugeRow[]) => rows.map(r => r.id === rowId ? {
            ...r,
            lote: selectedLot,
            peso: lotWeight,
            usado: lotWeight // padrão preenche igual
        } : r);

        if (tableType === '6mm') setRows6mm(updater);
        else if (tableType === '3_8mm') setRows3_8mm(updater);
        else setRows4_2mm(updater);

        setActiveSuggestion(null);
        showToast(`Lote ${selectedLot} importado com sucesso!`, 'success');
    };

    // Cálculos de Totais - Top Table
    const prodTotals = useMemo(() => {
        let totalQnt = 0;
        let totalWeight = 0;

        prodRows.forEach(r => {
            if (typeof r.qnt === 'number') totalQnt += r.qnt;
            if (typeof r.peso === 'number') totalWeight += r.peso;
        });

        const overallAverage = totalQnt > 0 ? totalWeight / totalQnt : 0;

        return {
            totalQnt,
            totalWeight,
            overallAverage
        };
    }, [prodRows]);

    // Cálculos de Totais - Gauge Tables
    const getGaugeTotals = (rows: GaugeRow[]) => {
        let totalWeight = 0;
        let totalUsed = 0;

        rows.forEach(r => {
            if (typeof r.peso === 'number') totalWeight += r.peso;
            if (typeof r.usado === 'number') totalUsed += r.usado;
        });

        const totalRemaining = totalWeight - totalUsed;

        return {
            totalWeight,
            totalUsed,
            totalRemaining
        };
    };

    const stats6mm = useMemo(() => getGaugeTotals(rows6mm), [rows6mm]);
    const stats3_8mm = useMemo(() => getGaugeTotals(rows3_8mm), [rows3_8mm]);
    const stats4_2mm = useMemo(() => getGaugeTotals(rows4_2mm), [rows4_2mm]);

    // Local Storage Draft
    const DRAFT_KEY = 'relatorio_final_trelica_draft';

    const loadDraft = () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.selectedDate) setSelectedDate(data.selectedDate);
                if (data.ordemProducao) setOrdemProducao(data.ordemProducao);
                if (data.responsavel) setResponsavel(data.responsavel);
                if (data.piecesToProduce !== undefined) setPiecesToProduce(data.piecesToProduce);
                if (data.selectedModelCod) setSelectedModelCod(data.selectedModelCod);
                if (data.prodRows) setProdRows(data.prodRows);
                if (data.rows6mm) setRows6mm(data.rows6mm);
                if (data.rows3_8mm) setRows3_8mm(data.rows3_8mm);
                if (data.rows4_2mm) setRows4_2mm(data.rows4_2mm);
                if (data.previsto6mm !== undefined) setPrevisto6mm(data.previsto6mm);
                if (data.previsto3_8mm !== undefined) setPrevisto3_8mm(data.previsto3_8mm);
                if (data.previsto4_2mm !== undefined) setPrevisto4_2mm(data.previsto4_2mm);
                if (data.bitolaBlock1) setBitolaBlock1(data.bitolaBlock1);
                if (data.bitolaBlock2) setBitolaBlock2(data.bitolaBlock2);
                if (data.bitolaBlock3) setBitolaBlock3(data.bitolaBlock3);
                showToast('Rascunho do Relatório Final carregado.', 'info');
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho:', e);
        } finally {
            setLoading(false);
        }
    };

    const saveDraft = () => {
        const payload = {
            selectedDate,
            ordemProducao,
            responsavel,
            piecesToProduce,
            selectedModelCod,
            prodRows,
            rows6mm,
            rows3_8mm,
            rows4_2mm,
            previsto6mm,
            previsto3_8mm,
            previsto4_2mm,
            bitolaBlock1,
            bitolaBlock2,
            bitolaBlock3
        };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch (e) {
            console.error('Erro ao salvar rascunho:', e);
        }
    };

    useEffect(() => {
        loadDraft();
    }, []);

    // Autosave com debounce
    useEffect(() => {
        if (loading) return;
        const timer = setTimeout(() => {
            saveDraft();
        }, 800);
        return () => clearTimeout(timer);
    }, [selectedDate, ordemProducao, responsavel, piecesToProduce, prodRows, rows6mm, rows3_8mm, rows4_2mm, previsto6mm, previsto3_8mm, previsto4_2mm, bitolaBlock1, bitolaBlock2, bitolaBlock3, loading, selectedModelCod]);

    // Operações em Linhas
    const updateProdRowField = (rowId: string, field: keyof ProductionRow, value: any) => {
        setProdRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    const addProdRow = () => {
        setProdRows(prev => [...prev, createEmptyProductionRow()]);
    };

    const removeProdRow = (rowId: string) => {
        setProdRows(prev => prev.filter(r => r.id !== rowId));
    };

    const updateGaugeRowField = (tableType: '6mm' | '3_8mm' | '4_2mm', rowId: string, field: keyof GaugeRow, value: any) => {
        const updater = (rows: GaugeRow[]) => rows.map(r => r.id === rowId ? { ...r, [field]: value } : r);
        if (tableType === '6mm') setRows6mm(updater);
        else if (tableType === '3_8mm') setRows3_8mm(updater);
        else setRows4_2mm(updater);
    };

    const addGaugeRow = (tableType: '6mm' | '3_8mm' | '4_2mm') => {
        const row = createEmptyGaugeRow();
        if (tableType === '6mm') setRows6mm(prev => [...prev, row]);
        else if (tableType === '3_8mm') setRows3_8mm(prev => [...prev, row]);
        else setRows4_2mm(prev => [...prev, row]);
    };

    const removeGaugeRow = (tableType: '6mm' | '3_8mm' | '4_2mm', rowId: string) => {
        if (tableType === '6mm') setRows6mm(prev => prev.filter(r => r.id !== rowId));
        else if (tableType === '3_8mm') setRows3_8mm(prev => prev.filter(r => r.id !== rowId));
        else setRows4_2mm(prev => prev.filter(r => r.id !== rowId));
    };

    const clearForm = () => {
        const confirm = window.confirm("Deseja realmente limpar toda a planilha?");
        if (!confirm) return;

        setOrdemProducao('');
        setResponsavel('');
        setPiecesToProduce('');
        setSelectedModelCod('');
        setProdRows(Array.from({ length: 6 }, createEmptyProductionRow));
        setRows6mm(Array.from({ length: 5 }, createEmptyGaugeRow));
        setRows3_8mm(Array.from({ length: 5 }, createEmptyGaugeRow));
        setRows4_2mm(Array.from({ length: 5 }, createEmptyGaugeRow));
        setPrevisto6mm('');
        setPrevisto3_8mm('');
        setPrevisto4_2mm('');
        setBitolaBlock1('6.00');
        setBitolaBlock2('3.80');
        setBitolaBlock3('4.20');
        localStorage.removeItem(DRAFT_KEY);
        showToast('Planilha redefinida com sucesso.', 'success');
    };

    const loadSampleData = () => {
        setOrdemProducao('84536');
        setResponsavel('Matheus Miranda');
        setPiecesToProduce(10000);
        setSelectedModelCod('H8P12');
        setBitolaBlock1('6.00');
        setBitolaBlock2('3.80');
        setBitolaBlock3('4.20');

        setProdRows([
            { id: 'p1', qnt: 803, peso: 3220, data: '22/04/26' },
            { id: 'p2', qnt: 1179, peso: 4727, data: '23/04/26' },
            { id: 'p3', qnt: 1213, peso: 4864, data: '24/04/26' },
            { id: 'p4', qnt: 1091, peso: 4375, data: '27/04/26' },
            { id: 'p5', qnt: 1211, peso: 4868, data: '28/04/26' },
            { id: 'p6', qnt: 1139, peso: 4567, data: '29/04/26' },
            { id: 'p7', qnt: 1121, peso: 4506, data: '30/04/26' },
            { id: 'p8', qnt: 1114, peso: 4478, data: '04/05/26' },
            { id: 'p9', qnt: 1175, peso: 4723, data: '05/05/26' }
        ]);

        setPrevisto6mm(13416);
        setRows6mm([
            { id: 'g6-1', lote: '6359', peso: 2129, usado: 2129 },
            { id: 'g6-2', lote: '6364', peso: 2184, usado: 2184 },
            { id: 'g6-3', lote: '6368', peso: 2240, usado: 2240 },
            { id: 'g6-4', lote: '6371', peso: 2200, usado: 2200 },
            { id: 'g6-5', lote: '7444', peso: 2036, usado: 2036 },
            { id: 'g6-6', lote: '7445', peso: 2088, usado: 2088 },
            { id: 'g6-7', lote: '7454', peso: 2064, usado: 537 }
        ]);

        setPrevisto3_8mm(13999);
        setRows3_8mm([
            { id: 'g3-1', lote: 'sem lote', peso: 2112, usado: 2112 },
            { id: 'g3-2', lote: 'sem lote', peso: 2164, usado: 2164 },
            { id: 'g3-3', lote: 'sem lote', peso: 2119, usado: 2119 },
            { id: 'g3-4', lote: '5757', peso: 2209, usado: 2209 },
            { id: 'g3-5', lote: '7739', peso: 2083, usado: 2083 },
            { id: 'g3-6', lote: '7750', peso: 2041, usado: 2041 },
            { id: 'g3-7', lote: '7526', peso: 2098, usado: 1165 }
        ]);

        setPrevisto4_2mm(13147);
        setRows4_2mm([
            { id: 'g4-1', lote: '6178', peso: 2092, usado: 2092 },
            { id: 'g4-2', lote: '6337', peso: 2073, usado: 2073 },
            { id: 'g4-3', lote: '6347', peso: 2059, usado: 2059 },
            { id: 'g4-4', lote: '6534', peso: 2154, usado: 2154 },
            { id: 'g4-5', lote: '7088', peso: 1266, usado: 1266 },
            { id: 'g4-6', lote: '7107', peso: 1515, usado: 1515 },
            { id: 'g4-7', lote: '7111', peso: 1500, usado: 1500 },
            { id: 'g4-8', lote: '7112', peso: 1256, usado: 483 }
        ]);

        showToast('Modelo de teste idêntico à imagem carregado!', 'success');
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('relatorio-final-sheet');
            if (!element) return;

            showToast('Gerando imagem de alta resolução...', 'info');

            const inputsToSync = element.querySelectorAll('input');
            inputsToSync.forEach((input: any) => {
                input.setAttribute('value', input.value);
            });

            element.classList.add('is-capturing');
            await new Promise(resolve => setTimeout(resolve, 80));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.getElementById('relatorio-final-sheet');
                    if (!clonedElement) return;

                    const clonedInputs = clonedElement.querySelectorAll('input');
                    clonedInputs.forEach((input: any) => {
                        const div = clonedDoc.createElement('div');
                        div.className = input.className;
                        div.textContent = input.getAttribute('value') || '';

                        div.style.display = 'inline-block';
                        div.style.minHeight = '1.5em';
                        div.style.lineHeight = '1.4';
                        div.style.paddingTop = '1px';
                        div.style.paddingBottom = '1px';
                        div.style.whiteSpace = 'nowrap';
                        div.style.overflow = 'visible';

                        input.parentNode?.replaceChild(div, input);
                    });
                }
            });

            element.classList.remove('is-capturing');

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                        showToast('Imagem copiada! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        const link = document.createElement('a');
                        link.download = `Relatorio_Final_Trelica_${ordemProducao || 'SemNum'}_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Imagem baixada! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('relatorio-final-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    // Formatação de data da produção
    const formattedDateNumbers = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }, [selectedDate]);

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-mono text-slate-800 relative select-none">
            {/* CSS Customizado para impressão e captura */}
            <style dangerouslySetInnerHTML={{ __html: `
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }

                .op-sheet-container {
                    font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
                }
                
                .op-editable-input {
                    border: none !important;
                    background: transparent !important;
                    font-weight: 800 !important;
                    color: #002060 !important;
                    padding: 2px !important;
                    margin: 0 !important;
                    outline: none !important;
                    box-shadow: none !important;
                    transition: all 0.2s;
                    border-bottom: 1.5px dashed transparent !important;
                    border-radius: 0 !important;
                    height: auto !important;
                    line-height: normal !important;
                    min-width: 0 !important;
                }
                .op-editable-input:hover {
                    border-bottom: 1.5px dashed #3b82f6 !important;
                    background-color: rgba(59, 130, 246, 0.04) !important;
                }
                .op-editable-input:focus {
                    border-bottom: 1.8px solid #002060 !important;
                    background-color: rgba(59, 130, 246, 0.08) !important;
                    outline: none !important;
                }
                .op-editable-input::placeholder {
                    color: #94a3b8;
                    font-weight: 400;
                    opacity: 0.5;
                }
                .op-number-input {
                    color: white !important;
                    background: transparent !important;
                    border: none !important;
                    outline: none !important;
                    box-shadow: none !important;
                    cursor: text !important;
                    border-bottom: 1.5px dashed transparent !important;
                    transition: all 0.2s;
                }
                .op-number-input:hover {
                    border-bottom: 1.5px dashed rgba(255, 255, 255, 0.4) !important;
                    background-color: rgba(255, 255, 255, 0.05) !important;
                }
                .op-number-input:focus {
                    border-bottom: 1.8px solid white !important;
                    background-color: rgba(255, 255, 255, 0.1) !important;
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 5mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .app-container,
                    .main-content,
                    .main-content > div,
                    .app-container > main,
                    div.p-4 {
                        display: block !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        position: static !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-sheet-a4 {
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        border-radius: 0 !important;
                    }
                    .op-editable-input {
                        border-bottom: none !important;
                        background: transparent !important;
                        pointer-events: none !important;
                        line-height: 1.2 !important;
                    }
                    .suggestions-dropdown {
                        display: none !important;
                    }
                    tr, td, th {
                        page-break-inside: avoid !important;
                    }
                    .print-bg-light {
                        background-color: #eff6ff !important;
                        color: #002060 !important;
                    }
                    thead tr.print-bg-light th {
                        background-color: #eff6ff !important;
                        color: #002060 !important;
                        border-bottom: 2px solid #002060 !important;
                    }
                    .border-slate-300,
                    .border-slate-200 {
                        border-color: #002060 !important;
                    }
                    .op-number-input {
                        color: #002060 !important;
                        background: transparent !important;
                    }
                    .op-number-input::placeholder {
                        color: rgba(0, 32, 96, 0.5) !important;
                    }
                    .op-label-print {
                        color: #475569 !important;
                    }
                }

                .is-capturing .no-print {
                    display: none !important;
                }
                .is-capturing {
                    padding: 0 !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: none !important;
                    width: 1180px !important;
                    max-width: 1180px !important;
                    border-radius: 0 !important;
                }
                .is-capturing .op-editable-input {
                    border-bottom: none !important;
                    background: transparent !important;
                    pointer-events: none !important;
                    line-height: 1.2 !important;
                }

                .print-only-capturing {
                    display: none;
                }
                .is-capturing .print-only-capturing {
                    display: inline-block !important;
                }
                .is-capturing .no-print-capturing {
                    display: none !important;
                }
                
                @media print {
                    .print-only-capturing {
                        display: inline-block !important;
                    }
                    .no-print-capturing {
                        display: none !important;
                    }
                }
            `}} />

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div key={t.id} className={`p-3 rounded shadow border text-white font-bold text-xs flex items-center gap-2 pointer-events-auto max-w-sm ${t.type === 'success' ? 'bg-emerald-600 border-emerald-500' : t.type === 'error' ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-700'}`}>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Menu Admin */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-4 border-b border-slate-200 no-print gap-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
                        📋 Relatório Final de Produção Treliça
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button onClick={loadSampleData} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        ⭐ Carregar Modelo da Foto
                    </button>
                    <button onClick={copyToClipboard} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1">
                        🟢 Copiar Imagem (WhatsApp)
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        🖨️ Imprimir A4
                    </button>
                    <button onClick={clearForm} className="bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 font-bold py-1.5 px-2 rounded text-xs transition-colors">
                        Limpar
                    </button>
                </div>
            </header>

            {/* Filtros - No Print */}
            <section className="bg-white p-4 rounded border border-slate-200 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Configurações de Relatório</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-bold text-slate-700 text-xs">Data de Produção:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800 cursor-pointer"
                    />
                </div>
            </section>

            {/* Relatório Final */}
            {loading ? (
                <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-sm text-center font-bold text-slate-500 animate-pulse">
                    Carregando dados...
                </div>
            ) : (
                <div id="relatorio-final-sheet" className="bg-white max-w-[1240px] mx-auto op-sheet-container print-sheet-a4 border-2 border-[#002060] rounded-lg overflow-hidden shadow-lg p-6 bg-white relative space-y-6">
                    
                    {/* CABEÇALHO */}
                    <div className="grid grid-cols-12 border border-[#002060]">
                        <div className="col-span-3 bg-white p-2 flex items-center justify-center border-r border-[#002060]">
                            <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 md:h-20 object-contain w-full" style={{ maxHeight: '80px' }} />
                        </div>

                        <div className="col-span-6 bg-white p-2 flex flex-col justify-center text-center gap-1">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-[#002060] leading-none">
                                Relatório Final de Produção Treliça
                            </h2>
                            <p className="text-[14px] font-extrabold text-slate-500 uppercase mt-0.5 mb-1">
                                Setor Laminação e Trefilação
                            </p>
                        </div>

                        {/* Bloco OP */}
                        <div className="col-span-3 bg-[#002060] text-white p-2 flex flex-col justify-center text-center print-bg-light">
                            <div className="text-xs md:text-[14px] font-black text-slate-300 uppercase op-label-print">Ordem de Produção</div>
                            <input 
                                type="text" 
                                value={ordemProducao} 
                                onChange={e => setOrdemProducao(e.target.value)} 
                                className="op-number-input text-center text-3xl md:text-4xl font-black w-full bg-transparent text-white outline-none border-none placeholder:text-white mt-1 focus:ring-0 focus:border-0"
                                placeholder="84536" 
                            />
                        </div>
                    </div>

                    {/* SEÇÃO 1: ATUALIZAÇÃO DA PRODUÇÃO */}
                    <div className="border border-[#002060] rounded-lg overflow-hidden">
                        <div className="bg-[#002060] text-white text-center py-2 font-black text-sm uppercase tracking-wider print-bg-light">
                            ATUALIZAÇÃO DA PRODUÇÃO
                        </div>
                        <div className="p-3 bg-slate-50 border-b border-[#002060] flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <span>Quantidade de peças a produzir:</span>
                                        <input 
                                            type="number" 
                                            value={piecesToProduce} 
                                            onChange={e => setPiecesToProduce(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="op-editable-input text-center w-24 text-[#002060] font-black text-sm"
                                            placeholder="Meta..."
                                        />
                                        <span className="text-slate-500 font-medium">treliças</span>
                                    </div>
                                    <div className="flex items-center gap-2 sm:border-l sm:pl-4 border-slate-300">
                                        <span>Modelo da Treliça:</span>
                                        <select
                                            value={selectedModelCod}
                                            onChange={e => handleModelChange(e.target.value)}
                                            className="text-xs font-black text-[#002060] bg-transparent outline-none cursor-pointer hover:bg-slate-100/50 rounded pr-1 no-print-capturing"
                                        >
                                            <option value="">Selecione o modelo...</option>
                                            {trelicaModels.map(m => (
                                                <option key={m.cod} value={m.cod}>
                                                    {m.cod} - {m.modelo} ({m.tamanho}m)
                                                </option>
                                            ))}
                                        </select>
                                        <span className="print-only-capturing hidden text-xs font-black text-[#002060]">
                                            {selectedModelCod ? `${selectedModelCod} - ${trelicaModels.find(m => m.cod === selectedModelCod)?.modelo || ''}` : '-'}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={addProdRow} className="no-print bg-[#002060] text-white font-black text-[10px] px-3 py-1.5 rounded hover:bg-slate-800 shadow transition-all uppercase">
                                    + Adicionar Lançamento
                                </button>
                            </div>
                        </div>
                        <table className="w-full text-center border-collapse table-fixed text-xs">
                            <colgroup>
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-100 font-bold border-b border-[#002060]">
                                    <th className="py-2 border-r border-[#002060]">Qnt.</th>
                                    <th className="py-2 border-r border-[#002060]">peso (kg)</th>
                                    <th className="py-2 border-r border-[#002060]">media (kg/peça)</th>
                                    <th className="py-2">Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prodRows.map(row => {
                                    const media = (typeof row.qnt === 'number' && typeof row.peso === 'number' && row.qnt > 0)
                                        ? row.peso / row.qnt 
                                        : 0;

                                    return (
                                        <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50/50 group">
                                            <td className="p-1 border-r border-slate-200 relative">
                                                <input 
                                                    type="number"
                                                    value={row.qnt}
                                                    onChange={e => updateProdRowField(row.id, 'qnt', e.target.value === '' ? '' : Number(e.target.value))}
                                                    className="op-editable-input text-center w-full text-[13px]"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input 
                                                    type="number"
                                                    value={row.peso}
                                                    onChange={e => updateProdRowField(row.id, 'peso', e.target.value === '' ? '' : Number(e.target.value))}
                                                    className="op-editable-input text-center w-full text-[13px]"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200 font-bold text-slate-800 text-[13px]">
                                                {media > 0 ? media.toFixed(2).replace('.', ',') : '-'}
                                            </td>
                                            <td className="p-1 relative">
                                                <input 
                                                    type="text"
                                                    value={row.data}
                                                    onChange={e => updateProdRowField(row.id, 'data', e.target.value)}
                                                    className="op-editable-input text-center w-full text-[13px]"
                                                    placeholder="dd/mm/aa"
                                                />
                                                <button 
                                                    onClick={() => removeProdRow(row.id)} 
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 font-bold no-print opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Total Row */}
                                <tr className="bg-slate-100 font-black border-t-2 border-[#002060] text-sm text-[#002060]">
                                    <td className="py-2.5 border-r border-[#002060]">{prodTotals.totalQnt || 0}</td>
                                    <td className="py-2.5 border-r border-[#002060]">{prodTotals.totalWeight || 0} kg</td>
                                    <td className="py-2.5 border-r border-[#002060]">{prodTotals.overallAverage > 0 ? prodTotals.overallAverage.toFixed(2).replace('.', ',') : '0,00'} kg/pç</td>
                                    <td className="py-2.5 text-xs uppercase tracking-wider font-extrabold text-slate-500">TOTAL / MÉDIA</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* SEÇÃO 2: BITOLAS (6mm, 3.8mm, 4.2mm) */}
                    <div className="space-y-6">
                        
                        {/* Bloco Gauge Render Helper */}
                        {([
                            { label: bitolaBlock1.replace('.', ',') + 'mm', rows: rows6mm, setRows: setRows6mm, previsto: previsto6mm, setPrevisto: setPrevisto6mm, stats: stats6mm, type: '6mm' },
                            { label: bitolaBlock2.replace('.', ',') + 'mm', rows: rows3_8mm, setRows: setRows3_8mm, previsto: previsto3_8mm, setPrevisto: setPrevisto3_8mm, stats: stats3_8mm, type: '3_8mm' },
                            { label: bitolaBlock3.replace('.', ',') + 'mm', rows: rows4_2mm, setRows: setRows4_2mm, previsto: previsto4_2mm, setPrevisto: setPrevisto4_2mm, stats: stats4_2mm, type: '4_2mm' }
                        ] as const).map(gBlock => {
                            const balanco = (typeof gBlock.previsto === 'number')
                                ? gBlock.stats.totalUsed - gBlock.previsto 
                                : '';

                            return (
                                <div key={gBlock.type} className="grid grid-cols-12 gap-6 items-start border border-slate-200 p-4 rounded-xl bg-[#fafbfc]">
                                    {/* Tabela do Lado Esquerdo */}
                                    <div className="col-span-12 md:col-span-9 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={gBlock.type === '6mm' ? bitolaBlock1 : gBlock.type === '3_8mm' ? bitolaBlock2 : bitolaBlock3}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (gBlock.type === '6mm') setBitolaBlock1(val);
                                                        else if (gBlock.type === '3_8mm') setBitolaBlock2(val);
                                                        else setBitolaBlock3(val);
                                                    }}
                                                    className="text-lg font-black text-[#002060] border-l-4 border-[#002060] pl-2 bg-transparent outline-none cursor-pointer hover:bg-slate-100/50 rounded pr-1 no-print-capturing"
                                                >
                                                    {CA60Bitolas.map(opt => (
                                                        <option key={opt} value={opt}>
                                                            {opt.replace('.', ',')} mm
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="print-only-capturing hidden text-lg font-black text-[#002060] border-l-4 border-[#002060] pl-2 uppercase">
                                                    {gBlock.label}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-extrabold uppercase">Consumo de Lotes</span>
                                            </div>
                                            <button onClick={() => addGaugeRow(gBlock.type)} className="no-print bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-black text-[9px] px-2.5 py-1 rounded transition-all uppercase">
                                                + Lote
                                            </button>
                                        </div>

                                        <table className="w-full text-center border-collapse text-xs table-fixed bg-white border border-slate-200 rounded overflow-hidden">
                                            <colgroup>
                                                <col style={{ width: '30%' }} />
                                                <col style={{ width: '23%' }} />
                                                <col style={{ width: '23%' }} />
                                                <col style={{ width: '24%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="bg-slate-50 font-bold border-b border-slate-200">
                                                    <th className="py-2 border-r border-slate-200">Lote</th>
                                                    <th className="py-2 border-r border-slate-200">Peso (kg)</th>
                                                    <th className="py-2 border-r border-slate-200">Usado (kg)</th>
                                                    <th className="py-2">Sobrou (kg)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gBlock.rows.map(row => {
                                                    const sobrou = (typeof row.peso === 'number' && typeof row.usado === 'number')
                                                        ? row.peso - row.usado 
                                                        : 0;

                                                    return (
                                                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 group">
                                                            {/* Lote Input com Autocomplete */}
                                                            <td className="p-1 border-r border-slate-200 relative">
                                                                <input 
                                                                    type="text"
                                                                    value={row.lote}
                                                                    onChange={e => handleLoteChange(gBlock.type, row.id, e.target.value)}
                                                                    onFocus={() => {
                                                                        setFilterText(row.lote);
                                                                        setActiveSuggestion({ tableType: gBlock.type, rowId: row.id });
                                                                    }}
                                                                    className="op-editable-input text-center w-full text-[13px] uppercase font-black"
                                                                    placeholder="Lote..."
                                                                />
                                                                {/* Dropdown de sugestão */}
                                                                {(activeSuggestion?.tableType === gBlock.type && activeSuggestion?.rowId === row.id && suggestions.length > 0) && (
                                                                    <div ref={suggestionsRef} className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#002060] rounded shadow-xl z-50 text-left text-[9px] suggestions-dropdown max-h-[160px] overflow-y-auto font-sans">
                                                                        {suggestions.map(item => (
                                                                            <div 
                                                                                key={item.id}
                                                                                onClick={() => handleSelectSuggestion(gBlock.type, row.id, item)}
                                                                                className="p-1.5 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                                                                            >
                                                                                <div className="font-bold text-[#002060]">{item.internalLot} {item.supplierLot ? `(${item.supplierLot})` : ''}</div>
                                                                                <div className="text-slate-500 font-medium">Peso: {item.remainingQuantity || item.weight || '-'} kg | Bitola: {item.bitola || '-'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            
                                                            {/* Peso Lote */}
                                                            <td className="p-1 border-r border-slate-200">
                                                                <input 
                                                                    type="number"
                                                                    value={row.peso}
                                                                    onChange={e => updateGaugeRowField(gBlock.type, row.id, 'peso', e.target.value === '' ? '' : Number(e.target.value))}
                                                                    className="op-editable-input text-center w-full text-[13px]"
                                                                    placeholder="0"
                                                                />
                                                            </td>

                                                            {/* Usado */}
                                                            <td className="p-1 border-r border-slate-200 bg-slate-50/20">
                                                                <input 
                                                                    type="number"
                                                                    value={row.usado}
                                                                    onChange={e => updateGaugeRowField(gBlock.type, row.id, 'usado', e.target.value === '' ? '' : Number(e.target.value))}
                                                                    className="op-editable-input text-center w-full text-[13px]"
                                                                    placeholder="0"
                                                                />
                                                            </td>

                                                            {/* Sobrou */}
                                                            <td className="p-1 relative font-bold text-slate-800 text-[13px]">
                                                                <span>{sobrou || 0}</span>
                                                                <button 
                                                                    onClick={() => removeGaugeRow(gBlock.type, row.id)} 
                                                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 font-bold no-print opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Totais do Bloco */}
                                                <tr className="bg-slate-50 font-black text-[13px] text-slate-800 border-t border-slate-200">
                                                    <td className="py-2 border-r border-slate-200 uppercase font-extrabold text-[10px] text-slate-500">Total</td>
                                                    <td className="py-2 border-r border-slate-200">{gBlock.stats.totalWeight}</td>
                                                    <td className="py-2 border-r border-slate-200 font-black text-[#002060]">{gBlock.stats.totalUsed}</td>
                                                    <td className="py-2">{gBlock.stats.totalRemaining}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Cards do Lado Direito */}
                                    <div className="col-span-12 md:col-span-3 flex flex-col gap-3 justify-center h-full pt-10 md:pt-12">
                                        
                                        {/* Peso Previsto - Amarelo */}
                                        <div className="bg-[#FFFF00] text-slate-900 border-2 border-yellow-500 rounded-2xl p-3 text-center shadow-sm relative">
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Peso Previsto</div>
                                            <input 
                                                type="number"
                                                value={gBlock.previsto}
                                                onChange={e => gBlock.setPrevisto(e.target.value === '' ? '' : Number(e.target.value))}
                                                className="op-editable-input text-center text-lg font-black w-full text-slate-950 border-b-2 border-slate-900/30 hover:border-slate-950/60 focus:border-slate-950 !color-slate-950"
                                                placeholder="Manual..."
                                            />
                                        </div>

                                        {/* Peso Usado - Verde */}
                                        <div className="bg-[#00FF00] text-slate-900 border-2 border-green-600 rounded-2xl p-3 text-center shadow-sm">
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Peso Usado</div>
                                            <div className="text-2xl font-black mt-1 text-slate-950">
                                                {gBlock.stats.totalUsed}
                                            </div>
                                        </div>

                                        {/* Balanço - Rosa/Vermelho */}
                                        <div className="bg-[#E6007E] text-white border-2 border-pink-700 rounded-2xl p-3 text-center shadow-sm">
                                            <div className="text-[10px] font-black uppercase tracking-wider opacity-85">Balanço</div>
                                            <div className="text-2xl font-black mt-1">
                                                {balanco !== '' ? (balanco > 0 ? `+${balanco}` : balanco) : '-'}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}

                    </div>

                    {/* TABELA DE TOTAIS E ASSINATURA */}
                    <div className="grid grid-cols-12 gap-6 mt-6 pt-4 border-t border-slate-200">
                        {/* Resumo Consumo Geral */}
                        <div className="col-span-12 md:col-span-5">
                            <table className="border-2 border-[#002060] font-black text-sm text-[#002060] w-full border-collapse">
                                <tbody>
                                    <tr className="border-b border-[#002060]">
                                        <td className="bg-slate-50 p-2 border-r border-[#002060] uppercase w-[50%] font-extrabold text-xs">Total Consumido</td>
                                        <td className="p-2 text-right text-base font-black">{(stats6mm.totalUsed + stats3_8mm.totalUsed + stats4_2mm.totalUsed).toLocaleString('pt-BR')} kg</td>
                                    </tr>
                                    <tr className="border-b border-[#002060]">
                                        <td className="bg-slate-50 p-2 border-r border-[#002060] uppercase font-extrabold text-xs">Total Produzido</td>
                                        <td className="p-2 text-right text-base font-black">{prodTotals.totalWeight.toLocaleString('pt-BR')} kg</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Box de Assinatura */}
                        <div className="col-span-12 md:col-span-7 flex flex-col justify-end">
                            <div className="flex items-center p-2.5 border border-[#002060] rounded bg-slate-50">
                                <span className="text-[11px] font-black text-[#002060] uppercase tracking-tight shrink-0 mr-1.5">Responsável:</span>
                                <input 
                                    type="text" 
                                    value={responsavel} 
                                    onChange={e => setResponsavel(e.target.value)} 
                                    className="op-editable-input text-center font-black text-sm w-full" 
                                    placeholder="Assinatura ou nome do responsável..." 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rodapé */}
                    <div className="text-center text-[8px] text-slate-400 font-extrabold uppercase mt-6 tracking-widest no-print">
                        Relatório Final de Produção Treliça v1.0 &bull; Grupo Ita Aços
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsFinalTrelica;
