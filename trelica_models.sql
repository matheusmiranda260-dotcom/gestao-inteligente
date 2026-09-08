-- Create the trelica_models table
CREATE TABLE IF NOT EXISTS public.trelica_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cod TEXT NOT NULL UNIQUE,
    modelo TEXT NOT NULL,
    tamanho TEXT NOT NULL,
    superior TEXT NOT NULL,
    inferior TEXT NOT NULL,
    senozoide TEXT NOT NULL,
    peso_final TEXT NOT NULL,
    peso_superior TEXT NOT NULL,
    peso_senozoide TEXT NOT NULL,
    peso_inferior TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.trelica_models ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to trelica_models" ON public.trelica_models FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to trelica_models" ON public.trelica_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to trelica_models" ON public.trelica_models FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to trelica_models" ON public.trelica_models FOR DELETE USING (true);

-- Insert initial default models
INSERT INTO public.trelica_models (cod, modelo, tamanho, superior, inferior, senozoide, peso_final, peso_superior, peso_senozoide, peso_inferior) VALUES
('H6LE12S', 'H-6 LEVE (ESPAÇADOR)', '12', '5,4', '3,2', '3,2', '5,502', '2,158', '1,828', '1,517'),
('H6_12', 'H-6', '12', '5,6', '3,8', '3,2', '6,288', '2,322', '1,828', '2,138'),
('H8L6', 'H-8 LEVE', '6', '5,6', '3,2', '3,2', '2,898', '1,161', '0,979', '0,758'),
('H8L12', 'H-8 LEVE', '12', '5,6', '3,2', '3,2', '5,797', '2,322', '1,958', '1,517'),
('H8M6', 'H-8 MÉDIA', '6', '5,6', '3,8', '3,2', '3,209', '1,161', '0,979', '1,069'),
('H8M12', 'H-8 MÉDIA', '12', '5,6', '3,8', '3,2', '6,418', '2,322', '1,958', '2,138'),
('H8P6', 'H-8 PESADA', '6', '6', '3,8', '4,2', '4,087', '1,333', '1,685', '1,069'),
('H8P12', 'H-8 PESADA', '12', '6', '3,8', '4,2', '8,174', '2,665', '3,371', '2,138'),
('H8SP6', 'H-8 SUPER PESADO', '6', '6', '4,2', '4,2', '4,324', '1,333', '1,686', '1,305'),
('H8SP12', 'H-8 SUPER PESADO', '12', '6', '4,2', '4,2', '8,647', '2,665', '3,371', '2,611'),
('H10L6', 'H-10 LEVE', '6', '5,8', '3,8', '3,8', '3,843', '1,246', '1,528', '1,069'),
('H10L12', 'H-10 LEVE', '12', '5,8', '3,8', '3,8', '7,686', '2,491', '3,057', '2,138'),
('H10P12', 'H-10 PESADA', '12', '6', '4,2', '4,2', '9,057', '2,665', '3,780', '2,611'),
('H12L6', 'H-12 LEVE', '6', '5,8', '3,8', '3,2', '3,522', '1,246', '1,207', '1,069'),
('H12L12', 'H-12 LEVE', '12', '5,8', '3,8', '3,2', '7,044', '2,491', '2,414', '2,138'),
('H12P6', 'H-12 PESADA', '6', '6', '5', '4,2', '5,270', '1,333', '2,086', '1,852'),
('H12P12', 'H-12 PESADA', '12', '6', '5', '4,2', '10,540', '2,665', '4,172', '3,703'),
('H16_12', 'H-16', '12', '6', '5', '4,2', '11,263', '2,665', '4,894', '3,703'),
('H25_12', 'H-25', '12', '8', '6', '5', '20,042', '4,739', '9,973', '5,330')
ON CONFLICT (cod) DO NOTHING;
