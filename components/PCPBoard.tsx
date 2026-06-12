import React, { useState, useMemo } from 'react';
import type { Page, ProductionOrderData, StockItem, User } from '../types';
import { ClipboardListIcon, CalendarIcon, PlusIcon, ChevronRightIcon, SearchIcon, XIcon, ArrowLeftIcon } from './icons';

interface PCPBoardProps {
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    updateProductionOrder: (id: string, updates: Partial<ProductionOrderData>) => Promise<void>;
    stock: StockItem[];
    currentUser: User | null;
}

// Configurações de capacidade produtiva padrão por máquina para sugerir duração
const CAPACITY_DEFAULTS = {
    Trefila: 18000,        // 18.000 kg por dia
    Treliça: 3500,         // 3.500 peças por dia
    'Desbobinadeira 1': 5000 // 5.000 kg por dia
};

const MACHINES = [
    { name: 'Trefila 1', type: 'Trefila', color: 'border-l-cyan-500 text-cyan-400 bg-cyan-950/20' },
    { name: 'Trefila 2', type: 'Trefila', color: 'border-l-sky-500 text-sky-400 bg-sky-950/20' },
    { name: 'Treliça 1', type: 'Treliça', color: 'border-l-emerald-500 text-emerald-400 bg-emerald-950/20' },
    { name: 'Treliça 2', type: 'Treliça', color: 'border-l-green-500 text-green-400 bg-green-950/20' },
    { name: 'Desbobinadeira 1', type: 'Desbobinadeira 1', color: 'border-l-violet-500 text-violet-400 bg-violet-950/20' }
];

export const PCPBoard: React.FC<PCPBoardProps> = ({
    setPage,
    productionOrders,
    updateProductionOrder,
    stock,
    currentUser
}) => {
    // Estado de data de referência (inicializado com a data atual)
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    
    // Estados de filtros da fila lateral
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'Trefila' | 'Treliça' | 'Desbobinadeira 1'>('all');
    
    // Estado do modal de agendamento
    const [selectedOP, setSelectedOP] = useState<ProductionOrderData | null>(null);
    const [scheduleMachine, setScheduleMachine] = useState<string>('');
    const [scheduleStartDate, setScheduleStartDate] = useState<string>('');
    const [scheduleDuration, setScheduleDuration] = useState<number>(1);

    // Helpers de Manipulação de Datas
    const getMonday = (d: Date): Date => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // ajusta para segunda-feira
        return new Date(date.setDate(diff));
    };

    const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const formatDateString = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    const formatFriendlyDate = (date: Date): string => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    // Gera o intervalo de Segunda a Sexta da semana selecionada
    const weekDays = useMemo(() => {
        const monday = getMonday(currentDate);
        return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    }, [currentDate]);

    const mondayStr = useMemo(() => formatDateString(weekDays[0]), [weekDays]);
    const fridayStr = useMemo(() => formatDateString(weekDays[4]), [weekDays]);

    // Fila lateral: OPs pendentes (sem data de início agendada)
    const pendingOrders = useMemo(() => {
        return productionOrders.filter(op => {
            // Considera OPs com status pendente ou em progresso que ainda não têm agendamento de PCP
            const isNotScheduled = !op.plannedStartDate || !op.scheduledMachine;
            const isNotCompleted = op.status !== 'completed' && op.status !== 'Finalizado' && op.status !== 'Cancelada';
            
            if (!isNotScheduled || !isNotCompleted) return false;

            // Filtro por tipo
            if (filterType !== 'all') {
                if (filterType === 'Trefila' && op.machine !== 'Trefila') return false;
                if (filterType === 'Treliça' && op.machine !== 'Treliça') return false;
                if (filterType === 'Desbobinadeira 1' && op.machine !== 'Desbobinadeira 1') return false;
            }

            // Filtro por busca
            if (searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase();
                const matchesNum = op.orderNumber.toLowerCase().includes(term);
                const matchesBitola = op.targetBitola.toLowerCase().includes(term);
                const matchesModel = op.trelicaModel?.toLowerCase().includes(term) || false;
                return matchesNum || matchesBitola || matchesModel;
            }

            return true;
        });
    }, [productionOrders, filterType, searchTerm]);

    // OPs Agendadas para a semana atual
    const scheduledOrders = useMemo(() => {
        return productionOrders.filter(op => {
            if (!op.plannedStartDate || !op.scheduledMachine) return false;
            
            // Verifica se o status não é finalizado ou cancelado
            if (op.status === 'completed' || op.status === 'Finalizado' || op.status === 'Cancelada') return false;

            // Calcula overlap do período da OP com o período da semana atual
            const opStart = op.plannedStartDate;
            const opEnd = op.plannedEndDate || opStart;

            return opStart <= fridayStr && opEnd >= mondayStr;
        });
    }, [productionOrders, mondayStr, fridayStr]);

    // Função para navegar entre as semanas
    const changeWeek = (weeks: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (weeks * 7));
        setCurrentDate(newDate);
    };

    const resetToToday = () => {
        setCurrentDate(new Date());
    };

    // Abre o modal para programar a OP
    const openScheduleModal = (op: ProductionOrderData, defaultDate?: string) => {
        setSelectedOP(op);
        
        // Sugere máquina baseado no tipo da OP
        let defaultMachine = '';
        if (op.machine === 'Trefila') defaultMachine = 'Trefila 1';
        else if (op.machine === 'Treliça') defaultMachine = 'Treliça 1';
        else if (op.machine === 'Desbobinadeira 1') defaultMachine = 'Desbobinadeira 1';
        
        setScheduleMachine(defaultMachine);
        setScheduleStartDate(defaultDate || mondayStr);

        // Calcula a duração sugerida com base na meta diária
        let suggestedDays = 1;
        if (op.machine === 'Trefila') {
            const weight = op.quantityToProduce || op.totalWeight || 0;
            suggestedDays = Math.max(1, Math.ceil(weight / CAPACITY_DEFAULTS.Trefila));
        } else if (op.machine === 'Treliça') {
            const qty = op.quantityToProduce || 0;
            suggestedDays = Math.max(1, Math.ceil(qty / CAPACITY_DEFAULTS.Treliça));
        } else if (op.machine === 'Desbobinadeira 1') {
            const weight = op.quantityToProduce || op.totalWeight || 0;
            suggestedDays = Math.max(1, Math.ceil(weight / CAPACITY_DEFAULTS['Desbobinadeira 1']));
        }
        setScheduleDuration(suggestedDays);
    };

    // Salva o agendamento no Supabase
    const handleSaveSchedule = async () => {
        if (!selectedOP) return;

        // Calcula plannedEndDate com base na data de início e duração
        const start = new Date(scheduleStartDate + 'T00:00:00');
        const end = new Date(start);
        end.setDate(start.getDate() + scheduleDuration - 1);

        const updates: Partial<ProductionOrderData> = {
            scheduledMachine: scheduleMachine,
            plannedStartDate: scheduleStartDate,
            plannedEndDate: formatDateString(end),
            estimatedDurationDays: scheduleDuration
        };

        try {
            await updateProductionOrder(selectedOP.id, updates);
            setSelectedOP(null);
        } catch (error) {
            console.error('Erro ao agendar OP:', error);
        }
    };

    // Remove a OP do agendamento (volta a ser pendente)
    const handleRemoveSchedule = async (id: string) => {
        if (!confirm('Deseja retirar esta ordem de produção do agendamento e devolvê-la para a fila?')) return;
        
        const updates: Partial<ProductionOrderData> = {
            scheduledMachine: undefined,
            plannedStartDate: undefined,
            plannedEndDate: undefined,
            estimatedDurationDays: undefined
        };

        try {
            await updateProductionOrder(id, updates);
        } catch (error) {
            console.error('Erro ao remover agendamento:', error);
        }
    };

    // Move a OP de data de início (deslocamento)
    const handleShiftOP = async (op: ProductionOrderData, daysToShift: number) => {
        if (!op.plannedStartDate) return;
        
        const start = new Date(op.plannedStartDate + 'T00:00:00');
        start.setDate(start.getDate() + daysToShift);
        
        const newStartStr = formatDateString(start);
        const duration = op.estimatedDurationDays || 1;
        
        const end = new Date(start);
        end.setDate(start.getDate() + duration - 1);
        
        const updates: Partial<ProductionOrderData> = {
            plannedStartDate: newStartStr,
            plannedEndDate: formatDateString(end)
        };

        try {
            await updateProductionOrder(op.id, updates);
        } catch (error) {
            console.error('Erro ao deslocar agendamento:', error);
        }
    };

    // Ajusta a duração da OP (+1 ou -1 dia)
    const handleAdjustDuration = async (op: ProductionOrderData, durationDelta: number) => {
        if (!op.plannedStartDate) return;
        
        const currentDuration = op.estimatedDurationDays || 1;
        const newDuration = Math.max(1, currentDuration + durationDelta);
        
        const start = new Date(op.plannedStartDate + 'T00:00:00');
        const end = new Date(start);
        end.setDate(start.getDate() + newDuration - 1);
        
        const updates: Partial<ProductionOrderData> = {
            estimatedDurationDays: newDuration,
            plannedEndDate: formatDateString(end)
        };

        try {
            await updateProductionOrder(op.id, updates);
        } catch (error) {
            console.error('Erro ao ajustar duração:', error);
        }
    };

    return (
        <div className="pcp-board-container min-h-screen bg-[#08131B] text-slate-100 flex flex-col lg:flex-row gap-6 p-1 sm:p-3 select-none">
            
            {/* ESTILO CUSTOMIZADO LOCAL PARA O QUADRO PCP */}
            <style dangerouslySetInnerHTML={{ __html: `
                .pcp-glass {
                    background: rgba(15, 33, 46, 0.55);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .pcp-glass-card {
                    background: rgba(20, 42, 59, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.07);
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
                }
                .pcp-timeline-grid {
                    display: grid;
                    grid-template-columns: 180px repeat(5, minmax(140px, 1fr));
                }
                .pcp-header-cell {
                    background: rgba(11, 26, 38, 0.9);
                    border-bottom: 2px solid rgba(0, 229, 255, 0.2);
                }
                .pcp-track-row {
                    min-height: 120px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .pcp-track-row:hover {
                    background: rgba(255, 255, 255, 0.01);
                }
                .pcp-op-bar {
                    position: absolute;
                    top: 14px;
                    height: 90px;
                    border-radius: 12px;
                    padding: 8px 12px;
                    box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.4);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 10;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .pcp-op-bar:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px 0 rgba(0, 0, 0, 0.6);
                    z-index: 20;
                    border-color: rgba(255, 255, 255, 0.25);
                }
                /* Animação fade */
                .animate-fade {
                    animation: fadeIn 0.25s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />

            {/* COLUNA LATERAL: FILA DE ORDENS PENDENTES */}
            <div className="w-full lg:w-[320px] shrink-0 pcp-glass rounded-2xl flex flex-col h-[calc(100vh-110px)] overflow-hidden border border-white/5 shadow-2xl">
                <div className="p-4 border-b border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-[#00E5FF] tracking-wider uppercase flex items-center gap-2">
                            <ClipboardListIcon className="w-5 h-5" />
                            Fila de OPs
                        </h2>
                        <span className="bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {pendingOrders.length} Pendentes
                        </span>
                    </div>

                    {/* Campo de Busca */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar OP, bitola..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0A1A26] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white placeholder-slate-500 transition-colors"
                        />
                        <SearchIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filtros Rápidos por Categoria */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                        {(['all', 'Trefila', 'Treliça', 'Desbobinadeira 1'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
                                    filterType === type
                                        ? 'bg-[#00E5FF] text-slate-900 border-[#00E5FF]'
                                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                            >
                                {type === 'all' ? 'Todas' : type === 'Desbobinadeira 1' ? 'Desbob.' : type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de Cards Pendentes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                    {pendingOrders.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center p-4">
                            <span className="text-2xl mb-2">🎉</span>
                            <p className="text-xs text-slate-400 font-medium">Nenhuma ordem de produção pendente encontrada!</p>
                        </div>
                    ) : (
                        pendingOrders.map(op => {
                            const isTrelica = op.machine === 'Treliça';
                            const specLabel = isTrelica 
                                ? `${op.trelicaModel} - ${op.tamanho}`
                                : `Bitola: ${op.targetBitola}mm`;

                            const qtyLabel = isTrelica
                                ? `${op.quantityToProduce} pçs`
                                : `${op.quantityToProduce || op.totalWeight || 0} kg`;

                            const machineColor = op.machine === 'Trefila'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : op.machine === 'Treliça'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-violet-500/10 text-violet-400 border-violet-500/20';

                            return (
                                <div 
                                    key={op.id}
                                    className="p-3 bg-[#112330] hover:bg-[#142B3B] border border-white/5 rounded-xl transition-all duration-200 group relative flex flex-col justify-between min-h-[96px] shadow-lg"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-black tracking-wider block">OP #{op.orderNumber}</span>
                                            <span className="text-white text-xs font-bold block mt-0.5">{specLabel}</span>
                                        </div>
                                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${machineColor}`}>
                                            {op.machine}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Meta</span>
                                            <span className="text-white text-xs font-black">{qtyLabel}</span>
                                        </div>
                                        <button
                                            onClick={() => openScheduleModal(op)}
                                            className="bg-[#00E5FF] hover:bg-[#00B4D8] text-slate-900 font-extrabold text-[10px] py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all shadow-md active:scale-95"
                                        >
                                            <PlusIcon className="w-3.5 h-3.5" />
                                            Agendar
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* COLUNA PRINCIPAL: TIMELINE PCP SEMANAL */}
            <div className="flex-1 pcp-glass rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden h-[calc(100vh-110px)]">
                
                {/* Cabeçalho de Controle e Navegação */}
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-[#0B1D2A]">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPage('menu')}
                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                        >
                            Menu Principal
                        </button>
                        <h1 className="text-base font-black tracking-widest uppercase text-white flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-[#00E5FF]" />
                            Programação PCP
                        </h1>
                    </div>

                    {/* Controles de Navegação da Semana */}
                    <div className="flex items-center gap-2 bg-[#06121B] p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={() => changeWeek(-1)}
                            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Semana Anterior"
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                        </button>

                        <button
                            onClick={resetToToday}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all whitespace-nowrap"
                        >
                            Semana Atual
                        </button>

                        <div className="px-4 py-1 text-xs font-black text-[#00E5FF] tracking-wider whitespace-nowrap">
                            {formatFriendlyDate(weekDays[0])} a {formatFriendlyDate(weekDays[4])}
                        </div>

                        <button
                            onClick={() => changeWeek(1)}
                            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Próxima Semana"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Área da Timeline */}
                <div className="flex-1 overflow-auto bg-[#07131B]/55 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                    <div className="min-w-[900px] flex flex-col">
                        
                        {/* Cabeçalho dos Dias (Segunda a Sexta) */}
                        <div className="pcp-timeline-grid pcp-header-cell border-b border-white/15 sticky top-0 z-30 shrink-0">
                            {/* Célula Vazia de Canto */}
                            <div className="p-4 flex items-center font-black text-[10px] text-slate-400 tracking-wider uppercase select-none bg-[#091822]">
                                MÁQUINA
                            </div>
                            
                            {weekDays.map((day, index) => {
                                const isToday = formatDateString(day) === formatDateString(new Date());
                                const daysNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
                                return (
                                    <div 
                                        key={index} 
                                        className={`p-3 text-center flex flex-col justify-center border-l border-white/5 relative ${
                                            isToday ? 'bg-[#00E5FF]/5' : ''
                                        }`}
                                    >
                                        <span className={`text-[10px] font-black tracking-widest uppercase block ${
                                            isToday ? 'text-[#00E5FF]' : 'text-slate-400'
                                        }`}>
                                            {daysNames[index]}
                                        </span>
                                        <span className={`text-xs font-bold block mt-0.5 ${
                                            isToday ? 'text-white' : 'text-slate-500'
                                        }`}>
                                            {formatFriendlyDate(day)}
                                        </span>
                                        {isToday && (
                                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00E5FF]" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Linhas das Máquinas */}
                        <div className="flex-1 flex flex-col relative">
                            {MACHINES.map((mach) => {
                                // Filtra OPs da máquina
                                const machOps = scheduledOrders.filter(op => op.scheduledMachine === mach.name);

                                return (
                                    <div key={mach.name} className="pcp-timeline-grid pcp-track-row relative">
                                        
                                        {/* Coluna da Máquina */}
                                        <div className={`p-4 flex flex-col justify-center border-r border-white/5 border-l-4 ${mach.color} sticky left-0 z-20 shrink-0 shadow-lg`}>
                                            <span className="text-white text-xs font-black tracking-wider block">{mach.name}</span>
                                            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider block mt-0.5">{mach.type}</span>
                                        </div>

                                        {/* Grade de fundo (5 Colunas de dias) */}
                                        {Array.from({ length: 5 }).map((_, colIndex) => {
                                            const targetDay = weekDays[colIndex];
                                            const targetDayStr = formatDateString(targetDay);
                                            return (
                                                <div 
                                                    key={colIndex}
                                                    onClick={() => {
                                                        // Se clicar numa célula vazia, abre o agendador pré-selecionando aquela data e máquina
                                                        const opToCreateDummy: Partial<ProductionOrderData> = {
                                                            machine: mach.type as any,
                                                            orderNumber: ''
                                                        };
                                                        // Precisamos selecionar uma OP real na lista para agendar. Vamos avisar ou abrir
                                                    }}
                                                    className="border-l border-white/5 relative bg-transparent flex items-center justify-center group/cell cursor-pointer hover:bg-white/[0.01]"
                                                >
                                                    {/* Botão de agendamento rápido na célula */}
                                                    <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 absolute inset-0 flex items-center justify-center bg-black/10">
                                                        <span className="text-[10px] font-black text-slate-400 bg-[#0B1D2A] border border-white/10 px-2.5 py-1 rounded-lg hover:text-[#00E5FF] transition-all">
                                                            + Agendar Aqui
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Elementos de Barra de OPs sobrepostos na linha */}
                                        {machOps.map(op => {
                                            const startStr = op.plannedStartDate!;
                                            const endStr = op.plannedEndDate || startStr;
                                            
                                            // Descobre índices das colunas de Segunda a Sexta
                                            // Se a OP iniciou antes de Segunda, fixa coluna de início na 0
                                            let colStart = 0;
                                            if (startStr >= mondayStr) {
                                                const startIdx = weekDays.findIndex(d => formatDateString(d) === startStr);
                                                if (startIdx !== -1) colStart = startIdx;
                                            }

                                            // Se a OP termina depois de Sexta, fixa coluna final na 4
                                            let colEnd = 4;
                                            if (endStr <= fridayStr) {
                                                const endIdx = weekDays.findIndex(d => formatDateString(d) === endStr);
                                                if (endIdx !== -1) colEnd = endIdx;
                                            }

                                            const spanColumns = colEnd - colStart + 1;
                                            if (spanColumns <= 0) return null;

                                            // Cálculo de porcentagem de largura absoluta
                                            const colWidthPct = 20; // 5 colunas = 20% cada
                                            const leftPct = 180 + (colStart * (720 / 5)); // 180px da sidebar + frações
                                            
                                            // Lógica de largura para grid dinâmico:
                                            // Usaremos classes do Tailwind de posicionamento absoluto relativo ao container da linha.
                                            // A coluna da máquina tem largura fixa de 180px. A área dos dias tem o restante (100% - 180px).
                                            // left do elemento absoluto = 180px + colStart * 20% do restante
                                            // width do elemento absoluto = spanColumns * 20% do restante
                                            const leftStyle = `calc(180px + ${colStart * 20}%)`;
                                            const widthStyle = `calc(${spanColumns * 20}% - 8px)`;

                                            const isTrelica = op.machine === 'Treliça';
                                            const title = op.orderNumber;
                                            const subtitle = isTrelica ? op.trelicaModel : `Bitola ${op.targetBitola}mm`;
                                            
                                            // Diferenciação de cor por categoria
                                            let barColor = 'bg-[#0E3A52]/90 border-l-[#00E5FF] hover:bg-[#124B69]';
                                            if (op.machine === 'Treliça') {
                                                barColor = 'bg-[#0E4231]/90 border-l-[#10B981] hover:bg-[#12533E]';
                                            } else if (op.machine === 'Desbobinadeira 1') {
                                                barColor = 'bg-[#2E1854]/90 border-l-[#A78BFA] hover:bg-[#3B1F6C]';
                                            }

                                            return (
                                                <div
                                                    key={op.id}
                                                    className={`pcp-op-bar absolute border-l-4 animate-fade ${barColor}`}
                                                    style={{
                                                        left: leftStyle,
                                                        width: widthStyle
                                                    }}
                                                >
                                                    <div className="flex flex-col h-full justify-between">
                                                        <div className="flex items-start justify-between gap-1">
                                                            <div className="truncate">
                                                                <span className="text-[10px] font-black text-white block">OP #{title}</span>
                                                                <span className="text-[9px] text-slate-300 font-bold truncate block">{subtitle}</span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveSchedule(op.id); }}
                                                                className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-all shrink-0 hover:bg-black/20"
                                                                title="Desagendar"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>

                                                        {/* Painel de Controles Rápidos da OP */}
                                                        <div className="flex items-center justify-between mt-1 bg-black/25 px-2 py-1 rounded-lg text-[9px] border border-white/5 select-none" onClick={(e) => e.stopPropagation()}>
                                                            {/* Deslocamento de Início */}
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleShiftOP(op, -1)}
                                                                    className="text-slate-400 hover:text-[#00E5FF] p-0.5 font-bold transition-colors active:scale-90" 
                                                                    title="Mover 1 dia antes"
                                                                >
                                                                    ◀
                                                                </button>
                                                                <span className="text-[8px] uppercase font-black text-slate-500 tracking-tighter">MOVER</span>
                                                                <button 
                                                                    onClick={() => handleShiftOP(op, 1)}
                                                                    className="text-slate-400 hover:text-[#00E5FF] p-0.5 font-bold transition-colors active:scale-90"
                                                                    title="Mover 1 dia depois"
                                                                >
                                                                    ▶
                                                                </button>
                                                            </div>

                                                            {/* Duração */}
                                                            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                                                                <button 
                                                                    onClick={() => handleAdjustDuration(op, -1)}
                                                                    className="text-slate-400 hover:text-red-400 font-black px-1 text-[11px] transition-colors active:scale-90"
                                                                    title="Diminuir duração"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="font-extrabold text-white">{op.estimatedDurationDays || 1}d</span>
                                                                <button 
                                                                    onClick={() => handleAdjustDuration(op, 1)}
                                                                    className="text-slate-400 hover:text-emerald-400 font-black px-1 text-[11px] transition-colors active:scale-90"
                                                                    title="Aumentar duração"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE AGENDAMENTO DE OP */}
            {selectedOP && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade p-4">
                    <div className="w-full max-w-[420px] pcp-glass-card rounded-2xl border border-white/10 p-6 flex flex-col gap-4 text-slate-100">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                                <PlusIcon className="w-5 h-5" />
                                Programar Produção
                            </h3>
                            <button onClick={() => setSelectedOP(null)} className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Detalhes Rápidos da OP */}
                        <div className="bg-[#0A1A26]/80 p-3 rounded-xl border border-white/5 text-xs space-y-1">
                            <p><span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">Ordem de Produção</span> <strong className="text-white text-sm">#{selectedOP.orderNumber}</strong></p>
                            <p>
                                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block mt-1">Especificação</span>
                                <strong className="text-slate-300">
                                    {selectedOP.machine === 'Treliça' 
                                        ? `${selectedOP.trelicaModel} - ${selectedOP.tamanho}`
                                        : `Bitola: ${selectedOP.targetBitola}mm`
                                    }
                                </strong>
                            </p>
                            <p>
                                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block mt-1">Volume Solicitado</span>
                                <strong className="text-slate-300">
                                    {selectedOP.machine === 'Treliça' 
                                        ? `${selectedOP.quantityToProduce} peças`
                                        : `${selectedOP.quantityToProduce || selectedOP.totalWeight || 0} kg`
                                    }
                                </strong>
                            </p>
                        </div>

                        {/* Configurações de Agendamento */}
                        <div className="space-y-4">
                            {/* Seleção de Máquina */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máquina de Destino</label>
                                <select
                                    value={scheduleMachine}
                                    onChange={(e) => setScheduleMachine(e.target.value)}
                                    className="w-full bg-[#0A1D2A] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white"
                                >
                                    {MACHINES.filter(m => m.type === selectedOP.machine).map(m => (
                                        <option key={m.name} value={m.name}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Data de Início */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Início</label>
                                <input
                                    type="date"
                                    value={scheduleStartDate}
                                    onChange={(e) => setScheduleStartDate(e.target.value)}
                                    className="w-full bg-[#0A1D2A] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white"
                                />
                            </div>

                            {/* Duração Estimada */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                    <span>Duração Estimada</span>
                                    <span className="text-[#00E5FF] font-black">{scheduleDuration} {scheduleDuration === 1 ? 'dia' : 'dias'}</span>
                                </label>
                                <div className="flex items-center gap-3 bg-[#0A1D2A] border border-white/10 rounded-xl p-1 justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setScheduleDuration(prev => Math.max(1, prev - 1))}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black text-sm flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className="text-xs font-bold text-white">{scheduleDuration}</span>
                                    <button
                                        type="button"
                                        onClick={() => setScheduleDuration(prev => prev + 1)}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black text-sm flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-[9px] text-slate-500 italic block mt-0.5">
                                    Meta diária sugerida: {selectedOP.machine === 'Treliça' ? '3.500 peças/dia' : selectedOP.machine === 'Trefila' ? '18.000 kg/dia' : '5.000 kg/dia'}
                                </span>
                            </div>
                        </div>

                        {/* Botões do Modal */}
                        <div className="flex items-center gap-3 border-t border-white/10 pt-4 mt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedOP(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-all text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSchedule}
                                className="flex-1 bg-[#00E5FF] hover:bg-[#00B4D8] text-slate-900 rounded-xl py-2.5 text-xs font-black transition-all shadow-md text-center active:scale-95"
                            >
                                Salvar Programação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
