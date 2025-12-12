-- Create table for Trefila Rings Stock
create table if not exists public.trefila_rings_stock (
    id uuid default gen_random_uuid() primary key,
    model text not null, -- e.g. "PR 3.20", "CA 3.55"
    quantity integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.trefila_rings_stock enable row level security;

-- Create permissive policy for now (matching other tables in this project context)
create policy "Enable all for public" on public.trefila_rings_stock for all using (true) with check (true);

-- Functions to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_trefila_rings_stock_updated_at
before update on public.trefila_rings_stock
for each row execute procedure public.handle_updated_at();
