import React, { useState, useEffect, useMemo } from 'react';
import type { TrelicaSpoolStand, StockItem, ProductionOrderData, User, TrelicaStandRoleType } from '../types';
import { fetchTrelicaSpoolStands, updateTrelicaSpoolStand, getDefaultSpoolStands } from '../services/supabaseService';
import { DEFAULT_TRELICA_MODELS } from '../utils/trelicaModelsData';
import { supabase } from '../supabaseClient';
import { WarningIcon, CheckCircleIcon, CogIcon, ClockIcon } from './icons';

interface TrelicaSpoolStandsProps {
    machineName: string; // 'Treliça 1' ou 'Treliça 2'
    stock?: StockItem[];
    activeOrder?: ProductionOrderData | null;
    productionOrders?: ProductionOrderData[];
    currentUser?: User | null;
    onSpoolChange?: (stand: TrelicaSpoolStand, newLot: StockItem) => void;
    isCompact?: boolean;
    readOnly?: boolean;
}

export const TrelicaSpoolStands: React.FC<TrelicaSpoolStandsProps> = ({
    machineName,
    stock = [],
    activeOrder = null,
    productionOrders = [],
    currentUser = null,
    onSpoolChange,
    isCompact = false,
    readOnly = false
}) => {
    const [stands, setStands] = useState<TrelicaSpoolStand[]>(() => getDefaultSpoolStands(machineName));
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStandForChange, setSelectedStandForChange] = useState<TrelicaSpoolStand | null>(null);
    const [lotSearchTerm, setLotSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [fetchedOrder, setFetchedOrder] = useState<ProductionOrderData | null>(null);

    // Resolução da OP atual para a máquina (passada diretamente ou buscada de productionOrders)
    const effectiveOrder = useMemo(() => {
        if (activeOrder) return activeOrder;
        if (productionOrders && productionOrders.length > 0) {
            const isMachMatch = (o: ProductionOrderData) => (
                o.machine === machineName || 
                (machineName.startsWith('Treliça') && (o.machine === 'Treliça' || (o.machine && o.machine.startsWith('Treliça'))))
            );

            // 1. Ordem em produção ativa
            const active = productionOrders.find(o => isMachMatch(o) && (o.status === 'in_progress' || o.status === 'Em Produção'));
            if (active) return active;

            // 2. Ordem agendada / pendente
            const pending = productionOrders.find(o => isMachMatch(o) && (o.status === 'pending' || o.status === 'Aberta' || o.status === 'Em Espera'));
            if (pending) return pending;

            // 3. Qualquer ordem da máquina
            const anyOrder = productionOrders.find(isMachMatch);
            if (anyOrder) return anyOrder;
        }
        return fetchedOrder;
    }, [activeOrder, productionOrders, machineName, fetchedOrder]);

    // Buscar no Supabase a OP recente se não veio nas props
    useEffect(() => {
        if (!effectiveOrder) {
            supabase
                .from('production_orders')
                .select('*')
                .or(`machine.eq.${machineName},machine.eq.Treliça`)
                .order('creation_date', { ascending: false })
                .limit(1)
                .then(({ data, error }) => {
                    if (!error && data && data.length > 0) {
                        setFetchedOrder(data[0] as any);
                    }
                });
        }
    }, [machineName, effectiveOrder]);

    // Extrair bitolas exigidas pelo modelo atual de treliça da OP
    const requiredGauges = useMemo(() => {
        let sup = '';
        let sen = '';
        let inf = '';

        if (effectiveOrder) {
            sup = (effectiveOrder as any).trelicaSuperior || (effectiveOrder as any).trelica_superior || (effectiveOrder as any).targetBitola || (effectiveOrder as any).target_bitola || effectiveOrder.inputBitola || '';
            sen = (effectiveOrder as any).trelicaSinusoide || (effectiveOrder as any).trelica_sinusoide || '';
            inf = (effectiveOrder as any).trelicaInferior || (effectiveOrder as any).trelica_inferior || '';

            // Se não veio nas propriedades diretas, buscar pelo modelo no catálogo
            const rawModel = (effectiveOrder.trelicaModel || (effectiveOrder as any).trelica_model || effectiveOrder.productName || (effectiveOrder as any).modelo || '').toString().trim();
            const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanModel = cleanStr(rawModel);

            if ((!sup || !sen || !inf) && cleanModel && Array.isArray(DEFAULT_TRELICA_MODELS)) {
                const found = DEFAULT_TRELICA_MODELS.find(m => {
                    const mMod = cleanStr(m?.modelo || '');
                    const mCod = cleanStr(m?.cod || '');
                    return (mMod && cleanModel.includes(mMod)) || (mCod && cleanModel.includes(mCod)) || (mMod && mMod.includes(cleanModel));
                });
                if (found) {
                    if (!sup) sup = found.superior;
                    if (!sen) sen = found.senozoide;
                    if (!inf) inf = found.inferior;
                }
            }
        }

        const formatG = (v: any, fallback: string) => {
            if (!v) return fallback;
            const n = parseFloat(String(v).replace(',', '.'));
            return isNaN(n) ? fallback : n.toFixed(2);
        };

        // Padrão: Superior 5.80 / 6.00, Senozoide 4.20, Inferior 3.80
        return {
            superior: formatG(sup, '5.80'),
            senozoide: formatG(sen, '4.20'),
            inferior: formatG(inf, '3.80'),
            hasOp: !!effectiveOrder
        };
    }, [effectiveOrder]);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Carregar os 5 Porta-Rolos do Supabase
    const loadStands = async () => {
        try {
            const data = await fetchTrelicaSpoolStands(machineName);
            if (data && data.length > 0) {
                setStands(data.sort((a, b) => a.stand_index - b.stand_index));
            }
        } catch (err) {
            console.warn('Erro ao carregar porta-rolos:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStands();

        // Escutar atualizações via Supabase Realtime com identificador único por instância
        const channelName = `spool-stands-${machineName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        let channel: any = null;
        try {
            channel = supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'trelica_spool_stands',
                        filter: `machine_name=eq.${machineName}`
                    },
                    (payload) => {
                        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                            const updated = payload.new as any;
                            setStands(prev => {
                                const index = prev.findIndex(s => s.id === updated.id || s.stand_index === updated.stand_index);
                                if (index >= 0) {
                                    const copy = [...prev];
                                    copy[index] = {
                                        ...copy[index],
                                        current_lot_id: updated.current_lot_id,
                                        current_lot_number: updated.current_lot_number,
                                        current_gauge: updated.current_gauge,
                                        initial_weight: Number(updated.initial_weight) || 0,
                                        remaining_weight: Number(updated.remaining_weight) || 0,
                                        status: updated.status || 'empty',
                                        last_changed_at: updated.last_changed_at,
                                        last_changed_by: updated.last_changed_by,
                                        updated_at: updated.updated_at
                                    };
                                    return copy;
                                }
                                return prev;
                            });
                        }
                    }
                )
                .subscribe();
        } catch (subErr) {
            console.warn('Erro ao assinar canal realtime de porta-rolos:', subErr);
        }

        return () => {
            if (channel) {
                try {
                    supabase.removeChannel(channel);
                } catch (e) {
                    console.warn('Erro ao remover canal realtime:', e);
                }
            }
        };
    }, [machineName]);

    // Retorna a bitola requerida para a função do stand
    const getTargetGaugeForRole = (roleType?: TrelicaStandRoleType): string => {
        if (!roleType) return '';
        if (roleType === 'superior') return requiredGauges.superior;
        if (roleType.startsWith('senozoide')) return requiredGauges.senozoide;
        if (roleType.startsWith('inferior')) return requiredGauges.inferior;
        return '';
    };

    // Extrai os lotes pré-selecionados na ordem para esta posição/função específica
    const getDesignatedLotIdsForRole = (roleType?: TrelicaStandRoleType): string[] => {
        if (!roleType || !effectiveOrder) return [];
        let lots = effectiveOrder.selectedLotIds || (effectiveOrder as any).selected_lot_ids;
        if (!lots) return [];

        if (typeof lots === 'string') {
            try { lots = JSON.parse(lots); } catch (e) {}
        }

        if (Array.isArray(lots)) {
            // Se for array de IDs simples, filtrar por bitola do rolo
            const target = getTargetGaugeForRole(roleType);
            const targetVal = parseFloat(target.replace(',', '.'));
            return lots.filter(id => {
                const item = stock.find(s => String(s.id) === String(id));
                if (!item) return true;
                const gVal = parseFloat(String(item.bitola || '0').replace(',', '.'));
                return !isNaN(gVal) && !isNaN(targetVal) ? Math.abs(gVal - targetVal) < 0.05 : true;
            }).map(String);
        }

        if (typeof lots === 'object' && lots !== null) {
            let arr: any[] = [];
            if (roleType === 'superior') {
                arr = lots.allSuperior || lots.all_superior || 
                      (lots.superior ? (Array.isArray(lots.superior) ? lots.superior : [lots.superior]) : []) || 
                      (lots.longitudinal ? [lots.longitudinal] : []);
            } else if (roleType === 'senozoide_left') {
                arr = lots.allSenozoideLeft || lots.all_senozoide_left ||
                      (lots.senozoide1 ? (Array.isArray(lots.senozoide1) ? lots.senozoide1 : [lots.senozoide1]) : []) ||
                      (lots.allSenozoide ? lots.allSenozoide : []) ||
                      (lots.senozoide ? (Array.isArray(lots.senozoide) ? lots.senozoide : [lots.senozoide]) : []) ||
                      (lots.sinusoidal ? [lots.sinusoidal] : []);
            } else if (roleType === 'senozoide_right') {
                arr = lots.allSenozoideRight || lots.all_senozoide_right ||
                      (lots.senozoide2 ? (Array.isArray(lots.senozoide2) ? lots.senozoide2 : [lots.senozoide2]) : []) ||
                      (lots.allSenozoide ? lots.allSenozoide : []) ||
                      (lots.senozoide ? (Array.isArray(lots.senozoide) ? lots.senozoide : [lots.senozoide]) : []) ||
                      (lots.sinusoidal2 ? [lots.sinusoidal2] : []);
            } else if (roleType === 'inferior_left') {
                arr = lots.allInferiorLeft || lots.all_inferior_left ||
                      (lots.inferior1 ? (Array.isArray(lots.inferior1) ? lots.inferior1 : [lots.inferior1]) : []) ||
                      (lots.allInferior ? lots.allInferior : []) ||
                      (lots.inferior ? (Array.isArray(lots.inferior) ? lots.inferior : [lots.inferior]) : []) ||
                      (lots.diagonal ? [lots.diagonal] : []);
            } else if (roleType === 'inferior_right') {
                arr = lots.allInferiorRight || lots.all_inferior_right ||
                      (lots.inferior2 ? (Array.isArray(lots.inferior2) ? lots.inferior2 : [lots.inferior2]) : []) ||
                      (lots.allInferior ? lots.allInferior : []) ||
                      (lots.inferior ? (Array.isArray(lots.inferior) ? lots.inferior : [lots.inferior]) : []) ||
                      (lots.diagonal2 ? [lots.diagonal2] : []);
            }
            return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
        }

        return [];
    };

    // Lotes disponíveis de CA-60 no estoque
    // REGRA ESTRITA: Só poder selecionar os rolos exatos (ex: se o superior for 5,8 só aparece 5,8 e os lotes selecionados na ordem)
    const availableCa60Lots = useMemo(() => {
        if (!selectedStandForChange) return [];
        const targetGauge = getTargetGaugeForRole(selectedStandForChange.role_type);
        const designatedIds = getDesignatedLotIdsForRole(selectedStandForChange.role_type);

        return stock
            .filter(item => {
                // Deve ser CA-60
                const isCa60 = item.materialType === 'CA-60';
                if (!isCa60) return false;

                // Não pode ser consumido ou transferido
                if (item.status === 'Transferido' || item.status === 'Consumido para fazer treliça' || item.status === 'Consumido') {
                    return false;
                }

                // Saldo disponível > 0
                if ((item.remainingQuantity || 0) <= 0) return false;

                // REGRA 1: Se foram selecionados lotes para este rolo na ordem, SÓ MOSTRAR ESSES LOTES!
                if (designatedIds.length > 0) {
                    if (!designatedIds.includes(String(item.id))) {
                        return false;
                    }
                }

                // REGRA 2: Só pode selecionar a bitola exata (ex: se o superior for 5,8 só aparece 5,8!)
                if (targetGauge) {
                    const itemGaugeVal = parseFloat(String(item.bitola || '0').replace(',', '.'));
                    const targetGaugeVal = parseFloat(targetGauge.replace(',', '.'));
                    if (isNaN(itemGaugeVal) || isNaN(targetGaugeVal) || Math.abs(itemGaugeVal - targetGaugeVal) > 0.04) {
                        return false;
                    }
                }

                // Filtro por texto de busca
                if (lotSearchTerm.trim()) {
                    const search = lotSearchTerm.toLowerCase();
                    const lotNum = (item.internalLot || '').toLowerCase();
                    const nfe = (item.nfe || '').toLowerCase();
                    if (!lotNum.includes(search) && !nfe.includes(search)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                // REGRA: Se houver lotes pré-selecionados na ordem, manter a exata ordem em que foram selecionados na OP
                if (designatedIds.length > 0) {
                    const idxA = designatedIds.indexOf(String(a.id));
                    const idxB = designatedIds.indexOf(String(b.id));
                    if (idxA !== -1 && idxB !== -1) {
                        return idxA - idxB;
                    }
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                }

                // Prioridade para lotes já no suporte de treliça
                const aSup = a.status === 'Disponível - Suporte Treliça';
                const bSup = b.status === 'Disponível - Suporte Treliça';
                if (aSup && !bSup) return -1;
                if (!aSup && bSup) return 1;

                return (b.remainingQuantity || 0) - (a.remainingQuantity || 0);
            });
    }, [stock, selectedStandForChange, lotSearchTerm, requiredGauges, effectiveOrder]);

    // Executar a Troca do Rolo na Posição Selecionada
    const handleConfirmSpoolChange = async (lot: StockItem) => {
        if (!selectedStandForChange) return;
        setIsSaving(true);

        const lotGauge = lot.bitola ? String(lot.bitola).trim() : '';
        const lotWeight = Number(lot.remainingQuantity || lot.initialQuantity || 0);

        try {
            const updates: Partial<TrelicaSpoolStand> = {
                current_lot_id: lot.id,
                current_lot_number: lot.internalLot,
                current_gauge: lotGauge,
                initial_weight: lotWeight,
                remaining_weight: lotWeight,
                status: 'active',
                last_changed_at: new Date().toISOString(),
                last_changed_by: currentUser?.username || 'Operador'
            };

            // Atualizar no banco Supabase
            const updated = await updateTrelicaSpoolStand(selectedStandForChange.id, updates);

            // Atualizar estado local imediatamente
            setStands(prev => prev.map(s => {
                if (s.id === selectedStandForChange.id) {
                    return {
                        ...s,
                        ...updates
                    } as TrelicaSpoolStand;
                }
                return s;
            }));

            // Notificar componente pai (para criar parada de troca de rolo ou histórico)
            if (onSpoolChange) {
                onSpoolChange({ ...selectedStandForChange, ...updates } as TrelicaSpoolStand, lot);
            }

            showToast(`Bobina do Lote ${lot.internalLot} carregada no ${selectedStandForChange.role_name}!`, 'success');
            setSelectedStandForChange(null);
            setLotSearchTerm('');
        } catch (err) {
            console.error('Erro ao trocar rolo:', err);
            showToast('Erro ao atualizar porta-rolo. Tente novamente.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Descarregar / Esvaziar Porta-Rolo
    const handleUnloadSpool = async (stand: TrelicaSpoolStand, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Deseja descarregar a bobina do ${stand.role_name} (Lote: ${stand.current_lot_number})?`)) return;

        try {
            const updates: Partial<TrelicaSpoolStand> = {
                current_lot_id: null,
                current_lot_number: null,
                current_gauge: null,
                initial_weight: 0,
                remaining_weight: 0,
                status: 'empty',
                last_changed_at: new Date().toISOString(),
                last_changed_by: currentUser?.username || 'Operador'
            };

            await updateTrelicaSpoolStand(stand.id, updates);

            setStands(prev => prev.map(s => s.id === stand.id ? { ...s, ...updates } as TrelicaSpoolStand : s));
            showToast(`${stand.role_name} esvaziado com sucesso.`, 'info');
        } catch (err) {
            console.error('Erro ao esvaziar porta-rolo:', err);
        }
    };

    // Estatísticas de Prontidão dos 5 Rolos
    const readyCount = stands.filter(s => s.current_lot_id && s.status === 'active').length;
    const isAllReady = readyCount === 5;

    // Se for modo compacto (para Quadro PCP ou cards pequenos)
    if (isCompact) {
        return (
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10" title="Status dos 5 Porta-Rolos da Treliça">
                <span className="text-[9px] font-black text-slate-400 font-mono mr-1">ROLOS:</span>
                {stands.map(s => {
                    const isFilled = !!s.current_lot_id;
                    const isSup = s.role_type === 'superior';
                    const isSen = s.role_type.startsWith('senozoide');
                    const color = !isFilled 
                        ? 'bg-rose-500/80 border-rose-400' 
                        : isSup 
                            ? 'bg-blue-500 border-blue-400' 
                            : isSen 
                                ? 'bg-purple-500 border-purple-400' 
                                : 'bg-emerald-500 border-emerald-400';

                    return (
                        <div 
                            key={s.id}
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[7.5px] font-black text-white ${color}`}
                            title={`${s.role_name}: ${s.current_lot_number ? `Lote #${s.current_lot_number} (${s.current_gauge || ''}mm)` : 'Vazio'}`}
                        >
                            {s.stand_index}
                        </div>
                    );
                })}
                <span className={`text-[9.5px] font-black ml-1.5 font-mono ${isAllReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {readyCount}/5
                </span>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-3 bg-[#08121A] p-3 sm:p-4 rounded-2xl border border-white/10 shadow-2xl relative select-none">
            {/* Notificação Toast */}
            {notification && (
                <div className={`absolute top-2 right-4 z-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                    notification.type === 'success' ? 'bg-emerald-500 text-white' : notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                    {notification.type === 'success' ? '✓' : '⚠️'} {notification.msg}
                </div>
            )}

            {/* Cabeçalho do Rack com Status Geral */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                        <CogIcon className="w-5 h-5 animate-spin-slow" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-1.5">
                                PORTA-ROLOS DA MÁQUINA
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {machineName}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Esquema operacional dos 5 desbobinadores (1 Superior • 2 Senozoides • 2 Inferiores)
                        </p>
                    </div>
                </div>

                {/* Badge de Prontidão da Máquina */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className={`px-3 py-1 rounded-xl border flex items-center gap-2 text-xs font-black shadow-md ${
                        isAllReady 
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isAllReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                        <span>{readyCount}/5 ROLOS ABASTECIDOS</span>
                    </div>
                </div>
            </div>

            {/* Representação Gráfica Visual dos 5 Porta-Rolos (Inspirado no CAD 3D) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {stands.map((stand) => {
                    const isFilled = !!stand.current_lot_id;
                    const isSup = stand.role_type === 'superior';
                    const isSen = stand.role_type.startsWith('senozoide');
                    const isInf = stand.role_type.startsWith('inferior');

                    const targetGauge = getTargetGaugeForRole(stand.role_type);
                    const isGaugeMismatch = isFilled && targetGauge && stand.current_gauge && (
                        parseFloat(stand.current_gauge.replace(',', '.')).toFixed(2) !== parseFloat(targetGauge.replace(',', '.')).toFixed(2)
                    );

                    // Porcentagem restante da bobina
                    const initialKg = Number(stand.initial_weight) || 1000;
                    const remainKg = Number(stand.remaining_weight) || initialKg;
                    const pct = initialKg > 0 ? Math.min(100, Math.max(0, Math.round((remainKg / initialKg) * 100))) : 100;
                    const isLowSpool = isFilled && pct <= 15;

                    // Esquema de cores por função
                    const theme = isSup 
                        ? { ring: 'border-blue-500/40', bg: 'from-blue-900/25 to-[#0B1A28]', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', wireColor: '#60A5FA' }
                        : isSen 
                            ? { ring: 'border-purple-500/40', bg: 'from-purple-900/25 to-[#0B1A28]', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', wireColor: '#C084FC' }
                            : { ring: 'border-emerald-500/40', bg: 'from-emerald-900/25 to-[#0B1A28]', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', wireColor: '#34D399' };

                    return (
                        <div 
                            key={stand.id}
                            className={`flex flex-col justify-between bg-gradient-to-b ${theme.bg} rounded-2xl border ${
                                isGaugeMismatch 
                                    ? 'border-rose-500 ring-2 ring-rose-500/30' 
                                    : isLowSpool 
                                        ? 'border-amber-500 ring-2 ring-amber-500/30 animate-pulse' 
                                        : isFilled 
                                            ? theme.ring 
                                            : 'border-white/10 opacity-90'
                            } p-3.5 transition-all duration-300 hover:shadow-xl hover:border-white/30 relative overflow-hidden group`}
                        >
                            {/* Topo do Card: Número do Stand e Função */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border font-mono ${theme.badge}`}>
                                    STAND #{stand.stand_index}
                                </span>
                                <span className="text-[10px] font-black text-slate-300 truncate max-w-[120px]">
                                    {isSup ? 'SUPERIOR' : isSen ? `SENOIDE ${stand.stand_index === 2 ? 'ESQ' : 'DIR'}` : `INFERIOR ${stand.stand_index === 4 ? 'ESQ' : 'DIR'}`}
                                </span>
                            </div>

                            {/* Ilustração Técnica do Carretel de Arame (Bobina CAD) */}
                            <div className="my-2 flex flex-col items-center justify-center relative py-1">
                                <div className="w-24 h-24 relative flex items-center justify-center">
                                    {/* Anel Externo do Carretel (Flange Superior do Stand) */}
                                    <div className={`absolute inset-0 rounded-full border-4 border-slate-700 bg-slate-900/90 flex items-center justify-center shadow-2xl ${
                                        isFilled ? 'shadow-[0_0_20px_rgba(0,0,0,0.8)]' : ''
                                    }`}>
                                        {/* Espirais do Rolo de Fio de Aço (Bobina de Arame) */}
                                        {isFilled ? (
                                            <div 
                                                className="w-20 h-20 rounded-full border-4 border-amber-600/80 bg-gradient-to-tr from-amber-800 via-amber-600 to-amber-500 flex items-center justify-center shadow-inner relative overflow-hidden"
                                                style={{
                                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
                                                }}
                                            >
                                                {/* Textura de Fios Enrolados */}
                                                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
                                                
                                                {/* Núcleo Central do Eixo do Carretel */}
                                                <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-600 flex flex-col items-center justify-center text-white z-10 shadow-lg">
                                                    <span className="text-[9px] font-black font-mono">
                                                        {stand.current_gauge ? `${stand.current_gauge}` : 'CA60'}
                                                    </span>
                                                    <span className="text-[6.5px] font-bold text-slate-400">mm</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-500">
                                                <span className="text-xl">⭕</span>
                                                <span className="text-[8px] font-bold uppercase mt-0.5">Vazio</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Braço Tensor / Guia de Saída de Fio (Esquema CAD) */}
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-amber-500/90 border border-amber-300 flex items-center justify-center text-[10px] text-black font-black shadow" title="Tensor e Guia do Arame">
                                        ⚡
                                    </div>
                                </div>

                                {/* Barra de Nível Restante da Bobina */}
                                {isFilled && (
                                    <div className="w-full mt-3 flex flex-col gap-1">
                                        <div className="flex justify-between text-[9px] font-mono">
                                            <span className="text-slate-400">Nível do Rolo</span>
                                            <span className={`font-bold ${pct <= 15 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                                                {pct}% (~{remainKg.toFixed(0)}kg)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    pct <= 15 ? 'bg-rose-500' : pct <= 35 ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Informações de Lote e Bitola */}
                            <div className="bg-[#050D13] p-2.5 rounded-xl border border-white/5 my-1 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400">Lote Montado:</span>
                                    {stand.current_lot_number ? (
                                        <span className="font-black text-white font-mono bg-white/10 px-1.5 py-0.5 rounded text-[11px]">
                                            #{stand.current_lot_number}
                                        </span>
                                    ) : (
                                        <span className="text-rose-400 font-bold italic">Nenhum</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400">Bitola no Rolo:</span>
                                    {stand.current_gauge ? (
                                        <span className="font-bold text-slate-200">⌀ {stand.current_gauge} mm</span>
                                    ) : (
                                        <span className="text-slate-500">--</span>
                                    )}
                                </div>

                                {targetGauge && (
                                    <div className="flex items-center justify-between text-[9.5px] pt-1 border-t border-white/5">
                                        <span className="text-slate-400">Meta da OP:</span>
                                        <span className={`font-mono font-black ${isGaugeMismatch ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                                            ⌀ {targetGauge} mm {isGaugeMismatch ? '❌ DIVERGENTE' : '✓'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Botão de Ação: Trocar Rolo ou Descarregar */}
                            <div className="mt-2 flex items-center gap-1.5">
                                {!readOnly && (
                                    <button
                                        onClick={() => setSelectedStandForChange(stand)}
                                        className={`flex-1 py-2 px-2 rounded-xl font-black text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 ${
                                            isFilled 
                                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:text-white' 
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                                        }`}
                                    >
                                        <span>🔄</span>
                                        <span>{isFilled ? 'Trocar Rolo' : 'Carregar Bobina'}</span>
                                    </button>
                                )}

                                {isFilled && !readOnly && (
                                    <button
                                        onClick={(e) => handleUnloadSpool(stand, e)}
                                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition text-xs font-bold"
                                        title="Descarregar bobina / esvaziar stand"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL BOTTOM-SHEET PARA SELEÇÃO / TROCA DE ROLO */}
            {selectedStandForChange && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
                    onClick={() => setSelectedStandForChange(null)}
                >
                    <div 
                        className="bg-[#0B1A24] border border-white/15 w-full max-w-xl rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Topo do Modal */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🔄</span>
                                <div>
                                    <h4 className="text-sm sm:text-base font-black text-white">
                                        Troca de Rolo: {selectedStandForChange.role_name}
                                    </h4>
                                    <p className="text-[11px] text-slate-400">
                                        Selecione a bobina de CA-60 no estoque para colocar no Stand #{selectedStandForChange.stand_index}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStandForChange(null)}
                                className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Alerta de Bitola Exigida */}
                        {(() => {
                            const target = getTargetGaugeForRole(selectedStandForChange.role_type);
                            const designated = getDesignatedLotIdsForRole(selectedStandForChange.role_type);
                            return (
                                <div className="bg-[#07131B] p-3 rounded-xl border border-blue-500/30 flex flex-col gap-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-400 text-lg">🎯</span>
                                            <div>
                                                <div className="font-bold text-white">
                                                    Bitola Exata Requerida para este Rolo:
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    {effectiveOrder 
                                                        ? `OP #${effectiveOrder.orderNumber || ''} • Modelo: ${effectiveOrder.trelicaModel || 'Treliça'}` 
                                                        : 'Configuração Padrão da Máquina'}
                                                </div>
                                            </div>
                                        </div>
                                        {target && (
                                            <span className="text-sm font-black text-emerald-400 font-mono bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-500/30 shadow-sm">
                                                ⌀ {target} mm
                                            </span>
                                        )}
                                    </div>

                                    {designated.length > 0 && (
                                        <div className="bg-blue-950/40 border border-blue-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] text-blue-200">
                                            <span className="flex items-center gap-1.5 font-bold">
                                                <span>🔒</span>
                                                <span>Lotes selecionados na Ordem de Produção:</span>
                                            </span>
                                            <span className="font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                                                {designated.length} lote(s) na ordem
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Barra de Busca de Lotes */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[#07131B] border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                                <span className="text-slate-400 text-xs">🔍</span>
                                <input
                                    type="text"
                                    value={lotSearchTerm}
                                    onChange={(e) => setLotSearchTerm(e.target.value)}
                                    placeholder="Buscar por lote interno ou NFe..."
                                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                                />
                            </div>
                            {(() => {
                                const target = getTargetGaugeForRole(selectedStandForChange.role_type);
                                return (
                                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#07131B] rounded-xl border border-emerald-500/20 text-emerald-400 text-[11px] font-black font-mono whitespace-nowrap">
                                        <span>🔒</span>
                                        <span>Bitola ⌀ {target} mm</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Lista de Bobinas Disponíveis */}
                        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                            {availableCa60Lots.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 bg-[#07131B] rounded-xl border border-dashed border-white/10 p-4">
                                    <p className="font-bold text-sm text-slate-300">Nenhum lote compatível encontrado.</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {(() => {
                                            const target = getTargetGaugeForRole(selectedStandForChange.role_type);
                                            const designated = getDesignatedLotIdsForRole(selectedStandForChange.role_type);
                                            if (designated.length > 0) {
                                                return `Não há saldo disponível dentre os lotes selecionados na OP com bitola exata de ⌀ ${target} mm.`;
                                            }
                                            return `Não há lotes de CA-60 disponíveis no estoque com a bitola exata de ⌀ ${target} mm.`;
                                        })()}
                                    </p>
                                </div>
                            ) : (
                                availableCa60Lots.map((lot) => {
                                    const isSuporte = lot.status === 'Disponível - Suporte Treliça';
                                    const target = getTargetGaugeForRole(selectedStandForChange.role_type);
                                    const isGaugeMatch = target && parseFloat(String(lot.bitola || '0').replace(',', '.')).toFixed(2) === parseFloat(target.replace(',', '.')).toFixed(2);
                                    const designated = getDesignatedLotIdsForRole(selectedStandForChange.role_type);
                                    const designatedIndex = designated.indexOf(String(lot.id));
                                    const isDesignated = designatedIndex !== -1;

                                    return (
                                        <div
                                            key={lot.id}
                                            onClick={() => !isSaving && handleConfirmSpoolChange(lot)}
                                            className="bg-[#07131B] hover:bg-[#0E2230] p-3 rounded-xl border border-white/10 hover:border-blue-500/50 transition cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xs font-mono">
                                                    ⌀{lot.bitola}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-white text-sm font-mono">
                                                            LOTE #{lot.internalLot}
                                                        </span>
                                                        {isDesignated && (
                                                            <span className="text-[9px] font-black bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">
                                                                #{designatedIndex + 1} na OP
                                                            </span>
                                                        )}
                                                        {isSuporte && (
                                                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                                No Suporte
                                                            </span>
                                                        )}
                                                        {isGaugeMatch && (
                                                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                                ✓ Bitola Exata
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                        <span>Aço {lot.steelType || 'CA-60'}</span>
                                                        <span>•</span>
                                                        <span>NFe {lot.nfe || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-emerald-400 font-mono">
                                                        {Number(lot.remainingQuantity || lot.initialQuantity || 0).toLocaleString('pt-BR')} kg
                                                    </div>
                                                    <div className="text-[9.5px] text-slate-400">Disponível</div>
                                                </div>

                                                <button
                                                    disabled={isSaving}
                                                    className="bg-blue-600 group-hover:bg-blue-500 text-white font-black text-xs px-3 py-2 rounded-xl transition shadow"
                                                >
                                                    {isSaving ? '...' : 'Instalar'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrelicaSpoolStands;
