import React, { useState, useMemo } from 'react';
import type { ShiftReport, StockItem } from '../types';
import { PrinterIcon } from './icons';

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ShiftDetails: React.FC<{ report: ShiftReport, stock: StockItem[] }> = ({ report, stock }) => {
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
        <td colSpan={10} className="p-0 border-b-2 border-[#0F3F5C]">
            <div className="bg-[#f0f9ff] p-6 shadow-inner">
                <h4 className="font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Estatísticas do Turno
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Duração Total</p>
                        <p className="text-xl font-mono font-bold text-slate-800">{formatDuration(totalDuration)}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg shadow-sm border border-emerald-100">
                        <p className="text-xs text-emerald-700 font-bold uppercase mb-1">Tempo Efetivo</p>
                        <p className="text-xl font-mono font-bold text-emerald-800">{formatDuration(productiveTime)} <span className="text-sm font-sans">({productivePercentage.toFixed(1)}%)</span></p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100">
                        <p className="text-xs text-red-700 font-bold uppercase mb-1">Tempo Parado</p>
                        <p className="text-xl font-mono font-bold text-red-800">{formatDuration(totalDowntime)} <span className="text-sm font-sans">({downtimePercentage.toFixed(1)}%)</span></p>
                    </div>
                    {report.machine === 'Trefila' ? (
                        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100">
                            <p className="text-xs text-[#0F3F5C] font-bold uppercase mb-1">Bitola Produzida</p>
                            <p className="text-xl font-mono font-bold text-[#0F3F5C]">{report.targetBitola}</p>
                        </div>
                    ) : (
                        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100">
                            <p className="text-xs text-[#0F3F5C] font-bold uppercase mb-1">Produto</p>
                            <p className="text-lg font-bold text-[#0F3F5C]">{report.trelicaModel} ({report.tamanho} m)</p>
                        </div>
                    )}
                    <div className="bg-orange-50 p-4 rounded-lg shadow-sm border border-orange-100">
                        <p className="text-xs text-orange-700 font-bold uppercase mb-1">Sucata Gerada</p>
                        <p className="text-xl font-mono font-bold text-orange-800">{report.totalScrapWeight.toFixed(2)} kg <span className="text-sm font-sans">({report.scrapPercentage.toFixed(1)}%)</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                            <h4 className="font-bold text-[#0F3F5C] flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                </svg>
                                Lotes Processados
                            </h4>
                        </div>
                        <div className="overflow-x-auto max-h-60">
                            <table className="min-w-full text-xs text-left">
                                <thead className="bg-[#0F3F5C] text-white">
                                    <tr>
                                        <th className="p-2 font-semibold">Lote Interno</th>
                                        <th className="p-2 text-right font-semibold">Peso Final</th>
                                        <th className="p-2 text-center font-semibold">Horário</th>
                                        <th className="p-2 text-right font-semibold">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {report.processedLots.map(lot => {
                                        const stockInfo = stock.find(s => s.id === lot.lotId);
                                        const durationMs = new Date(lot.endTime).getTime() - new Date(lot.startTime).getTime();
                                        return (
                                            <tr key={lot.lotId} className="hover:bg-slate-50">
                                                <td className="p-2 font-medium text-[#0F3F5C]">{stockInfo?.internalLot || 'N/A'}</td>
                                                <td className="p-2 text-right font-bold">{lot.finalWeight!.toFixed(2)} kg</td>
                                                <td className="p-2 text-center text-slate-500">
                                                    {new Date(lot.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -
                                                    {new Date(lot.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-2 text-right font-mono text-slate-600">{formatDuration(durationMs)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                            <h4 className="font-bold text-[#0F3F5C] flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Paradas Registradas
                            </h4>
                        </div>
                        <div className="overflow-x-auto max-h-60">
                            <table className="min-w-full text-xs text-left">
                                <thead className="bg-[#0F3F5C] text-white">
                                    <tr>
                                        <th className="p-2 font-semibold">Motivo</th>
                                        <th className="p-2 text-center font-semibold">Horário</th>
                                        <th className="p-2 text-right font-semibold">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedDowntimeEvents.map((event, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="p-2 font-medium">{event.reason}</td>
                                            <td className="p-2 text-center text-slate-500">
                                                {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -
                                                {event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '...'}
                                            </td>
                                            <td className="p-2 text-right font-mono text-slate-600">
                                                {formatDuration(new Date(event.resumeTime || report.shiftEndTime).getTime() - new Date(event.stopTime).getTime())}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </td>
    );
};


interface ShiftReportsModalProps {
    reports: ShiftReport[];
    stock: StockItem[];
    onClose: () => void;
}

const ShiftReportsModal: React.FC<ShiftReportsModalProps> = ({ reports, stock, onClose }) => {
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

    const toggleExpand = (reportId: string) => {
        setExpandedReportId(prevId => (prevId === reportId ? null : reportId));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4 print-modal-container">
            <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col print-modal-content overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-[#0F3F5C]/20 bg-slate-50 no-print">
                    <div>
                        <h2 className="text-2xl font-bold text-[#0F3F5C]">Histórico de Relatórios de Turno</h2>
                        <p className="text-sm text-slate-500">Visualize e analise o desempenho dos turnos anteriores.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.print()}
                            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-lg transition-all shadow-sm flex items-center gap-2"
                            title="Imprimir Lista"
                        >
                            <PrinterIcon className="h-5 w-5 text-[#FF8C00]" />
                            <span>Imprimir Lista</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-[#0F3F5C] hover:bg-[#1A5A7D] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md"
                        >
                            Fechar
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto print-section bg-slate-100 p-6">
                    {reports.length > 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#0F3F5C] text-white sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 font-semibold">Data</th>
                                        <th className="p-4 font-semibold">Operador</th>
                                        <th className="p-4 font-semibold">Nº Ordem</th>
                                        <th className="p-4 font-semibold">Início/Fim</th>
                                        <th className="p-4 font-semibold text-right">Prod. (kg)</th>
                                        <th className="p-4 font-semibold text-right">Prod. (m)</th>
                                        <th className="p-4 font-semibold text-right">Sucata (kg)</th>
                                        <th className="p-4 font-semibold text-center">Paradas</th>
                                        <th className="p-4 font-semibold text-center no-print">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reports.map((report) => (
                                        <React.Fragment key={report.id}>
                                            <tr className={`hover:bg-blue-50 transition-colors ${expandedReportId === report.id ? 'bg-blue-50 border-l-4 border-l-[#FF8C00]' : ''}`}>
                                                <td className="p-4 font-medium text-[#0F3F5C]">{new Date(report.date).toLocaleDateString('pt-BR')}</td>
                                                <td className="p-4 font-medium text-slate-700">{report.operator}</td>
                                                <td className="p-4 text-slate-600">{report.orderNumber}</td>
                                                <td className="p-4 text-slate-500 text-xs">
                                                    <div>{new Date(report.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    <div>{new Date(report.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="p-4 text-right font-bold text-emerald-700">{report.totalProducedWeight.toFixed(2)}</td>
                                                <td className="p-4 text-right font-bold text-slate-700">{report.totalProducedMeters.toFixed(2)}</td>
                                                <td className="p-4 text-right font-bold text-red-700">{report.totalScrapWeight.toFixed(2)}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${report.downtimeEvents.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                                        {report.downtimeEvents.length}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center no-print">
                                                    <button
                                                        onClick={() => toggleExpand(report.id)}
                                                        className="text-[#0F3F5C] hover:text-[#FF8C00] font-bold text-sm transition-colors flex items-center justify-center gap-1 mx-auto"
                                                    >
                                                        {expandedReportId === report.id ? (
                                                            <>
                                                                <span>Ocultar</span>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>Ver</span>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedReportId === report.id && <ShiftDetails report={report} stock={stock} />}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-slate-200 h-full">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <p className="text-xl font-medium text-slate-600">Nenhum relatório de turno gerado ainda.</p>
                            <p className="text-slate-400 mt-2">Os relatórios de turno aparecerão aqui após o término das operações.</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t no-print p-6">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default ShiftReportsModal;