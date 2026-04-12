import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowLeftIcon, CameraIcon, TrashIcon, CheckCircleIcon, DocumentReportIcon,
    AdjustmentsIcon, PencilIcon, BookOpenIcon, SearchIcon, FilterIcon, XIcon, PrinterIcon,
    ArrowPathIcon, DownloadIcon
} from './icons';
import type {
    ConferenceLotData, ConferenceData, StockItem, Bitola, MaterialType, Page, StockGauge, User, TransferRecord
} from '../types';
import {
    FioMaquinaBitolaOptions, TrefilaBitolaOptions, MaterialOptions, CA60BitolaOptions, SteelTypeOptions
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
        case 'Consumido': return <span className={`${baseClass} bg-slate-100 text-slate-400 border-slate-200 italic`}>Consumido</span>;
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
        internalLot: '', runNumber: '', steelType: '1006', bitola: '8.00', materialType: 'Fio Máquina', labelWeight: 0
    }]);
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [historyOpen, setHistoryOpen] = useState(false);

    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStock = new Set(stock.filter(s => s.status !== 'Consumido').map(i => i.internalLot.trim().toLowerCase()));
        const currentBatch = new Set();
        lots.forEach((l, i) => {
            if (!l.internalLot) return;
            const key = l.internalLot.trim().toLowerCase();
            if (existingStock.has(key)) newErrors[i] = "Já existe no estoque.";
            else if (currentBatch.has(key)) newErrors[i] = "Duplicado nesta lista.";
            currentBatch.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [lots, stock]);

    const handleAddLot = () => {
        const lastLot = lots[lots.length - 1];
        setLots([...lots, { ...lastLot, internalLot: '', labelWeight: 0 }]);
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: any) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;

        if (field === 'materialType') {
            const base = value === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
            const custom = gauges.filter(g => g.materialType === value).map(g => g.gauge);
            const all = [...new Set([...base, ...custom])];
            
            if (!all.includes(newLots[index].bitola || '')) {
                newLots[index].bitola = all[0] || '';
            }
        }

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
                    internalLot: l.internalLot || '', runNumber: String(l.runNumber || ''),
                    bitola: (l.bitola || '8.00').replace('.', ','), materialType: 'Fio Máquina' as MaterialType, labelWeight: Number(l.labelWeight) || 0
                }));
                setLots(p => (p.length === 1 && !p[0].internalLot) ? mapped : [...p, ...mapped]);
            }
        } catch (e) { alert('Erro na leitura'); } finally { setIsScanning(false); }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || Object.keys(duplicateErrors).length) return;
        const validLots = lots.filter(l => !!l.internalLot) as ConferenceLotData[];
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
                        <div className="text-center"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label><input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-2 border rounded text-center" required /></div>
                        <div className="text-center"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label><input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} className="w-full p-2 border rounded text-center" required /></div>
                        <div className="text-center"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">NFe</label><input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} className="w-full p-2 border rounded text-center" required /></div>
                        <div className="text-center"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº Conf.</label><input type="text" value={conferenceData.conferenceNumber} onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} className="w-full p-2 border rounded text-center" required /></div>
                    </div>
                    <div className="p-4 flex justify-end">
                        <input type="file" accept="image/*" capture="environment" className="hidden" id="scan-ia" onChange={handleGlobalScan} />
                        <label htmlFor="scan-ia" className="bg-[#0F3F5C] text-white px-6 py-2 rounded-lg font-bold cursor-pointer flex items-center gap-2"><CameraIcon className="h-5 w-5" /> {isScanning ? 'Lendo...' : 'Leitura IA'}</label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-y">
                                <tr>{['Lote Interno', 'Tipo de Aço', 'Corrida', 'Material', 'Bitola', 'Peso Etiqueta', ''].map(h => <th key={h} className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {lots.map((lot, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2">
                                            <input type="text" value={lot.internalLot || ''} onChange={e => handleLotChange(index, 'internalLot', e.target.value)} className="w-full p-2 border rounded text-center" required />
                                            {duplicateErrors[index] && <p className="text-red-500 text-[9px] font-bold text-center">{duplicateErrors[index]}</p>}
                                        </td>
                                        <td className="p-2">
                                            <select value={lot.steelType || ''} onChange={e => handleLotChange(index, 'steelType', e.target.value)} className="w-full p-2 border rounded text-center" required>
                                                {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2"><input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full p-2 border rounded text-center" required /></td>
                                        <td className="p-2"><select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full p-2 border rounded text-center">{MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
                                        <td className="p-2">
                                            <select value={lot.bitola} onChange={e => handleLotChange(index, 'bitola', e.target.value)} className="w-full p-2 border rounded text-center">
                                                {(() => {
                                                    const baseGauges = lot.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
                                                    const customGauges = gauges.filter(g => g.materialType === lot.materialType);
                                                    
                                                    // Map all to a common structure
                                                    const allOptions = [
                                                        ...baseGauges.map(g => ({ gauge: g, code: '' })),
                                                        ...customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }))
                                                    ];

                                                    const map = new Map();
                                                    allOptions.forEach(opt => {
                                                        const existing = map.get(opt.gauge);
                                                        if (!existing || (opt.code && !existing.code)) {
                                                            map.set(opt.gauge, opt);
                                                        }
                                                    });

                                                    const uniqueOptions = Array.from(map.values())
                                                        .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));

                                                    return uniqueOptions.map(opt => (
                                                        <option key={`${opt.gauge}-${opt.code}`} value={opt.gauge}>
                                                            {opt.gauge.replace('.', ',')} {opt.code ? `(${opt.code})` : ''}
                                                        </option>
                                                    ));
                                                })()}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={lot.labelWeight || ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    handleLotChange(index, 'labelWeight', val ? parseInt(val) : 0);
                                                }}
                                                className="w-full p-2 border rounded font-bold text-center no-spinner"
                                                placeholder="0"
                                                required
                                            />
                                        </td>
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
    const [consumingItem, setConsumingItem] = useState<StockItem | null>(null);
    const [materialFilter, setMaterialFilter] = useState('');
    const [bitolaFilter, setBitolaFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const statusDesktopRef = useRef<HTMLDivElement>(null);
    const statusMobileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDesktopRef.current && !statusDesktopRef.current.contains(event.target as Node)) setIsStatusOpen(false);
            if (statusMobileRef.current && !statusMobileRef.current.contains(event.target as Node)) setIsMobileStatusOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isPrinting) {
            window.print();
            // Pequeno delay para garantir que o estado volte após a caixa de impressão fechar
            // Em alguns browsers window.print é síncrono, em outros não.
            setTimeout(() => setIsPrinting(false), 500);
        }
    }, [isPrinting]);

    const availableBitolas = useMemo(() => {
        let options: string[] = [];
        if (materialFilter === 'Fio Máquina') {
            options = [...FioMaquinaBitolaOptions, ...gauges.filter(g => g.materialType === 'Fio Máquina').map(g => g.gauge)];
        } else if (materialFilter === 'CA-60') {
            options = [...CA60BitolaOptions, ...gauges.filter(g => g.materialType === 'CA-60').map(g => g.gauge)];
        } else {
            options = [...FioMaquinaBitolaOptions, ...CA60BitolaOptions, ...gauges.map(g => g.gauge)];
        }
        
        const stockBitolas = stock
            .filter(i => i.status !== 'Consumido' && (materialFilter === '' || i.materialType === materialFilter))
            .map(i => i.bitola);
            
        return [...new Set([...options, ...stockBitolas])]
            .filter(Boolean)
            .sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
    }, [gauges, stock, materialFilter]);

    const filtered = useMemo(() => stock.filter(i => {
        const gauge = gauges.find(g => g.materialType === i.materialType && g.gauge === i.bitola);
        const productCode = gauge?.productCode || '';

        const passesSearch = searchTerm.length > 0 ? (
            i.internalLot.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.nfe.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.steelType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            productCode.toLowerCase().includes(searchTerm.toLowerCase())
        ) : true;

        const passesMaterial = materialFilter === '' || i.materialType === materialFilter;
        const passesBitola = bitolaFilter === '' || i.bitola === bitolaFilter;
        
        if (statusFilter.length > 0) {
            return passesSearch && passesMaterial && passesBitola && statusFilter.includes(i.status);
        } else {
            if (searchTerm.length > 0) {
                return passesSearch && passesMaterial && passesBitola;
            }
            return i.status !== 'Consumido' && passesMaterial && passesBitola;
        }
    }).sort((a, b) => {
        const lotA = parseInt(a.internalLot.replace(/\D/g, '')) || 0;
        const lotB = parseInt(b.internalLot.replace(/\D/g, '')) || 0;
        
        if (isPrinting) {
            // Ordem Crescente para impressão
            if (lotA !== lotB) return lotA - lotB;
            return a.internalLot.localeCompare(b.internalLot);
        } else {
            // Ordem Decrescente para visualização em tela
            if (lotA !== lotB) return lotB - lotA;
            return b.internalLot.localeCompare(a.internalLot);
        }
    }), [stock, searchTerm, materialFilter, bitolaFilter, statusFilter, isPrinting]);

    const handlePrint = () => {
        setIsPrinting(true);
    };

    const stats = useMemo(() => {
        return filtered.reduce((acc, item) => ({
            count: acc.count + 1,
            weight: acc.weight + item.remainingQuantity
        }), { count: 0, weight: 0 });
    }, [filtered]);

    const handleRevertToAvailable = (item: StockItem) => {
        if (confirm(`Deseja voltar o lote ${item.internalLot} para status "Disponível"?`)) {
            const updated = {
                ...item,
                status: 'Disponível',
                history: [...(item.history || []), {
                    type: 'Status Revertido',
                    date: new Date().toISOString(),
                    details: {
                        'Ação': 'Retorno manual para Disponível',
                        'Status Anterior': item.status,
                        'Operador': currentUser?.username || 'Sistema'
                    }
                }]
            };
            updateStockItem(updated);
        }
    };

    if (isAdding) return <AddConferencePage onClose={() => setIsAdding(false)} onSubmit={addConference} stock={stock} onShowReport={setReportView} conferences={conferences} onEditConference={editConference} onDeleteConference={deleteConference} gauges={gauges} isGestor={isGestor} setPage={setPage} />;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {consumingItem && (
                <ConsumeLotModal
                    item={consumingItem}
                    onClose={() => setConsumingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setConsumingItem(null);
                    }}
                    currentUser={currentUser}
                />
            )}
            {/* Printable Report Header - Only visible during print */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">MSM <span className="text-slate-500 font-light">Gestão Inteligente</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Relatório de Inventário de Estoque - Setor Laminação</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-slate-500 font-medium italic">Sistema MSM Control</p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Material</p>
                            <p className="text-base font-black text-slate-800">{materialFilter || 'Todos'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Bitola</p>
                            <p className="text-base font-black text-slate-800">{bitolaFilter || 'Todas'}</p>
                        </div>
                        {bitolaFilter && gauges.find(g => g.gauge === bitolaFilter && (materialFilter === '' || g.materialType === materialFilter))?.productCode && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cód. Produto</p>
                                <p className="text-base font-black text-slate-800">
                                    {gauges.find(g => g.gauge === bitolaFilter && (materialFilter === '' || g.materialType === materialFilter))?.productCode}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                            <p className="text-base font-black text-slate-800 max-w-[150px] truncate">{statusFilter.length === 0 ? 'Todos' : statusFilter.join(', ')}</p>
                        </div>
                    </div>
                    <div className="flex gap-6 items-center text-center">
                        <div className="px-6 py-2 bg-white rounded-xl shadow-sm border border-slate-200/60">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Lotes</p>
                            <p className="text-3xl font-black text-slate-900">{stats.count}</p>
                        </div>
                        <div className="px-6 py-2 bg-blue-50 rounded-xl shadow-sm border border-blue-200">
                            <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-1">Peso Total</p>
                            <p className="text-3xl font-black text-blue-700 tracking-tight">{stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xl font-bold text-blue-500">kg</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {reportView && <ConferenceReport reportData={reportView} onClose={() => setReportView(null)} gauges={gauges} />}
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
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-6">
                    <h1 className="text-3xl font-bold text-slate-800 shrink-0 no-print">Estoque</h1>
                    <div className="hidden md:flex items-center gap-4 no-print grow">
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Material</label>
                            <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="bg-transparent outline-none font-bold text-sm min-w-[120px]">
                                <option value="">Todos</option>
                                {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Bitola</label>
                            <select value={bitolaFilter} onChange={e => setBitolaFilter(e.target.value)} className="bg-transparent outline-none font-bold text-sm min-w-[80px]">
                                <option value="">Todas</option>
                                {availableBitolas.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0 relative" ref={statusDesktopRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                            <button 
                                onClick={() => setIsStatusOpen(!isStatusOpen)}
                                className="bg-transparent outline-none font-bold text-sm min-w-[80px] text-left flex justify-between items-center"
                            >
                                <span className="truncate max-w-[100px]">{statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}</span>
                                <svg className="w-4 h-4 ml-1 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            {isStatusOpen && (
                                <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2 min-w-[200px]">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                        <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                        Todos
                                    </label>
                                    <hr className="my-1 border-slate-100" />
                                    {[
                                        { val: 'Disponível', label: 'Disponível' },
                                        { val: 'Disponível - Suporte Treliça', label: 'Suporte Treliça' },
                                        { val: 'Em Produção - Trefila', label: 'Em Prod. Trefila' },
                                        { val: 'Em Produção - Treliça', label: 'Em Prod. Treliça' },
                                        { val: 'Reservado', label: 'Reservado' },
                                        { val: 'Consumido', label: 'Consumido' }
                                    ].map(s => (
                                        <label key={s.val} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                            <input 
                                                type="checkbox" 
                                                checked={statusFilter.includes(s.val)} 
                                                onChange={e => {
                                                    if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                                    else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                                }} 
                                                className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                            />
                                            {s.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={handlePrint} className="bg-white text-slate-600 font-bold py-2 px-4 rounded-xl shadow border flex items-center gap-2 hover:bg-slate-50 transition mr-2">
                            <PrinterIcon className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-4 border-l pl-6 ml-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 border-b border-transparent">Lotes</span>
                                <span className="text-xl font-black text-slate-800">{stats.count}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kg Disponível</span>
                                <span className="text-xl font-black text-blue-600">{stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 no-print">
                    <button onClick={() => setPage('gaugesManager')} className="bg-white text-slate-600 font-bold py-2 px-6 rounded-lg shadow border flex items-center gap-2 hover:bg-slate-50 transition whitespace-nowrap"><AdjustmentsIcon className="h-5 w-5" /> Gerenciar Bitolas</button>
                    <button onClick={() => setIsAdding(true)} className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg shadow-lg shrink-0 whitespace-nowrap">+ Novo Recebimento</button>
                </div>
            </header>
            <div className="md:hidden flex flex-wrap gap-2 no-print p-2">
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-500">MP:</label>
                    <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="bg-transparent outline-none font-bold text-xs">
                        <option value="">Todos</option>
                        {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-500">Ø:</label>
                    <select value={bitolaFilter} onChange={e => setBitolaFilter(e.target.value)} className="bg-transparent outline-none font-bold text-xs">
                        <option value="">Todas</option>
                        {availableBitolas.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm relative" ref={statusMobileRef}>
                    <label className="text-[10px] font-bold text-slate-500">ST:</label>
                    <button 
                        onClick={() => setIsMobileStatusOpen(!isMobileStatusOpen)}
                        className="bg-transparent outline-none font-bold text-xs text-left"
                    >
                        {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}
                    </button>
                    {isMobileStatusOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 min-w-[200px] flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                Todos
                            </label>
                            <hr className="my-1 border-slate-100" />
                            {[
                                { val: 'Disponível', label: 'Disponível' },
                                { val: 'Disponível - Suporte Treliça', label: 'Sup. Treliça' },
                                { val: 'Em Produção - Trefila', label: 'Em Prod. Trefila' },
                                { val: 'Em Produção - Treliça', label: 'Em Prod. Treliça' },
                                { val: 'Reservado', label: 'Reservado' },
                                { val: 'Consumido', label: 'Consumido' }
                            ].map(s => (
                                <label key={s.val} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                    <input 
                                        type="checkbox" 
                                        checked={statusFilter.includes(s.val)} 
                                        onChange={e => {
                                            if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                            else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                        }} 
                                        className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                    />
                                    {s.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="no-print bg-white p-4 rounded-xl shadow border flex items-center gap-4">
                <SearchIcon className="h-5 w-5 text-slate-400" />
                <input type="text" placeholder="Buscar lote ou NFe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow outline-none" />
            </div>
            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
                            <tr>
                                <th className="p-3 text-center print:hidden">Data</th>
                                <th className="p-3 text-center">Lote Interno</th>
                                <th className="p-3 text-center">Tipo Aço</th>
                                <th className="p-3 text-center">Mat.</th>
                                <th className="p-3 text-center">Bitola</th>
                                <th className="p-3 text-center">Peso (kg)</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center no-print">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500 font-medium print:hidden">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-center font-black text-slate-900">{item.internalLot}</td>
                                    <td className="p-3 text-center font-bold text-slate-600">{item.steelType || '-'}</td>
                                    <td className="p-3 text-center text-slate-500">{item.materialType}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black text-blue-600">{item.bitola.replace('.', ',')}</span>
                                            {(() => {
                                                const gauge = gauges.find(g => g.materialType === item.materialType && g.gauge === item.bitola);
                                                return gauge?.productCode ? <span className="text-[9px] text-slate-500 font-black uppercase print:text-black">{gauge.productCode}</span> : null;
                                            })()}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-black text-slate-800">{item.remainingQuantity.toFixed(2)}</td>
                                    <td className="p-3 text-center">{getStatusBadge(item.status)}</td>
                                    <td className="p-3 flex justify-center gap-2 no-print">
                                        {(item.status.includes('Produção') || item.status === 'Reservado') && (
                                            <button onClick={() => handleRevertToAvailable(item)} title="Voltar para Disponível" className="p-1 hover:bg-emerald-50 rounded-lg transition-colors">
                                                <ArrowPathIcon className="h-5 w-5 text-emerald-500" />
                                            </button>
                                        )}
                                        <button onClick={() => setConsumingItem(item)} title="Dar Baixa (Consumir)" className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
                                            <DownloadIcon className="h-5 w-5 text-slate-400 hover:text-[#0F3F5C]" />
                                        </button>
                                        <button onClick={() => setHistoryLot(item)} title="Histórico" className="p-1 hover:bg-blue-50 rounded-lg transition-colors">
                                            <BookOpenIcon className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                        </button>
                                        <button onClick={() => setEditingItem(item)} title="Editar" className="p-1 hover:bg-amber-50 rounded-lg transition-colors">
                                            <PencilIcon className="h-5 w-5 text-slate-400 hover:text-amber-500" />
                                        </button>
                                        <button onClick={() => confirm('Excluir?') && deleteStockItem(item.id)} title="Excluir" className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                                            <TrashIcon className="h-5 w-5 text-red-400 hover:text-red-600" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Printable Report Footer */}
            <div className="hidden print:flex mt-12 justify-between items-end border-t border-dashed pt-8">
                <div className="flex flex-col gap-1">
                    <div className="w-48 h-px bg-slate-400"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Responsável pelo Estoque</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 italic">MSM - Tecnologia em Gestão de Produção</p>
                </div>
            </div>
        </div>
    );
};

const EditStockItemModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; gauges: StockGauge[] }> = ({ item, onClose, onSave, gauges }) => {
    const [formData, setFormData] = useState<StockItem>({ ...item });

    const materialGauges = useMemo(() => {
        const baseOptions = formData.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
        const customOptions = gauges.filter(g => g.materialType === formData.materialType).map(g => g.gauge);
        
        return [...new Set([...baseOptions, ...customOptions])]
            .filter(Boolean)
            .sort((a, b) => {
                const numA = parseFloat(a.replace(',', '.'));
                const numB = parseFloat(b.replace(',', '.'));
                return numA - numB;
            });
    }, [gauges, formData.materialType]);

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
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Aço</label>
                            <select value={formData.steelType || ''} onChange={e => setFormData({ ...formData, steelType: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">NFe</label>
                            <input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Corrida</label>
                            <input type="text" value={formData.runNumber || ''} onChange={e => setFormData({ ...formData, runNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Material</label>
                            <select
                                value={formData.materialType}
                                onChange={e => {
                                    const val = e.target.value;
                                    const base = val === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
                                    const custom = gauges.filter(g => g.materialType === val).map(g => g.gauge);
                                    const all = [...new Set([...base, ...custom])];
                                    
                                    setFormData(p => ({
                                        ...p,
                                        materialType: val,
                                        bitola: all.includes(p.bitola) ? p.bitola : (all[0] || '')
                                    }));
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Bitola</label>
                            <select value={formData.bitola} onChange={e => setFormData({ ...formData, bitola: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                {(() => {
                                    const baseGauges = formData.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
                                    const customGauges = gauges.filter(g => g.materialType === formData.materialType);
                                    
                                    const allOptions = [
                                        ...baseGauges.map(g => ({ gauge: g, code: '' })),
                                        ...customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }))
                                    ];

                                    const map = new Map();
                                    allOptions.forEach(opt => {
                                        const existing = map.get(opt.gauge);
                                        if (!existing || (opt.code && !existing.code)) {
                                            map.set(opt.gauge, opt);
                                        }
                                    });

                                    const uniqueOptions = Array.from(map.values())
                                        .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));

                                    return uniqueOptions.map(opt => (
                                        <option key={`${opt.gauge}-${opt.code}`} value={opt.gauge}>
                                            {opt.gauge.replace('.', ',')} {opt.code ? `(${opt.code})` : ''}
                                        </option>
                                    ));
                                })()}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Peso Atual (kg)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formData.remainingQuantity}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, remainingQuantity: parseInt(val) || 0 });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none no-spinner"
                                required
                            />
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

const ConsumeLotModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; currentUser: User | null }> = ({ item, onClose, onSave, currentUser }) => {
    const [formData, setFormData] = useState({
        weight: item.remainingQuantity,
        observation: '',
        reason: 'Uso na Produção'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newWeight = Math.max(0, item.remainingQuantity - formData.weight);
        
        const updated: StockItem = {
            ...item,
            remainingQuantity: newWeight,
            status: newWeight <= 0 ? 'Consumido' : item.status,
            history: [...(item.history || []), {
                type: 'Baixa de Lote',
                date: new Date().toISOString(),
                details: {
                    'Motivo': formData.reason,
                    'Peso Retirado': `${formData.weight.toFixed(2)} kg`,
                    'Peso Restante': `${newWeight.toFixed(2)} kg`,
                    'Observação': formData.observation || '-',
                    'Operador': currentUser?.username || 'Sistema'
                }
            }]
        };
        onSave(updated);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold">Dar Baixa no Lote</h2>
                        <p className="text-xs opacity-80">{item.internalLot} - {item.materialType} {item.bitola}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-800">Saldo Atual:</span>
                        <span className="text-xl font-black text-[#0F3F5C]">{item.remainingQuantity.toFixed(2)} kg</span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Quantidade para Baixar (kg)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={formData.weight} 
                            onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })} 
                            max={item.remainingQuantity}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                            required 
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Motivo / Destino</label>
                        <select 
                            value={formData.reason} 
                            onChange={e => setFormData({ ...formData, reason: e.target.value })} 
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                            <option value="Uso na Produção">Uso na Produção</option>
                            <option value="Uso para Treliça">Uso para Treliça</option>
                            <option value="Uso para Trefila">Uso para Trefila</option>
                            <option value="Correção de Inventário">Correção de Inventário</option>
                            <option value="Sucata / Perda">Sucata / Perda</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Observações Extras</label>
                        <textarea 
                            value={formData.observation} 
                            onChange={e => setFormData({ ...formData, observation: e.target.value })} 
                            placeholder="Ex: Utilizado para fazer treliça H12..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20">Confirmar Baixa</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockControl;
