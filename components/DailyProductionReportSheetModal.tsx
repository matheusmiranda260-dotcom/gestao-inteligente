import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ProductionOrderData, ShiftReport } from '../types';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { resolveMachineShiftConfig } from '../services/shiftConfigService';

export interface DailyProductionReportSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    machine: string;
    dateStr: string;
    op: ProductionOrderData;
    shiftReports?: ShiftReport[];
    productionOrders?: ProductionOrderData[];
    initialProduced?: number;
    initialOperator?: string;
}

interface StopRow {
    id: string;
    inicio: string;
    fim: string;
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string;
    pecasProduzidas: number;
    tamanhoPeca: number;
    horarioTurnoPrevisto?: string;
    horarioInicioApp?: string;
    horarioFimPrevisto?: string;
    horarioFimApp?: string;
}

interface ProductionUpdateRow {
    id: string;
    qnt: number;
    peso: number;
    data: string;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

// Ícones SVG de Alta Resolução
const CalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ClipboardIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const UserIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const TagIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
);

const GaugeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ClockIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LayersIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const RulerIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);

export const DailyProductionReportSheetModal: React.FC<DailyProductionReportSheetModalProps> = ({
    isOpen,
    onClose,
    machine: initialMachine,
    dateStr: initialDateStr,
    op,
    shiftReports = [],
    initialProduced,
    initialOperator,
}) => {
    // Normalização da máquina (ex: Treliça 1, Treliça 2)
    const machine = useMemo(() => {
        const raw = initialMachine || op.scheduledMachine || (op.machine as string) || 'Treliça 1';
        if (raw.toLowerCase().includes('treliça 2') || raw.toLowerCase().includes('trelica 2')) return 'Treliça 2';
        if (raw.toLowerCase().includes('treliça') || raw.toLowerCase().includes('trelica')) return 'Treliça 1';
        return raw;
    }, [initialMachine, op]);

    // Data selecionada (pode alternar de dia dentro da ficha)
    const [selectedDate, setSelectedDate] = useState<string>(initialDateStr);
    useEffect(() => {
        if (initialDateStr) {
            setSelectedDate(initialDateStr);
        }
    }, [initialDateStr]);

    // Estados do Relatório
    const [reportId, setReportId] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Campos da Ficha Técnica
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operatorShiftA, setOperatorShiftA] = useState<string>('');
    const [operatorShiftB, setOperatorShiftB] = useState<string>('');
    const [productDescription, setProductDescription] = useState<string>('');
    const [piecesToProduce, setPiecesToProduce] = useState<number>(4500);

    // Paradas
    const [stopsShiftA, setStopsShiftA] = useState<StopRow[]>([]);
    const [stopsShiftB, setStopsShiftB] = useState<StopRow[]>([]);

    // Estatísticas
    const isInitialTrelica = initialMachine ? (initialMachine.toLowerCase().includes('treli') || initialMachine.toLowerCase().includes('trelica')) : true;
    const [statsShiftA, setStatsShiftA] = useState<ShiftStats>({
        horasTrabalhadas: isInitialTrelica ? '08:48:00' : '09:48:00',
        pecasProduzidas: 0,
        tamanhoPeca: 12,
        horarioTurnoPrevisto: isInitialTrelica ? '05:00 às 14:48' : '07:45 às 17:33'
    });
    const [statsShiftB, setStatsShiftB] = useState<ShiftStats>({
        horasTrabalhadas: '00:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 6,
        horarioTurnoPrevisto: ''
    });

    // Atualização de Produção (Pesagens)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    // Refs
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reportIdRef = useRef<string | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { reportIdRef.current = reportId; }, [reportId]);

    // Toast feedback
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    // Helpers de tempo
    const timeToSeconds = (timeStr: string): number => {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseInt(parts[2], 10) || 0;
        return hrs * 3600 + mins * 60 + secs;
    };

    const secondsToTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0 || isNaN(totalSeconds)) return '00:00:00';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    const calculateStopDurationSeconds = (inicio: string, fim: string): number => {
        if (!inicio || !fim) return 0;
        let diff = timeToSeconds(fim) - timeToSeconds(inicio);
        if (diff < 0) diff += 24 * 3600;
        return diff;
    };

    // Formatação da Data
    const safeDateObj = useMemo(() => {
        if (!selectedDate) return new Date();
        if (selectedDate.includes('-')) {
            const parts = selectedDate.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }
        const d = new Date(selectedDate);
        return isNaN(d.getTime()) ? new Date() : d;
    }, [selectedDate]);

    const formattedDateNumbers = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return selectedDate || '';
        return safeDateObj.toLocaleDateString('pt-BR');
    }, [safeDateObj, selectedDate]);

    const formattedDayOfWeek = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return '';
        const days = [
            'DOMINGO',
            'SEGUNDA-FEIRA',
            'TERÇA-FEIRA',
            'QUARTA-FEIRA',
            'QUINTA-FEIRA',
            'SEXTA-FEIRA',
            'SÁBADO'
        ];
        return days[safeDateObj.getDay()];
    }, [safeDateObj]);

    // Extrair tamanho da peça do nome do modelo (ex: "12METROS" -> 12, "6 MTS" -> 6)
    const extractPieceSize = (description: string): number => {
        const lower = description.toLowerCase();
        if (lower.includes('12') || lower.includes('12m') || lower.includes('12mts') || lower.includes('12 metros')) return 12;
        if (lower.includes('6') || lower.includes('6m') || lower.includes('6mts') || lower.includes('6 metros')) return 6;
        return 6;
    };

    const getLocalDateString = (val: any): string => {
        if (!val) return '';
        try {
            const dt = new Date(val);
            if (isNaN(dt.getTime())) return String(val).split('T')[0] || '';
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch {
            return String(val).split('T')[0] || '';
        }
    };

    // Auto-preenchimento automático inteligente dos dados com base no chão de fábrica
    const generateAutoDataFromShopFloor = () => {
        const prodOrder = op.orderNumber || '';
        const prodDesc = (op.trelicaModel || op.product || 'TRELIÇA H-12 LEVE 6 MTS').toUpperCase();
        const targetQ = op.quantityToProduce || op.targetQuantity || 4500;
        const defaultSize = extractPieceSize(prodDesc);

        // 1. Relatórios de Turno desta OP nesta data específica
        const dayShiftReports = shiftReports.filter(r => {
            const isThisOp = r.productionOrderId === op.id || r.orderNumber === op.orderNumber;
            if (!isThisOp) return false;
            const rDate = getLocalDateString(r.date || r.shiftStartTime || r.shiftEndTime);
            return rDate === selectedDate;
        });

        let opA = initialOperator || '';
        let opB = '';
        let piecesA = 0;
        let piecesB = 0;
        let hasTurnoBReport = false;

        dayShiftReports.forEach(r => {
            const shiftName = (r.shift || '').toLowerCase();
            const sStart = r.shiftStartTime ? new Date(r.shiftStartTime) : null;
            const hour = sStart && !isNaN(sStart.getTime()) ? sStart.getHours() : -1;
            
            // Turno B apenas se explicitamente marcado ou se o turno iniciou após as 15h (sem ser A)
            const isTurnoB = shiftName.includes('b') || shiftName.includes('2') || (hour >= 15 && !shiftName.includes('a'));

            if (!isTurnoB) {
                if (!opA && r.operator) opA = r.operator;
                piecesA += Number(r.totalProducedQuantity || 0);
            } else {
                hasTurnoBReport = true;
                if (!opB && r.operator) opB = r.operator;
                piecesB += Number(r.totalProducedQuantity || 0);
            }
        });

        // 2. Se não encontrou quantidade em shiftReports, checar operatorLogs desta data
        if (piecesA === 0 && piecesB === 0) {
            const dayLogs = (op.operatorLogs || []).filter(l => {
                const s = getLocalDateString(l.startTime);
                const e = getLocalDateString(l.endTime);
                return s === selectedDate || e === selectedDate;
            });

            dayLogs.forEach(l => {
                if (!opA && l.operator) opA = l.operator;
                if (l.endQuantity !== undefined && l.startQuantity !== undefined) {
                    const diff = Math.max(0, (Number(l.endQuantity) || 0) - (Number(l.startQuantity) || 0));
                    piecesA += diff;
                }
            });
        }

        // 3. Se ainda assim estiver zerado, mas tivermos a quantidade calculada pelo PCP no card do dia
        if (piecesA === 0 && piecesB === 0) {
            if (initialProduced !== undefined && initialProduced > 0) {
                piecesA = initialProduced;
            }
        }

        // Coletar paradas do dia
        const stopsListA: StopRow[] = [];
        const stopsListB: StopRow[] = [];

        // Helper para checar se é parada de desligamento de fábrica / fim de expediente (interjornada)
        const isInterjornadaStop = (reason: string, durationMin: number, startH: number) => {
            const rLower = (reason || '').toLowerCase();
            const isTurnoEndReason = rLower.includes('final de turno') || 
                                     rLower.includes('fim de turno') || 
                                     rLower.includes('desligada: turno') || 
                                     rLower.includes('encerramento');
            // Se for encerramento/final de turno ou parada que passou a noite inteira desligada
            if (isTurnoEndReason && (durationMin > 180 || durationMin === 0)) return true;
            if (durationMin > 480 && (startH >= 17 || startH < 6)) return true;
            return false;
        };

        // 1. De activeOp.downtimeEvents
        (op.downtimeEvents || []).forEach((e: any, idx: number) => {
            if (!e || !e.stopTime) return;
            const sDate = new Date(e.stopTime);
            if (isNaN(sDate.getTime())) return;

            const eventDateStr = getLocalDateString(e.stopTime);
            if (eventDateStr !== selectedDate) return;

            const rDate = e.resumeTime ? new Date(e.resumeTime) : null;
            const startH = sDate.getHours();
            const startM = sDate.getMinutes();

            const endH = rDate && !isNaN(rDate.getTime()) ? rDate.getHours() : startH;
            const endM = rDate && !isNaN(rDate.getTime()) ? rDate.getMinutes() : startM;

            const durMs = rDate && !isNaN(rDate.getTime()) ? (rDate.getTime() - sDate.getTime()) : 0;
            const durMin = durMs > 0 ? Math.round(durMs / 60000) : (Number(e.durationMin) || 0);

            // Desconsiderar paradas de máquina desligada fora do expediente (interjornada noturna)
            if (isInterjornadaStop(e.reason, durMin, startH)) {
                return;
            }

            const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
            const endTimeStr = rDate && !isNaN(rDate.getTime())
                ? `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                : startTimeStr;

            const row: StopRow = {
                id: `auto-op-stop-${idx}`,
                inicio: startTimeStr,
                fim: endTimeStr,
                motivo: (e.reason || 'PARADA DE MÁQUINA').toUpperCase()
            };

            // Se não há Turno B confirmado (sem operador e sem produção no Turno B) ou se ocorreu até o fim da tarde (ex: 18h), pertence ao Turno A
            const belongsToTurnoB = hasTurnoBReport && startH >= 17;

            if (!belongsToTurnoB) {
                stopsListA.push(row);
                if (!opA && e.operator) opA = e.operator;
            } else {
                stopsListB.push(row);
                if (!opB && e.operator) opB = e.operator;
            }
        });

        // 2. De shiftReports
        dayShiftReports.forEach((r, rIdx) => {
            (r.downtimeEvents || []).forEach((e: any, eIdx: number) => {
                const sDate = new Date(e.stopTime || r.shiftStartTime || '');
                if (isNaN(sDate.getTime())) return;
                const rDate = e.resumeTime ? new Date(e.resumeTime) : null;
                const startH = sDate.getHours();
                const startM = sDate.getMinutes();
                const endH = rDate && !isNaN(rDate.getTime()) ? rDate.getHours() : startH;
                const endM = rDate && !isNaN(rDate.getTime()) ? rDate.getMinutes() : startM;

                const durMs = rDate && !isNaN(rDate.getTime()) ? (rDate.getTime() - sDate.getTime()) : 0;
                const durMin = durMs > 0 ? Math.round(durMs / 60000) : (Number(e.durationMin) || 0);

                if (isInterjornadaStop(e.reason, durMin, startH)) return;

                const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
                const endTimeStr = rDate && !isNaN(rDate.getTime())
                    ? `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                    : startTimeStr;

                const isTurnoB = hasTurnoBReport && (r.shift?.toLowerCase().includes('b') || startH >= 17);
                const targetList = isTurnoB ? stopsListB : stopsListA;

                const isDupe = targetList.some(s => s.inicio === startTimeStr && s.motivo === (e.reason || '').toUpperCase());
                if (!isDupe) {
                    targetList.push({
                        id: `auto-shift-stop-${rIdx}-${eIdx}`,
                        inicio: startTimeStr,
                        fim: endTimeStr,
                        motivo: (e.reason || 'PARADA REGISTRADA').toUpperCase()
                    });
                }
            });
        });

        const hasRealTurnoB = hasTurnoBReport || piecesB > 0 || stopsListB.length > 0 || Boolean(opB);

        // Obter configuração da jornada da máquina
        const shiftCfg = resolveMachineShiftConfig(machine);
        const isTrelica = machine.toLowerCase().includes('treli') || machine.toLowerCase().includes('trelica');

        const schedStartA = shiftCfg.workStart || (isTrelica ? '05:00' : '07:45');
        const schedEndA = shiftCfg.workEnd || (isTrelica ? '14:48' : '17:33');
        const shiftScheduleStrA = `${schedStartA} às ${schedEndA}`;

        const schedStartB = shiftCfg.shift2Start || (isTrelica ? '14:48' : '14:00');
        const schedEndB = shiftCfg.shift2End || (isTrelica ? '23:36' : '23:59');
        const shiftScheduleStrB = `${schedStartB} às ${schedEndB}`;

        // Carga horária programada do turno (ex: Treliça = 8h48 -> 08:48:00)
        const shiftHoursA = isTrelica ? '08:48:00' : '09:48:00';
        const shiftHoursB = hasRealTurnoB ? (isTrelica ? '08:48:00' : '09:00:00') : '00:00:00';

        return {
            productionOrder: prodOrder,
            productDescription: prodDesc,
            piecesToProduce: targetQ,
            operatorShiftA: opA || '',
            operatorShiftB: hasRealTurnoB ? opB : '',
            stopsShiftA: stopsListA,
            stopsShiftB: stopsListB,
            statsShiftA: {
                horasTrabalhadas: shiftHoursA,
                pecasProduzidas: piecesA,
                tamanhoPeca: defaultSize,
                horarioTurnoPrevisto: shiftScheduleStrA,
            },
            statsShiftB: {
                horasTrabalhadas: shiftHoursB,
                pecasProduzidas: piecesB,
                tamanhoPeca: hasRealTurnoB ? (defaultSize === 12 ? 6 : defaultSize) : 0,
                horarioTurnoPrevisto: hasRealTurnoB ? shiftScheduleStrB : '',
            },
            productionUpdates: []
        };
    };

    // Carregar dados salvos do Supabase para esta máquina e data, ou preencher automaticamente
    const loadReportData = async (targetDate: string) => {
        setLoading(true);
        setSaveStatus('saving');
        try {
            // 1. Tentar buscar no Supabase
            const { data: dbReport, error } = await supabase
                .from('trelica_daily_reports')
                .select('*')
                .eq('date', targetDate)
                .eq('machine_type', machine)
                .maybeSingle();

            if (error) {
                console.warn('Erro ao buscar no Supabase, tentando cache local:', error);
            }

            if (dbReport) {
                // Carregar dados salvos do banco
                setReportId(dbReport.id);
                reportIdRef.current = dbReport.id;
                setProductionOrder(dbReport.production_order || op.orderNumber || '');
                setOperatorShiftA(dbReport.operator_shift_a || '');
                setOperatorShiftB(dbReport.operator_shift_b || '');
                setProductDescription(dbReport.product_description || op.trelicaModel || 'TRELIÇA H-12 LEVE 6 MTS');
                setPiecesToProduce(Number(dbReport.pieces_to_produce ?? (op.quantityToProduce || 4500)));
                setStopsShiftA(dbReport.stops_shift_a || []);
                setStopsShiftB(dbReport.stops_shift_b || []);
                const isTrelica = machine.toLowerCase().includes('treli') || machine.toLowerCase().includes('trelica');
                const defaultShiftA = isTrelica ? '08:48:00' : '09:48:00';
                const defaultSchedA = isTrelica ? '05:00 às 14:48' : '07:45 às 17:33';

                const rawStatsA = dbReport.stats_shift_a || {};
                const horasTrabalhadasA = (isTrelica && (rawStatsA.horasTrabalhadas === '09:49:05' || rawStatsA.horasTrabalhadas === '09:00:00'))
                    ? defaultShiftA
                    : (rawStatsA.horasTrabalhadas || defaultShiftA);

                const horarioTurnoA = (rawStatsA.horarioTurnoPrevisto && rawStatsA.horarioTurnoPrevisto.includes('às'))
                    ? rawStatsA.horarioTurnoPrevisto
                    : defaultSchedA;

                setStatsShiftA({
                    ...rawStatsA,
                    horasTrabalhadas: horasTrabalhadasA,
                    pecasProduzidas: Number(rawStatsA.pecasProduzidas || 0),
                    tamanhoPeca: Number(rawStatsA.tamanhoPeca || (isTrelica ? 12 : 6)),
                    horarioTurnoPrevisto: horarioTurnoA
                });

                const rawStatsB = dbReport.stats_shift_b || {};
                const defaultSchedB = isTrelica ? '14:48 às 23:36' : '14:00 às 23:59';
                const defaultShiftB = isTrelica ? '08:48:00' : '09:00:00';
                const hasHoursB = rawStatsB.horasTrabalhadas && rawStatsB.horasTrabalhadas !== '00:00:00';
                const horarioTurnoB = (rawStatsB.horarioTurnoPrevisto && rawStatsB.horarioTurnoPrevisto.includes('às'))
                    ? rawStatsB.horarioTurnoPrevisto
                    : (hasHoursB ? defaultSchedB : '');

                setStatsShiftB({
                    ...rawStatsB,
                    horasTrabalhadas: hasHoursB ? (isTrelica && rawStatsB.horasTrabalhadas === '09:00:00' ? defaultShiftB : rawStatsB.horasTrabalhadas) : '00:00:00',
                    pecasProduzidas: Number(rawStatsB.pecasProduzidas || 0),
                    tamanhoPeca: Number(rawStatsB.tamanhoPeca || 0),
                    horarioTurnoPrevisto: horarioTurnoB
                });
                setProductionUpdates(dbReport.production_updates || []);
                setSaveStatus('saved');
                showToast(`Relatório do dia ${targetDate.split('-').reverse().join('/')} carregado do banco.`, 'info');
            } else {
                // Não existe no banco ainda: gerar automaticamente com base nos dados do dia
                const auto = generateAutoDataFromShopFloor();
                setReportId(null);
                reportIdRef.current = null;
                setProductionOrder(auto.productionOrder);
                setProductDescription(auto.productDescription);
                setPiecesToProduce(auto.piecesToProduce);
                setOperatorShiftA(auto.operatorShiftA);
                setOperatorShiftB(auto.operatorShiftB);
                setStopsShiftA(auto.stopsShiftA);
                setStopsShiftB(auto.stopsShiftB);
                setStatsShiftA(auto.statsShiftA);
                setStatsShiftB(auto.statsShiftB);
                setProductionUpdates(auto.productionUpdates);

                // Auto-salvar no banco para garantir que já fique registrado
                saveReportData(targetDate, {
                    ...auto,
                    reportId: null
                }, false);
            }
        } catch (err) {
            console.error('Falha geral ao carregar relatório:', err);
            const auto = generateAutoDataFromShopFloor();
            setProductionOrder(auto.productionOrder);
            setProductDescription(auto.productDescription);
            setPiecesToProduce(auto.piecesToProduce);
            setOperatorShiftA(auto.operatorShiftA);
            setOperatorShiftB(auto.operatorShiftB);
            setStopsShiftA(auto.stopsShiftA);
            setStopsShiftB(auto.stopsShiftB);
            setStatsShiftA(auto.statsShiftA);
            setStatsShiftB(auto.statsShiftB);
            setProductionUpdates(auto.productionUpdates);
            setSaveStatus('saved');
        } finally {
            setLoading(false);
        }
    };

    // Carregar ao abrir ou ao trocar de data
    useEffect(() => {
        if (isOpen && selectedDate) {
            loadReportData(selectedDate);
        }
    }, [isOpen, selectedDate, machine]);

    // Salvar no Supabase (com fallback offline)
    const saveReportData = async (
        targetDate: string,
        dataToSave: {
            productionOrder: string;
            operatorShiftA: string;
            operatorShiftB: string;
            productDescription: string;
            piecesToProduce: number;
            stopsShiftA: StopRow[];
            stopsShiftB: StopRow[];
            statsShiftA: ShiftStats;
            statsShiftB: ShiftStats;
            productionUpdates: ProductionUpdateRow[];
            reportId: string | null;
        },
        showNotification: boolean = true
    ) => {
        setSaveStatus('saving');
        const payload = {
            date: targetDate,
            machine_type: machine,
            production_order: dataToSave.productionOrder,
            operator_shift_a: dataToSave.operatorShiftA,
            operator_shift_b: dataToSave.operatorShiftB,
            product_description: dataToSave.productDescription,
            pieces_to_produce: dataToSave.piecesToProduce,
            stops_shift_a: dataToSave.stopsShiftA,
            stops_shift_b: dataToSave.stopsShiftB,
            stats_shift_a: dataToSave.statsShiftA,
            stats_shift_b: dataToSave.statsShiftB,
            production_updates: dataToSave.productionUpdates,
        };

        const localKey = `daily_report_${machine}_${targetDate}`;
        localStorage.setItem(localKey, JSON.stringify(payload));

        try {
            const upsertPayload = dataToSave.reportId
                ? { id: dataToSave.reportId, ...payload }
                : payload;

            const { data, error } = await supabase
                .from('trelica_daily_reports')
                .upsert(upsertPayload, { onConflict: 'date,machine_type' })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setReportId(data.id);
                reportIdRef.current = data.id;
            }
            setSaveStatus('saved');
            if (showNotification) {
                showToast('Relatório salvo no Banco de Dados com sucesso!', 'success');
            }
        } catch (err) {
            console.error('Erro ao salvar relatório no Supabase:', err);
            setSaveStatus('error');
            if (showNotification) {
                showToast('Salvo em cache local. Verifique sua conexão.', 'warning');
            }
        }
    };

    // Auto-save com debounce de 600ms
    useEffect(() => {
        if (loading || !isOpen) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveReportData(selectedDate, {
                productionOrder,
                operatorShiftA,
                operatorShiftB,
                productDescription,
                piecesToProduce,
                stopsShiftA,
                stopsShiftB,
                statsShiftA,
                statsShiftB,
                productionUpdates,
                reportId: reportIdRef.current,
            }, false);
        }, 600);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [
        productionOrder, operatorShiftA, operatorShiftB, productDescription,
        piecesToProduce, stopsShiftA, stopsShiftB, statsShiftA, statsShiftB,
        productionUpdates, selectedDate, machine, loading, isOpen
    ]);

    // Recarregar os dados automáticos da OP
    const handleReloadAutoData = () => {
        if (window.confirm('Deseja recarregar os dados automáticos da OP e turnos para esta data? Dados manuais não salvos poderão ser substituídos.')) {
            const auto = generateAutoDataFromShopFloor();
            setProductionOrder(auto.productionOrder);
            setProductDescription(auto.productDescription);
            setPiecesToProduce(auto.piecesToProduce);
            setOperatorShiftA(auto.operatorShiftA);
            setOperatorShiftB(auto.operatorShiftB);
            setStopsShiftA(auto.stopsShiftA);
            setStopsShiftB(auto.stopsShiftB);
            setStatsShiftA(auto.statsShiftA);
            setStatsShiftB(auto.statsShiftB);
            setProductionUpdates(auto.productionUpdates);
            showToast('Dados recarregados a partir do chão de fábrica.', 'info');
        }
    };

    // Manipuladores de Paradas
    const addStopRow = (shift: 'A' | 'B') => {
        const newStop: StopRow = {
            id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            inicio: '',
            fim: '',
            motivo: ''
        };
        if (shift === 'A') setStopsShiftA(prev => [...prev, newStop]);
        else setStopsShiftB(prev => [...prev, newStop]);
    };

    const removeStopRow = (shift: 'A' | 'B', id: string) => {
        if (shift === 'A') setStopsShiftA(prev => prev.filter(s => s.id !== id));
        else setStopsShiftB(prev => prev.filter(s => s.id !== id));
    };

    const updateStopField = (shift: 'A' | 'B', id: string, field: keyof StopRow, value: string) => {
        if (shift === 'A') {
            setStopsShiftA(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
        } else {
            setStopsShiftB(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
        }
    };

    // Manipuladores de Pesagens
    const addProductionUpdateRow = () => {
        const newRow: ProductionUpdateRow = {
            id: `pesagem-${Date.now()}`,
            qnt: 0,
            peso: 0,
            data: formattedDateNumbers.slice(0, 5)
        };
        setProductionUpdates(prev => [...prev, newRow]);
    };

    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(prev => prev.filter(r => r.id !== id));
    };

    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    // Cálculos em Tempo Real
    const calculatedData = useMemo(() => {
        const secondsParadoA = stopsShiftA.reduce((sum, stop) => sum + calculateStopDurationSeconds(stop.inicio, stop.fim), 0);
        const secondsParadoB = stopsShiftB.reduce((sum, stop) => sum + calculateStopDurationSeconds(stop.inicio, stop.fim), 0);

        const totalWorkedA = timeToSeconds(statsShiftA.horasTrabalhadas) || 9 * 3600;
        const totalWorkedB = timeToSeconds(statsShiftB.horasTrabalhadas) || 9 * 3600;

        const percentParadoA = totalWorkedA > 0 ? (secondsParadoA / totalWorkedA) * 100 : 0;
        const secondsEfetivoA = Math.max(0, totalWorkedA - secondsParadoA);
        const percentEfetivoA = totalWorkedA > 0 ? (secondsEfetivoA / totalWorkedA) * 100 : 0;

        const percentParadoB = totalWorkedB > 0 ? (secondsParadoB / totalWorkedB) * 100 : 0;
        const secondsEfetivoB = Math.max(0, totalWorkedB - secondsParadoB);
        const percentEfetivoB = totalWorkedB > 0 ? (secondsEfetivoB / totalWorkedB) * 100 : 0;

        const metrosProduzidosA = statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca;
        const metrosProduzidosB = statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca;

        const tempoPorPecaSecondsA = statsShiftA.pecasProduzidas > 0 ? (secondsEfetivoA / statsShiftA.pecasProduzidas) : 0;
        const tempoPorPecaSecondsB = statsShiftB.pecasProduzidas > 0 ? (secondsEfetivoB / statsShiftB.pecasProduzidas) : 0;

        const velocidadeMinutoA = secondsEfetivoA > 0 ? (metrosProduzidosA / (secondsEfetivoA / 60)) : 0;
        const velocidadeMinutoB = secondsEfetivoB > 0 ? (metrosProduzidosB / (secondsEfetivoB / 60)) : 0;

        const totalPecasProduzidas = statsShiftA.pecasProduzidas + statsShiftB.pecasProduzidas;

        const totalUpdateQnt = productionUpdates.reduce((sum, r) => sum + (Number(r.qnt) || 0), 0);
        const totalUpdateWeight = productionUpdates.reduce((sum, r) => sum + (Number(r.peso) || 0), 0);
        const totalUpdateAverage = totalUpdateQnt > 0 ? (totalUpdateWeight / totalUpdateQnt) : 0;

        return {
            totalPecasProduzidas,
            totalUpdateQnt,
            totalUpdateWeight,
            totalUpdateAverage,
            turnoA: {
                tempoParadoStr: secondsToTime(secondsParadoA),
                percentParado: percentParadoA.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoA),
                percentEfetivo: percentEfetivoA.toFixed(1).replace('.', ','),
                metrosProduzidos: metrosProduzidosA,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsA)),
                velocidadeStr: `${velocidadeMinutoA.toFixed(1).replace('.', ',')} metros/ minuto`
            },
            turnoB: {
                tempoParadoStr: secondsToTime(secondsParadoB),
                percentParado: percentParadoB.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoB),
                percentEfetivo: percentEfetivoB.toFixed(1).replace('.', ','),
                metrosProduzidos: metrosProduzidosB,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsB)),
                velocidadeStr: `${velocidadeMinutoB.toFixed(1).replace('.', ',')} metros/ minuto`
            }
        };
    }, [stopsShiftA, stopsShiftB, statsShiftA, statsShiftB, productionUpdates]);

    // AÇÃO 1: IMPRESSÃO LIMPA EM FOLHA A4
    const handlePrint = () => {
        window.print();
    };

    // AÇÃO 2: COPIAR IMAGEM HD PARA WHATSAPP
    const handleCopyToWhatsApp = async () => {
        try {
            const element = document.getElementById('pcp-daily-report-sheet');
            if (!element) return;

            showToast('Gerando imagem de alta resolução para WhatsApp...', 'info');

            // Sincronizar os valores dos inputs para atributos do DOM
            const inputsToSync = element.querySelectorAll('input.modern-editable-input');
            inputsToSync.forEach((input: any) => {
                input.setAttribute('value', input.value);
            });

            element.classList.add('is-capturing');
            await new Promise(resolve => setTimeout(resolve, 80));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.getElementById('pcp-daily-report-sheet');
                    if (!clonedElement) return;

                    const clonedInputs = clonedElement.querySelectorAll('input.modern-editable-input');
                    clonedInputs.forEach((input: any) => {
                        const div = clonedDoc.createElement('div');
                        div.className = input.className;
                        div.textContent = input.getAttribute('value') || '';
                        div.style.display = 'inline-block';
                        div.style.minHeight = '1.5em';
                        div.style.lineHeight = '1.4';
                        div.style.paddingTop = '2px';
                        div.style.paddingBottom = '4px';
                        div.style.whiteSpace = 'nowrap';
                        div.style.overflow = 'visible';
                        input.parentNode?.replaceChild(div, input);
                    });
                }
            });

            element.classList.remove('is-capturing');

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                        showToast('Imagem copiada com sucesso! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        console.error('Falha ao copiar direto para o clipboard:', err);
                        const link = document.createElement('a');
                        link.download = `Relatorio_${machine.replace(/\s+/g, '_')}_${selectedDate}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        showToast('Baixamos o relatório como imagem! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('pcp-daily-report-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem para o WhatsApp.', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col z-[150] overflow-y-auto print:bg-white print:p-0 print:overflow-visible animate-fade select-none">
            {/* CSS de Impressão e Captura */}
            <style dangerouslySetInnerHTML={{ __html: `
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
                .worksheet-container {
                    font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
                }
                .modern-editable-input {
                    border: none !important;
                    background: transparent !important;
                    font-weight: 800 !important;
                    color: #002060 !important;
                    padding: 2px 4px !important;
                    margin: 0 !important;
                    outline: none !important;
                    box-shadow: none !important;
                    transition: all 0.2s;
                    border-bottom: 1.5px dashed transparent !important;
                    border-radius: 0 !important;
                    height: auto !important;
                    line-height: normal !important;
                }
                .modern-editable-input:hover {
                    border-bottom: 1.5px dashed #3b82f6 !important;
                    background-color: rgba(59, 130, 246, 0.04) !important;
                }
                .modern-editable-input:focus {
                    border-bottom: 2px solid #002060 !important;
                    background-color: rgba(59, 130, 246, 0.08) !important;
                    outline: none !important;
                }
                .modern-editable-input::placeholder {
                    color: #94a3b8;
                    font-weight: 500;
                    opacity: 0.6;
                }
                @media print {
                    @page { size: A4 portrait; margin: 6mm 5mm 6mm 5mm; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    html, body {
                        margin: 0 !important; padding: 0 !important;
                        background: white !important; overflow: visible !important; height: auto !important;
                    }
                    .no-print, .sidebar, nav, header {
                        display: none !important; visibility: hidden !important;
                    }
                    .print-sheet {
                        max-width: 100% !important; width: 100% !important;
                        overflow: visible !important; height: auto !important; max-height: none !important;
                        box-shadow: none !important; border: 2px solid #002060 !important;
                    }
                    #pcp-daily-report-sheet, #pcp-daily-report-sheet * {
                        overflow: visible !important; max-height: none !important;
                    }
                    #pcp-daily-report-sheet { height: auto !important; }
                    #pcp-daily-report-sheet img {
                        max-height: 72px !important; height: auto !important;
                        object-fit: contain !important; display: block !important;
                    }
                    #pcp-daily-report-sheet table, #pcp-daily-report-sheet thead,
                    #pcp-daily-report-sheet tbody, #pcp-daily-report-sheet tr,
                    #pcp-daily-report-sheet td, #pcp-daily-report-sheet th {
                        page-break-inside: avoid !important; break-inside: avoid !important;
                        overflow: visible !important;
                    }
                    .modern-editable-input {
                        border-bottom: none !important; background: transparent !important;
                        pointer-events: none !important; line-height: 1.3 !important;
                        height: auto !important; overflow: visible !important;
                        display: block !important; padding: 1px 2px !important;
                    }
                    input::placeholder, .modern-editable-input::placeholder {
                        color: transparent !important; opacity: 0 !important;
                    }
                }
                .is-capturing .no-print {
                    display: none !important;
                }
                .is-capturing {
                    padding: 0 !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: 2px solid #002060 !important;
                    width: 1024px !important;
                    max-width: 1024px !important;
                }
                .is-capturing .modern-editable-input {
                    border-bottom: none !important;
                    background: transparent !important;
                    pointer-events: none !important;
                    padding-top: 2px !important;
                    padding-bottom: 4px !important;
                    line-height: 1.4 !important;
                }
            `}} />

            {/* Toasts Flutuantes */}
            <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold font-mono transition-all transform animate-bounce duration-300 flex items-center gap-2 border pointer-events-auto ${
                            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' :
                            toast.type === 'error' ? 'bg-rose-600 text-white border-rose-400' :
                            toast.type === 'warning' ? 'bg-amber-600 text-white border-amber-400' :
                            'bg-slate-900 text-white border-slate-700'
                        }`}
                    >
                        <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Barra de Ações Superior (Exclusiva do PCP, Oculta na Impressão) */}
            <div className="sticky top-0 z-50 bg-[#08131B]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 no-print">
                {/* Lado Esquerdo: Identificação e Navegação de Data */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
                        title="Voltar para o Quadro PCP"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-white text-sm sm:text-base font-black uppercase tracking-wider">
                                Ficha Oficial de Produção Diária
                            </h2>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-mono">
                                {machine}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                            <span>Quadro PCP • OP #{productionOrder || op.orderNumber}</span>
                            <span className="text-slate-600">•</span>
                            {saveStatus === 'saving' ? (
                                <span className="text-amber-400 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                    Salvando...
                                </span>
                            ) : saveStatus === 'saved' ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span>💾</span> Salvo no Banco
                                </span>
                            ) : (
                                <span className="text-rose-400 font-bold">⚠️ Erro ao salvar online</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Centro/Direita: Controles e Ações */}
                <div className="flex items-center flex-wrap gap-2">
                    {/* Seletor de Data */}
                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase font-mono">Data:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white border-none p-0 focus:ring-0 focus:outline-none cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>

                    {/* Botão Sincronizar Dados do Chão de Fábrica */}
                    <button
                        type="button"
                        onClick={handleReloadAutoData}
                        className="px-3 py-1.5 rounded-xl bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25 text-[#00E5FF] hover:text-white border border-[#00E5FF]/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                        title="Sincronizar e recarregar dados exatos do chão de fábrica e PCP desta data"
                    >
                        <span>🔄</span>
                        <span className="hidden sm:inline">Sincronizar Chão de Fábrica</span>
                    </button>

                    {/* Botão Salvar Manual */}
                    <button
                        type="button"
                        onClick={() => saveReportData(selectedDate, {
                            productionOrder,
                            operatorShiftA,
                            operatorShiftB,
                            productDescription,
                            piecesToProduce,
                            stopsShiftA,
                            stopsShiftB,
                            statsShiftA,
                            statsShiftB,
                            productionUpdates,
                            reportId: reportIdRef.current,
                        }, true)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                        title="Salvar agora no Supabase"
                    >
                        <span>💾</span>
                        <span>Salvar</span>
                    </button>

                    {/* Botão Copiar para WhatsApp */}
                    <button
                        type="button"
                        onClick={handleCopyToWhatsApp}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95"
                        title="Copiar imagem de alta resolução para colar no WhatsApp"
                    >
                        <span>🟢</span>
                        <span>Copiar WhatsApp</span>
                    </button>

                    {/* Botão Imprimir */}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3.5 py-1.5 rounded-xl bg-[#002060] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition cursor-pointer active:scale-95"
                        title="Imprimir ficha em formato A4"
                    >
                        <span>🖨️</span>
                        <span>Imprimir</span>
                    </button>

                    {/* Botão Fechar */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer ml-1"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Conteúdo Central: Folha Oficial da Ficha Técnica */}
            <div className="flex-1 p-3 sm:p-6 md:p-8 flex justify-center items-start">
                {loading ? (
                    <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-2xl text-center font-bold text-slate-600 animate-pulse w-full max-w-5xl my-auto">
                        <span className="text-3xl block mb-3">⚙️</span>
                        Carregando e compilando ficha de produção diária...
                    </div>
                ) : (
                    <div
                        id="pcp-daily-report-sheet"
                        className="bg-white max-w-5xl w-full worksheet-container print-sheet border-2 border-[#002060] rounded-xl overflow-hidden shadow-2xl my-auto"
                    >
                        {/* Cabeçalho de Alta Fidelidade - Idêntico ao Modelo Oficial */}
                        <div className="grid grid-cols-1 md:grid-cols-12 border-b-2 border-[#002060]">
                            {/* Bloco 1: Logo */}
                            <div className="col-span-1 md:col-span-3 bg-white p-2.5 flex items-center justify-center md:border-r-2 border-[#002060]">
                                <img
                                    src="/ita-acos-logo.png"
                                    alt="Logo Grupo Ita Aços"
                                    className="h-16 md:h-20 object-contain"
                                    style={{ maxHeight: '82px' }}
                                />
                            </div>

                            {/* Bloco 2: Título Central */}
                            <div className="col-span-1 md:col-span-6 bg-[#002060] text-white p-4 flex flex-col justify-center text-center md:text-left md:pl-8">
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider leading-none text-white">
                                    Controle de Produção Diária
                                </h2>
                                <p className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-slate-300 mt-1">
                                    Setor Laminação – {machine}
                                </p>
                            </div>

                            {/* Bloco 3: Data com Seletor Oculto Interativo */}
                            <div className="col-span-1 md:col-span-3 bg-[#002060] text-white p-3 flex items-center justify-center border-t-2 md:border-t-0 md:border-l-2 border-white relative">
                                <div
                                    onClick={() => {
                                        try {
                                            dateInputRef.current?.showPicker();
                                        } catch {
                                            dateInputRef.current?.click();
                                        }
                                    }}
                                    className="relative cursor-pointer hover:bg-slate-800/40 p-2 rounded transition-colors flex items-center gap-2.5 w-full justify-center md:justify-start"
                                >
                                    <CalendarIcon className="h-6 w-6 text-white" />
                                    <div>
                                        <div className="text-[9px] font-black text-slate-300 tracking-wider">DATA DA PRODUÇÃO</div>
                                        <div className="text-base font-black text-white leading-tight">{formattedDateNumbers}</div>
                                        <div className="text-[10px] font-extrabold text-slate-300 uppercase">{formattedDayOfWeek}</div>
                                    </div>
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Metadados e Ordem de Produção */}
                        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-200 bg-[#fbfcfd]">
                            {/* Coluna 1: Ordem de Produção e Operador Turno A */}
                            <div className="col-span-1 md:col-span-4 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                                <div className="flex items-start gap-2.5">
                                    <ClipboardIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                    <div className="flex-grow">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">ORDEM DE PRODUÇÃO</div>
                                        <input
                                            type="text"
                                            value={productionOrder}
                                            onChange={e => setProductionOrder(e.target.value)}
                                            className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input"
                                            placeholder="Digite a OP..."
                                        />
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                    <UserIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                    <div className="flex-grow">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO A</div>
                                        <input
                                            type="text"
                                            value={operatorShiftA}
                                            onChange={e => setOperatorShiftA(e.target.value)}
                                            className="w-full text-xs font-black text-slate-700 bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                            placeholder="Nome do operador..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 2: Descrição do Produto e Operador Turno B */}
                            <div className="col-span-1 md:col-span-5 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                                <div className="flex items-start gap-2.5">
                                    <TagIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                    <div className="flex-grow">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO</div>
                                        <input
                                            type="text"
                                            value={productDescription}
                                            onChange={e => setProductDescription(e.target.value)}
                                            className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                            placeholder="Ex: TRELIÇA H-12 LEVE 6 MTS"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                    <UserIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                    <div className="flex-grow">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO B</div>
                                        <input
                                            type="text"
                                            value={operatorShiftB}
                                            onChange={e => setOperatorShiftB(e.target.value)}
                                            className="w-full text-xs font-black text-slate-700 bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                            placeholder="Nome do operador..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 3: Quantidade de Peças Produzidas */}
                            <div className="col-span-1 md:col-span-3 p-4 flex flex-col justify-center items-center text-center bg-white">
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                    QUANTIDADE DE PEÇAS PRODUZIDAS
                                </div>
                                <div className="text-3xl sm:text-4xl font-black text-[#002060] tracking-tight flex items-baseline gap-1">
                                    <span>{calculatedData.totalPecasProduzidas.toLocaleString('pt-BR')}</span>
                                    <span className="text-xs font-extrabold text-slate-400 uppercase">peças</span>
                                </div>
                            </div>
                        </div>

                        {/* Paradas e Seus Motivos – Turno A e Turno B (Lado a Lado) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-slate-200">
                            {/* Paradas Turno A */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider">
                                    <span className="uppercase">PARADAS E SEUS MOTIVOS – TURNO A</span>
                                    <button
                                        type="button"
                                        onClick={() => addStopRow('A')}
                                        className="border border-white hover:bg-white hover:text-[#002060] text-white text-[9px] font-bold px-2 py-0.5 rounded transition-all no-print cursor-pointer uppercase"
                                    >
                                        + Linha
                                    </button>
                                </div>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase">
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Início</th>
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Fim</th>
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '70px' }}>Duração</th>
                                            <th className="py-1.5 text-left pl-3">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stopsShiftA.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                                    Nenhuma parada registrada no Turno A.
                                                </td>
                                            </tr>
                                        ) : (
                                            stopsShiftA.map(stop => {
                                                const durationSecs = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                                return (
                                                    <tr key={stop.id} className="border-b border-slate-200 hover:bg-slate-50/50 group text-xs">
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="text"
                                                                value={stop.inicio}
                                                                onChange={e => updateStopField('A', stop.id, 'inicio', e.target.value)}
                                                                className="modern-editable-input text-center text-rose-600 w-full font-black text-xs"
                                                                placeholder="00:00:00"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="text"
                                                                value={stop.fim}
                                                                onChange={e => updateStopField('A', stop.id, 'fim', e.target.value)}
                                                                className="modern-editable-input text-center text-emerald-600 w-full font-black text-xs"
                                                                placeholder="00:00:00"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600 text-xs">
                                                            {secondsToTime(durationSecs)}
                                                        </td>
                                                        <td className="p-1 text-left pl-3 relative pr-8">
                                                            <input
                                                                type="text"
                                                                value={stop.motivo}
                                                                onChange={e => updateStopField('A', stop.id, 'motivo', e.target.value)}
                                                                className="modern-editable-input text-left text-slate-800 w-full font-bold text-xs"
                                                                placeholder="Motivo..."
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeStopRow('A', stop.id)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 hover:text-rose-800 font-black text-sm no-print opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Remover parada"
                                                            >
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paradas Turno B */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider">
                                    <span className="uppercase">PARADAS E SEUS MOTIVOS – TURNO B</span>
                                    <div className="flex items-center gap-1.5 no-print">
                                        {stopsShiftB.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setStopsShiftB([])}
                                                className="border border-white/50 hover:bg-rose-600/30 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer uppercase"
                                                title="Limpar paradas do Turno B"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => addStopRow('B')}
                                            className="border border-white hover:bg-white hover:text-[#002060] text-white text-[9px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer uppercase"
                                        >
                                            + Linha
                                        </button>
                                    </div>
                                </div>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase">
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Início</th>
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '75px' }}>Fim</th>
                                            <th className="py-1.5 border-r border-slate-200 text-center" style={{ width: '70px' }}>Duração</th>
                                            <th className="py-1.5 text-left pl-3">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stopsShiftB.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                                    Nenhuma parada registrada no Turno B.
                                                </td>
                                            </tr>
                                        ) : (
                                            stopsShiftB.map(stop => {
                                                const durationSecs = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                                return (
                                                    <tr key={stop.id} className="border-b border-slate-200 hover:bg-slate-50/50 group text-xs">
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="text"
                                                                value={stop.inicio}
                                                                onChange={e => updateStopField('B', stop.id, 'inicio', e.target.value)}
                                                                className="modern-editable-input text-center text-rose-600 w-full font-black text-xs"
                                                                placeholder="00:00:00"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="text"
                                                                value={stop.fim}
                                                                onChange={e => updateStopField('B', stop.id, 'fim', e.target.value)}
                                                                className="modern-editable-input text-center text-emerald-600 w-full font-black text-xs"
                                                                placeholder="00:00:00"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600 text-xs">
                                                            {secondsToTime(durationSecs)}
                                                        </td>
                                                        <td className="p-1 text-left pl-3 relative pr-8">
                                                            <input
                                                                type="text"
                                                                value={stop.motivo}
                                                                onChange={e => updateStopField('B', stop.id, 'motivo', e.target.value)}
                                                                className="modern-editable-input text-left text-slate-800 w-full font-bold text-xs"
                                                                placeholder="Motivo..."
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeStopRow('B', stop.id)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 hover:text-rose-800 font-black text-sm no-print opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Remover parada"
                                                            >
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Estatística do Dia – Turno A e Turno B (Lado a Lado) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-slate-200 bg-[#fbfcfd]">
                            {/* Estatísticas Turno A */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                    <GaugeIcon className="h-4 w-4 text-white" />
                                    <span>ESTATÍSTICA DO DIA – TURNO A</span>
                                </div>
                                <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
                                    {/* Horário Programado do Turno A */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-1.5 text-xs flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-[#002060]" />
                                            <span className="text-[10px] font-black uppercase text-[#002060] tracking-wider">Horário do Turno:</span>
                                            <input 
                                                type="text" 
                                                value={statsShiftA.horarioTurnoPrevisto || (machine.toLowerCase().includes('treli') ? '05:00 às 14:48' : '07:45 às 17:33')} 
                                                onChange={e => setStatsShiftA({ ...statsShiftA, horarioTurnoPrevisto: e.target.value })}
                                                className="modern-editable-input font-black text-xs text-slate-800 w-36 text-center border-b border-slate-300"
                                                placeholder="05:00 às 14:48"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9.5px] font-bold text-slate-500 uppercase">Carga Horária:</span>
                                            <span className="text-[10px] font-black text-[#002060] bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {machine.toLowerCase().includes('treli') ? '8h 48m' : '9h 48m'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Horas Trabalhadas */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Horas (Turno trabalhado)</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={statsShiftA.horasTrabalhadas}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, horasTrabalhadas: e.target.value })}
                                            className="modern-editable-input text-right w-24 text-slate-950 font-black text-sm"
                                        />
                                    </div>
                                    {/* Tempo Parada */}
                                    <div className="flex items-center justify-between py-2.5 bg-rose-50/30 px-1 rounded">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-rose-500" />
                                            <span className="text-[13px] font-black text-rose-600 uppercase tracking-tight">TEMPO DE MÁQUINA (PARADA)</span>
                                        </div>
                                        <div className="flex gap-4 font-black text-sm text-rose-600">
                                            <span>{calculatedData.turnoA.tempoParadoStr}</span>
                                            <span className="w-12 text-right">{calculatedData.turnoA.percentParado}%</span>
                                        </div>
                                    </div>
                                    {/* Tempo Efetivo */}
                                    <div className="flex items-center justify-between py-2.5 bg-emerald-50/30 px-1 rounded">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-emerald-500" />
                                            <span className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">TEMPO DE MÁQUINA (E EFETIVO)</span>
                                        </div>
                                        <div className="flex gap-4 font-black text-sm text-emerald-600">
                                            <span>{calculatedData.turnoA.tempoEfetivoStr}</span>
                                            <span className="w-12 text-right">{calculatedData.turnoA.percentEfetivo}%</span>
                                        </div>
                                    </div>
                                    {/* Peças Produzidas */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2 mr-2">
                                            <LayersIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de peças produzidas</span>
                                        </div>
                                        <div className="flex items-center gap-1 font-bold text-sm text-slate-950 shrink-0 whitespace-nowrap">
                                            <input
                                                type="number"
                                                value={statsShiftA.pecasProduzidas || ''}
                                                onChange={e => setStatsShiftA({ ...statsShiftA, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                                className="modern-editable-input text-center w-12 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                placeholder="0"
                                            />
                                            <span className="text-slate-500 font-bold text-xs px-0.5">peças de</span>
                                            <input
                                                type="number"
                                                value={statsShiftA.tamanhoPeca || ''}
                                                onChange={e => setStatsShiftA({ ...statsShiftA, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                                className="modern-editable-input text-center w-8 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                placeholder="0"
                                            />
                                            <span className="text-slate-500 font-bold text-xs pl-0.5">metros</span>
                                        </div>
                                    </div>
                                    {/* Metros Produzidos */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <RulerIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de metros produzidos</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoA.metrosProduzidos} metros</span>
                                    </div>
                                    {/* Tempo por Peça */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Tempo por peça (médio)</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoA.tempoPorPecaStr}</span>
                                    </div>
                                    {/* Velocidade */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <GaugeIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Velocidade (média)</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoA.velocidadeStr}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Estatísticas Turno B */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <GaugeIcon className="h-4 w-4 text-white" />
                                        <span>ESTATÍSTICA DO DIA – TURNO B</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStatsShiftB(prev => ({ ...prev, horasTrabalhadas: '00:00:00', pecasProduzidas: 0 }));
                                            setStopsShiftB([]);
                                            setOperatorShiftB('');
                                        }}
                                        className="border border-white/50 hover:bg-white hover:text-[#002060] text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-all no-print cursor-pointer"
                                        title="Zerar Turno B (caso não tenha havido 2º turno neste dia)"
                                    >
                                        Sem 2º Turno
                                    </button>
                                </div>
                                <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
                                    {/* Horário Programado do Turno B */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-1.5 text-xs flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-[#002060]" />
                                            <span className="text-[10px] font-black uppercase text-[#002060] tracking-wider">Horário do Turno:</span>
                                            <input 
                                                type="text" 
                                                value={statsShiftB.horarioTurnoPrevisto || (statsShiftB.horasTrabalhadas !== '00:00:00' ? (machine.toLowerCase().includes('treli') ? '14:48 às 23:36' : '14:00 às 23:59') : '')} 
                                                onChange={e => setStatsShiftB({ ...statsShiftB, horarioTurnoPrevisto: e.target.value })}
                                                className="modern-editable-input font-black text-xs text-slate-800 w-36 text-center border-b border-slate-300"
                                                placeholder="14:48 às 23:36"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {statsShiftB.horasTrabalhadas !== '00:00:00' ? (
                                                <>
                                                    <span className="text-[9.5px] font-bold text-slate-500 uppercase">Carga Horária:</span>
                                                    <span className="text-[10px] font-black text-[#002060] bg-white px-2 py-0.5 rounded border border-slate-200">
                                                        {machine.toLowerCase().includes('treli') ? '8h 48m' : '9h 00m'}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    Sem 2º Turno
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Horas Trabalhadas */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Horas (Turno trabalhado)</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={statsShiftB.horasTrabalhadas}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, horasTrabalhadas: e.target.value })}
                                            className="modern-editable-input text-right w-24 text-slate-950 font-black text-sm"
                                        />
                                    </div>
                                    {/* Tempo Parada */}
                                    <div className="flex items-center justify-between py-2.5 bg-rose-50/30 px-1 rounded">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-rose-500" />
                                            <span className="text-[13px] font-black text-rose-600 uppercase tracking-tight">TEMPO DE MÁQUINA (PARADA)</span>
                                        </div>
                                        <div className="flex gap-4 font-black text-sm text-rose-600">
                                            <span>{calculatedData.turnoB.tempoParadoStr}</span>
                                            <span className="w-12 text-right">{calculatedData.turnoB.percentParado}%</span>
                                        </div>
                                    </div>
                                    {/* Tempo Efetivo */}
                                    <div className="flex items-center justify-between py-2.5 bg-emerald-50/30 px-1 rounded">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-emerald-500" />
                                            <span className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">TEMPO DE MÁQUINA (E EFETIVO)</span>
                                        </div>
                                        <div className="flex gap-4 font-black text-sm text-emerald-600">
                                            <span>{calculatedData.turnoB.tempoEfetivoStr}</span>
                                            <span className="w-12 text-right">{calculatedData.turnoB.percentEfetivo}%</span>
                                        </div>
                                    </div>
                                    {/* Peças Produzidas */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2 mr-2">
                                            <LayersIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de peças produzidas</span>
                                        </div>
                                        <div className="flex items-center gap-1 font-bold text-sm text-slate-950 shrink-0 whitespace-nowrap">
                                            <input
                                                type="number"
                                                value={statsShiftB.pecasProduzidas || ''}
                                                onChange={e => setStatsShiftB({ ...statsShiftB, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                                className="modern-editable-input text-center w-12 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                placeholder="0"
                                            />
                                            <span className="text-slate-500 font-bold text-xs px-0.5">peças de</span>
                                            <input
                                                type="number"
                                                value={statsShiftB.tamanhoPeca || ''}
                                                onChange={e => setStatsShiftB({ ...statsShiftB, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                                className="modern-editable-input text-center w-8 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                placeholder="0"
                                            />
                                            <span className="text-slate-500 font-bold text-xs pl-0.5">metros</span>
                                        </div>
                                    </div>
                                    {/* Metros Produzidos */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <RulerIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de metros produzidos</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoB.metrosProduzidos} metros</span>
                                    </div>
                                    {/* Tempo por Peça */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Tempo por peça (médio)</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoB.tempoPorPecaStr}</span>
                                    </div>
                                    {/* Velocidade */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <GaugeIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Velocidade (média)</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoB.velocidadeStr}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Atualização da Produção (Lotes de Pesagem) */}
                        <div className="p-4 bg-[#fbfcfd]">
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm">
                                <div className="bg-[#002060] text-white py-2 text-center text-xs font-black tracking-wider uppercase">
                                    ATUALIZAÇÃO DA PRODUÇÃO
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 bg-slate-50/50 py-2 px-4 gap-2">
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                                        <span>Quantidade de peças a produzir:</span>
                                        <input
                                            type="number"
                                            value={piecesToProduce}
                                            onChange={e => setPiecesToProduce(parseInt(e.target.value, 10) || 0)}
                                            className="modern-editable-input text-center w-16 text-[#002060] font-black text-xs"
                                        />
                                        <span className="text-slate-500 font-medium">treliças</span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addProductionUpdateRow}
                                        className="bg-[#002060] hover:bg-slate-800 text-white text-[10px] font-black py-1 px-3.5 rounded shadow transition-colors no-print uppercase cursor-pointer"
                                    >
                                        + Registrar Peso
                                    </button>
                                </div>

                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#002060] text-white text-[10px] font-black uppercase border-b border-slate-700">
                                            <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Qnt.</th>
                                            <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Peso (kg)</th>
                                            <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Média (kg/peça)</th>
                                            <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Data</th>
                                            <th className="py-2 text-center no-print" style={{ width: '60px' }}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productionUpdates.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-5 text-slate-400 italic font-bold text-center text-xs">
                                                    Nenhum lote de pesagem registrado. Clique em "+ Registrar Peso".
                                                </td>
                                            </tr>
                                        ) : (
                                            productionUpdates.map(row => {
                                                const weightAverage = row.qnt > 0 ? (row.peso / row.qnt) : 0;
                                                return (
                                                    <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50/50 group text-xs">
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="number"
                                                                value={row.qnt || ''}
                                                                onChange={e => updateProductionUpdateField(row.id, 'qnt', parseInt(e.target.value, 10) || 0)}
                                                                className="modern-editable-input text-center w-full font-black text-xs"
                                                                placeholder="Qnt."
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="number"
                                                                value={row.peso || ''}
                                                                onChange={e => updateProductionUpdateField(row.id, 'peso', parseFloat(e.target.value) || 0)}
                                                                className="modern-editable-input text-center w-full font-black text-xs"
                                                                placeholder="Peso (Kg)"
                                                            />
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center font-black text-slate-800 text-xs">
                                                            {weightAverage > 0 ? weightAverage.toFixed(2).replace('.', ',') : ''}
                                                        </td>
                                                        <td className="p-1 border-r border-slate-200 text-center">
                                                            <input
                                                                type="text"
                                                                value={row.data}
                                                                onChange={e => updateProductionUpdateField(row.id, 'data', e.target.value)}
                                                                className="modern-editable-input text-center w-full font-black text-xs"
                                                                placeholder="Ex: 01/04"
                                                            />
                                                        </td>
                                                        <td className="p-1 text-center no-print">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeProductionUpdateRow(row.id)}
                                                                className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-2 py-0.5 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                title="Remover pesagem"
                                                            >
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                        {productionUpdates.length > 0 && (
                                            <tr className="bg-[#002060] font-black text-white text-xs border-t-2 border-[#002060]">
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white">
                                                    {calculatedData.totalUpdateQnt}
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white">
                                                    {calculatedData.totalUpdateWeight > 0 ? calculatedData.totalUpdateWeight.toLocaleString('pt-BR') : '0'}
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white">
                                                    {calculatedData.totalUpdateAverage > 0 ? calculatedData.totalUpdateAverage.toFixed(2).replace('.', ',') : '0,00'}
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center uppercase tracking-wider text-[10px] font-black text-white">
                                                    TOTAL / MÉDIA
                                                </td>
                                                <td className="p-2 text-center no-print"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Rodapé Oficial da Ficha */}
                        <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] font-bold text-slate-500">
                            Observação: Relatório gerado automaticamente - Sistema de Controle de Produção ⚙️
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyProductionReportSheetModal;
