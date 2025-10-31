#!/usr/bin/env python3
"""
Phase 3: Extract specifications from part names using category-specific patterns.
"""

import json
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime


class SpecExtractor:
    """Extract specifications from part names based on category patterns."""

    def __init__(self):
        """Initialize regex patterns for different categories."""
        # Common patterns
        self.thread_pattern = re.compile(r'(#\d+-\d+|\d+/\d+"-\d+)')
        self.teeth_pattern = re.compile(r'(\d+)[tT](?:\s|$|\)|,)')
        self.dim_pattern = re.compile(r'(\d+\.?\d*)\s?(?:"|mm|in)')
        self.dp_pattern = re.compile(r'(\d+)\s?DP')
        self.bore_pattern = re.compile(r'((?:\d+/\d+|CIM|Motor|Hex|Rounded Hex)[^,]*(?:Bore|Hex))')
        self.pack_pattern = re.compile(r'(\d+-Pack)')
        self.material_pattern = re.compile(r'\b(Steel|Aluminum|Brass|Carbon Fiber|Delrin|Nylon|Rubber|Plastic)\b', re.IGNORECASE)

    def extract_dimensions(self, text: str, count: int = 3) -> List[str]:
        """Extract multiple dimensions from text in order."""
        matches = self.dim_pattern.findall(text)
        result = []
        for i in range(count):
            if i < len(matches):
                # Reconstruct with units
                if '"' in text[text.find(matches[i]):text.find(matches[i])+20]:
                    result.append(f'{matches[i]}"')
                elif 'mm' in text[text.find(matches[i]):text.find(matches[i])+20]:
                    result.append(f'{matches[i]}mm')
                else:
                    result.append(matches[i])
            else:
                result.append('')
        return result

    def extract_from_parentheses(self, text: str) -> List[str]:
        """Extract content from parentheses."""
        paren_pattern = re.compile(r'\(([^)]+)\)')
        return paren_pattern.findall(text)

    def extract_fastener_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for FAST category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Thread size
        thread_match = self.thread_pattern.search(part_name)
        if thread_match:
            specs['spec1'] = thread_match.group(1)

        # Spec 2: Length - extract second dimension or first if only one
        dims = self.extract_dimensions(part_name, 2)
        if len(dims) >= 2 and dims[1]:
            specs['spec2'] = dims[1]
        elif dims[0]:
            specs['spec2'] = dims[0]

        # Spec 3: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec3'] = material_match.group(1).title()

        # Spec 4: Finish - look in parentheses or common finishes
        paren_content = self.extract_from_parentheses(part_name)
        finish_keywords = ['Black Oxide', 'Zinc', 'Ultra Low Profile', 'ULP', 'Stainless', 'Galvanized']
        for keyword in finish_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec4'] = keyword
                break
        if not specs['spec4'] and paren_content:
            # Check if parentheses contain finish info
            for content in paren_content:
                if any(f in content for f in ['Oxide', 'Zinc', 'Profile', 'Stainless']):
                    specs['spec4'] = content
                    break

        # Spec 5: Pack size
        pack_match = self.pack_pattern.search(part_name)
        if pack_match:
            specs['spec5'] = pack_match.group(1)

        return specs

    def extract_gear_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for GEAR category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Tooth count
        teeth_match = self.teeth_pattern.search(part_name)
        if teeth_match:
            specs['spec1'] = f"{teeth_match.group(1)}t"

        # Spec 2: DP (Diametral Pitch)
        dp_match = self.dp_pattern.search(part_name)
        if dp_match:
            specs['spec2'] = f"{dp_match.group(1)} DP"

        # Spec 3: Bore size
        bore_keywords = ['Hex Bore', 'Rounded Hex', 'CIM', 'Motor']
        for keyword in bore_keywords:
            if keyword.lower() in part_name.lower():
                # Extract dimension before keyword if present
                pattern = re.compile(rf'(\d+/\d+"\s*{keyword})', re.IGNORECASE)
                match = pattern.search(part_name)
                if match:
                    specs['spec3'] = match.group(1)
                else:
                    specs['spec3'] = keyword
                break

        # Spec 4: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec4'] = material_match.group(1).title()

        # Spec 5: Style
        style_keywords = ['Pocketed', 'Spur', 'MotionX', 'SplineXS', 'SplineXL']
        for keyword in style_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec5'] = keyword
                break

        return specs

    def extract_bearing_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for BEAR category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Extract all dimensions (ID, OD, Width)
        dims = self.extract_dimensions(part_name, 3)
        specs['spec1'] = dims[0]  # ID
        specs['spec2'] = dims[1]  # OD
        specs['spec3'] = dims[2]  # Width

        # Spec 4: Type
        type_keywords = ['Radial', 'Flanged', 'Thrust', 'X-Contact', 'Needle', 'Ball']
        for keyword in type_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec4'] = keyword
                break

        # Spec 5: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec5'] = material_match.group(1).title()

        return specs

    def extract_belt_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for BELT category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Tooth count
        teeth_match = self.teeth_pattern.search(part_name)
        if teeth_match:
            specs['spec1'] = f"{teeth_match.group(1)}t"

        # Spec 2: Width
        width_pattern = re.compile(r'(\d+)\s?mm', re.IGNORECASE)
        width_match = width_pattern.search(part_name)
        if width_match:
            specs['spec2'] = f"{width_match.group(1)}mm"

        # Spec 3: Material - usually in parentheses
        paren_content = self.extract_from_parentheses(part_name)
        if paren_content:
            specs['spec3'] = paren_content[0]

        # Spec 4: HTD Pitch
        htd_pattern = re.compile(r'(\d+mm)\s*HTD', re.IGNORECASE)
        htd_match = htd_pattern.search(part_name)
        if htd_match:
            specs['spec4'] = htd_match.group(1)

        # Spec 5: Belt Type
        type_keywords = ['HTD', 'GT2', 'Timing']
        for keyword in type_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec5'] = keyword
                break

        return specs

    def extract_pulley_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for PULLEY category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Tooth count
        teeth_match = self.teeth_pattern.search(part_name)
        if teeth_match:
            specs['spec1'] = f"{teeth_match.group(1)}t"

        # Spec 2: Width
        width_pattern = re.compile(r'(\d+)\s?mm', re.IGNORECASE)
        width_match = width_pattern.search(part_name)
        if width_match:
            specs['spec2'] = f"{width_match.group(1)}mm"

        # Spec 3: Bore size
        bore_keywords = ['Hex Bore', 'Hex', 'Round Bore']
        for keyword in bore_keywords:
            if keyword.lower() in part_name.lower():
                # Extract dimension before keyword if present
                pattern = re.compile(rf'(\d+/\d+"\s*{keyword})', re.IGNORECASE)
                match = pattern.search(part_name)
                if match:
                    specs['spec3'] = match.group(1)
                else:
                    specs['spec3'] = keyword
                break

        # Spec 4: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec4'] = material_match.group(1).title()

        # Spec 5: Belt Type
        type_keywords = ['HTD', 'GT2']
        for keyword in type_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec5'] = keyword
                break

        return specs

    def extract_sprocket_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for SPKT category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Tooth count
        teeth_match = self.teeth_pattern.search(part_name)
        if teeth_match:
            specs['spec1'] = f"{teeth_match.group(1)}t"

        # Spec 2: Chain size
        chain_pattern = re.compile(r'(#\d+)')
        chain_match = chain_pattern.search(part_name)
        if chain_match:
            specs['spec2'] = chain_match.group(1)

        # Spec 3: Bore size
        bore_keywords = ['Hex Bore', 'Hex', 'CIM', 'Motor']
        for keyword in bore_keywords:
            if keyword.lower() in part_name.lower():
                # Extract dimension before keyword if present
                pattern = re.compile(rf'(\d+/\d+"\s*{keyword})', re.IGNORECASE)
                match = pattern.search(part_name)
                if match:
                    specs['spec3'] = match.group(1)
                else:
                    specs['spec3'] = keyword
                break

        # Spec 4: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec4'] = material_match.group(1).title()

        # Spec 5: Hub Type
        hub_keywords = ['Standard', 'Plate', 'SplineXL', 'SplineXS']
        for keyword in hub_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec5'] = keyword
                break

        return specs

    def extract_hardware_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for HDWR category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Extract dimensions (ID, OD, Width)
        dims = self.extract_dimensions(part_name, 3)
        specs['spec1'] = dims[0]  # ID
        specs['spec2'] = dims[1]  # OD
        specs['spec3'] = dims[2]  # Width/Length

        # Spec 4: Type
        type_keywords = ['Spacer', 'Washer', 'Nut Strip', 'Tube Plug', 'Bushing', 'Standoff']
        for keyword in type_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec4'] = keyword
                break

        # Spec 5: Pack size
        pack_match = self.pack_pattern.search(part_name)
        if pack_match:
            specs['spec5'] = pack_match.group(1)

        return specs

    def extract_shaft_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for SHAFT/STOCK category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Extract dimensions (OD, ID, Length)
        dims = self.extract_dimensions(part_name, 3)
        specs['spec1'] = dims[0]  # OD
        specs['spec2'] = dims[1]  # ID (for hollow)
        if len(dims) > 2:
            specs['spec3'] = dims[2]  # Length

        # Spec 4: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec4'] = material_match.group(1).title()

        # Spec 5: Profile
        profile_keywords = ['Hex', 'Round', 'Hollow', 'Solid', 'Tube', 'Rod']
        for keyword in profile_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec5'] = keyword
                break

        return specs

    def extract_wheel_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for WHEEL category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Wheel type
        type_keywords = ['Omni', 'Mecanum', 'Colson', 'Stealth', 'FlexWheel']
        for keyword in type_keywords:
            if keyword.lower() in part_name.lower():
                specs['spec1'] = keyword
                break

        # Extract dimensions
        dims = self.extract_dimensions(part_name, 2)
        specs['spec2'] = dims[0]  # Diameter
        specs['spec3'] = dims[1]  # Width

        # Spec 4: Durometer
        durometer_pattern = re.compile(r'(\d+A)')
        durometer_match = durometer_pattern.search(part_name)
        if durometer_match:
            specs['spec4'] = durometer_match.group(1)

        # Spec 5: Material
        material_match = self.material_pattern.search(part_name)
        if material_match:
            specs['spec5'] = material_match.group(1).title()

        return specs

    def extract_motor_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for MOTOR category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Spec 1: Motor model
        model_pattern = re.compile(r'(CIM|Mini CIM|BAG|775|NEO|Falcon|Kraken)', re.IGNORECASE)
        model_match = model_pattern.search(part_name)
        if model_match:
            specs['spec1'] = model_match.group(1).upper()

        # Spec 2: Free speed (RPM)
        rpm_pattern = re.compile(r'(\d+)\s*RPM', re.IGNORECASE)
        rpm_match = rpm_pattern.search(part_name)
        if rpm_match:
            specs['spec2'] = f"{rpm_match.group(1)} RPM"

        # Spec 3: Torque
        torque_pattern = re.compile(r'(\d+\.?\d*)\s*(?:in-lbs|Nm)', re.IGNORECASE)
        torque_match = torque_pattern.search(part_name)
        if torque_match:
            specs['spec3'] = torque_match.group(0)

        return specs

    def extract_chain_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for CHAIN category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Chain size
        chain_pattern = re.compile(r'(#\d+)')
        chain_match = chain_pattern.search(part_name)
        if chain_match:
            specs['spec1'] = chain_match.group(1)

        # Length
        dims = self.extract_dimensions(part_name, 1)
        if dims[0]:
            specs['spec2'] = dims[0]

        # Link count
        link_pattern = re.compile(r'(\d+)\s*(?:Link|L)', re.IGNORECASE)
        link_match = link_pattern.search(part_name)
        if link_match:
            specs['spec3'] = f"{link_match.group(1)} Links"

        return specs

    def extract_ctrl_specs(self, part_name: str) -> Dict[str, str]:
        """Extract specs for CTRL category."""
        specs = {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}

        # Extract any model numbers or key identifiers
        # This is more freeform - extract key terms

        return specs

    def extract_specifications(self, part: Dict) -> Dict[str, str]:
        """Extract specifications based on category code."""
        category = part.get('category_code', '')
        part_name = part.get('part_name', '')

        extractors = {
            'FAST': self.extract_fastener_specs,
            'GEAR': self.extract_gear_specs,
            'BEAR': self.extract_bearing_specs,
            'BELT': self.extract_belt_specs,
            'PULLEY': self.extract_pulley_specs,
            'SPKT': self.extract_sprocket_specs,
            'CHAIN': self.extract_chain_specs,
            'HDWR': self.extract_hardware_specs,
            'SHAFT': self.extract_shaft_specs,
            'STOCK': self.extract_shaft_specs,
            'MOTOR': self.extract_motor_specs,
            'WHEEL': self.extract_wheel_specs,
            'CTRL': self.extract_ctrl_specs,
        }

        extractor = extractors.get(category)
        if extractor:
            return extractor(part_name)
        else:
            # Default: empty specs
            return {'spec1': '', 'spec2': '', 'spec3': '', 'spec4': '', 'spec5': ''}


def calculate_coverage(specs: Dict[str, str]) -> int:
    """Count how many specs are populated."""
    return sum(1 for v in specs.values() if v)


def process_parts(input_file: str, output_file: str, report_file: str):
    """Process all parts and extract specifications."""
    print("Phase 3: Extracting specifications from part names")
    print("=" * 60)

    # Load input data
    print(f"\nLoading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    parts = data.get('parts', [])
    print(f"Total parts to process: {len(parts)}")

    # Initialize extractor
    extractor = SpecExtractor()

    # Process each part
    category_stats = {}
    coverage_distribution = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for i, part in enumerate(parts):
        # Extract specifications
        specs = extractor.extract_specifications(part)
        coverage = calculate_coverage(specs)

        # Add to part
        part['specifications'] = specs
        part['coverage'] = coverage

        # Update statistics
        category = part.get('category_code', 'UNKNOWN')
        if category not in category_stats:
            category_stats[category] = {
                'total': 0,
                'coverage_sum': 0,
                'coverage_dist': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            }

        category_stats[category]['total'] += 1
        category_stats[category]['coverage_sum'] += coverage
        category_stats[category]['coverage_dist'][coverage] += 1
        coverage_distribution[coverage] += 1

        # Progress
        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(parts)} parts...")

    print(f"\nProcessed all {len(parts)} parts")

    # Calculate overall coverage
    total_specs_possible = len(parts) * 5
    total_specs_extracted = sum(p['coverage'] for p in parts)
    overall_coverage_pct = (total_specs_extracted / total_specs_possible) * 100

    # Create output data
    output_data = {
        'metadata': {
            'total_parts': len(parts),
            'source': 'parsed_parts.json',
            'extraction_date': datetime.now().strftime('%Y-%m-%d'),
            'overall_coverage': f"{overall_coverage_pct:.1f}%",
            'total_specs_possible': total_specs_possible,
            'total_specs_extracted': total_specs_extracted,
            'category_coverage': {}
        },
        'parts': parts
    }

    # Calculate category coverage
    for category, stats in sorted(category_stats.items()):
        avg_coverage = stats['coverage_sum'] / stats['total']
        coverage_pct = (stats['coverage_sum'] / (stats['total'] * 5)) * 100
        output_data['metadata']['category_coverage'][category] = {
            'total_parts': stats['total'],
            'average_specs': f"{avg_coverage:.1f}",
            'coverage_percentage': f"{coverage_pct:.1f}%",
            'distribution': stats['coverage_dist']
        }

    # Save output file
    print(f"\nSaving: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # Generate report
    print(f"Generating: {report_file}")
    generate_report(output_data, category_stats, coverage_distribution, report_file)

    print("\nPhase 3 complete!")


def generate_report(data: Dict, category_stats: Dict, coverage_dist: Dict, report_file: str):
    """Generate Phase 3 report."""
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("# Phase 3 Report: Specification Extraction\n\n")
        f.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        # Overall statistics
        f.write("## Overall Statistics\n\n")
        metadata = data['metadata']
        f.write(f"- **Total Parts Processed:** {metadata['total_parts']}\n")
        f.write(f"- **Total Specs Possible:** {metadata['total_specs_possible']}\n")
        f.write(f"- **Total Specs Extracted:** {metadata['total_specs_extracted']}\n")
        f.write(f"- **Overall Coverage:** {metadata['overall_coverage']}\n\n")

        # Coverage distribution
        f.write("## Coverage Distribution\n\n")
        f.write("| Specs Populated | Part Count | Percentage |\n")
        f.write("|-----------------|------------|------------|\n")
        total_parts = metadata['total_parts']
        for i in range(6):
            count = coverage_dist[i]
            pct = (count / total_parts) * 100
            f.write(f"| {i} specs | {count} | {pct:.1f}% |\n")
        f.write("\n")

        # Category breakdown
        f.write("## Category Breakdown\n\n")
        f.write("| Category | Parts | Avg Specs | Coverage | 5 Specs | 4+ Specs | 0 Specs |\n")
        f.write("|----------|-------|-----------|----------|---------|----------|----------|\n")

        for category, info in sorted(metadata['category_coverage'].items()):
            dist = info['distribution']
            five_specs = dist.get(5, 0)
            four_plus = dist.get(4, 0) + dist.get(5, 0)
            zero_specs = dist.get(0, 0)

            f.write(f"| {category} | {info['total_parts']} | {info['average_specs']} | ")
            f.write(f"{info['coverage_percentage']} | {five_specs} | {four_plus} | {zero_specs} |\n")
        f.write("\n")

        # Sample extractions by category
        f.write("## Sample Extractions by Category\n\n")

        parts_by_category = {}
        for part in data['parts']:
            cat = part.get('category_code', 'UNKNOWN')
            if cat not in parts_by_category:
                parts_by_category[cat] = []
            parts_by_category[cat].append(part)

        for category in sorted(parts_by_category.keys()):
            f.write(f"### {category}\n\n")

            # Get samples with good coverage
            samples = [p for p in parts_by_category[category] if p['coverage'] >= 4]
            if not samples:
                samples = parts_by_category[category][:5]
            else:
                samples = samples[:5]

            for part in samples:
                f.write(f"**{part['part_name']}**\n")
                f.write(f"- Product Code: {part['product_code']}\n")
                f.write(f"- Coverage: {part['coverage']}/5 specs\n")

                if part.get('spec_labels'):
                    f.write("- Specifications:\n")
                    for i in range(1, 6):
                        label = part['spec_labels'].get(f'spec{i}', f'Spec {i}')
                        value = part['specifications'].get(f'spec{i}', '')
                        if value:
                            f.write(f"  - {label}: {value}\n")
                        else:
                            f.write(f"  - {label}: (not extracted)\n")
                f.write("\n")

            f.write("\n")

        # Parts with 0 specs
        f.write("## Parts with 0 Specifications Extracted\n\n")
        zero_spec_parts = [p for p in data['parts'] if p['coverage'] == 0]

        if zero_spec_parts:
            f.write(f"Total parts with 0 specs: {len(zero_spec_parts)}\n\n")
            f.write("First 20 parts:\n\n")
            for part in zero_spec_parts[:20]:
                f.write(f"- {part['part_name']} ({part['product_code']}) - {part['category_code']}\n")
        else:
            f.write("No parts with 0 specifications!\n")

        f.write("\n")

        # Extraction quality assessment
        f.write("## Extraction Quality Assessment\n\n")

        # Calculate per-category targets
        targets = {
            'FAST': 90,
            'GEAR': 95,
            'BEAR': 85,
            'BELT': 95,
            'PULLEY': 90,
            'SPKT': 90,
        }

        f.write("| Category | Target | Actual | Status |\n")
        f.write("|----------|--------|--------|--------|\n")

        for category, target in sorted(targets.items()):
            if category in metadata['category_coverage']:
                info = metadata['category_coverage'][category]
                actual = float(info['coverage_percentage'].rstrip('%'))
                status = "PASS" if actual >= target else "NEEDS IMPROVEMENT"
                f.write(f"| {category} | {target}% | {info['coverage_percentage']} | {status} |\n")

        f.write("\n")

        # Conclusion
        f.write("## Conclusion\n\n")
        overall_pct = float(metadata['overall_coverage'].rstrip('%'))

        if overall_pct >= 85:
            f.write("Extraction quality: EXCELLENT\n")
            f.write("Ready to proceed to Phase 4.\n")
        elif overall_pct >= 75:
            f.write("Extraction quality: GOOD\n")
            f.write("Can proceed to Phase 4 with minor improvements expected.\n")
        else:
            f.write("Extraction quality: NEEDS IMPROVEMENT\n")
            f.write("Consider refining extraction patterns before Phase 4.\n")


if __name__ == '__main__':
    input_file = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/parsed_parts.json'
    output_file = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/parts_with_specs.json'
    report_file = '/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/PHASE_3_REPORT.md'

    process_parts(input_file, output_file, report_file)
