import React, { useState, useEffect, useMemo } from 'react';
import type { Page, ProductionOrderData, StockItem, User, OperatorLog, MachineType, ProcessedLot, DowntimeConfig } from '../types';
import { DOWNTIME_THRESHOLDS } from '../types';
import { 
    ArrowLeftIcon, WarningIcon, CogIcon, PauseIcon, ClockIcon, 
    CheckCircleIcon, ScaleIcon, PlayIcon, BookOpenIcon, StopIcon, 
    WrenchScrewdriverIcon, ArchiveIcon, UserGroupIcon, ChartBarIcon 
} from './icons';
import { fetchTable, insertItem, updateItem, deleteItem } from '../services/supabaseService';
import { trelicaModels } from './ProductionOrderTrelica';

// Custom Power Icon
const PowerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
    </svg>
);

const TrendLine = ({ color }: { color: string }) => (
    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 400 100" className="w-full h-full preserve-3d">
            <path 
                d="M0,80 Q50,70 100,75 T200,60 T300,65 T400,40 L400,100 L0,100 Z" 
                fill={`url(#gradient-${color})`} 
                className="animate-pulse"
            />
            <defs>
                <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} />
                    <stop offset="100%" stopColor="transparent" />
                </linearGradient>
            </defs>
        </svg>
    </div>
);

const MiniChart = ({ color }: { color: string }) => (
    <div className="flex items-end gap-1 h-24 mb-6">
        {[40, 60, 45, 80, 55, 90, 70, 85].map((h, i) => (
            <div 
                key={i} 
                className="flex-1 rounded-t-sm transition-all duration-1000" 
                style={{ 
                    height: `${h}%`, 
                    background: `linear-gradient(to top, ${color}22, ${color})`,
                    boxShadow: `0 0 10px ${color}44`
                }} 
            />
        ))}
    </div>
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
        bg: 'bg-indigo-500/10', 
        glow: 'neon-glow-cyan',
        color: 'text-[#00E5FF]',
        border: 'border-[#00E5FF]/30',
        icon: <CogIcon className="h-6 w-6 text-[#00E5FF] animate-spin-slow" />, 
        title: 'EM OPERAÇÃO' 
    },
    Preparacao: { 
        bg: 'bg-emerald-500/10', 
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
        color: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: <WrenchScrewdriverIcon className="h-6 w-6 text-emerald-400 animate-pulse" />, 
        title: 'PREPARAÇÃO' 
    },
    Parada: { 
        bg: 'bg-rose-500/10', 
        glow: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]',
        color: 'text-rose-400',
        border: 'border-rose-500/30',
        icon: <PauseIcon className="h-6 w-6 text-rose-400" />, 
        title: 'MÁQUINA PARADA' 
    },
    Ocioso: { 
        bg: 'bg-amber-500/10', 
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]',
        color: 'text-amber-400',
        border: 'border-amber-500/30',
        icon: <ClockIcon className="h-6 w-6 text-amber-400" />, 
        title: 'EQUIP. OCIOSO' 
    },
    Desligada: { 
        bg: 'bg-slate-800/50', 
        glow: 'shadow-none',
        color: 'text-slate-400',
        border: 'border-slate-700',
        icon: <PowerIcon className="h-6 w-6 text-slate-400" />, 
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
    downtimeConfigs: DowntimeConfig[];
}

const MachineStatusView: React.FC<MachineStatusViewProps> = ({ machineType, activeOrder, allOrders, stock, dailyProducedValue, dailyGoal, goalUnit, onResetShift, isGestor, downtimeConfigs }) => {
    const [drift, setDrift] = useState(0);
    const [now, setNow] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'stops' | 'production'>('stops');

    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

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

    // Sincroniza o relógio local com os eventos do banco (evita delay de fuso/drift)
    // Se a diferença for de exatamente ~3 horas, ignoramos, pois é erro de fuso horário, não drift de relógio
    useEffect(() => {
        if (!activeOrder) return;
        
        const timestamps = [
            activeOrder.startTime,
            activeOrder.lastQuantityUpdate,
            ...(activeOrder.downtimeEvents || []).map(e => e.stopTime),
            ...(activeOrder.downtimeEvents || []).map(e => e.resumeTime),
            activeOrder.activeLotProcessing?.startTime
        ].filter(Boolean) as string[];

        let maxDrift = drift;
        const nowMs = Date.now();

        timestamps.forEach(ts => {
            const serverMs = new Date(ts).getTime();
            const diff = serverMs - nowMs;
            
            // Se o evento está no futuro, mas NÃO é uma diferença de fuso horário (ex: 3h, 2h)
            // Consideramos drift real apenas se for uma diferença pequena (menos de 1 hora)
            if (diff > maxDrift && diff < 3600000) { 
                maxDrift = diff + 1000;
            }
        });

        if (maxDrift !== drift) {
            setDrift(maxDrift);
        }
    }, [activeOrder, drift]);

    const syncedNow = useMemo(() => new Date(now.getTime() + drift), [now, drift]);

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
        
        const parseDate = (d: any) => d ? new Date(d).getTime() : 0;
        const nowMs = syncedNow.getTime();

        const events = (activeOrder.downtimeEvents || []) as any[];
        const openEvent = [...events]
            .sort((a, b) => parseDate(b.stopTime) - parseDate(a.stopTime))
            .find(e => !e.resumeTime);

        if (openEvent) {
            const reason = openEvent.reason || 'Parada';
            const stopMs = parseDate(openEvent.stopTime);
            const dur = stopMs > 0 ? Math.max(0, nowMs - stopMs) : 0;
            
            const isPrep = reason.includes('Preparação') || 
                           reason.includes('Setup') || 
                           reason.includes('Aguardando') || 
                           reason.includes('Ajuste');

            if (isPrep) return { status: 'Preparacao', reason, durationMs: dur };
            
            if (reason.includes('Turno') || reason.includes('Final de Turno')) {
                return { status: 'Desligada', reason, durationMs: dur };
            }
            
            return { status: 'Parada', reason, durationMs: dur };
        }
        
        const trefilaNotProducing = machineType.startsWith('Trefila') && (!activeOrder.activeLotProcessing || !activeOrder.activeLotProcessing.lotId);
        
        const resumes = (activeOrder.downtimeEvents || [])
            .filter((e: any) => e.resumeTime)
            .map((e: any) => parseDate(e.resumeTime));
            
        const lastResume = resumes.length ? Math.max(...resumes) : parseDate(activeOrder.startTime);
        const refTime = Math.max(lastResume, shiftStartMs);
        const duration = refTime > 0 ? Math.max(0, nowMs - refTime) : 0;

        if (trefilaNotProducing) {
            return { status: 'Preparacao', reason: 'Aguardando Início de Lote', durationMs: duration };
        }

        if (!currentOperatorLog) {
            return { status: 'Ocioso', reason: 'Aguardando Operador', durationMs: duration };
        }

        return { status: 'Produzindo', reason: '', durationMs: duration };
    }, [activeOrder, syncedNow, currentOperatorLog, shiftStartMs, machineType]);

    let currentStyle = statusStyles[machineStatus.status as keyof typeof statusStyles] || statusStyles.Ocioso;
    
    // Check if stopped and over limit to adjust styles dynamically
    const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normReasonForStyle = normalize(machineStatus.reason);
    
    // Normaliza o tipo da máquina para bater com a categoria (Trefila 1 -> Trefila)
    const machineCategory = machineType.toLowerCase().includes('trefila') ? 'trefila' : 
                            machineType.toLowerCase().includes('trelica') ? 'trelica' : 
                            machineType.toLowerCase().trim();

    const matchingConfigForStyle = (downtimeConfigs || []).find(c => {
        const normConfigReason = normalize(c.reason);
        const configCategory = normalize(c.machineType);
        return normReasonForStyle === normConfigReason && 
               (configCategory === 'geral' || configCategory === machineCategory);
    });

    const thresholdMinutesForStyle = matchingConfigForStyle ? matchingConfigForStyle.thresholdMinutes : (DOWNTIME_THRESHOLDS[machineStatus.reason] || 15);
    const limitMsForStyle = thresholdMinutesForStyle * 60 * 1000;
    const isOverLimitForStyle = machineStatus.durationMs > limitMsForStyle;

    if (machineStatus.status === 'Parada' || machineStatus.status === 'Preparacao') {
        if (!isOverLimitForStyle && thresholdMinutesForStyle) {
            // Within limit: Yellow/Amber
            currentStyle = {
                ...statusStyles.Parada,
                bg: 'bg-amber-500/10',
                glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]',
                color: 'text-amber-400',
                border: 'border-amber-500/30'
            };
        } else if (isOverLimitForStyle) {
            // Over limit: Intense Red
            currentStyle = {
                ...statusStyles.Parada,
                bg: 'bg-rose-600/20',
                glow: 'shadow-[0_0_30px_rgba(225,29,72,0.4)]',
                color: 'text-rose-500',
                border: 'border-rose-600'
            };
        }
    }

    const currentOperator = currentOperatorLog?.operator || '---';

    const { processedLotsCount, totalLotsCount, producedQuantity, plannedQuantity, progress } = useMemo(() => {
        let pc = 0, tc = 0, pq = 0, pl = 1, pg = 0;
        if (activeOrder) {
            if (activeOrder.machine.startsWith('Trefila') || machineType.startsWith('Trefila')) {
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

    const lastResumeTime = useMemo(() => {
        if (!activeOrder) return 0;
        const resumes = (activeOrder.downtimeEvents || []).filter((e: any) => e.resumeTime).map((e: any) => new Date(e.resumeTime!).getTime());
        return resumes.length ? Math.max(...resumes) : new Date(activeOrder.startTime).getTime();
    }, [activeOrder]);

    const isCurrentlyProducing = machineStatus.status === 'Produzindo' || machineStatus.status === 'Preparacao';

    const { shiftDowntime, shiftUptime } = useMemo(() => {
        const intervals: { start: number; end: number }[] = [];
        allOrders
            .filter(o => o.machine === machineType)
            .forEach(o => {
                const isActive = activeOrder && o.id === activeOrder.id;
                (o.downtimeEvents || []).forEach((e: any) => {
                    // Only count open events if this is the ACTIVE order.
                    if (!e.resumeTime && !isActive) return;

                    const s = Math.max(shiftStartMs, new Date(e.stopTime).getTime());
                    
                    // SAFEGUARD: If the machine is producing, an open event cannot be ticking past the last resume.
                    let endTime = e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime();
                    if (!e.resumeTime && isCurrentlyProducing) {
                        endTime = Math.min(endTime, lastResumeTime);
                    }

                    const r = Math.min(now.getTime(), endTime);
                    if (r > s) {
                        intervals.push({ start: s, end: r });
                    }
                });
            });

        if (intervals.length === 0) {
            const total = Math.max(0, now.getTime() - shiftStartMs);
            return { shiftDowntime: 0, shiftUptime: total };
        }

        intervals.sort((a, b) => a.start - b.start);

        const merged: { start: number; end: number }[] = [intervals[0]];
        for (let i = 1; i < intervals.length; i++) {
            const last = merged[merged.length - 1];
            const current = intervals[i];
            if (current.start <= last.end) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push(current);
            }
        }

        const totalDowntime = merged.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
        const totalTime = Math.max(0, now.getTime() - shiftStartMs);
        
        return { 
            shiftDowntime: totalDowntime, 
            shiftUptime: Math.max(0, totalTime - totalDowntime) 
        };
    }, [allOrders, machineType, shiftStartMs, now, activeOrder, isCurrentlyProducing, lastResumeTime]);

    const productionHistoryInShift = useMemo(() => {
        const orders = allOrders.filter(o => {
            const isExact = o.machine === machineType;
            const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && machineType === 'Trefila 1');
            const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && machineType === 'Treliça 1');
            return isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1;
        });
        
        if (machineType.startsWith('Trefila')) {
            return orders.flatMap(o => (o.processedLots || []).map((l: ProcessedLot) => ({
                id: l.lotId,
                label: stock.find(s => s.id === l.lotId)?.internalLot || l.lotId,
                weight: l.finalWeight,
                startTime: l.startTime,
                endTime: l.endTime,
                orderNumber: o.orderNumber
            })))
            .filter(l => l.endTime && new Date(l.endTime).getTime() >= shiftStartMs)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
        } else {
            return orders.flatMap(o => (o.weighedPackages || []).map((p: any) => ({
                id: p.id || p.packageNumber,
                label: `Pacote ${p.packageNumber}`,
                weight: p.weight,
                startTime: p.timestamp, 
                endTime: p.timestamp,
                orderNumber: o.orderNumber,
                qty: p.quantity
            })))
            .filter(p => new Date(p.endTime).getTime() >= shiftStartMs)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
        }
    }, [allOrders, machineType, shiftStartMs, stock]);

    const efficiency = dailyGoal > 0 ? (dailyProducedValue / dailyGoal) * 100 : 0;
    const lastReportTime = useMemo(() => {
        if (machineType.startsWith('Trefila')) {
           if (productionHistoryInShift.length > 0) return productionHistoryInShift[0].endTime;
           return activeOrder?.startTime;
        } else {
           return activeOrder?.lastQuantityUpdate || activeOrder?.startTime;
        }
    }, [machineType, productionHistoryInShift, activeOrder]);

    const isStopped = machineStatus.status === 'Parada' || machineStatus.status === 'Preparacao';
    const isProducingLot = machineStatus.status === 'Produzindo' && (
        (machineType.startsWith('Trefila') && activeOrder?.activeLotProcessing) ||
        (machineType.startsWith('Treliça'))
    );
    const activeLotInfo = (isProducingLot && machineType.startsWith('Trefila')) ? stock.find(s => s.id === activeOrder?.activeLotProcessing?.lotId) : null;

    const trefilaEstimation = useMemo(() => {
        if (!machineType.startsWith('Trefila') || !activeOrder?.activeLotProcessing?.speed || !activeOrder.targetBitola || !activeLotInfo) {
            return { remainingSeconds: null, isDelayed: false, elapsedUptimeSeconds: 0 };
        }

        const lotStartTime = new Date(activeOrder.activeLotProcessing.startTime).getTime();
        const bitola = parseFloat(activeOrder.targetBitola.replace(',', '.'));
        const speed = activeOrder.activeLotProcessing.speed;
        const linearMass = bitola * bitola * 0.006162;
        const massPerSecond = speed * linearMass;
        const initialWeight = activeLotInfo.initialQuantity || 0;

        if (massPerSecond <= 0) return { remainingSeconds: null, isDelayed: false, elapsedUptimeSeconds: 0 };

        const totalDurationSeconds = initialWeight / massPerSecond;

        // Calculate downtime specifically for this lot
        const lotDowntimeMs = (activeOrder.downtimeEvents || []).reduce((acc, e: any) => {
            const stop = new Date(e.stopTime).getTime();
            if (stop < lotStartTime) {
                if (!e.resumeTime) return acc; // Open event started before lot? Rare but handleable
                const resume = new Date(e.resumeTime).getTime();
                if (resume <= lotStartTime) return acc;
                // Stopped before lot, resumed after lot start
                return acc + (resume - lotStartTime);
            }
            // Stopped after lot start
            const resume = e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime();
            return acc + (resume - stop);
        }, 0);

        const totalElapsedMs = now.getTime() - lotStartTime;
        const elapsedUptimeMs = Math.max(0, totalElapsedMs - lotDowntimeMs);
        const elapsedUptimeSeconds = elapsedUptimeMs / 1000;

        const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedUptimeSeconds);
        const isDelayed = elapsedUptimeSeconds > totalDurationSeconds;

        // Calcula a hora estimada de término (Hora atual + Segundos restantes)
        const finishTime = new Date(now.getTime() + (remainingSeconds * 1000));

        return { 
            remainingSeconds, 
            isDelayed, 
            elapsedUptimeSeconds,
            lotDowntimeMs,
            estimatedFinishTime: finishTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    }, [machineType, activeOrder, activeLotInfo, now]);

    // Busca detalhes técnicos do modelo de treliça caso não existam na ordem
    const trelicaDetails = useMemo(() => {
        if (!machineType.startsWith('Treliça') || !activeOrder?.trelicaModel) return null;
        
        // Tenta encontrar o modelo exato na lista de trelicaModels
        const model = trelicaModels.find(m => 
            activeOrder.trelicaModel?.toUpperCase().trim().includes(m.modelo.toUpperCase()) &&
            (activeOrder.tamanho ? activeOrder.tamanho.toString() === m.tamanho : true)
        );

        return {
            superior: activeOrder.trelicaSuperior || model?.superior || '-',
            inferior: activeOrder.trelicaInferior || model?.inferior || '-',
            sinusoide: activeOrder.trelicaSinusoide || model?.senozoide || '-'
        };
    }, [machineType, activeOrder]);

    return (
        <div className={`tactical-card rounded-[2.5rem] border ${isStopped ? (isOverLimitForStyle ? 'animate-stop-pulse border-rose-500' : 'animate-warning-pulse border-amber-500') : isProducingLot ? (trefilaEstimation.isDelayed ? 'border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.2)]' : 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]') : 'border-white/10'} flex flex-col overflow-hidden relative group transition-all duration-700 h-full`}>
            {isStopped && (
                <div className={`absolute inset-0 pointer-events-none opacity-20 ${isOverLimitForStyle ? 'bg-rose-500 animate-stop-flash' : 'bg-amber-500 animate-warning-flash'}`} />
            )}
            
            {/* Machine Header */}
            <div className={`p-5 flex items-center justify-between border-b border-white/5 bg-gradient-to-r ${currentStyle.bg} to-transparent`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl bg-black/40 border ${currentStyle.border} ${currentStyle.glow}`}>
                        {currentStyle.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-black text-white tracking-tight leading-none">{machineType.toUpperCase()}</h2>
                             {activeOrder && activeOrder.machine !== machineType && (
                                <span className="bg-red-500/20 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-500/30 font-mono">ID: {activeOrder.machine}</span>
                             )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/40 border border-white/10 ${currentStyle.color}`}>
                                {currentOperator}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                • {machineType.startsWith('Trefila') 
                                    ? (activeOrder?.targetBitola || '---') 
                                    : (activeOrder?.trelicaModel ? `${activeOrder.trelicaModel} ${activeOrder.tamanho ? `(${activeOrder.tamanho}m)` : ''}` : '---')
                                }
                            </span>
                            {trelicaDetails && (
                                <div className="flex gap-2 ml-1">
                                    <span className="text-[8px] font-black text-slate-600 bg-white/5 px-1.5 py-0.5 rounded uppercase">S: {trelicaDetails.superior}</span>
                                    <span className="text-[8px] font-black text-slate-600 bg-white/5 px-1.5 py-0.5 rounded uppercase">I: {trelicaDetails.inferior}</span>
                                    <span className="text-[8px] font-black text-slate-600 bg-white/5 px-1.5 py-0.5 rounded uppercase">Z: {trelicaDetails.sinusoide}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`text-sm font-black uppercase tracking-widest ${currentStyle.color} ${isStopped ? (isOverLimitForStyle ? 'animate-pulse neon-text-red' : 'animate-pulse text-amber-500') : isProducingLot ? 'animate-pulse neon-text-green' : ''}`}>
                        {isOverLimitForStyle ? 'LIMITE EXCEDIDO' : currentStyle.title}
                    </p>
                    {isStopped && (
                        <div className={`mt-2 px-3 py-1 border rounded-md animate-pulse ${isOverLimitForStyle ? 'bg-rose-500/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'}`}>
                            <p className={`text-[9px] font-black uppercase tracking-tighter ${isOverLimitForStyle ? 'text-rose-400' : 'text-amber-500'}`}>
                                MOTIVO: {machineStatus.reason} 
                                {thresholdMinutesForStyle && ` • ${formatDuration(machineStatus.durationMs)} / ${thresholdMinutesForStyle}m`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <main className="p-6 relative min-h-[500px] flex flex-col">
                {/* Massive Producing Lot Overlay */}
                {isProducingLot && !isHistoryExpanded && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 pointer-events-none select-none">
                        <div className={`w-full backdrop-blur-xl border-y-4 py-12 flex flex-col items-center justify-center transition-all duration-500 ${trefilaEstimation.isDelayed ? 'bg-rose-950/60 border-rose-500 shadow-[0_0_100px_rgba(244,63,94,0.6)]' : 'bg-emerald-950/45 border-emerald-500 shadow-[0_0_100px_rgba(16,185,129,0.4)]'}`}>
                            <span className={`text-sm font-black uppercase tracking-[0.8em] mb-6 ${trefilaEstimation.isDelayed ? 'text-rose-400 neon-text-red animate-pulse' : 'text-emerald-400 neon-text-green'}`}>
                                {trefilaEstimation.isDelayed ? '⚠ LOTE ATRASADO' : (machineType.startsWith('Trefila') ? 'LOTE EM PROCESSO' : 'MÁQUINA EM OPERAÇÃO')}
                            </span>
                            <div className="flex flex-col items-center gap-2">
                                <h3 className="text-4xl md:text-7xl font-black text-white text-center uppercase tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] leading-tight px-4 break-words max-w-full italic">
                                    {machineType.startsWith('Trefila') 
                                        ? `${activeLotInfo?.internalLot || '---'} ${activeLotInfo?.initialQuantity ? `• ${activeLotInfo.initialQuantity} KG` : ''}` 
                                        : `${activeOrder?.trelicaModel || '---'} ${activeOrder?.tamanho ? `(${activeOrder.tamanho}M)` : ''}`}
                                </h3>
                                {trelicaDetails && (
                                    <div className="flex gap-6 mt-2 px-8 py-2 bg-black/40 border border-white/5 rounded-full backdrop-blur-md">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Superior</span>
                                            <span className="text-sm font-black text-white">{trelicaDetails.superior}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Inferior</span>
                                            <span className="text-sm font-black text-white">{trelicaDetails.inferior}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Senozoide</span>
                                            <span className="text-sm font-black text-white">{trelicaDetails.sinusoide}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-10 flex flex-wrap justify-center gap-6">
                                <div className={`px-8 py-4 bg-black/60 border rounded-3xl flex flex-col items-center min-w-[200px] ${trefilaEstimation.isDelayed ? 'border-rose-500/50' : 'border-emerald-500/50'}`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {machineType.startsWith('Trefila') ? 'Produção do Turno' : 'Peças Produzidas (Turno)'}
                                    </span>
                                    <span className="text-5xl font-black text-white font-mono">
                                        {dailyProducedValue.toLocaleString('pt-BR', { 
                                            maximumFractionDigits: machineType.startsWith('Trefila') ? 1 : 0 
                                        })} 
                                        <span className="text-xl"> {goalUnit}</span>
                                    </span>
                                    <div className="mt-2 flex items-center gap-1.5 opacity-60">
                                        <ClockIcon className="h-3 w-3 text-slate-400" />
                                        <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-300">
                                            Última atualização: {lastReportTime ? new Date(lastReportTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className={`px-8 py-4 bg-black/60 border rounded-3xl flex flex-col items-center min-w-[200px] ${trefilaEstimation.isDelayed ? 'border-rose-500/50' : 'border-emerald-500/50'}`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-emerald-500'}`}>Tempo de Processo</span>
                                    <span className="text-5xl font-black text-white font-mono tabular-nums">
                                        {machineType.startsWith('Trefila') 
                                            ? formatDuration(now.getTime() - new Date(activeOrder!.activeLotProcessing!.startTime).getTime())
                                            : formatDuration(now.getTime() - lastResumeTime)
                                        }
                                    </span>
                                </div>

                                {machineType.startsWith('Trefila') && trefilaEstimation.remainingSeconds !== null && (
                                    <div className={`px-8 py-4 bg-black/60 border rounded-3xl flex flex-col items-center min-w-[240px] ${trefilaEstimation.isDelayed ? 'border-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'border-emerald-500/50'}`}>
                                        <div className="flex flex-col items-center">
                                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${trefilaEstimation.isDelayed ? 'text-rose-400' : 'text-emerald-500'}`}>
                                                {trefilaEstimation.isDelayed ? 'Tempo de Atraso' : 'Estimativa Restante'}
                                            </span>
                                            <span className={`text-5xl font-black font-mono tabular-nums ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-white'}`}>
                                                {trefilaEstimation.isDelayed 
                                                    ? formatDuration((trefilaEstimation.elapsedUptimeSeconds - (activeLotInfo.initialQuantity / (parseFloat(activeOrder?.targetBitola?.replace(',', '.') || '1')**2 * 0.006162 * activeOrder!.activeLotProcessing!.speed))) * 1000)
                                                    : formatDuration(trefilaEstimation.remainingSeconds * 1000)
                                                }
                                            </span>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-white/5 w-full flex justify-between items-center px-2">
                                            <div className="flex flex-col items-start">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Parada (Lote)</span>
                                                <span className="text-xs font-bold text-rose-400 font-mono italic">{formatDuration(trefilaEstimation.lotDowntimeMs)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Termina às</span>
                                                <span className="text-xs font-bold text-emerald-400 font-mono italic">{trefilaEstimation.estimatedFinishTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-4 opacity-50">
                                <CogIcon className={`h-6 w-6 animate-spin-slow ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-emerald-500'}`} />
                                <CogIcon className={`h-6 w-6 animate-spin-slow delay-150 ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-emerald-500'}`} />
                                <CogIcon className={`h-6 w-6 animate-spin-slow delay-300 ${trefilaEstimation.isDelayed ? 'text-rose-500' : 'text-emerald-500'}`} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Massive Stop Reason Overlay */}
                {isStopped && !isHistoryExpanded && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 pointer-events-none select-none">
                        <div className="w-full bg-rose-950/45 backdrop-blur-xl border-y-4 border-rose-500 py-12 animate-stop-pulse flex flex-col items-center justify-center shadow-[0_0_100px_rgba(244,63,94,0.4)]">
                            <span className="text-sm font-black text-rose-400 uppercase tracking-[0.8em] mb-6 neon-text-red">ALERTA MÁQUINA PARADA</span>
                            <h3 className="text-4xl md:text-6xl font-black text-white text-center uppercase tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] leading-tight px-4 break-words max-w-full italic">
                                {machineStatus.reason}
                            </h3>
                            
                            {/* Real-time Stop Duration Counter */}
                            <div className="flex flex-col md:flex-row gap-6 mt-8">
                                <div className="px-8 py-3 bg-black/60 border border-rose-500/50 rounded-2xl flex flex-col items-center min-w-[200px]">
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Tempo Total de Parada</span>
                                    <span className="text-5xl font-black text-white font-mono tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                        {formatDuration(machineStatus.durationMs)}
                                    </span>
                                </div>

                                {(() => {
                                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    const normReason = normalize(machineStatus.reason);
                                    const limitEntry = Object.entries(DOWNTIME_THRESHOLDS).find(([key]) => normReason.includes(normalize(key)));
                                    
                                    if (!limitEntry) return null;
                                    
                                    const limitMs = limitEntry[1] * 60 * 1000;
                                    const isOverLimit = machineStatus.durationMs > limitMs;

                                    return (
                                        <div className={`px-8 py-3 bg-black/60 border rounded-2xl flex flex-col items-center min-w-[200px] transition-all duration-500 ${
                                            isOverLimit ? 'border-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse' : 'border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                                        }`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isOverLimit ? 'text-rose-500' : 'text-amber-400 animate-pulse'}`}>
                                                {isOverLimit ? 'LIMITE ULTRAPASSADO' : 'TEMPO PREVISTO'}
                                            </span>
                                            <span className={`text-5xl font-black font-mono tabular-nums tracking-tighter ${isOverLimit ? 'text-rose-600' : 'text-amber-400 animate-pulse'}`}>
                                                {formatDuration(limitMs)}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="mt-8 flex gap-4 opacity-50">
                                <WarningIcon className={`h-6 w-6 animate-bounce ${machineStatus.durationMs > (Object.entries(DOWNTIME_THRESHOLDS).find(([k]) => machineStatus.reason.includes(k))?.[1] || 0) * 60000 ? 'text-rose-600' : 'text-amber-500'}`} />
                                <WarningIcon className={`h-6 w-6 animate-bounce delay-100 ${machineStatus.durationMs > (Object.entries(DOWNTIME_THRESHOLDS).find(([k]) => machineStatus.reason.includes(k))?.[1] || 0) * 60000 ? 'text-rose-600' : 'text-amber-500'}`} />
                                <WarningIcon className={`h-6 w-6 animate-bounce delay-200 ${machineStatus.durationMs > (Object.entries(DOWNTIME_THRESHOLDS).find(([k]) => machineStatus.reason.includes(k))?.[1] || 0) * 60000 ? 'text-rose-600' : 'text-amber-500'}`} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Overlay History - FULL WIDTH when Open */}
                {isHistoryExpanded && (
                    <div className="absolute inset-0 z-50 bg-[#060B18] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <div className="p-4 border-b border-white/5 flex gap-6 items-center bg-white/5 justify-between">
                            <div className="flex gap-6">
                                <button 
                                    onClick={() => setActiveTab('stops')}
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${activeTab === 'stops' ? 'text-rose-400 neon-text-rose' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <WarningIcon className="h-3 w-3" /> Histórico de Paradas
                                </button>
                                <button 
                                    onClick={() => setActiveTab('production')}
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${activeTab === 'production' ? 'text-[#00E5FF] neon-text-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ChartBarIcon className="h-3 w-3" /> Produção do Turno
                                </button>
                            </div>
                            <button 
                                onClick={() => setIsHistoryExpanded(false)}
                                className="text-[10px] font-black bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-full shadow-lg shadow-rose-500/20 uppercase transition-all"
                            >
                                FECHAR PAINEL ✕
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40">
                            {activeTab === 'stops' ? (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-[#0D1929] backdrop-blur-md z-20">
                                        <tr className="text-[12px] uppercase font-black text-slate-400 border-b border-white/10">
                                            <th className="p-5 px-8">Início</th>
                                            <th className="p-5">Término</th>
                                            <th className="p-5">Duração</th>
                                            <th className="p-5">Motivo da Parada</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {allOrders
                                            .filter(o => {
                                                const isExact = o.machine === machineType;
                                                const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && machineType === 'Trefila 1');
                                                const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && machineType === 'Treliça 1');
                                                return isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1;
                                            })
                                            .flatMap(o => (o.downtimeEvents || []).map((e: any) => ({ ...e, orderNumber: o.orderNumber })))
                                            .filter(e => new Date(e.stopTime).getTime() >= shiftStartMs)
                                            .sort((a,b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
                                            .map((e, i) => {
                                                const start = new Date(e.stopTime);
                                                const end = e.resumeTime ? new Date(e.resumeTime) : null;
                                                const duration = (end ? end.getTime() : now.getTime()) - start.getTime();
                                                
                                                return (
                                                    <tr key={i} className="hover:bg-indigo-500/5 transition-colors group/row">
                                                        <td className="p-5 px-8 font-mono text-slate-200 text-sm font-bold">
                                                            {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </td>
                                                        <td className="p-5 font-mono text-slate-400 text-sm">
                                                            {end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '---'}
                                                        </td>
                                                        <td className="p-5 font-mono text-rose-400 font-black text-base drop-shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                                                            {formatDuration(duration)}
                                                        </td>
                                                        <td className="p-5 flex items-center gap-4 text-sm font-black text-slate-100 uppercase tracking-tight">
                                                            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] shrink-0" />
                                                            {e.reason}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        {allOrders.filter(o => {
                                            const isExact = o.machine === machineType;
                                            const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && machineType === 'Trefila 1');
                                            const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && machineType === 'Treliça 1');
                                            return isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1;
                                        }).flatMap(o => o.downtimeEvents || []).filter(e => new Date(e.stopTime).getTime() >= shiftStartMs).length === 0 && (
                                            <tr><td colSpan={4} className="p-16 text-center text-slate-600 text-sm font-bold uppercase tracking-[0.4em]">Nenhuma parada registrada</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-[#0D1929] backdrop-blur-md z-20">
                                        <tr className="text-[10px] uppercase font-black text-slate-400 border-b border-white/10">
                                            <th className="p-4 px-6">Lote / Registro</th>
                                            <th className="p-4 font-mono">Peso Produzido</th>
                                            <th className="p-4 text-right px-6 font-mono">Horário do Reporte</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {productionHistoryInShift.map((item, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors group/row">
                                                <td className="p-4 px-6 font-bold text-slate-200 text-sm uppercase">{item.label}</td>
                                                <td className="p-4 font-black text-emerald-400 text-sm">{item.weight?.toFixed(2) || '---'}<span className="text-[9px] text-slate-600 ml-1.5 uppercase tracking-widest">kg</span></td>
                                                <td className="p-4 text-right px-6 font-mono text-xs text-slate-500 group-hover/row:text-slate-300">
                                                    {new Date(item.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                        {productionHistoryInShift.length === 0 && (
                                            <tr><td colSpan={3} className="p-12 text-center text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Nenhuma produção registrada</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-white/5 inset-0 pointer-events-none">
                    <div className="flex flex-col gap-8 pointer-events-auto">
                        {/* Shift Stats Card */}
                        <div className="relative p-6 bg-black/30 rounded-3xl border border-white/5 overflow-hidden">
                            <TrendLine color={efficiency > 90 ? '#10b981' : '#00E5FF'} />
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">Produção do Turno</h3>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
                                            {dailyProducedValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-xl font-bold text-slate-500 uppercase tracking-widest">{goalUnit}</span>
                                    </div>
                                </div>
                                <div className="bg-black/40 border border-white/10 p-4 rounded-2xl text-center backdrop-blur-sm">
                                    <p className={`text-2xl font-black ${efficiency > 90 ? 'text-emerald-400' : 'text-[#00E5FF]'} leading-none`}>{efficiency.toFixed(1)}%</p>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">META: {dailyGoal}{goalUnit}</p>
                                </div>
                            </div>
                            <div className="mt-8 flex items-center justify-between gap-4 relative z-10">
                                <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Eficiência: <span className={efficiency > 90 ? 'text-emerald-400' : 'text-[#00E5FF]'}>{efficiency.toFixed(1)}%</span>
                                </div>
                                <div className="flex-1 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Tendência: <span className="text-emerald-400">UP ▲</span>
                                </div>
                            </div>
                        </div>

                        {/* Progress Card */}
                        <div className="p-6 bg-black/30 rounded-3xl border border-white/5 h-full flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Progresso da OP #{activeOrder?.orderNumber || '---'}</h3>
                                    {isGestor && onResetShift && (
                                        <button onClick={onResetShift} className="text-[9px] font-black bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-white/10 uppercase transition-all">Reset Shift</button>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-4 mb-5">
                                    <span className="text-5xl font-black text-white tracking-tight tabular-nums">
                                        {machineType.startsWith('Trefila') ? processedLotsCount : producedQuantity.toLocaleString()}
                                    </span>
                                    <span className="text-lg font-bold text-slate-500 uppercase">{machineType.startsWith('Trefila') ? 'Lotes' : 'Peças'}</span>
                                </div>
                            </div>
                            
                            <div>
                                {/* Custom Bar Chart Simulation */}
                                <div className="h-20 flex items-end gap-1 mb-4">
                                    {[30, 45, 35, 60, 50, 80, 70, 90, 85, 100].map((h, i) => (
                                        <div key={i} className="flex-1 rounded-t-sm" style={{ 
                                            height: `${h}%`, 
                                            background: i < (progress / 10) ? `linear-gradient(to top, #10b98122, #10b981)` : 'rgba(255,255,255,0.05)',
                                            boxShadow: i < (progress / 10) ? '0 0 10px #10b98144' : 'none'
                                        }} />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        <span>Disponibilidade: {(shiftUptime / (shiftUptime+shiftDowntime) * 100 || 0).toFixed(1)}%</span>
                                        <span>Tempo de Estado: {formatDuration(machineStatus.durationMs)}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-[#00E5FF]">
                                        <span>Último Reporte:</span>
                                        <span className="font-mono text-white">{lastReportTime ? new Date(lastReportTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '---'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 pointer-events-auto items-center justify-center">
                        {/* THE NEW TOGGLE BUTTON FOR FULL HISTORY */}
                        <div 
                            onClick={() => setIsHistoryExpanded(true)}
                            className="w-full flex-1 group/history relative cursor-pointer overflow-hidden rounded-[2rem] border border-white/5 bg-black/40 hover:bg-white/5 transition-all duration-500 flex flex-col items-center justify-center gap-6"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover/history:opacity-100 transition-opacity" />
                            <div className="p-8 bg-indigo-500/20 border border-indigo-500/40 rounded-full group-hover/history:scale-110 transition-transform duration-500 group-hover/history:shadow-[0_0_40px_rgba(99,102,241,0.3)]">
                                <BookOpenIcon className="h-16 w-16 text-indigo-400" />
                            </div>
                            <div className="text-center z-10 px-6">
                                <h4 className="text-2xl font-black text-white tracking-widest uppercase mb-2">Histórico Completo</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Paradas • Produção • Ocorrências</p>
                                <div className="mt-6 inline-flex items-center gap-2 text-[10px] font-black px-6 py-2 bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 group-hover/history:bg-indigo-400 transition-colors">
                                    ABRIR RELATÓRIO <ArrowLeftIcon className="h-3 w-3 rotate-180" />
                                </div>
                            </div>
                        </div>

                        {/* Quick Totals */}
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="p-6 bg-black/40 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center gap-2">
                                <ClockIcon className="h-6 w-6 text-[#00E5FF]" />
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Uptime</p>
                                <p className="text-xl font-bold text-white font-mono">{formatDuration(shiftUptime)}</p>
                            </div>
                            <div className="p-6 bg-black/40 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center gap-2">
                                <WarningIcon className="h-6 w-6 text-rose-500" />
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Parado</p>
                                <p className="text-xl font-bold text-white font-mono">{formatDuration(shiftDowntime)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            {/* Bottom Status Edge */}
            <div className={`h-1 w-full bg-gradient-to-r from-transparent via-${currentStyle.color.replace('text-[', '').replace(']', '')} to-transparent opacity-50`} />
        </div>
    );
};

interface ProductionDashboardProps {
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
    currentUser: User | null;
    downtimeConfigs: DowntimeConfig[];
}

const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ setPage, productionOrders, stock, currentUser, downtimeConfigs }) => {
    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const [shiftResets, setShiftResets] = useState(() => JSON.parse(localStorage.getItem('shiftResets') || '{}'));
    const [visibleMachines, setVisibleMachines] = useState<MachineType[]>(() => {
        const saved = localStorage.getItem('dashboardVisibleMachines');
        return saved ? JSON.parse(saved) : ['Trefila 1', 'Treliça 1'];
    });
    const allAvailableMachines: MachineType[] = ['Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2'];
    const [showMachineSelector, setShowMachineSelector] = useState(false);

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

        const machineOrders = productionOrders.filter(o => {
            const isExact = o.machine === m;
            const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && m === 'Trefila 1');
            const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && m === 'Treliça 1');
            return isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1;
        });

        return machineOrders.filter(o => o.status !== 'cancelled').reduce((acc, o) => {
            if (m.startsWith('Trefila')) {
                const lots = (o.processedLots || []) as ProcessedLot[];
                return acc + lots.filter(l => l.endTime && new Date(l.endTime).getTime() >= effective).reduce((s, l) => s + (l.finalWeight || 0), 0);
            }
            const logs = (o.operatorLogs || []) as OperatorLog[];
            return acc + logs.reduce((s, log) => {
                if (new Date(log.startTime).getTime() < effective) return s;
                const endQty = log.endQuantity !== undefined && log.endQuantity !== null ? log.endQuantity : (o.status === 'completed' ? (o.actualProducedQuantity || 0) : (o.actualProducedQuantity || 0));
                return s + Math.max(0, endQty - (log.startQuantity || 0));
            }, 0);
        }, 0);
    };

    const getTrelicaGoal = (activeOrder?: ProductionOrderData) => {
        if (!activeOrder) return 500;
        const model = (activeOrder.trelicaModel || '').toUpperCase();
        const size = String(activeOrder.tamanho);
        const isH12Leve = model.includes('H12') && model.includes('LEVE');
        const is12m = size === '12';

        if (isH12Leve) {
            return is12m ? 250 : 500;
        } else {
            return is12m ? 350 : 700;
        }
    };

    const toggleFullscreen = () => {
        const element = document.getElementById('dashboard-main-container');
        if (!document.fullscreenElement) {
            element?.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div id="dashboard-main-container" className="min-h-screen bg-[#060B18] text-slate-300 p-4 lg:p-8 flex flex-col gap-6 font-sans overflow-x-hidden overflow-y-auto custom-scrollbar">
            <header className="flex justify-between items-center px-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400">
                        <ChartBarIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-[0.15em] text-white uppercase italic animate-pulse neon-text-cyan flex items-center gap-3">
                            <div className="w-2 h-8 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,1)] hidden md:block" />
                            DASHBOARD <span className="text-indigo-400 not-italic">LAMINAÇÃO</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">MSM GESTÃO INDUSTRIAL • LIVE MONITORING</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    {/* Machine Selector Button */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowMachineSelector(!showMachineSelector)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-emerald-400 hover:text-emerald-300"
                        >
                            MÁQUINAS: {visibleMachines.length}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        </button>

                        {showMachineSelector && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                                {allAvailableMachines.map(m => (
                                    <label key={m} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleMachines.includes(m) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                                            {visibleMachines.includes(m) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-white">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-slate-300">{m}</span>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={visibleMachines.includes(m)}
                                            onChange={(e) => {
                                                const newVisible = e.target.checked 
                                                    ? [...visibleMachines, m] 
                                                    : visibleMachines.filter(v => v !== m);
                                                setVisibleMachines(newVisible);
                                                localStorage.setItem('dashboardVisibleMachines', JSON.stringify(newVisible));
                                            }}
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={toggleFullscreen}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                        TELA CHEIA
                    </button>

                    <div className="hidden xl:flex items-center gap-8 bg-black/40 border border-white/5 py-2.5 px-8 rounded-2xl backdrop-blur-xl">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Operação Geral</p>
                            <p className="text-xs font-bold text-emerald-400 uppercase">Sistema Estável</p>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Próxima Virada</p>
                            <p className="text-xs font-bold text-white uppercase">{new Date().getHours() < 14 ? '14:00 (Turno B)' : '05:00 (Turno A)'}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className={`flex-1 grid grid-cols-1 ${visibleMachines.length > 1 ? 'xl:grid-cols-2' : ''} gap-6 lg:gap-8 pb-8`}>
                {visibleMachines.map(m => {
                    const machineOrders = productionOrders.filter(o => {
                        const isExact = o.machine === m;
                        const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && m === 'Trefila 1');
                        const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && m === 'Treliça 1');
                        return isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1;
                    });

                    // activeOrder derived from the already-filtered subset
                    const activeOrder = machineOrders.find(o => o.status === 'in_progress');

                    return (
                        <MachineStatusView 
                            key={m}
                            machineType={m} 
                            activeOrder={activeOrder} 
                            allOrders={machineOrders}
                            stock={stock} 
                            dailyProducedValue={getDailyValue(m)} 
                            dailyGoal={m.startsWith('Treliça') ? getTrelicaGoal(activeOrder) : (new Date().getHours() >= 5 && new Date().getHours() < 14 ? 15000 : 12000)} 
                            goalUnit={m.startsWith('Treliça') ? "pçs" : "kg"} 
                            isGestor={isGestor} 
                            onResetShift={() => handleReset(m)} 
                            downtimeConfigs={downtimeConfigs}
                        />
                    );
                })}
            </div>
            
            <footer className="flex justify-between items-center px-4 border-t border-white/5 pt-6 pb-2">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">MSM GESTÃO INDUSTRIAL • 2026</p>
                <div className="flex gap-4">
                     <span className="flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> Conectado via WebSocket
                     </span>
                </div>
            </footer>
        </div>
    );
};

export default ProductionDashboard;