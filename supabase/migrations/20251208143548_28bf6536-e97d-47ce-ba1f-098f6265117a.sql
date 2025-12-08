-- Create material_code_rules table for conditional material code assignment
CREATE TABLE public.material_code_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  
  -- Conditions (all must match - AND logic)
  material_spec_contains TEXT,
  material_spec_equals TEXT,
  item_type_equals TEXT,
  item_type_contains TEXT,
  material_desc_contains TEXT,
  item_name_contains TEXT,
  
  -- Result
  material_cost_code TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_code_rules ENABLE ROW LEVEL SECURITY;

-- Users can view rules for their projects (or global rules where project_id is null)
CREATE POLICY "Users can view rules for their projects" 
ON public.material_code_rules 
FOR SELECT 
USING (
  project_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM estimate_projects 
    WHERE estimate_projects.id = material_code_rules.project_id 
    AND estimate_projects.user_id = auth.uid()
  )
);

-- Users can create rules for their projects
CREATE POLICY "Users can create rules for their projects" 
ON public.material_code_rules 
FOR INSERT 
WITH CHECK (
  project_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM estimate_projects 
    WHERE estimate_projects.id = material_code_rules.project_id 
    AND estimate_projects.user_id = auth.uid()
  )
);

-- Users can update rules for their projects
CREATE POLICY "Users can update rules for their projects" 
ON public.material_code_rules 
FOR UPDATE 
USING (
  project_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM estimate_projects 
    WHERE estimate_projects.id = material_code_rules.project_id 
    AND estimate_projects.user_id = auth.uid()
  )
);

-- Users can delete rules for their projects
CREATE POLICY "Users can delete rules for their projects" 
ON public.material_code_rules 
FOR DELETE 
USING (
  project_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM estimate_projects 
    WHERE estimate_projects.id = material_code_rules.project_id 
    AND estimate_projects.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_material_code_rules_updated_at
BEFORE UPDATE ON public.material_code_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();