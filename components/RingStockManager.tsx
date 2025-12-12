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
            // Check if already exists
            const existing = rings.find(r => r.model.toLowerCase() === newModel.toLowerCase());
            if (existing) {
                // Update quantity instead
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
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <AdjustmentsIcon className="h-6 w-6 text-blue-600" />
                        Estoque de Anéis e Fieiras
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition">
                        <XIcon className="h-5 w-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
                    {/* Add Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1 w-full relative">
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Modelo</label>
                                <input
                                    type="text"
                                    list="model-suggestions"
                                    value={newModel}
                                    onChange={e => setNewModel(e.target.value)}
                                    placeholder="Ex: PR 3.20"
                                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none font-medium"
                                />
                                <datalist id="model-suggestions">
                                    {PREDEFINED_MODELS.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Qtd</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newQuantity}
                                    onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none font-medium text-center"
                                />
                            </div>
                            <button
                                onClick={handleAddRing}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg flex items-center gap-2 transition min-w-[120px] justify-center"
                            >
                                <PlusIcon className="h-5 w-5" /> Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Search & List */}
                    <div className="flex-1 flex flex-col">
                        <div className="relative mb-4">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar no estoque..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                {filteredRings.map(item => (
                                    <div key={item.id} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition group">
                                        <div>
                                            <h4 className="font-bold text-slate-700">{item.model}</h4>
                                            <span className="text-xs text-slate-400">Em estoque</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded bg-white text-slate-600 hover:text-red-500 shadow-sm"
                                                >-</button>
                                                <span className="w-8 text-center font-bold text-slate-800">{item.quantity}</span>
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded bg-white text-slate-600 hover:text-green-500 shadow-sm"
                                                >+</button>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RingStockManager;
