import React, { useState, useMemo, useEffect } from 'react';
import type { ProductionOrderData, StockItem, ProcessedLot } from '../types';
import {
    ScaleIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationIcon,
    ArrowPathIcon as RefreshIcon,
    SearchIcon
} from './icons';

interface TrefilaWeighingProps {
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
    recordLotWeight: (orderId: string, lotId: string, finalWeight: number, measuredGauge?: number) => void;
}

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const TrefilaWeighing: React.FC<TrefilaWeighingProps> = ({ productionOrders, stock, recordLotWeight }) => {
    const [pendingWeights, setPendingWeights] = useState<Map<string, string>>(new Map());
    const [now, setNow] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const activeTrefilaOrders = useMemo(() => {
        return productionOrders.filter(o => o.machine === 'Trefila' && o.status === 'in_progress');
    }, [productionOrders]);

    const lotsToWeigh = useMemo(() => {
        const list: { orderId: string, orderNumber: string, lot: ProcessedLot, lotInfo?: StockItem }[] = [];

        activeTrefilaOrders.forEach(order => {
            (order.processedLots || []).forEach(pLot => {
                if (pLot.finalWeight === null) {
                    const lotInfo = stock.find(s => s.id === pLot.lotId);
                    list.push({
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        lot: pLot,
                        lotInfo
                    });
                }
            });
        });

        // Sort by endTime (oldest first)
        return list.sort((a, b) => new Date(a.lot.endTime).getTime() - new Date(b.lot.endTime).getTime())
            .filter(item =>
                item.lotInfo?.internalLot.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [activeTrefilaOrders, stock, searchTerm]);

    const handleWeightChange = (lotId: string, value: string) => {
        setPendingWeights(prev => new Map(prev).set(lotId, value));
    };

    const handleSaveWeight = (orderId: string, lotId: string) => {
        const weightStr = pendingWeights.get(lotId);
        if (weightStr) {
            const weight = parseFloat(weightStr.replace(',', '.'));
            if (!isNaN(weight) && weight > 0) {
                // We keep the existing gauge if any, but usually at this stage it might be null
                // The recordLotWeight function in App.tsx handles merging
                recordLotWeight(orderId, lotId, weight);
                setPendingWeights(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ScaleIcon className="h-10 w-10 text-indigo-600" />
                        PESAGEM DE ROLOS
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Interface dedicada ao Auxiliar de Produção</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-slate-600">Sincronizado em Tempo Real</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Search and Filters */}
                <div className="lg:col-span-3">
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por lote ou ordem de produção..."
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                            Aguardando Pesagem
                            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">{lotsToWeigh.length}</span>
                        </h2>
                    </div>

                    {lotsToWeigh.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {lotsToWeigh.map((item) => {
                                const waitingMs = now.getTime() - new Date(item.lot.endTime).getTime();
                                const isCritical = waitingMs > 15 * 60 * 1000; // More than 15 min

                                return (
                                    <div key={item.lot.lotId} className="bg-white border-2 border-slate-100 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden group">
                                        {isCritical && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}

                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-2xl font-black text-slate-800">{item.lotInfo?.internalLot || 'N/A'}</h3>
                                                    {isCritical && <ExclamationIcon className="h-5 w-5 text-red-500 animate-bounce" />}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">OP: {item.orderNumber}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-black uppercase block leading-none ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
                                                    Aguardando
                                                </span>
                                                <span className={`text-sm font-mono font-bold ${isCritical ? 'text-red-600' : 'text-slate-500'}`}>
                                                    {formatDuration(waitingMs)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Entrada</p>
                                                <p className="text-lg font-bold text-slate-700">{item.lotInfo?.labelWeight.toFixed(1)} kg</p>
                                            </div>
                                            <div className="h-8 w-[1px] bg-slate-200" />
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bitola Aferida</p>
                                                <p className="text-lg font-bold text-indigo-600">
                                                    {item.lot.measuredGauge != null ? `${item.lot.measuredGauge.toFixed(2)} mm` : '---'}
                                                </p>
                                            </div>
                                            <div className="h-8 w-[1px] bg-slate-200" />
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Finalizado às</p>
                                                <p className="text-sm font-bold text-slate-600">{new Date(item.lot.endTime).toLocaleTimeString('pt-BR')}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">Peso de Saída (KG)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.0"
                                                    className="flex-1 min-w-0 p-4 bg-white border-2 border-slate-100 rounded-2xl text-center text-xl font-black focus:border-indigo-500 outline-none transition-all shadow-inner"
                                                    value={pendingWeights.get(item.lot.lotId) || ''}
                                                    onChange={(e) => handleWeightChange(item.lot.lotId, e.target.value)}
                                                />
                                                <button
                                                    onClick={() => handleSaveWeight(item.orderId, item.lot.lotId)}
                                                    className="bg-emerald-500 text-white px-6 py-4 rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
                                                    title="Salvar Pesagem"
                                                >
                                                    <CheckCircleIcon className="h-6 w-6 text-white" />
                                                    <span className="font-black">OK</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center">
                            <div className="bg-slate-50 p-6 rounded-full w-fit mx-auto mb-6">
                                <CheckCircleIcon className="h-16 w-16 text-slate-200" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-700">Tudo em dia!</h3>
                            <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">Não há novos rolos aguardando pesagem no momento.</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-indigo-900 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <ClockIcon className="h-6 w-6 text-indigo-300" />
                            Ordens Ativas
                        </h3>
                        <div className="space-y-4">
                            {activeTrefilaOrders.map(order => (
                                <div key={order.id} className="bg-white/10 p-4 rounded-2xl border border-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">OP #{order.orderNumber}</span>
                                        <span className="bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">{order.targetBitola}mm</span>
                                    </div>
                                    <p className="text-sm font-medium text-indigo-50">Lotes processados: {(order.processedLots || []).length}</p>
                                    <div className="mt-3 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-indigo-400 h-full transition-all duration-1000"
                                            style={{ width: `${((order.processedLots || []).filter(l => l.finalWeight !== null).length / (order.processedLots || []).length || 0) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {activeTrefilaOrders.length === 0 && (
                                <p className="text-indigo-300 text-sm italic py-4">Nenhuma ordem em andamento na trefila.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <RefreshIcon className="h-5 w-5 text-slate-400" />
                            Últimas Pesagens
                        </h3>
                        <div className="space-y-3">
                            {activeTrefilaOrders.flatMap(o => o.processedLots || [])
                                .filter(l => l.finalWeight !== null)
                                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
                                .slice(0, 5)
                                .map((lot, idx) => {
                                    const lotInfo = stock.find(s => s.id === lot.lotId);
                                    return (
                                        <div key={idx} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{lotInfo?.internalLot}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(lot.endTime).toLocaleTimeString('pt-BR')}</span>
                                            </div>
                                            <span className="font-black text-indigo-600 text-sm">{lot.finalWeight?.toFixed(1)} kg</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrefilaWeighing;
