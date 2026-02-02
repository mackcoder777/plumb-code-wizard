-- Create category labor mappings table
CREATE TABLE public.category_labor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  labor_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, category_name)
);

-- Enable RLS
ALTER TABLE public.category_labor_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their project category mappings"
  ON public.category_labor_mappings FOR SELECT
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can create category mappings for their projects"
  ON public.category_labor_mappings FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update category mappings for their projects"
  ON public.category_labor_mappings FOR UPDATE
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete category mappings for their projects"
  ON public.category_labor_mappings FOR DELETE
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));