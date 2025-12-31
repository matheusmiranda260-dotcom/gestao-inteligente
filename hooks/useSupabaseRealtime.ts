import React, { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
    StockItem, ConferenceData, ProductionOrderData, TransferRecord,
    FinishedProductItem, PontaItem, FinishedGoodsTransferRecord,
    PartsRequest, ShiftReport, ProductionRecord, Message
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
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * Hook que gerencia todas as subscriptions do Supabase Realtime
 * Os dados são atualizados automaticamente quando há mudanças no banco de dados
 */
export function useAllRealtimeSubscriptions(setters: RealtimeSetters, enabled: boolean) {
    const channelsRef = useRef<RealtimeChannel[]>([]);

    useEffect(() => {
        if (!enabled) {
            // Limpar todas as subscriptions
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
            return;
        }

        console.log('[Realtime] Iniciando subscriptions...');
        const channels: RealtimeChannel[] = [];

        // Helper function para criar subscriptions

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
            const channel = supabase
                .channel(`realtime-${tableName}-${Date.now()}`)
                .on(
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
                                    setter(prev =>
                                        options?.onInsert
                                            ? options.onInsert(newItem, prev)
                                            : [...prev, newItem]
                                    );
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
                                                    ? updatedItem
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
                )
                .subscribe((status, err) => {
                    console.log(`[Realtime] ${tableName} status:`, status);
                    if (status === 'SUBSCRIBED') {
                        console.log(`[Realtime] ✅ Conectado com sucesso a ${tableName}`);
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error(`[Realtime] ❌ Erro ao conectar em ${tableName}:`, err);
                    }
                    if (status === 'TIMED_OUT') {
                        console.warn(`[Realtime] ⚠️ Tempo limite esgotado para ${tableName}`);
                    }
                });

            channels.push(channel);
        };

        // Stock Items
        createSubscription<StockItem>('stock_items', setters.setStock);

        // Production Orders
        createSubscription<ProductionOrderData>('production_orders', setters.setProductionOrders);

        // Conferences
        createSubscription<ConferenceData>('conferences', setters.setConferences, {
            idField: 'conferenceNumber'
        });

        // Finished Goods
        createSubscription<FinishedProductItem>('finished_goods', setters.setFinishedGoods, {
            onInsert: (item, prev) => [...prev, item].sort((a, b) =>
                new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()
            )
        });

        // Pontas Stock
        createSubscription<PontaItem>('pontas_stock', setters.setPontasStock, {
            onInsert: (item, prev) => [...prev, item].sort((a, b) =>
                new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()
            )
        });

        // Messages
        createSubscription<Message>('messages', setters.setMessages);

        // Transfers
        createSubscription<TransferRecord>('transfers', setters.setTransfers);

        // Parts Requests
        createSubscription<PartsRequest>('parts_requests', setters.setPartsRequests);

        // Shift Reports
        createSubscription<ShiftReport>('shift_reports', setters.setShiftReports);

        // Finished Goods Transfers
        createSubscription<FinishedGoodsTransferRecord>('finished_goods_transfers', setters.setFinishedGoodsTransfers);

        // Production Records (Trefila e Treliça)
        const productionRecordsChannel = supabase
            .channel(`realtime-production_records-${Date.now()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'production_records',
                },
                (payload) => {
                    console.log(`[Realtime] production_records - ${payload.eventType}:`, payload);
                    const record = mapToCamelCase(payload.eventType === 'DELETE' ? payload.old : payload.new) as ProductionRecord;

                    if (record.machine === 'Trefila') {
                        switch (payload.eventType) {
                            case 'INSERT':
                                setters.setTrefilaProduction(prev => [...prev, record]);
                                break;
                            case 'UPDATE':
                                setters.setTrefilaProduction(prev => prev.map(r => r.id === record.id ? record : r));
                                break;
                            case 'DELETE':
                                setters.setTrefilaProduction(prev => prev.filter(r => r.id !== record.id));
                                break;
                        }
                    } else {
                        switch (payload.eventType) {
                            case 'INSERT':
                                setters.setTrelicaProduction(prev => [...prev, record]);
                                break;
                            case 'UPDATE':
                                setters.setTrelicaProduction(prev => prev.map(r => r.id === record.id ? record : r));
                                break;
                            case 'DELETE':
                                setters.setTrelicaProduction(prev => prev.filter(r => r.id !== record.id));
                                break;
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] production_records status:`, status);
            });

        channels.push(productionRecordsChannel);
        channelsRef.current = channels;

        console.log(`[Realtime] ${channels.length} subscriptions ativas`);

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
