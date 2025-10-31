#!/usr/bin/env python3
"""
Detailed pattern analysis for specific categories.
Creates concrete regex patterns based on actual data.
"""

import csv
import re
from typing import Dict, List, Tuple


def analyze_bearings(parts: List[Dict]) -> Dict:
    """Analyze bearing part names to identify extraction patterns."""
    results = {
        'category': 'BEAR',
        'total': len(parts),
        'patterns_found': [],
        'examples': []
    }

    for part in parts[:10]:
        name = part['Part Name']
        specs = {}

        # Extract ID
        id_match = re.search(r'(\d+\.?\d*)"?\s*ID', name, re.IGNORECASE)
        if id_match:
            specs['id'] = id_match.group(1) + '"'

        # Extract OD
        od_match = re.search(r'(\d+\.?\d*)"?\s*OD', name, re.IGNORECASE)
        if od_match:
            specs['od'] = od_match.group(1) + '"'

        # Extract WD (width)
        wd_match = re.search(r'(\d+\.?\d*)"?\s*WD', name, re.IGNORECASE)
        if wd_match:
            specs['wd'] = wd_match.group(1) + '"'

        # Extract type (in parentheses)
        type_match = re.search(r'\((.*?[Bb]earing.*?)\)', name)
        if type_match:
            specs['type'] = type_match.group(1)
        elif 'Bushing' in name:
            specs['type'] = 'Bushing'

        if specs:
            results['examples'].append({
                'name': name,
                'extracted': specs
            })

    return results


def analyze_wiring(parts: List[Dict]) -> Dict:
    """Analyze wiring part names to identify extraction patterns."""
    results = {
        'category': 'WIRE',
        'total': len(parts),
        'patterns_found': [],
        'examples': []
    }

    for part in parts[:10]:
        name = part['Part Name']
        specs = {}

        # Extract gauge
        gauge_match = re.search(r'(\d+)\s*AWG', name, re.IGNORECASE)
        if gauge_match:
            specs['gauge'] = gauge_match.group(1) + ' AWG'

        # Extract length
        length_match = re.search(r'\((\d+\.?\d*)[- ]([Ff]eet|[Ff]t|[Ii]nch|[Ii]n)\)', name)
        if length_match:
            specs['length'] = length_match.group(1) + ' ' + length_match.group(2).lower()

        # Extract color/type
        color_patterns = ['Black', 'Red', 'White', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Gray']
        for color in color_patterns:
            if color in name:
                specs['color'] = color
                break

        # Wire type
        if 'Silicone' in name:
            specs['wire_type'] = 'Silicone'
        if 'Bonded' in name:
            specs['wire_type'] = 'Bonded Silicone'

        if specs:
            results['examples'].append({
                'name': name,
                'extracted': specs
            })

    return results


def analyze_belts(parts: List[Dict]) -> Dict:
    """Analyze belt part names to identify extraction patterns."""
    results = {
        'category': 'BELT',
        'total': len(parts),
        'patterns_found': [],
        'examples': []
    }

    for part in parts[:10]:
        name = part['Part Name']
        specs = {}

        # Extract tooth count
        tooth_match = re.search(r'(\d+)t', name, re.IGNORECASE)
        if tooth_match:
            specs['teeth'] = tooth_match.group(1)

        # Extract width
        width_match = re.search(r'(\d+)mm\s*[Ww]ide', name)
        if width_match:
            specs['width'] = width_match.group(1) + 'mm'

        # Extract belt type
        type_match = re.search(r'\((HTD|GT2|GT3)\s*(\d+mm)?\)', name, re.IGNORECASE)
        if type_match:
            belt_type = type_match.group(1)
            pitch = type_match.group(2) if type_match.group(2) else ''
            specs['belt_type'] = f"{belt_type} {pitch}".strip()

        # Double sided
        if 'Double Sided' in name:
            specs['features'] = 'Double Sided'

        if specs:
            results['examples'].append({
                'name': name,
                'extracted': specs,
                'current_spec1': part.get('Spec 1', '')
            })

    return results


def analyze_gears(parts: List[Dict]) -> Dict:
    """Analyze gear part names - verify current extraction."""
    results = {
        'category': 'GEAR',
        'total': len(parts),
        'patterns_found': [],
        'examples': []
    }

    for part in parts[:10]:
        name = part['Part Name']
        current_specs = {
            'spec1': part.get('Spec 1', ''),
            'spec2': part.get('Spec 2', ''),
            'spec3': part.get('Spec 3', ''),
            'spec4': part.get('Spec 4', '')
        }

        # Check if this is actually hex stock (not a gear)
        is_hex_stock = 'Hex Stock' in name

        results['examples'].append({
            'name': name,
            'current': current_specs,
            'note': 'Hex stock, not a gear' if is_hex_stock else 'Verify extraction'
        })

    return results


def analyze_chain(parts: List[Dict]) -> Dict:
    """Analyze chain part names."""
    results = {
        'category': 'CHAIN',
        'total': len(parts),
        'patterns_found': [],
        'examples': []
    }

    for part in parts:
        name = part['Part Name']
        specs = {}

        # Extract pitch
        pitch_match = re.search(r'#(\d+)', name)
        if pitch_match:
            specs['pitch'] = '#' + pitch_match.group(1)

        # Extract length
        length_match = re.search(r'(\d+)\s*(feet|ft|links)', name, re.IGNORECASE)
        if length_match:
            specs['length'] = length_match.group(1) + ' ' + length_match.group(2)

        # Determine type
        if 'Roller Chain' in name:
            specs['type'] = 'Roller Chain'
        elif 'Master Link' in name:
            specs['type'] = 'Master Link'
        elif 'Half Link' in name:
            specs['type'] = 'Half Link'
        elif 'TurnBuckle' in name:
            specs['type'] = 'TurnBuckle'
        elif 'Breaker' in name:
            specs['type'] = 'Breaker Pin'

        results['examples'].append({
            'name': name,
            'extracted': specs
        })

    return results


def load_category_parts(csv_path: str, category: str) -> List[Dict]:
    """Load all parts for a specific category."""
    parts = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('Category') == category:
                parts.append(row)
    return parts


def generate_detailed_report(analyses: Dict) -> str:
    """Generate detailed markdown report with specific patterns."""

    md = """# Detailed Pattern Analysis Report

## Purpose
This report provides concrete regex patterns and extraction examples for each category needing fixes.

---

"""

    # Bearings
    if 'BEAR' in analyses:
        bear = analyses['BEAR']
        md += f"""## BEAR (Bearings) - {bear['total']} parts

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
    specs = {{}}

    # Inner Diameter
    id_match = re.search(r'(\\d+\\.?\\d*)"?\\s*ID', part_name, re.IGNORECASE)
    if id_match:
        specs['spec1'] = id_match.group(1) + '"'

    # Outer Diameter
    od_match = re.search(r'(\\d+\\.?\\d*)"?\\s*OD', part_name, re.IGNORECASE)
    if od_match:
        specs['spec2'] = od_match.group(1) + '"'

    # Width
    wd_match = re.search(r'(\\d+\\.?\\d*)"?\\s*WD', part_name, re.IGNORECASE)
    if wd_match:
        specs['spec3'] = wd_match.group(1) + '"'

    # Bearing Type
    type_match = re.search(r'\\((.*?[Bb]earing.*?)\\)', part_name)
    if type_match:
        specs['spec4'] = type_match.group(1)
    elif 'Bushing' in part_name:
        specs['spec4'] = 'Bushing'

    return specs
```

### Extraction Examples
"""
        for i, ex in enumerate(bear['examples'], 1):
            md += f"\n**Example {i}:**\n"
            md += f"```\nPart Name: {ex['name']}\n"
            md += "Extracted Specs:\n"
            for key, val in ex['extracted'].items():
                md += f"  - {key.upper()}: {val}\n"
            md += "```\n"

        md += "\n---\n\n"

    # Wiring
    if 'WIRE' in analyses:
        wire = analyses['WIRE']
        md += f"""## WIRE (Wiring) - {wire['total']} parts

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
    specs = {{}}

    # Wire Gauge
    gauge_match = re.search(r'(\\d+)\\s*AWG', part_name, re.IGNORECASE)
    if gauge_match:
        specs['spec1'] = gauge_match.group(1) + ' AWG'

    # Length
    length_match = re.search(r'\\((\\d+\\.?\\d*)[- ]([Ff]eet|[Ff]t|[Ii]nch|[Ii]n)\\)', part_name)
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
"""
        for i, ex in enumerate(wire['examples'], 1):
            md += f"\n**Example {i}:**\n"
            md += f"```\nPart Name: {ex['name']}\n"
            md += "Extracted Specs:\n"
            for key, val in ex['extracted'].items():
                md += f"  - {key}: {val}\n"
            md += "```\n"

        md += "\n---\n\n"

    # Belts
    if 'BELT' in analyses:
        belt = analyses['BELT']
        md += f"""## BELT (Belts) - {belt['total']} parts

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
    specs = {{}}

    # Belt Type (already working)
    type_match = re.search(r'\\((HTD|GT2|GT3)\\s*(\\d+mm)?\\)', part_name, re.IGNORECASE)
    if type_match:
        belt_type = type_match.group(1)
        pitch = type_match.group(2) if type_match.group(2) else ''
        specs['spec1'] = f"{{belt_type}} {{pitch}}".strip()

    # Tooth Count (NEW)
    tooth_match = re.search(r'(\\d+)t', part_name, re.IGNORECASE)
    if tooth_match:
        specs['spec2'] = tooth_match.group(1)

    # Width (NEW)
    width_match = re.search(r'(\\d+)mm\\s*[Ww]ide', part_name)
    if width_match:
        specs['spec3'] = width_match.group(1) + 'mm'

    # Features
    if 'Double Sided' in part_name:
        specs['spec4'] = 'Double Sided'

    return specs
```

### Extraction Examples
"""
        for i, ex in enumerate(belt['examples'][:5], 1):
            md += f"\n**Example {i}:**\n"
            md += f"```\nPart Name: {ex['name']}\n"
            md += f"Current Spec 1: {ex['current_spec1']}\n"
            md += "Proposed Extraction:\n"
            for key, val in ex['extracted'].items():
                md += f"  - {key}: {val}\n"
            md += "```\n"

        md += "\n---\n\n"

    # Chain
    if 'CHAIN' in analyses:
        chain = analyses['CHAIN']
        md += f"""## CHAIN (Chain) - {chain['total']} parts

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
    specs = {{}}

    # Pitch
    pitch_match = re.search(r'#(\\d+)', part_name)
    if pitch_match:
        specs['spec1'] = '#' + pitch_match.group(1)

    # Length (for roller chain)
    length_match = re.search(r'(\\d+)\\s*(feet|ft|links)', part_name, re.IGNORECASE)
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
"""
        for i, ex in enumerate(chain['examples'], 1):
            md += f"\n**Example {i}:**\n"
            md += f"```\nPart Name: {ex['name']}\n"
            md += "Extracted Specs:\n"
            for key, val in ex['extracted'].items():
                md += f"  - {key}: {val}\n"
            md += "```\n"

        md += "\n---\n\n"

    # Gears note
    if 'GEAR' in analyses:
        gear = analyses['GEAR']
        md += f"""## GEAR (Gears) - {gear['total']} parts

### Issue Found
The "Gears" category appears to contain hex stock, not actual gears!

### Sample Parts Analysis
"""
        for i, ex in enumerate(gear['examples'][:5], 1):
            md += f"\n**Example {i}:**\n"
            md += f"```\nPart Name: {ex['name']}\n"
            md += f"Current Spec 1: {ex['current']['spec1']}\n"
            md += f"Current Spec 3: {ex['current']['spec3']}\n"
            md += f"Current Spec 4: {ex['current']['spec4']}\n"
            md += f"Note: {ex['note']}\n"
            md += "```\n"

        md += """

### Recommendation
1. Verify if these parts should be recategorized to "Structural" or "Raw Stock"
2. Check actual gear parts for proper tooth count and pitch extraction
3. Current extraction may be working for hex stock but labeled incorrectly

---

"""

    # Summary
    md += """## Implementation Priority

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
"""

    return md


def main():
    csv_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/Part Directory - Next Attempt.csv'

    print("Loading category-specific data...")

    analyses = {}

    # Analyze Bearings
    print("Analyzing Bearings...")
    bear_parts = load_category_parts(csv_path, 'Bearings')
    if bear_parts:
        analyses['BEAR'] = analyze_bearings(bear_parts)
        print(f"  Found {len(bear_parts)} bearing parts")

    # Analyze Wiring
    print("Analyzing Wiring...")
    wire_parts = load_category_parts(csv_path, 'Wiring')
    if wire_parts:
        analyses['WIRE'] = analyze_wiring(wire_parts)
        print(f"  Found {len(wire_parts)} wiring parts")

    # Analyze Belts
    print("Analyzing Belts...")
    belt_parts = load_category_parts(csv_path, 'Belts')
    if belt_parts:
        analyses['BELT'] = analyze_belts(belt_parts)
        print(f"  Found {len(belt_parts)} belt parts")

    # Analyze Chain
    print("Analyzing Chain...")
    chain_parts = load_category_parts(csv_path, 'Chain')
    if chain_parts:
        analyses['CHAIN'] = analyze_chain(chain_parts)
        print(f"  Found {len(chain_parts)} chain parts")

    # Analyze Gears (verify extraction)
    print("Analyzing Gears...")
    gear_parts = load_category_parts(csv_path, 'Gears')
    if gear_parts:
        analyses['GEAR'] = analyze_gears(gear_parts)
        print(f"  Found {len(gear_parts)} gear parts")

    print("\nGenerating detailed report...")
    report = generate_detailed_report(analyses)

    output_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/DETAILED_PATTERN_ANALYSIS.md'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"Report written to: {output_path}")


if __name__ == '__main__':
    main()
