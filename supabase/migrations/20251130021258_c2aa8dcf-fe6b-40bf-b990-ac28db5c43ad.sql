-- Create estimate_items table to persist actual line item data
CREATE TABLE public.estimate_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.estimate_projects(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  drawing TEXT DEFAULT '',
  system TEXT DEFAULT '',
  floor TEXT DEFAULT '',
  zone TEXT DEFAULT '',
  symbol TEXT DEFAULT '',
  estimator TEXT DEFAULT '',
  material_spec TEXT DEFAULT '',
  item_type TEXT DEFAULT '',
  report_cat TEXT DEFAULT '',
  trade TEXT DEFAULT '',
  material_desc TEXT DEFAULT '',
  item_name TEXT DEFAULT '',
  size TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 0,
  list_price NUMERIC DEFAULT 0,
  material_dollars NUMERIC DEFAULT 0,
  weight NUMERIC DEFAULT 0,
  hours NUMERIC DEFAULT 0,
  labor_dollars NUMERIC DEFAULT 0,
  cost_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access items from their projects)
CREATE POLICY "Users can view items from their projects" ON public.estimate_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = estimate_items.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert items for their projects" ON public.estimate_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = estimate_items.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update items in their projects" ON public.estimate_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = estimate_items.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete items from their projects" ON public.estimate_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.estimate_projects WHERE id = estimate_items.project_id AND user_id = auth.uid())
  );

-- Index for fast project lookups
CREATE INDEX idx_estimate_items_project_id ON public.estimate_items(project_id);

-- Trigger for updated_at
CREATE TRIGGER update_estimate_items_updated_at
  BEFORE UPDATE ON public.estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();