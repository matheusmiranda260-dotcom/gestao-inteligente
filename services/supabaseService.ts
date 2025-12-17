import { supabase } from '../supabaseClient';
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
    Message,
    User,
} from '../types';

/** Generic fetch function returning raw data */
export const fetchData = async <T>(table: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        console.error(`Error fetching ${table}:`, error);
        return [];
    }
    return data as T[];
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
const mapToCamelCase = (obj: any): any => {
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
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        console.error(`Error fetching ${table}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T[];
};

/** Fetch items by column value */
export const fetchByColumn = async <T>(table: string, column: string, value: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*').eq(column, value);
    if (error) {
        console.error(`Error fetching ${table} by ${column}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T[];
};

/** Insert item with automatic UUID generation for missing id */
export const insertItem = async <T extends { id?: string }>(
    table: string,
    item: T
): Promise<T> => {
    // Ensure an id exists – the DB column is NOT NULL.
    if (!item.id) {
        const generatedId =
            typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
                ? (crypto as any).randomUUID()
                : Math.random().toString(36).substring(2, 15);
        // @ts-ignore – we know T has an optional id field.
        item.id = generatedId;
    }
    const snakeItem = mapToSnakeCase(item);
    console.log(`Inserting into ${table}:`, snakeItem);
    const { data, error } = await supabase.from(table).insert(snakeItem).select().single();
    if (error) {
        console.error(`Error inserting into ${table}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        console.error('Data attempted to insert:', snakeItem);
        throw error;
    }
    return mapToCamelCase(data) as T;
};

/** Update item with mapping */
export const updateItem = async <T>(table: string, id: string, updates: Partial<T>): Promise<T> => {
    const snakeUpdates = mapToSnakeCase(updates);
    const { data, error } = await supabase.from(table).update(snakeUpdates).eq('id', id).select().single();
    if (error) {
        console.error(`Error updating ${table}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T;
};

/** Upsert item (Insert or Update if exists) */
export const upsertItem = async <T>(table: string, item: T, onConflict: string = 'id'): Promise<T> => {
    const snakeItem = mapToSnakeCase(item);
    const { data, error } = await supabase.from(table).upsert(snakeItem, { onConflict }).select().single();
    if (error) {
        console.error(`Error upserting into ${table}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T;
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
