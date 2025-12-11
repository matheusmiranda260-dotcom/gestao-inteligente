
import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ConferenceData, ConferenceLotData, Bitola, MaterialType, TransferRecord } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon, BookOpenIcon, TruckIcon, DocumentReportIcon, PrinterIcon, LockOpenIcon, ClipboardListIcon, ChartBarIcon, XCircleIcon } from './icons';
import LotHistoryModal from './LotHistoryModal';
import FinishedConferencesModal from './FinishedConferencesModal';
import ConferenceReport from './ConferenceReport';
import TransfersHistoryModal from './TransfersHistoryModal';
import TransferReport from './TransferReport';
import InventoryReport from './InventoryReport';
import StockDashboard from './StockDashboard';

const getStatusBadge = (status: StockItem['status']) => {
    const styles = {
        'Disponível': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'Em Produção': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        'Em Produção - Treliça': 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
        'Transferido': 'bg-slate-700/30 text-slate-400 border border-slate-600/30',
        'Disponível - Suporte Treliça': 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    };
    return (
        <span className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm backdrop-blur-sm ${styles[status] || styles['Transferido']}`}>
            {status}
        </span>
    );
};

const AddConferenceModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: ConferenceData) => void;
    stock: StockItem[];
    onShowReport: (data: ConferenceData) => void;
}> = ({ onClose, onSubmit, stock, onShowReport }) => {
    const [conferenceData, setConferenceData] = useState<Omit<ConferenceData, 'lots'>>({
        entryDate: new Date().toISOString().split('T')[0],
        supplier: '',
        nfe: '',
        conferenceNumber: '',
    });
    const [lots, setLots] = useState<Partial<ConferenceLotData>[]>([{ internalLot: '', supplierLot: '', runNumber: '', bitola: FioMaquinaBitolaOptions[0], materialType: 'Fio Máquina', labelWeight: 0, scaleWeight: 0 }]);
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});

    const allBitolaOptions: Bitola[] = [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])] as Bitola[];

    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStockLots = new Set(stock.map(item => `${item.internalLot.trim().toLowerCase()}|${item.supplierLot.trim().toLowerCase()}`));
        const currentConferenceLots = new Set();

        lots.forEach((lot, index) => {
            if (!lot.internalLot || !lot.supplierLot) return;
            const key = `${lot.internalLot.trim().toLowerCase()}|${lot.supplierLot.trim().toLowerCase()}`;

            if (existingStockLots.has(key)) {
                newErrors[index] = "Combinação de lote já existe no estoque.";
            } else if (currentConferenceLots.has(key)) {
                newErrors[index] = "Lote duplicado nesta conferência.";
            }
            currentConferenceLots.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [lots, stock]);

    const handleAddLot = () => {
        setLots([...lots, { internalLot: '', supplierLot: '', runNumber: '', bitola: FioMaquinaBitolaOptions[0], materialType: 'Fio Máquina', labelWeight: 0, scaleWeight: 0 }]);
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: string | number) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;
        setLots(newLots);
    };

    const handleRemoveLot = (index: number) => {
        const newLots = lots.filter((_, i) => i !== index);
        setLots(newLots);
    };

    const handleFinalSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (Object.keys(duplicateErrors).length > 0) {
            alert('Corrija os lotes duplicados antes de continuar.');
            return;
        }

        const completedLots = lots.filter(
            (lot): lot is ConferenceLotData =>
                !!lot.internalLot && !!lot.supplierLot && !!lot.runNumber && !!lot.bitola && !!lot.materialType && lot.labelWeight! > 0 && lot.scaleWeight! > 0
        );

        if (completedLots.length !== lots.length || completedLots.length === 0) {
            alert('Por favor, preencha todos os campos de todos os lotes e adicione ao menos um lote.');
            return;
        }

        const finalData: ConferenceData = { ...conferenceData, lots: completedLots };
        onSubmit(finalData);
        onShowReport(finalData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleFinalSubmit} className="bg-[#0F172A] p-6 rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-4 border-b pb-4">Adicionar Nova Conferência</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-800/50 rounded-lg border">
                    <div><label className="text-sm font-medium">Data Entrada</label><input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-2 border border-slate-700 rounded" required /></div>
                    <div><label className="text-sm font-medium">Fornecedor</label><input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} className="w-full p-2 border border-slate-700 rounded" required /></div>
                    <div><label className="text-sm font-medium">Nota Fiscal (NFe)</label><input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} className="w-full p-2 border border-slate-700 rounded" required /></div>
                    <div><label className="text-sm font-medium">Nº Conferência</label><input type="text" value={conferenceData.conferenceNumber} onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} className="w-full p-2 border border-slate-700 rounded" required /></div>
                </div>
                <div className="flex-grow overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-800 z-10">
                            <tr>
                                {['Lote Interno', 'Lote Fornecedor', 'Corrida', 'Tipo Material', 'Bitola', 'Peso Etiqueta (kg)', 'Peso Balança (kg)', ''].map(h => <th key={h} className="p-2 text-left font-semibold text-slate-400">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {lots.map((lot, index) => (
                                <tr key={index} className="border-b">
                                    <td className="p-2">
                                        <input type="text" value={lot.internalLot || ''} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-2 border border-slate-700 rounded" required />
                                        {duplicateErrors[index] && <p className="text-red-500 text-xs mt-1">{duplicateErrors[index]}</p>}
                                    </td>
                                    <td className="p-2"><input type="text" value={lot.supplierLot || ''} onChange={e => handleLotChange(index, 'supplierLot', e.target.value)} className="w-full p-2 border border-slate-700 rounded" required /></td>
                                    <td className="p-2"><input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-2 border border-slate-700 rounded" required /></td>
                                    <td className="p-2">
                                        <select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-2 border border-slate-700 rounded bg-[#0F172A]">
                                            {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select value={lot.bitola} onChange={e => handleLotChange(index, 'bitola', e.target.value)} className="w-full p-2 border border-slate-700 rounded bg-[#0F172A]">
                                            {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"><input type="number" step="0.01" value={lot.labelWeight || ''} onChange={e => handleLotChange(index, 'labelWeight', parseFloat(e.target.value))} className="w-full p-2 border border-slate-700 rounded" required /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={lot.scaleWeight || ''} onChange={e => handleLotChange(index, 'scaleWeight', parseFloat(e.target.value))} className="w-full p-2 border border-slate-700 rounded" required /></td>
                                    <td className="p-2 text-center"><button type="button" onClick={() => handleRemoveLot(index)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" onClick={handleAddLot} className="text-slate-400 hover:text-white font-semibold py-2 mt-2 self-start">+ Adicionar outro lote</button>

                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-white font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D] transition">Finalizar e Adicionar ao Estoque</button>
                </div>
            </form>
        </div>
    );
};

const EditStockItemModal: React.FC<{
    item: StockItem;
    onClose: () => void;
    onSubmit: (item: StockItem) => void;
}> = ({ item, onClose, onSubmit }) => {
    const [formData, setFormData] = useState(item);

    const handleChange = (field: keyof StockItem, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-[#0F172A] p-6 rounded-xl shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold text-white mb-6">Editar Lote: {item.internalLot}</h2>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={formData.supplier} onChange={e => handleChange('supplier', e.target.value)} placeholder="Fornecedor" className="p-2 border border-slate-700 rounded" />
                    <input type="text" value={formData.nfe} onChange={e => handleChange('nfe', e.target.value)} placeholder="NFe" className="p-2 border border-slate-700 rounded" />
                    <input type="number" step="0.01" value={formData.labelWeight} onChange={e => handleChange('labelWeight', parseFloat(e.target.value))} placeholder="Peso Etiqueta" className="p-2 border border-slate-700 rounded" />
                    <input type="number" step="0.01" value={formData.remainingQuantity} onChange={e => handleChange('remainingQuantity', parseFloat(e.target.value))} placeholder="Peso Restante" className="p-2 border border-slate-700 rounded" />
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onClose}>Cancelar</button>
                    <button type="submit">Salvar</button>
                </div>
            </form>
        </div>
    );
};

const MultiLotTransferModal: React.FC<{
    lots: StockItem[];
    onClose: () => void;
    onSubmit: (destinationSector: string, lotsToTransfer: Map<string, number>) => void;
}> = ({ lots, onClose, onSubmit }) => {
    const [destinationSector, setDestinationSector] = useState('Coluna');
    const [quantities, setQuantities] = useState<Map<string, number>>(() => new Map(lots.map(l => [l.id, l.remainingQuantity])));

    const handleQuantityChange = (lotId: string, quantity: number) => {
        const newQuantities = new Map(quantities);
        newQuantities.set(lotId, quantity);
        setQuantities(newQuantities);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const lotsToTransfer = new Map<string, number>();
        let hasError = false;
        lots.forEach(lot => {
            const qty = quantities.get(lot.id) ?? 0;
            if (qty > 0 && qty <= lot.remainingQuantity) {
                lotsToTransfer.set(lot.id, qty);
            } else if (qty > lot.remainingQuantity) {
                hasError = true;
            }
        });

        if (hasError) {
            alert('Uma ou mais quantidades a transferir são maiores que o estoque restante.');
            return;
        }
        if (lotsToTransfer.size === 0) {
            alert('Nenhum lote com quantidade válida para transferir.');
            return;
        }
        onSubmit(destinationSector, lotsToTransfer);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-[#0F172A] p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-4">Realizar Transferência de Material</h2>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-200">Setor de Destino</label>
                    <select value={destinationSector} onChange={e => setDestinationSector(e.target.value)} className="mt-1 p-2 w-full border border-slate-700 rounded bg-[#0F172A]">
                        <option value="Coluna">Coluna</option>
                        <option value="CA50">CA50</option>
                        <option value="Mediterranea">Mediterranea</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
                <div className="flex-grow overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-800/50 sticky top-0">
                            <tr >
                                <th className="p-2 text-left font-semibold text-slate-400">Lote Interno</th>
                                <th className="p-2 text-left font-semibold text-slate-400">Restante (kg)</th>
                                <th className="p-2 text-left font-semibold text-slate-400">Qtd. a Transferir (kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lots.map(lot => (
                                <tr key={lot.id} className="border-b">
                                    <td className="p-2">{lot.internalLot}</td>
                                    <td className="p-2">{lot.remainingQuantity.toFixed(2)}</td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={quantities.get(lot.id) || ''}
                                            onChange={e => handleQuantityChange(lot.id, parseFloat(e.target.value) || 0)}
                                            max={lot.remainingQuantity}
                                            className="w-full p-1 border border-slate-700 rounded"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-white font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D]">Confirmar Transferência</button>
                </div>
            </form>
        </div>
    );
};

const StockControl: React.FC<{
    stock: StockItem[];
    conferences: ConferenceData[];
    transfers: TransferRecord[];
    setPage: (page: Page) => void;
    addConference: (data: ConferenceData) => void;
    deleteStockItem: (id: string) => void;
    updateStockItem: (updatedItem: StockItem) => void;
    createTransfer: (destinationSector: string, lotsToTransfer: Map<string, number>) => TransferRecord | null;
    editConference: (conferenceNumber: string, updatedData: ConferenceData) => void;
    deleteConference: (conferenceNumber: string) => void;
}> = ({ stock, conferences, transfers, setPage, addConference, deleteStockItem, updateStockItem, createTransfer, editConference, deleteConference }) => {
    const [isAddConferenceModalOpen, setIsAddConferenceModalOpen] = useState(false);
    const [isMultiLotTransferModalOpen, setIsMultiLotTransferModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
    const [releasingItem, setReleasingItem] = useState<StockItem | null>(null);
    const [historyLot, setHistoryLot] = useState<StockItem | null>(null);
    const [conferenceHistoryOpen, setConferenceHistoryOpen] = useState(false);
    const [conferenceReportData, setConferenceReportData] = useState<ConferenceData | null>(null);
    const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
    const [transferReportData, setTransferReportData] = useState<TransferRecord | null>(null);
    const [showInventoryReport, setShowInventoryReport] = useState(false);
    const [stockDashboardOpen, setStockDashboardOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [materialFilter, setMaterialFilter] = useState('');
    const [bitolaFilter, setBitolaFilter] = useState('');
    const [selectedLotIdsForTransfer, setSelectedLotIdsForTransfer] = useState<string[]>([]);

    const allBitolaOptions = useMemo(() => [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort(), []);

    const filteredStock = useMemo(() => {
        return stock
            .filter(item => {
                const term = searchTerm.toLowerCase();
                return (
                    item.internalLot.toLowerCase().includes(term) ||
                    item.supplierLot.toLowerCase().includes(term) ||
                    item.supplier.toLowerCase().includes(term) ||
                    item.nfe.toLowerCase().includes(term)
                );
            })
            .filter(item => statusFilter === '' || item.status === statusFilter)
            .filter(item => materialFilter === '' || item.materialType === materialFilter)
            .filter(item => bitolaFilter === '' || item.bitola === bitolaFilter)
            .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    }, [stock, searchTerm, statusFilter, materialFilter, bitolaFilter]);



    const handleAddConferenceSubmit = (data: ConferenceData) => {
        addConference(data);
    };

    const handleTransferSubmit = (destinationSector: string, lotsToTransfer: Map<string, number>) => {
        const result = createTransfer(destinationSector, lotsToTransfer);
        if (result) {
            setIsMultiLotTransferModalOpen(false);
            setSelectedLotIdsForTransfer([]);
            setTransferReportData(result);
        }
    };

    const handleSelectAllForTransfer = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const availableToSelect = filteredStock.filter(item => item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça').map(item => item.id);
            setSelectedLotIdsForTransfer(availableToSelect);
        } else {
            setSelectedLotIdsForTransfer([]);
        }
    };

    const handleSelectLotForTransfer = (lotId: string) => {
        const lotIndex = filteredStock.findIndex(item => item.id === lotId);
        if (lotIndex === -1) return;

        const isCurrentlySelected = selectedLotIdsForTransfer.includes(lotId);
        let newSelectedIds: string[] = [];

        if (!isCurrentlySelected) {
            const transferableLots = filteredStock.filter(item => item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça');
            const targetLotInTransferableIndex = transferableLots.findIndex(item => item.id === lotId);

            if (targetLotInTransferableIndex !== -1) {
                const lotsToSelect = transferableLots.slice(0, targetLotInTransferableIndex + 1).map(item => item.id);
                newSelectedIds = [...new Set([...selectedLotIdsForTransfer, ...lotsToSelect])];
            } else {
                newSelectedIds = [...selectedLotIdsForTransfer, lotId];
            }

        } else {
            const transferableLots = filteredStock.filter(item => item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça');
            const targetLotInTransferableIndex = transferableLots.findIndex(item => item.id === lotId);

            if (targetLotInTransferableIndex !== -1) {
                const lotsToKeep = transferableLots.slice(0, targetLotInTransferableIndex).map(item => item.id);
                newSelectedIds = lotsToKeep;
            } else {
                newSelectedIds = selectedLotIdsForTransfer.filter(id => id !== lotId);
            }
        }

        setSelectedLotIdsForTransfer(newSelectedIds);
    };

    const handleDelete = () => {
        if (deletingItem) {
            deleteStockItem(deletingItem.id);
            setDeletingItem(null);
        }
    };

    const handleRelease = () => {
        if (releasingItem) {
            const updatedItem: StockItem = {
                ...releasingItem,
                status: 'Disponível',
                productionOrderIds: []
            };
            updatedItem.history = [...(releasingItem.history || []), {
                type: 'Liberação Manual',
                date: new Date().toISOString(),
                details: {
                    action: 'Status alterado manualmente para Disponível',
                    reason: 'Solicitação do usuário (Correção)'
                }
            }];

            updateStockItem(updatedItem);
            setReleasingItem(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
            {isAddConferenceModalOpen && <AddConferenceModal onClose={() => setIsAddConferenceModalOpen(false)} onSubmit={handleAddConferenceSubmit} stock={stock} onShowReport={setConferenceReportData} />}
            {editingItem && <EditStockItemModal item={editingItem} onClose={() => setEditingItem(null)} onSubmit={updateStockItem} />}
            {isMultiLotTransferModalOpen && <MultiLotTransferModal lots={stock.filter(s => selectedLotIdsForTransfer.includes(s.id))} onClose={() => setIsMultiLotTransferModalOpen(false)} onSubmit={handleTransferSubmit} />}
            {historyLot && <LotHistoryModal lot={historyLot} onClose={() => setHistoryLot(null)} />}
            {conferenceHistoryOpen && <FinishedConferencesModal conferences={conferences} stock={stock} onClose={() => setConferenceHistoryOpen(false)} onShowReport={setConferenceReportData} onEditConference={editConference} onDeleteConference={deleteConference} />}
            {conferenceReportData && <ConferenceReport reportData={conferenceReportData} onClose={() => setConferenceReportData(null)} />}
            {transferHistoryOpen && <TransfersHistoryModal transfers={transfers} onClose={() => setTransferHistoryOpen(false)} onShowReport={setTransferReportData} />}
            {transferReportData && <TransferReport reportData={transferReportData} onClose={() => setTransferReportData(null)} />}
            {showInventoryReport && <InventoryReport stock={stock} filters={{ searchTerm, statusFilter, materialFilter, bitolaFilter }} onClose={() => setShowInventoryReport(false)} />}
            {deletingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[#0F172A] p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                        <p className="text-lg text-slate-200 mb-6">Tem certeza que deseja excluir o lote <strong>{deletingItem.internalLot}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeletingItem(null)} className="bg-slate-200 hover:bg-slate-300 text-white font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleDelete} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}
            {releasingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[#0F172A] p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                        <p className="text-lg text-slate-200 mb-2">Liberar Lote Manualmente?</p>
                        <p className="text-sm text-slate-500 mb-6">
                            O lote <strong>{releasingItem.internalLot}</strong> está com status <strong>{releasingItem.status}</strong>.
                            Deseja forçar o status para <strong>Disponível</strong>?
                            <br /><br />
                            <span className="text-xs text-red-500">Cuidado: Use isso apenas se o lote estiver travado incorretamente.</span>
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setReleasingItem(null)} className="bg-slate-200 hover:bg-slate-300 text-white font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleRelease} className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 transition">Confirmar Liberação</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex items-center">
                <button onClick={() => setPage('menu')} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition">
                    <ArrowLeftIcon className="h-6 w-6 text-slate-200" />
                </button>
                <h1 className="text-3xl font-bold text-white">Controle de Estoque</h1>
            </header>

            <div className="bg-[#0F172A] p-6 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div>
                    <button onClick={() => setIsAddConferenceModalOpen(true)} className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg transition text-base">
                        + Adicionar Conferência
                    </button>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setStockDashboardOpen(true)} className="bg-[#0F172A] hover:bg-slate-800/50 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-700 transition flex items-center gap-2">
                        <ChartBarIcon className="h-5 w-5" />Estatística
                    </button>
                    <button onClick={() => setShowInventoryReport(true)} className="bg-[#0F172A] hover:bg-slate-800/50 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-700 transition flex items-center gap-2">
                        <PrinterIcon className="h-5 w-5" />Imprimir Inventário
                    </button>
                    <button onClick={() => setConferenceHistoryOpen(true)} className="bg-[#0F172A] hover:bg-slate-800/50 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-700 transition flex items-center gap-2">
                        <DocumentReportIcon className="h-5 w-5" />Conferências Finalizadas
                    </button>
                    <button onClick={() => setTransferHistoryOpen(true)} className="bg-[#0F172A] hover:bg-slate-800/50 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-700 transition flex items-center gap-2">
                        <TruckIcon className="h-5 w-5" />Transferências Feitas
                    </button>
                </div>
            </div>

            {stockDashboardOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0F172A] p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto flex flex-col relative">
                        <button onClick={() => setStockDashboardOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-200">
                            <XCircleIcon className="h-8 w-8" />
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-6">Estatísticas do Estoque</h2>
                        <StockDashboard stock={stock} />
                    </div>
                </div>
            )}

            <div className="bg-[#0F172A] p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Filtros de Busca</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="text" placeholder="Buscar por lote, fornecedor, NFe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border border-slate-700 rounded-md md:col-span-2 text-white" />
                    <select value={bitolaFilter} onChange={e => setBitolaFilter(e.target.value)} className="p-2 border border-slate-700 rounded-md bg-[#0F172A] text-white">
                        <option value="">Todas as Bitolas</option>
                        {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-slate-700 rounded-md bg-[#0F172A] text-white">
                        <option value="">Todos os Status</option>
                        <option value="Disponível">Disponível</option>
                        <option value="Disponível - Suporte Treliça">Disponível - Suporte Treliça</option>
                        <option value="Em Produção">Em Produção</option>
                        <option value="Em Produção - Treliça">Em Produção - Treliça</option>
                        <option value="Transferido">Transferido</option>
                    </select>
                </div>
            </div>



            <div className="bg-[#0F172A] rounded-xl shadow-sm">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-200">Lotes em Estoque</h2>
                        <p className="text-sm text-slate-500">Exibindo {filteredStock.length} de {stock.length} lotes.</p>
                    </div>
                    <button
                        onClick={() => setIsMultiLotTransferModalOpen(true)}
                        disabled={selectedLotIdsForTransfer.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        <TruckIcon className="h-5 w-5" />Transferir Selecionados ({selectedLotIdsForTransfer.length})
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                            <tr>
                                <th className="p-4 w-12"><input type="checkbox" onChange={handleSelectAllForTransfer} checked={filteredStock.length > 0 && selectedLotIdsForTransfer.length === filteredStock.filter(i => i.status === 'Disponível' || i.status === 'Disponível - Suporte Treliça').length} className="h-4 w-4 rounded border-slate-700 text-slate-400 focus:ring-slate-500" /></th>
                                <th className="px-6 py-3">Data Entrada</th>
                                <th className="px-6 py-3">Lote Interno</th>
                                <th className="px-6 py-3">Lote Fornecedor</th>
                                <th className="px-6 py-3">Fornecedor</th>
                                <th className="px-6 py-3">Tipo de Material</th>
                                <th className="px-6 py-3">Bitola</th>
                                <th className="px-6 py-3 text-right">Peso Etiqueta (kg)</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredStock.map(item => (
                                <tr key={item.id} className="bg-[#0F172A] hover:bg-slate-800/50">
                                    <td className="p-4">
                                        <input type="checkbox" checked={selectedLotIdsForTransfer.includes(item.id)} onChange={() => handleSelectLotForTransfer(item.id)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="h-4 w-4 rounded border-slate-700 text-slate-400 focus:ring-slate-500" />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{item.internalLot}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.supplierLot}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.supplier}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{item.materialType}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{item.bitola}</td>
                                    <td className="px-6 py-4 text-right font-medium text-white whitespace-nowrap">
                                        {item.labelWeight.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={() => setHistoryLot(item)} className="p-1 text-slate-500 hover:text-slate-200" title="Ver Histórico"><BookOpenIcon className="h-5 w-5" /></button>
                                            <button onClick={() => setEditingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Editar Lote"><PencilIcon className="h-5 w-5" /></button>
                                            <button onClick={() => setDeletingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-1 text-slate-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Excluir Lote"><TrashIcon className="h-5 w-5" /></button>
                                            {(item.status.includes('Em Produção') || item.status === 'Disponível - Suporte Treliça') && (
                                                <button onClick={() => setReleasingItem(item)} className="p-1 text-amber-500 hover:text-amber-700" title="Liberar Lote Manualmente (Correção)">
                                                    <LockOpenIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredStock.length === 0 && (
                        <div className="text-center text-slate-500 py-16">
                            <p className="font-semibold">Nenhum item encontrado.</p>
                            <p className="text-sm">Tente ajustar os filtros ou adicione uma nova conferência.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockControl;