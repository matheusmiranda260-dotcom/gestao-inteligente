import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, User, FinishedGoodsTransferRecord, StockMovement } from '../types';
import { ArchiveIcon, TruckIcon, PlusIcon, MinusIcon, TrashIcon, SwitchHorizontalIcon, ClockIcon, CalculatorIcon, CheckCircleIcon } from './icons';
import { trelicaModels } from './ProductionOrderTrelica';

interface TrelicaStockManagerProps {
    finishedGoods: FinishedProductItem[];
    setPage: (page: Page) => void;
    createFinishedGoodsTransfer: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => FinishedGoodsTransferRecord | null;
    onDelete?: (ids: string[]) => void;
    onUpdateQuantity: (id: string, updates: Partial<FinishedProductItem>, movement?: StockMovement) => void;
    onAddManual: (item: Omit<FinishedProductItem, 'id' | 'status' | 'productionDate'>) => void;
    currentUser: User | null;
}

// Interface para o resumo por modelo
interface ModelStockSummary {
    model: string;
    size: string;
    virtualQty: number;
    physicalQty: number;
    totalWeight: number;
    lastItemIds: string[]; // Para saber quais registros atualizar
}

const HistoryModal: React.FC<{
    item: FinishedProductItem;
    onClose: () => void;
}> = ({ item, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-modal-in border border-white/20">
            <div className="p-6 bg-slate-100 border-b flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                        <ClockIcon className="h-6 w-6 text-slate-500" />
                        Histórico de Movimentações
                    </h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{item.model} - {item.size}m</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                    <PlusIcon className="h-5 w-5 rotate-45 text-slate-500" />
                </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {item.movementHistory && item.movementHistory.length > 0 ? (
                    <div className="space-y-4">
                        {item.movementHistory.slice().reverse().map((m, idx) => (
                            <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 relative">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                    {m.type === 'transfer' ? <SwitchHorizontalIcon className="h-5 w-5 text-indigo-600" /> : <MinusIcon className="h-5 w-5 text-emerald-500" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="font-black text-slate-800 uppercase text-xs">
                                            {m.type === 'transfer' ? 'Virtual → Físico' : m.type === 'out' ? 'Saída / Baixa' : 'Ajuste Geral'}
                                        </p>
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(m.date).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="text-sm font-bold text-indigo-600 mt-1">{m.quantity} peças</p>
                                    {m.observations && <p className="text-xs text-slate-500 italic mt-1">"{m.observations}"</p>}
                                    <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Operador: {m.operator}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <ArchiveIcon className="h-12 w-12 text-slate-200 mx-auto mb-2" />
                        <p className="text-slate-400 font-bold">Nenhuma movimentação registrada.</p>
                    </div>
                )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t flex justify-end">
                <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">Fechar</button>
            </div>
        </div>
    </div>
);

const TrelicaStockManager: React.FC<TrelicaStockManagerProps> = ({ 
    finishedGoods, 
    setPage, 
    onUpdateQuantity,
    onAddManual,
    currentUser 
}) => {
    const [movingItem, setMovingItem] = useState<{ model: string; size: string; type: 'transfer' | 'audit' } | null>(null);
    const [historyItem, setHistoryItem] = useState<FinishedProductItem | null>(null);
    const [movementQty, setMovementQty] = useState(0);
    const [obs, setObs] = useState('');

    // 1. Agrupar estoque por Modelo + Tamanho
    const stockSummarized = useMemo(() => {
        const summary: Record<string, ModelStockSummary> = {};
        
        // Inicializa com todos os modelos conhecidos para garantir que todos apareçam
        trelicaModels.forEach(m => {
            const key = `${m.modelo}_${m.tamanho}`;
            summary[key] = {
                model: m.modelo,
                size: m.tamanho,
                virtualQty: 0,
                physicalQty: 0,
                totalWeight: 0,
                lastItemIds: []
            };
        });

        // Soma os dados do estoque real
        finishedGoods.filter(i => i.productType === 'Treliça').forEach(item => {
            const key = `${item.model}_${item.size.trim()}`;
            if (!summary[key]) {
                summary[key] = { model: item.model, size: item.size, virtualQty: 0, physicalQty: 0, totalWeight: 0, lastItemIds: [] };
            }
            summary[key].virtualQty += item.quantity;
            summary[key].physicalQty += (item.physicalQuantity || 0);
            summary[key].totalWeight += item.totalWeight;
            summary[key].lastItemIds.push(item.id);
        });

        return Object.values(summary).sort((a,b) => a.model.localeCompare(b.model));
    }, [finishedGoods]);

    // Lógica para salvar movimentação consolidada
    const handleAction = () => {
        if (!movingItem) return;

        // Encontra o item mais recente ou cria um se necessário para registrar a ação
        const relevantItems = finishedGoods.filter(i => i.model === movingItem.model && i.size.trim() === movingItem.size.trim());
        let targetId = relevantItems[0]?.id;

        if (!targetId) {
            // Se não existe o item no estoque ainda, precisamos criar um primeiro registro
            onAddManual({
                productType: 'Treliça',
                model: movingItem.model,
                size: movingItem.size,
                quantity: 0,
                physicalQuantity: movingItem.type === 'audit' ? movementQty : 0,
                totalWeight: 0,
                orderNumber: 'INVENTARIO',
                productionOrderId: 'MANUAL'
            });
            setMovingItem(null);
            return;
        }

        const currentItem = relevantItems[0];
        const movement: StockMovement = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            type: movingItem.type === 'transfer' ? 'transfer' : 'adjustment',
            from: movingItem.type === 'transfer' ? 'virtual' : 'physical',
            to: movingItem.type === 'transfer' ? 'physical' : 'out',
            quantity: movementQty,
            operator: currentUser?.username || 'Sistema',
            observations: obs || (movingItem.type === 'audit' ? 'Recuperação de contagem física' : 'Transferência para o pátio')
        };

        const updates: Partial<FinishedProductItem> = {};
        if (movingItem.type === 'transfer') {
            updates.quantity = Math.max(0, currentItem.quantity - movementQty);
            updates.physicalQuantity = (currentItem.physicalQuantity || 0) + movementQty;
        } else {
            // Audit (Edit Physical)
            updates.physicalQuantity = movementQty;
        }

        updates.movementHistory = [...(currentItem.movementHistory || []), movement];
        onUpdateQuantity(targetId, updates, movement);
        setMovingItem(null);
        setMovementQty(0);
        setObs('');
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8 animate-fade-in">
            {/* Modal de Ação Estilizado */}
            {movingItem && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                        <div className={`p-8 ${movingItem.type === 'transfer' ? 'bg-indigo-600' : 'bg-emerald-600'} text-white`}>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                {movingItem.type === 'transfer' ? <SwitchHorizontalIcon className="h-7 w-7" /> : <CalculatorIcon className="h-7 w-7" />}
                                {movingItem.type === 'transfer' ? 'Transferir para Físico' : 'Ajustar Contagem Física'}
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">{movingItem.model} - {movingItem.size}m</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {movingItem.type === 'transfer' ? 'Quantidade a Transferir' : 'Quantidade Física Real no Galpão'}
                                </label>
                                <input 
                                    type="number" 
                                    autoFocus
                                    value={movementQty} 
                                    onChange={(e) => setMovementQty(parseInt(e.target.value) || 0)}
                                    className="w-full p-5 bg-slate-50 rounded-2xl text-4xl font-black text-slate-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                                />
                                {movingItem.type === 'transfer' && (
                                    <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-tighter">
                                        Virtual Atual: {stockSummarized.find(s => s.model === movingItem.model && s.size === movingItem.size)?.virtualQty} pçs
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observações / Motivo</label>
                                <textarea 
                                    value={obs} 
                                    onChange={(e) => setObs(e.target.value)}
                                    placeholder="Ex: Auditoria realizada em..."
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-600 outline-none"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setMovingItem(null)} className="flex-1 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase">Cancelar</button>
                                <button onClick={handleAction} className={`flex-1 py-4 font-black text-white rounded-2xl shadow-lg transition-all uppercase ${movingItem.type === 'transfer' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-600 shadow-emerald-200'}`}>
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A2A3D] flex items-center justify-center shadow-lg shadow-slate-200">
                            <ArchiveIcon className="h-6 w-6 text-white" />
                        </div>
                        Inventário de Treliças
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-15">Controle de Divergências entre Virtual (Produção) e Físico (Galpão).</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setPage('productionOrderTrelica')} className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
                        <PlusIcon className="h-5 w-5" /> Iniciar Produção
                    </button>
                </div>
            </header>

            {/* Dashboard de Status Simplificado */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Virtual (Produzido)</p>
                    <p className="text-3xl font-black">{stockSummarized.reduce((acc, s) => acc + s.virtualQty, 0)} <small className="text-sm font-bold opacity-50 uppercase">pçs</small></p>
                </div>
                <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100">
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Físico (Disponível)</p>
                    <p className="text-3xl font-black">{stockSummarized.reduce((acc, s) => acc + s.physicalQty, 0)} <small className="text-sm font-bold opacity-50 uppercase">pçs</small></p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Divergência Total</p>
                    <p className={`text-3xl font-black ${stockSummarized.reduce((acc, s) => acc + (s.physicalQty - s.virtualQty), 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {stockSummarized.reduce((acc, s) => acc + (s.physicalQty - s.virtualQty), 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Geral</p>
                    <p className="text-3xl font-black text-slate-800">{stockSummarized.reduce((acc, s) => acc + s.totalWeight, 0).toFixed(0)} <small className="text-sm font-bold opacity-50 uppercase">kg</small></p>
                </div>
            </div>

            {/* Tabela de Inventário */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 uppercase text-[10px] tracking-widest font-black text-slate-400">
                                <th className="px-8 py-5">Modelo de Treliça</th>
                                <th className="px-6 py-5 text-center">Tamanho</th>
                                <th className="px-6 py-5 text-center bg-slate-100/30 text-slate-600">Estoque Virtual</th>
                                <th className="px-6 py-5 text-center bg-indigo-50/20 text-indigo-900 border-x border-indigo-50">Estoque Físico</th>
                                <th className="px-6 py-5 text-center">Saldo (Dif.)</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stockSummarized.map((s, idx) => {
                                const diff = s.physicalQty - s.virtualQty;
                                return (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-xl text-slate-800 tracking-tighter uppercase">{s.model}</span>
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Produto Acabado</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-600">{s.size}m</span>
                                        </td>
                                        <td className="px-6 py-6 text-center bg-slate-50/50">
                                            <span className="text-2xl font-black text-slate-300 group-hover:text-slate-500 transition-colors">{s.virtualQty}</span>
                                        </td>
                                        <td className="px-6 py-6 text-center bg-indigo-50/10 border-x border-indigo-50">
                                            <span className="text-3xl font-black text-indigo-700">{s.physicalQty}</span>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </span>
                                                {diff !== 0 && (
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {diff < 0 ? 'Falta no Físico' : 'Sobra no Físico'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => setMovingItem({ model: s.model, size: s.size, type: 'transfer' })}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                                >
                                                    <SwitchHorizontalIcon className="h-4 w-4" /> Transferir
                                                </button>
                                                <button 
                                                    onClick={() => setMovingItem({ model: s.model, size: s.size, type: 'audit' })}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 transition-all active:scale-95"
                                                    title="Contagem de Galpão"
                                                >
                                                    <CalculatorIcon className="h-4 w-4" /> Ajustar Físico
                                                </button>
                                                {s.lastItemIds.length > 0 && (
                                                    <button 
                                                        onClick={() => {
                                                            const item = finishedGoods.find(i => i.id === s.lastItemIds[0]);
                                                            if (item) setHistoryItem(item);
                                                        }}
                                                        className="p-3 text-slate-400 hover:text-slate-900 border border-slate-100 rounded-xl transition-all"
                                                    >
                                                        <ClockIcon className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {historyItem && <HistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
        </div>
    );
};

export default TrelicaStockManager;
