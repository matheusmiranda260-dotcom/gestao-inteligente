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
    PcpShiftConfig,
    PcpHoliday,
    TrelicaSpoolStand,
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
    let { payload } = sanitizeForTable(table, snakeItem);
    console.log(`Inserting into ${table}:`, payload);
    let { data, error } = await supabase.from(table).insert(payload).select().single();
    
    // Resilience fallback: if a column does not exist yet in the DB schema, strip it and retry
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        console.warn(`Column missing in ${table}, retrying without potential new columns...`, error.message);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.description;
        delete fallbackPayload.product_code;
        const retry = await supabase.from(table).insert(fallbackPayload).select().single();
        if (!retry.error) {
            data = retry.data;
            error = null;
        }
    }

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
    let { payload } = sanitizeForTable(table, snakeUpdates);
    let { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();

    // Resilience fallback: if a column does not exist yet in the DB schema, strip it and retry
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        console.warn(`Column missing in ${table}, retrying update without potential new columns...`, error.message);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.description;
        delete fallbackPayload.product_code;
        const retry = await supabase.from(table).update(fallbackPayload).eq('id', id).select().single();
        if (!retry.error) {
            data = retry.data;
            error = null;
        }
    }

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

/** Obter Configuração de Jornada do PCP */
export const fetchPcpShiftConfig = async (): Promise<PcpShiftConfig | null> => {
    try {
        const { data, error } = await supabase
            .from('pcp_shift_config')
            .select('*')
            .eq('id', 'default')
            .maybeSingle();

        if (error) {
            console.warn('Erro ao buscar pcp_shift_config:', error);
            return null;
        }
        if (!data) return null;
        return mapToCamelCase(data) as PcpShiftConfig;
    } catch (err) {
        console.warn('Exceção ao buscar pcp_shift_config:', err);
        return null;
    }
};

/** Salvar Configuração de Jornada do PCP */
export const savePcpShiftConfig = async (config: Partial<PcpShiftConfig>): Promise<PcpShiftConfig | null> => {
    try {
        const snake = mapToSnakeCase({
            id: 'default',
            workStart: config.workStart || '07:00',
            lunchStart: config.lunchStart || '12:00',
            lunchEnd: config.lunchEnd || '13:00',
            workEnd: config.workEnd || '17:00',
            workDays: config.workDays || [1, 2, 3, 4, 5],
            updatedAt: new Date().toISOString()
        });

        const { data, error } = await supabase
            .from('pcp_shift_config')
            .upsert(snake, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar pcp_shift_config:', error);
            throw error;
        }
        return mapToCamelCase(data) as PcpShiftConfig;
    } catch (err) {
        console.error('Exceção ao salvar pcp_shift_config:', err);
        throw err;
    }
};

/** Obter Feriados Cadastrados */
export const fetchPcpHolidays = async (): Promise<PcpHoliday[]> => {
    try {
        const { data, error } = await supabase
            .from('pcp_holidays')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.warn('Erro ao buscar pcp_holidays:', error);
            return [];
        }
        return (data || []).map(item => mapToCamelCase(item)) as PcpHoliday[];
    } catch (err) {
        console.warn('Exceção ao buscar pcp_holidays:', err);
        return [];
    }
};

/** Adicionar Feriado */
export const addPcpHoliday = async (holiday: { date: string; description: string }): Promise<PcpHoliday | null> => {
    try {
        const snake = {
            date: holiday.date,
            description: holiday.description.trim()
        };
        const { data, error } = await supabase
            .from('pcp_holidays')
            .insert(snake)
            .select()
            .single();

        if (error) {
            console.error('Erro ao adicionar pcp_holiday:', error);
            throw error;
        }
        return mapToCamelCase(data) as PcpHoliday;
    } catch (err) {
        console.error('Exceção ao adicionar pcp_holiday:', err);
        throw err;
    }
};

/** Excluir Feriado */
export const deletePcpHoliday = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('pcp_holidays')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao excluir pcp_holiday:', error);
            throw error;
        }
        return true;
    } catch (err) {
        console.error('Exceção ao excluir pcp_holiday:', err);
        throw err;
    }
};

/** Configuração Padrão dos 5 Porta-Rolos por Máquina (Fallback) */
export const getDefaultSpoolStands = (machineName: string = 'Treliça 1'): TrelicaSpoolStand[] => [
    {
        id: `${machineName}-stand-1`,
        machine_name: machineName,
        stand_index: 1,
        role_name: 'Banzo Superior (1x)',
        role_type: 'superior',
        current_lot_id: null,
        current_lot_number: null,
        current_gauge: null,
        initial_weight: 0,
        remaining_weight: 0,
        status: 'empty'
    },
    {
        id: `${machineName}-stand-2`,
        machine_name: machineName,
        stand_index: 2,
        role_name: 'Senoide Lado 1 (1x)',
        role_type: 'senozoide_left',
        current_lot_id: null,
        current_lot_number: null,
        current_gauge: null,
        initial_weight: 0,
        remaining_weight: 0,
        status: 'empty'
    },
    {
        id: `${machineName}-stand-3`,
        machine_name: machineName,
        stand_index: 3,
        role_name: 'Senoide Lado 2 (1x)',
        role_type: 'senozoide_right',
        current_lot_id: null,
        current_lot_number: null,
        current_gauge: null,
        initial_weight: 0,
        remaining_weight: 0,
        status: 'empty'
    },
    {
        id: `${machineName}-stand-4`,
        machine_name: machineName,
        stand_index: 4,
        role_name: 'Inferior Lado 1 (1x)',
        role_type: 'inferior_left',
        current_lot_id: null,
        current_lot_number: null,
        current_gauge: null,
        initial_weight: 0,
        remaining_weight: 0,
        status: 'empty'
    },
    {
        id: `${machineName}-stand-5`,
        machine_name: machineName,
        stand_index: 5,
        role_name: 'Inferior Lado 2 (1x)',
        role_type: 'inferior_right',
        current_lot_id: null,
        current_lot_number: null,
        current_gauge: null,
        initial_weight: 0,
        remaining_weight: 0,
        status: 'empty'
    }
];

/** Buscar Porta-Rolos das Máquinas de Treliça (com fallback de cache) */
export const fetchTrelicaSpoolStands = async (machineName?: string): Promise<TrelicaSpoolStand[]> => {
    try {
        let query = supabase.from('trelica_spool_stands').select('*').order('stand_index', { ascending: true });
        if (machineName) {
            query = query.eq('machine_name', machineName);
        }

        const { data, error } = await query;
        if (error) {
            console.warn('Tabela trelica_spool_stands ainda não criada ou inacessível:', error.message);
            // Fallback localStorage
            const localKey = machineName ? `cached_spool_stands_${machineName}` : 'cached_spool_stands_all';
            const saved = localStorage.getItem(localKey);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {}
            }
            return machineName ? getDefaultSpoolStands(machineName) : [...getDefaultSpoolStands('Treliça 1'), ...getDefaultSpoolStands('Treliça 2')];
        }

        if (data && data.length > 0) {
            const mapped = data.map(item => ({
                id: item.id,
                machine_name: item.machine_name,
                stand_index: item.stand_index,
                role_name: item.role_name,
                role_type: item.role_type,
                current_lot_id: item.current_lot_id,
                current_lot_number: item.current_lot_number,
                current_gauge: item.current_gauge,
                initial_weight: Number(item.initial_weight) || 0,
                remaining_weight: Number(item.remaining_weight) || 0,
                status: item.status || 'empty',
                last_changed_at: item.last_changed_at,
                last_changed_by: item.last_changed_by,
                updated_at: item.updated_at
            })) as TrelicaSpoolStand[];

            const localKey = machineName ? `cached_spool_stands_${machineName}` : 'cached_spool_stands_all';
            localStorage.setItem(localKey, JSON.stringify(mapped));
            return mapped;
        }

        return machineName ? getDefaultSpoolStands(machineName) : [...getDefaultSpoolStands('Treliça 1'), ...getDefaultSpoolStands('Treliça 2')];
    } catch (err) {
        console.warn('Exceção ao carregar trelica_spool_stands:', err);
        return machineName ? getDefaultSpoolStands(machineName) : [...getDefaultSpoolStands('Treliça 1'), ...getDefaultSpoolStands('Treliça 2')];
    }
};

/** Atualizar Porta-Rolo no Banco e Realtime */
export const updateTrelicaSpoolStand = async (
    id: string,
    updates: Partial<TrelicaSpoolStand>
): Promise<TrelicaSpoolStand | null> => {
    try {
        const payload: any = {
            updated_at: new Date().toISOString()
        };

        if (updates.current_lot_id !== undefined) payload.current_lot_id = updates.current_lot_id;
        if (updates.current_lot_number !== undefined) payload.current_lot_number = updates.current_lot_number;
        if (updates.current_gauge !== undefined) payload.current_gauge = updates.current_gauge;
        if (updates.initial_weight !== undefined) payload.initial_weight = updates.initial_weight;
        if (updates.remaining_weight !== undefined) payload.remaining_weight = updates.remaining_weight;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.last_changed_at !== undefined) payload.last_changed_at = updates.last_changed_at;
        if (updates.last_changed_by !== undefined) payload.last_changed_by = updates.last_changed_by;

        const { data, error } = await supabase
            .from('trelica_spool_stands')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.warn('Erro ao atualizar trelica_spool_stand:', error.message);
            return null;
        }

        return data as TrelicaSpoolStand;
    } catch (err) {
        console.error('Exceção ao atualizar trelica_spool_stand:', err);
        return null;
    }
};

