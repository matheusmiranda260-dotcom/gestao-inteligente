import React, { useState, useEffect, useMemo } from 'react';
import type { TrelicaSpoolHistoryEntry, ProductionOrderData } from '../types';
import { fetchTrelicaSpoolHistory } from '../services/supabaseService';
import { supabase } from '../supabaseClient';
import { CogIcon, ClockIcon, ArrowDownTrayIcon, PrinterIcon } from './icons';

interface TrelicaSpoolHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeOrders?: ProductionOrderData[];
    initialMachine?: string;
}

export const TrelicaSpoolHistoryModal: React.FC<TrelicaSpoolHistoryModalProps> = ({
    isOpen,
    onClose,
    activeOrders = [],
    initialMachine = 'Todas'
}) => {
    const [history, setHistory] = useState<TrelicaSpoolHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedMachine, setSelectedMachine] = useState<string>(initialMachine);
    const [selectedRole, setSelectedRole] = useState<string>('Todas');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchTrelicaSpoolHistory();
            setHistory(data);
        } catch (err) {
            console.warn('Erro ao carregar histórico de rolos:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();

            // Inscrever em atualizações em tempo real
            const channelName = `spool-history-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            let channel: any = null;
            try {
                channel = supabase
                    .channel(channelName)
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'trelica_spool_history' },
                        () => {
                            loadData();
                        }
                    )
                    .subscribe();
            } catch (e) {
                console.warn('Realtime subscription error on spool history:', e);
            }

            return () => {
                if (channel) {
                    try { supabase.removeChannel(channel); } catch (e) {}
                }
            };
        }
    }, [isOpen]);

    // Filtragem dos registros
    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            if (selectedMachine !== 'Todas' && item.machine_name !== selectedMachine) return false;
            if (selectedRole !== 'Todas') {
                if (selectedRole === 'superior' && item.role_type !== 'superior') return false;
                if (selectedRole === 'senozoide' && !String(item.role_type || '').startsWith('senozoide')) return false;
                if (selectedRole === 'inferior' && !String(item.role_type || '').startsWith('inferior')) return false;
            }
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const lot = (item.lot_number || '').toLowerCase();
                const op = (item.order_number || '').toLowerCase();
                const mod = (item.trelica_model || '').toLowerCase();
                const opBy = (item.installed_by || '').toLowerCase();
                const remBy = (item.removed_by || '').toLowerCase();
                if (!lot.includes(term) && !op.includes(term) && !mod.includes(term) && !opBy.includes(term) && !remBy.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [history, selectedMachine, selectedRole, statusFilter, searchTerm]);

    // Métricas
    const metrics = useMemo(() => {
        const total = history.length;
        const activeCount = history.filter(h => h.status === 'active').length;
        const completed = history.filter(h => h.status === 'completed');
        const totalPieces = completed.reduce((acc, h) => acc + (h.pieces_produced || 0), 0);
        const avgPieces = completed.length > 0 ? Math.round(totalPieces / completed.length) : 0;

        return {
            total,
            activeCount,
            totalPieces,
            avgPieces
        };
    }, [history]);

    // Exportar CSV
    const handleExportCSV = () => {
        const headers = ['Máquina', 'Stand', 'Posição', 'Lote', 'Bitola (mm)', 'OP', 'Modelo Treliça', 'Hora Entrada', 'Operador Entrada', 'Hora Saída', 'Operador Saída', 'Peças Rodadas', 'Status'];
        const rows = filteredHistory.map(item => [
            item.machine_name,
            `Stand #${item.stand_index}`,
            item.role_name,
            item.lot_number,
            item.gauge,
            item.order_number || '-',
            item.trelica_model || '-',
            item.installed_at ? new Date(item.installed_at).toLocaleString('pt-BR') : '-',
            item.installed_by || '-',
            item.removed_at ? new Date(item.removed_at).toLocaleString('pt-BR') : 'Em uso',
            item.removed_by || '-',
            item.pieces_produced || 0,
            item.status === 'active' ? 'Ativo em Máquina' : 'Trocado'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `relatorio_troca_rolos_trelica_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in select-none">
            <div className="bg-[#0B1A24] border border-white/15 w-full max-w-6xl rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[95vh] overflow-hidden text-slate-100">
                
                {/* CABEÇALHO DO RELATÓRIO */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
                            <CogIcon className="w-6 h-6 animate-spin-slow" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                                    RELATÓRIO DE TROCA DE ROLOS & BOBINAS
                                </h2>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Treliça
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Histórico de entrada, saída, operadores e rendimento em peças produzidas por rolo montado
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                            onClick={handleExportCSV}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95"
                            title="Exportar dados para planilha CSV"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4 text-emerald-400" />
                            <span>Exportar CSV</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95"
                            title="Imprimir relatório"
                        >
                            <PrinterIcon className="w-4 h-4 text-blue-400" />
                            <span>Imprimir</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* CARDS DE RESUMO OPERACIONAL */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#07131B] border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400">Total de Registros</span>
                        <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
                            {metrics.total} <span className="text-xs font-normal text-slate-400 font-sans">trocas</span>
                        </div>
                    </div>

                    <div className="bg-[#07131B] border border-blue-500/30 p-3 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-400">Em Máquina Agora</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-blue-300 font-mono mt-1">
                            {metrics.activeCount} <span className="text-xs font-normal text-slate-400 font-sans">bobinas</span>
                        </div>
                    </div>

                    <div className="bg-[#07131B] border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400">Peças Registradas</span>
                        <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-1">
                            {metrics.totalPieces.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-400 font-sans">pçs</span>
                        </div>
                    </div>

                    <div className="bg-[#07131B] border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400">Média por Bobina</span>
                        <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono mt-1">
                            {metrics.avgPieces.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-400 font-sans">pçs/rolo</span>
                        </div>
                    </div>
                </div>

                {/* FILTROS E BUSCA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    {/* Filtro Máquina */}
                    <div className="flex items-center bg-[#07131B] p-1 rounded-xl border border-white/10">
                        {['Todas', 'Treliça 1', 'Treliça 2'].map(mach => (
                            <button
                                key={mach}
                                onClick={() => setSelectedMachine(mach)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    selectedMachine === mach ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {mach}
                            </button>
                        ))}
                    </div>

                    {/* Filtro Função */}
                    <div className="flex items-center bg-[#07131B] p-1 rounded-xl border border-white/10">
                        {[
                            { id: 'Todas', label: 'Todas Funções' },
                            { id: 'superior', label: 'Superior' },
                            { id: 'senozoide', label: 'Senoides' },
                            { id: 'inferior', label: 'Inferiores' }
                        ].map(rf => (
                            <button
                                key={rf.id}
                                onClick={() => setSelectedRole(rf.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                    selectedRole === rf.id ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {rf.label}
                            </button>
                        ))}
                    </div>

                    {/* Filtro Status */}
                    <div className="flex items-center bg-[#07131B] p-1 rounded-xl border border-white/10">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'active', label: '🟢 Em Máquina' },
                            { id: 'completed', label: '✓ Finalizados' }
                        ].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setStatusFilter(st.id as any)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                                    statusFilter === st.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {/* Busca Textual */}
                    <div className="flex-1 bg-[#07131B] border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <span className="text-slate-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por lote, OP, modelo ou operador..."
                            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-white text-xs">✕</button>
                        )}
                    </div>
                </div>

                {/* TABELA DE REGISTROS DE TROCA DE ROLOS */}
                <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#07131B]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                            <CogIcon className="w-8 h-8 animate-spin text-blue-400" />
                            <span className="text-xs font-bold">Carregando histórico de trocas...</span>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 p-4">
                            <p className="font-bold text-sm">Nenhum registro de troca de rolo encontrado.</p>
                            <p className="text-xs text-slate-500 mt-1">
                                As trocas e abastecimentos efetuados nas Treliças serão listados aqui em tempo real.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-[#050D14] sticky top-0 z-10 text-[11px] font-black text-slate-400 border-b border-white/10 uppercase tracking-wider">
                                <tr>
                                    <th className="p-3">Máquina / Stand</th>
                                    <th className="p-3">Posição</th>
                                    <th className="p-3">Lote & Bitola</th>
                                    <th className="p-3">OP Vinculada</th>
                                    <th className="p-3">Hora Entrada</th>
                                    <th className="p-3">Hora Saída</th>
                                    <th className="p-3 text-center">Peças Rodadas</th>
                                    <th className="p-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredHistory.map((item) => {
                                    const isActive = item.status === 'active';
                                    const isSup = item.role_type === 'superior';
                                    const isSen = String(item.role_type || '').startsWith('senozoide');

                                    // Calcular peças vivas se estiver ativo e houver OP rodando
                                    let currentLivePieces = item.pieces_produced || 0;
                                    if (isActive && activeOrders.length > 0) {
                                        const runningOp = activeOrders.find(o => o.id === item.order_id || o.machine === item.machine_name);
                                        if (runningOp && runningOp.actualProducedQuantity !== undefined) {
                                            currentLivePieces = Math.max(0, runningOp.actualProducedQuantity - (item.start_produced_pieces || 0));
                                        }
                                    }

                                    return (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                            {/* Máquina e Stand */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-white text-xs bg-white/10 px-2 py-0.5 rounded-lg">
                                                        {item.machine_name}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        Stand #{item.stand_index}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Posição */}
                                            <td className="p-3">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                                    isSup 
                                                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' 
                                                        : isSen 
                                                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                                                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                }`}>
                                                    {item.role_name}
                                                </span>
                                            </td>

                                            {/* Lote & Bitola */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-amber-400">
                                                        #{item.lot_number}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-300 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                                        ⌀ {item.gauge} mm
                                                    </span>
                                                </div>
                                            </td>

                                            {/* OP e Modelo */}
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {item.order_number ? `OP #${item.order_number}` : '-'}
                                                    </span>
                                                    {item.trelica_model && (
                                                        <span className="text-[10px] text-slate-400">
                                                            {item.trelica_model}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Hora de Entrada */}
                                            <td className="p-3">
                                                <div className="flex flex-col text-[11px]">
                                                    <span className="text-slate-200 font-mono">
                                                        {item.installed_at ? new Date(item.installed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        <span className="text-[10px] text-slate-500 ml-1">
                                                            {item.installed_at ? new Date(item.installed_at).toLocaleDateString('pt-BR') : ''}
                                                        </span>
                                                    </span>
                                                    <span className="text-[9.5px] text-slate-400">
                                                        Por: {item.installed_by || 'Operador'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Hora de Saída */}
                                            <td className="p-3">
                                                {isActive ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-black text-emerald-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                                        <span>Em Máquina</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col text-[11px]">
                                                        <span className="text-slate-200 font-mono">
                                                            {item.removed_at ? new Date(item.removed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            <span className="text-[10px] text-slate-500 ml-1">
                                                                {item.removed_at ? new Date(item.removed_at).toLocaleDateString('pt-BR') : ''}
                                                            </span>
                                                        </span>
                                                        <span className="text-[9.5px] text-slate-400">
                                                            Por: {item.removed_by || 'Operador'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Peças Rodadas */}
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <span className={`font-mono font-black text-sm ${
                                                        isActive ? 'text-emerald-400' : 'text-slate-200'
                                                    }`}>
                                                        {currentLivePieces.toLocaleString('pt-BR')} pçs
                                                    </span>
                                                    {isActive && (
                                                        <span className="text-[8.5px] text-emerald-500 font-bold uppercase tracking-wider">
                                                            Ao Vivo
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="p-3 text-right">
                                                {isActive ? (
                                                    <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg">
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                                                        Trocado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/10">
                    <div>
                        Exibindo <strong className="text-white font-mono">{filteredHistory.length}</strong> de <span className="font-mono">{history.length}</span> registros de bobina.
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl transition active:scale-95"
                    >
                        Fechar Relatório
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrelicaSpoolHistoryModal;
