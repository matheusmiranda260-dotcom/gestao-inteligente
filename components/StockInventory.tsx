import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StockItem, Page, InventorySession, User } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { PrinterIcon, ArrowLeftIcon, SearchIcon, FilterIcon, CheckCircleIcon, XCircleIcon, ScaleIcon, SaveIcon, ChevronRightIcon, PlusIcon, ChatBubbleLeftRightIcon, ClockIcon, LockClosedIcon, LockOpenIcon } from './icons';
import InventorySessionReport from './InventorySessionReport';

interface StockInventoryProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
    updateStockItem: (id: string, updates: Partial<StockItem>) => Promise<void>;
    addStockItem: (item: StockItem) => Promise<void>;
    inventorySessions: InventorySession[];
    addInventorySession: (session: InventorySession) => Promise<void>;
    updateInventorySession: (id: string, updates: Partial<InventorySession>) => Promise<void>;
    deleteInventorySession: (id: string) => Promise<void>;
    currentUser: User | null;
}

type AuditStep = 'select' | 'list' | 'confirm' | 'quick-add';

const StockInventory: React.FC<StockInventoryProps> = ({ stock, setPage, updateStockItem, addStockItem, inventorySessions, addInventorySession, updateInventorySession, deleteInventorySession, currentUser }) => {
    const [mode, setMode] = useState<'report' | 'audit'>('report');
    const [reportFilters, setReportFilters] = useState({
        searchTerm: '',
        statusFilter: '',
        materialFilter: '',
        bitolaFilter: ''
    });

    // Audit State
    const [auditStep, setAuditStep] = useState<AuditStep>('select');
    const [auditFilters, setAuditFilters] = useState({ material: '', bitola: '' });
    const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
    const [selectedSessionForReport, setSelectedSessionForReport] = useState<InventorySession | null>(null);
    const [auditSearch, setAuditSearch] = useState('');
    const [selectedLot, setSelectedLot] = useState<StockItem | null>(null);
    const [physicalWeight, setPhysicalWeight] = useState<string>('');
    const [auditObservation, setAuditObservation] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    const [quickAddData, setQuickAddData] = useState({
        internalLot: '',
        materialType: '',
        bitola: '',
        weight: '',
        observation: ''
    });

    // Session state to track what was checked in this audit
    const [sessionCheckedIds, setSessionCheckedIds] = useState<Set<string>>(new Set());

    const [auditHistory, setAuditHistory] = useState<{ lot: string, status: 'ok' | 'diff', diff: number }[]>([]);
    const auditInputRef = useRef<HTMLInputElement>(null);

    const allBitolaOptions = useMemo(() => [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort(), []);

    // 1. Filtered stock for the main report view
    const filteredReportStock = useMemo(() => {
        return stock
            .filter(item => {
                const term = reportFilters.searchTerm.toLowerCase();
                return (
                    item.internalLot.toLowerCase().includes(term) ||
                    item.supplierLot.toLowerCase().includes(term) ||
                    item.supplier.toLowerCase().includes(term) ||
                    item.nfe.toLowerCase().includes(term)
                );
            })
            .filter(item => reportFilters.statusFilter === '' || item.status === reportFilters.statusFilter)
            .filter(item => reportFilters.materialFilter === '' || item.materialType === reportFilters.materialFilter)
            .filter(item => reportFilters.bitolaFilter === '' || item.bitola === reportFilters.bitolaFilter)
            .sort((a, b) => {
                if (a.materialType !== b.materialType) return a.materialType.localeCompare(b.materialType);
                if (a.bitola !== b.bitola) return parseFloat(a.bitola) - parseFloat(b.bitola);
                return a.internalLot.localeCompare(b.internalLot);
            });
    }, [stock, reportFilters]);

    // 2. Filtered stock for the current audit session
    const auditPool = useMemo(() => {
        if (!auditFilters.material || !auditFilters.bitola) return [];
        return stock
            .filter(item => item.materialType === auditFilters.material && item.bitola === auditFilters.bitola)
            .filter(item => item.status !== 'Transferido' && !item.status.includes('Consumido'))
            .sort((a, b) => a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true }));
    }, [stock, auditFilters]);

    const isAuditLocked = useMemo(() => {
        if (!auditFilters.material || !auditFilters.bitola) return false;
        return inventorySessions.some(s => s.materialType === auditFilters.material && s.bitola === auditFilters.bitola && s.status === 'completed');
    }, [inventorySessions, auditFilters]);

    const isReAuditActive = useMemo(() => {
        if (!auditFilters.material || !auditFilters.bitola) return false;
        return inventorySessions.some(s => s.materialType === auditFilters.material && s.bitola === auditFilters.bitola && s.status === 're-audit');
    }, [inventorySessions, auditFilters]);

    const auditListFiltered = useMemo(() => {
        if (!auditSearch) return auditPool;
        return auditPool.filter(item =>
            item.internalLot.toLowerCase().includes(auditSearch.toLowerCase()) ||
            item.supplierLot.toLowerCase().includes(auditSearch.toLowerCase())
        );
    }, [auditPool, auditSearch]);

    const stats = useMemo(() => {
        const checked = auditPool.filter(i => sessionCheckedIds.has(i.id)).length;
        return { total: auditPool.length, checked };
    }, [auditPool, sessionCheckedIds]);

    const reportStats = useMemo(() => {
        const total = filteredReportStock.length;
        const audited = filteredReportStock.filter(item => sessionCheckedIds.has(item.id) || item.lastAuditDate).length;
        return { total, audited };
    }, [filteredReportStock, sessionCheckedIds]);

    // Audit Logic
    useEffect(() => {
        if (auditStep === 'list' && auditInputRef.current) {
            auditInputRef.current.focus();
        }
    }, [auditStep]);

    const handleAuditSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const lot = auditPool.find(s => s.internalLot.toLowerCase() === auditSearch.toLowerCase().trim());
        if (lot) {
            handleSelectLot(lot);
        } else {
            alert('Lote não encontrado nesta lista!');
        }
    };

    const handleSelectLot = (lot: StockItem) => {
        setSelectedLot(lot);
        setPhysicalWeight(lot.remainingQuantity.toFixed(0));
        setAuditObservation(lot.auditObservation || '');
        setAuditStep('confirm');
    };

    const confirmAudit = async () => {
        if (!selectedLot || isAuditLocked) return;
        setIsSaving(true);
        const newWeight = parseFloat(physicalWeight);
        const diff = newWeight - selectedLot.remainingQuantity;

        try {
            const historyEntry = {
                type: 'Inventário (Conferência)',
                date: new Date().toISOString(),
                details: {
                    'Peso Anterior': `${selectedLot.remainingQuantity.toFixed(2)} kg`,
                    'Peso Informado': `${newWeight.toFixed(2)} kg`,
                    'Diferença': `${diff.toFixed(2)} kg`
                }
            };

            await updateStockItem(selectedLot.id, {
                remainingQuantity: newWeight,
                lastAuditDate: new Date().toISOString(),
                auditObservation: auditObservation || null,
                history: [...(selectedLot.history || []), historyEntry]
            });

            setSessionCheckedIds(prev => new Set(prev).add(selectedLot.id));

            setAuditHistory(prev => [{
                lot: selectedLot.internalLot,
                status: Math.abs(diff) < 0.1 ? 'ok' : 'diff',
                diff: diff
            }, ...prev].slice(0, 5));

            setSelectedLot(null);
            setPhysicalWeight('');
            setAuditObservation('');
            setAuditSearch('');
            setAuditStep('list');
        } catch (error) {
            alert('Erro ao salvar conferência.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuickAdd = async () => {
        if (!quickAddData.internalLot || !quickAddData.materialType || !quickAddData.bitola || !quickAddData.weight) {
            alert('Preencha os campos obrigatórios!');
            return;
        }

        setIsSaving(true);
        try {
            const newItem: StockItem = {
                id: `TEMP-${Date.now()}`,
                entryDate: new Date().toISOString(),
                supplier: 'CADASTRADO NO INVENTÁRIO',
                nfe: 'PENDENTE',
                conferenceNumber: 'INV-' + new Date().getFullYear(),
                internalLot: quickAddData.internalLot,
                supplierLot: 'AUDIT-TEMP',
                runNumber: '0',
                materialType: quickAddData.materialType as any,
                bitola: quickAddData.bitola as any,
                labelWeight: parseFloat(quickAddData.weight),
                initialQuantity: parseFloat(quickAddData.weight),
                remainingQuantity: parseFloat(quickAddData.weight),
                status: 'Disponível',
                lastAuditDate: new Date().toISOString(),
                auditObservation: quickAddData.observation || 'Lote cadastrado rapidamente via Mobile',
                history: [{
                    type: 'Entrada Rápida (Inventário)',
                    date: new Date().toISOString(),
                    details: { 'Nota': 'Cadastrado no pátio durante inventário' }
                }]
            };

            const saved = await addStockItem(newItem);
            if (saved) {
                setSessionCheckedIds(prev => new Set(prev).add(saved.id));
            } else {
                setSessionCheckedIds(prev => new Set(prev).add(newItem.id));
            }
            setAuditStep('list');
            setQuickAddData({ internalLot: '', materialType: '', bitola: '', weight: '', observation: '' });
            alert('Lote cadastrado com sucesso! Ele já foi incluído nesta conferência.');
        } catch (error) {
            alert('Erro ao cadastrar lote.');
        } finally {
            setIsSaving(false);
        }
    };

    const startAudit = (m: string, b: string) => {
        setAuditFilters({ material: m, bitola: b });
        setAuditStep('list');
    };

    const handleFinishAudit = async () => {
        if (!confirm(`Deseja finalizar o inventário de ${auditFilters.material} - ${auditFilters.bitola}?`)) return;

        setIsSaving(true);
        try {
            // Include ONLY lots checked in THIS session
            const auditedLots = auditPool
                .filter(item => sessionCheckedIds.has(item.id))
                .map(item => ({
                    lotId: item.id,
                    internalLot: item.internalLot,
                    systemWeight: item.supplier === 'CADASTRADO NO INVENTÁRIO' ? 0 : item.remainingQuantity,
                    physicalWeight: item.remainingQuantity,
                    observation: item.auditObservation
                }));

            // If there's an existing open or re-audit session for this, we update it instead of creating new?
            // For simplicity, let's just mark the old one as completed if we found it.
            const existingSession = inventorySessions.find(s => s.materialType === auditFilters.material && s.bitola === auditFilters.bitola && (s.status === 'open' || s.status === 're-audit'));

            const newSession: InventorySession = {
                id: existingSession?.id || `INV-${Date.now()}`,
                materialType: auditFilters.material as any,
                bitola: auditFilters.bitola as any,
                startDate: existingSession?.startDate || new Date().toISOString(),
                endDate: new Date().toISOString(),
                status: 'completed',
                operator: currentUser?.username || 'Sistema',
                itemsCount: auditPool.length,
                checkedCount: auditedLots.length, // More accurate than sessionCheckedIds.size
                auditedLots
            };

            if (existingSession) {
                await updateInventorySession(existingSession.id, newSession);
            } else {
                await addInventorySession(newSession);
            }
            alert(`Você finalizou inventário de "${auditFilters.material} ${auditFilters.bitola}"`);
            setSessionCheckedIds(new Set()); // Clear local state
            setAuditStep('select');
        } catch (error) {
            alert('Erro ao finalizar inventário.');
        } finally {
            setIsSaving(false);
        }
    };

    if (mode === 'audit') {
        return (
            <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
                <header className="w-full flex items-center justify-between mb-8 max-w-md">
                    <button
                        onClick={() => {
                            if (auditStep === 'confirm') setAuditStep('list');
                            else if (auditStep === 'list') setAuditStep('select');
                            else setMode('report');
                        }}
                        className="p-2 bg-slate-800 rounded-full"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-sm font-black tracking-widest uppercase">
                        {auditStep === 'select' ? 'Selecione Material' :
                            auditStep === 'quick-add' ? 'Cadastrar Novo Lote' :
                                `${auditFilters.material} - ${auditFilters.bitola}`}
                    </h1>
                    <div className="w-10"></div>
                </header>

                <div className="w-full max-w-md space-y-6">

                    {/* STEP 1: SELECT MATERIAL & BITOLA */}
                    {auditStep === 'select' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-black mb-1 text-white">ORDENS DE INVENTÁRIO</h2>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Selecione uma conferência liberada</p>
                            </div>

                            <div className="space-y-3 pb-20">
                                {inventorySessions.filter(s => s.status === 'open' || s.status === 're-audit').length === 0 ? (
                                    <div className="text-center py-20 opacity-40 bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-700">
                                        <ClockIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                                        <p className="font-black text-slate-500 uppercase tracking-widest">Nenhuma Ordem Aberta</p>
                                        <p className="text-[10px] mt-2">Aguardando comando do gestor...</p>
                                    </div>
                                ) : (
                                    inventorySessions
                                        .filter(s => s.status === 'open' || s.status === 're-audit')
                                        .sort((a, b) => b.startDate.localeCompare(a.startDate))
                                        .map(session => (
                                            <button
                                                key={session.id}
                                                onClick={() => {
                                                    setActiveSession(session);
                                                    setAuditFilters({ material: session.materialType, bitola: session.bitola });
                                                    setAuditStep('list');
                                                }}
                                                className={`w-full p-6 p-6 rounded-[2.5rem] border-2 text-left transition-all active:scale-[0.98] relative overflow-hidden ${session.status === 're-audit' ? 'bg-emerald-950/20 border-emerald-500/50 shadow-emerald-900/10 shadow-xl' : 'bg-slate-800 border-slate-700 shadow-xl shadow-black/30'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${session.status === 're-audit' ? 'text-emerald-400' : 'text-blue-500'}`}>
                                                            {session.status === 're-audit' ? '💡 RE-CONFERÊNCIA' : session.materialType}
                                                        </div>
                                                        <div className="text-3xl font-black text-white tracking-tighter">{session.bitola}</div>
                                                    </div>
                                                    <div className="bg-white/5 px-3 py-1.5 rounded-2xl text-[10px] font-black text-slate-400 uppercase border border-white/10">
                                                        {session.itemsCount} Lotes
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <span>LIBERADO PARA CONTAGEM</span>
                                                </div>
                                            </button>
                                        ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: LIST & SEARCH LOTS */}
                    {auditStep === 'list' && (
                        <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Progresso do Inventário</span>
                                    <h2 className="text-3xl font-black">{stats.checked} <span className="text-slate-600">/ {stats.total}</span></h2>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lotes no Pátio</span>
                                </div>
                            </div>
                            <form onSubmit={handleAuditSearchSubmit} className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <input
                                    ref={auditInputRef}
                                    type="text"
                                    value={auditSearch}
                                    onChange={e => setAuditSearch(e.target.value)}
                                    placeholder="Buscar Lote..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 font-bold focus:border-blue-500 outline-none transition-all uppercase"
                                />
                            </form>

                            {isAuditLocked && (
                                <div className="bg-rose-500/20 border border-rose-500/50 p-4 rounded-2xl flex items-center gap-4 text-rose-200 animate-in fade-in duration-500">
                                    <LockClosedIcon className="w-8 h-8 shrink-0" />
                                    <div className="text-sm">
                                        <div className="font-black uppercase tracking-wider">Inventário Finalizado</div>
                                        <p className="opacity-80">Este material já foi conferido e está bloqueado no celular.</p>
                                    </div>
                                </div>
                            )}

                            {isReAuditActive && (
                                <div className="bg-emerald-500/20 border border-emerald-500/50 p-4 rounded-2xl flex items-center gap-4 text-emerald-200 animate-in fade-in duration-500">
                                    <LockOpenIcon className="w-8 h-8 shrink-0" />
                                    <div className="text-sm">
                                        <div className="font-black uppercase tracking-wider">Re-Conferência Ativa</div>
                                        <p className="opacity-80">Lotes liberados para verificação novamente.</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex-grow overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                {auditListFiltered.map(item => {
                                    const isChecked = sessionCheckedIds.has(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectLot(item)}
                                            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.98] ${isChecked ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-slate-800 border-slate-700'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${isChecked ? 'bg-emerald-500 text-white' : isReAuditActive ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
                                                    {isChecked ? <CheckCircleIcon className="w-6 h-6" /> : isReAuditActive ? '!' : item.internalLot.slice(-2)}
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-black text-lg">LOT {item.internalLot}</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-[10px] font-bold text-slate-500 uppercase">{item.location || 'Sem Posição'}</div>
                                                        {isReAuditActive && !isChecked && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase">Re-conferir</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                <div className="flex flex-col items-end">
                                                    <div className="font-black text-sm">{item.remainingQuantity.toFixed(0)}kg</div>
                                                    {item.auditObservation && <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-400" />}
                                                </div>
                                                <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                                            </div>
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => {
                                        setQuickAddData(prev => ({
                                            ...prev,
                                            materialType: auditFilters.material,
                                            bitola: auditFilters.bitola
                                        }));
                                        setAuditStep('quick-add');
                                    }}
                                    className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-700 text-slate-500 font-bold flex flex-col items-center gap-2 hover:border-blue-500 hover:text-blue-500 transition-all"
                                >
                                    <PlusIcon className="w-8 h-8" />
                                    <span>Lote não encontrado? Cadastrar rápido</span>
                                </button>
                                {auditListFiltered.length === 0 && (
                                    <div className="text-center py-10 opacity-30">Nenhum lote encontrado.</div>
                                )}
                            </div>

                            {!isAuditLocked && stats.checked > 0 && (
                                <button
                                    onClick={handleFinishAudit}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-900/40 animate-in slide-in-from-bottom-4"
                                >
                                    FINALIZAR CONFERÊNCIA
                                </button>
                            )}
                        </div>
                    )}

                    {/* STEP: QUICK ADD */}
                    {auditStep === 'quick-add' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Lote Interno / Identificação</label>
                                    <input
                                        type="text"
                                        value={quickAddData.internalLot}
                                        onChange={e => setQuickAddData({ ...quickAddData, internalLot: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold focus:border-blue-500 outline-none uppercase"
                                        placeholder="EX: 9999"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Material</label>
                                        <select
                                            value={quickAddData.materialType}
                                            onChange={e => setQuickAddData({ ...quickAddData, materialType: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold focus:border-blue-500 outline-none"
                                        >
                                            <option value="">Selecione</option>
                                            {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Bitola</label>
                                        <select
                                            value={quickAddData.bitola}
                                            onChange={e => setQuickAddData({ ...quickAddData, bitola: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold focus:border-blue-500 outline-none"
                                        >
                                            <option value="">Selecione</option>
                                            {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Peso Encontrado (kg)</label>
                                    <input
                                        type="number"
                                        value={quickAddData.weight}
                                        onChange={e => setQuickAddData({ ...quickAddData, weight: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold focus:border-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Observação (O que está errado?)</label>
                                    <textarea
                                        value={quickAddData.observation}
                                        onChange={e => setQuickAddData({ ...quickAddData, observation: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold focus:border-blue-500 outline-none h-24"
                                        placeholder="Ex: Lote sem etiqueta, peso aproximado..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setAuditStep('list')}
                                        className="flex-1 bg-slate-700 p-4 rounded-2xl font-black"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        onClick={handleQuickAdd}
                                        disabled={isSaving}
                                        className="flex-[2] bg-blue-600 p-4 rounded-2xl font-black shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                                    >
                                        {isSaving ? 'SALVANDO...' : 'CADASTRAR LOTE'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CONFIRM WEIGHT */}
                    {auditStep === 'confirm' && selectedLot && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Lot Card */}
                            <div className="bg-white text-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <ScaleIcon className="w-32 h-32" />
                                </div>

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{selectedLot.materialType}</span>
                                        <h2 className="text-4xl font-black mt-1">LOT {selectedLot.internalLot}</h2>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 text-xs font-bold block uppercase">Bitola</span>
                                        <span className="text-2xl font-black text-blue-600">{selectedLot.bitola}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Localização</span>
                                        <span className="text-lg font-black">{selectedLot.location || 'Sem Local'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Peso Sistema</span>
                                        <span className="text-lg font-black text-rose-500">{selectedLot.remainingQuantity.toFixed(0)} kg</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-black text-slate-500 uppercase tracking-widest text-center">Novo Peso Real (kg)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={physicalWeight}
                                        onChange={e => setPhysicalWeight(e.target.value)}
                                        className="w-full bg-slate-100 rounded-3xl py-6 text-center text-5xl font-black text-slate-900 focus:ring-4 ring-blue-500/20 outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                    />

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ChatBubbleLeftRightIcon className="w-4 h-4" /> Observação do Pátio
                                        </label>
                                        <textarea
                                            value={auditObservation}
                                            onChange={e => setAuditObservation(e.target.value)}
                                            className="w-full bg-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:ring-4 ring-blue-500/20 outline-none border-2 border-transparent focus:border-blue-500 transition-all min-h-[100px]"
                                            placeholder="Ex: Lote com avaria, peso muito abaixo..."
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setAuditStep('list')}
                                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-600 py-5 rounded-3xl font-black transition-all"
                                        >
                                            VOLTAR
                                        </button>
                                        <button
                                            onClick={confirmAudit}
                                            disabled={isSaving || !physicalWeight}
                                            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                                        >
                                            {isSaving ? 'SALVANDO...' : <><SaveIcon className="h-6 w-6" /> CONFIRMAR</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        );
    }

    // Default Report View
    const totalSystemWeight = filteredReportStock.reduce((acc, item) => acc + item.remainingQuantity, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 no-print gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage('menu')} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Inventário de Estoque</h1>
                        <p className="text-slate-500 text-sm">Visualize, filtre e realize auditorias físicas.</p>
                    </div>
                </div>

                {/* Summary Stats for Report Mode */}
                {(reportFilters.materialFilter || reportFilters.bitolaFilter || reportFilters.searchTerm) && (
                    <div className="flex-1 flex gap-3 md:gap-6 justify-center animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 min-w-[160px]">
                            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <FilterIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Lotes</span>
                                <span className="text-2xl font-black text-slate-800 leading-none">{reportStats.total}</span>
                            </div>
                        </div>
                        <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 min-w-[160px]">
                            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <CheckCircleIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none block mb-1">Conferidos</span>
                                <span className="text-2xl font-black text-emerald-600 leading-none">{reportStats.audited}</span>
                            </div>
                        </div>
                        {reportStats.total > 0 && reportStats.total !== reportStats.audited && (
                            <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 min-w-[160px]">
                                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                                    <XCircleIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none block mb-1">Pendentes</span>
                                    <span className="text-2xl font-black text-orange-500 leading-none">{reportStats.total - reportStats.audited}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => { setMode('audit'); setAuditStep('select'); }}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <ScaleIcon className="h-5 w-5" />
                        <span>FAZER INVENTÁRIO (MOBILE)</span>
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="hidden md:flex bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-2xl border border-slate-300 shadow-sm items-center gap-2 transition-all"
                    >
                        <PrinterIcon className="h-5 w-5" />
                        <span>IMPRIMIR</span>
                    </button>
                </div>
            </div>

            {/* Inventory Sessions & Reports - New Section for Desktop */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print mt-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-[#0F3F5C] font-bold">
                        <ClockIcon className="h-5 w-5" />
                        <h2>Relatórios e Ciclos de Inventário</h2>
                    </div>
                    {currentUser?.role === 'gestor' && (
                        <button
                            onClick={async () => {
                                if (!confirm('Deseja iniciar um novo ciclo de inventário? Isso criará ordens de conferência para todos os produtos em estoque.')) return;

                                const pairs = new Set<string>();
                                stock.forEach(item => {
                                    if (item.status !== 'Transferido' && item.status !== 'Consumido') {
                                        pairs.add(`${item.materialType}|${item.bitola}`);
                                    }
                                });

                                let createdCount = 0;
                                for (const pair of pairs) {
                                    const [m, b] = pair.split('|');
                                    const exists = inventorySessions.find(s => s.materialType === m && s.bitola === b && (s.status === 'open' || s.status === 're-audit'));
                                    if (!exists) {
                                        const newSession: InventorySession = {
                                            id: `INV-${Date.now()}-${createdCount}`,
                                            materialType: m as any,
                                            bitola: b as any,
                                            startDate: new Date().toISOString(),
                                            status: 'open',
                                            operator: 'Pendente',
                                            itemsCount: stock.filter(i => i.materialType === m && i.bitola === b && i.status !== 'Transferido' && i.status !== 'Consumido').length,
                                            checkedCount: 0,
                                            auditedLots: []
                                        };
                                        await addInventorySession(newSession);
                                        createdCount++;
                                    }
                                }
                                alert(`${createdCount} novas ordens de inventário geradas.`);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-all"
                        >
                            INICIAR CICLO DE INVENTÁRIO
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inventorySessions.length === 0 ? (
                        <div className="col-span-full py-10 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl italic">
                            Nenhum inventário finalizado recentemente.
                        </div>
                    ) : (
                        inventorySessions.map(session => (
                            <div key={session.id} className={`${session.status === 're-audit' ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100 shadow-xl' : 'bg-slate-50 border-slate-200'} border p-5 rounded-2xl hover:border-blue-300 transition-all group relative overflow-hidden`}>
                                {session.status === 're-audit' && (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-4 py-1 uppercase tracking-widest rotate-0 origin-top-right">
                                        RE-CONFERÊNCIA
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className={`text-[10px] font-black ${session.status === 're-audit' ? 'text-emerald-500' : 'text-slate-400'} uppercase tracking-widest`}>{session.materialType}</span>
                                        <h3 className="text-xl font-black text-slate-800">{session.bitola}</h3>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm text-center min-w-[60px]">
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Conferidos</div>
                                        <div className="text-sm font-black text-blue-600">{session.checkedCount} / {session.itemsCount}</div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start mb-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                        <span>
                                            {session.status === 'open'
                                                ? `Iniciado em: ${new Date(session.startDate).toLocaleDateString('pt-BR')}`
                                                : session.status === 're-audit'
                                                    ? 'Liberado para re-auditoria'
                                                    : `Finalizado em: ${new Date(session.endDate || session.startDate).toLocaleDateString('pt-BR')} às ${new Date(session.endDate || session.startDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                            }
                                        </span>
                                    </div>
                                    {currentUser?.role === 'gestor' && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Tem certeza que deseja apagar este relatório de inventário?')) {
                                                    deleteInventorySession(session.id);
                                                }
                                            }}
                                            className="text-rose-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-50 transition-colors"
                                            title="Excluir Relatório"
                                        >
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setSelectedSessionForReport(session)}
                                        className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 hover:bg-slate-100"
                                    >
                                        <PrinterIcon className="w-4 h-4" /> IMPRIMIR
                                    </button>
                                    {session.status === 'completed' ? (
                                        <button
                                            onClick={() => {
                                                if (confirm(`Deseja liberar o inventário de ${session.materialType} ${session.bitola} para RE-CONFERÊNCIA?`)) {
                                                    updateInventorySession(session.id, { status: 're-audit' });
                                                }
                                            }}
                                            className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 hover:bg-rose-100"
                                        >
                                            <LockOpenIcon className="w-4 h-4" /> REABRIR
                                        </button>
                                    ) : (
                                        <div className="flex-1 bg-emerald-50 text-emerald-600 py-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 border border-emerald-200">
                                            Aguardando Celular...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Filters Section - Hidden on Print */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-[#0F3F5C] font-bold">
                    <FilterIcon className="h-5 w-5" />
                    <h2>Filtros do Relatório</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por lote, fornecedor..."
                            value={reportFilters.searchTerm}
                            onChange={e => setReportFilters({ ...reportFilters, searchTerm: e.target.value })}
                            className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none"
                        />
                    </div>
                    <select
                        value={reportFilters.statusFilter}
                        onChange={e => setReportFilters({ ...reportFilters, statusFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
                    >
                        <option value="">Todos os Status</option>
                        <option value="Disponível">Disponível</option>
                        <option value="Disponível - Suporte Treliça">Disponível - Suporte Treliça</option>
                        <option value="Em Produção">Em Produção</option>
                        <option value="Transferido">Transferido</option>
                    </select>
                    <select
                        value={reportFilters.materialFilter}
                        onChange={e => setReportFilters({ ...reportFilters, materialFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
                    >
                        <option value="">Todos Materiais</option>
                        {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                        value={reportFilters.bitolaFilter}
                        onChange={e => setReportFilters({ ...reportFilters, bitolaFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
                    >
                        <option value="">Todas Bitolas</option>
                        {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print-section">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resumo Total</p>
                        <h2 className="text-xl font-black text-slate-800">{totalSystemWeight.toLocaleString('pt-BR')} kg em estoque</h2>
                    </div>
                    <span className="bg-blue-100 text-blue-700 font-bold px-4 py-1 rounded-full text-xs">
                        {filteredReportStock.length} lotes encontrados
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-[#0F3F5C] text-white uppercase text-xs font-black">
                            <tr>
                                <th className="px-6 py-4">Lote Interno</th>
                                <th className="px-6 py-4">Fornecedor / NFe</th>
                                <th className="px-6 py-4">Material / Bitola</th>
                                <th className="px-6 py-4">Local</th>
                                <th className="px-6 py-4 text-right">Peso (kg)</th>
                                <th className="px-6 py-4">Observações</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center w-32 bg-[#fff7ed] text-slate-800 border-l border-orange-100 no-print">Conf. Física</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReportStock.map((item, index) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-800 text-base">{item.internalLot}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{item.supplierLot}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700 font-semibold truncate max-w-[200px]">{item.supplier}</div>
                                        <div className="text-[10px] text-slate-400">NF: {item.nfe}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-800 font-black">{item.materialType}</div>
                                        <div className="text-blue-600 font-black text-lg">{item.bitola}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap ${item.location ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {item.location || 'NÃO MAPEADO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-lg font-black text-[#0F3F5C]">{item.remainingQuantity.toLocaleString('pt-BR')}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.auditObservation ? (
                                            <div className="flex items-start gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100 max-w-[250px]">
                                                <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                                                <span className="text-xs text-blue-800 font-medium">{item.auditObservation}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic text-xs">Sem observações</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md border border-slate-200">
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 bg-[#fff7ed]/30 no-print text-center">
                                        {(() => {
                                            const isCheckedInSession = sessionCheckedIds.has(item.id);
                                            const needsReAudit = inventorySessions.some(s => s.materialType === item.materialType && s.bitola === item.bitola && s.status === 're-audit');

                                            if (isCheckedInSession || item.lastAuditDate) {
                                                return (
                                                    <div className="flex flex-col items-center">
                                                        {needsReAudit && !isCheckedInSession ? (
                                                            <>
                                                                <XCircleIcon className="h-6 w-6 text-amber-500 mb-0.5 animate-pulse" />
                                                                <span className="text-[10px] font-black text-amber-700 uppercase">Re-conferir</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircleIcon className="h-6 w-6 text-emerald-600 mb-0.5" />
                                                                <span className="text-[10px] font-black text-emerald-700 uppercase">OK</span>
                                                            </>
                                                        )}
                                                        <span className="text-[9px] text-slate-500 font-bold leading-none">
                                                            {new Date(item.lastAuditDate || new Date()).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return <span className="text-slate-300 font-bold">-</span>;
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedSessionForReport && (
                <InventorySessionReport
                    session={selectedSessionForReport}
                    onClose={() => setSelectedSessionForReport(null)}
                />
            )}
        </div>
    );
};

export default StockInventory;
