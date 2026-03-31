import React, { useState, useEffect, useMemo } from 'react';
import type { Page, ProductionOrderData, StockItem, User, OperatorLog, MachineType } from '../types';
import { ArrowLeftIcon, WarningIcon, CogIcon, PauseIcon, ClockIcon, CheckCircleIcon, ScaleIcon, PlayIcon, BookOpenIcon, StopIcon, WrenchScrewdriverIcon } from './icons';

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const statusStyles = {
    Produzindo: { bg: 'bg-gradient-to-r from-emerald-500 to-teal-600', text: 'text-white', border: 'border-transparent', icon: <CogIcon className="h-8 w-8 text-white animate-spin drop-shadow-md" />, title: 'EM PRODUÇÃO' },
    Preparacao: { bg: 'bg-gradient-to-r from-blue-500 to-indigo-600', text: 'text-white', border: 'border-transparent', icon: <WrenchScrewdriverIcon className="h-8 w-8 text-white animate-pulse drop-shadow-md" />, title: 'PREPARAÇÃO' },
    Parada: { bg: 'bg-gradient-to-r from-rose-500 to-red-600', text: 'text-white', border: 'border-transparent', icon: <PauseIcon className="h-8 w-8 text-white drop-shadow-md" />, title: 'MÁQUINA PARADA' },
    Ocioso: { bg: 'bg-gradient-to-r from-amber-400 to-orange-500', text: 'text-white', border: 'border-transparent', icon: <ClockIcon className="h-8 w-8 text-white drop-shadow-md" />, title: 'OCIOSA' },
    Desligada: { bg: 'bg-gradient-to-r from-slate-600 to-slate-800', text: 'text-white', border: 'border-transparent', icon: <StopIcon className="h-8 w-8 text-white drop-shadow-md" />, title: 'DESLIGADA' },
};

interface MachineStatusViewProps {
    machineType: MachineType;
    activeOrder: ProductionOrderData | undefined;
    stock: StockItem[];
    dailyProducedValue: number;
    dailyGoal: number;
    goalUnit: string;
}

const MachineStatusView: React.FC<MachineStatusViewProps> = ({ machineType, activeOrder, stock, dailyProducedValue, dailyGoal, goalUnit }) => {
    // Local timer to ensure the clock ticks even if parent doesn't re-render
    const [localNow, setLocalNow] = useState(new Date());

    // Persistent drift to align local clock with server timestamps, persisted in localStorage
    const driftKey = `stableDrift_${machineType}`;
    const [stableDrift, setStableDrift] = useState(() => {
        const saved = localStorage.getItem(driftKey);
        return saved ? parseInt(saved, 10) : 0;
    });

    useEffect(() => {
        const timerId = setInterval(() => setLocalNow(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

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

    const currentOperatorLog = useMemo(() => {
        if (!activeOrder?.operatorLogs || activeOrder.operatorLogs.length === 0) return null;
        const sorted = [...activeOrder.operatorLogs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const lastLog = sorted[sorted.length - 1];
        return lastLog.endTime ? null : lastLog;
    }, [activeOrder]);

    const now = useMemo(() => new Date(localNow.getTime() + stableDrift), [localNow, stableDrift]);

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem em produção', since: now.toISOString(), durationMs: 0 };
        }

        const relevantEvents = [...(activeOrder.downtimeEvents || [])].sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime());
        const lastEvent = relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1] : null;

        if (!currentOperatorLog) {
            return { status: 'Desligada', reason: 'Aguardando Início de Turno', since: lastEvent?.stopTime || activeOrder.startTime!, durationMs: 0 };
        }

        if (lastEvent?.resumeTime === null && lastEvent) {
            const reason = (lastEvent.reason || '').trim();
            const durationMs = Math.max(0, now.getTime() - new Date(lastEvent.stopTime).getTime());

            if (reason === 'Final de Turno') {
                const shiftStart = new Date(currentOperatorLog.startTime).getTime();
                const stopTime = new Date(lastEvent.stopTime).getTime();
                if (shiftStart > stopTime) {
                    return { status: 'Produzindo', reason: '', since: currentOperatorLog.startTime, durationMs: Math.max(0, now.getTime() - shiftStart) };
                }
                return { status: 'Desligada', reason: 'Turno Encerrado', since: lastEvent.stopTime, durationMs: 0 };
            }
            if (reason === 'Troca de Rolo / Preparação' || reason === 'Aguardando Início da Produção' || reason === 'Setup') {
                return { status: 'Preparacao', reason: reason, since: lastEvent.stopTime, durationMs };
            }

            return { status: 'Parada', reason: lastEvent.reason, since: lastEvent.stopTime, durationMs };
        } else {
            let since = lastEvent?.resumeTime || activeOrder.startTime || now.toISOString();
            const durationMs = Math.max(0, now.getTime() - new Date(since).getTime());
            return { status: 'Produzindo', reason: '', since, durationMs };
        }
    }, [activeOrder, now, currentOperatorLog]);

    const currentOperator = currentOperatorLog?.operator || 'N/A';

    const { shiftDowntime, shiftUptime } = useMemo(() => {
        if (!currentOperatorLog || !currentOperatorLog.startTime) return { shiftDowntime: 0, shiftUptime: 0 };

        const nowMs = now.getTime();
        const start = new Date(currentOperatorLog.startTime).getTime();
        const totalShiftDuration = Math.max(0, nowMs - start);

        let downtime = 0;
        if (activeOrder && activeOrder.downtimeEvents) {
            downtime = activeOrder.downtimeEvents.reduce((acc, event) => {
                const stopTime = new Date(event.stopTime).getTime();
                const resumeTime = event.resumeTime ? new Date(event.resumeTime).getTime() : nowMs;
                const effectiveStart = Math.max(stopTime, start);
                const effectiveEnd = Math.min(resumeTime, nowMs);
                if (effectiveEnd > effectiveStart) {
                    return acc + (effectiveEnd - effectiveStart);
                }
                return acc;
            }, 0);
        }

        const uptime = Math.max(0, totalShiftDuration - downtime);
        return { shiftDowntime: downtime, shiftUptime: uptime };
    }, [now, currentOperatorLog, activeOrder]);

    const isAlertActive = machineStatus.status === 'Parada' && machineStatus.durationMs > 30000;
    const currentStyle = statusStyles[machineStatus.status as keyof typeof statusStyles] || statusStyles.Ocioso;

    const activeLotProcessingData = useMemo(() => {
        if (machineType === 'Trefila' && activeOrder?.activeLotProcessing?.lotId) {
            const lotInfo = stock.find(s => s.id === activeOrder.activeLotProcessing!.lotId);
            return lotInfo ? { ...activeOrder.activeLotProcessing, lotInfo } : null;
        }
        return null;
    }, [activeOrder, stock, machineType]);

    const { processedLotsCount, totalLotsCount, producedQuantity, plannedQuantity, progress } = useMemo(() => {
        let processedLotsCount = 0, totalLotsCount = 0, producedQuantity = 0, plannedQuantity = 0, progress = 0;
        if (!activeOrder) return { processedLotsCount, totalLotsCount, producedQuantity, plannedQuantity, progress };

        if (machineType === 'Trefila' && Array.isArray(activeOrder.selectedLotIds)) {
            processedLotsCount = (activeOrder.processedLots || []).length;
            totalLotsCount = activeOrder.selectedLotIds.length;
            if (totalLotsCount > 0) progress = (processedLotsCount / totalLotsCount) * 100;
        } else if (machineType === 'Treliça') {
            producedQuantity = activeOrder.actualProducedQuantity || 0;
            plannedQuantity = activeOrder.quantityToProduce || 1;
            progress = (producedQuantity / plannedQuantity) * 100;
        }
        return { processedLotsCount, totalLotsCount, producedQuantity, plannedQuantity, progress: Math.min(100, progress) };
    }, [activeOrder, machineType]);

    if (!activeOrder) {
        return (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
                <div className="bg-slate-800 p-4">
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">{machineType}</h2>
                </div>
                <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-500 bg-slate-50">
                    <ClockIcon className="h-20 w-20 text-slate-300 mb-4" />
                    <p className="font-bold tracking-widest uppercase text-slate-400">Máquina Ociosa</p>
                    <p className="text-sm mt-2 text-slate-400">Nenhuma ordem em andamento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/60 ring-1 ring-black/5">
            {/* PREMIUM HEADER */}
            <div className={`px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2 shadow-lg z-10 ${currentStyle.bg}`}>
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md shadow-inner border border-white/30 hidden sm:block">
                        {currentStyle.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider drop-shadow-sm">{machineType}</h2>
                            {isAlertActive && <WarningIcon className="h-6 w-6 text-yellow-300 animate-ping" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 opacity-90">
                            <span className="text-xs md:text-sm font-black uppercase tracking-widest text-white">{currentStyle.title}</span>
                            {machineStatus.reason && <span className="text-xs md:text-sm font-bold text-white/90">&bull; {machineStatus.reason}</span>}
                        </div>
                    </div>
                </div>
                <div className="text-left lg:text-right mt-2 lg:mt-0">
                    <p className="text-5xl md:text-5xl font-mono font-black tracking-tighter drop-shadow-md text-white">{formatDuration(machineStatus.durationMs)}</p>
                </div>
            </div>

            {/* LOT IN PROGRESS SUB-HEADER (TREFILA) */}
            {activeLotProcessingData && (
                <div className="bg-slate-800 text-white px-5 py-2 flex flex-row justify-between items-center text-xs shadow-md z-0 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Lote em Processo</span>
                        <span className="font-bold text-sm">{activeLotProcessingData.lotInfo.internalLot}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400">Peso Inicial:</span>
                        <span className="font-black text-emerald-300">{activeLotProcessingData.lotInfo.labelWeight.toFixed(0)} kg</span>
                    </div>
                </div>
            )}

            {/* DENSE CONTENT GRID - ZERO GLOBAL SCROLL */}
            <div className="flex-1 p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden bg-slate-50">
                
                {/* LEFT COLUMN: CRITICAL METRICS */}
                <div className="flex flex-col gap-3 lg:gap-4 overflow-y-auto custom-scrollbar pr-1 min-h-0">
                    
                    {/* CARD 1: META DIÁRIA */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-xs title-font flex items-center gap-1.5">
                                <ScaleIcon className="h-4 w-4 text-indigo-500" /> Meta Diária da Fábrica
                            </h3>
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-widest ring-1 ring-indigo-500/20">
                                {((dailyProducedValue / dailyGoal) * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden shadow-inner shrink-0 ring-1 ring-black/5">
                                <div
                                    className={`h-full transition-all duration-1000 flex items-center justify-end pr-2 ${dailyProducedValue >= dailyGoal ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`}
                                    style={{ width: `${Math.min(100, (dailyProducedValue / dailyGoal) * 100)}%` }}
                                >
                                    {dailyProducedValue >= dailyGoal && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>}
                                </div>
                            </div>
                            <span className="text-base font-black text-slate-800 tracking-tighter whitespace-nowrap">
                                {dailyProducedValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-400 uppercase font-bold">{goalUnit}</span>
                                <span className="text-slate-300 mx-1">/</span>
                                {dailyGoal.toLocaleString('pt-BR')}
                            </span>
                        </div>
                        {dailyProducedValue >= dailyGoal && (
                            <div className="mt-2 flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] animate-pulse">
                                <CheckCircleIcon className="h-3 w-3" /> META BATIDA!
                            </div>
                        )}
                    </div>

                    {/* CARD 2: PROGRESSO DA PRODUÇÃO */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-xs">Progresso do Turno</h3>
                        </div>
                        
                        {machineType === 'Treliça' && (
                            <div className="mb-4 bg-slate-50/80 p-3 flex justify-between items-center rounded-xl border border-slate-100">
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Último Reporte</span>
                                    <span className="text-[9px] text-slate-400 font-semibold">{machineStatus.status === 'Desligada' ? 'Finalizado' : 'A cada 10m'}</span>
                                </div>
                                {(() => {
                                    if (machineStatus.status === 'Desligada') return <span className="text-slate-400 font-mono font-bold text-lg">--:--:--</span>;
                                    const lastUpdate = activeOrder.lastQuantityUpdate || activeOrder.startTime;
                                    if (!lastUpdate) return <span className="text-slate-400">-</span>;
                                    let baseTime = new Date(lastUpdate).getTime();
                                    if (currentOperatorLog && currentOperatorLog.startTime) {
                                        const shiftStartMs = new Date(currentOperatorLog.startTime).getTime();
                                        if (shiftStartMs > baseTime) baseTime = shiftStartMs;
                                    }
                                    const diff = now.getTime() - baseTime;
                                    const isOverdue = diff > 10 * 60 * 1000;
                                    return <span className={`font-mono font-bold text-lg ${isOverdue ? 'text-rose-500 animate-pulse bg-rose-50 px-2 py-0.5 rounded ring-1 ring-rose-500/20' : 'text-slate-700'}`}>{formatDuration(diff)}</span>;
                                })()}
                            </div>
                        )}

                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{machineType === 'Trefila' ? 'Lotes Processados' : 'Peças Produzidas'}</span>
                                {currentOperatorLog && (
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
                                        Turno: {machineType === 'Trefila' 
                                            ? (activeOrder.processedLots || []).filter(l => new Date(l.endTime).getTime() >= new Date(currentOperatorLog.startTime).getTime()).length 
                                            : ((activeOrder.actualProducedQuantity || 0) - (currentOperatorLog.startQuantity || 0))}
                                    </span>
                                )}
                            </div>
                            <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter">{machineType === 'Trefila' ? processedLotsCount : producedQuantity} <span className="text-sm font-bold text-slate-400">/ {machineType === 'Trefila' ? totalLotsCount : plannedQuantity}</span></span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner ring-1 ring-black/5">
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full text-white text-[9px] flex items-center justify-center font-bold tracking-widest" style={{ width: `${progress}%` }}>
                                {progress > 10 && `${progress.toFixed(0)}%`}
                            </div>
                        </div>
                    </div>

                    {/* CARD 3: DETALHES & EFICIÊNCIA */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-xs mb-3">Informações</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Ordem</p>
                                    <p className="text-sm font-bold text-slate-700">#{activeOrder.orderNumber}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Operador(a)</p>
                                    <p className="text-sm font-bold text-slate-700 uppercase">{currentOperator}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Produto</p>
                                    <p className="text-xs font-bold text-slate-700 leading-tight">
                                        {machineType === 'Trefila' ? `CA-60 ${activeOrder.targetBitola}mm` : `${activeOrder.trelicaModel} (${activeOrder.tamanho} mts)`}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="space-y-2 flex flex-col justify-end">
                                {currentOperatorLog && (
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Início Turno</p>
                                        <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100 inline-block px-1.5 py-0.5 rounded">{new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                )}
                                {(() => {
                                    const totalTime = shiftDowntime + shiftUptime;
                                    const downtimePct = totalTime > 0 ? (shiftDowntime / totalTime) * 100 : 0;
                                    const uptimePct = totalTime > 0 ? (shiftUptime / totalTime) * 100 : 0;
                                    return (
                                        <div className="space-y-1 mt-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex justify-between items-center bg-emerald-50/50 px-2 py-1 rounded">
                                                <span className="text-[9px] uppercase font-black text-emerald-600/70">PRODUTIVO</span>
                                                <div className="flex items-center gap-1.5 cursor-help" title={formatDuration(shiftUptime)}>
                                                    <span className="font-bold text-emerald-600 text-xs">{uptimePct.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-rose-50/50 px-2 py-1 rounded">
                                                <span className="text-[9px] uppercase font-black text-rose-600/70">PARADO</span>
                                                <div className="flex items-center gap-1.5 cursor-help" title={formatDuration(shiftDowntime)}>
                                                    <span className="font-bold text-rose-500 text-xs">{downtimePct.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: LISTS & TABLES (Flex column to share remaining vertical space) */}
                <div className="flex flex-col gap-3 lg:gap-4 md:row-span-1 min-h-[300px]">
                    
                    {/* PARADAS TABLE (Flex-1 so it scrolls within its box) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-0">
                        <div className="bg-slate-50 border-b border-slate-100 p-2.5 px-4 shrink-0 shadow-sm z-10 flex justify-between items-center">
                            <h3 className="font-black text-slate-600 uppercase tracking-widest text-[10px] flex justify-center items-center gap-1.5">
                                <WarningIcon className="h-3 w-3 text-rose-500" /> PARADAS DO TURNO
                            </h3>
                            <span className="text-[9px] font-bold text-slate-400 uppercase bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {((activeOrder.downtimeEvents || []).filter(e => e.reason !== 'Final de Turno' && currentOperatorLog && new Date(e.stopTime).getTime() >= new Date(currentOperatorLog.startTime).getTime()).length)} Registros
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
                                    <tr className="text-[9px] uppercase font-black text-slate-400 border-b border-slate-100">
                                        <th className="p-2 px-3">Duração</th>
                                        <th className="p-2">Início</th>
                                        <th className="p-2 w-full">Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(activeOrder.downtimeEvents || [])
                                        .slice()
                                        .filter(e => e.reason !== 'Final de Turno' && currentOperatorLog && new Date(e.stopTime).getTime() >= new Date(currentOperatorLog.startTime).getTime())
                                        .sort((a, b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
                                        .map((event, idx) => {
                                            const eventEnd = event.resumeTime || (activeOrder.status === 'completed' ? activeOrder.endTime : null);
                                            const duration = eventEnd ? new Date(eventEnd).getTime() - new Date(event.stopTime).getTime() : now.getTime() - new Date(event.stopTime).getTime();
                                            return (
                                                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                                                    <td className="p-2 px-3">
                                                        <span className="bg-rose-50 text-rose-600 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded inline-block group-hover:bg-rose-100 transition-colors">
                                                            {formatDuration(duration)}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 font-mono font-medium text-[10px] text-slate-500">
                                                        {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="p-2 text-[10px] md:text-xs font-bold text-slate-700 uppercase leading-none pr-3">
                                                        {event.reason}
                                                        {!event.resumeTime && <span className="ml-2 text-[8px] uppercase font-black bg-rose-500 text-white px-1 py-0.5 rounded animate-pulse">Atual</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {(activeOrder.downtimeEvents || []).filter(e => e.reason !== 'Final de Turno' && currentOperatorLog && new Date(e.stopTime).getTime() >= new Date(currentOperatorLog.startTime).getTime()).length === 0 && (
                                        <tr><td colSpan={3} className="p-4 text-center text-[10px] font-bold uppercase text-slate-300">Nenhuma parada no turno</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* LOTES TABLE (TREFILA ONLY, flex-1) */}
                    {machineType === 'Trefila' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-0">
                            <div className="bg-slate-50 border-b border-slate-100 p-2.5 px-4 shrink-0 shadow-sm z-10 flex justify-between items-center">
                                <h3 className="font-black text-slate-600 uppercase tracking-widest text-[10px] flex justify-center items-center gap-1.5">
                                    <BookOpenIcon className="h-3 w-3 text-indigo-500" /> HISTÓRICO DE LOTES
                                </h3>
                                <span className="text-[9px] font-bold text-slate-400 uppercase bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {(activeOrder.processedLots || []).length} Finalizados
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
                                        <tr className="text-[9px] uppercase font-black text-slate-400 border-b border-slate-100">
                                            <th className="p-2 px-3">Lote</th>
                                            <th className="p-2 font-mono">SAÍDA</th>
                                            <th className="p-2 text-center w-full">Medida / Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(activeOrder.processedLots || [])
                                            .slice()
                                            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
                                            .map((lot, idx) => {
                                                const lotInfo = stock.find(s => s.id === lot.lotId);
                                                const isWaiting = lot.finalWeight === null || lot.measuredGauge === null || lot.measuredGauge === undefined;
                                                return (
                                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                        <td className="p-2 px-3 font-bold text-[10px] text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]" title={lotInfo?.internalLot || 'N/A'}>
                                                            {lotInfo?.internalLot || 'N/A'}
                                                        </td>
                                                        <td className="p-2">
                                                            <span className="bg-slate-100/80 text-slate-700 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-slate-200 inline-block text-right min-w-[3rem]">
                                                                {lot.finalWeight !== null ? lot.finalWeight.toFixed(0) : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-[10px] font-bold text-slate-600 text-center">
                                                            {isWaiting ? (
                                                                <span className="text-[9px] uppercase font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 animate-pulse inline-block">Ag. Pesagem</span>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200/50 text-[10px] font-bold uppercase">{lot.measuredGauge?.toFixed(2)}mm</span>
                                                                    <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        {(activeOrder.processedLots || []).length === 0 && (
                                            <tr><td colSpan={3} className="p-4 text-center text-[10px] font-bold uppercase text-slate-300">Nenhum lote finalizado</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
    const activeTrefilaOrder = useMemo(() => {
        const active = productionOrders.filter(o => o.machine === 'Trefila' && o.status === 'in_progress');
        if (active.length === 0) return undefined;
        return active.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())[0];
    }, [productionOrders]);

    const activeTrelicaOrder = useMemo(() => {
        const active = productionOrders.filter(o => o.machine === 'Treliça' && o.status === 'in_progress');
        if (active.length === 0) return undefined;
        return active.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())[0];
    }, [productionOrders]);

    const dailyProduction = useMemo(() => {
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE'); // Safe YYYY-MM-DD in local time

        const isToday = (dateInput: string | undefined) => {
            if (!dateInput) return false;
            try {
                // Ensure we get local date for comparison
                return new Date(dateInput).toLocaleDateString('sv-SE') === todayStr;
            } catch (e) {
                return false;
            }
        };

        // Create a quick lookup map for stock items
        const stockMap = new Map(stock.map(s => [s.id, s]));
        const processedIds = new Set<string>();
        let trelicaMeters = 0;
        let trefilaWeight = 0;

        const orders = Array.isArray(productionOrders) ? productionOrders : [];

        // Process in reverse to use latest order snapshots
        [...orders].reverse().forEach(order => {
            const id = order.id || `order-${order.orderNumber}-${order.machine}`;
            if (processedIds.has(id)) return;
            processedIds.add(id);

            const machineLower = (order.machine || '').toLowerCase();

            if (machineLower.includes('treli')) {
                const size = parseFloat(String(order.tamanho || '6').replace(',', '.'));
                (order.operatorLogs || []).forEach(log => {
                    if (log.startTime && isToday(log.startTime)) {
                        const endQty = log.endTime ? (log.endQuantity || 0) : (order.actualProducedQuantity || 0);
                        const startQty = log.startQuantity || 0;
                        const producedInTurn = Math.max(0, endQty - startQty);
                        trelicaMeters += (producedInTurn * (size || 6));
                    }
                });
            } else if (machineLower.includes('trefila')) {
                (order.processedLots || []).forEach(lot => {
                    if (lot.endTime && isToday(lot.endTime)) {
                        if (lot.finalWeight !== null) {
                            trefilaWeight += lot.finalWeight;
                        } else {
                            // Use entry weight as estimate for lots finished today but not yet weighed
                            const entryLot = stockMap.get(lot.lotId) as StockItem;
                            trefilaWeight += (entryLot?.labelWeight || 0);
                        }
                    }
                });
            }
        });

        return { trelicaMeters, trefilaWeight };
    }, [productionOrders, stock]);

    // Calculate pieces and goal for Treliça
    const trelicaDisplayData = useMemo(() => {
        const sizeStr = activeTrelicaOrder ? String(activeTrelicaOrder.tamanho || '6') : '6';
        const sizeValue = parseFloat(sizeStr.replace(',', '.'));
        const goal = sizeValue >= 10 ? 350 : 750;
        const totalPiecesProduced = sizeValue > 0 ? Math.round(dailyProduction.trelicaMeters / sizeValue) : 0;

        return {
            value: totalPiecesProduced,
            goal: goal,
            unit: sizeValue >= 10 ? 'pçs (12m)' : 'pçs (6m)'
        };
    }, [activeTrelicaOrder, dailyProduction.trelicaMeters]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <MachineStatusView
                    machineType="Trefila"
                    activeOrder={activeTrefilaOrder}
                    stock={stock}
                    dailyProducedValue={dailyProduction.trefilaWeight}
                    dailyGoal={16000}
                    goalUnit="kg"
                />
                <MachineStatusView
                    machineType="Treliça"
                    activeOrder={activeTrelicaOrder}
                    stock={stock}
                    dailyProducedValue={trelicaDisplayData.value}
                    dailyGoal={trelicaDisplayData.goal}
                    goalUnit={trelicaDisplayData.unit}
                />
            </div>
        </div>
    );
};

export default ProductionDashboard;