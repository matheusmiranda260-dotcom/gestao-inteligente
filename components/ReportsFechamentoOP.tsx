import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, StockItem } from '../types';
import html2canvas from 'html2canvas';

interface ReportsFechamentoOPProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
}

interface FechamentoOPRow {
    id: string;
    data: string;
    lote: string; // copex
    pesoEtiqueta: number | '';
    pesoBalanca: number | '';
    bitola: string;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

const ReportsFechamentoOP: React.FC<ReportsFechamentoOPProps> = ({ stock = [], setPage }) => {
    // 1. Control States
    const [loading, setLoading] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('sv'));
    const dateInputRef = useRef<HTMLInputElement>(null);

    // 2. Report States
    const [ordemProducao, setOrdemProducao] = useState<string>('');
    const [responsavel, setResponsavel] = useState<string>('');

    // Table Rows
    const createEmptyRow = (): FechamentoOPRow => ({
        id: Math.random().toString(36).substring(2, 9),
        data: '',
        lote: '',
        pesoEtiqueta: '',
        pesoBalanca: '',
        bitola: ''
    });

    const [rows, setRows] = useState<FechamentoOPRow[]>(() => Array.from({ length: 8 }, createEmptyRow));

    // Autocomplete State
    const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
    const [filterText, setFilterText] = useState<string>('');
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Toast System
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setActiveSuggestionRowId(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Autocomplete logic
    const suggestions = useMemo(() => {
        if (!filterText.trim()) return [];
        const lower = filterText.toLowerCase();
        return stock
            .filter(item => 
                (item.internalLot && item.internalLot.toLowerCase().includes(lower)) || 
                (item.supplierLot && item.supplierLot.toLowerCase().includes(lower))
            )
            .slice(0, 6);
    }, [stock, filterText]);

    const handleLoteChange = (rowId: string, value: string) => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, lote: value } : r));
        setFilterText(value);
        setActiveSuggestionRowId(rowId);
    };

    const handleSelectSuggestion = (rowId: string, item: StockItem) => {
        const selectedLot = item.internalLot || item.supplierLot || '';
        const defaultDateFormatted = selectedDate ? `${selectedDate.split('-')[2]}/${selectedDate.split('-')[1]}` : '';

        setRows(prev => prev.map(r => r.id === rowId ? {
            ...r,
            lote: selectedLot,
            data: r.data || defaultDateFormatted,
            pesoEtiqueta: item.labelWeight || item.weight || '',
            bitola: r.bitola || item.bitola || ''
        } : r));
        setActiveSuggestionRowId(null);
        showToast(`Lote ${selectedLot} importado com sucesso!`, 'success');
    };

    // Date calculations
    const formattedDateNumbers = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }, [selectedDate]);

    const formattedDayOfWeek = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekdays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        return weekdays[dateObj.getDay()];
    }, [selectedDate]);

    // Totals calculations
    const totals = useMemo(() => {
        let totalInput = 0;
        let totalOutput = 0;

        rows.forEach(r => {
            if (typeof r.pesoEtiqueta === 'number') {
                totalInput += r.pesoEtiqueta;
            }
            if (typeof r.pesoBalanca === 'number') {
                totalOutput += r.pesoBalanca;
            }
        });

        const scrap = totalInput - totalOutput;
        const scrapPercentage = totalInput > 0 ? (scrap / totalInput) * 100 : 0;

        return {
            totalInput,
            totalOutput,
            scrap,
            scrapPercentage
        };
    }, [rows]);

    // Local Storage Draft
    const DRAFT_KEY = 'fechamento_op_report_draft';

    const loadDraft = () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.selectedDate) setSelectedDate(data.selectedDate);
                setOrdemProducao(data.ordemProducao || '');
                setResponsavel(data.responsavel || '');
                if (data.rows) setRows(data.rows);
                showToast('Rascunho do Fechamento de OP carregado.', 'info');
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho de Fechamento de OP', e);
        } finally {
            setLoading(false);
        }
    };

    const saveDraft = () => {
        const payload = {
            selectedDate,
            ordemProducao,
            responsavel,
            rows
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

    // Autosave with small delay
    useEffect(() => {
        if (loading) return;
        const timer = setTimeout(() => {
            saveDraft();
        }, 800);
        return () => clearTimeout(timer);
    }, [selectedDate, ordemProducao, responsavel, rows, loading]);

    // Table Operations
    const updateRowField = (rowId: string, field: keyof FechamentoOPRow, value: any) => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
    };

    const removeRow = (rowId: string) => {
        setRows(prev => prev.filter(r => r.id !== rowId));
    };

    const clearForm = () => {
        const confirm = window.confirm("Deseja realmente limpar toda a planilha de Fechamento de OP?");
        if (!confirm) return;

        setOrdemProducao('');
        setResponsavel('');
        setRows(Array.from({ length: 8 }, createEmptyRow));
        localStorage.removeItem(DRAFT_KEY);
        showToast('Formulário redefinido com sucesso.', 'success');
    };

    const loadSampleData = () => {
        setOrdemProducao('84536');
        setResponsavel('Matheus Miranda');

        // Try using some real items from stock if available
        const sampleLots = stock.slice(0, 6);
        const newRows = Array.from({ length: 8 }, (_, idx) => {
            const empty = createEmptyRow();
            if (idx < 6) {
                const item = idx < sampleLots.length ? sampleLots[idx] : null;
                const sampleLotsLabels = [7652, 7653, 7654, 7655, 7656, 7658];
                const sampleLabelWeights = [2092, 2089, 2084, 2085, 2073, 2038];
                const sampleScaleWeights = [2080, 2079, 2078, 2076, 2069, 2031];
                const sampleGauges = ['6,02 mm', '6 mm', '5,99 mm', '5,98 mm', '5,99 mm', '5,99 mm'];

                return {
                    ...empty,
                    data: '22/05',
                    lote: item?.internalLot || String(sampleLotsLabels[idx]),
                    pesoEtiqueta: item?.labelWeight || item?.weight || sampleLabelWeights[idx],
                    pesoBalanca: sampleScaleWeights[idx],
                    bitola: item?.bitola || sampleGauges[idx]
                };
            }
            return empty;
        });

        setRows(newRows);
        showToast('Modelo de teste carregado com sucesso!', 'success');
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('fechamento-op-sheet');
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
                    const clonedElement = clonedDoc.getElementById('fechamento-op-sheet');
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
                        link.download = `Fechamento_OP_${ordemProducao || 'SemNum'}_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Imagem baixada! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('fechamento-op-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-mono text-slate-800 relative select-none">
            {/* CSS de Ajustes de Impressão A4 */}
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

                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 5mm;
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
                        📊 Fechamento de OP (Rendimento)
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button onClick={loadSampleData} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        ⭐ Carregar Modelo de Teste
                    </button>
                    <button onClick={copyToClipboard} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1">
                        🟢 Copiar Imagem (Zap)
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        🖨️ Imprimir Ficha A4
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

            {/* Ficha OP - FORMATADA PARA A4 */}
            {loading ? (
                <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-sm text-center font-bold text-slate-500 animate-pulse">
                    Carregando dados...
                </div>
            ) : (
                <div id="fechamento-op-sheet" className="bg-white max-w-[1240px] mx-auto op-sheet-container print-sheet-a4 border-2 border-[#002060] rounded-lg overflow-hidden shadow-lg p-4 bg-white relative">
                    
                    {/* CABEÇALHO */}
                    <div className="grid grid-cols-12 border border-[#002060] mb-4">
                        <div className="col-span-3 bg-white p-2 flex items-center justify-center border-r border-[#002060]">
                            <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-10 md:h-12 object-contain" style={{ maxHeight: '52px' }} />
                        </div>

                        <div className="col-span-6 bg-white p-2 flex flex-col justify-center text-center">
                            <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-[#002060] leading-none">
                                Fechamento de Ordem de Produção
                            </h2>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase mt-0.5 mb-1.5">
                                Setor Laminação e Trefilação (Rendimento)
                            </p>
                            <div className="flex items-center justify-center gap-1.5 text-[#002060]">
                                <span className="font-extrabold text-[10px] uppercase">Ordem de Produção:</span>
                                <input 
                                    type="text" 
                                    value={ordemProducao} 
                                    onChange={e => setOrdemProducao(e.target.value)} 
                                    className="op-editable-input text-center text-xs font-black w-32 border-b border-[#002060]/30"
                                    placeholder="Ex: 84536" 
                                />
                            </div>
                        </div>

                        {/* Bloco Data */}
                        <div 
                            onClick={() => {
                                try {
                                    dateInputRef.current?.showPicker();
                                } catch (err) {
                                    dateInputRef.current?.click();
                                }
                            }}
                            className="col-span-3 bg-[#002060] text-white p-2 flex flex-col justify-center text-center cursor-pointer hover:bg-slate-850/90 relative"
                        >
                            <div className="text-[8px] font-black text-slate-300">DATA DA PRODUÇÃO</div>
                            <div className="text-sm font-black text-white leading-tight">{formattedDateNumbers}</div>
                            <div className="text-[9px] font-extrabold text-slate-300 uppercase">{formattedDayOfWeek}</div>
                            <input 
                                ref={dateInputRef}
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)} 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                            />
                        </div>
                    </div>

                    {/* TABELA PRINCIPAL DA FICHA */}
                    <div className="border border-[#002060] rounded overflow-hidden relative mb-4">
                        <table className="w-full border-collapse text-left text-[11px] table-fixed">
                            <colgroup>
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                            </colgroup>
                            <thead>
                                <tr className="bg-[#002060] text-white text-[9px] font-black uppercase text-center border-b border-[#002060] tracking-wider leading-tight">
                                    <th className="border-r border-slate-300 py-2.5 align-middle">Data</th>
                                    <th className="border-r border-slate-300 py-2.5 align-middle">Lote (copex)</th>
                                    <th className="border-r border-slate-300 py-2.5 align-middle">Peso Etiqueta (kg)</th>
                                    <th className="border-r border-slate-300 py-2.5 align-middle">Peso Balança (kg)</th>
                                    <th className="py-2.5 align-middle">Bitola</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-slate-300 hover:bg-slate-50/50 text-center font-bold">
                                        {/* Data */}
                                        <td className="border-r border-slate-300 p-1">
                                            <input 
                                                type="text" 
                                                value={row.data} 
                                                onChange={e => updateRowField(row.id, 'data', e.target.value)} 
                                                className="op-editable-input text-center w-full font-black text-[10px]" 
                                                placeholder="dd/mm/aa" 
                                            />
                                        </td>
                                        
                                        {/* Lote autocomplete */}
                                        <td className="border-r border-slate-300 p-1 relative">
                                            <input 
                                                type="text" 
                                                value={row.lote} 
                                                onChange={e => handleLoteChange(row.id, e.target.value)} 
                                                onFocus={() => {
                                                    setFilterText(row.lote);
                                                    setActiveSuggestionRowId(row.id);
                                                }}
                                                className="op-editable-input text-center w-full font-black text-[10px] uppercase text-[#002060]" 
                                                placeholder="Lote..." 
                                            />
                                            {/* Popover suggestions */}
                                            {(activeSuggestionRowId === row.id && suggestions.length > 0) && (
                                                <div ref={suggestionsRef} className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#002060] rounded shadow-xl z-50 text-left text-[8.5px] suggestions-dropdown max-h-[160px] overflow-y-auto font-sans">
                                                    {suggestions.map(item => (
                                                        <div 
                                                            key={item.id}
                                                            onClick={() => handleSelectSuggestion(row.id, item)}
                                                            className="p-1.5 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                                                        >
                                                            <div className="font-bold text-[#002060]">{item.internalLot} {item.supplierLot ? `(${item.supplierLot})` : ''}</div>
                                                            <div className="text-slate-500 font-medium">Forn: {item.supplier || '-'} | Peso: {item.labelWeight || item.weight || '-'} kg | Bitola: {item.bitola || '-'}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* Peso Etiqueta */}
                                        <td className="border-r border-slate-300 p-1 bg-slate-50/40">
                                            <input 
                                                type="number" 
                                                value={row.pesoEtiqueta} 
                                                onChange={e => updateRowField(row.id, 'pesoEtiqueta', e.target.value === '' ? '' : Number(e.target.value))} 
                                                className="op-editable-input text-center w-full font-black text-[10px] text-[#002060]" 
                                                placeholder="0" 
                                            />
                                        </td>

                                        {/* Peso Balança */}
                                        <td className="border-r border-slate-300 p-1">
                                            <input 
                                                type="number" 
                                                value={row.pesoBalanca} 
                                                onChange={e => updateRowField(row.id, 'pesoBalanca', e.target.value === '' ? '' : Number(e.target.value))} 
                                                className="op-editable-input text-center w-full font-black text-[10px] text-[#002060]" 
                                                placeholder="0" 
                                            />
                                        </td>

                                        {/* Bitola */}
                                        <td className="p-1 relative group">
                                            <input 
                                                type="text" 
                                                value={row.bitola} 
                                                onChange={e => updateRowField(row.id, 'bitola', e.target.value)} 
                                                className="op-editable-input text-center w-full font-black text-[10px]" 
                                                placeholder="..." 
                                            />
                                            <button 
                                                onClick={() => removeRow(row.id)} 
                                                className="absolute right-1 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 font-bold no-print opacity-0 group-hover:opacity-100 transition-opacity p-1" 
                                                title="Remover linha"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Botões sob a tabela (Apenas na tela) */}
                    <div className="flex justify-start mb-4 no-print">
                        <button onClick={addRow} className="border-2 border-[#002060] text-[#002060] font-black text-[10px] px-3.5 py-1.5 rounded hover:bg-[#002060] hover:text-white transition-all uppercase">
                            + Adicionar Linha
                        </button>
                    </div>

                    {/* TABELA DE TOTAIS E ASSINATURA */}
                    <div className="grid grid-cols-12 gap-6 mt-4 pt-2 border-t border-slate-200">
                        {/* Box de Resumo (Calculado) */}
                        <div className="col-span-12 md:col-span-5">
                            <table className="border-2 border-[#002060] font-black text-[10px] text-[#002060] w-full border-collapse">
                                <tbody>
                                    <tr className="border-b border-[#002060]">
                                        <td className="bg-slate-50 p-2 border-r border-[#002060] uppercase w-[45%] font-extrabold">Peso Entrada</td>
                                        <td className="p-2 text-right text-xs font-black">{totals.totalInput.toLocaleString('pt-BR')} kg</td>
                                    </tr>
                                    <tr className="border-b border-[#002060]">
                                        <td className="bg-slate-50 p-2 border-r border-[#002060] uppercase font-extrabold">Peso Saída</td>
                                        <td className="p-2 text-right text-xs font-black">{totals.totalOutput.toLocaleString('pt-BR')} kg</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 p-2 border-r border-[#002060] uppercase font-extrabold">Sucata</td>
                                        <td className="p-2 text-right text-xs font-black flex justify-between items-center">
                                            <span>{totals.scrap.toLocaleString('pt-BR')} kg</span>
                                            <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-extrabold ml-2 border border-rose-200">
                                                {totals.scrapPercentage.toFixed(2).replace('.', ',')}%
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Box de Assinatura */}
                        <div className="col-span-12 md:col-span-7 flex flex-col justify-end">
                            <div className="flex items-center p-2 border border-[#002060] rounded bg-slate-50">
                                <span className="text-[9px] font-black text-[#002060] uppercase tracking-tight shrink-0 mr-1.5">Responsável:</span>
                                <input 
                                    type="text" 
                                    value={responsavel} 
                                    onChange={e => setResponsavel(e.target.value)} 
                                    className="op-editable-input text-center font-black text-xs w-full" 
                                    placeholder="Assinatura ou nome do responsável..." 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rodapé decorativo */}
                    <div className="text-center text-[7px] text-slate-400 font-extrabold uppercase mt-6 tracking-widest no-print">
                        Fechamento de OP e Controle de Rendimento v1.0
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsFechamentoOP;
