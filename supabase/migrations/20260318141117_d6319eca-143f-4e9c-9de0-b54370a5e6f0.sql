
drop table if exists category_keyword_rules;

create table if not exists category_material_desc_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references estimate_projects(id) on delete cascade,
  category_name text not null,
  material_description text not null,
  labor_code text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, category_name, material_description)
);

alter table category_material_desc_overrides enable row level security;

create policy "Users can manage material desc overrides for their projects"
  on category_material_desc_overrides for all
  using (project_id in (select id from estimate_projects where user_id = auth.uid()))
  with check (project_id in (select id from estimate_projects where user_id = auth.uid()));
