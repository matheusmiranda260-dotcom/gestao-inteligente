import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola, StockGauge, User, MachineType, Employee } from '../types';
import { fetchByColumn } from '../services/supabaseService';
import { TrefilaBitolaOptions, FioMaquinaBitolaOptions } from '../types';
import { ArrowLeftIcon, WarningIcon, ClipboardListIcon, PencilIcon, TrashIcon, AdjustmentsIcon } from './icons';
import ProductionOrderHistoryModal from './ProductionOrderHistoryModal';
import ProductionOrderReport from './ProductionOrderReport';

interface ProductionOrderMalhaProps {
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

const ProductionOrderMalha: React.FC<ProductionOrderMalhaProps> = ({ setPage, stock, productionOrders, addProductionOrder, showNotification, updateProductionOrder, deleteProductionOrder, gauges, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [orderNumber, setOrderNumber] = useState('');
    const [malhaModel, setMalhaModel] = useState('');
    const [malhaPieces, setMalhaPieces] = useState('');
    const [selectedMachine, setSelectedMachine] = useState<MachineType>('Malha 1');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);
    const [assignedMachine, setAssignedMachine] = useState<MachineType | null>(null);

    useEffect(() => {
        if (!isGestor && currentUser?.employeeId) {
            fetchByColumn<Employee>('employees', 'id', currentUser.employeeId)
                .then(emps => {
                    if (emps && emps.length > 0 && emps[0].assignedMachine) {
                        const machine = emps[0].assignedMachine as MachineType;
                        setAssignedMachine(machine);
                        if (machine === 'Malha 1' || machine === 'Malha 2') {
                            setSelectedMachine(machine);
                        }
                    }
                })
                .catch(err => console.error("Error fetching employee assigned machine:", err));
        }
    }, [currentUser, isGestor]);

    const initialTargetBitola = useMemo(() => {
        const MalhaGauges = gauges.filter(g => g.materialType === 'CA-60').map(g => g.gauge);
        return (MalhaGauges.length > 0 ? MalhaGauges[0] : TrefilaBitolaOptions[0]) as Bitola;
    }, [gauges]);

    const [targetBitola, setTargetBitola] = useState<Bitola>(initialTargetBitola);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim()) {
            showNotification('O número da ordem de produção é obrigatório.', 'error');
            return;
        }
        if (productionOrders.some(o => o.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase())) {
            showNotification(`O número de ordem "${orderNumber}" já existe.`, 'error');
            return;
        }
        if (!malhaModel.trim()) {
            showNotification('O modelo da malha é obrigatório.', 'error');
            return;
        }
        if (!malhaPieces || parseInt(malhaPieces) <= 0) {
            showNotification('A quantidade de peças deve ser maior que 0.', 'error');
            return;
        }

        addProductionOrder({
            orderNumber,
            machine: selectedMachine,
            targetBitola,
            quantityToProduce: parseInt(malhaPieces),
            malhaModel: malhaModel,
            malhaPieces: parseInt(malhaPieces)
        });

        // Reset form
        setOrderNumber('');
        setMalhaModel('');
        setMalhaPieces('');
        setTargetBitola(TrefilaBitolaOptions[0]);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {showHistoryModal && <ProductionOrderHistoryModal
                orders={productionOrders}
                stock={stock}
                onClose={() => setShowHistoryModal(false)}
                updateProductionOrder={updateProductionOrder}
                deleteProductionOrder={deleteProductionOrder}
                currentUser={currentUser}
                onShowReport={(order) => {
                    setProductionReportData(order);
                    setShowHistoryModal(false);
                }}
            />}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                    gauges={gauges}
                />
            )}

            <header className="flex items-center justify-between mb-6 pt-4">
                <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-slate-800">Ordem de Produção - Malha</h1>
                </div>
                <div className="flex items-center gap-3">
                    {isGestor && (
                        <button
                            type="button"
                            onClick={() => setPage('gaugesManager')}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-4 rounded-lg border border-blue-200 shadow-sm transition flex items-center gap-2"
                        >
                            <AdjustmentsIcon className="h-5 w-5" />Gerenciar Bitolas
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2"
                    >
                        <ClipboardListIcon className="h-5 w-5" />
                        <span>Ver Ordens Criadas</span>
                    </button>
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Form and Summary */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-xl font-semibold text-slate-700 mb-4">Dados da Ordem</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="machine" className="block text-sm font-medium text-slate-700">Máquina Destino</label>
                                    <select
                                        id="machine"
                                        value={selectedMachine}
                                        onChange={(e) => setSelectedMachine(e.target.value as MachineType)}
                                        disabled={!!assignedMachine && !isGestor}
                                        className={`mt-1 p-2 w-full border border-slate-300 rounded-md font-bold ${assignedMachine && !isGestor ? 'bg-slate-100 text-slate-500' : 'bg-white text-indigo-600'}`}
                                    >
                                        {assignedMachine && !isGestor ? (
                                            <option value={assignedMachine}>{assignedMachine}</option>
                                        ) : (
                                            <>
                                                <option value="Malha 1">Malha 1</option>
                                                <option value="Malha 2">Malha 2</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700">Número da Ordem</label>
                                    <input
                                        type="text"
                                        id="orderNumber"
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="malhaModel" className="block text-sm font-medium text-slate-700">Modelo da Malha</label>
                                    <input
                                        type="text"
                                        id="malhaModel"
                                        value={malhaModel}
                                        onChange={(e) => setMalhaModel(e.target.value)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                        placeholder="Ex: Q61"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="malhaPieces" className="block text-sm font-medium text-slate-700">Quantidade de Peças</label>
                                    <input
                                        type="number"
                                        id="malhaPieces"
                                        value={malhaPieces}
                                        onChange={(e) => setMalhaPieces(e.target.value)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                        placeholder="Ex: 50"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="targetBitola" className="block text-sm font-medium text-slate-700">Bitola (CA-60)</label>
                                    <select
                                        id="targetBitola"
                                        value={targetBitola}
                                        onChange={(e) => setTargetBitola(e.target.value as Bitola)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white"
                                    >
                                        {(() => {
                                            const baseGauges = TrefilaBitolaOptions;
                                            const customGauges = gauges.filter(g => g.materialType === 'CA-60');
                                            
                                            const allOptions = [
                                                ...baseGauges.map(g => ({ gauge: g, code: '' })),
                                                ...customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }))
                                            ];

                                            const map = new Map();
                                            allOptions.forEach(opt => {
                                                const existing = map.get(opt.gauge);
                                                if (!existing || (opt.code && !existing.code)) {
                                                    map.set(opt.gauge, opt);
                                                }
                                            });

                                            const uniqueOptions = Array.from(map.values())
                                                .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));

                                            return uniqueOptions.map(opt => (
                                                <option key={`${opt.gauge}-${opt.code}`} value={opt.gauge}>
                                                    {opt.gauge.replace('.', ',')} {opt.code ? `(${opt.code})` : ''}
                                                </option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="submit"
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all flex items-center gap-2 transform hover:scale-[1.02]"
                                    >
                                        <ClipboardListIcon className="h-5 w-5" />
                                        <span>Criar Ordem de Malha</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ProductionOrderMalha;


