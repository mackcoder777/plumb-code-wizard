
CREATE TABLE public.project_budget_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.estimate_projects(id) ON DELETE CASCADE NOT NULL,
  settings_key text NOT NULL,
  settings_value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, settings_key)
);

ALTER TABLE public.project_budget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their project budget settings"
  ON public.project_budget_settings FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT id FROM estimate_projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM estimate_projects WHERE user_id = auth.uid()
    )
  );
