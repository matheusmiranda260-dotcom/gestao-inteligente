import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, ProductionOrderData, ShiftReport, StockItem } from '../types';
import html2canvas from 'html2canvas';
import { supabase } from '../services/supabaseService';

interface ReportsTrefilaProps {
    setPage: (page: Page) => void;
    productionOrders?: ProductionOrderData[];
    shiftReports?: ShiftReport[];
    stock?: StockItem[];
}

// Interfaces locais para estruturação do Relatório da Trefila
interface StopRow {
    id: string;
    inicio: string; // "hh:mm:ss"
    fim: string;    // "hh:mm:ss"
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string; // Padrão "09:45:00"
    pesoEntrada: number;
    pesoSaida: number;
    sucata: number;
    metrosProduzidos: number;
    velocidade: number;
}

interface ProductionUpdateRow {
    id: string;
    data: string; // ex: "07/05"
    kgEntrada: number;
    saida: number;
    bitola: string;
    isSeparator?: boolean;
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

const ReportsTrefila: React.FC<ReportsTrefilaProps> = ({ 
    setPage, 
    productionOrders = [], 
    shiftReports = [], 
    stock = [] 
}) => {
    // 1. Estados de Controle
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('sv'));
    const [loading, setLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Estados do modal de salvar relatório
    const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
    const [saveModalDate, setSaveModalDate] = useState<string>('');
    const [saveModalError, setSaveModalError] = useState<string>('');

    // Estados do modal de histórico
    const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
    const [historyDates, setHistoryDates] = useState<string[]>([]);

    // 1.1 Estados de Sincronização Automática com a Produção Diária (Chão de Fábrica)
    const [selectedMachine, setSelectedMachine] = useState<string>('Trefila 1');
    const [selectedOPId, setSelectedOPId] = useState<string>('');
    const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);

    // 2. Estados dos Campos do Formulário
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operator, setOperator] = useState<string>('');
    const [productDescriptionIn, setProductDescriptionIn] = useState<string>('8mm -- FIO MÁQUINA--');
    const [productDescriptionOut, setProductDescriptionOut] = useState<string>('6mm ---CA60--');

    // Tabela de paradas
    const [stops, setStops] = useState<StopRow[]>([]);

    // Estatísticas do turno
    const [stats, setStats] = useState<ShiftStats>({
        horasTrabalhadas: '09:45:00',
        pesoEntrada: 0,
        pesoSaida: 0,
        sucata: 0,
        metrosProduzidos: 0,
        velocidade: 0
    });

    // Tabela de atualização da produção
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 3. Sistema de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    // OPs disponíveis para a máquina e data selecionada
    const availableOPs = useMemo(() => {
        const selDateOnly = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate;
        return (productionOrders || []).filter(op => {
            const opMachine = op.scheduledMachine || (op.machine as string);
            const isTargetMach = opMachine === selectedMachine || 
                                 opMachine?.toLowerCase() === selectedMachine.toLowerCase() || 
                                 (selectedMachine === 'Trefila 1' && opMachine === 'Trefila');
            if (!isTargetMach) return false;

            const plannedDate = op.plannedStartDate ? op.plannedStartDate.split('T')[0] : '';
            const startDate = op.startTime ? op.startTime.split('T')[0] : '';
            const creationDate = op.creationDate ? op.creationDate.split('T')[0] : '';
            
            const hasEventOnDate = (op.downtimeEvents || []).some(e => e.stopTime && e.stopTime.startsWith(selDateOnly)) ||
                                   (op.processedLots || []).some(l => l.startTime && l.startTime.startsWith(selDateOnly));

            return plannedDate === selDateOnly || startDate === selDateOnly || creationDate === selDateOnly || hasEventOnDate || (op.status === 'Ativa');
        });
    }, [productionOrders, selectedMachine, selectedDate]);

    // Função que sincroniza a evolução do dia com a ficha de papel
    const syncDailyEvolution = (targetOpId?: string, forceToast = false) => {
        const selDateOnly = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate;

        let targetOP: ProductionOrderData | undefined;
        if (targetOpId) {
            targetOP = (productionOrders || []).find(o => o.id === targetOpId);
        } else if (selectedOPId) {
            targetOP = (productionOrders || []).find(o => o.id === selectedOPId);
        }

        // Se não houver OP específica escolhida, busca a OP ativa ou a primeira disponível da máquina
        if (!targetOP) {
            targetOP = availableOPs.find(o => o.status === 'Ativa') || availableOPs[0];
        }

        if (!targetOP) {
            // Se não encontrou OP da data, tenta buscar a OP ativa da máquina em qualquer data
            targetOP = (productionOrders || []).find(o => {
                const opMach = o.scheduledMachine || (o.machine as string);
                return (opMach === selectedMachine || opMach?.toLowerCase() === selectedMachine.toLowerCase() || (selectedMachine === 'Trefila 1' && opMach === 'Trefila')) && (o.status === 'Ativa' || o.status === 'Inativa');
            });
        }

        if (!targetOP) {
            if (forceToast) {
                showToast(`Nenhuma OP encontrada para a máquina ${selectedMachine} na data selecionada.`, 'warning');
            }
            return;
        }

        // 1. Preencher Metadados
        setProductionOrder(targetOP.orderNumber || '');
        if (targetOP.operator) {
            setOperator(targetOP.operator);
        } else {
            // Tenta buscar no shiftReports
            const relatedReport = (shiftReports || []).find(r => r.productionOrderId === targetOP?.id || r.orderNumber === targetOP?.orderNumber);
            if (relatedReport?.operator) setOperator(relatedReport.operator);
        }

        const inBitola = targetOP.inputBitola || '8.00';
        const outBitola = targetOP.targetBitola || '6.00';
        setProductDescriptionIn(`${inBitola}mm -- FIO MÁQUINA--`);
        setProductDescriptionOut(`${outBitola}mm ---CA60--`);

        // 2. Preencher Paradas (downtimeEvents)
        const formatTime = (iso?: string) => {
            if (!iso) return '00:00:00';
            const d = new Date(iso);
            return !isNaN(d.getTime()) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00';
        };

        const rawEvents = targetOP.downtimeEvents || [];
        // Filtra eventos da data selecionada, ou se for a OP ativa traz os eventos recentes
        const relevantEvents = rawEvents.filter(e => !e.stopTime || e.stopTime.startsWith(selDateOnly) || rawEvents.length <= 20);

        const newStops: StopRow[] = relevantEvents.map((ev, idx) => ({
            id: `auto-stop-${idx}-${Date.now()}`,
            inicio: formatTime(ev.stopTime),
            fim: ev.resumeTime ? formatTime(ev.resumeTime) : formatTime(new Date().toISOString()),
            motivo: ev.reason || 'Outros'
        }));

        if (newStops.length > 0) {
            setStops(newStops);
        }

        // 3. Preencher Lotes de Produção (processedLots, weighedPackages ou shiftReports)
        const newUpdates: ProductionUpdateRow[] = [];
        const dateShort = selDateOnly.split('-').slice(1).reverse().join('/'); // dd/mm

        (targetOP.processedLots || []).forEach((lot, idx) => {
            newUpdates.push({
                id: `lot-${idx}-${Date.now()}`,
                data: lot.startTime ? new Date(lot.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : dateShort,
                kgEntrada: Number(lot.weight || lot.initialWeight || 0),
                saida: Number(lot.producedWeight || lot.weight || 0),
                bitola: `${outBitola} mm`
            });
        });

        // Se houver weighedPackages não computados
        (targetOP.weighedPackages || []).forEach((pkg, pIdx) => {
            if (!newUpdates.some(u => u.saida === pkg.weight)) {
                newUpdates.push({
                    id: `pkg-${pIdx}-${Date.now()}`,
                    data: dateShort,
                    kgEntrada: 0,
                    saida: Number(pkg.weight || 0),
                    bitola: `${outBitola} mm`
                });
            }
        });

        // Se ainda não houver lotes mas houver shiftReports com peso
        if (newUpdates.length === 0) {
            const reportsForOP = (shiftReports || []).filter(r => r.productionOrderId === targetOP?.id || r.orderNumber === targetOP?.orderNumber);
            reportsForOP.forEach((rep, rIdx) => {
                if (rep.totalProducedWeight) {
                    newUpdates.push({
                        id: `rep-${rIdx}-${Date.now()}`,
                        data: rep.date || dateShort,
                        kgEntrada: 0,
                        saida: Number(rep.totalProducedWeight),
                        bitola: `${outBitola} mm`
                    });
                }
            });
        }

        if (newUpdates.length > 0) {
            setProductionUpdates(newUpdates);
        }

        // 4. Calcular Horas Trabalhadas
        if (targetOP.startTime) {
            const startD = new Date(targetOP.startTime);
            const nowD = new Date();
            const diffSec = Math.max(0, Math.floor((nowD.getTime() - startD.getTime()) / 1000));
            if (diffSec > 0 && diffSec < 24 * 3600) {
                const pad = (n: number) => String(n).padStart(2, '0');
                const h = Math.floor(diffSec / 3600);
                const m = Math.floor((diffSec % 3600) / 60);
                const s = diffSec % 60;
                setStats(prev => ({ ...prev, horasTrabalhadas: `${pad(h)}:${pad(m)}:${pad(s)}` }));
            }
        }

        if (forceToast) {
            showToast(`✅ Ficha auto-preenchida com os dados da OP #${targetOP.orderNumber}!`, 'success');
        }
    };

    // 4. Helpers de Cálculo
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

    // Formatações de Data
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

    const formattedProductionDate = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return '';
        const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayName = weekdays[safeDateObj.getDay()];
        const day = safeDateObj.getDate();
        const year = safeDateObj.getFullYear();
        const monthName = safeDateObj.toLocaleDateString('pt-BR', { month: 'long' });
        return `${dayName}, ${day} de ${monthName} de ${year}`;
    }, [safeDateObj]);

    const formattedDateNumbers = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return selectedDate || '';
        return safeDateObj.toLocaleDateString('pt-BR');
    }, [safeDateObj, selectedDate]);

    const formattedDayOfWeek = useMemo(() => {
        if (isNaN(safeDateObj.getTime())) return '';
        const weekdays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        return weekdays[safeDateObj.getDay()];
    }, [safeDateObj]);

    // 5. Motor de Cálculos Dinâmicos
    const calculatedData = useMemo(() => {
        const paradasSec = stops.reduce((acc, stop) => acc + calculateStopDurationSeconds(stop.inicio, stop.fim), 0);
        const turnoSec = timeToSeconds(stats.horasTrabalhadas);
        const efetivoSec = Math.max(0, turnoSec - paradasSec);

        const pctParada = turnoSec > 0 ? (paradasSec / turnoSec) * 100 : 0;
        const pctEfetivo = turnoSec > 0 ? (efetivoSec / turnoSec) * 100 : 0;

        // Encontra o índice da última separação para calcular a estatística apenas do dia ATUAL
        let lastSeparatorIndex = -1;
        for (let i = productionUpdates.length - 1; i >= 0; i--) {
            if (productionUpdates[i].isSeparator) {
                lastSeparatorIndex = i;
                break;
            }
        }
        
        const currentDayUpdates = productionUpdates.slice(lastSeparatorIndex + 1);

        const totalKgEntrada = currentDayUpdates.reduce((acc, row) => acc + (row.kgEntrada || 0), 0);
        const totalKgSaida = currentDayUpdates.reduce((acc, row) => acc + (row.saida || 0), 0);
        const totalKgAverage = totalKgEntrada > 0 && currentDayUpdates.length > 0 ? (totalKgSaida / currentDayUpdates.length) : 0;

        const overallKgEntrada = productionUpdates.reduce((acc, row) => acc + (row.isSeparator ? 0 : (row.kgEntrada || 0)), 0);
        const overallKgSaida = productionUpdates.reduce((acc, row) => acc + (row.isSeparator ? 0 : (row.saida || 0)), 0);

        const sucataKg = Math.max(0, totalKgEntrada - totalKgSaida);
        const pctSucata = totalKgEntrada > 0 ? (sucataKg / totalKgEntrada) * 100 : 0;

        // Calcular metros totais baseados no peso de saída e bitola linear mass (CA-60 / CA-50)
        let totalMeters = 0;
        currentDayUpdates.forEach(row => {
            const bitolaStr = row.bitola || '';
            const cleaned = bitolaStr.toLowerCase().replace('mm', '').replace(/\s+/g, '').replace(',', '.');
            const bitolaNum = parseFloat(cleaned) || 0;
            const linearMass = bitolaNum * bitolaNum * 0.006162; // kg/m
            const meters = linearMass > 0 ? (row.saida / linearMass) : 0;
            totalMeters += meters;
        });

        // Velocidade média em metros por minuto (m/min) e metros por segundo (m/s)
        const velocidadeMS = efetivoSec > 0 ? (totalMeters / efetivoSec) : 0;
        const velocidadeMinuto = velocidadeMS * 60;

        return {
            tempoParadoSec: paradasSec,
            tempoParadoStr: secondsToTime(paradasSec),
            percentParado: pctParada.toFixed(1).replace('.', ','),
            
            tempoEfetivoSec: efetivoSec,
            tempoEfetivoStr: secondsToTime(efetivoSec),
            percentEfetivo: pctEfetivo.toFixed(1).replace('.', ','),

            sucataKg,
            percentSucata: pctSucata.toFixed(2).replace('.', ','),

            totalKgEntrada,
            totalKgSaida,
            totalKgAverage,
            overallKgEntrada,
            overallKgSaida,
            totalMeters,
            velocidadeMS,
            velocidadeMinuto
        };
    }, [stops, stats.horasTrabalhadas, productionUpdates]);

    // 6. Persistência de Dados (Local Storage)
    const DRAFT_KEY = 'trefila_report_draft';

    const loadDraft = () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                // Se houver rascunho salvo para a data selecionada
                if (data.selectedDate && data.selectedDate === selectedDate && (data.productionOrder || data.stops?.length > 0)) {
                    setSelectedDate(data.selectedDate);
                    setProductionOrder(data.productionOrder || '');
                    setOperator(data.operator || '');
                    setProductDescriptionIn(data.productDescriptionIn || '8mm -- FIO MÁQUINA--');
                    setProductDescriptionOut(data.productDescriptionOut || '6mm ---CA60--');
                    setStops(data.stops || []);
                    setStats(data.stats || { horasTrabalhadas: '09:45:00', pesoEntrada: 0, pesoSaida: 0, sucata: 0, metrosProduzidos: 0, velocidade: 0 });
                    setProductionUpdates(data.productionUpdates || []);
                    showToast('Rascunho salvo carregado.', 'info');
                } else {
                    syncDailyEvolution();
                }
            } else {
                syncDailyEvolution();
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho', e);
            syncDailyEvolution();
        } finally {
            setLoading(false);
        }
    };

    const resetFormToDefault = () => {
        setProductionOrder('');
        setOperator('');
        setProductDescriptionIn('8mm -- FIO MÁQUINA--');
        setProductDescriptionOut('6mm ---CA60--');
        setStops([]);
        setStats({ horasTrabalhadas: '09:45:00', pesoEntrada: 0, pesoSaida: 0, sucata: 0, metrosProduzidos: 0, velocidade: 0 });
        setProductionUpdates([]);
    };

    const saveReportData = () => {
        const payload = {
            selectedDate,
            productionOrder,
            operator,
            productDescriptionIn,
            productDescriptionOut,
            stops,
            stats,
            productionUpdates
        };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch (e) {
            console.error('Erro ao salvar rascunho:', e);
        }
    };

    useEffect(() => {
        loadDraft();
    }, []);

    // Sincronização automática quando a máquina, OP ou data mudar
    useEffect(() => {
        if (autoSyncEnabled && !loading) {
            syncDailyEvolution(selectedOPId || undefined);
        }
    }, [selectedMachine, selectedOPId, selectedDate, autoSyncEnabled]);

    // Autosave
    useEffect(() => {
        if (loading) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveReportData();
        }, 500);
    }, [selectedDate, productionOrder, operator, productDescriptionIn, productDescriptionOut, stops, stats, productionUpdates, loading]);

    // 7. Operações de Tabelas
    const addStopRow = () => {
        setStops([...stops, { id: Math.random().toString(36).substring(2, 9), inicio: '00:00:00', fim: '00:00:00', motivo: '' }]);
    };
    const removeStopRow = (id: string) => {
        setStops(stops.filter(s => s.id !== id));
    };
    const updateStopField = (id: string, field: keyof StopRow, value: string) => {
        setStops(stops.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const addSeparatorRow = () => {
        setProductionUpdates([...productionUpdates, { id: Math.random().toString(36).substring(2, 9), data: '', kgEntrada: 0, saida: 0, bitola: '', isSeparator: true }]);
    };

    const addProductionUpdateRow = () => {
        let lastData = selectedDate ? `${selectedDate.split('-')[2]}/${selectedDate.split('-')[1]}` : '';
        for (let i = productionUpdates.length - 1; i >= 0; i--) {
            if (!productionUpdates[i].isSeparator && productionUpdates[i].data) {
                lastData = productionUpdates[i].data;
                break;
            }
        }
        setProductionUpdates([...productionUpdates, { id: Math.random().toString(36).substring(2, 9), data: lastData, kgEntrada: 0, saida: 0, bitola: '' }]);
    };
    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(productionUpdates.filter(r => r.id !== id));
    };
    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(productionUpdates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleClearReport = () => {
        const confirmDelete = window.confirm(`Deseja realmente limpar a tela e começar um novo formulário em branco para a Trefila?`);
        if (!confirmDelete) return;

        resetFormToDefault();
        localStorage.removeItem(DRAFT_KEY);
        showToast('Formulário limpo com sucesso!', 'success');
    };

    // --- SISTEMA DE SALVAMENTO OFICIAL (localStorage + Supabase) ---
    const SAVED_DATES_KEY = 'daily_report_saved_dates_trefila';

    const getSavedDates = (): string[] => {
        try {
            const raw = localStorage.getItem(SAVED_DATES_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    };

    const registerSavedDate = (date: string) => {
        const existing = getSavedDates();
        if (!existing.includes(date)) {
            localStorage.setItem(SAVED_DATES_KEY, JSON.stringify([...existing, date]));
        }
    };

    const handleOpenSaveModal = () => {
        setSaveModalDate(selectedDate);
        setSaveModalError('');
        setShowSaveModal(true);
    };

    const handleConfirmSave = async () => {
        if (!saveModalDate) {
            setSaveModalError('Selecione uma data para salvar o relatório.');
            return;
        }
        // Verificar bloqueio local
        const savedDates = getSavedDates();
        if (savedDates.includes(saveModalDate)) {
            const [year, month, day] = saveModalDate.split('-');
            setSaveModalError(`Já existe um relatório salvo para Trefila no dia ${day}/${month}/${year}. Só é possível um relatório por dia.`);
            return;
        }
        // Verificar bloqueio no Supabase
        try {
            const { data: existingData } = await supabase
                .from('daily_reports')
                .select('id')
                .eq('report_type', 'trefila_diario')
                .eq('machine_key', 'Trefila')
                .eq('date', saveModalDate)
                .limit(1);
            if (existingData && existingData.length > 0) {
                const [year, month, day] = saveModalDate.split('-');
                setSaveModalError(`Já existe um relatório na nuvem para Trefila no dia ${day}/${month}/${year}.`);
                return;
            }
        } catch { /* offline – continua */ }

        setShowSaveModal(false);
        setIsSaving(true);

        const reportPayload = {
            report_type: 'trefila_diario',
            machine_key: 'Trefila',
            date: saveModalDate,
            data: {
                selectedDate: saveModalDate,
                productionOrder,
                operator,
                productDescriptionIn,
                productDescriptionOut,
                stops,
                stats,
                productionUpdates,
            }
        };

        // 1. Salvar cópia permanente no localStorage
        localStorage.setItem(`daily_report_trefila_${saveModalDate}`, JSON.stringify(reportPayload));
        registerSavedDate(saveModalDate);

        // 2. Salvar no Supabase
        try {
            const { error } = await supabase
                .from('daily_reports')
                .upsert(reportPayload, { onConflict: 'report_type,machine_key,date' });
            if (error) throw error;
            showToast('✅ Relatório salvo localmente e na nuvem!', 'success');
        } catch {
            showToast('✅ Relatório salvo com sucesso! (localmente)', 'success');
        }

        setIsSaving(false);
    };

    // --- HISTÓRICO DE RELATÓRIOS ---
    const handleOpenHistoryModal = () => {
        const dates = getSavedDates().slice().sort().reverse(); // mais recente primeiro
        setHistoryDates(dates);
        setShowHistoryModal(true);
    };

    const loadHistoricalReport = (date: string) => {
        const raw = localStorage.getItem(`daily_report_trefila_${date}`);
        if (!raw) {
            showToast('Relatório não encontrado no armazenamento local.', 'error');
            return;
        }
        try {
            const saved = JSON.parse(raw);
            const d = saved.data;
            if (d.selectedDate) setSelectedDate(d.selectedDate);
            if (d.productionOrder !== undefined) setProductionOrder(d.productionOrder);
            if (d.operator !== undefined) setOperator(d.operator);
            if (d.productDescriptionIn !== undefined) setProductDescriptionIn(d.productDescriptionIn);
            if (d.productDescriptionOut !== undefined) setProductDescriptionOut(d.productDescriptionOut);
            if (d.stops) setStops(d.stops);
            if (d.stats) setStats(d.stats);
            if (d.productionUpdates) setProductionUpdates(d.productionUpdates);
            setShowHistoryModal(false);
            const [y, m, day] = date.split('-');
            showToast(`✅ Relatório de ${day}/${m}/${y} carregado com sucesso!`, 'success');
        } catch {
            showToast('Erro ao carregar relatório histórico.', 'error');
        }
    };

    const deleteHistoricalReport = (date: string) => {
        const [y, m, day] = date.split('-');
        if (!window.confirm(`Remover o relatório de ${day}/${m}/${y} do histórico local?`)) return;
        localStorage.removeItem(`daily_report_trefila_${date}`);
        const remaining = getSavedDates().filter(d => d !== date);
        localStorage.setItem(SAVED_DATES_KEY, JSON.stringify(remaining));
        setHistoryDates(remaining.slice().sort().reverse());
        showToast('Relatório removido do histórico.', 'info');
    };

    const handleLoadSampleData = () => {
        setProductionOrder('83583');
        setOperator('Willian / Denis');
        setProductDescriptionIn('8mm -- FIO MÁQUINA--');
        setProductDescriptionOut('6mm ---CA60--');
        setStops([
            { id: 'st-1', inicio: '07:30:00', fim: '07:45:00', motivo: 'Ajuste de matriz entrada' },
            { id: 'st-2', inicio: '11:15:00', fim: '11:45:00', motivo: 'Troca de anel trefilador' }
        ]);
        setStats({
            horasTrabalhadas: '09:45:00',
            pesoEntrada: 1200,
            pesoSaida: 1180,
            sucata: 20,
            metrosProduzidos: 4500,
            velocidade: 2.22
        });
        setProductionUpdates([
            { id: 'pud-1', data: '12/05', kgEntrada: 600, saida: 590, bitola: '5,98mm' },
            { id: 'pud-2', data: '12/05', kgEntrada: 600, saida: 590, bitola: '5,98mm' }
        ]);
        showToast('Dados de modelo carregados com sucesso!', 'success');
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('trefila-report-sheet');
            if (!element) return;
            
            showToast('Gerando imagem de alta resolução...', 'info');
            
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
                    const clonedElement = clonedDoc.getElementById('trefila-report-sheet');
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
                        showToast('Imagem copiada! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        const link = document.createElement('a');
                        link.download = `Relatorio_Trefila_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Baixamos o relatório como imagem! Envie no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('trefila-report-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-mono text-slate-800 relative select-none">
            
            {/* CSS de Alta Fidelidade herdado da Treliça */}
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
                    #trefila-report-sheet, #trefila-report-sheet * {
                        overflow: visible !important; max-height: none !important;
                    }
                    #trefila-report-sheet { height: auto !important; }
                    #trefila-report-sheet img {
                        max-height: 72px !important; height: auto !important;
                        object-fit: contain !important; display: block !important;
                    }
                    #trefila-report-sheet table, #trefila-report-sheet thead,
                    #trefila-report-sheet tbody, #trefila-report-sheet tr,
                    #trefila-report-sheet td, #trefila-report-sheet th {
                        page-break-inside: avoid !important; break-inside: avoid !important;
                        overflow: visible !important;
                    }
                    #trefila-report-sheet thead { display: table-header-group !important; }
                    #trefila-report-sheet tbody { display: table-row-group !important; }
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
                    border: none !important;
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

            {/* Modal de Histórico de Relatórios */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center no-print" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200" style={{ animation: 'modalInHist 0.2s ease-out' }}>
                        <style dangerouslySetInnerHTML={{ __html: `
                            @keyframes modalInHist {
                                from { opacity: 0; transform: scale(0.93) translateY(10px); }
                                to   { opacity: 1; transform: scale(1) translateY(0); }
                            }
                        ` }} />
                        {/* Cabeçalho */}
                        <div className="bg-[#002060] px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                <div>
                                    <div className="text-white font-black text-sm uppercase tracking-wide">Histórico de Relatórios</div>
                                    <div className="text-slate-300 text-[10px] font-semibold">Trefila – Relatórios Salvos Localmente</div>
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-slate-300 hover:text-white transition-colors p-1 rounded">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        {/* Corpo */}
                        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                            {historyDates.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-5xl mb-3">📭</div>
                                    <p className="text-sm font-bold text-slate-600">Nenhum relatório salvo ainda.</p>
                                    <p className="text-xs text-slate-400 mt-1">Use "💾 Salvar Relatório" para criar o primeiro.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {historyDates.map(date => {
                                        const [y, m, day] = date.split('-');
                                        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
                                        const weekday = weekdays[dateObj.getDay()];
                                        const localKey = `daily_report_trefila_${date}`;
                                        const hasSavedData = !!localStorage.getItem(localKey);
                                        return (
                                            <div key={date} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#002060]/30 hover:bg-blue-50/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-[#002060] text-white rounded-xl px-3 py-2 text-center min-w-[54px] shadow-sm">
                                                        <div className="text-[9px] font-bold text-slate-300 uppercase leading-none">{weekday}</div>
                                                        <div className="text-lg font-black leading-tight">{day}/{m}</div>
                                                        <div className="text-[9px] text-slate-400 leading-none">{y}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-800">Relatório Trefila</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {hasSavedData
                                                                ? <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-1.5 py-0.5 rounded-full">✅ Disponível</span>
                                                                : <span className="bg-slate-100 text-slate-500 font-black text-[9px] px-1.5 py-0.5 rounded-full">☁️ Só nuvem</span>
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {hasSavedData && (
                                                        <button
                                                            onClick={() => loadHistoricalReport(date)}
                                                            className="bg-[#002060] hover:bg-[#001545] text-white font-black text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            📂 Carregar
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteHistoricalReport(date)}
                                                        className="bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-bold text-[10px] px-2 py-1.5 rounded-lg transition-colors"
                                                        title="Remover do histórico"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {/* Rodapé */}
                        <div className="px-6 py-3 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                            <span className="text-[10px] text-slate-400 font-semibold">{historyDates.length} relatório(s) salvo(s)</span>
                            <button onClick={() => setShowHistoryModal(false)} className="py-2 px-5 border-2 border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Salvar Relatório com Calendário */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center no-print" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-200" style={{ animation: 'modalIn 0.2s ease-out' }}>
                        <style dangerouslySetInnerHTML={{ __html: `
                            @keyframes modalIn {
                                from { opacity: 0; transform: scale(0.93) translateY(8px); }
                                to   { opacity: 1; transform: scale(1) translateY(0); }
                            }
                        ` }} />
                        <div className="bg-[#002060] px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <div>
                                    <div className="text-white font-black text-sm uppercase tracking-wide">Salvar Relatório</div>
                                    <div className="text-slate-300 text-[10px] font-semibold">Trefila – Relatório Diário</div>
                                </div>
                            </div>
                            <button onClick={() => setShowSaveModal(false)} className="text-slate-300 hover:text-white transition-colors p-1 rounded">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-xs text-slate-500 font-semibold mb-4 leading-relaxed">
                                Selecione o dia para salvar. <strong className="text-slate-800">Só é permitido um relatório da Trefila por dia.</strong>
                            </p>
                            <div className="mb-4">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Data do Relatório</label>
                                <input
                                    type="date"
                                    value={saveModalDate}
                                    onChange={e => { setSaveModalDate(e.target.value); setSaveModalError(''); }}
                                    max={new Date().toLocaleDateString('sv')}
                                    className="w-full border-2 border-slate-200 focus:border-[#002060] rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-colors cursor-pointer"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                            {(() => {
                                const savedDates = getSavedDates();
                                if (savedDates.length === 0) return null;
                                return (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1.5">📅 Dias já salvos</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {savedDates.slice().sort().map(d => {
                                                const [y, m, day] = d.split('-');
                                                return <span key={d} className="bg-amber-200 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full">{day}/{m}/{y}</span>;
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                            {saveModalError && (
                                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                                    <svg className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs font-bold text-rose-700 leading-relaxed">{saveModalError}</p>
                                </div>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2.5 px-4 border-2 border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-50 transition-colors">Cancelar</button>
                                <button onClick={handleConfirmSave} className="flex-1 py-2.5 px-4 bg-[#002060] hover:bg-[#001545] text-white font-black rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5">💾 Confirmar Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div key={t.id} className={`p-3 rounded shadow border text-white font-bold text-xs flex items-center gap-2 pointer-events-auto max-w-sm ${t.type === 'success' ? 'bg-emerald-600 border-emerald-500' : t.type === 'error' ? 'bg-rose-600 border-rose-500' : 'bg-slate-800 border-slate-700'}`}>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Menu Administrativo da Ficha */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-4 border-b border-slate-200 no-print gap-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
                        📋 Formato Ficha de Papel Trefila
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => syncDailyEvolution(undefined, true)} 
                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black py-1.5 px-3 rounded text-xs shadow flex items-center gap-1.5 active:scale-95 transition-all animate-pulse"
                        title="Puxar OP, operador, paradas e pesagens automaticamente do chão de fábrica"
                    >
                        <span>⚡ Sincronizar com Produção do Dia</span>
                    </button>
                    <button onClick={handleLoadSampleData} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        ⭐ Carregar Modelo de Teste
                    </button>
                    <button onClick={copyToClipboard} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1">
                        🟢 Copiar Imagem (Zap)
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow">
                        🖨️ Imprimir Ficha
                    </button>
                    <button onClick={handleOpenHistoryModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1.5">
                        📚 Histórico
                    </button>
                    <button onClick={handleOpenSaveModal} disabled={isSaving} className="bg-slate-900 hover:bg-black text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1.5">
                        {isSaving ? 'Salvando...' : '💾 Salvar Relatório'}
                    </button>
                    <button onClick={handleClearReport} className="bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 font-bold py-1.5 px-2 rounded text-xs transition-colors">
                        Limpar
                    </button>
                </div>
            </header>

            {/* Filtros e Controles de Sincronização - No Print */}
            <section className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Seletor de Máquina */}
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 text-xs uppercase">Linha:</span>
                        <div className="flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                            {['Trefila 1', 'Trefila 2'].map(mach => (
                                <button
                                    key={mach}
                                    type="button"
                                    onClick={() => { setSelectedMachine(mach); setSelectedOPId(''); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                        selectedMachine === mach ? 'bg-[#002060] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {mach}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Seletor de OP do Dia */}
                    {availableOPs.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 text-xs">OP do Dia:</span>
                            <select
                                value={selectedOPId || (availableOPs.find(o => o.orderNumber === productionOrder)?.id || availableOPs[0]?.id || '')}
                                onChange={e => {
                                    setSelectedOPId(e.target.value);
                                    syncDailyEvolution(e.target.value, true);
                                }}
                                className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800 bg-white"
                            >
                                {availableOPs.map(o => (
                                    <option key={o.id} value={o.id}>
                                        OP #{o.orderNumber} ({o.status}) - {o.targetBitola}mm
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Toggle de Auto-Preenchimento Ao Vivo */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <input
                            type="checkbox"
                            checked={autoSyncEnabled}
                            onChange={e => setAutoSyncEnabled(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            Auto-Evolução Ao Vivo
                        </span>
                    </label>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-bold text-slate-700 text-xs">Data:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800 cursor-pointer"
                    />
                    <button
                        type="button"
                        onClick={() => setSelectedDate(new Date().toLocaleDateString('sv'))}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[11px] font-bold rounded"
                        title="Ir para o dia de hoje"
                    >
                        Hoje
                    </button>
                </div>
            </section>

            {/* Ficha Técnica - ALTA FIDELIDADE */}
            {loading ? (
                <div className="bg-white p-16 border border-slate-200 rounded-xl shadow-sm text-center font-bold text-slate-500 animate-pulse">
                    Carregando dados do relatório...
                </div>
            ) : (
                <div id="trefila-report-sheet" className="bg-white max-w-5xl mx-auto worksheet-container print-sheet border-2 border-[#002060] rounded-xl overflow-hidden shadow-lg">
                    
                    {/* CABEÇALHO */}
                    <div className="grid grid-cols-1 md:grid-cols-12 border-b-2 border-[#002060]">
                        <div className="col-span-1 md:col-span-3 bg-white p-2.5 flex items-center justify-center md:border-r-2 border-[#002060]">
                            <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 md:h-20 object-contain" style={{ maxHeight: '82px' }} />
                        </div>

                        <div className="col-span-1 md:col-span-6 bg-[#002060] text-white p-4 flex flex-col justify-center text-center md:text-left md:pl-8">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider leading-none text-white">
                                Controle de Produção Diária
                            </h2>
                            <p className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-slate-300 mt-1">
                                Setor Laminação – Trefila
                            </p>
                        </div>

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

                    {/* METADADOS */}
                    <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-200 bg-[#fbfcfd]">
                        {/* OP e Operador */}
                        <div className="col-span-1 md:col-span-4 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                            <div className="flex items-start gap-2.5">
                                <ClipboardIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                                <div className="flex-grow">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">ORDEM DE PRODUÇÃO</div>
                                    <input type="text" value={productionOrder} onChange={e => setProductionOrder(e.target.value)} className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input" placeholder="Digite a OP..." />
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                <UserIcon className="h-5 w-5 text-[#002060] mt-0.5" />
                                <div className="flex-grow">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">OPERADOR / AUXILIAR</div>
                                    <input type="text" value={operator} onChange={e => setOperator(e.target.value)} className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input uppercase" placeholder="Nome do Operador..." />
                                </div>
                            </div>
                        </div>

                        {/* Descrições Entrada / Saída */}
                        <div className="col-span-1 md:col-span-5 p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200">
                            <div className="flex items-start gap-2.5">
                                <div className="flex-grow pl-1">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO (ENTRADA)</div>
                                    <input type="text" value={productDescriptionIn} onChange={e => setProductDescriptionIn(e.target.value)} className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input" />
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                <div className="flex-grow pl-1">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO (SAÍDA)</div>
                                    <input type="text" value={productDescriptionOut} onChange={e => setProductDescriptionOut(e.target.value)} className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input" />
                                </div>
                            </div>
                        </div>

                        {/* Destaque do Peso de Saída */}
                        <div className="col-span-1 md:col-span-3 p-4 flex flex-col justify-center items-center text-center bg-slate-50">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">PESO TOTAL PRODUZIDO</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-[#002060] tracking-tight">{calculatedData.totalKgSaida || 0}</span>
                                <span className="text-sm font-bold text-slate-600">kg</span>
                            </div>
                        </div>
                    </div>

                    {/* PARADAS E ESTATÍSTICAS - LADO A LADO */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 border-b border-slate-200">
                        {/* Paradas (col-span-7) */}
                        <div className="col-span-1 lg:col-span-7 border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider">
                                <span className="uppercase">PARADAS E SEUS MOTIVOS</span>
                                <button onClick={addStopRow} className="border border-white hover:bg-white hover:text-[#002060] text-white text-[9px] font-bold px-2 py-0.5 rounded transition-all no-print cursor-pointer uppercase">
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
                                    {stops.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-6 text-slate-400 italic font-bold text-xs">
                                                Nenhuma parada registrada.
                                            </td>
                                        </tr>
                                    ) : (
                                        stops.map(stop => {
                                            const durationSecs = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                            return (
                                                <tr key={stop.id} className="border-b border-slate-200 hover:bg-slate-50/50 group text-xs">
                                                    <td className="p-1 border-r border-slate-200 text-center">
                                                        <input type="text" value={stop.inicio} onChange={e => updateStopField(stop.id, 'inicio', e.target.value)} className="modern-editable-input text-center text-rose-600 w-full font-black text-xs" placeholder="00:00:00" />
                                                    </td>
                                                    <td className="p-1 border-r border-slate-200 text-center">
                                                        <input type="text" value={stop.fim} onChange={e => updateStopField(stop.id, 'fim', e.target.value)} className="modern-editable-input text-center text-emerald-600 w-full font-black text-xs" placeholder="00:00:00" />
                                                    </td>
                                                    <td className="p-1 border-r border-slate-200 text-center font-black text-rose-600 text-xs">
                                                        {secondsToTime(durationSecs)}
                                                    </td>
                                                    <td className="p-1 text-left pl-3 relative pr-8">
                                                        <input type="text" value={stop.motivo} onChange={e => updateStopField(stop.id, 'motivo', e.target.value)} className="modern-editable-input text-left text-slate-800 w-full font-bold text-xs" placeholder="Motivo..." />
                                                        <button onClick={() => removeStopRow(stop.id)} className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 hover:text-rose-800 font-black text-sm no-print opacity-0 group-hover:opacity-100 transition-opacity" title="Remover parada">✕</button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Estatísticas (col-span-5) */}
                        <div className="col-span-1 lg:col-span-5 border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                            <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                <GaugeIcon className="h-4 w-4 text-white" />
                                <span>ESTATÍSTICA DO DIA</span>
                            </div>
                            <div className="p-3 divide-y divide-slate-100 flex flex-col justify-between h-full">
                                {/* Horas Trabalhadas */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Horas (Turno trabalhado)</span>
                                    </div>
                                    <input type="text" value={stats.horasTrabalhadas} onChange={e => setStats({ ...stats, horasTrabalhadas: e.target.value })} className="modern-editable-input text-right w-24 text-slate-950 font-black text-sm" />
                                </div>
                                {/* Tempo Parada */}
                                <div className="flex items-center justify-between py-2.5 bg-rose-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-rose-500" />
                                        <span className="text-[13px] font-black text-rose-600 uppercase tracking-tight">Tempo de máquina (parada)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-rose-600">
                                        <span>{calculatedData.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.percentParado}%</span>
                                    </div>
                                </div>
                                {/* Tempo Efetivo */}
                                <div className="flex items-center justify-between py-2.5 bg-emerald-50/20 px-1 rounded">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">Tempo de máquina (Efetivo)</span>
                                    </div>
                                    <div className="flex gap-4 font-black text-sm text-emerald-600">
                                        <span>{calculatedData.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.percentEfetivo}%</span>
                                    </div>
                                </div>
                                {/* Peso Entrada */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Peso entrada</span>
                                    </div>
                                    <span className="text-sm font-black text-[#002060]">{calculatedData.totalKgEntrada.toLocaleString('pt-BR')} kg</span>
                                </div>
                                {/* Peso Saída */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Peso saida</span>
                                    </div>
                                    <span className="text-sm font-black text-[#002060]">{calculatedData.totalKgSaida.toLocaleString('pt-BR')} kg</span>
                                </div>
                                {/* Sucata */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Sucata</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-[#002060]">{calculatedData.sucataKg.toLocaleString('pt-BR')} kg</span>
                                        <span className="text-rose-600 font-black text-xs bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{calculatedData.percentSucata}%</span>
                                    </div>
                                </div>
                                {/* Quant. Metros */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <RulerIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Quant. metros produzidos</span>
                                    </div>
                                    <span className="text-sm font-black text-[#002060]">{Math.round(calculatedData.totalMeters).toLocaleString('pt-BR')} metros</span>
                                </div>
                                {/* Velocidade */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2">
                                        <GaugeIcon className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-extrabold text-slate-700">Velocidade (média)</span>
                                    </div>
                                    <span className="text-sm font-black text-[#002060]">{calculatedData.velocidadeMS.toFixed(2).replace('.', ',')} m/s ({calculatedData.velocidadeMinuto.toFixed(1).replace('.', ',')} m/min)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ATUALIZAÇÃO DA PRODUÇÃO (Lotes de pesagem) */}
                    <div className="p-4 bg-[#fbfcfd]">
                        <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm">
                            <div className="bg-[#002060] text-white py-2 text-center text-xs font-black tracking-wider uppercase flex items-center justify-between px-4">
                                <span className="mx-auto pl-14">ATUALIZAÇÃO DA PRODUÇÃO</span>
                                <div className="flex gap-2">
                                    <button onClick={addSeparatorRow} className="bg-slate-300 hover:bg-slate-400 text-[#002060] text-[10px] font-black py-1 px-3.5 rounded shadow transition-colors no-print uppercase">
                                        Pular Linha
                                    </button>
                                    <button onClick={addProductionUpdateRow} className="bg-white hover:bg-slate-100 text-[#002060] text-[10px] font-black py-1 px-3.5 rounded shadow transition-colors no-print uppercase">
                                        + Registrar Peso
                                    </button>
                                </div>
                            </div>

                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[#002060] text-[10px] font-black uppercase">
                                        <th className="py-2 border border-[#002060] text-center" style={{ width: '25%' }}>Data</th>
                                        <th className="py-2 border border-[#002060] text-center" style={{ width: '25%' }}>kg (entrada)</th>
                                        <th className="py-2 border border-[#002060] text-center" style={{ width: '25%' }}>saida</th>
                                        <th className="py-2 border border-[#002060] text-center" style={{ width: '25%' }}>bitola</th>
                                        <th className="py-2 border border-[#002060] text-center no-print" style={{ width: '60px' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionUpdates.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-5 text-slate-400 italic font-bold text-center text-xs">
                                                Nenhum lote de pesagem registrado. Clique em "+ Registrar Peso".
                                            </td>
                                        </tr>
                                    ) : (() => {
                                        const blocks: { rows: ProductionUpdateRow[], separatorId?: string }[] = [];
                                        let currentBlock: ProductionUpdateRow[] = [];
                                        productionUpdates.forEach(row => {
                                            if (row.isSeparator) {
                                                blocks.push({ rows: currentBlock, separatorId: row.id });
                                                currentBlock = [];
                                            } else {
                                                currentBlock.push(row);
                                            }
                                        });
                                        blocks.push({ rows: currentBlock });

                                        return blocks.map((block, blockIndex) => {
                                            const blockEntrada = block.rows.reduce((sum, r) => sum + (r.kgEntrada || 0), 0);
                                            const blockSaida = block.rows.reduce((sum, r) => sum + (r.saida || 0), 0);
                                            const hasRows = block.rows.length > 0;
                                            
                                            return (
                                                <React.Fragment key={`block-${blockIndex}`}>
                                                    {block.rows.map((row, rowIndex) => (
                                                        <tr key={row.id} className="hover:bg-slate-50/50 group text-xs">
                                                            {rowIndex === 0 && (
                                                                <td rowSpan={block.rows.length} className="p-1 border-r border-b border-slate-200 text-center align-middle bg-slate-50/50">
                                                                    <input type="text" value={row.data} onChange={e => {
                                                                        const newData = e.target.value;
                                                                        setProductionUpdates(prev => prev.map(r => block.rows.some(br => br.id === r.id) ? { ...r, data: newData } : r));
                                                                    }} className="modern-editable-input text-center w-full font-black text-sm" placeholder="Ex: 12/05" />
                                                                </td>
                                                            )}
                                                            <td className="p-1 border-r border-b border-slate-200 text-center">
                                                                <input type="number" value={row.kgEntrada || ''} onChange={e => updateProductionUpdateField(row.id, 'kgEntrada', parseInt(e.target.value, 10) || 0)} className="modern-editable-input text-center w-full font-black text-xs" placeholder="0" />
                                                            </td>
                                                            <td className="p-1 border-r border-b border-slate-200 text-center">
                                                                <input type="number" value={row.saida || ''} onChange={e => updateProductionUpdateField(row.id, 'saida', parseInt(e.target.value, 10) || 0)} className="modern-editable-input text-center w-full font-black text-xs" placeholder="0" />
                                                            </td>
                                                            <td className="p-1 border-r border-b border-slate-200 text-center">
                                                                <input type="text" value={row.bitola} onChange={e => updateProductionUpdateField(row.id, 'bitola', e.target.value)} className="modern-editable-input text-center w-full font-black text-xs" placeholder="Ex: 5,98mm" />
                                                            </td>
                                                            <td className="p-1 border-b border-slate-200 text-center no-print">
                                                                <button onClick={() => removeProductionUpdateRow(row.id)} className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-2 py-0.5 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Remover pesagem">✕</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    
                                                    {hasRows && (
                                                        <tr className="bg-blue-50 font-black text-xs border-b-2 border-[#002060]/30">
                                                            <td className="p-2 border-r border-[#002060]/20 text-right pr-4 uppercase tracking-wider text-[11px] font-black text-[#002060]">
                                                                TOTAL DIA:
                                                            </td>
                                                            <td className="p-2 border-r border-[#002060]/20 text-center font-black text-rose-600">
                                                                {blockEntrada > 0 ? blockEntrada.toLocaleString('pt-BR') : '0'}
                                                            </td>
                                                            <td className="p-2 border-r border-[#002060]/20 text-center font-black text-rose-600">
                                                                {blockSaida > 0 ? blockSaida.toLocaleString('pt-BR') : '0'}
                                                            </td>
                                                            <td className="p-2 border-r border-[#002060]/20 text-center font-black text-slate-500"></td>
                                                            <td className="p-2 text-center no-print"></td>
                                                        </tr>
                                                    )}
                                                    
                                                    {block.separatorId && (
                                                        <tr className="bg-white group">
                                                            <td colSpan={4} className="h-6 border-y-2 border-[#002060]/30 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                <span className="no-print">--- Novo Dia / Nova Sessão ---</span>
                                                            </td>
                                                            <td className="border-y-2 border-[#002060]/30 text-center no-print">
                                                                <button onClick={() => removeProductionUpdateRow(block.separatorId!)} className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-2 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" title="Remover Divisão">✕ Divisão</button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                    {productionUpdates.filter(r => !r.isSeparator).length > 0 && (
                                        <>
                                            <tr className="bg-white">
                                                <td colSpan={5} className="h-6 border-t-2 border-slate-300"></td>
                                            </tr>
                                            <tr className="bg-[#002060] font-black text-white text-xs border-t-2 border-[#002060]">
                                                <td className="p-2 border-r border-slate-700 text-center uppercase tracking-wider text-[10px] font-black text-white">
                                                    TOTAL GERAL
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white">
                                                    {calculatedData.overallKgEntrada > 0 ? calculatedData.overallKgEntrada.toLocaleString('pt-BR') : '0'} kg
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white">
                                                    {calculatedData.overallKgSaida > 0 ? calculatedData.overallKgSaida.toLocaleString('pt-BR') : '0'} kg
                                                </td>
                                                <td className="p-2 border-r border-slate-700 text-center font-black text-white"></td>
                                                <td className="p-2 text-center no-print"></td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RODAPÉ */}
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

export default ReportsTrefila;
