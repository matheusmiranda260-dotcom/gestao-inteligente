import React, { useState, useEffect, useMemo } from 'react';
import type { Page, ProductionOrderData, StockItem, User, OperatorLog, MachineType, ProcessedLot } from '../types';
import { 
    ArrowLeftIcon, WarningIcon, CogIcon, PauseIcon, ClockIcon, 
    CheckCircleIcon, ScaleIcon, PlayIcon, BookOpenIcon, StopIcon, 
    WrenchScrewdriverIcon, ArchiveIcon, UserGroupIcon, ChartBarIcon 
} from './icons';

// Custom Power Icon
const PowerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
    </svg>
);

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const statusStyles = {
    Produzindo: { 
        bg: 'bg-gradient-to-br from-[#00F2FE] to-[#4FACFE]', 
        glow: 'shadow-[0_0_20px_rgba(79,172,254,0.4)]',
        icon: <CogIcon className="h-8 w-8 text-white animate-spin-slow drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />, 
        title: 'EM OPERAÇÃO' 
    },
    Preparacao: { 
        bg: 'bg-gradient-to-br from-[#A8E063] to-[#56AB2F]', 
        glow: 'shadow-[0_0_20px_rgba(86,171,47,0.4)]',
        icon: <WrenchScrewdriverIcon className="h-8 w-8 text-white animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />, 
        title: 'PREPARAÇÃO' 
    },
    Parada: { 
        bg: 'bg-gradient-to-br from-[#FF0844] to-[#FFB199]', 
        glow: 'shadow-[0_0_20px_rgba(255,8,68,0.4)]',
        icon: <PauseIcon className="h-8 w-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />, 
        title: 'MAQUINA PARADA' 
    },
    Ocioso: { 
        bg: 'bg-gradient-to-br from-[#FAD961] to-[#F76B1C]', 
        glow: 'shadow-[0_0_20px_rgba(247,107,28,0.4)]',
        icon: <ClockIcon className="h-8 w-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />, 
        title: 'EQUIP. OCIOSO' 
    },
    Desligada: { 
        bg: 'bg-gradient-to-br from-[#1F2937] to-[#111827]', 
        glow: 'shadow-[0_0_25px_rgba(17,24,39,0.3)]',
        icon: <PowerIcon className="h-8 w-8 text-white" />, 
        title: 'DESLIGADA' 
    },
};

interface MachineStatusViewProps {
    machineType: MachineType;
    activeOrder: ProductionOrderData | undefined;
    allOrders: ProductionOrderData[];
    stock: StockItem[];
    dailyProducedValue: number;
    dailyGoal: number;
    goalUnit: string;
    onResetShift?: () => void;
    isGestor?: boolean;
}

const MachineStatusView: React.FC<MachineStatusViewProps> = ({ machineType, activeOrder, allOrders, stock, dailyProducedValue, dailyGoal, goalUnit, onResetShift, isGestor }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const h = now.getHours();
    const isShiftA = h >= 5 && h < 14;
    const shiftStart = new Date(now);
    shiftStart.setHours(isShiftA ? 5 : 14, 0, 0, 0);
    if (!isShiftA && h < 5) shiftStart.setDate(shiftStart.getDate() - 1);
    const shiftStartMs = shiftStart.getTime();

    const currentOperatorLog = useMemo(() => {
        if (!activeOrder?.operatorLogs || activeOrder.operatorLogs.length === 0) return null;
        const logs = activeOrder.operatorLogs as OperatorLog[];
        const sorted = [...logs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const lastLog = sorted[sorted.length - 1];
        return lastLog.endTime ? null : lastLog;
    }, [activeOrder]);

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem ativa', durationMs: 0 };
        }
        const events = (activeOrder.downtimeEvents || []) as any[];
        const openEvent = [...events]
            .sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime())
            .find(e => !e.resumeTime);

        if (openEvent) {
            const reason = openEvent.reason || 'Parada';
            const dur = now.getTime() - new Date(openEvent.stopTime).getTime();
            if (reason.includes('Preparação') || reason.includes('Setup')) return { status: 'Preparacao', reason, durationMs: dur };
            if (reason.includes('Turno') || !currentOperatorLog) return { status: 'Desligada', reason, durationMs: dur };
            return { status: 'Parada', reason, durationMs: dur };
        }
        
        const resumes = (activeOrder.downtimeEvents || []).filter((e: any) => e.resumeTime).map((e: any) => new Date(e.resumeTime!).getTime());
        const lastResume = resumes.length ? Math.max(...resumes) : new Date(activeOrder.startTime).getTime();
        return { status: 'Produzindo', reason: '', durationMs: now.getTime() - Math.max(lastResume, shiftStartMs) };
    }, [activeOrder, now, currentOperatorLog, shiftStartMs]);

    const currentStyle = statusStyles[machineStatus.status as keyof typeof statusStyles] || statusStyles.Ocioso;
    const currentOperator = currentOperatorLog?.operator || 'Nenhum';

    const { processedLotsCount, totalLotsCount, producedQuantity, plannedQuantity, progress } = useMemo(() => {
        let pc = 0, tc = 0, pq = 0, pl = 1, pg = 0;
        if (activeOrder) {
            if (activeOrder.machine === 'Trefila' || machineType === 'Trefila') {
                pc = (activeOrder.processedLots || []).length;
                tc = Array.isArray(activeOrder.selectedLotIds) ? activeOrder.selectedLotIds.length : 0;
                pg = tc > 0 ? (pc / tc) * 100 : 0;
            } else {
                pq = activeOrder.actualProducedQuantity || 0;
                pl = activeOrder.quantityToProduce || 1;
                pg = (pq / pl) * 100;
            }
        }
        return { processedLotsCount: pc, totalLotsCount: tc, producedQuantity: pq, plannedQuantity: pl, progress: Math.min(100, pg) };
    }, [activeOrder, machineType]);

    const { shiftDowntime, shiftUptime } = useMemo(() => {
        let dt = 0;
        allOrders.filter(o => o.machine === machineType).forEach(o => {
            (o.downtimeEvents || []).forEach((e: any) => {
                const s = Math.max(shiftStartMs, new Date(e.stopTime).getTime());
                const r = Math.min(now.getTime(), e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime());
                if (r > s) dt += (r - s);
            });
        });
        const total = Math.max(0, now.getTime() - shiftStartMs);
        return { shiftDowntime: dt, shiftUptime: Math.max(0, total - dt) };
    }, [allOrders, machineType, shiftStartMs, now]);

    return (
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden relative min-h-[600px] h-full">
            <header className={`${currentStyle.bg} p-6 flex flex-col sm:flex-row justify-between items-center ${currentStyle.glow} border-b border-white/10 z-10 gap-4`}>
                <div className="flex items-center gap-5">
                    <div className="bg-black/30 backdrop-blur-xl p-5 rounded-3xl border border-white/20">{currentStyle.icon}</div>
                    <div>
                        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase leading-none">{machineType}</h2>
                        <p className="text-xs font-black text-white/80 uppercase mt-2 tracking-widest">{currentStyle.title} {machineStatus.reason && `• ${machineStatus.reason}`}</p>
                    </div>
                </div>
                <div className="bg-black/20 backdrop-blur-md px-8 py-4 rounded-[2.5rem] border border-white/10 flex flex-col items-center">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Tempo no Estado</span>
                    <span className="text-4xl lg:text-5xl font-black font-mono text-white tracking-wider">{formatDuration(machineStatus.durationMs)}</span>
                </div>
            </header>

            <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                <div className="flex flex-col gap-6">
                    {/* Meta Acumulada */}
                    <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 flex flex-col justify-center relative overflow-hidden group shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Produção do Turno</h3>
                            <div className="bg-indigo-50 text-indigo-600 text-[11px] font-black px-4 py-1.5 rounded-2xl border border-indigo-100">
                                {dailyGoal > 0 ? ((dailyProducedValue / dailyGoal) * 100).toFixed(0) : 0}% Alvo
                            </div>
                        </div>
                        <div className="flex items-baseline gap-4 mb-4">
                            <span className="text-7xl font-black text-slate-900 tracking-tighter leading-none">{dailyProducedValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            <span className="text-xl font-black text-slate-400 uppercase">{goalUnit}</span>
                        </div>
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden p-1">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.3)]" style={{ width: `${Math.min(100, (dailyProducedValue / dailyGoal) * 100)}%` }} />
                        </div>
                    </div>

                    {/* Ordem Ativa */}
                    <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 flex flex-col justify-center relative overflow-hidden shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Progresso da OP #{activeOrder?.orderNumber || '---'}</h3>
                            {isGestor && onResetShift && (
                                <button onClick={onResetShift} className="text-[10px] font-black bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 px-4 py-2 rounded-2xl border border-slate-200 uppercase transition-all shadow-sm">Zerar Turno</button>
                            )}
                        </div>
                        <div className="flex items-baseline gap-4 mb-4">
                            <span className="text-7xl font-black text-slate-900 tracking-tighter leading-none">{machineType === 'Trefila' ? processedLotsCount : producedQuantity}</span>
                            <span className="text-xl font-black text-slate-400 uppercase">{machineType === 'Trefila' ? 'Lotes' : 'Peças'}</span>
                        </div>
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden p-1">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibilidade: {(shiftUptime / (shiftUptime + shiftDowntime) * 100 || 0).toFixed(0)}%</p>
                    </div>
                </div>

                <div className="flex flex-col gap-6 overflow-hidden">
                    {/* Lista de Paradas */}
                    <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col flex-1 overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px] flex items-center gap-2"><WarningIcon className="h-4 w-4 text-rose-500" /> Histórico de Paradas</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-100 z-20">
                                    <tr className="text-[9px] uppercase font-black text-slate-500 border-b border-slate-200">
                                        <th className="p-4 px-6">Duração</th>
                                        <th className="p-4">Motivo</th>
                                        <th className="p-4 text-right px-6">OP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allOrders
                                        .filter(o => o.machine === machineType)
                                        .flatMap(o => (o.downtimeEvents || []).map((e: any) => ({ ...e, orderNumber: o.orderNumber })))
                                        .filter(e => new Date(e.stopTime).getTime() >= shiftStartMs)
                                        .sort((a,b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
                                        .map((e, i) => {
                                            const end = e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime();
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 px-6 font-mono text-rose-600 font-black text-[11px]">{formatDuration(end - new Date(e.stopTime).getTime())}</td>
                                                    <td className="p-4 text-[10px] font-black text-slate-700 uppercase truncate max-w-[150px]">{e.reason}</td>
                                                    <td className="p-4 text-right px-6 text-[10px] font-bold text-slate-400">#{e.orderNumber}</td>
                                                </tr>
                                            );
                                        })}
                                    {allOrders.filter(o => o.machine === machineType).flatMap(o => o.downtimeEvents || []).filter(e => new Date(e.stopTime).getTime() >= shiftStartMs).length === 0 && (
                                        <tr><td colSpan={3} className="p-8 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">Nenhuma parada registrada</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Operador / Material */}
                    <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 flex flex-col justify-between gap-6 shadow-sm">
                        <div className="flex items-center gap-6">
                            <div className="bg-indigo-100 p-4 rounded-3xl border border-indigo-200"><UserGroupIcon className="h-6 w-6 text-indigo-600" /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operador Responsável</p>
                                <p className="text-xl font-black text-slate-900 uppercase">{currentOperator}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="bg-emerald-100 p-4 rounded-3xl border border-emerald-200"><ArchiveIcon className="h-6 w-6 text-emerald-600" /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Material Processado</p>
                                <p className="text-xl font-black text-slate-900 uppercase truncate max-w-[200px]">
                                    {machineType === 'Trefila' ? `Bitola: ${activeOrder?.targetBitola || '---'}` : `Modelo: ${activeOrder?.trelicaModel || '---'}`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

interface ProductionDashboardProps {
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
    currentUser: User | null;
}

const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ setPage, productionOrders, stock, currentUser }) => {
    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const [shiftResets, setShiftResets] = useState(() => JSON.parse(localStorage.getItem('shiftResets') || '{}'));

    const handleReset = (m: MachineType) => {
        if (!confirm(`Deseja zerar os dados de turno para a máquina ${m}? Esta ação só afeta a visualização deste dashboard.`)) return;
        const newResets = { ...shiftResets, [m]: new Date().toISOString() };
        setShiftResets(newResets);
        localStorage.setItem('shiftResets', JSON.stringify(newResets));
    };

    const getDailyValue = (m: MachineType) => {
        const now = new Date();
        const h = now.getHours();
        const start = new Date(now);
        start.setHours(h >= 5 && h < 14 ? 5 : 14, 0, 0, 0);
        if (h < 5) start.setDate(start.getDate() - 1);
        
        const resetT = shiftResets[m] ? new Date(shiftResets[m]).getTime() : 0;
        const effective = Math.max(start.getTime(), resetT);

        return productionOrders.filter(o => o.machine === m && o.status !== 'cancelled').reduce((acc, o) => {
            if (m === 'Trefila') {
                const lots = (o.processedLots || []) as ProcessedLot[];
                return acc + lots.filter(l => l.endTime && new Date(l.endTime).getTime() >= effective).reduce((s, l) => s + (l.finalWeight || 0), 0);
            }
            // Treliça
            const logs = (o.operatorLogs || []) as OperatorLog[];
            return acc + logs.reduce((s, log) => {
                if (new Date(log.startTime).getTime() < effective) return s;
                const endQty = log.endQuantity !== undefined && log.endQuantity !== null ? log.endQuantity : (o.status === 'completed' ? (o.actualProducedQuantity || 0) : (o.actualProducedQuantity || 0));
                return s + Math.max(0, endQty - (log.startQuantity || 0));
            }, 0);
        }, 0);
    };

    const activeTrefila = productionOrders.find(o => o.machine === 'Trefila' && o.status === 'in_progress');
    const activeTrelica = productionOrders.find(o => o.machine === 'Treliça' && o.status === 'in_progress');

    return (
        <div className="min-h-screen bg-white text-slate-900 p-4 lg:p-8 flex flex-col gap-8 font-sans">
            <header className="flex justify-center items-center">
                <div className="text-center">
                    <h1 className="text-3xl font-black tracking-[0.2em] uppercase bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Command Center</h1>
                    <p className="text-[10px] font-black text-indigo-500/80 uppercase tracking-[0.4em] mt-2">Live Factory Monitoring System v2.6</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12 pb-8">
                <MachineStatusView 
                    machineType="Trefila" 
                    activeOrder={activeTrefila} 
                    allOrders={productionOrders} 
                    stock={stock} 
                    dailyProducedValue={getDailyValue('Trefila')} 
                    dailyGoal={6000} 
                    goalUnit="kg" 
                    isGestor={isGestor} 
                    onResetShift={() => handleReset('Trefila')} 
                />
                <MachineStatusView 
                    machineType="Treliça" 
                    activeOrder={activeTrelica} 
                    allOrders={productionOrders} 
                    stock={stock} 
                    dailyProducedValue={getDailyValue('Treliça')} 
                    dailyGoal={4500} 
                    goalUnit="pçs" 
                    isGestor={isGestor} 
                    onResetShift={() => handleReset('Treliça')} 
                />
            </div>
            
            <footer className="flex justify-center pb-4">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">DADOS ATUALIZADOS EM TEMPO REAL VIA SUPABASE</p>
            </footer>
        </div>
    );
};

export default ProductionDashboard;