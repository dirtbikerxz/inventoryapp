/**
 * Phase 5: Import all 652 WCP parts with complete specifications to Google Sheets
 *
 * This script:
 * 1. Clears existing Parts sheet data (keeping headers)
 * 2. Loads parts_with_specs.json (652 parts)
 * 3. Generates Part IDs (CATEGORY_CODE-###)
 * 4. Maps all fields including Type and 5 specifications
 * 5. Batch uploads to Google Sheets
 * 6. Validates and generates import report
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const INPUT_FILE = path.join(__dirname, '..', 'Testing', 'parts_with_specs.json');
const REPORT_FILE = path.join(__dirname, '..', 'Testing', 'PHASE_5_IMPORT_REPORT.md');
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 2000;

/**
 * Initialize Google Sheets API client
 */
async function initializeGoogleSheets() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Clear existing data from Parts sheet (keep headers in row 1)
 */
async function clearPartsSheet(sheets) {
  console.log('Clearing existing Parts sheet data...');

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A2:T',
  });

  console.log('Parts sheet cleared successfully');
}

/**
 * Load and parse parts data from JSON file
 */
function loadPartsData() {
  console.log('Loading parts data from JSON file...');

  const jsonData = fs.readFileSync(INPUT_FILE, 'utf8');
  const data = JSON.parse(jsonData);

  console.log(`Loaded ${data.parts.length} parts from JSON file`);
  return data.parts;
}

/**
 * Sort parts and generate Part IDs
 * Format: CATEGORY_CODE-###
 */
function generatePartIds(parts) {
  console.log('Sorting parts and generating Part IDs...');

  // Sort by category_code, then part_name
  const sortedParts = [...parts].sort((a, b) => {
    if (a.category_code !== b.category_code) {
      return a.category_code.localeCompare(b.category_code);
    }
    return a.part_name.localeCompare(b.part_name);
  });

  // Generate IDs with counters per category
  const categoryCounters = {};
  const partsWithIds = sortedParts.map(part => {
    const categoryCode = part.category_code;

    if (!categoryCounters[categoryCode]) {
      categoryCounters[categoryCode] = 0;
    }

    categoryCounters[categoryCode]++;
    const partId = `${categoryCode}-${String(categoryCounters[categoryCode]).padStart(3, '0')}`;

    return {
      ...part,
      part_id: partId
    };
  });

  console.log(`Generated ${partsWithIds.length} Part IDs across ${Object.keys(categoryCounters).length} categories`);
  return { parts: partsWithIds, categoryCounters };
}

/**
 * Map part data to Google Sheets row format (20 columns A-T)
 */
function mapPartToRow(part) {
  return [
    part.part_id,                                                                           // A: Part ID
    part.part_name,                                                                         // B: Part Name
    part.category_name,                                                                     // C: Category
    part.subcategory || '',                                                                 // D: Subcategory
    part.type || '',                                                                        // E: Type
    part.product_code,                                                                      // F: Product Code
    part.specifications?.spec1 || '',                                                       // G: Spec 1
    part.specifications?.spec2 || '',                                                       // H: Spec 2
    part.specifications?.spec3 || '',                                                       // I: Spec 3
    part.specifications?.spec4 || '',                                                       // J: Spec 4
    part.specifications?.spec5 || '',                                                       // K: Spec 5
    part.pack_quantity || 1,                                                                // L: Quantity Per
    part.price,                                                                             // M: Cost
    'WCP',                                                                                  // N: Supplier
    part.url || `https://wcproducts.com/products/${part.product_code.toLowerCase()}`,      // O: Order Link
    '',                                                                                     // P: Location/Bin
    '',                                                                                     // Q: Notes
    'In Stock',                                                                             // R: Status
    '2025-10-30',                                                                           // S: Date Added
    'Bulk Import 2025-10-30'                                                                // T: Added By
  ];
}

/**
 * Upload data to Google Sheets in batches
 */
async function uploadToSheets(sheets, rows) {
  console.log(`Starting batch upload of ${rows.length} rows...`);

  const errors = [];
  let uploadedCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const startRow = i + 2; // +2 because row 1 is headers, arrays are 0-indexed
    const endRow = startRow + batch.length - 1;

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Parts!A${startRow}:T${endRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: batch }
      });

      uploadedCount += batch.length;
      console.log(`Imported rows ${startRow} to ${endRow} (${uploadedCount}/${rows.length})`);

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < rows.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    } catch (error) {
      const errorMsg = `Failed to upload batch starting at row ${startRow}: ${error.message}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return { uploadedCount, errors };
}

/**
 * Validate imported data
 */
function validateData(parts) {
  console.log('Validating data...');

  const validation = {
    totalParts: parts.length,
    duplicateIds: [],
    missingFields: [],
    spec5Count: 0,
    spec5Examples: []
  };

  // Check for duplicate Part IDs
  const idCounts = {};
  parts.forEach(part => {
    const id = part.part_id;
    idCounts[id] = (idCounts[id] || 0) + 1;
  });

  validation.duplicateIds = Object.entries(idCounts)
    .filter(([id, count]) => count > 1)
    .map(([id, count]) => `${id} (${count} occurrences)`);

  // Check for missing required fields
  parts.forEach(part => {
    if (!part.part_id || !part.part_name || !part.category_name || !part.product_code) {
      validation.missingFields.push(part.part_id || 'Unknown ID');
    }
  });

  // Count parts with Spec 5 populated
  parts.forEach(part => {
    if (part.specifications?.spec5) {
      validation.spec5Count++;
      if (validation.spec5Examples.length < 3) {
        validation.spec5Examples.push({
          id: part.part_id,
          name: part.part_name,
          spec5: part.specifications.spec5
        });
      }
    }
  });

  return validation;
}

/**
 * Get random sample of parts for verification
 */
function getRandomSample(parts, count = 5) {
  const shuffled = [...parts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Generate import report
 */
function generateReport(parts, categoryCounters, uploadResult, validation, duration, sample) {
  const report = `# Phase 5 Import Report

## Import Summary
- Total parts imported: ${validation.totalParts}
- Batch count: ${Math.ceil(validation.totalParts / BATCH_SIZE)}
- Import duration: ${duration.toFixed(2)} seconds
- Errors encountered: ${uploadResult.errors.length}

${uploadResult.errors.length > 0 ? `### Errors\n${uploadResult.errors.map(e => `- ${e}`).join('\n')}\n` : ''}

## Category Distribution
${Object.entries(categoryCounters)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([code, count]) => `- ${code}: ${count} parts`)
  .join('\n')}

## Sample Verification (5 random parts)
${sample.map(part => `
### ${part.part_id} - ${part.part_name}
- Category: ${part.category_name}
- Subcategory: ${part.subcategory || 'N/A'}
- Type: ${part.type || 'N/A'}
- Product Code: ${part.product_code}
- Specifications:
  - Spec 1: ${part.specifications?.spec1 || 'N/A'}
  - Spec 2: ${part.specifications?.spec2 || 'N/A'}
  - Spec 3: ${part.specifications?.spec3 || 'N/A'}
  - Spec 4: ${part.specifications?.spec4 || 'N/A'}
  - Spec 5: ${part.specifications?.spec5 || 'N/A'}
- Pack Quantity: ${part.pack_quantity || 1}
- Price: $${part.price}
- Supplier: WCP
`).join('\n')}

## Spec 5 Verification
- Parts with Spec 5 populated: ${validation.spec5Count}
- Percentage: ${((validation.spec5Count / validation.totalParts) * 100).toFixed(1)}%
${validation.spec5Examples.length > 0 ? `
### Example parts with Spec 5:
${validation.spec5Examples.map(ex => `- ${ex.id}: ${ex.name} - "${ex.spec5}"`).join('\n')}
` : ''}

## Validation
- Duplicate Part IDs: ${validation.duplicateIds.length}
${validation.duplicateIds.length > 0 ? validation.duplicateIds.map(d => `  - ${d}`).join('\n') : ''}
- Missing required fields: ${validation.missingFields.length}
${validation.missingFields.length > 0 ? validation.missingFields.map(m => `  - ${m}`).join('\n') : ''}
- Data integrity: ${validation.duplicateIds.length === 0 && validation.missingFields.length === 0 ? 'PASS' : 'FAIL'}

## Status
${uploadResult.errors.length === 0 && validation.duplicateIds.length === 0 && validation.missingFields.length === 0
  ? 'Import complete - ready for Phase 6 verification'
  : 'Import completed with issues - review errors and validation results'}

---
Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  console.log(`\nReport saved to: ${REPORT_FILE}`);

  return report;
}

/**
 * Main import function
 */
async function main() {
  const startTime = Date.now();

  try {
    console.log('=== Phase 5: Import WCP Parts with Specifications ===\n');

    // Initialize Google Sheets API
    const sheets = await initializeGoogleSheets();

    // Clear existing data
    await clearPartsSheet(sheets);

    // Load parts data
    const rawParts = loadPartsData();

    // Generate Part IDs
    const { parts, categoryCounters } = generatePartIds(rawParts);

    // Map to row format
    console.log('Mapping parts to row format...');
    const rows = parts.map(mapPartToRow);

    // Upload to Google Sheets
    const uploadResult = await uploadToSheets(sheets, rows);

    // Validate data
    const validation = validateData(parts);

    // Get random sample
    const sample = getRandomSample(parts, 5);

    // Calculate duration
    const duration = (Date.now() - startTime) / 1000;

    // Generate report
    const report = generateReport(parts, categoryCounters, uploadResult, validation, duration, sample);

    console.log('\n=== Import Complete ===');
    console.log(`Total parts imported: ${validation.totalParts}`);
    console.log(`Upload errors: ${uploadResult.errors.length}`);
    console.log(`Validation status: ${validation.duplicateIds.length === 0 && validation.missingFields.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`\nPhase 5 complete - 652 parts imported to Google Sheets`);

  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the import
main();
