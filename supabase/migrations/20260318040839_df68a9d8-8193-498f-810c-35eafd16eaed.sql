CREATE TABLE IF NOT EXISTS public.category_keyword_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  keyword text NOT NULL,
  labor_code text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, category_name, keyword)
);

ALTER TABLE public.category_keyword_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project keyword rules" ON public.category_keyword_rules FOR SELECT USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can create keyword rules for their projects" ON public.category_keyword_rules FOR INSERT WITH CHECK (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can update keyword rules for their projects" ON public.category_keyword_rules FOR UPDATE USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete keyword rules for their projects" ON public.category_keyword_rules FOR DELETE USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));