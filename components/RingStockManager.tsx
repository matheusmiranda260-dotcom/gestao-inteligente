import React, { useState, useEffect } from 'react';
import { fetchTable, insertItem, updateItem, deleteItem } from '../services/supabaseService';
import { TrefilaRingStock } from '../types';
import { TrashIcon, PlusIcon, SaveIcon, XIcon, SearchIcon, AdjustmentsIcon } from './icons';

interface RingStockManagerProps {
    onClose: () => void;
}

const PREDEFINED_MODELS = [
    'CA 3.55', 'CA 4.60', 'CA 5.50',
    'PR 3.20', 'PR 3.40', 'PR 3.70', 'PR 3.80', 'PR 4.10',
    'PR 4.20', 'PR 4.40', 'PR 5.00', 'PR 5.50', 'PR 5.60',
    'PR 5.80', 'PR 6.00',
    'RO 0', 'RO 1', 'RO 2', 'RO 3',
    'ROA 0', 'ROA 1', 'ROA 2',
    'RT 0', 'RT 2', 'RT 3'
];

const RingStockManager: React.FC<RingStockManagerProps> = ({ onClose }) => {
    const [rings, setRings] = useState<TrefilaRingStock[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // New Ring Form
    const [isAdding, setIsAdding] = useState(false);
    const [newModel, setNewModel] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);

    useEffect(() => {
        loadRings();
    }, []);

    const loadRings = async () => {
        setIsLoading(true);
        try {
            const data = await fetchTable<TrefilaRingStock>('trefila_rings_stock');
            setRings(data || []);
        } catch (error) {
            console.error("Erro ao carregar estoque de anéis", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddRing = async () => {
        if (!newModel.trim()) return alert('Selecione ou digite um modelo.');

        try {
            const existing = rings.find(r => r.model.toLowerCase() === newModel.toLowerCase());
            if (existing) {
                const updated = await updateItem<TrefilaRingStock>('trefila_rings_stock', existing.id, {
                    quantity: existing.quantity + newQuantity
                });
                setRings(prev => prev.map(r => r.id === existing.id ? updated : r));
            } else {
                const added = await insertItem<TrefilaRingStock>('trefila_rings_stock', {
                    model: newModel,
                    quantity: newQuantity
                } as any);
                setRings(prev => [...prev, added]);
            }

            setNewModel('');
            setNewQuantity(1);
            setIsAdding(false);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar.');
        }
    };

    const handleUpdateQuantity = async (id: string, currentQty: number, change: number) => {
        const newQty = currentQty + change;
        if (newQty < 0) return;

        try {
            const updated = await updateItem<TrefilaRingStock>('trefila_rings_stock', id, { quantity: newQty });
            setRings(prev => prev.map(r => r.id === id ? updated : r));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja excluir este item do estoque?')) return;
        try {
            await deleteItem('trefila_rings_stock', id);
            setRings(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const filteredRings = rings
        .filter(r => r.model.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.model.localeCompare(b.model));

    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                        <AdjustmentsIcon className="h-6 w-6 text-blue-600" />
                        Estoque de Anéis
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition bg-slate-50">
                        <XIcon className="h-6 w-6 text-slate-500" />
                    </button>
                </div>

                <div className="p-4 md:p-6 flex-1 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
                    {/* Add Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="w-full md:flex-1 relative">
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Modelo</label>
                                <input
                                    type="text"
                                    list="model-suggestions"
                                    value={newModel}
                                    onChange={e => setNewModel(e.target.value)}
                                    placeholder="Ex: PR 3.20"
                                    className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-medium text-base shadow-sm"
                                />
                                <datalist id="model-suggestions">
                                    {PREDEFINED_MODELS.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                            <div className="w-full md:w-24 grid grid-cols-2 md:block gap-3">
                                <div className="md:hidden">
                                    {/* Mobile spacer if needed */}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase text-center md:text-left">Qtd</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newQuantity}
                                        onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                                        className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-medium text-center text-base shadow-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddRing}
                                className="col-span-2 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md active:scale-[0.98]"
                            >
                                <PlusIcon className="h-5 w-5" />
                                <span className="md:hidden">Adicionar</span>
                                <span className="hidden md:inline">Adicionar</span>
                            </button>
                        </div>
                    </div>

                    {/* Search & List */}
                    <div className="flex-1 flex flex-col min-h-[300px]">
                        <div className="relative mb-4 sticky top-0 z-10">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar no estoque..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none shadow-sm text-base"
                            />
                        </div>

                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <span className="loader text-blue-500">Carregando...</span>
                            </div>
                        ) : filteredRings.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                {searchTerm ? 'Nenhum item encontrado.' : 'Estoque vazio.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-safe">
                                {filteredRings.map(item => (
                                    <div key={item.id} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition active:bg-slate-50">
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-lg">{item.model}</h4>
                                            <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">Em estoque</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                                                    className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-red-500 shadow-sm border border-slate-200 active:bg-slate-50 text-xl font-bold"
                                                >-</button>
                                                <span className="w-10 text-center font-bold text-slate-800 text-lg">{item.quantity}</span>
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                                                    className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-white text-slate-600 hover:text-green-500 shadow-sm border border-slate-200 active:bg-slate-50 text-xl font-bold"
                                                >+</button>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-3 md:p-2 text-slate-400 hover:text-red-500 transition hover:bg-red-50 rounded-lg"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                    .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
                `}</style>
            </div>
        </div>
    );
};

export default RingStockManager;
