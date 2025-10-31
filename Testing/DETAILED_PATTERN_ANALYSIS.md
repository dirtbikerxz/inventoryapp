# Detailed Pattern Analysis Report

## Purpose
This report provides concrete regex patterns and extraction examples for each category needing fixes.

---

## BEAR (Bearings) - 57 parts

### Extraction Strategy
Bearings require 4 key dimensions for proper selection:

**Target Specs:**
- Spec 1: Inner Diameter (ID)
- Spec 2: Outer Diameter (OD)
- Spec 3: Width (WD)
- Spec 4: Bearing Type

### Regex Patterns
```python
def extract_bearing_specs(part_name: str) -> dict:
    specs = {}

    # Inner Diameter
    id_match = re.search(r'(\d+\.?\d*)"?\s*ID', part_name, re.IGNORECASE)
    if id_match:
        specs['spec1'] = id_match.group(1) + '"'

    # Outer Diameter
    od_match = re.search(r'(\d+\.?\d*)"?\s*OD', part_name, re.IGNORECASE)
    if od_match:
        specs['spec2'] = od_match.group(1) + '"'

    # Width
    wd_match = re.search(r'(\d+\.?\d*)"?\s*WD', part_name, re.IGNORECASE)
    if wd_match:
        specs['spec3'] = wd_match.group(1) + '"'

    # Bearing Type
    type_match = re.search(r'\((.*?[Bb]earing.*?)\)', part_name)
    if type_match:
        specs['spec4'] = type_match.group(1)
    elif 'Bushing' in part_name:
        specs['spec4'] = 'Bushing'

    return specs
```

### Extraction Examples

**Example 1:**
```
Part Name: .375" ID x .500" Hex OD x .313" WD (Bronze Flanged Bushing) (6-Pack)
Extracted Specs:
  - ID: 375"
  - WD: 313"
  - TYPE: Bushing
```

**Example 2:**
```
Part Name: 0.188" ID x 0.500" OD x 0.196" WD (Radial Bearing)
Extracted Specs:
  - ID: 0.188"
  - OD: 0.500"
  - WD: 0.196"
  - TYPE: Radial Bearing
```

**Example 3:**
```
Part Name: 0.250" ID x 0.375" OD x 0.125" WD (Radial Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.375"
  - WD: 0.125"
  - TYPE: Radial Bearing
```

**Example 4:**
```
Part Name: 0.250" ID x 0.500" OD x 0.188" WD (Flanged Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.500"
  - WD: 0.188"
  - TYPE: Flanged Bearing
```

**Example 5:**
```
Part Name: 0.250" ID x 0.500" OD x 0.188" WD (Radial Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.500"
  - WD: 0.188"
  - TYPE: Radial Bearing
```

**Example 6:**
```
Part Name: 0.250" ID x 0.500" OD x 0.313" WD Bronze Bushing (Flanged) (6-Pack)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.500"
  - WD: 0.313"
  - TYPE: Bushing
```

**Example 7:**
```
Part Name: 0.250" ID x 0.625" OD x 0.196" WD (Flanged Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.625"
  - WD: 0.196"
  - TYPE: Flanged Bearing
```

**Example 8:**
```
Part Name: 0.250" ID x 0.625" OD x 0.196" WD (Radial Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.625"
  - WD: 0.196"
  - TYPE: Radial Bearing
```

**Example 9:**
```
Part Name: 0.250" ID x 0.750" OD x 0.282" WD (Radial Bearing)
Extracted Specs:
  - ID: 0.250"
  - OD: 0.750"
  - WD: 0.282"
  - TYPE: Radial Bearing
```

**Example 10:**
```
Part Name: 0.375" Hex ID x 1.125" OD x 0.313" WD (Flanged Bearing)
Extracted Specs:
  - OD: 1.125"
  - WD: 0.313"
  - TYPE: Flanged Bearing
```

---

## WIRE (Wiring) - 24 parts

### Extraction Strategy
Wire specs critical for electrical safety and compatibility:

**Target Specs:**
- Spec 1: Wire Gauge (AWG)
- Spec 2: Length
- Spec 3: Color
- Spec 4: Wire Type (Silicone, Bonded, etc.)

### Regex Patterns
```python
def extract_wire_specs(part_name: str) -> dict:
    specs = {}

    # Wire Gauge
    gauge_match = re.search(r'(\d+)\s*AWG', part_name, re.IGNORECASE)
    if gauge_match:
        specs['spec1'] = gauge_match.group(1) + ' AWG'

    # Length
    length_match = re.search(r'\((\d+\.?\d*)[- ]([Ff]eet|[Ff]t|[Ii]nch|[Ii]n)\)', part_name)
    if length_match:
        specs['spec2'] = length_match.group(1) + ' ' + length_match.group(2).lower()

    # Color
    colors = ['Black', 'Red', 'White', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Gray']
    for color in colors:
        if color in part_name:
            specs['spec3'] = color
            break

    # Wire Type
    if 'Bonded Silicone' in part_name:
        specs['spec4'] = 'Bonded Silicone'
    elif 'Silicone' in part_name:
        specs['spec4'] = 'Silicone'

    return specs
```

### Extraction Examples

**Example 1:**
```
Part Name: 10 AWG Bonded Silicone Wire (25-Feet)
Extracted Specs:
  - gauge: 10 AWG
  - length: 25 feet
  - wire_type: Bonded Silicone
```

**Example 2:**
```
Part Name: 12 AWG Bonded Silicone Wire (25-Feet)
Extracted Specs:
  - gauge: 12 AWG
  - length: 25 feet
  - wire_type: Bonded Silicone
```

**Example 3:**
```
Part Name: 12AWG Black Silicone Wire (25-feet)
Extracted Specs:
  - gauge: 12 AWG
  - length: 25 feet
  - color: Black
  - wire_type: Silicone
```

**Example 4:**
```
Part Name: 12AWG Red Silicone Wire (25-feet)
Extracted Specs:
  - gauge: 12 AWG
  - length: 25 feet
  - color: Red
  - wire_type: Silicone
```

**Example 5:**
```
Part Name: 12AWG White Silicone Wire (25-feet)
Extracted Specs:
  - gauge: 12 AWG
  - length: 25 feet
  - color: White
  - wire_type: Silicone
```

**Example 6:**
```
Part Name: 14 AWG Bonded Silicone Wire (25-Feet)
Extracted Specs:
  - gauge: 14 AWG
  - length: 25 feet
  - wire_type: Bonded Silicone
```

**Example 7:**
```
Part Name: 18 AWG Bonded Silicone Wire (25-Feet)
Extracted Specs:
  - gauge: 18 AWG
  - length: 25 feet
  - wire_type: Bonded Silicone
```

**Example 8:**
```
Part Name: 2 AWG Silicone Battery Wire (Black, 10ft)
Extracted Specs:
  - gauge: 2 AWG
  - color: Black
  - wire_type: Silicone
```

**Example 9:**
```
Part Name: 2 AWG Silicone Battery Wire (Red, 10ft)
Extracted Specs:
  - gauge: 2 AWG
  - color: Red
  - wire_type: Silicone
```

**Example 10:**
```
Part Name: 22 AWG Bonded Silicone Wire (25-Feet)
Extracted Specs:
  - gauge: 22 AWG
  - length: 25 feet
  - wire_type: Bonded Silicone
```

---

## BELT (Belts) - 81 parts

### Current Status
Spec 1 is 100% populated with belt type, but missing tooth count and width.

**Target Specs:**
- Spec 1: Belt Type (HTD 5mm, GT2 3mm) - CURRENTLY POPULATED
- Spec 2: Tooth Count (NEW)
- Spec 3: Width in mm (NEW)
- Spec 4: Features (Double Sided, etc.)

### Regex Patterns
```python
def extract_belt_specs(part_name: str) -> dict:
    specs = {}

    # Belt Type (already working)
    type_match = re.search(r'\((HTD|GT2|GT3)\s*(\d+mm)?\)', part_name, re.IGNORECASE)
    if type_match:
        belt_type = type_match.group(1)
        pitch = type_match.group(2) if type_match.group(2) else ''
        specs['spec1'] = f"{belt_type} {pitch}".strip()

    # Tooth Count (NEW)
    tooth_match = re.search(r'(\d+)t', part_name, re.IGNORECASE)
    if tooth_match:
        specs['spec2'] = tooth_match.group(1)

    # Width (NEW)
    width_match = re.search(r'(\d+)mm\s*[Ww]ide', part_name)
    if width_match:
        specs['spec3'] = width_match.group(1) + 'mm'

    # Features
    if 'Double Sided' in part_name:
        specs['spec4'] = 'Double Sided'

    return specs
```

### Extraction Examples

**Example 1:**
```
Part Name: 100t x 15mm Wide Double Sided Timing Belt (HTD 5mm)
Current Spec 1: HTD 5mm
Proposed Extraction:
  - teeth: 100
  - width: 15mm
  - belt_type: HTD 5mm
  - features: Double Sided
```

**Example 2:**
```
Part Name: 100t x 15mm Wide Timing Belt (HTD 5mm)
Current Spec 1: HTD 5mm
Proposed Extraction:
  - teeth: 100
  - width: 15mm
  - belt_type: HTD 5mm
```

**Example 3:**
```
Part Name: 100t x 9mm Wide Timing Belt (GT2 3mm)
Current Spec 1: GT2 3mm
Proposed Extraction:
  - teeth: 100
  - width: 9mm
  - belt_type: GT2 3mm
```

**Example 4:**
```
Part Name: 104t x 15mm Wide Timing Belt (HTD 5mm)
Current Spec 1: HTD 5mm
Proposed Extraction:
  - teeth: 104
  - width: 15mm
  - belt_type: HTD 5mm
```

**Example 5:**
```
Part Name: 105t x 15mm Wide Timing Belt (HTD 5mm)
Current Spec 1: HTD 5mm
Proposed Extraction:
  - teeth: 105
  - width: 15mm
  - belt_type: HTD 5mm
```

---

## CHAIN (Chain) - 16 parts

### Extraction Strategy
Chain specifications vary by type (roller chain vs. accessories):

**Target Specs:**
- Spec 1: Chain Pitch (#25, #35)
- Spec 2: Length (feet, links) OR Type (for accessories)
- Spec 3: Type (Roller, Nickel plated, etc.)
- Spec 4: Additional features

### Regex Patterns
```python
def extract_chain_specs(part_name: str) -> dict:
    specs = {}

    # Pitch
    pitch_match = re.search(r'#(\d+)', part_name)
    if pitch_match:
        specs['spec1'] = '#' + pitch_match.group(1)

    # Length (for roller chain)
    length_match = re.search(r'(\d+)\s*(feet|ft|links)', part_name, re.IGNORECASE)
    if length_match:
        specs['spec2'] = length_match.group(1) + ' ' + length_match.group(2)

    # Type
    if 'Roller Chain' in part_name:
        specs['spec3'] = 'Roller Chain'
    elif 'Master Link' in part_name:
        specs['spec2'] = 'Master Link'  # For accessories, type goes in spec2
        specs['spec3'] = 'Accessory'
    elif 'Half Link' in part_name:
        specs['spec2'] = 'Half Link'
        specs['spec3'] = 'Accessory'
    elif 'TurnBuckle' in part_name:
        specs['spec2'] = 'TurnBuckle'
        specs['spec3'] = 'Accessory'
    elif 'Breaker' in part_name:
        specs['spec2'] = 'Breaker Pin'
        specs['spec3'] = 'Accessory'

    return specs
```

### Extraction Examples

**Example 1:**
```
Part Name: #25 Chain Breaker Pin Set
Extracted Specs:
  - pitch: #25
  - type: Breaker Pin
```

**Example 2:**
```
Part Name: #25 Chain TurnBuckle
Extracted Specs:
  - pitch: #25
  - type: TurnBuckle
```

**Example 3:**
```
Part Name: #25 Half Link (5 Pack)
Extracted Specs:
  - pitch: #25
  - type: Half Link
```

**Example 4:**
```
Part Name: #25 Master Link (5 Pack)
Extracted Specs:
  - pitch: #25
  - type: Master Link
```

**Example 5:**
```
Part Name: #25 Roller Chain (10 feet)
Extracted Specs:
  - pitch: #25
  - length: 10 feet
  - type: Roller Chain
```

**Example 6:**
```
Part Name: #25/#35 Combo Chain Breaker Tool
Extracted Specs:
  - pitch: #25
  - type: Breaker Pin
```

**Example 7:**
```
Part Name: #25H Half Link (5 Pack)
Extracted Specs:
  - pitch: #25
  - type: Half Link
```

**Example 8:**
```
Part Name: #25H Master Link (5 Pack)
Extracted Specs:
  - pitch: #25
  - type: Master Link
```

**Example 9:**
```
Part Name: #25H Roller Chain (10 Feet)
Extracted Specs:
  - pitch: #25
  - length: 10 Feet
  - type: Roller Chain
```

**Example 10:**
```
Part Name: #35 Chain Breaker Pin Set
Extracted Specs:
  - pitch: #35
  - type: Breaker Pin
```

**Example 11:**
```
Part Name: #35 Chain TurnBuckle V2
Extracted Specs:
  - pitch: #35
  - type: TurnBuckle
```

**Example 12:**
```
Part Name: #35 Half Link (5 Pack)
Extracted Specs:
  - pitch: #35
  - type: Half Link
```

**Example 13:**
```
Part Name: #35 Master Link (5 Pack)
Extracted Specs:
  - pitch: #35
  - type: Master Link
```

**Example 14:**
```
Part Name: #35 Roller Chain (10 feet)
Extracted Specs:
  - pitch: #35
  - length: 10 feet
  - type: Roller Chain
```

**Example 15:**
```
Part Name: Spartan #25 Chain Tensioner
Extracted Specs:
  - pitch: #25
```

**Example 16:**
```
Part Name: Spartan #35 Chain Tensioner
Extracted Specs:
  - pitch: #35
```

---

## GEAR (Gears) - 186 parts

### Issue Found
The "Gears" category appears to contain hex stock, not actual gears!

### Sample Parts Analysis

**Example 1:**
```
Part Name: .375" OD Hex Stock (36")
Current Spec 1: 
Current Spec 3: 
Current Spec 4: 
Note: Hex stock, not a gear
```

**Example 2:**
```
Part Name: .375" OD x .159" ID Rounded Hex Stock (36")
Current Spec 1: 
Current Spec 3: 
Current Spec 4: 
Note: Hex stock, not a gear
```

**Example 3:**
```
Part Name: .500" OD Hex Stock (36")
Current Spec 1: 
Current Spec 3: 
Current Spec 4: 
Note: Hex stock, not a gear
```

**Example 4:**
```
Part Name: .500" OD x .159" ID Rounded Hex Stock (36")
Current Spec 1: 
Current Spec 3: 
Current Spec 4: 
Note: Hex stock, not a gear
```

**Example 5:**
```
Part Name: .505" OD x .159" ID Hex Stock (Oversized 1/2" Hex) (6")
Current Spec 1: 
Current Spec 3: 
Current Spec 4: 
Note: Hex stock, not a gear
```


### Recommendation
1. Verify if these parts should be recategorized to "Structural" or "Raw Stock"
2. Check actual gear parts for proper tooth count and pitch extraction
3. Current extraction may be working for hex stock but labeled incorrectly

---

## Implementation Priority

### Immediate (Day 1)
1. **BEAR** - 0% coverage, 57 parts, critical dimensions
2. **WIRE** - 0% coverage, 24 parts, electrical safety

### Day 2
3. **BELT** - Enhance existing extraction (add tooth count and width)
4. **CHAIN** - 0% coverage, 16 parts, straightforward patterns

### Day 3
5. **GEAR** - Verify category and fix if needed
6. Validate fixes on full dataset

## Testing Commands

After implementing fixes, test with:

```bash
python3 importWCPParts.js --test-category BEAR
python3 importWCPParts.js --test-category WIRE
python3 importWCPParts.js --test-category BELT
python3 importWCPParts.js --test-category CHAIN
```

## Success Metrics

Each category should achieve:
- 90%+ extraction rate on Spec 1 and Spec 2
- No data loss from original part names
- Consistent formatting (units, capitalization)
- Pass manual review of 10 random samples
