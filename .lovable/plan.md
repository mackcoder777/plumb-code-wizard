
# Labor Rate Contingency (LRCN) Calculator

## Overview
Add a new section to the Budget Builder that calculates the difference between estimated labor costs (at bid rates) and budgeted labor costs (at a typically lower budget rate). This difference represents a contingency fund that gets assigned to a material code called **LRCN**.

## How It Works

```text
+------------------------------------------+
|         BID LABOR BREAKDOWN              |
+------------------------------------------+
| Type          | Hours  | Rate    | Total |
|---------------|--------|---------|-------|
| Straight Time | 2,240  | $92.03  | $206K |
| Shift Time    |    0   | $95.70  | $0    |
| Overtime      | 1,008  | $121.57 | $123K |
| Double Time   |    0   | $145.38 | $0    |
| Shop          |    0   | $0.00   | $0    |
+------------------------------------------+
| BID TOTAL     | 3,248  |         | $329K |
+------------------------------------------+

BUDGET RATE INPUT:  $85.00
BUDGET TOTAL:       3,248 × $85 = $276K

LABOR RATE CONTINGENCY (LRCN):
$329K - $276K = $53,080 → Material Code LRCN
```

## Technical Implementation

### 1. New State Variables (Index.tsx)
```typescript
// Bid rates by labor type
const [bidRates, setBidRates] = useState({
  straightTime: { hours: 0, rate: 92.03 },
  shiftTime: { hours: 0, rate: 95.70 },
  overtime: { hours: 0, rate: 121.57 },
  doubleTime: { hours: 0, rate: 145.38 },
  shop: { hours: 0, rate: 0 }
});

// Budget rate (separate from bid rates)
const [budgetRate, setBudgetRate] = useState(85);
```

### 2. Update BudgetAdjustments Interface
Add LRCN fields to track the contingency calculation:
- `laborRateContingencyEnabled: boolean`
- `bidRates: { type, hours, rate }[]`
- `budgetRate: number`
- `bidTotal: number`
- `budgetTotal: number`
- `lrcnAmount: number` (the difference)

### 3. New UI Section in BudgetAdjustmentsPanel
Add a card between "Foreman Field Bonus" and "Fabrication Hours Strip":

**"Labor Rate Contingency (LRCN)"**
- Enable/disable toggle
- Input table for bid labor breakdown:
  - Labor Straight Time (hours, rate)
  - Labor Shift (hours, rate)
  - Labor Overtime (hours, rate)
  - Labor Double Time (hours, rate)
  - Labor Shop @ % (hours, rate)
- Single budget rate input
- Real-time calculation display showing:
  - Bid Total
  - Budget Total
  - LRCN Amount (the savings/contingency)

### 4. Export Integration
When LRCN is enabled and has a positive amount:
- Add `LRCN` line to Material Breakdown section
- Description: "LABOR RATE CONTINGENCY"
- Amount: calculated contingency value

### 5. Persistence
Store LRCN settings in localStorage per project:
- `budget_lrcn_enabled_${projectId}`
- `budget_bid_rates_${projectId}`
- `budget_rate_${projectId}`

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BudgetAdjustmentsPanel.tsx` | Add LRCN card UI, calculation logic, state management |
| `src/pages/Index.tsx` | Add bid rates state, pass to BudgetAdjustmentsPanel |
| `src/utils/budgetExportSystem.ts` | Include LRCN in material export if enabled |

## User Experience
1. User enables "Labor Rate Contingency" toggle
2. Enters hours and rates from their bid breakdown (matching the estimate)
3. Enters the budget rate they plan to use
4. System auto-calculates the contingency
5. LRCN amount appears as a material line item in exports
6. All settings persist across sessions
