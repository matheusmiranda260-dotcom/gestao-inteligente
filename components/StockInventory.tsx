import React, { useState, useMemo } from 'react';
import type { StockItem, Page } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { PrinterIcon, ArrowLeftIcon, SearchIcon, FilterIcon } from './icons';

interface StockInventoryProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
}

const StockInventory: React.FC<StockInventoryProps> = ({ stock, setPage }) => {
    const [filters, setFilters] = useState({
        searchTerm: '',
        statusFilter: '',
        materialFilter: '',
        bitolaFilter: ''
    });

    const allBitolaOptions = useMemo(() => [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort(), []);

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
                // Sort by Material, then Bitola, then Internal Lot for report clarity
                if (a.materialType !== b.materialType) return a.materialType.localeCompare(b.materialType);
                if (a.bitola !== b.bitola) return parseFloat(a.bitola) - parseFloat(b.bitola);
                return a.internalLot.localeCompare(b.internalLot);
            });
    }, [stock, filters]);

    const totalSystemWeight = filteredStock.reduce((acc, item) => acc + item.remainingQuantity, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center mb-6 no-print">
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage('menu')} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Relatório de Inventário</h1>
                        <p className="text-slate-500 text-sm">Visualize, filtre e imprima o estoque atual.</p>
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2.5 px-6 rounded-lg shadow-md flex items-center gap-2 transition-all"
                >
                    <PrinterIcon className="h-5 w-5" />
                    <span>Imprimir Relatório</span>
                </button>
            </div>

            {/* Filters Section - Hidden on Print */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center gap-2 mb-4 text-[#0F3F5C] font-bold">
                    <FilterIcon className="h-5 w-5" />
                    <h2>Filtros do Relatório</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por lote, fornecedor..."
                            value={filters.searchTerm}
                            onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
                            className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none"
                        />
                    </div>
                    <select
                        value={filters.statusFilter}
                        onChange={e => setFilters({ ...filters, statusFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white"
                    >
                        <option value="">Todos os Status</option>
                        <option value="Disponível">Disponível</option>
                        <option value="Disponível - Suporte Treliça">Disponível - Suporte Treliça</option>
                        <option value="Em Produção">Em Produção</option>
                        <option value="Transferido">Transferido</option>
                    </select>
                    <select
                        value={filters.materialFilter}
                        onChange={e => setFilters({ ...filters, materialFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white"
                    >
                        <option value="">Todos Materiais</option>
                        {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                        value={filters.bitolaFilter}
                        onChange={e => setFilters({ ...filters, bitolaFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white"
                    >
                        <option value="">Todas Bitolas</option>
                        {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {/* Printable Report Content */}
            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 print-section">

                {/* Print Header */}
                <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#0F3F5C]">
                    <div className="flex items-center gap-4">
                        {/* Logo Placeholder if needed */}
                        <div>
                            <h2 className="text-2xl font-bold text-[#0F3F5C]">MSM GESTÃO INTELIGENTE</h2>
                            <p className="text-sm text-slate-500">Relatório Oficial de Estoque</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-[#0F3F5C] mb-1">FICHA DE CONFERÊNCIA</p>
                        <p className="text-sm text-slate-600 mt-2">
                            <span className="font-semibold">Data de Emissão:</span><br />
                            {new Date().toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                {/* Filters Summary for Print */}
                <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm flex flex-wrap gap-6 print:block hidden">
                    <p><span className="font-bold text-[#0F3F5C]">Filtros:</span></p>
                    {filters.statusFilter && <p>Status: <span className="font-semibold">{filters.statusFilter}</span></p>}
                    {filters.materialFilter && <p>Material: <span className="font-semibold">{filters.materialFilter}</span></p>}
                    {filters.bitolaFilter && <p>Bitola: <span className="font-semibold">{filters.bitolaFilter}</span></p>}
                    {filters.searchTerm && <p>Busca: <span className="font-semibold">{filters.searchTerm}</span></p>}
                    {!filters.statusFilter && !filters.materialFilter && !filters.bitolaFilter && !filters.searchTerm && <p>Nenhum filtro aplicado (Estoque Geral)</p>}
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-bold text-[#0F3F5C] mb-4">
                        Itens Listados: {filteredStock.length}
                    </h3>

                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-[#0F3F5C] text-white uppercase text-xs">
                                <tr>
                                    <th className="px-3 py-2 border-r border-white/20">Lote Interno</th>
                                    <th className="px-3 py-2 border-r border-white/20">Material</th>
                                    <th className="px-3 py-2 border-r border-white/20">Bitola</th>
                                    <th className="px-3 py-2 border-r border-white/20">Fornecedor</th>
                                    <th className="px-3 py-2 border-r border-white/20 text-right">Peso (kg)</th>
                                    <th className="px-3 py-2 border-r border-white/20 text-center w-32 bg-[#fff7ed] text-slate-800 border-b border-b-slate-200 print:bg-transparent print:border-white/20">CONF. FÍSICA</th>
                                    <th className="px-3 py-2 w-40 bg-[#fff7ed] text-slate-800 border-b border-b-slate-200 print:bg-transparent">OBSERVAÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStock.map((item, index) => (
                                    <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 print:bg-white`}>
                                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-700">{item.internalLot}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 text-slate-600">{item.materialType}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 font-semibold text-slate-800">{item.bitola}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 text-slate-600 truncate max-w-[150px]">{item.supplier}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 text-right font-bold text-[#0F3F5C]">{item.remainingQuantity.toFixed(2)}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 bg-[#fff7ed]/50 print:border-slate-300"></td>
                                        <td className="px-3 py-2 bg-[#fff7ed]/50 print:border-slate-300"></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold text-[#0F3F5C]">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-right">TOTAL GERAL:</td>
                                    <td className="px-3 py-3 text-right text-lg border-t-2 border-[#0F3F5C]">{totalSystemWeight.toFixed(2)} kg</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Signature Area for Print */}
                <div className="mt-16 pt-8 grid grid-cols-2 gap-20 text-center print:grid hidden">
                    <div className="border-t border-slate-400 pt-2">
                        <p className="text-sm font-semibold">Responsável pela Conferência</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                        <p className="text-sm font-semibold">Gestor de Estoque</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockInventory;
