/**
 * Import verified WCP parts data to Google Sheets Parts sheet
 * Reads wcp_final_verified.json and imports to Parts sheet with proper Part ID generation
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const SHEET_NAME = 'Parts';
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const JSON_PATH = path.join(__dirname, '../Testing/Spreadsheets/wcp_final_verified.json');
const LOG_PATH = path.join(__dirname, 'wcp-import-log.json');
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 2000;

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
 * Load and parse WCP parts data
 */
function loadWCPData() {
  const jsonContent = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(jsonContent);
  return data;
}

/**
 * Extract specifications from JSON spec object
 * Maps first 4 found values to Spec 1-4 columns
 */
function extractSpecs(specifications) {
  const specs = ['', '', '', ''];

  if (!specifications || typeof specifications !== 'object') {
    return specs;
  }

  // Priority order for spec extraction
  const specKeys = [
    'thread', 'teeth', 'tooth_count', 'type', 'od', 'id', 'wd',
    'gauge', 'width', 'bore', 'pitch', 'material', 'coating',
    'diameter', 'length', 'size', 'count'
  ];

  let specIndex = 0;

  // First, try priority keys in order
  for (const key of specKeys) {
    if (specifications[key] !== undefined && specifications[key] !== null && specifications[key] !== '') {
      specs[specIndex] = String(specifications[key]);
      specIndex++;
      if (specIndex >= 4) return specs;
    }
  }

  // Then add any remaining keys not in priority list
  for (const [key, value] of Object.entries(specifications)) {
    if (!specKeys.includes(key) && value !== undefined && value !== null && value !== '') {
      specs[specIndex] = String(value);
      specIndex++;
      if (specIndex >= 4) return specs;
    }
  }

  return specs;
}

/**
 * Sort parts by category code, then by part name alphabetically
 */
function sortParts(parts) {
  return parts.sort((a, b) => {
    // First sort by category code
    const categoryCompare = a.category_code.localeCompare(b.category_code);
    if (categoryCompare !== 0) return categoryCompare;

    // Then sort by part name alphabetically
    return a.part_name.localeCompare(b.part_name);
  });
}

/**
 * Generate Part IDs for all parts
 * Format: CATEGORY_CODE-### (3-digit zero-padded)
 * Sequential numbering within each category
 */
function generatePartIDs(sortedParts) {
  const categoryCounters = {};

  return sortedParts.map(part => {
    const categoryCode = part.category_code;

    // Initialize counter for this category if not exists
    if (!categoryCounters[categoryCode]) {
      categoryCounters[categoryCode] = 0;
    }

    // Increment and format
    categoryCounters[categoryCode]++;
    const number = String(categoryCounters[categoryCode]).padStart(3, '0');
    const partID = `${categoryCode}-${number}`;

    return {
      ...part,
      part_id: partID
    };
  });
}

/**
 * Convert parts to row arrays for Google Sheets
 * 18 columns: A-R
 */
function partsToRows(parts) {
  const today = '2025-10-29';

  return parts.map(part => {
    const specs = extractSpecs(part.specifications);

    return [
      part.part_id,                          // A: Part ID
      part.part_name || '',                  // B: Part Name
      part.category_name || '',              // C: Category
      part.subcategory || '',                // D: Subcategory (empty for WCP)
      part.product_code || '',               // E: Product Code
      specs[0],                              // F: Spec 1
      specs[1],                              // G: Spec 2
      specs[2],                              // H: Spec 3
      specs[3],                              // I: Spec 4
      part.pack_quantity || '',              // J: Quantity Per
      part.unit_cost || '',                  // K: Cost
      part.supplier || '',                   // L: Supplier
      part.supplier_url || '',               // M: Order Link
      '',                                    // N: Location/Bin
      '',                                    // O: Notes
      'In Stock',                            // P: Status
      today,                                 // Q: Date Added
      'WCP Import'                           // R: Added By
    ];
  });
}

/**
 * Import rows to Google Sheets in batches
 */
async function importToGoogleSheets(auth, rows) {
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`\nImporting ${rows.length} parts in batches of ${BATCH_SIZE}...`);

  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  let totalImported = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startRow = 2 + (i * BATCH_SIZE); // +2 because row 1 is header
    const endRow = startRow + batch.length - 1;
    const range = `${SHEET_NAME}!A${startRow}:R${endRow}`;

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'RAW',
        resource: {
          values: batch
        }
      });

      totalImported += batch.length;
      console.log(`  Batch ${i + 1}/${batches.length}: Imported rows ${startRow}-${endRow} (${batch.length} parts)`);

      // Delay between batches (except for last batch)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }

    } catch (error) {
      throw new Error(`Failed to import batch ${i + 1}: ${error.message}`);
    }
  }

  return totalImported;
}

/**
 * Generate category breakdown report
 */
function generateCategoryReport(parts) {
  const categories = {};

  parts.forEach(part => {
    const code = part.category_code;
    if (!categories[code]) {
      categories[code] = {
        name: part.category_name,
        count: 0,
        parts: []
      };
    }
    categories[code].count++;
    categories[code].parts.push(part.part_id);
  });

  // Sort by category code
  const sortedCodes = Object.keys(categories).sort();

  console.log('\n=== CATEGORY BREAKDOWN ===');
  sortedCodes.forEach(code => {
    const cat = categories[code];
    console.log(`${code}: ${cat.name} - ${cat.count} parts (${cat.parts[0]} to ${cat.parts[cat.parts.length - 1]})`);
  });

  return categories;
}

/**
 * Generate import log
 */
function generateLog(parts, categories, success, timeTaken, error = null) {
  const log = {
    timestamp: new Date().toISOString(),
    totalParts: parts.length,
    success: success,
    timeTaken: timeTaken,
    error: error,
    categories: Object.keys(categories).sort().map(code => ({
      code: code,
      name: categories[code].name,
      count: categories[code].count,
      firstPartID: categories[code].parts[0],
      lastPartID: categories[code].parts[categories[code].parts.length - 1]
    })),
    spreadsheet: {
      id: SPREADSHEET_ID,
      sheet: SHEET_NAME,
      range: `A2:R${parts.length + 1}`
    }
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`\nImport log written to ${LOG_PATH}`);

  return log;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  console.log('=== WCP PARTS IMPORT TO GOOGLE SHEETS ===');
  console.log(`Reading JSON from: ${JSON_PATH}`);

  try {
    // Load WCP data
    const data = loadWCPData();
    console.log(`Loaded ${data.parts.length} parts from JSON`);
    console.log(`Source: ${data.metadata.source}`);
    console.log(`Processing date: ${data.metadata.processing_date}`);

    // Sort parts by category and name
    console.log('\nSorting parts by category code and part name...');
    const sortedParts = sortParts(data.parts);
    console.log('Parts sorted');

    // Generate Part IDs
    console.log('\nGenerating Part IDs (CATEGORY-###)...');
    const partsWithIDs = generatePartIDs(sortedParts);
    console.log('Part IDs generated');

    // Show sample IDs
    console.log('\nSample Part IDs:');
    const sampleByCategory = {};
    partsWithIDs.forEach(part => {
      if (!sampleByCategory[part.category_code]) {
        sampleByCategory[part.category_code] = part;
      }
    });
    Object.keys(sampleByCategory).sort().forEach(code => {
      const part = sampleByCategory[code];
      console.log(`  ${part.part_id}: ${part.part_name.substring(0, 60)}...`);
    });

    // Convert to row arrays
    console.log('\nConverting to spreadsheet rows (18 columns A-R)...');
    const rows = partsToRows(partsWithIDs);
    console.log(`Prepared ${rows.length} rows for import`);

    // Authenticate
    console.log('\nAuthenticating with Google Sheets API...');
    const auth = await authenticate();
    console.log('Authentication successful');

    // Import to Google Sheets
    console.log(`\nTarget spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`Target sheet: ${SHEET_NAME}`);
    console.log(`Range: A2:R${rows.length + 1}`);

    const totalImported = await importToGoogleSheets(auth, rows);

    // Generate category report
    const categories = generateCategoryReport(partsWithIDs);

    // Calculate time taken
    const endTime = Date.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

    // Generate log
    generateLog(partsWithIDs, categories, true, timeTaken);

    // Final report
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total parts imported: ${totalImported}`);
    console.log(`Time taken: ${timeTaken} seconds`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`Sheet: ${SHEET_NAME}`);
    console.log('Confirmation: Import complete');

  } catch (error) {
    const endTime = Date.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

    console.error('\n=== IMPORT FAILED ===');
    console.error(`Error: ${error.message}`);
    console.error(`Time taken: ${timeTaken} seconds`);

    // Generate error log
    generateLog([], {}, false, timeTaken, error.message);

    process.exit(1);
  }
}

// Run the script
main();
