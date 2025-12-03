import React, { useState, useMemo } from 'react';
import type { ShiftReport, StockItem } from '../types';

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
        <td colSpan={10} className="p-4 bg-slate-50">
            <div className="bg-white p-4 rounded-md border mb-4">
                <h4 className="font-semibold text-slate-700 mb-3">Estatísticas do Turno</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div className="bg-slate-100 p-3 rounded-md">
                        <p className="text-sm text-slate-500">Duração Total</p>
                        <p className="text-xl font-mono font-bold text-slate-800">{formatDuration(totalDuration)}</p>
                    </div>
                    <div className="bg-emerald-100 p-3 rounded-md">
                        <p className="text-sm text-emerald-700">Tempo Efetivo</p>
                        <p className="text-xl font-mono font-bold text-emerald-800">{formatDuration(productiveTime)} ({productivePercentage.toFixed(1)}%)</p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-md">
                        <p className="text-sm text-red-700">Tempo Parado</p>
                        <p className="text-xl font-mono font-bold text-red-800">{formatDuration(totalDowntime)} ({downtimePercentage.toFixed(1)}%)</p>
                    </div>
                    {report.machine === 'Trefila' ? (
                        <div className="bg-[#e6f0f5] p-3 rounded-md">
                            <p className="text-sm text-[#0F3F5C]">Bitola Produzida</p>
                            <p className="text-xl font-mono font-bold text-[#0F3F5C]">{report.targetBitola}</p>
                        </div>
                    ) : (
                        <div className="bg-[#e6f0f5] p-3 rounded-md">
                            <p className="text-sm text-[#0F3F5C]">Produto</p>
                            <p className="text-lg font-bold text-[#0F3F5C]">{report.trelicaModel} ({report.tamanho} mts)</p>
                        </div>
                    )}
                    <div className="bg-orange-100 p-3 rounded-md">
                        <p className="text-sm text-orange-700">Sucata Gerada</p>
                        <p className="text-xl font-mono font-bold text-orange-800">{report.totalScrapWeight.toFixed(2)} kg ({report.scrapPercentage.toFixed(1)}%)</p>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-semibold text-slate-700 mb-2 pl-2">Lotes Processados no Turno</h4>
                    <div className="overflow-x-auto border rounded-md bg-white max-h-60">
                        <table className="min-w-full text-xs">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Lote Interno</th>
                                    <th className="p-2 text-right font-semibold">Peso Final</th>
                                    <th className="p-2 text-right font-semibold">Início</th>
                                    <th className="p-2 text-right font-semibold">Fim</th>
                                    <th className="p-2 text-right font-semibold">Duração</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {report.processedLots.map(lot => {
                                    const stockInfo = stock.find(s => s.id === lot.lotId);
                                    const durationMs = new Date(lot.endTime).getTime() - new Date(lot.startTime).getTime();
                                    return (
                                        <tr key={lot.lotId}>
                                            <td className="p-2">{stockInfo?.internalLot || 'N/A'}</td>
                                            <td className="p-2 text-right">{lot.finalWeight!.toFixed(2)} kg</td>
                                            <td className="p-2 text-right">{new Date(lot.startTime).toLocaleTimeString('pt-BR')}</td>
                                            <td className="p-2 text-right">{new Date(lot.endTime).toLocaleTimeString('pt-BR')}</td>
                                            <td className="p-2 text-right font-mono">{formatDuration(durationMs)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-slate-700 mb-2 pl-2">Paradas no Turno</h4>
                    <div className="overflow-x-auto border rounded-md bg-white max-h-60">
                        <table className="min-w-full text-xs">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Motivo</th>
                                    <th className="p-2 text-right font-semibold">Início</th>
                                    <th className="p-2 text-right font-semibold">Fim</th>
                                    <th className="p-2 text-right font-semibold">Duração</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sortedDowntimeEvents.map((event, i) => (
                                    <tr key={i}>
                                        <td className="p-2">{event.reason}</td>
                                        <td className="p-2 text-right">{new Date(event.stopTime).toLocaleTimeString('pt-BR')}</td>
                                        <td className="p-2 text-right">{event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR') : 'Ativa'}</td>
                                        <td className="p-2 text-right">{formatDuration(new Date(event.resumeTime || report.shiftEndTime).getTime() - new Date(event.stopTime).getTime())}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4 print-modal-container">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col print-modal-content">
                <div className="flex justify-between items-center border-b pb-4 mb-4 no-print">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Relatórios de Turno</h2>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.print()}
                            className="text-slate-500 hover:text-slate-800 flex items-center gap-2"
                            title="Imprimir Lista"
                        >
                            <span className="text-sm font-medium">Imprimir</span>
                        </button>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 print-section">
                    {reports.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Operador</th>
                                    <th className="p-3 font-semibold text-slate-600">Nº Ordem</th>
                                    <th className="p-3 font-semibold text-slate-600">Início Turno</th>
                                    <th className="p-3 font-semibold text-slate-600">Fim Turno</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Prod. (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Prod. (m)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Sucata (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Paradas</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center no-print">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {reports.map((report) => (
                                    <React.Fragment key={report.id}>
                                        <tr className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(report.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-3 font-medium">{report.operator}</td>
                                            <td className="p-3">{report.orderNumber}</td>
                                            <td className="p-3">{new Date(report.shiftStartTime).toLocaleTimeString('pt-BR')}</td>
                                            <td className="p-3">{new Date(report.shiftEndTime).toLocaleTimeString('pt-BR')}</td>
                                            <td className="p-3 text-right font-bold text-emerald-700">{report.totalProducedWeight.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-slate-700">{report.totalProducedMeters.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-red-700">{report.totalScrapWeight.toFixed(2)}</td>
                                            <td className="p-3 text-center">{report.downtimeEvents.length}</td>
                                            <td className="p-3 text-center no-print">
                                                <button onClick={() => toggleExpand(report.id)} className="text-slate-600 hover:underline text-xs font-semibold">
                                                    {expandedReportId === report.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedReportId === report.id && <ShiftDetails report={report} stock={stock} />}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-slate-500 py-10">Nenhum relatório de turno gerado ainda.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t no-print">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default ShiftReportsModal;