-- New table: hour redistributions within a section.
-- Distinct from project_small_code_merges because no source code is being merged
-- away — both source and target heads still exist as their own budget lines,
-- the operation just rebalances hours between them.
CREATE TABLE public.project_hour_redistributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  sec_code TEXT NOT NULL,
  act_code TEXT NOT NULL DEFAULT '0000',
  source_head TEXT NOT NULL,
  target_head TEXT NOT NULL,
  hours_moved NUMERIC NOT NULL,
  -- Audit fields, mirroring the new columns on project_small_code_merges
  pm_email TEXT,
  operation_type TEXT NOT NULL DEFAULT 'redistribute',
  field_scope_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_hour_redistributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view redistributions for their projects"
  ON public.project_hour_redistributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_projects
      WHERE estimate_projects.id = project_hour_redistributions.project_id
        AND estimate_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert redistributions for their projects"
  ON public.project_hour_redistributions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estimate_projects
      WHERE estimate_projects.id = project_hour_redistributions.project_id
        AND estimate_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update redistributions for their projects"
  ON public.project_hour_redistributions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_projects
      WHERE estimate_projects.id = project_hour_redistributions.project_id
        AND estimate_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete redistributions for their projects"
  ON public.project_hour_redistributions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_projects
      WHERE estimate_projects.id = project_hour_redistributions.project_id
        AND estimate_projects.user_id = auth.uid()
    )
  );

CREATE INDEX idx_project_hour_redistributions_project_id
  ON public.project_hour_redistributions(project_id);

-- Extend project_small_code_merges to support cross-section reassignment.
-- When reassign_to_sec is non-null, the helper writes the target key as
-- "[reassign_to_sec] [reassign_to_act] [reassign_to_head]" instead of
-- "[sec_code] 0000 [reassign_to_head]". Drives Pool to 40 and Combine sections.
ALTER TABLE public.project_small_code_merges
  ADD COLUMN reassign_to_sec TEXT,
  ADD COLUMN reassign_to_act TEXT,
  ADD COLUMN pm_email TEXT,
  ADD COLUMN operation_type TEXT,
  ADD COLUMN field_scope_note TEXT;

-- Allow updates so Apply All can replace draft records cleanly.
-- Existing policies only cover SELECT/INSERT/DELETE.
CREATE POLICY "Users can update merges for their projects"
  ON public.project_small_code_merges
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_projects
      WHERE estimate_projects.id = project_small_code_merges.project_id
        AND estimate_projects.user_id = auth.uid()
    )
  );