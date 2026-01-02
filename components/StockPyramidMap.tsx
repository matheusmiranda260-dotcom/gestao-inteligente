
import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, MaterialType, Bitola, MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions, RowConfig } from '../types';
import { fetchTable, upsertItem } from '../services/supabaseService';
import { ArchiveIcon, CheckCircleIcon, PlusIcon, SearchIcon, TrashIcon, ExclamationIcon, ArrowLeftIcon, ChartBarIcon, PencilIcon, XIcon } from './icons';

interface PyramidRowProps {
    rowName: string;
    items: StockItem[];
    onDrop: (item: StockItem) => void;
    onRemove: (item: StockItem) => void;
    onRemoveRow: () => void;
    isActive: boolean;
    onSetActive: () => void;
    onItemClick?: (item: StockItem) => void; // New prop for mobile move
    onExpand?: () => void; // New prop for landscape toggle
    activeSlot?: { l: number, p: number } | null; // New slot highlight
    onSlotClick?: (l: number, p: number) => void;
    movingItem?: StockItem | null; // Visual feedback for move mode
    onRenameRow: (newName: string) => void;
    onPrintRow: () => void;
    config?: RowConfig;
    onUpdateConfig?: (rowName: string, baseSize: number, maxHeight: number) => void;
    onMoveItem?: (item: StockItem) => void; // Dedicated move callback
}

const PyramidRow: React.FC<PyramidRowProps> = ({ rowName, items, onDrop, onRemove, onRemoveRow, isActive, onSetActive, onItemClick, onExpand, activeSlot, onSlotClick, movingItem, onRenameRow, onPrintRow, config, onUpdateConfig, onMoveItem }) => {

    // Determine type for visual logic (defined early for use in render)
    const isCARow = rowName.includes('CA') && !rowName.includes('50') && !rowName.includes('Fio');

    // Determine initial base size. High enough to fit existing items or default 7 as requested.
    // Use config if available, else default

    const getDefaultHeight = (name: string) => {
        // User Rule: CA50 (mapped to Fio Máquina) -> 4
        // CA60 -> 3
        // Logic: If Name contains "CA" and NOT "50", assume CA-60 -> 3.
        // Else (FM, Fio, CA50, Generic) -> 4.
        if (name.includes('CA') && !name.includes('50') && !name.includes('Fio')) return 3;
        return 4;
    };

    const [baseSize, setBaseSize] = useState(config?.baseSize || 7);
    const [maxHeight, setMaxHeight] = useState(config?.maxHeight || getDefaultHeight(rowName));
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(rowName);
    const [menuItemId, setMenuItemId] = useState<string | null>(null);

    // Dynamic Sizing Management
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Optimized Dynamic Sizing based on ACTUAL space
    const dims = useMemo(() => {
        if (containerWidth === 0) return { slotSize: 100, font: 16, gap: 4 };

        // Available space calculation (Container width - padding - approximate gaps)
        const padding = window.innerWidth < 768 ? 32 : 96; // p-4 vs p-12
        const gapSize = baseSize > 15 ? 4 : 8; // gap-x-1 vs gap-x-2
        const totalGaps = (baseSize - 1) * gapSize;
        const available = containerWidth - padding - totalGaps;

        let slotSize = Math.floor(available / baseSize);

        // Bounds to prevent too small/too large
        const minSize = window.innerWidth < 768 ? 28 : 50;
        const maxSize = window.innerWidth < 768 ? 80 : 250;
        slotSize = Math.min(Math.max(slotSize, minSize), maxSize);

        // Font size scales with slot size
        // Font size scales more aggressively with slot size
        const fontSize = Math.max(slotSize * 0.24, 12); // Maximum legibility scale

        return {
            slotSize,
            font: fontSize,
            gap: gapSize,
            lotTitle: Math.max(fontSize * 0.95, 13), // Bold Lot Title
            border: slotSize > 100 ? 8 : (slotSize > 60 ? 4 : 2)
        };
    }, [containerWidth, baseSize]);

    const isFinalized = rowName.includes('[FINALIZADA]');

    const handleRowClick = () => {
        if (menuItemId) setMenuItemId(null);
    };

    const updateConfig = (newBase: number, newHeight: number) => {
        setBaseSize(newBase);
        setMaxHeight(newHeight);
        if (onUpdateConfig) {
            onUpdateConfig(rowName, newBase, newHeight);
        }
    };

    const handleSaveName = () => {
        if (editedName.trim() && editedName !== rowName) {
            onRenameRow(editedName.trim());
        }
        setIsEditingName(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-emerald-50');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('bg-emerald-50');
    };

    // Helper: Parse location to get coordinates
    // Format: "RowName:L{l}:P{p}"
    const getItemCoords = (item: StockItem) => {
        if (!item.location) return null;
        // Check if location string has coordinate suffix
        // Matches ":Lb:Pc" where b and c are digits
        // We use a simpler split check
        const parts = item.location.split(':');
        if (parts.length >= 3) {
            const lPart = parts.find(p => p.startsWith('L'));
            const pPart = parts.find(p => p.startsWith('P'));
            if (lPart && pPart) {
                const lVal = parseInt(lPart.substring(1));
                const pVal = parseInt(pPart.substring(1));
                if (!isNaN(lVal) && !isNaN(pVal)) return { l: lVal, p: pVal };
            }
        }
        return null;
    };

    // Pyramid Structure Generation (Dynamic)
    const builtLevels = [];
    let currentCapacity = baseSize;
    let currentLevel = 0;

    // Build levels until capacity runs out
    while (currentCapacity > 0) {
        const levelSlots = [];
        for (let i = 0; i < currentCapacity; i++) {
            // Find item in this specific slot
            const slotItem = items.find(item => {
                const coords = getItemCoords(item);
                if (coords) return coords.l === currentLevel && coords.p === i;
                return false;
            });

            levelSlots.push({
                coords: { l: currentLevel, p: i },
                item: slotItem
            });
        }
        builtLevels.push(levelSlots);
        currentLevel++;
        currentCapacity--;
    }

    // Identify "Floating" items (those without valid coords or coords out of range)
    const floatingItems = items.filter(item => {
        const coords = getItemCoords(item);
        if (!coords) return true; // No coords
        // Check if coords exist in our generated structure
        // If row resized smaller, items might be out of range
        const maxLevel = builtLevels.length - 1;
        if (coords.l > maxLevel) return true;

        // Safety check for empty level
        const levelCapacity = (baseSize - coords.l);
        if (coords.p >= levelCapacity) return true;

        return false;
    });

    // VISUAL ASSIGNMENT: Fill empty slots with floating items for display purposes
    // This allows migration without DB writes immediately
    let floatIdx = 0;
    builtLevels.forEach(level => {
        level.forEach(slot => {
            if (!slot.item && floatIdx < floatingItems.length) {
                slot.item = floatingItems[floatIdx];
                // Mark as temp?
                floatIdx++;
            }
        });
    });


    const handleSlotDrop = (e: React.DragEvent, l: number, p: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-emerald-50'); // Cleanup local dragover
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            const item = JSON.parse(data) as StockItem;
            // Force location to this slot
            // Location format: "Row Name:L0:P0"
            const newLocation = `${rowName}:L${l}:P${p}`;

            onDrop({ ...item, location: newLocation });
        }
    };

    return (
        <div
            ref={containerRef}
            className={`w-full rounded-[2.5rem] p-4 md:p-12 relative transition-all duration-300 flex flex-col items-center ${isActive ? 'bg-white/60 backdrop-blur-md shadow-2xl border-2 border-emerald-500/30' : 'bg-slate-50/50 border-2 border-dashed border-slate-200 opacity-80'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-emerald-50');
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    const item = JSON.parse(data) as StockItem;
                    // Auto-find logic
                    for (let l = 0; l < builtLevels.length; l++) {
                        for (let p = 0; p < builtLevels[l].length; p++) {
                            const realItem = items.find(it => {
                                const c = getItemCoords(it);
                                return c && c.l === l && c.p === p;
                            });
                            // If slot is truly empty (not just visually filled by floaters, unless we want to stack? No, assume strict)
                            // We prefer filling REAL empty.
                            if (!realItem && !builtLevels[l][p].item) { // Check both to avoid overwriting floaters visually
                                const newLocation = `${rowName}:L${l}:P${p}`;
                                onDrop({ ...item, location: newLocation });
                                return;
                            }
                        }
                    }
                    // Fallback if full: Just drop in row name (will float)
                    onDrop({ ...item, location: rowName });
                }
            }}
            onClick={handleRowClick}
        >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <div onClick={(e) => { e.stopPropagation(); onSetActive(); handleRowClick(); }} className="flex items-center gap-2 cursor-pointer flex-grow" title="Clique para ativar esta fileira">
                    <div className={`w-4 h-4 rounded-full border transition-colors ${isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-400'}`}></div>

                    {isEditingName ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="border rounded px-2 py-1 text-lg font-bold w-40"
                                autoFocus
                            />
                            <button onClick={handleSaveName} className="text-emerald-600 font-bold text-sm bg-emerald-100 p-1 rounded">OK</button>
                            <button onClick={() => setIsEditingName(false)} className="text-red-500 font-bold text-sm bg-red-100 p-1 rounded">X</button>
                        </div>
                    ) : (
                        <div>
                            <h3 className={`font-bold text-lg leading-none flex items-center gap-2 ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>
                                {rowName}
                            </h3>
                            <span className="text-xs text-slate-500 font-normal">{items.length} itens {isFinalized && <span className="text-emerald-600 font-bold opacity-100 bg-emerald-100 px-1 rounded ml-1">FINALIZADA</span>}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Expand/Landscape Button (Mobile Only) */}
                    <button onClick={(e) => { e.stopPropagation(); if (onExpand) onExpand(); }} className="md:hidden bg-emerald-100 p-1.5 rounded hover:bg-emerald-200 text-emerald-700 mr-1" title="Visualizar Deitado (Paisagem)">
                        <ChartBarIcon className="w-5 h-5 rotate-90" />
                    </button>

                    <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm" title="Tamanho da Base (Chão)">
                        <button onClick={(e) => { e.stopPropagation(); updateConfig(Math.max(1, baseSize - 1), maxHeight); }} className="px-2 md:px-3 py-1.5 md:py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-l-lg font-bold border-r active:bg-slate-200">-</button>
                        <div className="flex flex-col items-center justify-center w-8 md:w-10 bg-slate-50 px-1 select-none">
                            <span className="text-[7px] md:text-[8px] uppercase text-slate-400 leading-none mb-0.5">Base</span>
                            <span className="text-xs md:text-sm font-mono font-bold leading-none text-slate-700">{baseSize}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); updateConfig(baseSize + 1, maxHeight); }} className="px-2 md:px-3 py-1.5 md:py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-r-lg font-bold border-l active:bg-slate-200">+</button>
                    </div>

                    <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm" title="Altura Máxima (Pilha)">
                        <button onClick={(e) => { e.stopPropagation(); updateConfig(baseSize, Math.max(1, maxHeight - 1)); }} className="px-2 md:px-3 py-1.5 md:py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-l-lg font-bold border-r active:bg-slate-200">-</button>
                        <div className="flex flex-col items-center justify-center w-8 md:w-10 bg-slate-50 px-1 select-none">
                            <span className="text-[7px] md:text-[8px] uppercase text-slate-400 leading-none mb-0.5">Alt</span>
                            <span className="text-xs md:text-sm font-mono font-bold leading-none text-slate-700">{maxHeight}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); updateConfig(baseSize, Math.min(5, maxHeight + 1)); }} className={`px-2 md:px-3 py-1.5 md:py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-r-lg font-bold border-l active:bg-slate-200 ${maxHeight >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={maxHeight >= 5}>+</button>
                    </div>

                    {/* Actions Group - Removed for automation */}
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); onPrintRow(); }} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200" title="Imprimir Fileira">
                            🖨️
                        </button>
                    </div>
                </div>
            </div>

            {/* Pyramid Render Area */}
            <div className="flex-1 w-full overflow-x-auto overflow-y-visible no-scrollbar pt-28 pb-12 px-2 flex justify-start md:justify-center items-center">
                <div className="flex flex-col-reverse items-center min-h-[120px] md:min-h-[150px] transition-all duration-300 gap-y-4 md:gap-y-6 pb-12 w-max"
                    style={{ height: maxHeight < 5 ? 'auto' : undefined }} // Fluid height if small
                >
                    {builtLevels.map((levelSlots, levelIndex) => {
                        if (levelIndex >= maxHeight) return null;

                        const isRowInteractive = levelSlots.some(s => s.item?.id === menuItemId);

                        return (
                            <div
                                key={levelIndex}
                                className="flex justify-center z-10 relative"
                                style={{
                                    zIndex: isRowInteractive ? 100 : levelIndex,
                                    gap: `${dims.gap}px`,
                                    marginBottom: `${dims.gap * 2}px`
                                }}
                            >
                                {levelSlots.map((slot, slotIndex) => {
                                    const isSlotActive = activeSlot && activeSlot.l === slot.coords.l && activeSlot.p === slot.coords.p;
                                    const isMovingThis = movingItem && slot.item && movingItem.id === slot.item.id;
                                    const isSwapTarget = movingItem && slot.item && movingItem.id !== slot.item.id;

                                    // Premium Industrial Palette
                                    // Using HSL for better vibrance Control
                                    const coilColor = slot.item?.materialType === 'CA-60' ? 'bg-[#1e293b]' : 'bg-[#0f172a]';
                                    const borderColor = slot.item?.materialType === 'CA-60' ? 'border-slate-500' : 'border-cyan-500/50';

                                    // Dynamic Shape based on Row Name (CA-60 = Rectangular/Square)
                                    const shapeClass = isCARow ? 'rounded-2xl' : 'rounded-full';

                                    if (slot.item) {
                                        const isMenuOpen = menuItemId === slot.item.id;

                                        return (
                                            <div
                                                key={slot.item.id}
                                                className={`
                                                ${shapeClass} flex items-center justify-center relative cursor-pointer transform transition-all shrink-0
                                                ${isMovingThis ? 'z-50 scale-110 drop-shadow-2xl' : ''}
                                                ${isMenuOpen ? 'z-50 scale-110 ring-4 ring-emerald-400 bg-white shadow-xl' : 'hover:scale-105 active:scale-95'}
                                            `}
                                                style={{
                                                    width: `${dims.slotSize}px`,
                                                    height: `${dims.slotSize}px`
                                                }}
                                                title={`${slot.item.internalLot} - ${slot.item.bitola} - ${(slot.item.remainingQuantity || 0).toFixed(0)}kg`}
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('application/json', JSON.stringify(slot.item));
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Desktop logic
                                                    setMenuItemId(menuItemId === slot.item!.id ? null : slot.item!.id);
                                                    // Mobile logic (parent handles bottom sheet)
                                                    if (onItemClick) onItemClick(slot.item!);
                                                }}
                                            >
                                                {/* Desktop Context Menu (Hidden on Mobile) */}
                                                {isMenuOpen && (
                                                    <div
                                                        className={`hidden md:flex absolute z-[150] ${levelIndex === 0 ? 'bottom-full mb-6' : 'top-full mt-6'} left-1/2 -translate-x-1/2 w-48 bg-white rounded-[2rem] shadow-[0_30px_70px_rgba(0,0,0,0.6)] p-3.5 flex-col gap-2 border border-slate-200 animate-in fade-in zoom-in duration-200`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="text-[11px] font-black text-center text-slate-500 border-b border-slate-100 pb-2 mb-1 tracking-widest uppercase">
                                                            LOTE {slot.item.internalLot}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); if (onMoveItem) onMoveItem(slot.item!); setMenuItemId(null); }}
                                                            className="bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-black px-4 py-3 rounded-2xl w-full flex items-center justify-between transition-all active:scale-95"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base">✋</span>
                                                                <span>MOVER LOTE</span>
                                                            </div>
                                                            <div className="w-2 h-2 rounded-full bg-sky-400"></div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onRemove(slot.item!); setMenuItemId(null); }}
                                                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-black px-4 py-3 rounded-2xl w-full flex items-center justify-between transition-all active:scale-95"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span>🗑️</span>
                                                                <span>REMOVER</span>
                                                            </div>
                                                            <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                                        </button>

                                                        {/* Dynamic Arrow Placement */}
                                                        {levelIndex === 0 ? (
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[12px] border-transparent border-t-white drop-shadow-xl"></div>
                                                        ) : (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[12px] border-transparent border-b-white drop-shadow-xl"></div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Standard Coil Content (Always Visible, with z-index separation if menu open) */}
                                                <div
                                                    className={`absolute inset-0 ${shapeClass} 
                                                            ${isMovingThis ? 'ring-6 ring-amber-500 z-10' : ''}
                                                            shadow-[0_10px_25px_rgba(0,0,0,0.5)]
                                                        `}
                                                    style={!isCARow ? {
                                                        background: 'repeating-radial-gradient(circle at 50% 50%, #1e293b 0, #1e293b 2px, #0f172a 4px, #020617 8px)',
                                                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 0 8px 15px rgba(0,0,0,0.4)',
                                                        border: `${dims.border / 2}px solid rgba(6, 182, 212, 0.3)`
                                                    } : {
                                                        border: `${dims.border}px solid`,
                                                        borderColor: borderColor,
                                                        backgroundColor: coilColor.replace('bg-', '')
                                                    }}
                                                ></div>

                                                {/* Inner Hole */}
                                                <div className={`absolute inset-[30%] ${shapeClass} ${!isCARow ? 'bg-black/70 shadow-[inset_0_4px_10px_rgba(0,0,0,1)]' : 'bg-slate-900/40 shadow-inner'} border border-white/5`}></div>

                                                {/* Glare removed */}
                                                {!isCARow && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none"></div>}

                                                {/* Content Overlay */}
                                                <div className={`relative z-20 text-center leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)] pointer-events-none flex flex-col items-center justify-center ${shapeClass} bg-black/50 backdrop-blur-[2px] w-[85%] h-[85%] border border-white/5`}>
                                                    <div className="font-black text-yellow-300 uppercase tracking-tighter filter drop-shadow-[0_2px_4px_rgba(0,0,0,1)]" style={{ fontSize: `${dims.lotTitle}px` }}>
                                                        {slot.item.internalLot}
                                                    </div>
                                                    <div className="text-white font-mono font-black border-t border-white/20 mt-1 pt-1" style={{ fontSize: `${dims.font}px` }}>
                                                        {(slot.item.remainingQuantity || 0).toFixed(0)}
                                                    </div>
                                                </div>

                                                {/* Sequential Position Label */}
                                                <div className="absolute top-1 right-2 font-black text-white/40 select-none z-30 uppercase tracking-widest pointer-events-none" style={{ fontSize: `${dims.lotTitle * 0.45}px` }}>
                                                    #{slot.coords.l}.{slot.coords.p}
                                                </div>

                                                {movingItem && movingItem.id !== slot.item.id && (
                                                    <div
                                                        className={`absolute inset-0 flex items-center justify-center bg-amber-500/40 ${shapeClass} animate-pulse cursor-pointer z-30 ring-4 ring-amber-400`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // SWAP logic: just move here, the old item will float or we could swap locations.
                                                            // For now, simpler: move current to this slot's coordinates.
                                                            const targetLoc = `${rowName}:L${slot.coords.l}:P${slot.coords.p}`;
                                                            onDrop({ ...movingItem, location: targetLoc });
                                                        }}
                                                    >
                                                        <span className="text-xl font-bold text-white drop-shadow-md">⇄</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        // Empty Slot
                                        return (
                                            <div
                                                key={`empty-${levelIndex}-${slotIndex}`}
                                                className={`
                                                ${shapeClass} flex items-center justify-center transition-all cursor-pointer z-0 pointer-events-auto shrink-0 relative
                                                ${isSlotActive
                                                        ? 'scale-105 shadow-[0_0_15px_rgba(255,165,0,0.5)] z-20'
                                                        : 'hover:scale-105 opacity-60 hover:opacity-100'}
                                            `}
                                                style={{
                                                    width: `${dims.slotSize}px`,
                                                    height: `${dims.slotSize}px`
                                                }}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleSlotDrop(e, slot.coords.l, slot.coords.p)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Move functionality: If there's an item to move, drop it here!
                                                    if (movingItem) {
                                                        const targetLoc = `${rowName}:L${slot.coords.l}:P${slot.coords.p}`;
                                                        onDrop({ ...movingItem, location: targetLoc });
                                                    } else if (onSlotClick) {
                                                        onSlotClick(slot.coords.l, slot.coords.p);
                                                    }
                                                }}
                                                title={isSlotActive ? 'Vaga SELECIONADA' : `Vazio (L${slot.coords.l}:P${slot.coords.p})`}
                                            >
                                                {/* Realistic "Shadow" Placeholder */}
                                                <div
                                                    className={`absolute inset-0 ${shapeClass} ${isSlotActive ? 'ring-4 ring-emerald-400 ring-offset-2 animate-pulse shadow-[0_0_20px_rgba(52,211,153,0.5)]' : ''}`}
                                                    style={{
                                                        background: !isCARow
                                                            ? 'repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.2) 4px)'
                                                            : 'rgba(0,0,0,0.05)',
                                                        boxShadow: isSlotActive && window.innerWidth < 768 ? 'none' : 'inset 0 0 10px rgba(0,0,0,0.1)'
                                                    }}
                                                ></div>

                                                {/* Inner Hole Shadow (Fio Máquina Only) */}
                                                {!isCARow && <div className={`absolute inset-[30%] ${shapeClass} bg-black/10 border border-white/5`}></div>}

                                                {/* Dashed Outline (Faint) */}
                                                <div className={`absolute inset-0 ${shapeClass} border-2 border-dashed ${isSlotActive ? 'border-orange-500' : 'border-slate-500/30'}`}></div>

                                                <div className={`pointer-events-none z-10 ${isSlotActive ? 'font-bold text-orange-500 animate-bounce' : 'text-slate-600/50'}`} style={{ fontSize: `${dims.font * 1.5}px` }}>{isSlotActive ? '⬇' : '+'}</div>

                                                {/* Sequential Position Label (Empty) */}
                                                <div className="absolute bottom-1 right-2 font-black text-slate-600 opacity-80 select-none z-30 uppercase tracking-tighter" style={{ fontSize: `${dims.lotTitle * 0.6}px` }}>
                                                    L{slot.coords.l}-{slot.coords.p}
                                                </div>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        );
                    })}
                </div>
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
    const [printRowName, setPrintRowName] = useState<string | null>(null); // For printing modal
    const [rowConfigs, setRowConfigs] = useState<RowConfig[]>([]);

    // Modal State
    const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
    const [rowToDelete, setRowToDelete] = useState<string | null>(null);

    useEffect(() => {
        const loadConfigs = async () => {
            const rc = await fetchTable<RowConfig>('row_configs');
            if (rc) setRowConfigs(rc);
        };
        loadConfigs().catch(console.error);
    }, []);

    const handleUpdateRowConfig = async (rowName: string, baseSize: number, maxHeight: number) => {
        setRowConfigs(prev => {
            const exists = prev.some(r => r.rowName === rowName);
            if (exists) {
                return prev.map(r => r.rowName === rowName ? { ...r, baseSize, maxHeight } : r);
            }
            return [...prev, { rowName, baseSize, maxHeight }];
        });

        // Persist to DB
        try {
            await upsertItem('row_configs', { rowName, baseSize, maxHeight }, 'row_name');
        } catch (error) {
            console.error("Failed to save row config", error);
        }
    };

    const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | null>(null);
    const [selectedBitola, setSelectedBitola] = useState<Bitola | null>(null);
    const [isPendingListOpen, setIsPendingListOpen] = useState(false); // Mobile: Toggle pending list

    // Add PencilIcon to imports
    // Wait, imports are at top. I need to make sure PencilIcon is available.
    // Use existing imports list and add PencilIcon if missing. 
    // Checking imports... PencilIcon is NOT in line 4.
    // I need to add it to imports later or assume it is available? 
    // Wait, StockPyramidMap does NOT import PencilIcon. StockControl DOES.
    // I need to add PencilIcon to imports. I'll do it in a separate block.

    // Quick Add New Lot ("Cadastrar ali mesmo")

    // Quick Add New Lot ("Cadastrar ali mesmo")
    const [activeRow, setActiveRow] = useState<string | null>(null);

    const [itemToMove, setItemToMove] = useState<StockItem | null>(null);
    const [landscapeRow, setLandscapeRow] = useState<string | null>(null); // New state for full-screen landscape view

    // Construction Mode / Target Slot
    // Stores the coordinates ({ row, l, p }) of the empty slot the user clicked on.
    // When set, the next click on a pending item will fill this exact slot.
    const [activeSlot, setActiveSlot] = useState<{ row: string, l: number, p: number } | null>(null);
    const [selectedItemMenu, setSelectedItemMenu] = useState<StockItem | null>(null); // New state for Bottom Sheet menu
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true); // For mobile immersive view
    const [isForecastMode, setIsForecastMode] = useState(false); // Optimization mode (FIFO)

    // Helper to identify row "type" based on name
    const getRowTypeInfo = (rowName: string) => {
        const isFM = rowName.includes('FM') || rowName.includes('Fio');
        const isCA = rowName.includes('CA');
        // Try to extract bitola
        const bitolaMatch = rowName.match(/(\d+\.\d+)/);
        const bitola = bitolaMatch ? bitolaMatch[1] : null;
        return { isFM, isCA, bitola };
    };

    // Helper to find next available row name globally (across all stock)
    const getNextRowName = (prefix: string) => {
        const existingNames = new Set<string>();
        safeStock.forEach(item => {
            if (item.location) {
                const rName = item.location.split(':')[0];
                existingNames.add(rName);
            }
        });
        extraRows.forEach(r => existingNames.add(r));

        // Generate A, B, C...
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const char of alphabet) {
            const candidate = `${prefix} ${char}`.trim();
            if (!existingNames.has(candidate)) return candidate;
        }
        // Fallback
        return `${prefix} Z-Ext`;
    };

    // Auto-suggest name when filters change
    useEffect(() => {
        if (!selectedMaterial && !selectedBitola) {
            setNewRowName(''); // Default manual
            return;
        }

        // Build prefix
        let prefix = '';
        if (selectedMaterial === 'Fio Máquina') prefix += 'FM';
        if (selectedMaterial === 'CA-60') prefix += 'CA';

        if (selectedBitola) {
            // Handle 6.35 vs 6.3 naming preference? Let's use full bitola for clarity
            prefix += ` ${selectedBitola}`;
        } else {
            prefix += ' Geral';
        }

        const suggestion = getNextRowName(prefix.trim());
        setNewRowName(suggestion);
    }, [selectedMaterial, selectedBitola, safeStock, extraRows]); // Recalc suggestion when stock changes too


    // Calculate derivedRows - VISIBLY FILTERED based on context
    const derivedRows = useMemo(() => {
        const allRows = new Set<string>();
        safeStock.forEach(s => {
            if (s.location) {
                const part = s.location.split(':')[0];
                allRows.add(part);
            }
        });
        extraRows.forEach(r => allRows.add(r));
        // Also include rows that have configurations (even if empty)
        rowConfigs.forEach(rc => allRows.add(rc.rowName));

        // 2. AUTO-SUGGEST Logic: "Ele já deixa as fileiras prontas"
        // Generate virtual rows based on quantity of unassigned items
        // ALWAYS run suggestion logic
        {
            const matchingUnassigned = safeStock.filter(s => {
                if (s.location) return false; // Only count unassigned
                if (selectedMaterial && s.materialType !== selectedMaterial) return false;
                if (selectedBitola && s.bitola !== selectedBitola) return false;
                return true;
            });

            if (matchingUnassigned.length > 0) {
                const capacityPerRow = 28; // Standard pyramid base 7

                // Group by unique "Material + Bitola" to determine sets of rows needed
                const groups: Record<string, { count: number, material: string, bitola: string }> = {};

                matchingUnassigned.forEach(s => {
                    const key = `${s.materialType}|${s.bitola}`;
                    if (!groups[key]) {
                        groups[key] = { count: 0, material: s.materialType, bitola: s.bitola };
                    }
                    groups[key].count++;
                });

                Object.values(groups).forEach(({ count: unassignedCount, material, bitola }) => {
                    let prefix = '';
                    if (material === 'Fio Máquina') prefix += 'FM';
                    else if (material === 'CA-60') prefix += 'CA';
                    else prefix += 'Geral';
                    prefix += ` ${bitola}`;

                    // Helper for capacity calculation
                    const getCapacity = (base: number, height: number) => {
                        let cap = 0;
                        // Valid levels are 0 to height-1
                        // Level 0 size = base. Level 1 = base-1.
                        for (let h = 0; h < height; h++) {
                            const layerSize = base - h;
                            if (layerSize > 0) cap += layerSize;
                        }
                        return cap;
                    };

                    // 1. Find Existing Rows matching Prefix
                    const relevantExistingRows = Array.from(allRows).filter(r => r.startsWith(prefix));

                    let totalFreeSlots = 0;

                    relevantExistingRows.forEach(rName => {
                        // Get config from prop/state - respecting user customizations
                        const config = rowConfigs.find(rc => rc.rowName === rName);

                        // Default Determinations matching PyramidRow logic
                        let defH = 4;
                        if (rName.includes('CA') && !rName.includes('50') && !rName.includes('Fio')) defH = 3;

                        const base = config?.baseSize || 7;
                        const height = config?.maxHeight || defH;

                        const capacity = getCapacity(base, height);

                        // Count items physically in this row
                        const assignedCount = safeStock.filter(s => s.location && s.location.startsWith(rName)).length;

                        if (capacity > assignedCount) {
                            totalFreeSlots += (capacity - assignedCount);
                        }
                    });

                    let remainingItems = unassignedCount - totalFreeSlots;

                    // 2. If remaining items > 0, we need NEW rows.
                    if (remainingItems > 0) {
                        // Defaults for NEW rows
                        let defH = 4;
                        if (material === 'CA-60') defH = 3;
                        const defBase = 7;
                        const defCap = getCapacity(defBase, defH);

                        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

                        // Try to find next available names
                        for (let i = 0; i < 50; i++) {
                            const char = alphabet[i] || `Z${i}`;
                            const candidate = `${prefix} ${char}`.trim();

                            if (!allRows.has(candidate)) {
                                allRows.add(candidate);
                                remainingItems -= defCap;
                                if (remainingItems <= 0) break;
                            }
                        }
                    }
                });
            }
        }

        const sortedAll = Array.from(allRows).sort();

        // 3. Filter them based on selection (Standard View Logic)
        if (!selectedMaterial && !selectedBitola) return sortedAll;

        return sortedAll.filter(rowName => {
            // Check contents
            const itemsInRow = safeStock.filter(s => s.location && s.location.startsWith(rowName));
            if (itemsInRow.length > 0) {
                const hasMatchingItem = itemsInRow.some(item => {
                    let matchMat = true;
                    let matchBit = true;
                    if (selectedMaterial) matchMat = item.materialType === selectedMaterial;
                    if (selectedBitola) matchBit = item.bitola === selectedBitola;
                    return matchMat && matchBit;
                });
                if (hasMatchingItem) return true;
                return false;
            }

            // If Empty Row: Check Name Convention
            const { isFM, isCA, bitola } = getRowTypeInfo(rowName);
            if (selectedMaterial === 'Fio Máquina' && !isFM && !rowName.includes('Fileira')) return false; // "Fileira" is generic
            if (selectedMaterial === 'CA-60' && !isCA && !rowName.includes('Fileira')) return false;
            if (selectedBitola && bitola && bitola !== selectedBitola) return false;

            return true;
        });
    }, [safeStock, extraRows, selectedMaterial, selectedBitola, rowConfigs]);

    // Initial filter sync once derivedRows are ready
    useEffect(() => {
        if (derivedRows.length > 0) {
            // Auto-switch if current row is not in visible set or nothing selected
            if (!activeRow || !derivedRows.includes(activeRow)) {
                setActiveRow(derivedRows[0]);
            }
        } else {
            setActiveRow(null);
        }
    }, [derivedRows, activeRow]);

    const handleAddRow = () => {
        // Use suggestion or manual input
        const nameToUse = newRowName.trim();
        if (!nameToUse) return;

        // Check duplication
        // We check derivedRows AND full stock because we might be creating a name hidden by filter (bad practice but safe)
        const exists = safeStock.some(s => s.location && s.location.startsWith(nameToUse)) || extraRows.includes(nameToUse);

        if (!exists) {
            setExtraRows(prev => [...prev, nameToUse]);
            // Recalculate suggestion for NEXT add
            // We can't easily force trigger Effect, but next render will fix it or we can just append logic
        } else {
            alert('Esta fileira já existe!');
        }
    };

    // Sync filters with Active Row context
    useEffect(() => {
        if (!activeRow) return;

        const { isFM, isCA, bitola } = getRowTypeInfo(activeRow);

        if (isFM) setSelectedMaterial('Fio Máquina');
        else if (isCA) setSelectedMaterial('CA-60');

        if (bitola) {
            setSelectedBitola(bitola as Bitola);
        } else {
            // If row is generic, maybe clear bitola filter? 
            setSelectedBitola(null);
        }

    }, [activeRow]);

    // PRE-CALCULATE Forecast/FIFO items outside the render loop (FIX HOOK VIOLATION)
    const itemsForThisRow = useMemo(() => {
        const targetRowName = activeRow || (derivedRows.length > 0 ? derivedRows[0] : null);
        if (!targetRowName) return [];

        const itemsInRowRaw = safeStock.filter(s => s.location === targetRowName || (s.location && s.location.startsWith(targetRowName + ':')));
        const config = rowConfigs.find(rc => rc.rowName === targetRowName);

        if (!isForecastMode) return itemsInRowRaw;

        // FIFO TRANSFORMATION logic
        // 1. Identify all rows that belong to this material/bitola context to distribute stock
        const forecastRows = derivedRows.filter(rName => {
            const { isFM, isCA, bitola } = getRowTypeInfo(rName);
            let matchMat = true;
            let matchBit = true;
            if (selectedMaterial === 'Fio Máquina') matchMat = isFM;
            if (selectedMaterial === 'CA-60') matchMat = isCA;
            if (selectedBitola) matchBit = bitola === selectedBitola;
            return matchMat && matchBit;
        });

        const currentRowIdx = forecastRows.indexOf(targetRowName);
        if (currentRowIdx === -1) return [];

        // 2. Get ALL candidates correctly
        // Helper to extract numerical part of lot ID for reliable sorting
        const getLotNum = (lot: string) => {
            const m = lot.match(/\d+/);
            return m ? parseInt(m[0]) : 0;
        };

        // Sort: OLDEST first (Priority #1 is the oldest/smallest number)
        const availableStock = safeStock
            .filter(s => {
                const matMatch = !selectedMaterial || s.materialType === selectedMaterial;
                const bitMatch = !selectedBitola || s.bitola === selectedBitola;
                return s.status === 'Disponível' && matMatch && bitMatch;
            })
            .sort((a, b) => getLotNum(a.internalLot) - getLotNum(b.internalLot));

        // 3. LOGICA LATERAL: Determine how many items reach THIS specific row
        const getCapacity = (base: number, h: number) => {
            let cap = 0;
            for (let i = 0; i < h; i++) {
                const layerSize = base - i;
                if (layerSize > 0) cap += layerSize;
            }
            return cap;
        };

        let itemsConsumedBeforeThisRow = 0;
        for (let i = 0; i < currentRowIdx; i++) {
            const rName = forecastRows[i];
            const rConf = rowConfigs.find(rc => rc.rowName === rName);
            const rBase = rConf?.baseSize || 7;
            const rHeight = rConf?.maxHeight || (rName.includes('CA') ? 3 : 4);
            itemsConsumedBeforeThisRow += getCapacity(rBase, rHeight);
        }

        const baseSize = config?.baseSize || 7;
        const maxHeight = config?.maxHeight || (targetRowName.includes('CA') ? 3 : 4);
        const rowCapacity = getCapacity(baseSize, maxHeight);

        // Get slice for this row
        const sorted = availableStock.slice(itemsConsumedBeforeThisRow, itemsConsumedBeforeThisRow + rowCapacity);
        if (sorted.length === 0) return [];

        // 4. ASSIGNMENT: Fill Bottom-Up (Ground First) as per visual drawing (Red 1, 2, 3 at L0)
        // Global Ranking starts from #1 on the ground.
        const results: StockItem[] = [];
        let itemCursor = 0;

        // Loop through levels from 0 up to maxHeight-1
        for (let l = 0; l < maxHeight; l++) {
            const layerCapacity = Math.max(0, baseSize - l);
            const countToFill = Math.min(sorted.length - itemCursor, layerCapacity);
            if (countToFill <= 0) break;

            for (let p = 0; p < countToFill; p++) {
                const item = sorted[itemCursor];
                const rank = itemsConsumedBeforeThisRow + itemCursor + 1;

                results.push({
                    ...item,
                    internalLot: `[#${rank}] ${item.internalLot}`,
                    location: `${targetRowName}:L${l}:P${p}`
                });
                itemCursor++;
            }
        }

        return results;
    }, [safeStock, activeRow, derivedRows, isForecastMode, rowConfigs, selectedMaterial, selectedBitola]);

    const handleDropOnRow = (item: StockItem, rowName: string) => {
        // 1. Strict Validation based on Row Name Convention
        const { isFM, isCA, bitola } = getRowTypeInfo(rowName);

        if (isFM && item.materialType !== 'Fio Máquina') {
            alert(`Esta fileira é exclusiva para Fio Máquina. O item é ${item.materialType}.`);
            return;
        }
        if (isCA && item.materialType !== 'CA-60') {
            alert(`Esta fileira é exclusiva para CA-60. O item é ${item.materialType}.`);
            return;
        }
        if (bitola && item.bitola !== bitola) {
            alert(`Esta fileira é exclusiva para bitola ${bitola}mm. O item é ${item.bitola}mm.`);
            return;
        }


        // Validation: Verify if the proposed location is different from the current one
        let validLocation = rowName;
        // Check if item.location is already a specific slot in this row
        if (item.location && item.location.startsWith(rowName + ':')) {
            validLocation = item.location;
        }

        // Find the original item to compare
        const originalItem = safeStock.find(s => s.id === item.id);

        // If the location hasn't changed, don't update/spam history
        if (originalItem && originalItem.location === validLocation) return;

        onUpdateStockItem({
            ...item,
            location: validLocation, // Use the correct validLocation (with coords if present)
            history: [...(item.history || []), {
                type: 'Movimentação Mapa',
                date: new Date().toISOString(),
                details: {
                    from: item.location || 'Não Atribuído',
                    to: validLocation,
                    action: 'Arrastado no Mapa'
                }
            }]
        });

        // Mobile UX: If we were moving an item, clear the selection
        if (itemToMove?.id === item.id) {
            setItemToMove(null);
        }

        // Construction Mode UX: Only clear slot if we just filled it
        if (activeSlot && validLocation === `${activeSlot.row}:L${activeSlot.l}:P${activeSlot.p}`) {
            setActiveSlot(null);
        }
    };

    const handleRenameRow = (oldName: string, newName: string) => {
        if (!newName || newName === oldName) return;

        // Find all items in this row
        const itemsToUpdate = safeStock.filter(s => s.location === oldName || (s.location && s.location.startsWith(oldName + ':')));

        itemsToUpdate.forEach(item => {
            let newLoc = item.location || '';
            if (newLoc === oldName) {
                newLoc = newName;
            } else if (newLoc.startsWith(oldName + ':')) {
                newLoc = newLoc.replace(oldName + ':', newName + ':');
            }

            onUpdateStockItem({
                ...item,
                location: newLoc,
                history: [...(item.history || []), {
                    type: 'Renomear Fileira',
                    date: new Date().toISOString(),
                    details: { from: oldName, to: newName, action: 'Rename Row' }
                }]
            });
        });

        // Update extraRows if it was an empty row
        if (extraRows.includes(oldName)) {
            setExtraRows(prev => prev.map(r => r === oldName ? newName : r));
        }
    };

    const handleSwap = (itemA: StockItem, itemB: StockItem) => {
        // Swap locations
        const locA = itemA.location;
        const locB = itemB.location;

        // Update A to B's location
        onUpdateStockItem({
            ...itemA,
            location: locB,
            history: [...(itemA.history || []), {
                type: 'Troca de Posição',
                date: new Date().toISOString(),
                details: { from: locA || '?', to: locB || '?', action: 'Swap' }
            }]
        });

        // Update B to A's location
        onUpdateStockItem({
            ...itemB,
            location: locA,
            history: [...(itemB.history || []), {
                type: 'Troca de Posição',
                date: new Date().toISOString(),
                details: { from: locB || '?', to: locA || '?', action: 'Swap' }
            }]
        });

        setItemToMove(null);
    };

    // We DO NOT close the drawer here anymore to allow "Rapid Fire" adding on mobile.
    // User closes drawer manually when done.
    if (window.innerWidth < 768 && !itemToMove) { // Only close if coming from drawer, keep open if rapid? Actually let's keep it open.
        // setIsPendingListOpen(false);
    }

    // Keep activeRow active for rapid fire!
    // setActiveRow(null);


    const handleRemoveFromRow = (item: StockItem) => {
        onUpdateStockItem({
            ...item,
            location: null // Remove location, goes back to unassigned
        });
    };

    const handleRemoveRow = (rowName: string) => {
        // Only if empty?
        // Or unassign all items in it? Let's check if empty.
        // FIX: Check for both exact row name AND items with coordinates in that row
        const hasItems = safeStock.some(s => s.location === rowName || (s.location && s.location.startsWith(rowName + ':')));

        if (hasItems) {
            if (!confirm(`A ${rowName} contém itens. Deseja remover a fileira e mover os itens para "Não Atribuído"?`)) {
                return;
            }
            // Move items - filtering correctly for coordinates too
            safeStock.filter(s => s.location === rowName || (s.location && s.location.startsWith(rowName + ':')))
                .forEach(item => {
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
    const mappedCount = relevantStock.filter(s => !!s.location).length;
    const unmappedCount = totalCount - mappedCount;
    const progressPercentage = totalCount === 0 ? 0 : Math.round((mappedCount / totalCount) * 100);

    const [forceLandscape, setForceLandscape] = useState(false);

    return (
        <div className={`fixed inset-0 bg-slate-100 z-50 md:static md:z-0 md:h-[calc(100vh-140px)] md:w-full md:rounded-xl md:border md:border-slate-200 md:shadow-lg flex flex-col animate-fadeIn transition-all duration-500 ${forceLandscape ? 'w-[100vh] h-[100vw] rotate-90 origin-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}`}>
            {/* Fullscreen Landscape Overlay (Row Specific) - Hide if global landscape is on? Or keep? Keep. */}
            {landscapeRow && (
                <div className="fixed inset-0 z-[60] bg-slate-900 text-white flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center w-[100vh] h-[100vw] origin-center -rotate-90 top-[calc(50%-50vw)] left-[calc(50%-50vh)]">
                        {/* Wrapper for landscape content content */}
                        <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-slate-100 relative">
                            <button
                                onClick={() => setLandscapeRow(null)}
                                className="absolute top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg z-50 text-lg flex items-center gap-2"
                            >
                                ✕ <span className="opacity-90">FECHAR</span>
                            </button>

                            <h2 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-4 border-b pb-4 w-full justify-center">
                                <ArchiveIcon className="w-10 h-10 text-emerald-600" />
                                {landscapeRow}
                            </h2>

                            {/* Use PyramindRow inside here but scaled up logic */}
                            {(() => {
                                const rowItems = relevantStock.filter(s => s.location && s.location.startsWith(landscapeRow + ':'));

                                // Pyramid Logic Redux
                                const baseSize = 7; // Bigger base for landscape
                                const levels: StockItem[][] = [];
                                let currentIndex = 0;
                                let currentCapacity = baseSize;
                                if (rowItems.length > 0) {
                                    while (currentIndex < rowItems.length) {
                                        const capacity = Math.max(1, currentCapacity);
                                        levels.push(rowItems.slice(currentIndex, currentIndex + capacity));
                                        currentIndex += capacity;
                                        currentCapacity--;
                                    }
                                }

                                return (
                                    <div className="flex flex-col-reverse items-center justify-end gap-2 p-12 overflow-y-auto w-full h-full pb-32">
                                        {levels.map((levelItems, lvlIdx) => (
                                            <div key={lvlIdx} className="flex justify-center gap-2 mb-2">
                                                {levelItems.map(item => (
                                                    <div key={item.id} className="w-24 h-24 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold shadow-2xl border-4 border-white transform hover:scale-105 transition">
                                                        <div className="text-center leading-tight">
                                                            <div className="text-emerald-300 text-sm">{item.internalLot}</div>
                                                            <div className="opacity-70 scale-90 text-xs">{(item.remainingQuantity || 0).toFixed(0)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        {rowItems.length === 0 && <p className="text-slate-400 text-3xl mt-20">Vazio</p>}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}
            {/* Main Header */}
            {/* Main Header - Collapsible on Mobile */}
            <div className={`bg-[#0F3F5C] text-white shadow-md z-30 transition-all duration-300 ${isHeaderCollapsed ? 'p-1 md:p-3' : 'p-3 md:p-4'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-3">
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-white/80 hover:text-white">
                            <ArrowLeftIcon className="w-4 h-4 md:w-6 md:h-6" />
                        </button>
                        <div>
                            <h1 className="text-xs md:text-xl font-bold flex items-center gap-1.5 leading-none">
                                <ArchiveIcon className="w-4 h-4 md:w-6 md:h-6" />
                                <span className="hidden sm:inline">Mapeamento de Estoque</span>
                                <span className="sm:hidden">Estoque</span>
                            </h1>
                            <div className="md:hidden flex items-center gap-1.5 mt-0.5 px-0.5">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] text-white/60 uppercase font-black tracking-widest">{activeRow}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Toggle Controls for Mobile */}
                        <button
                            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                            className="md:hidden p-1.5 bg-white/10 rounded-lg text-white"
                        >
                            <SearchIcon className="w-3.5 h-3.5" />
                        </button>

                        {/* Rotated Landscape Toggle */}
                        <button
                            onClick={() => setForceLandscape(!forceLandscape)}
                            className={`p-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 transition ${forceLandscape ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white'}`}
                            title="Girar Tela"
                        >
                            <ChartBarIcon className="w-4 h-4 rotate-90" />
                            <span className="hidden sm:inline">{forceLandscape ? 'Normal' : 'Girar'}</span>
                        </button>

                        <button
                            onClick={() => setIsForecastMode(!isForecastMode)}
                            className={`p-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 transition shadow-lg ${isForecastMode ? 'bg-amber-500 text-white animate-pulse ring-2 ring-white/50' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Previsão de Estoque (FIFO)"
                        >
                            <span className="text-sm">✨</span>
                            <span className="hidden sm:inline">{isForecastMode ? 'Visão Real' : 'Previsão FIFO'}</span>
                            <span className="sm:hidden">FIFO</span>
                        </button>
                    </div>
                </div>

                {/* Filters - Expandable on Mobile */}
                <div className={`
                    flex flex-col md:flex-row gap-2 w-full md:w-auto mt-4 transition-all duration-300 overflow-hidden
                    ${isHeaderCollapsed ? 'max-h-0 md:max-h-40 opacity-0 md:opacity-100 mb-0' : 'max-h-40 opacity-100 mb-2'}
                `}>
                    <div className="grid grid-cols-2 md:flex gap-2">
                        <select
                            value={selectedMaterial || ''}
                            onChange={e => setSelectedMaterial(e.target.value ? e.target.value as MaterialType : null)}
                            className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none w-full"
                        >
                            <option value="" className="text-slate-800">Todos Materiais</option>
                            {MaterialOptions.map(m => <option key={m} value={m} className="text-slate-800">{m}</option>)}
                        </select>

                        <select
                            value={selectedBitola || ''}
                            onChange={e => setSelectedBitola(e.target.value ? e.target.value as Bitola : null)}
                            className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:bg-[#0A2A3D] focus:ring-1 focus:ring-emerald-500 outline-none w-full"
                        >
                            <option value="" className="text-slate-800">Todas Bitolas</option>
                            {availableBitolas.map(b => <option key={b} value={b} className="text-slate-800">{b}</option>)}
                        </select>
                    </div>

                    {/* Progress Bar (Header) */}
                    <div className="hidden md:flex flex-col justify-center ml-4 border-l border-white/10 pl-4">
                        <div className="flex justify-between text-[10px] mb-1 opacity-70">
                            <span>PROGRESSO</span>
                            <span>{progressPercentage}%</span>
                        </div>
                        <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* New Layout: Top Bar (Tabs) + Main Content (Single Row) */}
            <div className="flex flex-col h-full overflow-hidden bg-slate-50">
                {/* Top Tab Bar & Actions */}
                <div className="bg-white border-b flex items-center gap-1.5 px-2 py-1 min-h-[2.2rem] md:min-h-[3.5rem] shrink-0 shadow-sm z-30 h-auto overflow-x-auto no-scrollbar">

                    {/* Global Actions HUB (Replacing Floating Badges) */}
                    <div className={`md:hidden fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 transition-all duration-500 ${!isHeaderCollapsed ? 'scale-0 translate-y-20' : 'scale-100 translate-y-0'}`}>
                        {itemToMove && (
                            <button
                                onClick={() => setItemToMove(null)}
                                className="bg-white text-rose-600 px-4 py-2 rounded-full shadow-lg font-black text-[10px] uppercase tracking-widest border-2 border-rose-100 flex items-center gap-2 animate-in slide-in-from-right-4"
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                Cancelar Movimentação
                            </button>
                        )}

                        <div className="flex items-center gap-3">
                            {(itemToMove || activeSlot) && (
                                <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-xl font-bold text-xs animate-in slide-in-from-right-6 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                                    <span>{itemToMove ? 'Toque noutra vaga' : 'Selecione um lote'}</span>
                                </div>
                            )}

                            <button
                                onClick={() => setIsPendingListOpen(true)}
                                className={`
                                    w-16 h-16 rounded-[2rem] shadow-2xl flex items-center justify-center transition-all active:scale-90 relative
                                    ${activeSlot || itemToMove ? 'bg-emerald-500 text-white animate-pulse' : (unassignedStock.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300')}
                                    border-4 border-white
                                `}
                            >
                                {activeSlot && !itemToMove ? <span className="text-3xl animate-bounce">⬇</span> : (itemToMove ? <span className="text-3xl">⇄</span> : <PlusIcon className="w-9 h-9" />)}

                                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                                    {unassignedStock.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Row Tabs */}
                    <div className="flex-1 flex overflow-x-auto no-scrollbar items-center gap-2 w-full scroll-smooth py-1">
                        {/* Auto-Generated Rows Only */}
                        {derivedRows.length === 0 && <span className="text-slate-400 text-xs italic whitespace-nowrap">Sem fileiras...</span>}

                        {derivedRows.map(rName => {
                            const isSelected = (activeRow === rName) || (!activeRow && rName === derivedRows[0]);
                            const count = relevantStock.filter(s => s.location && s.location.startsWith(rName)).length;

                            return (
                                <button
                                    key={rName}
                                    onClick={() => setActiveRow(rName)}
                                    className={`
                                        relative group flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] md:text-sm font-black transition-all whitespace-nowrap
                                        ${isSelected
                                            ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105 z-10'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                                        }
                                    `}
                                >
                                    {rName}
                                    <span className={`text-[8px] px-1 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>{count}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">


                    {/* Main Canvas Area */}
                    <div
                        className="flex-1 overflow-auto p-4 md:p-12 relative flex flex-col items-center no-scrollbar"
                        style={{
                            backgroundImage: `linear-gradient(to bottom, rgba(241, 245, 249, 0.85), rgba(241, 245, 249, 0.92)), url(/industrial-bg.png)`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundAttachment: 'fixed',
                            scrollBehavior: 'smooth'
                        }}
                    >
                        {/* Global Actions HUB (Floating Bottom Right) */}
                        <div className="fixed bottom-8 right-8 z-[70] flex flex-col items-end gap-3 scale-110">
                            {itemToMove && (
                                <button
                                    onClick={() => setItemToMove(null)}
                                    className="bg-white text-rose-600 px-5 py-2.5 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest border-2 border-rose-100 flex items-center gap-2 animate-bounce"
                                >
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    Cancelar Movimentação
                                </button>
                            )}

                            <button
                                onClick={() => setIsPendingListOpen(true)}
                                className={`
                                    group flex items-center gap-3 bg-slate-900 text-white pl-6 pr-2 py-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all
                                    ${(activeSlot || itemToMove) ? 'ring-4 ring-emerald-500 animate-pulse' : 'ring-4 ring-white/10'}
                                `}
                            >
                                <span className="font-black text-sm uppercase tracking-widest opacity-90">
                                    {activeSlot ? 'Confirmar Vaga' : (itemToMove ? 'Soltar Item' : 'Adicionar Lotes')}
                                </span>
                                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-inner relative">
                                    {activeSlot ? <span className="text-2xl">⬇</span> : (itemToMove ? <span className="text-2xl">⇄</span> : <PlusIcon className="w-7 h-7" />)}
                                    {unassignedStock.length > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                                            {unassignedStock.length}
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>

                        {/* Smart Overlay for Pending List (MODAL STYLE) */}
                        {isPendingListOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setIsPendingListOpen(false)}></div>

                                <div className="relative bg-white w-full max-w-2xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                                    {/* Drawer Header */}
                                    <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-black text-slate-900 flex items-center gap-3 m-0 text-2xl tracking-tight">
                                                <ArchiveIcon className="w-8 h-8 text-amber-500" />
                                                Selecionar Lote
                                            </h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{unassignedStock.length} itens disponíveis para alocação</p>
                                        </div>
                                        <button onClick={() => setIsPendingListOpen(false)} className="w-12 h-12 hover:bg-slate-200 rounded-full text-slate-400 transition-colors flex items-center justify-center">
                                            <XIcon className="w-8 h-8" />
                                        </button>
                                    </div>

                                    <div className="p-6 border-b bg-white">
                                        <div className="relative">
                                            <SearchIcon className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar pelo lote..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full pl-12 p-4 bg-slate-100 border-none rounded-2xl text-lg font-medium focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-100/50 no-scrollbar">
                                        {unassignedStock.length === 0 ? (
                                            <div className="text-center py-20 opacity-30">
                                                <CheckCircleIcon className="w-24 h-24 text-emerald-500 mx-auto mb-4" />
                                                <p className="text-2xl font-black">Tudo organizado!</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {unassignedStock.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            if (activeSlot) {
                                                                const loc = `${activeSlot.row}:L${activeSlot.l}:P${activeSlot.p}`;
                                                                handleDropOnRow({ ...item, location: loc }, activeSlot.row);
                                                                setIsPendingListOpen(false); // Close on selection for desktop UX
                                                            } else {
                                                                setItemToMove(itemToMove?.id === item.id ? null : item);
                                                                setIsPendingListOpen(false);
                                                            }
                                                        }}
                                                        className={`bg-white p-5 rounded-3xl border-2 shadow-sm cursor-pointer hover:shadow-xl transition-all group ${itemToMove?.id === item.id ? 'border-amber-500 bg-amber-50 shadow-amber-200' : 'border-slate-100 hover:border-emerald-400'}`}
                                                    >
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-black text-xl text-slate-800 group-hover:text-emerald-700">{item.internalLot}</span>
                                                            <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full border border-slate-200 font-black text-slate-500">{item.bitola}mm</span>
                                                        </div>
                                                        <div className="text-sm text-slate-500 flex justify-between items-center border-t border-slate-50 pt-3">
                                                            <span className="font-bold uppercase tracking-tighter">{item.materialType}</span>
                                                            <span className="font-black text-slate-900 text-lg">{item.remainingQuantity} kg</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Overlay Controls */}
                        {isHeaderCollapsed && (
                            <div className="md:hidden fixed top-[4.5rem] left-3 z-40 bg-white/95 backdrop-blur shadow-xl border border-emerald-100 rounded-xl p-2.5 flex flex-col gap-1 animate-in slide-in-from-left-4 duration-500 min-w-[120px]">
                                <div className="flex items-center justify-between mb-0.5">
                                    <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">MAPA ATIVO</div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] font-black text-slate-800">{activeRow}</span>
                                    </div>
                                </div>
                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progressPercentage}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">{progressPercentage}% CONCLUÍDO</span>
                                    <span className="text-[8px] text-slate-500 font-mono tracking-tighter">{mappedCount}/{totalCount}</span>
                                </div>
                            </div>
                        )}
                        {isPendingListOpen && <div className="absolute inset-0 bg-black/20 z-30 md:hidden" onClick={() => setIsPendingListOpen(false)}></div>}
                        {selectedItemMenu && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden" onClick={() => setSelectedItemMenu(null)}></div>}

                        {/* Actual Row Render */}
                        {(() => {
                            const targetRowName = activeRow || derivedRows[0];
                            if (!targetRowName) {
                                return (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-20">
                                        <ArchiveIcon className="w-24 h-24 mb-4 opacity-50" />
                                        <h3 className="text-xl font-bold">Nenhuma Fileira Encontrada</h3>
                                        <p>Filtre por material e bitola para ver as fileiras sugeridas.</p>
                                    </div>
                                );
                            }

                            const config = rowConfigs.find(rc => rc.rowName === targetRowName);

                            return (
                                <div className={`w-full max-w-[98vw] animate-fadeIn transition-all duration-500 ${isForecastMode ? 'ring-8 ring-amber-500/20 rounded-[3rem]' : ''}`}>
                                    {isForecastMode && (
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-8 py-3 rounded-full font-black text-sm shadow-[0_15px_35px_rgba(245,158,11,0.4)] z-50 flex items-center gap-3 animate-in slide-in-from-top-4 duration-700">
                                            <span className="text-xl">✨</span>
                                            <div className="flex flex-col leading-tight">
                                                <span className="tracking-widest uppercase">MODO PREVISÃO FIFO</span>
                                                <span className="text-[9px] opacity-80 font-bold uppercase tracking-widest">Organização por Senioridade de Lote</span>
                                            </div>
                                        </div>
                                    )}
                                    <PyramidRow
                                        rowName={targetRowName}
                                        items={itemsForThisRow}
                                        config={config}
                                        isActive={true}
                                        onSetActive={() => { }}
                                        onDrop={(item) => !isForecastMode && handleDropOnRow(item, targetRowName)}
                                        onRemove={(item) => !isForecastMode && handleRemoveFromRow(item)}
                                        onRemoveRow={() => !isForecastMode && handleRemoveRow(targetRowName)}
                                        onRenameRow={(newName) => !isForecastMode && handleRenameRow(targetRowName, newName)}
                                        onItemClick={(item) => !isForecastMode && setSelectedItemMenu(item)}
                                        onSlotClick={(l, p) => {
                                            if (isForecastMode) return;
                                            setActiveSlot({ row: targetRowName, l, p });
                                            setIsPendingListOpen(true);
                                        }}
                                        onExpand={() => setLandscapeRow(targetRowName)}
                                        activeSlot={activeSlot?.row === targetRowName ? activeSlot : null}
                                        movingItem={isForecastMode ? null : itemToMove}
                                        onPrintRow={() => setPrintRowName(targetRowName)}
                                        onUpdateConfig={handleUpdateRowConfig}
                                        onMoveItem={(item) => !isForecastMode && setItemToMove(item)}
                                    />

                                    {itemsForThisRow.length === 0 && (
                                        <div className="text-center mt-8 p-8 border-2 border-dashed border-slate-300 rounded-xl bg-white/50">
                                            <p className="text-slate-500 font-bold mb-2">Fileira Vazia</p>
                                            <p className="text-sm text-slate-400">Arraste lotes da lista à esquerda para começar a preencher.</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Confirm Delete Modal */}
            {(itemToDelete || rowToDelete) && (
                <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-red-100 p-3 rounded-full mb-4">
                                <ExclamationIcon className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Confirmação</h3>
                            <p className="text-slate-600 mb-6">
                                {itemToDelete
                                    ? `Deseja remover o lote ${itemToDelete.internalLot} da fileira?`
                                    : `Deseja realmente excluir a fileira "${rowToDelete}"? Esta ação não pode ser desfeita.`
                                }
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => { setItemToDelete(null); setRowToDelete(null); }}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={() => {
                                        if (itemToDelete) {
                                            handleRemoveFromRow(itemToDelete);
                                            setItemToDelete(null);
                                        } else if (rowToDelete) {
                                            handleRemoveRow(rowToDelete);
                                            setRowToDelete(null);
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                                >
                                    EXCLUIR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {printRowName && (
                <div className="fixed inset-0 bg-white z-[100] p-8 flex flex-col items-center justify-center">
                    <div className="w-full max-w-4xl border-2 border-slate-800 p-8 relative print:border-none print:w-full">
                        <button onClick={() => setPrintRowName(null)} className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded print:hidden font-bold">FECHAR</button>
                        <button onClick={() => window.print()} className="absolute top-4 right-28 bg-blue-600 text-white px-4 py-2 rounded print:hidden font-bold">IMPRIMIR</button>

                        <h1 className="text-4xl font-bold text-center mb-8 border-b-2 border-black pb-4">{printRowName}</h1>

                        {(() => {
                            const rowItems = relevantStock.filter(s => s.location && s.location.startsWith(printRowName + ':'));
                            // Reconstruct levels for print
                            const baseSize = 7;
                            const levels: StockItem[][] = [];
                            let currentIndex = 0;
                            let currentCapacity = baseSize;
                            if (rowItems.length > 0) {
                                while (currentIndex < rowItems.length) {
                                    const capacity = Math.max(1, currentCapacity);
                                    levels.push(rowItems.slice(currentIndex, currentIndex + capacity));
                                    currentIndex += capacity;
                                    currentCapacity--;
                                }
                            }

                            return (
                                <div className="flex flex-col-reverse items-center gap-4">
                                    {levels.map((levelItems, lvlIdx) => (
                                        <div key={lvlIdx} className="flex justify-center gap-4">
                                            {levelItems.map(item => (
                                                <div key={item.id} className="w-24 h-24 rounded-full border-4 border-black flex flex-col items-center justify-center text-center p-1">
                                                    <span className="font-bold text-lg leading-none mb-1">{item.internalLot}</span>
                                                    <span className="text-sm">{(item.remainingQuantity || 0).toFixed(0)}kg</span>
                                                    <span className="text-xs italic">{item.bitola}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        <div className="mt-12 border-t pt-4 flex justify-between text-sm text-slate-500">
                            <span>Impressão: {new Date().toLocaleString()}</span>
                            <span>Total Itens: {relevantStock.filter(s => s.location && s.location.startsWith(printRowName + ':')).length}</span>
                        </div>
                    </div>
                </div>
            )}
            {/* Premium Item Actions Bottom Sheet (Mobile) */}
            <div className={`
                md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-[70] transition-all duration-500 transform
                ${selectedItemMenu ? 'translate-y-0' : 'translate-y-full'}
            `}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2"></div>

                {selectedItemMenu && (
                    <div className="p-8 pt-2">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">AÇÕES DO LOTE</span>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Lote {selectedItemMenu.internalLot}</h3>
                                <p className="text-slate-400 font-bold text-sm">{selectedItemMenu.materialType} • {selectedItemMenu.bitola}mm</p>
                            </div>
                            <button onClick={() => setSelectedItemMenu(null)} className="p-3 bg-slate-100 rounded-full text-slate-400">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={() => {
                                    setItemToMove(selectedItemMenu);
                                    setSelectedItemMenu(null);
                                }}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">✋</div>
                                    <div className="text-left">
                                        <div className="font-black text-lg">Mover Lote</div>
                                        <div className="text-white/80 text-xs font-bold">Relocar para outra vaga</div>
                                    </div>
                                </div>
                                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">→</div>
                            </button>

                            <button
                                onClick={() => {
                                    handleRemoveFromRow(selectedItemMenu);
                                    setSelectedItemMenu(null);
                                }}
                                className="w-full bg-white border-2 border-slate-100 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-2xl p-5 flex items-center justify-between transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 group-hover:bg-rose-100 rounded-xl flex items-center justify-center text-2xl">🗑️</div>
                                    <div className="text-left">
                                        <div className="font-black text-lg">Remover do Mapa</div>
                                        <div className="text-slate-400 text-xs font-bold italic">Retornar para lista de pendentes</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="mt-8 text-center">
                            <button onClick={() => setSelectedItemMenu(null)} className="text-slate-400 font-black text-xs uppercase tracking-widest">Cancelar Operação</button>
                        </div>
                    </div>
                )}
                <div className="h-10"></div>
            </div>

            {/* Closing divs for main layout */}
        </div>
    );
};

export default StockPyramidMap;
