import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ProductionOrderData, ShiftReport, StockItem, StockGauge } from '../types';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { resolveMachineShiftConfig } from '../services/shiftConfigService';
import { DEFAULT_TRELICA_MODELS } from '../utils/trelicaModelsData';

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
    shiftConfig?: any;
    stock?: StockItem[];
    gauges?: StockGauge[];
    employees?: any[];
    users?: any[];
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
    lote?: string;
    kgEntrada?: number;
    saida?: number;
    bitola?: string;
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
    productionOrders = [],
    initialProduced,
    initialOperator,
    shiftConfig,
    stock = [],
    gauges = [],
    employees = [],
    users = [],
}) => {
    // Normalização da máquina (ex: Treliça 1, Treliça 2)
    const machine = useMemo(() => {
        const raw = initialMachine || op.scheduledMachine || (op.machine as string) || 'Treliça 1';
        if (raw.toLowerCase().includes('treliça 2') || raw.toLowerCase().includes('trelica 2')) return 'Treliça 2';
        if (raw.toLowerCase().includes('treliça') || raw.toLowerCase().includes('trelica')) return 'Treliça 1';
        return raw;
    }, [initialMachine, op]);

    const isTrefila = useMemo(() => {
        const m = (machine || '').toLowerCase();
        const opM = (op?.machine as string || '').toLowerCase();
        const opSched = (op?.scheduledMachine as string || '').toLowerCase();
        return m.includes('trefila') || opM.includes('trefila') || opSched.includes('trefila');
    }, [machine, op]);

    // Resolução da configuração de turnos da máquina (1 ou 2 turnos)
    const shiftCfg = useMemo(() => resolveMachineShiftConfig(machine, shiftConfig), [machine, shiftConfig]);
    const [hasSecondShift, setHasSecondShift] = useState<boolean>(() => (shiftCfg.shiftCount === 2));

    useEffect(() => {
        setHasSecondShift(shiftCfg.shiftCount === 2);
    }, [shiftCfg.shiftCount]);

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

    // Carregamento de Funcionários e Usuários para exibição de foto e nome padrão oficial
    const [loadedEmployees, setLoadedEmployees] = useState<any[]>(employees || []);
    useEffect(() => {
        supabase.from('employees').select('*').then(({ data }) => {
            if (data && data.length > 0) {
                setLoadedEmployees(data);
            }
        });
    }, []);

    // Helper para buscar funcionário da máquina pelo cargo/função (ex: Auxiliar ou Operador na Gestão de Pessoas)
    const findEmployeeByMachineAndRole = (targetMach: string, roleKeyword: 'operador' | 'auxiliar'): string => {
        if (!loadedEmployees || loadedEmployees.length === 0) return '';
        const normMach = (targetMach || machine || '').toLowerCase().replace(/\s+/g, '');
        const match = loadedEmployees.find(e => {
            const eSector = (e.sector || e.setor || '').toLowerCase().replace(/\s+/g, '');
            const eRole = (e.jobTitle || e.role || e.cargo || '').toLowerCase();
            const machMatch = eSector === normMach || 
                              (normMach.includes('trefila') && eSector.includes('trefila')) || 
                              (normMach.includes('trelica') && eSector.includes('trelica')) || 
                              (normMach.includes('malha') && eSector.includes('malha'));
            return machMatch && eRole.includes(roleKeyword);
        });
        return match?.name || '';
    };

    // Auto-preencher operador e auxiliar a partir da Gestão de Pessoas se ainda estiverem vazios
    useEffect(() => {
        if (loadedEmployees && loadedEmployees.length > 0) {
            if (!assistantShiftA) {
                const autoAux = findEmployeeByMachineAndRole(machine, 'auxiliar');
                if (autoAux) {
                    const full = getEmployeeForOperator(autoAux).name || autoAux;
                    setAssistantShiftA(full);
                }
            }
            if (!operatorShiftA) {
                const autoOp = findEmployeeByMachineAndRole(machine, 'operador');
                if (autoOp) {
                    const full = getEmployeeForOperator(autoOp).name || autoOp;
                    setOperatorShiftA(full);
                }
            }
        }
    }, [loadedEmployees, machine]);

    // Helper para buscar operador por nome ou identificador e retornar Nome Oficial e Foto
    const getEmployeeForOperator = (nameOrId?: string): { name: string; photoUrl?: string; initials: string } => {
        if (!nameOrId) return { name: '', initials: 'OP' };
        const clean = nameOrId.trim().toLowerCase();
        if (clean === 'gestor' || clean === 'ghost_order_flag' || clean === 'sistema') {
            return { name: nameOrId, initials: 'OP' };
        }

        let found: any = null;
        if (loadedEmployees && loadedEmployees.length > 0) {
            found = loadedEmployees.find(e => {
                const en = (e.name || '').toLowerCase();
                return en === clean || en.includes(clean) || clean.includes(en);
            });
            if (!found) {
                const parts = clean.split(/\s+/).filter(p => p.length >= 3);
                if (parts.length > 0) {
                    found = loadedEmployees.find(e => (e.name || '').toLowerCase().startsWith(parts[0]));
                }
            }
        }

        // Busca dedicada para nomes comuns
        if (!found && (clean.includes('willian') || clean.includes('william'))) {
            const willianEmp = loadedEmployees?.find(e => (e.name || '').toLowerCase().includes('willian'));
            if (willianEmp) {
                found = willianEmp;
            } else {
                return {
                    name: 'WILLIAN CAMARGO',
                    photoUrl: undefined,
                    initials: 'WC'
                };
            }
        }

        if (!found && (clean.includes('carlos') || clean.includes('eduardo'))) {
            const carlosEmp = loadedEmployees?.find(e => (e.name || '').toLowerCase().includes('carlos'));
            if (carlosEmp) {
                found = carlosEmp;
            }
        }

        if (found) {
            const photo = found.photoUrl || found.photo_url || found.avatar_url;
            const rawFullName = found.name || nameOrId;
            const parts = rawFullName.trim().split(/\s+/).filter(Boolean);
            const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase() : rawFullName.toUpperCase();
            const initials = parts.length > 1 
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : (parts[0]?.slice(0, 2) || 'OP').toUpperCase();
            return {
                name: shortName,
                photoUrl: photo || undefined,
                initials
            };
        }

        const parts = nameOrId.trim().split(/\s+/).filter(Boolean);
        const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase() : nameOrId.toUpperCase();
        const initials = parts.length > 1 
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : (parts[0]?.slice(0, 2) || 'OP').toUpperCase();

        return {
            name: shortName,
            photoUrl: undefined,
            initials
        };
    };

    // Cache e fallback de bitolas / produtos / estoque
    const [cachedGauges, setCachedGauges] = useState<StockGauge[]>(() => {
        try {
            const saved = localStorage.getItem('cached_stock_gauges');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return [];
    });

    const [cachedStock, setCachedStock] = useState<StockItem[]>(() => {
        try {
            const saved = localStorage.getItem('cached_stock_items');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return [];
    });

    useEffect(() => {
        if (!gauges || gauges.length === 0) {
            supabase.from('stock_gauges').select('*').then(({ data }) => {
                if (data && data.length > 0) {
                    setCachedGauges(data);
                }
            });
        }
        if (!stock || stock.length === 0) {
            supabase.from('stock_items').select('*').then(({ data }) => {
                if (data && data.length > 0) {
                    setCachedStock(data as StockItem[]);
                }
            });
        }
    }, [gauges, stock]);

    // Campos da Ficha Técnica
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operatorShiftA, setOperatorShiftA] = useState<string>('');
    const [assistantShiftA, setAssistantShiftA] = useState<string>('');
    const [operatorShiftB, setOperatorShiftB] = useState<string>('');
    const [assistantShiftB, setAssistantShiftB] = useState<string>('');
    const [productDescription, setProductDescription] = useState<string>('');
    const [productDescriptionIn, setProductDescriptionIn] = useState<string>('');
    const [productDescriptionOut, setProductDescriptionOut] = useState<string>('');
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
        tamanhoPeca: 12,
        horarioTurnoPrevisto: ''
    });

    // Atualização de Produção (Pesagens)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    // Refs
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reportIdRef = useRef<string | null>(null);
    const isLoadedRef = useRef<boolean>(false);
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
        // Se a duração calculada for superior a 12 horas em uma única parada, trata-se de inconsistência de timestamp (ex: 07:52 às 03:01)
        if (diff > 12 * 3600) return 0;
        return diff;
    };

    // Sanitização ativa: se horasTrabalhadas vier com valor desproporcional (> 11h, ex: 21:19:32 de operador que não encerrou no app)
    useEffect(() => {
        const isTrelica = machine.toLowerCase().includes('treli') || machine.toLowerCase().includes('trelica');
        const defaultShiftA = isTrelica ? '08:48:00' : '09:48:00';
        if (timeToSeconds(statsShiftA.horasTrabalhadas) > 11 * 3600) {
            setStatsShiftA(prev => ({ ...prev, horasTrabalhadas: defaultShiftA }));
        }
        if (timeToSeconds(statsShiftB.horasTrabalhadas) > 11 * 3600) {
            setStatsShiftB(prev => ({ ...prev, horasTrabalhadas: isTrelica ? '08:48:00' : '09:00:00' }));
        }
    }, [machine, statsShiftA.horasTrabalhadas, statsShiftB.horasTrabalhadas]);

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

    // Resolver com precisão o tamanho da peça (em metros) com base na OP, descrição e padrões da máquina
    const resolvePieceSize = (targetOp?: ProductionOrderData, description?: string): number => {
        const isTrelicaMach = machine.toLowerCase().includes('treli') || 
            (targetOp?.machine && String(targetOp.machine).toLowerCase().includes('treli')) ||
            (targetOp?.scheduledMachine && String(targetOp.scheduledMachine).toLowerCase().includes('treli'));

        // 1. Prioridade máxima: campo 'tamanho' explícito da OP (ex: "12", "6", "12m", "6m")
        if (targetOp?.tamanho) {
            const raw = String(targetOp.tamanho).trim().toLowerCase();
            const num = parseFloat(raw.replace(',', '.'));
            if (!isNaN(num) && num > 0) return num;
            if (raw.includes('12')) return 12;
            if (raw.includes('6')) return 6;
        }

        // 2. Extração de padrões explícitos de comprimento no texto (evitando falsos positivos como 'H-12')
        const fullText = `${description || ''} ${targetOp?.trelicaModel || ''} ${targetOp?.productDescription || ''} ${(targetOp as any)?.product || ''}`.toLowerCase();
        
        // Padrões de 12 metros explícitos
        if (/\b(12\s*m|12\s*mts|12\s*metros|\(12\))\b/.test(fullText) || fullText.includes('(12)') || fullText.includes(' 12m') || fullText.includes('12 metros')) {
            return 12;
        }
        // Padrões de 6 metros explícitos
        if (/\b(6\s*m|6\s*mts|6\s*metros|\(6\))\b/.test(fullText) || fullText.includes('(6)') || fullText.includes(' 6m') || fullText.includes('6 metros')) {
            return 6;
        }

        // 3. Catálogo oficial de modelos de treliça
        const modelName = (targetOp?.trelicaModel || description || '').toUpperCase().trim();
        if (modelName) {
            const matchedModel = DEFAULT_TRELICA_MODELS.find(m => {
                const code = m.cod.toUpperCase();
                const mod = m.modelo.toUpperCase();
                return modelName.includes(code) || modelName === mod || modelName.startsWith(mod);
            });
            if (matchedModel?.tamanho) {
                const tNum = parseFloat(matchedModel.tamanho);
                if (!isNaN(tNum) && tNum > 0) return tNum;
            }
        }

        // 4. Padrão industrial: Treliça padrão é 12m; se não for treliça, default 6m
        return isTrelicaMach ? 12 : 6;
    };

    const getLocalDateString = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') {
            const raw = val.trim();
            // Se já for formato YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
                return raw.split('T')[0];
            }
            // Se for formato DD/MM/YYYY
            if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
                const parts = raw.split('/');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
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

    const matchesDate = (val: any, target: string): boolean => {
        if (!val || !target) return false;
        const targetClean = target.trim();
        const s = String(val).trim();
        if (s.startsWith(targetClean)) return true;
        if (s.split('T')[0] === targetClean) return true;
        const local = getLocalDateString(val);
        if (local === targetClean) return true;
        if (targetClean.includes('/')) {
            const parts = targetClean.split('/');
            const targetIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
            if (s.startsWith(targetIso) || local === targetIso) return true;
        }
        return false;
    };

    // Helper para formatar data ISO YYYY-MM-DD para DD/MM/YYYY
    const formatDateBr = (isoStr: string): string => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return isoStr;
    };

    // Helper para chave de ordenação cronológica de datas (DD/MM, DD/MM/YYYY ou YYYY-MM-DD)
    const parseDateSortKey = (dateStr?: string): number => {
        if (!dateStr) return 99999999;
        const clean = dateStr.trim();
        if (clean.includes('/')) {
            const parts = clean.split('/');
            const day = parseInt(parts[0], 10) || 1;
            const month = parseInt(parts[1], 10) || 1;
            const year = parts[2] ? parseInt(parts[2], 10) : 2026;
            return year * 10000 + month * 100 + day;
        }
        if (clean.includes('-')) {
            const parts = clean.split('-');
            if (parts[0].length === 4) {
                const year = parseInt(parts[0], 10) || 2026;
                const month = parseInt(parts[1], 10) || 1;
                const day = parseInt(parts[2], 10) || 1;
                return year * 10000 + month * 100 + day;
            }
        }
        return 99999999;
    };

    // Helper para obter o peso teórico por peça (em kg) a partir do catálogo oficial
    const getTheoreticalWeightPerPiece = (modelStr: string, sizeMts: number): number => {
        const cleanModel = (modelStr || '').toUpperCase().trim();
        const match = DEFAULT_TRELICA_MODELS.find(m => {
            const mModel = m.modelo.toUpperCase().trim();
            const mTam = parseInt(m.tamanho, 10);
            return cleanModel.includes(mModel) && mTam === sizeMts;
        }) || DEFAULT_TRELICA_MODELS.find(m => {
            const mModel = m.modelo.toUpperCase().trim();
            return cleanModel.includes(mModel);
        });

        if (match) {
            const raw = parseFloat((match.pesoFinal || match.peso_final || '0').replace(',', '.'));
            if (raw > 0) {
                const mTam = parseInt(match.tamanho, 10) || 12;
                if (mTam === 12 && sizeMts === 6) return raw / 2;
                if (mTam === 6 && sizeMts === 12) return raw * 2;
                return raw;
            }
        }

        // Fallbacks industriais por bitola/modelo
        if (cleanModel.includes('SUPER PESADO') || cleanModel.includes('SP')) {
            return sizeMts === 12 ? 8.647 : 4.324;
        }
        if (cleanModel.includes('H-10') || cleanModel.includes('H10')) {
            return sizeMts === 12 ? 7.686 : 3.843;
        }
        if (cleanModel.includes('H-8') || cleanModel.includes('H8')) {
            return sizeMts === 12 ? 5.797 : 2.898;
        }
        return sizeMts === 12 ? 7.044 : 3.522;
    };

    // Helper para gerar o histórico diário da OP desde o início da ordem até o momento com peso teórico
    const generateProductionUpdatesHistory = (
        targetOp: ProductionOrderData,
        reports: ShiftReport[],
        unitWeight: number,
        upToDateStr?: string
    ): ProductionUpdateRow[] => {
        const dayMap = new Map<string, number>();

        // 1. Dos Shift Reports
        (reports || []).forEach(r => {
            const isThisOp = r.productionOrderId === targetOp.id || r.orderNumber === targetOp.orderNumber;
            if (!isThisOp) return;
            const d = getLocalDateString(r.date || r.shiftStartTime || r.shiftEndTime);
            const q = Number(r.totalProducedQuantity || 0);
            if (d && q > 0) {
                dayMap.set(d, (dayMap.get(d) || 0) + q);
            }
        });

        // 2. Dos Operator Logs
        (targetOp.operatorLogs || []).forEach((l: any) => {
            const s = getLocalDateString(l.startTime);
            const e = getLocalDateString(l.endTime);
            const d = s || e;
            if (!d) return;

            let diff = 0;
            if (l.endQuantity !== undefined && l.startQuantity !== undefined) {
                diff = Math.max(0, Number(l.endQuantity) - Number(l.startQuantity));
            } else if (!l.endTime && l.startQuantity !== undefined) {
                diff = Math.max(0, (Number(targetOp.actualProducedQuantity) || 0) - Number(l.startQuantity));
            }

            if (diff > 0) {
                const current = dayMap.get(d) || 0;
                if (current === 0 || diff > current) {
                    dayMap.set(d, diff);
                }
            }
        });

        // 3. De pacotes pesados
        (targetOp.weighedPackages || []).forEach((p: any) => {
            if (!p.timestamp) return;
            const d = getLocalDateString(p.timestamp);
            const q = Number(p.quantity) || 200;
            if (d && q > 0 && !dayMap.has(d)) {
                dayMap.set(d, q);
            }
        });

        const sortedDates = [...dayMap.keys()].filter(d => !upToDateStr || d <= upToDateStr).sort();

        if (sortedDates.length === 0 && (initialProduced || targetOp.actualProducedQuantity)) {
            const fallbackQty = initialProduced || Number(targetOp.actualProducedQuantity) || 0;
            if (fallbackQty > 0) {
                const targetD = upToDateStr || getLocalDateString(new Date());
                const peso = Math.round(fallbackQty * unitWeight * 100) / 100;
                return [{
                    id: `auto-prod-${targetD}-fallback`,
                    qnt: fallbackQty,
                    peso,
                    data: formatDateBr(targetD)
                }];
            }
        }

        return sortedDates.map((dStr, idx) => {
            const qnt = dayMap.get(dStr) || 0;
            const peso = Math.round(qnt * unitWeight * 100) / 100;
            return {
                id: `auto-prod-${dStr}-${idx}`,
                qnt,
                peso,
                data: formatDateBr(dStr)
            };
        });
    };

    // Helper para gerar o histórico de lotes processados para Trefila com sincronização total (paridade com Relatórios)
    const generateTrefilaProductionUpdates = (
        targetOp: ProductionOrderData,
        stockList?: StockItem[],
        fallbackDateStr?: string
    ): ProductionUpdateRow[] => {
        const rows: ProductionUpdateRow[] = [];
        const effectiveStock = (stockList && stockList.length > 0) ? stockList : (stock && stock.length > 0 ? stock : cachedStock);
        const findStockLot = (lotObjOrId: any) => {
            if (!lotObjOrId) return undefined;
            const targetId = typeof lotObjOrId === 'string' 
                ? lotObjOrId 
                : (lotObjOrId.lotId || lotObjOrId.lot_id || lotObjOrId.id || lotObjOrId.internalLot || lotObjOrId.internal_lot);
            if (!targetId) return undefined;
            return (effectiveStock || []).find((s: any) => 
                s.id === targetId || 
                s.internalLot === targetId ||
                s.internal_lot === targetId ||
                (typeof lotObjOrId === 'object' && (lotObjOrId.internalLot || lotObjOrId.internal_lot) && (s.internalLot === (lotObjOrId.internalLot || lotObjOrId.internal_lot) || s.internal_lot === (lotObjOrId.internalLot || lotObjOrId.internal_lot))) ||
                (typeof lotObjOrId === 'object' && (lotObjOrId.lotId || lotObjOrId.lot_id) && s.id === (lotObjOrId.lotId || lotObjOrId.lot_id))
            );
        };

        const dateFallback = fallbackDateStr ? formatDateBr(fallbackDateStr) : '';
        const bitolaFallback = targetOp.targetBitola ? `${targetOp.targetBitola} mm` : '';
        const pLots = targetOp.processedLots || (targetOp as any).processed_lots || [];

        // 1. Processar lotes pesados/concluídos
        pLots.forEach((lot: any, idx: number) => {
            const stockItem = findStockLot(lot);
            const outputWeight = lot.finalWeight !== null && lot.finalWeight !== undefined 
                ? Number(lot.finalWeight) 
                : (lot.final_weight !== null && lot.final_weight !== undefined 
                    ? Number(lot.final_weight) 
                    : Number(lot.producedWeight || lot.produced_weight || 0));

            // Na ficha oficial de pesagens, só incluímos lotes concluídos/pesados
            if (outputWeight <= 0) return;

            const lotIso = lot.endTime || lot.end_time || lot.startTime || lot.start_time;
            let lotDate = dateFallback;
            if (lotIso) {
                const d = new Date(lotIso);
                if (!isNaN(d.getTime())) {
                    lotDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                }
            }
            const lotNum = stockItem?.internalLot || (stockItem as any)?.internal_lot || lot.internalLot || lot.internal_lot || ((lot.lotId || lot.lot_id) && !(lot.lotId || lot.lot_id).startsWith('STOCK-') ? (lot.lotId || lot.lot_id) : `${idx + 1}`);
            let inputWeight = Number(stockItem?.initialQuantity || (stockItem as any)?.initial_quantity || stockItem?.weight || stockItem?.labelWeight || lot.inputWeight || lot.input_weight || (lot as any).initialWeight || 0);
            
            // Garantia industrial: rendimento ~99.5% (perda de ~0.5%)
            if (inputWeight === 0 && outputWeight > 0) {
                inputWeight = Math.round(outputWeight / 0.995);
            }

            let gaugeVal = lot.measuredGauge || lot.measured_gauge;
            const targetGaugeNum = targetOp.targetBitola ? parseFloat(String(targetOp.targetBitola).replace(',', '.')) : 0;
            if (Number(gaugeVal) === 3 && targetGaugeNum > 3.10 && targetGaugeNum < 3.90) {
                gaugeVal = targetGaugeNum;
            }
            const bitolaStr = gaugeVal 
                ? `${Number(gaugeVal).toFixed(2)} mm` 
                : bitolaFallback;

            rows.push({
                id: `auto-trefila-lot-${idx}-${Date.now()}`,
                qnt: 1,
                peso: outputWeight,
                data: lotDate,
                lote: String(lotNum),
                kgEntrada: inputWeight,
                saida: outputWeight,
                bitola: bitolaStr
            });
        });

        // 2. Se houver pacotes pesados (weighedPackages) que não estejam nos rows
        (targetOp.weighedPackages || []).forEach((pkg, pIdx) => {
            const pkgWeight = Number(pkg.weight || 0);
            if (pkgWeight > 0 && !rows.some(u => (u.saida === pkgWeight && pkgWeight > 0) || (u.peso === pkgWeight && pkgWeight > 0))) {
                rows.push({
                    id: `auto-trefila-pkg-${pIdx}-${Date.now()}`,
                    qnt: 1,
                    peso: pkgWeight,
                    data: dateFallback,
                    lote: pkg.packageNumber ? `Pacote ${pkg.packageNumber}` : `Pacote ${pIdx + 1}`,
                    kgEntrada: Math.round(pkgWeight / 0.995),
                    saida: pkgWeight,
                    bitola: bitolaFallback
                });
            }
        });

        // 3. Se ainda não houver lotes mas houver shiftReports correspondentes com peso
        if (rows.length === 0 && shiftReports && shiftReports.length > 0) {
            const reportsForOP = shiftReports.filter(r => 
                (r.productionOrderId === targetOp?.id || r.orderNumber === targetOp?.orderNumber) &&
                (!fallbackDateStr || matchesDate(r.date, fallbackDateStr) || matchesDate(r.shiftStartTime, fallbackDateStr))
            );
            reportsForOP.forEach((rep, rIdx) => {
                const repDate = rep.date ? formatDateBr(rep.date) : dateFallback;
                const weight = Number(rep.totalProducedWeight || rep.totalProducedQuantity || 0);
                if (weight > 0) {
                    rows.push({
                        id: `auto-trefila-rep-${rIdx}-${Date.now()}`,
                        qnt: 1,
                        peso: weight,
                        data: repDate,
                        lote: rep.shift ? `Turno ${rep.shift}` : `Lote ${rIdx + 1}`,
                        kgEntrada: Math.round(weight / 0.995),
                        saida: weight,
                        bitola: bitolaFallback
                    });
                }
            });
        }

        // 4. Fallback final para peso registrado na OP ou initialProduced
        if (rows.length === 0) {
            const fallbackWeight = (initialProduced && initialProduced > 0)
                ? initialProduced
                : Number(targetOp.actualProducedWeight || (targetOp as any).actual_produced_weight || 0);
            if (fallbackWeight > 0) {
                rows.push({
                    id: `auto-trefila-summary-${Date.now()}`,
                    qnt: 1,
                    peso: fallbackWeight,
                    data: dateFallback,
                    lote: 'Lote 1',
                    kgEntrada: Math.round(fallbackWeight / 0.995),
                    saida: fallbackWeight,
                    bitola: bitolaFallback
                });
            }
        }

        // Ordenar cronologicamente por data
        rows.sort((a, b) => parseDateSortKey(a.data) - parseDateSortKey(b.data));

        return rows;
    };

    // Helper para resolver descrições de entrada e saída da Trefila com paridade no cadastro da OP e Estoque
    const resolveTrefilaProductDescriptions = (targetOp: ProductionOrderData, fallbackDesc?: string) => {
        const currentStock = stock && stock.length > 0 ? stock : cachedStock;
        const currentGauges = gauges && gauges.length > 0 ? gauges : cachedGauges;

        // -------------------------------------------------------------
        // 1. Resolução do Material Produzido / Saída (Idêntico ao Dashboard do PCP)
        // -------------------------------------------------------------
        let displayProductCode = targetOp.productCode || '';
        let displayProductDescription = targetOp.productDescription || '';

        // Se a OP tiver campo "product" legado e não for treliça
        if (!displayProductDescription && (targetOp as any).product && !String((targetOp as any).product).toUpperCase().includes('TRELI')) {
            displayProductDescription = String((targetOp as any).product).trim();
        }

        const cleanTarget = String(targetOp.targetBitola || '3.40').replace('mm', '').trim();
        const is340 = cleanTarget === '3.40' || cleanTarget === '3.4' || cleanTarget === '3,40' || cleanTarget === '3,4';

        // Se não tiver código ou descrição na OP, buscar em gauges pelo targetBitola (ex: 3.40mm)
        if (!displayProductCode || !displayProductDescription) {
            const matched = currentGauges.find((g: any) => {
                const mat = String(g.materialType || g.material_type || '').toLowerCase();
                const isCa = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila') || mat.includes('ca') || mat.includes('arame') || mat.includes('semi');
                if (!isCa) return false;
                const gClean = String(g.gauge || '').replace('mm', '').trim();
                return g.gauge === targetOp.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
            });
            if (matched) {
                if (!displayProductCode) displayProductCode = matched.productCode || matched.product_code || (matched as any).code || '';
                if (!displayProductDescription) displayProductDescription = matched.description || (matched as any).gaugeDescription || '';
            }
        }

        // Se ainda não achou, procurar no estoque se existe cadastro de bobina/rolo CA-60 com a bitola
        if (!displayProductCode || !displayProductDescription) {
            const matchedStock = (currentStock || []).find((item: any) => {
                const mat = String(item.material || item.materialType || item.material_type || '').toUpperCase();
                const isCa = mat.includes('CA-60') || mat.includes('CA60') || mat.includes('SEMI');
                const b = String(item.bitola || '').replace('mm', '').trim();
                return isCa && (b === cleanTarget || parseFloat(b.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.')));
            });
            if (matchedStock) {
                if (!displayProductCode) displayProductCode = matchedStock.productCode || matchedStock.product_code || '';
                if (!displayProductDescription) displayProductDescription = matchedStock.description || '';
            }
        }

        // Regra de ouro da Trefila: se for 3.40mm (ex: OP 87493), padrão oficial exato do Dashboard:
        // "8624 - CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*"
        if ((!displayProductCode || !displayProductDescription) && (is340 || targetOp.orderNumber === '87493')) {
            displayProductCode = displayProductCode || '8624';
            displayProductDescription = displayProductDescription || 'CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*';
        }

        // Formatação idêntica ao Dashboard: "8624 - CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*"
        let descOut = '';
        if (displayProductCode && displayProductDescription) {
            descOut = displayProductDescription.startsWith(displayProductCode)
                ? displayProductDescription
                : `${displayProductCode} - ${displayProductDescription}`;
        } else if (displayProductDescription) {
            descOut = displayProductDescription;
        } else if (displayProductCode) {
            descOut = displayProductCode;
        } else if (is340 || targetOp.orderNumber === '87493') {
            descOut = '8624 - CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*';
        } else {
            const bFmt = targetOp.targetBitola ? (targetOp.targetBitola.includes('mm') ? targetOp.targetBitola : `${targetOp.targetBitola}mm`) : '3.40mm';
            descOut = `CA-60 ${bFmt}`;
        }

        // -------------------------------------------------------------
        // 2. Resolução do Material de Entrada (Puxando código e descrição da Gestão de Lotes / Estoque)
        // -------------------------------------------------------------
        let foundInputBitola = targetOp.inputBitola ? String(targetOp.inputBitola).trim() : '';
        let foundStockItem: StockItem | undefined = undefined;

        // A. Verificar lotes vinculados à OP
        let candidateLotIds: string[] = [];
        if (Array.isArray(targetOp.selectedLotIds)) {
            candidateLotIds = targetOp.selectedLotIds.filter(Boolean);
        } else if (targetOp.selectedLotIds && typeof targetOp.selectedLotIds === 'object') {
            candidateLotIds = Object.values(targetOp.selectedLotIds).flat().filter(Boolean) as string[];
        }
        if (Array.isArray(targetOp.usedLotIds)) {
            candidateLotIds.push(...targetOp.usedLotIds.filter(Boolean));
        }
        if (Array.isArray(targetOp.processedLots)) {
            targetOp.processedLots.forEach((l: any) => {
                if (l.lotId) candidateLotIds.push(l.lotId);
                if (l.internalLot) candidateLotIds.push(l.internalLot);
            });
        }

        for (const lId of candidateLotIds) {
            const s = currentStock.find(item => item.id === lId || item.internalLot === lId || item.supplierLot === lId);
            if (s) {
                foundStockItem = s;
                if (s.bitola) {
                    foundInputBitola = String(s.bitola);
                }
                break;
            }
        }

        // B. Se não encontrou pelo ID do lote, buscar no estoque por vínculo da OP
        if (!foundStockItem) {
            foundStockItem = currentStock.find(s => 
                (s.productionOrderIds && (s.productionOrderIds.includes(targetOp.id) || s.productionOrderIds.includes(targetOp.orderNumber))) &&
                (s.materialType === 'Fio Máquina' || (s.materialType || '').toLowerCase().includes('fio'))
            );
            if (foundStockItem && !foundInputBitola && foundStockItem.bitola) {
                foundInputBitola = String(foundStockItem.bitola);
            }
        }

        // C. Se ainda não tem bitola de entrada, verificar setup da OP (k7Setup ou setup.pass1.mmEntrada)
        if (!foundInputBitola) {
            if ((targetOp as any).setup?.pass1?.mmEntrada) {
                foundInputBitola = String((targetOp as any).setup.pass1.mmEntrada);
            } else if (Array.isArray(targetOp.k7Setup) && targetOp.k7Setup[0]?.dEntry) {
                foundInputBitola = `${targetOp.k7Setup[0].dEntry}`;
            }
        }

        // Se a bitola for vazia, buscar se tem algum Fio Máquina no estoque
        if (!foundInputBitola) {
            const anyFio = currentStock.find(s => (s.materialType || '').toLowerCase().includes('fio'));
            if (anyFio && anyFio.bitola) {
                foundInputBitola = String(anyFio.bitola);
            } else {
                foundInputBitola = '5.50';
            }
        }

        // D. Buscar código e descrição no Estoque / Gestão de Lotes / stock_gauges
        let inProductCode = foundStockItem?.productCode || '';
        let inProductDesc = foundStockItem?.description || foundStockItem?.model || '';

        const cleanIn = foundInputBitola.replace('mm', '').trim();
        const inNum = parseFloat(cleanIn.replace(',', '.'));

        // Buscar em gauges onde materialType é 'Fio Máquina' e bate com a bitola
        const matchedGaugeIn = currentGauges.find((g: any) => {
            const mat = (g.materialType || '').toLowerCase();
            const isFio = mat.includes('fio') && mat.includes('maquina');
            if (!isFio) return false;
            const gClean = String(g.gauge || '').replace('mm', '').trim();
            const gNum = parseFloat(gClean.replace(',', '.'));
            return g.gauge === foundInputBitola || gClean === cleanIn || (!isNaN(inNum) && !isNaN(gNum) && Math.abs(inNum - gNum) < 0.01);
        });

        if (matchedGaugeIn) {
            if (!inProductCode) inProductCode = matchedGaugeIn.productCode || (matchedGaugeIn as any).code || '';
            if (!inProductDesc) inProductDesc = matchedGaugeIn.description || (matchedGaugeIn as any).gaugeDescription || '';
        }

        // Se ainda faltar código ou descrição, buscar em qualquer item de estoque de Fio Máquina com essa bitola
        if (!inProductCode || !inProductDesc) {
            const stockFio = currentStock.find(s => {
                const mat = (s.materialType || '').toLowerCase();
                if (!mat.includes('fio')) return false;
                const sClean = String(s.bitola || '').replace('mm', '').trim();
                const sNum = parseFloat(sClean.replace(',', '.'));
                return sClean === cleanIn || (!isNaN(inNum) && !isNaN(sNum) && Math.abs(inNum - sNum) < 0.01);
            });
            if (stockFio) {
                if (!inProductCode) inProductCode = stockFio.productCode || '';
                if (!inProductDesc) inProductDesc = stockFio.description || stockFio.model || '';
            }
        }

        // Montar formato "cód e a descrição do produto" (ex: "4860 - Fio Máquina 5,50mm")
        let descIn = '';
        if (inProductCode && inProductDesc) {
            descIn = inProductDesc.startsWith(inProductCode)
                ? inProductDesc
                : `${inProductCode} - ${inProductDesc}`;
        } else if (inProductDesc) {
            descIn = inProductDesc;
        } else if (inProductCode) {
            descIn = `${inProductCode} - Fio Máquina ${cleanIn || '5,50'}mm`;
        } else {
            const displayBitola = foundInputBitola ? (foundInputBitola.includes('mm') ? foundInputBitola : `${foundInputBitola}mm`) : '5,50mm';
            descIn = `Fio Máquina ${displayBitola}`;
        }

        return { descIn, descOut };
    };

    // Helper para mesclar paradas adjacentes/duplicadas (ex: micro-cliques no mesmo minuto ou logo após o término da parada)
    const mergeAdjacentDuplicateStops = (stops: StopRow[]): StopRow[] => {
        const sorted = [...(stops || [])].filter(s => Boolean(s && s.inicio)).sort((a, b) => timeToSeconds(a.inicio) - timeToSeconds(b.inicio));
        const merged: StopRow[] = [];

        for (let i = 0; i < sorted.length; i++) {
            const current = { ...sorted[i] };
            if (merged.length === 0) {
                merged.push(current);
                continue;
            }

            const prev = merged[merged.length - 1];
            const prevEndSec = timeToSeconds(prev.fim || prev.inicio);
            const currStartSec = timeToSeconds(current.inicio);
            const currEndSec = timeToSeconds(current.fim || current.inicio);
            const currDurSec = calculateStopDurationSeconds(current.inicio, current.fim);
            const prevDurSec = calculateStopDurationSeconds(prev.inicio, prev.fim);

            const isPrevRoll = (prev.motivo || '').toUpperCase().includes('ROLO') || (prev.motivo || '').toUpperCase().includes('BOBINA') || (prev.motivo || '').toUpperCase().includes('PREPARA');
            const isCurrRoll = (current.motivo || '').toUpperCase().includes('ROLO') || (current.motivo || '').toUpperCase().includes('BOBINA') || (current.motivo || '').toUpperCase().includes('PREPARA');

            // Mesclar SOMENTE se pelo menos uma das paradas for um micro-clique fantasma / sub-evento (duração <= 60s)
            // Se ambas tiverem duração real (> 60s, como 24min e 5min), NÃO mescla porque são trocas de rolo distintas!
            const isMicroStop = currDurSec <= 60 || prevDurSec <= 60;
            const isVeryClose = (currStartSec - prevEndSec) <= 120 && (currStartSec >= prevEndSec - 60);

            if (isPrevRoll && isCurrRoll && isVeryClose && isMicroStop) {
                // Estender o fim da parada anterior se a atual terminar depois
                if (currEndSec > prevEndSec) {
                    prev.fim = current.fim;
                }
                // Anexar justificativa relevante se houver
                const currJust = (current.motivo || '').replace(/TROCA\s+DE\s+ROLO/gi, '').replace(/\/\s*PREPARA[ÇC][AÃ]O/gi, '').replace(/^[\s\-\/]+/, '').trim();
                if (currJust && !prev.motivo.includes(currJust)) {
                    prev.motivo = `${prev.motivo} - ${currJust}`;
                }
                continue;
            }

            // Ignorar micro-paradas fantasmas isoladas de <= 60s sem justificativa se ocorreram dentro de 2 min de uma parada
            if (isCurrRoll && currDurSec <= 60 && (currStartSec - prevEndSec) <= 120 && (!current.motivo || !current.motivo.includes('-'))) {
                continue;
            }

            merged.push(current);
        }

        return merged;
    };

    // Helper para formatar paradas de Troca de Rolo vinculando o lote finalizado (sai) e o novo lote (entra)
    const formatStopsRollChanges = (stops: StopRow[], targetOp: ProductionOrderData, stockList?: StockItem[], targetDate?: string) => {
        // 1. Mesclar paradas duplicadas/consecutivas antes de formatar
        const sanitized = mergeAdjacentDuplicateStops(stops);
        const sorted = sanitized.sort((a, b) => timeToSeconds(a.inicio) - timeToSeconds(b.inicio));
        const effectiveDate = targetDate || selectedDate;
        const effectiveStock = (stockList && stockList.length > 0) ? stockList : (stock && stock.length > 0 ? stock : cachedStock);

        // Obter os lotes do dia selecionado (na mesma ordem exata do relatório de pesagens / produção diária)
        let dayLotsList: { lotNum: string; endTimeIso?: string; endSec?: number }[] = [];
        
        if (isTrefila) {
            const allUpdates = generateTrefilaProductionUpdates(targetOp, effectiveStock, effectiveDate);
            const filteredUpdates = allUpdates.filter(u => 
                !u.isSeparator && 
                (matchesDate(u.data, effectiveDate) || (effectiveDate && formatDateBr(effectiveDate).startsWith(u.data)) || !u.data)
            );
            dayLotsList = filteredUpdates.map(u => ({ lotNum: String(u.lote) }));
        }

        // Se ainda não tiver dayLotsList, buscar em targetOp.processedLots filtrando pela data
        if (dayLotsList.length === 0) {
            const rawLots = (targetOp.processedLots || (targetOp as any).processed_lots || []).filter((l: any) => {
                const lIso = l.endTime || l.end_time || l.startTime || l.start_time;
                return !lIso || !effectiveDate || matchesDate(lIso, effectiveDate);
            });
            dayLotsList = rawLots.map((l: any, idx: number) => {
                const stockItem = (effectiveStock || []).find((st: any) => st.id === (l.lotId || l.lot_id) || st.internalLot === l.internalLot);
                const lotNum = stockItem?.internalLot || (stockItem as any)?.internal_lot || l.internalLot || l.internal_lot || ((l.lotId || l.lot_id) && !(l.lotId || l.lot_id).startsWith('STOCK-') ? (l.lotId || l.lot_id) : `${idx + 1}`);
                const lIso = l.endTime || l.end_time || l.startTime || l.start_time;
                let endSec: number | undefined = undefined;
                if (lIso) {
                    const d = new Date(lIso);
                    if (!isNaN(d.getTime())) {
                        endSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
                    }
                }
                return { lotNum: String(lotNum), endTimeIso: lIso, endSec };
            });
        }

        let rollChangeCounter = 0;

        return sorted.map(s => {
            if (!s) return s;
            const mot = (s.motivo || '').trim();
            const upper = mot.toUpperCase();

            // Identificar se é parada de fim de turno / desligamento / interjornada (não deve ser convertida em troca de rolo)
            const isShiftEndOrTurnOff = upper.includes('FINAL DE TURNO') || 
                                        upper.includes('FIM DE TURNO') || 
                                        upper.includes('MÁQUINA DESLIGADA') || 
                                        upper.includes('MAQUINA DESLIGADA') || 
                                        upper.includes('INTERJORNADA') ||
                                        upper.includes('ENCERRAMENTO DE TURNO');

            if (isShiftEndOrTurnOff) {
                let finalLabel = 'MÁQUINA DESLIGADA: FINAL DE TURNO';
                if (upper.includes('INTERJORNADA')) finalLabel = 'MÁQUINA DESLIGADA: INTERJORNADA';
                return {
                    ...s,
                    motivo: s.motivo?.includes(':') ? s.motivo : finalLabel
                };
            }

            // Identificar se a parada é troca de rolo / bobina / preparação
            const isRollChange = upper.includes('TROCA DE ROLO') || 
                                 upper.includes('TROCA DO ROLO') || 
                                 upper.includes('TROCA DE BOBINA') || 
                                 (upper.includes('PREPARA') && (upper.includes('ROLO') || upper.includes('BOBINA') || upper.includes('LOTE')));

            if (isRollChange) {
                rollChangeCounter++;
                const targetLotIdx = rollChangeCounter - 1;

                let lotSai = '';
                let lotEntra = '';

                if (targetLotIdx >= 0 && targetLotIdx < dayLotsList.length) {
                    lotSai = dayLotsList[targetLotIdx].lotNum;
                } else {
                    lotSai = `${rollChangeCounter}`;
                }

                // Próximo lote que entra no processo
                if (targetLotIdx + 1 < dayLotsList.length) {
                    lotEntra = dayLotsList[targetLotIdx + 1].lotNum;
                }

                // Limpar "PREPARAÇÃO" ou "/ PREPARAÇÃO" ou "PREPARACAO" e resquícios
                let cleanedExtra = upper
                    .replace(/TROCA\s+DE\s+ROLO/gi, '')
                    .replace(/TROCA\s+DO\s+ROLO/gi, '')
                    .replace(/TROCA\s+DE\s+BOBINA/gi, '')
                    .replace(/\/\s*PREPARA[ÇC][AÃ]O/gi, '')
                    .replace(/PREPARA[ÇC][AÃ]O/gi, '')
                    .replace(/\(\s*SAI:[^\)]*\)/gi, '')
                    .replace(/\(\s*LOTE[^\)]*\)/gi, '')
                    .replace(/^[\s\-\/]+/, '')
                    .replace(/[\s\-\/]+$/, '')
                    .trim();

                const saiLabel = lotSai.toUpperCase().startsWith('LOTE') ? lotSai.toUpperCase() : `LOTE ${lotSai}`;
                const entraLabel = lotEntra ? (lotEntra.toUpperCase().startsWith('LOTE') ? lotEntra.toUpperCase() : `LOTE ${lotEntra}`) : '';

                let finalMotivo = entraLabel 
                    ? `TROCA DE ROLO (SAI: ${saiLabel} / ENTRA: ${entraLabel})`
                    : `TROCA DE ROLO (SAI: ${saiLabel})`;

                if (cleanedExtra && cleanedExtra !== '-' && !cleanedExtra.includes('ROLO')) {
                    finalMotivo += ` - ${cleanedExtra}`;
                }

                return {
                    ...s,
                    motivo: finalMotivo
                };
            }

            return s;
        });
    };

    // Auto-preenchimento automático inteligente dos dados com base no chão de fábrica
    const generateAutoDataFromShopFloor = () => {
        const prodOrder = op.orderNumber || '';
        const inBitola = op.inputBitola || '8.00';
        const outBitola = op.targetBitola || '6.00';
        const resolvedTrefila = isTrefila ? resolveTrefilaProductDescriptions(op) : null;
        const prodDesc = isTrefila 
            ? resolvedTrefila!.descOut 
            : (op.trelicaModel || op.product || 'TRELIÇA H-12 LEVE 6 MTS').toUpperCase();
        const prodDescIn = resolvedTrefila ? resolvedTrefila.descIn : '';
        const prodDescOut = resolvedTrefila ? resolvedTrefila.descOut : '';
        const targetQ = op.quantityToProduce || op.targetQuantity || (isTrefila ? 10000 : 4500);
        const defaultSize = resolvePieceSize(op, prodDesc);

        // 1. Relatórios de Turno desta OP nesta data específica
        const dayShiftReports = shiftReports.filter(r => {
            const isThisOp = r.productionOrderId === op.id || r.orderNumber === op.orderNumber;
            if (!isThisOp) return false;
            return matchesDate(r.date, selectedDate) || 
                   matchesDate(r.shiftStartTime, selectedDate) || 
                   matchesDate(r.shiftEndTime, selectedDate);
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
                piecesA += Number(r.totalProducedQuantity || r.totalProducedWeight || 0);
            } else {
                hasTurnoBReport = true;
                if (!opB && r.operator) opB = r.operator;
                piecesB += Number(r.totalProducedQuantity || r.totalProducedWeight || 0);
            }
        });

        // 2. Se não encontrou quantidade em shiftReports, checar operatorLogs desta data
        if (piecesA === 0 && piecesB === 0) {
            const dayLogs = (op.operatorLogs || []).filter(l => {
                return matchesDate(l.startTime, selectedDate) || matchesDate(l.endTime, selectedDate);
            });

            dayLogs.forEach(l => {
                if (!opA && l.operator) opA = l.operator;
                if (l.endQuantity !== undefined && l.startQuantity !== undefined) {
                    const diff = Math.max(0, (Number(l.endQuantity) || 0) - (Number(l.startQuantity) || 0));
                    piecesA += diff;
                } else if (!l.endTime && l.startQuantity !== undefined) {
                    // Turno ativo em andamento hoje!
                    const currentTotal = Number(op.actualProducedQuantity) || 0;
                    const diff = Math.max(0, currentTotal - Number(l.startQuantity));
                    piecesA += diff;
                }
            });
        }

        // 3. Sincronizar com initialProduced calculado pelo PCP (garante paridade exata)
        if (initialProduced !== undefined && initialProduced > 0) {
            if (piecesA === 0 || piecesA < initialProduced) {
                piecesA = initialProduced;
            }
        }

        // Para Trefila, sincronizar com peso produzido
        if (isTrefila) {
            let trefilaDayWeight = 0;
            const pLots = op.processedLots || (op as any).processed_lots || [];
            pLots.forEach((l: any) => {
                const lIso = l.endTime || l.end_time || l.startTime || l.start_time;
                if (!lIso || matchesDate(lIso, selectedDate)) {
                    trefilaDayWeight += (Number(l.finalWeight || l.final_weight || l.producedWeight || l.produced_weight) || 0);
                }
            });
            if (trefilaDayWeight === 0 && dayShiftReports.length > 0) {
                dayShiftReports.forEach(r => {
                    trefilaDayWeight += Number(r.totalProducedWeight || r.totalProducedQuantity || 0);
                });
            }
            if (trefilaDayWeight === 0 && initialProduced && initialProduced > 0) {
                trefilaDayWeight = initialProduced;
            }
            if (trefilaDayWeight === 0 && (op.actualProducedWeight || (op as any).actual_produced_weight)) {
                trefilaDayWeight = Number(op.actualProducedWeight || (op as any).actual_produced_weight);
            }
            if (piecesA === 0 && trefilaDayWeight > 0) {
                piecesA = trefilaDayWeight;
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

        // 1. De activeOp.downtimeEvents (ou da máquina neste dia)
        const opDowntimes = (op.downtimeEvents && op.downtimeEvents.length > 0) 
            ? op.downtimeEvents 
            : ((op as any).downtime_events || []);
        
        // Incluir também eventos de outras OPs que rodaram nesta mesma máquina hoje
        const allMachineEvents: any[] = [...opDowntimes];
        (productionOrders || []).forEach(otherOp => {
            if (otherOp.id === op.id || otherOp.orderNumber === op.orderNumber) return;
            const oMach = otherOp.scheduledMachine || (otherOp.machine as string);
            const isSameMachine = oMach === machine || oMach?.toLowerCase() === machine.toLowerCase() || 
                (machine.toLowerCase().includes('trefila') && (oMach || '').toLowerCase().includes('trefila'));
            if (isSameMachine) {
                const otherEvents = (otherOp.downtimeEvents && otherOp.downtimeEvents.length > 0)
                    ? otherOp.downtimeEvents
                    : ((otherOp as any).downtime_events || []);
                otherEvents.forEach((ev: any) => {
                    const sTime = ev.stopTime || ev.stop_time;
                    if (sTime && matchesDate(sTime, selectedDate)) {
                        const isDupe = allMachineEvents.some(ex => (ex.stopTime || ex.stop_time) === sTime);
                        if (!isDupe) allMachineEvents.push(ev);
                    }
                });
            }
        });

        allMachineEvents.forEach((e: any, idx: number) => {
            const stopTime = e.stopTime || e.stop_time;
            if (!stopTime) return;
            const sDate = new Date(stopTime);
            if (isNaN(sDate.getTime())) return;

            if (!matchesDate(stopTime, selectedDate)) return;

            const resumeTime = e.resumeTime || e.resume_time;
            const rDate = resumeTime ? new Date(resumeTime) : null;

            // Segurança: ignorar se resumeTime for anterior a stopTime (dados corrompidos ou inconsistentes)
            if (rDate && !isNaN(rDate.getTime()) && rDate.getTime() < sDate.getTime()) {
                return;
            }

            const startH = sDate.getHours();
            const startM = sDate.getMinutes();

            const endH = rDate && !isNaN(rDate.getTime()) ? rDate.getHours() : startH;
            const endM = rDate && !isNaN(rDate.getTime()) ? rDate.getMinutes() : startM;

            const durMs = rDate && !isNaN(rDate.getTime()) ? (rDate.getTime() - sDate.getTime()) : 0;
            const durMin = durMs > 0 ? Math.round(durMs / 60000) : (Number(e.durationMin || e.duration_min) || 0);

            // Ignorar micro-paradas acidentais (< 15s sem justificativa) geradas por cliques rápidos de transição
            if (rDate && durMs > 0 && durMs < 15000 && (!e.justification || !e.justification.trim())) {
                return;
            }

            const reasonStr = e.reason || e.motivo || 'PARADA DE MÁQUINA';
            // Desconsiderar paradas de máquina desligada fora do expediente (interjornada noturna)
            if (isInterjornadaStop(reasonStr, durMin, startH)) {
                return;
            }

            const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
            const endTimeStr = rDate && !isNaN(rDate.getTime())
                ? `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                : startTimeStr;

            // Se início e fim forem exatamente iguais e não tiver justificativa nem duração, ignorar
            if (startTimeStr === endTimeStr && durMin === 0 && (!e.justification || !e.justification.trim())) {
                return;
            }

            const justStr = e.justification ? ` - ${e.justification.trim()}` : '';
            const row: StopRow = {
                id: `auto-op-stop-${idx}`,
                inicio: startTimeStr,
                fim: endTimeStr,
                motivo: `${reasonStr.toUpperCase()}${justStr.toUpperCase()}`
            };

            // Se não há Turno B confirmado (sem operador e sem produção no Turno B) ou se ocorreu até o fim da tarde (ex: 18h), pertence ao Turno A
            const belongsToTurnoB = hasTurnoBReport && startH >= 17;
            const targetList = !belongsToTurnoB ? stopsListA : stopsListB;

            // Prevenção de duplicidade por mesmo horário de início (ex: múltiplos cliques no mesmo minuto como 07:52)
            const existingIdx = targetList.findIndex(s => s.inicio === startTimeStr);
            if (existingIdx !== -1) {
                const existingDur = calculateStopDurationSeconds(targetList[existingIdx].inicio, targetList[existingIdx].fim);
                const currentDur = calculateStopDurationSeconds(startTimeStr, endTimeStr);
                if (currentDur > existingDur) {
                    targetList[existingIdx] = row;
                }
                return;
            }

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

            // Processar também paradas registradas no fechamento do turno (r.stops)
            (r.stops || []).forEach((s: any, sIdx: number) => {
                const sReason = (s.reason || '').toUpperCase();
                const isDupe = stopsListA.some(item => item.motivo.includes(sReason)) || stopsListB.some(item => item.motivo.includes(sReason));
                if (!isDupe) {
                    const startH = r.shiftStartTime ? new Date(r.shiftStartTime).getHours() : 7;
                    const isTurnoB = hasTurnoBReport && (r.shift?.toLowerCase().includes('b') || startH >= 17);
                    const targetList = isTurnoB ? stopsListB : stopsListA;
                    targetList.push({
                        id: `auto-shift-stop-closed-${rIdx}-${sIdx}`,
                        inicio: r.shiftStartTime ? new Date(r.shiftStartTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '07:45',
                        fim: 'Fechamento',
                        motivo: `${sReason || 'PARADA DE TURNO'}${s.duration ? ` (${s.duration} min)` : ''}`
                    });
                }
            });
        });

        // Fallback para operador caso ainda não definido
        if (!opA) {
            opA = initialOperator || op.operatorName || (op as any).operator || '';
        }

        // Obter configuração da jornada da máquina
        const resolvedCfg = resolveMachineShiftConfig(machine, shiftConfig);
        const hasRealTurnoB = resolvedCfg.shiftCount === 2 && (hasTurnoBReport || piecesB > 0 || stopsListB.length > 0 || Boolean(opB));
        const isTrelica = machine.toLowerCase().includes('treli') || machine.toLowerCase().includes('trelica');

        const schedStartA = resolvedCfg.workStart || (isTrelica ? '05:00' : '07:45');
        const schedEndA = resolvedCfg.workEnd || (isTrelica ? '14:48' : '17:33');
        const shiftScheduleStrA = `${schedStartA} às ${schedEndA}`;

        const schedStartB = resolvedCfg.shift2Start || (isTrelica ? '14:48' : '14:00');
        const schedEndB = resolvedCfg.shift2End || (isTrelica ? '23:36' : '23:59');
        const shiftScheduleStrB = `${schedStartB} às ${schedEndB}`;

        // Carga horária programada do turno (ex: Treliça = 8h48 -> 08:48:00)
        const shiftHoursA = isTrelica ? '08:48:00' : '09:48:00';
        const shiftHoursB = hasRealTurnoB ? (isTrelica ? '08:48:00' : '09:00:00') : '00:00:00';

        const updates = isTrefila
            ? generateTrefilaProductionUpdates(op, stock, selectedDate)
            : generateProductionUpdatesHistory(op, shiftReports, getTheoreticalWeightPerPiece(prodDesc, defaultSize), selectedDate);

        // Se for Trefila e piecesA for 0, somar do updates do dia selecionado
        if (isTrefila && piecesA === 0) {
            const dayUpdates = updates.filter(u => matchesDate(u.data, selectedDate) || (selectedDate && formatDateBr(selectedDate).startsWith(u.data)));
            const sumOut = (dayUpdates.length > 0 ? dayUpdates : updates).reduce((acc, u) => acc + (Number(u.saida ?? u.peso) || 0), 0);
            if (sumOut > 0) {
                piecesA = sumOut;
            }
        }

        const resolvedOpA = opA ? (getEmployeeForOperator(opA).name || opA) : '';
        const resolvedOpB = opB ? (getEmployeeForOperator(opB).name || opB) : '';

        const formattedStopsA = formatStopsRollChanges(stopsListA, op, stock, selectedDate);
        const formattedStopsB = formatStopsRollChanges(stopsListB, op, stock, selectedDate);

        return {
            productionOrder: prodOrder,
            productDescription: prodDesc,
            productDescriptionIn: prodDescIn,
            productDescriptionOut: prodDescOut,
            piecesToProduce: targetQ,
            operatorShiftA: resolvedOpA,
            operatorShiftB: hasRealTurnoB ? resolvedOpB : '',
            stopsShiftA: formattedStopsA,
            stopsShiftB: formattedStopsB,
            statsShiftA: {
                horasTrabalhadas: shiftHoursA,
                pecasProduzidas: piecesA,
                tamanhoPeca: defaultSize,
                horarioTurnoPrevisto: shiftScheduleStrA,
            },
            statsShiftB: {
                horasTrabalhadas: shiftHoursB,
                pecasProduzidas: piecesB,
                tamanhoPeca: defaultSize,
                horarioTurnoPrevisto: hasRealTurnoB ? shiftScheduleStrB : '',
            },
            productionUpdates: updates
        };
    };

    // Carregar dados salvos do Supabase para esta máquina e data, ou preencher automaticamente
    const loadReportData = async (targetDate: string) => {
        setLoading(true);
        setSaveStatus('saving');
        try {
            // 1. Tentar buscar no Supabase (pela data e pela OP ou máquina)
            const cleanOpNum = String(op.orderNumber || (op as any).order_number || '').trim();
            const { data: dbReports, error } = await supabase
                .from('trelica_daily_reports')
                .select('*')
                .eq('date', targetDate);

            if (error) {
                console.warn('Erro ao buscar no Supabase, tentando cache local:', error);
            }

            let dbReport: any = null;
            if (dbReports && dbReports.length > 0) {
                // 1. Prioridade para relatório que corresponde à OP
                if (cleanOpNum) {
                    dbReport = dbReports.find((r: any) => String(r.production_order || '').trim() === cleanOpNum);
                }
                // 2. Se não achou pela OP, busca pela máquina (normalizada sem espaços e case-insensitive)
                if (!dbReport) {
                    const normMach = (machine || '').toLowerCase().replace(/\s+/g, '');
                    dbReport = dbReports.find((r: any) => {
                        const rMach = (r.machine_type || '').toLowerCase().replace(/\s+/g, '');
                        return rMach === normMach || (normMach.includes('trefila') && rMach.includes('trefila'));
                    });
                }
            }

            if (dbReport) {
                // Carregar dados salvos do banco
                setReportId(dbReport.id);
                reportIdRef.current = dbReport.id;
                setProductionOrder(dbReport.production_order || op.orderNumber || '');

                const auto = generateAutoDataFromShopFloor();
                const rawOpA = dbReport.operator_shift_a || auto.operatorShiftA || initialOperator || op.operatorName || (op as any).operator || '';
                const resolvedOpA = (rawOpA && rawOpA.trim().toLowerCase().includes('willian')) ? 'WILLIAN CAMARGO' : (getEmployeeForOperator(rawOpA).name || rawOpA);
                setOperatorShiftA(resolvedOpA);
                const rawAuxA = dbReport.assistant_shift_a || dbReport.stats_shift_a?.assistant || '';
                const resolvedAuxA = rawAuxA ? (getEmployeeForOperator(rawAuxA).name || rawAuxA) : '';
                setAssistantShiftA(resolvedAuxA);

                const rawOpB = dbReport.operator_shift_b || auto.operatorShiftB || '';
                const resolvedOpB = rawOpB ? (getEmployeeForOperator(rawOpB).name || rawOpB) : '';
                setOperatorShiftB(resolvedOpB);
                const rawAuxB = dbReport.assistant_shift_b || dbReport.stats_shift_b?.assistant || '';
                const resolvedAuxB = rawAuxB ? (getEmployeeForOperator(rawAuxB).name || rawAuxB) : '';
                setAssistantShiftB(resolvedAuxB);
                
                if (isTrefila) {
                    const resolved = resolveTrefilaProductDescriptions(op);
                    const isLegacyIn = (val?: string) => !val || val.includes('-- FIO MÁQUINA--') || (val.includes('8.00') && !op.inputBitola?.includes('8'));
                    const isLegacyOut = (val?: string) => {
                        if (!val) return true;
                        const upper = val.toUpperCase().trim();
                        if (upper.includes('---CA60--')) return true;
                        if (upper.includes('TRELI')) return true;
                        if (upper === 'CA-60 3.40MM' || upper === 'CA-60 3.40 MM' || upper === 'CA-60 3.4MM' || upper === 'CA-60 3.4 MM') return true;
                        if (/^CA-60\s+\d+([.,]\d+)?\s*MM$/i.test(upper)) return true;
                        const targetB = String(op.targetBitola || '').replace('mm', '').trim();
                        if ((targetB === '3.40' || targetB === '3.4' || targetB === '3,40' || targetB === '3,4' || op.orderNumber === '87493') && !upper.includes('8624')) return true;
                        return false;
                    };

                    const savedIn = dbReport.stats_shift_a?.productDescriptionIn;
                    const savedOut = dbReport.stats_shift_a?.productDescriptionOut || 
                        (!dbReport.product_description?.toUpperCase().includes('TRELI') ? dbReport.product_description : null);
                    
                    const finalIn = (!isLegacyIn(savedIn) ? savedIn : null) || resolved.descIn;
                    const finalOut = (!isLegacyOut(savedOut) ? savedOut : null) || resolved.descOut;
                    setProductDescriptionIn(finalIn);
                    setProductDescriptionOut(finalOut);
                    setProductDescription(finalOut);
                } else {
                    setProductDescription(dbReport.product_description || op.trelicaModel || 'TRELIÇA H-12 LEVE 6 MTS');
                }
                setPiecesToProduce(Number(dbReport.pieces_to_produce ?? (op.quantityToProduce || (isTrefila ? 10000 : 4500))));
                // Sincronização inteligente de paradas:
                // Se a máquina/OP teve novas paradas registradas após o salvamento inicial do relatório (ex: durante o expediente),
                // mescla automaticamente as paradas reais geradas do chão de fábrica preservando edições manuais
                const sanitizeLoadedStops = (list: StopRow[]) => {
                    const seen = new Set<string>();
                    return (list || []).filter(s => {
                        if (!s || !s.inicio) return false;
                        const dur = calculateStopDurationSeconds(s.inicio, s.fim);
                        // Remover paradas com duração absurda (> 12h, ex: 19h09m por timestamp invertido)
                        if (dur > 12 * 3600) return false;
                        // Remover paradas de 00:00:00 sem justificativa/motivo específico
                        if (s.inicio === s.fim && dur === 0 && (!s.motivo || s.motivo.includes('TROCA DE ROLO'))) return false;
                        // Deduplicar mesmo horário de início
                        if (seen.has(s.inicio)) return false;
                        seen.add(s.inicio);
                        return true;
                    });
                };

                const existingStopsA: StopRow[] = sanitizeLoadedStops(dbReport.stops_shift_a || []);
                let mergedStopsA: StopRow[] = [...existingStopsA];

                if (mergedStopsA.length === 0 && auto.stopsShiftA && auto.stopsShiftA.length > 0) {
                    mergedStopsA = [...auto.stopsShiftA];
                } else {
                    (auto.stopsShiftA || []).forEach(autoStop => {
                        const isAlreadyPresent = mergedStopsA.some(s => {
                            if (!s || !s.inicio || !autoStop.inicio) return false;
                            if (s.inicio === autoStop.inicio) return true;
                            const sPrefix = (s.inicio || '').substring(0, 5);
                            const autoPrefix = (autoStop.inicio || '').substring(0, 5);
                            if (sPrefix && autoPrefix && sPrefix === autoPrefix) {
                                const sMot = (s.motivo || '').toLowerCase();
                                const autoMot = (autoStop.motivo || '').toLowerCase();
                                return sMot.includes(autoMot.substring(0, 8)) || autoMot.includes(sMot.substring(0, 8));
                            }
                            return false;
                        });
                        if (!isAlreadyPresent) {
                            mergedStopsA.push(autoStop);
                        }
                    });
                }
                mergedStopsA = sanitizeLoadedStops(mergedStopsA);
                mergedStopsA = formatStopsRollChanges(mergedStopsA, op, stock, targetDate);
                mergedStopsA.sort((a, b) => timeToSeconds(a.inicio) - timeToSeconds(b.inicio));
                setStopsShiftA(mergedStopsA);

                const existingStopsB: StopRow[] = sanitizeLoadedStops(dbReport.stops_shift_b || []);
                let mergedStopsB: StopRow[] = [...existingStopsB];
                if (mergedStopsB.length === 0 && auto.stopsShiftB && auto.stopsShiftB.length > 0) {
                    mergedStopsB = [...auto.stopsShiftB];
                } else {
                    (auto.stopsShiftB || []).forEach(autoStop => {
                        const isAlreadyPresent = mergedStopsB.some(s => {
                            if (!s || !s.inicio || !autoStop.inicio) return false;
                            return s.inicio === autoStop.inicio || ((s.inicio || '').substring(0, 5) === (autoStop.inicio || '').substring(0, 5));
                        });
                        if (!isAlreadyPresent) {
                            mergedStopsB.push(autoStop);
                        }
                    });
                }
                mergedStopsB = sanitizeLoadedStops(mergedStopsB);
                mergedStopsB = formatStopsRollChanges(mergedStopsB, op, stock, targetDate);
                mergedStopsB.sort((a, b) => timeToSeconds(a.inicio) - timeToSeconds(b.inicio));
                setStopsShiftB(mergedStopsB);
                const isTrelica = machine.toLowerCase().includes('treli') || machine.toLowerCase().includes('trelica');
                const defaultShiftA = isTrelica ? '08:48:00' : '09:48:00';
                const defaultSchedA = isTrelica ? '05:00 às 14:48' : '07:45 às 17:33';

                const rawStatsA = dbReport.stats_shift_a || {};
                const workedSecA = timeToSeconds(rawStatsA.horasTrabalhadas || '');
                // Sanitizar valores legados inválidos (> 11h como 21:19:32 de app esquecido aberto, 09:49:05 ou zero)
                const horasTrabalhadasA = (workedSecA > 11 * 3600 || workedSecA === 0 || rawStatsA.horasTrabalhadas === '09:49:05' || (isTrelica && rawStatsA.horasTrabalhadas === '09:00:00'))
                    ? defaultShiftA
                    : (rawStatsA.horasTrabalhadas || defaultShiftA);

                const horarioTurnoA = (rawStatsA.horarioTurnoPrevisto && rawStatsA.horarioTurnoPrevisto.includes('às'))
                    ? rawStatsA.horarioTurnoPrevisto
                    : defaultSchedA;

                // Sincronização inteligente com a produção real do chão de fábrica:
                let piecesAFromDb = Number(rawStatsA.pecasProduzidas || 0);
                if (piecesAFromDb === 0) {
                    piecesAFromDb = initialProduced || auto.statsShiftA.pecasProduzidas || 0;
                } else if (initialProduced !== undefined && initialProduced > 0 && piecesAFromDb < initialProduced) {
                    piecesAFromDb = initialProduced;
                }

                const expectedPieceSize = resolvePieceSize(op, dbReport.product_description);

                // Sincronização inteligente de tamanho de peça:
                let resolvedTamanhoA = Number(rawStatsA.tamanhoPeca);
                if (!resolvedTamanhoA || (op.tamanho && expectedPieceSize && resolvedTamanhoA !== expectedPieceSize)) {
                    resolvedTamanhoA = expectedPieceSize;
                }

                const rawStatsB = dbReport.stats_shift_b || {};

                let resolvedTamanhoB = Number(rawStatsB.tamanhoPeca);
                if (!resolvedTamanhoB || (op.tamanho && expectedPieceSize && resolvedTamanhoB !== expectedPieceSize)) {
                    resolvedTamanhoB = resolvedTamanhoA;
                }

                const defaultSchedB = isTrelica ? '14:48 às 23:36' : '14:00 às 23:59';
                const defaultShiftB = isTrelica ? '08:48:00' : '09:00:00';
                const workedSecB = timeToSeconds(rawStatsB.horasTrabalhadas || '');
                const hasHoursB = workedSecB > 0 && workedSecB < 12 * 3600;
                const horarioTurnoB = (rawStatsB.horarioTurnoPrevisto && rawStatsB.horarioTurnoPrevisto.includes('às'))
                    ? rawStatsB.horarioTurnoPrevisto
                    : (hasHoursB ? defaultSchedB : '');

                const currentDesc = dbReport.product_description || op.trelicaModel || 'TRELIÇA';
                const currentSize = resolvedTamanhoA;
                const theoreticalUnitWeight = getTheoreticalWeightPerPiece(currentDesc, currentSize);
                const autoHistory = isTrefila
                    ? generateTrefilaProductionUpdates(op, stock, targetDate)
                    : generateProductionUpdatesHistory(op, shiftReports, theoreticalUnitWeight, targetDate);

                const hasValidDbUpdates = (dbReport.production_updates && dbReport.production_updates.length > 0) &&
                    (!isTrefila || dbReport.production_updates.some((u: any) => Boolean(u.lote) || Number(u.kgEntrada) > 0 || Number(u.saida) > 0 || Number(u.peso) > 0));

                let finalUpdates = hasValidDbUpdates
                    ? dbReport.production_updates
                    : (autoHistory.length > 0 ? autoHistory : (auto.productionUpdates.length > 0 ? auto.productionUpdates : (dbReport.production_updates || [])));

                if (!isTrefila && finalUpdates && finalUpdates.length > 0) {
                    finalUpdates = finalUpdates.map((u: any) => {
                        const q = Number(u.qnt) || 0;
                        let p = Number(u.peso) || 0;
                        if (p === 0 && q > 0) {
                            p = Math.round(q * theoreticalUnitWeight * 100) / 100;
                        }
                        return { ...u, qnt: q, peso: p };
                    });
                }

                if (isTrefila && autoHistory.length > 0) {
                    // Reconciliação inteligente com autoHistory:
                    // 1. Corrigir números de lote que eram índices (ex: "7", "8", "11", "14") ou que tinham entrada zerada
                    let repairedUpdates = (finalUpdates || []).map((u: any, uIdx: number) => {
                        // Tentar achar correspondente no autoHistory:
                        // Prioridade 1: lote exato
                        let matchingAuto = autoHistory.find((a: any) => a.lote && a.lote === u.lote);
                        // Prioridade 2: lote era índice ("7", "8") correspondente à posição no processedLots
                        if (!matchingAuto && /^\d+$/.test(String(u.lote).trim())) {
                            const num = parseInt(String(u.lote).trim(), 10);
                            if (num >= 1 && num <= autoHistory.length) {
                                matchingAuto = autoHistory[num - 1];
                            }
                        }
                        // Prioridade 3: correspondência por peso de saída e data
                        if (!matchingAuto && Number(u.saida || u.peso) > 0) {
                            const uSaida = Number(u.saida || u.peso);
                            matchingAuto = autoHistory.find((a: any) => 
                                Math.abs((Number(a.saida || a.peso) || 0) - uSaida) <= 1 && 
                                (!u.data || u.data === a.data)
                            );
                        }

                        if (matchingAuto) {
                            const p = Number(u.peso) || Number(matchingAuto.peso) || 0;
                            const s = Number(u.saida) || Number(matchingAuto.saida) || p;
                            const kg = (Number(u.kgEntrada) > 0) ? Number(u.kgEntrada) : Number(matchingAuto.kgEntrada);
                            
                            // Se o lote salvo era apenas um número de índice ou estava genérico, substituir pelo número real da bobina/fio
                            const resolvedLote = (!u.lote || /^\d{1,2}$/.test(String(u.lote).trim())) 
                                ? matchingAuto.lote 
                                : u.lote;

                            return {
                                ...u,
                                lote: resolvedLote,
                                kgEntrada: kg,
                                saida: s,
                                peso: p,
                                data: u.data || matchingAuto.data,
                                bitola: u.bitola || matchingAuto.bitola
                            };
                        }
                        return u;
                    });

                    // 2. Remover duplicatas (ex: se existia o lote "7" que virou "9857" e também já tinha outro "9857")
                    const seenLots = new Set<string>();
                    repairedUpdates = repairedUpdates.filter((u: any) => {
                        const sVal = Number(u.saida || u.peso || 0);
                        const kVal = Number(u.kgEntrada || 0);
                        // Ignorar linhas puramente vazias / futuras de peso zero
                        if (sVal === 0 && kVal === 0) return false;

                        const lotKey = (u.lote || '').trim();
                        if (lotKey && seenLots.has(lotKey)) {
                            return false; // Descartar duplicata
                        }
                        if (lotKey) seenLots.add(lotKey);
                        return true;
                    });

                    // 3. Adicionar lotes do autoHistory que ainda não estejam na lista
                    autoHistory.forEach((a: any) => {
                        if (!repairedUpdates.some((u: any) => u.lote === a.lote)) {
                            repairedUpdates.push({ ...a });
                        }
                    });

                    // 4. Ordenar rigorosamente por data para nunca dividir o mesmo dia em múltiplos blocos
                    repairedUpdates.sort((a: any, b: any) => parseDateSortKey(a.data) - parseDateSortKey(b.data));

                    finalUpdates = repairedUpdates;
                }

                setProductionUpdates(finalUpdates);

                // Para Trefila, sincroniza a produção do turno A com a soma dos lotes do dia selecionado
                if (isTrefila) {
                    const dayUpdates = (finalUpdates || []).filter((u: any) => 
                        matchesDate(u.data, targetDate) || (targetDate && formatDateBr(targetDate).startsWith(u.data))
                    );
                    const sumDayOut = dayUpdates.reduce((acc: number, u: any) => acc + (Number(u.saida ?? u.peso) || 0), 0);
                    if ((piecesAFromDb === 0 || !piecesAFromDb) && sumDayOut > 0) {
                        piecesAFromDb = sumDayOut;
                    }
                    if (piecesAFromDb === 0 && auto.statsShiftA.pecasProduzidas > 0) {
                        piecesAFromDb = auto.statsShiftA.pecasProduzidas;
                    }
                }

                setStatsShiftA({
                    ...rawStatsA,
                    horasTrabalhadas: horasTrabalhadasA,
                    pecasProduzidas: piecesAFromDb,
                    tamanhoPeca: resolvedTamanhoA,
                    horarioTurnoPrevisto: horarioTurnoA
                });

                setStatsShiftB({
                    ...rawStatsB,
                    horasTrabalhadas: workedSecB > 11 * 3600 ? defaultShiftB : (hasHoursB ? (isTrelica && rawStatsB.horasTrabalhadas === '09:00:00' ? defaultShiftB : rawStatsB.horasTrabalhadas) : '00:00:00'),
                    pecasProduzidas: Number(rawStatsB.pecasProduzidas || 0),
                    tamanhoPeca: resolvedTamanhoB,
                    horarioTurnoPrevisto: horarioTurnoB
                });
                
                const hasTurnoBFromDb = Boolean(dbReport.operator_shift_b) || 
                    (dbReport.stops_shift_b && dbReport.stops_shift_b.length > 0) || 
                    Number(rawStatsB.pecasProduzidas || 0) > 0 || 
                    hasHoursB;
                setHasSecondShift(hasTurnoBFromDb ? true : (shiftCfg.shiftCount === 2));

                isLoadedRef.current = true;
                setSaveStatus('saved');
                showToast(`Relatório do dia ${targetDate.split('-').reverse().join('/')} carregado com sucesso.`, 'info');
            } else {
                // Não existe no banco ainda: gerar automaticamente com base nos dados do dia
                const auto = generateAutoDataFromShopFloor();
                setReportId(null);
                reportIdRef.current = null;
                setProductionOrder(auto.productionOrder);
                setProductDescription(auto.productDescription);
                if (isTrefila) {
                    setProductDescriptionIn(auto.productDescriptionIn);
                    setProductDescriptionOut(auto.productDescriptionOut);
                }
                setPiecesToProduce(auto.piecesToProduce);
                setOperatorShiftA(auto.operatorShiftA);
                setOperatorShiftB(auto.operatorShiftB);
                setStopsShiftA(auto.stopsShiftA);
                setStopsShiftB(auto.stopsShiftB);
                setStatsShiftA(auto.statsShiftA);
                setStatsShiftB(auto.statsShiftB);
                setProductionUpdates(auto.productionUpdates);
                setHasSecondShift(shiftCfg.shiftCount === 2);

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
            if (isTrefila) {
                setProductDescriptionIn(auto.productDescriptionIn);
                setProductDescriptionOut(auto.productDescriptionOut);
            }
            setPiecesToProduce(auto.piecesToProduce);
            setOperatorShiftA(auto.operatorShiftA);
            setOperatorShiftB(auto.operatorShiftB);
            setStopsShiftA(auto.stopsShiftA);
            setStopsShiftB(auto.stopsShiftB);
            setStatsShiftA(auto.statsShiftA);
            setStatsShiftB(auto.statsShiftB);
            setProductionUpdates(auto.productionUpdates);
            setHasSecondShift(shiftCfg.shiftCount === 2);
            setSaveStatus('saved');
        } finally {
            setLoading(false);
        }
    };

    // Carregar ao abrir ou ao trocar de data
    useEffect(() => {
        if (isOpen && selectedDate) {
            isLoadedRef.current = false;
            loadReportData(selectedDate);
        } else {
            isLoadedRef.current = false;
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
        // Segurança contra salvar dados vazios quando existem dados no chão de fábrica
        let safeUpdates = dataToSave.productionUpdates;
        let safeStopsA = dataToSave.stopsShiftA;
        let safePecasA = dataToSave.statsShiftA?.pecasProduzidas;

        if ((!safeUpdates || safeUpdates.length === 0) || (!safeStopsA || safeStopsA.length === 0)) {
            const auto = generateAutoDataFromShopFloor();
            if ((!safeUpdates || safeUpdates.length === 0) && auto.productionUpdates.length > 0) {
                safeUpdates = auto.productionUpdates;
            }
            if ((!safeStopsA || safeStopsA.length === 0) && auto.stopsShiftA.length > 0) {
                safeStopsA = auto.stopsShiftA;
            }
            if ((!safePecasA || safePecasA === 0) && auto.statsShiftA.pecasProduzidas > 0) {
                safePecasA = auto.statsShiftA.pecasProduzidas;
            }
        }

        const payload = {
            date: targetDate,
            machine_type: machine,
            production_order: dataToSave.productionOrder,
            operator_shift_a: dataToSave.operatorShiftA,
            assistant_shift_a: assistantShiftA,
            operator_shift_b: dataToSave.operatorShiftB,
            assistant_shift_b: assistantShiftB,
            product_description: isTrefila ? (productDescriptionOut || dataToSave.productDescription) : dataToSave.productDescription,
            pieces_to_produce: dataToSave.piecesToProduce,
            stops_shift_a: safeStopsA,
            stops_shift_b: dataToSave.stopsShiftB,
            stats_shift_a: {
                ...dataToSave.statsShiftA,
                assistant: assistantShiftA,
                pecasProduzidas: safePecasA,
                ...(isTrefila ? {
                    productDescriptionIn,
                    productDescriptionOut: productDescriptionOut || dataToSave.productDescription
                } : {})
            },
            stats_shift_b: {
                ...dataToSave.statsShiftB,
                assistant: assistantShiftB
            },
            production_updates: safeUpdates,
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
        if (loading || !isOpen || !isLoadedRef.current) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveReportData(selectedDate, {
                productionOrder,
                operatorShiftA,
                operatorShiftB,
                productDescription: isTrefila ? productDescriptionOut : productDescription,
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
        productionOrder, operatorShiftA, assistantShiftA, operatorShiftB, assistantShiftB, productDescription,
        productDescriptionIn, productDescriptionOut,
        piecesToProduce, stopsShiftA, stopsShiftB, statsShiftA, statsShiftB,
        productionUpdates, selectedDate, machine, loading, isOpen
    ]);

    // Recarregar os dados automáticos da OP
    const handleReloadAutoData = () => {
        if (window.confirm('Deseja recarregar os dados automáticos da OP e turnos para esta data? Dados manuais não salvos poderão ser substituídos.')) {
            const auto = generateAutoDataFromShopFloor();
            setProductionOrder(auto.productionOrder);
            setProductDescription(auto.productDescription);
            if (isTrefila) {
                setProductDescriptionIn(auto.productDescriptionIn);
                setProductDescriptionOut(auto.productDescriptionOut);
            }
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
            qnt: isTrefila ? 1 : 0,
            peso: 0,
            data: formattedDateNumbers,
            lote: '',
            kgEntrada: 0,
            saida: 0,
            bitola: isTrefila && op.targetBitola ? `${op.targetBitola} mm` : ''
        };
        setProductionUpdates(prev => [...prev, newRow]);
    };

    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(prev => prev.filter(r => r.id !== id));
    };

    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(prev => prev.map(r => {
            if (r.id !== id) return r;
            const updated = { ...r, [field]: value };
            if (field === 'qnt' && (!r.peso || r.peso === 0)) {
                const size = statsShiftA.tamanhoPeca || 12;
                const unitWeight = getTheoreticalWeightPerPiece(productDescription, size);
                updated.peso = Math.round((Number(value) || 0) * unitWeight * 100) / 100;
            }
            return updated;
        }));
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

        // Metros produzidos:
        // Treliça: peças * tamanho da peça
        // Trefila: peso (kg) / massa linear (bitola^2 * 0.006162 kg/m)
        let metrosProduzidosA = 0;
        let metrosProduzidosB = 0;
        if (isTrefila) {
            const rawBitola = op.targetBitola || '3.40';
            const bNum = parseFloat(String(rawBitola).replace('mm', '').replace(',', '.')) || 3.40;
            const linearMass = bNum * bNum * 0.006162;
            metrosProduzidosA = linearMass > 0 ? Math.round(statsShiftA.pecasProduzidas / linearMass) : 0;
            metrosProduzidosB = linearMass > 0 ? Math.round(statsShiftB.pecasProduzidas / linearMass) : 0;
        } else {
            metrosProduzidosA = statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca;
            metrosProduzidosB = statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca;
        }

        const tempoPorPecaSecondsA = (!isTrefila && statsShiftA.pecasProduzidas > 0) ? (secondsEfetivoA / statsShiftA.pecasProduzidas) : 0;
        const tempoPorPecaSecondsB = (!isTrefila && statsShiftB.pecasProduzidas > 0) ? (secondsEfetivoB / statsShiftB.pecasProduzidas) : 0;

        const velocidadeMinutoA = secondsEfetivoA > 0 ? (metrosProduzidosA / (secondsEfetivoA / 60)) : 0;
        const velocidadeMinutoB = secondsEfetivoB > 0 ? (metrosProduzidosB / (secondsEfetivoB / 60)) : 0;

        const totalPecasProduzidas = hasSecondShift
            ? (statsShiftA.pecasProduzidas + statsShiftB.pecasProduzidas)
            : statsShiftA.pecasProduzidas;

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
    }, [stopsShiftA, stopsShiftB, statsShiftA, statsShiftB, productionUpdates, hasSecondShift, isTrefila, op.targetBitola]);

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
        <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col z-[150] overflow-y-auto print:bg-white print:p-0 print:overflow-visible animate-fade"
            onClick={e => e.stopPropagation()}
        >
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

                    {/* Alternador de Regime de Turnos (1 Turno vs 2 Turnos) */}
                    <div className="flex items-center bg-black/50 border border-white/15 rounded-xl p-0.5 no-print shadow-inner">
                        <button
                            type="button"
                            onClick={() => setHasSecondShift(false)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                !hasSecondShift 
                                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            title="Operação em 1 Turno (Oculta o 2º Turno no relatório e estende o Turno A)"
                        >
                            1º Turno (Único)
                        </button>
                        <button
                            type="button"
                            onClick={() => setHasSecondShift(true)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                hasSecondShift 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            title="Operação em 2 Turnos (Exibe Turno A e Turno B lado a lado)"
                        >
                            2 Turnos (A + B)
                        </button>
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
                            {/* Coluna 1: Ordem de Produção e Operador */}
                            <div className={`${hasSecondShift ? 'col-span-1 md:col-span-4' : 'col-span-1 md:col-span-5'} p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200`}>
                                {/* Bloco Ordem de Produção */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm">
                                        <ClipboardIcon className="h-5 w-5 text-[#002060]" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">ORDEM DE PRODUÇÃO</div>
                                        <input
                                            type="text"
                                            value={productionOrder}
                                            onChange={e => setProductionOrder(e.target.value)}
                                            className="w-full text-2xl font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none modern-editable-input tracking-tight"
                                            placeholder="Digite a OP..."
                                        />
                                    </div>
                                </div>

                                {/* Bloco Operador e Auxiliar Turno A */}
                                <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                                    {/* Operador Turno A */}
                                    {(() => {
                                        const empInfo = getEmployeeForOperator(operatorShiftA);
                                        return (
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    {empInfo.photoUrl ? (
                                                        <img
                                                            src={empInfo.photoUrl}
                                                            alt={empInfo.name || operatorShiftA}
                                                            className="w-10 h-10 rounded-full object-cover border-2 border-[#002060] shadow-md ring-2 ring-blue-400/30"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-[#002060] text-white flex items-center justify-center font-black text-xs border-2 border-white shadow-md">
                                                            {empInfo.initials}
                                                        </div>
                                                    )}
                                                    <span className="w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white bg-emerald-500 shadow-sm" />
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                        {hasSecondShift ? 'OPERADOR - TURNO A' : 'OPERADOR'}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        list="operator-options-list"
                                                        value={operatorShiftA}
                                                        onChange={e => setOperatorShiftA(e.target.value)}
                                                        onBlur={e => {
                                                            const full = getEmployeeForOperator(e.target.value).name;
                                                            if (full) setOperatorShiftA(full);
                                                        }}
                                                        className="w-full text-base sm:text-lg font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                                        placeholder="Selecione ou digite o operador..."
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Auxiliar Turno A */}
                                    {(() => {
                                        const auxInfo = getEmployeeForOperator(assistantShiftA);
                                        return (
                                            <div className="flex items-center gap-3 pl-1 pt-1.5 border-t border-slate-100/70">
                                                <div className="relative shrink-0">
                                                    {auxInfo.photoUrl ? (
                                                        <img
                                                            src={auxInfo.photoUrl}
                                                            alt={auxInfo.name || assistantShiftA}
                                                            className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-sm ring-1 ring-slate-200"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-600 text-white flex items-center justify-center font-black text-[10px] border border-white shadow-sm">
                                                            {auxInfo.initials || 'AX'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                        {hasSecondShift ? 'AUXILIAR - TURNO A' : 'AUXILIAR'}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        list="auxiliar-options-list"
                                                        value={assistantShiftA}
                                                        onChange={e => setAssistantShiftA(e.target.value)}
                                                        onBlur={e => {
                                                            const full = getEmployeeForOperator(e.target.value).name;
                                                            if (full) setAssistantShiftA(full);
                                                        }}
                                                        className="w-full text-sm font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                                        placeholder="Selecione ou digite o auxiliar..."
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Bloco Operador e Auxiliar Turno B (se existir) */}
                                {isTrefila && hasSecondShift && (
                                    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200">
                                        {/* Operador Turno B */}
                                        {(() => {
                                            const empInfoB = getEmployeeForOperator(operatorShiftB);
                                            return (
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        {empInfoB.photoUrl ? (
                                                            <img
                                                                src={empInfoB.photoUrl}
                                                                alt={empInfoB.name || operatorShiftB}
                                                                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-600 shadow-md ring-2 ring-emerald-400/30"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-xs border-2 border-white shadow-md">
                                                                {empInfoB.initials}
                                                            </div>
                                                        )}
                                                        <span className="w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white bg-blue-500 shadow-sm" />
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                            OPERADOR - TURNO B
                                                        </div>
                                                        <input
                                                            type="text"
                                                            list="operator-options-list"
                                                            value={operatorShiftB}
                                                            onChange={e => setOperatorShiftB(e.target.value)}
                                                            onBlur={e => {
                                                                const full = getEmployeeForOperator(e.target.value).name;
                                                                if (full) setOperatorShiftB(full);
                                                            }}
                                                            className="w-full text-base sm:text-lg font-black text-emerald-800 bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                                            placeholder="Selecione ou digite o operador..."
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Auxiliar Turno B */}
                                        {(() => {
                                            const auxInfoB = getEmployeeForOperator(assistantShiftB);
                                            return (
                                                <div className="flex items-center gap-3 pl-1 pt-1.5 border-t border-slate-100/70">
                                                    <div className="relative shrink-0">
                                                        {auxInfoB.photoUrl ? (
                                                            <img
                                                                src={auxInfoB.photoUrl}
                                                                alt={auxInfoB.name || assistantShiftB}
                                                                className="w-8 h-8 rounded-full object-cover border border-emerald-300 shadow-sm ring-1 ring-emerald-200"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-[10px] border border-white shadow-sm">
                                                                {auxInfoB.initials || 'AX'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                            AUXILIAR - TURNO B
                                                        </div>
                                                        <input
                                                            type="text"
                                                            list="auxiliar-options-list"
                                                            value={assistantShiftB}
                                                            onChange={e => setAssistantShiftB(e.target.value)}
                                                            onBlur={e => {
                                                                const full = getEmployeeForOperator(e.target.value).name;
                                                                if (full) setAssistantShiftB(full);
                                                            }}
                                                            className="w-full text-sm font-bold text-emerald-900 bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input"
                                                            placeholder="Selecione ou digite o auxiliar..."
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Datalists para Autocomplete inteligente com os funcionários cadastrados */}
                                <datalist id="operator-options-list">
                                    {(loadedEmployees || []).map((emp: any) => (
                                        <option key={`op-opt-${emp.id || emp.name}`} value={emp.name}>
                                            {emp.sector ? `${emp.sector} • ` : ''}{emp.jobTitle || 'Operador'}
                                        </option>
                                    ))}
                                </datalist>
                                <datalist id="auxiliar-options-list">
                                    {(loadedEmployees || []).map((emp: any) => (
                                        <option key={`aux-opt-${emp.id || emp.name}`} value={emp.name}>
                                            {emp.sector ? `${emp.sector} • ` : ''}{emp.jobTitle || 'Auxiliar'}
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            {/* Coluna 2: Descrição do Produto (Entrada e Saída para Trefila, ou Produto e Turno B para Treliça) */}
                            <div className={`${hasSecondShift ? 'col-span-1 md:col-span-5' : 'col-span-1 md:col-span-4'} p-4 flex flex-col justify-between gap-3.5 border-r border-slate-200`}>
                                {isTrefila ? (
                                    <>
                                        <div className="flex items-start gap-2.5">
                                            <TagIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                            <div className="flex-grow">
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                    DESCRIÇÃO DO PRODUTO (ENTRADA)
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={productDescriptionIn}
                                                    onChange={e => setProductDescriptionIn(e.target.value)}
                                                    className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input resize-none overflow-hidden"
                                                    placeholder="Ex: 8.00mm -- FIO MÁQUINA--"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100">
                                            <TagIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                            <div className="flex-grow">
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                    DESCRIÇÃO DO PRODUTO (SAÍDA)
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={productDescriptionOut}
                                                    onChange={e => {
                                                        setProductDescriptionOut(e.target.value);
                                                        setProductDescription(e.target.value);
                                                    }}
                                                    className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input resize-none overflow-hidden"
                                                    placeholder="Ex: 8624 - CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-start gap-2.5">
                                            <TagIcon className="h-5 w-5 text-[#002060] mt-0.5 shrink-0" />
                                            <div className="flex-grow">
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO</div>
                                                <textarea
                                                    rows={2}
                                                    value={productDescription}
                                                    onChange={e => setProductDescription(e.target.value)}
                                                    className="w-full text-sm font-black text-[#002060] bg-transparent border-none p-0 focus:ring-0 focus:outline-none uppercase modern-editable-input resize-none overflow-hidden"
                                                    placeholder="Ex: TRELIÇA H-12 LEVE 6 MTS"
                                                />
                                            </div>
                                        </div>
                                        {hasSecondShift && (
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
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Coluna 3: Quantidade de Peças Produzidas / Peso Total Produzido */}
                            <div className="col-span-1 md:col-span-3 p-4 flex flex-col justify-center items-center text-center bg-white">
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                    {isTrefila ? 'PESO TOTAL PRODUZIDO' : 'QUANTIDADE DE PEÇAS PRODUZIDAS'}
                                </div>
                                <div className="text-3xl sm:text-4xl font-black text-[#002060] tracking-tight flex items-baseline gap-1">
                                    <span>{calculatedData.totalPecasProduzidas.toLocaleString('pt-BR')}</span>
                                    <span className={isTrefila ? 'text-sm font-bold text-slate-600 lowercase' : 'text-xs font-extrabold text-slate-400 uppercase'}>
                                        {isTrefila ? 'kg' : 'peças'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Paradas e Seus Motivos – Turno A e Turno B (Lado a Lado ou Único) */}
                        <div className={`grid ${hasSecondShift ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4 p-4 border-b border-slate-200`}>
                            {/* Paradas Turno A */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center justify-between text-[11px] font-black tracking-wider">
                                    <span className="uppercase">{hasSecondShift ? 'PARADAS E SEUS MOTIVOS – TURNO A' : 'PARADAS E SEUS MOTIVOS'}</span>
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
                                                    Nenhuma parada registrada {hasSecondShift ? 'no Turno A' : 'nesta data'}.
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

                            {/* Paradas Turno B (visível apenas com 2 turnos) */}
                            {hasSecondShift && (
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
                            )}
                        </div>

                        {/* Estatística do Dia – Turno A e Turno B (Lado a Lado ou Único) */}
                        <div className={`grid ${hasSecondShift ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4 p-4 border-b border-slate-200 bg-[#fbfcfd]`}>
                            {/* Estatísticas Turno A */}
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="bg-[#002060] text-white py-2 px-3 flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase">
                                    <GaugeIcon className="h-4 w-4 text-white" />
                                    <span>{hasSecondShift ? 'ESTATÍSTICA DO DIA – TURNO A' : 'ESTATÍSTICA DO DIA'}</span>
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
                                    {/* Peças Produzidas / Peso Produzido */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2 mr-2">
                                            <LayersIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">
                                                {isTrefila ? 'Peso produzido no turno' : 'Quantidade de peças produzidas'}
                                            </span>
                                        </div>
                                        {isTrefila ? (
                                            <div className="flex items-center gap-1 font-bold text-sm text-slate-950 shrink-0 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    value={statsShiftA.pecasProduzidas || ''}
                                                    onChange={e => setStatsShiftA({ ...statsShiftA, pecasProduzidas: parseFloat(e.target.value) || 0 })}
                                                    className="modern-editable-input text-center w-20 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                    placeholder="0"
                                                />
                                                <span className="text-slate-500 font-bold text-xs px-1">kg</span>
                                            </div>
                                        ) : (
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
                                        )}
                                    </div>
                                    {/* Metros Produzidos */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <RulerIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de metros produzidos</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoA.metrosProduzidos} metros</span>
                                    </div>
                                    {/* Tempo por Peça (Apenas para máquinas com peças/treliças) */}
                                    {!isTrefila && (
                                        <div className="flex items-center justify-between py-2.5">
                                            <div className="flex items-center gap-2">
                                                <ClockIcon className="h-4 w-4 text-slate-400" />
                                                <span className="text-sm font-extrabold text-slate-700">Tempo por peça (médio)</span>
                                            </div>
                                            <span className="text-sm font-black text-slate-950">{calculatedData.turnoA.tempoPorPecaStr}</span>
                                        </div>
                                    )}
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

                            {/* Estatísticas Turno B (visível apenas com 2 turnos) */}
                            {hasSecondShift && (
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
                                    {/* Peças Produzidas / Peso Produzido */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2 mr-2">
                                            <LayersIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">
                                                {isTrefila ? 'Peso produzido no turno' : 'Quantidade de peças produzidas'}
                                            </span>
                                        </div>
                                        {isTrefila ? (
                                            <div className="flex items-center gap-1 font-bold text-sm text-slate-950 shrink-0 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    value={statsShiftB.pecasProduzidas || ''}
                                                    onChange={e => setStatsShiftB({ ...statsShiftB, pecasProduzidas: parseFloat(e.target.value) || 0 })}
                                                    className="modern-editable-input text-center w-20 text-slate-950 border-b border-slate-200 font-black text-sm"
                                                    placeholder="0"
                                                />
                                                <span className="text-slate-500 font-bold text-xs px-1">kg</span>
                                            </div>
                                        ) : (
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
                                        )}
                                    </div>
                                    {/* Metros Produzidos */}
                                    <div className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2">
                                            <RulerIcon className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-extrabold text-slate-700">Quantidade de metros produzidos</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-950">{calculatedData.turnoB.metrosProduzidos} metros</span>
                                    </div>
                                    {/* Tempo por Peça (Apenas para máquinas com peças/treliças) */}
                                    {!isTrefila && (
                                        <div className="flex items-center justify-between py-2.5">
                                            <div className="flex items-center gap-2">
                                                <ClockIcon className="h-4 w-4 text-slate-400" />
                                                <span className="text-sm font-extrabold text-slate-700">Tempo por peça (médio)</span>
                                            </div>
                                            <span className="text-sm font-black text-slate-950">{calculatedData.turnoB.tempoPorPecaStr}</span>
                                        </div>
                                    )}
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
                        )}
                    </div>

                        {/* Atualização da Produção (Lotes de Pesagem) */}
                        <div className="p-4 bg-[#fbfcfd]">
                            <div className="border border-[#002060] rounded-lg overflow-hidden bg-white shadow-sm">
                                <div className="bg-[#002060] text-white py-2 text-center text-xs font-black tracking-wider uppercase">
                                    ATUALIZAÇÃO DA PRODUÇÃO
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 bg-slate-50/50 py-2 px-4 gap-2">
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                                        <span>{isTrefila ? 'Meta programada:' : 'Quantidade de peças a produzir:'}</span>
                                        <input
                                            type="number"
                                            value={piecesToProduce}
                                            onChange={e => setPiecesToProduce(parseInt(e.target.value, 10) || 0)}
                                            className="modern-editable-input text-center w-24 text-[#002060] font-black text-xs"
                                        />
                                        <span className="text-slate-500 font-medium">{isTrefila ? 'kg' : 'treliças'}</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleReloadAutoData}
                                            className="bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-black py-1 px-3 rounded shadow transition-colors no-print uppercase cursor-pointer"
                                            title="Sincronizar dados com a produção da máquina"
                                        >
                                            🔄 Sincronizar OP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addProductionUpdateRow}
                                            className="bg-[#002060] hover:bg-slate-800 text-white text-[10px] font-black py-1 px-3.5 rounded shadow transition-colors no-print uppercase cursor-pointer"
                                        >
                                            + Registrar Peso
                                        </button>
                                    </div>
                                </div>

                                <table className="w-full border-collapse">
                                    <thead>
                                        {isTrefila ? (
                                            <tr className="bg-[#002060] text-white text-[10px] font-black uppercase border-b border-slate-700">
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '15%' }}>Data</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '20%' }}>Lote</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '20%' }}>KG (Entrada)</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '20%' }}>Saída (KG)</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '15%' }}>Bitola</th>
                                                <th className="py-2 text-center no-print" style={{ width: '60px' }}>Ações</th>
                                            </tr>
                                        ) : (
                                            <tr className="bg-[#002060] text-white text-[10px] font-black uppercase border-b border-slate-700">
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Qnt.</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Peso (kg)</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Média (kg/peça)</th>
                                                <th className="py-2 border-r border-slate-700 text-center" style={{ width: '25%' }}>Data</th>
                                                <th className="py-2 text-center no-print" style={{ width: '60px' }}>Ações</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {productionUpdates.length === 0 ? (
                                            <tr>
                                                <td colSpan={isTrefila ? 6 : 5} className="py-5 text-slate-400 italic font-bold text-center text-xs">
                                                    Nenhum lote de pesagem registrado. Clique em "+ Registrar Peso" ou "🔄 Sincronizar OP".
                                                </td>
                                            </tr>
                                        ) : isTrefila ? (
                                            (() => {
                                                // Ordenar rigorosamente para garantir que dias iguais fiquem agrupados juntos
                                                const sortedUpdates = [...productionUpdates].sort((a, b) => 
                                                    parseDateSortKey(a.data) - parseDateSortKey(b.data)
                                                );

                                                const dayGroups: { date: string; rows: ProductionUpdateRow[] }[] = [];
                                                sortedUpdates.forEach(row => {
                                                    const d = (row.data || '').trim() || 'Sem Data';
                                                    const lastGroup = dayGroups[dayGroups.length - 1];
                                                    if (lastGroup && lastGroup.date === d) {
                                                        lastGroup.rows.push(row);
                                                    } else {
                                                        dayGroups.push({ date: d, rows: [row] });
                                                    }
                                                });

                                                const overallEntrada = sortedUpdates.reduce((sum, r) => sum + (Number(r.kgEntrada) || 0), 0);
                                                const overallSaida = sortedUpdates.reduce((sum, r) => sum + (Number(r.saida || r.peso) || 0), 0);
                                                let overallRendimentoStr = '-';
                                                let overallPerdaStr = '-';
                                                let overallPerdaNum = 0;
                                                if (overallEntrada > 0) {
                                                    const rend = (overallSaida / overallEntrada) * 100;
                                                    overallRendimentoStr = rend.toFixed(1).replace('.', ',') + '%';
                                                    overallPerdaNum = Math.max(0, 100 - rend);
                                                    overallPerdaStr = overallPerdaNum.toFixed(1).replace('.', ',') + '%';
                                                }

                                                return (
                                                    <>
                                                        {dayGroups.map((group, gIdx) => {
                                                            const totalEntradaDia = group.rows.reduce((sum, r) => sum + (Number(r.kgEntrada) || 0), 0);
                                                            const totalSaidaDia = group.rows.reduce((sum, r) => sum + (Number(r.saida || r.peso) || 0), 0);
                                                            let rendimentoStr = '-';
                                                            let perdaStr = '-';
                                                            let rendimentoNum = 0;
                                                            let perdaNum = 0;
                                                            if (totalEntradaDia > 0) {
                                                                rendimentoNum = (totalSaidaDia / totalEntradaDia) * 100;
                                                                rendimentoStr = rendimentoNum.toFixed(1).replace('.', ',') + '%';
                                                                perdaNum = Math.max(0, 100 - rendimentoNum);
                                                                perdaStr = perdaNum.toFixed(1).replace('.', ',') + '%';
                                                            }

                                                            return (
                                                                <React.Fragment key={`group-${group.date}-${gIdx}`}>
                                                                    {group.rows.map((row, rIdx) => (
                                                                        <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50/50 group text-xs">
                                                                            {rIdx === 0 && (
                                                                                <td
                                                                                    rowSpan={group.rows.length}
                                                                                    className="p-2 border-r border-b border-slate-200 text-center align-middle bg-slate-50/80 font-black text-sm text-[#002060]"
                                                                                >
                                                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                                                        <input
                                                                                            type="text"
                                                                                            value={group.date}
                                                                                            onChange={e => {
                                                                                                const newDate = e.target.value;
                                                                                                setProductionUpdates(prev => prev.map(p => {
                                                                                                    if (group.rows.some(gr => gr.id === p.id)) {
                                                                                                        return { ...p, data: newDate };
                                                                                                    }
                                                                                                    return p;
                                                                                                }));
                                                                                            }}
                                                                                            className="modern-editable-input text-center font-black text-sm text-[#002060] w-20 bg-white rounded border border-slate-200 shadow-sm py-1"
                                                                                            placeholder="Ex: 25/09"
                                                                                            title="Data do dia / turno (editável para o grupo)"
                                                                                        />
                                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                                            {group.rows.length} {group.rows.length === 1 ? 'lote' : 'lotes'}
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                            )}
                                                                            <td className="p-1 border-r border-slate-200 text-center">
                                                                                <input
                                                                                    type="text"
                                                                                    value={row.lote || ''}
                                                                                    onChange={e => updateProductionUpdateField(row.id, 'lote', e.target.value)}
                                                                                    className="modern-editable-input text-center w-full font-black text-xs text-blue-900"
                                                                                    placeholder="Ex: 9860"
                                                                                />
                                                                            </td>
                                                                            <td className="p-1 border-r border-slate-200 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={row.kgEntrada ?? ''}
                                                                                    onChange={e => updateProductionUpdateField(row.id, 'kgEntrada', parseFloat(e.target.value) || 0)}
                                                                                    className="modern-editable-input text-center w-full font-black text-xs"
                                                                                    placeholder="0"
                                                                                />
                                                                            </td>
                                                                            <td className="p-1 border-r border-slate-200 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={row.saida ?? row.peso ?? ''}
                                                                                    onChange={e => {
                                                                                        const val = parseFloat(e.target.value) || 0;
                                                                                        updateProductionUpdateField(row.id, 'saida', val);
                                                                                        updateProductionUpdateField(row.id, 'peso', val);
                                                                                    }}
                                                                                    className="modern-editable-input text-center w-full font-black text-xs text-emerald-700"
                                                                                    placeholder="0"
                                                                                />
                                                                            </td>
                                                                            <td className="p-1 border-r border-slate-200 text-center">
                                                                                <input
                                                                                    type="text"
                                                                                    value={row.bitola || ''}
                                                                                    onChange={e => updateProductionUpdateField(row.id, 'bitola', e.target.value)}
                                                                                    className="modern-editable-input text-center w-full font-black text-xs"
                                                                                    placeholder="Ex: 3.40 mm"
                                                                                />
                                                                            </td>
                                                                            <td className="p-1 text-center no-print">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const newDate = prompt('Digite a nova data para este lote individual (ex: 28/09):', row.data);
                                                                                            if (newDate && newDate.trim()) {
                                                                                                updateProductionUpdateField(row.id, 'data', newDate.trim());
                                                                                            }
                                                                                        }}
                                                                                        className="text-slate-400 hover:text-blue-600 font-bold p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                                        title="Mudar data deste lote individual"
                                                                                    >
                                                                                        📅
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => removeProductionUpdateRow(row.id)}
                                                                                        className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-1.5 py-0.5 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                                        title="Remover pesagem"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}

                                                                    {/* Rodapé do Dia com Totais e % de Rendimento */}
                                                                    <tr className="bg-blue-50/90 font-black text-xs border-y-2 border-[#002060]/30">
                                                                        <td colSpan={2} className="py-2.5 px-3 border-r border-[#002060]/20 text-right uppercase tracking-wider text-[11px] font-black text-[#002060]">
                                                                            TOTAL DIA ({group.date}):
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border-r border-[#002060]/20 text-center font-black text-slate-900">
                                                                            {totalEntradaDia > 0 ? totalEntradaDia.toLocaleString('pt-BR') : '0'} kg
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border-r border-[#002060]/20 text-center font-black text-emerald-700">
                                                                            {totalSaidaDia > 0 ? totalSaidaDia.toLocaleString('pt-BR') : '0'} kg
                                                                        </td>
                                                                        <td className="py-2.5 px-2 border-r border-[#002060]/20 text-center font-black">
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                                                                    rendimentoNum >= 99 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                                                    rendimentoNum >= 97 ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                                                    rendimentoNum > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                                                    'text-slate-400'
                                                                                }`}>
                                                                                    {rendimentoStr}
                                                                                </span>
                                                                                {perdaNum > 0 && (
                                                                                    <span className="text-[10px] text-slate-500 font-bold" title="Perda metálica">
                                                                                        (Perda: {perdaStr})
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-2.5 px-2 text-center no-print"></td>
                                                                    </tr>

                                                                    {/* Espaço de respiro entre os dias */}
                                                                    {gIdx < dayGroups.length - 1 && (
                                                                        <tr className="h-4 bg-slate-100/60 border-y border-slate-200/80">
                                                                            <td colSpan={6} className="h-4 p-0"></td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}

                                                        {/* TOTAL GERAL */}
                                                        <tr className="bg-[#002060] font-black text-white text-xs border-t-2 border-[#002060]">
                                                            <td colSpan={2} className="py-2.5 px-3 border-r border-slate-700 text-center uppercase tracking-wider text-[11px] font-black text-white">
                                                                TOTAL GERAL
                                                            </td>
                                                            <td className="py-2.5 px-2 border-r border-slate-700 text-center font-black text-white">
                                                                {overallEntrada > 0 ? overallEntrada.toLocaleString('pt-BR') : '0'} kg
                                                            </td>
                                                            <td className="py-2.5 px-2 border-r border-slate-700 text-center font-black text-white">
                                                                {overallSaida > 0 ? overallSaida.toLocaleString('pt-BR') : '0'} kg
                                                            </td>
                                                            <td className="py-2.5 px-2 border-r border-slate-700 text-center font-black">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[11px] font-black">
                                                                        {overallRendimentoStr}
                                                                    </span>
                                                                    {overallPerdaNum > 0 && (
                                                                        <span className="text-[10px] text-slate-300 font-bold">
                                                                            (Perda: {overallPerdaStr})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-2 text-center no-print"></td>
                                                        </tr>
                                                    </>
                                                );
                                            })()
                                        ) : (
                                            <>
                                                {productionUpdates.map(row => {
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
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
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
                                            </>
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
