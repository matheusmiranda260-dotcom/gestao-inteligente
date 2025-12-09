import React, { useMemo } from 'react';
import type { StockItem } from '../types';
import { PrinterIcon } from './icons';
import MSMLogo from './MSMLogo';

interface InventoryReportProps {
    stock: StockItem[];
    filters: {
        searchTerm: string;
        statusFilter: string;
        materialFilter: string;
        bitolaFilter: string;
    };
    onClose: () => void;
}

const InventoryReport: React.FC<InventoryReportProps> = ({ stock, filters, onClose }) => {
    const filteredStock = useMemo(() => {
        return stock
            .filter(item => {
                const term = filters.searchTerm.toLowerCase();
                return (
                    item.internalLot.toLowerCase().includes(term) ||
                    item.supplierLot.toLowerCase().includes(term) ||
                    item.supplier.toLowerCase().includes(term) ||
                    item.nfe.toLowerCase().includes(term)
                );
            })
            .filter(item => filters.statusFilter === '' || item.status === filters.statusFilter)
            .filter(item => filters.materialFilter === '' || item.materialType === filters.materialFilter)
            .filter(item => filters.bitolaFilter === '' || item.bitola === filters.bitolaFilter)
            .sort((a, b) => {
                // Sort by Material, then Bitola, then Internal Lot
                if (a.materialType !== b.materialType) return a.materialType.localeCompare(b.materialType);
                if (a.bitola !== b.bitola) return parseFloat(a.bitola) - parseFloat(b.bitola);
                return a.internalLot.localeCompare(b.internalLot);
            });
    }, [stock, filters]);

    const totalSystemWeight = filteredStock.reduce((acc, item) => acc + item.remainingQuantity, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col print-modal-content">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
                    <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Inventário de Estoque</h2>
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

                <div className="overflow-y-auto print-section bg-white p-4">
                    {/* Professional Header */}
                    <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#0F3F5C]">
                        <div className="flex items-center gap-4">
                            {/* Logo removed as requested */}
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-[#0F3F5C] mb-1">FICHA DE CONFERÊNCIA</p>
                            <p className="text-lg font-semibold text-[#FF8C00]">Inventário de Estoque</p>
                            <p className="text-sm text-slate-600 mt-2">
                                <span className="font-semibold">Data:</span><br />
                                {new Date().toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Applied Filters */}
                    <div className="bg-gradient-to-r from-[#e6f0f5] to-[#fff3e6] border-l-4 border-[#FF8C00] rounded-lg p-5 mb-6 shadow-sm">
                        <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                            </svg>
                            Filtros Aplicados
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Status</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{filters.statusFilter || 'Todos'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Material</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{filters.materialFilter || 'Todos'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Bitola</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{filters.bitolaFilter || 'Todas'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Busca</p>
                                <p className="text-sm font-bold text-[#0F3F5C]">{filters.searchTerm || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <div className="mb-6">
                        <style>
                            {`
                                @media print {
                                    @page {
                                        size: A4;
                                        margin: 10mm;
                                    }
                                    .print-modal-container {
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        width: 100%;
                                        height: 100%;
                                        background: white;
                                        z-index: 9999;
                                    }
                                    .print-modal-content {
                                        box-shadow: none;
                                        max-width: none;
                                        width: 100%;
                                        height: auto;
                                        overflow: visible;
                                    }
                                    .no-print {
                                        display: none !important;
                                    }
                                    .print-section {
                                        overflow: visible !important;
                                    }
                                    body {
                                        background-color: white;
                                    }
                                }
                            `}
                        </style>

                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-bold text-[#0F3F5C] flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                Itens em Estoque
                            </h3>
                            <div className="bg-[#e6f0f5] px-4 py-2 rounded-lg border border-[#0F3F5C]/20">
                                <span className="text-sm font-semibold text-slate-600 mr-2">Total de Lotes:</span>
                                <span className="text-xl font-bold text-[#0F3F5C]">{filteredStock.length}</span>
                            </div>
                        </div>

                        <div className="border border-[#0F3F5C]/20 rounded-lg overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-xs text-white uppercase bg-gradient-to-r from-[#0F3F5C] to-[#1A5A7D]">
                                    <tr>
                                        <th className="px-2 py-2 border-r border-white/20">Lote Interno</th>
                                        <th className="px-2 py-2 border-r border-white/20">Material</th>
                                        <th className="px-2 py-2 border-r border-white/20">Bitola</th>
                                        <th className="px-2 py-2 border-r border-white/20">Fornecedor</th>
                                        <th className="px-2 py-2 border-r border-white/20 text-right">Peso Sistema (kg)</th>
                                        <th className="px-2 py-2 border-r border-white/20 w-32 text-center bg-[#FF8C00]/30">Peso Físico</th>
                                        <th className="px-2 py-2 border-r border-white/20 w-24 text-center bg-[#FF8C00]/30">Diferença</th>
                                        <th className="px-2 py-2 w-40 bg-[#FF8C00]/30">Observações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(filteredStock.reduce<Record<string, StockItem[]>>((acc, item) => {
                                        const type = item.materialType;
                                        if (!acc[type]) acc[type] = [];
                                        acc[type].push(item);
                                        return acc;
                                    }, {})).map(([type, items]) => (
                                        <React.Fragment key={type}>
                                            <tr className="bg-[#e6f0f5] font-bold text-[#0F3F5C]">
                                                <td colSpan={8} className="px-3 py-2 border-b border-[#0F3F5C]/20">
                                                    {type} <span className="text-xs font-normal text-slate-500 ml-2">({items.length} lotes)</span>
                                                </td>
                                            </tr>
                                            {items.map((item, index) => (
                                                <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200`}>
                                                    <td className="px-2 py-2 border-r border-slate-200 font-bold text-[#0F3F5C]">{item.internalLot}</td>
                                                    <td className="px-2 py-2 border-r border-slate-200 text-slate-700">{item.materialType}</td>
                                                    <td className="px-2 py-2 border-r border-slate-200 font-semibold text-slate-900">{item.bitola}</td>
                                                    <td className="px-2 py-2 border-r border-slate-200 text-slate-700">{item.supplier}</td>
                                                    <td className="px-2 py-2 border-r border-slate-200 text-right font-bold text-[#FF8C00]">{item.remainingQuantity.toFixed(2)}</td>
                                                    <td className="px-2 py-2 border-r border-slate-200 bg-[#fff3e6]/30"></td>
                                                    <td className="px-2 py-2 border-r border-slate-200 bg-[#fff3e6]/30"></td>
                                                    <td className="px-2 py-2 bg-[#fff3e6]/30"></td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                                <tfoot className="bg-[#e6f0f5]">
                                    <tr className="border-t-2 border-[#0F3F5C]">
                                        <th colSpan={4} className="px-4 py-3 text-lg text-right font-bold text-[#0F3F5C] border-r border-[#0F3F5C]/20">
                                            Total ({filteredStock.length} lotes):
                                        </th>
                                        <td className="px-2 py-3 text-right border-r border-[#0F3F5C]/20">
                                            <div className="inline-block px-3 py-1 rounded-lg font-bold text-lg bg-[#FF8C00] text-white shadow-md">
                                                {totalSystemWeight.toFixed(2)} kg
                                            </div>
                                        </td>
                                        <td colSpan={3} className="bg-[#fff3e6]/50"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Signature Section */}
                    <div className="mt-16 pt-10 grid grid-cols-2 gap-32 text-center">
                        <div>
                            <div className="border-t-2 border-[#0F3F5C] pt-2">
                                <p className="text-sm font-semibold text-slate-700">Conferente</p>
                                <p className="text-xs text-slate-500 mt-1">Assinatura e Matrícula</p>
                            </div>
                        </div>
                        <div>
                            <div className="border-t-2 border-[#0F3F5C] pt-2">
                                <p className="text-sm font-semibold text-slate-700">Gestor Responsável</p>
                                <p className="text-xs text-slate-500 mt-1">Assinatura e Carimbo</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t-2 border-slate-200 text-center text-sm text-slate-500">
                        <p className="font-semibold">MSM Indústria - Sistema de Gestão de Produção</p>
                        <p className="text-xs mt-1">Documento gerado automaticamente para conferência física de estoque</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryReport;
