

# Wrap Building Section Mapping in a Collapsible

## Problem
The Building → Section Code panel is rendered as a plain `<div>` in `SystemMappingTab.tsx` (line 1008), while other panels (Section Mapping, System to Activity Mapping) use `<Collapsible>` wrappers. This means it's always expanded and can't be collapsed.

## Fix

**File: `src/components/tabs/SystemMappingTab.tsx` (~lines 1006-1024)**

Wrap the `BuildingSectionMappingPanel` in a `<Collapsible>` with a `<CollapsibleTrigger>` button, matching the style of adjacent panels. Default it to **open** (so existing behavior isn't jarring) but allow collapsing.

```tsx
<Collapsible defaultOpen>
  <CollapsibleTrigger asChild>
    <Button variant="outline" className="w-full justify-between">
      <div className="flex items-center gap-2 text-left">
        <Building2 className="h-4 w-4 shrink-0" />
        <span>Building → Section Code</span>
        <Badge variant="secondary">{buildingSectionMappings.length} mapped</Badge>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="pt-4">
    {/* existing Alert + BuildingSectionMappingPanel */}
  </CollapsibleContent>
</Collapsible>
```

One file changed. No logic changes.

| File | Change |
|------|--------|
| `src/components/tabs/SystemMappingTab.tsx` | Wrap BuildingSectionMappingPanel block in Collapsible |

