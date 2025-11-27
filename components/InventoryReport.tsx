import React, { useMemo } from 'react';
import type { StockItem } from '../types';
import { PrinterIcon } from './icons';
import { LogoIcon } from './Logo';

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
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
                <div className="flex justify-between items-center mb-4 pb-4 border-b no-print">
                    <h2 className="text-2xl font-bold text-slate-800">Relatório de Inventário de Estoque</h2>
                    <div>
                        <button
                            onClick={() => window.print()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 mr-4"
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
                    <div className="flex items-center justify-between mb-6">
                        <LogoIcon className="h-16 w-16 text-slate-800" />
                        <div className="text-right">
                            <h1 className="text-2xl font-bold text-black">MSM - Gestão de Produção</h1>
                            <p className="text-lg text-slate-700">Ficha de Conferência de Estoque</p>
                            <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold mb-3">Filtros Aplicados</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><strong>Status:</strong> {filters.statusFilter || 'Todos'}</div>
                            <div><strong>Material:</strong> {filters.materialFilter || 'Todos'}</div>
                            <div><strong>Bitola:</strong> {filters.bitolaFilter || 'Todas'}</div>
                            <div><strong>Busca:</strong> {filters.searchTerm || '-'}</div>
                        </div>
                    </div>

                    <div>
                        <table className="w-full text-sm text-left text-slate-600 border-collapse border border-slate-300">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th className="px-2 py-2 border border-slate-300">Lote Interno</th>
                                    <th className="px-2 py-2 border border-slate-300">Tipo de Material</th>
                                    <th className="px-2 py-2 border border-slate-300">Bitola</th>
                                    <th className="px-2 py-2 border border-slate-300">Fornecedor</th>
                                    <th className="px-2 py-2 border border-slate-300 text-right">Peso Sistema (kg)</th>
                                    <th className="px-2 py-2 border border-slate-300 w-32 text-center">Peso Físico</th>
                                    <th className="px-2 py-2 border border-slate-300 w-24 text-center">Diferença</th>
                                    <th className="px-2 py-2 border border-slate-300 w-40">Observações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStock.map((item) => (
                                    <tr key={item.id} className="bg-white border-b border-slate-300">
                                        <td className="px-2 py-2 border border-slate-300 font-medium text-slate-900">{item.internalLot}</td>
                                        <td className="px-2 py-2 border border-slate-300">{item.materialType}</td>
                                        <td className="px-2 py-2 border border-slate-300">{item.bitola}</td>
                                        <td className="px-2 py-2 border border-slate-300">{item.supplier}</td>
                                        <td className="px-2 py-2 border border-slate-300 text-right font-bold">{item.remainingQuantity.toFixed(2)}</td>
                                        <td className="px-2 py-2 border border-slate-300"></td>
                                        <td className="px-2 py-2 border border-slate-300"></td>
                                        <td className="px-2 py-2 border border-slate-300"></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-semibold text-slate-900 bg-slate-50 border-t-2 border-slate-300">
                                    <th colSpan={4} className="px-4 py-2 text-base text-right border border-slate-300">Total Sistema:</th>
                                    <td className="px-2 py-2 text-base text-right font-bold border border-slate-300">{totalSystemWeight.toFixed(2)} kg</td>
                                    <td colSpan={3} className="border border-slate-300"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="mt-12 pt-8 text-center flex justify-around">
                        <div className="inline-block">
                            <div className="border-t border-slate-500 w-64"></div>
                            <p className="text-sm mt-1">Conferente</p>
                        </div>
                        <div className="inline-block">
                            <div className="border-t border-slate-500 w-64"></div>
                            <p className="text-sm mt-1">Gestor Responsável</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryReport;
