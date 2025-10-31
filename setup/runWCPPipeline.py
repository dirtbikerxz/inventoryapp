#!/usr/bin/env python3
"""
WCP Parts Processing Pipeline
Master script that runs the entire parsing, classification, and specification extraction pipeline.
"""

import sys
import time
from pathlib import Path

# Add setup directory to path for imports
setup_dir = Path(__file__).parent
sys.path.insert(0, str(setup_dir))

# Import pipeline modules
from parseWCP import WCPParser
from classifyParts import PartClassifier
from extractSpecs import SpecExtractor
from generateOutput import OutputGenerator

import json


def run_pipeline():
    """Run the complete WCP parts processing pipeline."""
    print("=" * 70)
    print("WCP PARTS PROCESSING PIPELINE")
    print("=" * 70)
    print()

    start_time = time.time()

    # File paths
    csv_path = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/WCP_Parts.csv"
    categories_csv = "/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/frc_new_categories.csv"
    output_dir = Path("/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets")

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Intermediate files
    parsed_json = output_dir / "wcp_parsed.json"
    classified_json = output_dir / "wcp_classified.json"
    with_specs_json = output_dir / "wcp_with_specs.json"
    final_json = output_dir / "wcp_parsed_classified.json"

    # Step 1: Parse hierarchical CSV
    print("\n" + "=" * 70)
    print("STEP 1: PARSING WCP CSV")
    print("=" * 70)
    step_start = time.time()

    parser = WCPParser(csv_path)
    parts = parser.parse()
    parser.save_json(str(parsed_json))

    step_time = time.time() - step_start
    print(f"\nStep 1 completed in {step_time:.2f} seconds")

    if not parts:
        print("ERROR: No parts parsed from CSV!")
        return 1

    # Step 2: Classify parts into categories
    print("\n" + "=" * 70)
    print("STEP 2: CLASSIFYING PARTS")
    print("=" * 70)
    step_start = time.time()

    classifier = PartClassifier(str(categories_csv))
    classified_parts = classifier.classify_all(parts)

    # Save intermediate result
    with open(classified_json, 'w', encoding='utf-8') as f:
        json.dump({
            'parts': classified_parts,
            'metadata': {
                'total_parts': len(classified_parts)
            }
        }, f, indent=2, ensure_ascii=False)

    step_time = time.time() - step_start
    print(f"\nStep 2 completed in {step_time:.2f} seconds")

    # Step 3: Extract specifications
    print("\n" + "=" * 70)
    print("STEP 3: EXTRACTING SPECIFICATIONS")
    print("=" * 70)
    step_start = time.time()

    extractor = SpecExtractor()
    parts_with_specs = extractor.process_all(classified_parts)

    # Save intermediate result
    with open(with_specs_json, 'w', encoding='utf-8') as f:
        json.dump({
            'parts': parts_with_specs,
            'metadata': {
                'total_parts': len(parts_with_specs)
            }
        }, f, indent=2, ensure_ascii=False)

    step_time = time.time() - step_start
    print(f"\nStep 3 completed in {step_time:.2f} seconds")

    # Step 4: Generate final output
    print("\n" + "=" * 70)
    print("STEP 4: GENERATING FINAL OUTPUT")
    print("=" * 70)
    step_start = time.time()

    generator = OutputGenerator()
    final_output = generator.generate_final_output(parts_with_specs)

    # Save final output
    with open(final_json, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    step_time = time.time() - step_start
    print(f"\nStep 4 completed in {step_time:.2f} seconds")

    # Final summary
    total_time = time.time() - start_time
    print("\n" + "=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)
    print(f"\nTotal processing time: {total_time:.2f} seconds")
    print(f"Total parts processed: {final_output['metadata']['total_parts']}")
    print(f"\nFinal output saved to:")
    print(f"  {final_json}")

    # Print final statistics
    metadata = final_output['metadata']
    print(f"\nFinal Statistics:")
    print(f"  Classification Quality:")
    print(f"    High confidence:    {metadata['classification_stats']['high_confidence']:4d} parts")
    print(f"    Medium confidence:  {metadata['classification_stats']['medium_confidence']:4d} parts")
    print(f"    Low confidence:     {metadata['classification_stats']['low_confidence']:4d} parts")
    print(f"    Average confidence: {metadata['classification_stats']['average_confidence']:.3f}")
    print(f"\n  Specification Extraction:")
    print(f"    Parts with specs: {metadata['specification_extraction']['parts_with_specs']} ({metadata['specification_extraction']['coverage_percentage']:.1f}%)")

    return 0


if __name__ == "__main__":
    sys.exit(run_pipeline())
