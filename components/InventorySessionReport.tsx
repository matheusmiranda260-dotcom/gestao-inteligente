import React from 'react';
import { createPortal } from 'react-dom';
import type { InventorySession } from '../types';
import { PrinterIcon, CheckCircleIcon, XCircleIcon, ChatBubbleLeftRightIcon } from './icons';

interface InventorySessionReportProps {
    session: InventorySession;
    onClose: () => void;
}

const InventorySessionReport: React.FC<InventorySessionReportProps> = ({ session, onClose }) => {
    const totalSystemWeight = session.auditedLots.reduce((acc, lot) => acc + lot.systemWeight, 0);
    const totalPhysicalWeight = session.auditedLots.reduce((acc, lot) => acc + lot.physicalWeight, 0);
    const totalDiff = totalPhysicalWeight - totalSystemWeight;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] print-modal-container">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
                {/* Header with actions */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
                    <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Inventário Físico</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
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

                {/* Printable Content */}
                <div className="overflow-y-auto print-section bg-white flex flex-col h-full font-sans text-black">
                    <div className="p-4 w-full h-full flex flex-col">

                        {/* 1. Header Information */}
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-black uppercase tracking-tight">RELATÓRIO DE INVENTÁRIO</h1>
                                <p className="text-sm font-bold text-slate-600 uppercase">Gestão Inteligente MSM</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-black text-slate-400 uppercase">ID da Sessão:</span>
                                <span className="font-mono font-bold text-lg">{session.id}</span>
                            </div>
                        </div>

                        {/* 2. Key Info Boxes */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div className="border-2 border-slate-900 p-2">
                                <span className="block text-[10px] font-black uppercase text-slate-500">Material</span>
                                <span className="text-base font-black uppercase">{session.materialType}</span>
                            </div>
                            <div className="border-2 border-slate-900 p-2">
                                <span className="block text-[10px] font-black uppercase text-slate-500">Bitola</span>
                                <span className="text-base font-black">{session.bitola}</span>
                            </div>
                            <div className="border-2 border-slate-900 p-2">
                                <span className="block text-[10px] font-black uppercase text-slate-500">Data Finalização</span>
                                <span className="text-base font-black">{new Date(session.endDate || '').toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
                                <span className="block text-[10px] font-black uppercase text-slate-500">Conferidos</span>
                                <span className="text-base font-black text-blue-600">{session.checkedCount} / {session.itemsCount}</span>
                            </div>
                        </div>

                        {/* 3. Detailed Lots Table */}
                        <div className="flex-grow">
                            <table className="w-full text-base text-left border-collapse">
                                <thead className="text-sm text-black uppercase font-black border-y-2 border-slate-900">
                                    <tr>
                                        <th className="px-2 py-2 border-r border-slate-300 w-12 text-center">#</th>
                                        <th className="px-2 py-2 border-r border-slate-300 w-32 text-center">Lote Interno</th>
                                        <th className="px-2 py-2 border-r border-slate-300 text-right w-32">Peso Sistema (kg)</th>
                                        <th className="px-2 py-2 border-r border-slate-300 text-right w-32">Peso Físico (kg)</th>
                                        <th className="px-2 py-2 border-r border-slate-300 text-right w-24">Diferença</th>
                                        <th className="px-2 py-2">Observações / Comentários</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {session.auditedLots.map((lot, index) => {
                                        const diff = lot.physicalWeight - lot.systemWeight;
                                        const hasDiff = Math.abs(diff) > 0.01;
                                        const isExtra = lot.systemWeight === 0 && lot.physicalWeight > 0;
                                        const isNotFound = lot.physicalWeight === 0 && lot.systemWeight > 0;

                                        return (
                                            <tr key={index} className={`border-b border-slate-200 ${isExtra ? 'bg-amber-50' : isNotFound ? 'bg-rose-50' : ''}`}>
                                                <td className="px-2 py-2 border-r border-slate-300 text-center text-sm font-bold">{index + 1}</td>
                                                <td className="px-2 py-2 border-r border-slate-300 text-center relative">
                                                    <div className="font-black tracking-wider text-lg text-[#0F3F5C]">{lot.internalLot}</div>
                                                    {isExtra && (
                                                        <div className="text-[10px] bg-amber-600 text-white font-black px-1.5 py-0.5 rounded absolute top-0.5 right-0.5 leading-tight no-print">
                                                            NOVO
                                                        </div>
                                                    )}
                                                    {isNotFound && (
                                                        <div className="text-[10px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded absolute top-0.5 right-0.5 leading-tight no-print">
                                                            NÃO ENCONTRADO
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border-r border-slate-300 text-right font-bold text-base">
                                                    {isExtra ? (
                                                        <span className="text-amber-600 font-black text-xs uppercase">LOTE NÃO CADASTRADO</span>
                                                    ) : (
                                                        lot.systemWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border-r border-slate-300 text-right font-black text-lg">
                                                    {isNotFound ? (
                                                        <span className="text-rose-600 uppercase font-black text-xs">Lote em Falta</span>
                                                    ) : (
                                                        lot.physicalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
                                                    )}
                                                </td>
                                                <td className={`px-2 py-2 border-r border-slate-300 text-right font-black text-lg ${hasDiff ? (diff > 0 ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-400'}`}>
                                                    {isExtra ? (
                                                        <span className="text-amber-700">+{lot.physicalWeight.toFixed(0)}</span>
                                                    ) : isNotFound ? (
                                                        <span className="text-rose-700">-{lot.systemWeight.toFixed(0)}</span>
                                                    ) : (
                                                        <>{diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 italic text-slate-700">
                                                    {isExtra && <span className="text-amber-800 font-black not-italic text-xs block mb-1 uppercase tracking-tighter">⚠️ VERIFICAÇÃO NECESSÁRIA: Lote encontrado no físico porém não estava no sistema.</span>}
                                                    {isNotFound && <span className="text-rose-800 font-black not-italic text-xs block mb-1 uppercase tracking-tighter">🚨 ALERTA CRÍTICO: Lote registrado no sistema mas NÃO FOI LOCALIZADO no pátio.</span>}
                                                    {lot.observation ? (
                                                        <div className={`flex items-start gap-1.5 ${isNotFound ? 'bg-rose-100/50' : 'bg-rose-50'} p-1.5 rounded border ${isNotFound ? 'border-rose-200' : 'border-rose-100'}`}>
                                                            <ChatBubbleLeftRightIcon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                            <span className="text-rose-900 font-bold not-italic text-sm">{lot.observation}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-black">
                                    <tr>
                                        <td colSpan={2} className="px-2 py-3 text-right uppercase text-xs">Totais da Sessão:</td>
                                        <td className="px-2 py-3 text-right text-base">{totalSystemWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} kg</td>
                                        <td className="px-2 py-3 text-right text-lg">{totalPhysicalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} kg</td>
                                        <td className={`px-2 py-3 text-right text-lg ${totalDiff > 0 ? 'text-emerald-700' : totalDiff < 0 ? 'text-rose-700' : ''}`}>
                                            {totalDiff > 0 ? '+' : ''}{totalDiff.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} kg
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* 4. Footer Section */}
                        <div className="mt-12 grid grid-cols-2 gap-12 no-break">
                            <div className="text-center">
                                <div className="border-b-2 border-slate-900 mb-2 h-10 w-full mx-auto"></div>
                                <span className="text-[10px] font-black uppercase text-slate-500">Assinatura Encarregado {session.operator}</span>
                            </div>
                            <div className="text-center">
                                <div className="border-b-2 border-slate-900 mb-2 h-10 w-full mx-auto"></div>
                                <span className="text-[10px] font-black uppercase text-slate-500">Assinatura Gestão / Conferente</span>
                            </div>
                        </div>

                        <div className="mt-auto pt-8 flex justify-between items-end border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <span>Relatório gerado em: {new Date().toLocaleString('pt-BR')}</span>
                            <span>Página 1 de 1</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default InventorySessionReport;
