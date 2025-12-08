-- Add auto_suggested column to system_mappings table
ALTER TABLE system_mappings 
ADD COLUMN IF NOT EXISTS auto_suggested text;

-- Backfill existing records with their current cost_head as auto_suggested
UPDATE system_mappings 
SET auto_suggested = cost_head 
WHERE auto_suggested IS NULL;