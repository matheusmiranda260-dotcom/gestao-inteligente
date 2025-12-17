
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
}

const PyramidRow: React.FC<PyramidRowProps> = ({ rowName, items, onDrop, onRemove, onRemoveRow, isActive, onSetActive }) => {
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
                // Prevent bubbling
            }}
        >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <div onClick={onSetActive} className="flex items-center gap-2 cursor-pointer flex-grow" title="Clique para ativar esta fileira para adição rápida">
                    <div className={`w-4 h-4 rounded-full border transition-colors ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-400'}`}></div>
                    <div>
                        <h3 className={`font-bold text-lg leading-none ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>{rowName}</h3>
                        <span className="text-xs text-slate-500 font-normal">{items.length} itens</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Base Size Controls */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 mr-2" title="Tamanho da Base (Chão)">
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(Math.max(1, baseSize - 1)); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-l-lg font-bold">-</button>
                        <span className="text-xs font-mono w-6 text-center border-x bg-slate-50">{baseSize}</span>
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(baseSize + 1); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-r-lg font-bold">+</button>
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onRemoveRow(); }} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><TrashIcon className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Pyramid Render Area */}
            <div className="flex flex-col-reverse items-center gap-1 min-h-[150px] transition-all duration-300">
                {items.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
                        Arraste ou Clique
                    </div>
                )}

                {levels.map((levelItems, levelIndex) => (
                    <div key={levelIndex} className="flex justify-center gap-1">
                        {levelItems.map(item => (
                            <div
                                key={item.id}
                                className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shadow-lg relative group cursor-grab active:cursor-grabbing border-2 border-white transition-transform hover:scale-110 z-0 hover:z-10"
                                title={`${item.internalLot} - ${item.bitola} - ${item.remainingQuantity}kg`}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                            >
                                <div className="text-center leading-tight pointer-events-none">
                                    <div className="text-emerald-300">{item.internalLot}</div>
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
        // Close list on mobile after assigning
        if (window.innerWidth < 768) {
            setIsPendingListOpen(false);
        }
        setActiveRow(null); // Reset active row after drop? logic choice. Let's keep it null to reset state.
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
            <div className="bg-[#0F3F5C] p-4 text-white shadow-md z-30 flex flex-col md:flex-row gap-4 justify-between">
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
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm font-bold ml-4 hidden md:block">
                        Sair
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select
                        value={selectedMaterial || ''}
                        onChange={e => setSelectedMaterial(e.target.value ? e.target.value as MaterialType : null)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                        <option value="" className="text-slate-800">Todos Materiais</option>
                        {MaterialOptions.map(m => <option key={m} value={m} className="text-slate-800">{m}</option>)}
                    </select>

                    <select
                        value={selectedBitola || ''}
                        onChange={e => setSelectedBitola(e.target.value ? e.target.value as Bitola : null)}
                        className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                        <option value="" className="text-slate-800">Todas Bitolas</option>
                        {availableBitolas.map(b => <option key={b} value={b} className="text-slate-800">{b}</option>)}
                    </select>
                </div>
            </div>

            {/* Progress / Info Bar */}
            <div className="bg-white border-b shadow-sm p-3 flex flex-col md:flex-row items-center justify-between gap-4 z-20 px-4 md:px-6">
                {/* Add Row Controls */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex bg-slate-100 p-1 rounded-lg items-center border border-slate-200 flex-grow md:flex-grow-0">
                        <span className="text-slate-500 text-xs pl-2 whitespace-nowrap font-bold mr-2">Nova Fileira:</span>
                        <input
                            type="text"
                            value={newRowName}
                            onChange={e => setNewRowName(e.target.value)}
                            placeholder={nextRowLetter}
                            className="bg-transparent border-none text-slate-800 placeholder-slate-400 focus:ring-0 w-12 text-center text-lg font-bold uppercase"
                            maxLength={3}
                        />
                        <button onClick={handleAddRow} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm font-bold shadow-sm whitespace-nowrap transition">
                            + OK
                        </button>
                    </div>
                </div>


                <div className="flex-1 flex items-center gap-4 md:gap-8 justify-between w-full md:w-auto">
                    {/* Stat Cards */}
                    <div className="flex items-center gap-4 md:gap-6 flex-grow justify-center">
                        <div className="text-center">
                            <span className="block text-xl md:text-2xl font-bold text-slate-700 leading-none">{totalCount}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <button
                            onClick={() => setIsPendingListOpen(true)}
                            className="text-center group cursor-pointer hover:bg-amber-50 rounded px-2 py-1 transition relative"
                        >
                            <span className="block text-xl md:text-2xl font-bold text-amber-500 leading-none">{unmappedCount}</span>
                            <span className="text-[10px] uppercase font-bold text-amber-600/70 tracking-wider flex items-center gap-1">
                                Pendentes <SearchIcon className="w-3 h-3" />
                            </span>
                            {unmappedCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex-1 max-w-[150px] md:max-w-xs hidden sm:block">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>Progresso</span>
                            <span>{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] relative"
                                style={{ width: `${progressPercentage}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Sidebar: Unassigned Items (Desktop) / Drawer (Mobile) */}
                <div
                    className={`
                        fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden
                        ${isPendingListOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    `}
                    onClick={() => setIsPendingListOpen(false)}
                />
                <div
                    className={`
                        absolute md:static inset-y-0 left-0 w-full md:w-80 bg-white border-r shadow-lg flex flex-col z-50 transition-transform duration-300 transform
                        ${isPendingListOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    `}
                >
                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                        <h2 className="font-bold text-slate-700 flex items-center gap-2">
                            <ExclamationIcon className="w-5 h-5 text-amber-500" />
                            Lotes Pendentes ({unassignedStock.length})
                        </h2>
                        <button onClick={() => setIsPendingListOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
                            ✕
                        </button>
                    </div>

                    <div className="p-2 border-b bg-white">
                        <div className="relative">
                            <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filtrar lote..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                        {unassignedStock.length === 0 ? (
                            <div className="text-center text-slate-400 py-10 text-sm px-4">
                                <CheckCircleIcon className="w-12 h-12 mx-auto text-emerald-200 mb-2" />
                                <p>Tudo organizado!</p>
                                <p className="text-xs mt-1">Nenhum lote pendente com os filtros atuais.</p>
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
                                            // Mobile friendliness: if no row selected, maybe just highlight that rows need selection?
                                            // Or auto-close and toast?
                                            // Let's stick to alert for now, but improved text.
                                            alert(`Selecione uma FILEIRA no mapa (clique no título dela) para onde enviar o lote ${item.internalLot}.`);
                                            // On mobile, close this drawer so they can pick a row?
                                            if (window.innerWidth < 768) setIsPendingListOpen(false);
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-800 text-sm">{item.internalLot}</span>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">{item.bitola}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex justify-between">
                                        <span>{item.supplier}</span>
                                        <span className="font-medium text-slate-700">{item.remainingQuantity.toFixed(2)}kg</span>
                                    </div>
                                    {!activeRow && (
                                        <div className="hidden group-hover:block text-[10px] text-amber-600 font-bold mt-2 text-center bg-amber-50 p-1 rounded">
                                            Toque em uma fileira para mover
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Map Area */}
                <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-100 relative">
                    {/* Filter Status Badge Overlay */}
                    {(selectedMaterial || selectedBitola) && (
                        <div className="fixed bottom-4 right-4 bg-slate-800 text-white text-xs px-3 py-1 rounded-full shadow-lg z-20 md:hidden opacity-80 pointer-events-none">
                            Filtro: {selectedMaterial || 'Todos'} / {selectedBitola || 'Todas'}
                        </div>
                    )}

                    <div className="flex flex-wrap items-start gap-4 md:gap-6 justify-center md:justify-start pb-20 md:pb-0">
                        {derivedRows.length === 0 && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 mt-20 text-center px-4">
                                <ArchiveIcon className="w-16 h-16 md:w-24 md:h-24 opacity-20 mb-4" />
                                <h3 className="text-lg md:text-xl font-bold opacity-50">Mapa de Estoque</h3>
                                <p className="text-sm md:text-base mb-4">Selecione filtros acima ou crie uma nova fileira para começar a organizar.</p>
                                <button onClick={() => setIsPendingListOpen(true)} className="md:hidden bg-[#0F3F5C] text-white px-4 py-2 rounded-lg font-bold shadow-lg">
                                    Ver Lotes Pendentes
                                </button>
                            </div>
                        )}

                        {derivedRows.map(row => (
                            <PyramidRow
                                key={row}
                                rowName={row}
                                items={relevantStock.filter(s => s.location === row)}
                                onDrop={(item) => handleDropOnRow(item, row)}
                                onRemove={handleRemoveFromRow}
                                onRemoveRow={() => handleRemoveRow(row)}
                                isActive={activeRow === row}
                                onSetActive={() => setActiveRow(row === activeRow ? null : row)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default StockPyramidMap;
