#!/usr/bin/env python3
"""Generate detailed classification report from WCP parsed and classified data."""

import json
from pathlib import Path


def generate_report(json_path: str):
    """Generate comprehensive report."""

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    parts = data['parts']
    metadata = data['metadata']

    print('=' * 80)
    print('WCP PARTS CLASSIFICATION REPORT')
    print('=' * 80)
    print()

    # Overall stats
    print(f'Total Parts Processed: {metadata["total_parts"]}')
    print()

    # Classification quality
    print('Classification Quality:')
    stats = metadata['classification_stats']
    total = metadata["total_parts"]
    print(f'  High Confidence (>= 0.95):   {stats["high_confidence"]:4d} parts ({stats["high_confidence"]/total*100:.1f}%)')
    print(f'  Medium Confidence (0.70-0.94): {stats["medium_confidence"]:4d} parts ({stats["medium_confidence"]/total*100:.1f}%)')
    print(f'  Low Confidence (< 0.70):      {stats["low_confidence"]:4d} parts ({stats["low_confidence"]/total*100:.1f}%)')
    print(f'  Average Confidence:           {stats["average_confidence"]:.3f}')
    print()

    # Category distribution
    print('Category Distribution:')
    sorted_cats = sorted(metadata['category_distribution'].items(), key=lambda x: x[1], reverse=True)
    for code, count in sorted_cats:
        pct = (count / total) * 100
        print(f'  {code:6s}: {count:4d} parts ({pct:5.1f}%)')
    print()

    # Specification extraction
    spec_stats = metadata['specification_extraction']
    print('Specification Extraction:')
    print(f'  Parts with specs: {spec_stats["parts_with_specs"]} ({spec_stats["coverage_percentage"]:.1f}%)')
    print()

    # Sample parts by category
    print('=' * 80)
    print('SAMPLE PARTS BY CATEGORY')
    print('=' * 80)
    print()

    # Group parts by category
    by_category = {}
    for part in parts:
        cat = part['classified_category_code']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(part)

    # Show samples from each major category
    major_categories = ['FAST', 'GEAR', 'BELT', 'PULLEY', 'SPKT', 'BEAR', 'CHAIN', 'WIRE', 'STRUCT', 'SHAFT']

    for code in major_categories:
        if code in by_category:
            cat_parts = by_category[code]
            print(f'{code} - {cat_parts[0]["classified_category_name"]} ({len(cat_parts)} parts)')
            print(f'Sample (first 3):')
            for i, part in enumerate(cat_parts[:3], 1):
                print(f'  {i}. {part["cleaned_name"][:75]}')
                print(f'     Code: {part["product_code"]} | Confidence: {part["classification_confidence"]:.2f} | Price: ${part["unit_cost"]:.2f} | Pack: {part["pack_quantity"]}')
                print(f'     URL: {part["supplier_url"]}')
                if part['specifications']:
                    specs_filtered = {k: v for k, v in part['specifications'].items() if k != 'pack_quantity'}
                    if specs_filtered:
                        specs_str = ', '.join([f'{k}={v}' for k, v in specs_filtered.items()])
                        print(f'     Specs: {specs_str[:75]}')
            print()

    # Show specification coverage by category
    print('=' * 80)
    print('SPECIFICATION COVERAGE BY CATEGORY')
    print('=' * 80)
    print()

    for code in major_categories:
        if code in by_category:
            cat_parts = by_category[code]
            with_specs = sum(1 for p in cat_parts if len(p['specifications']) > 1)
            coverage_pct = (with_specs / len(cat_parts)) * 100
            print(f'{code:6s}: {with_specs:3d}/{len(cat_parts):3d} parts with specs ({coverage_pct:5.1f}%)')
    print()


if __name__ == '__main__':
    json_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_parsed_classified.json'
    generate_report(json_path)
