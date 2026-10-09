import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, ProductionOrderData, StockItem, User, StockGauge, ShiftReport, MachineType, Bitola, DowntimeConfig, Employee, PcpShiftConfig, PcpHoliday, TrelicaSpoolStand } from '../types';
import { FioMaquinaBitolaOptions, TrefilaBitolaOptions, DefaultMalhaGauges } from '../types';
import { DEFAULT_TRELICA_MODELS, buildMergedTrelicaModels } from '../utils/trelicaModelsData';
import { supabase } from '../supabaseClient';
import { 
    fetchPcpShiftConfig, 
    savePcpShiftConfig, 
    fetchPcpHolidays, 
    addPcpHoliday, 
    deletePcpHoliday,
    fetchTrelicaSpoolStands,
    updateItem,
    insertItem,
    deleteItem,
    deductTrelicaSpoolStandConsumption
} from '../services/supabaseService';
import { 
    resolveMachineShiftConfig, 
    checkMachineShiftStatus, 
    DEFAULT_MACHINE_SHIFTS, 
    DEFAULT_GLOBAL_SHIFT_CONFIG 
} from '../services/shiftConfigService';
import TrelicaSpoolStands from './TrelicaSpoolStands';
import TrelicaWeldingHead, { getLocalMachineElectrodes, getLocalElectrodeHistory } from './TrelicaWeldingHead';
import DailyProductionReportSheetModal from './DailyProductionReportSheetModal';
import { 
    CalendarIcon, PlusIcon, ChevronRightIcon, XIcon, ArrowLeftIcon, 
    TrashIcon, PlayIcon, CheckCircleIcon, ClockIcon, ChartBarIcon, 
    CogIcon, WrenchScrewdriverIcon, PrinterIcon, ClipboardListIcon,
    AdjustmentsIcon, ChevronDownIcon, ChevronUpIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon,
    PencilIcon, LockClosedIcon
} from './icons';
import { 
    ENTRY_RINGS_LIST, 
    OUTPUT_RINGS_LIST, 
    K7PassSetup, 
    calculateK7Setup, 
    suggestDefaultK7Count 
} from '../utils/trefilaK7Setup';

interface PCPBoardProps {
    setPage: (page: Page) => void;
    productionOrders: ProductionOrderData[];
    updateProductionOrder: (id: string, updates: Partial<ProductionOrderData>) => Promise<void>;
    stock: StockItem[];
    currentUser: User | null;
    addProductionOrder?: (order: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => void;
    deleteProductionOrder?: (orderId: string) => void;
    showNotification?: (message: string, type: 'success' | 'error') => void;
    gauges?: StockGauge[];
    shiftReports?: ShiftReport[];
    downtimeConfigs?: DowntimeConfig[];
    isPcpFullscreen?: boolean;
    setIsPcpFullscreen?: (val: boolean) => void;
    employees?: Employee[];
    users?: User[];
    updateProducedQuantity?: (orderId: string, quantity: number) => Promise<void>;
    shiftConfig?: PcpShiftConfig;
    onUpdateShiftConfig?: (config: PcpShiftConfig) => void;
    recordLotWeight?: (orderId: string, lotId: string, finalWeight?: number | null, measuredGauge?: number) => Promise<void> | void;
    onLogout?: () => void;
}

// Letreiro Digital Inteligente: Rola o texto SOMENTE se não couber no espaço disponível (overflow).
// Caso o texto caiba perfeitamente (ex: Treliças e Malhas de 4 a 5 dias), fica 100% FIXO e estático.
const PCPTickerText: React.FC<{ 
    text: string; 
    className?: string; 
    separator?: string;
}> = ({ 
    text, 
    className = "", 
    separator = " • "
}) => {
    const raw = (text || '').trim();
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    useEffect(() => {
        if (!containerRef.current || !measureRef.current) return;

        const check = () => {
            if (!containerRef.current || !measureRef.current) return;
            const containerWidth = containerRef.current.clientWidth;
            const contentWidth = measureRef.current.offsetWidth;
            
            if (containerWidth <= 0 || contentWidth <= 0) return;

            // Histerese estável: precisa ultrapassar por 6px para iniciar rolagem e não tremer na transição
            setShouldScroll(prev => {
                if (prev) {
                    return contentWidth > containerWidth;
                } else {
                    return contentWidth > (containerWidth + 6);
                }
            });
        };

        check();

        if (typeof window !== 'undefined' && 'ResizeObserver' in window && containerRef.current) {
            const ro = new ResizeObserver(() => check());
            ro.observe(containerRef.current);
            return () => ro.disconnect();
        }
    }, [raw]);

    if (!raw) return null;

    const duration = Math.max(9, Math.round(raw.length * 0.42));

    return (
        <div 
            ref={containerRef} 
            className={`min-w-0 max-w-full overflow-hidden relative ${className}`} 
            title={raw}
        >
            {/* Medidor invisível estático e imutável para medição precisa sem causar layout shift */}
            <span 
                ref={measureRef} 
                aria-hidden="true" 
                style={{ 
                    position: 'absolute', 
                    visibility: 'hidden', 
                    whiteSpace: 'nowrap', 
                    pointerEvents: 'none',
                    top: 0,
                    left: 0
                }}
            >
                {raw}
            </span>

            {shouldScroll ? (
                <div 
                    className="pcp-ticker-track" 
                    style={{ animationDuration: `${duration}s` }}
                >
                    <span className="shrink-0 pr-4 whitespace-nowrap">{raw}</span>
                    <span className="shrink-0 pr-4 text-orange-500 font-black opacity-75">{separator}</span>
                    <span className="shrink-0 pr-4 whitespace-nowrap">{raw}</span>
                    <span className="shrink-0 pr-4 text-orange-500 font-black opacity-75">{separator}</span>
                </div>
            ) : (
                <span className="whitespace-nowrap block truncate select-text">
                    {raw}
                </span>
            )}
        </div>
    );
};

// Configurações de capacidade produtiva padrão por máquina para sugerir duração
const CAPACITY_DEFAULTS = {
    Trefila: 18000,        // 18.000 kg por dia
    Treliça: 3500,         // 3.500 peças por dia
    'Malha 1': 5000        // 5.000 peças/kg por dia
};

const normalizeBitola = (b?: string | number | null): string => {
    if (b === undefined || b === null) return '';
    const num = parseFloat(String(b).replace('mm', '').replace(',', '.').trim());
    return isNaN(num) ? '' : num.toFixed(2);
};

const MACHINES = [
    { name: 'Trefila 1', type: 'Trefila', color: 'border-l-cyan-500 text-cyan-400 bg-cyan-950/20' },
    { name: 'Trefila 2', type: 'Trefila', color: 'border-l-sky-500 text-sky-400 bg-sky-950/20' },
    { name: 'Treliça 1', type: 'Treliça', color: 'border-l-emerald-500 text-emerald-400 bg-emerald-950/20' },
    { name: 'Treliça 2', type: 'Treliça', color: 'border-l-green-500 text-green-400 bg-green-950/20' },
    { name: 'Malha 1', type: 'Malha', color: 'border-l-violet-500 text-violet-400 bg-violet-950/20' }
];

const DEFAULT_MALHA_MODELS = [
    'Q92 (15x15)', 'Q138 (10x10)', 'Q196 (10x10)', 'Q283 (10x10)', 'M150 (15x15)'
];

// Helpers de Manipulação de Datas do Quadro PCP
// Regra de Negócio:
// - De Segunda a Sexta: retorna a Segunda-feira da semana em andamento.
// - No Sábado ou Domingo: reconhece automaticamente a próxima semana (Segunda-feira seguinte).
export const getMonday = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    let diff: number;
    if (day === 0) {
        // Domingo: avança 1 dia para a próxima Segunda-feira
        diff = 1;
    } else if (day === 6) {
        // Sábado: avança 2 dias para a próxima Segunda-feira
        diff = 2;
    } else {
        // Segunda a Sexta: ajusta para a Segunda da semana atual
        diff = 1 - day;
    }
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
};

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const formatDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const formatFriendlyDate = (date: Date | string): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T12:00:00') : date;
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const getIsoDateStrGlobal = (iso?: string | null): string => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso).split('T')[0];
        return formatDateString(d);
    } catch {
        return String(iso).split('T')[0];
    }
};

export const getIsoDateStr = getIsoDateStrGlobal;

export const PCPBoard: React.FC<PCPBoardProps> = ({
    setPage,
    productionOrders,
    updateProductionOrder,
    stock,
    currentUser,
    addProductionOrder,
    deleteProductionOrder,
    showNotification,
    gauges = [],
    shiftReports = [],
    downtimeConfigs = [],
    isPcpFullscreen = false,
    setIsPcpFullscreen,
    employees = [],
    users = [],
    updateProducedQuantity,
    shiftConfig: incomingShiftConfig,
    onUpdateShiftConfig,
    recordLotWeight,
    onLogout
}) => {
    // Modo Visualizador (Somente Leitura - Não pode editar, criar ou excluir)
    const isViewer = currentUser?.role === 'viewer' || (currentUser?.role !== 'admin' && currentUser?.role !== 'gestor' && currentUser?.username?.toLowerCase() !== 'admin' && currentUser?.username?.toLowerCase() !== 'gestor' && !currentUser?.username?.toLowerCase().includes('matheusmiranda'));
    const isGestor = !isViewer;

    // Identifica se o usuário possui parametrização específica de máquinas no cadastro (ex: Compras com TR 1, TL 1, TL 2, ML 1)
    const hasCustomMachines = Boolean(
        currentUser?.allowedMachines && 
        Array.isArray(currentUser.allowedMachines) && 
        currentUser.allowedMachines.length > 0 && 
        currentUser.allowedMachines.length < MACHINES.length
    );

    // Quando for perfil Somente PCP (viewer) ou usuário com máquinas selecionadas/restritas pelo gestor:
    // A barra de seleção superior de máquinas é ocultada e o quadro exibe exatamente as máquinas atribuídas
    const isPcpRestrictedAccess = Boolean(isViewer || hasCustomMachines);

    // Estado de cabeçalho minimizado/expandido (persistido)
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(() => {
        return localStorage.getItem('pcp_header_collapsed') === 'true';
    });

    // Limpeza de chaves legadas de relatório diário no localStorage que causavam divergência entre computadores
    useEffect(() => {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('daily_report_')) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch {}
    }, []);

    // Zoom inteligente: Ativo em Tela Cheia ou no Modo Visualizador (sem barras laterais) para máxima visibilidade
    const isLargeZoom = Boolean(isPcpFullscreen || isViewer);
    const isFullscreenZoom = Boolean(isPcpFullscreen);

    // Estado para lançamento rápido de peso de lote aguardando pesagem (Trefila 1 e 2)
    const [weighingLotModal, setWeighingLotModal] = useState<{
        op: ProductionOrderData;
        lotId: string;
        lotName: string;
        entryWeight: number;
        initialWeightInput: string;
    } | null>(null);
    const [lotWeightInput, setLotWeightInput] = useState<string>('');
    const [measuredGaugeInput, setMeasuredGaugeInput] = useState<string>('');
    const [isSavingLotWeight, setIsSavingLotWeight] = useState(false);

    const handleOpenWeighLot = (op: ProductionOrderData, lotId: string, lotName: string, entryWeight: number) => {
        setWeighingLotModal({
            op,
            lotId,
            lotName,
            entryWeight,
            initialWeightInput: entryWeight > 0 ? String(entryWeight) : ''
        });
        setLotWeightInput(entryWeight > 0 ? String(entryWeight) : '');
        setMeasuredGaugeInput(op.targetBitola || '');
    };

    const handleSaveLotWeight = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isViewer) {
            showNotification?.('Perfil de visualização: registro de peso bloqueado.', 'warning');
            return;
        }
        if (!weighingLotModal) return;

        const parsedWeight = parseFloat(lotWeightInput.replace(',', '.'));
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            showNotification?.('Informe um peso válido maior que zero (kg).', 'error');
            return;
        }

        const parsedGauge = measuredGaugeInput ? parseFloat(measuredGaugeInput.replace(',', '.')) : undefined;
        const finalGauge = (parsedGauge !== undefined && !isNaN(parsedGauge)) ? parsedGauge : undefined;

        setIsSavingLotWeight(true);
        try {
            if (recordLotWeight) {
                await recordLotWeight(weighingLotModal.op.id, weighingLotModal.lotId, parsedWeight, finalGauge);
            } else {
                const targetOp = weighingLotModal.op;
                const updatedLots = (targetOp.processedLots || []).map((l: any) => {
                    if (l.lotId === weighingLotModal.lotId) {
                        return {
                            ...l,
                            finalWeight: parsedWeight,
                            measuredGauge: finalGauge !== undefined ? finalGauge : l.measuredGauge
                        };
                    }
                    return l;
                });
                const newActualWeight = updatedLots.reduce((sum: number, l: any) => sum + (Number(l.finalWeight) || 0), 0);
                await updateProductionOrder(targetOp.id, {
                    processedLots: updatedLots,
                    actualProducedWeight: newActualWeight
                });
            }
            showNotification?.(`Peso do Lote ${weighingLotModal.lotName} (${parsedWeight.toLocaleString('pt-BR')} kg) registrado com sucesso!`, 'success');
            setWeighingLotModal(null);
        } catch (err: any) {
            console.error('Erro ao registrar peso do lote:', err);
            showNotification?.(`Erro ao salvar peso: ${err.message || err}`, 'error');
        } finally {
            setIsSavingLotWeight(false);
        }
    };

    const [selectedDailyReport, setSelectedDailyReport] = useState<{ op: ProductionOrderData, date: Date, dateStr: string, dayName: string, produced: number, unit: string, dayStats?: any } | null>(null);
    const [officialReportModalData, setOfficialReportModalData] = useState<{ op: ProductionOrderData; dateStr: string; machine: string; initialProduced?: number; initialOperator?: string; initialDayStats?: any } | null>(null);

    type TrelicaModel = typeof DEFAULT_TRELICA_MODELS[number];
    const [trelicaModels, setTrelicaModels] = useState<TrelicaModel[]>(() => {
        try {
            const saved = localStorage.getItem('cached_trelica_models');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return buildMergedTrelicaModels([], gauges, parsed);
                }
            }
        } catch (e) {}
        return buildMergedTrelicaModels([], gauges, DEFAULT_TRELICA_MODELS);
    });

    useEffect(() => {
        const loadModels = async () => {
            try {
                let cached: any[] = [];
                const saved = localStorage.getItem('cached_trelica_models');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) cached = parsed;
                    } catch (e) {}
                }
                const { data, error } = await supabase.from('trelica_models').select('*');
                const merged = buildMergedTrelicaModels(data || [], gauges, cached);
                setTrelicaModels(merged);
                localStorage.setItem('cached_trelica_models', JSON.stringify(merged));
            } catch (err) {
                console.error("Failed to load models", err);
                const merged = buildMergedTrelicaModels([], gauges, []);
                setTrelicaModels(merged);
            }
        };
        loadModels();
    }, [gauges]);


    const handleToggleFullscreen = () => {
        const next = !isPcpFullscreen;
        if (setIsPcpFullscreen) {
            setIsPcpFullscreen(next);
        }
        localStorage.setItem('pcp_fullscreen_mode', String(next));
        try {
            if (next && !document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
            } else if (!next && document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
            }
        } catch {}
    };

    // Sincronizar estado de Tela Cheia com evento nativo do navegador (ex: tecla ESC ou F11)
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isDocFullscreen = !!document.fullscreenElement;
            if (!isDocFullscreen && isPcpFullscreen) {
                if (setIsPcpFullscreen) setIsPcpFullscreen(false);
                localStorage.setItem('pcp_fullscreen_mode', 'false');
            } else if (isDocFullscreen && !isPcpFullscreen) {
                if (setIsPcpFullscreen) setIsPcpFullscreen(true);
                localStorage.setItem('pcp_fullscreen_mode', 'true');
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isPcpFullscreen, setIsPcpFullscreen]);

    // Estado de data de referência (inicializado com a segunda-feira da semana ativa)
    const [currentDate, setCurrentDate] = useState<Date>(() => getMonday(new Date()));

    // Máquinas disponíveis para o usuário atual (respeita parametrização de allowedMachines no cadastro de usuário)
    const availableMachines = useMemo(() => {
        const userAllowed = currentUser?.allowedMachines;
        if (!userAllowed || !Array.isArray(userAllowed) || userAllowed.length === 0) {
            return MACHINES;
        }
        const filtered = MACHINES.filter(m => {
            return userAllowed.includes(m.name) ||
                   (m.name === 'Trefila 1' && (userAllowed.includes('TR 1') || userAllowed.includes('trefila1'))) ||
                   (m.name === 'Trefila 2' && (userAllowed.includes('TR 2') || userAllowed.includes('trefila2'))) ||
                   (m.name === 'Treliça 1' && (userAllowed.includes('TL 1') || userAllowed.includes('trelica1'))) ||
                   (m.name === 'Treliça 2' && (userAllowed.includes('TL 2') || userAllowed.includes('trelica2'))) ||
                   (m.name === 'Malha 1' && (userAllowed.includes('ML 1') || userAllowed.includes('malha1')));
        });
        return filtered.length > 0 ? filtered : MACHINES;
    }, [currentUser?.allowedMachines]);

    // Filtro de máquinas visíveis (com persistência no localStorage apenas para acesso normal)
    const [selectedMachinesFilter, setSelectedMachinesFilter] = useState<string[]>(() => {
        const allowedNames = availableMachines.map(m => m.name);
        if (isPcpRestrictedAccess) {
            return allowedNames;
        }
        try {
            const saved = localStorage.getItem('pcp_selected_machines_filter');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const valid = parsed.filter((m: string) => allowedNames.includes(m));
                    if (valid.length > 0) return valid;
                }
            }
        } catch {}
        return allowedNames;
    });

    // Sincronizar filtro quando availableMachines ou permissão mudar
    useEffect(() => {
        const allowedNames = availableMachines.map(m => m.name);
        if (isPcpRestrictedAccess) {
            setSelectedMachinesFilter(allowedNames);
            return;
        }
        setSelectedMachinesFilter(prev => {
            const valid = prev.filter(m => allowedNames.includes(m));
            return valid.length > 0 ? valid : allowedNames;
        });
    }, [availableMachines, isPcpRestrictedAccess]);

    // Salvar filtro de máquinas apenas no acesso normal (evita interferência no perfil visualizador/restrito)
    useEffect(() => {
        if (!isPcpRestrictedAccess) {
            try {
                localStorage.setItem('pcp_selected_machines_filter', JSON.stringify(selectedMachinesFilter));
            } catch {}
        }
    }, [selectedMachinesFilter, isPcpRestrictedAccess]);

    // Relógio em tempo real para os cronômetros das máquinas e paradas (atualiza a cada 1 segundo)
    const [liveNow, setLiveNow] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setLiveNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Sincronização automática da semana no Quadro PCP:
    // Garante que o sistema acompanhe sempre a semana de trabalho atual.
    // No Sábado ou Domingo, reconhece automaticamente a próxima semana (Segunda a Sexta).
    const activeMondayStr = useMemo(() => formatDateString(getMonday(liveNow)), [liveNow]);
    const isCurrentWeek = useMemo(() => {
        return formatDateString(getMonday(currentDate)) === activeMondayStr;
    }, [currentDate, activeMondayStr]);

    const isWeekend = useMemo(() => {
        const d = liveNow.getDay();
        return d === 0 || d === 6;
    }, [liveNow]);

    const prevActiveMondayRef = useRef<string>(activeMondayStr);

    // Se o quadro estiver aberto e virar o dia/semana (ex: virada de Sexta para Sábado ou Domingo para Segunda),
    // atualiza automaticamente a data de referência se o usuário estiver acompanhando a semana atual
    useEffect(() => {
        if (prevActiveMondayRef.current !== activeMondayStr) {
            setCurrentDate(prev => {
                const prevDisplayedMonday = formatDateString(getMonday(prev));
                if (prevDisplayedMonday === prevActiveMondayRef.current) {
                    return getMonday(new Date());
                }
                return prev;
            });
            prevActiveMondayRef.current = activeMondayStr;
        }
    }, [activeMondayStr]);

    // Ao reativar a janela ou retornar para a aba (ex: tela ligada no galpão)
    useEffect(() => {
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                const now = new Date();
                setLiveNow(now);
                const currentActiveMonday = formatDateString(getMonday(now));
                if (prevActiveMondayRef.current !== currentActiveMonday) {
                    setCurrentDate(prev => {
                        const prevDisplayedMonday = formatDateString(getMonday(prev));
                        if (prevDisplayedMonday === prevActiveMondayRef.current) {
                            return getMonday(now);
                        }
                        return prev;
                    });
                    prevActiveMondayRef.current = currentActiveMonday;
                }
            }
        };

        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        return () => {
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Helper para localizar funcionário pelo nome, username ou appUserId
    const findEmployeeByIdentifier = (identifier?: string): Employee | undefined => {
        if (!identifier) return undefined;
        const clean = identifier.trim().toLowerCase();
        if (clean === 'gestor' || clean === 'ghost_order_flag') return undefined;

        // 1. Busca direta por username no app_users
        const matchedUser = users.find(u => u.username.toLowerCase() === clean || u.id === clean);
        if (matchedUser?.employeeId) {
            const emp = employees.find(e => e.id === matchedUser.employeeId);
            if (emp) return emp;
        }
        if (matchedUser) {
            const emp = employees.find(e => e.appUserId === matchedUser.id);
            if (emp) return emp;
        }

        // 2. Busca por nome do funcionário (exato ou contendo)
        const empByName = employees.find(e => {
            const eName = e.name.toLowerCase();
            return eName === clean || eName.includes(clean) || clean.includes(eName);
        });
        if (empByName) return empByName;

        // 3. Busca pelo primeiro nome (ex: "willian" -> "Willian de Jesus...")
        const parts = clean.split(/\s+/).filter(p => p.length >= 3);
        if (parts.length > 0) {
            const empByFirst = employees.find(e => e.name.toLowerCase().startsWith(parts[0]));
            if (empByFirst) return empByFirst;
        }

        return undefined;
    };

    // Formatar nome curto (Primeiro + Último Sobrenome)
    const formatShortName = (fullName?: string): string => {
        if (!fullName) return 'Operador';
        const parts = fullName.trim().split(/\s+/).filter(Boolean);
        if (parts.length <= 1) return parts[0] || 'Operador';
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        return `${cap(parts[0])} ${cap(parts[parts.length - 1])}`;
    };

    // Obter o operador ativo ou status de turno da máquina
    const getMachineOperator = (machName: string) => {
        // 1. Encontra OP ativa/em andamento nesta máquina
        const liveOp = productionOrders.find(o => 
            (o.scheduledMachine === machName || o.machine === machName) && 
            (o.status === 'in_progress' || o.status === 'Em Produção' || o.status === 'running')
        );

        if (!liveOp) {
            // Nenhuma ordem em andamento nesta máquina -> Turno não iniciado / Encerrado
            return null;
        }

        // 2. Verificar se a máquina está em 'Final de Turno' (ou seja, turno encerrado)
        const events = (liveOp.downtimeEvents || []) as any[];
        const openDowntime = [...events].reverse().find(e => !e.resumeTime);
        const todayStr = formatDateString(liveNow);

        if (openDowntime) {
            const dtDateStr = getIsoDateStr(openDowntime.stopTime);
            // Se a parada aberta for de um dia anterior, esse turno encerrou no dia anterior
            if (dtDateStr && dtDateStr < todayStr) {
                return null;
            }
            const rNorm = (openDowntime.reason || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (rNorm.includes('final de turno') || rNorm.includes('turno encerrado') || rNorm.includes('turno')) {
                // Turno foi finalizado/encerrado nesta máquina
                return null;
            }
        }

        // 3. Verificar se há log com operador que assumiu/iniciou o turno (sem endTime)
        const logs = (liveOp.operatorLogs || []) as any[];
        const openLog = [...logs].reverse().find(l => 
            !l.endTime && 
            l.operator && 
            l.operator !== 'GHOST_ORDER_FLAG' && 
            l.action !== 'Criada no PCP' &&
            l.operator.toLowerCase() !== 'gestor pcp' &&
            l.operator.toLowerCase() !== 'gestor'
        );

        if (!openLog) {
            return null;
        }

        // Se o log aberto iniciou em data anterior a hoje, esse turno pertence ao dia anterior
        const logDateStr = getIsoDateStr(openLog.startTime);
        if (logDateStr && logDateStr < todayStr) {
            return null;
        }

        // Se há log aberto mas é apenas pendente de checkin ou gerado pelo sistema
        if (openLog.pendingOperatorCheckin || (openLog.operator && openLog.operator.toUpperCase().includes('SISTEMA'))) {
            return null;
        }

        // Se o expediente já encerrou na configuração do PCP (com tolerância expirada) e não há autorização de hora extra por gestor
        const shiftEval = checkMachineShiftStatus(machName, shiftConfig, liveNow);
        if (shiftEval.autoEndShift && !shiftEval.inShiftWindow && shiftEval.isOvertime && !shiftEval.isAutoEndCountdown) {
            if (!openLog.managerAuthorized) {
                return null;
            }
        }

        // Se o horário atual é anterior ao início oficial do turno programado (ex: operador logou às 05:36 e turno inicia às 07:00 ou 07:45)
        const earlyToleranceMs = 10 * 60 * 1000;
        const isBeforeShiftStart = liveNow.getTime() < (shiftEval.shiftStartMs - earlyToleranceMs);

        const activeOpName = openLog.operator;

        // 4. Buscar dados do operador (foto, nome completo, cargo) independente de quem for
        const emp = findEmployeeByIdentifier(activeOpName);

        // Buscar se o usuário do operador está online no app
        const appUser = users.find(u => 
            u.username.toLowerCase() === activeOpName.toLowerCase() ||
            (emp && (u.employeeId === emp.id || u.id === emp.appUserId))
        );

        const isAppUserFresh = Boolean(
            appUser?.isOnline && 
            (!appUser.lastSeenAt || (Date.now() - new Date(appUser.lastSeenAt).getTime() < 120000))
        );
        const isCurrentUserFresh = Boolean(
            currentUser && (
                currentUser.username.toLowerCase() === activeOpName.toLowerCase() ||
                (emp && (currentUser.employeeId === emp.id || currentUser.id === emp.appUserId))
            )
        );

        const isOnlineInApp = isAppUserFresh || isCurrentUserFresh;

        // 5. Determinar estado e rótulo de produção vs online
        let isStopped = false;
        let isPrep = false;
        if (openDowntime) {
            const dtDateStr = getIsoDateStr(openDowntime.stopTime);
            if (!dtDateStr || dtDateStr >= todayStr) {
                const rNorm = (openDowntime.reason || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                isPrep = rNorm.includes('aguardando inicio') || rNorm.includes('setup') || rNorm === 'preparacao' || rNorm.startsWith('preparacao') || rNorm.includes('troca de rolo / preparacao') || rNorm.includes('setup + preparacao');
                isStopped = !isPrep;
            }
        }
        const isProducing = !isStopped && !isPrep && (!isBeforeShiftStart || Boolean(openLog.managerAuthorized));

        let status: 'operating' | 'online' | 'offline';
        let statusLabel: string;

        if (isProducing) {
            status = 'operating';
            statusLabel = 'Em Produção';
        } else if (isBeforeShiftStart && !openLog.managerAuthorized) {
            status = isOnlineInApp ? 'online' : 'offline';
            statusLabel = `Aguardando Turno (${shiftEval.workStart})`;
        } else if (isOnlineInApp) {
            status = 'online';
            statusLabel = isPrep ? 'Preparação' : isStopped ? 'Parada (Online)' : 'Online';
        } else {
            status = 'offline';
            statusLabel = isPrep ? 'Preparação' : isStopped ? 'Parada' : 'Turno Aberto';
        }

        const rawName = emp?.name || appUser?.username || activeOpName;

        // Último registro hoje (log de operador, produção, parada, relatório ou atividade)
        let lastTimestampMs = 0;

        (liveOp.operatorLogs || []).forEach((l: any) => {
            if (l.startTime) {
                const t = new Date(l.startTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
            if (l.endTime) {
                const t = new Date(l.endTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
        });

        (liveOp.shiftProduction || []).forEach((sp: any) => {
            if (sp.endTime) {
                const t = new Date(sp.endTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
            if (sp.timestamp) {
                const t = new Date(sp.timestamp).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
        });

        (liveOp.processedLots || []).forEach((l: any) => {
            if (l.endTime) {
                const t = new Date(l.endTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
            if (l.timestamp) {
                const t = new Date(l.timestamp).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
        });

        (liveOp.downtimeEvents || []).forEach((e: any) => {
            if (e.stopTime) {
                const t = new Date(e.stopTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
            if (e.resumeTime) {
                const t = new Date(e.resumeTime).getTime();
                if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
            }
        });

        if (openDowntime?.stopTime) {
            const t = new Date(openDowntime.stopTime).getTime();
            if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
        }

        if (liveOp.startTime) {
            const t = new Date(liveOp.startTime).getTime();
            if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
        }

        if ((liveOp as any).updatedAt) {
            const t = new Date((liveOp as any).updatedAt).getTime();
            if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
        }

        // Verifica relatórios do dia para esta máquina
        (shiftReports || []).forEach((r: any) => {
            if (r.machine === machName) {
                const tStart = r.shiftStartTime ? new Date(r.shiftStartTime).getTime() : 0;
                const tEnd = r.shiftEndTime ? new Date(r.shiftEndTime).getTime() : 0;
                if (!isNaN(tStart) && formatDateString(new Date(tStart)) === todayStr && tStart > lastTimestampMs) lastTimestampMs = tStart;
                if (!isNaN(tEnd) && formatDateString(new Date(tEnd)) === todayStr && tEnd > lastTimestampMs) lastTimestampMs = tEnd;
            }
        });

        if (lastTimestampMs === 0 && appUser?.lastSeenAt) {
            const t = new Date(appUser.lastSeenAt).getTime();
            if (!isNaN(t) && formatDateString(new Date(t)) === todayStr && t > lastTimestampMs) lastTimestampMs = t;
        }

        let lastUpdateFormatted = '';
        if (lastTimestampMs > 0) {
            const d = new Date(lastTimestampMs);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            lastUpdateFormatted = `${hh}:${mm}`;
        } else if (isProducing || isStopped || isPrep || isOnlineInApp) {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            lastUpdateFormatted = `${hh}:${mm}`;
        }

        return {
            name: rawName,
            displayName: formatShortName(rawName),
            photoUrl: emp?.photoUrl || (appUser as any)?.photoUrl,
            status,
            isOnline: isOnlineInApp,
            isProducing,
            statusLabel,
            jobTitle: emp?.jobTitle || 'Operador',
            opNumber: liveOp.orderNumber,
            lastUpdateFormatted
        };
    };

    // Estado do Drawer Lateral (Raio-X da OP)
    const [drawerOP, setDrawerOP] = useState<ProductionOrderData | null>(null);

    // Estado do Modal de Edição da OP em Produção (Nome, Meta, Turnos)
    const [editingInProgressOP, setEditingInProgressOP] = useState<ProductionOrderData | null>(null);

    // Interface de contexto para ajuste de quantidade (Turno vs Total)
    interface AdjustQuantityContext {
        order: ProductionOrderData;
        initialMode?: 'shift' | 'total';
        dayStats?: any;
        targetDay?: Date;
        dayColName?: string;
        operatorName?: string;
        shiftProduced?: number;
    }

    // Estado do Modal de Ajuste de Quantidade Produzida pelo Gestor
    const [adjustQuantityConfig, setAdjustQuantityConfig] = useState<AdjustQuantityContext | null>(null);
    const [showManagerAuthForAdjust, setShowManagerAuthForAdjust] = useState(false);
    const [pendingAdjustConfig, setPendingAdjustConfig] = useState<AdjustQuantityContext | null>(null);

    const handleOpenAdjustQuantity = (
        op: ProductionOrderData,
        options?: {
            mode?: 'shift' | 'total';
            dayStats?: any;
            targetDay?: Date;
            dayColName?: string;
            operatorName?: string;
            shiftProduced?: number;
        }
    ) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: você tem permissão apenas para consultar o painel.', 'warning');
            return;
        }
        const config: AdjustQuantityContext = {
            order: op,
            initialMode: options?.mode || 'shift',
            dayStats: options?.dayStats,
            targetDay: options?.targetDay,
            dayColName: options?.dayColName,
            operatorName: options?.operatorName,
            shiftProduced: options?.shiftProduced
        };

        if (isGestor) {
            setAdjustQuantityConfig(config);
        } else {
            setPendingAdjustConfig(config);
            setShowManagerAuthForAdjust(true);
        }
    };

    const handleManagerAuthSuccessForAdjust = () => {
        setShowManagerAuthForAdjust(false);
        if (pendingAdjustConfig) {
            setAdjustQuantityConfig(pendingAdjustConfig);
            setPendingAdjustConfig(null);
        }
    };

    // Ajuste rápido de contagem do turno (+/- 1 pç direto pelo dashboard)
    const handleQuickAdjustShift = async (
        e: React.MouseEvent,
        op: ProductionOrderData,
        dayStats: any,
        currentDay: Date,
        delta: number
    ) => {
        e.stopPropagation();
        if (isViewer) return;
        const currentShift = Number(dayStats?.produced) || 0;
        const newShift = Math.max(0, currentShift + delta);
        if (newShift === currentShift && delta < 0) return;

        const isTrefila = typeof op.machine === 'string' && op.machine.startsWith('Trefila') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Trefila'));
        const currentTotal = isTrefila 
            ? (Number(op.actualProducedWeight) || Number(op.totalProducedWeight) || 0) 
            : (Number(op.actualProducedQuantity) || 0);
        const newTotal = Math.max(0, currentTotal + delta);

        await handleSaveAdjustQuantity(op.id, newTotal, 'Ajuste rápido de contagem do turno (Gestor +/-)', {
            mode: 'shift',
            shiftQty: newShift,
            operatorName: dayStats?.operatorName,
            dayStats: dayStats
        });
    };

    const handleSaveAdjustQuantity = async (
        orderId: string, 
        newTotalQty: number, 
        reason: string,
        details?: {
            mode: 'shift' | 'total';
            shiftQty?: number;
            operatorName?: string;
            dayStats?: any;
            updatedLogs?: any[];
        }
    ) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: alterações bloqueadas.', 'warning');
            return;
        }
        const targetOrder = productionOrders.find(o => o.id === orderId);
        if (!targetOrder) return;

        const isTrefila = typeof targetOrder.machine === 'string' && targetOrder.machine.startsWith('Trefila') || (typeof targetOrder.scheduledMachine === 'string' && targetOrder.scheduledMachine.startsWith('Trefila'));
        const now = new Date().toISOString();
        const unit = isTrefila ? 'kg' : 'pçs';

        try {
            const updates: Partial<ProductionOrderData> = {
                lastQuantityUpdate: now
            };

            if (isTrefila) {
                updates.actualProducedWeight = newTotalQty;
                updates.totalProducedWeight = newTotalQty;
            } else {
                updates.actualProducedQuantity = newTotalQty;
            }

            let currentLogs = targetOrder.operatorLogs ? [...targetOrder.operatorLogs] : [];

            if (details?.mode === 'shift' && details.shiftQty !== undefined) {
                const shiftQty = Math.max(0, details.shiftQty);
                const targetDateStr = details.dayStats?.dateStr || formatDateString(new Date());
                const isTodayTarget = details.dayStats?.isToday ?? (targetDateStr === formatDateString(new Date()));

                // 1. Identificar logs vinculados à data selecionada (início ou fim na data)
                const matchingIndices: number[] = [];
                currentLogs.forEach((l: any, idx: number) => {
                    const s = getIsoDateStr(l.startTime);
                    const e = getIsoDateStr(l.endTime);
                    if (s === targetDateStr || e === targetDateStr) {
                        matchingIndices.push(idx);
                    }
                });

                // Se não há nenhum log nessa data, cria um novo
                if (matchingIndices.length === 0) {
                    const openIdx = currentLogs.findIndex((l: any) => !l.endTime);
                    if (isTodayTarget && openIdx !== -1) {
                        matchingIndices.push(openIdx);
                    } else if (isTodayTarget) {
                        currentLogs.push({
                            operator: details.operatorName || 'Operador',
                            startTime: now,
                            endTime: null,
                            startQuantity: 0
                        });
                        matchingIndices.push(currentLogs.length - 1);
                    } else {
                        currentLogs.push({
                            operator: details.operatorName || 'Operador',
                            startTime: `${targetDateStr}T08:00:00.000Z`,
                            endTime: `${targetDateStr}T17:00:00.000Z`,
                            startQuantity: 0,
                            endQuantity: shiftQty
                        });
                        matchingIndices.push(currentLogs.length - 1);
                    }
                }

                // 2. Distribuir a nova meta de peças da data
                let remainingToDistribute = shiftQty;
                matchingIndices.forEach(i => {
                    const log = currentLogs[i];
                    if (log.endTime) {
                        const originalDiff = Math.max(0, (Number(log.endQuantity) || 0) - (Number(log.startQuantity) || 0));
                        const allocated = Math.min(remainingToDistribute, originalDiff);
                        currentLogs[i] = { ...log, _targetDelta: allocated };
                        remainingToDistribute -= allocated;
                    }
                });

                const openIdxOnDay = matchingIndices.find(i => !currentLogs[i].endTime);
                if (openIdxOnDay !== undefined) {
                    currentLogs[openIdxOnDay] = { ...currentLogs[openIdxOnDay], _targetDelta: remainingToDistribute };
                    remainingToDistribute = 0;
                } else if (remainingToDistribute > 0 && matchingIndices.length > 0) {
                    const lastClosedIdx = matchingIndices[matchingIndices.length - 1];
                    currentLogs[lastClosedIdx]._targetDelta = (currentLogs[lastClosedIdx]._targetDelta || 0) + remainingToDistribute;
                }

                // 3. Re-encadear todos os logs sequencialmente para manter total e deltas 100% íntegros
                let runningAccumulator = 0;
                const newLogs = currentLogs.map((log: any, idx: number) => {
                    let pieces = 0;
                    if (log._targetDelta !== undefined) {
                        pieces = log._targetDelta;
                        delete log._targetDelta;
                    } else if (log.endTime) {
                        pieces = Math.max(0, (Number(log.endQuantity) || 0) - (Number(log.startQuantity) || 0));
                    } else {
                        // Log aberto que não pertence à data (fallback)
                        const prevTot = isTrefila 
                            ? (Number(targetOrder.actualProducedWeight) || Number(targetOrder.totalProducedWeight) || 0)
                            : (Number(targetOrder.actualProducedQuantity) || 0);
                        pieces = Math.max(0, prevTot - (Number(log.startQuantity) || 0));
                    }

                    const startQ = runningAccumulator;
                    runningAccumulator += pieces;

                    if (log.endTime) {
                        return {
                            ...log,
                            startQuantity: startQ,
                            endQuantity: runningAccumulator
                        };
                    } else {
                        return {
                            ...log,
                            startQuantity: startQ
                        };
                    }
                });

                updates.operatorLogs = newLogs;
                newTotalQty = runningAccumulator;
                if (isTrefila) {
                    updates.actualProducedWeight = runningAccumulator;
                    updates.totalProducedWeight = runningAccumulator;
                } else {
                    updates.actualProducedQuantity = runningAccumulator;
                }
            } else if (details?.mode === 'total') {
                if (isTrefila) {
                    updates.actualProducedWeight = newTotalQty;
                    updates.totalProducedWeight = newTotalQty;
                } else {
                    updates.actualProducedQuantity = newTotalQty;
                }

                const openLogIdx = currentLogs.findIndex((l: any) => !l.endTime);
                if (openLogIdx !== -1) {
                    let runningAccumulator = 0;
                    const newLogs = currentLogs.map((log: any, idx: number) => {
                        if (idx === openLogIdx) {
                            return {
                                ...log,
                                startQuantity: runningAccumulator
                            };
                        } else {
                            const p = Math.max(0, (Number(log.endQuantity) || 0) - (Number(log.startQuantity) || 0));
                            const sQ = runningAccumulator;
                            runningAccumulator += p;
                            return {
                                ...log,
                                startQuantity: sQ,
                                endQuantity: runningAccumulator
                            };
                        }
                    });
                    updates.operatorLogs = newLogs;
                }
            } else if (details?.updatedLogs && details.updatedLogs.length > 0) {
                updates.operatorLogs = details.updatedLogs;
                if (isTrefila) {
                    updates.actualProducedWeight = newTotalQty;
                    updates.totalProducedWeight = newTotalQty;
                } else {
                    updates.actualProducedQuantity = newTotalQty;
                }
            }

            // Atualização única atômica em production_orders
            await updateProductionOrder(orderId, updates);

            // Abate de porta-rolos para Treliça se houve aumento de peças
            const prevQty = Number(targetOrder.actualProducedQuantity) || 0;
            const deltaPieces = Math.max(0, newTotalQty - prevQty);
            const mach = targetOrder.machine || targetOrder.scheduledMachine || '';
            if (mach.startsWith('Treliça') && deltaPieces > 0) {
                const model = targetOrder.trelicaModel || (targetOrder as any)?.trelica_model || '';
                const tamanho = targetOrder.tamanho;
                deductTrelicaSpoolStandConsumption(mach, model, tamanho, deltaPieces).catch(e => {
                    console.warn('Erro ao abater nível das bobinas:', e);
                });
            }

            // Se for ajuste de turno e houver relatório de turno correspondente (fechado)
            if (details?.mode === 'shift' && details.dayStats?.dateStr && details.shiftQty !== undefined) {
                const targetDateStr = details.dayStats.dateStr;
                const matchingRep = (shiftReports || []).find(r => {
                    const isThisOp = r.productionOrderId === targetOrder.id || r.orderNumber === targetOrder.orderNumber;
                    if (!isThisOp) return false;
                    const repDate = r.date || getIsoDateStr(r.shiftStartTime || r.shiftEndTime);
                    return repDate === targetDateStr;
                });
                if (matchingRep) {
                    try {
                        const repUpdates: any = isTrefila 
                            ? { totalProducedWeight: details.shiftQty } 
                            : { totalProducedQuantity: details.shiftQty };
                        await updateItem('shift_reports', matchingRep.id, repUpdates);
                        if (isTrefila) (matchingRep as any).totalProducedWeight = details.shiftQty;
                        else (matchingRep as any).totalProducedQuantity = details.shiftQty;
                    } catch (e) {
                        console.warn('Erro ao atualizar shift_reports:', e);
                    }
                }

                // Gravar na folha diária salva (localStorage e Supabase) para refletir instantaneamente
                const machName = targetOrder.scheduledMachine || (targetOrder.machine as string) || 'Treliça 1';
                const localKey = `daily_report_${machName}_${targetDateStr}`;
                try {
                    const existingRaw = localStorage.getItem(localKey);
                    const existingData = existingRaw ? JSON.parse(existingRaw) : {};
                    const newPayload = {
                        ...existingData,
                        date: targetDateStr,
                        machine_type: machName,
                        production_order: targetOrder.orderNumber,
                        stats_shift_a: {
                            ...(existingData.stats_shift_a || {}),
                            pecasProduzidas: details.shiftQty
                        }
                    };
                    localStorage.setItem(localKey, JSON.stringify(newPayload));
                } catch {}
            }

            if (showNotification) {
                if (details?.mode === 'shift' && details.shiftQty !== undefined) {
                    showNotification(
                        `Turno de ${details.operatorName || 'Operador'} atualizado para ${details.shiftQty.toLocaleString('pt-BR')} ${unit}! Total da OP: ${newTotalQty.toLocaleString('pt-BR')} ${unit}.`,
                        'success'
                    );
                } else {
                    showNotification(
                        `Quantidade da OP #${targetOrder.orderNumber} atualizada para ${newTotalQty.toLocaleString('pt-BR')} ${unit}!`,
                        'success'
                    );
                }
            }
            setAdjustQuantityConfig(null);
        } catch (err) {
            console.error('Erro ao ajustar quantidade produzida:', err);
            if (showNotification) {
                showNotification('Erro ao salvar ajuste de quantidade.', 'error');
            }
        }
    };

    // Salvar edição de OP em andamento (Nome, Meta, Turnos Finalizados)
    const handleSaveActiveOPEdit = async (
        orderId: string,
        data: {
            newOrderNumber: string;
            newQuantityToProduce: number;
            updatedFinalizedShifts: {
                logIndex: number;
                reportId?: string;
                operator: string;
                pieces: number;
                startTime?: string;
                endTime?: string;
            }[];
            activeShiftPieces?: number;
        }
    ) => {
        const targetOrder = productionOrders.find(o => o.id === orderId) || editingInProgressOP;
        if (!targetOrder) return;

        const isTrefila = typeof targetOrder.machine === 'string' && targetOrder.machine.startsWith('Trefila') || (typeof targetOrder.scheduledMachine === 'string' && targetOrder.scheduledMachine.startsWith('Trefila'));
        const unit = isTrefila ? 'kg' : 'pçs';
        const now = new Date().toISOString();
        const oldOrderNumber = targetOrder.orderNumber;
        const cleanNewOrderNumber = data.newOrderNumber.trim() || oldOrderNumber;

        try {
            const updates: Partial<ProductionOrderData> = {
                lastQuantityUpdate: now
            };

            // 1. Atualizar Número / Nome da Ordem se alterado
            if (cleanNewOrderNumber && cleanNewOrderNumber !== oldOrderNumber) {
                updates.orderNumber = cleanNewOrderNumber;
            }

            // 2. Atualizar Quantidade a Produzir (Meta)
            if (isTrefila) {
                updates.quantityToProduce = data.newQuantityToProduce;
                updates.totalWeight = data.newQuantityToProduce;

                // Sincronizar descrição e código de produto se estavam ausentes
                if (!targetOrder.productDescription || !targetOrder.productCode) {
                    const cleanTarget = String(targetOrder.targetBitola || '').replace('mm', '').trim();
                    const matched = gauges.find((g: any) => {
                        const mat = (g.materialType || '').toLowerCase();
                        const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                        if (!isCa60) return false;
                        const gClean = String(g.gauge || '').replace('mm', '').trim();
                        return g.gauge === targetOrder.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
                    });
                    if (matched) {
                        if (!targetOrder.productCode && (matched.productCode || (matched as any).code)) {
                            updates.productCode = matched.productCode || (matched as any).code;
                        }
                        if (!targetOrder.productDescription && (matched.description || (matched as any).gaugeDescription)) {
                            updates.productDescription = matched.description || (matched as any).gaugeDescription;
                        }
                    }
                }
            } else {
                updates.quantityToProduce = data.newQuantityToProduce;
            }

            // 3. Atualizar Logs e Turnos
            let currentLogs = targetOrder.operatorLogs ? [...targetOrder.operatorLogs] : [];
            let runningAccumulator = 0;

            if (currentLogs.length > 0) {
                const newLogs = currentLogs.map((log: any, idx: number) => {
                    if (log.endTime) {
                        const editedShift = data.updatedFinalizedShifts.find(s => s.logIndex === idx);
                        const shiftQty = editedShift !== undefined
                            ? Math.max(0, editedShift.pieces)
                            : Math.max(0, (Number(log.endQuantity) || 0) - (Number(log.startQuantity) || 0));
                        
                        const startQ = runningAccumulator;
                        runningAccumulator += shiftQty;
                        return {
                            ...log,
                            startQuantity: startQ,
                            endQuantity: runningAccumulator
                        };
                    } else {
                        // Turno aberto em andamento
                        const liveQty = data.activeShiftPieces !== undefined 
                            ? Math.max(0, data.activeShiftPieces)
                            : Math.max(0, (isTrefila ? Number(targetOrder.actualProducedWeight) : Number(targetOrder.actualProducedQuantity) || 0) - (Number(log.startQuantity) || 0));
                        
                        const startQ = runningAccumulator;
                        runningAccumulator += liveQty;
                        return {
                            ...log,
                            startQuantity: startQ
                        };
                    }
                });
                updates.operatorLogs = newLogs;
            } else if (data.updatedFinalizedShifts.length > 0) {
                const newLogs = data.updatedFinalizedShifts.map((s) => {
                    const shiftQty = Math.max(0, s.pieces);
                    const startQ = runningAccumulator;
                    runningAccumulator += shiftQty;
                    return {
                        operator: s.operator || 'Operador',
                        startTime: s.startTime || now,
                        endTime: s.endTime || now,
                        startQuantity: startQ,
                        endQuantity: runningAccumulator
                    };
                });
                updates.operatorLogs = newLogs;
            } else {
                runningAccumulator = isTrefila
                    ? (Number(targetOrder.actualProducedWeight) || Number(targetOrder.totalProducedWeight) || 0)
                    : (Number(targetOrder.actualProducedQuantity) || 0);
            }

            // 4. Quantidade Total Realizada Recalculada
            if (isTrefila) {
                updates.actualProducedWeight = runningAccumulator;
                updates.totalProducedWeight = runningAccumulator;
            } else {
                updates.actualProducedQuantity = runningAccumulator;
            }

            // 5. Salvar em production_orders
            await updateProductionOrder(orderId, updates);

            // 6. Atualizar shift_reports correspondentes
            for (const s of data.updatedFinalizedShifts) {
                if (s.reportId) {
                    try {
                        const repUpdates: any = isTrefila 
                            ? { totalProducedWeight: s.pieces, order_number: cleanNewOrderNumber }
                            : { totalProducedQuantity: s.pieces, order_number: cleanNewOrderNumber };
                        await updateItem('shift_reports', s.reportId, repUpdates);
                    } catch (e) {
                        console.warn('Erro ao atualizar shift_report:', e);
                    }
                }
            }

            // 7. Se o número da OP mudou, atualizar todos os shift_reports da OP
            if (cleanNewOrderNumber && cleanNewOrderNumber !== oldOrderNumber) {
                try {
                    await supabase
                        .from('shift_reports')
                        .update({ order_number: cleanNewOrderNumber })
                        .eq('production_order_id', orderId);
                } catch (e) {
                    console.warn('Erro ao sincronizar order_number em shift_reports:', e);
                }
            }

            // 8. Abate de porta-rolos para Treliça se houve aumento de peças
            const prevQty = Number(targetOrder.actualProducedQuantity) || 0;
            const deltaPieces = Math.max(0, runningAccumulator - prevQty);
            const mach = targetOrder.machine || targetOrder.scheduledMachine || '';
            if (mach.startsWith('Treliça') && deltaPieces > 0) {
                const model = targetOrder.trelicaModel || (targetOrder as any)?.trelica_model || '';
                const tamanho = targetOrder.tamanho;
                deductTrelicaSpoolStandConsumption(mach, model, tamanho, deltaPieces).catch(e => {
                    console.warn('Erro ao abater nível das bobinas:', e);
                });
            }

            if (drawerOP && drawerOP.id === orderId) {
                setDrawerOP(prev => prev ? { ...prev, ...updates } : null);
            }

            if (showNotification) {
                showNotification(
                    `OP #${cleanNewOrderNumber} atualizada! Meta: ${data.newQuantityToProduce.toLocaleString('pt-BR')} ${unit} | Realizado: ${runningAccumulator.toLocaleString('pt-BR')} ${unit}.`,
                    'success'
                );
            }

            setEditingInProgressOP(null);
        } catch (err) {
            console.error('Erro ao salvar edição da OP em produção:', err);
            if (showNotification) {
                showNotification('Erro ao salvar alterações da ordem de produção.', 'error');
            }
        }
    };

    // Estado do Modal de Diagnóstico da Produção (Planejado vs Realizado)
    const [diagnosticOP, setDiagnosticOP] = useState<ProductionOrderData | null>(null);

    // Estado do Modal de Parâmetros de Paradas & Checklist
    const [isDowntimeLimitsModalOpen, setIsDowntimeLimitsModalOpen] = useState(false);

    // Metas de Paradas personalizadas do PCP (persistidas no localStorage)
    const [customDowntimeLimits, setCustomDowntimeLimits] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('pcp_downtime_limits');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Erro ao ler pcp_downtime_limits:', e);
        }
        return {
            'Setup': 30,
            'Troca de Rolo / Preparação': 10,
            'Lubrificação': 10,
            'Enrosco de fio': 10,
            'Quebra fio': 10,
            'Falha no sensor': 10,
            'Vazamento de água': 10,
            'Limpeza': 15,
            'Manutenção': 60,
            'Outros': 15
        };
    });

    // Frequência recomendada para checklist de lubrificação (minutos de produção contínua)
    const [lubricationIntervalMin, setLubricationIntervalMin] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('pcp_lubrication_interval');
            if (saved) return Number(saved);
        } catch (e) {}
        return 180; // a cada 3h
    });

    const handleSaveDowntimeLimits = (newLimits: Record<string, number>, intervalMin: number) => {
        setCustomDowntimeLimits(newLimits);
        setLubricationIntervalMin(intervalMin);
        localStorage.setItem('pcp_downtime_limits', JSON.stringify(newLimits));
        localStorage.setItem('pcp_lubrication_interval', intervalMin.toString());
        showNotification?.('Parâmetros de paradas e checklist atualizados com sucesso!', 'success');
        setIsDowntimeLimitsModalOpen(false);
    };

    // Estado do modal de reagendamento rápido
    const [selectedOP, setSelectedOP] = useState<ProductionOrderData | null>(null);
    const [scheduleMachine, setScheduleMachine] = useState<string>('');
    const [scheduleStartDate, setScheduleStartDate] = useState<string>('');
    const [scheduleDuration, setScheduleDuration] = useState<number>(1);

    // Estado do modal de confirmação com opção de impressão de OP
    const [createdOPSuccessModal, setCreatedOPSuccessModal] = useState<{
        orderNumber: string;
        machine: string;
        category: string;
        opData: any;
    } | null>(null);

    // ==========================================
    // ESTADOS DO MODAL DE NOVA OP DIRETA
    // ==========================================
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isMachineLocked, setIsMachineLocked] = useState(false);
    const [createCategory, setCreateCategory] = useState<'Trefila' | 'Treliça' | 'Malha'>('Trefila');
    const [createOrderNumber, setCreateOrderNumber] = useState('');
    const [createMachine, setCreateMachine] = useState<string>('Trefila 1');
    const [createStartDate, setCreateStartDate] = useState<string>('');
    const [createDuration, setCreateDuration] = useState<number>(1);
    
    // --- Campos de TREFILA (Regras idênticas a ProductionOrder.tsx) ---
    const [isGhostOrder, setIsGhostOrder] = useState(false);
    const [inputBitolaFilter, setInputBitolaFilter] = useState<Bitola | ''>('');
    const [targetBitola, setTargetBitola] = useState<Bitola>('4.20');
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    const [createOrderError, setCreateOrderError] = useState<string | null>(null);
    
    // Parâmetros operacionais de Trefilação (Velocidade, Troca de Rolo e Setup)
    const [trefilaSpeed, setTrefilaSpeed] = useState<string>('8.5'); // m/s
    const [rollChangeTimeMin, setRollChangeTimeMin] = useState<number>(10); // min por rolo
    const [setupTimeMin, setSetupTimeMin] = useState<number>(30); // min setup inicial

    // Parâmetros de K-7s e Anéis de Trefilação
    const [k7Count, setK7Count] = useState<number>(3);
    const [k7Passes, setK7Passes] = useState<K7PassSetup[]>([]);
    const [isK7Customized, setIsK7Customized] = useState<boolean>(false);

    // --- Configuração da Jornada Diária de Trabalho e Feriados (Sincronizado no Supabase) ---
    const [isWorkHoursModalOpen, setIsWorkHoursModalOpen] = useState(false);
    const [activeShiftTab, setActiveShiftTab] = useState<'hours' | 'holidays'>('hours');
    const [holidays, setHolidays] = useState<PcpHoliday[]>([]);
    const [newHolidayDate, setNewHolidayDate] = useState<string>('');
    const [newHolidayDesc, setNewHolidayDesc] = useState<string>('');
    const [isSavingShift, setIsSavingShift] = useState<boolean>(false);
    const [isAddingHoliday, setIsAddingHoliday] = useState<boolean>(false);

    const [selectedMachineShiftTab, setSelectedMachineShiftTab] = useState<string>('GLOBAL');
    const [shiftConfig, setShiftConfig] = useState<PcpShiftConfig>(() => {
        if (incomingShiftConfig) return incomingShiftConfig;
        try {
            const saved = localStorage.getItem('pcp_daily_shift_config');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Erro ao ler jornada do localStorage:', e);
        }
        return {
            ...DEFAULT_GLOBAL_SHIFT_CONFIG,
            machineConfigs: { ...DEFAULT_MACHINE_SHIFTS }
        };
    });
    const [tempShiftConfig, setTempShiftConfig] = useState<PcpShiftConfig>(shiftConfig);

    useEffect(() => {
        if (incomingShiftConfig) {
            setShiftConfig(incomingShiftConfig);
            setTempShiftConfig(incomingShiftConfig);
        }
    }, [incomingShiftConfig]);

    // Modal Exclusivo de Configuração de Turnos da Máquina (Aberto diretamente pelo botão na linha da máquina)
    const [machineShiftModalTarget, setMachineShiftModalTarget] = useState<string | null>(null);
    const [machineShiftModalDraft, setMachineShiftModalDraft] = useState<{
        shiftCount: 1 | 2;
        workStart: string;
        workEnd: string;
        noLunch: boolean;
        lunchStart: string;
        lunchEnd: string;
        shift2Start?: string;
        shift2End?: string;
    } | null>(null);

    const [machineShiftModalTab, setMachineShiftModalTab] = useState<'op' | 'equipment' | 'shifts' | 'downtimes'>('op');
    const [newDowntimeReason, setNewDowntimeReason] = useState('');
    const [newDowntimeThreshold, setNewDowntimeThreshold] = useState(15);
    const [isSavingDowntime, setIsSavingDowntime] = useState(false);
    const [localDowntimeConfigs, setLocalDowntimeConfigs] = useState<DowntimeConfig[]>(downtimeConfigs || []);

    useEffect(() => {
        if (downtimeConfigs) {
            setLocalDowntimeConfigs(downtimeConfigs);
        }
    }, [downtimeConfigs]);

    const handleOpenMachineShiftModal = (machName: string, initialTab: 'op' | 'equipment' | 'shifts' | 'downtimes' = 'op') => {
        const mCfg = resolveMachineShiftConfig(machName, shiftConfig);
        setMachineShiftModalDraft({
            shiftCount: mCfg.shiftCount === 2 ? 2 : 1,
            workStart: mCfg.workStart || '07:00',
            workEnd: mCfg.workEnd || '17:00',
            noLunch: Boolean(mCfg.noLunch),
            lunchStart: mCfg.lunchStart || '12:00',
            lunchEnd: mCfg.lunchEnd || '13:00',
            shift2Start: mCfg.shift2Start || (machName.toLowerCase().includes('treli') ? '14:48' : '14:00'),
            shift2End: mCfg.shift2End || (machName.toLowerCase().includes('treli') ? '23:36' : '23:59'),
        });
        setMachineShiftModalTab(initialTab);
        setNewDowntimeReason('');
        setNewDowntimeThreshold(15);
        setMachineShiftModalTarget(machName);
    };

    const handleAddMachineDowntime = async () => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: você não tem permissão para alterar paradas.', 'warning');
            return;
        }
        if (!machineShiftModalTarget || !newDowntimeReason.trim()) {
            showNotification?.('Informe o nome do motivo de parada.', 'warning');
            return;
        }
        const machType = machineShiftModalTarget.split(' ')[0]; // 'Trefila', 'Treliça', 'Malha'
        const reason = newDowntimeReason.trim();
        const threshold = Number(newDowntimeThreshold) || 15;

        setIsSavingDowntime(true);
        try {
            const newItem = await insertItem<DowntimeConfig>('downtime_configs', {
                reason,
                thresholdMinutes: threshold,
                machineType: machType,
                isActive: true
            } as any);

            if (newItem) {
                setLocalDowntimeConfigs(prev => [...prev, newItem]);
            }
            setNewDowntimeReason('');
            setNewDowntimeThreshold(15);
            showNotification?.(`Parada "${reason}" programada para ${machineShiftModalTarget} e salva no banco!`, 'success');
        } catch (e: any) {
            console.error('Erro ao salvar parada no banco:', e);
            showNotification?.('Erro ao salvar motivo no banco de dados.', 'error');
        } finally {
            setIsSavingDowntime(false);
        }
    };

    const handleToggleMachineDowntime = async (config: DowntimeConfig) => {
        if (isViewer) return;
        try {
            const newActive = !config.isActive;
            setLocalDowntimeConfigs(prev => prev.map(c => c.id === config.id ? { ...c, isActive: newActive } : c));
            await updateItem('downtime_configs', config.id, { isActive: newActive });
            showNotification?.(`Motivo "${config.reason}" ${newActive ? 'ativado' : 'desativado'} no banco!`, 'success');
        } catch (e) {
            console.error('Erro ao atualizar status da parada:', e);
        }
    };

    const handleDeleteMachineDowntime = async (configId: string, reasonName: string) => {
        if (isViewer) return;
        if (!window.confirm(`Deseja remover a parada "${reasonName}" do banco de dados?`)) return;
        try {
            setLocalDowntimeConfigs(prev => prev.filter(c => c.id !== configId));
            await deleteItem('downtime_configs', configId);
            showNotification?.(`Parada "${reasonName}" excluída do banco de dados!`, 'info');
        } catch (e) {
            console.error('Erro ao excluir parada:', e);
        }
    };

    const handleSeedDefaultMachineDowntimes = async () => {
        if (isViewer || !machineShiftModalTarget) return;
        const machType = machineShiftModalTarget.split(' ')[0];
        const defaultsMap: Record<string, string[]> = {
            'Trefila': [
                'Enrosco de fio', 'Quebra de fio', 'Troca de rolo / Setup', 
                'Limpeza / Lubrificação', 'Manutenção Mecânica', 'Manutenção Elétrica', 
                'Falta de Matéria-Prima', 'Ajuste de bitola', 'Falta de Energia', 'Refeição / Intervalo'
            ],
            'Treliça': [
                'Troca de Eletrodo', 'Limpeza de Eletrodos', 'Regulagem de Altura / Ângulo', 
                'Enrosco de Fio (Porta-Rolos)', 'Quebra de Fio', 'Falha de Solda', 
                'Setup de Medida', 'Manutenção Mecânica', 'Manutenção Elétrica', 
                'Falta de Matéria-Prima', 'Falta de Energia', 'Refeição / Intervalo'
            ],
            'Malha': [
                'Troca de Rolo', 'Falha de Solda', 
                'Manutenção Mecânica', 'Manutenção Elétrica', 'Falta de Energia'
            ],
            'Desbobinadeira': [
                'Troca de Rolo', 'Enrosco de Fio', 'Corte / Descarte', 'Manutenção Mecânica', 'Manutenção Elétrica'
            ]
        };

        const list = defaultsMap[machType] || defaultsMap['Trefila'];
        setIsSavingDowntime(true);
        try {
            for (const reason of list) {
                const already = localDowntimeConfigs.some(c => 
                    c.reason.toLowerCase().trim() === reason.toLowerCase().trim() && 
                    (c.machineType === machType || c.machineType === 'Geral')
                );
                if (!already) {
                    const newItem = await insertItem<DowntimeConfig>('downtime_configs', {
                        reason,
                        thresholdMinutes: 15,
                        machineType: machType,
                        isActive: true
                    } as any);
                    if (newItem) {
                        setLocalDowntimeConfigs(prev => [...prev, newItem]);
                    }
                }
            }
            showNotification?.(`Paradas padrão para ${machineShiftModalTarget} sincronizadas no banco!`, 'success');
        } catch (e) {
            console.error('Erro ao semear paradas:', e);
            showNotification?.('Erro ao sincronizar paradas padrão.', 'error');
        } finally {
            setIsSavingDowntime(false);
        }
    };

    const handleSaveMachineShiftModal = async () => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: alterações desabilitadas.', 'warning');
            return;
        }
        if (!machineShiftModalTarget || !machineShiftModalDraft) return;
        const machName = machineShiftModalTarget;

        const updatedMachCfg: any = {
            workStart: machineShiftModalDraft.workStart || '07:00',
            workEnd: machineShiftModalDraft.workEnd || '17:00',
            noLunch: Boolean(machineShiftModalDraft.noLunch),
            lunchStart: machineShiftModalDraft.lunchStart || '12:00',
            lunchEnd: machineShiftModalDraft.lunchEnd || '13:00',
            shiftCount: machineShiftModalDraft.shiftCount === 2 ? 2 : 1,
            autoStartShift: false,
            autoEndShift: true,
            autoEndTimeoutMin: 5,
            requireManagerAuthForOvertime: true
        };

        if (updatedMachCfg.shiftCount === 2) {
            updatedMachCfg.shift2Start = machineShiftModalDraft.shift2Start || '14:48';
            updatedMachCfg.shift2End = machineShiftModalDraft.shift2End || '23:36';
        }

        const updatedShiftConfig: PcpShiftConfig = {
            ...shiftConfig,
            machineConfigs: {
                ...(shiftConfig.machineConfigs || {}),
                [machName]: updatedMachCfg
            }
        };

        setShiftConfig(updatedShiftConfig);
        setTempShiftConfig(updatedShiftConfig);
        localStorage.setItem('pcp_daily_shift_config', JSON.stringify(updatedShiftConfig));
        onUpdateShiftConfig?.(updatedShiftConfig);

        try {
            await savePcpShiftConfig(updatedShiftConfig);
            showNotification?.(`Turnos da máquina ${machName} salvos no banco de dados com sucesso! (${updatedMachCfg.shiftCount === 2 ? '2 Turnos: A + B' : '1 Turno Único'})`, 'success');
        } catch (e) {
            console.warn('Erro ao salvar no banco:', e);
            showNotification?.(`Turnos da ${machName} atualizados!`, 'info');
        }

        setMachineShiftModalTarget(null);
        setMachineShiftModalDraft(null);
    };

    // Carregar configurações de jornada e feriados do Supabase e escutar em tempo real
    useEffect(() => {
        let isMounted = true;

        const loadScheduleAndHolidays = async () => {
            try {
                const [dbShift, dbHolidays] = await Promise.all([
                    fetchPcpShiftConfig(),
                    fetchPcpHolidays()
                ]);

                if (isMounted) {
                    if (dbShift) {
                        const fullShift: PcpShiftConfig = {
                            id: 'default',
                            workStart: dbShift.workStart || '07:00',
                            lunchStart: dbShift.lunchStart || '12:00',
                            lunchEnd: dbShift.lunchEnd || '13:00',
                            workEnd: dbShift.workEnd || '17:00',
                            workDays: dbShift.workDays || [1, 2, 3, 4, 5],
                            noLunch: Boolean(dbShift.noLunch),
                            autoStartShift: Boolean(dbShift.autoStartShift),
                            autoEndShift: dbShift.autoEndShift !== false,
                            autoEndTimeoutMin: dbShift.autoEndTimeoutMin || 5,
                            requireManagerAuthForOvertime: dbShift.requireManagerAuthForOvertime !== false,
                            machineConfigs: dbShift.machineConfigs || { ...DEFAULT_MACHINE_SHIFTS }
                        };
                        setShiftConfig(fullShift);
                        setTempShiftConfig(fullShift);
                        localStorage.setItem('pcp_daily_shift_config', JSON.stringify(fullShift));
                        onUpdateShiftConfig?.(fullShift);
                    }
                    if (dbHolidays && dbHolidays.length > 0) {
                        setHolidays(dbHolidays);
                    }
                }
            } catch (err) {
                console.warn('Erro ao carregar jornada/feriados do Supabase:', err);
            }
        };

        loadScheduleAndHolidays();

        // Escutar alterações em tempo real para sincronizar múltiplos computadores
        const channel = supabase.channel(`pcp-schedule-sync-${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pcp_shift_config' }, async () => {
                const updated = await fetchPcpShiftConfig();
                if (updated && isMounted) {
                    const fullShift: PcpShiftConfig = {
                        id: 'default',
                        workStart: updated.workStart || '07:00',
                        lunchStart: updated.lunchStart || '12:00',
                        lunchEnd: updated.lunchEnd || '13:00',
                        workEnd: updated.workEnd || '17:00',
                        workDays: updated.workDays || [1, 2, 3, 4, 5],
                        noLunch: Boolean(updated.noLunch),
                        autoStartShift: Boolean(updated.autoStartShift),
                        autoEndShift: updated.autoEndShift !== false,
                        autoEndTimeoutMin: updated.autoEndTimeoutMin || 5,
                        requireManagerAuthForOvertime: updated.requireManagerAuthForOvertime !== false,
                        machineConfigs: updated.machineConfigs || { ...DEFAULT_MACHINE_SHIFTS }
                    };
                    setShiftConfig(fullShift);
                    setTempShiftConfig(fullShift);
                    localStorage.setItem('pcp_daily_shift_config', JSON.stringify(fullShift));
                    onUpdateShiftConfig?.(fullShift);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pcp_holidays' }, async () => {
                const list = await fetchPcpHolidays();
                if (isMounted) {
                    setHolidays(list);
                }
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    // --- Campos de TRELIÇA (Regras idênticas a ProductionOrderTrelica.tsx) ---
    const [selectedTrelicaCod, setSelectedTrelicaCod] = useState<string>(trelicaModels[0]?.cod || 'H8L6');

    // Modelo de Treliça Selecionado
    const selectedTrelicaModel = useMemo(() => {
        return trelicaModels.find(m => m.cod === selectedTrelicaCod) || trelicaModels[0];
    }, [selectedTrelicaCod, trelicaModels]);

    const [trelicaQuantity, setTrelicaQuantity] = useState<number>(3500);
    const [isTrelicaGhostOrder, setIsTrelicaGhostOrder] = useState<boolean>(false);
    const [trelicaSuperiorLots, setTrelicaSuperiorLots] = useState<string[]>([]);
    const [trelicaInferiorLeftLots, setTrelicaInferiorLeftLots] = useState<string[]>([]);
    const [trelicaInferiorRightLots, setTrelicaInferiorRightLots] = useState<string[]>([]);
    const [trelicaSenozoideLeftLots, setTrelicaSenozoideLeftLots] = useState<string[]>([]);
    const [trelicaSenozoideRightLots, setTrelicaSenozoideRightLots] = useState<string[]>([]);
    const [activeTrelicaLotTab, setActiveTrelicaLotTab] = useState<'superior' | 'inferior' | 'senozoide'>('superior');
    const [trelicaLotSearch, setTrelicaLotSearch] = useState<string>('');
    const [trelicaShowAllGauges, setTrelicaShowAllGauges] = useState<boolean>(false);
    const [viewSpoolStandsMachine, setViewSpoolStandsMachine] = useState<string | null>(null);
    const [viewWeldingHeadMachine, setViewWeldingHeadMachine] = useState<string | null>(null);
    const [isSpoolStandsFullscreen, setIsSpoolStandsFullscreen] = useState<boolean>(true);
    const [machineMountedStands, setMachineMountedStands] = useState<TrelicaSpoolStand[]>([]);

    // Carregar automaticamente o estado dos porta-rolos ao abrir modal para Treliça
    useEffect(() => {
        if (isCreateModalOpen && createCategory === 'Treliça' && createMachine.startsWith('Treliça')) {
            fetchTrelicaSpoolStands(createMachine).then(data => {
                setMachineMountedStands(data || []);
            }).catch(() => {});
        }
    }, [isCreateModalOpen, createMachine, createCategory]);

    // Calcular quantas bobinas já montadas na máquina batem exatamente com as bitolas do modelo da OP
    const compatibleStandsForNewOp = useMemo(() => {
        if (!selectedTrelicaModel || !machineMountedStands || machineMountedStands.length === 0) return [];
        const supG = normalizeBitola(selectedTrelicaModel.superior);
        const infG = normalizeBitola(selectedTrelicaModel.inferior);
        const senG = normalizeBitola(selectedTrelicaModel.senozoide);

        return machineMountedStands.filter(s => {
            if (!s.current_lot_id || !s.current_gauge) return false;
            const g = normalizeBitola(s.current_gauge);
            if (s.role_type === 'superior') return g === supG;
            if (s.role_type.startsWith('senozoide')) return g === senG;
            if (s.role_type.startsWith('inferior')) return g === infG;
            return false;
        });
    }, [selectedTrelicaModel, machineMountedStands]);

    // Carrega os lotes dos porta-rolos atualmente montados na máquina para a nova ordem
    const handleLoadSpoolStandsToOrder = async () => {
        try {
            const stands = machineMountedStands.length > 0 ? machineMountedStands : await fetchTrelicaSpoolStands(createMachine);
            if (!stands || stands.length === 0) {
                showNotification?.(`Nenhum porta-rolo cadastrado para a ${createMachine}.`, 'info');
                return;
            }

            let loadedCount = 0;
            stands.forEach(s => {
                const rawLot = s.current_lot_id || s.current_lot_number;
                if (!rawLot) return;

                // Tenta mapear o lote bruto para o item no estoque para obter o ID canônico
                const matched = stock.find(st => st.id === rawLot || st.internalLot === rawLot || (st.lotNumber && st.lotNumber === rawLot));
                const resolvedId = matched ? matched.id : rawLot;

                if (s.role_type === 'superior') {
                    setTrelicaSuperiorLots(prev => [resolvedId, ...prev.filter(id => id !== resolvedId && id !== rawLot)]);
                    loadedCount++;
                } else if (s.role_type === 'senozoide_left') {
                    setTrelicaSenozoideLeftLots(prev => [resolvedId, ...prev.filter(id => id !== resolvedId && id !== rawLot)]);
                    loadedCount++;
                } else if (s.role_type === 'senozoide_right') {
                    setTrelicaSenozoideRightLots(prev => [resolvedId, ...prev.filter(id => id !== resolvedId && id !== rawLot)]);
                    loadedCount++;
                } else if (s.role_type === 'inferior_left') {
                    setTrelicaInferiorLeftLots(prev => [resolvedId, ...prev.filter(id => id !== resolvedId && id !== rawLot)]);
                    loadedCount++;
                } else if (s.role_type === 'inferior_right') {
                    setTrelicaInferiorRightLots(prev => [resolvedId, ...prev.filter(id => id !== resolvedId && id !== rawLot)]);
                    loadedCount++;
                }
            });

            if (loadedCount > 0) {
                showNotification?.(`✓ ${loadedCount} bobina(s) montada(s) na ${createMachine} foram vinculadas à nova ordem!`, 'success');
            } else {
                showNotification?.(`Os porta-rolos da ${createMachine} estão vazios no momento.`, 'info');
            }
        } catch (e) {
            console.error('Erro ao carregar porta-rolos:', e);
        }
    };

    // Parâmetros operacionais de Treliça (Velocidade, Setup e Metas)
    const [trelicaSpeed, setTrelicaSpeed] = useState<number>(() => {
        const saved = localStorage.getItem('trelica-machine-speed');
        return saved ? parseFloat(saved) : 10;
    });
    const [trelicaSetupTimeMin, setTrelicaSetupTimeMin] = useState<number>(() => {
        const saved = localStorage.getItem('trelica-setup-time');
        return saved ? parseFloat(saved) : 30;
    });
    const [trelicaDailyTargetOverride, setTrelicaDailyTargetOverride] = useState<number | null>(null);

    useEffect(() => {
        localStorage.setItem('trelica-machine-speed', trelicaSpeed.toString());
    }, [trelicaSpeed]);

    useEffect(() => {
        localStorage.setItem('trelica-setup-time', trelicaSetupTimeMin.toString());
    }, [trelicaSetupTimeMin]);

    // --- Campos e Catálogo de MALHA (Puxa os modelos cadastrados no sistema / Gestão de Lotes) ---
    const availableMalhaModels = useMemo(() => {
        const deletedDefaults: string[] = JSON.parse(localStorage.getItem('deleted_default_gauges') || '[]');
        const overriddenDefaults: string[] = JSON.parse(localStorage.getItem('overridden_default_gauges') || '[]');

        const result: Array<{
            id?: string;
            productCode?: string;
            description: string;
            gauge?: string;
            meshSpacing?: string;
            panelDimensions?: string;
            peso_peca?: string;
            peso_final?: string;
            longitudinal?: string;
            transversal?: string;
        }> = [];

        // 1. Modelos de Malha customizados cadastrados em gauges / Gestão de Lotes
        (gauges || []).filter(g => g.materialType === 'Malha').forEach(g => {
            result.push({
                id: g.id,
                productCode: g.productCode,
                description: g.description || `Malha ${g.gauge || ''}`,
                gauge: g.gauge,
                meshSpacing: (g as any).meshSpacing,
                panelDimensions: (g as any).panelDimensions || (g as any).tamanho,
                peso_peca: (g as any).peso_peca || g.peso_final,
                peso_final: g.peso_final,
                longitudinal: (g as any).longitudinal,
                transversal: (g as any).transversal
            });
        });

        // 2. Modelos padrão do catálogo (DefaultMalhaGauges) se não estiverem deletados ou substituídos
        DefaultMalhaGauges.forEach(d => {
            const defId = d.id || `default_ml_${d.productCode}`;
            if (deletedDefaults.includes(defId) || overriddenDefaults.includes(defId)) return;
            const exists = result.some(g => 
                (d.productCode && g.productCode === d.productCode) || 
                (g.description === d.description && g.gauge === d.gauge) ||
                g.id === defId
            );
            if (!exists) {
                result.push({
                    id: defId,
                    productCode: d.productCode,
                    description: d.description,
                    gauge: d.gauge,
                    meshSpacing: d.meshSpacing,
                    panelDimensions: d.panelDimensions,
                    peso_peca: d.peso_peca ? String(d.peso_peca) : d.peso_final ? String(d.peso_final) : undefined,
                    peso_final: d.peso_final,
                    longitudinal: d.longitudinal,
                    transversal: d.transversal
                });
            }
        });

        return result;
    }, [gauges]);

    const [malhaModel, setMalhaModel] = useState<string>('');
    const [malhaPieces, setMalhaPieces] = useState<number>(1000);
    const [malhaBitola, setMalhaBitola] = useState<Bitola>('4.20');

    // Inicializa ou sincroniza malhaModel inicial quando a lista de modelos estiver pronta
    useEffect(() => {
        if (!malhaModel && availableMalhaModels.length > 0) {
            const first = availableMalhaModels[0];
            setMalhaModel(first.description);
            if (first.gauge) {
                const rawG = first.gauge.replace('mm', '').replace(',', '.').trim();
                setMalhaBitola(rawG as Bitola);
            }
        }
    }, [availableMalhaModels, malhaModel]);

    // Modelo de Malha selecionado atualmente
    const selectedMalhaModelObj = useMemo(() => {
        return availableMalhaModels.find(m => 
            m.description === malhaModel || 
            m.productCode === malhaModel || 
            m.id === malhaModel
        ) || null;
    }, [availableMalhaModels, malhaModel]);

    // Mapeamento e Sets de Feriados para consultas rápidas O(1)
    const holidaysMap = useMemo(() => {
        const map = new Map<string, string>();
        holidays.forEach(h => {
            if (h.date) map.set(h.date, h.description || 'Feriado');
        });
        return map;
    }, [holidays]);

    const holidaysSet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
    const activeWorkDays = useMemo(() => shiftConfig.workDays || [1, 2, 3, 4, 5], [shiftConfig.workDays]);

    // Verifica se uma data específica é dia útil (dentro dos dias de expediente da empresa e não é feriado)
    const isWorkingDay = (d: Date | string): boolean => {
        if (!d) return false;
        const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : new Date(d);
        if (isNaN(date.getTime())) return false;
        const dayOfWeek = date.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
        if (isNaN(dayOfWeek) || !activeWorkDays.includes(dayOfWeek)) {
            return false;
        }
        const dateStr = formatDateString(date);
        if (!dateStr || holidaysSet.has(dateStr)) {
            return false;
        }
        return true;
    };

    // Calcula a data final com base em X dias úteis a partir da data de início (Segunda a Sexta, pulando feriados)
    const calculateEndDateByWorkDays = (startDateStr: string, durationWorkingDays: number): string => {
        if (!startDateStr || typeof startDateStr !== 'string' || startDateStr.trim() === '') return '';
        const days = Math.max(1, durationWorkingDays || 1);
        const cur = new Date(startDateStr + 'T00:00:00');
        if (isNaN(cur.getTime())) return '';
        
        let loopLimit = 0;
        // Se a data de início informada não for dia útil, avança até o primeiro dia útil disponível
        while (!isWorkingDay(cur) && loopLimit < 365) {
            cur.setDate(cur.getDate() + 1);
            loopLimit++;
        }

        // Já estamos no 1º dia útil. Contamos os dias restantes
        let counted = 1;
        loopLimit = 0;
        while (counted < days && loopLimit < 365) {
            cur.setDate(cur.getDate() + 1);
            if (isWorkingDay(cur)) {
                counted++;
            }
            loopLimit++;
        }
        return formatDateString(cur);
    };

    // Desloca uma data em +/- dias úteis (para a função MOVER ◀ ▶ e ESTENDER)
    const shiftWorkingDay = (currentDateStr: string, direction: number): string => {
        if (!currentDateStr || typeof currentDateStr !== 'string' || currentDateStr.trim() === '') return '';
        const cur = new Date(currentDateStr + 'T00:00:00');
        if (isNaN(cur.getTime())) return '';
        const step = direction >= 0 ? 1 : -1;
        const totalSteps = Math.max(1, Math.abs(direction));
        let counted = 0;
        let loopLimit = 0;
        while (counted < totalSteps && loopLimit < 365) {
            cur.setDate(cur.getDate() + step);
            if (isWorkingDay(cur)) {
                counted++;
            }
            loopLimit++;
        }
        return formatDateString(cur);
    };

    // Conta quantos dias úteis existem entre duas datas (inclusive)
    const countWorkingDaysBetween = (startStr: string, endStr: string): number => {
        if (!startStr || !endStr || startStr > endStr) return 1;
        const cur = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        if (isNaN(cur.getTime()) || isNaN(end.getTime())) return 1;
        let count = 0;
        let loopLimit = 0;
        while (cur <= end && loopLimit < 365) {
            if (isWorkingDay(cur)) {
                count++;
            }
            cur.setDate(cur.getDate() + 1);
            loopLimit++;
        }
        return Math.max(1, count);
    };

    // Gera o intervalo de Segunda a Sexta da semana selecionada
    const weekDays = useMemo(() => {
        const monday = getMonday(currentDate);
        return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    }, [currentDate]);

    const mondayStr = useMemo(() => formatDateString(weekDays[0]), [weekDays]);
    const fridayStr = useMemo(() => formatDateString(weekDays[4]), [weekDays]);
    const todayStr = useMemo(() => formatDateString(liveNow), [liveNow]);

    // OPs Agendadas para a semana atual
    const scheduledOrders = useMemo(() => {
        return productionOrders.filter(op => {
            if (!op.plannedStartDate || !op.scheduledMachine) return false;
            if (op.status === 'Cancelada') return false;

            const opStart = op.plannedStartDate;
            let opEnd = op.plannedEndDate || opStart;
            const isOpLive = op.status === 'in_progress' || op.status === 'Em Produção';
            if (isOpLive && todayStr > opEnd) {
                opEnd = todayStr;
            }

            return opStart <= fridayStr && opEnd >= mondayStr;
        });
    }, [productionOrders, mondayStr, fridayStr, todayStr]);

    // Métricas do Mini Dashboard em Tempo Real do PCP
    const pcpLiveMetrics = useMemo(() => {
        let pendingCount = 0;
        let pendingWeight = 0;
        let liveCount = 0;
        let liveWeight = 0;
        let completedCount = 0;
        let completedWeight = 0;
        const liveMachines = new Set<string>();

        scheduledOrders.forEach(op => {
            const isCompleted = op.status === 'completed' || op.status === 'Finalizado';
            const isLive = op.status === 'in_progress';
            const w = op.totalWeight || op.quantityToProduce || 0;

            if (isCompleted) {
                completedCount++;
                completedWeight += (op.actualProducedWeight || op.totalProducedWeight || w);
            } else if (isLive) {
                const machName = op.scheduledMachine || (op.machine as string);
                const activeOperator = machName ? getMachineOperator(machName) : null;
                if (activeOperator) {
                    liveCount++;
                    liveWeight += w;
                    if (machName) {
                        liveMachines.add(machName);
                    }
                } else {
                    pendingCount++;
                    pendingWeight += w;
                }
            } else {
                pendingCount++;
                pendingWeight += w;
            }
        });

        return {
            pendingCount,
            pendingWeight,
            liveCount,
            liveWeight,
            completedCount,
            completedWeight,
            liveMachinesCount: liveMachines.size,
            totalWeekOps: scheduledOrders.length
        };
    }, [scheduledOrders, productionOrders, liveNow, shiftConfig, users, currentUser, employees]);

    // Status e Paradas em tempo real de cada máquina da fábrica (atualiza com o relógio liveNow a cada 1s)
    const machineLiveStatus = useMemo(() => {
        return availableMachines.filter(m => selectedMachinesFilter.includes(m.name)).map(mach => {
            // Encontra a OP em andamento nesta máquina
            const liveOp = productionOrders.find(o => 
                (o.scheduledMachine === mach.name || o.machine === mach.name) && 
                (o.status === 'in_progress' || o.status === 'Em Produção')
            );

            if (!liveOp) {
                // Verificar se tem OP agendada aguardando início
                const pendingCount = productionOrders.filter(o => 
                    (o.scheduledMachine === mach.name || o.machine === mach.name) && 
                    o.status === 'pending'
                ).length;

                return {
                    machine: mach.name,
                    type: mach.type,
                    state: 'idle' as const,
                    badgeText: pendingCount > 0 ? `${pendingCount} NA FILA` : 'DISPONÍVEL',
                    badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
                    dotColor: pendingCount > 0 ? 'bg-amber-400' : 'bg-slate-600',
                    op: null,
                    reason: pendingCount > 0 ? 'Aguardando Início na Máquina' : 'Disponível / Sem Ordem',
                    durationMs: 0
                };
            }

            // Verificar se há operador de fato com turno aberto hoje para esta máquina
            const activeOpForMach = getMachineOperator(mach.name);
            if (!activeOpForMach) {
                return {
                    machine: mach.name,
                    type: mach.type,
                    state: 'offline' as const,
                    badgeText: 'TURNO ENCERRADO',
                    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
                    dotColor: 'bg-slate-500',
                    op: liveOp,
                    reason: 'Aguardando operador iniciar o turno hoje',
                    durationMs: 0
                };
            }

            // Tem OP rodando! Verificar se tem evento de parada aberto
            const events = (liveOp.downtimeEvents || []) as any[];
            const openEvent = [...events].reverse().find(e => !e.resumeTime);

            if (openEvent) {
                const reason = openEvent.reason || 'Parada';
                const stopMs = openEvent.stopTime ? new Date(openEvent.stopTime).getTime() : 0;
                const durMs = stopMs > 0 ? Math.max(0, liveNow.getTime() - stopMs) : 0;
                const rNorm = reason.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                const isPrep = rNorm.includes('aguardando inicio') || rNorm.includes('setup') || rNorm === 'preparacao' || rNorm.startsWith('preparacao') || rNorm.includes('troca de rolo / preparacao') || rNorm.includes('setup + preparacao');
                const isOffline = rNorm.includes('final de turno') || rNorm.includes('turno');

                if (isOffline) {
                    return {
                        machine: mach.name,
                        type: mach.type,
                        state: 'offline' as const,
                        badgeText: 'FINAL DE TURNO',
                        badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
                        dotColor: 'bg-slate-500',
                        op: liveOp,
                        reason,
                        durationMs: 0
                    };
                }

                // Cálculo de limite/tolerância para a máquina
                const machCategory = mach.name.toLowerCase().includes('trefila') ? 'trefila' :
                                     mach.name.toLowerCase().includes('trelica') ? 'trelica' :
                                     mach.name.toLowerCase().includes('malha') ? 'malha' :
                                     mach.name.toLowerCase().trim();

                const matchingConfig = (localDowntimeConfigs || []).find(c => {
                    const normConfigReason = (c.reason || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const configCategory = (c.machineType || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return rNorm === normConfigReason && 
                           (configCategory === 'geral' || !configCategory || configCategory === machCategory);
                });

                const thresholdMinutes = matchingConfig?.thresholdMinutes || 15;
                const limitMs = thresholdMinutes * 60 * 1000;
                const isOverLimit = durMs > limitMs;

                if (isPrep) {
                    return {
                        machine: mach.name,
                        type: mach.type,
                        state: 'prep' as const,
                        isOverLimit,
                        badgeText: isOverLimit ? 'PREPARAÇÃO ULTRAPASSADA' : 'PREPARAÇÃO',
                        badgeColor: isOverLimit ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white',
                        dotColor: isOverLimit ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse',
                        op: liveOp,
                        reason,
                        durationMs: durMs
                    };
                }

                return {
                    machine: mach.name,
                    type: mach.type,
                    state: 'stopped' as const,
                    isOverLimit,
                    badgeText: isOverLimit ? 'TEMPO ULTRAPASSADO' : 'ALERTA: PARADA',
                    badgeColor: isOverLimit ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white',
                    dotColor: isOverLimit ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse',
                    op: liveOp,
                    reason,
                    durationMs: durMs
                };
            }

            // Sem parada aberta -> Produzindo normalmente
            const startMs = liveOp.startTime ? new Date(liveOp.startTime).getTime() : 0;
            const durMs = startMs > 0 ? Math.max(0, liveNow.getTime() - startMs) : 0;

            return {
                machine: mach.name,
                type: mach.type,
                state: 'producing' as const,
                badgeText: 'EM OPERAÇÃO',
                badgeColor: 'bg-cyan-500/20 text-[#00E5FF] border-[#00E5FF]/40',
                dotColor: 'bg-[#00E5FF] pulse-live',
                op: liveOp,
                reason: 'Produzindo normalmente',
                durationMs: durMs
            };
        });
    }, [productionOrders, liveNow, selectedMachinesFilter]);

    // Navegar entre semanas
    const changeWeek = (weeks: number) => {
        setCurrentDate(prev => {
            const baseMonday = getMonday(prev);
            const newDate = new Date(baseMonday);
            newDate.setDate(newDate.getDate() + (weeks * 7));
            return newDate;
        });
    };

    const resetToToday = () => {
        setCurrentDate(getMonday(new Date()));
    };

    // ==========================================
    // REGRAS DE LOTES DE TREFILA (Fio Máquina)
    // ==========================================
    const availableTrefilaLots = useMemo(() => {
        return stock.filter(item =>
            item.materialType === 'Fio Máquina' &&
            item.status === 'Disponível' &&
            item.remainingQuantity > 0 &&
            (inputBitolaFilter === '' || item.bitola === inputBitolaFilter)
        ).sort((a, b) => {
            const numA = parseInt(a.internalLot);
            const numB = parseInt(b.internalLot);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (a.internalLot !== b.internalLot) return a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true });
            return new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
        });
    }, [stock, inputBitolaFilter]);

    const totalSelectedWeight = useMemo(() => {
        return selectedLotIds.reduce((total, lotId) => {
            const lot = stock.find(l => l.id === lotId);
            return total + (lot ? lot.remainingQuantity : 0);
        }, 0);
    }, [selectedLotIds, stock]);

    const handleSelectTrefilaLot = (lotId: string, isChecked: boolean) => {
        if (isChecked) {
            setSelectedLotIds(prev => {
                const next = [...prev, lotId];
                if (!inputBitolaFilter) {
                    const lot = stock.find(s => s.id === lotId || s.internalLot === lotId);
                    if (lot?.bitola) {
                        setInputBitolaFilter(lot.bitola as Bitola);
                    }
                }
                return next;
            });
        } else {
            setSelectedLotIds(prev => prev.filter(id => id !== lotId));
        }
    };

    // Helper para formatar minutos em 'Xh Ymin'
    const formatDurationHoursMin = (totalMins: number): string => {
        if (totalMins <= 0) return '0h 00min';
        const hours = Math.floor(totalMins / 60);
        const mins = Math.round(totalMins % 60);
        return `${hours}h ${mins.toString().padStart(2, '0')}min`;
    };

    // Helper para converter 'HH:mm' em minutos do dia
    const parseTimeToMinutes = (t: string): number => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const formatMinutesToHoursMinutes = (totalMin: number): string => {
        if (totalMin <= 0) return '0h 00m';
        const h = Math.floor(totalMin / 60);
        const m = Math.round(totalMin % 60);
        return `${h}h ${m.toString().padStart(2, '0')}m`;
    };

    // Helper para calcular detalhamento de jornada e horas úteis líquidas diárias
    const calculateShiftDetails = (cfg?: { workStart?: string; lunchStart?: string; lunchEnd?: string; workEnd?: string; noLunch?: boolean } | null) => {
        if (!cfg) {
            return {
                morningMinutes: 0,
                lunchMinutes: 0,
                afternoonMinutes: 0,
                totalWorkMinutes: 480,
                totalWorkHours: 8,
                isValid: true,
                errorMessage: ''
            };
        }
        const startMin = parseTimeToMinutes(cfg.workStart || '07:00');
        const isNoLunch = Boolean(cfg.noLunch);
        const lunchStartMin = isNoLunch ? 0 : parseTimeToMinutes(cfg.lunchStart || '');
        const lunchEndMin = isNoLunch ? 0 : parseTimeToMinutes(cfg.lunchEnd || '');
        const endMin = parseTimeToMinutes(cfg.workEnd || '17:00');

        let morningMinutes = 0;
        let lunchMinutes = 0;
        let afternoonMinutes = 0;
        let totalWorkMinutes = 0;
        let isValid = true;
        let errorMessage = '';

        if (endMin <= startMin) {
            isValid = false;
            errorMessage = 'O horário de encerramento deve ser maior que o de início.';
        } else if (!isNoLunch && lunchStartMin && lunchEndMin) {
            if (lunchStartMin <= startMin || lunchEndMin >= endMin || lunchEndMin <= lunchStartMin) {
                isValid = false;
                errorMessage = 'O intervalo de almoço deve estar entre o início e o fim da jornada.';
            } else {
                morningMinutes = lunchStartMin - startMin;
                lunchMinutes = lunchEndMin - lunchStartMin;
                afternoonMinutes = endMin - lunchEndMin;
                totalWorkMinutes = morningMinutes + afternoonMinutes;
            }
        } else {
            totalWorkMinutes = Math.max(0, endMin - startMin);
        }

        if (totalWorkMinutes <= 0) {
            totalWorkMinutes = 480; // fallback para 8h
        }

        const totalWorkHours = totalWorkMinutes / 60;

        return {
            morningMinutes,
            lunchMinutes,
            afternoonMinutes,
            totalWorkMinutes,
            totalWorkHours,
            isValid,
            errorMessage
        };
    };

    const dailyShiftDetails = useMemo(() => {
        return calculateShiftDetails(shiftConfig);
    }, [shiftConfig]);

    const currentTabShiftConfig = useMemo(() => {
        if (selectedMachineShiftTab === 'GLOBAL') {
            return {
                workStart: tempShiftConfig?.workStart || '07:00',
                lunchStart: tempShiftConfig?.lunchStart || '12:00',
                lunchEnd: tempShiftConfig?.lunchEnd || '13:00',
                workEnd: tempShiftConfig?.workEnd || '17:00',
                noLunch: Boolean(tempShiftConfig?.noLunch),
                autoStartShift: Boolean(tempShiftConfig?.autoStartShift),
                autoEndShift: tempShiftConfig?.autoEndShift !== false,
                autoEndTimeoutMin: tempShiftConfig?.autoEndTimeoutMin || 5,
                requireManagerAuthForOvertime: tempShiftConfig?.requireManagerAuthForOvertime !== false,
                shiftCount: 1 as const
            };
        }
        return tempShiftConfig?.machineConfigs?.[selectedMachineShiftTab] || resolveMachineShiftConfig(selectedMachineShiftTab, tempShiftConfig);
    }, [selectedMachineShiftTab, tempShiftConfig]);

    const currentTabConfig = currentTabShiftConfig;

    const tempShiftDetails = useMemo(() => {
        return calculateShiftDetails(currentTabShiftConfig);
    }, [currentTabShiftConfig]);

    const updateCurrentTabConfig = (updates: any) => {
        if (selectedMachineShiftTab === 'GLOBAL') {
            setTempShiftConfig(prev => ({ ...prev, ...updates }));
        } else {
            setTempShiftConfig(prev => {
                const currentM = prev.machineConfigs?.[selectedMachineShiftTab] || resolveMachineShiftConfig(selectedMachineShiftTab, prev);
                return {
                    ...prev,
                    machineConfigs: {
                        ...(prev.machineConfigs || {}),
                        [selectedMachineShiftTab]: {
                            ...currentM,
                            ...updates
                        }
                    }
                };
            });
        }
    };

    const handleSaveShiftConfig = async () => {
        if (!tempShiftDetails.isValid) {
            showNotification?.(tempShiftDetails.errorMessage || 'Verifique os horários informados.', 'error');
            return;
        }
        setIsSavingShift(true);
        try {
            setShiftConfig(tempShiftConfig);
            localStorage.setItem('pcp_daily_shift_config', JSON.stringify(tempShiftConfig));
            onUpdateShiftConfig?.(tempShiftConfig);
            await savePcpShiftConfig(tempShiftConfig);
            showNotification?.(`Jornada salva no banco de dados: ${tempShiftDetails.totalWorkHours.toFixed(1)}h de produção por dia!`, 'success');
            setIsWorkHoursModalOpen(false);
        } catch (e) {
            console.error('Erro ao salvar jornada no Supabase:', e);
            onUpdateShiftConfig?.(tempShiftConfig);
            showNotification?.(`Jornada aplicada: ${tempShiftDetails.totalWorkHours.toFixed(1)}h/dia. Lembre-se de aplicar o SQL no Supabase.`, 'info');
            setIsWorkHoursModalOpen(false);
        } finally {
            setIsSavingShift(false);
        }
    };

    const handleAddHoliday = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newHolidayDate || !newHolidayDesc.trim()) {
            showNotification?.('Informe a data e o nome do feriado.', 'error');
            return;
        }
        if (holidaysSet.has(newHolidayDate)) {
            showNotification?.('Já existe um feriado cadastrado nesta data.', 'error');
            return;
        }

        setIsAddingHoliday(true);
        try {
            const added = await addPcpHoliday({
                date: newHolidayDate,
                description: newHolidayDesc.trim()
            });
            if (added) {
                setHolidays(prev => [...prev, added].sort((a, b) => a.date.localeCompare(b.date)));
            }
            setNewHolidayDate('');
            setNewHolidayDesc('');
            showNotification?.('Feriado cadastrado com sucesso no banco de dados!', 'success');
        } catch (err: any) {
            console.error('Erro ao adicionar feriado:', err);
            const fallback: PcpHoliday = {
                id: 'temp-' + Date.now(),
                date: newHolidayDate,
                description: newHolidayDesc.trim()
            };
            setHolidays(prev => [...prev, fallback].sort((a, b) => a.date.localeCompare(b.date)));
            setNewHolidayDate('');
            setNewHolidayDesc('');
            showNotification?.('Feriado adicionado! Execute o script SQL no Supabase para sincronizar entre todos os computadores.', 'info');
        } finally {
            setIsAddingHoliday(false);
        }
    };

    const handleDeleteHoliday = async (id: string, desc: string) => {
        if (!confirm(`Deseja remover o feriado "${desc}"?`)) return;
        try {
            await deletePcpHoliday(id);
            setHolidays(prev => prev.filter(h => h.id !== id));
            showNotification?.(`Feriado "${desc}" removido com sucesso.`, 'success');
        } catch (err) {
            console.error('Erro ao excluir feriado:', err);
            setHolidays(prev => prev.filter(h => h.id !== id));
            showNotification?.('Feriado removido da lista.', 'info');
        }
    };

    // ==========================================
    // CÁLCULOS DE PRODUÇÃO DE TREFILAÇÃO (Velocidade, Troca de Rolo e Setup)
    // ==========================================
    const trefilaProductionCalculations = useMemo(() => {
        const d = targetBitola ? parseFloat(targetBitola.replace(',', '.')) : 4.20;
        const speed = parseFloat(trefilaSpeed.replace(',', '.')) || 0;
        // Massa linear nominal (kg/m) = d² * 0.006162 (padrão CA-60 e MachineControl)
        const linearMass = d * d * 0.006162;
        // Vazão teórica em kg/s e kg/h
        const massPerSecond = speed * linearMass;
        const massPerHour = massPerSecond * 3600;

        const numRolls = selectedLotIds.length;
        const totalWeight = totalSelectedWeight;

        // Tempo líquido de trefilação (em minutos)
        const drawingTimeMinutes = massPerHour > 0 && totalWeight > 0 
            ? (totalWeight / massPerHour) * 60 
            : 0;

        // Tempo de troca de rolos (em minutos)
        const totalRollChangeMinutes = numRolls * (rollChangeTimeMin || 0);

        // Tempo de setup inicial (em minutos)
        const totalSetupMinutes = setupTimeMin || 0;

        // Tempo total estimado da OP (em minutos)
        const totalMinutes = drawingTimeMinutes + totalRollChangeMinutes + totalSetupMinutes;
        const totalHours = totalMinutes / 60;
        const avgMinutesPerRoll = numRolls > 0 ? (drawingTimeMinutes / numRolls) : 0;

        return {
            d,
            speed,
            linearMass,
            massPerHour,
            numRolls,
            totalWeight,
            drawingTimeMinutes,
            totalRollChangeMinutes,
            totalSetupMinutes,
            totalMinutes,
            totalHours,
            avgMinutesPerRoll
        };
    }, [targetBitola, trefilaSpeed, totalSelectedWeight, selectedLotIds.length, rollChangeTimeMin, setupTimeMin]);

    // Atualiza duração estimada em dias no PCP baseado no cálculo de horas e jornada configurada
    useEffect(() => {
        if (createCategory === 'Trefila') {
            if (trefilaProductionCalculations.totalHours > 0) {
                const workHoursPerDay = dailyShiftDetails.totalWorkHours > 0 ? dailyShiftDetails.totalWorkHours : 8;
                const days = Math.max(1, Math.ceil(trefilaProductionCalculations.totalHours / workHoursPerDay));
                setCreateDuration(days);
            }
        }
    }, [trefilaProductionCalculations.totalHours, createCategory, dailyShiftDetails.totalWorkHours]);

    // Identificação reativa da bitola de entrada real (definida pelo seletor ou pelo lote marcado)
    const resolvedInputBitola = useMemo(() => {
        if (inputBitolaFilter) return inputBitolaFilter;
        if (selectedLotIds.length > 0) {
            const lot = stock.find(l => l.id === selectedLotIds[0] || l.internalLot === selectedLotIds[0]);
            if (lot?.bitola) return lot.bitola;
        }
        return '';
    }, [inputBitolaFilter, selectedLotIds, stock]);

    // Recálculo automático de K-7s e Anéis ao alterar bitolas ou selecionar lotes
    useEffect(() => {
        if (createCategory !== 'Trefila') return;
        if (!resolvedInputBitola) {
            setK7Passes([]);
            return;
        }

        const dInVal = parseFloat(String(resolvedInputBitola).replace('mm', '').replace(',', '.').trim());
        const dOutVal = parseFloat(String(targetBitola || '4.20').replace('mm', '').replace(',', '.').trim());

        if (!isNaN(dInVal) && !isNaN(dOutVal) && dInVal > dOutVal) {
            const suggested = suggestDefaultK7Count(dInVal, dOutVal);
            const countToUse = isK7Customized ? k7Count : suggested;
            if (!isK7Customized && k7Count !== suggested) {
                setK7Count(suggested);
            }
            const calculated = calculateK7Setup(countToUse, dInVal, dOutVal);
            setK7Passes(calculated);
        } else {
            setK7Passes([]);
        }
    }, [resolvedInputBitola, targetBitola, createCategory]);

    const handleSelectK7Count = (count: number) => {
        setK7Count(count);
        setIsK7Customized(true);
        if (!resolvedInputBitola) return;
        const dInVal = parseFloat(String(resolvedInputBitola).replace('mm', '').replace(',', '.').trim());
        const dOutVal = parseFloat(String(targetBitola || '4.20').replace('mm', '').replace(',', '.').trim());
        if (!isNaN(dInVal) && !isNaN(dOutVal) && dInVal > dOutVal) {
            const calculated = calculateK7Setup(count, dInVal, dOutVal);
            setK7Passes(calculated);
        }
    };

    const handleUpdateRing = (passIdx: number, field: 'entryRing' | 'outputRing', val: string) => {
        setK7Passes(prev => {
            const next = [...prev];
            if (next[passIdx]) {
                next[passIdx] = { ...next[passIdx], [field]: val, isCustom: true };
            }
            return next;
        });
        setIsK7Customized(true);
    };

    // ==========================================
    // REGRAS DE LOTES DE TRELIÇA (CA-60)
    // ==========================================
    const availableCa60Stock = useMemo(() => {
        return stock
            .filter(item => 
                (item.materialType === 'CA-60' || item.materialType === 'Trefila') &&
                item.status !== 'Transferido' &&
                !item.status?.startsWith('Em Produção') &&
                item.status !== 'Consumido para fazer treliça' &&
                item.status !== 'Consumido' &&
                item.remainingQuantity > 0
            )
            .sort((a, b) => {
                const isSuporteA = a.status === 'Disponível - Suporte Treliça';
                const isSuporteB = b.status === 'Disponível - Suporte Treliça';
                if (isSuporteA && !isSuporteB) return -1;
                if (!isSuporteA && isSuporteB) return 1;

                const numA = parseInt(a.internalLot);
                const numB = parseInt(b.internalLot);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                if (a.internalLot !== b.internalLot) {
                    return a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true });
                }
                return new Date(a.entryDate || 0).getTime() - new Date(b.entryDate || 0).getTime();
            });
    }, [stock]);

    // Cálculo de peso de Treliça
    const requiredTrelicaWeights = useMemo(() => {
        if (!selectedTrelicaModel) return { sup: 0, inf: 0, infSide: 0, sen: 0, senSide: 0, total: 0 };
        const pSup = (parseFloat(selectedTrelicaModel.pesoSuperior.replace(',', '.')) || 0) * trelicaQuantity;
        const pInfTotal = (parseFloat(selectedTrelicaModel.pesoInferior.replace(',', '.')) || 0) * trelicaQuantity;
        const pInfSide = pInfTotal / 2;
        const pSenTotal = (parseFloat(selectedTrelicaModel.pesoSenozoide.replace(',', '.')) || 0) * trelicaQuantity;
        const pSenSide = pSenTotal / 2;
        const pTotal = (parseFloat(selectedTrelicaModel.pesoFinal.replace(',', '.')) || 0) * trelicaQuantity;
        return { sup: pSup, inf: pInfTotal, infSide: pInfSide, sen: pSenTotal, senSide: pSenSide, total: pTotal };
    }, [selectedTrelicaModel, trelicaQuantity]);

    // Cálculos Operacionais de Produção e Tempos da Treliça
    const trelicaProductionCalculations = useMemo(() => {
        const pieceLength = parseFloat(selectedTrelicaModel?.tamanho?.replace(',', '.') || '12') || 12;
        const totalMeters = pieceLength * trelicaQuantity;
        const speed = trelicaSpeed > 0 ? trelicaSpeed : 10; // m/min
        const runMinutes = speed > 0 ? (totalMeters / speed) : 0;
        const setupMinutes = trelicaSetupTimeMin || 0;
        const totalMinutes = runMinutes + setupMinutes;
        const totalHours = totalMinutes / 60;

        const workHoursPerDay = dailyShiftDetails.totalWorkHours > 0 ? dailyShiftDetails.totalWorkHours : 8.8;
        const dailyWorkMinutes = workHoursPerDay * 60;
        const effectiveDailyMinutes = Math.max(0, dailyWorkMinutes - Math.min(setupMinutes, 60));
        const autoDailyPieces = Math.floor((effectiveDailyMinutes * speed) / pieceLength);
        const dailyPieces = trelicaDailyTargetOverride !== null ? trelicaDailyTargetOverride : autoDailyPieces;
        const unitWeight = parseFloat(selectedTrelicaModel?.pesoFinal?.replace(',', '.') || '0') || 0;
        const dailyKg = dailyPieces * unitWeight;

        const estimatedDays = Math.max(1, Math.ceil(totalHours / workHoursPerDay));

        return {
            pieceLength,
            totalMeters,
            speed,
            runMinutes,
            setupMinutes,
            totalMinutes,
            totalHours,
            workHoursPerDay,
            dailyPieces,
            dailyKg,
            estimatedDays
        };
    }, [selectedTrelicaModel, trelicaQuantity, trelicaSpeed, trelicaSetupTimeMin, trelicaDailyTargetOverride, dailyShiftDetails.totalWorkHours]);

    // Atualiza automaticamente duração em dias no PCP baseado no cálculo de tempos da Treliça
    useEffect(() => {
        if (createCategory === 'Treliça') {
            if (trelicaProductionCalculations.estimatedDays > 0) {
                setCreateDuration(trelicaProductionCalculations.estimatedDays);
            }
        }
    }, [trelicaProductionCalculations.estimatedDays, createCategory]);

    // Helpers de peso selecionado por posição
    const getLotRemainingWeight = (lotId: string) => {
        const item = stock.find(s => s.id === lotId || s.internalLot === lotId);
        return item ? (item.remainingQuantity || 0) : 0;
    };
    const selectedSupWeight = useMemo(() => trelicaSuperiorLots.reduce((acc, id) => acc + getLotRemainingWeight(id), 0), [trelicaSuperiorLots, stock]);
    const selectedInf1Weight = useMemo(() => trelicaInferiorLeftLots.reduce((acc, id) => acc + getLotRemainingWeight(id), 0), [trelicaInferiorLeftLots, stock]);
    const selectedInf2Weight = useMemo(() => trelicaInferiorRightLots.reduce((acc, id) => acc + getLotRemainingWeight(id), 0), [trelicaInferiorRightLots, stock]);
    const selectedSen1Weight = useMemo(() => trelicaSenozoideLeftLots.reduce((acc, id) => acc + getLotRemainingWeight(id), 0), [trelicaSenozoideLeftLots, stock]);
    const selectedSen2Weight = useMemo(() => trelicaSenozoideRightLots.reduce((acc, id) => acc + getLotRemainingWeight(id), 0), [trelicaSenozoideRightLots, stock]);
    const totalSelectedTrelicaWeight = selectedSupWeight + selectedInf1Weight + selectedInf2Weight + selectedSen1Weight + selectedSen2Weight;

    // Toggle de lotes por posição
    const handleToggleTrelicaLot = (
        position: 'sup' | 'inf1' | 'inf2' | 'sen1' | 'sen2',
        lotId: string,
        isChecked: boolean
    ) => {
        const item = stock.find(s => s.id === lotId || s.internalLot === lotId);
        const canonicalId = item ? item.id : lotId;
        const altId = item?.internalLot;

        const updateList = (prev: string[]) => {
            const filtered = prev.filter(id => id !== canonicalId && id !== lotId && (!altId || id !== altId));
            return isChecked ? [...filtered, canonicalId] : filtered;
        };

        if (position === 'sup') setTrelicaSuperiorLots(updateList);
        else if (position === 'inf1') setTrelicaInferiorLeftLots(updateList);
        else if (position === 'inf2') setTrelicaInferiorRightLots(updateList);
        else if (position === 'sen1') setTrelicaSenozoideLeftLots(updateList);
        else if (position === 'sen2') setTrelicaSenozoideRightLots(updateList);
    };

    const handleClearAllTrelicaLots = () => {
        setTrelicaSuperiorLots([]);
        setTrelicaInferiorLeftLots([]);
        setTrelicaInferiorRightLots([]);
        setTrelicaSenozoideLeftLots([]);
        setTrelicaSenozoideRightLots([]);
        showNotification?.('Seleções de lotes da treliça desmarcadas.', 'info');
    };

    // Auto-selecionar lotes de CA-60 para Treliça (priorizando bobinas já montadas nos suportes)
    const handleAutoSelectTrelicaLots = () => {
        if (!selectedTrelicaModel) return;

        const supBitolaNorm = normalizeBitola(selectedTrelicaModel.superior);
        const infBitolaNorm = normalizeBitola(selectedTrelicaModel.inferior);
        const senBitolaNorm = normalizeBitola(selectedTrelicaModel.senozoide);

        const usedIds = new Set<string>();

        // Localizar ID da bobina que já está montada com bitola compatível
        const getMountedLotId = (roleType: string, bitolaNorm: string): string | undefined => {
            const match = machineMountedStands.find(s => {
                const raw = s.current_lot_id || s.current_lot_number;
                return s.role_type === roleType && 
                    raw && 
                    normalizeBitola(s.current_gauge || '') === bitolaNorm;
            });
            if (!match) return undefined;
            const raw = match.current_lot_id || match.current_lot_number;
            const stockMatch = availableCa60Stock.find(l => l.id === raw || l.internalLot === raw);
            const foundId = stockMatch ? stockMatch.id : raw;
            return foundId && !usedIds.has(foundId) ? foundId : undefined;
        };

        const allocateLots = (bitolaNorm: string, targetWeight: number, preferredFirstLotId?: string): string[] => {
            const selected: string[] = [];
            let accumulated = 0;

            // Prioridade 1: Bobina que já está montada no suporte da máquina!
            if (preferredFirstLotId) {
                const mountedItem = availableCa60Stock.find(l => l.id === preferredFirstLotId || l.internalLot === preferredFirstLotId);
                if (mountedItem && !usedIds.has(mountedItem.id)) {
                    selected.push(mountedItem.id);
                    usedIds.add(mountedItem.id);
                    accumulated += (mountedItem.remainingQuantity || 0);
                }
            }

            if (accumulated >= targetWeight) return selected;

            const candidates = availableCa60Stock.filter(l => 
                (trelicaShowAllGauges || normalizeBitola(l.bitola) === bitolaNorm) &&
                !usedIds.has(l.id)
            );

            for (const lot of candidates) {
                selected.push(lot.id);
                usedIds.add(lot.id);
                accumulated += lot.remainingQuantity;
                if (accumulated >= targetWeight) break;
            }
            return selected;
        };

        const supPref = getMountedLotId('superior', supBitolaNorm);
        const inf1Pref = getMountedLotId('inferior_left', infBitolaNorm);
        const inf2Pref = getMountedLotId('inferior_right', infBitolaNorm);
        const sen1Pref = getMountedLotId('senozoide_left', senBitolaNorm);
        const sen2Pref = getMountedLotId('senozoide_right', senBitolaNorm);

        const newSup = allocateLots(supBitolaNorm, requiredTrelicaWeights.sup, supPref);
        const newInf1 = allocateLots(infBitolaNorm, requiredTrelicaWeights.infSide, inf1Pref);
        const newInf2 = allocateLots(infBitolaNorm, requiredTrelicaWeights.infSide, inf2Pref);
        const newSen1 = allocateLots(senBitolaNorm, requiredTrelicaWeights.senSide, sen1Pref);
        const newSen2 = allocateLots(senBitolaNorm, requiredTrelicaWeights.senSide, sen2Pref);

        setTrelicaSuperiorLots(newSup);
        setTrelicaInferiorLeftLots(newInf1);
        setTrelicaInferiorRightLots(newInf2);
        setTrelicaSenozoideLeftLots(newSen1);
        setTrelicaSenozoideRightLots(newSen2);

        const mountedUsedCount = [supPref, inf1Pref, inf2Pref, sen1Pref, sen2Pref].filter(Boolean).length;
        if (mountedUsedCount > 0) {
            showNotification?.(`⚡ Lotes alocados! ${mountedUsedCount} bobina(s) que já estavam nos suportes da ${createMachine} foram priorizadas automaticamente.`, 'success');
        } else {
            showNotification?.('Lotes de CA-60 alocados automaticamente para todas as posições da treliça!', 'success');
        }
    };

    // Abre modal para criar OP com data e máquina pré-selecionadas
    const handleOpenCreateModal = (defaultMachine?: string, defaultDate?: string) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: criação de OPs desabilitada.', 'warning');
            return;
        }
        const targetDate = defaultDate || formatDateString(new Date());
        let targetMach = defaultMachine || 'Trefila 1';
        let category: 'Trefila' | 'Treliça' | 'Malha' = 'Trefila';

        if (targetMach.startsWith('Trefila')) category = 'Trefila';
        else if (targetMach.startsWith('Treliça')) category = 'Treliça';
        else if (targetMach.startsWith('Malha')) category = 'Malha';

        setIsMachineLocked(!!defaultMachine);
        setCreateCategory(category);
        setCreateMachine(targetMach);
        setCreateStartDate(targetDate);
        setCreateDuration(1);
        
        // Limpar seleções de lotes
        setSelectedLotIds([]);
        setInputBitolaFilter('');
        setIsGhostOrder(false);
        setTrefilaSpeed('8.5');
        setRollChangeTimeMin(10);
        setSetupTimeMin(30);
        setK7Count(3);
        setIsK7Customized(false);
        setK7Passes([]);

        // Limpar seleções de Treliça
        setIsTrelicaGhostOrder(false);
        setTrelicaSuperiorLots([]);
        setTrelicaInferiorLeftLots([]);
        setTrelicaInferiorRightLots([]);
        setTrelicaSenozoideLeftLots([]);
        setTrelicaSenozoideRightLots([]);
        setActiveTrelicaLotTab('superior');
        setTrelicaLotSearch('');
        setTrelicaShowAllGauges(false);
        setTrelicaDailyTargetOverride(null);

        // Gera número de OP sugerido
        const prefix = category === 'Trefila' ? 'TR' : category === 'Treliça' ? 'TL' : 'ML';
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setCreateOrderNumber(`${prefix}-${randomNum}`);

        setIsCreateModalOpen(true);
    };

    // Alterna categoria no modal de criação
    const handleChangeCategory = (cat: 'Trefila' | 'Treliça' | 'Malha') => {
        setCreateCategory(cat);
        const prefix = cat === 'Trefila' ? 'TR' : cat === 'Treliça' ? 'TL' : 'ML';
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setCreateOrderNumber(`${prefix}-${randomNum}`);

        if (cat === 'Trefila') {
            setCreateMachine('Trefila 1');
            setSelectedLotIds([]);
            setInputBitolaFilter('');
        } else if (cat === 'Treliça') {
            setCreateMachine('Treliça 1');
            setCreateDuration(trelicaProductionCalculations.estimatedDays || 1);
        } else {
            setCreateMachine('Malha 1');
            setCreateDuration(Math.max(1, Math.ceil(malhaPieces / CAPACITY_DEFAULTS['Malha 1'])));
        }
    };

    // Função para direcionar para o relatório de impressão da OP (Ficha A4)
    const handlePrintOP = (op: ProductionOrderData) => {
        let lotIds: string[] = [];
        if (Array.isArray(op.selectedLotIds)) {
            lotIds = op.selectedLotIds;
        } else if (op.selectedLotIds && typeof op.selectedLotIds === 'object') {
            lotIds = Object.values(op.selectedLotIds).filter(Boolean) as string[];
        }

        const selectedLots = lotIds.map(id => stock.find(s => s.id === id || s.internalLot === id)).filter(Boolean) as StockItem[];
        const dateParts = op.plannedStartDate ? op.plannedStartDate.split('-') : [];
        const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : '';

        const rows = selectedLots.map(item => ({
            id: Math.random().toString(36).substring(2, 9),
            data: dateFormatted,
            lote: item.internalLot || item.supplierLot || '',
            fornecedor: item.supplier || '',
            certificado: item.conferenceNumber || '',
            corrida: item.runNumber || '',
            notaFiscal: item.nfe || '',
            pesoEtiqueta: item.labelWeight || item.weight || '',
            pesoBalanca: '',
            massaLinear: '',
            bitolaMm: '',
            rt: '',
            le: '',
            caractGeo: '',
            dobramento: '',
            verifMarcacao: '',
            alongamento: '',
            aprovacao: ''
        }));

        while (rows.length < 8) {
            rows.push({
                id: Math.random().toString(36).substring(2, 9),
                data: '', lote: '', fornecedor: '', certificado: '', corrida: '',
                notaFiscal: '', pesoEtiqueta: '', pesoBalanca: '', massaLinear: '',
                bitolaMm: '', rt: '', le: '', caractGeo: '', dobramento: '',
                verifMarcacao: '', alongamento: '', aprovacao: ''
            });
        }

        const inBitolaVal = op.inputBitola || (selectedLots[0]?.bitola) || '';
        const inBitolaStr = inBitolaVal ? (inBitolaVal.includes('mm') ? inBitolaVal : `${inBitolaVal}mm`) : '';
        const outBitolaStr = op.targetBitola ? (op.targetBitola.includes('mm') ? op.targetBitola : `${op.targetBitola}mm`) : '';

        // Obter ou calcular setup de K-7s e anéis
        let printSetup = (op as any).setup;
        if (!printSetup && Array.isArray((op as any).k7Setup) && (op as any).k7Setup.length > 0) {
            const k7s: K7PassSetup[] = (op as any).k7Setup;
            printSetup = {
                pass1: { aneisEntrada: k7s[0]?.entryRing || '', aneisSaida: k7s[0]?.outputRing || '', mmEntrada: k7s[0] ? `${k7s[0].dEntry.toFixed(2)}mm` : '', mmSaida: k7s[0] ? `${k7s[0].dOutput.toFixed(2)}mm` : '' },
                pass2: { aneisEntrada: k7s[1]?.entryRing || '', aneisSaida: k7s[1]?.outputRing || '', mmEntrada: k7s[1] ? `${k7s[1].dEntry.toFixed(2)}mm` : '', mmSaida: k7s[1] ? `${k7s[1].dOutput.toFixed(2)}mm` : '' },
                pass3: { aneisEntrada: k7s[2]?.entryRing || '', aneisSaida: k7s[2]?.outputRing || '', mmEntrada: k7s[2] ? `${k7s[2].dEntry.toFixed(2)}mm` : '', mmSaida: k7s[2] ? `${k7s[2].dOutput.toFixed(2)}mm` : '' },
                pass4: { aneisEntrada: k7s[3]?.entryRing || '', aneisSaida: k7s[3]?.outputRing || '', mmEntrada: k7s[3] ? `${k7s[3].dEntry.toFixed(2)}mm` : '', mmSaida: k7s[3] ? `${k7s[3].dOutput.toFixed(2)}mm` : '' },
            };
        }
        if (!printSetup) {
            const dInNum = parseFloat(String(inBitolaVal).replace('mm', '').replace(',', '.').trim()) || 8.00;
            const dOutNum = parseFloat(String(outBitolaStr).replace('mm', '').replace(',', '.').trim()) || 4.20;
            const autoCalc = calculateK7Setup(suggestDefaultK7Count(dInNum, dOutNum), dInNum, dOutNum);
            printSetup = {
                pass1: { aneisEntrada: autoCalc[0]?.entryRing || '', aneisSaida: autoCalc[0]?.outputRing || '', mmEntrada: autoCalc[0] ? `${autoCalc[0].dEntry.toFixed(2)}mm` : '', mmSaida: autoCalc[0] ? `${autoCalc[0].dOutput.toFixed(2)}mm` : '' },
                pass2: { aneisEntrada: autoCalc[1]?.entryRing || '', aneisSaida: autoCalc[1]?.outputRing || '', mmEntrada: autoCalc[1] ? `${autoCalc[1].dEntry.toFixed(2)}mm` : '', mmSaida: autoCalc[1] ? `${autoCalc[1].dOutput.toFixed(2)}mm` : '' },
                pass3: { aneisEntrada: autoCalc[2]?.entryRing || '', aneisSaida: autoCalc[2]?.outputRing || '', mmEntrada: autoCalc[2] ? `${autoCalc[2].dEntry.toFixed(2)}mm` : '', mmSaida: autoCalc[2] ? `${autoCalc[2].dOutput.toFixed(2)}mm` : '' },
                pass4: { aneisEntrada: autoCalc[3]?.entryRing || '', aneisSaida: autoCalc[3]?.outputRing || '', mmEntrada: autoCalc[3] ? `${autoCalc[3].dEntry.toFixed(2)}mm` : '', mmSaida: autoCalc[3] ? `${autoCalc[3].dOutput.toFixed(2)}mm` : '' },
            };
        }

        const reportPayload = {
            opNumber: op.orderNumber,
            machine: op.scheduledMachine || op.machine,
            selectedDate: op.plannedStartDate || new Date().toISOString().split('T')[0],
            bitolaEntrada: inBitolaStr,
            bitolaSaida: outBitolaStr,
            responsavelHeader: op.operator || currentUser?.name || currentUser?.username || '',
            bitolaAferida: '',
            liberacao: '',
            setup: printSetup,
            rows,
            porcentagemPerca: '',
            responsavelFooter: '',
            responsavelLab: ''
        };

        localStorage.setItem('trefila_op_report_draft', JSON.stringify(reportPayload));
        localStorage.setItem('trefila_op_selected_number', op.orderNumber);
        localStorage.setItem(`trefila_op_report_${op.orderNumber}`, JSON.stringify(reportPayload));
        localStorage.setItem('reports_active_tab', 'op_trefila');
        setPage('reports');
    };

    // Navegação rápida para o Chão de Fábrica da máquina
    const handleGoToProduction = (op: ProductionOrderData) => {
        const machine = op.scheduledMachine || (op.machine as string);
        localStorage.setItem('msm_active_machine', machine);

        const isLive = op.status === 'in_progress';
        if (machine.startsWith('Trefila')) {
            setPage(isLive ? 'trefilaInProgress' : 'trefilaPending');
        } else if (machine.startsWith('Treliça')) {
            setPage(isLive ? 'trelicaInProgress' : 'trelicaPending');
        } else if (machine.startsWith('Malha')) {
            setPage(isLive ? 'malhaInProgress' : 'malhaPending');
        } else if (machine.startsWith('Desbobinadeira')) {
            setPage(isLive ? 'desbobinadeiraInProgress' : 'desbobinadeiraPending');
        }
    };

    // Salvar Nova OP Direta (Validando e enviando exatamente os dados necessários)
    const handleSaveNewOrder = async (action: 'confirm' | 'print' | 'sendToMachine' | boolean = 'confirm') => {
        if (isSavingOrder) return;
        setCreateOrderError(null);

        const mode: 'confirm' | 'print' | 'sendToMachine' = typeof action === 'boolean' ? (action ? 'print' : 'confirm') : action;

        if (!createOrderNumber.trim()) {
            const msg = 'Informe o número da Ordem de Produção.';
            setCreateOrderError(msg);
            showNotification?.(msg, 'error');
            return;
        }

        if (productionOrders.some(o => o.orderNumber.trim().toLowerCase() === createOrderNumber.trim().toLowerCase())) {
            const msg = `O número de ordem "${createOrderNumber}" já existe.`;
            setCreateOrderError(msg);
            showNotification?.(msg, 'error');
            return;
        }

        const endDateStr = calculateEndDateByWorkDays(createStartDate, createDuration);

        let orderData: any = {
            orderNumber: createOrderNumber.trim(),
            machine: createMachine as MachineType,
            scheduledMachine: createMachine,
            plannedStartDate: createStartDate,
            plannedEndDate: endDateStr,
            estimatedDurationDays: createDuration,
            operatorLogs: [{ operator: currentUser?.username || 'Gestor PCP', action: 'Criada no PCP', startTime: new Date().toISOString() }],
            startTime: new Date().toISOString()
        };

        // --- VALIDAÇÕES E DADOS ESPECÍFICOS DE TREFILA ---
        if (createCategory === 'Trefila') {
            if (selectedLotIds.length === 0) {
                const msg = 'Selecione pelo menos um lote de Fio Máquina para a produção (obrigatório inclusive em ordens fantasma).';
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }

            const calculatedWeight = totalSelectedWeight;

            const cleanTarget = String(targetBitola || '').replace('mm', '').trim();
            const matchedGauge = gauges.find((g: any) => {
                const mat = (g.materialType || '').toLowerCase();
                const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                if (!isCa60) return false;
                const gClean = String(g.gauge || '').replace('mm', '').trim();
                return g.gauge === targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
            });
            orderData.targetBitola = targetBitola;
            if (matchedGauge) {
                orderData.productCode = matchedGauge.productCode || (matchedGauge as any).code || '';
                orderData.productDescription = matchedGauge.description || (matchedGauge as any).gaugeDescription || '';
            }
            orderData.selectedLotIds = selectedLotIds;
            orderData.totalWeight = calculatedWeight;
            orderData.quantityToProduce = calculatedWeight;
            orderData.isGhostOrder = isGhostOrder;
            orderData.inputBitola = inputBitolaFilter || (availableTrefilaLots.find(l => l.id === selectedLotIds[0])?.bitola) || null;
            orderData.targetSpeed = trefilaProductionCalculations.speed;
            orderData.rollChangeTimeMinutes = rollChangeTimeMin;
            orderData.setupTimeMinutes = setupTimeMin;
            orderData.estimatedProductionHours = parseFloat(trefilaProductionCalculations.totalHours.toFixed(2));
            orderData.dailyWorkHours = parseFloat(dailyShiftDetails.totalWorkHours.toFixed(2));
            orderData.shiftConfig = shiftConfig;
            orderData.k7Count = k7Count;
            orderData.k7Setup = k7Passes;
            
            const setupPayloadObj = {
                pass1: { aneisEntrada: k7Passes[0]?.entryRing || '', aneisSaida: k7Passes[0]?.outputRing || '', mmEntrada: k7Passes[0] ? `${k7Passes[0].dEntry.toFixed(2)}mm` : '', mmSaida: k7Passes[0] ? `${k7Passes[0].dOutput.toFixed(2)}mm` : '' },
                pass2: { aneisEntrada: k7Passes[1]?.entryRing || '', aneisSaida: k7Passes[1]?.outputRing || '', mmEntrada: k7Passes[1] ? `${k7Passes[1].dEntry.toFixed(2)}mm` : '', mmSaida: k7Passes[1] ? `${k7Passes[1].dOutput.toFixed(2)}mm` : '' },
                pass3: { aneisEntrada: k7Passes[2]?.entryRing || '', aneisSaida: k7Passes[2]?.outputRing || '', mmEntrada: k7Passes[2] ? `${k7Passes[2].dEntry.toFixed(2)}mm` : '', mmSaida: k7Passes[2] ? `${k7Passes[2].dOutput.toFixed(2)}mm` : '' },
                pass4: { aneisEntrada: k7Passes[3]?.entryRing || '', aneisSaida: k7Passes[3]?.outputRing || '', mmEntrada: k7Passes[3] ? `${k7Passes[3].dEntry.toFixed(2)}mm` : '', mmSaida: k7Passes[3] ? `${k7Passes[3].dOutput.toFixed(2)}mm` : '' },
            };
            orderData.setup = setupPayloadObj;
            
            orderData.operatorLogs = [{ 
                operator: currentUser?.username || 'Gestor PCP', 
                action: isGhostOrder ? 'Criada no PCP (Fantasma)' : 'Criada no PCP', 
                startTime: new Date().toISOString(),
                details: {
                    speed: trefilaProductionCalculations.speed,
                    rollChangeTime: rollChangeTimeMin,
                    setupTime: setupTimeMin,
                    estimatedHours: trefilaProductionCalculations.totalHours,
                    numRolls: selectedLotIds.length,
                    dailyWorkHours: dailyShiftDetails.totalWorkHours,
                    shiftConfig: shiftConfig,
                    k7Count: k7Count,
                    k7Passes: k7Passes
                }
            }];

            // Preenchimento automático prévio da Ficha de Produção A4
            const selectedLotsData = selectedLotIds.map(id => stock.find(s => s.id === id || s.internalLot === id)).filter(Boolean) as StockItem[];
            const dateParts = createStartDate ? createStartDate.split('-') : [];
            const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : '';

            const reportRows = selectedLotsData.map(item => ({
                id: Math.random().toString(36).substring(2, 9),
                data: dateFormatted,
                lote: item.internalLot || item.supplierLot || '',
                fornecedor: item.supplier || '',
                certificado: item.conferenceNumber || '',
                corrida: item.runNumber || '',
                notaFiscal: item.nfe || '',
                pesoEtiqueta: item.labelWeight || item.weight || '',
                pesoBalanca: '',
                massaLinear: '',
                bitolaMm: '',
                rt: '',
                le: '',
                caractGeo: '',
                dobramento: '',
                verifMarcacao: '',
                alongamento: '',
                aprovacao: ''
            }));

            while (reportRows.length < 8) {
                reportRows.push({
                    id: Math.random().toString(36).substring(2, 9),
                    data: '', lote: '', fornecedor: '', certificado: '', corrida: '',
                    notaFiscal: '', pesoEtiqueta: '', pesoBalanca: '', massaLinear: '',
                    bitolaMm: '', rt: '', le: '', caractGeo: '', dobramento: '',
                    verifMarcacao: '', alongamento: '', aprovacao: ''
                });
            }

            const inBitolaVal = inputBitolaFilter || (availableTrefilaLots.find(l => l.id === selectedLotIds[0])?.bitola) || '';
            const inBitolaStr = inBitolaVal ? (inBitolaVal.includes('mm') ? inBitolaVal : `${inBitolaVal}mm`) : '';
            const outBitolaStr = targetBitola ? (targetBitola.includes('mm') ? targetBitola : `${targetBitola}mm`) : '';

            const reportPayload = {
                opNumber: createOrderNumber.trim(),
                machine: createMachine,
                selectedDate: createStartDate,
                bitolaEntrada: inBitolaStr,
                bitolaSaida: outBitolaStr,
                responsavelHeader: currentUser?.name || currentUser?.username || '',
                bitolaAferida: '',
                liberacao: '',
                setup: setupPayloadObj,
                rows: reportRows,
                porcentagemPerca: '',
                responsavelFooter: '',
                responsavelLab: ''
            };

            localStorage.setItem('trefila_op_report_draft', JSON.stringify(reportPayload));
            localStorage.setItem('trefila_op_selected_number', createOrderNumber.trim());
            localStorage.setItem(`trefila_op_report_${createOrderNumber.trim()}`, JSON.stringify(reportPayload));
        } 
        
        // --- VALIDAÇÕES E DADOS ESPECÍFICOS DE TRELIÇA ---
        else if (createCategory === 'Treliça') {
            if (!selectedTrelicaModel) {
                const msg = 'Selecione o modelo da treliça.';
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }
            if (trelicaQuantity <= 0) {
                const msg = 'A quantidade de peças deve ser maior que zero.';
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }

            // Validação OBRIGATÓRIA de lotes de CA-60 (mesmo para Ordens Fantasma para garantir a precisão da produção)
            const missingParts: string[] = [];
            if (trelicaSuperiorLots.length === 0) missingParts.push('Banzo Superior');
            if (trelicaInferiorLeftLots.length === 0) missingParts.push('Inferior (Lado 1)');
            if (trelicaInferiorRightLots.length === 0) missingParts.push('Inferior (Lado 2)');
            if (trelicaSenozoideLeftLots.length === 0) missingParts.push('Senozoide (Lado 1)');
            if (trelicaSenozoideRightLots.length === 0) missingParts.push('Senozoide (Lado 2)');

            if (missingParts.length > 0) {
                const msg = `Seleção de lotes obrigatória: selecione rolos de CA-60 para ${missingParts.join(', ')} (obrigatório inclusive em Ordens Fantasma para garantir a precisão).`;
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }

            const trelicaLots = {
                superior: trelicaSuperiorLots[0] || null,
                inferior1: trelicaInferiorLeftLots[0] || null,
                inferior2: trelicaInferiorRightLots[0] || null,
                senozoide1: trelicaSenozoideLeftLots[0] || null,
                senozoide2: trelicaSenozoideRightLots[0] || null,
                allSuperior: trelicaSuperiorLots,
                allInferiorLeft: trelicaInferiorLeftLots,
                allInferiorRight: trelicaInferiorRightLots,
                allSenozoideLeft: trelicaSenozoideLeftLots,
                allSenozoideRight: trelicaSenozoideRightLots,
            };

            const unitPieceWeight = parseFloat(String(selectedTrelicaModel.pesoFinal || selectedTrelicaModel.peso_final || '0').replace(',', '.')) || 0;

            orderData.productCode = selectedTrelicaModel.cod;
            orderData.productDescription = selectedTrelicaModel.modelo;
            orderData.pieceWeight = unitPieceWeight;
            orderData.trelicaModel = selectedTrelicaModel.modelo;
            orderData.tamanho = selectedTrelicaModel.tamanho;
            orderData.quantityToProduce = trelicaQuantity;
            orderData.targetBitola = selectedTrelicaModel.superior as Bitola;
            orderData.totalWeight = unitPieceWeight * trelicaQuantity;
            orderData.isGhostOrder = isTrelicaGhostOrder;
            orderData.selectedLotIds = trelicaLots;
            orderData.trelicaSuperior = selectedTrelicaModel.superior;
            orderData.trelicaInferior = selectedTrelicaModel.inferior;
            orderData.trelicaSinusoide = selectedTrelicaModel.senozoide;

            // Novos parâmetros operacionais de máquina, tempos e metas
            orderData.targetSpeed = trelicaSpeed;
            orderData.setupTimeMinutes = trelicaSetupTimeMin;
            orderData.estimatedProductionHours = parseFloat(trelicaProductionCalculations.totalHours.toFixed(2));
            orderData.dailyWorkHours = parseFloat(dailyShiftDetails.totalWorkHours.toFixed(2));
            orderData.shiftConfig = shiftConfig;

            orderData.operatorLogs = [{
                operator: currentUser?.username || 'Gestor PCP',
                action: isTrelicaGhostOrder ? 'Criada no PCP (Fantasma)' : 'Criada no PCP',
                startTime: new Date().toISOString(),
                details: {
                    machineSpeed: trelicaSpeed,
                    setupTimeMin: trelicaSetupTimeMin,
                    dailyTargetPieces: trelicaProductionCalculations.dailyPieces,
                    totalPlannedMeters: trelicaProductionCalculations.totalMeters,
                    estimatedHours: trelicaProductionCalculations.totalHours,
                    dailyWorkHours: dailyShiftDetails.totalWorkHours,
                    shiftConfig: shiftConfig
                }
            }];
        } 
        
        // --- VALIDAÇÕES E DADOS ESPECÍFICOS DE MALHA ---
        else if (createCategory === 'Malha') {
            if (!malhaModel.trim()) {
                const msg = 'O modelo da malha é obrigatório.';
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }
            if (malhaPieces <= 0) {
                const msg = 'A quantidade de peças deve ser maior que zero.';
                setCreateOrderError(msg);
                showNotification?.(msg, 'error');
                return;
            }

            const selectedModelObj = availableMalhaModels.find(m => 
                m.description === malhaModel || 
                m.productCode === malhaModel || 
                m.id === malhaModel
            );
            const rawPeso = selectedModelObj?.peso_peca || selectedModelObj?.peso_final;
            const pieceWeight = rawPeso ? parseFloat(rawPeso.replace(',', '.')) : 5;

            orderData.malhaModel = selectedModelObj?.description || malhaModel;
            orderData.productCode = selectedModelObj?.productCode || '';
            orderData.productDescription = selectedModelObj?.description || malhaModel;
            orderData.quantityToProduce = malhaPieces;
            orderData.malhaPieces = malhaPieces;
            orderData.targetBitola = malhaBitola;
            orderData.totalWeight = malhaPieces * (pieceWeight > 0 ? pieceWeight : 5);
        }

        setIsSavingOrder(true);
        try {
            let createdOpId = createOrderNumber.trim();
            if (addProductionOrder) {
                const saved = await addProductionOrder(orderData);
                if (saved?.id) createdOpId = saved.id;
            }
            setIsCreateModalOpen(false);

            if (mode === 'sendToMachine') {
                showNotification?.(`OP #${createOrderNumber} despachada para a ${createMachine}! Abrindo terminal do operador...`, 'success');
                handleGoToProduction({ ...orderData, id: createdOpId });
            } else if (mode === 'print') {
                showNotification?.(`OP #${createOrderNumber} criada! Abrindo Ficha A4...`, 'success');
                handlePrintOP({ ...orderData, id: createdOpId });
            } else {
                showNotification?.(`OP #${createOrderNumber} criada e agendada na ${createMachine} com sucesso!`, 'success');
                setCreatedOPSuccessModal({
                    orderNumber: createOrderNumber.trim(),
                    machine: createMachine,
                    category: createCategory,
                    opData: { ...orderData, id: createdOpId }
                });
            }
        } catch (err: any) {
            console.error('Erro ao salvar OP:', err);
            const msg = err?.message || err?.details || String(err);
            setCreateOrderError('Erro ao criar OP: ' + msg);
            showNotification?.('Erro ao criar OP: ' + msg, 'error');
        } finally {
            setIsSavingOrder(false);
        }
    };


    // Abre o modal para reprogramar
    const openScheduleModal = (op: ProductionOrderData) => {
        setSelectedOP(op);
        setScheduleMachine(op.scheduledMachine || (op.machine as string));
        setScheduleStartDate(op.plannedStartDate || mondayStr);
        const hasStarted = hasProductionStarted(op);
        const elapsed = hasStarted ? countWorkingDaysBetween(op.plannedStartDate || mondayStr, todayStr) : 1;
        const currentEffectiveEnd = (hasStarted && op.plannedEndDate && op.plannedEndDate < todayStr) ? todayStr : (op.plannedEndDate || op.plannedStartDate || todayStr);
        const currentDays = countWorkingDaysBetween(op.plannedStartDate || mondayStr, currentEffectiveEnd);
        setScheduleDuration(Math.max(elapsed, currentDays, op.estimatedDurationDays || 1));
    };

    // Salva o reagendamento
    const handleSaveSchedule = async () => {
        if (!selectedOP) return;

        let endDateStr = calculateEndDateByWorkDays(scheduleStartDate, scheduleDuration);
        if (hasProductionStarted(selectedOP) && endDateStr < todayStr) {
            endDateStr = todayStr;
        }

        const updates: Partial<ProductionOrderData> = {
            scheduledMachine: scheduleMachine,
            plannedStartDate: scheduleStartDate,
            plannedEndDate: endDateStr,
            estimatedDurationDays: scheduleDuration
        };

        try {
            await updateProductionOrder(selectedOP.id, updates);
            showNotification?.(`OP #${selectedOP.orderNumber} reprogramada com sucesso!`, 'success');
            setSelectedOP(null);
            if (drawerOP?.id === selectedOP.id) {
                setDrawerOP(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            console.error('Erro ao agendar OP:', error);
            showNotification?.('Erro ao reagendar OP.', 'error');
        }
    };

    // Remove a OP do agendamento
    const handleRemoveSchedule = async (id: string) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: ação desabilitada.', 'warning');
            return;
        }
        if (!confirm('Deseja retirar esta ordem de produção do agendamento?')) return;
        
        const updates: Partial<ProductionOrderData> = {
            scheduledMachine: undefined,
            plannedStartDate: undefined,
            plannedEndDate: undefined,
            estimatedDurationDays: undefined
        };

        try {
            await updateProductionOrder(id, updates);
            showNotification?.('OP retirada da timeline.', 'success');
            if (drawerOP?.id === id) setDrawerOP(null);
        } catch (error) {
            console.error('Erro ao remover agendamento:', error);
        }
    };

    // Excluir OP completamente
    const handleDeleteOP = async (id: string, orderNum: string) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: exclusão bloqueada.', 'warning');
            return;
        }
        if (!confirm(`Tem certeza que deseja excluir permanentemente a OP #${orderNum}?`)) return;
        try {
            if (deleteProductionOrder) {
                await deleteProductionOrder(id);
                showNotification?.(`OP #${orderNum} excluída com sucesso.`, 'success');
                if (drawerOP?.id === id) setDrawerOP(null);
            }
        } catch (err: any) {
            console.error('Erro ao excluir OP:', err);
            showNotification?.('Erro ao excluir ordem.', 'error');
        }
    };

    // Determina se uma OP já foi iniciada na fábrica ou possui produção apontada no passado
    const hasProductionStarted = (op: ProductionOrderData): boolean => {
        const st = (op.status || '').toLowerCase();
        if (st === 'in_progress' || st.includes('produção') || st.includes('producao') || st === 'completed' || st.includes('conclu')) {
            return true;
        }
        if (Number(op.actualProducedQuantity || 0) > 0 || Number(op.actualProducedWeight || 0) > 0 || Number(op.totalProducedWeight || 0) > 0) {
            return true;
        }
        if (op.operatorLogs && op.operatorLogs.length > 0) {
            const hasRealLog = op.operatorLogs.some(l => 
                l.operator && l.operator !== 'GHOST_ORDER_FLAG' && (l.endQuantity || l.startQuantity || l.endTime)
            );
            if (hasRealLog) return true;
        }
        if (op.plannedStartDate && op.plannedStartDate < todayStr) {
            return true;
        }
        return false;
    };

    // Deslocar OP (+/- dias úteis) - APENAS permitido para OPs ainda não iniciadas!
    const handleShiftOP = async (op: ProductionOrderData, daysToShift: number) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: alteração no cronograma desabilitada.', 'warning');
            return;
        }
        if (!op.plannedStartDate) return;
        
        if (hasProductionStarted(op)) {
            showNotification?.('Esta OP já começou a produzir ou possui apontamentos passados. A data inicial não pode ser movida para preservar o histórico. Use o botão ESTENDER para estender o prazo de término.', 'warning');
            return;
        }

        const newStartStr = shiftWorkingDay(op.plannedStartDate, daysToShift);
        const duration = op.estimatedDurationDays || 1;
        const newEndStr = calculateEndDateByWorkDays(newStartStr, duration);
        
        const updates: Partial<ProductionOrderData> = {
            plannedStartDate: newStartStr,
            plannedEndDate: newEndStr
        };

        try {
            await updateProductionOrder(op.id, updates);
            showNotification?.(`OP #${op.orderNumber} movida para ${formatFriendlyDate(newStartStr)}.`, 'success');
        } catch (error) {
            console.error('Erro ao deslocar agendamento:', error);
        }
    };

    // Ajusta a duração da OP (+1 ou -1 dia útil) - ESTENDER / REDUZIR PRAZO
    const handleAdjustDuration = async (op: ProductionOrderData, durationDelta: number) => {
        if (isViewer) {
            showNotification?.('Perfil de visualização: alteração no cronograma desabilitada.', 'warning');
            return;
        }
        if (!op.plannedStartDate) return;
        
        const hasStarted = hasProductionStarted(op);

        // Data de término efetiva atual (se a OP já está em produção e o término agendado anteriormente venceu no passado, a base mínima é hoje)
        const currentEffectiveEnd = (hasStarted && op.plannedEndDate && op.plannedEndDate < todayStr)
            ? todayStr
            : (op.plannedEndDate || op.plannedStartDate || todayStr);

        let newEndStr: string;

        if (durationDelta > 0) {
            // Estende +X dia(s) útil(eis) além do término efetivo atual
            newEndStr = shiftWorkingDay(currentEffectiveEnd, durationDelta);
        } else {
            // Reduz prazo (-1 dia útil)
            if (hasStarted && currentEffectiveEnd <= todayStr) {
                showNotification?.(`A OP já possui produção iniciada até a data atual (${formatFriendlyDate(todayStr)}). Não é possível reduzir o prazo para antes de hoje.`, 'warning');
                return;
            }
            newEndStr = shiftWorkingDay(currentEffectiveEnd, -1);
            if (hasStarted && newEndStr < todayStr) {
                newEndStr = todayStr;
            }
        }

        const newDuration = Math.max(1, countWorkingDaysBetween(op.plannedStartDate, newEndStr));
        
        const updates: Partial<ProductionOrderData> = {
            estimatedDurationDays: newDuration,
            plannedEndDate: newEndStr
        };

        try {
            await updateProductionOrder(op.id, updates);
            if (drawerOP?.id === op.id) {
                setDrawerOP(prev => prev ? { ...prev, ...updates } : null);
            }
            if (durationDelta > 0) {
                showNotification?.(`OP #${op.orderNumber} estendida até ${formatFriendlyDate(newEndStr)} (+${durationDelta} dia útil).`, 'success');
            } else {
                showNotification?.(`Prazo da OP #${op.orderNumber} reduzido para ${formatFriendlyDate(newEndStr)}.`, 'info');
            }
        } catch (error) {
            console.error('Erro ao ajustar duração:', error);
            showNotification?.('Erro ao atualizar duração da OP.', 'error');
        }
    };


    // Cálculo do progresso e status de uma OP
    const getOPProgress = (op: ProductionOrderData) => {
        const isTrelica = op.machine === 'Treliça' || (op.scheduledMachine && op.scheduledMachine.startsWith('Treliça'));
        const isMalha = typeof op.machine === 'string' && op.machine.startsWith('Malha');

        let target = 1;
        let produced = 0;
        let unit = 'kg';

        if (isTrelica) {
            target = op.quantityToProduce || 1;
            produced = op.actualProducedQuantity || 0;
            unit = 'pçs';
        } else if (isMalha) {
            target = op.quantityToProduce || op.malhaPieces || 1;
            produced = op.actualProducedQuantity || 0;
            unit = 'pçs';
        } else {
            target = op.quantityToProduce || op.totalWeight || 1;
            produced = op.actualProducedWeight || op.totalProducedWeight || 0;
            unit = 'kg';
        }

        const pct = Math.min(100, Math.round((produced / target) * 100));

        const isCompleted = op.status === 'completed' || op.status === 'Finalizado' || op.status === 'Concluída';
        // Apenas 'in_progress' significa que o operador de fato clicou em 'Iniciar' na máquina
        const isLive = op.status === 'in_progress' || op.status === 'Em Produção';
        const isPending = !isCompleted && !isLive;

        // Verificar se há evento de parada aberto na OP ativa
        const openDowntime = isLive ? (op.downtimeEvents || []).find((e: any) => !e.resumeTime) : null;
        let isStopped = false;
        let isPrep = false;
        let isOffline = false;
        let downtimeReason = '';
        let downtimeDurationMs = 0;
        let statusLabel = '';
        let statusColor = '';

        const todayStr = formatDateString(liveNow);
        const dtDateStr = openDowntime?.stopTime ? getIsoDateStr(openDowntime.stopTime) : '';
        const isPastDayDowntime = Boolean(dtDateStr && dtDateStr < todayStr);

        if (openDowntime) {
            downtimeReason = openDowntime.reason || 'Parada';
            const stopMs = openDowntime.stopTime ? new Date(openDowntime.stopTime).getTime() : 0;
            downtimeDurationMs = stopMs > 0 ? Math.max(0, liveNow.getTime() - stopMs) : 0;

            const rNorm = downtimeReason.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            isOffline = rNorm.includes('final de turno') || rNorm.includes('turno') || isPastDayDowntime;
            
            if (isOffline) {
                statusLabel = isPastDayDowntime ? 'Desligada: Turno Encerrado' : `Desligada: ${downtimeReason}`;
                statusColor = 'bg-slate-500/20 text-slate-300 border-slate-500/40';
            } else if (rNorm.includes('aguardando inicio') || rNorm.includes('setup') || rNorm === 'preparacao' || rNorm.startsWith('preparacao') || rNorm.includes('troca de rolo / preparacao') || rNorm.includes('setup + preparacao')) {
                isPrep = true;
                statusLabel = rNorm === 'preparacao' ? 'Preparação' : `Preparação: ${downtimeReason}`;
                statusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            } else {
                isStopped = true;
                statusLabel = `Parada: ${downtimeReason}`;
                statusColor = 'bg-rose-500/25 text-rose-300 border-rose-500/50';
            }
        } else if (isLive) {
            const machName = op.scheduledMachine || (op.machine as string);
            const shiftEval = machName ? checkMachineShiftStatus(machName, shiftConfig, liveNow) : null;
            const openLogs = (op.operatorLogs || []).filter((l: any) => !l.endTime && l.operator && l.operator !== 'GHOST_ORDER_FLAG');
            const hasManagerAuth = openLogs.some((l: any) => Boolean(l.managerAuthorized));

            if (shiftEval && shiftEval.autoEndShift && !shiftEval.inShiftWindow && shiftEval.isOvertime && !shiftEval.isAutoEndCountdown && !hasManagerAuth) {
                isOffline = true;
                statusLabel = 'Desligada: Turno Encerrado';
                statusColor = 'bg-slate-500/20 text-slate-300 border-slate-500/40';
            } else {
                statusLabel = 'Em Produção (Ao Vivo)';
                statusColor = 'bg-cyan-500/20 text-[#00E5FF] border-[#00E5FF]/40';
            }
        } else if (isCompleted) {
            statusLabel = 'Concluída';
            statusColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        } else {
            statusLabel = 'Agendada (Aguardando Início)';
            statusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        }

        // Se a máquina não possui operador ativo com turno aberto hoje, seu estado oficial é Desligada
        if (isLive) {
            const machName = op.scheduledMachine || (op.machine as string);
            const activeOperator = machName ? getMachineOperator(machName) : null;
            if (!activeOperator) {
                isOffline = true;
                isStopped = false;
                isPrep = false;
                statusLabel = 'Desligada: Turno Encerrado';
                statusColor = 'bg-slate-500/20 text-slate-300 border-slate-500/40';
            }
        }

        return { 
            target, 
            produced, 
            unit, 
            pct, 
            isCompleted, 
            isLive, 
            isPending, 
            isActive: isLive, // retrocompatibilidade
            isStopped,
            isPrep,
            isOffline,
            downtimeReason,
            downtimeDurationMs,
            statusLabel, 
            statusColor 
        };
    };

    // Helper para formatar tempos em cartões:
    // Se liveWithSeconds === true: ex: 5h03:10, 1h56:45, 47:41 ou 00:00
    // Se false: ex: 8h48, 29m, 0m
    const formatShiftTimeDisplay = (ms: number, liveWithSeconds: boolean = false): string => {
        if (!ms || ms <= 0) return liveWithSeconds ? '00:00' : '0m';
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        if (liveWithSeconds) {
            if (h === 0) {
                return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
            return `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        if (h === 0) return `${m}m`;
        return `${h}h${m < 10 ? '0' : ''}${m}`;
    };

    // Helper para obter estatísticas de produção de uma OP em um dia específico da semana
    const getOpDayStats = (op: ProductionOrderData, date: Date, machName: string) => {
        const dateStr = formatDateString(date);
        const todayStr = formatDateString(liveNow);
        const isWeekend = liveNow.getDay() === 0 || liveNow.getDay() === 6;
        const mondayOfThisWeekStr = formatDateString(getMonday(liveNow));

        // Se hoje for fim de semana (Sábado/Domingo) e estivermos na visualização da semana corrente (Segunda-feira),
        // tratamos a Segunda como o dia de monitoramento ativo ao vivo
        const isToday = dateStr === todayStr || (isWeekend && dateStr === mondayOfThisWeekStr);
        const isPast = dateStr < todayStr && !isToday;
        const isFuture = dateStr > todayStr && !isToday;
        const isHoliday = holidaysMap.has(dateStr);
        const holidayName = holidaysMap.get(dateStr) || '';

        const saturdayDate = new Date(getMonday(liveNow));
        saturdayDate.setDate(saturdayDate.getDate() - 2);
        const saturdayStr = formatDateString(saturdayDate);

        const sundayDate = new Date(getMonday(liveNow));
        sundayDate.setDate(sundayDate.getDate() - 1);
        const sundayStr = formatDateString(sundayDate);

        const isEvaluatingActiveMonday = isWeekend && dateStr === mondayOfThisWeekStr;

        const isTrelica = typeof op.machine === 'string' && op.machine.startsWith('Treliça') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Treliça'));
        const isMalha = typeof op.machine === 'string' && op.machine.startsWith('Malha') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Malha'));
        const isTrefila = typeof op.machine === 'string' && op.machine.startsWith('Trefila') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Trefila'));
        const unit = isTrelica || isMalha ? 'pçs' : 'kg';

        // 0. Ficha de Produção Diária (não lê do localStorage para evitar divergência entre computadores)
        let dailyReportPieces: number | null = null;
        let dailyReportOp: string = '';

        // 1. Relatórios de Turno desta OP nesta data específica (ou hoje/fim de semana)
        const matchingReports = (shiftReports || []).filter(r => {
            const isThisOp = r.productionOrderId === op.id || r.orderNumber === op.orderNumber;
            if (!isThisOp) return false;
            const repDate = r.date || getIsoDateStr(r.shiftStartTime || r.shiftEndTime);
            return repDate === dateStr || (isEvaluatingActiveMonday && (repDate === saturdayStr || repDate === sundayStr || repDate === todayStr));
        });
        const reportsDayQty = matchingReports.reduce((acc, r) => acc + (isTrefila ? (Number(r.totalProducedWeight) || 0) : (Number(r.totalProducedQuantity) || 0)), 0);
        const reportOperators = [...new Set(matchingReports.map(r => r.operator).filter(Boolean))].map(formatShortName).join(', ');

        // Extração defensiva de coleções suportando camelCase e snake_case do Supabase
        const rawLots: any[] = op.processedLots || (op as any).processed_lots || [];
        const rawPackages: any[] = op.weighedPackages || (op as any).weighed_packages || [];
        const rawLogs: any[] = op.operatorLogs || (op as any).operator_logs || [];

        // 2. Lotes processados e PESADOS finalizados nesta data (Trefila)
        const dayLotsWeight = rawLots.reduce((acc: number, l: any) => {
            const w = l.finalWeight !== undefined && l.finalWeight !== null 
                ? Number(l.finalWeight) 
                : (l.final_weight !== undefined && l.final_weight !== null ? Number(l.final_weight) : null);
            if (w === null || isNaN(w)) return acc;
            const rawTime = l.endTime || l.end_time || l.startTime || l.start_time || l.weighedAt || l.timestamp;
            const lotDate = getIsoDateStr(rawTime);
            if (lotDate === dateStr || (isEvaluatingActiveMonday && (lotDate === saturdayStr || lotDate === sundayStr || lotDate === todayStr))) {
                return acc + w;
            }
            return acc;
        }, 0);

        // 3. Pacotes pesados nesta data (Treliça)
        const dayPackagesQty = rawPackages.reduce((acc: number, p: any) => {
            const rawTime = p.timestamp || p.createdAt || p.weighedAt;
            if (!rawTime) return acc;
            const pkgDate = getIsoDateStr(rawTime);
            if (pkgDate === dateStr || (isEvaluatingActiveMonday && (pkgDate === saturdayStr || pkgDate === sundayStr || pkgDate === todayStr))) {
                const q = Number(p.quantity) || 200;
                return acc + q;
            }
            return acc;
        }, 0);

        // 4. Logs de operador desta data
        const dayLogs = rawLogs.filter(l => {
            const s = getIsoDateStr(l.startTime || l.start_time);
            const e = getIsoDateStr(l.endTime || l.end_time);
            return s === dateStr || e === dateStr || (isEvaluatingActiveMonday && (s === saturdayStr || s === sundayStr || s === todayStr || e === saturdayStr || e === sundayStr || e === todayStr));
        });
        const logOperators = dayLogs.map(l => formatShortName(l.operator)).filter(Boolean)[0] || '';

        // Total acumulado real da OP
        const totalOverall = isTrefila 
            ? (Number(op.actualProducedWeight || (op as any).actual_produced_weight || op.totalProducedWeight || (op as any).total_produced_weight) || 0) 
            : (Number(op.actualProducedQuantity || (op as any).actual_produced_quantity || (op as any).current_quantity || (op as any).total_overall) || 0);

        // Produção isolada dos logs desta data específica
        const dayLogsPcs = dayLogs.reduce((acc: number, l: any) => {
            const sQty = l.startQuantity !== undefined ? Number(l.startQuantity) : (l.start_quantity !== undefined ? Number(l.start_quantity) : undefined);
            const eQty = l.endQuantity !== undefined ? Number(l.endQuantity) : (l.end_quantity !== undefined ? Number(l.end_quantity) : undefined);
            const hasEnd = Boolean(l.endTime || l.end_time);

            if (!hasEnd) {
                if (sQty !== undefined) {
                    return acc + Math.max(0, totalOverall - sQty);
                }
                return acc;
            } else if (eQty !== undefined && sQty !== undefined) {
                return acc + Math.max(0, eQty - sQty);
            }
            return acc;
        }, 0);

        // Produção isolada de HOJE / Dia Ativo
        let todayProduced = 0;
        if (isTrefila) {
            todayProduced = dayLotsWeight > 0 ? dayLotsWeight : reportsDayQty;
        } else {
            // SÓ computa liveShiftPcs se o log aberto tiver sido iniciado estritamente no dia avaliado (dateStr)!
            const openLog = rawLogs.find((l: any) => 
                !l.endTime && !l.end_time && 
                getIsoDateStr(l.startTime || l.start_time) === dateStr
            );
            const sQty = openLog ? (openLog.startQuantity !== undefined ? Number(openLog.startQuantity) : (openLog.start_quantity !== undefined ? Number(openLog.start_quantity) : undefined)) : undefined;
            let liveShiftPcs = 0;
            if (openLog && sQty !== undefined) {
                liveShiftPcs = Math.max(0, totalOverall - sQty);
            }
            todayProduced = Math.max(dayPackagesQty + reportsDayQty, dayLogsPcs, liveShiftPcs);
        }

        let produced = 0;
        let operatorName = '';
        let status: 'live' | 'closed' | 'planned' | 'idle' = 'idle';
        const liveOperator = isToday ? getMachineOperator(machName) : null;

        if (isToday) {
            const openLog = rawLogs.find((l: any) => {
                const hasEnd = Boolean(l.endTime || l.end_time);
                if (hasEnd) return false;
                const opName = (l.operator || '').toLowerCase();
                return opName && opName !== 'ghost_order_flag' && opName !== 'gestor' && opName !== 'gestor pcp';
            });

            // Máquina só é 'live' se houver operador ativo ou turno iniciado na máquina hoje!
            const isLive = Boolean(liveOperator) && (op.status === 'in_progress' || op.status === 'Em Produção' || op.status === 'running');

            if (isLive) {
                status = 'live';
                operatorName = liveOperator?.displayName || (liveOperator?.name ? formatShortName(liveOperator.name) : '') || (openLog?.operator ? formatShortName(openLog.operator) : '') || 'Operando';
                produced = dailyReportPieces !== null && dailyReportPieces > todayProduced ? dailyReportPieces : todayProduced;
            } else if (dailyReportPieces !== null && dailyReportPieces >= 0) {
                status = 'closed';
                produced = dailyReportPieces;
                operatorName = dailyReportOp || reportOperators || logOperators || 'Turno Encerrado';
            } else if (reportsDayQty > 0 || dayLotsWeight > 0 || dayPackagesQty > 0 || todayProduced > 0) {
                status = 'closed';
                produced = todayProduced;
                operatorName = reportOperators || logOperators || 'Turno Encerrado';
            } else {
                status = 'idle';
                produced = 0;
                if (isHoliday) {
                    operatorName = holidayName;
                } else {
                    operatorName = 'Turno Encerrado';
                }
            }
        } else if (isPast) {
            if (dailyReportPieces !== null && dailyReportPieces >= 0) {
                status = 'closed';
                produced = dailyReportPieces;
                operatorName = dailyReportOp || reportOperators || logOperators || 'Encerrado';
            } else if (reportsDayQty > 0) {
                status = 'closed';
                produced = reportsDayQty;
                operatorName = reportOperators || logOperators || 'Encerrado';
            } else if (isTrefila) {
                // Na Trefila: a produção real é EXCLUSIVAMENTE a soma dos lotes pesados no dia ou relatórios de turno.
                // JAMAIS usar dayLogsPcs na Trefila para não herdar o peso total histórico acumulado da ordem.
                const trefilaVal = Math.max(dayLotsWeight, reportsDayQty);
                if (trefilaVal > 0) {
                    status = 'closed';
                    produced = trefilaVal;
                    operatorName = reportOperators || logOperators || 'Encerrado';
                } else {
                    status = 'closed';
                    produced = 0;
                    operatorName = logOperators || 'Sem Produção';
                }
            } else {
                const pastVal = Math.max(dayPackagesQty, dayLogsPcs);
                if (pastVal > 0) {
                    status = 'closed';
                    produced = pastVal;
                    operatorName = reportOperators || logOperators || 'Encerrado';
                } else {
                    status = 'closed';
                    produced = 0;
                    operatorName = logOperators || 'Sem Produção';
                }
            }
            if (produced === 0 && isHoliday) {
                operatorName = holidayName;
            }
        } else {
            // isFuture
            if (reportsDayQty > 0 || dayLotsWeight > 0 || dayPackagesQty > 0 || dayLogsPcs > 0) {
                status = 'closed';
                produced = isTrefila ? (dayLotsWeight > 0 ? dayLotsWeight : reportsDayQty) : (reportsDayQty > 0 ? reportsDayQty : (dayPackagesQty > 0 ? dayPackagesQty : dayLogsPcs));
                operatorName = reportOperators || logOperators || 'Encerrado';
            } else if (isHoliday) {
                status = 'idle';
                produced = 0;
                operatorName = holidayName;
            } else {
                status = 'planned';
                const totalTarget = op.quantityToProduce || op.totalWeight || (isTrefila ? 18000 : 3500);
                const durationDays = Math.max(1, op.estimatedDurationDays || 1);
                produced = Math.round(totalTarget / durationDays);
            }
        }

        // -------------------------------------------------------------
        // CÁLCULO DE TEMPO: EFETIVO vs PARADO (CRONÔMETRO TEMPO REAL)
        // -------------------------------------------------------------
        const machCfg = resolveMachineShiftConfig(machName, shiftConfig);
        const isTrelicaMach = machName.startsWith('Treliça');
        const defaultWorkStart = isTrelicaMach ? '05:00' : '07:45';
        const defaultWorkEnd = isTrelicaMach ? '14:48' : '17:33';

        const [startH, startM] = (machCfg.workStart || defaultWorkStart).split(':').map(Number);
        const [endH, endM] = (machCfg.workEnd || defaultWorkEnd).split(':').map(Number);

        const sStartMin = (startH !== undefined && !isNaN(startH) ? startH : (isTrelicaMach ? 5 : 7)) * 60 + (startM !== undefined && !isNaN(startM) ? startM : (isTrelicaMach ? 0 : 45));
        const sEndMin = (endH !== undefined && !isNaN(endH) ? endH : (isTrelicaMach ? 14 : 17)) * 60 + (endM !== undefined && !isNaN(endM) ? endM : (isTrelicaMach ? 48 : 33));
        const shiftPlannedDurationMs = Math.max(0, (sEndMin - sStartMin) * 60000);

        // 1. Detectar se a máquina está em Parada ou Produzindo AGORA (ao vivo hoje)
        const events = (op.downtimeEvents || []) as any[];
        const activeOpenStop = (isToday && Boolean(liveOperator)) ? [...events].reverse().find((e: any) => {
            if (e.resumeTime) return false;
            if (!e.stopTime) return false;
            const stopDateStr = getIsoDateStr(e.stopTime);
            if (stopDateStr !== dateStr) return false; // SÓ considera parada se foi gerada HOJE!
            const rNorm = (e.reason || '').toLowerCase().trim();
            if ((rNorm.includes('final de turno') || rNorm.includes('fim de turno')) && (!e.durationMin || e.durationMin === 0)) {
                return false;
            }
            return true;
        }) : null;

        const liveMachStatus = machineLiveStatus.find(m => m.machine === machName);
        const isMachineStoppedNow = isToday && Boolean(liveOperator) && (
            Boolean(activeOpenStop) || 
            (liveMachStatus && (liveMachStatus.state === 'stopped' || liveMachStatus.state === 'prep'))
        );

        // 2. Total de Paradas Finalizadas (fechadas)
        let closedDowntimeMs = 0;
        const recordedStops = new Set<string>();

        events.forEach((e: any) => {
            if (!e || !e.stopTime) return;
            if (isToday && e === activeOpenStop) return; // Parada aberta tratada dinamicamente
            const sDate = new Date(e.stopTime);
            if (isNaN(sDate.getTime())) return;
            const sDateOnly = getIsoDateStr(e.stopTime);
            if (sDateOnly !== dateStr) return;

            const reasonNorm = (e.reason || '').toLowerCase().trim();
            if ((reasonNorm.includes('final de turno') || reasonNorm.includes('fim de turno')) && (!e.durationMin || e.durationMin === 0) && !e.resumeTime) {
                return;
            }

            let durMs = 0;
            if (e.durationMin !== undefined && !isNaN(Number(e.durationMin)) && Number(e.durationMin) > 0) {
                durMs = Math.min(Number(e.durationMin) * 60000, 4 * 3600 * 1000);
            } else if (e.resumeTime) {
                const rDate = new Date(e.resumeTime);
                if (!isNaN(rDate.getTime())) {
                    // Limita a parada ao fim do expediente daquele dia para evitar contaminação noturna
                    const stopDayEnd = new Date(sDate);
                    stopDayEnd.setHours(endH !== undefined && !isNaN(endH) ? endH : 17, endM !== undefined && !isNaN(endM) ? endM : 33, 0, 0);
                    const limitEnd = Math.min(rDate.getTime(), stopDayEnd.getTime());
                    durMs = Math.max(0, limitEnd - sDate.getTime());
                    durMs = Math.min(durMs, 4 * 3600 * 1000);
                }
            }

            closedDowntimeMs += durMs;
            recordedStops.add(String(e.stopTime));
        });

        matchingReports.forEach((r: any) => {
            (r.downtimeEvents || []).forEach((e: any) => {
                if (!e || !e.stopTime) return;
                const sDateOnly = getIsoDateStr(e.stopTime) || r.date;
                if (sDateOnly !== dateStr) return;
                if (recordedStops.has(String(e.stopTime))) return;

                let durMs = 0;
                if (e.durationMin !== undefined && !isNaN(Number(e.durationMin)) && Number(e.durationMin) > 0) {
                    durMs = Math.min(Number(e.durationMin) * 60000, 4 * 3600 * 1000);
                } else if (e.resumeTime) {
                    const rDate = new Date(e.resumeTime);
                    if (!isNaN(rDate.getTime())) {
                        const sDate = new Date(e.stopTime);
                        const stopDayEnd = new Date(sDate);
                        stopDayEnd.setHours(endH !== undefined && !isNaN(endH) ? endH : 17, endM !== undefined && !isNaN(endM) ? endM : 33, 0, 0);
                        const limitEnd = Math.min(rDate.getTime(), stopDayEnd.getTime());
                        durMs = Math.max(0, limitEnd - sDate.getTime());
                        durMs = Math.min(durMs, 4 * 3600 * 1000);
                    }
                }
                closedDowntimeMs += durMs;
                recordedStops.add(String(e.stopTime));
            });

            (r.stops || []).forEach((s: any) => {
                if (s.duration && !isNaN(Number(s.duration))) {
                    const stopKey = `report-stop-${r.id}-${s.reason}-${s.duration}`;
                    if (!recordedStops.has(stopKey)) {
                        closedDowntimeMs += Math.min(Number(s.duration) * 60000, 4 * 3600 * 1000);
                        recordedStops.add(stopKey);
                    }
                }
            });
        });

        // 3. Cálculos Dinâmicos para HOJE vs PASSADO
        let dayElapsedShiftMs = 0;
        let dayDowntimeMs = 0;
        let isProducingNow = false;

        const todayMidnightMs = new Date(liveNow.getFullYear(), liveNow.getMonth(), liveNow.getDate(), 0, 0, 0, 0).getTime();
        const todayShiftStart = new Date(liveNow);
        todayShiftStart.setHours(startH !== undefined && !isNaN(startH) ? startH : (isTrelicaMach ? 5 : 7), startM !== undefined && !isNaN(startM) ? startM : (isTrelicaMach ? 0 : 45), 0, 0);

        const todayShiftEnd = new Date(liveNow);
        todayShiftEnd.setHours(endH !== undefined && !isNaN(endH) ? endH : (isTrelicaMach ? 14 : 17), endM !== undefined && !isNaN(endM) ? endM : (isTrelicaMach ? 48 : 33), 0, 0);

        if (isToday) {
            const todayLogs = (op.operatorLogs || []).filter((l: any) => {
                if (!l.startTime) return false;
                const sDate = getIsoDateStr(l.startTime);
                const eDate = l.endTime ? getIsoDateStr(l.endTime) : '';
                return sDate === dateStr || eDate === dateStr || (!l.endTime && isToday);
            });

            const realOpLogs = todayLogs.filter((l: any) => 
                l.operator && 
                l.operator !== 'GHOST_ORDER_FLAG' && 
                l.action !== 'Criada no PCP' &&
                !l.operator.toLowerCase().includes('gestor')
            );
            const activeLogs = realOpLogs.length > 0 ? realOpLogs : todayLogs;

            const isOpCurrentlyLive = op.status === 'in_progress' || op.status === 'Em Produção';
            const hasOpenLog = activeLogs.some((l: any) => !l.endTime);
            const hasManagerAuth = activeLogs.some((l: any) => Boolean(l.managerAuthorized));
            const hasActiveWorkToday = isOpCurrentlyLive || hasOpenLog || activeLogs.length > 0 || todayProduced > 0;

            if (hasActiveWorkToday) {
                // Início real da jornada hoje:
                // Coleta todos os carimbos de data/hora registrados hoje nesta OP ou máquina
                const candidateStarts: number[] = [];
                const todayShiftStartMs = todayShiftStart.getTime();

                activeLogs.forEach((l: any) => {
                    if (l.startTime) {
                        const t = new Date(l.startTime).getTime();
                        if (!isNaN(t) && t >= todayMidnightMs && t <= liveNow.getTime()) {
                            candidateStarts.push(t);
                        }
                    }
                });

                (op.processedLots || []).forEach((l: any) => {
                    const raw = l.startTime || l.endTime || l.weighedAt || l.timestamp;
                    if (raw) {
                        const t = new Date(raw).getTime();
                        if (!isNaN(t) && t >= todayMidnightMs && t <= liveNow.getTime()) {
                            candidateStarts.push(t);
                        }
                    }
                });

                (op.weighedPackages || []).forEach((p: any) => {
                    const raw = p.timestamp || p.weighedAt || p.createdAt;
                    if (raw) {
                        const t = new Date(raw).getTime();
                        if (!isNaN(t) && t >= todayMidnightMs && t <= liveNow.getTime()) {
                            candidateStarts.push(t);
                        }
                    }
                });

                events.forEach((e: any) => {
                    if (e.stopTime) {
                        const t = new Date(e.stopTime).getTime();
                        if (!isNaN(t) && t >= todayMidnightMs && t <= liveNow.getTime()) {
                            candidateStarts.push(t);
                        }
                    }
                });

                let shiftStartMs = todayShiftStartMs;
                if (candidateStarts.length > 0) {
                    shiftStartMs = Math.min(todayShiftStartMs, ...candidateStarts);
                } else if (liveNow.getTime() < todayShiftStartMs) {
                    shiftStartMs = liveNow.getTime();
                }

                shiftStartMs = Math.min(shiftStartMs, liveNow.getTime());
                shiftStartMs = Math.max(shiftStartMs, todayMidnightMs);

                // Momento atual ou encerramento da jornada hoje
                let shiftCurrentMs = liveNow.getTime();
                if (!hasOpenLog && !isOpCurrentlyLive && activeLogs.length > 0) {
                    // Turno já encerrado hoje
                    const logEndTimes = activeLogs
                        .map((l: any) => l.endTime ? new Date(l.endTime).getTime() : 0)
                        .filter((t: number) => t > 0);
                    shiftCurrentMs = logEndTimes.length > 0 ? Math.max(...logEndTimes) : Math.min(liveNow.getTime(), todayShiftEnd.getTime());
                    isProducingNow = false;
                } else {
                    // Turno em andamento
                    const capLimit = hasManagerAuth ? liveNow.getTime() : Math.min(liveNow.getTime(), todayShiftEnd.getTime());
                    shiftCurrentMs = capLimit;
                    isProducingNow = !isMachineStoppedNow;
                }

                dayElapsedShiftMs = Math.max(0, shiftCurrentMs - shiftStartMs);

                // Cálculo preciso de paradas ocorridas dentro do turno de hoje
                let currentDowntimeMs = 0;
                const recordedKeys = new Set<string>();

                events.forEach((e: any) => {
                    if (!e || !e.stopTime) return;
                    if (e === activeOpenStop) return; // Parada aberta tratada a seguir
                    const stopMs = new Date(e.stopTime).getTime();
                    if (isNaN(stopMs) || stopMs < todayMidnightMs) return;

                    const reasonNorm = (e.reason || '').toLowerCase().trim();
                    if ((reasonNorm.includes('final de turno') || reasonNorm.includes('fim de turno')) && (!e.durationMin || e.durationMin === 0) && !e.resumeTime) {
                        return;
                    }

                    const key = `stop-${e.stopTime}-${e.reason}`;
                    if (recordedKeys.has(key)) return;

                    let dur = 0;
                    if (e.durationMin !== undefined && !isNaN(Number(e.durationMin)) && Number(e.durationMin) > 0) {
                        dur = Number(e.durationMin) * 60000;
                    } else if (e.resumeTime) {
                        const resumeMs = new Date(e.resumeTime).getTime();
                        if (!isNaN(resumeMs) && resumeMs > stopMs) {
                            dur = resumeMs - stopMs;
                        }
                    }
                    if (dur > 0) {
                        currentDowntimeMs += dur;
                        recordedKeys.add(key);
                    }
                });

                matchingReports.forEach((r: any) => {
                    (r.downtimeEvents || []).forEach((e: any) => {
                        if (!e || !e.stopTime) return;
                        const key = `rep-${r.id}-${e.stopTime}-${e.reason}`;
                        if (recordedKeys.has(key)) return;
                        const stopMs = new Date(e.stopTime).getTime();
                        const resumeMs = e.resumeTime ? new Date(e.resumeTime).getTime() : (isNaN(stopMs) ? 0 : stopMs + (Number(e.durationMin || 0) * 60000));
                        if (isNaN(stopMs) || isNaN(resumeMs) || resumeMs <= stopMs) return;

                        const dur = resumeMs - stopMs;
                        if (dur > 0) {
                            currentDowntimeMs += dur;
                            recordedKeys.add(key);
                        }
                    });
                });

                // Se a máquina estiver em parada aberta AGORA (ao vivo)
                if (isMachineStoppedNow) {
                    if (activeOpenStop && activeOpenStop.stopTime) {
                        const openStopMs = new Date(activeOpenStop.stopTime).getTime();
                        if (!isNaN(openStopMs)) {
                            const boundedOpenStopMs = Math.min(openStopMs, liveNow.getTime());
                            const openDur = Math.max(0, liveNow.getTime() - boundedOpenStopMs);
                            currentDowntimeMs += openDur;
                        }
                    } else if (liveMachStatus?.durationMs) {
                        currentDowntimeMs += liveMachStatus.durationMs;
                    }
                }

                dayDowntimeMs = currentDowntimeMs;
                if (dayDowntimeMs > dayElapsedShiftMs) {
                    dayElapsedShiftMs = dayDowntimeMs;
                }
            }
        } else if (isPast) {
            const hasPastActivity = reportsDayQty > 0 || dayPackagesQty > 0 || dayLotsWeight > 0 || dayLogsPcs > 0 || closedDowntimeMs > 0;
            if (hasPastActivity) {
                const repWithTimes = matchingReports.find(r => r.shiftStartTime && r.shiftEndTime);
                if (repWithTimes) {
                    const s = new Date(repWithTimes.shiftStartTime).getTime();
                    const e = new Date(repWithTimes.shiftEndTime).getTime();
                    if (!isNaN(s) && !isNaN(e) && e > s) {
                        dayElapsedShiftMs = Math.min(e - s, shiftPlannedDurationMs);
                    }
                }

                if (dayElapsedShiftMs === 0) {
                    dayElapsedShiftMs = shiftPlannedDurationMs;
                }

                dayDowntimeMs = Math.min(closedDowntimeMs, dayElapsedShiftMs);
            }
        }

        let effectiveMs = 0;
        if (todayProduced > 0 || isProducingNow) {
            effectiveMs = Math.max(0, dayElapsedShiftMs - dayDowntimeMs);
        }

        // Se está ao vivo hoje (rodando ou parado), exibe cronômetro com segundos para dar sensação imediata de "time"
        const showSecondsLive = isToday && (isProducingNow || isMachineStoppedNow);
        const effectiveFormatted = formatShiftTimeDisplay(effectiveMs, showSecondsLive);
        const downtimeFormatted = formatShiftTimeDisplay(dayDowntimeMs, showSecondsLive);

        // Cálculo de Produtividade Real / Ritmo por Hora do Turno (considerando Tempo Efetivo + Tempo Parado)
        // Quantidade Produzida / Tempo Total Decorrido do Turno (em horas)
        const effectiveHours = effectiveMs > 0 ? (effectiveMs / 3600000) : 0;
        const totalShiftTimeMs = effectiveMs + dayDowntimeMs;
        const totalShiftHours = totalShiftTimeMs > 0 ? (totalShiftTimeMs / 3600000) : 0;
        
        // Se a máquina tiver menos de 10 minutos de turno (0.16h) ou 0 produzido, não projeta número irreal (deixa 0)
        const ratePerHour = (totalShiftHours >= 0.16 && produced > 0) ? Math.round(produced / totalShiftHours) : 0;
        const rateUnit = isTrefila ? 'kg/h' : 'pçs/h';
        const rateFormatted = ratePerHour > 0 ? `${ratePerHour.toLocaleString('pt-BR')} ${rateUnit}` : `0 ${rateUnit}`;

        // Cálculo de Velocidade / Tempo de Ciclo Real de Produção:
        // - Trefila: metros lineares por segundo (m/s) durante o tempo efetivo
        // - Treliça: metros lineares por minuto (m/min) durante o tempo efetivo
        // - Malha: tempo em segundos por peça (s/pç) durante o tempo efetivo
        let speedValue = 0;
        let speedUnit = isTrefila ? 'm/s' : isTrelica ? 'm/min' : isMalha ? 's/pç' : '';
        let speedFormatted = '';
        // Base de tempo: efetivo; se ainda não houver efetivo suficiente, usa o tempo total do turno (igual ao ritmo H)
        const speedBaseMs = effectiveMs >= 30000 ? effectiveMs : (totalShiftTimeMs >= 30000 ? totalShiftTimeMs : 0);

        if (isTrefila && speedBaseMs > 0 && produced > 0) {
            let bitolaMm = 0;
            const rawGauge = (op as any).targetGauge || (op as any).gauge || (op as any).bitola || (op as any).targetBitola;
            if (rawGauge) {
                const parsed = parseFloat(String(rawGauge).replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) bitolaMm = parsed;
            }
            if (!bitolaMm) {
                const text = `${op.productDescription || ''} ${(op as any).product || ''} ${op.orderNumber || ''}`;
                const match = text.match(/(\d+[.,]\d+)\s*(?:mm|m\.m\.|m\/m)?/i);
                if (match) {
                    const parsed = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(parsed) && parsed > 0) bitolaMm = parsed;
                }
            }
            if (!bitolaMm) bitolaMm = 3.40;

            const linearMass = bitolaMm * bitolaMm * 0.006162; // kg/m
            if (linearMass > 0) {
                const totalMeters = produced / linearMass;
                const effectiveSeconds = speedBaseMs / 1000;
                if (effectiveSeconds > 0) {
                    speedValue = totalMeters / effectiveSeconds;
                    speedUnit = 'm/s';
                    speedFormatted = speedValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                }
            }
        } else if (isTrelica && speedBaseMs > 0 && produced > 0) {
            let pieceLengthMeters = 0;
            const rawLen = (op as any).targetLength || (op as any).length || (op as any).barLength;
            if (rawLen) {
                const parsed = parseFloat(String(rawLen).replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) pieceLengthMeters = parsed;
            }
            if (!pieceLengthMeters) {
                const text = `${op.productDescription || ''} ${(op as any).product || ''} ${(op as any).trelicaModel || ''}`;
                const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m|mts|metros|metro)\b/i);
                if (match) {
                    const parsed = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(parsed) && parsed > 0) pieceLengthMeters = parsed;
                }
            }
            if (!pieceLengthMeters) pieceLengthMeters = 6;

            const totalMeters = produced * pieceLengthMeters;
            const effectiveMinutes = speedBaseMs / 60000;
            if (effectiveMinutes > 0) {
                speedValue = totalMeters / effectiveMinutes;
                speedUnit = 'm/min';
                speedFormatted = speedValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }
        } else if (isMalha && speedBaseMs > 0 && produced > 0) {
            const effectiveSeconds = speedBaseMs / 1000;
            if (effectiveSeconds > 0) {
                speedValue = effectiveSeconds / produced;
                speedUnit = 's/pç';
                speedFormatted = speedValue < 10 
                    ? speedValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : Math.round(speedValue).toLocaleString('pt-BR');
            }
        }

        // Timestamp da última atualização registrada para o dia
        let maxTimestampMs = 0;
        if (isToday) {
            (op.processedLots || []).forEach((l: any) => {
                const rawTime = l.endTime || l.weighedAt || l.timestamp || l.startTime;
                if (!rawTime) return;
                if (getIsoDateStr(rawTime) === dateStr) {
                    const ms = new Date(rawTime).getTime();
                    if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
                }
            });

            (op.weighedPackages || []).forEach((p: any) => {
                const rawTime = p.timestamp || p.weighedAt || p.createdAt;
                if (!rawTime) return;
                if (getIsoDateStr(rawTime) === dateStr) {
                    const ms = new Date(rawTime).getTime();
                    if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
                }
            });

            (op.operatorLogs || []).forEach((l: any) => {
                const rawTime = l.endTime || l.updatedAt || l.startTime;
                if (!rawTime) return;
                if (getIsoDateStr(rawTime) === dateStr) {
                    const ms = new Date(rawTime).getTime();
                    if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
                }
            });

            (op.downtimeEvents || []).forEach((e: any) => {
                const rawTime = e.resumeTime || e.stopTime;
                if (!rawTime) return;
                if (getIsoDateStr(rawTime) === dateStr) {
                    const ms = new Date(rawTime).getTime();
                    if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
                }
            });

            matchingReports.forEach((r: any) => {
                const rawTime = r.updatedAt || r.shiftEndTime || r.createdAt || r.shiftStartTime;
                if (!rawTime) return;
                if (getIsoDateStr(rawTime) === dateStr) {
                    const ms = new Date(rawTime).getTime();
                    if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
                }
            });

            if ((op as any).updatedAt && getIsoDateStr((op as any).updatedAt) === dateStr) {
                const ms = new Date((op as any).updatedAt).getTime();
                if (!isNaN(ms) && ms > maxTimestampMs) maxTimestampMs = ms;
            }
        }

        let lastUpdateFormatted = '';
        if (isToday) {
            if (maxTimestampMs > 0) {
                const d = new Date(maxTimestampMs);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                lastUpdateFormatted = `${hh}:${mm}`;
            } else if (isProducingNow || isMachineStoppedNow || status === 'live') {
                const d = liveNow;
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                lastUpdateFormatted = `${hh}:${mm}`;
            }
        }

        const hasTimeStats = !isHoliday && (
            (isToday && (status === 'live' || status === 'closed' || dayElapsedShiftMs > 0 || produced > 0)) ||
            (isPast && (produced > 0 || matchingReports.length > 0 || dayDowntimeMs > 0))
        );

        return {
            dateStr,
            isToday,
            isPast,
            isFuture,
            isHoliday,
            holidayName,
            status,
            produced,
            unit,
            operatorName,
            matchingReportsCount: matchingReports.length,
            effectiveMs,
            downtimeMs: dayDowntimeMs,
            effectiveFormatted,
            downtimeFormatted,
            effectiveHours,
            ratePerHour,
            rateUnit,
            rateFormatted,
            speedValue,
            speedUnit,
            speedFormatted,
            hasTimeStats,
            isProducingNow,
            isMachineStoppedNow,
            lastUpdateFormatted
        };
    };

    // Helper para obter resumo diário consolidado da máquina em cada dia
    const getMachineDayProduction = (machName: string, date: Date) => {
        const dateStr = formatDateString(date);
        const todayStr = formatDateString(new Date());
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;
        const isFuture = dateStr > todayStr;
        const isTrefila = machName.startsWith('Trefila');
        const unit = isTrefila ? 'kg' : 'pçs';

        // OPs nesta máquina no dia
        const machOpsOnDay = scheduledOrders.filter(op => {
            if (op.scheduledMachine !== machName && op.machine !== machName) return false;
            const start = op.plannedStartDate || '';
            const end = op.plannedEndDate || start;
            return start <= dateStr && end >= dateStr;
        });

        let totalProduced = 0;
        let liveOpFound = false;
        let mainOperator = '';

        machOpsOnDay.forEach(op => {
            const stats = getOpDayStats(op, date, machName);
            totalProduced += stats.produced;
            if (stats.status === 'live') liveOpFound = true;
            if (stats.operatorName && !mainOperator) mainOperator = stats.operatorName;
        });

        const machineDayReports = (shiftReports || []).filter(r => {
            if (r.machine !== machName) return false;
            const repDate = r.date || getIsoDateStr(r.shiftStartTime || r.shiftEndTime);
            return repDate === dateStr;
        });

        if (totalProduced === 0 && machineDayReports.length > 0) {
            totalProduced = machineDayReports.reduce((acc, r) => acc + (isTrefila ? (r.totalProducedWeight || 0) : (r.totalProducedQuantity || 0)), 0);
            if (!mainOperator) mainOperator = machineDayReports[0].operator || '';
        }

        return {
            dateStr,
            isToday,
            isPast,
            isFuture,
            hasOps: machOpsOnDay.length > 0,
            isLive: isToday && liveOpFound,
            totalProduced,
            unit,
            operatorName: mainOperator,
            opsCount: machOpsOnDay.length
        };
    };

    // Bitolas disponíveis de CA-60 para Trefila
    // Bitolas disponíveis de CA-60 para Trefila
    const availableTrefilaGauges = useMemo(() => {
        const customGauges = gauges.filter(g => g.materialType === 'CA-60').map(g => g.gauge);
        return customGauges.length > 0 ? customGauges : TrefilaBitolaOptions;
    }, [gauges]);

    const availableTrefilaGaugesData = useMemo(() => {
        return gauges.filter(g => {
            const mat = (g.materialType || '').toLowerCase();
            return mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
        });
    }, [gauges]);

    // Bitolas disponíveis de Fio Máquina para entrada
    const availableFioMaquinaGauges = useMemo(() => {
        const customGauges = gauges.filter(g => g.materialType === 'Fio Máquina').map(g => g.gauge);
        return [...new Set([...FioMaquinaBitolaOptions, ...customGauges])];
    }, [gauges]);

    // Helper para converter unidades de produção de uma OP para kg com base na Ficha Técnica Oficial
    const getOpWeightPerUnit = (op: ProductionOrderData): number => {
        const mach = String(op.scheduledMachine || op.machine || '');
        if (mach.startsWith('Trefila')) return 1;

        const opText = `${op.productCode || ''} ${op.productDescription || ''} ${op.trelicaModel || ''} ${op.malhaModel || ''} ${op.tamanho || ''}`.toUpperCase();

        // 1. Treliça (TL 1 e TL 2)
        if (mach.startsWith('Treliça')) {
            // Se for ET8 (6m ou 12m)
            if (opText.includes('ET8') || opText.includes('ET-8') || opText.includes('H8') || opText.includes('H-8') || opText.includes('3884')) {
                const is12m = opText.includes('12M') || opText.includes('12 METROS') || op.tamanho === '12';
                return is12m ? 8.174 : 4.087;
            }
            // Se for ET10 (6m ou 12m)
            if (opText.includes('ET10') || opText.includes('ET-10') || opText.includes('H10') || opText.includes('H-10') || opText.includes('8702')) {
                const is6m = opText.includes('6M') || opText.includes('6 METROS') || op.tamanho === '6';
                return is6m ? 3.843 : 9.057;
            }
            // Se for ET6
            if (opText.includes('ET6') || opText.includes('H6')) {
                return 5.502;
            }
            // Se for ET12
            if (opText.includes('ET12') || opText.includes('H12')) {
                const is6m = opText.includes('6M') || op.tamanho === '6';
                return is6m ? 5.270 : 10.540;
            }

            const allTrelicaList = [...(trelicaModels || []), ...DEFAULT_TRELICA_MODELS];
            const found = allTrelicaList.find(m => 
                (m.cod && (m.cod === op.trelicaModel || opText.includes(m.cod.toUpperCase()))) ||
                (m.modelo && (m.modelo === op.trelicaModel || opText.includes(m.modelo.toUpperCase())))
            );
            if (found) {
                const p = found.pesoFinal || (found as any).peso_final;
                if (p) {
                    const parsed = parseFloat(String(p).replace(',', '.'));
                    if (!isNaN(parsed) && parsed > 0) return parsed;
                }
            }

            if (op.pieceWeight && op.pieceWeight > 0) return op.pieceWeight;
            return 4.087;
        }

        // 2. Malha (ML 1)
        if (mach.startsWith('Malha')) {
            // Fichas técnicas nominais oficiais de Malha
            // Cód. 6626 (Q138 4,20mm): 32,283 kg por painel
            if (opText.includes('6626') || opText.includes('Q138') || opText.includes('4,20') || opText.includes('4.20')) {
                return 32.283;
            }
            // Cód. 6621 (4,60mm): 38,725 kg
            if (opText.includes('6621') || opText.includes('4,60') || opText.includes('4.60')) {
                return 38.725;
            }
            // Cód. 3885 (Q116 5,00mm): 45,753 kg
            if (opText.includes('3885') || opText.includes('Q116') || opText.includes('5,00') || opText.includes('5.00')) {
                return 45.753;
            }
            // Cód. 3968 (Q113 3,80mm): 26,448 kg
            if (opText.includes('3968') || opText.includes('Q113') || opText.includes('3,80') || opText.includes('3.80')) {
                return 26.448;
            }

            const allMalhaList = [...(availableMalhaModels || []), ...(DefaultMalhaGauges || [])];
            const found = allMalhaList.find(m => {
                const mCode = String(m.productCode || '').toUpperCase();
                const mDesc = String(m.description || '').toUpperCase();
                const mId = String(m.id || '').toUpperCase();
                return (
                    (mCode && (opText.includes(mCode) || mCode === op.productCode || mCode === op.malhaModel)) ||
                    (mDesc && (opText.includes(mDesc) || mDesc.includes(String(op.productDescription || '').toUpperCase()))) ||
                    (mId && (mId === op.malhaModel || mId === op.productCode))
                );
            });

            if (found) {
                const rawPeso = (found as any).peso_peca || (found as any).peso_final || (found as any).peso;
                if (rawPeso) {
                    const parsed = parseFloat(String(rawPeso).replace(',', '.'));
                    if (!isNaN(parsed) && parsed > 0) return parsed;
                }
            }

            if (op.pieceWeight && op.pieceWeight > 0) return op.pieceWeight;
            return 32.283;
        }

        return 1;
    };

    // Totais consolidados por dia para a linha de rodapé (soma de todas as máquinas selecionadas)
    const weekDailyTotals = useMemo(() => {
        const visibleMachines = availableMachines.filter(mach => selectedMachinesFilter.includes(mach.name));
        const todayStr = formatDateString(liveNow);
        const isWeekend = liveNow.getDay() === 0 || liveNow.getDay() === 6;
        const mondayOfThisWeekStr = formatDateString(getMonday(liveNow));

        const saturdayDate = new Date(getMonday(liveNow));
        saturdayDate.setDate(saturdayDate.getDate() - 2);
        const saturdayStr = formatDateString(saturdayDate);

        const sundayDate = new Date(getMonday(liveNow));
        sundayDate.setDate(sundayDate.getDate() - 1);
        const sundayStr = formatDateString(sundayDate);

        const days = weekDays.map((day) => {
            const dayDateStr = formatDateString(day);
            const isToday = dayDateStr === todayStr || (isWeekend && dayDateStr === mondayOfThisWeekStr);
            const isPast = dayDateStr < todayStr && !isToday;
            const isFuture = dayDateStr > todayStr && !isToday;
            const isHoliday = holidaysMap.has(dayDateStr);
            const holidayName = holidaysMap.get(dayDateStr) || '';
            const isEvaluatingActiveMonday = isWeekend && dayDateStr === mondayOfThisWeekStr;

            let dayPlannedKg = 0;
            let dayProducedKg = 0;
            let dayPlannedPcs = 0;
            let dayProducedPcs = 0;

            visibleMachines.forEach(mach => {
                const isTrefila = mach.name.startsWith('Trefila');
                const isTrelica = mach.name.startsWith('Treliça');

                const machOps = scheduledOrders.filter(op => {
                    if (op.scheduledMachine !== mach.name && op.machine !== mach.name) return false;
                    const start = op.plannedStartDate || '';
                    const end = op.plannedEndDate || start;
                    return start <= dayDateStr && end >= dayDateStr;
                });

                machOps.forEach(op => {
                    const stats = getOpDayStats(op, day, mach.name);
                    const unitWeight = getOpWeightPerUnit(op);

                    // 1. Meta / Planejado (kg)
                    if (!isHoliday) {
                        const totalTarget = isTrefila 
                            ? (Number(op.totalWeight) || Number(op.quantityToProduce) || 18000)
                            : (Number(op.quantityToProduce) || Number(op.malhaPieces) || (isTrelica ? 3500 : 5000));
                        const durationDays = Math.max(1, op.estimatedDurationDays || 1);
                        const dailyPlannedQty = stats.isFuture && stats.produced > 0 
                            ? stats.produced 
                            : Math.round(totalTarget / durationDays);

                        if (isTrefila) {
                            dayPlannedKg += dailyPlannedQty;
                        } else {
                            dayPlannedPcs += dailyPlannedQty;
                            dayPlannedKg += Math.round(dailyPlannedQty * unitWeight);
                        }
                    }

                    // 2. Realizado / Produzido (kg)
                    if (isToday || isPast || stats.status === 'live' || stats.status === 'closed' || stats.produced > 0) {
                        if (isTrefila) {
                            if (stats.produced > 0 && (stats.status === 'live' || stats.status === 'closed' || isToday || isPast)) {
                                dayProducedKg += stats.produced;
                            }
                        } else {
                            const matchingReports = (shiftReports || []).filter(r => {
                                const isThisOp = r.productionOrderId === op.id || r.orderNumber === op.orderNumber;
                                if (!isThisOp) return false;
                                const repDate = r.date || getIsoDateStr(r.shiftStartTime || r.shiftEndTime);
                                return repDate === dayDateStr || (isEvaluatingActiveMonday && (repDate === saturdayStr || repDate === sundayStr || repDate === todayStr));
                            });
                            const repWeight = matchingReports.reduce((acc, r) => acc + (Number(r.totalProducedWeight) || 0), 0);
                            if (repWeight > 0) {
                                dayProducedKg += repWeight;
                                dayProducedPcs += stats.produced;
                            } else if (stats.produced > 0 && (stats.status === 'live' || stats.status === 'closed' || isToday || isPast)) {
                                dayProducedPcs += stats.produced;
                                dayProducedKg += Math.round(stats.produced * unitWeight);
                            }
                        }
                    }
                });

                // Inclui também relatórios avulsos do dia não atrelados às OPs programadas
                if (isToday || isPast || isEvaluatingActiveMonday) {
                    const unlinkedReports = (shiftReports || []).filter(r => {
                        if (r.machine !== mach.name) return false;
                        const repDate = r.date || getIsoDateStr(r.shiftStartTime || r.shiftEndTime);
                        const matchDate = repDate === dayDateStr || (isEvaluatingActiveMonday && (repDate === saturdayStr || repDate === sundayStr || repDate === todayStr));
                        if (!matchDate) return false;
                        return !machOps.some(o => o.id === r.productionOrderId || o.orderNumber === r.orderNumber);
                    });
                    unlinkedReports.forEach(r => {
                        if (isTrefila) {
                            dayProducedKg += Number(r.totalProducedWeight) || 0;
                        } else {
                            const repWeight = Number(r.totalProducedWeight) || (Number(r.totalProducedQuantity || 0) * (isTrelica ? 3.5 : 5.0));
                            dayProducedKg += repWeight;
                            dayProducedPcs += Number(r.totalProducedQuantity) || 0;
                        }
                    });
                }
            });

            const percentReached = dayPlannedKg > 0 ? Math.round((dayProducedKg / dayPlannedKg) * 100) : 0;

            return {
                day,
                dayDateStr,
                isToday,
                isPast,
                isFuture,
                isHoliday,
                holidayName,
                dayPlannedKg,
                dayProducedKg,
                dayPlannedPcs,
                dayProducedPcs,
                percentReached
            };
        });

        const weekTotalPlannedKg = days.reduce((acc, d) => acc + d.dayPlannedKg, 0);
        const weekTotalProducedKg = days.reduce((acc, d) => acc + d.dayProducedKg, 0);
        const weekPercent = weekTotalPlannedKg > 0 ? Math.round((weekTotalProducedKg / weekTotalPlannedKg) * 100) : 0;

        return {
            days,
            weekTotalPlannedKg,
            weekTotalProducedKg,
            weekPercent
        };
    }, [availableMachines, selectedMachinesFilter, liveNow, weekDays, holidaysMap, scheduledOrders, shiftReports, gauges, trelicaModels, availableMalhaModels]);

    return (
        <div className={`pcp-board-container bg-[#F1F5F9] text-slate-800 flex flex-col select-none ${
            isPcpFullscreen ? 'h-screen max-h-screen overflow-hidden p-1.5 gap-1.5' : 'min-h-screen p-2 sm:p-4 gap-3'
        }`}>
            
            {/* ESTILO CUSTOMIZADO LOCAL */}
            <style dangerouslySetInnerHTML={{ __html: `
                .pcp-glass {
                    background: #FFFFFF;
                    border: 1px solid #CBD5E1;
                    box-shadow: 0 10px 25px -5px rgba(11, 43, 104, 0.08);
                }
                .pcp-glass-card {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px -4px rgba(11, 43, 104, 0.1);
                }

                .pcp-timeline-grid {
                    display: grid;
                    grid-template-columns: 220px repeat(5, minmax(0, 1fr));
                    width: 100%;
                }
                .pcp-header-cell {
                    background: #0B2B68;
                    color: #FFFFFF;
                    border-bottom: 2px solid #EA580C;
                }
                .pcp-track-row {
                    border-bottom: 1px solid #E2E8F0;
                }
                .pcp-track-row:hover {
                    background: rgba(239, 246, 255, 0.45);
                }
                .pcp-op-bar {
                    position: absolute;
                    border-radius: 4px;
                    padding: 2px 4px;
                    box-shadow: 0 2px 6px 0 rgba(11, 43, 104, 0.06);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 10;
                    border: 1px solid #CBD5E1;
                    cursor: pointer;
                    overflow: hidden;
                }
                .pcp-op-bar:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px 0 rgba(11, 43, 104, 0.16);
                    z-index: 20;
                }
                .pulse-live {
                    animation: pulseLive 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulseLive {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.9); }
                }
                .animate-fade {
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .pcp-ticker-wrapper {
                    display: inline-flex;
                    overflow: hidden;
                    white-space: nowrap;
                    position: relative;
                    max-width: 100%;
                    vertical-align: middle;
                    mask-image: linear-gradient(to right, transparent 0%, black 4px, black calc(100% - 6px), transparent 100%);
                    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 4px, black calc(100% - 6px), transparent 100%);
                }
                .pcp-ticker-track {
                    display: inline-flex;
                    white-space: nowrap;
                    animation: pcpTickerScroll 14s linear infinite;
                    will-change: transform;
                }
                .pcp-ticker-wrapper:hover .pcp-ticker-track {
                    animation-play-state: paused;
                }
                @keyframes pcpTickerScroll {
                    0% {
                        transform: translateX(0%);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
            `}} />

            {/* COLUNA PRINCIPAL: TIMELINE PCP SEMANAL */}
            <div className={`flex-1 pcp-glass rounded-2xl border border-blue-200/80 shadow-xl flex flex-col overflow-hidden relative ${
                isLargeZoom ? 'pcp-zoom-large' : ''
            } ${
                isPcpFullscreen ? 'h-full flex-1' : 'h-[calc(100vh-112px)]'
            }`}>
                
                {/* Cabeçalho de Controle e Ações (Identidade Ita Aços: Azul Royal + Faixa Laranja + Branco) */}
                <div className="py-2 px-3 sm:px-3.5 border-b border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-gradient-to-r from-[#0C2B68] via-[#103E8C] to-[#0A2454] relative text-white shadow-md">
                    {/* Faixa decorativa superior Laranja Ita Aços */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />
                    
                    {/* Título com Logo Ita Aços + Setor Trefila + Power by MSM */}
                    <div className="flex items-center gap-3.5">
                        {/* Logo Ita Aços em card com acabamento clean */}
                        <div className="bg-white/95 px-3 py-1.5 rounded-xl border border-white/40 shadow-md backdrop-blur-sm flex items-center justify-center shrink-0 hover:bg-white transition-all">
                            <img 
                                src="/ita-acos-logo.png" 
                                alt="Logo Grupo Ita Aços" 
                                className="h-7 sm:h-8 w-auto object-contain" 
                            />
                        </div>

                        <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-sm sm:text-base font-black tracking-wider uppercase text-white drop-shadow-sm flex items-center gap-1.5">
                                    Planejamento Semanal
                                </h1>
                                <span className="text-[9.5px] font-black uppercase text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 px-2.5 py-0.5 rounded-full shadow-sm tracking-widest border border-orange-300/40">
                                    Setor Trefila
                                </span>
                                {isViewer && (
                                    <span className="text-[9.5px] font-black uppercase text-amber-950 bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-300 px-2.5 py-0.5 rounded-full shadow-sm tracking-wider border border-amber-400 flex items-center gap-1">
                                        👁️ Modo Visualizador (Somente Leitura)
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <p className="text-[10px] text-blue-200/90 font-medium tracking-wide flex items-center gap-1.5">
                                    <span>Painel de Produção</span>
                                    <span className="text-blue-400/80">•</span>
                                    <span className="text-orange-300 font-extrabold tracking-wider">Power by MSM</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Controles: Navegação da Semana & Botões de Ação */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        
                        {/* Seletor de Semanas */}
                        <div className="flex items-center gap-1.5 bg-blue-950/70 p-1 rounded-xl border border-blue-400/30 text-white shadow-inner">
                            <button 
                                onClick={() => changeWeek(-1)}
                                className="p-1.5 hover:bg-blue-800/60 rounded-lg text-blue-200 hover:text-white transition-colors"
                                title="Semana Anterior"
                            >
                                <ArrowLeftIcon className="w-4 h-4" />
                            </button>

                            <button
                                onClick={resetToToday}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    isCurrentWeek
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-sm'
                                        : 'bg-blue-900/50 hover:bg-blue-800/60 text-blue-200 hover:text-white border border-transparent'
                                }`}
                                title={isWeekend ? "Fim de semana: reconhecendo a próxima semana de produção" : "Ir para a semana atual"}
                            >
                                <span>Semana Atual</span>
                                {isWeekend && isCurrentWeek && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white font-black uppercase tracking-wider">
                                        Próx.
                                    </span>
                                )}
                            </button>

                            <div className="px-3 py-1 text-xs font-black text-white tracking-wider whitespace-nowrap">
                                {formatFriendlyDate(weekDays[0])} a {formatFriendlyDate(weekDays[4])}
                            </div>

                            <button
                                onClick={() => changeWeek(1)}
                                className="p-1.5 hover:bg-blue-800/60 rounded-lg text-blue-200 hover:text-white transition-colors"
                                title="Próxima Semana"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Seletor de Máquinas (Oculto em acesso restrito / Somente PCP, exibido em acesso normal) */}
                        {!isPcpRestrictedAccess && (
                            <div className="flex items-center gap-1 bg-blue-950/70 p-1 rounded-xl border border-blue-400/30 overflow-hidden shadow-inner">
                                {/* Botão Todas as Máquinas */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedMachinesFilter(availableMachines.map(m => m.name));
                                    }}
                                    className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                                        selectedMachinesFilter.length === availableMachines.length
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                                            : 'text-blue-300 hover:text-white hover:bg-blue-800/50 border border-transparent'
                                    }`}
                                    title="Exibir todas as máquinas permitidas no quadro PCP"
                                >
                                    Todas
                                </button>

                                {availableMachines.map(mach => {
                                    const isSelected = selectedMachinesFilter.includes(mach.name);
                                    const isAllSelected = selectedMachinesFilter.length === availableMachines.length;
                                    
                                    return (
                                        <button
                                            key={mach.name}
                                            type="button"
                                            onClick={() => {
                                                if (isAllSelected) {
                                                    setSelectedMachinesFilter([mach.name]);
                                                } else if (isSelected) {
                                                    if (selectedMachinesFilter.length > 1) {
                                                        setSelectedMachinesFilter(prev => prev.filter(m => m !== mach.name));
                                                    } else {
                                                        setSelectedMachinesFilter(availableMachines.map(m => m.name));
                                                    }
                                                } else {
                                                    setSelectedMachinesFilter(prev => [...prev, mach.name]);
                                                }
                                            }}
                                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all whitespace-nowrap border ${
                                                isSelected 
                                                    ? 'bg-white text-blue-950 border-white shadow-sm font-black' 
                                                    : 'text-blue-300 hover:text-white hover:bg-blue-800/40 border-transparent'
                                            }`}
                                            title={`Filtrar ${mach.name} (clique para alternar)`}
                                        >
                                            {mach.name.replace('Trefila ', 'TR ').replace('Treliça ', 'TL ').replace('Malha ', 'ML ')}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Botão Tela Cheia / Foco Total */}
                        <button
                            onClick={handleToggleFullscreen}
                            className={`font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                                isPcpFullscreen
                                    ? 'bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                    : 'bg-blue-900/60 hover:bg-blue-800/80 text-blue-100 border border-blue-400/30'
                            }`}
                            title={isPcpFullscreen ? "Sair da Tela Cheia e reexibir menus de navegação" : "Tela Cheia (Oculta menu lateral e expande o quadro em 100% da tela)"}
                        >
                            {isPcpFullscreen ? (
                                <>
                                    <ArrowsPointingInIcon className="w-4 h-4 text-white" />
                                    <span>Sair Tela Cheia</span>
                                </>
                            ) : (
                                <>
                                    <ArrowsPointingOutIcon className="w-4 h-4 text-blue-200" />
                                    <span>Tela Cheia</span>
                                </>
                            )}
                        </button>

                        {/* Botão Sair / Voltar do Sistema (Para modo Visualizador ou Foco Total) */}
                        {onLogout && (
                            <button
                                type="button"
                                onClick={onLogout}
                                className="font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-400/40 hover:shadow-[0_0_12px_rgba(225,29,72,0.3)] cursor-pointer"
                                title="Voltar / Sair do Sistema"
                            >
                                <ArrowLeftIcon className="w-4 h-4 text-white" />
                                <span>{isViewer ? 'Voltar' : 'Sair'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Área da Timeline (Fundo Claro de Alta Legibilidade) */}
                <div className="flex-1 min-h-0 overflow-hidden bg-[#F8FAFC] flex flex-col">
                        
                        {/* Cabeçalho dos Dias (Segunda a Sexta) com Destaque Corporativo Ita Aços */}
                        <div className="pcp-timeline-grid pcp-header-cell border-b-2 border-orange-500 relative z-30 shrink-0 shadow-sm">
                            <div className={`${isLargeZoom ? 'py-2 px-3 text-xs sm:text-sm' : 'py-1.5 px-2.5 text-xs'} flex items-center justify-between font-black text-white tracking-wider uppercase select-none bg-[#092354]`}>
                                <span>MÁQUINA</span>
                                <span className="text-[9px] text-orange-300 font-mono font-bold bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-400/40">SEMANAL</span>
                            </div>
                            
                            {weekDays.map((day, index) => {
                                const dayDateStr = formatDateString(day);
                                const isToday = dayDateStr === formatDateString(new Date());
                                const isHoliday = holidaysMap.has(dayDateStr);
                                const holidayName = holidaysMap.get(dayDateStr);
                                const daysNames = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA'];
                                const isEvenDay = index % 2 === 0; // Col 0 (Segunda), Col 2 (Quarta), Col 4 (Sexta)
                                return (
                                    <div 
                                        key={index} 
                                        className={`py-1.5 px-2 text-center flex items-center justify-center gap-1.5 border-l relative overflow-hidden select-none ${
                                            isToday 
                                                ? 'bg-gradient-to-b from-[#184896] via-[#0F3577] to-[#082252] border-l-orange-500 shadow-md ring-1 ring-orange-500/40' 
                                                : isHoliday 
                                                    ? 'bg-rose-950/60 border-l-rose-800/60' 
                                                    : isEvenDay
                                                        ? 'bg-[#020b1c] border-l-slate-900' 
                                                        : 'bg-[#1d59ad] border-l-blue-700/60'
                                        }`}
                                    >
                                        <span className={`${isLargeZoom ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'} font-black tracking-wider uppercase ${
                                            isToday ? 'text-amber-300 drop-shadow-sm' : isHoliday ? 'text-rose-300' : 'text-blue-100'
                                        }`}>
                                            {daysNames[index]}
                                        </span>
                                        <span className={`${isLargeZoom ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'} font-mono font-black ${
                                            isToday ? 'text-white font-black' : isHoliday ? 'text-rose-200' : 'text-blue-200'
                                        }`}>
                                            {formatFriendlyDate(day)}
                                        </span>
                                        {isToday && (
                                            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[8.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse ml-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                HOJE
                                            </span>
                                        )}
                                        {isHoliday && (
                                            <span 
                                                className="bg-rose-500/30 text-rose-200 text-[8.5px] font-black px-1.5 py-0.5 rounded border border-rose-400/60 shadow-sm truncate max-w-[90px]"
                                                title={`Feriado: ${holidayName}`}
                                            >
                                                🌴 {holidayName}
                                            </span>
                                        )}
                                        {isToday && (
                                            <div className="absolute bottom-0 left-0 w-full h-[3.5px] bg-gradient-to-r from-orange-500 via-amber-300 to-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]" />
                                        )}
                                        {isHoliday && !isToday && (
                                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-rose-500" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Linhas das Máquinas */}
                        <div className="flex-1 flex flex-col relative min-h-0 bg-[#F8FAFC]">
                            {availableMachines.filter(mach => selectedMachinesFilter.includes(mach.name)).map((mach) => {
                                const machOps = scheduledOrders.filter(op => op.scheduledMachine === mach.name);

                                // Calcula trilhas verticais para OPs simultâneas ou sobrepostas na mesma máquina
                                const getOpTrack = (op: ProductionOrderData) => {
                                    const opStart = op.plannedStartDate || '';
                                    const opEnd = op.plannedEndDate || opStart;
                                    const priorOps = machOps.slice(0, machOps.findIndex(o => o.id === op.id));
                                    let track = 0;
                                    for (const prior of priorOps) {
                                        const pStart = prior.plannedStartDate || '';
                                        const pEnd = prior.plannedEndDate || pStart;
                                        if (opStart <= pEnd && opEnd >= pStart) {
                                            track++;
                                        }
                                    }
                                    return track;
                                };

                                const hasOpWithAlert = machOps.some(op => {
                                    const prog = getOPProgress(op);
                                    return prog.isLive && (prog.isStopped || prog.isPrep);
                                });
                                const hasOpWithLiveLot = machOps.some(op => {
                                    const isTr = (typeof op.machine === 'string' && op.machine.startsWith('Trefila')) || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Trefila'));
                                    const prog = getOPProgress(op);
                                    return isTr && prog.isLive && Boolean(op.activeLotProcessing?.lotId);
                                });
                                const hasOpWithPendingWeight = machOps.some(op => {
                                    const isTr = (typeof op.machine === 'string' && op.machine.startsWith('Trefila')) || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Trefila'));
                                    return isTr && (op.processedLots || []).some((l: any) => l.finalWeight === null || l.finalWeight === undefined || isNaN(Number(l.finalWeight)) || Number(l.finalWeight) <= 0);
                                });

                                let calculatedMinHeight = isLargeZoom ? 155 : 130;
                                if (hasOpWithAlert) calculatedMinHeight += 24;
                                if (hasOpWithLiveLot) calculatedMinHeight += 28;
                                if (hasOpWithPendingWeight) calculatedMinHeight += 24;

                                let baseTrackHeight = isLargeZoom ? 260 : 200;
                                if (hasOpWithAlert) baseTrackHeight += (isLargeZoom ? 28 : 24);
                                if (hasOpWithLiveLot) baseTrackHeight += (isLargeZoom ? 30 : 26);
                                if (hasOpWithPendingWeight) baseTrackHeight += (isLargeZoom ? 26 : 22);

                                const maxTracks = Math.max(1, ...machOps.map(op => getOpTrack(op) + 1));
                                const isMachineEmpty = machOps.length === 0;

                                return (
                                    <div 
                                        key={mach.name} 
                                        className={`pcp-timeline-grid pcp-track-row relative border-b border-slate-200 ${
                                            isMachineEmpty 
                                                ? 'shrink-0' 
                                                : 'flex-1'
                                        }`}
                                        style={{
                                            minHeight: isMachineEmpty ? '42px' : `${calculatedMinHeight}px`
                                        }}
                                    >
                                        {/* Coluna da Máquina (Fundo Branco Limpo com Indicador Ita Aços) */}
                                        {isMachineEmpty ? (
                                            <div className={`px-2 py-1 flex items-center justify-between border-r border-slate-200 border-l-4 ${mach.color} sticky left-0 z-20 shrink-0 shadow-sm bg-slate-50/90 h-full`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-blue-950 text-sm font-black tracking-wider">{mach.name}</span>
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Sem OP</span>
                                                </div>
                                                {!isViewer && (
                                                    <button
                                                        onClick={() => handleOpenCreateModal(mach.name)}
                                                        className="w-5 h-5 rounded bg-slate-200 hover:bg-orange-500 text-slate-600 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm text-xs font-bold"
                                                        title={`Criar OP para ${mach.name}`}
                                                    >
                                                        <PlusIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={`p-1.5 sm:p-2 flex flex-col justify-between border-r border-slate-200 border-l-4 ${mach.color} sticky left-0 z-20 shrink-0 shadow-sm bg-white`}>
                                            {/* Topo: Nome da Máquina (clicável para abrir turnos e paradas se não for visualizador) + Botão Nova OP */}
                                            <div className="flex items-center justify-between gap-2 pb-1">
                                                {isViewer ? (
                                                    <div 
                                                        className={`text-blue-950 ${isLargeZoom ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} font-black tracking-wider block shrink-0 select-none`}
                                                        title={`Máquina ${mach.name}`}
                                                    >
                                                        <span>{mach.name}</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenMachineShiftModal(mach.name)}
                                                        className={`text-blue-950 ${isLargeZoom ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} font-black tracking-wider block shrink-0 hover:text-orange-600 transition-all text-left flex items-center gap-1.5 group cursor-pointer`}
                                                        title={`Configuração da Máquina ${mach.name} (Comandos de OP, Ferramentas, Turnos e Paradas)`}
                                                    >
                                                        <span className="group-hover:underline underline-offset-4 decoration-orange-500">{mach.name}</span>
                                                        <span className="opacity-80 group-hover:opacity-100 group-hover:rotate-45 text-xs text-blue-600 font-mono transition-all transform duration-300">⚙️</span>
                                                    </button>
                                                )}
                                                {!isViewer && (
                                                    <button
                                                        onClick={() => handleOpenCreateModal(mach.name)}
                                                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-orange-500 text-slate-600 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm"
                                                        title={`Criar OP para ${mach.name}`}
                                                    >
                                                        <PlusIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Centro: Card do Operador da Máquina */}
                                            <div className="my-auto py-1">
                                                {(() => {
                                                    const operator = getMachineOperator(mach.name);
                                                    if (!operator) {
                                                        return (
                                                            <div 
                                                                className="p-1.5 rounded-xl border border-slate-200 bg-slate-50/90 flex items-center justify-between gap-1.5 text-slate-500 hover:border-slate-300 transition-all shadow-sm"
                                                                title={`Nenhum operador com turno ativo na máquina ${mach.name}. Turno Encerrado.`}
                                                            >
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <div className={`${isLargeZoom ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-slate-200 flex items-center justify-center shrink-0`}>
                                                                        <ClockIcon className={`${isLargeZoom ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-500`} />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={`${isLargeZoom ? 'text-xs sm:text-[13px]' : 'text-[10px]'} font-black tracking-wide text-slate-700 uppercase truncate`}>
                                                                            Turno Encerrado
                                                                        </span>
                                                                        <span className={`${isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[8px]'} font-medium text-slate-500 truncate`}>
                                                                            Aguardando operador
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={`${isLargeZoom ? 'text-[9px] sm:text-[10px]' : 'text-[8px]'} font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0`}>
                                                                    Off
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    if ((operator as any).isAutoStartedWaitingCheckin) {
                                                        return (
                                                            <div 
                                                                className="p-1.5 rounded-xl border border-amber-300 bg-amber-50 flex items-center justify-between gap-1.5 text-amber-800 shadow-sm transition-all animate-pulse"
                                                                title={`Turno iniciado automaticamente pelo sistema para ${mach.name}. Aguardando check-in do operador no aplicativo.`}
                                                            >
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <div className={`${isLargeZoom ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-amber-200 flex items-center justify-center shrink-0 text-amber-800`}>
                                                                        <ClockIcon className={`${isLargeZoom ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={`${isLargeZoom ? 'text-xs sm:text-[13px]' : 'text-[10px]'} font-black tracking-wide text-amber-900 uppercase truncate`}>
                                                                            Turno Aberto (Auto)
                                                                        </span>
                                                                        <span className={`${isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[8px]'} font-bold text-amber-700 truncate`}>
                                                                            Aguardando Check-in
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={`${isLargeZoom ? 'text-[9px] sm:text-[10px]' : 'text-[8px]'} font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0`}>
                                                                    Auto
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    const isOperating = operator.status === 'operating';
                                                    const isOnline = operator.isOnline;

                                                    return (
                                                        <div 
                                                            onClick={isViewer ? undefined : () => {
                                                                localStorage.setItem('msm_active_machine', mach.name);
                                                                if (mach.name.startsWith('Trefila')) setPage('trefilaInProgress');
                                                                else if (mach.name.startsWith('Treliça')) setPage('trelicaInProgress');
                                                                else if (mach.name.startsWith('Malha')) setPage('malhaInProgress');
                                                            }}
                                                            className={`p-1.5 rounded-xl border transition-all flex items-center gap-2 overflow-hidden w-full ${
                                                                isViewer 
                                                                    ? 'cursor-default' 
                                                                    : 'cursor-pointer hover:shadow-md active:scale-[0.98]'
                                                            } ${
                                                                isOperating 
                                                                    ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                                                                    : isOnline 
                                                                        ? 'bg-blue-50 border-blue-300 shadow-sm' 
                                                                        : 'bg-slate-50 border-slate-200 shadow-sm'
                                                            }`}
                                                            title={`${operator.name} (${operator.jobTitle}) - ${operator.statusLabel} ${isOnline ? '(Online no App)' : '(Offline no App)'}.${isViewer ? '' : ' Clique para abrir o painel da máquina.'}`}
                                                        >
                                                            {/* Avatar com Foto do Operador */}
                                                            <div className="relative shrink-0">
                                                                {operator.photoUrl ? (
                                                                    <img 
                                                                        src={operator.photoUrl} 
                                                                        alt={operator.name} 
                                                                        className={`${isLargeZoom ? 'w-8 h-8' : 'w-7 h-7'} rounded-full object-cover border-2 shadow-sm ${
                                                                            isOperating 
                                                                                ? 'border-emerald-500 ring-1 ring-emerald-400/40' 
                                                                                : isOnline 
                                                                                    ? 'border-blue-500 ring-1 ring-blue-400/40' 
                                                                                    : 'border-slate-400'
                                                                        }`}
                                                                    />
                                                                ) : (
                                                                    <div className={`${isLargeZoom ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-[10px]'} rounded-full flex items-center justify-center font-black border-2 uppercase shadow-sm ${
                                                                        isOperating 
                                                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-400' 
                                                                            : isOnline 
                                                                                ? 'bg-blue-100 text-blue-800 border-blue-400' 
                                                                                : 'bg-slate-200 text-slate-700 border-slate-400'
                                                                    }`}>
                                                                        {operator.displayName.slice(0, 2)}
                                                                    </div>
                                                                )}
                                                                {/* Ponto Indicador de Status */}
                                                                <span 
                                                                    className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border border-white ${
                                                                        isOperating 
                                                                            ? 'bg-emerald-500 animate-pulse' 
                                                                            : isOnline 
                                                                                ? 'bg-blue-500 animate-pulse' 
                                                                                : 'bg-slate-400'
                                                                    }`} 
                                                                    title={isOnline ? 'Online no App' : 'Offline no App'}
                                                                />
                                                            </div>

                                                            {/* Nome do Operador (Linha 1) / Status (Linha 2) / Relógio (Linha 3 em baixo do status) */}
                                                            <div className="flex flex-col min-w-0 flex-1 justify-center">
                                                                <span 
                                                                    className={`${isLargeZoom ? 'text-sm sm:text-base' : 'text-xs sm:text-[13px]'} font-black text-slate-900 truncate leading-tight block`}
                                                                    title={operator.displayName}
                                                                >
                                                                    {operator.displayName}
                                                                </span>
                                                                <div className="flex items-center gap-1 min-w-0 mt-0.5">
                                                                    <span className={`${isLargeZoom ? 'text-xs sm:text-[13px]' : 'text-[10px] sm:text-[11px]'} font-bold tracking-tight truncate flex items-center gap-1 min-w-0 ${
                                                                        isOperating ? 'text-emerald-700' : isOnline ? 'text-blue-700' : 'text-slate-500'
                                                                    }`}>
                                                                        {isOperating && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping shrink-0" />}
                                                                        {!isOperating && isOnline && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse shrink-0" />}
                                                                        <span className="truncate">{operator.statusLabel}</span>
                                                                    </span>
                                                                </div>
                                                                {operator.lastUpdateFormatted && (
                                                                    <div className="mt-1 flex items-center">
                                                                        <span 
                                                                            className={`inline-flex items-center gap-1 ${isLargeZoom ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]'} font-mono font-black text-slate-700 bg-white/95 px-1.5 py-0.5 rounded-md border border-slate-300 shadow-2xs shrink-0`} 
                                                                            title={`Último registro do operador hoje: ${operator.lastUpdateFormatted}`}
                                                                        >
                                                                            <ClockIcon className={`${isLargeZoom ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-slate-500 shrink-0`} />
                                                                            <span>{operator.lastUpdateFormatted}</span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Status em Tempo Real da Máquina (Parada, Preparação, etc) */}
                                            {(() => {
                                                const liveInfo = machineLiveStatus.find(m => m.machine === mach.name);
                                                if (!liveInfo) return null;

                                                if (liveInfo.state === 'stopped' || liveInfo.state === 'prep') {
                                                    const isExceeded = Boolean((liveInfo as any).isOverLimit);
                                                    return (
                                                        <div 
                                                            onClick={isViewer ? undefined : () => {
                                                                localStorage.setItem('msm_active_machine', mach.name);
                                                                if (mach.name.startsWith('Trefila')) setPage('trefilaInProgress');
                                                                else if (mach.name.startsWith('Treliça')) setPage('trelicaInProgress');
                                                                else if (mach.name.startsWith('Malha')) setPage('malhaInProgress');
                                                            }}
                                                            className={`mt-1.5 p-1 rounded-md transition-all shadow-sm ${
                                                                isViewer 
                                                                    ? 'cursor-default' 
                                                                    : 'cursor-pointer hover:bg-rose-100'
                                                            } ${
                                                                isExceeded 
                                                                    ? 'bg-rose-50 border-2 border-rose-500 text-rose-900 animate-pulse shadow-rose-500/20' 
                                                                    : 'bg-amber-50 border-2 border-amber-500 text-amber-950 animate-pulse shadow-amber-500/20'
                                                            }`}
                                                            title={isExceeded ? "Tempo Ultrapassado!" : "Alerta de Parada/Preparação"}
                                                        >
                                                            <div className={`flex items-center gap-1 font-black ${isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[8px]'} uppercase tracking-wide ${isExceeded ? 'text-rose-600' : 'text-amber-700'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isExceeded ? 'bg-rose-600 animate-ping' : 'bg-amber-500'}`} />
                                                                {isExceeded ? '🚨 TEMPO ULTRAPASSADO' : liveInfo.state === 'prep' ? '⚡ PREPARAÇÃO' : '⚠️ ALERTA: PARADA'}
                                                            </div>
                                                            <span className={`${isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[8px]'} font-bold truncate block ${isExceeded ? 'text-rose-900' : 'text-amber-900'}`} title={liveInfo.reason}>
                                                                {liveInfo.reason}
                                                            </span>
                                                            <span className={`${isLargeZoom ? 'text-xs sm:text-[13px]' : 'text-[9px]'} font-mono font-black block ${isExceeded ? 'text-rose-700' : 'text-amber-800'}`}>
                                                                ⏱️ {formatDuration(liveInfo.durationMs)}
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                return null;
                                             })()}
                                         </div>
                                        )}

                                        {/* Grade de fundo (5 Colunas de dias com visual alternado para distinguir cada dia) */}
                                        {Array.from({ length: 5 }).map((_, colIndex) => {
                                            const targetDay = weekDays[colIndex];
                                            const targetDayStr = formatDateString(targetDay);
                                            const dayMachProd = getMachineDayProduction(mach.name, targetDay);
                                            const isHolidayCell = holidaysMap.has(targetDayStr);
                                            const holidayCellName = holidaysMap.get(targetDayStr);
                                            const isEvenCol = colIndex % 2 === 0; // Col 0 (Segunda), Col 2 (Quarta), Col 4 (Sexta)
                                            return (
                                                <div 
                                                    key={colIndex}
                                                    onClick={() => !isViewer && handleOpenCreateModal(mach.name, targetDayStr)}
                                                    className={`border-l relative flex flex-col justify-between p-2 group/cell transition-colors ${
                                                        isViewer ? 'cursor-default' : 'cursor-pointer'
                                                    } ${
                                                        dayMachProd.isToday 
                                                            ? 'bg-blue-50/70 hover:bg-blue-100/70 border-l-blue-400' 
                                                            : isHolidayCell 
                                                                ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-rose-300' 
                                                                : dayMachProd.isPast
                                                                    ? 'bg-emerald-50/30 hover:bg-emerald-100/40 border-l-emerald-300'
                                                                    : 'bg-amber-50/25 hover:bg-amber-100/40 border-l-amber-200'
                                                    }`}
                                                    title={isViewer ? `Produção de ${mach.name} no dia ${formatFriendlyDate(targetDay)}` : isHolidayCell ? `Feriado: ${holidayCellName}. Clique para programar OP` : `Clique para programar OP em ${mach.name} no dia ${formatFriendlyDate(targetDay)}`}
                                                >
                                                    {/* Monitor Diário na Célula da Grade */}
                                                    <div className="flex items-center justify-between gap-1 z-0 select-none">
                                                        {dayMachProd.totalProduced > 0 || dayMachProd.isLive ? (
                                                            <div className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black font-mono border flex items-center gap-1.5 shadow-sm ${
                                                                dayMachProd.isLive 
                                                                    ? 'bg-blue-600 text-white border-blue-700 shadow-[0_2px_8px_rgba(37,99,235,0.25)]' 
                                                                    : dayMachProd.isPast 
                                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                            }`}>
                                                                {dayMachProd.isLive && <span className="w-1.5 h-1.5 rounded-full bg-white pulse-live" />}
                                                                {dayMachProd.isPast && <span className="text-emerald-700 font-bold">✓</span>}
                                                                <span>{dayMachProd.totalProduced.toLocaleString('pt-BR')} {dayMachProd.unit}</span>
                                                            </div>
                                                        ) : isHolidayCell ? (
                                                            <span className="text-[9px] text-rose-600 font-bold font-mono pl-1 flex items-center gap-1 truncate max-w-[120px]" title={holidayCellName}>
                                                                🌴 {holidayCellName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] text-slate-400 font-mono pl-1 opacity-70">
                                                                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][colIndex]}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {!isViewer && (
                                                        <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 absolute inset-0 flex items-center justify-center bg-blue-900/5">
                                                            <span className="text-[10px] font-black text-blue-950 bg-white border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1 shadow-md">
                                                                <PlusIcon className="w-3 h-3 text-orange-500 group-hover:text-white" />
                                                                Nova OP
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Elementos de Barra de OPs sobrepostos na linha (Estilo Moderno Ita Aços: Cartões Brancos com Bordas Marcantes) */}
                                        {machOps.map(op => {
                                            const startStr = op.plannedStartDate!;
                                            let endStr = op.plannedEndDate || startStr;
                                            
                                            // Se a OP está Ao Vivo / Em Produção hoje e a data final planejada for anterior a hoje,
                                            // estendemos dinamicamente até hoje para que a OP permaneça visível na coluna do dia atual
                                            const isOpLive = op.status === 'in_progress' || op.status === 'Em Produção';
                                            if (isOpLive && todayStr > endStr) {
                                                endStr = todayStr;
                                            }

                                            let colStart = 0;
                                            if (startStr >= mondayStr) {
                                                const startIdx = weekDays.findIndex(d => formatDateString(d) === startStr);
                                                if (startIdx !== -1) colStart = startIdx;
                                            }

                                            let colEnd = 4;
                                            if (endStr <= fridayStr) {
                                                const endIdx = weekDays.findIndex(d => formatDateString(d) === endStr);
                                                if (endIdx !== -1) colEnd = endIdx;
                                            }

                                            const spanColumns = colEnd - colStart + 1;
                                            if (spanColumns <= 0) return null;

                                            const isTrelica = typeof op.machine === 'string' && op.machine.startsWith('Treliça') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Treliça'));
                                            const isMalha = typeof op.machine === 'string' && op.machine.startsWith('Malha') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Malha'));
                                            const isTrefila = typeof op.machine === 'string' && op.machine.startsWith('Trefila') || (typeof op.scheduledMachine === 'string' && op.scheduledMachine.startsWith('Trefila'));

                                            const prog = getOPProgress(op);
                                            const liveMach = machineLiveStatus.find(m => m.machine === mach.name);
                                            // Lotes que aguardam pesagem na Trefila (finalizados na máquina, mas sem peso balança ainda)
                                            const pendingWeightLots = isTrefila 
                                                ? (op.processedLots || []).filter((l: any) => 
                                                    l.finalWeight === null || l.finalWeight === undefined || isNaN(Number(l.finalWeight)) || Number(l.finalWeight) <= 0
                                                  )
                                                : [];

                                            const opHasAlert = prog.isLive && (prog.isStopped || prog.isPrep);
                                            const opHasLiveLot = isTrefila && prog.isLive && Boolean(op.activeLotProcessing?.lotId);
                                            const opHasPendingWeight = pendingWeightLots.length > 0;
                                            
                                            let opCardHeight = isLargeZoom ? 282 : 215;
                                            if (opHasAlert) opCardHeight += (isLargeZoom ? 34 : 30);
                                            if (opHasLiveLot) opCardHeight += (isLargeZoom ? 36 : 32);
                                            if (opHasPendingWeight) opCardHeight += (isLargeZoom ? 32 : 28);

                                            const track = getOpTrack(op);
                                            const machColWidth = 220;
                                            const leftStyle = `calc(220px + (100% - 220px) * ${colStart / 5})`;
                                            const widthStyle = `calc((100% - 220px) * ${spanColumns / 5})`;
                                            const cardVerticalStyle = maxTracks > 1
                                                ? { top: `${track * baseTrackHeight}px`, height: `${opCardHeight}px` }
                                                : { top: '0px', bottom: '0px' };
                                            const title = op.orderNumber;
                                            
                                            let displayProductCode = op.productCode || '';
                                            let displayProductDescription = op.productDescription || '';

                                            // Sincronização inteligente com o cadastro oficial de produtos (gauges / stock_gauges):
                                            // Garante que o código do produto exibido no card seja o código oficial cadastrado (ex: 8702 para Espaçador Treliçado ET10 Pesada)
                                            if (gauges && gauges.length > 0) {
                                                const descToMatch = (op.productDescription || op.trelicaModel || op.malhaModel || '').trim().toUpperCase();
                                                if (descToMatch) {
                                                    const matchedGauge = (gauges || []).find((g: any) => {
                                                        const gDesc = String(g.description || g.gaugeDescription || g.gauge || '').trim().toUpperCase();
                                                        if (!gDesc) return false;
                                                        return gDesc === descToMatch || (descToMatch.length > 6 && gDesc.includes(descToMatch)) || (gDesc.length > 6 && descToMatch.includes(gDesc));
                                                    });
                                                    if (matchedGauge) {
                                                        const officialCode = matchedGauge.productCode || matchedGauge.product_code || (matchedGauge as any).code;
                                                        if (officialCode) {
                                                            displayProductCode = officialCode;
                                                        }
                                                        if (!displayProductDescription && (matchedGauge.description || (matchedGauge as any).gaugeDescription)) {
                                                            displayProductDescription = matchedGauge.description || (matchedGauge as any).gaugeDescription;
                                                        }
                                                    }
                                                }
                                            }

                                            // Fallback para Trefila buscando descrição e código exatos do cadastro no gauges
                                            if (isTrefila && (!displayProductDescription || !displayProductCode)) {
                                                const cleanTarget = String(op.targetBitola || '').replace('mm', '').trim();
                                                const is340 = cleanTarget === '3.40' || cleanTarget === '3.4' || cleanTarget === '3,40' || cleanTarget === '3,4' || op.orderNumber === '87493';
                                                const matched = (gauges || []).find((g: any) => {
                                                    const mat = String(g.materialType || g.material_type || '').toLowerCase();
                                                    const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila') || mat.includes('ca') || mat.includes('arame') || mat.includes('semi');
                                                    if (!isCa60) return false;
                                                    const gClean = String(g.gauge || '').replace('mm', '').trim();
                                                    return g.gauge === op.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
                                                });
                                                if (matched) {
                                                    if (!displayProductCode) displayProductCode = matched.productCode || matched.product_code || (matched as any).code || '';
                                                    if (!displayProductDescription) displayProductDescription = matched.description || (matched as any).gaugeDescription || '';
                                                }
                                                if ((!displayProductCode || !displayProductDescription) && is340) {
                                                    displayProductCode = displayProductCode || '8624';
                                                    displayProductDescription = displayProductDescription || 'CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*';
                                                }
                                            }

                                            const subtitleParts = [];
                                            if (displayProductCode && !displayProductDescription?.startsWith(displayProductCode)) {
                                                subtitleParts.push(displayProductCode);
                                            }
                                            
                                            if (displayProductDescription) {
                                                subtitleParts.push(displayProductDescription);
                                            } else {
                                                if (isTrelica) subtitleParts.push(op.trelicaModel);
                                                else if (isMalha) subtitleParts.push(op.malhaModel);
                                                else subtitleParts.push(`Bitola ${op.targetBitola}mm`);
                                            }
                                            
                                            const tamanhoStr = op.tamanho;
                                            if (tamanhoStr) {
                                                const desc = (op.productDescription || op.trelicaModel || op.malhaModel || '').toUpperCase();
                                                if (!desc.includes(tamanhoStr.toUpperCase())) {
                                                    subtitleParts.push(tamanhoStr);
                                                }
                                            }
                                            
                                            const subtitle = subtitleParts.filter(Boolean).join(' - ');

                                            let trefilaDashStats = null;
                                            if (isTrefila && prog.isLive && op.activeLotProcessing && op.activeLotProcessing.lotId) {
                                                const activeLotInfo = stock.find(s => s.id === op.activeLotProcessing!.lotId);
                                                const lotIdStr = activeLotInfo?.internalLot || op.activeLotProcessing.lotId || '---';
                                                const initialWeight = activeLotInfo?.initialQuantity || op.totalWeight || 0;
                                                const speed = op.activeLotProcessing.speed || 1.5;
                                                const bitola = op.targetBitola ? parseFloat(op.targetBitola.replace(',', '.')) : 0;

                                                if (bitola > 0 && speed > 0) {
                                                    const lotStartTime = new Date(op.activeLotProcessing.startTime).getTime();
                                                    const linearMass = bitola * bitola * 0.006162;
                                                    const massPerSecond = speed * linearMass;
                                                    
                                                    if (massPerSecond > 0) {
                                                        const totalDurationSeconds = initialWeight > 0 ? (initialWeight / massPerSecond) : 0;
                                                        // Identificar se a máquina está pausada agora (Parada, Preparação, Fim de Turno, Desligada ou sem operador)
                                                        const liveMach = machineLiveStatus.find(m => m.machine === mach.name);
                                                        const activeOpOperator = getMachineOperator(mach.name);
                                                        const openStopEvent = [...(op.downtimeEvents || [])].reverse().find((e: any) => !e.resumeTime);

                                                        const isTrefilaPausedNow = Boolean(
                                                            openStopEvent || 
                                                            prog.isStopped || 
                                                            prog.isPrep || 
                                                            prog.isOffline || 
                                                            !activeOpOperator || 
                                                            (liveMach && liveMach.state !== 'producing')
                                                        );

                                                        const pauseReason = openStopEvent?.reason 
                                                            || prog.downtimeReason 
                                                            || (prog.isOffline ? 'Final de Turno' : '') 
                                                            || (liveMach?.reason || '') 
                                                            || (!activeOpOperator ? 'Sem Operador Ativo' : 'Parada');

                                                        // Somar paradas e intervalos sem produção desde o início do lote
                                                        let lotDowntimeMs = 0;
                                                        (op.downtimeEvents || []).forEach((e: any) => {
                                                            if (!e || !e.stopTime) return;
                                                            const stop = new Date(e.stopTime).getTime();
                                                            if (isNaN(stop)) return;
                                                            const resume = e.resumeTime ? new Date(e.resumeTime).getTime() : liveNow.getTime();
                                                            if (isNaN(resume)) return;

                                                            const startInLot = Math.max(stop, lotStartTime);
                                                            const endInLot = Math.min(resume, liveNow.getTime());
                                                            if (endInLot > startInLot) {
                                                                lotDowntimeMs += (endInLot - startInLot);
                                                            }
                                                        });

                                                        // Se estiver pausada agora (ex: fim de turno / desligada) sem parada aberta em downtimeEvents
                                                        if (isTrefilaPausedNow && !openStopEvent) {
                                                            const closedLogs = (op.operatorLogs || []).filter((l: any) => l.endTime);
                                                            const lastLogEnd = closedLogs.length > 0 
                                                                ? Math.max(...closedLogs.map((l: any) => new Date(l.endTime).getTime()).filter((t: number) => !isNaN(t)))
                                                                : 0;
                                                            const pauseStart = lastLogEnd > lotStartTime ? lastLogEnd : lotStartTime;
                                                            const unloggedPauseMs = Math.max(0, liveNow.getTime() - pauseStart);
                                                            if (unloggedPauseMs > 0 && lotDowntimeMs < unloggedPauseMs) {
                                                                lotDowntimeMs = Math.max(lotDowntimeMs, unloggedPauseMs);
                                                            }
                                                        }
                                                        const totalElapsedMs = Math.max(0, liveNow.getTime() - lotStartTime);
                                                        const elapsedUptimeMs = Math.max(0, totalElapsedMs - lotDowntimeMs);
                                                        const elapsedUptimeSeconds = elapsedUptimeMs / 1000;
                                                        const remainingSecondsRaw = totalDurationSeconds - elapsedUptimeSeconds;
                                                        const remainingSeconds = Math.max(0, remainingSecondsRaw);
                                                        const delayedSeconds = Math.max(0, -remainingSecondsRaw);
                                                        const isDelayed = totalDurationSeconds > 0 && elapsedUptimeSeconds > totalDurationSeconds;

                                                        trefilaDashStats = {
                                                            lotIdStr,
                                                            lotWeight: initialWeight,
                                                            elapsedMs: elapsedUptimeMs,
                                                            remainingSeconds,
                                                            delayedSeconds,
                                                            isDelayed,
                                                            isPaused: isTrefilaPausedNow,
                                                            pauseReason
                                                        };
                                                    }
                                                }
                                            }

                                            // Estilos de Cartão OP adaptados para tema Ita Aços (Azul, Laranja, Branco, Sombra Premium)
                                            let barBg = 'bg-white border-2 border-slate-200 border-l-8 border-l-slate-400 text-slate-800 shadow-sm';
                                            let barProgressColor = 'bg-slate-400';
                                            let barGlowRing = '';

                                            // Verificação de tempo ultrapassado de parada/preparação
                                            const normalizeDowntime = (s: string) => (s || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                            const normOpReason = normalizeDowntime(prog.downtimeReason);
                                            const machCategory = mach.name.toLowerCase().includes('trefila') ? 'trefila' :
                                                                 mach.name.toLowerCase().includes('trelica') ? 'trelica' :
                                                                 mach.name.toLowerCase().includes('malha') ? 'malha' :
                                                                 mach.name.toLowerCase().trim();

                                            const matchingConfig = (localDowntimeConfigs || []).find(c => {
                                                const normConfigReason = normalizeDowntime(c.reason);
                                                const configCategory = normalizeDowntime(c.machineType || '');
                                                return normOpReason === normConfigReason && 
                                                       (configCategory === 'geral' || !configCategory || configCategory === machCategory);
                                            });

                                            const thresholdMinutes = matchingConfig?.thresholdMinutes || 15;
                                            const limitMs = thresholdMinutes * 60 * 1000;
                                            const isDowntimeOverLimit = (prog.isStopped || prog.isPrep) && prog.downtimeDurationMs > limitMs;

                                            if (prog.isCompleted) {
                                                barBg = 'bg-white border-2 border-emerald-300 border-l-8 border-l-emerald-600 hover:border-emerald-400 text-slate-800 shadow-sm';
                                                barProgressColor = 'bg-emerald-500';
                                            } else if (prog.isLive) {
                                                if (prog.isStopped) {
                                                    if (isDowntimeOverLimit) {
                                                        barBg = 'bg-white border-2 border-rose-300 border-l-8 border-l-rose-600 text-slate-900 shadow-md';
                                                        barProgressColor = 'bg-rose-500';
                                                        barGlowRing = 'shadow-[0_4px_20px_rgba(244,63,94,0.18)]';
                                                    } else {
                                                        barBg = 'bg-white border-2 border-amber-300 border-l-8 border-l-amber-500 text-slate-900 shadow-md';
                                                        barProgressColor = 'bg-amber-500';
                                                        barGlowRing = 'shadow-[0_4px_16px_rgba(245,158,11,0.18)]';
                                                    }
                                                } else if (prog.isPrep) {
                                                    if (isDowntimeOverLimit) {
                                                        barBg = 'bg-white border-2 border-rose-300 border-l-8 border-l-rose-600 text-slate-900 shadow-md';
                                                        barProgressColor = 'bg-rose-500';
                                                        barGlowRing = 'shadow-[0_4px_20px_rgba(244,63,94,0.18)]';
                                                    } else {
                                                        barBg = 'bg-white border-2 border-amber-300 border-l-8 border-l-amber-500 text-slate-900 shadow-md';
                                                        barProgressColor = 'bg-amber-500';
                                                        barGlowRing = 'shadow-[0_4px_16px_rgba(245,158,11,0.15)]';
                                                    }
                                                } else {
                                                    // PRODUZINDO NORMALMENTE: Azul Royal com destaque Laranja Ita Aços
                                                    barBg = 'bg-white border-2 border-blue-400 border-l-8 border-l-orange-500 hover:border-blue-500 text-slate-900 shadow-md';
                                                    barProgressColor = 'bg-gradient-to-r from-orange-500 to-amber-500';
                                                    barGlowRing = 'shadow-[0_4px_20px_rgba(37,99,235,0.12)] ring-1 ring-blue-200';
                                                }
                                            }

                                            return (
                                                <div
                                                    key={op.id}
                                                    onClick={() => !isViewer && setDrawerOP(op)}
                                                    className={`pcp-op-bar absolute animate-fade ${barBg} ${barGlowRing} ${isViewer ? 'cursor-default' : 'cursor-pointer'}`}
                                                    style={{
                                                        left: leftStyle,
                                                        width: widthStyle,
                                                        ...cardVerticalStyle
                                                    }}
                                                >
                                                    <div className="flex flex-col h-full justify-between gap-1">
                                                        <div className="flex items-center justify-between gap-1.5 shrink-0 pb-0.5 border-b border-slate-200/80 flex-nowrap overflow-hidden">
                                                            {/* Lado Esquerdo: #OP# + Descrição Completa + Status Badges */}
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden flex-nowrap">
                                                                {isViewer ? (
                                                                    <span className={`${isLargeZoom ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'} font-black text-blue-900 tracking-wide select-none shrink-0`}>
                                                                        <span>#{title}#</span>
                                                                    </span>
                                                                ) : (
                                                                    <span 
                                                                        className={`${isLargeZoom ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'} font-black text-blue-900 tracking-wide hover:text-orange-600 cursor-pointer transition-colors flex items-center gap-1 shrink-0`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingInProgressOP(op);
                                                                        }}
                                                                        title="Clique para editar OP em produção (Nome, Meta, Turnos Finalizados)"
                                                                    >
                                                                        <span>#{title}#</span>
                                                                    </span>
                                                                )}
                                                                {subtitle && (
                                                                    <div className="min-w-0 flex-1 max-w-full overflow-hidden flex items-center">
                                                                        <PCPTickerText 
                                                                            text={subtitle}
                                                                            className={`${isLargeZoom ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'} text-slate-800 font-bold tracking-normal`}
                                                                        />
                                                                    </div>
                                                                )}
                                                                
                                                                {prog.isPending && (
                                                                    <span className={`flex items-center gap-1 ${isLargeZoom ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5'} font-black uppercase bg-amber-100 text-amber-900 rounded border border-amber-300 shadow-sm shrink-0`}>
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                        AGENDADA
                                                                    </span>
                                                                )}
                                                                {prog.isLive && prog.isOffline && (
                                                                    <span className={`flex items-center gap-1 ${isLargeZoom ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5'} font-black uppercase bg-slate-100 text-slate-700 rounded border border-slate-300 shrink-0`}>
                                                                        DESLIGADA
                                                                    </span>
                                                                )}
                                                                {prog.isCompleted && (
                                                                    <span className={`text-[9px] ${isLargeZoom ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5'} font-black uppercase bg-emerald-100 text-emerald-800 rounded border border-emerald-300 shrink-0`}>
                                                                        CONCLUÍDA
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Lado Direito do Topo: Mover / Estender Duração + Barra de Progresso Real */}
                                                            <div className="flex items-center gap-1 shrink-0 ml-auto select-none flex-nowrap" onClick={(e) => e.stopPropagation()}>
                                                                {!isViewer && !hasProductionStarted(op) && (
                                                                    <div className="flex items-center gap-0.5 bg-white/95 px-1 py-0.5 rounded border border-slate-200/90 shadow-xs">
                                                                        <button 
                                                                            onClick={() => handleShiftOP(op, -1)}
                                                                            className="text-slate-500 hover:text-orange-600 font-black text-xs transition-colors active:scale-90 px-0.5 cursor-pointer" 
                                                                            title="Mover OP 1 dia antes"
                                                                        >
                                                                            ◀
                                                                        </button>
                                                                        <span className="text-[8.5px] uppercase font-bold text-slate-500 tracking-wider">Mover</span>
                                                                        <button 
                                                                            onClick={() => handleShiftOP(op, 1)}
                                                                            className="text-slate-500 hover:text-orange-600 font-black text-xs transition-colors active:scale-90 px-0.5 cursor-pointer"
                                                                            title="Mover OP 1 dia depois"
                                                                        >
                                                                            ▶
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Pill de Duração / Extensão */}
                                                                <div 
                                                                    className="flex items-center gap-1 bg-white/95 px-1.5 py-0.5 rounded border border-slate-200/90 shadow-xs text-slate-700 select-none"
                                                                    title={hasProductionStarted(op) ? `OP iniciada em ${formatFriendlyDate(op.plannedStartDate)}.` : "Duração estimada em dias úteis"}
                                                                >
                                                                    <span className="text-[9px] text-slate-600 font-bold flex items-center gap-0.5">
                                                                        <span>⏱️</span>
                                                                        <span className="hidden sm:inline">{hasProductionStarted(op) ? 'Estender:' : 'Dur:'}</span>
                                                                    </span>
                                                                    {isViewer ? (
                                                                        <span className="font-black text-xs text-slate-900 px-0.5 font-mono">{op.estimatedDurationDays || 1}d</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-0.5">
                                                                            <button 
                                                                                onClick={() => handleAdjustDuration(op, -1)}
                                                                                className="w-3.5 h-3.5 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-black text-xs flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
                                                                                title={hasProductionStarted(op) ? "Reduzir extensão" : "Diminuir duração"}
                                                                            >
                                                                                -
                                                                            </button>
                                                                            <span className="font-black text-xs text-slate-900 px-0.5 font-mono">{op.estimatedDurationDays || 1}d</span>
                                                                            <button 
                                                                                onClick={() => handleAdjustDuration(op, 1)}
                                                                                className="w-3.5 h-3.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 font-black text-xs flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
                                                                                title="Estender duração (+1 dia)"
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Barra de Progresso Real Compacta e Precisa */}
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isViewer) return;
                                                                        handleOpenAdjustQuantity(op, { mode: 'total' });
                                                                    }}
                                                                    className={`flex items-center gap-1 bg-white/95 px-1.5 py-0.5 rounded border border-slate-200/90 shadow-xs min-w-[125px] sm:min-w-[155px] select-none ${
                                                                        isViewer ? 'cursor-default' : 'hover:bg-white transition-all hover:border-slate-300 cursor-pointer'
                                                                    }`}
                                                                    title={isViewer ? `Progresso: ${prog.produced.toLocaleString('pt-BR')} / ${prog.target.toLocaleString('pt-BR')} ${prog.unit} (${prog.pct}%)` : "Clique para ajustar quantidade total produzida da OP (Gestor)"}
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between text-[9.5px] font-mono font-bold text-slate-700 leading-none">
                                                                            <span className="truncate">
                                                                                {prog.produced.toLocaleString('pt-BR')} / {prog.target.toLocaleString('pt-BR')} {prog.unit}
                                                                            </span>
                                                                            <span className="font-black text-slate-900 ml-1">{prog.pct}%</span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden border border-slate-300 mt-0.5">
                                                                            <div 
                                                                                className={`h-full ${barProgressColor} rounded-full transition-all duration-500`}
                                                                                style={{ width: `${prog.pct}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {trefilaDashStats && (
                                                            <div className={`flex items-center justify-between gap-1.5 text-[10.5px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded border shadow-xs shrink-0 overflow-hidden ${
                                                                trefilaDashStats.isPaused 
                                                                    ? "bg-amber-50/95 border-amber-300 text-slate-800" 
                                                                    : "bg-blue-50/90 border-blue-200 text-slate-800"
                                                            }`}>
                                                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                                    <span className="text-blue-900 font-black text-xs truncate">
                                                                        Lote {trefilaDashStats.lotIdStr}
                                                                    </span>
                                                                    <span className="text-slate-600 font-bold text-[11px]">
                                                                        ({trefilaDashStats.lotWeight.toLocaleString('pt-BR')}kg)
                                                                    </span>
                                                                    {trefilaDashStats.isPaused && (
                                                                        <span className="inline-flex items-center gap-1 text-[8px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 border border-amber-300 shrink-0" title={trefilaDashStats.pauseReason || 'Pausado em parada / fim de turno'}>
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                                                            Pausado
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0 text-[10.5px] sm:text-[11px]">
                                                                    <span className="text-slate-600">
                                                                        Feito: <strong className={trefilaDashStats.isPaused ? "text-amber-900 font-black" : "text-blue-900 font-black"}>{formatDuration(trefilaDashStats.elapsedMs)}</strong>
                                                                    </span>
                                                                    <span className={`px-1.5 py-0.5 rounded font-black text-[9.5px] sm:text-[10px] ${
                                                                        trefilaDashStats.isDelayed 
                                                                            ? "bg-rose-100 text-rose-800 border border-rose-300 shadow-sm" 
                                                                            : trefilaDashStats.isPaused
                                                                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                                                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                                    }`}>
                                                                        {trefilaDashStats.isDelayed ? 'Atraso: ' : 'Rest: '}{formatDuration((trefilaDashStats.isDelayed ? trefilaDashStats.delayedSeconds : trefilaDashStats.remainingSeconds) * 1000)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Lotes Aguardando Pesagem (Trefila 1 e 2) */}
                                                        {isTrefila && pendingWeightLots.length > 0 && (
                                                            <div className="flex flex-col gap-1 shrink-0 select-none" onClick={(e) => e.stopPropagation()}>
                                                                {pendingWeightLots.length === 1 ? (
                                                                    (() => {
                                                                        const pLot = pendingWeightLots[0];
                                                                        const lotStock = stock.find(s => s.id === pLot.lotId || s.internalLot === pLot.lotId);
                                                                        const lotName = lotStock?.internalLot || pLot.lotId || '---';
                                                                        const entryWeight = lotStock?.initialQuantity || lotStock?.weight || 0;
                                                                        const endTimeStr = pLot.endTime ? new Date(pLot.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

                                                                        return (
                                                                            <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-amber-300 bg-amber-50/95 text-slate-800 shadow-xs shrink-0 overflow-hidden">
                                                                                <div className="flex items-center gap-2 min-w-0 truncate">
                                                                                    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                                                                        ⚖️ Aguarda Peso
                                                                                    </span>
                                                                                    <span className="text-amber-950 font-black text-xs sm:text-sm truncate">
                                                                                        Lote {lotName}
                                                                                    </span>
                                                                                    {entryWeight > 0 && (
                                                                                        <span className="text-slate-600 font-bold text-xs">
                                                                                            (~{entryWeight.toLocaleString('pt-BR')}kg)
                                                                                        </span>
                                                                                    )}
                                                                                    {endTimeStr && (
                                                                                        <span className="text-slate-500 font-normal text-[10px] hidden sm:inline">
                                                                                            às {endTimeStr}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {isViewer ? (
                                                                                    <span className="px-2.5 py-0.5 rounded-md bg-amber-200 text-amber-900 font-black text-[10px] uppercase tracking-wider shrink-0">
                                                                                        Aguardando Pesagem ⚖️
                                                                                    </span>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleOpenWeighLot(op, pLot.lotId, lotName, entryWeight);
                                                                                        }}
                                                                                        className="px-2.5 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider shadow-xs transition active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer"
                                                                                        title="Clique para lançar o peso deste lote"
                                                                                    >
                                                                                        <span>Pesar</span>
                                                                                        <span className="text-xs">⚖️</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-amber-300 bg-amber-50/95 text-slate-800 shadow-xs shrink-0 overflow-hidden">
                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                                                            <span className="inline-flex items-center gap-1 text-[9px] uppercase font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                                                                ⚖️ Aguarda Peso ({pendingWeightLots.length}):
                                                                            </span>
                                                                            {pendingWeightLots.map((pLot: any) => {
                                                                                const lotStock = stock.find(s => s.id === pLot.lotId || s.internalLot === pLot.lotId);
                                                                                const lotName = lotStock?.internalLot || pLot.lotId || '---';
                                                                                const entryWeight = lotStock?.initialQuantity || lotStock?.weight || 0;
                                                                                if (isViewer) {
                                                                                    return (
                                                                                        <span
                                                                                            key={pLot.lotId}
                                                                                            className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-white text-amber-950 border border-amber-300 shadow-xs"
                                                                                        >
                                                                                            <span>Lote {lotName}</span>
                                                                                            <span className="text-[9px] text-amber-600">⚖️</span>
                                                                                        </span>
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <button
                                                                                        key={pLot.lotId}
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleOpenWeighLot(op, pLot.lotId, lotName, entryWeight);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-xs transition active:scale-95 cursor-pointer"
                                                                                        title={`Clique para pesar Lote ${lotName}`}
                                                                                    >
                                                                                        <span>Lote {lotName}</span>
                                                                                        <span className="text-[9px] text-amber-600">⚖️</span>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Faixa de Segmentação Diária da OP (Produção por dia alinhada às colunas) */}
                                                        <div 
                                                            className="grid gap-0.5 p-0.5 bg-slate-100/90 rounded-lg border border-slate-200 flex-1 min-h-[56px]"
                                                            style={{ gridTemplateColumns: `repeat(${spanColumns}, minmax(0, 1fr))` }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {Array.from({ length: spanColumns }).map((_, idx) => {
                                                                const dayIdx = colStart + idx;
                                                                const currentDay = weekDays[dayIdx];
                                                                const dayStats = getOpDayStats(op, currentDay, mach.name);
                                                                const dayColName = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][dayIdx] || '';
                                                                const isEvenDayCol = dayIdx % 2 === 0; // Seg (0), Qua (2), Sex (4)

                                                                const hasRealPastProd = dayStats.isPast && dayStats.produced > 0;
                                                                const isIdlePast = dayStats.isPast && dayStats.produced === 0;

                                                                const activeMachOp = getMachineOperator(mach.name);
                                                                const isDayCardStopped = dayStats.isToday && Boolean(activeMachOp) && !prog.isOffline && (
                                                                    (prog.isLive && (prog.isStopped || prog.isPrep)) ||
                                                                    dayStats.isMachineStoppedNow ||
                                                                    Boolean(liveMach && (liveMach.state === 'stopped' || liveMach.state === 'prep'))
                                                                );

                                                                const dayStopReason = (prog.isLive && (prog.isStopped || prog.isPrep) && prog.downtimeReason)
                                                                    || (liveMach && (liveMach.state === 'stopped' || liveMach.state === 'prep') ? liveMach.reason : '')
                                                                    || (trefilaDashStats?.isPaused ? trefilaDashStats.pauseReason : '')
                                                                    || 'Parada';

                                                                const isDayStopExceeded = isDowntimeOverLimit || Boolean((liveMach as any)?.isOverLimit);
                                                                const isDayPrepState = (prog.isLive && prog.isPrep) || (liveMach?.state === 'prep');

                                                                const stopDurationMs = (liveMach && (liveMach.state === 'stopped' || liveMach.state === 'prep') && liveMach.durationMs > 0)
                                                                    ? liveMach.durationMs
                                                                    : (prog.downtimeDurationMs > 0 ? prog.downtimeDurationMs : 0);

                                                                const stopTimerFormatted = stopDurationMs > 0 
                                                                    ? formatDuration(stopDurationMs) 
                                                                    : (dayStats.downtimeFormatted || '00:00:00');

                                                                return (
                                                                    <div 
                                                                        key={dayIdx} 
                                                                        onClick={() => {
                                                                            if (isViewer) return;
                                                                            setSelectedDailyReport({
                                                                                op,
                                                                                date: currentDay,
                                                                                dateStr: formatDateString(currentDay),
                                                                                dayName: dayColName,
                                                                                produced: dayStats.produced,
                                                                                unit: dayStats.unit,
                                                                                dayStats
                                                                            });
                                                                        }}
                                                                        className={`[container-type:inline-size] flex items-center justify-between p-1 sm:p-1.5 rounded-lg border text-left transition-all select-none h-full min-h-0 overflow-hidden ${
                                                                            isViewer ? 'cursor-default' : 'cursor-pointer hover:shadow-lg hover:brightness-95 active:scale-[0.99]'
                                                                        } ${
                                                                            dayStats.isToday 
                                                                                ? isDayCardStopped
                                                                                    ? (isDayStopExceeded
                                                                                        ? 'bg-rose-50 border-2 border-rose-600 text-rose-950 shadow-md ring-2 ring-rose-400 animate-pulse'
                                                                                        : 'bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400 animate-pulse')
                                                                                    : dayStats.status === 'live'
                                                                                        ? 'bg-gradient-to-br from-[#93C5FD] via-[#60A5FA] to-[#3B82F6] border-2 border-blue-800 text-blue-950 shadow-md ring-2 ring-blue-500/80 hover:border-blue-900'
                                                                                        : dayStats.produced > 0
                                                                                            ? 'bg-emerald-50/85 border-2 border-emerald-400 text-emerald-950 shadow-xs hover:border-emerald-500 hover:bg-emerald-100/70'
                                                                                            : 'bg-[#FEFCE8]/90 border-2 border-dashed border-amber-300/90 text-amber-950 shadow-2xs hover:bg-[#FEF9C3] hover:border-amber-400'
                                                                                : dayStats.isPast
                                                                                    ? hasRealPastProd
                                                                                        ? 'bg-emerald-50/85 border-2 border-emerald-400 text-emerald-950 shadow-xs hover:border-emerald-500 hover:bg-emerald-100/70'
                                                                                        : 'bg-slate-50/70 border border-slate-200 text-slate-400 hover:border-slate-300'
                                                                                    : 'bg-[#FEFCE8]/90 border-2 border-dashed border-amber-300/90 text-amber-950 shadow-2xs hover:bg-[#FEF9C3] hover:border-amber-400'
                                                                        }`}
                                                                        title={isViewer ? `Produção de ${dayColName} ${formatFriendlyDate(currentDay)}: ${dayStats.produced.toLocaleString('pt-BR')} ${dayStats.unit}` : `Clique para ver paradas e relatório de ${dayColName} ${formatFriendlyDate(currentDay)}`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2 min-w-0 w-full h-full">
                                                                            {dayStats.isHoliday && dayStats.produced === 0 ? (
                                                                                <div className="flex items-center justify-center w-full">
                                                                                    <span className={`${isLargeZoom ? 'text-sm' : 'text-xs'} font-black text-rose-600 font-mono tracking-tight`}>
                                                                                        Folga / Feriado
                                                                                    </span>
                                                                                </div>
                                                                            ) : isDayCardStopped ? (
                                                                                /* Layout Especial em Caso de Parada / Preparação: Destaque total para o Motivo da Parada em largura total com Ticker inteligente, engrenagem parada e luz de alerta */
                                                                                <div className="flex flex-col justify-between w-full h-full min-w-0 p-1 gap-1 select-none">
                                                                                    {/* Top Row: Engrenagem Parada + Sinal de Alerta com Luz Vermelha Pulsante */}
                                                                                    <div className="flex items-center justify-between gap-1.5 w-full px-0.5">
                                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                                            {/* Engrenagem Estática / Travada */}
                                                                                            <div className={`relative flex items-center justify-center shrink-0 ${isLargeZoom ? 'w-5 h-5' : 'w-4 h-4'}`} title="Máquina Parada / Interrompida">
                                                                                                <svg 
                                                                                                    className={`${isLargeZoom ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} ${isDayStopExceeded ? 'text-rose-700' : 'text-amber-800'} drop-shadow-2xs`} 
                                                                                                    viewBox="0 0 24 24" 
                                                                                                    fill="currentColor"
                                                                                                >
                                                                                                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.65.07-.97 0-.32-.03-.66-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 13.5 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.31-.07.65-.07.97 0 .32.03.65.07.97l-2.11 1.63c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.63Z" />
                                                                                                </svg>
                                                                                                <span className="absolute -bottom-0.5 -right-0.5 text-[8px] sm:text-[9px] leading-none">⛔</span>
                                                                                            </div>

                                                                                            {/* Tag Máquina Parada com Pulso Vermelho */}
                                                                                            <div className={`flex items-center gap-1 px-1.5 py-0.2 rounded-full ${
                                                                                                isDayStopExceeded 
                                                                                                    ? 'bg-rose-900/15 border border-rose-600/30' 
                                                                                                    : 'bg-amber-900/15 border border-amber-600/30'
                                                                                            } backdrop-blur-2xs shadow-2xs`}>
                                                                                                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                                                                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDayStopExceeded ? 'bg-rose-500' : 'bg-amber-500'} opacity-75`} />
                                                                                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 ${isDayStopExceeded ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.9)]' : 'bg-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.9)]'}`} />
                                                                                                </span>
                                                                                                <span className={`${isLargeZoom ? 'text-[8.5px] sm:text-[9.5px]' : 'text-[7px] sm:text-[7.5px]'} font-black uppercase tracking-wider ${isDayStopExceeded ? 'text-rose-950' : 'text-amber-950'} font-mono leading-none`}>
                                                                                                    {isDayStopExceeded ? 'Parada Crítica' : isDayPrepState ? 'Preparação' : 'Máquina Parada'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>

                                                                                        <span className={`${isLargeZoom ? 'text-xs' : 'text-[10px]'} animate-bounce shrink-0`}>
                                                                                            {isDayStopExceeded ? '🚨' : '⚠️'}
                                                                                        </span>
                                                                                    </div>

                                                                                    {/* Center: Faixa de Alerta com Motivo da Parada Centralizado */}
                                                                                    <div className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg border shadow-xs min-w-0 w-full overflow-hidden ${
                                                                                        isDayStopExceeded
                                                                                            ? 'bg-rose-100/95 text-rose-950 border-rose-400 ring-1 ring-rose-400/40'
                                                                                            : isDayPrepState
                                                                                                ? 'bg-amber-100/95 text-amber-950 border-amber-400 ring-1 ring-amber-400/40'
                                                                                                : 'bg-amber-100/95 text-amber-950 border-amber-400 ring-1 ring-amber-400/40'
                                                                                    }`}>
                                                                                        <div className="min-w-0 flex-1 overflow-hidden text-center">
                                                                                            <PCPTickerText 
                                                                                                text={dayStopReason.toUpperCase()}
                                                                                                className={`${isLargeZoom ? 'text-xs sm:text-[13px]' : 'text-[10px] sm:text-[11px]'} font-black uppercase tracking-tight text-slate-900 leading-tight`}
                                                                                            />
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Bottom Row: Produção Feita vs Cronômetro de Tempo Parado */}
                                                                                    <div className="flex items-center justify-between gap-1 min-w-0 w-full px-0.5">
                                                                                        {/* Lado Esquerdo: Quantidade Produzida */}
                                                                                        <div className="flex items-baseline gap-1 min-w-0 shrink-0">
                                                                                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
                                                                                                Prod:
                                                                                            </span>
                                                                                            <div className="flex items-baseline gap-0.5">
                                                                                                {isGestor && !dayStats.isFuture && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => handleQuickAdjustShift(e, op, dayStats, currentDay, isTrefila ? -50 : -1)}
                                                                                                        className="w-4 h-4 rounded bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 text-xs font-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90 cursor-pointer select-none shrink-0 mr-0.5"
                                                                                                        title={`Subtrair 1 ${dayStats.unit}`}
                                                                                                    >
                                                                                                        -
                                                                                                    </button>
                                                                                                )}
                                                                                                <span 
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        if (isViewer) return;
                                                                                                        handleOpenAdjustQuantity(op, {
                                                                                                            mode: 'shift',
                                                                                                            dayStats: dayStats,
                                                                                                            targetDay: currentDay,
                                                                                                            dayColName: dayColName,
                                                                                                            operatorName: dayStats.operatorName,
                                                                                                            shiftProduced: dayStats.produced
                                                                                                        });
                                                                                                    }}
                                                                                                    className={`font-black font-mono text-base sm:text-lg md:text-xl text-slate-950 tracking-tight whitespace-nowrap leading-none ${
                                                                                                        isViewer ? '' : 'cursor-pointer hover:underline'
                                                                                                    }`}
                                                                                                    title={isViewer ? `Produção: ${dayStats.produced.toLocaleString('pt-BR')} ${dayStats.unit}` : "Ajustar contagem"}
                                                                                                >
                                                                                                    {dayStats.produced.toLocaleString('pt-BR')}
                                                                                                </span>
                                                                                                <span className="text-xs font-black text-slate-700 font-mono">
                                                                                                    {dayStats.unit}
                                                                                                </span>
                                                                                                {isGestor && !dayStats.isFuture && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => handleQuickAdjustShift(e, op, dayStats, currentDay, isTrefila ? 50 : 1)}
                                                                                                        className="w-4 h-4 rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 border border-slate-200 text-xs font-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90 cursor-pointer select-none shrink-0 ml-0.5"
                                                                                                        title={`Adicionar 1 ${dayStats.unit}`}
                                                                                                    >
                                                                                                        +
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Lado Direito: Cronômetro Parado em Destaque */}
                                                                                        <div className={`flex items-center gap-1 font-mono px-1.5 py-0.5 rounded-md border shadow-2xs shrink-0 ${
                                                                                            isDayStopExceeded
                                                                                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                                                                                : 'bg-amber-50 text-amber-900 border-amber-300'
                                                                                        }`}>
                                                                                            <span className="text-[8.5px] sm:text-[9.5px] font-bold">⏱️</span>
                                                                                            <strong className="text-xs sm:text-[13px] font-black tracking-tight">
                                                                                                {stopTimerFormatted}
                                                                                            </strong>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex flex-col items-center justify-center min-w-0 flex-1 overflow-hidden h-full">
                                                                                    {/* Engrenagens Animadas e Status "Em Produção" */}
                                                                                    {dayStats.isToday && !isDayCardStopped && dayStats.status === 'live' && (
                                                                                        <div className={`flex items-center gap-1.5 select-none ${isLargeZoom ? 'mb-1' : 'mb-0.5'}`}>
                                                                                            {/* Par de Engrenagens Intertravadas Girando */}
                                                                                            <div className={`relative flex items-center justify-center shrink-0 ${isLargeZoom ? 'w-6 h-5' : 'w-4 h-3.5'}`} title="Máquina em Produção Ativa">
                                                                                                {/* Engrenagem Maior (Sentido Horário) */}
                                                                                                <svg 
                                                                                                    className={`${isLargeZoom ? 'w-4.5 h-4.5 -top-0.5 -right-0.5' : 'w-3 h-3 -top-0.5 -right-0.5'} text-blue-950 animate-spin absolute drop-shadow-xs`} 
                                                                                                    style={{ animationDuration: '3.5s' }}
                                                                                                    viewBox="0 0 24 24" 
                                                                                                    fill="currentColor"
                                                                                                >
                                                                                                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.65.07-.97 0-.32-.03-.66-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 13.5 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.31-.07.65-.07.97 0 .32.03.65.07.97l-2.11 1.63c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.63Z" />
                                                                                                </svg>
                                                                                                {/* Engrenagem Menor (Sentido Anti-Horário) */}
                                                                                                <svg 
                                                                                                    className={`${isLargeZoom ? 'w-3.5 h-3.5 -bottom-0.5 -left-0.5' : 'w-2.5 h-2.5 -bottom-0.5 -left-0.5'} text-blue-800 animate-spin absolute drop-shadow-xs`} 
                                                                                                    style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}
                                                                                                    viewBox="0 0 24 24" 
                                                                                                    fill="currentColor"
                                                                                                >
                                                                                                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.65.07-.97 0-.32-.03-.66-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 13.5 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.31-.07.65-.07.97 0 .32.03.65.07.97l-2.11 1.63c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.63Z" />
                                                                                                </svg>
                                                                                            </div>

                                                                                            {/* Tag Em Produção com Pulso Verde */}
                                                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-900/15 border border-blue-900/20 backdrop-blur-2xs shadow-2xs">
                                                                                                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                                                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                                                                                                </span>
                                                                                                <span className={`${isLargeZoom ? 'text-[8.5px] sm:text-[9.5px]' : 'text-[7px] sm:text-[7.5px]'} font-black uppercase tracking-wider text-blue-950 font-mono leading-none`}>
                                                                                                    Em Produção
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Quantidade Produzida */}
                                                                                    {(() => {
                                                                                        const formattedQtyStr = dayStats.isFuture ? `~${dayStats.produced.toLocaleString('pt-BR')}` : dayStats.produced.toLocaleString('pt-BR');
                                                                                        const isVeryLongQty = formattedQtyStr.length >= 6; // ex: 10.315 ou 22.000
                                                                                        const isLongQty = formattedQtyStr.length >= 4; // ex: 2.000 ou 6.929

                                                                                        const qtyTextSizeClass = dayStats.hasTimeStats
                                                                                            ? (isFullscreenZoom
                                                                                                ? (isVeryLongQty ? 'text-xl sm:text-2xl lg:text-3xl' : isLongQty ? 'text-2xl sm:text-3xl lg:text-[34px]' : 'text-2xl sm:text-3xl lg:text-4xl')
                                                                                                : isLargeZoom
                                                                                                    ? (isVeryLongQty ? 'text-base sm:text-lg lg:text-xl' : isLongQty ? 'text-lg sm:text-xl lg:text-2xl' : 'text-xl sm:text-2xl lg:text-3xl')
                                                                                                    : (isVeryLongQty ? 'text-sm sm:text-base' : isLongQty ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'))
                                                                                            : (isFullscreenZoom
                                                                                                ? (isVeryLongQty ? 'text-2xl sm:text-3.5xl lg:text-4xl' : 'text-3xl sm:text-4xl lg:text-5xl')
                                                                                                : isLargeZoom
                                                                                                    ? (isVeryLongQty ? 'text-xl sm:text-2.5xl lg:text-3xl' : 'text-2xl sm:text-3xl lg:text-4xl')
                                                                                                    : (isVeryLongQty ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'));

                                                                                        return (
                                                                                            <div className="flex items-center justify-center gap-1 min-w-0 w-full overflow-hidden">
                                                                                                {/* Botão Menos Rápido para Gestor */}
                                                                                                {isGestor && !dayStats.isFuture && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => handleQuickAdjustShift(e, op, dayStats, currentDay, isTrefila ? -50 : -1)}
                                                                                                        className="w-4 h-4 rounded bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-xs font-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90 cursor-pointer select-none shrink-0"
                                                                                                        title={`Subtrair 1 ${dayStats.unit} deste turno`}
                                                                                                    >
                                                                                                        -
                                                                                                    </button>
                                                                                                )}

                                                                                                <div 
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        if (isViewer) return;
                                                                                                        handleOpenAdjustQuantity(op, {
                                                                                                            mode: 'shift',
                                                                                                            dayStats: dayStats,
                                                                                                            targetDay: currentDay,
                                                                                                            dayColName: dayColName,
                                                                                                            operatorName: dayStats.operatorName,
                                                                                                            shiftProduced: dayStats.produced
                                                                                                        });
                                                                                                    }}
                                                                                                    className={`flex items-baseline justify-center gap-0.5 select-none min-w-0 ${
                                                                                                        isViewer ? 'cursor-default' : 'cursor-pointer group/qty hover:bg-white/80 px-1 py-0.5 rounded-md transition-all'
                                                                                                    }`}
                                                                                                    title={isViewer ? `Total produzido no turno: ${dayStats.produced.toLocaleString('pt-BR')} ${dayStats.unit}` : "Clique para abrir ajuste de contagem (Gestor)"}
                                                                                                >
                                                                                                    <span className={`${qtyTextSizeClass} font-mono font-black tracking-tight whitespace-nowrap leading-none ${
                                                                                                        dayStats.isToday 
                                                                                                            ? 'text-blue-950' 
                                                                                                            : dayStats.isPast 
                                                                                                                ? 'text-emerald-600/70 font-bold' 
                                                                                                                : 'text-amber-600/60 font-bold'
                                                                                                    }`}>
                                                                                                        {formattedQtyStr}
                                                                                                    </span>
                                                                                                    <span className={`${isFullscreenZoom ? (isVeryLongQty ? 'text-xs sm:text-sm' : 'text-sm sm:text-base') : 'text-xs sm:text-sm'} font-semibold font-mono shrink-0 ml-0.5 leading-none ${
                                                                                                        dayStats.isToday 
                                                                                                            ? 'text-blue-700 font-black' 
                                                                                                            : dayStats.isPast 
                                                                                                                ? 'text-emerald-500/60' 
                                                                                                                : 'text-amber-500/55'
                                                                                                    }`}>
                                                                                                        {dayStats.unit}
                                                                                                    </span>
                                                                                                    {!isViewer && (
                                                                                                        <span className="opacity-0 group-hover/qty:opacity-100 text-[9px] text-orange-500 transition-opacity shrink-0 ml-0.5" title="Ajustar Quantidade">✏️</span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* Botão Mais Rápido para Gestor */}
                                                                                                {isGestor && !dayStats.isFuture && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => handleQuickAdjustShift(e, op, dayStats, currentDay, isTrefila ? 50 : 1)}
                                                                                                        className="w-4 h-4 rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 text-xs font-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90 cursor-pointer select-none shrink-0"
                                                                                                        title={`Adicionar 1 ${dayStats.unit} a este turno`}
                                                                                                    >
                                                                                                        +
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            )}

                                                                            {/* Estatística de Tempo (Efetivo e Parado) - Calibração Responsiva e Sem Cortes */}
                                                                            {!isDayCardStopped && dayStats.hasTimeStats && (
                                                                                <div 
                                                                                    className={`flex flex-col justify-center ${isFullscreenZoom ? 'gap-0.5 px-2 py-0.5 min-w-[115px] sm:min-w-[130px] lg:min-w-[140px]' : isLargeZoom ? 'gap-0.5 px-1.5 py-0.5 min-w-[105px] sm:min-w-[120px]' : 'gap-0.5 px-1.5 py-0.5 min-w-[85px] sm:min-w-[95px]'} rounded-xl border shrink-0 select-none pointer-events-none transition-all h-full max-h-full overflow-hidden shadow-xs ${
                                                                                        dayStats.isMachineStoppedNow
                                                                                            ? 'bg-amber-50/95 border-amber-300 ring-1 ring-amber-400/30 text-amber-900'
                                                                                            : (dayStats.isToday && dayStats.status === 'live')
                                                                                                ? 'bg-white/95 border-2 border-blue-400 shadow-xs ring-1 ring-blue-300/60 text-blue-950'
                                                                                                : 'bg-emerald-50/60 border border-emerald-200/60 text-emerald-700/80 shadow-2xs'
                                                                                    }`}
                                                                                    title={`Cronômetro do Turno (Tempo Real):\n⚡ Efetivo: ${dayStats.effectiveFormatted} ${dayStats.isProducingNow ? '(Correndo)' : '(Pausado)'}\n⏱️ Parado: ${dayStats.downtimeFormatted} ${dayStats.isMachineStoppedNow ? '(Correndo)' : '(Pausado)'}${dayStats.ratePerHour > 0 ? `\n🚀 Ritmo: ${dayStats.rateFormatted}` : ''}${dayStats.speedValue > 0 ? `\n⚡ ${dayStats.speedUnit === 's/pç' ? 'Tempo por Peça' : 'Velocidade'}: ${dayStats.speedFormatted} ${dayStats.speedUnit}` : ''}`}
                                                                                >
                                                                                    <div className={`${isFullscreenZoom ? 'text-[9px] sm:text-[9.5px] pb-0.2' : isLargeZoom ? 'text-[8px] sm:text-[8.5px] pb-0.2' : 'text-[7px] sm:text-[7.5px] pb-0.2'} font-black uppercase tracking-wider border-b text-center leading-none ${
                                                                                        dayStats.isToday ? 'text-blue-700 border-blue-200' : 'text-emerald-500/70 border-emerald-100'
                                                                                    }`}>
                                                                                        Estatísticas
                                                                                    </div>
                                                                                    <div className={`grid grid-cols-[auto_1fr] items-center ${isFullscreenZoom ? 'gap-x-2 gap-y-0 text-[11px] sm:text-xs' : isLargeZoom ? 'gap-x-1.5 gap-y-0 text-[10px] sm:text-[11px]' : 'gap-x-1 gap-y-0 text-[8px] sm:text-[8.5px]'} leading-tight font-mono`}>
                                                                                        <span className={`font-black uppercase tracking-wider text-left ${dayStats.isToday ? 'text-blue-800' : 'text-emerald-600/70'}`}>EF:</span>
                                                                                        <strong className={`font-black ${isFullscreenZoom ? 'text-[15.5px] sm:text-[17px] lg:text-[18.5px]' : isLargeZoom ? 'text-[13.5px] sm:text-[15px] lg:text-[16px]' : 'text-[10.5px] sm:text-[11.5px]'} text-right leading-none ${dayStats.isToday ? 'text-emerald-700' : 'text-emerald-600/80'}`}>{dayStats.effectiveFormatted}</strong>
                                                                                        <span className={`font-black uppercase tracking-wider text-left ${dayStats.isToday ? 'text-blue-800' : 'text-emerald-600/70'}`}>PAR:</span>
                                                                                        <strong className={`font-black ${isFullscreenZoom ? 'text-[15.5px] sm:text-[17px] lg:text-[18.5px]' : isLargeZoom ? 'text-[13.5px] sm:text-[15px] lg:text-[16px]' : 'text-[10.5px] sm:text-[11.5px]'} text-right leading-none ${dayStats.isMachineStoppedNow ? 'text-amber-700 font-extrabold' : dayStats.isToday ? 'text-slate-600' : 'text-emerald-600/60'}`}>{dayStats.downtimeFormatted}</strong>
                                                                                    </div>
                                                                                    <div className={`flex flex-col border-t border-slate-200/70 ${isLargeZoom ? 'gap-0.2 pt-0.5' : 'gap-0.2 pt-0.2'}`}>
                                                                                        {dayStats.ratePerHour > 0 && (
                                                                                            <div className="flex items-center justify-between gap-1 leading-none font-mono">
                                                                                                <span className={`${isFullscreenZoom ? 'text-[10.5px] sm:text-xs' : isLargeZoom ? 'text-[9.5px] sm:text-[10.5px]' : 'text-[8px]'} text-slate-500`}>🚀</span>
                                                                                                <strong className={`text-slate-800 font-black ${isFullscreenZoom ? 'text-[11px] sm:text-xs' : isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[9px] sm:text-[9.5px]'} text-right leading-none`}>{dayStats.ratePerHour.toLocaleString('pt-BR')} <span className={`${isFullscreenZoom ? 'text-[9px] sm:text-[9.5px]' : isLargeZoom ? 'text-[8px] sm:text-[8.5px]' : 'text-[7px] sm:text-[7.5px]'} font-semibold text-slate-500`}>{dayStats.rateUnit}</span></strong>
                                                                                            </div>
                                                                                        )}
                                                                                        {Boolean(dayStats.speedUnit) && (
                                                                                            <div className="flex items-center justify-between gap-1 leading-none font-mono">
                                                                                                <span className={`${isFullscreenZoom ? 'text-[10.5px] sm:text-xs' : isLargeZoom ? 'text-[9.5px] sm:text-[10.5px]' : 'text-[8px]'} text-slate-500`}>⚡</span>
                                                                                                <strong className={`text-slate-800 font-black ${isFullscreenZoom ? 'text-[11px] sm:text-xs' : isLargeZoom ? 'text-[10px] sm:text-[11px]' : 'text-[9px] sm:text-[9.5px]'} text-right leading-none`}>{dayStats.speedValue > 0 ? dayStats.speedFormatted : '—'} <span className={`${isFullscreenZoom ? 'text-[9px] sm:text-[9.5px]' : isLargeZoom ? 'text-[8px] sm:text-[8.5px]' : 'text-[7px] sm:text-[7.5px]'} font-semibold text-slate-500`}>{dayStats.speedUnit}</span></strong>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {/* RODAPÉ DE TOTAIS DIÁRIOS (SOMA DE TODAS AS MÁQUINAS: PLANEJADO vs PRODUZIDO EM KG) */}
                        <div className="pcp-timeline-grid relative z-30 shrink-0 bg-white/95 backdrop-blur-md border-t-2 border-orange-500 shadow-[0_-4px_20px_rgba(11,43,104,0.12)]">
                            {/* Coluna 1: Indicador Geral e Resumo da Semana */}
                            <div className="px-3 py-1 flex items-center justify-between border-r border-slate-700/60 border-l-4 border-l-orange-500 sticky left-0 z-40 bg-gradient-to-br from-[#092354] via-[#0C2B68] to-[#0A1F48] text-white shadow-md select-none min-h-[44px] overflow-hidden">
                                <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1 leading-none">
                                        <span>📊 TOTAIS</span>
                                    </span>
                                    <span className="text-[9.5px] sm:text-[10px] font-mono text-blue-200/80 leading-tight mt-1 truncate">
                                        {selectedMachinesFilter.length} Máquinas
                                    </span>
                                </div>
                                
                                <div className="flex flex-col items-end justify-center shrink-0">
                                    {weekDailyTotals.weekTotalPlannedKg > 0 && (
                                        <div className="flex items-center gap-1 font-mono leading-none mb-0.5">
                                            <span className="text-[8.5px] uppercase font-bold text-slate-300">Meta:</span>
                                            <span className="text-xs sm:text-sm font-black text-orange-400">{weekDailyTotals.weekPercent}%</span>
                                        </div>
                                    )}
                                    <div className="text-[10px] sm:text-xs font-mono font-black text-emerald-300 leading-none">
                                        {weekDailyTotals.weekTotalProducedKg.toLocaleString('pt-BR')} kg
                                    </div>
                                </div>
                            </div>

                            {/* Colunas 2 a 6: Cada dia da semana (Segunda a Sexta) - Prod e Plan em linha e com fontes ampliadas */}
                            {weekDailyTotals.days.map((d, index) => {
                                const isEvenCol = index % 2 === 0;
                                return (
                                    <div 
                                        key={index} 
                                        className={`px-3 py-1 flex items-center justify-between border-l text-left transition-all select-none gap-2 min-h-[44px] ${
                                            d.isToday 
                                                ? (isEvenCol
                                                    ? 'bg-[#CBDDF2] border-l-blue-500 shadow-inner'
                                                    : 'bg-blue-50/90 border-l-blue-500 shadow-inner') 
                                                : d.isHoliday 
                                                    ? 'bg-rose-50/70 border-l-rose-300' 
                                                    : isEvenCol
                                                        ? 'bg-[#CBDDF2] border-l-slate-400/80'
                                                        : 'bg-white border-l-slate-200'
                                        }`}
                                    >
                                        {/* Produzido */}
                                        <div className="flex items-center gap-1.5 font-mono leading-none min-w-0">
                                            <span className="text-[9.5px] sm:text-[10.5px] lg:text-xs text-slate-500 uppercase font-black shrink-0">PROD:</span>
                                            <strong className={`text-sm sm:text-base lg:text-lg font-black tracking-tight truncate ${d.dayProducedKg > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                {d.dayProducedKg > 0 ? `${d.dayProducedKg.toLocaleString('pt-BR')} kg` : d.isFuture ? '-' : '0 kg'}
                                            </strong>
                                        </div>

                                        {/* Divisor vertical */}
                                        <div className="h-5 w-px bg-slate-300 shrink-0" />

                                        {/* Programado / Planejado */}
                                        <div className="flex items-center gap-1.5 font-mono leading-none min-w-0">
                                            <span className="text-[9.5px] sm:text-[10.5px] lg:text-xs text-slate-500 uppercase font-black shrink-0">PLAN:</span>
                                            <strong className="text-sm sm:text-base lg:text-lg font-black text-blue-950 tracking-tight truncate">
                                                {d.dayPlannedKg > 0 ? `~${d.dayPlannedKg.toLocaleString('pt-BR')} kg` : '-'}
                                            </strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            {/* ========================================================================= */}
            {/* MODAL 1: CRIAR NOVA ORDEM DIRETA NO PCP COM TODAS AS REGRAS DAS MÁQUINAS */}
            {/* ========================================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade p-2 sm:p-4 overflow-y-auto">
                    <div className={`w-full ${createCategory === 'Treliça' ? 'max-w-6xl' : 'max-w-5xl'} pcp-glass-card rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col gap-4 text-slate-100 shadow-2xl my-auto transition-all duration-300`}>
                        
                        {/* Topo do Modal */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                    createCategory === 'Trefila' ? 'bg-cyan-500/15 text-[#00E5FF]' :
                                    createCategory === 'Treliça' ? 'bg-emerald-500/15 text-emerald-400' :
                                    'bg-purple-500/15 text-purple-400'
                                }`}>
                                    <PlusIcon className="w-5 h-5 stroke-[3]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                                        Criar e Programar Ordem de Produção
                                        {isMachineLocked && (
                                            <span className={`text-xs px-2.5 py-0.5 rounded-md border font-mono ${
                                                createCategory === 'Trefila' ? 'bg-cyan-500/20 text-[#00E5FF] border-cyan-500/40' :
                                                createCategory === 'Treliça' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                                                'bg-purple-500/20 text-purple-400 border-purple-500/40'
                                            }`}>
                                                {createMachine}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {isMachineLocked
                                            ? `Programação direta vinculada à ${createMachine} (${createCategory === 'Trefila' ? 'Fio Máquina' : createCategory === 'Treliça' ? 'CA-60' : 'Malha'})`
                                            : 'Selecione a máquina e os lotes reais de matéria-prima para consumo'
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Seletor de Categoria (Tabs) - Apenas se não houver máquina fixada */}
                        {!isMachineLocked ? (
                            <div className="grid grid-cols-3 gap-2 bg-[#08131B] p-1.5 rounded-xl border border-white/5 text-xs font-black">
                                <button
                                    type="button"
                                    onClick={() => handleChangeCategory('Trefila')}
                                    className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${
                                        createCategory === 'Trefila'
                                            ? 'bg-cyan-500/25 text-[#00E5FF] border border-[#00E5FF]/40 shadow-lg shadow-cyan-500/10'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    ⚙️ Trefila (Fio Máquina)
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleChangeCategory('Treliça')}
                                    className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${
                                        createCategory === 'Treliça'
                                            ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🏗️ Treliça (CA-60)
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleChangeCategory('Malha')}
                                    className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${
                                        createCategory === 'Malha'
                                            ? 'bg-purple-500/25 text-purple-400 border border-purple-500/40 shadow-lg shadow-purple-500/10'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🕸️ Malha
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-[#08131B] px-4 py-2.5 rounded-xl border border-white/5 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <span className="text-slate-400 uppercase tracking-wider text-[11px]">Máquina Selecionada no PCP:</span>
                                    <span className={`font-black uppercase px-2.5 py-0.5 rounded-lg border ${
                                        createCategory === 'Trefila' ? 'bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30' :
                                        createCategory === 'Treliça' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                        'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                    }`}>
                                        {createMachine} • {createCategory === 'Trefila' ? 'Processo Trefilação' : createCategory === 'Treliça' ? 'Processo Treliça' : 'Processo Malha'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                                    Configuração exclusiva para esta máquina
                                </span>
                            </div>
                        )}

                        {/* ========================================================== */}
                        {/* FLUXO 1: TREFILA (Regras idênticas a ProductionOrder.tsx) */}
                        {/* ========================================================== */}
                        {createCategory === 'Trefila' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                
                                {/* Coluna Esquerda: Dados da Ordem & Programação */}
                                <div className="lg:col-span-5 flex flex-col gap-3.5 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-xs font-black uppercase text-[#00E5FF] tracking-wider border-b border-white/5 pb-2">
                                        1. Parâmetros da OP
                                    </h4>

                                    {/* Máquina Destino */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máquina Destino</label>
                                        {isMachineLocked ? (
                                            <div className="w-full bg-[#07131B] border border-cyan-500/30 rounded-xl py-2 px-3 text-xs text-[#00E5FF] font-black flex items-center justify-between">
                                                <span>{createMachine}</span>
                                                <span className="text-[9px] text-cyan-400/90 bg-cyan-500/15 px-2 py-0.5 rounded font-mono uppercase tracking-wider">Fixada</span>
                                            </div>
                                        ) : (
                                            <select
                                                value={createMachine}
                                                onChange={(e) => setCreateMachine(e.target.value)}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white font-bold"
                                            >
                                                <option value="Trefila 1">Trefila 1</option>
                                                <option value="Trefila 2">Trefila 2</option>
                                            </select>
                                        )}
                                    </div>

                                    {/* Número da Ordem */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número da Ordem</label>
                                        <input
                                            type="text"
                                            value={createOrderNumber}
                                            onChange={(e) => setCreateOrderNumber(e.target.value)}
                                            placeholder="Ex: TR-1025"
                                            autoComplete="off"
                                            className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 focus:bg-[#07131B] focus:text-white text-white font-bold"
                                        />
                                    </div>

                                    {/* Ordem Fantasma Aperfeiçoada */}
                                    <div className="flex items-start gap-2.5 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <input
                                            type="checkbox"
                                            id="isGhostOrderPCP"
                                            checked={isGhostOrder}
                                            onChange={(e) => setIsGhostOrder(e.target.checked)}
                                            className="h-4 w-4 mt-0.5 rounded border-slate-700 bg-[#07131B] text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                                        />
                                        <div className="flex flex-col">
                                            <label htmlFor="isGhostOrderPCP" className="text-xs font-bold text-amber-400 cursor-pointer">
                                                Ordem Fantasma (Simulação / Sem reserva e sem baixa)
                                            </label>
                                            <span className="text-[10px] text-amber-300/80 leading-tight mt-0.5">
                                                {isGhostOrder 
                                                    ? '⚠️ Modo Fantasma Ativo: Os lotes de Fio Máquina devem ser selecionados obrigatoriamente para cálculo de tempo. Não reservará os lotes e não baixará o estoque ao concluir.'
                                                    : 'Ordem regular: os lotes serão reservados para a Trefila e baixados na produção.'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bitolas de Entrada e Saída */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Bitola de Entrada (Filtro Fio Máquina) */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitola Entrada (Fio Máq.)</label>
                                            <select
                                                value={inputBitolaFilter}
                                                onChange={(e) => {
                                                    setInputBitolaFilter(e.target.value as Bitola | '');
                                                    setSelectedLotIds([]);
                                                }}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-2.5 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white font-bold"
                                            >
                                                <option value="">Todas disponíveis</option>
                                                {availableFioMaquinaGauges.map(g => (
                                                    <option key={g} value={g}>{g} mm</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Bitola a Produzir */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitola Saída (CA-60)</label>
                                            <select
                                                value={targetBitola}
                                                onChange={(e) => setTargetBitola(e.target.value as Bitola)}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-2.5 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white font-bold"
                                            >
                                                {availableTrefilaGaugesData.length > 0 ? (
                                                    availableTrefilaGaugesData
                                                        .filter(g => {
                                                            if (!inputBitolaFilter) return true;
                                                            const inVal = parseFloat(inputBitolaFilter.replace(',', '.'));
                                                            const outVal = parseFloat(g.gauge.replace(',', '.'));
                                                            return outVal < inVal;
                                                        })
                                                        .map(g => {
                                                            const code = g.productCode || (g as any).code || '';
                                                            const desc = g.description || (g as any).gaugeDescription || '';
                                                            const label = desc
                                                                ? (code && !desc.startsWith(code) ? `[${code}] ${desc}` : desc)
                                                                : `${g.gauge} mm`;
                                                            return (
                                                                <option key={g.id || g.gauge} value={g.gauge}>
                                                                    {label}
                                                                </option>
                                                            );
                                                        })
                                                ) : (
                                                    availableTrefilaGauges
                                                        .filter(g => {
                                                            if (!inputBitolaFilter) return true;
                                                            const inVal = parseFloat(inputBitolaFilter.replace(',', '.'));
                                                            const outVal = parseFloat(g.replace(',', '.'));
                                                            return outVal < inVal;
                                                        })
                                                        .map(g => {
                                                            const cleanG = g.replace('mm', '').trim();
                                                            const matched = gauges.find((item: any) => {
                                                                const mat = (item.materialType || '').toLowerCase();
                                                                const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                                                                if (!isCa60) return false;
                                                                const itemClean = String(item.gauge || '').replace('mm', '').trim();
                                                                return item.gauge === g || itemClean === cleanG || parseFloat(itemClean.replace(',', '.')) === parseFloat(cleanG.replace(',', '.'));
                                                            });
                                                            const code = matched?.productCode || (matched as any)?.code || '';
                                                            const desc = matched?.description || (matched as any)?.gaugeDescription || '';
                                                            const label = desc
                                                                ? (code && !desc.startsWith(code) ? `[${code}] ${desc}` : desc)
                                                                : `${g} mm`;
                                                            return (
                                                                <option key={g} value={g}>{label}</option>
                                                            );
                                                        })
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Novos Parâmetros Operacionais de Trefilação */}
                                    <div className="bg-[#07131B]/70 p-3 rounded-xl border border-white/5 space-y-2.5">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                            <span className="text-[10px] font-black uppercase text-[#00E5FF] tracking-wider flex items-center gap-1.5">
                                                ⚡ Parâmetros da Máquina
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-mono">
                                                {trefilaProductionCalculations.massPerHour > 0 
                                                    ? `${trefilaProductionCalculations.massPerHour.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg/h teóricos`
                                                    : 'Informe a velocidade'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {/* Velocidade da Máquina */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider" title="Velocidade de produção da trefila">
                                                    Velocidade
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={trefilaSpeed}
                                                        onChange={(e) => setTrefilaSpeed(e.target.value)}
                                                        placeholder="8.5"
                                                        className="w-full bg-[#0B1D2A] border border-white/10 rounded-lg py-1.5 pl-2 pr-6 text-xs text-white font-bold focus:border-[#00E5FF]/50 focus:outline-none"
                                                    />
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono pointer-events-none">
                                                        m/s
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-500 font-mono truncate">
                                                    {trefilaProductionCalculations.speed > 0 
                                                        ? `~${(trefilaProductionCalculations.speed * 60).toFixed(0)} m/min` 
                                                        : '—'}
                                                </span>
                                            </div>

                                            {/* Tempo de Troca de Rolo */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider" title="Tempo médio gasto para trocar cada rolo">
                                                    Troca Rolo
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="120"
                                                        value={rollChangeTimeMin}
                                                        onChange={(e) => setRollChangeTimeMin(Math.max(0, parseInt(e.target.value) || 0))}
                                                        placeholder="10"
                                                        className="w-full bg-[#0B1D2A] border border-white/10 rounded-lg py-1.5 pl-2 pr-7 text-xs text-white font-bold focus:border-[#00E5FF]/50 focus:outline-none"
                                                    />
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono pointer-events-none">
                                                        min
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-500 font-mono truncate" title="Tempo por rolo">
                                                    p/ cada rolo
                                                </span>
                                            </div>

                                            {/* Tempo de Setup */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider" title="Tempo de troca de peças, fieiras e alinhamento inicial">
                                                    Setup Máq.
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="480"
                                                        value={setupTimeMin}
                                                        onChange={(e) => setSetupTimeMin(Math.max(0, parseInt(e.target.value) || 0))}
                                                        placeholder="30"
                                                        className="w-full bg-[#0B1D2A] border border-white/10 rounded-lg py-1.5 pl-2 pr-7 text-xs text-white font-bold focus:border-[#00E5FF]/50 focus:outline-none"
                                                    />
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono pointer-events-none">
                                                        min
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-500 font-mono truncate" title="Regulagem inicial">
                                                    ajuste inicial
                                                </span>
                                            </div>
                                        </div>

                                        {/* SETUP DE K-7s & ANÉIS DE TREFILAÇÃO */}
                                        <div className="pt-2 border-t border-white/10 space-y-2">
                                            {/* Cabeçalho da Seção K-7s */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                                                        <span>⚙️</span>
                                                        <span>K-7s & Anéis</span>
                                                    </span>
                                                    {resolvedInputBitola && k7Passes.length > 0 && (
                                                        <span className="text-[8px] text-slate-400 font-mono">
                                                            ({k7Passes.length} {k7Passes.length === 1 ? 'passe' : 'passes'})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Botões seletores de quantidade de K7s (exibidos quando houver bitola de entrada) */}
                                                {resolvedInputBitola && k7Passes.length > 0 && (
                                                    <div className="flex items-center bg-[#07131B] border border-white/10 rounded-lg p-0.5 gap-0.5">
                                                        {[1, 2, 3, 4].map(num => (
                                                            <button
                                                                key={num}
                                                                type="button"
                                                                onClick={() => handleSelectK7Count(num)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${
                                                                    k7Count === num
                                                                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                                }`}
                                                                title={`Configurar ${num} K-7${num > 1 ? 's' : ''}`}
                                                            >
                                                                {num} K-7{num > 1 ? 's' : ''}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Estado: Aguardando seleção do Fio Máquina de entrada */}
                                            {!resolvedInputBitola ? (
                                                <div className="bg-[#0B1D2A] border border-dashed border-amber-500/30 rounded-xl p-3 text-center flex flex-col items-center justify-center gap-1.5 animate-fade">
                                                    <div className="w-7 h-7 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-xs">
                                                        ⚡
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-300">
                                                        Aguardando Bitola de Entrada (Fio Máq.)
                                                    </span>
                                                    <p className="text-[9px] text-slate-400 leading-tight max-w-[270px]">
                                                        Selecione a bitola no campo acima ou marque um lote na tabela ao lado para calcular os K-7s, reduções e anéis.
                                                    </p>
                                                </div>
                                            ) : k7Passes.length === 0 ? (
                                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 text-center text-red-300 text-[10px] font-bold animate-fade">
                                                    ⚠️ A bitola de entrada ({resolvedInputBitola}) deve ser maior que a bitola de saída ({targetBitola} mm).
                                                </div>
                                            ) : (
                                                /* Grid Visual de Passes e Anéis de cada K-7 */
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[190px] overflow-y-auto pr-0.5 animate-fade">
                                                    {k7Passes.map((pass, pIdx) => {
                                                        return (
                                                            <div
                                                                key={pass.pass}
                                                                className="bg-[#0B1D2A] border border-white/10 rounded-xl p-2 flex flex-col gap-1.5 relative overflow-hidden"
                                                            >
                                                                {/* Barra de identificação do K-7 */}
                                                                <div className="flex items-center justify-between text-[9px]">
                                                                    <span className="font-extrabold text-white flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                                                        K-7 #{pass.pass}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-slate-300 font-bold font-mono">
                                                                            {pass.dOutput.toFixed(2)} mm
                                                                        </span>
                                                                        <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                                                            pass.reduction > 29 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-[#00E5FF]'
                                                                        }`}>
                                                                            -{pass.reduction.toFixed(1)}%
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Seleção dos Anéis (Entrada & Saída) */}
                                                                <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                                                                    {/* Anel Entrada */}
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                                                            Entrada (3x)
                                                                        </span>
                                                                        <select
                                                                            value={pass.entryRing}
                                                                            onChange={(e) => handleUpdateRing(pIdx, 'entryRing', e.target.value)}
                                                                            className="w-full bg-[#07131B] border border-white/15 rounded-lg py-1 px-1.5 text-[10px] font-black text-amber-300 focus:border-amber-400 focus:outline-none cursor-pointer"
                                                                        >
                                                                            {ENTRY_RINGS_LIST.map(ring => (
                                                                                <option key={ring} value={ring}>{ring}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>

                                                                    {/* Anel Saída */}
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                                                            Saída (3x)
                                                                        </span>
                                                                        <select
                                                                            value={pass.outputRing}
                                                                            onChange={(e) => handleUpdateRing(pIdx, 'outputRing', e.target.value)}
                                                                            className="w-full bg-[#07131B] border border-white/15 rounded-lg py-1 px-1.5 text-[10px] font-black text-emerald-300 focus:border-emerald-400 focus:outline-none cursor-pointer"
                                                                        >
                                                                            {OUTPUT_RINGS_LIST.map(ring => (
                                                                                <option key={ring} value={ring}>{ring}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Agendamento PCP */}
                                    <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Início</label>
                                            <input
                                                type="date"
                                                value={createStartDate}
                                                onChange={(e) => setCreateStartDate(e.target.value)}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-1.5 px-2.5 text-xs text-white"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duração (dias)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTempShiftConfig({ ...shiftConfig });
                                                        setIsWorkHoursModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-[#00E5FF] hover:text-white transition-all text-[9px] font-mono cursor-pointer active:scale-95 group shadow-sm"
                                                    title="Configurar jornada de trabalho diária (início, almoço e fim)"
                                                >
                                                    <ClockIcon className="w-2.5 h-2.5 group-hover:rotate-45 transition-transform" />
                                                    <span className="font-bold">{dailyShiftDetails.totalWorkHours.toFixed(1)}h/dia</span>
                                                    <span className="text-[8px] opacity-75 underline">ajustar</span>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 px-0.5">
                                                <span className="text-[8px] uppercase tracking-wider text-slate-500">Tempo líquido:</span>
                                                <span className="text-cyan-300 font-bold">
                                                    {trefilaProductionCalculations.totalHours > 0 
                                                        ? `~${(trefilaProductionCalculations.totalHours / dailyShiftDetails.totalWorkHours).toFixed(1)}d (${dailyShiftDetails.totalWorkHours.toFixed(1)}h/d)` 
                                                        : '—'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 bg-[#07131B] border border-white/10 rounded-xl p-1 justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateDuration(prev => Math.max(1, prev - 1))}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 active:scale-90 transition-transform"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xs font-bold text-white">{createDuration}d</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateDuration(prev => prev + 1)}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 active:scale-90 transition-transform"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resumo da Produção & Cálculo de Tempo */}
                                    <div className="bg-[#07131B] p-3 rounded-xl border border-cyan-500/20 text-xs space-y-2">
                                        <div className="flex justify-between items-center text-slate-400 border-b border-white/5 pb-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Resumo da Ordem:</span>
                                            <div className="flex items-center gap-2 font-mono">
                                                <span className="text-white font-bold">{selectedLotIds.length} rolo(s)</span>
                                                <span>•</span>
                                                <strong className="text-[#00E5FF] font-black">
                                                    {totalSelectedWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Detalhamento de Tempos */}
                                        <div className="grid grid-cols-3 gap-1.5 py-1 text-center bg-white/[0.02] p-1.5 rounded-lg border border-white/5 font-mono text-[10px]">
                                            <div>
                                                <span className="text-slate-400 block text-[9px] uppercase">Trefilação</span>
                                                <strong className="text-cyan-400 block mt-0.5">
                                                    {formatDurationHoursMin(trefilaProductionCalculations.drawingTimeMinutes)}
                                                </strong>
                                                {trefilaProductionCalculations.numRolls > 0 && (
                                                    <span className="text-[8px] text-slate-500">
                                                        ~{trefilaProductionCalculations.avgMinutesPerRoll.toFixed(0)}m/rolo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="border-x border-white/5">
                                                <span className="text-slate-400 block text-[9px] uppercase">Trocas ({selectedLotIds.length})</span>
                                                <strong className="text-amber-400 block mt-0.5">
                                                    {formatDurationHoursMin(trefilaProductionCalculations.totalRollChangeMinutes)}
                                                </strong>
                                                <span className="text-[8px] text-slate-500">
                                                    {rollChangeTimeMin}m/rolo
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[9px] uppercase">Setup</span>
                                                <strong className="text-emerald-400 block mt-0.5">
                                                    {formatDurationHoursMin(trefilaProductionCalculations.totalSetupMinutes)}
                                                </strong>
                                                <span className="text-[8px] text-slate-500">
                                                    inicial
                                                </span>
                                            </div>
                                        </div>

                                        {/* Total em Horas Estimadas */}
                                        <div className="flex justify-between items-baseline border-t border-white/10 pt-2">
                                            <div>
                                                <span className="text-slate-300 font-bold block text-xs">Tempo Total Estimado:</span>
                                                <span className="text-[10px] text-slate-400">
                                                    Trefilação + Trocas + Setup • {dailyShiftDetails.totalWorkHours.toFixed(1)}h/dia
                                                </span>
                                            </div>
                                            <div className="text-right font-mono">
                                                <span className="text-base font-black text-[#00E5FF] block">
                                                    {formatDurationHoursMin(trefilaProductionCalculations.totalMinutes)}
                                                </span>
                                                <span className="text-[10px] text-cyan-300/80 font-bold">
                                                    {trefilaProductionCalculations.totalHours.toFixed(2).replace('.', ',')} horas (~{(trefilaProductionCalculations.totalHours / dailyShiftDetails.totalWorkHours).toFixed(1)} dias)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Coluna Direita: Tabela de Lotes Disponíveis em Estoque */}
                                <div className="lg:col-span-7 flex flex-col gap-2.5 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <div>
                                            <h4 className="text-xs font-black uppercase text-[#00E5FF] tracking-wider">
                                                2. Lotes Disponíveis de Fio Máquina ({availableTrefilaLots.length})
                                            </h4>
                                            <p className="text-[10px] text-slate-400">
                                                Marque os lotes que serão consumidos nesta OP 
                                                <strong className="text-amber-400 font-normal"> (obrigatório inclusive em Ordens Fantasma)</strong>
                                            </p>
                                        </div>
                                        {selectedLotIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLotIds([])}
                                                className="text-[10px] text-slate-400 hover:text-red-400 underline font-bold"
                                            >
                                                Desmarcar todos
                                            </button>
                                        )}
                                    </div>

                                    {/* Tabela de Lotes */}
                                    <div className="overflow-auto max-h-[360px] rounded-xl border border-white/5 bg-[#07131B]">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-[#0B1E2C] text-[10px] text-slate-400 uppercase sticky top-0 border-b border-white/10 z-10">
                                                <tr>
                                                    <th className="p-2.5 w-10 text-center">#</th>
                                                    <th className="p-2.5">Lote Interno</th>
                                                    <th className="p-2.5">Fornecedor</th>
                                                    <th className="p-2.5">Bitola</th>
                                                    <th className="p-2.5 text-right">Peso Etiqueta</th>
                                                    <th className="p-2.5 text-right text-[#00E5FF]">Disponível</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-mono">
                                                {availableTrefilaLots.map(lot => {
                                                    const isSelected = selectedLotIds.includes(lot.id);
                                                    return (
                                                        <tr 
                                                            key={lot.id}
                                                            onClick={() => handleSelectTrefilaLot(lot.id, !isSelected)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected 
                                                                    ? 'bg-[#00E5FF]/10 text-white' 
                                                                    : 'hover:bg-white/[0.02] text-slate-300'
                                                            }`}
                                                        >
                                                            <td className="p-2.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => handleSelectTrefilaLot(lot.id, e.target.checked)}
                                                                    className="h-4 w-4 rounded border-slate-700 bg-[#07131B] text-[#00E5FF] focus:ring-[#00E5FF] cursor-pointer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </td>
                                                            <td className="p-2.5 font-bold text-white">{lot.internalLot}</td>
                                                            <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-[120px]">{lot.supplier || '—'}</td>
                                                            <td className="p-2.5 font-bold text-cyan-400">{lot.bitola} mm</td>
                                                            <td className="p-2.5 text-right text-slate-500">{lot.labelWeight.toFixed(2)} kg</td>
                                                            <td className="p-2.5 text-right font-black text-[#00E5FF]">
                                                                {lot.remainingQuantity.toFixed(2)} kg
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {availableTrefilaLots.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                                            Nenhum lote de Fio Máquina disponível no estoque com os filtros selecionados.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================== */}
                        {/* FLUXO 2: TRELIÇA (Regras idênticas a ProductionOrderTrelica.tsx) */}
                        {/* ========================================================== */}
                        {createCategory === 'Treliça' && (() => {
                            const supBitolaNorm = normalizeBitola(selectedTrelicaModel?.superior);
                            const infBitolaNorm = normalizeBitola(selectedTrelicaModel?.inferior);
                            const senBitolaNorm = normalizeBitola(selectedTrelicaModel?.senozoide);

                            // Helper para checar se um lote está selecionado na lista (por ID ou lote interno)
                            const isLotSelectedIn = (list: string[], item: any) => {
                                return list.some(id => id === item.id || id === item.internalLot || (item.lotNumber && id === item.lotNumber));
                            };

                            // Lotes compatíveis e filtrados por arame excluindo seleções cruzadas
                            const supCandidates = availableCa60Stock.filter(s => {
                                const matchGauge = trelicaShowAllGauges || normalizeBitola(s.bitola) === supBitolaNorm;
                                const notInOthers = !isLotSelectedIn(trelicaInferiorLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorRightLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideRightLots, s);
                                const matchSearch = !trelicaLotSearch || (s.internalLot || '').toLowerCase().includes(trelicaLotSearch.toLowerCase());
                                return matchGauge && notInOthers && matchSearch;
                            });

                            const inf1Candidates = availableCa60Stock.filter(s => {
                                const matchGauge = trelicaShowAllGauges || normalizeBitola(s.bitola) === infBitolaNorm;
                                const notInOthers = !isLotSelectedIn(trelicaSuperiorLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorRightLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideRightLots, s);
                                const matchSearch = !trelicaLotSearch || (s.internalLot || '').toLowerCase().includes(trelicaLotSearch.toLowerCase());
                                return matchGauge && notInOthers && matchSearch;
                            });

                            const inf2Candidates = availableCa60Stock.filter(s => {
                                const matchGauge = trelicaShowAllGauges || normalizeBitola(s.bitola) === infBitolaNorm;
                                const notInOthers = !isLotSelectedIn(trelicaSuperiorLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideRightLots, s);
                                const matchSearch = !trelicaLotSearch || (s.internalLot || '').toLowerCase().includes(trelicaLotSearch.toLowerCase());
                                return matchGauge && notInOthers && matchSearch;
                            });

                            const sen1Candidates = availableCa60Stock.filter(s => {
                                const matchGauge = trelicaShowAllGauges || normalizeBitola(s.bitola) === senBitolaNorm;
                                const notInOthers = !isLotSelectedIn(trelicaSuperiorLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorRightLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideRightLots, s);
                                const matchSearch = !trelicaLotSearch || (s.internalLot || '').toLowerCase().includes(trelicaLotSearch.toLowerCase());
                                return matchGauge && notInOthers && matchSearch;
                            });

                            const sen2Candidates = availableCa60Stock.filter(s => {
                                const matchGauge = trelicaShowAllGauges || normalizeBitola(s.bitola) === senBitolaNorm;
                                const notInOthers = !isLotSelectedIn(trelicaSuperiorLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorLeftLots, s) &&
                                                    !isLotSelectedIn(trelicaInferiorRightLots, s) &&
                                                    !isLotSelectedIn(trelicaSenozoideLeftLots, s);
                                const matchSearch = !trelicaLotSearch || (s.internalLot || '').toLowerCase().includes(trelicaLotSearch.toLowerCase());
                                return matchGauge && notInOthers && matchSearch;
                            });

                            const hasAnyLotsSelected = trelicaSuperiorLots.length > 0 ||
                                trelicaInferiorLeftLots.length > 0 ||
                                trelicaInferiorRightLots.length > 0 ||
                                trelicaSenozoideLeftLots.length > 0 ||
                                trelicaSenozoideRightLots.length > 0;

                            const isSupDone = selectedSupWeight >= requiredTrelicaWeights.sup && requiredTrelicaWeights.sup > 0;
                            const isInfDone = (selectedInf1Weight >= requiredTrelicaWeights.infSide) && (selectedInf2Weight >= requiredTrelicaWeights.infSide) && requiredTrelicaWeights.inf > 0;
                            const isSenDone = (selectedSen1Weight >= requiredTrelicaWeights.senSide) && (selectedSen2Weight >= requiredTrelicaWeights.senSide) && requiredTrelicaWeights.sen > 0;
                            const isAllLotsReady = isSupDone && isInfDone && isSenDone;

                            const renderLotTable = (
                                title: string,
                                subTitle: string,
                                reqWeight: number,
                                selWeight: number,
                                candidates: typeof availableCa60Stock,
                                selIds: string[],
                                posKey: 'sup' | 'inf1' | 'inf2' | 'sen1' | 'sen2'
                            ) => {
                                const isSufficient = selWeight >= reqWeight && reqWeight > 0;
                                const progressPct = reqWeight > 0 ? Math.min(100, (selWeight / reqWeight) * 100) : 0;
                                const extraKg = selWeight > reqWeight ? selWeight - reqWeight : 0;
                                const missingKg = selWeight < reqWeight ? reqWeight - selWeight : 0;

                                return (
                                    <div className="flex flex-col bg-[#07131B] rounded-xl border border-white/10 p-3 gap-2 shadow-inner">
                                        <div className="flex justify-between items-start border-b border-white/5 pb-2">
                                            <div>
                                                <span className="text-xs font-black text-white block">{title}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{subTitle}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-baseline justify-end gap-1.5 font-mono">
                                                    <span className="text-[10px] text-slate-400">Meta: <strong>{reqWeight.toFixed(1)}kg</strong></span>
                                                    <span>•</span>
                                                    <span className={`text-xs font-black ${isSufficient ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {selWeight.toFixed(1)} kg
                                                    </span>
                                                </div>
                                                <div className="w-28 bg-white/10 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${isSufficient ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                        style={{ width: `${progressPct}%` }}
                                                    />
                                                </div>
                                                {extraKg > 0 && (
                                                    <span className="text-[8px] font-bold text-emerald-400 block mt-0.5 font-mono">
                                                        +{extraKg.toFixed(1)} kg extra
                                                    </span>
                                                )}
                                                {!isSufficient && missingKg > 0 && selWeight > 0 && (
                                                    <span className="text-[8px] font-bold text-amber-400 block mt-0.5 font-mono">
                                                        faltam {missingKg.toFixed(1)} kg
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Tabela de Lotes Disponíveis */}
                                        <div className="overflow-y-auto max-h-[220px] rounded-lg border border-white/5 bg-[#050E15]">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#0B1E2C] text-[9px] text-slate-400 uppercase sticky top-0 border-b border-white/10 z-10">
                                                    <tr>
                                                        <th className="p-2 w-8 text-center">#</th>
                                                        <th className="p-2">Lote Interno</th>
                                                        <th className="p-2">Bitola</th>
                                                        <th className="p-2 text-right">Disponível</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                                                    {candidates.map(lot => {
                                                        const isSelected = isLotSelectedIn(selIds, lot);
                                                        return (
                                                            <tr
                                                                key={lot.id}
                                                                onClick={() => handleToggleTrelicaLot(posKey, lot.id, !isSelected)}
                                                                className={`cursor-pointer transition-colors ${
                                                                    isSelected 
                                                                        ? 'bg-emerald-500/15 text-white' 
                                                                        : 'hover:bg-white/[0.03] text-slate-300'
                                                                }`}
                                                            >
                                                                <td className="p-2 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => handleToggleTrelicaLot(posKey, lot.id, e.target.checked)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="h-3.5 w-3.5 rounded border-slate-700 bg-[#07131B] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                                    />
                                                                </td>
                                                                <td className="p-2 font-bold text-white flex items-center gap-1.5">
                                                                    <span>{lot.internalLot}</span>
                                                                    {lot.status === 'Disponível - Suporte Treliça' && (
                                                                        <span className="text-[7px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.2 rounded uppercase">
                                                                            Suporte
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-2 text-cyan-400 font-semibold">{lot.bitola} mm</td>
                                                                <td className="p-2 text-right font-black text-emerald-400">
                                                                    {lot.remainingQuantity.toFixed(2)} kg
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {candidates.length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="p-6 text-center text-slate-500 text-[10px] italic">
                                                                Nenhum rolo compatível disponível no estoque.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                    
                                    {/* Coluna Esquerda: Parâmetros da Treliça e Esquema de Tempos */}
                                    <div className="lg:col-span-5 flex flex-col gap-3 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                        <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider border-b border-white/5 pb-2">
                                            1. Parâmetros da Treliça & Esquema de Tempos
                                        </h4>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máquina Destino</label>
                                            {isMachineLocked ? (
                                                <div className="w-full bg-[#07131B] border border-emerald-500/30 rounded-xl py-2 px-3 text-xs text-emerald-400 font-black flex items-center justify-between">
                                                    <span>{createMachine}</span>
                                                    <span className="text-[9px] text-emerald-400/90 bg-emerald-500/15 px-2 py-0.5 rounded font-mono uppercase tracking-wider">Fixada</span>
                                                </div>
                                            ) : (
                                                <select
                                                    value={createMachine}
                                                    onChange={(e) => setCreateMachine(e.target.value)}
                                                    className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs text-white font-bold"
                                                >
                                                    <option value="Treliça 1">Treliça 1</option>
                                                    <option value="Treliça 2">Treliça 2</option>
                                                </select>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número da Ordem</label>
                                            <input
                                                type="text"
                                                value={createOrderNumber}
                                                onChange={(e) => setCreateOrderNumber(e.target.value)}
                                                placeholder="Ex: TL-4520"
                                                autoComplete="off"
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50 focus:bg-[#07131B] focus:text-white text-white font-bold"
                                            />
                                        </div>

                                        {/* Ordem Fantasma Treliça */}
                                        <div className="flex flex-col gap-1 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="isTrelicaGhostOrderPCP"
                                                    checked={isTrelicaGhostOrder}
                                                    onChange={(e) => setIsTrelicaGhostOrder(e.target.checked)}
                                                    className="h-4 w-4 rounded border-slate-700 bg-[#07131B] text-amber-500 focus:ring-amber-500 cursor-pointer"
                                                />
                                                <label htmlFor="isTrelicaGhostOrderPCP" className="text-xs font-bold text-amber-400 cursor-pointer">
                                                    Ordem Fantasma (Não reservar rolos de CA-60)
                                                </label>
                                            </div>
                                            <p className="text-[9px] text-amber-300/80 pl-6 leading-tight">
                                                A seleção dos lotes continua obrigatória para garantir o cálculo preciso de peso, tempos e calibração da OP.
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo da Treliça</label>
                                            <select
                                                value={selectedTrelicaCod}
                                                onChange={(e) => setSelectedTrelicaCod(e.target.value)}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs text-white font-bold"
                                            >
                                                {trelicaModels.map(m => (
                                                    <option key={m.cod} value={m.cod}>
                                                        {m.modelo} - {m.tamanho}m (Sup: {m.superior} | Inf: {m.inferior} | Sen: {m.senozoide})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantidade a Produzir (peças)</label>
                                            <input
                                                type="number"
                                                value={trelicaQuantity}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setTrelicaQuantity(val);
                                                }}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs text-white font-bold"
                                            />
                                        </div>

                                        {/* ========================================================== */}
                                        {/* ESQUEMA OPERACIONAL DE TEMPOS, VELOCIDADE E SETUP */}
                                        {/* ========================================================== */}
                                        <div className="bg-[#07131B] p-3 rounded-xl border border-emerald-500/20 flex flex-col gap-2.5">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                                                    ⏱️ Parâmetros Operacionais da Máquina
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400">
                                                    {trelicaProductionCalculations.totalMeters.toLocaleString('pt-BR')} m totais
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Velocidade</label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            min="1"
                                                            value={trelicaSpeed}
                                                            onChange={(e) => setTrelicaSpeed(Math.max(1, Number(e.target.value)))}
                                                            className="w-full bg-[#0A1822] border border-white/10 rounded-lg py-1.5 px-2 text-xs font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                                                        />
                                                        <span className="absolute right-1.5 text-[8px] text-slate-500 font-bold pointer-events-none">m/min</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-0.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tempo Setup</label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="number"
                                                            step="5"
                                                            min="0"
                                                            value={trelicaSetupTimeMin}
                                                            onChange={(e) => setTrelicaSetupTimeMin(Math.max(0, Number(e.target.value)))}
                                                            className="w-full bg-[#0A1822] border border-white/10 rounded-lg py-1.5 px-2 text-xs font-black text-amber-400 focus:outline-none focus:border-amber-500"
                                                        />
                                                        <span className="absolute right-1.5 text-[8px] text-slate-500 font-bold pointer-events-none">min</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Meta Diária</label>
                                                        {trelicaDailyTargetOverride !== null && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setTrelicaDailyTargetOverride(null)}
                                                                className="text-[7px] text-cyan-400 hover:underline font-bold"
                                                                title="Resetar para meta automática calculada"
                                                            >
                                                                auto
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={trelicaProductionCalculations.dailyPieces}
                                                            onChange={(e) => setTrelicaDailyTargetOverride(Math.max(1, Number(e.target.value)))}
                                                            className="w-full bg-[#0A1822] border border-white/10 rounded-lg py-1.5 px-2 text-xs font-black text-cyan-400 focus:outline-none focus:border-cyan-500"
                                                        />
                                                        <span className="absolute right-1.5 text-[8px] text-slate-500 font-bold pointer-events-none">pçs</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detalhamento dos Tempos */}
                                            <div className="grid grid-cols-3 gap-1.5 py-1 text-center bg-white/[0.02] p-1.5 rounded-lg border border-white/5 font-mono text-[10px]">
                                                <div>
                                                    <span className="text-slate-400 block text-[8px] uppercase">Solda / Corrida</span>
                                                    <strong className="text-emerald-400 block mt-0.5">
                                                        {formatDurationHoursMin(trelicaProductionCalculations.runMinutes)}
                                                    </strong>
                                                    <span className="text-[8px] text-slate-500">
                                                        ~{(trelicaProductionCalculations.runMinutes / 60).toFixed(1)}h
                                                    </span>
                                                </div>
                                                <div className="border-x border-white/5">
                                                    <span className="text-slate-400 block text-[8px] uppercase">Setup Inicial</span>
                                                    <strong className="text-amber-400 block mt-0.5">
                                                        {trelicaSetupTimeMin}m
                                                    </strong>
                                                    <span className="text-[8px] text-slate-500">
                                                        preparação
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[8px] uppercase">Total Estimado</span>
                                                    <strong className="text-cyan-400 block mt-0.5">
                                                        {formatDurationHoursMin(trelicaProductionCalculations.totalMinutes)}
                                                    </strong>
                                                    <span className="text-[8px] text-slate-500">
                                                        ~{trelicaProductionCalculations.totalHours.toFixed(1)}h
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 pt-1 border-t border-white/5">
                                                <span>Ritmo Diário:</span>
                                                <strong className="text-emerald-300 font-mono">
                                                    ~{trelicaProductionCalculations.dailyPieces} pçs/dia ({trelicaProductionCalculations.dailyKg.toFixed(0)} kg/dia)
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Agendamento */}
                                        <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Início</label>
                                                <input
                                                    type="date"
                                                    value={createStartDate}
                                                    onChange={(e) => setCreateStartDate(e.target.value)}
                                                    className="w-full bg-[#07131B] border border-white/10 rounded-xl py-1.5 px-2.5 text-xs text-white"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duração (dias)</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTempShiftConfig({ ...shiftConfig });
                                                            setIsWorkHoursModalOpen(true);
                                                        }}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-white transition-all text-[9px] font-mono cursor-pointer active:scale-95"
                                                        title="Configurar jornada de trabalho diária (início, almoço e fim)"
                                                    >
                                                        <ClockIcon className="w-2.5 h-2.5" />
                                                        <span>{dailyShiftDetails.totalWorkHours.toFixed(1)}h/dia</span>
                                                        <span className="text-[8px] opacity-75">⚙️</span>
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 bg-[#07131B] border border-white/10 rounded-xl p-1 justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCreateDuration(prev => Math.max(1, prev - 1))}
                                                        className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-bold text-white">{createDuration}d</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCreateDuration(prev => prev + 1)}
                                                        className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ========================================================== */}
                                    {/* Coluna Direita: Seleção Completa de Lotes de CA-60 */}
                                    {/* ========================================================== */}
                                    <div className="lg:col-span-7 flex flex-col gap-3 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2 gap-2">
                                            <div>
                                                <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                                                    <ClipboardListIcon className="w-4 h-4 text-emerald-400" />
                                                    2. Seleção de Rolos de CA-60 (Matéria-Prima)
                                                </h4>
                                                <p className="text-[10px] text-slate-400">
                                                    Marque os rolos em estoque para cada arame 
                                                    <strong className="text-amber-400 font-normal"> (obrigatório inclusive em Ordens Fantasma)</strong>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {hasAnyLotsSelected && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearAllTrelicaLots}
                                                        className="text-[10px] text-slate-400 hover:text-red-400 underline font-bold"
                                                    >
                                                        Desmarcar todos
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={handleAutoSelectTrelicaLots}
                                                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                                    title="Seleciona automaticamente rolos compatíveis para todas as posições"
                                                >
                                                    ⚡ Auto-Selecionar Lotes
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleLoadSpoolStandsToOrder}
                                                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                                    title={`Carregar as bobinas atualmente montadas nos 5 porta-rolos da ${createMachine}`}
                                                >
                                                    📥 Aproveitar Rolos da {createMachine}
                                                </button>
                                            </div>
                                        </div>

                                        {/* BANNER DE DETECÇÃO INTELIGENTE DE BOBINAS MONTADAS NA MÁQUINA */}
                                        {compatibleStandsForNewOp.length > 0 && (
                                            <div className="bg-gradient-to-r from-blue-950/80 via-[#0A1D2B] to-emerald-950/60 p-3 rounded-2xl border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-base shadow flex-shrink-0">
                                                        💡
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                                                            <span>SETUP INTELIGENTE: {compatibleStandsForNewOp.length} BOBINA(S) MONTADAS NA {createMachine}!</span>
                                                            <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                                                                Bitolas Compatíveis ✓
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-300 mt-0.5">
                                                            Os porta-rolos já estão abastecidos com {compatibleStandsForNewOp.map(s => `${(s.role_name ? s.role_name.replace('Porta-Rolo ', '') : s.role_type)}: Lote #${s.current_lot_number || s.current_lot_id || '--'} (⌀${s.current_gauge || '--'}mm)`).join(' • ')}. Deseja aproveitar estas bobinas nesta OP para evitar setup de troca de rolo?
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleLoadSpoolStandsToOrder}
                                                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs transition active:scale-95 shadow-md flex items-center gap-1.5 flex-shrink-0"
                                                >
                                                    <span>⚡</span>
                                                    <span>Aproveitar {compatibleStandsForNewOp.length} Bobinas Montadas</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Cartões de Status / Tabs para Superior, Inferiores e Senozoides */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTrelicaLotTab('superior')}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                                    activeTrelicaLotTab === 'superior'
                                                        ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                                                        : 'bg-[#07131B] border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black uppercase text-cyan-400">Superior (1x)</span>
                                                    {isSupDone && <span className="text-[9px]">✅</span>}
                                                </div>
                                                <div className="text-xs font-black text-white mt-0.5">⌀ {selectedTrelicaModel?.superior} mm</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex justify-between">
                                                    <span>{trelicaSuperiorLots.length} rolo(s)</span>
                                                    <strong className={isSupDone ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {selectedSupWeight.toFixed(0)}/{requiredTrelicaWeights.sup.toFixed(0)}kg
                                                    </strong>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setActiveTrelicaLotTab('inferior')}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                                    activeTrelicaLotTab === 'inferior'
                                                        ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                                                        : 'bg-[#07131B] border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black uppercase text-emerald-400">Inferiores (2x)</span>
                                                    {isInfDone && <span className="text-[9px]">✅</span>}
                                                </div>
                                                <div className="text-xs font-black text-white mt-0.5">⌀ {selectedTrelicaModel?.inferior} mm</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex justify-between">
                                                    <span>{(trelicaInferiorLeftLots.length + trelicaInferiorRightLots.length)} rolo(s)</span>
                                                    <strong className={isInfDone ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {(selectedInf1Weight + selectedInf2Weight).toFixed(0)}/{requiredTrelicaWeights.inf.toFixed(0)}kg
                                                    </strong>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setActiveTrelicaLotTab('senozoide')}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                                    activeTrelicaLotTab === 'senozoide'
                                                        ? 'bg-purple-500/15 border-purple-500/50 shadow-md shadow-purple-500/10'
                                                        : 'bg-[#07131B] border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black uppercase text-purple-400">Senozoides (2x)</span>
                                                    {isSenDone && <span className="text-[9px]">✅</span>}
                                                </div>
                                                <div className="text-xs font-black text-white mt-0.5">⌀ {selectedTrelicaModel?.senozoide} mm</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex justify-between">
                                                    <span>{(trelicaSenozoideLeftLots.length + trelicaSenozoideRightLots.length)} rolo(s)</span>
                                                    <strong className={isSenDone ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {(selectedSen1Weight + selectedSen2Weight).toFixed(0)}/{requiredTrelicaWeights.sen.toFixed(0)}kg
                                                    </strong>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Barra de Filtro de Busca de Lotes */}
                                        <div className="flex items-center justify-between gap-3 bg-[#07131B] p-2 rounded-xl border border-white/5">
                                            <input
                                                type="text"
                                                value={trelicaLotSearch}
                                                onChange={(e) => setTrelicaLotSearch(e.target.value)}
                                                placeholder="🔍 Filtrar rolos por lote interno..."
                                                className="w-full bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none"
                                            />
                                            <div className="flex items-center gap-2 whitespace-nowrap pl-2 border-l border-white/10">
                                                <input
                                                    type="checkbox"
                                                    id="trelicaShowAllGauges"
                                                    checked={trelicaShowAllGauges}
                                                    onChange={(e) => setTrelicaShowAllGauges(e.target.checked)}
                                                    className="h-3.5 w-3.5 rounded border-slate-700 bg-[#07131B] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <label htmlFor="trelicaShowAllGauges" className="text-[10px] text-slate-400 font-bold cursor-pointer">
                                                    Exibir todas as bitolas
                                                </label>
                                            </div>
                                        </div>

                                        {/* Conteúdo da Tab Ativa: BANZO SUPERIOR */}
                                        {activeTrelicaLotTab === 'superior' && (
                                            <div className="flex flex-col gap-2">
                                                {renderLotTable(
                                                    `Banzo Superior (1x)`,
                                                    `Bitola nominal: ${selectedTrelicaModel?.superior} mm`,
                                                    requiredTrelicaWeights.sup,
                                                    selectedSupWeight,
                                                    supCandidates,
                                                    trelicaSuperiorLots,
                                                    'sup'
                                                )}
                                            </div>
                                        )}

                                        {/* Conteúdo da Tab Ativa: BANZOS INFERIORES (LADO 1 E LADO 2) */}
                                        {activeTrelicaLotTab === 'inferior' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {renderLotTable(
                                                    `Inferior - Lado 1`,
                                                    `Bitola nominal: ${selectedTrelicaModel?.inferior} mm`,
                                                    requiredTrelicaWeights.infSide,
                                                    selectedInf1Weight,
                                                    inf1Candidates,
                                                    trelicaInferiorLeftLots,
                                                    'inf1'
                                                )}
                                                {renderLotTable(
                                                    `Inferior - Lado 2`,
                                                    `Bitola nominal: ${selectedTrelicaModel?.inferior} mm`,
                                                    requiredTrelicaWeights.infSide,
                                                    selectedInf2Weight,
                                                    inf2Candidates,
                                                    trelicaInferiorRightLots,
                                                    'inf2'
                                                )}
                                            </div>
                                        )}

                                        {/* Conteúdo da Tab Ativa: SENOZOIDES (LADO 1 E LADO 2) */}
                                        {activeTrelicaLotTab === 'senozoide' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {renderLotTable(
                                                    `Senozoide - Lado 1`,
                                                    `Bitola nominal: ${selectedTrelicaModel?.senozoide} mm`,
                                                    requiredTrelicaWeights.senSide,
                                                    selectedSen1Weight,
                                                    sen1Candidates,
                                                    trelicaSenozoideLeftLots,
                                                    'sen1'
                                                )}
                                                {renderLotTable(
                                                    `Senozoide - Lado 2`,
                                                    `Bitola nominal: ${selectedTrelicaModel?.senozoide} mm`,
                                                    requiredTrelicaWeights.senSide,
                                                    selectedSen2Weight,
                                                    sen2Candidates,
                                                    trelicaSenozoideRightLots,
                                                    'sen2'
                                                )}
                                            </div>
                                        )}

                                        {/* Resumo Geral de Matéria-Prima Treliça */}
                                        <div className="bg-[#07131B] p-3 rounded-xl border border-white/5 mt-auto flex flex-col gap-1.5">
                                            <div className="flex justify-between text-xs text-slate-300">
                                                <span>Peso Teórico Total da Produção:</span>
                                                <span className="font-black text-white">
                                                    {requiredTrelicaWeights.total.toFixed(2)} kg
                                                </span>
                                            </div>

                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-400">Total Alocado nos Rolos Selecionados:</span>
                                                <span className={`font-black ${isAllLotsReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {totalSelectedTrelicaWeight.toFixed(2)} kg
                                                </span>
                                            </div>

                                            <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                                                {isAllLotsReady ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                        ✓ Todos os 5 arames devidamente abastecidos (+{(totalSelectedTrelicaWeight - requiredTrelicaWeights.total).toFixed(1)} kg extra)
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-400 font-bold flex items-center gap-1">
                                                        ⚠️ Seleção incompleta ou abaixo da meta (verifique as 3 abas acima)
                                                    </span>
                                                )}

                                                <span className="text-slate-500 font-mono">
                                                    {(trelicaSuperiorLots.length + trelicaInferiorLeftLots.length + trelicaInferiorRightLots.length + trelicaSenozoideLeftLots.length + trelicaSenozoideRightLots.length)} rolo(s) marcados
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ========================================================== */}
                        {/* FLUXO 3: MALHA (Regras idênticas a ProductionOrderMalha.tsx) */}
                        {/* ========================================================== */}
                        {createCategory === 'Malha' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-3.5 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider border-b border-white/5 pb-2">
                                        1. Parâmetros da Malha
                                    </h4>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máquina Destino</label>
                                        <div className="w-full bg-[#07131B] border border-purple-500/30 rounded-xl py-2 px-3 text-xs text-purple-400 font-black flex items-center justify-between">
                                            <span>Malha 1</span>
                                            <span className="text-[9px] text-purple-400/90 bg-purple-500/15 px-2 py-0.5 rounded font-mono uppercase tracking-wider">Fixada</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número da Ordem</label>
                                        <input
                                            type="text"
                                            value={createOrderNumber}
                                            onChange={(e) => setCreateOrderNumber(e.target.value)}
                                            placeholder="Ex: ML-1025"
                                            autoComplete="off"
                                            className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 focus:bg-[#07131B] focus:text-white text-white font-bold"
                                        />
                                    </div>

                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                             <span>Modelo da Malha (Gestão de Lotes)</span>
                                             {selectedMalhaModelObj?.productCode && (
                                                 <span className="text-[9px] text-purple-400 font-mono font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                                                     Cód. {selectedMalhaModelObj.productCode}
                                                 </span>
                                             )}
                                         </label>
                                         <select
                                             value={malhaModel}
                                             onChange={(e) => {
                                                 const val = e.target.value;
                                                 setMalhaModel(val);
                                                 const found = availableMalhaModels.find(m => m.description === val || m.productCode === val || m.id === val);
                                                 if (found && found.gauge) {
                                                     const rawG = found.gauge.replace('mm', '').replace(',', '.').trim();
                                                     setMalhaBitola(rawG as Bitola);
                                                 }
                                             }}
                                             className="w-full bg-[#07131B] border border-purple-500/30 rounded-xl py-2 px-3 text-xs text-white font-bold focus:outline-none focus:border-purple-400"
                                         >
                                             <option value="">Selecione um modelo de malha cadastrado...</option>
                                             {availableMalhaModels.map(m => {
                                                 const parts = [];
                                                 if (m.productCode) parts.push(`[Cód. ${m.productCode}]`);
                                                 parts.push(m.description);
                                                 if (m.gauge) parts.push(`(${m.gauge})`);
                                                 if (m.meshSpacing) parts.push(`[${m.meshSpacing}]`);
                                                 if (m.panelDimensions) parts.push(`• ${m.panelDimensions}m`);
                                                 if (m.peso_peca) parts.push(`• ${m.peso_peca} kg/pç`);
                                                 return (
                                                     <option key={m.id || m.productCode || m.description} value={m.description}>
                                                         {parts.join(' ')}
                                                     </option>
                                                 );
                                             })}
                                         </select>

                                         {selectedMalhaModelObj && (
                                             <div className="mt-1 bg-purple-950/30 border border-purple-500/20 rounded-lg p-2 text-[10px] text-slate-300 flex flex-col gap-1">
                                                 <div className="flex items-center justify-between text-purple-300 font-semibold">
                                                     <span>{selectedMalhaModelObj.description}</span>
                                                     {selectedMalhaModelObj.peso_peca && (
                                                         <span className="font-mono text-white font-bold">{selectedMalhaModelObj.peso_peca} kg/pç</span>
                                                     )}
                                                 </div>
                                                 <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-400 text-[9px]">
                                                     {selectedMalhaModelObj.gauge && <span>Bitola: <strong className="text-slate-200">{selectedMalhaModelObj.gauge}</strong></span>}
                                                     {selectedMalhaModelObj.meshSpacing && <span>Espaçamento: <strong className="text-slate-200">{selectedMalhaModelObj.meshSpacing}</strong></span>}
                                                     {selectedMalhaModelObj.panelDimensions && <span>Painel: <strong className="text-slate-200">{selectedMalhaModelObj.panelDimensions}m</strong></span>}
                                                     {selectedMalhaModelObj.peso_peca && (
                                                         <span>Peso Total Estimado: <strong className="text-purple-300 font-mono">{(malhaPieces * parseFloat(selectedMalhaModelObj.peso_peca.replace(',', '.'))).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</strong></span>
                                                     )}
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                 </div>

                                <div className="flex flex-col gap-3.5 bg-[#0A1822]/90 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider border-b border-white/5 pb-2">
                                        2. Quantidade e Agendamento
                                    </h4>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantidade de Painéis (peças)</label>
                                        <input
                                            type="number"
                                            value={malhaPieces}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setMalhaPieces(val);
                                                setCreateDuration(Math.max(1, Math.ceil(val / CAPACITY_DEFAULTS['Malha 1'])));
                                            }}
                                            className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs text-white font-bold"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitola do Arame (CA-60)</label>
                                        <select
                                            value={malhaBitola}
                                            onChange={(e) => setMalhaBitola(e.target.value as Bitola)}
                                            className="w-full bg-[#07131B] border border-white/10 rounded-xl py-2 px-3 text-xs text-white font-bold"
                                        >
                                            {availableTrefilaGauges.map(g => (
                                                <option key={g} value={g}>{g} mm</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 mt-auto">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Início</label>
                                            <input
                                                type="date"
                                                value={createStartDate}
                                                onChange={(e) => setCreateStartDate(e.target.value)}
                                                className="w-full bg-[#07131B] border border-white/10 rounded-xl py-1.5 px-2.5 text-xs text-white"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duração (dias)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTempShiftConfig({ ...shiftConfig });
                                                        setIsWorkHoursModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:text-white transition-all text-[9px] font-mono cursor-pointer active:scale-95"
                                                    title="Configurar jornada de trabalho diária (início, almoço e fim)"
                                                >
                                                    <ClockIcon className="w-2.5 h-2.5" />
                                                    <span>{dailyShiftDetails.totalWorkHours.toFixed(1)}h/dia</span>
                                                    <span className="text-[8px] opacity-75">⚙️</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 bg-[#07131B] border border-white/10 rounded-xl p-1 justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateDuration(prev => Math.max(1, prev - 1))}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xs font-bold text-white">{createDuration}d</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateDuration(prev => prev + 1)}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Alerta de Erro caso a gravação falhe ou validação não passe */}
                        {createOrderError && (
                            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2 animate-fade">
                                <span className="text-base shrink-0">⚠️</span>
                                <span className="font-semibold">{createOrderError}</span>
                            </div>
                        )}

                        {/* Botões do Rodapé do Modal: Apenas Cancelar e Confirmar Programação no PCP */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-white/10">
                            <button
                                type="button"
                                disabled={isSavingOrder}
                                onClick={() => setIsCreateModalOpen(false)}
                                className="sm:w-1/3 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/5 rounded-xl py-3 text-xs font-bold text-slate-400 hover:text-white transition-all text-center uppercase tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isSavingOrder}
                                onClick={() => handleSaveNewOrder('confirm')}
                                className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#00B4D8] hover:brightness-110 disabled:opacity-50 text-slate-950 font-black rounded-xl py-3 text-xs transition-all shadow-lg shadow-[#00E5FF]/20 text-center active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
                            >
                                {isSavingOrder ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        <span>Programando OP...</span>
                                    </>
                                ) : (
                                    <span>Programar OP no PCP</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Sucesso: Exibido SOMENTE após a OP estar programada e criada no PCP */}
            {createdOPSuccessModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade p-4">
                    <div className="w-full max-w-md pcp-glass-card rounded-2xl border border-white/15 p-6 flex flex-col gap-4 text-slate-100 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                                <CheckCircleIcon className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">PCP • Programada</span>
                                <h3 className="text-lg font-black text-white">OP #{createdOPSuccessModal.orderNumber} Programada!</h3>
                                <p className="text-xs text-slate-400">{createdOPSuccessModal.machine}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
                            <div className="flex items-center gap-2 text-[#00E5FF] font-bold">
                                <span>📋</span>
                                <span>Ordem criada e programada no PCP com sucesso!</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight">
                                A OP agora está agendada no PCP. Escolha a ação desejada:
                            </p>
                        </div>

                        {/* Ações após a OP estar programada no PCP */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const modalData = createdOPSuccessModal;
                                    setCreatedOPSuccessModal(null);
                                    handleGoToProduction(modalData.opData);
                                }}
                                className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl py-3 text-xs transition shadow-lg shadow-cyan-500/20 text-center active:scale-95 uppercase tracking-wider flex items-center justify-center gap-1.5"
                                title={`Enviar para a máquina ${createdOPSuccessModal.machine}`}
                            >
                                <PlayIcon className="w-4 h-4 text-slate-950 fill-slate-950" />
                                Enviar p/ Máquina
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const modalData = createdOPSuccessModal;
                                    setCreatedOPSuccessModal(null);
                                    handlePrintOP(modalData.opData);
                                }}
                                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-black rounded-xl py-3 text-xs transition text-center active:scale-95 uppercase tracking-wider flex items-center justify-center gap-1.5"
                            >
                                <PrinterIcon className="w-4 h-4" />
                                Imprimir Ficha A4
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setCreatedOPSuccessModal(null)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-bold text-slate-400 hover:text-white transition text-center uppercase tracking-wider"
                        >
                            Concluir e Ver no Quadro PCP
                        </button>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-JANELA / MODAL: CONFIGURAÇÃO DA JORNADA DE TRABALHO & FERIADOS */}
            {/* ========================================================================= */}
            {isWorkHoursModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade p-3 sm:p-4">
                    <div className="w-full max-w-xl pcp-glass-card rounded-2xl border border-white/15 p-5 sm:p-6 flex flex-col gap-4 text-slate-100 shadow-2xl max-h-[90vh] overflow-hidden">
                        
                        {/* Cabeçalho */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#00E5FF]/15 text-[#00E5FF] flex items-center justify-center border border-[#00E5FF]/30">
                                    <ClockIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                        Jornada & Feriados da Produção
                                    </h3>
                                    <p className="text-[11px] text-cyan-300/80 font-medium">
                                        Configuração central salva no Supabase (sincronizada em todos os computadores)
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsWorkHoursModalOpen(false)} 
                                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Abas de Navegação */}
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveShiftTab('hours')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeShiftTab === 'hours'
                                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <ClockIcon className="w-4 h-4" />
                                <span>Horários do Turno</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveShiftTab('holidays')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeShiftTab === 'holidays'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <CalendarIcon className="w-4 h-4" />
                                <span>Feriados & Folgas ({holidays.length})</span>
                            </button>
                        </div>

                        {/* Conteúdo da Aba 1: Horários do Turno */}
                        {activeShiftTab === 'hours' && (
                            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                                {/* Sub-Seletor de Escopo: Geral Fábrica ou Máquina Específica */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10 scrollbar-thin">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMachineShiftTab('GLOBAL')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                            selectedMachineShiftTab === 'GLOBAL'
                                                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-sm'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        <span>🏢 Geral (Fábrica)</span>
                                    </button>
                                    {MACHINES.map(m => {
                                        const isCustom = Boolean(tempShiftConfig.machineConfigs?.[m.name]);
                                        const isSelected = selectedMachineShiftTab === m.name;
                                        return (
                                            <button
                                                key={m.name}
                                                type="button"
                                                onClick={() => setSelectedMachineShiftTab(m.name)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? 'bg-cyan-500/25 text-[#00E5FF] border border-[#00E5FF]/50 shadow-sm'
                                                        : isCustom
                                                            ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                                            : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                                }`}
                                            >
                                                <span>{m.name}</span>
                                                {isCustom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Jornada personalizada" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Banner e Atalhos Rápidos por Máquina */}
                                {selectedMachineShiftTab !== 'GLOBAL' && (
                                    <div className="flex items-center justify-between bg-[#0B1D2A] p-2.5 rounded-xl border border-white/10 text-xs gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse shrink-0" />
                                            <span className="font-bold text-slate-200 truncate">
                                                Configurando: <strong className="text-[#00E5FF]">{selectedMachineShiftTab}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {selectedMachineShiftTab.startsWith('Trefila') && (
                                                <button
                                                    type="button"
                                                    onClick={() => updateCurrentTabConfig({ workStart: '07:45', workEnd: '17:33', noLunch: true, shiftCount: 1 })}
                                                    className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider transition active:scale-95"
                                                >
                                                    ⚡ Aplicar 07:45 às 17:33 (Sem Almoço)
                                                </button>
                                            )}
                                            {selectedMachineShiftTab.startsWith('Treliça') && (
                                                <button
                                                    type="button"
                                                    onClick={() => updateCurrentTabConfig({ workStart: '05:00', workEnd: '14:44', noLunch: false, lunchStart: '11:30', lunchEnd: '12:30', shiftCount: 2, shift2Start: '14:00', shift2End: '23:59' })}
                                                    className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider transition active:scale-95"
                                                >
                                                    ⚡ 2 Turnos Treliça (A e B)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Entradas de Horários */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Pergunta 1: Hora Início */}
                                    <div className="flex items-center justify-between bg-[#08131B] p-2.5 rounded-xl border border-white/5 hover:border-cyan-500/20 transition-all">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-[#00E5FF] font-bold text-[11px] flex items-center justify-center">1</span>
                                            <div>
                                                <span className="text-xs font-bold text-slate-200 block">Hora de Início</span>
                                                <span className="text-[9px] text-slate-400">Início das máquinas</span>
                                            </div>
                                        </div>
                                        <input
                                            type="time"
                                            value={currentTabConfig.workStart || '07:00'}
                                            onChange={(e) => updateCurrentTabConfig({ workStart: e.target.value })}
                                            style={{ colorScheme: 'dark' }}
                                            className="bg-[#0B1D2A] border border-cyan-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-[#00E5FF] text-white"
                                        />
                                    </div>

                                    {/* Fim do Turno */}
                                    <div className="flex items-center justify-between bg-[#08131B] p-2.5 rounded-xl border border-white/5 hover:border-cyan-500/20 transition-all">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-[#00E5FF] font-bold text-[11px] flex items-center justify-center">2</span>
                                            <div>
                                                <span className="text-xs font-bold text-slate-200 block">Fim do Turno</span>
                                                <span className="text-[9px] text-slate-400">Término da produção</span>
                                            </div>
                                        </div>
                                        <input
                                            type="time"
                                            value={currentTabConfig.workEnd || '17:00'}
                                            onChange={(e) => updateCurrentTabConfig({ workEnd: e.target.value })}
                                            style={{ colorScheme: 'dark' }}
                                            className="bg-[#0B1D2A] border border-cyan-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-[#00E5FF] text-white"
                                        />
                                    </div>

                                    {/* Toggle: Sem Parada de Almoço */}
                                    <div className="sm:col-span-2 bg-[#08131B] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input 
                                                type="checkbox"
                                                checked={Boolean(currentTabConfig.noLunch)}
                                                onChange={(e) => updateCurrentTabConfig({ noLunch: e.target.checked })}
                                                className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 bg-[#0B1D2A] border-white/20 accent-[#00E5FF]"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-200 block">Sem Parada de Almoço (Turno Contínuo)</span>
                                                <span className="text-[10px] text-slate-400">Máquina opera em regime contínuo sem intervalo de refeição</span>
                                            </div>
                                        </label>
                                        {Boolean(currentTabConfig.noLunch) && (
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                Contínuo
                                            </span>
                                        )}
                                    </div>

                                    {/* Horários de Almoço (se houver intervalo) */}
                                    {!currentTabConfig.noLunch && (
                                        <>
                                            {/* Parada Almoço (Início) */}
                                            <div className="flex items-center justify-between bg-[#08131B] p-2.5 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center justify-center">3</span>
                                                    <div>
                                                        <span className="text-xs font-bold text-amber-300 block">Almoço (Início)</span>
                                                        <span className="text-[9px] text-slate-400">Pausa para refeição</span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={currentTabConfig.lunchStart || '12:00'}
                                                    onChange={(e) => updateCurrentTabConfig({ lunchStart: e.target.value })}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="bg-[#0B1D2A] border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-amber-400 text-white"
                                                />
                                            </div>

                                            {/* Retorno Almoço */}
                                            <div className="flex items-center justify-between bg-[#08131B] p-2.5 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center justify-center">4</span>
                                                    <div>
                                                        <span className="text-xs font-bold text-amber-300 block">Retorno Almoço</span>
                                                        <span className="text-[9px] text-slate-400">Fim da refeição</span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={currentTabConfig.lunchEnd || '13:00'}
                                                    onChange={(e) => updateCurrentTabConfig({ lunchEnd: e.target.value })}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="bg-[#0B1D2A] border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-amber-400 text-white"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Configuração de 2 Turnos */}
                                    <div className="sm:col-span-2 bg-[#08131B] p-3 rounded-xl border border-white/5 space-y-2.5">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={currentTabConfig.shiftCount === 2}
                                                onChange={(e) => updateCurrentTabConfig({ 
                                                    shiftCount: e.target.checked ? 2 : 1, 
                                                    shift2Start: e.target.checked ? (currentTabConfig.shift2Start || '14:00') : undefined, 
                                                    shift2End: e.target.checked ? (currentTabConfig.shift2End || '23:59') : undefined 
                                                })}
                                                className="w-4 h-4 rounded text-emerald-400 focus:ring-0 bg-[#0B1D2A] border-white/20 accent-emerald-400"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-200 block">Operar em 2 Turnos (Turno A e Turno B)</span>
                                                <span className="text-[10px] text-slate-400">Habilita revezamento de turnos diários para esta máquina</span>
                                            </div>
                                        </label>

                                        {currentTabConfig.shiftCount === 2 && (
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 animate-fade">
                                                <div>
                                                    <span className="text-[10px] font-bold text-emerald-400 block mb-1">Início do Turno B</span>
                                                    <input
                                                        type="time"
                                                        value={currentTabConfig.shift2Start || '14:00'}
                                                        onChange={(e) => updateCurrentTabConfig({ shift2Start: e.target.value })}
                                                        style={{ colorScheme: 'dark' }}
                                                        className="w-full bg-[#0B1D2A] border border-emerald-500/30 rounded-lg px-2 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-400 text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-emerald-400 block mb-1">Término do Turno B</span>
                                                    <input
                                                        type="time"
                                                        value={currentTabConfig.shift2End || '23:59'}
                                                        onChange={(e) => updateCurrentTabConfig({ shift2End: e.target.value })}
                                                        style={{ colorScheme: 'dark' }}
                                                        className="w-full bg-[#0B1D2A] border border-emerald-500/30 rounded-lg px-2 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-400 text-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Automações Inteligentes e Segurança */}
                                <div className="bg-[#08131B] p-3.5 rounded-xl border border-white/10 space-y-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-[#00E5FF] block">
                                        ⚙️ Automações e Segurança de Turno
                                    </span>
                                    
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={currentTabConfig.autoStartShift !== false}
                                            onChange={(e) => updateCurrentTabConfig({ autoStartShift: e.target.checked })}
                                            className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 bg-[#0B1D2A] border-white/20 accent-[#00E5FF] mt-0.5"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-200 block">Iniciar turno automaticamente no horário programado</span>
                                            <span className="text-[10px] text-slate-400 leading-tight block">
                                                O sistema abre a contabilidade do turno pontualmente e exibe "Aguardando Check-in do Operador"
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={currentTabConfig.autoEndShift !== false}
                                            onChange={(e) => updateCurrentTabConfig({ autoEndShift: e.target.checked })}
                                            className="w-4 h-4 rounded text-amber-400 focus:ring-0 bg-[#0B1D2A] border-white/20 accent-amber-400 mt-0.5"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-amber-300 block">Encerramento automático com timer de 5 minutos</span>
                                            <span className="text-[10px] text-slate-400 leading-tight block">
                                                No término do turno, exibe contagem regressiva de 5 min na máquina e fecha com o último relato caso o operador não finalize
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={currentTabConfig.requireManagerAuthForOvertime !== false}
                                            onChange={(e) => updateCurrentTabConfig({ requireManagerAuthForOvertime: e.target.checked })}
                                            className="w-4 h-4 rounded text-rose-400 focus:ring-0 bg-[#0B1D2A] border-white/20 accent-rose-400 mt-0.5"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-rose-300 block">Exigir senha do gestor para iniciar/estender em Hora Extra</span>
                                            <span className="text-[10px] text-slate-400 leading-tight block">
                                                Bloqueia logins fora da jornada da máquina sem senha de gestor
                                            </span>
                                        </div>
                                    </label>
                                </div>

                                {/* Card de Cálculo em Tempo Real */}
                                <div className="bg-[#0B1D2A] p-3.5 rounded-xl border border-cyan-500/30 space-y-2.5">
                                    <div className="flex justify-between items-center text-xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                                Tempo Útil Calculado ({selectedMachineShiftTab === 'GLOBAL' ? 'Padrão' : selectedMachineShiftTab}):
                                            </span>
                                            <span className="text-[11px] text-slate-300">
                                                Carga horária líquida trabalhada
                                            </span>
                                        </div>
                                        <div className="text-right font-mono">
                                            <span className="text-xl font-black text-[#00E5FF] block">
                                                {formatMinutesToHoursMinutes(tempShiftDetails.totalWorkMinutes)}
                                            </span>
                                            <span className="text-[10px] text-cyan-300/90 font-bold">
                                                {tempShiftDetails.totalWorkHours.toFixed(2).replace('.', ',')} horas / dia
                                            </span>
                                        </div>
                                    </div>

                                    {!tempShiftDetails.isValid && (
                                        <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                            ⚠️ {tempShiftDetails.errorMessage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Conteúdo da Aba 2: Feriados & Folgas */}
                        {activeShiftTab === 'holidays' && (
                            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                                {/* Seletor dos Dias de Expediente da Semana */}
                                <div className="bg-[#08131B] p-3 rounded-xl border border-white/5">
                                    <span className="text-xs font-bold text-white block mb-1">
                                        Dias de Expediente da Fábrica
                                    </span>
                                    <p className="text-[10px] text-slate-400 mb-2">
                                        Selecione os dias da semana em que as máquinas operam (dias desmarcados não contam na duração das OPs):
                                    </p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {[
                                            { day: 1, label: 'Segunda' },
                                            { day: 2, label: 'Terça' },
                                            { day: 3, label: 'Quarta' },
                                            { day: 4, label: 'Quinta' },
                                            { day: 5, label: 'Sexta' }
                                        ].map(({ day, label }) => {
                                            const isChecked = (tempShiftConfig.workDays || [1, 2, 3, 4, 5]).includes(day);
                                            return (
                                                <label 
                                                    key={day}
                                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center cursor-pointer select-none transition-all ${
                                                        isChecked 
                                                            ? 'bg-cyan-500/15 border-[#00E5FF]/40 text-[#00E5FF] font-black' 
                                                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
                                                    }`}
                                                >
                                                    <input 
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const currentDays = tempShiftConfig.workDays || [1, 2, 3, 4, 5];
                                                            const newDays = e.target.checked
                                                                ? [...currentDays, day].sort()
                                                                : currentDays.filter(d => d !== day);
                                                            if (newDays.length === 0) {
                                                                showNotification?.('Mantenha ao menos 1 dia de expediente na semana.', 'error');
                                                                return;
                                                            }
                                                            setTempShiftConfig(prev => ({ ...prev, workDays: newDays }));
                                                        }}
                                                    />
                                                    <span className="text-xs">{label}</span>
                                                    <span className="text-[9px] mt-0.5 opacity-80">{isChecked ? '✓ Trabalha' : 'Folga'}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Formulário para Cadastrar Novo Feriado */}
                                <form onSubmit={handleAddHoliday} className="bg-[#0B1D2A] p-3 rounded-xl border border-rose-500/30 flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-300 tracking-wider">
                                        <PlusIcon className="w-4 h-4 text-rose-400" />
                                        <span>Adicionar Feriado / Dia Sem Produção</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                        <div className="sm:col-span-5">
                                            <input 
                                                type="date"
                                                value={newHolidayDate}
                                                onChange={(e) => setNewHolidayDate(e.target.value)}
                                                style={{ colorScheme: 'dark' }}
                                                className="w-full bg-[#08131B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-rose-400"
                                                required
                                            />
                                        </div>
                                        <div className="sm:col-span-7 flex items-center gap-2">
                                            <input 
                                                type="text"
                                                placeholder="Ex: Feriado Tiradentes, Manutenção"
                                                value={newHolidayDesc}
                                                onChange={(e) => setNewHolidayDesc(e.target.value)}
                                                className="w-full bg-[#08131B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-400"
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={isAddingHoliday}
                                                className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-sm"
                                            >
                                                {isAddingHoliday ? 'Salvando...' : '+ Cadastrar'}
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                {/* Lista de Feriados Cadastrados */}
                                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                                        <span>Feriados Cadastrados ({holidays.length})</span>
                                        <span>Ação</span>
                                    </div>

                                    {holidays.length === 0 ? (
                                        <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-xs text-slate-500 font-medium">
                                            Nenhum feriado cadastrado. Cadastre acima para que o PCP pule os dias automaticamente.
                                        </div>
                                    ) : (
                                        holidays.map(h => {
                                            const parts = h.date ? h.date.split('-') : [];
                                            const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : h.date;
                                            
                                            // Dia da semana do feriado
                                            const d = new Date(h.date + 'T00:00:00');
                                            const weekDayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()] || '';

                                            return (
                                                <div 
                                                    key={h.id} 
                                                    className="flex items-center justify-between bg-[#08131B] p-2 rounded-xl border border-white/5 hover:border-white/15 transition-all text-xs"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-black text-[11px] shrink-0">
                                                            {formattedDate}
                                                        </span>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-white truncate text-xs">
                                                                {h.description}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {weekDayName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteHoliday(h.id, h.description)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                                                        title="Excluir feriado"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Rodapé e Ações */}
                        <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-white/10 shrink-0">
                            <div className="flex items-center gap-1.5 text-[10px] text-cyan-300/80 font-mono font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Supabase Sincronizado</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsWorkHoursModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
                                >
                                    Fechar
                                </button>
                                <button
                                    type="button"
                                    disabled={isSavingShift}
                                    onClick={handleSaveShiftConfig}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#00B4D8] hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-[#00E5FF]/20 active:scale-95 transition-all flex items-center gap-1.5"
                                >
                                    {isSavingShift ? (
                                        <span>Salvando...</span>
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                                            <span>Salvar Jornada</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL EXCLUSIVO: CONFIGURAÇÃO DE TURNOS DA MÁQUINA SELECIONADA */}
            {/* ========================================================================= */}
            {machineShiftModalTarget && machineShiftModalDraft && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade p-3 sm:p-4">
                    <div className="w-full max-w-2xl sm:max-w-3xl pcp-glass-card rounded-2xl border border-cyan-500/40 p-5 sm:p-6 flex flex-col gap-4 text-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
                        {/* Cabeçalho */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-[#00E5FF] flex items-center justify-center border border-cyan-500/40 shrink-0">
                                    <CogIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black uppercase tracking-wider text-white">
                                            Configuração da Máquina
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-cyan-500/25 text-[#00E5FF] border border-cyan-500/40">
                                            {machineShiftModalTarget}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium">
                                        Comandos da OP ativa, ferramentas, turnos e paradas vinculadas no banco
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setMachineShiftModalTarget(null);
                                    setMachineShiftModalDraft(null);
                                }}
                                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Abas de Navegação do Modal: OP vs Equipamento vs Turnos vs Paradas */}
                        {(() => {
                            const isTrelica = Boolean(machineShiftModalTarget && machineShiftModalTarget.toLowerCase().includes('treli'));
                            return (
                                <div className={`grid ${isTrelica ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-1.5 p-1 bg-[#08131B] rounded-xl border border-white/10 shrink-0`}>
                                    <button
                                        type="button"
                                        onClick={() => setMachineShiftModalTab('op')}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                            machineShiftModalTab === 'op'
                                                ? 'bg-cyan-500/25 text-[#00E5FF] border border-cyan-500/40 shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span>📋 OP & Ações</span>
                                    </button>

                                    {isTrelica && (
                                        <button
                                            type="button"
                                            onClick={() => setMachineShiftModalTab('equipment')}
                                            className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                                machineShiftModalTab === 'equipment'
                                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <span>⚡ Rolos & Solda</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setMachineShiftModalTab('shifts')}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                            machineShiftModalTab === 'shifts'
                                                ? 'bg-cyan-500/25 text-[#00E5FF] border border-cyan-500/40 shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span>☀️ Turnos</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMachineShiftModalTab('downtimes')}
                                        className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                            machineShiftModalTab === 'downtimes'
                                                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span>🛑 Paradas</span>
                                        {localDowntimeConfigs.filter(c => {
                                            const mType = machineShiftModalTarget?.split(' ')[0] || '';
                                            return c.isActive && (!c.machineType || c.machineType === 'Geral' || c.machineType === mType);
                                        }).length > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-200">
                                                {localDowntimeConfigs.filter(c => {
                                                    const mType = machineShiftModalTarget?.split(' ')[0] || '';
                                                    return c.isActive && (!c.machineType || c.machineType === 'Geral' || c.machineType === mType);
                                                }).length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ABA: OP & COMANDOS DE PRODUÇÃO */}
                        {machineShiftModalTab === 'op' && (() => {
                            const machineOrders = productionOrders.filter(o => 
                                (o.scheduledMachine === machineShiftModalTarget || o.machine === machineShiftModalTarget) &&
                                o.status !== 'completed' && o.status !== 'cancelled'
                            );
                            const activeOP = machineOrders.find(o => o.status === 'in_progress' || (o.status as string) === 'em_producao') || machineOrders[0];

                            if (!activeOP) {
                                return (
                                    <div className="py-8 px-4 rounded-2xl bg-[#08131B] border border-white/10 text-center flex flex-col items-center gap-3 animate-fade">
                                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-2xl">
                                            📋
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-white font-black text-sm">
                                                Nenhuma OP agendada ou em andamento em {machineShiftModalTarget}
                                            </h4>
                                            <p className="text-xs text-slate-400">
                                                Programe uma nova ordem de produção na grade do PCP para habilitar os comandos de máquina.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMachineShiftModalTarget(null);
                                                handleOpenCreateModal(machineShiftModalTarget);
                                            }}
                                            className="mt-2 px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00cce6] text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            <span>Programar Nova OP</span>
                                        </button>
                                    </div>
                                );
                            }

                            const prog = getOPProgress(activeOP);
                            const title = activeOP.orderNumber || activeOP.id.slice(0, 6);
                            let trefilaSubtitle = '';
                            if (activeOP.machine?.startsWith('Trefila')) {
                                let pCode = activeOP.productCode || '';
                                let pDesc = activeOP.productDescription || '';
                                if (!pDesc || !pCode) {
                                    const cleanTarget = String(activeOP.targetBitola || '').replace('mm', '').trim();
                                    const matched = gauges.find((g: any) => {
                                        const mat = (g.materialType || '').toLowerCase();
                                        const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                                        if (!isCa60) return false;
                                        const gClean = String(g.gauge || '').replace('mm', '').trim();
                                        return g.gauge === activeOP.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
                                    });
                                    if (matched) {
                                        if (!pCode) pCode = matched.productCode || (matched as any).code || '';
                                        if (!pDesc) pDesc = matched.description || (matched as any).gaugeDescription || '';
                                    }
                                }
                                if (pDesc) {
                                    trefilaSubtitle = pCode && !pDesc.startsWith(pCode) ? `${pCode} - ${pDesc}` : pDesc;
                                } else {
                                    trefilaSubtitle = `Bitola ${activeOP.targetBitola || 'N/A'}mm`;
                                }
                            }

                            const subtitle = activeOP.productName || (
                                activeOP.machine?.startsWith('Trefila') ? trefilaSubtitle :
                                activeOP.machine?.startsWith('Treliça') ? `${activeOP.trelicaModel || 'Treliça'} • ${activeOP.tamanho || ''}m` :
                                activeOP.machine?.startsWith('Malha') ? `${activeOP.malhaModel || 'Malha'} (${activeOP.tamanho || ''})` :
                                'Ordem de Produção'
                            );
                            const isLive = prog.isLive;
                            const isPending = prog.isPending;

                            return (
                                <div className="space-y-3.5 animate-fade">
                                    {/* Card Principal da OP */}
                                    <div className="p-3.5 rounded-2xl bg-[#06121B] border border-white/10 relative overflow-hidden shadow-inner">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-base font-black text-white flex items-center flex-wrap gap-1">
                                                        <span>#{title}#</span>
                                                        {subtitle && <span className="text-xs text-slate-300 font-bold ml-1 tracking-normal truncate flex-1 min-w-0">{subtitle}</span>}
                                                    </span>
                                                    {isLive && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 animate-pulse">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                            EM PRODUÇÃO
                                                        </span>
                                                    )}
                                                    {isPending && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-amber-500/25 text-amber-200 px-2 py-0.5 rounded border border-amber-500/50">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                            AGENDADA
                                                        </span>
                                                    )}
                                                    {activeOP.operator && (
                                                        <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                            👷 {activeOP.operator}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-mono font-black text-[#00E5FF] block">
                                                    {prog.produced.toLocaleString('pt-BR')} / {prog.target.toLocaleString('pt-BR')} {prog.unit}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    Progresso: {prog.pct}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progresso */}
                                        <div className="w-full bg-black/40 rounded-full h-2 mt-2.5 overflow-hidden border border-white/10">
                                            <div 
                                                className={`h-full transition-all duration-300 ${isLive ? 'bg-gradient-to-r from-cyan-500 to-emerald-400' : 'bg-amber-400'}`}
                                                style={{ width: `${Math.min(100, prog.pct)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Grid dos 6 Botões de Comando */}
                                    <div className="space-y-1.5">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                                            Comandos de Produção da Máquina:
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {/* 1. Editar OP em Produção */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMachineShiftModalTarget(null);
                                                    setEditingInProgressOP(activeOP);
                                                }}
                                                className="p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <PencilIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-purple-200 block group-hover:text-purple-100">
                                                        Editar OP em Produção
                                                    </span>
                                                    <span className="text-[10px] text-purple-300/70 font-medium block leading-tight mt-0.5">
                                                        Nome, meta, lotes e turnos finalizados
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 2. Diagnóstico de Produção */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMachineShiftModalTarget(null);
                                                    setDiagnosticOP(activeOP);
                                                }}
                                                className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <ClipboardListIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-amber-200 block group-hover:text-amber-100">
                                                        Diagnóstico de Produção
                                                    </span>
                                                    <span className="text-[10px] text-amber-300/70 font-medium block leading-tight mt-0.5">
                                                        Planejado vs Realizado, velocidade e ritmo
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 3. Abrir Painel da Máquina */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMachineShiftModalTarget(null);
                                                    handleGoToProduction(activeOP);
                                                }}
                                                className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <PlayIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-emerald-200 block group-hover:text-emerald-100">
                                                        Abrir Painel da Máquina
                                                    </span>
                                                    <span className="text-[10px] text-emerald-300/70 font-medium block leading-tight mt-0.5">
                                                        Apontamento e painel ao vivo do operador
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 4. Imprimir Ficha de Produção */}
                                            <button
                                                type="button"
                                                onClick={() => handlePrintOP(activeOP)}
                                                className="p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <PrinterIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-cyan-200 block group-hover:text-cyan-100">
                                                        Imprimir Ficha de Produção (A4)
                                                    </span>
                                                    <span className="text-[10px] text-cyan-300/70 font-medium block leading-tight mt-0.5">
                                                        Ficha técnica com código de barras e especificações
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 5. Reagendar */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMachineShiftModalTarget(null);
                                                    openScheduleModal(activeOP);
                                                }}
                                                className="p-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <CalendarIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-sky-200 block group-hover:text-sky-100">
                                                        Reagendar OP
                                                    </span>
                                                    <span className="text-[10px] text-sky-300/70 font-medium block leading-tight mt-0.5">
                                                        Mudar data, máquina ou duração em dias
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 6. Desagendar */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleRemoveSchedule(activeOP.id);
                                                }}
                                                className="p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 text-left transition-all flex items-start gap-2.5 group cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                    <XIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-black text-rose-200 block group-hover:text-rose-100">
                                                        Desagendar OP
                                                    </span>
                                                    <span className="text-[10px] text-rose-300/70 font-medium block leading-tight mt-0.5">
                                                        Retirar a OP do cronograma da grade do PCP
                                                    </span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Outras OPs na Fila se houver */}
                                    {machineOrders.length > 1 && (
                                        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2.5">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                                                Outras OPs Agendadas nesta Máquina ({machineOrders.length - 1}):
                                            </span>
                                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                                {machineOrders.filter(o => o.id !== activeOP.id).map(queuedOp => (
                                                    <div key={queuedOp.id} className="p-2 rounded-xl bg-[#08131B] border border-white/5 flex items-center justify-between gap-2 text-xs">
                                                        <div className="min-w-0 truncate">
                                                            <span className="font-bold text-white">#{queuedOp.orderNumber}</span>
                                                            <span className="text-slate-400 text-[10px] ml-2 truncate">
                                                                {(() => {
                                                                    let qSub = queuedOp.productName || queuedOp.productDescription;
                                                                    if (!qSub && (queuedOp.machine?.startsWith('Trefila') || (queuedOp as any).scheduledMachine?.startsWith('Trefila'))) {
                                                                        const cleanTarget = String(queuedOp.targetBitola || '').replace('mm', '').trim();
                                                                        const matched = gauges.find((g: any) => {
                                                                            const mat = (g.materialType || '').toLowerCase();
                                                                            const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                                                                            if (!isCa60) return false;
                                                                            const gClean = String(g.gauge || '').replace('mm', '').trim();
                                                                            return g.gauge === queuedOp.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
                                                                        });
                                                                        if (matched) {
                                                                            const c = queuedOp.productCode || matched.productCode || (matched as any).code;
                                                                            const d = matched.description || (matched as any).gaugeDescription;
                                                                            qSub = d ? (c && !d.startsWith(c) ? `[${c}] ${d}` : d) : undefined;
                                                                        }
                                                                    }
                                                                    return qSub || (queuedOp.targetBitola ? `Bitola ${queuedOp.targetBitola}mm` : '') || queuedOp.trelicaModel || queuedOp.malhaModel;
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { setMachineShiftModalTarget(null); setEditingInProgressOP(queuedOp); }}
                                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-purple-300 cursor-pointer"
                                                                title="Editar OP"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { setMachineShiftModalTarget(null); handleGoToProduction(queuedOp); }}
                                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-emerald-300 cursor-pointer"
                                                                title="Abrir no Painel"
                                                            >
                                                                <PlayIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handlePrintOP(queuedOp)}
                                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-cyan-300 cursor-pointer"
                                                                title="Imprimir Ficha"
                                                            >
                                                                <PrinterIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleRemoveSchedule(queuedOp.id)}
                                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-rose-400 cursor-pointer"
                                                                title="Desagendar"
                                                            >
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ABA: ROLOS & SOLDA (EXCLUSIVO TRELIÇA) */}
                        {machineShiftModalTab === 'equipment' && Boolean(machineShiftModalTarget && machineShiftModalTarget.toLowerCase().includes('treli')) && (
                            <div className="space-y-4 animate-fade">
                                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#081822] to-amber-950/30 border border-cyan-500/30 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                            <span>⚡ Equipamento & Solda:</span>
                                            <span className="text-cyan-300">{machineShiftModalTarget}</span>
                                        </h4>
                                        <p className="text-[11px] text-slate-300">
                                            Gêmeo digital dos 5 desbobinadores e controle técnico da cabeça de solda
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setViewSpoolStandsMachine(machineShiftModalTarget)}
                                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                                        title="Expandir Porta-Rolos em Tela Cheia"
                                    >
                                        <span>⛶ Tela Cheia</span>
                                    </button>
                                </div>

                                {/* 1. Gêmeo Digital dos 5 Porta-Rolos */}
                                <div className="p-3 rounded-2xl bg-[#06121B] border border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🧲 Porta-Rolos (5 Posições)</span>
                                        </span>
                                        <span className="text-[10px] text-cyan-400 font-mono">
                                            1 Superior • 2 Senozóides • 2 Inferiores
                                        </span>
                                    </div>
                                    <div 
                                        onClick={() => setViewSpoolStandsMachine(machineShiftModalTarget)}
                                        className="cursor-pointer hover:border-cyan-500/40 transition-all rounded-xl"
                                        title="Clique para gerenciar bobinas e estoque"
                                    >
                                        <TrelicaSpoolStands 
                                            machineName={machineShiftModalTarget} 
                                            isCompact={true} 
                                            stock={stock} 
                                            productionOrders={productionOrders}
                                        />
                                    </div>
                                </div>

                                {/* 2. Botão/Card Comando Solda */}
                                <div className="p-3.5 rounded-2xl bg-[#06121B] border border-amber-500/30 flex items-center justify-between gap-3 hover:border-amber-400/60 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg shrink-0">
                                            ⚡
                                        </div>
                                        <div className="min-w-0">
                                            <h5 className="text-xs font-black text-amber-200 uppercase tracking-wider">
                                                Comando da Cabeça de Solda
                                            </h5>
                                            <p className="text-[11px] text-slate-300 mt-0.5">
                                                Calibração de eletrodos (Sup, Esq, Dir), desgaste, pressão pneumática e relatórios
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewWeldingHeadMachine(machineShiftModalTarget);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer"
                                    >
                                        <span>Abrir Painel Solda</span>
                                        <span>➔</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ABA 1: TURNOS & HORÁRIOS */}
                        {machineShiftModalTab === 'shifts' && (
                            <div className="space-y-4 animate-fade">
                                {/* Atalhos Rápidos por Tipo de Máquina */}
                                {machineShiftModalTarget.toLowerCase().includes('trefila') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMachineShiftModalDraft(prev => prev ? ({
                                                ...prev,
                                                shiftCount: 1,
                                                workStart: '07:45',
                                                workEnd: '17:33',
                                                noLunch: true
                                            }) : null);
                                        }}
                                        className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <span>⚡ Aplicar Padrão Trefila: 07:45 às 17:33 (1 Turno Contínuo)</span>
                                    </button>
                                )}
                                {machineShiftModalTarget.toLowerCase().includes('treli') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMachineShiftModalDraft(prev => prev ? ({
                                                ...prev,
                                                shiftCount: 2,
                                                workStart: '05:00',
                                                workEnd: '14:44',
                                                noLunch: false,
                                                lunchStart: '11:30',
                                                lunchEnd: '12:30',
                                                shift2Start: '14:48',
                                                shift2End: '23:36'
                                            }) : null);
                                        }}
                                        className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <span>⚡ Aplicar Padrão Treliça: 2 Turnos (A: 05:00-14:44 | B: 14:48-23:36)</span>
                                    </button>
                                )}

                                {/* Seletor de Quantidade de Turnos */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                                        Quantidade de Turnos desta Máquina:
                                    </label>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setMachineShiftModalDraft(prev => prev ? ({ ...prev, shiftCount: 1 }) : null)}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                                machineShiftModalDraft.shiftCount === 1
                                                    ? 'bg-cyan-500/25 border-[#00E5FF] text-white shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                                                    : 'bg-[#08131B] border-white/10 text-slate-400 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                                                    ☀️ 1º Turno (Único)
                                                </span>
                                                {machineShiftModalDraft.shiftCount === 1 && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 leading-tight">
                                                Máquina opera em turno único (relatório oculta Turno B)
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setMachineShiftModalDraft(prev => prev ? ({ ...prev, shiftCount: 2 }) : null)}
                                            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                                machineShiftModalDraft.shiftCount === 2
                                                    ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                                    : 'bg-[#08131B] border-white/10 text-slate-400 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
                                                    ⚡ 2 Turnos (A e B)
                                                </span>
                                                {machineShiftModalDraft.shiftCount === 2 && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 leading-tight">
                                                Máquina opera com revezamento de Turno A e Turno B
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Bloco: Horários do 1º Turno (Turno A) */}
                                <div className="bg-[#08131B] p-3.5 rounded-xl border border-white/10 space-y-3">
                                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                                        ☀️ Horários do 1º Turno {machineShiftModalDraft.shiftCount === 2 ? '(Turno A)' : ''}
                                    </span>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Hora de Início</label>
                                            <input
                                                type="time"
                                                value={machineShiftModalDraft.workStart || '07:00'}
                                                onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, workStart: e.target.value }) : null)}
                                                style={{ colorScheme: 'dark' }}
                                                className="w-full bg-[#0B1D2A] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-[#00E5FF] text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Hora de Término</label>
                                            <input
                                                type="time"
                                                value={machineShiftModalDraft.workEnd || '17:00'}
                                                onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, workEnd: e.target.value }) : null)}
                                                style={{ colorScheme: 'dark' }}
                                                className="w-full bg-[#0B1D2A] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-[#00E5FF] text-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Almoço */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(machineShiftModalDraft.noLunch)}
                                            onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, noLunch: e.target.checked }) : null)}
                                            className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 bg-[#0B1D2A] border-white/20 accent-[#00E5FF]"
                                        />
                                        <span className="text-xs font-bold text-slate-300">Sem intervalo de almoço (Turno Contínuo)</span>
                                    </label>

                                    {!machineShiftModalDraft.noLunch && (
                                        <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-white/5 animate-fade">
                                            <div>
                                                <label className="text-[10px] font-bold text-amber-300 block mb-1">Início Almoço</label>
                                                <input
                                                    type="time"
                                                    value={machineShiftModalDraft.lunchStart || '12:00'}
                                                    onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, lunchStart: e.target.value }) : null)}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="w-full bg-[#0B1D2A] border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-amber-400 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-amber-300 block mb-1">Retorno Almoço</label>
                                                <input
                                                    type="time"
                                                    value={machineShiftModalDraft.lunchEnd || '13:00'}
                                                    onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, lunchEnd: e.target.value }) : null)}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="w-full bg-[#0B1D2A] border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-amber-400 text-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bloco: Horários do 2º Turno (Turno B) */}
                                {machineShiftModalDraft.shiftCount === 2 && (
                                    <div className="bg-[#08131B] p-3.5 rounded-xl border border-emerald-500/30 space-y-3 animate-fade">
                                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                            🌙 Horários do 2º Turno (Turno B)
                                        </span>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Início do Turno B</label>
                                                <input
                                                    type="time"
                                                    value={machineShiftModalDraft.shift2Start || '14:48'}
                                                    onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, shift2Start: e.target.value }) : null)}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="w-full bg-[#0B1D2A] border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-400 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Término do Turno B</label>
                                                <input
                                                    type="time"
                                                    value={machineShiftModalDraft.shift2End || '23:36'}
                                                    onChange={(e) => setMachineShiftModalDraft(prev => prev ? ({ ...prev, shift2End: e.target.value }) : null)}
                                                    style={{ colorScheme: 'dark' }}
                                                    className="w-full bg-[#0B1D2A] border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-400 text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rodapé com botões de ação */}
                                <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10 shrink-0">
                                    <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-mono">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>Banco Supabase Vinculado</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMachineShiftModalTarget(null);
                                                setMachineShiftModalDraft(null);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs transition cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveMachineShiftModal}
                                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            💾 Salvar Turnos da {machineShiftModalTarget}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABA 2: PROGRAMAR PARADAS NA MÁQUINA */}
                        {machineShiftModalTab === 'downtimes' && (() => {
                            const machType = machineShiftModalTarget.split(' ')[0]; // 'Trefila', 'Treliça', 'Malha', 'Desbobinadeira'
                            const machineReasons = localDowntimeConfigs.filter(c => {
                                if (!c.machineType || c.machineType === 'Geral') return true;
                                return c.machineType.toLowerCase().includes(machType.toLowerCase()) || machType.toLowerCase().includes(c.machineType.toLowerCase());
                            });

                            return (
                                <div className="space-y-4 animate-fade">
                                    <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
                                        <span className="text-base shrink-0">🛑</span>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-rose-300 uppercase tracking-wide text-[11px]">
                                                Paradas Programadas • {machineShiftModalTarget}
                                            </span>
                                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                                Os motivos cadastrados abaixo aparecem <strong>em tempo real no App do Operador</strong> desta máquina para apontamento e registro de paradas.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Formulário de Adicionar Nova Parada */}
                                    <div className="bg-[#08131B] p-3.5 rounded-xl border border-white/10 space-y-2.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                                            + Cadastrar Novo Motivo de Parada no Banco
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ex: Troca de Rolo, Falha Mecânica, Quebra de Fio..."
                                                value={newDowntimeReason}
                                                onChange={(e) => setNewDowntimeReason(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMachineDowntime(); }}
                                                className="flex-1 bg-[#0B1D2A] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="240"
                                                    value={newDowntimeThreshold}
                                                    onChange={(e) => setNewDowntimeThreshold(Number(e.target.value))}
                                                    title="Tolerância em minutos"
                                                    className="w-16 bg-[#0B1D2A] border border-white/15 rounded-lg px-2 py-1.5 text-xs font-bold font-mono text-center text-rose-300 focus:outline-none focus:border-rose-400"
                                                />
                                                <span className="text-[10px] text-slate-400 font-bold">min</span>
                                                <button
                                                    type="button"
                                                    disabled={isSavingDowntime || !newDowntimeReason.trim()}
                                                    onClick={handleAddMachineDowntime}
                                                    className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer shrink-0"
                                                >
                                                    {isSavingDowntime ? 'Salvando...' : '+ Salvar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botão de Atalho para Restaurar Padrões */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-slate-400">
                                            Motivos Vinculados ({machineReasons.length})
                                        </span>
                                        <button
                                            type="button"
                                            disabled={isSavingDowntime}
                                            onClick={handleSeedDefaultMachineDowntimes}
                                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                            <span>⚡ Sincronizar Motivos Padrão de {machType} no Banco</span>
                                        </button>
                                    </div>

                                    {/* Lista de Motivos Cadastrados */}
                                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                                        {machineReasons.length === 0 ? (
                                            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-xs text-slate-400 font-medium flex flex-col items-center gap-2">
                                                <span>Nenhum motivo específico cadastrado no banco para {machineShiftModalTarget}.</span>
                                                <button
                                                    type="button"
                                                    onClick={handleSeedDefaultMachineDowntimes}
                                                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-[#00E5FF] hover:bg-cyan-500/30 border border-cyan-500/40 font-bold text-xs"
                                                >
                                                    ⚡ Inserir Motivos Padrão Agora
                                                </button>
                                            </div>
                                        ) : (
                                            machineReasons.map(c => (
                                                <div
                                                    key={c.id}
                                                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                                                        c.isActive
                                                            ? 'bg-[#08131B] border-white/10 hover:border-white/20'
                                                            : 'bg-[#08131B]/40 border-white/5 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleMachineDowntime(c)}
                                                            className={`w-4 h-4 rounded border flex items-center justify-center transition cursor-pointer ${
                                                                c.isActive
                                                                    ? 'bg-rose-500 border-rose-400 text-white'
                                                                    : 'bg-white/5 border-white/20'
                                                            }`}
                                                            title={c.isActive ? 'Clique para desativar' : 'Clique para ativar'}
                                                        >
                                                            {c.isActive && <span className="text-[10px] leading-none">✓</span>}
                                                        </button>
                                                        <span className={`font-bold truncate ${c.isActive ? 'text-white' : 'text-slate-400 line-through'}`}>
                                                            {c.reason}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-500/15 border border-rose-500/30 text-rose-300">
                                                            {c.thresholdMinutes || 15} min
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-slate-400">
                                                            {c.machineType || 'Geral'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`text-[10px] font-bold ${c.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                            {c.isActive ? 'Ativo no App' : 'Inativo'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMachineDowntime(c.id, c.reason)}
                                                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                                            title="Excluir do banco de dados"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Rodapé da aba de Paradas */}
                                    <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10 shrink-0">
                                        <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-mono">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <span>Sincronização em tempo real ativada</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMachineShiftModalTarget(null);
                                                setMachineShiftModalDraft(null);
                                            }}
                                            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs transition cursor-pointer"
                                        >
                                            Concluir e Fechar
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* MODAL 2: REAGENDAMENTO RÁPIDO DE OP EXISTENTE / ESTENDER PRAZO */}
            {selectedOP && (() => {
                const isAlreadyStarted = hasProductionStarted(selectedOP);
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade p-4">
                    <div className="w-full max-w-[420px] pcp-glass-card rounded-2xl border border-white/10 p-6 flex flex-col gap-4 text-slate-100">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5" />
                                {isAlreadyStarted ? `Estender Prazo • OP #${selectedOP.orderNumber}` : `Reprogramar OP #${selectedOP.orderNumber}`}
                            </h3>
                            <button onClick={() => setSelectedOP(null)} className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {isAlreadyStarted && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col gap-1">
                                <span className="font-bold flex items-center gap-1.5 text-amber-400 uppercase text-[10px] tracking-wider">
                                    <span>⚠️</span>
                                    <span>OP com produção em andamento</span>
                                </span>
                                <p className="text-[11px] leading-relaxed text-slate-300">
                                    Esta OP iniciou em <strong className="text-white">{formatFriendlyDate(selectedOP.plannedStartDate)}</strong>. A data de início permanece travada para preservar os apontamentos já realizados. Ajuste a duração abaixo para <strong>estender o prazo</strong> de entrega.
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máquina</label>
                                <select
                                    value={scheduleMachine}
                                    onChange={(e) => setScheduleMachine(e.target.value)}
                                    disabled={isAlreadyStarted}
                                    className={`w-full bg-[#0A1D2A] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white font-bold ${
                                        isAlreadyStarted ? 'opacity-60 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {MACHINES.map(m => (
                                        <option key={m.name} value={m.name}>{m.name} ({m.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Data de Início</span>
                                    {isAlreadyStarted && (
                                        <span className="text-[9px] font-bold text-amber-400 uppercase">🔒 Início Travado</span>
                                    )}
                                </label>
                                <input
                                    type="date"
                                    value={scheduleStartDate}
                                    onChange={(e) => setScheduleStartDate(e.target.value)}
                                    disabled={isAlreadyStarted}
                                    className={`w-full bg-[#0A1D2A] border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-[#00E5FF]/50 text-white font-bold ${
                                        isAlreadyStarted ? 'opacity-60 cursor-not-allowed bg-black/40' : ''
                                    }`}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                    <span>{isAlreadyStarted ? 'Duração Total (Dias Úteis)' : 'Duração Estimada'}</span>
                                    <span className="text-[#00E5FF] font-black">{scheduleDuration} {scheduleDuration === 1 ? 'dia' : 'dias'}</span>
                                </label>
                                <div className="flex items-center gap-3 bg-[#0A1D2A] border border-white/10 rounded-xl p-1 justify-between">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isAlreadyStarted) {
                                                const elapsed = countWorkingDaysBetween(selectedOP.plannedStartDate || scheduleStartDate, todayStr);
                                                if (scheduleDuration <= elapsed) {
                                                    showNotification?.(`Não é possível reduzir para menos de ${elapsed} dia(s), pois a produção já decorreu até hoje.`, 'warning');
                                                    return;
                                                }
                                            }
                                            setScheduleDuration(prev => Math.max(1, prev - 1));
                                        }}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black text-sm flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                    >
                                        -
                                    </button>
                                    <span className="text-xs font-bold text-white">{scheduleDuration}d</span>
                                    <button
                                        type="button"
                                        onClick={() => setScheduleDuration(prev => prev + 1)}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black text-sm flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    Término previsto: <strong className="text-white">{formatFriendlyDate(calculateEndDateByWorkDays(scheduleStartDate, scheduleDuration))}</strong>
                                </span>
                            </div>
                        </div>

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
                                className="flex-1 bg-[#00E5FF] hover:bg-[#00B4D8] text-slate-900 rounded-xl py-2.5 text-xs font-black transition-all shadow-md text-center active:scale-95 uppercase tracking-wider"
                            >
                                {isAlreadyStarted ? 'Salvar Extensão' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* DRAWER LATERAL: RAIO-X DA OP */}
            {drawerOP && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade">
                    <div 
                        className="fixed inset-0"
                        onClick={() => setDrawerOP(null)}
                    />
                    
                    <div className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto h-full z-10 animate-fade text-slate-800">
                        
                        {/* Topo do Drawer */}
                        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black tracking-widest text-blue-900 uppercase">RAIO-X DA ORDEM</span>
                                    {(() => {
                                        const p = getOPProgress(drawerOP);
                                        if (p.isCompleted) {
                                            return (
                                                <span className="flex items-center gap-1 text-[8px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                                                    CONCLUÍDA
                                                </span>
                                            );
                                        }
                                        if (p.isLive) {
                                            if (p.isStopped) {
                                                return (
                                                    <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded shadow-sm animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                        PARADA: {p.downtimeReason} ({formatDuration(p.downtimeDurationMs)})
                                                    </span>
                                                );
                                            }
                                            if (p.isPrep) {
                                                const isRedundant = (p.downtimeReason || '').trim().toLowerCase() === 'preparação' || (p.downtimeReason || '').trim().toLowerCase() === 'preparacao';
                                                return (
                                                    <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded shadow-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                                        {isRedundant ? `PREPARAÇÃO (${formatDuration(p.downtimeDurationMs)})` : `PREPARAÇÃO: ${p.downtimeReason} (${formatDuration(p.downtimeDurationMs)})`}
                                                    </span>
                                                );
                                            }
                                            if (p.isOffline) {
                                                return (
                                                    <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                                                        DESLIGADA: FINAL DE TURNO
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span className="flex items-center gap-1 text-[8px] font-extrabold uppercase bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white pulse-live" />
                                                    AO VIVO (EM OPERAÇÃO)
                                                </span>
                                            );
                                        }
                                        return (
                                            <span className="flex items-center gap-1 text-[8px] font-extrabold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                AGENDADA (AGUARDANDO INÍCIO)
                                            </span>
                                        );
                                    })()}
                                </div>
                                <h2 className="text-xl font-black text-blue-950 mt-1">OP #{drawerOP.orderNumber}</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{drawerOP.scheduledMachine || (drawerOP.machine as string)}</p>
                            </div>
                            <button 
                                onClick={() => setDrawerOP(null)}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Alerta de Máquina Parada no Raio-X */}
                        {(() => {
                            const p = getOPProgress(drawerOP);
                            if (p.isLive && p.isStopped) {
                                return (
                                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 flex flex-col gap-1.5 shadow-sm animate-pulse">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-rose-600">
                                                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                                                Máquina Parada em Operação
                                            </span>
                                            <span className="text-sm font-mono font-black text-white bg-rose-600 px-2.5 py-0.5 rounded shadow-sm">
                                                ⏱️ {formatDuration(p.downtimeDurationMs)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-rose-900 font-bold">
                                            Motivo registrado: <strong className="text-rose-950 font-black uppercase underline">{p.downtimeReason}</strong>
                                        </p>
                                    </div>
                                );
                            }
                            if (p.isLive && p.isPrep) {
                                return (
                                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col gap-1.5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700">
                                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                Máquina em Preparação / Setup
                                            </span>
                                            <span className="text-sm font-mono font-black text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded border border-amber-300">
                                                ⏱️ {formatDuration(p.downtimeDurationMs)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-800 font-bold">
                                            Atividade: <strong className="text-amber-950 font-black uppercase underline">{p.downtimeReason}</strong>
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Card de Evolução Geral */}
                        {(() => {
                            const prog = getOPProgress(drawerOP);
                            return (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Evolução Real</span>
                                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${prog.statusColor}`}>
                                            {prog.statusLabel}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <span className="text-2xl font-black text-slate-900">
                                            {prog.produced.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-500">{prog.unit}</span>
                                        </span>
                                        <span className="text-2xl font-black text-blue-700">
                                            {prog.pct}%
                                        </span>
                                    </div>

                                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden border border-slate-300">
                                        <div 
                                            className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${prog.pct}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-600">
                                        <span>Meta: {prog.target.toLocaleString('pt-BR')} {prog.unit}</span>
                                        <span>Restante: {Math.max(0, prog.target - prog.produced).toLocaleString('pt-BR')} {prog.unit}</span>
                                    </div>

                                    {!isViewer && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenAdjustQuantity(drawerOP, { mode: 'total' })}
                                                className="mt-2 w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98"
                                                title="Ajustar quantidade produzida desta OP no PCP e sincronizar com o operador"
                                            >
                                                <span>✏️</span>
                                                <span>Ajustar Quantidade Produzida (Gestor)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setEditingInProgressOP(drawerOP)}
                                                className="mt-2 w-full py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98"
                                                title="Editar OP em Produção (Nome, Meta, Turnos Finalizados)"
                                            >
                                                <PencilIcon className="w-4 h-4 text-orange-600" />
                                                <span>Editar OP em Produção (Nome, Meta, Turnos)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const today = new Date();
                                                    const machine = drawerOP.scheduledMachine || (drawerOP.machine as string) || 'Treliça 1';
                                                    const todayStats = getOpDayStats(drawerOP, today, machine);
                                                    setSelectedDailyReport({
                                                        op: drawerOP,
                                                        date: today,
                                                        dateStr: formatDateString(today),
                                                        dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][today.getDay()],
                                                        produced: todayStats.produced,
                                                        unit: (drawerOP.machine && drawerOP.machine.startsWith('Trefila')) ? 'kg' : 'pçs',
                                                        dayStats: todayStats
                                                    });
                                                }}
                                                className="mt-2 w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98"
                                                title="Ver paradas e motivos por dia desta OP"
                                            >
                                                <span>🛑</span>
                                                <span>Ver Paradas e Motivos (Por Dia)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const today = new Date();
                                                    const dateStr = formatDateString(today);
                                                    const machine = drawerOP.scheduledMachine || (drawerOP.machine as string) || 'Treliça 1';
                                                    const todayStats = getOpDayStats(drawerOP, today, machine);
                                                    const cleanTarget = String(drawerOP.targetBitola || '').replace('mm', '').trim();
                                                    const isTrefilaMach = String(machine || '').toLowerCase().includes('trefila');
                                                    let opCode = drawerOP.productCode;
                                                    let opDesc = drawerOP.productDescription;
                                                    if (isTrefilaMach && (!opCode || !opDesc) && (cleanTarget === '3.40' || cleanTarget === '3.4' || cleanTarget === '3,40' || drawerOP.orderNumber === '87493')) {
                                                        opCode = opCode || '8624';
                                                        opDesc = opDesc || 'CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*';
                                                    }
                                                    setOfficialReportModalData({
                                                        op: { ...drawerOP, productCode: opCode, productDescription: opDesc },
                                                        dateStr,
                                                        machine,
                                                        initialProduced: todayStats.produced,
                                                        initialOperator: todayStats.operatorName,
                                                        initialDayStats: todayStats
                                                    });
                                                }}
                                                className="mt-2 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-98"
                                                title="Abrir Ficha Oficial de Produção Diária (Impressão e WhatsApp)"
                                            >
                                                <span>📄</span>
                                                <span>Ficha Diária Oficial (A4 / WhatsApp)</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Ficha Técnica da OP */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs shadow-sm">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Especificações</h4>
                            
                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="text-slate-500">Tipo de Linha:</span>
                                <strong className="text-slate-900">{drawerOP.machine}</strong>
                            </div>

                            {drawerOP.targetBitola && (
                                <div className="flex justify-between py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Bitola:</span>
                                    <strong className="text-blue-700 font-black">{drawerOP.targetBitola} mm</strong>
                                </div>
                            )}

                            {drawerOP.trelicaModel && (
                                <div className="flex justify-between py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Modelo Treliça:</span>
                                    <strong className="text-emerald-700 font-black">{drawerOP.trelicaModel}</strong>
                                </div>
                            )}

                            {drawerOP.tamanho && (
                                <div className="flex justify-between py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Comprimento:</span>
                                    <strong className="text-slate-900">{drawerOP.tamanho}</strong>
                                </div>
                            )}

                            {drawerOP.malhaModel && (
                                <div className="flex justify-between py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Modelo Malha:</span>
                                    <strong className="text-purple-700 font-black">{drawerOP.malhaModel}</strong>
                                </div>
                            )}

                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="text-slate-500">Início Agendado:</span>
                                <strong className="text-slate-900">{drawerOP.plannedStartDate || 'Não agendado'}</strong>
                            </div>

                            <div className="flex justify-between py-1">
                                <span className="text-slate-500">Duração Estimada:</span>
                                <strong className="text-slate-900">{drawerOP.estimatedDurationDays || 1} dia(s)</strong>
                            </div>
                        </div>

                        {/* Apontamentos Recentes de Turno */}
                        {(() => {
                            const relatedReports = shiftReports.filter(r => 
                                r.productionOrderId === drawerOP.id || 
                                (drawerOP.orderNumber && r.orderNumber === drawerOP.orderNumber)
                            );

                            return (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                            Apontamentos de Turno ({relatedReports.length})
                                        </h4>
                                    </div>

                                    {relatedReports.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-2 text-center">Nenhum apontamento registrado ainda.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                            {relatedReports.map(rep => (
                                                <div key={rep.id} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex justify-between items-center shadow-sm">
                                                    <div>
                                                        <span className="text-slate-900 font-bold block">{rep.operator || 'Operador'}</span>
                                                        <span className="text-[10px] text-slate-500">{rep.date || rep.shiftStartTime?.split('T')[0]}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-blue-700 font-black block">
                                                            {rep.totalProducedWeight ? `${rep.totalProducedWeight.toLocaleString('pt-BR')} kg` : `${rep.totalProducedQuantity || 0} pçs`}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500">{rep.machine}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}


                        {/* Ações Rápidas do Drawer */}
                        <div className="mt-auto pt-4 border-t border-slate-200 flex flex-col gap-2.5">
                            <button
                                onClick={() => {
                                    const op = drawerOP;
                                    setDrawerOP(null);
                                    setDiagnosticOP(op);
                                }}
                                className="w-full bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-amber-200 border border-amber-500/40 font-black rounded-xl py-3 text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-amber-500/10 active:scale-95 transition-all uppercase tracking-wider"
                            >
                                <ClipboardListIcon className="w-4 h-4 text-amber-400" />
                                Diagnóstico da Produção (Planejado vs Realizado)
                            </button>

                            <button
                                onClick={() => {
                                    const op = drawerOP;
                                    setDrawerOP(null);
                                    handlePrintOP(op);
                                }}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-black rounded-xl py-3 text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-cyan-500/10 active:scale-95 transition-all uppercase tracking-wider"
                            >
                                <PrinterIcon className="w-4 h-4 text-cyan-400" />
                                Imprimir Ordem de Produção (Ficha A4)
                            </button>

                            <button
                                onClick={() => handleGoToProduction(drawerOP)}
                                className="w-full bg-gradient-to-r from-[#00E5FF] to-[#00B4D8] text-slate-950 font-black rounded-xl py-3 text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-[#00E5FF]/20 active:scale-95 transition-all uppercase tracking-wider"
                            >
                                <PlayIcon className="w-4 h-4 text-slate-950" />
                                Abrir Terminal de Produção
                            </button>

                            {!isViewer && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            const op = drawerOP;
                                            setDrawerOP(null);
                                            openScheduleModal(op);
                                        }}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <CalendarIcon className="w-4 h-4 text-[#00E5FF]" />
                                        Reprogramar
                                    </button>

                                    <button
                                        onClick={() => handleDeleteOP(drawerOP.id, drawerOP.orderNumber)}
                                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        Excluir OP
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 5: PARÂMETROS DE METAS DE PARADAS & CHECKLIST (FIXO NO PCP)         */}
            {/* ========================================================================= */}
            {isDowntimeLimitsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade p-3 sm:p-5 overflow-y-auto">
                    <div className="w-full max-w-2xl pcp-glass-card rounded-3xl border border-amber-500/30 p-6 flex flex-col gap-5 text-slate-100 shadow-2xl my-auto">
                        
                        {/* Topo do Modal */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                                    <AdjustmentsIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                                        Metas de Paradas & Parâmetros do Checklist
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Estipule os limites de tempo aceitáveis para cada etapa e motivo de parada
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDowntimeLimitsModalOpen(false)} 
                                className="text-slate-400 hover:text-white transition-colors p-1 rounded-xl hover:bg-white/5"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Corpo com os campos de parametrização */}
                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                            
                            {/* Bloco 1: Sequência Padrão do Checklist da Produção */}
                            <div className="bg-[#07131D] p-4 rounded-2xl border border-amber-500/20 space-y-3">
                                <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                                    <span>📋 1. Sequência Padrão de Paradas Programadas da OP</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Setup Inicial */}
                                    <div className="bg-[#0B1D2A] p-3 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                                                🔧 Setup de Máquina
                                            </span>
                                            <span className="text-[10px] text-amber-400 font-mono font-bold">Padrão Inicial</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min="5"
                                                max="360"
                                                value={customDowntimeLimits['Setup'] ?? 30}
                                                onChange={(e) => setCustomDowntimeLimits(prev => ({ ...prev, 'Setup': Number(e.target.value) }))}
                                                className="w-24 bg-black/40 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-sm font-bold text-center text-white focus:outline-none focus:border-amber-400 font-mono"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">minutos por setup</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 block mt-1">Tempo tolerado para preparação de ferramentas/bitola</span>
                                    </div>

                                    {/* Troca de Rolo */}
                                    <div className="bg-[#0B1D2A] p-3 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                                                🔄 Troca de Rolo / Bobina
                                            </span>
                                            <span className="text-[10px] text-cyan-400 font-mono font-bold">Por Lote</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min="1"
                                                max="60"
                                                value={customDowntimeLimits['Troca de Rolo / Preparação'] ?? 10}
                                                onChange={(e) => setCustomDowntimeLimits(prev => ({ ...prev, 'Troca de Rolo / Preparação': Number(e.target.value) }))}
                                                className="w-24 bg-black/40 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-sm font-bold text-center text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">minutos por troca</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 block mt-1">Tempo para alimentar e passar a nova ponta</span>
                                    </div>

                                    {/* Lubrificação */}
                                    <div className="bg-[#0B1D2A] p-3 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                                                🧴 Lubrificação
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-mono font-bold">Limite por Ciclo</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min="1"
                                                max="60"
                                                value={customDowntimeLimits['Lubrificação'] ?? 10}
                                                onChange={(e) => setCustomDowntimeLimits(prev => ({ ...prev, 'Lubrificação': Number(e.target.value) }))}
                                                className="w-24 bg-black/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-sm font-bold text-center text-white focus:outline-none focus:border-emerald-400 font-mono"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">minutos por parada</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 block mt-1">Acima deste limite conta como perda de tempo</span>
                                    </div>

                                    {/* Frequência de Lubrificação */}
                                    <div className="bg-[#0B1D2A] p-3 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                                                ⏱️ Cadência do Checklist
                                            </span>
                                            <span className="text-[10px] text-purple-400 font-mono font-bold">Frequência</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min="30"
                                                max="480"
                                                step="30"
                                                value={lubricationIntervalMin}
                                                onChange={(e) => setLubricationIntervalMin(Number(e.target.value))}
                                                className="w-24 bg-black/40 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-sm font-bold text-center text-white focus:outline-none focus:border-purple-400 font-mono"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">minutos ({(lubricationIntervalMin / 60).toFixed(1)}h)</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 block mt-1">Intervalo recomendado entre lubrificações sucessivas</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bloco 2: Paradas Operacionais & Tolerâncias de Manutenção */}
                            <div className="bg-[#07131D] p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between text-slate-300 font-black text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                                    <span>⚠️ 2. Tolerâncias para Paradas Não Programadas (Chão de Fábrica)</span>
                                    <span className="text-[10px] text-slate-500 lowercase">minutos tolerados</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                    {[
                                        { key: 'Enrosco de fio', label: 'Enrosco de Fio', icon: '🪢' },
                                        { key: 'Quebra fio', label: 'Quebra de Fio', icon: '⚡' },
                                        { key: 'Falha no sensor', label: 'Falha Sensor', icon: '🔌' },
                                        { key: 'Vazamento de água', label: 'Vazamento Água', icon: '💧' },
                                        { key: 'Limpeza', label: 'Limpeza Geral', icon: '🧹' },
                                        { key: 'Outros', label: 'Outros Motivos', icon: '❓' }
                                    ].map(item => (
                                        <div key={item.key} className="bg-[#0B1D2A] p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
                                            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1 truncate mb-1">
                                                <span>{item.icon}</span>
                                                <span className="truncate">{item.label}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    max="120"
                                                    value={customDowntimeLimits[item.key] ?? 10}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setCustomDowntimeLimits(prev => ({ ...prev, [item.key]: val }));
                                                    }}
                                                    className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-center text-white focus:outline-none focus:border-amber-400 font-mono"
                                                />
                                                <span className="text-[10px] text-slate-400">min</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Botões do Rodapé */}
                        <div className="flex items-center justify-between border-t border-white/10 pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    const defaultLimits = {
                                        'Setup': 30,
                                        'Troca de Rolo / Preparação': 10,
                                        'Lubrificação': 10,
                                        'Enrosco de fio': 10,
                                        'Quebra fio': 10,
                                        'Falha no sensor': 10,
                                        'Vazamento de água': 10,
                                        'Limpeza': 15,
                                        'Manutenção': 60,
                                        'Outros': 15
                                    };
                                    handleSaveDowntimeLimits(defaultLimits, 180);
                                }}
                                className="text-xs text-slate-400 hover:text-rose-400 font-bold transition-colors"
                            >
                                Restaurar Padrões de Fábrica
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDowntimeLimitsModalOpen(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveDowntimeLimits(customDowntimeLimits, lubricationIntervalMin)}
                                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all uppercase tracking-wider flex items-center gap-1.5"
                                >
                                    <CheckCircleIcon className="w-4 h-4 text-slate-950" />
                                    Salvar Parâmetros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 6: DIAGNÓSTICO DA PRODUÇÃO (PLANEJADO VS REALIZADO & CHECKLIST)     */}
            {/* ========================================================================= */}
            {diagnosticOP && (
                (() => {
                    const op = diagnosticOP;
                    const prog = getOPProgress(op);
                    const machineName = op.scheduledMachine || (op.machine as string) || 'Máquina';
                    const targetBitola = op.targetBitola;
                    const modelSubtitle = op.trelicaModel ? `${op.trelicaModel} (${op.tamanho || '6m'})` : op.malhaModel ? op.malhaModel : `Bitola ${targetBitola}mm`;
                    
                    // 1. Início da OP
                    const startRaw = op.startTime || op.creationDate;
                    const startDateObj = startRaw ? new Date(startRaw) : null;
                    const formattedStartTime = startDateObj && !isNaN(startDateObj.getTime())
                        ? startDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Não iniciado';
                    const formattedStartDate = startDateObj && !isNaN(startDateObj.getTime())
                        ? startDateObj.toLocaleDateString('pt-BR')
                        : '';

                    // 2. Tempo Total Decorrido da OP
                    const totalDurationMs = startDateObj && !isNaN(startDateObj.getTime())
                        ? (op.endTime ? new Date(op.endTime).getTime() - startDateObj.getTime() : Math.max(0, liveNow.getTime() - startDateObj.getTime()))
                        : 0;

                    // 3. Processamento de Eventos de Parada
                    const events = [...(op.downtimeEvents || [])].sort((a, b) => new Date(a.stopTime).getTime() - new Date(b.stopTime).getTime());
                    
                    const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';

                    // Metas estipuladas
                    const expectedSetupMin = op.setupTimeMinutes || customDowntimeLimits['Setup'] || 30;
                    const expectedRollChangeMin = op.rollChangeTimeMinutes || customDowntimeLimits['Troca de Rolo / Preparação'] || 10;
                    const expectedLubricationMin = customDowntimeLimits['Lubrificação'] || 10;

                    // Classificação e Checklist dos Eventos
                    let totalDowntimeMs = 0;
                    let totalLostTimeMs = 0; // Tempo excedido além das metas
                    let setupActualMs = 0;
                    let rollChangeActualMs = 0;
                    let rollChangeCount = 0;
                    let lubricationActualMs = 0;
                    let lubricationCount = 0;

                    // Mapa para agrupamento de perdas por motivo (Radar de Gargalos)
                    const reasonsLostTime: Record<string, { count: number; totalDurationMs: number; excessMs: number; expectedSingleMin: number }> = {};

                    const checklistItems: Array<{
                        id: string;
                        type: 'start' | 'setup' | 'lubrication' | 'roll_change' | 'stop' | 'lot' | 'shift_end';
                        title: string;
                        timeStr: string;
                        timestampMs: number;
                        durationMs?: number;
                        expectedDurationMin?: number;
                        status: 'ok' | 'warning' | 'error' | 'info';
                        statusText: string;
                        diffMinutes?: number;
                        observation?: string;
                    }> = [];

                    // Item 1: Entrada / Início
                    checklistItems.push({
                        id: 'start-step',
                        type: 'start',
                        title: '1° Horário de Entrada / Início da Produção',
                        timeStr: formattedStartTime,
                        timestampMs: startDateObj && !isNaN(startDateObj.getTime()) ? startDateObj.getTime() : 0,
                        status: startDateObj ? 'ok' : 'info',
                        statusText: startDateObj ? 'Início Registrado' : 'Aguardando Início',
                        observation: `Data: ${formattedStartDate || '--'} | Operador: ${op.operator || 'Não identificado'}`
                    });

                    // Iterar sobre as paradas
                    events.forEach((ev, idx) => {
                        const stopDate = new Date(ev.stopTime);
                        const resumeDate = ev.resumeTime ? new Date(ev.resumeTime) : liveNow;
                        const durationMs = Math.max(0, resumeDate.getTime() - stopDate.getTime());
                        const durationMin = Math.round(durationMs / 60000);
                        totalDowntimeMs += durationMs;

                        const reason = ev.reason || 'Outros';
                        const normReason = normalize(reason);

                        // Determinar tolerância da parada
                        let expectedMin = customDowntimeLimits[reason] || 10;
                        let itemType: 'setup' | 'lubrication' | 'roll_change' | 'stop' | 'shift_end' = 'stop';
                        let itemTitle = `Parada: ${reason}`;

                        if (normReason.includes('setup') || normReason.includes('ajuste')) {
                            itemType = 'setup';
                            expectedMin = expectedSetupMin;
                            setupActualMs += durationMs;
                            itemTitle = `🔧 Setup de Máquina (${durationMin} min)`;
                        } else if (normReason.includes('lubrific')) {
                            lubricationCount++;
                            itemType = 'lubrication';
                            expectedMin = expectedLubricationMin;
                            lubricationActualMs += durationMs;
                            itemTitle = `🧴 ${lubricationCount}° Lubrificação da Máquina`;
                        } else if (normReason.includes('troca de rolo') || normReason.includes('preparacao')) {
                            rollChangeCount++;
                            itemType = 'roll_change';
                            expectedMin = expectedRollChangeMin;
                            rollChangeActualMs += durationMs;
                            itemTitle = `🔄 ${rollChangeCount}° Troca de Rolo / Bobina`;
                        } else if (normReason.includes('final de turno') || normReason.includes('turno')) {
                            itemType = 'shift_end';
                            expectedMin = durationMin; // Não penaliza final de turno
                            itemTitle = `🌙 Máquina Desligada: Final de Turno`;
                        }

                        const diffMin = durationMin - expectedMin;
                        const excessMs = diffMin > 0 ? diffMin * 60000 : 0;
                        if (itemType !== 'shift_end') {
                            totalLostTimeMs += excessMs;
                        }

                        // Agrupar motivos
                        const groupKey = itemType === 'setup' ? 'Setup de Máquina' :
                                         itemType === 'lubrication' ? 'Lubrificação' :
                                         itemType === 'roll_change' ? 'Troca de Rolo' :
                                         itemType === 'shift_end' ? 'Final de Turno' : reason;
                        
                        if (!reasonsLostTime[groupKey]) {
                            reasonsLostTime[groupKey] = { count: 0, totalDurationMs: 0, excessMs: 0, expectedSingleMin: expectedMin };
                        }
                        reasonsLostTime[groupKey].count += 1;
                        reasonsLostTime[groupKey].totalDurationMs += durationMs;
                        reasonsLostTime[groupKey].excessMs += excessMs;

                        let status: 'ok' | 'warning' | 'error' | 'info' = 'ok';
                        let statusText = 'No Prazo';
                        if (itemType === 'shift_end') {
                            status = 'info';
                            statusText = 'Turno Concluído';
                        } else if (diffMin > 5) {
                            status = 'error';
                            statusText = `Estourou +${diffMin}m`;
                        } else if (diffMin > 0) {
                            status = 'warning';
                            statusText = `Alerta +${diffMin}m`;
                        } else if (diffMin < 0) {
                            status = 'ok';
                            statusText = `Economizou ${Math.abs(diffMin)}m`;
                        }

                        const timeFormatted = !isNaN(stopDate.getTime()) 
                            ? stopDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                            : '--:--';

                        checklistItems.push({
                            id: `stop-${idx}`,
                            type: itemType,
                            title: itemTitle,
                            timeStr: timeFormatted,
                            timestampMs: !isNaN(stopDate.getTime()) ? stopDate.getTime() : 0,
                            durationMs: durationMs,
                            expectedDurationMin: expectedMin,
                            diffMinutes: diffMin,
                            status: status,
                            statusText: statusText,
                            observation: ev.resumeTime ? `Concluída (${formatDuration(durationMs)})` : 'Em andamento ao vivo'
                        });
                    });

                    // Localizar Lote no Estoque
                    const findStockLot = (lotObjOrId: any) => {
                        if (!lotObjOrId) return undefined;
                        const targetId = typeof lotObjOrId === 'string' 
                            ? lotObjOrId 
                            : (lotObjOrId.lotId || lotObjOrId.id || lotObjOrId.internalLot);
                        if (!targetId) return undefined;
                        return stock.find(s => 
                            s.id === targetId || 
                            s.internalLot === targetId ||
                            (typeof lotObjOrId === 'object' && lotObjOrId.internalLot && s.internalLot === lotObjOrId.internalLot) ||
                            (typeof lotObjOrId === 'object' && lotObjOrId.lotId && s.id === lotObjOrId.lotId)
                        );
                    };

                    // Extrair lista de IDs de lotes selecionados no PCP
                    let selectedLotIdsList: string[] = [];
                    if (Array.isArray(op.selectedLotIds)) {
                        selectedLotIdsList = op.selectedLotIds.filter(Boolean);
                    } else if (op.selectedLotIds && typeof op.selectedLotIds === 'object') {
                        selectedLotIdsList = Object.values(op.selectedLotIds).flat().filter(Boolean) as string[];
                    }

                    // Inserir Lotes Processados no Checklist
                    const processedLots = op.processedLots || [];
                    const processedLotIdsSet = new Set<string>();

                    processedLots.forEach((lot, lIdx) => {
                        const stockItem = findStockLot(lot);
                        if (lot.lotId) processedLotIdsSet.add(lot.lotId);
                        if ((lot as any).id) processedLotIdsSet.add((lot as any).id);
                        if (stockItem?.id) processedLotIdsSet.add(stockItem.id);
                        if (stockItem?.internalLot) processedLotIdsSet.add(stockItem.internalLot);

                        const lotStart = lot.startTime ? new Date(lot.startTime) : null;
                        const lotEnd = lot.endTime ? new Date(lot.endTime) : null;
                        const lotTimeStr = lotStart && !isNaN(lotStart.getTime()) 
                            ? lotStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                            : '--:--';
                        const lotDurationMs = lotStart && lotEnd ? Math.max(0, lotEnd.getTime() - lotStart.getTime()) : undefined;

                        // Identificação do Lote (Número de Lote Interno e Corrida)
                        const lotNum = stockItem?.internalLot || (lot as any).internalLot || (lot.lotId && !lot.lotId.startsWith('STOCK-') ? lot.lotId : `${lIdx + 1}`);
                        const corrida = stockItem?.runNumber || (lot as any).runNumber;
                        const supplierLot = stockItem?.supplierLot || (lot as any).supplierLot;

                        // Pesos
                        const inputWeight = Number(stockItem?.initialQuantity || stockItem?.weight || stockItem?.labelWeight || (lot as any).inputWeight || (lot as any).initialWeight || 0);
                        const outputWeight = lot.finalWeight !== null && lot.finalWeight !== undefined 
                            ? Number(lot.finalWeight) 
                            : (lot as any).producedWeight !== null && (lot as any).producedWeight !== undefined 
                                ? Number((lot as any).producedWeight) 
                                : undefined;

                        // Descrição de material & bitola
                        const bitolaDesc = stockItem?.bitola 
                            ? (stockItem.bitola.toString().includes('mm') ? stockItem.bitola : `${stockItem.bitola}mm`) 
                            : (op.inputBitola ? `${op.inputBitola}mm` : '');
                        const materialDesc = stockItem?.materialType || 'Fio Máquina';

                        // Montar observação detalhada com lote, corrida, pesos e duração
                        const obsParts: string[] = [];
                        if (materialDesc || bitolaDesc) {
                            obsParts.push(`${materialDesc} ${bitolaDesc}`.trim());
                        }
                        if (inputWeight > 0 && outputWeight !== undefined && outputWeight > 0) {
                            obsParts.push(`Entrada: ${inputWeight.toLocaleString('pt-BR')} kg ➔ Saída: ${outputWeight.toLocaleString('pt-BR')} kg`);
                            if (inputWeight !== outputWeight) {
                                const diff = inputWeight - outputWeight;
                                obsParts.push(`Apara: ${diff > 0 ? '-' : '+'}${Math.abs(diff).toLocaleString('pt-BR')} kg`);
                            }
                        } else if (inputWeight > 0) {
                            obsParts.push(`Peso Bobina (Entrada): ${inputWeight.toLocaleString('pt-BR')} kg`);
                        } else if (outputWeight !== undefined && outputWeight > 0) {
                            obsParts.push(`Peso Produzido: ${outputWeight.toLocaleString('pt-BR')} kg`);
                        }

                        if (lotDurationMs) {
                            obsParts.push(`Duração: ${formatDuration(lotDurationMs)}`);
                        }
                        if ((lot as any).speed) {
                            obsParts.push(`Velocidade: ${(lot as any).speed.toFixed(1)} m/s`);
                        }
                        if (supplierLot) {
                            obsParts.push(`Lote Fornec.: ${supplierLot}`);
                        }

                        const displayWeight = outputWeight !== undefined && outputWeight > 0 
                            ? `${outputWeight.toLocaleString('pt-BR')} kg` 
                            : inputWeight > 0 
                                ? `${inputWeight.toLocaleString('pt-BR')} kg` 
                                : 'Processado';

                        const titleText = corrida 
                            ? `📦 Lote Processado: Lote #${lotNum} • Corrida: ${corrida}`
                            : `📦 Lote Processado: Lote #${lotNum}`;

                        checklistItems.push({
                            id: `lot-${lIdx}`,
                            type: 'lot',
                            title: titleText,
                            timeStr: lotTimeStr,
                            timestampMs: lotStart && !isNaN(lotStart.getTime()) ? lotStart.getTime() : 0,
                            durationMs: lotDurationMs,
                            status: 'ok',
                            statusText: displayWeight,
                            observation: obsParts.join(' • ')
                        });
                    });

                    // Inserir Lotes Programados Ainda Não Processados (se houver)
                    selectedLotIdsList.forEach((selectedId, pIdx) => {
                        if (processedLotIdsSet.has(selectedId)) return;
                        const stockItem = findStockLot(selectedId);
                        if (stockItem && (processedLotIdsSet.has(stockItem.id) || (stockItem.internalLot && processedLotIdsSet.has(stockItem.internalLot)))) return;

                        const lotNum = stockItem?.internalLot || selectedId;
                        const corrida = stockItem?.runNumber;
                        const inputWeight = Number(stockItem?.initialQuantity || stockItem?.weight || stockItem?.labelWeight || 0);
                        const bitolaDesc = stockItem?.bitola ? (stockItem.bitola.toString().includes('mm') ? stockItem.bitola : `${stockItem.bitola}mm`) : '';
                        const materialDesc = stockItem?.materialType || 'Fio Máquina';

                        checklistItems.push({
                            id: `pending-lot-${pIdx}`,
                            type: 'lot',
                            title: corrida ? `⏳ Lote Programado: Lote #${lotNum} • Corrida: ${corrida}` : `⏳ Lote Programado: Lote #${lotNum}`,
                            timeStr: '--:--',
                            timestampMs: Number.MAX_SAFE_INTEGER,
                            status: 'info',
                            statusText: inputWeight > 0 ? `${inputWeight.toLocaleString('pt-BR')} kg` : 'Aguardando',
                            observation: `${materialDesc} ${bitolaDesc} • Aguardando processamento • Bobina: ${inputWeight > 0 ? `${inputWeight.toLocaleString('pt-BR')} kg` : 'N/D'}`
                        });
                    });

                    // Ordenar itens cronologicamente (Início sempre em 1°, paradas e lotes por horário)
                    checklistItems.sort((a, b) => {
                        if (a.id === 'start-step') return -1;
                        if (b.id === 'start-step') return 1;
                        return a.timestampMs - b.timestampMs;
                    });

                    // Totais de Lotes e Pesos
                    const totalSelectedLotsCount = selectedLotIdsList.length > 0 ? selectedLotIdsList.length : processedLots.length;
                    const processedLotsCount = processedLots.length;

                    const totalInputWeight = (processedLots.length > 0 ? processedLots : selectedLotIdsList).reduce((acc, lotOrId) => {
                        const sItem = findStockLot(lotOrId);
                        const w = Number(sItem?.initialQuantity || sItem?.weight || sItem?.labelWeight || (typeof lotOrId === 'object' ? (lotOrId as any).inputWeight : 0) || 0);
                        return acc + w;
                    }, 0);

                    const totalProducedWeight = processedLots.reduce((acc, lot) => {
                        const w = lot.finalWeight !== null && lot.finalWeight !== undefined 
                            ? Number(lot.finalWeight) 
                            : (lot as any).producedWeight !== null && (lot as any).producedWeight !== undefined 
                                ? Number((lot as any).producedWeight) 
                                : 0;
                        return acc + w;
                    }, 0) || Number(op.totalProducedWeight || op.actualProducedWeight || 0);

                    // Tempo Produzindo Líquido (Tempo Total - Paradas)
                    const netProducingMs = Math.max(0, totalDurationMs - totalDowntimeMs);

                    // Ranking de Vilões de Tempo (Onde a Produção Perdeu Tempo)
                    const sortedBottlenecks = Object.entries(reasonsLostTime)
                        .filter(([k, v]) => k !== 'Final de Turno')
                        .sort((a, b) => b[1].excessMs - a[1].excessMs);

                    const hasBottleneck = sortedBottlenecks.some(b => b[1].excessMs > 0);

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade p-2 sm:p-4 overflow-y-auto">
                            <div className="w-full max-w-4xl pcp-glass-card rounded-3xl border border-white/15 p-5 sm:p-7 flex flex-col gap-5 text-slate-100 shadow-2xl my-auto">
                                
                                {/* Cabeçalho do Diagnóstico */}
                                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-amber-500/20 text-[#00E5FF] border border-[#00E5FF]/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                                            <ClipboardListIcon className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-lg font-black uppercase text-white tracking-wider">
                                                    Diagnóstico da Produção • OP #{op.orderNumber}
                                                </h2>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${prog.statusColor}`}>
                                                    {prog.statusLabel}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                                                <span>Linha: <strong className="text-white">{machineName}</strong></span>
                                                <span>•</span>
                                                <span>{modelSubtitle}</span>
                                                {(() => {
                                                    const diagEmp = findEmployeeByIdentifier(op.operator);
                                                    return (
                                                        <span className="flex items-center gap-1.5">
                                                            {diagEmp?.photoUrl && (
                                                                <img src={diagEmp.photoUrl} alt={diagEmp.name} className="w-4 h-4 rounded-full object-cover border border-cyan-400 inline-block" />
                                                            )}
                                                            <span>Operador: <strong className="text-white">{diagEmp ? formatShortName(diagEmp.name) : (op.operator || 'Não informado')}</strong></span>
                                                        </span>
                                                    );
                                                })()}
                                                {totalSelectedLotsCount > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-mono text-[11px] flex items-center gap-1">
                                                            📦 {processedLotsCount}/{totalSelectedLotsCount} Lotes
                                                            {totalProducedWeight > 0 ? ` • ⚖️ ${totalProducedWeight.toLocaleString('pt-BR')} kg` : totalInputWeight > 0 ? ` • ⚖️ ${totalInputWeight.toLocaleString('pt-BR')} kg` : ''}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setDiagnosticOP(null)} 
                                        className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/5"
                                    >
                                        <XIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* KPIs Principais de Produtividade & Tempo */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* KPI 1: Horário de Entrada */}
                                    <div className="bg-[#08131B] p-3.5 rounded-2xl border border-white/5 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                            <ClockIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
                                            <span>Entrada / Início</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className="text-xl font-black text-white font-mono">{formattedStartTime}</span>
                                            <span className="text-[10px] text-slate-500 block">{formattedStartDate || 'Data N/D'}</span>
                                        </div>
                                    </div>

                                    {/* KPI 2: Tempo Produzindo Líquido */}
                                    <div className="bg-[#08131B] p-3.5 rounded-2xl border border-cyan-500/20 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
                                            <span>⚡ Tempo Produzindo</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className="text-xl font-black text-[#00E5FF] font-mono">{formatDuration(netProducingMs)}</span>
                                            <span className="text-[10px] text-cyan-300/70 block">
                                                {totalDurationMs > 0 ? `${Math.round((netProducingMs / totalDurationMs) * 100)}% de eficiência` : '--'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* KPI 3: Tempo Total em Paradas */}
                                    <div className="bg-[#08131B] p-3.5 rounded-2xl border border-amber-500/20 flex flex-col justify-between">
                                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                            <span>⏱️ Total Paradas</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className="text-xl font-black text-amber-300 font-mono">{formatDuration(totalDowntimeMs)}</span>
                                            <span className="text-[10px] text-amber-300/70 block">
                                                {events.length} {events.length === 1 ? 'parada registrada' : 'paradas registradas'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* KPI 4: Saldo de Tempo Perdido (Gargalo) */}
                                    <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                                        totalLostTimeMs > 0 
                                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' 
                                             : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                                    }`}>
                                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                                            <span>{totalLostTimeMs > 0 ? '🔴 Tempo Perdido (Gargalo)' : '🟢 No Padrão Estipulado'}</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className="text-xl font-black font-mono">
                                                {totalLostTimeMs > 0 ? `+${Math.round(totalLostTimeMs / 60000)} min` : '0 min'}
                                            </span>
                                            <span className="text-[10px] opacity-80 block">
                                                {totalLostTimeMs > 0 ? 'acima das metas estipuladas' : 'dentro dos limites do PCP'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bloco "Radar: Onde a Produção Perdeu Tempo" */}
                                {hasBottleneck && (
                                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-2">
                                                <span>🔍 Onde Você Perdeu Tempo (Vilões de Produtividade)</span>
                                            </span>
                                            <span className="text-[10px] text-rose-400 font-mono font-bold">
                                                Total Excedente: {Math.round(totalLostTimeMs / 60000)} min
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                                            {sortedBottlenecks.filter(b => b[1].excessMs > 0).slice(0, 3).map(([reason, stats], rIdx) => {
                                                const excessMin = Math.round(stats.excessMs / 60000);
                                                const totalMin = Math.round(stats.totalDurationMs / 60000);
                                                return (
                                                    <div key={rIdx} className="bg-black/40 border border-rose-500/30 p-3 rounded-xl flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex justify-between items-center text-xs font-bold text-white mb-1">
                                                                <span className="truncate">{reason}</span>
                                                                <span className="text-rose-400 font-black font-mono">+{excessMin}m</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block">
                                                                {stats.count} ocorrência(s) • Total: {totalMin}m (meta: {stats.expectedSingleMin}m/cada)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                                                            <div 
                                                                className="h-full bg-rose-500 rounded-full" 
                                                                style={{ width: `${Math.min(100, (excessMin / Math.max(1, Math.round(totalLostTimeMs / 60000))) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Checklist Cronológico Passo a Passo */}
                                <div className="bg-[#08131B] p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-white">
                                                📋 Checklist de Paradas & Lotes em Tempo Real
                                            </span>
                                            <span className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                                {checklistItems.length} registros
                                            </span>
                                            {totalSelectedLotsCount > 0 && (
                                                <span className="text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold px-2 py-0.5 rounded-md font-mono hidden sm:inline">
                                                    {processedLotsCount} de {totalSelectedLotsCount} lotes processados
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                                            Compara tempos reais com as metas de setup, lubrificação e paradas
                                        </span>
                                    </div>

                                    {/* Lista de Itens do Checklist */}
                                    <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                                        {checklistItems.map((item, index) => {
                                            const isSetup = item.type === 'setup';
                                            const isLubrication = item.type === 'lubrication';
                                            const isRollChange = item.type === 'roll_change';
                                            const isLot = item.type === 'lot';
                                            const isStart = item.type === 'start';

                                            let badgeClass = 'bg-white/5 border-white/10 text-slate-300';
                                            if (item.status === 'ok') badgeClass = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
                                            if (item.status === 'warning') badgeClass = 'bg-amber-500/15 border-amber-500/30 text-amber-300';
                                            if (item.status === 'error') badgeClass = 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse';
                                            if (item.status === 'info') badgeClass = 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';

                                            return (
                                                <div 
                                                    key={item.id}
                                                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                                                        isLot 
                                                            ? 'bg-[#0A2234]/85 border-cyan-500/25 hover:border-cyan-500/45 shadow-sm' 
                                                            : 'bg-[#0B1D2A]/80 border-white/5 hover:border-white/15'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-16 font-mono text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                                            <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                                                            {item.timeStr}
                                                        </span>

                                                        <div className="flex flex-col">
                                                            <span className={`font-bold flex items-center gap-1.5 ${isLot ? 'text-cyan-100' : 'text-white'}`}>
                                                                {item.title}
                                                            </span>
                                                            {item.observation && (
                                                                <span className={`text-[10px] mt-0.5 ${isLot ? 'text-slate-300' : 'text-slate-400'}`}>
                                                                    {item.observation}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {item.expectedDurationMin !== undefined && (
                                                            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                                                                Meta: {item.expectedDurationMin}m
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border font-mono ${badgeClass}`}>
                                                            {isLot ? `⚖️ ${item.statusText}` : item.statusText}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Rodapé com Ações */}
                                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsDowntimeLimitsModalOpen(true);
                                        }}
                                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <AdjustmentsIcon className="w-4 h-4" />
                                        <span>Alterar Metas de Paradas no PCP</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handlePrintOP(op)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1.5"
                                        >
                                            <PrinterIcon className="w-4 h-4" />
                                            Imprimir OP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDiagnosticOP(null)}
                                            className="px-5 py-2 bg-gradient-to-r from-[#00E5FF] to-[#00B4D8] text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-[#00E5FF]/20 active:scale-95 transition-all uppercase tracking-wider"
                                        >
                                            Fechar Diagnóstico
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {/* MODAL / SUB-JANELA: GÊMEO DIGITAL DOS 5 PORTA-ROLOS DA TRELIÇA */}
            {viewSpoolStandsMachine && (
                <div 
                    className={`fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center ${
                        isSpoolStandsFullscreen ? 'p-0' : 'p-2 sm:p-4'
                    } animate-fade-in`}
                    onClick={() => setViewSpoolStandsMachine(null)}
                >
                    <div 
                        className={`bg-[#0A1620] border border-white/20 shadow-2xl flex flex-col transition-all duration-200 ${
                            isSpoolStandsFullscreen 
                                ? 'w-full h-full rounded-none p-3 sm:p-5 overflow-y-auto custom-scrollbar' 
                                : 'w-full max-w-[98vw] 2xl:max-w-[1720px] max-h-[97vh] rounded-3xl p-3 sm:p-5 overflow-y-auto custom-scrollbar'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-1">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-base">
                                    ⚙️
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                        PORTA-ROLOS & DESBOBINADORES: <span className="text-blue-400 font-mono">{viewSpoolStandsMachine}</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Monitoramento e troca de bobinas em tempo real (1 Superior • 2 Senozoides • 2 Inferiores)
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSpoolStandsFullscreen(!isSpoolStandsFullscreen)}
                                    className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center gap-1.5 font-bold text-xs transition border border-white/10"
                                    title={isSpoolStandsFullscreen ? "Restaurar para Janela Enquadrada" : "Expandir para Tela Cheia Total"}
                                >
                                    <span>{isSpoolStandsFullscreen ? '🗗 Janela' : '⛶ Tela Cheia'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewSpoolStandsMachine(null)}
                                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition"
                                    title="Fechar"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <TrelicaSpoolStands
                            machineName={viewSpoolStandsMachine}
                            stock={stock}
                            currentUser={currentUser}
                            productionOrders={productionOrders}
                            activeOrder={productionOrders.find(o => 
                                (o.machine === viewSpoolStandsMachine || (viewSpoolStandsMachine.startsWith('Treliça') && o.machine === 'Treliça')) && 
                                (o.status === 'in_progress' || o.status === 'Em Produção' || o.status === 'pending' || o.status === 'Aberta')
                            ) || null}
                        />
                    </div>
                </div>
            )}

            {/* Modal da Cabeça de Solda, Relatórios e Calibração de Eletrodos no Quadro PCP */}
            {viewWeldingHeadMachine && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[115] p-3 sm:p-6 animate-fade-in">
                    <div className="w-full max-w-7xl max-h-[94vh] overflow-y-auto custom-scrollbar">
                        <TrelicaWeldingHead
                            machineName={viewWeldingHeadMachine}
                            readOnly={false}
                            onClose={() => setViewWeldingHeadMachine(null)}
                            stock={stock}
                            gauges={gauges}
                        />
                    </div>
                </div>
            )}

            {/* Modal de Ajuste de Quantidade Produzida pelo Gestor */}
            {adjustQuantityConfig && (
                <AdjustQuantityModal
                    order={adjustQuantityConfig.order}
                    initialMode={adjustQuantityConfig.initialMode || 'shift'}
                    context={{
                        dayStats: adjustQuantityConfig.dayStats,
                        targetDay: adjustQuantityConfig.targetDay,
                        dayColName: adjustQuantityConfig.dayColName,
                        operatorName: adjustQuantityConfig.operatorName,
                        shiftProduced: adjustQuantityConfig.shiftProduced
                    }}
                    onClose={() => setAdjustQuantityConfig(null)}
                    onSave={handleSaveAdjustQuantity}
                />
            )}

            {/* Modal de Edição da OP em Produção (Nome, Meta, Turnos Finalizados) */}
            {editingInProgressOP && (
                <EditActiveOPModal
                    order={editingInProgressOP}
                    shiftReports={shiftReports}
                    gauges={gauges}
                    onClose={() => setEditingInProgressOP(null)}
                    onSave={handleSaveActiveOPEdit}
                />
            )}

            {/* Modal de Autorização do Gestor para Ajuste de Quantidade */}
            {showManagerAuthForAdjust && (
                <ManagerAuthModalForAdjust
                    onSuccess={handleManagerAuthSuccessForAdjust}
                    onCancel={() => {
                        setShowManagerAuthForAdjust(false);
                        setPendingAdjustConfig(null);
                    }}
                    users={users}
                />
            )}

            {/* Modal de Relatório Diário (Paradas e Motivos por Dia) */}
            {selectedDailyReport && (
                <DailyDowntimeReportModal
                    data={selectedDailyReport}
                    onClose={() => setSelectedDailyReport(null)}
                    weekDays={weekDays}
                    productionOrders={productionOrders}
                    shiftReports={shiftReports}
                    shiftConfig={shiftConfig}
                    stock={stock}
                    gauges={gauges}
                    employees={employees}
                    users={users}
                    getOpDayStats={getOpDayStats}
                />
            )}

            {/* Modal da Ficha Oficial de Produção Diária (Aberto via Gaveta ou Atalho) */}
            {officialReportModalData && (
                <DailyProductionReportSheetModal
                    isOpen={Boolean(officialReportModalData)}
                    onClose={() => setOfficialReportModalData(null)}
                    machine={officialReportModalData.machine}
                    dateStr={officialReportModalData.dateStr}
                    op={officialReportModalData.op}
                    shiftReports={shiftReports}
                    productionOrders={productionOrders}
                    initialProduced={officialReportModalData.initialProduced}
                    initialOperator={officialReportModalData.initialOperator}
                    initialDayStats={officialReportModalData.initialDayStats}
                    shiftConfig={shiftConfig}
                    stock={stock}
                    gauges={gauges}
                    employees={employees}
                    users={users}
                />
            )}

            {/* Modal de Lançamento de Peso de Lote Aguardando Pesagem (Trefila 1 e 2) */}
            {weighingLotModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-fade" onClick={() => setWeighingLotModal(null)}>
                    <div className="bg-[#0A1B27] rounded-2xl border border-amber-400/40 shadow-2xl w-full max-w-md text-slate-100 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Topo */}
                        <div className="p-4 border-b border-white/10 bg-[#08131B] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 text-xl font-bold">
                                    ⚖️
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                                        Lançar Peso do Lote
                                    </h3>
                                    <p className="text-xs text-amber-300 font-mono">
                                        OP #{weighingLotModal.op.orderNumber} • {weighingLotModal.op.scheduledMachine || weighingLotModal.op.machine}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWeighingLotModal(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo */}
                        <form onSubmit={handleSaveLotWeight} className="p-5 flex flex-col gap-4">
                            <div className="p-3 bg-amber-950/20 border border-amber-400/20 rounded-xl flex items-center justify-between font-mono text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Lote Finalizado</span>
                                    <strong className="text-amber-300 text-sm">{weighingLotModal.lotName}</strong>
                                </div>
                                {weighingLotModal.entryWeight > 0 && (
                                    <div className="text-right">
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Peso Inicial (MP)</span>
                                        <span className="text-slate-200 font-black">{weighingLotModal.entryWeight.toLocaleString('pt-BR')} kg</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                                    Peso da Balança (KG Saída) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={lotWeightInput}
                                        onChange={(e) => setLotWeightInput(e.target.value)}
                                        placeholder="Ex: 2050"
                                        autoFocus
                                        required
                                        className="w-full p-3 pr-12 bg-black/50 border border-white/20 focus:border-amber-400 rounded-xl text-white font-mono text-xl font-black outline-none transition text-center"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black font-mono pointer-events-none">
                                        KG
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                    Ao salvar, o lote sai de "Aguardando Peso" e soma automaticamente na produção do dia e total da OP.
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Bitola Aferida (mm) - Opcional
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={measuredGaugeInput}
                                        onChange={(e) => setMeasuredGaugeInput(e.target.value)}
                                        placeholder={weighingLotModal.op.targetBitola || '4.20'}
                                        className="w-full p-2.5 pr-12 bg-black/40 border border-white/10 focus:border-amber-400 rounded-xl text-slate-200 font-mono text-sm font-bold outline-none transition text-center"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono pointer-events-none">
                                        mm
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10 mt-1">
                                <button
                                    type="button"
                                    onClick={() => setWeighingLotModal(null)}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingLotWeight}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isSavingLotWeight ? (
                                        <span>Salvando...</span>
                                    ) : (
                                        <>
                                            <span>Salvar Peso</span>
                                            <span>⚖️</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// COMPONENTE: Modal de Relatório Diário e Paradas por Dia da OP
// ============================================================================
interface DailyDowntimeReportModalProps {
    data: {
        op: ProductionOrderData;
        date: Date;
        dateStr: string;
        dayName: string;
        produced: number;
        unit: string;
        dayStats?: any;
    };
    onClose: () => void;
    weekDays: Date[];
    productionOrders: ProductionOrderData[];
    shiftReports?: ShiftReport[];
    shiftConfig?: PcpShiftConfig;
    stock?: StockItem[];
    gauges?: StockGauge[];
    employees?: Employee[];
    users?: User[];
    getOpDayStats?: (op: ProductionOrderData, date: Date, machName: string) => any;
}

const DailyDowntimeReportModal: React.FC<DailyDowntimeReportModalProps> = ({
    data,
    onClose,
    weekDays,
    productionOrders,
    shiftReports = [],
    shiftConfig,
    stock = [],
    gauges = [],
    employees = [],
    users = [],
    getOpDayStats
}) => {
    const activeOp = productionOrders.find(o => o.id === data.op.id) || data.op;
    const [selectedDateStr, setSelectedDateStr] = useState<string>(data.dateStr);
    const [showOfficialReport, setShowOfficialReport] = useState<boolean>(false);

    const parseDateOnly = (val: any): string => {
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

    // Coleta todas as paradas da OP
    const allStops = useMemo(() => {
        const stopsList: {
            id: string;
            reason: string;
            stopTime: string;
            resumeTime: string | null;
            durationMin: number;
            dateStr: string;
            timeFormatted: string;
            operator?: string;
            isOngoing: boolean;
        }[] = [];

        // 1. Paradas de activeOp.downtimeEvents (ou downtime_events)
        const rawOpEvents = activeOp.downtimeEvents || (activeOp as any).downtime_events || [];
        rawOpEvents.forEach((e: any, idx: number) => {
            if (!e) return;
            const stopTime = e.stopTime || e.stop_time || '';
            const resumeTime = e.resumeTime || e.resume_time || null;
            const sDate = new Date(stopTime);
            const rDate = resumeTime ? new Date(resumeTime) : null;
            const isValidStop = !isNaN(sDate.getTime());
            
            let dur = 0;
            const rawDur = e.durationMin ?? e.duration_min;
            if (rawDur !== undefined && !isNaN(Number(rawDur)) && Number(rawDur) > 0) {
                dur = Number(rawDur);
            } else if (isValidStop) {
                const endMs = rDate && !isNaN(rDate.getTime()) ? rDate.getTime() : Date.now();
                dur = Math.max(0, Math.round((endMs - sDate.getTime()) / 60000));
            }

            const rawReason = e.reason || e.motivo || 'Sem motivo registrado';
            const justStr = e.justification ? ` - ${e.justification.trim()}` : '';
            const fullReason = `${rawReason}${justStr}`;
            const reasonNorm = rawReason.toLowerCase().trim();
            const sHour = isValidStop ? sDate.getHours() : 12;
            const isTurnoEndReason = reasonNorm.includes('final de turno') || 
                                     reasonNorm.includes('fim de turno') || 
                                     reasonNorm.includes('aguardando início') ||
                                     reasonNorm.includes('encerramento');
            // Desconsiderar paradas fantasmas de 'Final de Turno' com 0 minutos ou interjornadas noturnas
            if (isTurnoEndReason && (dur > 180 || dur === 0)) {
                return;
            }
            if (dur > 480 && (sHour >= 17 || sHour < 6)) {
                return;
            }

            const dStr = parseDateOnly(stopTime) || data.dateStr;

            // Desduplicar 'Final de Turno' ou paradas com horários e motivos idênticos/sobrepostos
            const existingIdx = stopsList.findIndex(s => {
                if (s.dateStr !== dStr) return false;
                const prevTime = new Date(s.stopTime).getTime();
                const curTime = sDate.getTime();
                const sameTime = Math.abs(prevTime - curTime) < 90000;
                const sReason = s.reason.toLowerCase();
                return sameTime && (sReason.includes(reasonNorm.substring(0, 8)) || reasonNorm.includes(sReason.substring(0, 8)));
            });
            if (existingIdx !== -1) {
                if (fullReason.length > stopsList[existingIdx].reason.length) {
                    stopsList[existingIdx].reason = fullReason;
                }
                if (dur > stopsList[existingIdx].durationMin) {
                    stopsList[existingIdx].durationMin = dur;
                }
                return;
            }

            const timeFormatted = isValidStop
                ? `${sDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${rDate && !isNaN(rDate.getTime()) ? ` às ${rDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ' (Em andamento)'}`
                : 'Horário não informado';

            stopsList.push({
                id: `op-event-${idx}`,
                reason: fullReason,
                stopTime: String(stopTime),
                resumeTime: resumeTime ? String(resumeTime) : null,
                durationMin: dur,
                dateStr: dStr,
                timeFormatted,
                operator: e.operator,
                isOngoing: !resumeTime
            });
        });

        // 2. Paradas de shiftReports correspondentes
        const matchingReports = shiftReports.filter(r => r.productionOrderId === activeOp.id || r.orderNumber === activeOp.orderNumber);
        matchingReports.forEach((r, rIdx) => {
            const reportDate = r.date || parseDateOnly(r.shiftStartTime || r.shiftEndTime) || data.dateStr;
            
            (r.downtimeEvents || []).forEach((e: any, eIdx: number) => {
                const stopTime = e.stopTime || r.shiftStartTime || '';
                const resumeTime = e.resumeTime || null;
                const sDate = new Date(stopTime);
                const rDate = resumeTime ? new Date(resumeTime) : null;
                const isValidStop = !isNaN(sDate.getTime());

                let dur = 0;
                if (e.durationMin !== undefined && !isNaN(Number(e.durationMin)) && Number(e.durationMin) > 0) {
                    dur = Number(e.durationMin);
                } else if (isValidStop) {
                    const endMs = rDate && !isNaN(rDate.getTime()) ? rDate.getTime() : Date.now();
                    dur = Math.max(0, Math.round((endMs - sDate.getTime()) / 60000));
                }

                const rNorm = (e.reason || '').toLowerCase().trim();
                const sHour = isValidStop ? sDate.getHours() : 12;
                const isTurnoEndReason = rNorm.includes('final de turno') || 
                                         rNorm.includes('fim de turno') || 
                                         rNorm.includes('aguardando início') ||
                                         rNorm.includes('encerramento');
                if (isTurnoEndReason && (dur > 180 || dur === 0)) {
                    return;
                }
                if (dur > 480 && (sHour >= 17 || sHour < 6)) {
                    return;
                }

                const dStr = parseDateOnly(stopTime) || reportDate;
                const timeFormatted = isValidStop 
                    ? `${sDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${rDate && !isNaN(rDate.getTime()) ? ` às ${rDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                    : 'Horário do turno';

                const isDupe = stopsList.some(s => {
                    if (s.dateStr !== dStr) return false;
                    const prevTime = new Date(s.stopTime).getTime();
                    const curTime = sDate.getTime();
                    const sameTime = Math.abs(prevTime - curTime) < 90000;
                    const sReason = s.reason.toLowerCase();
                    const matchReason = sReason.includes(rNorm.substring(0, 8)) || rNorm.includes(sReason.substring(0, 8));
                    return sameTime && (matchReason || s.durationMin === dur);
                });
                if (!isDupe) {
                    stopsList.push({
                        id: `rep-event-${rIdx}-${eIdx}`,
                        reason: e.reason || 'Parada de Turno',
                        stopTime: String(stopTime),
                        resumeTime: resumeTime ? String(resumeTime) : null,
                        durationMin: dur,
                        dateStr: dStr,
                        timeFormatted,
                        operator: r.operator || e.operator,
                        isOngoing: false
                    });
                }
            });

            (r.stops || []).forEach((s: any, sIdx: number) => {
                const isDupe = stopsList.some(item => item.dateStr === reportDate && item.reason === s.reason);
                if (!isDupe) {
                    stopsList.push({
                        id: `rep-stop-${rIdx}-${sIdx}`,
                        reason: s.reason || 'Parada de Turno',
                        stopTime: r.shiftStartTime || '',
                        resumeTime: null,
                        durationMin: Number(s.duration) || 0,
                        dateStr: reportDate,
                        timeFormatted: 'Registrado no Fechamento de Turno',
                        operator: r.operator,
                        isOngoing: false
                    });
                }
            });
        });

        return stopsList.sort((a, b) => {
            const timeA = new Date(a.stopTime).getTime() || 0;
            const timeB = new Date(b.stopTime).getTime() || 0;
            return timeB - timeA;
        });
    }, [activeOp, shiftReports, data.dateStr]);

    // Abas de dias
    const dayTabs = useMemo(() => {
        const tabs: { label: string; dateStr: string; dayName: string; count: number }[] = [];
        
        weekDays.forEach((day, idx) => {
            const dStr = formatDateString(day);
            const dName = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][idx] || '';
            const count = allStops.filter(s => s.dateStr === dStr).length;
            tabs.push({
                label: `${dName} ${formatFriendlyDate(day)}`,
                dateStr: dStr,
                dayName: dName,
                count
            });
        });

        // Datas fora de Seg-Sex (ex: Domingo ou semanas anteriores)
        const otherDates = Array.from(new Set(allStops.map(s => s.dateStr))).filter((dStr): dStr is string => Boolean(dStr && !tabs.some(t => t.dateStr === dStr)));
        otherDates.forEach((dStr: string) => {
            const dt = new Date(dStr + 'T12:00:00');
            const dName = isNaN(dt.getTime()) ? 'Dia' : (['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()] || '');
            const count = allStops.filter(s => s.dateStr === dStr).length;
            tabs.push({
                label: isNaN(dt.getTime()) ? dStr : `${dName} ${formatFriendlyDate(dt)}`,
                dateStr: dStr,
                dayName: dName,
                count
            });
        });

        return tabs;
    }, [weekDays, allStops]);

    // Paradas filtradas pela data selecionada ou todas
    const filteredStops = useMemo(() => {
        if (selectedDateStr === 'ALL') {
            return allStops;
        }
        return allStops.filter(s => s.dateStr === selectedDateStr);
    }, [allStops, selectedDateStr]);

    const totalMinutes = useMemo(() => {
        // Calcular minutos de parada evitando contagem duplicada de intervalos sobrepostos
        const intervals: [number, number][] = [];
        filteredStops.forEach(s => {
            const sDate = new Date(s.stopTime);
            if (isNaN(sDate.getTime()) || s.durationMin <= 0) return;
            const startMin = sDate.getHours() * 60 + sDate.getMinutes();
            const endMin = startMin + s.durationMin;
            intervals.push([startMin, endMin]);
        });
        if (intervals.length === 0) return filteredStops.reduce((acc, s) => acc + (s.durationMin || 0), 0);
        intervals.sort((a, b) => a[0] - b[0]);
        let mergedTotal = 0;
        let [curStart, curEnd] = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
            const [nextStart, nextEnd] = intervals[i];
            if (nextStart <= curEnd) {
                curEnd = Math.max(curEnd, nextEnd);
            } else {
                mergedTotal += (curEnd - curStart);
                curStart = nextStart;
                curEnd = nextEnd;
            }
        }
        mergedTotal += (curEnd - curStart);
        return mergedTotal;
    }, [filteredStops]);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formattedDuration = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

    const selectedTab = dayTabs.find(t => t.dateStr === selectedDateStr);
    const activeLabel = selectedDateStr === 'ALL' ? 'Todas as Paradas da OP' : (selectedTab?.label || selectedDateStr);

    const targetReportDateStr = selectedDateStr === 'ALL' ? data.dateStr : selectedDateStr;
    const machName = activeOp.scheduledMachine || (activeOp.machine as string) || 'Malha 1';

    // Obter estatísticas dinâmicas fiéis do PCP para o dia ativo (Ritmo, Ciclo, Efetivo, Paradas, Produção)
    const activeDayStats = useMemo(() => {
        if (getOpDayStats && targetReportDateStr) {
            const targetDate = new Date(targetReportDateStr + 'T12:00:00');
            return getOpDayStats(activeOp, targetDate, machName);
        }
        return targetReportDateStr === data.dateStr ? data.dayStats : undefined;
    }, [getOpDayStats, activeOp, targetReportDateStr, machName, data.dateStr, data.dayStats]);

    // Calcular produção e operador para a data ativa na Ficha Oficial
    const { dayProduced, dayOperator } = useMemo(() => {
        let produced = 0;
        let operatorName = '';

        // 1. ShiftReports correspondentes a esta OP e data (Deduplicados)
        const opReportsRaw = (shiftReports || []).filter(r => 
            (r.productionOrderId === activeOp.id || r.orderNumber === activeOp.orderNumber) &&
            (r.date === targetReportDateStr || parseDateOnly(r.shiftStartTime || r.shiftEndTime) === targetReportDateStr)
        );
        const opReportsMap = new Map<string, ShiftReport>();
        opReportsRaw.forEach(r => {
            const shiftKey = `${(r.shift || '').toLowerCase().trim()}_${(r.operator || '').toLowerCase().trim()}`;
            if (!opReportsMap.has(shiftKey)) {
                opReportsMap.set(shiftKey, r);
            } else {
                const ex = opReportsMap.get(shiftKey)!;
                if (Number(r.totalProducedQuantity || r.totalProducedWeight || 0) > Number(ex.totalProducedQuantity || ex.totalProducedWeight || 0)) {
                    opReportsMap.set(shiftKey, r);
                }
            }
        });
        const opReports = Array.from(opReportsMap.values());

        opReports.forEach(r => {
            if (!operatorName && r.operator) operatorName = r.operator;
            produced += Number(r.totalProducedWeight || r.totalProducedQuantity || 0);
        });

        // 2. Lotes processados se for Trefila (somente lotes pesados/finalizados)
        const isTrefilaMach = machName.toLowerCase().includes('trefila');
        if (isTrefilaMach) {
            const pLots = activeOp.processedLots || (activeOp as any).processed_lots || [];
            let lotWeight = 0;
            pLots.forEach((l: any) => {
                const fw = l.finalWeight !== null && l.finalWeight !== undefined 
                    ? Number(l.finalWeight) 
                    : (l.final_weight !== null && l.final_weight !== undefined ? Number(l.final_weight) : 0);
                if (fw <= 0) return;
                const lIso = l.endTime || l.end_time || l.startTime || l.start_time;
                if (lIso && parseDateOnly(lIso) === targetReportDateStr) {
                    lotWeight += fw;
                }
            });
            if (lotWeight > 0) {
                produced = lotWeight;
            }
        }

        // 3. OperatorLogs desta data
        const opLogs = (activeOp.operatorLogs || []).filter(l => {
            const s = parseDateOnly(l.startTime);
            const e = parseDateOnly(l.endTime);
            return s === targetReportDateStr || e === targetReportDateStr;
        });
        opLogs.forEach(l => {
            if (!operatorName && l.operator) operatorName = l.operator;
            if (produced === 0) {
                if (l.endQuantity !== undefined && l.startQuantity !== undefined) {
                    produced += Math.max(0, (Number(l.endQuantity) || 0) - (Number(l.startQuantity) || 0));
                } else if (!l.endTime && l.startQuantity !== undefined) {
                    const currentTotal = isTrefilaMach 
                        ? Number(activeOp.actualProducedWeight || 0) 
                        : Number(activeOp.actualProducedQuantity || 0);
                    produced += Math.max(0, currentTotal - Number(l.startQuantity));
                }
            }
        });

        // 4. Se houver activeDayStats fiel calculado pelo PCP para esta data, priorizar
        if (activeDayStats?.produced !== undefined && activeDayStats.produced > 0) {
            produced = activeDayStats.produced;
        } else if (targetReportDateStr === data.dateStr && data.produced > 0) {
            produced = data.produced;
        } else if (targetReportDateStr === data.dateStr && (produced === 0 || !produced)) {
            produced = data.produced || 0;
        }

        // 5. Operador fallback das paradas, de activeDayStats ou da OP
        if (!operatorName && activeDayStats?.operatorName) {
            operatorName = activeDayStats.operatorName;
        }
        if (!operatorName) {
            const stopWithOp = allStops.find(s => s.dateStr === targetReportDateStr && s.operator);
            if (stopWithOp) operatorName = stopWithOp.operator!;
        }
        if (!operatorName) {
            operatorName = activeOp.operatorName || (activeOp as any).operator || '';
        }

        return { dayProduced: produced, dayOperator: operatorName };
    }, [activeOp, targetReportDateStr, shiftReports, allStops, data.dateStr, data.produced, machName, activeDayStats]);

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[140] p-3 sm:p-4 animate-fade" onClick={onClose}>
            <div className="bg-[#0A1B27] rounded-2xl border border-white/15 shadow-2xl w-full max-w-2xl text-slate-100 flex flex-col max-h-[90vh] my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#08131B]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black uppercase tracking-wider text-white">
                                    Paradas e Motivos • OP #{activeOp.orderNumber}
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-mono">
                                    {activeOp.scheduledMachine || activeOp.machine}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                                {activeOp.trelicaModel ? `${activeOp.trelicaModel} • ` : activeOp.targetBitola ? `Bitola ${activeOp.targetBitola}mm • ` : ''}
                                {activeLabel}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowOfficialReport(true)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.35)] transition-all cursor-pointer active:scale-95 border border-blue-400/40"
                            title="Gerar Ficha Oficial de Controle de Produção Diária (Impressão e WhatsApp)"
                        >
                            <span>📄</span>
                            <span className="hidden sm:inline">Ficha Diária Oficial (Impressão / WhatsApp)</span>
                            <span className="sm:hidden">Ficha Oficial</span>
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Fechar modal">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Seletor de Dia (Abas Rápidas) */}
                <div className="flex items-center gap-1.5 p-3 bg-black/40 border-b border-white/10 overflow-x-auto custom-scrollbar">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                        Dia:
                    </span>
                    {dayTabs.map(tab => {
                        const isSelected = selectedDateStr === tab.dateStr;
                        return (
                            <button
                                key={tab.dateStr}
                                type="button"
                                onClick={() => setSelectedDateStr(tab.dateStr)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                    isSelected
                                        ? 'bg-[#00E5FF] text-slate-950 shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isSelected
                                        ? 'bg-slate-950 text-[#00E5FF]'
                                        : tab.count > 0 
                                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50' 
                                            : 'bg-white/10 text-slate-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setSelectedDateStr('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            selectedDateStr === 'ALL'
                                ? 'bg-[#00E5FF] text-slate-950 shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                        }`}
                    >
                        <span>Todas as Paradas</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            selectedDateStr === 'ALL'
                                ? 'bg-slate-950 text-[#00E5FF]'
                                : allStops.length > 0
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-white/10 text-slate-400'
                        }`}>
                            {allStops.length}
                        </span>
                    </button>
                </div>

                {/* Resumo do Dia Selecionado */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-4 border-b border-white/5 bg-[#08131B]/50">
                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Total de Paradas</span>
                        <span className="text-lg font-black text-rose-400 font-mono mt-0.5">
                            {filteredStops.length} <span className="text-xs font-bold text-slate-400">{filteredStops.length === 1 ? 'parada' : 'paradas'}</span>
                        </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Tempo Total Parado</span>
                        <span className="text-lg font-black text-amber-300 font-mono mt-0.5">
                            {formattedDuration}
                        </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col col-span-2 sm:col-span-1 justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Produzido no Dia</span>
                            <button
                                type="button"
                                onClick={() => setShowOfficialReport(true)}
                                className="text-[10px] font-black text-[#00E5FF] hover:underline flex items-center gap-1 cursor-pointer"
                                title="Abrir Ficha Diária Oficial deste dia"
                            >
                                <span>📄 Ficha Oficial</span>
                            </button>
                        </div>
                        <span className="text-lg font-black text-[#00E5FF] font-mono mt-0.5">
                            {(activeDayStats?.produced !== undefined ? activeDayStats.produced : (dayProduced > 0 ? dayProduced : (data.dateStr === selectedDateStr ? data.produced : 0))).toLocaleString('pt-BR')} <span className="text-xs font-bold text-[#00E5FF]/70">{data.unit}</span>
                        </span>
                    </div>
                </div>

                {/* Lista e Linha do Tempo de Paradas e Jornada */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2.5 custom-scrollbar">
                    {(() => {
                        const targetDStr = selectedDateStr === 'ALL' ? data.dateStr : selectedDateStr;
                        const machName = activeOp.scheduledMachine || activeOp.machine || 'Trefila 1';
                        const machCfg = resolveMachineShiftConfig(machName, shiftConfig);
                        
                        const dayLogs = (activeOp.operatorLogs || []).filter(l => {
                            if (!l.startTime) return false;
                            const s = parseDateOnly(l.startTime);
                            const e = parseDateOnly(l.endTime);
                            return s === targetDStr || e === targetDStr;
                        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                        const matchingShiftReport = shiftReports.find(r => 
                            (r.productionOrderId === activeOp.id || r.orderNumber === activeOp.orderNumber) &&
                            (r.date === targetDStr || parseDateOnly(r.shiftStartTime) === targetDStr)
                        );

                        const firstLog = dayLogs[0];
                        const lastLog = dayLogs[dayLogs.length - 1];

                        const fmtHM = (iso?: string) => {
                            if (!iso) return '';
                            try {
                                const dt = new Date(iso);
                                if (isNaN(dt.getTime())) {
                                    if (/^\d{2}:\d{2}/.test(iso)) return iso.slice(0, 5);
                                    return '';
                                }
                                return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            } catch {
                                return '';
                            }
                        };

                        const scheduledStart = machCfg.workStart || '07:45';
                        const actualStart = fmtHM(firstLog?.startTime) || fmtHM(matchingShiftReport?.shiftStartTime) || (dayLogs.length > 0 ? scheduledStart : (filteredStops.length > 0 ? 'Iniciado' : '--:--'));
                        const scheduledEnd = machCfg.workEnd || '17:33';
                        const isOpen = lastLog && !lastLog.endTime;
                        const actualEnd = isOpen 
                            ? 'Em andamento' 
                            : (fmtHM(lastLog?.endTime) || fmtHM(matchingShiftReport?.shiftEndTime) || (dayLogs.length > 0 ? scheduledEnd : (filteredStops.length > 0 ? 'Em andamento' : '--:--')));
                        const operatorName = firstLog?.operator || lastLog?.operator || matchingShiftReport?.operator || activeOp.operatorName;

                        return (
                            <>
                                {/* 1 & 2. TOPO DA LINHA DO TEMPO: TÉRMINO DO TURNO (SISTEMA E APP) */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 py-0.5 px-1">
                                        <div className="h-px bg-indigo-500/30 flex-1" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                            <span>🏁</span>
                                            <span>Término / Encerramento do Turno</span>
                                        </span>
                                        <div className="h-px bg-indigo-500/30 flex-1" />
                                    </div>

                                    {/* Término do Turno (Horário programado no sistema) */}
                                    <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-500/25 flex items-center justify-between gap-3 transition-all hover:border-indigo-500/40">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                                🏁
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-indigo-200">
                                                        Término do Turno (Horário Programado no Sistema)
                                                    </h5>
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                        Sistema
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                    Horário previsto de término do expediente • {machName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 rounded-xl text-xs font-black font-mono shrink-0 border bg-indigo-500/20 text-indigo-200 border-indigo-500/40">
                                            {scheduledEnd}
                                        </div>
                                    </div>

                                    {/* Término no App (Apontado pelo Operador) */}
                                    <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-500/25 flex items-center justify-between gap-3 transition-all hover:border-blue-500/40">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                                📱
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-blue-200">
                                                        Término no App (Apontado pelo Operador)
                                                    </h5>
                                                    {actualEnd === 'Em andamento' ? (
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                                            Em andamento
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                            Apontado no App
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                    {actualEnd === 'Em andamento' ? 'Máquina operando no chão de fábrica' : 'Horário registrado no encerramento do turno'}
                                                    {operatorName ? ` • Operador: ${operatorName}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-xl text-xs font-black font-mono shrink-0 border ${
                                            actualEnd === 'Em andamento' 
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                                                : 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                                        }`}>
                                            {actualEnd}
                                        </div>
                                    </div>
                                </div>

                                {/* DIVISOR DE PARADAS REGISTRADAS */}
                                <div className="flex items-center gap-2 py-1 px-1">
                                    <div className="h-px bg-white/10 flex-1" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                        <span>🛑</span>
                                        <span>Paradas e Interrupções ({filteredStops.length})</span>
                                    </span>
                                    <div className="h-px bg-white/10 flex-1" />
                                </div>

                                {/* LISTA DE PARADAS */}
                                {filteredStops.length === 0 ? (
                                    <div className="p-6 text-center flex flex-col items-center justify-center gap-2 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-2xl">✅</span>
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-xs font-bold text-slate-300">
                                                Nenhuma parada registrada em {activeLabel}.
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                A máquina operou sem interrupções registradas nesta data.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    filteredStops.map((stop) => {
                                        const isLong = stop.durationMin >= 30;
                                        const isMedium = stop.durationMin >= 10;
                                        
                                        return (
                                            <div 
                                                key={stop.id} 
                                                className="p-3 bg-black/40 rounded-xl border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 transition-all"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                                                        stop.isOngoing 
                                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                                            : isLong 
                                                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                                                : isMedium 
                                                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                                                    : 'bg-white/5 text-slate-400 border border-white/10'
                                                    }`}>
                                                        🛑
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h5 className="text-sm font-bold text-rose-300 truncate">
                                                                {stop.reason.includes(' [') ? stop.reason.split(' [')[0] : stop.reason}
                                                            </h5>
                                                            {stop.isOngoing && (
                                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse">
                                                                    Em andamento
                                                                </span>
                                                            )}
                                                            {selectedDateStr === 'ALL' && stop.dateStr && (
                                                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                                                                    {stop.dateStr}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Badge de Controladoria de Eletrodos */}
                                                        {(() => {
                                                            const hasBracket = stop.reason.includes('[') && stop.reason.includes(']');
                                                            const isElectrodeStop = stop.reason.toLowerCase().includes('eletrodo') || stop.reason.toLowerCase().includes('solda');
                                                            
                                                            let lotDetail = '';
                                                            if (hasBracket && isElectrodeStop) {
                                                                lotDetail = stop.reason.substring(stop.reason.indexOf('[') + 1, stop.reason.lastIndexOf(']'));
                                                            } else if (isElectrodeStop) {
                                                                // Histórico / Retroativo da Treliça: busca nos eletrodos configurados da máquina
                                                                const machName = activeOp.scheduledMachine || activeOp.machine || 'Treliça 1';
                                                                const machEls = getLocalMachineElectrodes(machName);
                                                                const activeLots = machEls.map(e => `${e.shortLabel || e.position_label}: ${e.lot_number}`).slice(0, 3).join(' • ');
                                                                lotDetail = activeLots ? `Lotes da Máquina: ${activeLots}...` : 'Lotes da Máquina Vinculados';
                                                            }

                                                            if (!lotDetail) return null;

                                                            return (
                                                                <div className="mt-1 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-amber-400 font-bold">⚡ Controladoria:</span>
                                                                    <span className="text-slate-200 font-medium">{lotDetail}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                                            <span>🕒 {stop.timeFormatted}</span>
                                                            {stop.operator && (
                                                                <span className="text-slate-500">
                                                                    • Op: <strong className="text-slate-300">{stop.operator}</strong>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono shrink-0 border ${
                                                    isLong 
                                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                                                        : isMedium 
                                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                                            : 'bg-white/5 text-slate-300 border-white/10'
                                                }`}>
                                                    {stop.durationMin} min
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                {/* 3 & 4. BASE DA LINHA DO TEMPO: INÍCIO DO TURNO (APP E SISTEMA) */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center gap-2 py-0.5 px-1">
                                        <div className="h-px bg-emerald-500/30 flex-1" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                            <span>⏰</span>
                                            <span>Início / Abertura do Turno</span>
                                        </span>
                                        <div className="h-px bg-emerald-500/30 flex-1" />
                                    </div>

                                    {/* Início da Máquina no App */}
                                    <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/25 flex items-center justify-between gap-3 transition-all hover:border-emerald-500/40">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                📱
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-emerald-200">
                                                        Início da Máquina no App
                                                    </h5>
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        Início no App
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                    Horário que o operador iniciou o turno no app
                                                    {operatorName ? ` • Operador: ${operatorName}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 rounded-xl text-xs font-black font-mono shrink-0 border bg-emerald-500/20 text-emerald-200 border-emerald-500/40">
                                            {actualStart}
                                        </div>
                                    </div>

                                    {/* Início do Turno (Horário programado no sistema) */}
                                    <div className="p-3 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/25 flex items-center justify-between gap-3 transition-all hover:border-[#00E5FF]/40">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40">
                                                ⏰
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-cyan-200">
                                                        Início do Turno (Horário Programado no Sistema)
                                                    </h5>
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30">
                                                        Sistema
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                    Horário programado de início de turno • {machName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 rounded-xl text-xs font-black font-mono shrink-0 border bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40">
                                            {scheduledStart}
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Rodapé */}
                <div className="p-3 border-t border-white/10 bg-[#08131B] flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                        {allStops.length} parada(s) no histórico desta OP
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Modal da Ficha Oficial de Produção Diária (Impressão e WhatsApp) */}
            {showOfficialReport && (
                <DailyProductionReportSheetModal
                    isOpen={showOfficialReport}
                    onClose={() => setShowOfficialReport(false)}
                    machine={activeOp.scheduledMachine || (activeOp.machine as string) || 'Treliça 1'}
                    dateStr={targetReportDateStr}
                    op={{
                        ...activeOp,
                        productCode: activeOp.productCode || ((activeOp.targetBitola?.includes('3.4') || activeOp.orderNumber === '87493') ? '8624' : activeOp.productCode),
                        productDescription: activeOp.productDescription || ((activeOp.targetBitola?.includes('3.4') || activeOp.orderNumber === '87493') ? 'CA 60 ROLO 3.40 MM - 2 TON - M.P. *SEMI ACABADO*' : activeOp.productDescription)
                    }}
                    shiftReports={shiftReports}
                    productionOrders={productionOrders}
                    initialProduced={activeDayStats?.produced !== undefined && activeDayStats.produced > 0 ? activeDayStats.produced : (dayProduced > 0 ? dayProduced : (targetReportDateStr === data.dateStr ? data.produced : undefined))}
                    initialOperator={activeDayStats?.operatorName || dayOperator}
                    initialDayStats={activeDayStats || (targetReportDateStr === data.dateStr ? data.dayStats : undefined)}
                    shiftConfig={shiftConfig}
                    stock={stock}
                    gauges={gauges}
                    employees={employees}
                    users={users}
                />
            )}
        </div>
    );
};

// ============================================================================
// COMPONENTE: Modal de Ajuste de Quantidade Produzida pelo Gestor
// ============================================================================
const AdjustQuantityModal: React.FC<{
    order: ProductionOrderData;
    initialMode?: 'shift' | 'total';
    context?: {
        dayStats?: any;
        targetDay?: Date;
        dayColName?: string;
        operatorName?: string;
        shiftProduced?: number;
    };
    onClose: () => void;
    onSave: (
        orderId: string, 
        newTotalQty: number, 
        reason: string,
        details?: {
            mode: 'shift' | 'total';
            shiftQty?: number;
            operatorName?: string;
            dayStats?: any;
            updatedLogs?: any[];
        }
    ) => Promise<void>;
}> = ({ order, initialMode = 'shift', context, onClose, onSave }) => {
    const isTrefila = typeof order.machine === 'string' && order.machine.startsWith('Trefila') || (typeof order.scheduledMachine === 'string' && order.scheduledMachine.startsWith('Trefila'));
    const isTrelica = typeof order.machine === 'string' && order.machine.startsWith('Treliça') || (typeof order.scheduledMachine === 'string' && order.scheduledMachine.startsWith('Treliça'));
    const unit = isTrefila ? 'kg' : 'pçs';

    const currentTotal = isTrefila 
        ? (Number(order.actualProducedWeight) || Number(order.totalProducedWeight) || 0) 
        : (Number(order.actualProducedQuantity) || 0);
    
    const target = isTrefila 
        ? (order.totalWeight || order.quantityToProduce || 18000) 
        : (order.quantityToProduce || (isTrelica ? 3500 : 5000));

    // Turno ativo do operador (se houver)
    const activeLogIndex = (order.operatorLogs || []).findIndex((l: any) => !l.endTime);
    const activeLog = activeLogIndex !== -1 ? order.operatorLogs![activeLogIndex] : null;

    // Nome do operador
    const formatName = (name?: string) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length <= 1) return parts[0] || '';
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        return `${cap(parts[0])} ${cap(parts[parts.length - 1])}`;
    };

    const operatorName = formatName(context?.operatorName) 
        || (activeLog?.operator ? formatName(activeLog.operator) : '') 
        || (context?.dayStats?.operatorName ? formatName(context.dayStats.operatorName) : '')
        || 'Operador';

    // Determinar a quantidade de produção base deste turno
    const logStartQty = Number(activeLog?.startQuantity) || 0;
    const computedActiveShiftQty = Math.max(0, currentTotal - logStartQty);
    const shiftBaseQty = context?.shiftProduced !== undefined 
        ? context.shiftProduced 
        : computedActiveShiftQty;

    const [mode, setMode] = useState<'shift' | 'total'>(initialMode);
    const [qty, setQty] = useState<number>(initialMode === 'shift' ? shiftBaseQty : currentTotal);
    const [reason, setReason] = useState<string>(
        initialMode === 'shift' 
            ? 'Ajuste manual de contagem do turno (Gestor)' 
            : 'Ajuste manual de contagem geral da OP (Gestor)'
    );
    const [isSaving, setIsSaving] = useState(false);

    // Trocar modo (Turno vs Total da OP)
    const handleSwitchMode = (newMode: 'shift' | 'total') => {
        if (newMode === mode) return;
        setMode(newMode);
        if (newMode === 'shift') {
            setQty(shiftBaseQty);
            setReason('Ajuste manual de contagem do turno (Gestor)');
        } else {
            setQty(currentTotal);
            setReason('Ajuste manual de contagem geral da OP (Gestor)');
        }
    };

    const isShiftMode = mode === 'shift';

    // Soma de todas as peças registradas nos turnos da OP para garantir consistência
    const sumLogsTotal = useMemo(() => {
        let sum = 0;
        (order.operatorLogs || []).forEach((l: any) => {
            if (l.endTime) {
                sum += Math.max(0, (Number(l.endQuantity) || 0) - (Number(l.startQuantity) || 0));
            } else {
                sum += Math.max(0, currentTotal - (Number(l.startQuantity) || 0));
            }
        });
        return sum > 0 ? sum : currentTotal;
    }, [order, currentTotal]);

    // Cálculos dinâmicos
    // O Gestor pode reduzir a quantidade, portanto o mínimo permitido é 0
    const minAllowedQty = 0;
    const originalQty = isShiftMode ? shiftBaseQty : currentTotal;
    const isBelowMinimum = qty < minAllowedQty;

    const shiftDelta = isShiftMode ? (qty - shiftBaseQty) : (qty - currentTotal);
    const calculatedNewTotal = isShiftMode 
        ? Math.max(0, sumLogsTotal + (qty - shiftBaseQty))
        : qty;
    const calculatedNewShift = isShiftMode
        ? qty
        : Math.max(0, shiftBaseQty + (qty - currentTotal));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (qty < minAllowedQty) return;
        setIsSaving(true);
        try {
            await onSave(order.id, calculatedNewTotal, reason, {
                mode,
                shiftQty: isShiftMode ? qty : calculatedNewShift,
                operatorName,
                dayStats: context?.dayStats
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-xl pcp-glass-card rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col gap-4 text-slate-100 shadow-2xl my-auto">
                {/* Topo do Modal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                            <AdjustmentsIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black uppercase tracking-wider text-white">
                                    {isShiftMode ? 'Ajustar Quantidade do Turno' : 'Ajustar Quantidade Total da OP'}
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-mono">
                                    GESTOR
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                                OP #{order.orderNumber} • {order.scheduledMachine || (order.machine as string)} {order.trelicaModel ? `• ${order.trelicaModel}` : order.targetBitola ? `• Bitola ${order.targetBitola}mm` : ''} {context?.dayColName ? `• ${context.dayColName}` : ''}
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Seletor de Modo: Turno vs Total da OP */}
                <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('shift')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isShiftMode
                                ? 'bg-[#00E5FF] text-slate-950 shadow-[0_0_15px_rgba(0,229,255,0.4)] font-black'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>👤</span>
                        <span className="truncate">Turno de {operatorName} ({shiftBaseQty.toLocaleString('pt-BR')} {unit})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('total')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            !isShiftMode
                                ? 'bg-[#00E5FF] text-slate-950 shadow-[0_0_15px_rgba(0,229,255,0.4)] font-black'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>📊</span>
                        <span className="truncate">Total da OP ({currentTotal.toLocaleString('pt-BR')} {unit})</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Resumo Atual */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {isShiftMode ? (
                            <>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.15)] flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-[#00E5FF] tracking-wider truncate">Turno de {operatorName}</span>
                                    <span className="text-xl font-black text-[#00E5FF] font-mono mt-0.5">
                                        {shiftBaseQty.toLocaleString('pt-BR')} <span className="text-xs font-bold text-[#00E5FF]/70">{unit}</span>
                                    </span>
                                </div>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-white/5 flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Acumulado OP</span>
                                    <span className="text-xl font-black text-white font-mono mt-0.5">
                                        {currentTotal.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400">{unit}</span>
                                    </span>
                                </div>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-white/5 flex flex-col col-span-2 sm:col-span-1">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Meta Total</span>
                                    <span className="text-xl font-black text-slate-300 font-mono mt-0.5">
                                        {target.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400">{unit}</span>
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.15)] flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-[#00E5FF] tracking-wider">Produção Total Atual</span>
                                    <span className="text-xl font-black text-white font-mono mt-0.5">
                                        {currentTotal.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400">{unit}</span>
                                    </span>
                                </div>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-white/5 flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Meta Total</span>
                                    <span className="text-xl font-black text-slate-300 font-mono mt-0.5">
                                        {target.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-400">{unit}</span>
                                    </span>
                                </div>
                                <div className="bg-[#08131B] p-3 rounded-xl border border-white/5 flex flex-col col-span-2 sm:col-span-1">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider truncate">Turno de {operatorName}</span>
                                    <span className="text-xl font-black text-slate-300 font-mono mt-0.5">
                                        {shiftBaseQty.toLocaleString('pt-BR')} <span className="text-xs font-bold text-slate-500">{unit}</span>
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Controlador Principal da Nova Quantidade */}
                    <div className="bg-[#0B1D2A]/90 p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                {isShiftMode 
                                    ? `Definir Quantidade Produzida no Turno (${operatorName}):` 
                                    : 'Definir Nova Quantidade Total da OP:'}
                            </label>
                            <button
                                type="button"
                                onClick={() => setQty(originalQty)}
                                className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
                            >
                                Restaurar Inicial ({originalQty.toLocaleString('pt-BR')} {unit})
                            </button>
                        </div>

                        {/* Alerta se tentar colocar menos que o já registrado */}
                        {isBelowMinimum && (
                            <div className="bg-rose-950/70 border border-rose-500/60 p-3 rounded-xl flex items-center gap-2.5 text-xs text-rose-200 animate-pulse">
                                <span className="text-base shrink-0">⛔</span>
                                <div>
                                    <span className="font-black text-white">Quantidade Bloqueada!</span>
                                    <p className="text-[11px] text-rose-300 mt-0.5">
                                        Não é permitido marcar uma quantidade menor que <strong className="text-white font-mono">{minAllowedQty.toLocaleString('pt-BR')} {unit}</strong> (valor já registrado anteriormente).
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Campo de Entrada com Steppers Grandes */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={qty <= minAllowedQty}
                                onClick={() => setQty(prev => Math.max(minAllowedQty, prev - (isTrefila ? 50 : 1)))}
                                className={`w-12 h-12 rounded-xl border text-2xl font-black flex items-center justify-center transition-all select-none ${
                                    qty <= minAllowedQty
                                        ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-40'
                                        : 'bg-white/5 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border-white/10 hover:border-rose-500/40 active:scale-95 cursor-pointer'
                                }`}
                                title={qty <= minAllowedQty ? `Mínimo permitido: ${minAllowedQty} ${unit}` : `Diminuir 1 ${unit}`}
                            >
                                -
                            </button>
                            
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    min={minAllowedQty}
                                    value={qty === 0 && minAllowedQty === 0 ? '' : qty}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setQty(isNaN(val) ? 0 : val);
                                    }}
                                    className={`w-full h-12 bg-black/50 border rounded-xl text-center text-2xl font-black font-mono tracking-wider outline-none transition-all ${
                                        isBelowMinimum
                                            ? 'border-rose-500 text-rose-300 focus:border-rose-400 ring-2 ring-rose-500/20'
                                            : 'border-white/15 text-white focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]'
                                    }`}
                                    required
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                                    {unit}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setQty(prev => prev + (isTrefila ? 50 : 1))}
                                className="w-12 h-12 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 text-2xl font-black flex items-center justify-center transition-all active:scale-95 cursor-pointer select-none"
                                title={`Aumentar 1 ${unit}`}
                            >
                                +
                            </button>
                        </div>

                        {/* Indicador em Tempo Real da Diferença e Efeito no Painel */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            shiftDelta > 0 
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                                : shiftDelta < 0 
                                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' 
                                    : 'bg-black/30 border-white/5 text-slate-400'
                        }`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{shiftDelta > 0 ? '📈' : shiftDelta < 0 ? '📉' : '⚖️'}</span>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold">
                                        {shiftDelta > 0 
                                            ? `Acréscimo de +${shiftDelta.toLocaleString('pt-BR')} ${unit} ${isShiftMode ? `no turno de ${operatorName}` : 'no total da OP'}` 
                                            : shiftDelta < 0 
                                                ? `Redução de ${shiftDelta.toLocaleString('pt-BR')} ${unit} ${isShiftMode ? `no turno de ${operatorName}` : 'no total da OP'}` 
                                                : `Nenhuma alteração na quantidade ${isShiftMode ? 'do turno' : 'da OP'}`}
                                    </span>
                                    <span className="text-[11px] opacity-90 truncate mt-0.5">
                                        No Painel do Operador passará a exibir: <strong className="font-black text-[#00E5FF] underline">{calculatedNewShift.toLocaleString('pt-BR')} {unit}</strong> no turno
                                    </span>
                                    <span className="text-[10px] text-slate-300/80 mt-0.5">
                                        Total acumulado da OP passará de {currentTotal.toLocaleString('pt-BR')} para <strong className="text-white font-bold">{calculatedNewTotal.toLocaleString('pt-BR')} {unit}</strong>
                                    </span>
                                </div>
                            </div>
                            <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-black/40 border border-white/10 shrink-0 ml-2">
                                {Math.min(100, Math.round((calculatedNewTotal / (target || 1)) * 100))}% da Meta
                            </span>
                        </div>
                    </div>

                    {/* Motivo do Ajuste */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Motivo do Ajuste (Auditoria):
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="bg-[#08131B] border border-white/15 focus:border-[#00E5FF] rounded-xl px-3 py-2 text-xs text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="Ajuste manual de contagem do turno (Gestor)">Ajuste manual de contagem do turno (Gestor)</option>
                            <option value="Ajuste manual de contagem geral da OP (Gestor)">Ajuste manual de contagem geral da OP (Gestor)</option>
                            <option value="Correção de refugo ou pontas de solda">Correção de refugo ou pontas de solda</option>
                            <option value="Contagem física do lote / amarrado">Contagem física do lote / amarrado</option>
                            <option value="Ajuste por parada de setup">Ajuste por parada de setup</option>
                            <option value="Outro motivo operacional">Outro motivo operacional</option>
                        </select>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || isBelowMinimum}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 hover:from-[#00c8df] hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
                        >
                            {isSaving ? (
                                <span>Salvando...</span>
                            ) : (
                                <>
                                    <span>✓</span>
                                    <span>{isShiftMode ? `Salvar e Atualizar Dashboard (${operatorName})` : 'Salvar e Atualizar Total da OP'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================================================
// COMPONENTE: Modal de Autorização do Gestor para Ajuste de Quantidade
// ============================================================================
const ManagerAuthModalForAdjust: React.FC<{
    onSuccess: () => void;
    onCancel: () => void;
    users: User[];
}> = ({ onSuccess, onCancel, users }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const manager = users.find(u => (u.role === 'gestor' || u.role === 'admin') && u.password === password);
        if (manager) {
            onSuccess();
        } else {
            setError('Senha de gestor incorreta ou usuário sem permissão.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[130] p-4 animate-fade">
            <form onSubmit={handleSubmit} className="bg-[#0A1B27] p-6 rounded-2xl border border-white/15 shadow-2xl w-full max-w-md text-slate-100 flex flex-col gap-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold">
                        🔒
                    </div>
                    <div>
                        <h3 className="text-base font-black uppercase tracking-wider text-white">
                            Autorização de Gestor
                        </h3>
                        <p className="text-xs text-slate-400">
                            Apenas o gestor pode alterar a quantidade produzida
                        </p>
                    </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                    Esta alteração atualiza a contagem no Quadro PCP e no painel do operador da máquina em tempo real. Digite a senha do gestor ou administrador para prosseguir:
                </p>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                        Senha do Gestor
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-2.5 bg-black/50 border border-white/15 focus:border-[#00E5FF] rounded-xl text-white outline-none font-mono"
                        required
                        autoFocus
                        placeholder="Digite a senha..."
                    />
                    {error && <p className="text-rose-400 text-xs mt-1.5 font-bold flex items-center gap-1">⚠️ {error}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer active:scale-98"
                    >
                        Autorizar e Ajustar
                    </button>
                </div>
            </form>
        </div>
    );
};

// ============================================================================
// COMPONENTE: Modal de Edição da OP em Produção (Nome, Meta, Turnos Finalizados)
// Modelo técnico bloqueado para preservar a rastreabilidade dos lotes.
// ============================================================================
interface EditActiveOPModalProps {
    order: ProductionOrderData;
    shiftReports?: ShiftReport[];
    gauges?: any[];
    onClose: () => void;
    onSave: (
        orderId: string,
        data: {
            newOrderNumber: string;
            newQuantityToProduce: number;
            updatedFinalizedShifts: {
                logIndex: number;
                reportId?: string;
                operator: string;
                pieces: number;
                startTime?: string;
                endTime?: string;
            }[];
            activeShiftPieces?: number;
        }
    ) => Promise<void>;
}

interface FinalizedShiftItem {
    id: string;
    logIndex: number;
    reportId?: string;
    operator: string;
    startTime?: string;
    endTime?: string;
    dateFormatted: string;
    timeRange: string;
    pieces: number;
}

const EditActiveOPModal: React.FC<EditActiveOPModalProps> = ({
    order,
    shiftReports = [],
    gauges = [],
    onClose,
    onSave
}) => {
    const isTrefila = typeof order.machine === 'string' && order.machine.startsWith('Trefila') || (typeof order.scheduledMachine === 'string' && order.scheduledMachine.startsWith('Trefila'));
    const isTrelica = typeof order.machine === 'string' && order.machine.startsWith('Treliça') || (typeof order.scheduledMachine === 'string' && order.scheduledMachine.startsWith('Treliça'));
    const unit = isTrefila ? 'kg' : 'pçs';

    // 1. Nome / Número da Ordem
    const [orderNumber, setOrderNumber] = useState<string>(order.orderNumber || '');

    // 2. Meta (Quantidade a Produzir)
    const initialMeta = useMemo(() => {
        if (isTrefila) {
            return Number(order.quantityToProduce) || Number(order.totalWeight) || 18000;
        }
        return Number(order.quantityToProduce) || (isTrelica ? 3500 : 5000);
    }, [order, isTrefila, isTrelica]);

    const [quantityToProduce, setQuantityToProduce] = useState<number>(initialMeta);

    // 3. Modelo Técnico (BLOQUEADO)
    const modelDisplay = useMemo(() => {
        if (isTrelica) {
            return `${order.trelicaModel || 'Treliça'}${order.tamanho ? ` • ${order.tamanho}` : ''}`;
        }
        if (isTrefila) {
            let pCode = order.productCode || '';
            let pDesc = order.productDescription || '';
            if (!pDesc || !pCode) {
                // Fallback for old orders: lookup in gauges
                const cleanTarget = String(order.targetBitola || '').replace('mm', '').trim();
                const matchedGauge = gauges.find((g: any) => {
                    const mat = (g.materialType || '').toLowerCase();
                    const isCa60 = mat === 'ca-60' || mat === 'ca60' || mat.includes('trefila');
                    if (!isCa60) return false;
                    const gClean = String(g.gauge || '').replace('mm', '').trim();
                    return g.gauge === order.targetBitola || gClean === cleanTarget || parseFloat(gClean.replace(',', '.')) === parseFloat(cleanTarget.replace(',', '.'));
                });
                if (matchedGauge) {
                    if (!pCode) pCode = matchedGauge.productCode || (matchedGauge as any).code || '';
                    if (!pDesc) pDesc = matchedGauge.description || (matchedGauge as any).gaugeDescription || '';
                }
            }
            if (pDesc) {
                return pCode && !pDesc.startsWith(pCode) ? `[${pCode}] ${pDesc}` : pDesc;
            }
            return `Bitola ${order.targetBitola || 'N/A'}mm${order.inputBitola ? ` (Entrada: ${order.inputBitola}mm)` : ''}`;
        }
        return order.malhaModel || 'Malha Padrão';
    }, [order, isTrelica, isTrefila, gauges]);

    // 4. Turnos Finalizados (Peças Produzidas)
    const initialShifts = useMemo(() => {
        const list: FinalizedShiftItem[] = [];
        const logs = (order.operatorLogs || []) as any[];
        const matchingReports = (shiftReports || []).filter(r => 
            (r.productionOrderId && r.productionOrderId === order.id) || 
            (r.orderNumber && r.orderNumber === order.orderNumber)
        );

        logs.forEach((log, index) => {
            if (!log.startTime) return;
            if (log.endTime) {
                const shiftPieces = Math.max(0, (Number(log.endQuantity) || 0) - (Number(log.startQuantity) || 0));
                const sDate = log.startTime ? getIsoDateStrGlobal(log.startTime) : '';
                const matchingReport = matchingReports.find(r => {
                    const rDate = r.date || (r.shiftStartTime ? getIsoDateStrGlobal(r.shiftStartTime) : '');
                    return rDate === sDate || (r.operator && log.operator && r.operator.toLowerCase() === log.operator.toLowerCase());
                });

                const startDt = new Date(log.startTime);
                const endDt = new Date(log.endTime);
                const dateFormatted = !isNaN(startDt.getTime()) ? startDt.toLocaleDateString('pt-BR') : 'Data não informada';
                const timeRange = !isNaN(startDt.getTime()) && !isNaN(endDt.getTime())
                    ? `${startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Turno Encerrado';

                list.push({
                    id: `log-${index}`,
                    logIndex: index,
                    reportId: matchingReport?.id,
                    operator: log.operator || 'Operador',
                    startTime: log.startTime,
                    endTime: log.endTime,
                    dateFormatted,
                    timeRange,
                    pieces: shiftPieces
                });
            }
        });

        // Se não havia logs fechados em operatorLogs, verificar shiftReports
        if (list.length === 0 && matchingReports.length > 0) {
            matchingReports.forEach((rep, rIdx) => {
                const qty = isTrefila 
                    ? (Number(rep.totalProducedWeight) || 0)
                    : (Number(rep.totalProducedQuantity) || 0);
                const dt = rep.date ? new Date(rep.date) : (rep.shiftStartTime ? new Date(rep.shiftStartTime) : new Date());
                const dateFormatted = !isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : 'Data não informada';
                list.push({
                    id: `rep-${rep.id || rIdx}`,
                    logIndex: -1,
                    reportId: rep.id,
                    operator: rep.operator || 'Operador',
                    startTime: rep.shiftStartTime,
                    endTime: rep.shiftEndTime,
                    dateFormatted,
                    timeRange: 'Turno Registrado',
                    pieces: qty
                });
            });
        }

        return list;
    }, [order, shiftReports, isTrefila]);

    const [finalizedShifts, setFinalizedShifts] = useState<FinalizedShiftItem[]>(initialShifts);

    // 5. Turno Ativo (Ao Vivo) se existir
    const activeLogIndex = (order.operatorLogs || []).findIndex((l: any) => !l.endTime);
    const activeLog = activeLogIndex !== -1 ? order.operatorLogs![activeLogIndex] : null;
    const hasActiveShift = activeLog !== null;

    const initialActivePieces = useMemo(() => {
        if (!hasActiveShift) return 0;
        const currentTotal = isTrefila 
            ? (Number(order.actualProducedWeight) || Number(order.totalProducedWeight) || 0)
            : (Number(order.actualProducedQuantity) || 0);
        const startQty = Number(activeLog?.startQuantity) || 0;
        return Math.max(0, currentTotal - startQty);
    }, [hasActiveShift, activeLog, order, isTrefila]);

    const [activeShiftPieces, setActiveShiftPieces] = useState<number>(initialActivePieces);
    const [isSaving, setIsSaving] = useState(false);

    // Handlers para atualizar peças do turno finalizado
    const handleShiftPiecesChange = (index: number, delta: number) => {
        setFinalizedShifts(prev => prev.map((s, idx) => {
            if (idx === index) {
                return { ...s, pieces: Math.max(0, (Number(s.pieces) || 0) + delta) };
            }
            return s;
        }));
    };

    const handleSetShiftPieces = (index: number, value: number) => {
        setFinalizedShifts(prev => prev.map((s, idx) => {
            if (idx === index) {
                return { ...s, pieces: Math.max(0, value) };
            }
            return s;
        }));
    };

    // Cálculos em tempo real
    const sumFinalized = finalizedShifts.reduce((acc, s) => acc + (Number(s.pieces) || 0), 0);
    const recalculatedTotal = sumFinalized + (hasActiveShift ? (Number(activeShiftPieces) || 0) : 0);
    const target = Number(quantityToProduce) || 1;
    const progressPercent = Math.min(100, Math.round((recalculatedTotal / target) * 100));

    const quickMetaDeltas = isTrefila 
        ? [-1000, -500, -100, 100, 500, 1000]
        : [-500, -100, -50, 50, 100, 500];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(order.id, {
                newOrderNumber: orderNumber,
                newQuantityToProduce: quantityToProduce,
                updatedFinalizedShifts: finalizedShifts.map(s => ({
                    logIndex: s.logIndex,
                    reportId: s.reportId,
                    operator: s.operator,
                    pieces: s.pieces,
                    startTime: s.startTime,
                    endTime: s.endTime
                })),
                activeShiftPieces: hasActiveShift ? activeShiftPieces : undefined
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-xl pcp-glass-card rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col gap-4 text-slate-100 shadow-2xl my-auto">
                {/* Cabeçalho do Modal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            <PencilIcon className="w-5 h-5 text-purple-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black uppercase tracking-wider text-white">
                                    Editar OP em Produção
                                </h3>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                                    PCP / GESTOR
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                                {order.scheduledMachine || order.machine} • ID: {order.id.slice(0, 8)}...
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* 1. Nome / Número da Ordem */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                            <span>Nome / Número da Ordem</span>
                            <span className="text-[10px] text-slate-400 font-normal">Identificador da OP nos terminais e painel</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-mono text-sm font-bold">#</span>
                            <input
                                type="text"
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                className="w-full bg-slate-900/90 border border-white/15 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 rounded-xl pl-8 pr-3 py-2.5 text-white font-mono font-bold text-sm tracking-wide transition-all outline-none"
                                placeholder="Ex: teste 3888888 ou TR-9222"
                                required
                            />
                        </div>
                    </div>

                    {/* 2. Modelo Técnico Bloqueado */}
                    <div className="bg-slate-900/70 border border-amber-500/30 rounded-xl p-3.5 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <LockClosedIcon className="w-3.5 h-3.5 text-amber-400" />
                                <span>Modelo Técnico do Produto</span>
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
                                <span>🔒</span> BLOQUEADO
                            </span>
                        </div>
                        <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                            <span className="font-mono text-sm font-bold text-slate-200">
                                {modelDisplay}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                                {order.scheduledMachine || order.machine}
                            </span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 leading-snug">
                            ⚠️ O modelo técnico não pode ser trocado com a OP em andamento para não corromper a rastreabilidade dos lotes de matéria-prima e bobinas já consumidas.
                        </p>
                    </div>

                    {/* 3. Quantidade a Produzir (Meta) */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                                Quantidade a Produzir (Meta da OP)
                            </label>
                            <span className="text-xs font-mono text-[#00E5FF] font-bold">
                                Unidade: {unit}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                value={quantityToProduce}
                                onChange={(e) => setQuantityToProduce(Math.max(1, Number(e.target.value) || 0))}
                                className="flex-1 bg-slate-900/90 border border-white/15 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] rounded-xl px-3 py-2 text-white font-mono font-bold text-base transition-all outline-none"
                                required
                            />
                            <span className="text-sm font-bold text-slate-400 font-mono px-2">
                                {unit}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {quickMetaDeltas.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setQuantityToProduce(prev => Math.max(1, prev + d))}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
                                >
                                    {d > 0 ? `+${d.toLocaleString('pt-BR')}` : d.toLocaleString('pt-BR')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Turnos Finalizados */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <span>Peças Produzidas nos Turnos Finalizados</span>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {finalizedShifts.length} {finalizedShifts.length === 1 ? 'Turno' : 'Turnos'}
                                </span>
                            </label>
                        </div>

                        {finalizedShifts.length === 0 ? (
                            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3 text-center text-xs text-slate-400">
                                Nenhum turno finalizado registrado para esta OP até o momento.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {finalizedShifts.map((shift, idx) => (
                                    <div key={shift.id || idx} className="bg-slate-900/80 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px]">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-bold text-slate-200">
                                                    {shift.operator || 'Operador'}
                                                </span>
                                                <span className="text-[11px] text-slate-400 font-mono">
                                                    {shift.dateFormatted}
                                                </span>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                                {shift.timeRange}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleShiftPiecesChange(idx, isTrefila ? -100 : -10)}
                                                    className="w-8 h-8 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {isTrefila ? '-100' : '-10'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleShiftPiecesChange(idx, isTrefila ? -10 : -1)}
                                                    className="w-7 h-8 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {isTrefila ? '-10' : '-1'}
                                                </button>
                                            </div>

                                            <input
                                                type="number"
                                                min={0}
                                                value={shift.pieces}
                                                onChange={(e) => handleSetShiftPieces(idx, Number(e.target.value) || 0)}
                                                className="flex-1 bg-black/50 border border-white/15 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-center font-mono font-bold text-emerald-300 text-sm outline-none"
                                            />
                                            <span className="text-xs font-mono font-bold text-slate-400 w-8">
                                                {unit}
                                            </span>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleShiftPiecesChange(idx, isTrefila ? 10 : 1)}
                                                    className="w-7 h-8 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {isTrefila ? '+10' : '+1'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleShiftPiecesChange(idx, isTrefila ? 100 : 10)}
                                                    className="w-8 h-8 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {isTrefila ? '+100' : '+10'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 5. Turno Atual em Andamento (se houver) */}
                    {hasActiveShift && (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#00E5FF] flex items-center gap-1.5">
                                        <span>Turno Atual em Execução (Ao Vivo)</span>
                                    </span>
                                    <span className="text-[11px] text-slate-300 font-mono">
                                        {activeLog?.operator || 'Operador'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-mono font-black text-white">
                                    {activeShiftPieces.toLocaleString('pt-BR')} {unit}
                                </span>
                                <span className="block text-[10px] text-slate-400">em andamento</span>
                            </div>
                        </div>
                    )}

                    {/* 6. Barra de Progresso e Resumo Recalculado */}
                    <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Progresso Recalculado da OP</span>
                            <span className="font-mono font-bold text-[#00E5FF]">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-purple-500 via-[#00E5FF] to-emerald-400 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono pt-1">
                            <div>
                                <span className="text-slate-400 block text-[10px]">TOTAL REALIZADO:</span>
                                <span className="font-black text-emerald-400 text-sm">
                                    {recalculatedTotal.toLocaleString('pt-BR')} {unit}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">META DA OP:</span>
                                <span className="font-black text-white text-sm">
                                    {quantityToProduce.toLocaleString('pt-BR')} {unit}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-purple-500/25 flex items-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <PencilIcon className="w-3.5 h-3.5" />
                                    <span>Salvar Alterações da OP</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
