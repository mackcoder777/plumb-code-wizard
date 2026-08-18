# Why HNGS is missing from the Fab Strip module (LBTP)

## What's actually happening

The Fabrication Hours Strip table is not a fixed list of cost heads. It renders one
row per cost head that exists in the project's labor summary. HNGS has no row on
Pasadena Central Library because **no item in that project carries an HNGS labor code**.

Verified against the live data for LBTP — the full head list is:

```text
SNWV 1031.5   WATR 871.6   COND 821.9   SZMC 456.9   STRM 440.3
SLVS 403.9    SEQP 334.4   BGWV 314.1   PIDV 289.8   FNSH 215.0
BGPD 209.5    BGSD 175.2   DRNS 113.9   BGWT 23.9
```

No HNGS. The hanger/support hours are there — they are just mapped into the piping
heads by system mapping:

```text
Supports  → SNWV   458.2 h (110 items)
Supports  → COND   368.7 h ( 45 items)
Supports  → WATR   238.5 h (101 items)
Supports  → STRM   155.0 h ( 32 items)
Struct Attachments → SLVS 135.2 h (56 items)
Specialties (seismic) → SZMC 456.9 h (34 items)
```

That is ~1,226 h of hanger/support labor sitting inside the piping heads. For
comparison, Hamilton High Plumbing does have a real HNGS head (4,010 h) — and there
the HNGS row does appear in the fab strip table. So the module is behaving
correctly; the input data has no HNGS.

## The fix (no code change required)

Go to **Category Labor Mapping** and map the `Supports` report category (and
`Struct Attachments` if the foreman wants those in hanger fab) to `HNGS`. That is a
Tier 1 category override, which outranks the Tier 2 system mapping, so those items
re-code to `<SEC> <ACT> HNGS`. Once re-applied, an HNGS row appears in the Fab Strip
table with roughly 1,226 h and can be stripped at whatever percentage you want,
routing to `FP 0000 HNGS`.

Per the PM Authority rule, the app will not do this reassignment on its own — you
own the mapping decision.

## Optional code change — visibility guard

Right now a head with zero hours is simply absent, which reads as "the feature is
broken" rather than "there is nothing to strip." If you want, add a single
explanatory line under the Fab Strip table header:

- Text: "Only cost heads present in this project appear here. Hanger fab requires
  hanger items mapped to an HNGS labor head in Category Labor Mapping."
- Location: `src/components/BudgetAdjustmentsPanel.tsx`, inside the Fabrication
  Hours Strip `CardContent`, above the table.
- Presentation-only. No change to `groupedByCostHead`, `computeAdjustedLaborSummary`,
  or any hour math. Hamilton and LBTP totals stay byte-identical.

## Not recommended

Rendering every fab-eligible head at 0 h, or adding a synthetic category-driven fab
row that strips across multiple heads. Both break the invariant that a fab strip
source is a real labor code, and the second one would silently move hours out of
heads the PM never mapped to hangers.

## Technical detail

`groupedByCostHead` (`BudgetAdjustmentsPanel.tsx:921-949`) reduces `laborSummary`
keyed on `parts[parts.length - 1]` of each full cost code. The table body at
line 3171 maps over its entries. A head with no items never enters the record, so
it never renders. HNGS appears elsewhere in the file only as a fab *destination*
(`FAB_COST_HEAD_MAP` at lines 493-494 and 534-537, and the routing dropdown at
line 3384) — being a destination does not create a source row.
