-- Add column to track items excluded from material budget assignment
ALTER TABLE estimate_items 
ADD COLUMN excluded_from_material_budget boolean DEFAULT false;