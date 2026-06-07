import React, { useState } from 'react';
import type { StockItem, ProductionOrderData, Bitola, User } from '../types';
import { TrefilaBitolaOptions } from '../types';
import { WarningIcon, PencilIcon, TrashIcon, DocumentReportIcon } from './icons';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const ProductionOrderStatusBadge: React.FC<{ status: ProductionOrderData['status'] }> = ({ status }) => {
    const statusMap: Record<string, { text: string; className: string }> = {
        pending: { text: 'Pendente', className: 'bg-amber-100 text-amber-800' },
        in_progress: { text: 'Em Produção', className: 'bg-[#e6f0f5] text-[#0F3F5C]' },
        completed: { text: 'Concluída', className: 'bg-emerald-100 text-emerald-800' },
        cancelled: { text: 'Cancelada', className: 'bg-red-100 text-red-800' },
        paused: { text: 'Pausada (Arquivo)', className: 'bg-indigo-100 text-indigo-800 shadow-sm ring-1 ring-indigo-500/20' },
    };
    const { text, className } = statusMap[status] || { text: 'Desconhecido', className: 'bg-slate-100 text-slate-800' };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${className}`}>{text}</span>;
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const EditProductionOrderModal: React.FC<{
    order: ProductionOrderData;
    onClose: () => void;
    onSubmit: (orderId: string, data: { orderNumber: string; targetBitola: Bitola }) => void;
}> = ({ order, onClose, onSubmit }) => {
    const [orderNumber, setOrderNumber] = useState(order.orderNumber);
    const [targetBitola, setTargetBitola] = useState<Bitola>(order.targetBitola);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim()) { alert('O número da ordem é obrigatório.'); return; }
        onSubmit(order.id, { orderNumber, targetBitola });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar Ordem de Produção</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Número da Ordem</label>
                        <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Bitola a Produzir</label>
                        <select value={targetBitola} onChange={e => setTargetBitola(e.target.value as Bitola)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white">
                            {TrefilaBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-800 transition">Salvar Alterações</button>
                </div>
            </form>
        </div>
    );
};

// ─── OS Items Panel (Desbobinadeira) ─────────────────────────────────────────
const OSItemsPanel: React.FC<{ order: ProductionOrderData }> = ({ order }) => {
    const osItems: any[] =
        (order as any).os_items ||
        (order as any).osItems ||
        (order as any).summary?.items ||
        [];

    if (osItems.length === 0) {
        return (
            <div className="py-6 text-center text-slate-400 text-sm font-semibold">
                Nenhuma OS / ferro encontrado nesta ordem.
            </div>
        );
    }

    const totalQty = osItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
    const totalWeight = osItems.reduce((s: number, i: any) => s + (Number(i.weight) || 0), 0);
    const totalMeters = osItems.reduce((s: number, i: any) => {
        return s + ((Number(i.quantity) || 0) * (Number(i.length) || 0)) / 100;
    }, 0);

    return (
        <div className="space-y-3">
            {/* Summary chips */}
            <div className="flex flex-wrap gap-3 mb-2">
                <div className="bg-[#0F3F5C]/10 text-[#0F3F5C] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    📋 {osItems.length} OS
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    🔢 {totalQty} cortes
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    ⚖️ {totalWeight.toFixed(2).replace('.', ',')} kg
                </div>
                <div className="bg-violet-50 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    📏 {totalMeters.toFixed(1).replace('.', ',')} m
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="min-w-full text-xs">
                    <thead className="bg-slate-100 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                            <th className="px-3 py-2 text-left">OS</th>
                            <th className="px-3 py-2 text-left">Bitola (mm)</th>
                            <th className="px-3 py-2 text-left">Aço</th>
                            <th className="px-3 py-2 text-right">Tamanho (cm)</th>
                            <th className="px-3 py-2 text-right">Qtd (Cortes)</th>
                            <th className="px-3 py-2 text-left">Formato</th>
                            <th className="px-3 py-2 text-right">Peso (kg)</th>
                            <th className="px-3 py-2 text-right">Metros</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {osItems.map((item: any, idx: number) => {
                            const qty = Number(item.quantity) || 0;
                            const len = Number(item.length) || 0;
                            const meters = (qty * len) / 100;
                            return (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                    <td className="px-3 py-2 font-black text-slate-800">{item.os || `OS ${idx + 1}`}</td>
                                    <td className="px-3 py-2">
                                        <span className="bg-[#0F3F5C]/10 text-[#0F3F5C] px-2 py-0.5 rounded-md font-bold">
                                            {item.bitola || '—'} mm
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{item.steelType || '—'}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-700">{len > 0 ? len.toFixed(0) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-bold text-blue-700">{qty}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                            item.drawingType === 'Estribo' ? 'bg-amber-100 text-amber-700' :
                                            item.drawingType === 'Gancho' ? 'bg-violet-100 text-violet-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {item.drawingType || 'Reto'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                        {(Number(item.weight) || 0).toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-500 font-medium">
                                        {meters > 0 ? meters.toFixed(1).replace('.', ',') + ' m' : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
                        <tr>
                            <td colSpan={4} className="px-3 py-2 text-slate-500 uppercase text-[10px]">Totais</td>
                            <td className="px-3 py-2 text-right text-blue-700">{totalQty}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-right text-emerald-700">{totalWeight.toFixed(2).replace('.', ',')}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{totalMeters.toFixed(1).replace('.', ',')} m</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ─── Stock Lots Panel (Trefila / Treliça) ────────────────────────────────────
const StockLotsPanel: React.FC<{ order: ProductionOrderData; stock: StockItem[] }> = ({ order, stock }) => (
    <div className="overflow-x-auto border rounded-md bg-white">
        <table className="min-w-full text-xs">
            <thead className="bg-slate-100">
                <tr>
                    <th className="p-2 text-left font-semibold">Componente</th>
                    <th className="p-2 text-left font-semibold">Lote Interno</th>
                    <th className="p-2 text-left font-semibold">Tipo de Material</th>
                    <th className="p-2 text-left font-semibold">Bitola</th>
                    <th className="p-2 text-right font-semibold">Peso (kg)</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {(() => {
                    if (Array.isArray(order.selectedLotIds)) {
                        return order.selectedLotIds.map((lotId: string, index: number) => {
                            const lot = stock.find(s => s.id === lotId);
                            return (
                                <tr key={index}>
                                    <td className="p-2 font-medium text-slate-400">Lote #{index + 1}</td>
                                    <td className="p-2 font-bold">{lot?.internalLot || 'N/A'}</td>
                                    <td className="p-2">{lot?.materialType || 'N/A'}</td>
                                    <td className="p-2 font-mono">{lot?.bitola || 'N/A'}</td>
                                    <td className="p-2 text-right font-bold text-slate-700">{lot?.labelWeight?.toFixed(2) ?? 'N/A'}</td>
                                </tr>
                            );
                        });
                    }
                    const lots = order.selectedLotIds as any;
                    const rows: React.ReactNode[] = [];
                    const processGroup = (ids: any, label: string) => {
                        if (!ids) return;
                        const arr = Array.isArray(ids) ? ids : [ids];
                        arr.forEach((id: string, idx: number) => {
                            const lot = stock.find(s => s.id === id);
                            rows.push(
                                <tr key={`${label}-${idx}`}>
                                    <td className="p-2 font-black text-indigo-600/70 uppercase text-[10px]">{label} {arr.length > 1 ? `#${idx + 1}` : ''}</td>
                                    <td className="p-2 font-bold">{lot?.internalLot || 'N/A'}</td>
                                    <td className="p-2 text-slate-500">{lot?.materialType || 'N/A'}</td>
                                    <td className="p-2 font-mono font-bold">{lot?.bitola || 'N/A'}</td>
                                    <td className="p-2 text-right font-bold text-slate-800">{lot?.labelWeight?.toFixed(2) ?? 'N/A'}</td>
                                </tr>
                            );
                        });
                    };
                    processGroup(lots.allSuperior || lots.superior, 'Superior');
                    processGroup(lots.allInferiorLeft || lots.inferior1, 'Inferior Esq.');
                    processGroup(lots.allInferiorRight || lots.inferior2, 'Inferior Dir.');
                    processGroup(lots.allSenozoideLeft || lots.senozoide1, 'Senozoide Esq.');
                    processGroup(lots.allSenozoideRight || lots.senozoide2, 'Senozoide Dir.');
                    return rows;
                })()}
            </tbody>
        </table>
    </div>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
const ProductionOrderHistoryModal: React.FC<{
    orders: ProductionOrderData[];
    stock: StockItem[];
    onClose: () => void;
    updateProductionOrder: (orderId: string, data: { orderNumber?: string; targetBitola?: Bitola }) => void;
    deleteProductionOrder: (orderId: string) => void;
    onShowReport: (order: ProductionOrderData) => void;
    currentUser: User | null;
}> = ({ orders, stock, onClose, updateProductionOrder, deleteProductionOrder, onShowReport, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const isDesb = (o: ProductionOrderData) => o.machine?.startsWith('Desbobinadeira');

    // Auto-expand all Desbobinadeira orders on open
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        orders.forEach(o => { if (isDesb(o)) initial.add(o.id); });
        return initial;
    });
    const [editingOrder, setEditingOrder] = useState<ProductionOrderData | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<ProductionOrderData | null>(null);

    const toggleExpand = (id: string) => setExpandedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const getBitolaLabel = (order: ProductionOrderData) => {
        if (order.machine === 'Treliça' && order.trelicaModel)
            return `${order.trelicaModel} (${order.quantityToProduce || 'N/A'} pçs)`;
        if (isDesb(order)) {
            const items: any[] = (order as any).os_items || (order as any).osItems || (order as any).summary?.items || [];
            if (items.length === 0) return 'N/A';
            const bitolas = [...new Set(items.map((i: any) => i.bitola).filter(Boolean))];
            return bitolas.length > 0 ? bitolas.join(', ') + ' mm' : 'N/A';
        }
        return order.targetBitola;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">

                {/* Edit modal */}
                {editingOrder && (
                    <EditProductionOrderModal
                        order={editingOrder}
                        onClose={() => setEditingOrder(null)}
                        onSubmit={updateProductionOrder}
                    />
                )}

                {/* Delete confirm */}
                {deletingOrder && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                            <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                            <p className="text-lg text-slate-700 mb-6 flex flex-col gap-2">
                                <span>Tem certeza que deseja {deletingOrder.status === 'in_progress' ? 'INTERROMPER e EXCLUIR' : 'excluir'} a ordem <strong>{deletingOrder.orderNumber}</strong>?</span>
                                <span className="text-sm text-slate-500">
                                    {deletingOrder.status === 'in_progress'
                                        ? 'A produção será interrompida imediatamente e os lotes retornarão ao estoque.'
                                        : 'Os lotes associados retornarão ao estoque.'}
                                </span>
                            </p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setDeletingOrder(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                                <button
                                    onClick={() => { deleteProductionOrder(deletingOrder.id); setDeletingOrder(null); }}
                                    className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition"
                                >Confirmar Exclusão</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Ordens de Produção</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                </div>

                {/* Table */}
                <div className="flex-grow overflow-y-auto pr-2">
                    {orders.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Nº Ordem</th>
                                    <th className="p-3 font-semibold text-slate-600">Máquina</th>
                                    <th className="p-3 font-semibold text-slate-600">Produto / Bitola</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Peso MP (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Peso Planejado (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Status</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.map(order => (
                                    <React.Fragment key={order.id}>
                                        <tr className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(order.creationDate).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-3 font-medium">{order.orderNumber}</td>
                                            <td className="p-3">{order.machine}</td>
                                            <td className="p-3 font-semibold">{getBitolaLabel(order)}</td>
                                            <td className="p-3 text-right font-medium">{order.totalWeight?.toFixed(2) ?? '—'}</td>
                                            <td className="p-3 text-right font-bold text-slate-700">{order.plannedOutputWeight?.toFixed(2) ?? '-'}</td>
                                            <td className="p-3 text-center">
                                                <ProductionOrderStatusBadge status={order.status} />
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center items-center gap-2 flex-wrap">
                                                    {/* Expand button */}
                                                    <button
                                                        onClick={() => toggleExpand(order.id)}
                                                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition ${
                                                            isDesb(order)
                                                                ? 'bg-[#0F3F5C]/10 text-[#0F3F5C] hover:bg-[#0F3F5C]/20'
                                                                : 'text-slate-600 hover:underline'
                                                        }`}
                                                    >
                                                        {expandedIds.has(order.id)
                                                            ? (isDesb(order) ? '▲ Fechar OS' : 'Ocultar Lotes')
                                                            : (isDesb(order) ? '📋 Ver OS / Ferros' : 'Ver Lotes')}
                                                    </button>

                                                    {/* Gestor actions */}
                                                    {isGestor && (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingOrder(order)}
                                                                disabled={order.status !== 'pending' || order.machine !== 'Trefila'}
                                                                className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Editar Ordem"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingOrder(order)}
                                                                className="p-1 text-slate-500 hover:text-red-700"
                                                                title="Excluir Ordem"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* Report button */}
                                                    {order.status === 'completed' && (
                                                        <button
                                                            onClick={() => onShowReport(order)}
                                                            className="text-emerald-600 hover:underline text-xs font-semibold flex items-center gap-1"
                                                        >
                                                            <DocumentReportIcon className="h-4 w-4" />
                                                            <span>Ver Relatório</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── Expanded panel ── */}
                                        {expandedIds.has(order.id) && (
                                            <tr className="bg-slate-50/80">
                                                <td colSpan={8} className="p-5">
                                                    {isDesb(order) ? (
                                                        <>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="text-[#0F3F5C] font-black text-sm uppercase tracking-wide">
                                                                    📋 Lista de OS — {order.orderNumber}
                                                                </span>
                                                            </div>
                                                            <OSItemsPanel order={order} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <h4 className="font-semibold text-slate-700 mb-2 pl-2">
                                                                Lotes da Ordem: {order.orderNumber}
                                                            </h4>
                                                            <StockLotsPanel order={order} stock={stock} />
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-slate-500 py-10">Nenhuma ordem de produção foi criada ainda.</p>
                    )}
                </div>

                <div className="flex justify-end pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductionOrderHistoryModal;
