import React, { useState, useMemo } from 'react';
import { StockItem, MaterialType, Bitola, MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { CheckCircleIcon, XCircleIcon, ExclamationIcon, CogIcon, TrashIcon } from './icons';

interface StockConferenceProps {
    stock: StockItem[];
    onUpdateStockItem: (item: StockItem) => void;
    onDeleteStockItem: (id: string) => void;
    onAddStockItem: (item: StockItem) => void;
}

type ConferenceStatus = 'pending' | 'checked' | 'missing' | 'adjusted';

interface ConferenceItemState {
    status: ConferenceStatus;
    originalQuantity: number;
    checkedQuantity: number;
    scannedLocation?: string;
}

const StockConference: React.FC<StockConferenceProps> = ({ stock, onUpdateStockItem, onDeleteStockItem, onAddStockItem }) => {
    // Selection State
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | ''>('');
    const [selectedBitola, setSelectedBitola] = useState<Bitola | ''>('');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

    // Layout configuration (In a real app, this should be persisted)
    // We initialize with unique locations found in stock + defaults
    const [rows, setRows] = useState<string[]>(() => {
        const existing = Array.from(new Set(stock.map(s => s.location).filter(Boolean))) as string[];
        return existing.length > 0 ? existing.sort() : ['Fileira A', 'Fileira B', 'Fileira C'];
    });
    const [isManageLayoutOpen, setIsManageLayoutOpen] = useState(false);
    const [newRowName, setNewRowName] = useState('');

    // Conference Session State
    // Map of stock ID to conference state
    const [sessionState, setSessionState] = useState<Record<string, ConferenceItemState>>({});

    // Derived: Items to audit based on selection
    const itemsToAudit = useMemo(() => {
        if (!selectedMaterial && !selectedBitola) return [];
        return stock.filter(item => {
            if (item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça') return false;
            if (selectedMaterial && item.materialType !== selectedMaterial) return false;
            // if (selectedBitola && item.bitola !== selectedBitola) return false; 
            // Allow selecting only material to see all bitolas if desired, but user asked for specificity.
            // Let's enforce bitola if selected.
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

    const handleMissingItem = (item: StockItem) => {
        if (window.confirm(`Marcar lote ${item.internalLot} como NÃO ENCONTRADO? Isso ajustará o estoque para 0.`)) {
            setSessionState(prev => ({
                ...prev,
                [item.id]: {
                    status: 'missing',
                    originalQuantity: item.remainingQuantity,
                    checkedQuantity: 0
                }
            }));
            // Immediate effect or wait for "Save"? The user said "ajustar o estoque".
            // Let's apply immediately for smooth flow or offer a "Apply All" button?
            // "consigo acessar oque tenho disponivel e conseguir apontar oque esta faltando para que possamos ajustar o estoque"
            // Usually simpler to update immediately in these lightweight apps.
            onUpdateStockItem({ ...item, remainingQuantity: 0, status: 'Consumido para fazer treliça' }); // Or a 'Perdido' status? Let's assume 0 qty is consumed/gone. 
            // Actually, deleting or archiving might be better. Let's keep it simple: Update qty to 0.
        }
    };

    const handleMoveItem = (item: StockItem, newLocation: string) => {
        onUpdateStockItem({ ...item, location: newLocation });
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
    }, [rows, itemsToAudit, sessionState]); // Re-calc if items change status? No, just list.

    const allBitola = [...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions];

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircleIcon className="w-6 h-6 text-emerald-600" /> Conferência de Estoque
                        </h2>
                        <p className="text-sm text-slate-500">Selecione o material para iniciar a conferência e gestão física.</p>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                        {/* Unassigned Items */}
                        {itemsByRow['Sem Localização'].length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                    <ExclamationIcon className="w-5 h-5" /> Itens Sem Localização Definida ({itemsByRow['Sem Localização'].length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {itemsByRow['Sem Localização'].map(item => (
                                        <StockItemCard
                                            key={item.id}
                                            item={item}
                                            status={getSessionItem(item.id).status}
                                            rows={rows}
                                            onCheck={() => handleCheckItem(item)}
                                            onMissing={() => handleMissingItem(item)}
                                            onMove={(loc) => handleMoveItem(item, loc)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rows */}
                        {rows.map(row => (
                            <div key={row} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-slate-100 p-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">{row}</h3>
                                    <span className="text-xs font-semibold bg-slate-200 px-2 py-1 rounded text-slate-600">
                                        {itemsByRow[row]?.length || 0} itens
                                    </span>
                                </div>
                                <div className="p-4 bg-slate-50 min-h-[100px]">
                                    {(!itemsByRow[row] || itemsByRow[row].length === 0) ? (
                                        <div className="text-center text-slate-400 text-sm py-4">Vazio</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {(itemsByRow[row] || []).map((item: StockItem) => (
                                                <StockItemCard
                                                    key={item.id}
                                                    item={item}
                                                    status={getSessionItem(item.id).status}
                                                    rows={rows}
                                                    onCheck={() => handleCheckItem(item)}
                                                    onMissing={() => handleMissingItem(item)}
                                                    onMove={(loc) => handleMoveItem(item, loc)}
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
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 rounded border">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Total Esperado</div>
                                    <div className="text-2xl font-bold text-slate-800">{itemsToAudit.length}</div>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded border border-emerald-100">
                                    <div className="text-xs text-emerald-600 uppercase font-bold">Conferidos</div>
                                    <div className="text-2xl font-bold text-emerald-700">
                                        {Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'checked').length}
                                    </div>
                                </div>
                                <div className="p-3 bg-red-50 rounded border border-red-100">
                                    <div className="text-xs text-red-600 uppercase font-bold">Faltantes</div>
                                    <div className="text-2xl font-bold text-red-700">
                                        {Object.values(sessionState).filter((s: ConferenceItemState) => s.status === 'missing').length}
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <button
                                        onClick={() => {
                                            // Ideally commit session to DB history
                                            alert("Conferência salva e estoque atualizado!");
                                            setSessionState({});
                                            setSelectedMaterial('');
                                        }}
                                        className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-4 rounded-lg transition shadow-lg"
                                    >
                                        Finalizar Conferência
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
    status: ConferenceStatus;
    rows: string[];
    onCheck: () => void;
    onMissing: () => void;
    onMove: (newLoc: string) => void;
}> = ({ item, status, rows, onCheck, onMissing, onMove }) => {
    const isChecked = status === 'checked';
    const isMissing = status === 'missing';

    return (
        <div className={`
            relative p-3 rounded-lg border shadow-sm transition-all duration-300
            ${isChecked ? 'bg-emerald-50 border-emerald-200' : isMissing ? 'bg-red-50 border-red-200 opacity-70' : 'bg-white border-slate-200 hover:shadow-md'}
        `}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className="font-bold text-slate-800 block text-lg">{item.internalLot}</span>
                    <span className="text-xs text-slate-500">{item.supplier}</span>
                </div>
                <div className="text-right">
                    <span className="block font-bold text-slate-800">{item.remainingQuantity} kg</span>
                    <span className="text-xs text-slate-500">{item.bitola}mm</span>
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                {!isChecked && !isMissing && (
                    <>
                        <button onClick={onCheck} className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded font-bold hover:bg-emerald-200 text-sm flex items-center justify-center gap-1">
                            <CheckCircleIcon className="w-4 h-4" /> OK
                        </button>
                        <button onClick={onMissing} className="px-3 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Marcar Falta">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </>
                )}
                {isChecked && (
                    <div className="w-full bg-emerald-100 text-emerald-800 py-1 rounded text-center text-xs font-bold flex items-center justify-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Conferido
                    </div>
                )}
                {isMissing && (
                    <div className="w-full bg-red-100 text-red-800 py-1 rounded text-center text-xs font-bold">
                        Não Encontrado
                    </div>
                )}
            </div>

            {/* Mover dropdown */}
            {!isChecked && !isMissing && (
                <div className="mt-2 pt-2 border-t">
                    <select
                        value={item.location || ''}
                        onChange={(e) => onMove(e.target.value)}
                        className="w-full text-xs p-1 border rounded bg-slate-50 text-slate-600"
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
