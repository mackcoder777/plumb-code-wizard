-- Delete bad learned pattern: CS Threaded Sleeves → 9564 (AH-RTUs)
-- Correct code is 9519 (Sleeves & Inserts)
DELETE FROM material_mapping_patterns 
WHERE material_spec_pattern ILIKE '%cs std.wt.a53 cw t&c%'
  AND item_type_pattern ILIKE '%sleeves%'
  AND material_code = '9564';

-- Correct all misassigned CS sleeve items across all projects
UPDATE estimate_items 
SET material_cost_code = '9519'
WHERE material_cost_code = '9564'
  AND item_type ILIKE '%sleeve%';