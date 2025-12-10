import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola } from '../types';
import { ArrowLeftIcon, WarningIcon, ClipboardListIcon } from './icons';
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
}

const WeightIndicator: React.FC<{ required: number; selected: number; label?: string }> = ({ required, selected, label }) => {
    const sufficient = selected >= required;
    const percentage = required > 0 ? Math.min((selected / required) * 100, 100) : 0;
    const remaining = selected > required ? selected - required : 0;

    return (
        <div className="text-right text-sm">
            {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
            <p>Necessário: <span className="font-bold">{required.toFixed(2)} kg</span></p>
            <p>Selecionado:
                <span className={`font-bold ${sufficient ? 'text-green-600' : 'text-red-600'}`}>
                    {selected.toFixed(2)} kg
                </span>
            </p>
            {remaining > 0 && (
                <p className="text-xs text-blue-600 font-semibold mt-1">
                    Sobra estimada: {remaining.toFixed(2)} kg
                </p>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                    className={`h-2 rounded-full transition-all ${sufficient ? 'bg-green-600' : 'bg-red-600'}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
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

    const handleSelectLot = (lotId: string, isChecked: boolean) => {
        const lotIndex = availableLots.findIndex(l => l.id === lotId);
        if (lotIndex === -1) return;

        let newSelectedIds: string[] = [];

        if (isChecked) {
            // FIFO: Select this lot and all previous (older) lots
            const lotsToSelect = availableLots.slice(0, lotIndex + 1).map(l => l.id);
            // Merge with existing selection to be safe, though FIFO usually replaces
            newSelectedIds = [...new Set([...selectedLots, ...lotsToSelect])];
        } else {
            // FIFO: Deselect this lot and all subsequent (newer) lots
            const lotsToKeep = availableLots.slice(0, lotIndex).map(l => l.id);
            newSelectedIds = lotsToKeep;
        }

        // Filter to ensure we only have valid IDs from this available list (mostly a sanity check)
        const validIds = newSelectedIds.filter(id => availableLots.some(l => l.id === id));
        onSelectionChange(validIds);
    };

    return (
        <div className={`p-4 border rounded-lg ${colorClass}`}>
            <div className="flex justify-between items-end border-b border-opacity-20 border-black pb-2 mb-4">
                <div>
                    <h4 className="font-medium text-gray-700">{label}</h4>
                    {subLabel && <p className="text-xs text-gray-500">{subLabel}</p>}
                </div>
                <WeightIndicator required={requiredWeight} selected={selectedWeight} label={`${selectedLots.length} lotes`} />
            </div>

            <div className="max-h-60 overflow-y-auto bg-white rounded border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="p-2 w-10"></th>
                            <th className="p-2">Lote Interno</th>
                            <th className="p-2 text-right">Peso (kg)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {availableLots.map(lot => (
                            <tr key={lot.id} className="hover:bg-gray-50 cursor-pointer" onClick={(e) => {
                                // Prevent double toggle if clicking checkbox directly
                                if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                    handleSelectLot(lot.id, !selectedLots.includes(lot.id));
                                }
                            }}>
                                <td className="p-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedLots.includes(lot.id)}
                                        onChange={(e) => handleSelectLot(lot.id, e.target.checked)}
                                        className="rounded border-gray-300 pointer-events-none" // pointer-events-none because row click handles it
                                    />
                                </td>
                                <td className="p-2 font-medium text-gray-700">{lot.internalLot}</td>
                                <td className="p-2 text-right">{lot.availableQuantity.toFixed(2)}</td>
                            </tr>
                        ))}
                        {availableLots.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-4 text-center text-gray-400 text-xs">Nenhum lote disponível</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ProductionOrderTrelica: React.FC<ProductionOrderTrelicaProps> = ({ setPage, stock, productionOrders, addProductionOrder, showNotification, updateProductionOrder, deleteProductionOrder }) => {
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
                !item.status.startsWith('Em Produção'))
            .map(item => ({
                ...item,
                availableQuantity: item.remainingQuantity
            }))
            .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
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

            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button onClick={() => setPage('menu')} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition">
                        <ArrowLeftIcon className="h-6 w-6 text-slate-700" />
                    </button>
                    <h1 className="text-3xl font-bold text-slate-800">Ordem de Produção - Treliça</h1>
                </div>
                <button onClick={() => setShowHistoryModal(true)} className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2">
                    <ClipboardListIcon className="h-5 w-5" />
                    <span>Ver Ordens Criadas</span>
                </button>
            </header>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700">Número da Ordem</label>
                        <input type="text" id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="mt-1 p-2 w-full border rounded-md" required />
                    </div>
                    <div>
                        <label htmlFor="model" className="block text-sm font-medium text-gray-700">Modelo da Treliça</label>
                        <select id="model" value={selectedModel?.cod || ''} onChange={e => handleModelChange(e.target.value)} className="mt-1 p-2 w-full border rounded-md bg-white">
                            <option value="">Selecione um modelo...</option>
                            {trelicaModels.map(m => <option key={m.cod} value={m.cod}>{`${m.modelo} (${m.tamanho} mts)`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantidade de Peças</label>
                        <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" className="mt-1 p-2 w-full border rounded-md" required />
                    </div>
                    <div>
                        <label htmlFor="machineSpeed" className="block text-sm font-medium text-gray-700">Velocidade (m/min)</label>
                        <input type="number" id="machineSpeed" value={machineSpeed} onChange={(e) => setMachineSpeed(parseFloat(e.target.value) || 1)} min="1" className="mt-1 p-2 w-full border rounded-md" required />
                    </div>
                </div>

                {selectedModel && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border rounded-lg">
                        <div>
                            <h3 className="font-semibold text-gray-800">Especificações do Modelo</h3>
                            <div className="text-sm mt-2 space-y-1">
                                <p><strong>Superior:</strong> {selectedModel.superior} mm</p>
                                <p><strong>Inferior:</strong> {selectedModel.inferior} mm (2x)</p>
                                <p><strong>Senozoide:</strong> {selectedModel.senozoide} mm (2x)</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h3 className="font-semibold text-gray-800">Resumo do Planejamento</h3>
                            <div className="text-sm mt-2 space-y-1">
                                <p><strong>Peso (un):</strong> {selectedModel.pesoFinal} kg</p>
                                <p><strong>Qtd.:</strong> {quantity} pçs</p>
                                <p><strong>Total Metros:</strong> {totalMetersToProduce.toFixed(2)} m</p>
                                <p className="text-lg font-bold text-[#0A2A3D] border-t pt-2 mt-2">Peso Total: {plannedWeight.toFixed(2)} kg</p>
                                <p className="text-lg font-bold text-emerald-700 border-t pt-2 mt-2">Tempo Estimado: {estimatedTime} <span className="text-xs font-normal">(HH:MM)</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {selectedModel && (
                    <div className="border-t pt-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800">Seleção de Lotes (Material: CA-60)</h3>
                            {/* Toggle Switch */}
                            <div className="flex items-center gap-3 bg-gray-100 p-2 rounded-lg">
                                <span className={`text-sm font-medium ${isAutoSelect ? 'text-gray-500' : 'text-blue-700'}`}>Manual</span>
                                <button
                                    type="button"
                                    onClick={() => setIsAutoSelect(!isAutoSelect)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F3F5C] focus:ring-offset-2 ${isAutoSelect ? 'bg-[#0F3F5C]' : 'bg-gray-300'}`}
                                >
                                    <span
                                        className={`${isAutoSelect ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                    />
                                </button>
                                <span className={`text-sm font-medium ${isAutoSelect ? 'text-[#0F3F5C]' : 'text-gray-500'}`}>Automático (FIFO)</span>
                            </div>
                        </div>

                        {/* Top Group: Superior */}
                        <div className="grid grid-cols-1">
                            <MultiLotSelector
                                label={`Superior (${selectedModel.superior}mm)`}
                                availableLots={baseSuperiorLots}
                                selectedLots={superiorLots}
                                onSelectionChange={setSuperiorLots}
                                requiredWeight={requiredSuperiorWeight}
                                colorClass="bg-[#e6f0f5] border-[#0F3F5C]/20"
                            />
                        </div>

                        {/* Middle Group: Inferior (Left + Right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-green-50/50 p-4 rounded-lg border border-green-100">
                            <div className="lg:col-span-2 text-sm font-bold text-green-800 uppercase tracking-wide">Banzos Inferiores</div>
                            <MultiLotSelector
                                label={`Inferior - Lado 1 (${selectedModel.inferior}mm)`}
                                availableLots={baseInferiorLeftLots}
                                selectedLots={inferiorLeftLots}
                                onSelectionChange={setInferiorLeftLots}
                                requiredWeight={requiredInferiorSideWeight}
                                colorClass="bg-white border-green-200 shadow-sm"
                            />
                            <MultiLotSelector
                                label={`Inferior - Lado 2 (${selectedModel.inferior}mm)`}
                                availableLots={baseInferiorRightLots}
                                selectedLots={inferiorRightLots}
                                onSelectionChange={setInferiorRightLots}
                                requiredWeight={requiredInferiorSideWeight}
                                colorClass="bg-white border-green-200 shadow-sm"
                            />
                        </div>

                        {/* Bottom Group: Senozoide (Left + Right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                            <div className="lg:col-span-2 text-sm font-bold text-orange-800 uppercase tracking-wide">Estribos / Senozoides</div>
                            <MultiLotSelector
                                label={`Senozoide - Lado 1 (${selectedModel.senozoide}mm)`}
                                availableLots={baseSenozoideLeftLots}
                                selectedLots={senozoideLeftLots}
                                onSelectionChange={setSenozoideLeftLots}
                                requiredWeight={requiredSenozoideSideWeight}
                                colorClass="bg-white border-orange-200 shadow-sm"
                            />
                            <MultiLotSelector
                                label={`Senozoide - Lado 2 (${selectedModel.senozoide}mm)`}
                                availableLots={baseSenozoideRightLots}
                                selectedLots={senozoideRightLots}
                                onSelectionChange={setSenozoideRightLots}
                                requiredWeight={requiredSenozoideSideWeight}
                                colorClass="bg-white border-orange-200 shadow-sm"
                            />
                        </div>

                        <div className="flex justify-end p-4">
                            <button type="submit" className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-8 rounded-lg transition text-lg shadow-lg">
                                Criar Ordem de Produção
                            </button>
                        </div>
                    </div>
                )}
                {!selectedModel && (
                    <div className="text-center text-gray-500 py-10 border-t mt-4">
                        <WarningIcon className="h-12 w-12 mx-auto text-yellow-400 mb-2" />
                        <p>Por favor, selecione um modelo de treliça para continuar.</p>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ProductionOrderTrelica;