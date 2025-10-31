# Step 3: SQLite Import Validation Report

**Generated:** 2025-10-30T18:49:30.060Z
**Database:** parts.db

## Summary

- **Total Parts:** 656
- **Total Spec Configs:** 96
- **Total Validation Checks:** 13
- **Passed:** 7
- **Failed:** 6
- **Query Errors:** 0
- **Total Validation Errors:** 222
- **Overall Status:** FAIL
- **Can Proceed to Step 4:** NO

## Validation Checks

### Check 1: Steel parts must have "Steel" in subcategory (unless Standard Chain)

**Status:** FAIL
**Errors Found:** 70

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| #10-32 x .375" L SHCS (Steel, Ultra Low Profile) (2-Pack) | Bolts WCP | Misc Screws |
| #10-32 x .500" L PHCS (Steel, Black Oxide) (10-Pack) | Bolts WCP | Misc Screws |
| #10-32 x .250" L PHCS (Steel, Black Oxide) (10-Pack) | Bolts WCP | Misc Screws |
| #8-32 x 4mm L x 6mm Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack) | Bolts WCP | Ultra Low Profile Shoulder Bolts |
| #10-32 x 3/8" L x 1/4" Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack) | Bolts WCP | Ultra Low Profile Shoulder Bolts |

*... and 65 more errors*

### Check 2: Aluminum parts must have "Aluminum" in subcategory

**Status:** FAIL
**Errors Found:** 110

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| 16t x 9mm Wide Aluminum Pulley (GT2 3mm, 8mm SplineXS Bore) | GT2 Timing Pulleys | SplineXS GT2 Pinions |
| 16t x 15mm Wide Aluminum Pulley (GT2 3mm, 8mm SplineXS Bore) | GT2 Timing Pulleys | SplineXS GT2 Pinions |
| 16t x 15mm Wide Aluminum Pulley (GT2 3mm, 8mm Key Bore) | GT2 Timing Pulleys | 8mm Key Pinions |
| 16t x 9mm Wide Aluminum Pulley (GT2 3mm, Falcon Bore) | GT2 Timing Pulleys | Falcon 500 Motor Pinions |
| 16t x 15mm Wide Aluminum Pulley (GT2 3mm, Falcon Bore) | GT2 Timing Pulleys | Falcon 500 Motor Pinions |

*... and 105 more errors*

### Check 3: #25 chain parts must have "#25" in subcategory or type

**Status:** FAIL
**Errors Found:** 6

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| #25/#35 Combo Chain Breaker Tool | #35 Sprockets | #35 SplineXL Plate Sprockets |
| #25 Chain Breaker Pin Set | #35 Sprockets | Chain Breaker Pin Sets |
| Spartan #25 Chain Tensioner | Roller Chain | Chain Tensioners |
| #25 Chain TurnBuckle | Roller Chain | Chain Tensioners |
| 10t Steel Double Hub Sprocket (#25 Chain, 8mm SplineXS Bore) | Kraken Motors | Motor Pinions |

*... and 1 more errors*

### Check 4: #35 chain parts must have "#35" in subcategory or type

**Status:** FAIL
**Errors Found:** 2

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| Spartan #35 Chain Tensioner | Roller Chain | Chain Tensioners |
| #35 Chain TurnBuckle V2 | Roller Chain | Chain Tensioners |

### Check 5: 1/2" hex bore parts must have "1/2" in type

**Status:** FAIL
**Errors Found:** 28

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| 24t x 9mm Wide Aluminum Pulley (GT2 3mm, 1/2" Hex Bore) | GT2 Timing Pulleys | RS/BAG Motor Pinions |
| 36t x 9mm Wide Aluminum Pulley (GT2 3mm, 1/2" Hex Bore) | GT2 Timing Pulleys | RS/BAG Motor Pinions |
| 48t x 9mm Wide Aluminum Pulley (GT2 3mm, 1/2" Hex Bore) | GT2 Timing Pulleys | RS/BAG Motor Pinions |
| 60t x 9mm Wide Aluminum Pulley (GT2 3mm, 1/2" Hex Bore) | GT2 Timing Pulleys | RS/BAG Motor Pinions |
| 15t x 9mm Wide Aluminum Pulley (HTD 5mm, 1/2" Hex Bore) | HTD Timing Pulleys | HTD Timing Pulleys (9mm Wide) |

*... and 23 more errors*

### Check 6: 3/8" hex bore parts must have "3/8" in type

**Status:** PASS
**Result:** No validation errors found

### Check 7: All parts must reference valid spec config

**Status:** PASS
**Result:** No validation errors found

### Check 8: No parts should have empty category/subcategory/type

**Status:** PASS
**Result:** No validation errors found

### Check 9: 30A durometer wheels must have "30A" in type

**Status:** PASS
**Result:** No validation errors found

### Check 10: 45A durometer wheels must have "45A" in type

**Status:** PASS
**Result:** No validation errors found

### Check 11: 60A durometer wheels must have "60A" in type

**Status:** PASS
**Result:** No validation errors found

### Check 12: Flanged bearings must have "Flanged" in type

**Status:** FAIL
**Errors Found:** 6

**Examples:**

| Part Name | Subcategory | Type |
|-----------|-------------|------|
| 10.25mm (3/8" Rounded Hex) ID x 0.875" OD x 0.280" WD (Flanged Bearing) | Ball Bearings | Rounded Hex Bearings |
| 13.75mm (1/2" Rounded Hex) ID x 1.125" OD x 0.313" WD (Flanged Bearing) | Ball Bearings | Rounded Hex Bearings |
| 8mm ID x 16mm OD x 5mm WD (Flanged Bearing) | Ball Bearings | Metric Bearings |
| 12mm ID x 24mm OD x 6mm WD (Flanged Bearing) | Ball Bearings | Metric Bearings |
| 30mm ID x 42mm OD x 7mm WD (Flanged Bearing) | Ball Bearings | Metric Bearings |

*... and 1 more errors*

### Check 13: X-Contact bearings must have "X-Contact" in type

**Status:** PASS
**Result:** No validation errors found

## Data Quality Assessment

Validation failures detected. Issues found:

- **Steel parts must have "Steel" in subcategory (unless Standard Chain)**: 70 error(s)
- **Aluminum parts must have "Aluminum" in subcategory**: 110 error(s)
- **#25 chain parts must have "#25" in subcategory or type**: 6 error(s)
- **#35 chain parts must have "#35" in subcategory or type**: 2 error(s)
- **1/2" hex bore parts must have "1/2" in type**: 28 error(s)
- **Flanged bearings must have "Flanged" in type**: 6 error(s)

### Recommendations

1. Review the validation errors above
2. Update the type inference logic in 02-parseAndLoad.js
3. Re-run Step 2 to reload the data with fixes
4. Re-run Step 3 to verify all validations pass

**Do not proceed to Step 4 until all validations pass.**

## Next Steps

Fix validation errors before proceeding:

1. Review error examples above
2. Update parser logic in `setup/sqliteImport/02-parseAndLoad.js`
3. Re-run: `node setup/sqliteImport/02-parseAndLoad.js`
4. Re-validate: `node setup/sqliteImport/03-runValidation.js`
