

## Plan

### 1. Fix Build Error
Line 7 of `package.json` still has `"dev": "vite"` — needs to be `"dev": "npx vite"`.

### 2. Cold Water → WATR Status
Based on your screenshot, the bulk assignment completed successfully — the toast says "Bulk Assignment Complete" and "Assigned labor code to 1 systems." The 3,003 Cold Water items should now have WATR as their cost head. Once the build is fixed you can verify by checking the Estimates tab filtered to Cold Water.

**Single file change:**
- `package.json` line 7: `"dev": "vite"` → `"dev": "npx vite"`

