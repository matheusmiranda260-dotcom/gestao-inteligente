import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrelicaMachineElectrode, 
    TrelicaElectrodePosition, 
    TrelicaElectrodeType, 
    TrelicaElectrodeStock,
    TrelicaElectrodeHistory,
    StockItem,
    StockGauge,
    MaterialType,
    DefaultElectrodeGauges
} from '../types';
import { fetchTable, insertItem, updateItem } from '../services/supabaseService';

import { 
    CheckCircleIcon, 
    ExclamationIcon, 
    XIcon, 
    RefreshIcon, 
    AdjustmentsIcon, 
    ClockIcon,
    PlusIcon
} from './icons';



interface TrelicaWeldingHeadProps {
    machineName: string; // 'Treliça 1', 'Treliça 2'
    readOnly?: boolean;
    onClose?: () => void;
    onElectrodeChange?: () => void;
    stock?: StockItem[];
    gauges?: StockGauge[];
    onUpdateStockItem?: (item: StockItem) => void;
}

// Configuração das 12 posições (Bases e Eletrodos) com seus códigos 1000 a 1011
export const ELECTRODE_POSITIONS_CONFIG: {
    position: TrelicaElectrodePosition;
    label: string;
    type: TrelicaElectrodeType;
    shortLabel: string;
    benchmarkMeters: number;
    productCode: string;
    modelDescription: string;
}[] = [
    { position: 'superior_dir', label: 'Eletrodo Superior Direito', type: 'Superior', shortLabel: 'El Sup Dir', benchmarkMeters: 15000, productCode: '1000', modelDescription: 'eletrodo superior (d)' },
    { position: 'superior_esq', label: 'Eletrodo Superior Esquerdo', type: 'Superior', shortLabel: 'El Sup Esq', benchmarkMeters: 15000, productCode: '1001', modelDescription: 'eletrodo superior (e)' },
    { position: 'base_sup_dir', label: 'Base Superior Direita', type: 'Base Superior', shortLabel: 'Base Sup Dir', benchmarkMeters: 25000, productCode: '1002', modelDescription: 'base eletrodo superior (d)' },
    { position: 'base_sup_esq', label: 'Base Superior Esquerda', type: 'Base Superior', shortLabel: 'Base Sup Esq', benchmarkMeters: 25000, productCode: '1003', modelDescription: 'base eletrodo superior (e)' },
    { position: 'inferior_dir', label: 'Eletrodo Inferior Direito', type: 'Inferior', shortLabel: 'El Inf Dir', benchmarkMeters: 15000, productCode: '1004', modelDescription: 'eletrodo inferior (d)' },
    { position: 'inferior_esq', label: 'Eletrodo Inferior Esquerdo', type: 'Inferior', shortLabel: 'El Inf Esq', benchmarkMeters: 15000, productCode: '1005', modelDescription: 'eletrodo inferior (e)' },
    { position: 'base_inf_dir', label: 'Base Inferior Direita', type: 'Base Inferior', shortLabel: 'Base Inf Dir', benchmarkMeters: 25000, productCode: '1006', modelDescription: 'base eletrodo inferior (d)' },
    { position: 'base_inf_esq', label: 'Base Inferior Esquerda', type: 'Base Inferior', shortLabel: 'Base Inf Esq', benchmarkMeters: 25000, productCode: '1007', modelDescription: 'base eletrodo inferior (e)' },
    { position: 'central_triangular', label: 'Central Triangular', type: 'Central Triangular', shortLabel: 'Central △', benchmarkMeters: 12000, productCode: '1008', modelDescription: 'eletrodo central triangular' },
    { position: 'base_lateral', label: 'Base Lateral', type: 'Base Lateral', shortLabel: 'Base Lat', benchmarkMeters: 20000, productCode: '1009', modelDescription: 'base central geral' },
    { position: 'lateral_dir', label: 'Lateral Direita', type: 'Lateral', shortLabel: 'Lat Dir', benchmarkMeters: 15000, productCode: '1010', modelDescription: 'eletrodo da lateral da base (d)' },
    { position: 'lateral_esq', label: 'Lateral Esquerda', type: 'Lateral', shortLabel: 'Lat Esq', benchmarkMeters: 15000, productCode: '1011', modelDescription: 'eletrodo da lateral da base (e)' },
];

const STORAGE_PREFIX = 'trelica_machine_electrodes_';
const HISTORY_STORAGE_PREFIX = 'trelica_electrodes_history_';
const LEGACY_HISTORY_STORAGE_KEY = 'trelica_electrodes_history_cache';

export const saveLocalElectrodeHistory = (machineName: string, historyList: TrelicaElectrodeHistory[]) => {
    try {
        localStorage.setItem(`${HISTORY_STORAGE_PREFIX}${machineName}`, JSON.stringify(historyList));
        localStorage.setItem(LEGACY_HISTORY_STORAGE_KEY, JSON.stringify(historyList));
    } catch (e) {
        console.warn('Erro ao salvar histórico local de eletrodos:', e);
    }
};

export const getLocalElectrodeHistory = (machineName: string): TrelicaElectrodeHistory[] => {
    try {
        const stored = localStorage.getItem(`${HISTORY_STORAGE_PREFIX}${machineName}`);
        if (stored) {
            const parsed = JSON.parse(stored) as TrelicaElectrodeHistory[];
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const legacy = localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
        if (legacy) {
            const parsed = JSON.parse(legacy) as TrelicaElectrodeHistory[];
            if (Array.isArray(parsed)) {
                return parsed.filter(h => !h.machine_name || h.machine_name === machineName);
            }
        }
    } catch (e) {
        console.warn('Erro ao ler histórico local de eletrodos:', e);
    }
    return [];
};

export const getLocalMachineElectrodes = (machineName: string): TrelicaMachineElectrode[] => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${machineName}`);
        if (stored) {
            const parsed = JSON.parse(stored) as TrelicaMachineElectrode[];
            // Reconciliação: Garante que eletrodos e bases recém adicionados existam no localStorage
            const missingConfigs = ELECTRODE_POSITIONS_CONFIG.filter(cfg => !parsed.some(p => p.position === cfg.position));
            
            if (missingConfigs.length === 0) {
                return parsed;
            }

            const newElectrodes = [...parsed];
            missingConfigs.forEach(cfg => {
                const initialMeters = cfg.position === 'central_triangular' ? 7800 : (cfg.type === 'Base Superior' || cfg.type === 'Base Inferior') ? 3200 : cfg.position.startsWith('superior') ? 4200 : 2500;
                newElectrodes.push({
                    id: `el-pos-${machineName}-${cfg.position}`,
                    machine_name: machineName,
                    position: cfg.position,
                    position_label: cfg.label,
                    electrode_type: cfg.type,
                    lot_id: `lot-${cfg.productCode}-01`,
                    lot_number: `EL-${cfg.productCode}-01`,
                    installed_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
                    installed_by: 'Mecânica Turno A',
                    meters_produced: initialMeters,
                    pieces_produced: Math.round(initialMeters / 6),
                    benchmark_meters: cfg.benchmarkMeters,
                    status: initialMeters >= cfg.benchmarkMeters * 0.9 ? 'critical' : initialMeters >= cfg.benchmarkMeters * 0.7 ? 'warning' : 'active',
                    dress_count: 0
                });
            });
            saveLocalMachineElectrodes(machineName, newElectrodes);
            return newElectrodes;
        }
    } catch (e) {
        console.warn('Erro ao ler eletrodos locais:', e);
    }

    // Default inicial com eletrodos abastecidos
    const defaults: TrelicaMachineElectrode[] = ELECTRODE_POSITIONS_CONFIG.map(cfg => {
        const initialMeters = cfg.position === 'central_triangular' ? 7800 : (cfg.type === 'Base Superior' || cfg.type === 'Base Inferior') ? 3200 : cfg.position.startsWith('superior') ? 4200 : 2500;
        return {
            id: `el-pos-${machineName}-${cfg.position}`,
            machine_name: machineName,
            position: cfg.position,
            position_label: cfg.label,
            electrode_type: cfg.type,
            lot_id: `lot-${cfg.productCode}-01`,
            lot_number: `EL-${cfg.productCode}-01`,
            installed_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
            installed_by: 'Mecânica Turno A',
            meters_produced: initialMeters,
            pieces_produced: Math.round(initialMeters / 6),
            benchmark_meters: cfg.benchmarkMeters,
            status: initialMeters >= cfg.benchmarkMeters * 0.9 ? 'critical' : initialMeters >= cfg.benchmarkMeters * 0.7 ? 'warning' : 'active',
            dress_count: 0
        };
    });

    saveLocalMachineElectrodes(machineName, defaults);
    return defaults;
};

export const saveLocalMachineElectrodes = (machineName: string, electrodes: TrelicaMachineElectrode[]) => {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${machineName}`, JSON.stringify(electrodes));
    } catch (e) {
        console.warn('Erro ao salvar eletrodos locais:', e);
    }
};

export type ElectrodeOffsetsMap = Record<TrelicaElectrodePosition, { dx: number; dy: number }>;

const LAYOUT_OFFSETS_STORAGE_KEY = 'trelica_electrode_offsets_v1';

export const getSavedElectrodeOffsets = (): ElectrodeOffsetsMap => {
    try {
        const saved = localStorage.getItem(LAYOUT_OFFSETS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Erro ao carregar offsets de eletrodos:', e);
    }
    return {
        base_sup_esq: { dx: 0, dy: 0 },
        superior_esq: { dx: 0, dy: 0 },
        base_sup_dir: { dx: 0, dy: 0 },
        superior_dir: { dx: 0, dy: 0 },
        central_triangular: { dx: 0, dy: 0 },
        base_inf_esq: { dx: 0, dy: 0 },
        inferior_esq: { dx: 0, dy: 0 },
        base_inf_dir: { dx: 0, dy: 0 },
        inferior_dir: { dx: 0, dy: 0 },
        lateral_esq: { dx: 0, dy: 0 },
        lateral_dir: { dx: 0, dy: 0 },
        base_lateral: { dx: 0, dy: 0 }
    };
};

export const saveElectrodeOffsets = (offsets: ElectrodeOffsetsMap) => {
    try {
        localStorage.setItem(LAYOUT_OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
    } catch (e) {
        console.warn('Erro ao salvar offsets de eletrodos:', e);
    }
};

const TrelicaWeldingHead: React.FC<TrelicaWeldingHeadProps> = ({
    machineName,
    readOnly = false,
    onClose,
    onElectrodeChange,
    stock,
    gauges,
    onUpdateStockItem
}) => {
    const [electrodes, setElectrodes] = useState<TrelicaMachineElectrode[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<TrelicaElectrodePosition | null>(null);
    const [hoveredPosition, setHoveredPosition] = useState<TrelicaElectrodePosition | null>(null);
    const [electrodeStockList, setElectrodeStockList] = useState<StockItem[]>([]);
    const [stockFilterModel, setStockFilterModel] = useState<string>('all');
    const [stockSearchTerm, setStockSearchTerm] = useState<string>('');
    const [availableStock, setAvailableStock] = useState<TrelicaElectrodeStock[]>([]);
    const [history, setHistory] = useState<TrelicaElectrodeHistory[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Abas Principais: Gêmeo Digital, Relatórios & Histórico, Estoque Almoxarifado
    const [activeTab, setActiveTab] = useState<'digital_twin' | 'reports' | 'stock'>('digital_twin');

    // Modo Calibração / Ajuste Fino de Layout (Gestor)
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibTarget, setCalibTarget] = useState<TrelicaElectrodePosition | 'conjunto_base' | 'conjunto_sup_esq' | 'conjunto_sup_dir' | 'conjunto_inf_esq' | 'conjunto_inf_dir'>('conjunto_sup_esq');
    const [stepSize, setStepSize] = useState<number>(5);
    const [layoutOffsets, setLayoutOffsets] = useState<ElectrodeOffsetsMap>(getSavedElectrodeOffsets);
    const [savedNotification, setSavedNotification] = useState<string | null>(null);

    // Filtros para a Aba de Relatórios
    const [reportFilterPosition, setReportFilterPosition] = useState<string>('all');
    const [reportFilterType, setReportFilterType] = useState<string>('all');
    const [showManualRecordModal, setShowManualRecordModal] = useState(false);
    const [manualEntry, setManualEntry] = useState<{
        position: TrelicaElectrodePosition;
        reason: string;
        date: string;
        lotNumber: string;
        removedBy: string;
        destination: string;
        notes: string;
    }>({
        position: 'superior_dir',
        reason: 'Limpeza de Eletrodo',
        date: new Date().toISOString().slice(0, 16),
        lotNumber: '',
        removedBy: 'Operador',
        destination: 'Mantido na Máquina',
        notes: ''
    });

    // Operação Rápida Ativa pelo Operador (Limpeza, Ajuste ou Troca)
    const [activeOperation, setActiveOperation] = useState<{
        type: 'limpeza' | 'ajuste' | 'troca';
        position: TrelicaElectrodePosition;
        startTime: Date;
        selectedStockId?: string;
    } | null>(null);
    const [opElapsedSeconds, setOpElapsedSeconds] = useState<number>(0);
    const [pendingActionType, setPendingActionType] = useState<'limpeza' | 'ajuste' | 'troca' | null>(null);

    // Cronômetro da Operação Ativa em tempo real
    useEffect(() => {
        if (!activeOperation) {
            setOpElapsedSeconds(0);
            return;
        }
        const updateElapsed = () => {
            const diffMs = Date.now() - activeOperation.startTime.getTime();
            setOpElapsedSeconds(Math.max(0, Math.floor(diffMs / 1000)));
        };
        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [activeOperation]);

    const formatOperationTimer = (totalSecs: number) => {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDurationText = (start: Date, end: Date) => {
        const totalSecs = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    };

    useEffect(() => {
        loadData();
    }, [machineName]);

    // Manipuladores da Calibração
    const handleMoveOffset = (dirX: number, dirY: number) => {
        setLayoutOffsets(prev => {
            const next = { ...prev };
            if (calibTarget === 'conjunto_base') {
                // Move os 3 eletrodos do conjunto base em sincronia (#6, #7, #8)
                const baseKeys: TrelicaElectrodePosition[] = ['lateral_esq', 'lateral_dir', 'base_lateral'];
                baseKeys.forEach(k => {
                    const cur = next[k] || { dx: 0, dy: 0 };
                    next[k] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
                });
            } else if (calibTarget === 'conjunto_sup_esq') {
                // Move Base Superior Esquerda e Eletrodo Superior Esquerdo juntos
                const keys: TrelicaElectrodePosition[] = ['base_sup_esq', 'superior_esq'];
                keys.forEach(k => {
                    const cur = next[k] || { dx: 0, dy: 0 };
                    next[k] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
                });
            } else if (calibTarget === 'conjunto_sup_dir') {
                // Move Base Superior Direita e Eletrodo Superior Direito juntos
                const keys: TrelicaElectrodePosition[] = ['base_sup_dir', 'superior_dir'];
                keys.forEach(k => {
                    const cur = next[k] || { dx: 0, dy: 0 };
                    next[k] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
                });
            } else if (calibTarget === 'conjunto_inf_esq') {
                // Move Base Inferior Esquerda e Eletrodo Inferior Esquerdo juntos
                const keys: TrelicaElectrodePosition[] = ['base_inf_esq', 'inferior_esq'];
                keys.forEach(k => {
                    const cur = next[k] || { dx: 0, dy: 0 };
                    next[k] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
                });
            } else if (calibTarget === 'conjunto_inf_dir') {
                // Move Base Inferior Direita e Eletrodo Inferior Direito juntos
                const keys: TrelicaElectrodePosition[] = ['base_inf_dir', 'inferior_dir'];
                keys.forEach(k => {
                    const cur = next[k] || { dx: 0, dy: 0 };
                    next[k] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
                });
            } else {
                const cur = next[calibTarget] || { dx: 0, dy: 0 };
                next[calibTarget] = { dx: cur.dx + dirX * stepSize, dy: cur.dy + dirY * stepSize };
            }
            return next;
        });
    };

    const handleSaveAndLockLayout = () => {
        saveElectrodeOffsets(layoutOffsets);
        setIsCalibrating(false);
        setSavedNotification('Layout calibrado e travado com sucesso!');
        setTimeout(() => setSavedNotification(null), 4000);
    };

    const handleResetLayoutDefaults = () => {
        if (!confirm('Deseja redefinir as coordenadas de todos os eletrodos para o padrão original?')) return;
        const defaults: ElectrodeOffsetsMap = {
            base_sup_esq: { dx: 0, dy: 0 },
            superior_esq: { dx: 0, dy: 0 },
            base_sup_dir: { dx: 0, dy: 0 },
            superior_dir: { dx: 0, dy: 0 },
            central_triangular: { dx: 0, dy: 0 },
            base_inf_esq: { dx: 0, dy: 0 },
            inferior_esq: { dx: 0, dy: 0 },
            base_inf_dir: { dx: 0, dy: 0 },
            inferior_dir: { dx: 0, dy: 0 },
            lateral_esq: { dx: 0, dy: 0 },
            lateral_dir: { dx: 0, dy: 0 },
            base_lateral: { dx: 0, dy: 0 }
        };
        setLayoutOffsets(defaults);
        saveElectrodeOffsets(defaults);
        setSavedNotification('Posições redefinidas para o padrão original.');
        setTimeout(() => setSavedNotification(null), 3500);
    };

    const loadElectrodeStock = async () => {
        // Limpa resquícios de caches de mock antigos
        try {
            localStorage.removeItem('ita_central_electrode_stock_v1');
            localStorage.removeItem('ita_trelica_electrodes_stock_v1');
        } catch (e) {}

        // 1. Se a prop stock foi passada (sincronizada via App.tsx / Supabase Realtime)
        if (stock) {
            const filtered = stock.filter(s => s.materialType === 'Eletrodos Treliças');
            setElectrodeStockList(filtered);
            return;
        }

        // 2. Se não veio por prop, busca estritamente do banco stock_items
        try {
            const remoteStock = await fetchTable<StockItem>('stock_items');
            const remoteElectrodes = remoteStock ? remoteStock.filter(s => s.materialType === 'Eletrodos Treliças') : [];
            setElectrodeStockList(remoteElectrodes);
        } catch (err) {
            console.warn('Erro ao carregar stock_items:', err);
            setElectrodeStockList([]);
        }
    };

    useEffect(() => {
        loadElectrodeStock();
    }, [stock]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // 1. Carrega eletrodos da máquina com resiliência total a erros de banco / schema
            let list: TrelicaMachineElectrode[] = [];
            try {
                const remoteElectrodes = await fetchTable<any>('trelica_machine_electrodes');
                if (remoteElectrodes && remoteElectrodes.length > 0) {
                    const machineOnly = remoteElectrodes.filter((e: any) => 
                        (e.machine_name === machineName || e.machineName === machineName)
                    );
                    if (machineOnly.length > 0) {
                        list = machineOnly.map((e: any) => ({
                            id: e.id,
                            machine_name: e.machine_name || e.machineName || machineName,
                            position: e.position,
                            position_label: e.position_label || e.positionLabel || e.position,
                            electrode_type: e.electrode_type || e.electrodeType || 'Superior',
                            lot_id: e.lot_id || e.lotId || '',
                            lot_number: e.lot_number || e.lotNumber || 'S/L',
                            installed_at: e.installed_at || e.installedAt || new Date().toISOString(),
                            installed_by: e.installed_by || e.installedBy || 'Operador',
                            meters_produced: Number(e.meters_produced ?? e.metersProduced ?? 0),
                            pieces_produced: Number(e.pieces_produced ?? e.piecesProduced ?? 0),
                            benchmark_meters: Number(e.benchmark_meters ?? e.benchmarkMeters ?? 15000),
                            status: e.status || 'active',
                            clean_count: Number(e.clean_count ?? e.cleanCount ?? 0),
                            last_cleaned_at: e.last_cleaned_at || e.lastCleanedAt,
                            last_cleaned_by: e.last_cleaned_by || e.lastCleanedBy,
                            last_adjusted_at: e.last_adjusted_at || e.lastAdjustedAt,
                            last_adjusted_by: e.last_adjusted_by || e.lastAdjustedBy,
                            last_adjustment_type: e.last_adjustment_type || e.lastAdjustmentType,
                            last_adjustment_notes: e.last_adjustment_notes || e.lastAdjustmentNotes,
                            dress_count: Number(e.dress_count ?? e.dressCount ?? 0),
                            last_dressed_at: e.last_dressed_at || e.lastDressedAt,
                        }));
                    }
                }
            } catch (errRemote) {
                console.warn('Banco remoto trelica_machine_electrodes indisponível, usando cache local:', errRemote);
            }

            if (list.length === 0) {
                list = getLocalMachineElectrodes(machineName);
            }

            // Reconciliação universal: Garante que todas as 12 posições existam
            const missing = ELECTRODE_POSITIONS_CONFIG.filter(cfg => !list.some(p => p.position === cfg.position));
            if (missing.length > 0) {
                const added: TrelicaMachineElectrode[] = missing.map(cfg => {
                    const initialMeters = cfg.position === 'central_triangular' ? 7800 : (cfg.type === 'Base Superior' || cfg.type === 'Base Inferior') ? 3200 : cfg.position.startsWith('superior') ? 4200 : 2500;
                    return {
                        id: `el-pos-${machineName}-${cfg.position}`,
                        machine_name: machineName,
                        position: cfg.position,
                        position_label: cfg.label,
                        electrode_type: cfg.type,
                        lot_id: `lot-${cfg.productCode}-01`,
                        lot_number: `EL-${cfg.productCode}-01`,
                        installed_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
                        installed_by: 'Mecânica Turno A',
                        meters_produced: initialMeters,
                        pieces_produced: Math.round(initialMeters / 6),
                        benchmark_meters: cfg.benchmarkMeters,
                        status: initialMeters >= cfg.benchmarkMeters * 0.9 ? 'critical' : initialMeters >= cfg.benchmarkMeters * 0.7 ? 'warning' : 'active',
                        dress_count: 0
                    };
                });
                list = [...list, ...added];
                saveLocalMachineElectrodes(machineName, list);
            }
            setElectrodes(list);

            // 2. Carrega estoque centralizado de eletrodos
            await loadElectrodeStock();

            // 3. Carrega Histórico Completo com Resiliência & Auto-Reconciliação
            let histList: TrelicaElectrodeHistory[] = [];
            try {
                const remoteHist = await fetchTable<any>('trelica_electrodes_history');
                if (remoteHist && remoteHist.length > 0) {
                    const machineHist = remoteHist.filter((h: any) => 
                        !h.machine_name && !h.machineName ? true : (h.machine_name === machineName || h.machineName === machineName)
                    );
                    histList = machineHist.map((h: any) => ({
                        id: h.id,
                        machine_name: h.machine_name || h.machineName || machineName,
                        position: h.position,
                        position_label: h.position_label || h.positionLabel || h.position,
                        lot_id: h.lot_id || h.lotId || '',
                        lot_number: h.lot_number || h.lotNumber || 'S/L',
                        electrode_type: h.electrode_type || h.electrodeType || 'Superior',
                        installed_at: h.installed_at || h.installedAt || new Date().toISOString(),
                        removed_at: h.removed_at || h.removedAt || new Date().toISOString(),
                        installed_by: h.installed_by || h.installedBy,
                        removed_by: h.removed_by || h.removedBy || 'Operador',
                        meters_produced: Number(h.meters_produced ?? h.metersProduced ?? 0),
                        pieces_produced: Number(h.pieces_produced ?? h.piecesProduced ?? 0),
                        reason: h.reason,
                        destination: h.destination,
                        notes: h.notes,
                        created_at: h.created_at || h.createdAt || h.removed_at || h.removedAt || new Date().toISOString()
                    }));
                }
            } catch (errRemoteHist) {
                console.warn('Banco remoto trelica_electrodes_history indisponível, usando cache local:', errRemoteHist);
            }

            // Mesclar com cache local para garantir que nada se perca
            const localHist = getLocalElectrodeHistory(machineName);
            const seenIds = new Set(histList.map(h => h.id));
            localHist.forEach(item => {
                if (!seenIds.has(item.id)) {
                    histList.push(item);
                    seenIds.add(item.id);
                }
            });

            // RECONCILIAÇÃO INTELIGENTE: Se algum eletrodo tiver clean_count, last_cleaned_at ou last_adjusted_at
            // mas o histórico estiver vazio ou sem o respectivo registro, regenerar para que o relatório fique perfeito!
            list.forEach(el => {
                const cleansInHistory = histList.filter(h => h.position === el.position && h.reason === 'Limpeza de Eletrodo').length;
                const missingCleans = (el.clean_count || 0) - cleansInHistory;
                if (missingCleans > 0) {
                    for (let i = 0; i < missingCleans; i++) {
                        const cleanDate = el.last_cleaned_at || new Date().toISOString();
                        histList.unshift({
                            id: `hist-clean-sync-${el.position}-${Date.now()}-${i}`,
                            machine_name: machineName,
                            position: el.position,
                            position_label: el.position_label,
                            lot_id: el.lot_id || '',
                            lot_number: el.lot_number || 'Sem Lote',
                            electrode_type: el.electrode_type,
                            installed_at: cleanDate,
                            removed_at: cleanDate,
                            removed_by: el.last_cleaned_by || 'Operador',
                            meters_produced: el.meters_produced || 0,
                            pieces_produced: el.pieces_produced || 0,
                            reason: 'Limpeza de Eletrodo',
                            destination: 'Mantido na Máquina',
                            notes: el.last_cleaned_at ? `Limpeza preventiva efetuada às ${new Date(el.last_cleaned_at).toLocaleTimeString('pt-BR')}` : 'Limpeza preventiva de carepa / face de contato',
                            created_at: cleanDate
                        });
                    }
                }

                if (el.last_adjusted_at) {
                    const adjustInHistory = histList.some(h => h.position === el.position && h.reason === 'Ajuste de Altura / Ângulo');
                    if (!adjustInHistory) {
                        histList.unshift({
                            id: `hist-adjust-sync-${el.position}-${Date.now()}`,
                            machine_name: machineName,
                            position: el.position,
                            position_label: el.position_label,
                            lot_id: el.lot_id || '',
                            lot_number: el.lot_number || 'Sem Lote',
                            electrode_type: el.electrode_type,
                            installed_at: el.last_adjusted_at,
                            removed_at: el.last_adjusted_at,
                            removed_by: el.last_adjusted_by || 'Operador',
                            meters_produced: el.meters_produced || 0,
                            pieces_produced: el.pieces_produced || 0,
                            reason: 'Ajuste de Altura / Ângulo',
                            destination: 'Mantido na Máquina',
                            notes: el.last_adjustment_notes || 'Regulagem mecânica de ângulo/altura',
                            created_at: el.last_adjusted_at
                        });
                    }
                }

                if (el.dress_count && el.dress_count > 0) {
                    const dressInHistory = histList.filter(h => h.position === el.position && h.reason === 'Retífica / Lixamento').length;
                    const missingDress = el.dress_count - dressInHistory;
                    if (missingDress > 0) {
                        for (let d = 0; d < missingDress; d++) {
                            const dressDate = el.last_dressed_at || new Date().toISOString();
                            histList.unshift({
                                id: `hist-dress-sync-${el.position}-${Date.now()}-${d}`,
                                machine_name: machineName,
                                position: el.position,
                                position_label: el.position_label,
                                lot_id: el.lot_id || '',
                                lot_number: el.lot_number || 'Sem Lote',
                                electrode_type: el.electrode_type,
                                installed_at: dressDate,
                                removed_at: dressDate,
                                removed_by: 'Operador',
                                meters_produced: el.meters_produced || 0,
                                pieces_produced: el.pieces_produced || 0,
                                reason: 'Retífica / Lixamento',
                                destination: 'Mantido na Máquina',
                                notes: 'Retífica e polimento de face de contato',
                                created_at: dressDate
                            });
                        }
                    }
                }
            });

            // Ordena o histórico do mais recente para o mais antigo
            histList.sort((a, b) => new Date(b.created_at || b.removed_at || 0).getTime() - new Date(a.created_at || a.removed_at || 0).getTime());

            setHistory(histList);
            saveLocalElectrodeHistory(machineName, histList);

        } catch (err) {
            console.warn('Erro global em loadData, mantendo modo offline seguro:', err);
            const local = getLocalMachineElectrodes(machineName);
            setElectrodes(local);
            const localHist = getLocalElectrodeHistory(machineName);
            setHistory(localHist);
            await loadElectrodeStock();
        } finally {
            setIsLoading(false);
        }
    };

    const currentConfig = selectedPosition ? ELECTRODE_POSITIONS_CONFIG.find(c => c.position === selectedPosition) : undefined;
    const foundElectrode = selectedPosition ? electrodes.find(e => e.position === selectedPosition) : undefined;

    // Fallback garantido: NUNCA deixa o card em branco se uma posição foi selecionada
    const currentSelectedElectrode: TrelicaMachineElectrode | null = selectedPosition ? (foundElectrode || {
        id: `el-pos-${machineName}-${selectedPosition}`,
        machine_name: machineName,
        position: selectedPosition,
        position_label: currentConfig?.label || selectedPosition,
        electrode_type: currentConfig?.type || 'Inferior',
        lot_id: `lot-${currentConfig?.productCode || '1000'}-01`,
        lot_number: `EL-${currentConfig?.productCode || '1000'}-01`,
        installed_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        installed_by: 'Mecânica Turno A',
        meters_produced: currentConfig?.type === 'Base Superior' || currentConfig?.type === 'Base Inferior' ? 3200 : currentConfig?.position?.startsWith('superior') ? 4200 : 2500,
        pieces_produced: 416,
        benchmark_meters: currentConfig?.benchmarkMeters || 15000,
        status: 'active',
        dress_count: 0
    }) : null;

    // Auto-insere no estado se a posição faltava
    useEffect(() => {
        if (selectedPosition && !foundElectrode && currentConfig && currentSelectedElectrode) {
            setElectrodes(prev => {
                if (prev.some(e => e.position === selectedPosition)) return prev;
                const updated = [...prev, currentSelectedElectrode];
                saveLocalMachineElectrodes(machineName, updated);
                return updated;
            });
        }
    }, [selectedPosition, foundElectrode, currentConfig, currentSelectedElectrode, machineName]);

    // Lotes de estoque compatíveis com a posição ativa ou selecionada
    const activePositionForStocks = activeOperation?.position || selectedPosition;
    const activeConfigForStocks = activePositionForStocks ? ELECTRODE_POSITIONS_CONFIG.find(c => c.position === activePositionForStocks) : null;

    const compatibleStocks = useMemo(() => {
        if (!activeConfigForStocks) return [];
        // 1. Prioriza pelo código exato do produto (1000 a 1011)
        const exactMatches = electrodeStockList.filter(s => 
            (s.productCode === activeConfigForStocks.productCode || s.bitola === activeConfigForStocks.productCode) && 
            (s.remainingQuantity || 0) > 0
        );
        if (exactMatches.length > 0) return exactMatches;

        // 2. Fallback por descrição ou tipo
        const descMatches = electrodeStockList.filter(s => 
            (s.description?.toLowerCase().includes(activeConfigForStocks.shortLabel.toLowerCase()) || 
             s.description?.toLowerCase().includes(activeConfigForStocks.type.toLowerCase()) ||
             s.description?.toLowerCase().includes(activeConfigForStocks.modelDescription.toLowerCase())) &&
            (s.remainingQuantity || 0) > 0
        );
        if (descMatches.length > 0) return descMatches;

        // 3. Fallback: todos os lotes de eletrodos com saldo
        return electrodeStockList.filter(s => (s.remainingQuantity || 0) > 0);
    }, [electrodeStockList, activeConfigForStocks]);

    // Iniciar operação direta para o operador
    const startOperation = (type: 'limpeza' | 'ajuste' | 'troca', targetPos?: TrelicaElectrodePosition) => {
        const pos = targetPos || selectedPosition;
        if (!pos) {
            setPendingActionType(type);
            return;
        }
        setSelectedPosition(pos);
        setPendingActionType(null);

        const targetCfg = ELECTRODE_POSITIONS_CONFIG.find(c => c.position === pos);
        let defaultStockId = '';
        if (type === 'troca' && targetCfg) {
            const matches = electrodeStockList.filter(s => 
                (s.productCode === targetCfg.productCode || s.bitola === targetCfg.productCode) && 
                (s.remainingQuantity || 0) > 0
            );
            defaultStockId = matches[0]?.id || electrodeStockList.find(s => (s.remainingQuantity || 0) > 0)?.id || '';
        }

        setActiveOperation({
            type,
            position: pos,
            startTime: new Date(),
            selectedStockId: defaultStockId
        });
    };

    const handleSelectPositionOnDrawing = (pos: TrelicaElectrodePosition) => {
        setSelectedPosition(pos);
        if (pendingActionType) {
            startOperation(pendingActionType, pos);
        }
    };

    // Concluir Limpeza (grava início, término e duração calculada sem formulários)
    const handleCompleteLimpeza = async () => {
        if (!activeOperation) return;
        const targetPos = activeOperation.position;
        const el = electrodes.find(e => e.position === targetPos) || currentSelectedElectrode;
        if (!el) return;

        const endTime = new Date();
        const startTime = activeOperation.startTime;
        const durationText = formatDurationText(startTime, endTime);
        const startStr = startTime.toLocaleTimeString('pt-BR');
        const endStr = endTime.toLocaleTimeString('pt-BR');

        const updatedElectrode: TrelicaMachineElectrode = {
            ...el,
            clean_count: (el.clean_count || 0) + 1,
            last_cleaned_at: endTime.toISOString(),
            last_cleaned_by: 'Operador',
            status: el.status === 'critical' ? 'warning' : el.status
        };

        const updatedElectrodes = electrodes.map(item => item.position === targetPos ? updatedElectrode : item);
        setElectrodes(updatedElectrodes);
        saveLocalMachineElectrodes(machineName, updatedElectrodes);

        const historyEntry: TrelicaElectrodeHistory = {
            id: `hist-clean-${Date.now()}`,
            machine_name: machineName,
            position: targetPos,
            position_label: el.position_label,
            lot_id: el.lot_id || '',
            lot_number: el.lot_number || 'Sem Lote',
            electrode_type: el.electrode_type,
            installed_at: startTime.toISOString(),
            removed_at: endTime.toISOString(),
            removed_by: 'Operador',
            meters_produced: el.meters_produced,
            pieces_produced: el.pieces_produced,
            reason: 'Limpeza de Eletrodo',
            destination: 'Mantido na Máquina',
            notes: `Início: ${startStr} | Término: ${endStr} | Duração: ${durationText}`,
            created_at: endTime.toISOString()
        };

        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
        saveLocalElectrodeHistory(machineName, updatedHistory);

        try {
            await updateItem('trelica_machine_electrodes', updatedElectrode.id, updatedElectrode as any).catch(e => console.warn(e));
            await insertItem('trelica_electrodes_history', historyEntry as any).catch(e => console.warn(e));
        } catch (err) {
            console.warn('Erro ao sincronizar limpeza:', err);
        }

        setActiveOperation(null);
        if (onElectrodeChange) onElectrodeChange();
        setSavedNotification(`✓ Limpeza de ${el.position_label} concluída em ${durationText}!`);
        setTimeout(() => setSavedNotification(null), 5000);
    };

    // Concluir Ajuste (grava início, término e duração calculada sem formulários)
    const handleCompleteAjuste = async () => {
        if (!activeOperation) return;
        const targetPos = activeOperation.position;
        const el = electrodes.find(e => e.position === targetPos) || currentSelectedElectrode;
        if (!el) return;

        const endTime = new Date();
        const startTime = activeOperation.startTime;
        const durationText = formatDurationText(startTime, endTime);
        const startStr = startTime.toLocaleTimeString('pt-BR');
        const endStr = endTime.toLocaleTimeString('pt-BR');

        const updatedElectrode: TrelicaMachineElectrode = {
            ...el,
            last_adjusted_at: endTime.toISOString(),
            last_adjusted_by: 'Operador',
            last_adjustment_type: 'Ajuste de Altura / Ângulo',
            last_adjustment_notes: `Duração: ${durationText} (${startStr} às ${endStr})`
        };

        const updatedElectrodes = electrodes.map(item => item.position === targetPos ? updatedElectrode : item);
        setElectrodes(updatedElectrodes);
        saveLocalMachineElectrodes(machineName, updatedElectrodes);

        const historyEntry: TrelicaElectrodeHistory = {
            id: `hist-adjust-${Date.now()}`,
            machine_name: machineName,
            position: targetPos,
            position_label: el.position_label,
            lot_id: el.lot_id || '',
            lot_number: el.lot_number || 'Sem Lote',
            electrode_type: el.electrode_type,
            installed_at: startTime.toISOString(),
            removed_at: endTime.toISOString(),
            removed_by: 'Operador',
            meters_produced: el.meters_produced,
            pieces_produced: el.pieces_produced,
            reason: 'Ajuste de Altura / Ângulo',
            destination: 'Mantido na Máquina',
            notes: `Início: ${startStr} | Término: ${endStr} | Duração: ${durationText}`,
            created_at: endTime.toISOString()
        };

        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
        saveLocalElectrodeHistory(machineName, updatedHistory);

        try {
            await updateItem('trelica_machine_electrodes', updatedElectrode.id, updatedElectrode as any).catch(e => console.warn(e));
            await insertItem('trelica_electrodes_history', historyEntry as any).catch(e => console.warn(e));
        } catch (err) {
            console.warn('Erro ao sincronizar ajuste:', err);
        }

        setActiveOperation(null);
        if (onElectrodeChange) onElectrodeChange();
        setSavedNotification(`✓ Ajuste de ${el.position_label} concluído em ${durationText}!`);
        setTimeout(() => setSavedNotification(null), 5000);
    };

    // Concluir Troca (baixa no estoque e montagem do novo lote com início/término)
    const handleCompleteTroca = async () => {
        if (!activeOperation || !activeOperation.selectedStockId) return;
        const targetPos = activeOperation.position;
        const el = electrodes.find(e => e.position === targetPos) || currentSelectedElectrode;
        if (!el) return;

        const chosenStock = electrodeStockList.find(s => s.id === activeOperation.selectedStockId);
        if (!chosenStock) {
            alert('Selecione um lote disponível do estoque.');
            return;
        }

        const endTime = new Date();
        const startTime = activeOperation.startTime;
        const durationText = formatDurationText(startTime, endTime);
        const startStr = startTime.toLocaleTimeString('pt-BR');
        const endStr = endTime.toLocaleTimeString('pt-BR');

        // 1. Dar baixa de 1 unidade do estoque
        const newQty = Math.max(0, (chosenStock.remainingQuantity || 1) - 1);
        const newStatus = newQty === 0 ? 'Consumido' : (chosenStock.status || 'Disponível');
        const updatedStockItem: StockItem = {
            ...chosenStock,
            remainingQuantity: newQty,
            status: newStatus as any
        };
        const updatedList = electrodeStockList.map(s => s.id === chosenStock.id ? updatedStockItem : s);
        setElectrodeStockList(updatedList);
        try {
            await updateItem('stock_items', chosenStock.id, {
                remaining_quantity: newQty,
                status: newStatus
            }).catch(e => console.warn(e));
        } catch (err) {
            console.warn('Erro ao atualizar estoque:', err);
        }
        if (onUpdateStockItem) onUpdateStockItem(updatedStockItem);

        // 2. Gravar histórico da peça retirada
        const historyEntry: TrelicaElectrodeHistory = {
            id: `hist-change-${Date.now()}`,
            machine_name: machineName,
            position: targetPos,
            position_label: el.position_label,
            lot_id: el.lot_id || '',
            lot_number: el.lot_number || 'Sem Lote',
            electrode_type: el.electrode_type,
            installed_at: el.installed_at || startTime.toISOString(),
            removed_at: endTime.toISOString(),
            removed_by: 'Operador',
            meters_produced: el.meters_produced,
            pieces_produced: el.pieces_produced,
            reason: 'Troca de Eletrodo',
            destination: 'Retífica / Usinagem',
            notes: `Início: ${startStr} | Término: ${endStr} | Duração: ${durationText} | Novo Lote Instalado: #${chosenStock.internalLot || chosenStock.supplierLot}`,
            created_at: endTime.toISOString()
        };

        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
        saveLocalElectrodeHistory(machineName, updatedHistory);

        // 3. Atualizar o eletrodo montado na máquina com o novo lote
        const targetCfg = ELECTRODE_POSITIONS_CONFIG.find(c => c.position === targetPos);
        const newElectrodeData: TrelicaMachineElectrode = {
            id: el.id || `el-pos-${machineName}-${targetPos}`,
            machine_name: machineName,
            position: targetPos,
            position_label: targetCfg?.label || targetPos,
            electrode_type: targetCfg?.type || 'Superior',
            lot_id: chosenStock.id,
            lot_number: chosenStock.internalLot || chosenStock.supplierLot || `EL-${targetCfg?.productCode || '1000'}-01`,
            installed_at: endTime.toISOString(),
            installed_by: 'Operador',
            meters_produced: 0,
            pieces_produced: 0,
            benchmark_meters: targetCfg?.benchmarkMeters || 15000,
            status: 'active',
            dress_count: 0
        };

        const updatedElectrodes = electrodes.map(item => item.position === targetPos ? newElectrodeData : item);
        setElectrodes(updatedElectrodes);
        saveLocalMachineElectrodes(machineName, updatedElectrodes);

        try {
            await updateItem('trelica_machine_electrodes', newElectrodeData.id, newElectrodeData as any).catch(e => console.warn(e));
            await insertItem('trelica_electrodes_history', historyEntry as any).catch(e => console.warn(e));
        } catch (err) {
            console.warn(err);
        }

        setActiveOperation(null);
        if (onElectrodeChange) onElectrodeChange();
        setSavedNotification(`✓ Troca de ${newElectrodeData.position_label} concluída em ${durationText}! Novo lote #${newElectrodeData.lot_number} instalado.`);
        setTimeout(() => setSavedNotification(null), 5000);
    };

    const handleDressElectrode = async () => {
        if (readOnly || !currentSelectedElectrode) return;
        if (!confirm(`Confirmar retífica/lixamento do eletrodo ${currentSelectedElectrode.position_label}? A vida útil será estendida.`)) return;

        const nowIso = new Date().toISOString();
        const updatedElectrode: TrelicaMachineElectrode = {
            ...currentSelectedElectrode,
            dress_count: (currentSelectedElectrode.dress_count || 0) + 1,
            last_dressed_at: nowIso,
            status: 'active' as const
        };

        const updatedElectrodes = electrodes.map(el => {
            if (el.position === selectedPosition) {
                return updatedElectrode;
            }
            return el;
        });

        setElectrodes(updatedElectrodes);
        saveLocalMachineElectrodes(machineName, updatedElectrodes);

        const historyEntry: TrelicaElectrodeHistory = {
            id: `hist-dress-${Date.now()}`,
            machine_name: machineName,
            position: currentSelectedElectrode.position,
            position_label: currentSelectedElectrode.position_label,
            lot_id: currentSelectedElectrode.lot_id || '',
            lot_number: currentSelectedElectrode.lot_number || 'Sem Lote',
            electrode_type: currentSelectedElectrode.electrode_type,
            installed_at: nowIso,
            removed_at: nowIso,
            removed_by: 'Operador',
            meters_produced: currentSelectedElectrode.meters_produced,
            pieces_produced: currentSelectedElectrode.pieces_produced,
            reason: 'Retífica / Lixamento',
            destination: 'Mantido na Máquina',
            notes: `Retífica/polimento da face de contato efetuada.`,
            created_at: nowIso
        };

        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
        saveLocalElectrodeHistory(machineName, updatedHistory);

        try {
            await updateItem('trelica_machine_electrodes', updatedElectrode.id, updatedElectrode as any).catch(e => console.warn(e));
            await insertItem('trelica_electrodes_history', historyEntry as any).catch(e => console.warn(e));
        } catch (err) {
            console.warn(err);
        }

        if (onElectrodeChange) onElectrodeChange();
        setSavedNotification(`✓ Retífica do ${currentSelectedElectrode.position_label} registrada com sucesso!`);
        setTimeout(() => setSavedNotification(null), 4000);
    };

    // Salvar Registro Manual de Evento no Histórico
    const handleSaveManualRecord = async () => {
        const targetCfg = ELECTRODE_POSITIONS_CONFIG.find(c => c.position === manualEntry.position);
        const currentEl = electrodes.find(e => e.position === manualEntry.position);
        const eventDateIso = manualEntry.date ? new Date(manualEntry.date).toISOString() : new Date().toISOString();

        const historyEntry: TrelicaElectrodeHistory = {
            id: `hist-manual-${Date.now()}`,
            machine_name: machineName,
            position: manualEntry.position,
            position_label: targetCfg?.label || manualEntry.position,
            lot_id: currentEl?.lot_id || '',
            lot_number: manualEntry.lotNumber || currentEl?.lot_number || 'S/L',
            electrode_type: targetCfg?.type || 'Superior',
            installed_at: eventDateIso,
            removed_at: eventDateIso,
            removed_by: manualEntry.removedBy || 'Operador',
            meters_produced: currentEl?.meters_produced || 0,
            pieces_produced: currentEl?.pieces_produced || 0,
            reason: manualEntry.reason as any,
            destination: manualEntry.destination as any,
            notes: manualEntry.notes || 'Registro manual inserido',
            created_at: eventDateIso
        };

        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
        saveLocalElectrodeHistory(machineName, updatedHistory);

        // Se for limpeza, atualiza também o contador do eletrodo se couber
        if (manualEntry.reason === 'Limpeza de Eletrodo' && currentEl) {
            const updatedEl: TrelicaMachineElectrode = {
                ...currentEl,
                clean_count: (currentEl.clean_count || 0) + 1,
                last_cleaned_at: eventDateIso,
                last_cleaned_by: manualEntry.removedBy
            };
            const updatedList = electrodes.map(e => e.position === manualEntry.position ? updatedEl : e);
            setElectrodes(updatedList);
            saveLocalMachineElectrodes(machineName, updatedList);
            updateItem('trelica_machine_electrodes', updatedEl.id, updatedEl as any).catch(e => console.warn(e));
        }

        try {
            await insertItem('trelica_electrodes_history', historyEntry as any).catch(e => console.warn(e));
        } catch (err) {
            console.warn(err);
        }

        setShowManualRecordModal(false);
        setSavedNotification(`✓ Registro manual adicionado com sucesso ao histórico!`);
        setTimeout(() => setSavedNotification(null), 4000);
    };


    // Helper para cor do eletrodo no desenho técnico baseado na vida útil
    const getElectrodeHealth = (pos: TrelicaElectrodePosition) => {
        const el = electrodes.find(e => e.position === pos) || (pos === selectedPosition ? currentSelectedElectrode : undefined);
        const cfg = ELECTRODE_POSITIONS_CONFIG.find(c => c.position === pos);
        const benchmark = el?.benchmark_meters || cfg?.benchmarkMeters || 15000;
        const meters = el?.meters_produced || (cfg?.type === 'Base Superior' || cfg?.type === 'Base Inferior' ? 3200 : cfg?.position?.startsWith('superior') ? 4200 : 2500);
        const percent = Math.min(100, Math.round((meters / benchmark) * 100));

        if (percent >= 90) {
            return { percent, color: '#F43F5E', statusText: 'Crítico', glow: 'rgba(244, 63, 94, 0.4)' };
        }
        if (percent >= 70) {
            return { percent, color: '#F59E0B', statusText: 'Atenção', glow: 'rgba(245, 158, 11, 0.3)' };
        }
        return { percent, color: '#10B981', statusText: 'Saudável', glow: 'rgba(16, 185, 129, 0.2)' };
    };

    return (
        <div className="bg-[#0A141E] rounded-3xl border border-slate-700/60 shadow-2xl p-4 sm:p-6 text-white flex flex-col gap-6 animate-fade-in">
            
            {/* Topo do Painel de Solda: Título, Status, Abas e Botão de Calibração */}
            <div className="flex flex-col gap-4 pb-4 border-b border-slate-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-bold shadow-inner">
                            ⚡
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                                    Cabeça de Solda & Eletrodos ({machineName})
                                </h3>
                                <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-bold">
                                    12 Componentes / Eletrodos Ativos
                                </span>
                                {readOnly && (
                                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                                        🔒 Somente Leitura
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Gêmeo digital da cabeça de solda por resistência (Conjunto Móvel DHSTR/F1Projetos). Clique em qualquer eletrodo para inspecionar, regular ou trocar.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* Botão para Ativar / Travar Modo Calibração de Layout */}
                        <button
                            type="button"
                            onClick={() => setIsCalibrating(!isCalibrating)}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition active:scale-95 shadow-md ${
                                isCalibrating
                                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 border border-amber-300 animate-pulse'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                            }`}
                            title="Ajustar e calibrar posições dos eletrodos no desenho CAD e salvar"
                        >
                            <span>{isCalibrating ? '🔒' : '📐'}</span>
                            <span>{isCalibrating ? 'Modo Ajuste Ativo' : 'Ajustar Layout'}</span>
                        </button>

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                                title="Fechar"
                            >
                                <XIcon className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Toast / Notificação de Salvamento do Layout */}
                {savedNotification && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in shadow-lg shadow-emerald-950/40">
                        <div className="flex items-center gap-2">
                            <span>✅</span>
                            <span>{savedNotification}</span>
                        </div>
                        <button onClick={() => setSavedNotification(null)} className="text-emerald-400 hover:text-white">✕</button>
                    </div>
                )}

                {/* Abas de Navegação */}
                <div className="flex items-center gap-2 border-b border-slate-800/80 pt-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('digital_twin')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wide border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'digital_twin'
                                ? 'border-amber-400 text-amber-300 bg-amber-500/10 rounded-t-xl'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>⚡</span>
                        <span>Gêmeo Digital (CAD)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('reports')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wide border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'reports'
                                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-xl'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>📊</span>
                        <span>Relatório & Histórico ({history.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('stock')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wide border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'stock'
                                ? 'border-teal-400 text-teal-300 bg-teal-500/10 rounded-t-xl'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>📦</span>
                        <span>Almoxarifado ({electrodeStockList.reduce((acc, s) => acc + (s.remainingQuantity || 0), 0)} un)</span>
                    </button>
                </div>
            </div>

            {/* ABA 1: GÊMEO DIGITAL INTERATIVO COM MODO DE CALIBRAÇÃO & PAINEL DE CONTROLE */}
            {activeTab === 'digital_twin' && (
                <div className="flex flex-col gap-4">
                    {/* BARRA DE CALIBRAÇÃO DO GESTOR (Exibida quando isCalibrating === true) */}
                    {isCalibrating && (
                        <div className="p-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/40 rounded-3xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 animate-fade-in">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                        Modo Gestor: Ajuste & Calibração de Posição
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-300">
                                    Selecione o eletrodo ou conjunto abaixo, use as setas para mover na tela em tempo real e clique em <strong>Salvar e Travar</strong>.
                                </p>
                            </div>

                            {/* Seletor do Eletrodo / Conjunto Alvo */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">Elemento para Ajustar:</label>
                                    <select
                                        value={calibTarget}
                                        onChange={e => setCalibTarget(e.target.value as any)}
                                        className="p-2 bg-slate-950 border border-amber-500/40 rounded-xl text-white font-mono font-bold text-xs focus:border-amber-400 outline-none shadow-inner"
                                    >
                                        <option value="conjunto_sup_esq">🌟 CONJUNTO SUP ESQ (Base + Eletrodo #1)</option>
                                        <option value="conjunto_sup_dir">🌟 CONJUNTO SUP DIR (Base + Eletrodo #2)</option>
                                        <option value="conjunto_inf_esq">🌟 CONJUNTO INF ESQ (Base + Eletrodo #4)</option>
                                        <option value="conjunto_inf_dir">🌟 CONJUNTO INF DIR (Base + Eletrodo #5)</option>
                                        <option value="conjunto_base">🌟 CONJUNTO BASE LATERAL (#6, #7, #8)</option>
                                        <option value="base_sup_esq">#1 Base Superior Esquerda</option>
                                        <option value="superior_esq">#1 Eletrodo Superior Esquerdo</option>
                                        <option value="base_sup_dir">#2 Base Superior Direita</option>
                                        <option value="superior_dir">#2 Eletrodo Superior Direito</option>
                                        <option value="central_triangular">#3 Central Triangular</option>
                                        <option value="base_inf_esq">#4 Base Inferior Esquerda</option>
                                        <option value="inferior_esq">#4 Eletrodo Inferior Esquerdo</option>
                                        <option value="base_inf_dir">#5 Base Inferior Direita</option>
                                        <option value="inferior_dir">#5 Eletrodo Inferior Direito</option>
                                        <option value="lateral_esq">#6 Lateral Esquerda</option>
                                        <option value="lateral_dir">#7 Lateral Direita</option>
                                        <option value="base_lateral">#8 Base Lateral</option>
                                    </select>
                                </div>

                                {/* Seletor de Passo (1px, 5px, 10px) */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">Passo:</label>
                                    <div className="flex bg-slate-950 border border-slate-700 rounded-xl p-0.5">
                                        {[1, 5, 10, 20].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setStepSize(s)}
                                                className={`px-2 py-1 text-[10px] font-mono font-bold rounded-lg transition ${
                                                    stepSize === s ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {s}px
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Teclado Direcional D-PAD */}
                                <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => handleMoveOffset(-1, 0)}
                                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition active:scale-90"
                                        title="Mover para Esquerda"
                                    >
                                        ⬅️
                                    </button>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleMoveOffset(0, -1)}
                                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition active:scale-90"
                                            title="Subir"
                                        >
                                            ⬆️
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMoveOffset(0, 1)}
                                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition active:scale-90"
                                            title="Descer"
                                        >
                                            ⬇️
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveOffset(1, 0)}
                                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition active:scale-90"
                                        title="Mover para Direita"
                                    >
                                        ➡️
                                    </button>
                                </div>

                                {/* Leitura dos Offsets */}
                                <div className="text-center font-mono text-[10px] text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                                    {calibTarget === 'conjunto_base' ? (
                                        <span>Base Lateral: X: {layoutOffsets.base_lateral?.dx || 0}px | Y: {layoutOffsets.base_lateral?.dy || 0}px</span>
                                    ) : calibTarget === 'conjunto_sup_esq' ? (
                                        <span>Conjunto Sup Esq: X: {layoutOffsets.base_sup_esq?.dx || 0}px | Y: {layoutOffsets.base_sup_esq?.dy || 0}px</span>
                                    ) : calibTarget === 'conjunto_sup_dir' ? (
                                        <span>Conjunto Sup Dir: X: {layoutOffsets.base_sup_dir?.dx || 0}px | Y: {layoutOffsets.base_sup_dir?.dy || 0}px</span>
                                    ) : calibTarget === 'conjunto_inf_esq' ? (
                                        <span>Conjunto Inf Esq: X: {layoutOffsets.base_inf_esq?.dx || 0}px | Y: {layoutOffsets.base_inf_esq?.dy || 0}px</span>
                                    ) : calibTarget === 'conjunto_inf_dir' ? (
                                        <span>Conjunto Inf Dir: X: {layoutOffsets.base_inf_dir?.dx || 0}px | Y: {layoutOffsets.base_inf_dir?.dy || 0}px</span>
                                    ) : (
                                        <span>Offset: X: {layoutOffsets[calibTarget]?.dx || 0}px | Y: {layoutOffsets[calibTarget]?.dy || 0}px</span>
                                    )}
                                </div>

                                {/* Ações: Salvar / Resetar / Travar */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLockLayout}
                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wide transition active:scale-95 shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                                    >
                                        <span>💾</span>
                                        <span>Salvar e Travar</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleResetLayoutDefaults}
                                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                        title="Redefinir Padrões"
                                    >
                                        ↩️
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Layout Principal: Desenho Técnico Isométrico (Esquerda) + Card de Detalhes do Eletrodo (Direita) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* COLUNA ESQUERDA: DESENHO TÉCNICO VETORIAL ISOMÉTRICO (Lg: 7 colunas) */}
                        <div className="lg:col-span-7 bg-[#050C13] rounded-3xl p-4 sm:p-6 border border-slate-800 relative overflow-hidden flex flex-col items-center">
                            
                            {/* Legenda de Posições no Desenho */}
                            <div className="w-full flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> &lt; 70% Bom
                                    <span className="w-2 h-2 rounded-full bg-amber-400 ml-2"></span> 70-90% Atenção
                                    <span className="w-2 h-2 rounded-full bg-rose-500 ml-2"></span> &gt; 90% Trocar
                                </span>
                                <span className="text-[10px] uppercase font-bold text-slate-500">
                                    Vista Isométrica Frontal
                                </span>
                            </div>

                            {/* SVG TÉCNICO INTERATIVO FIEL AO PROJETO CAD */}
                            <div className="relative w-full max-w-[560px] aspect-[4/3] flex items-center justify-center select-none py-2">
                                {/* Banner Flutuante de Orientação Rápida */}
                                {pendingActionType && (
                                    <div className="absolute top-2 left-2 right-2 z-20 bg-amber-500/95 text-slate-950 font-black text-xs py-2 px-3 rounded-2xl flex items-center justify-between shadow-2xl backdrop-blur-md border border-amber-300 animate-bounce">
                                        <span className="flex items-center gap-2">
                                            <span className="text-base">👆</span>
                                            <span>
                                                {pendingActionType === 'troca' && 'Toque no desenho no eletrodo que irá TROCAR:'}
                                                {pendingActionType === 'limpeza' && 'Toque no desenho no eletrodo que irá LIMPAR:'}
                                                {pendingActionType === 'ajuste' && 'Toque no desenho no eletrodo que irá AJUSTAR:'}
                                            </span>
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => setPendingActionType(null)} 
                                            className="text-[10px] uppercase bg-black/20 hover:bg-black/40 px-2 py-1 rounded-lg text-slate-900 font-bold"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                                {activeOperation && (
                                    <div className="absolute top-2 left-2 right-2 z-20 bg-cyan-600/95 text-white font-black text-xs py-2 px-3 rounded-2xl flex items-center justify-between shadow-2xl backdrop-blur-md border border-cyan-400">
                                        <span className="flex items-center gap-2">
                                            <span className="animate-spin text-sm">⏱</span>
                                            <span>
                                                {activeOperation.type === 'limpeza' && 'Limpeza: '}
                                                {activeOperation.type === 'ajuste' && 'Ajuste: '}
                                                {activeOperation.type === 'troca' && 'Troca: '}
                                                <strong className="text-amber-300">
                                                    {ELECTRODE_POSITIONS_CONFIG.find(c => c.position === activeOperation.position)?.label}
                                                </strong>
                                            </span>
                                        </span>
                                        <span className="font-mono text-xs bg-black/40 px-2 py-0.5 rounded-lg border border-cyan-300/40 text-cyan-200">
                                            {formatOperationTimer(opElapsedSeconds)}
                                        </span>
                                    </div>
                                )}

                                <svg 
                                    viewBox="0 0 700 550" 
                                    className="w-full h-full drop-shadow-2xl transition-all"
                                    style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.7))' }}
                                >
                                    <defs>
                                        {/* Gradientes Metálicos para os Eletrodos de Cobre */}
                                        <linearGradient id="copperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#E58E4A" />
                                            <stop offset="50%" stopColor="#C86A2E" />
                                            <stop offset="100%" stopColor="#964817" />
                                        </linearGradient>
                                        <linearGradient id="copperHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#F9BC7E" />
                                            <stop offset="50%" stopColor="#D97736" />
                                            <stop offset="100%" stopColor="#A34E1C" />
                                        </linearGradient>
                                        <linearGradient id="steelBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#334155" />
                                            <stop offset="50%" stopColor="#1E293B" />
                                            <stop offset="100%" stopColor="#0F172A" />
                                        </linearGradient>
                                        <linearGradient id="steelPillarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#64748B" />
                                            <stop offset="50%" stopColor="#475569" />
                                            <stop offset="100%" stopColor="#1E293B" />
                                        </linearGradient>
                                    </defs>

                                    {/* 1. ESTRUTURA METÁLICA DO CHASSI E COLUNAS (CINZA MECÂNICO) */}
                                    <g id="mechanical_chassis" opacity="0.85">
                                        {/* Base de Sustentação Inferior */}
                                        <polygon points="120,440 580,440 640,490 60,490" fill="#0B131D" stroke="#334155" strokeWidth="2" />
                                        <polygon points="60,490 640,490 640,515 60,515" fill="#080E16" stroke="#1E293B" strokeWidth="2" />

                                        {/* Guia Central do Bloco de Solda */}
                                        <path d="M 270,180 L 430,180 L 450,420 L 250,420 Z" fill="url(#steelBodyGrad)" stroke="#475569" strokeWidth="2" />
                                        <path d="M 330,180 L 370,180 L 370,420 L 330,420 Z" fill="#0A1118" stroke="#334155" strokeWidth="1.5" />

                                        {/* Colunas / Carros de Fixação Superior Esquerdo */}
                                        <polygon points="140,80 220,110 200,210 120,180" fill="url(#steelPillarGrad)" stroke="#475569" strokeWidth="2" />
                                        <circle cx="160" cy="110" r="7" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5" />
                                        <circle cx="195" cy="125" r="7" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5" />

                                        {/* Colunas / Carros de Fixação Superior Direito */}
                                        <polygon points="560,80 480,110 500,210 580,180" fill="url(#steelPillarGrad)" stroke="#475569" strokeWidth="2" />
                                        <circle cx="540" cy="110" r="7" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5" />
                                        <circle cx="505" cy="125" r="7" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5" />

                                        {/* Suportes Inferiores / Mancais */}
                                        <polygon points="160,330 250,330 240,410 150,410" fill="url(#steelBodyGrad)" stroke="#475569" strokeWidth="2" />
                                        <polygon points="540,330 450,330 460,410 550,410" fill="url(#steelBodyGrad)" stroke="#475569" strokeWidth="2" />
                                    </g>

                                    {/* 2. LINHAS GUIA DA TRELIÇA (ARAMES BANZO SUPERIOR, SENOIDES E INFERIORES) */}
                                    <g id="trelica_wires" strokeDasharray="3,3" opacity="0.4">
                                        {/* Fio Superior */}
                                        <line x1="350" y1="90" x2="350" y2="480" stroke="#38BDF8" strokeWidth="4" />
                                        {/* Senoide Esquerda */}
                                        <line x1="350" y1="180" x2="250" y2="380" stroke="#FBBF24" strokeWidth="3" />
                                        {/* Senoide Direita */}
                                        <line x1="350" y1="180" x2="450" y2="380" stroke="#FBBF24" strokeWidth="3" />
                                        {/* Fio Inferior Esquerdo */}
                                        <line x1="250" y1="300" x2="250" y2="480" stroke="#38BDF8" strokeWidth="3.5" />
                                        {/* Fio Inferior Direito */}
                                        <line x1="450" y1="300" x2="450" y2="480" stroke="#38BDF8" strokeWidth="3.5" />
                                    </g>

                                    {/* ========================================================================= */}
                                    {/* 3. COMPONENTES E ELETRODOS INTERATIVOS (CLICÁVEIS E CALIBRÁVEIS)            */}
                                    {/* ========================================================================= */}

                                    {/* COMPONENTE 1A: BASE DO ELETRODO SUPERIOR ESQUERDO (PORTA-ELETRODO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'base_sup_esq';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_sup_esq');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="180,160 280,201 270,241 170,200" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro / Borda Superior Metálica */}
                                                <polygon points="180,160 280,201 275,208 175,167" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1" />
                                                {/* Rótulo visual */}
                                                <text x="215" y="200" fill="#FFFFFF" fontSize="10" fontWeight="900" transform="rotate(22 215,200)" pointerEvents="none">
                                                    #1 BASE SUP
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 1B: ELETRODO SUPERIOR ESQUERDO (POSTIÇO / PONTA DE CONTATO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'superior_esq';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_sup_esq');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="280,201 325,219 315,257 270,241" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperHighlight)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 12px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro da ponta de contato */}
                                                <polygon points="315,215 325,219 315,257 305,253" fill="url(#copperGrad)" stroke="#5C2B09" strokeWidth="1.2" />
                                                {/* Rótulo visual */}
                                                <text x="296" y="233" fill="#FFFFFF" fontSize="8.5" fontWeight="900" transform="rotate(22 296,233)" pointerEvents="none">
                                                    #1 EL SUP
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 2A: BASE DO ELETRODO SUPERIOR DIREITO (PORTA-ELETRODO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'base_sup_dir';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_sup_dir');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="520,160 420,201 430,241 530,200" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro / Borda Superior Metálica */}
                                                <polygon points="520,160 420,201 425,208 525,167" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1" />
                                                {/* Rótulo visual */}
                                                <text x="445" y="200" fill="#FFFFFF" fontSize="10" fontWeight="900" transform="rotate(-22 445,200)" pointerEvents="none">
                                                    #2 BASE SUP
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 2B: ELETRODO SUPERIOR DIREITO (POSTIÇO / PONTA DE CONTATO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'superior_dir';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_sup_dir');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="420,201 375,219 385,257 430,241" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperHighlight)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 12px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro da ponta de contato */}
                                                <polygon points="385,215 375,219 385,257 395,253" fill="url(#copperGrad)" stroke="#5C2B09" strokeWidth="1.2" />
                                                {/* Rótulo visual */}
                                                <text x="402" y="233" fill="#FFFFFF" fontSize="8.5" fontWeight="900" transform="rotate(-22 402,233)" pointerEvents="none">
                                                    #2 EL SUP
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* ELETRODO 3: CENTRAL TRIANGULAR */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'central_triangular';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos);
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                {/* Triângulo Menor Central */}
                                                <polygon 
                                                    points="350,217 375,255 325,255" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperHighlight)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 14px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                
                                                {/* Símbolo Triângulo Interno */}
                                                <polygon points="350,222 361,235 339,235" fill="none" stroke="#FFFFFF" strokeWidth="1.5" pointerEvents="none" />
                                                
                                                {/* Rótulo */}
                                                <text x="350" y="250" fill="#FFFFFF" fontSize="7.5" fontWeight="900" textAnchor="middle" pointerEvents="none">
                                                    #3 CENTRAL △
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 4A: BASE DO ELETRODO INFERIOR ESQUERDO (PORTA-ELETRODO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'base_inf_esq';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_inf_esq');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="160,340 235,357 225,402 150,385" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro / Borda Superior Metálica */}
                                                <polygon points="160,340 235,357 230,364 155,347" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1" />
                                                {/* Rótulo visual */}
                                                <text x="188" y="375" fill="#FFFFFF" fontSize="9.5" fontWeight="900" transform="rotate(13 188,375)" pointerEvents="none">
                                                    #4 BASE INF
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 4B: ELETRODO INFERIOR ESQUERDO (POSTIÇO / PONTA DE CONTATO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'inferior_esq';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_inf_esq');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="235,357 265,365 255,410 225,402" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperHighlight)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 12px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro da ponta de contato */}
                                                <polygon points="255,362 265,365 255,410 245,407" fill="url(#copperGrad)" stroke="#5C2B09" strokeWidth="1.2" />
                                                {/* Rótulo visual */}
                                                <text x="245" y="388" fill="#FFFFFF" fontSize="7.5" fontWeight="900" transform="rotate(13 245,388)" pointerEvents="none">
                                                    #4 EL INF
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 5A: BASE DO ELETRODO INFERIOR DIREITO (PORTA-ELETRODO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'base_inf_dir';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_inf_dir');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="540,340 465,357 475,402 550,385" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro / Borda Superior Metálica */}
                                                <polygon points="540,340 465,357 470,364 545,347" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1" />
                                                {/* Rótulo visual */}
                                                <text x="472" y="375" fill="#FFFFFF" fontSize="9.5" fontWeight="900" transform="rotate(-13 472,375)" pointerEvents="none">
                                                    #5 BASE INF
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* COMPONENTE 5B: ELETRODO INFERIOR DIREITO (POSTIÇO / PONTA DE CONTATO) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'inferior_dir';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_inf_dir');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="465,357 435,365 445,410 475,402" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperHighlight)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 12px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                {/* Chanfro da ponta de contato */}
                                                <polygon points="445,362 435,365 445,410 455,407" fill="url(#copperGrad)" stroke="#5C2B09" strokeWidth="1.2" />
                                                {/* Rótulo visual */}
                                                <text x="455" y="388" fill="#FFFFFF" fontSize="7.5" fontWeight="900" transform="rotate(-13 455,388)" pointerEvents="none">
                                                    #5 EL INF
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* ELETRODO 6: LATERAL ESQUERDA (Subido junto da base lateral) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'lateral_esq';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_base');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="305,395 330,355 305,355 280,395" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                <polygon points="305,395 330,355 325,355 300,395" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1.5" />
                                                <text x="305" y="380" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" pointerEvents="none">
                                                    #6 LAT ESQ
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* ELETRODO 7: LATERAL DIREITA (Subido junto da base lateral) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'lateral_dir';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_base');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="395,395 370,355 395,355 420,395" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                <polygon points="395,395 370,355 375,355 400,395" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1.5" />
                                                <text x="395" y="380" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" pointerEvents="none">
                                                    #7 LAT DIR
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* ELETRODO 8: BASE LATERAL (Subida no conjunto) */}
                                    {(() => {
                                        const pos: TrelicaElectrodePosition = 'base_lateral';
                                        const isSelected = selectedPosition === pos;
                                        const isOperating = activeOperation?.position === pos;
                                        const isPendingTarget = pendingActionType !== null;
                                        const isCalibActive = isCalibrating && (calibTarget === pos || calibTarget === 'conjunto_base');
                                        const health = getElectrodeHealth(pos);
                                        const offset = layoutOffsets[pos] || { dx: 0, dy: 0 };
                                        return (
                                            <g 
                                                transform={`translate(${offset.dx}, ${offset.dy})`}
                                                className={`cursor-pointer transition-all duration-300 ${isOperating ? 'animate-pulse' : ''}`}
                                                onClick={() => {
                                                    handleSelectPositionOnDrawing(pos);
                                                    if (isCalibrating) setCalibTarget(pos);
                                                }}
                                                onMouseEnter={() => setHoveredPosition(pos)}
                                                onMouseLeave={() => setHoveredPosition(null)}
                                            >
                                                <polygon 
                                                    points="330,355 370,355 395,395 305,395" 
                                                    fill={isOperating ? '#0284C7' : isSelected ? '#F59E0B' : 'url(#copperGrad)'} 
                                                    stroke={isOperating ? '#38BDF8' : isCalibActive ? '#38BDF8' : isSelected ? '#FDE68A' : health.color} 
                                                    strokeWidth={isOperating ? 6 : isCalibActive ? 5 : isSelected ? 4 : 2.5}
                                                    strokeDasharray={isCalibActive ? '6,3' : undefined}
                                                    style={{ filter: isOperating ? 'drop-shadow(0 0 16px #38BDF8)' : isSelected ? 'drop-shadow(0 0 10px #F59E0B)' : isPendingTarget ? 'drop-shadow(0 0 6px #FBBF24)' : undefined }}
                                                />
                                                <polygon points="335,360 365,360 385,390 315,390" fill="url(#copperHighlight)" stroke="#5C2B09" strokeWidth="1.5" />
                                                <text x="350" y="380" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" pointerEvents="none">
                                                    #8 BASE LAT
                                                </text>
                                            </g>
                                        );
                                    })()}

                                </svg>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-2 text-center font-mono">
                                💡 {isCalibrating 
                                    ? 'Modo Ajuste Ativo: Clique em qualquer eletrodo acima para selecioná-lo e mova com os botões.'
                                    : 'Clique diretamente sobre qualquer eletrodo no desenho acima para ver a vida útil ou realizar a troca.'}
                            </p>
                        </div>

                        {/* COLUNA DIREITA: PAINEL DINÂMICO DO OPERADOR (Lg: 5 colunas) */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                            {/* ESTADO 1: OPERAÇÃO EM ANDAMENTO (CRONÔMETRO ATIVO) */}
                            {activeOperation ? (() => {
                                const activeCfg = ELECTRODE_POSITIONS_CONFIG.find(c => c.position === activeOperation.position);
                                const activeEl = electrodes.find(e => e.position === activeOperation.position) || currentSelectedElectrode;
                                const isLimpeza = activeOperation.type === 'limpeza';
                                const isAjuste = activeOperation.type === 'ajuste';
                                const isTroca = activeOperation.type === 'troca';

                                return (
                                    <div className={`rounded-3xl p-6 border shadow-2xl flex flex-col justify-between h-full animate-fade-in ${
                                        isLimpeza ? 'bg-gradient-to-b from-cyan-950/70 to-slate-900 border-cyan-500/50 shadow-cyan-950/40' :
                                        isAjuste ? 'bg-gradient-to-b from-teal-950/70 to-slate-900 border-teal-500/50 shadow-teal-950/40' :
                                        'bg-gradient-to-b from-amber-950/70 to-slate-900 border-amber-500/50 shadow-amber-950/40'
                                    }`}>
                                        <div className="space-y-4">
                                            {/* Cabeçalho da Operação */}
                                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-3xl">
                                                        {isLimpeza ? '🧽' : isAjuste ? '📐' : '🔄'}
                                                    </span>
                                                    <div>
                                                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                                                            isLimpeza ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                                                            isAjuste ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' :
                                                            'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                        }`}>
                                                            {isLimpeza ? 'Limpeza de Eletrodo' : isAjuste ? 'Ajuste Mecânico' : 'Troca de Eletrodo'}
                                                        </span>
                                                        <h4 className="text-lg font-black text-white mt-1">
                                                            {activeCfg?.label || activeOperation.position}
                                                        </h4>
                                                        <p className="text-xs text-slate-400 font-mono">
                                                            Lote Atual: <strong className="text-amber-300">#{activeEl?.lot_number || 'S/N'}</strong> (Cód. {activeCfg?.productCode})
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Box do Cronômetro em Tempo Real */}
                                            <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 text-center space-y-1">
                                                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase text-slate-400">
                                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                                                    <span>Tempo em Andamento</span>
                                                </div>
                                                <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-white">
                                                    {formatOperationTimer(opElapsedSeconds)}
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-mono">
                                                    Início gravado: <strong className="text-cyan-300">{activeOperation.startTime.toLocaleTimeString('pt-BR')}</strong>
                                                </p>
                                            </div>

                                            {/* Se for TROCA: Seleção direta do Lote de Reposição do Almoxarifado */}
                                            {isTroca && (
                                                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[11px] font-mono text-amber-300 font-bold uppercase block">
                                                            Selecione o Lote para Montar (Cód. {activeCfg?.productCode}):
                                                        </label>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {compatibleStocks.length} disponível(is)
                                                        </span>
                                                    </div>

                                                    {compatibleStocks.length === 0 ? (
                                                        <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                                                            ⚠️ Nenhum lote com Cód. {activeCfg?.productCode} com saldo no almoxarifado.
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={activeOperation.selectedStockId || ''}
                                                            onChange={e => setActiveOperation(prev => prev ? { ...prev, selectedStockId: e.target.value } : null)}
                                                            className="w-full p-3 bg-slate-900 border border-amber-500/50 rounded-xl text-white font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                                                        >
                                                            <option value="">-- Toque para selecionar o lote --</option>
                                                            {compatibleStocks.map(st => (
                                                                <option key={st.id} value={st.id}>
                                                                    Lote #{st.internalLot || st.supplierLot || 'S/N'} • Saldo: {st.remainingQuantity} un • {st.supplier || 'Metalúrgica Ita'}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Ações de Conclusão / Cancelamento com 1 Clique */}
                                        <div className="space-y-2.5 pt-4">
                                            {isLimpeza && (
                                                <button
                                                    type="button"
                                                    onClick={handleCompleteLimpeza}
                                                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-cyan-900/40 flex items-center justify-center gap-3 animate-pulse"
                                                >
                                                    <span className="text-lg">✓</span>
                                                    <span>Concluir Limpeza (Salvar Tempo)</span>
                                                </button>
                                            )}

                                            {isAjuste && (
                                                <button
                                                    type="button"
                                                    onClick={handleCompleteAjuste}
                                                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-teal-900/40 flex items-center justify-center gap-3 animate-pulse"
                                                >
                                                    <span className="text-lg">✓</span>
                                                    <span>Concluir Ajuste (Salvar Tempo)</span>
                                                </button>
                                            )}

                                            {isTroca && (
                                                <button
                                                    type="button"
                                                    onClick={handleCompleteTroca}
                                                    disabled={!activeOperation.selectedStockId || compatibleStocks.length === 0}
                                                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider transition active:scale-95 shadow-xl shadow-amber-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
                                                >
                                                    <RefreshIcon className="h-5 w-5" />
                                                    <span>Concluir Troca (Baixar Estoque)</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setActiveOperation(null)}
                                                className="w-full py-2.5 rounded-xl text-slate-400 hover:text-white font-bold text-xs uppercase transition hover:bg-slate-800"
                                            >
                                                ✕ Cancelar Operação
                                            </button>
                                        </div>
                                    </div>
                                );
                            })() : selectedPosition && currentSelectedElectrode && currentConfig ? (() => {
                                /* ESTADO 2: ELETRODO SELECIONADO NO DESENHO (PERGUNTA DIRETA AO OPERADOR) */
                                const health = getElectrodeHealth(selectedPosition);
                                const benchmark = currentSelectedElectrode.benchmark_meters || currentConfig.benchmarkMeters || 15000;
                                const meters = currentSelectedElectrode.meters_produced || 0;
                                const percent = Math.min(100, Math.round((meters / benchmark) * 100));

                                return (
                                    <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between h-full animate-fade-in">
                                        <div className="space-y-4">
                                            {/* Cabeçalho do Eletrodo Selecionado */}
                                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] uppercase font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                                                            {currentConfig.type}
                                                        </span>
                                                        <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                                                            Cód. {currentConfig.productCode}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-xl font-black text-white mt-1">
                                                        {currentConfig.label}
                                                    </h4>
                                                    <p className="text-[11px] text-teal-300 font-mono font-bold">
                                                        {currentConfig.modelDescription}
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                        Lote Montado: <strong className="text-amber-300">#{currentSelectedElectrode.lot_number || 'Não Vinculado'}</strong>
                                                    </p>
                                                </div>

                                                <span className={`text-xs font-mono font-black px-3 py-1 rounded-full uppercase border ${
                                                    health.statusText === 'Crítico' 
                                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                                        : health.statusText === 'Atenção'
                                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                }`}>
                                                    {health.statusText} ({percent}%)
                                                </span>
                                            </div>

                                            {/* Pergunta Direta ao Operador */}
                                            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">⚡</span>
                                                    <h5 className="text-sm font-black text-white">
                                                        O que você deseja fazer neste eletrodo?
                                                    </h5>
                                                </div>

                                                <div className="space-y-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => startOperation('limpeza')}
                                                        disabled={readOnly}
                                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wide transition active:scale-95 shadow-md shadow-cyan-900/30 flex items-center justify-between gap-2 disabled:opacity-50"
                                                    >
                                                        <span className="flex items-center gap-2.5 text-sm">
                                                            <span>🧽</span>
                                                            <span>Limpeza de Eletrodo</span>
                                                        </span>
                                                        <span className="text-[10px] font-mono text-cyan-200 uppercase bg-black/20 px-2 py-0.5 rounded">
                                                            Início / Fim
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => startOperation('ajuste')}
                                                        disabled={readOnly}
                                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wide transition active:scale-95 shadow-md shadow-teal-900/30 flex items-center justify-between gap-2 disabled:opacity-50"
                                                    >
                                                        <span className="flex items-center gap-2.5 text-sm">
                                                            <span>📐</span>
                                                            <span>Ajuste (Altura / Ângulo)</span>
                                                        </span>
                                                        <span className="text-[10px] font-mono text-emerald-200 uppercase bg-black/20 px-2 py-0.5 rounded">
                                                            Início / Fim
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => startOperation('troca')}
                                                        disabled={readOnly}
                                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wide transition active:scale-95 shadow-md shadow-amber-500/20 flex items-center justify-between gap-2 disabled:opacity-50"
                                                    >
                                                        <span className="flex items-center gap-2.5 text-sm font-black">
                                                            <RefreshIcon className="h-4 w-4" />
                                                            <span>Trocar Eletrodo</span>
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-950 uppercase bg-black/10 px-2 py-0.5 rounded font-bold">
                                                            Escolher Lote
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Indicadores Compactos de Desgaste e Metros */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-mono">
                                                    <span className="text-slate-400">Metros Soldados:</span>
                                                    <span className="font-bold text-white">
                                                        {meters.toLocaleString('pt-BR')} m <span className="text-slate-500">/ {benchmark.toLocaleString('pt-BR')} m</span>
                                                    </span>
                                                </div>

                                                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-700 ${
                                                            percent >= 90 ? 'bg-rose-500 shadow-[0_0_8px_#F43F5E]' :
                                                            percent >= 70 ? 'bg-amber-500 shadow-[0_0_6px_#F59E0B]' :
                                                            'bg-emerald-500 shadow-[0_0_6px_#10B981]'
                                                        }`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 font-mono mt-2">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 uppercase block">Peças Soldadas</span>
                                                        <span className="text-xs font-bold text-slate-200">
                                                            {currentSelectedElectrode.pieces_produced?.toLocaleString('pt-BR') || '0'} pçs
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 uppercase block">Limpezas Feitas</span>
                                                        <span className="text-xs font-bold text-cyan-300">
                                                            {currentSelectedElectrode.clean_count || 0} vezes
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedPosition(null)}
                                            className="text-center text-[11px] text-slate-500 hover:text-slate-300 pt-3 transition font-mono"
                                        >
                                            ← Fechar seleção do eletrodo
                                        </button>
                                    </div>
                                );
                            })() : (
                                /* ESTADO 3: NENHUM ELETRODO SELECIONADO (TELA INICIAL DE CONVITE & ATALHOS RÁPIDOS) */
                                <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between h-full space-y-6 animate-fade-in">
                                    <div className="space-y-4">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
                                            ⚡
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-white">
                                                Comando de Solda &amp; Eletrodos
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Toque em qualquer eletrodo no desenho do cabeçote ao lado para inspecionar, ou escolha a parada abaixo:
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                                            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
                                                Escolha a Operação:
                                            </span>
                                            <div className="grid grid-cols-1 gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingActionType('limpeza')}
                                                    className={`w-full py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wide transition flex items-center justify-between ${
                                                        pendingActionType === 'limpeza' 
                                                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-900/40 ring-2 ring-cyan-400' 
                                                            : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-slate-700'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span>🧽</span>
                                                        <span>Limpeza de Eletrodo</span>
                                                    </span>
                                                    <span className="text-[10px] font-mono">
                                                        {pendingActionType === 'limpeza' ? '👆 Toque no desenho' : 'Iniciar'}
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setPendingActionType('ajuste')}
                                                    className={`w-full py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wide transition flex items-center justify-between ${
                                                        pendingActionType === 'ajuste' 
                                                            ? 'bg-teal-600 text-white border-teal-400 shadow-lg shadow-teal-900/40 ring-2 ring-teal-400' 
                                                            : 'bg-slate-900 hover:bg-slate-800 text-teal-300 border-slate-700'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span>📐</span>
                                                        <span>Ajuste (Altura / Ângulo)</span>
                                                    </span>
                                                    <span className="text-[10px] font-mono">
                                                        {pendingActionType === 'ajuste' ? '👆 Toque no desenho' : 'Iniciar'}
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setPendingActionType('troca')}
                                                    className={`w-full py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wide transition flex items-center justify-between ${
                                                        pendingActionType === 'troca' 
                                                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300' 
                                                            : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <RefreshIcon className="h-4 w-4" />
                                                        <span>Trocar Eletrodo</span>
                                                    </span>
                                                    <span className="text-[10px] font-mono">
                                                        {pendingActionType === 'troca' ? '👆 Toque no desenho' : 'Iniciar'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resumo Rápido */}
                                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 font-mono text-slate-400">
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase block">Eletrodos Ativos</span>
                                            <span className="text-sm font-bold text-white">12 posições</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase block">Almoxarifado</span>
                                            <span className="text-sm font-bold text-amber-400">
                                                {electrodeStockList.reduce((acc, s) => acc + (s.remainingQuantity || 0), 0)} un disponíveis
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: RELATÓRIO COMPLETO E HISTÓRICO DE TROCAS, LIMPEZAS E AJUSTES */}
            {activeTab === 'reports' && (() => {
                const totalCleans = history.filter(h => h.reason === 'Limpeza de Eletrodo').length;
                const totalAdjusts = history.filter(h => h.reason === 'Ajuste de Altura / Ângulo').length;
                const totalDresses = history.filter(h => h.reason === 'Retífica / Lixamento').length;
                const totalChanges = history.filter(h => h.reason !== 'Limpeza de Eletrodo' && h.reason !== 'Ajuste de Altura / Ângulo' && h.reason !== 'Retífica / Lixamento').length;

                const filteredHistory = history.filter(h => {
                    if (reportFilterPosition !== 'all' && h.position !== reportFilterPosition) return false;
                    if (reportFilterType === 'troca' && (h.reason === 'Limpeza de Eletrodo' || h.reason === 'Ajuste de Altura / Ângulo' || h.reason === 'Retífica / Lixamento')) return false;
                    if (reportFilterType === 'limpeza' && h.reason !== 'Limpeza de Eletrodo') return false;
                    if (reportFilterType === 'ajuste' && h.reason !== 'Ajuste de Altura / Ângulo') return false;
                    if (reportFilterType === 'retifica' && h.reason !== 'Retífica / Lixamento') return false;
                    return true;
                });

                const handleExportCSV = () => {
                    if (filteredHistory.length === 0) {
                        alert('Nenhum registro para exportar.');
                        return;
                    }
                    const headers = ['Data / Hora', 'Eletrodo', 'Evento / Motivo', 'Lote', 'Metros Produzidos', 'Peças Produzidas', 'Responsável', 'Destino', 'Observações'];
                    const rows = filteredHistory.map(h => [
                        new Date(h.created_at || h.removed_at || '').toLocaleString('pt-BR'),
                        h.position_label,
                        h.reason,
                        h.lot_number || 'S/L',
                        h.meters_produced || 0,
                        h.pieces_produced || 0,
                        h.removed_by || '--',
                        h.destination || '--',
                        `"${(h.notes || '').replace(/"/g, '""')}"`
                    ]);
                    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `relatorio_eletrodos_${machineName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                };

                return (
                    <div className="flex flex-col gap-5 animate-fade-in">
                        {/* Painel de Indicadores Consolidados */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">Eletrodos Ativos</span>
                                <span className="text-2xl font-black text-white mt-1 block">
                                    {electrodes.length} / {ELECTRODE_POSITIONS_CONFIG.length}
                                </span>
                                <span className="text-[10px] text-emerald-400 font-mono">100% Instalados</span>
                            </div>
                            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">Trocas Registradas</span>
                                <span className="text-2xl font-black text-amber-400 mt-1 block">
                                    {totalChanges}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">Histórico de trocas</span>
                            </div>
                            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">Limpezas Efetuadas</span>
                                <span className="text-2xl font-black text-cyan-400 mt-1 block">
                                    {totalCleans}
                                </span>
                                <span className="text-[10px] text-cyan-300 font-mono">Preventivas / Carepa</span>
                            </div>
                            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold block">Ajustes &amp; Retíficas</span>
                                <span className="text-2xl font-black text-teal-400 mt-1 block">
                                    {totalAdjusts + totalDresses}
                                </span>
                                <span className="text-[10px] text-teal-300 font-mono">{totalAdjusts} ajustes / {totalDresses} retíficas</span>
                            </div>
                        </div>

                        {/* Filtros da Tabela de Relatório & Ações Rápidas */}
                        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-400 font-mono font-bold">Eletrodo:</label>
                                    <select
                                        value={reportFilterPosition}
                                        onChange={e => setReportFilterPosition(e.target.value)}
                                        className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-amber-400"
                                    >
                                        <option value="all">Todos os Componentes ({ELECTRODE_POSITIONS_CONFIG.length} Posições)</option>
                                        {ELECTRODE_POSITIONS_CONFIG.map(cfg => (
                                            <option key={cfg.position} value={cfg.position}>{cfg.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-400 font-mono font-bold">Tipo de Evento:</label>
                                    <select
                                        value={reportFilterType}
                                        onChange={e => setReportFilterType(e.target.value)}
                                        className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-cyan-400"
                                    >
                                        <option value="all">Todos os Eventos ({history.length})</option>
                                        <option value="troca">Troca / Substituição ({totalChanges})</option>
                                        <option value="limpeza">Limpeza de Face / Carepa ({totalCleans})</option>
                                        <option value="ajuste">Ajuste de Altura / Ângulo ({totalAdjusts})</option>
                                        <option value="retifica">Retífica / Lixamento ({totalDresses})</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 font-mono">
                                    Mostrando <strong>{filteredHistory.length}</strong> registro(s)
                                </span>

                                <button
                                    type="button"
                                    onClick={handleExportCSV}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                                    title="Exportar registros filtrados para planilha CSV"
                                >
                                    <span>📥</span>
                                    <span>Exportar CSV</span>
                                </button>

                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setManualEntry({
                                                position: (selectedPosition || 'superior_dir'),
                                                reason: 'Limpeza de Eletrodo',
                                                date: new Date().toISOString().slice(0, 16),
                                                lotNumber: '',
                                                removedBy: 'Operador',
                                                destination: 'Mantido na Máquina',
                                                notes: ''
                                            });
                                            setShowManualRecordModal(true);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-mono font-black flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20"
                                        title="Registrar manualmente um evento passado de troca, limpeza ou ajuste"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span>+ Novo Evento</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tabela de Relatório e Histórico */}
                        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-slate-300 font-mono">
                                    <thead className="!bg-[#07131D] text-[10px] uppercase border-b border-slate-800">
                                        <tr>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Data / Hora</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Eletrodo</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Evento / Motivo</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Lote</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Metros / Peças</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800 whitespace-nowrap">Responsável</th>
                                            <th className="p-3 !bg-[#07131D] !text-slate-300 font-bold border-b border-slate-800">Destino / Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredHistory.map(item => {
                                            const isClean = item.reason === 'Limpeza de Eletrodo';
                                            const isAdjust = item.reason === 'Ajuste de Altura / Ângulo';
                                            const isDress = item.reason === 'Retífica / Lixamento';
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                                                    <td className="p-3 text-slate-400 whitespace-nowrap">
                                                        {new Date(item.created_at || item.removed_at || '').toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="p-3 font-bold text-white whitespace-nowrap">
                                                        {item.position_label}
                                                    </td>
                                                    <td className="p-3 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                            isClean
                                                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                                                : isAdjust
                                                                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                                                    : isDress
                                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                        }`}>
                                                            {item.reason}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-amber-300 whitespace-nowrap font-mono font-bold">
                                                        #{item.lot_number || 'S/L'}
                                                    </td>
                                                    <td className="p-3 whitespace-nowrap">
                                                        {item.meters_produced ? `${item.meters_produced.toLocaleString('pt-BR')} m` : '--'}
                                                        {item.pieces_produced ? ` (${item.pieces_produced} pçs)` : ''}
                                                    </td>
                                                    <td className="p-3 text-slate-200 whitespace-nowrap">
                                                        {item.removed_by || '--'}
                                                    </td>
                                                    <td className="p-3 text-slate-400 max-w-sm truncate" title={item.notes || item.destination}>
                                                        {item.destination ? <strong className="text-slate-300">[{item.destination}] </strong> : ''}
                                                        {item.notes || '--'}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredHistory.length === 0 && history.length > 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 font-mono">
                                                    Nenhum registro encontrado para os filtros selecionados.
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReportFilterPosition('all');
                                                            setReportFilterType('all');
                                                        }}
                                                        className="block mx-auto mt-2 text-xs text-amber-400 underline hover:text-amber-300"
                                                    >
                                                        Limpar Filtros
                                                    </button>
                                                </td>
                                            </tr>
                                        )}

                                        {history.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                                                    Nenhum histórico registrado até o momento. As trocas, limpezas e regulagens efetuadas aparecerão aqui.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal de Registro Manual de Evento */}
                        {showManualRecordModal && (
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                                <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📝</span>
                                            <h4 className="text-base font-black text-white">
                                                Registrar Evento Manual de Solda
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowManualRecordModal(false)}
                                            className="text-slate-400 hover:text-white p-1"
                                        >
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <label className="block text-slate-400 font-mono mb-1 font-bold">Componente / Eletrodo:</label>
                                            <select
                                                value={manualEntry.position}
                                                onChange={e => setManualEntry({ ...manualEntry, position: e.target.value as TrelicaElectrodePosition })}
                                                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                            >
                                                {ELECTRODE_POSITIONS_CONFIG.map(cfg => (
                                                    <option key={cfg.position} value={cfg.position}>
                                                        {cfg.label} (Cód. {cfg.productCode})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-slate-400 font-mono mb-1 font-bold">Tipo de Ação:</label>
                                                <select
                                                    value={manualEntry.reason}
                                                    onChange={e => setManualEntry({ ...manualEntry, reason: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                                >
                                                    <option value="Limpeza de Eletrodo">Limpeza de Eletrodo</option>
                                                    <option value="Ajuste de Altura / Ângulo">Ajuste de Altura / Ângulo</option>
                                                    <option value="Troca de Eletrodo">Troca de Eletrodo</option>
                                                    <option value="Retífica / Lixamento">Retífica / Lixamento</option>
                                                    <option value="Troca Preventiva">Troca Preventiva</option>
                                                    <option value="Trinca / Quebra">Trinca / Quebra</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-slate-400 font-mono mb-1 font-bold">Data / Hora:</label>
                                                <input
                                                    type="datetime-local"
                                                    value={manualEntry.date}
                                                    onChange={e => setManualEntry({ ...manualEntry, date: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-slate-400 font-mono mb-1 font-bold">Lote Vinculado:</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: EL-1000-01"
                                                    value={manualEntry.lotNumber}
                                                    onChange={e => setManualEntry({ ...manualEntry, lotNumber: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-slate-400 font-mono mb-1 font-bold">Responsável:</label>
                                                <input
                                                    type="text"
                                                    placeholder="Nome ou turno"
                                                    value={manualEntry.removedBy}
                                                    onChange={e => setManualEntry({ ...manualEntry, removedBy: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 font-mono mb-1 font-bold">Destino / Condição:</label>
                                            <select
                                                value={manualEntry.destination}
                                                onChange={e => setManualEntry({ ...manualEntry, destination: e.target.value })}
                                                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                            >
                                                <option value="Mantido na Máquina">Mantido na Máquina</option>
                                                <option value="Retífica / Usinagem">Retífica / Usinagem</option>
                                                <option value="Retorno ao Estoque">Retorno ao Estoque</option>
                                                <option value="Sucata / Descarte">Sucata / Descarte</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 font-mono mb-1 font-bold">Observações / Detalhes:</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Descreva detalhes da intervenção, causa ou parâmetros..."
                                                value={manualEntry.notes}
                                                onChange={e => setManualEntry({ ...manualEntry, notes: e.target.value })}
                                                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setShowManualRecordModal(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveManualRecord}
                                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-mono font-black text-xs shadow-md shadow-amber-500/20"
                                        >
                                            Salvar no Histórico
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ABA 3: ALMOXARIFADO E ESTOQUE DE ELETRODOS */}
            {activeTab === 'stock' && (() => {
                const totalUnits = electrodeStockList.reduce((acc, s) => acc + (s.remainingQuantity || 0), 0);
                const availableLotsCount = electrodeStockList.filter(s => (s.remainingQuantity || 0) > 0).length;

                // Filtragem por modelo e busca
                const filteredStocks = electrodeStockList.filter(s => {
                    if (stockFilterModel !== 'all' && s.productCode !== stockFilterModel && s.bitola !== stockFilterModel) {
                        return false;
                    }
                    if (stockSearchTerm.trim()) {
                        const term = stockSearchTerm.toLowerCase();
                        const lot = (s.internalLot || s.supplierLot || '').toLowerCase();
                        const code = (s.productCode || s.bitola || '').toLowerCase();
                        const desc = (s.description || '').toLowerCase();
                        const supp = (s.supplier || '').toLowerCase();
                        if (!lot.includes(term) && !code.includes(term) && !desc.includes(term) && !supp.includes(term)) {
                            return false;
                        }
                    }
                    return true;
                });

                return (
                    <div className="flex flex-col gap-4 animate-fade-in">
                        {/* Cabeçalho do Almoxarifado */}
                        <div className="p-4 bg-slate-900/90 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-2xl">📦</span>
                                    <div>
                                        <h4 className="text-base font-black text-white uppercase tracking-wide">
                                            Estoque do Almoxarifado de Eletrodos
                                        </h4>
                                        <p className="text-xs text-slate-400">
                                            Integrado à Gestão de Estoque Geral (Material: <em>Eletrodos Treliças</em>). Lotes disponíveis para montagem e reposição.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="px-3.5 py-1.5 rounded-xl bg-teal-950/70 border border-teal-500/40 font-mono text-xs text-teal-300 font-bold flex items-center gap-2 shadow-inner">
                                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                                    <span>Saldo Total: <strong className="text-white text-sm">{totalUnits} un</strong></span>
                                </div>
                                <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-xs text-slate-300">
                                    <span>Lotes com Saldo: <strong className="text-white">{availableLotsCount}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Barra de Filtros */}
                        <div className="p-3 bg-slate-900/70 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                            <div className="flex-1 w-full">
                                <input
                                    type="text"
                                    value={stockSearchTerm}
                                    onChange={e => setStockSearchTerm(e.target.value)}
                                    placeholder="Buscar por lote, modelo, código ou fornecedor..."
                                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-amber-400 outline-none"
                                />
                            </div>

                            <div className="w-full sm:w-auto">
                                <select
                                    value={stockFilterModel}
                                    onChange={e => setStockFilterModel(e.target.value)}
                                    className="w-full sm:w-64 p-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none"
                                >
                                    <option value="all">-- Todos os 12 Modelos --</option>
                                    {DefaultElectrodeGauges.map(g => (
                                        <option key={g.productCode} value={g.productCode}>
                                            Cód. {g.productCode} - {g.description}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Grid dos Cards de Lotes */}
                        {filteredStocks.length === 0 ? (
                            <div className="p-10 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-3">
                                <span className="text-4xl block">📦</span>
                                <h5 className="text-base font-black text-white">Nenhum lote de eletrodo cadastrado no estoque</h5>
                                <p className="text-xs text-slate-400 max-w-md mx-auto">
                                    Todos os eletrodos são puxados diretamente pelo cadastro feito em <strong>Estoque</strong>. Quando der entrada através de <strong>+ Novo Recebimento</strong> (selecionando o material <em>Eletrodos Treliças</em>), os lotes e saldos disponíveis aparecerão aqui para montagem.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredStocks.map(st => {
                                    const code = st.productCode || st.bitola || '';
                                    const matchingConfig = ELECTRODE_POSITIONS_CONFIG.find(c => c.productCode === code);
                                    const qty = st.remainingQuantity || 0;
                                    const isAvailable = qty > 0;

                                    return (
                                        <div 
                                            key={st.id} 
                                            className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                                                isAvailable 
                                                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
                                                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                            Cód. {code || 'S/C'}
                                                        </span>
                                                        {matchingConfig && (
                                                            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                                {matchingConfig.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="text-sm font-black text-white mt-1.5">
                                                        {st.description || matchingConfig?.modelDescription || `Eletrodo Cód. ${code}`}
                                                    </h5>
                                                    <p className="text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                                                        Lote #{st.internalLot || st.supplierLot || 'S/N'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                        Fornecedor: {st.supplier || 'Metalúrgica Ita Soldas'}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                                    isAvailable
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                }`}>
                                                    {isAvailable ? 'Disponível' : 'Esgotado'}
                                                </span>
                                            </div>

                                            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                                                <div className="flex items-center justify-between font-mono text-xs">
                                                    <span className="text-slate-400">Saldo Disponível:</span>
                                                    <span className={`text-base font-black ${isAvailable ? 'text-white' : 'text-rose-400'}`}>
                                                        {qty} unidades
                                                    </span>
                                                </div>

                                                {isAvailable && matchingConfig && !readOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPosition(matchingConfig.position);
                                                            setActiveTab('digital_twin');
                                                            startOperation('troca', matchingConfig.position);
                                                        }}
                                                        className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-amber-600/30 hover:border-amber-500/50 border border-slate-700 text-amber-300 text-xs font-bold font-mono transition flex items-center justify-center gap-1.5 active:scale-95"
                                                    >
                                                        <span>⚡ Montar na Posição #{matchingConfig.shortLabel}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};

export default TrelicaWeldingHead;
