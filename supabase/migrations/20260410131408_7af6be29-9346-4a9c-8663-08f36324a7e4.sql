-- Safe: no duplicate (project_id, sec_code, cost_head, merged_act) rows exist

-- Drop the old constraint
ALTER TABLE public.project_small_code_merges
  DROP CONSTRAINT IF EXISTS project_small_code_merges_project_sec_head_key;

-- Add new constraint that includes merged_act
ALTER TABLE public.project_small_code_merges
  ADD CONSTRAINT project_small_code_merges_project_sec_head_act_key
  UNIQUE (project_id, sec_code, cost_head, merged_act);