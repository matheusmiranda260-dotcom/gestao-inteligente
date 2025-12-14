
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
                // Prevent bubbling if clicking empty space?
                // onSetActive(); // We could auto-activate, but let's stick to header click for explicit activation.
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
                    {/* Base Size Controls (Height Control) */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 mr-2">
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(Math.max(1, baseSize - 1)); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-l-lg font-bold">-</button>
                        <span className="text-xs font-mono w-4 text-center">{baseSize}</span>
                        <button onClick={(e) => { e.stopPropagation(); setBaseSize(baseSize + 1); }} className="px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-r-lg font-bold">+</button>
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onRemoveRow(); }} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><TrashIcon className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Pyramid / Stack Area */}
            {/* Using Grid to simulate base width. Items fill from bottom-left (reverse) logic is complex in CSS Grid without specific placement.
                Flex wrap reverse is actually easier for "piling up". 
                The "Base Size" here will constrain the container WIDTH to roughly (ItemWidth + Gap) * BaseSize.
                Item Width = 4rem (w-16) + gap-2 (0.5rem) -> 4.5rem per item.
            */}
            <div
                className="flex flex-wrap-reverse content-start gap-2 min-h-[150px] mx-auto transition-all duration-300 items-end justify-center"
                style={{ maxWidth: `calc(${baseSize} * 4.5rem)` }} // 4rem item + 0.5rem gap approx.
            >
                {items.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
                        Arraste ou Clique
                    </div>
                )}
                {items.map(item => (
                    <div
                        key={item.id}
                        className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-lg relative group cursor-grab active:cursor-grabbing border-4 border-white transition-transform hover:scale-105 z-0 hover:z-10"
                        title={`${item.internalLot} - ${item.bitola} - ${item.remainingQuantity}kg`}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(item));
                            e.dataTransfer.effectAllowed = 'move';
                        }}
                    >
                        <div className="text-center leading-tight pointer-events-none">
                            <div>{item.bitola}</div>
                            <div className="text-[10px] opacity-70">{item.remainingQuantity.toFixed(0)}</div>
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

    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | null>(null);
    const [selectedBitola, setSelectedBitola] = useState<Bitola | null>(null);

    const availableBitolas = useMemo(() => {
        if (!selectedMaterial) return [];
        if (selectedMaterial === 'Fio Máquina') return FioMaquinaBitolaOptions;
        if (selectedMaterial === 'CA-60') return TrefilaBitolaOptions;
        return [...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions];
    }, [selectedMaterial]);

    // Filter stock based on selection
    const relevantStock = useMemo(() => {
        if (!selectedMaterial || !selectedBitola) return [];
        return stock.filter(item => item.materialType === selectedMaterial && item.bitola === selectedBitola);
    }, [stock, selectedMaterial, selectedBitola]);


    const derivedRows = useMemo(() => {
        if (!selectedMaterial || !selectedBitola) return [];
        const rows = new Set<string>();
        relevantStock.forEach(item => {
            if (item.location && item.location.startsWith('Fileira ')) {
                rows.add(item.location);
            }
        });
        extraRows.forEach(r => rows.add(r));
        return Array.from(rows).sort();
    }, [relevantStock, extraRows, selectedMaterial, selectedBitola]);

    const unassignedStock = useMemo(() => {
        if (!selectedMaterial || !selectedBitola) return [];
        return relevantStock
            .filter(item => !item.location)
            .filter(item =>
                item.internalLot.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.supplierLot.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [relevantStock, searchTerm, selectedMaterial, selectedBitola]);


    if (!selectedMaterial || !selectedBitola) {
        return (
            <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col items-center justify-center animate-fadeIn p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
                    <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                        <ArchiveIcon className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Iniciar Conferência</h2>
                    <p className="text-slate-500 mb-8">Selecione o tipo de material e a bitola para começar a mapear o estoque.</p>

                    <div className="space-y-4 text-left">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Material</label>
                            <div className="grid grid-cols-2 gap-3">
                                {MaterialOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => { setSelectedMaterial(option); setSelectedBitola(null); }}
                                        className={`p-3 rounded-xl border-2 font-bold transition-all ${selectedMaterial === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`transition-opacity duration-300 ${selectedMaterial ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Bitola (mm)</label>
                            <div className="grid grid-cols-4 gap-2">
                                {availableBitolas.map(bitola => (
                                    <button
                                        key={bitola}
                                        onClick={() => setSelectedBitola(bitola)}
                                        className={`p-2 rounded-lg border-2 font-bold text-sm transition-all ${selectedBitola === bitola ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                                    >
                                        {bitola}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl transition">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col animate-fadeIn">
            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={() => { setSelectedMaterial(null); setSelectedBitola(null); }} className="p-2 hover:bg-white/10 rounded-full transition" title="Voltar para seleção">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            Mapa de Estoque
                            <span className="bg-emerald-500 text-xs px-2 py-0.5 rounded font-bold uppercase">{selectedMaterial} - {selectedBitola}</span>
                        </h1>
                        <p className="text-xs opacity-70">Selecione uma fileira e clique nos lotes pendentes para adicionar.</p>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-sm font-bold opacity-70 hover:opacity-100">
                        Sair
                    </button>
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
                                items={relevantStock.filter(s => s.location === row)}
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
        </div >
    );
};

export default StockPyramidMap;
