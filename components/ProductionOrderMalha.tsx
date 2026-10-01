import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola, StockGauge, User, MachineType, Employee } from '../types';
import { fetchByColumn } from '../services/supabaseService';
import { TrefilaBitolaOptions, FioMaquinaBitolaOptions, DefaultMalhaGauges } from '../types';
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
    const [malhaPieces, setMalhaPieces] = useState('');
    const [selectedMachine, setSelectedMachine] = useState<MachineType>('Malha 1');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);
    const [assignedMachine, setAssignedMachine] = useState<MachineType | null>(null);

    // Lista de Modelos de Malha disponíveis (Catálogo + Cadastrados no Estoque/Gestão de Lotes)
    const availableMalhaModels = useMemo(() => {
        const deletedDefaults: string[] = JSON.parse(localStorage.getItem('deleted_default_gauges') || '[]');
        const overriddenDefaults: string[] = JSON.parse(localStorage.getItem('overridden_default_gauges') || '[]');

        const result: Array<{
            id?: string;
            productCode?: string;
            description: string;
            gauge?: string;
            meshSpacing?: string;
            panelDimensions?: string;
            peso_peca?: string;
            peso_final?: string;
            longitudinal?: string;
            transversal?: string;
        }> = [];

        // 1. Modelos de Malha customizados cadastrados em gauges
        (gauges || []).filter(g => g.materialType === 'Malha').forEach(g => {
            result.push({
                id: g.id,
                productCode: g.productCode,
                description: g.description || `Malha ${g.gauge || ''}`,
                gauge: g.gauge,
                meshSpacing: (g as any).meshSpacing,
                panelDimensions: (g as any).panelDimensions || (g as any).tamanho,
                peso_peca: (g as any).peso_peca || g.peso_final,
                peso_final: g.peso_final,
                longitudinal: (g as any).longitudinal,
                transversal: (g as any).transversal
            });
        });

        // 2. Modelos padrão de DefaultMalhaGauges se não estiverem deletados ou substituídos
        DefaultMalhaGauges.forEach(d => {
            const defId = d.id || `default_ml_${d.productCode}`;
            if (deletedDefaults.includes(defId) || overriddenDefaults.includes(defId)) return;
            const exists = result.some(g => 
                (d.productCode && g.productCode === d.productCode) || 
                (g.description === d.description && g.gauge === d.gauge) ||
                g.id === defId
            );
            if (!exists) {
                result.push({
                    id: defId,
                    productCode: d.productCode,
                    description: d.description,
                    gauge: d.gauge,
                    meshSpacing: d.meshSpacing,
                    panelDimensions: d.panelDimensions,
                    peso_peca: d.peso_peca || d.peso_final,
                    peso_final: d.peso_final,
                    longitudinal: d.longitudinal,
                    transversal: d.transversal
                });
            }
        });

        return result;
    }, [gauges]);

    const [malhaModel, setMalhaModel] = useState('');

    useEffect(() => {
        if (!malhaModel && availableMalhaModels.length > 0) {
            const first = availableMalhaModels[0];
            setMalhaModel(first.description);
            if (first.gauge) {
                const rawG = first.gauge.replace('mm', '').replace(',', '.').trim();
                setTargetBitola(rawG as Bitola);
            }
        }
    }, [availableMalhaModels, malhaModel]);

    const selectedMalhaModelObj = useMemo(() => {
        return availableMalhaModels.find(m => 
            m.description === malhaModel || 
            m.productCode === malhaModel || 
            m.id === malhaModel
        ) || null;
    }, [availableMalhaModels, malhaModel]);

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

        const pieces = parseInt(malhaPieces);
        const rawPeso = selectedMalhaModelObj?.peso_peca || selectedMalhaModelObj?.peso_final;
        const pieceWeight = rawPeso ? parseFloat(rawPeso.replace(',', '.')) : 5;

        addProductionOrder({
            orderNumber,
            machine: selectedMachine,
            targetBitola,
            quantityToProduce: pieces,
            malhaModel: selectedMalhaModelObj?.description || malhaModel,
            productCode: selectedMalhaModelObj?.productCode || '',
            productDescription: selectedMalhaModelObj?.description || malhaModel,
            totalWeight: pieces * (pieceWeight > 0 ? pieceWeight : 5),
            malhaPieces: pieces
        });

        // Reset form
        setOrderNumber('');
        setMalhaPieces('');
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
                                    <label htmlFor="malhaModel" className="block text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Modelo da Malha (Gestão de Lotes)</span>
                                        {selectedMalhaModelObj?.productCode && (
                                            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200">
                                                Cód. {selectedMalhaModelObj.productCode}
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        id="malhaModel"
                                        value={malhaModel}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMalhaModel(val);
                                            const found = availableMalhaModels.find(m => m.description === val || m.productCode === val || m.id === val);
                                            if (found && found.gauge) {
                                                const rawG = found.gauge.replace('mm', '').replace(',', '.').trim();
                                                setTargetBitola(rawG as Bitola);
                                            }
                                        }}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Selecione um modelo de malha cadastrado...</option>
                                        {availableMalhaModels.map(m => {
                                            const parts = [];
                                            if (m.productCode) parts.push(`[Cód. ${m.productCode}]`);
                                            parts.push(m.description);
                                            if (m.gauge) parts.push(`(${m.gauge})`);
                                            if (m.meshSpacing) parts.push(`[${m.meshSpacing}]`);
                                            if (m.panelDimensions) parts.push(`• ${m.panelDimensions}m`);
                                            if (m.peso_peca) parts.push(`• ${m.peso_peca} kg/pç`);
                                            return (
                                                <option key={m.id || m.productCode || m.description} value={m.description}>
                                                    {parts.join(' ')}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {selectedMalhaModelObj && (
                                        <div className="mt-2 bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5 text-xs text-slate-700 flex flex-col gap-1">
                                            <div className="flex items-center justify-between font-bold text-indigo-950">
                                                <span>{selectedMalhaModelObj.description}</span>
                                                {selectedMalhaModelObj.peso_peca && (
                                                    <span className="bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-mono">
                                                        {selectedMalhaModelObj.peso_peca} kg/peça
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1 text-[11px] text-slate-600">
                                                {selectedMalhaModelObj.gauge && <div>Bitola: <strong className="text-slate-900">{selectedMalhaModelObj.gauge}</strong></div>}
                                                {selectedMalhaModelObj.meshSpacing && <div>Espaçamento: <strong className="text-slate-900">{selectedMalhaModelObj.meshSpacing}</strong></div>}
                                                {selectedMalhaModelObj.panelDimensions && <div>Painel: <strong className="text-slate-900">{selectedMalhaModelObj.panelDimensions}m</strong></div>}
                                                {selectedMalhaModelObj.peso_peca && malhaPieces && parseInt(malhaPieces) > 0 && (
                                                    <div>Peso Estimado: <strong className="text-indigo-700 font-mono">{(parseInt(malhaPieces) * parseFloat(selectedMalhaModelObj.peso_peca.replace(',', '.'))).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</strong></div>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                            
                                            const allOptions: Array<{ gauge: string; code?: string; description?: string; key: string }> = [];
                                            
                                            customGauges.forEach(g => {
                                                allOptions.push({
                                                    gauge: g.gauge,
                                                    code: g.productCode,
                                                    description: g.description,
                                                    key: `${g.gauge}-${g.description || ''}-${g.productCode || ''}`
                                                });
                                            });

                                            baseGauges.forEach(bg => {
                                                if (!allOptions.some(o => o.gauge === bg)) {
                                                    allOptions.push({
                                                        gauge: bg,
                                                        code: '',
                                                        description: `CA-60 ${bg.replace('.', ',')} mm`,
                                                        key: `${bg}-default`
                                                    });
                                                }
                                            });

                                            return allOptions
                                                .sort((a, b) => {
                                                    const diff = parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.'));
                                                    if (diff !== 0) return diff;
                                                    return (a.description || '').localeCompare(b.description || '');
                                                })
                                                .map(opt => {
                                                    const descText = opt.description ? ` - ${opt.description}` : '';
                                                    const codeText = opt.code ? ` (${opt.code})` : '';
                                                    return (
                                                        <option key={opt.key} value={opt.gauge}>
                                                            {opt.gauge.replace('.', ',')} mm{descText}{codeText}
                                                        </option>
                                                    );
                                                });
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


