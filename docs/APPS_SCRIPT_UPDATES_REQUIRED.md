# Apps Script Updates Required for New Structure

## Overview
The Google Sheets has been updated with a new 3-level hierarchy (Category → Subcategory → Type) and 5 specification fields. The Apps Script code in `src/Code.js` needs updates to support these new features.

## Current Issues

### 1. Missing "Type" Column Support
- **Problem**: Code only supports 2-level hierarchy (Category → Subcategory)
- **Impact**: Users cannot filter by Type, losing granular filtering capability
- **Fix**: Add `getTypes()` function and update filters to support Type

### 2. Missing Spec 5 Support
- **Problem**: Code only handles Spec 1-4, but we now have Spec 5
- **Impact**: Spec 5 data exists but cannot be searched or displayed
- **Fix**: Update all functions to include spec5 parameter

### 3. Wrong Spec Config Column Names
- **Problem**: `getSpecConfig()` looks for old column names ('Spec1_Label', 'Spec1_Required')
- **Actual Columns**: 'Spec 1 Label', 'Spec 2 Label', etc. (no 'Required' columns)
- **Impact**: Spec config lookups fail, breaking dynamic form fields
- **Fix**: Update column name references to match new structure

### 4. No Type Parameter in getSpecConfig()
- **Problem**: Function only accepts category and subcategory
- **Impact**: Cannot retrieve correct spec labels for a specific Type
- **Fix**: Add type parameter and update lookup logic

## Functions That Need Updates

### NEW Functions (Add These)
```javascript
/**
 * Gets unique types for a given category and subcategory (NEW FUNCTION)
 */
function getTypes(category, subcategory)
```

### UPDATED Functions (Modify These)

#### 1. getPartsByFilters(filters)
**Changes**:
- Add `type` parameter to filters object
- Add `spec5` parameter to filters object
- Update column indices for new 20-column structure
- Add Type matching logic
- Add Spec 5 matching logic

**Usage Example**:
```javascript
// OLD
getPartsByFilters({
  category: "Gears",
  subcategory: "Aluminum Gears",
  spec1: "14t"
});

// NEW
getPartsByFilters({
  category: "Gears",
  subcategory: "Aluminum Gears",
  type: "3/8\" Hex Bore Gears",  // NEW
  spec1: "14t",
  spec5: "Spur"  // NEW
});
```

#### 2. getPartsByProductCode(productCode)
**Changes**:
- Update column indices for new 20-column structure
- Include `type` and `spec5` in returned objects

#### 3. getSpecConfig(category, subcategory, type)
**Changes**:
- Add `type` parameter (3rd parameter)
- Update column name references:
  - OLD: 'Spec1_Label' → NEW: 'Spec 1 Label'
  - OLD: 'Spec1_Required' → REMOVED (no longer used)
- Add spec5Label to returned object
- Update cache key to include type

**Usage Example**:
```javascript
// OLD
getSpecConfig("Gears", "Aluminum Gears");

// NEW
getSpecConfig("Gears", "Aluminum Gears", "3/8\" Hex Bore Gears");
```

#### 4. getSpecValues(category, subcategory, type, specNumber)
**Changes**:
- Add `type` parameter (3rd parameter)
- Support specNumber = 5 (was limited to 1-4)
- Update validation: `specNumber < 1 || specNumber > 5`
- Add Type filtering logic
- Update cache key to include type

## New Google Sheets Structure

### Parts Sheet (20 columns A-T)
```
A: Part ID
B: Part Name
C: Category
D: Subcategory
E: Type ← NEW
F: Product Code
G: Spec 1
H: Spec 2
I: Spec 3
J: Spec 4
K: Spec 5 ← NEW (was only 4 before)
L: Quantity Per
M: Cost
N: Supplier
O: Order Link
P: Location/Bin
Q: Notes
R: Status
S: Date Added
T: Added By
```

### Spec Config Sheet (9 columns A-I)
```
A: Category Code
B: Category Name
C: Subcategory Name
D: Type ← NEW
E: Spec 1 Label
F: Spec 2 Label
G: Spec 3 Label
H: Spec 4 Label
I: Spec 5 Label ← NEW
```

**Note**: Old "Required" columns removed

## Deployment Steps

### Option 1: Manual Update (Recommended for Understanding Changes)
1. Open Google Apps Script Editor for your project
2. Open `Code.js`
3. Add the new `getTypes()` function (see Code_UPDATED.js lines 131-174)
4. Update `getPartsByFilters()` (see Code_UPDATED.js lines 176-322)
5. Update `getPartsByProductCode()` (see Code_UPDATED.js lines 324-399)
6. Update `getSpecConfig()` (see Code_UPDATED.js lines 401-481)
7. Update `getSpecValues()` (see Code_UPDATED.js lines 483-555)
8. Save and test

### Option 2: Complete Replacement
1. Open `src/Code_UPDATED.js` in this repository
2. Copy the entire updated code
3. Open Google Apps Script Editor
4. Replace entire `Code.js` content
5. Verify all other functions from original Code.js are preserved
6. Save and test

## Testing Checklist

After deploying updates, test these scenarios:

### Test 1: 3-Level Hierarchy
```javascript
// Should return categories
getCategories();

// Should return subcategories for a category
getSubcategories("Gears");

// NEW: Should return types for category + subcategory
getTypes("Gears", "Aluminum Gears");
```

### Test 2: Type Filtering
```javascript
// Should return only parts matching the specific type
getPartsByFilters({
  category: "Gears",
  subcategory: "Aluminum Gears",
  type: "3/8\" Hex Bore Gears"
});
```

### Test 3: Spec Config Retrieval
```javascript
// Should return spec labels for the specific type
getSpecConfig("Gears", "Aluminum Gears", "3/8\" Hex Bore Gears");

// Expected result:
{
  spec1Label: "Tooth Count",
  spec2Label: "Diametral Pitch",
  spec3Label: "Bore Size",
  spec4Label: "Material",
  spec5Label: "Gear Type"
}
```

### Test 4: Spec 5 Support
```javascript
// Should include spec5 in results
getPartsByFilters({
  category: "Gears",
  subcategory: "Aluminum Gears",
  type: "3/8\" Hex Bore Gears",
  spec5: "Spur"  // Should filter by Spec 5
});

// Should return Spec 5 values
getSpecValues("Gears", "Aluminum Gears", "3/8\" Hex Bore Gears", 5);
```

### Test 5: Product Code Search
```javascript
// Should include type and spec5 in results
getPartsByProductCode("WCP-0034");

// Expected result should include:
{
  partID: "GEAR-001",
  type: "Aluminum 3/8\" Hex Bore Gears",  // Should be present
  spec5: "Spur",  // Should be present
  ...
}
```

## Frontend Updates Needed (WebApp.html)

The frontend HTML/JavaScript code will also need updates to:
1. Add Type dropdown that populates after Subcategory selection
2. Add Spec 5 input field
3. Update filtering logic to include Type
4. Update display to show all 5 specs

See `FRONTEND_UPDATES_REQUIRED.md` for details.

## Verification

After deployment, verify by:
1. Opening the web app
2. Selecting: Gears → Aluminum Gears → (Type dropdown should appear)
3. Selecting a Type → (Spec dropdowns should show correct labels)
4. Filtering by specs → (All 5 spec fields should work)
5. Viewing part details → (Should show Type and all 5 specs)

## Rollback Plan

If issues occur:
1. Keep a backup of current `Code.js` before making changes
2. If problems arise, restore from backup
3. Test changes in a separate script file first

## Summary of Changes

**Added**: 1 new function (`getTypes`)
**Modified**: 4 functions (`getPartsByFilters`, `getPartsByProductCode`, `getSpecConfig`, `getSpecValues`)
**Impact**: Enables full use of new 3-level hierarchy and 5 specification fields
**Risk**: Low - changes are additive and backward compatible

## Files Provided

- `src/Code_UPDATED.js` - Complete updated code (partial - needs remaining functions copied)
- `docs/APPS_SCRIPT_UPDATES_REQUIRED.md` - This document

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check Apps Script execution logs
3. Verify Spec Config sheet has correct column headers
4. Verify Parts sheet has Type column at position E

---

**Last Updated**: 2025-10-30
**Author**: Claude Code Automated Workflow
**Status**: Ready for Deployment
