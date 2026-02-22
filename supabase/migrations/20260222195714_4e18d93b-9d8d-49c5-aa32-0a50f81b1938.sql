
CREATE TABLE public.building_section_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  building_identifier text NOT NULL,
  section_code text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, building_identifier)
);

ALTER TABLE public.building_section_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their building section mappings"
  ON public.building_section_mappings FOR ALL
  USING (true);
