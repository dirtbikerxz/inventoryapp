#!/usr/bin/env python3
"""
Apply 43 classification corrections to WCP parts data.
"""

import json
from collections import defaultdict

# Define corrections
CORRECTIONS = {
    # 34 Bearings: GEAR -> BEAR
    'WCP-0027': ('BEAR', 'Bearings'),
    'WCP-0036': ('BEAR', 'Bearings'),
    'WCP-0037': ('BEAR', 'Bearings'),
    'WCP-0041': ('BEAR', 'Bearings'),
    'WCP-0078': ('BEAR', 'Bearings'),
    'WCP-0212': ('BEAR', 'Bearings'),
    'WCP-0216': ('BEAR', 'Bearings'),
    'WCP-0302': ('BEAR', 'Bearings'),
    'WCP-0337': ('BEAR', 'Bearings'),
    'WCP-0357': ('BEAR', 'Bearings'),
    'WCP-0498': ('BEAR', 'Bearings'),
    'WCP-0773': ('BEAR', 'Bearings'),
    'WCP-0774': ('BEAR', 'Bearings'),
    'WCP-0775': ('BEAR', 'Bearings'),
    'WCP-0776': ('BEAR', 'Bearings'),
    'WCP-0777': ('BEAR', 'Bearings'),
    'WCP-0778': ('BEAR', 'Bearings'),
    'WCP-0840': ('BEAR', 'Bearings'),
    'WCP-0841': ('BEAR', 'Bearings'),
    'WCP-0884': ('BEAR', 'Bearings'),
    'WCP-0887': ('BEAR', 'Bearings'),
    'WCP-0896': ('BEAR', 'Bearings'),
    'WCP-0906': ('BEAR', 'Bearings'),
    'WCP-1045': ('BEAR', 'Bearings'),
    'WCP-1111': ('BEAR', 'Bearings'),
    'WCP-1503': ('BEAR', 'Bearings'),
    'WCP-1557': ('BEAR', 'Bearings'),
    'WCP-1660': ('BEAR', 'Bearings'),
    'WCP-1735': ('BEAR', 'Bearings'),
    'WCP-1756': ('BEAR', 'Bearings'),
    'WCP-1868': ('BEAR', 'Bearings'),
    'WCP-1869': ('BEAR', 'Bearings'),
    'WCP-1870': ('BEAR', 'Bearings'),
    'WCP-1871': ('BEAR', 'Bearings'),

    # 4 Tube Plugs: MACH -> HDWR
    'WCP-0375': ('HDWR', 'Hardware'),
    'WCP-0376': ('HDWR', 'Hardware'),
    'WCP-2067': ('HDWR', 'Hardware'),
    'WCP-2107': ('HDWR', 'Hardware'),

    # 5 Nutstrips: GEAR -> HDWR
    'WCP-0335': ('HDWR', 'Hardware'),
    'WCP-0336': ('HDWR', 'Hardware'),
    'WCP-1553': ('HDWR', 'Hardware'),
    'WCP-1554': ('HDWR', 'Hardware'),
    'WCP-1555': ('HDWR', 'Hardware'),
}

def apply_corrections(input_file, output_file):
    """Load JSON, apply corrections, save to new file."""

    # Load the JSON file
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    parts = data.get('parts', [])
    print(f"Loaded {len(parts)} parts")

    # Track corrections
    corrected_codes = []
    not_found = []

    # Apply corrections
    for part in parts:
        product_code = part.get('product_code')
        if product_code in CORRECTIONS:
            old_category = part.get('category_code')
            new_code, new_name = CORRECTIONS[product_code]

            # Update the part
            part['category_code'] = new_code
            part['category_name'] = new_name

            corrected_codes.append(product_code)
            print(f"  {product_code}: {old_category} -> {new_code}")

    # Check for any codes not found
    for code in CORRECTIONS:
        if code not in corrected_codes:
            not_found.append(code)

    # Count category distribution
    category_counts = defaultdict(int)
    for part in parts:
        cat_code = part.get('category_code', 'UNKNOWN')
        category_counts[cat_code] += 1

    # Save the corrected data
    print(f"\nSaving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Generate report
    print("\n" + "="*60)
    print("CORRECTION REPORT")
    print("="*60)
    print(f"Total parts: {len(parts)}")
    print(f"Corrections applied: {len(corrected_codes)}")
    print(f"Corrections not found: {len(not_found)}")

    if not_found:
        print("\nWARNING - Product codes not found:")
        for code in not_found:
            print(f"  - {code}")

    print("\nCorrected Product Codes:")
    for i, code in enumerate(sorted(corrected_codes), 1):
        print(f"  {i:2d}. {code}")

    print("\nNew Category Distribution:")
    for cat_code in sorted(category_counts.keys()):
        count = category_counts[cat_code]
        print(f"  {cat_code}: {count}")

    print("\n" + "="*60)
    print(f"SUCCESS: All {len(corrected_codes)} corrections applied!")
    print("="*60)

    return len(corrected_codes) == 43

if __name__ == '__main__':
    input_file = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_fully_corrected.json'
    output_file = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_final_verified.json'

    success = apply_corrections(input_file, output_file)

    if not success:
        print("\nERROR: Not all 43 corrections were applied!")
        exit(1)
    else:
        print("\nFile saved successfully to:")
        print(output_file)
        exit(0)
