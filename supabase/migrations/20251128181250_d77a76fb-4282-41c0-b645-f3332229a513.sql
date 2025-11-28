-- Create table for estimate projects
CREATE TABLE public.estimate_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_name text,
  total_items integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for system mappings
CREATE TABLE public.system_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.estimate_projects(id) ON DELETE CASCADE NOT NULL,
  system_name text NOT NULL,
  cost_head text NOT NULL,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  verified_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(project_id, system_name)
);

-- Create table for mapping audit history
CREATE TABLE public.mapping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.estimate_projects(id) ON DELETE CASCADE NOT NULL,
  system_name text NOT NULL,
  from_code text,
  to_code text NOT NULL,
  change_reason text,
  changed_by text DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estimate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for estimate_projects
CREATE POLICY "Users can view their own projects" ON public.estimate_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON public.estimate_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.estimate_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.estimate_projects
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for system_mappings (via project ownership)
CREATE POLICY "Users can view mappings for their projects" ON public.system_mappings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create mappings for their projects" ON public.system_mappings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update mappings for their projects" ON public.system_mappings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete mappings for their projects" ON public.system_mappings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

-- RLS policies for mapping_history
CREATE POLICY "Users can view history for their projects" ON public.mapping_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create history for their projects" ON public.mapping_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_estimate_projects_updated_at
  BEFORE UPDATE ON public.estimate_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_mappings_updated_at
  BEFORE UPDATE ON public.system_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();