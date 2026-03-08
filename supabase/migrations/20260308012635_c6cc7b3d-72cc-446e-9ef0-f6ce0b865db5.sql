UPDATE floor_section_mappings 
SET activity_code = '00L1', updated_at = now()
WHERE id IN (
  '9c282db6-bf6c-441c-ab46-6bb533c99205',
  '5383c500-aff0-4765-9570-5db0ac02fc63',
  'd09243f3-88d3-4d40-bc39-a0bf9133feb5',
  '420923db-6975-49ef-a118-42698b61fed6',
  'c4b07541-f852-4247-aa86-5580d654baae',
  'e233f5ba-c000-46fe-b532-e44b49cc3aed'
) AND activity_code = '0000';