-- Drop the existing unique constraint on code only
ALTER TABLE public.cost_codes DROP CONSTRAINT IF EXISTS cost_codes_code_key;

-- Add a new unique constraint on code + category combination
-- This allows the same code to exist for both Labor and Material
ALTER TABLE public.cost_codes ADD CONSTRAINT cost_codes_code_category_key UNIQUE (code, category);