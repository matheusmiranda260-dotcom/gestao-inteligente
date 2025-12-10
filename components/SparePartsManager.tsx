import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, SearchIcon, TrashIcon, PencilIcon, SaveIcon, XIcon, AdjustmentsIcon } from './icons';
import { SparePart } from '../types';

interface SparePartsManagerProps {
    onBack: () => void;
}

const SparePartsManager: React.FC<SparePartsManagerProps> = ({ onBack }) => {
    // Mock initial data
    const [parts, setParts] = useState<SparePart[]>([
        { id: '1', name: 'Rolamento 6205', model: 'SKF', machine: 'Trefila', currentStock: 10, minStock: 5 },
        { id: '2', name: 'Correia A-40', model: 'V-Belt', machine: 'Treliça', currentStock: 2, minStock: 3 }, // Low stock
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<SparePart | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<SparePart>>({
        name: '',
        model: '',
        machine: 'Geral',
        currentStock: 0,
        minStock: 0
    });

    const handleOpenModal = (part?: SparePart) => {
        if (part) {
            setEditingPart(part);
            setFormData(part);
        } else {
            setEditingPart(null);
            setFormData({
                name: '',
                model: '',
                machine: 'Geral',
                currentStock: 0,
                minStock: 0
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.name || !formData.model) return alert('Preencha os campos obrigatórios.');

        if (editingPart) {
            // Edit
            setParts(prev => prev.map(p => p.id === editingPart.id ? { ...p, ...formData } as SparePart : p));
        } else {
            // Add
            const newPart: SparePart = {
                id: Math.random().toString(36).substr(2, 9),
                ...formData as SparePart
            };
            setParts(prev => [...prev, newPart]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta peça?')) {
            setParts(prev => prev.filter(p => p.id !== id));
        }
    };

    const filteredParts = parts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.machine.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStockStatus = (current: number, min: number) => {
        if (current <= min) return { label: 'Crítico', color: 'text-red-600 bg-red-100' };
        if (current <= min * 1.2) return { label: 'Atenção', color: 'text-yellow-600 bg-yellow-100' };
        return { label: 'Normal', color: 'text-green-600 bg-green-100' };
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-600">
                            <ArrowLeftIcon />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Gerenciador de Peças</h1>
                            <p className="text-slate-500">Controle de estoque de reposição e manutenção</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white py-2.5 px-6 rounded-lg font-semibold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
                    >
                        <PlusIcon /> Nova Peça
                    </button>
                </div>

                {/* Filters & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="md:col-span-2 relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, modelo ou máquina..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none shadow-sm"
                        />
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600"><AdjustmentsIcon /></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Estoque Baixo</p>
                            <p className="text-xl font-bold text-slate-800">{parts.filter(p => p.currentStock <= p.minStock).length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><AdjustmentsIcon /></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Total de Itens</p>
                            <p className="text-xl font-bold text-slate-800">{parts.length}</p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                    <th className="p-4">Peça / Descrição</th>
                                    <th className="p-4">Modelo</th>
                                    <th className="p-4">Máquina</th>
                                    <th className="p-4 text-center">Estoque Atual</th>
                                    <th className="p-4 text-center">Mínimo</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredParts.length > 0 ? filteredParts.map(part => {
                                    const status = getStockStatus(part.currentStock, part.minStock);
                                    return (
                                        <tr key={part.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-medium text-slate-800">{part.name}</td>
                                            <td className="p-4 text-slate-600">{part.model}</td>
                                            <td className="p-4 text-slate-600">
                                                <span className="px-2 py-1 rounded-md bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                                    {part.machine}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-bold text-slate-800">{part.currentStock}</td>
                                            <td className="p-4 text-center text-slate-500">{part.minStock}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleOpenModal(part)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Editar"
                                                >
                                                    <PencilIcon />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(part.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Excluir"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">
                                            Nenhuma peça encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingPart ? 'Editar Peça' : 'Nova Peça'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                                <XIcon />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Peça</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: Rolamento Esq."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Modelo / Especificação</label>
                                <input
                                    type="text"
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: SKF 6205-2Z"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Máquina</label>
                                <select
                                    value={formData.machine}
                                    onChange={e => setFormData({ ...formData, machine: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="Geral">Geral</option>
                                    <option value="Trefila">Trefila</option>
                                    <option value="Treliça">Treliça</option>
                                    <option value="Empilhadeira">Empilhadeira</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Estoque Atual</label>
                                    <input
                                        type="number"
                                        value={formData.currentStock}
                                        onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Estoque Mínimo</label>
                                    <input
                                        type="number"
                                        value={formData.minStock}
                                        onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition flex items-center gap-2"
                            >
                                <SaveIcon /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SparePartsManager;
