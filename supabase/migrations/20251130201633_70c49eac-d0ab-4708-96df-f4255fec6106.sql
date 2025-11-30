-- Add material_cost_code column to estimate_items table
ALTER TABLE public.estimate_items 
ADD COLUMN material_cost_code text DEFAULT '';

-- Rename cost_code to labor_cost_code for clarity (optional, keeping as cost_code for backward compatibility)
-- We'll use cost_code for labor and add material_cost_code for materials

COMMENT ON COLUMN public.estimate_items.cost_code IS 'Labor cost code for tracking labor hours/dollars';
COMMENT ON COLUMN public.estimate_items.material_cost_code IS 'Material cost code for tracking material dollars';