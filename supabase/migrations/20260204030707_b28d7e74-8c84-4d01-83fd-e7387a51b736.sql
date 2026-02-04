-- Create system_activity_mappings table for dynamic activity code assignment
CREATE TABLE public.system_activity_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  system_pattern TEXT NOT NULL,
  activity_code TEXT NOT NULL DEFAULT '0000',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, system_pattern)
);

-- Enable RLS
ALTER TABLE public.system_activity_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their project activity mappings"
ON public.system_activity_mappings
FOR SELECT
USING (project_id IN (
  SELECT id FROM estimate_projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create activity mappings for their projects"
ON public.system_activity_mappings
FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM estimate_projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update activity mappings for their projects"
ON public.system_activity_mappings
FOR UPDATE
USING (project_id IN (
  SELECT id FROM estimate_projects WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete activity mappings for their projects"
ON public.system_activity_mappings
FOR DELETE
USING (project_id IN (
  SELECT id FROM estimate_projects WHERE user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_system_activity_mappings_updated_at
BEFORE UPDATE ON public.system_activity_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();