import React, { useMemo } from 'react';
import type { ProductionOrderData, StockItem } from '../types';
import { PrinterIcon } from './icons';

const trelicaModels = [
    { cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,502' },
    { cod: 'H6_12', modelo: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,288' },
    { cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '2,898' },
    { cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,797' },
    { cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '3,209' },
    { cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,418' },
    { cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '4,087' },
    { cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '8,174' },
    { cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '3,843' },
    { cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '7,686' },
    { cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', pesoFinal: '9,057' },
    { cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '3,522' },
    { cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '7,044' },
    { cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '5,270' },
    { cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '10,540' },
    { cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '11,263' },
    { cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', pesoFinal: '20,042' },
];

interface ProductionOrderReportProps {
    reportData: ProductionOrderData;
    stock: StockItem[];
    onClose: () => void;
}

const formatDuration = (ms: number) => {
    if (isNaN(ms) || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ProductionOrderReport: React.FC<ProductionOrderReportProps> = ({ reportData, stock, onClose }) => {
    const {
        totalDurationMs,
        totalDowntimeMs,
        effectiveTimeMs,
        yieldPercentage,
    } = useMemo(() => {
        if (!reportData.startTime || !reportData.endTime) {
            return { totalDurationMs: 0, totalDowntimeMs: 0, effectiveTimeMs: 0, yieldPercentage: 0 };
        }
        const start = new Date(reportData.startTime).getTime();
        const end = new Date(reportData.endTime).getTime();
        const totalDurationMs = end - start;

        const totalDowntimeMs = (reportData.downtimeEvents || []).reduce((acc, event) => {
            const stop = new Date(event.stopTime).getTime();
            const resume = event.resumeTime ? new Date(event.resumeTime).getTime() : end;
            const effectiveStop = Math.max(start, stop);
            const effectiveResume = Math.min(end, resume);
            if (effectiveResume > effectiveStop) {
                return acc + (effectiveResume - effectiveStop);
            }
            return acc;
        }, 0);

        const effectiveTimeMs = totalDurationMs > totalDowntimeMs ? totalDurationMs - totalDowntimeMs : 0;

        const totalPlannedWeight = reportData.machine === 'Treliça' ? reportData.plannedOutputWeight : reportData.totalWeight;
        const totalProducedWeight = reportData.actualProducedWeight || 0;

        const yieldPercentage = totalPlannedWeight && totalPlannedWeight > 0 ? (totalProducedWeight / totalPlannedWeight) * 100 : 0;

        return { totalDurationMs, totalDowntimeMs, effectiveTimeMs, yieldPercentage };

    }, [reportData]);

    const totalMetersProduced = useMemo(() => {
        const weightKg = reportData.actualProducedWeight || 0;
        if (weightKg === 0) return 0;

        const bitolaMm = parseFloat(reportData.targetBitola);
        if (isNaN(bitolaMm) || bitolaMm <= 0) return 0;

        const steelDensityKgPerM3 = 7850;
        const radiusM = (bitolaMm / 1000) / 2;
        const areaM2 = Math.PI * Math.pow(radiusM, 2);

        const volumeM3 = weightKg / steelDensityKgPerM3;
        const lengthM = volumeM3 / areaM2;

        return lengthM;
    }, [reportData.actualProducedWeight, reportData.targetBitola]);

    const consumedLots = useMemo(() => {
        const orderEndTime = reportData.endTime ? new Date(reportData.endTime).getTime() : Date.now();
        const downtimeEvents = reportData.downtimeEvents || [];

        return (reportData.processedLots || []).map(processedLot => {
            const stockItem = stock.find(s => s.id === processedLot.lotId);

            const lotStartTime = new Date(processedLot.startTime).getTime();
            const lotEndTime = new Date(processedLot.endTime).getTime();
            const totalLotDurationMs = lotEndTime - lotStartTime;

            const downtimeForLotMs = downtimeEvents.reduce((acc, event) => {
                const eventStartTime = new Date(event.stopTime).getTime();
                const eventEndTime = event.resumeTime ? new Date(event.resumeTime).getTime() : orderEndTime;

                const overlapStart = Math.max(lotStartTime, eventStartTime);
                const overlapEnd = Math.min(lotEndTime, eventEndTime);

                if (overlapEnd > overlapStart) {
                    return acc + (overlapEnd - overlapStart);
                }
                return acc;
            }, 0);

            const effectiveLotDurationMs = totalLotDurationMs > downtimeForLotMs ? totalLotDurationMs - downtimeForLotMs : 0;

            return {
                ...processedLot,
                internalLot: stockItem?.internalLot || 'N/A',
                originalWeight: stockItem?.initialQuantity || 0,
                effectiveDurationMs: effectiveLotDurationMs,
            };
        });
    }, [reportData, stock]);

    const averageMeasuredGauge = useMemo(() => {
        if (!consumedLots || consumedLots.length === 0) return null;
        const validGauges = (consumedLots as any[])
            .map(l => l.measuredGauge)
            .filter((g: any) => typeof g === 'number' && g > 0);

        if (validGauges.length === 0) return null;
        const sum = validGauges.reduce((a: number, b: number) => a + b, 0);
        return sum / validGauges.length;
    }, [consumedLots]);

    const dailyBreakdown = useMemo(() => {
        if (!consumedLots || consumedLots.length === 0) return [];

        // FIX: Explicitly type the accumulator for the `reduce` method to help TypeScript's type inference.
        // This resolves an issue where the `lots` variable in the subsequent `map` was being inferred as `unknown`.
        // Fix: Explicitly typed the accumulator for the `reduce` method to help TypeScript's type inference. This resolves an issue where the `lots` variable in the subsequent `map` was being inferred as `unknown`.
        const grouped = (consumedLots as any[]).reduce<Record<string, (typeof consumedLots)[number][]>>((acc, lot) => {
            const dateKey = new Date(lot.endTime).toISOString().split('T')[0];
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(lot);
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([date, lots]: [string, any[]]) => ({
                date: new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                lots,
                totalWeight: lots.reduce((sum, l) => sum + (l.finalWeight || 0), 0)
            }))
            .sort((a, b) => {
                const dateA = a.date.split('/').reverse().join('-');
                const dateB = b.date.split('/').reverse().join('-');
                return new Date(dateA).getTime() - new Date(b.date).getTime();
            });
    }, [consumedLots]);

    const operatorNames = useMemo(() => {
        if (!reportData.operatorLogs || reportData.operatorLogs.length === 0) {
            return 'N/A';
        }
        const names = new Set(reportData.operatorLogs.map(log => log.operator));
        return Array.from(names).join(', ');
    }, [reportData.operatorLogs]);

    const inputBitola = useMemo(() => {
        if (!reportData.selectedLotIds || !Array.isArray(reportData.selectedLotIds) || reportData.selectedLotIds.length === 0) {
            return 'N/A';
        }
        const firstLotId = reportData.selectedLotIds[0];
        const firstLot = stock.find(s => s.id === firstLotId);
        return firstLot?.bitola || 'N/A';
    }, [reportData.selectedLotIds, stock]);

    const totalPlannedWeight = reportData.totalWeight;
    const totalProducedWeight = reportData.actualProducedWeight || 0;
    const totalDifference = totalPlannedWeight - totalProducedWeight;
    const totalLossPercentage = totalPlannedWeight > 0 ? (totalDifference / totalPlannedWeight) * 100 : 0;

    const trelicaModelDetails = useMemo(() => {
        if (!reportData.trelicaModel) return null;
        return trelicaModels.find(m => m.modelo === reportData.trelicaModel && m.tamanho === reportData.tamanho);
    }, [reportData]);

    // Treliça Specific Layout
    if (reportData.machine === 'Treliça') {
        const sizeMeters = parseFloat((reportData.tamanho || '0').replace('MTS', '').trim());
        const totalPieces = reportData.actualProducedQuantity || 0;
        const totalMeters = totalPieces * sizeMeters;
        const timePerPieceSeconds = totalPieces > 0 ? (effectiveTimeMs / 1000) / totalPieces : 0;
        const velocityMMin = effectiveTimeMs > 0 ? totalMeters / (effectiveTimeMs / 1000 / 60) : 0;

        const productionItems = reportData.weighedPackages || [];
        const totalPackageWeight = productionItems.reduce((acc, p) => acc + p.weight, 0);
        const totalPackageQty = productionItems.reduce((acc, p) => acc + p.quantity, 0);
        const averageWeight = totalPackageQty > 0 ? totalPackageWeight / totalPackageQty : 0;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
                <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col print-modal-content">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
                        <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Produção - Treliça</h2>
                        <div className="flex gap-3">
                            <button onClick={() => window.print()} className="bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2">
                                <PrinterIcon className="h-5 w-5" /> Imprimir
                            </button>
                            <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                        </div>
                    </div>

                    <div className="overflow-y-auto print-section bg-white p-2 font-sans text-black">
                        {/* Header */}
                        <div className="flex items-center border-2 border-black mb-1 p-2">
                            <div className="w-32 mr-4 flex flex-col items-center justify-center border-r-2 border-black pr-2">
                                <div className="font-extrabold text-2xl text-[#0F3F5C] italic leading-tight">IITA <span className="text-[#FF8C00]">AÇOS</span></div>
                            </div>
                            <div className="flex-grow text-center">
                                <h1 className="text-lg font-bold uppercase leading-tight">CONTROLE DE PRODUÇÃO DIARIA - SETOR LAMINAÇÃO</h1>
                                <h2 className="text-xl font-bold uppercase leading-tight">TRELIÇA</h2>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="border-2 border-black mb-1 font-bold text-sm">
                            <div className="border-b border-black p-1 px-2">Ordem de produção : <span className="text-lg">{reportData.orderNumber}</span></div>
                            <div className="border-b border-black p-1 px-2">Data da produção: {reportData.startTime ? new Date(reportData.startTime).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
                            <div className="p-1 px-2">Operador/auxiliar: {operatorNames}</div>
                        </div>

                        {/* Product Info */}
                        <div className="border-2 border-black mb-2 p-2">
                            <div className="font-bold text-base uppercase">Descrição do produto: {reportData.trelicaModel} {reportData.tamanho?.includes('MTS') ? reportData.tamanho : `${reportData.tamanho || 0} MTS`}</div>
                            <div className="font-bold text-lg mt-1">Qnt. De peças produzidas: <span className="text-4xl ml-2">{totalPieces} peças</span></div>
                        </div>

                        {/* Stops */}
                        <div className="mb-3">
                            <h3 className="text-center italic underline font-bold mb-0.5 text-sm">PARADAS E SEUS MOTIVOS:</h3>
                            <table className="w-full border-collapse border border-black text-xs text-center font-bold">
                                <tbody>
                                    {reportData.downtimeEvents?.filter(e => e.resumeTime).map((event, idx) => {
                                        const duration = new Date(event.resumeTime!).getTime() - new Date(event.stopTime).getTime();
                                        return (
                                            <tr key={idx} className="bg-gray-100 border-b border-black">
                                                <td className="border-r border-black p-0.5 w-[15%] text-red-600">{new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                <td className="border-r border-black p-0.5 w-[15%] text-green-600">{new Date(event.resumeTime!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                <td className="border-r border-black p-0.5 italic text-gray-700 uppercase">{event.reason}</td>
                                                <td className="w-[15%] text-red-600 font-mono">{formatDuration(duration)}</td>
                                            </tr>
                                        )
                                    })}
                                    {(!reportData.downtimeEvents || reportData.downtimeEvents.length === 0) && (
                                        <tr><td className="p-1 italic text-gray-400">Nenhuma parada registrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Stats */}
                        <div className="border border-black p-2 mb-3">
                            <h3 className="text-center italic underline font-bold mb-2 text-sm">ESTATÍSTICA DO DIA:</h3>
                            <div className="max-w-xl mx-auto grid grid-cols-[3fr_2fr] gap-y-1 text-sm font-bold">
                                <div className="text-right pr-4">Horas (Turno trabalhados):</div>
                                <div className="text-left font-mono">{formatDuration(totalDurationMs)}</div>

                                <div className="text-right pr-4 text-red-600">Tempo de maquina (parada) :</div>
                                <div className="text-left text-red-600 font-mono flex gap-4">
                                    <span className="w-20 text-center">{formatDuration(totalDowntimeMs)}</span>
                                    <span>{totalDurationMs > 0 ? ((totalDowntimeMs / totalDurationMs) * 100).toFixed(1) : 0}%</span>
                                </div>

                                <div className="text-right pr-4 text-green-600">Tempo de maquina (Efetivo) :</div>
                                <div className="text-left text-green-600 font-mono flex gap-4">
                                    <span className="w-20 text-center">{formatDuration(effectiveTimeMs)}</span>
                                    <span>{totalDurationMs > 0 ? ((effectiveTimeMs / totalDurationMs) * 100).toFixed(1) : 0}%</span>
                                </div>

                                <div className="text-right pr-4">Quant. de peças produzidas:</div>
                                <div className="text-left">{totalPieces} peças de {sizeMeters} metros</div>

                                <div className="text-right pr-4">Quant. de metros produzidos:</div>
                                <div className="text-left">{totalMeters.toFixed(0)} metros</div>

                                <div className="text-right pr-4">Tempo por peça:</div>
                                <div className="text-left font-mono">{formatDuration(timePerPieceSeconds * 1000)}</div>

                                <div className="text-right pr-4">Velocidade:</div>
                                <div className="text-left">{velocityMMin.toFixed(1)} metros/ minuto</div>
                            </div>
                        </div>

                        {/* Production Updates Table */}
                        <div className="border border-black p-2">
                            <h3 className="text-center italic underline font-bold mb-1 text-sm">ATUALIZAÇÃO DA PRODUÇÃO:</h3>
                            <div className="text-center font-bold mb-2 text-sm">Qntidade de peças a produzir: {reportData.quantityToProduce || '-'} treliças</div>

                            <table className="w-full max-w-lg mx-auto border-collapse border border-black text-center text-sm font-bold">
                                <thead>
                                    <tr className="border-b border-black">
                                        <th className="border-r border-black p-1 w-20">Qnt.</th>
                                        <th className="border-r border-black p-1 w-20">peso</th>
                                        <th className="border-r border-black p-1 w-20">media</th>
                                        <th className="p-1">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionItems.length > 0 ? productionItems.map((pkg, idx) => (
                                        <tr key={idx} className="border-b border-black">
                                            <td className="border-r border-black p-1">{pkg.quantity}</td>
                                            <td className="border-r border-black p-1">{pkg.weight.toFixed(0)}</td>
                                            <td className="border-r border-black p-1">{(pkg.weight / pkg.quantity).toFixed(2)}</td>
                                            <td className="p-1">{new Date(pkg.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                                        </tr>
                                    )) : (
                                        <tr className="border-b border-black">
                                            <td className="border-r border-black p-1">{totalPieces}</td>
                                            <td className="border-r border-black p-1">{(reportData.actualProducedWeight || 0).toFixed(0)}</td>
                                            <td className="border-r border-black p-1">{totalPieces > 0 ? ((reportData.actualProducedWeight || 0) / totalPieces).toFixed(2) : '-'}</td>
                                            <td className="p-1">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                                        </tr>
                                    )}
                                </tbody>
                                {productionItems.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td className="border-r border-black p-1">{totalPackageQty}</td>
                                            <td className="border-r border-black p-1">{totalPackageWeight.toFixed(0)}</td>
                                            <td className="border-r border-black p-1">{averageWeight.toFixed(2)}</td>
                                            <td className="p-1"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Trefila Specific Layout
    if (reportData.machine === 'Trefila') {
        const inputWeight = consumedLots?.reduce((sum, lot) => sum + lot.originalWeight, 0) || 0;
        const outputWeight = consumedLots?.reduce((sum, lot) => sum + (lot.finalWeight || 0), 0) || 0;
        const scrapWeight = inputWeight - outputWeight;
        const scrapPercentage = inputWeight > 0 ? (scrapWeight / inputWeight) * 100 : 0;
        const velocity = effectiveTimeMs > 0 ? totalMetersProduced / (effectiveTimeMs / 1000) : 0;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
                <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
                        <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Produção - Trefila</h2>
                        <div className="flex gap-3">
                            <button onClick={() => window.print()} className="bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2">
                                <PrinterIcon className="h-5 w-5" /> Imprimir
                            </button>
                            <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                        </div>
                    </div>

                    <div className="overflow-y-auto print-section bg-white p-2 font-sans text-sm text-black">
                        {/* Header */}
                        <div className="border-2 border-black mb-1 p-2 text-center">
                            {/* Optional Logo Placeholder if needed, but user asked to remove specific branding previously. Keeping layout generic as per structure request. */}
                            {/* If strictly following image structure, top part is title */}
                            <h1 className="text-xl font-bold uppercase">Controle de Produção Diaria - Setor Laminação</h1>
                            <h2 className="text-lg font-bold uppercase">Trefila</h2>
                        </div>

                        {/* Order Info Table */}
                        <table className="w-full border-collapse border-2 border-black mb-1 text-center font-bold">
                            <tbody>
                                <tr className="border-b border-black">
                                    <td className="p-1">Ordem de produção : {reportData.orderNumber}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1">
                                        Data da produção: {reportData.startTime ? new Date(reportData.startTime).toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-1">Operador/auxiliar: {operatorNames}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Product Desc Table */}
                        <div className="border-2 border-black mb-4 font-bold">
                            <div className="border-b border-black p-1 pl-2">
                                Descrição do produto (entrada): <span className="text-red-600">{inputBitola}mm -- FIO MAQUINA--</span>
                            </div>
                            <div className="p-1 pl-2">
                                Descrição do produto (Saída): <span className="text-green-600">{reportData.targetBitola}mm ---CA60--</span>
                            </div>
                        </div>

                        {/* Paradas */}
                        <div className="mb-4">
                            <h3 className="text-center font-bold italic underline mb-1">PARADAS E SEUS MOTIVOS:</h3>
                            <table className="w-full border-collapse border border-black text-xs text-center font-bold">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="border border-black p-1 w-20">INÍCIO</th>
                                        <th className="border border-black p-1 w-20">FIM</th>
                                        <th className="border border-black p-1">MOTIVO</th>
                                        <th className="border border-black p-1 w-20">DURAÇÃO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reportData.downtimeEvents || []).map((event, idx) => {
                                        if (!event.resumeTime) return null;
                                        const duration = new Date(event.resumeTime).getTime() - new Date(event.stopTime).getTime();
                                        return (
                                            <tr key={idx}>
                                                <td className="border border-black p-1 text-red-600">
                                                    {new Date(event.stopTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                                <td className="border border-black p-1 text-green-600">
                                                    {new Date(event.resumeTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                                <td className="border border-black p-1 uppercase italic">{event.reason}</td>
                                                <td className="border border-black p-1 text-red-600 font-mono">{formatDuration(duration)}</td>
                                            </tr>
                                        );
                                    })}
                                    {(!reportData.downtimeEvents || reportData.downtimeEvents.length === 0) && (
                                        <tr><td colSpan={4} className="border border-black p-1 text-center italic">Nenhuma parada registrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Estatística do Dia */}
                        <div className="mb-4 border border-black p-2">
                            <h3 className="text-center font-bold italic underline mb-2">ESTATÍSTICA DO DIA:</h3>
                            <div className="grid grid-cols-[2fr_1fr_1fr] gap-x-2 gap-y-1 w-full max-w-lg mx-auto font-bold text-sm">
                                <div className="text-right">Horas (Turno trabalhados):</div>
                                <div className="text-center font-mono">{formatDuration(totalDurationMs)}</div>
                                <div></div>

                                <div className="text-right">Tempo de maquina (parada) :</div>
                                <div className="text-center text-red-600 font-mono">{formatDuration(totalDowntimeMs)}</div>
                                <div className="text-red-600">{totalDurationMs > 0 ? ((totalDowntimeMs / totalDurationMs) * 100).toFixed(1) : 0}%</div>

                                <div className="text-right">Tempo de maquina (Efetivo) :</div>
                                <div className="text-center text-green-600 font-mono">{formatDuration(effectiveTimeMs)}</div>
                                <div className="text-green-600">{totalDurationMs > 0 ? ((effectiveTimeMs / totalDurationMs) * 100).toFixed(1) : 0}%</div>

                                <div className="text-right">Peso entrada:</div>
                                <div className="text-center">{inputWeight.toFixed(0)} kg</div>
                                <div></div>

                                <div className="text-right">Peso saida:</div>
                                <div className="text-center">{outputWeight.toFixed(0)} kg</div>
                                <div></div>

                                <div className="text-right">sucata:</div>
                                <div className="text-center text-red-600">{scrapWeight.toFixed(2)} kg</div>
                                <div className="text-red-600">{scrapPercentage.toFixed(2)}%</div>

                                <div className="text-right">Quant. metros produzidos:</div>
                                <div className="text-center">{totalMetersProduced.toFixed(0)} metros</div>
                                <div></div>

                                <div className="text-right">Velocidade:</div>
                                <div className="text-center">{velocity.toFixed(2)} m/s</div>
                                <div></div>
                            </div>
                        </div>

                        {/* Atualização da Produção */}
                        <div>
                            <h3 className="text-center font-bold italic underline mb-1">ATUALIZAÇÃO DA PRODUÇÃO:</h3>
                            <table className="w-full border-collapse border border-black text-sm text-center font-bold mx-auto max-w-2xl">
                                <thead>
                                    <tr className="bg-white border-b-2 border-black">
                                        <th className="border border-black p-1">Data</th>
                                        <th className="border border-black p-1">kg (entrada)</th>
                                        <th className="border border-black p-1">kg (saída)</th>
                                        <th className="border border-black p-1">bitola</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyBreakdown.map((day, dIdx) => (
                                        <React.Fragment key={dIdx}>
                                            {day.lots.map((lot, lIdx) => (
                                                <tr key={lot.lotId}>
                                                    {lIdx === 0 && (
                                                        <td className="border border-black p-1 align-middle" rowSpan={day.lots.length}>
                                                            {new Date(day.date.split('/').reverse().join('-')).toLocaleDateString('pt-BR')}
                                                        </td>
                                                    )}
                                                    <td className="border border-black p-1">{(lot as any).originalWeight?.toFixed(0) || '-'}</td>
                                                    <td className="border border-black p-1">{lot.finalWeight?.toFixed(0) || '-'}</td>
                                                    <td className="border border-black p-1">{(lot as any).measuredGauge ? (lot as any).measuredGauge.toFixed(2) + 'mm' : '-'}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 text-red-600">
                                                <td className="border border-black p-1 text-right italic" colSpan={4}>
                                                    Subtotal Dia: {day.lots.reduce((acc, l) => acc + (l.finalWeight || 0), 0).toFixed(0)} kg
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-black bg-white">
                                        <td className="border border-black p-1 font-bold text-red-600 text-lg">Total</td>
                                        <td className="border border-black p-1 font-bold text-red-600 text-lg">{inputWeight.toFixed(0)}</td>
                                        <td className="border border-black p-1 font-bold text-red-600 text-lg">{outputWeight.toFixed(0)}</td>
                                        <td className="border border-black p-1"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default Layout (Treliça and others)
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
                    <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Ordem de Produção</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
                            title="Imprimir / Salvar PDF"
                        >
                            <PrinterIcon className="h-5 w-5" />
                            <span>Imprimir</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto print-section bg-white p-6">
                    <div className="flex items-start justify-end mb-8 pb-6 border-b-2 border-[#0F3F5C]">
                        <div className="text-right">
                            <p className="text-2xl font-bold text-[#0F3F5C] mb-1">RELATÓRIO DE PRODUÇÃO</p>
                            <p className="text-sm text-slate-600">
                                <span className="font-semibold">Gerado em:</span><br />
                                {new Date().toLocaleString('pt-BR')}
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-[#e6f0f5] to-[#fff3e6] border-l-4 border-[#FF8C00] rounded-lg p-5 mb-6 shadow-sm">
                        <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            Dados da Ordem
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Nº Ordem</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{reportData.orderNumber}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Máquina</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{reportData.machine}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm col-span-2">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Operador(es)</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{operatorNames}</p>
                            </div>
                            {reportData.machine === 'Treliça' ? (
                                <>
                                    <div className="bg-white p-3 rounded-lg shadow-sm">
                                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Modelo</p>
                                        <p className="text-sm font-bold text-[#0F3F5C]">{reportData.trelicaModel}</p>
                                    </div>
                                    {reportData.quantityToProduce && (
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Qtd. Planejada</p>
                                            <p className="text-sm font-bold text-[#0F3F5C]">{reportData.quantityToProduce} pcs</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="bg-white p-3 rounded-lg shadow-sm">
                                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Bitola Entrada</p>
                                        <p className="text-sm font-bold text-[#0F3F5C]">{inputBitola}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg shadow-sm">
                                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Bitola Saída</p>
                                        <p className="text-sm font-bold text-[#0F3F5C]">{reportData.targetBitola}</p>
                                    </div>
                                    {averageMeasuredGauge && (
                                        <div className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Média Aferida</p>
                                            <p className="text-sm font-bold text-[#0F3F5C]">{averageMeasuredGauge.toFixed(2)} mm</p>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Status</p>
                                <span className="inline-block px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">Concluída</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm col-span-2 md:col-span-1">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Início</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{reportData.startTime ? new Date(reportData.startTime).toLocaleString('pt-BR') : 'N/A'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm col-span-2">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Fim</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{reportData.endTime ? new Date(reportData.endTime).toLocaleString('pt-BR') : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                            </svg>
                            Indicadores de Desempenho
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div className="bg-slate-100 p-4 rounded-lg shadow-sm border border-slate-200">
                                <div className="text-xs text-slate-500 font-bold uppercase mb-1">Aproveitamento</div>
                                <div className="text-2xl font-bold text-[#0F3F5C]">{yieldPercentage.toFixed(2)}%</div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-lg shadow-sm border border-emerald-100">
                                <div className="text-xs text-emerald-700 font-bold uppercase mb-1">Produção (kg)</div>
                                <div className="text-2xl font-bold text-emerald-800">{(reportData.actualProducedWeight || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-sky-50 p-4 rounded-lg shadow-sm border border-sky-100">
                                <div className="text-xs text-sky-700 font-bold uppercase mb-1">Produção (m)</div>
                                <div className="text-2xl font-bold text-sky-800">{totalMetersProduced.toFixed(2)}</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-100">
                                <div className="text-xs text-green-700 font-bold uppercase mb-1">Tempo Efetivo</div>
                                <div className="text-2xl font-bold text-green-800">{formatDuration(effectiveTimeMs)}</div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100">
                                <div className="text-xs text-red-700 font-bold uppercase mb-1">Tempo Parado</div>
                                <div className="text-2xl font-bold text-red-800">{formatDuration(totalDowntimeMs)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3">
                            <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                </svg>
                                Detalhamento da Produção
                            </h3>
                            {dailyBreakdown.length > 0 ? (
                                <div className="space-y-4">
                                    {dailyBreakdown.map((day, index) => (
                                        <div key={index} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="bg-gradient-to-r from-[#0F3F5C] to-[#1A5A7D] p-3 flex justify-between items-center text-white">
                                                <h4 className="font-bold">Dia: {day.date}</h4>
                                                <div className="text-right text-sm">
                                                    <p><strong>Lotes:</strong> {day.lots.length} | <strong>Peso:</strong> {day.totalWeight.toFixed(2)} kg</p>
                                                </div>
                                            </div>
                                            <table className="w-full text-sm text-left text-slate-600">
                                                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-2">Lote Interno</th>
                                                        {reportData.machine?.toLowerCase() === 'trefila' && <th className="px-4 py-2 text-right">Bit. Aferida</th>}
                                                        <th className="px-4 py-2 text-right">Peso Saída (kg)</th>
                                                        <th className="px-4 py-2 text-right">Perda (%)</th>
                                                        <th className="px-4 py-2 text-right">T. Efetivo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {day.lots.map(lot => {
                                                        const difference = lot.originalWeight - (lot.finalWeight || 0);
                                                        const lossPercentage = lot.originalWeight > 0 ? (difference / lot.originalWeight) * 100 : 0;
                                                        return (
                                                            <tr key={lot.lotId} className="bg-white hover:bg-slate-50">
                                                                <td className="px-4 py-2 font-medium text-[#0F3F5C]">{lot.internalLot}</td>
                                                                {reportData.machine?.toLowerCase() === 'trefila' && <td className="px-4 py-2 text-right text-slate-600">{(lot as any).measuredGauge ? `${(lot as any).measuredGauge.toFixed(2)} mm` : '-'}</td>}
                                                                <td className="px-4 py-2 text-right font-bold">{lot.finalWeight?.toFixed(2) || 'N/A'}</td>
                                                                <td className={`px-4 py-2 text-right font-medium ${difference >= 0 ? 'text-red-600' : 'text-green-600'}`}>{lossPercentage.toFixed(2)}%</td>
                                                                <td className="px-4 py-2 text-right font-mono text-slate-500">{formatDuration(lot.effectiveDurationMs)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded text-center">Nenhum lote processado para esta ordem.</p>}
                            <div className="font-semibold text-white bg-[#0F3F5C] rounded-lg mt-4 p-3 flex justify-between shadow-sm">
                                <span>Total Geral</span>
                                <div className="text-right">
                                    <span>{totalProducedWeight.toFixed(2)} kg</span> / <span className="font-mono">{formatDuration(effectiveTimeMs)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Paradas
                            </h3>
                            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-white uppercase bg-slate-500">
                                        <tr>
                                            <th className="px-4 py-2">Motivo</th>
                                            <th className="px-4 py-2 text-right">Duração</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(reportData.downtimeEvents || []).map((event, index) => {
                                            if (!event.resumeTime) return null;
                                            const duration = new Date(event.resumeTime).getTime() - new Date(event.stopTime).getTime();
                                            if (duration <= 0) return null;
                                            return (
                                                <tr key={index} className="bg-white hover:bg-slate-50">
                                                    <td className="px-4 py-2">{event.reason}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-700">{formatDuration(duration)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot className="font-semibold text-[#0F3F5C] bg-slate-100 border-t-2 border-slate-300">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Total Parado</th>
                                            <th className="px-4 py-2 text-right font-mono">{formatDuration(totalDowntimeMs)}</th>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t-2 border-slate-200 text-center text-sm text-slate-500 no-print">
                        <p className="text-xs mt-1">Confiabilidade e Qualidade em Aço</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductionOrderReport;