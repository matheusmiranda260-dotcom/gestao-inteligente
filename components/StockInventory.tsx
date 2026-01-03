import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StockItem, Page, InventorySession, User } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { PrinterIcon, ArrowLeftIcon, SearchIcon, FilterIcon, CheckCircleIcon, XCircleIcon, ScaleIcon, SaveIcon, ChevronRightIcon, PlusIcon, ChatBubbleLeftRightIcon, ClockIcon, LockClosedIcon, LockOpenIcon, ExclamationTriangleIcon, ArrowPathIcon } from './icons';
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
    const [mode, setMode] = useState<'report' | 'audit'>(window.innerWidth < 768 ? 'audit' : 'report');
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
    const [approvingSession, setApprovingSession] = useState<InventorySession | null>(null);
    const [auditSearch, setAuditSearch] = useState('');
    const [tempNewLots, setTempNewLots] = useState<StockItem[]>([]);
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
    const [sessionAuditData, setSessionAuditData] = useState<Map<string, { systemWeight: number, physicalWeight: number, observation: string | null }>>(new Map());

    const [auditHistory, setAuditHistory] = useState<{ lot: string, status: 'ok' | 'diff', diff: number }[]>([]);
    const auditInputRef = useRef<HTMLInputElement>(null);

    const normalizeBitola = (b: string) => {
        const n = parseFloat(String(b).replace(',', '.'));
        return isNaN(n) ? String(b) : n.toFixed(2);
    };

    const isInStock = (item: StockItem) => {
        const s = (item.status || '').toLowerCase();
        return s !== 'transferido' && !s.includes('consumido');
    };

    const isInvalidCombination = (material: string, bitola: string) => {
        const b = normalizeBitola(bitola);
        const ca60Only = ['3.20', '3.40', '3.80', '4.20', '4.60', '5.00', '5.40', '5.60', '5.80', '6.00'];
        const fioOnly = ['5.50', '6.50', '7.00'];
        if (material === 'Fio Máquina' && ca60Only.includes(b)) return true;
        if (material === 'CA-60' && fioOnly.includes(b)) return true;
        return false;
    };

    const allBitolaOptions = useMemo(() => {
        const opts = new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions]);
        return Array.from(opts).map(normalizeBitola).sort();
    }, []);

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
        const targetB = normalizeBitola(auditFilters.bitola);
        return stock
            .filter(item => item.materialType === auditFilters.material && normalizeBitola(item.bitola) === targetB)
            .filter(isInStock)
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

    const groupedSessions = useMemo(() => {
        const groups: Record<string, InventorySession[]> = {};
        const uniqueLatest = new Map<string, InventorySession>();

        // Sort by date so later ones overwrite earlier ones in our map
        const sorted = [...inventorySessions].sort((a, b) => a.startDate.localeCompare(b.startDate));

        sorted.forEach(session => {
            const key = `${session.materialType}|${normalizeBitola(session.bitola)}`;
            uniqueLatest.set(key, session);
        });

        Array.from(uniqueLatest.values()).forEach(session => {
            if (!groups[session.materialType]) groups[session.materialType] = [];
            groups[session.materialType].push(session);
        });

        // Sort sessions within each material group by bitola
        Object.keys(groups).forEach(m => {
            groups[m].sort((a, b) => parseFloat(a.bitola.replace(',', '.')) - parseFloat(b.bitola.replace(',', '.')));
        });

        return groups;
    }, [inventorySessions]);

    const activeSessions = useMemo(() => {
        const openSessions = inventorySessions.filter(s => s.status === 'open' || s.status === 're-audit');
        const groups = new Map<string, InventorySession>();

        openSessions.forEach(s => {
            const key = `${s.materialType}|${normalizeBitola(s.bitola)}`;
            const existing = groups.get(key);
            // Keep the most important session (re-audit takes precedence, then most recent)
            if (!existing || (s.status === 're-audit' && existing.status !== 're-audit') || s.startDate > existing.startDate) {
                groups.set(key, s);
            }
        });

        return Array.from(groups.values()).sort((a, b) => b.startDate.localeCompare(a.startDate));
    }, [inventorySessions]);

    const globalProgress = useMemo(() => {
        // Only count latest version of each session for progress
        const uniqueSessions = new Map<string, InventorySession>();
        inventorySessions.forEach(s => {
            const key = `${s.materialType}|${normalizeBitola(s.bitola)}`;
            const existing = uniqueSessions.get(key);
            if (!existing || s.startDate > existing.startDate) {
                uniqueSessions.set(key, s);
            }
        });
        const currentSessions = Array.from(uniqueSessions.values());
        const totalItems = currentSessions.reduce((acc, s) => acc + s.itemsCount, 0);
        const totalChecked = currentSessions.reduce((acc, s) => acc + s.checkedCount, 0);
        return totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
    }, [inventorySessions]);

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
            /* 
               Direct update removed by request. 
               Stock is only updated when a manager approves the session on desktop.
            */
            // await updateStockItem(selectedLot.id, { ... });

            setSessionAuditData(prev => {
                const next = new Map(prev);
                next.set(selectedLot.id, {
                    systemWeight: selectedLot.remainingQuantity,
                    physicalWeight: newWeight,
                    observation: auditObservation || null
                });
                return next;
            });
            setSessionCheckedIds(prev => {
                const isNew = !prev.has(selectedLot.id);
                if (isNew) {
                    const currentSession = inventorySessions.find(s => s.id === activeSession?.id);
                    if (currentSession) {
                        updateInventorySession(currentSession.id, {
                            checkedCount: currentSession.checkedCount + 1
                        });
                    }
                }
                return new Set(prev).add(selectedLot.id);
            });

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

            // NEW: instead of adding to stock in DB, we add to a local temp list
            // and include in the session audit results.
            const saved = newItem; // Use newItem as the representative object
            setTempNewLots(prev => [...prev, newItem]);

            setSessionAuditData(prev => {
                const next = new Map(prev);
                next.set(saved.id, {
                    systemWeight: 0,
                    physicalWeight: parseFloat(quickAddData.weight),
                    observation: quickAddData.observation || 'Lote cadastrado rapidamente via Mobile'
                });
                return next;
            });
            // Track checked ID
            setSessionCheckedIds(prev => new Set(prev).add(saved.id));

            // Update session state in DB for live progress
            const currentSession = inventorySessions.find(s => s.id === activeSession?.id);
            if (currentSession) {
                updateInventorySession(currentSession.id, {
                    itemsCount: (currentSession.itemsCount || 0) + 1,
                    checkedCount: (currentSession.checkedCount || 0) + 1
                });
            }

            setAuditStep('list');
            setQuickAddData({ internalLot: '', materialType: '', bitola: '', weight: '', observation: '' });
            alert('Lote registrado para conferência! Aguardando aprovação final do gestor.');
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
            // Include ONLY lots checked in THIS session using sessionAuditData for accuracy
            const auditedLots = Array.from(sessionAuditData.entries()).map(([lotId, data]) => {
                const lot = stock.find(s => s.id === lotId) || tempNewLots.find(s => s.id === lotId);
                return {
                    lotId,
                    internalLot: lot?.internalLot || '?',
                    systemWeight: data.systemWeight,
                    physicalWeight: data.physicalWeight,
                    observation: data.observation,
                    tempLotData: lotId.startsWith('TEMP-') ? lot : null
                };
            });

            // If there's an existing open or re-audit session for this, we update it instead of creating new?
            // For simplicity, let's just mark the old one as completed if we found it.
            const targetB = normalizeBitola(auditFilters.bitola);
            const existingSession = inventorySessions.find(s => s.materialType === auditFilters.material && normalizeBitola(s.bitola) === targetB && (s.status === 'open' || s.status === 're-audit'));

            // Accurate items count: checked ones + remaining items in pool
            const uncheckedCount = auditPool.filter(item => !sessionAuditData.has(item.id)).length;
            const finalItemsCount = auditedLots.length + uncheckedCount;

            const newSession: InventorySession = {
                id: existingSession?.id || `INV-${Date.now()}`,
                materialType: auditFilters.material as any,
                bitola: auditFilters.bitola as any,
                startDate: existingSession?.startDate || new Date().toISOString(),
                endDate: new Date().toISOString(),
                status: 'completed',
                operator: currentUser?.username || 'Sistema',
                itemsCount: finalItemsCount,
                checkedCount: auditedLots.length,
                auditedLots
            };

            if (existingSession) {
                await updateInventorySession(existingSession.id, newSession);
            } else {
                await addInventorySession(newSession);
            }
            alert(`Você finalizou inventário de "${auditFilters.material} ${auditFilters.bitola}"`);
            setSessionCheckedIds(new Set()); // Clear local state
            setSessionAuditData(new Map()); // Clear local state
            setAuditStep('select');
        } catch (error) {
            alert('Erro ao finalizar inventário.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyChangesToStock = async (session: InventorySession) => {
        if (!session || isSaving) return;

        const password = prompt("Para aplicar estas alterações ao estoque real, digite a SENHA DE GESTOR:");
        if (password !== "070223") {
            alert("Senha incorreta ou operação cancelada. As alterações NÃO foram aplicadas.");
            return;
        }

        setIsSaving(true);
        try {
            for (const lotInfo of session.auditedLots) {
                const isNew = lotInfo.tempLotData !== null && lotInfo.tempLotData !== undefined;

                if (isNew && lotInfo.tempLotData) {
                    // Create new lot in DB
                    const newId = `LOT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    await addStockItem({
                        ...lotInfo.tempLotData,
                        id: newId,
                        remainingQuantity: lotInfo.physicalWeight,
                        initialQuantity: lotInfo.physicalWeight,
                        labelWeight: lotInfo.physicalWeight,
                        lastAuditDate: new Date().toISOString(),
                        history: [{
                            type: 'Entrada via Inventário (Aprovado)',
                            date: new Date().toISOString(),
                            details: { 'Nota': 'Lote extra encontrado e aprovado no inventário' }
                        }]
                    });
                } else if (lotInfo.lotId && !isNew) {
                    const diff = lotInfo.physicalWeight - lotInfo.systemWeight;
                    const currentLot = stock.find(s => s.id === lotInfo.lotId);

                    const historyEntry = {
                        type: 'Inventário (Aprovado)',
                        date: new Date().toISOString(),
                        details: {
                            'Peso Anterior': `${lotInfo.systemWeight.toFixed(2)} kg`,
                            'Peso Final': `${lotInfo.physicalWeight.toFixed(2)} kg`,
                            'Diferença': `${diff.toFixed(2)} kg`,
                            'Aprovado por': currentUser?.username || 'Gestor'
                        }
                    };

                    await updateStockItem(lotInfo.lotId, {
                        remainingQuantity: lotInfo.physicalWeight,
                        lastAuditDate: new Date().toISOString(),
                        auditObservation: lotInfo.observation || null,
                        history: [...(currentLot?.history || []), historyEntry]
                    });
                }
            }

            // Mark session as applied
            await updateInventorySession(session.id, { appliedToStock: true });

            alert('Estoque atualizado com sucesso conforme o relatório aprovado!');
            setApprovingSession(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao aplicar algumas alterações no estoque. Verifique os logs.');
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
                            else if (auditStep === 'select' && auditFilters.material) setAuditFilters({ ...auditFilters, material: '' });
                            else setMode('report');
                        }}
                        className="p-2 bg-slate-800 rounded-full"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-sm font-black tracking-widest uppercase">
                        {auditStep === 'select' ? (auditFilters.material || 'Selecione Material') :
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
                                {auditFilters.material === '' ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {[...MaterialOptions].map(m => {
                                            const count = activeSessions.filter(s => s.materialType === m).length;
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => setAuditFilters({ ...auditFilters, material: m as any })}
                                                    className={`w-full p-8 rounded-[2.5rem] bg-slate-800 border-2 border-slate-700 shadow-xl shadow-black/30 text-left transition-all active:scale-[0.98] group relative overflow-hidden ${count > 0 ? 'border-blue-500/30' : 'opacity-80'}`}
                                                >
                                                    <div className="relative z-10">
                                                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 group-active:text-blue-400">Selecionar Categoria</div>
                                                        <div className="text-3xl font-black text-white tracking-tighter">{m}</div>
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${count > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                                            <span>{count} Ordens Abertas</span>
                                                        </div>
                                                    </div>
                                                    <div className="absolute right-[-10%] bottom-[-20%] opacity-10 group-hover:scale-110 transition-transform duration-500">
                                                        <div className="text-8xl font-black text-white italic select-none">{m.charAt(0)}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    activeSessions.filter(s => s.materialType === auditFilters.material).length === 0 ? (
                                        <div className="text-center py-20 opacity-40 bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-700">
                                            <ClockIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                                            <p className="font-black text-slate-500 uppercase tracking-widest">Nenhuma Ordem Aberta</p>
                                            <p className="text-[10px] mt-2">Para {auditFilters.material}</p>
                                        </div>
                                    ) : (
                                        activeSessions
                                            .filter(s => s.materialType === auditFilters.material)
                                            .map(session => (
                                                <button
                                                    key={session.id}
                                                    onClick={() => {
                                                        setActiveSession(session);
                                                        setAuditFilters({ material: session.materialType, bitola: session.bitola });
                                                        setAuditStep('list');
                                                    }}
                                                    className={`w-full p-6 rounded-[2.5rem] border-2 text-left transition-all active:scale-[0.98] relative overflow-hidden ${session.status === 're-audit' ? 'bg-emerald-950/20 border-emerald-500/50 shadow-emerald-900/10 shadow-xl' : 'bg-slate-800 border-slate-700 shadow-xl shadow-black/30'}`}
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
                                    )
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
                                    {auditFilters.material && auditFilters.bitola ? (
                                        <>
                                            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                                                <label className="block text-[8px] font-black text-slate-600 uppercase mb-1">Material</label>
                                                <div className="font-black text-blue-500">{auditFilters.material}</div>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                                                <label className="block text-[8px] font-black text-slate-600 uppercase mb-1">Bitola</label>
                                                <div className="font-black text-blue-500">{auditFilters.bitola} mm</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
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
                                        </>
                                    )}
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
                        {(() => {
                            const divergentCount = inventorySessions.filter(s => s.auditedLots.some(lot => Math.abs(lot.systemWeight - lot.physicalWeight) > 0.1 || lot.observation)).length;
                            return divergentCount > 0 && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black animate-bounce shadow-sm">
                                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                    {divergentCount} {divergentCount === 1 ? 'DIVERGÊNCIA' : 'DIVERGÊNCIAS'}
                                </span>
                            );
                        })()}
                    </div>
                    {currentUser?.role === 'gestor' && (
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    const invalids = stock.filter(item => isInvalidCombination(item.materialType, item.bitola));
                                    if (invalids.length === 0) {
                                        alert('Nenhuma inconsistência de material/bitola encontrada!');
                                        return;
                                    }
                                    if (!confirm(`Foram encontrados ${invalids.length} lotes com material incorreto para a bitola (ex: Fio Máquina 5.80). Deseja corrigir automaticamente?`)) return;

                                    setIsSaving(true);
                                    try {
                                        for (const item of invalids) {
                                            const b = normalizeBitola(item.bitola);
                                            const ca60Only = ['3.20', '3.40', '3.80', '4.20', '4.60', '5.00', '5.40', '5.60', '5.80', '6.00'];
                                            let newMaterial = item.materialType;
                                            if (ca60Only.includes(b)) newMaterial = 'CA-60';
                                            else newMaterial = 'Fio Máquina';

                                            await updateStockItem(item.id, { materialType: newMaterial as any });
                                        }
                                        alert('Dados saneados com sucesso!');
                                    } catch (e) {
                                        alert('Erro ao sanear dados.');
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-black px-4 py-2 rounded-lg transition-all"
                            >
                                SANEAR DADOS (BITOLAS)
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('ATENÇÃO: Isso removerá TODAS as marcações de conferência (OK verde) e deletará TODOS os relatórios de inventário existentes. Deseja continuar?')) return;

                                    setIsSaving(true);
                                    try {
                                        // 1. Reset all stock audit data
                                        for (const item of stock) {
                                            if (item.supplier === 'CADASTRADO NO INVENTÁRIO') {
                                                await updateStockItem(item.id, { status: 'Consumido' as any });
                                            } else if (item.lastAuditDate || item.auditObservation) {
                                                await updateStockItem(item.id, {
                                                    lastAuditDate: null,
                                                    auditObservation: null
                                                });
                                            }
                                        }

                                        // 2. Clear ALL inventory sessions
                                        for (const s of inventorySessions) {
                                            await deleteInventorySession(s.id);
                                        }

                                        alert('Sistema limpo com sucesso! Marcações removidas e histórico de inventário apagado.');
                                    } catch (e) {
                                        alert('Erro durante a limpeza.');
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                className="bg-rose-100 hover:bg-rose-200 text-rose-600 text-[10px] font-black px-4 py-2 rounded-lg transition-all"
                            >
                                LIMPAR MARCAÇÕES ÓRFÃS
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('Deseja iniciar um novo ciclo de inventário? Isso criará ordens de conferência para todos os produtos em estoque.')) return;

                                    const pairs = new Set<string>();
                                    stock.forEach(item => {
                                        if (isInStock(item)) {
                                            pairs.add(`${item.materialType}|${normalizeBitola(item.bitola)}`);
                                        }
                                    });

                                    let createdCount = 0;
                                    for (const pair of pairs) {
                                        const [m, b] = pair.split('|');
                                        const exists = inventorySessions.find(s => s.materialType === m && normalizeBitola(s.bitola) === b && (s.status === 'open' || s.status === 're-audit'));
                                        if (!exists) {
                                            const filteredStock = stock.filter(i => i.materialType === m && normalizeBitola(i.bitola) === b && isInStock(i));
                                            const newSession: InventorySession = {
                                                id: `INV-${Date.now()}-${createdCount}`,
                                                materialType: m as any,
                                                bitola: b as any,
                                                startDate: new Date().toISOString(),
                                                status: 'open',
                                                operator: 'Pendente',
                                                itemsCount: filteredStock.length,
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
                        </div>
                    )}
                </div>

                {inventorySessions.length > 0 && (
                    <div className="mb-8 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progresso Total do Ciclo de Inventário</span>
                            <span className="text-sm font-black text-blue-600">{globalProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                style={{ width: `${globalProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-12">
                    {inventorySessions.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl italic">
                            Nenhum inventário finalizado recentemente.
                        </div>
                    ) : (
                        Object.entries(groupedSessions).map(([material, sessions]) => (
                            <div key={material} className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-3">
                                    {material}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {(sessions as InventorySession[]).map(session => (
                                        <div
                                            key={session.id}
                                            className={`${session.status === 're-audit' ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' : 'bg-white border-slate-200 shadow-sm'} border p-3 rounded-2xl hover:border-blue-400 transition-all group relative flex flex-col justify-between`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="text-lg font-black text-slate-800 tracking-tighter leading-none">{session.bitola}</h4>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{session.itemsCount} {session.itemsCount === 1 ? 'LOTE' : 'LOTES'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {session.auditedLots.some(lot => Math.abs(lot.systemWeight - lot.physicalWeight) > 0.1 || lot.observation) && (
                                                        <div
                                                            className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-md animate-pulse shadow-sm cursor-help"
                                                            title="ESTA CONFERÊNCIA POSSUI DIVERGÊNCIAS (PESO OU OBSERVAÇÕES)"
                                                        >
                                                            <ExclamationTriangleIcon className="w-3 h-3" />
                                                            <span className="text-[7px] font-black">ALERTA</span>
                                                        </div>
                                                    )}
                                                    {currentUser?.role === 'gestor' && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Tem certeza que deseja apagar este relatório de inventário?')) {
                                                                    deleteInventorySession(session.id);
                                                                }
                                                            }}
                                                            className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                        >
                                                            <XCircleIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 mt-auto">
                                                <div className="flex justify-between items-end">
                                                    <div className="text-[10px] font-black text-blue-600">
                                                        {Math.round((session.checkedCount / session.itemsCount) * 100)}%
                                                    </div>
                                                    <div className="text-[8px] font-bold text-slate-500">
                                                        {session.checkedCount}/{session.itemsCount}
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${session.status === 're-audit' ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                                        style={{ width: `${(session.checkedCount / session.itemsCount) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="flex gap-1 pt-2">
                                                    <button
                                                        onClick={() => setSelectedSessionForReport(session)}
                                                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 py-1.5 rounded-lg text-[9px] font-black hover:bg-blue-50 hover:border-blue-200 transition-all"
                                                    >
                                                        IMPRIMIR
                                                    </button>
                                                    {session.auditedLots.some(lot => Math.abs(lot.systemWeight - lot.physicalWeight) > 0.1 || lot.observation) && (
                                                        <button
                                                            onClick={() => setSelectedSessionForReport(session)}
                                                            className="px-2 bg-rose-600 text-white rounded-lg animate-pulse hover:bg-rose-700 transition-all shadow-md flex items-center justify-center"
                                                            title="DIVERGÊNCIA DETECTADA: CLIQUE PARA VER"
                                                        >
                                                            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {session.status === 'completed' && !session.appliedToStock && currentUser?.role === 'gestor' && (
                                                        <button
                                                            onClick={() => setApprovingSession(session)}
                                                            className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-[9px] font-black hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                                                        >
                                                            APLICAR NO ESTOQUE
                                                        </button>
                                                    )}
                                                    {session.appliedToStock && (
                                                        <div className="flex-1 bg-emerald-50 text-emerald-600 border border-emerald-100 py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 cursor-default">
                                                            <CheckCircleIcon className="w-3 h-3" />
                                                            CONCLUÍDO
                                                        </div>
                                                    )}
                                                    {session.status === 'completed' && !session.appliedToStock && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Deseja liberar o inventário de ${session.materialType} ${session.bitola} para RE-CONFERÊNCIA?`)) {
                                                                    updateInventorySession(session.id, { status: 're-audit' });
                                                                }
                                                            }}
                                                            className="px-2 bg-rose-50 border border-rose-200 text-rose-600 py-1.5 rounded-lg text-[9px] font-black hover:bg-rose-100 transition-all"
                                                            title="REABRIR"
                                                        >
                                                            <LockOpenIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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
                            {filteredReportStock.map((item, index) => {
                                // 1. Identify if this item was audited in a RECENT session (even if not applied)
                                const latestSession = inventorySessions
                                    .filter(s => s.materialType === item.materialType && normalizeBitola(s.bitola) === normalizeBitola(item.bitola))
                                    .sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate))[0];

                                const sessionAudit = latestSession?.auditedLots?.find(l => l.lotId === item.id);

                                // 2. Determine Weight Difference and Observation
                                let weightDiff = 0;
                                let observationText = item.auditObservation;
                                let auditDateToDisplay = item.lastAuditDate;

                                if (sessionAudit) {
                                    weightDiff = sessionAudit.physicalWeight - sessionAudit.systemWeight;
                                    observationText = sessionAudit.observation || null;
                                    auditDateToDisplay = latestSession.endDate || latestSession.startDate;
                                } else {
                                    const lastAuditEntry = item.history?.filter(h => h.type.includes('Inventário')).sort((a, b) => b.date.localeCompare(a.date))[0];
                                    weightDiff = lastAuditEntry ? parseFloat(String(lastAuditEntry.details['Diferença'] || '0')) : 0;
                                }

                                const hasSignificantDiff = Math.abs(weightDiff) > 0.1;
                                const isCritical = (!!item.lastAuditDate || !!sessionAudit) && (hasSignificantDiff || !!observationText);

                                return (
                                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isCritical ? 'bg-rose-50/50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {isCritical && (
                                                    <div className="flex-shrink-0 w-2 h-10 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.4)]" title="Atenção: Inconsistência Detectada" />
                                                )}
                                                <div>
                                                    <div className="font-black text-slate-800 text-base">{item.internalLot}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{item.supplierLot}</div>
                                                </div>
                                            </div>
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
                                            {hasSignificantDiff && (
                                                <div className={`text-[10px] font-black uppercase ${weightDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(2)} kg
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {observationText ? (
                                                <div className="flex items-start gap-2 bg-rose-100 p-2 rounded-lg border border-rose-200 max-w-[250px] shadow-sm">
                                                    <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 mt-1 shrink-0" />
                                                    <span className="text-xs text-rose-900 font-bold">{observationText}</span>
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
                                                const isCheckedInSession = sessionCheckedIds.has(item.id) || !!sessionAudit;
                                                const needsReAudit = inventorySessions.some(s => s.materialType === item.materialType && normalizeBitola(s.bitola) === normalizeBitola(item.bitola) && s.status === 're-audit');

                                                if (isCheckedInSession || item.lastAuditDate) {
                                                    return (
                                                        <div className="flex flex-col items-center">
                                                            {needsReAudit && !isCheckedInSession ? (
                                                                <>
                                                                    <ArrowPathIcon className="h-6 w-6 text-amber-500 mb-0.5 animate-spin-slow" />
                                                                    <span className="text-[10px] font-black text-amber-700 uppercase">Re-conferir</span>
                                                                </>
                                                            ) : isCritical ? (
                                                                <>
                                                                    <ExclamationTriangleIcon className="h-6 w-6 text-rose-600 mb-0.5" />
                                                                    <span className="text-[10px] font-black text-rose-700 uppercase">Divergente</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircleIcon className="h-6 w-6 text-emerald-600 mb-0.5" />
                                                                    <span className="text-[10px] font-black text-emerald-700 uppercase">OK</span>
                                                                </>
                                                            )}
                                                            <span className="text-[9px] text-slate-500 font-bold leading-none">
                                                                {new Date(auditDateToDisplay || new Date()).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return <span className="text-slate-300 font-bold">-</span>;
                                            })()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {
                selectedSessionForReport && (
                    <InventorySessionReport
                        session={selectedSessionForReport}
                        onClose={() => setSelectedSessionForReport(null)}
                    />
                )
            }

            {approvingSession && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 text-white">
                                    <ScaleIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-emerald-900 tracking-tight">Revisar e Aplicar ao Estoque</h3>
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">{approvingSession.materialType} {approvingSession.bitola}</p>
                                </div>
                            </div>
                            <button onClick={() => setApprovingSession(null)} className="p-2 hover:bg-emerald-100 rounded-xl transition-colors text-emerald-900">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-900 font-bold leading-relaxed">
                                    Esta ação irá atualizar permanentemente as quantidades no sistema.
                                    Certifique-se de que os dados abaixo estão corretos antes de autorizar com sua senha.
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resumo das Alterações</h4>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500">
                                            <tr>
                                                <th className="p-4">Lote</th>
                                                <th className="p-4 text-right">Anterior</th>
                                                <th className="p-4 text-right">Novo Peso</th>
                                                <th className="p-4 text-right">Diferença</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {approvingSession.auditedLots
                                                .filter(lot => Math.abs(lot.physicalWeight - lot.systemWeight) > 0.01 || lot.tempLotData)
                                                .map(lot => {
                                                    const diff = lot.physicalWeight - lot.systemWeight;
                                                    const isNew = !!lot.tempLotData;
                                                    return (
                                                        <tr key={lot.lotId} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 font-black text-slate-900">
                                                                <div className="flex items-center gap-2">
                                                                    LOT {lot.internalLot}
                                                                    {isNew && <span className="bg-blue-100 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-md font-black">NOVO</span>}
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-right text-slate-400 font-bold">{isNew ? '-' : `${lot.systemWeight.toFixed(0)}kg`}</td>
                                                            <td className="p-4 text-right font-black text-slate-900">{lot.physicalWeight.toFixed(0)}kg</td>
                                                            <td className={`p-4 text-right font-black ${diff > 0 || isNew ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {isNew ? `+${lot.physicalWeight.toFixed(0)}kg` : `${diff > 0 ? '+' : ''}${diff.toFixed(0)}kg`}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            {approvingSession.auditedLots.filter(lot => Math.abs(lot.physicalWeight - lot.systemWeight) > 0.01 || lot.tempLotData).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhuma alteração de peso detectada.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => setApprovingSession(null)}
                                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={() => handleApplyChangesToStock(approvingSession)}
                                disabled={isSaving}
                                className="flex-[2] px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'PROCESSANDO...' : (
                                    <>
                                        <CheckCircleIcon className="w-4 h-4" />
                                        AUTORIZAR E ATUALIZAR ESTOQUE
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default StockInventory;
