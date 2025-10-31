#!/usr/bin/env python3
"""
Intelligent Parts Classification System
Classifies WCP parts into 29 FRC categories using pattern matching and semantic analysis.
"""

import re
import json
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass


@dataclass
class Category:
    """Category definition with code, name, and description."""
    code: str
    name: str
    description: str


@dataclass
class Classification:
    """Classification result for a part."""
    category_code: str
    category_name: str
    confidence: float
    reasoning: str


class PartClassifier:
    """Intelligent classification system for FRC parts."""

    def __init__(self, categories_csv_path: str):
        self.categories: Dict[str, Category] = {}
        self.load_categories(categories_csv_path)

        # Compile regex patterns for performance
        self.patterns = self._compile_patterns()

    def load_categories(self, csv_path: str):
        """Load category definitions from CSV."""
        import csv

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row['Code'].strip()
                self.categories[code] = Category(
                    code=code,
                    name=row['Category'].strip(),
                    description=row['Description'].strip()
                )

        print(f"Loaded {len(self.categories)} categories")

    def _compile_patterns(self) -> Dict[str, re.Pattern]:
        """Compile all regex patterns for specification extraction."""
        return {
            # Thread sizes
            'thread_hash': re.compile(r'#(\d+)-(\d+)'),
            'thread_fraction': re.compile(r'(\d+/\d+)-(\d+)'),
            'thread_metric': re.compile(r'M(\d+)x([\d.]+)'),

            # Lengths
            'length_inches': re.compile(r'(\d+\.?\d*)\s*["\']|(\d+\.?\d*)\s*in|x\s*(\d+\.?\d*)"'),

            # Tooth counts
            'teeth': re.compile(r'(\d+)T|(\d+)\s*[Tt]ooth'),

            # Pack quantities
            'pack': re.compile(r'(\d+)-Pack|(\d+)\s*Pack|\((\d+)\s*Pack\)', re.IGNORECASE),

            # Product codes
            'product_code': re.compile(r'WCP-(\d+)'),

            # Bore types
            'bore': re.compile(r'(Hex Bore|Round Bore|Thunderhex|SplineXS|SplineXL|Keyed|Hex|Round)', re.IGNORECASE),

            # Dimensions
            'dimensions': re.compile(r'(\d+\.?\d*)\s*x\s*(\d+\.?\d*)'),
            'outer_diameter': re.compile(r'(\d+\.?\d*)["\']?\s*OD'),

            # Chain/Belt types
            'chain_type': re.compile(r'#(25|35)'),
            'belt_type': re.compile(r'(GT2|GT3|HTD)\s*(\d+mm)?', re.IGNORECASE),

            # Diametral pitch
            'dp': re.compile(r'(\d+)\s*DP'),
        }

    def classify(self, part: Dict) -> Classification:
        """
        Classify a single part using pattern matching and semantic analysis.
        Returns classification with confidence score.
        """
        name = part['original_name']
        name_lower = name.lower()
        section = part.get('section', '')
        subsection = part.get('subsection', '')

        # Try high confidence pattern matching first (0.95+)
        classification = self._high_confidence_patterns(name, name_lower, section, subsection)
        if classification:
            return classification

        # Try medium confidence patterns (0.70-0.94)
        classification = self._medium_confidence_patterns(name, name_lower, section, subsection)
        if classification:
            return classification

        # Low confidence fallback
        return self._low_confidence_fallback(name, name_lower, section, subsection)

    def _high_confidence_patterns(self, name: str, name_lower: str, section: str, subsection: str) -> Optional[Classification]:
        """High confidence pattern matching (0.95+)."""

        # Fasteners - very specific patterns
        if any(x in name for x in ['BHCS', 'SHCS', 'PHCS', 'Button Head', 'Socket Head', 'Pan Head']):
            return Classification('FAST', 'Fasteners', 0.98, 'Contains fastener type abbreviation')

        if any(x in name_lower for x in ['washer', 'rivet', 'nut strip', 'nut', 'bolt', 'screw']):
            return Classification('FAST', 'Fasteners', 0.95, 'Contains fastener keyword')

        # Gears - has tooth count
        if 'gear' in name_lower and self.patterns['teeth'].search(name):
            if 'motor gear' in name_lower or 'pinion' in name_lower:
                return Classification('GEAR', 'Gears', 0.97, 'Motor gear or pinion with tooth count')
            return Classification('GEAR', 'Gears', 0.96, 'Spur gear with tooth count')

        # Timing belts
        if 'timing belt' in name_lower or (any(x in name for x in ['GT2', 'GT3', 'HTD']) and 'belt' in name_lower):
            return Classification('BELT', 'Belts', 0.98, 'Timing belt with type specification')

        # Pulleys
        if 'pulley' in name_lower and any(x in name for x in ['GT2', 'GT3', 'HTD']):
            return Classification('PULLEY', 'Pulleys', 0.97, 'HTD pulley with tooth profile')

        # Sprockets
        if 'sprocket' in name_lower:
            return Classification('SPKT', 'Sprockets', 0.97, 'Contains sprocket keyword')

        # Chain
        if self.patterns['chain_type'].search(name) and any(x in name_lower for x in ['chain', 'master link', 'half link', 'connecting link']):
            return Classification('CHAIN', 'Chain', 0.98, 'Chain with size specification')

        # Bearings
        if any(x in name_lower for x in ['bearing', 'bushing', 'pillow block']):
            if 'thunderhex' in name_lower:
                return Classification('BEAR', 'Bearings', 0.98, 'Thunderhex bearing')
            return Classification('BEAR', 'Bearings', 0.95, 'Contains bearing keyword')

        # Motors
        if any(x in name_lower for x in ['falcon', 'neo', 'cim', 'motor', '775', 'bag motor']):
            return Classification('MOTOR', 'Motors', 0.98, 'Contains motor model name')

        # Pneumatics
        if any(x in name_lower for x in ['cylinder', 'valve', 'pneumatic', 'solenoid', 'compressor']):
            return Classification('PNEU', 'Pneumatics', 0.96, 'Pneumatic component')

        # Control System
        if any(x in name_lower for x in ['roborio', 'pdp', 'pdh', 'breaker', 'radio', 'driver station', 'rsl']):
            return Classification('CTRL', 'Control System', 0.98, 'Control system component')

        # Electronics (Motor Controllers)
        if any(x in name_lower for x in ['talon', 'victor', 'spark max', 'spark flex', 'controller']):
            return Classification('ELEC', 'Electronics', 0.97, 'Motor controller')

        # Shafts and Hubs
        if any(x in name_lower for x in ['shaft', 'hex shaft', 'thunderhex', 'maxspline']):
            return Classification('SHAFT', 'Shafts & Hubs', 0.96, 'Shaft component')

        if any(x in name_lower for x in ['hub', 'collar', 'spacer']) and 'hex' in name_lower:
            return Classification('SHAFT', 'Shafts & Hubs', 0.95, 'Hub or collar for shaft')

        # Wheels
        if any(x in name_lower for x in ['wheel', 'caster', 'omni', 'mecanum', 'colson', 'traction wheel']):
            return Classification('WHEEL', 'Wheels & Casters', 0.97, 'Wheel or caster')

        # Structural
        if any(x in name_lower for x in ['versaframe', 'maxtube', 'extrusion', 'tube', 'channel', 'gusset']):
            if 'tube plug' in name_lower:
                return Classification('HDWR', 'Hardware', 0.95, 'Tube plug accessory')
            return Classification('STRUCT', 'Structural', 0.95, 'Structural component')

        # Hardware accessories
        if any(x in name_lower for x in ['bracket', 'hinge', 'gas shock', 'cable carrier', 'mount']):
            return Classification('HDWR', 'Hardware', 0.94, 'Hardware accessory')

        # Sensors
        if any(x in name_lower for x in ['limelight', 'encoder', 'limit switch', 'photoeye', 'sensor', 'color sensor']):
            return Classification('SENSOR', 'Sensors', 0.97, 'Sensor component')

        # Wiring
        if any(x in name_lower for x in ['wire', 'cable', 'connector', 'pwm', 'can', 'anderson']):
            return Classification('WIRE', 'Wiring', 0.96, 'Wiring component')

        return None

    def _medium_confidence_patterns(self, name: str, name_lower: str, section: str, subsection: str) -> Optional[Classification]:
        """Medium confidence pattern matching using section/subsection context (0.70-0.94)."""

        # Use section name as strong hint
        if section:
            section_lower = section.lower()

            if 'gear' in section_lower:
                return Classification('GEAR', 'Gears', 0.85, f'Part in "{section}" section')

            if 'belt' in section_lower and 'pulley' not in section_lower:
                return Classification('BELT', 'Belts', 0.80, f'Part in "{section}" section')

            if 'pulley' in section_lower:
                return Classification('PULLEY', 'Pulleys', 0.85, f'Part in "{section}" section')

            if 'sprocket' in section_lower:
                return Classification('SPKT', 'Sprockets', 0.85, f'Part in "{section}" section')

            if 'chain' in section_lower:
                return Classification('CHAIN', 'Chain', 0.80, f'Part in "{section}" section')

            if 'bearing' in section_lower:
                return Classification('BEAR', 'Bearings', 0.80, f'Part in "{section}" section')

            if 'shaft' in section_lower or 'hub' in section_lower:
                return Classification('SHAFT', 'Shafts & Hubs', 0.85, f'Part in "{section}" section')

            if 'wheel' in section_lower:
                return Classification('WHEEL', 'Wheels & Casters', 0.85, f'Part in "{section}" section')

            if 'frame' in section_lower or 'structure' in section_lower:
                return Classification('STRUCT', 'Structural', 0.80, f'Part in "{section}" section')

        # Material-based classification
        if 'aluminum' in name_lower and 'gear' in name_lower:
            return Classification('GEAR', 'Gears', 0.75, 'Aluminum gear component')

        if 'steel' in name_lower and any(x in name_lower for x in ['bolt', 'screw', 'shoulder']):
            return Classification('FAST', 'Fasteners', 0.80, 'Steel fastener')

        # Size-based hints
        if self.patterns['thread_hash'].search(name) or self.patterns['thread_fraction'].search(name):
            return Classification('FAST', 'Fasteners', 0.85, 'Contains thread specification')

        return None

    def _low_confidence_fallback(self, name: str, name_lower: str, section: str, subsection: str) -> Classification:
        """Low confidence fallback classification (<0.70)."""

        # Default to Hardware for miscellaneous items
        return Classification(
            'HDWR',
            'Hardware',
            0.50,
            f'Low confidence - defaulting to Hardware (Section: {section})'
        )

    def classify_all(self, parts: List[Dict]) -> List[Dict]:
        """Classify all parts and add classification data."""
        classified = []
        confidence_bins = {'high': 0, 'medium': 0, 'low': 0}
        category_counts = {code: 0 for code in self.categories.keys()}

        print(f"\nClassifying {len(parts)} parts...")

        for i, part in enumerate(parts, 1):
            classification = self.classify(part)

            # Add classification to part
            part['classified_category_code'] = classification.category_code
            part['classified_category_name'] = classification.category_name
            part['classification_confidence'] = classification.confidence
            part['classification_reasoning'] = classification.reasoning

            classified.append(part)

            # Update stats
            if classification.confidence >= 0.95:
                confidence_bins['high'] += 1
            elif classification.confidence >= 0.70:
                confidence_bins['medium'] += 1
            else:
                confidence_bins['low'] += 1

            category_counts[classification.category_code] += 1

            # Progress indicator
            if i % 100 == 0:
                print(f"  Classified {i}/{len(parts)} parts...")

        # Print statistics
        print(f"\nClassification complete:")
        print(f"  High confidence (>=0.95): {confidence_bins['high']}")
        print(f"  Medium confidence (0.70-0.94): {confidence_bins['medium']}")
        print(f"  Low confidence (<0.70): {confidence_bins['low']}")

        avg_confidence = sum(p['classification_confidence'] for p in classified) / len(classified)
        print(f"  Average confidence: {avg_confidence:.3f}")

        print(f"\nCategory distribution:")
        for code, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            if count > 0:
                cat = self.categories[code]
                print(f"  {code:6s} ({cat.name:25s}): {count:3d} parts")

        return classified


def main():
    """Main execution function."""
    # File paths
    parsed_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_parsed.json"
    categories_csv = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/frc_new_categories.csv"
    output_json = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_classified.json"

    # Load parsed parts
    with open(parsed_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        parts = data['parts']

    # Initialize classifier
    classifier = PartClassifier(categories_csv)

    # Classify all parts
    classified_parts = classifier.classify_all(parts)

    # Save results
    output = {
        'parts': classified_parts,
        'metadata': {
            'total_parts': len(classified_parts),
            'classification_stats': {
                'high_confidence': sum(1 for p in classified_parts if p['classification_confidence'] >= 0.95),
                'medium_confidence': sum(1 for p in classified_parts if 0.70 <= p['classification_confidence'] < 0.95),
                'low_confidence': sum(1 for p in classified_parts if p['classification_confidence'] < 0.70),
            },
            'category_distribution': {}
        }
    }

    # Calculate category distribution
    for part in classified_parts:
        code = part['classified_category_code']
        output['metadata']['category_distribution'][code] = output['metadata']['category_distribution'].get(code, 0) + 1

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved classified parts to: {output_json}")

    # Show sample classifications
    print("\n=== Sample Classifications ===")
    samples = [
        classified_parts[0],  # First part
        classified_parts[50] if len(classified_parts) > 50 else None,
        classified_parts[100] if len(classified_parts) > 100 else None,
        classified_parts[200] if len(classified_parts) > 200 else None,
        classified_parts[-1],  # Last part
    ]

    for i, part in enumerate([p for p in samples if p], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Product Code: {part['product_code']}")
        print(f"   Section: {part['section']} / {part['subsection']}")
        print(f"   Classified As: {part['classified_category_code']} - {part['classified_category_name']}")
        print(f"   Confidence: {part['classification_confidence']:.2f}")
        print(f"   Reasoning: {part['classification_reasoning']}")


if __name__ == "__main__":
    main()
