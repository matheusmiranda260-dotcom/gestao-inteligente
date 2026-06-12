import React, { useState, useMemo } from 'react';
import type { Page, ProductionOrderData, ShiftReport, User, StockItem } from '../types';
import { ArrowLeftIcon, PencilIcon, WarningIcon, CheckCircleIcon, ChartBarIcon, ScaleIcon, ClockIcon, ClipboardListIcon, TrashIcon } from './icons';
import { EditShiftReportModal } from './ShiftReportsModal';

interface ProductionControlProps {
    machineCategory: 'Trefila' | 'Treliça';
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    shiftReports: ShiftReport[];
    currentUser: User | null;
    onUpdateReport: (reportId: string, updates: Partial<ShiftReport>) => Promise<void>;
    onDeleteReport?: (reportId: string) => Promise<void> | void;
    updateProductionOrder?: (orderId: string, updates: Partial<ProductionOrderData>) => Promise<void> | void;
    stock: StockItem[];
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
        // Manual formatting to avoid time zone shifts and handle ISO timestamps
        if (dateStr.includes('T')) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
        
        // If it's a simple YYYY-MM-DD
        const parts = dateStr.split(' ')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        return d.toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
};

const formatShiftDate = (report: ShiftReport) => {
    const rawDate = report.date || report.shiftStartTime;
    if (!rawDate) return '—';
    
    // Check if rawDate is an ISO/timestamp string
    if (rawDate.includes('T') || rawDate.includes(':')) {
        return formatDate(rawDate);
    }
    
    const parts = rawDate.split(' ')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return rawDate;
};

const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'ativa' || s === 'in_progress') {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 uppercase tracking-wider">
                Em Produção
            </span>
        );
    }
    if (s === 'finalizado' || s === 'completed') {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">
                Concluída
            </span>
        );
    }
    if (s === 'pending' || s === 'inativa') {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                Pendente
            </span>
        );
    }
    if (s === 'paused') {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 uppercase tracking-wider">
                Pausada
            </span>
        );
    }
    if (s === 'cancelada' || s === 'cancelled') {
        return (
            <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 uppercase tracking-wider">
                Cancelada
            </span>
        );
    }
    return (
        <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 uppercase tracking-wider">
            {status}
        </span>
    );
};

const ProductionControl: React.FC<ProductionControlProps> = ({
    machineCategory,
    setPage,
    productionOrders,
    shiftReports,
    currentUser,
    onUpdateReport,
    onDeleteReport,
    updateProductionOrder,
    stock
}) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'other'>('all');
    const [editingReport, setEditingReport] = useState<ShiftReport | null>(null);

    const handleRecalculateTotals = async () => {
        if (!selectedOrder || !updateProductionOrder) return;
        if (!confirm('Deseja recalcular os totais produzidos desta Ordem de Produção com base na soma dos relatórios de turno atuais?')) return;
        
        try {
            const totalQty = reportsForSelectedOrder.reduce((sum, r) => sum + (r.totalProducedQuantity || 0), 0);
            const totalWeight = reportsForSelectedOrder.reduce((sum, r) => sum + (r.totalProducedWeight || 0), 0);

            await updateProductionOrder(selectedOrder.id, {
                actualProducedQuantity: totalQty,
                actualProducedWeight: totalWeight
            });
            alert("Totais da Ordem de Produção recalculados com sucesso!");
        } catch (error: any) {
            console.error("Erro ao recalcular totais:", error);
            alert(`Erro ao recalcular totais: ${error.message || error}`);
        }
    };

    // 1. Filter orders by machine category (Trefila starts with 'Trefila', Treliça starts with 'Treliça')
    const filteredOrders = useMemo(() => {
        return productionOrders.filter(order => {
            const matchesMachine = order.machine?.toLowerCase().startsWith(machineCategory.toLowerCase());
            if (!matchesMachine) return false;

            const matchesSearch = order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.trelicaModel && order.trelicaModel.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (order.targetBitola && order.targetBitola.toLowerCase().includes(searchQuery.toLowerCase()));
            if (!matchesSearch) return false;

            const s = order.status?.toLowerCase();
            if (statusFilter === 'active') {
                return s === 'ativa' || s === 'in_progress';
            }
            if (statusFilter === 'completed') {
                return s === 'finalizado' || s === 'completed';
            }
            if (statusFilter === 'other') {
                return s !== 'ativa' && s !== 'in_progress' && s !== 'finalizado' && s !== 'completed';
            }
            return true;
        }).sort((a, b) => b.orderNumber.localeCompare(a.orderNumber)); // Sort by order number desc
    }, [productionOrders, machineCategory, searchQuery, statusFilter]);

    // Get currently selected order
    const selectedOrder = useMemo(() => {
        return productionOrders.find(o => o.id === selectedOrderId) || null;
    }, [productionOrders, selectedOrderId]);

    // Get shift reports for selected order
    const reportsForSelectedOrder = useMemo(() => {
        if (!selectedOrder) return [];
        return shiftReports
            .filter(r => r.productionOrderId === selectedOrder.id)
            .sort((a, b) => {
                const dateA = a.date || a.shiftStartTime || '';
                const dateB = b.date || b.shiftStartTime || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime(); // Newest first
            });
    }, [shiftReports, selectedOrder]);

    // Math stats for selected order
    const stats = useMemo(() => {
        if (!selectedOrder) return null;

        const isTrefila = machineCategory === 'Trefila';
        const meta = isTrefila 
            ? (selectedOrder.totalWeight || 0)
            : (selectedOrder.quantityToProduce || 0);

        const actual = isTrefila
            ? (selectedOrder.actualProducedWeight || 0)
            : (selectedOrder.actualProducedQuantity || 0);

        const unit = isTrefila ? 'kg' : 'peças';
        
        // Sum scrap from all reports of this order
        const totalScrap = reportsForSelectedOrder.reduce((sum, r) => sum + (r.totalScrapWeight || 0), 0);

        const progressPercent = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
        
        // Calculate scrap rate: Scrap Weight / (Produced Weight or weight equivalent)
        const totalProducedWeightEq = reportsForSelectedOrder.reduce((sum, r) => sum + (r.totalProducedWeight || 0), 0);
        const scrapPercent = totalProducedWeightEq > 0 
            ? ((totalScrap / totalProducedWeightEq) * 100).toFixed(1)
            : '0.0';

        return {
            meta,
            actual,
            unit,
            progressPercent,
            totalScrap,
            scrapPercent
        };
    }, [selectedOrder, reportsForSelectedOrder, machineCategory]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 md:p-8 flex flex-col gap-6 animate-fade-in">
            {/* Header / Top Navbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                    <button
                        onClick={() => setPage('menu')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-black uppercase text-xs tracking-widest transition-all mb-2"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Voltar ao Menu
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        Controle de Produção – <span className="text-indigo-600">{machineCategory}</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Acompanhe o progresso de ordens de produção e ajuste os lançamentos retroativos dos turnos.
                    </p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Order Listing (4 cols) */}
                <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar por OP, Bitola ou Modelo..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-800 text-sm font-semibold rounded-2xl px-4 py-3 pl-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
                            />
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                                🔍
                            </div>
                        </div>

                        {/* Status Filters Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {(['all', 'active', 'completed', 'other'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setStatusFilter(tab)}
                                    className={`flex-1 text-center py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                                        statusFilter === tab 
                                            ? 'bg-white text-slate-800 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {tab === 'all' ? 'Todas' :
                                     tab === 'active' ? 'Ativas' :
                                     tab === 'completed' ? 'Concluídas' : 'Outros'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                        {filteredOrders.length > 0 ? (
                            filteredOrders.map(order => {
                                const isSelected = selectedOrderId === order.id;
                                const isTrefila = machineCategory === 'Trefila';
                                const oMeta = isTrefila 
                                    ? (order.totalWeight || 0)
                                    : (order.quantityToProduce || 0);
                                const oActual = isTrefila
                                    ? (order.actualProducedWeight || 0)
                                    : (order.actualProducedQuantity || 0);
                                const oUnit = isTrefila ? 'kg' : 'pçs';
                                const oPercent = oMeta > 0 ? Math.min(100, Math.round((oActual / oMeta) * 100)) : 0;

                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => setSelectedOrderId(order.id)}
                                        className={`w-full p-5 text-left transition-all flex flex-col gap-3 hover:bg-slate-50 ${
                                            isSelected ? 'bg-indigo-50/40 border-l-4 border-indigo-600' : ''
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-lg">
                                                    OP {order.orderNumber}
                                                </h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {order.trelicaModel ? `${order.trelicaModel} • ` : ''}{order.targetBitola} mm
                                                </p>
                                            </div>
                                            {getStatusBadge(order.status)}
                                        </div>

                                        {/* Progress row */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                                <span>Progresso: {oActual.toLocaleString('pt-BR')} / {oMeta.toLocaleString('pt-BR')} {oUnit}</span>
                                                <span className={oPercent >= 100 ? 'text-green-600 font-extrabold' : ''}>{oPercent}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        oPercent >= 100 
                                                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                                                            : 'bg-indigo-600'
                                                    }`}
                                                    style={{ width: `${oPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                                            <span>Máquina: {order.machine}</span>
                                            <span>Iniciada em: {formatDate(order.startTime)}</span>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-slate-400 font-bold">
                                Nenhum ordem encontrada com os filtros selecionados.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Order Details & Shift History (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    {selectedOrder ? (
                        <>
                            {/* Card 1: Details and KPIs */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                                Detalhes da OP {selectedOrder.orderNumber}
                                            </h2>
                                            {getStatusBadge(selectedOrder.status)}
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">
                                            Especificações técnicas e acompanhamento geral da execução.
                                        </p>
                                    </div>
                                    {isGestor && updateProductionOrder && (
                                        <button
                                            onClick={handleRecalculateTotals}
                                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm"
                                            title="Recalcular totais da OP com base nos turnos"
                                        >
                                            🔄 Recalcular Totais
                                        </button>
                                    )}
                                </div>

                                {/* Specifications Info Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Máquina</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{selectedOrder.machine}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Bitola</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{selectedOrder.targetBitola} mm</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{selectedOrder.trelicaModel || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador Responsável</span>
                                        <span className="font-extrabold text-slate-800 text-sm">
                                            {selectedOrder.operator || (reportsForSelectedOrder.length > 0 ? reportsForSelectedOrder[reportsForSelectedOrder.length - 1]?.operator : '—')}
                                        </span>
                                    </div>
                                </div>

                                {/* KPIs Grid */}
                                {stats && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {/* Target Card */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Meta</span>
                                            <span className="text-xl font-extrabold text-slate-800 block">
                                                {stats.meta.toLocaleString('pt-BR')}
                                            </span>
                                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stats.unit}</span>
                                        </div>

                                        {/* Produced Card */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Produzido</span>
                                            <span className="text-xl font-extrabold text-indigo-600 block">
                                                {stats.actual.toLocaleString('pt-BR')}
                                            </span>
                                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stats.unit}</span>
                                        </div>

                                        {/* Progress Card */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Progresso</span>
                                            <span className="text-xl font-extrabold text-emerald-600 block">
                                                {stats.progressPercent}%
                                            </span>
                                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">da meta</span>
                                        </div>

                                        {/* Scrap Card */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sucata</span>
                                            <span className="text-xl font-extrabold text-rose-500 block">
                                                {stats.totalScrap.toFixed(1)} kg
                                            </span>
                                            <span className="text-xs text-slate-500 font-bold tracking-wider">{stats.scrapPercent}% do total</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Shift Reports Timeline (Evolution) */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                        Evolução da Produção (Histórico de Turnos)
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Lançamentos diários e turnos que atuaram nesta ordem.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {reportsForSelectedOrder.length > 0 ? (
                                        reportsForSelectedOrder.map((report) => (
                                            <div 
                                                key={report.id} 
                                                className="relative bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 transition-all"
                                            >
                                                {/* Left: Shift Info */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                                            📅 {formatShiftDate(report)}
                                                        </span>
                                                        <span className="px-2.5 py-0.5 text-[10px] font-black bg-indigo-100 text-indigo-700 rounded-md uppercase tracking-wider">
                                                            {report.operator ? `Turno` : 'Lançamento'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Description/Specs */}
                                                    <div className="text-xs text-slate-600 space-y-0.5">
                                                        <p><strong>Operador:</strong> {report.operator || 'Não informado'}</p>
                                                        <div className="flex gap-4 flex-wrap text-slate-500">
                                                            {machineCategory === 'Treliça' ? (
                                                                <>
                                                                    <span><strong>Produzido:</strong> {report.totalProducedQuantity?.toLocaleString('pt-BR') || 0} peças</span>
                                                                    {report.totalProducedMeters && report.totalProducedMeters > 0 ? (
                                                                        <span><strong>Metragem:</strong> {report.totalProducedMeters.toFixed(1)} m</span>
                                                                    ) : null}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span><strong>Produzido:</strong> {report.totalProducedWeight?.toLocaleString('pt-BR') || 0} kg</span>
                                                                </>
                                                            )}
                                                            <span><strong>Sucata:</strong> {report.totalScrapWeight?.toFixed(1) || 0} kg</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Adjust Action (Gestor Only) */}
                                                <div className="flex items-center gap-2 self-end sm:self-center">
                                                    {isGestor ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setEditingReport(report)}
                                                                className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm"
                                                                title="Ajustar Lançamento do Turno"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" /> Ajustar Lançamento
                                                            </button>
                                                            {onDeleteReport && (
                                                                <button
                                                                    onClick={() => onDeleteReport(report.id)}
                                                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm"
                                                                    title="Excluir Lançamento do Turno"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" /> Excluir
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                                                            Apenas Gestores
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                                            <WarningIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            <p className="font-extrabold text-slate-500">Nenhum turno registrado</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Esta ordem ainda não possui relatórios de turno encerrados.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[50vh] gap-4">
                            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-slate-200">
                                <ClipboardListIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-800">Nenhuma Ordem Selecionada</h3>
                                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                                    Selecione uma ordem de produção na lista ao lado para visualizar os detalhes, KPIs e a linha do tempo da evolução.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Editing Modal (Rendered when gestor selects a report to adjust) */}
            {editingReport && (
                <EditShiftReportModal
                    report={editingReport}
                    onClose={() => setEditingReport(null)}
                    onSave={onUpdateReport}
                />
            )}
        </div>
    );
};

export default ProductionControl;
