CREATE TABLE cost_head_activity_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES estimate_projects(id) ON DELETE CASCADE NOT NULL,
  cost_head text NOT NULL,
  use_level_activity boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, cost_head)
);

ALTER TABLE cost_head_activity_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project overrides"
  ON cost_head_activity_overrides
  FOR ALL
  TO authenticated
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