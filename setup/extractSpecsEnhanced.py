#!/usr/bin/env python3
"""
Enhanced Specification Extraction System
Extracts technical specifications from part names using regex patterns.
Enhanced version with improved STRUCT, SHAFT, and HDWR extraction.
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
            'material': re.compile(r'\((Steel|Aluminum|Carbon Fiber|Plastic|Nylon|Delrin|Polycarbonate)', re.IGNORECASE),
            'material_word': re.compile(r'\b(Steel|Aluminum|Carbon Fiber|Plastic|Nylon|Delrin|Polycarbonate)\b', re.IGNORECASE),

            # Fastener types
            'fastener_type': re.compile(r'\b(BHCS|SHCS|PHCS|FHCS|Button Head|Socket Head|Pan Head|Flat Head)\b', re.IGNORECASE),

            # Surface treatment
            'surface': re.compile(r'(Black Oxide|Zinc|Stainless|Anodized)', re.IGNORECASE),

            # STRUCT specific patterns
            'struct_od': re.compile(r'(\d+\.?\d*)"?\s*\(?\d*\.?\d*mm\)?\s*OD'),
            'struct_id': re.compile(r'(\d+\.?\d*)"?\s*(Hex)?\s*\(?\d*\.?\d*mm\)?\s*ID'),
            'struct_length_paren': re.compile(r'\((\d+)"\s*[LlBore]*\)'),
            'struct_material': re.compile(r'(Aluminum|Carbon Fiber|Steel)\s+(?:Round\s+)?Tube', re.IGNORECASE),

            # SHAFT spacer specific patterns
            'spacer_width': re.compile(r'(\d+(?:/\d+)?(?:\.\d+)?)"?\s*WD'),
            'spacer_id_hex': re.compile(r'(\d+(?:/\d+)?(?:\.\d+)?)"?\s*Hex\s*ID'),
            'spacer_id_spline': re.compile(r'(\d+mm)\s*SplineXS?\s*ID'),
            'spacer_od': re.compile(r'(\d+(?:/\d+)?(?:\.\d+)?)"?\s*OD'),
            'spacer_material': re.compile(r'\b(Aluminum|Plastic|Steel|Nylon)\s+Spacer', re.IGNORECASE),

            # HDWR tube plug specific patterns
            'plug_dimensions': re.compile(r'(\d+\.?\d*)"?x(\d+\.?\d*)"?x'),
            'plug_thickness': re.compile(r'x\.?(\d+\.?\d*)"'),
            'plug_thread': re.compile(r'(#\d+-\d+)\s*Tapped'),
            'plug_material': re.compile(r'(Aluminum|Steel|Plastic)\s+Tube\s+Plug', re.IGNORECASE),
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
        # Try material in parentheses first
        match = self.patterns['material'].search(name)
        if match:
            return match.group(1).capitalize()

        # Try material as word
        match = self.patterns['material_word'].search(name)
        if match:
            material = match.group(1)
            if 'carbon' in material.lower():
                return "Carbon Fiber"
            return material.capitalize()

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

    # NEW ENHANCED EXTRACTION FUNCTIONS

    def extract_structural_specs(self, name: str) -> Dict[str, Optional[str]]:
        """
        Extract specifications from structural tube parts.
        Handles patterns like: .75" OD x .500" Hex ID Aluminum Round Tube Stock (36")
        """
        specs = {}

        # Extract OD - handle leading decimal points and quotes
        od_match = re.search(r'(\.?\d+\.?\d*)[\"\']*\s*(?:\(?\d*\.?\d*mm\))?\s*OD', name)
        if od_match:
            specs['od'] = f"{od_match.group(1)}\""

        # Extract ID (may include "Hex") - handle leading decimal points and quotes
        id_match = re.search(r'(\.?\d+\.?\d*)[\"\']*\s*(Hex)?\s*(?:\(?\d*\.?\d*mm\))?\s*ID', name)
        if id_match:
            id_val = id_match.group(1)
            hex_marker = id_match.group(2)
            if hex_marker:
                specs['id'] = f"{id_val}\" Hex"
            else:
                specs['id'] = f"{id_val}\""

        # Extract length - look for parentheses with inches
        length_match = re.search(r'\((\d+)[\"\']*\s*[LlBore]*\)', name)
        if length_match:
            specs['length'] = f"{length_match.group(1)}\""

        # Extract material
        material_match = re.search(r'(Aluminum|Carbon Fiber|Steel)\s+(?:Round\s+)?Tube', name, re.IGNORECASE)
        if material_match:
            material = material_match.group(1)
            if 'carbon' in material.lower():
                specs['material'] = "Carbon Fiber"
            else:
                specs['material'] = material.capitalize()

        return specs

    def extract_spacer_specs(self, name: str) -> Dict[str, Optional[str]]:
        """
        Extract specifications from spacer parts.
        Handles patterns like: 1/8" WD x .196" ID x 3/8" OD Aluminum Spacers
        """
        specs = {}

        # Extract width - handle fractions and decimals
        width_match = re.search(r'(\d+(?:/\d+)?(?:-\d+(?:/\d+)?)?(?:\.\d+)?)[\"\']*\s*WD', name)
        if width_match:
            specs['width'] = f"{width_match.group(1)}\""

        # Extract ID (may be Hex, SplineXS, or plain decimal)
        # Try Hex ID first
        id_hex_match = re.search(r'(\.?\d+(?:/\d+)?(?:\.\d+)?)[\"\']*\s*Hex\s*ID', name)
        if id_hex_match:
            specs['id'] = f"{id_hex_match.group(1)}\" Hex"
        else:
            # Try SplineXS ID
            id_spline_match = re.search(r'(\d+mm)\s*SplineXS?\s*ID', name)
            if id_spline_match:
                specs['id'] = f"{id_spline_match.group(1)} SplineXS"
            else:
                # Try plain ID - handle leading decimal point
                id_plain_match = re.search(r'(\.?\d+\.?\d*)[\"\']*\s*ID', name)
                if id_plain_match:
                    specs['id'] = f"{id_plain_match.group(1)}\""

        # Extract OD - handle fractions and decimals
        od_match = re.search(r'(\d+(?:/\d+)?(?:\.\d+)?)[\"\']*\s*OD', name)
        if od_match:
            specs['od'] = f"{od_match.group(1)}\""

        # Extract material
        material_match = re.search(r'\b(Aluminum|Plastic|Steel|Nylon)\s+Spacer', name, re.IGNORECASE)
        if material_match:
            specs['material'] = material_match.group(1).capitalize()

        return specs

    def extract_tube_plug_specs(self, name: str) -> Dict[str, Optional[str]]:
        """
        Extract specifications from tube plug parts.
        Handles patterns like: 1.5"x1.5"x.125" Aluminum Tube Plug (#10-32 Tapped)
        """
        specs = {}

        # Extract all three dimensions: first x second x thickness
        # Handle leading decimal points properly
        dims_match = re.search(r'(\d+\.?\d*)[\"\']*x(\d+\.?\d*)[\"\']*x(\.?\d+\.?\d*)[\"\']*', name)
        if dims_match:
            specs['dimensions'] = f"{dims_match.group(1)}\" x {dims_match.group(2)}\""
            specs['thickness'] = f"{dims_match.group(3)}\""

        # Extract thread
        thread_match = re.search(r'(#\d+-\d+)\s*Tapped', name)
        if thread_match:
            specs['thread'] = f"{thread_match.group(1)} Tapped"

        # Extract material
        material_match = re.search(r'(Aluminum|Steel|Plastic)\s+Tube\s+Plug', name, re.IGNORECASE)
        if material_match:
            specs['material'] = material_match.group(1).capitalize()

        return specs

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

        elif category == 'STRUCT':  # ENHANCED: Structural tubes
            struct_specs = self.extract_structural_specs(name)
            specs.update(struct_specs)

        elif category == 'SHAFT':  # ENHANCED: Shafts and spacers
            # Check if it's a spacer
            if 'spacer' in name.lower():
                spacer_specs = self.extract_spacer_specs(name)
                specs.update(spacer_specs)
            else:
                # Regular shaft specs (basic dimensions)
                specs['dimensions'] = self.extract_dimensions(name)
                specs['material'] = self.extract_material(name)

        elif category == 'HDWR':  # ENHANCED: Hardware including tube plugs
            # Check if it's a tube plug
            if 'tube plug' in name.lower():
                plug_specs = self.extract_tube_plug_specs(name)
                specs.update(plug_specs)
            else:
                # Generic hardware specs
                specs['dimensions'] = self.extract_dimensions(name)
                specs['material'] = self.extract_material(name)

        elif category == 'STOCK':  # Raw stock
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
        category_stats = {}

        for i, part in enumerate(parts, 1):
            specs = self.extract_specifications(part)
            part['specifications'] = specs

            # Track category statistics
            category = part['classified_category_code']
            if category not in category_stats:
                category_stats[category] = {'total': 0, 'with_specs': 0}

            category_stats[category]['total'] += 1

            # Count parts with meaningful specs (more than just pack_quantity)
            if len(specs) > 1 or (len(specs) == 1 and 'pack_quantity' not in specs):
                spec_coverage += 1
                category_stats[category]['with_specs'] += 1

            # Progress indicator
            if i % 100 == 0:
                print(f"  Processed {i}/{len(parts)} parts...")

        coverage_pct = (spec_coverage / len(parts)) * 100
        print(f"\nSpecification extraction complete:")
        print(f"  Parts with extracted specs: {spec_coverage} ({coverage_pct:.1f}%)")

        print("\n=== Coverage by Category ===")
        for cat in sorted(category_stats.keys()):
            total = category_stats[cat]['total']
            with_specs = category_stats[cat]['with_specs']
            pct = (with_specs / total * 100) if total > 0 else 0
            print(f"  {cat}: {with_specs}/{total} ({pct:.1f}%)")

        return parts


def apply_corrections(parts: List[Dict]) -> List[Dict]:
    """
    Apply the 27 corrections from Phase 1B.
    - Reclassify 23 spacers from GEAR to SHAFT
    - Reclassify 4 CAN devices from FAST to ELEC
    """
    corrections_applied = 0

    print("\nApplying Phase 1B corrections...")

    for part in parts:
        name = part['original_name'].lower()

        # Correction 1: Spacers should be SHAFT, not GEAR
        if 'spacer' in name and part['classified_category_code'] == 'GEAR':
            part['classified_category_code'] = 'SHAFT'
            part['classified_category_name'] = 'Shafts & Hubs'
            corrections_applied += 1
            print(f"  Corrected spacer: {part['original_name'][:60]}...")

        # Correction 2: CAN devices should be ELEC, not FAST
        if any(keyword in name for keyword in ['can wire', 'can cable', 'candlelight', 'candle']) and part['classified_category_code'] == 'FAST':
            part['classified_category_code'] = 'ELEC'
            part['classified_category_name'] = 'Electronics'
            corrections_applied += 1
            print(f"  Corrected CAN device: {part['original_name'][:60]}...")

    print(f"\nApplied {corrections_applied} corrections")
    return parts


def generate_url(part: Dict) -> str:
    """Generate WCP URL from product code."""
    product_code = part.get('product_code', '')
    if product_code:
        return f"https://wcproducts.com/products/{product_code.lower()}"
    return ""


def main():
    """Main execution function."""
    # File paths
    classified_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_classified.json"
    output_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_final_enhanced.json"

    print("=" * 70)
    print("ENHANCED SPECIFICATION EXTRACTION PIPELINE")
    print("=" * 70)

    # Load classified parts
    print("\nLoading classified parts...")
    with open(classified_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        parts = data['parts']
    print(f"Loaded {len(parts)} parts")

    # Apply corrections from Phase 1B
    parts = apply_corrections(parts)

    # Initialize extractor
    extractor = SpecExtractor()

    # Extract specifications
    parts_with_specs = extractor.process_all(parts)

    # Generate URLs
    print("\nGenerating URLs...")
    for part in parts_with_specs:
        part['url'] = generate_url(part)

    # Update metadata
    data['parts'] = parts_with_specs
    data['metadata']['enhancements'] = {
        'enhanced_categories': ['STRUCT', 'SHAFT', 'HDWR'],
        'corrections_applied': 27,
        'spec_extraction_version': '2.0'
    }

    # Save results
    print(f"\nSaving results...")
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved enhanced parts to: {output_json}")

    # Show sample specifications
    print("\n" + "=" * 70)
    print("SAMPLE ENHANCED SPECIFICATIONS")
    print("=" * 70)

    # Show STRUCT samples
    struct_parts = [p for p in parts_with_specs if p['classified_category_code'] == 'STRUCT']
    print(f"\n=== STRUCT Parts (Total: {len(struct_parts)}) ===")
    for i, part in enumerate(struct_parts[:5], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Specifications:")
        for key, value in part['specifications'].items():
            print(f"     {key}: {value}")

    # Show SHAFT samples (spacers)
    shaft_parts = [p for p in parts_with_specs if p['classified_category_code'] == 'SHAFT' and 'spacer' in p['original_name'].lower()]
    print(f"\n=== SHAFT Parts - Spacers (Total: {len(shaft_parts)}) ===")
    for i, part in enumerate(shaft_parts[:5], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Specifications:")
        for key, value in part['specifications'].items():
            print(f"     {key}: {value}")

    # Show HDWR samples (tube plugs)
    hdwr_parts = [p for p in parts_with_specs if p['classified_category_code'] == 'HDWR' and 'plug' in p['original_name'].lower()]
    print(f"\n=== HDWR Parts - Tube Plugs (Total: {len(hdwr_parts)}) ===")
    for i, part in enumerate(hdwr_parts[:5], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Specifications:")
        for key, value in part['specifications'].items():
            print(f"     {key}: {value}")

    # Validation
    print("\n" + "=" * 70)
    print("VALIDATION")
    print("=" * 70)
    print(f"Total parts: {len(parts_with_specs)}")
    print(f"Expected: 587")
    print(f"Match: {'YES' if len(parts_with_specs) == 587 else 'NO - DATA LOSS!'}")


if __name__ == "__main__":
    main()
