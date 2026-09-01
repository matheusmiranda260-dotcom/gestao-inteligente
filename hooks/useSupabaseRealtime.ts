import React, { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
    StockItem, ConferenceData, ProductionOrderData, TransferRecord,
    FinishedProductItem, PontaItem, FinishedGoodsTransferRecord,
    PartsRequest, ShiftReport, ProductionRecord,
    StickyNote, Meeting, MeetingCategory, DowntimeConfig, User,
    UserAccessLog
} from '../types';
import { mapToCamelCase } from '../services/supabaseService';

interface RealtimeSetters {
    setStock: React.Dispatch<React.SetStateAction<StockItem[]>>;
    setConferences: React.Dispatch<React.SetStateAction<ConferenceData[]>>;
    setProductionOrders: React.Dispatch<React.SetStateAction<ProductionOrderData[]>>;
    setTransfers: React.Dispatch<React.SetStateAction<TransferRecord[]>>;
    setFinishedGoods: React.Dispatch<React.SetStateAction<FinishedProductItem[]>>;
    setPontasStock: React.Dispatch<React.SetStateAction<PontaItem[]>>;
    setFinishedGoodsTransfers: React.Dispatch<React.SetStateAction<FinishedGoodsTransferRecord[]>>;
    setPartsRequests: React.Dispatch<React.SetStateAction<PartsRequest[]>>;
    setShiftReports: React.Dispatch<React.SetStateAction<ShiftReport[]>>;
    setTrefilaProduction: React.Dispatch<React.SetStateAction<ProductionRecord[]>>;
    setTrelicaProduction: React.Dispatch<React.SetStateAction<ProductionRecord[]>>;

    setStickyNotes: React.Dispatch<React.SetStateAction<StickyNote[]>>;
    setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
    setMeetingCategories: React.Dispatch<React.SetStateAction<MeetingCategory[]>>;
    setDowntimeConfigs: React.Dispatch<React.SetStateAction<DowntimeConfig[]>>;
    setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
    setAccessLogs?: React.Dispatch<React.SetStateAction<UserAccessLog[]>>;
}

/**
 * Hook que gerencia todas as subscriptions do Supabase Realtime
 * Os dados são atualizados automaticamente quando há mudanças no banco de dados
 */
export function useAllRealtimeSubscriptions(setters: RealtimeSetters, enabled: boolean) {
    const channelsRef = useRef<RealtimeChannel[]>([]);

    useEffect(() => {
        if (!enabled) {
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
            return;
        }

        console.log('[Realtime] Iniciando subscriptions...');
        const mainChannel = supabase.channel(`db-changes-${Date.now()}`);

        const createSubscription = <T extends object>(
            tableName: string,
            setter: React.Dispatch<React.SetStateAction<T[]>>,
            options?: {
                idField?: string;
                onInsert?: (item: T, prev: T[]) => T[];
                onUpdate?: (item: T, prev: T[]) => T[];
                onDelete?: (item: T, prev: T[]) => T[];
            }
        ) => {
            mainChannel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                },
                (payload) => {
                    console.log(`[Realtime] ${tableName} - ${payload.eventType}:`, payload);
                    const idField = options?.idField || 'id';

                    switch (payload.eventType) {
                        case 'INSERT':
                            if (payload.new) {
                                const newItem = mapToCamelCase(payload.new) as T;
                                setter(prev => {
                                    if (prev.some((item: any) => item[idField] === (newItem as any)[idField])) {
                                        return prev;
                                    }
                                    return options?.onInsert
                                        ? options.onInsert(newItem, prev)
                                        : [...prev, newItem];
                                });
                            }
                            break;
                        case 'UPDATE':
                            if (payload.new) {
                                const updatedItem = mapToCamelCase(payload.new) as T;
                                setter(prev =>
                                    options?.onUpdate
                                        ? options.onUpdate(updatedItem, prev)
                                        : prev.map(item =>
                                            (item as any)[idField] === (updatedItem as any)[idField]
                                                ? { ...item, ...updatedItem }
                                                : item
                                        )
                                );
                            }
                            break;
                        case 'DELETE':
                            if (payload.old) {
                                const deletedItem = mapToCamelCase(payload.old) as T;
                                setter(prev =>
                                    options?.onDelete
                                        ? options.onDelete(deletedItem, prev)
                                        : prev.filter(item =>
                                            (item as any)[idField] !== (deletedItem as any)[idField]
                                        )
                                );
                            }
                            break;
                    }
                }
            );
        };

        // Stock Items
        createSubscription<StockItem>('stock_items', setters.setStock);
        // Production Orders
        createSubscription<ProductionOrderData>('production_orders', setters.setProductionOrders);
        // Conferences
        createSubscription<ConferenceData>('conferences', setters.setConferences, { idField: 'conferenceNumber' });
        // Finished Goods
        createSubscription<FinishedProductItem>('finished_goods', setters.setFinishedGoods, {
            onInsert: (item, prev) => [...prev, item].sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())
        });
        // Pontas Stock
        createSubscription<PontaItem>('pontas_stock', setters.setPontasStock, {
            onInsert: (item, prev) => [...prev, item].sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())
        });
        // Transfers
        createSubscription<TransferRecord>('transfers', setters.setTransfers);
        // Parts Requests
        createSubscription<PartsRequest>('parts_requests', setters.setPartsRequests);
        // Shift Reports
        createSubscription<ShiftReport>('shift_reports', setters.setShiftReports);
        // Finished Goods Transfers
        createSubscription<FinishedGoodsTransferRecord>('finished_goods_transfers', setters.setFinishedGoodsTransfers);
        // Sticky Notes
        createSubscription<StickyNote>('sticky_notes', setters.setStickyNotes);
        // Meetings
        createSubscription<Meeting>('meetings', setters.setMeetings, {
            onInsert: (item, prev) => [item, ...prev].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
        });
        // Meeting Categories
        createSubscription<MeetingCategory>('meeting_categories', setters.setMeetingCategories);
        // Downtime Configs
        createSubscription<DowntimeConfig>('downtime_configs', setters.setDowntimeConfigs);
        
        if (setters.setUsers) {
            createSubscription<User>('app_users', setters.setUsers);
        }
        if (setters.setAccessLogs) {
            createSubscription<UserAccessLog>('user_access_logs', setters.setAccessLogs);
        }

        // Production Records (Trefila e Treliça)
        mainChannel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'production_records',
            },
            (payload) => {
                console.log(`[Realtime] production_records - ${payload.eventType}:`, payload);
                const record = mapToCamelCase(payload.eventType === 'DELETE' ? payload.old : payload.new) as ProductionRecord;

                if (record.machine === 'Trefila' || record.machine.startsWith('Desbobinadeira')) {
                    switch (payload.eventType) {
                        case 'INSERT': setters.setTrefilaProduction(prev => [...prev, record]); break;
                        case 'UPDATE': setters.setTrefilaProduction(prev => prev.map(r => r.id === record.id ? record : r)); break;
                        case 'DELETE': setters.setTrefilaProduction(prev => prev.filter(r => r.id !== record.id)); break;
                    }
                } else {
                    switch (payload.eventType) {
                        case 'INSERT': setters.setTrelicaProduction(prev => [...prev, record]); break;
                        case 'UPDATE': setters.setTrelicaProduction(prev => prev.map(r => r.id === record.id ? record : r)); break;
                        case 'DELETE': setters.setTrelicaProduction(prev => prev.filter(r => r.id !== record.id)); break;
                    }
                }
            }
        );

        mainChannel.subscribe((status, err) => {
            console.log(`[Realtime] Main Channel status:`, status);
            if (status === 'SUBSCRIBED') {
                console.log(`[Realtime] ✅ Conectado com sucesso (Multiplexed)`);
            }
            if (status === 'CHANNEL_ERROR') {
                console.error(`[Realtime] ❌ Erro ao conectar:`, err);
            }
            if (status === 'TIMED_OUT') {
                console.warn(`[Realtime] ⚠️ Tempo limite esgotado`);
            }
        });

        channelsRef.current = [mainChannel];

        console.log(`[Realtime] Subscriptions ativas no canal principal`);

        // Cleanup
        return () => {
            console.log('[Realtime] Removendo subscriptions...');
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
        };
    }, [enabled, setters]);
}

export default useAllRealtimeSubscriptions;
