CREATE TABLE public.category_labor_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  labor_code text NOT NULL,
  usage_count integer NOT NULL DEFAULT 1,
  confidence_score numeric NOT NULL DEFAULT 0.50,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_name, labor_code)
);

ALTER TABLE public.category_labor_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read category patterns"
  ON public.category_labor_patterns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert category patterns"
  ON public.category_labor_patterns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update category patterns"
  ON public.category_labor_patterns FOR UPDATE TO authenticated USING (true);