UPDATE public.floor_section_mappings
SET activity_code = 'B1', updated_at = now()
WHERE activity_code = '01'
  AND floor_pattern ILIKE 'Bldg 1%';