import React, { useState, useEffect } from 'react';
import { 
    Cog6ToothIcon as CogIcon, 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    CheckIcon, 
    XMarkIcon as XIcon, 
    ClockIcon,
    ExclamationCircleIcon,
    AdjustmentsHorizontalIcon as AdjustmentsIcon
} from '@heroicons/react/24/outline';
import { fetchTable, insertItem, updateItem, deleteItem } from '../services/supabaseService';
import { DowntimeConfig } from '../types';

interface DowntimeConfigManagerProps {
    onBack: () => void;
    showNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const DowntimeConfigManager: React.FC<DowntimeConfigManagerProps> = ({ onBack, showNotification }) => {
    const [configs, setConfigs] = useState<DowntimeConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<DowntimeConfig>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [filterMachine, setFilterMachine] = useState<string>('Todas');
    const [newForm, setNewForm] = useState<Partial<DowntimeConfig>>({
        reason: '',
        thresholdMinutes: 15,
        machineType: 'Geral',
        isActive: true
    });

    useEffect(() => {
        if (filterMachine !== 'Todas') {
            setNewForm(prev => ({ ...prev, machineType: filterMachine }));
        }
    }, [filterMachine]);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setLoading(true);
        try {
            const data = await fetchTable<DowntimeConfig>('downtime_configs');
            setConfigs(data.sort((a, b) => a.reason.localeCompare(b.reason)));
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            showNotification('Erro ao carregar configurações de paradas.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (config: DowntimeConfig) => {
        setIsEditing(config.id);
        setEditForm(config);
    };

    const handleSaveEdit = async () => {
        if (!isEditing || !editForm.reason) return;
        try {
            await updateItem('downtime_configs', isEditing, editForm);
            showNotification('Configuração atualizada com sucesso.', 'success');
            setIsEditing(null);
            loadConfigs();
        } catch (error) {
            showNotification('Erro ao salvar alteração.', 'error');
        }
    };

    const handleAdd = async () => {
        if (!newForm.reason) {
            showNotification('O motivo da parada é obrigatório.', 'warning');
            return;
        }
        try {
            await insertItem('downtime_configs', newForm as DowntimeConfig);
            showNotification('Nova parada adicionada com sucesso.', 'success');
            setIsAdding(false);
            setNewForm({ reason: '', thresholdMinutes: 15, machineType: filterMachine !== 'Todas' ? filterMachine : 'Geral', isActive: true });
            loadConfigs();
        } catch (error) {
            showNotification('Erro ao adicionar parada.', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta configuração de parada?')) return;
        try {
            await deleteItem('downtime_configs', id);
            showNotification('Configuração excluída com sucesso.', 'success');
            loadConfigs();
        } catch (error) {
            showNotification('Erro ao excluir configuração.', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#060B18] text-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-[#0D1929]/50 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        <AdjustmentsIcon className="h-6 w-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
                            Configuração de Máquinas <span className="text-indigo-400">/ Paradas</span>
                        </h1>
                        <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">Gerencie motivos de paradas e tempos previstos</p>
                    </div>
                </div>
                <button 
                    onClick={onBack}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-white/5 active:scale-95 shadow-lg"
                >
                    Voltar ao Menu
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8">
                    
                    {/* Machine Selector Tabs */}
                    <div className="flex items-center gap-2 p-1.5 bg-[#0D1929]/80 border border-white/5 rounded-2xl w-fit">
                        {[
                            { id: 'Todas', icon: '🌍' },
                            { id: 'Geral', icon: '⚙️' },
                            { id: 'Trefila', icon: '🌀' },
                            { id: 'Treliça', icon: '🏗️' }
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setFilterMachine(m.id)}
                                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                                    filterMachine === m.id 
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                            >
                                <span className="text-xs">{m.icon}</span>
                                {m.id}
                            </button>
                        ))}
                    </div>
                    
                    {/* Floating Add Card */}
                    <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <PlusIcon className="h-24 w-24 text-white" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-end">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Novo Motivo de Parada</label>
                                <input 
                                    type="text"
                                    placeholder="Ex: Quebra de agulha, Troca de rolo..."
                                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                                    value={newForm.reason}
                                    onChange={e => setNewForm({...newForm, reason: e.target.value})}
                                />
                            </div>
                            <div className="w-full md:w-48 space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Tempo Previsto (Min)</label>
                                <div className="relative">
                                    <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono font-bold"
                                        value={newForm.thresholdMinutes}
                                        onChange={e => setNewForm({...newForm, thresholdMinutes: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-48 space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Tipo de Máquina</label>
                                <select 
                                    className="w-full !bg-slate-900 !text-white border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer font-bold"
                                    value={newForm.machineType}
                                    onChange={e => setNewForm({...newForm, machineType: e.target.value})}
                                >
                                    <option value="Geral" className="bg-slate-900 text-white">Geral</option>
                                    <option value="Trefila" className="bg-slate-900 text-white">Trefila</option>
                                    <option value="Treliça" className="bg-slate-900 text-white">Treliça</option>
                                </select>
                            </div>
                            <button 
                                onClick={handleAdd}
                                className="w-full md:w-auto h-[60px] bg-indigo-500 hover:bg-indigo-600 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-[0_10px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_15px_30px_rgba(99,102,241,0.4)] active:scale-95 flex items-center justify-center gap-3"
                            >
                                <PlusIcon className="h-5 w-5" /> Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Config List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-4 mb-2">
                            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Lista de Paradas Cadastradas</h2>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{configs.length} Motivos</span>
                        </div>
                        
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                                <CogIcon className="h-12 w-12 animate-spin text-indigo-400" />
                                <span className="text-xs font-black uppercase tracking-widest">Sincronizando Banco de Dados...</span>
                            </div>
                        ) : configs.filter(c => 
                            filterMachine === 'Todas' || 
                            c.machineType === filterMachine || 
                            (filterMachine !== 'Geral' && c.machineType === 'Geral')
                        ).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-dashed border-white/10 rounded-3xl gap-4">
                                <ExclamationCircleIcon className="h-12 w-12 text-slate-600" />
                                <span className="text-sm font-bold text-slate-500 italic">Nenhuma configuração encontrada para {filterMachine}.</span>
                                                    <div className="bg-[#0D1929]/80 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-black/20 border-b border-white/5">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Motivo da Parada</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tempo Previsto</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Máquina</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {configs
                                            .filter(c => 
                                                filterMachine === 'Todas' || 
                                                c.machineType === filterMachine || 
                                                (filterMachine !== 'Geral' && filterMachine !== 'Todas' && c.machineType === 'Geral')
                                            )
                                            .map(config => (
                                                <tr key={config.id} className={`group transition-all hover:bg-white/[0.02] ${!config.isActive ? 'opacity-40 grayscale' : ''}`}>
                                                    <td className="px-8 py-5">
                                                        <button 
                                                            onClick={() => handleToggleActive(config)}
                                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${
                                                                config.isActive 
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                                    : 'bg-slate-800 text-slate-500 border border-white/5'
                                                            }`}
                                                        >
                                                            {config.isActive ? 'Ativo' : 'Inativo'}
                                                        </button>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        {isEditing === config.id ? (
                                                            <input 
                                                                type="text"
                                                                className="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-3 py-2 text-white font-bold uppercase text-sm"
                                                                value={editForm.reason}
                                                                onChange={e => setEditForm({...editForm, reason: e.target.value})}
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-black text-white uppercase italic tracking-tight">{config.reason}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/5">
                                                            <ClockIcon className="h-4 w-4 text-indigo-400/60" />
                                                            {isEditing === config.id ? (
                                                                <input 
                                                                    type="number"
                                                                    className="w-16 bg-slate-800 border border-indigo-500/50 rounded px-1 py-0.5 text-white text-xs font-mono font-bold"
                                                                    value={editForm.thresholdMinutes}
                                                                    onChange={e => setEditForm({...editForm, thresholdMinutes: parseInt(e.target.value) || 0})}
                                                                />
                                                            ) : (
                                                                <span className="text-sm font-mono font-black text-white">{config.thresholdMinutes}<span className="text-[10px] text-slate-500 ml-1">min</span></span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        {isEditing === config.id ? (
                                                            <select 
                                                                className="bg-slate-800 border border-indigo-500/50 rounded px-2 py-1 text-white text-xs font-bold"
                                                                value={editForm.machineType}
                                                                onChange={e => setEditForm({...editForm, machineType: e.target.value})}
                                                            >
                                                                <option value="Geral">Geral</option>
                                                                <option value="Trefila">Trefila</option>
                                                                <option value="Treliça">Treliça</option>
                                                            </select>
                                                        ) : (
                                                            <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black rounded-md uppercase italic">
                                                                {config.machineType}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isEditing === config.id ? (
                                                                <>
                                                                    <button 
                                                                        onClick={handleSaveEdit}
                                                                        className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                                                                        title="Salvar"
                                                                    >
                                                                        <CheckIcon className="h-4 w-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setIsEditing(null)}
                                                                        className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                                                                        title="Cancelar"
                                                                    >
                                                                        <XIcon className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleEdit(config)}
                                                                        className="p-3 bg-slate-800/50 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-xl transition-all border border-white/10"
                                                                        title="Editar"
                                                                    >
                                                                        <PencilIcon className="h-4 w-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDelete(config.id)}
                                                                        className="p-3 bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-white/10"
                                                                        title="Excluir"
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>      ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DowntimeConfigManager;
