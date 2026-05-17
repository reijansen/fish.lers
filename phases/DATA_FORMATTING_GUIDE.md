# Data Formatting Guide - FishLERS System

## Overview
This document provides comprehensive guidelines for formatting all data displayed in tables, dialogs, and UI components across the FishLERS system. The goal is to ensure consistent, user-friendly, and professional data presentation throughout the application.

## Utility Functions (`client/src/utils/formatters.ts`)

A centralized utility module has been created with the following functions for consistent data formatting:

### Date & Time Formatting

#### `formatDate(dateStr: string | undefined): string`
Formats dates to readable format: "Feb 17, 2026"
```typescript
import { formatDate } from '../../utils/formatters'
formatDate("2026-02-17") // Returns: "Feb 17, 2026"
```

#### `formatTime(timeStr: string | undefined): string`
Formats time to readable format: "7:00 AM"
```typescript
formatTime("07:00") // Returns: "7:00 AM"
```

#### `formatDateTime(dateStr, timeStr): string`
Combines date and time: "Feb 17, 2026 7:00 AM"
```typescript
formatDateTime("2026-02-17", "07:00") // Returns: "Feb 17, 2026 7:00 AM"
```

#### `formatDateRange(startDateStr, endDateStr): string`
Formats date ranges with smart compact format:
- Same month: "17 - 21, Feb 2026"
- Different months: "Feb 17, 2026 to Mar 3, 2026"

#### `formatSchedule(startDateStr, startTimeStr, endDateStr, endTimeStr): string`
Formats complete schedule with dates and times: "Feb 17, 2026 7:00 AM to Feb 21, 2026 5:30 PM"

### Number & Currency Formatting

#### `formatCurrency(amount: number, currency = "PHP"): string`
Formats monetary values: "PHP 1,234.56"

#### `formatNumber(num: number | undefined): string`
Formats large numbers with commas: "1,234,567"

#### `formatPercentage(num: number, decimals = 1): string`
Formats percentages: "85.5%"

### Utility Functions

#### `formatBytes(bytes: number): string`
Formats file sizes: "2.5 MB"

#### `truncate(text: string | undefined, maxLength = 50): string`
Truncates text with ellipsis when needed

#### `formatRelativeTime(date: Date): string`
Formats relative time: "2 hours ago", "in 3 days"

## UI/UX Patterns for Tables

### Column Header Structure
- Use clear, concise headers
- Use uppercase with tracking for emphasis (e.g., `text-xs uppercase tracking-wide text-base-content/60`)
- Keep headers consistent across similar tables

### Data Cell Formatting

**Primary Information:**
- Use `font-semibold` or `font-medium` for primary data
- Use larger text sizes for important values
- Use `text-lg` or `text-base` for headline data

**Secondary Information:**
- Use `text-base-content/60` or `text-base-content/70` for secondary data
- Use `text-xs` or `text-sm` for metadata
- Use `font-mono` for IDs and codes

**Visual Hierarchy Example:**
```tsx
<td>
  <div className="flex items-center gap-2">
    <Calendar className="w-4 h-4 text-base-content/50 flex-shrink-0" />
    <span className="font-semibold">{formatDate(dateValue)}</span>
  </div>
  {secondaryDate && (
    <div className="text-xs text-base-content/60 mt-1">
      to {formatDate(secondaryDate)}
    </div>
  )}
</td>
```

### Icons & Badges
- Use icons from `lucide-react` to provide visual scanning
- Use badges for status, categories, and tags
- Combine icons with text for clarity

## UI/UX Patterns for Modals/Dialogs

### Modal Structure

**Layout:**
- Use `space-y-5` for consistent vertical spacing
- Use dividers (`divider`) between major sections
- Use larger max-width for detailed modals: `max-w-2xl`

**Section Headers:**
```tsx
<div>
  <h3 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold">
    Section Title
  </h3>
  <div className="mt-2 text-lg font-semibold">
    {value}
  </div>
</div>
```

**Content Containers:**
- Use `bg-base-200` background for read-only content
- Use `rounded-lg p-4` for padding and rounded corners
- Use `leading-relaxed` for text content

**Example Modal:**
```tsx
<dialog className="modal modal-open">
  <div className="modal-box max-w-2xl">
    <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}>
      ✕
    </button>
    <div className="space-y-5">
      {/* Section 1 */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold">
          Title
        </h3>
        <div className="text-lg font-semibold mt-2">{primaryValue}</div>
      </div>

      <div className="divider my-2" />

      {/* Section 2 */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-2">
          Details
        </h3>
        <div className="bg-base-200 rounded-lg p-4">
          {detailedContent}
        </div>
      </div>
    </div>
  </div>
</dialog>
```

## Application Examples

### Accountabilities Page
- **Table:** Uses `Calendar` icon with formatted dates, truncated details, status badges
- **Modal:** Improved from basic layout to hierarchical structure with dividers and proper spacing
- **Formatting:** All dates use `formatDate()`, details are truncated with `truncate()`

### AdminUsers Page
- **Table:** Shows "Joined" dates using `formatDate()` utility
- **Avatar:** Uses colored badges by role
- **Status:** Uses color-coded badges (success, primary, warning)

### AdminRequestHistory Page
- **Table:** Uses formatted dates and times for schedule display
- **Modal:** Shows complete schedule with times, formatted dates
- **Filter:** Live result counting and clear filtering options

### TrackingPage (Student)
- **Table:** Shows purpose with duration below in smaller text
- **Items:** Quantity shown in badge with tooltip for details
- **Request ID:** Shortened display with copy button
- **Status:** Color-coded status badges

## Patterns to Apply

### 1. **Always Use Formatters for Backend Data**
- Never display raw ISO dates like "2026-02-17"
- Never display 24-hour time like "07:00" without formatting
- Apply `formatDate()`, `formatTime()`, `formatDateRange()` as needed

### 2. **Create Visual Hierarchy**
- Primary data: bold, larger, darker
- Secondary data: lighter color, smaller text, metadata styling
- Use icons for quick visual scanning

### 3. **Group Related Information**
- Use dividers between major sections
- Use consistent spacing (space-y-4, space-y-5)
- Group metadata together

### 4. **Use Status Badges**
- Don't just show status text
- Use color-coded badges for quick visual identification
- Combine with icons when relevant

### 5. **Improve Empty States**
- Show icons alongside "No data" messages
- Provide context-specific guidance
- Use `text-base-content/60` for secondary text

### 6. **Handle Long Text**
- Truncate long text with `truncate()` function
- Add tooltips for full content
- Use monospace font for IDs and codes

## Files Updated

- ✅ `client/src/utils/formatters.ts` - Created comprehensive formatting utility
- ✅ `client/src/pages/accountabilities/Accountabilities.tsx` - Applied formatters and improved modal
- ✅ `client/src/pages/admin/AdminRequestHistory.tsx` - Refactored to use formatters module
- ✅ `client/src/pages/admin/AdminUsers.tsx` - Updated to use formatters utility

## Checklist for New Pages/Components

When creating new tables or dialogs, use this checklist:

- [ ] Import formatting utilities: `import { formatDate, formatTime, ... } from '../../utils/formatters'`
- [ ] Never display raw backend dates/times - always use formatters
- [ ] Use icons from lucide-react for visual enhancement
- [ ] Implement visual hierarchy: bold primary, lighter secondary
- [ ] Use status badges instead of plain text
- [ ] Add truncation for long text with truncate() function
- [ ] Include meaningful empty states with icons and context
- [ ] Use consistent spacing with tailwind's space-y-* classes
- [ ] Group related information with dividers in modals
- [ ] Test on mobile with overflow handling

## Future Improvements

- Consider creating a `<FormattedDate />` component for auto-formatting dates
- Create a `<DataTable />` component with built-in formatting and styling
- Consider creating a `<Modal />` component with standardized structure
- Create `<StatusBadge />` component for consistent status displays

---

**Last Updated:** Current Session  
**Maintained By:** Development Team
