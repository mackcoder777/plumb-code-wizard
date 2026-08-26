-- Repair: two shape-corrupt system_mappings.cost_head values
--
-- Context: Index.tsx auto-assigned { laborCode: 'STRM' } to any system whose
-- name contained "storm" or "overflow", and a `costHead as string` assertion
-- let the object reach Supabase, which serialised it as {"laborCode":"STRM"}.
-- Producer removed in PR #6; this repairs the rows it already wrote.
--
-- Survey established: 2 affected rows, both in "Estimate 8/25/2026".
-- Fix All was never pressed (laborCode%/materialCode% swept 0 rows), so the
-- stripped-material-code damage pattern is not in play.
--
-- RUN THE SELECTS. READ THE OUTPUT. ONLY THEN RUN THE UPDATE.
-- Each step is separate on purpose. Do not paste this file in as one blob.


-- ---------------------------------------------------------------------------
-- STEP 1 - See exactly what will change, before changing it.
-- Expect 2 rows. If the count is anything else, STOP and re-survey.
-- ---------------------------------------------------------------------------
SELECT
  sm.id,
  p.name                                   AS project_name,
  sm.system_name,
  sm.cost_head                             AS current_value,
  sm.cost_head::jsonb ->> 'laborCode'      AS proposed_value,
  sm.cost_head::jsonb ->> 'materialCode'   AS material_code_present
FROM system_mappings sm
JOIN estimate_projects p ON p.id = sm.project_id
WHERE sm.cost_head LIKE '{%'
ORDER BY p.name, sm.system_name;

-- Read three things off that output before continuing:
--   1. row count is 2
--   2. proposed_value is a plain cost head (expect STRM), never NULL
--   3. material_code_present is NULL on both -- the blob only ever carried
--      laborCode. If any row has a materialCode, STOP: the "material|labor"
--      pipe form applies and the UPDATE below would discard half the value.


-- ---------------------------------------------------------------------------
-- STEP 2 - Confirm nothing else in the table is shaped like this.
-- Expect 0 rows. Catches array-shaped or otherwise malformed values that
-- STEP 1's LIKE '{%' would miss.
-- ---------------------------------------------------------------------------
SELECT id, project_id, system_name, cost_head
FROM system_mappings
WHERE cost_head LIKE '[%'
   OR cost_head LIKE '%{%'
   OR cost_head <> btrim(cost_head)
   OR cost_head = '';


-- ---------------------------------------------------------------------------
-- STEP 3 - The repair.
--
-- Guarded three ways:
--   - jsonb_typeof = 'object'      never touches a plain string cost head
--   - ->> 'laborCode' IS NOT NULL  never writes NULL over a real value
--   - <> '' AND btrim              never writes an empty or padded value
--
-- Wrapped in a transaction. Check the row count, then COMMIT or ROLLBACK.
-- ---------------------------------------------------------------------------
BEGIN;

UPDATE system_mappings
SET cost_head = btrim(cost_head::jsonb ->> 'laborCode'),
    updated_at = now()
WHERE cost_head LIKE '{%'
  AND jsonb_typeof(cost_head::jsonb) = 'object'
  AND cost_head::jsonb ->> 'laborCode' IS NOT NULL
  AND btrim(cost_head::jsonb ->> 'laborCode') <> '';

-- Expect: UPDATE 2
-- If it reports any other number, ROLLBACK.

-- Verify inside the transaction, before deciding:
SELECT sm.id, p.name AS project_name, sm.system_name, sm.cost_head
FROM system_mappings sm
JOIN estimate_projects p ON p.id = sm.project_id
WHERE sm.system_name ILIKE '%storm%'
   OR sm.system_name ILIKE '%overflow%'
ORDER BY p.name, sm.system_name;

-- Both repaired rows should now read STRM as a plain string.

COMMIT;
-- or: ROLLBACK;


-- ---------------------------------------------------------------------------
-- STEP 4 - Post-repair confirmation. Expect 0 rows.
-- ---------------------------------------------------------------------------
SELECT id, system_name, cost_head
FROM system_mappings
WHERE cost_head LIKE '{%' OR cost_head LIKE '[%';


-- ---------------------------------------------------------------------------
-- NOT PART OF THE REPAIR - note on the 14 cost_head = 'STRM' rows
--
-- Those are almost certainly correct work and need no action. STRM is a
-- legitimate cost head: CLAUDE.md section 2 maps "Strm Drain" and
-- "Overflow Drn." to STRM, and section 15 lists it among the above-grade peer
-- system codes. The removed block guessed the domain-correct answer; its
-- violation was authority (section 20), not correctness. That is exactly why
-- it survived eleven months.
--
-- There is no query that separates a code-authored STRM from a PM-assigned
-- one. mapping_history cannot do it: its only writer
-- (useEstimateProjects.ts:292) hardcodes change_reason = 'Manual change',
-- never sets changed_by (so the column always takes its 'user' default), and
-- fires only on an edit of an existing mapping. The removed block's history
-- object went to setMappingHistory() -- React state -- and was never
-- persisted. Both discriminator predicates are unreachable by construction,
-- so an empty result there is zero evidence, not weak evidence.
-- ---------------------------------------------------------------------------
