import React, { useState, useEffect, useMemo } from 'react';
import type { Page, ProductionOrderData, StockItem, User, OperatorLog, MachineType } from '../types';
import { ArrowLeftIcon, WarningIcon, CogIcon, PauseIcon, ClockIcon, CheckCircleIcon, ScaleIcon, PlayIcon, BookOpenIcon, StopIcon } from './icons';

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

    const now = useMemo(() => new Date(localNow.getTime() + stableDrift), [localNow, stableDrift]);

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem em produção', since: now.toISOString(), durationMs: 0 };
        }

        const lastEvent = activeOrder.downtimeEvents?.[(activeOrder.downtimeEvents.length || 0) - 1];

        if (lastEvent?.resumeTime === null) {
            const reason = (lastEvent.reason || '').trim();
            if (reason === 'Final de Turno') {
                return { status: 'Desligada', reason: 'Final de Turno', since: lastEvent.stopTime, durationMs: 0 };
            }
            const durationMs = Math.max(0, now.getTime() - new Date(lastEvent.stopTime).getTime());
            return { status: 'Parada', reason: lastEvent.reason, since: lastEvent.stopTime, durationMs };
        } else {
            const since = lastEvent?.resumeTime || activeOrder.startTime || now.toISOString();
            const durationMs = Math.max(0, now.getTime() - new Date(since).getTime());
            return { status: 'Produzindo', reason: '', since, durationMs };
        }
    }, [activeOrder, now]);

    const currentOperatorLog = useMemo(() => {
        if (!activeOrder?.operatorLogs) return null;
        return [...activeOrder.operatorLogs].reverse().find(log => !log.endTime) || null;
    }, [activeOrder]);

    const currentOperator = currentOperatorLog?.operator || 'N/A';

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
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">{machineType}</h2>
            {isAlertActive && (
                <div className="bg-red-500 text-white p-2 rounded-md text-center animate-pulse text-sm font-semibold">
                    ALERTA: MÁQUINA PARADA HÁ {formatDuration(machineStatus.durationMs)}
                </div>
            )}
            <div className={`p-4 rounded-md border-t-4 ${currentStyle.border} ${currentStyle.bg}`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {currentStyle.icon}
                        <div>
                            <p className={`text-2xl font-bold ${currentStyle.text}`}>{currentStyle.title}</p>
                            <p className={`text-md font-semibold ${currentStyle.text}`}>{machineStatus.reason}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-3xl font-mono font-bold ${currentStyle.text}`}>{formatDuration(machineStatus.durationMs)}</p>
                    </div>
                </div>
            </div>

            <div className="border p-4 rounded-md">
                <h3 className="font-semibold text-slate-700 mb-2">Detalhes da Ordem</h3>
                <div className="text-sm space-y-1">
                    <p><strong>Nº Ordem:</strong> {activeOrder.orderNumber}</p>
                    <p><strong>Operador:</strong> {currentOperator}</p>
                    {machineType === 'Trefila' ? (
                        <p><strong>Produto:</strong> CA-60 {activeOrder.targetBitola}mm</p>
                    ) : (
                        <p><strong>Produto:</strong> {activeOrder.trelicaModel} ({activeOrder.tamanho} mts)</p>
                    )}
                </div>
            </div>

            <div className="border p-4 rounded-md">
                <h3 className="font-semibold text-slate-700 mb-2">Progresso da Produção</h3>
                {machineType === 'Trefila' ? (
                    <div className="text-center">
                        <span className="text-3xl font-bold text-slate-800">{processedLotsCount}</span>
                        <span className="text-slate-600"> / {totalLotsCount} lotes processados</span>
                    </div>
                ) : (
                    <div>
                        {machineType === 'Treliça' && (
                            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Tempo desde último reporte</span>
                                    {(() => {
                                        const lastUpdate = activeOrder.lastQuantityUpdate || activeOrder.startTime;
                                        if (!lastUpdate) return <span className="text-slate-400">-</span>;
                                        const diff = now.getTime() - new Date(lastUpdate).getTime();
                                        const isOverdue = diff > 10 * 60 * 1000; // 10 minutes
                                        return (
                                            <span className={`font-mono font-bold ${isOverdue ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                                                {formatDuration(diff)}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="text-xs text-slate-400 text-right">
                                    Meta: Reportar a cada 10 min
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex flex-col">
                                <span className="text-slate-600">Peças Produzidas</span>
                                {machineType === 'Treliça' && currentOperatorLog && (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">No Turno: {(activeOrder.actualProducedQuantity || 0) - (currentOperatorLog.startQuantity || 0)}</span>
                                )}
                            </div>
                            <span className="text-xl font-bold text-slate-800">{producedQuantity} / {plannedQuantity}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-4">
                            <div className="bg-emerald-500 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{ width: `${progress}%` }}>
                                {progress > 10 && `${progress.toFixed(0)}%`}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="border p-4 rounded-md">
                <h3 className="font-semibold text-slate-700 mb-2 underline decoration-slate-300 decoration-2 underline-offset-4">PARADAS E SEUS MOTIVOS:</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-bold text-left">
                                <th className="p-2 border border-slate-300">Início</th>
                                <th className="p-2 border border-slate-300">Fim</th>
                                <th className="p-2 border border-slate-300">Motivo</th>
                                <th className="p-2 border border-slate-300 text-right">Duração</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
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
                                .slice(-5) // Show last 5 events
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
                                                        : <span className="text-amber-500 text-xs animate-pulse">EM ANDAMENTO</span>
                                                    )
                                                }
                                            </td>
                                            <td className="p-2 border border-slate-300 italic text-slate-700 uppercase font-bold text-xs">
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
                                    <td colSpan={4} className="p-4 text-center text-slate-400 text-sm italic">
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