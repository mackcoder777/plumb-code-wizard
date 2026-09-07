-- Repair: two shape-corrupt system_mappings.cost_head values
--
-- ===========================================================================
-- RESOLVED 2026-09-07 — the UPDATE in STEP 3 was NOT used, and should not be.
--
-- Both rows were repaired by re-assigning the systems in the app's System
-- Mapping tab. That is the better route and the one to take if this recurs:
-- the upsert replaces the malformed value with a clean one, the banner clears
-- on reload, and the assignment is PM-authored, which is what CLAUDE.md §20
-- requires. Writing a cost head by SQL is the code assigning a cost head --
-- the exact thing PR #6 existed to stop.
--
-- STEP 3 would also have been WRONG on one of the two rows. See the warning
-- above STEP 3 before ever running it. Keeping the file for the survey
-- queries in STEP 1, 2 and 4, which remain useful.
-- ===========================================================================
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
--
-- Expect THE SAME ROWS STEP 1 RETURNED, and nothing else. An earlier version
-- of this comment said "expect 0 rows", which was wrong: the LIKE '%{%'
-- predicate below matches the same object-shaped values STEP 1 finds. Anyone
-- following that comment literally would have stopped on a correct result.
--
-- The point of this step is the OTHER predicates -- array-shaped, padded and
-- empty values that STEP 1's LIKE '{%' would miss. Rows beyond STEP 1's set
-- are the stop condition, not any rows at all.
-- ---------------------------------------------------------------------------
SELECT id, project_id, system_name, cost_head
FROM system_mappings
WHERE cost_head LIKE '[%'
   OR cost_head LIKE '%{%'
   OR cost_head <> btrim(cost_head)
   OR cost_head = '';


-- ---------------------------------------------------------------------------
-- !!! DO NOT RUN STEP 3 WITHOUT READING THIS !!!
--
-- Unwrapping the JSON blob restores whatever value happened to be inside it.
-- On one of the two rows that value was WRONG, so the UPDATE would have
-- laundered a bad cost head into a well-formed one:
--
--   overflow drn.  {"laborCode":"STRM"} -> STRM   correct (CLAUDE.md §2)
--   bg storm drn   {"laborCode":"STRM"} -> STRM   WRONG; §2 maps it to BGSD
--
-- The producer matched on system.includes('storm'), which caught "bg storm
-- drn" as collateral. Every other below-grade system in the project carries a
-- BG-prefixed head (BG Waste -> BGWV, BG Cold Water -> BGWT, BG Vent -> BGWV,
-- BG Grs.Waste -> BGGW, BG SP Pmp.Disch. -> BGPD, BG Trp.Primer -> BGWT).
-- BG Storm Drn was the only one holding an above-grade code, and it was the
-- one the hardcoded block authored.
--
-- Note §15's "BGSD -> [STRM]" does NOT license this. That is the small-code
-- MERGE chain, applied during budget build; it is a different operation from
-- assignment and does not make BGSD equivalent to STRM.
--
-- Why this matters more than the wrong code: STRM is shape-valid, so
-- CorruptCodeBanner stops flagging the row the moment it is written. The
-- wrong assignment becomes permanently invisible. PR #7 made that banner a
-- SHAPE detector on purpose -- it cannot tell a wrong cost head from a right
-- one, and no query can. A repair that clears the detector without being
-- verified is the same failure as the old "Fix All" it replaced.
--
-- If this recurs: re-assign in the app. Do not unwrap blindly.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- STEP 3 - The repair. SUPERSEDED -- see the warning above.
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
