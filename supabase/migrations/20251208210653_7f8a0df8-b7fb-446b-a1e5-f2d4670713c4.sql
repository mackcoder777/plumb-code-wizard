-- Add source_file column to track which file each item came from
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS source_file text;

-- Add source_files array to projects table
ALTER TABLE estimate_projects 
ADD COLUMN IF NOT EXISTS source_files text[] DEFAULT '{}';

-- Create index for filtering by source file
CREATE INDEX IF NOT EXISTS idx_estimate_items_source_file 
ON estimate_items(project_id, source_file);