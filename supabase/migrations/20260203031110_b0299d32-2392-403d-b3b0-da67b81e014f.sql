-- Create table for material code mapping patterns (learning system)
CREATE TABLE public.material_mapping_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_spec_pattern TEXT NOT NULL,
  item_type_pattern TEXT NOT NULL,
  material_code TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC DEFAULT 1.0,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID DEFAULT NULL,
  
  -- Unique constraint on the pattern combination + code
  UNIQUE(material_spec_pattern, item_type_pattern, material_code)
);

-- Enable RLS
ALTER TABLE public.material_mapping_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies - similar to labor mapping_patterns
CREATE POLICY "Everyone can view material mapping patterns"
  ON public.material_mapping_patterns
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create material patterns"
  ON public.material_mapping_patterns
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update material patterns"
  ON public.material_mapping_patterns
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_material_patterns_lookup 
  ON public.material_mapping_patterns(material_spec_pattern, item_type_pattern);

CREATE INDEX idx_material_patterns_usage 
  ON public.material_mapping_patterns(usage_count DESC, confidence_score DESC);