import React, { useMemo, useState, useEffect } from 'react';
import { ProductionOrderData, DowntimeConfig } from '../types';
import { CogIcon, PauseIcon, CheckCircleIcon, PlayIcon, ClipboardListIcon, ClockIcon } from './icons';

interface DesbobinadeiraDashboardProps {
    productionOrders: ProductionOrderData[];
}

const DesbobinadeiraDashboard: React.FC<DesbobinadeiraDashboardProps> = ({ productionOrders }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Identificar a ordem ativa (em andamento)
    const activeOrder = useMemo(() => {
        return productionOrders.find(o => o.machine.startsWith('Desbobinadeira') && o.status === 'in_progress');
    }, [productionOrders]);

    const machineStatus = useMemo(() => {
        if (!activeOrder) {
            return { status: 'Ocioso', reason: 'Nenhuma ordem ativa', durationMs: 0 };
        }
        
        const nowMs = now.getTime();
        const events = (activeOrder.downtimeEvents || []) as any[];
        
        // Verifica se há parada em aberto
        const openEvent = [...events]
            .sort((a, b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
            .find(e => !e.resumeTime);

        if (openEvent) {
            const reason = openEvent.reason || 'Parada';
            const stopMs = new Date(openEvent.stopTime).getTime();
            const dur = stopMs > 0 ? Math.max(0, nowMs - stopMs) : 0;
            return { status: 'Parada', reason, durationMs: dur };
        }

        const osProgress = (activeOrder as any).osProgress;
        if (osProgress && osProgress.currentOs) {
            const startMs = new Date(osProgress.startTime).getTime();
            return { status: 'Produzindo', reason: '', durationMs: Math.max(0, nowMs - startMs) };
        }
        
        return { status: 'Preparacao', reason: 'Aguardando Início de OS', durationMs: 0 };
    }, [activeOrder, now]);

    const [showAllOs, setShowAllOs] = useState(false);

    const stats = useMemo(() => {
        let feitas = 0;
        let fazendo = 0;
        let pendentes = 0;
        let tempoLigada = 0;
        let tempoParada = 0;

        if (activeOrder) {
            const osProgress = (activeOrder as any).osProgress;
            const osItems = (activeOrder as any).osItems || [];

            if (osProgress) {
                const logs = osProgress.logs || [];
                feitas += logs.length;
                tempoLigada += logs.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0);

                if (osProgress.currentOs && osProgress.startTime) {
                    fazendo += 1;
                    const startMs = new Date(osProgress.startTime).getTime();
                    const partialSeconds = Math.floor((now.getTime() - startMs) / 1000);
                    tempoLigada += Math.max(0, partialSeconds);
                }
            }

            const totalItems = osItems.length;
            const pendentesOrdem = Math.max(0, totalItems - (osProgress?.logs?.length || 0) - (osProgress?.currentOs ? 1 : 0));
            pendentes += pendentesOrdem;

            const downtimeEvents = activeOrder.downtimeEvents || [];
            downtimeEvents.forEach(event => {
                const stopMs = new Date(event.stopTime).getTime();
                const resumeMs = event.resumeTime ? new Date(event.resumeTime).getTime() : now.getTime();
                const durationSeconds = Math.floor((resumeMs - stopMs) / 1000);
                tempoParada += durationSeconds;
            });
        }

        return { feitas, fazendo, pendentes, tempoLigada, tempoParada };
    }, [activeOrder, now]);

    const formatTime = (seconds: number) => {
        if (seconds < 0) seconds = 0;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isStopped = machineStatus.status === 'Parada';
    const isProducing = machineStatus.status === 'Produzindo';

    const headerStyle = isStopped
        ? 'bg-gradient-to-r from-rose-900/50 to-rose-950 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
        : isProducing
        ? 'bg-gradient-to-r from-emerald-900/50 to-emerald-950 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
        : 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-600';

    const textGlow = isStopped ? 'neon-text-red text-rose-400' : isProducing ? 'neon-text-green text-emerald-400' : 'text-slate-300';
    
    // Lista de OS da ordem ativa
    const activeOsItems = (activeOrder as any)?.osItems || [];
    const osProgress = (activeOrder as any)?.osProgress;
    const completedLogs = osProgress?.logs || [];
    
    const visibleOsItems = useMemo(() => {
        if (showAllOs) return activeOsItems;
        if (!osProgress?.currentOs) return [];
        return activeOsItems.filter((item: any, idx: number) => {
            const osName = item.os || `OS ${idx + 1}`;
            return osProgress.currentOs === osName;
        });
    }, [activeOsItems, osProgress, showAllOs]);

    return (
        <div className="flex flex-col h-full bg-[#060B18] text-white overflow-hidden p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 h-full">
                
                {/* Header Dinâmico de Status */}
                <div className={`rounded-3xl border ${headerStyle} p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-500 relative overflow-hidden`}>
                    {isStopped && <div className="absolute inset-0 bg-rose-500/10 animate-stop-flash pointer-events-none" />}
                    {isProducing && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />}

                    <div className="flex items-center gap-6 relative z-10">
                        <div className={`p-4 rounded-2xl bg-black/40 border ${isStopped ? 'border-rose-500/50' : isProducing ? 'border-emerald-500/50' : 'border-slate-500/50'}`}>
                            {isStopped ? (
                                <PauseIcon className={`w-10 h-10 ${textGlow} animate-pulse`} />
                            ) : isProducing ? (
                                <CogIcon className={`w-10 h-10 ${textGlow} animate-spin-slow`} />
                            ) : (
                                <PlayIcon className="w-10 h-10 text-slate-400" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">
                                DESBOBINADEIRA
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-md bg-black/40 border border-white/10 ${textGlow}`}>
                                    {isStopped ? 'MÁQUINA PARADA' : isProducing ? 'EM OPERAÇÃO' : 'OCIOSO / PREPARAÇÃO'}
                                </span>
                                {activeOrder && (
                                    <span className="text-sm font-bold text-slate-400">
                                        Ordem: {activeOrder.orderNumber}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-center sm:text-right relative z-10">
                        {isStopped ? (
                            <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl px-6 py-3 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                                <span className="text-[10px] font-black uppercase text-rose-300 tracking-widest block mb-1">Motivo: {machineStatus.reason}</span>
                                <span className="text-4xl font-black text-rose-500 font-mono tracking-tighter">
                                    {formatTime(machineStatus.durationMs / 1000)}
                                </span>
                            </div>
                        ) : isProducing ? (
                            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-6 py-3">
                                <span className="text-[10px] font-black uppercase text-emerald-400/70 tracking-widest block mb-1">Tempo de OS Atual</span>
                                <span className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                                    {formatTime(machineStatus.durationMs / 1000)}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    
                    {/* Lista de OS (Andamento) */}
                    <div className="lg:col-span-2 bg-[#0A1224] border border-white/5 rounded-3xl p-6 flex flex-col min-h-0 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <ClipboardListIcon className="w-5 h-5" /> Andamento das OS
                            </h2>
                            {activeOsItems.length > 0 && (
                                <button 
                                    onClick={() => setShowAllOs(!showAllOs)}
                                    className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] hover:text-white bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 px-3 py-1.5 rounded-lg transition-all"
                                >
                                    {showAllOs ? 'Ocultar Pendentes/Feitas' : 'Mostrar Todas'}
                                </button>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {!activeOrder ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium italic">
                                    Nenhuma ordem em produção no momento.
                                </div>
                            ) : activeOsItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium italic">
                                    Nenhuma OS cadastrada nesta ordem.
                                </div>
                            ) : visibleOsItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium italic">
                                    Nenhuma OS rodando no momento.
                                </div>
                            ) : (
                                visibleOsItems.map((item: any, idx: number) => {
                                    const osName = item.os || `OS ${activeOsItems.indexOf(item) + 1}`;
                                    const isCurrent = osProgress?.currentOs === osName;
                                    const completedLog = completedLogs.find((l: any) => l.os === osName);
                                    const isCompleted = !!completedLog;
                                    
                                    let statusBg = 'bg-white/5 border-white/10';
                                    let statusText = 'Pendente';
                                    let textColor = 'text-slate-400';
                                    let icon = <span className="w-2 h-2 rounded-full bg-slate-600" />;

                                    if (isCurrent) {
                                        statusBg = 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]';
                                        statusText = 'Rodando';
                                        textColor = 'text-indigo-400 neon-text-cyan font-bold';
                                        icon = <PlayIcon className="w-4 h-4 text-indigo-400 animate-pulse" />;
                                    } else if (isCompleted) {
                                        statusBg = 'bg-emerald-500/10 border-emerald-500/30';
                                        statusText = `Feita (${formatTime(completedLog.durationSeconds || 0)})`;
                                        textColor = 'text-emerald-500';
                                        icon = <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
                                    }

                                    return (
                                        <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${statusBg}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 flex justify-center">{icon}</div>
                                                    <h3 className={`text-xl font-black ${isCurrent ? 'text-white' : isCompleted ? 'text-emerald-50' : 'text-slate-300'}`}>
                                                        {osName}
                                                    </h3>
                                                </div>
                                                <div className={`text-sm tracking-wider uppercase ${textColor}`}>
                                                    {statusText}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-11">
                                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Quantidade</span>
                                                    <span className="text-sm font-black text-slate-200">{item.quantidade || '-'} <span className="text-[10px] text-slate-500">pçs</span></span>
                                                </div>
                                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Bitola</span>
                                                    <span className="text-sm font-black text-slate-200">{item.bitola || '-'} <span className="text-[10px] text-slate-500">mm</span></span>
                                                </div>
                                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Comprimento</span>
                                                    <span className="text-sm font-black text-slate-200">{item.length || item.comprimento || '-'} <span className="text-[10px] text-slate-500">m</span></span>
                                                </div>
                                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Formato</span>
                                                    <span className="text-sm font-black text-slate-200 truncate">{item.drawingType || item.formato || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Resumo/Métricas */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#0A1224] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">OS Feitas</h3>
                                <div className="text-3xl font-black text-emerald-500">{stats.feitas}</div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                            </div>
                        </div>

                        <div className="bg-[#0A1224] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Em Andamento</h3>
                                <div className="text-3xl font-black text-indigo-400">{stats.fazendo}</div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <PlayIcon className="w-6 h-6 text-indigo-400" />
                            </div>
                        </div>

                        <div className="bg-[#0A1224] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pendentes</h3>
                                <div className="text-3xl font-black text-amber-500">{stats.pendentes}</div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <ClipboardListIcon className="w-6 h-6 text-amber-500" />
                            </div>
                        </div>

                        <div className="bg-[#0A1224] border border-white/5 rounded-3xl p-5 shadow-lg mt-auto">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Totais de Máquina</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1 font-bold">
                                        <span className="text-slate-400">Tempo Ligada</span>
                                        <span className="text-blue-400 font-mono">{formatTime(stats.tempoLigada)}</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 w-full" />
                                    </div>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between text-xs mb-1 font-bold">
                                        <span className="text-slate-400">Tempo Parada</span>
                                        <span className="text-rose-400 font-mono">{formatTime(stats.tempoParada)}</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500 w-full opacity-70" />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default DesbobinadeiraDashboard;
