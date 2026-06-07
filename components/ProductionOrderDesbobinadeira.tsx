import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola, StockGauge, User, MachineType } from '../types';
import { TrefilaBitolaOptions, FioMaquinaBitolaOptions } from '../types';
import { ClipboardListIcon, WarningIcon, AdjustmentsIcon } from './icons';
import ProductionOrderHistoryModal from './ProductionOrderHistoryModal';
import ProductionOrderReport from './ProductionOrderReport';
import { extractOrderDataFromPDF } from '../services/geminiService';

interface ProductionOrderDesbobinadeiraProps {
    setPage: (page: Page) => void;
    stock: StockItem[];
    productionOrders: ProductionOrderData[];
    addProductionOrder: (order: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => void;
    showNotification: (message: string, type: 'success' | 'error') => void;
    updateProductionOrder: (orderId: string, data: { orderNumber?: string; targetBitola?: Bitola }) => void;
    deleteProductionOrder: (orderId: string) => void;
    gauges: StockGauge[];
    currentUser: User | null;
}

interface OSItem {
    os: string | null;
    bitola: string | null;
    steelType: string | null;
    length: number | null;
    quantity: number | null;
    weight: number | null;
    drawingType: string | null;
}

const ProductionOrderDesbobinadeira: React.FC<ProductionOrderDesbobinadeiraProps> = ({ 
    setPage, stock, productionOrders, addProductionOrder, showNotification, 
    updateProductionOrder, deleteProductionOrder, gauges, currentUser 
}) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    
    // States for Form
    const [orderNumber, setOrderNumber] = useState('');
    const [ghostTargetWeight, setGhostTargetWeight] = useState('');
    const [inputBitolaFilter, setInputBitolaFilter] = useState<Bitola | ''>('');
    const [targetBitola, setTargetBitola] = useState<Bitola>('');

    // States for AI Extraction & OS List
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [aiExtractedFields, setAiExtractedFields] = useState<Record<string, boolean>>({});
    const [osItems, setOsItems] = useState<OSItem[]>([]);

    // Modals
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);

    // Drag-and-drop state
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // List of desbobinadeira orders
    const desbobinadeiraProductionOrders = useMemo(() => {
        return productionOrders.filter(o => o.machine === 'Desbobinadeira 1');
    }, [productionOrders]);

    // Available gauges options (used for datalist autocomplete)
    const inputGauges = useMemo(() => {
        const baseGauges = FioMaquinaBitolaOptions;
        const customGauges = gauges.filter(g => g.materialType === 'Fio Máquina');
        const allOptions = [
            ...baseGauges.map(g => ({ gauge: g, code: '' })),
            ...customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }))
        ];
        const map = new Map();
        allOptions.forEach(opt => {
            const existing = map.get(opt.gauge);
            if (!existing || (opt.code && !existing.code)) {
                map.set(opt.gauge, opt);
            }
        });
        return Array.from(map.values())
            .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));
    }, [gauges]);

    const outputGauges = useMemo(() => {
        const baseGauges = TrefilaBitolaOptions;
        const customGauges = gauges.filter(g => g.materialType === 'CA-60');
        const allOptions = [
            ...baseGauges.map(g => ({ gauge: g, code: '' })),
            ...customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }))
        ];
        const map = new Map();
        allOptions.forEach(opt => {
            const existing = map.get(opt.gauge);
            if (!existing || (opt.code && !existing.code)) {
                map.set(opt.gauge, opt);
            }
        });
        return Array.from(map.values())
            .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));
    }, [gauges]);

    // Initialize default target bitola if empty
    useEffect(() => {
        if (outputGauges.length > 0 && !targetBitola) {
            setTargetBitola(outputGauges[0].gauge as Bitola);
        }
    }, [outputGauges, targetBitola]);

    // Auto-update total planned weight based on sum of edited OS items
    useEffect(() => {
        if (osItems.length > 0) {
            const sum = osItems.reduce((acc, item) => acc + (item.weight || 0), 0);
            if (sum > 0) {
                setGhostTargetWeight(sum.toFixed(3).replace('.', ','));
            }
        }
    }, [osItems]);

    // Helper: find closest gauge
    const findClosestBitola = (extractedVal: string | null | undefined, optionsList: { gauge: string }[]): string => {
        if (!extractedVal) return '';
        const cleaned = extractedVal.replace(/[^\d.,]/g, '').replace(',', '.');
        const parsedExtracted = parseFloat(cleaned);
        if (isNaN(parsedExtracted)) return '';

        let closest = '';
        let minDiff = Infinity;

        optionsList.forEach(opt => {
            const parsedOpt = parseFloat(opt.gauge.replace(',', '.'));
            if (!isNaN(parsedOpt)) {
                const diff = Math.abs(parsedOpt - parsedExtracted);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = opt.gauge;
                }
            }
        });

        // Match if within 0.50 mm
        return minDiff < 0.5 ? closest : '';
    };

    // AI file scanning simulator for micro-animation steps
    const runAISteps = (file: File) => {
        setIsAnalyzing(true);
        setAnalysisStep('Carregando arquivo PDF...');
        setElapsedTime(0);
        
        const stepTimer1 = setTimeout(() => setAnalysisStep('Lendo documento com Inteligência Artificial (Gemini)...'), 500);
        const stepTimer2 = setTimeout(() => setAnalysisStep('Analisando posições (OS) e cortes...'), 1200);
        const stepTimer3 = setTimeout(() => setAnalysisStep('Processando dados da tabela de ferros...'), 2200);

        const clockInterval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        extractOrderDataFromPDF(file)
            .then(result => {
                clearInterval(clockInterval);
                clearTimeout(stepTimer1);
                clearTimeout(stepTimer2);
                clearTimeout(stepTimer3);

                setAnalysisStep('Exibindo dados na lista...');
                
                const newExtractedFields: Record<string, boolean> = {};

                if (result.orderNumber) {
                    setOrderNumber(result.orderNumber);
                    newExtractedFields.orderNumber = true;
                }

                if (result.totalWeight && result.totalWeight > 0) {
                    setGhostTargetWeight(result.totalWeight.toString().replace('.', ','));
                    newExtractedFields.ghostTargetWeight = true;
                }

                // Match or prefill input bitola directly
                const matchedInput = findClosestBitola(result.inputBitola, inputGauges);
                if (matchedInput) {
                    setInputBitolaFilter(matchedInput as Bitola);
                    newExtractedFields.inputBitola = true;
                } else if (result.inputBitola) {
                    setInputBitolaFilter(result.inputBitola as Bitola);
                    newExtractedFields.inputBitola = true;
                }

                // Match or prefill output bitola directly
                const matchedOutput = findClosestBitola(result.targetBitola, outputGauges);
                if (matchedOutput) {
                    setTargetBitola(matchedOutput as Bitola);
                    newExtractedFields.targetBitola = true;
                } else if (result.targetBitola) {
                    setTargetBitola(result.targetBitola as Bitola);
                    newExtractedFields.targetBitola = true;
                }

                setAiExtractedFields(newExtractedFields);
                setOsItems(result.items || []);
                setPdfFile(file);
                showNotification('Ordem de Produção PDF lida com sucesso! Você pode editar a lista de OS abaixo.', 'success');
            })
            .catch(err => {
                clearInterval(clockInterval);
                clearTimeout(stepTimer1);
                clearTimeout(stepTimer2);
                clearTimeout(stepTimer3);
                console.error(err);
                const errMsg = err?.message || 'Erro desconhecido';
                showNotification(`Falha ao processar o PDF: ${errMsg}`, 'error');
            })
            .finally(() => {
                clearInterval(clockInterval);
                setIsAnalyzing(false);
            });
    };

    // Drag-and-drop events
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                runAISteps(file);
            } else {
                showNotification('Por favor, envie apenas arquivos em formato PDF.', 'error');
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            runAISteps(file);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const resetPdf = () => {
        setPdfFile(null);
        setOsItems([]);
        setAiExtractedFields({});
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle Manual input changes (removes the AI badge for that field)
    const handleInputChange = (field: string, value: string, setter: (val: string) => void) => {
        setter(value);
        if (aiExtractedFields[field]) {
            setAiExtractedFields(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    // OS List Editing
    const updateOSField = (index: number, key: keyof OSItem, val: any) => {
        setOsItems(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [key]: val
            };
            return updated;
        });
    };

    const addOSItem = () => {
        setOsItems(prev => [
            ...prev,
            {
                os: `OS ${prev.length + 1}`,
                bitola: targetBitola || '10',
                steelType: 'CA50',
                length: 100,
                quantity: 1,
                weight: 0.5,
                drawingType: 'Reto'
            }
        ]);
    };

    const removeOSItem = (index: number) => {
        setOsItems(prev => prev.filter((_, i) => i !== index));
    };

    // Form Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim()) {
            showNotification('O número da ordem de produção é obrigatório.', 'error');
            return;
        }
        if (productionOrders.some(o => o.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase())) {
            showNotification(`O número de ordem "${orderNumber}" já existe.`, 'error');
            return;
        }
        if (!ghostTargetWeight || parseFloat(ghostTargetWeight.replace(',', '.')) <= 0) {
            showNotification('Informe um peso de produção válido.', 'error');
            return;
        }

        // Capture osItems BEFORE any reset (protect from async race)
        const snapshotItems = [...osItems];

        // Add as Ghost Order (always true for Desbobinadeira since we bypass stock lots)
        await addProductionOrder({
            orderNumber,
            machine: 'Desbobinadeira 1' as MachineType,
            targetBitola: 'N/A' as Bitola,
            selectedLotIds: [],
            totalWeight: parseFloat(ghostTargetWeight.replace(',', '.')),
            isGhostOrder: true,
            inputBitola: 'N/A',
            summary: snapshotItems.length > 0 ? { items: snapshotItems } : null,
            os_items: snapshotItems.length > 0 ? snapshotItems : null,
        } as any);

        // Reset Form (only AFTER save completes)
        setOrderNumber('');
        setGhostTargetWeight('');
        setInputBitolaFilter('');
        resetPdf();
    };

    const handleClearForm = () => {
        setOrderNumber('');
        setGhostTargetWeight('');
        setInputBitolaFilter('');
        if (outputGauges.length > 0) {
            setTargetBitola(outputGauges[0].gauge as Bitola);
        }
        resetPdf();
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {showHistoryModal && (
                <ProductionOrderHistoryModal
                    orders={desbobinadeiraProductionOrders}
                    stock={stock}
                    onClose={() => setShowHistoryModal(false)}
                    updateProductionOrder={updateProductionOrder}
                    deleteProductionOrder={deleteProductionOrder}
                    currentUser={currentUser}
                    onShowReport={(order) => {
                        setProductionReportData(order);
                        setShowHistoryModal(false);
                    }}
                />
            )}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                    gauges={gauges}
                />
            )}

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 pt-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Criar Ordem de Produção</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mt-1">🔬 Projetos Novos (Desbobinadeira 1) • Edição Dinâmica de Desenhos</p>
                </div>
                <div className="flex items-center gap-3">
                    {isGestor && (
                        <button
                            type="button"
                            onClick={() => setPage('gaugesManager')}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-4 rounded-xl border border-blue-200 shadow-sm transition flex items-center gap-2 text-sm"
                        >
                            <AdjustmentsIcon className="h-4 w-4" />
                            <span>Gerenciar Bitolas</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl border border-slate-300 transition flex items-center gap-2 shadow-sm text-sm"
                    >
                        <ClipboardListIcon className="h-4 w-4" />
                        <span>Ver Ordens Criadas</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form Column */}
                <div className="lg:col-span-4 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <span className="p-1.5 bg-[#0F3F5C]/10 text-[#0F3F5C] rounded-lg">📋</span>
                                Parâmetros da Ordem
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Máquina Destino</label>
                                <input
                                    type="text"
                                    value="Desbobinadeira 1"
                                    disabled
                                    className="p-3 w-full border border-slate-200 rounded-xl font-bold bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label htmlFor="orderNumber" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Número da Ordem / OP</label>
                                    {aiExtractedFields.orderNumber && (
                                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                            ✨ IA
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    id="orderNumber"
                                    value={orderNumber}
                                    onChange={(e) => handleInputChange('orderNumber', e.target.value, setOrderNumber)}
                                    placeholder="Ex: OP-10492"
                                    className={`p-3 w-full border rounded-xl text-sm font-semibold transition focus:ring-2 focus:ring-[#0F3F5C]/20 outline-none ${
                                        aiExtractedFields.orderNumber ? 'border-violet-300 bg-violet-50/20' : 'border-slate-200'
                                    }`}
                                    required
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label htmlFor="ghostWeight" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Peso Planejado (kg)</label>
                                    {aiExtractedFields.ghostTargetWeight && (
                                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                            ✨ IA
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    id="ghostWeight"
                                    value={ghostTargetWeight}
                                    onChange={(e) => handleInputChange('ghostTargetWeight', e.target.value, setGhostTargetWeight)}
                                    placeholder="Ex: 1500,00"
                                    className={`p-3 w-full border rounded-xl text-sm font-bold transition focus:ring-2 focus:ring-[#0F3F5C]/20 outline-none ${
                                        aiExtractedFields.ghostTargetWeight ? 'border-violet-300 bg-violet-50/20' : 'border-slate-200'
                                    }`}
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col gap-2">
                            <button
                                type="submit"
                                className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black py-3.5 px-4 rounded-xl transition shadow-lg shadow-slate-200 uppercase tracking-wider text-xs active:scale-[0.99]"
                            >
                                Criar Ordem de Produção
                            </button>
                            <button
                                type="button"
                                onClick={handleClearForm}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs uppercase"
                            >
                                Limpar
                            </button>
                        </div>
                    </form>
                </div>

                {/* Upload and AI Panel Column */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="border-b border-slate-100 pb-3 mb-6">
                            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <span className="p-1.5 bg-violet-100 text-violet-700 rounded-lg">✨</span>
                                Leitura de PDF por IA
                            </h2>
                        </div>

                        {/* File Upload / Scanner Area */}
                        <div className="flex flex-col justify-center items-center">
                            {isAnalyzing ? (
                                /* AI Scanning Animation */
                                <div className="w-full max-w-md p-8 bg-violet-50/35 border-2 border-violet-200 rounded-3xl text-center space-y-6 animate-pulse relative overflow-hidden shadow-inner">
                                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent top-0 animate-bounce" style={{ animationDuration: '3s' }} />
                                    
                                    <div className="relative inline-flex items-center justify-center">
                                        <div className="w-20 h-20 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center animate-ping absolute opacity-25" />
                                        <div className="w-20 h-20 bg-violet-200/50 text-violet-700 rounded-full flex items-center justify-center relative shadow">
                                            <svg className="w-10 h-10 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Lendo e Processando o PDF...</h3>
                                        <p className="text-sm font-bold text-violet-700 italic mt-2 animate-bounce">{analysisStep}</p>
                                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">Tempo decorrido: {elapsedTime}s</p>
                                    </div>
                                </div>
                            ) : pdfFile ? (
                                /* Success Summary & Editable OS List */
                                <div className="w-full space-y-5">
                                    <div className="flex items-center justify-between bg-emerald-50/30 p-4 border border-emerald-100 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight truncate max-w-xs">{pdfFile.name}</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{(pdfFile.size / 1024).toFixed(1)} KB • LIDO PELA IA</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetPdf}
                                            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition uppercase"
                                        >
                                            Remover Arquivo
                                        </button>
                                    </div>

                                    {/* Resumo por Bitola */}
                                    {(() => {
                                        // Group items by bitola
                                        const grouped = osItems.reduce((acc: Record<string, { osCount: number, pieces: number, weight: number, meters: number }>, item) => {
                                            const rawB = item.bitola || 'Indefinida';
                                            // Normalize key
                                            const b = rawB.trim().replace('.', ',');
                                            if (!acc[b]) {
                                                acc[b] = { osCount: 0, pieces: 0, weight: 0, meters: 0 };
                                            }
                                            acc[b].osCount += 1;
                                            acc[b].pieces += item.quantity || 0;
                                            acc[b].weight += item.weight || 0;
                                            // Length is in cm, calculate meters: (qty * length) / 100
                                            const itemMeters = ((item.quantity || 0) * (item.length || 0)) / 100;
                                            acc[b].meters += itemMeters;
                                            return acc;
                                        }, {} as Record<string, { osCount: number, pieces: number, weight: number, meters: number }>);

                                        const groupedArray = Object.entries(grouped);
                                        if (groupedArray.length === 0) return null;

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {groupedArray.map(([bitola, stats]: [string, { osCount: number, pieces: number, weight: number, meters: number }]) => (
                                                    <div key={bitola} className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 bg-[#0F3F5C]/10 text-[#0F3F5C] px-3 py-1 font-bold text-xs rounded-bl-xl">
                                                            {bitola} mm
                                                        </div>
                                                        <div className="space-y-1 mt-1">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitola</div>
                                                            <div className="text-lg font-black text-slate-800">{bitola} mm</div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200/60">
                                                            <div>
                                                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Ordens (OS)</span>
                                                                <span className="text-xs font-black text-slate-700">{stats.osCount}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Cortes/Pcs</span>
                                                                <span className="text-xs font-black text-[#0F3F5C]">{stats.pieces}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Peso (kg)</span>
                                                                <span className="text-xs font-black text-emerald-600">{stats.weight.toFixed(2).replace('.', ',')}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 text-[10px] font-bold text-slate-500 bg-white border border-slate-200/40 py-1 px-2 rounded-lg flex justify-between">
                                                            <span>METROS TOTAIS:</span>
                                                            <span className="text-slate-800">{stats.meters.toFixed(2).replace('.', ',')} m</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Editable Table */}
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-inner space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalhamento das Posições (Editar Desenho)</h4>
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Altere qualquer valor diretamente na tabela abaixo</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addOSItem}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                                            >
                                                <span>➕ Adicionar Item</span>
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto max-h-[350px] custom-scrollbar">
                                            <table className="w-full text-xs text-left text-slate-500 border-collapse">
                                                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 sticky top-0 font-bold">
                                                    <tr className="border-b">
                                                        <th className="px-2 py-2">OS</th>
                                                        <th className="px-2 py-2">Bitola (mm)</th>
                                                        <th className="px-2 py-2">Aço</th>
                                                        <th className="px-2 py-2 text-right">Qtd (Cortes)</th>
                                                        <th className="px-2 py-2 text-right">Compr (cm)</th>
                                                        <th className="px-2 py-2">Formato</th>
                                                        <th className="px-2 py-2 text-right">Peso (kg)</th>
                                                        <th className="px-2 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {osItems.map((item, idx) => (
                                                        <tr key={idx} className="border-b hover:bg-slate-50/50">
                                                            <td className="p-1">
                                                                <input
                                                                    type="text"
                                                                    value={item.os || ''}
                                                                    onChange={(e) => updateOSField(idx, 'os', e.target.value)}
                                                                    className="w-16 p-1 border border-transparent rounded bg-transparent font-bold text-slate-900 focus:bg-white focus:border-slate-300 outline-none text-center"
                                                                />
                                                            </td>
                                                            <td className="p-1">
                                                                <input
                                                                    type="text"
                                                                    value={item.bitola || ''}
                                                                    onChange={(e) => updateOSField(idx, 'bitola', e.target.value)}
                                                                    className="w-16 p-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none text-center"
                                                                />
                                                            </td>
                                                            <td className="p-1">
                                                                <input
                                                                    type="text"
                                                                    value={item.steelType || ''}
                                                                    onChange={(e) => updateOSField(idx, 'steelType', e.target.value)}
                                                                    className="w-14 p-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none text-center"
                                                                />
                                                            </td>
                                                            <td className="p-1 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity || 0}
                                                                    onChange={(e) => updateOSField(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                                    className="w-16 p-1 border border-transparent rounded bg-transparent font-bold text-blue-600 text-right focus:bg-white focus:border-slate-300 outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={item.length || 0}
                                                                    onChange={(e) => updateOSField(idx, 'length', parseFloat(e.target.value) || 0)}
                                                                    className="w-16 p-1 border border-transparent rounded bg-transparent font-semibold text-slate-800 text-right focus:bg-white focus:border-slate-300 outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1">
                                                                <select
                                                                    value={item.drawingType || 'Reto'}
                                                                    onChange={(e) => updateOSField(idx, 'drawingType', e.target.value)}
                                                                    className="p-1 border border-transparent rounded bg-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-[10px] uppercase"
                                                                >
                                                                    <option value="Reto">Reto</option>
                                                                    <option value="Gancho">Gancho</option>
                                                                    <option value="Estribo">Estribo</option>
                                                                    <option value="Outro">Outro</option>
                                                                </select>
                                                            </td>
                                                            <td className="p-1 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={item.weight || 0}
                                                                    onChange={(e) => updateOSField(idx, 'weight', parseFloat(e.target.value) || 0)}
                                                                    className="w-20 p-1 border border-transparent rounded bg-transparent text-slate-500 text-right focus:bg-white focus:border-slate-300 outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeOSItem(idx)}
                                                                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition"
                                                                    title="Remover Item"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Drag and Drop Box */
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={triggerFileSelect}
                                    className={`w-full max-w-lg p-10 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-4 hover:shadow-lg active:scale-[0.99] select-none ${
                                        isDragging
                                            ? 'border-violet-500 bg-violet-50/50 shadow-md shadow-violet-100'
                                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="application/pdf"
                                        className="hidden"
                                    />
                                    
                                    <div className={`p-4 rounded-2xl transition-all duration-300 ${isDragging ? 'bg-violet-100 text-violet-700' : 'bg-white text-slate-400 shadow-sm border'}`}>
                                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                            Arraste e solte o PDF da Ordem
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1 font-semibold">
                                            Ou clique para navegar no computador
                                        </p>
                                    </div>
                                    
                                    <div className="bg-slate-200/50 px-3 py-1.5 rounded-lg text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        Somente arquivos PDF
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Optional Manual Initialization */}
                        {!pdfFile && !isAnalyzing && (
                            <div className="mt-4 text-center">
                                <span className="text-xs text-slate-400 font-semibold">Ou inicie uma lista de cortes vazia:</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPdfFile(new File([], 'Ordem Criada Manualmente.pdf'));
                                        addOSItem();
                                    }}
                                    className="ml-2 text-xs font-bold text-[#0F3F5C] hover:underline"
                                >
                                    Criar lista manualmente
                                </button>
                            </div>
                        )}

                        {/* Informative Footer */}
                        <div className="bg-slate-50 rounded-2xl p-4 mt-6 border border-slate-100 text-xs text-slate-500 font-semibold space-y-1">
                            <p className="text-slate-700 font-bold flex items-center gap-1.5">
                                <span className="text-violet-600">ℹ</span> COMO FUNCIONA A EXTRAÇÃO:
                            </p>
                            <p>1. Carregue o PDF com os desenhos e tabelas de cortes das OS.</p>
                            <p>2. A IA interpretará e criará uma tabela editável com as dimensões.</p>
                            <p>3. Você poderá alterar diâmetros, cortar comprimentos ou incluir novas OS na lista.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductionOrderDesbobinadeira;
