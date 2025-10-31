#!/usr/bin/env python3
"""
Comprehensive spec gap audit for WCP parts CSV.
Pure Python implementation without external dependencies.
"""

import csv
import re
from typing import Dict, List, Optional
from collections import defaultdict


class PartData:
    """Data structure for a single part."""

    def __init__(self, row: Dict[str, str]):
        self.product_code = row.get('Product Code', '')
        self.part_name = row.get('Part Name', '')
        self.category = row.get('Category', '')
        self.subcategory = row.get('Subcategory', '')
        self.spec1 = row.get('Spec 1', '').strip()
        self.spec2 = row.get('Spec 2', '').strip()
        self.spec3 = row.get('Spec 3', '').strip()
        self.spec4 = row.get('Spec 4', '').strip()
        self.price = row.get('Price', '')
        self.url = row.get('URL', '')

    def has_spec(self, spec_num: int) -> bool:
        """Check if a spec field is populated."""
        spec = getattr(self, f'spec{spec_num}', '')
        return bool(spec and spec.strip())


class CategoryStats:
    """Statistics for a category."""

    def __init__(self, category: str):
        self.category = category
        self.parts: List[PartData] = []

    def add_part(self, part: PartData):
        """Add a part to this category."""
        self.parts.append(part)

    @property
    def total(self) -> int:
        """Total number of parts."""
        return len(self.parts)

    def spec_count(self, spec_num: int) -> int:
        """Count parts with spec populated."""
        return sum(1 for p in self.parts if p.has_spec(spec_num))

    def spec_percentage(self, spec_num: int) -> float:
        """Percentage of parts with spec populated."""
        if self.total == 0:
            return 0.0
        return (self.spec_count(spec_num) / self.total) * 100

    def get_samples(self, count: int = 10) -> List[str]:
        """Get sample part names."""
        return [p.part_name for p in self.parts[:count]]

    def get_populated_examples(self, count: int = 5) -> List[PartData]:
        """Get examples of parts with populated specs."""
        return [p for p in self.parts[:count]
                if any(p.has_spec(i) for i in range(1, 5))]


def load_csv(filepath: str) -> List[PartData]:
    """Load CSV file and return list of PartData objects."""
    parts = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            parts.append(PartData(row))
    return parts


def analyze_categories(parts: List[PartData]) -> Dict[str, CategoryStats]:
    """Analyze parts by category."""
    categories = defaultdict(lambda: CategoryStats(''))

    for part in parts:
        if part.category:
            if part.category not in categories:
                categories[part.category] = CategoryStats(part.category)
            categories[part.category].add_part(part)

    return dict(categories)


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

**Priority:** HIGH - Critical dimensional data missing
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

**Priority:** HIGH - Critical wiring specs missing
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

**Priority:** MEDIUM - Check extraction quality
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

**Priority:** MEDIUM - Improve extraction consistency
"""

    elif category == 'STRUCT':
        return """
Contains: Dimensions, Material, Profile Type

**Required Extraction:**
- Spec 1: Profile - e.g., "1x1", "2x1"
- Spec 2: Length - e.g., "12\\""
- Spec 3: Wall Thickness - e.g., "0.063\\""
- Spec 4: Material/Finish

**Priority:** LOW - Verify claimed 93.8% coverage
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

**Priority:** MEDIUM - Improve fastener spec extraction
"""

    else:
        return "Pattern analysis needed - review sample parts manually."


def generate_markdown_report(categories: Dict[str, CategoryStats], total_parts: int) -> str:
    """Generate comprehensive markdown audit report."""

    # Calculate summary stats
    categories_complete = sum(
        1 for stats in categories.values()
        if min(stats.spec_percentage(1), stats.spec_percentage(2)) >= 90
    )
    categories_needing_fixes = len(categories) - categories_complete

    # Calculate total missing specs
    total_missing = 0
    for stats in categories.values():
        total_specs_possible = stats.total * 4
        total_specs_filled = sum(stats.spec_count(i) for i in range(1, 5))
        total_missing += total_specs_possible - total_specs_filled

    md = f"""# Spec Gap Audit Report

## Executive Summary
- Total parts audited: {total_parts}
- Total categories: {len(categories)}
- Categories with complete specs (>=90% on Spec 1&2): {categories_complete}
- Categories needing fixes: {categories_needing_fixes}
- Total spec fields missing: {total_missing:,}

## Category Analysis

"""

    # Sort categories by priority (lowest spec coverage first)
    sorted_categories = sorted(
        categories.items(),
        key=lambda x: (x[1].spec_percentage(1) + x[1].spec_percentage(2)) / 2
    )

    for category_code, stats in sorted_categories:
        cat_name = get_category_name(category_code)
        md += f"""### {category_code} ({cat_name}) - {stats.total} parts

**Spec Population:**
- Spec 1: {stats.spec_percentage(1):.1f}% ({stats.spec_count(1)}/{stats.total})
- Spec 2: {stats.spec_percentage(2):.1f}% ({stats.spec_count(2)}/{stats.total})
- Spec 3: {stats.spec_percentage(3):.1f}% ({stats.spec_count(3)}/{stats.total})
- Spec 4: {stats.spec_percentage(4):.1f}% ({stats.spec_count(4)}/{stats.total})

**Sample Part Names:**
"""
        for i, sample in enumerate(stats.get_samples(5), 1):
            md += f"{i}. {sample}\n"

        # Show current extraction examples if any
        populated_examples = stats.get_populated_examples(3)
        if populated_examples:
            md += "\n**Current Extraction Examples:**\n"
            for ex in populated_examples:
                md += f"\n{ex.product_code}: \"{ex.part_name}\"\n"
                if ex.has_spec(1):
                    md += f"  - Spec 1: {ex.spec1}\n"
                if ex.has_spec(2):
                    md += f"  - Spec 2: {ex.spec2}\n"
                if ex.has_spec(3):
                    md += f"  - Spec 3: {ex.spec3}\n"
                if ex.has_spec(4):
                    md += f"  - Spec 4: {ex.spec4}\n"

        # Analyze patterns and suggest extraction
        md += "\n**Pattern Analysis:**\n"
        md += analyze_patterns_for_category(category_code, stats.get_samples())

        md += "\n---\n\n"

    # Summary section
    md += generate_fix_summary(categories)

    return md


def generate_fix_summary(categories: Dict[str, CategoryStats]) -> str:
    """Generate summary of fixes needed."""

    md = """## Summary of Fixes Needed

### High Priority (0-50% spec coverage)

"""

    high_priority = []
    medium_priority = []
    low_priority = []

    for cat, stats in categories.items():
        avg_coverage = (stats.spec_percentage(1) + stats.spec_percentage(2)) / 2

        if avg_coverage < 50:
            high_priority.append((cat, stats, avg_coverage))
        elif avg_coverage < 90:
            medium_priority.append((cat, stats, avg_coverage))
        else:
            low_priority.append((cat, stats, avg_coverage))

    for cat, stats, cov in sorted(high_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats.total} parts\n"

    md += "\n### Medium Priority (50-90% spec coverage)\n\n"
    for cat, stats, cov in sorted(medium_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats.total} parts\n"

    md += "\n### Low Priority (>90% spec coverage)\n\n"
    for cat, stats, cov in sorted(low_priority, key=lambda x: x[2]):
        md += f"- **{cat}** ({get_category_name(cat)}) - {cov:.1f}% coverage - {stats.total} parts\n"

    md += """

## Recommended Action Plan

### Phase 1: Critical Fixes (Days 1-2)
Focus on categories with 0-30% coverage where specs are essential for part selection:

1. **BEAR (Bearings)** - ID/OD/WD dimensions are critical for mechanical fit
2. **WIRE (Wiring)** - Gauge and length are essential for electrical work
3. **BELT (Belts)** - Tooth count and width needed for drivetrain design

### Phase 2: Important Improvements (Days 3-4)
Categories with 30-70% coverage that need better extraction:

4. **FAST (Fasteners)** - Size and length extraction improvements
5. **PULLEY (Pulleys)** - Tooth count and bore extraction
6. **CHAIN (Chain)** - Pitch and length standardization
7. **SPKT (Sprockets)** - Tooth count and pitch verification

### Phase 3: Verification (Day 5)
Validate categories claiming high coverage:

8. **SHAFT** - Verify claimed 100% coverage accuracy
9. **STRUCT** - Verify claimed 93.8% coverage accuracy
10. **GEAR** - Check extraction quality and consistency

### Phase 4: Small Categories (Day 6)
Manual review of low-volume categories:

11. **HDWR** - 4 parts - manual entry
12. **CTRL** - 5 parts - manual entry
13. **ELEC** - 3 parts - manual entry
14. **SENSOR** - 1 part - manual entry

## Testing Checklist

For each category requiring fixes:

- [ ] BEAR - Test on 10 sample parts with ID/OD/WD patterns
- [ ] WIRE - Test gauge and length extraction on 5 parts
- [ ] BELT - Test tooth count and width extraction on 8 parts
- [ ] FAST - Test size and length extraction on 10 parts
- [ ] PULLEY - Verify tooth/bore extraction on 5 parts
- [ ] CHAIN - Test pitch and length extraction on 5 parts
- [ ] SPKT - Verify tooth/pitch extraction on 5 parts
- [ ] GEAR - Sample 10 parts for quality check
- [ ] SHAFT - Sample 5 parts to verify claimed coverage
- [ ] STRUCT - Sample 5 parts to verify claimed coverage

### Validation Criteria

For each fix:
- Extract specs from 90%+ of parts in category
- Specs must match expected format and units
- No data loss from original part names
- All units preserved correctly (", mm, AWG, etc.)
- Handle edge cases (missing data, unusual formats)
- Maintain consistency across similar parts

## Implementation Notes

### Regex Best Practices
- Use case-insensitive matching where appropriate
- Account for variations (ID, id, Id)
- Handle optional quotes and spaces
- Capture units with values
- Use non-greedy matching for parentheses

### Testing Approach
1. Run extraction on full category
2. Sample 10% of results randomly
3. Manual verification of sampled results
4. Check edge cases (first, last, unusual names)
5. Verify no regressions on already-working categories

### Quality Metrics
- Target: 90%+ extraction rate per category
- Acceptable: 85-89% for complex patterns
- Requires manual review: <85%
- Perfect extraction not expected due to data variations
"""

    return md


def main():
    """Main execution function."""
    csv_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/Part Directory - Next Attempt.csv'

    print("Loading CSV file...")
    parts = load_csv(csv_path)
    print(f"Total parts loaded: {len(parts)}")

    print("\nAnalyzing categories...")
    categories = analyze_categories(parts)
    print(f"Categories found: {len(categories)}")

    for cat, stats in sorted(categories.items()):
        pct1 = stats.spec_percentage(1)
        pct2 = stats.spec_percentage(2)
        print(f"  {cat}: {stats.total} parts, Spec1: {pct1:.1f}%, Spec2: {pct2:.1f}%")

    print("\nGenerating markdown report...")
    report = generate_markdown_report(categories, len(parts))

    # Write report
    output_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/SPEC_GAP_AUDIT.md'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\nReport written to: {output_path}")

    # Print summary
    categories_complete = sum(
        1 for stats in categories.values()
        if min(stats.spec_percentage(1), stats.spec_percentage(2)) >= 90
    )
    categories_needing_fixes = len(categories) - categories_complete

    print("\n" + "="*60)
    print("AUDIT SUMMARY")
    print("="*60)
    print(f"Total parts: {len(parts)}")
    print(f"Total categories: {len(categories)}")
    print(f"Categories with >=90% coverage: {categories_complete}")
    print(f"Categories needing fixes: {categories_needing_fixes}")
    print("\nHighest priority fixes:")

    # Show top 5 worst categories
    sorted_cats = sorted(
        categories.items(),
        key=lambda x: (x[1].spec_percentage(1) + x[1].spec_percentage(2)) / 2
    )

    for i, (cat, stats) in enumerate(sorted_cats[:5], 1):
        avg_cov = (stats.spec_percentage(1) + stats.spec_percentage(2)) / 2
        print(f"{i}. {cat} ({get_category_name(cat)}) - {avg_cov:.1f}% avg coverage - {stats.total} parts")


if __name__ == '__main__':
    main()
