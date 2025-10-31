/**
 * Import Verified WCP Parts to Google Sheets
 * Clears existing Parts data and imports wcp_final_verified.json
 * Generates proper Part IDs with sequential numbering per category
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const PARTS_SHEET = 'Parts';
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const JSON_DATA_PATH = path.join(__dirname, '../Testing/Spreadsheets/wcp_final_verified.json');

// Import date
const IMPORT_DATE = '2025-10-29';
const ADDED_BY = 'WCP Import';
const DEFAULT_STATUS = 'In Stock';

// Spec mapping configuration (maps JSON keys to Spec 1-4 columns)
const SPEC_MAPPINGS = {
  'BEAR': { spec1: 'type', spec2: 'id', spec3: 'od', spec4: 'wd' },
  'BELT': { spec1: 'type', spec2: 'teeth', spec3: 'width', spec4: null },
  'BOLT': { spec1: 'thread', spec2: 'length', spec3: 'type', spec4: null },
  'CHAIN': { spec1: 'type', spec2: 'teeth', spec3: 'length', spec4: null },
  'CTRL': { spec1: 'type', spec2: null, spec3: null, spec4: null },
  'GEAR': { spec1: 'teeth', spec2: 'pitch', spec3: 'bore_type', spec4: 'bore_size' },
  'HDWR': { spec1: 'type', spec2: 'size', spec3: null, spec4: null },
  'MACH': { spec1: 'tool_type', spec2: 'size', spec3: null, spec4: 'coating' },
  'SENSOR': { spec1: 'type', spec2: null, spec3: null, spec4: null },
  'SHAFT': { spec1: 'type', spec2: 'size', spec3: 'length', spec4: null },
  'STOCK': { spec1: 'type', spec2: 'size', spec3: null, spec4: 'length' },
  'WIRE': { spec1: 'type', spec2: 'gauge', spec3: 'length', spec4: null }
};

/**
 * Authenticate with Google Sheets API using service account
 */
async function authenticate() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return await auth.getClient();
}

/**
 * Clear Parts sheet data (keep headers)
 */
async function clearPartsSheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PARTS_SHEET}!A2:R`,
    });
    console.log('Parts sheet cleared (kept headers)');
  } catch (error) {
    throw new Error(`Failed to clear Parts sheet: ${error.message}`);
  }
}

/**
 * Load and parse JSON data
 */
function loadJSONData() {
  try {
    const data = JSON.parse(fs.readFileSync(JSON_DATA_PATH, 'utf8'));
    return data.parts;
  } catch (error) {
    throw new Error(`Failed to load JSON data: ${error.message}`);
  }
}

/**
 * Extract spec values from specifications object based on category mapping
 */
function extractSpecs(categoryCode, specifications) {
  const mapping = SPEC_MAPPINGS[categoryCode];

  if (!mapping || !specifications) {
    return ['', '', '', ''];
  }

  const spec1 = mapping.spec1 && specifications[mapping.spec1] ? specifications[mapping.spec1] : '';
  const spec2 = mapping.spec2 && specifications[mapping.spec2] ? specifications[mapping.spec2] : '';
  const spec3 = mapping.spec3 && specifications[mapping.spec3] ? specifications[mapping.spec3] : '';
  const spec4 = mapping.spec4 && specifications[mapping.spec4] ? specifications[mapping.spec4] : '';

  return [spec1, spec2, spec3, spec4];
}

/**
 * Generate Part IDs with sequential numbering per category
 */
function generatePartIDs(parts) {
  // Sort parts by category_code, then part_name
  const sortedParts = [...parts].sort((a, b) => {
    if (a.category_code !== b.category_code) {
      return a.category_code.localeCompare(b.category_code);
    }
    return a.part_name.localeCompare(b.part_name);
  });

  // Track counters per category
  const categoryCounters = {};

  // Assign Part IDs
  const partsWithIDs = sortedParts.map(part => {
    const categoryCode = part.category_code;

    // Initialize counter for this category if needed
    if (!categoryCounters[categoryCode]) {
      categoryCounters[categoryCode] = 1;
    }

    // Generate Part ID with 3-digit padding
    const partID = `${categoryCode}-${categoryCounters[categoryCode].toString().padStart(3, '0')}`;
    categoryCounters[categoryCode]++;

    return {
      ...part,
      part_id: partID
    };
  });

  return partsWithIDs;
}

/**
 * Convert parts to Google Sheets row format (18 columns A-R)
 * A: Part ID
 * B: Part Name
 * C: Category
 * D: Subcategory
 * E: Product Code
 * F-I: Spec 1-4
 * J: Quantity Per
 * K: Cost
 * L: Supplier
 * M: Order Link
 * N: Location/Bin
 * O: Notes
 * P: Status
 * Q: Date Added
 * R: Added By
 */
function convertPartsToRows(parts) {
  return parts.map(part => {
    const [spec1, spec2, spec3, spec4] = extractSpecs(part.category_code, part.specifications);

    return [
      part.part_id,                    // A: Part ID
      part.part_name,                  // B: Part Name
      part.category_name,              // C: Category
      part.subcategory || '',          // D: Subcategory
      part.product_code || '',         // E: Product Code
      spec1,                           // F: Spec 1
      spec2,                           // G: Spec 2
      spec3,                           // H: Spec 3
      spec4,                           // I: Spec 4
      part.pack_quantity || '',        // J: Quantity Per
      part.unit_cost || '',            // K: Cost
      part.supplier || '',             // L: Supplier
      part.supplier_url || '',         // M: Order Link
      '',                              // N: Location/Bin (empty)
      '',                              // O: Notes (empty)
      DEFAULT_STATUS,                  // P: Status
      IMPORT_DATE,                     // Q: Date Added
      ADDED_BY                         // R: Added By
    ];
  });
}

/**
 * Import parts to Google Sheets in batches
 */
async function importParts(auth, rows) {
  const sheets = google.sheets({ version: 'v4', auth });
  const BATCH_SIZE = 100;
  const BATCH_DELAY = 2000; // 2 seconds

  console.log(`\nImporting ${rows.length} rows in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    const startRow = i + 2; // +2 because row 1 is header, array is 0-indexed
    const endRow = startRow + batch.length - 1;

    console.log(`Batch ${batchNum}/${totalBatches}: Importing rows ${startRow}-${endRow}...`);

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PARTS_SHEET}!A${startRow}`,
        valueInputOption: 'RAW',
        resource: {
          values: batch
        }
      });

      console.log(`  Success: ${batch.length} rows imported`);

      // Delay between batches (except for last batch)
      if (i + BATCH_SIZE < rows.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    } catch (error) {
      throw new Error(`Failed to import batch ${batchNum}: ${error.message}`);
    }
  }
}

/**
 * Generate import summary
 */
function generateSummary(parts) {
  const categoryBreakdown = {};

  parts.forEach(part => {
    const category = part.category_code;
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = {
        name: part.category_name,
        count: 0
      };
    }
    categoryBreakdown[category].count++;
  });

  return categoryBreakdown;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  console.log('=== WCP PARTS IMPORT TO GOOGLE SHEETS ===');
  console.log(`Date: ${IMPORT_DATE}`);
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`Sheet: ${PARTS_SHEET}\n`);

  try {
    // Authenticate
    console.log('Authenticating with Google Sheets API...');
    const auth = await authenticate();
    console.log('Authentication successful\n');

    // Clear existing data
    console.log('Clearing existing Parts data...');
    await clearPartsSheet(auth);
    console.log('Parts cleared\n');

    // Load JSON data
    console.log('Loading verified WCP data...');
    const parts = loadJSONData();
    console.log(`Loaded ${parts.length} parts from JSON\n`);

    // Generate Part IDs
    console.log('Generating Part IDs...');
    const partsWithIDs = generatePartIDs(parts);
    console.log(`Part IDs generated (sequential per category)\n`);

    // Convert to rows
    console.log('Converting to Google Sheets format...');
    const rows = convertPartsToRows(partsWithIDs);
    console.log(`Converted ${rows.length} rows (18 columns each)\n`);

    // Import to Google Sheets
    await importParts(auth, rows);

    // Generate summary
    const categoryBreakdown = generateSummary(partsWithIDs);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total parts imported: ${partsWithIDs.length}`);
    console.log(`Import time: ${duration} seconds\n`);

    console.log('Category Breakdown:');
    Object.entries(categoryBreakdown)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, data]) => {
        console.log(`  ${code}: ${data.count} (${data.name})`);
      });

    console.log('\nImport complete - ready for QA verification');

  } catch (error) {
    console.error('\n=== IMPORT FAILED ===');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
