
create table if not exists public.category_item_type_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.estimate_projects(id) on delete cascade,
  category_name text not null,
  item_type text not null,
  labor_code text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, category_name, item_type)
);

alter table public.category_item_type_overrides enable row level security;

create policy "Users can view their project item type overrides"
  on public.category_item_type_overrides for select
  using (project_id in (select id from estimate_projects where user_id = auth.uid()));

create policy "Users can create item type overrides for their projects"
  on public.category_item_type_overrides for insert
  with check (project_id in (select id from estimate_projects where user_id = auth.uid()));

create policy "Users can update item type overrides for their projects"
  on public.category_item_type_overrides for update
  using (project_id in (select id from estimate_projects where user_id = auth.uid()));

create policy "Users can delete item type overrides for their projects"
  on public.category_item_type_overrides for delete
  using (project_id in (select id from estimate_projects where user_id = auth.uid()));
