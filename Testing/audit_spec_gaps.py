#!/usr/bin/env python3
"""
Comprehensive spec gap audit for WCP parts CSV.
Analyzes each category for spec extraction completeness.
"""

import pandas as pd
import re
from typing import Dict, List, Tuple
from collections import defaultdict


def analyze_category_specs(df: pd.DataFrame, category: str) -> Dict:
    """Analyze spec population for a specific category."""
    cat_data = df[df['Category'] == category].copy()
    total = len(cat_data)

    if total == 0:
        return None

    # Count populated specs (non-empty, non-null)
    spec1_count = cat_data['Spec 1'].notna().sum() and cat_data['Spec 1'].astype(str).str.strip().ne('').sum() or 0
    spec2_count = cat_data['Spec 2'].notna().sum() and cat_data['Spec 2'].astype(str).str.strip().ne('').sum() or 0
    spec3_count = cat_data['Spec 3'].notna().sum() and cat_data['Spec 3'].astype(str).str.strip().ne('').sum() or 0
    spec4_count = cat_data['Spec 4'].notna().sum() and cat_data['Spec 4'].astype(str).str.strip().ne('').sum() or 0

    # Get sample part names
    samples = cat_data['Part Name'].head(10).tolist()

    # Get examples of populated specs
    populated_examples = []
    for idx, row in cat_data.head(5).iterrows():
        if row['Spec 1'] or row['Spec 2'] or row['Spec 3'] or row['Spec 4']:
            populated_examples.append({
                'product_code': row['Product Code'],
                'name': row['Part Name'],
                'spec1': row['Spec 1'],
                'spec2': row['Spec 2'],
                'spec3': row['Spec 3'],
                'spec4': row['Spec 4']
            })

    return {
        'total': total,
        'spec1_count': spec1_count,
        'spec2_count': spec2_count,
        'spec3_count': spec3_count,
        'spec4_count': spec4_count,
        'spec1_pct': (spec1_count / total * 100) if total > 0 else 0,
        'spec2_pct': (spec2_count / total * 100) if total > 0 else 0,
        'spec3_pct': (spec3_count / total * 100) if total > 0 else 0,
        'spec4_pct': (spec4_count / total * 100) if total > 0 else 0,
        'samples': samples,
        'populated_examples': populated_examples
    }


def extract_bearing_patterns(part_name: str) -> Dict[str, str]:
    """Extract bearing specifications from part name."""
    patterns = {
        'id': r'(\d+\.?\d*)"?\s*ID',
        'od': r'(\d+\.?\d*)"?\s*OD',
        'wd': r'(\d+\.?\d*)"?\s*WD',
        'type': r'\((.*?[Bb]earing.*?)\)'
    }

    result = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, part_name, re.IGNORECASE)
        if match:
            result[key] = match.group(1)

    return result


def extract_belt_patterns(part_name: str) -> Dict[str, str]:
    """Extract belt specifications from part name."""
    result = {}

    # Belt type (HTD, GT2, etc.)
    type_match = re.search(r'(HTD|GT2|GT3)', part_name, re.IGNORECASE)
    if type_match:
        result['type'] = type_match.group(1)

    # Tooth count
    tooth_match = re.search(r'(\d+)\s*[Tt]ooth', part_name)
    if tooth_match:
        result['teeth'] = tooth_match.group(1)

    # Width
    width_match = re.search(r'(\d+\.?\d*)\s*mm\s*[Ww]ide', part_name)
    if width_match:
        result['width'] = f"{width_match.group(1)}mm"

    # Length/pitch
    pitch_match = re.search(r'(\d+)\s*mm\s*[Pp]itch', part_name)
    if pitch_match:
        result['pitch'] = f"{pitch_match.group(1)}mm"

    return result


def extract_gear_patterns(part_name: str) -> Dict[str, str]:
    """Extract gear specifications from part name."""
    result = {}

    # Tooth count
    tooth_match = re.search(r'(\d+)\s*[Tt]ooth', part_name)
    if tooth_match:
        result['teeth'] = tooth_match.group(1)

    # Pitch
    pitch_match = re.search(r'(\d+)\s*[Pp]itch', part_name)
    if pitch_match:
        result['pitch'] = pitch_match.group(1)

    # Bore size
    bore_match = re.search(r'(\d+\.?\d*)"?\s*[Bb]ore', part_name)
    if bore_match:
        result['bore'] = f"{bore_match.group(1)}\""

    # Diameter
    dia_match = re.search(r'(\d+\.?\d*)"?\s*[Dd]iameter', part_name)
    if dia_match:
        result['diameter'] = f"{dia_match.group(1)}\""

    return result


def extract_wire_patterns(part_name: str) -> Dict[str, str]:
    """Extract wire specifications from part name."""
    result = {}

    # Gauge
    gauge_match = re.search(r'(\d+)\s*AWG', part_name, re.IGNORECASE)
    if gauge_match:
        result['gauge'] = f"{gauge_match.group(1)} AWG"

    # Length
    length_match = re.search(r'(\d+\.?\d*)\s*(ft|inch|in|\'|")', part_name, re.IGNORECASE)
    if length_match:
        result['length'] = f"{length_match.group(1)} {length_match.group(2)}"

    # Type/color
    color_match = re.search(r'\((.*?)\)', part_name)
    if color_match:
        result['type'] = color_match.group(1)

    return result


def extract_shaft_patterns(part_name: str) -> Dict[str, str]:
    """Extract shaft specifications from part name."""
    result = {}

    # Diameter
    dia_match = re.search(r'(\d+\.?\d*)"?\s*(?:Diameter|dia|D)', part_name, re.IGNORECASE)
    if dia_match:
        result['diameter'] = f"{dia_match.group(1)}\""

    # Length
    length_match = re.search(r'(\d+\.?\d*)"?\s*(?:[Ll]ong|[Ll]ength)', part_name)
    if length_match:
        result['length'] = f"{length_match.group(1)}\""

    # Type
    type_match = re.search(r'(Hex|Round|Keyed|Threaded)', part_name, re.IGNORECASE)
    if type_match:
        result['type'] = type_match.group(1)

    return result


def generate_markdown_report(df: pd.DataFrame, category_stats: Dict) -> str:
    """Generate comprehensive markdown audit report."""

    total_parts = len(df)
    categories_complete = sum(1 for stats in category_stats.values()
                             if stats and min(stats['spec1_pct'], stats['spec2_pct']) >= 90)
    categories_needing_fixes = len(category_stats) - categories_complete

    # Calculate total missing specs
    total_missing = 0
    for stats in category_stats.values():
        if stats:
            total_missing += (stats['total'] * 4) - (stats['spec1_count'] + stats['spec2_count'] +
                                                      stats['spec3_count'] + stats['spec4_count'])

    md = f"""# Spec Gap Audit Report

## Executive Summary
- Total parts audited: {total_parts}
- Total categories: {len(category_stats)}
- Categories with complete specs (>=90% on Spec 1&2): {categories_complete}
- Categories needing fixes: {categories_needing_fixes}
- Total spec fields missing: {total_missing}

## Category Analysis

"""

    # Sort categories by priority (lowest spec coverage first)
    sorted_categories = sorted(category_stats.items(),
                              key=lambda x: (x[1]['spec1_pct'] + x[1]['spec2_pct']) / 2 if x[1] else 0)

    for category, stats in sorted_categories:
        if not stats:
            continue

        cat_name = get_category_name(category)
        md += f"""### {category} ({cat_name}) - {stats['total']} parts

**Spec Population:**
- Spec 1: {stats['spec1_pct']:.1f}% ({stats['spec1_count']}/{stats['total']})
- Spec 2: {stats['spec2_pct']:.1f}% ({stats['spec2_count']}/{stats['total']})
- Spec 3: {stats['spec3_pct']:.1f}% ({stats['spec3_count']}/{stats['total']})
- Spec 4: {stats['spec4_pct']:.1f}% ({stats['spec4_count']}/{stats['total']})

**Sample Part Names:**
"""
        for i, sample in enumerate(stats['samples'][:5], 1):
            md += f"{i}. {sample}\n"

        # Show current extraction examples if any
        if stats['populated_examples']:
            md += "\n**Current Extraction Examples:**\n"
            for ex in stats['populated_examples'][:3]:
                md += f"\n{ex['product_code']}: \"{ex['name']}\"\n"
                if pd.notna(ex['spec1']) and str(ex['spec1']).strip():
                    md += f"  - Spec 1: {ex['spec1']}\n"
                if pd.notna(ex['spec2']) and str(ex['spec2']).strip():
                    md += f"  - Spec 2: {ex['spec2']}\n"
                if pd.notna(ex['spec3']) and str(ex['spec3']).strip():
                    md += f"  - Spec 3: {ex['spec3']}\n"
                if pd.notna(ex['spec4']) and str(ex['spec4']).strip():
                    md += f"  - Spec 4: {ex['spec4']}\n"

        # Analyze patterns and suggest extraction
        md += "\n**Pattern Analysis:**\n"
        md += analyze_patterns_for_category(category, stats['samples'])

        md += "\n---\n\n"

    # Summary section
    md += generate_fix_summary(category_stats)

    return md


def get_category_name(code: str) -> str:
    """Get full category name from code."""
    names = {
        'BEAR': 'Bearings',
        'BELT': 'Belts',
        'CHAIN': 'Chain',
        'CTRL': 'Control System',
        'ELEC': 'Electronics',
        'FAST': 'Fasteners',
        'GEAR': 'Gears',
        'HDWR': 'Hardware',
        'PULLEY': 'Pulleys',
        'SENSOR': 'Sensors',
        'SHAFT': 'Shafts & Hubs',
        'SPKT': 'Sprockets',
        'STRUCT': 'Structural',
        'WIRE': 'Wiring'
    }
    return names.get(code, code)


def analyze_patterns_for_category(category: str, samples: List[str]) -> str:
    """Analyze part name patterns and suggest extraction logic."""

    if category == 'BEAR':
        return """
Contains: Inner Diameter (ID), Outer Diameter (OD), Width (WD), Bearing Type

**Required Extraction:**
- Spec 1: Inner Diameter - e.g., "0.250\\""
- Spec 2: Outer Diameter - e.g., "0.500\\""
- Spec 3: Width - e.g., "0.188\\""
- Spec 4: Bearing Type - e.g., "Flanged Bearing"

**Regex Patterns:**
```python
id_pattern = r'(\\d+\\.?\\d*)"?\\s*ID'
od_pattern = r'(\\d+\\.?\\d*)"?\\s*OD'
wd_pattern = r'(\\d+\\.?\\d*)"?\\s*WD'
type_pattern = r'\\((.*?[Bb]earing.*?)\\)'
```

**Priority:** HIGH - 0% coverage
"""

    elif category == 'BELT':
        return """
Contains: Belt Type (HTD/GT2), Tooth Count, Width, Pitch

**Required Extraction:**
- Spec 1: Belt Type - e.g., "HTD", "GT2"
- Spec 2: Tooth Count - e.g., "180", "225"
- Spec 3: Width - e.g., "15mm"
- Spec 4: Pitch - e.g., "5mm"

**Regex Patterns:**
```python
type_pattern = r'(HTD|GT2|GT3)'
tooth_pattern = r'(\\d+)\\s*[Tt]ooth'
width_pattern = r'(\\d+\\.?\\d*)\\s*mm\\s*[Ww]ide'
pitch_pattern = r'(\\d+)\\s*mm\\s*[Pp]itch'
```

**Priority:** HIGH - Partial extraction needs improvement
"""

    elif category == 'GEAR':
        return """
Contains: Tooth Count, Pitch, Bore Size, Diameter

**Required Extraction:**
- Spec 1: Tooth Count - e.g., "20", "48"
- Spec 2: Pitch - e.g., "20", "32"
- Spec 3: Bore Size - e.g., "0.500\\""
- Spec 4: Diameter - e.g., "1.125\\""

**Regex Patterns:**
```python
tooth_pattern = r'(\\d+)\\s*[Tt]ooth'
pitch_pattern = r'(\\d+)\\s*[Pp]itch'
bore_pattern = r'(\\d+\\.?\\d*)"?\\s*[Bb]ore'
dia_pattern = r'(\\d+\\.?\\d*)"?\\s*[Dd]iameter'
```

**Priority:** MEDIUM - Check current extraction quality
"""

    elif category == 'WIRE':
        return """
Contains: Wire Gauge (AWG), Length, Color/Type

**Required Extraction:**
- Spec 1: Gauge - e.g., "18 AWG", "22 AWG"
- Spec 2: Length - e.g., "25 ft", "6 in"
- Spec 3: Color/Type - e.g., "Red", "Black"
- Spec 4: Additional info

**Regex Patterns:**
```python
gauge_pattern = r'(\\d+)\\s*AWG'
length_pattern = r'(\\d+\\.?\\d*)\\s*(ft|inch|in|\\'|")'
type_pattern = r'\\((.*?)\\)'
```

**Priority:** HIGH - 0% coverage on critical specs
"""

    elif category == 'SHAFT':
        return """
Contains: Diameter, Length, Shaft Type

**Required Extraction:**
- Spec 1: Diameter - e.g., "0.500\\""
- Spec 2: Length - e.g., "12.0\\""
- Spec 3: Type - e.g., "Hex", "Round", "Keyed"
- Spec 4: Material/Additional

**Regex Patterns:**
```python
dia_pattern = r'(\\d+\\.?\\d*)"?\\s*(?:Diameter|dia|D)'
length_pattern = r'(\\d+\\.?\\d*)"?\\s*(?:[Ll]ong|[Ll]ength)'
type_pattern = r'(Hex|Round|Keyed|Threaded)'
```

**Priority:** MEDIUM - Verify claimed 100% coverage
"""

    elif category == 'SPKT':
        return """
Contains: Tooth Count, Pitch, Bore Size

**Required Extraction:**
- Spec 1: Tooth Count - e.g., "15", "20"
- Spec 2: Chain Pitch - e.g., "#25", "#35"
- Spec 3: Bore Size - e.g., "0.500\\""
- Spec 4: Sprocket Type/Features

**Regex Patterns:**
```python
tooth_pattern = r'(\\d+)\\s*[Tt]ooth'
pitch_pattern = r'#(\\d+)'
bore_pattern = r'(\\d+\\.?\\d*)"?\\s*[Bb]ore'
```

**Priority:** MEDIUM - Check extraction quality
"""

    elif category == 'PULLEY':
        return """
Contains: Tooth Count, Belt Type, Bore Size

**Required Extraction:**
- Spec 1: Tooth Count - e.g., "18", "36"
- Spec 2: Belt Type - e.g., "HTD 5mm", "GT2"
- Spec 3: Bore Size - e.g., "0.500\\""
- Spec 4: Width/Additional

**Regex Patterns:**
```python
tooth_pattern = r'(\\d+)\\s*[Tt]ooth'
type_pattern = r'(HTD|GT2|GT3)\\s*(\\d+mm)?'
bore_pattern = r'(\\d+\\.?\\d*)"?\\s*[Bb]ore'
```

**Priority:** MEDIUM
"""

    elif category == 'CHAIN':
        return """
Contains: Chain Pitch, Length, Type

**Required Extraction:**
- Spec 1: Pitch - e.g., "#25", "#35"
- Spec 2: Length - e.g., "10 ft", "100 links"
- Spec 3: Type - e.g., "Roller", "Nickel"
- Spec 4: Additional features

**Regex Patterns:**
```python
pitch_pattern = r'#(\\d+)'
length_pattern = r'(\\d+)\\s*(ft|links|inch)'
type_pattern = r'(Roller|Nickel|Heavy Duty)'
```

**Priority:** MEDIUM
"""

    elif category == 'STRUCT':
        return """
Contains: Dimensions, Material, Profile Type

**Required Extraction:**
- Spec 1: Profile - e.g., "1x1", "2x1"
- Spec 2: Length - e.g., "12\\""
- Spec 3: Wall Thickness - e.g., "0.063\\""
- Spec 4: Material/Finish

**Priority:** LOW - Check claimed 93.8% coverage
"""

    elif category == 'FAST':
        return """
Contains: Size, Type, Length, Thread

**Required Extraction:**
- Spec 1: Size - e.g., "#10-32", "1/4-20"
- Spec 2: Length - e.g., "0.500\\""
- Spec 3: Type - e.g., "Socket Head", "Button Head"
- Spec 4: Material/Finish

**Regex Patterns:**
```python
size_pattern = r'(#?\\d+(?:-\\d+)?|\\d+/\\d+-\\d+)'
length_pattern = r'(\\d+\\.?\\d*)"?\\s*[Ll]'
type_pattern = r'(Socket Head|Button Head|Flat Head|Pan Head)'
```

**Priority:** MEDIUM
"""

    else:
        return "Pattern analysis needed - review sample parts manually."


def generate_fix_summary(category_stats: Dict) -> str:
    """Generate summary of fixes needed."""

    md = """## Summary of Fixes Needed

### High Priority (0-50% spec coverage)

"""

    high_priority = []
    medium_priority = []
    low_priority = []

    for cat, stats in category_stats.items():
        if not stats:
            continue

        avg_coverage = (stats['spec1_pct'] + stats['spec2_pct']) / 2

        if avg_coverage < 50:
            high_priority.append((cat, stats, avg_coverage))
        elif avg_coverage < 90:
            medium_priority.append((cat, stats, avg_coverage))
        else:
            low_priority.append((cat, stats, avg_coverage))

    for cat, stats, cov in sorted(high_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats['total']} parts\n"

    md += "\n### Medium Priority (50-90% spec coverage)\n\n"
    for cat, stats, cov in sorted(medium_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats['total']} parts\n"

    md += "\n### Low Priority (>90% spec coverage)\n\n"
    for cat, stats, cov in sorted(low_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats['total']} parts\n"

    md += """

## Testing Checklist

For each category requiring fixes:

- [ ] BEAR - Test on 10 sample parts with ID/OD/WD patterns
- [ ] BELT - Test tooth count and width extraction
- [ ] WIRE - Test gauge and length extraction
- [ ] GEAR - Verify current extraction accuracy
- [ ] SPKT - Verify current extraction accuracy
- [ ] PULLEY - Verify current extraction accuracy
- [ ] SHAFT - Validate claimed 100% coverage
- [ ] STRUCT - Validate claimed 93.8% coverage
- [ ] FAST - Test size and length extraction
- [ ] CHAIN - Test pitch and length extraction
- [ ] HDWR - Review 4 parts manually
- [ ] CTRL - Review 5 parts manually
- [ ] ELEC - Review 3 parts manually
- [ ] SENSOR - Review 1 part manually

### Validation Criteria

For each fix:
- Extract specs from 90%+ of parts in category
- Specs must match expected format
- No data loss from original part names
- All units preserved correctly
- Handle edge cases (missing data, unusual formats)

## Next Steps

1. **Immediate:** Fix high-priority categories (BEAR, WIRE, etc.)
2. **Phase 2:** Improve medium-priority extractions
3. **Phase 3:** Validate low-priority claimed coverage
4. **Testing:** Run extraction on full dataset
5. **Validation:** Manual review of 10% sample per category
"""

    return md


def main():
    """Main execution function."""
    print("Loading CSV file...")
    df = pd.read_csv('/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/Part Directory - Next Attempt.csv')

    print(f"Total parts loaded: {len(df)}")
    print(f"Columns: {df.columns.tolist()}")

    # Get unique categories
    categories = sorted(df['Category'].unique())
    print(f"\nCategories found: {categories}")

    # Analyze each category
    category_stats = {}
    for cat in categories:
        print(f"Analyzing {cat}...")
        stats = analyze_category_specs(df, cat)
        if stats:
            category_stats[cat] = stats
            print(f"  {cat}: {stats['total']} parts, Spec1: {stats['spec1_pct']:.1f}%, Spec2: {stats['spec2_pct']:.1f}%")

    # Generate report
    print("\nGenerating markdown report...")
    report = generate_markdown_report(df, category_stats)

    # Write report
    output_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/SPEC_GAP_AUDIT.md'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\nReport written to: {output_path}")

    # Print summary
    categories_complete = sum(1 for stats in category_stats.values()
                             if stats and min(stats['spec1_pct'], stats['spec2_pct']) >= 90)
    categories_needing_fixes = len(category_stats) - categories_complete

    print("\n" + "="*60)
    print("AUDIT SUMMARY")
    print("="*60)
    print(f"Total parts: {len(df)}")
    print(f"Total categories: {len(category_stats)}")
    print(f"Categories with >=90% coverage: {categories_complete}")
    print(f"Categories needing fixes: {categories_needing_fixes}")
    print("\nHighest priority fixes:")

    # Show top 5 worst categories
    sorted_cats = sorted(category_stats.items(),
                        key=lambda x: (x[1]['spec1_pct'] + x[1]['spec2_pct']) / 2)

    for i, (cat, stats) in enumerate(sorted_cats[:5], 1):
        avg_cov = (stats['spec1_pct'] + stats['spec2_pct']) / 2
        print(f"{i}. {cat} ({get_category_name(cat)}) - {avg_cov:.1f}% avg coverage - {stats['total']} parts")


if __name__ == '__main__':
    main()
