

# Plan: Add Manual Code Entry for Material Mapping

## Overview
Add the ability to manually type and assign a custom material code that doesn't exist in the cost code library. This gives users flexibility when they need to use codes not yet added to the system.

## Current Behavior
- Users can only select codes from the existing `cost_codes` database (category='M')
- If a code doesn't exist, there's no way to assign it

## Proposed Solution
Add a manual entry input field to the CodePicker component that allows users to type any code value and apply it directly.

## Implementation Details

### 1. Update CodePicker Component
**File:** `src/components/tabs/MaterialMappingTab.tsx`

Modify the `CodePicker` component to include:
- A text input field for manual code entry
- A button to apply the manually entered code
- Visual separation between "Search Library" and "Manual Entry" sections

**Before:**
```text
+----------------------------------+
| Search material codes...         |
+----------------------------------+
| 9511 - Cast Iron Pipe & Fittings |
| 9512 - Copper Pipe & Fittings    |
| ...                              |
+----------------------------------+
```

**After:**
```text
+----------------------------------+
| Search material codes...         |
+----------------------------------+
| 9511 - Cast Iron Pipe & Fittings |
| 9512 - Copper Pipe & Fittings    |
| ...                              |
+----------------------------------+
| ────── Or enter manually ──────  |
+----------------------------------+
| [Custom code input    ] [Apply]  |
+----------------------------------+
```

### 2. Code Changes

Add local state for manual entry:
```typescript
const [manualCode, setManualCode] = useState('');
```

Add manual entry UI below the command list:
```typescript
<div className="border-t p-3">
  <div className="text-xs text-muted-foreground mb-2 text-center">
    Or enter code manually
  </div>
  <div className="flex gap-2">
    <Input 
      placeholder="Enter code..."
      value={manualCode}
      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
      className="h-8 text-sm font-mono"
    />
    <Button 
      size="sm"
      disabled={!manualCode.trim()}
      onClick={() => {
        onSelect(manualCode.trim());
        setManualCode('');
      }}
    >
      Apply
    </Button>
  </div>
</div>
```

### 3. User Experience
- Manual entry input auto-converts to uppercase for consistency
- Apply button is disabled until user types something
- Selecting a code from the list OR clicking Apply both close the picker and assign the code
- Toast notification confirms assignment

## Files to Modify
| File | Change |
|------|--------|
| `src/components/tabs/MaterialMappingTab.tsx` | Add manual entry UI to CodePicker component |

## Edge Cases Handled
- Empty input: Apply button is disabled
- Whitespace-only: Trimmed before applying
- Case consistency: Auto-converted to uppercase

