import React, { useState, useEffect } from 'react';
import { fetchTable, insertItem, updateItem, deleteItem } from '../services/supabaseService';
import { TrelicaElectrodeStock, TrelicaElectrodeType } from '../types';
import { TrashIcon, PlusIcon, XIcon, SearchIcon, RefreshIcon, CheckCircleIcon } from './icons';

interface ElectrodeStockManagerProps {
    onClose: () => void;
    onStockUpdated?: () => void;
}

const STORAGE_KEY = 'trelica_electrodes_stock_cache';

const DEFAULT_INITIAL_STOCKS: TrelicaElectrodeStock[] = [
    {
        id: 'el-stock-1',
        lot_number: 'EL-SUP-2026-01',
        type: 'Superior',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 8,
        benchmark_lifespan_meters: 15000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Eletrodo chanfrado superior para banzos'
    },
    {
        id: 'el-stock-2',
        lot_number: 'EL-CEN-2026-01',
        type: 'Central Triangular',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 4,
        benchmark_lifespan_meters: 12000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Cunha triangular de apoio central com ranhura'
    },
    {
        id: 'el-stock-3',
        lot_number: 'EL-INF-2026-01',
        type: 'Inferior',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 6,
        benchmark_lifespan_meters: 15000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Eletrodo inferior para solda de banzos inferiores'
    },
    {
        id: 'el-stock-4',
        lot_number: 'EL-BAS-2026-01',
        type: 'Base',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 6,
        benchmark_lifespan_meters: 20000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Bloco de contato e condução da base'
    },
    {
        id: 'el-stock-5',
        lot_number: 'EL-SUP-RET-01',
        type: 'Superior',
        material: 'CuCrZr',
        quantity: 3,
        benchmark_lifespan_meters: 10000,
        supplier: 'Oficina Interna',
        status: 'retificado',
        notes: 'Retificado na ferramentaria (1ª retífica)'
    },
    {
        id: 'el-stock-6',
        lot_number: 'BAS-SUP-2026-01',
        type: 'Base Superior',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 4,
        benchmark_lifespan_meters: 25000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Base condutora para fixação do eletrodo superior'
    },
    {
        id: 'el-stock-7',
        lot_number: 'EL-LAT-2026-01',
        type: 'Lateral',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 6,
        benchmark_lifespan_meters: 15000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Pastilha de eletrodo lateral inferior'
    },
    {
        id: 'el-stock-8',
        lot_number: 'BAS-INF-2026-01',
        type: 'Base Inferior',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 4,
        benchmark_lifespan_meters: 25000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Base condutora para fixação do eletrodo inferior'
    },
    {
        id: 'el-stock-9',
        lot_number: 'BAS-LAT-2026-01',
        type: 'Base Lateral',
        material: 'CuCrZr (Cobre Cromo Zircônio)',
        quantity: 4,
        benchmark_lifespan_meters: 25000,
        supplier: 'Metalúrgica Ita Soldas',
        status: 'novo',
        notes: 'Base suporte de fixação do eletrodo lateral'
    }
];

export const DEFAULT_BENCHMARK_METERS: Record<TrelicaElectrodeType, number> = {
    'Superior': 15000,
    'Base Superior': 25000,
    'Central Triangular': 12000,
    'Inferior': 15000,
    'Base Inferior': 25000,
    'Lateral': 15000,
    'Base Lateral': 25000,
    'Base': 20000
};

export const getElectrodeTypePrefix = (type: TrelicaElectrodeType): string => {
    switch (type) {
        case 'Superior': return 'EL-SUP';
        case 'Base Superior': return 'BAS-SUP';
        case 'Central Triangular': return 'EL-CEN';
        case 'Inferior': return 'EL-INF';
        case 'Base Inferior': return 'BAS-INF';
        case 'Lateral': return 'EL-LAT';
        case 'Base Lateral': return 'BAS-LAT';
        case 'Base': return 'BAS-LAT';
        default: return 'EL';
    }
};

export const generateNextElectrodeLot = (
    type: TrelicaElectrodeType,
    existingStocks: TrelicaElectrodeStock[],
    condition: 'novo' | 'retificado' = 'novo'
): string => {
    const year = new Date().getFullYear();
    const prefix = getElectrodeTypePrefix(type);
    const basePrefix = condition === 'retificado' ? `${prefix}-RET` : `${prefix}-${year}`;

    let maxSeq = 0;
    existingStocks.forEach(s => {
        if (s.lot_number && s.lot_number.toUpperCase().startsWith(basePrefix)) {
            const parts = s.lot_number.split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum) && lastNum > maxSeq) {
                maxSeq = lastNum;
            }
        }
    });

    const nextSeq = String(maxSeq + 1).padStart(2, '0');
    return `${basePrefix}-${nextSeq}`;
};

export const getLocalElectrodeStock = (): TrelicaElectrodeStock[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as TrelicaElectrodeStock[];
            // Garante que tipos novos (como Base Superior, Base Inferior e Base Lateral) existam no estoque
            const hasBaseSup = parsed.some(s => s.type === 'Base Superior');
            const hasBaseInf = parsed.some(s => s.type === 'Base Inferior');
            const hasBaseLat = parsed.some(s => s.type === 'Base Lateral');
            const hasLateral = parsed.some(s => s.type === 'Lateral');
            if (!hasBaseSup || !hasBaseInf || !hasBaseLat || !hasLateral) {
                const missingDefaults = DEFAULT_INITIAL_STOCKS.filter(ds => !parsed.some(p => p.type === ds.type));
                const merged = [...parsed, ...missingDefaults];
                saveLocalElectrodeStock(merged);
                return merged;
            }
            return parsed;
        }
    } catch (e) {
        console.warn('Erro ao ler cache de eletrodos:', e);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_STOCKS));
    return DEFAULT_INITIAL_STOCKS;
};

export const saveLocalElectrodeStock = (stocks: TrelicaElectrodeStock[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
    } catch (e) {
        console.warn('Erro ao gravar cache de eletrodos:', e);
    }
};

const ElectrodeStockManager: React.FC<ElectrodeStockManagerProps> = ({ onClose, onStockUpdated }) => {
    const [stocks, setStocks] = useState<TrelicaElectrodeStock[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // Formulário de novo lote
    const [isAdding, setIsAdding] = useState(false);
    const [newLotNumber, setNewLotNumber] = useState('');
    const [newType, setNewType] = useState<TrelicaElectrodeType>('Superior');
    const [newMaterial, setNewMaterial] = useState('CuCrZr (Cobre Cromo Zircônio)');
    const [newQuantity, setNewQuantity] = useState(2);
    const [newBenchmarkMeters, setNewBenchmarkMeters] = useState(15000);
    const [newSupplier, setNewSupplier] = useState('');
    const [newCostUnit, setNewCostUnit] = useState<number | ''>('');
    const [newStatus, setNewStatus] = useState<'novo' | 'retificado'>('novo');
    const [newNotes, setNewNotes] = useState('');

    useEffect(() => {
        loadStock();
    }, []);

    const loadStock = async () => {
        setIsLoading(true);
        try {
            const data = await fetchTable<TrelicaElectrodeStock>('trelica_electrodes_stock');
            if (data && data.length > 0) {
                setStocks(data);
                saveLocalElectrodeStock(data);
            } else {
                const local = getLocalElectrodeStock();
                setStocks(local);
            }
        } catch (err) {
            console.warn('Usando armazenamento local para eletrodos:', err);
            setStocks(getLocalElectrodeStock());
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddLot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLotNumber.trim()) {
            alert('Informe o número do lote do eletrodo.');
            return;
        }

        const newLot: TrelicaElectrodeStock = {
            id: `el-${Date.now()}`,
            lot_number: newLotNumber.trim().toUpperCase(),
            type: newType,
            material: newMaterial.trim() || 'CuCrZr',
            quantity: Number(newQuantity) || 1,
            benchmark_lifespan_meters: Number(newBenchmarkMeters) || 15000,
            supplier: newSupplier.trim() || undefined,
            cost_unit: newCostUnit === '' ? undefined : Number(newCostUnit),
            status: newStatus,
            notes: newNotes.trim() || undefined,
            created_at: new Date().toISOString()
        };

        try {
            const added = await insertItem<TrelicaElectrodeStock>('trelica_electrodes_stock', newLot as any);
            const savedItem = added || newLot;
            const updatedList = [savedItem, ...stocks];
            setStocks(updatedList);
            saveLocalElectrodeStock(updatedList);
        } catch (err) {
            console.warn('Gravando lote localmente:', err);
            const updatedList = [newLot, ...stocks];
            setStocks(updatedList);
            saveLocalElectrodeStock(updatedList);
        }

        if (onStockUpdated) onStockUpdated();

        // Reset form
        setNewLotNumber('');
        setNewQuantity(2);
        setNewNotes('');
        setIsAdding(false);
    };

    const handleUpdateQuantity = async (id: string, delta: number) => {
        const item = stocks.find(s => s.id === id);
        if (!item) return;

        const newQty = Math.max(0, item.quantity + delta);
        const updatedList = stocks.map(s => s.id === id ? { ...s, quantity: newQty } : s);
        setStocks(updatedList);
        saveLocalElectrodeStock(updatedList);

        try {
            await updateItem<TrelicaElectrodeStock>('trelica_electrodes_stock', id, { quantity: newQty });
        } catch (err) {
            console.warn('Atualizado localmente:', err);
        }

        if (onStockUpdated) onStockUpdated();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja excluir este lote de eletrodos do estoque?')) return;
        const updatedList = stocks.filter(s => s.id !== id);
        setStocks(updatedList);
        saveLocalElectrodeStock(updatedList);

        try {
            await deleteItem('trelica_electrodes_stock', id);
        } catch (err) {
            console.warn('Excluído localmente:', err);
        }

        if (onStockUpdated) onStockUpdated();
    };

    const filteredStocks = stocks.filter(s => {
        const matchesSearch =
            s.lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.material || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || s.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const totalPieces = stocks.reduce((acc, s) => acc + (s.quantity || 0), 0);
    const lowStockCount = stocks.filter(s => s.quantity <= 2).length;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-3 sm:p-6 animate-fade-in">
            <div className="bg-[#0B1520] rounded-3xl border border-slate-700/60 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* Header do Almoxarifado de Eletrodos */}
                <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#0E1E2E] to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-black shadow-inner">
                            ⚡
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                    Estoque de Eletrodos de Solda (Treliças)
                                </h2>
                                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold uppercase">
                                    Almoxarifado
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Cadastro de lotes, saldo disponível e reposição para a cabeça de solda (7 eletrodos).
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                        title="Fechar"
                    >
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* KPIs e Filtros Rápidos */}
                <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
                            <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Total em Estoque</span>
                            <span className="text-xl font-black text-amber-300 font-mono">{totalPieces} un</span>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border ${lowStockCount > 0 ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-slate-800/80 border-slate-700 text-slate-300'}`}>
                            <span className="text-[10px] uppercase font-mono block font-bold">Estoque Crítico (≤ 2 un)</span>
                            <span className="text-xl font-black font-mono">{lowStockCount} lotes</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span>Cadastrar Novo Lote</span>
                        </button>
                    </div>
                </div>

                {/* Formulário de Adicionar Lote (Modal/Gaveta Embutida) */}
                {isAdding && (
                    <form onSubmit={handleAddLot} className="p-4 sm:p-6 bg-amber-950/20 border-b border-amber-500/30 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                                <span>➕ Entrada de Novo Lote de Eletrodos</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="text-slate-400 hover:text-white text-xs font-bold"
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Nº do Lote *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: EL-SUP-2026-02"
                                    value={newLotNumber}
                                    onChange={e => setNewLotNumber(e.target.value)}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold focus:border-amber-400 outline-none uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Tipo / Posição *</label>
                                <select
                                    value={newType}
                                    onChange={e => {
                                        const val = e.target.value as TrelicaElectrodeType;
                                        setNewType(val);
                                        if (val === 'Central Triangular') setNewBenchmarkMeters(12000);
                                        else if (val === 'Base' || val === 'Base Lateral') setNewBenchmarkMeters(20000);
                                        else if (val === 'Base Superior') setNewBenchmarkMeters(25000);
                                        else setNewBenchmarkMeters(15000);
                                    }}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:border-amber-400 outline-none"
                                >
                                    <option value="Superior">Eletrodo Superior (Ponta Esq ou Dir)</option>
                                    <option value="Base Superior">Base Superior (Porta-Eletrodo Esq ou Dir)</option>
                                    <option value="Central Triangular">Central Triangular (Cunha)</option>
                                    <option value="Inferior">Eletrodo Inferior (Ponta Esq ou Dir)</option>
                                    <option value="Base Inferior">Base Inferior (Porta-Eletrodo Inf Esq ou Dir)</option>
                                    <option value="Lateral">Lateral (Ponta Esq ou Dir)</option>
                                    <option value="Base Lateral">Base Lateral</option>
                                    <option value="Base">Base Geral</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Quantidade *</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={newQuantity}
                                    onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold focus:border-amber-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Condição *</label>
                                <select
                                    value={newStatus}
                                    onChange={e => setNewStatus(e.target.value as any)}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:border-amber-400 outline-none"
                                >
                                    <option value="novo">Novo (Fornecedor)</option>
                                    <option value="retificado">Retificado (Usinado)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Liga Metálica</label>
                                <input
                                    type="text"
                                    value={newMaterial}
                                    onChange={e => setNewMaterial(e.target.value)}
                                    placeholder="Ex: CuCrZr"
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Benchmark (Metros)</label>
                                <input
                                    type="number"
                                    step="1000"
                                    value={newBenchmarkMeters}
                                    onChange={e => setNewBenchmarkMeters(parseInt(e.target.value) || 15000)}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-amber-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Fornecedor</label>
                                <input
                                    type="text"
                                    value={newSupplier}
                                    onChange={e => setNewSupplier(e.target.value)}
                                    placeholder="Ex: Metalúrgica Ita"
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-bold">Observações</label>
                                <input
                                    type="text"
                                    value={newNotes}
                                    onChange={e => setNewNotes(e.target.value)}
                                    placeholder="Ex: Lote com tratamento térmico"
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-md"
                            >
                                Salvar Lote no Estoque
                            </button>
                        </div>
                    </form>
                )}

                {/* Barra de Filtros e Busca */}
                <div className="p-3 sm:px-6 bg-slate-900/40 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por lote, material ou fornecedor..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                        {['all', 'Superior', 'Base Superior', 'Central Triangular', 'Inferior', 'Base Inferior', 'Lateral', 'Base Lateral'].map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTypeFilter(t)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                                    typeFilter === t
                                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                            >
                                {t === 'all' ? 'Todos' : t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de Lotes em Estoque */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    {filteredStocks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p className="text-base font-bold">Nenhum lote de eletrodo encontrado.</p>
                            <p className="text-xs mt-1">Cadastre um novo lote acima para alimentar as máquinas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {filteredStocks.map(stock => {
                                const isLow = stock.quantity <= 2;
                                return (
                                    <div
                                        key={stock.id}
                                        className={`bg-slate-900/90 rounded-2xl p-4 border transition flex flex-col justify-between ${
                                            isLow ? 'border-amber-500/50 hover:border-amber-400' : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <span className="text-[10px] uppercase font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                                                        {stock.type}
                                                    </span>
                                                    <h4 className="text-base font-black text-white font-mono mt-1">
                                                        #{stock.lot_number}
                                                    </h4>
                                                </div>

                                                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                                                    stock.status === 'retificado' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                }`}>
                                                    {stock.status === 'retificado' ? 'Retificado' : 'Novo'}
                                                </span>
                                            </div>

                                            <div className="space-y-1 text-xs text-slate-400 mt-2">
                                                <p><strong className="text-slate-300">Material:</strong> {stock.material || 'CuCrZr'}</p>
                                                <p><strong className="text-slate-300">Benchmark:</strong> {stock.benchmark_lifespan_meters.toLocaleString('pt-BR')} metros</p>
                                                {stock.supplier && <p><strong className="text-slate-300">Fornecedor:</strong> {stock.supplier}</p>}
                                                {stock.notes && <p className="text-[11px] text-slate-500 italic mt-1">{stock.notes}</p>}
                                            </div>
                                        </div>

                                        {/* Saldo e Ações */}
                                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-400 font-bold uppercase">Saldo:</span>
                                                <span className={`text-xl font-black font-mono ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {stock.quantity}
                                                </span>
                                                <span className="text-[10px] text-slate-500 uppercase font-mono">un</span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(stock.id, -1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black text-sm flex items-center justify-center transition border border-slate-700 active:scale-95"
                                                    title="Diminuir saldo (-1)"
                                                >
                                                    -
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(stock.id, 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black text-sm flex items-center justify-center transition border border-slate-700 active:scale-95"
                                                    title="Aumentar saldo (+1)"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(stock.id)}
                                                    className="w-7 h-7 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 flex items-center justify-center transition border border-rose-800/40 ml-1 active:scale-95"
                                                    title="Excluir lote"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 sm:px-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                    <span>💡 Ao trocar um eletrodo na máquina, o sistema consome 1 unidade do lote selecionado.</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ElectrodeStockManager;
