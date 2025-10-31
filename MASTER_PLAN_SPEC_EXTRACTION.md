# MASTER PLAN: WCP Parts Spec Extraction & Import
**FRC Team 8044 Denham Venom - Parts Directory System**

**Date Created:** 2025-10-29
**Status:** ACTIVE - Phase 1 Root Cause Analysis
**Goal:** 100% correct categorization + 100% spec extraction for all 588 WCP parts

---

## EXECUTIVE SUMMARY

**Problem:** WCP parts are being imported with empty spec fields despite extraction scripts claiming high coverage. Root cause is a disconnect between:
1. What data exists in WCP part names
2. What the Python extraction script captures
3. How the Spec Config defines fields
4. How the import script maps data to columns

**Solution:** Systematic analysis → redesign → re-extract → re-import with verification at each stage.

---

## CRITICAL EXAMPLES (DO NOT LOSE CONTEXT)

### Example 1: Bearing (BEAR-001)
**Part Name:** `"0.188"" ID x 0.500"" OD x 0.196"" WD (Radial Bearing)"`
**Product Code:** WCP-0773
**Current Spec Config:**
- Spec 1: Bearing Type
- Spec 2: Bore Size
- Spec 3: OD
- Spec 4: Material

**Problem:** All specs are EMPTY in Google Sheets despite clear data in part name
**Available Data:** ID=0.188", OD=0.500", WD=0.196", Type=Radial Bearing

### Example 2: Shoulder Bolt (BOLT-036)
**Part Name:** `"5/16""-18 x 3/8"" L x 3/8"" Round Shoulder Bolt (Steel) (2-Pack)"`
**Product Code:** WCP-0351
**Current Spec Config:**
- Spec 1: Thread Size
- Spec 2: Length
- Spec 3: Type
- Spec 4: Material/Finish

**Problem:** All specs are EMPTY in Google Sheets
**Available Data:** Thread=5/16"-18, Length=3/8" L, Shoulder Length=3/8", Type=Round Shoulder Bolt, Material=Steel

---

## PHASE 1: ROOT CAUSE ANALYSIS

### Step 1.1: Examine Current Data Pipeline
**OWNER:** Claude Code
**ACTION:** Trace the complete data flow from WCP CSV to Google Sheets

**Tasks:**
1. Read `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/wcp_final_verified.json`
2. Find BEAR category parts (should be 49 parts)
3. Examine the `specifications` object structure for 10 sample bearings
4. Document what keys exist: Example `{id: "0.188\"", od: "0.500\"", wd: "0.196\"", type: "Radial Bearing"}`
5. Do the same for BOLT category (38 parts)
6. Create matrix showing: Part Name → What was extracted → What keys were used

**Deliverable:** `Testing/DATA_FLOW_ANALYSIS.md`

### Step 1.2: Review Import Script Logic
**OWNER:** Claude Code
**ACTION:** Find and analyze how specifications get mapped to columns

**Tasks:**
1. Check if `setup/importVerifiedWCP.js` exists
2. If it exists, read it and document the mapping logic
3. If it doesn't exist, determine what script actually performed the import
4. Document: How does `{id: "0.188\"", od: "0.500\""}` become Spec 1-4 values?
5. Identify the disconnect: Why isn't this mapping working?

**Deliverable:** Add to `Testing/DATA_FLOW_ANALYSIS.md` under "Import Mapping Logic" section

### Step 1.3: Analyze WCP Part Name Patterns
**OWNER:** Claude Code
**ACTION:** Sample actual WCP data to understand patterns

**Tasks:**
1. Read `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/WCP_Parts.csv`
2. Extract 20 bearing part names - document patterns
3. Extract 20 bolt/fastener part names - document patterns
4. Extract 20 gear part names - document patterns
5. Extract samples from all other major categories
6. Create pattern documentation showing regex-extractable data

**Example Output:**
```
BEARINGS Pattern Analysis:
- Pattern 1: "X.XXX" ID x X.XXX" OD x X.XXX" WD (Type)" - 45 parts
- Pattern 2: "Hex Bearing - X.XXX" ID" - 3 parts
- Pattern 3: "Flanged Bearing X.XXX" Bore" - 1 part

BOLTS Pattern Analysis:
- Pattern 1: "#XX-XX x X.XXX" L TYPE (Material)" - 25 parts
- Pattern 2: "X/XX"-XX x X.XXX" L x X.XXX" TYPE (Material)" - 10 parts
...
```

**Deliverable:** `Testing/WCP_PATTERN_ANALYSIS.md`

### Step 1.4: Spec Config Reality Check
**OWNER:** Claude Code
**ACTION:** Compare Spec Config to actual available data

**Tasks:**
1. Read `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/setup/buildSpecConfig.js` (lines 21-190)
2. For each category, list current Spec Config labels
3. Compare to available data from Step 1.3 pattern analysis
4. Identify mismatches:
   - BEAR says "Bore Size" but data has "ID" (Inner Diameter)
   - Are these the same thing or different?
5. Recommend Spec Config changes OR extraction changes

**Example Output:**
```
BEAR Category Analysis:
Current Config: Bearing Type, Bore Size, OD, Material
Available Data: ID, OD, WD, Type
Mismatch: "Bore Size" vs "ID" - THESE ARE THE SAME
Mismatch: Missing WD (Width/Depth) - CRITICAL DIMENSION
Recommendation: Change to: Type, ID (Inner Diameter), OD (Outer Diameter), WD (Width)
```

**Deliverable:** `Testing/SPEC_CONFIG_RECOMMENDATIONS.md`

### Step 1.5: Software Assessment
**OWNER:** Claude Code
**ACTION:** Evaluate if additional software would improve accuracy

**Current Python Environment Check:**
```bash
python3 --version
pip3 list | grep -E "(pandas|numpy|regex|pint)"
```

**Evaluation Criteria:**
1. **pandas** - Would dataframe operations help? (Probably already installed)
2. **regex** - Would advanced regex help vs standard `re`? (Evaluate need)
3. **pint** - Would unit parsing help? (e.g., "0.188\"" → 0.188 inches)
4. **openai/anthropic** - Would LLM-based extraction be more accurate?

**Tasks:**
1. Check what's currently installed
2. Evaluate if current failures are due to:
   - Bad regex patterns (fixable without new software)
   - Lack of intelligent parsing (might need LLM)
   - Data structure issues (fixable with better code)
3. Make specific recommendations with justification

**Deliverable:** `Testing/SOFTWARE_RECOMMENDATIONS.md`

**Output Format:**
```markdown
## Software Recommendations

### Currently Installed:
- Python 3.x.x
- json (standard library)
- re (standard library)
- [list others]

### Recommended Additions:
1. **Package:** anthropic
   **Why:** LLM-based extraction for complex part names
   **Installation:** `pip3 install anthropic`
   **Use Case:** Parse ambiguous specs like "5/16"-18 x 3/8" L x 3/8" Round"

2. **Package:** None additional needed
   **Why:** Current regex approach is sufficient with better patterns
```

### Step 1.6: Create Diagnosis Summary
**OWNER:** Claude Code
**ACTION:** Synthesize findings into executive summary

**Input:** All deliverables from Steps 1.1-1.5
**Output:** `Testing/ROOT_CAUSE_DIAGNOSIS.md`

**Required Sections:**
1. **Data Flow Breakdown** - Where does the pipeline fail?
2. **Spec Config Issues** - What needs to change?
3. **Extraction Issues** - What patterns are we missing?
4. **Mapping Issues** - How should specs flow to columns?
5. **Root Cause** - The fundamental problem in 1-2 sentences
6. **Recommended Solution** - High-level approach

---

## PHASE 2: SOLUTION DESIGN

### Step 2.1: Design New Spec Config
**OWNER:** Claude Code (proposes) → Human Partner (approves)
**ACTION:** Update Spec Config to match WCP reality

**Process:**
1. Claude Code creates `Testing/PROPOSED_SPEC_CONFIG.md` based on Phase 1 findings
2. For each category, propose new spec field labels that match extractable data
3. Include justification for each change
4. **HUMAN CHECKPOINT:** Human reviews and approves changes

**Example Proposal:**
```javascript
'BEAR': {
  spec1: 'Type (Radial/Flanged/Hex)',  // Changed from "Bearing Type"
  spec2: 'ID (Inner Diameter)',         // Changed from "Bore Size"
  spec3: 'OD (Outer Diameter)',         // Same
  spec4: 'WD (Width)'                   // Changed from "Material"
}
```

**Deliverable:** `Testing/PROPOSED_SPEC_CONFIG.md`
**Next:** Human Partner reviews and approves before proceeding

### Step 2.2: Design Extraction Strategy
**OWNER:** Claude Code
**ACTION:** Create category-specific extraction patterns

**Input:** WCP_PATTERN_ANALYSIS.md, approved PROPOSED_SPEC_CONFIG.md
**Output:** `Testing/EXTRACTION_STRATEGY.md`

**Required Content:**
1. For each category, define extraction approach:
   - Regex patterns with examples
   - Fallback strategies if primary pattern fails
   - Validation rules (e.g., OD must be > ID for bearings)
2. Define mapping layer:
   ```
   Extracted {id, od, wd, type} → Spec {spec1=type, spec2=id, spec3=od, spec4=wd}
   ```
3. Target coverage goals per category (realistic, not aspirational)

### Step 2.3: Design Import Mapping
**OWNER:** Claude Code
**ACTION:** Define how JSON specifications → Google Sheets columns

**Output:** `Testing/IMPORT_MAPPING_LOGIC.md`

**Required Content:**
1. Explicit mapping rules:
   ```
   For category BEAR:
   - specifications.type → Column F (Spec 1)
   - specifications.id → Column G (Spec 2)
   - specifications.od → Column H (Spec 3)
   - specifications.wd → Column I (Spec 4)
   ```
2. Default values when spec missing
3. Validation before import (check spec keys exist)

### Step 2.4: Create Implementation Plan
**OWNER:** Claude Code
**ACTION:** Break solution into executable tasks

**Output:** `Testing/IMPLEMENTATION_PLAN.md`

**Required Sections:**
1. **Spec Config Update Tasks** (modify buildSpecConfig.js)
2. **Extraction Script Tasks** (rewrite extractSpecs.py or create new)
3. **Import Script Tasks** (rewrite import logic)
4. **Verification Tasks** (how to validate each stage)
5. **Rollback Plan** (what if something fails)

**Each task must include:**
- Description
- Input files
- Output files
- Success criteria
- Verification method

---

## PHASE 3: SOFTWARE INSTALLATION

**OWNER:** Human Partner (executes) ← Claude Code (provides instructions)

### Step 3.1: Check Current Environment
**Human Action:**
```bash
cd /mnt/c/Users/frc80/OneDrive/Documents/DVOM
python3 --version
pip3 --version
pip3 list
```

**Human:** Copy the output and provide to Claude Code

### Step 3.2: Install Required Software
**CONDITIONAL:** Only if SOFTWARE_RECOMMENDATIONS.md specifies installations

**Human Action:** Follow exact commands provided by Claude Code
**Example:**
```bash
pip3 install anthropic
pip3 install pandas
```

**Human:** Confirm successful installation by running:
```bash
pip3 list | grep [package-name]
```

---

## PHASE 4: SPEC CONFIG UPDATE

### Step 4.1: Update Spec Config Code
**OWNER:** Claude Code
**ACTION:** Modify `setup/buildSpecConfig.js` with approved changes

**Process:**
1. Read current buildSpecConfig.js
2. Update SPEC_CONFIGURATIONS object (lines 21-190) with approved specs
3. Maintain exact code structure and formatting
4. Add comments documenting changes

**Verification:**
```bash
node setup/buildSpecConfig.js
```
Check for errors

### Step 4.2: Deploy Updated Spec Config to Google Sheets
**OWNER:** Claude Code
**ACTION:** Run the updated script

```bash
node setup/buildSpecConfig.js
```

**Success Criteria:**
- Script completes without errors
- Google Sheets "Spec Config" tab updated
- All 28 categories have correct spec labels

**Human Checkpoint:** Human manually checks 3-5 categories in Google Sheets

---

## PHASE 5: DATA RE-EXTRACTION

### Step 5.1: Create New Extraction Script
**OWNER:** Claude Code
**ACTION:** Write category-specific extraction with proper mapping

**File:** `setup/extractSpecsV2.py`

**Requirements:**
1. Read WCP_Parts.csv
2. For each part, extract specs using patterns from EXTRACTION_STRATEGY.md
3. Store in specifications object using keys that match Spec Config:
   ```python
   specifications = {
       "spec1": "Radial Bearing",    # Maps to Spec 1 column
       "spec2": "0.188\"",            # Maps to Spec 2 column
       "spec3": "0.500\"",            # Maps to Spec 3 column
       "spec4": "0.196\""             # Maps to Spec 4 column
   }
   ```
4. Include coverage tracking per category
5. Log any parts where extraction fails

**Output:** `Testing/Spreadsheets/wcp_reextracted.json`

### Step 5.2: Verify Extraction Quality
**OWNER:** Claude Code
**ACTION:** Sample and validate extracted data

**Verification Script:** `setup/verifyExtraction.py`

**Checks:**
1. Load wcp_reextracted.json
2. For each category, sample 10 parts
3. For each sample:
   - Check if spec1, spec2, spec3, spec4 keys exist
   - Check if values are populated (not empty strings)
   - Display: Part Name → Extracted Specs
4. Calculate coverage: X/Y parts have all 4 specs

**Success Criteria:**
- BEAR: 90%+ parts have spec1, spec2, spec3, spec4 populated
- BOLT: 80%+ parts have spec1, spec2, spec3 populated
- Overall: 85%+ average coverage

**Human Checkpoint:** Human reviews sample output and approves quality

---

## PHASE 6: CLASSIFICATION RE-VERIFICATION

### Step 6.1: Re-run Classification Audit
**OWNER:** Claude Code
**ACTION:** Ensure all 588 parts still correctly classified

**Process:**
1. Load wcp_reextracted.json
2. Verify all 43 previous corrections still applied
3. Sample 50 parts across all categories
4. Generate verification report

**Success Criteria:** 100% classification accuracy

---

## PHASE 7: GOOGLE SHEETS RE-IMPORT

### Step 7.1: Create New Import Script
**OWNER:** Claude Code
**ACTION:** Write import script with explicit spec mapping

**File:** `setup/importWithSpecs.js`

**Key Requirements:**
1. Read wcp_reextracted.json
2. For each part:
   ```javascript
   const specs = part.specifications;
   const row = [
     partId,           // A
     part.part_name,   // B
     part.category_name, // C
     '',               // D (subcategory)
     part.product_code, // E
     specs.spec1 || '', // F (Spec 1)
     specs.spec2 || '', // G (Spec 2)
     specs.spec3 || '', // H (Spec 3)
     specs.spec4 || '', // I (Spec 4)
     part.pack_quantity, // J
     part.unit_cost,   // K
     part.supplier,    // L
     part.supplier_url, // M
     '',               // N (location)
     '',               // O (notes)
     'In Stock',       // P
     '2025-10-29',     // Q
     'WCP Import v2'   // R
   ];
   ```
3. Batch import (100 rows per request, 2 second delays)

### Step 7.2: Clear and Import
**OWNER:** Human Partner (clears) → Claude Code (imports)

**Human Action:**
1. Manually delete all data rows from Google Sheets Parts tab (keep headers)
2. Confirm to Claude Code: "Parts sheet cleared, ready for import"

**Claude Code Action:**
```bash
node setup/importWithSpecs.js
```

**Success Criteria:**
- 588 parts imported
- No duplicate Part IDs
- No errors during import

---

## PHASE 8: FINAL VERIFICATION

### Step 8.1: Automated Quality Check
**OWNER:** Claude Code
**ACTION:** Run comprehensive verification against live Google Sheets

**Verification Script:** `setup/finalVerification.js`

**Checks:**
1. Total parts count: 588
2. No duplicate Part IDs
3. Category distribution matches expected
4. Sample 20 parts from Google Sheets:
   - BEAR-001: Check all 4 specs populated
   - BOLT-036: Check all 4 specs populated
   - etc.
5. Generate pass/fail report

**Deliverable:** `Testing/FINAL_VERIFICATION_REPORT.md`

### Step 8.2: Manual Spot Check
**OWNER:** Human Partner
**ACTION:** Manually verify 10-15 parts in Google Sheets

**Human Instructions:**
1. Open Google Sheets Parts tab
2. Check these specific parts:
   - BEAR-001 (should have ID, OD, WD, Type)
   - BOLT-036 (should have thread, length, type, material)
   - GEAR-001 (should have teeth, pitch, bore, etc.)
   - [Claude Code will provide specific list]
3. Confirm specs are populated and make sense
4. Report any issues to Claude Code

**Success Criteria:** Human confirms quality is acceptable

---

## PHASE 9: DOCUMENTATION & COMPLETION

### Step 9.1: Update Context Summary
**OWNER:** Claude Code
**ACTION:** Update context-summary.md with final state

### Step 9.2: Create Success Report
**OWNER:** Claude Code
**ACTION:** Document final statistics and achievements

**Deliverable:** `Testing/SUCCESS_REPORT.md`

**Required Metrics:**
- Total parts imported: 588
- Classification accuracy: 100%
- Spec coverage by category (with specific percentages)
- Categories with 90%+ coverage
- Known limitations (if any)

---

## ROLLBACK PROCEDURES

### If Phase 5 Extraction Fails:
1. Keep wcp_final_verified.json (current working file)
2. Debug extraction patterns
3. Re-run extraction until successful

### If Phase 7 Import Fails:
1. Human manually clears Parts sheet again
2. Claude Code fixes import script
3. Re-run import

### If Phase 8 Verification Fails:
1. Analyze specific failures
2. Determine if issue is extraction or import
3. Fix and repeat relevant phase

---

## SUCCESS CRITERIA

**Project Complete When:**
1. ✓ All 588 parts imported with correct categories
2. ✓ All 43 classification corrections maintained
3. ✓ BEAR-001 has all 4 specs populated correctly
4. ✓ BOLT-036 has all 4 specs populated correctly
5. ✓ 85%+ overall spec coverage across all categories
6. ✓ No duplicate Part IDs
7. ✓ Human Partner confirms quality is acceptable
8. ✓ All documentation updated

---

## FILES TO MAINTAIN CONTEXT

**Read These Files at Start of Each Session:**
1. `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/MASTER_PLAN_SPEC_EXTRACTION.md` (this file)
2. `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/context-summary.md`
3. `/mnt/c/Users/frc80/OneDrive/Documents/DVOM/Testing/Spreadsheets/frc_new_categories.csv`
4. Current phase deliverables

**Update These Files as Work Progresses:**
1. This master plan (update status at top)
2. context-summary.md (at major milestones)
3. All Testing/*.md deliverables

---

## COMMUNICATION PROTOCOLS

**When Claude Code Needs Human:**
- Explicitly state: "HUMAN CHECKPOINT REQUIRED"
- Explain what needs review/approval
- Wait for human response before proceeding

**When Human Needs Update:**
- Check current phase status at top of this document
- Read latest deliverables in Testing/ folder

---

## CURRENT STATUS

**Phase:** 1 - Root Cause Analysis
**Step:** 1.1 - Examine Current Data Pipeline
**Next Action:** Claude Code reads wcp_final_verified.json and analyzes BEAR/BOLT specifications objects

**Last Updated:** 2025-10-29
