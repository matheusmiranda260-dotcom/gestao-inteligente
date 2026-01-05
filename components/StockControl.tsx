import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, StockItem, ConferenceData, ConferenceLotData, Bitola, MaterialType, TransferRecord, ProductionOrderData, StockGauge, User } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon, BookOpenIcon, TruckIcon, DocumentReportIcon, PrinterIcon, LockOpenIcon, ClipboardListIcon, ChartBarIcon, XCircleIcon, ArchiveIcon, LocationOffIcon, CheckCircleIcon, ScaleIcon, AdjustmentsIcon } from './icons';

import LotHistoryModal from './LotHistoryModal';
import FinishedConferencesModal from './FinishedConferencesModal';
import ConferenceReport from './ConferenceReport';
import TransfersHistoryModal from './TransfersHistoryModal';
import TransferReport from './TransferReport';
import InventoryReport from './InventoryReport';
import StockDashboard from './StockDashboard';
import StockPyramidMap from './StockPyramidMap';
import { trelicaModels } from './ProductionOrderTrelica';

const normalizeBitola = (bitolaString: string) => parseFloat(bitolaString.replace(',', '.')).toFixed(2);





const getStatusBadge = (status: StockItem['status']) => {
    const styles = {
        'Disponível': 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        'Em Produção': 'bg-amber-100 text-amber-800 border border-amber-200',
        'Em Produção - Treliça': 'bg-violet-100 text-violet-800 border border-violet-200',
        'Transferido': 'bg-slate-200 text-slate-800 border border-slate-300',
        'Disponível - Suporte Treliça': 'bg-cyan-100 text-cyan-800 border border-cyan-200',
        'Disponível (Saldo Treliça)': 'bg-cyan-100 text-cyan-800 border border-cyan-200',
        'Consumido para fazer treliça': 'bg-slate-100 text-slate-500 border border-slate-200',
    };
    return (
        <span className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm backdrop-blur-sm ${styles[status] || styles['Transferido']}`}>
            {status}
        </span>
    );
};

const AddConferencePage: React.FC<{
    onClose: () => void;
    onSubmit: (data: ConferenceData) => void;
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
        supplier: '',
        nfe: '',
        conferenceNumber: '',
    });

    // Initial bitola depends on default material
    const getInitialBitola = (material: string) => {
        const materialGauges = gauges.filter(g => g.material_type === material).map(g => g.gauge);
        if (materialGauges.length > 0) return materialGauges[0];
        return material === 'Fio Máquina' ? FioMaquinaBitolaOptions[0] : TrefilaBitolaOptions[0];
    };

    const [lots, setLots] = useState<Partial<ConferenceLotData>[]>([{
        internalLot: '',
        supplierLot: '',
        runNumber: '',
        bitola: getInitialBitola('Fio Máquina'),
        materialType: 'Fio Máquina',
        labelWeight: 0,
        scaleWeight: 0,
        supplier: ''
    }]);
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [historyOpen, setHistoryOpen] = useState(false);

    const allBitolaOptions: Bitola[] = useMemo(() => {
        const fmGaugesFromDB = gauges.filter(g => g.material_type === 'Fio Máquina').map(g => String(g.gauge));
        const caGaugesFromDB = gauges.filter(g => g.material_type === 'CA-60' || g.material_type === 'CA-50' || g.material_type === 'Arame Trefilado').map(g => String(g.gauge));

        const finalFM = [...new Set([...FioMaquinaBitolaOptions, ...fmGaugesFromDB])];
        const finalCA = [...new Set([...TrefilaBitolaOptions, ...caGaugesFromDB])];

        return [...new Set([...finalFM, ...finalCA])].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.'))) as Bitola[];
    }, [gauges]);

    const prevSupplierRef = useRef(conferenceData.supplier);

    // Sync header supplier to lots
    useEffect(() => {
        const currentSupplier = conferenceData.supplier;
        const prevSupplier = prevSupplierRef.current;

        if (currentSupplier !== prevSupplier) {
            setLots(prevLots => prevLots.map(lot =>
                !lot.supplier || lot.supplier === '' || lot.supplier === prevSupplier
                    ? { ...lot, supplier: currentSupplier }
                    : lot
            ));
            prevSupplierRef.current = currentSupplier;
        }
    }, [conferenceData.supplier]);

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
        const lastLot = lots.length > 0 ? lots[lots.length - 1] : null;
        const defaultMaterial = lastLot?.materialType || 'Fio Máquina';
        const defaultBitola = lastLot?.bitola || getInitialBitola(defaultMaterial);

        setLots([...lots, {
            internalLot: '',
            supplierLot: '',
            runNumber: '',
            bitola: defaultBitola,
            materialType: defaultMaterial,
            labelWeight: 0,
            scaleWeight: 0,
            supplier: conferenceData.supplier
        }]);
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: string | number) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;
        setLots(newLots);
    };

    const handleRemoveLot = (index: number) => {
        const newLots = lots.filter((_, i) => i !== index);
        setLots(newLots);
        if (newLots.length === 0) {
            // Optionally ensure at least one lot exists or allow empty to prevent errors if logic requires it
        }
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

        // Ensure each lot has a supplier (fallback to header if somehow empty, though UI handles it)
        const lotsWithSupplier = completedLots.map(lot => ({
            ...lot,
            supplier: lot.supplier || conferenceData.supplier
        }));

        const finalData: ConferenceData = { ...conferenceData, lots: lotsWithSupplier };
        onSubmit(finalData);
        onShowReport(finalData);
        onClose();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn relative">
            {historyOpen && <FinishedConferencesModal conferences={conferences} stock={stock} onClose={() => setHistoryOpen(false)} onShowReport={onShowReport} onEditConference={onEditConference} onDeleteConference={onDeleteConference} />}

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700">
                            <ArrowLeftIcon className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Adicionar Nova Conferência</h1>
                            <p className="text-slate-500 text-sm">Registre a entrada de novos materiais no estoque.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isGestor && (
                            <button
                                type="button"
                                onClick={() => setPage('gaugesManager')}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-4 rounded-lg border border-blue-200 shadow-sm transition flex items-center gap-2"
                            >
                                <AdjustmentsIcon className="h-5 w-5" />Gerenciar Bitolas
                            </button>
                        )}
                        <button onClick={() => setHistoryOpen(true)} className="bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 font-semibold py-2 px-4 rounded-lg border border-slate-200 shadow-sm transition flex items-center gap-2">
                            <DocumentReportIcon className="h-5 w-5" />Conferências Finalizadas
                        </button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleFinalSubmit} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">

                {/* Header Fields Section */}
                <div className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Entrada</label>
                            <input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fornecedor</label>
                            <input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none shadow-sm" placeholder="Nome do Fornecedor" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nota Fiscal (NFe)</label>
                            <input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none shadow-sm" placeholder="000000" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nº Conferência</label>
                            <input type="text" value={conferenceData.conferenceNumber} onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none shadow-sm" placeholder="CONF-XXXX" required />
                        </div>
                    </div>
                </div>

                {/* Lots Table/List Section */}
                <div className="flex-grow overflow-y-auto p-0">
                    <div className="hidden md:block">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white border-b sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {['Lote Interno', 'Lote Fornecedor', 'Fornecedor', 'Corrida', 'Tipo Material', 'Bitola', 'Peso Etiqueta (kg)', 'Peso Balança (kg)', 'Diferença', 'Ações'].map(h =>
                                        <th key={h} className="px-4 py-3 font-bold text-slate-600 uppercase text-xs tracking-wider">{h}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lots.map((lot, index) => {
                                    const diff = (lot.scaleWeight || 0) - (lot.labelWeight || 0);
                                    const percent = lot.labelWeight ? (diff / lot.labelWeight) * 100 : 0;
                                    const isSignificant = Math.abs(percent) > 0.5;
                                    const isNegative = diff < 0;
                                    const isPositive = diff > 0;

                                    return (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 align-top">
                                                <input type="text" value={lot.internalLot || ''} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Lote Interno" />
                                                {duplicateErrors[index] && <p className="text-red-500 text-[10px] mt-1 font-bold">{duplicateErrors[index]}</p>}
                                            </td>
                                            <td className="p-3 align-top"><input type="text" value={lot.supplierLot || ''} onChange={e => handleLotChange(index, 'supplierLot', e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Lote Fornec." /></td>
                                            <td className="p-3 align-top"><input type="text" value={lot.supplier || ''} onChange={e => handleLotChange(index, 'supplier', e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder={conferenceData.supplier || "Fornecedor"} /></td>
                                            <td className="p-3 align-top"><input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Corrida" /></td>
                                            <td className="p-3 align-top">
                                                <select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white outline-none">
                                                    {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-3 align-top">
                                                <select value={lot.bitola} onChange={e => handleLotChange(index, 'bitola', e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white outline-none">
                                                    {(() => {
                                                        const options = gauges.length > 0
                                                            ? gauges.filter(g => g.material_type === lot.materialType).map(g => g.gauge)
                                                            : (lot.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : TrefilaBitolaOptions);

                                                        // Ensure sorting
                                                        const sorted = [...new Set(options)].sort((a: string, b: string) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
                                                        return sorted.map(b => <option key={b} value={b}>{b}</option>);
                                                    })()}
                                                </select>
                                            </td>
                                            <td className="p-3 align-top"><input type="number" step="0.01" value={lot.labelWeight || ''} onChange={e => handleLotChange(index, 'labelWeight', parseFloat(e.target.value))} className="w-24 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium" required placeholder="0.00" /></td>
                                            <td className="p-3 align-top"><input type="number" step="0.01" value={lot.scaleWeight || ''} onChange={e => handleLotChange(index, 'scaleWeight', parseFloat(e.target.value))} className="w-24 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-emerald-600 bg-emerald-50/50" required placeholder="0.00" /></td>

                                            {/* Difference Column */}
                                            <td className="p-3 align-top align-middle">
                                                {(lot.labelWeight && lot.scaleWeight) ? (
                                                    <div className={`flex flex-col text-xs font-bold ${isNegative ? 'text-red-600' : (isPositive ? 'text-emerald-600' : 'text-slate-500')}`}>
                                                        <span className="flex items-center gap-1">
                                                            {diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                                            {(isNegative && isSignificant) && <WarningIcon className="h-4 w-4 text-red-500" />}
                                                        </span>
                                                        <span className="opacity-75">
                                                            ({percent > 0 ? '+' : ''}{percent.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>

                                            <td className="p-3 align-top text-center"><button type="button" onClick={() => handleRemoveLot(index)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><TrashIcon className="h-5 w-5" /></button></td>
                                        </tr>
                                    )
                                })}
                                {/* Add Button Row inside table */}
                                <tr>
                                    <td colSpan={10} className="p-3 bg-slate-50/50 font-medium">
                                        <button type="button" onClick={handleAddLot} className="flex items-center gap-2 text-[#0F3F5C] hover:text-[#0A2A3D] font-bold py-2 px-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-[#0F3F5C] transition w-full justify-center">
                                            <span>+ Adicionar Outro Lote</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden p-4 space-y-4">
                        {lots.map((lot, index) => {
                            const diff = (lot.scaleWeight || 0) - (lot.labelWeight || 0);
                            const percent = lot.labelWeight ? (diff / lot.labelWeight) * 100 : 0;
                            const isSignificant = Math.abs(percent) > 0.5;
                            const isNegative = diff < 0;
                            const isPositive = diff > 0;

                            return (
                                <div key={index} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative">
                                    <div className="absolute top-4 right-4">
                                        <button type="button" onClick={() => handleRemoveLot(index)} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded">#{index + 1}</span>
                                        Lote
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lote Interno</label>
                                            <input type="text" value={lot.internalLot || ''} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none" placeholder="Ex: INT-001" />
                                            {duplicateErrors[index] && <p className="text-red-500 text-xs mt-1 font-bold">{duplicateErrors[index]}</p>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lote Forn.</label>
                                                <input type="text" value={lot.supplierLot || ''} onChange={e => handleLotChange(index, 'supplierLot', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
                                                <input type="text" value={lot.supplier || ''} onChange={e => handleLotChange(index, 'supplier', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none" placeholder={conferenceData.supplier || "Fornecedor"} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Corrida</label>
                                            <input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Material</label>
                                                <select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg bg-white outline-none">
                                                    {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bitola</label>
                                                <select
                                                    value={lot.bitola}
                                                    onChange={e => handleLotChange(index, 'bitola', e.target.value)}
                                                    className="w-full p-3 border border-slate-300 rounded-lg bg-white outline-none"
                                                >
                                                    {(() => {
                                                        const options = gauges.length > 0
                                                            ? gauges.filter(g => g.material_type === lot.materialType).map(g => g.gauge)
                                                            : (lot.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : TrefilaBitolaOptions);

                                                        const sorted = [...new Set(options)].sort((a: string, b: string) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
                                                        return sorted.map(b => <option key={b} value={b}>{b}</option>);
                                                    })()}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Etiqueta (kg)</label>
                                                <input type="number" step="0.01" value={lot.labelWeight || ''} onChange={e => handleLotChange(index, 'labelWeight', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded font-bold text-center" placeholder="0.00" />
                                            </div>
                                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                                <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Balança (kg)</label>
                                                <input type="number" step="0.01" value={lot.scaleWeight || ''} onChange={e => handleLotChange(index, 'scaleWeight', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-emerald-200 rounded font-bold text-center text-emerald-700" placeholder="0.00" />
                                            </div>
                                        </div>

                                        {/* Mobile Difference Row */}
                                        {(lot.labelWeight && lot.scaleWeight) ? (
                                            <div className={`mt-2 p-3 rounded-lg border flex items-center justify-between ${isNegative ? 'bg-red-50 border-red-200 text-red-800' : (isPositive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                                                <span className="text-xs font-bold uppercase">Diferença</span>
                                                <div className="flex items-center gap-2 font-bold text-sm">
                                                    <span>{diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg ({diff > 0 ? '+' : ''}{percent.toFixed(1)}%)</span>
                                                    {(isNegative && isSignificant) && <WarningIcon className="h-5 w-5 text-red-600" />}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                        <button type="button" onClick={handleAddLot} className="w-full py-4 bg-white border-2 border-dashed border-slate-300 text-slate-500 hover:text-[#0F3F5C] hover:border-[#0F3F5C] font-bold rounded-xl transition shadow-sm">
                            + Adicionar Outro Lote
                        </button>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-4">
                    <button type="button" onClick={onClose} className="px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition">
                        Cancelar Operação
                    </button>
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
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar Lote: {item.internalLot}</h2>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={formData.supplier} onChange={e => handleChange('supplier', e.target.value)} placeholder="Fornecedor" className="p-2 border border-slate-300 rounded" />
                    <input type="text" value={formData.nfe} onChange={e => handleChange('nfe', e.target.value)} placeholder="NFe" className="p-2 border border-slate-300 rounded" />
                    <input type="number" step="0.01" value={formData.labelWeight} onChange={e => handleChange('labelWeight', parseFloat(e.target.value))} placeholder="Peso Etiqueta" className="p-2 border border-slate-300 rounded" />
                    <input type="number" step="0.01" value={formData.remainingQuantity} onChange={e => handleChange('remainingQuantity', parseFloat(e.target.value))} placeholder="Peso Restante" className="p-2 border border-slate-300 rounded" />
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
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Realizar Transferência de Material</h2>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-800">Setor de Destino</label>
                    <select value={destinationSector} onChange={e => setDestinationSector(e.target.value)} className="mt-1 p-2 w-full border border-slate-300 rounded bg-white">
                        <option value="Coluna">Coluna</option>
                        <option value="CA50">CA50</option>
                        <option value="Mediterranea">Mediterranea</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
                <div className="flex-grow overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr >
                                <th className="p-2 text-left font-semibold text-slate-600">Lote Interno</th>
                                <th className="p-2 text-left font-semibold text-slate-600">Restante (kg)</th>
                                <th className="p-2 text-left font-semibold text-slate-600">Qtd. a Transferir (kg)</th>
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
    productionOrders: ProductionOrderData[];
    initialView?: 'list' | 'map' | 'add';
    gauges: StockGauge[];
    currentUser: User | null;
}> = ({ stock, conferences, transfers, setPage, addConference, deleteStockItem, updateStockItem, createTransfer, editConference, deleteConference, productionOrders, initialView, gauges, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [isAddConferenceModalOpen, setIsAddConferenceModalOpen] = useState(initialView === 'add');
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

    const [isStockMapOpen, setIsStockMapOpen] = useState(initialView === 'map');

    useEffect(() => {
        if (initialView === 'add') {
            setIsAddConferenceModalOpen(true);
            setIsStockMapOpen(false);
        } else if (initialView === 'map') {
            setIsStockMapOpen(true);
            setIsAddConferenceModalOpen(false);
        } else {
            setIsAddConferenceModalOpen(false);
            setIsStockMapOpen(false);
        }
    }, [initialView]);
    const [unmappingItem, setUnmappingItem] = useState<StockItem | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [materialFilter, setMaterialFilter] = useState('');
    const [bitolaFilter, setBitolaFilter] = useState('');
    const [selectedLotIdsForTransfer, setSelectedLotIdsForTransfer] = useState<string[]>([]);

    const allBitolaOptions = useMemo(() => {
        if (gauges.length > 0) {
            return [...new Set(gauges.map(g => String(g.gauge)))].sort((a, b) => parseFloat(String(a)) - parseFloat(String(b)));
        }
        return [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort();
    }, [gauges]);

    const [mappedFilter, setMappedFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');

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
            .filter(item => {
                if (mappedFilter === 'mapped') return !!item.location;
                if (mappedFilter === 'unmapped') return !item.location;
                return true;
            })
            .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    }, [stock, searchTerm, statusFilter, materialFilter, bitolaFilter, mappedFilter]);

    // Stats for Mapped lots
    const totalStockCount = stock.length;
    const mappedStockCount = stock.filter(s => !!s.location).length;
    const unmappedStockCount = totalStockCount - mappedStockCount;
    const totalRemainingWeight = stock.reduce((sum, s) => sum + (s.remainingQuantity || 0), 0);
    const inProductionWeight = stock.filter(s => s.status.includes('Em Produção')).reduce((sum, s) => sum + (s.remainingQuantity || 0), 0);

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

    const handleUnmap = () => {
        if (unmappingItem) {
            const updatedItem: StockItem = {
                ...unmappingItem,
                location: null
            };
            updatedItem.history = [...(unmappingItem.history || []), {
                type: 'Remoção do Mapa',
                date: new Date().toISOString(),
                details: {
                    action: 'Localização removida manualmente',
                    reason: 'Solicitação do usuário (Correção)'
                }
            }];
            updateStockItem(updatedItem);
            setUnmappingItem(null);
        }
    };

    return (
        <>
            {conferenceReportData && <ConferenceReport reportData={conferenceReportData} onClose={() => setConferenceReportData(null)} />}

            {isAddConferenceModalOpen ? (
                <AddConferencePage onClose={() => { setIsAddConferenceModalOpen(false); if (initialView === 'add') setPage('stock'); }} onSubmit={handleAddConferenceSubmit} stock={stock} onShowReport={setConferenceReportData} conferences={conferences} onEditConference={editConference} onDeleteConference={deleteConference} gauges={gauges} isGestor={isGestor} setPage={setPage} />
            ) : (
                <div className="p-4 sm:p-6 md:p-8 space-y-6">
                    {/* Keeping Modals ... */}
                    {editingItem && <EditStockItemModal item={editingItem} onClose={() => setEditingItem(null)} onSubmit={updateStockItem} />}
                    {isMultiLotTransferModalOpen && <MultiLotTransferModal lots={stock.filter(s => selectedLotIdsForTransfer.includes(s.id))} onClose={() => setIsMultiLotTransferModalOpen(false)} onSubmit={handleTransferSubmit} />}
                    {historyLot && <LotHistoryModal lot={historyLot} onClose={() => setHistoryLot(null)} />}
                    {conferenceHistoryOpen && <FinishedConferencesModal conferences={conferences} stock={stock} onClose={() => setConferenceHistoryOpen(false)} onShowReport={setConferenceReportData} onEditConference={editConference} onDeleteConference={deleteConference} />}

                    {transferHistoryOpen && <TransfersHistoryModal transfers={transfers} onClose={() => setTransferHistoryOpen(false)} onShowReport={setTransferReportData} />}
                    {transferReportData && <TransferReport reportData={transferReportData} onClose={() => setTransferReportData(null)} />}

                    {showInventoryReport && <InventoryReport stock={stock} filters={{ searchTerm, statusFilter, materialFilter, bitolaFilter }} onClose={() => setShowInventoryReport(false)} />}
                    {isStockMapOpen && <StockPyramidMap stock={stock} onUpdateStockItem={updateStockItem} onClose={() => { setIsStockMapOpen(false); if (initialView === 'map') setPage('stock'); }} />}

                    {/* Confirmation Modals */}
                    {releasingItem && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                                <div className="flex items-center gap-3 text-amber-600 mb-4">
                                    <LockOpenIcon className="h-8 w-8" />
                                    <h2 className="text-xl font-bold">Liberar Lote Manualmente</h2>
                                </div>
                                <p className="text-slate-600 mb-6">
                                    Deseja alterar o status do lote <span className="font-bold text-slate-800">{releasingItem.internalLot}</span> de <span className="font-bold text-amber-600">"{releasingItem.status}"</span> para <span className="font-bold text-emerald-600">"Disponível"</span>?
                                    <br /><br />
                                    Isso removerá qualquer vínculo com Ordens de Produção pendentes.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setReleasingItem(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                                    <button onClick={handleRelease} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-md transition">Confirmar Liberação</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deletingItem && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                                <div className="flex items-center gap-3 text-red-600 mb-4">
                                    <TrashIcon className="h-8 w-8" />
                                    <h2 className="text-xl font-bold">Excluir Lote</h2>
                                </div>
                                <p className="text-slate-600 mb-6">
                                    Tem certeza que deseja excluir permanentemente o lote <span className="font-bold text-slate-800">{deletingItem.internalLot}</span>? Esta ação não pode ser desfeita.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setDeletingItem(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                                    <button onClick={handleDelete} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition">Excluir Permanente</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {unmappingItem && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                                <div className="flex items-center gap-3 text-amber-600 mb-4">
                                    <LocationOffIcon className="h-8 w-8" />
                                    <h2 className="text-xl font-bold">Remover do Mapa</h2>
                                </div>
                                <p className="text-slate-600 mb-6">
                                    Deseja remover a localização <span className="font-bold text-emerald-600">"{unmappingItem.location}"</span> do lote <span className="font-bold text-slate-800">{unmappingItem.internalLot}</span>? O lote voltará a ficar "Pendente de Mapeamento".
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setUnmappingItem(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                                    <button onClick={handleUnmap} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-md transition">Remover Local</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isStockMapOpen && (
                        <>
                            <header className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <button onClick={() => setPage('menu')} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition">
                                        <ArrowLeftIcon className="h-6 w-6 text-slate-800" />
                                    </button>
                                    <h1 className="text-xl md:text-3xl font-bold text-slate-800">Controle de Estoque</h1>
                                </div>

                                {/* Global Mapping Status */}
                                <div className="flex flex-wrap gap-2 md:gap-4 items-center bg-white px-3 py-2 md:px-4 md:py-3 rounded-xl shadow-sm border border-slate-100">
                                    <div className="flex flex-col items-center px-2 md:px-4 border-r">
                                        <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Lotes</span>
                                        <span className="text-sm md:text-xl font-bold text-slate-700">{totalStockCount}</span>
                                    </div>
                                    <div className="flex flex-col items-center px-2 md:px-4 border-r">
                                        <span className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase tracking-wider">Mapeados</span>
                                        <span className="text-sm md:text-xl font-bold text-emerald-600">{mappedStockCount}</span>
                                    </div>
                                    <div className="flex flex-col items-center px-2 md:px-4 border-r">
                                        <span className="text-[10px] md:text-xs font-bold text-blue-600 uppercase tracking-wider">Saldo</span>
                                        <span className="text-sm md:text-xl font-bold text-blue-600">{totalRemainingWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}<span className="text-[8px] md:text-[10px] ml-0.5">kg</span></span>
                                    </div>
                                    <div className="flex flex-col items-center px-2 md:px-4">
                                        <span className="text-[10px] md:text-xs font-bold text-violet-600 uppercase tracking-wider">Produção</span>
                                        <span className="text-sm md:text-xl font-bold text-violet-600">{inProductionWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}<span className="text-[8px] md:text-[10px] ml-0.5">kg</span></span>
                                    </div>
                                </div>
                            </header>

                            <div className="bg-white p-6 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between">
                                <div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsAddConferenceModalOpen(true)} className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg transition text-base">
                                            + Adicionar Conferência
                                        </button>
                                        <div className="relative group">
                                            <button onClick={() => setIsStockMapOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition text-base flex items-center gap-2 shadow-lg relative overflow-hidden">
                                                <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                                                <ArchiveIcon className="w-5 h-5 relative z-10" />
                                                <span className="relative z-10">MAPA DE ESTOQUE</span>
                                                {unmappedStockCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">!</span>
                                                    </span>
                                                )}
                                            </button>
                                            <div className="absolute top-full mt-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                                                Clique para organizar os lotes fisicamente nas fileiras.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Keeping Existing buttons, but REMOVED Finished Conferences Button */}
                                <div className="flex gap-4">
                                    <button onClick={() => setPage('stock_inventory')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition flex items-center gap-2">
                                        <ScaleIcon className="h-5 w-5" />Inventário Mobile
                                    </button>
                                    <button onClick={() => setStockDashboardOpen(true)} className="bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2">
                                        <ChartBarIcon className="h-5 w-5" />Estatística
                                    </button>
                                    <button onClick={() => setShowInventoryReport(true)} className="bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2">
                                        <PrinterIcon className="h-5 w-5" />Imprimir
                                    </button>
                                    <button onClick={() => setTransferHistoryOpen(true)} className="bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2">
                                        <TruckIcon className="h-5 w-5" />Histórico Transf.
                                    </button>
                                </div>
                            </div>

                            {stockDashboardOpen && (
                                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto flex flex-col relative">
                                        <button onClick={() => setStockDashboardOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
                                            <XCircleIcon className="h-8 w-8" />
                                        </button>
                                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Estatísticas do Estoque</h2>
                                        <StockDashboard stock={stock} />
                                    </div>
                                </div>
                            )}

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-semibold text-slate-800 mb-4">Filtros de Busca</h2>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <input type="text" placeholder="Buscar por lote, fornecedor, NFe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border border-slate-300 rounded-md md:col-span-1 text-slate-800" />
                                    <select value={bitolaFilter} onChange={e => setBitolaFilter(e.target.value)} className="p-2 border border-slate-300 rounded-md bg-white text-slate-800">
                                        <option value="">Todas as Bitolas</option>
                                        {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-slate-300 rounded-md bg-white text-slate-800">
                                        <option value="">Todos os Status</option>
                                        <option value="Disponível">Disponível</option>
                                        <option value="Disponível - Suporte Treliça">Disponível - Suporte Treliça</option>
                                        <option value="Em Produção">Em Produção</option>
                                        <option value="Em Produção - Treliça">Em Produção - Treliça</option>
                                        <option value="Transferido">Transferido</option>
                                    </select>
                                    {/* Mapped Filter */}
                                    <select value={mappedFilter} onChange={e => setMappedFilter(e.target.value as any)} className="p-2 border border-slate-300 rounded-md bg-white text-slate-800">
                                        <option value="all">Todos (Mapeamento)</option>
                                        <option value="mapped">Mapeados (Com Local)</option>
                                        <option value="unmapped">Não Mapeados (Pendentes)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm">
                                <div className="p-6 border-b flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-800">Lotes em Estoque</h2>
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

                                {/* Mobile Cards View */}
                                <div className="md:hidden divide-y divide-slate-100">
                                    {filteredStock.map(item => (
                                        <div key={item.id} className={`p-4 ${item.location ? 'bg-emerald-50/20' : 'bg-white'} space-y-3`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-black text-slate-900">{item.internalLot}</span>
                                                        {item.location && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">{item.location}</span>}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.supplierLot} • {item.supplier}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-black text-slate-900">{item.remainingQuantity.toFixed(2)}<span className="text-[10px] ml-0.5">kg</span></div>
                                                    <p className="text-[10px] text-slate-400 font-bold">{item.materialType} • {item.bitola}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1">
                                                    {getStatusBadge(item.status)}
                                                    {item.productionOrderIds && item.productionOrderIds.length > 0 && (
                                                        <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                                                            {item.productionOrderIds.length} OP(s)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setHistoryLot(item)} className="p-2 bg-slate-100 rounded-lg text-slate-500"><BookOpenIcon className="h-5 w-5" /></button>
                                                    <button onClick={() => setEditingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-2 bg-slate-100 rounded-lg text-slate-500 disabled:opacity-30"><PencilIcon className="h-5 w-5" /></button>
                                                    <button onClick={() => setDeletingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-2 bg-red-50 rounded-lg text-red-500 disabled:opacity-30"><TrashIcon className="h-5 w-5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-600 uppercase bg-slate-50">
                                            <tr>
                                                <th className="p-4 w-12"><input type="checkbox" onChange={handleSelectAllForTransfer} checked={filteredStock.length > 0 && selectedLotIdsForTransfer.length === filteredStock.filter(i => i.status === 'Disponível' || i.status === 'Disponível - Suporte Treliça').length} className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500" /></th>
                                                <th className="px-6 py-3">Mapeado</th>
                                                <th className="px-6 py-3">Data Entrada</th>
                                                <th className="px-6 py-3">Lote Interno</th>
                                                <th className="px-6 py-3">Lote Fornecedor</th>
                                                <th className="px-6 py-3">Fornecedor</th>
                                                <th className="px-6 py-3">Tipo de Material</th>
                                                <th className="px-6 py-3">Bitola</th>
                                                <th className="px-6 py-3 text-right">Saldo / Original (kg)</th>
                                                <th className="px-6 py-3 text-center">Status</th>
                                                <th className="px-6 py-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {filteredStock.map(item => (
                                                <tr key={item.id} className={`hover:bg-slate-50 ${item.location ? 'bg-emerald-50/30' : 'bg-white'}`}>
                                                    <td className="p-4">
                                                        <input type="checkbox" checked={selectedLotIdsForTransfer.includes(item.id)} onChange={() => handleSelectLotForTransfer(item.id)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {item.location ? (
                                                            <div className="flex justify-center" title="Mapeado nas fileiras">
                                                                <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 w-6 h-6 flex items-center justify-center">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-center" title="Pendente de mapeamento">
                                                                <div className="bg-slate-100 text-slate-400 rounded-full p-1 w-6 h-6 flex items-center justify-center">
                                                                    <span className="text-xs font-bold">-</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                                                        {item.internalLot}
                                                        {item.location && (
                                                            <div className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded inline-block ml-2 border border-emerald-200">
                                                                {item.location}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{item.supplierLot}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{item.supplier}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">{item.materialType}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{item.bitola}</td>
                                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                                        <div className="flex flex-col items-end">
                                                            <span className={`font-bold ${item.remainingQuantity < item.initialQuantity ? 'text-blue-700' : 'text-slate-800'}`}>
                                                                {item.remainingQuantity.toFixed(2)}
                                                            </span>
                                                            {item.status === 'Em Produção - Treliça' && (() => {
                                                                const order = productionOrders.find(o =>
                                                                    o.status !== 'completed' &&
                                                                    (Array.isArray(o.selectedLotIds)
                                                                        ? o.selectedLotIds.includes(item.id)
                                                                        : Object.values(o.selectedLotIds).some(ids => Array.isArray(ids) ? ids.includes(item.id) : ids === item.id))
                                                                );

                                                                if (order && order.trelicaModel) {
                                                                    const model = trelicaModels.find(m => m.modelo === order.trelicaModel);
                                                                    if (model) {
                                                                        const parse = (s: string) => parseFloat(s.replace(',', '.'));
                                                                        const qty = order.quantityToProduce || 0;

                                                                        // Determine which part of the trelica this lot is and its relevant siblings for consumption order
                                                                        const lots = order.selectedLotIds as any;
                                                                        let targetWeight = 0;
                                                                        let relevantLotIds: string[] = [];

                                                                        if (lots.allSuperior?.includes(item.id) || lots.superior === item.id) {
                                                                            targetWeight = parse(model.pesoSuperior) * qty;
                                                                            relevantLotIds = lots.allSuperior || [lots.superior];
                                                                        } else if (lots.allInferiorLeft?.includes(item.id) || lots.inferior1 === item.id) {
                                                                            targetWeight = (parse(model.pesoInferior) * qty) / 2;
                                                                            relevantLotIds = lots.allInferiorLeft || [lots.inferior1];
                                                                        } else if (lots.allInferiorRight?.includes(item.id) || lots.inferior2 === item.id) {
                                                                            targetWeight = (parse(model.pesoInferior) * qty) / 2;
                                                                            relevantLotIds = lots.allInferiorRight || [lots.inferior2];
                                                                        } else if (lots.allSenozoideLeft?.includes(item.id) || lots.senozoide1 === item.id) {
                                                                            targetWeight = (parse(model.pesoSenozoide) * qty) / 2;
                                                                            relevantLotIds = lots.allSenozoideLeft || [lots.senozoide1];
                                                                        } else if (lots.allSenozoideRight?.includes(item.id) || lots.senozoide2 === item.id) {
                                                                            targetWeight = (parse(model.pesoSenozoide) * qty) / 2;
                                                                            relevantLotIds = lots.allSenozoideRight || [lots.senozoide2];
                                                                        }

                                                                        if (relevantLotIds.length > 0) {
                                                                            // Logic must match App.tsx and ProductionOrderTrelica sorting
                                                                            const sortedRelevantLots = relevantLotIds
                                                                                .map(id => stock.find(s => s.id === id))
                                                                                .filter((s): s is StockItem => !!s)
                                                                                .sort((a, b) => {
                                                                                    // We consider both 'suporte' and current 'em produção' as priority
                                                                                    const isPriorityA = a.status === 'Disponível - Suporte Treliça' || a.status === 'Em Produção - Treliça';
                                                                                    const isPriorityB = b.status === 'Disponível - Suporte Treliça' || b.status === 'Em Produção - Treliça';
                                                                                    if (isPriorityA && !isPriorityB) return -1;
                                                                                    if (!isPriorityA && isPriorityB) return 1;
                                                                                    return a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true, sensitivity: 'base' });
                                                                                });

                                                                            let remainingRequired = targetWeight;
                                                                            let predictedBalance = item.remainingQuantity;

                                                                            for (const l of sortedRelevantLots) {
                                                                                const available = l.remainingQuantity;
                                                                                const toConsume = Math.min(remainingRequired, available);

                                                                                if (l.id === item.id) {
                                                                                    predictedBalance = Math.max(0, available - toConsume);
                                                                                    break;
                                                                                }

                                                                                remainingRequired -= toConsume;
                                                                                if (remainingRequired <= 0) {
                                                                                    predictedBalance = available; // Not reached yet
                                                                                    break;
                                                                                }
                                                                            }

                                                                            return (
                                                                                <div className="flex flex-col items-end mt-1">
                                                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Irá Sobrar:</span>
                                                                                    <span className={`text-xs font-black px-1 rounded border ${predictedBalance < 0.1 ? 'text-red-600 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                                                                                        {predictedBalance.toFixed(2)}kg
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                            {item.remainingQuantity !== item.initialQuantity && (
                                                                <span className="text-[10px] text-slate-400 line-through">
                                                                    De {item.initialQuantity.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        {getStatusBadge(item.status)}
                                                        {item.productionOrderIds && item.productionOrderIds.length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                                                                {item.productionOrderIds.map(id => {
                                                                    const order = productionOrders.find(o => o.id === id);
                                                                    return (
                                                                        <span key={id} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm" title={`Ordem de Produção: ${order?.orderNumber || id}`}>
                                                                            {order?.orderNumber || `OP: ${id.split('-').pop()?.toUpperCase()}`}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button onClick={() => setHistoryLot(item)} className="p-1 text-slate-500 hover:text-slate-800" title="Ver Histórico"><BookOpenIcon className="h-5 w-5" /></button>
                                                            <button onClick={() => setEditingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-1 text-slate-500 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Editar Lote"><PencilIcon className="h-5 w-5" /></button>
                                                            <button onClick={() => setDeletingItem(item)} disabled={item.status !== 'Disponível' && item.status !== 'Disponível - Suporte Treliça'} className="p-1 text-slate-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Excluir Lote"><TrashIcon className="h-5 w-5" /></button>
                                                            {(item.status.includes('Em Produção') || item.status === 'Disponível - Suporte Treliça') && (
                                                                <button onClick={() => setReleasingItem(item)} className="p-1 text-amber-500 hover:text-amber-700" title="Liberar Lote Manualmente (Correção)">
                                                                    <LockOpenIcon className="h-5 w-5" />
                                                                </button>
                                                            )}
                                                            {item.location && (
                                                                <button onClick={() => setUnmappingItem(item)} className="p-1 text-slate-500 hover:text-amber-600" title="Remover do Mapa (Resetar Local)">
                                                                    <LocationOffIcon className="h-5 w-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredStock.length === 0 && (
                                    <div className="text-center text-slate-500 py-16">
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <ArchiveIcon className="h-10 w-10 text-slate-300" />
                                        </div>
                                        <p className="font-bold text-lg">Nenhum lote corresponde aos filtros</p>
                                        <p className="text-sm">Tente ajustar seus critérios de busca ou filtros.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div >
            )}
        </>
    );
};

export default StockControl;