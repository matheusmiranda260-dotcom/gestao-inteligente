import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, MachineType, StockItem, ProductionOrderData, User, PartsRequest, ShiftReport, TrelicaSelectedLots, Ponta, StockGauge, Employee, DowntimeConfig, TrelicaSpoolStand, PcpShiftConfig, PcpHoliday } from '../types';
import { DOWNTIME_THRESHOLDS, DefaultMalhaGauges } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, ClockIcon, WarningIcon, StopIcon, CheckCircleIcon, WrenchScrewdriverIcon, ArchiveIcon, ClipboardListIcon, CogIcon, DocumentReportIcon, ScaleIcon, TrashIcon, CalculatorIcon, ChartBarIcon, ExclamationIcon, SaveIcon, XCircleIcon, ChevronDownIcon, AdjustmentsIcon, ChevronRightIcon, ArrowPathIcon } from './icons';
import PartsRequestModal from './PartsRequestModal';
import ShiftReportsModal from './ShiftReportsModal';
import ProductionOrderReport from './ProductionOrderReport';
import { insertItem, deleteItem, updateItem, fetchTable, fetchByColumn, fetchTrelicaSpoolStands } from '../services/supabaseService';
import { checkMachineShiftStatus, resolveMachineShiftConfig } from '../services/shiftConfigService';
import { trelicaModels } from './ProductionOrderTrelica';
import TrefilaCalculation from './TrefilaCalculation';
import TrelicaSpoolStands from './TrelicaSpoolStands';
import TrelicaWeldingHead, { 
    getLocalMachineElectrodes, 
    saveLocalMachineElectrodes,
    validateTrelicaElectrodesConfigured,
    TrelicaElectrodesValidation,
    ELECTRODE_POSITIONS_CONFIG,
    getLocalElectrodeHistory
} from './TrelicaWeldingHead';
import { MalhaPackagesOperatorPanel } from './MalhaConsumptionReportModal';


const IdleActivityLogger: React.FC<{
    onLogActivity: (activity: string) => void;
    activities: { timestamp: string; description: string }[];
}> = ({ onLogActivity, activities }) => {
    const [activity, setActivity] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activity.trim()) return;
        onLogActivity(activity);
        setActivity('');
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Registrar Atividade Pós-Produção</h3>
            <p className="text-sm text-slate-600 mb-4">A ordem de produção foi finalizada. Registre o que você está fazendo até o final do seu turno.</p>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="flex-grow p-2 border border-slate-300 rounded-md"
                    placeholder="Ex: Limpando a máquina..."
                    required
                />
                <button type="submit" className="bg-slate-700 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-800">Registrar</button>
            </form>
            <div className="max-h-40 overflow-y-auto space-y-2">
                {activities.length > 0 ? (
                    activities.map((act, index) => (
                        <div key={index} className="text-sm bg-slate-50 p-2 rounded-md">
                            <span className="font-semibold text-slate-500">{new Date(act.timestamp).toLocaleTimeString('pt-BR')}:</span> {act.description}
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-center text-slate-400 py-4">Nenhuma atividade registrada.</p>
                )}
            </div>
        </div>
    );
};

// Hardcoded fallback reasons removed in favor of dynamic configs from DB

export interface MalhaRollChangeHistoryEntry {
    id: string;
    timestamp: string;
    position: 'LONGITUDINAL' | 'TRANSVERSAL';
    lotSai: string;
    lotEntra: string;
    orderNumber?: string;
}

export interface MalhaActiveLotsState {
    longitudinal: string;
    transversal: string;
    updatedAt?: string;
    history?: MalhaRollChangeHistoryEntry[];
}

export const getMalhaActiveLots = (machineName: string, activeOrder?: ProductionOrderData | null): MalhaActiveLotsState => {
    const key = `malha_active_lots_${machineName || 'Malha 1'}`;
    let localData: MalhaActiveLotsState | null = null;
    try {
        const raw = localStorage.getItem(key);
        if (raw) localData = JSON.parse(raw);
    } catch (e) {
        console.warn('Erro ao ler lotes ativos da Malha do localStorage:', e);
    }

    const rawSummaryLots = (activeOrder?.summary as any)?.malhaActiveLots || (activeOrder?.summary as any)?.malha_active_lots;
    const normalizeHistory = (arr: any[]): MalhaRollChangeHistoryEntry[] => {
        if (!Array.isArray(arr)) return [];
        return arr.map(h => ({
            id: h.id || `ml-hist-${Math.random()}`,
            timestamp: h.timestamp || new Date().toISOString(),
            position: (h.position || 'LONGITUDINAL') as 'LONGITUDINAL' | 'TRANSVERSAL',
            lotSai: h.lotSai || h.lot_sai || 'S/ REGISTRO',
            lotEntra: h.lotEntra || h.lot_entra || '',
            orderNumber: h.orderNumber || h.order_number
        }));
    };
    const summaryData: MalhaActiveLotsState | undefined = rawSummaryLots ? {
        longitudinal: rawSummaryLots.longitudinal || '',
        transversal: rawSummaryLots.transversal || '',
        updatedAt: rawSummaryLots.updatedAt || rawSummaryLots.updated_at,
        history: normalizeHistory(rawSummaryLots.history)
    } : undefined;

    if (summaryData && (summaryData.longitudinal || summaryData.transversal)) {
        if (!localData || (!localData.longitudinal && !localData.transversal)) {
            return {
                longitudinal: summaryData.longitudinal || '',
                transversal: summaryData.transversal || '',
                updatedAt: summaryData.updatedAt,
                history: summaryData.history || []
            };
        }
        // Usa o mais recente entre localStorage e summary
        const localTime = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
        const summaryTime = summaryData.updatedAt ? new Date(summaryData.updatedAt).getTime() : 0;
        if (summaryTime > localTime) {
            return {
                longitudinal: summaryData.longitudinal || localData.longitudinal || '',
                transversal: summaryData.transversal || localData.transversal || '',
                updatedAt: summaryData.updatedAt,
                history: (summaryData.history && summaryData.history.length > 0) ? summaryData.history : normalizeHistory(localData.history || [])
            };
        }
    }

    return {
        longitudinal: localData?.longitudinal || summaryData?.longitudinal || '',
        transversal: localData?.transversal || summaryData?.transversal || '',
        updatedAt: localData?.updatedAt || summaryData?.updatedAt,
        history: Array.isArray(localData?.history) && localData!.history.length > 0 ? normalizeHistory(localData!.history) : (summaryData?.history || [])
    };
};

export const saveMalhaActiveLots = async (
    machineName: string,
    activeOrder: ProductionOrderData | null | undefined,
    nextState: MalhaActiveLotsState
) => {
    const key = `malha_active_lots_${machineName || 'Malha 1'}`;
    const payload: MalhaActiveLotsState = {
        ...nextState,
        updatedAt: new Date().toISOString(),
        history: (nextState.history || []).slice(0, 50)
    };
    try {
        localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
        console.warn('Erro ao salvar lotes da Malha no localStorage:', e);
    }

    if (activeOrder?.id) {
        try {
            const currentSummary = (activeOrder.summary && typeof activeOrder.summary === 'object') ? activeOrder.summary : {};
            const updatedSummary = {
                ...currentSummary,
                malhaActiveLots: payload
            };
            await updateItem('production_orders', activeOrder.id, {
                summary: updatedSummary
            } as any);
        } catch (e) {
            console.warn('Erro ao sincronizar lotes da Malha no summary da OP:', e);
        }
    }
    return payload;
};

export const resolveMalhaExpectedGauges = (activeOrder?: ProductionOrderData | null): { longitudinal: string; transversal: string; longitudinalSpec?: string; transversalSpec?: string } => {
    const modelStr = (activeOrder?.malhaModel || (activeOrder as any)?.malha_model || activeOrder?.productDescription || '').toUpperCase();
    const fallbackBitola = (activeOrder?.targetBitola || (activeOrder as any)?.target_bitola || '').replace(/mm/gi, '').replace(',', '.').trim();
    const matchedConfig = DefaultMalhaGauges.find(cfg =>
        (cfg.productCode && modelStr.includes(cfg.productCode.toUpperCase())) ||
        (cfg.description && modelStr.includes(cfg.description.toUpperCase()))
    );
    if (matchedConfig) {
        const cleanGauge = String(matchedConfig.gauge || fallbackBitola || '5.00').replace(/mm/gi, '').replace(',', '.').trim();
        return {
            longitudinal: cleanGauge,
            transversal: cleanGauge,
            longitudinalSpec: matchedConfig.longitudinal,
            transversalSpec: matchedConfig.transversal
        };
    }
    return {
        longitudinal: fallbackBitola || '5.00',
        transversal: fallbackBitola || '5.00'
    };
};

const formatCleanLotNumber = (val: string) => {
    return val.replace(/^LOTE\s+/i, '').trim();
};

const DowntimeModal: React.FC<{
    onClose: () => void;
    onSubmit: (reason: string) => void;
    onEndShift?: () => void;
    onPauseOrder?: () => void;
    canPause?: boolean;
    downtimeEvents?: any[];
    downtimeConfigs?: DowntimeConfig[];
    machineType?: string;
    stock?: StockItem[];
    activeOrder?: ProductionOrderData | null;
    onMalhaLotsUpdated?: (nextState: MalhaActiveLotsState) => void;
}> = ({ onClose, onSubmit, onEndShift, onPauseOrder, canPause, downtimeEvents, downtimeConfigs = [], machineType = 'Geral', stock = [], activeOrder, onMalhaLotsUpdated }) => {
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

    // Controladoria de Eletrodos para Treliça
    const isTrelica = (machineType || '').startsWith('Treliça');
    const isMalha = (machineType || '').toLowerCase().includes('malha');

    const machineElectrodes = useMemo(() => {
        if (!isTrelica) return [];
        return getLocalMachineElectrodes(machineType || 'Treliça 1');
    }, [isTrelica, machineType]);

    const isElectrodeReasonSelected = useMemo(() => {
        if (!isTrelica) return false;
        return selectedReasons.some(r => {
            const low = r.toLowerCase();
            return low.includes('eletrodo') || low.includes('solda');
        });
    }, [isTrelica, selectedReasons]);

    const isTrocaSelected = useMemo(() => {
        return selectedReasons.some(r => r.toLowerCase().includes('troca de eletrodo'));
    }, [selectedReasons]);

    // Controladoria de Troca de Rolo para Malha (Longitudinal e Transversal, sem alterar status do estoque)
    const isMalhaRollChangeSelected = useMemo(() => {
        if (!isMalha) return false;
        return selectedReasons.some(r => {
            const low = r.toLowerCase();
            return low.includes('rolo') || low.includes('bobina');
        });
    }, [isMalha, selectedReasons]);

    const currentMalhaLots = useMemo(() => {
        if (!isMalha) return { longitudinal: '', transversal: '', history: [] };
        return getMalhaActiveLots(machineType || 'Malha 1', activeOrder);
    }, [isMalha, machineType, activeOrder]);

    const expectedMalhaGauges = useMemo(() => resolveMalhaExpectedGauges(activeOrder), [activeOrder]);

    const [malhaSelectedPositions, setMalhaSelectedPositions] = useState<Array<'LONGITUDINAL' | 'TRANSVERSAL'>>([]);
    const [malhaLotSaiLong, setMalhaLotSaiLong] = useState<string>(() => currentMalhaLots.longitudinal || '');
    const [malhaLotEntraLong, setMalhaLotEntraLong] = useState<string>('');
    const [malhaLotSaiTrans, setMalhaLotSaiTrans] = useState<string>(() => currentMalhaLots.transversal || '');
    const [malhaLotEntraTrans, setMalhaLotEntraTrans] = useState<string>('');
    const [showAllGaugesLong, setShowAllGaugesLong] = useState<boolean>(false);
    const [showAllGaugesTrans, setShowAllGaugesTrans] = useState<boolean>(false);
    const [pickingSaiField, setPickingSaiField] = useState<{ LONGITUDINAL?: boolean; TRANSVERSAL?: boolean }>({});

    useEffect(() => {
        if (isMalha) {
            const latest = getMalhaActiveLots(machineType || 'Malha 1', activeOrder);
            if (latest.longitudinal && !malhaLotSaiLong) setMalhaLotSaiLong(latest.longitudinal);
            if (latest.transversal && !malhaLotSaiTrans) setMalhaLotSaiTrans(latest.transversal);
        }
    }, [isMalha, machineType, activeOrder]);

    const toggleMalhaPosition = (pos: 'LONGITUDINAL' | 'TRANSVERSAL') => {
        setMalhaSelectedPositions(prev =>
            prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
        );
    };

    const availableMalhaStockLots = useMemo(() => {
        if (!isMalha || !Array.isArray(stock)) return [];
        return stock
            .filter(item => {
                if (!item || !item.internalLot) return false;
                const st = (item.status || '').toLowerCase();
                if (st.includes('consumido') || st.includes('finalizado') || st.includes('sucata')) return false;
                const mat = (item.materialType || '').toUpperCase();
                // Prioriza CA-60 (ou qualquer item que não seja Fio Máquina bruto se houver CA-60)
                return mat.includes('CA-60') || mat.includes('CA60') || !mat.includes('FIO MÁQUINA');
            })
            .sort((a, b) => String(b.internalLot).localeCompare(String(a.internalLot), undefined, { numeric: true }));
    }, [isMalha, stock]);

    const getFilteredLotsForPosition = (pos: 'LONGITUDINAL' | 'TRANSVERSAL', searchVal: string, showAllGauges: boolean) => {
        const expectedGauge = pos === 'LONGITUDINAL' ? expectedMalhaGauges.longitudinal : expectedMalhaGauges.transversal;
        const cleanSearch = formatCleanLotNumber(searchVal).toLowerCase();

        return availableMalhaStockLots.filter(item => {
            const itemGauge = String(item.bitola || '').replace(',', '.').trim();
            if (!showAllGauges && expectedGauge && itemGauge !== expectedGauge) {
                return false;
            }
            if (cleanSearch) {
                const lotStr = String(item.internalLot || '').toLowerCase();
                return lotStr.includes(cleanSearch);
            }
            return true;
        }).slice(0, 24);
    };

    const [isAllElectrodes, setIsAllElectrodes] = useState(false);
    const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
    const [replacementLots, setReplacementLots] = useState<Record<string, string>>({});

    const toggleElectrodePosition = (pos: string) => {
        setIsAllElectrodes(false);
        setSelectedPositions(prev => 
            prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
        );
    };

    const toggleAllElectrodes = () => {
        if (isAllElectrodes) {
            setIsAllElectrodes(false);
            setSelectedPositions([]);
        } else {
            setIsAllElectrodes(true);
            setSelectedPositions(machineElectrodes.map(e => e.position));
        }
    };
    
    const dynamicDowntimeReasons = useMemo(() => {
        const defaultTrefila = [
            'Enrosco de fio', 'Quebra de fio', 'Troca de rolo / Setup', 
            'Limpeza / Lubrificação', 'Manutenção Mecânica', 'Manutenção Elétrica', 
            'Falta de Matéria-Prima', 'Ajuste de bitola', 'Falta de Energia', 'Refeição / Intervalo'
        ];
        const defaultTrelica = [
            'Troca de Eletrodo', 'Limpeza de Eletrodos', 'Regulagem de Altura / Ângulo', 
            'Enrosco de Fio (Porta-Rolos)', 'Quebra de Fio', 'Falha de Solda', 
            'Setup de Medida', 'Manutenção Mecânica', 'Manutenção Elétrica', 
            'Falta de Matéria-Prima', 'Falta de Energia', 'Refeição / Intervalo'
        ];
        const defaultMalha = [
            'Troca de Rolo', 'Falha de Solda', 
            'Manutenção Mecânica', 'Manutenção Elétrica', 'Falta de Energia'
        ];
        const defaultDesbobinadeira = [
            'Troca de Rolo', 'Enrosco de Fio', 'Corte / Descarte', 'Manutenção Mecânica', 'Manutenção Elétrica', 'Refeição / Intervalo'
        ];

        const mTypeNorm = (machineType || '').toLowerCase();
        const isMalhaMachine = mTypeNorm.includes('malha');
        const excludedMalhaReasons = ['falta de fio', 'refeicao / intervalo', 'refeicao/intervalo', 'refeicao', 'intervalo', 'ajuste de espacamento', 'ajuste de espaçamento'];

        let fallbackList = defaultTrefila;
        if (mTypeNorm.includes('treli')) fallbackList = defaultTrelica;
        else if (isMalhaMachine) fallbackList = defaultMalha;
        else if (mTypeNorm.includes('desbobinad')) fallbackList = defaultDesbobinadeira;

        // Motivos cadastrados no banco de dados para esta máquina ou gerais
        const dbFiltered = (downtimeConfigs || [])
            .filter(c => {
                if (!c.isActive) return false;
                const reasonLower = (c.reason || '').toLowerCase().trim();
                if (reasonLower === 'outros' || reasonLower === 'outro') return false;
                if (isMalhaMachine && excludedMalhaReasons.some(ex => reasonLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(ex.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
                    return false;
                }
                if (!c.machineType || c.machineType === 'Geral') return true;
                const cNorm = c.machineType.toLowerCase();
                return mTypeNorm.includes(cNorm) || cNorm.includes(mTypeNorm.split(' ')[0]);
            })
            .map(c => c.reason);

        // Combina motivos do banco de dados (prioridade) com lista padrão sem duplicações e sem 'Outros'
        const combined = [...dbFiltered];
        fallbackList.forEach(item => {
            const itemLower = item.toLowerCase().trim();
            if (itemLower === 'outros' || itemLower === 'outro') return;
            if (isMalhaMachine && excludedMalhaReasons.some(ex => itemLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(ex.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
                return;
            }
            const exists = combined.some(r => r.toLowerCase().trim() === itemLower);
            if (!exists) combined.push(item);
        });

        return combined.filter(r => {
            const low = r.toLowerCase().trim();
            if (low === 'outros' || low === 'outro') return false;
            if (isMalhaMachine && excludedMalhaReasons.some(ex => low.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(ex.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) return false;
            return true;
        });
    }, [downtimeConfigs, machineType]);

    const toggleReason = (r: string) => {
        setSelectedReasons(prev =>
            prev.includes(r) ? prev.filter(item => item !== r) : [...prev, r]
        );
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const reasons = [...selectedReasons];

        let finalReason = reasons.join(' + ');
        if (!finalReason) {
            alert('Por favor, selecione pelo menos um motivo de parada.');
            return;
        }

        // Se motivo envolver eletrodo na Treliça, exigir a seleção dos eletrodos/lotes
        if (isElectrodeReasonSelected) {
            if (!isAllElectrodes && selectedPositions.length === 0) {
                alert('⚠️ ATENÇÃO OPERADOR:\n\nPara a controladoria da Treliça, é obrigatório selecionar qual(is) eletrodo(s) foram atendidos (ou clicar em "Limpeza Geral de Todos os Eletrodos").');
                return;
            }

            let electrodeNote = '';
            if (isAllElectrodes) {
                electrodeNote = 'Limpeza Geral - Todos os 12 Eletrodos';
            } else {
                const parts = selectedPositions.map(pos => {
                    const el = machineElectrodes.find(e => e.position === pos);
                    const label = el?.position_label || pos;
                    const currentLot = el?.lot_number || 'Sem Lote';
                    if (isTrocaSelected) {
                        const newLot = replacementLots[pos]?.trim() || `EL-NOVO-${Date.now().toString().slice(-4)}`;
                        return `Troca ${label}: Lote ${currentLot} ➔ Novo Lote ${newLot}`;
                    }
                    return `${label} (Lote: ${currentLot})`;
                });
                electrodeNote = parts.join(', ');
            }

            // Atualiza os lotes locais se houve troca
            if (isTrocaSelected && !isAllElectrodes) {
                const updatedEls = machineElectrodes.map(el => {
                    if (selectedPositions.includes(el.position)) {
                        const newLot = replacementLots[el.position]?.trim();
                        if (newLot) {
                            return {
                                ...el,
                                lot_number: newLot,
                                installed_at: new Date().toISOString(),
                                meters_produced: 0,
                                pieces_produced: 0,
                                status: 'active' as const
                            };
                        }
                    }
                    return el;
                });
                saveLocalMachineElectrodes(machineType || 'Treliça 1', updatedEls);
            }

            finalReason = `${finalReason} [${electrodeNote}]`;
        }

        // Se motivo envolver Troca de Rolo na Malha, exigir seleção Longitudinal/Transversal e lote que entra
        if (isMalhaRollChangeSelected) {
            if (malhaSelectedPositions.length === 0) {
                alert('⚠️ ATENÇÃO OPERADOR:\n\nSelecione qual rolo está sendo trocado na Malha:\n• FIO LONGITUDINAL e/ou\n• FIO TRANSVERSAL');
                return;
            }

            const rollParts: string[] = [];
            const latestState = getMalhaActiveLots(machineType || 'Malha 1', activeOrder);
            let nextLong = latestState.longitudinal || '';
            let nextTrans = latestState.transversal || '';
            const newHistoryEntries: MalhaRollChangeHistoryEntry[] = [];

            if (malhaSelectedPositions.includes('LONGITUDINAL')) {
                const cleanEntra = formatCleanLotNumber(malhaLotEntraLong);
                const cleanSai = formatCleanLotNumber(malhaLotSaiLong || latestState.longitudinal || '');
                if (!cleanEntra) {
                    alert('⚠️ ATENÇÃO OPERADOR:\n\nSelecione ou digite o LOTE QUE ENTRA no Fio LONGITUDINAL.');
                    return;
                }
                const saiDisplay = cleanSai ? `LOTE ${cleanSai}` : 'S/ REGISTRO';
                rollParts.push(`LONGITUDINAL (SAI: ${saiDisplay} / ENTRA: LOTE ${cleanEntra})`);
                nextLong = cleanEntra;
                newHistoryEntries.push({
                    id: `ml-hist-${Date.now()}-L`,
                    timestamp: new Date().toISOString(),
                    position: 'LONGITUDINAL',
                    lotSai: cleanSai || 'S/ REGISTRO',
                    lotEntra: cleanEntra,
                    orderNumber: activeOrder?.orderNumber
                });
            }

            if (malhaSelectedPositions.includes('TRANSVERSAL')) {
                const cleanEntra = formatCleanLotNumber(malhaLotEntraTrans);
                const cleanSai = formatCleanLotNumber(malhaLotSaiTrans || latestState.transversal || '');
                if (!cleanEntra) {
                    alert('⚠️ ATENÇÃO OPERADOR:\n\nSelecione ou digite o LOTE QUE ENTRA no Fio TRANSVERSAL.');
                    return;
                }
                const saiDisplay = cleanSai ? `LOTE ${cleanSai}` : 'S/ REGISTRO';
                rollParts.push(`TRANSVERSAL (SAI: ${saiDisplay} / ENTRA: LOTE ${cleanEntra})`);
                nextTrans = cleanEntra;
                newHistoryEntries.push({
                    id: `ml-hist-${Date.now()}-T`,
                    timestamp: new Date().toISOString(),
                    position: 'TRANSVERSAL',
                    lotSai: cleanSai || 'S/ REGISTRO',
                    lotEntra: cleanEntra,
                    orderNumber: activeOrder?.orderNumber
                });
            }

            const nextMalhaState: MalhaActiveLotsState = {
                longitudinal: nextLong,
                transversal: nextTrans,
                updatedAt: new Date().toISOString(),
                history: [...newHistoryEntries, ...(latestState.history || [])].slice(0, 50)
            };

            saveMalhaActiveLots(machineType || 'Malha 1', activeOrder, nextMalhaState);
            if (onMalhaLotsUpdated) {
                onMalhaLotsUpdated(nextMalhaState);
            }

            // Substitui o motivo "Troca de Rolo" pela descrição completa com Longitudinal/Transversal e SAI/ENTRA
            const otherReasons = reasons.filter(r => {
                const low = r.toLowerCase();
                return !low.includes('rolo') && !low.includes('bobina');
            });
            const formattedRollChange = `Troca de Rolo ${rollParts.join(' + ')}`;
            finalReason = [formattedRollChange, ...otherReasons].join(' + ');
        }

        // Check for repeat reasons (excluding ADMINISTRATIVE reasons like Shift End)
        const administrativeReasons = ['Aguardando Início da Produção', 'Aguardando Início de Lote', 'Final de Turno'];
        const repeatReasons = reasons.filter(r => 
            !administrativeReasons.includes(r) && 
            (downtimeEvents || []).some(e => e.reason && e.reason.includes(r))
        );

        if (repeatReasons.length > 0) {
            const count = (downtimeEvents || []).filter(e => repeatReasons.some(r => e.reason && e.reason.includes(r))).length;
            const confirmed = window.confirm(
                `⚠️ ATENÇÃO OPERADOR!\n\n` +
                `Motivo(s) recorrente(s): ${repeatReasons.join(', ')}\n` +
                `Já tivemos ${count} parada(s) por esse(s) motivo(s) nesta ordem.\n\n` +
                `Você já tomou a iniciativa necessária para que isso não aconteça novamente?`
            );
            if (!confirmed) return;
        }

        onSubmit(finalReason);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6">
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden animate-zoom-in border border-slate-100">
                
                {/* Header */}
                <div className="bg-slate-50 p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-white to-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <PauseIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            MENU OPERACIONAL
                        </h2>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Interromper atividade ou Encerrar</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90">
                        <XCircleIcon className="h-8 w-8" />
                    </button>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {dynamicDowntimeReasons.map(r => {
                            const isActive = selectedReasons.includes(r);
                            
                            // Normalização para busca robusta
                            const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const normR = normalize(r);
                            const machineCategory = machineType.toLowerCase().includes('trefila') ? 'trefila' : 
                                               machineType.toLowerCase().includes('trelica') ? 'trelica' : 
                                               machineType.toLowerCase().trim();

                            const config = (downtimeConfigs || []).find(c => {
                                const normConfigR = normalize(c.reason);
                                const configCategory = normalize(c.machineType);
                                return normR === normConfigR && 
                                       (configCategory === 'geral' || configCategory === machineCategory);
                            });
                            
                            const limit = config ? config.thresholdMinutes : (DOWNTIME_THRESHOLDS[r] || 15);
                            
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => toggleReason(r)}
                                    className={`flex flex-col items-start gap-1 p-5 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${
                                        isActive
                                            ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
                                        <span className="flex-1 uppercase italic tracking-tight truncate">{r}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <ClockIcon className={`h-3 w-3 ${isActive ? 'text-amber-100' : 'text-slate-400'}`} />
                                        <span className={`text-[10px] font-bold ${isActive ? 'text-amber-100' : 'text-slate-400'}`}>
                                            Limite: {limit} min
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* PAINEL DE CONTROLADORIA DE ELETRODOS */}
                    {isElectrodeReasonSelected && (
                        <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-cyan-500/50 shadow-xl space-y-3 animate-fade-in text-white">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-lg">⚡</span>
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                                            Controladoria de Eletrodos • {machineType}
                                        </h4>
                                        <p className="text-[10px] text-slate-400">
                                            {isTrocaSelected 
                                                ? 'Selecione o eletrodo substituído e informe o novo lote:' 
                                                : 'Selecione qual(is) eletrodo(s) foram limpos ou ajustados:'}
                                        </p>
                                    </div>
                                </div>
                                {!isTrocaSelected && (
                                    <button
                                        type="button"
                                        onClick={toggleAllElectrodes}
                                        className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition active:scale-95 border cursor-pointer ${
                                            isAllElectrodes 
                                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(0,229,255,0.4)]' 
                                                : 'bg-white/10 text-slate-300 border-white/15 hover:bg-white/15'
                                        }`}
                                    >
                                        ⚡ Limpeza Geral (Todos os 12)
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {machineElectrodes.map(el => {
                                    const isSelected = isAllElectrodes || selectedPositions.includes(el.position);
                                    return (
                                        <div
                                            key={el.position}
                                            onClick={() => toggleElectrodePosition(el.position)}
                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all active:scale-95 ${
                                                isSelected
                                                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                                                    : 'bg-slate-800/80 border-white/5 text-slate-300 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black truncate">{el.position_label}</span>
                                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                                    isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-transparent'
                                                }`}>
                                                    ✓
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-mono text-cyan-300/80 block mt-0.5 truncate">
                                                Lote: <strong className="text-white">{el.lot_number || 'Sem Lote'}</strong>
                                            </span>

                                            {isTrocaSelected && isSelected && (
                                                <div className="mt-2 pt-1.5 border-t border-white/10" onClick={e => e.stopPropagation()}>
                                                    <label className="text-[8px] font-black uppercase text-amber-300 block">Novo Lote:</label>
                                                    <input
                                                        type="text"
                                                        value={replacementLots[el.position] || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setReplacementLots(prev => ({ ...prev, [el.position]: val }));
                                                        }}
                                                        placeholder="Ex: EL-1008-02"
                                                        className="w-full mt-0.5 px-2 py-1 rounded bg-black/50 border border-amber-400/50 text-[10px] font-mono text-amber-200 outline-none focus:border-amber-400"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PAINEL DE TROCA DE ROLO DA MALHA (LONGITUDINAL E TRANSVERSAL - SEM ALTERAR STATUS DE ESTOQUE) */}
                    {isMalhaRollChangeSelected && (
                        <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-amber-500/60 shadow-xl space-y-4 animate-fade-in text-white">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 text-lg">🔄</span>
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                                            Troca de Rolo • {machineType} (Longitudinal / Transversal)
                                        </h4>
                                        <p className="text-[10px] text-slate-400">
                                            Selecione a posição do fio e o lote que entra na máquina (apenas registro p/ relatório)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Botões de Seleção de Posição: Longitudinal / Transversal */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                    1. Qual posição de fio está trocando?
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['LONGITUDINAL', 'TRANSVERSAL'] as const).map(pos => {
                                        const isPosSelected = malhaSelectedPositions.includes(pos);
                                        const currentActiveLot = pos === 'LONGITUDINAL' ? currentMalhaLots.longitudinal : currentMalhaLots.transversal;
                                        const expectedGauge = pos === 'LONGITUDINAL' ? expectedMalhaGauges.longitudinal : expectedMalhaGauges.transversal;
                                        return (
                                            <button
                                                key={pos}
                                                type="button"
                                                onClick={() => toggleMalhaPosition(pos)}
                                                className={`p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer flex flex-col gap-1 ${
                                                    isPosSelected
                                                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                                                        : 'bg-slate-800/80 border-white/10 text-slate-300 hover:border-white/30'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                                        <span>{pos === 'LONGITUDINAL' ? '↔️' : '↕️'}</span>
                                                        <span>{pos}</span>
                                                    </span>
                                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                        isPosSelected ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-transparent'
                                                    }`}>
                                                        ✓
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                                    <span>Atual: <strong className="text-amber-300 font-mono">{currentActiveLot ? `LOTE ${currentActiveLot}` : 'Não def.'}</strong></span>
                                                    {expectedGauge && <span className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[9px] text-cyan-300">{expectedGauge}mm</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Campos de Lote SAI / Lote ENTRA para cada posição selecionada */}
                            {malhaSelectedPositions.map(pos => {
                                const isLong = pos === 'LONGITUDINAL';
                                const lotSai = isLong ? malhaLotSaiLong : malhaLotSaiTrans;
                                const setLotSai = isLong ? setMalhaLotSaiLong : setMalhaLotSaiTrans;
                                const lotEntra = isLong ? malhaLotEntraLong : malhaLotEntraTrans;
                                const setLotEntra = isLong ? setMalhaLotEntraLong : setMalhaLotEntraTrans;
                                const showAllGauges = isLong ? showAllGaugesLong : showAllGaugesTrans;
                                const setShowAllGauges = isLong ? setShowAllGaugesLong : setShowAllGaugesTrans;
                                const expectedGauge = isLong ? expectedMalhaGauges.longitudinal : expectedMalhaGauges.transversal;
                                const isPickingSai = !!pickingSaiField[pos];

                                const activeSearchValue = isPickingSai ? lotSai : lotEntra;
                                const filteredStockLots = getFilteredLotsForPosition(pos, activeSearchValue, showAllGauges);

                                return (
                                    <div key={pos} className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-3 animate-fade-in">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                                <span>{isLong ? '↔️' : '↕️'}</span>
                                                <span>FIO {pos}</span>
                                            </span>
                                            {expectedGauge && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllGauges(!showAllGauges)}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition cursor-pointer ${
                                                        showAllGauges
                                                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                                            : 'bg-white/5 border-white/15 text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    {showAllGauges ? 'Mostrando Todas Bitolas CA-60' : `Filtro Bitola ${expectedGauge}mm (Ver Todas)`}
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* LOTE QUE SAI */}
                                            <div
                                                onClick={() => setPickingSaiField(prev => ({ ...prev, [pos]: true }))}
                                                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                                                    isPickingSai
                                                        ? 'bg-rose-950/40 border-rose-400 ring-1 ring-rose-400/50'
                                                        : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[9px] font-black uppercase tracking-wider text-rose-300">
                                                        📤 Lote que SAI (Anterior)
                                                    </label>
                                                    {isPickingSai && <span className="text-[8px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded">Selecionando abaixo</span>}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={lotSai}
                                                    onFocus={() => setPickingSaiField(prev => ({ ...prev, [pos]: true }))}
                                                    onChange={(e) => setLotSai(e.target.value)}
                                                    placeholder="Ex: 8451 (ou deixe vazio)"
                                                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-rose-500/40 text-xs font-mono font-black text-rose-200 outline-none focus:border-rose-400"
                                                />
                                            </div>

                                            {/* LOTE QUE ENTRA */}
                                            <div
                                                onClick={() => setPickingSaiField(prev => ({ ...prev, [pos]: false }))}
                                                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                                                    !isPickingSai
                                                        ? 'bg-emerald-950/40 border-emerald-400 ring-1 ring-emerald-400/50'
                                                        : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                                        📥 Lote que ENTRA (Novo) *
                                                    </label>
                                                    {!isPickingSai && <span className="text-[8px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded">Selecionando abaixo</span>}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={lotEntra}
                                                    onFocus={() => setPickingSaiField(prev => ({ ...prev, [pos]: false }))}
                                                    onChange={(e) => setLotEntra(e.target.value)}
                                                    placeholder="Digite ou clique num lote abaixo..."
                                                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-emerald-500/50 text-xs font-mono font-black text-emerald-200 outline-none focus:border-emerald-400"
                                                />
                                            </div>
                                        </div>

                                        {/* Lista rápida de Lotes do Estoque para clicar e preencher */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                    Clique em um lote disponível para preencher {isPickingSai ? '📤 LOTE QUE SAI' : '📥 LOTE QUE ENTRA'}:
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-500">
                                                    {filteredStockLots.length} lote(s)
                                                </span>
                                            </div>
                                            {filteredStockLots.length > 0 ? (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-black/30 rounded-xl border border-white/5">
                                                    {filteredStockLots.map(item => {
                                                        const cleanLot = String(item.internalLot || '').trim();
                                                        const isSelectedHere = formatCleanLotNumber(activeSearchValue) === cleanLot;
                                                        const weightKg = Number(item.remainingQuantity ?? item.initialQuantity ?? 0);
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isPickingSai) {
                                                                        setLotSai(cleanLot);
                                                                        setPickingSaiField(prev => ({ ...prev, [pos]: false }));
                                                                    } else {
                                                                        setLotEntra(cleanLot);
                                                                    }
                                                                }}
                                                                className={`p-1.5 rounded-lg border text-left transition active:scale-95 cursor-pointer flex flex-col ${
                                                                    isSelectedHere
                                                                        ? isPickingSai
                                                                            ? 'bg-rose-500/30 border-rose-400 text-white'
                                                                            : 'bg-emerald-500/30 border-emerald-400 text-white'
                                                                        : 'bg-slate-900 border-white/10 text-slate-300 hover:border-amber-400/50 hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                <span className="text-[11px] font-black font-mono text-white truncate">
                                                                    Lote {cleanLot}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-slate-400 truncate">
                                                                    {item.bitola}mm • {weightKg > 0 ? `${weightKg.toFixed(0)}kg` : ''}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-2.5 px-3 bg-black/20 rounded-xl border border-white/5 text-[10px] text-slate-400">
                                                    Nenhum lote encontrado no filtro atual. Você pode digitar o número do lote diretamente acima ou clicar em "Ver Todas".
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <button 
                            type="button"
                            onClick={handleSubmit} 
                            disabled={selectedReasons.length === 0}
                            className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <StopIcon className="h-6 w-6" /> REGISTRAR MOTIVO E PARAR
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            {onEndShift && (
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onEndShift(); }}
                                    className="h-20 bg-rose-50 border-2 border-rose-100 text-rose-600 font-black rounded-3xl hover:bg-rose-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <ClockIcon className="h-6 w-6" /> 
                                    <span className="text-[10px]">ENCERRAR TURNO</span>
                                </button>
                            )}
                            {canPause && onPauseOrder && (
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onPauseOrder(); }}
                                    className="h-20 bg-amber-50 border-2 border-amber-100 text-amber-600 font-black rounded-3xl hover:bg-amber-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <ArchiveIcon className="h-6 w-6" /> 
                                    <span className="text-[10px]">PAUSAR/TROCAR</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MalhaActiveLotsCard: React.FC<{
    machineName: string;
    activeOrder: ProductionOrderData;
    stock: StockItem[];
    isStoppedMode?: boolean;
    onUpdateOpenDowntimeReason?: (newFormattedRollReason: string) => void;
}> = ({ machineName, activeOrder, stock, isStoppedMode = false, onUpdateOpenDowntimeReason }) => {
    const [lotsState, setLotsState] = useState<MalhaActiveLotsState>(() => getMalhaActiveLots(machineName, activeOrder));
    const [editingPos, setEditingPos] = useState<'LONGITUDINAL' | 'TRANSVERSAL' | null>(null);
    const [editMode, setEditMode] = useState<'SET_CURRENT' | 'SWAP'>('SET_CURRENT');
    const [lotSaiInput, setLotSaiInput] = useState<string>('');
    const [lotEntraInput, setLotEntraInput] = useState<string>('');
    const [showAllGauges, setShowAllGauges] = useState<boolean>(false);
    const [pickingSai, setPickingSai] = useState<boolean>(false);

    useEffect(() => {
        setLotsState(getMalhaActiveLots(machineName, activeOrder));
    }, [machineName, activeOrder?.id, (activeOrder?.summary as any)?.malhaActiveLots?.updatedAt]);

    const expectedGauges = useMemo(() => resolveMalhaExpectedGauges(activeOrder), [activeOrder]);

    const availableLots = useMemo(() => {
        if (!Array.isArray(stock)) return [];
        return stock
            .filter(item => {
                if (!item || !item.internalLot) return false;
                const st = (item.status || '').toLowerCase();
                if (st.includes('consumido') || st.includes('finalizado') || st.includes('sucata')) return false;
                const mat = (item.materialType || '').toUpperCase();
                return mat.includes('CA-60') || mat.includes('CA60') || !mat.includes('FIO MÁQUINA');
            })
            .sort((a, b) => String(b.internalLot).localeCompare(String(a.internalLot), undefined, { numeric: true }));
    }, [stock]);

    const handleOpenEdit = (pos: 'LONGITUDINAL' | 'TRANSVERSAL', mode: 'SET_CURRENT' | 'SWAP') => {
        const currentVal = pos === 'LONGITUDINAL' ? lotsState.longitudinal : lotsState.transversal;
        setEditingPos(pos);
        setEditMode(mode);
        if (mode === 'SET_CURRENT') {
            setLotEntraInput(currentVal || '');
            setLotSaiInput('');
            setPickingSai(false);
        } else {
            setLotSaiInput(currentVal || '');
            setLotEntraInput('');
            setPickingSai(false);
        }
    };

    const handleConfirmEdit = async () => {
        if (!editingPos) return;
        const cleanEntra = formatCleanLotNumber(lotEntraInput);
        if (!cleanEntra) {
            alert('Por favor, selecione ou digite o número do lote.');
            return;
        }
        const cleanSai = formatCleanLotNumber(lotSaiInput);
        const nextState: MalhaActiveLotsState = {
            ...lotsState,
            longitudinal: editingPos === 'LONGITUDINAL' ? cleanEntra : lotsState.longitudinal,
            transversal: editingPos === 'TRANSVERSAL' ? cleanEntra : lotsState.transversal,
            updatedAt: new Date().toISOString(),
            history: [...(lotsState.history || [])]
        };

        if (editMode === 'SWAP') {
            const saiLabel = cleanSai ? `LOTE ${cleanSai}` : 'S/ REGISTRO';
            const formattedReason = `Troca de Rolo ${editingPos} (SAI: ${saiLabel} / ENTRA: LOTE ${cleanEntra})`;
            nextState.history = [
                {
                    id: `ml-hist-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    position: editingPos,
                    lotSai: cleanSai || 'S/ REGISTRO',
                    lotEntra: cleanEntra,
                    orderNumber: activeOrder.orderNumber
                },
                ...(lotsState.history || [])
            ].slice(0, 50);

            if (onUpdateOpenDowntimeReason) {
                onUpdateOpenDowntimeReason(formattedReason);
            } else if (activeOrder?.id) {
                // Mesmo na tela principal (após retomar a parada), vincula automaticamente à parada aberta ou à última parada de Troca de Rolo do dia!
                try {
                    const currentEvents = [...(activeOrder.downtimeEvents || (activeOrder as any).downtime_events || [])];
                    let targetIdx = currentEvents.findIndex(e => !e.resumeTime && !(e as any).resume_time);
                    if (targetIdx === -1) {
                        // Procura de trás para frente a última parada de Troca de Rolo que ainda não tinha lote específico (ou a última Troca de Rolo)
                        for (let i = currentEvents.length - 1; i >= 0; i--) {
                            const rUp = String(currentEvents[i].reason || '').toUpperCase();
                            if (rUp.includes('TROCA DE ROLO') || rUp.includes('TROCA DO ROLO') || rUp.includes('BOBINA')) {
                                if (!rUp.includes('ENTRA:')) {
                                    targetIdx = i;
                                    break;
                                }
                                if (targetIdx === -1) targetIdx = i;
                            }
                        }
                    }
                    if (targetIdx !== -1) {
                        currentEvents[targetIdx] = {
                            ...currentEvents[targetIdx],
                            reason: formattedReason
                        };
                        activeOrder.downtimeEvents = currentEvents;
                        await updateItem('production_orders', activeOrder.id, {
                            downtimeEvents: currentEvents
                        } as any);
                    }
                } catch (err) {
                    console.warn('Erro ao vincular troca de rolo à parada da Malha:', err);
                }
            }
        }

        const saved = await saveMalhaActiveLots(machineName, activeOrder, nextState);
        setLotsState(saved);
        setEditingPos(null);
    };

    const filteredLots = useMemo(() => {
        if (!editingPos) return [];
        const expectedGauge = editingPos === 'LONGITUDINAL' ? expectedGauges.longitudinal : expectedGauges.transversal;
        const searchVal = formatCleanLotNumber(pickingSai ? lotSaiInput : lotEntraInput).toLowerCase();
        return availableLots.filter(item => {
            const itemGauge = String(item.bitola || '').replace(',', '.').trim();
            if (!showAllGauges && expectedGauge && itemGauge !== expectedGauge) return false;
            if (searchVal) {
                return String(item.internalLot || '').toLowerCase().includes(searchVal);
            }
            return true;
        }).slice(0, 24);
    }, [editingPos, expectedGauges, showAllGauges, pickingSai, lotSaiInput, lotEntraInput, availableLots]);

    return (
        <div className={`${isStoppedMode ? 'bg-slate-900 border-2 border-amber-500/50 text-white' : 'bg-white border border-slate-200 text-slate-800'} p-3.5 sm:p-5 rounded-2xl shadow-sm space-y-3.5 text-left w-full max-w-full overflow-hidden`}>
            <div className="flex items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/20">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 text-base sm:text-lg shrink-0">🔄</span>
                    <div className="min-w-0">
                        <h3 className={`text-xs sm:text-base font-black tracking-tight uppercase leading-tight break-words ${isStoppedMode ? 'text-amber-300' : 'text-slate-800'}`}>
                            Lotes em Operação na Malha
                        </h3>
                        <p className={`text-[10px] sm:text-[11px] font-medium leading-snug mt-0.5 break-words ${isStoppedMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Longitudinal & Transversal (sem alterar status do estoque)
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {(['LONGITUDINAL', 'TRANSVERSAL'] as const).map(pos => {
                    const isLong = pos === 'LONGITUDINAL';
                    const activeLot = isLong ? lotsState.longitudinal : lotsState.transversal;
                    const gauge = isLong ? expectedGauges.longitudinal : expectedGauges.transversal;

                    return (
                        <div
                            key={pos}
                            className={`p-3 sm:p-3.5 rounded-2xl border-2 flex flex-col justify-between gap-2.5 min-w-0 w-full ${
                                isStoppedMode
                                    ? 'bg-slate-950/80 border-white/10'
                                    : activeLot
                                        ? 'bg-amber-50/40 border-amber-200'
                                        : 'bg-slate-50 border-slate-200 border-dashed'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="min-w-0">
                                    <div className={`text-[10px] font-black uppercase tracking-wider flex items-center flex-wrap gap-1.5 ${isStoppedMode ? 'text-amber-400' : 'text-amber-700'}`}>
                                        <span>{isLong ? '↔️ FIO LONGITUDINAL' : '↕️ FIO TRANSVERSAL'}</span>
                                        {gauge && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] font-mono shrink-0">
                                                ({gauge}mm)
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1">
                                        {activeLot ? (
                                            <span className={`text-lg sm:text-xl font-black font-mono ${isStoppedMode ? 'text-white' : 'text-slate-900'}`}>
                                                LOTE {activeLot}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400 italic">
                                                Nenhum lote definido
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                    activeLot
                                        ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                                        : 'bg-slate-500/20 text-slate-400'
                                }`}>
                                    {activeLot ? 'Em Máquina' : 'Aguardando'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 w-full">
                                <button
                                    type="button"
                                    onClick={() => handleOpenEdit(pos, 'SWAP')}
                                    className="w-full py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wide transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-sm truncate"
                                >
                                    <span>🔄</span>
                                    <span className="truncate">Trocar Lote</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenEdit(pos, 'SET_CURRENT')}
                                    className={`w-full py-2.5 px-2 rounded-xl font-bold text-[10px] sm:text-[11px] uppercase transition active:scale-95 cursor-pointer border flex items-center justify-center gap-1 truncate ${
                                        isStoppedMode
                                            ? 'bg-slate-800 border-white/15 text-slate-300 hover:bg-slate-700'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                    title="Definir ou corrigir o lote atual sem registrar troca"
                                >
                                    <span>✏️</span>
                                    <span className="truncate">Definir Atual</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Painel de Edição / Seleção de Lote */}
            {editingPos && (
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 text-white border-2 border-amber-400 space-y-3 animate-fade-in w-full max-w-full overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-300 leading-tight">
                            {editMode === 'SWAP'
                                ? `🔄 Troca de Rolo • FIO ${editingPos}`
                                : `✏️ Lote Atual • FIO ${editingPos}`}
                        </span>
                        <button
                            type="button"
                            onClick={() => setEditingPos(null)}
                            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded shrink-0"
                        >
                            ✕ Fechar
                        </button>
                    </div>

                    {editMode === 'SWAP' ? (
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div
                                onClick={() => setPickingSai(true)}
                                className={`p-2 sm:p-2.5 rounded-xl border cursor-pointer min-w-0 ${
                                    pickingSai ? 'bg-rose-950/50 border-rose-400' : 'bg-slate-950 border-white/10'
                                }`}
                            >
                                <label className="text-[9px] font-black uppercase text-rose-300 block mb-1 truncate">
                                    📤 Lote que SAIU
                                </label>
                                <input
                                    type="text"
                                    value={lotSaiInput}
                                    onFocus={() => setPickingSai(true)}
                                    onChange={e => setLotSaiInput(e.target.value)}
                                    placeholder="Ex: 8451"
                                    className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-rose-500/40 text-xs font-mono font-black text-rose-200 outline-none"
                                />
                            </div>
                            <div
                                onClick={() => setPickingSai(false)}
                                className={`p-2 sm:p-2.5 rounded-xl border cursor-pointer min-w-0 ${
                                    !pickingSai ? 'bg-emerald-950/50 border-emerald-400' : 'bg-slate-950 border-white/10'
                                }`}
                            >
                                <label className="text-[9px] font-black uppercase text-emerald-300 block mb-1 truncate">
                                    📥 Lote que ENTROU *
                                </label>
                                <input
                                    type="text"
                                    value={lotEntraInput}
                                    onFocus={() => setPickingSai(false)}
                                    onChange={e => setLotEntraInput(e.target.value)}
                                    placeholder="Novo lote..."
                                    className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-emerald-500/50 text-xs font-mono font-black text-emerald-200 outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-[10px] font-black uppercase text-emerald-300 block mb-1">
                                📥 Lote atualmente em operação no Fio {editingPos}:
                            </label>
                            <input
                                type="text"
                                value={lotEntraInput}
                                onChange={e => setLotEntraInput(e.target.value)}
                                placeholder="Digite ou selecione abaixo o número do lote..."
                                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-500/50 text-sm font-mono font-black text-emerald-200 outline-none"
                            />
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                Lotes CA-60 no estoque:
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowAllGauges(!showAllGauges)}
                                className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-cyan-300 hover:bg-white/20 cursor-pointer"
                            >
                                {showAllGauges ? 'Mostrando Todas Bitolas' : 'Ver Todas Bitolas CA-60'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-1 bg-black/40 rounded-xl">
                            {filteredLots.map(item => {
                                const cleanLot = String(item.internalLot || '').trim();
                                const weightKg = Number(item.remainingQuantity ?? item.initialQuantity ?? 0);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            if (editMode === 'SWAP' && pickingSai) {
                                                setLotSaiInput(cleanLot);
                                                setPickingSai(false);
                                            } else {
                                                setLotEntraInput(cleanLot);
                                            }
                                        }}
                                        className="p-2 rounded-lg border border-white/10 bg-slate-950 hover:border-amber-400 text-left transition active:scale-95 cursor-pointer flex flex-col min-w-0"
                                    >
                                        <span className="text-xs font-black font-mono text-white truncate">Lote {cleanLot}</span>
                                        <span className="text-[9px] font-mono text-slate-400 truncate">{item.bitola}mm • {weightKg > 0 ? `${weightKg.toFixed(0)}kg` : ''}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setEditingPos(null)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold text-center"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmEdit}
                            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer text-center"
                        >
                            ✓ Confirmar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CompletionModal: React.FC<{
    order: ProductionOrderData;
    onClose: () => void;
    onSubmit: (data: { actualProducedQuantity?: number; pontas?: Ponta[] }) => void;
}> = ({ order, onClose, onSubmit }) => {
    const [actualProducedQuantity, setActualProducedQuantity] = useState(order.actualProducedQuantity || 0);
    const [pontas, setPontas] = useState<{ quantity: number; size: number }[]>([]);

    const modelInfo = useMemo(() => trelicaModels.find(m => m.modelo === order.trelicaModel && m.tamanho === order.tamanho), [order]);

    const handleAddPonta = () => {
        setPontas(prev => [...prev, { quantity: 1, size: 0 }]);
    };

    const handleRemovePonta = (index: number) => {
        setPontas(prev => prev.filter((_, i) => i !== index));
    };

    const handlePontaChange = (index: number, field: 'quantity' | 'size', value: number) => {
        setPontas(prev => {
            const newPontas = [...prev];
            newPontas[index][field] = value;
            return newPontas;
        });
    };

    const calculatePontaWeight = (ponta: { quantity: number; size: number }) => {
        if (!modelInfo || !ponta.size || ponta.size <= 0) return 0;
        const weightPerMeter = parseFloat(modelInfo.pesoFinal.replace(',', '.')) / parseFloat(modelInfo.tamanho);
        return weightPerMeter * ponta.size * ponta.quantity;
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalPontas = pontas
            .filter(p => p.quantity > 0 && p.size > 0)
            .map(p => ({
                quantity: p.quantity,
                size: p.size,
                totalWeight: calculatePontaWeight(p),
            }));

        onSubmit({ actualProducedQuantity, pontas: finalPontas });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Finalizar Ordem de Produção</h2>
                <p className="text-slate-600 mb-6">Confirme os dados de produção para a ordem <strong>{order.orderNumber}</strong>.</p>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Quantidade Total de Peças (Tamanho Padrão)</label>
                        <input
                            type="number"
                            value={actualProducedQuantity}
                            onChange={e => setActualProducedQuantity(parseInt(e.target.value, 10) || 0)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            required
                        />
                    </div>
                    <div className="p-4 border rounded-lg bg-slate-50">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-slate-700">Registro de Pontas</h3>
                            <button type="button" onClick={handleAddPonta} className="bg-slate-600 text-white text-xs font-bold py-1 px-3 rounded hover:bg-slate-700">
                                + Adicionar Ponta
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Adicione aqui as peças que não atingiram o tamanho padrão ({order.tamanho}m).</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {pontas.map((ponta, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-white rounded border">
                                    <div className="col-span-4">
                                        <label className="text-xs">Quantidade</label>
                                        <input type="number" min="1" value={ponta.quantity} onChange={e => handlePontaChange(index, 'quantity', parseInt(e.target.value) || 1)} className="p-1 w-full border rounded" />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-xs">Tamanho (m)</label>
                                        <input type="number" step="0.01" value={ponta.size} onChange={e => handlePontaChange(index, 'size', parseFloat(e.target.value) || 0)} className="p-1 w-full border rounded" />
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <label className="text-xs block">Peso Calc. (kg)</label>
                                        <span className="font-bold text-slate-800">{calculatePontaWeight(ponta)?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button type="button" onClick={() => handleRemovePonta(index)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            ))}
                            {pontas.length === 0 && <p className="text-center text-sm text-slate-400 py-4">Nenhuma ponta registrada.</p>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition">Confirmar e Finalizar Ordem</button>
                </div>
            </form>
        </div>
    );
};
const MachineSpeedModal: React.FC<{
    initialSpeed?: number;
    onClose: () => void;
    onSubmit: (speed: number) => void;
}> = ({ initialSpeed, onClose, onSubmit }) => {
    const [speed, setSpeed] = useState<string>(initialSpeed ? initialSpeed.toString().replace('.', ',') : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const s = parseFloat(speed.replace(',', '.'));
        if (!isNaN(s) && s > 0) {
            onSubmit(s);
        } else {
            alert('Por favor, informe uma velocidade válida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in border border-slate-100 p-8">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <ChartBarIcon className="h-10 w-10 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Velocidade da Máquina</h2>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Informe a velocidade de produção (m/s)</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                        <input
                            type="text"
                            value={speed}
                            onChange={(e) => setSpeed(e.target.value)}
                            placeholder="Ex: 8,6"
                            className="w-full p-8 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] text-6xl text-center font-black text-indigo-600 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                            autoFocus
                            required
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-6 text-slate-300 font-bold text-xl uppercase pointer-events-none">m/s</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={onClose} className="h-16 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest">Cancelar</button>
                        <button type="submit" className="h-16 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-lg shadow-indigo-100">Iniciar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BitolaCheckModal: React.FC<{
    onClose: () => void;
}> = ({ onClose }) => {
    const [comprimento, setComprimento] = useState('');
    const [massa, setMassa] = useState('');

    const parseNum = (v: string) => {
        const n = parseFloat(v.replace(',', '.'));
        return isNaN(n) ? null : n;
    };

    const c = parseNum(comprimento);
    const m = parseNum(massa);
    const bitolaFinal = (m && c && c > 0) ? Math.sqrt(m / c) * 12.744 : null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in border border-slate-100">
                {/* Header */}
                <div className="bg-gradient-to-br from-amber-50 to-white p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <ScaleIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            Conferir Bitola
                        </h2>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Calculadora rápida</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90">
                        <XCircleIcon className="h-8 w-8" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comprimento</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={comprimento}
                                    onChange={(e) => setComprimento(e.target.value)}
                                    placeholder="199"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-2xl font-black text-slate-800 focus:border-amber-500 focus:bg-white transition-all outline-none"
                                    autoFocus
                                />
                                <span className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-300 text-xs font-bold">mm</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Massa</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={massa}
                                    onChange={(e) => setMassa(e.target.value)}
                                    placeholder="14,101"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-2xl font-black text-slate-800 focus:border-amber-500 focus:bg-white transition-all outline-none"
                                />
                                <span className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-300 text-xs font-bold">g</span>
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    <div className={`p-6 rounded-3xl border-4 transition-all duration-500 ${
                        bitolaFinal !== null
                            ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-100'
                            : 'bg-slate-50 border-slate-200'
                    }`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${bitolaFinal !== null ? 'text-amber-600' : 'text-slate-400'}`}>
                            ⚡ Bitola Final
                        </p>
                        <p className={`text-5xl font-black text-center transition-colors ${bitolaFinal !== null ? 'text-amber-800' : 'text-slate-300'}`}>
                            {bitolaFinal !== null ? bitolaFinal.toFixed(2) : '—'}
                            {bitolaFinal !== null && <span className="text-lg text-amber-500 ml-2">mm</span>}
                        </p>
                    </div>

                    {/* Formula hint */}
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Fórmula: √(massa ÷ comprimento) × 12,744
                    </p>
                </div>
            </div>
        </div>
    );
};

const QuantityPromptModal: React.FC<{
    onClose: () => void;
    onSubmit: (quantity: number, isDirectTotal?: boolean) => void;
    currentQuantity: number;
    machineName?: string;
    order?: ProductionOrderData | null;
    shiftStartQuantity?: number;
}> = ({ onClose, onSubmit, currentQuantity, machineName, order, shiftStartQuantity = 0 }) => {
    // Modo: 'shift' (peças deste turno) ou 'total' (contador total acumulado da máquina/OP)
    const [mode, setMode] = useState<'shift' | 'total'>('shift');
    
    // Valor inicial do turno (currentQuantity)
    const [shiftQty, setShiftQty] = useState(currentQuantity);
    
    // Valor inicial do total acumulado (order.actualProducedQuantity || 0)
    const totalOrderQty = Number(order?.actualProducedQuantity) || (shiftStartQuantity + currentQuantity);
    const [totalQty, setTotalQty] = useState(totalOrderQty);
    
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isTrelica = machineName?.startsWith('Treliça');

    // Cálculos dinâmicos baseados no modo selecionado
    const effectiveShiftQty = mode === 'shift' ? shiftQty : Math.max(0, totalQty - shiftStartQuantity);
    const effectiveTotalQty = mode === 'shift' ? (shiftStartQuantity + shiftQty) : totalQty;
    const pieceDelta = Math.max(0, effectiveShiftQty - currentQuantity);

    const trelicaUnitWeight = order?.totalWeight && order?.quantityToProduce 
        ? (order.totalWeight / order.quantityToProduce) 
        : (isTrelica ? 6.4 : 0);
    const estimatedWireKg = pieceDelta * trelicaUnitWeight;

    const isBelowMinimum = mode === 'shift' 
        ? shiftQty < currentQuantity 
        : totalQty < totalOrderQty;

    const handleShiftChange = (valStr: string) => {
        const val = parseInt(valStr, 10);
        if (isNaN(val)) {
            setShiftQty(0);
            setErrorMsg(`Informe a quantidade de peças.`);
            return;
        }
        setShiftQty(val);
        if (val < currentQuantity) {
            setErrorMsg(`⚠️ Atenção: Não é permitido informar menos que ${currentQuantity} peças (já confirmadas anteriormente neste turno).`);
        } else {
            setErrorMsg(null);
        }
    };

    const handleTotalChange = (valStr: string) => {
        const val = parseInt(valStr, 10);
        if (isNaN(val)) {
            setTotalQty(0);
            setErrorMsg(`Informe a contagem total.`);
            return;
        }
        setTotalQty(val);
        if (val < totalOrderQty) {
            setErrorMsg(`⚠️ A contagem total não pode ser menor que ${totalOrderQty} peças (valor já acumulado na ordem).`);
        } else {
            setErrorMsg(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isBelowMinimum) {
            setErrorMsg(`Erro: Quantidade informada inferior ao mínimo registrado.`);
            return;
        }
        if (mode === 'total') {
            onSubmit(totalQty, true);
        } else {
            onSubmit(shiftQty, false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <form onSubmit={handleSubmit} className="bg-[#0B1A24] border border-white/20 p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl">
                            📊
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Atualização de Produção</h2>
                            <p className="text-xs text-slate-400">
                                {isTrelica ? 'Ciclo inteligente a cada 5 min • Sincronia de Bobinas' : 'Atualização de Produção do Turno'}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {machineName || 'Máquina'}
                    </span>
                </div>

                {/* Seletor de Modo: Peças do Turno vs Contador Geral da Máquina */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
                    <button
                        type="button"
                        onClick={() => {
                            setMode('shift');
                            setErrorMsg(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            mode === 'shift'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>🕒</span>
                        <span>Peças Deste Turno</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode('total');
                            setErrorMsg(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            mode === 'total'
                                ? 'bg-cyan-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>📟</span>
                        <span>Contador Geral / Painel</span>
                    </button>
                </div>

                {/* Banner Informativo contextual */}
                <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
                    <ClockIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        {mode === 'shift' ? (
                            <>
                                <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                    <span>Início do seu turno:</span>
                                    <span className="font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 text-xs font-bold">
                                        {shiftStartQuantity} pçs
                                    </span>
                                    <span>• Confirmado neste turno:</span>
                                    <span className="font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-xs font-black">
                                        {currentQuantity} pçs
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-1">
                                    Digite apenas o que <strong>você produziu no seu turno</strong>. O sistema somará ao início da OP automaticamente.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                    <span>Contagem total atual da OP:</span>
                                    <span className="font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 text-xs font-bold">
                                        {totalOrderQty} pçs
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-1">
                                    Digite o <strong>número total exibido no visor/contador da máquina</strong> ou no pallet. O sistema creditará a diferença ao seu turno sem duplicar!
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Alerta de Erro se tentar digitar menos que o já registrado */}
                {isBelowMinimum && (
                    <div className="bg-rose-950/60 border border-rose-500/50 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-200 animate-pulse">
                        <span className="text-base">⛔</span>
                        <div>
                            <span className="font-black text-white">Quantidade Bloqueada!</span>
                            <p className="text-[11px] text-rose-300 mt-0.5">
                                {errorMsg || (mode === 'shift' 
                                    ? `A quantidade não pode ser menor que ${currentQuantity} peças (já confirmadas neste turno).`
                                    : `A contagem geral não pode ser menor que ${totalOrderQty} peças (já acumuladas na ordem).`
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {/* Campo Principal de Quantidade */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {mode === 'shift' ? 'Total Produzido no Seu Turno' : 'Contador Acumulado da Máquina / OP'}
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                            Mínimo: <strong className="text-white">{mode === 'shift' ? `${currentQuantity} pçs` : `${totalOrderQty} pçs`}</strong>
                        </span>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            min={mode === 'shift' ? currentQuantity : totalOrderQty}
                            value={mode === 'shift' ? (shiftQty === 0 && currentQuantity === 0 ? '' : shiftQty) : (totalQty === 0 ? '' : totalQty)}
                            onChange={e => mode === 'shift' ? handleShiftChange(e.target.value) : handleTotalChange(e.target.value)}
                            className={`w-full p-5 border-2 rounded-2xl text-5xl text-center font-black transition-all outline-none bg-black/40 text-white ${
                                isBelowMinimum
                                    ? 'border-rose-500 text-rose-300 focus:border-rose-400 ring-2 ring-rose-500/20'
                                    : mode === 'shift'
                                        ? 'border-emerald-500/50 focus:border-emerald-400 ring-2 ring-emerald-500/20'
                                        : 'border-cyan-500/50 focus:border-cyan-400 ring-2 ring-cyan-500/20'
                            }`}
                            required
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-5 text-slate-500 font-black text-lg uppercase pointer-events-none font-mono">
                            pçs
                        </div>
                    </div>
                </div>

                {/* Resumo do Impacto da Contagem */}
                <div className="bg-slate-900/90 border border-white/10 p-3 rounded-xl flex flex-col gap-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Creditado a este turno:</span>
                        <strong className="text-emerald-400 font-bold text-sm">
                            {effectiveShiftQty} pçs {pieceDelta > 0 && <span className="text-emerald-300 font-normal text-xs">(+{pieceDelta} novas)</span>}
                        </strong>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                        <span className="text-slate-400">Novo Total da Ordem:</span>
                        <strong className="text-cyan-400 font-bold text-sm">
                            {effectiveTotalQty} pçs
                        </strong>
                    </div>
                    {estimatedWireKg > 0 && (
                        <div className="flex items-center justify-between border-t border-white/5 pt-1.5 text-[11px] text-amber-300">
                            <span>⚡ Consumo de arame estimado:</span>
                            <strong className="font-bold">~{estimatedWireKg.toFixed(1)} kg</strong>
                        </div>
                    )}
                </div>

                {/* Rodapé com Ações */}
                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                    >
                        Adiar / Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isBelowMinimum}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>✓</span>
                        <span>Confirmar Produção</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

const ManagerOverrideModal: React.FC<{
    data: { actualWeight: number; lowerBound: number; upperBound: number; };
    onSuccess: () => void;
    onCancel: () => void;
    users: User[];
}> = ({ data, onSuccess, onCancel, users }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const isMasterPin = password === '32727854';
        const manager = users.find(u => (u.role === 'gestor' || u.role === 'admin') && u.password === password);
        if (isMasterPin || manager) {
            onSuccess();
        } else {
            setError('Senha do gestor incorreta ou inválida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
                <div className="text-center">
                    <WarningIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Alerta de Peso Incomum</h2>
                    <p className="text-slate-600 mb-6">
                        O peso inserido de <strong className="text-slate-800">{data.actualWeight?.toFixed(2) || '0.00'} kg</strong> está fora da tolerância de peso esperada (entre <strong className="text-slate-800">{data.lowerBound?.toFixed(2) || '0.00'} kg</strong> e <strong className="text-slate-800">{data.upperBound?.toFixed(2) || '0.00'} kg</strong>).
                    </p>
                    <p className="text-sm font-bold text-slate-700 mb-4">É necessária autorização de um gestor para prosseguir.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Senha do Gestor</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        required
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 transition">Autorizar e Confirmar</button>
                </div>
            </form>
        </div>
    );
};

const ManagerActionAuthorizationModal: React.FC<{
    actionDescription: string;
    onSuccess: () => void;
    onCancel: () => void;
    users: User[];
}> = ({ actionDescription, onSuccess, onCancel, users }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmed = (password || '').trim();
        const isMasterPin = trimmed === '32727854';
        const manager = users.find(u => (u.role === 'gestor' || u.role === 'admin') && String(u.password).trim() === trimmed);
        if (isMasterPin || manager) {
            onSuccess();
        } else {
            setError('Senha do gestor incorreta ou inválida.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
                <div className="text-center">
                    <WarningIcon className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Autorização Necessária</h2>
                    <p className="text-slate-600 mb-6">
                        {actionDescription}
                    </p>
                    <p className="text-sm font-bold text-slate-700 mb-4">É necessária autorização de um gestor para prosseguir.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Senha do Gestor</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        required
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-700 transition">Autorizar</button>
                </div>
            </form>
        </div>
    );
};

const LotSelectionModal: React.FC<{
    onClose: () => void;
    onSelect: (lotIds: string[]) => void;
    stock: StockItem[];
}> = ({ onClose, onSelect, stock }) => {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const availableStock = useMemo(() => {
        return stock.filter(item =>
            item.status === 'Disponível' &&
            item.remainingQuantity > 0 &&
            (search === '' ||
                item.internalLot.toLowerCase().includes(search.toLowerCase()) ||
                item.supplier.toLowerCase().includes(search.toLowerCase()) ||
                item.bitola.toLowerCase().includes(search.toLowerCase()))
        ).sort((a, b) => a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true }));
    }, [stock, search]);

    const toggleLot = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === availableStock.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(availableStock.map(l => l.id)));
        }
    };

    const totalSelectedWeight = useMemo(() => {
        return availableStock
            .filter(item => selectedIds.has(item.id))
            .reduce((sum, item) => sum + (Number(item.remainingQuantity || item.initialQuantity) || 0), 0);
    }, [availableStock, selectedIds]);

    const handleConfirm = () => {
        if (selectedIds.size === 0) return;
        onSelect(Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4 animate-fade-in">
            <div className="bg-[#0B1A24] border border-white/20 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-white">
                <div className="p-6 border-b border-white/10 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white">Acrescentar Lotes de Fio Máquina</h2>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                                    Gestor
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Selecione um ou mais lotes disponíveis em estoque para adicionar à ordem de produção.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer">
                            <XCircleIcon className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por número do lote, fornecedor ou bitola..."
                                className="w-full py-2.5 pl-10 pr-4 bg-slate-900/90 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none text-sm transition"
                                autoFocus
                            />
                            <ArchiveIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        </div>
                        {availableStock.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                            >
                                {selectedIds.size === availableStock.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {availableStock.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2.5">
                            {availableStock.map(lot => {
                                const isSelected = selectedIds.has(lot.id);
                                const lotWeight = Number(lot.remainingQuantity || lot.initialQuantity) || 0;
                                return (
                                    <div
                                        key={lot.id}
                                        onClick={() => toggleLot(lot.id)}
                                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-950/50 border-indigo-500/70 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                : 'bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900/80'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleLot(lot.id)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-5 h-5 rounded border-white/20 text-indigo-600 focus:ring-indigo-500 bg-black/40 cursor-pointer"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-white text-base">
                                                        {lot.internalLot}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                        {lot.bitola}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                                    <span>{lot.supplier}</span>
                                                    {lot.heatNumber && <span>• Corrida: {lot.heatNumber}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-black text-white text-base">
                                                {lotWeight.toLocaleString('pt-BR')} kg
                                            </p>
                                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                                Disponível
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <WarningIcon className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                            <p className="text-slate-400 font-bold text-sm">Nenhum lote de Fio Máquina disponível encontrado para esta bitola.</p>
                            <p className="text-xs text-slate-500 mt-1">Verifique o estoque de matéria-prima ou filtros de busca.</p>
                        </div>
                    )}
                </div>

                {/* Rodapé com Resumo de Seleção e Ação */}
                <div className="p-4 bg-slate-900/90 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-slate-400">Selecionados:</span>
                        <strong className="text-indigo-400 font-bold text-sm">
                            {selectedIds.size} {selectedIds.size === 1 ? 'lote' : 'lotes'}
                        </strong>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">Peso a somar:</span>
                        <strong className="text-emerald-400 font-bold text-sm">
                            +{totalSelectedWeight.toLocaleString('pt-BR')} kg
                        </strong>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-2.5 px-5 rounded-xl text-xs transition shadow-lg shadow-indigo-900/40 flex items-center gap-2 cursor-pointer"
                        >
                            <span>➕</span>
                            <span>Adicionar {selectedIds.size > 0 ? `(${selectedIds.size}) à Ordem` : 'à Ordem'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface MachineControlProps {
    machineType: MachineType;
    setPage: (page: Page) => void;
    stock: StockItem[];
    currentUser?: User | null;
    users?: User[];
    productionOrders?: ProductionOrderData[];
    shiftReports?: ShiftReport[];
    logPostProductionActivity?: (activity: string) => void;
    updateProducedQuantity?: (orderId: string, quantity: number) => void;
    startProductionOrder?: (orderId: string) => void;
    startOperatorShift?: (orderId: string, options?: { isOvertime?: boolean; managerAuthorized?: string; checkinOnly?: boolean; handoverFrom?: string; handoverReason?: string }) => void | Promise<void>;
    endOperatorShift?: (orderId: string, finalQuantity?: number, options?: { autoClosed?: boolean; observation?: string; isOvertime?: boolean; managerAuthorized?: string }) => void | Promise<void>;
    logDowntime?: (orderId: string, reason: string) => void;
    logResumeProduction?: (orderId: string) => void;
    startLotProcessing?: (orderId: string, lotId: string, speed: number) => void;
    finishLotProcessing?: (orderId: string, lotId: string) => void;
    recordLotWeight?: (orderId: string, lotId: string, finalWeight?: number | null, measuredGauge?: number) => void;
    recordPackageWeight?: (orderId: string, packageData: { packageNumber: number; quantity: number; weight: number; }) => void;
    completeProduction?: (orderId: string, finalData: { actualProducedQuantity?: number, pontas?: Ponta[] }) => void;
    addPartsRequest?: (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status' | 'machine' | 'productionOrderId'>) => void;
    deleteShiftReport?: (reportId: string) => void;
    cancelProductionOrder?: (orderId: string) => void;
    pauseProductionOrder?: (orderId: string, reason?: string) => void;
    resumeProductionOrder?: (orderId: string) => void;
    initialView?: View;
    initialModal?: 'reports' | 'parts' | 'rings' | null;
    gauges?: StockGauge[];
    addLotToOrder?: (orderId: string, lotId: string) => void;
    downtimeConfigs?: DowntimeConfig[];
    updateProductionOrder?: (orderId: string, updates: Partial<ProductionOrderData>) => void;
    onUpdateReport?: (reportId: string, updates: Partial<ShiftReport>) => Promise<void>;
    reviewAutoClosedShiftQuantity?: (orderId: string, adjustedQuantity: number, operatorJustification?: string) => void | Promise<void>;
    pcpShiftConfig?: PcpShiftConfig;
    holidays?: PcpHoliday[];
}

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

type View = 'dashboard' | 'in_progress' | 'pending' | 'completed';

const MachineMenuButton: React.FC<{ onClick: () => void; label: string; description: string, icon?: React.ReactNode, disabled?: boolean }> = ({ onClick, label, description, icon, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`bg-white p-6 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex items-start gap-4 border-l-4 ${disabled ? 'opacity-50 grayscale border-slate-300' : 'border-slate-800'}`}
    >
        <div className={`p-3 rounded-lg ${disabled ? 'bg-slate-100' : 'bg-slate-100'}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-xl font-bold text-slate-800">{label}</h3>
            <p className="text-slate-500 mt-1 text-sm leading-relaxed">{description}</p>
        </div>
    </button>
);

// Trefila Ring Stock Interface (Matches types.ts)
interface TrefilaRingStock {
    id: string;
    model: string;
    quantity: number;
}

// Helper functions for lot selection normalization
const normalizeStr = (str: string): string => {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const parseBitolaFloat = (val: string | number | undefined | null): number | null => {
    if (val === undefined || val === null) return null;
    const str = typeof val === 'number' ? val.toString() : String(val);
    const cleaned = str.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
};

const MachineControl: React.FC<MachineControlProps> = ({
    machineType, setPage, currentUser, users = [], stock, productionOrders = [],
    shiftReports = [], startProductionOrder, startOperatorShift, endOperatorShift,
    logDowntime, logResumeProduction, startLotProcessing, finishLotProcessing,
    recordLotWeight, recordPackageWeight, completeProduction, addPartsRequest,
    logPostProductionActivity, updateProducedQuantity, deleteShiftReport,
    cancelProductionOrder, pauseProductionOrder, resumeProductionOrder, addLotToOrder, initialView, initialModal, gauges = [],
    downtimeConfigs = [], updateProductionOrder, onUpdateReport, reviewAutoClosedShiftQuantity, pcpShiftConfig, holidays = []
}) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username?.toLowerCase() === 'admin' || currentUser?.username?.toLowerCase() === 'gestor' || currentUser?.username?.toLowerCase().includes('matheusmiranda');
    const [activeMachine, setActiveMachine] = useState<MachineType>(() => {
        const saved = localStorage.getItem('msm_active_machine');
        const safeMachineType = machineType || 'Trefila';
        
        if (saved && (
            (typeof safeMachineType === 'string' && saved.startsWith(safeMachineType)) || 
            (safeMachineType === 'Trefila' && saved.startsWith('Trefila')) || 
            (safeMachineType === 'Treliça' && saved.startsWith('Treliça'))
        )) {
            return saved as MachineType;
        }

        return (safeMachineType === 'Trefila' ? 'Trefila 1' : safeMachineType === 'Treliça' ? 'Treliça 1' : safeMachineType) as MachineType;
    });

    // Reset active machine when the main machine category (trefila/trelica) changes from props
    useEffect(() => {
        const saved = localStorage.getItem('msm_active_machine');
        const safeType = machineType || '';
        
        if (saved && (
            (safeType && saved.startsWith(safeType)) || 
            (safeType === 'Trefila' && saved.startsWith('Trefila')) || 
            (safeType === 'Treliça' && saved.startsWith('Treliça'))
        )) {
            setActiveMachine(saved as MachineType);
            return;
        }

        setActiveMachine(safeType === 'Trefila' ? 'Trefila 1' : safeType === 'Treliça' ? 'Treliça 1' : (safeType as MachineType || 'Trefila 1'));
    }, [machineType, currentUser?.username]);

    useEffect(() => {
        if (!isGestor && currentUser?.employeeId) {
            fetchByColumn<Employee>('employees', 'id', currentUser.employeeId)
                .then(emps => {
                    if (emps && emps.length > 0 && emps[0].assignedMachine) {
                        const machine = emps[0].assignedMachine as MachineType;
                        const safeType = machineType || '';
                        if (
                            (safeType && machine.startsWith(safeType)) ||
                            (safeType === 'Trefila' && machine.startsWith('Trefila')) ||
                            (safeType === 'Treliça' && machine.startsWith('Treliça'))
                        ) {
                            setActiveMachine(machine);
                            localStorage.setItem('msm_active_machine', machine);
                        }
                    }
                })
                .catch(err => console.error("Error fetching employee assigned machine in MachineControl:", err));
        }
    }, [currentUser, machineType, isGestor]);
    const [pendingWeights, setPendingWeights] = useState<Map<string, string>>(new Map());
    const [pendingGauges, setPendingGauges] = useState<Map<string, string>>(new Map()); // Novo estado para bitolas
    const [pendingPackageWeights, setPendingPackageWeights] = useState<Map<number, string>>(new Map());
    const [justCompletedOrderId, setJustCompletedOrderId] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<'monitor' | 'work' | 'process' | 'weigh' | 'performance'>((activeMachine && typeof activeMachine === 'string' && activeMachine.startsWith('Treliça')) ? 'work' : 'monitor');
    const [managerOverrideData, setManagerOverrideData] = useState<{
        packageNumber: number;
        quantity: number;
        weight: number;
        lowerBound: number;
        upperBound: number;
    } | null>(null);
    const [downtimeJustification, setDowntimeJustification] = useState('');

    // Persistent drift to align local clock with server timestamps, persisted in localStorage
    const driftKey = `stableDrift_${machineType}`;
    const [stableDrift, setStableDrift] = useState(() => {
        const saved = localStorage.getItem(driftKey);
        return saved ? parseInt(saved, 10) : 0;
    });

    const [timer, setTimer] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTimer(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const now = useMemo(() => new Date(timer.getTime() + stableDrift), [timer, stableDrift]);

    // OS Tracking state (declaration only, useEffect will be after activeOrder)
    const [osElapsed, setOsElapsed] = useState(0);
    const [osSearchTerm, setOsSearchTerm] = useState('');

    const [editingLotId, setEditingLotId] = useState<string | null>(null);

    // Estados para Passagem de Posto / Assumir Máquina (Adrian -> Gustavo)
    const [selectedHandoverReason, setSelectedHandoverReason] = useState<string>('Almoço / Intervalo');
    const [customHandoverReason, setCustomHandoverReason] = useState<string>('');
    const [isHandoverSubmitting, setIsHandoverSubmitting] = useState<boolean>(false);

    // Estados para Retificação / Confirmação de Quantidade pós Auto-Encerramento
    const [showAutoCloseReviewModal, setShowAutoCloseReviewModal] = useState<boolean>(false);
    const [autoCloseReviewQty, setAutoCloseReviewQty] = useState<number>(0);
    const [autoCloseReviewNote, setAutoCloseReviewNote] = useState<string>('');
    const [isSubmittingAutoCloseReview, setIsSubmittingAutoCloseReview] = useState<boolean>(false);

    const handlePendingWeightChange = (lotId: string, value: string) => {
        setPendingWeights(prev => new Map(prev).set(lotId, value));
    };

    const handlePendingGaugeChange = (lotId: string, value: string) => {
        setPendingGauges(prev => new Map(prev).set(lotId, value));
    };

    const handlePendingPackageWeightChange = (packageNumber: number, value: string) => {
        setPendingPackageWeights(prev => new Map(prev).set(packageNumber, value));
    };

    const handleRecordWeight = (lotId: string) => {
        if (!activeOrder || !recordLotWeight) return;

        const lot = (activeOrder.processedLots || []).find((p: any) => (p.lotId === lotId || p.lot_id === lotId));
        if (!lot) return;

        const weightStr = pendingWeights.get(lotId);
        const gaugeStr = pendingGauges.get(lotId);

        const parsedWeight = weightStr ? parseFloat(weightStr.toString().replace(',', '.')) : undefined;

        let parsedGauge: number | undefined = undefined;
        if (gaugeStr && gaugeStr.toString().trim() !== '') {
            const clean = gaugeStr.toString().trim().replace(',', '.').replace(/[^\d.]/g, '');
            const val = parseFloat(clean);
            if (!isNaN(val) && val > 0) {
                parsedGauge = val;
            }
        }

        // Se o operador não digitou a bitola ou digitou 3 puro mas a OP tem targetBitola decimal (ex: 3.40), usar targetBitola
        const targetGaugeNum = activeOrder.targetBitola ? parseFloat(activeOrder.targetBitola.replace(',', '.')) : 0;
        if (parsedGauge === undefined && targetGaugeNum > 0) {
            parsedGauge = targetGaugeNum;
        } else if (parsedGauge === 3 && targetGaugeNum > 3.10 && targetGaugeNum < 3.90) {
            parsedGauge = targetGaugeNum;
        }

        const finalWeight = (parsedWeight !== undefined && !isNaN(parsedWeight)) ? parsedWeight : undefined;
        const measuredGauge = (parsedGauge !== undefined && !isNaN(parsedGauge)) ? parsedGauge : undefined;

        if (finalWeight !== undefined || measuredGauge !== undefined) {
            recordLotWeight(activeOrder.id, lotId, finalWeight, measuredGauge);

            if (finalWeight !== undefined) {
                setPendingWeights(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
            if (measuredGauge !== undefined) {
                setPendingGauges(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(lotId);
                    return newMap;
                });
            }
            setEditingLotId(null);
        }
    };

    const handleStartEditLot = (lot: any) => {
        const id = lot.lotId || lot.lot_id;
        if (!id) return;
        setEditingLotId(id);
        const w = lot.finalWeight ?? lot.final_weight;
        const g = lot.measuredGauge ?? lot.measured_gauge;
        if (w !== null && w !== undefined) {
            setPendingWeights(prev => new Map(prev).set(id, String(w)));
        }
        if (g !== null && g !== undefined) {
            setPendingGauges(prev => new Map(prev).set(id, Number(g).toFixed(2)));
        } else if (activeOrder?.targetBitola) {
            setPendingGauges(prev => new Map(prev).set(id, activeOrder.targetBitola));
        }
    };

    const handleCancelEditLot = (lotId: string) => {
        setEditingLotId(null);
        setPendingWeights(prev => {
            const newMap = new Map(prev);
            newMap.delete(lotId);
            return newMap;
        });
        setPendingGauges(prev => {
            const newMap = new Map(prev);
            newMap.delete(lotId);
            return newMap;
        });
    };

    const [showResumePreviousStopModal, setShowResumePreviousStopModal] = useState(false);
    const [showSpeedModal, setShowSpeedModal] = useState(false);
    const [selectedLotForSpeed, setSelectedLotForSpeed] = useState<string | null>(null);
    const [previousStopReason, setPreviousStopReason] = useState<string | null>(null);
    const [showManagerAuthForOvertimeStart, setShowManagerAuthForOvertimeStart] = useState(false);
    const [pendingResumeAfterAuth, setPendingResumeAfterAuth] = useState(false);
    const [pendingStartOrderId, setPendingStartOrderId] = useState<string | null>(null);
    const [showManagerAuthForOvertimeExtend, setShowManagerAuthForOvertimeExtend] = useState(false);
    const [showManagerAuthForAddLots, setShowManagerAuthForAddLots] = useState(false);
    const [authorizedOvertimeForCurrentShift, setAuthorizedOvertimeForCurrentShift] = useState(false);
    const [showAutoEndCountdownModal, setShowAutoEndCountdownModal] = useState(false);
    const [pendingStartIsOvertime, setPendingStartIsOvertime] = useState(false);
    const [pendingStartManager, setPendingStartManager] = useState<string | undefined>(undefined);
    const [trelicaValidationBlock, setTrelicaValidationBlock] = useState<TrelicaElectrodesValidation | null>(null);
    const [showTrelicaBlockModal, setShowTrelicaBlockModal] = useState<boolean>(false);
    const autoEndShiftTriggeredRef = useRef<string | null>(null);

    const handleOpenAddLots = () => {
        if (isGestor) {
            setShowLotSelectionModal(true);
        } else {
            setShowManagerAuthForAddLots(true);
        }
    };

    const shiftEvaluation = useMemo(() => {
        return checkMachineShiftStatus(activeMachine, pcpShiftConfig, now, holidays);
    }, [activeMachine, pcpShiftConfig, now, holidays]);

    const shiftStatus = useMemo(() => {
        return {
            isOvertime: shiftEvaluation.isOvertime && !authorizedOvertimeForCurrentShift,
            progress: shiftEvaluation.progressPercent,
            timeStatusText: shiftEvaluation.statusText,
            shiftName: shiftEvaluation.shiftName,
            shiftLabel: shiftEvaluation.shiftLabel,
            inShiftWindow: shiftEvaluation.inShiftWindow,
            isAutoEndCountdown: shiftEvaluation.isAutoEndCountdown,
            remainingCountdownSeconds: shiftEvaluation.remainingCountdownSeconds,
            autoStartShift: shiftEvaluation.autoStartShift,
            autoEndShift: shiftEvaluation.autoEndShift,
            requireManagerAuthForOvertime: shiftEvaluation.requireManagerAuthForOvertime,
            workStart: shiftEvaluation.workStart,
            workEnd: shiftEvaluation.workEnd,
        };
    }, [shiftEvaluation, authorizedOvertimeForCurrentShift]);

    const handleStartShift = (
        forceOvertime: boolean | any = false, 
        managerAuthUser?: string,
        handoverOptions?: { fromOperator: string; reason: string }
    ) => {
        if (!activeOrder || !startOperatorShift) return;

        // Validação Obrigatória de Controladoria: Eletrodos com lotes cadastrados na Treliça
        if (activeMachine.startsWith('Treliça')) {
            const val = validateTrelicaElectrodesConfigured(activeMachine);
            if (!val.isValid) {
                setTrelicaValidationBlock(val);
                setShowTrelicaBlockModal(true);
                return;
            }
        }

        // Garantir checagem estrita de booleano: cliques de evento nunca devem ser interpretados como autorização prévia
        const isForceOvertime = forceOvertime === true;

        // Se fora do horário programado e não for gestor nem explicitamente autorizado via modal de senha, exigir senha de gestor
        if (!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !isForceOvertime) {
            setShowManagerAuthForOvertimeStart(true);
            return;
        }

        const isOt = isForceOvertime || !shiftEvaluation.inShiftWindow;
        const mgrAuth = managerAuthUser || (isOt ? (isGestor ? currentUser?.username : (isForceOvertime ? 'gestor' : undefined)) : undefined);

        // Check for ANY active downtime event from previous shift (not just the last array element)
        const openEvent = (activeOrder.downtimeEvents || []).find(e =>
            !e.resumeTime && e.reason !== 'Final de Turno' && e.reason !== 'Aguardando Início da Produção' && e.reason?.toLowerCase() !== 'aguardando início de lote'
        );

        if (openEvent) {
            setPreviousStopReason(openEvent.reason);
            setPendingStartIsOvertime(isOt);
            setPendingStartManager(mgrAuth);
            setShowResumePreviousStopModal(true);
        } else {
            // Normal start — all events are administrative, just begin
            autoEndShiftTriggeredRef.current = null;
            startOperatorShift(activeOrder.id, { 
                isOvertime: isOt, 
                managerAuthorized: mgrAuth,
                handoverFrom: handoverOptions?.fromOperator,
                handoverReason: handoverOptions?.reason
            });
        }
    };

    const getFactoryDateString = (dateObj: Date | string): string => {
        try {
            const factoryDate = new Date(dateObj);
            if (isNaN(factoryDate.getTime())) return '';
            if (factoryDate.getHours() < 5) {
                factoryDate.setDate(factoryDate.getDate() - 1);
            }
            return factoryDate.toLocaleDateString('sv-SE');
        } catch {
            return '';
        }
    };

    const shiftProducedTotal = useMemo(() => {
        const todayStr = getFactoryDateString(now);
        const currentHour = now.getHours();
        const isSingleShift = shiftEvaluation.shiftName.includes('Único') || !shiftEvaluation.shiftName.includes('Turno B');
        const currentShift = isSingleShift ? 'A' : ((currentHour >= 5 && currentHour < 14) ? 'A' : 'B');

        let totalPoints = 0;
        (productionOrders || []).forEach(order => {
            if (order.status === 'cancelled') return;
            if (order.machine !== activeMachine) return;
            
            (order.operatorLogs || []).forEach(log => {
                if (!log.startTime) return;
                const logDateStr = getFactoryDateString(log.startTime);
                if (logDateStr !== todayStr) return;

                const startH = new Date(log.startTime).getHours();
                const logShift = isSingleShift ? 'A' : ((startH >= 5 && startH < 14) ? 'A' : 'B');
                if (logShift === currentShift) {
                    if (activeMachine.startsWith('Treliça')) {
                        const startQty = log.startQuantity || 0;
                        const endQty = log.endTime ? (log.endQuantity || 0) : (order.actualProducedQuantity || 0);
                        totalPoints += Math.max(0, endQty - startQty);
                    } else {
                        // For Trefila, we sum the count of lots finished in this shift
                        (order.processedLots || []).forEach(lot => {
                            if (lot.endTime) {
                                const lotDateStr = getFactoryDateString(lot.endTime);
                                if (lotDateStr === todayStr) {
                                    const endH = new Date(lot.endTime).getHours();
                                    const lotLS = isSingleShift ? 'A' : ((endH >= 5 && endH < 14) ? 'A' : 'B');
                                    if (lotLS === currentShift) {
                                        totalPoints += 1;
                                    }
                                }
                            }
                        });
                    }
                }
            });
        });
        return totalPoints;
    }, [productionOrders, activeMachine, now, shiftEvaluation.shiftName]);

    const confirmResumePreviousStop = async (shouldResume: boolean) => {
        if (!activeOrder || !startOperatorShift) return;

        // Start the shift first
        await startOperatorShift(activeOrder.id, { isOvertime: pendingStartIsOvertime, managerAuthorized: pendingStartManager });

        // If user wants to resume production immediately
        if (shouldResume && logResumeProduction) {
            // Give a small delay to ensuring shift start processed (optional but safer if async race)
            setTimeout(() => logResumeProduction(activeOrder.id), 500);
        }

        setShowResumePreviousStopModal(false);
        setPreviousStopReason(null);
        setPendingStartIsOvertime(false);
        setPendingStartManager(undefined);
    };

    const executeRecordPackageWeight = (pkgData: { packageNumber: number; quantity: number; weight: number; }) => {

        if (activeOrder && recordPackageWeight) {
            recordPackageWeight(activeOrder.id, { packageNumber: pkgData.packageNumber, quantity: pkgData.quantity, weight: pkgData.weight });
            setPendingPackageWeights(prev => {
                const newMap = new Map(prev);
                newMap.delete(pkgData.packageNumber);
                return newMap;
            });

            // Acumula desgaste/metros nos 7 eletrodos de solda da Treliça
            if (activeMachine.startsWith('Treliça')) {
                try {
                    const pieceLength = parseFloat(String(activeOrder.tamanho || '6').replace(',', '.')) || 6;
                    const packageMeters = pkgData.quantity * pieceLength;
                    const currentEls = getLocalMachineElectrodes(activeMachine);
                    const updatedEls = currentEls.map(el => {
                        const newMeters = (el.meters_produced || 0) + packageMeters;
                        const newPieces = (el.pieces_produced || 0) + pkgData.quantity;
                        const isCrit = newMeters >= (el.benchmark_meters || 15000) * 0.9;
                        const isWarn = newMeters >= (el.benchmark_meters || 15000) * 0.7;
                        return {
                            ...el,
                            meters_produced: newMeters,
                            pieces_produced: newPieces,
                            status: isCrit ? ('critical' as const) : isWarn ? ('warning' as const) : ('active' as const)
                        };
                    });
                    saveLocalMachineElectrodes(activeMachine, updatedEls);
                } catch (err) {
                    console.warn('Erro ao acumular metros nos eletrodos:', err);
                }
            }
        }
    };


    const handleRecordPackageWeight = (packageNumber: number, quantity: number) => {
        const weightStr = pendingPackageWeights.get(packageNumber);
        if (!weightStr) return;

        const weight = parseFloat(weightStr);
        if (!activeOrder || isNaN(weight) || weight <= 0) return;

        const modelInfo = trelicaModels.find(m => m.modelo === activeOrder.trelicaModel && m.tamanho === activeOrder.tamanho);

        if (!modelInfo) {
            executeRecordPackageWeight({ packageNumber, quantity, weight });
            return;
        }

        const theoreticalWeightPerPiece = parseFloat(modelInfo.pesoFinal.replace(',', '.'));
        const expectedWeight = theoreticalWeightPerPiece * quantity;
        const TOLERANCE = 0.01; // 1%
        const lowerBound = expectedWeight * (1 - TOLERANCE);
        const upperBound = expectedWeight * (1 + TOLERANCE);

        if (weight < lowerBound || weight > upperBound) {
            setManagerOverrideData({ packageNumber, quantity, weight, lowerBound, upperBound });
        } else {
            executeRecordPackageWeight({ packageNumber, quantity, weight });
        }
    };


    const [view, setView] = useState<View>(initialView || 'dashboard');
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    const [showCancelManagerAuth, setShowCancelManagerAuth] = useState(false);
    const [showDowntimeModal, setShowDowntimeModal] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showQuantityPrompt, setShowQuantityPrompt] = useState(false);
    const [ringStock, setRingStock] = useState<TrefilaRingStock[]>([]);
    const [pendingShiftEnd, setPendingShiftEnd] = useState<string | null>(null);

    useEffect(() => {
        if (activeMachine.startsWith('Trefila')) {
            const loadRingStock = async () => {
                try {
                    const data = await fetchTable<TrefilaRingStock>('trefila_rings_stock');
                    setRingStock(data || []);
                } catch (e) {
                    console.error('Error loading ring stock', e);
                }
            };
            loadRingStock();
        }
    }, [machineType]);
    const [showPartsRequestModal, setShowPartsRequestModal] = useState(initialModal === 'parts');
    const [showShiftReportsModal, setShowShiftReportsModal] = useState(initialModal === 'reports');
    const [showTrefilaCalculation, setShowTrefilaCalculation] = useState(initialModal === 'rings');
    const [lastShiftEndPromptDate, setLastShiftEndPromptDate] = useState<string | null>(null);
    const [showManagerAuthForShiftEnd, setShowManagerAuthForShiftEnd] = useState(false);
    const [lastPromptShownAt, setLastPromptShownAt] = useState<number>(0);
    const [showLotSelectionModal, setShowLotSelectionModal] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const [showBitolaCheck, setShowBitolaCheck] = useState(initialModal === 'bitolaCheck');

    const hasPermission = (targetPage: Page): boolean => {
        if (!currentUser) return false;
        // Super-admin and gestores always have access to everything by default
        if (currentUser.username === 'admin' || currentUser.role === 'admin' || currentUser.role === 'gestor') return true;

        // Dynamic check based on current machine if needed, 
        // but here we check the specific page passed
        return !!currentUser.permissions?.[targetPage];
    };

    const machinePrefix = (activeMachine && typeof activeMachine === 'string') 
        ? (activeMachine.startsWith('Trefila') 
            ? 'trefila' 
            : activeMachine.startsWith('Desbobinadeira') 
                ? 'desbobinadeira' 
                : 'trelica')
        : 'trelica';

    const getPermissionPage = (suffix: 'InProgress' | 'Pending' | 'Completed' | 'Reports'): Page => {
        if (activeMachine && typeof activeMachine === 'string') {
            if (activeMachine.startsWith('Trefila')) return `trefila${suffix}` as Page;
            if (activeMachine.startsWith('Desbobinadeira')) return `desbobinadeira${suffix}` as Page;
        }
        return `trelica${suffix}` as Page;
    };

    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);

    const activeOrder = useMemo(() => {
        const active = productionOrders.filter(o => {
            const isExact = o.machine === activeMachine;
            const isLegacyTrefilaTo1 = (o.machine === 'Trefila' && activeMachine === 'Trefila 1');
            const isLegacyTrelicaTo1 = (o.machine === 'Treliça' && activeMachine === 'Treliça 1');
            const isLegacyMalhaTo1 = (o.machine === 'Malha' && activeMachine === 'Malha 1');
            return (isExact || isLegacyTrefilaTo1 || isLegacyTrelicaTo1 || isLegacyMalhaTo1) && o.status === 'in_progress';
        });
        if (active.length === 0) return undefined;
        return active.sort((a, b) => {
            const timeA = new Date(a.startTime || 0).getTime();
            const timeB = new Date(b.startTime || 0).getTime();
            if (timeA !== timeB) {
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            }
            const cA = new Date(a.creationDate || 0).getTime();
            const cB = new Date(b.creationDate || 0).getTime();
            if (cA !== cB) {
                return (isNaN(cB) ? 0 : cB) - (isNaN(cA) ? 0 : cA);
            }
            return a.id.localeCompare(b.id);
        })[0];
    }, [productionOrders, activeMachine]);

    // Update OS elapsed time every second when an OS is active
    useEffect(() => {
        if (!activeOrder || !activeMachine.startsWith('Desbobinadeira')) {
            setOsElapsed(0);
            return;
        }
        const osProgress = (activeOrder as any).osProgress;
        if (osProgress?.currentOs && osProgress?.startTime) {
            const start = new Date(osProgress.startTime).getTime();
            setOsElapsed(Math.floor((timer.getTime() - start) / 1000));
        } else {
            setOsElapsed(0);
        }
    }, [timer, activeOrder, activeMachine]);

    const pendingOrders = useMemo(() => productionOrders.filter(o => (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && (o.status === 'pending' || o.status === 'paused')).sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime()), [productionOrders, activeMachine]);
    const completedOrders = useMemo(() => productionOrders.filter(o => (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && o.status === 'completed').sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime()), [productionOrders, activeMachine]);

    useEffect(() => {
        if (!activeOrder) return;

        const timestamps = [
            activeOrder.startTime,
            activeOrder.lastQuantityUpdate,
            ...(activeOrder.downtimeEvents || []).map(e => e.stopTime),
            ...(activeOrder.downtimeEvents || []).map(e => e.resumeTime)
        ].filter(Boolean) as string[];

        setStableDrift(currentDrift => {
            let maxDrift = currentDrift;
            const nowMs = Date.now();

            timestamps.forEach(ts => {
                const eventMs = new Date(ts).getTime();
                const drift = eventMs - nowMs;
                if (drift > maxDrift) {
                    maxDrift = drift;
                }
            });

            if (maxDrift !== currentDrift) {
                localStorage.setItem(driftKey, maxDrift.toString());
            }
            return maxDrift;
        });
    }, [activeOrder, driftKey]);

    const postProductionOrder = useMemo(() => {
        if (activeOrder || !currentUser) return null;

        const completed = productionOrders
            .filter(o => o.status === 'completed' && (o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça')) && o.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        for (const order of completed) {
            const hasOpenLog = (order.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime);
            if (hasOpenLog) {
                return order;
            }
        }
        return null;
    }, [productionOrders, activeOrder, currentUser, activeMachine]);

    const orderForShift = activeOrder || postProductionOrder;

    // FIX: Moved currentOperatorLog and hasActiveShift before their usage in useEffect.
    const currentOperatorLog = useMemo(() => {
        if (!orderForShift || !orderForShift.operatorLogs || orderForShift.operatorLogs.length === 0) return null;

        // 1. First priority: Check if current user has an open log
        const myOpenLog = orderForShift.operatorLogs.find(l => 
            currentUser?.username && l.operator.toLowerCase() === currentUser.username.toLowerCase() && !l.endTime
        );
        if (myOpenLog) return myOpenLog;

        // 2. Second priority: Check the absolute latest overall log
        const sorted = [...orderForShift.operatorLogs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const lastOverallLog = sorted[sorted.length - 1];

        // Return the latest log regardless of user (hasActiveShift will handle the current user check)
        return lastOverallLog;
    }, [orderForShift, currentUser]);


    const hasActiveShift = useMemo(() => {
        return currentOperatorLog && currentUser?.username && currentOperatorLog.operator.toLowerCase() === currentUser.username.toLowerCase() && !currentOperatorLog.endTime;
    }, [currentOperatorLog, currentUser]);


    const isAnyActiveShift = useMemo(() => {
        return !!currentOperatorLog && !currentOperatorLog.endTime;
    }, [currentOperatorLog]);

    // Sincronizar estado de hora extra/autorização APENAS se houver turno ABERTO com autorização explícita do gestor
    useEffect(() => {
        const isOpenLog = Boolean(currentOperatorLog && !currentOperatorLog.endTime);
        const hasManagerAuth = Boolean(
            isOpenLog && (
                currentOperatorLog?.managerAuthorized ||
                (currentOperatorLog as any)?.manager_authorized
            )
        );
        if (isOpenLog && hasManagerAuth) {
            if (!authorizedOvertimeForCurrentShift) {
                setAuthorizedOvertimeForCurrentShift(true);
            }
        } else if (!isOpenLog) {
            // Se NÃO há turno aberto no momento, limpa autorização para que o próximo início exija a senha do gestor
            if (authorizedOvertimeForCurrentShift) {
                setAuthorizedOvertimeForCurrentShift(false);
            }
        }
    }, [currentOperatorLog, authorizedOvertimeForCurrentShift]);

    const currentMachineStatus = useMemo(() => {
        if (!isAnyActiveShift) {
            return 'Desligada';
        }

        const events = activeOrder?.downtimeEvents || [];
        // CRITICAL: Always pick the LATEST open event
        const openEvent = [...events].reverse().find(e => !e.resumeTime);

        if (!openEvent) {
            return 'Produzindo';
        }

        const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
        const normReason = normalize(openEvent.reason);

        const prepReasons = ['Aguardando Início da Produção', 'Aguardando Início de Lote', 'Troca de Rolo / Preparação', 'Setup', 'Setup de Medida', 'Preparação', 'Setup + Preparação'];
        if (prepReasons.some(r => normReason === normalize(r) || normReason.startsWith(normalize(r)) || normReason.includes(normalize(r)))) {
            return 'Preparacao';
        }

        if (normReason === normalize('Final de Turno') || normReason.includes('turno')) {
            // Se há turno ativo agora, um evento residual de 'Final de Turno' não desliga nem pausa a máquina
            return 'Produzindo';
        }

        return 'Parada';
    }, [activeOrder, isAnyActiveShift]);

    const activeLotProcessingData = useMemo(() => {
        if (activeOrder?.activeLotProcessing?.lotId) {
            const lotInfo = stock.find(s => s.id === activeOrder.activeLotProcessing!.lotId);

            let estimatedTimeSeconds = null;
            let isDelayed = false;
            let elapsedUptimeSeconds = 0;
            let isPaused = false;
            let pauseReason = '';

            if (activeOrder?.activeLotProcessing?.speed && activeOrder?.targetBitola) {
                const lotStartTime = new Date(activeOrder.activeLotProcessing.startTime).getTime();
                const bitola = activeOrder.targetBitola ? parseFloat(activeOrder.targetBitola.replace(',', '.')) : 1;
                const speed = activeOrder.activeLotProcessing.speed || 0; // m/s
                const linearMass = bitola * bitola * 0.006162; // kg/m
                const massPerSecond = speed * linearMass; // kg/s
                
                if (massPerSecond > 0 && !isNaN(lotStartTime)) {
                    const initialWeight = lotInfo?.initialQuantity || activeOrder.totalWeight || 0;
                    const totalDurationSeconds = initialWeight > 0 ? (initialWeight / massPerSecond) : 0;

                    const openEvent = [...(activeOrder?.downtimeEvents || [])].reverse().find(e => 
                        !e.resumeTime && (isAnyActiveShift ? (e.reason !== 'Final de Turno' && !e.reason?.toLowerCase().includes('turno')) : true)
                    );
                    const isMachineCurrentlyPaused = Boolean(
                        openEvent || 
                        currentMachineStatus !== 'Produzindo' || 
                        !isAnyActiveShift
                    );

                    isPaused = isMachineCurrentlyPaused;
                    pauseReason = openEvent?.reason || (currentMachineStatus !== 'Produzindo' ? currentMachineStatus : '');

                    // Calculate downtime specifically for this lot
                    let lotDowntimeMs = 0;
                    (activeOrder?.downtimeEvents || []).forEach(e => {
                        if (!e || !e.stopTime) return;
                        const stop = new Date(e.stopTime).getTime();
                        if (isNaN(stop)) return;
                        const resume = e.resumeTime ? new Date(e.resumeTime).getTime() : now.getTime();
                        if (isNaN(resume)) return;

                        const startInLot = Math.max(stop, lotStartTime);
                        const endInLot = Math.min(resume, now.getTime());
                        if (endInLot > startInLot) {
                            lotDowntimeMs += (endInLot - startInLot);
                        }
                    });

                    // Se estiver pausada agora sem parada aberta em downtimeEvents (ex: fim de turno)
                    if (isMachineCurrentlyPaused && !openEvent) {
                        const closedLogs = (activeOrder?.operatorLogs || []).filter((l: any) => l.endTime);
                        const lastLogEnd = closedLogs.length > 0 
                            ? Math.max(...closedLogs.map((l: any) => new Date(l.endTime).getTime()).filter((t: number) => !isNaN(t)))
                            : 0;
                        const pauseStart = lastLogEnd > lotStartTime ? lastLogEnd : lotStartTime;
                        const extraPauseMs = Math.max(0, now.getTime() - pauseStart);
                        if (extraPauseMs > 0 && lotDowntimeMs < extraPauseMs) {
                            lotDowntimeMs = Math.max(lotDowntimeMs, extraPauseMs);
                        }
                    }

                    const totalElapsedMs = Math.max(0, now.getTime() - lotStartTime);
                    const elapsedUptimeMs = Math.max(0, totalElapsedMs - lotDowntimeMs);
                    elapsedUptimeSeconds = elapsedUptimeMs / 1000;

                    const remainingSecondsRaw = totalDurationSeconds - elapsedUptimeSeconds;
                    estimatedTimeSeconds = Math.max(0, remainingSecondsRaw);
                    isDelayed = totalDurationSeconds > 0 && elapsedUptimeSeconds > totalDurationSeconds;
                }
            }

            return { 
                ...activeOrder.activeLotProcessing, 
                lotInfo: lotInfo || { internalLot: activeOrder.activeLotProcessing.lotId, initialQuantity: 0 },
                estimatedTimeSeconds,
                isDelayed,
                isPaused,
                pauseReason,
                elapsedUptimeSeconds
            };
        }
        return null;
    }, [activeOrder, stock, now, currentMachineStatus, isAnyActiveShift]);

    // Derived state for pulsing effects (must come AFTER currentMachineStatus declaration)
    const isActiveProcess = currentMachineStatus === 'Produzindo' && ((activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) ? !!activeLotProcessingData : true);
    const isUnderStopAlerta = currentMachineStatus === 'Parada' || currentMachineStatus === 'Preparacao';

    const isMachineStopped = currentMachineStatus === 'Parada' || currentMachineStatus === 'Preparacao';
    const isEmergencyStopped = currentMachineStatus === 'Parada';

    const [showReadOnlyStandsModal, setShowReadOnlyStandsModal] = useState(false);
    const [showElectrodesModal, setShowElectrodesModal] = useState(false);
    const [showTrocaDeRoloInOtherStop, setShowTrocaDeRoloInOtherStop] = useState(false);
    const [machineStandsSummary, setMachineStandsSummary] = useState<TrelicaSpoolStand[]>([]);

    useEffect(() => {
        if (activeMachine.startsWith('Treliça')) {
            fetchTrelicaSpoolStands(activeMachine).then(data => {
                setMachineStandsSummary(data || []);
            }).catch(() => {});
        }
    }, [activeMachine, isMachineStopped]);
    const statusStartTime = useMemo(() => {
        if (!activeOrder) return null;
        if (isMachineStopped) {
            const events = activeOrder.downtimeEvents || [];
            const openEvent = [...events].reverse().find(e => !e.resumeTime);
            return openEvent ? new Date(openEvent.stopTime) : null;
        } else if (isActiveProcess) {
            const events = activeOrder.downtimeEvents || [];
            const sortedResumes = events.filter(e => e.resumeTime).sort((a,b) => new Date(b.resumeTime!).getTime() - new Date(a.resumeTime!).getTime());
            const lastResume = sortedResumes[0]?.resumeTime;
            const shiftStart = currentOperatorLog?.startTime;
            
            if (lastResume && shiftStart) {
                return new Date(Math.max(new Date(lastResume).getTime(), new Date(shiftStart).getTime()));
            }
            return lastResume ? new Date(lastResume) : shiftStart ? new Date(shiftStart) : null;
        }
        return null;
    }, [activeOrder, isMachineStopped, isActiveProcess, currentOperatorLog]);

    const statusDurationString = useMemo(() => {
        if (!statusStartTime) return '--:--:--';
        const diff = Math.max(0, now.getTime() - statusStartTime.getTime());
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [statusStartTime, now]);

    const statusConfig = {
        Produzindo: {
            color: 'emerald',
            text: 'text-emerald-700',
            bg: 'bg-emerald-500',
            border: 'border-emerald-500',
            glow: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
            pulse: 'from-emerald-50',
            label: 'OPERANDO'
        },
        Preparacao: {
            color: 'blue',
            text: 'text-blue-700',
            bg: 'bg-blue-500',
            border: 'border-blue-500',
            glow: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]',
            pulse: 'from-blue-50',
            label: 'EM PREPARAÇÃO'
        },
        Parada: {
            color: 'amber',
            text: 'text-amber-600',
            bg: 'bg-amber-500',
            border: 'border-amber-500',
            glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
            pulse: 'from-amber-50',
            label: 'PARADA'
        },
        Desligada: {
            color: 'slate',
            text: 'text-slate-600',
            bg: 'bg-slate-500',
            border: 'border-slate-500',
            glow: 'shadow-[0_0_10px_rgba(100,116,139,0.4)]',
            pulse: 'from-slate-50',
            label: 'MÁQUINA DESLIGADA'
        },
        Ocioso: {
            color: 'slate',
            text: 'text-slate-600',
            bg: 'bg-slate-300',
            border: 'border-slate-300',
            glow: 'shadow-none',
            pulse: '',
            label: 'AGUARDANDO OPERADOR'
        }
    } as Record<string, any>;

    const statusStyle = statusConfig[currentMachineStatus];

    const isShiftOverdue = useMemo(() => {
        if (!currentOperatorLog || currentOperatorLog.endTime) return false;
        
        const startH = new Date(currentOperatorLog.startTime).getHours();
        const startShift = (startH >= 5 && startH < 14) ? 'A' : 'B';
        
        const currentH = now.getHours();
        const currentShift = (currentH >= 5 && currentH < 14) ? 'A' : 'B';
        
        return startShift !== currentShift;
    }, [currentOperatorLog, now]);


    useEffect(() => {
        if ((activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) && activeOrder && hasActiveShift && !showQuantityPrompt) {
            const lastUpdate = activeOrder.lastQuantityUpdate || activeOrder.startTime;
            if (!lastUpdate) return;

            const baseTime = new Date(lastUpdate).getTime();
            const nowMs = now.getTime();
            const diff = nowMs - baseTime;

            // Treliça e Malha: ciclo a cada 5 minutos conforme solicitação para acompanhamento contínuo dos rolos; outras máquinas: 10 min
            const promptIntervalMs = (activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) ? 5 * 60 * 1000 : 10 * 60 * 1000;
            const isIntervalElapsed = diff > promptIntervalMs;
            const isLastPromptElapsed = nowMs - lastPromptShownAt > promptIntervalMs;

            if (isIntervalElapsed && isLastPromptElapsed) {
                setShowQuantityPrompt(true);
                setLastPromptShownAt(nowMs);
            }
        }
    }, [now, activeOrder, hasActiveShift, machineType, showQuantityPrompt, lastPromptShownAt, activeMachine]);

    // Reset autorização de hora extra quando o turno ou a OP mudar
    useEffect(() => {
        setAuthorizedOvertimeForCurrentShift(false);
        setShowAutoEndCountdownModal(false);
        autoEndShiftTriggeredRef.current = null;
    }, [activeOrder?.id, currentOperatorLog?.startTime]);

    // Monitoramento de Fim de Turno e Contagem Regressiva de Auto-Encerramento
    useEffect(() => {
        if (!activeOrder || !hasActiveShift || !shiftStatus.autoEndShift) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se o turno estiver apenas aberto aguardando check-in do operador, não abre modal de encerramento
        if (currentOperatorLog?.pendingOperatorCheckin) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se o operador já teve hora extra autorizada nesta sessão de turno, descarta contagem de fechamento
        const isAuthorizedLog = Boolean(
            authorizedOvertimeForCurrentShift ||
            currentOperatorLog?.managerAuthorized ||
            (currentOperatorLog as any)?.manager_authorized ||
            currentOperatorLog?.isOvertime ||
            (currentOperatorLog as any)?.is_overtime
        );

        if (isAuthorizedLog) {
            setShowAutoEndCountdownModal(false);
            return;
        }

        // Se a máquina possui autoEndShift ativo e NÃO for feriado nem folga oficial
        const canAutoEnd = shiftStatus.autoEndShift && !shiftStatus.isHoliday && shiftStatus.isWorkDay !== false;

        // Se passou do horário de término do turno regular
        if (canAutoEnd && shiftEvaluation.isOvertime && !shiftStatus.inShiftWindow) {
            if (shiftStatus.isAutoEndCountdown) {
                setShowAutoEndCountdownModal(true);
            } else {
                setShowAutoEndCountdownModal(false);
            }
        } else {
            setShowAutoEndCountdownModal(false);
        }
    }, [
        activeOrder,
        hasActiveShift,
        shiftStatus.autoEndShift,
        shiftStatus.isAutoEndCountdown,
        shiftEvaluation.isOvertime,
        shiftStatus.inShiftWindow,
        shiftStatus.shiftName,
        shiftStatus.shiftLabel,
        authorizedOvertimeForCurrentShift,
        currentOperatorLog?.pendingOperatorCheckin,
        currentOperatorLog?.managerAuthorized,
        (currentOperatorLog as any)?.manager_authorized,
        currentOperatorLog?.isOvertime,
        (currentOperatorLog as any)?.is_overtime,
        endOperatorShift
    ]);

    useEffect(() => {
        if (justCompletedOrderId) {
            const completedOrder = completedOrders.find(o => o.id === justCompletedOrderId);
            if (completedOrder) {
                setProductionReportData(completedOrder);
                setJustCompletedOrderId(null);
            }
        }
    }, [completedOrders, justCompletedOrderId]);

    useEffect(() => {
        if (initialView) setView(initialView);
    }, [initialView]);

    useEffect(() => {
        if (initialModal === 'reports') {
            setShowShiftReportsModal(true);
            setShowPartsRequestModal(false);
        } else if (initialModal === 'parts') {
            setShowPartsRequestModal(true);
            setShowShiftReportsModal(false);
        } else if (initialModal === 'bitolaCheck') {
            setShowBitolaCheck(true);
        } else if (initialModal === null) {
            setShowPartsRequestModal(false);
        }
    }, [initialModal]);


    const { waitingLots, completedLots } = useMemo(() => {
        if (!activeOrder || (!activeOrder.machine.startsWith('Trefila') && !activeOrder.machine.startsWith('Desbobinadeira'))) return { waitingLots: [], completedLots: [] };

        const rawLots = activeOrder.processedLots || (activeOrder as any).processed_lots || [];
        const processedLotIds = new Set(rawLots.map((p: any) => p.lotId || p.lot_id).filter(Boolean));

        // Para ordens fantasma, selectedLotIds pode começar vazio e lotes são adicionados dinamicamente
        const selectedIds = Array.isArray(activeOrder.selectedLotIds) 
            ? activeOrder.selectedLotIds.map((l: any) => typeof l === 'string' ? l : (l.lotId || l.lot_id)).filter(Boolean)
            : [];
        const processedIds = rawLots.map((p: any) => p.lotId || p.lot_id).filter(Boolean);
        const allKnownLotIds = [...new Set([...selectedIds, ...processedIds])];

        const allOrderLots = stock.filter(s => allKnownLotIds.includes(s.id));

        const waiting = allOrderLots.filter(lot => !processedLotIds.has(lot.id) && lot.id !== activeLotProcessingData?.lotId);

        const completed = rawLots.map((processedLot: any) => {
            const lotId = processedLot.lotId || processedLot.lot_id;
            const finalWeight = processedLot.finalWeight !== undefined && processedLot.finalWeight !== null 
                ? Number(processedLot.finalWeight) 
                : (processedLot.final_weight !== undefined && processedLot.final_weight !== null ? Number(processedLot.final_weight) : null);
            const measuredGauge = processedLot.measuredGauge !== undefined && processedLot.measuredGauge !== null 
                ? Number(processedLot.measuredGauge) 
                : (processedLot.measured_gauge !== undefined && processedLot.measured_gauge !== null ? Number(processedLot.measured_gauge) : undefined);
            const lotInfo = stock.find(s => s.id === lotId || s.internalLot === lotId);
            return { 
                ...processedLot, 
                lotId, 
                finalWeight,
                measuredGauge,
                lotInfo: lotInfo || null 
            };
        });

        return { waitingLots: waiting, completedLots: completed };
    }, [activeOrder, stock, activeLotProcessingData]);

    const trelicaPackages = useMemo(() => {
        if (!activeOrder || !activeOrder.machine.startsWith('Treliça')) return [];

        const PACKAGE_SIZE = 200;
        const totalQuantity = activeOrder.quantityToProduce || 0;
        const numPackages = Math.ceil(totalQuantity / PACKAGE_SIZE);

        return Array.from({ length: numPackages }, (_, i) => {
            const packageNumber = i + 1;
            const isLast = i === numPackages - 1;
            const qty = (isLast && totalQuantity % PACKAGE_SIZE !== 0) ? totalQuantity % PACKAGE_SIZE : PACKAGE_SIZE;
            const weighedPackage = (activeOrder.weighedPackages || []).find(p => p.packageNumber === packageNumber);

            return {
                packageNumber,
                quantity: qty,
                status: weighedPackage ? 'Concluído' : 'Aguardando Pesagem' as 'Concluído' | 'Aguardando Pesagem',
                weight: weighedPackage ? weighedPackage.weight : null
            };
        });
    }, [activeOrder]);

    const allTrefilaLotsProcessed = useMemo(() => {
        if (!activeOrder || (!activeOrder.machine.startsWith('Trefila') && !activeOrder.machine.startsWith('Desbobinadeira'))) return false;

        // Para ordens fantasma sem lotes selecionados inicialmente:
        // Permite fechar se ao menos 1 lote foi processado e pesado, OU se não há lotes em nenhum estado
        const selectedIds = Array.isArray(activeOrder.selectedLotIds) ? activeOrder.selectedLotIds as string[] : [];
        const processedIds = (activeOrder.processedLots || []).map(p => p.lotId);
        const allKnownIds = [...new Set([...selectedIds, ...processedIds])];

        if (allKnownIds.length === 0) {
            // Ordem fantasma sem nenhum lote: permite fechar (caso especial)
            return activeOrder.isGhostOrder === true;
        }

        const weighedLots = (activeOrder.processedLots || []).filter(l => l.finalWeight !== null).length;
        return allKnownIds.length === weighedLots && weighedLots > 0;
    }, [activeOrder]);

    const allPackagesWeighed = useMemo(() => {
        if ((!activeMachine.startsWith('Treliça')) || !activeOrder) return false;
        return trelicaPackages.every(p => p.status === 'Concluído');
    }, [trelicaPackages, activeOrder, machineType]);

    const isCompletionDisabled = useMemo(() => {
        if (isEmergencyStopped || (!hasActiveShift && !isGestor)) return true;
        if (activeMachine.startsWith('Treliça')) return !allPackagesWeighed;
        if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) return !allTrefilaLotsProcessed;
        if (activeMachine.startsWith('Malha')) return false;
        return true;
    }, [isEmergencyStopped, hasActiveShift, machineType, allPackagesWeighed, allTrefilaLotsProcessed, activeMachine]);

    const handleStopMachine = (reason: string) => {
        if (!activeOrder) return;
        if (logDowntime) {
            logDowntime(activeOrder.id, reason);
            setShowDowntimeModal(false);
        }
    }

    const handlePartsRequestSubmit = (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status' | 'machine' | 'productionOrderId'>) => {
        if (addPartsRequest && activeOrder) {
            addPartsRequest({
                ...data,
            });
            setShowPartsRequestModal(false);
        }
    };

    const handleUpdateShiftReport = async (reportId: string, updates: Partial<ShiftReport>) => {
        if (onUpdateReport) {
            await onUpdateReport(reportId, updates);
        }
    };


    // OS Tracking for Desbobinadeira
    const handleStartOs = (osIndex: number) => {
        if (!activeOrder || !updateProductionOrder) return;
        const osItems = (activeOrder as any).osItems || [];
        const osItem = osItems[osIndex];
        if (!osItem) return;

        const osProgress = (activeOrder as any).osProgress || { logs: [] };
        const newProgress = {
            currentOs: osItem.os || `OS ${osIndex + 1}`,
            startTime: new Date().toISOString(),
            logs: osProgress.logs || []
        };

        updateProductionOrder(activeOrder.id, { osProgress: newProgress } as any);
    };

    const handleFinishOs = () => {
        if (!activeOrder || !updateProductionOrder) return;
        const osProgress = (activeOrder as any).osProgress;
        if (!osProgress?.currentOs || !osProgress?.startTime) return;

        const nowTime = new Date();
        const startMs = new Date(osProgress.startTime).getTime();
        const durationSeconds = Math.floor((nowTime.getTime() - startMs) / 1000);

        const newLog = {
            os: osProgress.currentOs,
            startTime: osProgress.startTime,
            endTime: nowTime.toISOString(),
            durationSeconds
        };

        const newProgress = {
            currentOs: null,
            startTime: null,
            logs: [...(osProgress.logs || []), newLog]
        };

        updateProductionOrder(activeOrder.id, { osProgress: newProgress } as any);
    };

    const handleStartProcessingLot = (lotId: string) => {
        if (activeOrder && startLotProcessing) {
            setSelectedLotForSpeed(lotId);
            setShowSpeedModal(true);
        }
    }

    const confirmStartLot = (speed: number) => {
        if (activeOrder && startLotProcessing && selectedLotForSpeed) {
            // Validação de Controladoria: Eletrodos com lotes cadastrados na Treliça
            if (activeMachine.startsWith('Treliça')) {
                const val = validateTrelicaElectrodesConfigured(activeMachine);
                if (!val.isValid) {
                    setTrelicaValidationBlock(val);
                    setShowTrelicaBlockModal(true);
                    return;
                }
            }

            startLotProcessing(activeOrder.id, selectedLotForSpeed, speed);
            setShowSpeedModal(false);
            setSelectedLotForSpeed(null);
        }
    }

    const handleFinishLotProcess = () => {
        if (activeOrder && activeLotProcessingData && finishLotProcessing) {
            finishLotProcessing(activeOrder.id, activeLotProcessingData.lotId);
        }
    }

    const handleTrefilaComplete = () => {
        if (activeOrder && completeProduction) {
            setJustCompletedOrderId(activeOrder.id);
            completeProduction(activeOrder.id, {});
        }
    };

    const handleCompleteProduction = (data: { actualProducedQuantity?: number, pontas?: Ponta[] }) => {
        if (activeOrder && completeProduction) {
            completeProduction(activeOrder.id, data);
            setShowCompletionModal(false);
        }
    }

    const proceedWithShiftEnd = (orderId: string) => {
        if (!activeMachine.startsWith('Treliça') && !activeMachine.startsWith('Malha')) {
            if (endOperatorShift) {
                const orderToEnd = productionOrders.find(o => o.id === orderId);
                endOperatorShift(orderId, (orderToEnd?.actualProducedQuantity || 0));
            }
            setPendingShiftEnd(null);
            return;
        }
        setShowQuantityPrompt(true);
    };

    const handleShiftEndRequest = (orderId: string) => {
        setPendingShiftEnd(orderId);

        // Se o encerramento for antes do horário oficial e a máquina exigir autorização, pedir senha do gestor
        const isNearOrPastEnd = shiftStatus.isAutoEndCountdown || shiftEvaluation.isOvertime;
        if (!isNearOrPastEnd && !isGestor && shiftStatus.requireManagerAuthForOvertime) {
            setShowManagerAuthForShiftEnd(true);
            return;
        }

        proceedWithShiftEnd(orderId);
    };

    const handleManagerAuthSuccess = () => {
        setShowManagerAuthForShiftEnd(false);
        if (pendingShiftEnd) {
            proceedWithShiftEnd(pendingShiftEnd);
        }
    };

    const handleUpdateQuantity = (quantity: number, isDirectTotal?: boolean) => {
        // Validação de Controladoria: Eletrodos com lotes cadastrados na Treliça antes de contabilizar
        if (activeMachine.startsWith('Treliça')) {
            const val = validateTrelicaElectrodesConfigured(activeMachine);
            if (!val.isValid) {
                setTrelicaValidationBlock(val);
                setShowTrelicaBlockModal(true);
                return;
            }
        }

        const targetOrder = pendingShiftEnd ? (productionOrders.find(o => o.id === pendingShiftEnd)) : activeOrder;

        if (targetOrder && updateProducedQuantity) {
            const rawLogs: any[] = targetOrder.operatorLogs || (targetOrder as any).operator_logs || [];
            const openIdx = rawLogs.findIndex((l: any) => !l.endTime && !l.end_time);
            let trailingClosedPieces = 0;
            if (openIdx !== -1) {
                for (let k = openIdx + 1; k < rawLogs.length; k++) {
                    if (rawLogs[k].endTime || rawLogs[k].end_time) {
                        const tsQ = Number(rawLogs[k].startQuantity ?? rawLogs[k].start_quantity ?? 0) || 0;
                        const teQ = Number(rawLogs[k].endQuantity ?? rawLogs[k].end_quantity ?? 0) || 0;
                        trailingClosedPieces += Math.max(0, teQ - tsQ);
                    }
                }
            }
            const baseStartQty = Number(currentOperatorLog?.startQuantity ?? (currentOperatorLog as any)?.start_quantity ?? 0) || 0;
            const startQty = baseStartQty + trailingClosedPieces;
            const currentTotal = Number(targetOrder.actualProducedQuantity) || 0;

            let newTotal = 0;
            if (isDirectTotal) {
                // Operador digitou o contador total acumulado diretamente
                newTotal = Math.max(currentTotal, quantity);
            } else {
                // Modo Turno com trava de segurança anti-duplicação:
                // Se a OP já tinha início > 0 e o operador digitou um valor que já é igual ou maior que o total da ordem
                // (e claramente muito acima do que foi feito apenas neste turno), ele digitou a contagem acumulada da máquina!
                // NÃO SOMAR startQty por cima de quantity para não dar +70 a mais!
                if (startQty > 0 && quantity >= currentTotal && quantity > (currentTotal - startQty + 20)) {
                    console.log(`[Segurança Contador] Operador digitou contagem total da máquina (${quantity}) em vez do delta de turno. Ajustando total sem duplicar o início de ${startQty}.`);
                    newTotal = quantity;
                } else {
                    newTotal = startQty + quantity;
                }
            }

            updateProducedQuantity(targetOrder.id, newTotal);

            if (pendingShiftEnd && endOperatorShift) {
                endOperatorShift(targetOrder.id, newTotal);
                setPendingShiftEnd(null);
            }

            setShowQuantityPrompt(false);
        }
    };

    const viewTitles: Record<View, string> = {
        dashboard: `Painel da Máquina ${activeMachine}`,
        in_progress: postProductionOrder ? 'Atividade Pós-Produção' : 'Ordem em Produção',
        pending: 'Próximas Produções',
        completed: 'Produções Finalizadas',
    };

    const machineHeader = activeMachine.startsWith('Trefila') 
        ? "Produção maquina DHTRF (TREFILA)" 
        : activeMachine.startsWith('Desbobinadeira') 
            ? "Produção maquina DESB (DESBOBINADEIRA 1)" 
            : activeMachine.startsWith('Malha')
                ? "Produção maquina MALHA (MALHA)"
                : "Produção maquina DHSTR (TRELIÇA)";

    const promptOrder = pendingShiftEnd ? (productionOrders.find(o => o.id === pendingShiftEnd)) : activeOrder;

    if (showTrefilaCalculation) {
        return <TrefilaCalculation onClose={() => setShowTrefilaCalculation(false)} machineType={machineType} activeOrder={activeOrder} gauges={gauges} />;
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {/* Overlay Fixed para Parada Operacional (Sempre Visível no Topo) */}
            {isMachineStopped && activeOrder && (
                (() => {
                    const openEvent = [...(activeOrder.downtimeEvents || [])]
                        .sort((a,b) => new Date(b.stopTime).getTime() - new Date(a.stopTime).getTime())
                        .find(e => !e.resumeTime);
                    
                    const reason = openEvent?.reason || 'Motivo não informado';
                    const start = openEvent ? new Date(openEvent.stopTime).getTime() : now.getTime();
                    const durationMs = now.getTime() - start;
                    
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const normReason = normalize(reason);
                    
                    const matchingConfig = (downtimeConfigs || []).find(c => normReason.includes(normalize(c.reason)));
                    const limitMinutes = matchingConfig ? matchingConfig.thresholdMinutes : (DOWNTIME_THRESHOLDS[reason] || 15);
                    const limitMs = limitMinutes * 60 * 1000;
                    const isOverLimit = durationMs > limitMs;

                    const isTrocaDeRolo = activeMachine.startsWith('Treliça') && (
                        showTrocaDeRoloInOtherStop ||
                        (normReason.includes('troca') && normReason.includes('rolo')) ||
                        normReason.includes('troca de rolo') ||
                        normReason.includes('rolo') ||
                        normReason.includes('bobina')
                    );

                    const handleResumeAction = () => {
                        // Trava de Horário: Se tentar religar/retomar antes da hora de início cadastrada no modal
                        if (!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !authorizedOvertimeForCurrentShift) {
                            setPendingResumeAfterAuth(true);
                            setShowManagerAuthForOvertimeStart(true);
                            return;
                        }
                        if (isOverLimit && !downtimeJustification.trim()) {
                            alert('Por favor, detalhe o motivo de ter excedido o limite de tempo para prosseguir.');
                            return;
                        }
                        if (logResumeProduction) {
                            logResumeProduction(activeOrder.id, isOverLimit ? downtimeJustification : undefined);
                            setDowntimeJustification('');
                            setShowTrocaDeRoloInOtherStop(false);
                        }
                    };

                    // SE A PARADA FOR ESPECIFICAMENTE POR TROCA DE ROLO (OU ACIONADA NELA):
                    if (isTrocaDeRolo) {
                        return (
                            <div className="fixed inset-0 flex flex-col z-[100] bg-slate-950/95 backdrop-blur-2xl overflow-y-auto p-3 sm:p-6 custom-scrollbar animate-fade-in">
                                <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 my-auto">
                                    {/* Header de Parada Operacional: Troca de Rolo */}
                                    <div className={`p-4 sm:p-6 rounded-3xl border ${isOverLimit ? 'bg-rose-950/70 border-rose-500/60 shadow-rose-900/30' : 'bg-slate-900/90 border-amber-500/40 shadow-amber-900/20'} shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                                        <div className="flex items-center gap-3.5">
                                            {showTrocaDeRoloInOtherStop && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTrocaDeRoloInOtherStop(false)}
                                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
                                                >
                                                    ← Voltar
                                                </button>
                                            )}
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${isOverLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}`}>
                                                🔄
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider ${isOverLimit ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950'}`}>
                                                        {isOverLimit ? '⚠️ LIMITE DE PARADA EXCEDIDO' : 'PARADA ATIVA: TROCA DE ROLO'}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-400">Máquina: <strong className="text-white">{activeMachine}</strong></span>
                                                    <span className="text-xs font-mono text-slate-400">OP: <strong className="text-cyan-400">#{activeOrder.orderNumber}</strong></span>
                                                </div>
                                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                                                    PAINEL DE TROCA DE BOBINAS / PORTA-ROLOS
                                                </h2>
                                                <p className="text-xs text-slate-300 mt-0.5">
                                                    A máquina está oficialmente parada. Selecione abaixo o suporte que deseja abastecer ou descarregar.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Cronômetro e Botão de Retomada no Topo */}
                                        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end flex-wrap">
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-white/10 text-right">
                                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Tempo Parada</span>
                                                <span className={`text-2xl font-black font-mono ${isOverLimit ? 'text-rose-400' : 'text-amber-400'}`}>
                                                    {formatDuration(durationMs)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-mono">Limite: {limitMinutes} min</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleResumeAction}
                                                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-emerald-500/20 flex items-center gap-2 flex-shrink-0"
                                            >
                                                <PlayIcon className="h-5 w-5" />
                                                <span>Concluir Troca & Retomar Máquina</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Justificativa caso tenha excedido o limite */}
                                    {isOverLimit && (
                                        <div className="bg-rose-950/70 border border-rose-500/50 p-4 rounded-2xl animate-fade-in-up">
                                            <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1.5 block">
                                                Justificativa Obrigatória de Atraso na Troca de Rolo
                                            </label>
                                            <textarea
                                                value={downtimeJustification}
                                                onChange={(e) => setDowntimeJustification(e.target.value)}
                                                placeholder="Descreva detalhadamente o motivo do atraso (ex: arame embaraçado no desbobinador, atraso na empilhadeira, solda demorada...)"
                                                className="w-full p-3 bg-rose-900/30 border border-rose-500/40 rounded-xl text-white text-sm font-medium focus:border-rose-400 outline-none resize-none h-20 placeholder:text-rose-300/40"
                                            />
                                        </div>
                                    )}

                                    {/* Gêmeo Digital dos Porta-Rolos Interativo e Liberado */}
                                    <div className="bg-[#07131B] p-3 sm:p-5 rounded-3xl border border-white/10 shadow-2xl">
                                        <TrelicaSpoolStands
                                            machineName={activeMachine}
                                            stock={stock}
                                            activeOrder={activeOrder}
                                            productionOrders={productionOrders}
                                            currentUser={currentUser}
                                            readOnly={false}
                                            onSpoolChange={(stand, newLot) => {
                                                if (addLotToOrder && activeOrder) {
                                                    try {
                                                        addLotToOrder(activeOrder.id, newLot.id);
                                                    } catch (e) {
                                                        console.warn('Auto addLotToOrder:', e);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Rodapé de Confirmação */}
                                    <div className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                        <p className="text-xs text-slate-300 font-medium">
                                            ✓ Bobinas instaladas e sincronizadas no sistema. Quando estiver pronto para religar a máquina:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleResumeAction}
                                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 flex-shrink-0"
                                        >
                                            <PlayIcon className="h-4 w-4" />
                                            <span>Retomar Produção Agora</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // SE A PARADA FOR ESPECIFICAMENTE POR ELETRODOS (LIMPEZA, AJUSTE OU TROCA):
                    const isParadaEletrodo = activeMachine.startsWith('Treliça') && (
                        normReason.includes('eletrodo') ||
                        normReason.includes('limpeza de eletrodo') ||
                        normReason.includes('troca de eletrodo') ||
                        normReason.includes('ajuste de eletrodo') ||
                        normReason.includes('solda')
                    );

                    if (isParadaEletrodo) {
                        return (
                            <div className="fixed inset-0 flex flex-col z-[100] bg-slate-950/95 backdrop-blur-2xl overflow-y-auto p-3 sm:p-6 custom-scrollbar animate-fade-in">
                                <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 my-auto">
                                    {/* Header de Parada Operacional: Eletrodos */}
                                    <div className={`p-4 sm:p-6 rounded-3xl border ${isOverLimit ? 'bg-rose-950/70 border-rose-500/60 shadow-rose-900/30' : 'bg-slate-900/90 border-cyan-500/40 shadow-cyan-900/20'} shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${isOverLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'}`}>
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider ${isOverLimit ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500 text-slate-950'}`}>
                                                        {isOverLimit ? '⚠️ LIMITE DE PARADA EXCEDIDO' : `PARADA ATIVA: ${reason.toUpperCase()}`}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-400">Máquina: <strong className="text-white">{activeMachine}</strong></span>
                                                    <span className="text-xs font-mono text-slate-400">OP: <strong className="text-cyan-400">#{activeOrder.orderNumber}</strong></span>
                                                </div>
                                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                                                    CABEÇA DE SOLDA: LIMPEZA, AJUSTE & TROCA DE ELETRODOS
                                                </h2>
                                                <p className="text-xs text-slate-300 mt-0.5">
                                                    A máquina está oficialmente parada. Selecione o eletrodo desejado no desenho para efetuar a limpeza, regulagem ou substituição.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Cronômetro e Botão de Retomada no Topo */}
                                        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end flex-wrap">
                                            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-white/10 text-right">
                                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Tempo Parada</span>
                                                <span className={`text-2xl font-black font-mono ${isOverLimit ? 'text-rose-400' : 'text-cyan-400'}`}>
                                                    {formatDuration(durationMs)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-mono">Limite: {limitMinutes} min</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleResumeAction}
                                                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-emerald-500/20 flex items-center gap-2 flex-shrink-0"
                                            >
                                                <PlayIcon className="h-5 w-5" />
                                                <span>Concluir Eletrodos & Retomar Máquina</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Justificativa caso tenha excedido o limite */}
                                    {isOverLimit && (
                                        <div className="bg-rose-950/70 border border-rose-500/50 p-4 rounded-2xl animate-fade-in-up">
                                            <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1.5 block">
                                                Justificativa Obrigatória de Atraso no Procedimento dos Eletrodos
                                            </label>
                                            <textarea
                                                value={downtimeJustification}
                                                onChange={(e) => setDowntimeJustification(e.target.value)}
                                                placeholder="Descreva detalhadamente o motivo do atraso (ex: ajuste fino de altura demorado, remoção difícil de carepa de solda...)"
                                                className="w-full p-3 bg-rose-900/30 border border-rose-500/40 rounded-xl text-white text-sm font-medium focus:border-rose-400 outline-none resize-none h-20 placeholder:text-rose-300/40"
                                            />
                                        </div>
                                    )}

                                    {/* Gêmeo Digital da Cabeça de Solda (Interativo) */}
                                    <div className="bg-[#07131B] p-2 sm:p-4 rounded-3xl border border-white/10 shadow-2xl">
                                        <TrelicaWeldingHead
                                            machineName={activeMachine}
                                            readOnly={false}
                                            stock={stock}
                                            gauges={gauges}
                                        />
                                    </div>

                                    {/* Rodapé de Confirmação */}
                                    <div className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                        <p className="text-xs text-slate-300 font-medium">
                                            ✓ Procedimento de eletrodo concluído. Quando estiver pronto para religar a máquina:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleResumeAction}
                                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 flex-shrink-0"
                                        >
                                            <PlayIcon className="h-4 w-4" />
                                            <span>Retomar Produção Agora</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (currentMachineStatus === 'Preparacao' && !isOverLimit) return null;

                    // PARADA OPERACIONAL PADRÃO (OUTROS MOTIVOS: ENROSCO, MANUTENÇÃO, ETC.)
                    return (
                        <div className={`fixed inset-0 flex items-center justify-center z-[100] p-4 overflow-y-auto transition-all duration-500 ${isOverLimit ? 'bg-rose-600/90 animate-stop-pulse' : 'bg-amber-500/90 animate-warning-pulse'} backdrop-blur-xl`}>
                            <div className={`text-center p-6 sm:p-8 bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] w-full ${activeMachine.startsWith('Malha') ? 'max-w-xl' : 'max-w-sm'} mx-auto my-auto animate-zoom-in border border-white/20`}>
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 transition-colors ${isOverLimit ? 'bg-rose-100 border-2 border-rose-500' : 'bg-amber-100 border-2 border-amber-500 animate-warning-pulse'}`}>
                                    <PauseIcon className={`h-10 w-10 ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`} />
                                </div>
                                
                                <h3 className={`text-2xl font-black mb-2 tracking-tight uppercase ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {isOverLimit ? 'LIMITE ULTRAPASSADO' : 'PARADA OPERACIONAL'}
                                </h3>
                                
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Motivo Atual</p>
                                    <p className="font-bold text-slate-700 text-lg uppercase italic">{reason}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 mb-6">
                                    <div className="bg-slate-900 p-4 rounded-2xl shadow-inner">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tempo Total de Parada</p>
                                        <p className="text-3xl font-black text-white font-mono">{formatDuration(durationMs)}</p>
                                    </div>
                                    
                                    {limitMs && (
                                        <div className={`p-4 rounded-2xl border-2 transition-all ${isOverLimit ? 'bg-rose-50 border-rose-500 animate-stop-pulse' : 'bg-amber-50 border-amber-500 animate-warning-pulse'}`}>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isOverLimit ? 'text-rose-600' : 'text-amber-600'}`}>
                                                Tempo Previsto: <span className="text-sm font-black">{limitMinutes} min</span>
                                            </p>
                                            <div className="w-full bg-black/10 rounded-full h-1.5 mt-2 overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${isOverLimit ? 'bg-rose-600' : 'bg-amber-500'}`} 
                                                    style={{ width: `${Math.min(100, (durationMs / limitMs) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {activeMachine.startsWith('Malha') && activeOrder && (
                                    <div className="mb-6">
                                        <MalhaActiveLotsCard
                                            machineName={activeMachine}
                                            activeOrder={activeOrder}
                                            stock={stock}
                                            isStoppedMode={true}
                                            onUpdateOpenDowntimeReason={async (newFormattedRollReason) => {
                                                try {
                                                    const currentEvents = [...(activeOrder.downtimeEvents || [])];
                                                    const openIdx = currentEvents.findIndex(e => !e.resumeTime && !(e as any).resume_time);
                                                    if (openIdx !== -1) {
                                                        currentEvents[openIdx] = {
                                                            ...currentEvents[openIdx],
                                                            reason: newFormattedRollReason
                                                        };
                                                        await updateItem('production_orders', activeOrder.id, {
                                                            downtimeEvents: currentEvents
                                                        } as any);
                                                    }
                                                } catch (err) {
                                                    console.warn('Erro ao atualizar motivo de troca de rolo da Malha:', err);
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {activeMachine.startsWith('Treliça') && (
                                    <div className="flex flex-col gap-2 mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowTrocaDeRoloInOtherStop(true)}
                                            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                        >
                                            <span>🔄</span>
                                            <span>Aproveitar Parada p/ Trocar Rolo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowElectrodesModal(true)}
                                            className="w-full py-2.5 px-4 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/50 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                        >
                                            <span>⚡</span>
                                            <span>Inspecionar / Trocar Eletrodos</span>
                                        </button>
                                    </div>
                                )}


                                {isOverLimit && (
                                    <div className="mb-6 text-left animate-fade-in-up">
                                        <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 block">
                                            Justificativa do Atraso (Obrigatório)
                                        </label>
                                        <textarea
                                            value={downtimeJustification}
                                            onChange={(e) => setDowntimeJustification(e.target.value)}
                                            placeholder="Descreva detalhadamente o motivo de ter excedido o limite..."
                                            className="w-full p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl text-slate-700 font-medium focus:border-rose-500 focus:bg-white transition-all outline-none min-h-[100px] resize-none shadow-inner"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handleResumeAction}
                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-lg flex items-center justify-center gap-3 mb-6 ${
                                        isOverLimit 
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 hover:scale-[1.02] active:scale-[0.98]' 
                                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                                >
                                    <PlayIcon className="h-5 w-5" />
                                    Retomar Produção
                                </button>

                                <p className="text-slate-400 text-[10px] font-bold uppercase leading-relaxed tracking-wider">
                                    Retome a produção assim que o problema for resolvido.
                                </p>
                            </div>
                        </div>
                    );
                })()
            )}

            {/* Overlay Fixed para Bloqueio de Operador ou Check-in de Turno Auto-Iniciado */}
            {!hasActiveShift && isAnyActiveShift && activeOrder && !isGestor && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-[100] transition-all duration-500 p-4">
                    <div className="text-center p-8 bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md mx-auto animate-fade-in-up border-4 border-amber-400/50 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400"></div>
                        
                        {currentOperatorLog?.pendingOperatorCheckin ? (
                            <>
                                <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-xl">
                                    <ClockIcon className="h-12 w-12 text-amber-500 animate-pulse" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-3 py-1 rounded-full mb-3 inline-block">
                                    Turno Aberto pelo Sistema
                                </span>
                                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase">
                                    {shiftStatus.shiftName}
                                </h3>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left space-y-1 text-xs">
                                    <p className="text-slate-600 font-bold">
                                        Horário agendado: <strong className="text-slate-900">{shiftStatus.shiftLabel}</strong>
                                    </p>
                                    <p className="text-slate-500">
                                        O sistema abriu este turno pontualmente às {new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                                    </p>
                                </div>
                                <p className="text-slate-500 mb-6 text-xs font-bold leading-relaxed">
                                    Faça seu check-in para conectar seu usuário <span className="text-indigo-600 font-black">{currentUser?.username}</span> ao posto de trabalho e iniciar a produção.
                                </p>
                                <button
                                    onClick={() => handleStartShift()}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 px-8 rounded-2xl uppercase text-sm flex items-center justify-center gap-3 tracking-[0.1em] transition-all shadow-xl shadow-emerald-100 active:scale-[0.97]"
                                >
                                    <CheckCircleIcon className="h-6 w-6" />
                                    Fazer Check-in e Assumir Posto
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                                    <ArrowPathIcon className="h-10 w-10 text-indigo-600 animate-spin-slow" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full mb-2 inline-block">
                                    Operador Ativo no Posto
                                </span>
                                <h3 className="text-2xl font-black text-slate-900 mb-1 tracking-tight uppercase">Assumir Máquina</h3>
                                
                                <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-200 text-left space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 font-bold">Operando agora:</span>
                                        <span className="text-amber-700 font-black uppercase text-sm">{currentOperatorLog?.operator}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 font-bold">Desde:</span>
                                        <span className="text-slate-700 font-bold">
                                            {currentOperatorLog?.startTime ? new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                                        <span className="text-slate-500 font-bold">Saldo atual produzido:</span>
                                        <span className="text-emerald-700 font-black text-sm">
                                            {activeMachine.startsWith('Trefila') 
                                                ? `${(Number(activeOrder.actualProducedWeight) || 0).toLocaleString('pt-BR')} kg`
                                                : `${(Number(activeOrder.actualProducedQuantity) || 0).toLocaleString('pt-BR')} pçs`}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-left mb-4">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                        Motivo da assunção / cobertura:
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                                        {['Almoço / Intervalo', 'Apoio / Rendição', 'Troca de Posto'].map(r => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setSelectedHandoverReason(r)}
                                                className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all text-center ${
                                                    selectedHandoverReason === r
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-black'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {r === 'Almoço / Intervalo' ? '🥪 Almoço' : r === 'Apoio / Rendição' ? '🤝 Apoio' : '🔄 Troca'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            handleStartShift(false, undefined, {
                                                fromOperator: currentOperatorLog?.operator || 'Operador',
                                                reason: selectedHandoverReason
                                            });
                                        }}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-6 rounded-2xl uppercase text-sm flex items-center justify-center gap-3 tracking-[0.08em] transition-all shadow-xl shadow-indigo-100 active:scale-[0.97] cursor-pointer"
                                    >
                                        <ArrowPathIcon className="h-5 w-5" />
                                        Assumir Máquina como {currentUser?.username}
                                    </button>
                                    <p className="text-[10px] text-slate-400 font-bold leading-tight text-center">
                                        O trecho de <strong className="text-slate-600">{currentOperatorLog?.operator}</strong> será gravado com o saldo atual no relatório e você assumirá os próximos apontamentos.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {showCancelConfirmation && activeOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg animate-fade-in-up">
                        <div className="text-center">
                            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <XCircleIcon className="h-10 w-10 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Cancelar Ordem de Produção</h2>
                            <p className="text-slate-600 mb-2">
                                Tem certeza que deseja <strong className="text-red-600">CANCELAR</strong> a ordem <strong>#{activeOrder.orderNumber}</strong>?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-amber-800 font-medium">
                                    ⚠️ Esta ação irá interromper a produção e devolver todos os lotes vinculados ao estoque.
                                    {activeOrder.actualProducedQuantity ? ` Peças já produzidas: ${activeOrder.actualProducedQuantity} pçs.` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirmation(false)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-6 rounded-lg transition"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCancelConfirmation(false);
                                    setShowCancelManagerAuth(true);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition flex items-center gap-2"
                            >
                                <XCircleIcon className="h-5 w-5" />
                                Confirmar Cancelamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showCancelManagerAuth && activeOrder && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`Cancelamento da ordem de produção #${activeOrder.orderNumber}. Os lotes serão devolvidos ao estoque e a produção será interrompida.`}
                    onSuccess={() => {
                        setShowCancelManagerAuth(false);
                        if (cancelProductionOrder) {
                            cancelProductionOrder(activeOrder.id);
                        }
                    }}
                    onCancel={() => setShowCancelManagerAuth(false)}
                />
            )}
            {showDowntimeModal && (
                <DowntimeModal 
                    onClose={() => setShowDowntimeModal(false)} 
                    onSubmit={handleStopMachine} 
                    onEndShift={activeOrder ? () => handleShiftEndRequest(activeOrder.id) : undefined}
                    onPauseOrder={activeOrder && (!activeMachine.startsWith('Trefila') && !activeMachine.startsWith('Desbobinadeira')) && pauseProductionOrder ? () => {
                        if (window.confirm('Tem certeza que deseja arquivar/pausar esta ordem para iniciar outra? Seu turno atual será encerrado e a ordem voltará para a fila de pendentes.')) {
                            pauseProductionOrder(activeOrder.id);
                            setView('pending');
                        }
                    } : undefined}
                    canPause={(!activeMachine.startsWith('Trefila') && !activeMachine.startsWith('Desbobinadeira'))}
                    downtimeEvents={activeOrder?.downtimeEvents || []}
                    downtimeConfigs={downtimeConfigs}
                    machineType={activeMachine}
                    stock={stock}
                    activeOrder={activeOrder}
                />
            )}
            {showCompletionModal && activeOrder && <CompletionModal order={activeOrder} onClose={() => setShowCompletionModal(false)} onSubmit={handleCompleteProduction} />}
            {showQuantityPrompt && promptOrder && (() => {
                const rawPromptLogs: any[] = promptOrder.operatorLogs || (promptOrder as any).operator_logs || [];
                const openPromptIdx = rawPromptLogs.findIndex((l: any) => !l.endTime && !l.end_time);
                let trailingClosed = 0;
                if (openPromptIdx !== -1) {
                    for (let k = openPromptIdx + 1; k < rawPromptLogs.length; k++) {
                        if (rawPromptLogs[k].endTime || rawPromptLogs[k].end_time) {
                            const tsQ = Number(rawPromptLogs[k].startQuantity ?? rawPromptLogs[k].start_quantity ?? 0) || 0;
                            const teQ = Number(rawPromptLogs[k].endQuantity ?? rawPromptLogs[k].end_quantity ?? 0) || 0;
                            trailingClosed += Math.max(0, teQ - tsQ);
                        }
                    }
                }
                const effectiveStart = (Number(currentOperatorLog?.startQuantity ?? (currentOperatorLog as any)?.start_quantity ?? 0) || 0) + trailingClosed;
                return (
                    <QuantityPromptModal
                        onClose={() => setShowQuantityPrompt(false)}
                        onSubmit={handleUpdateQuantity}
                        currentQuantity={Math.max(0, (promptOrder.actualProducedQuantity || 0) - effectiveStart)}
                        shiftStartQuantity={effectiveStart}
                        machineName={activeMachine}
                        order={promptOrder}
                    />
                );
            })()}

            {/* Modal de Bloqueio por Falta de Lotes de Eletrodos na Treliça */}
            {showTrelicaBlockModal && trelicaValidationBlock && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[130] p-4 animate-fade-in" onClick={() => setShowTrelicaBlockModal(false)}>
                    <div className="bg-[#0B1A24] border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 text-2xl font-black">
                                ⚠️
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 font-mono">
                                    Controladoria • Rastreabilidade Obrigatória
                                </span>
                                <h3 className="text-xl font-black text-white">
                                    Eletrodos sem Lote Cadastrado
                                </h3>
                            </div>
                        </div>

                        <p className="text-sm text-slate-300">
                            A máquina <strong className="text-cyan-400">{activeMachine}</strong> possui <strong className="text-rose-400">{trelicaValidationBlock.missingCount}</strong> posição(ões) de eletrodo/base sem lote cadastrado no sistema.
                        </p>

                        <p className="text-xs text-slate-400">
                            Para manter a controladoria de estoque e rastreabilidade 100% confiáveis, é obrigatório cadastrar e vincular os lotes de todos os eletrodos antes de iniciar o turno ou contabilizar produção.
                        </p>

                        <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/10 max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Posições Pendentes de Lote ({trelicaValidationBlock.missingCount}):
                            </span>
                            {trelicaValidationBlock.missingPositions.map(pos => (
                                <div key={pos.position} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 font-mono">
                                    <span>{pos.label}</span>
                                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 font-black">
                                        Sem Lote
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowTrelicaBlockModal(false);
                                    setShowElectrodesModal(true);
                                }}
                                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>⚡</span>
                                <span>Abrir Cabeça de Solda e Cadastrar Lotes</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowTrelicaBlockModal(false)}
                                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPartsRequestModal && activeOrder && (
                <PartsRequestModal
                    order={activeOrder}
                    onClose={() => setShowPartsRequestModal(false)}
                    onSubmit={handlePartsRequestSubmit}
                />
            )}
            {showShiftReportsModal && (
                <ShiftReportsModal
                    reports={(shiftReports || []).filter(r => {
                        const cat = (machineType || 'Trefila').toLowerCase();
                        const rMachine = (r.machine || '').toLowerCase();
                        if (cat.startsWith('trefila')) return rMachine.startsWith('trefila');
                        if (cat.startsWith('treliça')) return rMachine.startsWith('treliça');
                        if (cat.startsWith('desbobinadeira')) return rMachine.startsWith('desbobinadeira');
                        return r.machine === activeMachine;
                    })}
                    stock={stock}
                    onClose={() => setShowShiftReportsModal(false)}
                    onDelete={deleteShiftReport}
                    isGestor={isGestor}
                    onUpdateReport={handleUpdateShiftReport}
                />
            )}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                    gauges={gauges}
                    shiftReports={shiftReports}
                />
            )}
            {managerOverrideData && (
                <ManagerOverrideModal
                    users={users}
                    data={{
                        actualWeight: managerOverrideData.weight,
                        lowerBound: managerOverrideData.lowerBound,
                        upperBound: managerOverrideData.upperBound,
                    }}
                    onSuccess={() => {
                        executeRecordPackageWeight(managerOverrideData);
                        setManagerOverrideData(null);
                    }}
                    onCancel={() => setManagerOverrideData(null)}
                />
            )}
            {showManagerAuthForShiftEnd && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`O encerramento do turno está sendo solicitado fora do horário de término previsto para a máquina ${activeMachine} (${shiftStatus.shiftName}: término às ${shiftStatus.workEnd}). É necessária autorização de um gestor para confirmar.`}
                    onSuccess={handleManagerAuthSuccess}
                    onCancel={() => {
                        setShowManagerAuthForShiftEnd(false);
                        setPendingShiftEnd(null);
                    }}
                />
            )}
            {showManagerAuthForOvertimeStart && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={
                        shiftEvaluation.isHoliday
                            ? `Não é possível iniciar a produção devido ao feriado de ${shiftEvaluation.holidayName || 'Feriado'}. Para iniciar a produção neste dia, digite a senha do gestor:`
                            : shiftEvaluation.isEarlyStart
                                ? `Não é possível iniciar a produção antes do horário oficial na máquina ${activeMachine} (${shiftStatus.shiftName}: início às ${shiftStatus.workStart}). Para iniciar a produção, digite a senha do gestor:`
                                : `Não é possível iniciar a produção fora do horário programado na máquina ${activeMachine} (${shiftStatus.shiftName}: término às ${shiftStatus.workEnd}). Para iniciar a produção em hora extra, digite a senha do gestor:`
                    }
                    onSuccess={() => {
                        setShowManagerAuthForOvertimeStart(false);
                        setAuthorizedOvertimeForCurrentShift(true);
                        if (pendingResumeAfterAuth) {
                            setPendingResumeAfterAuth(false);
                            if (logResumeProduction && activeOrder) {
                                logResumeProduction(activeOrder.id, downtimeJustification.trim() ? downtimeJustification : undefined);
                                setDowntimeJustification('');
                                setShowTrocaDeRoloInOtherStop(false);
                            }
                        } else if (pendingStartOrderId) {
                            const oId = pendingStartOrderId;
                            setPendingStartOrderId(null);
                            if (startProductionOrder) startProductionOrder(oId);
                            setView('in_progress');
                        } else {
                            handleStartShift(true, 'gestor');
                        }
                    }}
                    onCancel={() => {
                        setShowManagerAuthForOvertimeStart(false);
                        setPendingResumeAfterAuth(false);
                        setPendingStartOrderId(null);
                    }}
                />
            )}
            {showManagerAuthForOvertimeExtend && (
                <ManagerActionAuthorizationModal
                    users={users}
                    actionDescription={`Autorização para estender o turno e continuar a operação em HORA EXTRA na máquina ${activeMachine} após o horário de término (${shiftStatus.workEnd}).`}
                    onSuccess={() => {
                        setShowManagerAuthForOvertimeExtend(false);
                        setAuthorizedOvertimeForCurrentShift(true);
                        setShowAutoEndCountdownModal(false);
                    }}
                    onCancel={() => setShowManagerAuthForOvertimeExtend(false)}
                />
            )}
            {showAutoCloseReviewModal && activeOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-fade-in">
                    <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold">
                                    ✏️
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 leading-tight">Retificar Peças Finais</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Turno Encerrado pelo Sistema</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAutoCloseReviewModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="py-4 space-y-4">
                            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                                <p>O sistema gravou <strong>{(activeOrder.pendingAutoCloseReview?.closedQty || 0).toLocaleString('pt-BR')} {activeMachine.startsWith('Trefila') ? 'kg' : 'pçs'}</strong> no fechamento automático.</p>
                                <p className="text-[11px] text-amber-700">Informe abaixo o valor exato real produzido até o término daquele turno:</p>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                                    Quantidade Final Real ({activeMachine.startsWith('Trefila') ? 'kg' : 'peças'}):
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={autoCloseReviewQty || ''}
                                    onChange={(e) => setAutoCloseReviewQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-full text-2xl font-mono font-black text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                                    placeholder="Ex: 920"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Observação / Motivo (opcional):
                                </label>
                                <input
                                    type="text"
                                    value={autoCloseReviewNote}
                                    onChange={(e) => setAutoCloseReviewNote(e.target.value)}
                                    className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                                    placeholder="Ex: Produzi 70 peças a mais antes do fim da jornada"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAutoCloseReviewModal(false)}
                                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isSubmittingAutoCloseReview}
                                onClick={async () => {
                                    if (!reviewAutoClosedShiftQuantity || !activeOrder) return;
                                    setIsSubmittingAutoCloseReview(true);
                                    try {
                                        await reviewAutoClosedShiftQuantity(activeOrder.id, autoCloseReviewQty, autoCloseReviewNote.trim() || undefined);
                                        setShowAutoCloseReviewModal(false);
                                    } finally {
                                        setIsSubmittingAutoCloseReview(false);
                                    }
                                }}
                                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSubmittingAutoCloseReview ? 'Salvando...' : 'Salvar Quantidade'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAutoEndCountdownModal && activeOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4 animate-fade-in">
                    <div className="bg-[#0B1A24] border-2 border-amber-500/60 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse"></div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 font-bold text-3xl shrink-0">
                                ⏰
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full">
                                        Fim de Turno Atingido
                                    </span>
                                    <span className="text-xs text-amber-300 font-mono font-bold">
                                        {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white">
                                    Encerramento Automático de Turno
                                </h3>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-center">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
                                O sistema encerrará seu turno automaticamente em:
                            </p>
                            <div className="font-mono text-4xl sm:text-5xl font-black text-amber-400 tracking-wider">
                                {Math.floor(shiftStatus.remainingCountdownSeconds / 60).toString().padStart(2, '0')}:
                                {(shiftStatus.remainingCountdownSeconds % 60).toString().padStart(2, '0')}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Horário oficial de término: <strong className="text-white">{shiftStatus.workEnd}</strong>
                            </p>
                        </div>

                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Máquina:</span>
                                <span className="font-bold text-white">{activeMachine}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Ordem Ativa:</span>
                                <span className="font-bold text-white">#{activeOrder.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Produção Atual Acumulada:</span>
                                <span className="font-bold text-emerald-400">
                                    {activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')
                                        ? `${activeOrder.actualProducedQuantity || 0} peças`
                                        : `${(activeOrder.processedLots || []).filter(l => l.endTime).length} lotes concluídos`}
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-300/80 pt-2 border-t border-white/10 italic">
                                Ao encerrar automaticamente, o sistema registrará a produção salva acima e colocará a máquina em parada "Final de Turno".
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    handleShiftEndRequest(activeOrder.id);
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                            >
                                <span>✓</span>
                                <span>Encerrar Turno Agora</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowManagerAuthForOvertimeExtend(true)}
                                className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 active:scale-95 border border-amber-500/50 text-amber-300 hover:text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
                            >
                                <span>⏱️</span>
                                <span>Continuar em Hora Extra (Requer Gestor)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showLotSelectionModal && (
                <LotSelectionModal
                    onClose={() => setShowLotSelectionModal(false)}
                    stock={(() => {
                        const selectedIds = (Array.isArray(activeOrder?.selectedLotIds) ? activeOrder.selectedLotIds : [])
                            .map((l: any) => typeof l === 'string' ? l : l?.lotId)
                            .filter(Boolean);
                        const processedIds = (activeOrder?.processedLots || []).map(p => p.lotId);
                        const currentActiveId = activeOrder?.activeLotProcessing?.lotId;
                        const usedLotIds = new Set([...selectedIds, ...processedIds, currentActiveId].filter(Boolean));

                        const allowedBitolas = new Set<number>();

                        // 1. Tentar obter a bitola de entrada explicitamente definida na OP
                        if (activeOrder?.inputBitola) {
                            const bNum = parseBitolaFloat(activeOrder.inputBitola);
                            if (bNum !== null) {
                                allowedBitolas.add(bNum);
                            }
                        }

                        // 2. Se a OP já tiver lotes vinculados (pré-selecionados ou processados), pegar as bitolas deles
                        usedLotIds.forEach(id => {
                            const lot = stock.find(s => s.id === id);
                            if (lot && lot.bitola) {
                                const bNum = parseBitolaFloat(lot.bitola);
                                if (bNum !== null) {
                                    allowedBitolas.add(bNum);
                                }
                            }
                        });

                        const filteredStock = stock.filter(lot => {
                            const isAlreadyUsed = usedLotIds.has(lot.id);
                            if (isAlreadyUsed) return false;

                            const isFioMaquina = normalizeStr(lot.materialType) === 'fio maquina';
                            if (!isFioMaquina) return false;

                            // Se tivermos bitolas permitidas determinadas pela OP, filtramos estritamente por elas
                            if (allowedBitolas.size > 0) {
                                const lotBitolaNum = parseBitolaFloat(lot.bitola);
                                return lotBitolaNum !== null && allowedBitolas.has(lotBitolaNum);
                            }
                            return true;
                        });
                        return filteredStock;
                    })()}
                    onSelect={(lotIds) => {
                        if (activeOrder && addLotToOrder) {
                            addLotToOrder(activeOrder.id, lotIds as any);
                            setShowLotSelectionModal(false);
                        }
                    }}
                />
            )}
            {showBitolaCheck && (
                <BitolaCheckModal onClose={() => {
                    setShowBitolaCheck(false);
                    if (!hasPermission('trefilaInProgress') && !isGestor) {
                        setPage('menu');
                    }
                }} />
            )}

            {/* Modal de Visualização Somente Leitura dos Porta-Rolos (Sem Burlar Parada) */}
            {showReadOnlyStandsModal && activeMachine.startsWith('Treliça') && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[90] p-3 sm:p-6 animate-fade-in">
                    <div className="bg-[#0A1622] rounded-3xl border border-white/10 shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-cyan-500/20 rounded-2xl text-cyan-400 text-xl font-bold border border-cyan-500/30">
                                    👁️
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                            Visualização dos Porta-Rolos ({activeMachine})
                                        </h3>
                                        <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                                            🔒 Somente Leitura
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        A máquina continua em operação. Para carregar ou descarregar bobinas, realize a parada por <strong>"Troca de Rolo"</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowReadOnlyStandsModal(false);
                                        if (logDowntime && activeOrder) {
                                            logDowntime(activeOrder.id, 'Troca de Rolo');
                                        } else {
                                            setShowDowntimeModal(true);
                                        }
                                    }}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-md flex items-center gap-1.5"
                                >
                                    <span>⏸️</span>
                                    <span>Parar Máquina p/ Trocar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowReadOnlyStandsModal(false)}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                                >
                                    <XCircleIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <TrelicaSpoolStands
                            machineName={activeMachine}
                            stock={stock}
                            activeOrder={activeOrder}
                            productionOrders={productionOrders}
                            currentUser={currentUser}
                            readOnly={true}
                        />
                    </div>
                </div>
            )}

            {/* Modal do Gêmeo Digital da Cabeça de Solda (7 Eletrodos) */}
            {showElectrodesModal && activeMachine.startsWith('Treliça') && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[105] p-3 sm:p-6 animate-fade-in">
                    <div className="w-full max-w-7xl max-h-[92vh] overflow-y-auto custom-scrollbar">
                        <TrelicaWeldingHead
                            machineName={activeMachine}
                            readOnly={!isMachineStopped && !isGestor}
                            onClose={() => setShowElectrodesModal(false)}
                            stock={stock}
                            gauges={gauges}
                        />
                    </div>
                </div>
            )}



            {/* Machine Header for better context on mobile */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">{machineHeader}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1 w-8 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Logado como: <span className="text-indigo-600 font-black">{currentUser?.username}</span>
                        </span>
                    </div>
                </div>
                
                {/* Machine Selector Dropdown - ONLY SHOWN FOR GESTORS */}
                {isGestor && (
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setPage('downtimeConfigs')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-indigo-700 shadow-sm whitespace-nowrap"
                        >
                            <AdjustmentsIcon className="h-4 w-4" />
                            Configurar Paradas
                        </button>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Maq:</label>
                            <div className="relative">
                                <select
                                    value={activeMachine}
                                    onChange={(e) => setActiveMachine(e.target.value as MachineType)}
                                    className="appearance-none bg-slate-100 hover:bg-slate-200 border-none rounded-xl py-2 px-4 pr-10 text-sm font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer outline-none"
                                >
                                    {machineType.startsWith('Trefila') ? (
                                        <>
                                            <option value="Trefila 1">TREFILA 1</option>
                                            <option value="Trefila 2">TREFILA 2</option>
                                        </>
                                    ) : machineType.startsWith('Treliça') ? (
                                        <>
                                            <option value="Treliça 1">TRELIÇA 1</option>
                                            <option value="Treliça 2">TRELIÇA 2</option>
                                        </>
                                    ) : (
                                        <option value={machineType}>{machineType}</option>
                                    )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {view === 'dashboard' && (
                <div className="space-y-6">
                    {activeOrder && !hasActiveShift && (
                        <div className="bg-white p-6 rounded-xl shadow-sm text-center border-2 border-slate-100">
                            {currentOperatorLog?.pendingOperatorCheckin ? (
                                <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-6 rounded-2xl border-2 border-amber-500/40 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-500 text-3xl font-black mx-auto mb-3 animate-pulse">
                                        ⚡
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-3 py-1 rounded-full inline-block mb-2">
                                        Turno Aberto pelo Sistema • Aguardando Check-in
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 mb-1">
                                        {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4 max-w-md mx-auto">
                                        Abertura oficial realizada às <strong className="text-slate-900">{new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>. Faça o check-in para assumir o posto de trabalho.
                                    </p>
                                    <button
                                        onClick={() => handleStartShift()}
                                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-3.5 px-8 rounded-xl transition text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center gap-2 mx-auto"
                                    >
                                        <span>👤</span>
                                        <span>Fazer Check-in e Assumir Posto</span>
                                    </button>
                                </div>
                            ) : isAnyActiveShift ? (
                                <>
                                    <h3 className="text-xl font-semibold text-slate-800 mb-2">A ordem <span className="font-bold text-slate-600">{activeOrder.orderNumber}</span> está sendo operada por <span className="text-indigo-600 font-bold uppercase">{currentOperatorLog?.operator}</span>.</h3>
                                    <p className="text-slate-500 mb-4 text-sm">
                                        {isGestor
                                            ? "Você pode acompanhar o progresso em tempo real ou iniciar um turno auxiliar."
                                            : "Aguarde o encerramento do turno atual para iniciar o seu ou acompanhe no painel."}
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button onClick={() => setView('in_progress')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-lg transition shadow-lg shadow-slate-200">
                                            Acompanhar Painel
                                        </button>
                                        {isGestor && (
                                            <button onClick={() => handleStartShift()} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold py-2 px-6 rounded-lg border border-emerald-100 transition">
                                                Iniciar Meu Turno (Gestor)
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-xl font-semibold text-slate-800 mb-4">A ordem <span className="font-bold text-slate-600">{activeOrder.orderNumber}</span> está aguardando operador.</h3>
                                    <button onClick={() => handleStartShift()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition text-lg shadow-lg shadow-emerald-100">
                                        Iniciar Meu Turno
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    {activeOrder && (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white mb-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ordem Ativa</p>
                                    <h3 className="text-3xl font-black tracking-tighter">#{activeOrder.orderNumber}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                                        {statusStyle.label}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Operador</p>
                                    <p className="font-bold">{isAnyActiveShift ? currentOperatorLog?.operator : (currentUser?.username || '---')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Progresso</p>
                                    <p className="font-bold">
                                        {activeMachine.startsWith('Trefila')
                                            ? `${shiftProducedTotal} Lotes (Turno Atual)`
                                            : `${shiftProducedTotal} / ${activeOrder.quantityToProduce} Pçs (Turno Atual)`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {hasPermission(getPermissionPage('InProgress')) && (
                            <MachineMenuButton
                                onClick={() => setView('in_progress')}
                                label={postProductionOrder ? "Acompanhar" : "Painel"}
                                description={postProductionOrder ? "Pós-Produção" : "Em Produção"}
                                icon={<CogIcon className={`h-6 w-6 ${activeOrder ? 'animate-spin' : ''}`} />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Pending')) && (
                            <MachineMenuButton
                                onClick={() => setView('pending')}
                                label="Fila"
                                description="Próximos"
                                icon={<ClipboardListIcon className="h-6 w-6" />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Completed')) && (
                            <MachineMenuButton
                                onClick={() => setView('completed')}
                                label="Histórico"
                                description="Finalizados"
                                icon={<ArchiveIcon className="h-6 w-6" />}
                            />
                        )}
                        {hasPermission(getPermissionPage('Reports')) && (
                            <MachineMenuButton
                                onClick={() => setShowShiftReportsModal(true)}
                                label="Turnos"
                                description="Relatórios"
                                icon={<DocumentReportIcon className="h-6 w-6" />}
                            />
                        )}
                        {activeMachine.startsWith('Trefila') && hasPermission('trefilaRings') && (
                            <MachineMenuButton
                                onClick={() => setShowTrefilaCalculation(true)}
                                label="Simulação"
                                description="Anéis & K-7"
                                icon={<CalculatorIcon className="h-6 w-6" />}
                            />
                        )}
                        {activeMachine.startsWith('Trefila') && (
                            <MachineMenuButton
                                onClick={() => setShowBitolaCheck(true)}
                                label="Conferir Bitola"
                                description="Calculadora Rápida"
                                icon={<ScaleIcon className="h-6 w-6" />}
                            />
                        )}
                    </div>
                </div>
            )}
            {view === 'in_progress' && (
                <>
                    {/* Mobile Tab Switcher */}
                    {(activeOrder || postProductionOrder) && (
                        <div className="flex md:hidden mb-6 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                            <button
                                onClick={() => setMobileTab('monitor')}
                                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'monitor' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                            >
                                <ChartBarIcon className={`h-3.5 w-3.5 ${mobileTab === 'monitor' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                PAINEL
                            </button>
                            {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                <>
                                    <button
                                        onClick={() => setMobileTab('process')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'process' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                    >
                                        <PlayIcon className={`h-3.5 w-3.5 ${mobileTab === 'process' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                        Processar
                                    </button>
                                    <button
                                        onClick={() => setMobileTab('weigh')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'weigh' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                    >
                                        <ScaleIcon className={`h-3.5 w-3.5 ${mobileTab === 'weigh' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                        Pesagem
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setMobileTab('work')}
                                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'work' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                                >
                                    <ScaleIcon className={`h-3.5 w-3.5 ${mobileTab === 'work' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    Pesagem
                                </button>
                            )}
                            <button
                                onClick={() => setMobileTab('performance')}
                                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-tight transition-all duration-200 ${mobileTab === 'performance' ? 'bg-white shadow-md text-slate-900 border border-slate-100' : 'text-slate-500'}`}
                            >
                                <ChartBarIcon className={`h-3.5 w-3.5 ${mobileTab === 'performance' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                Performance
                            </button>
                        </div>
                    )}

                    {activeOrder ? (
                        <>
                            {!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !authorizedOvertimeForCurrentShift && (
                                <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">⚠️</span>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                                                {shiftEvaluation.isHoliday 
                                                    ? `Hoje é Feriado / Folga (${shiftEvaluation.holidayName || 'Feriado'})` 
                                                    : shiftEvaluation.isEarlyStart 
                                                        ? `Início Antecipado (${shiftStatus.workStart})` 
                                                        : `Horário Extraordinário (${shiftStatus.shiftLabel})`}
                                            </p>
                                            <p className="text-[11px] text-slate-600 font-medium">
                                                A operação deste posto neste horário requer autorização prévia de um gestor.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowManagerAuthForOvertimeStart(true)}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase rounded-xl transition shadow-md shrink-0"
                                    >
                                        Autorizar com Senha do Gestor
                                    </button>
                                </div>
                            )}
                            {activeOrder?.pendingAutoCloseReview && !activeOrder.pendingAutoCloseReview.reviewed && (
                                <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-indigo-500/15 border-2 border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm text-xl font-bold">
                                            ⏰
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                                <span>Turno Anterior Encerrado pelo Sistema</span>
                                                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Pendente de Conferência</span>
                                            </p>
                                            <p className="text-xs text-slate-700 font-medium mt-0.5">
                                                O último turno de <strong>{activeOrder.pendingAutoCloseReview.operator || 'Operador'}</strong> encerrou automaticamente às <strong>{new Date(activeOrder.pendingAutoCloseReview.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong> com <strong>{(activeOrder.pendingAutoCloseReview.closedQty || 0).toLocaleString('pt-BR')} {activeMachine.startsWith('Trefila') ? 'kg' : 'pçs'}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAutoCloseReviewQty(activeOrder.pendingAutoCloseReview?.closedQty || 0);
                                                setAutoCloseReviewNote('');
                                                setShowAutoCloseReviewModal(true);
                                            }}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>✏️ Retificar Peças Finais</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (reviewAutoClosedShiftQuantity) {
                                                    await reviewAutoClosedShiftQuantity(activeOrder.id, activeOrder.pendingAutoCloseReview?.closedQty || 0, 'Confirmado pelo operador sem alteração.');
                                                }
                                            }}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>✅ Está Correto</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20 md:pb-8 w-full max-w-full overflow-x-hidden">
                                {/* Coluna Esquerda: Visão Geral e Indicadores */}
                                <div className={`lg:col-span-1 min-w-0 max-w-full space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                    {/* Trefila Mobile: Optimized Panel (Enchuto) */}
                                    {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                        <div className="md:hidden animate-fade-in space-y-4">
                                            {/* Status Hero - Hidden on mobile as per user request (will move info to bottom button) */}
                                            <div className={`hidden md:relative overflow-hidden p-6 rounded-[2rem] transition-all duration-700 ${
                                                isActiveProcess ? 'bg-emerald-600 shadow-lg shadow-emerald-100' : 'bg-amber-500 shadow-lg shadow-amber-100'
                                            }`}>
                                                <div className="absolute -right-8 -top-8 p-4 opacity-10">
                                                    {isActiveProcess ? <PlayIcon className="h-32 w-32 text-white" /> : <PauseIcon className="h-32 w-32 text-white" />}
                                                </div>
                                                
                                                <div className="relative z-10 flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Máquina {machineType}</span>
                                                    <h2 className="text-3xl font-black text-white tracking-tighter">
                                                        {isActiveProcess ? 'PRODUZINDO' : 'PARADA'}
                                                    </h2>
                                                    
                                                    {activeLotProcessingData && (
                                                        <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between">
                                                            <div>
                                                                <span className="text-[8px] font-black text-white/60 uppercase block">Lote Atual</span>
                                                                <span className="text-sm font-bold text-white italic">{activeLotProcessingData.lotInfo.internalLot}</span>
                                                            </div>
                                                            <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                                                                <div className="w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Minimal Stats Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bitola</span>
                                                    <span className="text-xl font-black text-slate-800">{activeOrder.targetBitola} <span className="text-[10px] text-slate-300">mm</span></span>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Meta Turno</span>
                                                    <span className="text-xl font-black text-slate-800">20.000 <span className="text-[10px] text-slate-300">kg</span> <span className="text-[10px] text-slate-400 ml-1">/ 10 Lts</span></span>
                                                </div>
                                            </div>

                                            {/* Acesso Rápido para Gestor Adicionar Lotes à OP (Mobile) */}
                                            <div className="bg-gradient-to-r from-slate-900 via-[#0B1A24] to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-4 shadow-xl text-white flex items-center justify-between gap-3 animate-fade-in">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-2xl shadow-inner shrink-0">
                                                        📦
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                                                            Matéria-Prima da OP
                                                        </span>
                                                        <span className="text-sm font-black text-white font-mono">
                                                            {waitingLots.length} lotes na fila • {(activeOrder.selectedLotIds || []).length} total
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenAddLots}
                                                    className="px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 transition cursor-pointer shrink-0 border border-indigo-400/40"
                                                    title="Acrescentar mais lotes do estoque à Ordem em Produção para aumentar a meta a produzir"
                                                >
                                                    <span>➕</span>
                                                    <span>Adicionar Lotes</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // ORIGINAL CONTENT FOR TRELIÇA OR DESKTOP
                                        <div className={`space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                            {currentOperatorLog?.pendingOperatorCheckin && (
                                                <div className="bg-amber-500/20 border-2 border-amber-500/60 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 animate-pulse">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-amber-500/30 p-2.5 rounded-xl text-amber-400 font-bold shrink-0 text-xl">
                                                            ⚡
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                                                                    Turno Aberto (Sistema)
                                                                </span>
                                                                <span className="text-xs text-amber-300 font-mono font-bold">
                                                                    {shiftStatus.shiftName} ({shiftStatus.shiftLabel})
                                                                </span>
                                                            </div>
                                                            <h4 className="text-slate-800 font-black text-base mt-0.5">
                                                                Aguardando Check-in do Operador
                                                            </h4>
                                                            <p className="text-slate-600 text-xs">
                                                                Faça o check-in para registrar sua atuação neste posto.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleStartShift()}
                                                        className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-md transition shrink-0"
                                                    >
                                                        👤 Fazer Check-in
                                                    </button>
                                                </div>
                                            )}
                                            {isShiftOverdue && (
                                                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 shadow-sm flex items-start gap-4 animate-pulse">
                                                    <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0">
                                                        <ExclamationIcon className="h-8 w-8" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-red-700 font-black text-lg">⚠️ Fim de Turno!</h4>
                                                        <p className="text-red-600 text-xs font-bold mt-1 leading-relaxed">
                                                            Horário encerrado. Finalize o turno.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Card de Atualização Rápida no Celular (Treliça e Malha) */}
                                            {(activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) && (
                                                <div className="md:hidden bg-gradient-to-r from-slate-900 via-[#0B1A24] to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-4 shadow-xl text-white flex items-center justify-between gap-3 animate-fade-in">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-2xl shadow-inner shrink-0">
                                                            ⚡
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                                                                Peças do Seu Turno
                                                            </span>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-3xl font-black text-white font-mono leading-none">
                                                                    {Math.max(0, (activeOrder.actualProducedQuantity || 0) - (currentOperatorLog?.startQuantity || 0))}
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-300 uppercase">pçs</span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    (Total OP: {activeOrder.actualProducedQuantity || 0})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowQuantityPrompt(true)}
                                                        className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-950/60 transition cursor-pointer shrink-0 border border-indigo-400/40"
                                                    >
                                                        <span>📊</span>
                                                        <span>Lançar</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Card de Status Principal - Novo Design Pulsante */}
                                            <div 
                                                onClick={() => {
                                                    if (isUnderStopAlerta && activeOrder) {
                                                        setShowDowntimeModal(true);
                                                    }
                                                }}
                                                title={isUnderStopAlerta ? "Clique para abrir o Menu Operacional de Paradas / Troca de Rolo" : undefined}
                                                className={`p-6 rounded-3xl border-4 transition-all duration-1000 ${
                                                    isActiveProcess ? 'bg-emerald-50 border-emerald-500/50 animate-producing-pulse shadow-[0_0_30px_rgba(16,185,129,0.2)]' :
                                                    isUnderStopAlerta ? 'bg-rose-50 border-rose-500/50 animate-stop-pulse shadow-[0_0_30px_rgba(244,63,94,0.2)] cursor-pointer hover:border-amber-400 hover:shadow-amber-500/20' :
                                                    'bg-white border-slate-100'
                                                } hidden md:block`}>
                                                <div className="flex items-center gap-6">
                                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-transform duration-500 ${
                                                        isActiveProcess ? 'bg-emerald-600 rotate-12 scale-110' :
                                                        isUnderStopAlerta ? 'bg-rose-600 -rotate-12 scale-110' :
                                                        'bg-slate-200'
                                                    }`}>
                                                        {isActiveProcess ? <PlayIcon className="h-10 w-10 text-white" /> : 
                                                        isUnderStopAlerta ? <PauseIcon className="h-10 w-10 text-white" /> : 
                                                        <CogIcon className="h-10 w-10 text-slate-400" />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                                                            isActiveProcess ? 'text-emerald-600' :
                                                            isUnderStopAlerta ? 'text-rose-600' :
                                                            'text-slate-400'
                                                        }`}>Status em Tempo Real</p>
                                                        <h2 className={`text-2xl font-black tracking-tighter ${
                                                            isActiveProcess ? 'text-emerald-900' :
                                                            isUnderStopAlerta ? 'text-rose-900' :
                                                            'text-slate-800'
                                                        }`}>
                                                            {isActiveProcess ? 'PRODUZINDO' : isUnderStopAlerta ? 'PARADA' : 'DESLIGADA'}
                                                        </h2>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className={`h-2 w-2 rounded-full animate-pulse ${isActiveProcess ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                                {statusStyle.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {activeLotProcessingData && (
                                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center shadow-sm">
                                                            <div>
                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lote Atual</p>
                                                                <p className="text-xl font-black text-slate-800 tracking-tighter italic">{activeLotProcessingData.lotInfo.internalLot}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xl font-black text-emerald-700">{activeLotProcessingData.lotInfo.labelWeight?.toFixed(0) || '-'}kg</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                            {/* Card OP Mini */}
                                            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:block' : ''}`}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ordem de Produção</p>
                                                        <p className="text-2xl font-black text-slate-900 tracking-tighter">#{activeOrder.orderNumber}</p>
                                                    </div>
                                                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                        <ClipboardListIcon className="h-6 w-6 text-slate-400" />
                                                    </div>
                                                </div>
                                            </div>
                                    </div>

                                {/* Coluna Direita: Métricas e Controles de Produção */}
                                    <div className={`lg:col-span-2 min-w-0 max-w-full space-y-4 md:space-y-6 ${(mobileTab !== 'monitor' && mobileTab !== 'performance') ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                        <div className={`grid grid-cols-1 gap-6 ${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:grid' : 'grid'}`}>
                                                {/* Header Info - Simplified for Mobile */}
                                                <div className="col-span-2">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-2 uppercase tracking-widest font-bold">Produção do Turno</p>
                                                    {currentOperatorLog ? (
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <span className="text-sm md:text-base font-black text-slate-800 bg-white border border-slate-200 shadow-sm px-4 py-1.5 rounded-lg">
                                                                {isAnyActiveShift ? currentOperatorLog.operator : (currentUser?.username || 'Sem operador')}
                                                            </span>
                                                            <span className="text-xs font-black bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-200 uppercase tracking-widest shadow-sm">
                                                                {shiftStatus.shiftName}
                                                            </span>
                                                            <span className="md:hidden text-lg font-black text-slate-800 bg-white border border-slate-200 px-4 py-1.5 rounded-lg shadow-sm">
                                                                {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? `${activeOrder.targetBitola} mm` : activeOrder.trelicaModel}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-400 bg-white border px-3 py-1 rounded-lg">Sem operador</span>
                                                    )}
                                                </div>
                                                <div className="hidden md:block">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-1">Bitola Saída</p>
                                                    <p className="text-sm md:text-base font-semibold text-slate-700">{activeOrder.targetBitola}</p>
                                                </div>
                                                <div className="hidden md:block">
                                                    <p className="text-[10px] md:text-xs text-slate-500 mb-1">Meta</p>
                                                    <p className="text-sm md:text-base font-semibold text-slate-700">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? `${activeOrder.quantityToProduce?.toFixed(0) || activeOrder.totalWeight?.toFixed(0) || '20.000'} kg` : `${activeOrder.totalWeight?.toFixed(0) || 0} kg`}</p>
                                                </div>
                                                {(activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) && (
                                                    <div className="hidden md:flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={handleOpenAddLots}
                                                            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-900/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                                                            title="Acrescentar mais lotes do estoque à Ordem em Produção para aumentar a meta a produzir"
                                                        >
                                                            <span>➕</span>
                                                            <span>Adicionar Lotes à OP</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>



                                    {/* Card de Estoque de Anéis (Críticos) - Novo */}
                                    {activeMachine.startsWith('Trefila') && ringStock.filter(r => r.quantity < 3).length > 0 && (
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500">
                                                <ExclamationIcon className="h-12 w-12" />
                                            </div>
                                            <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <ExclamationIcon className="h-4 w-4" />
                                                Alerta de Estoque (Anéis)
                                            </h3>
                                            <div className="space-y-3">
                                                {ringStock
                                                    .filter(r => r.quantity < 3)
                                                    .slice(0, 3)
                                                    .map(ring => (
                                                        <div key={ring.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700 text-sm">{ring.model}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase font-black">Necessita Reposição</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-lg font-black text-amber-600">{ring.quantity}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase font-black ml-1">un</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                {ringStock.filter(r => r.quantity < 3).length > 3 && (
                                                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">+ {ringStock.filter(r => r.quantity < 3).length - 3} itens com estoque baixo</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Progresso de Produção - VISÍVEL APENAS NA ABA DE PERFORMANCE NO MOBILE OU SEMPRE NO DESKTOP */}
                                    <div className={`bg-white p-6 rounded-2xl shadow-sm relative overflow-hidden group ${mobileTab === 'performance' ? 'block' : 'hidden lg:block'}`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                                            <ChartBarIcon className="h-16 w-16" />
                                        </div>

                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                Performance de Produção
                                            </div>
                                            {/* Mobile Compact Stats Highlights */}
                                            <div className="md:hidden flex gap-3">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Lotes:</span>
                                                    <span className="text-[10px] font-black text-slate-700">{(activeOrder.processedLots || []).length}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">KG:</span>
                                                    <span className="text-[10px] font-black text-emerald-600">
                                                        {(activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </h3>

                                        {(activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) ? (
                                            <div className="space-y-6">
                                                <div className="relative pt-2">
                                                    <div className="flex items-end justify-between mb-3">
                                                        <div>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Peças no Turno</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowQuantityPrompt(true)}
                                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
                                                                        title="Lançar ou atualizar contagem de peças do turno agora"
                                                                    >
                                                                        <span>⚡</span>
                                                                        <span>Lançar Peças</span>
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                                                        {Math.max(0, (activeOrder.actualProducedQuantity || 0) - (currentOperatorLog?.startQuantity || 0))}
                                                                    </span>
                                                                    <span className="text-2xl font-black text-slate-300 uppercase tracking-widest">pçs</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progresso Total da Ordem</span>
                                                                    <div className="flex items-baseline gap-1.5">
                                                                        <span className="text-lg font-black text-slate-600">{activeOrder.actualProducedQuantity || 0}</span>
                                                                        <span className="text-xs font-bold text-slate-300">/ {activeOrder.quantityToProduce}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md mb-1">Peças Concluídas</span>
                                                            <span className="text-xs font-bold text-slate-400">Progresso da Ordem</span>
                                                        </div>
                                                    </div>
                                                    {(() => {
                                                        const produced = activeOrder.actualProducedQuantity || 0;
                                                        const planned = activeOrder.quantityToProduce || 1;
                                                        const progress = Math.min(100, (produced / planned) * 100);
                                                        return (
                                                            <div className="w-full bg-slate-100 rounded-2xl h-8 overflow-hidden p-1 border border-slate-50">
                                                                <div
                                                                    className="bg-indigo-600 h-full rounded-xl transition-all duration-1000 ease-out flex items-center justify-end pr-3 shadow-lg shadow-indigo-100 relative overflow-hidden"
                                                                    style={{ width: `${progress}%` }}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                                                    {progress > 12 && <span className="text-white text-[10px] font-black uppercase tracking-tighter">{progress.toFixed(0)}%</span>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="relative pt-2">
                                                    <div className="flex items-end justify-between mb-3">
                                                        <div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">KG no Turno</span>
                                                                <div className="flex items-baseline gap-3">
                                                                    <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                                                                        {(() => {
                                                                            if (!currentOperatorLog) return 0;
                                                                            const shiftStart = new Date(currentOperatorLog.startTime).getTime();
                                                                            const shiftLots = (activeOrder.processedLots || []).filter(l => l.endTime && new Date(l.endTime).getTime() >= shiftStart);
                                                                            return shiftLots.reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0);
                                                                        })()}
                                                                    </span>
                                                                    <span className="text-2xl font-black text-slate-300 uppercase tracking-widest">kg</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progresso da Ordem</span>
                                                                    <div className="flex items-baseline gap-1.5">
                                                                        <span className="text-lg font-black text-slate-600">
                                                                            {(activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0).toFixed(0)}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-slate-300">/ {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? '20.000' : activeOrder.totalWeight?.toFixed(0) || 0} kg</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md mb-1">
                                                                Lotes Concluídos
                                                            </span>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-black text-slate-700 tracking-tighter">{(activeOrder.processedLots || []).length}</span>
                                                                <span className="text-xs font-bold text-slate-300">
                                                                    / {(() => {
                                                                        const raw = activeOrder.selectedLotIds || [];
                                                                        return Array.isArray(raw) ? raw.length : 0;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                <div className="w-full bg-slate-100 rounded-2xl h-8 overflow-hidden p-1 border border-slate-50">
                                                    {(() => {
                                                        const produced = (activeOrder.processedLots || []).reduce((acc, lot) => acc + (lot.finalWeight || 0), 0);
                                                        const planned = activeOrder.totalWeight || 1;
                                                        const progress = Math.min(100, (produced / planned) * 100);
                                                        return (
                                                            <div
                                                                className="bg-indigo-600 h-full rounded-xl transition-all duration-1000 ease-out flex items-center justify-end pr-3 shadow-lg shadow-indigo-100 relative overflow-hidden"
                                                                style={{ width: `${progress}%` }}
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                                                {progress > 12 && <span className="text-white text-[10px] font-black uppercase tracking-tighter">{progress.toFixed(0)}%</span>}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Mobile Collapsible Details */}
                                    {(activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) && (
                                        <div className="md:hidden">
                                            <details className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
                                                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                        <ClockIcon className="h-4 w-4" /> Ver Detalhes Adicionais
                                                    </span>
                                                    <ChevronDownIcon className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="p-4 pt-0 space-y-6 animate-fade-in">
                                                    {hasActiveShift && (
                                                        <div className="bg-slate-900 p-6 rounded-xl shadow-lg">
                                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                                                <span>Tempo de Operação</span>
                                                                <ClockIcon className="h-4 w-4 text-slate-600" />
                                                            </h3>
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-baseline">
                                                                    <p className="font-mono text-white font-black text-3xl tracking-tighter">{shiftStatus.timeStatusText}</p>
                                                                    {shiftStatus.isOvertime && <span className="text-[10px] font-black bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/30">EXTRA</span>}
                                                                </div>
                                                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                    <div className={`h-full transition-all duration-700 ${shiftStatus.isOvertime ? 'bg-red-500' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} style={{ width: `${shiftStatus.progress}%` }}></div>
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-widest">{shiftStatus.shiftName}: {shiftStatus.shiftLabel}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="bg-slate-50 p-4 rounded-xl">
                                                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                                            <ClockIcon className="h-5 w-5 text-amber-500" /> Histórico de Paradas
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {activeOrder.downtimeEvents && activeOrder.downtimeEvents.length > 0 ? (
                                                                [...activeOrder.downtimeEvents].reverse().slice(0, 3).map((event, index) => {
                                                                    const stop = new Date(event.stopTime);
                                                                    const resume = event.resumeTime ? new Date(event.resumeTime) : new Date();
                                                                    const durationMs = resume.getTime() - stop.getTime();
                                                                    return (
                                                                        <div key={index} className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                                                                            <span className="font-bold text-slate-700 truncate mr-2">{event.reason}</span>
                                                                            <span className="font-mono text-slate-500 whitespace-nowrap">{formatDuration(durationMs)}</span>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="text-center text-slate-400 italic">Sem paradas.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>
                                    )}

                                    {/* Progresso visível apenas em desktop ou se não for Trefila Mobile */}
                                    <div className={`${activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'hidden md:block' : 'block'}`}>
                                        {/* Performance Section contents... kept for desktop */}
                                    </div>
                                    </div>
                                {/* Coluna Direita: Área de Trabalho (Lotes/Pacotes) */}
                                <div className={`lg:col-span-2 min-w-0 max-w-full space-y-6 relative ${mobileTab === 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>

                                    {activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (
                                        <>
                                            {/* OS Tracking - Desbobinadeira */}
                                            {activeMachine.startsWith('Desbobinadeira') && (() => {
                                                const osItems = (activeOrder as any)?.osItems || [];
                                                const osProgress = (activeOrder as any)?.osProgress || { logs: [] };
                                                const osLogs = osProgress.logs || [];
                                                const completedOsLabels = new Set(osLogs.map((l: any) => l.os));
                                            
                                                const pendingOsItems = osItems.filter((item: any, idx: number) => !completedOsLabels.has(item.os) && !completedOsLabels.has(`OS ${idx + 1}`));
                                                const completedOsItems = osItems.filter((item: any, idx: number) => completedOsLabels.has(item.os) || completedOsLabels.has(`OS ${idx + 1}`));
                                            
                                                // Find the searched OS
                                                const searchedOsObj = osSearchTerm.trim() 
                                                    ? osItems.find((item: any, idx: number) => {
                                                        const term = osSearchTerm.trim().toLowerCase();
                                                        const itemName = (item.os || `OS ${idx + 1}`).toLowerCase();
                                                        return itemName === term || itemName.replace(/^os\s*/, '') === term;
                                                      })
                                                    : null;
                                            
                                                const searchedOsIndex = searchedOsObj 
                                                    ? osItems.indexOf(searchedOsObj)
                                                    : -1;
                                            
                                                // Check if searched OS is already completed or in progress
                                                const isSearchedCompleted = searchedOsObj ? completedOsLabels.has(searchedOsObj.os) : false;
                                                const isSearchedActive = searchedOsObj && osProgress.currentOs === (searchedOsObj.os);
                                            
                                                return (
                                                    <div className={`space-y-4 sm:space-y-6 ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                        {/* Buscador de OS */}
                                                        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
                                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                                                                <div>
                                                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                                                        <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">🔍</span> Buscar OS
                                                                    </h3>
                                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Digite apenas o número ou nome da OS</p>
                                                                </div>
                                                                {osProgress.currentOs && (
                                                                    <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto justify-between sm:justify-start gap-3 bg-indigo-50 border border-indigo-200 p-3 sm:px-4 rounded-xl shadow-sm mt-3 sm:mt-0">
                                                                        <div className="flex justify-between items-center w-full sm:w-auto">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Em Corte</span>
                                                                                <span className="text-sm font-black text-indigo-900">{osProgress.currentOs}</span>
                                                                            </div>
                                                                            <span className="font-mono font-black text-xl text-indigo-600 px-2 sm:hidden">{formatDuration(osElapsed * 1000)}</span>
                                                                        </div>
                                                                        <div className="w-px h-6 bg-indigo-200 hidden sm:block"></div>
                                                                        <span className="font-mono font-black text-xl text-indigo-600 px-1 sm:px-2 hidden sm:block">{formatDuration(osElapsed * 1000)}</span>
                                                                        <button
                                                                            onClick={handleFinishOs}
                                                                            className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-[10px] font-black py-3 sm:py-2 px-3 sm:px-4 rounded-lg transition active:scale-95 shadow-md uppercase tracking-widest"
                                                                        >
                                                                            Finalizar OS
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                            
                                                            <div className="flex gap-2 sm:gap-4 mb-2">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={osSearchTerm}
                                                                    onChange={(e) => setOsSearchTerm(e.target.value)}
                                                                    placeholder="Ex: 1"
                                                                    className="flex-1 p-3 sm:p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-base sm:text-lg font-black text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all uppercase"
                                                                />
                                                            </div>
                                                            {osSearchTerm && !searchedOsObj && (
                                                                <div className="mb-2 sm:mb-4 inline-flex items-center text-rose-500 text-[10px] sm:text-[11px] font-black tracking-widest uppercase bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                                                    ⚠ OS Não Encontrada
                                                                </div>
                                                            )}
                                            
                                                            {/* Card de Confirmação */}
                                                            {searchedOsObj && (
                                                                <div className="mt-4 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-100 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
                                                                    <div className="absolute -right-4 -top-4 opacity-5 sm:opacity-10 text-indigo-600">
                                                                        <ClipboardListIcon className="h-24 w-24 sm:h-32 sm:w-32" />
                                                                    </div>
                                                                    <h4 className="text-xs sm:text-sm font-black text-indigo-800 uppercase tracking-widest mb-3 sm:mb-4 relative z-10">Confirmar Dados da OS</h4>
                                                                    
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 relative z-10">
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Número</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800 truncate">{searchedOsObj.os || `OS ${searchedOsIndex + 1}`}</span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bitola</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800">{searchedOsObj.bitola || '-'} <span className="text-[10px] text-slate-400">mm</span></span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Formato</span>
                                                                            <span className="text-lg sm:text-xl font-black text-slate-800 truncate">{searchedOsObj.drawingType || '-'}</span>
                                                                        </div>
                                                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 flex flex-col justify-center text-center sm:text-left">
                                                                            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quantidade</span>
                                                                            <span className="text-lg sm:text-xl font-black text-indigo-600">{searchedOsObj.quantity || '-'} <span className="text-[10px] text-indigo-400">pçs</span></span>
                                                                        </div>
                                                                    </div>
                                            
                                                                    <div className="relative z-10">
                                                                        {isSearchedCompleted ? (
                                                                            <div className="w-full text-center py-2.5 sm:py-3 bg-emerald-100 text-emerald-700 font-black rounded-xl border border-emerald-200 uppercase tracking-widest text-xs sm:text-sm shadow-sm">
                                                                                ✓ Concluída
                                                                            </div>
                                                                        ) : isSearchedActive ? (
                                                                            <div className="w-full text-center py-2.5 sm:py-3 bg-indigo-100 text-indigo-700 font-black rounded-xl border border-indigo-200 uppercase tracking-widest text-xs sm:text-sm shadow-sm animate-pulse">
                                                                                ⏳ Em Corte
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    handleStartOs(searchedOsIndex);
                                                                                    setOsSearchTerm(''); // Limpar ao iniciar
                                                                                }}
                                                                                disabled={!!osProgress.currentOs}
                                                                                className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-black py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-lg shadow-slate-300 transition active:scale-[0.99] uppercase tracking-widest disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none flex items-center justify-center gap-2 text-xs sm:text-sm"
                                                                            >
                                                                                <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" /> Aceitar e Iniciar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                            
                                                        {/* Tabelas de Acompanhamento */}
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* OS Pendentes */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full max-h-[500px]">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pendentes
                                                                    </h4>
                                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg">{pendingOsItems.length} OS</span>
                                                                </div>
                                                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                                                    {pendingOsItems.length === 0 ? (
                                                                        <div className="text-center text-slate-400 py-10 italic text-sm font-semibold">Nenhuma OS pendente.</div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            {pendingOsItems.map((item: any, idx: number) => {
                                                                                const isCurrent = osProgress.currentOs === item.os;
                                                                                return (
                                                                                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${isCurrent ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100'} hover:bg-slate-100 transition-colors`}>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                                                                                                <ClipboardListIcon className={`h-4 w-4 ${isCurrent ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="block font-black text-slate-800 text-xs">{item.os}</span>
                                                                                                <span className="text-[10px] font-bold text-slate-400">{item.quantity} pçs • {item.bitola}mm</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {isCurrent && <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-widest animate-pulse">Em Corte</span>}
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                            
                                                            {/* OS Concluídas */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full max-h-[500px]">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Concluídas
                                                                    </h4>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase">{completedOsItems.reduce((acc: number, i: any) => acc + (i.weight || 0), 0).toFixed(1).replace('.', ',')} kg</span>
                                                                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-100">{completedOsItems.length} OS</span>
                                                                    </div>
                                                                </div>
                                                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                                                    {completedOsItems.length === 0 ? (
                                                                        <div className="text-center text-slate-400 py-10 italic text-sm font-semibold">Nenhuma OS concluída ainda.</div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            {completedOsItems.map((item: any, idx: number) => {
                                                                                const logEntry = osLogs.find((l: any) => l.os === item.os || l.os === `OS ${idx + 1}`);
                                                                                return (
                                                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/30 border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 rounded-lg bg-white border border-emerald-100 flex items-center justify-center">
                                                                                                <span className="text-emerald-500 font-black text-[10px]">✓</span>
                                                                                            </div>
                                                                                            <div>
                                                                                                <span className="block font-black text-slate-800 text-xs">{item.os}</span>
                                                                                                <span className="text-[10px] font-bold text-slate-400">{item.quantity} pçs • {item.bitola}mm</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {logEntry && (
                                                                                            <div className="text-right">
                                                                                                <span className="block text-xs font-mono font-black text-emerald-600">{formatDuration(logEntry.durationSeconds * 1000)}</span>
                                                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Tempo</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className={`bg-white p-6 rounded-2xl shadow-sm ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                    <CogIcon className="h-6 w-6 text-slate-400" /> Lote em Processamento
                                                </h3>
                                                {activeLotProcessingData ? (
                                                    <div className={`p-6 border rounded-xl transition-all duration-500 ${activeLotProcessingData.isDelayed ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100'}`}>
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                            <div>
                                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${
                                                                    activeLotProcessingData.isDelayed 
                                                                        ? 'bg-red-500 text-white' 
                                                                        : activeLotProcessingData.isPaused
                                                                            ? 'bg-amber-500 text-white'
                                                                            : 'text-indigo-500 bg-indigo-100'
                                                                }`}>
                                                                    {activeLotProcessingData.isDelayed 
                                                                        ? '⚠ LOTE ATRASADO' 
                                                                        : activeLotProcessingData.isPaused
                                                                            ? `⏸️ PAUSADO (${activeLotProcessingData.pauseReason || 'PARADA'})`
                                                                            : 'Em Andamento'}
                                                                </span>
                                                                <h4 className={`text-2xl font-bold mt-2 ${activeLotProcessingData.isDelayed ? 'text-red-700' : 'text-slate-800'}`}>
                                                                    {activeLotProcessingData.lotInfo?.internalLot || activeLotProcessingData.lotId} 
                                                                    <span className="text-sm font-black text-slate-400 ml-2 italic">
                                                                        • {activeLotProcessingData.lotInfo?.initialQuantity?.toLocaleString('pt-BR') || '0'} KG
                                                                    </span>
                                                                </h4>
                                                                <div className="flex flex-wrap gap-4 mt-2">
                                                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                                                        <ClockIcon className="h-4 w-4" /> Iniciado às {activeLotProcessingData.startTime ? new Date(activeLotProcessingData.startTime).toLocaleTimeString('pt-BR') : '--:--'}
                                                                    </p>
                                                                    {activeLotProcessingData.speed && (
                                                                        <p className={`text-sm font-bold flex items-center gap-2 ${activeLotProcessingData.isDelayed ? 'text-red-600' : 'text-indigo-600'}`}>
                                                                            <ChartBarIcon className="h-4 w-4" /> {activeLotProcessingData.speed.toString().replace('.', ',')} m/s
                                                                        </p>
                                                                    )}
                                                                    {activeLotProcessingData.estimatedTimeSeconds !== null && (
                                                                        <p className={`text-sm font-black flex items-center gap-2 px-3 py-1 rounded-lg border ${
                                                                            activeLotProcessingData.isDelayed 
                                                                                ? 'text-red-700 bg-red-100 border-red-200' 
                                                                                : activeLotProcessingData.isPaused
                                                                                    ? 'text-amber-800 bg-amber-50 border-amber-200'
                                                                                    : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                                                        }`}>
                                                                            <ClockIcon className="h-4 w-4" /> 
                                                                            {activeLotProcessingData.isDelayed 
                                                                                ? 'Atraso: ' 
                                                                                : activeLotProcessingData.isPaused 
                                                                                    ? 'Tempo Rest. (Pausado): ' 
                                                                                    : 'Tempo Est.: '}
                                                                            {activeLotProcessingData.isDelayed 
                                                                                ? formatDuration((activeLotProcessingData.elapsedUptimeSeconds - ((activeLotProcessingData.lotInfo?.initialQuantity || 0) / (parseFloat(activeOrder?.targetBitola?.replace(',', '.') || '1')**2 * 0.006162 * (activeLotProcessingData.speed || 1)))) * 1000)
                                                                                : formatDuration(activeLotProcessingData.estimatedTimeSeconds * 1000)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button onClick={handleFinishLotProcess} disabled={isEmergencyStopped || (!hasActiveShift && !isGestor)} className={`w-full md:w-auto font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none ${activeLotProcessingData.isDelayed ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}>
                                                                <CheckCircleIcon className="h-5 w-5" /> Finalizar Lote
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-slate-400 py-12 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                        <h4 className="font-medium text-lg">Nenhum lote sendo processado</h4>
                                                        <p className="text-sm mt-1">Selecione um lote da fila abaixo para iniciar.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`bg-white p-6 rounded-2xl shadow-sm ${mobileTab !== 'process' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-700">Fila de Lotes (Matéria-Prima)</h3>
                                                        <p className="text-xs text-slate-400">Lotes de Fio Máquina reservados para processamento nesta ordem</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleOpenAddLots}
                                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-indigo-900/20 transition active:scale-95 cursor-pointer"
                                                        title="Acrescentar mais lotes do estoque à Ordem em Produção para aumentar a meta a produzir"
                                                    >
                                                        <span className="text-sm">➕</span>
                                                        <span>Adicionar Lotes à OP (Gestor)</span>
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    {waitingLots.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {waitingLots.map(lot => (
                                                                <div key={lot.id} className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition bg-slate-50 group">
                                                                    <div className="flex justify-between items-start mb-3">
                                                                        <span className="font-bold text-slate-700 text-lg">{lot.internalLot}</span>
                                                                        <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-md font-mono">{lot.initialQuantity?.toFixed(1) || '-'} kg</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleStartProcessingLot(lot.id)}
                                                                        disabled={!!activeLotProcessingData || isEmergencyStopped || (!hasActiveShift && !isGestor)}
                                                                        className="w-full bg-white border-2 border-slate-200 text-slate-600 group-hover:border-indigo-500 group-hover:text-indigo-600 font-bold py-2 px-4 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        Processar
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-slate-500 py-6">Nenhum lote aguardando.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm ${mobileTab !== 'weigh' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                                <h3 className="text-lg font-bold text-slate-700 mb-4">Lotes Finalizados</h3>
                                                <div className="overflow-x-auto max-h-80">
                                                    {/* Desktop Table */}
                                                    <table className="w-full text-sm hidden sm:table border-separate border-spacing-0">
                                                        <thead className="bg-slate-50 text-left sticky top-0 z-10">
                                                            <tr className="text-[10px] text-slate-400 uppercase tracking-widest">
                                                                <th className="p-3 font-black border-b border-slate-100">Lote</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-right">KG Entrada</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-right">KG Saída</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-center">Bitola</th>
                                                                <th className="p-3 font-black border-b border-slate-100 text-center">Status</th>
                                                                <th className="p-3 font-black border-b border-slate-100">Ação</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {[...completedLots].reverse().map(lot => {
                                                                const isEditing = editingLotId === lot.lotId;
                                                                const isWaiting = lot.finalWeight === null || lot.measuredGauge === null || lot.measuredGauge === undefined;
                                                                const waitingMs = isWaiting ? now.getTime() - new Date(lot.endTime).getTime() : 0;
                                                                const targetBitolaPlaceholder = activeOrder.targetBitola ? activeOrder.targetBitola : '0.00';

                                                                return (
                                                                    <tr key={lot.lotId} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-amber-50/50' : ''}`}>
                                                                        <td className="p-3 font-bold text-slate-700">{lot.lotInfo?.internalLot}</td>
                                                                        <td className="p-3 text-right text-slate-500 font-medium">{lot.lotInfo?.initialQuantity?.toFixed(0) || '-'} kg</td>
                                                                        <td className="p-3">
                                                                            {(isWaiting || isEditing) ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        className="w-3/4 p-2 border-2 border-slate-200 rounded-lg text-center focus:border-indigo-500 bg-white transition font-bold text-xs"
                                                                                        placeholder={lot.lotInfo?.initialQuantity ? String(lot.lotInfo.initialQuantity) : "0.0"}
                                                                                        value={pendingWeights?.get(lot.lotId) ?? (isEditing && lot.finalWeight ? String(lot.finalWeight) : '')}
                                                                                        onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                                    />
                                                                                    <span className="text-[10px] font-bold text-slate-400">kg</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-right font-black text-slate-900">{lot.finalWeight?.toFixed(1) || '-'} kg</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3">
                                                                            {(isWaiting || isEditing) ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        className="w-3/4 p-2 border-2 border-slate-200 rounded-lg text-center focus:border-indigo-500 bg-white transition font-bold text-xs text-indigo-700"
                                                                                        placeholder={targetBitolaPlaceholder}
                                                                                        value={pendingGauges?.get(lot.lotId) ?? (isEditing && lot.measuredGauge ? Number(lot.measuredGauge).toFixed(2) : '')}
                                                                                        onChange={e => handlePendingGaugeChange(lot.lotId, e.target.value)}
                                                                                    />
                                                                                    <span className="text-[10px] font-bold text-slate-400">mm</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center font-bold text-slate-700">{lot.measuredGauge?.toFixed(2) || '-'} mm</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            {isWaiting ? (
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="text-[9px] font-black text-amber-600 animate-pulse uppercase leading-none">Aguardando</span>
                                                                                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{formatDuration(waitingMs)}</span>
                                                                                </div>
                                                                            ) : isEditing ? (
                                                                                <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">Editando</span>
                                                                            ) : (
                                                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Concluído</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3">
                                                                            {(isWaiting || isEditing) ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <button
                                                                                        onClick={() => handleRecordWeight(lot.lotId)}
                                                                                        disabled={!hasActiveShift && !isGestor}
                                                                                        className="bg-emerald-500 text-white text-[10px] font-black py-2 px-3 rounded-lg hover:bg-emerald-600 w-full shadow-lg shadow-emerald-100 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                                                                    >
                                                                                        SALVAR
                                                                                    </button>
                                                                                    {isEditing && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleCancelEditLot(lot.lotId)}
                                                                                            className="p-2 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                                                                                            title="Cancelar edição"
                                                                                        >
                                                                                            ✕
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <div className="bg-slate-100 text-slate-400 p-1.5 rounded-lg" title="Concluído">
                                                                                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleStartEditLot(lot)}
                                                                                        disabled={!hasActiveShift && !isGestor}
                                                                                        className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
                                                                                        title="Ajustar / Corrigir Peso ou Bitola deste lote"
                                                                                    >
                                                                                        ✏️
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card List */}
                                                    <div className="flex flex-col gap-3 sm:hidden">
                                                        {[...completedLots].reverse().map(lot => {
                                                            const isEditing = editingLotId === lot.lotId;
                                                            const isWaiting = lot.finalWeight == null || lot.measuredGauge == null;
                                                            const waitingMs = isWaiting ? timer.getTime() - new Date(lot.endTime).getTime() : 0;
                                                            const targetBitolaPlaceholder = activeOrder.targetBitola ? activeOrder.targetBitola : '0.00';

                                                            return (
                                                                <div key={lot.lotId} className={`bg-white border-2 p-4 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden ${isEditing ? 'border-amber-300 bg-amber-50/20' : 'border-slate-100'}`}>
                                                                    {!isWaiting && !isEditing && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase">Concluído</div>}
                                                                    {isEditing && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase">Editando</div>}

                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <h4 className="font-black text-slate-800 text-xl">{lot.lotInfo?.internalLot}</h4>
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Entrada: {lot.lotInfo?.initialQuantity?.toFixed(0) || '-'} kg</p>
                                                                        </div>
                                                                        {isWaiting && (
                                                                            <div className="text-right">
                                                                                <span className="text-[8px] font-black text-amber-500 uppercase block leading-none">Aguardando</span>
                                                                                <span className="text-xs font-mono font-bold text-slate-400">{formatDuration(waitingMs)}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Peso Saída (kg)</label>
                                                                            {(isWaiting || isEditing) ? (
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 outline-none transition uppercase text-xs"
                                                                                    placeholder={lot.lotInfo?.initialQuantity ? String(lot.lotInfo.initialQuantity) : "0.0"}
                                                                                    value={pendingWeights?.get(lot.lotId) ?? (isEditing && lot.finalWeight ? String(lot.finalWeight) : '')}
                                                                                    onChange={e => handlePendingWeightChange(lot.lotId, e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                <div className="p-3 bg-slate-50 rounded-xl text-center font-black text-slate-800 text-lg">{lot.finalWeight?.toFixed(1) || '-'}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bitola (mm)</label>
                                                                            {(isWaiting || isEditing) ? (
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 outline-none transition uppercase text-indigo-700 text-xs"
                                                                                    placeholder={targetBitolaPlaceholder}
                                                                                    value={pendingGauges?.get(lot.lotId) ?? (isEditing && lot.measuredGauge ? Number(lot.measuredGauge).toFixed(2) : '')}
                                                                                    onChange={e => handlePendingGaugeChange(lot.lotId, e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                <div className="p-3 bg-slate-50 rounded-xl text-center font-black text-slate-800 text-lg">{lot.measuredGauge?.toFixed(2) || '-'}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {(isWaiting || isEditing) ? (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => handleRecordWeight(lot.lotId)}
                                                                                disabled={!hasActiveShift && !isGestor}
                                                                                className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-100 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                                                            >
                                                                                <CheckCircleIcon className="h-6 w-6" />
                                                                                {isEditing ? 'SALVAR ALTERAÇÃO' : 'SALVAR PESAGEM (OK)'}
                                                                            </button>
                                                                            {isEditing && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleCancelEditLot(lot.lotId)}
                                                                                    className="px-4 bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition"
                                                                                >
                                                                                    Cancelar
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStartEditLot(lot)}
                                                                            disabled={!hasActiveShift && !isGestor}
                                                                            className="w-full py-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                                                                        >
                                                                            <span>✏️</span>
                                                                            <span>Ajustar Peso ou Bitola</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : activeMachine.startsWith('Malha') && activeOrder ? (
                                        <>
                                            <MalhaActiveLotsCard
                                                machineName={activeMachine}
                                                activeOrder={activeOrder}
                                                stock={stock}
                                            />
                                            <MalhaPackagesOperatorPanel
                                                op={activeOrder}
                                                stock={stock}
                                                shiftReports={shiftReports}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                                            <span>📦 Registro de Pacotes</span>
                                                            <span className="text-xs font-normal text-slate-400 font-sans">(200 pçs / pct)</span>
                                                        </h3>
                                                        <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                                            {trelicaPackages.filter(p => p.status === 'Concluído').length} de {trelicaPackages.length} concluídos
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                                                        ⚖️ Digite o peso do pacote e pressione Enter ou clique em Salvar
                                                    </span>
                                                </div>

                                                <div className="overflow-auto max-h-[520px] md:border border-slate-100 rounded-xl">
                                                    {/* Desktop Table View */}
                                                    <table className="w-full text-sm hidden md:table">
                                                        <thead className="bg-slate-50 text-left sticky top-0 z-10">
                                                            <tr>
                                                                <th className="p-4 font-bold text-slate-600">Pacote #</th>
                                                                <th className="p-4 font-bold text-slate-600">Qtd.</th>
                                                                <th className="p-4 font-bold text-slate-600">Peso (kg)</th>
                                                                <th className="p-4 font-bold text-slate-600 text-center">Ação</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {(() => {
                                                                const nextPendingPkgNum = trelicaPackages.find(p => p.status !== 'Concluído')?.packageNumber;
                                                                return trelicaPackages.map(pkg => {
                                                                    const isNext = pkg.packageNumber === nextPendingPkgNum;
                                                                    return (
                                                                        <tr 
                                                                            key={pkg.packageNumber} 
                                                                            className={
                                                                                pkg.status === 'Concluído' 
                                                                                    ? 'bg-slate-50/50' 
                                                                                    : isNext 
                                                                                        ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' 
                                                                                        : 'bg-white'
                                                                            }
                                                                        >
                                                                            <td className="p-4 font-bold text-slate-700 text-lg">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>#{pkg.packageNumber}</span>
                                                                                    {isNext && (
                                                                                        <span className="text-[9px] font-black uppercase bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                                                            Próximo
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-4 text-slate-600 font-medium">{pkg.quantity} pçs</td>
                                                                            <td className="p-4">
                                                                                {pkg.status === 'Concluído' ? (
                                                                                    <span className="font-mono font-black text-slate-800 text-lg">{pkg.weight?.toFixed(2)} kg</span>
                                                                                ) : (
                                                                                    <div className="relative max-w-xs">
                                                                                        <input
                                                                                            type="text"
                                                                                            inputMode="decimal"
                                                                                            value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                            onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                            onKeyDown={e => {
                                                                                                if (e.key === 'Enter') {
                                                                                                    e.preventDefault();
                                                                                                    handleRecordPackageWeight(pkg.packageNumber, pkg.quantity);
                                                                                                }
                                                                                            }}
                                                                                            className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:border-indigo-500 focus:ring-0 transition"
                                                                                            placeholder="0.00"
                                                                                        />
                                                                                        <span className="absolute right-3 top-3.5 text-slate-400 text-sm font-bold">kg</span>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-4 text-center">
                                                                                {pkg.status === 'Concluído' ? (
                                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 uppercase tracking-wide">
                                                                                        ✓ OK
                                                                                    </span>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                                        className="bg-indigo-600 text-white text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-indigo-700 shadow-md transition w-full max-w-xs active:scale-95"
                                                                                    >
                                                                                        Salvar
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Card View for Packages */}
                                                    <div className="flex flex-col gap-3 md:hidden pb-4">
                                                        {(() => {
                                                            const nextPendingPkgNum = trelicaPackages.find(p => p.status !== 'Concluído')?.packageNumber;
                                                            return trelicaPackages.map(pkg => {
                                                                const isNext = pkg.packageNumber === nextPendingPkgNum;
                                                                return (
                                                                    <div 
                                                                        key={pkg.packageNumber} 
                                                                        className={`p-3.5 rounded-2xl border-2 transition ${
                                                                            pkg.status === 'Concluído' 
                                                                                ? 'bg-slate-50/70 border-slate-100' 
                                                                                : isNext 
                                                                                    ? 'bg-white border-indigo-400 shadow-md ring-2 ring-indigo-100' 
                                                                                    : 'bg-white border-slate-200 shadow-sm'
                                                                        }`}
                                                                    >
                                                                        <div className="flex justify-between items-center mb-2.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`w-8 h-8 flex items-center justify-center rounded-xl font-bold text-sm ${
                                                                                    pkg.status === 'Concluído' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white shadow-sm'
                                                                                }`}>
                                                                                    #{pkg.packageNumber}
                                                                                </span>
                                                                                <span className="text-slate-500 font-medium text-xs">{pkg.quantity} peças</span>
                                                                                {isNext && (
                                                                                    <span className="text-[9px] font-black uppercase bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                                                        Próximo
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {pkg.status === 'Concluído' && (
                                                                                <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg text-xs uppercase tracking-wide">
                                                                                    <CheckCircleIcon className="h-4 w-4" /> Registrado
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {pkg.status === 'Concluído' ? (
                                                                            <div className="flex items-end justify-between pt-1 border-t border-slate-100">
                                                                                <span className="text-xs text-slate-400 uppercase font-bold">Peso Registrado</span>
                                                                                <span className="text-xl font-mono font-black text-slate-700">{pkg.weight?.toFixed(2)} <span className="text-xs">kg</span></span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex gap-2 items-end pt-1">
                                                                                <div className="flex-1 relative">
                                                                                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Peso (kg)</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        value={pendingPackageWeights.get(pkg.packageNumber) || ''}
                                                                                        onChange={e => handlePendingPackageWeightChange(pkg.packageNumber, e.target.value)}
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter') {
                                                                                                e.preventDefault();
                                                                                                handleRecordPackageWeight(pkg.packageNumber, pkg.quantity);
                                                                                            }
                                                                                        }}
                                                                                        className="w-full h-12 pl-3 pr-10 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:border-indigo-500 focus:ring-0 transition"
                                                                                        placeholder="0.00"
                                                                                    />
                                                                                    <span className="absolute right-3 top-7 text-slate-400 text-xs font-bold">kg</span>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleRecordPackageWeight(pkg.packageNumber, pkg.quantity)}
                                                                                    className="h-12 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition flex items-center justify-center gap-1.5"
                                                                                >
                                                                                    <CheckCircleIcon className="h-5 w-5" />
                                                                                    <span className="font-bold text-sm">Salvar</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                            </div>
                        </div>

                        {orderForShift && (
                                <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 px-3 py-2 md:p-4 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-40 transition-all duration-500 safe-area-bottom">
                                <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">

                                    {/* Esquerda: Info Rápida (Desktop only) */}
                                    <div className="hidden md:flex items-center gap-4 w-1/4">
                                        <div className={`w-1.5 h-10 rounded-full ${isMachineStopped ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`}></div>
                                        <div className="truncate">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Status em Tempo Real</p>
                                            <p className={`text-sm font-black leading-tight truncate ${isMachineStopped ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                {isMachineStopped ? 'MÁQUINA PARADA' : 'ESTADO ATIVO'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Centro: Controles Principais e Mobile Menu */}
                                    <div className="flex-1 md:flex-none flex items-center justify-center md:w-1/2">
                                        {!isAnyActiveShift ? (
                                            <button
                                                onClick={() => handleStartShift(false)}
                                                className="w-full md:w-auto md:px-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl md:rounded-full font-black text-lg shadow-xl shadow-emerald-200 transition transform active:scale-90 flex items-center justify-center gap-3 animate-pulse"
                                            >
                                                <PlayIcon className="h-8 w-8" />
                                                <span className="inline tracking-tight">INICIAR TURNO</span>
                                            </button>
                                        ) : (
                                            <div className="w-full md:w-auto flex relative items-center gap-2">
                                                <button
                                                    onClick={isMachineStopped ? (() => { 
                                                        if (!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !authorizedOvertimeForCurrentShift) {
                                                            setPendingResumeAfterAuth(true);
                                                            setShowManagerAuthForOvertimeStart(true);
                                                            return;
                                                        }
                                                        if (activeOrder && logResumeProduction) logResumeProduction(activeOrder.id); 
                                                    }) : (() => setShowDowntimeModal(true))}
                                                    className={`w-full h-24 md:h-20 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all duration-500 shadow-2xl relative overflow-hidden group border-[3px]
                                                        ${isMachineStopped 
                                                            ? 'bg-rose-600 shadow-rose-200 animate-stop-pulse border-rose-400 active:scale-95' 
                                                            : 'bg-emerald-600 shadow-emerald-200 animate-producing-pulse border-emerald-400 active:scale-95'
                                                        }`}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                    <div className="relative z-10 flex items-center gap-3">
                                                        {isMachineStopped ? (
                                                            <PlayIcon className="h-10 w-10 text-white animate-bounce-horizontal" />
                                                        ) : (
                                                            <PauseIcon className="h-10 w-10 text-white" />
                                                        )}
                                                        <span className="text-2xl font-black text-white uppercase tracking-tighter">
                                                            {isMachineStopped ? 'RETOMAR PRODUÇÃO' : 'PARAR MÁQUINA'}
                                                        </span>
                                                    </div>
                                                    <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 bg-black/20 rounded-full backdrop-blur-md border border-white/10">
                                                        <ClockIcon className="h-5 w-5 text-white/80" />
                                                        <span className="text-lg font-black text-white font-mono tracking-widest">
                                                            {statusDurationString}
                                                        </span>
                                                    </div>
                                                </button>

                                                {isMachineStopped && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowDowntimeModal(true)}
                                                        className="h-24 md:h-20 px-4 rounded-3xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs uppercase flex flex-col items-center justify-center gap-1.5 shadow-xl active:scale-95 transition border-2 border-amber-500/50 flex-shrink-0"
                                                        title="Abrir Menu Operacional (Troca de Rolo, etc.)"
                                                    >
                                                        <PauseIcon className="h-6 w-6 text-amber-400" />
                                                        <span className="text-[10px] font-black tracking-wider text-center leading-tight whitespace-nowrap">Menu de<br/>Paradas</span>
                                                    </button>
                                                )}

                                                {/* Botão Rápido de Atualização de Peças no Celular (Treliça e Malha) */}
                                                {(activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowQuantityPrompt(true)}
                                                        className="h-24 md:hidden px-3.5 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex flex-col items-center justify-center gap-1 shadow-xl shadow-indigo-950/40 active:scale-95 transition border-2 border-indigo-400/50 flex-shrink-0 cursor-pointer"
                                                        title="Atualização Rápida de Peças do Turno"
                                                    >
                                                        <span className="text-xl animate-pulse">⚡</span>
                                                        <span className="text-[10px] font-black tracking-wider text-center leading-tight whitespace-nowrap">Atualizar<br/>Peças</span>
                                                    </button>
                                                )}
                                                
                                                {/* Botão Split (Seta) Menu para Mobile da Trefila */}
                                                <button
                                                    onClick={() => setShowMobileActions(!showMobileActions)}
                                                    className={`h-16 md:h-14 w-12 md:hidden border-4 border-l-0 flex items-center justify-center rounded-r-2xl transition-colors ${
                                                        isMachineStopped 
                                                            ? 'bg-rose-700 hover:bg-rose-600 border-rose-400 shadow-rose-500/40 text-rose-100'
                                                            : 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 shadow-emerald-500/40 text-emerald-100'
                                                    }`}
                                                >
                                                    <ChevronDownIcon className={`w-8 h-8 transition-transform ${showMobileActions ? 'rotate-180' : ''}`} />
                                                </button>

                                                {/* Dropdown Menu Mobile */}
                                                {showMobileActions && (
                                                    <div className="absolute bottom-full right-0 mb-3 bg-white p-2 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col min-w-[220px] border border-slate-100 divide-y divide-slate-100 animate-fade-in-up z-50">
                                                        <button
                                                            onClick={() => {
                                                                setShowMobileActions(false);
                                                                if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) handleTrefilaComplete();
                                                                else setShowCompletionModal(true);
                                                            }}
                                                            disabled={isCompletionDisabled}
                                                            className="p-3 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-3 transition disabled:opacity-30 rounded-t-xl"
                                                        >
                                                            <CheckCircleIcon className="h-6 w-6 text-slate-500" />
                                                            <span>Fechar OP</span>
                                                        </button>

                                                        {(activeMachine.startsWith('Treliça') || activeMachine.startsWith('Malha')) && (
                                                            <button
                                                                onClick={() => {
                                                                    setShowMobileActions(false);
                                                                    setShowQuantityPrompt(true);
                                                                }}
                                                                className="p-3 text-indigo-600 hover:bg-indigo-50/50 font-bold flex items-center gap-3 transition"
                                                            >
                                                                <span className="text-xl">⚡</span>
                                                                <span>Lançar Peças</span>
                                                            </button>
                                                        )}

                                                        {(activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) && (
                                                            <button
                                                                onClick={() => {
                                                                    setShowMobileActions(false);
                                                                    handleOpenAddLots();
                                                                }}
                                                                className="p-3 text-indigo-600 hover:bg-indigo-50/50 font-bold flex items-center gap-3 transition"
                                                            >
                                                                <span className="text-xl">📦</span>
                                                                <span>Adicionar Lotes (Gestor)</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => {
                                                                setShowMobileActions(false);
                                                                handleShiftEndRequest(orderForShift.id);
                                                            }}
                                                            className="p-3 text-amber-600 hover:bg-amber-50/50 font-bold flex items-center gap-3 transition"
                                                        >
                                                            <ClockIcon className="h-6 w-6 text-amber-500" />
                                                            <span>Encerrar Turno</span>
                                                        </button>

                                                        {isGestor && cancelProductionOrder && (
                                                            <button
                                                                onClick={() => {
                                                                    setShowMobileActions(false);
                                                                    setShowCancelConfirmation(true);
                                                                }}
                                                                className="p-3 text-rose-600 hover:bg-rose-50/50 font-bold flex items-center gap-3 transition rounded-b-xl"
                                                            >
                                                                <XCircleIcon className="h-6 w-6 text-rose-500" />
                                                                <span>Cancelar OP</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Direita: Ações Secundárias (Visível apenas no MD/Desktop) */}
                                    <div className="hidden md:flex items-center justify-end gap-1 sm:gap-4 w-auto md:w-1/4">
                                        <div className="h-8 w-px bg-slate-200/60 hidden md:block"></div>

                                        <button
                                            onClick={() => {
                                                if (activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira')) handleTrefilaComplete();
                                                else setShowCompletionModal(true);
                                            }}
                                            disabled={isCompletionDisabled}
                                            className="hidden md:flex bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 shadow-lg shadow-slate-200 transition items-center gap-2 disabled:opacity-30 disabled:grayscale active:scale-95"
                                        >
                                            <CheckCircleIcon className="h-5 w-5" />
                                            <span>FECHAR ORDEM</span>
                                        </button>

                                        {hasActiveShift && (
                                            <button
                                                onClick={() => handleShiftEndRequest(orderForShift.id)}
                                                className="p-3.5 text-red-500 hover:bg-red-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Finalizar Turno"
                                            >
                                                <ClockIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Encerrar</span>
                                            </button>
                                        )}

                                        {pauseProductionOrder && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const alreadyProduced = activeMachine.startsWith('Trefila') 
                                                        ? `${orderForShift.actualProducedWeight || orderForShift.totalProducedWeight || 0} kg` 
                                                        : `${orderForShift.actualProducedQuantity || 0} peças`;

                                                    const reason = window.prompt(
                                                        `⏸️ PAUSAR ORDEM #${orderForShift.orderNumber}?\n\nO apontamento atual (${alreadyProduced}) será mantido intacto.\n\nA máquina ficará LIVRE para iniciar outra ordem e esta ordem ficará guardada na fila para retomada.\n\nInforme o motivo da pausa:`,
                                                        'Interrompida para dar prioridade a outra OP'
                                                    );
                                                    if (reason !== null) {
                                                        pauseProductionOrder(orderForShift.id, reason);
                                                        setView('pending');
                                                    }
                                                }}
                                                className="p-3.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Pausar Ordem / Liberar Máquina para Outra OP"
                                            >
                                                <ArchiveIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase">Pausar OP</span>
                                            </button>
                                        )}

                                        {isGestor && cancelProductionOrder && (
                                            <button
                                                onClick={() => setShowCancelConfirmation(true)}
                                                className="p-3.5 text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-2xl transition active:scale-90 flex flex-col items-center gap-0.5"
                                                title="Cancelar Ordem de Produção"
                                            >
                                                <XCircleIcon className="h-7 w-7" />
                                                <span className="text-[8px] font-black uppercase font-black">Cancelar</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        </>
                    ) : postProductionOrder ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
                            <div className={`lg:col-span-1 space-y-6 ${mobileTab !== 'monitor' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                <div className="bg-white p-6 rounded-xl shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Informações do Turno</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-500">Nº Ordem Concluída:</span><span className="font-bold text-slate-800">{postProductionOrder.orderNumber}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Operador:</span><span className="font-bold text-slate-800">{currentOperatorLog?.operator || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Início Turno:</span><span className="font-bold text-slate-800">{currentOperatorLog ? new Date(currentOperatorLog.startTime).toLocaleTimeString('pt-BR') : 'N/A'}</span></div>
                                    </div>
                                </div>
                                {hasActiveShift && (
                                    <div className="bg-white p-6 rounded-xl shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2"><ClockIcon className="h-5 w-5" /> Status do Turno</h3>
                                        <div className="space-y-3">
                                            <div className="text-center">
                                                <p className="text-sm text-slate-500">{shiftStatus.shiftName}: {shiftStatus.shiftLabel}</p>
                                                {shiftStatus.isOvertime && <p className="text-sm font-bold text-red-500 animate-pulse">HORA EXTRA</p>}
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-4">
                                                <div className={`h-4 rounded-full ${shiftStatus.isOvertime ? 'bg-red-500' : 'bg-slate-600'}`} style={{ width: `${shiftStatus.progress}%` }}></div>
                                            </div>
                                            <p className="text-center font-mono text-slate-800 font-semibold">{shiftStatus.timeStatusText}</p>
                                            <button onClick={() => handleShiftEndRequest(postProductionOrder.id)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-2">
                                                <ClockIcon className="h-5 w-5" /> Finalizar Meu Turno
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`lg:col-span-2 space-y-6 ${mobileTab !== 'work' ? 'hidden lg:block' : 'animate-fade-in'}`}>
                                <IdleActivityLogger
                                    onLogActivity={(activity) => logPostProductionActivity && logPostProductionActivity(activity)}
                                    activities={[...(currentOperatorLog?.postProductionActivities || [])].reverse()}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-10 bg-white rounded-xl shadow-sm">
                            <WarningIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
                            <p>Nenhuma ordem em produção no momento.</p>
                        </div>
                    )}
                </>
            )
            }

            {
                view === 'pending' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        {pendingOrders && pendingOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Data Criação</th>
                                            <th className="px-6 py-3">Nº Ordem</th>
                                            <th className="px-6 py-3">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'Bitola Saída' : 'Modelo'}</th>
                                            <th className="px-6 py-3 text-right">Peso Total (kg)</th>
                                            <th className="px-6 py-3 text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingOrders.map(order => {
                                            const isOrderPaused = order.status === 'paused' || order.status === 'Pausada' || Boolean((order as any).isPaused) || Boolean(order.summary?.isPaused);
                                            const isTrefila = activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira');
                                            const prodQty = isTrefila 
                                                ? (order.actualProducedWeight || order.totalProducedWeight || 0)
                                                : (order.actualProducedQuantity || 0);

                                            return (
                                                <tr key={order.id} className={`border-b hover:bg-slate-50 ${isOrderPaused ? 'bg-amber-50/40' : 'bg-white'}`}>
                                                    <td className="px-6 py-4">
                                                        {isOrderPaused ? (
                                                            <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded uppercase border border-amber-300 flex items-center gap-1 w-fit">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                Pausada
                                                            </span>
                                                        ) : (
                                                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-0.5 rounded uppercase border border-slate-200">Fila</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">{new Date(order.creationDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 font-medium text-slate-900">
                                                        <span className="font-bold">#{order.orderNumber}#</span>
                                                        {isOrderPaused && prodQty > 0 ? (
                                                            <span className="block text-[11px] text-amber-700 mt-0.5 font-bold">
                                                                Saldo feito: {prodQty.toLocaleString('pt-BR')} {isTrefila ? 'kg' : 'pçs'}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-6 py-4">{isTrefila ? order.targetBitola : `${order.trelicaModel} (${order.quantityToProduce} pçs)`}</td>
                                                    <td className="px-6 py-4 text-right">{order.totalWeight?.toFixed(2) || 0}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                if (!shiftEvaluation.inShiftWindow && !isGestor && shiftEvaluation.requireManagerAuthForOvertime && !authorizedOvertimeForCurrentShift) {
                                                                    setPendingStartOrderId(order.id);
                                                                    setShowManagerAuthForOvertimeStart(true);
                                                                    return;
                                                                }
                                                                if (isOrderPaused && resumeProductionOrder) {
                                                                    resumeProductionOrder(order.id);
                                                                } else if (startProductionOrder) {
                                                                    startProductionOrder(order.id);
                                                                }
                                                                setView('in_progress');
                                                            }} 
                                                            className={`${isOrderPaused ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white font-bold py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 mx-auto shadow-sm active:scale-95`}
                                                        >
                                                            <PlayIcon className="h-4 w-4" /> 
                                                            <span>{isOrderPaused ? 'Retomar' : 'Iniciar'}</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10">
                                <WarningIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
                                <p>Nenhuma ordem de produção pendente encontrada.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {
                view === 'completed' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                        {completedOrders && completedOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3">Data Finalização</th>
                                            <th className="px-6 py-3">Nº Ordem</th>
                                            <th className="px-6 py-3">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? 'Bitola Saída' : 'Modelo'}</th>
                                            <th className="px-6 py-3 text-right">Peso Planejado (kg)</th>
                                            <th className="px-6 py-3 text-right">Peso Produzido (kg)</th>
                                            <th className="px-6 py-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedOrders.map(order => (
                                            <tr key={order.id} className="bg-white border-b hover:bg-slate-50">
                                                <td className="px-6 py-4">{order.endTime ? new Date(order.endTime).toLocaleDateString('pt-BR') : '-'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{order.orderNumber}</td>
                                                <td className="px-6 py-4">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? order.targetBitola : `${order.trelicaModel} (${order.actualProducedQuantity} pçs)`}</td>
                                                <td className="px-6 py-4 text-right">{activeMachine.startsWith('Trefila') || activeMachine.startsWith('Desbobinadeira') ? (order.totalWeight?.toFixed(2) || 0) : (order.plannedOutputWeight?.toFixed(2) || 'N/A')}</td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-700">{order.actualProducedWeight?.toFixed(2) || 'N/A'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => setProductionReportData(order)} className="text-emerald-600 hover:text-emerald-800 font-semibold py-1 px-3 rounded-md text-xs bg-emerald-50 border border-emerald-200">
                                                        Ver Relatório
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10">
                                <CheckCircleIcon className="h-12 w-12 mx-auto text-emerald-400 mb-2" />
                                <p>Nenhuma ordem de produção foi finalizada ainda.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {showResumePreviousStopModal && previousStopReason && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <WarningIcon className="h-8 w-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Máquina Parada!</h3>
                            <p className="text-slate-600 mb-6">
                                O turno anterior foi finalizado com a máquina parada pelo motivo: <br />
                                <span className="font-bold text-rose-600 block mt-1 text-lg">"{previousStopReason}"</span>
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => confirmResumePreviousStop(false)}
                                    className="flex-1 px-4 py-3 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition"
                                >
                                    Manter Parada
                                </button>
                                <button
                                    onClick={() => confirmResumePreviousStop(true)}
                                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-200 transition"
                                >
                                    Retomar Produção
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSpeedModal && (
                <MachineSpeedModal
                    initialSpeed={activeOrder?.targetSpeed}
                    onClose={() => {
                        setShowSpeedModal(false);
                        setSelectedLotForSpeed(null);
                    }}
                    onSubmit={confirmStartLot}
                />
            )}
        </div>
    );
};

export default MachineControl;