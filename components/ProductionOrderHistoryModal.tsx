import React, { useState } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola } from '../types';
import { TrefilaBitolaOptions, FioMaquinaBitolaOptions } from '../types';
import { ArrowLeftIcon, WarningIcon, ClipboardListIcon, PencilIcon, TrashIcon, DocumentReportIcon } from './icons';

interface ProductionOrderStatusBadgeProps {
    status: ProductionOrderData['status'];
}

const ProductionOrderStatusBadge: React.FC<ProductionOrderStatusBadgeProps> = ({ status }) => {
    const statusMap = {
        pending: { text: 'Pendente', className: 'bg-amber-100 text-amber-800' },
        in_progress: { text: 'Em Produção', className: 'bg-[#e6f0f5] text-[#0F3F5C]' },
        completed: { text: 'Concluída', className: 'bg-emerald-100 text-emerald-800' },
    };
    const { text, className } = statusMap[status] || { text: 'Desconhecido', className: 'bg-slate-100 text-slate-800' };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${className}`}>{text}</span>;
};

const EditProductionOrderModal: React.FC<{
    order: ProductionOrderData;
    onClose: () => void;
    onSubmit: (orderId: string, data: { orderNumber: string; targetBitola: Bitola }) => void;
}> = ({ order, onClose, onSubmit }) => {
    const [orderNumber, setOrderNumber] = useState(order.orderNumber);
    const [targetBitola, setTargetBitola] = useState<Bitola>(order.targetBitola);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim()) {
            alert('O número da ordem é obrigatório.');
            return;
        }
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
                        <input
                            type="text"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Bitola a Produzir</label>
                        <select
                            value={targetBitola}
                            onChange={(e) => setTargetBitola(e.target.value as Bitola)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white"
                        >
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


const ProductionOrderHistoryModal: React.FC<{
    orders: ProductionOrderData[];
    stock: StockItem[];
    onClose: () => void;
    updateProductionOrder: (orderId: string, data: { orderNumber?: string; targetBitola?: Bitola }) => void;
    deleteProductionOrder: (orderId: string) => void;
    onShowReport: (order: ProductionOrderData) => void;
}> = ({ orders, stock, onClose, updateProductionOrder, deleteProductionOrder, onShowReport }) => {
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<ProductionOrderData | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<ProductionOrderData | null>(null);

    const toggleExpand = (orderId: string) => {
        setExpandedOrderId(prevId => (prevId === orderId ? null : orderId));
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                {editingOrder && <EditProductionOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSubmit={updateProductionOrder} />}
                {deletingOrder && (
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                            <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                            <p className="text-lg text-slate-700 mb-6">Tem certeza que deseja excluir a ordem <strong>{deletingOrder.orderNumber}</strong>? Os lotes associados retornarão ao estoque.</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setDeletingOrder(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                                <button onClick={() => { deleteProductionOrder(deletingOrder.id); setDeletingOrder(null); }} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Ordens de Produção</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {orders.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Nº Ordem</th>
                                    <th className="p-3 font-semibold text-slate-600">Máquina</th>
                                    <th className="p-3 font-semibold text-slate-600">Produto / Bitola</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Peso Matéria-Prima (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-right">Peso Produto Planejado (kg)</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Status</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.map((order) => (
                                    <React.Fragment key={order.id}>
                                        <tr className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(order.creationDate).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-3 font-medium">{order.orderNumber}</td>
                                            <td className="p-3">{order.machine}</td>
                                            <td className="p-3 font-semibold">
                                                {order.machine === 'Treliça' && order.trelicaModel
                                                    ? `${order.trelicaModel} (${order.quantityToProduce || 'N/A'} pçs)`
                                                    : order.targetBitola}
                                            </td>
                                            <td className="p-3 text-right font-medium">{order.totalWeight.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-slate-700">{order.plannedOutputWeight?.toFixed(2) ?? '-'}</td>
                                            <td className="p-3 text-center">
                                                <ProductionOrderStatusBadge status={order.status} />
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => toggleExpand(order.id)} className="text-slate-600 hover:underline text-xs font-semibold">
                                                        {expandedOrderId === order.id ? 'Ocultar Lotes' : 'Ver Lotes'}
                                                    </button>
                                                    {order.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => setEditingOrder(order)} 
                                                                disabled={order.machine !== 'Trefila'}
                                                                className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                                                                title={order.machine !== 'Trefila' ? "Edição disponível apenas para Trefila" : "Editar Ordem"}>
                                                                <PencilIcon className="h-4 w-4"/>
                                                            </button>
                                                            <button onClick={() => setDeletingOrder(order)} className="p-1 text-slate-500 hover:text-red-700" title="Excluir Ordem"><TrashIcon className="h-4 w-4"/></button>
                                                        </>
                                                    )}
                                                    {order.status === 'completed' && (
                                                        <button onClick={() => onShowReport(order)} className="text-emerald-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Ver Relatório">
                                                            <DocumentReportIcon className="h-4 w-4"/>
                                                            <span>Ver Relatório</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedOrderId === order.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={8} className="p-4">
                                                    <h4 className="font-semibold text-slate-700 mb-2 pl-2">Lotes da Ordem: {order.orderNumber}</h4>
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
                                                                {Array.isArray(order.selectedLotIds) ? (
                                                                    order.selectedLotIds.map((lotId, index) => {
                                                                        const lot = stock.find(s => s.id === lotId);
                                                                        return (
                                                                            <tr key={index}>
                                                                                <td className="p-2">-</td>
                                                                                <td className="p-2">{lot?.internalLot || 'N/A'}</td>
                                                                                <td className="p-2">{lot?.materialType || 'N/A'}</td>
                                                                                <td className="p-2">{lot?.bitola || 'N/A'}</td>
                                                                                <td className="p-2 text-right">{lot?.labelWeight.toFixed(2)}</td>
                                                                            </tr>
                                                                        )
                                                                    })
                                                                ) : (
                                                                    Object.entries(order.selectedLotIds).map(([key, lotId]) => {
                                                                        const lot = stock.find(s => s.id === lotId);
                                                                        const labelMap: Record<string, string> = { superior: 'Superior', inferior1: 'Inferior 1', inferior2: 'Inferior 2', senozoide1: 'Senozoide 1', senozoide2: 'Senozoide 2'};
                                                                        return (
                                                                            <tr key={key}>
                                                                                <td className="p-2 font-medium capitalize">{labelMap[key]}</td>
                                                                                <td className="p-2">{lot?.internalLot || 'N/A'}</td>
                                                                                <td className="p-2">{lot?.materialType || 'N/A'}</td>
                                                                                <td className="p-2">{lot?.bitola || 'N/A'}</td>
                                                                                <td className="p-2 text-right">{lot?.labelWeight.toFixed(2)}</td>
                                                                            </tr>
                                                                        )
                                                                    })
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
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
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default ProductionOrderHistoryModal;
