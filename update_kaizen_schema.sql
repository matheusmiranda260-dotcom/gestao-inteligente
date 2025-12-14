-- Add responsible_ids column to support multiple responsibles linked to employees
ALTER TABLE public.kaizen_problems ADD COLUMN IF NOT EXISTS responsible_ids TEXT[];

-- Migration: Try to fill responsible_ids based on responsible name match (Best Effort)
-- This is complex to do in SQL without a function, so we will skip auto-migration of data
-- and rely on new data being correct. Old data will have null responsible_ids.
