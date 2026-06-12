import React, { useState, useEffect, useMemo } from 'react';
import type { Page, StockItem, ProductionRecord } from '../types';
import { supabase } from '../services/supabaseService';
import html2canvas from 'html2canvas';

interface ReportsTrelicaProps {
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

const ReportsTrelica: React.FC<ReportsTrelicaProps> = ({ stock, setPage }) => {
    // 1. Estados de Controle da Página
    const [selectedMachine, setSelectedMachine] = useState<'Treliça 1' | 'Treliça 2'>('Treliça 1');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        return new Date().toLocaleDateString('sv'); // Data local YYYY-MM-DD
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [reportId, setReportId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Estados do modal de salvar relatório
    const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
    const [saveModalDate, setSaveModalDate] = useState<string>('');
    const [saveModalError, setSaveModalError] = useState<string>('');

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
    const dateInputRef = React.useRef<HTMLInputElement>(null);
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

    // Formatações de Data Seguras
    const safeDateObj = useMemo(() => {
        if (!selectedDate) return new Date();
        if (selectedDate.includes('/')) {
            const parts = selectedDate.split('/');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }
        if (selectedDate.includes('-')) {
            const parts = selectedDate.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
                if (parts[2].length === 4) {
                    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            }
        }
        const d = new Date(selectedDate);
        return isNaN(d.getTime()) ? new Date() : d;
    }, [selectedDate]);

    // Formata data em português abreviado conforme a foto (ex: "qua, 1 de abril de 2026")
    const formattedProductionDate = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return '';
        
        // Obter dia da semana abreviado
        const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayName = weekdays[safeDateObj.getDay()];
        
        const day = safeDateObj.getDate();
        const year = safeDateObj.getFullYear();
        const monthName = safeDateObj.toLocaleDateString('pt-BR', { month: 'long' });
        
        return `${dayName}, ${day} de ${monthName} de ${year}`;
    }, [safeDateObj]);

    // Formata a data no estilo "DD/MM/YYYY"
    const formattedDateNumbers = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return selectedDate || '';
        return safeDateObj.toLocaleDateString('pt-BR');
    }, [safeDateObj, selectedDate]);

    // Obtém o dia da semana por extenso em caixa alta (ex: "QUARTA-FEIRA")
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

        // Totais de atualização de produção (pesagem)
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

    // Função para carregar o rascunho de uma máquina específica do localStorage
    const loadDraftForMachine = (machine: 'Treliça 1' | 'Treliça 2') => {
        setLoading(true);
        const localKey = `trelica_report_draft_${machine}`;
        const draft = localStorage.getItem(localKey);
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                setReportId(parsed.id || null);
                reportIdRef.current = parsed.id || null;
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
                showToast(`Rascunho de ${machine} carregado.`, 'info');
            } catch (e) {
                resetFormToDefault();
            }
        } else {
            resetFormToDefault();
        }
        setLoading(false);
    };

    // 6. Carregamento inicial do rascunho ao abrir a tela
    useEffect(() => {
        loadDraftForMachine(selectedMachine);
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

        const localKey = `trelica_report_draft_${machine}`;
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

    // Autosave: salva no localStorage específico da máquina sempre que qualquer dado mudar
    useEffect(() => {
        // Não executa no carregamento inicial (loading) para não sobrescrever com dados vazios
        if (loading) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            const localKey = `trelica_report_draft_${selectedMachine}`;
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

    // Chave para rastrear datas já salvas por máquina
    const getSavedDatesKey = (machine: 'Treliça 1' | 'Treliça 2') =>
        `trelica_saved_dates_${machine}`;

    // Obtém o conjunto de datas já salvas para uma máquina
    const getSavedDates = (machine: 'Treliça 1' | 'Treliça 2'): string[] => {
        try {
            const raw = localStorage.getItem(getSavedDatesKey(machine));
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    };

    // Registra uma data como salva para uma máquina
    const registerSavedDate = (machine: 'Treliça 1' | 'Treliça 2', date: string) => {
        const existing = getSavedDates(machine);
        if (!existing.includes(date)) {
            localStorage.setItem(getSavedDatesKey(machine), JSON.stringify([...existing, date]));
        }
    };

    // Abre o modal de salvar relatório
    const handleOpenSaveModal = () => {
        setSaveModalDate(selectedDate);
        setSaveModalError('');
        setShowSaveModal(true);
    };

    // Confirma o salvamento após seleção da data no modal
    const handleConfirmSave = async () => {
        if (!saveModalDate) {
            setSaveModalError('Selecione uma data para salvar o relatório.');
            return;
        }
        const savedDates = getSavedDates(selectedMachine);
        if (savedDates.includes(saveModalDate)) {
            const [year, month, day] = saveModalDate.split('-');
            setSaveModalError(
                `Já existe um relatório salvo para ${selectedMachine} no dia ${day}/${month}/${year}. Só é possível salvar um relatório por máquina por dia.`
            );
            return;
        }
        setShowSaveModal(false);
        setIsSaving(true);
        await saveCurrentState(selectedMachine, saveModalDate, { showToastAlert: true });
        registerSavedDate(selectedMachine, saveModalDate);
        setIsSaving(false);
    };

    // Salvar relatório manualmente via botão (legado - mantido para compatibilidade)
    const handleSaveReport = async () => {
        handleOpenSaveModal();
    };

    // Troca de máquina: salva a atual e carrega a nova de forma totalmente independente
    const handleSwitchMachine = (newMachine: 'Treliça 1' | 'Treliça 2') => {
        if (selectedMachine === newMachine) return;
        
        // 1. Salva o rascunho atual antes de trocar de aba
        saveCurrentState(selectedMachine, selectedDate);
        
        // 2. Altera a máquina selecionada
        setSelectedMachine(newMachine);
        
        // 3. Carrega o rascunho independente da nova máquina
        loadDraftForMachine(newMachine);
    };

    // Troca de data: apenas atualiza o estado (o autosave cuida de salvar no rascunho)
    const handleSwitchDate = (newDate: string) => {
        if (selectedDate === newDate) return;
        setSelectedDate(newDate);
    };

    // Limpar e apagar o relatório de forma explícita com confirmação do usuário (específico por máquina)
    const handleClearReport = async () => {
        const confirmDelete = window.confirm(`Deseja realmente limpar a tela e começar um novo formulário em branco para a ${selectedMachine}?`);
        if (!confirmDelete) return;

        setLoading(true);
        try {
            const localKey = `trelica_report_draft_${selectedMachine}`;
            localStorage.removeItem(localKey);
            showToast(`Tela de ${selectedMachine} limpa com sucesso!`, 'success');
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
            
            // WORKAROUND HTML2CANVAS: Sincronizar o .value para o atributo HTML para o cloneNode pegá-lo
            const inputsToSync = element.querySelectorAll('input.modern-editable-input');
            inputsToSync.forEach((input: any) => {
                input.setAttribute('value', input.value);
            });
            
            // Ativa o estilo de captura limpo (idêntico à impressão)
            element.classList.add('is-capturing');
            
            // Pequeno delay para garantir o repaint do navegador
            await new Promise(resolve => setTimeout(resolve, 80));
            
            const canvas = await html2canvas(element, {
                scale: 2, // Alta resolução para legibilidade perfeita no WhatsApp
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // SUBSTITUIR INPUTS POR DIVS NO CLONE PARA EVITAR CORTE DE TEXTO
                    const clonedElement = clonedDoc.getElementById('trelica-report-sheet');
                    if (!clonedElement) return;
                    
                    const clonedInputs = clonedElement.querySelectorAll('input.modern-editable-input');
                    clonedInputs.forEach((input: any) => {
                        const div = clonedDoc.createElement('div');
                        div.className = input.className;
                        div.textContent = input.getAttribute('value') || '';
                        
                        // Garante que o div se comporte como o input mas force render do texto sem cortar
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
                /* Remove setas padrão de inputs numéricos (Chrome, Safari, Edge, Opera) */
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                /* Remove setas padrão de inputs numéricos (Firefox) */
                input[type=number] {
                    -moz-appearance: textfield;
                }

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
                    @page { size: A4 portrait; margin: 6mm 5mm 6mm 5mm; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    html, body {
                        margin: 0 !important; padding: 0 !important;
                        background: white !important; overflow: visible !important; height: auto !important;
                    }
                    html body .no-print, html body .sidebar, .no-print, .sidebar {
                        display: none !important; visibility: hidden !important;
                    }
                    #root {
                        display: block !important; width: 100% !important; max-width: 100% !important;
                        height: auto !important; max-height: none !important;
                        padding: 0 !important; margin: 0 !important;
                        overflow: visible !important; position: static !important;
                        border: none !important; box-shadow: none !important;
                    }
                    .print-sheet {
                        max-width: 100% !important; width: 100% !important;
                        overflow: visible !important; height: auto !important; max-height: none !important;
                        box-shadow: none !important;
                    }
                    #trelica-report-sheet, #trelica-report-sheet * {
                        overflow: visible !important; max-height: none !important;
                    }
                    #trelica-report-sheet { height: auto !important; }
                    #trelica-report-sheet img {
                        max-height: 72px !important; height: auto !important;
                        object-fit: contain !important; display: block !important;
                    }
                    #trelica-report-sheet table, #trelica-report-sheet thead,
                    #trelica-report-sheet tbody, #trelica-report-sheet tr,
                    #trelica-report-sheet td, #trelica-report-sheet th {
                        page-break-inside: avoid !important; break-inside: avoid !important;
                        overflow: visible !important;
                    }
                    #trelica-report-sheet thead { display: table-header-group !important; }
                    #trelica-report-sheet tbody { display: table-row-group !important; }
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
                    padding-top: 2px !important;
                    padding-bottom: 4px !important;
                    line-height: 1.4 !important;
                }
            `}} />

            {/* Modal de Salvar Relatório com Calendário */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center no-print" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-200 animate-in fade-in zoom-in" style={{ animation: 'modalIn 0.2s ease-out' }}>
                        <style dangerouslySetInnerHTML={{ __html: `
                            @keyframes modalIn {
                                from { opacity: 0; transform: scale(0.93) translateY(8px); }
                                to   { opacity: 1; transform: scale(1) translateY(0); }
                            }
                        ` }} />
                        {/* Cabeçalho do modal */}
                        <div className="bg-[#002060] px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <div>
                                    <div className="text-white font-black text-sm uppercase tracking-wide">Salvar Relatório</div>
                                    <div className="text-slate-300 text-[10px] font-semibold">{selectedMachine}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowSaveModal(false)} className="text-slate-300 hover:text-white transition-colors p-1 rounded">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Corpo do modal */}
                        <div className="px-6 py-5">
                            <p className="text-xs text-slate-500 font-semibold mb-4 leading-relaxed">
                                Selecione o dia que deseja salvar este relatório. <strong className="text-slate-800">Cada máquina só permite um relatório por dia.</strong>
                            </p>

                            {/* Calendário / Seletor de Data */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Data do Relatório</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={saveModalDate}
                                        onChange={e => { setSaveModalDate(e.target.value); setSaveModalError(''); }}
                                        max={new Date().toLocaleDateString('sv')}
                                        className="w-full border-2 border-slate-200 focus:border-[#002060] rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-colors cursor-pointer"
                                        style={{ colorScheme: 'light' }}
                                    />
                                </div>
                            </div>

                            {/* Datas já salvas */}
                            {(() => {
                                const savedDates = getSavedDates(selectedMachine);
                                if (savedDates.length === 0) return null;
                                return (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1.5">📅 Dias já salvos ({selectedMachine})</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {savedDates.slice().sort().map(d => {
                                                const [y, m, day] = d.split('-');
                                                return (
                                                    <span key={d} className="bg-amber-200 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                                        {day}/{m}/{y}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Mensagem de erro */}
                            {saveModalError && (
                                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                                    <svg className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs font-bold text-rose-700 leading-relaxed">{saveModalError}</p>
                                </div>
                            )}

                            {/* Botões de ação */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="flex-1 py-2.5 px-4 border-2 border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmSave}
                                    className="flex-1 py-2.5 px-4 bg-[#002060] hover:bg-[#001545] text-white font-black rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                    💾 Confirmar Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        onClick={handleOpenSaveModal}
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-black text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1.5"
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                Salvando...
                            </>
                        ) : '💾 Salvar Relatório'}
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
                            <div 
                                onClick={() => {
                                    try {
                                        dateInputRef.current?.showPicker();
                                    } catch (err) {
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
                                {/* Input nativo invisível por cima para interação direta com wow-factor */}
                                <input 
                                    ref={dateInputRef}
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
                                <div className="flex items-center justify-between py-2.5 bg-rose-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-rose-500" />
                                        <span className="text-[13px] font-black text-rose-600 uppercase tracking-tight">Tempo de máquina (parada)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-rose-600">
                                        <span>{calculatedData.turnoA.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentParado}%</span>
                                    </div>
                                </div>
                                {/* Tempo Efetivo */}
                                <div className="flex items-center justify-between py-2.5 bg-emerald-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">Tempo de máquina (E efetivo)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-emerald-600">
                                        <span>{calculatedData.turnoA.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentEfetivo}%</span>
                                    </div>
                                </div>
                                {/* Peças Produzidas (Editáveis) */}
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
                                            className="modern-editable-input text-center w-11 text-slate-950 border-b border-slate-200 font-black text-sm"
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
                                    <span className="text-sm font-black text-slate-950">{statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca} metros</span>
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
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                <GaugeIcon className="h-4 w-4 text-white" />
                                <span>ESTATÍSTICA DO DIA – TURNO B</span>
                            </div>
                            <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
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
                                <div className="flex items-center justify-between py-2.5 bg-rose-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-rose-500" />
                                        <span className="text-[13px] font-black text-rose-600 uppercase tracking-tight">Tempo de máquina (parada)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-rose-600">
                                        <span>{calculatedData.turnoB.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentParado}%</span>
                                    </div>
                                </div>
                                {/* Tempo Efetivo */}
                                <div className="flex items-center justify-between py-2.5 bg-emerald-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">Tempo de máquina (E efetivo)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-emerald-600">
                                        <span>{calculatedData.turnoB.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentEfetivo}%</span>
                                    </div>
                                </div>
                                {/* Peças Produzidas (Editáveis) */}
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
                                            className="modern-editable-input text-center w-11 text-slate-950 border-b border-slate-200 font-black text-sm"
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
                                    <span className="text-sm font-black text-slate-950">{statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca} metros</span>
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

                    {/* Barra de Notas de Sistema (Idêntica ao Rodapé do Mockup) */}
                    <div className="flex justify-end items-center text-[10px] text-slate-500 font-bold px-4 py-2 bg-slate-50 border-t border-slate-200 rounded-b-xl">
                        <div className="text-slate-400 text-right flex items-center gap-1 font-semibold">
                            Observação: Relatório gerado automaticamente - Sistema de Controle de Produção ⚙️
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default ReportsTrelica;