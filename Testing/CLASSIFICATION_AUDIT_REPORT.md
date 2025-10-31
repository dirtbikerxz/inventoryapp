# Comprehensive Classification Audit Report
**Generated**: 2025-10-29 12:51:07
**Data Source**: Part Directory - Next Attempt.csv

## Executive Summary
- **Total parts audited**: 587
- **Correctly classified**: 503 (85.7%)
- **Misclassified**: 84 (14.3%)
- **Verification needed**: 0

## Known Issues Verification

User-reported misclassifications:

- **GEAR-120** (WCP-1513): CONFIRMED - Gears → MACH | 4mm Single Flute Carbide Endmill (12mm Cut Length, DLC Coated)
- **GEAR-119** (WCP-1571): CONFIRMED - Gears → MACH | 4mm ER20 CNC Router Collet

CANcoder/CANrange sensor verification:

- **WIRE-018** (WCP-1484): Wiring → SENSOR | CTR CANcoder
- **WIRE-019** (WCP-1485): Wiring → SENSOR | CTR CANcoder (Pre-Wired)
- **WIRE-023** (WCP-1699): Wiring → SENSOR | CTR CANrange
- **WIRE-024** (WCP-1655): Wiring → SENSOR | WCP ThroughBore Powered by CANcoder (1/2" Hex)

## Critical Misclassifications Found

### Shafts & Hubs → HDWR
**Total**: 37 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| SHAFT-001 | WCP-0205 | 1-1/2" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-002 | WCP-0222 | 1-1/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-003 | WCP-0226 | 1-1/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-004 | WCP-0206 | 1-3/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-005 | WCP-0388 | 1-3/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-006 | WCP-0387 | 1-7/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-007 | WCP-0204 | 1" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-008 | WCP-0791 | 1" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (6-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-009 | WCP-0960 | 1" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (6-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-010 | WCP-0787 | 1/16" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-011 | WCP-0956 | 1/16" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-012 | WCP-1403 | 1/16" WD x 5/8" OD x 8mm SplineXS ID Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-013 | WCP-0202 | 1/2" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-014 | WCP-0790 | 1/2" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-015 | WCP-0959 | 1/2" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-016 | WCP-0786 | 1/32" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-017 | WCP-0955 | 1/32" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-018 | WCP-0308 | 1/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-019 | WCP-0789 | 1/4" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-020 | WCP-0958 | 1/4" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-021 | WCP-1405 | 1/4" WD x 5/8" OD x 8mm SplineXS ID Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-022 | WCP-0307 | 1/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-023 | WCP-0788 | 1/8" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-024 | WCP-0957 | 1/8" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-025 | WCP-1404 | 1/8" WD x 5/8" OD x 8mm SplineXS ID Spacer (10-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-026 | WCP-0208 | 2-1/2" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-027 | WCP-0310 | 2-1/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-028 | WCP-0311 | 2-3/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-029 | WCP-0566 | 2" WD x .196" ID x 1/2" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-030 | WCP-0207 | 2" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-031 | WCP-0792 | 2" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (6-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-032 | WCP-0961 | 2" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (6-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-033 | WCP-0209 | 3" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-034 | WCP-0217 | 3/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-035 | WCP-0309 | 3/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-036 | WCP-0203 | 5/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |
| SHAFT-037 | WCP-0329 | 7/16" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack) | Matches pattern: spacer(?!.*kit) |

### Wiring → WIRE
**Total**: 17 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| WIRE-001 | WCP-1540 | 10 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-002 | WCP-0277 | 12 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-003 | WCP-1243 | 12AWG Black Silicone Wire (25-feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-004 | WCP-1242 | 12AWG Red Silicone Wire (25-feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-005 | WCP-1244 | 12AWG White Silicone Wire (25-feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-006 | WCP-0278 | 14 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-007 | WCP-0279 | 18 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-008 | WCP-1233 | 2 AWG Silicone Battery Wire (Black, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-009 | WCP-1232 | 2 AWG Silicone Battery Wire (Red, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-010 | WCP-1848 | 22 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-011 | WCP-1153 | 22AWG Black Jacketed CAN Wire (25ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-012 | WCP-1152 | 22AWG CAN Wire (25-feet) | Matches pattern: wire(?!.*wheel) |
| WIRE-013 | WCP-1117 | 4 AWG Silicone Battery Wire (Black, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-014 | WCP-1116 | 4 AWG Silicone Battery Wire (Red, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-015 | WCP-1120 | 6 AWG Silicone Battery Wire (Black, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-016 | WCP-1119 | 6 AWG Silicone Battery Wire (Red, 10ft) | Matches pattern: wire(?!.*wheel) |
| WIRE-017 | WCP-1539 | 8 AWG Bonded Silicone Wire (25-Feet) | Matches pattern: wire(?!.*wheel) |

### Structural → STOCK
**Total**: 10 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| STRUCT-001 | WCP-0910 | .375" OD x .196" ID Aluminum Round Tube Stock (36") | Matches pattern: tube\s*stock |
| STRUCT-002 | WCP-0913 | .500" OD x .196" ID Aluminum Round Tube Stock (36") | Matches pattern: tube\s*stock |
| STRUCT-004 | WCP-1142 | .75" OD x .500" Hex ID Aluminum Round Tube Stock (36") | Matches pattern: tube\s*stock |
| STRUCT-005 | WCP-1142 | .75" OD x .500" Hex ID Aluminum Round Tube Stock (36") | Matches pattern: tube\s*stock |
| STRUCT-007 | WCP-1269 | 0.75" OD x .625" ID Aluminum Round Tube Stock (47") | Matches pattern: tube\s*stock |
| STRUCT-009 | WCP-1271 | 1.25" OD x 1.125" ID Aluminum Round Tube Stock (47") | Matches pattern: tube\s*stock |
| STRUCT-011 | WCP-1270 | 1" OD x .875" ID Aluminum Round Tube Stock (47") | Matches pattern: tube\s*stock |
| STRUCT-012 | WCP-1253 | 1" x 1" x 1mm Carbon Fiber Tube Stock (47") | Matches pattern: tube\s*stock |
| STRUCT-015 | WCP-1254 | 2" x 1" x 1mm Carbon Fiber Tube Stock (47") | Matches pattern: tube\s*stock |
| STRUCT-016 | WCP-0918 | SplineXL Tube Stock (47" L, 1" Bore) | Matches pattern: tube\s*stock |

### Gears → STOCK
**Total**: 5 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| GEAR-001 | WCP-0912 | .375" OD Hex Stock (36") | Matches pattern: hex\s*stock |
| GEAR-002 | WCP-0911 | .375" OD x .159" ID Rounded Hex Stock (36") | Matches pattern: hex\s*stock |
| GEAR-003 | WCP-0915 | .500" OD Hex Stock (36") | Matches pattern: hex\s*stock |
| GEAR-004 | WCP-0914 | .500" OD x .159" ID Rounded Hex Stock (36") | Matches pattern: hex\s*stock |
| GEAR-005 | WCP-2143 | .505" OD x .159" ID Hex Stock (Oversized 1/2" Hex) (6") | Matches pattern: hex\s*stock |

### Gears → HDWR
**Total**: 4 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| GEAR-006 | WCP-0369 | .625" ID Bi Directional Energy Chain (3ft Length) | Matches pattern: energy\s*chain |
| GEAR-008 | WCP-0370 | 1" ID Bi Directional Energy Chain (3ft Length) | Matches pattern: energy\s*chain |
| GEAR-036 | WCP-0157 | 15mm x 30mm, Semi-Enclosed Energy Chain (1 meter length) | Matches pattern: energy\s*chain |
| GEAR-037 | WCP-0159 | 15mm x 45mm, Semi-Enclosed Energy Chain (1 meter length) | Matches pattern: energy\s*chain |

### Hardware → HDWR
**Total**: 4 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| HDWR-001 | WCP-0375 | 1.5"x1.5"x.125" Aluminum Tube Plug (#10-32 Tapped) | Matches pattern: tube\s*plug |
| HDWR-002 | WCP-0376 | 1"x1"x.125" Aluminum Tube Plug (#10-32 Tapped) | Matches pattern: tube\s*plug |
| HDWR-003 | WCP-2067 | 2"x1"x.125" Aluminum Tube Plug (#10-32 Tapped) | Matches pattern: tube\s*plug |
| HDWR-004 | WCP-2107 | 2"x2"x.125" Aluminum Tube Plug (#10-32 Tapped) | Matches pattern: tube\s*plug |

### Wiring → SENSOR
**Total**: 4 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| WIRE-018 | WCP-1484 | CTR CANcoder | Matches pattern: CANcoder/CANrange sensors |
| WIRE-019 | WCP-1485 | CTR CANcoder (Pre-Wired) | Matches pattern: CANcoder/CANrange sensors |
| WIRE-023 | WCP-1699 | CTR CANrange | Matches pattern: CANcoder/CANrange sensors |
| WIRE-024 | WCP-1655 | WCP ThroughBore Powered by CANcoder (1/2" Hex) | Matches pattern: CANcoder/CANrange sensors |

### Gears → MACH
**Total**: 2 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| GEAR-119 | WCP-1571 | 4mm ER20 CNC Router Collet | Matches pattern: collet |
| GEAR-120 | WCP-1513 | 4mm Single Flute Carbide Endmill (12mm Cut Length, DLC Coated) | Matches pattern: endmill|end mill |

### Sensors → SENSOR
**Total**: 1 parts

| Part ID | Product Code | Part Name | Reason |
|---------|--------------|-----------|--------|
| SENSOR-001 | WCP-1370 | CTR SRX Mag Encoder | Matches pattern: encoder(?!.*collet) |

## Reclassification Plan

### Changes Required:
- **Shafts & Hubs → HDWR**: 37 parts
- **Wiring → WIRE**: 17 parts
- **Structural → STOCK**: 10 parts
- **Gears → STOCK**: 5 parts
- **Gears → HDWR**: 4 parts
- **Hardware → HDWR**: 4 parts
- **Wiring → SENSOR**: 4 parts
- **Gears → MACH**: 2 parts
- **Sensors → SENSOR**: 1 parts

### Current Category Counts:
- **Bearings**: 57
- **Belts**: 81
- **Chain**: 16
- **Control System**: 5
- **Electronics**: 3
- **Fasteners**: 58
- **Gears**: 186
- **Hardware**: 4
- **Pulleys**: 46
- **Sensors**: 1
- **Shafts & Hubs**: 37
- **Sprockets**: 53
- **Structural**: 16
- **Wiring**: 24

### Post-Correction Category Counts:
- **Bearings**: 57
- **Belts**: 81
- **Chain**: 16
- **Control System**: 5
- **Electronics**: 3
- **Fasteners**: 58
- **Gears**: 175 (-11)
- **HDWR**: 45 (+45)
- **MACH**: 2 (+2)
- **Pulleys**: 46
- **SENSOR**: 5 (+5)
- **STOCK**: 15 (+15)
- **Sprockets**: 53
- **Structural**: 6 (-10)
- **WIRE**: 17 (+17)
- **Wiring**: 3 (-21)

## Validation Checklist

For each reclassification:
- [ ] Part name clearly indicates correct category
- [ ] No ambiguous classifications
- [ ] Category codes updated
- [ ] Part IDs regenerated with new category prefixes

## Recommended Next Steps

1. Review reclassifications.json file
2. Apply all reclassifications to CSV
3. Regenerate Part IDs (MACH-001, STOCK-017, etc.)
4. Extract specs for newly populated categories
5. Re-import to Google Sheets
6. Verify with spot checks

## Sample Reclassifications for Quick Review

### Shafts & Hubs → HDWR (showing first 10):
- **SHAFT-001** (WCP-0205): 1-1/2" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-002** (WCP-0222): 1-1/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-003** (WCP-0226): 1-1/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-004** (WCP-0206): 1-3/4" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-005** (WCP-0388): 1-3/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-006** (WCP-0387): 1-7/8" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-007** (WCP-0204): 1" WD x .196" ID x 3/8" OD Aluminum Spacers (5-Pack)
- **SHAFT-008** (WCP-0791): 1" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (6-Pack)
- **SHAFT-009** (WCP-0960): 1" WD x 3/8" Hex ID x 5/8" OD Plastic Spacer (6-Pack)
- **SHAFT-010** (WCP-0787): 1/16" WD x 1/2" Hex ID x 3/4" OD Plastic Spacer (10-Pack)

### Wiring → WIRE (showing first 10):
- **WIRE-001** (WCP-1540): 10 AWG Bonded Silicone Wire (25-Feet)
- **WIRE-002** (WCP-0277): 12 AWG Bonded Silicone Wire (25-Feet)
- **WIRE-003** (WCP-1243): 12AWG Black Silicone Wire (25-feet)
- **WIRE-004** (WCP-1242): 12AWG Red Silicone Wire (25-feet)
- **WIRE-005** (WCP-1244): 12AWG White Silicone Wire (25-feet)
- **WIRE-006** (WCP-0278): 14 AWG Bonded Silicone Wire (25-Feet)
- **WIRE-007** (WCP-0279): 18 AWG Bonded Silicone Wire (25-Feet)
- **WIRE-008** (WCP-1233): 2 AWG Silicone Battery Wire (Black, 10ft)
- **WIRE-009** (WCP-1232): 2 AWG Silicone Battery Wire (Red, 10ft)
- **WIRE-010** (WCP-1848): 22 AWG Bonded Silicone Wire (25-Feet)

### Structural → STOCK (showing first 10):
- **STRUCT-001** (WCP-0910): .375" OD x .196" ID Aluminum Round Tube Stock (36")
- **STRUCT-002** (WCP-0913): .500" OD x .196" ID Aluminum Round Tube Stock (36")
- **STRUCT-004** (WCP-1142): .75" OD x .500" Hex ID Aluminum Round Tube Stock (36")
- **STRUCT-005** (WCP-1142): .75" OD x .500" Hex ID Aluminum Round Tube Stock (36")
- **STRUCT-007** (WCP-1269): 0.75" OD x .625" ID Aluminum Round Tube Stock (47")
- **STRUCT-009** (WCP-1271): 1.25" OD x 1.125" ID Aluminum Round Tube Stock (47")
- **STRUCT-011** (WCP-1270): 1" OD x .875" ID Aluminum Round Tube Stock (47")
- **STRUCT-012** (WCP-1253): 1" x 1" x 1mm Carbon Fiber Tube Stock (47")
- **STRUCT-015** (WCP-1254): 2" x 1" x 1mm Carbon Fiber Tube Stock (47")
- **STRUCT-016** (WCP-0918): SplineXL Tube Stock (47" L, 1" Bore)

