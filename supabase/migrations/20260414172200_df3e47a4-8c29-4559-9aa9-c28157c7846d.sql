ALTER TABLE public.cost_head_activity_overrides
  ADD COLUMN IF NOT EXISTS building_identifier text DEFAULT NULL;

ALTER TABLE public.cost_head_activity_overrides
  DROP CONSTRAINT IF EXISTS cost_head_activity_overrides_project_id_cost_head_key;

CREATE UNIQUE INDEX IF NOT EXISTS cost_head_activity_overrides_bldg_uniq
  ON public.cost_head_activity_overrides (project_id, building_identifier, cost_head)
  WHERE building_identifier IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cost_head_activity_overrides_global_uniq
  ON public.cost_head_activity_overrides (project_id, cost_head)
  WHERE building_identifier IS NULL;