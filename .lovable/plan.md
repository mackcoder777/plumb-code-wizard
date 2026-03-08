

## Fix LRCN Calculation: Separate Field and Shop Hour Rates

### Problem
Line 625 calculates `budgetTotal = totalHours * budgetRate`, applying the field budget rate ($98/hr) to all hours including shop. Shop hours should use the shop bid rate ($71.59/hr).

### Changes in `src/components/BudgetAdjustmentsPanel.tsx`

**Change 1: `lrcnCalculations` (lines 623-638)**

Replace:
```typescript
const totalHours = bidRates.straightTime.hours + bidRates.shiftTime.hours + 
                   bidRates.overtime.hours + bidRates.doubleTime.hours + bidRates.shop.hours;
const budgetTotal = totalHours * budgetRate;
```

With:
```typescript
const fieldHours = bidRates.straightTime.hours + bidRates.shiftTime.hours +
                   bidRates.overtime.hours + bidRates.doubleTime.hours;
const shopHours = bidRates.shop.hours;
const shopRate = parseRate(bidRates.shop.rate);
const totalHours = fieldHours + shopHours;
const budgetTotal = (fieldHours * budgetRate) + (shopHours * shopRate);
```

Add `fieldHours`, `shopHours`, and `shopRate` to the return object.

**Change 2: UI label (line 1243)**

Replace:
```
{lrcnCalculations.totalHours.toLocaleString()} hrs × ${budgetRate.toFixed(2)}
```

With:
```
Field: {lrcnCalculations.fieldHours.toLocaleString()} hrs × ${budgetRate.toFixed(2)} + Shop: {lrcnCalculations.shopHours.toLocaleString()} hrs × ${lrcnCalculations.shopRate.toFixed(2)}
```

No other changes needed.

