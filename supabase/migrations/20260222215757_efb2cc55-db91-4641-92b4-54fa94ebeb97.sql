
-- Drop the existing check constraint that only allows L and M
ALTER TABLE public.cost_codes DROP CONSTRAINT IF EXISTS cost_codes_category_check;

-- Add new check constraint allowing all 5 categories
ALTER TABLE public.cost_codes ADD CONSTRAINT cost_codes_category_check 
  CHECK (category IN ('L', 'M', 'O', 'R', 'S'));
