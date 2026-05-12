import React, { useState, useEffect, useMemo } from 'react';
import type { Page, StockItem, ProductionRecord } from '../types';
import { supabase } from '../services/supabaseService';
import html2canvas from 'html2canvas';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
}

// Interfaces locais para estruturação do Relatório da Treliça
interface StopRow {
    id: string;
    inicio: string; // "hh:mm:ss"
    fim: string;    // "hh:mm:ss"
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string; // Padrão "09:00:00"
    pecasProduzidas: number;
    tamanhoPeca: number;      // Metros por peça (ex: 6 ou 12)
}

interface ProductionUpdateRow {
    id: string;
    qnt: number;
    peso: number;
    data: string; // ex: "1-04"
}

// Tipo de Notificação
interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

// Ícones em SVG de Alta Resolução para o Layout Premium
const CalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ClipboardIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const UserIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const GaugeIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 12 l5 -5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M6 12 a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2" />
    </svg>
);

const ClockIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LayersIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const RulerIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="8" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="6" y1="8" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
        <line x1="9" y1="8" x2="9" y2="11" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="8" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" />
        <line x1="18" y1="8" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

const Reports: React.FC<ReportsProps> = ({ stock, setPage }) => {
    // 1. Estados de Controle da Página
    const [selectedMachine, setSelectedMachine] = useState<'Treliça 1' | 'Treliça 2'>('Treliça 1');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        return new Date().toLocaleDateString('sv'); // Data local YYYY-MM-DD
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [reportId, setReportId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // 2. Estados dos Campos do Formulário
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operatorShiftA, setOperatorShiftA] = useState<string>('');
    const [operatorShiftB, setOperatorShiftB] = useState<string>('');
    const [productDescription, setProductDescription] = useState<string>('TRELIÇA H-12 LEVE 6 MTS');
    const [piecesToProduce, setPiecesToProduce] = useState<number>(4500);

    // Tabelas de paradas
    const [stopsShiftA, setStopsShiftA] = useState<StopRow[]>([]);
    const [stopsShiftB, setStopsShiftB] = useState<StopRow[]>([]);

    // Estatísticas dos turnos
    const [statsShiftA, setStatsShiftA] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 12
    });
    const [statsShiftB, setStatsShiftB] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 6
    });

    // Tabela de atualização da produção (rodapé)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    // Estado para guiar se o banco está ativo ou usando localStorage
    const [dbAvailable, setDbAvailable] = useState<boolean>(true);

    // Ref para autosave com debounce
    const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const reportIdRef = React.useRef<string | null>(null);
    // Atualiza o ref sempre que reportId muda
    React.useEffect(() => { reportIdRef.current = reportId; }, [reportId]);

    // 3. Sistema de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    // 4. Helpers de Cálculo de Horas e Tempos
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
        if (diff < 0) diff += 24 * 3600; // Dobra de meia-noite
        return diff;
    };

    // Formata data em português abreviado conforme a foto (ex: "qua, 1 de abril de 2026")
    const formattedProductionDate = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        
        // Obter dia da semana abreviado
        const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayName = weekdays[dateObj.getDay()];
        
        const day = dateObj.getDate();
        const year = dateObj.getFullYear();
        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        
        return `${dayName}, ${day} de ${monthName} de ${year}`;
    }, [selectedDate]);

    // Formata a data no estilo "DD/MM/YYYY"
    const formattedDateNumbers = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }, [selectedDate]);

    // Obtém o dia da semana por extenso em caixa alta (ex: "QUARTA-FEIRA")
    const formattedDayOfWeek = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const days = [
            'DOMINGO',
            'SEGUNDA-FEIRA',
            'TERÇA-FEIRA',
            'QUARTA-FEIRA',
            'QUINTA-FEIRA',
            'SEXTA-FEIRA',
            'SÁBADO'
        ];
        return days[dateObj.getDay()];
    }, [selectedDate]);

    // 5. Cálculos em Tempo Real
    const calculatedData = useMemo(() => {
        // Soma as paradas do Turno A
        const secondsParadoA = stopsShiftA.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Soma as paradas do Turno B
        const secondsParadoB = stopsShiftB.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Horas totais trabalhadas
        const totalWorkedA = timeToSeconds(statsShiftA.horasTrabalhadas) || 9 * 3600;
        const totalWorkedB = timeToSeconds(statsShiftB.horasTrabalhadas) || 9 * 3600;

        // Turno A
        const percentParadoA = totalWorkedA > 0 ? (secondsParadoA / totalWorkedA) * 100 : 0;
        const secondsEfetivoA = Math.max(0, totalWorkedA - secondsParadoA);
        const percentEfetivoA = totalWorkedA > 0 ? (secondsEfetivoA / totalWorkedA) * 100 : 0;

        // Turno B
        const percentParadoB = totalWorkedB > 0 ? (secondsParadoB / totalWorkedB) * 100 : 0;
        const secondsEfetivoB = Math.max(0, totalWorkedB - secondsParadoB);
        const percentEfetivoB = totalWorkedB > 0 ? (secondsEfetivoB / totalWorkedB) * 100 : 0;

        // Produção em metros
        const metrosProduzidosA = statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca;
        const metrosProduzidosB = statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca;

        // Tempo por peça
        const tempoPorPecaSecondsA = statsShiftA.pecasProduzidas > 0 ? (secondsEfetivoA / statsShiftA.pecasProduzidas) : 0;
        const tempoPorPecaSecondsB = statsShiftB.pecasProduzidas > 0 ? (secondsEfetivoB / statsShiftB.pecasProduzidas) : 0;

        // Velocidade (metros por minuto)
        const velocidadeMinutoA = secondsEfetivoA > 0 ? (metrosProduzidosA / (secondsEfetivoA / 60)) : 0;
        const velocidadeMinutoB = secondsEfetivoB > 0 ? (metrosProduzidosB / (secondsEfetivoB / 60)) : 0;

        // Soma total das peças
        const totalPecasProduzidas = statsShiftA.pecasProduzidas + statsShiftB.pecasProduzidas;

        return {
            totalPecasProduzidas,
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
    }, [stopsShiftA, stopsShiftB, statsShiftA, statsShiftB]);

    // 6. Efeito para carregar o rascunho salvo ao abrir a tela
    useEffect(() => {
        const loadDraft = () => {
            setLoading(true);
            const draft = localStorage.getItem('trelica_report_draft');
            if (draft) {
                try {
                    const parsed = JSON.parse(draft);
                    setReportId(parsed.id || null);
                    if (parsed.machine_type) setSelectedMachine(parsed.machine_type);
                    if (parsed.date) setSelectedDate(parsed.date);
                    setProductionOrder(parsed.production_order || '');
                    setOperatorShiftA(parsed.operator_shift_a || '');
                    setOperatorShiftB(parsed.operator_shift_b || '');
                    setProductDescription(parsed.product_description || 'TRELIÇA H-12 LEVE 6 MTS');
                    setPiecesToProduce(Number(parsed.pieces_to_produce ?? 4500));
                    setStopsShiftA(parsed.stops_shift_a || []);
                    setStopsShiftB(parsed.stops_shift_b || []);
                    setStatsShiftA(parsed.stats_shift_a || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 12 });
                    setStatsShiftB(parsed.stats_shift_b || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setProductionUpdates(parsed.production_updates || []);
                    showToast(`Rascunho recuperado.`, 'info');
                } catch (e) {
                    resetFormToDefault();
                }
            } else {
                resetFormToDefault();
            }
            setLoading(false);
        };

        loadDraft();
    }, []);

    const resetFormToDefault = () => {
        setReportId(null);
        setProductionOrder('');
        setOperatorShiftA('');
        setOperatorShiftB('');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);
        setStopsShiftA([]);
        setStopsShiftB([]);
        setStatsShiftA({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 12 });
        setStatsShiftB({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
        setProductionUpdates([]);
    };

    // Função central para salvar relatório (tanto localmente quanto na nuvem)
    // Recebe os dados EXPLICITAMENTE para evitar problemas de closure com estado desatualizado
    const saveReportData = (
        machine: 'Treliça 1' | 'Treliça 2',
        date: string,
        currentData: {
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
        options?: { showToastAlert?: boolean }
    ) => {
        const reportData = {
            date,
            machine_type: machine,
            production_order: currentData.productionOrder,
            operator_shift_a: currentData.operatorShiftA,
            operator_shift_b: currentData.operatorShiftB,
            product_description: currentData.productDescription,
            pieces_to_produce: currentData.piecesToProduce,
            stops_shift_a: currentData.stopsShiftA,
            stops_shift_b: currentData.stopsShiftB,
            stats_shift_a: currentData.statsShiftA,
            stats_shift_b: currentData.statsShiftB,
            production_updates: currentData.productionUpdates,
        };

        const localKey = 'trelica_report_draft';
        // Salva síncronamente no localStorage IMEDIATAMENTE (nunca perde dados)
        const localId = currentData.reportId || `local_${Date.now()}`;
        localStorage.setItem(localKey, JSON.stringify({ id: localId, ...reportData }));

        const saveToSupabase = async () => {
            if (!dbAvailable) {
                if (options?.showToastAlert) {
                    showToast(`Salvo localmente (Offline).`, 'warning');
                }
                return;
            }
            try {
                const payload = currentData.reportId ? { id: currentData.reportId, ...reportData } : reportData;
                const { data, error } = await supabase
                    .from('trelica_daily_reports')
                    .upsert(payload, { onConflict: 'date,machine_type' })
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setReportId(data.id);
                    reportIdRef.current = data.id;
                    localStorage.setItem(localKey, JSON.stringify({ ...reportData, id: data.id }));
                }
                if (options?.showToastAlert) {
                    showToast(`Salvo na nuvem com sucesso!`, 'success');
                }
            } catch (err: any) {
                console.error(err);
                if (options?.showToastAlert) {
                    showToast(`Erro ao salvar online. Salvo offline.`, 'warning');
                }
            }
        };

        return saveToSupabase();
    };

    // Helper para capturar o estado atual e chamar saveReportData
    const saveCurrentState = (machine: 'Treliça 1' | 'Treliça 2', date: string, options?: { showToastAlert?: boolean }) => {
        return saveReportData(machine, date, {
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
        }, options);
    };

    // Autosave: salva no localStorage sempre que qualquer dado do formulário mudar
    useEffect(() => {
        // Não executa no carregamento inicial (loading) para não sobrescrever com dados vazios
        if (loading) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            const localKey = 'trelica_report_draft';
            const reportData = {
                id: reportIdRef.current || `local_${Date.now()}`,
                date: selectedDate,
                machine_type: selectedMachine,
                production_order: productionOrder,
                operator_shift_a: operatorShiftA,
                operator_shift_b: operatorShiftB,
                product_description: productDescription,
                pieces_to_produce: piecesToProduce,
                stops_shift_a: stopsShiftA,
                stops_shift_b: stopsShiftB,
                stats_shift_a: statsShiftA,
                stats_shift_b: statsShiftB,
                production_updates: productionUpdates,
            };
            localStorage.setItem(localKey, JSON.stringify(reportData));
        }, 500); // debounce de 500ms

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [
        productionOrder, operatorShiftA, operatorShiftB, productDescription,
        piecesToProduce, stopsShiftA, stopsShiftB, statsShiftA, statsShiftB, productionUpdates,
        selectedMachine, selectedDate, loading
    ]);

    // Salvar relatório manualmente via botão
    const handleSaveReport = async () => {
        setIsSaving(true);
        await saveCurrentState(selectedMachine, selectedDate, { showToastAlert: true });
        setIsSaving(false);
    };

    // Troca de máquina: apenas atualiza o estado (o autosave cuida de salvar no rascunho)
    const handleSwitchMachine = (newMachine: 'Treliça 1' | 'Treliça 2') => {
        if (selectedMachine === newMachine) return;
        setSelectedMachine(newMachine);
    };

    // Troca de data: apenas atualiza o estado (o autosave cuida de salvar no rascunho)
    const handleSwitchDate = (newDate: string) => {
        if (selectedDate === newDate) return;
        setSelectedDate(newDate);
    };

    // Limpar e apagar o relatório de forma explícita com confirmação do usuário
    const handleClearReport = async () => {
        const confirmDelete = window.confirm("Deseja realmente limpar a tela e começar um novo formulário em branco?");
        if (!confirmDelete) return;

        setLoading(true);
        try {
            localStorage.removeItem('trelica_report_draft');
            showToast('Tela limpa com sucesso!', 'success');
        } catch (err) {
            console.error("Erro ao limpar:", err);
        } finally {
            resetFormToDefault();
            setLoading(false);
        }
    };

    // Preencher exatamente com os dados da foto
    const handleLoadSampleData = () => {
        setSelectedDate('2026-04-01');
        setProductionOrder('');
        setOperatorShiftA('Adrian/ junior');
        setOperatorShiftB('Alceu/ thiago');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);

        setStopsShiftB([
            { id: 'sb-1', inicio: '15:15:00', fim: '15:28:00', motivo: 'troca de rolo inferior lado direito' },
            { id: 'sb-2', inicio: '15:33:00', fim: '15:43:00', motivo: 'alinhamento da peça' },
            { id: 'sb-3', inicio: '16:10:00', fim: '16:24:00', motivo: 'troca de rolo inferior lado esquerdo' },
            { id: 'sb-4', inicio: '16:33:00', fim: '16:45:00', motivo: 'alinhamento da peça' },
            { id: 'sb-5', inicio: '18:19:00', fim: '18:34:00', motivo: 'enrosco na calha' },
            { id: 'sb-6', inicio: '19:54:00', fim: '20:18:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sb-7', inicio: '22:11:00', fim: '22:38:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        setStopsShiftA([
            { id: 'sa-1', inicio: '05:00:00', fim: '05:18:00', motivo: 'lubrificação' },
            { id: 'sa-2', inicio: '05:22:00', fim: '05:48:00', motivo: 'enrosco no fio sinuzoide' },
            { id: 'sa-3', inicio: '06:10:00', fim: '06:33:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-4', inicio: '06:44:00', fim: '07:01:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-5', inicio: '08:44:00', fim: '09:13:00', motivo: 'quebra de fio sinuzoide' },
            { id: 'sa-6', inicio: '11:10:00', fim: '11:18:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        setStatsShiftA({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 488,
            tamanhoPeca: 12
        });

        setStatsShiftB({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 493,
            tamanhoPeca: 6
        });

        setProductionUpdates([
            { id: 'pu-1', qnt: 981, peso: 3453, data: '1-04' },
            { id: 'pu-2', qnt: 981, peso: 3453, data: '' }
        ]);

        showToast('Dados do modelo da foto carregados!', 'success');
    };

    // Operações de linhas de tabelas
    const addStopRow = (shift: 'A' | 'B') => {
        const newStop: StopRow = {
            id: Math.random().toString(36).substring(2, 9),
            inicio: '00:00:00',
            fim: '00:00:00',
            motivo: ''
        };
        if (shift === 'A') setStopsShiftA([...stopsShiftA, newStop]);
        else setStopsShiftB([...stopsShiftB, newStop]);
    };

    const removeStopRow = (shift: 'A' | 'B', id: string) => {
        if (shift === 'A') setStopsShiftA(stopsShiftA.filter(r => r.id !== id));
        else setStopsShiftB(stopsShiftB.filter(r => r.id !== id));
    };

    const updateStopField = (shift: 'A' | 'B', id: string, field: keyof StopRow, value: string) => {
        const updater = (rows: StopRow[]) => rows.map(r => r.id === id ? { ...r, [field]: value } : r);
        if (shift === 'A') setStopsShiftA(updater);
        else setStopsShiftB(updater);
    };

    const addProductionUpdateRow = () => {
        const newRow: ProductionUpdateRow = {
            id: Math.random().toString(36).substring(2, 9),
            qnt: calculatedData.totalPecasProduzidas || 981,
            peso: 3453,
            data: '1-04'
        };
        setProductionUpdates([...productionUpdates, newRow]);
    };

    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(productionUpdates.filter(r => r.id !== id));
    };

    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(productionUpdates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('trelica-report-sheet');
            if (!element) return;
            
            showToast('Gerando imagem de alta resolução...', 'info');
            
            // Ativa o estilo de captura limpo (idêntico à impressão)
            element.classList.add('is-capturing');
            
            // Pequeno delay para garantir o repaint do navegador
            await new Promise(resolve => setTimeout(resolve, 80));
            
            const canvas = await html2canvas(element, {
                scale: 2, // Alta resolução para legibilidade perfeita no WhatsApp
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            // Remove o estilo de captura imediatamente após gerar o canvas
            element.classList.remove('is-capturing');
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                [blob.type]: blob
                            })
                        ]);
                        showToast('Imagem copiada para a área de transferência! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        console.error('Falha ao copiar:', err);
                        // Fallback: download as image
                        const link = document.createElement('a');
                        link.download = `Relatorio_Trelica_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Baixamos o relatório como imagem! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            // Garante que a classe de captura seja removida em caso de erro
            const element = document.getElementById('trelica-report-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-mono text-slate-800 relative select-none">
            
            {/* CSS de Alta Fidelidade com o Layout Premium do Mockup */}
            <style dangerouslySetInnerHTML={{ __html: `
                .worksheet-container {
                    font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
                }
                
                /* Inputs modernos "editáveis sobre hover" */
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
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-sheet {
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .modern-editable-input {
                        border-bottom: none !important;
                        background: transparent !important;
                        pointer-events: none !important;
                        padding: 0 !important;
                    }
                }

                /* ESTILOS DE CAPTURA DO WHATSAPP (IDÊNTICO À IMPRESSÃO) */
                .is-capturing .no-print {
                    display: none !important;
                }
                .is-capturing {
                    padding: 0 !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: none !important;
                    width: 1024px !important; /* Força largura fixa perfeita para o canvas */
                    max-width: 1024px !important;
                }
                .is-capturing .modern-editable-input {
                    border-bottom: none !important;
                    background: transparent !important;
                    pointer-events: none !important;
                    padding: 0 !important;
                }
            `}} />

            {/* Toasts de Notificação */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`p-3 rounded shadow border text-white font-bold text-xs flex items-center gap-2 pointer-events-auto max-w-sm ${
                            t.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
                            t.type === 'error' ? 'bg-rose-600 border-rose-500' :
                            'bg-slate-800 border-slate-700'
                        }`}
                    >
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Menu Admin - No Print */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-4 border-b border-slate-200 no-print gap-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
                        📋 Formato Ficha de Papel Treliça
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={handleLoadSampleData}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        ⭐ Carregar Modelo da Foto
                    </button>

                    <button
                        onClick={copyToClipboard}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1"
                    >
                        🟢 Copiar Imagem (Zap)
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        🖨️ Imprimir Ficha
                    </button>

                    <button
                        onClick={handleSaveReport}
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-black text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        {isSaving ? 'Salvando...' : '💾 Salvar Relatório'}
                    </button>

                    <button
                        onClick={handleClearReport}
                        className="bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 font-bold py-1.5 px-2 rounded text-xs transition-colors"
                    >
                        Limpar
                    </button>
                </div>
            </header>

            {/* Filtros - No Print */}
            <section className="bg-white p-4 rounded border border-slate-200 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                <div className="flex bg-slate-100 p-1 rounded border border-slate-200 w-full sm:w-auto">
                    {(['Treliça 1', 'Treliça 2'] as const).map(machine => (
                        <button
                            key={machine}
                            onClick={() => handleSwitchMachine(machine)}
                            className={`py-1 px-4 rounded font-bold text-xs transition-all ${
                                selectedMachine === machine
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {machine}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-bold text-slate-700 text-xs">Data:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => handleSwitchDate(e.target.value)}
                        className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    />
                </div>
            </section>

            {/* Ficha Técnica de Papel - ALTA FIDELIDADE */}
            {loading ? (
                <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-sm text-center font-bold text-slate-500 animate-pulse">
                    Carregando dados do relatório...
                </div>
            ) : (
                <div 
                    id="trelica-report-sheet" 
                    className="bg-white max-w-5xl mx-auto worksheet-container print-sheet border-2 border-[#002060] rounded-xl overflow-hidden shadow-lg"
                >
                    {/* Cabeçalho de Alta Fidelidade - Idêntico ao Mockup */}
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
                            <h2 
                                className="text-xl md:text-2xl font-black uppercase tracking-wider leading-none text-white"
                                style={{ color: '#ffffff' }}
                            >
                                Controle de Produção Diária
                            </h2>
                            <p 
                                className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-slate-300 mt-1"
                                style={{ color: '#cbd5e1' }}
                            >
                                Setor Laminação – {selectedMachine}
                            </p>
                        </div>

                        {/* Bloco 3: Data com Seletor Oculto Interativo */}
                        <div className="col-span-1 md:col-span-3 bg-[#002060] text-white p-3 flex items-center justify-center border-t-2 md:border-t-0 md:border-l-2 border-white relative">
                            <div className="relative cursor-pointer hover:bg-slate-800/40 p-2 rounded transition-colors flex items-center gap-2.5 w-full justify-center md:justify-start">
                                <CalendarIcon className="h-6 w-6 text-white" />
                                <div>
                                    <div className="text-[9px] font-black text-slate-300 tracking-wider">DATA DA PRODUÇÃO</div>
                                    <div className="text-base font-black text-white leading-tight">{formattedDateNumbers}</div>
                                    <div className="text-[10px] font-extrabold text-slate-300 uppercase">{formattedDayOfWeek}</div>
                                </div>
                                {/* Input nativo invisível por cima para interação direta com wow-factor */}
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => handleSwitchDate(e.target.value)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metadados e Ordem de Produção - Grid Premium */}
                    <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-200 bg-[#fbfcfd]">
                        {/* Coluna 1: Ordem de Produção e Operador Turno A */}
                        <div className="col-span-1 md:col-span-4 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                            <div className="flex items-start gap-2.5">
                                <ClipboardIcon className="h-5 w-5 text-[#002060] mt-0.5" />
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
                                <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                                <div className="flex-grow">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO A</div>
                                    <input 
                                        type="text" 
                                        value={operatorShiftA} 
                                        onChange={e => setOperatorShiftA(e.target.value)} 
                                        className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input uppercase"
                                        placeholder="Nome do Operador..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Coluna 2: Descrição do Produto e Operador Turno B */}
                        <div className="col-span-1 md:col-span-5 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                            <div className="flex items-start gap-2.5">
                                <div className="flex-grow pl-1">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO</div>
                                    <input 
                                        type="text" 
                                        value={productDescription} 
                                        onChange={e => setProductDescription(e.target.value)} 
                                        className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input"
                                    />
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                                <div className="flex-grow">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR - TURNO B</div>
                                    <input 
                                        type="text" 
                                        value={operatorShiftB} 
                                        onChange={e => setOperatorShiftB(e.target.value)} 
                                        className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input uppercase"
                                        placeholder="Nome do Operador..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Coluna 3: Quantidade Total Produzida (Destaque do Mockup) */}
                        <div className="col-span-1 md:col-span-3 p-4 flex flex-col justify-center items-center text-center bg-slate-50">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">QUANTIDADE DE PEÇAS PRODUZIDAS</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-[#002060] tracking-tight">{calculatedData.totalPecasProduzidas}</span>
                                <span className="text-sm font-bold text-slate-600">peças</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabelas de Paradas dos Turnos A e B - Lado a Lado */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-slate-200">
                        {/* Paradas Turno A */}
                        <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider">
                                <span className="uppercase">PARADAS E SEUS MOTIVOS – TURNO A</span>
                                <button
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
                                <button
                                    onClick={() => addStopRow('B')}
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

                    {/* Seção de Estatísticas do Dia - Lado a Lado */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-slate-200 bg-[#fbfcfd]">
                        {/* Estatísticas Turno A */}
                        <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                <GaugeIcon className="h-4 w-4 text-white" />
                                <span>ESTATÍSTICA DO DIA – TURNO A</span>
                            </div>
                            <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
                                {/* Horas Trabalhadas */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Horas (Turno trabalhado)</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={statsShiftA.horasTrabalhadas}
                                        onChange={e => setStatsShiftA({ ...statsShiftA, horasTrabalhadas: e.target.value })}
                                        className="modern-editable-input text-right w-24 text-slate-900 font-black text-xs"
                                    />
                                </div>
                                {/* Tempo Parada */}
                                <div className="flex items-center justify-between py-2 bg-rose-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-rose-500" />
                                        <span className="text-xs font-black text-rose-600 uppercase tracking-tight">Tempo de máquina (parada)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-xs text-rose-600">
                                        <span>{calculatedData.turnoA.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentParado}%</span>
                                    </div>
                                </div>
                                {/* Tempo Efetivo */}
                                <div className="flex items-center justify-between py-2 bg-emerald-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-xs font-black text-emerald-600 uppercase tracking-tight">Tempo de máquina (E efetivo)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-xs text-emerald-600">
                                        <span>{calculatedData.turnoA.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentEfetivo}%</span>
                                    </div>
                                </div>
                                {/* Peças Produzidas (Editáveis) */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Quantidade de peças produzidas</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-bold text-xs text-slate-900">
                                        <input
                                            type="number"
                                            value={statsShiftA.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="modern-editable-input text-center w-12 text-slate-900 border-b border-slate-200 font-black text-xs"
                                            placeholder="Qnt."
                                        />
                                        <span className="text-slate-500">peças de</span>
                                        <input
                                            type="number"
                                            value={statsShiftA.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="modern-editable-input text-center w-12 text-slate-900 border-b border-slate-200 font-black text-xs"
                                            placeholder="Tam."
                                        />
                                        <span className="text-slate-500">metros</span>
                                    </div>
                                </div>
                                {/* Metros Produzidos */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <RulerIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Quantidade de metros produzidos</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca} metros</span>
                                </div>
                                {/* Tempo por Peça */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Tempo por peça (médio)</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{calculatedData.turnoA.tempoPorPecaStr}</span>
                                </div>
                                {/* Velocidade */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <GaugeIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Velocidade (média)</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{calculatedData.turnoA.velocidadeStr}</span>
                                </div>
                            </div>
                        </div>

                        {/* Estatísticas Turno B */}
                        <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                <GaugeIcon className="h-4 w-4 text-white" />
                                <span>ESTATÍSTICA DO DIA – TURNO B</span>
                            </div>
                            <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
                                {/* Horas Trabalhadas */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Horas (Turno trabalhado)</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={statsShiftB.horasTrabalhadas}
                                        onChange={e => setStatsShiftB({ ...statsShiftB, horasTrabalhadas: e.target.value })}
                                        className="modern-editable-input text-right w-24 text-slate-900 font-black text-xs"
                                    />
                                </div>
                                {/* Tempo Parada */}
                                <div className="flex items-center justify-between py-2 bg-rose-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-rose-500" />
                                        <span className="text-xs font-black text-rose-600 uppercase tracking-tight">Tempo de máquina (parada)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-xs text-rose-600">
                                        <span>{calculatedData.turnoB.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentParado}%</span>
                                    </div>
                                </div>
                                {/* Tempo Efetivo */}
                                <div className="flex items-center justify-between py-2 bg-emerald-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-xs font-black text-emerald-600 uppercase tracking-tight">Tempo de máquina (E efetivo)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-xs text-emerald-600">
                                        <span>{calculatedData.turnoB.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentEfetivo}%</span>
                                    </div>
                                </div>
                                {/* Peças Produzidas (Editáveis) */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Quantidade de peças produzidas</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-bold text-xs text-slate-900">
                                        <input
                                            type="number"
                                            value={statsShiftB.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="modern-editable-input text-center w-12 text-slate-900 border-b border-slate-200 font-black text-xs"
                                            placeholder="Qnt."
                                        />
                                        <span className="text-slate-500">peças de</span>
                                        <input
                                            type="number"
                                            value={statsShiftB.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="modern-editable-input text-center w-12 text-slate-900 border-b border-slate-200 font-black text-xs"
                                            placeholder="Tam."
                                        />
                                        <span className="text-slate-500">metros</span>
                                    </div>
                                </div>
                                {/* Metros Produzidos */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <RulerIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Quantidade de metros produzidos</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca} metros</span>
                                </div>
                                {/* Tempo por Peça */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Tempo por peça (médio)</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{calculatedData.turnoB.tempoPorPecaStr}</span>
                                </div>
                                {/* Velocidade */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <GaugeIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">Velocidade (média)</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{calculatedData.turnoB.velocidadeStr}</span>
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
                                    onClick={addProductionUpdateRow}
                                    className="bg-[#002060] hover:bg-slate-800 text-white text-[10px] font-black py-1 px-3.5 rounded shadow transition-colors no-print uppercase"
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
                                                            onClick={() => removeProductionUpdateRow(row.id)}
                                                            className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-2 py-0.5 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Remover pesagem"
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

                    {/* Barra de Legenda e Notas de Sistema (Idêntica ao Rodapé do Mockup) */}
                    <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-bold px-4 py-2 bg-slate-50 border-t border-slate-200 rounded-b-xl gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[#002060] font-black uppercase tracking-wider">LEGENDA</span>
                            <span className="flex items-center gap-1 text-rose-600 font-extrabold">
                                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                                Horário de início
                            </span>
                            <span className="flex items-center gap-1 text-emerald-600 font-extrabold">
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                Horário de fim
                            </span>
                            <span className="flex items-center gap-1 text-rose-600 font-black uppercase tracking-tight">
                                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                                Duração da parada
                            </span>
                        </div>
                        <div className="text-slate-400 text-right flex items-center gap-1 font-semibold">
                            Observação: Relatório gerado automaticamente - Sistema de Controle de Produção ⚙️
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Reports;