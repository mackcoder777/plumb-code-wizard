-- Create a table to store historical system-to-code mapping patterns for learning
-- This allows the system to suggest codes based on patterns from previous projects
CREATE TABLE public.mapping_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_name_pattern TEXT NOT NULL,           -- Normalized system name (lowercase, trimmed)
  labor_code TEXT NOT NULL,                    -- The labor code that was assigned
  usage_count INTEGER NOT NULL DEFAULT 1,      -- How many times this pattern was used
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confidence_score NUMERIC(3,2) DEFAULT 1.0,   -- Score based on usage frequency
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint on pattern + code combination
  UNIQUE(system_name_pattern, labor_code)
);

-- Enable RLS
ALTER TABLE public.mapping_patterns ENABLE ROW LEVEL SECURITY;

-- Everyone can read patterns (shared learning across users)
CREATE POLICY "Everyone can view mapping patterns"
ON public.mapping_patterns
FOR SELECT
USING (true);

-- Authenticated users can insert new patterns
CREATE POLICY "Authenticated users can create patterns"
ON public.mapping_patterns
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update patterns (increment usage count)
CREATE POLICY "Authenticated users can update patterns"
ON public.mapping_patterns
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Create index for fast lookups
CREATE INDEX idx_mapping_patterns_system_name ON public.mapping_patterns(system_name_pattern);
CREATE INDEX idx_mapping_patterns_usage ON public.mapping_patterns(usage_count DESC);