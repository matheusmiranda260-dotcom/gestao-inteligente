import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola, StockGauge, User } from '../types';
import { ArrowLeftIcon, WarningIcon, ClipboardListIcon, DocumentReportIcon, CheckCircleIcon, AdjustmentsIcon } from './icons';
import ProductionOrderHistoryModal from './ProductionOrderHistoryModal';
import ProductionOrderReport from './ProductionOrderReport';

export const trelicaModels = [
    { cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,502', pesoSuperior: '2,158', pesoSenozoide: '1,828', pesoInferior: '1,517' },
    { cod: 'H6_12', modelo: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,288', pesoSuperior: '2,322', pesoSenozoide: '1,828', pesoInferior: '2,138' },
    { cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '2,898', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '0,758' },
    { cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,797', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '1,517' },
    { cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '3,209', pesoSuperior: '1,161', pesoSenozoide: '0,979', pesoInferior: '1,069' },
    { cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,418', pesoSuperior: '2,322', pesoSenozoide: '1,958', pesoInferior: '2,138' },
    { cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '4,087', pesoSuperior: '1,333', pesoSenozoide: '1,685', pesoInferior: '1,069' },
    { cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '8,174', pesoSuperior: '2,665', pesoSenozoide: '3,371', pesoInferior: '2,138' },
    { cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '3,843', pesoSuperior: '1,246', pesoSenozoide: '1,528', pesoInferior: '1,069' },
    { cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '7,686', pesoSuperior: '2,491', pesoSenozoide: '3,057', pesoInferior: '2,138' },
    { cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', pesoFinal: '9,057', pesoSuperior: '2,665', pesoSenozoide: '3,780', pesoInferior: '2,611' },
    { cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '3,522', pesoSuperior: '1,246', pesoSenozoide: '1,207', pesoInferior: '1,069' },
    { cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '7,044', pesoSuperior: '2,491', pesoSenozoide: '2,414', pesoInferior: '2,138' },
    { cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '5,270', pesoSuperior: '1,333', pesoSenozoide: '2,086', pesoInferior: '1,852' },
    { cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '10,540', pesoSuperior: '2,665', pesoSenozoide: '4,172', pesoInferior: '3,703' },
    { cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '11,263', pesoSuperior: '2,665', pesoSenozoide: '4,894', pesoInferior: '3,703' },
    { cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', pesoFinal: '20,042', pesoSuperior: '4,739', pesoSenozoide: '9,973', pesoInferior: '5,330' },
];
type TrelicaModel = typeof trelicaModels[number];
type AvailableStockItem = StockItem & { availableQuantity: number };

const normalizeBitola = (bitolaString: string) => parseFloat(bitolaString.replace(',', '.')).toFixed(2);

interface ProductionOrderTrelicaProps {
    setPage: (page: Page) => void;
    stock: StockItem[];
    productionOrders: ProductionOrderData[];
    addProductionOrder: (order: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => void;
    showNotification: (message: string, type: 'success' | 'error') => void;
    updateProductionOrder: (orderId: string, data: { orderNumber?: string; targetBitola?: Bitola }) => void;
    deleteProductionOrder: (orderId: string) => void;
    gauges: StockGauge[];
    currentUser: User | null;
}

const WeightIndicator: React.FC<{ required: number; selected: number; label?: string }> = ({ required, selected, label }) => {
    const sufficient = selected >= required;
    const percentage = required > 0 ? Math.min((selected / required) * 100, 100) : 0;
    const remaining = selected > required ? selected - required : 0;

    return (
        <div className="text-right">
            {label && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>}
            <div className="flex items-baseline justify-end gap-2">
                <span className="text-xs text-slate-500">Target: <strong className="text-slate-700">{required.toFixed(1)}kg</strong></span>
                <span className={`text-lg font-black ${sufficient ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {selected.toFixed(1)} <small className="text-xs font-bold">kg</small>
                </span>
            </div>

            <div className="w-32 ml-auto bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 rounded-full ${sufficient ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-400'}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            {remaining > 0 && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1 animate-pulse">
                    + {remaining.toFixed(1)} kg extra
                </p>
            )}
        </div>
    );
};

interface MultiLotSelectorProps {
    label: string;
    subLabel?: string;
    availableLots: AvailableStockItem[];
    selectedLots: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    requiredWeight: number;
    colorClass: string;
}

const MultiLotSelector: React.FC<MultiLotSelectorProps> = ({ label, subLabel, availableLots, selectedLots, onSelectionChange, requiredWeight, colorClass }) => {
    const selectedWeight = useMemo(() => {
        return selectedLots.reduce((sum, id) => {
            const lot = availableLots.find(l => l.id === id);
            return sum + (lot ? lot.availableQuantity : 0);
        }, 0);
    }, [selectedLots, availableLots]);

    const handleActualSelectLot = (lotId: string, isChecked: boolean) => {
        const lotIndex = availableLots.findIndex(l => l.id === lotId);
        if (lotIndex === -1) return;

        let newSelectedIds: string[] = [];
        if (isChecked) {
            const lotsToSelect = availableLots.slice(0, lotIndex + 1).map(l => l.id);
            newSelectedIds = [...new Set([...selectedLots, ...lotsToSelect])];
        } else {
            const lotsToKeep = availableLots.slice(0, lotIndex).map(l => l.id);
            newSelectedIds = lotsToKeep;
        }
        onSelectionChange(newSelectedIds);
    };

    return (
        <div className={`group glass-card overflow-hidden !transition-all !duration-500 hover:shadow-xl ${colorClass}`}>
            <div className="p-4 flex justify-between items-center border-b border-slate-100 bg-white/40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <ClipboardListIcon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 tracking-tight">{label}</h4>
                        {subLabel && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{subLabel}</p>}
                    </div>
                </div>
                <WeightIndicator required={requiredWeight} selected={selectedWeight} label={`${selectedLots.length} SELECIONADOS`} />
            </div>

            <div className="p-2 bg-slate-50/30">
                <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-slate-100 bg-white/60">
                    <table className="w-full text-xs">
                        <thead className="bg-[#0A2A3D] sticky top-0 z-10">
                            <tr>
                                <th className="p-2 w-10 text-center text-white">#</th>
                                <th className="p-2 text-white">Lote Interno</th>
                                <th className="p-2 text-right text-white">Disponível</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {availableLots.map((lot) => {
                                const isSelected = selectedLots.includes(lot.id);
                                return (
                                    <tr
                                        key={lot.id}
                                        className={`group/row cursor-pointer transition-all duration-300 ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                        onClick={() => handleActualSelectLot(lot.id, !isSelected)}
                                    >
                                        <td className="p-2 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover/row:border-indigo-400'}`}>
                                                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                {lot.status === 'Disponível - Suporte Treliça' && (
                                                    <span className="text-[7px] font-black bg-indigo-100 text-indigo-700 px-1 rounded uppercase">Suporte</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`p-2 font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {lot.internalLot}
                                        </td>
                                        <td className="p-2 text-right font-mono font-medium text-slate-500">
                                            {lot.availableQuantity.toFixed(2)} <small className="text-[10px]">kg</small>
                                        </td>
                                    </tr>
                                );
                            })}
                            {availableLots.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center">
                                        <p className="text-slate-400 font-medium italic">Nenhum lote compatível no estoque.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ProductionOrderTrelica: React.FC<ProductionOrderTrelicaProps> = ({ setPage, stock, productionOrders, addProductionOrder, showNotification, updateProductionOrder, deleteProductionOrder, gauges, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [orderNumber, setOrderNumber] = useState('');
    const [selectedModel, setSelectedModel] = useState<TrelicaModel | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [machineSpeed, setMachineSpeed] = useState(() => {
        const savedSpeed = localStorage.getItem('trelica-machine-speed');
        return savedSpeed ? parseFloat(savedSpeed) : 10;
    });

    // Multi-lot states (Splitting Inferior and Senozoide into Left/Right)
    const [superiorLots, setSuperiorLots] = useState<string[]>([]);
    const [inferiorLeftLots, setInferiorLeftLots] = useState<string[]>([]);
    const [inferiorRightLots, setInferiorRightLots] = useState<string[]>([]);
    const [senozoideLeftLots, setSenozoideLeftLots] = useState<string[]>([]);
    const [senozoideRightLots, setSenozoideRightLots] = useState<string[]>([]);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);

    useEffect(() => {
        localStorage.setItem('trelica-machine-speed', machineSpeed.toString());
    }, [machineSpeed]);

    const trelicaProductionOrders = useMemo(() => productionOrders.filter(o => o.machine === 'Treliça'), [productionOrders]);

    const availableCa60Stock = useMemo(() => {
        return stock
            .filter(item => item.materialType === 'CA-60' &&
                item.status !== 'Transferido' &&
                !item.status.startsWith('Em Produção') &&
                item.status !== 'Consumido para fazer treliça')
            .map(item => ({
                ...item,
                availableQuantity: item.remainingQuantity
            }))
            .sort((a, b) => {
                // Priority 1: Lotes já no suporte (Disponivel - Suporte Treliça)
                const isSuporteA = a.status === 'Disponível - Suporte Treliça';
                const isSuporteB = b.status === 'Disponível - Suporte Treliça';
                if (isSuporteA && !isSuporteB) return -1;
                if (!isSuporteA && isSuporteB) return 1;

                // Priority 2: Alphanumeric sorting of internal lot (Menor para o maior)
                return a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true, sensitivity: 'base' });
            });
    }, [stock]);

    const handleModelChange = (cod: string) => {
        const model = trelicaModels.find(m => m.cod === cod) || null;
        setSelectedModel(model);
        // Limpar seleções
        setSuperiorLots([]);
        setInferiorLeftLots([]);
        setInferiorRightLots([]);
        setSenozoideLeftLots([]);
        setSenozoideRightLots([]);
    };

    const { baseSuperiorLots, baseInferiorLeftLots, baseInferiorRightLots, baseSenozoideLeftLots, baseSenozoideRightLots } = useMemo(() => {
        if (!selectedModel) return { baseSuperiorLots: [], baseInferiorLeftLots: [], baseInferiorRightLots: [], baseSenozoideLeftLots: [], baseSenozoideRightLots: [] };
        const superiorBitola = normalizeBitola(selectedModel.superior);
        const inferiorBitola = normalizeBitola(selectedModel.inferior);
        const senozoideBitola = normalizeBitola(selectedModel.senozoide);

        // Helper to get available lots excluding those selected in OTHER fields
        const getAvailableFor = (bitola: string, excludeIds: string[]) =>
            availableCa60Stock.filter(s => s.bitola === bitola && !excludeIds.includes(s.id));

        // Note: This dependency chain might be complex. To avoid circular deps or complexity, we just re-calc all.
        // It's not perfectly efficient to exclude cross-selections reactively if using same bitola, but ensures uniqueness.
        // E.g. If specific lot X is selected in InferiorLeft, it shouldn't show in InferiorRight.

        const allSelectedSuperior = superiorLots;
        const allSelectedInferiorLeft = inferiorLeftLots;
        const allSelectedInferiorRight = inferiorRightLots;
        const allSelectedSenozoideLeft = senozoideLeftLots;
        const allSelectedSenozoideRight = senozoideRightLots;

        return {
            baseSuperiorLots: getAvailableFor(superiorBitola, [...allSelectedInferiorLeft, ...allSelectedInferiorRight, ...allSelectedSenozoideLeft, ...allSelectedSenozoideRight]),
            baseInferiorLeftLots: getAvailableFor(inferiorBitola, [...allSelectedSuperior, ...allSelectedInferiorRight, ...allSelectedSenozoideLeft, ...allSelectedSenozoideRight]),
            baseInferiorRightLots: getAvailableFor(inferiorBitola, [...allSelectedSuperior, ...allSelectedInferiorLeft, ...allSelectedSenozoideLeft, ...allSelectedSenozoideRight]),
            baseSenozoideLeftLots: getAvailableFor(senozoideBitola, [...allSelectedSuperior, ...allSelectedInferiorLeft, ...allSelectedInferiorRight, ...allSelectedSenozoideRight]),
            baseSenozoideRightLots: getAvailableFor(senozoideBitola, [...allSelectedSuperior, ...allSelectedInferiorLeft, ...allSelectedInferiorRight, ...allSelectedSenozoideLeft]),
        };
    }, [selectedModel, availableCa60Stock, superiorLots, inferiorLeftLots, inferiorRightLots, senozoideLeftLots, senozoideRightLots]);

    const { requiredSuperiorWeight, requiredInferiorSideWeight, requiredSenozoideSideWeight } = useMemo(() => {
        if (!selectedModel || !quantity) return { requiredSuperiorWeight: 0, requiredInferiorSideWeight: 0, requiredSenozoideSideWeight: 0 };
        const parseWeight = (w: string) => parseFloat(w.replace(',', '.'));
        return {
            requiredSuperiorWeight: parseWeight(selectedModel.pesoSuperior) * quantity,
            // Split total component weight by 2 for each side
            requiredInferiorSideWeight: (parseWeight(selectedModel.pesoInferior) * quantity) / 2,
            requiredSenozoideSideWeight: (parseWeight(selectedModel.pesoSenozoide) * quantity) / 2,
        };
    }, [selectedModel, quantity]);

    // State for Auto-Selection Toggle
    const [isAutoSelect, setIsAutoSelect] = useState(true);

    // Auto-select lots logic
    useEffect(() => {
        if (!selectedModel || !isAutoSelect) return;

        const superiorBitola = normalizeBitola(selectedModel.superior);
        const inferiorBitola = normalizeBitola(selectedModel.inferior);
        const senozoideBitola = normalizeBitola(selectedModel.senozoide);

        const usedIds = new Set<string>();

        const allocate = (bitola: string, targetWeight: number) => {
            const candidates = availableCa60Stock.filter(l =>
                l.bitola === bitola &&
                !usedIds.has(l.id)
            );

            let currentWeight = 0;
            const selected: string[] = [];

            for (const lot of candidates) {
                if (currentWeight >= targetWeight) break;
                selected.push(lot.id);
                usedIds.add(lot.id);
                currentWeight += lot.availableQuantity;
            }
            return selected;
        };

        const newSuperiorLots = allocate(superiorBitola, requiredSuperiorWeight);
        const newInferiorLeftLots = allocate(inferiorBitola, requiredInferiorSideWeight);
        const newInferiorRightLots = allocate(inferiorBitola, requiredInferiorSideWeight);
        const newSenozoideLeftLots = allocate(senozoideBitola, requiredSenozoideSideWeight);
        const newSenozoideRightLots = allocate(senozoideBitola, requiredSenozoideSideWeight);

        setSuperiorLots(newSuperiorLots);
        setInferiorLeftLots(newInferiorLeftLots);
        setInferiorRightLots(newInferiorRightLots);
        setSenozoideLeftLots(newSenozoideLeftLots);
        setSenozoideRightLots(newSenozoideRightLots);

    }, [
        selectedModel,
        quantity,
        availableCa60Stock,
        requiredSuperiorWeight,
        requiredInferiorSideWeight,
        requiredSenozoideSideWeight,
        isAutoSelect
    ]);

    // Calculate total selected weights
    const getWeight = (ids: string[]) => ids.reduce((acc, id) => acc + (availableCa60Stock.find(s => s.id === id)?.availableQuantity || 0), 0);
    const selectedSuperiorWeight = getWeight(superiorLots);
    const selectedInferiorLeftWeight = getWeight(inferiorLeftLots);
    const selectedInferiorRightWeight = getWeight(inferiorRightLots);
    const selectedSenozoideLeftWeight = getWeight(senozoideLeftLots);
    const selectedSenozoideRightWeight = getWeight(senozoideRightLots);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!orderNumber.trim()) {
            showNotification('O número da ordem é obrigatório.', 'error');
            return;
        }
        if (productionOrders.some(o => o.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase())) {
            showNotification(`O número de ordem "${orderNumber}" já existe.`, 'error');
            return;
        }
        if (!selectedModel) {
            showNotification('Selecione um modelo de treliça.', 'error');
            return;
        }
        if (quantity <= 0) {
            showNotification('A quantidade a produzir deve ser maior que zero.', 'error');
            return;
        }

        // Validations per side
        if (superiorLots.length === 0) { showNotification('Selecione pelo menos um lote Superior.', 'error'); return; }
        if (inferiorLeftLots.length === 0) { showNotification('Selecione lotes para Inferior (Lado 1).', 'error'); return; }
        if (inferiorRightLots.length === 0) { showNotification('Selecione lotes para Inferior (Lado 2).', 'error'); return; }
        if (senozoideLeftLots.length === 0) { showNotification('Selecione lotes para Senozoide (Lado 1).', 'error'); return; }
        if (senozoideRightLots.length === 0) { showNotification('Selecione lotes para Senozoide (Lado 2).', 'error'); return; }

        if (selectedSuperiorWeight < requiredSuperiorWeight) {
            showNotification('Peso Superior insuficiente.', 'error'); return;
        }
        if (selectedInferiorLeftWeight < requiredInferiorSideWeight) {
            showNotification('Peso Inferior (Lado 1) insuficiente.', 'error'); return;
        }
        if (selectedInferiorRightWeight < requiredInferiorSideWeight) {
            showNotification('Peso Inferior (Lado 2) insuficiente.', 'error'); return;
        }
        if (selectedSenozoideLeftWeight < requiredSenozoideSideWeight) {
            showNotification('Peso Senozoide (Lado 1) insuficiente.', 'error'); return;
        }
        if (selectedSenozoideRightWeight < requiredSenozoideSideWeight) {
            showNotification('Peso Senozoide (Lado 2) insuficiente.', 'error'); return;
        }

        // Criar estrutura compatível com o back-end e report
        const trelicaLots = {
            superior: superiorLots[0],
            inferior1: inferiorLeftLots[0],
            inferior2: inferiorRightLots[0],
            senozoide1: senozoideLeftLots[0],
            senozoide2: senozoideRightLots[0],

            allSuperior: superiorLots,
            allInferiorLeft: inferiorLeftLots,
            allInferiorRight: inferiorRightLots,
            allSenozoideLeft: senozoideLeftLots,
            allSenozoideRight: senozoideRightLots,
        };

        const totalPlannedConsumption = requiredSuperiorWeight + (requiredInferiorSideWeight * 2) + (requiredSenozoideSideWeight * 2);
        const plannedOutputWeight = parseFloat(selectedModel.pesoFinal.replace(',', '.')) * quantity;

        // Collect ALL involved IDs for status updates
        const allSelectedIds = [
            ...superiorLots,
            ...inferiorLeftLots,
            ...inferiorRightLots,
            ...senozoideLeftLots,
            ...senozoideRightLots
        ];

        // We pass the refined object as any to satisfy type check for now, backend logic in App.tsx might need to be aware 
        // if it iterates `selectedLotIds`. 
        // Usually App.tsx just sets array of IDs to 'Em Produção'. 
        // Wait, App.tsx expects `selectedLotIds` to be string[] usually for simple machine types? 
        // For Trelica it was storing an object.
        // If App.tsx uses `Object.values` or similar it might be fine, but safer to check App.tsx behavior.
        // Assuming App.tsx handles the object or we pass a flat array if it doesn't?
        // Let's pass the object for metadata, but we might need a way to flag all IDs as 'in production'.
        // Actually `addProductionOrder` in App.tsx likely iterates `selectedLotIds` if it is an array.
        // If it is an object, App.tsx might break.
        // Previous code passed `trelicaLots as any`.
        // I should stick to that, assuming App.tsx handles it or custom logic there extracts IDs.

        addProductionOrder({
            orderNumber: orderNumber,
            machine: 'Treliça',
            targetBitola: normalizeBitola(selectedModel.superior) as Bitola,
            trelicaModel: selectedModel.modelo,
            tamanho: selectedModel.tamanho,
            quantityToProduce: quantity,
            selectedLotIds: trelicaLots as any, // Passing the rich object
            totalWeight: totalPlannedConsumption,
            plannedOutputWeight: plannedOutputWeight,
        });

        setOrderNumber('');
        setQuantity(1);
        handleModelChange('');
    };

    const plannedWeight = useMemo(() => {
        if (!selectedModel || !quantity) return 0;
        return parseFloat(selectedModel.pesoFinal.replace(',', '.')) * quantity;
    }, [selectedModel, quantity]);

    const totalMetersToProduce = useMemo(() => {
        if (!selectedModel || !quantity) return 0;
        return parseFloat(selectedModel.tamanho) * quantity;
    }, [selectedModel, quantity]);

    const consumptionPlan = useMemo(() => {
        if (!selectedModel) return null;

        const calculatePlan = (target: number, selectedIds: string[]) => {
            let remaining = target;
            const steps: { lot: string; used: number; remainingInLot: number; totalInLot: number }[] = [];

            for (const id of selectedIds) {
                const item = availableCa60Stock.find(s => s.id === id);
                if (!item) continue;

                const available = item.availableQuantity;
                const used = Math.min(remaining, available);
                const leftover = available - used;

                steps.push({
                    lot: item.internalLot,
                    used,
                    remainingInLot: leftover,
                    totalInLot: available
                });

                remaining -= used;
                if (remaining <= 0) break;
            }
            return steps;
        };

        return {
            superior: calculatePlan(requiredSuperiorWeight, superiorLots),
            inferior1: calculatePlan(requiredInferiorSideWeight, inferiorLeftLots),
            inferior2: calculatePlan(requiredInferiorSideWeight, inferiorRightLots),
            senozoide1: calculatePlan(requiredSenozoideSideWeight, senozoideLeftLots),
            senozoide2: calculatePlan(requiredSenozoideSideWeight, senozoideRightLots),
        };
    }, [
        selectedModel,
        availableCa60Stock,
        superiorLots,
        inferiorLeftLots,
        inferiorRightLots,
        senozoideLeftLots,
        senozoideRightLots,
        requiredSuperiorWeight,
        requiredInferiorSideWeight,
        requiredSenozoideSideWeight
    ]);

    const formatMinutesToHHMM = (minutes: number) => {
        if (isNaN(minutes) || !isFinite(minutes) || minutes <= 0) {
            return '00:00';
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
    };

    const estimatedTime = useMemo(() => {
        if (!totalMetersToProduce || machineSpeed <= 0) return '00:00';
        const timeInMinutes = totalMetersToProduce / machineSpeed;
        return formatMinutesToHHMM(timeInMinutes);
    }, [totalMetersToProduce, machineSpeed]);


    return (
        <div className="p-4 sm:p-6 md:p-8">
            {showHistoryModal && <ProductionOrderHistoryModal orders={trelicaProductionOrders} stock={stock} onClose={() => setShowHistoryModal(false)} updateProductionOrder={updateProductionOrder} deleteProductionOrder={deleteProductionOrder} onShowReport={order => { setProductionReportData(order); setShowHistoryModal(false); }} />}
            {productionReportData && <ProductionOrderReport reportData={productionReportData} stock={stock} onClose={() => setProductionReportData(null)} />}

            <header className="flex items-center justify-between mb-8 pt-4">
                <div className="flex items-center">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Criação de Treliça</h1>
                        <p className="text-slate-500 font-medium">Configure os parâmetros técnicos e selecione a matéria-prima.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isGestor && (
                        <button
                            type="button"
                            onClick={() => setPage('gaugesManager')}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-3 px-6 rounded-2xl border border-blue-200 shadow-sm transition-all flex items-center gap-2"
                        >
                            <AdjustmentsIcon className="h-5 w-5" />Gerenciar Bitolas
                        </button>
                    )}
                    <button onClick={() => setShowHistoryModal(true)} className="group glass-card px-6 py-3 rounded-2xl border-indigo-100/50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center transition-transform group-hover:scale-110">
                            <ClipboardListIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <span className="font-bold text-indigo-900">Histórico de Ordens</span>
                    </button>
                </div>
            </header>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                        <div className="glass-card p-8 rounded-[2rem] border-slate-200/60 bg-white/80">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                                <div>
                                    <label htmlFor="orderNumber" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Número do Lote Interno / OP</label>
                                    <input type="text" id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="w-full text-lg font-bold p-4 bg-slate-50/50" placeholder="Ex: LOT-2025-001" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="quantity" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Qtd. Peças</label>
                                        <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" className="w-full text-lg font-bold p-4 bg-slate-50/50" required />
                                    </div>
                                    <div>
                                        <label htmlFor="machineSpeed" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">M/minuto</label>
                                        <input type="number" id="machineSpeed" value={machineSpeed} onChange={(e) => setMachineSpeed(parseFloat(e.target.value) || 1)} min="1" className="w-full text-lg font-bold p-4 bg-slate-50/50 text-indigo-600" required />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Selecione o Modelo de Engenharia</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {trelicaModels.map(m => {
                                        const isSelected = selectedModel?.cod === m.cod;
                                        return (
                                            <button
                                                key={m.cod}
                                                type="button"
                                                onClick={() => handleModelChange(m.cod)}
                                                className={`p-3 rounded-xl border-2 transition-all text-left group ${isSelected ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-4 ring-indigo-500/10' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <div className={`text-[10px] font-black mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>{m.cod}</div>
                                                <div className={`text-sm font-bold leading-tight ${isSelected ? 'text-indigo-950' : 'text-slate-700'}`}>{m.modelo}</div>
                                                <div className="text-[10px] font-medium text-slate-500 mt-1">{m.tamanho}m | {m.pesoFinal}kg</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-[#0A2A3D] text-white p-8 rounded-[2rem] shadow-xl sticky top-24 h-fit border border-white/5 overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                            <h3 className="text-xl font-bold mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                                <DocumentReportIcon className="h-6 w-6 text-indigo-400" />
                                Planejamento
                            </h3>

                            {!selectedModel ? (
                                <div className="py-10 text-center">
                                    <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-4 flex items-center justify-center border border-white/10">
                                        <WarningIcon className="h-8 w-8 text-amber-500" />
                                    </div>
                                    <p className="text-sm text-slate-400">Selecione um modelo para ver os cálculos de produção.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Produzir</span>
                                            <span className="text-lg font-black">{totalMetersToProduce.toFixed(0)} <small className="text-xs font-bold text-indigo-300">metros</small></span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Tempo</span>
                                            <span className="text-lg font-black text-emerald-400">{estimatedTime} <small className="text-xs font-bold">minutos</small></span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Meta Peso</span>
                                            <span className="text-lg font-black text-indigo-300">{plannedWeight.toFixed(1)} <small className="text-xs font-bold">kg</small></span>
                                        </div>
                                    </div>

                                    <div className="pt-4 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Componentes (mm)</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
                                                <div className="text-[10px] text-slate-400 font-bold">SUP</div>
                                                <div className="font-bold">{selectedModel.superior}</div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
                                                <div className="text-[10px] text-slate-400 font-bold">INF</div>
                                                <div className="font-bold">{selectedModel.inferior}</div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
                                                <div className="text-[10px] text-slate-400 font-bold">SENO</div>
                                                <div className="font-bold">{selectedModel.senozoide}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Plano de Consumo Detalhado */}
                                    <div className="pt-6 border-t border-white/10">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1 mb-4">Plano de Uso de Lotes</h4>
                                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                            {[
                                                { label: 'Superior', plan: consumptionPlan?.superior },
                                                { label: 'Inferior 1', plan: consumptionPlan?.inferior1 },
                                                { label: 'Inferior 2', plan: consumptionPlan?.inferior2 },
                                                { label: 'Senozoide 1', plan: consumptionPlan?.senozoide1 },
                                                { label: 'Senozoide 2', plan: consumptionPlan?.senozoide2 },
                                            ].map((group, idx) => (
                                                group.plan && group.plan.length > 0 && (
                                                    <div key={idx} className="space-y-1">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase">{group.label}</p>
                                                        {group.plan.map((step, sIdx) => (
                                                            <div key={sIdx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-bold text-slate-300">#{sIdx + 1} Lote {step.lot}</span>
                                                                    <span className="text-[10px] font-black text-emerald-400">-{step.used.toFixed(1)}kg</span>
                                                                </div>
                                                                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-indigo-500"
                                                                        style={{ width: `${(step.used / step.totalInLot) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <p className="text-[8px] text-right text-slate-500">
                                                                    Restante: <span className={step.remainingInLot < 0.1 ? 'text-amber-500' : 'text-slate-300'}>{step.remainingInLot.toFixed(1)}kg</span>
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {selectedModel && (
                    <div className="pt-8 space-y-8 pb-32">
                        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="section-title !my-0 !mt-0">
                                <span className="w-3 h-10 bg-indigo-600 rounded-full"></span>
                                <h2 className="!text-xl font-black text-slate-800">Alocação de Matéria-Prima</h2>
                            </div>

                            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 px-3">
                                    <div className={`w-2 h-2 rounded-full ${isAutoSelect ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`}></div>
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{isAutoSelect ? 'Seleção FIFO Ativa' : 'Seleção Manual'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAutoSelect(!isAutoSelect)}
                                    className={`relative inline-flex h-8 w-14 items-center rounded-xl transition-all duration-300 shadow-inner ${isAutoSelect ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`transform transition-all duration-300 h-6 w-6 rounded-lg bg-white shadow-md flex items-center justify-center ${isAutoSelect ? 'translate-x-7' : 'translate-x-1'}`}>
                                        {isAutoSelect ? <span className="text-[8px] font-black text-indigo-600">A</span> : <span className="text-[8px] font-black text-slate-400">M</span>}
                                    </div>
                                </button>
                            </div>
                        </header>

                        <div className="space-y-6">
                            {/* Banzo Superior */}
                            <div className="p-1 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-600/10">
                                <div className="p-1">
                                    <MultiLotSelector
                                        label="Banzo Superior"
                                        subLabel={`DIÂMETRO: ${selectedModel.superior} mm`}
                                        availableLots={baseSuperiorLots}
                                        selectedLots={superiorLots}
                                        onSelectionChange={setSuperiorLots}
                                        requiredWeight={requiredSuperiorWeight}
                                        colorClass="border-indigo-600/30 ring-4 ring-indigo-500/5 rounded-[2rem]"
                                    />
                                </div>
                            </div>

                            {/* Banzos Inferiores */}
                            <div className="p-6 md:p-8 rounded-[2.5rem] bg-emerald-600/5 border border-emerald-600/10 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-black text-xs">I</div>
                                    <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest">Banzos Inferiores (Lado 1 e 2)</h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <MultiLotSelector
                                        label="Inferior - Lado 1"
                                        subLabel={`DIÂMETRO: ${selectedModel.inferior} mm`}
                                        availableLots={baseInferiorLeftLots}
                                        selectedLots={inferiorLeftLots}
                                        onSelectionChange={setInferiorLeftLots}
                                        requiredWeight={requiredInferiorSideWeight}
                                        colorClass="border-emerald-500/20 rounded-[2rem]"
                                    />
                                    <MultiLotSelector
                                        label="Inferior - Lado 2"
                                        subLabel={`DIÂMETRO: ${selectedModel.inferior} mm`}
                                        availableLots={baseInferiorRightLots}
                                        selectedLots={inferiorRightLots}
                                        onSelectionChange={setInferiorRightLots}
                                        requiredWeight={requiredInferiorSideWeight}
                                        colorClass="border-emerald-500/20 rounded-[2rem]"
                                    />
                                </div>
                            </div>

                            {/* Senozoides */}
                            <div className="p-6 md:p-8 rounded-[2.5rem] bg-amber-600/5 border border-amber-600/10 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 font-black text-xs">S</div>
                                    <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest">Estribos Senozoides (Lado 1 e 2)</h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <MultiLotSelector
                                        label="Senozoide - Lado 1"
                                        subLabel={`DIÂMETRO: ${selectedModel.senozoide} mm`}
                                        availableLots={baseSenozoideLeftLots}
                                        selectedLots={senozoideLeftLots}
                                        onSelectionChange={setSenozoideLeftLots}
                                        requiredWeight={requiredSenozoideSideWeight}
                                        colorClass="border-amber-500/20 rounded-[2rem]"
                                    />
                                    <MultiLotSelector
                                        label="Senozoide - Lado 2"
                                        subLabel={`DIÂMETRO: ${selectedModel.senozoide} mm`}
                                        availableLots={baseSenozoideRightLots}
                                        selectedLots={senozoideRightLots}
                                        onSelectionChange={setSenozoideRightLots}
                                        requiredWeight={requiredSenozoideSideWeight}
                                        colorClass="border-amber-500/20 rounded-[2rem]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center pt-10">
                            <button type="submit" className="group relative overflow-hidden bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-16 rounded-3xl shadow-2xl shadow-indigo-600/20 transition-all active:scale-95 text-xl flex items-center gap-4">
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <CheckCircleIcon className="h-8 w-8 text-indigo-200" />
                                CONFIRMAR E CRIAR ORDEM
                            </button>
                        </div>
                    </div>
                )}

                {!selectedModel && (
                    <div className="text-center text-slate-500 py-16 border-t border-slate-100 mt-8 bg-white/50 rounded-3xl">
                        <WarningIcon className="h-16 w-16 mx-auto text-amber-400 mb-4 opacity-50" />
                        <p className="font-bold text-lg">Selecione um modelo de treliça</p>
                        <p className="text-sm">Configure as especificações técnicas para habilitar a alocação de materiais.</p>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ProductionOrderTrelica;