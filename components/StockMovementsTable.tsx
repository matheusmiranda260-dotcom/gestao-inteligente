import React, { useMemo, useState } from 'react';
import type { StockItem, ConferenceData } from '../types';
import { SearchIcon, DocumentTextIcon, PrinterIcon } from './icons';

export interface StockMovementRecord {
    id: number;
    rawDate: number;
    dateFormatted: string;
    internalLot: string;
    runNumber?: string;
    materialType: string;
    bitola: string;
    steelType?: string;
    type: 'Entrada Compra' | 'Saída Produção' | 'Transferência' | 'Devolução / Retorno' | 'Ajuste';
    locationFrom: string;
    locationTo: string;
    quantity: number;
    unit: string;
    responsible: string;
    status: 'Confirmado' | 'Pendente';
    stockItem?: StockItem;
    notes?: string;
}

interface StockMovementsTableProps {
    stock: StockItem[];
    conferences?: ConferenceData[];
    materialFilter: string;
    bitolaFilter: string;
    steelTypeFilter: string;
    searchTerm: string;
    onSelectLot?: (lot: StockItem) => void;
}

export const StockMovementsTable: React.FC<StockMovementsTableProps> = ({
    stock,
    conferences = [],
    materialFilter,
    bitolaFilter,
    steelTypeFilter,
    searchTerm,
    onSelectLot
}) => {
    const [movementTypeFilter, setMovementTypeFilter] = useState<'Todos' | 'Entradas' | 'Saídas'>('Todos');
    const [localSearch, setLocalSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Mapeamento de conferências para extrair operador e fornecedor
    const conferenceMap = useMemo(() => {
        const map = new Map<string, ConferenceData>();
        conferences.forEach(c => {
            if (c.conferenceNumber) {
                map.set(c.conferenceNumber.trim(), c);
            }
        });
        return map;
    }, [conferences]);

    // Compilação de todas as movimentações a partir do estoque
    const allMovements = useMemo(() => {
        const list: Omit<StockMovementRecord, 'id'>[] = [];

        stock.forEach(item => {
            const conf = item.conferenceNumber ? conferenceMap.get(item.conferenceNumber.trim()) : undefined;
            const itemUnit = item.materialType === 'Eletrodos Treliças' 
                ? 'un' 
                : item.materialType === 'Treliça' 
                    ? 'kg' 
                    : 'kg';

            // 1. MOVIMENTAÇÃO DE ENTRADA (Recebimento / NF / Compra)
            const entryDateStr = item.entryDate || (conf?.entryDate) || (conf?.date) || '';
            const entryTimestamp = entryDateStr ? new Date(entryDateStr).getTime() : 0;
            const initialQty = item.labelWeight || item.initialQuantity || item.weight || item.remainingQuantity || 0;

            if (initialQty > 0) {
                const dateObj = entryTimestamp ? new Date(entryTimestamp) : new Date();
                list.push({
                    rawDate: entryTimestamp || 0,
                    dateFormatted: dateObj.toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    }),
                    internalLot: item.internalLot,
                    runNumber: item.runNumber,
                    materialType: item.materialType,
                    bitola: item.bitola,
                    steelType: item.steelType,
                    type: 'Entrada Compra',
                    locationFrom: item.supplier || conf?.supplier || 'Fornecedor',
                    locationTo: item.materialType === 'Treliça' 
                        ? 'Estoque Treliças' 
                        : item.materialType === 'Eletrodos Treliças' 
                            ? 'Estoque Eletrodos' 
                            : item.materialType === 'Sabão'
                                ? 'Almoxarifado Sabão'
                                : 'Estoque Matéria-Prima',
                    quantity: initialQty,
                    unit: itemUnit,
                    responsible: conf?.operator || 'Recepção / Almoxarifado',
                    status: 'Confirmado',
                    stockItem: item,
                    notes: item.nfe ? `NF-e ${item.nfe}` : conf?.nfe ? `NF-e ${conf.nfe}` : ''
                });
            }

            // 2. MOVIMENTAÇÕES DE BAIXA / SAÍDA / RETORNO a partir do histórico
            let totalHistoryDeduction = 0;

            if (item.history && Array.isArray(item.history)) {
                item.history.forEach((h: any) => {
                    const hTimestamp = h.date ? new Date(h.date).getTime() : entryTimestamp + 1000;
                    const dateObj = new Date(hTimestamp);
                    const formatted = dateObj.toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    });

                    // Caso A: Baixa manual de lote
                    if (h.type === 'Baixa de Lote') {
                        const rawWeightStr = h.details?.['Peso Retirado'] || h.details?.weight || '0';
                        const deductedQty = parseFloat(String(rawWeightStr).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        totalHistoryDeduction += deductedQty;

                        list.push({
                            rawDate: hTimestamp,
                            dateFormatted: formatted,
                            internalLot: item.internalLot,
                            runNumber: item.runNumber,
                            materialType: item.materialType,
                            bitola: item.bitola,
                            steelType: item.steelType,
                            type: 'Saída Produção',
                            locationFrom: 'Estoque Matéria-Prima',
                            locationTo: h.details?.['Motivo'] || 'Linha de Produção',
                            quantity: deductedQty,
                            unit: itemUnit,
                            responsible: h.details?.['Operador'] || 'Operador Produção',
                            status: 'Confirmado',
                            stockItem: item,
                            notes: h.details?.['Observação'] || ''
                        });
                    }
                    // Caso B: Transformação em CA-60 (apontamento de trefila)
                    else if (h.type === 'Transformado em CA-60') {
                        const rawWeightStr = h.details?.['Peso Final (kg)'] || h.details?.weight || item.remainingQuantity;
                        const qty = parseFloat(String(rawWeightStr).replace(/[^\d.,]/g, '').replace(',', '.')) || item.remainingQuantity;
                        
                        list.push({
                            rawDate: hTimestamp,
                            dateFormatted: formatted,
                            internalLot: item.internalLot,
                            runNumber: item.runNumber,
                            materialType: item.materialType,
                            bitola: item.bitola,
                            steelType: item.steelType,
                            type: 'Saída Produção',
                            locationFrom: 'Estoque Fio Máquina',
                            locationTo: h.details?.['Ordem'] ? `Trefilação (${h.details['Ordem']})` : 'Linha Trefilação',
                            quantity: qty,
                            unit: 'kg',
                            responsible: h.details?.['Operador'] || 'Operador Trefila',
                            status: 'Confirmado',
                            stockItem: item,
                            notes: `Transformado para ${h.details?.['Bitola Final'] || 'CA-60'}`
                        });
                    }
                    // Caso C: Reversão de status ou cancelamento
                    else if (h.type === 'Status Revertido' || h.type === 'Ordem Cancelada') {
                        list.push({
                            rawDate: hTimestamp,
                            dateFormatted: formatted,
                            internalLot: item.internalLot,
                            runNumber: item.runNumber,
                            materialType: item.materialType,
                            bitola: item.bitola,
                            steelType: item.steelType,
                            type: 'Devolução / Retorno',
                            locationFrom: h.details?.['Status Anterior'] || h.details?.['Ordem'] || 'Produção',
                            locationTo: 'Estoque Disponível',
                            quantity: item.remainingQuantity,
                            unit: itemUnit,
                            responsible: h.details?.['Operador'] || 'Sistema',
                            status: 'Confirmado',
                            stockItem: item,
                            notes: h.details?.['Ação'] || h.type
                        });
                    }
                });
            }

            // Fallback de baixa implícita (se o saldo restante for menor que o inicial e não houver histórico)
            const remaining = item.remainingQuantity ?? 0;
            if (initialQty > remaining && totalHistoryDeduction === 0) {
                const diff = initialQty - remaining;
                const fallbackTime = item.lastMovement ? new Date(item.lastMovement).getTime() : entryTimestamp + 60000;
                const dateObj = new Date(fallbackTime);

                list.push({
                    rawDate: fallbackTime,
                    dateFormatted: dateObj.toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    }),
                    internalLot: item.internalLot,
                    runNumber: item.runNumber,
                    materialType: item.materialType,
                    bitola: item.bitola,
                    steelType: item.steelType,
                    type: 'Saída Produção',
                    locationFrom: 'Estoque Matéria-Prima',
                    locationTo: item.status === 'Consumido' ? 'Consumo Total' : 'Produção',
                    quantity: diff,
                    unit: itemUnit,
                    responsible: 'Operador Produção',
                    status: 'Confirmado',
                    stockItem: item,
                    notes: `Consumo registrado (Saldo: ${remaining.toFixed(2)} ${itemUnit})`
                });
            }
        });

        // Ordenação cronológica base para atribuir IDs sequenciais crescentes estáveis
        list.sort((a, b) => a.rawDate - b.rawDate);

        // Atribui ID sequencial #10, #11, #12... igual ao print
        return list.map((mov, idx) => ({
            ...mov,
            id: idx + 1
        }));
    }, [stock, conferenceMap]);

    // Filtragem em tempo real sincronizada com a tabela superior
    const filteredMovements = useMemo(() => {
        return allMovements.filter(mov => {
            // 1. Filtro de Material (superior)
            if (materialFilter) {
                const movMat = (mov.materialType || '').toLowerCase().trim();
                const filterMat = materialFilter.toLowerCase().trim();
                if (filterMat === 'eletrodos treliças') {
                    if (!movMat.includes('eletrodo')) return false;
                } else if (filterMat === 'sabão') {
                    if (!movMat.includes('sabão') && !movMat.includes('sabao')) return false;
                } else if (filterMat === 'treliça') {
                    if (!movMat.includes('treliça') && !movMat.includes('trelica')) return false;
                } else if (movMat !== filterMat) {
                    return false;
                }
            }

            // 2. Filtro de Bitola (superior)
            if (bitolaFilter) {
                const movBitola = String(mov.bitola || '').toLowerCase().replace(/\s+/g, '');
                const filterBitola = String(bitolaFilter).toLowerCase().replace(/\s+/g, '');
                if (!movBitola.includes(filterBitola) && !filterBitola.includes(movBitola)) {
                    // Também confere se é modelo de treliça/eletrodo
                    const code = (mov.stockItem?.productCode || '').toLowerCase().replace(/\s+/g, '');
                    if (!code.includes(filterBitola)) return false;
                }
            }

            // 3. Filtro de Aço (superior)
            if (steelTypeFilter && mov.steelType) {
                if (mov.steelType !== steelTypeFilter) return false;
            }

            // 4. Busca Superior (searchTerm)
            if (searchTerm) {
                const term = searchTerm.toLowerCase().trim();
                const matchLot = String(mov.internalLot || '').toLowerCase().includes(term);
                const matchRun = String(mov.runNumber || '').toLowerCase().includes(term);
                const matchFrom = String(mov.locationFrom || '').toLowerCase().includes(term);
                const matchTo = String(mov.locationTo || '').toLowerCase().includes(term);
                const matchResp = String(mov.responsible || '').toLowerCase().includes(term);
                const matchBitola = String(mov.bitola || '').toLowerCase().includes(term);
                const matchNotes = String(mov.notes || '').toLowerCase().includes(term);
                if (!matchLot && !matchRun && !matchFrom && !matchTo && !matchResp && !matchBitola && !matchNotes) {
                    return false;
                }
            }

            // 5. Busca Local Rápida
            if (localSearch) {
                const term = localSearch.toLowerCase().trim();
                const matchLot = String(mov.internalLot || '').toLowerCase().includes(term);
                const matchRun = String(mov.runNumber || '').toLowerCase().includes(term);
                const matchFrom = String(mov.locationFrom || '').toLowerCase().includes(term);
                const matchTo = String(mov.locationTo || '').toLowerCase().includes(term);
                const matchResp = String(mov.responsible || '').toLowerCase().includes(term);
                if (!matchLot && !matchRun && !matchFrom && !matchTo && !matchResp) {
                    return false;
                }
            }

            // 6. Filtro local de Tipo (Entradas / Saídas / Todos)
            if (movementTypeFilter === 'Entradas') {
                if (mov.type !== 'Entrada Compra') return false;
            } else if (movementTypeFilter === 'Saídas') {
                if (mov.type !== 'Saída Produção') return false;
            }

            return true;
        });
    }, [allMovements, materialFilter, bitolaFilter, steelTypeFilter, searchTerm, localSearch, movementTypeFilter]);

    // Ordenação (padrão Data ↓ decrescente com desempate estável por Lote)
    const sortedMovements = useMemo(() => {
        const sorted = [...filteredMovements];
        sorted.sort((a, b) => {
            if (b.rawDate !== a.rawDate) {
                return sortOrder === 'desc' ? b.rawDate - a.rawDate : a.rawDate - b.rawDate;
            }
            return sortOrder === 'desc' 
                ? String(b.internalLot).localeCompare(String(a.internalLot), undefined, { numeric: true })
                : String(a.internalLot).localeCompare(String(b.internalLot), undefined, { numeric: true });
        });
        return sorted;
    }, [filteredMovements, sortOrder]);

    // Paginação
    const totalPages = Math.max(1, Math.ceil(sortedMovements.length / pageSize));
    const paginatedMovements = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedMovements.slice(start, start + pageSize);
    }, [sortedMovements, currentPage, pageSize]);

    // Totais do extrato filtrado
    const summary = useMemo(() => {
        let totalIn = 0;
        let totalOut = 0;
        filteredMovements.forEach(m => {
            if (m.type === 'Entrada Compra') totalIn += m.quantity;
            if (m.type === 'Saída Produção') totalOut += m.quantity;
        });
        return { totalIn, totalOut, count: filteredMovements.length };
    }, [filteredMovements]);

    // Função para exportar CSV com numeração sequencial
    const exportCSV = () => {
        const headers = ['ID', 'Data', 'Lote', 'Corrida', 'Material', 'Bitola', 'Tipo', 'Origem', 'Destino', 'Quantidade', 'Unidade', 'Responsavel', 'Status', 'Observacao'];
        const rows = sortedMovements.map((m, idx) => [
            idx + 1,
            m.dateFormatted,
            `"${m.internalLot}"`,
            `"${m.runNumber || ''}"`,
            `"${m.materialType}"`,
            `"${m.bitola}"`,
            `"${m.type}"`,
            `"${m.locationFrom}"`,
            `"${m.locationTo}"`,
            m.quantity.toFixed(2),
            m.unit,
            `"${m.responsible}"`,
            `"${m.status}"`,
            `"${m.notes || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `movimentacoes_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all animate-in fade-in duration-300">
            {/* Header da Seção de Movimentações */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0F3F5C]/10 border border-[#0F3F5C]/20 flex items-center justify-center text-[#0F3F5C] font-black text-lg">
                            📋
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Histórico de Movimentações</h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0F3F5C] text-white">
                                    {filteredMovements.length} {filteredMovements.length === 1 ? 'registro' : 'registros'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {materialFilter || bitolaFilter || searchTerm ? (
                                    <span>
                                        Filtrado por: <strong className="text-slate-700">{materialFilter || 'Todos os Materiais'}</strong>
                                        {bitolaFilter ? ` • ${bitolaFilter}` : ''}
                                        {searchTerm ? ` • Busca: "${searchTerm}"` : ''}
                                    </span>
                                ) : (
                                    'Exibindo todas as movimentações de recebimento, saída e consumo do estoque.'
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Resumo Rápido de Entradas e Saídas */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[11px] font-bold text-emerald-800 uppercase">Entradas:</span>
                            <span className="text-xs font-black text-emerald-700">
                                {summary.totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                            </span>
                        </div>
                        <div className="px-3 py-1.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="text-[11px] font-bold text-rose-800 uppercase">Saídas:</span>
                            <span className="text-xs font-black text-rose-700">
                                {summary.totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg
                            </span>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 ml-auto lg:ml-2 no-print">
                            <button
                                onClick={() => window.print()}
                                title="Imprimir Histórico"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                            >
                                <PrinterIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={exportCSV}
                                title="Exportar CSV"
                                className="px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition flex items-center gap-1.5 shadow-sm"
                            >
                                <DocumentTextIcon className="w-4 h-4 text-emerald-600" />
                                <span>Exportar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Linha de Filtros Locais (Tipo e Busca Interna) */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                        {(['Todos', 'Entradas', 'Saídas'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => {
                                    setMovementTypeFilter(type);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                                    movementTypeFilter === type
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {type === 'Todos' && 'Todas'}
                                {type === 'Entradas' && '🟢 Entradas Compra'}
                                {type === 'Saídas' && '🔴 Saídas Produção'}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 max-w-xs">
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={e => {
                                setLocalSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Buscar por lote, corrida, local..."
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0F3F5C] outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Tabela com Estilo Idêntico ao Print do Usuário */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead className="bg-[#F8FAFC] text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="p-3.5 pl-5 font-bold w-16 text-slate-400">ID</th>
                            <th 
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition select-none group"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>Data</span>
                                    {sortOrder === 'desc' ? (
                                        <span className="text-[#0F3F5C] font-black text-xs">↓</span>
                                    ) : (
                                        <span className="text-[#0F3F5C] font-black text-xs">↑</span>
                                    )}
                                </div>
                            </th>
                            <th className="p-3.5">Lote</th>
                            <th className="p-3.5">Material / Bitola</th>
                            <th className="p-3.5">Tipo</th>
                            <th className="p-3.5">Localização De</th>
                            <th className="p-3.5">Localização Para</th>
                            <th className="p-3.5 text-right font-black">Quantidade</th>
                            <th className="p-3.5">Responsável</th>
                            <th className="p-3.5 text-center pr-5">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                        {paginatedMovements.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-12 text-center text-slate-400">
                                    <div className="max-w-sm mx-auto">
                                        <p className="text-3xl mb-2">🔍</p>
                                        <p className="font-bold text-slate-600 text-sm">Nenhuma movimentação encontrada</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Tente alterar os filtros superiores ou a busca para localizar outros materiais.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedMovements.map((mov, idx) => {
                                const rowId = (currentPage - 1) * pageSize + idx + 1;
                                return (
                                    <tr 
                                        key={`${rowId}-${mov.internalLot}-${mov.rawDate}`}
                                        className="hover:bg-slate-50/80 transition-colors duration-150"
                                    >
                                        {/* ID */}
                                        <td className="p-3.5 pl-5 font-bold text-slate-400 text-[11px]">
                                            {rowId}
                                        </td>

                                        {/* Data e Hora */}
                                        <td className="p-3.5 whitespace-nowrap text-slate-700 font-medium">
                                            {mov.dateFormatted}
                                        </td>

                                        {/* Lote */}
                                        <td className="p-3.5 whitespace-nowrap">
                                            {onSelectLot && mov.stockItem ? (
                                                <button
                                                    onClick={() => onSelectLot(mov.stockItem!)}
                                                    className="font-bold text-[#0F3F5C] hover:underline flex flex-col text-left group"
                                                    title="Clique para ver detalhes do lote"
                                                >
                                                    <span className="group-hover:text-blue-600 transition-colors">
                                                        {mov.internalLot}
                                                    </span>
                                                    {mov.runNumber && (
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {mov.runNumber}
                                                        </span>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{mov.internalLot}</span>
                                                    {mov.runNumber && (
                                                        <span className="text-[10px] text-slate-400">{mov.runNumber}</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Material & Bitola */}
                                        <td className="p-3.5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 text-xs">
                                                    {mov.materialType === 'Treliça' ? `📐 ${mov.bitola}` : mov.bitola}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {mov.materialType} {mov.steelType ? `• ${mov.steelType}` : ''}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Tipo (Pills idênticas ao print) */}
                                        <td className="p-3.5 whitespace-nowrap">
                                            {mov.type === 'Entrada Compra' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm">
                                                    <span className="text-emerald-500 font-black">→</span> Entrada Compra
                                                </span>
                                            )}
                                            {mov.type === 'Saída Produção' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 shadow-sm">
                                                    <span className="text-rose-500 font-black">→</span> Saída Produção
                                                </span>
                                            )}
                                            {mov.type === 'Transferência' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 shadow-sm">
                                                    <span className="text-blue-500 font-black">→</span> Transferência
                                                </span>
                                            )}
                                            {mov.type === 'Devolução / Retorno' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm">
                                                    <span className="text-indigo-500 font-black">↩</span> Devolução / Retorno
                                                </span>
                                            )}
                                            {mov.type === 'Ajuste' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 shadow-sm">
                                                    <span className="text-amber-500 font-black">⚙</span> Ajuste
                                                </span>
                                            )}
                                        </td>

                                        {/* Localização De */}
                                        <td className="p-3.5 text-slate-600 max-w-[150px] truncate" title={mov.locationFrom}>
                                            {mov.locationFrom}
                                        </td>

                                        {/* Localização Para */}
                                        <td className="p-3.5 text-slate-600 max-w-[160px] truncate" title={mov.locationTo}>
                                            {mov.locationTo}
                                        </td>

                                        {/* Quantidade */}
                                        <td className="p-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                            <span className={mov.type === 'Saída Produção' ? 'text-rose-600' : 'text-slate-800'}>
                                                {mov.type === 'Saída Produção' ? '-' : ''}
                                                {mov.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                <span className="text-[10px] text-slate-400 ml-1 font-sans">{mov.unit}</span>
                                            </span>
                                        </td>

                                        {/* Responsável */}
                                        <td className="p-3.5 whitespace-nowrap text-slate-600 text-xs">
                                            {mov.responsible}
                                        </td>

                                        {/* Status (Pill verde Confirmado idêntica ao print) */}
                                        <td className="p-3.5 text-center pr-5 whitespace-nowrap">
                                            {mov.status === 'Confirmado' ? (
                                                <span className="inline-block px-3 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                                                    Confirmado
                                                </span>
                                            ) : (
                                                <span className="inline-block px-3 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200/60">
                                                    Pendente
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paginação da Tabela de Movimentações */}
            {filteredMovements.length > 0 && (
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 no-print">
                    <div className="flex items-center gap-2">
                        <span>Exibindo {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filteredMovements.length)} de {filteredMovements.length}</span>
                        <span className="text-slate-300">•</span>
                        <label className="flex items-center gap-1.5">
                            <span>Por página:</span>
                            <select
                                value={pageSize}
                                onChange={e => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none text-xs"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </label>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            ← Anterior
                        </button>
                        <span className="px-2 font-bold text-slate-700">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            Próxima →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockMovementsTable;
