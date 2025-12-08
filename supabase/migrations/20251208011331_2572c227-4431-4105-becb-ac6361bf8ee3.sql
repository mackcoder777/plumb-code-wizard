-- Add columns to track when mappings are applied to items
ALTER TABLE public.system_mappings 
ADD COLUMN applied_at timestamp with time zone DEFAULT NULL,
ADD COLUMN applied_item_count integer DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.system_mappings.applied_at IS 'Timestamp when mapping was last applied to estimate items';
COMMENT ON COLUMN public.system_mappings.applied_item_count IS 'Number of items affected when mapping was last applied';