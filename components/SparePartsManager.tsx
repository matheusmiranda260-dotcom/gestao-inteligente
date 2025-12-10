import React, { useState } from 'react';
import { ArrowLeftIcon, PlusIcon, SearchIcon, TrashIcon, PencilIcon, SaveIcon, XIcon, AdjustmentsIcon, MinusIcon, ClockIcon } from './icons';
import { SparePart, PartUsage } from '../types';

interface SparePartsManagerProps {
    onBack: () => void;
}

const SparePartsManager: React.FC<SparePartsManagerProps> = ({ onBack }) => {
    // Mock initial data with history array
    const [parts, setParts] = useState<SparePart[]>([
        { id: '1', name: 'Rolamento 6205', model: 'SKF', machine: 'Trefila', currentStock: 10, minStock: 5, history: [] },
        { id: '2', name: 'Correia A-40', model: 'V-Belt', machine: 'Treliça', currentStock: 2, minStock: 3, history: [] }, // Low stock
    ]);

    const [searchTerm, setSearchTerm] = useState('');

    // Modals State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Active Item for Modals
    const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

    // Forms State
    const [formData, setFormData] = useState<Partial<SparePart>>({
        name: '', model: '', machine: 'Geral', currentStock: 0, minStock: 0
    });

    const [consumeData, setConsumeData] = useState<{ quantity: number, reason: string, user: string }>({
        quantity: 1, reason: '', user: ''
    });

    // --- Handlers ---

    // 1. Edit / Add
    const handleOpenEditModal = (part?: SparePart) => {
        if (part) {
            setSelectedPart(part);
            setFormData(part);
        } else {
            setSelectedPart(null);
            setFormData({ name: '', model: '', machine: 'Geral', currentStock: 0, minStock: 0 });
        }
        setIsEditModalOpen(true);
    };

    const handleSavePart = () => {
        if (!formData.name || !formData.model) return alert('Preencha os campos obrigatórios.');

        if (selectedPart) {
            // Edit
            setParts(prev => prev.map(p => p.id === selectedPart.id ? { ...p, ...formData, history: p.history || [] } as SparePart : p));
        } else {
            // Add
            const newPart: SparePart = {
                id: Math.random().toString(36).substr(2, 9),
                history: [],
                ...formData as SparePart
            };
            setParts(prev => [...prev, newPart]);
        }
        setIsEditModalOpen(false);
    };

    // 2. Consume (Baixar Estoque)
    const handleOpenConsumeModal = (part: SparePart) => {
        setSelectedPart(part);
        setConsumeData({ quantity: 1, reason: '', user: '' });
        setIsConsumeModalOpen(true);
    };

    const handleConfirmConsume = () => {
        if (!selectedPart || consumeData.quantity <= 0) return;
        if (consumeData.quantity > selectedPart.currentStock) {
            return alert('Quantidade a baixar é maior que o estoque atual.');
        }

        const usageRecord: PartUsage = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            quantity: consumeData.quantity,
            machine: selectedPart.machine,
            reason: consumeData.reason || 'Consumo Geral',
            user: consumeData.user || 'Desconhecido'
        };

        setParts(prev => prev.map(p => {
            if (p.id === selectedPart.id) {
                return {
                    ...p,
                    currentStock: p.currentStock - consumeData.quantity,
                    history: [usageRecord, ...(p.history || [])]
                };
            }
            return p;
        }));

        setIsConsumeModalOpen(false);
    };

    // 3. History
    const handleOpenHistoryModal = (part: SparePart) => {
        setSelectedPart(part);
        setIsHistoryModalOpen(true);
    };

    // 4. Delete
    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta peça?')) {
            setParts(prev => prev.filter(p => p.id !== id));
        }
    };

    // --- Render Helpers ---

    const filteredParts = parts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.machine.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStockStatus = (current: number, min: number) => {
        if (current <= min) return { label: 'Crítico', color: 'text-red-600 bg-red-100' };
        if (current <= min * 1.2) return { label: 'Atenção', color: 'text-amber-600 bg-amber-100' };
        return { label: 'Normal', color: 'text-emerald-600 bg-emerald-100' };
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="group flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-600">
                            <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-semibold">Voltar</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Gerenciador de Peças</h1>
                            <p className="text-slate-500">Controle de estoque de reposição e manutenção</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleOpenEditModal()}
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
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none shadow-sm transition"
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
                                    <th className="p-4 text-center">Estoque</th>
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
                                            <td className="p-4 text-center font-bold text-slate-800 text-lg">{part.currentStock}</td>
                                            <td className="p-4 text-center text-slate-500">{part.minStock}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-1">
                                                <button
                                                    onClick={() => handleOpenConsumeModal(part)}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                                    title="Baixar Estoque (Usar)"
                                                >
                                                    <div className="flex items-center gap-1 font-semibold text-xs border border-amber-200 px-2 py-1 rounded bg-amber-50">
                                                        <MinusIcon className="h-4 w-4" /> Baixar
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenHistoryModal(part)}
                                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                                    title="Ver Histórico"
                                                >
                                                    <ClockIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(part)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(part.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Excluir"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
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

            {/* Modal: Edit / Add */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">
                                {selectedPart ? 'Editar Peça' : 'Nova Peça'}
                            </h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition"><XIcon /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Peça</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Rolamento Esq." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Modelo</label>
                                <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: SKF 6205-2Z" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Máquina</label>
                                <select value={formData.machine} onChange={e => setFormData({ ...formData, machine: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="Geral">Geral</option>
                                    <option value="Trefila">Trefila</option>
                                    <option value="Treliça">Treliça</option>
                                    <option value="Empilhadeira">Empilhadeira</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Estoque Atual</label>
                                    <input type="number" value={formData.currentStock} onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Mínimo</label>
                                    <input type="number" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition">Cancelar</button>
                            <button onClick={handleSavePart} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"><SaveIcon /> Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Consume (Baixar) */}
            {isConsumeModalOpen && selectedPart && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                                <MinusIcon className="h-6 w-6" /> Baixar Estoque
                            </h2>
                            <button onClick={() => setIsConsumeModalOpen(false)} className="text-amber-800/50 hover:text-amber-800 transition"><XIcon /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <p className="text-sm text-slate-500 mb-1">Peça selecionada:</p>
                                <p className="font-bold text-slate-800">{selectedPart.name}</p>
                                <p className="text-xs text-slate-600">{selectedPart.model} ({selectedPart.machine})</p>
                                <p className="text-sm font-bold text-slate-700 mt-2">Estoque Atual: {selectedPart.currentStock}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Quantidade utilizada</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedPart.currentStock}
                                    value={consumeData.quantity}
                                    onChange={e => setConsumeData({ ...consumeData, quantity: Number(e.target.value) })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-lg font-bold text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Quem retirou?</label>
                                <input
                                    type="text"
                                    value={consumeData.user}
                                    onChange={e => setConsumeData({ ...consumeData, user: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="Nome do operador"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Motivo / Observação</label>
                                <input
                                    type="text"
                                    value={consumeData.reason}
                                    onChange={e => setConsumeData({ ...consumeData, reason: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="Ex: Manutenção corretiva Trefila"
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setIsConsumeModalOpen(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition">Cancelar</button>
                            <button onClick={handleConfirmConsume} className="px-6 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition shadow-lg shadow-amber-900/20">Confirmar Baixa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: History */}
            {isHistoryModalOpen && selectedPart && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn h-[80vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Histórico de Uso</h2>
                                <p className="text-sm text-slate-500">{selectedPart.name} - {selectedPart.model}</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition"><XIcon /></button>
                        </div>
                        <div className="flex-grow overflow-auto p-0">
                            {selectedPart.history && selectedPart.history.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Qtd</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Operador</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedPart.history.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50">
                                                <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                                                    {new Date(record.date).toLocaleDateString()} <span className="text-slate-400 text-xs">{new Date(record.date).toLocaleTimeString()}</span>
                                                </td>
                                                <td className="p-4 text-sm font-bold text-red-600">-{record.quantity}</td>
                                                <td className="p-4 text-sm text-slate-800">{record.user}</td>
                                                <td className="p-4 text-sm text-slate-600">{record.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
                                    <ClockIcon className="h-12 w-12 mb-2 opacity-20" />
                                    <p>Nenhum histórico de uso registrado.</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SparePartsManager;
