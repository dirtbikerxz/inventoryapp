#!/usr/bin/env python3
"""
Comprehensive Classification Audit Script (No External Dependencies)
Analyzes all 587 parts to identify misclassifications
"""

import csv
import re
import json
from typing import Dict, List, Tuple
from collections import defaultdict
from datetime import datetime


class ClassificationAuditor:
    """Audits part classifications and identifies misclassifications"""

    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.parts = []
        self.reclassifications = []
        self.category_stats = defaultdict(lambda: {"correct": 0, "incorrect": 0})

        # Classification patterns (what parts ACTUALLY are)
        self.patterns = {
            "MACH": [
                r'endmill|end mill',
                r'drill\s*bit|drill\s*(?:set)?$',
                r'\btap\b|\btaps\b',
                r'\bdie\b|\bdies\b',
                r'collet',
                r'router.*(?:bit|tool)',
                r'CNC.*(?:bit|tool|collet)',
                r'(?:single|double|multi)\s*flute',
                r'carbide.*(?:bit|tool)',
                r'tool\s*holder',
                r'boring.*bar',
                r'reamer',
                r'countersink',
                r'chamfer.*tool',
            ],
            "STOCK": [
                r'hex\s*stock',
                r'round\s*stock',
                r'bar\s*stock',
                r'tube\s*stock',
                r'\d+\.?\d*"?\s*(?:OD|ID)?.*(?:hex|round).*stock',
                r'rounded\s*hex\s*stock',
                r'aluminum\s*(?:hex|round|bar)',
                r'steel\s*(?:hex|round|bar)',
                r'(?:plastic|nylon|delrin)\s*(?:hex|round|bar)',
                r'\d+\.?\d*"\s*(?:OD|ID)\s*(?:hex|round)',
            ],
            "HDWR": [
                r'cable\s*chain',
                r'energy\s*chain',
                r'cable\s*carrier',
                r'bi\s*directional.*chain',
                r'tube\s*plug',
                r'shaft\s*collar(?!.*kit)',
                r'clamp(?!ing\s*hub)',  # clamp but not clamping hub
                r'bracket(?!.*sprocket)',
                r'standoff',
                r'spacer(?!.*kit)',
            ],
            "SENSOR": [
                r'CANcoder',
                r'CANrange',
                r'\bsensor\b',
                r'encoder(?!.*collet)',
                r'limit\s*switch',
                r'photoelectric',
                r'proximity\s*sensor',
                r'gyro',
                r'accelerometer',
                r'ultrasonic',
            ],
            "CTRL": [
                r'CANivore',
                r'\bPDP\b',
                r'roboRIO',
                r'\bradio\b',
                r'power\s*distribution',
                r'voltage\s*regulator\s*module',
                r'VRM',
                r'motor\s*controller(?!.*cable)',
                r'speed\s*controller',
            ],
            "WIRE": [
                r'wire(?!.*wheel)',
                r'cable(?!.*chain|.*carrier)',
                r'connector(?!.*kit)',
                r'terminal',
                r'anderson.*connector',
                r'wago.*connector',
            ],
            "SAFE": [
                r'safety\s*glasses',
                r'gloves',
                r'ear\s*protection',
                r'first\s*aid',
                r'face\s*shield',
            ],
        }

        # Patterns that should ONLY be in GEAR
        self.gear_patterns = [
            r'(?:^|\s)spur\s*gear(?!\s*rack)',
            r'bevel\s*gear',
            r'worm\s*gear',
            r'gear\s*rack',
            r'pinion\s*gear',
            r'planetary\s*gear',
            r'(?:internal|external)\s*gear',
            r'\d+T.*gear',  # e.g., "20T Spur Gear"
        ]

    def load_csv(self):
        """Load CSV file"""
        print(f"Loading CSV from: {self.csv_path}")
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            self.parts = list(reader)
        print(f"Loaded {len(self.parts)} parts")

    def matches_pattern(self, text: str, patterns: List[str]) -> Tuple[bool, str]:
        """Check if text matches any pattern in the list"""
        if not text:
            return False, ""
        text_lower = text.lower()
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return True, pattern
        return False, ""

    def is_actually_gear(self, name: str) -> bool:
        """Check if item is actually a gear"""
        matches, _ = self.matches_pattern(name, self.gear_patterns)
        return matches

    def determine_correct_category(self, name: str, current_cat: str) -> Tuple[str, str]:
        """
        Determine the correct category for a part
        Returns: (correct_category, reason)
        """
        if not name:
            return current_cat, "Empty name, keeping current"

        # Special case: CANcoder and CANrange are always sensors, even if pre-wired
        name_lower = name.lower()
        if 'cancoder' in name_lower or 'canrange' in name_lower:
            return "SENSOR", "Matches pattern: CANcoder/CANrange sensors"

        # Priority order: More specific categories first
        category_order = ["MACH", "SENSOR", "CTRL", "WIRE", "SAFE", "STOCK", "HDWR"]

        for category in category_order:
            if category in self.patterns:
                matches, pattern = self.matches_pattern(name, self.patterns[category])
                if matches:
                    return category, f"Matches pattern: {pattern}"

        # If current category is GEAR, verify it's actually a gear
        if current_cat == "GEAR":
            if self.is_actually_gear(name):
                return "GEAR", "Confirmed as actual gear"
            else:
                # Not a real gear - needs review
                return "NEEDS_REVIEW", "In GEAR category but doesn't match gear patterns"

        # Default: keep current category
        return current_cat, "No reclassification needed"

    def audit_part(self, part: Dict) -> Dict:
        """Audit a single part and determine if reclassification is needed"""
        part_id = part.get('Part ID', '')
        product_code = part.get('Product Code', '')
        name = part.get('Part Name', '')
        current_cat = part.get('Category', '')

        correct_cat, reason = self.determine_correct_category(name, current_cat)

        is_correct = (correct_cat == current_cat)

        if is_correct:
            self.category_stats[current_cat]["correct"] += 1
        else:
            self.category_stats[current_cat]["incorrect"] += 1

        result = {
            "part_id": part_id,
            "product_code": product_code,
            "part_name": name,
            "current_category": current_cat,
            "correct_category": correct_cat,
            "is_correct": is_correct,
            "reason": reason
        }

        if not is_correct:
            self.reclassifications.append({
                "part_id": part_id,
                "product_code": product_code,
                "current_category": current_cat,
                "new_category": correct_cat,
                "part_name": name,
                "reason": reason
            })

        return result

    def run_audit(self) -> Dict:
        """Run full audit on all parts"""
        self.load_csv()
        print(f"Starting audit of {len(self.parts)} parts...")

        results = []
        for idx, part in enumerate(self.parts):
            result = self.audit_part(part)
            results.append(result)

            if (idx + 1) % 100 == 0:
                print(f"Processed {idx + 1} parts...")

        print(f"Audit complete. Found {len(self.reclassifications)} misclassifications.")

        return {
            "results": results,
            "reclassifications": self.reclassifications,
            "stats": dict(self.category_stats)
        }

    def generate_report(self, audit_results: Dict, output_path: str):
        """Generate comprehensive markdown report"""
        results = audit_results["results"]
        reclassifications = audit_results["reclassifications"]
        stats = audit_results["stats"]

        # Group reclassifications by type
        reclass_by_type = defaultdict(list)
        for rc in reclassifications:
            key = f"{rc['current_category']}_to_{rc['new_category']}"
            reclass_by_type[key].append(rc)

        # Calculate totals
        total_parts = len(results)
        total_correct = sum(1 for r in results if r["is_correct"])
        total_incorrect = total_parts - total_correct

        # Count by category after corrections
        final_category_counts = defaultdict(int)
        for r in results:
            final_category_counts[r["correct_category"]] += 1

        # Generate report
        report = []
        report.append("# Comprehensive Classification Audit Report\n")
        report.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        report.append(f"**Data Source**: Part Directory - Next Attempt.csv\n\n")

        # Executive Summary
        report.append("## Executive Summary\n")
        report.append(f"- **Total parts audited**: {total_parts}\n")
        report.append(f"- **Correctly classified**: {total_correct} ({total_correct/total_parts*100:.1f}%)\n")
        report.append(f"- **Misclassified**: {total_incorrect} ({total_incorrect/total_parts*100:.1f}%)\n")

        needs_review = sum(1 for r in results if r["correct_category"] == "NEEDS_REVIEW")
        report.append(f"- **Verification needed**: {needs_review}\n\n")

        # Known Issues Verification
        report.append("## Known Issues Verification\n\n")
        report.append("User-reported misclassifications:\n\n")

        known_issues = {
            "GEAR-120": ("WCP-1513", "4mm Single Flute Carbide Endmill"),
            "GEAR-119": ("WCP-1571", "4mm ER20 CNC Router Collet"),
        }

        for part_id, (product_code, expected_name) in known_issues.items():
            found = False
            for rc in reclassifications:
                if part_id == rc.get('part_id', '') or product_code == rc.get('product_code', ''):
                    report.append(f"- **{part_id}** ({product_code}): CONFIRMED - {rc['current_category']} → {rc['new_category']} | {rc['part_name']}\n")
                    found = True
                    break
            if not found:
                report.append(f"- **{part_id}** ({product_code}): NOT FOUND in reclassifications (already correct or needs manual check)\n")

        # Also check CANcoder/CANrange
        report.append("\nCANcoder/CANrange sensor verification:\n\n")
        cancoder_found = []
        for rc in reclassifications:
            if 'cancoder' in rc.get('part_name', '').lower() or 'canrange' in rc.get('part_name', '').lower():
                cancoder_found.append(rc)

        if cancoder_found:
            for rc in cancoder_found:
                report.append(f"- **{rc['part_id']}** ({rc['product_code']}): {rc['current_category']} → {rc['new_category']} | {rc['part_name']}\n")
        else:
            report.append("- No CANcoder/CANrange sensors found in reclassifications (may already be correctly classified)\n")

        report.append("\n")

        # Critical Misclassifications
        report.append("## Critical Misclassifications Found\n\n")

        # Sort reclassification types by count
        sorted_types = sorted(reclass_by_type.items(), key=lambda x: len(x[1]), reverse=True)

        for reclass_type, items in sorted_types:
            current_cat, new_cat = reclass_type.split("_to_")
            report.append(f"### {current_cat} → {new_cat}\n")
            report.append(f"**Total**: {len(items)} parts\n\n")

            report.append("| Part ID | Product Code | Part Name | Reason |\n")
            report.append("|---------|--------------|-----------|--------|\n")

            # Show all items (they need to see everything)
            for item in items:
                part_id = item.get('part_id', '')[:12] if len(item.get('part_id', '')) > 12 else item.get('part_id', '')
                name = item['part_name'][:70] if len(item['part_name']) > 70 else item['part_name']
                reason = item['reason'][:50] if len(item['reason']) > 50 else item['reason']
                product_code = item['product_code'][:12] if len(item['product_code']) > 12 else item['product_code']
                report.append(f"| {part_id} | {product_code} | {name} | {reason} |\n")

            report.append("\n")

        # Reclassification Summary
        report.append("## Reclassification Plan\n\n")
        report.append("### Changes Required:\n")

        change_summary = defaultdict(int)
        for rc in reclassifications:
            key = f"{rc['current_category']} → {rc['new_category']}"
            change_summary[key] += 1

        for change_type, count in sorted(change_summary.items(), key=lambda x: x[1], reverse=True):
            report.append(f"- **{change_type}**: {count} parts\n")

        report.append("\n### Current Category Counts:\n")
        current_counts = defaultdict(int)
        for r in results:
            current_counts[r["current_category"]] += 1

        for cat in sorted(current_counts.keys()):
            report.append(f"- **{cat}**: {current_counts[cat]}\n")

        report.append("\n### Post-Correction Category Counts:\n")
        for cat in sorted(final_category_counts.keys()):
            count = final_category_counts[cat]
            current = current_counts.get(cat, 0)
            change = count - current
            change_str = f" ({change:+d})" if change != 0 else ""
            report.append(f"- **{cat}**: {count}{change_str}\n")

        # Validation Checklist
        report.append("\n## Validation Checklist\n\n")
        report.append("For each reclassification:\n")
        report.append("- [ ] Part name clearly indicates correct category\n")
        report.append("- [ ] No ambiguous classifications\n")
        report.append("- [ ] Category codes updated\n")
        report.append("- [ ] Part IDs regenerated with new category prefixes\n\n")

        # Next Steps
        report.append("## Recommended Next Steps\n\n")
        report.append("1. Review reclassifications.json file\n")
        report.append("2. Apply all reclassifications to CSV\n")
        report.append("3. Regenerate Part IDs (MACH-001, STOCK-017, etc.)\n")
        report.append("4. Extract specs for newly populated categories\n")
        report.append("5. Re-import to Google Sheets\n")
        report.append("6. Verify with spot checks\n\n")

        # Sample Reclassifications for Quick Review
        report.append("## Sample Reclassifications for Quick Review\n\n")
        for reclass_type, items in list(sorted_types)[:3]:
            current_cat, new_cat = reclass_type.split("_to_")
            report.append(f"### {current_cat} → {new_cat} (showing first 10):\n")
            for item in items[:10]:
                report.append(f"- **{item.get('part_id', 'N/A')}** ({item['product_code']}): {item['part_name']}\n")
            report.append("\n")

        # Write report
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(''.join(report))

        print(f"Report written to: {output_path}")

    def generate_json(self, audit_results: Dict, output_path: str):
        """Generate JSON file with reclassifications"""
        reclassifications = audit_results["reclassifications"]

        # Count by type
        by_type = defaultdict(int)
        for rc in reclassifications:
            key = f"{rc['current_category']}_to_{rc['new_category']}"
            by_type[key] += 1

        output = {
            "reclassifications": reclassifications,
            "summary": {
                "total_changes": len(reclassifications),
                "by_category": dict(by_type)
            }
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2)

        print(f"JSON written to: {output_path}")


def main():
    """Main execution function"""
    csv_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/Part Directory - Next Attempt.csv"
    report_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/CLASSIFICATION_AUDIT_REPORT.md"
    json_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/reclassifications.json"

    # Run audit
    auditor = ClassificationAuditor(csv_path)
    audit_results = auditor.run_audit()

    # Generate outputs
    auditor.generate_report(audit_results, report_path)
    auditor.generate_json(audit_results, json_path)

    # Print summary
    print("\n" + "="*80)
    print("AUDIT COMPLETE")
    print("="*80)
    print(f"Total parts audited: {len(audit_results['results'])}")
    print(f"Misclassifications found: {len(audit_results['reclassifications'])}")
    print(f"\nReport: {report_path}")
    print(f"JSON: {json_path}")

    # Print top issues
    print("\nTop Reclassification Categories:")
    by_type = defaultdict(int)
    for rc in audit_results['reclassifications']:
        key = f"{rc['current_category']} → {rc['new_category']}"
        by_type[key] += 1

    for change_type, count in sorted(by_type.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {change_type}: {count} parts")


if __name__ == "__main__":
    main()
