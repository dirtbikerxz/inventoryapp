#!/usr/bin/env python3
"""
Final Output Generator
Generates structured JSON output with cleaned names, URLs, and all extracted data.
"""

import re
import json
from typing import Dict, List
from pathlib import Path


class OutputGenerator:
    """Generate final structured output with cleaned data and URLs."""

    def __init__(self):
        self.supplier = "WCP"
        self.base_url = "https://www.wcproducts.com/products/"

    def clean_part_name(self, original_name: str, specs: Dict) -> str:
        """
        Clean part name by removing pack quantities and redundant info.
        Keep essential specifications.
        """
        name = original_name

        # Remove pack quantity text
        name = re.sub(r'\s*\(?\d+-Pack\)?', '', name, flags=re.IGNORECASE)
        name = re.sub(r'\s*\(\d+\s*Pack\)', '', name, flags=re.IGNORECASE)

        # Remove stock status text that might have leaked in
        name = re.sub(r'\s*(In Stock|Out of Stock|BackOrdered).*$', '', name, flags=re.IGNORECASE)

        # Clean up extra spaces
        name = re.sub(r'\s+', ' ', name)
        name = name.strip()

        # Normalize quote marks
        name = name.replace('"', '"').replace('"', '"')

        return name

    def generate_product_url(self, product_code: str, section: str) -> str:
        """
        Generate WCP product URL from product code.
        Format: https://www.wcproducts.com/products/wcp-####
        """
        # Extract numeric part from WCP-#### format
        code_match = re.search(r'WCP-(\d+)', product_code)
        if not code_match:
            return ""

        code_num = code_match.group(1)

        # Simple URL format - WCP uses lowercase product codes in URLs
        return f"{self.base_url}wcp-{code_num}"

    def format_specifications(self, specs: Dict, category: str) -> Dict:
        """
        Format specifications into structured fields based on category.
        Maps extracted specs to standard field names.
        """
        formatted = {}

        # Common fields
        if 'material' in specs:
            formatted['material'] = specs['material']

        if 'pack_quantity' in specs:
            formatted['pack_quantity'] = specs['pack_quantity']

        # Category-specific fields
        if category == 'FAST':  # Fasteners
            if 'type' in specs:
                formatted['fastener_type'] = specs['type']
            if 'thread_size' in specs:
                formatted['thread_size'] = specs['thread_size']
            if 'length' in specs:
                formatted['length'] = specs['length']
            if 'surface_treatment' in specs:
                formatted['surface_treatment'] = specs['surface_treatment']

        elif category == 'GEAR':  # Gears
            if 'teeth' in specs:
                formatted['teeth'] = specs['teeth']
            if 'dp' in specs:
                formatted['diametral_pitch'] = specs['dp']
            if 'bore_type' in specs:
                formatted['bore_type'] = specs['bore_type']
            if 'bore_size' in specs:
                formatted['bore_size'] = specs['bore_size']

        elif category in ['PULLEY', 'SPKT']:  # Pulleys and Sprockets
            if 'teeth' in specs:
                formatted['teeth'] = specs['teeth']
            if 'bore_type' in specs:
                formatted['bore_type'] = specs['bore_type']
            if 'bore_size' in specs:
                formatted['bore_size'] = specs['bore_size']

        elif category == 'CHAIN':  # Chain
            if 'chain_type' in specs:
                formatted['chain_size'] = specs['chain_type']
            if 'length' in specs:
                formatted['length'] = specs['length']

        elif category == 'BELT':  # Belts
            if 'belt_type' in specs:
                formatted['belt_profile'] = specs['belt_type']
            if 'length' in specs:
                formatted['length'] = specs['length']

        elif category in ['SHAFT', 'STRUCT', 'STOCK']:  # Dimensional
            if 'dimensions' in specs:
                formatted['dimensions'] = specs['dimensions']

        elif category == 'BEAR':  # Bearings
            if 'bore_type' in specs:
                formatted['bore_type'] = specs['bore_type']
            if 'bore_size' in specs:
                formatted['bore_size'] = specs['bore_size']

        return formatted

    def generate_final_output(self, parts: List[Dict]) -> Dict:
        """Generate final structured JSON output."""
        print(f"\nGenerating final output for {len(parts)} parts...")

        output_parts = []

        for i, part in enumerate(parts, 1):
            specs = part.get('specifications', {})
            category = part['classified_category_code']

            # Generate cleaned name
            cleaned_name = self.clean_part_name(part['original_name'], specs)

            # Generate product URL
            supplier_url = self.generate_product_url(part['product_code'], part.get('section', ''))

            # Format specifications
            formatted_specs = self.format_specifications(specs, category)

            # Build output part structure
            output_part = {
                'original_name': part['original_name'],
                'cleaned_name': cleaned_name,
                'product_code': part['product_code'],
                'classified_category_code': category,
                'classified_category_name': part['classified_category_name'],
                'classification_confidence': part['classification_confidence'],
                'specifications': formatted_specs,
                'pack_quantity': formatted_specs.get('pack_quantity', 1),
                'unit_cost': part['price'],
                'supplier': self.supplier,
                'supplier_url': supplier_url,
                'wcp_section': part.get('section', ''),
                'wcp_subsection': part.get('subsection', '')
            }

            output_parts.append(output_part)

            # Progress indicator
            if i % 100 == 0:
                print(f"  Processed {i}/{len(parts)} parts...")

        # Calculate metadata statistics
        metadata = self._calculate_metadata(output_parts)

        return {
            'parts': output_parts,
            'metadata': metadata
        }

    def _calculate_metadata(self, parts: List[Dict]) -> Dict:
        """Calculate metadata statistics."""
        # Classification confidence bins
        high_conf = sum(1 for p in parts if p['classification_confidence'] >= 0.95)
        medium_conf = sum(1 for p in parts if 0.70 <= p['classification_confidence'] < 0.95)
        low_conf = sum(1 for p in parts if p['classification_confidence'] < 0.70)

        # Category distribution
        category_dist = {}
        for part in parts:
            code = part['classified_category_code']
            category_dist[code] = category_dist.get(code, 0) + 1

        # Specification coverage
        parts_with_specs = sum(1 for p in parts if len(p['specifications']) > 1)

        return {
            'total_parts': len(parts),
            'classification_stats': {
                'high_confidence': high_conf,
                'medium_confidence': medium_conf,
                'low_confidence': low_conf,
                'average_confidence': sum(p['classification_confidence'] for p in parts) / len(parts)
            },
            'category_distribution': category_dist,
            'specification_extraction': {
                'parts_with_specs': parts_with_specs,
                'coverage_percentage': (parts_with_specs / len(parts)) * 100
            }
        }


def main():
    """Main execution function."""
    # File paths
    input_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_with_specs.json"
    output_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_parsed_classified.json"

    # Load parts with specifications
    with open(input_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        parts = data['parts']

    # Initialize generator
    generator = OutputGenerator()

    # Generate final output
    output = generator.generate_final_output(parts)

    # Save final output
    output_path = Path(output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved final output to: {output_json}")

    # Print summary
    metadata = output['metadata']
    print("\n" + "=" * 60)
    print("FINAL OUTPUT SUMMARY")
    print("=" * 60)
    print(f"\nTotal Parts Processed: {metadata['total_parts']}")

    print(f"\nClassification Quality:")
    print(f"  High Confidence (>=0.95):    {metadata['classification_stats']['high_confidence']:4d} parts")
    print(f"  Medium Confidence (0.70-0.94): {metadata['classification_stats']['medium_confidence']:4d} parts")
    print(f"  Low Confidence (<0.70):       {metadata['classification_stats']['low_confidence']:4d} parts")
    print(f"  Average Confidence:           {metadata['classification_stats']['average_confidence']:.3f}")

    print(f"\nSpecification Extraction:")
    print(f"  Parts with specs: {metadata['specification_extraction']['parts_with_specs']} ({metadata['specification_extraction']['coverage_percentage']:.1f}%)")

    print(f"\nCategory Distribution (Top 10):")
    sorted_cats = sorted(metadata['category_distribution'].items(), key=lambda x: x[1], reverse=True)
    for code, count in sorted_cats[:10]:
        pct = (count / metadata['total_parts']) * 100
        print(f"  {code:6s}: {count:4d} parts ({pct:5.1f}%)")

    # Show sample parts
    print("\n" + "=" * 60)
    print("SAMPLE CLASSIFIED PARTS")
    print("=" * 60)

    sample_indices = [0, 50, 100, 200, len(output['parts']) - 1]
    samples = [output['parts'][i] for i in sample_indices if i < len(output['parts'])]

    for i, part in enumerate(samples, 1):
        print(f"\n{i}. {part['cleaned_name']}")
        print(f"   Product Code: {part['product_code']}")
        print(f"   Category: {part['classified_category_code']} - {part['classified_category_name']}")
        print(f"   Confidence: {part['classification_confidence']:.2f}")
        print(f"   Price: ${part['unit_cost']:.2f}")
        print(f"   Pack Qty: {part['pack_quantity']}")
        print(f"   URL: {part['supplier_url']}")
        if part['specifications']:
            print(f"   Specifications:")
            for key, value in part['specifications'].items():
                if key != 'pack_quantity':
                    print(f"     {key}: {value}")

    # Flag low confidence items for review
    low_conf_parts = [p for p in output['parts'] if p['classification_confidence'] < 0.70]
    if low_conf_parts:
        print("\n" + "=" * 60)
        print(f"LOW CONFIDENCE ITEMS FOR REVIEW ({len(low_conf_parts)} items)")
        print("=" * 60)
        for i, part in enumerate(low_conf_parts[:10], 1):  # Show first 10
            print(f"\n{i}. {part['cleaned_name']}")
            print(f"   Product Code: {part['product_code']}")
            print(f"   Section: {part['wcp_section']}")
            print(f"   Classified As: {part['classified_category_code']} (confidence: {part['classification_confidence']:.2f})")


if __name__ == "__main__":
    main()
