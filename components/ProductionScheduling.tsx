import React, { useState, useMemo } from 'react';
import type { Page, ProductionSchedule } from '../types';
import { insertItem, updateItem, deleteItem } from '../services/supabaseService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ProductionSchedulingProps {
    schedules: ProductionSchedule[];
    setSchedules: React.Dispatch<React.SetStateAction<ProductionSchedule[]>>;
    setPage: (page: Page) => void;
}

const generateId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const ProductionScheduling: React.FC<ProductionSchedulingProps> = ({ schedules, setSchedules, setPage }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ProductionSchedule | null>(null);
    const [formData, setFormData] = useState<Partial<ProductionSchedule>>({
        machine: 'Trefila',
        date: new Date().toISOString().split('T')[0],
        item: '',
        targetQuantity: 0,
        status: 'Agendado'
    });

    const handleOpenModal = (schedule?: ProductionSchedule) => {
        if (schedule) {
            setEditingSchedule(schedule);
            setFormData(schedule);
        } else {
            setEditingSchedule(null);
            setFormData({
                machine: 'Trefila',
                date: new Date().toISOString().split('T')[0],
                item: '',
                targetQuantity: 0,
                status: 'Agendado'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSchedule(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSchedule) {
                // Update
                try {
                    await updateItem('production_schedules', editingSchedule.id, formData);
                } catch (error) {
                    console.error("Error updating (fallback to local state)", error);
                }
                
                setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...s, ...formData } as ProductionSchedule : s));
            } else {
                // Insert
                const newSchedule = {
                    ...formData,
                    id: generateId('SCH'),
                    createdAt: new Date().toISOString()
                } as ProductionSchedule;

                try {
                    await insertItem('production_schedules', newSchedule);
                } catch (error) {
                    console.error("Error inserting (fallback to local state)", error);
                }

                setSchedules(prev => [...prev, newSchedule]);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save schedule", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja excluir este agendamento?')) return;
        try {
            try {
                await deleteItem('production_schedules', id);
            } catch (error) {
                console.error("Error deleting (fallback to local state)", error);
            }
            
            setSchedules(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error("Failed to delete schedule", error);
        }
    };

    // Chart Data prep: aggregate targetQuantity by date and machine
    const chartData = useMemo(() => {
        const grouped: Record<string, any> = {};
        schedules.forEach(sch => {
            if (!grouped[sch.date]) {
                grouped[sch.date] = { name: sch.date, 'Trefila': 0, 'Treliça 1': 0, 'Treliça 2': 0, 'Malha': 0, 'Geral': 0 };
            }
            if (grouped[sch.date][sch.machine] !== undefined) {
                grouped[sch.date][sch.machine] += Number(sch.targetQuantity);
            } else {
                grouped[sch.date]['Geral'] += Number(sch.targetQuantity);
            }
        });
        
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    }, [schedules]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'Agendado': return 'bg-slate-200 text-slate-700';
            case 'Em Produção': return 'bg-blue-100 text-blue-700';
            case 'Concluído': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="flex-1 h-screen overflow-auto bg-[#F8FAFC]">
            {/* Cabeçalho */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setPage('menu')}
                                className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-black text-[#002060] tracking-tight">
                                Programação de Produção
                            </h1>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-[#002060] hover:bg-[#001848] text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all"
                        >
                            + Novo Agendamento
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                
                {/* Gráfico de Carga */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Carga Programada por Máquina (kg/un)</h2>
                    <div className="h-72">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickMargin={10} />
                                    <YAxis stroke="#64748B" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="Trefila" stackId="a" fill="#002060" />
                                    <Bar dataKey="Treliça 1" stackId="a" fill="#3B82F6" />
                                    <Bar dataKey="Treliça 2" stackId="a" fill="#60A5FA" />
                                    <Bar dataKey="Malha" stackId="a" fill="#00E5FF" />
                                    <Bar dataKey="Geral" stackId="a" fill="#94A3B8" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                                Nenhuma produção agendada para exibir no gráfico.
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de Agendamentos */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800">Lista de Agendamentos</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                                    <th className="px-5 py-3 text-center w-24">Data</th>
                                    <th className="px-5 py-3">Máquina</th>
                                    <th className="px-5 py-3">Item/Produto</th>
                                    <th className="px-5 py-3 text-right">Meta (Qtd)</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                    <th className="px-5 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {schedules.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-medium">
                                            Nenhum agendamento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    [...schedules].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(sch => (
                                        <tr key={sch.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3 text-sm text-slate-600 font-medium text-center">
                                                {new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-900 font-bold">
                                                {sch.machine}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-600">
                                                {sch.item}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-900 font-black text-right">
                                                {Number(sch.targetQuantity).toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(sch.status)}`}>
                                                    {sch.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleOpenModal(sch)} className="text-slate-400 hover:text-blue-600 transition-colors p-1" title="Editar">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(sch.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Excluir">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={formData.date || ''}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002060]/20 focus:border-[#002060]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Máquina</label>
                                    <select 
                                        required
                                        value={formData.machine || ''}
                                        onChange={e => setFormData({...formData, machine: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002060]/20 focus:border-[#002060]"
                                    >
                                        <option value="Trefila">Trefila</option>
                                        <option value="Treliça 1">Treliça 1</option>
                                        <option value="Treliça 2">Treliça 2</option>
                                        <option value="Malha">Malha</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Item / Produto</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Ex: Fio 4.20mm Lote 1234"
                                    value={formData.item || ''}
                                    onChange={e => setFormData({...formData, item: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002060]/20 focus:border-[#002060]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Meta (Quantidade)</label>
                                    <input 
                                        type="number" 
                                        required
                                        min="1"
                                        placeholder="0"
                                        value={formData.targetQuantity || ''}
                                        onChange={e => setFormData({...formData, targetQuantity: Number(e.target.value)})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002060]/20 focus:border-[#002060]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
                                    <select 
                                        required
                                        value={formData.status || ''}
                                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002060]/20 focus:border-[#002060]"
                                    >
                                        <option value="Agendado">Agendado</option>
                                        <option value="Em Produção">Em Produção</option>
                                        <option value="Concluído">Concluído</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-[#002060] hover:bg-[#001848] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProductionScheduling;
