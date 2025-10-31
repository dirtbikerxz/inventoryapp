#!/usr/bin/env python3
"""Validate WCP classification output with diverse samples."""

import json
import random


def validate_output(json_path: str):
    """Validate final output with diverse sampling."""

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    parts = data['parts']
    metadata = data['metadata']

    print('=' * 80)
    print('WCP CLASSIFICATION VALIDATION')
    print('=' * 80)
    print()

    # Basic validation
    print('Basic Validation:')
    print(f'  Total parts loaded: {len(parts)}')
    print(f'  Metadata total: {metadata["total_parts"]}')
    print(f'  Match: {"YES" if len(parts) == metadata["total_parts"] else "NO"}')
    print()

    # Check all parts have required fields
    required_fields = [
        'original_name', 'cleaned_name', 'product_code',
        'classified_category_code', 'classified_category_name',
        'classification_confidence', 'specifications',
        'pack_quantity', 'unit_cost', 'supplier', 'supplier_url'
    ]

    missing_fields = []
    for i, part in enumerate(parts):
        for field in required_fields:
            if field not in part:
                missing_fields.append((i, field))

    if missing_fields:
        print('WARNING: Missing fields found:')
        for idx, field in missing_fields[:10]:
            print(f'  Part {idx}: Missing {field}')
    else:
        print('Field Validation: ALL PARTS HAVE REQUIRED FIELDS')

    print()

    # URL validation
    print('URL Validation:')
    urls_valid = 0
    urls_missing = 0
    for part in parts:
        url = part.get('supplier_url', '')
        if url and url.startswith('https://www.wcproducts.com/products/wcp-'):
            urls_valid += 1
        else:
            urls_missing += 1

    print(f'  Valid URLs: {urls_valid}/{len(parts)} ({urls_valid/len(parts)*100:.1f}%)')
    if urls_missing > 0:
        print(f'  Missing/Invalid URLs: {urls_missing}')
    print()

    # Product code validation
    print('Product Code Validation:')
    codes_valid = sum(1 for p in parts if p['product_code'].startswith('WCP-'))
    print(f'  Valid WCP codes: {codes_valid}/{len(parts)} ({codes_valid/len(parts)*100:.1f}%)')
    print()

    # Show diverse samples
    print('=' * 80)
    print('DIVERSE SAMPLE VALIDATION')
    print('=' * 80)
    print()

    # Group by category
    by_category = {}
    for part in parts:
        cat = part['classified_category_code']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(part)

    # Sample from different categories
    categories_to_sample = ['FAST', 'GEAR', 'BELT', 'PULLEY', 'SPKT', 'BEAR', 'CHAIN']

    for cat_code in categories_to_sample:
        if cat_code in by_category:
            cat_parts = by_category[cat_code]
            # Pick a random sample
            sample = random.choice(cat_parts)

            print(f'{cat_code} - {sample["classified_category_name"]}')
            print(f'  Name: {sample["cleaned_name"][:75]}')
            print(f'  Code: {sample["product_code"]}')
            print(f'  Confidence: {sample["classification_confidence"]:.3f}')
            print(f'  Price: ${sample["unit_cost"]:.2f} (Pack of {sample["pack_quantity"]})')
            print(f'  URL: {sample["supplier_url"]}')
            print(f'  Section: {sample["wcp_section"]} / {sample["wcp_subsection"]}')

            if sample['specifications']:
                print(f'  Specifications:')
                for key, value in sample['specifications'].items():
                    print(f'    {key}: {value}')
            else:
                print(f'  Specifications: None extracted')
            print()

    # Check confidence distribution
    print('=' * 80)
    print('CONFIDENCE DISTRIBUTION ANALYSIS')
    print('=' * 80)
    print()

    confidence_ranges = {
        '0.95-1.00': (0.95, 1.00),
        '0.90-0.94': (0.90, 0.94),
        '0.85-0.89': (0.85, 0.89),
        '0.80-0.84': (0.80, 0.84),
        '0.70-0.79': (0.70, 0.79),
        '< 0.70': (0.0, 0.69)
    }

    for label, (min_conf, max_conf) in confidence_ranges.items():
        count = sum(1 for p in parts if min_conf <= p['classification_confidence'] <= max_conf)
        if count > 0:
            pct = (count / len(parts)) * 100
            print(f'{label}: {count:4d} parts ({pct:5.1f}%)')

    print()

    # Check price range
    print('=' * 80)
    print('PRICE RANGE ANALYSIS')
    print('=' * 80)
    print()

    prices = [p['unit_cost'] for p in parts]
    print(f'Minimum price: ${min(prices):.2f}')
    print(f'Maximum price: ${max(prices):.2f}')
    print(f'Average price: ${sum(prices)/len(prices):.2f}')
    print(f'Median price: ${sorted(prices)[len(prices)//2]:.2f}')
    print()

    # Pack quantity analysis
    print('=' * 80)
    print('PACK QUANTITY ANALYSIS')
    print('=' * 80)
    print()

    pack_qtys = [p['pack_quantity'] for p in parts]
    unique_qtys = sorted(set(pack_qtys))
    print(f'Unique pack quantities: {unique_qtys}')
    print(f'Most common pack quantities:')
    from collections import Counter
    qty_counts = Counter(pack_qtys)
    for qty, count in qty_counts.most_common(5):
        pct = (count / len(parts)) * 100
        print(f'  {qty:3d}: {count:4d} parts ({pct:5.1f}%)')
    print()

    print('=' * 80)
    print('VALIDATION COMPLETE')
    print('=' * 80)


if __name__ == '__main__':
    json_path = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_parsed_classified.json'
    validate_output(json_path)
