import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, User, FinishedGoodsTransferRecord, StockMovement, ProductionOrderData, StockItem } from '../types';
import { ArchiveIcon, SwitchHorizontalIcon, ClockIcon, CalculatorIcon, PlusIcon, PlayIcon, PauseIcon, CheckCircleIcon } from './icons';
import { trelicaModels } from './ProductionOrderTrelica';

interface TrelicaStockManagerProps {
    finishedGoods: FinishedProductItem[];
    setPage: (page: Page) => void;
    createFinishedGoodsTransfer: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => FinishedGoodsTransferRecord | null;
    onDelete?: (ids: string[]) => void;
    onUpdateQuantity: (id: string, updates: Partial<FinishedProductItem>, movement?: StockMovement) => void;
    onAddManual: (item: Omit<FinishedProductItem, 'id' | 'status' | 'productionDate'>) => void;
    currentUser: User | null;
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
}

const TrelicaStockManager: React.FC<TrelicaStockManagerProps> = ({ 
    finishedGoods, 
    setPage, 
    onUpdateQuantity,
    onAddManual,
    currentUser,
    productionOrders = [],
    stock = []
}) => {
    const [activeTab, setActiveTab] = useState<'floor' | 'production' | 'ca60' | 'history'>('floor');
    const [movingItem, setMovingItem] = useState<{ model: string; size: string; type: 'transfer' | 'audit' | 'virtual_audit' | 'add_virtual' } | null>(null);
    const [movementQty, setMovementQty] = useState(0);
    const [obs, setObs] = useState('');

    // --- CÁLCULO DE RESUMO GERAL DAS TRELIÇAS ---
    const overallStats = useMemo(() => {
        let totalVirtual = 0;
        let totalPhysical = 0;
        let totalWeight = 0;
        
        finishedGoods.filter(i => i.productType === 'Treliça').forEach(item => {
            totalVirtual += item.quantity;
            totalPhysical += (item.physicalQuantity || 0);
            totalWeight += item.totalWeight;
        });

        return {
            totalVirtual,
            totalPhysical,
            totalWeight,
            totalDiff: totalPhysical - totalVirtual
        };
    }, [finishedGoods]);

    // --- LISTAGEM DE MODELOS (ESTOQUE CHÃO) ---
    const modelsSummary = useMemo(() => {
        return trelicaModels.map(m => {
            let virtualQty = 0;
            let physicalQty = 0;
            let totalWeight = 0;
            let id = '';
            
            const relevantItems = finishedGoods.filter(
                i => i.productType === 'Treliça' && 
                i.model === m.modelo && 
                i.size.trim() === m.tamanho.trim()
            );

            if (relevantItems.length > 0) {
                id = relevantItems[0].id;
                relevantItems.forEach(item => {
                    virtualQty += item.quantity;
                    physicalQty += (item.physicalQuantity || 0);
                    totalWeight += item.totalWeight;
                });
            }

            return {
                id,
                model: m.modelo,
                size: m.tamanho,
                virtualQty,
                physicalQty,
                totalWeight,
                diff: physicalQty - virtualQty,
                theoreticalWeightPerPiece: parseFloat(m.pesoFinal.replace(',', '.'))
            };
        });
    }, [finishedGoods]);

    // --- FILTRAGEM DE ORDENS EM PRODUÇÃO (TRELIÇA) ---
    const trelicaOrders = useMemo(() => {
        return productionOrders.filter(
            o => o.machine && (o.machine.startsWith('Treliça') || o.machine === 'Treliça')
        );
    }, [productionOrders]);

    const activeOrders = useMemo(() => {
        return trelicaOrders.filter(
            o => o.status === 'in_progress' || o.status === 'Ativa' || o.status === 'active'
        );
    }, [trelicaOrders]);

    const pendingOrders = useMemo(() => {
        return trelicaOrders.filter(
            o => o.status === 'pending' || o.status === 'paused' || o.status === 'Inativa'
        );
    }, [trelicaOrders]);

    // --- FILTRAGEM DO ESTOQUE DE CA-60 ---
    const ca60Stock = useMemo(() => {
        return stock.filter(
            item => item.materialType === 'CA-60' && 
            item.status === 'Disponível' && 
            item.remainingQuantity > 0
        ).sort((a, b) => a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true }));
    }, [stock]);

    const totalCa60Weight = useMemo(() => {
        return ca60Stock.reduce((acc, item) => acc + (item.remainingQuantity || 0), 0);
    }, [ca60Stock]);

    // --- HISTÓRICO GERAL DE MOVIMENTAÇÕES ---
    const globalHistory = useMemo(() => {
        let list: { model: string; size: string; movement: StockMovement }[] = [];
        finishedGoods.filter(i => i.productType === 'Treliça').forEach(item => {
            if (item.movementHistory) {
                item.movementHistory.forEach(m => {
                    list.push({
                        model: item.model,
                        size: item.size,
                        movement: m
                    });
                });
            }
        });
        return list.sort((a, b) => new Date(b.movement.date).getTime() - new Date(a.movement.date).getTime());
    }, [finishedGoods]);

    // --- HANDLER PARA EXECUÇÃO DE AJUSTES/TRANSFERÊNCIAS ---
    const handleAction = () => {
        if (!movingItem) return;

        const relevantItems = finishedGoods.filter(
            i => i.model === movingItem.model && i.size.trim() === movingItem.size.trim()
        );
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
            id: Math.random().toString(36).substring(2, 11),
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
            {/* Modal de Movimentação */}
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

            {/* Cabeçalho */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A2A3D] flex items-center justify-center shadow-lg shadow-slate-200">
                            <ArchiveIcon className="h-6 w-6 text-white" />
                        </div>
                        Gestão de Treliças
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 ml-15">Controle de produto acabado, ordens em andamento e estoque de CA-60.</p>
                </div>
                <button onClick={() => setPage('productionOrderTrelica')} className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md">
                    <PlusIcon className="h-5 w-5" /> Criar Ordem
                </button>
            </header>

            {/* Menu de Abas */}
            <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-thin">
                <button
                    onClick={() => setActiveTab('floor')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'floor'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    📦 Estoque Chão (Galpão)
                </button>
                <button
                    onClick={() => setActiveTab('production')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'production'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    🏭 Ordens em Produção
                </button>
                <button
                    onClick={() => setActiveTab('ca60')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'ca60'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    ⚙️ Estoque CA-60 Conosco
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    ⏱️ Histórico de Movimentações
                </button>
            </div>

            {/* --- CONTEÚDO DAS ABAS --- */}

            {/* ABA 1: ESTOQUE CHÃO */}
            {activeTab === 'floor' && (
                <div className="space-y-6">
                    {/* Cards Resumo Geral */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-slate-800 p-6 rounded-[2rem] text-white flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estoque Virtual Total</p>
                            <p className="text-4xl font-black">{overallStats.totalVirtual} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                        </div>
                        <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Estoque Físico Total</p>
                            <p className="text-4xl font-black">{overallStats.totalPhysical} <span className="text-sm opacity-50 uppercase">pçs</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diferença Geral</p>
                            <p className={`text-4xl font-black ${overallStats.totalDiff < 0 ? 'text-red-500' : overallStats.totalDiff > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                {overallStats.totalDiff > 0 ? `+${overallStats.totalDiff}` : overallStats.totalDiff}
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Total Estimado</p>
                            <p className="text-4xl font-black text-slate-800">{(overallStats.totalWeight).toFixed(0)} <span className="text-sm opacity-50 uppercase">kg</span></p>
                        </div>
                    </div>

                    {/* Tabela Geral de Modelos */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Modelos de Treliça em Estoque</h3>
                            <p className="text-xs text-slate-400 mt-1">Saldo atual e conciliação por modelo e tamanho.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                    <tr>
                                        <th scope="col" className="px-6 py-4">Treliça (Modelo/Tamanho)</th>
                                        <th scope="col" className="px-6 py-4 text-center">Virtual (Sistema)</th>
                                        <th scope="col" className="px-6 py-4 text-center">Físico (Galpão)</th>
                                        <th scope="col" className="px-6 py-4 text-center">Diferença</th>
                                        <th scope="col" className="px-6 py-4 text-right">Peso Est. (kg)</th>
                                        <th scope="col" className="px-6 py-4 text-center">Ações de Estoque</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelsSummary.map((item, idx) => (
                                        <tr key={idx} className="bg-white border-b hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-800">
                                                {item.model} <span className="text-slate-400 text-xs font-semibold">({item.size}m)</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">{item.virtualQty} pçs</td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-800">{item.physicalQty} pçs</td>
                                            <td className="px-6 py-4 text-center font-bold">
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    item.diff < 0 
                                                        ? 'bg-red-50 text-red-600' 
                                                        : item.diff > 0 
                                                            ? 'bg-emerald-50 text-emerald-600' 
                                                            : 'text-slate-400'
                                                }`}>
                                                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold text-slate-600">{(item.totalWeight).toFixed(0)} kg</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: item.model, size: item.size, type: 'add_virtual' });
                                                            setMovementQty(0);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase transition-all"
                                                        title="Adicionar Saldo"
                                                    >
                                                        + Add
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: item.model, size: item.size, type: 'virtual_audit' });
                                                            setMovementQty(item.virtualQty);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase transition-all"
                                                        title="Ajustar Virtual"
                                                    >
                                                        Virtual
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: item.model, size: item.size, type: 'audit' });
                                                            setMovementQty(item.physicalQty);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase transition-all"
                                                        title="Ajustar Físico"
                                                    >
                                                        Físico
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: item.model, size: item.size, type: 'transfer' });
                                                            setMovementQty(0);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                                        title="Transferir Virtual para Físico"
                                                    >
                                                        Transferir
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: ORDENS EM PRODUÇÃO */}
            {activeTab === 'production' && (
                <div className="space-y-8">
                    {/* Ordens Ativas */}
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ordens em Processo Ativo
                        </h3>
                        {activeOrders.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {activeOrders.map(order => {
                                    const progress = order.quantityToProduce > 0 
                                        ? Math.min(100, Math.round(((order.actualProducedQuantity || 0) / order.quantityToProduce) * 100))
                                        : 0;

                                    return (
                                        <div key={order.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-emerald-200">
                                                        {order.machine}
                                                    </span>
                                                    <h4 className="text-lg font-black text-slate-800 mt-2">OP #{order.orderNumber}</h4>
                                                    <p className="text-xs text-slate-400 font-bold uppercase mt-1">Operador: {order.operator || 'Sem registro'}</p>
                                                </div>
                                                <span className="text-sm font-black text-[#0F3F5C] bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm">
                                                    {order.trelicaModel}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                                                    <span>Progresso da Produção</span>
                                                    <span>{order.actualProducedQuantity || 0} / {order.quantityToProduce} pçs ({progress}%)</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-xs font-semibold text-slate-500 pt-2 border-t border-slate-200/50">
                                                <span>Iniciado em:</span>
                                                <span>{order.startTime ? new Date(order.startTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed">
                                <PlayIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 font-bold">Nenhuma ordem de Treliça em produção no momento.</p>
                            </div>
                        )}
                    </div>

                    {/* Ordens Pendentes / Pausadas */}
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                            <PauseIcon className="h-5 w-5 text-amber-500" />
                            Fila de Espera / Pausadas
                        </h3>
                        {pendingOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Nº Ordem</th>
                                            <th className="px-6 py-4">Máquina</th>
                                            <th className="px-6 py-4">Modelo Solicitado</th>
                                            <th className="px-6 py-4 text-right">Planejado (pçs)</th>
                                            <th className="px-6 py-4 text-center">Criada em</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingOrders.map(order => (
                                            <tr key={order.id} className="border-b hover:bg-slate-50/50 bg-white">
                                                <td className="px-6 py-4">
                                                    {order.status === 'paused' ? (
                                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200 uppercase">Pausada</span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded border border-slate-200 uppercase">Fila</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 font-black text-slate-900">#{order.orderNumber}</td>
                                                <td className="px-6 py-4 font-bold">{order.machine}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-700">{order.trelicaModel} ({order.tamanho}m)</td>
                                                <td className="px-6 py-4 text-right font-black">{order.quantityToProduce} pçs</td>
                                                <td className="px-6 py-4 text-center text-xs">
                                                    {order.creationDate ? new Date(order.creationDate).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed">
                                <PauseIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 font-bold">Nenhuma ordem pendente ou pausada na fila.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ABA 3: ESTOQUE CA-60 CONOSCO */}
            {activeTab === 'ca60' && (
                <div className="space-y-6">
                    {/* Card Resumo do Aço */}
                    <div className="bg-gradient-to-r from-[#0F3F5C] to-slate-800 p-8 rounded-[2rem] text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <CalculatorIcon className="h-6 w-6 text-indigo-300" />
                                </div>
                                Matéria-Prima CA-60 em Estoque
                            </h3>
                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Bobinas e rolos disponíveis para fabricação de treliça</p>
                        </div>
                        <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/10 text-right">
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">Peso Total CA-60</p>
                            <p className="text-4xl font-black text-white">{(totalCa60Weight).toLocaleString('pt-BR')} <span className="text-sm font-bold uppercase">kg</span></p>
                        </div>
                    </div>

                    {/* Tabela de Lotes de CA-60 */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Lotes de Matéria-Prima Disponíveis</h3>
                            <p className="text-xs text-slate-400 mt-1">Lotes de aço CA-60 atualmente na empresa.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-6 py-4">Lote Interno</th>
                                        <th className="px-6 py-4">Fornecedor</th>
                                        <th className="px-6 py-4">Corrida / Lote Fornecedor</th>
                                        <th className="px-6 py-4 text-center">Bitola (Fio)</th>
                                        <th className="px-6 py-4 text-right">Peso Restante (kg)</th>
                                        <th className="px-6 py-4 text-center">Data de Entrada</th>
                                        <th className="px-6 py-4 text-center">Setor / Local</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ca60Stock.map(lot => (
                                        <tr key={lot.id} className="bg-white border-b hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{lot.internalLot}</td>
                                            <td className="px-6 py-4 font-semibold">{lot.supplier || 'Não informado'}</td>
                                            <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                                                {lot.runNumber || lot.supplierLot || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-black text-indigo-600">{lot.bitola} mm</td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800">{(lot.remainingQuantity || 0).toLocaleString('pt-BR')} kg</td>
                                            <td className="px-6 py-4 text-center text-xs">
                                                {lot.entryDate ? new Date(lot.entryDate).toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                                    {lot.sector || 'Geral'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {ca60Stock.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400 font-semibold">
                                                Nenhum lote de CA-60 disponível em estoque no momento.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 4: HISTÓRICO GERAL */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-3 bg-slate-100 rounded-xl text-slate-500">
                            <ClockIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-slate-800">Histórico Geral de Movimentações</h3>
                            <p className="text-slate-500 text-xs font-bold mt-1">Registros consolidados de auditorias, adições e transferências de todas as treliças.</p>
                        </div>
                    </div>
                    
                    <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {globalHistory.length > 0 ? (
                            <div className="space-y-4">
                                {globalHistory.map((m, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            {m.movement.type === 'transfer' ? (
                                                <SwitchHorizontalIcon className="h-6 w-6 text-indigo-600" />
                                            ) : m.movement.type === 'addition' ? (
                                                <PlusIcon className="h-6 w-6 text-emerald-500" />
                                            ) : (
                                                <CalculatorIcon className="h-6 w-6 text-amber-500" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase text-xs">
                                                        Treliça {m.model} ({m.size}m) &mdash; {
                                                            m.movement.type === 'transfer' ? 'Virtual → Físico' : 
                                                            m.movement.type === 'addition' ? 'Adição de Estoque' : 
                                                            m.movement.from === 'system' ? 'Ajuste de Saldo Virtual' : 'Ajuste de Saldo Físico'
                                                        }
                                                    </p>
                                                    <p className="text-sm font-bold text-slate-700 mt-1">
                                                        Quantidade: <span className={
                                                            m.movement.type === 'transfer' ? 'text-indigo-600' : 
                                                            m.movement.type === 'addition' ? 'text-emerald-600' : 'text-amber-600'
                                                        }>{m.movement.quantity} pçs</span>
                                                    </p>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-lg border border-slate-200 block w-fit sm:ml-auto">
                                                        {new Date(m.movement.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </span>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">
                                                        Operador: <span className="text-slate-600">{m.movement.operator}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {m.movement.observations && (
                                                <p className="text-sm text-slate-600 mt-3 p-3 bg-white rounded-xl border border-slate-100 font-medium">
                                                    "{m.movement.observations}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <ArchiveIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                <h4 className="text-lg font-black text-slate-700 mb-2">Nenhum histórico registrado</h4>
                                <p className="text-slate-500 font-medium max-w-md mx-auto text-sm">Ainda não existem logs de movimentações de treliças gravados no sistema.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrelicaStockManager;
