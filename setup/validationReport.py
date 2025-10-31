#!/usr/bin/env python3
"""
Validation and Enhancement Report Generator
Creates detailed report of spec extraction improvements.
"""

import json
from pathlib import Path
from typing import Dict, List


def load_json_data(filepath: str) -> Dict:
    """Load JSON data from file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate_test_cases(parts: List[Dict]) -> Dict:
    """Validate specific test cases for enhanced categories."""

    test_results = {
        'STRUCT': [],
        'SHAFT': [],
        'HDWR': []
    }

    # STRUCT test cases
    struct_tests = [
        {
            'name': '.75" OD x .500" Hex ID Aluminum Round Tube Stock (36")',
            'expected': {'od': '.75"', 'id': '.500" Hex', 'length': '36"', 'material': 'Aluminum'}
        },
        {
            'name': '.625" (16mm) OD x .550" (14mm) ID (Carbon Fiber Tube, 36")',
            'expected': {'od': '.625"', 'id': '.550"', 'length': '36"', 'material': 'Carbon Fiber'}
        }
    ]

    # SHAFT test cases
    shaft_tests = [
        {
            'name': '1/8" WD x .196" ID x 3/8" OD Aluminum Spacers',
            'expected': {'width': '1/8"', 'id': '.196"', 'od': '3/8"', 'material': 'Aluminum'}
        },
        {
            'name': '1/16" WD x 5/8" OD x 8mm SplineXS ID Spacer',
            'expected': {'width': '1/16"', 'id': '8mm SplineXS', 'od': '5/8"'}
        }
    ]

    # HDWR test cases
    hdwr_tests = [
        {
            'name': '1.5"x1.5"x.125" Aluminum Tube Plug (#10-32 Tapped)',
            'expected': {'dimensions': '1.5" x 1.5"', 'thickness': '.125"', 'thread': '#10-32 Tapped', 'material': 'Aluminum'}
        }
    ]

    # Validate STRUCT
    for test in struct_tests:
        matching = [p for p in parts if test['name'] in p['original_name']]
        if matching:
            part = matching[0]
            specs = part['specifications']
            passed = all(specs.get(k) == v for k, v in test['expected'].items())
            test_results['STRUCT'].append({
                'name': test['name'],
                'expected': test['expected'],
                'actual': specs,
                'passed': passed
            })

    # Validate SHAFT
    for test in shaft_tests:
        matching = [p for p in parts if test['name'] in p['original_name']]
        if matching:
            part = matching[0]
            specs = part['specifications']
            passed = all(specs.get(k) == v for k, v in test['expected'].items())
            test_results['SHAFT'].append({
                'name': test['name'],
                'expected': test['expected'],
                'actual': specs,
                'passed': passed
            })

    # Validate HDWR
    for test in hdwr_tests:
        matching = [p for p in parts if test['name'] in p['original_name']]
        if matching:
            part = matching[0]
            specs = part['specifications']
            passed = all(specs.get(k) == v for k, v in test['expected'].items())
            test_results['HDWR'].append({
                'name': test['name'],
                'expected': test['expected'],
                'actual': specs,
                'passed': passed
            })

    return test_results


def generate_category_stats(parts: List[Dict]) -> Dict:
    """Generate statistics by category."""
    stats = {}

    for part in parts:
        cat = part['classified_category_code']
        if cat not in stats:
            stats[cat] = {
                'total': 0,
                'with_specs': 0,
                'sample_parts': []
            }

        stats[cat]['total'] += 1
        specs = part['specifications']

        # Count parts with meaningful specs
        if len(specs) > 1 or (len(specs) == 1 and 'pack_quantity' not in specs):
            stats[cat]['with_specs'] += 1

        # Collect samples (up to 3 per category)
        if len(stats[cat]['sample_parts']) < 3:
            stats[cat]['sample_parts'].append({
                'name': part['original_name'],
                'specs': specs
            })

    # Calculate percentages
    for cat in stats:
        total = stats[cat]['total']
        with_specs = stats[cat]['with_specs']
        stats[cat]['coverage_pct'] = (with_specs / total * 100) if total > 0 else 0

    return stats


def verify_corrections(parts: List[Dict]) -> Dict:
    """Verify that the 27 corrections were applied."""

    corrections = {
        'spacers_to_shaft': 0,
        'can_devices_to_elec': 0
    }

    # Check for spacers in SHAFT category
    for part in parts:
        name = part['original_name'].lower()
        cat = part['classified_category_code']

        if 'spacer' in name and cat == 'SHAFT':
            corrections['spacers_to_shaft'] += 1

        if any(keyword in name for keyword in ['can wire', 'can cable', 'candlelight', 'candle']) and cat == 'ELEC':
            corrections['can_devices_to_elec'] += 1

    return corrections


def main():
    """Generate validation and enhancement report."""

    print("=" * 80)
    print("SPEC EXTRACTION ENHANCEMENT VALIDATION REPORT")
    print("=" * 80)

    # Load data
    enhanced_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_final_enhanced.json"
    data = load_json_data(enhanced_json)
    parts = data['parts']

    print(f"\nLoaded {len(parts)} parts from enhanced JSON")

    # Verify corrections
    print("\n" + "=" * 80)
    print("PHASE 1B CORRECTIONS VERIFICATION")
    print("=" * 80)

    corrections = verify_corrections(parts)
    print(f"\nSpacers moved to SHAFT: {corrections['spacers_to_shaft']}")
    print(f"CAN devices moved to ELEC: {corrections['can_devices_to_elec']}")
    print(f"Total corrections applied: {corrections['spacers_to_shaft'] + corrections['can_devices_to_elec']}")
    print(f"Expected: 27 (23 spacers + 4 CAN devices)")

    if corrections['spacers_to_shaft'] == 23:
        print("SUCCESS: All 23 spacers correctly reclassified to SHAFT")
    else:
        print(f"WARNING: Expected 23 spacers, found {corrections['spacers_to_shaft']}")

    # Generate category statistics
    print("\n" + "=" * 80)
    print("SPEC EXTRACTION COVERAGE BY CATEGORY")
    print("=" * 80)

    stats = generate_category_stats(parts)

    # Show enhanced categories first
    enhanced_cats = ['STRUCT', 'SHAFT', 'HDWR']
    print("\nENHANCED CATEGORIES (New Extraction Functions):")
    print("-" * 80)
    for cat in enhanced_cats:
        if cat in stats:
            s = stats[cat]
            print(f"{cat:10s}: {s['with_specs']:3d}/{s['total']:3d} parts ({s['coverage_pct']:5.1f}% coverage)")

    print("\nEXISTING CATEGORIES (Preserved Functions):")
    print("-" * 80)
    existing_cats = ['FAST', 'GEAR', 'PULLEY', 'BELT', 'SPKT', 'CHAIN']
    for cat in existing_cats:
        if cat in stats:
            s = stats[cat]
            print(f"{cat:10s}: {s['with_specs']:3d}/{s['total']:3d} parts ({s['coverage_pct']:5.1f}% coverage)")

    print("\nOTHER CATEGORIES (No Extraction Functions):")
    print("-" * 80)
    other_cats = sorted([c for c in stats.keys() if c not in enhanced_cats and c not in existing_cats])
    for cat in other_cats:
        s = stats[cat]
        print(f"{cat:10s}: {s['with_specs']:3d}/{s['total']:3d} parts ({s['coverage_pct']:5.1f}% coverage)")

    # Overall coverage
    total_parts = len(parts)
    parts_with_specs = sum(1 for p in parts if len(p['specifications']) > 1 or
                          (len(p['specifications']) == 1 and 'pack_quantity' not in p['specifications']))
    overall_pct = (parts_with_specs / total_parts * 100)

    print("\n" + "=" * 80)
    print(f"OVERALL COVERAGE: {parts_with_specs}/{total_parts} parts ({overall_pct:.1f}%)")
    print("=" * 80)

    # Test case validation
    print("\n" + "=" * 80)
    print("TEST CASE VALIDATION")
    print("=" * 80)

    test_results = validate_test_cases(parts)

    for category, tests in test_results.items():
        print(f"\n{category} Test Cases:")
        print("-" * 80)
        for i, test in enumerate(tests, 1):
            status = "PASS" if test['passed'] else "FAIL"
            print(f"\n{i}. [{status}] {test['name'][:70]}...")
            print(f"   Expected: {test['expected']}")
            print(f"   Actual:   {test['actual']}")

    # Sample parts from enhanced categories
    print("\n" + "=" * 80)
    print("SAMPLE ENHANCED PARTS")
    print("=" * 80)

    for cat in enhanced_cats:
        if cat in stats:
            print(f"\n{cat} Samples:")
            print("-" * 80)
            for i, sample in enumerate(stats[cat]['sample_parts'], 1):
                print(f"{i}. {sample['name'][:70]}...")
                print(f"   Specs: {sample['specs']}")

    # Enhancement metrics
    print("\n" + "=" * 80)
    print("ENHANCEMENT METRICS")
    print("=" * 80)

    print("\nBefore Enhancement (from context):")
    print("  STRUCT: 0% coverage")
    print("  SHAFT:  0% coverage")
    print("  HDWR:   0% coverage")

    print("\nAfter Enhancement:")
    for cat in enhanced_cats:
        if cat in stats:
            print(f"  {cat}: {stats[cat]['coverage_pct']:.1f}% coverage")

    print("\nImprovement:")
    for cat in enhanced_cats:
        if cat in stats:
            improvement = stats[cat]['coverage_pct'] - 0
            print(f"  {cat}: +{improvement:.1f}% (0% -> {stats[cat]['coverage_pct']:.1f}%)")

    # Data integrity check
    print("\n" + "=" * 80)
    print("DATA INTEGRITY CHECKS")
    print("=" * 80)

    print(f"\nTotal parts in output: {len(parts)}")
    print(f"Expected parts: 587")
    print(f"Match: {'YES - NO DATA LOSS' if len(parts) == 587 else 'NO - DATA LOSS DETECTED!'}")

    # Check for duplicate product codes
    product_codes = [p['product_code'] for p in parts if p.get('product_code')]
    duplicate_codes = len(product_codes) - len(set(product_codes))
    print(f"\nUnique product codes: {len(set(product_codes))}")
    print(f"Duplicate product codes: {duplicate_codes}")

    # Check for missing URLs
    parts_with_urls = sum(1 for p in parts if p.get('url'))
    print(f"\nParts with URLs: {parts_with_urls}/{len(parts)} ({parts_with_urls/len(parts)*100:.1f}%)")

    print("\n" + "=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()
