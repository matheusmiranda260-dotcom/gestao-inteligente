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

interface ModelStockSummary {
    model: string;
    size: string;
    virtualQty: number;
    physicalQty: number;
    totalWeight: number;
    lastItemIds: string[];
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
                            <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                    {m.type === 'transfer' ? <SwitchHorizontalIcon className="h-5 w-5 text-indigo-600" /> : <CalculatorIcon className="h-5 w-5 text-emerald-500" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="font-black text-slate-800 uppercase text-[10px]">
                                            {m.type === 'transfer' ? 'Virtual → Físico' : 'Ajuste de Saldo'}
                                        </p>
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(m.date).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 mt-1">
                                        Qtd: <span className="text-indigo-600">{m.quantity}</span>
                                        <span className="mx-2 text-slate-300">|</span>
                                        Destino: <span className="text-slate-500 uppercase">{m.to === 'virtual' ? 'Virtual' : 'Físico'}</span>
                                    </p>
                                    {m.observations && <p className="text-xs text-slate-500 italic mt-1 font-medium italic">"{m.observations}"</p>}
                                    <p className="text-[9px] font-black text-slate-300 uppercase mt-2 tracking-widest">Operador: {m.operator}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <ArchiveIcon className="h-12 w-12 text-slate-200 mx-auto mb-2" />
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma movimentação</p>
                    </div>
                )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t flex justify-end">
                <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-900 transition-all uppercase text-xs tracking-widest">Fechar</button>
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
    const [movingItem, setMovingItem] = useState<{ model: string; size: string; type: 'transfer' | 'audit' | 'virtual_audit' } | null>(null);
    const [historyItem, setHistoryItem] = useState<FinishedProductItem | null>(null);
    const [movementQty, setMovementQty] = useState(0);
    const [obs, setObs] = useState('');

    const stockSummarized = useMemo(() => {
        const summary: Record<string, ModelStockSummary> = {};
        
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

    const handleAction = () => {
        if (!movingItem) return;

        const relevantItems = finishedGoods.filter(i => i.model === movingItem.model && i.size.trim() === movingItem.size.trim());
        let targetId = relevantItems[0]?.id;

        if (!targetId) {
            onAddManual({
                productType: 'Treliça',
                model: movingItem.model,
                size: movingItem.size,
                quantity: movingItem.type === 'virtual_audit' ? movementQty : 0,
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
            from: movingItem.type === 'transfer' ? 'virtual' : movingItem.type === 'virtual_audit' ? 'system' : 'physical',
            to: movingItem.type === 'transfer' ? 'physical' : movingItem.type === 'virtual_audit' ? 'virtual' : 'out',
            quantity: movementQty,
            operator: currentUser?.username || 'Sistema',
            observations: obs || (movingItem.type === 'audit' ? 'Ajuste de estoque físico' : movingItem.type === 'virtual_audit' ? 'Ajuste de estoque virtual' : 'Transferência para o pátio')
        };

        const updates: Partial<FinishedProductItem> = {};
        if (movingItem.type === 'transfer') {
            updates.quantity = Math.max(0, currentItem.quantity - movementQty);
            updates.physicalQuantity = (currentItem.physicalQuantity || 0) + movementQty;
        } else if (movingItem.type === 'virtual_audit') {
            updates.quantity = movementQty;
        } else {
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
            {movingItem && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                        <div className={`p-8 ${movingItem.type === 'transfer' ? 'bg-indigo-600' : movingItem.type === 'virtual_audit' ? 'bg-slate-700' : 'bg-emerald-600'} text-white`}>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                {movingItem.type === 'transfer' ? <SwitchHorizontalIcon className="h-7 w-7" /> : <CalculatorIcon className="h-7 w-7" />}
                                {movingItem.type === 'transfer' ? 'Transferir para Físico' : movingItem.type === 'virtual_audit' ? 'Ajustar Saldo Virtual' : 'Ajustar Contagem Física'}
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">{movingItem.model} - {movingItem.size}m</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {movingItem.type === 'transfer' ? 'Quantidade a Transferir' : movingItem.type === 'virtual_audit' ? 'Novo Saldo Virtual (Sistema)' : 'Nova Contagem Física Real (Galpão)'}
                                </label>
                                <input 
                                    type="number" 
                                    autoFocus
                                    value={movementQty} 
                                    onChange={(e) => setMovementQty(parseInt(e.target.value) || 0)}
                                    className="w-full p-5 bg-slate-50 rounded-2xl text-4xl font-black text-slate-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações / Motivo</label>
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">Obrigatório</span>
                                </div>
                                <textarea 
                                    value={obs} 
                                    required
                                    onChange={(e) => setObs(e.target.value)}
                                    placeholder="Ex: Auditoria mensal, erro de lançamento, quebra..."
                                    className={`w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-600 outline-none transition-all border-2 ${!obs.trim() ? 'border-red-100 focus:border-red-200' : 'border-emerald-100 focus:border-emerald-200'}`}
                                />
                                {!obs.trim() && <p className="text-[9px] font-bold text-red-400 mt-2 uppercase">Descreva o motivo para liberar a gravação</p>}
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => { setMovingItem(null); setObs(''); }} className="flex-1 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase text-xs">Cancelar</button>
                                <button 
                                    onClick={handleAction} 
                                    disabled={!obs.trim()}
                                    className={`flex-1 py-4 font-black text-white rounded-2xl shadow-lg transition-all uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none ${movingItem.type === 'transfer' ? 'bg-indigo-600' : movingItem.type === 'virtual_audit' ? 'bg-slate-700' : 'bg-emerald-600'}`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A2A3D] flex items-center justify-center shadow-lg shadow-slate-200">
                            <ArchiveIcon className="h-6 w-6 text-white" />
                        </div>
                        Inventário de Treliças
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-15">Conciliação entre produção virtual e estoque físico no galpão.</p>
                </div>
                <button onClick={() => setPage('productionOrderTrelica')} className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
                    <PlusIcon className="h-5 w-5" /> Nova Ordem
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-800 p-6 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Virtual</p>
                    <p className="text-3xl font-black">{stockSummarized.reduce((acc, s) => acc + s.virtualQty, 0)} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                </div>
                <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100">
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Físico</p>
                    <p className="text-3xl font-black">{stockSummarized.reduce((acc, s) => acc + s.physicalQty, 0)} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diferença Geral</p>
                    <p className={`text-3xl font-black ${stockSummarized.reduce((acc, s) => acc + (s.physicalQty - s.virtualQty), 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {stockSummarized.reduce((acc, s) => acc + (s.physicalQty - s.virtualQty), 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Estimado</p>
                    <p className="text-3xl font-black text-slate-800">{stockSummarized.reduce((acc, s) => acc + s.totalWeight, 0).toFixed(0)} <span className="text-sm opacity-50 uppercase">kg</span></p>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 uppercase text-[10px] tracking-widest font-black text-slate-400">
                                <th className="px-8 py-5">Modelo / Especificação</th>
                                <th className="px-6 py-5 text-center">Tamanho</th>
                                <th className="px-6 py-5 text-center bg-slate-100/30">Estoque Virtual</th>
                                <th className="px-6 py-5 text-center bg-indigo-50/20 border-x border-indigo-50">Estoque Físico</th>
                                <th className="px-6 py-5 text-center">Saldo (Dif.)</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700">
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
                                        
                                        {/* Coluna Virtual Editável */}
                                        <td className="px-6 py-6 text-center bg-slate-50/30">
                                            <div className="flex flex-col items-center gap-1 group/vqty">
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'virtual_audit' });
                                                            setMovementQty(Math.max(0, s.virtualQty - 1));
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-slate-600 transition-colors opacity-0 group-hover/vqty:opacity-100"
                                                    >
                                                        <MinusIcon className="h-4 w-4" />
                                                    </button>
                                                    
                                                    <span 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'virtual_audit' });
                                                            setMovementQty(s.virtualQty);
                                                        }}
                                                        className="text-2xl font-black text-slate-400 cursor-pointer hover:text-slate-900 transition-colors"
                                                    >
                                                        {s.virtualQty}
                                                    </span>

                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'virtual_audit' });
                                                            setMovementQty(s.virtualQty + 1);
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-slate-600 transition-colors opacity-0 group-hover/vqty:opacity-100"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <span className="text-[8px] font-black text-slate-300 uppercase opacity-0 group-hover/vqty:opacity-100 transition-all">Editar Virtual</span>
                                            </div>
                                        </td>

                                        {/* Coluna Física Editável */}
                                        <td className="px-6 py-6 text-center bg-indigo-50/10 border-x border-indigo-50">
                                            <div className="flex flex-col items-center gap-1 group/pqty">
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'audit' });
                                                            setMovementQty(Math.max(0, s.physicalQty - 1));
                                                        }}
                                                        className="p-1 text-indigo-300 hover:text-indigo-600 transition-colors opacity-0 group-hover/pqty:opacity-100"
                                                    >
                                                        <MinusIcon className="h-4 w-4" />
                                                    </button>
                                                    
                                                    <span 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'audit' });
                                                            setMovementQty(s.physicalQty);
                                                        }}
                                                        className="text-3xl font-black text-indigo-700 cursor-pointer hover:scale-110 transition-transform"
                                                    >
                                                        {s.physicalQty}
                                                    </span>

                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: s.model, size: s.size, type: 'audit' });
                                                            setMovementQty(s.physicalQty + 1);
                                                        }}
                                                        className="p-1 text-indigo-300 hover:text-indigo-600 transition-colors opacity-0 group-hover/pqty:opacity-100"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <span className="text-[8px] font-black text-indigo-300 uppercase opacity-0 group-hover/pqty:opacity-100 transition-all">Editar Físico</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xl font-black ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </span>
                                                {diff !== 0 && (
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {diff < 0 ? 'Falta Físico' : 'Sobra Físico'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => setMovingItem({ model: s.model, size: s.size, type: 'transfer' })}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                                >
                                                    <SwitchHorizontalIcon className="h-4 w-4" /> Transferir
                                                </button>
                                                {s.lastItemIds.length > 0 && (
                                                    <button 
                                                        onClick={() => {
                                                            const item = finishedGoods.find(i => i.id === s.lastItemIds[0]);
                                                            if (item) setHistoryItem(item);
                                                        }}
                                                        className="p-3 text-slate-400 hover:text-slate-900 border border-slate-100 rounded-xl transition-all"
                                                        title="Histórico"
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
