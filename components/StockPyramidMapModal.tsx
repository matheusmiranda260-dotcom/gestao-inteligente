import React, { useState, useMemo } from 'react';
import { StockItem, Bitola, MaterialType, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { XIcon, ArchiveIcon, CheckCircleIcon, ExclamationIcon, AdjustmentsIcon, SearchIcon } from './icons';

interface StockPyramidMapModalProps {
    stock: StockItem[];
    onClose: () => void;
    onUpdateStockItem: (item: StockItem) => void;
}

const StockPyramidMapModal: React.FC<StockPyramidMapModalProps> = ({ stock, onClose, onUpdateStockItem }) => {
    // UI State
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('Fio Máquina');
    const [selectedBitola, setSelectedBitola] = useState<Bitola>('6.35');
    const [pyramidId, setPyramidId] = useState('P01');
    const [pyramidStructure, setPyramidStructure] = useState('10,9,8,7'); // Base -> Top (Items count)
    const [showConfig, setShowConfig] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Interaction State
    const [selectedSlot, setSelectedSlot] = useState<{ id: string; level: number; pos: number } | null>(null);

    // Derived Data
    const allBitolaOptions = useMemo(() => [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort(), []);

    const rowCounts = useMemo(() => {
        return pyramidStructure.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    }, [pyramidStructure]);

    const levels = rowCounts.length;

    // Filter stock for the "Unassigned List"
    const unassignedList = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return stock.filter(item => {
            if (item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça') return false;
            if (item.materialType !== selectedMaterial) return false;
            if (item.bitola !== selectedBitola) return false;
            if (item.location) return false; // Already has address

            return (
                item.internalLot.toLowerCase().includes(term) ||
                item.supplierLot.toLowerCase().includes(term) ||
                item.supplier.toLowerCase().includes(term)
            );
        });
    }, [stock, selectedMaterial, selectedBitola, searchTerm]);

    // Map of all items in the current pyramid (regardless of material/bitola to show obstacles)
    const pyramidItems = useMemo(() => {
        const map = new Map<string, StockItem[]>();
        stock.forEach(item => {
            if (item.location && item.location.startsWith(`${pyramidId}-`)) {
                if (!map.has(item.location)) map.set(item.location, []);
                map.get(item.location)?.push(item);
            }
        });
        return map;
    }, [stock, pyramidId]);

    const handleAssign = (item: StockItem) => {
        if (!selectedSlot) return;
        onUpdateStockItem({ ...item, location: selectedSlot.id });
        setSelectedSlot(null); // Clear selection after assign
    };

    const handleUnassign = (item: StockItem) => {
        onUpdateStockItem({ ...item, location: null as any }); // Clear location
    };

    // Render logic for rows (Top to Bottom visually)
    // rowCounts input is Bottom -> Top (10,9,8,7). 
    // We want to render N4 (7), N3 (8), N2 (9), N1 (10).
    const visualRows = useMemo(() => {
        // Create objects: { levelNumber: 1..N, count: number }
        const rows = rowCounts.map((count, idx) => ({ levelNumber: idx + 1, count }));
        // Reverse to render Top level first
        return rows.reverse();
    }, [rowCounts]);

    const getSlotId = (level: number, pos: number) => {
        // Format: P01-N04-01
        return `${pyramidId}-N${String(level).padStart(2, '0')}-${String(pos).padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 text-white p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <ArchiveIcon className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Mapa de Estoque (Endereçamento)</h2>
                            <p className="text-xs text-slate-400">Gerencie a localização física dos rolos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Panel: Controls & Unassigned Items */}
                    <div className="w-80 md:w-96 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
                        {/* Filters */}
                        <div className="p-4 space-y-4 border-b border-slate-200 bg-white">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Material</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setSelectedMaterial('Fio Máquina')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${selectedMaterial === 'Fio Máquina' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Fio Máquina
                                    </button>
                                    <button
                                        onClick={() => setSelectedMaterial('CA-60')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${selectedMaterial === 'CA-60' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        CA-60
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Bitola</label>
                                <select
                                    value={selectedBitola}
                                    onChange={e => setSelectedBitola(e.target.value as Bitola)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800"
                                >
                                    {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            <div>
                                <button
                                    onClick={() => setShowConfig(!showConfig)}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase hover:text-blue-600 transition"
                                >
                                    <AdjustmentsIcon className="h-4 w-4" /> Configuração da Pilha
                                </button>

                                {showConfig && (
                                    <div className="mt-2 p-3 bg-slate-100 rounded-lg space-y-3 animate-fadeIn">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block">ID da Pilha</label>
                                            <input
                                                type="text"
                                                value={pyramidId}
                                                onChange={e => setPyramidId(e.target.value.toUpperCase())}
                                                className="w-full p-1.5 border border-slate-300 rounded text-sm uppercase"
                                                placeholder="Ex: P01"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 block">Estrutura (Base -&gt; Topo)</label>
                                            <input
                                                type="text"
                                                value={pyramidStructure}
                                                onChange={e => setPyramidStructure(e.target.value)}
                                                className="w-full p-1.5 border border-slate-300 rounded text-sm"
                                                placeholder="Ex: 10,9,8,7"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Qtd. de rolos por nível.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Unassigned List */}
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100">
                                <h3 className="font-bold text-slate-700 text-sm">Lotes Sem Endereço</h3>
                                <div className="text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-bold">{unassignedList.length}</div>
                            </div>

                            <div className="p-2 border-b border-slate-200 bg-white">
                                <div className="relative">
                                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar lote..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {unassignedList.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Nenhum lote disponível.
                                    </div>
                                ) : (
                                    unassignedList.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => selectedSlot && handleAssign(item)}
                                            className={`p-3 bg-white border rounded-xl shadow-sm transition group ${selectedSlot ? 'cursor-pointer hover:border-blue-500 hover:ring-2 hover:ring-blue-100' : 'cursor-default opacity-75'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-slate-800 text-sm">{item.internalLot}</span>
                                                <span className="text-xs font-medium text-slate-500">{item.remainingQuantity}kg</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-slate-400">
                                                <span>{item.supplier}</span>
                                                {selectedSlot && <span className="text-blue-600 font-bold group-hover:underline">Atribuir &rarr;</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Map Visualization */}
                    <div className="flex-1 bg-slate-100 p-8 overflow-auto flex flex-col items-center">

                        {/* Info Header for Map */}
                        <div className="w-full max-w-4xl flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    Pilha {pyramidId}
                                    <span className="text-sm font-normal text-slate-500 px-2 py-1 bg-slate-200 rounded-full">
                                        {selectedMaterial} • {selectedBitola}mm
                                    </span>
                                </h1>
                            </div>
                            <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm border border-emerald-600"></div>
                                    <span className="text-slate-600">Lote Correto</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-red-100 border-2 border-red-400 border-dashed rounded-full"></div>
                                    <span className="text-slate-600">Material Diferente</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-white border-2 border-slate-300 border-dashed rounded-full"></div>
                                    <span className="text-slate-600">Vazio</span>
                                </div>
                            </div>
                        </div>

                        {/* Selection Hint */}
                        {selectedSlot ? (
                            <div className="mb-6 bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce-subtle">
                                <CheckCircleIcon className="h-6 w-6" />
                                <div>
                                    <p className="font-bold">Slot Selecionado: {selectedSlot.id}</p>
                                    <p className="text-blue-100 text-sm">Selecione um lote na lista à esquerda para alocar.</p>
                                </div>
                                <button onClick={() => setSelectedSlot(null)} className="ml-4 bg-white/20 hover:bg-white/30 p-1 rounded-lg">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <p className="mb-6 text-slate-500 text-sm">Clique em um slot vazio para selecionar, ou em um ocupado para ver detalhes.</p>
                        )}

                        {/* The Pyramid Grid */}
                        <div className="flex flex-col gap-2 items-center">
                            {visualRows.map((row) => (
                                <div key={row.levelNumber} className="flex items-center justify-center gap-1 md:gap-2">
                                    {/* Level Label (Optional) */}
                                    {/* <div className="absolute left-4 text-xs font-bold text-slate-400">N{row.levelNumber}</div> */}

                                    {Array.from({ length: row.count }).map((_, idx) => {
                                        const pos = idx + 1;
                                        const slotId = getSlotId(row.levelNumber, pos);
                                        const itemsInSlot = pyramidItems.get(slotId) || [];
                                        const isOccupied = itemsInSlot.length > 0;
                                        const isSelected = selectedSlot?.id === slotId;

                                        // Determine Status
                                        let statusColor = 'bg-white border-dashed border-slate-300 hover:border-blue-400';
                                        let icon = null;

                                        if (isOccupied) {
                                            const hasConflict = itemsInSlot.some(i => i.bitola !== selectedBitola || i.materialType !== selectedMaterial);
                                            if (hasConflict) {
                                                statusColor = 'bg-red-50 border-solid border-red-300 text-red-700';
                                                icon = <ExclamationIcon className="h-6 w-6" />;
                                            } else {
                                                statusColor = 'bg-emerald-100 border-solid border-emerald-400 text-emerald-800 shadow-md';
                                                icon = <CheckCircleIcon className="h-6 w-6" />;
                                            }
                                        }

                                        if (isSelected) {
                                            statusColor = 'ring-4 ring-blue-500/30 border-blue-600 bg-blue-50 z-10 scale-110';
                                        }

                                        return (
                                            <div className="relative group" key={slotId}>
                                                <button
                                                    onClick={() => setSelectedSlot({ id: slotId, level: row.levelNumber, pos })}
                                                    className={`
                                                        w-16 h-16 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center transition-all duration-200 border-2
                                                        ${statusColor}
                                                    `}
                                                    title={slotId}
                                                >
                                                    {isOccupied ? (
                                                        <>
                                                            {itemsInSlot[0].bitola !== selectedBitola && (
                                                                <span className="text-[10px] font-bold bg-white/80 px-1 rounded mb-0.5">{itemsInSlot[0].bitola}</span>
                                                            )}
                                                            <span className="text-xs md:text-sm font-bold truncate max-w-[90%]">{itemsInSlot[0].internalLot}</span>
                                                            <span className="text-[10px] opacity-75">{itemsInSlot[0].remainingQuantity}kg</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 font-bold group-hover:text-blue-400">{pos}</span>
                                                    )}
                                                </button>

                                                {/* Tooltip / Popover for Occupied Slots */}
                                                {isOccupied && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white text-left p-3 rounded-xl shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-20">
                                                        <p className="text-xs font-bold text-slate-500 mb-1">{slotId}</p>
                                                        {itemsInSlot.map(item => (
                                                            <div key={item.id} className="mb-2 last:mb-0">
                                                                <p className="text-sm font-bold text-slate-800">{item.internalLot}</p>
                                                                <p className="text-xs text-slate-500">{item.materialType} - {item.bitola}</p>
                                                                <p className="text-xs text-slate-500">{item.supplier}</p>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleUnassign(item); }}
                                                                    className="mt-1 w-full py-1 bg-red-50 text-red-600 text-xs font-bold rounded hover:bg-red-100 transition"
                                                                >
                                                                    Remover da Pilha
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Pyramid Base Label */}
                        <div className="mt-4 text-slate-400 text-sm font-bold tracking-widest uppercase">Base da Pilha</div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockPyramidMapModal;
