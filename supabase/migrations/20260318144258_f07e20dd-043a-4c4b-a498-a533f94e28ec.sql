
create table if not exists public.material_desc_labor_patterns (
  id uuid primary key default gen_random_uuid(),
  material_description_pattern text not null,
  labor_code text not null,
  usage_count integer not null default 1,
  confidence_score numeric(3,2) default 0.50,
  last_used_at timestamptz not null default now(),
  unique (material_description_pattern, labor_code)
);

alter table public.material_desc_labor_patterns enable row level security;

create policy "Authenticated users can read patterns"
  on public.material_desc_labor_patterns for select
  to authenticated
  using (true);

create policy "Authenticated users can insert patterns"
  on public.material_desc_labor_patterns for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update patterns"
  on public.material_desc_labor_patterns for update
  to authenticated
  using (true);
