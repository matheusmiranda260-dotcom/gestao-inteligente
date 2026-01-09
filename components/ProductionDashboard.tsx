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
    Produzindo: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: <CogIcon className="h-12 w-12 text-green-500 animate-spin" />, title: 'EM PRODUÇÃO' },

    Preparacao: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500', icon: <WrenchScrewdriverIcon className="h-12 w-12 text-blue-500 animate-pulse" />, title: 'EM PREPARAÇÃO' },
    Parada: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: <PauseIcon className="h-12 w-12 text-red-500" />, title: 'MÁQUINA PARADA' },
    Ocioso: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: <ClockIcon className="h-12 w-12 text-yellow-500" />, title: 'OCIOSA' },
    Desligada: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: <StopIcon className="h-12 w-12 text-yellow-500" />, title: 'MÁQUINA DESLIGADA' },
};

interface MachineStatusViewProps {
    machineType: MachineType;
    activeOrder: ProductionOrderData | undefined;
    stock: StockItem[];
}

const MachineStatusView: React.FC<MachineStatusViewProps> = ({ machineType, activeOrder, stock }) => {
    // Local timer to ensure the clock ticks even if parent doesn't re-render
    const [localNow, setLocalNow] = useState(new Date());

    // Persistent drift to align local clock with server timestamps
    const [stableDrift, setStableDrift] = useState(0);

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
            return maxDrift;
        });
    }, [activeOrder]);

    const currentOperatorLog = useMemo(() => {
        if (!activeOrder?.operatorLogs) return null;
        // Sort by startTime to ensure we get the true latest, then reverse to find the latest open one
        return [...activeOrder.operatorLogs]
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .reverse()
            .find(log => !log.endTime) || null;
    }, [activeOrder]);

    const now = useMemo(() => new Date(localNow.getTime() + stableDrift), [localNow, stableDrift]);

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem em produção', since: now.toISOString(), durationMs: 0 };
        }

        const relevantEvents = [...(activeOrder.downtimeEvents || [])].sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime());

        const lastEvent = relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1] : null;

        if (lastEvent?.resumeTime === null && lastEvent) {
            const reason = (lastEvent.reason || '').trim();
            const durationMs = Math.max(0, now.getTime() - new Date(lastEvent.stopTime).getTime());

            if (reason === 'Final de Turno') {
                return { status: 'Desligada', reason: 'Final de Turno', since: lastEvent.stopTime, durationMs: 0 };
            }
            if (reason === 'Troca de Rolo / Preparação' || reason === 'Aguardando Início da Produção') {
                return { status: 'Preparacao', reason: reason, since: lastEvent.stopTime, durationMs };
            }

            return { status: 'Parada', reason: lastEvent.reason, since: lastEvent.stopTime, durationMs };
        } else {
            // ... existing logic for producing ...
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

    const timelineEvents = useMemo(() => {
        if (!activeOrder) return [];
        let events: { timestamp: string; message: string; details?: string; type: string }[] = [];

        events.push({ timestamp: activeOrder.startTime!, message: `Ordem ${activeOrder.orderNumber} iniciada`, type: 'start' });
        (activeOrder.downtimeEvents || []).forEach(event => {
            events.push({ timestamp: event.stopTime, message: 'Máquina Parada', details: event.reason, type: 'stop' });
            if (event.resumeTime) {
                events.push({ timestamp: event.resumeTime, message: 'Produção Retomada', type: 'resume' });
            }
        });

        return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [activeOrder]);

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
            <div className="bg-white p-6 rounded-xl shadow-lg h-full flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{machineType}</h2>
                <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-500">
                    <ClockIcon className="h-16 w-16 text-slate-400 mb-4" />
                    <p className="font-semibold">Máquina Ociosa</p>
                    <p className="text-sm">Nenhuma ordem de produção em andamento.</p>
                </div>
            </div>
        );
    }


    return (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg flex flex-col space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">{machineType}</h2>
            {isAlertActive && (
                <div className="bg-red-500 text-white p-2 rounded-md text-center animate-pulse text-xs md:text-sm font-semibold">
                    ALERTA: MÁQUINA PARADA HÁ {formatDuration(machineStatus.durationMs)}
                </div>
            )}
            <div className={`p-3 md:p-4 rounded-md border-t-4 ${currentStyle.border} ${currentStyle.bg}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="shrink-0">
                            {currentStyle.icon}
                        </div>
                        <div>
                            <p className={`text-xl md:text-2xl font-bold ${currentStyle.text}`}>{currentStyle.title}</p>
                            <p className={`text-sm md:text-md font-semibold ${currentStyle.text} break-words`}>{machineStatus.reason}</p>
                        </div>
                    </div>
                    <div className="text-left md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-current/20">
                        <p className={`text-2xl md:text-3xl font-mono font-bold ${currentStyle.text}`}>{formatDuration(machineStatus.durationMs)}</p>
                    </div>
                </div>

                {/* Exibição do Lote em Processo (apenas Trefila) */}
                {activeLotProcessingData && (
                    <div className="mt-4 pt-4 border-t border-current/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${machineStatus.status === 'Produzindo' ? 'bg-green-200 text-green-900' : 'bg-slate-200 text-slate-700'}`}>
                                Lote em Processo
                            </span>
                            <span className="text-sm font-bold text-slate-700">
                                {activeLotProcessingData.lotInfo.internalLot}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Peso Inicial:</span>
                            <span className="text-sm font-black text-slate-800">{activeLotProcessingData.lotInfo.labelWeight.toFixed(0)} kg</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="border p-3 md:p-4 rounded-md">
                <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
                    <div>
                        <h3 className="font-semibold text-slate-700">Detalhes da Ordem</h3>
                        {currentOperatorLog && (
                            <p className="text-xs text-slate-500 mt-1">
                                Início Turno: <span className="font-mono font-bold text-slate-700">{new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                        )}
                    </div>
                    <div className="w-full md:w-auto mt-2 md:mt-0 text-left md:text-right text-xs">
                        {(() => {
                            const totalTime = shiftDowntime + shiftUptime;
                            const downtimePct = totalTime > 0 ? (shiftDowntime / totalTime) * 100 : 0;
                            const uptimePct = totalTime > 0 ? (shiftUptime / totalTime) * 100 : 0;

                            return (
                                <>
                                    <div className="flex gap-2 justify-between md:justify-end mb-1 items-center border-b md:border-b-0 pb-1 md:pb-0 border-slate-100">
                                        <span className="text-slate-500 font-medium">Parado:</span>
                                        <div className="flex gap-2 items-center">
                                            <span className="font-bold text-amber-600 font-mono">{formatDuration(shiftDowntime)}</span>
                                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[3rem] text-center">{downtimePct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-between md:justify-end items-center">
                                        <span className="text-slate-500 font-medium">Produtivo:</span>
                                        <div className="flex gap-2 items-center">
                                            <span className="font-bold text-emerald-600 font-mono">{formatDuration(shiftUptime)}</span>
                                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[3rem] text-center">{uptimePct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
                <div className="text-sm space-y-1 mt-3 pt-3 border-t border-slate-100">
                    <p><strong>Nº Ordem:</strong> {activeOrder.orderNumber}</p>
                    <p><strong>Operador:</strong> {currentOperator}</p>
                    {machineType === 'Trefila' ? (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <p><strong>Produto:</strong> CA-60 {activeOrder.targetBitola}mm</p>
                            <p className="text-right"><strong>Meta:</strong> {activeOrder.totalWeight.toFixed(0)} kg</p>
                        </div>
                    ) : (
                        <p><strong>Produto:</strong> {activeOrder.trelicaModel} ({activeOrder.tamanho} mts)</p>
                    )}
                </div>
            </div>

            <div className="border p-3 md:p-4 rounded-md">
                <h3 className="font-semibold text-slate-700 mb-2">Progresso da Produção</h3>
                {machineType === 'Trefila' ? (
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex flex-col">
                                <span className="text-sm md:text-base text-slate-600">Lotes Processados</span>
                                {currentOperatorLog && (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                        No Turno: {(activeOrder.processedLots || []).filter(l => new Date(l.endTime).getTime() >= new Date(currentOperatorLog.startTime).getTime()).length}
                                    </span>
                                )}
                            </div>
                            <span className="text-lg md:text-xl font-bold text-slate-800">{processedLotsCount} / {totalLotsCount}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-4">
                            <div className="bg-indigo-500 h-4 rounded-full text-white text-[10px] md:text-xs flex items-center justify-center font-bold" style={{ width: `${progress}%` }}>
                                {progress > 10 && `${progress.toFixed(0)}%`}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        {machineType === 'Treliça' && (
                            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-1 gap-1">
                                    <span className="text-[10px] md:text-xs font-bold uppercase text-slate-500 tracking-wider">Tempo desde último reporte</span>
                                    {(() => {
                                        if (machineStatus.status === 'Desligada') {
                                            return <span className="text-slate-400 font-mono font-bold text-lg md:text-base">--:--:--</span>;
                                        }

                                        const lastUpdate = activeOrder.lastQuantityUpdate || activeOrder.startTime;
                                        if (!lastUpdate) return <span className="text-slate-400">-</span>;

                                        let baseTime = new Date(lastUpdate).getTime();
                                        if (currentOperatorLog && currentOperatorLog.startTime) {
                                            const shiftStartMs = new Date(currentOperatorLog.startTime).getTime();
                                            if (shiftStartMs > baseTime) {
                                                baseTime = shiftStartMs;
                                            }
                                        }

                                        const diff = now.getTime() - baseTime;
                                        const isOverdue = diff > 10 * 60 * 1000; // 10 minutes
                                        return (
                                            <span className={`font-mono font-bold text-lg md:text-base ${isOverdue ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                                                {formatDuration(diff)}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="text-[10px] md:text-xs text-slate-400 text-left md:text-right mt-1 md:mt-0">
                                    {machineStatus.status === 'Desligada' ? 'Turno Finalizado' : 'Meta: Reportar a cada 10 min'}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex flex-col">
                                <span className="text-sm md:text-base text-slate-600">Peças Produzidas</span>
                                {machineType === 'Treliça' && currentOperatorLog && (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">No Turno: {(activeOrder.actualProducedQuantity || 0) - (currentOperatorLog.startQuantity || 0)}</span>
                                )}
                            </div>
                            <span className="text-lg md:text-xl font-bold text-slate-800">{producedQuantity} / {plannedQuantity}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-4">
                            <div className="bg-emerald-500 h-4 rounded-full text-white text-[10px] md:text-xs flex items-center justify-center font-bold" style={{ width: `${progress}%` }}>
                                {progress > 10 && `${progress.toFixed(0)}%`}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabela de Lotes Processados - Apenas Trefila */}
            {machineType === 'Trefila' && (
                <div className="border p-3 md:p-4 rounded-md">
                    <h3 className="font-semibold text-slate-700 mb-2 underline decoration-slate-300 decoration-2 underline-offset-4 text-sm md:text-base">LOTES PROCESSADOS:</h3>
                    <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[500px]">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 text-[10px] md:text-xs uppercase font-bold text-left sticky top-0 z-10 shadow-sm">
                                    <th className="p-2 border border-slate-300 bg-slate-100">Lote</th>
                                    <th className="p-2 border border-slate-300 bg-slate-100 text-right">KG (Entrada)</th>
                                    <th className="p-2 border border-slate-300 bg-slate-100 text-right">KG (Saída)</th>
                                    <th className="p-2 border border-slate-300 bg-slate-100 text-center">Bitola</th>
                                    <th className="p-2 border border-slate-300 bg-slate-100 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs md:text-sm">
                                {(activeOrder.processedLots || [])
                                    .slice()
                                    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
                                    .map((lot, idx) => {
                                        const lotInfo = stock.find(s => s.id === lot.lotId);
                                        const isWaiting = lot.finalWeight === null || lot.measuredGauge === null || lot.measuredGauge === undefined;
                                        const waitingMs = isWaiting ? now.getTime() - new Date(lot.endTime).getTime() : 0;

                                        return (
                                            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                <td className="p-2 border border-slate-300 font-bold text-slate-700">
                                                    {lotInfo?.internalLot || 'N/A'}
                                                </td>
                                                <td className="p-2 border border-slate-300 text-right font-medium text-slate-600">
                                                    {lotInfo?.labelWeight.toFixed(0) || '0'} kg
                                                </td>
                                                <td className="p-2 border border-slate-300 text-right font-black text-slate-900">
                                                    {lot.finalWeight !== null ? `${lot.finalWeight.toFixed(1)} kg` : '-'}
                                                </td>
                                                <td className="p-2 border border-slate-300 text-center font-bold text-slate-700">
                                                    {lot.measuredGauge ? `${lot.measuredGauge.toFixed(2)}mm` : '-'}
                                                </td>
                                                <td className="p-2 border border-slate-300 text-center">
                                                    {isWaiting ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] font-black text-amber-600 animate-pulse uppercase leading-tight">Aguardando Pesagem/Aferição</span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-400">{formatDuration(waitingMs)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">OK</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                {(activeOrder.processedLots || []).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-slate-400 text-xs md:text-sm italic">
                                            Nenhum lote processado neste turno.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="border p-3 md:p-4 rounded-md">
                <h3 className="font-semibold text-slate-700 mb-2 underline decoration-slate-300 decoration-2 underline-offset-4 text-sm md:text-base">PARADAS E SEUS MOTIVOS:</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                    <table className="w-full border-collapse min-w-[300px]">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[10px] md:text-xs uppercase font-bold text-left sticky top-0 z-10 shadow-sm">
                                <th className="p-2 border border-slate-300 bg-slate-100">Início</th>
                                <th className="p-2 border border-slate-300 bg-slate-100">Fim</th>
                                <th className="p-2 border border-slate-300 bg-slate-100">Motivo</th>
                                <th className="p-2 border border-slate-300 text-right bg-slate-100">Duração</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs md:text-sm">
                            {(activeOrder.downtimeEvents || [])
                                .slice()
                                .sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime())
                                .filter(event => {
                                    if (event.reason === 'Final de Turno') return false;
                                    if (currentOperatorLog) {
                                        return new Date(event.stopTime).getTime() >= new Date(currentOperatorLog.startTime).getTime();
                                    }
                                    return false;
                                })
                                .map((event, idx) => {
                                    const eventEnd = event.resumeTime || (activeOrder.status === 'completed' ? activeOrder.endTime : null);
                                    const duration = eventEnd
                                        ? new Date(eventEnd).getTime() - new Date(event.stopTime).getTime()
                                        : now.getTime() - new Date(event.stopTime).getTime();

                                    const isOngoing = !event.resumeTime && activeOrder.status !== 'completed';

                                    return (
                                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-2 border border-slate-300 font-bold text-rose-600 font-mono text-center">
                                                {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                            <td className="p-2 border border-slate-300 font-bold text-emerald-600 font-mono text-center">
                                                {event.resumeTime
                                                    ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                    : (activeOrder.status === 'completed'
                                                        ? new Date(activeOrder.endTime!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '*'
                                                        : <span className="text-amber-500 text-[10px] animate-pulse">EM ANDAMENTO</span>
                                                    )
                                                }
                                            </td>
                                            <td className="p-2 border border-slate-300 italic text-slate-700 uppercase font-bold text-[10px] md:text-xs">
                                                {event.reason}
                                            </td>
                                            <td className="p-2 border border-slate-300 font-black text-rose-600 font-mono text-right tabular-nums">
                                                {formatDuration(duration)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            {(activeOrder.downtimeEvents || []).filter(e => e.reason !== 'Final de Turno').length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 text-xs md:text-sm italic">
                                        Nenhuma parada registrada recentemente.
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


interface ProductionDashboardProps {
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
    currentUser: User | null;
}

const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ setPage, productionOrders, stock, currentUser }) => {
    const activeTrefilaOrder = useMemo(() =>
        productionOrders.find(o => o.machine === 'Trefila' && o.status === 'in_progress'),
        [productionOrders]);

    const activeTrelicaOrder = useMemo(() =>
        productionOrders.find(o => o.machine === 'Treliça' && o.status === 'in_progress'),
        [productionOrders]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <MachineStatusView
                    machineType="Trefila"
                    activeOrder={activeTrefilaOrder}
                    stock={stock}
                />
                <MachineStatusView
                    machineType="Treliça"
                    activeOrder={activeTrelicaOrder}
                    stock={stock}
                />
            </div>
        </div>
    );
};

export default ProductionDashboard;