import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, MachineType, StockItem, ProductionOrderData, User, PartsRequest, ShiftReport, TrelicaSelectedLots, Ponta, StockGauge, Employee, DowntimeConfig, TrelicaSpoolStand, PcpShiftConfig } from '../types';
import { DOWNTIME_THRESHOLDS } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, ClockIcon, WarningIcon, StopIcon, CheckCircleIcon, WrenchScrewdriverIcon, ArchiveIcon, ClipboardListIcon, CogIcon, DocumentReportIcon, ScaleIcon, TrashIcon, CalculatorIcon, ChartBarIcon, ExclamationIcon, SaveIcon, XCircleIcon, ChevronDownIcon, AdjustmentsIcon, ChevronRightIcon } from './icons';
import PartsRequestModal from './PartsRequestModal';
import ShiftReportsModal from './ShiftReportsModal';
import ProductionOrderReport from './ProductionOrderReport';
import { insertItem, deleteItem, updateItem, fetchTable, fetchByColumn, fetchTrelicaSpoolStands } from '../services/supabaseService';
import { checkMachineShiftStatus, resolveMachineShiftConfig } from '../services/shiftConfigService';
import { trelicaModels } from './ProductionOrderTrelica';
import TrefilaCalculation from './TrefilaCalculation';
import TrelicaSpoolStands from './TrelicaSpoolStands';
import TrelicaWeldingHead, { getLocalMachineElectrodes, saveLocalMachineElectrodes } from './TrelicaWeldingHead';


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

// Hardcoded fallback reasons removed in favor of dynamic configs from DB

const DowntimeModal: React.FC<{
    onClose: () => void;
    onSubmit: (reason: string) => void;
    onEndShift?: () => void;
    onPauseOrder?: () => void;
    canPause?: boolean;
    downtimeEvents?: any[];
    downtimeConfigs?: DowntimeConfig[];
    machineType?: string;
}> = ({ onClose, onSubmit, onEndShift, onPauseOrder, canPause, downtimeEvents, downtimeConfigs = [], machineType = 'Geral' }) => {
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [otherReason, setOtherReason] = useState('');
    const [isOtherActive, setIsOtherActive] = useState(false);
    
    const dynamicDowntimeReasons = useMemo(() => {
        // 100% banco de dados - sem fallback hardcoded
        // Se o banco estiver vazio, apenas 'Outros' aparece
        const filtered = (downtimeConfigs || [])
            .filter(c => {
                if (!c.isActive) return false;
                if (c.machineType === 'Geral') return true;
                // machineType pode ser 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2'
                // c.machineType é 'Trefila' ou 'Treliça'
                if (!machineType || !c.machineType) return false;
                return machineType.startsWith(c.machineType);
            })
            .map(c => c.reason);
        // 'Outros' sempre disponível como campo livre
        if (!filtered.includes('Outros')) filtered.push('Outros');
        return filtered;
    }, [downtimeConfigs, machineType]);

    const toggleReason = (r: string) => {
        if (r === 'Outros') {
            setIsOtherActive(!isOtherActive);
            return;
        }
        setSelectedReasons(prev =>
            prev.includes(r) ? prev.filter(item => item !== r) : [...prev, r]
        );
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const reasons = [...selectedReasons];
        if (isOtherActive && otherReason.trim()) {
            reasons.push(otherReason.trim());
        }

        const finalReason = reasons.join(' + ');
        if (!finalReason) {
            alert('Por favor, selecione pelo menos um motivo.');
            return;
        }

        // Check for repeat reasons (excluding ADMINISTRATIVE reasons like Shift End)
        const administrativeReasons = ['Aguardando Início da Produção', 'Aguardando Início de Lote', 'Final de Turno'];
        const repeatReasons = reasons.filter(r => 
            !administrativeReasons.includes(r) && 
            (downtimeEvents || []).some(e => e.reason && e.reason.includes(r))
        );

        if (repeatReasons.length > 0) {
            const count = (downtimeEvents || []).filter(e => repeatReasons.some(r => e.reason && e.reason.includes(r))).length;
            const confirmed = window.confirm(
                `⚠️ ATENÇÃO OPERADOR!\n\n` +
                `Motivo(s) recorrente(s): ${repeatReasons.join(', ')}\n` +
                `Já tivemos ${count} parada(s) por esse(s) motivo(s) nesta ordem.\n\n` +
                `Você já tomou a iniciativa necessária para que isso não aconteça novamente?`
            );
            if (!confirmed) return;
        }

        onSubmit(finalReason);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6">
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden animate-zoom-in border border-slate-100">
                
                {/* Header */}
                <div className="bg-slate-50 p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-white to-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <PauseIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            MENU OPERACIONAL
                        </h2>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Interromper atividade ou Encerrar</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90">
                        <XCircleIcon className="h-8 w-8" />
                    </button>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {dynamicDowntimeReasons.map(r => {
                            const isActive = selectedReasons.includes(r);
                            
                            // Normalização para busca robusta
                            const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const normR = normalize(r);
                            const machineCategory = machineType.toLowerCase().includes('trefila') ? 'trefila' : 
                                               machineType.toLowerCase().includes('trelica') ? 'trelica' : 
                                               machineType.toLowerCase().trim();

                            const config = (downtimeConfigs || []).find(c => {
                                const normConfigR = normalize(c.reason);
                                const configCategory = normalize(c.machineType);
                                return normR === normConfigR && 
                                       (configCategory === 'geral' || configCategory === machineCategory);
                            });
                            
                            const limit = config ? config.thresholdMinutes : (DOWNTIME_THRESHOLDS[r] || 15);
                            
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => toggleReason(r)}
                                    className={`flex flex-col items-start gap-1 p-5 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${
                                        isActive
                                            ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
                                        <span className="flex-1 uppercase italic tracking-tight truncate">{r}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <ClockIcon className={`h-3 w-3 ${isActive ? 'text-amber-100' : 'text-slate-400'}`} />
                                        <span className={`text-[10px] font-bold ${isActive ? 'text-amber-100' : 'text-slate-400'}`}>
                                            Limite: {limit} min
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => toggleReason('Outros')}
                            className={`flex flex-col items-start gap-1 p-5 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${
                                isOtherActive
                                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isOtherActive ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
                                Outros
                            </div>
                            <span className={`text-[8px] uppercase tracking-widest mt-1 px-1.5 py-0.5 rounded ${isOtherActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                Limite: 15min
                            </span>
                        </button>
                    </div>

                    {isOtherActive && (
                        <div className="animate-fade-in-up mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Digite o motivo</label>
                            <input
                                value={otherReason}
                                onChange={(e) => setOtherReason(e.target.value)}
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-amber-500 focus:ring-0 transition-all font-bold text-slate-700 bg-slate-50"
                                placeholder="..."
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <button 
                            type="button"
                            onClick={handleSubmit} 
                            disabled={selectedReasons.length === 0 && !isOtherActive}
                            className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-30"
                        >
                            <StopIcon className="h-6 w-6" /> REGISTRAR MOTIVO E PARAR
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            {onEndShift && (
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onEndShift(); }}
                                    className="h-20 bg-rose-50 border-2 border-rose-100 text-rose-600 font-black rounded-3xl hover:bg-rose-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <ClockIcon className="h-6 w-6" /> 
                                    <span className="text-[10px]">ENCERRAR TURNO</span>
                                </button>
                            )}
                            {canPause && onPauseOrder && (
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onPauseOrder(); }}
                                    className="h-20 bg-amber-50 border-2 border-amber-100 text-amber-600 font-black rounded-3xl hover:bg-amber-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <ArchiveIcon className="h-6 w-6" /> 
                                    <span className="text-[10px]">PAUSAR/TROCAR</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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
                                        <span className="font-bold text-slate-800">{calculatePontaWeight(ponta)?.toFixed(2) || '0.00'}</span>
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
const MachineSpeedModal: React.FC<{
    initialSpeed?: number;
    onClose: () => void;
    onSubmit: (speed: number) => void;
}> = ({ initialSpeed, onClose, onSubmit }) => {
    const [speed, setSpeed] = useState<string>(initialSpeed ? initialSpeed.toString().replace('.', ',') : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const s = parseFloat(speed.replace(',', '.'));
        if (!isNaN(s) && s > 0) {
            onSubmit(s);
        } else {
            alert('Por favor, informe uma velocidade válida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in border border-slate-100 p-8">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <ChartBarIcon className="h-10 w-10 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Velocidade da Máquina</h2>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Informe a velocidade de produção (m/s)</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                        <input
                            type="text"
                            value={speed}
                            onChange={(e) => setSpeed(e.target.value)}
                            placeholder="Ex: 8,6"
                            className="w-full p-8 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] text-6xl text-center font-black text-indigo-600 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                            autoFocus
                            required
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-6 text-slate-300 font-bold text-xl uppercase pointer-events-none">m/s</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={onClose} className="h-16 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancelar</button>
                        <button type="submit" className="h-16 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-lg shadow-indigo-100">Iniciar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BitolaCheckModal: React.FC<{
    onClose: () => void;
}> = ({ onClose }) => {
    const [comprimento, setComprimento] = useState('');
    const [massa, setMassa] = useState('');

    const parseNum = (v: string) => {
        const n = parseFloat(v.replace(',', '.'));
        return isNaN(n) ? null : n;
    };

    const c = parseNum(comprimento);
    const m = parseNum(massa);
    const bitolaFinal = (m && c && c > 0) ? Math.sqrt(m / c) * 12.744 : null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in border border-slate-100">
                {/* Header */}
                <div className="bg-gradient-to-br from-amber-50 to-white p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <ScaleIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            Conferir Bitola
                        </h2>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Calculadora rápida</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90">
                        <XCircleIcon className="h-8 w-8" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comprimento</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={comprimento}
                                    onChange={(e) => setComprimento(e.target.value)}
                                    placeholder="199"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-2xl font-black text-slate-800 focus:border-amber-500 focus:bg-white transition-all outline-none"
                                    autoFocus
                                />
                                <span className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-300 text-xs font-bold">mm</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Massa</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={massa}
                                    onChange={(e) => setMassa(e.target.value)}
                                    placeholder="14,101"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-2xl font-black text-slate-800 focus:border-amber-500 focus:bg-white transition-all outline-none"
                                />
                                <span className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-300 text-xs font-bold">g</span>
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    <div className={`p-6 rounded-3xl border-4 transition-all duration-500 ${
                        bitolaFinal !== null
                            ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-100'
                            : 'bg-slate-50 border-slate-200'
                    }`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${bitolaFinal !== null ? 'text-amber-600' : 'text-slate-400'}`}>
                            ⚡ Bitola Final
                        </p>
                        <p className={`text-5xl font-black text-center transition-colors ${bitolaFinal !== null ? 'text-amber-800' : 'text-slate-300'}`}>
                            {bitolaFinal !== null ? bitolaFinal.toFixed(2) : '—'}
                            {bitolaFinal !== null && <span className="text-lg text-amber-500 ml-2">mm</span>}
                        </p>
                    </div>

                    {/* Formula hint */}
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Fórmula: √(massa ÷ comprimento) × 12,744
                    </p>
                </div>
            </div>
        </div>
    );
};

const QuantityPromptModal: React.FC<{
    onClose: () => void;
    onSubmit: (quantity: number) => void;
    currentQuantity: number;
    machineName?: string;
    order?: ProductionOrderData | null;
}> = ({ onClose, onSubmit, currentQuantity, machineName, order }) => {
    const [quantity, setQuantity] = useState(currentQuantity);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isTrelica = machineName?.startsWith('Treliça');
    const isBelowMinimum = quantity < currentQuantity;

    // Calcular peso estimado do acréscimo de peças
    const pieceDelta = Math.max(0, quantity - currentQuantity);
    const trelicaUnitWeight = order?.totalWeight && order?.quantityToProduce 
        ? (order.totalWeight / order.quantityToProduce) 
        : (isTrelica ? 6.4 : 0);
    const estimatedWireKg = pieceDelta * trelicaUnitWeight;

    const handleQuickAdd = (addQty: number) => {
        const base = Math.max(currentQuantity, quantity);
        setQuantity(base + addQty);
        setErrorMsg(null);
    };

    const handleChange = (valStr: string) => {
        const val = parseInt(valStr, 10);
        if (isNaN(val)) {
            setQuantity(0);
            setErrorMsg(`A quantidade não pode ficar vazia. Mínimo: ${currentQuantity} peças.`);
            return;
        }
        setQuantity(val);
        if (val < currentQuantity) {
            setErrorMsg(`⚠️ Atenção: Você não pode informar um valor menor que ${currentQuantity} peças (já confirmadas anteriormente). Isso evita distorções no cálculo de consumo das bobinas de arame.`);
        } else {
            setErrorMsg(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity < currentQuantity) {
            setErrorMsg(`Erro: Não é permitido registrar quantidade inferior a ${currentQuantity} peças.`);
            return;
        }
        onSubmit(quantity);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <form onSubmit={handleSubmit} className="bg-[#0B1A24] border border-white/20 p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl">
                            📊
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Atualização de Produção</h2>
                            <p className="text-xs text-slate-400">
                                {isTrelica ? 'Ciclo inteligente a cada 5 min • Sincronia de Bobinas' : 'Atualização de Produção do Turno'}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {machineName || 'Máquina'}
                    </span>
                </div>

                {/* Banner Informativo */}
                <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
                    <ClockIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="font-bold text-white flex items-center gap-2">
                            <span>Último registro confirmado:</span>
                            <span className="font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-xs font-black">
                                {currentQuantity} peças
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                            Informe a contagem total produzida no seu turno até agora. O sistema calculará o consumo exato dos rolos da máquina.
                        </p>
                    </div>
                </div>

                {/* Alerta de Erro se tentar digitar menos que o já registrado */}
                {isBelowMinimum && (
                    <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-200 animate-pulse">
                        <span className="text-base">⛔</span>
                        <div>
                            <span className="font-black text-white">Quantidade Bloqueada!</span>
                            <p className="text-[11px] text-rose-300 mt-0.5">
                                {errorMsg || `A quantidade não pode ser menor que ${currentQuantity} peças (valor já registrado). Para evitar erros no nível das bobinas, digite um valor igual ou maior.`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Campo Principal de Quantidade */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Total Produzido no Turno
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                            Mínimo obrigatório: <strong className="text-white">{currentQuantity} pçs</strong>
                        </span>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            min={currentQuantity}
                            value={quantity === 0 && currentQuantity === 0 ? '' : quantity}
                            onChange={e => handleChange(e.target.value)}
                            className={`w-full p-5 border-2 rounded-2xl text-5xl text-center font-black transition-all outline-none bg-black/40 text-white ${
                                isBelowMinimum
                                    ? 'border-rose-500 text-rose-300 focus:border-rose-400 ring-2 ring-rose-500/20'
                                    : 'border-emerald-500/50 focus:border-emerald-400 ring-2 ring-emerald-500/20'
                            }`}
                            required
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-5 text-slate-500 font-black text-lg uppercase pointer-events-none font-mono">
                            pçs
                        </div>
                    </div>
                </div>

                {/* Botões Rápidos de Acréscimo (+50, +100, +200 pçs) */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Atalhos Rápidos de Acréscimo:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => handleQuickAdd(50)}
                            className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl py-2 text-xs font-bold text-slate-200 transition flex items-center justify-center gap-1"
                        >
                            <span>+50</span>
                            <span className="text-[10px] text-slate-400">pçs</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAdd(100)}
                            className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl py-2 text-xs font-bold text-slate-200 transition flex items-center justify-center gap-1"
                        >
                            <span>+100</span>
                            <span className="text-[10px] text-slate-400">pçs</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAdd(200)}
                            className="bg-emerald-600/30 hover:bg-emerald-600/50 active:scale-95 border border-emerald-500/40 rounded-xl py-2 text-xs font-black text-emerald-300 transition flex items-center justify-center gap-1 shadow-sm"
                            title="Pacote padrão de Treliça (200 peças)"
                        >
                            <span>+200</span>
                            <span className="text-[10px] text-emerald-400 font-bold">(1 Pacote)</span>
                        </button>
                    </div>
                </div>

                {/* Indicador de impacto do acréscimo nos rolos */}
                {pieceDelta > 0 && (
                    <div className="bg-emerald-950/30 border border-emerald-500/25 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300">
                            <span>⚡</span>
                            <span>Acréscimo neste reporte:</span>
                            <strong className="font-mono font-black text-white">+{pieceDelta} pçs</strong>
                        </div>
                        {estimatedWireKg > 0 && (
                            <div className="text-[11px] text-slate-300 font-mono">
                                Consumo estimado: <strong className="text-emerald-400 font-black">~{estimatedWireKg.toFixed(1)} kg</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* Rodapé com Ações */}
                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
                    >
                        Adiar / Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isBelowMinimum}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-emerald-900/40 flex items-center gap-1.5"
                    >
                        <span>✓</span>
                        <span>Confirmar Produção</span>
                    </button>
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
                        O peso inserido de <strong className="text-slate-800">{data.actualWeight?.toFixed(2) || '0.00'} kg</strong> está fora da tolerância de peso esperada (entre <strong className="text-slate-800">{data.lowerBound?.toFixed(2) || '0.00'} kg</strong> e <strong className="text-slate-800">{data.upperBound?.toFixed(2) || '0.00'} kg</strong>).
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

const LotSelectionModal: React.FC<{
    onClose: () => void;
    onSelect: (lotId: string) => void;
    stock: StockItem[];
}> = ({ onClose, onSelect, stock }) => {
    const [search, setSearch] = useState('');

    const availableStock = useMemo(() => {
        return stock.filter(item =>
            item.status === 'Disponível' &&
            item.remainingQuantity > 0 &&
            (search === '' ||
                item.internalLot.toLowerCase().includes(search.toLowerCase()) ||
                item.supplier.toLowerCase().includes(search.toLowerCase()))
        ).sort((a, b) => a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true }));
    }, [stock, search]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-slate-800">Selecionar Lote do Estoque</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><XCircleIcon className="h-6 w-6 text-slate-400" /></button>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por lote ou fornecedor..."
                            className="w-full p-3 pl-10 border-2 border-slate-100 rounded-xl focus:border-indigo-500 transition outline-none"
                            autoFocus
                        />
                        <ArchiveIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    {availableStock.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {availableStock.map(lot => (
                                <button
                                    key={lot.id}
                                    onClick={() => onSelect(lot.id)}
                                    className="flex justify-between items-center p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent rounded-xl transition text-left group"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg group-hover:text-indigo-700">{lot.internalLot}</p>
                                        <div className="flex gap-3 mt-1">
                                            <span className="text-xs font-bold text-slate-500 uppercase">{lot.materialType}</span>
                                            <span className="text-xs font-bold text-indigo-600 uppercase">{lot.bitola}</span>
                                            <span className="text-xs text-slate-400">{lot.supplier}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-600">{lot.remainingQuantity?.toFixed(2) || '-'} kg</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Disponível</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <WarningIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500">Nenhum lote disponível encontrado.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="bg-white border-2 border-slate-200 text-slate-600 font-bold py-2 px-6 rounded-xl hover:bg-slate-100 transition">FECHAR</button>
                </div>
            </div>
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
    startOperatorShift?: (orderId: string, options?: { isOvertime?: boolean; managerAuthorized?: string; checkinOnly?: boolean }) => void | Promise<void>;
    endOperatorShift?: (orderId: string, finalQuantity?: number, options?: { autoClosed?: boolean; observation?: string; isOvertime?: boolean; managerAuthorized?: string }) => void | Promise<void>;
    logDowntime?: (orderId: string, reason: string) => void;
    logResumeProduction?: (orderId: string) => void;
    startLotProcessing?: (orderId: string, lotId: string, speed: number) => void;
    finishLotProcessing?: (orderId: string, lotId: string) => void;
    recordLotWeight?: (orderId: string, lotId: string, finalWeight?: number | null, measuredGauge?: number) => void;
    recordPackageWeight?: (orderId: string, packageData: { packageNumber: number; quantity: number; weight: number; }) => void;
    completeProduction?: (orderId: string, finalData: { actualProducedQuantity?: number, pontas?: Ponta[] }) => void;
    addPartsRequest?: (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status' | 'machine' | 'productionOrderId'>) => void;
    deleteShiftReport?: (reportId: string) => void;
    cancelProductionOrder?: (orderId: string) => void;
    pauseProductionOrder?: (orderId: string) => void;
    initialView?: View;
    initialModal?: 'reports' | 'parts' | 'rings' | null;
    gauges?: StockGauge[];
    addLotToOrder?: (orderId: string, lotId: string) => void;
    downtimeConfigs?: DowntimeConfig[];
    updateProductionOrder?: (orderId: string, updates: Partial<ProductionOrderData>) => void;
    onUpdateReport?: (reportId: string, updates: Partial<ShiftReport>) => Promise<void>;
    pcpShiftConfig?: PcpShiftConfig;
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

// Trefila Ring Stock Interface (Matches types.ts)
interface TrefilaRingStock {
    id: string;
    model: string;
    quantity: number;
}

// Helper functions for lot selection normalization
const normalizeStr = (str: string): string => {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const parseBitolaFloat = (val: string | number | undefined | null): number | null => {
    if (val === undefined || val === null) return null;
    const str = typeof val === 'number' ? val.toString() : String(val);
    const cleaned = str.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
};

const MachineControl: React.FC<MachineControlProps> = ({
    machineType, setPage, currentUser, users = [], stock, productionOrders = [],
    shiftReports = [], startProductionOrder, startOperatorShift, endOperatorShift,
    logDowntime, logResumeProduction, startLotProcessing, finishLotProcessing,
    recordLotWeight, recordPackageWeight, completeProduction, addPartsRequest,
    logPostProductionActivity, updateProducedQuantity, deleteShiftReport,
    cancelProductionOrder, pauseProductionOrder, addLotToOrder, initialView, initialModal, gauges = [],
    downtimeConfigs = [], updateProductionOrder, onUpdateReport, pcpShiftConfig
}) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username?.toLowerCase() === 'admin' || currentUser?.username?.toLowerCase() === 'gestor' || currentUser?.username?.toLowerCase().includes('matheusmiranda');
    const [activeMachine, setActiveMachine] = useState<MachineType>(() => {
        const saved = localStorage.getItem('msm_active_machine');
        const safeMachineType = machineType || 'Trefila';
        
        if (saved && (
            (typeof safeMachineType === 'string' && saved.startsWith(safeMachineType)) || 
            (safeMachineType === 'Trefila' && saved.startsWith('Trefila')) || 
            (safeMachineType === 'Treliça' && saved.startsWith('Treliça'))
        )) {
            return saved as MachineType;
        }

        return (safeMachineType === 'Trefila' ? 'Trefila 1' : safeMachineType === 'Treliça' ? 'Treliça 1' : safeMachineType) as MachineType;
    });

    // Reset active machine when the main machine category (trefila/trelica) changes from props
    useEffect(() => {
        const saved = localStorage.getItem('msm_active_machine');
        const safeType = machineType || '';
        
        if (saved && (
            (safeType && saved.startsWith(safeType)) || 
            (safeType === 'Trefila' && saved.startsWith('Trefila')) || 
            (safeType === 'Treliça' && saved.startsWith('Treliça'))
        )) {
            setActiveMachine(saved as MachineType);
            return;
        }

        setActiveMachine(safeType === 'Trefila' ? 'Trefila 1' : safeType === 'Treliça' ? 'Treliça 1' : (safeType as MachineType || 'Trefila 1'));
    }, [machineType, currentUser?.username]);

    useEffect(() => {
        if (!isGestor && currentUser?.employeeId) {
            fetchByColumn<Employee>('employees', 'id', currentUser.employeeId)
                .then(emps => {
                    if (emps && emps.length > 0 && emps[0].assignedMachine) {
                        const machine = emps[0].assignedMachine as MachineType;
                        const safeType = machineType || '';
                        if (
                            (safeType && machine.startsWith(safeType)) ||
                            (safeType === 'Trefila' && machine.startsWith('Trefila')) ||
                            (safeType === 'Treliça' && machine.startsWith('Treliça'))
                        ) {
                            setActiveMachine(machine);
                            localStorage.setItem('msm_active_machine', machine);
                        }
                    }
                })
                .catch(err => console.error("Error fetching employee assigned machine in MachineControl:", err));
        }
    }, [currentUser, machineType, isGestor]);
    const [pendingWeights, setPendingWeights] = useState<Map<string, string>>(new Map());
    const [pendingGauges, setPendingGauges] = useState<Map<string, string>>(new Map()); // Novo estado para bitolas
    const [pendingPackageWeights, setPendingPackageWeights] = useState<Map<number, string>>(new Map());
    const [justCompletedOrderId, setJustCompletedOrderId] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<'monitor' | 'work' | 'process' | 'weigh' | 'performance'>((activeMachine && typeof activeMachine === 'string' && activeMachine.startsWith('Treliça')) ? 'work' : 'monitor');
    const [managerOverrideData, setManagerOverrideData] = useState<{
        packageNumber: number;
        quantity: number;
        weight: number;
        lowerBound: number;
        upperBound: number;
    } | null>(null);
    const [downtimeJustification, setDowntimeJustification] = useState('');

    // Persistent drift to align local clock with server timestamps, persisted in localStorage
    const driftKey = `stableDrift_${machineType}`;
    const [stableDrift, setStableDrift] = useState(() => {
        const saved = localStorage.getItem(driftKey);
        return saved ? parseInt(saved, 10) : 0;
    });

    const [timer, setTimer] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTimer(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const now = useMemo(() => new Date(timer.getTime() + stableDrift), [timer, stableDrift]);

    // OS Tracking state (declaration only, useEffect will be after activeOrder)
    const [osElapsed, setOsElapsed] = useState(0);
    const [osSearchTerm, setOsSearchTerm] = useState('');

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
        if (!activeOrder || !recordLotWeight) return;

        const lot = (activeOrder.processedLots || []).find(p => p.lotId === lotId);
        if (!lot) return;

        const weightStr = pendingWeights.get(lotId);
        const gaugeStr = pendingGauges.get(lotId);

        const parsedWeight = weightStr ? parseFloat(weightStr.replace(',', '.')) : undefined;
        const parsedGauge = gaugeStr ? parseFloat(gaugeStr.replace(',', '.')) : undefined;

        const finalWeight = (parsedWeight !== undefined && !isNaN(parsedWeight)) ? parsedWeight : undefined;
        const measuredGauge = (parsedGauge !== undefined && !isNaN(parsedGauge)) ? parsedGauge : undefined;

        if (finalWeight !== undefined || measuredGauge !== undefined) {
            recordLotWeight(activeOrder.id, lotId, finalWeight, measuredGauge);

            if (finalWeight !== undefined) {
                setPendingWeights(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
            if (measuredGauge !== undefined) {
                setPendingGauges(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
        }
    };

    const [showResumePreviousStopModal, setShowResumePreviousStopModal] = useState(false);
    const [showSpeedModal, setShowSpeedModal] = useState(false);
    const [selectedLotForSpeed, setSelectedLotForSpeed] = useState<string | null>(null);
    const [previousStopReason, setPreviousStopReason] = useState<string | null>(null);
    const [showManagerAuthForOvertimeStart, setShowManagerAuthForOvertimeStart] = useState(false);
    const [showManagerAuthForOvertimeExtend, setShowManagerAuthForOvertimeExtend] = useState(false);
    const [authorizedOvertimeForCurrentShift, setAuthorizedOvertimeForCurrentShift] = useState(false);
    const [showAutoEndCountdownModal, setShowAutoEndCountdownModal] = useState(false);
    const [pendingStartIsOvertime, setPendingStartIsOvertime] = useState(false);
    const [pendingStartManager, setPendingStartManager] = useState<string | undefined>(undefined);

    const shiftEvaluation = useMemo(() => {
        return checkMachineShiftStatus(activeMachine, pcpShiftConfig, now);
    }, [activeMachine, pcpShiftConfig, now]);

    const shiftStatus = useMemo(() => {
        return {
            isOvertime: shiftEvaluation.isOvertime && !authorizedOvertimeForCurrentShift,
            progress: shiftEvaluation.progressPercent,
            timeStatusText: shiftEvaluation.statusText,
            shiftName: shiftEvaluation.shiftName,
            shiftLabel: shiftEvaluation.shiftLabel,
            inShiftWindow: shiftEvaluation.inShiftWindow,
            isAutoEndCountdown: shiftEvaluation.isAutoEndCountdown,
            remainingCountdownSeconds: shiftEvaluation.remainingCountdownSeconds,
            autoStartShift: shiftEvaluation.autoStartShift,
            autoEndShift: shiftEvaluation.autoEndShift,
            requireManagerAuthForOvertime: shiftEvaluation.requireManagerAuthForOvertime,
            workStart: shiftEvaluation.workStart,
            workEnd: shiftEvaluation.workEnd,
        };
    }, [shiftEvaluation, authorizedOvertimeForCurrentShift]);

    const handleStartShift = (forceOvertime = false, managerAuthUser?: string) => {
        if (!activeOrder || !startOperatorShift) return;

        // Se fora do horário programado e não for gestor nem já autorizado, exigir senha de gestor
        if (!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !forceOvertime) {
            setShowManagerAuthForOvertimeStart(true);
            return;
        }

        const isOt = forceOvertime || !shiftEvaluation.inShiftWindow;
        const mgrAuth = managerAuthUser || (isOt && isGestor ? currentUser?.username : undefined);

        // Check for ANY active downtime event from previous shift (not just the last array element)
        const openEvent = (activeOrder.downtimeEvents || []).find(e =>
            !e.resumeTime && e.reason !== 'Final de Turno' && e.reason !== 'Aguardando Início da Produção' && e.reason?.toLowerCase() !== 'aguardando início de lote'
        );

        if (openEvent) {
            setPreviousStopReason(openEvent.reason);
            setPendingStartIsOvertime(isOt);
            setPendingStartManager(mgrAuth);
            setShowResumePreviousStopModal(true);
        } else {
            // Normal start — all events are administrative, just begin
            startOperatorShift(activeOrder.id, { isOvertime: isOt, managerAuthorized: mgrAuth });
        }
    };

    const getFactoryDateString = (dateObj: Date | string): string => {
        try {
            const factoryDate = new Date(dateObj);
            if (isNaN(factoryDate.getTime())) return '';
            if (factoryDate.getHours() < 5) {
                factoryDate.setDate(factoryDate.getDate() - 1);
            }
            return factoryDate.toLocaleDateString('sv-SE');
        } catch {
            return '';
        }
    };

    const shiftProducedTotal = useMemo(() => {
        const todayStr = getFactoryDateString(now);
        const currentHour = now.getHours();
        const currentShift = (currentHour >= 5 && currentHour < 14) ? 'A' : 'B';

        let totalPoints = 0;
        (productionOrders || []).forEach(order => {
            if (order.status === 'cancelled') return;
            if (order.machine !== activeMachine) return;
            
            (order.operatorLogs || []).forEach(log => {
                if (!log.startTime) return;
                const logDateStr = getFactoryDateString(log.startTime);
                if (logDateStr !== todayStr) return;

                const startH = new Date(log.startTime).getHours();
                const logShift = (startH >= 5 && startH < 14) ? 'A' : 'B';
                if (logShift === currentShift) {
                    if (activeMachine.startsWith('Treliça')) {
                        const startQty = log.startQuantity || 0;
                        const endQty = log.endTime ? (log.endQuantity || 0) : (order.actualProducedQuantity || 0);
                        totalPoints += Math.max(0, endQty - startQty);
                    } else {
                        // For Trefila, we sum the count of lots finished in this shift
                        (order.processedLots || []).forEach(lot => {
                            if (lot.endTime) {
                                const lotDateStr = getFactoryDateString(lot.endTime);
                                if (lotDateStr === todayStr) {
                                    const endH = new Date(lot.endTime).getHours();
                                    const lotLS = (endH >= 5 && endH < 14) ? 'A' : 'B';
                                    if (lotLS === currentShift) {
                                        totalPoints += 1;
                                    }
                                }
                            }
                        });
                    }
                }
            });
        });
        return totalPoints;
    }, [productionOrders, machineType, now]);

    const confirmResumePreviousStop = async (shouldResume: boolean) => {
        if (!activeOrder || !startOperatorShift) return;

        // Start the shift first
        await startOperatorShift(activeOrder.id, { isOvertime: pendingStartIsOvertime, managerAuthorized: pendingStartManager });

        // If user wants to resume production immediately
        if (shouldResume && logResumeProduction) {
            // Give a small delay to ensuring shift start processed (optional but safer if async race)
            setTimeout(() => logResumeProduction(activeOrder.id), 500);
        }

        setShowResumePreviousStopModal(false);
        setPreviousStopReason(null);
        setPendingStartIsOvertime(false);
        setPendingStartManager(undefined);
    };

    const executeRecordPackageWeight = (pkgData: { packageNumber: number; quantity: number; weight: number; }) => {

        if (activeOrder && recordPackageWeight) {
            recordPackageWeight(activeOrder.id, { packageNumber: pkgData.packageNumber, quantity: pkgData.quantity, weight: pkgData.weight });
            setPendingPackageWeights(prev => {
                const newMap = new Map(prev);
                newMap.delete(pkgData.packageNumber);
                return newMap;
            });

            // Acumula desgaste/metros nos 7 eletrodos de solda da Treliça
            if (activeMachine.startsWith('Treliça')) {
                try {
                    const pieceLength = parseFloat(String(activeOrder.tamanho || '6').replace(',', '.')) || 6;
                    const packageMeters = pkgData.quantity * pieceLength;
                    const currentEls = getLocalMachineElectrodes(activeMachine);
                    const updatedEls = currentEls.map(el => {
                        const newMeters = (el.meters_produced || 0) + packageMeters;
                        const newPieces = (el.pieces_produced || 0) + pkgData.quantity;
                        const isCrit = newMeters >= (el.benchmark_meters || 15000) * 0.9;
                        const isWarn = newMeters >= (el.benchmark_meters || 15000) * 0.7;
                        return {
                            ...el,
                            meters_produced: newMeters,
                            pieces_produced: newPieces,
                            status: isCrit ? ('critical' as const) : isWarn ? ('warning' as const) : ('active' as const)
                        };
                    });
                    saveLocalMachineElectrodes(activeMachine, updatedEls);
                } catch (err) {
                    console.warn('Erro ao acumular metros nos eletrodos:', err);
                }
            }
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


    const [view, setView] = useState<View>(initialView || 'dashboard');
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    const [showCancelManagerAuth, setShowCancelManagerAuth] = useState(false);
    const [showDowntimeModal, setShowDowntimeModal] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showQuantityPrompt, setShowQuantityPrompt] = useState(false);
    const [ringStock, setRingStock] = useState<TrefilaRingStock[]>([]);
    const [pendingShiftEnd, setPendingShiftEnd] = useState<string | null>(null);

    useEffect(() => {
        if (activeMachine.startsWith('Trefila')) {
            const loadRingStock = async () => {
                try {
                    const data = await fetchTable<TrefilaRingStock>('trefila_rings_stock');
                    setRingStock(data || []);
                } catch (e) {
                    console.error('Error loading ring stock', e);
                }
            };
            loadRingStock();
        }
    }, [machineType]);
    const [showPartsRequestModal, setShowPartsRequestModal] = useState(initialModal === 'parts');
    const [showShiftReportsModal, setShowShiftReportsModal] = useState(initialModal === 'reports');
    const [showTrefilaCalculation, setShowTrefilaCalculation] = useState(initialModal === 'rings');
    const [lastShiftEndPromptDate, setLastShiftEndPromptDate] = useState<string | null>(null);
    const [showManagerAuthForShiftEnd, setShowManagerAuthForShiftEnd] = useState(false);
    const [lastPromptShownAt, setLastPromptShownAt] = useState<number>(0);
    const [showLotSelectionModal, setShowLotSelectionModal] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const [showBitolaCheck, setShowBitolaCheck] = useState(initialModal === 'bitolaCheck');

    const hasPermission = (targetPage: Page): boolean => {
        if (!currentUser) return false;
        // Super-admin and gestores always have access to everything by default
        if (currentUser.username === 'admin' || currentUser.role === 'admin' || currentUser.role === 'gestor') return true;

        // Dynamic check based on current machine if needed, 
        // but here we check the specific page passed
        return !!currentUser.permissions?.[targetPage];
    };

    const machinePrefix = (activeMachine && typeof activeMachine === 'string') 
        ? (activeMachine.startsWith('Trefila') 
            ? 'trefila' 
            : activeMachine.startsWith('Desbobinadeira') 
                ? 'desbobinadeira' 
                : 'trelica')
        : 'trelica';

    const getPermissionPage = (suffix: 'InProgress' | 'Pending' | 'Completed' | 'Reports'): Page => {
        if (activeMachine && typeof activeMachine === 'string') {
            if (activeMachine.startsWith('Trefila')) return `trefila${suffix}` as Page;
            if (activeMachine.startsWith('Desbobinadeira')) return `desbobinadeira${suffix}` as Page;
        }
        return `trelica${suffix}` as Page;
    };

    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);

    const activeOrder = useMemo(() => {
        const active = productionOrders.filter(o => {
            const isExact = o.machine === activeMachine;
            const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && activeMachine === 'Trefila 1');
            const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && activeMachine === 'Treliça 1');
            const isLegacyMalhaTo1 = (o.machine === 'Malha' && activeMachine === 'Malha 1');
            return (isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1 || isLegacyMalhaTo1) && o.status === 'in_progress';
        });
        if (active.length === 0) return undefined;
        return active.sort((a, b) => {
            const timeA = new Date(a.startTime || 0).getTime();
            const timeB = new Date(b.startTime || 0).getTime();
            if (timeA !== timeB) {
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            }
            const cA = new Date(a.creationDate || 0).getTime();
            const cB = new Date(b.creationDate || 0).getTime();
            if (cA !== cB) {
                return (isNaN(cB) ? 0 : cB) - (isNaN(cA) ? 0 : cA);
            }
            return a.id.localeCompare(b.id);
        })[0];
    }, [productionOrders, activeMachine]);

    // Update OS elapsed time every second when an OS is active
    useEffect(() => {
        if (!activeOrder || !activeMachine.startsWith('Desbobinadeira')) {
            setOsElapsed(0);
            return;
        }
        const osProgress = (activeOrder as any).osProgress;
        if (osProgress?.currentOs && osProgress?.startTime) {
            const start = new Date(osProgress.startTime).getTime();
            setOsElapsed(Math.floor((timer.getTime() - start) / 1000));
        } else {
            setOsElapsed(0);
        }
    }, [timer, activeOrder, activeMachine]);

    const pendingOrders = useMemo(() => productionOrders.filter(o => (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && (o.status === 'pending' || o.status === 'paused')).sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime()), [productionOrders, activeMachine]);
    const completedOrders = useMemo(() => productionOrders.filter(o => (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && o.status === 'completed').sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime()), [productionOrders, activeMachine]);

    useEffect(() => {
        if (!activeOrder) return;

        const timestamps = [
            activeOrder.startTime,
            activeOrder.lastQuantityUpdate,
            ...(activeOrder.downtimeEvents || []).map(e => e.stopTime),
            ...(activeOrder.downtimeEvents || []).map(e => e.resumeTime)
        ].filter(Boolean) as string[];

        setStableDrift(currentDrift => {
            let maxDrift = currentDrift;
            const nowMs = Date.now();

            timestamps.forEach(ts => {
                const eventMs = new Date(ts).getTime();
                const drift = eventMs - nowMs;
                if (drift > maxDrift) {
                    maxDrift = drift;
                }
            });

            if (maxDrift !== currentDrift) {
                localStorage.setItem(driftKey, maxDrift.toString());
            }
            return maxDrift;
        });
    }, [activeOrder, driftKey]);

    const postProductionOrder = useMemo(() => {
        if (activeOrder || !currentUser) return null;

        const completed = productionOrders
            .filter(o => o.status === 'completed' && (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && o.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        for (const order of completed) {
            const hasOpenLog = (order.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime);
            if (hasOpenLog) {
                return order;
            }
        }
        return null;
    }, [productionOrders, activeOrder, currentUser, activeMachine]);

    const orderForShift = activeOrder || postProductionOrder;

    // FIX: Moved currentOperatorLog and hasActiveShift before their usage in useEffect.
    const currentOperatorLog = useMemo(() => {
        if (!orderForShift || !orderForShift.operatorLogs || orderForShift.operatorLogs.length === 0) return null;

        // 1. First priority: Check if current user has an open log
        const myOpenLog = orderForShift.operatorLogs.find(l => 
            currentUser?.username && l.operator.toLowerCase() === currentUser.username.toLowerCase() && !l.endTime
        );
        if (myOpenLog) return myOpenLog;

        // 2. Second priority: Check the absolute latest overall log
        const sorted = [...orderForShift.operatorLogs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const lastOverallLog = sorted[sorted.length - 1];

        // Return the latest log regardless of user (hasActiveShift will handle the current user check)
        return lastOverallLog;
    }, [orderForShift, currentUser]);


    const hasActiveShift = useMemo(() => {
        return currentOperatorLog && currentUser?.username && currentOperatorLog.operator.toLowerCase() === currentUser.username.toLowerCase() && !currentOperatorLog.endTime;
    }, [currentOperatorLog, currentUser]);


    const activeLotProcessingData = useMemo(() => {
        if (activeOrder?.activeLotProcessing?.lotId) {
            const lotInfo = stock.find(s => s.id === activeOrder.activeLotProcessing!.lotId);

            let estimatedTimeSeconds = null;
            let isDelayed = false;
            let elapsedUptimeSeconds = 0;
            if (activeOrder?.activeLotProcessing?.speed && activeOrder?.targetBitola) {
                const lotStartTime = new Date(activeOrder.activeLotProcessing.startTime).getTime();
                const bitola = activeOrder.targetBitola ? parseFloat(activeOrder.targetBitola.replace(',', '.')) : 1;
                const speed = activeOrder.activeLotProcessing.speed || 0; // m/s
                const linearMass = bitola * bitola * 0.006162; // kg/m
                const massPerSecond = speed * linearMass; // kg/s
                
                if (massPerSecond > 0) {
                    const initialWeight = lotInfo?.initialQuantity || 0;
                    const totalDurationSeconds = initialWeight / massPerSecond;

                    // Calculate downtime specifically for this lot
                    const lotDowntimeMs = (activeOrder?.downtimeEvents || []).reduce((acc, e) => {
                        const stop = new Date(e.stopTime).getTime();
                        if (stop < lotStartTime) {
                            if (!e.resumeTime) return acc;
                            const resume = new Date(e.resumeTime).getTime();
                            if (resume <= lotStartTime) return acc;
                            return acc + (resume - lotStartTime);
                        }
                        const resume = e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime();
                        return acc + (resume - stop);
                    }, 0);

                    const totalElapsedMs = now.getTime() - lotStartTime;
                    const elapsedUptimeMs = Math.max(0, totalElapsedMs - lotDowntimeMs);
                    elapsedUptimeSeconds = elapsedUptimeMs / 1000;

                    estimatedTimeSeconds = Math.max(0, totalDurationSeconds - elapsedUptimeSeconds);
                    isDelayed = elapsedUptimeSeconds > totalDurationSeconds;
                }
            }

            return { 
                ...activeOrder.activeLotProcessing, 
                lotInfo: lotInfo || { internalLot: activeOrder.activeLotProcessing.lotId, initialQuantity: 0 },
                estimatedTimeSeconds,
                isDelayed,
                elapsedUptimeSeconds
            };
        }
        return null;
    }, [activeOrder, stock, now]);


    const isAnyActiveShift = useMemo(() => {
        return !!currentOperatorLog && !currentOperatorLog.endTime;
    }, [currentOperatorLog]);

    const currentMachineStatus = useMemo(() => {
        const events = activeOrder?.downtimeEvents || [];
        // CRITICAL: Always pick the LATEST open event
        const openEvent = [...events].reverse().find(e => !e.resumeTime);

        if (!openEvent) {
            return isAnyActiveShift ? 'Produzindo' : 'Ocioso';
        }

        const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
        const normReason = normalize(openEvent.reason);

        const prepReasons = ['Aguardando Início da Produção', 'Aguardando Início de Lote', 'Troca de Rolo / Preparação', 'Setup', 'Ajuste', 'Setup + Preparação'];
        if (prepReasons.some(r => normReason.includes(normalize(r)))) {
            return 'Preparacao';
        }

        // Se é final de turno, está desligada. Caso contrário, se não há turno ativo mas há um evento, 
        // deixamos cair no retorno 'Parada' ou 'Preparacao' acima para ser mais informativo.
        if (normReason === normalize('Final de Turno') || normReason.includes('turno')) {
            return 'Desligada';
        }

        return 'Parada';
    }, [activeOrder, isAnyActiveShift]);

    // Derived state for pulsing effects (must come AFTER currentMachineStatus declaration)
    const isActiveProcess = currentMachineStatus === 'Produzindo' && ((activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) ? !!activeLotProcessingData : true);
    const isUnderStopAlerta = currentMachineStatus === 'Parada' || currentMachineStatus === 'Preparacao';

    const isMachineStopped = currentMachineStatus === 'Parada' || currentMachineStatus === 'Preparacao';
    const isEmergencyStopped = currentMachineStatus === 'Parada';

    const [showReadOnlyStandsModal, setShowReadOnlyStandsModal] = useState(false);
    const [showElectrodesModal, setShowElectrodesModal] = useState(false);
    const [showTrocaDeRoloInOtherStop, setShowTrocaDeRoloInOtherStop] = useState(false);
    const [machineStandsSummary, setMachineStandsSummary] = useState<TrelicaSpoolStand[]>([]);

    useEffect(() => {
        if (activeMachine.startsWith('Treliça')) {
            fetchTrelicaSpoolStands(activeMachine).then(data => {
                setMachineStandsSummary(data || []);
            }).catch(() => {});
        }
    }, [activeMachine, isMachineStopped]);
    const statusStartTime = useMemo(() => {
        if (!activeOrder) return null;
        if (isMachineStopped) {
            const events = activeOrder.downtimeEvents || [];
            const openEvent = [...events].reverse().find(e => !e.resumeTime);
            return openEvent ? new Date(openEvent.stopTime) : null;
        } else if (isActiveProcess) {
            const events = activeOrder.downtimeEvents || [];
            const sortedResumes = events.filter(e => e.resumeTime).sort((a,b) => new Date(b.resumeTime!).getTime() - new Date(a.resumeTime!).getTime());
            const lastResume = sortedResumes[0]?.resumeTime;
            const shiftStart = currentOperatorLog?.startTime;
            
            if (lastResume && shiftStart) {
                return new Date(Math.max(new Date(lastResume).getTime(), new Date(shiftStart).getTime()));
            }
            return lastResume ? new Date(lastResume) : shiftStart ? new Date(shiftStart) : null;
        }
        return null;
    }, [activeOrder, isMachineStopped, isActiveProcess, currentOperatorLog]);

    const statusDurationString = useMemo(() => {
        if (!statusStartTime) return '--:--:--';
        const diff = Math.max(0, now.getTime() - statusStartTime.getTime());
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [statusStartTime, now]);

    const statusConfig = {
        Produzindo: {
            color: 'emerald',
            text: 'text-emerald-700',
            bg: 'bg-emerald-500',
            border: 'border-emerald-500',
            glow: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
            pulse: 'from-emerald-50',
            label: 'OPERANDO'
        },
        Preparacao: {
            color: 'blue',
            text: 'text-blue-700',
            bg: 'bg-blue-500',
            border: 'border-blue-500',
            glow: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]',
            pulse: 'from-blue-50',
            label: 'EM PREPARAÇÃO'
        },
        Parada: {
            color: 'amber',
            text: 'text-amber-600',
            bg: 'bg-amber-500',
            border: 'border-amber-500',
            glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
            pulse: 'from-amber-50',
            label: 'PARADA'
        },
        Desligada: {
            color: 'slate',
            text: 'text-slate-600',
            bg: 'bg-slate-500',
            border: 'border-slate-500',
            glow: 'shadow-[0_0_10px_rgba(100,116,139,0.4)]',
            pulse: 'from-slate-50',
            label: 'MÁQUINA DESLIGADA'
        },
        Ocioso: {
            color: 'slate',
            text: 'text-slate-600',
            bg: 'bg-slate-300',
            border: 'border-slate-300',
            glow: 'shadow-none',
            pulse: '',
            label: 'AGUARDANDO OPERADOR'
        }
    } as Record<string, any>;

    const statusStyle = statusConfig[currentMachineStatus];

    const isShiftOverdue = useMemo(() => {
        if (!currentOperatorLog || currentOperatorLog.endTime) return false;
        
        const startH = new Date(currentOperatorLog.startTime).getHours();
        const startShift = (startH >= 5 && startH < 14) ? 'A' : 'B';
        
        const currentH = now.getHours();
        const currentShift = (currentH >= 5 && currentH < 14) ? 'A' : 'B';
        
        return startShift !== currentShift;
    }, [currentOperatorLog, now]);


    useEffect(() => {
        if ((activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) && activeOrder && !isMachineStopped && hasActiveShift && !showQuantityPrompt) {
            const lastUpdate = activeOrder.lastQuantityUpdate || activeOrder.startTime;
            if (!lastUpdate) return;

            const baseTime = new Date(lastUpdate).getTime();
            const nowMs = now.getTime();
            const diff = nowMs - baseTime;

            // Treliça: ciclo a cada 5 minutos conforme solicitação para acompanhamento contínuo dos rolos; outras máquinas: 10 min
            const promptIntervalMs = activeMachine.startsWith('Treliça') ? 5 * 60 * 1000 : 10 * 60 * 1000;
            const isIntervalElapsed = diff > promptIntervalMs;
            const isLastPromptElapsed = nowMs - lastPromptShownAt > promptIntervalMs;

            if (isIntervalElapsed && isLastPromptElapsed) {
                setShowQuantityPrompt(true);
                setLastPromptShownAt(nowMs);
            }
        }
    }, [now, activeOrder, isMachineStopped, hasActiveShift, machineType, showQuantityPrompt, lastPromptShownAt, activeMachine]);

    // Reset autorização de hora extra quando o turno ou a OP mudar
    useEffect(() => {
        setAuthorizedOvertimeForCurrentShift(false);
        setShowAutoEndCountdownModal(false);
    }, [activeOrder?.id, currentOperatorLog?.startTime]);

    // Monitoramento de Fim de Turno e Contagem Regressiva de Auto-Encerramento
    useEffect(() => {
        if (!activeOrder || !hasActiveShift || !shiftStatus.autoEndShift) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se o turno estiver apenas aberto aguardando check-in do operador, não abre modal de encerramento
        if (currentOperatorLog?.pendingOperatorCheckin) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se o operador já teve hora extra autorizada nesta sessão de turno, descarta contagem de fechamento
        if (authorizedOvertimeForCurrentShift) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se passou do horário de término do turno
        if (shiftEvaluation.isOvertime && !shiftStatus.inShiftWindow) {
            if (shiftStatus.isAutoEndCountdown) {
                setShowAutoEndCountdownModal(true);
            } else {
                // Tempo de tolerância esgotou (ex: 5 min) -> Executar auto-encerramento pelo sistema!
                setShowAutoEndCountdownModal(false);
                if (endOperatorShift && activeOrder) {
                    const finalQty = activeOrder.actualProducedQuantity || 0;
                    endOperatorShift(activeOrder.id, finalQty, {
                        autoClosed: true,
                        observation: `Encerramento automático pelo sistema por fim do ${shiftStatus.shiftName} (${shiftStatus.shiftLabel}). Quantidade registrada: ${finalQty}.`
                    });
                }
            }
        } else {
            setShowAutoEndCountdownModal(false);
        }
    }, [
        activeOrder,
        hasActiveShift,
        shiftStatus.autoEndShift,
        shiftStatus.isAutoEndCountdown,
        shiftEvaluation.isOvertime,
        shiftStatus.inShiftWindow,
        shiftStatus.shiftName,
        shiftStatus.shiftLabel,
        authorizedOvertimeForCurrentShift,
        currentOperatorLog?.pendingOperatorCheckin,
        endOperatorShift
    ]);

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
        } else if (initialModal === 'bitolaCheck') {
            setShowBitolaCheck(true);
        } else if (initialModal === null) {
            setShowPartsRequestModal(false);
        }
    }, [initialModal]);


    const { waitingLots, completedLots } = useMemo(() => {
        if (!activeOrder || (!activeOrder.machine.startsWith('Trefila') && !activeOrder.machine.startsWith('Desbobinadeira'))) return { waitingLots: [], completedLots: [] };

        const processedLotIds = new Set(activeOrder.processedLots?.map(p => p.lotId) || []);

        // Para ordens fantasma, selectedLotIds pode começar vazio e lotes são adicionados dinamicamente
        const selectedIds = Array.isArray(activeOrder.selectedLotIds) 
            ? activeOrder.selectedLotIds.map((l: any) => typeof l === 'string' ? l : l.lotId).filter(Boolean)
            : [];
        const processedIds = (activeOrder.processedLots || []).map(p => p.lotId);
        const allKnownLotIds = [...new Set([...selectedIds, ...processedIds])];

        const allOrderLots = stock.filter(s => allKnownLotIds.includes(s.id));

        const waiting = allOrderLots.filter(lot => !processedLotIds.has(lot.id) && lot.id !== activeLotProcessingData?.lotId);

        const completed = (activeOrder.processedLots || []).map(processedLot => {
            const lotInfo = stock.find(s => s.id === processedLot.lotId);
            return { ...processedLot, lotInfo: lotInfo || null };
        });

        return { waitingLots: waiting, completedLots: completed };
    }, [activeOrder, stock, activeLotProcessingData]);

    const trelicaPackages = useMemo(() => {
        if (!activeOrder || !activeOrder.machine.startsWith('Treliça')) return [];

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
        if (!activeOrder || (!activeOrder.machine.startsWith('Trefila') && !activeOrder.machine.startsWith('Desbobinadeira'))) return false;

        // Para ordens fantasma sem lotes selecionados inicialmente:
        // Permite fechar se ao menos 1 lote foi processado e pesado, OU se não há lotes em nenhum estado
        const selectedIds = Array.isArray(activeOrder.selectedLotIds) ? activeOrder.selectedLotIds as string[] : [];
        const processedIds = (activeOrder.processedLots || []).map(p => p.lotId);
        const allKnownIds = [...new Set([...selectedIds, ...processedIds])];

        if (allKnownIds.length === 0) {
            // Ordem fantasma sem nenhum lote: permite fechar (caso especial)
            return activeOrder.isGhostOrder === true;
        }

        const weighedLots = (activeOrder.processedLots || []).filter(l => l.finalWeight !== null).length;
        return allKnownIds.length === weighedLots && weighedLots > 0;
    }, [activeOrder]);

    const allPackagesWeighed = useMemo(() => {
        if ((!activeMachine.startsWith('Treliça')) || !activeOrder) return false;
        return trelicaPackages.every(p => p.status === 'Concluído');
    }, [trelicaPackages, activeOrder, machineType]);

    const isCompletionDisabled = useMemo(() => {
        if (isEmergencyStopped || (!hasActiveShift && !isGestor)) return true;
        if (activeMachine.startsWith('Treliça')) return !allPackagesWeighed;
        if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) return !allTrefilaLotsProcessed;
        if (activeMachine.startsWith('Malha')) return false;
        return true;
    }, [isEmergencyStopped, hasActiveShift, machineType, allPackagesWeighed, allTrefilaLotsProcessed, activeMachine]);

    const handleStopMachine = (reason: string) => {
        if (!activeOrder) return;
        if (logDowntime) {
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

    const handleUpdateShiftReport = async (reportId: string, updates: Partial<ShiftReport>) => {
        if (onUpdateReport) {
            await onUpdateReport(reportId, updates);
        }
    };


    // OS Tracking for Desbobinadeira
    const handleStartOs = (osIndex: number) => {
        if (!activeOrder || !updateProductionOrder) return;
        const osItems = (activeOrder as any).osItems || [];
        const osItem = osItems[osIndex];
        if (!osItem) return;

        const osProgress = (activeOrder as any).osProgress || { logs: [] };
        const newProgress = {
            currentOs: osItem.os || `OS ${osIndex + 1}`,
            startTime: new Date().toISOString(),
            logs: osProgress.logs || []
        };

        updateProductionOrder(activeOrder.id, { osProgress: newProgress } as any);
    };

    const handleFinishOs = () => {
        if (!activeOrder || !updateProductionOrder) return;
        const osProgress = (activeOrder as any).osProgress;
        if (!osProgress?.currentOs || !osProgress?.startTime) return;

        const nowTime = new Date();
        const startMs = new Date(osProgress.startTime).getTime();
        const durationSeconds = Math.floor((nowTime.getTime() - startMs) / 1000);

        const newLog = {
            os: osProgress.currentOs,
            startTime: osProgress.startTime,
            endTime: nowTime.toISOString(),
            durationSeconds
        };

        const newProgress = {
            currentOs: null,
            startTime: null,
            logs: [...(osProgress.logs || []), newLog]
        };

        updateProductionOrder(activeOrder.id, { osProgress: newProgress } as any);
    };

    const handleStartProcessingLot = (lotId: string) => {
        if (activeOrder && startLotProcessing) {
            setSelectedLotForSpeed(lotId);
            setShowSpeedModal(true);
        }
    }

    const confirmStartLot = (speed: number) => {
        if (activeOrder && startLotProcessing && selectedLotForSpeed) {
            startLotProcessing(activeOrder.id, selectedLotForSpeed, speed);
            setShowSpeedModal(false);
            setSelectedLotForSpeed(null);
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

    const proceedWithShiftEnd = (orderId: string) => {
        if (!activeMachine.startsWith('Treliça') && !activeMachine.startsWith('Malha')) {
            if (endOperatorShift) {
                const orderToEnd = productionOrders.find(o => o.id === orderId);
                endOperatorShift(orderId, (orderToEnd?.actualProducedQuantity || 0));
            }
            setPendingShiftEnd(null);
            return;
        }
        setShowQuantityPrompt(true);
    };

    const handleShiftEndRequest = (orderId: string) => {
        setPendingShiftEnd(orderId);

        // Se o encerramento for antes do horário oficial e a máquina exigir autorização, pedir senha do gestor
        const isNearOrPastEnd = shiftStatus.isAutoEndCountdown || shiftEvaluation.isOvertime;
        if (!isNearOrPastEnd && !isGestor && shiftStatus.requireManagerAuthForOvertime) {
            setShowManagerAuthForShiftEnd(true);
            return;
        }

        proceedWithShiftEnd(orderId);
    };

    const handleManagerAuthSuccess = () => {
        setShowManagerAuthForShiftEnd(false);
        if (pendingShiftEnd) {
            proceedWithShiftEnd(pendingShiftEnd);
        }
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
        dashboard: `Painel da Máquina ${activeMachine}`,
        in_progress: postProductionOrder ? 'Atividade Pós-Produção' : 'Ordem em Produção',
        pending: 'Próximas Produções',
        completed: 'Produções Finalizadas',
    };

    const machineHeader = activeMachine.startsWith('Trefila') 
        ? "Produção maquina DHTRF (TREFILA)" 
        : activeMachine.startsWith('Desbobinadeira') 
            ? "Produção maquina DESB (DESBOBINADEIRA 1)" 
            : activeMachine.startsWith('Malha')
                ? "Produção maquina MALHA (MALHA)"
                : "Produção maquina DHSTR (TRELIÇA)";

    const promptOrder = pendingShiftEnd ? (productionOrders.find(o => o.id === pendingShiftEnd)) : activeOrder;

    if (showTrefilaCalculation) {
        return <TrefilaCalculation onClose={() => setShowTrefilaCalculation(false)} machineType={machineType} activeOrder={activeOrder} gauges={gauges} />;
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {/* Overlay Fixed para Parada Operacional (Sempre Visível no Topo) */}
            {isMachineStopped && activeOrder && (
                (() => {
                    const openEvent = [...(activeOrder.downtimeEvents || [])]
                        .sort((a,b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
                        .find(e => !e.resumeTime);
                    
                    const reason = openEvent?.reason || 'Motivo não informado';
                    const start = openEvent ? new Date(openEvent.stopTime).getTime() : now.getTime();
                    const durationMs = now.getTime() - start;
                    
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const normReason = normalize(reason);
                    
                    const matchingConfig = (downtimeConfigs || []).find(c => normReason.includes(normalize(c.reason)));
                    const limitMinutes = matchingConfig ? matchingConfig.thresholdMinutes : (DOWNTIME_THRESHOLDS[reason] || 15);
                    const limitMs = limitMinutes * 60 * 1000;
                    const isOverLimit = durationMs > limitMs;

                    const isTrocaDeRolo = activeMachine.startsWith('Treliça') && (
                        showTrocaDeRoloInOtherStop ||
                        (normReason.includes('troca') && normReason.includes('rolo')) ||
                        normReason.includes('troca de rolo') ||
                        normReason.includes('rolo') ||
                        normReason.includes('bobina')
                    );

                    const handleResumeAction = () => {
                        if (isOverLimit && !downtimeJustification.trim()) {
                            alert('Por favor, detalhe o motivo de ter excedido o limite de tempo para prosseguir.');
                            return;
                        }
                        if (logResumeProduction) {
                            logResumeProduction(activeOrder.id, isOverLimit ? downtimeJustification : undefined);
                            setDowntimeJustification('');
                            setShowTrocaDeRoloInOtherStop(false);
                        }
                    };

                    // SE A PARADA FOR ESPECIFICAMENTE POR TROCA DE ROLO (OU ACIONADA NELA):
                    if (isTrocaDeRolo) {
                        return (
                            <div className="fixed inset-0 flex flex-col z-[100] bg-slate-950/95 backdrop-blur-2xl overflow-y-auto p-3 sm:p-6 custom-scrollbar animate-fade-in">
                                <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 my-auto">
                                    {/* Header de Parada Operacional: Troca de Rolo */}
                                    <div className={`p-4 sm:p-6 rounded-3xl border ${isOverLimit ? 'bg-rose-950/70 border-rose-500/60 shadow-rose-900/30' : 'bg-slate-900/90 border-amber-500/40 shadow-amber-900/20'} shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                                        <div className="flex items-center gap-3.5">
                                            {showTrocaDeRoloInOtherStop && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTrocaDeRoloInOtherStop(false)}
                                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
                                                >
                                                    ← Voltar
                                                </button>
                                            )}
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${isOverLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}`}>
                                                🔄
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider ${isOverLimit ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950'}`}>
                                                        {isOverLimit ? '⚠️ LIMITE DE PARADA EXCEDIDO' : 'PARADA ATIVA: TROCA DE ROLO'}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-400">Máquina: <strong className="text-white">{activeMachine}</strong></span>
                                                    <span className="text-xs font-mono text-slate-400">OP: <strong className="text-cyan-400">#{activeOrder.orderNumber}</strong></span>
                                                </div>
                                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                                                    PAINEL DE TROCA DE BOBINAS / PORTA-ROLOS
                                                </h2>
                                                <p className="text-xs text-slate-300 mt-0.5">
                                                    A máquina está oficialmente parada. Selecione abaixo o suporte que deseja abastecer ou descarregar.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Cronômetro e Botão de Retomada no Topo */}
                                        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end flex-wrap">
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-white/10 text-right">
                                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Tempo Parada</span>
                                                <span className={`text-2xl font-black font-mono ${isOverLimit ? 'text-rose-400' : 'text-amber-400'}`}>
                                                    {formatDuration(durationMs)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-mono">Limite: {limitMinutes} min</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleResumeAction}
                                                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-emerald-500/20 flex items-center gap-2 flex-shrink-0"
                                            >
                                                <PlayIcon className="h-5 w-5" />
                                                <span>Concluir Troca & Retomar Máquina</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Justificativa caso tenha excedido o limite */}
                                    {isOverLimit && (
                                        <div className="bg-rose-950/70 border border-rose-500/50 p-4 rounded-2xl animate-fade-in-up">
                                            <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1.5 block">
                                                Justificativa Obrigatória de Atraso na Troca de Rolo
                                            </label>
                                            <textarea
                                                value={downtimeJustification}
                                                onChange={(e) => setDowntimeJustification(e.target.value)}
                                                placeholder="Descreva detalhadamente o motivo do atraso (ex: arame embaraçado no desbobinador, atraso na empilhadeira, solda demorada...)"
                                                className="w-full p-3 bg-rose-900/30 border border-rose-500/40 rounded-xl text-white text-sm font-medium focus:border-rose-400 outline-none resize-none h-20 placeholder:text-rose-300/40"
                                            />
                                        </div>
                                    )}

                                    {/* Gêmeo Digital dos Porta-Rolos Interativo e Liberado */}
                                    <div className="bg-[#07131B] p-3 sm:p-5 rounded-3xl border border-white/10 shadow-2xl">
                                        <TrelicaSpoolStands
                                            machineName={activeMachine}
                                            stock={stock}
                                            activeOrder={activeOrder}
                                            productionOrders={productionOrders}
                                            currentUser={currentUser}
                                            readOnly={false}
                                            onSpoolChange={(stand, newLot) => {
                                                if (addLotToOrder && activeOrder) {
                                                    try {
                                                        addLotToOrder(activeOrder.id, newLot.id);
                                                    } catch (e) {
                                                        console.warn('Auto addLotToOrder:', e);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Rodapé de Confirmação */}
                                    <div className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                        <p className="text-xs text-slate-300 font-medium">
                                            ✓ Bobinas instaladas e sincronizadas no sistema. Quando estiver pronto para religar a máquina:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleResumeAction}
                                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 flex-shrink-0"
                                        >
                                            <PlayIcon className="h-4 w-4" />
                                            <span>Retomar Produção Agora</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // SE A PARADA FOR ESPECIFICAMENTE POR ELETRODOS (LIMPEZA, AJUSTE OU TROCA):
                    const isParadaEletrodo = activeMachine.startsWith('Treliça') && (
                        normReason.includes('eletrodo') ||
                        normReason.includes('limpeza de eletrodo') ||
                        normReason.includes('troca de eletrodo') ||
                        normReason.includes('ajuste de eletrodo') ||
                        normReason.includes('solda')
                    );

                    if (isParadaEletrodo) {
                        return (
                            <div className="fixed inset-0 flex flex-col z-[100] bg-slate-950/95 backdrop-blur-2xl overflow-y-auto p-3 sm:p-6 custom-scrollbar animate-fade-in">
                                <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 my-auto">
                                    {/* Header de Parada Operacional: Eletrodos */}
                                    <div className={`p-4 sm:p-6 rounded-3xl border ${isOverLimit ? 'bg-rose-950/70 border-rose-500/60 shadow-rose-900/30' : 'bg-slate-900/90 border-cyan-500/40 shadow-cyan-900/20'} shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${isOverLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'}`}>
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider ${isOverLimit ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500 text-slate-950'}`}>
                                                        {isOverLimit ? '⚠️ LIMITE DE PARADA EXCEDIDO' : `PARADA ATIVA: ${reason.toUpperCase()}`}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-400">Máquina: <strong className="text-white">{activeMachine}</strong></span>
                                                    <span className="text-xs font-mono text-slate-400">OP: <strong className="text-cyan-400">#{activeOrder.orderNumber}</strong></span>
                                                </div>
                                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                                                    CABEÇA DE SOLDA: LIMPEZA, AJUSTE & TROCA DE ELETRODOS
                                                </h2>
                                                <p className="text-xs text-slate-300 mt-0.5">
                                                    A máquina está oficialmente parada. Selecione o eletrodo desejado no desenho para efetuar a limpeza, regulagem ou substituição.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Cronômetro e Botão de Retomada no Topo */}
                                        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end flex-wrap">
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-white/10 text-right">
                                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Tempo Parada</span>
                                                <span className={`text-2xl font-black font-mono ${isOverLimit ? 'text-rose-400' : 'text-cyan-400'}`}>
                                                    {formatDuration(durationMs)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-mono">Limite: {limitMinutes} min</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleResumeAction}
                                                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-emerald-500/20 flex items-center gap-2 flex-shrink-0"
                                            >
                                                <PlayIcon className="h-5 w-5" />
                                                <span>Concluir Eletrodos & Retomar Máquina</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Justificativa caso tenha excedido o limite */}
                                    {isOverLimit && (
                                        <div className="bg-rose-950/70 border border-rose-500/50 p-4 rounded-2xl animate-fade-in-up">
                                            <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1.5 block">
                                                Justificativa Obrigatória de Atraso no Procedimento dos Eletrodos
                                            </label>
                                            <textarea
                                                value={downtimeJustification}
                                                onChange={(e) => setDowntimeJustification(e.target.value)}
                                                placeholder="Descreva detalhadamente o motivo do atraso (ex: ajuste fino de altura demorado, remoção difícil de carepa de solda...)"
                                                className="w-full p-3 bg-rose-900/30 border border-rose-500/40 rounded-xl text-white text-sm font-medium focus:border-rose-400 outline-none resize-none h-20 placeholder:text-rose-300/40"
                                            />
                                        </div>
                                    )}

                                    {/* Gêmeo Digital da Cabeça de Solda (Interativo) */}
                                    <div className="bg-[#07131B] p-2 sm:p-4 rounded-3xl border border-white/10 shadow-2xl">
                                        <TrelicaWeldingHead
                                            machineName={activeMachine}
                                            readOnly={false}
                                            stock={stock}
                                            gauges={gauges}
                                        />
                                    </div>

                                    {/* Rodapé de Confirmação */}
                                    <div className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                        <p className="text-xs text-slate-300 font-medium">
                                            ✓ Procedimento de eletrodo concluído. Quando estiver pronto para religar a máquina:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleResumeAction}
                                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 flex-shrink-0"
                                        >
                                            <PlayIcon className="h-4 w-4" />
                                            <span>Retomar Produção Agora</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (currentMachineStatus === 'Preparacao' && !isOverLimit) return null;

                    // PARADA OPERACIONAL PADRÃO (OUTROS MOTIVOS: ENROSCO, MANUTENÇÃO, ETC.)
                    return (
                        <div className={`fixed inset-0 flex items-center justify-center z-[100] p-4 transition-all duration-500 ${isOverLimit ? 'bg-rose-600/90 animate-stop-pulse' : 'bg-amber-500/90 animate-warning-pulse'} backdrop-blur-xl`}>
                            <div className="text-center p-8 bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-sm mx-auto animate-zoom-in border border-white/20">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 transition-colors ${isOverLimit ? 'bg-rose-100 border-2 border-rose-500' : 'bg-amber-100 border-2 border-amber-500 animate-warning-pulse'}`}>
                                    <PauseIcon className={`h-10 w-10 ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`} />
                                </div>
                                
                                <h3 className={`text-2xl font-black mb-2 tracking-tight uppercase ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {isOverLimit ? 'LIMITE ULTRAPASSADO' : 'PARADA OPERACIONAL'}
                                </h3>
                                
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Motivo Atual</p>
                                    <p className="font-bold text-slate-700 text-lg uppercase italic">{reason}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 mb-6">
                                    <div className="bg-slate-900 p-4 rounded-2xl shadow-inner">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tempo Total de Parada</p>
                                        <p className="text-3xl font-black text-white font-mono">{formatDuration(durationMs)}</p>
                                    </div>
                                    
                                    {limitMs && (
                                        <div className={`p-4 rounded-2xl border-2 transition-all ${isOverLimit ? 'bg-rose-50 border-rose-500 animate-stop-pulse' : 'bg-amber-50 border-amber-500 animate-warning-pulse'}`}>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`}>
                                                Tempo Previsto: <span className="text-sm font-black">{limitMinutes} min</span>
                                            </p>
                                            <div className="w-full bg-black/10 rounded-full h-1.5 mt-2 overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${isOverLimit ? 'bg-rose-600' : 'bg-amber-500'}`} 
                                                    style={{ width: `${Math.min(100, (durationMs / limitMs) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {activeMachine.startsWith('Treliça') && (
                                    <div className="flex flex-col gap-2 mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowTrocaDeRoloInOtherStop(true)}
                                            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                        >
                                            <span>🔄</span>
                                            <span>Aproveitar Parada p/ Trocar Rolo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowElectrodesModal(true)}
                                            className="w-full py-2.5 px-4 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/50 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                        >
                                            <span>⚡</span>
                                            <span>Inspecionar / Trocar Eletrodos</span>
                                        </button>
                                    </div>
                                )}


                                {isOverLimit && (
                                    <div className="mb-6 text-left animate-fade-in-up">
                                        <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 block">
                                            Justificativa do Atraso (Obrigatório)
                                        </label>
                                        <textarea
                                            value={downtimeJustification}
                                            onChange={(e) => setDowntimeJustification(e.target.value)}
                                            placeholder="Descreva detalhadamente o motivo de ter excedido o limite..."
                                            className="w-full p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl text-slate-700 font-medium focus:border-rose-500 focus:bg-white transition-all outline-none min-h-[100px] resize-none shadow-inner"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handleResumeAction}
                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-lg flex items-center justify-center gap-3 mb-6 ${
                                        isOverLimit 
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 hover:scale-[1.02] active:scale-[0.98]' 
                                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                                >
                                    <PlayIcon className="h-5 w-5" />
                                    Retomar Produção
                                </button>

                                <p className="text-slate-400 text-[10px] font-bold uppercase leading-relaxed tracking-wider">
                                    Retome a produção assim que o problema for resolvido.
                                </p>
                            </div>
                        </div>
                    );
                })()
            )}

            {/* Overlay Fixed para Bloqueio de Operador ou Check-in de Turno Auto-Iniciado */}
            {!hasActiveShift && isAnyActiveShift && activeOrder && !isGestor && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-[100] transition-all duration-500 p-4">
                    <div className="text-center p-8 bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md mx-auto animate-fade-in-up border-4 border-amber-400/50 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400"></div>
                        
                        {currentOperatorLog?.pendingOperatorCheckin ? (
                            <>
                                <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-xl">
                                    <ClockIcon className="h-12 w-12 text-amber-500 animate-pulse" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-3 py-1 rounded-full mb-3 inline-block">
                                    Turno Aberto pelo Sistema
                                </span>
                                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase">
                                    {shiftStatus.shiftName}
                                </h3>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left space-y-1 text-xs">
                                    <p className="text-slate-600 font-bold">
                                        Horário agendado: <strong className="text-slate-900">{shiftStatus.shiftLabel}</strong>
                                    </p>
                                    <p className="text-slate-500">
                                        O sistema abriu este turno pontualmente às {new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                                    </p>
                                </div>
                                <p className="text-slate-500 mb-6 text-xs font-bold leading-relaxed">
                                    Faça seu check-in para conectar seu usuário <span className="text-indigo-600 font-black">{currentUser?.username}</span> ao posto de trabalho e iniciar a produção.
                                </p>
                                <button
                                    onClick={() => handleStartShift()}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 px-8 rounded-2xl uppercase text-sm flex items-center justify-center gap-3 tracking-[0.1em] transition-all shadow-xl shadow-emerald-100 active:scale-[0.97]"
                                >
                                    <CheckCircleIcon className="h-6 w-6" />
                                    Fazer Check-in e Assumir Posto
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-xl">
                                    <CogIcon className="h-12 w-12 text-amber-500 animate-spin-slow" />
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">Máquina Ocupada</h3>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                                    <p className="text-slate-500 text-sm leading-relaxed font-bold">
                                        O operador <span className="text-amber-600 font-black uppercase text-base">{currentOperatorLog?.operator}</span> ainda possui um turno ativo nesta máquina.
                                    </p>
                                </div>
                                <p className="text-slate-400 mb-8 text-xs font-black uppercase tracking-widest leading-relaxed">
                                    Se você é <span className="text-indigo-600 font-black">{currentUser?.username}</span> e vai iniciar seu turno agora,<br/>clique no botão abaixo:
                                </p>
                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={() => handleStartShift()}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-8 rounded-2xl uppercase text-sm flex items-center justify-center gap-3 tracking-[0.1em] transition-all shadow-xl shadow-indigo-100 active:scale-[0.97]"
                                    >
                                        <PlayIcon className="h-6 w-6" />
                                        Assumir Turno de {currentUser?.username || 'Hoje'}
                                    </button>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                        Ao clicar, o turno de {currentOperatorLog?.operator} será encerrado automaticamente.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {showCancelConfirmation && activeOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg animate-fade-in-up">
                        <div className="text-center">
                            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircleIcon className="h-10 w-10 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Cancelar Ordem de Produção</h2>
                            <p className="text-slate-600 mb-2">
                                Tem certeza que deseja <strong className="text-red-600">CANCELAR</strong> a ordem <strong>#{activeOrder.orderNumber}</strong>?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-amber-800 font-medium">
                                    ⚠️ Esta ação irá interromper a produção e devolver todos os lotes vinculados ao estoque.
                                    {activeOrder.actualProducedQuantity ? ` Peças já produzidas: ${activeOrder.actualProducedQuantity} pçs.` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirmation(false)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-6 rounded-lg transition"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCancelConfirmation(false);
                                    setShowCancelManagerAuth(true);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition flex items-center gap-2"
                            >
                                <XCircleIcon className="h-5 w-5" />
                                Confirmar Cancelamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showCancelManagerAuth && activeOrder && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`Cancelamento da ordem de produção #${activeOrder.orderNumber}. Os lotes serão devolvidos ao estoque e a produção será interrompida.`}
                    onSuccess={() => {
                        setShowCancelManagerAuth(false);
                        if (cancelProductionOrder) {
                            cancelProductionOrder(activeOrder.id);
                        }
                    }}
                    onCancel={() => setShowCancelManagerAuth(false)}
                />
            )}
            {showDowntimeModal && (
                <DowntimeModal 
                    onClose={() => setShowDowntimeModal(false)} 
                    onSubmit={handleStopMachine} 
                    onEndShift={activeOrder ? () => handleShiftEndRequest(activeOrder.id) : undefined}
                    onPauseOrder={activeOrder && (!activeMachine.startsWith('Trefila') && !activeMachine.startsWith('Desbobinadeira')) && pauseProductionOrder ? () => {
                        if (window.confirm('Tem certeza que deseja arquivar/pausar esta ordem para iniciar outra? Seu turno atual será encerrado e a ordem voltará para a fila de pendentes.')) {
                            pauseProductionOrder(activeOrder.id);
                            setView('pending');
                        }
                    } : undefined}
                    canPause={(!activeMachine.startsWith('Trefila') && !activeMachine.startsWith('Desbobinadeira'))}
                    downtimeEvents={activeOrder?.downtimeEvents || []}
                    downtimeConfigs={downtimeConfigs}
                    machineType={activeMachine}
                />
            )}
            {showCompletionModal && activeOrder && <CompletionModal order={activeOrder} onClose={() => setShowCompletionModal(false)} onSubmit={handleCompleteProduction} />}
            {showQuantityPrompt && promptOrder && (
                <QuantityPromptModal
                    onClose={() => setShowQuantityPrompt(false)}
                    onSubmit={handleUpdateQuantity}
                    currentQuantity={Math.max(0, (promptOrder.actualProducedQuantity || 0) - (currentOperatorLog?.startQuantity || 0))}
                    machineName={activeMachine}
                    order={promptOrder}
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
                    reports={(shiftReports || []).filter(r => {
                        const cat = (machineType || 'Trefila').toLowerCase();
                        const rMachine = (r.machine || '').toLowerCase();
                        if (cat.startsWith('trefila')) return rMachine.startsWith('trefila');
                        if (cat.startsWith('treliça')) return rMachine.startsWith('treliça');
                        if (cat.startsWith('desbobinadeira')) return rMachine.startsWith('desbobinadeira');
                        return r.machine === activeMachine;
                    })}
                    stock={stock}
                    onClose={() => setShowShiftReportsModal(false)}
                    onDelete={deleteShiftReport}
                    isGestor={isGestor}
                    onUpdateReport={handleUpdateShiftReport}
                />
            )}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                    gauges={gauges}
                    shiftReports={shiftReports}
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
                    actionDescription={`O encerramento do turno está sendo solicitado fora do horário de término previsto para a máquina ${activeMachine} (${shiftStatus.shiftName}: término às ${shiftStatus.workEnd}). É necessária autorização de um gestor para confirmar.`}
                    onSuccess={handleManagerAuthSuccess}
                    onCancel={() => {
                        setShowManagerAuthForShiftEnd(false);
                        setPendingShiftEnd(null);
                    }}
                />
            )}
            {showManagerAuthForOvertimeStart && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`Acesso e início de turno fora do horário regular programado para a máquina ${activeMachine} (${shiftStatus.shiftName}: ${shiftStatus.shiftLabel}). É necessária a senha do gestor para autorizar a operação em hora extra.`}
                    onSuccess={() => {
                        setShowManagerAuthForOvertimeStart(false);
                        handleStartShift(true);
                    }}
                    onCancel={() => setShowManagerAuthForOvertimeStart(false)}
                />
            )}
            {showManagerAuthForOvertimeExtend && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`Autorização para estender o turno e continuar a operação em HORA EXTRA na máquina ${activeMachine} após o horário de término (${shiftStatus.workEnd}).`}
                    onSuccess={() => {
                        setShowManagerAuthForOvertimeExtend(false);
                        setAuthorizedOvertimeForCurrentShift(true);
                        setShowAutoEndCountdownModal(false);
                    }}
                    onCancel={() => setShowManagerAuthForOvertimeExtend(false)}
                />
            )}
            {showAutoEndCountdownModal && activeOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4 animate-fade-in">
                    <div className="bg-[#0B1A24] border-2 border-amber-500/60 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse"></div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 font-bold text-3xl shrink-0">
                                ⏰
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full">
                                        Fim de Turno Atingido
                                    </span>
                                    <span className="text-xs text-amber-300 font-mono font-bold">
                                        {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white">
                                    Encerramento Automático de Turno
                                </h3>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-center">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
                                O sistema encerrará seu turno automaticamente em:
                            </p>
                            <div className="font-mono text-4xl sm:text-5xl font-black text-amber-400 tracking-wider">
                                {Math.floor(shiftStatus.remainingCountdownSeconds / 60).toString().padStart(2, '0')}:
                                {(shiftStatus.remainingCountdownSeconds % 60).toString().padStart(2, '0')}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Horário oficial de término: <strong className="text-white">{shiftStatus.workEnd}</strong>
                            </p>
                        </div>

                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Máquina:</span>
                                <span className="font-bold text-white">{activeMachine}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Ordem Ativa:</span>
                                <span className="font-bold text-white">#{activeOrder.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Produção Atual Acumulada:</span>
                                <span className="font-bold text-emerald-400">
                                    {activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')
                                        ? `${activeOrder.actualProducedQuantity || 0} peças`
                                        : `${(activeOrder.processedLots || []).filter(l => l.endTime).length} lotes concluídos`}
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-300/80 pt-2 border-t border-white/10 italic">
                                Ao encerrar automaticamente, o sistema registrará a produção salva acima e colocará a máquina em parada "Final de Turno".
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    handleShiftEndRequest(activeOrder.id);
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                            >
                                <span>✓</span>
                                <span>Encerrar Turno Agora</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowManagerAuthForOvertimeExtend(true)}
                                className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 active:scale-95 border border-amber-500/50 text-amber-300 hover:text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
                            >
                                <span>⏱️</span>
                                <span>Continuar em Hora Extra (Requer Gestor)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showLotSelectionModal && (
                <LotSelectionModal
                    onClose={() => setShowLotSelectionModal(false)}
                    stock={(() => {
                        const selectedIds = (Array.isArray(activeOrder?.selectedLotIds) ? activeOrder.selectedLotIds : [])
                            .map((l: any) => typeof l === 'string' ? l : l?.lotId)
                            .filter(Boolean);
                        const processedIds = (activeOrder?.processedLots || []).map(p => p.lotId);
                        const currentActiveId = activeOrder?.activeLotProcessing?.lotId;
                        const usedLotIds = new Set([...selectedIds, ...processedIds, currentActiveId].filter(Boolean));

                        const allowedBitolas = new Set<number>();

                        // 1. Tentar obter a bitola de entrada explicitamente definida na OP
                        if (activeOrder?.inputBitola) {
                            const bNum = parseBitolaFloat(activeOrder.inputBitola);
                            if (bNum !== null) {
                                allowedBitolas.add(bNum);
                            }
                        }

                        // 2. Se a OP já tiver lotes vinculados (pré-selecionados ou processados), pegar as bitolas deles
                        usedLotIds.forEach(id => {
                            const lot = stock.find(s => s.id === id);
                            if (lot && lot.bitola) {
                                const bNum = parseBitolaFloat(lot.bitola);
                                if (bNum !== null) {
                                    allowedBitolas.add(bNum);
                                }
                            }
                        });

                        const filteredStock = stock.filter(lot => {
                            const isAlreadyUsed = usedLotIds.has(lot.id);
                            if (isAlreadyUsed) return false;

                            const isFioMaquina = normalizeStr(lot.materialType) === 'fio maquina';
                            if (!isFioMaquina) return false;

                            // Se tivermos bitolas permitidas determinadas pela OP, filtramos estritamente por elas
                            if (allowedBitolas.size > 0) {
                                const lotBitolaNum = parseBitolaFloat(lot.bitola);
                                return lotBitolaNum !== null && allowedBitolas.has(lotBitolaNum);
                            }
                            return true;
                        });
                        return filteredStock;
                    })()}
                    onSelect={(lotId) => {
                        if (activeOrder && addLotToOrder) {
                            addLotToOrder(activeOrder.id, lotId);
                            setShowLotSelectionModal(false);
                        }
                    }}
                />
            )}
            {showBitolaCheck && (
                <BitolaCheckModal onClose={() => {
                    setShowBitolaCheck(false);
                    if (!hasPermission('trefilaInProgress') && !isGestor) {
                        setPage('menu');
                    }
                }} />
            )}

            {/* Modal de Visualização Somente Leitura dos Porta-Rolos (Sem Burlar Parada) */}
            {showReadOnlyStandsModal && activeMachine.startsWith('Treliça') && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[90] p-3 sm:p-6 animate-fade-in">
                    <div className="bg-[#0A1622] rounded-3xl border border-white/10 shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-cyan-500/20 rounded-2xl text-cyan-400 text-xl font-bold border border-cyan-500/30">
                                    👁️
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                            Visualização dos Porta-Rolos ({activeMachine})
                                        </h3>
                                        <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                                            🔒 Somente Leitura
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        A máquina continua em operação. Para carregar ou descarregar bobinas, realize a parada por <strong>"Troca de Rolo"</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReadOnlyStandsModal(false);
                                        if (logDowntime && activeOrder) {
                                            logDowntime(activeOrder.id, 'Troca de Rolo');
                                        } else {
                                            setShowDowntimeModal(true);
                                        }
                                    }}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-md flex items-center gap-1.5"
                                >
                                    <span>⏸️</span>
                                    <span>Parar Máquina p/ Trocar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReadOnlyStandsModal(false)}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                                >
                                    <XCircleIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <TrelicaSpoolStands
                            machineName={activeMachine}
                            stock={stock}
                            activeOrder={activeOrder}
                            productionOrders={productionOrders}
                            currentUser={currentUser}
                            readOnly={true}
                        />
                    </div>
                </div>
            )}

            {/* Modal do Gêmeo Digital da Cabeça de Solda (7 Eletrodos) */}
            {showElectrodesModal && activeMachine.startsWith('Treliça') && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[105] p-3 sm:p-6 animate-fade-in">
                    <div className="w-full max-w-7xl max-h-[92vh] overflow-y-auto custom-scrollbar">
                        <TrelicaWeldingHead
                            machineName={activeMachine}
                            readOnly={!isMachineStopped && !isGestor}
                            onClose={() => setShowElectrodesModal(false)}
                            stock={stock}
                            gauges={gauges}
                        />
                    </div>
                </div>
            )}



            {/* Machine Header for better context on mobile */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">{machineHeader}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1 w-8 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Logado como: <span className="text-indigo-600 font-black">{currentUser?.username}</span>
                        </span>
                    </div>
                </div>
                
                {/* Machine Selector Dropdown - ONLY SHOWN FOR GESTORS */}
                {isGestor && (
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setPage('downtimeConfigs')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-indigo-700 shadow-sm whitespace-nowrap"
                        >
                            <AdjustmentsIcon className="h-4 w-4" />
                            Configurar Paradas
                        </button>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Maq:</label>
                            <div className="relative">
                                <select
                                    value={activeMachine}
                                    onChange={(e) => setActiveMachine(e.target.value as MachineType)}
                                    className="appearance-none bg-slate-100 hover:bg-slate-200 border-none rounded-xl py-2 px-4 pr-10 text-sm font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer outline-none"
                                >
                                    {machineType.startsWith('Trefila') ? (
                                        <>
                                            <option value="Trefila 1">TREFILA 1</option>
                                            <option value="Trefila 2">TREFILA 2</option>
                                        </>
                                    ) : machineType.startsWith('Treliça') ? (
                                        <>
                                            <option value="Treliça 1">TRELIÇA 1</option>
                                            <option value="Treliça 2">TRELIÇA 2</option>
                                        </>
                                    ) : (
                                        <option value={machineType}>{machineType}</option>
                                    )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {view === 'dashboard' && (
                <div className="space-y-6">
                    {activeOrder && !hasActiveShift && (
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center border-2 border-slate-100">
                            {currentOperatorLog?.pendingOperatorCheckin ? (
                                <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-6 rounded-2xl border-2 border-amber-500/40 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-500 text-3xl font-black mx-auto mb-3 animate-pulse">
                                        ⚡
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-3 py-1 rounded-full inline-block mb-2">
                                        Turno Aberto pelo Sistema • Aguardando Check-in
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 mb-1">
                                        {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4 max-w-md mx-auto">
                                        Abertura oficial realizada às <strong className="text-slate-900">{new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>. Faça o check-in para assumir o posto de trabalho.
                                    </p>
                                    <button
                                        onClick={() => handleStartShift()}
                                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-3.5 px-8 rounded-xl transition text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-2 mx-auto"
                                    >
                                        <span>👤</span>
                                        <span>Fazer Check-in e Assumir Posto</span>
                                    </button>
                                </div>
                            ) : isAnyActiveShift ? (
                                <>
                                    <h3 className="text-xl font-semibold text-slate-800 mb-2">A ordem <span className="font-bold text-slate-600">{activeOrder.orderNumber}</span> está sendo operada por <span className="text-indigo-600 font-bold uppercase">{currentOperatorLog?.operator}</span>.</h3>
                                    <p className="text-slate-500 mb-4 text-sm">
                                        {isGestor
                                            ? "Você pode acompanhar o progresso em tempo real ou iniciar um turno auxiliar."
                                            : "Aguarde o encerramento do turno atual para iniciar o seu ou acompanhe no painel."}
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button onClick={() => setView('in_progress')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-lg transition shadow-lg shadow-slate-200">
                                            Acompanhar Painel
                                        </button>
                                        {isGestor && (
                                            <button onClick={() => handleStartShift()} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold py-2 px-6 rounded-lg border border-emerald-100 transition">
                                                Iniciar Meu Turno (Gestor)
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-xl font-semibold text-slate-800 mb-4">A ordem <span className="font-bold text-slate-600">{activeOrder.orderNumber}</span> está aguardando operador.</h3>
                                    <button onClick={() => handleStartShift()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition text-lg shadow-lg shadow-emerald-100">
                                        Iniciar Meu Turno
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    {activeOrder && (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white mb-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ordem Ativa</p>
                                    <h3 className="text-3xl font-black tracking-tighter">#{activeOrder.orderNumber}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                                        {statusStyle.label}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Operador</p>
                                    <p className="font-bold">{isAnyActiveShift ? currentOperatorLog?.operator : (currentUser?.username || '---')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Progresso</p>
                                    <p className="font-bold">
                                        {activeMachine.startsWith('Trefila')
                                            ? `${shiftProducedTotal} Lotes (Turno Atual)`
                                            : `${shiftProducedTotal} / ${activeOrder.quantityToProduce} Pçs (Turno Atual)`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {hasPermission(getPermissionPage('InProgress')) && (
                            <MachineMenuButton
                                onClick={() => setView('in_progress')}
                                label={postProductionOrder ? "Acompanhar" : "Painel"}
                                description={postProductionOrder ? "Pós-Produção" : "Em Produção"}
                                icon={<CogIcon className={`h-6 w-6 ${activeOrder ? 'animate-spin' : ''}`} />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Pending')) && (
                            <MachineMenuButton
                                onClick={() => setView('pending')}
                                label="Fila"
                                description="Próximos"
                                icon={<ClipboardListIcon className="h-6 w-6" />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Completed')) && (
                            <MachineMenuButton
                                onClick={() => setView('completed')}
                                label="Histórico"
                                description="Finalizados"
                                icon={<ArchiveIcon className="h-6 w-6" />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Reports')) && (
                            <MachineMenuButton
                                onClick={() => setShowShiftReportsModal(true)}
                                label="Turnos"
                                description="Relatórios"
                                icon={<DocumentReportIcon className="h-6 w-6" />}
                            />
                        )}
                        {activeMachine.startsWith('Trefila') && hasPermission('trefilaRings') && (
                            <MachineMenuButton
                                onClick={() => setShowTrefilaCalculation(true)}
                                label="Simulação"
                                description="Anéis & K-7"
                                icon={<CalculatorIcon className="h-6 w-6" />}
                            />
                        )}
                        {activeMachine.startsWith('Trefila') && (
                            <MachineMenuButton
                                onClick={() => setShowBitolaCheck(true)}
                                label="Conferir Bitola"
                                description="Calculadora Rápida"
                                icon={<ScaleIcon className="h-6 w-6" />}
                            />
                        )}
                    </div>
                </div>
            )}
            {view === 'in_progress' && (
                <>
                    {/* Mobile Tab Switcher */}
                    {(activeOrder || postProductionOrder) && (
                        <div className="flex md:hidden mb-6 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                            <button
                                onClick={() => setMobileTab('monitor')}
                                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'monitor' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                            >
                                <ChartBarIcon className={`h-3.5 w-3.5 ${mobileTab === 'monitor' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                PAINEL
                            </button>
                            {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                <>
                                    <button
                                        onClick={() => setMobileTab('process')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'process' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                    >
                                        <PlayIcon className={`h-3.5 w-3.5 ${mobileTab === 'process' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                        Processar
                                    </button>
                                    <button
                                        onClick={() => setMobileTab('weigh')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'weigh' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                    >
                                        <ScaleIcon className={`h-3.5 w-3.5 ${mobileTab === 'weigh' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                        Pesagem
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setMobileTab('work')}
                                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'work' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                >
                                    <ScaleIcon className={`h-3.5 w-3.5 ${mobileTab === 'work' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    Pesagem
                                </button>
                            )}
                            <button
                                onClick={() => setMobileTab('performance')}
                                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'performance' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                            >
                                <ChartBarIcon className={`h-3.5 w-3.5 ${mobileTab === 'performance' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                Performance
                            </button>
                        </div>
                    )}

                    {activeOrder ? (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 md:pb-8">
                                {/* Coluna Esquerda: Visão Geral e Indicadores */}
                                <div className={`lg:col-span-1 space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                    {/* Trefila Mobile: Optimized Panel (Enchuto) */}
                                    {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                        <div className="md:hidden animate-fade-in space-y-4">
                                            {/* Status Hero - Hidden on mobile as per user request (will move info to bottom button) */}
                                            <div className={`hidden md:relative overflow-hidden p-6 rounded-[2rem] transition-all duration-700 ${
                                                isActiveProcess ? 'bg-emerald-600 shadow-lg shadow-emerald-100' : 'bg-amber-500 shadow-lg shadow-amber-100'
                                            }`}>
                                                <div className="absolute -right-8 -top-8 p-4 opacity-10">
                                                    {isActiveProcess ? <PlayIcon className="h-32 w-32 text-white" /> : <PauseIcon className="h-32 w-32 text-white" />}
                                                </div>
                                                
                                                <div className="relative z-10 flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Máquina {machineType}</span>
                                                    <h2 className="text-3xl font-black text-white tracking-tighter">
                                                        {isActiveProcess ? 'PRODUZINDO' : 'PARADA'}
                                                    </h2>
                                                    
                                                    {activeLotProcessingData && (
                                                        <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between">
                                                            <div>
                                                                <span className="text-[8px] font-black text-white/60 uppercase block">Lote Atual</span>
                                                                <span className="text-sm font-bold text-white italic">{activeLotProcessingData.lotInfo.internalLot}</span>
                                                            </div>
                                                            <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                                                                <div className="w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Minimal Stats Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bitola</span>
                                                    <span className="text-xl font-black text-slate-800">{activeOrder.targetBitola} <span className="text-[10px] text-slate-300">mm</span></span>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Meta Turno</span>
                                                    <span className="text-xl font-black text-slate-800">20.000 <span className="text-[10px] text-slate-300">kg</span> <span className="text-[10px] text-slate-400 ml-1">/ 10 Lts</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // ORIGINAL CONTENT FOR TRELIÇA OR DESKTOP
                                        <div className={`space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                            {currentOperatorLog?.pendingOperatorCheckin && (
                                                <div className="bg-amber-500/20 border-2 border-amber-500/60 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 animate-pulse">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-amber-500/30 p-2.5 rounded-xl text-amber-400 font-bold shrink-0 text-xl">
                                                            ⚡
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                                                                    Turno Aberto (Sistema)
                                                                </span>
                                                                <span className="text-xs text-amber-300 font-mono font-bold">
                                                                    {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                                                </span>
                                                            </div>
                                                            <h4 className="text-slate-800 font-black text-base mt-0.5">
                                                                Aguardando Check-in do Operador
                                                            </h4>
                                                            <p className="text-slate-600 text-xs">
                                                                Faça o check-in para registrar sua atuação neste posto.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleStartShift()}
                                                        className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-md transition shrink-0"
                                                    >
                                                        👤 Fazer Check-in
                                                    </button>
                                                </div>
                                            )}
                                            {isShiftOverdue && (
                                                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 shadow-sm flex items-start gap-4 animate-pulse">
                                                    <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0">
                                                        <ExclamationIcon className="h-8 w-8" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-red-700 font-black text-lg">⚠️ Fim de Turno!</h4>
                                                        <p className="text-red-600 text-xs font-bold mt-1 leading-relaxed">
                                                            Horário encerrado. Finalize o turno.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Card de Status Principal - Novo Design Pulsante */}
                                            <div 
                                                onClick={() => {
                                                    if (isUnderStopAlerta && activeOrder) {
                                                        setShowDowntimeModal(true);
                                                    }
                                                }}
                                                title={isUnderStopAlerta ? "Clique para abrir o Menu Operacional de Paradas / Troca de Rolo" : undefined}
                                                className={`p-6 rounded-3xl border-4 transition-all duration-1000 ${
                                                    isActiveProcess ? 'bg-emerald-50 border-emerald-500/50 animate-producing-pulse shadow-[0_0_30px_rgba(16,185,129,0.2)]' :
                                                    isUnderStopAlerta ? 'bg-rose-50 border-rose-500/50 animate-stop-pulse shadow-[0_0_30px_rgba(244,63,94,0.2)] cursor-pointer hover:border-amber-400 hover:shadow-amber-500/20' :
                                                    'bg-white border-slate-100'
                                                } hidden md:block`}>
                                                <div className="flex items-center gap-6">
                                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-transform duration-500 ${
                                                        isActiveProcess ? 'bg-emerald-600 rotate-12 scale-110' :
                                                        isUnderStopAlerta ? 'bg-rose-600 -rotate-12 scale-110' :
                                                        'bg-slate-200'
                                                    }`}>
                                                        {isActiveProcess ? <PlayIcon className="h-10 w-10 text-white" /> : 
                                                        isUnderStopAlerta ? <PauseIcon className="h-10 w-10 text-white" /> : 
                                                        <CogIcon className="h-10 w-10 text-slate-400" />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                                                            isActiveProcess ? 'text-emerald-600' :
                                                            isUnderStopAlerta ? 'text-rose-600' :
                                                            'text-slate-400'
                                                        }`}>Status em Tempo Real</p>
                                                        <h2 className={`text-2xl font-black tracking-tighter ${
                                                            isActiveProcess ? 'text-emerald-900' :
                                                            isUnderStopAlerta ? 'text-rose-900' :
                                                            'text-slate-800'
                                                        }`}>
                                                            {isActiveProcess ? 'PRODUZINDO' : isUnderStopAlerta ? 'PARADA' : 'DESLIGADA'}
                                                        </h2>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className={`h-2 w-2 rounded-full animate-pulse ${isActiveProcess ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                                {statusStyle.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {activeLotProcessingData && (
                                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center shadow-sm">
                                                            <div>
                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lote Atual</p>
                                                                <p className="text-xl font-black text-slate-800 tracking-tighter italic">{activeLotProcessingData.lotInfo.internalLot}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xl font-black text-emerald-700">{activeLotProcessingData.lotInfo.labelWeight?.toFixed(0) || '-'}kg</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                            {/* Card OP Mini */}
                                            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:block' : ''}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ordem de Produção</p>
                                                        <p className="text-2xl font-black text-slate-900 tracking-tighter">#{activeOrder.orderNumber}</p>
                                                    </div>
                                                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                        <ClipboardListIcon className="h-6 w-6 text-slate-400" />
                                                    </div>
                                                </div>
                                            </div>
                                    </div>

                                {/* Coluna Direita: Métricas e Controles de Produção */}
                                    <div className={`lg:col-span-2 space-y-4 md:space-y-6 ${(mobileTab !== 'monitor' && mobileTab !== 'performance') ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                        <div className={`grid grid-cols-1 gap-6 ${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:grid' : 'grid'}`}>
                                                {/* Header Info - Simplified for Mobile */}
                                                <div className="col-span-2">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-2 uppercase tracking-widest font-bold">Produção do Turno</p>
                                                    {currentOperatorLog ? (
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <span className="text-sm md:text-base font-black text-slate-800 bg-white border border-slate-200 shadow-sm px-4 py-1.5 rounded-lg">
                                                                {isAnyActiveShift ? currentOperatorLog.operator : (currentUser?.username || 'Sem operador')}
                                                            </span>
                                                            <span className="text-xs font-black bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-200 uppercase tracking-widest shadow-sm">
                                                                {shiftStatus.shiftName}
                                                            </span>
                                                            <span className="md:hidden text-lg font-black text-slate-800 bg-white border border-slate-200 px-4 py-1.5 rounded-lg shadow-sm">
                                                                {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? `${activeOrder.targetBitola} mm` : activeOrder.trelicaModel}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-400 bg-white border px-3 py-1 rounded-lg">Sem operador</span>
                                                    )}
                                                </div>
                                                <div className="hidden md:block">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-1">Bitola Saída</p>
                                                    <p className="text-sm md:text-base font-semibold text-slate-700">{activeOrder.targetBitola}</p>
                                                </div>
                                                <div className="hidden md:block">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-1">Meta</p>
                                                    <p className="text-sm md:text-base font-semibold text-slate-700">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? '20.000' : activeOrder.totalWeight?.toFixed(0) || 0} kg</p>
                                                </div>
                                            </div>



                                    {/* Card de Estoque de Anéis (Críticos) - Novo */}
                                    {activeMachine.startsWith('Trefila') && ringStock.filter(r => r.quantity < 3).length > 0 && (
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500">
                                                <ExclamationIcon className="h-12 w-12" />
                                            </div>
                                            <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <ExclamationIcon className="h-4 w-4" />
                                                Alerta de Estoque (Anéis)
                                            </h3>
                                            <div className="space-y-3">
                                                {ringStock
                                                    .filter(r => r.quantity < 3)
                                                    .slice(0, 3)
                                                    .map(ring => (
                                                        <div key={ring.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700 text-sm">{ring.model}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase font-black">Necessita Reposição</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-lg font-black text-amber-600">{ring.quantity}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase font-black ml-1">un</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                {ringStock.filter(r => r.quantity < 3).length > 3 && (
                                                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">+ {ringStock.filter(r => r.quantity < 3).length - 3} itens com estoque baixo</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Progresso de Produção - VISÍVEL APENAS NA ABA DE PERFORMANCE NO MOBILE OU SEMPRE NO DESKTOP */}
                                    <div className={`bg-white p-6 rounded-2xl shadow-sm relative overflow-hidden group ${mobileTab === 'performance' ? 'block' : 'hidden lg:block'}`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                                            <ChartBarIcon className="h-16 w-16" />
                                        </div>

                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                Performance de Produção
                                            </div>
                                            {/* Mobile Compact Stats Highlights */}
                                            <div className="md:hidden flex gap-3">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Lotes:</span>
                                                    <span className="text-[10px] font-black text-slate-700">{(activeOrder.processedLots || []).length}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">KG:</span>
                                                    <span className="text-[10px] font-black text-emerald-600">
                                                        {(activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </h3>

                                        {activeMachine.startsWith('Treliça') ? (
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
                                                <div className="relative pt-2">
                                                    <div className="flex items-end justify-between mb-3">
                                                        <div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">KG no Turno</span>
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                                                        {(() => {
                                                                            if (!currentOperatorLog) return 0;
                                                                            const shiftStart = new Date(currentOperatorLog.startTime).getTime();
                                                                            const shiftLots = (activeOrder.processedLots || []).filter(l => l.endTime && new Date(l.endTime).getTime() >= shiftStart);
                                                                            return shiftLots.reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0);
                                                                        })()}
                                                                    </span>
                                                                    <span className="text-2xl font-black text-slate-300 uppercase tracking-widest">kg</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progresso da Ordem</span>
                                                                    <div className="flex items-baseline gap-1.5">
                                                                        <span className="text-lg font-black text-slate-600">
                                                                            {(activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0)}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-slate-300">/ {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? '20.000' : activeOrder.totalWeight?.toFixed(0) || 0} kg</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md mb-1">
                                                                Lotes Concluídos
                                                            </span>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-black text-slate-700 tracking-tighter">{(activeOrder.processedLots || []).length}</span>
                                                                <span className="text-xs font-bold text-slate-300">
                                                                    / {(() => {
                                                                        const raw = activeOrder.selectedLotIds || [];
                                                                        return Array.isArray(raw) ? raw.length : 0;
                                                                    })()}
                                                                </span>
                                                            </div>
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
                                            </div>
                                        )}
                                    </div>

                                    {/* Mobile Collapsible Details */}
                                    {(activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) && (
                                        <div className="md:hidden">
                                            <details className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
                                                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                        <ClockIcon className="h-4 w-4" /> Ver Detalhes Adicionais
                                                    </span>
                                                    <ChevronDownIcon className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="p-4 pt-0 space-y-6 animate-fade-in">
                                                    {hasActiveShift && (
                                                        <div className="bg-slate-900 p-6 rounded-xl shadow-lg">
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
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-widest">{shiftStatus.shiftName}: {shiftStatus.shiftLabel}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="bg-slate-50 p-4 rounded-xl">
                                                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                                            <ClockIcon className="h-5 w-5 text-amber-500" /> Histórico de Paradas
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {activeOrder.downtimeEvents && activeOrder.downtimeEvents.length > 0 ? (
                                                                [...activeOrder.downtimeEvents].reverse().slice(0, 3).map((event, index) => {
                                                                    const stop = new Date(event.stopTime);
                                                                    const resume = event.resumeTime ? new Date(event.resumeTime) : new Date();
                                                                    const durationMs = resume.getTime() - stop.getTime();
                                                                    return (
                                                                        <div key={index} className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                                                                            <span className="font-bold text-slate-700 truncate mr-2">{event.reason}</span>
                                                                            <span className="font-mono text-slate-500 whitespace-nowrap">{formatDuration(durationMs)}</span>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="text-center text-slate-400 italic">Sem paradas.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    )}

                                    {/* Progresso visível apenas em desktop ou se não for Trefila Mobile */}
                                    <div className={`${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:block' : 'block'}`}>
                                        {/* Performance Section contents... kept for desktop */}
                                    </div>
                                    </div>
                                {/* Coluna Direita: Área de Trabalho (Lotes/Pacotes) */}
                                <div className={`lg:col-span-2 space-y-6 relative ${mobileTab === 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>

                                    {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                        <>
                                            {/* OS Tracking - Desbobinadeira */}
                                            {activeMachine.startsWith('Desbobinadeira') && (() => {
                                                const osItems = (activeOrder as any)?.osItems || [];
                                                const osProgress = (activeOrder as any)?.osProgress || { logs: [] };
                                                const osLogs = osProgress.logs || [];
                                                const completedOsLabels = new Set(osLogs.map((l: any) => l.os));
                                            
                                                const pendingOsItems = osItems.filter((item: any, idx: number) => !completedOsLabels.has(item.os) && !completedOsLabels.has(`OS ${idx + 1}`));
                                                const completedOsItems = osItems.filter((item: any, idx: number) => completedOsLabels.has(item.os) || completedOsLabels.has(`OS ${idx + 1}`));
                                            
                                                // Find the searched OS
                                                const searchedOsObj = osSearchTerm.trim() 
                                                    ? osItems.find((item: any, idx: number) => {
                                                        const term = osSearchTerm.trim().toLowerCase();
                                                        const itemName = (item.os || `OS ${idx + 1}`).toLowerCase();
                                                        return itemName === term || itemName.replace(/^os\s*/, '') === term;
                                                      })
                                                    : null;
                                            
                                                const searchedOsIndex = searchedOsObj 
                                                    ? osItems.indexOf(searchedOsObj)
                                                    : -1;
                                            
                                                // Check if searched OS is already completed or in progress
                                                const isSearchedCompleted = searchedOsObj ? completedOsLabels.has(searchedOsObj.os) : false;
                                                const isSearchedActive = searchedOsObj && osProgress.currentOs === (searchedOsObj.os);
                                            
                                                return (
                                                    <div className={`space-y-4 sm:space-y-6 ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                        {/* Buscador de OS */}
                                                        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
                                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                                                                <div>
                                                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                                                        <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">🔍</span> Buscar OS
                                                                    </h3>
                                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Digite apenas o número ou nome da OS</p>
                                                                </div>
                                                                {osProgress.currentOs && (
                                                                    <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto justify-between sm:justify-start gap-3 bg-indigo-50 border border-indigo-200 p-3 sm:px-4 rounded-xl shadow-sm mt-3 sm:mt-0">
                                                                        <div className="flex justify-between items-center w-full sm:w-auto">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Em Corte</span>
                                                                                <span className="text-sm font-black text-indigo-900">{osProgress.currentOs}</span>
                                                                            </div>
                                                                            <span className="font-mono font-black text-xl text-indigo-600 px-2 sm:hidden">{formatDuration(osElapsed * 1000)}</span>
                                                                        </div>
                                                                        <div className="w-px h-6 bg-indigo-200 hidden sm:block"></div>
                                                                        <span className="font-mono font-black text-xl text-indigo-600 px-1 sm:px-2 hidden sm:block">{formatDuration(osElapsed * 1000)}</span>
                                                                        <button
                                                                            onClick={handleFinishOs}
                                                                            className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-[10px] font-black py-3 sm:py-2 px-3 sm:px-4 rounded-lg transition active:scale-95 shadow-md uppercase tracking-widest"
                                                                        >
                                                                            Finalizar OS
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                            
                                                            <div className="flex gap-2 sm:gap-4 mb-2">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={osSearchTerm}
                                                                    onChange={(e) => setOsSearchTerm(e.target.value)}
                                                                    placeholder="Ex: 1"
                                                                    className="flex-1 p-3 sm:p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-base sm:text-lg font-black text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all uppercase"
                                                                />
                                                            </div>
                                                            {osSearchTerm && !searchedOsObj && (
                                                                <div className="mb-2 sm:mb-4 inline-flex items-center text-rose-500 text-[10px] sm:text-[11px] font-black tracking-widest uppercase bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                                                    ⚠ OS Não Encontrada
                                                                </div>
                                                            )}
                                            
                                                            {/* Card de Confirmação */}
                                                            {searchedOsObj && (
                                                                <div className="mt-4 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-100 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
                                                                    <div className="absolute -right-4 -top-4 opacity-5 sm:opacity-10 text-indigo-600">
                                                                        <ClipboardListIcon className="h-24 w-24 sm:h-32 sm:w-32" />
                                                                    </div>
                                                                    <h4 className="text-xs sm:text-sm font-black text-indigo-800 uppercase tracking-widest mb-3 sm:mb-4 relative z-10">Confirmar Dados da OS</h4>
                                                                    
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 relative z-10">
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Número</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800 truncate">{searchedOsObj.os || `OS ${searchedOsIndex + 1}`}</span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bitola</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800">{searchedOsObj.bitola || '-'} <span className="text-[10px] text-slate-400">mm</span></span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Formato</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800 truncate">{searchedOsObj.drawingType || '-'}</span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quantidade</span>
                                                                            <span className="text-lg sm:text-xl font-black text-indigo-600">{searchedOsObj.quantity || '-'} <span className="text-[10px] text-indigo-400">pçs</span></span>
                                                                        </div>
                                                                    </div>
                                            
                                                                    <div className="relative z-10">
                                                                        {isSearchedCompleted ? (
                                                                            <div className="w-full text-center py-2.5 sm:py-3 bg-emerald-100 text-emerald-700 font-black rounded-xl border border-emerald-200 uppercase tracking-widest text-xs sm:text-sm shadow-sm">
                                                                                ✓ Concluída
                                                                            </div>
                                                                        ) : isSearchedActive ? (
                                                                            <div className="w-full text-center py-2.5 sm:py-3 bg-indigo-100 text-indigo-700 font-black rounded-xl border border-indigo-200 uppercase tracking-widest text-xs sm:text-sm shadow-sm animate-pulse">
                                                                                ⏳ Em Corte
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    handleStartOs(searchedOsIndex);
                                                                                    setOsSearchTerm(''); // Limpar ao iniciar
                                                                                }}
                                                                                disabled={!!osProgress.currentOs}
                                                                                className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-lg shadow-slate-300 transition active:scale-[0.99] uppercase tracking-widest disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none flex items-center justify-center gap-2 text-xs sm:text-sm"
                                                                            >
                                                                                <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" /> Aceitar e Iniciar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                            
                                                        {/* Tabelas de Acompanhamento */}
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* OS Pendentes */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full max-h-[500px]">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pendentes
                                                                    </h4>
                                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg">{pendingOsItems.length} OS</span>
                                                                </div>
                                                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                                                    {pendingOsItems.length === 0 ? (
                                                                        <div className="text-center text-slate-400 py-10 italic text-sm font-semibold">Nenhuma OS pendente.</div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            {pendingOsItems.map((item: any, idx: number) => {
                                                                                const isCurrent = osProgress.currentOs === item.os;
                                                                                return (
                                                                                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${isCurrent ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100'} hover:bg-slate-100 transition-colors`}>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                                                                                                <ClipboardListIcon className={`h-4 w-4 ${isCurrent ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="block font-black text-slate-800 text-xs">{item.os}</span>
                                                                                                <span className="text-[10px] font-bold text-slate-400">{item.quantity} pçs • {item.bitola}mm</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {isCurrent && <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-widest animate-pulse">Em Corte</span>}
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                            
                                                            {/* OS Concluídas */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full max-h-[500px]">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Concluídas
                                                                    </h4>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase">{completedOsItems.reduce((acc: number, i: any) => acc + (i.weight || 0), 0).toFixed(1).replace('.', ',')} kg</span>
                                                                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-100">{completedOsItems.length} OS</span>
                                                                    </div>
                                                                </div>
                                                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                                                    {completedOsItems.length === 0 ? (
                                                                        <div className="text-center text-slate-400 py-10 italic text-sm font-semibold">Nenhuma OS concluída ainda.</div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            {completedOsItems.map((item: any, idx: number) => {
                                                                                const logEntry = osLogs.find((l: any) => l.os === item.os || l.os === `OS ${idx + 1}`);
                                                                                return (
                                                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/30 border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 rounded-lg bg-white border border-emerald-100 flex items-center justify-center">
                                                                                                <span className="text-emerald-500 font-black text-[10px]">✓</span>
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="block font-black text-slate-800 text-xs">{item.os}</span>
                                                                                                <span className="text-[10px] font-bold text-slate-400">{item.quantity} pçs • {item.bitola}mm</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {logEntry && (
                                                                                            <div className="text-right">
                                                                                                <span className="block text-xs font-mono font-black text-emerald-600">{formatDuration(logEntry.durationSeconds * 1000)}</span>
                                                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Tempo</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className={`bg-white p-6 rounded-2xl shadow-sm ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                    <CogIcon className="h-6 w-6 text-slate-400" /> Lote em Processamento
                                                </h3>
                                                {activeLotProcessingData ? (
                                                    <div className={`p-6 border rounded-xl transition-all duration-500 ${activeLotProcessingData.isDelayed ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100'}`}>
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                            <div>
                                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${activeLotProcessingData.isDelayed ? 'bg-red-500 text-white' : 'text-indigo-500 bg-indigo-100'}`}>
                                                                    {activeLotProcessingData.isDelayed ? '⚠ LOTE ATRASADO' : 'Em Andamento'}
                                                                </span>
                                                                <h4 className={`text-2xl font-bold mt-2 ${activeLotProcessingData.isDelayed ? 'text-red-700' : 'text-slate-800'}`}>
                                                                    {activeLotProcessingData.lotInfo?.internalLot || activeLotProcessingData.lotId} 
                                                                    <span className="text-sm font-black text-slate-400 ml-2 italic">
                                                                        • {activeLotProcessingData.lotInfo?.initialQuantity?.toLocaleString('pt-BR') || '0'} KG
                                                                    </span>
                                                                </h4>
                                                                <div className="flex flex-wrap gap-4 mt-2">
                                                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                                                        <ClockIcon className="h-4 w-4" /> Iniciado às {activeLotProcessingData.startTime ? new Date(activeLotProcessingData.startTime).toLocaleTimeString('pt-BR') : '--:--'}
                                                                    </p>
                                                                    {activeLotProcessingData.speed && (
                                                                        <p className={`text-sm font-bold flex items-center gap-2 ${activeLotProcessingData.isDelayed ? 'text-red-600' : 'text-indigo-600'}`}>
                                                                            <ChartBarIcon className="h-4 w-4" /> {activeLotProcessingData.speed.toString().replace('.', ',')} m/s
                                                                        </p>
                                                                    )}
                                                                    {activeLotProcessingData.estimatedTimeSeconds !== null && (
                                                                        <p className={`text-sm font-black flex items-center gap-2 px-3 py-1 rounded-lg border ${activeLotProcessingData.isDelayed ? 'text-red-700 bg-red-100 border-red-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                                                                            <ClockIcon className="h-4 w-4" /> 
                                                                            {activeLotProcessingData.isDelayed ? 'Atraso: ' : 'Tempo Est.: '}
                                                                            {activeLotProcessingData.isDelayed 
                                                                                ? formatDuration((activeLotProcessingData.elapsedUptimeSeconds - ((activeLotProcessingData.lotInfo?.initialQuantity || 0) / (parseFloat(activeOrder?.targetBitola?.replace(',', '.') || '1')**2 * 0.006162 * (activeLotProcessingData.speed || 1)))) * 1000)
                                                                                : formatDuration(activeLotProcessingData.estimatedTimeSeconds * 1000)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button onClick={handleFinishLotProcess} disabled={isEmergencyStopped || (!hasActiveShift && !isGestor)} className={`w-full md:w-auto font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none ${activeLotProcessingData.isDelayed ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}>
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

                                            <div className={`bg-white p-6 rounded-2xl shadow-sm ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg font-bold text-slate-700">Fila de Lotes (Matéria-Prima)</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    {waitingLots.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {waitingLots.map(lot => (
                                                                <div key={lot.id} className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition bg-slate-50 group">
                                                                    <div className="flex justify-between items-start mb-3">
                                                                        <span className="font-bold text-slate-700 text-lg">{lot.internalLot}</span>
                                                                        <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md font-mono">{lot.initialQuantity?.toFixed(1) || '-'} kg</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleStartProcessingLot(lot.id)}
                                                                        disabled={!!activeLotProcessingData || isEmergencyStopped || (!hasActiveShift && !isGestor)}
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

                                            <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm ${mobileTab !== 'weigh' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <h3 className="text-lg font-bold text-slate-700 mb-4">Lotes Finalizados</h3>
                                                <div className="overflow-x-auto max-h-80">
                                                    {/* Desktop Table */}
                                                    <table className="w-full text-sm hidden sm:table border-separate border-spacing-0">
                                                        <thead className="bg-slate-50 text-left sticky top-0 z-10">
                                                            <tr className="text-[10px] text-slate-400 uppercase tracking-widest">
                                                                <th className="p-3 font-black border-b border-slate-100">Lote</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-right">KG Entrada</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-right">KG Saída</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-center">Bitola</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-center">Status</th>
                                                                <th className="p-3 font-black border-b border-slate-100">Ação</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {[...completedLots].reverse().map(lot => {
                                                                const isWaiting = lot.finalWeight === null || lot.measuredGauge === null || lot.measuredGauge === undefined;
                                                                const waitingMs = isWaiting ? now.getTime() - new Date(lot.endTime).getTime() : 0;

                                                                return (
                                                                    <tr key={lot.lotId} className="hover:bg-slate-50/50 transition-colors">
                                                                        <td className="p-3 font-bold text-slate-700">{lot.lotInfo?.internalLot}</td>
                                                                        <td className="p-3 text-right text-slate-500 font-medium">{lot.lotInfo?.initialQuantity?.toFixed(0) || '-'} kg</td>
                                                                        <td className="p-3">
                                                                            {lot.finalWeight == null ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        className="w-3/4 p-2 border-2 border-slate-100 rounded-lg text-center focus:border-indigo-500 bg-slate-50 focus:bg-white transition font-bold"
                                                                                        placeholder="0.0"
                                                                                        value={pendingWeights?.get(lot.lotId) || ''}
                                                                                        onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                                    />
                                                                                    <span className="text-[10px] font-bold text-slate-400">kg</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-right font-black text-slate-900">{lot.finalWeight?.toFixed(1) || '-'} kg</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3">
                                                                            {lot.measuredGauge == null ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        className="w-3/4 p-2 border-2 border-slate-100 rounded-lg text-center focus:border-indigo-500 bg-slate-50 focus:bg-white transition"
                                                                                        placeholder="0.00"
                                                                                        value={pendingGauges?.get(lot.lotId) || ''}
                                                                                        onChange={e => handlePendingGaugeChange(lot.lotId, e.target.value)}
                                                                                    />
                                                                                    <span className="text-[10px] font-bold text-slate-400">mm</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center font-bold text-slate-700">{lot.measuredGauge?.toFixed(2) || '-'} mm</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            {isWaiting ? (
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="text-[9px] font-black text-amber-600 animate-pulse uppercase leading-none">Aguardando</span>
                                                                                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{formatDuration(waitingMs)}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Concluído</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3">
                                                                            {isWaiting ? (
                                                                                <button
                                                                                    onClick={() => handleRecordWeight(lot.lotId)}
                                                                                    disabled={!hasActiveShift && !isGestor}
                                                                                    className="bg-emerald-500 text-white text-[10px] font-black py-2 px-3 rounded-lg hover:bg-emerald-600 w-full shadow-lg shadow-emerald-100 transition active:scale-95 disabled:opacity-50"
                                                                                >
                                                                                    SALVAR
                                                                                </button>
                                                                            ) : (
                                                                                <div className="bg-slate-100 text-slate-400 p-1.5 rounded-lg w-fit mx-auto">
                                                                                    <CheckCircleIcon className="h-4 w-4" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card List */}
                                                    <div className="flex flex-col gap-3 sm:hidden">
                                                        {[...completedLots].reverse().map(lot => {
                                                            const isWaiting = lot.finalWeight == null || lot.measuredGauge == null;
                                                            const waitingMs = isWaiting ? timer.getTime() - new Date(lot.endTime).getTime() : 0;

                                                            return (
                                                                <div key={lot.lotId} className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden">
                                                                    {!isWaiting && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase">Concluído</div>}

                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <h4 className="font-black text-slate-800 text-xl">{lot.lotInfo?.internalLot}</h4>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Entrada: {lot.lotInfo?.initialQuantity?.toFixed(0) || '-'} kg</p>
                                                                        </div>
                                                                        {isWaiting && (
                                                                            <div className="text-right">
                                                                                <span className="text-[8px] font-black text-amber-500 uppercase block leading-none">Aguardando</span>
                                                                                <span className="text-xs font-mono font-bold text-slate-400">{formatDuration(waitingMs)}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Peso Saída (kg)</label>
                                                                            {lot.finalWeight == null ? (
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 outline-none transition uppercase"
                                                                                    placeholder="0.0"
                                                                                    value={pendingWeights?.get(lot.lotId) || ''}
                                                                                    onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                <div className="p-3 bg-slate-50 rounded-xl text-center font-black text-slate-800 text-lg">{lot.finalWeight?.toFixed(1) || '-'}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bitola (mm)</label>
                                                                            {lot.measuredGauge == null ? (
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 outline-none transition uppercase"
                                                                                    placeholder="0.00"
                                                                                    value={pendingGauges?.get(lot.lotId) || ''}
                                                                                    onChange={e => handlePendingGaugeChange(lot.lotId, e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                <div className="p-3 bg-slate-50 rounded-xl text-center font-black text-slate-800 text-lg">{lot.measuredGauge?.toFixed(2) || '-'}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {isWaiting && (
                                                                        <button
                                                                            onClick={() => handleRecordWeight(lot.lotId)}
                                                                            disabled={!hasActiveShift && !isGestor}
                                                                            className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-100 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                                                        >
                                                                            <CheckCircleIcon className="h-6 w-6" />
                                                                            SALVAR PESAGEM (OK)
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                                            <span>📦 Registro de Pacotes</span>
                                                            <span className="text-xs font-normal text-slate-400 font-sans">(200 pçs / pct)</span>
                                                        </h3>
                                                        <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                                            {trelicaPackages.filter(p => p.status === 'Concluído').length} de {trelicaPackages.length} concluídos
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                                                        ⚖️ Digite o peso do pacote e pressione Enter ou clique em Salvar
                                                    </span>
                                                </div>

                                                <div className="overflow-auto max-h-[520px] md:border border-slate-100 rounded-xl">
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
                                                            {(() => {
                                                                const nextPendingPkgNum = trelicaPackages.find(p => p.status !== 'Concluído')?.packageNumber;
                                                                return trelicaPackages.map(pkg => {
                                                                    const isNext = pkg.packageNumber === nextPendingPkgNum;
                                                                    return (
                                                                        <tr 
                                                                            key={pkg.packageNumber} 
                                                                            className={
                                                                                pkg.status === 'Concluído' 
                                                                                    ? 'bg-slate-50/50' 
                                                                                    : isNext 
                                                                                        ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' 
                                                                                        : 'bg-white'
                                                                            }
                                                                        >
                                                                            <td className="p-4 font-bold text-slate-700 text-lg">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>#{pkg.packageNumber}</span>
                                                                                    {isNext && (
                                                                                        <span className="text-[9px] font-black uppercase bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                                                            Próximo
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-4 text-slate-600 font-medium">{pkg.quantity} pçs</td>
                                                                            <td className="p-4">
                                                                                {pkg.status === 'Concluído' ? (
                                                                                    <span className="font-mono font-black text-slate-800 text-lg">{pkg.weight?.toFixed(2)} kg</span>
                                                                                ) : (
                                                                                    <div className="relative max-w-xs">
                                                                                        <input
                                                                                            type="text"
                                                                                            inputMode="decimal"
                                                                                            value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                            onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                            onKeyDown={e => {
                                                                                                if (e.key === 'Enter') {
                                                                                                    e.preventDefault();
                                                                                                    handleRecordPackageWeight(pkg.packageNumber, pkg.quantity);
                                                                                                }
                                                                                            }}
                                                                                            className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:border-indigo-500 focus:ring-0 transition"
                                                                                            placeholder="0.00"
                                                                                        />
                                                                                        <span className="absolute right-3 top-3.5 text-slate-400 text-sm font-bold">kg</span>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-4 text-center">
                                                                                {pkg.status === 'Concluído' ? (
                                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 uppercase tracking-wide">
                                                                                        ✓ OK
                                                                                    </span>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                                        className="bg-indigo-600 text-white text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-indigo-700 shadow-md transition w-full max-w-xs active:scale-95"
                                                                                    >
                                                                                        Salvar
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card View for Packages */}
                                                    <div className="flex flex-col gap-3 md:hidden pb-4">
                                                        {(() => {
                                                            const nextPendingPkgNum = trelicaPackages.find(p => p.status !== 'Concluído')?.packageNumber;
                                                            return trelicaPackages.map(pkg => {
                                                                const isNext = pkg.packageNumber === nextPendingPkgNum;
                                                                return (
                                                                    <div 
                                                                        key={pkg.packageNumber} 
                                                                        className={`p-3.5 rounded-2xl border-2 transition ${
                                                                            pkg.status === 'Concluído' 
                                                                                ? 'bg-slate-50/70 border-slate-100' 
                                                                                : isNext 
                                                                                    ? 'bg-white border-indigo-400 shadow-md ring-2 ring-indigo-100' 
                                                                                    : 'bg-white border-slate-200 shadow-sm'
                                                                        }`}
                                                                    >
                                                                        <div className="flex justify-between items-center mb-2.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`w-8 h-8 flex items-center justify-center rounded-xl font-bold text-sm ${
                                                                                    pkg.status === 'Concluído' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white shadow-sm'
                                                                                }`}>
                                                                                    #{pkg.packageNumber}
                                                                                </span>
                                                                                <span className="text-slate-500 font-medium text-xs">{pkg.quantity} peças</span>
                                                                                {isNext && (
                                                                                    <span className="text-[9px] font-black uppercase bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                                                        Próximo
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {pkg.status === 'Concluído' && (
                                                                                <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg text-xs uppercase tracking-wide">
                                                                                    <CheckCircleIcon className="h-4 w-4" /> Registrado
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {pkg.status === 'Concluído' ? (
                                                                            <div className="flex items-end justify-between pt-1 border-t border-slate-100">
                                                                                <span className="text-xs text-slate-400 uppercase font-bold">Peso Registrado</span>
                                                                                <span className="text-xl font-mono font-black text-slate-700">{pkg.weight?.toFixed(2)} <span className="text-xs">kg</span></span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex gap-2 items-end pt-1">
                                                                                <div className="flex-1 relative">
                                                                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Peso (kg)</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                        onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter') {
                                                                                                e.preventDefault();
                                                                                                handleRecordPackageWeight(pkg.packageNumber, pkg.quantity);
                                                                                            }
                                                                                        }}
                                                                                        className="w-full h-12 pl-3 pr-10 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:border-indigo-500 focus:ring-0 transition"
                                                                                        placeholder="0.00"
                                                                                    />
                                                                                    <span className="absolute right-3 top-7 text-slate-400 text-xs font-bold">kg</span>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                                    className="h-12 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition flex items-center justify-center gap-1.5"
                                                                                >
                                                                                    <CheckCircleIcon className="h-5 w-5" />
                                                                                    <span className="font-bold text-sm">Salvar</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                            </div>
                        </div>

                        {orderForShift && (
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

                                    {/* Centro: Controles Principais e Mobile Menu */}
                                    <div className="flex-1 md:flex-none flex items-center justify-center md:w-1/2">
                                        {!isAnyActiveShift ? (
                                            <button
                                                onClick={handleStartShift}
                                                className="w-full md:w-auto md:px-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl md:rounded-full font-black text-lg shadow-xl shadow-emerald-200 transition transform active:scale-90 flex items-center justify-center gap-3 animate-pulse"
                                            >
                                                <PlayIcon className="h-8 w-8" />
                                                <span className="inline tracking-tight">INICIAR TURNO</span>
                                            </button>
                                        ) : (
                                            <div className="w-full md:w-auto flex relative items-center gap-2">
                                                <button
                                                    onClick={isMachineStopped ? (() => { if (activeOrder && logResumeProduction) logResumeProduction(activeOrder.id); }) : (() => setShowDowntimeModal(true))}
                                                    className={`w-full h-24 md:h-20 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all duration-500 shadow-2xl relative overflow-hidden group border-[3px]
                                                        ${isMachineStopped 
                                                            ? 'bg-rose-600 shadow-rose-200 animate-stop-pulse border-rose-400 active:scale-95' 
                                                            : 'bg-emerald-600 shadow-emerald-200 animate-producing-pulse border-emerald-400 active:scale-95'
                                                        }`}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                    <div className="relative z-10 flex items-center gap-3">
                                                        {isMachineStopped ? (
                                                            <PlayIcon className="h-10 w-10 text-white animate-bounce-horizontal" />
                                                        ) : (
                                                            <PauseIcon className="h-10 w-10 text-white" />
                                                        )}
                                                        <span className="text-2xl font-black text-white uppercase tracking-tighter">
                                                            {isMachineStopped ? 'RETOMAR PRODUÇÃO' : 'PARAR MÁQUINA'}
                                                        </span>
                                                    </div>
                                                    <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 bg-black/20 rounded-full backdrop-blur-md border border-white/10">
                                                        <ClockIcon className="h-5 w-5 text-white/80" />
                                                        <span className="text-lg font-black text-white font-mono tracking-widest">
                                                            {statusDurationString}
                                                        </span>
                                                    </div>
                                                </button>

                                                {isMachineStopped && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowDowntimeModal(true)}
                                                        className="h-24 md:h-20 px-4 rounded-3xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs uppercase flex flex-col items-center justify-center gap-1.5 shadow-xl active:scale-95 transition border-2 border-amber-500/50 flex-shrink-0"
                                                        title="Abrir Menu Operacional (Troca de Rolo, etc.)"
                                                    >
                                                        <PauseIcon className="h-6 w-6 text-amber-400" />
                                                        <span className="text-[10px] font-black tracking-wider text-center leading-tight whitespace-nowrap">Menu de<br/>Paradas</span>
                                                    </button>
                                                )}
                                                
                                                {/* Botão Split (Seta) Menu para Mobile da Trefila */}
                                                <button
                                                    onClick={() => setShowMobileActions(!showMobileActions)}
                                                    className={`h-16 md:h-14 w-12 md:hidden border-4 border-l-0 flex items-center justify-center rounded-r-2xl transition-colors ${
                                                        isMachineStopped 
                                                            ? 'bg-rose-700 hover:bg-rose-600 border-rose-400 shadow-rose-500/40 text-rose-100'
                                                            : 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 shadow-emerald-500/40 text-emerald-100'
                                                    }`}
                                                >
                                                    <ChevronDownIcon className={`w-8 h-8 transition-transform ${showMobileActions ? 'rotate-180' : ''}`} />
                                                </button>

                                                {/* Dropdown Menu Mobile */}
                                                {showMobileActions && (
                                                    <div className="absolute bottom-full right-0 mb-3 bg-white p-2 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col min-w-[220px] border border-slate-100 divide-y divide-slate-100 animate-fade-in-up z-50">
                                                        <button
                                                            onClick={() => {
                                                                setShowMobileActions(false);
                                                                if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) handleTrefilaComplete();
                                                                else setShowCompletionModal(true);
                                                            }}
                                                            disabled={isCompletionDisabled}
                                                            className="p-3 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-3 transition disabled:opacity-30 rounded-t-xl"
                                                        >
                                                            <CheckCircleIcon className="h-6 w-6 text-slate-500" />
                                                            <span>Fechar OP</span>
                                                        </button>

                                                        {isMachineStopped && (
                                                            <button
                                                                onClick={() => {
                                                                    setShowMobileActions(false);
                                                                    setShowDowntimeModal(true);
                                                                }}
                                                                className="p-3 text-amber-600 hover:bg-amber-50/50 font-bold flex items-center gap-3 transition"
                                                            >
                                                                <PauseIcon className="h-6 w-6 text-amber-500" />
                                                                <span>Menu de Paradas</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => {
                                                                setShowMobileActions(false);
                                                                handleShiftEndRequest(orderForShift.id);
                                                            }}
                                                            className="p-3 text-amber-600 hover:bg-amber-50/50 font-bold flex items-center gap-3 transition"
                                                        >
                                                            <ClockIcon className="h-6 w-6 text-amber-500" />
                                                            <span>Encerrar Turno</span>
                                                        </button>

                                                        {isGestor && cancelProductionOrder && (
                                                            <button
                                                                onClick={() => {
                                                                    setShowMobileActions(false);
                                                                    setShowCancelConfirmation(true);
                                                                }}
                                                                className="p-3 text-rose-600 hover:bg-rose-50/50 font-bold flex items-center gap-3 transition rounded-b-xl"
                                                            >
                                                                <XCircleIcon className="h-6 w-6 text-rose-500" />
                                                                <span>Cancelar OP</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Direita: Ações Secundárias (Visível apenas no MD/Desktop) */}
                                    <div className="hidden md:flex items-center justify-end gap-1 sm:gap-4 w-auto md:w-1/4">
                                        <div className="h-8 w-px bg-slate-200/60 hidden md:block"></div>

                                        <button
                                            onClick={() => {
                                                if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) handleTrefilaComplete();
                                                else setShowCompletionModal(true);
                                            }}
                                            disabled={isCompletionDisabled}
                                            className="hidden md:flex bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 shadow-lg shadow-slate-200 transition items-center gap-2 disabled:opacity-30 disabled:grayscale active:scale-95"
                                        >
                                            <CheckCircleIcon className="h-5 w-5" />
                                            <span>FECHAR ORDEM</span>
                                        </button>

                                        {hasActiveShift && (
                                            <button
                                                onClick={() => handleShiftEndRequest(orderForShift.id)}
                                                className="p-3.5 text-red-500 hover:bg-red-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Finalizar Turno"
                                            >
                                                <ClockIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Encerrar</span>
                                            </button>
                                        )}

                                        {(!activeMachine.startsWith('Trefila') && !activeMachine.startsWith('Desbobinadeira')) && pauseProductionOrder && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Tem certeza que deseja arquivar/pausar esta ordem para iniciar outra? Seu turno atual será encerrado e a ordem voltará para a fila de pendentes.')) {
                                                        pauseProductionOrder(orderForShift.id);
                                                        setView('pending');
                                                    }
                                                }}
                                                className="p-3.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Arquivar Ordem / Trocar de Ordem"
                                            >
                                                <ArchiveIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Pausar OP</span>
                                            </button>
                                        )}

                                        {isGestor && cancelProductionOrder && (
                                            <button
                                                onClick={() => setShowCancelConfirmation(true)}
                                                className="p-3.5 text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Cancelar Ordem de Produção"
                                            >
                                                <XCircleIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase font-black">Cancelar</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        </>
                    ) : postProductionOrder ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
                            <div className={`lg:col-span-1 space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
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
                                                <p className="text-sm text-slate-500">{shiftStatus.shiftName}: {shiftStatus.shiftLabel}</p>
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
                            <div className={`lg:col-span-2 space-y-6 ${mobileTab !== 'work' ? 'hidden lg:block' : 'animate-fade-in'}`}>
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
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Data Criação</th>
                                            <th className="px-6 py-3">Nº Ordem</th>
                                            <th className="px-6 py-3">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'Bitola Saída' : 'Modelo'}</th>
                                            <th className="px-6 py-3 text-right">Peso Total (kg)</th>
                                            <th className="px-6 py-3 text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingOrders.map(order => (
                                            <tr key={order.id} className={`border-b hover:bg-slate-50 ${order.status === 'paused' ? 'bg-amber-50/30' : 'bg-white'}`}>
                                                <td className="px-6 py-4">
                                                    {order.status === 'paused' ? (
                                                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase border border-amber-200">Em Pausa</span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-0.5 rounded uppercase border border-slate-200">Fila</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">{new Date(order.creationDate).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {order.orderNumber}
                                                    {order.status === 'paused' && order.actualProducedQuantity && order.actualProducedQuantity > 0 ? (
                                                        <span className="block text-[10px] text-amber-600 mt-0.5 font-bold">Já produzido: {order.actualProducedQuantity}</span>
                                                    ) : null}
                                                </td>
                                                <td className="px-6 py-4">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? order.targetBitola : `${order.trelicaModel} (${order.quantityToProduce} pçs)`}</td>
                                                <td className="px-6 py-4 text-right">{order.totalWeight?.toFixed(2) || 0}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => {
                                                        if(startProductionOrder) startProductionOrder(order.id);
                                                        setView('in_progress');
                                                    }} className={`${order.status === 'paused' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 mx-auto`}>
                                                        <PlayIcon className="h-5 w-5" /> {order.status === 'paused' ? 'Retomar' : 'Iniciar'}
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
                                            <th className="px-6 py-3">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'Bitola Saída' : 'Modelo'}</th>
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
                                                <td className="px-6 py-4">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? order.targetBitola : `${order.trelicaModel} (${order.actualProducedQuantity} pçs)`}</td>
                                                <td className="px-6 py-4 text-right">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (order.totalWeight?.toFixed(2) || 0) : (order.plannedOutputWeight?.toFixed(2) || 'N/A')}</td>
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

            {showSpeedModal && (
                <MachineSpeedModal
                    initialSpeed={activeOrder?.targetSpeed}
                    onClose={() => {
                        setShowSpeedModal(false);
                        setSelectedLotForSpeed(null);
                    }}
                    onSubmit={confirmStartLot}
                />
            )}
        </div>
    );
};

export default MachineControl;