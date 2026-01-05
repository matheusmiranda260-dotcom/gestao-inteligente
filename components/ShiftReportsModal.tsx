import React, { useState, useMemo } from 'react';
import type { ShiftReport, StockItem } from '../types';
import { PrinterIcon, DocumentReportIcon, ArchiveIcon, WarningIcon, TrashIcon } from './icons';

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
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="mx-1">→</span>
                                                    {event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Em Aberto'}
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

const ShiftReportPrintView: React.FC<{ report: ShiftReport, stock: StockItem[], allReports?: ShiftReport[] }> = ({ report, stock, allReports }) => {
    const { totalDuration, productiveTime, totalDowntime, productivePercentage, downtimePercentage } = useMemo(() => {
        const shiftStart = new Date(report.shiftStartTime).getTime();
        const shiftEnd = new Date(report.shiftEndTime).getTime();
        const totalDuration = shiftEnd - shiftStart;
        const totalDowntime = report.downtimeEvents.reduce((acc, event) => {
            const stop = new Date(event.stopTime).getTime();
            const resume = event.resumeTime ? new Date(event.resumeTime).getTime() : shiftEnd;
            const effectiveStart = Math.max(stop, shiftStart);
            const effectiveEnd = Math.min(resume, shiftEnd);
            return effectiveEnd > effectiveStart ? acc + (effectiveEnd - effectiveStart) : acc;
        }, 0);
        const productiveTime = Math.max(0, totalDuration - totalDowntime);
        return {
            totalDuration, productiveTime, totalDowntime,
            productivePercentage: totalDuration > 0 ? (productiveTime / totalDuration) * 100 : 0,
            downtimePercentage: totalDuration > 0 ? (totalDowntime / totalDuration) * 100 : 0
        };
    }, [report]);

    const sortedEvents = useMemo(() =>
        [...report.downtimeEvents].sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime()),
        [report.downtimeEvents]);

    const isTrelica = report.machine !== 'Trefila';

    if (isTrelica) {
        const tamanhoNum = parseFloat(report.tamanho || '6') || 6;
        const totalPieces = report.totalProducedQuantity > 0
            ? report.totalProducedQuantity
            : (report.totalProducedMeters / tamanhoNum);
        const timePerPieceMs = totalPieces > 0 ? productiveTime / totalPieces : 0;
        const speedMpm = productiveTime > 0 ? report.totalProducedMeters / (productiveTime / 60000) : 0;

        // Historical data for "Atualização da Produção"
        // Historical data for "Atualização da Produção" - Listed by Shift
        const productionHistory = useMemo(() => {
            // Deduplicate reports by ID
            const allSourceReports = allReports || [report];
            const uniqueReports = Array.from(new Map(allSourceReports.map(item => [item.id, item])).values()) as ShiftReport[];

            return uniqueReports
                .filter(r => r.orderNumber === report.orderNumber && r.machine !== 'Trefila')
                .sort((a, b) => new Date(a.shiftStartTime || a.date).getTime() - new Date(b.shiftStartTime || b.date).getTime());
        }, [allReports, report.orderNumber]);

        const totalHistPieces = productionHistory.reduce((acc, r) => {
            const qty = r.totalProducedQuantity > 0 ? r.totalProducedQuantity : ((r.totalProducedMeters || 0) / (parseFloat(r.tamanho || '6') || 6));
            return acc + qty;
        }, 0);
        const totalHistWeight = productionHistory.reduce((acc, r) => acc + (r.totalProducedWeight || 0), 0);
        const avgHistMedia = totalHistPieces > 0 ? totalHistWeight / totalHistPieces : 0;

        return (
            <div className="p-8 bg-white text-black font-sans min-h-screen text-[12px] print:block">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <img src="/ita-acos-logo.png" alt="Grupo ITA AÇOS" className="h-24 w-auto object-contain" />
                    </div>
                    <div className="text-center flex-grow px-4">
                        <h1 className="text-lg font-black uppercase leading-tight tracking-tight">
                            CONTROLE DE PRODUÇÃO DIARIA - SETOR LAMINAÇÃO<br />
                            TRELIÇA
                        </h1>
                    </div>
                    <div className="w-24"></div> {/* Balance spacer */}
                </div>

                {/* Info Table */}
                <table className="w-full border-collapse border-2 border-black mb-4">
                    <tbody>
                        <tr>
                            <td className="border border-black p-1.5 font-bold bg-white text-center align-middle">Ordem de produção : <span className="font-black ml-2 tabular-nums">{report.orderNumber}</span></td>
                        </tr>
                        <tr>
                            <td className="border border-black p-1.5 font-bold bg-white text-center align-middle">
                                Data da produção: <span className="font-medium ml-2 uppercase text-[11px]">{new Date(report.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-1.5 font-bold bg-white text-center align-middle">Operador/auxiliar: <span className="font-black ml-2 uppercase">{report.operator}</span></td>
                        </tr>
                    </tbody>
                </table>

                {/* Product Description */}
                <table className="w-full border-collapse border-2 border-black mb-6">
                    <tbody>
                        <tr>
                            <td className="p-2 border-b border-black">
                                <span className="font-bold">Descrição do produto:</span>
                                <span className="ml-2 font-black text-lg uppercase">TRELIÇA {report.trelicaModel} {report.tamanho} MTS</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="p-2">
                                <span className="font-bold">Qnt. De peças produzidas:</span>
                                <span className="ml-2 font-black text-xl tabular-nums">{totalPieces.toFixed(0)} peças</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Paradas e Motivos */}
                <div className="mb-6">
                    <h2 className="text-center italic font-black text-sm mb-1 underline">PARADAS E SEUS MOTIVOS:</h2>
                    <table className="w-full border-collapse border-2 border-black">
                        <thead>
                            <tr className="bg-slate-100 text-[10px] font-black">
                                <th className="border border-black p-1 text-center w-24">INÍCIO</th>
                                <th className="border border-black p-1 text-center w-24">FIM</th>
                                <th className="border border-black p-1 px-4">MOTIVO</th>
                                <th className="border border-black p-1 text-center w-24">DURAÇÃO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEvents.map((event, idx) => {
                                const duration = new Date(event.resumeTime || report.shiftEndTime).getTime() - new Date(event.stopTime).getTime();
                                return (
                                    <tr key={idx} className="text-[11px]">
                                        <td className="border border-black p-1 text-center font-black text-rose-600 tabular-nums">
                                            {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </td>
                                        <td className="border border-black p-1 text-center font-black text-emerald-600 tabular-nums">
                                            {event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                        </td>
                                        <td className="border border-black p-1 px-4 italic font-medium text-slate-800 uppercase">
                                            {event.reason}
                                        </td>
                                        <td className="border border-black p-1 text-center font-black text-rose-600 tabular-nums">
                                            {formatDuration(duration)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedEvents.length === 0 && (
                                <tr className="h-6">
                                    <td className="border border-black p-1 text-center" colSpan={4}>Nenhuma parada registrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Estatística do Dia */}
                <div className="mb-6 border-2 border-black p-4 bg-white">
                    <h2 className="text-center italic font-black text-sm mb-4 underline">ESTATÍSTICA DO DIA:</h2>
                    <div className="space-y-1 mx-auto max-w-2xl px-12">
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold">Horas (Turno trabalhados):</span>
                            <span className="font-black tabular-nums">{formatDuration(totalDuration)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold text-rose-600">Tempo de maquina (parada) :</span>
                            <div className="flex gap-4 items-center">
                                <span className="font-black tabular-nums text-rose-600">{formatDuration(totalDowntime)}</span>
                                <span className="font-black text-rose-600 w-12 text-right">{downtimePercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold text-emerald-600">Tempo de maquina (Efetivo) :</span>
                            <div className="flex gap-4 items-center">
                                <span className="font-black tabular-nums text-emerald-600">{formatDuration(productiveTime)}</span>
                                <span className="font-black text-emerald-600 w-12 text-right">{productivePercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold">Quant. de peças produzidas:</span>
                            <span className="font-black tabular-nums">{totalPieces.toFixed(0)} peças de {report.tamanho} metros</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold">Quant. de metros produzidos:</span>
                            <span className="font-black tabular-nums">{(report.totalProducedMeters || 0).toFixed(0)} metros</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold">Tempo por peça:</span>
                            <span className="font-black tabular-nums">{formatDuration(timePerPieceMs)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                            <span className="font-bold">Velocidade:</span>
                            <span className="font-black tabular-nums">{speedMpm.toFixed(1)} metros/ minuto</span>
                        </div>
                    </div>
                </div>

                {/* Atualização da Produção */}
                <div className="border-2 border-black p-4 bg-white">
                    <h2 className="text-center italic font-black text-sm mb-2 underline uppercase">ATUALIZAÇÃO DA PRODUÇÃO:</h2>
                    <p className="text-center font-black mb-4">Qntidade de peças a produzir: {report.quantityToProduce || '-'} treliças</p>

                    <table className="w-full border-collapse mx-auto max-w-xl text-[12px] mb-2">
                        <thead>
                            <tr className="border-b-2 border-black font-black">
                                <th className="p-2 text-center w-1/4">Qnt.</th>
                                <th className="p-2 text-center w-1/4">peso</th>
                                <th className="p-2 text-center w-1/4">media</th>
                                <th className="p-2 text-center w-1/4">Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productionHistory.map((r, i) => {
                                const q = r.totalProducedQuantity > 0 ? r.totalProducedQuantity : ((r.totalProducedMeters || 0) / (parseFloat(r.tamanho || '6') || 6));
                                const media = q > 0 ? (r.totalProducedWeight || 0) / q : 0;

                                const start = r.shiftStartTime ? new Date(r.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                                const end = r.shiftEndTime ? new Date(r.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                                const dateStr = new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                                const timeLabel = start && end ? `${dateStr} - ${start} às ${end}` : new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

                                return (
                                    <tr key={i} className="tabular-nums font-bold">
                                        <td className="p-1.5 text-center w-1/4">{q.toFixed(0)}</td>
                                        <td className="p-1.5 text-center w-1/4">{(r.totalProducedWeight || 0).toFixed(0)}</td>
                                        <td className="p-1.5 text-center w-1/4">{media.toFixed(2)}</td>
                                        <td className="p-1.5 text-center w-1/4 text-[10px] whitespace-nowrap">{timeLabel}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Floating Total Row - Separated Table for clean gap */}
                    <table className="w-full border-collapse mx-auto max-w-xl text-[12px]">
                        <tbody>
                            <tr className="border-2 border-black font-black tabular-nums bg-slate-50 shadow-sm">
                                <td className="p-2 text-center w-1/4">{totalHistPieces.toFixed(0)}</td>
                                <td className="p-2 text-center w-1/4">{totalHistWeight.toFixed(0)}</td>
                                <td className="p-2 text-center w-1/4">{avgHistMedia.toFixed(2)}</td>
                                <td className="p-2 text-center italic text-[#002B7F] w-1/4">TOTAL</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">MSM Inteligência Operacional — Gerado em {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-12 bg-white text-slate-900 font-sans min-h-screen relative overflow-hidden print:block">
            {/* Background Branding (Watermark-like) */}
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-slate-50 rounded-full opacity-50 z-0"></div>

            <div className="relative z-10">
                {/* Header with High-Contrast Design */}
                <div className="flex justify-between items-end border-b-8 border-slate-900 pb-10 mb-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-900 flex items-center justify-center rounded-2xl transform rotate-3">
                                <span className="text-white font-black text-2xl tracking-tighter">M</span>
                            </div>
                            <div>
                                <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">Shift Report</h1>
                                <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em] mt-1 ml-1">Advanced Production Analytics</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-3xl font-black text-slate-900 tabular-nums">{new Date(report.date).toLocaleDateString('pt-BR')}</p>
                        <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                            MÁQUINA: {report.machine === 'Trefila' ? 'DHTRF-01' : 'DHSTR-02'}
                        </div>
                    </div>
                </div>

                {/* Primary Data Ribbon */}
                <div className="grid grid-cols-4 gap-6 mb-12">
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Workload Total</p>
                        <p className="text-4xl font-black text-slate-900 tabular-nums leading-none">{formatDuration(totalDuration)}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Horas Contabilizadas</p>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-[2rem] border-2 border-emerald-100 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-100/50 rounded-full -mr-4 -mt-4"></div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">Availability</p>
                        <p className="text-4xl font-black text-emerald-800 tabular-nums leading-none">{productivePercentage.toFixed(1)}%</p>
                        <p className="text-[10px] font-bold text-emerald-600/70 mt-2 uppercase">Tempo Produtivo</p>
                    </div>
                    <div className="p-6 bg-rose-50 rounded-[2rem] border-2 border-rose-100 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-rose-100/50 rounded-full -mr-4 -mt-4"></div>
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4">Downtime</p>
                        <p className="text-4xl font-black text-rose-800 tabular-nums leading-none">{downtimePercentage.toFixed(1)}%</p>
                        <p className="text-[10px] font-bold text-rose-600/70 mt-2 uppercase">Perda de Disponibilidade</p>
                    </div>
                    <div className="p-6 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-100 flex flex-col justify-between">
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-4">Output</p>
                        <p className="text-4xl font-black text-white tabular-nums leading-none">{report.totalProducedWeight.toFixed(0)}<sub className="text-sm font-black ml-1 uppercase">kg</sub></p>
                        <p className="text-[10px] font-bold text-indigo-300 mt-2 uppercase">Massa Líquida</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                    <section className="space-y-6">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3 border-b-2 border-slate-900 pb-3">
                            <span className="w-3 h-3 bg-slate-900 rounded-sm"></span>
                            Tech Specs & Context
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Number</span>
                                <span className="text-sm font-black text-slate-900"># {report.orderNumber}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Operator</span>
                                <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">{report.operator}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Window</span>
                                <span className="text-sm font-black text-slate-900">
                                    {new Date(report.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    <span className="mx-2 text-slate-300">/</span>
                                    {new Date(report.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {report.machine === 'Trefila' ? (
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Gauge</span>
                                    <span className="text-sm font-black text-slate-900 whitespace-nowrap bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">⌀ {report.targetBitola} MM</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Truss Model</span>
                                        <span className="text-sm font-black text-slate-900 uppercase">{report.trelicaModel}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit Length</span>
                                        <span className="text-sm font-black text-slate-900">{report.tamanho} M</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h3 className="text-xs font-black text-rose-600 uppercase tracking-[0.25em] flex items-center gap-3 border-b-2 border-rose-600 pb-3">
                            <span className="w-3 h-3 bg-rose-600 rounded-sm"></span>
                            Loss Analysis
                        </h3>
                        <div className="p-8 bg-slate-900 rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute bottom-0 right-0 w-32 h-32 bg-rose-600/10 rounded-full -mb-16 -mr-16"></div>
                            <div className="flex justify-between items-end mb-8 relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Scrap</p>
                                    <p className="text-5xl font-black text-white tabular-nums leading-none">{report.totalScrapWeight.toFixed(1)}<sub className="text-xs font-black ml-1">KG</sub></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scrap Ratio</p>
                                    <p className="text-5xl font-black text-rose-500 tabular-nums leading-none">{report.scrapPercentage.toFixed(1)}%</p>
                                </div>
                            </div>
                            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden relative z-10">
                                <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]" style={{ width: `${Math.min(100, report.scrapPercentage * 8)}%` }}></div>
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 mt-4 uppercase tracking-[0.2em] relative z-10">Performance Index vs Quality Threshold</p>
                        </div>
                    </section>
                </div>

                <div className="space-y-16">
                    <section>
                        <header className="flex justify-between items-end mb-6 border-b-4 border-slate-900 pb-3">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Production Timeline</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linear Output Visualization</p>
                            </div>
                            <span className="text-[10px] font-black text-white bg-slate-900 px-4 py-1.5 rounded-full uppercase tracking-widest">{report.processedLots.length} UNITS TRACKED</span>
                        </header>
                        <table className="w-full text-xs text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-slate-400 font-black uppercase tracking-widest text-[9px]">
                                    <th className="pb-4 px-4">Tracking Code</th>
                                    <th className="pb-4 px-4 text-right">Net Weight (KG)</th>
                                    <th className="pb-4 px-4 text-center">Operation Window</th>
                                    <th className="pb-4 px-4 text-right">Cycle Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.processedLots.map((lot, idx) => {
                                    const stockInfo = stock.find(s => s.id === lot.lotId);
                                    const duration = new Date(lot.endTime).getTime() - new Date(lot.startTime).getTime();
                                    return (
                                        <tr key={lot.lotId} className="bg-slate-50 group">
                                            <td className="py-4 px-4 rounded-l-2xl border-l-4 border-indigo-600">
                                                <span className="font-black text-slate-900">{stockInfo?.internalLot || 'N/A'}</span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className="font-black text-indigo-700 tabular-nums">{lot.finalWeight?.toFixed(2) || '0.00'}</span>
                                            </td>
                                            <td className="py-4 px-4 text-center font-mono text-slate-500 font-bold border-x border-slate-200/50">
                                                {new Date(lot.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(lot.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-4 px-4 text-right rounded-r-2xl font-black tabular-nums">
                                                {formatDuration(duration)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <header className="flex justify-between items-end mb-6 border-b-4 border-rose-600 pb-3">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-black text-rose-600 uppercase tracking-tighter">Event Protocol</h3>
                                <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">Interruption & Downtime Registry</p>
                            </div>
                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-4 py-1.5 rounded-full uppercase tracking-widest">{report.downtimeEvents.length} INCIDENTS</span>
                        </header>
                        <table className="w-full text-xs text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-slate-400 font-black uppercase tracking-widest text-[9px]">
                                    <th className="pb-4 px-4">Event Description</th>
                                    <th className="pb-4 px-4 text-center">Timestamp Window</th>
                                    <th className="pb-4 px-4 text-right">Impact Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEvents.map((event, i) => {
                                    const duration = new Date(event.resumeTime || report.shiftEndTime).getTime() - new Date(event.stopTime).getTime();
                                    return (
                                        <tr key={i} className="bg-rose-50 group">
                                            <td className="py-4 px-4 rounded-l-2xl border-l-4 border-rose-600">
                                                <span className="font-black text-rose-900 uppercase tracking-tight">{event.reason}</span>
                                            </td>
                                            <td className="py-4 px-4 text-center font-mono text-rose-400 font-bold border-x border-rose-200/50">
                                                {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {event.resumeTime ? new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'END OF SHIFT'}
                                            </td>
                                            <td className="py-4 px-4 text-right rounded-r-2xl font-black text-rose-600 tabular-nums">
                                                {formatDuration(duration)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>
                </div>

                {/* Footer / Signature Area */}
                <div className="mt-24 pt-12 border-t-8 border-slate-900 flex justify-between items-start">
                    <div className="space-y-6">
                        <div className="w-80 h-16 border-b-2 border-slate-200"></div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Supervisor</p>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{report.operator}</p>
                        </div>
                    </div>
                    <div className="text-center px-8 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generated Tracking ID</p>
                        <p className="text-[9px] font-mono text-slate-300 font-bold">{report.id}</p>
                    </div>
                    <div className="space-y-6 text-right">
                        <div className="w-80 h-16 border-b-2 border-slate-200 ml-auto"></div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quality Assurance Approval</p>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter tracking-[0.1em]">Verification Required</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">MSM - Gestão Inteligente de Produção © {new Date().getFullYear()}</p>
                </div>
            </div>
        </div>
    );
};

interface ShiftReportsModalProps {
    reports: ShiftReport[];
    stock: StockItem[];
    onClose: () => void;
    onDelete?: (reportId: string) => void;
}

const ShiftReportsModal: React.FC<ShiftReportsModalProps> = ({ reports, stock, onClose, onDelete }) => {
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
    const [printingReport, setPrintingReport] = useState<ShiftReport | null>(null);

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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4 print-modal-container">
            <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col print-modal-content overflow-hidden">
                {!printingReport && (
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-white no-print">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                <DocumentReportIcon className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight text-center">Relatórios de Turno</h2>
                                <p className="text-slate-400 font-bold uppercase tracking-[0.1em] text-[9px]">Histórico Analítico de Operação</p>
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
                            <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm no-print">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Data do Turno</th>
                                            <th className="px-6 py-4 font-bold text-center">Horário</th>
                                            <th className="px-6 py-4 font-bold">Nº Ordem</th>
                                            <th className="px-6 py-4 font-bold">Operador</th>
                                            <th className="px-6 py-4 font-bold">{reports[0]?.machine === 'Trefila' ? 'Bitola' : 'Modelo'}</th>
                                            <th className="px-6 py-4 font-bold text-right">Peso Produzido (kg)</th>
                                            <th className="px-6 py-4 font-bold text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reports.map((report) => (
                                            <React.Fragment key={report.id}>
                                                <tr className={`bg-white hover:bg-slate-50 transition-colors ${expandedReportId === report.id ? 'bg-indigo-50/30' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="font-medium text-slate-900">{new Date(report.date).toLocaleDateString('pt-BR')}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                            {new Date(report.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {new Date(report.shiftEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-slate-900">
                                                        {report.orderNumber}
                                                    </td>
                                                    <td className="px-6 py-4 uppercase text-xs font-semibold">
                                                        {report.operator}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {report.machine === 'Trefila' ? `${report.targetBitola} mm` : report.trelicaModel}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-bold text-emerald-700">{report.totalProducedWeight.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => toggleExpand(report.id)}
                                                                className={`py-1.5 px-4 rounded-lg text-[10px] font-bold uppercase transition-all ${expandedReportId === report.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                            >
                                                                {expandedReportId === report.id ? "Fechar" : "Detalhes"}
                                                            </button>
                                                            <button
                                                                onClick={() => handlePrintIndividual(report)}
                                                                className="py-1.5 px-4 rounded-lg text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all"
                                                            >
                                                                Ver Relatório
                                                            </button>
                                                            {onDelete && (
                                                                <button
                                                                    onClick={() => onDelete(report.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                                                    title="Excluir"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
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
            </div>
        </div>
    );
};

export default ShiftReportsModal;