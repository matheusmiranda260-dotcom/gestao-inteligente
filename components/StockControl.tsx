import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowLeftIcon, CameraIcon, TrashIcon, CheckCircleIcon, DocumentReportIcon,
    AdjustmentsIcon, PencilIcon, BookOpenIcon, SearchIcon, FilterIcon, XIcon
} from './icons';
import type {
    ConferenceLotData, ConferenceData, StockItem, Bitola, MaterialType, Page, StockGauge, User, TransferRecord
} from '../types';
import {
    FioMaquinaBitolaOptions, TrefilaBitolaOptions, MaterialOptions
} from '../types';
import { extractLotDataFromImage } from '../services/geminiService';
import ConferenceReport from './ConferenceReport';
import FinishedConferencesModal from './FinishedConferencesModal';
import LotHistoryModal from './LotHistoryModal';

const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-0.5 rounded text-[10px] font-bold border";
    switch (status) {
        case 'Disponível': return <span className={`${baseClass} bg-emerald-100 text-emerald-800 border-emerald-200`}>Disponível</span>;
        case 'Disponível - Suporte Treliça': return <span className={`${baseClass} bg-blue-100 text-blue-800 border-blue-200`}>Suporte Treliça</span>;
        case 'Em Produção - Trefila': return <span className={`${baseClass} bg-amber-100 text-amber-800 border-amber-200`}>Em Prod. Trefila</span>;
        case 'Em Produção - Treliça': return <span className={`${baseClass} bg-purple-100 text-purple-800 border-purple-200`}>Em Prod. Treliça</span>;
        default: return <span className={`${baseClass} bg-slate-100 text-slate-500 border-slate-200`}>{status}</span>;
    }
};

const AddConferencePage: React.FC<{
    onClose: () => void;
    onSubmit: (data: ConferenceData) => Promise<void> | void;
    stock: StockItem[];
    onShowReport: (data: ConferenceData) => void;
    conferences: ConferenceData[];
    onEditConference: (id: string, data: ConferenceData) => void;
    onDeleteConference: (id: string) => void;
    gauges: StockGauge[];
    isGestor: boolean;
    setPage: (page: Page) => void;
}> = ({ onClose, onSubmit, stock, onShowReport, conferences, onEditConference, onDeleteConference, gauges, isGestor, setPage }) => {
    const [conferenceData, setConferenceData] = useState<Omit<ConferenceData, 'lots'>>({
        entryDate: new Date().toISOString().split('T')[0],
        supplier: '', nfe: '', conferenceNumber: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lots, setLots] = useState<Partial<ConferenceLotData>[]>([{
        internalLot: '', supplierLot: '', runNumber: '', bitola: '8.00', materialType: 'Fio Máquina', labelWeight: 0
    }]);
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [historyOpen, setHistoryOpen] = useState(false);

    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStock = new Set(stock.filter(s => s.status !== 'Consumido').map(i => `${i.internalLot.trim().toLowerCase()}|${i.supplierLot.trim().toLowerCase()}`));
        const currentBatch = new Set();
        lots.forEach((l, i) => {
            if (!l.internalLot || !l.supplierLot) return;
            const key = `${l.internalLot.trim().toLowerCase()}|${l.supplierLot.trim().toLowerCase()}`;
            if (existingStock.has(key)) newErrors[i] = "Já existe no estoque.";
            else if (currentBatch.has(key)) newErrors[i] = "Duplicado nesta lista.";
            currentBatch.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [lots, stock]);

    const handleAddLot = () => {
        const lastLot = lots[lots.length - 1];
        setLots([...lots, { ...lastLot, internalLot: '', supplierLot: '', labelWeight: 0 }]);
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: any) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;
        setLots(newLots);
    };

    const handleGlobalScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsScanning(true);
        try {
            const res = await extractLotDataFromImage(file);
            if (res.nfe || res.conferenceNumber) setConferenceData(p => ({ ...p, nfe: res.nfe || p.nfe, conferenceNumber: res.conferenceNumber || p.conferenceNumber }));
            if (res.lots?.length) {
                const mapped = res.lots.map((l: any) => ({
                    internalLot: l.internalLot || '', supplierLot: l.supplierLot || '', runNumber: String(l.runNumber || ''),
                    bitola: (l.bitola || '8.00').replace('.', ','), materialType: 'Fio Máquina' as MaterialType, labelWeight: Number(l.labelWeight) || 0
                }));
                setLots(p => (p.length === 1 && !p[0].internalLot) ? mapped : [...p, ...mapped]);
            }
        } catch (e) { alert('Erro na leitura'); } finally { setIsScanning(false); }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || Object.keys(duplicateErrors).length) return;
        const validLots = lots.filter(l => !!l.internalLot && !!l.supplierLot) as ConferenceLotData[];
        if (!validLots.length) return alert('Adicione lotes');
        setIsSubmitting(true);
        try {
            const final = { ...conferenceData, lots: validLots } as ConferenceData;
            await onSubmit(final); onShowReport(final); onClose();
        } catch (e) { setIsSubmitting(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn">
            {historyOpen && <FinishedConferencesModal conferences={conferences} stock={stock} onClose={() => setHistoryOpen(false)} onShowReport={onShowReport} onEditConference={onEditConference} onDeleteConference={onDeleteConference} />}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 flex items-center gap-2 px-4 font-bold"><ArrowLeftIcon className="h-5 w-5" /> Voltar</button>
                    <button onClick={() => setHistoryOpen(true)} className="bg-white text-slate-600 font-bold py-2 px-4 rounded-lg shadow-sm border">Histórico</button>
                </div>
                <form onSubmit={handleFinalSubmit} className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Data</label><input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-2 border rounded" required /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Fornecedor</label><input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} className="w-full p-2 border rounded" required /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">NFe</label><input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} className="w-full p-2 border rounded" required /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Nº Conf.</label><input type="text" value={conferenceData.conferenceNumber} onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} className="w-full p-2 border rounded" required /></div>
                    </div>
                    <div className="p-4 flex justify-end">
                        <input type="file" accept="image/*" capture="environment" className="hidden" id="scan-ia" onChange={handleGlobalScan} />
                        <label htmlFor="scan-ia" className="bg-[#0F3F5C] text-white px-6 py-2 rounded-lg font-bold cursor-pointer flex items-center gap-2"><CameraIcon className="h-5 w-5" /> {isScanning ? 'Lendo...' : 'Leitura IA'}</label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-y">
                                <tr>{['Lote Interno', 'Lote Fornec.', 'Corrida', 'Material', 'Bitola', 'Peso Etiqueta', ''].map(h => <th key={h} className="p-3 text-left font-bold text-slate-600 uppercase text-[10px]">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {lots.map((lot, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2"><input type="text" value={lot.internalLot || ''} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-2 border rounded" required />{duplicateErrors[index] && <p className="text-red-500 text-[9px] font-bold">{duplicateErrors[index]}</p>}</td>
                                        <td className="p-2"><input type="text" value={lot.supplierLot || ''} onChange={e => handleLotChange(index, 'supplierLot', e.target.value)} className="w-full p-2 border rounded" required /></td>
                                        <td className="p-2"><input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-2 border rounded" required /></td>
                                        <td className="p-2"><select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-2 border rounded">{MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                                        <td className="p-2"><select value={lot.bitola} onChange={e => handleLotChange(index, 'bitola', e.target.value)} className="w-full p-2 border rounded">{[...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions, ...gauges.map(g => g.gauge)])].map(b => <option key={b} value={b}>{b}</option>)}</select></td>
                                        <td className="p-2"><input type="number" step="0.01" value={lot.labelWeight || ''} onChange={e => handleLotChange(index, 'labelWeight', parseFloat(e.target.value))} className="w-full p-2 border rounded font-bold" required /></td>
                                        <td className="p-2"><button type="button" onClick={() => setLots(lots.filter((_, i) => i !== index))} className="p-2 text-red-500"><TrashIcon className="h-5 w-5" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={handleAddLot} className="w-full py-4 text-[#0F3F5C] font-bold hover:bg-slate-50 transition">+ Adicionar Peça</button>
                    </div>
                    <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="font-bold text-slate-500 px-6">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-[#0F3F5C] text-white px-10 py-3 rounded-xl font-bold">{isSubmitting ? 'Salvando...' : 'Finalizar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StockControl: React.FC<{
    stock: StockItem[]; conferences: ConferenceData[]; setPage: (p: Page) => void;
    addConference: (d: ConferenceData) => void; deleteStockItem: (id: string) => void;
    updateStockItem: (i: StockItem) => void; editConference: (id: string, d: ConferenceData) => void;
    deleteConference: (id: string) => void; gauges: StockGauge[]; currentUser: User | null;
}> = ({ stock, conferences, setPage, addConference, deleteStockItem, updateStockItem, editConference, deleteConference, gauges, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [isAdding, setIsAdding] = useState(false);
    const [reportView, setReportView] = useState<ConferenceData | null>(null);
    const [historyLot, setHistoryLot] = useState<StockItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);

    const filtered = useMemo(() => stock.filter(i =>
        i.status !== 'Consumido' && (i.internalLot.toLowerCase().includes(searchTerm.toLowerCase()) || i.nfe.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()), [stock, searchTerm]);

    if (isAdding) return <AddConferencePage onClose={() => setIsAdding(false)} onSubmit={addConference} stock={stock} onShowReport={setReportView} conferences={conferences} onEditConference={editConference} onDeleteConference={deleteConference} gauges={gauges} isGestor={isGestor} setPage={setPage} />;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {reportView && <ConferenceReport reportData={reportView} onClose={() => setReportView(null)} />}
            {historyLot && <LotHistoryModal lot={historyLot} onClose={() => setHistoryLot(null)} />}
            {editingItem && (
                <EditStockItemModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setEditingItem(null);
                    }}
                    gauges={gauges}
                />
            )}
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Estoque</h1>
                <button onClick={() => setIsAdding(true)} className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg shadow-lg">+ Novo Recebimento</button>
            </header>
            <div className="bg-white p-4 rounded-xl shadow border flex items-center gap-4">
                <SearchIcon className="h-5 w-5 text-slate-400" /><input type="text" placeholder="Buscar lote ou NFe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow outline-none" />
            </div>
            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
                            <tr>
                                <th className="p-3 text-center">Data</th>
                                <th className="p-3 text-center">Lote Interno</th>
                                <th className="p-3 text-center">Bitola</th>
                                <th className="p-3 text-center">Peso (kg)</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500 font-medium">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-center font-black text-slate-900">{item.internalLot}</td>
                                    <td className="p-3 text-center font-black text-blue-600">{item.bitola}</td>
                                    <td className="p-3 text-center font-black text-slate-800">{item.remainingQuantity.toFixed(2)}</td>
                                    <td className="p-3 text-center">{getStatusBadge(item.status)}</td>
                                    <td className="p-3 flex justify-center gap-2">
                                        <button onClick={() => setHistoryLot(item)} title="Histórico"><BookOpenIcon className="h-5 w-5 text-slate-400 hover:text-blue-500" /></button>
                                        <button onClick={() => setEditingItem(item)} title="Editar"><PencilIcon className="h-5 w-5 text-slate-400 hover:text-amber-500" /></button>
                                        <button onClick={() => confirm('Excluir?') && deleteStockItem(item.id)} title="Excluir"><TrashIcon className="h-5 w-5 text-red-400 hover:text-red-600" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const EditStockItemModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; gauges: StockGauge[] }> = ({ item, onClose, onSave, gauges }) => {
    const [formData, setFormData] = useState<StockItem>({ ...item });

    const materialGauges = useMemo(() => gauges.filter(g => g.materialType === formData.materialType).map(g => g.gauge), [gauges, formData.materialType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <h2 className="text-lg font-bold">Editar Lote: {item.internalLot}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Lote Interno</label>
                            <input type="text" value={formData.internalLot} onChange={e => setFormData({ ...formData, internalLot: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">NFe</label>
                            <input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Material</label>
                            <select value={formData.materialType} onChange={e => setFormData({ ...formData, materialType: e.target.value as any })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Fio Máquina">Fio Máquina</option>
                                <option value="CA-60">CA-60</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Bitola</label>
                            <select value={formData.bitola} onChange={e => setFormData({ ...formData, bitola: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                {materialGauges.map(g => <option key={g} value={g}>{g}</option>)}
                                {!materialGauges.includes(formData.bitola) && <option value={formData.bitola}>{formData.bitola}</option>}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Peso Atual (kg)</label>
                            <input type="number" step="0.01" value={formData.remainingQuantity} onChange={e => setFormData({ ...formData, remainingQuantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Disponível">Disponível</option>
                                <option value="Reservado">Reservado</option>
                                <option value="Em Produção">Em Produção</option>
                                <option value="Consumido">Consumido</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockControl;
