#!/usr/bin/env python3
"""
WCP Parts CSV Parser
Parses hierarchical CSV from West Coast Products with section/subsection tracking.
Filters out header rows and extracts actual part data.
"""

import re
import csv
import json
from typing import List, Dict, Optional, Tuple
from pathlib import Path


class WCPParser:
    """Parser for hierarchical WCP parts catalog CSV."""

    def __init__(self, csv_path: str):
        self.csv_path = Path(csv_path)
        self.parts: List[Dict] = []
        self.current_section: Optional[str] = None
        self.current_subsection: Optional[str] = None
        self.stats = {
            'total_lines': 0,
            'header_lines': 0,
            'blank_lines': 0,
            'section_headers': 0,
            'subsection_headers': 0,
            'parts_extracted': 0,
            'parsing_errors': 0
        }

    def is_section_header(self, row: List[str]) -> bool:
        """
        Detect section headers (e.g., main product categories).
        Section headers have content in column 1 and contain URL.
        """
        if len(row) < 2:
            return False

        col1 = row[1].strip() if len(row) > 1 else ""

        # Section headers have "Website: https://" in column 1
        if "Website:" in col1 and "wcproducts.com" in col1:
            return True

        return False

    def is_subsection_header(self, row: List[str]) -> bool:
        """
        Detect subsection headers (e.g., product groupings within sections).
        Subsection headers have content in column 2, no product code.
        """
        if len(row) < 3:
            return False

        col2 = row[2].strip() if len(row) > 2 else ""
        col3 = row[3].strip() if len(row) > 3 else ""

        # Subsection has text in column 2, nothing in column 3
        if col2 and not col3 and not "WCP-" in col2:
            return True

        return False

    def is_part_row(self, row: List[str]) -> bool:
        """
        Detect actual part rows with product codes.
        Part rows have data in column 3 with WCP-#### product code.
        """
        if len(row) < 4:
            return False

        col3 = row[3].strip() if len(row) > 3 else ""

        # Part rows have WCP-#### product code in column 3
        if "WCP-" in col3:
            return True

        return False

    def extract_section_name(self, row: List[str]) -> str:
        """Extract section name from section header row."""
        col1 = row[1].strip()

        # Format: "Section Name Website: https://..."
        # Extract text before "Website:"
        match = re.search(r'^(.+?)\s+Website:', col1)
        if match:
            return match.group(1).strip()

        # Fallback: just remove Website part
        section = col1.replace("Website:", "").strip()
        section = re.sub(r'https?://\S+', '', section).strip()

        return section

    def extract_subsection_name(self, row: List[str]) -> str:
        """Extract subsection name from subsection header row."""
        return row[2].strip()

    def parse_part_row(self, row: List[str]) -> Optional[Dict]:
        """
        Parse a part row and extract all relevant information.
        Format in column 3: "Part Name(WCP-####)+$Price StockStatus"
        """
        try:
            col3 = row[3].strip()

            # Extract product code (WCP-####)
            code_match = re.search(r'\(WCP-(\d+)\)', col3)
            if not code_match:
                return None

            product_code = f"WCP-{code_match.group(1)}"

            # Extract price ($XX.XX)
            price_match = re.search(r'\+\$(\d+\.?\d*)', col3)
            price = float(price_match.group(1)) if price_match else 0.0

            # Extract stock status (everything after price)
            stock_match = re.search(r'\+\$\d+\.?\d*\s*(.+?)$', col3)
            stock_status = stock_match.group(1).strip() if stock_match else ""

            # Extract part name (everything before product code)
            name_match = re.search(r'^(.+?)\s*\(WCP-', col3)
            if not name_match:
                return None

            part_name = name_match.group(1).strip()

            # Remove special characters (non-breaking spaces, etc.)
            part_name = re.sub(r'[\xa0\u200b]+', ' ', part_name)
            part_name = part_name.strip()

            return {
                'original_name': part_name,
                'product_code': product_code,
                'price': price,
                'stock_status': stock_status,
                'section': self.current_section,
                'subsection': self.current_subsection
            }

        except Exception as e:
            print(f"Error parsing part row: {e}")
            print(f"Row content: {row}")
            self.stats['parsing_errors'] += 1
            return None

    def parse(self) -> List[Dict]:
        """Parse the entire CSV file."""
        print(f"Parsing WCP CSV: {self.csv_path}")

        with open(self.csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            # Don't use csv.reader to handle complex embedded commas
            # Read line by line and parse manually
            for line_num, line in enumerate(f, 1):
                self.stats['total_lines'] += 1

                # Skip completely blank lines
                if not line.strip():
                    self.stats['blank_lines'] += 1
                    continue

                # Split by comma but handle quoted fields
                row = list(csv.reader([line]))[0]

                # Skip header row (first line)
                if line_num == 1:
                    self.stats['header_lines'] += 1
                    continue

                # Process row based on type
                if self.is_section_header(row):
                    self.current_section = self.extract_section_name(row)
                    self.current_subsection = None
                    self.stats['section_headers'] += 1
                    print(f"  Section: {self.current_section}")

                elif self.is_subsection_header(row):
                    self.current_subsection = self.extract_subsection_name(row)
                    self.stats['subsection_headers'] += 1
                    print(f"    Subsection: {self.current_subsection}")

                elif self.is_part_row(row):
                    part = self.parse_part_row(row)
                    if part:
                        self.parts.append(part)
                        self.stats['parts_extracted'] += 1

        print(f"\nParsing complete:")
        print(f"  Total lines: {self.stats['total_lines']}")
        print(f"  Parts extracted: {self.stats['parts_extracted']}")
        print(f"  Section headers: {self.stats['section_headers']}")
        print(f"  Subsection headers: {self.stats['subsection_headers']}")
        print(f"  Parsing errors: {self.stats['parsing_errors']}")

        return self.parts

    def save_json(self, output_path: str):
        """Save parsed parts to JSON file."""
        output = {
            'parts': self.parts,
            'parsing_stats': self.stats
        }

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\nSaved parsed parts to: {output_path}")


def main():
    """Main execution function."""
    # File paths
    csv_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/WCP_Parts.csv"
    output_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_parsed.json"

    # Parse CSV
    parser = WCPParser(csv_path)
    parts = parser.parse()

    # Save results
    parser.save_json(output_path)

    # Show sample parts
    print("\n=== Sample Parsed Parts (First 5) ===")
    for i, part in enumerate(parts[:5], 1):
        print(f"\n{i}. {part['original_name']}")
        print(f"   Code: {part['product_code']}")
        print(f"   Price: ${part['price']:.2f}")
        print(f"   Section: {part['section']}")
        print(f"   Subsection: {part['subsection']}")


if __name__ == "__main__":
    main()
