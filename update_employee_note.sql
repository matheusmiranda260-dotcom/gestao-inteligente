ALTER TABLE public.technical_evaluations
ADD COLUMN IF NOT EXISTS employee_note TEXT;
