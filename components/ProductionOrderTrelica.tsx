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

    return (
        <div className="text-right text-sm">
            {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
            <p>Necessário: <span className="font-bold">{required.toFixed(2)} kg</span></p>
            <p>Selecionado:
                <span className={`font-bold ${sufficient ? 'text-green-600' : 'text-red-600'}`}>
                    {selected.toFixed(2)} kg
                </span>
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                    className={`h-2 rounded-full transition-all ${sufficient ? 'bg-green-600' : 'bg-red-600'}`}
                    style={{ width: `${percentage}%` }}
                ></div>
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

    // Lotes selecionados - estrutura física da máquina
    const [superiorLot, setSuperiorLot] = useState<string>(''); // 1 lote único
    const [inferiorDireito, setInferiorDireito] = useState<string>(''); // Lado direito
    const [inferiorEsquerdo, setInferiorEsquerdo] = useState<string>(''); // Lado esquerdo
    const [senozoideDireito, setSenozoideDireito] = useState<string>(''); // Lado direito
    const [senozoideEsquerdo, setSenozoideEsquerdo] = useState<string>(''); // Lado esquerdo

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
            .filter(item => item.availableQuantity > 0);
    }, [stock]);

    const handleModelChange = (cod: string) => {
        const model = trelicaModels.find(m => m.cod === cod) || null;
        setSelectedModel(model);
        // Limpar seleções
        setSuperiorLot('');
        setInferiorDireito('');
        setInferiorEsquerdo('');
        setSenozoideDireito('');
        setSenozoideEsquerdo('');
    };

    const { baseSuperiorLots, baseInferiorLots, baseSenozoideLots } = useMemo(() => {
        if (!selectedModel) return { baseSuperiorLots: [], baseInferiorLots: [], baseSenozoideLots: [] };
        const superiorBitola = normalizeBitola(selectedModel.superior);
        const inferiorBitola = normalizeBitola(selectedModel.inferior);
        const senozoideBitola = normalizeBitola(selectedModel.senozoide);

        return {
            baseSuperiorLots: availableCa60Stock.filter(s => s.bitola === superiorBitola),
            baseInferiorLots: availableCa60Stock.filter(s => s.bitola === inferiorBitola),
            baseSenozoideLots: availableCa60Stock.filter(s => s.bitola === senozoideBitola),
        };
    }, [selectedModel, availableCa60Stock]);

    const { requiredSuperiorWeight, requiredInferiorWeight, requiredSenozoideWeight } = useMemo(() => {
        if (!selectedModel || !quantity) return { requiredSuperiorWeight: 0, requiredInferiorWeight: 0, requiredSenozoideWeight: 0 };
        const parseWeight = (w: string) => parseFloat(w.replace(',', '.'));
        return {
            requiredSuperiorWeight: parseWeight(selectedModel.pesoSuperior) * quantity,
            requiredInferiorWeight: parseWeight(selectedModel.pesoInferior) * quantity,
            requiredSenozoideWeight: parseWeight(selectedModel.pesoSenozoide) * quantity,
        };
    }, [selectedModel, quantity]);

    const { selectedSuperiorWeight, selectedInferiorWeight, selectedSenozoideWeight } = useMemo(() => {
        const getLotWeight = (id: string) => availableCa60Stock.find(s => s.id === id)?.availableQuantity || 0;
        return {
            selectedSuperiorWeight: getLotWeight(superiorLot),
            selectedInferiorWeight: getLotWeight(inferiorDireito) + getLotWeight(inferiorEsquerdo),
            selectedSenozoideWeight: getLotWeight(senozoideDireito) + getLotWeight(senozoideEsquerdo),
        };
    }, [superiorLot, inferiorDireito, inferiorEsquerdo, senozoideDireito, senozoideEsquerdo, availableCa60Stock]);

    // Filtrar lotes disponíveis (mantendo o selecionado no próprio campo)
    const { optsSuperior, optsInferiorDir, optsInferiorEsq, optsSenozoideDir, optsSenozoideEsq } = useMemo(() => {
        const allSelected = new Set([superiorLot, inferiorDireito, inferiorEsquerdo, senozoideDireito, senozoideEsquerdo].filter(Boolean));

        const getOpts = (base: StockItem[], current: string) => base.filter(l => !allSelected.has(l.id) || l.id === current);

        return {
            optsSuperior: getOpts(baseSuperiorLots, superiorLot),
            optsInferiorDir: getOpts(baseInferiorLots, inferiorDireito),
            optsInferiorEsq: getOpts(baseInferiorLots, inferiorEsquerdo),
            optsSenozoideDir: getOpts(baseSenozoideLots, senozoideDireito),
            optsSenozoideEsq: getOpts(baseSenozoideLots, senozoideEsquerdo),
        };
    }, [baseSuperiorLots, baseInferiorLots, baseSenozoideLots, superiorLot, inferiorDireito, inferiorEsquerdo, senozoideDireito, senozoideEsquerdo]);

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

        // Validações específicas da nova estrutura
        if (!superiorLot) {
            showNotification('Selecione o lote Superior.', 'error');
            return;
        }
        if (!inferiorDireito || !inferiorEsquerdo) {
            showNotification('Selecione os lotes Inferior (Direito e Esquerdo).', 'error');
            return;
        }
        if (!senozoideDireito || !senozoideEsquerdo) {
            showNotification('Selecione os lotes Senozoide (Direito e Esquerdo).', 'error');
            return;
        }

        if (selectedSuperiorWeight < requiredSuperiorWeight) {
            showNotification(`Peso para Superior é insuficiente. Necessário: ${requiredSuperiorWeight.toFixed(2)} kg.`, 'error');
            return;
        }
        if (selectedInferiorWeight < requiredInferiorWeight) {
            showNotification(`Peso para Inferior é insuficiente. Necessário: ${requiredInferiorWeight.toFixed(2)} kg.`, 'error');
            return;
        }
        if (selectedSenozoideWeight < requiredSenozoideWeight) {
            showNotification(`Peso para Senozoide é insuficiente. Necessário: ${requiredSenozoideWeight.toFixed(2)} kg.`, 'error');
            return;
        }

        // Criar estrutura compatível mantendo retrocompatibilidade
        const trelicaLots = {
            superior: superiorLot,
            inferior1: inferiorDireito,
            inferior2: inferiorEsquerdo,
            senozoide1: senozoideDireito,
            senozoide2: senozoideEsquerdo,
            // Arrays para a lógica de consumo
            allSuperior: [superiorLot],
            allInferior: [inferiorDireito, inferiorEsquerdo],
            allSenozoide: [senozoideDireito, senozoideEsquerdo],
        };

        const totalPlannedConsumption = requiredSuperiorWeight + requiredInferiorWeight + requiredSenozoideWeight;
        const plannedOutputWeight = parseFloat(selectedModel.pesoFinal.replace(',', '.')) * quantity;

        addProductionOrder({
            orderNumber: orderNumber,
            machine: 'Treliça',
            targetBitola: normalizeBitola(selectedModel.superior) as Bitola,
            trelicaModel: selectedModel.modelo,
            tamanho: selectedModel.tamanho,
            quantityToProduce: quantity,
            selectedLotIds: trelicaLots as any,
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

    const getLotInfo = (lotId: string) => {
        if (!lotId) return null;
        const lot = availableCa60Stock.find(l => l.id === lotId);
        return lot;
    };

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
                                <p><strong>Inferior:</strong> {selectedModel.inferior} mm</p>
                                <p><strong>Senozoide:</strong> {selectedModel.senozoide} mm</p>
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
                        <h3 className="text-lg font-semibold text-gray-800">Seleção de Lotes (Material: CA-60)</h3>

                        {/* Superior - 1 lote único */}
                        <div className="p-4 border rounded-lg bg-[#e6f0f5]">
                            <div className="flex justify-between items-end border-b border-[#0F3F5C]/20 pb-2 mb-4">
                                <h4 className="font-medium text-gray-700">
                                    <span className="text-[#0F3F5C]">●</span> Barra Superior (Bitola: {selectedModel.superior}mm)
                                </h4>
                                <WeightIndicator required={requiredSuperiorWeight} selected={selectedSuperiorWeight} label="1 Lote Único" />
                            </div>
                            <div className="space-y-2">
                                {superiorLot && (
                                    <div className="bg-white p-3 rounded border border-[#0F3F5C]/20">
                                        <p className="text-sm">
                                            <strong>{getLotInfo(superiorLot)?.internalLot}</strong> - {getLotInfo(superiorLot)?.availableQuantity.toFixed(2)} kg
                                        </p>
                                    </div>
                                )}
                                <select
                                    value={superiorLot}
                                    onChange={(e) => setSuperiorLot(e.target.value)}
                                    className="w-full p-2 border rounded-md bg-white"
                                    required
                                >
                                    <option value="">Selecione o lote Superior...</option>
                                    {optsSuperior.map(lot => (
                                        <option key={lot.id} value={lot.id}>
                                            {lot.internalLot} ({lot.availableQuantity.toFixed(2)} kg)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Inferior - 2 lotes (Direito e Esquerdo) */}
                        <div className="p-4 border rounded-lg bg-green-50">
                            <div className="flex justify-between items-end border-b border-green-200 pb-2 mb-4">
                                <h4 className="font-medium text-gray-700">
                                    <span className="text-green-700">●</span> Barras Inferiores (Bitola: {selectedModel.inferior}mm)
                                </h4>
                                <WeightIndicator required={requiredInferiorWeight} selected={selectedInferiorWeight} label="2 Lotes (D + E)" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Direito */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">
                                        → Lado Direito
                                    </label>
                                    {inferiorDireito && (
                                        <div className="bg-white p-2 mb-2 rounded border border-green-200">
                                            <p className="text-sm">
                                                <strong>{getLotInfo(inferiorDireito)?.internalLot}</strong><br />
                                                {getLotInfo(inferiorDireito)?.availableQuantity.toFixed(2)} kg
                                            </p>
                                        </div>
                                    )}
                                    <select
                                        value={inferiorDireito}
                                        onChange={(e) => setInferiorDireito(e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {optsInferiorDir.map(lot => (
                                            <option key={lot.id} value={lot.id}>
                                                {lot.internalLot} ({lot.availableQuantity.toFixed(2)} kg)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Esquerdo */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">
                                        ← Lado Esquerdo
                                    </label>
                                    {inferiorEsquerdo && (
                                        <div className="bg-white p-2 mb-2 rounded border border-green-200">
                                            <p className="text-sm">
                                                <strong>{getLotInfo(inferiorEsquerdo)?.internalLot}</strong><br />
                                                {getLotInfo(inferiorEsquerdo)?.availableQuantity.toFixed(2)} kg
                                            </p>
                                        </div>
                                    )}
                                    <select
                                        value={inferiorEsquerdo}
                                        onChange={(e) => setInferiorEsquerdo(e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {optsInferiorEsq.map(lot => (
                                            <option key={lot.id} value={lot.id}>
                                                {lot.internalLot} ({lot.availableQuantity.toFixed(2)} kg)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Senozoide - 2 lotes (Direito e Esquerdo) */}
                        <div className="p-4 border rounded-lg bg-[#fff3e6]">
                            <div className="flex justify-between items-end border-b border-[#FF8C00]/20 pb-2 mb-4">
                                <h4 className="font-medium text-gray-700">
                                    <span className="text-[#FF8C00]">●</span> Barras Senozoides (Bitola: {selectedModel.senozoide}mm)
                                </h4>
                                <WeightIndicator required={requiredSenozoideWeight} selected={selectedSenozoideWeight} label="2 Lotes (D + E)" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Direito */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">
                                        → Lado Direito
                                    </label>
                                    {senozoideDireito && (
                                        <div className="bg-white p-2 mb-2 rounded border border-[#FF8C00]/20">
                                            <p className="text-sm">
                                                <strong>{getLotInfo(senozoideDireito)?.internalLot}</strong><br />
                                                {getLotInfo(senozoideDireito)?.availableQuantity.toFixed(2)} kg
                                            </p>
                                        </div>
                                    )}
                                    <select
                                        value={senozoideDireito}
                                        onChange={(e) => setSenozoideDireito(e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {optsSenozoideDir.map(lot => (
                                            <option key={lot.id} value={lot.id}>
                                                {lot.internalLot} ({lot.availableQuantity.toFixed(2)} kg)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Esquerdo */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">
                                        ← Lado Esquerdo
                                    </label>
                                    {senozoideEsquerdo && (
                                        <div className="bg-white p-2 mb-2 rounded border border-[#FF8C00]/20">
                                            <p className="text-sm">
                                                <strong>{getLotInfo(senozoideEsquerdo)?.internalLot}</strong><br />
                                                {getLotInfo(senozoideEsquerdo)?.availableQuantity.toFixed(2)} kg
                                            </p>
                                        </div>
                                    )}
                                    <select
                                        value={senozoideEsquerdo}
                                        onChange={(e) => setSenozoideEsquerdo(e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {optsSenozoideEsq.map(lot => (
                                            <option key={lot.id} value={lot.id}>
                                                {lot.internalLot} ({lot.availableQuantity.toFixed(2)} kg)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button type="submit" className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-6 rounded-lg transition text-lg">
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