import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, User, FinishedGoodsTransferRecord } from '../types';
import { ArrowLeftIcon, ArchiveIcon, TruckIcon, PlusIcon, MinusIcon, TrashIcon, CheckCircleIcon } from './icons';
import { trelicaModels } from './ProductionOrderTrelica';

interface TrelicaStockManagerProps {
    finishedGoods: FinishedProductItem[];
    setPage: (page: Page) => void;
    createFinishedGoodsTransfer: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => FinishedGoodsTransferRecord | null;
    onDelete?: (ids: string[]) => void;
    onUpdateQuantity: (id: string, newQuantity: number) => void;
    onAddManual: (item: Omit<FinishedProductItem, 'id' | 'status' | 'productionDate'>) => void;
    currentUser: User | null;
}

const getStatusBadge = (status: FinishedProductItem['status']) => {
    const styles = {
        'Disponível': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Vendido': 'bg-slate-100 text-slate-800 border-slate-200',
        'Transferido': 'bg-violet-100 text-violet-800 border-violet-200',
    };
    return (
        <span className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border ${styles[status] || styles['Disponível']}`}>
            {status}
        </span>
    );
};

const TrelicaStockManager: React.FC<TrelicaStockManagerProps> = ({ 
    finishedGoods, 
    setPage, 
    createFinishedGoodsTransfer, 
    onDelete, 
    onUpdateQuantity,
    onAddManual,
    currentUser 
}) => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    
    // Form state for manual add
    const [newModel, setNewModel] = useState('');
    const [newSize, setNewSize] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);
    const [newOrderNumber, setNewOrderNumber] = useState('MANUAL');

    const trelicaStock = useMemo(() => 
        finishedGoods.filter(item => item.productType === 'Treliça' && item.quantity > 0), 
        [finishedGoods]
    );

    const handleSelectItem = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId);
            else newSet.add(itemId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.size === trelicaStock.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(trelicaStock.map(i => i.id)));
        }
    };

    const handleAddManual = (e: React.FormEvent) => {
        e.preventDefault();
        const modelInfo = trelicaModels.find(m => m.modelo === newModel && m.tamanho === newSize);
        const weightPerPiece = modelInfo ? parseFloat(modelInfo.pesoFinal.replace(',', '.')) : 0;
        
        onAddManual({
            productType: 'Treliça',
            model: newModel,
            size: newSize,
            quantity: newQuantity,
            totalWeight: weightPerPiece * newQuantity,
            orderNumber: newOrderNumber,
            productionOrderId: 'MANUAL'
        });
        
        setIsAddModalOpen(false);
        setNewModel('');
        setNewSize('');
        setNewQuantity(1);
        setNewOrderNumber('MANUAL');
    };

    const adjustQuantity = (item: FinishedProductItem, delta: number) => {
        const newQty = Math.max(0, item.quantity + delta);
        onUpdateQuantity(item.id, newQty);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8 animate-fade-in">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ArchiveIcon className="h-6 w-6 text-white" />
                        </div>
                        Controle de Estoque Treliça
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-15">Gerenciamento manual e automático de produtos acabados.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        <PlusIcon className="h-5 w-5" /> Adicionar Manual
                    </button>
                    
                    <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    <button 
                        disabled={selectedItems.size === 0}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-2xl border border-slate-200 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <TruckIcon className="h-5 w-5" /> Transferir ({selectedItems.size})
                    </button>

                    {onDelete && (
                        <button 
                            onClick={() => {
                                if(confirm('Tem certeza?')) {
                                    onDelete(Array.from(selectedItems));
                                    setSelectedItems(new Set());
                                }
                            }}
                            disabled={selectedItems.size === 0}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 px-6 rounded-2xl border border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <TrashIcon className="h-5 w-5" /> Excluir
                        </button>
                    )}
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total em Estoque</p>
                    <p className="text-3xl font-black text-indigo-900">
                        {trelicaStock.reduce((acc, i) => acc + i.quantity, 0)} <small className="text-sm">peças</small>
                    </p>
                </div>
                <div className="glass-card p-6 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Peso Total Estimado</p>
                    <p className="text-3xl font-black text-emerald-900">
                        {trelicaStock.reduce((acc, i) => acc + i.totalWeight, 0).toFixed(1)} <small className="text-sm">kg</small>
                    </p>
                </div>
                <div className="glass-card p-6 border-slate-100 bg-gradient-to-br from-slate-50/50 to-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Modelos Ativos</p>
                    <p className="text-3xl font-black text-slate-700">
                        {new Set(trelicaStock.map(i => i.model)).size}
                    </p>
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-card overflow-hidden border-slate-200 shadow-xl bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-widest font-black">
                                <th className="p-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedItems.size === trelicaStock.length && trelicaStock.length > 0}
                                        onChange={handleSelectAll}
                                        className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-500" 
                                    />
                                </th>
                                <th className="px-6 py-4">Data Ref.</th>
                                <th className="px-6 py-4">Modelo / Especificação</th>
                                <th className="px-6 py-4">O.P. / Origem</th>
                                <th className="px-6 py-4 text-center">Tamanho</th>
                                <th className="px-6 py-4 text-center">Quantidade</th>
                                <th className="px-6 py-4 text-right">Peso (kg)</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {trelicaStock.map((item) => (
                                <tr key={item.id} className={`group hover:bg-indigo-50/30 transition-colors ${selectedItems.has(item.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="p-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => handleSelectItem(item.id)}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                        {new Date(item.productionDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 uppercase tracking-tight">{item.model}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">CADASTRO PADRÃO</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.orderNumber === 'MANUAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {item.orderNumber}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-slate-700">
                                        {item.size}m
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => adjustQuantity(item, -1)}
                                                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-white hover:text-red-600 hover:border-red-200 transition-all active:scale-90"
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                            </button>
                                            <span className="w-12 text-center text-lg font-black text-slate-900">{item.quantity}</span>
                                            <button 
                                                onClick={() => adjustQuantity(item, 1)}
                                                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-white hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-90"
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-700">
                                        {item.totalWeight.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => onDelete?.([item.id])}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {trelicaStock.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <ArchiveIcon className="h-10 w-10 text-slate-300" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700">Estoque Vazio</h3>
                                        <p className="text-slate-400 mt-1">Nenhuma treliça encontrada no estoque.</p>
                                        <button 
                                            onClick={() => setIsAddModalOpen(true)}
                                            className="mt-6 text-indigo-600 font-bold hover:underline"
                                        >
                                            Adicionar primeiro item manual
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-modal-in border border-white/20">
                        <div className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                            <h2 className="text-3xl font-black tracking-tight">Adicionar ao Estoque</h2>
                            <p className="text-indigo-100 font-medium opacity-80 mt-1">Entrada manual de produto acabado.</p>
                        </div>
                        
                        <form onSubmit={handleAddManual} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Modelo de Treliça</label>
                                    <select 
                                        required
                                        value={newModel}
                                        onChange={(e) => setNewModel(e.target.value)}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    >
                                        <option value="">Selecione um modelo...</option>
                                        {[...new Set(trelicaModels.map(m => m.modelo))].map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tamanho (m)</label>
                                    <select 
                                        required
                                        disabled={!newModel}
                                        value={newSize}
                                        onChange={(e) => setNewSize(e.target.value)}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50"
                                    >
                                        <option value="">Selecione...</option>
                                        {trelicaModels
                                            .filter(m => m.modelo === newModel)
                                            .map(m => (
                                                <option key={m.tamanho} value={m.tamanho}>{m.tamanho} metros</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Quantidade (pçs)</label>
                                    <input 
                                        type="number" 
                                        required
                                        min="1"
                                        value={newQuantity}
                                        onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lote / Referência</label>
                                    <input 
                                        type="text" 
                                        value={newOrderNumber}
                                        onChange={(e) => setNewOrderNumber(e.target.value.toUpperCase())}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all"
                                >
                                    Salvar Estoque
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrelicaStockManager;
