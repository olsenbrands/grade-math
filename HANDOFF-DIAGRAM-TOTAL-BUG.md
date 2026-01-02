# Handoff: Diagram Total Bug (Bracket Shows "1" Instead of "170")

**Date:** January 2, 2026
**Status:** IN PROGRESS - Bug not yet resolved
**Priority:** High

## Problem Summary

The Visual Math Diagram feature for Smart Explanations is showing "1" in the bracket instead of the correct total "170". This happens even after regenerating explanations.

**Expected:** Bracket shows `170` (the total from the problem text)
**Actual:** Bracket shows `1`

## Test Case

- **Problem:** `Q1: muffins: 6, scones: 1, donuts: ?; total pastries = 170`
- **Correct Answer:** 163 (170 - 6 - 1 = 163)
- **Diagram Should Show:** Stacked bars with muffins (6), scones (1), donuts (?) and bracket showing 170

## What We've Tried

### 1. Prompt Engineering (explanation-service.ts:203-328)
- Added explicit WRONG/RIGHT examples for total field
- Added critical instructions about extracting total from problem text
- Result: AI still returns `total: 1`

### 2. Post-Processing Fix (explanation-service.ts:604-642)
- Added regex patterns to extract total from problem text
- Patterns work locally (tested with Node.js - extracts 170 correctly)
- Code should override AI's bad value with extracted value
- **Issue:** Fix doesn't seem to be running or saving properly

### 3. Component-Level Fallback (BarModel.tsx:44-57)
- Added defensive handling to extract total from labels if value is wrong
- Uses `knownTotal` as fallback
- **Issue:** Still shows "1"

### 4. Added Regenerate Button (SubmissionList.tsx:966-996)
- Users can now regenerate explanations
- Button appears next to "Smart Explanations available"

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai/explanation-service.ts` | AI prompt & post-processing |
| `src/lib/ai/diagram-types.ts` | TypeScript types for diagrams |
| `src/components/diagrams/BarModel.tsx` | SVG rendering component |
| `src/components/submissions/SubmissionList.tsx` | UI display |
| `src/app/api/explanations/generate/route.ts` | API endpoint |

## Debugging Next Steps

### 1. Check if Post-Processing is Running
The code at `explanation-service.ts:607-608` has logging:
```typescript
console.log(`[EXPLANATION] Q${idx + 1} AI returned total: ${currentTotal}`);
console.log(`[EXPLANATION] Q${idx + 1} problemText: "${problemText}"`);
```

Check Vercel function logs to see:
- What value the AI actually returns for `total`
- Whether problemText is being passed correctly
- Whether the regex extraction runs

### 2. Verify Data Flow
The flow is:
1. `/api/explanations/generate` receives request
2. Calls `explanationService.generateExplanations()`
3. GPT-4o returns JSON with diagram data
4. `parseExplanationResponse()` processes the response
5. Post-processing should fix `total` at line 637-641
6. Data saved to `graded_results.questions_json`
7. UI reads from database and displays

### 3. Check Database Storage
The diagram data is stored in `graded_results.questions_json[].explanation.diagram.data.total`. Check if the value is 170 in the database after regeneration.

### 4. Potential Issues
- **Caching:** Browser or Vercel edge caching old responses
- **Data not saving:** The fixed `diagramData` might not be persisted
- **Variable scope:** The reassignment `diagramData = {...}` creates a new object but might not be used properly downstream

## Regex Patterns That Work (Tested Locally)

```javascript
const problemText = 'Q1: muffins: 6, scones: 1, donuts: ?; total pastries = 170';

const patterns = [
  /total[^0-9]*=\s*(\d+)/i,  // Matches "total pastries = 170" -> 170
];

// Test result: Successfully extracts 170
```

## Code Location for Fix

The most likely fix location is in `explanation-service.ts` around line 637-641:

```typescript
if (diagramData && extractedTotal !== null) {
  if (!currentTotal || aiTotalNum <= 10 || extractedTotal > aiTotalNum) {
    console.log(`[EXPLANATION] Q${idx + 1} FIXING total: ${currentTotal} -> ${extractedTotal}`);
    diagramData = { ...diagramData, total: extractedTotal };
  }
}
```

The issue might be that `diagramData` is reassigned but the original reference in `rawDiagram.data` isn't updated. The fix should work because we use `diagramData` to create `candidateDiagram` at line 644-651.

## Additional Observations

1. The "Correct answer" field in the UI sometimes shows wrong values (54 instead of 163) - this might be a separate grading issue
2. The explanation steps are correct (mentions 170 - 7 = 163)
3. Only the visual diagram bracket is wrong

## Resume Command

When resuming, start with:
```
Check Vercel function logs for [EXPLANATION] entries to debug why the diagram total fix isn't working. The regex extraction works locally but the fix isn't being applied in production.
```
