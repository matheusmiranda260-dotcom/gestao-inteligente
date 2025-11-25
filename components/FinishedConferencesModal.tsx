
import React, { useState } from 'react';
import type { ConferenceData, ConferenceLotData, StockItem, Bitola, MaterialType } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { PrinterIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

interface FinishedConferencesModalProps {
  conferences: ConferenceData[];
  stock: StockItem[];
  onClose: () => void;
  onShowReport: (conference: ConferenceData) => void;
  onEditConference: (conferenceNumber: string, updatedData: ConferenceData) => void;
  onDeleteConference: (conferenceNumber: string) => void;
}

const EditConferenceModal: React.FC<{
    conference: ConferenceData;
    stock: StockItem[];
    onClose: () => void;
    onSubmit: (updatedData: ConferenceData) => void;
}> = ({ conference, stock, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<ConferenceData>(conference);
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});

    const allBitolaOptions: Bitola[] = [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])] as Bitola[];

    React.useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStockLots = new Set(
            stock
                .filter(item => !formData.lots.some(lot =>
                    item.internalLot === lot.internalLot && item.supplierLot === lot.supplierLot && item.conferenceNumber === conference.conferenceNumber
                ))
                .map(item => `${item.internalLot.trim().toLowerCase()}|${item.supplierLot.trim().toLowerCase()}`)
        );
        const currentConferenceLots = new Set();

        formData.lots.forEach((lot, index) => {
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
    }, [formData.lots, stock, conference.conferenceNumber]);

    const handleAddLot = () => {
        setFormData(prev => ({
            ...prev,
            lots: [...prev.lots, { internalLot: '', supplierLot: '', runNumber: '', bitola: FioMaquinaBitolaOptions[0], materialType: 'Fio Máquina', labelWeight: 0, scaleWeight: 0 }]
        }));
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: string | number) => {
        setFormData(prev => {
            const newLots = [...prev.lots];
            (newLots[index] as any)[field] = value;
            return { ...prev, lots: newLots };
        });
    };

    const handleRemoveLot = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lots: prev.lots.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (Object.keys(duplicateErrors).length > 0) {
            alert('Corrija os lotes duplicados antes de continuar.');
            return;
        }

        if (formData.lots.length === 0) {
            alert('A conferência deve ter pelo menos um lote.');
            return;
        }

        onSubmit(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-4">Editar Conferência: {conference.conferenceNumber}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border">
                    <div><label className="text-sm font-medium">Data Entrada</label><input type="date" value={formData.entryDate} onChange={e => setFormData({ ...formData, entryDate: e.target.value })} className="w-full p-2 border border-slate-300 rounded" required /></div>
                    <div><label className="text-sm font-medium">Fornecedor</label><input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} className="w-full p-2 border border-slate-300 rounded" required /></div>
                    <div><label className="text-sm font-medium">Nota Fiscal (NFe)</label><input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full p-2 border border-slate-300 rounded" required /></div>
                    <div><label className="text-sm font-medium">Nº Conferência</label><input type="text" value={formData.conferenceNumber} disabled className="w-full p-2 border border-slate-300 rounded bg-slate-100" /></div>
                </div>
                <div className="flex-grow overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr>
                                {['Lote Interno', 'Lote Fornecedor', 'Corrida', 'Tipo Material', 'Bitola', 'Peso Etiqueta (kg)', 'Peso Balança (kg)', ''].map(h => <th key={h} className="p-2 text-left font-semibold text-slate-600">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {formData.lots.map((lot, index) => (
                                <tr key={index} className="border-b">
                                    <td className="p-2">
                                        <input type="text" value={lot.internalLot} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-2 border border-slate-300 rounded" required />
                                        {duplicateErrors[index] && <p className="text-red-500 text-xs mt-1">{duplicateErrors[index]}</p>}
                                    </td>
                                    <td className="p-2"><input type="text" value={lot.supplierLot} onChange={e => handleLotChange(index, 'supplierLot', e.target.value)} className="w-full p-2 border border-slate-300 rounded" required /></td>
                                    <td className="p-2"><input type="text" value={lot.runNumber} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-2 border border-slate-300 rounded" required /></td>
                                    <td className="p-2">
                                        <select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white">
                                            {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select value={lot.bitola} onChange={e => handleLotChange(index, 'bitola', e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white">
                                            {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"><input type="number" step="0.01" value={lot.labelWeight} onChange={e => handleLotChange(index, 'labelWeight', parseFloat(e.target.value))} className="w-full p-2 border border-slate-300 rounded" required /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={lot.scaleWeight} onChange={e => handleLotChange(index, 'scaleWeight', parseFloat(e.target.value))} className="w-full p-2 border border-slate-300 rounded" required /></td>
                                    <td className="p-2 text-center"><button type="button" onClick={() => handleRemoveLot(index)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" onClick={handleAddLot} className="text-slate-600 hover:text-slate-800 font-semibold py-2 mt-2 self-start">+ Adicionar outro lote</button>

                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">Salvar Alterações</button>
                </div>
            </form>
        </div>
    );
};

const FinishedConferencesModal: React.FC<FinishedConferencesModalProps> = ({ conferences, stock, onClose, onShowReport, onEditConference, onDeleteConference }) => {
    const [expandedConferenceId, setExpandedConferenceId] = useState<string | null>(null);
    const [editingConference, setEditingConference] = useState<ConferenceData | null>(null);
    const [deletingConference, setDeletingConference] = useState<ConferenceData | null>(null);

    const toggleExpand = (conferenceNumber: string) => {
        setExpandedConferenceId(prevId => (prevId === conferenceNumber ? null : conferenceNumber));
    };

    const handleEdit = (conference: ConferenceData) => {
        setEditingConference(conference);
    };

    const handleEditSubmit = (updatedData: ConferenceData) => {
        onEditConference(updatedData.conferenceNumber, updatedData);
        setEditingConference(null);
    };

    const handleDeleteConfirm = () => {
        if (deletingConference) {
            onDeleteConference(deletingConference.conferenceNumber);
            setDeletingConference(null);
        }
    };

    return (
        <>
            {editingConference && <EditConferenceModal conference={editingConference} stock={stock} onClose={() => setEditingConference(null)} onSubmit={handleEditSubmit} />}
            {deletingConference && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                        <p className="text-lg text-slate-700 mb-6">Tem certeza que deseja excluir a conferência <strong>{deletingConference.conferenceNumber}</strong>? Todos os lotes associados serão removidos do estoque.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeletingConference(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Conferências Finalizadas</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {conferences.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Nº Conferência</th>
                                    <th className="p-3 font-semibold text-slate-600">Fornecedor</th>
                                    <th className="p-3 font-semibold text-slate-600">Nota Fiscal</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Nº Lotes</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {conferences.map((conf) => (
                                    <React.Fragment key={conf.conferenceNumber}>
                                        <tr className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(conf.entryDate).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-3 font-medium">{conf.conferenceNumber}</td>
                                            <td className="p-3">{conf.supplier}</td>
                                            <td className="p-3">{conf.nfe}</td>
                                            <td className="p-3 text-center">{conf.lots.length}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center gap-3">
                                                    <button onClick={() => onShowReport(conf)} className="text-emerald-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Reimprimir Relatório">
                                                        <PrinterIcon className="h-4 w-4"/>
                                                        <span>Reimprimir</span>
                                                    </button>
                                                    <button onClick={() => handleEdit(conf)} className="text-indigo-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Editar Conferência">
                                                        <PencilIcon className="h-4 w-4"/>
                                                        <span>Editar</span>
                                                    </button>
                                                    <button onClick={() => setDeletingConference(conf)} className="text-red-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Excluir Conferência">
                                                        <TrashIcon className="h-4 w-4"/>
                                                        <span>Excluir</span>
                                                    </button>
                                                    <button onClick={() => toggleExpand(conf.conferenceNumber)} className="text-slate-600 hover:underline text-xs font-semibold">
                                                        {expandedConferenceId === conf.conferenceNumber ? 'Ocultar' : 'Ver Lotes'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedConferenceId === conf.conferenceNumber && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={6} className="p-4">
                                                    <h4 className="font-semibold text-slate-700 mb-2 pl-2">Lotes da Conferência: {conf.conferenceNumber}</h4>
                                                    <div className="overflow-x-auto border rounded-md bg-white">
                                                        <table className="min-w-full text-xs">
                                                            <thead className="bg-slate-100">
                                                                <tr>
                                                                    <th className="p-2 text-left font-semibold">Lote Interno</th>
                                                                    <th className="p-2 text-left font-semibold">Lote Fornecedor</th>
                                                                    <th className="p-2 text-left font-semibold">Material</th>
                                                                    <th className="p-2 text-left font-semibold">Bitola</th>
                                                                    <th className="p-2 text-right font-semibold">Peso Etiqueta (kg)</th>
                                                                    <th className="p-2 text-right font-semibold">Peso Balança (kg)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {conf.lots.map((lot, index) => (
                                                                    <tr key={index}>
                                                                        <td className="p-2">{lot.internalLot}</td>
                                                                        <td className="p-2">{lot.supplierLot}</td>
                                                                        <td className="p-2">{lot.materialType}</td>
                                                                        <td className="p-2">{lot.bitola}</td>
                                                                        <td className="p-2 text-right">{lot.labelWeight.toFixed(2)}</td>
                                                                        <td className="p-2 text-right font-bold">{lot.scaleWeight.toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
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
                        <p className="text-center text-slate-500 py-10">Nenhuma conferência foi finalizada ainda.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
            </div>
        </>
    );
};

export default FinishedConferencesModal;