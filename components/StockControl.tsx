import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowLeftIcon, CameraIcon, TrashIcon, CheckCircleIcon, DocumentReportIcon,
    AdjustmentsIcon, PencilIcon, BookOpenIcon, SearchIcon, FilterIcon, XIcon, PrinterIcon,
    ArrowPathIcon, DownloadIcon, PlusIcon, ArchiveIcon
} from './icons';
import type {
    ConferenceLotData, ConferenceData, StockItem, Bitola, MaterialType, Page, StockGauge, User, TransferRecord,
    TrelicaElectrodeStock, TrelicaElectrodeType
} from '../types';
import {
    FioMaquinaBitolaOptions, TrefilaBitolaOptions, MaterialOptions, CA60BitolaOptions, SteelTypeOptions, DefaultElectrodeGauges, DefaultSabaoGauges, DefaultTrelicaGauges
} from '../types';
import { extractLotDataFromImage } from '../services/geminiService';
import ConferenceReport from './ConferenceReport';
import FinishedConferencesModal from './FinishedConferencesModal';
import LotHistoryModal from './LotHistoryModal';
import StockMovementsTable from './StockMovementsTable';
import { StockPrintModal } from './StockPrintModal';
import {
    getLocalElectrodeStock, saveLocalElectrodeStock, generateNextElectrodeLot, DEFAULT_BENCHMARK_METERS, getElectrodeTypePrefix
} from './ElectrodeStockManager';
import { fetchTable, insertItem, updateItem, deleteItem } from '../services/supabaseService';

const ELECTRODE_TYPE_DETAILS: Record<TrelicaElectrodeType, { name: string; app: string; color: string; badge: string }> = {
    'Superior': {
        name: 'Eletrodo Superior',
        app: 'Ponta de solda dos banzos superiores (Esq / Dir)',
        color: 'text-amber-500 bg-amber-50 border-amber-200',
        badge: '⚡ Superior'
    },
    'Base Superior': {
        name: 'Base do Eletrodo Superior',
        app: 'Porta-eletrodo condutor superior (Esq / Dir)',
        color: 'text-orange-500 bg-orange-50 border-orange-200',
        badge: '🧱 Base Sup.'
    },
    'Central Triangular': {
        name: 'Central Triangular',
        app: 'Cunha de apoio condutor central com ranhura',
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        badge: '🔺 Central Tri.'
    },
    'Inferior': {
        name: 'Eletrodo Inferior',
        app: 'Ponta de solda dos banzos inferiores (Esq / Dir)',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        badge: '⚡ Inferior'
    },
    'Base Inferior': {
        name: 'Base do Eletrodo Inferior',
        app: 'Porta-eletrodo condutor inferior (Esq / Dir)',
        color: 'text-teal-600 bg-teal-50 border-teal-200',
        badge: '🧱 Base Inf.'
    },
    'Lateral': {
        name: 'Eletrodo Lateral',
        app: 'Pastilha de solda lateral dos banzos (Esq / Dir)',
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        badge: '⚡ Lateral'
    },
    'Base Lateral': {
        name: 'Base do Eletrodo Lateral',
        app: 'Base suporte de fixação do eletrodo lateral',
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        badge: '🧱 Base Lat.'
    },
    'Base': {
        name: 'Base Geral',
        app: 'Bloco condutor de contato',
        color: 'text-slate-600 bg-slate-50 border-slate-200',
        badge: '🧱 Base'
    }
};

const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-0.5 rounded text-[10px] font-bold border";
    switch (status) {
        case 'Disponível': return <span className={`${baseClass} bg-emerald-100 text-emerald-800 border-emerald-200`}>Disponível</span>;
        case 'Disponível - Suporte Treliça': return <span className={`${baseClass} bg-blue-100 text-blue-800 border-blue-200`}>Suporte Treliça</span>;
        case 'Em Produção - Trefila': return <span className={`${baseClass} bg-amber-100 text-amber-800 border-amber-200`}>Em Prod. Trefila</span>;
        case 'Em Produção - Treliça': return <span className={`${baseClass} bg-purple-100 text-purple-800 border-purple-200`}>Em Prod. Treliça</span>;
        case 'Consumido': return <span className={`${baseClass} bg-slate-100 text-slate-400 border-slate-200 italic`}>Consumido</span>;
        default: return <span className={`${baseClass} bg-slate-100 text-slate-500 border-slate-200`}>{status}</span>;
    }
};

interface GaugeOption {
    gauge: string;
    code?: string;
    description?: string;
    key: string;
    label: string;
    tamanho?: string;
    superior?: string;
    inferior?: string;
    senozoide?: string;
    peso_final?: string;
}

const getGaugeOptionsForMaterial = (material: string, gauges: StockGauge[]): GaugeOption[] => {
    let customGauges = gauges.filter(g => g.materialType === material);
    
    if (material === 'Eletrodos Treliças' && customGauges.length === 0) {
        customGauges = DefaultElectrodeGauges.map(e => ({
            id: `default_el_${e.productCode}`,
            materialType: e.materialType,
            gauge: e.gauge,
            productCode: e.productCode,
            description: e.description
        })) as StockGauge[];
    } else if (material === 'Treliça' && customGauges.length === 0) {
        customGauges = DefaultTrelicaGauges.map(t => ({
            id: `default_tr_${t.productCode}`,
            materialType: 'Treliça',
            gauge: t.gauge,
            productCode: t.productCode,
            description: t.description,
            tamanho: t.tamanho,
            superior: t.superior,
            inferior: t.inferior,
            senozoide: t.senozoide,
            peso_final: t.peso_final,
            peso_superior: t.peso_superior,
            peso_inferior: t.peso_inferior,
            peso_senozoide: t.peso_senozoide
        })) as StockGauge[];
    }

    const options: GaugeOption[] = [];

    customGauges.forEach(g => {
        if (material === 'Eletrodos Treliças') {
            const desc = g.description || `Eletrodo Cód. ${g.productCode || g.gauge}`;
            const code = g.productCode ? ` (Cód. ${g.productCode})` : '';
            options.push({
                gauge: g.gauge,
                code: g.productCode,
                description: g.description,
                key: `${g.gauge}::${g.productCode || ''}::${g.description || ''}`,
                label: `${desc}${code}`
            });
        } else if (material === 'Sabão') {
            const desc = g.description ? ` - ${g.description}` : '';
            const code = g.productCode ? ` (${g.productCode})` : '';
            options.push({
                gauge: g.gauge,
                code: g.productCode,
                description: g.description,
                key: `${g.gauge}::${g.productCode || ''}::${g.description || ''}`,
                label: `${g.gauge}${desc}${code}`
            });
        } else if (material === 'Treliça') {
            const desc = g.description || `Treliça ${g.gauge}`;
            const code = g.productCode ? ` (${g.productCode})` : '';
            const tech = (g.superior && g.inferior && g.senozoide)
                ? ` [Sup: ${g.superior} | Inf: ${g.inferior} | Sen: ${g.senozoide} mm]`
                : '';
            const peso = g.peso_final ? ` - ${g.peso_final} kg/un` : '';
            options.push({
                gauge: g.gauge,
                code: g.productCode,
                description: g.description,
                tamanho: g.tamanho,
                superior: g.superior,
                inferior: g.inferior,
                senozoide: g.senozoide,
                peso_final: g.peso_final,
                key: `${g.gauge}::${g.productCode || ''}::${g.description || ''}`,
                label: `📐 ${desc} ${g.tamanho ? `${g.tamanho}m` : ''}${code}${tech}${peso}`
            });
        } else {
            const desc = g.description ? ` - ${g.description}` : '';
            const code = g.productCode ? ` (${g.productCode})` : '';
            options.push({
                gauge: g.gauge,
                code: g.productCode,
                description: g.description,
                key: `${g.gauge}::${g.productCode || ''}::${g.description || ''}`,
                label: `${g.gauge.replace('.', ',')} mm${desc}${code}`
            });
        }
    });

    // Only fallback to baseGauges IF no gauges are registered at all for this material in DB
    if (material !== 'Eletrodos Treliças' && customGauges.length === 0) {
        if (material === 'Sabão') {
            options.push({
                gauge: 'Saco 25kg',
                code: '00010',
                description: 'Condat',
                key: 'Saco 25kg::00010::Condat',
                label: 'Saco 25kg - Condat (00010)'
            });
        } else if (material === 'Treliça') {
            DefaultTrelicaGauges.forEach(tg => {
                options.push({
                    gauge: tg.gauge,
                    code: tg.productCode,
                    description: tg.description,
                    tamanho: tg.tamanho,
                    superior: tg.superior,
                    inferior: tg.inferior,
                    senozoide: tg.senozoide,
                    peso_final: tg.peso_final,
                    key: `${tg.gauge}::${tg.productCode}::${tg.description}`,
                    label: `📐 ${tg.description} ${tg.tamanho}m (${tg.productCode}) [Sup: ${tg.superior} | Inf: ${tg.inferior} | Sen: ${tg.senozoide} mm] - ${tg.peso_final} kg/un`
                });
            });
        } else {
            const baseGauges = material === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
            baseGauges.forEach(bg => {
                const defDesc = `${material} ${bg.replace('.', ',')} mm`;
                options.push({
                    gauge: bg,
                    code: '',
                    description: defDesc,
                    key: `${bg}::::${defDesc}`,
                    label: `${bg.replace('.', ',')} mm - ${defDesc}`
                });
            });
        }
    }

    return options.sort((a, b) => {
        if (material === 'Treliça') {
            const compDesc = (a.description || '').localeCompare(b.description || '');
            if (compDesc !== 0) return compDesc;
            return (a.code || '').localeCompare(b.code || '');
        }
        if (material === 'Eletrodos Treliças') {
            const codeA = parseInt(a.code || a.gauge) || 0;
            const codeB = parseInt(b.code || b.gauge) || 0;
            if (codeA !== codeB) return codeA - codeB;
            return (a.description || '').localeCompare(b.description || '');
        }
        if (material === 'Sabão') {
            return (a.description || '').localeCompare(b.description || '');
        }
        const diff = parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.'));
        if (diff !== 0) return diff;
        return (a.description || '').localeCompare(b.description || '');
    });
};

export const getNextElectrodeConferenceNumber = (conferences: ConferenceData[] = [], stock: StockItem[] = []): string => {
    const nums: number[] = [];

    for (const c of conferences) {
        if (!c.conferenceNumber) continue;
        const isElectrodeConf = Array.isArray(c.lots) && c.lots.some(l => l.materialType === 'Eletrodos Treliças');
        if (!isElectrodeConf) continue;

        const cleaned = c.conferenceNumber.trim();
        const match = cleaned.match(/^\d+$/);
        if (match) {
            const val = parseInt(match[0], 10);
            if (val >= 10000 && val <= 99999) {
                nums.push(val);
            }
        }
    }

    for (const s of stock) {
        if (s.materialType !== 'Eletrodos Treliças' || !s.conferenceNumber) continue;
        const cleaned = s.conferenceNumber.trim();
        const match = cleaned.match(/^\d+$/);
        if (match) {
            const val = parseInt(match[0], 10);
            if (val >= 10000 && val <= 99999) {
                nums.push(val);
            }
        }
    }

    if (nums.length === 0) {
        return '10000';
    }
    return String(Math.max(...nums) + 1);
};

export const getNextElectrodeInternalLot = (
    stock: StockItem[] = [], 
    currentLots: Partial<ConferenceLotData>[] = [], 
    conferences: ConferenceData[] = []
): string => {
    const nums: number[] = [];

    for (const s of stock) {
        if (s.materialType === 'Eletrodos Treliças' && s.internalLot) {
            const cleaned = s.internalLot.trim();
            const match = cleaned.match(/^\d+$/);
            if (match) {
                const val = parseInt(match[0], 10);
                if (val >= 10000 && val <= 99999) {
                    nums.push(val);
                }
            }
        }
    }

    for (const c of conferences) {
        if (Array.isArray(c.lots)) {
            for (const l of c.lots) {
                if (l.materialType === 'Eletrodos Treliças' && l.internalLot) {
                    const cleaned = l.internalLot.trim();
                    const match = cleaned.match(/^\d+$/);
                    if (match) {
                        const val = parseInt(match[0], 10);
                        if (val >= 10000 && val <= 99999) {
                            nums.push(val);
                        }
                    }
                }
            }
        }
    }

    for (const l of currentLots) {
        if (l.materialType === 'Eletrodos Treliças' && l.internalLot) {
            const cleaned = l.internalLot.trim();
            const match = cleaned.match(/^\d+$/);
            if (match) {
                const val = parseInt(match[0], 10);
                if (val >= 10000 && val <= 99999) {
                    nums.push(val);
                }
            }
        }
    }

    if (nums.length === 0) {
        return '10001';
    }
    return String(Math.max(...nums) + 1);
};

export const getNextSabaoConferenceNumber = (conferences: ConferenceData[] = [], stock: StockItem[] = []): string => {
    const nums: number[] = [];

    const checkStr = (str?: string) => {
        if (!str) return;
        const cleaned = str.trim();
        const match = cleaned.match(/(?:CONF[-_]SB[-_]|SB[-_])(\d+)/i);
        if (match) {
            nums.push(parseInt(match[1], 10));
        } else if (/^\d+$/.test(cleaned)) {
            const val = parseInt(cleaned, 10);
            if (val >= 20000 && val <= 29999) {
                nums.push(val - 20000);
            }
        }
    };

    for (const c of conferences) {
        const isSabaoConf = Array.isArray(c.lots) && c.lots.some(l => l.materialType === 'Sabão');
        if (isSabaoConf || (c.conferenceNumber && c.conferenceNumber.toUpperCase().includes('SB'))) {
            checkStr(c.conferenceNumber);
        }
    }

    for (const s of stock) {
        if (s.materialType === 'Sabão' || (s.conferenceNumber && s.conferenceNumber.toUpperCase().includes('SB'))) {
            checkStr(s.conferenceNumber);
        }
    }

    if (nums.length === 0) {
        return 'CONF-SB-001';
    }
    const nextNum = Math.max(...nums) + 1;
    return `CONF-SB-${String(nextNum).padStart(3, '0')}`;
};

export const getNextSabaoInternalLot = (
    stock: StockItem[] = [], 
    currentLots: Partial<ConferenceLotData>[] = [], 
    conferences: ConferenceData[] = []
): string => {
    const nums: number[] = [];

    const checkStr = (str?: string) => {
        if (!str) return;
        const cleaned = str.trim();
        const match = cleaned.match(/SB[-_]?(\d+)/i);
        if (match) {
            nums.push(parseInt(match[1], 10));
        }
    };

    for (const s of stock) {
        if (s.materialType === 'Sabão' && s.internalLot) {
            checkStr(s.internalLot);
        }
    }

    for (const c of conferences) {
        if (Array.isArray(c.lots)) {
            for (const l of c.lots) {
                if (l.materialType === 'Sabão' && l.internalLot) {
                    checkStr(l.internalLot);
                }
            }
        }
    }

    for (const l of currentLots) {
        if (l.materialType === 'Sabão' && l.internalLot) {
            checkStr(l.internalLot);
        }
    }

    if (nums.length === 0) {
        return 'SB-0001';
    }
    const nextNum = Math.max(...nums) + 1;
    return `SB-${String(nextNum).padStart(4, '0')}`;
};

export const getNextTrelicaConferenceNumber = (conferences: ConferenceData[] = [], stock: StockItem[] = []): string => {
    const nums: number[] = [];

    const checkStr = (str?: string) => {
        if (!str) return;
        const cleaned = str.trim();
        const match = cleaned.match(/(?:CONF[-_]TR[-_]|TR[-_])(\d+)/i);
        if (match) {
            nums.push(parseInt(match[1], 10));
        } else if (/^\d+$/.test(cleaned)) {
            const val = parseInt(cleaned, 10);
            if (val >= 30000 && val <= 39999) {
                nums.push(val - 30000);
            }
        }
    };

    for (const c of conferences) {
        const isTrelicaConf = Array.isArray(c.lots) && c.lots.some(l => l.materialType === 'Treliça');
        if (isTrelicaConf || (c.conferenceNumber && c.conferenceNumber.toUpperCase().includes('TR'))) {
            checkStr(c.conferenceNumber);
        }
    }

    for (const s of stock) {
        if (s.materialType === 'Treliça' || (s.conferenceNumber && s.conferenceNumber.toUpperCase().includes('TR'))) {
            checkStr(s.conferenceNumber);
        }
    }

    if (nums.length === 0) {
        return 'CONF-TR-001';
    }
    const nextNum = Math.max(...nums) + 1;
    return `CONF-TR-${String(nextNum).padStart(3, '0')}`;
};

export const getNextTrelicaInternalLot = (
    stock: StockItem[] = [], 
    currentLots: Partial<ConferenceLotData>[] = [], 
    conferences: ConferenceData[] = []
): string => {
    const nums: number[] = [];

    const checkStr = (str?: string) => {
        if (!str) return;
        const cleaned = str.trim();
        const match = cleaned.match(/TR[-_]?(\d+)/i);
        if (match) {
            nums.push(parseInt(match[1], 10));
        }
    };

    for (const s of stock) {
        if (s.materialType === 'Treliça' && s.internalLot) {
            checkStr(s.internalLot);
        }
    }

    for (const c of conferences) {
        if (Array.isArray(c.lots)) {
            for (const l of c.lots) {
                if (l.materialType === 'Treliça' && l.internalLot) {
                    checkStr(l.internalLot);
                }
            }
        }
    }

    for (const l of currentLots) {
        if (l.materialType === 'Treliça' && l.internalLot) {
            checkStr(l.internalLot);
        }
    }

    if (nums.length === 0) {
        return 'TR-0001';
    }
    const nextNum = Math.max(...nums) + 1;
    return `TR-${String(nextNum).padStart(4, '0')}`;
};

export const getVacantElectrodeLots = (
    stock: StockItem[] = [],
    currentLots: Partial<ConferenceLotData>[] = [],
    conferences: ConferenceData[] = []
): number[] => {
    const usedSet = new Set<number>();

    for (const s of stock) {
        if (s.materialType === 'Eletrodos Treliças' && s.internalLot) {
            const val = parseInt(s.internalLot.trim(), 10);
            if (!isNaN(val) && val >= 10000 && val <= 99999) {
                usedSet.add(val);
            }
        }
    }

    for (const c of conferences) {
        if (Array.isArray(c.lots)) {
            for (const l of c.lots) {
                if (l.materialType === 'Eletrodos Treliças' && l.internalLot) {
                    const val = parseInt(l.internalLot.trim(), 10);
                    if (!isNaN(val) && val >= 10000 && val <= 99999) {
                        usedSet.add(val);
                    }
                }
            }
        }
    }

    for (const l of currentLots) {
        if (l.materialType === 'Eletrodos Treliças' && l.internalLot) {
            const val = parseInt(l.internalLot.trim(), 10);
            if (!isNaN(val) && val >= 10000 && val <= 99999) {
                usedSet.add(val);
            }
        }
    }

    if (usedSet.size === 0) return [];

    const minNum = Math.min(...Array.from(usedSet));
    const maxNum = Math.max(...Array.from(usedSet));

    const start = usedSet.has(10000) ? 10000 : (minNum >= 10001 ? 10001 : minNum);
    const vacant: number[] = [];

    for (let i = start; i < maxNum; i++) {
        if (!usedSet.has(i)) {
            vacant.push(i);
        }
    }

    return vacant.sort((a, b) => a - b);
};

const AddConferencePage: React.FC<{
    onClose: () => void; onSubmit: (d: ConferenceData) => Promise<void>; stock: StockItem[]; onShowReport: (d: ConferenceData) => void;
    conferences: ConferenceData[]; onEditConference: (id: string, d: ConferenceData) => void;
    onDeleteConference: (id: string) => void; gauges: StockGauge[]; isGestor: boolean; setPage: (p: Page) => void;
    initialMaterialType?: MaterialType;
}> = ({ onClose, onSubmit, stock, onShowReport, conferences, onEditConference, onDeleteConference, gauges, isGestor, setPage, initialMaterialType }) => {
    const isInitialElectrode = initialMaterialType === 'Eletrodos Treliças';
    const isInitialSabao = initialMaterialType === 'Sabão';
    const isInitialTrelica = initialMaterialType === 'Treliça';

    const [conferenceData, setConferenceData] = useState<Omit<ConferenceData, 'lots'>>(() => ({
        entryDate: new Date().toISOString().split('T')[0],
        supplier: isInitialElectrode ? 'Cobretec' : isInitialSabao ? 'Condat' : isInitialTrelica ? 'Produção Própria - MSM' : '', 
        nfe: isInitialElectrode ? 'Sem Nota' : isInitialTrelica ? 'Produção Interna' : '', 
        conferenceNumber: isInitialElectrode 
            ? getNextElectrodeConferenceNumber(conferences, stock) 
            : isInitialSabao 
                ? getNextSabaoConferenceNumber(conferences, stock) 
                : isInitialTrelica
                    ? getNextTrelicaConferenceNumber(conferences, stock)
                    : '',
    }));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lots, setLots] = useState<Partial<ConferenceLotData>[]>(() => {
        const mat = isInitialElectrode ? 'Eletrodos Treliças' : isInitialSabao ? 'Sabão' : isInitialTrelica ? 'Treliça' : 'Fio Máquina';
        const defaultOpts = getGaugeOptionsForMaterial(mat, gauges);
        const first = defaultOpts[0];
        const autoLot = isInitialElectrode 
            ? getNextElectrodeInternalLot(stock, [], conferences) 
            : isInitialSabao 
                ? getNextSabaoInternalLot(stock, [], conferences) 
                : isInitialTrelica
                    ? getNextTrelicaInternalLot(stock, [], conferences)
                    : '';

        const trUnitW = parseFloat(first?.peso_final || '6.01');
        const defaultWeight = isInitialElectrode ? 1 : isInitialSabao ? 25 : isInitialTrelica ? Math.round(trUnitW * 100) : 0;

        return [{
            internalLot: autoLot, 
            runNumber: (isInitialElectrode || isInitialSabao || isInitialTrelica) ? '-' : '', 
            steelType: (isInitialElectrode || isInitialSabao || isInitialTrelica) ? '' : '1006', 
            bitola: first ? first.gauge : (isInitialElectrode ? '1000' : isInitialSabao ? 'Saco 25kg' : isInitialTrelica ? '12m' : '8.00'), 
            materialType: mat, 
            productCode: first?.code || (isInitialSabao ? '00010' : isInitialTrelica ? 'H8L12' : ''),
            description: first?.description || (isInitialSabao ? 'Condat' : isInitialTrelica ? 'H-8 LEVE' : ''),
            quantity: isInitialTrelica ? 100 : undefined,
            labelWeight: defaultWeight
        }];
    });
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [historyOpen, setHistoryOpen] = useState(false);
    const [conferenceNumberError, setConferenceNumberError] = useState<string>('');
    const [submitResult, setSubmitResult] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [vacantPrompt, setVacantPrompt] = useState<number | null>(null);
    const [batchBagsModal, setBatchBagsModal] = useState(false);
    const [batchBagsQty, setBatchBagsQty] = useState(10);
    const [batchTrelicaModal, setBatchTrelicaModal] = useState(false);
    const [batchTrelicaBars, setBatchTrelicaBars] = useState(100);

    const isAnyElectrode = useMemo(() => lots.some(l => l.materialType === 'Eletrodos Treliças'), [lots]);
    const isAnySabao = useMemo(() => lots.some(l => l.materialType === 'Sabão'), [lots]);
    const isAnyTrelica = useMemo(() => lots.some(l => l.materialType === 'Treliça'), [lots]);
    const isAnyRawMaterial = useMemo(() => lots.some(l => l.materialType === 'Fio Máquina' || l.materialType === 'CA-60'), [lots]);

    const vacantLots = useMemo(() => {
        if (!isAnyElectrode) return [];
        return getVacantElectrodeLots(stock, lots, conferences);
    }, [isAnyElectrode, stock, lots, conferences]);

    // Sanitize conferenceNumber if it is empty or accidentally contains invalid formatting
    useEffect(() => {
        if (isAnyElectrode) {
            const currentConf = conferenceData.conferenceNumber?.trim() || '';
            const n = parseInt(currentConf, 10);
            if (!currentConf || isNaN(n) || n < 10000 || n > 99999) {
                const nextConf = getNextElectrodeConferenceNumber(conferences, stock);
                setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf }));
            }
        } else if (isAnySabao) {
            const currentConf = conferenceData.conferenceNumber?.trim() || '';
            if (!currentConf || !currentConf.toUpperCase().includes('SB')) {
                const nextConf = getNextSabaoConferenceNumber(conferences, stock);
                setConferenceData(prev => ({ 
                    ...prev, 
                    conferenceNumber: nextConf,
                    supplier: prev.supplier || 'Condat'
                }));
            }
        } else if (isAnyTrelica) {
            const currentConf = conferenceData.conferenceNumber?.trim() || '';
            if (!currentConf || !currentConf.toUpperCase().includes('TR')) {
                const nextConf = getNextTrelicaConferenceNumber(conferences, stock);
                setConferenceData(prev => ({ 
                    ...prev, 
                    conferenceNumber: nextConf,
                    supplier: prev.supplier || 'Produção Própria - MSM',
                    nfe: prev.nfe || 'Produção Interna'
                }));
            }
        }
    }, [isAnyElectrode, isAnySabao, isAnyTrelica, conferences, stock]);

    useEffect(() => {
        if (!conferenceData.conferenceNumber) {
            setConferenceNumberError('');
            return;
        }
        const existingConf = conferences.find(c => Boolean(c.conferenceNumber) && c.conferenceNumber.trim().toLowerCase() === conferenceData.conferenceNumber.trim().toLowerCase());
        if (existingConf) {
            setConferenceNumberError(`A conferência '${conferenceData.conferenceNumber}' já consta no sistema.`);
        } else {
            setConferenceNumberError('');
        }
    }, [conferenceData.conferenceNumber, conferences]);

    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStock = new Set(stock.filter(s => s.status !== 'Consumido').map(i => i.internalLot.trim().toLowerCase()));
        const currentBatch = new Set();
        lots.forEach((l, i) => {
            if (!l.internalLot) return;
            const key = l.internalLot.trim().toLowerCase();
            if (existingStock.has(key)) newErrors[i] = "Já existe no estoque.";
            else if (currentBatch.has(key)) newErrors[i] = "Duplicado nesta lista.";
            currentBatch.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [lots, stock]);

    const addElectrodeLotWithNumber = (lotNumber: string) => {
        const lastLot = lots[lots.length - 1];
        const defaultOpts = getGaugeOptionsForMaterial('Eletrodos Treliças', gauges);
        const fallback = defaultOpts[0];

        setLots(prev => [
            ...prev,
            {
                internalLot: lotNumber,
                runNumber: '-',
                steelType: '',
                bitola: lastLot?.bitola || fallback?.gauge || '1000',
                materialType: 'Eletrodos Treliças',
                productCode: lastLot?.productCode || fallback?.code || '',
                description: lastLot?.description || fallback?.description || '',
                labelWeight: 1
            }
        ]);

        const cNum = conferenceData.conferenceNumber.trim();
        const n = parseInt(cNum, 10);
        if (!cNum || isNaN(n) || n < 10000 || n > 99999) {
            const nextConf = getNextElectrodeConferenceNumber(conferences, stock);
            setConferenceData(p => ({ ...p, conferenceNumber: nextConf }));
        }
    };

    const handleUseVacantLot = (vacantNum: number) => {
        const emptyIdx = lots.findIndex(l => l.materialType === 'Eletrodos Treliças' && !l.internalLot);
        if (emptyIdx >= 0) {
            handleLotChange(emptyIdx, 'internalLot', String(vacantNum));
        } else {
            addElectrodeLotWithNumber(String(vacantNum));
        }
        setVacantPrompt(null);
    };

    const handleGenerateSabaoBatch = (qty: number) => {
        if (qty <= 0) return;
        const defaultOpts = getGaugeOptionsForMaterial('Sabão', gauges);
        const selectedOpt = defaultOpts[0] || { gauge: 'Saco 25kg', code: '00010', description: 'Condat' };

        const newBatchLots: Partial<ConferenceLotData>[] = [];
        const existingValidLots = lots.filter(l => Boolean(l.internalLot));

        for (let i = 0; i < qty; i++) {
            const nextLot = getNextSabaoInternalLot(stock, [...existingValidLots, ...newBatchLots], conferences);
            newBatchLots.push({
                internalLot: nextLot,
                runNumber: '-',
                steelType: '',
                bitola: selectedOpt.gauge,
                materialType: 'Sabão',
                productCode: selectedOpt.code || '00010',
                description: selectedOpt.description || 'Condat',
                labelWeight: 25
            });
        }

        if (lots.length === 1 && (!lots[0].internalLot || (lots[0].materialType === 'Sabão' && !lots[0].internalLot))) {
            setLots(newBatchLots);
        } else {
            setLots(prev => [...prev, ...newBatchLots]);
        }

        setBatchBagsModal(false);
    };

    const handleGenerateTrelicaBatch = (barsQty: number) => {
        if (barsQty <= 0) return;
        const defaultOpts = getGaugeOptionsForMaterial('Treliça', gauges);
        const lastLot = lots[lots.length - 1];
        const selectedOpt = defaultOpts.find(o => o.code === lastLot?.productCode || o.gauge === lastLot?.bitola) || defaultOpts[0] || { 
            gauge: '12m', code: 'H8L12', description: 'H-8 LEVE', peso_final: '6.01' 
        };

        const unitW = parseFloat(selectedOpt.peso_final || '6.01');
        const totalKg = Math.round(unitW * barsQty);

        const existingValidLots = lots.filter(l => Boolean(l.internalLot));
        const nextLot = getNextTrelicaInternalLot(stock, existingValidLots, conferences);

        const newLot: Partial<ConferenceLotData> = {
            internalLot: nextLot,
            runNumber: '-',
            steelType: '',
            bitola: selectedOpt.gauge,
            materialType: 'Treliça',
            productCode: selectedOpt.code || 'H8L12',
            description: selectedOpt.description || 'H-8 LEVE',
            quantity: barsQty,
            labelWeight: totalKg
        };

        if (lots.length === 1 && (!lots[0].internalLot || (lots[0].materialType === 'Treliça' && !lots[0].internalLot))) {
            setLots([newLot]);
        } else {
            setLots(prev => [...prev, newLot]);
        }

        setBatchTrelicaModal(false);
    };

    const handleAddLot = () => {
        const lastLot = lots[lots.length - 1];
        if (lastLot && lastLot.materialType === 'Eletrodos Treliças') {
            const vacantList = getVacantElectrodeLots(stock, lots, conferences);
            if (vacantList.length > 0) {
                setVacantPrompt(vacantList[0]);
                return;
            }

            const nextLot = getNextElectrodeInternalLot(stock, lots, conferences);
            addElectrodeLotWithNumber(nextLot);
        } else if (lastLot && lastLot.materialType === 'Sabão') {
            const nextLot = getNextSabaoInternalLot(stock, lots, conferences);
            const defaultOpts = getGaugeOptionsForMaterial('Sabão', gauges);
            const fallback = defaultOpts[0];
            setLots(prev => [
                ...prev,
                {
                    internalLot: nextLot,
                    runNumber: '-',
                    steelType: '',
                    bitola: lastLot.bitola || fallback?.gauge || 'Saco 25kg',
                    materialType: 'Sabão',
                    productCode: lastLot.productCode || fallback?.code || '00010',
                    description: lastLot.description || fallback?.description || 'Condat',
                    labelWeight: 25
                }
            ]);
        } else if (lastLot && lastLot.materialType === 'Treliça') {
            const nextLot = getNextTrelicaInternalLot(stock, lots, conferences);
            const defaultOpts = getGaugeOptionsForMaterial('Treliça', gauges);
            const fallback = defaultOpts[0];
            const matchingGauge = gauges.find(g => g.materialType === 'Treliça' && (g.productCode === lastLot.productCode || g.description === lastLot.description));
            const unitW = parseFloat(matchingGauge?.peso_final || fallback?.peso_final || '6.01');
            const defaultBars = lastLot.quantity || 100;
            setLots(prev => [
                ...prev,
                {
                    internalLot: nextLot,
                    runNumber: '-',
                    steelType: '',
                    bitola: lastLot.bitola || fallback?.gauge || '12m',
                    materialType: 'Treliça',
                    productCode: lastLot.productCode || fallback?.code || 'H8L12',
                    description: lastLot.description || fallback?.description || 'H-8 LEVE',
                    quantity: defaultBars,
                    labelWeight: Math.round(unitW * defaultBars)
                }
            ]);
        } else {
            setLots([...lots, { ...lastLot, internalLot: '', labelWeight: 0 }]);
        }
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: any) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;

        if (field === 'materialType') {
            if (value === 'Eletrodos Treliças' && isAnyRawMaterial && lots.length > 1) {
                alert('Esta conferência já possui itens de Fio Máquina / CA-60. Não é permitido misturar Eletrodos com Matéria-Prima.');
                return;
            }
            if ((value === 'Fio Máquina' || value === 'CA-60') && isAnyElectrode && lots.length > 1) {
                alert('Esta conferência é exclusiva para Eletrodos Treliças. Finalize esta conferência para cadastrar Matéria-Prima.');
                return;
            }

            const opts = getGaugeOptionsForMaterial(value, gauges);
            if (opts.length > 0) {
                newLots[index].bitola = opts[0].gauge;
                newLots[index].productCode = opts[0].code || '';
                newLots[index].description = opts[0].description || '';
            }

            if (value === 'Eletrodos Treliças') {
                const currentLotVal = newLots[index].internalLot?.trim() || '';
                const isNumeric10k = /^\d{5}$/.test(currentLotVal);
                if (!currentLotVal || !isNumeric10k) {
                    const otherLots = newLots.filter((_, i) => i !== index);
                    const nextLot = getNextElectrodeInternalLot(stock, otherLots, conferences);
                    newLots[index].internalLot = nextLot;
                }
                if (!newLots[index].runNumber || !newLots[index].runNumber.trim()) {
                    newLots[index].runNumber = '-';
                }
                if (!newLots[index].labelWeight || newLots[index].labelWeight === 0) {
                    newLots[index].labelWeight = 1;
                }
                const cNum = conferenceData.conferenceNumber.trim();
                const n = parseInt(cNum, 10);
                if (!cNum || isNaN(n) || n < 10000 || n > 99999) {
                    const nextConf = getNextElectrodeConferenceNumber(conferences, stock);
                    setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf }));
                }
            } else if (value === 'Sabão') {
                const currentLotVal = newLots[index].internalLot?.trim() || '';
                const isSbFormat = /^SB[-_]?\d+/i.test(currentLotVal);
                if (!currentLotVal || !isSbFormat) {
                    const otherLots = newLots.filter((_, i) => i !== index);
                    const nextLot = getNextSabaoInternalLot(stock, otherLots, conferences);
                    newLots[index].internalLot = nextLot;
                }
                newLots[index].runNumber = newLots[index].runNumber || '-';
                newLots[index].steelType = '';
                newLots[index].labelWeight = 25;
                const cNum = conferenceData.conferenceNumber.trim();
                if (!cNum || !cNum.toUpperCase().includes('SB')) {
                    const nextConf = getNextSabaoConferenceNumber(conferences, stock);
                    setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf, supplier: prev.supplier || 'Condat' }));
                }
            } else if (value === 'Treliça') {
                const currentLotVal = newLots[index].internalLot?.trim() || '';
                const isTrFormat = /^TR[-_]?\d+/i.test(currentLotVal);
                if (!currentLotVal || !isTrFormat) {
                    const otherLots = newLots.filter((_, i) => i !== index);
                    const nextLot = getNextTrelicaInternalLot(stock, otherLots, conferences);
                    newLots[index].internalLot = nextLot;
                }
                newLots[index].runNumber = newLots[index].runNumber || '-';
                newLots[index].steelType = '';
                newLots[index].quantity = newLots[index].quantity || 100;
                const unitW = parseFloat(opts[0]?.peso_final || '6.01');
                newLots[index].labelWeight = Math.round(unitW * (newLots[index].quantity || 100));
                const cNum = conferenceData.conferenceNumber.trim();
                if (!cNum || !cNum.toUpperCase().includes('TR')) {
                    const nextConf = getNextTrelicaConferenceNumber(conferences, stock);
                    setConferenceData(prev => ({ 
                        ...prev, 
                        conferenceNumber: nextConf, 
                        supplier: prev.supplier || 'Produção Própria - MSM',
                        nfe: prev.nfe || 'Produção Interna'
                    }));
                }
            }
        }

        setLots(newLots);
    };

    const handleGaugeSelect = (index: number, key: string) => {
        const currentLot = lots[index];
        const opts = getGaugeOptionsForMaterial(currentLot?.materialType || 'Fio Máquina', gauges);
        const selected = opts.find(o => o.key === key);
        if (selected) {
            const newLots = [...lots];
            const oldUnitW = parseFloat(currentLot?.materialType === 'Treliça' ? (opts.find(o => o.code === currentLot.productCode)?.peso_final || '6.01') : '1');
            const newUnitW = parseFloat(selected.peso_final || '6.01');

            const currentQty = newLots[index].quantity || (oldUnitW > 0 && currentLot?.labelWeight ? Math.max(1, Math.round(currentLot.labelWeight / oldUnitW)) : 100);
            let newLabelWeight = newLots[index].labelWeight;
            if (currentLot?.materialType === 'Treliça' && newUnitW > 0) {
                newLabelWeight = Math.round(currentQty * newUnitW);
            }

            newLots[index] = {
                ...newLots[index],
                bitola: selected.gauge,
                productCode: selected.code || '',
                description: selected.description || '',
                quantity: currentLot?.materialType === 'Treliça' ? currentQty : newLots[index].quantity,
                labelWeight: newLabelWeight
            };
            setLots(newLots);
        }
    };

    const handleGlobalScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsScanning(true);
        try {
            const res = await extractLotDataFromImage(file);
            if (res.nfe || res.conferenceNumber) setConferenceData(p => ({ ...p, nfe: res.nfe || p.nfe, conferenceNumber: res.conferenceNumber || p.conferenceNumber }));
            if (res.lots?.length) {
                const mapped = res.lots.map((l: any) => ({
                    internalLot: l.internalLot || '', runNumber: String(l.runNumber || ''),
                    bitola: (l.bitola || '8.00').replace('.', ','), materialType: 'Fio Máquina' as MaterialType, labelWeight: Number(l.labelWeight) || 0
                }));
                setLots(p => (p.length === 1 && !p[0].internalLot) ? mapped : [...p, ...mapped]);
            }
        } catch (e) { alert('Erro na leitura'); } finally { setIsScanning(false); }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting) return;

        let confNum = conferenceData.conferenceNumber.trim();
        const nConf = parseInt(confNum, 10);
        if (isAnyElectrode && (!confNum || isNaN(nConf) || nConf < 10000 || nConf > 99999)) {
            confNum = getNextElectrodeConferenceNumber(conferences, stock);
            setConferenceData(prev => ({ ...prev, conferenceNumber: confNum }));
        } else if (isAnySabao && (!confNum || !confNum.toUpperCase().includes('SB'))) {
            confNum = getNextSabaoConferenceNumber(conferences, stock);
            setConferenceData(prev => ({ ...prev, conferenceNumber: confNum }));
        } else if (isAnyTrelica && (!confNum || !confNum.toUpperCase().includes('TR'))) {
            confNum = getNextTrelicaConferenceNumber(conferences, stock);
            setConferenceData(prev => ({ ...prev, conferenceNumber: confNum }));
        }

        const sanitizedLots = lots.map((l, i) => {
            if (l.materialType === 'Eletrodos Treliças') {
                const lotVal = l.internalLot?.trim() || '';
                const autoLot = lotVal || getNextElectrodeInternalLot(stock, lots.slice(0, i), conferences);
                return {
                    ...l,
                    steelType: '',
                    internalLot: autoLot,
                    runNumber: l.runNumber?.trim() || '-',
                    labelWeight: l.labelWeight && l.labelWeight > 0 ? l.labelWeight : 1
                };
            }
            if (l.materialType === 'Sabão') {
                const lotVal = l.internalLot?.trim() || '';
                const autoLot = lotVal || getNextSabaoInternalLot(stock, lots.slice(0, i), conferences);
                return {
                    ...l,
                    steelType: '',
                    internalLot: autoLot,
                    runNumber: l.runNumber?.trim() || '-',
                    labelWeight: l.labelWeight && l.labelWeight > 0 ? l.labelWeight : 25
                };
            }
            if (l.materialType === 'Treliça') {
                const lotVal = l.internalLot?.trim() || '';
                const autoLot = lotVal || getNextTrelicaInternalLot(stock, lots.slice(0, i), conferences);
                const qty = l.quantity && l.quantity > 0 ? Number(l.quantity) : 100;
                return {
                    ...l,
                    steelType: '',
                    internalLot: autoLot,
                    runNumber: l.runNumber?.trim() || '-',
                    quantity: qty,
                    labelWeight: l.labelWeight && l.labelWeight > 0 ? l.labelWeight : 600
                };
            }
            return l;
        });

        if (Object.keys(duplicateErrors).length > 0) {
            setSubmitResult({ type: 'error', message: 'Existem lotes duplicados ou já cadastrados. Corrija-os antes de finalizar.' });
            return;
        }

        if (conferenceNumberError) {
            setSubmitResult({ type: 'error', message: conferenceNumberError });
            return;
        }

        const validLots = sanitizedLots.filter(l => !!l.internalLot) as ConferenceLotData[];
        if (!validLots.length) {
            setSubmitResult({ type: 'error', message: 'Por favor, adicione pelo menos um lote válido.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const final = { ...conferenceData, conferenceNumber: confNum || conferenceData.conferenceNumber, lots: validLots } as ConferenceData;
            await onSubmit(final); 
            setSubmitResult({ type: 'success', message: 'Conferência registrada no sistema com sucesso!' });
        } catch (error: any) { 
            setIsSubmitting(false); 
            setSubmitResult({ type: 'error', message: error.message || 'Erro ao registrar conferência.' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn">
            {submitResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-in fade-in zoom-in">
                        {submitResult.type === 'success' ? (
                            <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                        ) : (
                            <XIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        )}
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {submitResult.type === 'success' ? 'Sucesso!' : 'Atenção!'}
                        </h3>
                        <p className="text-sm font-medium text-slate-600 mb-6">
                            {submitResult.message}
                        </p>
                        {submitResult.type === 'success' ? (
                            <button 
                                type="button"
                                onClick={() => {
                                    setSubmitResult(null);
                                    const validLots = lots.filter(l => !!l.internalLot) as ConferenceLotData[];
                                    const final = { ...conferenceData, lots: validLots } as ConferenceData;
                                    onShowReport(final);
                                    onClose();
                                }}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                            >
                                OK
                            </button>
                        ) : (
                            <button 
                                type="button"
                                onClick={() => setSubmitResult(null)}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors mb-2"
                            >
                                Voltar e Corrigir
                            </button>
                        )}
                    </div>
                </div>
            )}
            {vacantPrompt !== null && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border-2 border-amber-400">
                        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl font-black">
                            ⚠️
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            Lote Vago Encontrado!
                        </h3>
                        <p className="text-sm text-slate-600 mb-3">
                            O lote <span className="font-extrabold text-amber-700 text-base">{vacantPrompt}</span> ficou vago (foi excluído ou pulado anteriormente).
                        </p>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 font-semibold mb-6">
                            Deseja reutilizar o lote <strong>{vacantPrompt}</strong> nesta nova peça ou continuar a sequência normal a partir do <strong>{getNextElectrodeInternalLot(stock, lots, conferences)}</strong>?
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <button
                                type="button"
                                onClick={() => handleUseVacantLot(vacantPrompt)}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition"
                            >
                                ✓ Sim, Usar Lote Vago ({vacantPrompt})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextSeq = getNextElectrodeInternalLot(stock, lots, conferences);
                                    addElectrodeLotWithNumber(nextSeq);
                                    setVacantPrompt(null);
                                }}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition"
                            >
                                Continuar Sequência Normal ({getNextElectrodeInternalLot(stock, lots, conferences)})
                            </button>
                            <button
                                type="button"
                                onClick={() => setVacantPrompt(null)}
                                className="w-full text-slate-400 hover:text-slate-600 font-semibold text-xs py-1.5 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {historyOpen && <FinishedConferencesModal 
                conferences={conferences} 
                stock={stock} 
                onClose={() => setHistoryOpen(false)} 
                onShowReport={(conf) => {
                    onShowReport(conf);
                    setHistoryOpen(false);
                    onClose();
                }} 
                onEditConference={onEditConference} 
                onDeleteConference={onDeleteConference} 
            />}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 flex items-center gap-2 px-4 font-bold"><ArrowLeftIcon className="h-5 w-5" /> Voltar</button>
                    <button onClick={() => setHistoryOpen(true)} className="bg-white text-slate-600 font-bold py-2 px-4 rounded-lg shadow-sm border">Histórico</button>
                </div>
                <form onSubmit={handleFinalSubmit} className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    {isAnyElectrode && (
                        <div className="bg-amber-100 border-b border-amber-300 px-6 py-2.5 text-xs font-bold text-amber-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🔒</span>
                                <span>TRAVA ATIVA: Conferência exclusiva para Eletrodos Treliças (Fio Máquina e CA-60 bloqueados nesta lista).</span>
                            </div>
                            <span className="bg-amber-200/80 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase text-amber-800">
                                Modo Eletrodos
                            </span>
                        </div>
                    )}
                    <div className="p-6 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                            <input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-2 border rounded text-center" required />
                        </div>
                        <div className="text-center">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
                            <input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} placeholder={isAnyElectrode ? "Ex: Cobretec" : ""} className="w-full p-2 border rounded text-center" required />
                        </div>
                        <div className="text-center">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NFe</label>
                            <input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} placeholder={isAnyElectrode ? "Ex: Sem nota" : ""} className="w-full p-2 border rounded text-center" required />
                        </div>
                        <div className="text-center relative">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Nº Conf.</label>
                                {isAnyElectrode ? (
                                    <span className="text-amber-800 bg-amber-100 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                                        ⚡ Auto (10000+)
                                    </span>
                                ) : isAnySabao ? (
                                    <span className="text-emerald-800 bg-emerald-100 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">
                                        🧼 Auto (CONF-SB-001+)
                                    </span>
                                ) : isAnyTrelica ? (
                                    <span className="text-blue-800 bg-blue-100 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-300">
                                        📐 Auto (CONF-TR-001+)
                                    </span>
                                ) : null}
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={conferenceData.conferenceNumber} 
                                    onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} 
                                    placeholder={isAnyElectrode ? "Ex: 10000" : isAnySabao ? "Ex: CONF-SB-001" : isAnyTrelica ? "Ex: CONF-TR-001" : ""}
                                    className={`w-full p-2 border rounded text-center font-bold ${
                                        isAnyElectrode ? 'bg-amber-50/60 border-amber-300 text-slate-900' :
                                        isAnySabao ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950' :
                                        isAnyTrelica ? 'bg-blue-50/60 border-blue-300 text-blue-950' : ''
                                    } ${conferenceNumberError ? 'border-red-500 bg-red-50' : ''}`} 
                                    required 
                                />
                                {isAnyElectrode && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextConf = getNextElectrodeConferenceNumber(conferences, stock);
                                            setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf }));
                                        }}
                                        title="Recalcular sequência de conferência"
                                        className="absolute right-1 top-1 bottom-1 px-2 text-[10px] font-bold bg-amber-200 text-amber-900 rounded hover:bg-amber-300"
                                    >
                                        Auto
                                    </button>
                                )}
                                {isAnySabao && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextConf = getNextSabaoConferenceNumber(conferences, stock);
                                            setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf }));
                                        }}
                                        title="Recalcular conferência de sabão"
                                        className="absolute right-1 top-1 bottom-1 px-2 text-[10px] font-bold bg-emerald-200 text-emerald-900 rounded hover:bg-emerald-300"
                                    >
                                        Auto
                                    </button>
                                )}
                                {isAnyTrelica && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextConf = getNextTrelicaConferenceNumber(conferences, stock);
                                            setConferenceData(prev => ({ ...prev, conferenceNumber: nextConf }));
                                        }}
                                        title="Recalcular conferência de treliça"
                                        className="absolute right-1 top-1 bottom-1 px-2 text-[10px] font-bold bg-blue-200 text-blue-900 rounded hover:bg-blue-300"
                                    >
                                        Auto
                                    </button>
                                )}
                            </div>
                            {conferenceNumberError && <p className="text-red-500 text-[10px] font-bold absolute -bottom-5 w-full left-0">{conferenceNumberError}</p>}
                        </div>
                    </div>
                    {isAnyElectrode && vacantLots.length > 0 && (
                        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 mx-6 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="text-xs font-black text-amber-900 uppercase tracking-wide">
                                        Atenção: Lote Vago Detectado ({vacantLots.join(', ')})
                                    </p>
                                    <p className="text-xs font-medium text-amber-800">
                                        O número de lote <strong className="text-amber-950 underline">{vacantLots[0]}</strong> está vago/disponível. Deseja usar este lote?
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
                                <button
                                    type="button"
                                    onClick={() => handleUseVacantLot(vacantLots[0])}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2 px-3.5 rounded-lg shadow transition flex items-center gap-1.5"
                                >
                                    ✓ Usar Lote Vago ({vacantLots[0]})
                                </button>
                            </div>
                        </div>
                    )}

                    {isAnySabao && (
                        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3.5 mx-6 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🧼</span>
                                <div>
                                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                                        Entrada de Insumo: Sabão de Trefila (Sacos de 25 kg)
                                    </p>
                                    <p className="text-xs font-medium text-emerald-800">
                                        Lotes sequenciais exclusivos (<strong className="text-emerald-950 font-bold">SB-0001+</strong>) e conferência automática (<strong className="text-emerald-950 font-bold">CONF-SB-001+</strong>).
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBatchBagsModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 px-4 rounded-xl shadow transition flex items-center gap-2 self-end sm:self-center active:scale-95"
                            >
                                📦 Gerar Múltiplos Sacos (25 kg)
                            </button>
                        </div>
                    )}

                    {isAnyTrelica && (
                        <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-3.5 mx-6 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">📐</span>
                                <div>
                                    <p className="text-xs font-black text-blue-900 uppercase tracking-wide">
                                        Entrada / Recebimento de Treliças no Estoque
                                    </p>
                                    <p className="text-xs font-medium text-blue-800">
                                        Lotes sequenciais exclusivos (<strong className="text-blue-950 font-bold">TR-0001+</strong>), conferência (<strong className="text-blue-950 font-bold">CONF-TR-001+</strong>) e peso automático por barra.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal para Adicionar Lote Rápido de Treliça por Barras */}
                    {batchTrelicaModal && (
                        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[130] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                        <span>📐</span> Gerar Lote de Treliças
                                    </h3>
                                    <button onClick={() => setBatchTrelicaModal(false)} className="text-slate-400 hover:text-slate-600">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                        Quantas barras de treliça chegaram?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5000"
                                        value={batchTrelicaBars}
                                        onChange={e => setBatchTrelicaBars(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full p-2.5 border-2 border-blue-400 rounded-xl font-black text-center text-lg text-blue-900 bg-blue-50/40 outline-none"
                                        autoFocus
                                    />
                                    {(() => {
                                        const lastLot = lots[lots.length - 1];
                                        const defaultOpts = getGaugeOptionsForMaterial('Treliça', gauges);
                                        const curOpt = defaultOpts.find(o => o.code === lastLot?.productCode || o.gauge === lastLot?.bitola) || defaultOpts[0];
                                        const unitW = parseFloat(curOpt?.peso_final || '6.01');
                                        return (
                                            <p className="text-xs text-slate-500 mt-2 text-center">
                                                Modelo: <strong className="text-blue-700">{curOpt?.description} ({curOpt?.code})</strong><br />
                                                Total calculado: <strong className="text-blue-800 font-black">{Math.round(unitW * batchTrelicaBars)} kg</strong> ({batchTrelicaBars} barras × {unitW} kg/un)
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setBatchTrelicaModal(false)}
                                        className="w-1/2 py-2.5 rounded-xl border font-bold text-xs text-slate-600 hover:bg-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGenerateTrelicaBatch(batchTrelicaBars)}
                                        className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition"
                                    >
                                        ✓ Adicionar Lote
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal para Adicionar Múltiplos Sacos de Sabão */}
                    {batchBagsModal && (
                        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[130] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                        <span>🧼</span> Gerar Sacos de Sabão (25kg)
                                    </h3>
                                    <button onClick={() => setBatchBagsModal(false)} className="text-slate-400 hover:text-slate-600">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                        Quantos sacos de 25 kg chegaram?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={batchBagsQty}
                                        onChange={e => setBatchBagsQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full p-2.5 border-2 border-emerald-400 rounded-xl font-black text-center text-lg text-emerald-900 bg-emerald-50/40 outline-none"
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-500 mt-2 text-center">
                                        Total calculado: <strong className="text-emerald-700 font-black">{batchBagsQty * 25} kg</strong> ({batchBagsQty} lotes sequenciais de 25kg)
                                    </p>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setBatchBagsModal(false)}
                                        className="w-1/2 py-2.5 rounded-xl border font-bold text-xs text-slate-600 hover:bg-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGenerateSabaoBatch(batchBagsQty)}
                                        className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition"
                                    >
                                        ✓ Adicionar {batchBagsQty} Sacos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-4 flex justify-end">
                        <input type="file" accept="image/*" capture="environment" className="hidden" id="scan-ia" onChange={handleGlobalScan} />
                        <label htmlFor="scan-ia" className="bg-[#0F3F5C] text-white px-6 py-2 rounded-lg font-bold cursor-pointer flex items-center gap-2"><CameraIcon className="h-5 w-5" /> {isScanning ? 'Lendo...' : 'Leitura IA'}</label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-y">
                                <tr>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">
                                        Lote Interno {isAnyElectrode ? <span className="text-amber-600 font-bold block text-[9px]">⚡ Auto (10001+)</span> : isAnySabao ? <span className="text-emerald-600 font-bold block text-[9px]">🧼 Auto (SB-0001+)</span> : isAnyTrelica ? <span className="text-blue-600 font-bold block text-[9px]">📐 Auto (TR-0001+)</span> : ''}
                                    </th>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">Tipo de Aço</th>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">Corrida</th>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">Material</th>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">
                                        {isAnyElectrode ? 'Modelo / Código' : isAnySabao ? 'Embalagem / Produto' : isAnyTrelica ? 'Modelo / Ficha Técnica' : 'Bitola'}
                                    </th>
                                    {isAnyTrelica && (
                                        <th className="p-3 text-center font-bold text-blue-900 uppercase text-[10px] w-36 bg-blue-50/60">
                                            Quantidade (Barras)
                                        </th>
                                    )}
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]">
                                        {isAnyElectrode ? 'Qtd (un)' : isAnySabao ? 'Peso (kg) / Saco' : isAnyTrelica ? 'Peso do Pct (kg)' : 'Peso Etiqueta'}
                                    </th>
                                    <th className="p-3 text-center font-bold text-slate-600 uppercase text-[10px]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lots.map((lot, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2">
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={lot.internalLot || ''} 
                                                    onChange={e => handleLotChange(index, 'internalLot', e.target.value)} 
                                                    placeholder={lot.materialType === 'Eletrodos Treliças' ? 'Ex: 10001' : lot.materialType === 'Sabão' ? 'Ex: SB-0001' : lot.materialType === 'Treliça' ? 'Ex: TR-0001' : ''}
                                                    className={`w-full p-2 border rounded text-center font-bold ${
                                                        lot.materialType === 'Eletrodos Treliças' ? 'bg-amber-50/60 border-amber-300 text-amber-900' : 
                                                        lot.materialType === 'Sabão' ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 
                                                        lot.materialType === 'Treliça' ? 'bg-blue-50/60 border-blue-300 text-blue-900' : ''
                                                    }`} 
                                                    required 
                                                />
                                                {lot.materialType === 'Eletrodos Treliças' && !lot.internalLot && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextLot = getNextElectrodeInternalLot(stock, lots.filter((_, i) => i !== index), conferences);
                                                            handleLotChange(index, 'internalLot', nextLot);
                                                        }}
                                                        className="absolute right-1 top-1 bottom-1 px-1.5 text-[9px] font-bold bg-amber-200 text-amber-900 rounded hover:bg-amber-300"
                                                    >
                                                        Auto
                                                    </button>
                                                )}
                                                {lot.materialType === 'Sabão' && !lot.internalLot && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextLot = getNextSabaoInternalLot(stock, lots.filter((_, i) => i !== index), conferences);
                                                            handleLotChange(index, 'internalLot', nextLot);
                                                        }}
                                                        className="absolute right-1 top-1 bottom-1 px-1.5 text-[9px] font-bold bg-emerald-200 text-emerald-900 rounded hover:bg-emerald-300"
                                                    >
                                                        Auto
                                                    </button>
                                                )}
                                                {lot.materialType === 'Treliça' && !lot.internalLot && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextLot = getNextTrelicaInternalLot(stock, lots.filter((_, i) => i !== index), conferences);
                                                            handleLotChange(index, 'internalLot', nextLot);
                                                        }}
                                                        className="absolute right-1 top-1 bottom-1 px-1.5 text-[9px] font-bold bg-blue-200 text-blue-900 rounded hover:bg-blue-300"
                                                    >
                                                        Auto
                                                    </button>
                                                )}
                                            </div>
                                            {duplicateErrors[index] && <p className="text-red-500 text-[9px] font-bold text-center mt-0.5">{duplicateErrors[index]}</p>}
                                        </td>
                                        <td className="p-2">
                                            {lot.materialType === 'Eletrodos Treliças' || lot.materialType === 'Sabão' || lot.materialType === 'Treliça' ? (
                                                <span className="text-xs text-slate-400 font-bold block text-center">-</span>
                                            ) : (
                                                <select value={lot.steelType || ''} onChange={e => handleLotChange(index, 'steelType', e.target.value)} className="w-full p-2 border rounded text-center" required>
                                                    {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                value={lot.runNumber || ''} 
                                                onChange={e => handleLotChange(index, 'runNumber', e.target.value)} 
                                                placeholder={lot.materialType === 'Eletrodos Treliças' || lot.materialType === 'Sabão' || lot.materialType === 'Treliça' ? '-' : ''}
                                                className="w-full p-2 border rounded text-center" 
                                                required={lot.materialType !== 'Eletrodos Treliças' && lot.materialType !== 'Sabão' && lot.materialType !== 'Treliça'} 
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="relative">
                                                <select 
                                                    value={lot.materialType} 
                                                    onChange={e => handleLotChange(index, 'materialType', e.target.value)} 
                                                    disabled={isAnyElectrode}
                                                    className={`w-full p-2 border rounded text-center text-xs font-bold ${
                                                        isAnyElectrode 
                                                            ? 'bg-amber-50 border-amber-300 text-amber-900 cursor-not-allowed' 
                                                            : ''
                                                    }`}
                                                >
                                                    {isAnyElectrode ? (
                                                        <option value="Eletrodos Treliças">⚡ Eletrodos Treliças (Trava Ativa)</option>
                                                    ) : (
                                                        MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)
                                                    )}
                                                </select>
                                                {isAnyElectrode && (
                                                    <span className="text-[9px] font-bold text-amber-700 block text-center mt-0.5">
                                                        🔒 Trava Ativa
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            {(() => {
                                                const opts = getGaugeOptionsForMaterial(lot.materialType || 'Fio Máquina', gauges);
                                                const currentKey = opts.find(o => 
                                                    o.gauge === lot.bitola && 
                                                    ((lot.productCode && o.code === lot.productCode) || 
                                                     (lot.description && o.description === lot.description))
                                                )?.key || opts.find(o => o.gauge === lot.bitola)?.key || (opts[0]?.key || '');

                                                return (
                                                    <select 
                                                        value={currentKey} 
                                                        onChange={e => handleGaugeSelect(index, e.target.value)} 
                                                        className="w-full p-2 border rounded text-center text-xs font-bold"
                                                    >
                                                        {opts.map(opt => (
                                                            <option key={opt.key} value={opt.key}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                );
                                            })()}
                                        </td>
                                        {isAnyTrelica && (
                                            <td className="p-2 w-36">
                                                {lot.materialType === 'Treliça' ? (
                                                    <div>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={lot.quantity ?? 100}
                                                                onChange={e => {
                                                                    const newQty = parseInt(e.target.value, 10) || 0;
                                                                    const opts = getGaugeOptionsForMaterial('Treliça', gauges);
                                                                    const curOpt = opts.find(o => o.code === lot.productCode || o.gauge === lot.bitola) || opts[0];
                                                                    const unitW = parseFloat(curOpt?.peso_final || '6.01');
                                                                    const newLots = [...lots];
                                                                    newLots[index] = {
                                                                        ...newLots[index],
                                                                        quantity: newQty,
                                                                        labelWeight: newQty > 0 && unitW > 0 ? Math.round(newQty * unitW) : newLots[index].labelWeight
                                                                    };
                                                                    setLots(newLots);
                                                                }}
                                                                className="w-full p-2 border-2 border-blue-300 bg-blue-50/50 rounded-lg font-black text-center text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                                                                placeholder="100"
                                                                required
                                                            />
                                                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-blue-600 pointer-events-none">
                                                                un
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-blue-700 font-bold block text-center mt-0.5">
                                                            barras / pct
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-bold block text-center">-</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="p-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={lot.labelWeight || ''}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        handleLotChange(index, 'labelWeight', val ? parseInt(val) : 0);
                                                    }}
                                                    className={`w-full p-2 border rounded font-bold text-center no-spinner ${
                                                        lot.materialType === 'Treliça' ? 'border-blue-200 bg-blue-50/20' : ''
                                                    }`}
                                                    placeholder={lot.materialType === 'Eletrodos Treliças' ? '1' : lot.materialType === 'Sabão' ? '25' : lot.materialType === 'Treliça' ? '600' : '0'}
                                                    required
                                                />
                                                {lot.materialType === 'Treliça' && (
                                                    <span className="absolute right-2 top-2.5 text-[10px] font-bold text-slate-500 pointer-events-none">
                                                        kg
                                                    </span>
                                                )}
                                            </div>
                                            {lot.materialType === 'Treliça' && (() => {
                                                const opts = getGaugeOptionsForMaterial('Treliça', gauges);
                                                const curOpt = opts.find(o => o.code === lot.productCode || o.gauge === lot.bitola) || opts[0];
                                                const unitW = parseFloat(curOpt?.peso_final || '6.01');
                                                const bars = lot.quantity || (unitW > 0 && lot.labelWeight ? Math.round(lot.labelWeight / unitW) : 100);
                                                const avgUnitW = bars > 0 && lot.labelWeight ? (lot.labelWeight / bars).toFixed(2) : unitW.toFixed(2);
                                                return (
                                                    <span className="text-[10px] text-slate-600 font-semibold block text-center mt-0.5">
                                                        {bars} barras • ~{avgUnitW} kg/barra {unitW > 0 && unitW.toFixed(2) !== avgUnitW ? `(padrão: ${unitW} kg)` : ''}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-2"><button type="button" onClick={() => setLots(lots.filter((_, i) => i !== index))} className="p-2 text-red-500"><TrashIcon className="h-5 w-5" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={handleAddLot} className="w-full py-4 text-[#0F3F5C] font-bold hover:bg-slate-50 transition">+ Adicionar Peça</button>
                    </div>
                    <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="font-bold text-slate-500 px-6">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-[#0F3F5C] text-white px-10 py-3 rounded-xl font-bold">{isSubmitting ? 'Salvando...' : 'Finalizar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export interface LotDisplayOptions {
    showCorrida: boolean;
    showNfe: boolean;
    showConferencia: boolean;
    showFornecedor: boolean;
    displayMode: 'badge' | 'column';
}

export const DEFAULT_LOT_DISPLAY_OPTIONS: LotDisplayOptions = {
    showCorrida: true,
    showNfe: true,
    showConferencia: true,
    showFornecedor: false,
    displayMode: 'badge'
};

export type SearchFieldType = 'todos' | 'corrida' | 'nfe' | 'fornecedor' | 'conferencia' | 'lote';

const StockControl: React.FC<{
    stock: StockItem[]; conferences: ConferenceData[]; setPage: (p: Page) => void;
    addConference: (d: ConferenceData) => void; deleteStockItem: (id: string) => void;
    updateStockItem: (i: StockItem) => void; editConference: (id: string, d: ConferenceData) => void;
    deleteConference: (id: string) => void; gauges: StockGauge[]; currentUser: User | null;
    initialTab?: 'materia_prima' | 'eletrodos'; initialView?: 'list' | 'add';
    productionOrders?: any[]; transfers?: any[]; createTransfer?: any;
}> = ({
    stock, conferences, setPage, addConference, deleteStockItem, updateStockItem, editConference, deleteConference, gauges, currentUser,
    initialTab = 'materia_prima', initialView = 'list'
}) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username === 'admin';
    const [activeTab, setActiveTab] = useState<'materia_prima' | 'eletrodos'>(initialTab);
    const [isAdding, setIsAdding] = useState(initialView === 'add');
    const [reportView, setReportView] = useState<ConferenceData | null>(null);
    const [historyLot, setHistoryLot] = useState<StockItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState<SearchFieldType>('todos');
    const [lotDisplayOptions, setLotDisplayOptions] = useState<LotDisplayOptions>(() => {
        try {
            const saved = localStorage.getItem('stock_lot_display_options');
            if (saved) {
                return { ...DEFAULT_LOT_DISPLAY_OPTIONS, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Erro ao ler stock_lot_display_options do localStorage', e);
        }
        return DEFAULT_LOT_DISPLAY_OPTIONS;
    });

    const updateLotDisplayOptions = (newOptions: Partial<LotDisplayOptions>) => {
        setLotDisplayOptions(prev => {
            const updated = { ...prev, ...newOptions };
            try {
                localStorage.setItem('stock_lot_display_options', JSON.stringify(updated));
            } catch (e) {
                console.error('Erro ao salvar stock_lot_display_options no localStorage', e);
            }
            return updated;
        });
    };

    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [consumingItem, setConsumingItem] = useState<StockItem | null>(null);
    const [materialFilter, setMaterialFilter] = useState('');
    const [bitolaFilter, setBitolaFilter] = useState('');
    const [steelTypeFilter, setSteelTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(50);
    const [isLotDisplayModalOpen, setIsLotDisplayModalOpen] = useState(false);
    const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // ==========================================
    // ESTADO E CONTROLE DE ESTOQUE DE ELETRODOS
    // ==========================================
    const [electrodeStocks, setElectrodeStocks] = useState<TrelicaElectrodeStock[]>([]);
    const [electrodeSearch, setElectrodeSearch] = useState('');
    const [electrodeTypeFilter, setElectrodeTypeFilter] = useState<string>('all');
    const [electrodeConditionFilter, setElectrodeConditionFilter] = useState<'all' | 'novo' | 'retificado'>('all');

    // Cadastro de Novo Lote de Eletrodo
    const [isAddingElectrode, setIsAddingElectrode] = useState(false);
    const [newElType, setNewElType] = useState<TrelicaElectrodeType>('Superior');
    const [newElCondition, setNewElCondition] = useState<'novo' | 'retificado'>('novo');
    const [newElLotNumber, setNewElLotNumber] = useState('');
    const [newElQuantity, setNewElQuantity] = useState(4);
    const [newElSupplier, setNewElSupplier] = useState('Metalúrgica Ita Soldas');
    const [newElMaterial, setNewElMaterial] = useState('CuCrZr (Cobre Cromo Zircônio)');
    const [newElBenchmarkMeters, setNewElBenchmarkMeters] = useState(15000);
    const [newElCostUnit, setNewElCostUnit] = useState<number | ''>('');
    const [newElNotes, setNewElNotes] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    // Baixa de Saldo de Eletrodos
    const [consumingElectrode, setConsumingElectrode] = useState<TrelicaElectrodeStock | null>(null);
    const [consumeElQty, setConsumeElQty] = useState(1);
    const [consumeElReason, setConsumeElReason] = useState('Desgaste Final / Sucata');
    const [consumeElNotes, setConsumeElNotes] = useState('');

    // Visualização de Peças do Lote
    const [viewingPiecesLot, setViewingPiecesLot] = useState<TrelicaElectrodeStock | null>(null);

    // Carregar estoque de eletrodos inicial
    const loadElectrodeStock = async () => {
        try {
            const data = await fetchTable<TrelicaElectrodeStock>('trelica_electrodes_stock');
            if (data && data.length > 0) {
                setElectrodeStocks(data);
                saveLocalElectrodeStock(data);
            } else {
                setElectrodeStocks(getLocalElectrodeStock());
            }
        } catch (err) {
            console.warn('Carregando eletrodos do cache local:', err);
            setElectrodeStocks(getLocalElectrodeStock());
        }
    };

    useEffect(() => {
        loadElectrodeStock();
    }, []);

    // Sincronizar initialTab se mudar externamente
    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    // Ao abrir modal de cadastro ou alterar Tipo/Condição, recalcula o lote sequencial
    useEffect(() => {
        if (isAddingElectrode) {
            const nextLot = generateNextElectrodeLot(newElType, electrodeStocks, newElCondition);
            setNewElLotNumber(nextLot);
            setNewElBenchmarkMeters(DEFAULT_BENCHMARK_METERS[newElType] || 15000);
        }
    }, [isAddingElectrode, newElType, newElCondition, electrodeStocks]);

    // Etiquetas geradas para gravação física
    const physicalMarks = useMemo(() => {
        const qty = Math.max(1, Number(newElQuantity) || 1);
        const lot = newElLotNumber.trim().toUpperCase() || 'LOTE';
        return Array.from({ length: qty }, (_, i) => `${lot} #${String(i + 1).padStart(2, '0')}`);
    }, [newElLotNumber, newElQuantity]);

    const handleCopyMarks = (marks: string[]) => {
        const text = marks.join('\n');
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // Submissão de novo lote de eletrodo
    const handleAddElectrodeLot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newElLotNumber.trim()) {
            alert('Informe ou gere o número do lote do eletrodo.');
            return;
        }

        const newLot: TrelicaElectrodeStock = {
            id: `el-${Date.now()}`,
            lot_number: newElLotNumber.trim().toUpperCase(),
            type: newElType,
            material: newElMaterial.trim() || 'CuCrZr (Cobre Cromo Zircônio)',
            quantity: Number(newElQuantity) || 1,
            benchmark_lifespan_meters: Number(newElBenchmarkMeters) || 15000,
            supplier: newElSupplier.trim() || undefined,
            cost_unit: newElCostUnit === '' ? undefined : Number(newElCostUnit),
            status: newElCondition,
            notes: newElNotes.trim() || undefined,
            created_at: new Date().toISOString()
        };

        const updated = [newLot, ...electrodeStocks];
        setElectrodeStocks(updated);
        saveLocalElectrodeStock(updated);

        try {
            await insertItem<TrelicaElectrodeStock>('trelica_electrodes_stock', newLot as any);
        } catch (err) {
            console.warn('Salvo localmente no cache:', err);
        }

        setIsAddingElectrode(false);
        setNewElNotes('');
    };

    // Baixa de saldo de eletrodos
    const handleConfirmConsumeElectrode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consumingElectrode) return;

        const qtyToDeduct = Math.min(consumingElectrode.quantity, Math.max(1, Number(consumeElQty) || 1));
        const newQty = Math.max(0, consumingElectrode.quantity - qtyToDeduct);

        const updated = electrodeStocks.map(s => {
            if (s.id === consumingElectrode.id) {
                const existingNotes = s.notes ? `${s.notes} | ` : '';
                const historyNote = `[Baixa ${qtyToDeduct} un em ${new Date().toLocaleDateString('pt-BR')}: ${consumeElReason}${consumeElNotes ? ` - ${consumeElNotes}` : ''}]`;
                return {
                    ...s,
                    quantity: newQty,
                    notes: `${existingNotes}${historyNote}`,
                    updated_at: new Date().toISOString()
                };
            }
            return s;
        });

        setElectrodeStocks(updated);
        saveLocalElectrodeStock(updated);

        try {
            await updateItem<TrelicaElectrodeStock>('trelica_electrodes_stock', consumingElectrode.id, {
                quantity: newQty
            });
        } catch (err) {
            console.warn('Atualizado localmente:', err);
        }

        setConsumingElectrode(null);
        setConsumeElNotes('');
    };

    // Ajuste rápido de saldo (+1)
    const handleAdjustElectrodeQty = async (id: string, delta: number) => {
        const item = electrodeStocks.find(s => s.id === id);
        if (!item) return;

        const newQty = Math.max(0, item.quantity + delta);
        const updated = electrodeStocks.map(s => s.id === id ? { ...s, quantity: newQty } : s);
        setElectrodeStocks(updated);
        saveLocalElectrodeStock(updated);

        try {
            await updateItem<TrelicaElectrodeStock>('trelica_electrodes_stock', id, { quantity: newQty });
        } catch (err) {
            console.warn('Atualizado localmente:', err);
        }
    };

    // Exclusão de lote de eletrodo
    const handleDeleteElectrodeLot = async (lot: TrelicaElectrodeStock) => {
        if (!confirm(`Deseja realmente remover o lote ${lot.lot_number} (${lot.type}) do estoque?`)) return;

        const updated = electrodeStocks.filter(s => s.id !== lot.id);
        setElectrodeStocks(updated);
        saveLocalElectrodeStock(updated);

        try {
            await deleteItem('trelica_electrodes_stock', lot.id);
        } catch (err) {
            console.warn('Excluído do cache local:', err);
        }
    };

    // Filtros e contagens de eletrodos
    const filteredElectrodes = useMemo(() => {
        return electrodeStocks.filter(s => {
            const matchesSearch = !electrodeSearch.trim() ||
                s.lot_number.toLowerCase().includes(electrodeSearch.toLowerCase()) ||
                (s.supplier || '').toLowerCase().includes(electrodeSearch.toLowerCase()) ||
                (s.material || '').toLowerCase().includes(electrodeSearch.toLowerCase()) ||
                s.type.toLowerCase().includes(electrodeSearch.toLowerCase());
            
            const matchesType = electrodeTypeFilter === 'all' || s.type === electrodeTypeFilter;
            const matchesCondition = electrodeConditionFilter === 'all' || (s.status || 'novo') === electrodeConditionFilter;

            return matchesSearch && matchesType && matchesCondition;
        });
    }, [electrodeStocks, electrodeSearch, electrodeTypeFilter, electrodeConditionFilter]);

    const totalElectrodePieces = useMemo(() => {
        return electrodeStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
    }, [electrodeStocks]);

    const criticalElectrodeLots = useMemo(() => {
        return electrodeStocks.filter(s => s.quantity <= 2).length;
    }, [electrodeStocks]);

    const newElectrodesCount = useMemo(() => {
        return electrodeStocks.filter(s => (s.status || 'novo') === 'novo').reduce((sum, s) => sum + (s.quantity || 0), 0);
    }, [electrodeStocks]);

    const dressedElectrodesCount = useMemo(() => {
        return electrodeStocks.filter(s => s.status === 'retificado').reduce((sum, s) => sum + (s.quantity || 0), 0);
    }, [electrodeStocks]);
    
    const statusDesktopRef = useRef<HTMLDivElement>(null);
    const statusMobileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDesktopRef.current && !statusDesktopRef.current.contains(event.target as Node)) setIsStatusOpen(false);
            if (statusMobileRef.current && !statusMobileRef.current.contains(event.target as Node)) setIsMobileStatusOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isPrinting) {
            window.print();
            // Pequeno delay para garantir que o estado volte após a caixa de impressão fechar
            // Em alguns browsers window.print é síncrono, em outros não.
            setTimeout(() => setIsPrinting(false), 500);
        }
    }, [isPrinting]);

    const handleMaterialFilterChange = (newMat: string) => {
        setMaterialFilter(newMat);
        setBitolaFilter(''); // Reset to avoid cross-material mixup
    };

    const availableBitolaOptions = useMemo(() => {
        const options: Array<{
            key: string;
            gauge: string;
            materialType: string;
            productCode?: string;
            description?: string;
            label: string;
            tamanho?: string;
            superior?: string;
            inferior?: string;
            senozoide?: string;
            peso_final?: string;
        }> = [];

        // 1. Custom registered gauges from Cadastro
        const relevantGauges = materialFilter 
            ? gauges.filter(g => g.materialType === materialFilter)
            : gauges;

        relevantGauges.forEach(g => {
            const matPrefix = !materialFilter ? `[${g.materialType}] ` : '';
            const key = `${g.materialType}::${g.gauge}::${g.productCode || ''}::${g.description || ''}`;
            
            if (!options.some(o => o.key === key)) {
                if (g.materialType === 'Eletrodos Treliças') {
                    const desc = g.description || `Eletrodo Cód. ${g.productCode || g.gauge}`;
                    const code = g.productCode ? ` (Cód. ${g.productCode})` : '';
                    options.push({
                        key,
                        gauge: g.gauge,
                        materialType: g.materialType,
                        productCode: g.productCode,
                        description: g.description,
                        label: `${matPrefix}${desc}${code}`
                    });
                } else if (g.materialType === 'Sabão') {
                    const desc = g.description || 'Condat';
                    const code = g.productCode ? ` (Cód. ${g.productCode})` : '';
                    options.push({
                        key,
                        gauge: g.gauge,
                        materialType: g.materialType,
                        productCode: g.productCode,
                        description: g.description,
                        label: `${matPrefix}🧼 ${g.gauge} - ${desc}${code}`
                    });
                } else if (g.materialType === 'Treliça') {
                    const desc = g.description || `Treliça ${g.gauge}`;
                    const code = g.productCode ? ` (${g.productCode})` : '';
                    const tam = g.tamanho ? ` ${g.tamanho}m` : '';
                    options.push({
                        key,
                        gauge: g.gauge,
                        materialType: g.materialType,
                        productCode: g.productCode,
                        description: g.description,
                        tamanho: g.tamanho,
                        superior: g.superior,
                        inferior: g.inferior,
                        senozoide: g.senozoide,
                        peso_final: g.peso_final,
                        label: `${matPrefix}📐 ${desc}${tam}${code}`
                    });
                } else {
                    const descText = g.description ? ` - ${g.description}` : '';
                    const codeText = g.productCode ? ` (${g.productCode})` : '';
                    options.push({
                        key,
                        gauge: g.gauge,
                        materialType: g.materialType,
                        productCode: g.productCode,
                        description: g.description,
                        label: `${matPrefix}${g.gauge.replace('.', ',')} mm${descText}${codeText}`
                    });
                }
            }
        });

        // 2. Default base gauges ONLY if a material has ZERO registered gauges in DB
        const materialsToInclude = materialFilter ? [materialFilter] : ['Fio Máquina', 'CA-60', 'Eletrodos Treliças', 'Sabão', 'Treliça'];
        materialsToInclude.forEach(mat => {
            const registeredCount = gauges.filter(g => g.materialType === mat).length;
            if (registeredCount === 0) {
                if (mat === 'Eletrodos Treliças') {
                    DefaultElectrodeGauges.forEach(eg => {
                        const key = `Eletrodos Treliças::${eg.gauge}::${eg.productCode}::${eg.description}`;
                        const matPrefix = !materialFilter ? `[Eletrodos Treliças] ` : '';
                        if (!options.some(o => o.key === key)) {
                            options.push({
                                key,
                                gauge: eg.gauge,
                                materialType: 'Eletrodos Treliças',
                                productCode: eg.productCode,
                                description: eg.description,
                                label: `${matPrefix}${eg.description} (Cód. ${eg.productCode})`
                            });
                        }
                    });
                } else if (mat === 'Sabão') {
                    DefaultSabaoGauges.forEach(sg => {
                        const key = `Sabão::${sg.gauge}::${sg.productCode}::${sg.description}`;
                        const matPrefix = !materialFilter ? `[Sabão] ` : '';
                        if (!options.some(o => o.key === key)) {
                            options.push({
                                key,
                                gauge: sg.gauge,
                                materialType: 'Sabão',
                                productCode: sg.productCode,
                                description: sg.description,
                                label: `${matPrefix}🧼 ${sg.gauge} - ${sg.description} (Cód. ${sg.productCode})`
                            });
                        }
                    });
                } else if (mat === 'Treliça') {
                    DefaultTrelicaGauges.forEach(tg => {
                        const key = `Treliça::${tg.gauge}::${tg.productCode}::${tg.description}`;
                        const matPrefix = !materialFilter ? `[Treliça] ` : '';
                        const tam = tg.tamanho ? ` ${tg.tamanho}m` : '';
                        const code = tg.productCode ? ` (${tg.productCode})` : '';
                        if (!options.some(o => o.key === key)) {
                            options.push({
                                key,
                                gauge: tg.gauge,
                                materialType: 'Treliça',
                                productCode: tg.productCode,
                                description: tg.description,
                                tamanho: tg.tamanho,
                                superior: tg.superior,
                                inferior: tg.inferior,
                                senozoide: tg.senozoide,
                                peso_final: tg.peso_final,
                                label: `${matPrefix}📐 ${tg.description}${tam}${code}`
                            });
                        }
                    });
                } else {
                    const baseGauges = mat === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
                    baseGauges.forEach(bg => {
                        const desc = `${mat} ${bg.replace('.', ',')} mm`;
                        const key = `${mat}::${bg}::::${desc}`;
                        const matPrefix = !materialFilter ? `[${mat}] ` : '';
                        if (!options.some(o => o.key === key)) {
                            options.push({
                                key,
                                gauge: bg,
                                materialType: mat,
                                productCode: '',
                                description: desc,
                                label: `${matPrefix}${bg.replace('.', ',')} mm - ${desc}`
                            });
                        }
                    });
                }
            }
        });

        // 3. Fallback for any stock items not covered
        stock.forEach(i => {
            if (i.status === 'Consumido') return;
            if (materialFilter && i.materialType !== materialFilter) return;
            if (steelTypeFilter && i.steelType !== steelTypeFilter) return;

            const exists = options.some(o => 
                o.materialType === i.materialType && 
                o.gauge === i.bitola &&
                (!i.productCode || o.productCode === i.productCode) &&
                (!i.description || o.description === i.description)
            );

            if (!exists) {
                const matPrefix = !materialFilter ? `[${i.materialType}] ` : '';
                const code = i.productCode || '';
                const key = `${i.materialType}::${i.bitola}::${code}::${i.description || ''}`;
                
                if (i.materialType === 'Eletrodos Treliças') {
                    const desc = i.description || `Eletrodo Cód. ${code || i.bitola}`;
                    const codeText = code ? ` (Cód. ${code})` : '';
                    options.push({
                        key,
                        gauge: i.bitola,
                        materialType: i.materialType,
                        productCode: code,
                        description: desc,
                        label: `${matPrefix}${desc}${codeText}`
                    });
                } else if (i.materialType === 'Sabão') {
                    const desc = i.description || 'Condat';
                    const codeText = code ? ` (Cód. ${code})` : '';
                    options.push({
                        key,
                        gauge: i.bitola,
                        materialType: i.materialType,
                        productCode: code,
                        description: desc,
                        label: `${matPrefix}🧼 ${i.bitola} - ${desc}${codeText}`
                    });
                } else if (i.materialType === 'Treliça') {
                    const desc = i.description || `Treliça ${i.bitola}`;
                    const codeText = code ? ` (${code})` : '';
                    options.push({
                        key,
                        gauge: i.bitola,
                        materialType: i.materialType,
                        productCode: code,
                        description: desc,
                        tamanho: (i as any).tamanho,
                        superior: (i as any).superior,
                        inferior: (i as any).inferior,
                        senozoide: (i as any).senozoide,
                        label: `${matPrefix}📐 ${desc}${codeText}`
                    });
                } else {
                    const desc = i.description || `${i.materialType} ${i.bitola.replace('.', ',')} mm`;
                    const codeText = code ? ` (${code})` : '';
                    options.push({
                        key,
                        gauge: i.bitola,
                        materialType: i.materialType,
                        productCode: code,
                        description: desc,
                        label: `${matPrefix}${i.bitola.replace('.', ',')} mm - ${desc}${codeText}`
                    });
                }
            }
        });

        return options.sort((a, b) => {
            if (!materialFilter && a.materialType !== b.materialType) {
                return a.materialType.localeCompare(b.materialType);
            }
            if (a.materialType === 'Treliça') {
                const descComp = (a.description || '').localeCompare(b.description || '');
                if (descComp !== 0) return descComp;
                return (a.productCode || a.gauge).localeCompare(b.productCode || b.gauge);
            }
            if (a.materialType === 'Eletrodos Treliças') {
                const codeA = parseInt(a.productCode || a.gauge) || 0;
                const codeB = parseInt(b.productCode || b.gauge) || 0;
                if (codeA !== codeB) return codeA - codeB;
                return (a.description || '').localeCompare(b.description || '');
            }
            if (a.materialType === 'Sabão') {
                return (a.description || a.gauge).localeCompare(b.description || b.gauge);
            }
            const diff = parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.'));
            if (diff !== 0) return diff;
            return (a.description || '').localeCompare(b.description || '');
        });
    }, [gauges, stock, materialFilter, steelTypeFilter]);

    const gaugeLookupMap = useMemo(() => {
        const map = new Map<string, StockGauge>();

        // Index default treliças
        DefaultTrelicaGauges.forEach(tg => {
            const fakeG: StockGauge = {
                id: tg.id || `default_tr_${tg.productCode}`,
                materialType: 'Treliça',
                gauge: tg.gauge,
                productCode: tg.productCode,
                description: tg.description,
                tamanho: tg.tamanho,
                superior: tg.superior,
                inferior: tg.inferior,
                senozoide: tg.senozoide,
                peso_final: tg.peso_final
            };
            if (tg.productCode) {
                map.set(`Treliça::${tg.gauge}::${tg.productCode}`, fakeG);
                map.set(`Treliça::${tg.productCode}`, fakeG);
            }
            if (tg.description) {
                map.set(`Treliça::${tg.gauge}::${tg.description}`, fakeG);
                map.set(`Treliça::${tg.description}`, fakeG);
            }
            if (!map.has(`Treliça::${tg.gauge}`)) {
                map.set(`Treliça::${tg.gauge}`, fakeG);
            }
        });

        // Index DB gauges
        for (const g of gauges) {
            if (g.productCode) {
                map.set(`${g.materialType}::${g.gauge}::${g.productCode}`, g);
                map.set(`${g.materialType}::${g.productCode}`, g);
            }
            if (g.description) {
                map.set(`${g.materialType}::${g.gauge}::${g.description}`, g);
                map.set(`${g.materialType}::${g.description}`, g);
            }
            map.set(`${g.materialType}::${g.gauge}`, g);
        }
        return map;
    }, [gauges]);

    const selectedGaugeOption = useMemo(() => {
        if (!bitolaFilter) return null;
        const opt = availableBitolaOptions.find(o => o.key === bitolaFilter);
        if (!opt) return null;
        const matchingG = (opt.productCode && (gaugeLookupMap.get(`${opt.materialType}::${opt.gauge}::${opt.productCode}`) || gaugeLookupMap.get(`${opt.materialType}::${opt.productCode}`))) ||
                          (opt.description && (gaugeLookupMap.get(`${opt.materialType}::${opt.gauge}::${opt.description}`) || gaugeLookupMap.get(`${opt.materialType}::${opt.description}`))) ||
                          gaugeLookupMap.get(`${opt.materialType}::${opt.gauge}`);
        return {
            ...opt,
            tamanho: opt.tamanho || matchingG?.tamanho,
            superior: opt.superior || matchingG?.superior,
            inferior: opt.inferior || matchingG?.inferior,
            senozoide: opt.senozoide || matchingG?.senozoide,
            peso_final: opt.peso_final || matchingG?.peso_final
        };
    }, [bitolaFilter, availableBitolaOptions, gaugeLookupMap]);

    const confByLotMap = useMemo(() => {
        const map = new Map<string, { conferenceNumber: string; nfe: string; supplier: string; runNumber?: string; quantity?: number }>();
        if (!conferences || !Array.isArray(conferences)) return map;
        for (const conf of conferences) {
            if (conf.lots && Array.isArray(conf.lots)) {
                for (const lot of conf.lots) {
                    if (lot.internalLot) {
                        map.set(lot.internalLot, {
                            conferenceNumber: conf.conferenceNumber || '',
                            nfe: conf.nfe || '',
                            supplier: lot.supplier || conf.supplier || '',
                            runNumber: lot.runNumber || '',
                            quantity: lot.quantity
                        });
                    }
                }
            }
        }
        return map;
    }, [conferences]);

    const getLotDetails = (item: StockItem) => {
        const confInfo = confByLotMap.get(item.internalLot);
        const runNumber = (item.runNumber || confInfo?.runNumber || '').trim();
        const nfe = (item.nfe || confInfo?.nfe || '').trim();
        const confNum = (item.conferenceNumber || confInfo?.conferenceNumber || '').trim();
        const supplier = (item.supplier || confInfo?.supplier || '').trim();
        const quantity = item.quantity || confInfo?.quantity;
        return { runNumber, nfe, confNum, supplier, quantity };
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, searchField, materialFilter, bitolaFilter, steelTypeFilter, statusFilter]);

    const filtered = useMemo(() => stock.filter(i => {
        const matchingGauge = (i.productCode && gaugeLookupMap.get(`${i.materialType}::${i.bitola}::${i.productCode}`)) ||
                              (i.description && gaugeLookupMap.get(`${i.materialType}::${i.bitola}::${i.description}`)) ||
                              gaugeLookupMap.get(`${i.materialType}::${i.bitola}`);

        const itemDescription = i.description || matchingGauge?.description || '';
        const itemProductCode = i.productCode || matchingGauge?.productCode || '';

        const searchLower = searchTerm.trim().toLowerCase();
        const itemMat = (i.materialType || '').trim();
        const itemSteel = (i.steelType || '').trim();
        const itemGauge = (i.bitola || '').trim();

        const { runNumber, nfe, confNum, supplier } = getLotDetails(i);

        let passesSearch = true;
        if (searchLower.length > 0) {
            if (searchField === 'corrida') {
                passesSearch = runNumber.toLowerCase().includes(searchLower);
            } else if (searchField === 'nfe') {
                passesSearch = nfe.toLowerCase().includes(searchLower);
            } else if (searchField === 'fornecedor') {
                passesSearch = supplier.toLowerCase().includes(searchLower);
            } else if (searchField === 'conferencia') {
                passesSearch = confNum.toLowerCase().includes(searchLower);
            } else if (searchField === 'lote') {
                passesSearch = (i.internalLot || '').toLowerCase().includes(searchLower);
            } else {
                passesSearch =
                    (i.internalLot || '').toLowerCase().includes(searchLower) ||
                    nfe.toLowerCase().includes(searchLower) ||
                    runNumber.toLowerCase().includes(searchLower) ||
                    supplier.toLowerCase().includes(searchLower) ||
                    confNum.toLowerCase().includes(searchLower) ||
                    itemSteel.toLowerCase().includes(searchLower) ||
                    (itemProductCode || '').toLowerCase().includes(searchLower) ||
                    (itemDescription || '').toLowerCase().includes(searchLower) ||
                    itemGauge.toLowerCase().includes(searchLower);
            }
        }

        const filterMat = (materialFilter || '').trim();
        const passesMaterial = filterMat === '' || itemMat.toLowerCase() === filterMat.toLowerCase();
        
        const filterSteel = (steelTypeFilter || '').trim();
        const passesSteelType = filterSteel === '' || (itemMat !== 'Eletrodos Treliças' && itemSteel.toLowerCase() === filterSteel.toLowerCase());

        let passesBitola = true;
        if (bitolaFilter !== '') {
            const selectedOpt = availableBitolaOptions.find(o => o.key === bitolaFilter);
            if (selectedOpt) {
                const matchMat = itemMat.toLowerCase() === (selectedOpt.materialType || '').trim().toLowerCase();
                const matchGauge = itemGauge === (selectedOpt.gauge || '').trim();
                
                if (matchMat && matchGauge) {
                    if (selectedOpt.productCode) {
                        if (i.productCode) {
                            passesBitola = (i.productCode || '').trim() === selectedOpt.productCode.trim();
                        } else if (matchingGauge?.productCode) {
                            passesBitola = (matchingGauge.productCode || '').trim() === selectedOpt.productCode.trim();
                        } else {
                            passesBitola = !selectedOpt.description || (itemDescription || '').trim().toLowerCase() === (selectedOpt.description || '').trim().toLowerCase();
                        }
                    } else if (selectedOpt.description) {
                        passesBitola = (itemDescription || '').trim().toLowerCase() === (selectedOpt.description || '').trim().toLowerCase();
                    } else {
                        passesBitola = true;
                    }
                } else {
                    passesBitola = false;
                }
            } else {
                passesBitola = itemGauge === bitolaFilter.trim();
            }
        }

        if (statusFilter.length > 0) {
            return passesSearch && passesMaterial && passesBitola && passesSteelType && statusFilter.includes(i.status);
        } else {
            return passesSearch && passesMaterial && passesBitola && passesSteelType && i.status !== 'Consumido';
        }
    }).sort((a, b) => {
        const lotA = parseInt(a.internalLot.replace(/\D/g, '')) || 0;
        const lotB = parseInt(b.internalLot.replace(/\D/g, '')) || 0;
        
        if (isPrinting) {
            if (lotA !== lotB) return lotA - lotB;
            return a.internalLot.localeCompare(b.internalLot);
        } else {
            if (lotA !== lotB) return lotB - lotA;
            return b.internalLot.localeCompare(a.internalLot);
        }
    }), [stock, searchTerm, searchField, confByLotMap, materialFilter, bitolaFilter, steelTypeFilter, statusFilter, isPrinting, gaugeLookupMap, availableBitolaOptions]);

    const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize) || 1;

    const paginatedItems = useMemo(() => {
        if (isPrinting || pageSize === 0) {
            return filtered;
        }
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize, isPrinting]);

    const handlePrint = () => {
        setIsPrinting(true);
    };

    const renderPaginationBar = (position: 'top' | 'bottom') => {
        if (filtered.length === 0) return null;
        const isTop = position === 'top';
        return (
            <div className={`no-print bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 select-none ${isTop ? 'mb-4' : 'mt-4'}`}>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                    <span>
                        Exibindo <strong className="text-slate-900 font-bold">{filtered.length === 0 ? 0 : (currentPage - 1) * (pageSize || filtered.length) + 1}</strong> a <strong className="text-slate-900 font-bold">{pageSize === 0 ? filtered.length : Math.min(currentPage * pageSize, filtered.length)}</strong> de <strong className="text-slate-900 font-bold">{filtered.length}</strong> lotes
                        {filtered.length !== stock.length && (
                            <span className="text-slate-400 ml-1">({stock.length} no estoque total)</span>
                        )}
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Por página:</span>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-[#0F3F5C]"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50 (Recomendado)</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={0}>Todos ({filtered.length})</option>
                        </select>
                    </div>
                </div>

                {totalPages > 1 && pageSize > 0 && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                            title="Primeira Página"
                        >
                            ««
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            ‹ Anterior
                        </button>

                        <div className="flex items-center gap-1 mx-1">
                            {(() => {
                                const pages: (number | string)[] = [];
                                const maxVisible = 5;
                                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                                if (endPage - startPage + 1 < maxVisible) {
                                    startPage = Math.max(1, endPage - maxVisible + 1);
                                }

                                if (startPage > 1) {
                                    pages.push(1);
                                    if (startPage > 2) pages.push('...');
                                }

                                for (let i = startPage; i <= endPage; i++) {
                                    pages.push(i);
                                }

                                if (endPage < totalPages) {
                                    if (endPage < totalPages - 1) pages.push('...');
                                    pages.push(totalPages);
                                }

                                return pages.map((page, idx) => {
                                    if (page === '...') {
                                        return <span key={`dots-${position}-${idx}`} className="px-1.5 text-xs font-bold text-slate-400">...</span>;
                                    }
                                    const isCurrent = page === currentPage;
                                    return (
                                        <button
                                            key={`page-${position}-${page}`}
                                            type="button"
                                            onClick={() => setCurrentPage(Number(page))}
                                            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-extrabold transition ${
                                                isCurrent
                                                    ? 'bg-[#0F3F5C] text-white shadow'
                                                    : 'text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                });
                            })()}
                        </div>

                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            Próxima ›
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                            title="Última Página"
                        >
                            »»
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const stats = useMemo(() => {
        return filtered.reduce((acc, item) => {
            let pieces = 0;
            if (materialFilter === 'Treliça') {
                const matchingGauge = (gauges || []).find(g => 
                    g.materialType === 'Treliça' && (
                    (item.productCode && g.productCode === item.productCode) || 
                    (item.description && g.description === item.description) || 
                    (g.gauge === item.bitola)
                ));
                const unitW = parseFloat((matchingGauge?.peso_final || '').replace(',', '.') || '0');
                const bars = item.quantity || (item.history?.find((h: any) => h.details?.quantity)?.details?.quantity) || (unitW > 0 && item.remainingQuantity ? Math.round(item.remainingQuantity / unitW) : 0);
                pieces = Number(bars) || 0;
            }
            return {
                count: acc.count + 1,
                weight: acc.weight + item.remainingQuantity,
                pieces: acc.pieces + pieces
            };
        }, { count: 0, weight: 0, pieces: 0 });
    }, [filtered, materialFilter, gauges]);

    const handleRevertToAvailable = (item: StockItem) => {
        if (confirm(`Deseja voltar o lote ${item.internalLot} para status "Disponível"?`)) {
            const updated = {
                ...item,
                status: 'Disponível',
                history: [...(item.history || []), {
                    type: 'Status Revertido',
                    date: new Date().toISOString(),
                    details: {
                        'Ação': 'Retorno manual para Disponível',
                        'Status Anterior': item.status,
                        'Operador': currentUser?.username || 'Sistema'
                    }
                }]
            };
            updateStockItem(updated);
        }
    };

    if (isAdding) return <AddConferencePage onClose={() => setIsAdding(false)} onSubmit={addConference} stock={stock} onShowReport={setReportView} conferences={conferences} onEditConference={editConference} onDeleteConference={deleteConference} gauges={gauges} isGestor={isGestor} setPage={setPage} initialMaterialType={materialFilter === 'Eletrodos Treliças' ? 'Eletrodos Treliças' : materialFilter === 'Sabão' ? 'Sabão' : materialFilter === 'Treliça' ? 'Treliça' : undefined} />;

    return (
        <div className={`p-4 md:p-8 space-y-6 ${isPrintModalOpen ? 'print:hidden' : ''}`}>
            {consumingItem && (
                <ConsumeLotModal
                    item={consumingItem}
                    onClose={() => setConsumingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setConsumingItem(null);
                    }}
                    currentUser={currentUser}
                />
            )}
            {/* Printable Report Header - Only visible during print */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">MSM <span className="text-slate-500 font-light">Gestão Inteligente</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Relatório de Inventário de Estoque - Setor Laminação</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-slate-500 font-medium italic">Sistema MSM Control</p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Aço</p>
                            <p className="text-base font-black text-slate-800">{steelTypeFilter || 'Todos'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Material</p>
                            <p className="text-base font-black text-slate-800">{materialFilter || 'Todos'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Bitola</p>
                            <p className="text-base font-black text-slate-800">
                                {bitolaFilter ? (availableBitolaOptions.find(o => o.key === bitolaFilter)?.label || bitolaFilter) : 'Todas'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                            <p className="text-base font-black text-slate-800 max-w-[150px] truncate">{statusFilter.length === 0 ? 'Todos' : statusFilter.join(', ')}</p>
                        </div>
                    </div>
                    <div className="flex gap-6 items-center text-center">
                        <div className="px-6 py-2 bg-white rounded-xl shadow-sm border border-slate-200/60">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Lotes</p>
                            <p className="text-3xl font-black text-slate-900">{stats.count}</p>
                        </div>
                        <div className="px-6 py-2 bg-blue-50 rounded-xl shadow-sm border border-blue-200">
                            <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-1">Peso Total</p>
                            <p className="text-3xl font-black text-blue-700 tracking-tight">{stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xl font-bold text-blue-500">kg</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {reportView && <ConferenceReport reportData={reportView} onClose={() => setReportView(null)} gauges={gauges} />}
            {historyLot && <LotHistoryModal lot={historyLot} onClose={() => setHistoryLot(null)} />}
            {editingItem && (
                <EditStockItemModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setEditingItem(null);
                    }}
                    gauges={gauges}
                />
            )}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-6">
                    <h1 className="text-3xl font-bold text-slate-800 shrink-0 no-print">Estoque</h1>
                    <div className="hidden md:flex items-center gap-4 no-print grow">
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Aço</label>
                            <select value={steelTypeFilter} onChange={e => setSteelTypeFilter(e.target.value)} className="bg-transparent outline-none font-bold text-sm min-w-[80px]">
                                <option value="">Todos</option>
                                {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Material</label>
                            <select value={materialFilter} onChange={e => handleMaterialFilterChange(e.target.value)} className="bg-transparent outline-none font-bold text-sm min-w-[120px]">
                                <option value="">Todos</option>
                                {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                {materialFilter === 'Eletrodos Treliças' ? 'Modelo' : materialFilter === 'Sabão' ? 'Apresentação' : materialFilter === 'Treliça' ? 'Modelo' : 'Bitola'}
                            </label>
                            <select 
                                value={bitolaFilter} 
                                onChange={e => setBitolaFilter(e.target.value)} 
                                className="bg-transparent outline-none font-bold text-sm min-w-[140px] max-w-[340px] md:max-w-[420px] cursor-pointer"
                                title={selectedGaugeOption?.label || "Selecione o modelo ou bitola"}
                            >
                                <option value="">{materialFilter === 'Eletrodos Treliças' ? 'Todos os Modelos' : materialFilter === 'Sabão' ? 'Todas' : materialFilter === 'Treliça' ? 'Todos os Modelos' : 'Todas'}</option>
                                {!materialFilter ? (
                                    <>
                                        <optgroup label="Fio Máquina">
                                            {availableBitolaOptions.filter(o => o.materialType === 'Fio Máquina').map(o => (
                                                <option key={o.key} value={o.key}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="CA-60">
                                            {availableBitolaOptions.filter(o => o.materialType === 'CA-60').map(o => (
                                                <option key={o.key} value={o.key}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Eletrodos Treliças">
                                            {availableBitolaOptions.filter(o => o.materialType === 'Eletrodos Treliças').map(o => (
                                                <option key={o.key} value={o.key}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Sabão">
                                            {availableBitolaOptions.filter(o => o.materialType === 'Sabão').map(o => (
                                                <option key={o.key} value={o.key}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Treliças">
                                            {availableBitolaOptions.filter(o => o.materialType === 'Treliça').map(o => (
                                                <option key={o.key} value={o.key}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                    </>
                                ) : (
                                    availableBitolaOptions.map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0 relative" ref={statusDesktopRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                            <button 
                                onClick={() => setIsStatusOpen(!isStatusOpen)}
                                className="bg-transparent outline-none font-bold text-sm min-w-[80px] text-left flex justify-between items-center"
                            >
                                <span className="truncate max-w-[100px]">{statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}</span>
                                <svg className="w-4 h-4 ml-1 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            {isStatusOpen && (
                                <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2 min-w-[200px]">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                        <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                        Todos
                                    </label>
                                    <hr className="my-1 border-slate-100" />
                                    {[
                                        { val: 'Disponível', label: 'Disponível' },
                                        { val: 'Disponível - Suporte Treliça', label: 'Suporte Treliça' },
                                        { val: 'Em Produção - Trefila', label: 'Em Prod. Trefila' },
                                        { val: 'Em Produção - Treliça', label: 'Em Prod. Treliça' },
                                        { val: 'Reservado', label: 'Reservado' },
                                        { val: 'Consumido', label: 'Consumido' }
                                    ].map(s => (
                                        <label key={s.val} className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                            <input 
                                                type="checkbox" 
                                                checked={statusFilter.includes(s.val)} 
                                                onChange={e => {
                                                    if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                                    else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                                }} 
                                                className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                            />
                                            {s.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 border-l pl-6 ml-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 border-b border-transparent">Lotes</span>
                                <span className="text-xl font-black text-slate-800">{stats.count}</span>
                            </div>
                            {materialFilter === 'Treliça' && (
                                <div className="flex flex-col border-l pl-4 ml-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peças (Barras)</span>
                                    <span className="text-xl font-black text-[#0F3F5C]">{stats.pieces.toLocaleString('pt-BR')}</span>
                                </div>
                            )}
                            <div className="flex flex-col border-l pl-4 ml-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {materialFilter === 'Eletrodos Treliças' ? 'Peças Disponíveis' : 'Kg Disponível'}
                                </span>
                                <span className="text-xl font-black text-blue-600">
                                    {materialFilter === 'Eletrodos Treliças' 
                                        ? `${stats.weight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} un` 
                                        : `${stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <button 
                        onClick={() => setIsPrintModalOpen(true)} 
                        className="bg-white text-slate-700 font-bold py-2 px-4 rounded-xl shadow border border-slate-200 flex items-center gap-2 hover:bg-slate-50 transition whitespace-nowrap"
                        title="Central de Impressão de Estoque"
                    >
                        <PrinterIcon className="h-5 w-5 text-[#0F3F5C]" />
                        <span>Imprimir</span>
                    </button>
                    {isGestor ? (
                        <>
                            <button onClick={() => setPage('gaugesManager')} className="bg-white text-slate-600 font-bold py-2 px-6 rounded-lg shadow border flex items-center gap-2 hover:bg-slate-50 transition whitespace-nowrap"><AdjustmentsIcon className="h-5 w-5" /> Gerenciar Bitolas</button>
                            <button onClick={() => setIsAdding(true)} className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg shadow-lg shrink-0 whitespace-nowrap">+ Novo Recebimento</button>
                        </>
                    ) : (
                        <div className="bg-slate-100 border border-slate-200 text-slate-600 text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                            <span>👤 Consulta Operacional de Lotes</span>
                        </div>
                    )}
                </div>
            </header>
            <div className="md:hidden flex flex-wrap gap-2 no-print p-2">
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-500">Aço:</label>
                    <select value={steelTypeFilter} onChange={e => setSteelTypeFilter(e.target.value)} className="bg-transparent outline-none font-bold text-xs">
                        <option value="">Todos</option>
                        {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-500">MP:</label>
                    <select value={materialFilter} onChange={e => handleMaterialFilterChange(e.target.value)} className="bg-transparent outline-none font-bold text-xs">
                        <option value="">Todos</option>
                        {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-500">
                        {materialFilter === 'Eletrodos Treliças' ? 'Mod:' : materialFilter === 'Sabão' ? 'Emb:' : materialFilter === 'Treliça' ? 'Mod:' : 'Ø:'}
                    </label>
                    <select value={bitolaFilter} onChange={e => setBitolaFilter(e.target.value)} className="bg-transparent outline-none font-bold text-xs max-w-[200px]">
                        <option value="">{materialFilter === 'Eletrodos Treliças' ? 'Todos' : materialFilter === 'Treliça' ? 'Todos' : 'Todas'}</option>
                        {!materialFilter ? (
                            <>
                                <optgroup label="Fio Máquina">
                                    {availableBitolaOptions.filter(o => o.materialType === 'Fio Máquina').map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="CA-60">
                                    {availableBitolaOptions.filter(o => o.materialType === 'CA-60').map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Eletrodos Treliças">
                                    {availableBitolaOptions.filter(o => o.materialType === 'Eletrodos Treliças').map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Sabão">
                                    {availableBitolaOptions.filter(o => o.materialType === 'Sabão').map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Treliças">
                                    {availableBitolaOptions.filter(o => o.materialType === 'Treliça').map(o => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </optgroup>
                            </>
                        ) : (
                            availableBitolaOptions.map(o => (
                                <option key={o.key} value={o.key}>{o.label}</option>
                            ))
                        )}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm relative" ref={statusMobileRef}>
                    <label className="text-[10px] font-bold text-slate-500">ST:</label>
                    <button 
                        onClick={() => setIsMobileStatusOpen(!isMobileStatusOpen)}
                        className="bg-transparent outline-none font-bold text-xs text-left"
                    >
                        {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}
                    </button>
                    {isMobileStatusOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 min-w-[200px] flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                Todos
                            </label>
                            <hr className="my-1 border-slate-100" />
                            {[
                                { val: 'Disponível', label: 'Disponível' },
                                { val: 'Disponível - Suporte Treliça', label: 'Sup. Treliça' },
                                { val: 'Em Produção - Trefila', label: 'Em Prod. Trefila' },
                                { val: 'Em Produção - Treliça', label: 'Em Prod. Treliça' },
                                { val: 'Reservado', label: 'Reservado' },
                                { val: 'Consumido', label: 'Consumido' }
                            ].map(s => (
                                <label key={s.val} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                    <input 
                                        type="checkbox" 
                                        checked={statusFilter.includes(s.val)} 
                                        onChange={e => {
                                            if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                            else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                        }} 
                                        className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                    />
                                    {s.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Barra de Busca com Seleção de Campo */}
            <div className="no-print bg-white p-3 rounded-xl shadow border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="flex items-center gap-3 flex-grow">
                    <SearchIcon className="h-5 w-5 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder={
                            searchField === 'corrida' ? 'Buscar exclusivamente por Corrida...' :
                            searchField === 'nfe' ? 'Buscar exclusivamente por Nota Fiscal (NF-e)...' :
                            searchField === 'fornecedor' ? 'Buscar exclusivamente por Fornecedor...' :
                            searchField === 'conferencia' ? 'Buscar exclusivamente por Nº de Conferência...' :
                            searchField === 'lote' ? 'Buscar exclusivamente por Lote Interno...' :
                            'Buscar por lote, corrida, NF-e, fornecedor, conferência ou bitola...'
                        }
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-grow outline-none font-medium text-slate-800 placeholder-slate-400 text-sm"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                            title="Limpar busca"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Seletor do Campo de Busca */}
                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-3 shrink-0">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                        <FilterIcon className="h-3.5 w-3.5 text-slate-400" />
                        Procurar por:
                    </span>
                    <select
                        value={searchField}
                        onChange={e => setSearchField(e.target.value as SearchFieldType)}
                        className="bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-[#0F3F5C] focus:border-[#0F3F5C] outline-none cursor-pointer"
                    >
                        <option value="todos">🔍 Todos os Campos</option>
                        <option value="corrida">🏷️ Corrida</option>
                        <option value="nfe">📄 NF-e</option>
                        <option value="fornecedor">🏭 Fornecedor</option>
                        <option value="conferencia">📋 Nº Conferência</option>
                        <option value="lote">📦 Lote Interno</option>
                    </select>
                </div>

                {/* Botões para abrir Sub-Janelas de Configuração e Histórico */}
                <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-3 shrink-0 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsLotDisplayModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 text-slate-700 text-xs font-bold transition shadow-2xs group"
                        title="Configurações de visualização dos lotes e formato da tabela"
                    >
                        <AdjustmentsIcon className="h-4 w-4 text-[#0F3F5C] group-hover:rotate-45 transition-transform" />
                        <span className="whitespace-nowrap">Exibição do Lote</span>
                        <span className="bg-[#0F3F5C] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                            {Number(lotDisplayOptions.showCorrida) + Number(lotDisplayOptions.showNfe) + Number(lotDisplayOptions.showConferencia) + Number(lotDisplayOptions.showFornecedor)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold hidden xl:inline">
                            ({lotDisplayOptions.displayMode === 'badge' ? 'Badges' : 'Colunas'})
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsMovementsModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-black transition shadow-2xs group"
                        title="Abrir Histórico de Movimentações e Baixas em sub-janela"
                    >
                        <span>📋</span>
                        <span className="whitespace-nowrap">Histórico</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs group"
                        title="Central de Impressão de Estoque (Individual ou Resumido em Colunas)"
                    >
                        <PrinterIcon className="h-4 w-4 text-[#0F3F5C]" />
                        <span className="whitespace-nowrap">Imprimir</span>
                    </button>
                </div>
            </div>

            {/* Sub-Janela Modal: Configurações de Exibição dos Lotes */}
            {isLotDisplayModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
                        <div className="p-4 bg-gradient-to-r from-[#0F3F5C] to-slate-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <AdjustmentsIcon className="h-5 w-5 text-blue-300" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Visualização dos Lotes</h3>
                                    <p className="text-[11px] text-blue-100">Personalize dados exibidos e formato da tabela</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsLotDisplayModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Seção 1: Dados sobre o lote */}
                            <div>
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-2.5">
                                    Campos Exibidos nos Lotes
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ showCorrida: !lotDisplayOptions.showCorrida })}
                                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            lotDisplayOptions.showCorrida
                                                ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-xs'
                                                : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-1.5">
                                            🏷️ Corrida
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={lotDisplayOptions.showCorrida}
                                            readOnly
                                            className="h-4 w-4 rounded accent-amber-600 pointer-events-none"
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ showNfe: !lotDisplayOptions.showNfe })}
                                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            lotDisplayOptions.showNfe
                                                ? 'bg-blue-50/90 border-blue-300 text-blue-900 shadow-xs'
                                                : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-1.5">
                                            📄 NF-e
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={lotDisplayOptions.showNfe}
                                            readOnly
                                            className="h-4 w-4 rounded accent-blue-600 pointer-events-none"
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ showConferencia: !lotDisplayOptions.showConferencia })}
                                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            lotDisplayOptions.showConferencia
                                                ? 'bg-purple-50/90 border-purple-300 text-purple-900 shadow-xs'
                                                : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-1.5">
                                            📋 Conferência
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={lotDisplayOptions.showConferencia}
                                            readOnly
                                            className="h-4 w-4 rounded accent-purple-600 pointer-events-none"
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ showFornecedor: !lotDisplayOptions.showFornecedor })}
                                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                            lotDisplayOptions.showFornecedor
                                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-xs'
                                                : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-1.5">
                                            🏭 Fornecedor
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={lotDisplayOptions.showFornecedor}
                                            readOnly
                                            className="h-4 w-4 rounded accent-emerald-600 pointer-events-none"
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Seção 2: Modo de Layout da Tabela */}
                            <div>
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-2.5">
                                    Formato de Exibição na Tabela
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ displayMode: 'badge' })}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            lotDisplayOptions.displayMode === 'badge'
                                                ? 'bg-[#0F3F5C] text-white border-[#0F3F5C] shadow-md'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="font-extrabold text-xs flex items-center gap-1.5">
                                            🏷️ Badges no Lote
                                        </div>
                                        <p className={`text-[11px] mt-1 ${lotDisplayOptions.displayMode === 'badge' ? 'text-blue-100' : 'text-slate-500'}`}>
                                            Compacto: dados exibidos agrupados junto ao lote interno.
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateLotDisplayOptions({ displayMode: 'column' })}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            lotDisplayOptions.displayMode === 'column'
                                                ? 'bg-[#0F3F5C] text-white border-[#0F3F5C] shadow-md'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="font-extrabold text-xs flex items-center gap-1.5">
                                            📊 Em Colunas
                                        </div>
                                        <p className={`text-[11px] mt-1 ${lotDisplayOptions.displayMode === 'column' ? 'text-blue-100' : 'text-slate-500'}`}>
                                            Dedicado: cria colunas exclusivas para cada campo ativo.
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Ações rápidas */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => updateLotDisplayOptions(DEFAULT_LOT_DISPLAY_OPTIONS)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition"
                                >
                                    Restaurar Padrão
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsLotDisplayModalOpen(false)}
                                    className="px-5 py-2 bg-[#0F3F5C] hover:bg-[#0c3149] text-white font-black text-xs rounded-xl shadow transition"
                                >
                                    Concluído
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAINEL DE DESTAQUE E VISUALIZAÇÃO AMPLIADA DO MODELO SELECIONADO */}
            {selectedGaugeOption && (
                <div className="no-print bg-gradient-to-r from-blue-900 via-[#0F3F5C] to-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-xl border border-blue-800/50 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                        {/* Esquerda: Identificação do Modelo / Peça */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                    {selectedGaugeOption.materialType === 'Treliça' ? '📐 Modelo de Treliça' :
                                     selectedGaugeOption.materialType === 'Eletrodos Treliças' ? '⚡ Eletrodo Treliça' :
                                     selectedGaugeOption.materialType === 'Sabão' ? '🧼 Sabão de Trefila' :
                                     `⚙️ ${selectedGaugeOption.materialType}`}
                                </span>
                                {selectedGaugeOption.tamanho && (
                                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-2 py-0.5 rounded-md">
                                        📏 {selectedGaugeOption.tamanho} Metros
                                    </span>
                                )}
                                {selectedGaugeOption.productCode && (
                                    <span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-mono font-black px-2 py-0.5 rounded-md uppercase">
                                        Cód. {selectedGaugeOption.productCode}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                    {selectedGaugeOption.description || selectedGaugeOption.gauge}
                                </h2>
                            </div>

                            {/* Especificações Técnicas (Fios, Bitolas, Peso) */}
                            {(selectedGaugeOption.superior || selectedGaugeOption.inferior || selectedGaugeOption.senozoide || selectedGaugeOption.peso_final) ? (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {selectedGaugeOption.superior && (
                                        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs">
                                            <span className="text-blue-300 text-[10px] font-bold uppercase block">Fio Superior</span>
                                            <span className="font-black text-white text-sm">Ø {selectedGaugeOption.superior} mm</span>
                                        </div>
                                    )}
                                    {selectedGaugeOption.inferior && (
                                        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs">
                                            <span className="text-blue-300 text-[10px] font-bold uppercase block">Fio Inferior</span>
                                            <span className="font-black text-white text-sm">Ø {selectedGaugeOption.inferior} mm</span>
                                        </div>
                                    )}
                                    {selectedGaugeOption.senozoide && (
                                        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs">
                                            <span className="text-blue-300 text-[10px] font-bold uppercase block">Senozoide</span>
                                            <span className="font-black text-white text-sm">Ø {selectedGaugeOption.senozoide} mm</span>
                                        </div>
                                    )}
                                    {selectedGaugeOption.peso_final && (
                                        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs">
                                            <span className="text-emerald-300 text-[10px] font-bold uppercase block">Peso Estimado</span>
                                            <span className="font-black text-emerald-200 text-sm">{selectedGaugeOption.peso_final} kg/un</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-blue-200/80">
                                    Visualizando lotes associados a este modelo em estoque.
                                </p>
                            )}
                        </div>

                        {/* Direita: Métricas do Estoque deste Modelo e Botões de Ação */}
                        <div className="flex items-center gap-4 border-t lg:border-t-0 lg:border-l border-white/15 pt-3 lg:pt-0 lg:pl-6 shrink-0 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setIsMovementsModalOpen(true)}
                                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition border border-white/20 flex items-center gap-2 text-xs font-black shadow-xs shrink-0"
                                title="Ver histórico de movimentações deste modelo em sub-janela"
                            >
                                <span>📋</span>
                                <span>Histórico</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsPrintModalOpen(true)}
                                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition border border-white/20 flex items-center gap-2 text-xs font-black shadow-xs shrink-0"
                                title="Imprimir este modelo ou selecionar bitolas lado a lado"
                            >
                                <PrinterIcon className="h-4 w-4" />
                                <span>Imprimir</span>
                            </button>

                            <div className="flex items-center gap-5">
                                <div className="text-left lg:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 block">Lotes Encontrados</span>
                                    <span className="text-2xl font-black text-white">{stats.count}</span>
                                </div>
                                <div className="text-left lg:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 block">
                                        {selectedGaugeOption.materialType === 'Eletrodos Treliças' ? 'Peças Disponíveis' :
                                         selectedGaugeOption.materialType === 'Treliça' ? 'Barras / Volume' : 'Disponível'}
                                    </span>
                                    <span className="text-2xl font-black text-emerald-400">
                                        {selectedGaugeOption.materialType === 'Eletrodos Treliças'
                                            ? `${stats.weight.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} un`
                                            : `${stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setBitolaFilter('')}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20 flex items-center gap-1.5 text-xs font-bold shrink-0"
                                title="Remover filtro deste modelo e ver todas as peças"
                            >
                                <XIcon className="h-4 w-4" />
                                <span>Ver Todos</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {renderPaginationBar('top')}
            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
                            <tr>
                                <th className="p-3 text-center print:hidden">Data</th>
                                <th className="p-3 text-center">Lote Interno</th>
                                {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showCorrida && (
                                    <th className="p-3 text-center text-amber-800 bg-amber-50/60">Corrida</th>
                                )}
                                {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showNfe && (
                                    <th className="p-3 text-center text-blue-800 bg-blue-50/60">NF-e</th>
                                )}
                                {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showConferencia && (
                                    <th className="p-3 text-center text-purple-800 bg-purple-50/60">Conferência</th>
                                )}
                                {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showFornecedor && (
                                    <th className="p-3 text-center text-emerald-800 bg-emerald-50/60">Fornecedor</th>
                                )}
                                <th className="p-3 text-center">Tipo Aço</th>
                                <th className="p-3 text-center">Mat.</th>
                                <th className="p-3 text-center min-w-[200px]">{materialFilter === 'Eletrodos Treliças' ? 'Modelo / Código' : materialFilter === 'Sabão' ? 'Embalagem / Produto' : materialFilter === 'Treliça' ? 'Modelo / Ficha Técnica' : 'Bitola'}</th>
                                <th className={`p-3 text-center ${materialFilter === 'Treliça' ? 'min-w-[170px]' : ''}`}>{materialFilter === 'Eletrodos Treliças' ? 'Qtd (un)' : materialFilter === 'Sabão' ? 'Peso (kg / saco)' : materialFilter === 'Treliça' ? 'Qtd / Peso (kg)' : 'Peso (kg)'}</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center no-print">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {paginatedItems.length === 0 && (
                                <tr>
                                    <td colSpan={8 + (lotDisplayOptions.displayMode === 'column' ? (Number(lotDisplayOptions.showCorrida) + Number(lotDisplayOptions.showNfe) + Number(lotDisplayOptions.showConferencia) + Number(lotDisplayOptions.showFornecedor)) : 0)} className="p-8 text-center text-slate-400 font-medium">
                                        Nenhum lote encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                            {paginatedItems.map(item => {
                                const details = getLotDetails(item);
                                const matchingGauge = (item.productCode && gaugeLookupMap.get(`${item.materialType}::${item.bitola}::${item.productCode}`)) ||
                                                      (item.description && gaugeLookupMap.get(`${item.materialType}::${item.bitola}::${item.description}`)) ||
                                                      gaugeLookupMap.get(`${item.materialType}::${item.bitola}`);
                                return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500 font-medium print:hidden">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-center">
                                        <span className="font-black text-slate-900 block">{item.internalLot}</span>
                                        {/* Informações sobre o lote quando no modo 'No Lote' */}
                                        {lotDisplayOptions.displayMode === 'badge' && (
                                            <div className="flex flex-wrap items-center justify-center gap-1 mt-1 max-w-[220px] mx-auto">
                                                {lotDisplayOptions.showCorrida && details.runNumber && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title={`Corrida: ${details.runNumber}`}>
                                                        <span className="text-[8px] uppercase tracking-wider text-amber-600 font-extrabold mr-1">COR:</span>
                                                        {details.runNumber}
                                                    </span>
                                                )}
                                                {lotDisplayOptions.showNfe && details.nfe && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200" title={`NF-e: ${details.nfe}`}>
                                                        <span className="text-[8px] uppercase tracking-wider text-blue-600 font-extrabold mr-1">NF:</span>
                                                        {details.nfe}
                                                    </span>
                                                )}
                                                {lotDisplayOptions.showConferencia && details.confNum && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200" title={`Nº Conferência: ${details.confNum}`}>
                                                        <span className="text-[8px] uppercase tracking-wider text-purple-600 font-extrabold mr-1">CONF:</span>
                                                        #{details.confNum}
                                                    </span>
                                                )}
                                                {lotDisplayOptions.showFornecedor && details.supplier && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 max-w-[140px] truncate" title={`Fornecedor: ${details.supplier}`}>
                                                        <span className="text-[8px] uppercase tracking-wider text-emerald-600 font-extrabold mr-1">FORN:</span>
                                                        {details.supplier}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    {/* Colunas dedicadas quando no modo 'Em Colunas' */}
                                    {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showCorrida && (
                                        <td className="p-3 text-center font-bold text-amber-800 text-xs bg-amber-50/20">
                                            {details.runNumber || '-'}
                                        </td>
                                    )}
                                    {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showNfe && (
                                        <td className="p-3 text-center font-bold text-blue-800 text-xs bg-blue-50/20">
                                            {details.nfe || '-'}
                                        </td>
                                    )}
                                    {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showConferencia && (
                                        <td className="p-3 text-center font-bold text-purple-800 text-xs bg-purple-50/20">
                                            {details.confNum ? `#${details.confNum}` : '-'}
                                        </td>
                                    )}
                                    {lotDisplayOptions.displayMode === 'column' && lotDisplayOptions.showFornecedor && (
                                        <td className="p-3 text-center font-semibold text-emerald-800 text-xs bg-emerald-50/20 max-w-[140px] truncate" title={details.supplier}>
                                            {details.supplier || '-'}
                                        </td>
                                    )}
                                    <td className="p-3 text-center font-bold text-slate-600">{(item.materialType === 'Eletrodos Treliças' || item.materialType === 'Sabão' || item.materialType === 'Treliça') ? '-' : (item.steelType || '-')}</td>
                                    <td className="p-3 text-center text-slate-500 font-semibold">
                                        {item.materialType === 'Sabão' ? (
                                            <span className="inline-flex items-center gap-1 font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                                🧼 Sabão
                                            </span>
                                        ) : item.materialType === 'Treliça' ? (
                                            <span className="inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                📐 Treliça
                                            </span>
                                        ) : item.materialType}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            {item.materialType === 'Eletrodos Treliças' ? (
                                                <>
                                                    <span className="font-black text-amber-900 text-xs">
                                                        {item.description || item.bitola}
                                                    </span>
                                                    {item.productCode ? (
                                                        <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 mt-0.5">
                                                            Cód. {item.productCode}
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : item.materialType === 'Sabão' ? (
                                                <>
                                                    <span className="font-black text-teal-700 text-xs flex items-center gap-1">
                                                        🧼 {item.bitola || 'Saco 25kg'}
                                                    </span>
                                                    {(() => {
                                                        const displayDesc = item.description || matchingGauge?.description || 'Condat';
                                                        const displayCode = item.productCode || matchingGauge?.productCode || '00010';
                                                        return (
                                                            <>
                                                                {displayDesc && (
                                                                    <span className="text-[10px] text-slate-700 font-semibold max-w-[170px] truncate" title={displayDesc}>
                                                                        {displayDesc}
                                                                    </span>
                                                                )}
                                                                {displayCode ? (
                                                                    <span className="text-[9px] font-mono font-black text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 uppercase print:text-black mt-0.5">
                                                                        Cód. {displayCode}
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            ) : item.materialType === 'Treliça' ? (
                                                (() => {
                                                    const code = item.productCode || matchingGauge?.productCode;
                                                    const sup = matchingGauge?.superior || (item as any).superior;
                                                    const inf = matchingGauge?.inferior || (item as any).inferior;
                                                    const sen = matchingGauge?.senozoide || (item as any).senozoide;
                                                    const peso = matchingGauge?.peso_final;
                                                    const techInfo = [
                                                        sup ? `Sup: ${sup}mm` : '',
                                                        inf ? `Inf: ${inf}mm` : '',
                                                        sen ? `Sen: ${sen}mm` : '',
                                                        peso ? `Peso: ${peso} kg/m` : ''
                                                    ].filter(Boolean).join(' • ');

                                                    return (
                                                        <div 
                                                            className="flex items-center gap-2 justify-center flex-wrap"
                                                            title={techInfo ? `Ficha Técnica: ${techInfo}` : undefined}
                                                        >
                                                            {code && (
                                                                <span className="text-[11px] font-mono font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300 uppercase shadow-2xs whitespace-nowrap">
                                                                    Cód. {code}
                                                                </span>
                                                            )}
                                                            <span className="font-black text-slate-900 text-sm tracking-tight">
                                                                {item.description || matchingGauge?.description || `Treliça ${item.bitola}`}
                                                            </span>
                                                            {(matchingGauge?.tamanho || (item as any).tamanho) && (
                                                                <span className="text-xs font-black text-white bg-blue-600 px-2 py-0.5 rounded shadow-2xs">
                                                                    {matchingGauge?.tamanho || (item as any).tamanho}m
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                             ) : (
                                                <>
                                                    <span className="font-black text-blue-600">{item.bitola.replace('.', ',')} mm</span>
                                                    {(() => {
                                                        const displayDesc = item.description || matchingGauge?.description;
                                                        const displayCode = item.productCode || matchingGauge?.productCode;

                                                        return (
                                                            <>
                                                                {displayDesc && (
                                                                    <span className="text-[10px] text-slate-700 font-semibold max-w-[170px] truncate" title={displayDesc}>
                                                                        {displayDesc}
                                                                    </span>
                                                                )}
                                                                {displayCode ? <span className="text-[9px] text-slate-500 font-black uppercase print:text-black">{displayCode}</span> : null}
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-black text-slate-800">
                                        {item.materialType === 'Eletrodos Treliças' ? (
                                            <span>{item.remainingQuantity.toFixed(0)} <span className="text-[10px] text-slate-400 font-bold">un</span></span>
                                        ) : item.materialType === 'Sabão' ? (
                                            <span>{item.remainingQuantity.toFixed(2)} <span className="text-[10px] text-teal-700 font-bold">kg</span></span>
                                        ) : item.materialType === 'Treliça' ? (
                                             <div className="flex flex-col items-center justify-center">
                                                 {(() => {
                                                     const unitW = parseFloat((matchingGauge?.peso_final || '').replace(',', '.') || '0');
                                                     const bars = item.quantity || details.quantity || (item.history?.find((h: any) => h.details?.quantity)?.details?.quantity) || (unitW > 0 && item.remainingQuantity ? Math.round(item.remainingQuantity / unitW) : null);
                                                     const avgKgPerBar = bars && bars > 0 && item.remainingQuantity ? (item.remainingQuantity / bars).toFixed(2) : (unitW > 0 ? unitW.toFixed(2) : null);

                                                     return (
                                                         <>
                                                             <div className="flex items-center gap-5 justify-center flex-wrap">
                                                                 {bars ? (
                                                                     <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs" title="Quantidade de barras no pacote">
                                                                         {bars} <span className="text-[10px] font-semibold text-blue-700 ml-1">barras</span>
                                                                     </span>
                                                                 ) : null}
                                                                 <span className="font-black text-slate-900 text-sm whitespace-nowrap">
                                                                     {item.remainingQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] text-blue-700 font-bold">kg</span>
                                                                 </span>
                                                             </div>
                                                             {avgKgPerBar && (
                                                                 <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 whitespace-nowrap" title={unitW > 0 ? `Referência técnica: ${unitW} kg/barra` : undefined}>
                                                                     ~{avgKgPerBar} kg/barra
                                                                 </span>
                                                             )}
                                                         </>
                                                     );
                                                 })()}
                                             </div>
                                        ) : (
                                            item.remainingQuantity.toFixed(2)
                                        )}
                                    </td>
                                    <td className="p-3 text-center">{getStatusBadge(item.status)}</td>
                                    <td className="p-3 flex justify-center gap-2 no-print">
                                        {isGestor ? (
                                            <>
                                                {(item.status.includes('Produção') || item.status === 'Reservado') && (
                                                    <button onClick={() => handleRevertToAvailable(item)} title="Voltar para Disponível" className="p-1 hover:bg-emerald-50 rounded-lg transition-colors">
                                                        <ArrowPathIcon className="h-5 w-5 text-emerald-500" />
                                                    </button>
                                                )}
                                                <button onClick={() => setConsumingItem(item)} title="Dar Baixa (Consumir)" className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
                                                    <DownloadIcon className="h-5 w-5 text-slate-400 hover:text-[#0F3F5C]" />
                                                </button>
                                                <button onClick={() => setHistoryLot(item)} title="Histórico" className="p-1 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <BookOpenIcon className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                                </button>
                                                <button onClick={() => setEditingItem(item)} title="Editar" className="p-1 hover:bg-amber-50 rounded-lg transition-colors">
                                                    <PencilIcon className="h-5 w-5 text-slate-400 hover:text-amber-500" />
                                                </button>
                                                <button onClick={() => confirm('Excluir?') && deleteStockItem(item.id)} title="Excluir" className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                                                    <TrashIcon className="h-5 w-5 text-red-400 hover:text-red-600" />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => setConsumingItem(item)} title="Consumir / Usar na Máquina" className="px-3 py-1 bg-[#0F3F5C] text-white rounded-lg text-xs font-bold hover:bg-[#0A2A3D] transition">
                                                Consumir
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>
                {renderPaginationBar('bottom')}
            </div>

            {/* ========================================================================= */}
            {/* SUB-JANELA MODAL: HISTÓRICO DE MOVIMENTAÇÕES & BAIXAS                     */}
            {/* ========================================================================= */}
            {isMovementsModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Header do Modal */}
                        <div className="p-4 md:px-6 md:py-4 bg-gradient-to-r from-slate-900 via-[#0F3F5C] to-slate-900 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">
                                    📋
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base md:text-lg font-black tracking-tight">Histórico de Movimentações & Baixas</h3>
                                        {materialFilter && (
                                            <span className="text-[10px] font-bold bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30">
                                                {materialFilter} {bitolaFilter ? `• ${selectedGaugeOption?.description || bitolaFilter}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-blue-200/80">Entradas de compras, consumos em produção, transferências e baixas registradas.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMovementsModalOpen(false)}
                                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
                                title="Fechar histórico"
                            >
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Conteúdo com rolagem do Histórico */}
                        <div className="p-3 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
                            <StockMovementsTable
                                stock={stock}
                                conferences={conferences}
                                materialFilter={materialFilter}
                                bitolaFilter={bitolaFilter}
                                steelTypeFilter={steelTypeFilter}
                                searchTerm={searchTerm}
                                onSelectLot={(lot) => setHistoryLot(lot)}
                            />
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                                Sincronizado em tempo real com o estoque e movimentações.
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsMovementsModalOpen(false)}
                                className="px-6 py-2 bg-[#0F3F5C] hover:bg-[#0c3149] text-white font-black text-xs rounded-xl shadow transition ml-auto"
                            >
                                Fechar Histórico
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUB-JANELA MODAL: CENTRAL DE IMPRESSÃO DE ESTOQUE */}
            <StockPrintModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                stock={stock}
                gauges={gauges}
                initialMaterial={materialFilter || (selectedGaugeOption?.materialType || 'CA-60')}
                initialBitola={bitolaFilter}
                initialSteelType={steelTypeFilter}
            />

            {/* ========================================================================= */}
            {/* MODAL 1: CADASTRAR NOVO LOTE DE ELETRODOS COM GERADOR SEQUENCIAL         */}
            {/* ========================================================================= */}
            {isAddingElectrode && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
                        {/* Header do Modal */}
                        <div className="p-5 bg-gradient-to-r from-slate-900 via-[#0F3F5C] to-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xl font-black">
                                    ⚡
                                </span>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Cadastrar Novo Lote de Eletrodos</h3>
                                    <p className="text-xs text-slate-300">Geração automática de lote sequencial e guia de identificação física.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddingElectrode(false)}
                                className="p-2 hover:bg-white/10 rounded-xl transition text-slate-300 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleAddElectrodeLot} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Tipo de Eletrodo *
                                    </label>
                                    <select
                                        value={newElType}
                                        onChange={e => {
                                            const val = e.target.value as TrelicaElectrodeType;
                                            setNewElType(val);
                                            setNewElBenchmarkMeters(DEFAULT_BENCHMARK_METERS[val] || 15000);
                                        }}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0F3F5C]"
                                    >
                                        <option value="Superior">Superior (Chanfrado Banzos Sup.)</option>
                                        <option value="Base Superior">Base Superior (Porta-Eletrodo Sup.)</option>
                                        <option value="Central Triangular">Central Triangular (Cunha com Ranhura)</option>
                                        <option value="Inferior">Inferior (Solda Banzos Inf.)</option>
                                        <option value="Base Inferior">Base Inferior (Porta-Eletrodo Inf.)</option>
                                        <option value="Lateral">Lateral (Pastilha Lateral Inf.)</option>
                                        <option value="Base Lateral">Base Lateral (Suporte Lateral)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Condição da Peça *
                                    </label>
                                    <select
                                        value={newElCondition}
                                        onChange={e => setNewElCondition(e.target.value as 'novo' | 'retificado')}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#0F3F5C]"
                                    >
                                        <option value="novo">Novo (Peça 100% Nova de Fábrica)</option>
                                        <option value="retificado">Retificado (Reusinado na Ferramentaria)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Lote Sequencial Gerado com Destaque */}
                            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>Nº do Lote Gerado pelo Sistema</span>
                                        <span className="text-[10px] font-mono bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                                            Sequencial Automático
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setNewElLotNumber(generateNextElectrodeLot(newElType, electrodeStocks, newElCondition))}
                                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
                                    >
                                        Regenerar Próximo
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={newElLotNumber}
                                    onChange={e => setNewElLotNumber(e.target.value.toUpperCase())}
                                    className="w-full p-3 bg-white border-2 border-amber-300 rounded-xl text-base font-mono font-black text-slate-900 outline-none focus:border-[#0F3F5C]"
                                    placeholder="Ex: EL-SUP-2026-02"
                                />
                                <p className="text-[11px] text-amber-800">
                                    O sistema calculou automaticamente o próximo número sequencial com base no tipo ({newElType}) e lotes já cadastrados.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Qtd. Peças Recebidas *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={newElQuantity}
                                        onChange={e => setNewElQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Fornecedor / Origem
                                    </label>
                                    <input
                                        type="text"
                                        value={newElSupplier}
                                        onChange={e => setNewElSupplier(e.target.value)}
                                        placeholder="Ex: Metalúrgica Ita Soldas"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                        Vida Útil (Metros)
                                    </label>
                                    <input
                                        type="number"
                                        value={newElBenchmarkMeters}
                                        onChange={e => setNewElBenchmarkMeters(parseInt(e.target.value) || 15000)}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                    Liga / Material do Eletrodo
                                </label>
                                <input
                                    type="text"
                                    value={newElMaterial}
                                    onChange={e => setNewElMaterial(e.target.value)}
                                    placeholder="Ex: CuCrZr (Cobre Cromo Zircônio)"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                    Observações / NF-e
                                </label>
                                <textarea
                                    value={newElNotes}
                                    onChange={e => setNewElNotes(e.target.value)}
                                    placeholder="Ex: NF-e 1234, lote do fabricante A-987..."
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 outline-none h-16"
                                />
                            </div>

                            {/* GUIA VISUAL DE MARCAÇÃO FÍSICA NAS PEÇAS */}
                            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-amber-400 font-black text-sm">✍️</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                            Marcação Física nas Peças ({physicalMarks.length} unidades)
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyMarks(physicalMarks)}
                                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                    >
                                        {copySuccess ? '✓ Copiado!' : '📋 Copiar Etiquetas'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    Escreva com marcador industrial permanente ou punção metálica este código em cada uma das peças físicas recebidas:
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1 max-h-24 overflow-y-auto">
                                    {physicalMarks.map((tag, i) => (
                                        <span key={i} className="font-mono text-xs font-black bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingElectrode(false)}
                                    className="flex-1 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-lg shadow-amber-500/20 text-xs"
                                >
                                    Salvar e Adicionar ao Estoque
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: BAIXAR SALDO DO LOTE DE ELETRODO                                  */}
            {/* ========================================================================= */}
            {consumingElectrode && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <span>⬇️ Dar Baixa em Lote de Eletrodo</span>
                                </h3>
                                <p className="text-xs text-slate-400 font-mono">{consumingElectrode.lot_number} ({consumingElectrode.type})</p>
                            </div>
                            <button onClick={() => setConsumingElectrode(null)} className="p-1 hover:bg-white/10 rounded-full transition">
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmConsumeElectrode} className="p-6 space-y-4">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Saldo Atual Disponível:</span>
                                <span className="text-2xl font-black font-mono text-amber-700">{consumingElectrode.quantity} un</span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                    Quantidade para Baixar (unidades) *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max={consumingElectrode.quantity}
                                    value={consumeElQty}
                                    onChange={e => setConsumeElQty(Math.min(consumingElectrode.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-full p-3 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono font-black text-lg text-slate-900 outline-none focus:border-[#0F3F5C]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                    Motivo da Baixa / Destino *
                                </label>
                                <select
                                    value={consumeElReason}
                                    onChange={e => setConsumeElReason(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                >
                                    <option value="Desgaste Final / Sucata">Desgaste Final / Sucata (Fim de Vida Útil)</option>
                                    <option value="Envio para Oficina / Retífica">Envio para Oficina / Retífica</option>
                                    <option value="Avaria Mecânica / Trinca">Avaria Mecânica / Trinca / Quebra</option>
                                    <option value="Ajuste de Inventário / Contagem">Ajuste de Inventário / Contagem Física</option>
                                    <option value="Instalação Manual em Máquina">Instalação Manual em Máquina</option>
                                    <option value="Outro">Outro Motivo</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                                    Observações Extras / Detalhes
                                </label>
                                <textarea
                                    value={consumeElNotes}
                                    onChange={e => setConsumeElNotes(e.target.value)}
                                    placeholder="Ex: Peça danificada no turno B, enviada para usinagem..."
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 outline-none h-16"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setConsumingElectrode(null)}
                                    className="flex-1 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold rounded-xl transition text-xs shadow-lg shadow-blue-950/20"
                                >
                                    Confirmar Baixa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: GUIA VISUAL DE PEÇAS E ETIQUETAS DO LOTE                         */}
            {/* ========================================================================= */}
            {viewingPiecesLot && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-400 text-lg font-black">🏷️</span>
                                    <h3 className="text-base font-black tracking-tight">Marcação das Peças Físicas</h3>
                                </div>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{viewingPiecesLot.lot_number} • {viewingPiecesLot.type}</p>
                            </div>
                            <button onClick={() => setViewingPiecesLot(null)} className="p-1 hover:bg-white/10 rounded-full transition">
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <span className="text-slate-400 block font-bold text-[10px] uppercase">Saldo em Estoque</span>
                                    <span className="font-mono font-black text-base text-slate-900">{viewingPiecesLot.quantity} unidades</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block font-bold text-[10px] uppercase">Condição</span>
                                    <span className="font-bold text-xs capitalize text-emerald-700">{viewingPiecesLot.status || 'novo'}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                                    Códigos gravados nas peças deste lote:
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                                    {Array.from({ length: Math.max(1, viewingPiecesLot.quantity) }, (_, idx) => {
                                        const code = `${viewingPiecesLot.lot_number} #${String(idx + 1).padStart(2, '0')}`;
                                        return (
                                            <div key={idx} className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                                                <span className="font-mono font-black text-xs text-amber-950">{code}</span>
                                                <span className="text-[10px] text-amber-700 font-bold">Peça {idx + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const allCodes = Array.from({ length: Math.max(1, viewingPiecesLot.quantity) }, (_, idx) => `${viewingPiecesLot.lot_number} #${String(idx + 1).padStart(2, '0')}`).join('\n');
                                        navigator.clipboard.writeText(allCodes);
                                        alert('Códigos copiados para a área de transferência!');
                                    }}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                                >
                                    <span>📋 Copiar Lista</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewingPiecesLot(null)}
                                    className="flex-1 py-3 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold rounded-xl transition text-xs"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Printable Report Footer */}
            <div className="hidden print:flex mt-12 justify-between items-end border-t border-dashed pt-8">
                <div className="flex flex-col gap-1">
                    <div className="w-48 h-px bg-slate-400"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Responsável pelo Estoque</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 italic">MSM - Tecnologia em Gestão de Produção</p>
                </div>
            </div>
        </div>
    );
};

const EditStockItemModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; gauges: StockGauge[] }> = ({ item, onClose, onSave, gauges }) => {
    const [formData, setFormData] = useState<StockItem>({ ...item });

    const materialGauges = useMemo(() => {
        const customOptions = gauges.filter(g => g.materialType === formData.materialType).map(g => g.gauge);
        if (customOptions.length > 0) {
            return [...new Set(customOptions)]
                .filter(Boolean)
                .sort((a, b) => {
                    const numA = parseFloat((a as string).replace(',', '.'));
                    const numB = parseFloat((b as string).replace(',', '.'));
                    return numA - numB;
                });
        }
        const baseOptions = formData.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : CA60BitolaOptions;
        return [...new Set(baseOptions)]
            .filter(Boolean)
            .sort((a, b) => {
                const numA = parseFloat((a as string).replace(',', '.'));
                const numB = parseFloat((b as string).replace(',', '.'));
                return numA - numB;
            });
    }, [gauges, formData.materialType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <h2 className="text-lg font-bold">Editar Lote: {item.internalLot}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Lote Interno</label>
                            <input type="text" value={formData.internalLot} onChange={e => setFormData({ ...formData, internalLot: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Aço</label>
                            <select value={formData.steelType || ''} onChange={e => setFormData({ ...formData, steelType: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                {SteelTypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">NFe</label>
                            <input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Corrida</label>
                            <input type="text" value={formData.runNumber || ''} onChange={e => setFormData({ ...formData, runNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Material</label>
                            <select
                                value={formData.materialType}
                                onChange={e => {
                                    const val = e.target.value;
                                    const newOpts = getGaugeOptionsForMaterial(val, gauges);
                                    const first = newOpts[0];
                                    setFormData(p => ({
                                        ...p,
                                        materialType: val,
                                        bitola: first ? first.gauge : p.bitola,
                                        productCode: first?.code || '',
                                        description: first?.description || ''
                                    }));
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{formData.materialType === 'Sabão' ? 'Embalagem & Produto' : formData.materialType === 'Eletrodos Treliças' ? 'Modelo & Código' : formData.materialType === 'Treliça' ? 'Modelo & Ficha Técnica' : 'Bitola & Descrição'}</label>
                            {(() => {
                                const opts = getGaugeOptionsForMaterial(formData.materialType, gauges);
                                const currentKey = opts.find(o => 
                                    o.gauge === formData.bitola && 
                                    ((formData.productCode && o.code === formData.productCode) || 
                                     (formData.description && o.description === formData.description))
                                )?.key || opts.find(o => o.gauge === formData.bitola)?.key || (opts[0]?.key || '');

                                return (
                                    <select 
                                        value={currentKey} 
                                        onChange={e => {
                                            const selected = opts.find(o => o.key === e.target.value);
                                            if (selected) {
                                                setFormData(p => ({
                                                    ...p,
                                                    bitola: selected.gauge,
                                                    productCode: selected.code || '',
                                                    description: selected.description || ''
                                                }));
                                            }
                                        }} 
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                                    >
                                        {opts.map(opt => (
                                            <option key={opt.key} value={opt.key}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                );
                            })()}
                        </div>
                    </div>

                    {formData.materialType === 'Treliça' && (
                        <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                            <label className="text-xs font-bold text-blue-900 uppercase block mb-1">Quantidade de Barras (no pacote)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.quantity || ''}
                                    placeholder="Ex: 100"
                                    onChange={e => {
                                        const q = parseInt(e.target.value) || 0;
                                        setFormData(p => {
                                            const opts = getGaugeOptionsForMaterial('Treliça', gauges);
                                            const curOpt = opts.find(o => o.code === p.productCode || o.gauge === p.bitola) || opts[0];
                                            const unitW = parseFloat((curOpt?.peso_final || '').replace(',', '.') || '0');
                                            return {
                                                ...p,
                                                quantity: q,
                                                remainingQuantity: q > 0 && unitW > 0 ? Math.round(q * unitW) : p.remainingQuantity
                                            };
                                        });
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-blue-600">barras</span>
                            </div>
                            <span className="text-[10px] text-blue-700 block mt-1">
                                Ao alterar a quantidade de barras, o peso do pacote é recalculado automaticamente.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{formData.materialType === 'Treliça' ? 'Peso do Pacote (kg)' : 'Peso Atual (kg)'}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formData.remainingQuantity}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, remainingQuantity: parseInt(val) || 0 });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none no-spinner"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Disponível">Disponível</option>
                                <option value="Reservado">Reservado</option>
                                <option value="Em Produção">Em Produção</option>
                                <option value="Consumido">Consumido</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConsumeLotModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; currentUser: User | null }> = ({ item, onClose, onSave, currentUser }) => {
    const [formData, setFormData] = useState({
        weight: item.remainingQuantity,
        observation: '',
        reason: 'Uso na Produção'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newWeight = Math.max(0, item.remainingQuantity - formData.weight);
        
        const updated: StockItem = {
            ...item,
            remainingQuantity: newWeight,
            status: newWeight <= 0 ? 'Consumido' : item.status,
            history: [...(item.history || []), {
                type: 'Baixa de Lote',
                date: new Date().toISOString(),
                details: {
                    'Motivo': formData.reason,
                    'Peso Retirado': `${formData.weight.toFixed(2)} kg`,
                    'Peso Restante': `${newWeight.toFixed(2)} kg`,
                    'Observação': formData.observation || '-',
                    'Operador': currentUser?.username || 'Sistema'
                }
            }]
        };
        onSave(updated);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold">Dar Baixa no Lote</h2>
                        <p className="text-xs opacity-80">{item.internalLot} - {item.materialType} {item.materialType === 'Sabão' ? `🧼 ${item.bitola}` : item.bitola}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-800">Saldo Atual:</span>
                        <span className="text-xl font-black text-[#0F3F5C]">{item.remainingQuantity.toFixed(2)} kg</span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Quantidade para Baixar (kg)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={formData.weight} 
                            onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })} 
                            max={item.remainingQuantity}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                            required 
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Motivo / Destino</label>
                        <select 
                            value={formData.reason} 
                            onChange={e => setFormData({ ...formData, reason: e.target.value })} 
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                            <option value="Uso na Produção">Uso na Produção</option>
                            <option value="Uso para Treliça">Uso para Treliça</option>
                            <option value="Uso para Trefila">Uso para Trefila</option>
                            <option value="Correção de Inventário">Correção de Inventário</option>
                            <option value="Sucata / Perda">Sucata / Perda</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Observações Extras</label>
                        <textarea 
                            value={formData.observation} 
                            onChange={e => setFormData({ ...formData, observation: e.target.value })} 
                            placeholder="Ex: Utilizado para fazer treliça H12..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20">Confirmar Baixa</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockControl;
