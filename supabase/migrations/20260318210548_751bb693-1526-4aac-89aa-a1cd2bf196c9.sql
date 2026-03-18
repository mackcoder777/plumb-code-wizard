ALTER TABLE system_activity_mappings
  ADD COLUMN IF NOT EXISTS cost_head_filter text DEFAULT NULL;

ALTER TABLE system_activity_mappings
  DROP CONSTRAINT IF EXISTS system_activity_mappings_project_id_system_pattern_key;

ALTER TABLE system_activity_mappings
  DROP CONSTRAINT IF EXISTS system_activity_mappings_unique;

ALTER TABLE system_activity_mappings
  ADD CONSTRAINT system_activity_mappings_unique
  UNIQUE (project_id, system_pattern, cost_head_filter);