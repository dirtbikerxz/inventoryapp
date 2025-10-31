#!/usr/bin/env python3
"""
Comprehensive WCP Parts Classification and Spec Extraction Fix

Fixes:
1. Reclassifies misclassified parts (endmills, collets, hex stock, etc.)
2. Extracts specs for all categories (BEAR, WIRE, BELT, GEAR, MACH, STOCK, etc.)
3. Applies spacer corrections (GEAR -> SHAFT)
4. Generates corrected JSON and detailed report
"""

import csv
import json
import re
from typing import Dict, List, Tuple, Any, Optional
from collections import defaultdict
from dataclasses import dataclass, asdict
import sys

@dataclass
class Part:
    """Represents a single part with all attributes"""
    part_name: str
    product_code: str
    category_code: str
    category_name: str
    subcategory: str
    specifications: Dict[str, str]
    pack_quantity: int
    unit_cost: float
    supplier: str
    supplier_url: str
    confidence: float
    original_category: str = ""  # Track reclassifications
    reclassification_reason: str = ""
    spec_extraction_method: str = ""

class WCPPartsProcessor:
    """Main processor for WCP parts data"""

    def __init__(self):
        self.parts: List[Part] = []
        self.reclassifications: List[Dict] = []
        self.spec_extractions: Dict[str, int] = defaultdict(int)
        self.category_counts: Dict[str, int] = defaultdict(int)

        # Category mapping
        self.category_map = {
            'BOLT': 'Bolts and Screws',
            'NUT': 'Nuts',
            'WASH': 'Washers',
            'GEAR': 'Gears and Sprockets',
            'BELT': 'Belts and Pulleys',
            'CHAIN': 'Chain and Sprockets',
            'SHAFT': 'Shafts and Spacers',
            'BEAR': 'Bearings',
            'WHEEL': 'Wheels and Traction',
            'MOTOR': 'Motors',
            'CTRL': 'Motor Controllers',
            'SENSOR': 'Sensors',
            'PNEUM': 'Pneumatics',
            'WIRE': 'Wiring and Cables',
            'ELEC': 'Electronics',
            'STOCK': 'Raw Stock',
            'MACH': 'Machining Tools',
            'HDWR': 'Hardware and Fasteners'
        }

        # Reclassification patterns (ordered by priority)
        self.reclassification_patterns = {
            'BELT': [
                (r'\d+t\s*x\s*\d+mm\s*[Ww]ide.*[Tt]iming\s*[Bb]elt', 'Timing belt with specs'),
                (r'timing\s*belt.*GT2', 'GT2 timing belt'),
                (r'timing\s*belt.*HTD', 'HTD timing belt'),
                (r'[Kk]evlar.*[Bb]elt', 'Kevlar belt'),
                (r'\d+\'\s*x\s*\d+mm.*[Bb]elt', 'Timing belt with length')
            ],
            'CHAIN': [
                (r'#25.*[Cc]hain(?!\s*[Ll]ink)', 'Standard #25 chain'),
                (r'#35.*[Cc]hain(?!\s*[Ll]ink)', 'Standard #35 chain'),
                (r'\d+/\d+".*[Pp]itch.*[Cc]hain', 'Pitch chain')
            ],
            'BEAR': [
                (r'\d+\.?\d*"\s*ID\s*x\s*\d+\.?\d*"\s*OD.*[Bb]earing', 'Bearing with dimensions'),
                (r'[Ff]langed\s*[Bb]earing', 'Flanged bearing'),
                (r'[Tt]hrust\s*[Bb]earing', 'Thrust bearing'),
                (r'[Bb]all\s*[Bb]earing', 'Ball bearing'),
                (r'\d+\.?\d*"\s*ID.*WD.*[Bb]earing', 'Bearing with width')
            ],
            'WHEEL': [
                (r'\d+"?\s*[Ww]heel', 'Wheel with diameter'),
                (r'[Cc]olson\s*[Ww]heel', 'Colson wheel'),
                (r'[Oo]mni\s*[Ww]heel', 'Omni wheel'),
                (r'[Mm]ecanum\s*[Ww]heel', 'Mecanum wheel'),
                (r'\d+\.?\d*"\s*[Dd]ia.*[Ww]heel', 'Wheel with diameter spec')
            ],
            'WIRE': [
                (r'\d+\s*AWG.*[Ww]ire', 'Wire with gauge'),
                (r'PWM\s*[Cc]able', 'PWM cable'),
                (r'CAN\s*[Cc]able', 'CAN cable'),
                (r'[Pp]ower\s*[Cc]able', 'Power cable'),
                (r'[Ss]ignal\s*[Cc]able', 'Signal cable')
            ],
            'MACH': [
                (r'endmill|end\s*mill', 'Endmill/cutting tool'),
                (r'collet', 'Collet/tool holder'),
                (r'drill\s*bit', 'Drill bit'),
                (r'tap\s*(?:set)?', 'Tap/threading tool'),
                (r'die\s*(?:set)?', 'Die/threading tool'),
                (r'router\s*bit', 'Router bit'),
                (r'carbide.*(?:mill|bit)', 'Carbide cutting tool'),
                (r'(?:single|double|multi)\s*flute', 'Fluted cutting tool'),
                (r'cnc.*(?:bit|tool)', 'CNC tool'),
                (r'boring\s*bar', 'Boring tool')
            ],
            'STOCK': [
                (r'hex\s*stock', 'Hex stock material'),
                (r'round.*hex\s*stock', 'Round hex stock'),
                (r'rounded\s*hex\s*stock', 'Rounded hex stock'),
                (r'bar\s*stock', 'Bar stock material'),
                (r'od.*hex\s*stock', 'Hex stock with OD spec'),
                (r'oversized.*hex.*stock', 'Oversized hex stock'),
                (r'tube.*stock', 'Tube stock'),
                (r'sheet.*stock', 'Sheet stock')
            ],
            'HDWR': [
                (r'cable\s*chain', 'Cable chain/carrier'),
                (r'energy\s*chain', 'Energy chain'),
                (r'bi\s*directional.*chain', 'Bidirectional chain'),
                (r'cable\s*carrier', 'Cable carrier'),
                (r'#25\s*[\d.]+\s*link', 'Chain link'),
                (r'#35\s*[\d.]+\s*link', 'Chain link')
            ],
            'SENSOR': [
                (r'CANcoder', 'CANcoder sensor'),
                (r'CANrange', 'CANrange sensor'),
                (r'(?<!CAN)encoder\s*(?:sensor)?', 'Encoder sensor')
            ],
            'CTRL': [
                (r'CANivore', 'CANivore controller')
            ],
            'SHAFT': [
                (r'spacer', 'Spacer (shaft component)')
            ]
        }

    def load_csv(self, filepath: str) -> None:
        """Load the WCP CSV file and parse into Part objects"""
        print(f"Loading CSV from {filepath}...")

        # Try multiple encodings
        encodings = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        content = None

        for encoding in encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    content = f.read()
                print(f"Successfully loaded with encoding: {encoding}")
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            raise ValueError(f"Could not decode file with any known encoding")

        # Parse the CSV structure
        lines = content.strip().split('\n')
        current_category = None
        current_subcategory = None

        for line_num, line in enumerate(lines, 1):
            # Skip header and empty lines
            if line_num == 1 or not line.strip():
                continue

            # Parse line structure
            parts = line.split(',', 3)
            if len(parts) < 4:
                continue

            col_a, col_b, col_c, col_d = parts

            # Category detection (Column B has URL)
            if col_b.strip() and 'Website:' in col_b:
                match = re.search(r'^(.*?)\s+Website:', col_b)
                if match:
                    current_category = match.group(1).strip()
                continue

            # Subcategory detection (Column C has text, Column D empty)
            if col_c.strip() and not col_d.strip():
                current_subcategory = col_c.strip()
                continue

            # Product line (Column D has product info)
            if col_d.strip() and current_category:
                part = self._parse_product_line(col_d.strip(), current_category, current_subcategory or "")
                if part:
                    self.parts.append(part)

        print(f"Loaded {len(self.parts)} parts")

    def _parse_product_line(self, text: str, category: str, subcategory: str) -> Optional[Part]:
        """Parse a product line into a Part object"""
        # Pattern: "Part Name(WCP-####)+$Price [Status]"
        match = re.search(r'(.*?)\(WCP-(\d+)\)\+\$([0-9.]+)\s*(.*?)$', text)
        if not match:
            return None

        part_name = match.group(1).strip()
        product_code = f"WCP-{match.group(2)}"
        unit_cost = float(match.group(3))

        # Initial category classification (will be refined)
        category_code = self._initial_category_classification(part_name, category, subcategory)

        return Part(
            part_name=part_name,
            product_code=product_code,
            category_code=category_code,
            category_name=self.category_map.get(category_code, category),
            subcategory=subcategory,
            specifications={},
            pack_quantity=self._extract_pack_quantity(part_name),
            unit_cost=unit_cost,
            supplier="WCP",
            supplier_url=f"https://wcproducts.com/products/{product_code.lower()}",
            confidence=0.8,
            original_category=category_code
        )

    def _initial_category_classification(self, name: str, category: str, subcategory: str) -> str:
        """Initial category classification based on WCP structure"""
        name_lower = name.lower()
        cat_lower = category.lower()

        # Direct mappings
        if 'bolt' in cat_lower or 'screw' in cat_lower:
            return 'BOLT'
        elif 'nut' in cat_lower:
            return 'NUT'
        elif 'washer' in cat_lower:
            return 'WASH'
        elif 'gear' in cat_lower or 'sprocket' in cat_lower:
            return 'GEAR'
        elif 'belt' in cat_lower:
            return 'BELT'
        elif 'chain' in cat_lower:
            return 'CHAIN'
        elif 'shaft' in cat_lower or 'spacer' in name_lower:
            return 'SHAFT'
        elif 'bearing' in cat_lower or 'bearing' in name_lower:
            return 'BEAR'
        elif 'wheel' in cat_lower or 'hub' in cat_lower:
            return 'WHEEL'
        elif 'motor' in cat_lower and 'controller' not in cat_lower:
            return 'MOTOR'
        elif 'controller' in cat_lower or 'talon' in name_lower or 'victor' in name_lower:
            return 'CTRL'
        elif 'sensor' in cat_lower or 'encoder' in name_lower:
            return 'SENSOR'
        elif 'pneumatic' in cat_lower or 'cylinder' in name_lower:
            return 'PNEUM'
        elif 'wire' in cat_lower or 'cable' in cat_lower:
            return 'WIRE'
        elif 'electronic' in cat_lower:
            return 'ELEC'
        elif 'stock' in cat_lower or 'material' in cat_lower:
            return 'STOCK'
        else:
            return 'GEAR'  # Default fallback

    def _extract_pack_quantity(self, name: str) -> int:
        """Extract pack quantity from part name"""
        match = re.search(r'\((\d+)-Pack\)', name, re.IGNORECASE)
        return int(match.group(1)) if match else 1

    def apply_reclassifications(self) -> None:
        """Apply all reclassification patterns"""
        print("\nApplying reclassifications...")

        for part in self.parts:
            name_lower = part.part_name.lower()

            for new_category, patterns in self.reclassification_patterns.items():
                for pattern, reason in patterns:
                    if re.search(pattern, name_lower, re.IGNORECASE):
                        if part.category_code != new_category:
                            self.reclassifications.append({
                                'product_code': part.product_code,
                                'part_name': part.part_name,
                                'old_category': part.category_code,
                                'new_category': new_category,
                                'reason': reason
                            })
                            part.original_category = part.category_code
                            part.category_code = new_category
                            part.category_name = self.category_map.get(new_category, new_category)
                            part.reclassification_reason = reason
                        break
                if part.reclassification_reason:
                    break

        print(f"Reclassified {len(self.reclassifications)} parts")

    def extract_all_specifications(self) -> None:
        """Extract specifications for all categories"""
        print("\nExtracting specifications...")

        for part in self.parts:
            if part.category_code == 'BEAR':
                part.specifications = self._extract_bearing_specs(part.part_name)
            elif part.category_code == 'WIRE':
                part.specifications = self._extract_wire_specs(part.part_name)
            elif part.category_code == 'BELT':
                part.specifications = self._extract_belt_specs(part.part_name)
            elif part.category_code == 'GEAR':
                part.specifications = self._extract_gear_specs(part.part_name)
            elif part.category_code == 'MACH':
                part.specifications = self._extract_machining_specs(part.part_name)
            elif part.category_code == 'STOCK':
                part.specifications = self._extract_stock_specs(part.part_name)
            elif part.category_code == 'CHAIN':
                part.specifications = self._extract_chain_specs(part.part_name)
            elif part.category_code == 'BOLT':
                part.specifications = self._extract_bolt_specs(part.part_name)
            elif part.category_code == 'SHAFT':
                part.specifications = self._extract_shaft_specs(part.part_name)
            elif part.category_code == 'WHEEL':
                part.specifications = self._extract_wheel_specs(part.part_name)

            if part.specifications:
                self.spec_extractions[part.category_code] += 1

    def _extract_bearing_specs(self, name: str) -> Dict[str, str]:
        """Extract bearing specifications: ID, OD, WD, Type"""
        specs = {}

        # Try to extract full bearing spec pattern first
        # Pattern: "10.25mm (3/8" Rounded Hex) ID x 0.875" OD x 0.280" WD"
        # Or: "0.250" ID x 0.500" OD x 0.188" WD"

        # Check for mm ID first (usually at start)
        mm_id_match = re.search(r'^[\"]?(\d+\.?\d*mm)', name)
        if mm_id_match:
            specs['id'] = mm_id_match.group(1)
        else:
            # Look for inch ID (before " ID")
            id_match = re.search(r'(\d+\.?\d*)["\s]*ID', name, re.IGNORECASE)
            if id_match:
                specs['id'] = f'{id_match.group(1)}"'

        # OD pattern - look for number before " OD"
        od_match = re.search(r'(\d+\.?\d*)["\s]*OD', name, re.IGNORECASE)
        if od_match:
            specs['od'] = f'{od_match.group(1)}"'

        # WD pattern - look for number before " WD"
        wd_match = re.search(r'(\d+\.?\d*)["\s]*WD', name, re.IGNORECASE)
        if wd_match:
            specs['wd'] = f'{wd_match.group(1)}"'

        # Type pattern - extract just the bearing type
        if 'flanged bearing' in name.lower():
            specs['type'] = 'Flanged Bearing'
        elif 'thrust bearing' in name.lower():
            specs['type'] = 'Thrust Bearing'
        elif 'ball bearing' in name.lower():
            specs['type'] = 'Ball Bearing'
        else:
            # Look for text in final parentheses if it contains "bearing"
            type_match = re.search(r'\(([^)]*[Bb]earing[^)]*)\)\s*$', name)
            if type_match:
                specs['type'] = type_match.group(1).strip()

        return specs

    def _extract_wire_specs(self, name: str) -> Dict[str, str]:
        """Extract wire specifications: Type, Gauge, Length, Connector"""
        specs = {}

        # Gauge pattern
        gauge_match = re.search(r'(\d+)\s*AWG', name, re.IGNORECASE)
        if gauge_match:
            specs['gauge'] = f'{gauge_match.group(1)} AWG'

        # Cable type
        type_match = re.search(r'(PWM|CAN|Power|Signal|USB|Ethernet)', name, re.IGNORECASE)
        if type_match:
            specs['type'] = type_match.group(1) + ' Cable'
        elif 'wire' in name.lower():
            specs['type'] = 'Wire'

        # Length pattern
        length_match = re.search(r'\((\d+)\s*(?:ft|feet|\')\)', name, re.IGNORECASE)
        if length_match:
            specs['length'] = f'{length_match.group(1)} ft'

        # Connector type
        connector_match = re.search(r'\((M-M|M-F|F-F|Male|Female)\)', name, re.IGNORECASE)
        if connector_match:
            specs['connector'] = connector_match.group(1)

        return specs

    def _extract_belt_specs(self, name: str) -> Dict[str, str]:
        """Extract belt specifications: Type, Teeth, Width"""
        specs = {}

        # Belt type (GT2, HTD, etc.)
        type_match = re.search(r'\((GT2|HTD|XL|L|H)\s*\d+mm\)', name, re.IGNORECASE)
        if type_match:
            specs['type'] = type_match.group(0).strip('()')

        # Tooth count
        teeth_match = re.search(r'(\d+)t', name, re.IGNORECASE)
        if teeth_match:
            specs['teeth'] = teeth_match.group(1) + 't'

        # Width
        width_match = re.search(r'(\d+mm)\s*[Ww]ide', name)
        if width_match:
            specs['width'] = width_match.group(1)

        return specs

    def _extract_gear_specs(self, name: str) -> Dict[str, str]:
        """Extract gear specifications: Teeth, Pitch, Bore Type, Bore Size"""
        specs = {}

        # Tooth count
        teeth_match = re.search(r'(\d+)t', name, re.IGNORECASE)
        if teeth_match:
            specs['teeth'] = teeth_match.group(1) + 't'

        # Pitch (DP)
        pitch_match = re.search(r'(\d+)\s*DP', name, re.IGNORECASE)
        if pitch_match:
            specs['pitch'] = pitch_match.group(1) + ' DP'

        # Bore type
        bore_type_match = re.search(r'(Hex|Round|SplineXS|SplineXL|Key)\s*Bore', name, re.IGNORECASE)
        if bore_type_match:
            specs['bore_type'] = bore_type_match.group(1)

        # Bore size
        bore_size_match = re.search(r'(\d+/\d+"|\\d+\\.?\\d*")\s*(?:Hex|Round)?', name)
        if bore_size_match:
            specs['bore_size'] = bore_size_match.group(1)

        return specs

    def _extract_machining_specs(self, name: str) -> Dict[str, str]:
        """Extract machining tool specifications"""
        specs = {}

        # Tool type
        if 'endmill' in name.lower() or 'end mill' in name.lower():
            specs['tool_type'] = 'Endmill'
        elif 'collet' in name.lower():
            specs['tool_type'] = 'Collet'
        elif 'drill' in name.lower():
            specs['tool_type'] = 'Drill Bit'
        elif 'tap' in name.lower():
            specs['tool_type'] = 'Tap'
        elif 'die' in name.lower():
            specs['tool_type'] = 'Die'
        elif 'router' in name.lower():
            specs['tool_type'] = 'Router Bit'

        # Size/diameter
        size_match = re.search(r'(\d+\.?\d*mm|\d+/\d+")', name)
        if size_match:
            specs['size'] = size_match.group(1)

        # Length
        length_match = re.search(r'(\d+mm)\s*(?:Cut|Flute)?\s*Length', name, re.IGNORECASE)
        if length_match:
            specs['length'] = length_match.group(1) + ' Cut Length'

        # Coating/Material
        if 'DLC' in name:
            specs['coating'] = 'DLC Coated'
        elif 'TiN' in name:
            specs['coating'] = 'TiN Coated'
        elif 'Carbide' in name:
            specs['material'] = 'Carbide'
        elif 'HSS' in name:
            specs['material'] = 'HSS'

        return specs

    def _extract_stock_specs(self, name: str) -> Dict[str, str]:
        """Extract raw stock specifications"""
        specs = {}

        # OD pattern - match decimal or fraction (handle quotes flexibly)
        od_match = re.search(r'(\.\d+|\d+\.?\d*)["\s]*OD', name, re.IGNORECASE)
        if od_match:
            specs['od'] = f'{od_match.group(1)}"'

        # ID pattern - match decimal or fraction (handle quotes flexibly)
        id_match = re.search(r'(\.\d+|\d+\.?\d*)["\s]*ID', name, re.IGNORECASE)
        if id_match:
            specs['id'] = f'{id_match.group(1)}"'

        # Length pattern - look for inches in parentheses at end (handle escaped quotes)
        length_match = re.search(r'\((\d+)["\s]*\)', name)
        if length_match:
            specs['length'] = f'{length_match.group(1)}"'

        # Type - determine material type
        if 'rounded hex' in name.lower():
            specs['type'] = 'Rounded Hex'
        elif 'hex' in name.lower():
            if 'oversized' in name.lower():
                specs['type'] = 'Oversized Hex'
            else:
                specs['type'] = 'Hex'
        elif 'tube' in name.lower():
            specs['type'] = 'Tube'
        elif 'round' in name.lower():
            specs['type'] = 'Round'

        return specs

    def _extract_chain_specs(self, name: str) -> Dict[str, str]:
        """Extract chain specifications"""
        specs = {}

        # Chain size (#25, #35, etc.)
        chain_match = re.search(r'#(\d+)', name)
        if chain_match:
            specs['size'] = f'#{chain_match.group(1)}'

        # Pitch
        pitch_match = re.search(r'(\d+/\d+"|\\d+\\.?\\d*")\s*Pitch', name, re.IGNORECASE)
        if pitch_match:
            specs['pitch'] = pitch_match.group(1)

        # Length (if applicable)
        length_match = re.search(r'(\d+)\s*Links?', name, re.IGNORECASE)
        if length_match:
            specs['links'] = length_match.group(1) + ' Links'

        return specs

    def _extract_bolt_specs(self, name: str) -> Dict[str, str]:
        """Extract bolt specifications"""
        specs = {}

        # Thread size
        thread_match = re.search(r'(#\d+-\d+|\d+/\d+"-\d+)', name)
        if thread_match:
            specs['thread'] = thread_match.group(1)

        # Length
        length_match = re.search(r'x\s*(\d+\.?\d*)"?\s*L', name, re.IGNORECASE)
        if length_match:
            specs['length'] = f'{length_match.group(1)}"'

        # Type (BHCS, SHCS, etc.)
        if 'BHCS' in name:
            specs['type'] = 'Button Head Cap Screw'
        elif 'SHCS' in name:
            specs['type'] = 'Socket Head Cap Screw'
        elif 'PHCS' in name:
            specs['type'] = 'Pan Head Cap Screw'

        return specs

    def _extract_shaft_specs(self, name: str) -> Dict[str, str]:
        """Extract shaft/spacer specifications"""
        specs = {}

        # For spacers: WD x ID x OD pattern
        # Pattern: "1/8" WD x .196" ID x 3/8" OD Aluminum Spacers"
        if 'spacer' in name.lower():
            # Try to match the WD x ID x OD pattern
            spacer_match = re.search(r'(\d+/\d+|\d+\.?\d*)["\s]*WD\s*x\s*(\.\d+|\d+/\d+)["\s]*ID\s*x\s*(\d+/\d+|\.\d+)["\s]*OD', name, re.IGNORECASE)
            if spacer_match:
                specs['width'] = f'{spacer_match.group(1)}"'
                specs['id'] = f'{spacer_match.group(2)}"'
                specs['od'] = f'{spacer_match.group(3)}"'
            return specs

        # For shafts: Bore/ID
        bore_match = re.search(r'(\d+/\d+|\d+\.?\d*)["\s]*(?:Bore|ID)', name, re.IGNORECASE)
        if bore_match:
            specs['bore'] = f'{bore_match.group(1)}"'

        # OD
        od_match = re.search(r'(\d+/\d+|\d+\.?\d*)["\s]*OD', name, re.IGNORECASE)
        if od_match:
            specs['od'] = f'{od_match.group(1)}"'

        # Length
        length_match = re.search(r'(\d+\.?\d*)["\s]*(?:Long|Length)', name, re.IGNORECASE)
        if length_match:
            specs['length'] = f'{length_match.group(1)}"'

        return specs

    def _extract_wheel_specs(self, name: str) -> Dict[str, str]:
        """Extract wheel specifications"""
        specs = {}

        # Diameter
        diam_match = re.search(r'(\d+\.?\d*)"?\s*(?:Diameter|Dia)', name, re.IGNORECASE)
        if diam_match:
            specs['diameter'] = f'{diam_match.group(1)}"'
        elif re.search(r'^(\d+)"', name):
            diam_match = re.search(r'^(\d+)"', name)
            specs['diameter'] = f'{diam_match.group(1)}"'

        # Width
        width_match = re.search(r'(\d+\.?\d*)"?\s*Wide', name, re.IGNORECASE)
        if width_match:
            specs['width'] = f'{width_match.group(1)}"'

        # Bore
        bore_match = re.search(r'(\d+/\d+"|\\d+\\.?\\d*")\s*(?:Hex|Round)\s*Bore', name, re.IGNORECASE)
        if bore_match:
            specs['bore'] = bore_match.group(1)

        return specs

    def update_category_counts(self) -> None:
        """Update category distribution counts"""
        self.category_counts.clear()
        for part in self.parts:
            self.category_counts[part.category_code] += 1

    def generate_output_json(self, filepath: str) -> None:
        """Generate the corrected JSON output"""
        print(f"\nGenerating output JSON: {filepath}")

        # Convert parts to dictionaries
        parts_data = []
        for part in self.parts:
            part_dict = asdict(part)
            # Remove internal tracking fields
            part_dict.pop('original_category', None)
            part_dict.pop('reclassification_reason', None)
            part_dict.pop('spec_extraction_method', None)
            parts_data.append(part_dict)

        output = {
            'metadata': {
                'source': 'WCP (West Coast Products)',
                'total_parts': len(self.parts),
                'processing_date': '2025-10-29',
                'fixes_applied': [
                    'Reclassified machining tools (endmills, collets)',
                    'Reclassified raw stock (hex stock)',
                    'Reclassified hardware (energy chain)',
                    'Reclassified sensors and controllers',
                    'Extracted bearing specs (ID, OD, WD, Type)',
                    'Extracted wire/cable specs',
                    'Enhanced belt specs (teeth, width)',
                    'Enhanced gear specs',
                    'Added machining tool specs',
                    'Added stock material specs',
                    'Moved spacers to SHAFT category'
                ]
            },
            'parts': parts_data
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"Wrote {len(parts_data)} parts to {filepath}")

    def generate_report(self, filepath: str) -> None:
        """Generate comprehensive fix report"""
        print(f"\nGenerating report: {filepath}")

        report = []
        report.append("# WCP Parts Comprehensive Fix Report")
        report.append(f"Generated: 2025-10-29")
        report.append("")

        # Summary
        report.append("## Summary")
        report.append(f"- Total parts processed: {len(self.parts)}")
        report.append(f"- Parts reclassified: {len(self.reclassifications)}")
        report.append(f"- Categories with spec extraction: {len(self.spec_extractions)}")
        report.append("")

        # Category distribution
        report.append("## Category Distribution")
        report.append("")
        report.append("| Category | Count | Category Name |")
        report.append("|----------|-------|---------------|")
        for cat_code in sorted(self.category_counts.keys()):
            count = self.category_counts[cat_code]
            cat_name = self.category_map.get(cat_code, cat_code)
            report.append(f"| {cat_code} | {count} | {cat_name} |")
        report.append("")

        # Reclassifications
        report.append("## Reclassifications Applied")
        report.append(f"Total: {len(self.reclassifications)}")
        report.append("")

        # Group by category change
        reclass_groups = defaultdict(list)
        for reclass in self.reclassifications:
            key = f"{reclass['old_category']} → {reclass['new_category']}"
            reclass_groups[key].append(reclass)

        for change, items in sorted(reclass_groups.items()):
            report.append(f"### {change} ({len(items)} parts)")
            report.append("")
            for item in items[:10]:  # Show first 10
                report.append(f"- **{item['product_code']}**: {item['part_name']}")
                report.append(f"  - Reason: {item['reason']}")
            if len(items) > 10:
                report.append(f"  - ... and {len(items) - 10} more")
            report.append("")

        # Spec extraction coverage
        report.append("## Specification Extraction Coverage")
        report.append("")
        report.append("| Category | Parts with Specs | Total Parts | Coverage |")
        report.append("|----------|------------------|-------------|----------|")

        for cat_code in sorted(self.category_counts.keys()):
            total = self.category_counts[cat_code]
            with_specs = self.spec_extractions.get(cat_code, 0)
            coverage = (with_specs / total * 100) if total > 0 else 0
            report.append(f"| {cat_code} | {with_specs} | {total} | {coverage:.1f}% |")

        overall_with_specs = sum(self.spec_extractions.values())
        overall_total = len(self.parts)
        overall_coverage = (overall_with_specs / overall_total * 100) if overall_total > 0 else 0
        report.append(f"| **TOTAL** | **{overall_with_specs}** | **{overall_total}** | **{overall_coverage:.1f}%** |")
        report.append("")

        # Sample specifications by category
        report.append("## Sample Specifications by Category")
        report.append("")

        for cat_code in sorted(self.category_counts.keys()):
            # Find first part with specs
            sample_part = None
            for part in self.parts:
                if part.category_code == cat_code and part.specifications:
                    sample_part = part
                    break

            if sample_part:
                report.append(f"### {cat_code} - {self.category_map.get(cat_code, cat_code)}")
                report.append(f"**Example**: {sample_part.part_name} ({sample_part.product_code})")
                report.append(f"Specifications:")
                for key, value in sample_part.specifications.items():
                    report.append(f"- {key}: {value}")
                report.append("")

        # Write report
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))

        print(f"Report written to {filepath}")

    def process(self, input_csv: str, output_json: str, report_path: str) -> None:
        """Main processing pipeline"""
        print("=" * 80)
        print("WCP Parts Comprehensive Fix")
        print("=" * 80)

        # Load data
        self.load_csv(input_csv)

        # Apply fixes
        self.apply_reclassifications()
        self.extract_all_specifications()

        # Update counts
        self.update_category_counts()

        # Generate outputs
        self.generate_output_json(output_json)
        self.generate_report(report_path)

        print("\n" + "=" * 80)
        print("Processing Complete")
        print("=" * 80)
        print(f"Output JSON: {output_json}")
        print(f"Report: {report_path}")
        print(f"Total parts: {len(self.parts)}")
        print(f"Reclassified: {len(self.reclassifications)}")
        print(f"Overall spec coverage: {sum(self.spec_extractions.values())}/{len(self.parts)} ({sum(self.spec_extractions.values())/len(self.parts)*100:.1f}%)")


def main():
    """Main entry point"""
    base_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing"

    processor = WCPPartsProcessor()
    processor.process(
        input_csv=f"{base_path}/WCP_Parts.csv",
        output_json=f"{base_path}/Spreadsheets/wcp_fully_corrected.json",
        report_path=f"{base_path}/COMPLETE_FIX_REPORT.md"
    )


if __name__ == "__main__":
    main()
