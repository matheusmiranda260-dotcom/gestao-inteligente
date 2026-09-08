import { supabase } from '../supabaseClient';
export { supabase };
import {
    StockItem,
    ConferenceData,
    ProductionOrderData,
    TransferRecord,
    FinishedProductItem,
    PontaItem,
    FinishedGoodsTransferRecord,
    PartsRequest,
    ShiftReport,
    ProductionRecord,
    User,
} from '../types';

/** Generic fetch function returning raw data */
export const fetchData = async <T>(table: string): Promise<T[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + limit - 1);
            
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return [];
        }
        
        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            hasMore = data.length === limit;
        } else {
            hasMore = false;
        }
    }
    return allData as T[];
};

/** Generic insert function returning the inserted row */
export const insertData = async <T>(table: string, item: T): Promise<T | null> => {
    const { data, error } = await supabase.from(table).insert(item).select().single();
    if (error) {
        console.error(`Error inserting into ${table}:`, error);
        return null;
    }
    return data as T;
};

/** Generic update function */
export const updateData = async <T>(table: string, id: string, updates: Partial<T>): Promise<T | null> => {
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
    if (error) {
        console.error(`Error updating ${table}:`, error);
        return null;
    }
    return data as T;
};

/** Generic delete function */
export const deleteData = async (table: string, id: string): Promise<boolean> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
        console.error(`Error deleting from ${table}:`, error);
        return false;
    }
    return true;
};

/** Helper to convert snake_case DB fields to camelCase JS */
export const mapToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(v => mapToCamelCase(v));
    if (obj && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
            acc[camelKey] = mapToCamelCase(obj[key]);
            return acc;
        }, {} as any);
    }
    return obj;
};

/** Helper to convert camelCase JS fields to snake_case DB */
const mapToSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(v => mapToSnakeCase(v));
    if (obj && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            acc[snakeKey] = mapToSnakeCase(obj[key]);
            return acc;
        }, {} as any);
    }
    return obj;
};

/** Fetch table with camelCase conversion */
export const fetchTable = async <T>(table: string): Promise<T[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + limit - 1);
            
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            throw error;
        }
        
        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            hasMore = data.length === limit;
        } else {
            hasMore = false;
        }
    }
    return mapToCamelCase(allData) as T[];
};

/** Fetch items by column value */
export const fetchByColumn = async <T>(table: string, column: string, value: string): Promise<T[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq(column, value)
            .range(from, from + limit - 1);
            
        if (error) {
            console.error(`Error fetching ${table} by ${column}:`, error);
            throw error;
        }
        
        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            hasMore = data.length === limit;
        } else {
            hasMore = false;
        }
    }
    return mapToCamelCase(allData) as T[];
};

const KNOWN_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
    production_orders: new Set([
        'id',
        'order_number',
        'machine',
        'target_bitola',
        'trelica_model',
        'tamanho',
        'quantity_to_produce',
        'selected_lot_ids',
        'total_weight',
        'planned_output_weight',
        'status',
        'creation_date',
        'start_time',
        'end_time',
        'downtime_events',
        'processed_lots',
        'actual_produced_weight',
        'operator_logs',
        'active_lot_processing',
        'actual_produced_quantity',
        'scrap_weight',
        'weighed_packages',
        'pontas',
        'updated_at',
        'lastquantityupdate',
        'last_quantity_update',
        'is_ghost_order',
        'input_bitola',
        'os_items',
        'summary',
        'os_progress',
        'scheduled_machine',
        'planned_start_date',
        'planned_end_date',
        'estimated_duration_days',
        'malha_model',
        'malha_pieces'
    ])
};

const sanitizeForTable = (table: string, snakeObj: Record<string, any>) => {
    const validCols = KNOWN_COLUMNS_BY_TABLE[table];
    if (!validCols) return { payload: snakeObj, extra: {} };

    const payload: Record<string, any> = {};
    const extra: Record<string, any> = {};

    for (const [key, value] of Object.entries(snakeObj)) {
        if (validCols.has(key)) {
            payload[key] = value;
        } else {
            extra[key] = value;
        }
    }

    if (Object.keys(extra).length > 0 && validCols.has('summary')) {
        const currentSummary = typeof payload.summary === 'object' && payload.summary !== null ? payload.summary : {};
        payload.summary = { ...currentSummary, ...extra };
    }

    return { payload, extra };
};

/** Insert item with automatic UUID generation for missing id */
export const insertItem = async <T extends { id?: string }>(
    table: string,
    item: Partial<T>
): Promise<T> => {
    // Ensure an id exists – the DB column is NOT NULL.
    if (!item.id || item.id === '') {
        let generatedId = '';
        if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
            generatedId = (crypto as any).randomUUID();
        } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            // Browser compliant UUID v4 generator
            generatedId = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: any) =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        } else {
            // Pure JS fallback
            generatedId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        // @ts-ignore – we know T has an optional id field.
        (item as any).id = generatedId;
    }
    const snakeItem = mapToSnakeCase(item);
    const { payload } = sanitizeForTable(table, snakeItem);
    console.log(`Inserting into ${table}:`, payload);
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) {
        console.error(`Error inserting into ${table}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        console.error('Data attempted to insert:', payload);
        throw error;
    }
    const camelResult = mapToCamelCase(data) as any;
    return { ...item, ...camelResult } as T;
};

/** Update item with mapping */
export const updateItem = async <T>(table: string, id: string, updates: Partial<T>): Promise<T> => {
    const snakeUpdates = mapToSnakeCase(updates);
    const { payload } = sanitizeForTable(table, snakeUpdates);
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
    if (error) {
        console.error(`Error updating ${table}:`, error);
        throw error;
    }
    const camelResult = mapToCamelCase(data) as any;
    return { ...updates, ...camelResult } as T;
};

/** Upsert item (Insert or Update if exists) */
export const upsertItem = async <T>(table: string, item: T, onConflict: string = 'id'): Promise<T> => {
    const snakeItem = mapToSnakeCase(item);
    const { payload } = sanitizeForTable(table, snakeItem);
    const { data, error } = await supabase.from(table).upsert(payload, { onConflict }).select().single();
    if (error) {
        console.error(`Error upserting into ${table}:`, error);
        throw error;
    }
    const camelResult = mapToCamelCase(data) as any;
    return { ...item, ...camelResult } as T;
};

/** Delete item by id */
export const deleteItem = async (table: string, id: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
        console.error(`Error deleting from ${table}:`, error);
        throw error;
    }
};

/** Delete by arbitrary column */
export const deleteItemByColumn = async (table: string, column: string, value: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) {
        console.error(`Error deleting from ${table} by ${column}:`, error);
        throw error;
    }
};

/** Update by arbitrary column */
export const updateItemByColumn = async <T>(
    table: string,
    column: string,
    value: string,
    updates: Partial<T>
): Promise<T> => {
    const snakeUpdates = mapToSnakeCase(updates);
    const { data, error } = await supabase.from(table)
        .update(snakeUpdates)
        .eq(column, value)
        .select()
        .single();
    if (error) {
        console.error(`Error updating ${table} by ${column}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T;
};

/** Upload file to storage */
export const uploadFile = async (bucket: string, path: string, file: File): Promise<string | null> => {
    // Generate unique path if needed, or overwrite?
    // User might upload "image.jpg" twice. Better to prepend timestamp/uuid.
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
};
