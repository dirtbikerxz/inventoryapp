#!/usr/bin/env python3
"""
Phase 2: Parse hierarchical Bulk_Product_Addition.csv and map to spec configurations.

This script:
1. Reads the hierarchical CSV structure (851 lines)
2. Extracts 658 parts with their context (category, subcategory, type)
3. Maps each part to the correct spec configuration
4. Outputs parsed_parts.json with complete metadata
"""

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime


class WCPPartParser:
    """Parses WCP hierarchical CSV and maps to spec configurations."""

    # Category mapping from section headers to category codes
    CATEGORY_MAPPING = {
        'bolt': 'FAST',
        'fastener': 'FAST',
        'screw': 'FAST',
        'rivet': 'FAST',
        'aluminum gear': 'GEAR',
        'steel gear': 'GEAR',
        'spur gear': 'GEAR',
        'gear rack': 'GEAR',
        'pocketed gear': 'GEAR',
        'motionx gear': 'GEAR',
        'bearing': 'BEAR',
        'pulley': 'PULLEY',
        'timing pulley': 'PULLEY',
        'htd': 'BELT',
        'belt': 'BELT',
        'timing belt': 'BELT',
        'sprocket': 'SPKT',
        'chain': 'CHAIN',
        'hex stock': 'SHAFT',
        'tubing': 'SHAFT',
        'shaft': 'SHAFT',
        'tube stock': 'SHAFT',
        'splinexl': 'SHAFT',
        'hardware': 'HDWR',
        'spacer': 'HDWR',
        'washer': 'HDWR',
        'bushing': 'HDWR',
        'nut strip': 'HDWR',
        'tube plug': 'HDWR',
        'cable carrier': 'HDWR',
        'polycord': 'HDWR',
        'tool': 'TOOLS',
        'workholding': 'TOOLS',
        'control': 'CTRL',
        'power distribution': 'CTRL',
        'sensor': 'CTRL',
        'motor': 'MOTOR',
        'wire': 'WIRE',
        'wiring': 'WIRE',
        'cable': 'WIRE',
        'raw stock': 'STOCK',
        'carbon fiber': 'STOCK',
        'srpp': 'STOCK',
        'wheel': 'WHEEL',
        'flex wheel': 'WHEEL',
        'roller wheel': 'WHEEL',
        'intake wheel': 'WHEEL',
        'vector wheel': 'WHEEL',
    }

    def __init__(self, bulk_csv_path: str, spec_config_path: str):
        self.bulk_csv_path = Path(bulk_csv_path)
        self.spec_config_path = Path(spec_config_path)
        self.spec_configs = {}
        self.parsed_parts = []
        self.warnings = []
        self.stats = {
            'total_lines': 0,
            'parts_extracted': 0,
            'parts_matched': 0,
            'parts_unmatched': 0,
            'duplicate_codes': 0,
            'category_distribution': {}
        }

    def load_spec_configs(self):
        """Load spec configurations from CSV."""
        print("Loading spec configurations...")
        with open(self.spec_config_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (
                    row['Category Code'],
                    row['Subcategory Name'],
                    row['Type']
                )
                self.spec_configs[key] = {
                    'category_code': row['Category Code'],
                    'category_name': row['Category Name'],
                    'subcategory': row['Subcategory Name'],
                    'type': row['Type'],
                    'spec_labels': {
                        'spec1': row['Spec 1 Label'],
                        'spec2': row['Spec 2 Label'],
                        'spec3': row['Spec 3 Label'],
                        'spec4': row['Spec 4 Label'],
                        'spec5': row['Spec 5 Label']
                    }
                }
        print(f"Loaded {len(self.spec_configs)} spec configurations")

    def extract_category_from_text(self, text: str) -> Optional[str]:
        """Extract category code from section header text."""
        if not text:
            return None

        text_lower = text.lower()

        # Sort keywords by length (longest first) to prioritize specific matches
        # This prevents 'belt' from matching '/belts-chain' when 'sprocket' should win
        sorted_keywords = sorted(self.CATEGORY_MAPPING.items(), key=lambda x: len(x[0]), reverse=True)

        for keyword, category_code in sorted_keywords:
            if keyword in text_lower:
                return category_code
        return None

    def parse_part_line(self, text: str) -> Optional[Tuple[str, str, float]]:
        """
        Parse part line format: "Description (WCP-####)+$Price" or "Description (WCP-####) $Price"
        Returns: (part_name, product_code, price)
        """
        if not text or not text.strip():
            return None

        # Extract product code (WCP-####)
        product_code_match = re.search(r'\(WCP-(\d{4})\)', text)
        if not product_code_match:
            return None

        product_code = f"WCP-{product_code_match.group(1)}"

        # Extract price ($X.XX)
        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', text)
        if not price_match:
            self.warnings.append(f"No price found for {product_code}: {text}")
            price = 0.0
        else:
            price = float(price_match.group(1))

        # Extract part name (everything before product code)
        part_name = text[:product_code_match.start()].strip()

        # Remove trailing + or other separators
        part_name = part_name.rstrip('+').strip()

        return part_name, product_code, price

    def find_best_spec_config(
        self,
        category_code: str,
        subcategory: str,
        type_hint: Optional[str] = None
    ) -> Optional[Dict]:
        """Find best matching spec configuration."""

        # Handle None subcategory
        if not subcategory:
            # Just match category
            for key, config in self.spec_configs.items():
                if key[0] == category_code:
                    return config
            return None

        # Try exact match first
        if type_hint:
            key = (category_code, subcategory, type_hint)
            if key in self.spec_configs:
                return self.spec_configs[key]

        # Try to find any match with same category and subcategory
        for key, config in self.spec_configs.items():
            if key[0] == category_code and key[1] == subcategory:
                return config

        # Try to find match with same category and subcategory (case-insensitive)
        subcategory_lower = subcategory.lower()
        for key, config in self.spec_configs.items():
            if key[0] == category_code and key[1].lower() == subcategory_lower:
                return config

        # Last resort: just match category
        for key, config in self.spec_configs.items():
            if key[0] == category_code:
                return config

        return None

    def parse_bulk_csv(self, debug=False):
        """Parse the hierarchical bulk CSV file."""
        print(f"Parsing {self.bulk_csv_path}...")

        current_category_code = None
        current_subcategory = None
        current_type = None
        product_codes_seen = set()
        self.debug = debug

        # Try different encodings
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        f = None
        for encoding in encodings:
            try:
                f = open(self.bulk_csv_path, 'r', encoding=encoding)
                f.read()
                f.seek(0)
                print(f"Successfully opened with encoding: {encoding}")
                break
            except UnicodeDecodeError:
                if f:
                    f.close()
                continue

        if f is None:
            raise ValueError("Could not decode CSV file with any known encoding")

        try:
            reader = csv.reader(f)

            for line_num, row in enumerate(reader, 1):
                self.stats['total_lines'] += 1

                # Ensure row has at least 4 columns
                while len(row) < 4:
                    row.append('')

                col1, col2, col3, col4 = row[0], row[1], row[2], row[3]

                # Column 1: Top-level section (category hint)
                # When column 1 changes, it's a major section change - reset context
                if col1.strip():
                    extracted_category = self.extract_category_from_text(col1)
                    if extracted_category:
                        current_category_code = extracted_category
                        # Reset subcategory when category changes
                        current_subcategory = None
                        current_type = "Standard"
                        if self.debug and line_num >= 360 and line_num <= 370:
                            print(f"Line {line_num}: C1 Category → {current_category_code}")

                # Column 2: Category-level section (sometimes category hint or subcategory group)
                if col2.strip():
                    extracted_category = self.extract_category_from_text(col2)
                    if self.debug and line_num >= 360 and line_num <= 370:
                        print(f"Line {line_num}: C2 text='{col2[:60]}' extracted={extracted_category}")
                    if extracted_category:
                        current_category_code = extracted_category
                        # Reset subcategory when category changes
                        current_subcategory = None
                        current_type = "Standard"
                        if self.debug and line_num >= 360 and line_num <= 370:
                            print(f"Line {line_num}: C2 Category → {current_category_code}")

                # Column 3: Subcategory/Type
                if col3.strip():
                    current_subcategory = col3.strip()
                    # Try to infer type from subcategory
                    current_type = "Standard"  # Default
                    if self.debug and line_num >= 360 and line_num <= 370:
                        print(f"Line {line_num}: C3 Subcategory → {current_subcategory}")

                # Column 4: Actual part
                if col4.strip():
                    parsed = self.parse_part_line(col4)
                    if parsed:
                        part_name, product_code, price = parsed
                        self.stats['parts_extracted'] += 1

                        # Check for duplicates
                        if product_code in product_codes_seen:
                            self.stats['duplicate_codes'] += 1
                            self.warnings.append(f"Duplicate product code: {product_code}")
                        else:
                            product_codes_seen.add(product_code)

                        # Find matching spec config
                        spec_config = self.find_best_spec_config(
                            current_category_code,
                            current_subcategory,
                            current_type
                        )

                        if spec_config:
                            self.stats['parts_matched'] += 1

                            # Track category distribution
                            cat_code = spec_config['category_code']
                            self.stats['category_distribution'][cat_code] = \
                                self.stats['category_distribution'].get(cat_code, 0) + 1

                            part_data = {
                                'part_name': part_name,
                                'product_code': product_code,
                                'price': price,
                                'category_code': spec_config['category_code'],
                                'category_name': spec_config['category_name'],
                                'subcategory': spec_config['subcategory'],
                                'type': spec_config['type'],
                                'spec_labels': spec_config['spec_labels']
                            }
                            self.parsed_parts.append(part_data)
                        else:
                            self.stats['parts_unmatched'] += 1
                            self.warnings.append(
                                f"No spec config found for {product_code}: "
                                f"Category={current_category_code}, "
                                f"Subcategory={current_subcategory}"
                            )

                            # Create part with best guess
                            part_data = {
                                'part_name': part_name,
                                'product_code': product_code,
                                'price': price,
                                'category_code': current_category_code or 'UNKNOWN',
                                'category_name': 'Unknown',
                                'subcategory': current_subcategory or 'Unknown',
                                'type': current_type or 'Standard',
                                'spec_labels': {
                                    'spec1': 'Spec 1',
                                    'spec2': 'Spec 2',
                                    'spec3': 'Spec 3',
                                    'spec4': 'Spec 4',
                                    'spec5': 'Spec 5'
                                }
                            }
                            self.parsed_parts.append(part_data)
        finally:
            if f:
                f.close()

        print(f"Parsing complete: {self.stats['parts_extracted']} parts extracted")

    def save_results(self, output_path: str):
        """Save parsed results to JSON file."""
        output = {
            'metadata': {
                'total_parts': self.stats['parts_extracted'],
                'source': 'Bulk_Product_Addition.csv',
                'parsing_date': datetime.now().strftime('%Y-%m-%d'),
                'matched_to_spec_config': self.stats['parts_matched'],
                'unmatched': self.stats['parts_unmatched'],
                'duplicate_codes': self.stats['duplicate_codes'],
                'total_lines_read': self.stats['total_lines']
            },
            'parts': self.parsed_parts
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"Results saved to {output_path}")

    def generate_report(self, report_path: str):
        """Generate Phase 2 completion report."""

        # Sample parts
        sample_parts = self.parsed_parts[:5] if len(self.parsed_parts) >= 5 else self.parsed_parts

        report = f"""# Phase 2 Parsing Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary Statistics

- **Total Lines Read**: {self.stats['total_lines']}
- **Total Parts Extracted**: {self.stats['parts_extracted']}
- **Parts Matched to Spec Config**: {self.stats['parts_matched']} ({self.stats['parts_matched']/self.stats['parts_extracted']*100:.1f}%)
- **Parts Unmatched**: {self.stats['parts_unmatched']}
- **Duplicate Product Codes**: {self.stats['duplicate_codes']}

## Category Distribution

| Category Code | Category Name | Part Count |
|---------------|---------------|------------|
"""

        # Add category distribution
        category_names = {
            'FAST': 'Fasteners',
            'GEAR': 'Gears',
            'BEAR': 'Bearings',
            'PULLEY': 'Pulleys',
            'BELT': 'Belts',
            'SPKT': 'Sprockets',
            'CHAIN': 'Chain',
            'SHAFT': 'Shafts & Hubs',
            'HDWR': 'Hardware',
            'TOOLS': 'Build Site Tools',
            'CTRL': 'Control System',
            'MOTOR': 'Motors',
            'WIRE': 'Wiring',
            'STOCK': 'Raw Stock',
            'WHEEL': 'Wheels & Casters',
            'UNKNOWN': 'Unknown'
        }

        for cat_code in sorted(self.stats['category_distribution'].keys()):
            count = self.stats['category_distribution'][cat_code]
            cat_name = category_names.get(cat_code, 'Unknown')
            report += f"| {cat_code} | {cat_name} | {count} |\n"

        report += f"\n## Sample Parsed Parts (First 5)\n\n"

        for i, part in enumerate(sample_parts, 1):
            report += f"### Part {i}: {part['part_name']}\n\n"
            report += f"```json\n{json.dumps(part, indent=2)}\n```\n\n"

        # Add warnings section
        if self.warnings:
            report += f"## Warnings and Errors ({len(self.warnings)} total)\n\n"
            # Show first 20 warnings
            for warning in self.warnings[:20]:
                report += f"- {warning}\n"
            if len(self.warnings) > 20:
                report += f"\n... and {len(self.warnings) - 20} more warnings\n"
        else:
            report += "## Warnings and Errors\n\nNo warnings or errors encountered.\n"

        report += f"\n## Validation Results\n\n"
        report += f"- Target parts: 658\n"
        report += f"- Actual parts extracted: {self.stats['parts_extracted']}\n"
        report += f"- Match status: {'PASS' if self.stats['parts_extracted'] == 658 else 'REVIEW'}\n"
        report += f"- All parts have product codes: {'YES' if self.stats['parts_extracted'] == len([p for p in self.parsed_parts if p['product_code'].startswith('WCP-')]) else 'NO'}\n"
        report += f"- All parts have prices: {'YES' if all(p['price'] > 0 for p in self.parsed_parts) else 'PARTIAL'}\n"
        report += f"- Duplicate codes found: {self.stats['duplicate_codes']}\n"

        report += f"\n## Status\n\n"
        if self.stats['parts_extracted'] == 658 and self.stats['parts_matched'] == 658:
            report += "**Phase 2 Complete - Ready for Phase 3**\n"
        else:
            report += f"**Phase 2 Complete with {self.stats['parts_unmatched']} unmatched parts - Review needed**\n"

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)

        print(f"Report saved to {report_path}")


def main():
    """Main execution function."""
    import sys
    base_path = Path('/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing')

    parser = WCPPartParser(
        bulk_csv_path=base_path / 'Bulk_Product_Addition.csv',
        spec_config_path=base_path / 'Spreadsheets' / 'spec_config_import.csv'
    )

    # Load spec configurations
    parser.load_spec_configs()

    # Parse bulk CSV (with debug if --debug flag passed)
    parser.parse_bulk_csv(debug='--debug' in sys.argv)

    # Save results
    parser.save_results(base_path / 'parsed_parts.json')

    # Generate report
    parser.generate_report(base_path / 'PHASE_2_REPORT.md')

    # Print summary
    print("\n" + "="*60)
    print("PHASE 2 PARSING COMPLETE")
    print("="*60)
    print(f"Total lines read: {parser.stats['total_lines']}")
    print(f"Parts extracted: {parser.stats['parts_extracted']}")
    print(f"Parts matched: {parser.stats['parts_matched']}")
    print(f"Parts unmatched: {parser.stats['parts_unmatched']}")
    print(f"Duplicate codes: {parser.stats['duplicate_codes']}")
    print("\nCategory Distribution:")
    for cat_code, count in sorted(parser.stats['category_distribution'].items()):
        print(f"  {cat_code}: {count}")

    if parser.stats['parts_extracted'] == 658:
        print("\nTarget part count (658) achieved!")
    else:
        print(f"\nWarning: Expected 658 parts, got {parser.stats['parts_extracted']}")

    print("\nFiles created:")
    print(f"  - {base_path / 'parsed_parts.json'}")
    print(f"  - {base_path / 'PHASE_2_REPORT.md'}")

    if parser.stats['parts_matched'] == parser.stats['parts_extracted']:
        print("\nPhase 2 complete - ready for Phase 3")
    else:
        print(f"\nPhase 2 complete with {parser.stats['parts_unmatched']} unmatched parts")


if __name__ == '__main__':
    main()
