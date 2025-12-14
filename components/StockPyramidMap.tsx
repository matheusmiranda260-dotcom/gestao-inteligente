
import React, { useState, useMemo } from 'react';
import { StockItem, MaterialType, Bitola, MaterialOptions } from '../types';
import { ArchiveIcon, CheckCircleIcon, PlusIcon, SearchIcon, TrashIcon, ExclamationIcon } from './icons';

interface PyramidRowProps {
    rowName: string;
    items: StockItem[];
    onDrop: (item: StockItem) => void;
    onRemove: (item: StockItem) => void;
    onRemoveRow: () => void;
    isActive: boolean;
    onSetActive: () => void;
}

const PyramidRow: React.FC<PyramidRowProps> = ({ rowName, items, onDrop, onRemove, onRemoveRow, isActive, onSetActive }) => {
    // ...
    // ...

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-emerald-50');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('bg-emerald-50');
    };

    const handleDrop = (e: React.DragEvent) => {
        // ...
    };

    return (
        <div
            className={`flex-1 min-w-[300px] border-2 rounded-xl p-4 relative transition-all duration-300 ${isActive ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-300' : 'border-dashed border-slate-300 bg-slate-50 opacity-90'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-emerald-50');
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    const item = JSON.parse(data) as StockItem;
                    onDrop(item);
                }
            }}
            onClick={(e) => {
                // Determine if we should set active or not. If clicked empty space, maybe set active?
                // But let's rely on specific button for clarity or header click.
            }}
        >
            <div className="flex justify-between items-center mb-4 border-b pb-2 cursor-pointer" onClick={onSetActive} title="Clique para ativar esta fileira para adição rápida">
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-400'}`}></div>
                    <h3 className={`font-bold text-lg ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>{rowName} <span className="text-sm font-normal text-slate-500">({items.length} itens)</span></h3>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onRemoveRow(); }} className="text-red-400 hover:text-red-600 p-1"><TrashIcon className="w-4 h-4" /></button>
            </div>

            {/* Pyramid / Stack Area */}
            <div className="flex flex-wrap-reverse justify-center content-end gap-2 min-h-[150px]">
                {items.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
                        Arraste lotes para cá
                    </div>
                )}
                {items.map(item => (
                    <div
                        key={item.id}
                        className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-lg relative group cursor-grab active:cursor-grabbing border-4 border-white"
                        title={`${item.internalLot} - ${item.bitola} - ${item.remainingQuantity}kg`}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(item));
                            e.dataTransfer.effectAllowed = 'move';
                        }}
                    >
                        <div className="text-center leading-tight">
                            <div>{item.bitola}</div>
                            <div className="text-[10px] opacity-70">{item.remainingQuantity.toFixed(0)}</div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <TrashIcon className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface StockPyramidMapProps {
    stock: StockItem[];
    onUpdateStockItem: (item: StockItem) => void;
    onClose: () => void;
}

const StockPyramidMap: React.FC<StockPyramidMapProps> = ({ stock, onUpdateStockItem, onClose }) => {
    // We need to manage "Rows" locally for now, or persist them. 
    // Ideally persistence. For now, we derive rows from stock item 'location' field.
    // If location is null, it's in "Unassigned".
    // Location format: "Fileira A", "Fileira B", etc.

    const [newRowName, setNewRowName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    // We treat unique location strings as rows.
    const [extraRows, setExtraRows] = useState<string[]>([]); // For rows that might be empty momentarily logic

    const derivedRows = useMemo(() => {
        const rows = new Set<string>();
        stock.forEach(item => {
            if (item.location && item.location.startsWith('Fileira ')) {
                rows.add(item.location);
            }
        });
        extraRows.forEach(r => rows.add(r));
        return Array.from(rows).sort();
    }, [stock, extraRows]);

    const unassignedStock = useMemo(() => {
        return stock
            .filter(item => !item.location)
            .filter(item =>
                item.internalLot.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.supplierLot.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [stock, searchTerm]);

    const handleAddRow = () => {
        const name = `Fileira ${newRowName.toUpperCase()}`;
        if (newRowName && !derivedRows.includes(name)) {
            setExtraRows(prev => [...prev, name]);
            setNewRowName('');
        }
    };

    const handleDropOnRow = (item: StockItem, rowName: string) => {
        if (item.location === rowName) return; // No change

        onUpdateStockItem({
            ...item,
            location: rowName,
            // Optionally update history?
            history: [...(item.history || []), {
                type: 'Movimentação Mapa',
                date: new Date().toISOString(),
                details: {
                    from: item.location || 'Não Atribuído',
                    to: rowName,
                    action: 'Arrastado no Mapa'
                }
            }]
        });
    };

    const handleRemoveFromRow = (item: StockItem) => {
        onUpdateStockItem({
            ...item,
            location: undefined // Remove location, goes back to unassigned
        });
    };

    const handleRemoveRow = (rowName: string) => {
        // Only if empty? 
        // Or unassign all items in it? Let's check if empty.
        const hasItems = stock.some(s => s.location === rowName);
        if (hasItems) {
            if (!confirm(`A ${rowName} contém itens. Deseja remover a fileira e mover os itens para "Não Atribuído"?`)) {
                return;
            }
            // Move items
            stock.filter(s => s.location === rowName).forEach(item => {
                handleRemoveFromRow(item);
            });
        }
        setExtraRows(prev => prev.filter(r => r !== rowName));
    };

    // Quick Add New Lot ("Cadastrar ali mesmo")
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [activeRow, setActiveRow] = useState<string | null>(null);

    // ... logic for quick add ...

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col animate-fadeIn">
            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                        <ArchiveIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Mapa de Estoque e Conferência</h1>
                        <p className="text-xs opacity-70">Selecione uma fileira e clique nos lotes pendentes para adicionar.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {/* Add Row Controls */}
                    <div className="flex bg-white/10 p-1 rounded-lg">
                        <input
                            type="text"
                            value={newRowName}
                            onChange={e => setNewRowName(e.target.value)}
                            placeholder="Ex: A, B, C..."
                            className="bg-transparent border-none text-white placeholder-white/50 focus:ring-0 w-24 text-sm"
                        />
                        <button onClick={handleAddRow} disabled={!newRowName} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-sm font-bold disabled:opacity-50">
                            + Add Fileira
                        </button>
                    </div>
                    {/* Quick Add Lot Button */}
                    {/* <button onClick={() => setIsQuickAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg font-bold text-sm shadow inline-flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Novo Lote (Chão)
                    </button> */}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Unassigned Items */}
                <div className="w-80 bg-white border-r shadow-lg flex flex-col z-10">
                    <div className="p-4 bg-slate-50 border-b">
                        <h2 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <ExclamationIcon className="w-5 h-5 text-amber-500" />
                            Pendentes / Não Atribuídos
                        </h2>
                        <div className="relative">
                            <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filtrar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm bg-white"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                        {unassignedStock.length === 0 ? (
                            <div className="text-center text-slate-400 py-10 text-sm">
                                Todos os itens visíveis foram atribuídos a fileiras!
                            </div>
                        ) : (
                            unassignedStock.map(item => (
                                <div
                                    key={item.id}
                                    className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all border-l-4 ${activeRow ? 'border-l-emerald-500 hover:bg-emerald-50' : 'border-l-amber-400 group'}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify(item));
                                    }}
                                    onClick={() => {
                                        if (activeRow) {
                                            handleDropOnRow(item, activeRow);
                                        } else {
                                            alert("Selecione uma fileira (clique no título dela) para adicionar itens rapidamente.");
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-800 text-sm">{item.internalLot}</span>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">{item.bitola}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {item.supplier} | {item.materialType}
                                    </div>
                                    <div className="mt-2 text-xs font-mono text-slate-700 bg-slate-50 p-1 rounded text-center">
                                        {item.remainingQuantity.toFixed(2)} kg
                                    </div>
                                    {!activeRow && (
                                        <div className="hidden group-hover:block text-[10px] text-amber-600 font-bold mt-1 text-center animate-pulse">
                                            Selecione uma fileira para mover
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Map Area */}
                <div className="flex-1 overflow-auto p-8 bg-slate-100">
                    <div className="flex flex-wrap items-start gap-6">
                        {derivedRows.length === 0 && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 mt-20">
                                <ArchiveIcon className="w-24 h-24 opacity-20 mb-4" />
                                <h3 className="text-xl font-bold opacity-50">Mapa Vazio</h3>
                                <p>Adicione fileiras usando o menu superior para começar a organizar.</p>
                            </div>
                        )}

                        {derivedRows.map(row => (
                            <PyramidRow
                                key={row}
                                rowName={row}
                                items={stock.filter(s => s.location === row)}
                                onDrop={(item) => handleDropOnRow(item, row)}
                                onRemove={handleRemoveFromRow}
                                onRemoveRow={() => handleRemoveRow(row)}
                                isActive={activeRow === row}
                                onSetActive={() => setActiveRow(row)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Add Modal PlaceHolder */}
            {/* 
                If the user finds a lot that is NOT in the list, they can add it here.
                This needs to reuse AddConferenceModal logic or be a stripped down version.
             */}
        </div>
    );
};

export default StockPyramidMap;
