# Phase 2 Parsing Report
Generated: 2025-10-30 10:25:56

## Summary Statistics

- **Total Lines Read**: 850
- **Total Parts Extracted**: 652
- **Parts Matched to Spec Config**: 652 (100.0%)
- **Parts Unmatched**: 0
- **Duplicate Product Codes**: 24

## Category Distribution

| Category Code | Category Name | Part Count |
|---------------|---------------|------------|
| BELT | Belts | 81 |
| CHAIN | Chain | 17 |
| CTRL | Control System | 14 |
| FAST | Fasteners | 38 |
| GEAR | Gears | 160 |
| HDWR | Hardware | 138 |
| MOTOR | Motors | 48 |
| PULLEY | Pulleys | 36 |
| SHAFT | Shafts & Hubs | 9 |
| SPKT | Sprockets | 51 |
| STOCK | Raw Stock | 8 |
| WHEEL | Wheels & Casters | 52 |

## Sample Parsed Parts (First 5)

### Part 1: #10-32 x .375" L SHCS (Steel, Ultra Low Profile) (2-Pack)

```json
{
  "part_name": "#10-32 x .375\" L SHCS (Steel, Ultra Low Profile) (2-Pack)",
  "product_code": "WCP-0034",
  "price": 3.99,
  "category_code": "FAST",
  "category_name": "Fasteners",
  "subcategory": "Misc Screws",
  "type": "Standard",
  "spec_labels": {
    "spec1": "Thread Size",
    "spec2": "Length",
    "spec3": "Material",
    "spec4": "Finish",
    "spec5": "Pack Size"
  }
}
```

### Part 2: #10-32 x .500" L PHCS (Steel, Black Oxide) (10-Pack)

```json
{
  "part_name": "#10-32 x .500\" L PHCS (Steel, Black Oxide) (10-Pack)",
  "product_code": "WCP-0571",
  "price": 14.99,
  "category_code": "FAST",
  "category_name": "Fasteners",
  "subcategory": "Misc Screws",
  "type": "Standard",
  "spec_labels": {
    "spec1": "Thread Size",
    "spec2": "Length",
    "spec3": "Material",
    "spec4": "Finish",
    "spec5": "Pack Size"
  }
}
```

### Part 3: #10-32 x .250" L PHCS (Steel, Black Oxide) (10-Pack)

```json
{
  "part_name": "#10-32 x .250\" L PHCS (Steel, Black Oxide) (10-Pack)",
  "product_code": "WCP-1740",
  "price": 14.99,
  "category_code": "FAST",
  "category_name": "Fasteners",
  "subcategory": "Misc Screws",
  "type": "Standard",
  "spec_labels": {
    "spec1": "Thread Size",
    "spec2": "Length",
    "spec3": "Material",
    "spec4": "Finish",
    "spec5": "Pack Size"
  }
}
```

### Part 4: #8-32 x 4mm L x 6mm Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack)

```json
{
  "part_name": "#8-32 x 4mm L x 6mm Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack)",
  "product_code": "WCP-0574",
  "price": 3.99,
  "category_code": "FAST",
  "category_name": "Fasteners",
  "subcategory": "Misc Screws",
  "type": "Standard",
  "spec_labels": {
    "spec1": "Thread Size",
    "spec2": "Length",
    "spec3": "Material",
    "spec4": "Finish",
    "spec5": "Pack Size"
  }
}
```

### Part 5: #10-32 x 3/8" L x 1/4" Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack)

```json
{
  "part_name": "#10-32 x 3/8\" L x 1/4\" Round Shoulder Bolt (Steel, Ultra Low Profile) (2-Pack)",
  "product_code": "WCP-0473",
  "price": 3.99,
  "category_code": "FAST",
  "category_name": "Fasteners",
  "subcategory": "Misc Screws",
  "type": "Standard",
  "spec_labels": {
    "spec1": "Thread Size",
    "spec2": "Length",
    "spec3": "Material",
    "spec4": "Finish",
    "spec5": "Pack Size"
  }
}
```

## Warnings and Errors (24 total)

- Duplicate product code: WCP-1142
- Duplicate product code: WCP-1019
- Duplicate product code: WCP-1020
- Duplicate product code: WCP-1178
- Duplicate product code: WCP-1017
- Duplicate product code: WCP-1801
- Duplicate product code: WCP-1802
- Duplicate product code: WCP-1634
- Duplicate product code: WCP-1179
- Duplicate product code: WCP-1018
- Duplicate product code: WCP-1803
- Duplicate product code: WCP-1804
- Duplicate product code: WCP-1805
- Duplicate product code: WCP-1006
- Duplicate product code: WCP-1007
- Duplicate product code: WCP-1008
- Duplicate product code: WCP-1009
- Duplicate product code: WCP-1010
- Duplicate product code: WCP-1011
- Duplicate product code: WCP-1012

... and 4 more warnings

## Validation Results

- Target parts: 658
- Actual parts extracted: 652
- Match status: REVIEW
- All parts have product codes: YES
- All parts have prices: YES
- Duplicate codes found: 24

## Status

**Phase 2 Complete with 0 unmatched parts - Review needed**
