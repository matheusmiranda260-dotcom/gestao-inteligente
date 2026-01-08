import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, MachineType, StockItem, ProductionOrderData, User, PartsRequest, ShiftReport, TrelicaSelectedLots, Ponta } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, ClockIcon, WarningIcon, StopIcon, CheckCircleIcon, WrenchScrewdriverIcon, ArchiveIcon, ClipboardListIcon, CogIcon, DocumentReportIcon, ScaleIcon, TrashIcon, CalculatorIcon, ChartBarIcon, ExclamationIcon, SaveIcon } from './icons';
import PartsRequestModal from './PartsRequestModal';
import ShiftReportsModal from './ShiftReportsModal';
import ProductionOrderReport from './ProductionOrderReport';
import { trelicaModels } from './ProductionOrderTrelica';
import TrefilaCalculation from './TrefilaCalculation';



const IdleActivityLogger: React.FC<{
    onLogActivity: (activity: string) => void;
    activities: { timestamp: string; description: string }[];
}> = ({ onLogActivity, activities }) => {
    const [activity, setActivity] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activity.trim()) return;
        onLogActivity(activity);
        setActivity('');
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Registrar Atividade Pós-Produção</h3>
            <p className="text-sm text-slate-600 mb-4">A ordem de produção foi finalizada. Registre o que você está fazendo até o final do seu turno.</p>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="flex-grow p-2 border border-slate-300 rounded-md"
                    placeholder="Ex: Limpando a máquina..."
                    required
                />
                <button type="submit" className="bg-slate-700 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-800">Registrar</button>
            </form>
            <div className="max-h-40 overflow-y-auto space-y-2">
                {activities.length > 0 ? (
                    activities.map((act, index) => (
                        <div key={index} className="text-sm bg-slate-50 p-2 rounded-md">
                            <span className="font-semibold text-slate-500">{new Date(act.timestamp).toLocaleTimeString('pt-BR')}:</span> {act.description}
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-center text-slate-400 py-4">Nenhuma atividade registrada.</p>
                )}
            </div>
        </div>
    );
};

const downtimeReasons = [
    'Enrosco de fio',
    'Falha no sensor',
    'Quebra fio',
    'Setup',
    'Falta de energia',
    'Outros'
];

const DowntimeModal: React.FC<{
    onClose: () => void;
    onSubmit: (reason: string) => void;
}> = ({ onClose, onSubmit }) => {
    const [reason, setReason] = useState(downtimeReasons[0]);
    const [otherReason, setOtherReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalReason = reason === 'Outros' ? otherReason.trim() : reason;
        if (finalReason) {
            onSubmit(finalReason);
        }
    };
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in">
                <div className="p-8">
                    <div className="bg-amber-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                        <PauseIcon className="h-10 w-10 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Pausar Produção</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">Qual o motivo da interrupção? Isso nos ajuda a gerenciar a eficiência da planta.</p>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="reason-select" className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione o Motivo</label>
                            <select
                                id="reason-select"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-amber-500 focus:bg-white transition appearance-none"
                            >
                                {downtimeReasons.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {reason === 'Outros' && (
                            <div className="animate-fade-in">
                                <label htmlFor="other-reason" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Especifique</label>
                                <input
                                    type="text"
                                    id="other-reason"
                                    value={otherReason}
                                    onChange={(e) => setOtherReason(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-medium focus:border-amber-500 focus:bg-white transition"
                                    placeholder="Descreva o motivo"
                                    required
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 p-6 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-white border-2 border-slate-200 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-100 transition active:scale-95"
                    >
                        CANCELAR
                    </button>
                    <button
                        type="submit"
                        className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition active:scale-95"
                    >
                        CONFIRMAR
                    </button>
                </div>
            </form>
        </div>
    );
};

const CompletionModal: React.FC<{
    order: ProductionOrderData;
    onClose: () => void;
    onSubmit: (data: { actualProducedQuantity?: number; pontas?: Ponta[] }) => void;
}> = ({ order, onClose, onSubmit }) => {
    const [actualProducedQuantity, setActualProducedQuantity] = useState(order.actualProducedQuantity || 0);
    const [pontas, setPontas] = useState<{ quantity: number; size: number }[]>([]);

    const modelInfo = useMemo(() => trelicaModels.find(m => m.modelo === order.trelicaModel && m.tamanho === order.tamanho), [order]);

    const handleAddPonta = () => {
        setPontas(prev => [...prev, { quantity: 1, size: 0 }]);
    };

    const handleRemovePonta = (index: number) => {
        setPontas(prev => prev.filter((_, i) => i !== index));
    };

    const handlePontaChange = (index: number, field: 'quantity' | 'size', value: number) => {
        setPontas(prev => {
            const newPontas = [...prev];
            newPontas[index][field] = value;
            return newPontas;
        });
    };

    const calculatePontaWeight = (ponta: { quantity: number; size: number }) => {
        if (!modelInfo || !ponta.size || ponta.size <= 0) return 0;
        const weightPerMeter = parseFloat(modelInfo.pesoFinal.replace(',', '.')) / parseFloat(modelInfo.tamanho);
        return weightPerMeter * ponta.size * ponta.quantity;
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalPontas = pontas
            .filter(p => p.quantity > 0 && p.size > 0)
            .map(p => ({
                quantity: p.quantity,
                size: p.size,
                totalWeight: calculatePontaWeight(p),
            }));

        onSubmit({ actualProducedQuantity, pontas: finalPontas });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Finalizar Ordem de Produção</h2>
                <p className="text-slate-600 mb-6">Confirme os dados de produção para a ordem <strong>{order.orderNumber}</strong>.</p>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Quantidade Total de Peças (Tamanho Padrão)</label>
                        <input
                            type="number"
                            value={actualProducedQuantity}
                            onChange={e => setActualProducedQuantity(parseInt(e.target.value, 10) || 0)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            required
                        />
                    </div>
                    <div className="p-4 border rounded-lg bg-slate-50">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-slate-700">Registro de Pontas</h3>
                            <button type="button" onClick={handleAddPonta} className="bg-slate-600 text-white text-xs font-bold py-1 px-3 rounded hover:bg-slate-700">
                                + Adicionar Ponta
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Adicione aqui as peças que não atingiram o tamanho padrão ({order.tamanho}m).</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {pontas.map((ponta, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-white rounded border">
                                    <div className="col-span-4">
                                        <label className="text-xs">Quantidade</label>
                                        <input type="number" min="1" value={ponta.quantity} onChange={e => handlePontaChange(index, 'quantity', parseInt(e.target.value) || 1)} className="p-1 w-full border rounded" />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-xs">Tamanho (m)</label>
                                        <input type="number" step="0.01" value={ponta.size} onChange={e => handlePontaChange(index, 'size', parseFloat(e.target.value) || 0)} className="p-1 w-full border rounded" />
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <label className="text-xs block">Peso Calc. (kg)</label>
                                        <span className="font-bold text-slate-800">{calculatePontaWeight(ponta).toFixed(2)}</span>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button type="button" onClick={() => handleRemovePonta(index)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            ))}
                            {pontas.length === 0 && <p className="text-center text-sm text-slate-400 py-4">Nenhuma ponta registrada.</p>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition">Confirmar e Finalizar Ordem</button>
                </div>
            </form>
        </div>
    );
};

const QuantityPromptModal: React.FC<{
    onClose: () => void;
    onSubmit: (quantity: number) => void;
    currentQuantity: number;
}> = ({ onClose, onSubmit, currentQuantity }) => {
    const [quantity, setQuantity] = useState(currentQuantity);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(quantity);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Produção do Turno</h2>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-6">
                    <p className="text-amber-800 text-sm font-bold flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" /> Atualização Obrigatória (10 min)
                    </p>
                    <p className="text-amber-700 text-xs mt-1">Informe a quantidade total produzida <strong>desde o início do seu turno</strong>.</p>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Total Produzido no Turno</label>
                    <div className="relative group">
                        <input
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(parseInt(e.target.value, 10) || 0)}
                            className="mt-1 p-8 w-full border-4 border-slate-100 rounded-[2.5rem] text-7xl text-center font-black text-emerald-600 focus:border-emerald-500 transition-all outline-none bg-slate-50/50 group-hover:bg-white"
                            required
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-8 text-slate-300 font-black text-2xl uppercase tracking-widest pointer-events-none">pçs</div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition">Registrar</button>
                </div>
            </form>
        </div>
    );
};

const ManagerOverrideModal: React.FC<{
    data: { actualWeight: number; lowerBound: number; upperBound: number; };
    onSuccess: () => void;
    onCancel: () => void;
    users: User[];
}> = ({ data, onSuccess, onCancel, users }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const manager = users.find(u => u.role === 'gestor' && u.password === password);
        if (manager) {
            onSuccess();
        } else {
            setError('Senha do gestor incorreta ou inválida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
                <div className="text-center">
                    <WarningIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Alerta de Peso Incomum</h2>
                    <p className="text-slate-600 mb-6">
                        O peso inserido de <strong className="text-slate-800">{data.actualWeight.toFixed(2)} kg</strong> está fora da tolerância de peso esperada (entre <strong className="text-slate-800">{data.lowerBound.toFixed(2)} kg</strong> e <strong className="text-slate-800">{data.upperBound.toFixed(2)} kg</strong>).
                    </p>
                    <p className="text-sm font-bold text-slate-700 mb-4">É necessária autorização de um gestor para prosseguir.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Senha do Gestor</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        required
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 transition">Autorizar e Confirmar</button>
                </div>
            </form>
        </div>
    );
};

const ManagerActionAuthorizationModal: React.FC<{
    actionDescription: string;
    onSuccess: () => void;
    onCancel: () => void;
    users: User[];
}> = ({ actionDescription, onSuccess, onCancel, users }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const manager = users.find(u => u.role === 'gestor' && u.password === password);
        if (manager) {
            onSuccess();
        } else {
            setError('Senha do gestor incorreta ou inválida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
                <div className="text-center">
                    <WarningIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Autorização Necessária</h2>
                    <p className="text-slate-600 mb-6">
                        {actionDescription}
                    </p>
                    <p className="text-sm font-bold text-slate-700 mb-4">É necessária autorização de um gestor para prosseguir.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Senha do Gestor</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        required
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 transition">Autorizar</button>
                </div>
            </form>
        </div>
    );
};

interface MachineControlProps {
    machineType: MachineType;
    setPage: (page: Page) => void;
    stock: StockItem[];
    currentUser?: User | null;
    users?: User[];
    productionOrders?: ProductionOrderData[];
    shiftReports?: ShiftReport[];
    logPostProductionActivity?: (activity: string) => void;
    updateProducedQuantity?: (orderId: string, quantity: number) => void;
    startProductionOrder?: (orderId: string) => void;
    startOperatorShift?: (orderId: string) => void;
    endOperatorShift?: (orderId: string, finalQuantity?: number) => void;
    logDowntime?: (orderId: string, reason: string) => void;
    logResumeProduction?: (orderId: string) => void;
    startLotProcessing?: (orderId: string, lotId: string) => void;
    finishLotProcessing?: (orderId: string, lotId: string) => void;
    recordLotWeight?: (orderId: string, lotId: string, finalWeight: number, measuredGauge?: number) => void;
    recordPackageWeight?: (orderId: string, packageData: { packageNumber: number; quantity: number; weight: number; }) => void;
    completeProduction?: (orderId: string, finalData: { actualProducedQuantity?: number, pontas?: Ponta[] }) => void;
    addPartsRequest?: (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status' | 'machine' | 'productionOrderId'>) => void;
    deleteShiftReport?: (reportId: string) => void;
    initialView?: View;
    initialModal?: 'reports' | 'parts' | null;
}

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

type View = 'dashboard' | 'in_progress' | 'pending' | 'completed';

const MachineMenuButton: React.FC<{ onClick: () => void; label: string; description: string, icon?: React.ReactNode, disabled?: boolean }> = ({ onClick, label, description, icon, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`bg-white p-6 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex items-start gap-4 border-l-4 ${disabled ? 'opacity-50 grayscale border-slate-300' : 'border-slate-800'}`}
    >
        <div className={`p-3 rounded-lg ${disabled ? 'bg-slate-100' : 'bg-slate-100'}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-xl font-bold text-slate-800">{label}</h3>
            <p className="text-slate-500 mt-1 text-sm leading-relaxed">{description}</p>
        </div>
    </button>
);

const MachineControl: React.FC<MachineControlProps> = ({
    machineType, setPage, currentUser, users = [], stock, productionOrders = [],
    shiftReports = [], startProductionOrder, startOperatorShift, endOperatorShift,
    logDowntime, logResumeProduction, startLotProcessing, finishLotProcessing,
    recordLotWeight, recordPackageWeight, completeProduction, addPartsRequest,
    logPostProductionActivity, updateProducedQuantity, deleteShiftReport,
    initialView, initialModal
}) => {

    const [pendingWeights, setPendingWeights] = useState<Map<string, string>>(new Map());
    const [pendingGauges, setPendingGauges] = useState<Map<string, string>>(new Map()); // Novo estado para bitolas
    const [pendingPackageWeights, setPendingPackageWeights] = useState<Map<number, string>>(new Map());
    const [justCompletedOrderId, setJustCompletedOrderId] = useState<string | null>(null);
    const [managerOverrideData, setManagerOverrideData] = useState<{
        packageNumber: number;
        quantity: number;
        weight: number;
        lowerBound: number;
        upperBound: number;
    } | null>(null);

    const handlePendingWeightChange = (lotId: string, value: string) => {
        setPendingWeights(prev => new Map(prev).set(lotId, value));
    };

    const handlePendingGaugeChange = (lotId: string, value: string) => { // Novo handler
        setPendingGauges(prev => new Map(prev).set(lotId, value));
    };

    const handlePendingPackageWeightChange = (packageNumber: number, value: string) => {
        setPendingPackageWeights(prev => new Map(prev).set(packageNumber, value));
    };

    const handleRecordWeight = (lotId: string) => {
        const weightStr = pendingWeights.get(lotId);
        const gaugeStr = pendingGauges.get(lotId); // Pega a bitola aferida
        if (weightStr) {
            const weight = parseFloat(weightStr);
            const gauge = gaugeStr ? parseFloat(gaugeStr) : undefined;
            if (activeOrder && recordLotWeight && !isNaN(weight) && weight > 0) {
                recordLotWeight(activeOrder.id, lotId, weight, gauge);
                setPendingWeights(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
                setPendingGauges(prev => { // Limpa estado da bitola
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
        }
    };

    const [showResumePreviousStopModal, setShowResumePreviousStopModal] = useState(false);
    const [previousStopReason, setPreviousStopReason] = useState<string | null>(null);

    const handleStartShift = () => {
        if (!activeOrder || !startOperatorShift) return;

        // Check for active downtime from previous shift
        const lastEvent = activeOrder.downtimeEvents?.[(activeOrder.downtimeEvents.length || 0) - 1];
        if (lastEvent && !lastEvent.resumeTime && lastEvent.reason !== 'Final de Turno' && lastEvent.reason !== 'Aguardando Início da Produção') {
            setPreviousStopReason(lastEvent.reason);
            setShowResumePreviousStopModal(true);
        } else {
            // Normal start
            startOperatorShift(activeOrder.id);
        }
    };

    const confirmResumePreviousStop = async (shouldResume: boolean) => {
        if (!activeOrder || !startOperatorShift) return;

        // Start the shift first
        await startOperatorShift(activeOrder.id);

        // If user wants to resume production immediately
        if (shouldResume && logResumeProduction) {
            // Give a small delay to ensuring shift start processed (optional but safer if async race)
            setTimeout(() => logResumeProduction(activeOrder.id), 500);
        }

        setShowResumePreviousStopModal(false);
        setPreviousStopReason(null);
    };

    const executeRecordPackageWeight = (pkgData: { packageNumber: number; quantity: number; weight: number; }) => {

        if (activeOrder && recordPackageWeight) {
            recordPackageWeight(activeOrder.id, { packageNumber: pkgData.packageNumber, quantity: pkgData.quantity, weight: pkgData.weight });
            setPendingPackageWeights(prev => {
                const newMap = new Map(prev);
                newMap.delete(pkgData.packageNumber);
                return newMap;
            });
        }
    };

    const handleRecordPackageWeight = (packageNumber: number, quantity: number) => {
        const weightStr = pendingPackageWeights.get(packageNumber);
        if (!weightStr) return;

        const weight = parseFloat(weightStr);
        if (!activeOrder || isNaN(weight) || weight <= 0) return;

        const modelInfo = trelicaModels.find(m => m.modelo === activeOrder.trelicaModel && m.tamanho === activeOrder.tamanho);

        if (!modelInfo) {
            executeRecordPackageWeight({ packageNumber, quantity, weight });
            return;
        }

        const theoreticalWeightPerPiece = parseFloat(modelInfo.pesoFinal.replace(',', '.'));
        const expectedWeight = theoreticalWeightPerPiece * quantity;
        const TOLERANCE = 0.01; // 1%
        const lowerBound = expectedWeight * (1 - TOLERANCE);
        const upperBound = expectedWeight * (1 + TOLERANCE);

        if (weight < lowerBound || weight > upperBound) {
            setManagerOverrideData({ packageNumber, quantity, weight, lowerBound, upperBound });
        } else {
            executeRecordPackageWeight({ packageNumber, quantity, weight });
        }
    };


    const [view, setView] = useState<View>('dashboard');
    const [showDowntimeModal, setShowDowntimeModal] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showQuantityPrompt, setShowQuantityPrompt] = useState(false);
    const [pendingShiftEnd, setPendingShiftEnd] = useState<string | null>(null);
    const [showPartsRequestModal, setShowPartsRequestModal] = useState(false);
    const [showShiftReportsModal, setShowShiftReportsModal] = useState(false);
    const [lastShiftEndPromptDate, setLastShiftEndPromptDate] = useState<string | null>(null);
    const [showManagerAuthForShiftEnd, setShowManagerAuthForShiftEnd] = useState(false);

    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);
    const [showTrefilaCalculation, setShowTrefilaCalculation] = useState(false);

    const activeOrder = useMemo(() => productionOrders.find(o => o.machine === machineType && o.status === 'in_progress'), [productionOrders, machineType]);
    const pendingOrders = useMemo(() => productionOrders.filter(o => o.machine === machineType && o.status === 'pending').sort((a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime()), [productionOrders, machineType]);
    const completedOrders = useMemo(() => productionOrders.filter(o => o.machine === machineType && o.status === 'completed').sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime()), [productionOrders, machineType]);

    const postProductionOrder = useMemo(() => {
        if (activeOrder || !currentUser) return null;

        const completed = productionOrders
            .filter(o => o.status === 'completed' && o.machine === machineType && o.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        for (const order of completed) {
            const hasOpenLog = (order.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime);
            if (hasOpenLog) {
                return order;
            }
        }
        return null;
    }, [productionOrders, activeOrder, currentUser, machineType]);

    const orderForShift = activeOrder || postProductionOrder;

    // FIX: Moved currentOperatorLog and hasActiveShift before their usage in useEffect.
    const currentOperatorLog = useMemo(() => {
        if (!orderForShift || !orderForShift.operatorLogs || orderForShift.operatorLogs.length === 0) {
            return null;
        }
        const userLogs = orderForShift.operatorLogs.filter(log => log.operator === currentUser?.username);
        const lastLog = userLogs.length > 0 ? userLogs[userLogs.length - 1] : null;

        if (lastLog) return lastLog;
        return orderForShift.operatorLogs[orderForShift.operatorLogs.length - 1];
    }, [orderForShift, currentUser]);


    const hasActiveShift = useMemo(() => {
        return currentOperatorLog && currentOperatorLog.operator === currentUser?.username && !currentOperatorLog.endTime;
    }, [currentOperatorLog, currentUser]);

    const [timer, setTimer] = useState(new Date());

    const activeLotProcessingData = useMemo(() => {
        if (activeOrder?.activeLotProcessing?.lotId) {
            const lotInfo = stock.find(s => s.id === activeOrder.activeLotProcessing!.lotId);
            return lotInfo ? { ...activeOrder.activeLotProcessing, lotInfo } : null;
        }
        return null;
    }, [activeOrder, stock]);

    const isMachineStopped = useMemo(() => {
        if (!activeOrder?.downtimeEvents || activeOrder.downtimeEvents.length === 0) {
            return false;
        }
        const lastEvent = activeOrder.downtimeEvents[activeOrder.downtimeEvents.length - 1];

        if (lastEvent.resumeTime !== null) {
            return false;
        }

        const automaticIdleReasons = ['Aguardando Início da Produção', 'Troca de Rolo / Preparação'];

        return !automaticIdleReasons.includes(lastEvent.reason);
    }, [activeOrder]);


    useEffect(() => {
        if (orderForShift) {
            const interval = setInterval(() => setTimer(new Date()), 1000);
            return () => clearInterval(interval);
        }
    }, [orderForShift]);

    useEffect(() => {
        if (activeOrder && !isMachineStopped && hasActiveShift) {
            const interval = setInterval(() => {
                setShowQuantityPrompt(true);
            }, 10 * 60 * 1000); // 10 minutes

            return () => clearInterval(interval);
        }
    }, [activeOrder, isMachineStopped, hasActiveShift]);

    useEffect(() => {
        if (activeOrder && hasActiveShift && !showQuantityPrompt) {
            const now = timer;
            const shiftEnd = new Date(now);
            shiftEnd.setHours(17, 30, 0, 0);

            const todayStr = now.toISOString().split('T')[0];
            if (now >= shiftEnd && lastShiftEndPromptDate !== todayStr) {
                const shiftStartTime = currentOperatorLog ? new Date(currentOperatorLog.startTime).getTime() : 0;
                if (shiftStartTime < shiftEnd.getTime()) {
                    setShowQuantityPrompt(true);
                    setLastShiftEndPromptDate(todayStr); // Only mark as shown if we actually show it
                } else {
                    // Start date is later than shift end (Overtime), so mark as handled to avoid loop
                    setLastShiftEndPromptDate(todayStr);
                }
            }
        }
    }, [timer, activeOrder, hasActiveShift, lastShiftEndPromptDate, showQuantityPrompt]);

    useEffect(() => {
        if (justCompletedOrderId) {
            const completedOrder = completedOrders.find(o => o.id === justCompletedOrderId);
            if (completedOrder) {
                setProductionReportData(completedOrder);
                setJustCompletedOrderId(null);
            }
        }
    }, [completedOrders, justCompletedOrderId]);

    useEffect(() => {
        if (initialView) setView(initialView);
    }, [initialView]);

    useEffect(() => {
        if (initialModal === 'reports') {
            setShowShiftReportsModal(true);
            setShowPartsRequestModal(false);
        } else if (initialModal === 'parts') {
            setShowPartsRequestModal(true);
            setShowShiftReportsModal(false);
        } else if (initialModal === null) {
            setShowShiftReportsModal(false);
            setShowPartsRequestModal(false);
        }
    }, [initialModal]);

    const shiftStatus = useMemo(() => {
        const now = timer;
        const day = now.getDay();
        const isWeekday = day >= 1 && day <= 5;

        // Use actual shift start if available, otherwise default to 07:45
        const actualStart = currentOperatorLog ? new Date(currentOperatorLog.startTime) : null;
        const defaultStart = new Date(now);
        defaultStart.setHours(7, 45, 0, 0);

        const shiftStart = actualStart || defaultStart;

        // Target end is 17:30 OR start + duration? Stick to 17:30 for standard shift visual
        const shiftEnd = new Date(now);
        shiftEnd.setHours(17, 30, 0, 0);

        const nowMs = now.getTime();
        const startMs = shiftStart.getTime();
        const endMs = shiftEnd.getTime();

        const totalShiftDuration = endMs - startMs;
        const elapsedSinceStart = nowMs - startMs;

        let progress = 0;
        let isOvertime = false;
        let timeStatusText = '';

        if (isWeekday && nowMs <= endMs) {
            // Normal shift progress
            if (nowMs < startMs) {
                timeStatusText = `Turno inicia em ${formatDuration(startMs - nowMs)}`;
            } else {
                progress = (elapsedSinceStart / totalShiftDuration) * 100;
                const remainingMs = endMs - nowMs;
                timeStatusText = `Faltam ${formatDuration(remainingMs)} para o fim do turno`;
            }
        } else {
            // Overtime or Weekend
            progress = 100;
            isOvertime = true;
            if (nowMs > endMs) {
                timeStatusText = `+${formatDuration(nowMs - endMs)} de hora extra`;
            } else {
                // Should be covered by weekday check, but fallback
                timeStatusText = 'Hora Extra';
            }
            if (!isWeekday) {
                timeStatusText = 'Trabalho em fim de semana (Hora Extra)';
            }
        }

        return {
            isOvertime,
            progress: Math.max(0, Math.min(100, progress)),
            timeStatusText,
        };
    }, [timer, currentOperatorLog]);


    const { waitingLots, completedLots } = useMemo(() => {
        if (!activeOrder || activeOrder.machine !== 'Trefila') return { waitingLots: [], completedLots: [] };

        const processedLotIds = new Set(activeOrder.processedLots?.map(p => p.lotId) || []);
        const allOrderLots = stock.filter(s => (activeOrder.selectedLotIds as string[]).includes(s.id));

        const waiting = allOrderLots.filter(lot => !processedLotIds.has(lot.id) && lot.id !== activeLotProcessingData?.lotId);

        const completed = (activeOrder.processedLots || []).map(processedLot => {
            const lotInfo = stock.find(s => s.id === processedLot.lotId);
            return { ...processedLot, lotInfo };
        }).filter(item => item.lotInfo);

        return { waitingLots: waiting, completedLots: completed };
    }, [activeOrder, stock, activeLotProcessingData]);

    const trelicaPackages = useMemo(() => {
        if (!activeOrder || activeOrder.machine !== 'Treliça') return [];

        const PACKAGE_SIZE = 200;
        const totalQuantity = activeOrder.quantityToProduce || 0;
        const numPackages = Math.ceil(totalQuantity / PACKAGE_SIZE);

        return Array.from({ length: numPackages }, (_, i) => {
            const packageNumber = i + 1;
            const isLast = i === numPackages - 1;
            const qty = (isLast && totalQuantity % PACKAGE_SIZE !== 0) ? totalQuantity % PACKAGE_SIZE : PACKAGE_SIZE;
            const weighedPackage = (activeOrder.weighedPackages || []).find(p => p.packageNumber === packageNumber);

            return {
                packageNumber,
                quantity: qty,
                status: weighedPackage ? 'Concluído' : 'Aguardando Pesagem' as 'Concluído' | 'Aguardando Pesagem',
                weight: weighedPackage ? weighedPackage.weight : null
            };
        });
    }, [activeOrder]);

    const allTrefilaLotsProcessed = useMemo(() => {
        if (!activeOrder || activeOrder.machine !== 'Trefila' || !Array.isArray(activeOrder.selectedLotIds)) return false;
        const totalLots = activeOrder.selectedLotIds.length;
        if (totalLots === 0) return false;
        const weighedLots = (activeOrder.processedLots || []).filter(l => l.finalWeight !== null).length;
        return totalLots === weighedLots;
    }, [activeOrder]);

    const allPackagesWeighed = useMemo(() => {
        if (machineType !== 'Treliça' || !activeOrder) return false;
        return trelicaPackages.every(p => p.status === 'Concluído');
    }, [trelicaPackages, activeOrder, machineType]);

    const isCompletionDisabled = useMemo(() => {
        if (isMachineStopped || !hasActiveShift) return true;
        if (machineType === 'Treliça') return !allPackagesWeighed;
        if (machineType === 'Trefila') return !allTrefilaLotsProcessed;
        return true;
    }, [isMachineStopped, hasActiveShift, machineType, allPackagesWeighed, allTrefilaLotsProcessed]);

    const handleStopMachine = (reason: string) => {
        if (activeOrder && logDowntime) {
            logDowntime(activeOrder.id, reason);
            setShowDowntimeModal(false);
        }
    }

    const handlePartsRequestSubmit = (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status' | 'machine' | 'productionOrderId'>) => {
        if (addPartsRequest && activeOrder) {
            addPartsRequest({
                ...data,
            });
            setShowPartsRequestModal(false);
        }
    };


    const handleStartProcessingLot = (lotId: string) => {
        if (activeOrder && startLotProcessing) {
            startLotProcessing(activeOrder.id, lotId);
        }
    }

    const handleFinishLotProcess = () => {
        if (activeOrder && activeLotProcessingData && finishLotProcessing) {
            finishLotProcessing(activeOrder.id, activeLotProcessingData.lotId);
        }
    }

    const handleTrefilaComplete = () => {
        if (activeOrder && completeProduction) {
            setJustCompletedOrderId(activeOrder.id);
            completeProduction(activeOrder.id, {});
        }
    };

    const handleCompleteProduction = (data: { actualProducedQuantity?: number, pontas?: Ponta[] }) => {
        if (activeOrder && completeProduction) {
            completeProduction(activeOrder.id, data);
            setShowCompletionModal(false);
        }
    }

    const handleShiftEndRequest = (orderId: string) => {
        // Only apply restriction for Treliça machine
        if (machineType !== 'Treliça') {
            setPendingShiftEnd(orderId);
            setShowQuantityPrompt(true);
            return;
        }

        if (!currentOperatorLog) {
            // Should not happen if ending active shift, but fallback
            setPendingShiftEnd(orderId);
            setShowQuantityPrompt(true);
            return;
        }

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
            // Overtime/Weekend shifts are flexible, allow ending anytime
            setPendingShiftEnd(orderId);
            setShowQuantityPrompt(true);
            return;
        }

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Define Core Shift Hours: 07:00 to 17:30 (Weekdays only)
        // We only require password if attempting to leave EARLY within this window.
        const isWithinCoreHours = (currentHour > 7 || (currentHour === 7)) && (currentHour < 17 || (currentHour === 17 && currentMinute < 30));

        if (isWithinCoreHours) {
            setPendingShiftEnd(orderId);
            setShowManagerAuthForShiftEnd(true);
        } else {
            // After 17:30 or Before 07:00
            setPendingShiftEnd(orderId);
            setShowQuantityPrompt(true);
        }
    };

    const handleManagerAuthSuccess = () => {
        setShowManagerAuthForShiftEnd(false);
        setShowQuantityPrompt(true);
    };

    const handleUpdateQuantity = (shiftQuantity: number) => {
        const targetOrder = pendingShiftEnd ? (productionOrders.find(o => o.id === pendingShiftEnd)) : activeOrder;

        if (targetOrder && updateProducedQuantity) {
            const startQty = currentOperatorLog?.startQuantity || 0;
            const newTotal = startQty + shiftQuantity;

            updateProducedQuantity(targetOrder.id, newTotal);

            if (pendingShiftEnd && endOperatorShift) {
                endOperatorShift(targetOrder.id, newTotal);
                setPendingShiftEnd(null);
            }

            setShowQuantityPrompt(false);
        }
    };

    const viewTitles: Record<View, string> = {
        dashboard: `Painel da Máquina ${machineType}`,
        in_progress: postProductionOrder ? 'Atividade Pós-Produção' : 'Ordem em Produção',
        pending: 'Próximas Produções',
        completed: 'Produções Finalizadas',
    };

    const machineHeader = machineType === 'Trefila' ? "Produção maquina DHTRF (TREFILA)" : "Produção maquina DHSTR (TRELIÇA)";

    const promptOrder = pendingShiftEnd ? (productionOrders.find(o => o.id === pendingShiftEnd)) : activeOrder;

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {showTrefilaCalculation && <TrefilaCalculation onClose={() => setShowTrefilaCalculation(false)} />}
            {showDowntimeModal && <DowntimeModal onClose={() => setShowDowntimeModal(false)} onSubmit={handleStopMachine} />}
            {showCompletionModal && activeOrder && <CompletionModal order={activeOrder} onClose={() => setShowCompletionModal(false)} onSubmit={handleCompleteProduction} />}
            {showQuantityPrompt && promptOrder && (
                <QuantityPromptModal
                    onClose={() => setShowQuantityPrompt(false)}
                    onSubmit={handleUpdateQuantity}
                    currentQuantity={Math.max(0, (promptOrder.actualProducedQuantity || 0) - (currentOperatorLog?.startQuantity || 0))}
                />
            )}
            {showPartsRequestModal && activeOrder && (
                <PartsRequestModal
                    order={activeOrder}
                    onClose={() => setShowPartsRequestModal(false)}
                    onSubmit={handlePartsRequestSubmit}
                />
            )}
            {showShiftReportsModal && (
                <ShiftReportsModal
                    reports={(shiftReports || []).filter(r => r.machine === machineType)}
                    stock={stock}
                    onClose={() => setShowShiftReportsModal(false)}
                    onDelete={deleteShiftReport}
                />
            )}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                />
            )}
            {managerOverrideData && (
                <ManagerOverrideModal
                    users={users}
                    data={{
                        actualWeight: managerOverrideData.weight,
                        lowerBound: managerOverrideData.lowerBound,
                        upperBound: managerOverrideData.upperBound,
                    }}
                    onSuccess={() => {
                        executeRecordPackageWeight(managerOverrideData);
                        setManagerOverrideData(null);
                    }}
                    onCancel={() => setManagerOverrideData(null)}
                />
            )}
            {showManagerAuthForShiftEnd && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription="O turno encerra às 17:30. É necessária autorização de um gestor para encerrá-lo antecipadamente."
                    onSuccess={handleManagerAuthSuccess}
                    onCancel={() => {
                        setShowManagerAuthForShiftEnd(false);
                        setPendingShiftEnd(null);
                    }}
                />
            )}


            {/* Removed redundant internal header because Sidebar and Top Bar provide navigation */}

            {view === 'dashboard' && (
                <div className="space-y-6">
                    {activeOrder && !hasActiveShift && (
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                            <h3 className="text-xl font-semibold text-slate-800 mb-4">A ordem <span className="font-bold text-slate-600">{activeOrder.orderNumber}</span> está em andamento.</h3>
                            <button onClick={() => startOperatorShift && startOperatorShift(activeOrder.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition text-lg">
                                Iniciar Meu Turno
                            </button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <MachineMenuButton
                            onClick={() => setView('in_progress')}
                            label={postProductionOrder ? "Atividade Pós-Produção" : "Em Produção"}
                            description={postProductionOrder ? "Registre atividades enquanto aguarda o fim do turno." : "Acompanhe a ordem ativa, registre paradas e processe lotes."}
                            icon={<CogIcon className={`h-6 w-6 ${activeOrder ? 'animate-spin' : ''}`} />}
                            disabled={!activeOrder && !postProductionOrder}
                        />
                        <MachineMenuButton
                            onClick={() => setView('pending')}
                            label="Próximas Produções"
                            description="Visualize e inicie as próximas ordens de produção na fila."
                            icon={<ClipboardListIcon className="h-6 w-6" />}
                        />
                        {machineType === 'Trefila' && (
                            <MachineMenuButton
                                onClick={() => setShowTrefilaCalculation(true)}
                                label="Cálculo de Trefilação"
                                description="Simulação e otimização de passes de redução."
                                icon={<CalculatorIcon className="h-6 w-6" />}
                            />
                        )}
                    </div>
                </div>
            )}

            {view === 'in_progress' && (
                <>
                    {activeOrder ? (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-32"> {/* Added pb-32 for bottom bar space */}
                                {/* Coluna Esquerda: Visão Geral e Indicadores */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Card de Status Principal - Novo Design */}
                                    <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-[12px] ${isMachineStopped ? 'border-amber-500' : 'border-emerald-500'} relative overflow-hidden transition-all duration-500`}>
                                        {!isMachineStopped && (
                                            <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50 blur-3xl animate-pulse"></div>
                                        )}
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Status do Equipamento</h3>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex h-4 w-4">
                                                        {!isMachineStopped && <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                                        <span className={`relative inline-flex rounded-full h-4 w-4 ${isMachineStopped ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}></span>
                                                    </div>
                                                    <span className={`text-2xl md:text-3xl font-black tracking-tighter ${isMachineStopped ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                        {isMachineStopped ? 'PARADA' : 'OPERANDO'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Carga Ativa</h3>
                                                <p className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter">#{activeOrder.orderNumber}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 md:gap-4 mt-6 p-3 md:p-4 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="text-[10px] md:text-xs text-slate-500 mb-1">Operador</p>
                                                <p className="text-sm md:text-base font-semibold text-slate-700 truncate">{currentOperatorLog?.operator || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] md:text-xs text-slate-500 mb-1">Início Turno</p>
                                                <p className="text-sm md:text-base font-semibold text-slate-700">{currentOperatorLog ? new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                                            </div>
                                            {machineType === 'Trefila' ? (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] md:text-xs text-slate-500 mb-1">Bitola Saída</p>
                                                        <p className="text-sm md:text-base font-semibold text-slate-700">{activeOrder.targetBitola}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] md:text-xs text-slate-500 mb-1">Meta</p>
                                                        <p className="text-sm md:text-base font-semibold text-slate-700">{activeOrder.totalWeight.toFixed(0)} kg</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] md:text-xs text-slate-500 mb-1">Produto</p>
                                                        <p className="text-sm md:text-base font-semibold text-slate-700 truncate">{activeOrder.trelicaModel} ({activeOrder.tamanho}m)</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progresso de Produção - Promovido para destaque - ESCONDIDO NO MOBILE */}
                                    <div className="bg-white p-6 rounded-2xl shadow-sm relative overflow-hidden group hidden md:block">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                                            <ChartBarIcon className="h-16 w-16" />
                                        </div>

                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            Performance de Produção
                                        </h3>

                                        {machineType === 'Treliça' ? (
                                            <div className="space-y-6">
                                                <div className="relative pt-2">
                                                    <div className="flex items-end justify-between mb-3">
                                                        <div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Peças no Turno</span>
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                                                        {Math.max(0, (activeOrder.actualProducedQuantity || 0) - (currentOperatorLog?.startQuantity || 0))}
                                                                    </span>
                                                                    <span className="text-2xl font-black text-slate-300 uppercase tracking-widest">pçs</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progresso Total da Ordem</span>
                                                                    <div className="flex items-baseline gap-1.5">
                                                                        <span className="text-lg font-black text-slate-600">{activeOrder.actualProducedQuantity || 0}</span>
                                                                        <span className="text-xs font-bold text-slate-300">/ {activeOrder.quantityToProduce}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md mb-1">Peças Concluídas</span>
                                                            <span className="text-xs font-bold text-slate-400">Progresso da Ordem</span>
                                                        </div>
                                                    </div>
                                                    {(() => {
                                                        const produced = activeOrder.actualProducedQuantity || 0;
                                                        const planned = activeOrder.quantityToProduce || 1;
                                                        const progress = Math.min(100, (produced / planned) * 100);
                                                        return (
                                                            <div className="w-full bg-slate-100 rounded-2xl h-8 overflow-hidden p-1 border border-slate-50">
                                                                <div
                                                                    className="bg-indigo-600 h-full rounded-xl transition-all duration-1000 ease-out flex items-center justify-end pr-3 shadow-lg shadow-indigo-100 relative overflow-hidden"
                                                                    style={{ width: `${progress}%` }}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                                                    {progress > 12 && <span className="text-white text-[10px] font-black uppercase tracking-tighter">{progress.toFixed(0)}%</span>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Produzido</p>
                                                        <span className="text-4xl font-black text-slate-900 tracking-tighter">
                                                            {(activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(1)}
                                                            <span className="text-lg text-slate-300 ml-1">kg</span>
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Lote</p>
                                                        <span className="text-xl font-bold text-slate-600 tracking-tight">
                                                            {activeOrder.totalWeight.toFixed(1)} <span className="text-sm font-medium">kg</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-2xl h-8 overflow-hidden p-1 border border-slate-50">
                                                    {(() => {
                                                        const produced = (activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0);
                                                        const planned = activeOrder.totalWeight || 1;
                                                        const progress = Math.min(100, (produced / planned) * 100);
                                                        return (
                                                            <div
                                                                className="bg-indigo-600 h-full rounded-xl transition-all duration-1000 ease-out flex items-center justify-end pr-3 shadow-lg shadow-indigo-100 relative overflow-hidden"
                                                                style={{ width: `${progress}%` }}
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                                                {progress > 12 && <span className="text-white text-[10px] font-black uppercase tracking-tighter">{progress.toFixed(0)}%</span>}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {hasActiveShift && (
                                        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200 hidden md:block">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                                <span>Tempo de Operação</span>
                                                <ClockIcon className="h-4 w-4 text-slate-600" />
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-baseline">
                                                    <p className="font-mono text-white font-black text-3xl tracking-tighter">{shiftStatus.timeStatusText}</p>
                                                    {shiftStatus.isOvertime && <span className="text-[10px] font-black bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/30">EXTRA</span>}
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div className={`h-full transition-all duration-700 ${shiftStatus.isOvertime ? 'bg-red-500' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} style={{ width: `${shiftStatus.progress}%` }}></div>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-widest">Turno: 07:45 - 17:30</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
                                            <ClockIcon className="h-5 w-5 text-amber-500" /> Histórico de Paradas Recentes
                                        </h3>
                                        <div className="max-h-[500px] md:max-h-48 overflow-y-auto custom-scrollbar">
                                            {activeOrder.downtimeEvents && activeOrder.downtimeEvents.length > 0 ? (
                                                <>
                                                    {/* Desktop Table View */}
                                                    <table className="w-full text-sm hidden sm:table">
                                                        <thead className="text-left sticky top-0 bg-white shadow-sm">
                                                            <tr className="text-xs text-slate-400 uppercase">
                                                                <th className="p-2 font-semibold whitespace-nowrap">Motivo</th>
                                                                <th className="p-2 font-semibold whitespace-nowrap text-right">Duração</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {[...activeOrder.downtimeEvents].reverse().slice(0, 5).map((event, index) => { // Show only last 5
                                                                const stop = new Date(event.stopTime);
                                                                const resume = event.resumeTime ? new Date(event.resumeTime) : new Date();
                                                                const durationMs = resume.getTime() - stop.getTime();
                                                                return (
                                                                    <tr key={index}>
                                                                        <td className="p-2 max-w-[150px] truncate font-medium text-slate-700" title={event.reason}>{event.reason}</td>
                                                                        <td className="p-2 text-right font-mono text-slate-500 whitespace-nowrap">{formatDuration(durationMs)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card View */}
                                                    <div className="space-y-2 sm:hidden">
                                                        {[...activeOrder.downtimeEvents].reverse().slice(0, 5).map((event, index) => {
                                                            const stop = new Date(event.stopTime);
                                                            const resume = event.resumeTime ? new Date(event.resumeTime) : new Date();
                                                            const durationMs = resume.getTime() - stop.getTime();
                                                            return (
                                                                <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                                                                    <div className="overflow-hidden mr-2">
                                                                        <p className="font-bold text-slate-700 text-sm truncate">{event.reason}</p>
                                                                        <p className="text-xs text-slate-400 mt-0.5">{stop.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {resume.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                    </div>
                                                                    <div className="font-mono text-slate-600 font-bold bg-white px-2 py-1 rounded shadow-sm text-xs whitespace-nowrap">
                                                                        {formatDuration(durationMs)}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-sm text-slate-400 text-center py-4 italic">Sem paradas recentes.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Coluna Direita: Área de Trabalho (Lotes/Pacotes) - ESCONDIDA NO MOBILE PARA FOCO NO STATUS */}
                                <div className="lg:col-span-2 space-y-6 relative">
                                    {isMachineStopped && (
                                        <div className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20 border-2 border-slate-300 border-dashed">
                                            <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm mx-auto animate-fade-in-up">
                                                <div className="bg-amber-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <PauseIcon className="h-10 w-10 text-amber-600" />
                                                </div>
                                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Produção Pausada</h3>
                                                <p className="text-slate-500 mb-6">A máquina está parada. Utilize o painel inferior para retomar a produção quando estiver pronto.</p>
                                            </div>
                                        </div>
                                    )}
                                    {!hasActiveShift && activeOrder && (
                                        <div className="absolute inset-0 bg-slate-200/90 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20">
                                            <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-md mx-auto">
                                                <ClockIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Turno Não Iniciado</h3>
                                                <p className="text-slate-500 mb-6">Inicie seu turno para liberar os controles da máquina.</p>
                                                <button onClick={handleStartShift} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition text-lg shadow-lg flex items-center justify-center gap-3">
                                                    <PlayIcon className="h-6 w-6" /> INICIAR MEU TURNO
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {machineType === 'Trefila' ? (
                                        <>
                                            <div className="bg-white p-6 rounded-2xl shadow-sm">
                                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                    <CogIcon className="h-6 w-6 text-slate-400" /> Lote em Processamento
                                                </h3>
                                                {activeLotProcessingData ? (
                                                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl">
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                            <div>
                                                                <span className="text-xs font-bold text-indigo-500 bg-indigo-100 px-2 py-1 rounded uppercase tracking-wide">Em Andamento</span>
                                                                <h4 className="text-2xl font-bold text-slate-800 mt-2">{activeLotProcessingData.lotInfo.internalLot}</h4>
                                                                <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                                                    <ClockIcon className="h-4 w-4" /> Iniciado às {new Date(activeLotProcessingData.startTime).toLocaleTimeString('pt-BR')}
                                                                </p>
                                                            </div>
                                                            <button onClick={handleFinishLotProcess} disabled={isMachineStopped || !hasActiveShift} className="w-full md:w-auto bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none">
                                                                <CheckCircleIcon className="h-5 w-5" /> Finalizar Lote
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-slate-400 py-12 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                        <h4 className="font-medium text-lg">Nenhum lote sendo processado</h4>
                                                        <p className="text-sm mt-1">Selecione um lote da fila abaixo para iniciar.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-white p-6 rounded-2xl shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-700 mb-4">Fila de Lotes (Matéria-Prima)</h3>
                                                <div className="overflow-x-auto">
                                                    {waitingLots.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {waitingLots.map(lot => (
                                                                <div key={lot.id} className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition bg-slate-50 group">
                                                                    <div className="flex justify-between items-start mb-3">
                                                                        <span className="font-bold text-slate-700 text-lg">{lot.internalLot}</span>
                                                                        <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md font-mono">{lot.labelWeight.toFixed(1)} kg</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleStartProcessingLot(lot.id)}
                                                                        disabled={!!activeLotProcessingData || isMachineStopped || !hasActiveShift}
                                                                        className="w-full bg-white border-2 border-slate-200 text-slate-600 group-hover:border-indigo-500 group-hover:text-indigo-600 font-bold py-2 px-4 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        Processar
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-slate-500 py-6">Nenhum lote aguardando.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-700 mb-4">Lotes Finalizados</h3>
                                                <div className="overflow-x-auto max-h-80">
                                                    {/* Desktop Table */}
                                                    <table className="w-full text-sm hidden sm:table">
                                                        <thead className="bg-slate-50 text-left sticky top-0">
                                                            <tr>
                                                                <th className="p-3 font-semibold rounded-tl-lg">Lote</th>
                                                                <th className="p-3 font-semibold text-right">Peso Final</th>
                                                                <th className="p-3 font-semibold">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {completedLots.map(lot => (
                                                                <tr key={lot.lotId}>
                                                                    <td className="p-3 font-medium">{lot.lotInfo?.internalLot}</td>
                                                                    <td className="p-3">
                                                                        {lot.finalWeight === null ? (
                                                                            <input
                                                                                type="number"
                                                                                className="w-full p-2 border rounded-lg text-right"
                                                                                placeholder="0.00"
                                                                                value={pendingWeights.get(lot.lotId) || ''}
                                                                                onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                            />
                                                                        ) : (
                                                                            <div className="text-right font-bold text-slate-700">{lot.finalWeight.toFixed(2)} kg</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        {lot.finalWeight === null ? (
                                                                            <button onClick={() => handleRecordWeight(lot.lotId)} className="bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg hover:bg-emerald-600 w-full">
                                                                                Salvar
                                                                            </button>
                                                                        ) : (
                                                                            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card List */}
                                                    <div className="flex flex-col gap-3 sm:hidden">
                                                        {completedLots.map(lot => (
                                                            <div key={lot.lotId} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col gap-3">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-bold text-slate-700 text-lg">{lot.lotInfo?.internalLot}</span>
                                                                    {lot.finalWeight !== null && (
                                                                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-lg">
                                                                            <CheckCircleIcon className="h-4 w-4" /> Salvo
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2 items-end">
                                                                    <div className="flex-1">
                                                                        <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Peso Final (kg)</label>
                                                                        {lot.finalWeight === null ? (
                                                                            <input
                                                                                type="number"
                                                                                className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-medium focus:border-emerald-500 focus:ring-0"
                                                                                placeholder="0.00"
                                                                                value={pendingWeights.get(lot.lotId) || ''}
                                                                                onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                            />
                                                                        ) : (
                                                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-lg font-bold text-slate-700 text-center">
                                                                                {lot.finalWeight.toFixed(2)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {lot.finalWeight === null && (
                                                                        <button onClick={() => handleRecordWeight(lot.lotId)} className="h-[52px] px-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition">
                                                                            <SaveIcon className="h-6 w-6" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-700 mb-4">Registro de Pacotes</h3>
                                                <p className="text-sm text-slate-500 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2">
                                                    <ExclamationIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                                    Pese cada pacote de 200 peças e registre abaixo.
                                                </p>
                                                <div className="overflow-auto max-h-[500px] md:border border-slate-100 rounded-xl">
                                                    {/* Desktop Table View */}
                                                    <table className="w-full text-sm hidden md:table">
                                                        <thead className="bg-slate-50 text-left sticky top-0 z-10">
                                                            <tr>
                                                                <th className="p-4 font-bold text-slate-600">Pacote #</th>
                                                                <th className="p-4 font-bold text-slate-600">Qtd.</th>
                                                                <th className="p-4 font-bold text-slate-600">Peso (kg)</th>
                                                                <th className="p-4 font-bold text-slate-600 text-center">Ação</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {trelicaPackages.map(pkg => (
                                                                <tr key={pkg.packageNumber} className={pkg.status === 'Concluído' ? 'bg-slate-50/50' : 'bg-white'}>
                                                                    <td className="p-4 font-bold text-slate-700 text-lg">#{pkg.packageNumber}</td>
                                                                    <td className="p-4 text-slate-600">{pkg.quantity} pçs</td>
                                                                    <td className="p-4">
                                                                        {pkg.status === 'Concluído' ? (
                                                                            <span className="font-mono font-bold text-slate-700 text-lg">{pkg.weight?.toFixed(2)}</span>
                                                                        ) : (
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="number"
                                                                                    inputMode="decimal"
                                                                                    step="0.01"
                                                                                    value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                    onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-medium focus:border-indigo-500 focus:ring-0 transition"
                                                                                    placeholder="0.00"
                                                                                />
                                                                                <span className="absolute right-3 top-3.5 text-slate-400 text-sm font-bold">kg</span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 text-center">
                                                                        {pkg.status === 'Concluído' ? (
                                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 uppercase tracking-wide">
                                                                                OK
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                                className="bg-indigo-600 text-white text-sm font-bold py-2 px-4 rounded-xl hover:bg-indigo-700 shadow-md transition w-full"
                                                                            >
                                                                                Salvar
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card View for Packages */}
                                                    <div className="flex flex-col gap-4 md:hidden pb-4">
                                                        {trelicaPackages.map(pkg => (
                                                            <div key={pkg.packageNumber} className={`p-4 rounded-2xl border-2 ${pkg.status === 'Concluído' ? 'bg-slate-50 border-slate-100' : 'bg-white border-indigo-50 shadow-sm'}`}>
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="bg-slate-200 text-slate-600 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm">#{pkg.packageNumber}</span>
                                                                        <span className="text-slate-500 text-sm">{pkg.quantity} pçs</span>
                                                                    </div>
                                                                    {pkg.status === 'Concluído' && (
                                                                        <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg text-xs uppercase tracking-wide">
                                                                            <CheckCircleIcon className="h-4 w-4" /> Registrado
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {pkg.status === 'Concluído' ? (
                                                                    <div className="flex items-end justify-between">
                                                                        <span className="text-xs text-slate-400 uppercase font-bold">Peso Registrado</span>
                                                                        <span className="text-2xl font-mono font-bold text-slate-700">{pkg.weight?.toFixed(2)} <span className="text-sm">kg</span></span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex gap-2 items-end">
                                                                        <div className="flex-1 relative">
                                                                            <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Peso (kg)</label>
                                                                            <input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                step="0.01"
                                                                                value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                className="w-full h-12 pl-3 pr-10 border-2 border-slate-200 rounded-xl text-xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-0 transition"
                                                                                placeholder="0.00"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                            className="h-12 px-5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition flex items-center justify-center"
                                                                        >
                                                                            <CheckCircleIcon className="h-6 w-6" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Sticky Action Deck (Spotify Style) - Revised for Mobile */}
                            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 px-3 py-2 md:p-4 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-40 transition-all duration-500 safe-area-bottom">
                                <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">

                                    {/* Esquerda: Info Rápida (Desktop only) */}
                                    <div className="hidden md:flex items-center gap-4 w-1/4">
                                        <div className={`w-1.5 h-10 rounded-full ${isMachineStopped ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`}></div>
                                        <div className="truncate">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Status em Tempo Real</p>
                                            <p className={`text-sm font-black leading-tight truncate ${isMachineStopped ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                {isMachineStopped ? 'MÁQUINA PARADA' : 'ESTADO ATIVO'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Centro: Controles Principais (Expanded on mobile) */}
                                    <div className="flex-1 md:flex-none flex items-center justify-center md:w-1/2">
                                        {!hasActiveShift ? (
                                            <button
                                                onClick={handleStartShift}
                                                className="w-full md:w-auto md:px-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl md:rounded-full font-black text-lg shadow-xl shadow-emerald-200 transition transform active:scale-90 hover:scale-[1.02] flex items-center justify-center gap-3 animate-pulse"
                                            >
                                                <PlayIcon className="h-8 w-8" />
                                                <span className="inline tracking-tight">INICIAR TURNO</span>
                                            </button>
                                        ) : isMachineStopped ? (
                                            <button
                                                onClick={() => logResumeProduction && logResumeProduction(activeOrder.id)}
                                                className="w-full md:w-auto md:px-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl md:rounded-full font-black text-lg shadow-xl shadow-emerald-200 transition transform active:scale-90 hover:scale-[1.02] flex items-center justify-center gap-3"
                                            >
                                                <PlayIcon className="h-8 w-8" />
                                                <span className="inline tracking-tight">RETORNAR</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowDowntimeModal(true)}
                                                className="w-full md:w-auto md:px-14 h-14 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl md:rounded-full font-black text-lg shadow-xl shadow-amber-200 transition transform active:scale-90 hover:scale-[1.02] flex items-center justify-center gap-3"
                                            >
                                                <PauseIcon className="h-8 w-8" />
                                                <span className="inline tracking-tight">PARAR MÁQUINA</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Direita: Ações Secundárias */}
                                    <div className="flex items-center justify-end gap-1 sm:gap-4 w-auto md:w-1/4">


                                        <div className="h-8 w-px bg-slate-200/60 hidden md:block"></div>

                                        <button
                                            onClick={() => {
                                                if (machineType === 'Trefila') handleTrefilaComplete();
                                                else setShowCompletionModal(true);
                                            }}
                                            disabled={isCompletionDisabled}
                                            className="hidden md:flex bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 shadow-lg shadow-slate-200 transition items-center gap-2 disabled:opacity-30 disabled:grayscale active:scale-95"
                                        >
                                            <CheckCircleIcon className="h-5 w-5" />
                                            <span>FECHAR ORDEM</span>
                                        </button>

                                        {/* Mobile Finish Button (Icon Only) */}
                                        <button
                                            onClick={() => {
                                                if (machineType === 'Trefila') handleTrefilaComplete();
                                                else setShowCompletionModal(true);
                                            }}
                                            disabled={isCompletionDisabled}
                                            className="md:hidden p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition disabled:opacity-30 active:scale-90 shadow-lg shadow-slate-200"
                                            title="Finalizar Ordem"
                                        >
                                            <CheckCircleIcon className="h-7 w-7" />
                                        </button>

                                        {hasActiveShift ? (
                                            <button
                                                onClick={() => handleShiftEndRequest(activeOrder.id)}
                                                className="p-3.5 text-red-500 hover:bg-red-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Finalizar Turno"
                                            >
                                                <ClockIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Encerrar</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleStartShift}
                                                className="p-3.5 text-emerald-600 hover:bg-emerald-50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Iniciar Turno"
                                            >
                                                <PlayIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Iniciar</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : postProductionOrder ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Informações do Turno</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-500">Nº Ordem Concluída:</span><span className="font-bold text-slate-800">{postProductionOrder.orderNumber}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Operador:</span><span className="font-bold text-slate-800">{currentOperatorLog?.operator || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Início Turno:</span><span className="font-bold text-slate-800">{currentOperatorLog ? new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR') : 'N/A'}</span></div>
                                    </div>
                                </div>
                                {hasActiveShift && (
                                    <div className="bg-white p-6 rounded-xl shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2"><ClockIcon className="h-5 w-5" /> Status do Turno</h3>
                                        <div className="space-y-3">
                                            <div className="text-center">
                                                <p className="text-sm text-slate-500">Turno Padrão: 07:45 - 17:30</p>
                                                {shiftStatus.isOvertime && <p className="text-sm font-bold text-red-500 animate-pulse">HORA EXTRA</p>}
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-4">
                                                <div className={`h-4 rounded-full ${shiftStatus.isOvertime ? 'bg-red-500' : 'bg-slate-600'}`} style={{ width: `${shiftStatus.progress}%` }}></div>
                                            </div>
                                            <p className="text-center font-mono text-slate-800 font-semibold">{shiftStatus.timeStatusText}</p>
                                            <button onClick={() => handleShiftEndRequest(postProductionOrder.id)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-2">
                                                <ClockIcon className="h-5 w-5" /> Finalizar Meu Turno
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="lg:col-span-2 space-y-6">
                                <IdleActivityLogger
                                    onLogActivity={(activity) => logPostProductionActivity && logPostProductionActivity(activity)}
                                    activities={[...(currentOperatorLog?.postProductionActivities || [])].reverse()}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-10 bg-white rounded-xl shadow-sm">
                            <WarningIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
                            <p>Nenhuma ordem em produção no momento.</p>
                        </div>
                    )}
                </>
            )
            }

            {
                view === 'pending' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        {pendingOrders && pendingOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3">Data Criação</th>
                                            <th className="px-6 py-3">Nº Ordem</th>
                                            <th className="px-6 py-3">{machineType === 'Trefila' ? 'Bitola Saída' : 'Modelo'}</th>
                                            <th className="px-6 py-3 text-right">Peso Total (kg)</th>
                                            <th className="px-6 py-3 text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingOrders.map(order => (
                                            <tr key={order.id} className="bg-white border-b hover:bg-slate-50">
                                                <td className="px-6 py-4">{new Date(order.creationDate).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{order.orderNumber}</td>
                                                <td className="px-6 py-4">{machineType === 'Trefila' ? order.targetBitola : `${order.trelicaModel} (${order.quantityToProduce} pçs)`}</td>
                                                <td className="px-6 py-4 text-right">{order.totalWeight.toFixed(2)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => startProductionOrder && startProductionOrder(order.id)} className="bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition flex items-center justify-center gap-2 mx-auto">
                                                        <PlayIcon className="h-5 w-5" /> Iniciar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10">
                                <WarningIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
                                <p>Nenhuma ordem de produção pendente encontrada.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {
                view === 'completed' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        {completedOrders && completedOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3">Data Finalização</th>
                                            <th className="px-6 py-3">Nº Ordem</th>
                                            <th className="px-6 py-3">{machineType === 'Trefila' ? 'Bitola Saída' : 'Modelo'}</th>
                                            <th className="px-6 py-3 text-right">Peso Planejado (kg)</th>
                                            <th className="px-6 py-3 text-right">Peso Produzido (kg)</th>
                                            <th className="px-6 py-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedOrders.map(order => (
                                            <tr key={order.id} className="bg-white border-b hover:bg-slate-50">
                                                <td className="px-6 py-4">{order.endTime ? new Date(order.endTime).toLocaleDateString('pt-BR') : '-'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{order.orderNumber}</td>
                                                <td className="px-6 py-4">{machineType === 'Trefila' ? order.targetBitola : `${order.trelicaModel} (${order.actualProducedQuantity} pçs)`}</td>
                                                <td className="px-6 py-4 text-right">{machineType === 'Trefila' ? order.totalWeight.toFixed(2) : order.plannedOutputWeight?.toFixed(2) || 'N/A'}</td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-700">{order.actualProducedWeight?.toFixed(2) || 'N/A'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => setProductionReportData(order)} className="text-emerald-600 hover:text-emerald-800 font-semibold py-1 px-3 rounded-md text-xs bg-emerald-50 border border-emerald-200">
                                                        Ver Relatório
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10">
                                <CheckCircleIcon className="h-12 w-12 mx-auto text-emerald-400 mb-2" />
                                <p>Nenhuma ordem de produção foi finalizada ainda.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {showResumePreviousStopModal && previousStopReason && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <WarningIcon className="h-8 w-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Máquina Parada!</h3>
                            <p className="text-slate-600 mb-6">
                                O turno anterior foi finalizado com a máquina parada pelo motivo: <br />
                                <span className="font-bold text-rose-600 block mt-1 text-lg">"{previousStopReason}"</span>
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => confirmResumePreviousStop(false)}
                                    className="flex-1 px-4 py-3 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition"
                                >
                                    Manter Parada
                                </button>
                                <button
                                    onClick={() => confirmResumePreviousStop(true)}
                                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-200 transition"
                                >
                                    Retomar Produção
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showResumePreviousStopModal && previousStopReason && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <WarningIcon className="h-8 w-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Máquina Parada!</h3>
                            <p className="text-slate-600 mb-6">
                                O turno anterior foi finalizado com a máquina parada pelo motivo: <br />
                                <span className="font-bold text-rose-600 block mt-1 text-lg">"{previousStopReason}"</span>
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => confirmResumePreviousStop(false)}
                                    className="flex-1 px-4 py-3 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition"
                                >
                                    Manter Parada
                                </button>
                                <button
                                    onClick={() => confirmResumePreviousStop(true)}
                                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-200 transition"
                                >
                                    Retomar Produção
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineControl;