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
    now: Date;
}

const MachineStatusView: React.FC<MachineStatusViewProps> = ({ machineType, activeOrder, stock, now }) => {

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem em produção', since: now.toISOString(), durationMs: 0 };
        }

        const lastEvent = activeOrder.downtimeEvents?.[(activeOrder.downtimeEvents.length || 0) - 1];

        if (lastEvent?.resumeTime === null) {
            // Check for both exact match and trimmed match to be safe
            const reason = (lastEvent.reason || '').trim();
            if (reason === 'Final de Turno') {
                return { status: 'Desligada', reason: 'Final de Turno', since: lastEvent.stopTime, durationMs: 0 };
            }
            const durationMs = now.getTime() - new Date(lastEvent.stopTime).getTime();
            return { status: 'Parada', reason: lastEvent.reason, since: lastEvent.stopTime, durationMs };
        } else {
            const since = lastEvent?.resumeTime || activeOrder.startTime || now.toISOString();
            const durationMs = now.getTime() - new Date(since).getTime();
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
                <h3 className="font-semibold text-slate-700 mb-2">Linha do Tempo Recente</h3>
                <div className="max-h-48 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {timelineEvents.slice(0, 10).map((event, index) => (
                        <div key={index} className="flex gap-2 text-xs">
                            <div className={`w-3 h-3 mt-0.5 rounded-full flex-shrink-0 ${event.type === 'stop' ? 'bg-red-500' : 'bg-blue-400'}`}></div>
                            <div>
                                <span className="font-mono text-slate-500 mr-2">{new Date(event.timestamp).toLocaleTimeString('pt-BR')}</span>
                                <span className="font-semibold text-slate-800">{event.message}</span>
                                {event.details && <span className="text-slate-600">: {event.details}</span>}
                            </div>
                        </div>
                    ))}
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
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

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
                    now={now}
                />
                <MachineStatusView
                    machineType="Treliça"
                    activeOrder={activeTrelicaOrder}
                    stock={stock}
                    now={now}
                />
            </div>
        </div>
    );
};

export default ProductionDashboard;