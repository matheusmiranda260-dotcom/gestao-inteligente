import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, PontaItem, FinishedGoodsTransferRecord } from '../types';
import { ArrowLeftIcon, ArchiveIcon, TruckIcon, PrinterIcon, TrashIcon } from './icons';
import { LogoIcon } from './Logo';

const getStatusBadge = (status: FinishedProductItem['status'] | PontaItem['status']) => {
    const styles = {
        'Disponível': 'bg-emerald-100 text-emerald-800',
        'Vendido': 'bg-slate-200 text-slate-800',
        'Transferido': 'bg-violet-100 text-violet-800',
    };
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles['Disponível']}`}>
            {status}
        </span>
    );
};

const TransferFinishedGoodsModal: React.FC<{
    itemsToTransfer: (FinishedProductItem | PontaItem)[];
    onClose: () => void;
    onSubmit: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => void;
}> = ({ itemsToTransfer, onClose, onSubmit }) => {
    const [destinationSector, setDestinationSector] = useState('CAA60');
    const [otherDestination, setOtherDestination] = useState('');
    const [quantities, setQuantities] = useState<Map<string, number>>(() => new Map(itemsToTransfer.map(item => [item.id, item.quantity])));

    const handleQuantityChange = (itemId: string, newQuantity: number, maxQuantity: number) => {
        const validatedQuantity = Math.max(0, Math.min(newQuantity, maxQuantity));
        setQuantities(prev => new Map(prev).set(itemId, validatedQuantity));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalDestination = destinationSector === 'Outros' ? otherDestination.trim() : destinationSector;
        if (!finalDestination) {
            alert('O setor de destino é obrigatório.');
            return;
        }

        const itemsWithQuantity = new Map<string, number>();
        quantities.forEach((qty, id) => {
            if (qty > 0) {
                itemsWithQuantity.set(id, qty);
            }
        });

        if (itemsWithQuantity.size === 0) {
            alert('Nenhum item com quantidade válida para transferir.');
            return;
        }

        onSubmit({ destinationSector, otherDestination: destinationSector === 'Outros' ? otherDestination : undefined, items: itemsWithQuantity });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-4">Transferir Produtos Acabados</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Setor de Destino</label>
                        <select value={destinationSector} onChange={e => setDestinationSector(e.target.value)} className="mt-1 p-2 w-full border border-slate-300 rounded bg-white">
                            <option value="CAA60">CAA60</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>
                    {destinationSector === 'Outros' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Especifique o Setor</label>
                            <input type="text" value={otherDestination} onChange={e => setOtherDestination(e.target.value)} className="mt-1 p-2 w-full border border-slate-300 rounded" required />
                        </div>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="p-2 text-left font-semibold text-slate-600">Produto</th>
                                <th className="p-2 text-left font-semibold text-slate-600">Disponível (pçs)</th>
                                <th className="p-2 text-left font-semibold text-slate-600">Qtd. a Transferir</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsToTransfer.map(item => (
                                <tr key={item.id} className="border-b">
                                    <td className="p-2">{item.model} ({item.size}m)</td>
                                    <td className="p-2">{item.quantity}</td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={quantities.get(item.id) || ''}
                                            onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 0, item.quantity)}
                                            max={item.quantity}
                                            className="w-full p-1 border border-slate-300 rounded"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D]">Confirmar Transferência</button>
                </div>
            </form>
        </div>
    );
};

const FinishedGoodsTransferReport: React.FC<{ reportData: FinishedGoodsTransferRecord; onClose: () => void; }> = ({ reportData, onClose }) => {
    const totalWeight = reportData.transferredItems.reduce((acc, item) => acc + item.totalWeight, 0);
    const totalQuantity = reportData.transferredItems.reduce((acc, item) => acc + item.transferredQuantity, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col print-modal-content">
                <div className="flex justify-between items-center mb-4 pb-4 border-b no-print">
                    <h2 className="text-2xl font-bold text-slate-800">Relatório de Transferência</h2>
                    <div>
                        <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg mr-4"><PrinterIcon className="h-5 w-5 inline mr-2" />Imprimir</button>
                        <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Fechar</button>
                    </div>
                </div>
                <div className="overflow-y-auto print-section bg-white p-4">
                    <header className="flex justify-between items-center mb-6">
                        <LogoIcon className="h-16 w-16" />
                        <div className="text-right">
                            <h1 className="text-2xl font-bold">Relatório de Transferência - Produto Acabado</h1>
                            <p className="text-slate-600">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                    </header>
                    <div className="border rounded-lg p-4 mb-6 grid grid-cols-4 gap-4 text-sm">
                        <div><strong>Nº:</strong> {reportData.id}</div>
                        <div><strong>Data:</strong> {new Date(reportData.date).toLocaleString('pt-BR')}</div>
                        <div><strong>Operador:</strong> {reportData.operator}</div>
                        <div><strong>Destino:</strong> {reportData.destinationSector === 'Outros' ? reportData.otherDestination : reportData.destinationSector}</div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="p-2 text-left">Produto</th>
                                <th className="p-2 text-left">Modelo</th>
                                <th className="p-2 text-left">Tamanho (m)</th>
                                <th className="p-2 text-right">Qtd. Transferida (pçs)</th>
                                <th className="p-2 text-right">Peso Total (kg)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {reportData.transferredItems.map(item => (
                                <tr key={item.productId}>
                                    <td className="p-2">{item.productType}</td>
                                    <td className="p-2">{item.model}</td>
                                    <td className="p-2">{item.size}</td>
                                    <td className="p-2 text-right">{item.transferredQuantity}</td>
                                    <td className="p-2 text-right font-semibold">{item.totalWeight.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold">
                            <tr>
                                <td colSpan={3} className="p-2 text-right">Totais:</td>
                                <td className="p-2 text-right">{totalQuantity} pçs</td>
                                <td className="p-2 text-right">{totalWeight.toFixed(2)} kg</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className="mt-20 pt-10 flex justify-around text-center">
                        <div className="inline-block"><div className="border-t border-slate-500 w-64"></div><p className="text-sm mt-1">Assinatura Setor Expedição</p></div>
                        <div className="inline-block"><div className="border-t border-slate-500 w-64"></div><p className="text-sm mt-1">Assinatura Setor Recebedor</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FinishedGoodsTransfersHistoryModal: React.FC<{
    transfers: FinishedGoodsTransferRecord[];
    onClose: () => void;
    onShowReport: (transfer: FinishedGoodsTransferRecord) => void;
}> = ({ transfers, onClose, onShowReport }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-4">Histórico de Transferências</h2>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left sticky top-0">
                        <tr>
                            <th className="p-3">Data</th>
                            <th className="p-3">Destino</th>
                            <th className="p-3">Operador</th>
                            <th className="p-3 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {transfers.map(t => (
                            <tr key={t.id}>
                                <td className="p-3">{new Date(t.date).toLocaleString('pt-BR')}</td>
                                <td className="p-3 font-semibold">{t.destinationSector === 'Outros' ? t.otherDestination : t.destinationSector}</td>
                                <td className="p-3">{t.operator}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => onShowReport(t)} className="text-emerald-600 hover:underline text-xs font-semibold">Ver Relatório</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end pt-4 mt-auto border-t">
                <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Fechar</button>
            </div>
        </div>
    </div>
);


interface FinishedGoodsProps {
    finishedGoods: FinishedProductItem[];
    pontasStock: PontaItem[];
    finishedGoodsTransfers: FinishedGoodsTransferRecord[];
    setPage: (page: Page) => void;
    createFinishedGoodsTransfer: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => FinishedGoodsTransferRecord | null;
    onDelete?: (ids: string[]) => void;
}

const FinishedGoods: React.FC<FinishedGoodsProps> = ({ finishedGoods, pontasStock, setPage, finishedGoodsTransfers, createFinishedGoodsTransfer, onDelete }) => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [reportData, setReportData] = useState<FinishedGoodsTransferRecord | null>(null);

    const allItems = [...finishedGoods, ...pontasStock];

    const handleSelectItem = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (items: (FinishedProductItem | PontaItem)[], tableType: 'trelica' | 'ponta') => {
        const itemIds = items.map(i => i.id);
        const allSelectedForTable = itemIds.every(id => selectedItems.has(id));

        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (allSelectedForTable) {
                itemIds.forEach(id => newSet.delete(id));
            } else {
                itemIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const handleTransferSubmit = (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => {
        const result = createFinishedGoodsTransfer(data);
        if (result) {
            setIsTransferModalOpen(false);
            setSelectedItems(new Set());
            setReportData(result);
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
            {isTransferModalOpen && (
                <TransferFinishedGoodsModal
                    itemsToTransfer={allItems.filter(item => selectedItems.has(item.id))}
                    onClose={() => setIsTransferModalOpen(false)}
                    onSubmit={handleTransferSubmit}
                />
            )}
            {reportData && <FinishedGoodsTransferReport reportData={reportData} onClose={() => setReportData(null)} />}
            {isHistoryOpen && <FinishedGoodsTransfersHistoryModal transfers={finishedGoodsTransfers} onClose={() => setIsHistoryOpen(false)} onShowReport={setReportData} />}

            <header className="flex items-center justify-between pt-4">
                <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-slate-800">Estoque de Produto Acabado (Treliças)</h1>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setIsHistoryOpen(true)} className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg border border-slate-300">
                        Histórico de Transferências
                    </button>
                    <button onClick={() => setIsTransferModalOpen(true)} disabled={selectedItems.size === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400 flex items-center gap-2">
                        <TruckIcon className="h-5 w-5" /> Transferir ({selectedItems.size})
                    </button>
                    {onDelete && (
                        <button
                            onClick={() => {
                                onDelete(Array.from(selectedItems));
                                setSelectedItems(new Set());
                            }}
                            disabled={selectedItems.size === 0}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400 flex items-center gap-2"
                        >
                            <TrashIcon className="h-5 w-5" /> Excluir ({selectedItems.size})
                        </button>
                    )}
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold text-slate-700">Treliças em Estoque (Tamanho Padrão)</h2>
                    <p className="text-sm text-slate-500">Exibindo {finishedGoods.length} registros.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-600 uppercase bg-slate-50">
                            <tr>
                                <th className="p-4 w-12"><input type="checkbox" onChange={() => handleSelectAll(finishedGoods, 'trelica')} className="h-4 w-4 rounded" /></th>
                                <th className="px-6 py-3">Data Produção</th>
                                <th className="px-6 py-3">Nº Ordem</th>
                                <th className="px-6 py-3">Modelo</th>
                                <th className="px-6 py-3">Tamanho (m)</th>
                                <th className="px-6 py-3 text-right">Quantidade (pçs)</th>
                                <th className="px-6 py-3 text-right">Peso Total (kg)</th>
                                <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {finishedGoods.map(item => (
                                <tr key={item.id} className="bg-white hover:bg-slate-50">
                                    <td className="p-4"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectItem(item.id)} className="h-4 w-4 rounded" /></td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(item.productionDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{item.orderNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.size}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-900 whitespace-nowrap">{item.quantity}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">{item.totalWeight.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {finishedGoods.length === 0 && (
                        <div className="text-center text-slate-500 py-16">
                            <ArchiveIcon className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                            <p className="font-semibold">Estoque de treliças padrão vazio.</p>
                            <p className="text-sm">Finalize uma ordem de produção para adicionar itens ao estoque.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold text-slate-700">Estoque de Pontas de Treliça (Para Revenda)</h2>
                    <p className="text-sm text-slate-500">Exibindo {pontasStock.length} registros.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-600 uppercase bg-slate-50">
                            <tr>
                                <th className="p-4 w-12"><input type="checkbox" onChange={() => handleSelectAll(pontasStock, 'ponta')} className="h-4 w-4 rounded" /></th>
                                <th className="px-6 py-3">Data Produção</th>
                                <th className="px-6 py-3">Nº Ordem Origem</th>
                                <th className="px-6 py-3">Modelo</th>
                                <th className="px-6 py-3">Tamanho (m)</th>
                                <th className="px-6 py-3 text-right">Quantidade (pçs)</th>
                                <th className="px-6 py-3 text-right">Peso Total (kg)</th>
                                <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {pontasStock.filter(i => i.quantity > 0).map(item => (
                                <tr key={item.id} className="bg-white hover:bg-slate-50">
                                    <td className="p-4"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectItem(item.id)} className="h-4 w-4 rounded" /></td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(item.productionDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{item.orderNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{item.size}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-900 whitespace-nowrap">{item.quantity}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">{item.totalWeight.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {pontasStock.filter(i => i.quantity > 0).length === 0 && (
                        <div className="text-center text-slate-500 py-16">
                            <ArchiveIcon className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                            <p className="font-semibold">Nenhuma ponta em estoque.</p>
                            <p className="text-sm">Registre pontas ao finalizar uma ordem de produção de treliça.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinishedGoods;