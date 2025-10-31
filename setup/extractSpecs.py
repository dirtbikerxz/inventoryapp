#!/usr/bin/env python3
"""
Specification Extraction System
Extracts technical specifications from part names using regex patterns.
"""

import re
import json
from typing import Dict, List, Optional
from pathlib import Path


class SpecExtractor:
    """Extract specifications from part names based on category."""

    def __init__(self):
        # Compile regex patterns for performance
        self.patterns = self._compile_patterns()

    def _compile_patterns(self) -> Dict[str, re.Pattern]:
        """Compile all regex patterns for specification extraction."""
        return {
            # Thread sizes
            'thread_hash': re.compile(r'#(\d+)-(\d+)'),
            'thread_fraction': re.compile(r'(\d+/\d+)-(\d+)'),
            'thread_metric': re.compile(r'M(\d+)x([\d.]+)'),

            # Lengths - multiple patterns
            'length_decimal': re.compile(r'(\d+\.\d+)"\s*L\b'),
            'length_fraction': re.compile(r'(\d+/\d+)"\s*L\b'),
            'length_after_x': re.compile(r'x\s*(\d+\.?\d*)"'),
            'length_generic': re.compile(r'\s(\d+\.?\d*)"\s'),

            # Tooth counts
            'teeth': re.compile(r'\b(\d+)t\b', re.IGNORECASE),
            'teeth_word': re.compile(r'(\d+)\s*[Tt]ooth'),

            # Pack quantities
            'pack_dash': re.compile(r'(\d+)-Pack', re.IGNORECASE),
            'pack_paren': re.compile(r'\((\d+)\s*Pack\)', re.IGNORECASE),
            'pack_word': re.compile(r'(\d+)\s*Pack\b', re.IGNORECASE),

            # Bore types
            'bore_hex_size': re.compile(r'(\d+/\d+|\d+\.?\d*)"\s*Hex\s*Bore'),
            'bore_type': re.compile(r'(Hex Bore|Round Bore|Thunderhex|SplineXS|SplineXL|Keyed Bore)', re.IGNORECASE),

            # Dimensions
            'dimensions': re.compile(r'(\d+\.?\d*)\s*x\s*(\d+\.?\d*)'),
            'outer_diameter': re.compile(r'(\d+\.?\d*)["\']?\s*OD'),
            'inner_diameter': re.compile(r'(\d+\.?\d*)["\']?\s*ID'),

            # Chain/Belt types
            'chain_type': re.compile(r'#(25|35)'),
            'belt_type': re.compile(r'(GT2|GT3|HTD)\s*(\d+mm)?', re.IGNORECASE),

            # Diametral pitch
            'dp': re.compile(r'(\d+)\s*DP'),

            # Material
            'material': re.compile(r'\((Steel|Aluminum|Plastic|Nylon|Delrin|Polycarbonate)', re.IGNORECASE),

            # Fastener types
            'fastener_type': re.compile(r'\b(BHCS|SHCS|PHCS|FHCS|Button Head|Socket Head|Pan Head|Flat Head)\b', re.IGNORECASE),

            # Surface treatment
            'surface': re.compile(r'(Black Oxide|Zinc|Stainless|Anodized)', re.IGNORECASE),
        }

    def extract_thread_size(self, name: str) -> Optional[str]:
        """Extract thread size from part name."""
        # Try #10-32 format
        match = self.patterns['thread_hash'].search(name)
        if match:
            return f"#{match.group(1)}-{match.group(2)}"

        # Try 1/4-20 format
        match = self.patterns['thread_fraction'].search(name)
        if match:
            return f"{match.group(1)}-{match.group(2)}"

        # Try M3x0.5 format
        match = self.patterns['thread_metric'].search(name)
        if match:
            return f"M{match.group(1)}x{match.group(2)}"

        return None

    def extract_length(self, name: str) -> Optional[str]:
        """Extract length from part name."""
        # Try decimal length with L marker: 0.500" L
        match = self.patterns['length_decimal'].search(name)
        if match:
            return f"{match.group(1)}\""

        # Try fraction length: 1/4" L
        match = self.patterns['length_fraction'].search(name)
        if match:
            return f"{match.group(1)}\""

        # Try length after x: x 0.5"
        match = self.patterns['length_after_x'].search(name)
        if match:
            return f"{match.group(1)}\""

        # Try generic length with spaces
        match = self.patterns['length_generic'].search(name)
        if match:
            return f"{match.group(1)}\""

        return None

    def extract_tooth_count(self, name: str) -> Optional[str]:
        """Extract tooth count from part name."""
        # Try "14t" format
        match = self.patterns['teeth'].search(name)
        if match:
            return f"{match.group(1)}T"

        # Try "14 Tooth" format
        match = self.patterns['teeth_word'].search(name)
        if match:
            return f"{match.group(1)}T"

        return None

    def extract_pack_quantity(self, name: str) -> int:
        """Extract pack quantity from part name, default to 1."""
        # Try "(50-Pack)" format
        match = self.patterns['pack_dash'].search(name)
        if match:
            return int(match.group(1))

        # Try "(50 Pack)" format
        match = self.patterns['pack_paren'].search(name)
        if match:
            return int(match.group(1))

        # Try "50 Pack" format
        match = self.patterns['pack_word'].search(name)
        if match:
            return int(match.group(1))

        return 1

    def extract_bore_info(self, name: str) -> Dict[str, Optional[str]]:
        """Extract bore size and type."""
        bore_info = {
            'bore_type': None,
            'bore_size': None
        }

        # Extract bore size (e.g., "3/8" Hex Bore")
        match = self.patterns['bore_hex_size'].search(name)
        if match:
            bore_info['bore_size'] = f"{match.group(1)}\""
            bore_info['bore_type'] = "Hex"

        # Extract bore type
        match = self.patterns['bore_type'].search(name)
        if match:
            bore_type = match.group(1)
            if 'hex' in bore_type.lower():
                bore_info['bore_type'] = "Hex"
            elif 'round' in bore_type.lower():
                bore_info['bore_type'] = "Round"
            elif 'thunderhex' in bore_type.lower():
                bore_info['bore_type'] = "Thunderhex"
            elif 'splinexs' in bore_type.lower():
                bore_info['bore_type'] = "SplineXS"
            elif 'splinexl' in bore_type.lower():
                bore_info['bore_type'] = "SplineXL"
            elif 'keyed' in bore_type.lower():
                bore_info['bore_type'] = "Keyed"

        return bore_info

    def extract_material(self, name: str) -> Optional[str]:
        """Extract material from part name."""
        match = self.patterns['material'].search(name)
        if match:
            return match.group(1).capitalize()
        return None

    def extract_fastener_type(self, name: str) -> Optional[str]:
        """Extract fastener type abbreviation."""
        match = self.patterns['fastener_type'].search(name)
        if match:
            type_str = match.group(1).upper()
            # Normalize to abbreviations
            if type_str in ['BHCS', 'SHCS', 'PHCS', 'FHCS']:
                return type_str
            elif 'BUTTON' in type_str:
                return 'BHCS'
            elif 'SOCKET' in type_str:
                return 'SHCS'
            elif 'PAN' in type_str:
                return 'PHCS'
            elif 'FLAT' in type_str:
                return 'FHCS'
        return None

    def extract_surface_treatment(self, name: str) -> Optional[str]:
        """Extract surface treatment."""
        match = self.patterns['surface'].search(name)
        if match:
            return match.group(1)
        return None

    def extract_diametral_pitch(self, name: str) -> Optional[str]:
        """Extract diametral pitch for gears."""
        match = self.patterns['dp'].search(name)
        if match:
            return f"{match.group(1)} DP"
        return None

    def extract_chain_type(self, name: str) -> Optional[str]:
        """Extract chain type (#25 or #35)."""
        match = self.patterns['chain_type'].search(name)
        if match:
            return f"#{match.group(1)}"
        return None

    def extract_belt_type(self, name: str) -> Optional[str]:
        """Extract timing belt type."""
        match = self.patterns['belt_type'].search(name)
        if match:
            belt_type = match.group(1).upper()
            width = match.group(2) if match.group(2) else ""
            return f"{belt_type} {width}".strip()
        return None

    def extract_dimensions(self, name: str) -> Optional[str]:
        """Extract dimensions (e.g., 1.5 x 24)."""
        match = self.patterns['dimensions'].search(name)
        if match:
            return f"{match.group(1)} x {match.group(2)}"
        return None

    def extract_specifications(self, part: Dict) -> Dict:
        """
        Extract all relevant specifications for a part based on its category.
        Returns a dictionary of specifications.
        """
        name = part['original_name']
        category = part['classified_category_code']

        specs = {
            'pack_quantity': self.extract_pack_quantity(name),
        }

        # Category-specific extraction
        if category == 'FAST':  # Fasteners
            specs['thread_size'] = self.extract_thread_size(name)
            specs['length'] = self.extract_length(name)
            specs['type'] = self.extract_fastener_type(name)
            specs['material'] = self.extract_material(name)
            specs['surface_treatment'] = self.extract_surface_treatment(name)

        elif category == 'GEAR':  # Gears
            specs['teeth'] = self.extract_tooth_count(name)
            specs['dp'] = self.extract_diametral_pitch(name)
            bore_info = self.extract_bore_info(name)
            specs['bore_type'] = bore_info['bore_type']
            specs['bore_size'] = bore_info['bore_size']
            specs['material'] = self.extract_material(name)

        elif category in ['PULLEY', 'SPKT']:  # Pulleys and Sprockets
            specs['teeth'] = self.extract_tooth_count(name)
            bore_info = self.extract_bore_info(name)
            specs['bore_type'] = bore_info['bore_type']
            specs['bore_size'] = bore_info['bore_size']

        elif category == 'CHAIN':  # Chain
            specs['chain_type'] = self.extract_chain_type(name)
            specs['length'] = self.extract_length(name)

        elif category == 'BELT':  # Belts
            specs['belt_type'] = self.extract_belt_type(name)
            specs['length'] = self.extract_length(name)

        elif category in ['SHAFT', 'STRUCT', 'STOCK']:  # Dimensional parts
            specs['dimensions'] = self.extract_dimensions(name)
            specs['material'] = self.extract_material(name)

        elif category == 'BEAR':  # Bearings
            bore_info = self.extract_bore_info(name)
            specs['bore_type'] = bore_info['bore_type']
            specs['bore_size'] = bore_info['bore_size']

        # Remove None values
        specs = {k: v for k, v in specs.items() if v is not None}

        return specs

    def process_all(self, parts: List[Dict]) -> List[Dict]:
        """Process all parts and extract specifications."""
        print(f"\nExtracting specifications from {len(parts)} parts...")

        spec_coverage = 0

        for i, part in enumerate(parts, 1):
            specs = self.extract_specifications(part)
            part['specifications'] = specs

            # Count parts with meaningful specs (more than just pack_quantity)
            if len(specs) > 1 or (len(specs) == 1 and 'pack_quantity' not in specs):
                spec_coverage += 1

            # Progress indicator
            if i % 100 == 0:
                print(f"  Processed {i}/{len(parts)} parts...")

        coverage_pct = (spec_coverage / len(parts)) * 100
        print(f"\nSpecification extraction complete:")
        print(f"  Parts with extracted specs: {spec_coverage} ({coverage_pct:.1f}%)")

        return parts


def main():
    """Main execution function."""
    # File paths
    classified_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_classified.json"
    output_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_with_specs.json"

    # Load classified parts
    with open(classified_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        parts = data['parts']

    # Initialize extractor
    extractor = SpecExtractor()

    # Extract specifications
    parts_with_specs = extractor.process_all(parts)

    # Update metadata
    data['parts'] = parts_with_specs

    # Save results
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved parts with specifications to: {output_json}")

    # Show sample specifications
    print("\n=== Sample Specifications ===")
    samples = [
        parts_with_specs[0],
        parts_with_specs[50] if len(parts_with_specs) > 50 else None,
        parts_with_specs[100] if len(parts_with_specs) > 100 else None,
        parts_with_specs[200] if len(parts_with_specs) > 200 else None,
        parts_with_specs[-1],
    ]

    for i, part in enumerate([p for p in samples if p], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Category: {part['classified_category_code']} - {part['classified_category_name']}")
        print(f"   Specifications:")
        for key, value in part['specifications'].items():
            print(f"     {key}: {value}")


if __name__ == "__main__":
    main()
