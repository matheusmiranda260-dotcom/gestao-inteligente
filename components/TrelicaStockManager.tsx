import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, User, FinishedGoodsTransferRecord, StockMovement } from '../types';
import { ArchiveIcon, SwitchHorizontalIcon, ClockIcon, CalculatorIcon, PlusIcon } from './icons';
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

const TrelicaStockManager: React.FC<TrelicaStockManagerProps> = ({ 
    finishedGoods, 
    setPage, 
    onUpdateQuantity,
    onAddManual,
    currentUser 
}) => {
    const [selectedModelKey, setSelectedModelKey] = useState<string>('');
    const [movingItem, setMovingItem] = useState<{ model: string; size: string; type: 'transfer' | 'audit' | 'virtual_audit' | 'add_virtual' } | null>(null);
    const [movementQty, setMovementQty] = useState(0);
    const [obs, setObs] = useState('');
    
    // Calcula o resumo do item selecionado
    const selectedSummary = useMemo(() => {
        if (!selectedModelKey) return null;
        
        const [model, size] = selectedModelKey.split('_');
        
        let virtualQty = 0;
        let physicalQty = 0;
        let totalWeight = 0;
        let allMovements: StockMovement[] = [];
        
        finishedGoods.filter(i => i.productType === 'Treliça' && i.model === model && i.size.trim() === size.trim()).forEach(item => {
            virtualQty += item.quantity;
            physicalQty += (item.physicalQuantity || 0);
            totalWeight += item.totalWeight;
            if (item.movementHistory) {
                allMovements = [...allMovements, ...item.movementHistory];
            }
        });
        
        // Ordena movimentações da mais recente para a mais antiga
        allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return {
            model,
            size,
            virtualQty,
            physicalQty,
            totalWeight,
            diff: physicalQty - virtualQty,
            movements: allMovements
        };
    }, [finishedGoods, selectedModelKey]);

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
            type: movingItem.type === 'transfer' ? 'transfer' : movingItem.type === 'add_virtual' ? 'addition' : 'adjustment',
            from: movingItem.type === 'transfer' ? 'virtual' : movingItem.type === 'add_virtual' ? 'production' : movingItem.type === 'virtual_audit' ? 'system' : 'physical',
            to: movingItem.type === 'transfer' ? 'physical' : (movingItem.type === 'virtual_audit' || movingItem.type === 'add_virtual') ? 'virtual' : 'out',
            quantity: movementQty,
            operator: currentUser?.username || 'Sistema',
            observations: obs || (movingItem.type === 'audit' ? 'Ajuste de estoque físico' : movingItem.type === 'add_virtual' ? 'Entrada de estoque' : movingItem.type === 'virtual_audit' ? 'Ajuste de estoque virtual' : 'Transferência para o pátio')
        };

        const updates: Partial<FinishedProductItem> = {};
        if (movingItem.type === 'transfer') {
            updates.quantity = Math.max(0, currentItem.quantity - movementQty);
            updates.physicalQuantity = (currentItem.physicalQuantity || 0) + movementQty;
        } else if (movingItem.type === 'virtual_audit') {
            updates.quantity = movementQty;
        } else if (movingItem.type === 'add_virtual') {
            updates.quantity = (currentItem.quantity || 0) + movementQty;
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
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-modal-in">
                        <div className={`p-8 ${movingItem.type === 'transfer' ? 'bg-indigo-600' : movingItem.type === 'virtual_audit' ? 'bg-slate-700' : movingItem.type === 'add_virtual' ? 'bg-emerald-500' : 'bg-emerald-600'} text-white`}>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                {movingItem.type === 'transfer' ? <SwitchHorizontalIcon className="h-7 w-7" /> : movingItem.type === 'add_virtual' ? <PlusIcon className="h-7 w-7" /> : <CalculatorIcon className="h-7 w-7" />}
                                {movingItem.type === 'transfer' ? 'Transferir para Físico' : movingItem.type === 'add_virtual' ? 'Adicionar Estoque' : movingItem.type === 'virtual_audit' ? 'Ajustar Saldo Virtual' : 'Ajustar Contagem Física'}
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">{movingItem.model} - {movingItem.size}m</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {movingItem.type === 'transfer' ? 'Quantidade a Transferir' : movingItem.type === 'add_virtual' ? 'Quantidade a Adicionar' : movingItem.type === 'virtual_audit' ? 'Novo Saldo Virtual (Sistema)' : 'Nova Contagem Física Real (Galpão)'}
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

            {/* Seletor de Modelo */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Selecione o Modelo de Treliça</label>
                <select 
                    value={selectedModelKey}
                    onChange={(e) => setSelectedModelKey(e.target.value)}
                    className="w-full p-4 sm:p-5 text-lg sm:text-xl bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all outline-none cursor-pointer hover:bg-slate-100"
                >
                    <option value="">-- Escolha um modelo para visualizar --</option>
                    {trelicaModels.map((m, idx) => (
                        <option key={idx} value={`${m.modelo}_${m.tamanho}`}>
                            {m.modelo} - {m.tamanho}m
                        </option>
                    ))}
                </select>
            </div>

            {selectedSummary && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-800 p-6 rounded-[2rem] text-white flex flex-col justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estoque Virtual</p>
                            <p className="text-4xl font-black">{selectedSummary.virtualQty} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                        </div>
                        <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Estoque Físico</p>
                            <p className="text-4xl font-black">{selectedSummary.physicalQty} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diferença Geral</p>
                            <p className={`text-4xl font-black ${selectedSummary.diff < 0 ? 'text-red-500' : selectedSummary.diff > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                {selectedSummary.diff > 0 ? `+${selectedSummary.diff}` : selectedSummary.diff}
                            </p>
                            {selectedSummary.diff !== 0 && (
                                <span className={`text-[10px] font-black uppercase mt-2 ${selectedSummary.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {selectedSummary.diff < 0 ? 'Falta no Físico' : 'Sobra no Físico'}
                                </span>
                            )}
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Estimado</p>
                            <p className="text-4xl font-black text-slate-800">{selectedSummary.totalWeight.toFixed(0)} <span className="text-sm opacity-50 uppercase">kg</span></p>
                        </div>
                    </div>

                    {/* Botões de Ação Rapida */}
                    <div className="flex flex-wrap gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <button 
                            onClick={() => {
                                setMovingItem({ model: selectedSummary.model, size: selectedSummary.size, type: 'add_virtual' });
                                setMovementQty(0);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-black uppercase transition-all border border-indigo-100"
                        >
                            <PlusIcon className="h-5 w-5" /> Adicionar
                        </button>
                        <button 
                            onClick={() => {
                                setMovingItem({ model: selectedSummary.model, size: selectedSummary.size, type: 'virtual_audit' });
                                setMovementQty(selectedSummary.virtualQty);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase transition-all"
                        >
                            <CalculatorIcon className="h-5 w-5" /> Ajustar Virtual
                        </button>
                        <button 
                            onClick={() => {
                                setMovingItem({ model: selectedSummary.model, size: selectedSummary.size, type: 'audit' });
                                setMovementQty(selectedSummary.physicalQty);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-black uppercase transition-all"
                        >
                            <CalculatorIcon className="h-5 w-5" /> Ajustar Físico
                        </button>
                        <button 
                            onClick={() => setMovingItem({ model: selectedSummary.model, size: selectedSummary.size, type: 'transfer' })}
                            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            <SwitchHorizontalIcon className="h-5 w-5" /> Transferir P/ Físico
                        </button>
                    </div>

                    {/* Histórico na Tela */}
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center gap-3">
                            <div className="p-3 bg-slate-100 rounded-xl text-slate-500">
                                <ClockIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight text-slate-800">Histórico de Movimentações</h3>
                                <p className="text-slate-500 text-xs font-bold mt-1">Registros de transferências e ajustes para {selectedSummary.model} - {selectedSummary.size}m</p>
                            </div>
                        </div>
                        
                        <div className="p-6 sm:p-8">
                            {selectedSummary.movements.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedSummary.movements.map((m, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                                {m.type === 'transfer' ? <SwitchHorizontalIcon className="h-6 w-6 text-indigo-600" /> : <CalculatorIcon className="h-6 w-6 text-emerald-500" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                    <div>
                                                        <p className="font-black text-slate-800 uppercase text-xs">
                                                            {m.type === 'transfer' ? 'Virtual → Físico' : m.type === 'addition' ? 'Adição de Estoque' : m.from === 'system' ? 'Ajuste de Saldo Virtual' : 'Ajuste de Saldo Físico'}
                                                        </p>
                                                        <p className="text-sm font-bold text-slate-700 mt-1">
                                                            Quantidade: <span className={m.type === 'transfer' ? 'text-indigo-600' : 'text-emerald-600'}>{m.quantity}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-left sm:text-right">
                                                        <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-lg border border-slate-200 block w-fit sm:ml-auto">
                                                            {new Date(m.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">
                                                            Operador: <span className="text-slate-600">{m.operator}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                {m.observations && (
                                                    <p className="text-sm text-slate-600 mt-3 p-3 bg-white rounded-xl border border-slate-100 font-medium">
                                                        "{m.observations}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <ArchiveIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                    <h4 className="text-lg font-black text-slate-700 mb-2">Nenhuma movimentação registrada</h4>
                                    <p className="text-slate-500 font-medium max-w-md mx-auto text-sm">Este modelo ainda não possui histórico de transferências ou ajustes de estoque.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrelicaStockManager;
