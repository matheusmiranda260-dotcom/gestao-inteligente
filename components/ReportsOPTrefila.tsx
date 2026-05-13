import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, StockItem } from '../types';
import html2canvas from 'html2canvas';

interface ReportsOPTrefilaProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
}

interface OPRow {
    id: string;
    data: string;
    lote: string; // copex
    fornecedor: string;
    certificado: string;
    corrida: string;
    notaFiscal: string;
    pesoEtiqueta: number | '';
    pesoBalanca: number | '';
    massaLinear: string;
    bitolaMm: string;
    rt: string;
    le: string;
    caractGeo: string;
    dobramento: string;
    verifMarcacao: string;
    alongamento: string;
    aprovacao: string;
}

interface SetupPass {
    aneisEntrada: string;
    aneisSaida: string;
    mmEntrada: string;
    mmSaida: string;
}

interface SetupData {
    pass1: SetupPass;
    pass2: SetupPass;
    pass3: SetupPass;
    pass4: SetupPass;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

const CalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ReportsOPTrefila: React.FC<ReportsOPTrefilaProps> = ({ stock = [], setPage }) => {
    // 1. Estados de Controle
    const [loading, setLoading] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('sv'));
    const dateInputRef = useRef<HTMLInputElement>(null);

    // 2. Estados da Ficha OP Trefila
    const [bitolaEntrada, setBitolaEntrada] = useState<string>('');
    const [bitolaSaida, setBitolaSaida] = useState<string>('');
    const [responsavelHeader, setResponsavelHeader] = useState<string>('');
    const [bitolaAferida, setBitolaAferida] = useState<string>('');
    const [liberacao, setLiberacao] = useState<string>('');

    // Setup de passes
    const [setup, setSetup] = useState<SetupData>({
        pass1: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
        pass2: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
        pass3: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
        pass4: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
    });

    // Tabela Principal
    const createEmptyRow = (): OPRow => ({
        id: Math.random().toString(36).substring(2, 9),
        data: '',
        lote: '',
        fornecedor: '',
        certificado: '',
        corrida: '',
        notaFiscal: '',
        pesoEtiqueta: '',
        pesoBalanca: '',
        massaLinear: '',
        bitolaMm: '',
        rt: '',
        le: '',
        caractGeo: '',
        dobramento: '',
        verifMarcacao: '',
        alongamento: '',
        aprovacao: ''
    });

    const [rows, setRows] = useState<OPRow[]>(() => Array.from({ length: 8 }, createEmptyRow));

    // Rodapé
    const [porcentagemPerca, setPorcentagemPerca] = useState<string>('');
    const [responsavelFooter, setResponsavelFooter] = useState<string>('');
    const [responsavelLab, setResponsavelLab] = useState<string>('');

    // Autocomplete State
    const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
    const [filterText, setFilterText] = useState<string>('');
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // 3. Sistema de Toasts
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

    // 4. Autocomplete logic
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
            fornecedor: item.supplier || '',
            corrida: item.runNumber || '',
            notaFiscal: item.nfe || '',
            pesoEtiqueta: item.labelWeight || item.weight || '',
        } : r));
        setActiveSuggestionRowId(null);
        showToast(`Lote ${selectedLot} importado com sucesso!`, 'success');
    };

    // Formatações de Data
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

    // 5. Persistência de Dados (Local Storage Draft)
    const DRAFT_KEY = 'trefila_op_report_draft';

    const loadDraft = () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.selectedDate) setSelectedDate(data.selectedDate);
                setBitolaEntrada(data.bitolaEntrada || '');
                setBitolaSaida(data.bitolaSaida || '');
                setResponsavelHeader(data.responsavelHeader || '');
                setBitolaAferida(data.bitolaAferida || '');
                setLiberacao(data.liberacao || '');
                if (data.setup) setSetup(data.setup);
                if (data.rows) setRows(data.rows);
                setPorcentagemPerca(data.porcentagemPerca || '');
                setResponsavelFooter(data.responsavelFooter || '');
                setResponsavelLab(data.responsavelLab || '');
                showToast('Rascunho Ordem Produção Trefila carregado.', 'info');
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho de OP Trefila', e);
        } finally {
            setLoading(false);
        }
    };

    const saveDraft = () => {
        const payload = {
            selectedDate,
            bitolaEntrada,
            bitolaSaida,
            responsavelHeader,
            bitolaAferida,
            liberacao,
            setup,
            rows,
            porcentagemPerca,
            responsavelFooter,
            responsavelLab
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
    }, [selectedDate, bitolaEntrada, bitolaSaida, responsavelHeader, bitolaAferida, liberacao, setup, rows, porcentagemPerca, responsavelFooter, responsavelLab, loading]);

    // 6. Operações de Tabela
    const updateRowField = (rowId: string, field: keyof OPRow, value: any) => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
    };

    const removeRow = (rowId: string) => {
        setRows(prev => prev.filter(r => r.id !== rowId));
    };

    const clearForm = () => {
        const confirm = window.confirm("Deseja realmente limpar toda a Ficha Ordem de Produção Trefila?");
        if (!confirm) return;

        setBitolaEntrada('');
        setBitolaSaida('');
        setResponsavelHeader('');
        setBitolaAferida('');
        setLiberacao('');
        setSetup({
            pass1: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
            pass2: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
            pass3: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
            pass4: { aneisEntrada: '', aneisSaida: '', mmEntrada: '', mmSaida: '' },
        });
        setRows(Array.from({ length: 8 }, createEmptyRow));
        setPorcentagemPerca('');
        setResponsavelFooter('');
        setResponsavelLab('');
        localStorage.removeItem(DRAFT_KEY);
        showToast('Formulário redefinido com sucesso.', 'success');
    };

    const loadSampleData = () => {
        setBitolaEntrada('6,35mm');
        setBitolaSaida('4,20mm');
        setResponsavelHeader('Matheus Miranda');
        setBitolaAferida('4,19mm');
        setLiberacao('Aprovado pelo Lab');
        setSetup({
            pass1: { aneisEntrada: 'Anel 12', aneisSaida: 'Anel 11', mmEntrada: '6,35', mmSaida: '5,80' },
            pass2: { aneisEntrada: 'Anel 10', aneisSaida: 'Anel 09', mmEntrada: '5,80', mmSaida: '5,20' },
            pass3: { aneisEntrada: 'Anel 08', aneisSaida: 'Anel 07', mmEntrada: '5,20', mmSaida: '4,70' },
            pass4: { aneisEntrada: 'Anel 06', aneisSaida: 'Anel 05', mmEntrada: '4,70', mmSaida: '4,20' },
        });

        // Tenta pegar dados reais do estoque para popular
        const sampleLots = stock.slice(0, 3);
        const newRows = Array.from({ length: 8 }, (_, idx) => {
            const empty = createEmptyRow();
            if (idx < sampleLots.length) {
                const item = sampleLots[idx];
                return {
                    ...empty,
                    data: '13/05',
                    lote: item.internalLot || `LOTE-${idx}`,
                    fornecedor: item.supplier || 'Grupo Gerdau',
                    certificado: `CERT-5231${idx}`,
                    corrida: item.runNumber || `CR-2026-${idx}`,
                    notaFiscal: item.nfe || `NF-984${idx}`,
                    pesoEtiqueta: item.labelWeight || item.weight || 1990,
                    pesoBalanca: (item.labelWeight || item.weight || 1990) - 2,
                    massaLinear: '0,109',
                    bitolaMm: '4,19',
                    rt: '620',
                    le: '540',
                    caractGeo: 'OK',
                    dobramento: 'OK',
                    verifMarcacao: 'OK',
                    alongamento: '8%',
                    aprovacao: 'APROVADO'
                };
            }
            return empty;
        });

        setRows(newRows);
        setPorcentagemPerca('1,12%');
        setResponsavelFooter('Wellington Denis');
        setResponsavelLab('Roberto Silva');
        showToast('Modelo de teste carregado com sucesso!', 'success');
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('trefila-op-sheet');
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
                    const clonedElement = clonedDoc.getElementById('trefila-op-sheet');
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
                        link.download = `OP_Trefila_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Imagem baixada! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('trefila-op-sheet');
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
                        📋 Ordem de Produção Trefila (A4)
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
                    <span className="font-bold text-slate-700 text-xs">Data:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800 cursor-pointer"
                    />
                </div>
            </section>

            {/* Ficha OP Trefila - FORMATADA PARA A4 */}
            {loading ? (
                <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-sm text-center font-bold text-slate-500 animate-pulse">
                    Carregando dados...
                </div>
            ) : (
                <div id="trefila-op-sheet" className="bg-white max-w-[1240px] mx-auto op-sheet-container print-sheet-a4 border-2 border-[#002060] rounded-lg overflow-hidden shadow-lg p-4 bg-white relative">
                    
                    {/* CABEÇALHO */}
                    <div className="grid grid-cols-12 border border-[#002060] mb-3">
                        <div className="col-span-3 bg-white p-2 flex items-center justify-center border-r border-[#002060]">
                            <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-10 md:h-12 object-contain" style={{ maxHeight: '52px' }} />
                        </div>

                        <div className="col-span-6 bg-white p-2 flex flex-col justify-center text-center">
                            <h2 className="text-base md:text-lg font-black uppercase tracking-wider text-[#002060] leading-none">
                                Ordem de Produção - Trefila
                            </h2>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase mt-0.5">
                                Setor Laminação e Trefilação
                            </p>
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

                    {/* SEÇÃO SUPÉRIO: BITOLA E SETUP */}
                    <div className="grid grid-cols-12 gap-3 mb-3">
                        {/* Bitola Entrada/Saida */}
                        <div className="col-span-12 md:col-span-2 flex flex-col gap-2 justify-center">
                            <div className="flex flex-col border border-[#002060] p-1.5 rounded bg-slate-50">
                                <span className="text-[8px] font-black text-[#002060] uppercase text-center border-b border-[#002060]/20 pb-0.5 mb-1">Bitola Entrada</span>
                                <input type="text" value={bitolaEntrada} onChange={e => setBitolaEntrada(e.target.value)} className="op-editable-input w-full text-xs font-black text-center" placeholder="Ex: 6,35mm" />
                            </div>
                            <div className="flex flex-col border border-[#002060] p-1.5 rounded bg-slate-50">
                                <span className="text-[8px] font-black text-[#002060] uppercase text-center border-b border-[#002060]/20 pb-0.5 mb-1">Bitola Saída</span>
                                <input type="text" value={bitolaSaida} onChange={e => setBitolaSaida(e.target.value)} className="op-editable-input w-full text-xs font-black text-center" placeholder="Ex: 4,20mm" />
                            </div>
                        </div>

                        {/* Setup - Plano de passe (GRID DO MODELO) */}
                        <div className="col-span-12 md:col-span-8 border border-[#002060] rounded overflow-hidden">
                            <div className="bg-[#002060] text-white py-1 text-center text-[11px] font-black uppercase tracking-wider">
                                Setup - Plano de passe
                            </div>
                            <table className="w-full border-collapse text-center table-fixed">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-[#002060] text-[9.5px] font-black text-slate-700 uppercase">
                                        <th rowSpan={2} className="border-r border-[#002060] p-1 align-middle text-center w-[16%] font-extrabold text-[#002060]">passes</th>
                                        <th colSpan={2} className="border-r border-[#002060] p-1 align-middle text-center font-extrabold text-[#002060]">1º Passe</th>
                                        <th colSpan={2} className="border-r border-[#002060] p-1 align-middle text-center font-extrabold text-[#002060]">2º Passe</th>
                                        <th colSpan={2} className="border-r border-[#002060] p-1 align-middle text-center font-extrabold text-[#002060]">3º Passe</th>
                                        <th colSpan={2} className="p-1 align-middle text-center font-extrabold text-[#002060]">4º Passe</th>
                                    </tr>
                                    <tr className="bg-slate-100 border-b border-[#002060] text-[8.5px] font-bold text-slate-600 uppercase text-center">
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">entrada</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">saída</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">entrada</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">saída</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">entrada</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">saída</th>
                                        <th className="border-r border-[#002060] p-1 align-middle w-[10.5%]">entrada</th>
                                        <th className="p-1 align-middle w-[10.5%]">saída</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-black text-[#002060]">
                                    <tr className="border-b border-[#002060]">
                                        <td className="bg-slate-50 border-r border-[#002060] py-1.5 font-bold text-[9px] text-[#002060] uppercase">aneis</td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass1.aneisEntrada} onChange={e => setSetup({...setup, pass1: {...setup.pass1, aneisEntrada: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass1.aneisSaida} onChange={e => setSetup({...setup, pass1: {...setup.pass1, aneisSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass2.aneisEntrada} onChange={e => setSetup({...setup, pass2: {...setup.pass2, aneisEntrada: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass2.aneisSaida} onChange={e => setSetup({...setup, pass2: {...setup.pass2, aneisSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass3.aneisEntrada} onChange={e => setSetup({...setup, pass3: {...setup.pass3, aneisEntrada: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass3.aneisSaida} onChange={e => setSetup({...setup, pass3: {...setup.pass3, aneisSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="border-r border-[#002060] p-1"><input type="text" value={setup.pass4.aneisEntrada} onChange={e => setSetup({...setup, pass4: {...setup.pass4, aneisEntrada: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td className="p-1"><input type="text" value={setup.pass4.aneisSaida} onChange={e => setSetup({...setup, pass4: {...setup.pass4, aneisSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 border-r border-[#002060] py-1.5 font-bold text-[9px] text-[#002060] uppercase">mm (saida)</td>
                                        <td colSpan={2} className="border-r border-[#002060] p-1"><input type="text" value={setup.pass1.mmSaida} onChange={e => setSetup({...setup, pass1: {...setup.pass1, mmSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td colSpan={2} className="border-r border-[#002060] p-1"><input type="text" value={setup.pass2.mmSaida} onChange={e => setSetup({...setup, pass2: {...setup.pass2, mmSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td colSpan={2} className="border-r border-[#002060] p-1"><input type="text" value={setup.pass3.mmSaida} onChange={e => setSetup({...setup, pass3: {...setup.pass3, mmSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                        <td colSpan={2} className="p-1"><input type="text" value={setup.pass4.mmSaida} onChange={e => setSetup({...setup, pass4: {...setup.pass4, mmSaida: e.target.value}})} className="op-editable-input text-center w-full font-black text-xs py-1" placeholder="..." /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Informações de Liberação */}
                        <div className="col-span-12 md:col-span-2 border border-[#002060] rounded p-2 flex flex-col justify-center gap-1.5 bg-slate-50">
                            <div className="flex items-center gap-1 justify-between">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight shrink-0">Resp:</span>
                                <input type="text" value={responsavelHeader} onChange={e => setResponsavelHeader(e.target.value)} className="op-editable-input w-full text-[10px] font-black text-right" placeholder="Nome..." />
                            </div>
                            <div className="flex items-center gap-1 justify-between border-t border-slate-200 pt-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight shrink-0">Aferida:</span>
                                <input type="text" value={bitolaAferida} onChange={e => setBitolaAferida(e.target.value)} className="op-editable-input w-full text-[10px] font-black text-right" placeholder="Mm..." />
                            </div>
                            <div className="flex items-center gap-1 justify-between border-t border-slate-200 pt-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight shrink-0">Liberação:</span>
                                <input type="text" value={liberacao} onChange={e => setLiberacao(e.target.value)} className="op-editable-input w-full text-[10px] font-black text-right text-emerald-700" placeholder="Status..." />
                            </div>
                        </div>
                    </div>

                    {/* TABELA PRINCIPAL DA FICHA */}
                    <div className="border border-[#002060] rounded overflow-hidden relative mb-3">
                        <table className="w-full border-collapse text-left text-[10px] table-fixed">
                            <colgroup>
                                <col style={{ width: '3.5%' }} />
                                <col style={{ width: '6.5%' }} />
                                <col style={{ width: '9.5%' }} />
                                <col style={{ width: '5.5%' }} />
                                <col style={{ width: '7.5%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '5.5%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '7%' }} />
                            </colgroup>
                            <thead>
                                {/* Cabeçalho de Grupos */}
                                <tr className="bg-[#002060] text-white text-[8px] font-black uppercase text-center border-b border-[#002060]">
                                    <th colSpan={9} className="border-r border-[#002060] py-1.5 text-center font-black tracking-wider">
                                        Controle da Matéria Prima (Aços entrada)
                                    </th>
                                    <th colSpan={10} className="py-1.5 text-center font-black tracking-wider">
                                        Controle Produto em Linha / Laboratório (Trefilado)
                                    </th>
                                </tr>
                                {/* Sub-cabeçalho de colunas */}
                                {/* Sub-cabeçalho de colunas */}
                                <tr className="bg-slate-100 border-b border-[#002060] text-[8px] font-black text-slate-700 uppercase text-center">
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Data</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Lote (copex)</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Fornecedor</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Nº Certif.</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Nº Corrida</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 align-middle">Nota Fiscal</th>
                                    <th colSpan={3} className="border-r border-slate-300 p-1 text-center align-middle">Peso (kg)</th>
                                    
                                    <th colSpan={2} className="border-r border-slate-300 p-1 text-center align-middle">Dimensional</th>
                                    <th colSpan={3} className="border-r border-slate-300 p-1 text-center align-middle">Ensaio Tração</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 text-[7.5px] align-middle">Caract. Geom.</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 text-[7.5px] align-middle">Dobram.</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 text-[7.5px] align-middle">Verif. Marcação</th>
                                    <th rowSpan={2} className="border-r border-slate-300 p-1 text-[7.5px] align-middle">Alonga.</th>
                                    <th rowSpan={2} className="p-1 align-middle">Aprovação</th>
                                </tr>
                                <tr className="bg-slate-50 border-b border-[#002060] text-[7px] font-bold text-slate-600 uppercase text-center">
                                    <th className="border-r border-slate-300 p-1 align-middle">etiqueta</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">balança</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">diferença</th>
                                    
                                    <th className="border-r border-slate-300 p-1 align-middle">massa linear</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">bitola (mm)</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">R.T</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">L.E</th>
                                    <th className="border-r border-slate-300 p-1 align-middle">RT/LE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const diff = (row.pesoBalanca !== '' && row.pesoEtiqueta !== '') ? (Number(row.pesoBalanca) - Number(row.pesoEtiqueta)) : null;
                                    const parsedRt = parseFloat(row.rt);
                                    const parsedLe = parseFloat(row.le);
                                    const ratio = (!isNaN(parsedRt) && !isNaN(parsedLe) && parsedLe > 0) ? (parsedRt / parsedLe).toFixed(2) : null;

                                    return (
                                        <tr key={row.id} className="border-b border-slate-300 hover:bg-slate-50/50 text-center font-bold">
                                            {/* Data */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.data} onChange={e => updateRowField(row.id, 'data', e.target.value)} className="op-editable-input text-center w-full font-black text-[9px]" placeholder="dd/mm" />
                                            </td>
                                            
                                            {/* Lote autocomplete */}
                                            <td className="border-r border-slate-300 p-0.5 relative">
                                                <input 
                                                    type="text" 
                                                    value={row.lote} 
                                                    onChange={e => handleLoteChange(row.id, e.target.value)} 
                                                    onFocus={() => {
                                                        setFilterText(row.lote);
                                                        setActiveSuggestionRowId(row.id);
                                                    }}
                                                    className="op-editable-input text-center w-full font-black text-[9px] uppercase text-[#002060]" 
                                                    placeholder="Lote..." 
                                                />
                                                {/* Popover suggestions */}
                                                {(activeSuggestionRowId === row.id && suggestions.length > 0) && (
                                                    <div ref={suggestionsRef} className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#002060] rounded shadow-xl z-50 text-left text-[8px] suggestions-dropdown max-h-[160px] overflow-y-auto font-sans">
                                                        {suggestions.map(item => (
                                                            <div 
                                                                key={item.id}
                                                                onClick={() => handleSelectSuggestion(row.id, item)}
                                                                className="p-1.5 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                                                            >
                                                                <div className="font-bold text-[#002060]">{item.internalLot} {item.supplierLot ? `(${item.supplierLot})` : ''}</div>
                                                                <div className="text-slate-500 font-medium">Forn: {item.supplier || '-'} | NF: {item.nfe || '-'} | Peso: {item.labelWeight || item.weight || '-'} kg</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Fornecedor */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.fornecedor} onChange={e => updateRowField(row.id, 'fornecedor', e.target.value)} className="op-editable-input text-left w-full font-bold text-[8px] uppercase truncate" placeholder="..." />
                                            </td>

                                            {/* Nº Certificado */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.certificado} onChange={e => updateRowField(row.id, 'certificado', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Nº Corrida */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.corrida} onChange={e => updateRowField(row.id, 'corrida', e.target.value)} className="op-editable-input text-center w-full font-black text-[9px] uppercase" placeholder="..." />
                                            </td>

                                            {/* Nota Fiscal */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.notaFiscal} onChange={e => updateRowField(row.id, 'notaFiscal', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Peso Etiqueta */}
                                            <td className="border-r border-slate-300 p-0.5 bg-slate-50/40">
                                                <input 
                                                    type="number" 
                                                    value={row.pesoEtiqueta} 
                                                    onChange={e => updateRowField(row.id, 'pesoEtiqueta', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="op-editable-input text-center w-full font-black text-[9px] text-[#002060]" 
                                                    placeholder="0" 
                                                />
                                            </td>

                                            {/* Peso Balança */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input 
                                                    type="number" 
                                                    value={row.pesoBalanca} 
                                                    onChange={e => updateRowField(row.id, 'pesoBalanca', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="op-editable-input text-center w-full font-black text-[9px] text-[#002060]" 
                                                    placeholder="0" 
                                                />
                                            </td>

                                            {/* Peso Diferença (Calculado) */}
                                            <td className={`border-r border-slate-300 p-0.5 font-black text-center text-[9px] ${diff && diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {diff !== null ? `${diff > 0 ? '+' : ''}${diff}` : '-'}
                                            </td>

                                            {/* Dimensional - Massa Linear */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.massaLinear} onChange={e => updateRowField(row.id, 'massaLinear', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Dimensional - Bitola mm */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.bitolaMm} onChange={e => updateRowField(row.id, 'bitolaMm', e.target.value)} className="op-editable-input text-center w-full font-black text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Tração - R.T */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.rt} onChange={e => updateRowField(row.id, 'rt', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Tração - L.E */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.le} onChange={e => updateRowField(row.id, 'le', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Tração - RT/LE (Calculado) */}
                                            <td className="border-r border-slate-300 p-0.5 font-black text-center text-[9px] text-[#002060]">
                                                {ratio !== null ? ratio : '-'}
                                            </td>

                                            {/* Geometrica */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.caractGeo} onChange={e => updateRowField(row.id, 'caractGeo', e.target.value)} className="op-editable-input text-center w-full font-medium text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Dobramento */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.dobramento} onChange={e => updateRowField(row.id, 'dobramento', e.target.value)} className="op-editable-input text-center w-full font-medium text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Verif. Marcação */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.verifMarcacao} onChange={e => updateRowField(row.id, 'verifMarcacao', e.target.value)} className="op-editable-input text-center w-full font-medium text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Alongamento */}
                                            <td className="border-r border-slate-300 p-0.5">
                                                <input type="text" value={row.alongamento} onChange={e => updateRowField(row.id, 'alongamento', e.target.value)} className="op-editable-input text-center w-full font-bold text-[9px]" placeholder="..." />
                                            </td>

                                            {/* Aprovação */}
                                            <td className="p-0.5 relative group">
                                                <input type="text" value={row.aprovacao} onChange={e => updateRowField(row.id, 'aprovacao', e.target.value)} className="op-editable-input text-center w-full font-black text-[9px] text-emerald-700 uppercase" placeholder="..." />
                                                <button onClick={() => removeRow(row.id)} className="absolute right-0.5 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 font-bold no-print opacity-0 group-hover:opacity-100 transition-opacity p-0.5" title="Remover lote">✕</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Botões extras sob a tabela (Apenas na tela) */}
                    <div className="flex justify-start mb-3 no-print">
                        <button onClick={addRow} className="border-2 border-[#002060] text-[#002060] font-black text-[10px] px-3 py-1 rounded hover:bg-[#002060] hover:text-white transition-all uppercase">
                            + Adicionar Linha de Ensaio
                        </button>
                    </div>

                    {/* RODAPÉ: PERDA E ASSINATURAS */}
                    <div className="grid grid-cols-12 gap-3 mt-3 pt-2 border-t border-slate-200">
                        {/* Porcentagem de perca */}
                        <div className="col-span-12 md:col-span-4 flex items-center justify-center p-1 border border-[#002060] rounded bg-slate-50">
                            <span className="text-[9px] font-black text-slate-500 uppercase shrink-0 tracking-tighter mr-2">(porcentagem de perca) :</span>
                            <input type="text" value={porcentagemPerca} onChange={e => setPorcentagemPerca(e.target.value)} className="op-editable-input text-center font-black text-[#002060] text-xs w-20" placeholder="Ex: 1,5%" />
                        </div>

                        {/* Responsável Assinatura */}
                        <div className="col-span-12 md:col-span-4 flex items-center p-1 border border-[#002060] rounded bg-slate-50">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight shrink-0 mr-1.5">Responsável:</span>
                            <input type="text" value={responsavelFooter} onChange={e => setResponsavelFooter(e.target.value)} className="op-editable-input text-center font-black text-xs w-full" placeholder="..." />
                        </div>

                        {/* Responsável Laboratório Assinatura */}
                        <div className="col-span-12 md:col-span-4 flex items-center p-1 border border-[#002060] rounded bg-slate-50">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight shrink-0 mr-1.5">Resp. Laboratório:</span>
                            <input type="text" value={responsavelLab} onChange={e => setResponsavelLab(e.target.value)} className="op-editable-input text-center font-black text-xs w-full" placeholder="..." />
                        </div>
                    </div>

                    {/* Logo Marca D'água ou rodapé decorativo premium */}
                    <div className="text-center text-[7px] text-slate-400 font-extrabold uppercase mt-4 tracking-widest no-print">
                        Ficha Técnica Certificada - Grupo Ita Aços v1.2
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsOPTrefila;
