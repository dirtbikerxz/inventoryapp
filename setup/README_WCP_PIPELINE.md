# WCP Parts Processing Pipeline - Quick Reference

## Overview
Intelligent system to parse, classify, and extract specifications from WCP parts catalog.

## Quick Start

### Run Complete Pipeline
```bash
cd /mnt/c/Users/frc80/OneDrive/Documents/DVOM/setup
python3 runWCPPipeline.py
```

This runs all 4 steps:
1. Parse WCP CSV (0.05s)
2. Classify parts (0.05s)
3. Extract specifications (0.03s)
4. Generate final output (0.04s)

**Total Time**: ~0.17 seconds

## Individual Scripts

### 1. Parse WCP CSV
```bash
python3 parseWCP.py
```
- Input: `/Testing/WCP_Parts.csv`
- Output: `/Testing/Spreadsheets/wcp_parsed.json`
- Extracts 587 parts from hierarchical CSV

### 2. Classify Parts
```bash
python3 classifyParts.py
```
- Input: `wcp_parsed.json`
- Output: `wcp_classified.json`
- Assigns category codes and confidence scores

### 3. Extract Specifications
```bash
python3 extractSpecs.py
```
- Input: `wcp_classified.json`
- Output: `wcp_with_specs.json`
- Extracts technical specs using regex

### 4. Generate Final Output
```bash
python3 generateOutput.py
```
- Input: `wcp_with_specs.json`
- Output: `wcp_parsed_classified.json`
- Creates final structured JSON with URLs

## Reporting Scripts

### Generate Classification Report
```bash
python3 generateReport.py
```
Shows:
- Classification statistics
- Category distribution
- Sample parts by category
- Specification coverage

### Validate Output
```bash
python3 validateOutput.py
```
Validates:
- Required fields present
- URL format correctness
- Product code validity
- Confidence distribution
- Price ranges

## Output Files

### Main Output
`/Testing/Spreadsheets/wcp_parsed_classified.json` (393KB)
- Final structured data
- Ready for import to Parts Directory
- Contains 587 classified parts

### Intermediate Files
- `wcp_parsed.json` (150KB) - Raw parsed data
- `wcp_classified.json` (262KB) - With classifications
- `wcp_with_specs.json` (329KB) - With specifications

## Input Requirements

### WCP Parts CSV
**Location**: `/Testing/WCP_Parts.csv`

**Format**: Hierarchical structure
- Line 1: Title header
- Sections: Product category headers with URLs
- Subsections: Product type groupings
- Parts: Rows with WCP-#### codes

**Example**:
```
West Coast Products Parts
,Bolts WCP Website: https://wcproducts.com/products/bolts
,,#10-32 BHCS
,,,"#10-32 x .500" L BHCS (Steel, Black Oxide) (50-Pack)(WCP-0253)+$4.49 In Stock"
```

### Categories CSV
**Location**: `/Testing/Spreadsheets/frc_new_categories.csv`

**Format**: 3 columns
- Category: Full name
- Code: Short code (e.g., FAST, GEAR)
- Description: Category description for classification

## JSON Output Structure

```json
{
  "parts": [
    {
      "original_name": "Part name from WCP",
      "cleaned_name": "Part name without pack info",
      "product_code": "WCP-####",
      "classified_category_code": "GEAR",
      "classified_category_name": "Gears",
      "classification_confidence": 0.96,
      "specifications": {
        "teeth": "14T",
        "diametral_pitch": "20 DP",
        "bore_type": "Hex",
        "bore_size": "3/8\"",
        "material": "Aluminum",
        "pack_quantity": 1
      },
      "pack_quantity": 1,
      "unit_cost": 10.99,
      "supplier": "WCP",
      "supplier_url": "https://www.wcproducts.com/products/wcp-0680",
      "wcp_section": "Aluminum Gear",
      "wcp_subsection": "Aluminum 3/8\" Hex Bore Gears"
    }
  ],
  "metadata": {
    "total_parts": 587,
    "classification_stats": {...},
    "category_distribution": {...},
    "specification_extraction": {...}
  }
}
```

## Performance Benchmarks

- **Parsing**: 0.05 seconds (587 parts from 757 lines)
- **Classification**: 0.05 seconds (587 parts, 92.5% avg confidence)
- **Spec Extraction**: 0.03 seconds (72.1% coverage)
- **Output Generation**: 0.04 seconds (all URLs and metadata)
- **Total**: 0.17 seconds

## Classification Confidence Levels

### High (>= 0.95) - 64.4% of parts
- Exact keyword matches
- Strong category indicators
- Example: "BHCS", "Spur Gear", "Timing Belt"

### Medium (0.70-0.94) - 35.6% of parts
- Context-based (WCP section/subsection)
- Material + category hints
- Example: "Aluminum" in "Aluminum Gear" section

### Low (< 0.70) - 0% of parts
- All parts successfully classified
- No manual review needed

## Specification Extraction Coverage

| Category | Coverage |
|----------|----------|
| Belts | 100.0% |
| Pulleys | 100.0% |
| Sprockets | 100.0% |
| Chain | 100.0% |
| Fasteners | 87.9% |
| Gears | 84.2% |
| Bearings | 0.0% (needs enhancement) |
| Wiring | 0.0% (needs enhancement) |
| Structural | 0.0% (needs enhancement) |
| Shafts & Hubs | 0.0% (needs enhancement) |

## Error Handling

### No Errors Expected
All scripts handle:
- Missing fields gracefully
- Malformed data
- Unicode issues
- Empty values

### If Errors Occur
Check:
1. Input file paths correct
2. CSV encoding (UTF-8)
3. JSON validity of intermediate files
4. Python 3.10+ installed

## Extending the System

### Add New Category
1. Add to `frc_new_categories.csv`
2. Add patterns to `classifyParts.py`
3. Add spec extraction to `extractSpecs.py`
4. Re-run pipeline

### Add New Specification
1. Add regex pattern to `extractSpecs.py`
2. Add to category-specific extraction logic
3. Add to output formatting in `generateOutput.py`

### Improve Classification
1. Analyze low-confidence parts
2. Add patterns to `_high_confidence_patterns()`
3. Enhance context matching in `_medium_confidence_patterns()`

## Dependencies

### Required
- Python 3.10+
- Standard library only (no pip installs needed)

### Modules Used
- `json` - JSON parsing/serialization
- `re` - Regular expressions
- `csv` - CSV file handling
- `pathlib` - Path operations
- `typing` - Type hints
- `dataclasses` - Data structures
- `collections` - Counter for statistics

## Troubleshooting

### "File not found"
- Check that WCP_Parts.csv is in `/Testing/` directory
- Check that frc_new_categories.csv is in `/Testing/Spreadsheets/`

### "No parts parsed"
- Verify CSV format matches expected structure
- Check for encoding issues (use UTF-8)
- Run parseWCP.py separately to see detailed logs

### "Low confidence classifications"
- Review WCP section/subsection names
- Add new patterns to classifyParts.py
- Consider manual review of affected parts

## Contact & Support

For questions or issues with the WCP pipeline:
1. Review this README
2. Check AGENT2_FINAL_REPORT.md for detailed documentation
3. Examine WCP_CLASSIFICATION_SUMMARY.md for results analysis

## Version History

**v1.0** - October 29, 2025
- Initial implementation
- 587 parts processed
- 92.5% average confidence
- 72.1% spec extraction coverage
- Complete pipeline in 0.17 seconds
