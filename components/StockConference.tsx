import React, { useState, useMemo } from 'react';
import { StockItem, MaterialType, Bitola, MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { CheckCircleIcon, XCircleIcon, ExclamationIcon, CogIcon, TrashIcon, PencilIcon } from './icons';

interface StockConferenceProps {
    stock: StockItem[];
    onUpdateStockItem: (item: StockItem) => void;
    onDeleteStockItem: (id: string) => void;
    onAddStockItem: (item: StockItem) => void;
}

type ConferenceStatus = 'pending' | 'checked' | 'missing' | 'issue';

interface ConferenceItemState {
    status: ConferenceStatus;
    originalQuantity: number;
    checkedQuantity: number;
    scannedLocation?: string;
    issueDetails?: string; // For 'missing' or 'issue'
}

const StockConference: React.FC<StockConferenceProps> = ({ stock, onUpdateStockItem, onDeleteStockItem, onAddStockItem }) => {
    // Selection State
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | ''>('');
    const [selectedBitola, setSelectedBitola] = useState<Bitola | ''>('');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

    // Layout configuration
    const [rows, setRows] = useState<string[]>(() => {
        const existing = Array.from(new Set(stock.map(s => s.location).filter(Boolean))) as string[];
        return existing.length > 0 ? existing.sort() : ['Fileira A', 'Fileira B', 'Fileira C', 'Fileira D'];
    });
    const [isManageLayoutOpen, setIsManageLayoutOpen] = useState(false);
    const [newRowName, setNewRowName] = useState('');

    // Conference Session State
    const [sessionState, setSessionState] = useState<Record<string, ConferenceItemState>>({});

    // Derived: Items to audit based on selection
    const itemsToAudit = useMemo(() => {
        if (!selectedMaterial && !selectedBitola) return [];
        return stock.filter(item => {
            if (item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça') return false;
            if (selectedMaterial && item.materialType !== selectedMaterial) return false;
            if (selectedBitola && item.bitola !== selectedBitola) return false;
            return true;
        }).sort((a, b) => (a.location || '').localeCompare(b.location || ''));
    }, [stock, selectedMaterial, selectedBitola]);

    // Helpers
    const getSessionItem = (id: string) => sessionState[id] || { status: 'pending', originalQuantity: 0, checkedQuantity: 0 };

    const handleRowManage = (action: 'add' | 'remove', rowName: string) => {
        if (action === 'add') {
            if (rowName && !rows.includes(rowName)) {
                setRows(prev => [...prev, rowName].sort());
                setNewRowName('');
            }
        } else {
            setRows(prev => prev.filter(r => r !== rowName));
        }
    };

    const handleCheckItem = (item: StockItem) => {
        setSessionState(prev => ({
            ...prev,
            [item.id]: {
                status: 'checked',
                originalQuantity: item.remainingQuantity,
                checkedQuantity: item.remainingQuantity
            }
        }));
    };

    const handleIssueItem = (item: StockItem) => {
        const details = window.prompt(`Descreva o problema com o lote ${item.internalLot}:`, "Ex: Etiqueta rasgada, Local errado...");
        if (details !== null) {
            setSessionState(prev => ({
                ...prev,
                [item.id]: {
                    status: 'issue',
                    originalQuantity: item.remainingQuantity,
                    checkedQuantity: item.remainingQuantity, // Assume quantity represents physical presence unless specified otherwise, but 'issue' flags attention
                    issueDetails: details
                }
            }));
        }
    };

    const handleMissingItem = (item: StockItem) => {
        const details = window.prompt(`Descreva a falta do lote ${item.internalLot} (Obrigatório):`, "Ex: Não encontrado na fileira, possível consumo não baixado...");
        if (details) {
            setSessionState(prev => ({
                ...prev,
                [item.id]: {
                    status: 'missing',
                    originalQuantity: item.remainingQuantity,
                    checkedQuantity: 0,
                    issueDetails: details
                }
            }));
            // We don't update stock immediately to 0 here to allow review, but the user previously asked for immediate adjustment.
            // Let's keep consistent with "Checking" flow -> Finish -> Apply. 
            // BUT, for user feedback "ajustar o estoque", maybe we should mark it now?
            // Let's stick to session state and apply at the end or allow individual "Apply" if critical.
            // For now, visual feedback is key.
        }
    };

    const handleMoveItem = (item: StockItem, newLocation: string) => {
        onUpdateStockItem({ ...item, location: newLocation });
    };

    const handleResetItem = (item: StockItem) => {
        const newState = { ...sessionState };
        delete newState[item.id];
        setSessionState(newState);
    };

    // Render Logic
    const itemsByRow = useMemo(() => {
        const map: Record<string, StockItem[]> = {};
        rows.forEach(r => map[r] = []);
        map['Sem Localização'] = [];

        itemsToAudit.forEach(item => {
            const loc = item.location && rows.includes(item.location) ? item.location : 'Sem Localização';
            if (!map[loc]) map[loc] = [];
            map[loc].push(item);
        });
        return map;
    }, [rows, itemsToAudit, sessionState]);

    const allBitola = [...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions];

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircleIcon className="w-6 h-6 text-emerald-600" /> Conferência de Estoque
                        </h2>
                        <p className="text-sm text-slate-500">Selecione o material para iniciar a auditoria visual fileira por fileira.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsManageLayoutOpen(!isManageLayoutOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition"
                        >
                            <CogIcon className="w-5 h-5" /> Configurar Mapa
                        </button>
                    </div>
                </div>

                {isManageLayoutOpen && (
                    <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fadeIn">
                        <h3 className="font-bold text-slate-700 mb-3">Gerenciar Fileiras / Localizações</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newRowName}
                                onChange={e => setNewRowName(e.target.value)}
                                placeholder="Nome da Fileira (ex: Corredor A)"
                                className="p-2 border border-slate-300 rounded md:w-64"
                            />
                            <button onClick={() => handleRowManage('add', newRowName)} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700">Adicionar</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {rows.map(row => (
                                <span key={row} className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded-full text-slate-700 shadow-sm">
                                    {row}
                                    <button onClick={() => handleRowManage('remove', row)} className="text-red-400 hover:text-red-600"><XCircleIcon className="w-4 h-4" /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Material</label>
                        <select
                            value={selectedMaterial}
                            onChange={e => setSelectedMaterial(e.target.value as MaterialType)}
                            className="w-full p-2 border border-slate-300 rounded"
                        >
                            <option value="">Selecione...</option>
                            {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Bitola (Opcional)</label>
                        <select
                            value={selectedBitola}
                            onChange={e => setSelectedBitola(e.target.value as Bitola)}
                            className="w-full p-2 border border-slate-300 rounded"
                        >
                            <option value="">Todas</option>
                            {allBitola.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {(selectedMaterial) && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Map / Layout View */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Summary of unassigned */}
                        {itemsByRow['Sem Localização'].length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                    <ExclamationIcon className="w-5 h-5" /> Itens Sem Localização Definida ({itemsByRow['Sem Localização'].length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(itemsByRow['Sem Localização'] || []).map((item: StockItem) => (
                                        <StockItemCard
                                            key={item.id}
                                            item={item}
                                            sessionItem={getSessionItem(item.id)}
                                            rows={rows}
                                            onCheck={() => handleCheckItem(item)}
                                            onIssue={() => handleIssueItem(item)}
                                            onMissing={() => handleMissingItem(item)}
                                            onMove={(loc) => handleMoveItem(item, loc)}
                                            onReset={() => handleResetItem(item)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rows */}
                        {rows.map(row => (
                            <div key={row} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-slate-100 p-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                                        {row}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold bg-white border px-2 py-1 rounded text-slate-600">
                                            Total: {itemsByRow[row]?.length || 0}
                                        </span>
                                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                                            OK: {(itemsByRow[row] || []).filter(i => getSessionItem(i.id).status === 'checked').length}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 min-h-[100px]">
                                    {(!itemsByRow[row] || itemsByRow[row].length === 0) ? (
                                        <div className="text-center text-slate-400 text-sm py-4 italic">Nenhum item nesta fileira</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {(itemsByRow[row] || []).map((item: StockItem) => (
                                                <StockItemCard
                                                    key={item.id}
                                                    item={item}
                                                    sessionItem={getSessionItem(item.id)}
                                                    rows={rows}
                                                    onCheck={() => handleCheckItem(item)}
                                                    onIssue={() => handleIssueItem(item)}
                                                    onMissing={() => handleMissingItem(item)}
                                                    onMove={(loc) => handleMoveItem(item, loc)}
                                                    onReset={() => handleResetItem(item)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white p-4 rounded-xl shadow-sm border sticky top-4">
                            <h3 className="font-bold text-slate-800 mb-4">Resumo da Conferência</h3>
                            <div className="space-y-3">
                                <div className="p-3 bg-slate-50 rounded border">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500 uppercase font-bold">Total Esperado</span>
                                        <span className="text-xl font-bold text-slate-800">{itemsToAudit.length}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2 bg-emerald-50 rounded border border-emerald-100 text-center">
                                        <div className="text-[10px] text-emerald-600 uppercase font-bold">OK</div>
                                        <div className="text-lg font-bold text-emerald-700">
                                            {Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'checked').length}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-amber-50 rounded border border-amber-100 text-center">
                                        <div className="text-[10px] text-amber-600 uppercase font-bold">Alertas</div>
                                        <div className="text-lg font-bold text-amber-700">
                                            {Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'issue').length}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-red-50 rounded border border-red-100 text-center">
                                        <div className="text-[10px] text-red-600 uppercase font-bold">Faltas</div>
                                        <div className="text-lg font-bold text-red-700">
                                            {Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'missing').length}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex mt-2">
                                    <div style={{ width: `${(Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'checked').length / itemsToAudit.length) * 100}%` }} className="bg-emerald-500 h-full"></div>
                                    <div style={{ width: `${(Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'issue').length / itemsToAudit.length) * 100}%` }} className="bg-amber-500 h-full"></div>
                                    <div style={{ width: `${(Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'missing').length / itemsToAudit.length) * 100}%` }} className="bg-red-500 h-full"></div>
                                </div>

                                <div className="pt-4 border-t space-y-2">
                                    <button
                                        onClick={() => {
                                            if (window.confirm("Deseja aplicar as correções (Faltas zeram o estoque)?")) {
                                                // Apply missing items 0 quantity
                                                (Object.entries(sessionState) as [string, ConferenceItemState][]).forEach(([id, state]) => {
                                                    if (state.status === 'missing') {
                                                        const item = stock.find(s => s.id === id);
                                                        if (item) {
                                                            onUpdateStockItem({
                                                                ...item,
                                                                remainingQuantity: 0,
                                                                status: 'Consumido para fazer treliça', // Or specific "Perda/Falta" status if available
                                                                history: [...(item.history || []), {
                                                                    type: 'Conferência - Falta',
                                                                    date: new Date().toISOString(),
                                                                    details: {
                                                                        note: state.issueDetails || 'Não encontrado na conferência',
                                                                        action: 'Zerado estoque'
                                                                    }
                                                                }]
                                                            });
                                                        }
                                                    }
                                                    if (state.status === 'issue') {
                                                        // Just add a history note for issue?
                                                        const item = stock.find(s => s.id === id);
                                                        if (item) {
                                                            onUpdateStockItem({
                                                                ...item,
                                                                history: [...(item.history || []), {
                                                                    type: 'Conferência - Alerta',
                                                                    date: new Date().toISOString(),
                                                                    details: {
                                                                        note: state.issueDetails || 'Apontamento de problema'
                                                                    }
                                                                }]
                                                            });
                                                        }
                                                    }
                                                });
                                                alert("Conferência aplicada!");
                                                setSessionState({});
                                            }
                                        }}
                                        className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-4 rounded-lg transition shadow-lg"
                                    >
                                        Finalizar e Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for individual item cards
const StockItemCard: React.FC<{
    item: StockItem;
    sessionItem: ConferenceItemState;
    rows: string[];
    onCheck: () => void;
    onIssue: () => void;
    onMissing: () => void;
    onMove: (newLoc: string) => void;
    onReset: () => void;
}> = ({ item, sessionItem, rows, onCheck, onIssue, onMissing, onMove, onReset }) => {
    const { status, issueDetails } = sessionItem;

    // Style determination
    let cardStyle = 'bg-white border-slate-200 hover:shadow-md';
    let statusLabel = null;

    if (status === 'checked') {
        cardStyle = 'bg-emerald-50 border-emerald-200';
        statusLabel = <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded inline-flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Conferido</span>;
    } else if (status === 'issue') {
        cardStyle = 'bg-amber-50 border-amber-200';
        statusLabel = <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded inline-flex items-center gap-1"><ExclamationIcon className="w-3 h-3" /> Atenção</span>;
    } else if (status === 'missing') {
        cardStyle = 'bg-red-50 border-red-200 opacity-80';
        statusLabel = <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded inline-flex items-center gap-1"><XCircleIcon className="w-3 h-3" /> Faltante</span>;
    }

    return (
        <div className={`relative p-3 rounded-lg border transition-all duration-300 ${cardStyle}`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className="font-bold text-slate-800 block text-lg">{item.internalLot}</span>
                    <span className="text-xs text-slate-500">{item.supplier}</span>
                </div>
                <div className="text-right">
                    <span className="block font-bold text-slate-800">{item.remainingQuantity} kg</span>
                    {statusLabel}
                </div>
            </div>

            {issueDetails && (
                <div className="mb-3 text-xs bg-white bg-opacity-60 p-2 rounded border border-slate-200 italic text-slate-700">
                    "{issueDetails}"
                </div>
            )}

            <div className="flex gap-2 mt-2">
                {status === 'pending' ? (
                    <>
                        <button onClick={onCheck} className="flex-1 bg-white border border-emerald-200 text-emerald-700 py-2 rounded font-bold hover:bg-emerald-50 text-sm flex items-center justify-center gap-1 shadow-sm">
                            <CheckCircleIcon className="w-4 h-4" /> OK
                        </button>
                        <button onClick={onIssue} className="px-3 bg-white border border-amber-200 text-amber-600 rounded hover:bg-amber-50 shadow-sm" title="Reportar Problema">
                            <ExclamationIcon className="w-4 h-4" />
                        </button>
                        <button onClick={onMissing} className="px-3 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 shadow-sm" title="Marcar Falta">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <button onClick={onReset} className="w-full py-1 text-xs text-slate-400 hover:text-slate-600 underline">
                        Desfazer / Refazer Conferência
                    </button>
                )}
            </div>

            {/* Mover dropdown available only if present (checked or issue or pending) -- missing usually implies it's not there to move */}
            {status !== 'missing' && (
                <div className="mt-2 pt-2 border-t">
                    <select
                        value={item.location || ''}
                        onChange={(e) => onMove(e.target.value)}
                        className="w-full text-xs p-1 border rounded bg-slate-50 text-slate-600 focus:bg-white"
                    >
                        <option value="">Mover para...</option>
                        {rows.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
};

export default StockConference;
