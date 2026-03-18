

## Make Budget AI Chat Scrollable and Expandable

### Problem
The chat panel has a fixed `max-h-[600px]` and messages area capped at `max-h-[400px]`. Long AI responses get cut off with no way to scroll through them or expand the panel.

### Changes — `src/components/BudgetChat.tsx`

#### 1. Add expand/collapse toggle
- Add an `expanded` state boolean
- Add a maximize/minimize button in the header (next to the X close button)
- When expanded: panel grows to near-full viewport height (`max-h-[85vh]`, `w-[500px]`) instead of the current `max-h-[600px]`, `w-[400px]`
- When collapsed: keep current dimensions

#### 2. Fix scroll area to fill available space
- Change the messages `ScrollArea` from `max-h-[400px]` to use flex-grow (`flex-1 min-h-0`) so it fills all available space between header and input
- The outer panel already uses `flex-col`, so removing the fixed max-height on ScrollArea will let it expand properly

#### 3. Icon
- Import `Maximize2` and `Minimize2` from lucide-react for the toggle button

### Summary of line changes
- **Line 4**: Add `Maximize2, Minimize2` to lucide imports
- **Line 135**: Add `const [expanded, setExpanded] = useState(false);`
- **Line 222**: Change panel dimensions to be conditional on `expanded` state
- **Line 233**: Add expand/collapse button before the close button
- **Line 239**: Remove `max-h-[400px]` from ScrollArea, keep `flex-1 min-h-0`

