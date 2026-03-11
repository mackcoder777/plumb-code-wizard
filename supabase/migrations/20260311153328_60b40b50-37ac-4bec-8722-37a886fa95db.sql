ALTER TABLE public.project_small_code_merges 
  DROP CONSTRAINT project_small_code_merges_project_id_cost_head_key;

ALTER TABLE public.project_small_code_merges
  ADD CONSTRAINT project_small_code_merges_project_sec_head_key 
  UNIQUE (project_id, sec_code, cost_head);