import { supabase } from '../supabaseClient';
import {
    StockItem, ConferenceData, ProductionOrderData, TransferRecord,
    FinishedProductItem, PontaItem, FinishedGoodsTransferRecord,
    PartsRequest, ShiftReport, ProductionRecord, Message, User
} from '../types';

// Generic fetch function
export const fetchData = async <T>(table: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        console.error(`Error fetching ${table}:`, error);
        return [];
    }
    return data as T[];
};

// Generic insert function
export const insertData = async <T>(table: string, item: T): Promise<T | null> => {
    const { data, error } = await supabase.from(table).insert(item).select().single();
    if (error) {
        console.error(`Error inserting into ${table}:`, error);
        return null;
    }
    return data as T;
};

// Generic update function
export const updateData = async <T>(table: string, id: string, updates: Partial<T>): Promise<T | null> => {
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
    if (error) {
        console.error(`Error updating ${table}:`, error);
        return null;
    }
    return data as T;
};

// Generic delete function
export const deleteData = async (table: string, id: string): Promise<boolean> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
        console.error(`Error deleting from ${table}:`, error);
        return false;
    }
    return true;
};

// Specific mapping for snake_case DB to camelCase JS if needed. 
// For now, assuming we might need to map fields if the DB columns are snake_case and types are camelCase.
// My migration used snake_case for columns but types are camelCase. Supabase JS client usually handles this if we configure it or we map it manually.
// I will implement manual mapping to be safe since I defined snake_case columns in SQL.

const mapToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => mapToCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            result[camelKey] = mapToCamelCase(obj[key]);
            return result;
        }, {} as any);
    }
    return obj;
};

const mapToSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => mapToSnakeCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = mapToSnakeCase(obj[key]);
            return result;
        }, {} as any);
    }
    return obj;
};

// Wrapped functions with mapping

export const fetchTable = async <T>(table: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        console.error(`Error fetching ${table}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T[];
};

export const insertItem = async <T>(table: string, item: T): Promise<T> => {
    const snakeItem = mapToSnakeCase(item);
    console.log(`Inserting into ${table}:`, snakeItem);
    const { data, error } = await supabase.from(table).insert(snakeItem).select().single();
    if (error) {
        console.error(`Error inserting into ${table}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        console.error('Data attempted to insert:', snakeItem);
        throw error;
    }
    return mapToCamelCase(data) as T;
};

export const updateItem = async <T>(table: string, id: string, updates: Partial<T>): Promise<T> => {
    const snakeUpdates = mapToSnakeCase(updates);
    const { data, error } = await supabase.from(table).update(snakeUpdates).eq('id', id).select().single();
    if (error) {
        console.error(`Error updating ${table}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T;
};

export const deleteItem = async (table: string, id: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
        console.error(`Error deleting from ${table}:`, error);
        throw error;
    }
};

export const deleteItemByColumn = async (table: string, column: string, value: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) {
        console.error(`Error deleting from ${table} by ${column}:`, error);
        throw error;
    }
};

export const updateItemByColumn = async <T>(table: string, column: string, value: string, updates: Partial<T>): Promise<T> => {
    const snakeUpdates = mapToSnakeCase(updates);
    const { data, error } = await supabase.from(table).update(snakeUpdates).eq(column, value).select().single();
    if (error) {
        console.error(`Error updating ${table} by ${column}:`, error);
        throw error;
    }
    return mapToCamelCase(data) as T;
};
