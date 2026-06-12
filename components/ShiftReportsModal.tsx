import React, { useState, useMemo } from 'react';
import type { ShiftReport, StockItem } from '../types';
import { PrinterIcon, DocumentReportIcon, ArchiveIcon, WarningIcon, TrashIcon, ChartBarIcon, PencilIcon } from './icons';
import { trelicaModels } from './ProductionOrderTrelica';

export const EditShiftReportModal: React.FC<{
    report: ShiftReport;
    onClose: () => void;
    onSave: (reportId: string, updates: Partial<ShiftReport>) => Promise<void>;
}> = ({ report, onClose, onSave }) => {
    const [quantity, setQuantity] = useState(report.totalProducedQuantity || 0);
    const [weight, setWeight] = useState(report.totalProducedWeight || 0);
    const [meters, setMeters] = useState(report.totalProducedMeters || 0);
    const [scrap, setScrap] = useState(report.totalScrapWeight || 0);
    const [isSaving, setIsSaving] = useState(false);

    const handleQuantityChange = (val: number) => {
        setQuantity(val);
        
        // Se a máquina for Treliça, calcula automaticamente metros e peso teórico correspondente
        if (report.machine?.toLowerCase().startsWith('treliça') || report.machine?.toLowerCase().startsWith('trelica')) {
            const tamanhoNum = parseFloat(report.tamanho || '6') || 6;
            setMeters(val * tamanhoNum);

            const modelInfo = trelicaModels.find(m => m.modelo === report.trelicaModel);
            if (modelInfo) {
                const theoreticalPieceWeight = parseFloat(modelInfo.pesoFinal.replace(',', '.'));
                setWeight(val * theoreticalPieceWeight);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(report.id, {
                totalProducedQuantity: quantity,
                totalProducedWeight: weight,
                totalProducedMeters: meters,
                totalScrapWeight: scrap,
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar ajustes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[130] p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 transform scale-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                        <PencilIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Ajuste de Turno</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Acesso Restrito: Gestor</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Qtd. Peças</label>
                            <input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Peso Total (kg)</label>
                            <input
                                type="number"
                                step="any"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Metros</label>
                            <input
                                type="number"
                                step="any"
                                value={meters}
                                onChange={(e) => setMeters(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Sucata (kg)</label>
                            <input
                                type="number"
                                step="any"
                                value={scrap}
                                onChange={(e) => setScrap(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors uppercase text-sm tracking-widest"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3 rounded-xl font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-lg shadow-rose-200 uppercase text-sm tracking-widest"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Ajuste'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ShiftDetails: React.FC<{ report: ShiftReport, stock: StockItem[], onPrint: (report: ShiftReport) => void }> = ({ report, stock, onPrint }) => {
    const { totalDuration, productiveTime, totalDowntime, productivePercentage, downtimePercentage } = useMemo(() => {
        const shiftStart = new Date(report.shiftStartTime).getTime();
        const shiftEnd = new Date(report.shiftEndTime).getTime();
        const totalDuration = shiftEnd - shiftStart;

        const totalDowntime = report.downtimeEvents.reduce((acc, event) => {
            const stop = new Date(event.stopTime).getTime();
            const resume = event.resumeTime ? new Date(event.resumeTime).getTime() : shiftEnd;

            const effectiveStart = Math.max(stop, shiftStart);
            const effectiveEnd = Math.min(resume, shiftEnd);

            if (effectiveEnd > effectiveStart) {
                return acc + (effectiveEnd - effectiveStart);
            }
            return acc;
        }, 0);

        const productiveTime = totalDuration > totalDowntime ? totalDuration - totalDowntime : 0;
        const productivePercentage = totalDuration > 0 ? (productiveTime / totalDuration) * 100 : 0;
        const downtimePercentage = totalDuration > 0 ? (totalDowntime / totalDuration) * 100 : 0;

        return { totalDuration, productiveTime, totalDowntime, productivePercentage, downtimePercentage };
    }, [report]);

    const sortedDowntimeEvents = useMemo(() =>
        [...report.downtimeEvents].sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime()),
        [report.downtimeEvents]);

    return (
        <td colSpan={10} className="p-0 border-b-2 border-slate-200 animate-slide-up">
            <div className="bg-gradient-to-br from-slate-50 to-white p-8 shadow-inner no-print border-x-8 border-indigo-50/50">
                <div className="flex border-b border-slate-200 pb-6 mb-8 justify-between items-center">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform">
                            <DocumentReportIcon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 text-xl tracking-tight">Análise Executiva do Turno</h4>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Performance e Eventos Detalhados
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onPrint(report)}
                        className="group relative overflow-hidden bg-[#0A2A3D] hover:bg-[#1A5A7D] text-white font-black py-3.5 px-8 rounded-2xl transition-all shadow-xl shadow-slate-200 flex items-center gap-3 active:scale-95 border-b-4 border-[#020F18]"
                    >
                        <PrinterIcon className="h-5 w-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                        <span>IMPRIMIR RELATÓRIO PREMIUM</span>
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 relative z-10">Duração Total</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tighter relative z-10">{formatDuration(totalDuration)}</p>
                    </div>
                    <div className="bg-emerald-50 p-6 rounded-[2rem] shadow-sm border border-emerald-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1 relative z-10">Tempo Efetivo</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-2xl font-black text-emerald-700 tracking-tighter">{formatDuration(productiveTime)}</span>
                            <span className="text-[10px] font-black text-emerald-500 bg-white px-2 py-1 rounded-full border border-emerald-100 shadow-sm">{productivePercentage.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-[2rem] shadow-sm border border-rose-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-rose-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-[10px] text-rose-600 font-black uppercase tracking-widest mb-1 relative z-10">Tempo Inativo</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-2xl font-black text-rose-700 tracking-tighter">{formatDuration(totalDowntime)}</span>
                            <span className="text-[10px] font-black text-rose-500 bg-white px-2 py-1 rounded-full border border-rose-100 shadow-sm">{downtimePercentage.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="bg-indigo-50 p-6 rounded-[2rem] shadow-sm border border-indigo-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-1 relative z-10">Produção Líquida</p>
                        <p className="text-2xl font-black text-indigo-900 tracking-tighter relative z-10">{report.totalProducedWeight.toFixed(1)} <small className="text-xs font-bold">kg</small></p>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-[2rem] shadow-sm border border-amber-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                        <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1 relative z-10">Sucata Registrada</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-2xl font-black text-amber-900 tracking-tighter">{report.totalScrapWeight.toFixed(1)} <small className="text-xs font-bold">kg</small></span>
                            <span className="text-[10px] font-black text-amber-600 bg-white px-2 py-1 rounded-full border border-amber-100 shadow-sm">{report.scrapPercentage.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <ArchiveIcon className="w-5 h-5 text-indigo-500" />
                                Lotes Processados
                            </h4>
                            <span className="bg-white text-slate-500 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200 uppercase">{report.processedLots.length} ITENS</span>
                        </div>
                        <div className="overflow-x-auto max-h-80 custom-scrollbar">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[#0A2A3D] text-white sticky top-0">
                                    <tr>
                                        <th className="p-4 font-bold border-none uppercase tracking-widest text-[9px]">Identificação</th>
                                        <th className="p-4 font-bold border-none text-right uppercase tracking-widest text-[9px]">Peso</th>
                                        <th className="p-4 font-bold border-none text-center uppercase tracking-widest text-[9px]">Período</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {report.processedLots.map(lot => {
                                        const stockInfo = stock.find(s => s.id === lot.lotId);
                                        return (
                                            <tr key={lot.lotId} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <span className="font-black text-slate-800">{stockInfo?.internalLot || 'N/A'}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-emerald-600">{lot.finalWeight?.toFixed(2) || '0.00'} kg</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="text-slate-500 font-medium">
                                                        {new Date(lot.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="mx-1 text-slate-300">→</span>
                                                        {new Date(lot.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {report.processedLots.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-10 text-center text-slate-400 italic font-medium">Nenhum lote processado neste turno.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <WarningIcon className="w-5 h-5 text-amber-500" />
                                Histórico de Paradas
                            </h4>
                            <span className="bg-white text-slate-500 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200 uppercase">{sortedDowntimeEvents.length} EVENTOS</span>
                        </div>
                        <div className="overflow-x-auto max-h-80 custom-scrollbar">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[#0A2A3D] text-white sticky top-0">
                                    <tr>
                                        <th className="p-4 font-bold border-none uppercase tracking-widest text-[9px]">Motivo</th>
                                        <th className="p-4 font-bold border-none text-right uppercase tracking-widest text-[9px]">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedDowntimeEvents.map((event, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <span className="font-bold text-slate-700">{event.reason}</span>
                                                {event.justification && <div className="text-[10px] text-rose-500 font-bold mt-1">Justificativa: {event.justification}</div>}
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="mx-1">→</span>
                                                    {event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date(report.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '*'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-mono font-black text-rose-500">
                                                    {formatDuration(new Date(event.resumeTime || report.shiftEndTime).getTime() - new Date(event.stopTime).getTime())}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedDowntimeEvents.length === 0 && (
                                        <tr>
                                            <td colSpan={2} className="p-10 text-center text-slate-400 italic font-medium">Nenhuma parada registrada.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </td>
    );
};

// SVG Icon Components for ShiftReportPrintView
const CalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ClipboardIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const UserIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const GaugeIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 12 l5 -5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M6 12 a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" />
    </svg>
);

const ClockIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LayersIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const RulerIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="8" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="6" y1="8" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
        <line x1="9" y1="8" x2="9" y2="11" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="8" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" />
        <line x1="18" y1="8" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

export const ShiftReportPrintView: React.FC<{ report: ShiftReport, stock: StockItem[], allReports?: ShiftReport[] }> = ({ report, stock, allReports }) => {
    // 1. Helpers de Formatação e Data
    const dateStr = useMemo(() => {
        if (report.date) return report.date.split(' ')[0];
        if (report.shiftStartTime) return new Date(report.shiftStartTime).toISOString().split('T')[0];
        return new Date().toISOString().split('T')[0];
    }, [report]);

    const dateObj = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr]);
    const formattedDateNumbers = useMemo(() => dateObj.toLocaleDateString('pt-BR'), [dateObj]);
    const formattedDayOfWeek = useMemo(() => {
        const days = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        return days[dateObj.getDay()];
    }, [dateObj]);

    const isTrelica = useMemo(() => {
        const m = (report.machine || '').toLowerCase();
        return m.startsWith('treliça') || m.startsWith('trelica');
    }, [report]);

    const machineName = report.machine || (isTrelica ? 'Treliça 1' : 'Trefila');

    // 2. Filtro dos relatórios do mesmo dia e mesma categoria de máquina para agrupar Turno A e B (para Treliça)
    const sameDayReports = useMemo(() => {
        if (!allReports) return [report];
        return allReports.filter(r => {
            const rDate = r.date?.split(' ')[0] || (r.shiftStartTime ? new Date(r.shiftStartTime).toISOString().split('T')[0] : '');
            const rMachineCategory = r.machine?.toLowerCase().startsWith('trefila') ? 'Trefila' : 'Treliça';
            const currentMachineCategory = report.machine?.toLowerCase().startsWith('trefila') ? 'Trefila' : 'Treliça';
            return rDate === dateStr && rMachineCategory === currentMachineCategory;
        }).sort((a, b) => new Date(a.shiftStartTime || '').getTime() - new Date(b.shiftStartTime || '').getTime());
    }, [allReports, report, dateStr]);

    // Turno A e Turno B
    const reportA = sameDayReports[0] || report;
    const reportB = sameDayReports[1] || null;

    const secondsToTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0 || isNaN(totalSeconds)) return '00:00:00';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    // Estatísticas da Treliça (Turno A e B)
    const getShiftStats = (r?: ShiftReport | null) => {
        if (!r) {
            return {
                operator: '—',
                horasTrabalhadas: '09:00:00',
                tempoParado: '00:00:00',
                percentParado: '0,0',
                tempoEfetivo: '09:00:00',
                percentEfetivo: '100,0',
                pecas: 0,
                tamanho: 6,
                metros: 0,
                tempoPorPeca: '00:00:00',
                velocidade: '0,0',
                stops: [],
            };
        }

        const shiftStart = new Date(r.shiftStartTime || '').getTime();
        const shiftEnd = new Date(r.shiftEndTime || '').getTime();
        const totalDuration = isNaN(shiftStart) || isNaN(shiftEnd) ? (9 * 3600 * 1000) : (shiftEnd - shiftStart);
        
        const totalDowntime = (r.downtimeEvents || []).reduce((acc, event) => {
            const stop = new Date(event.stopTime).getTime();
            const resume = event.resumeTime ? new Date(event.resumeTime).getTime() : (isNaN(shiftEnd) ? stop : shiftEnd);
            const effectiveStart = isNaN(shiftStart) ? stop : Math.max(stop, shiftStart);
            const effectiveEnd = isNaN(shiftEnd) ? resume : Math.min(resume, shiftEnd);
            return effectiveEnd > effectiveStart ? acc + (effectiveEnd - effectiveStart) : acc;
        }, 0);
        
        const productiveTime = Math.max(0, totalDuration - totalDowntime);
        const productivePercentage = totalDuration > 0 ? (productiveTime / totalDuration) * 100 : 100;
        const downtimePercentage = totalDuration > 0 ? (totalDowntime / totalDuration) * 100 : 0;
        
        const size = parseFloat(r.tamanho || '6') || 6;
        const pecas = r.totalProducedQuantity || (r.totalProducedMeters ? (r.totalProducedMeters / size) : 0);
        const metros = pecas * size;
        
        const timePerPieceMs = pecas > 0 ? productiveTime / pecas : 0;
        const speedMpm = productiveTime > 0 ? metros / (productiveTime / 60000) : 0;

        const formatDurationLocal = (ms: number) => {
            if (ms < 0) ms = 0;
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        const mappedStops = (r.downtimeEvents || []).map((event, i) => {
            const stopMs = new Date(event.stopTime).getTime();
            const resumeMs = event.resumeTime ? new Date(event.resumeTime).getTime() : (isNaN(shiftEnd) ? stopMs : shiftEnd);
            const dur = Math.max(0, resumeMs - stopMs);
            
            const formatTime = (dateStr: string) => {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };

            return {
                id: event.id || String(i),
                inicio: formatTime(event.stopTime),
                fim: event.resumeTime ? formatTime(event.resumeTime) : formatTime(r.shiftEndTime || ''),
                motivo: event.reason,
                duracaoStr: formatDurationLocal(dur)
            };
        }).sort((a, b) => a.inicio.localeCompare(b.inicio));

        return {
            operator: r.operator || '—',
            horasTrabalhadas: formatDurationLocal(totalDuration),
            tempoParado: formatDurationLocal(totalDowntime),
            percentParado: downtimePercentage.toFixed(1).replace('.', ','),
            tempoEfetivo: formatDurationLocal(productiveTime),
            percentEfetivo: productivePercentage.toFixed(1).replace('.', ','),
            pecas,
            tamanho: size,
            metros,
            tempoPorPeca: formatDurationLocal(timePerPieceMs),
            velocidade: speedMpm.toFixed(1).replace('.', ','),
            stops: mappedStops,
        };
    };

    // Estatísticas da Trefila
    const getTrefilaStats = (r: ShiftReport) => {
        const shiftStart = new Date(r.shiftStartTime || '').getTime();
        const shiftEnd = new Date(r.shiftEndTime || '').getTime();
        const totalDuration = isNaN(shiftStart) || isNaN(shiftEnd) ? (9 * 3600 * 1000) : (shiftEnd - shiftStart);
        
        const totalDowntime = (r.downtimeEvents || []).reduce((acc, event) => {
            const stop = new Date(event.stopTime).getTime();
            const resume = event.resumeTime ? new Date(event.resumeTime).getTime() : (isNaN(shiftEnd) ? stop : shiftEnd);
            const effectiveStart = isNaN(shiftStart) ? stop : Math.max(stop, shiftStart);
            const effectiveEnd = isNaN(shiftEnd) ? resume : Math.min(resume, shiftEnd);
            return effectiveEnd > effectiveStart ? acc + (effectiveEnd - effectiveStart) : acc;
        }, 0);
        
        const productiveTime = Math.max(0, totalDuration - totalDowntime);
        const productivePercentage = totalDuration > 0 ? (productiveTime / totalDuration) * 100 : 100;
        const downtimePercentage = totalDuration > 0 ? (totalDowntime / totalDuration) * 100 : 0;

        const totalProducedWeight = r.totalProducedWeight || 0;
        const totalScrapWeight = r.totalScrapWeight || 0;
        const totalInputWeight = totalProducedWeight + totalScrapWeight;
        const scrapPercentage = totalInputWeight > 0 ? (totalScrapWeight / totalInputWeight) * 100 : 0;

        const bitolaNum = parseFloat(r.targetBitola || '6') || 6;
        const area = Math.PI * Math.pow(bitolaNum / 2000, 2);
        const density = 7850;
        const weightPerMeter = area * density;
        const totalMeters = weightPerMeter > 0 ? (totalProducedWeight / weightPerMeter) : 0;
        const speedMps = productiveTime > 0 ? (totalMeters / (productiveTime / 1000)) : 0;
        const speedMpm = speedMps * 60;

        const formatDurationLocal = (ms: number) => {
            if (ms < 0) ms = 0;
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        const mappedStops = (r.downtimeEvents || []).map((event, i) => {
            const stopMs = new Date(event.stopTime).getTime();
            const resumeMs = event.resumeTime ? new Date(event.resumeTime).getTime() : (isNaN(shiftEnd) ? stopMs : shiftEnd);
            const dur = Math.max(0, resumeMs - stopMs);

            const formatTime = (dateStr: string) => {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };

            return {
                id: event.id || String(i),
                inicio: formatTime(event.stopTime),
                fim: event.resumeTime ? formatTime(event.resumeTime) : formatTime(r.shiftEndTime || ''),
                motivo: event.reason,
                duracaoStr: formatDurationLocal(dur)
            };
        }).sort((a, b) => a.inicio.localeCompare(b.inicio));

        return {
            operator: r.operator || '—',
            horasTrabalhadas: formatDurationLocal(totalDuration),
            tempoParado: formatDurationLocal(totalDowntime),
            percentParado: downtimePercentage.toFixed(1).replace('.', ','),
            tempoEfetivo: formatDurationLocal(productiveTime),
            percentEfetivo: productivePercentage.toFixed(1).replace('.', ','),
            pesoEntrada: totalInputWeight,
            pesoSaida: totalProducedWeight,
            sucata: totalScrapWeight,
            percentSucata: scrapPercentage.toFixed(1).replace('.', ','),
            metros: totalMeters,
            velocidadeMs: speedMps,
            velocidadeMin: speedMpm,
            stops: mappedStops,
        };
    };

    // Histórico de produção (pesagens) para a Ordem
    const productionHistory = useMemo(() => {
        const allSourceReports = allReports || [report];
        const uniqueReports = Array.from(new Map(allSourceReports.map(item => [item.id, item])).values()) as ShiftReport[];

        return uniqueReports
            .filter(r => r.orderNumber === report.orderNumber && (isTrelica ? !r.machine?.toLowerCase().startsWith('trefila') : r.machine?.toLowerCase().startsWith('trefila')))
            .sort((a, b) => new Date(a.shiftStartTime || a.date || '').getTime() - new Date(b.shiftStartTime || b.date || '').getTime());
    }, [allReports, report.orderNumber, isTrelica]);

    const totalsHistory = useMemo(() => {
        let totalQty = 0;
        let totalWeight = 0;

        productionHistory.forEach(r => {
            const size = parseFloat(r.tamanho || '6') || 6;
            const q = r.totalProducedQuantity || (r.totalProducedMeters ? (r.totalProducedMeters / size) : 0);
            totalQty += q;
            totalWeight += (r.totalProducedWeight || 0);
        });

        const avgWeight = totalQty > 0 ? (totalWeight / totalQty) : 0;

        return {
            totalQty,
            totalWeight,
            avgWeight
        };
    }, [productionHistory]);

    // Estilos comuns para impressão
    const printStyles = `
        .worksheet-container {
            font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
            background: #ffffff;
            color: #1e293b;
        }
        .text-blue-msm {
            color: #002060 !important;
        }
        .bg-blue-msm {
            background-color: #002060 !important;
        }
        .border-blue-msm {
            border-color: #002060 !important;
        }
        @media print {
            @page { size: A4 portrait; margin: 6mm 5mm 6mm 5mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body {
                background: white !important; overflow: visible !important; height: auto !important;
            }
            .print-sheet {
                max-width: 100% !important; width: 100% !important;
                box-shadow: none !important; border-radius: 0 !important;
                border: 2px solid #002060 !important;
            }
            table, thead, tbody, tr, td, th {
                page-break-inside: avoid !important; break-inside: avoid !important;
            }
        }
    `;

    if (isTrelica) {
        const statsA = getShiftStats(reportA);
        const statsB = getShiftStats(reportB);
        const totalPecasProduzidas = statsA.pecas + statsB.pecas;

        return (
            <div className="bg-white p-4 max-w-5xl mx-auto worksheet-container print-sheet border-2 border-[#002060] rounded-xl overflow-hidden shadow-lg text-slate-800 text-left">
                <style dangerouslySetInnerHTML={{ __html: printStyles }} />
                
                {/* CABEÇALHO */}
                <div className="grid grid-cols-1 md:grid-cols-12 border-b-2 border-[#002060]">
                    <div className="col-span-3 bg-white p-2.5 flex items-center justify-center border-r-2 border-[#002060]">
                        <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 md:h-20 object-contain" style={{ maxHeight: '82px' }} />
                    </div>

                    <div className="col-span-6 bg-[#002060] text-white p-4 flex flex-col justify-center pl-8 text-left">
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider leading-none text-white">
                            Controle de Produção Diária
                        </h2>
                        <p className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-slate-300 mt-1">
                            Setor Laminação – {machineName}
                        </p>
                    </div>

                    <div className="col-span-3 bg-[#002060] text-white p-3 flex items-center border-l-2 border-white pl-4">
                        <div className="flex items-center gap-2.5">
                            <CalendarIcon className="h-6 w-6 text-white" />
                            <div>
                                <div className="text-[9px] font-black text-slate-300 tracking-wider">DATA DA PRODUÇÃO</div>
                                <div className="text-base font-black text-white leading-tight">{formattedDateNumbers}</div>
                                <div className="text-[10px] font-extrabold text-slate-300 uppercase">{formattedDayOfWeek}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* METADADOS */}
                <div className="grid grid-cols-12 border-b border-slate-200 bg-[#fbfcfd] text-left text-xs">
                    <div className="col-span-4 p-4 flex flex-col justify-between gap-3 border-r border-slate-200">
                        <div className="flex items-start gap-2.5">
                            <ClipboardIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                            <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">ORDEM DE PRODUÇÃO</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{report.orderNumber || '—'}</div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                            <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                            <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO A</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{statsA.operator}</div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-5 p-4 flex flex-col justify-between gap-3 border-r border-slate-200">
                        <div className="flex items-start gap-2.5">
                            <div className="pl-1">
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">TRELIÇA {report.trelicaModel || 'H-12'} {report.tamanho || '6'} MTS</div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                            <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                            <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO B</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{statsB.operator}</div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-3 p-4 flex flex-col justify-center items-center text-center bg-slate-50">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">QUANTIDADE DE PEÇAS PRODUZIDAS</div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-[#002060] tracking-tight">{totalPecasProduzidas.toFixed(0)}</span>
                            <span className="text-sm font-bold text-slate-600">peças</span>
                        </div>
                    </div>
                </div>

                {/* PARADAS DOS TURNOS A E B LADO A LADO */}
                <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-200">
                    {/* Paradas Turno A */}
                    <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left">
                            PARADAS E SEUS MOTIVOS – TURNO A
                        </div>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase">
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Início</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Fim</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '70px' }}>Duração</th>
                                    <th className="py-1.5 text-left pl-3">Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statsA.stops.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                            Nenhuma parada registrada no Turno A.
                                        </td>
                                    </tr>
                                ) : (
                                    statsA.stops.map((stop: any) => (
                                        <tr key={stop.id} className="border-b border-slate-200 text-xs">
                                            <td className="p-1 border-r border-slate-200 text-center text-rose-600 font-black">{stop.inicio}</td>
                                            <td className="p-1 border-r border-slate-200 text-center text-emerald-600 font-black">{stop.fim}</td>
                                            <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600">{stop.duracaoStr}</td>
                                            <td className="p-1 text-left pl-3 font-bold text-slate-800 uppercase">{stop.motivo}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paradas Turno B */}
                    <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left">
                            PARADAS E SEUS MOTIVOS – TURNO B
                        </div>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase">
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Início</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Fim</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '70px' }}>Duração</th>
                                    <th className="py-1.5 text-left pl-3">Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statsB.stops.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                            Nenhuma parada registrada no Turno B.
                                        </td>
                                    </tr>
                                ) : (
                                    statsB.stops.map((stop: any) => (
                                        <tr key={stop.id} className="border-b border-slate-200 text-xs">
                                            <td className="p-1 border-r border-slate-200 text-center text-rose-600 font-black">{stop.inicio}</td>
                                            <td className="p-1 border-r border-slate-200 text-center text-emerald-600 font-black">{stop.fim}</td>
                                            <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600">{stop.duracaoStr}</td>
                                            <td className="p-1 text-left pl-3 font-bold text-slate-800 uppercase">{stop.motivo}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ESTATÍSTICA DO DIA LADO A LADO */}
                <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-200 bg-[#fbfcfd]">
                    {/* Estatísticas Turno A */}
                    <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left flex items-center gap-1.5">
                            <GaugeIcon className="h-4 w-4 text-white" />
                            <span>ESTATÍSTICA DO DIA – TURNO A</span>
                        </div>
                        <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full text-xs">
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Horas (Turno trabalhado)</span>
                                </div>
                                <span className="font-black text-slate-950">{statsA.horasTrabalhadas}</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5 bg-rose-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-rose-500" />
                                    <span className="font-black text-rose-600 uppercase">Tempo de máquina (parada)</span>
                                </div>
                                <div className="flex gap-4 font-black text-rose-600">
                                    <span>{statsA.tempoParado}</span>
                                    <span>{statsA.percentParado}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5 bg-emerald-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-emerald-500" />
                                    <span className="font-black text-emerald-600 uppercase">Tempo de máquina (E efetivo)</span>
                                </div>
                                <div className="flex gap-4 font-black text-emerald-600">
                                    <span>{statsA.tempoEfetivo}</span>
                                    <span>{statsA.percentEfetivo}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <LayersIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Quantidade de peças produzidas</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.pecas.toFixed(0)} <span className="text-[10px] text-slate-500 font-bold">peças de {statsA.tamanho} metros</span></span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <RulerIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Quantidade de metros metros produzidos</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.metros.toFixed(0)} metros</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Tempo por peça (médio)</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.tempoPorPeca}</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <GaugeIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Velocidade (média)</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.velocidade} metros/ minuto</span>
                            </div>
                        </div>
                    </div>

                    {/* Estatísticas Turno B */}
                    <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left flex items-center gap-1.5">
                            <GaugeIcon className="h-4 w-4 text-white" />
                            <span>ESTATÍSTICA DO DIA – TURNO B</span>
                        </div>
                        <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full text-xs">
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Horas (Turno trabalhado)</span>
                                </div>
                                <span className="font-black text-slate-950">{statsB.horasTrabalhadas}</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5 bg-rose-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-rose-500" />
                                    <span className="font-black text-rose-600 uppercase">Tempo de máquina (parada)</span>
                                </div>
                                <div className="flex gap-4 font-black text-rose-600">
                                    <span>{statsB.tempoParado}</span>
                                    <span>{statsB.percentParado}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5 bg-emerald-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-emerald-500" />
                                    <span className="font-black text-emerald-600 uppercase">Tempo de máquina (E efetivo)</span>
                                </div>
                                <div className="flex gap-4 font-black text-emerald-600">
                                    <span>{statsB.tempoEfetivo}</span>
                                    <span>{statsB.percentEfetivo}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <LayersIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Quantidade de peças produzidas</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsB.pecas.toFixed(0)} <span className="text-[10px] text-slate-500 font-bold">peças de {statsB.tamanho} metros</span></span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <RulerIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Quantidade de metros metros produzidos</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsB.metros.toFixed(0)} metros</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Tempo por peça (médio)</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsB.tempoPorPeca}</span>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-2">
                                    <GaugeIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Velocidade (média)</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsB.velocidade} metros/ minuto</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ATUALIZAÇÃO DA PRODUÇÃO */}
                <div className="p-4 bg-white text-left">
                    <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase mb-3 rounded">
                        ATUALIZAÇÃO DA PRODUÇÃO
                    </div>
                    <div className="text-xs font-black text-slate-700 mb-4 pl-1">
                        Quantidade de peças a produzir: <span className="font-black text-[#002060] text-sm tabular-nums">{report.quantityToProduce || reportA?.quantityToProduce || '-'}</span> treliças
                    </div>

                    <table className="w-full border-collapse border-2 border-[#002060] text-xs">
                        <thead>
                            <tr className="border-b-2 border-[#002060] bg-slate-50 font-black text-[#002060] text-center">
                                <th className="p-2 border-r border-[#002060] w-1/4">QNT.</th>
                                <th className="p-2 border-r border-[#002060] w-1/4">PESO (KG)</th>
                                <th className="p-2 border-r border-[#002060] w-1/4">MÉDIA (KG/PEÇA)</th>
                                <th className="p-2 w-1/4">DATA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productionHistory.map((r, i) => {
                                const size = parseFloat(r.tamanho || '6') || 6;
                                const q = r.totalProducedQuantity > 0 ? r.totalProducedQuantity : ((r.totalProducedMeters || 0) / size);
                                const media = q > 0 ? (r.totalProducedWeight || 0) / q : 0;
                                const dateStrFormatted = r.date ? new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

                                return (
                                    <tr key={i} className="border-b border-[#002060] tabular-nums font-bold text-center text-slate-800">
                                        <td className="p-2 border-r border-[#002060]">{q.toFixed(0)}</td>
                                        <td className="p-2 border-r border-[#002060]">{(r.totalProducedWeight || 0).toFixed(0)}</td>
                                        <td className="p-2 border-r border-[#002060]">{media.toFixed(2)}</td>
                                        <td className="p-2">{dateStrFormatted}</td>
                                    </tr>
                                );
                            })}
                            <tr className="border-t-2 border-[#002060] bg-slate-50 font-black tabular-nums text-center text-[#002060]">
                                <td className="p-2.5 border-r border-[#002060]">{totalsHistory.totalQty.toFixed(0)}</td>
                                <td className="p-2.5 border-r border-[#002060]">{totalsHistory.totalWeight.toFixed(0)}</td>
                                <td className="p-2.5 border-r border-[#002060]">{totalsHistory.avgWeight.toFixed(2)}</td>
                                <td className="p-2.5 italic uppercase text-center">TOTAL / MÉDIA</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 text-center border-t border-slate-100 pt-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">MSM Inteligência Operacional — Gerado em {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
        );
    } else {
        // --- LAYOUT TREFILA ---
        const statsA = getTrefilaStats(report);

        return (
            <div className="bg-white p-4 max-w-5xl mx-auto worksheet-container print-sheet border-2 border-[#002060] rounded-xl overflow-hidden shadow-lg text-slate-800 text-left">
                <style dangerouslySetInnerHTML={{ __html: printStyles }} />
                
                {/* CABEÇALHO */}
                <div className="grid grid-cols-1 md:grid-cols-12 border-b-2 border-[#002060]">
                    <div className="col-span-3 bg-white p-2.5 flex items-center justify-center border-r-2 border-[#002060]">
                        <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 md:h-20 object-contain" style={{ maxHeight: '82px' }} />
                    </div>

                    <div className="col-span-6 bg-[#002060] text-white p-4 flex flex-col justify-center pl-8 text-left">
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider leading-none text-white">
                            Controle de Produção Diária
                        </h2>
                        <p className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-slate-300 mt-1">
                            Setor Laminação – Trefila
                        </p>
                    </div>

                    <div className="col-span-3 bg-[#002060] text-white p-3 flex items-center border-l-2 border-white pl-4">
                        <div className="flex items-center gap-2.5">
                            <CalendarIcon className="h-6 w-6 text-white" />
                            <div>
                                <div className="text-[9px] font-black text-slate-300 tracking-wider">DATA DA PRODUÇÃO</div>
                                <div className="text-base font-black text-white leading-tight">{formattedDateNumbers}</div>
                                <div className="text-[10px] font-extrabold text-slate-300 uppercase">{formattedDayOfWeek}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* METADADOS */}
                <div className="grid grid-cols-12 border-b border-slate-200 bg-[#fbfcfd] text-left text-xs">
                    <div className="col-span-4 p-4 flex flex-col justify-between gap-3 border-r border-slate-200">
                        <div className="flex items-start gap-2.5">
                            <ClipboardIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                            <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">ORDEM DE PRODUÇÃO</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{report.orderNumber || '—'}</div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                            <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                            <div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR</div>
                                <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{statsA.operator}</div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-5 p-4 flex flex-col justify-between gap-3 border-r border-slate-200">
                        <div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO (ENTRADA)</div>
                            <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{report.targetBitola ? `Fio Máquina ⌀ 8,00 mm` : '—'}</div>
                        </div>
                        <div className="pt-3 border-t border-slate-100">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO (SAÍDA)</div>
                            <div className="text-sm font-black text-[#002060] uppercase mt-0.5">{report.targetBitola ? `CA-60 / CA-50 ⌀ ${report.targetBitola} mm` : '—'}</div>
                        </div>
                    </div>

                    <div className="col-span-3 p-4 flex flex-col justify-center items-center text-center bg-slate-50">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">PESO TOTAL PRODUZIDO</div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-[#002060] tracking-tight">{statsA.pesoSaida.toFixed(0)}</span>
                            <span className="text-sm font-bold text-slate-600">kg</span>
                        </div>
                    </div>
                </div>

                {/* PARADAS E ESTATÍSTICAS - LADO A LADO */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200">
                    {/* Paradas (col-span-7) */}
                    <div className="col-span-7 border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left">
                            PARADAS E SEUS MOTIVOS
                        </div>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase">
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Início</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Fim</th>
                                    <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '70px' }}>Duração</th>
                                    <th className="py-1.5 text-left pl-3">Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statsA.stops.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                            Nenhuma parada registrada.
                                        </td>
                                    </tr>
                                ) : (
                                    statsA.stops.map((stop: any) => (
                                        <tr key={stop.id} className="border-b border-slate-200 text-xs">
                                            <td className="p-1 border-r border-slate-200 text-center text-rose-600 font-black">{stop.inicio}</td>
                                            <td className="p-1 border-r border-slate-200 text-center text-emerald-600 font-black">{stop.fim}</td>
                                            <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600">{stop.duracaoStr}</td>
                                            <td className="p-1 text-left pl-3 font-bold text-slate-800 uppercase">{stop.motivo}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Estatísticas (col-span-5) */}
                    <div className="col-span-5 border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col text-xs">
                        <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase text-left flex items-center gap-1.5">
                            <GaugeIcon className="h-4 w-4 text-white" />
                            <span>ESTATÍSTICA DO DIA</span>
                        </div>
                        <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full text-xs text-left">
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Horas (Turno trabalhado)</span>
                                </div>
                                <span className="font-black text-slate-900">{statsA.horasTrabalhadas}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 bg-rose-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-rose-500" />
                                    <span className="font-black text-rose-600 uppercase">Tempo de máquina (parada)</span>
                                </div>
                                <div className="flex gap-4 font-black text-rose-600">
                                    <span>{statsA.tempoParado}</span>
                                    <span>{statsA.percentParado}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2 bg-emerald-50/20 px-1 rounded">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4 text-emerald-500" />
                                    <span className="font-black text-emerald-600 uppercase">Tempo de máquina (Efetivo)</span>
                                </div>
                                <div className="flex gap-4 font-black text-emerald-600">
                                    <span>{statsA.tempoEfetivo}</span>
                                    <span>{statsA.percentEfetivo}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <LayersIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Peso entrada</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.pesoEntrada.toLocaleString('pt-BR')} kg</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <LayersIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Peso saida</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.pesoSaida.toLocaleString('pt-BR')} kg</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <LayersIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Sucata</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-[#002060]">{statsA.sucata.toLocaleString('pt-BR')} kg</span>
                                    <span className="text-rose-600 font-black text-[10px] bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{statsA.percentSucata}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <RulerIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Quant. metros produzidos</span>
                                </div>
                                <span className="font-black text-[#002060]">{Math.round(statsA.metros).toLocaleString('pt-BR')} metros</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <GaugeIcon className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-700">Velocidade (média)</span>
                                </div>
                                <span className="font-black text-[#002060]">{statsA.velocidadeMin.toFixed(1).replace('.', ',')} metros/ minuto</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ATUALIZAÇÃO DA PRODUÇÃO (LOTES PROCESSADOS) */}
                <div className="p-4 bg-white text-left">
                    <div className="bg-[#002060] text-white py-2 px-3 text-[11px] font-black tracking-wider uppercase mb-3 rounded">
                        ATUALIZAÇÃO DA PRODUÇÃO – LINHA DO TEMPO DE LOTES
                    </div>
                    <table className="w-full border-collapse border-2 border-[#002060] text-xs">
                        <thead>
                            <tr className="border-b-2 border-[#002060] bg-slate-50 font-black text-[#002060] text-center">
                                <th className="p-2 border-r border-[#002060] w-1/4">CÓDIGO RASTREIO</th>
                                <th className="p-2 border-r border-[#002060] w-1/4">PESO LÍQUIDO (KG)</th>
                                <th className="p-2 border-r border-[#002060] w-1/4">JANELA OPERATIVA</th>
                                <th className="p-2 w-1/4">TEMPO DE CICLO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(report.processedLots || []).map((lot, idx) => {
                                const stockInfo = stock.find(s => s.id === lot.lotId);
                                const duration = new Date(lot.endTime).getTime() - new Date(lot.startTime).getTime();
                                const start = new Date(lot.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                const end = new Date(lot.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                const formatDurationLocal = (ms: number) => {
                                    if (ms < 0) ms = 0;
                                    const totalSeconds = Math.floor(ms / 1000);
                                    const hours = Math.floor(totalSeconds / 3600);
                                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                                    const seconds = totalSeconds % 60;
                                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                };

                                return (
                                    <tr key={lot.lotId || idx} className="border-b border-[#002060] tabular-nums font-bold text-center text-slate-800">
                                        <td className="p-2 border-r border-[#002060]">{stockInfo?.internalLot || '—'}</td>
                                        <td className="p-2 border-r border-[#002060]">{lot.finalWeight?.toFixed(2) || '0,00'}</td>
                                        <td className="p-2 border-r border-[#002060]">{start} - {end}</td>
                                        <td className="p-2">{formatDurationLocal(duration)}</td>
                                    </tr>
                                );
                            })}
                            {(report.processedLots || []).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                        Nenhum lote processado neste turno.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 text-center border-t border-slate-100 pt-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">MSM Inteligência Operacional — Gerado em {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
        );
    }
};

interface ShiftReportsModalProps {
    reports: ShiftReport[];
    stock: StockItem[];
    onClose: () => void;
    onDelete?: (reportId: string) => void;
    isGestor?: boolean;
    onUpdateReport?: (reportId: string, updates: Partial<ShiftReport>) => Promise<void>;
}

const ShiftReportsModal: React.FC<ShiftReportsModalProps> = ({ reports, stock, onClose, onDelete, isGestor, onUpdateReport }) => {
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
    const [printingReport, setPrintingReport] = useState<ShiftReport | null>(null);
    const [editingReport, setEditingReport] = useState<ShiftReport | null>(null);

    const toggleExpand = (reportId: string) => {
        setExpandedReportId(prevId => (prevId === reportId ? null : reportId));
    };

    const handlePrintIndividual = (report: ShiftReport) => {
        setPrintingReport(report);
        // Wait for state to update before printing
        setTimeout(() => {
            window.print();
            setPrintingReport(null);
        }, 600); // Slightly more delay for complex layout rendering
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[120] p-4 print-modal-container">
            <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col print-modal-content overflow-hidden">
                {!printingReport && (
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-white no-print">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                <DocumentReportIcon className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight text-center">Relatórios de Turno</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.1em] text-[9px] mr-1">Histórico Analítico de Operação</p>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${isGestor ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                        {isGestor ? 'Modo Gestor' : 'Modo Operador'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-2.5 px-6 rounded-xl transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                <div className={`flex-grow overflow-y-auto bg-white p-6 print-section`}>
                    {!printingReport ? (
                        reports.length > 0 ? (
                            <div className="space-y-6 no-print">
                                {/* NOVO: Resumo Consolidado do Turno (Caso haja múltiplas ordens no mesmo turno) */}
                                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
                                    <h3 className="text-lg font-black text-indigo-900 uppercase tracking-tighter mb-4 flex items-center gap-2">
                                        <ChartBarIcon className="h-5 w-5 text-indigo-600" /> Resumo Consolidado do Período
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Produzido</p>
                                            <p className="text-3xl font-black text-indigo-900 tracking-tighter">
                                                {reports.reduce((acc, r) => acc + (r.totalProducedWeight || 0), 0).toFixed(1)} <sub className="text-xs font-bold">kg</sub>
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Peças/Lote</p>
                                            <p className="text-3xl font-black text-indigo-900 tracking-tighter">
                                                {reports.reduce((acc, r) => {
                                                    const q = r.totalProducedQuantity > 0 ? r.totalProducedQuantity : ((r.totalProducedMeters || 0) / (parseFloat(r.tamanho || '6') || 6));
                                                    return acc + q;
                                                }, 0).toFixed(0)}
                                            </p>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Tempo Total de Operação</p>
                                            <p className="text-3xl font-black text-indigo-900 tracking-tighter">
                                                {formatDuration(reports.reduce((acc, r) => acc + (new Date(r.shiftEndTime).getTime() - new Date(r.shiftStartTime).getTime()), 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                                <table className="w-full text-base text-left text-slate-500">
                                    <thead className="text-sm font-black text-slate-700 uppercase bg-slate-50 text-center">
                                        <tr>
                                            <th className="px-6 py-4">Data do Turno</th>
                                            <th className="px-6 py-4">Horário</th>
                                            <th className="px-6 py-4">Nº Ordem</th>
                                            <th className="px-6 py-4">Operador</th>
                                            <th className="px-6 py-4">{reports[0]?.machine === 'Trefila' ? 'Bitola' : 'Modelo'}</th>
                                            <th className="px-6 py-4 text-right">Peso Produzido (kg)</th>
                                            <th className="px-6 py-4">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reports.map((report) => (
                                            <React.Fragment key={report.id}>
                                                <tr className={`bg-white hover:bg-slate-50 transition-colors ${expandedReportId === report.id ? 'bg-indigo-50/30' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className="font-bold text-lg text-slate-900">{new Date(report.date).toLocaleDateString('pt-BR')}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        <span className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md">
                                                            {new Date(report.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {new Date(report.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-lg text-slate-900 text-center">
                                                        {report.orderNumber}
                                                    </td>
                                                    <td className="px-6 py-4 uppercase text-sm font-bold text-center">
                                                        {report.operator}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                        {report.machine === 'Trefila' ? `${report.targetBitola} mm` : report.trelicaModel}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-black text-xl text-emerald-700">{report.totalProducedWeight.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => toggleExpand(report.id)}
                                                                className={`py-2 px-5 rounded-lg text-xs font-bold uppercase transition-all ${expandedReportId === report.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                            >
                                                                {expandedReportId === report.id ? "Fechar" : "Detalhes"}
                                                            </button>
                                                            <button
                                                                onClick={() => handlePrintIndividual(report)}
                                                                className="py-2 px-5 rounded-lg text-xs font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all"
                                                            >
                                                                Ver Relatório
                                                            </button>
                                                            {isGestor && onUpdateReport && (
                                                                <button
                                                                    onClick={() => setEditingReport(report)}
                                                                    className="py-2 px-3 rounded-lg text-xs font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-1"
                                                                    title="Ajustar Turno (Gestor)"
                                                                >
                                                                    <PencilIcon className="h-4 w-4" /> Ajustar
                                                                </button>
                                                            )}
                                                            {onDelete && (
                                                                <button
                                                                    onClick={() => onDelete(report.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                                                    title="Excluir"
                                                                >
                                                                    <TrashIcon className="h-5 w-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedReportId === report.id && <ShiftDetails report={report} stock={stock} onPrint={handlePrintIndividual} />}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                            <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-[4rem] border-4 border-dashed border-slate-200 h-full no-print">
                                <div className="relative mb-12">
                                    <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-10 animate-pulse"></div>
                                    <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-b-8 border-slate-100 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                        <DocumentReportIcon className="w-20 h-20 text-slate-100" />
                                        <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full border-4 border-white"></div>
                                    </div>
                                </div>
                                <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Vazio Corporativo</h3>
                                <p className="text-slate-400 font-bold max-w-md text-center leading-relaxed text-sm uppercase tracking-widest">
                                    Não há inteligência acumulada no banco de dados. Encerre os turnos operativos para iniciar a indexação de performance.
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="bg-white min-h-full">
                            <ShiftReportPrintView report={printingReport} stock={stock} allReports={reports} />
                        </div>
                    )}
                </div>

                {!printingReport && (
                    <div className="flex justify-end p-8 border-t border-slate-100 no-print bg-slate-50/80 backdrop-blur-md">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-600 font-black py-3 px-10 rounded-2xl transition-all shadow-xl active:scale-95 uppercase text-xs tracking-widest"
                        >
                            Sair do Hub
                        </button>
                    </div>
                )}
                {editingReport && onUpdateReport && (
                    <EditShiftReportModal
                        report={editingReport}
                        onClose={() => setEditingReport(null)}
                        onSave={onUpdateReport}
                    />
                )}
            </div>
        </div>
    );
};

export default ShiftReportsModal;