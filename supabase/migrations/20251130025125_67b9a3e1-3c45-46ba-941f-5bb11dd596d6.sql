-- Add item_type column to system_mappings table for granular cost code mapping
ALTER TABLE public.system_mappings 
ADD COLUMN item_type text DEFAULT NULL;

-- Create unique constraint for system_name + item_type combination per project
-- This allows both system-only mappings (item_type = NULL) and system+itemType mappings
CREATE UNIQUE INDEX system_mappings_project_system_itemtype_idx 
ON public.system_mappings (project_id, system_name, COALESCE(item_type, ''));

-- Add comment explaining the column
COMMENT ON COLUMN public.system_mappings.item_type IS 'Optional item type for granular cost code mapping. NULL means system-level mapping applies to all item types.';