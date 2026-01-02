import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StockItem, Page } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { PrinterIcon, ArrowLeftIcon, SearchIcon, FilterIcon, CheckCircleIcon, XCircleIcon, ScaleIcon, SaveIcon } from './icons';

interface StockInventoryProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
    updateStockItem: (id: string, updates: Partial<StockItem>) => Promise<void>;
}

const StockInventory: React.FC<StockInventoryProps> = ({ stock, setPage, updateStockItem }) => {
    const [mode, setMode] = useState<'report' | 'audit'>('report');
    const [filters, setFilters] = useState({
        searchTerm: '',
        statusFilter: '',
        materialFilter: '',
        bitolaFilter: ''
    });

    // Audit State
    const [auditSearch, setAuditSearch] = useState('');
    const [selectedLot, setSelectedLot] = useState<StockItem | null>(null);
    const [physicalWeight, setPhysicalWeight] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [auditHistory, setAuditHistory] = useState<{ lot: string, status: 'ok' | 'diff', diff: number }[]>([]);
    const auditInputRef = useRef<HTMLInputElement>(null);

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
                if (a.materialType !== b.materialType) return a.materialType.localeCompare(b.materialType);
                if (a.bitola !== b.bitola) return parseFloat(a.bitola) - parseFloat(b.bitola);
                return a.internalLot.localeCompare(b.internalLot);
            });
    }, [stock, filters]);

    const totalSystemWeight = filteredStock.reduce((acc, item) => acc + item.remainingQuantity, 0);

    // Audit Logic
    useEffect(() => {
        if (mode === 'audit' && auditInputRef.current) {
            auditInputRef.current.focus();
        }
    }, [mode, selectedLot]);

    const handleAuditSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const lot = stock.find(s => s.internalLot.toLowerCase() === auditSearch.toLowerCase().trim());
        if (lot) {
            setSelectedLot(lot);
            setPhysicalWeight(lot.remainingQuantity.toFixed(0));
            setAuditSearch('');
        } else {
            alert('Lote não encontrado!');
        }
    };

    const confirmAudit = async () => {
        if (!selectedLot) return;
        setIsSaving(true);
        const newWeight = parseFloat(physicalWeight);
        const diff = newWeight - selectedLot.remainingQuantity;

        try {
            const historyEntry = {
                type: 'Inventário (Conferência)',
                date: new Date().toISOString(),
                details: {
                    'Peso Anterior': `${selectedLot.remainingQuantity.toFixed(2)} kg`,
                    'Peso Informado': `${newWeight.toFixed(2)} kg`,
                    'Diferença': `${diff.toFixed(2)} kg`
                }
            };

            await updateStockItem(selectedLot.id, {
                remainingQuantity: newWeight,
                history: [...(selectedLot.history || []), historyEntry]
            });

            setAuditHistory(prev => [{
                lot: selectedLot.internalLot,
                status: Math.abs(diff) < 0.1 ? 'ok' : 'diff',
                diff: diff
            }, ...prev].slice(0, 5));

            setSelectedLot(null);
            setPhysicalWeight('');
            setAuditSearch('');
        } catch (error) {
            alert('Erro ao salvar conferência.');
        } finally {
            setIsSaving(false);
        }
    };

    if (mode === 'audit') {
        return (
            <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
                <header className="w-full flex items-center justify-between mb-8 max-w-md">
                    <button onClick={() => setMode('report')} className="p-2 bg-slate-800 rounded-full">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-black tracking-tight">CONFERÊNCIA MOBILE</h1>
                    <div className="w-10"></div>
                </header>

                <div className="w-full max-w-md space-y-6">
                    {!selectedLot ? (
                        <form onSubmit={handleAuditSearch} className="space-y-4">
                            <label className="block text-slate-400 text-sm font-bold uppercase tracking-widest text-center">Digite ou Leia o Lote</label>
                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-500" />
                                <input
                                    ref={auditInputRef}
                                    type="text"
                                    value={auditSearch}
                                    onChange={e => setAuditSearch(e.target.value)}
                                    placeholder="Ex: 6315"
                                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl py-5 pl-14 pr-4 text-2xl font-black focus:border-blue-500 outline-none transition-all uppercase"
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                                BUSCAR LOTE
                            </button>
                        </form>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Lot Card */}
                            <div className="bg-white text-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <ScaleIcon className="w-32 h-32" />
                                </div>

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{selectedLot.materialType}</span>
                                        <h2 className="text-4xl font-black mt-1">LOT {selectedLot.internalLot}</h2>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 text-xs font-bold block uppercase">Bitola</span>
                                        <span className="text-2xl font-black text-blue-600">{selectedLot.bitola}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Localização</span>
                                        <span className="text-lg font-black">{selectedLot.location || 'Sem Local'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Peso Sistema</span>
                                        <span className="text-lg font-black text-rose-500">{selectedLot.remainingQuantity.toFixed(0)} kg</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-black text-slate-500 uppercase tracking-widest text-center">Novo Peso Real (kg)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={physicalWeight}
                                        onChange={e => setPhysicalWeight(e.target.value)}
                                        className="w-full bg-slate-100 rounded-3xl py-6 text-center text-5xl font-black text-slate-900 focus:ring-4 ring-blue-500/20 outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                    />

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setSelectedLot(null)}
                                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-600 py-5 rounded-3xl font-black transition-all"
                                        >
                                            CANCELAR
                                        </button>
                                        <button
                                            onClick={confirmAudit}
                                            disabled={isSaving || !physicalWeight}
                                            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                                        >
                                            {isSaving ? 'SALVANDO...' : <><SaveIcon className="h-6 w-6" /> CONFIRMAR</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer History */}
                    {auditHistory.length > 0 && (
                        <div className="pt-8 border-t border-slate-800">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Últimas Batidas</h3>
                            <div className="space-y-3">
                                {auditHistory.map((h, i) => (
                                    <div key={i} className="bg-slate-800/50 p-4 rounded-2xl flex items-center justify-between border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            {h.status === 'ok' ? <CheckCircleIcon className="h-5 w-5 text-emerald-500" /> : <XCircleIcon className="h-5 w-5 text-rose-500" />}
                                            <span className="font-bold">LOTE {h.lot}</span>
                                        </div>
                                        <span className={`text-xs font-black ${h.status === 'ok' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {h.diff === 0 ? 'OK' : `${h.diff > 0 ? '+' : ''}${h.diff.toFixed(1)}kg`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Default Report View
    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 no-print gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage('menu')} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Inventário de Estoque</h1>
                        <p className="text-slate-500 text-sm">Visualize, filtre e realize auditorias físicas.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setMode('audit')}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <ScaleIcon className="h-5 w-5" />
                        <span>FAZER INVENTÁRIO (MOBILE)</span>
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="hidden md:flex bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-2xl border border-slate-300 shadow-sm items-center gap-2 transition-all"
                    >
                        <PrinterIcon className="h-5 w-5" />
                        <span>IMPRIMIR</span>
                    </button>
                </div>
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
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
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
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
                    >
                        <option value="">Todos Materiais</option>
                        {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                        value={filters.bitolaFilter}
                        onChange={e => setFilters({ ...filters, bitolaFilter: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-white font-medium"
                    >
                        <option value="">Todas Bitolas</option>
                        {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print-section">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resumo Total</p>
                        <h2 className="text-xl font-black text-slate-800">{totalSystemWeight.toLocaleString('pt-BR')} kg em estoque</h2>
                    </div>
                    <span className="bg-blue-100 text-blue-700 font-bold px-4 py-1 rounded-full text-xs">
                        {filteredStock.length} lotes encontrados
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-[#0F3F5C] text-white uppercase text-xs font-black">
                            <tr>
                                <th className="px-6 py-4">Lote Interno</th>
                                <th className="px-6 py-4">Fornecedor / NFe</th>
                                <th className="px-6 py-4">Material / Bitola</th>
                                <th className="px-6 py-4">Local</th>
                                <th className="px-6 py-4 text-right">Peso (kg)</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center w-32 bg-[#fff7ed] text-slate-800 border-l border-orange-100 no-print">Conf. Física</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStock.map((item, index) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-800 text-base">{item.internalLot}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{item.supplierLot}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700 font-semibold truncate max-w-[200px]">{item.supplier}</div>
                                        <div className="text-[10px] text-slate-400">NF: {item.nfe}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-800 font-black">{item.materialType}</div>
                                        <div className="text-blue-600 font-black text-lg">{item.bitola}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap ${item.location ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {item.location || 'NÃO MAPEADO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-lg font-black text-[#0F3F5C]">{item.remainingQuantity.toLocaleString('pt-BR')}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md border border-slate-200">
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 bg-[#fff7ed]/30 no-print"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockInventory;
