ALTER TABLE public.estimate_projects 
  ADD COLUMN IF NOT EXISTS code_format_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS trade_prefix text NOT NULL DEFAULT 'PL',
  ADD COLUMN IF NOT EXISTS dismissed_duplicate_flags jsonb NOT NULL DEFAULT '[]'::jsonb;