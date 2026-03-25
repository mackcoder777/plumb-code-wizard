

## Plan: Three Navigation-Only Changes in BudgetAdjustmentsPanel.tsx

### Change 1 — Make "need attention" clickable (lines 3205-3207)

Replace the static `<span>` with a `<button>`:

```tsx
// Before (lines 3205-3207):
<span className={residualRows.length > 0 ? 'text-amber-500' : 'text-green-600'}>
  {residualRows.length} need attention
</span>

// After:
<button
  onClick={() => {
    setSmallCodeTab('standalone');
    setStandaloneFilter('residual');
  }}
  className={cn(
    'underline cursor-pointer',
    residualRows.length > 0 ? 'text-amber-500 hover:text-amber-600' : 'text-green-600'
  )}
>
  {residualRows.length} need attention
</button>
```

### Change 2 — Round 2 badge also switches tab (line 3815)

Add `setSmallCodeTab('standalone')` to the existing onClick:

```tsx
// Before (line 3815):
onClick={() => setStandaloneFilter('residual')}

// After:
onClick={() => {
  setSmallCodeTab('standalone');
  setStandaloneFilter('residual');
}}
```

### Change 3 — Amber CTA card after banner (after line 3208)

Insert the amber card immediately after the closing `</div>` of the banner (line 3208):

```tsx
{residualRows.length > 0 && (
  <button
    onClick={() => {
      setSmallCodeTab('standalone');
      setStandaloneFilter('residual');
    }}
    className="w-full mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left hover:bg-amber-100 transition-colors"
  >
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-semibold text-amber-700">
          ⚠ {residualRows.length} codes still under {minHoursThreshold}h after all actions
        </span>
        <p className="text-xs text-amber-600 mt-0.5">
          Click to review and reassign or accept these codes
        </p>
      </div>
      <span className="text-amber-500 text-sm">Review →</span>
    </div>
  </button>
)}
```

### Summary

Three surgical edits, all display/navigation only. No logic, persistence, or export changes. All variables (`setSmallCodeTab`, `setStandaloneFilter`, `residualRows`, `minHoursThreshold`, `cn`) are already in scope.

