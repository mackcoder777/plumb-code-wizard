-- Create floor_section_mappings table for project-specific floor-to-section configurations
CREATE TABLE floor_section_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES estimate_projects(id) ON DELETE CASCADE,
  floor_pattern TEXT NOT NULL,
  section_code TEXT NOT NULL DEFAULT '01',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, floor_pattern)
);

-- Enable RLS
ALTER TABLE floor_section_mappings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their project floor mappings
CREATE POLICY "Users can view their project floor mappings"
  ON floor_section_mappings FOR SELECT
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can create floor mappings for their projects"
  ON floor_section_mappings FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update floor mappings for their projects"
  ON floor_section_mappings FOR UPDATE
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete floor mappings for their projects"
  ON floor_section_mappings FOR DELETE
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_floor_section_mappings_updated_at
  BEFORE UPDATE ON floor_section_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();