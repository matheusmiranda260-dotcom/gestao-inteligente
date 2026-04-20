import React, { useState, useEffect } from 'react';
import { 
    CogIcon, 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    CheckIcon, 
    XIcon, 
    ClockIcon,
    ExclamationCircleIcon,
    AdjustmentsIcon
} from '@heroicons/react/outline';
import { fetchTable, insertItem, updateItem, deleteItem } from '../supabaseClient';
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
    const [newForm, setNewForm] = useState<Partial<DowntimeConfig>>({
        reason: '',
        thresholdMinutes: 15,
        machineType: 'Geral',
        isActive: true
    });

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
            setNewForm({ reason: '', thresholdMinutes: 15, machineType: 'Geral', isActive: true });
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
                                    placeholder="Ex: Quebra de agulha, Troca de ferramenta..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
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
                                        onChange={e => setNewForm({...newForm, thresholdMinutes: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-48 space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Tipo de Máquina</label>
                                <select 
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer font-bold"
                                    value={newForm.machineType}
                                    onChange={e => setNewForm({...newForm, machineType: e.target.value})}
                                >
                                    <option value="Geral">Geral</option>
                                    <option value="Trefila">Trefila</option>
                                    <option value="Treliça">Treliça</option>
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
                        ) : configs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-dashed border-white/10 rounded-3xl gap-4">
                                <ExclamationCircleIcon className="h-12 w-12 text-slate-600" />
                                <span className="text-sm font-bold text-slate-500 italic">Nenhuma configuração encontrada.</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {configs.map(config => (
                                    <div key={config.id} className="group relative">
                                        <div className={`h-full bg-[#0D1929]/80 border transition-all duration-500 p-6 rounded-[2.5rem] relative z-10 overflow-hidden ${
                                            isEditing === config.id ? 'border-indigo-500/50 ring-4 ring-indigo-500/5 shadow-2xl scale-[1.02]' : 'border-white/5 hover:border-white/10 hover:shadow-xl hover:shadow-black/20'
                                        }`}>
                                            
                                            {/* Accent lines */}
                                            <div className="absolute top-0 right-10 w-16 h-1 bg-white/5 rounded-full" />
                                            <div className="absolute top-0 right-10 w-8 h-1 bg-indigo-500/20 rounded-full" />

                                            <div className="flex flex-col h-full justify-between gap-6">
                                                <div className="space-y-4">
                                                    {isEditing === config.id ? (
                                                        <input 
                                                            type="text"
                                                            className="w-full bg-slate-800/80 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none font-bold"
                                                            value={editForm.reason}
                                                            onChange={e => setEditForm({...editForm, reason: e.target.value})}
                                                        />
                                                    ) : (
                                                        <h3 className="text-lg font-black text-white uppercase italic tracking-tight leading-tight min-h-[3.5rem]">
                                                            {config.reason}
                                                        </h3>
                                                    )}

                                                    <div className="flex items-center gap-6">
                                                        <div className="space-y-1">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tempo Previsto</span>
                                                            <div className="flex items-center gap-2">
                                                                <ClockIcon className="h-4 w-4 text-indigo-400/60" />
                                                                {isEditing === config.id ? (
                                                                    <input 
                                                                        type="number"
                                                                        className="w-20 bg-slate-800/80 border border-indigo-500/30 rounded-lg px-2 py-1 text-white text-sm font-mono font-bold"
                                                                        value={editForm.thresholdMinutes}
                                                                        onChange={e => setEditForm({...editForm, thresholdMinutes: parseInt(e.target.value)})}
                                                                    />
                                                                ) : (
                                                                    <span className="text-xl font-mono font-black text-white tabular-nums">
                                                                        {config.thresholdMinutes}<span className="text-[10px] text-slate-500 ml-1 italic underline decoration-indigo-500/30">min</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="h-8 w-px bg-white/5" />
                                                        <div className="space-y-1">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Máquina</span>
                                                            {isEditing === config.id ? (
                                                                <select 
                                                                    className="bg-slate-800/80 border border-indigo-500/30 rounded-lg px-2 py-1 text-white text-xs font-bold"
                                                                    value={editForm.machineType}
                                                                    onChange={e => setEditForm({...editForm, machineType: e.target.value})}
                                                                >
                                                                    <option value="Geral">Geral</option>
                                                                    <option value="Trefila">Trefila</option>
                                                                    <option value="Treliça">Treliça</option>
                                                                </select>
                                                            ) : (
                                                                <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg inline-block">
                                                                    <span className="text-[10px] font-black text-indigo-400 uppercase italic">
                                                                        {config.machineType}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/5">
                                                    {isEditing === config.id ? (
                                                        <>
                                                            <button 
                                                                onClick={() => setIsEditing(null)}
                                                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all active:scale-95 border border-white/5"
                                                            >
                                                                <XIcon className="h-5 w-5" />
                                                            </button>
                                                            <button 
                                                                onClick={handleSaveEdit}
                                                                className="p-3 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-green-600/20"
                                                            >
                                                                <CheckIcon className="h-5 w-5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => handleEdit(config)}
                                                                className="p-3 bg-slate-800/50 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-xl transition-all active:scale-95 border border-white/10 group/btn"
                                                            >
                                                                <PencilIcon className="h-5 w-5 group-hover/btn:scale-110" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(config.id)}
                                                                className="p-3 bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all active:scale-95 border border-white/10 group/btn"
                                                            >
                                                                <TrashIcon className="h-5 w-5 group-hover/btn:scale-110" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
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

export default DowntimeConfigManager;
