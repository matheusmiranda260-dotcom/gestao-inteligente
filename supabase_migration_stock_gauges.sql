-- Create the stock_gauges table
CREATE TABLE IF NOT EXISTS public.stock_gauges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_type TEXT NOT NULL,
    gauge TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(material_type, gauge)
);

-- Enable RLS
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

-- Create policy for all actions (simple for now)
CREATE POLICY "Enable all for authenticated users" ON public.stock_gauges
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial data based on hardcoded constants in types.ts
-- Fio Máquina
INSERT INTO public.stock_gauges (material_type, gauge) VALUES 
('Fio Máquina', '8.00'),
('Fio Máquina', '7.00'),
('Fio Máquina', '6.50'),
('Fio Máquina', '6.35'),
('Fio Máquina', '5.50')
ON CONFLICT DO NOTHING;

-- CA-60 (represented as TrefilaBitolaOptions in code)
INSERT INTO public.stock_gauges (material_type, gauge) VALUES 
('CA-60', '3.40'),
('CA-60', '3.80'),
('CA-60', '4.20'),
('CA-60', '4.60'),
('CA-60', '5.00'),
('CA-60', '5.40'),
('CA-60', '6.00'),
('CA-60', '6.35'),
('CA-60', '3.20'),
('CA-60', '5.60'),
('CA-60', '5.80'),
('CA-60', '8.00')
ON CONFLICT DO NOTHING;
