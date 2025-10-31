# Quick Reference Guide - WCP Parts Import

## Current Status

**Total Parts:** 587
**Duplicate Part IDs:** 0
**Spec Coverage:** 82.1%
**Last Import:** 2025-10-29
**Status:** PRODUCTION READY

---

## Part ID Format

All parts now use unique IDs in this format:
```
{CATEGORY_CODE}-{###}
```

Examples:
- `FAST-001` - First fastener (alphabetically)
- `GEAR-186` - Last gear
- `SHAFT-015` - Spacer in shafts category

---

## Category Codes Quick Reference

| Code | Category Name | Count | ID Range |
|------|--------------|-------|----------|
| FAST | Fasteners | 58 | 001-058 |
| GEAR | Gears | 186 | 001-186 |
| SHAFT | Shafts & Hubs | 37 | 001-037 |
| BELT | Belts | 81 | 001-081 |
| SPKT | Sprockets | 53 | 001-053 |
| PULLEY | Pulleys | 46 | 001-046 |
| CHAIN | Chain | 16 | 001-016 |
| BEAR | Bearings | 57 | 001-057 |
| STRUCT | Structural | 16 | 001-016 |
| HDWR | Hardware | 4 | 001-004 |
| CTRL | Control System | 5 | 001-005 |
| SENSOR | Sensors | 1 | 001-001 |
| WIRE | Wiring | 24 | 001-024 |
| ELEC | Electronics | 3 | 001-003 |

---

## Specification Fields by Category

### High Coverage (80-100%)

**FAST (Fasteners) - 98.3%**
- Spec 1: Thread size (#10-32, 1/4"-20, etc.)
- Spec 2: Length (.375", .500", etc.)
- Spec 3: Type (SHCS, PHCS, BHCS, etc.)
- Spec 4: Material + Surface treatment

**GEAR (Gears) - 91.9%**
- Spec 1: Number of teeth
- Spec 2: Diametral pitch (20DP, 32DP)
- Spec 3: Bore type + size
- Spec 4: Material

**SHAFT (Shafts & Hubs) - 100%**
- Spec 1: Width (for spacers) or length
- Spec 2: Inner diameter (ID)
- Spec 3: Outer diameter (OD)
- Spec 4: Material

**STRUCT (Structural) - 93.8%**
- Spec 1: Outer diameter (OD)
- Spec 2: Inner diameter (ID) or shape
- Spec 3: Length
- Spec 4: Material

**PULLEY (Pulleys) - 100%**
- Spec 1: Belt type (HTD, GT2)
- Spec 2: Number of teeth
- Spec 3: Width
- Spec 4: Bore type

**BELT (Belts) - 100%**
- Spec 1: Belt type (HTD, GT2)
- Spec 2: Number of teeth
- Spec 3: Width

**SPKT (Sprockets) - 100%**
- Spec 1: Chain size (#25, #35)
- Spec 2: Number of teeth
- Spec 3: Bore type
- Spec 4: Sprocket type

**HDWR (Hardware) - 100%**
- Spec 1: Dimensions
- Spec 2: Wall thickness
- Spec 3: Thread size (if threaded)
- Spec 4: Material

### Pending (0% - Future Enhancement)
- CHAIN, BEAR, WIRE, SENSOR, CTRL, ELEC

---

## Important Corrections Applied

### 1. Spacers Moved to SHAFT
Previously in GEAR, now correctly in SHAFT:
- All 3/8" OD Aluminum Spacers (23 parts)
- Part IDs: SHAFT-001 through SHAFT-023 (approximately)
- Full specs: Width, ID, OD, Material

### 2. CAN Devices Reclassified
- CANivore: WIRE → SENSOR (SENSOR-001)
- CANcoders: WIRE → CTRL (CTRL-001 to CTRL-003)

---

## How to Find Parts

### By Part ID
Search column A for the Part ID (e.g., FAST-025)

### By Category
1. Filter column A by category code (e.g., "GEAR")
2. Or filter column C by full category name (e.g., "Gears")

### By Product Code
Search column E for WCP code (e.g., WCP-0034)

### By Specification
Filter columns F-I based on specs:
- Thread size for fasteners
- Teeth count for gears/sprockets
- Dimensions for structural

### By Subcategory
Filter column D for WCP subsections:
- "Flanged Bronze Bushings"
- "3/8\" OD Aluminum Spacers"
- "HTD 5mm Pulleys"
- etc.

---

## Column Reference

| Column | Field | Description |
|--------|-------|-------------|
| A | Part ID | Unique identifier (CATEGORY-###) |
| B | Part Name | Full descriptive name |
| C | Category | Full category name |
| D | Subcategory | WCP subsection |
| E | Product Code | WCP part number |
| F | Spec 1 | Category-specific (see above) |
| G | Spec 2 | Category-specific (see above) |
| H | Spec 3 | Category-specific (see above) |
| I | Spec 4 | Category-specific (see above) |
| J | Quantity Per | "Each" or "### Pack" |
| K | Cost | Unit price in USD |
| L | Supplier | Always "WCP" |
| M | Order Link | Direct WCP product page |
| N | Location/Bin | Manual entry (blank) |
| O | Notes | WCP section and subsection |
| P | Status | Active/Inactive |
| Q | Date Added | Import date |
| R | Added By | Import source |

---

## Common Use Cases

### Find all 1/2" hex bore gears
1. Filter column C to "Gears"
2. Search column H for "Hex" and "1/2"

### Find all #25 chain sprockets
1. Filter column C to "Sprockets"
2. Filter column F to "#25"

### Find all aluminum spacers
1. Filter column C to "Shafts & Hubs"
2. Filter column D to "Spacers"
3. Filter column I to "Aluminum"

### Find all fasteners with specific thread size
1. Filter column C to "Fasteners"
2. Filter column F to thread size (e.g., "#10-32")

### Check part availability on WCP
Click the link in column M to go directly to product page

---

## Data Quality

### Verified
- 587 total parts
- 0 duplicate Part IDs
- All 587 URLs valid
- All required fields populated
- Category distribution correct

### Spec Coverage by Category
- Excellent (90-100%): FAST, PULLEY, BELT, SPKT, SHAFT, HDWR
- Good (80-89%): GEAR, STRUCT
- Pending (0%): CHAIN, BEAR, WIRE, SENSOR, CTRL, ELEC

---

## Scripts Available

### Import Scripts
```bash
# Full import (clear and reload all)
npm run final-import

# Check specs (verify spec population)
node setup/checkSpecs.js
```

### Reports
- **Import Report:** `/Testing/final-import-report.json`
- **Summary:** `/Testing/IMPORT_SUCCESS_SUMMARY.md`
- **Execution Log:** `/Testing/EXECUTION_LOG.md`
- **Quick Reference:** `/Testing/QUICK_REFERENCE.md` (this file)

---

## Google Sheets Access

**Spreadsheet ID:** `1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo`
**Sheet Name:** `Parts`
**Direct Link:** [Request from team admin]

---

## Support

### For Issues
1. Check execution log for import details
2. Verify data in Google Sheets
3. Review import report JSON for metrics
4. Contact system administrator

### For Enhancements
Phase 3 planning includes:
- Remaining category spec extraction
- Advanced search features
- Inventory tracking
- Multiple supplier support

---

## Version History

### v2.0 - 2025-10-29 (Current)
- Enhanced spec extraction
- 27 classification corrections
- Zero duplicate Part IDs
- 82.1% spec coverage

### v1.0 - 2025-10-28
- Initial import
- 72.1% spec coverage
- 24 duplicate Part IDs (fixed in v2.0)

---

## Quick Stats

- **Largest Category:** GEAR (186 parts, 31.7%)
- **Smallest Category:** SENSOR (1 part, 0.2%)
- **Most Common Subcategory:** Various gear types
- **Price Range:** $2.49 to $119.99
- **Average Parts per Category:** 42 parts
- **Categories with 100% Specs:** 6 categories

---

## Tips

1. **Part IDs are permanent** - Use these for all references
2. **Product codes** - WCP codes may change, use our Part IDs
3. **Specs** - Focus on high-coverage categories for filtering
4. **Subcategories** - Use for more specific searches
5. **Notes field** - Contains original WCP section info

---

## Need Help?

- Execution issues: Check `/Testing/EXECUTION_LOG.md`
- Data questions: Check `/Testing/IMPORT_SUCCESS_SUMMARY.md`
- Metrics: Check `/Testing/final-import-report.json`
- System info: Check `/docs/WCP_IMPORT_GUIDE.md`

---

**Last Updated:** 2025-10-29
**Status:** Production Ready
**Next Phase:** Enhanced spec extraction for remaining categories
