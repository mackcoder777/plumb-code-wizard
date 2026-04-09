
CREATE TABLE public.category_item_name_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  material_description text NOT NULL,
  item_name text NOT NULL,
  labor_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, category_name, material_description, item_name)
);

ALTER TABLE public.category_item_name_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage item name overrides for their projects"
ON public.category_item_name_overrides
FOR ALL
USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()))
WITH CHECK (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));
