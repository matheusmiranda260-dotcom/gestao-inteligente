
import React, { useState, useMemo } from 'react';
import { StockItem, MaterialType, Bitola, MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { ArchiveIcon, CheckCircleIcon, PlusIcon, SearchIcon, TrashIcon, ExclamationIcon, ArrowLeftIcon, ChartBarIcon } from './icons';

interface PyramidRowProps {
    rowName: string;
    items: StockItem[];
    onDrop: (item: StockItem) => void;
    onRemove: (item: StockItem) => void;
    onRemoveRow: () => void;
    isActive: boolean;
    onSetActive: () => void;
    onItemClick?: (item: StockItem) => void; // New prop for mobile move
}

const PyramidRow: React.FC<PyramidRowProps> = ({ rowName, items, onDrop, onRemove, onRemoveRow, isActive, onSetActive, onItemClick }) => {
    const [baseSize, setBaseSize] = useState(4); // Default base size

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-emerald-50');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('bg-emerald-50');
    };

    // Pyramid Logic: Calculate levels
    // Base Level = baseSize items. Next Level = baseSize - 1, etc.
    const levels: StockItem[][] = [];
    let currentIndex = 0;
    let currentCapacity = baseSize;

    if (items.length > 0) {
        while (currentIndex < items.length) {
            // If currentCapacity drops to 0 or less, we usually just stack 1s on top, or maybe maintain 1.
            // Let's cap minimum capacity at 1.
            const capacity = Math.max(1, currentCapacity);

            const levelItems = items.slice(currentIndex, currentIndex + capacity);
            levels.push(levelItems);

            currentIndex += capacity;
            currentCapacity--;
        }
    }

    return (
        <div
            className={`flex-1 min-w-full md:min-w-[300px] border-2 rounded-xl p-4 relative transition-all duration-300 ${isActive ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-300' : 'border-dashed border-slate-300 bg-slate-50 opacity-90'}`}
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
                // Prevent bubbling if needed, but actually we want click on row to set active?
                // The header has onClick, but the body?
            }}
        >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <div onClick={onSetActive} className="flex items-center gap-2 cursor-pointer flex-grow" title="Clique para ativar esta fileira">
                    <div className={`w-4 h-4 rounded-full border transition-colors ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-400'}`}></div>
                    <div>
                        <h3 className={`font-bold text-lg leading-none ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>{rowName}</h3>
                        <span className="text-xs text-slate-500 font-normal">{items.length} itens</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Base Size Controls - Hidden on mobile to save space? or small */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 mr-2 scale-90 origin-right" title="Tamanho da Base (Chão)">
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(Math.max(1, baseSize - 1)); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-l-lg font-bold">-</button>
                        <span className="text-xs font-mono w-6 text-center border-x bg-slate-50">{baseSize}</span>
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(baseSize + 1); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-r-lg font-bold">+</button>
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onRemoveRow(); }} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><TrashIcon className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Pyramid Render Area */}
            <div className="flex flex-col-reverse items-center gap-1 min-h-[100px] md:min-h-[150px] transition-all duration-300">
                {items.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none opacity-60">
                        {isActive ? 'Toque nos lotes para adicionar' : 'Arraste ou Toque'}
                    </div>
                )}

                {levels.map((levelItems, levelIndex) => (
                    <div key={levelIndex} className="flex justify-center gap-1">
                        {levelItems.map(item => (
                            <div
                                key={item.id}
                                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shadow-lg relative group cursor-grab active:cursor-grabbing border-2 border-white transition-transform hover:scale-110 z-0 hover:z-10"
                                title={`${item.internalLot} - ${item.bitola} - ${item.remainingQuantity}kg`}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onItemClick) onItemClick(item);
                                }}
                            >
                                <div className="text-center leading-tight pointer-events-none">
                                    <div className="text-emerald-300 text-[9px] md:text-[10px]">{item.internalLot}</div>
                                    <div className="opacity-70 scale-90">{item.remainingQuantity.toFixed(0)}</div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        onRemove(item);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-100 shadow-md hover:bg-red-700 hover:scale-110 transition-all z-20 cursor-pointer"
                                    title="Remover da fileira"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
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

    const safeStock = Array.isArray(stock) ? stock : [];

    const [newRowName, setNewRowName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    // We treat unique location strings as rows.
    const [extraRows, setExtraRows] = useState<string[]>([]); // For rows that might be empty momentarily logic

    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | null>(null);
    const [selectedBitola, setSelectedBitola] = useState<Bitola | null>(null);
    const [isPendingListOpen, setIsPendingListOpen] = useState(false); // Mobile: Toggle pending list

    // Quick Add New Lot ("Cadastrar ali mesmo")
    const [activeRow, setActiveRow] = useState<string | null>(null);

    // Move Mode State (Mobile)
    const [itemToMove, setItemToMove] = useState<StockItem | null>(null);

    // Helper to find next available row name globally (across all stock)
    const nextRowLetter = useMemo(() => {
        const existingRowLetters = new Set<string>();
        safeStock.forEach(item => {
            if (item.location && item.location.startsWith('Fileira ')) {
                const parts = item.location.split(' ');
                if (parts.length > 1) existingRowLetters.add(parts[1]);
            }
        });
        extraRows.forEach(row => {
            const parts = row.split(' ');
            if (parts.length > 1) existingRowLetters.add(parts[1]);
        });

        // Try single letters A-Z
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const char of alphabet) {
            if (!existingRowLetters.has(char)) return char;
        }
        // Try A1, A2... if needed, or AA, AB (simple fallback for now: numbers)
        let i = 1;
        while (true) {
            if (!existingRowLetters.has(String(i))) return String(i);
            i++;
        }
    }, [safeStock, extraRows]);



    const handleAddRow = () => {
        const nameToUse = newRowName.trim() || nextRowLetter;
        const fullName = `Fileira ${nameToUse.toUpperCase()}`;

        // Check duplication
        const alreadyExists = derivedRows.includes(fullName) || safeStock.some(s => s.location === fullName);

        if (!alreadyExists) {
            setExtraRows(prev => [...prev, fullName]);
            setNewRowName('');
        } else {
            alert('Esta fileira já existe!');
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

        // Mobile UX: If we were moving an item, clear the selection
        if (itemToMove?.id === item.id) {
            setItemToMove(null);
        }

        // We DO NOT close the drawer here anymore to allow "Rapid Fire" adding on mobile.
        // User closes drawer manually when done.
        if (window.innerWidth < 768 && !itemToMove) { // Only close if coming from drawer, keep open if rapid? Actually let's keep it open.
            // setIsPendingListOpen(false); 
        }

        // Keep activeRow active for rapid fire!
        // setActiveRow(null); 
    };

    const handleRemoveFromRow = (item: StockItem) => {
        onUpdateStockItem({
            ...item,
            location: null // Remove location, goes back to unassigned
        });
    };

    const handleRemoveRow = (rowName: string) => {
        // Only if empty? 
        // Or unassign all items in it? Let's check if empty.
        const hasItems = safeStock.some(s => s.location === rowName);
        if (hasItems) {
            if (!confirm(`A ${rowName} contém itens. Deseja remover a fileira e mover os itens para "Não Atribuído"?`)) {
                return;
            }
            // Move items
            safeStock.filter(s => s.location === rowName).forEach(item => {
                handleRemoveFromRow(item);
            });
        }
        setExtraRows(prev => prev.filter(r => r !== rowName));
    };


    const availableBitolas = useMemo(() => {
        if (!selectedMaterial) return [...(FioMaquinaBitolaOptions || []), ...(TrefilaBitolaOptions || [])]; // Safety spreads
        if (selectedMaterial === 'Fio Máquina') return FioMaquinaBitolaOptions || [];
        if (selectedMaterial === 'CA-60') return TrefilaBitolaOptions || [];
        return [...(FioMaquinaBitolaOptions || []), ...(TrefilaBitolaOptions || [])];
    }, [selectedMaterial]);

    // Filter stock based on selection
    const relevantStock = useMemo(() => {
        return safeStock.filter(item => {
            if (selectedMaterial && item.materialType !== selectedMaterial) return false;
            if (selectedBitola && item.bitola !== selectedBitola) return false;
            return true;
        });
    }, [safeStock, selectedMaterial, selectedBitola]);


    const derivedRows = useMemo(() => {
        const rows = new Set<string>();
        // Only show rows that contain RELEVANT items, PLUS any manually added empty rows
        // If no filter selected, show all rows? Yes.
        relevantStock.forEach(item => {
            if (item.location && item.location.startsWith('Fileira ')) {
                rows.add(item.location);
            }
        });
        extraRows.forEach(r => rows.add(r));
        return Array.from(rows).sort();
    }, [relevantStock, extraRows]);

    const unassignedStock = useMemo(() => {
        return relevantStock
            .filter(item => !item.location)
            .filter(item =>
                (item.internalLot || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.supplierLot || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [relevantStock, searchTerm]);


    // Stats for Progress
    const totalCount = relevantStock.length;
    const mappedCount = relevantStock.filter(s => s.location && s.location.startsWith('Fileira ')).length;
    const unmappedCount = totalCount - mappedCount;
    const progressPercentage = totalCount === 0 ? 0 : Math.round((mappedCount / totalCount) * 100);

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col animate-fadeIn">
            {/* Main Header */}
            <div className="bg-[#0F3F5C] p-4 text-white shadow-md z-30 flex flex-col md:flex-row gap-4 justify-between shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-white/80 hover:text-white md:hidden">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <ArchiveIcon className="w-6 h-6" />
                            <span className="hidden md:inline">Mapeamento de Estoque</span>
                            <span className="md:hidden">Mapeamento</span>
                        </h1>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select
                        value={selectedMaterial || ''}
                        onChange={e => setSelectedMaterial(e.target.value ? e.target.value as MaterialType : null)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none flex-grow md:flex-grow-0"
                    >
                        <option value="" className="text-slate-800">Todos Materiais</option>
                        {MaterialOptions.map(m => <option key={m} value={m} className="text-slate-800">{m}</option>)}
                    </select>

                    <select
                        value={selectedBitola || ''}
                        onChange={e => setSelectedBitola(e.target.value ? e.target.value as Bitola : null)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none flex-grow md:flex-grow-0"
                    >
                        <option value="" className="text-slate-800">Todas Bitolas</option>
                        {availableBitolas.map(b => <option key={b} value={b} className="text-slate-800">{b}</option>)}
                    </select>
                </div>
            </div>

            {/* Sticky Actions Bar */}
            <div className="bg-white border-b shadow-sm p-3 flex flex-col md:flex-row items-center justify-between gap-2 z-20 shrink-0 sticky top-0 md:relative">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Active Row Indicator (Mobile) */}
                    {activeRow && (
                        <div className="flex-1 md:hidden bg-emerald-100 text-emerald-800 px-3 py-2 rounded-lg text-sm font-bold border border-emerald-200 animate-pulse flex items-center justify-between" onClick={() => setActiveRow(null)}>
                            <span>Add em: {activeRow}</span>
                            <span className="text-[10px] bg-white px-1 rounded">PARAR</span>
                        </div>
                    )}

                    {!activeRow && (
                        <div className="flex bg-slate-100 p-1 rounded-lg items-center border border-slate-200 flex-grow md:flex-grow-0">
                            <span className="text-slate-500 text-xs pl-2 whitespace-nowrap font-bold mr-2">Nova:</span>
                            <input
                                type="text"
                                value={newRowName}
                                onChange={e => setNewRowName(e.target.value)}
                                placeholder={nextRowLetter}
                                className="bg-transparent border-none text-slate-800 placeholder-slate-400 focus:ring-0 w-12 text-center text-lg font-bold uppercase p-0"
                                maxLength={3}
                            />
                            <button onClick={handleAddRow} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm font-bold shadow-sm whitespace-nowrap transition h-full">
                                + OK
                            </button>
                        </div>
                    )}
                </div>


                <div className="flex-1 flex items-center justify-between w-full md:w-auto gap-4">
                    {/* Move Mode Indicator */}
                    {itemToMove && (
                        <div className="flex-1 bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-sm font-bold border border-amber-200 flex items-center justify-between animate-fadeIn">
                            <span className="truncate">Movendo: {itemToMove.internalLot}</span>
                            <button onClick={() => setItemToMove(null)} className="text-xs bg-white/50 px-2 py-1 rounded hover:bg-white uppercase">Cancelar</button>
                        </div>
                    )}

                    {!itemToMove && (
                        <div className="flex items-center gap-4 flex-grow justify-end md:justify-center">
                            <div className="text-center">
                                <span className="block text-xl font-bold text-slate-700 leading-none">{totalCount}</span>
                                <span className="text-[9px] uppercase font-bold text-slate-400">Total</span>
                            </div>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <button
                                onClick={() => setIsPendingListOpen(true)}
                                className="text-center group cursor-pointer hover:bg-amber-50 rounded px-2 py-1 transition relative"
                            >
                                <span className="block text-xl font-bold text-amber-500 leading-none">{unmappedCount}</span>
                                <span className="text-[9px] uppercase font-bold text-amber-600/70 flex items-center gap-1">
                                    Pendentes <SearchIcon className="w-3 h-3" />
                                </span>
                                {unmappedCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Mobile Drawer */}
                <div
                    className={`
                        fixed inset-0 z-40 bg-black/60 transition-opacity backdrop-blur-sm md:hidden
                        ${isPendingListOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                    onClick={() => setIsPendingListOpen(false)}
                />
                <div
                    className={`
                        absolute md:static inset-y-0 left-0 w-4/5 md:w-80 bg-slate-50 border-r shadow-2xl flex flex-col z-50 transition-transform duration-300 transform
                        ${isPendingListOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    `}
                >
                    <div className={`p-4 border-b flex justify-between items-center ${activeRow ? 'bg-emerald-100' : 'bg-white'}`}>
                        <div className="flex flex-col">
                            <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                <ExclamationIcon className="w-5 h-5 text-amber-500" />
                                Lotes Pendentes
                            </h2>
                            {activeRow && <span className="text-xs text-emerald-700 font-bold mt-1">Adicionando em: {activeRow}</span>}
                        </div>
                        <button onClick={() => setIsPendingListOpen(false)} className="md:hidden bg-white rounded-full p-2 text-slate-400 hover:text-slate-600 shadow-sm">
                            ✕
                        </button>
                    </div>

                    <div className="p-3 border-b bg-white">
                        <div className="relative">
                            <SearchIcon className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar lote..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 p-3 border border-slate-300 rounded-xl text-base bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-3 space-y-3 pb-20 md:pb-3">
                        {unassignedStock.length === 0 ? (
                            <div className="text-center text-slate-400 py-10 px-4">
                                <CheckCircleIcon className="w-16 h-16 mx-auto text-emerald-200 mb-4" />
                                <p className="font-medium">Tudo limpo!</p>
                                <p className="text-sm mt-2 opacity-75">Nenhum lote pendente para os filtros selecionados.</p>
                            </div>
                        ) : (
                            unassignedStock.map(item => (
                                <div
                                    key={item.id}
                                    className={`bg-white p-5 rounded-xl border-l-4 shadow-sm active:scale-95 transition-all cursor-pointer mb-3 ${activeRow ? 'border-emerald-500 ring-2 ring-emerald-100 hover:bg-emerald-50' : 'border-slate-300 hover:border-amber-400'}`}
                                    onClick={() => {
                                        if (activeRow) {
                                            handleDropOnRow(item, activeRow);
                                        } else {
                                            alert("Selecione uma fileira no mapa primeiro, depois toque aqui para adicionar.");
                                            setIsPendingListOpen(false);
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-slate-800 text-xl">{item.internalLot}</span>
                                        <span className="text-sm bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-bold border border-slate-200">{item.bitola}</span>
                                    </div>
                                    <div className="flex justify-between text-base text-slate-500">
                                        <span>{item.supplier}</span>
                                        <span className="font-medium text-slate-700">{item.remainingQuantity.toFixed(0)} kg</span>
                                    </div>
                                    {activeRow && (
                                        <div className="mt-3 text-center text-sm font-bold text-emerald-600 bg-emerald-50 py-2 rounded-lg border border-emerald-100 uppercase tracking-wide">
                                            Toque para mover para {activeRow}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Map Area */}
                <div className="flex-1 overflow-auto p-2 md:p-8 bg-slate-100 relative">
                    {/* Visual Overlay for Move Mode */}
                    {itemToMove && (
                        <div className="sticky top-0 left-0 right-0 z-20 bg-amber-500/90 text-white text-center py-2 px-4 shadow-lg mb-4 rounded mx-2 animate-bounce">
                            Toque em uma fileira para mover o lote <b>{itemToMove.internalLot}</b>
                        </div>
                    )}

                    <div className="flex flex-wrap items-start gap-3 md:gap-6 justify-center md:justify-start pb-20">
                        {derivedRows.length === 0 && (
                            <div className="w-full flex flex-col items-center justify-center text-slate-400 mt-20 text-center px-4 opacity-70">
                                <ArchiveIcon className="w-20 h-20 mb-4 text-slate-300" />
                                <h3 className="text-xl font-bold">Mapa Vazio</h3>
                                <p className="mb-6">Crie a primeira fileira acima para começar.</p>
                            </div>
                        )}

                        {derivedRows.map(row => {
                            // Sort items by last history date (insertion/edit time) to maintain order stability
                            const rowItems = relevantStock
                                .filter(s => s.location === row)
                                .sort((a, b) => {
                                    const dateA = a.history && a.history.length > 0 ? a.history[a.history.length - 1].date : (a.entryDate || '');
                                    const dateB = b.history && b.history.length > 0 ? b.history[b.history.length - 1].date : (b.entryDate || '');
                                    return dateA.localeCompare(dateB);
                                });

                            return (
                                <PyramidRow
                                    key={row}
                                    rowName={row}
                                    items={rowItems}
                                    onDrop={(item) => handleDropOnRow(item, row)}
                                    onRemove={handleRemoveFromRow}
                                    onRemoveRow={() => handleRemoveRow(row)}
                                    isActive={activeRow === row}
                                    onSetActive={() => {
                                        if (itemToMove) {
                                            handleDropOnRow(itemToMove, row);
                                        } else {
                                            setActiveRow(row === activeRow ? null : row);
                                        }
                                    }}
                                    onItemClick={(item) => setItemToMove(item)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default StockPyramidMap;
