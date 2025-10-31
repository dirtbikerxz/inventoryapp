/**
 * Import WCP Parts to Google Sheets
 * Loads 587 validated and classified parts with Part ID generation
 *
 * @author WCP Import System
 * @date 2025-10-29
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  SPREADSHEET_ID: '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo',
  SHEET_NAME: 'Parts',
  CREDENTIALS_PATH: path.join(__dirname, '..', 'credentials.json'),
  CORRECTED_JSON_PATH: path.join(__dirname, '..', 'Testing', 'Spreadsheets', 'wcp_parsed_classified_corrected.json'),
  CATEGORIES_LOG_PATH: path.join(__dirname, 'categories-import-log.json'),
  VALIDATION_REPORT_PATH: path.join(__dirname, '..', 'Testing', 'import-validation-report.json'),
  BATCH_SIZE: 100,
  BATCH_DELAY_MS: 1000,
  DATE_ADDED: '2025-10-29',
  ADDED_BY: 'WCP Import Script'
};

// Category code to name mapping
const CATEGORY_NAMES = {
  'FAST': 'Fasteners',
  'GEAR': 'Gears',
  'PULLEY': 'Pulleys',
  'BELT': 'Belts',
  'SPKT': 'Sprockets',
  'CHAIN': 'Chain',
  'BEAR': 'Bearings',
  'WIRE': 'Wiring',
  'SENSOR': 'Sensors',
  'CTRL': 'Control System',
  'ELEC': 'Electronics',
  'HDWR': 'Hardware',
  'STRUCT': 'Structural',
  'SHAFT': 'Shafts & Hubs'
};

/**
 * Initialize Google Sheets API client
 * @returns {Promise<sheets>} Authenticated Sheets API client
 */
async function initializeSheetsClient() {
  const credentials = JSON.parse(await fs.readFile(CONFIG.CREDENTIALS_PATH, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Generate Part ID with category code and sequential number
 * @param {string} categoryCode - Category code (e.g., FAST, GEAR)
 * @param {number} sequenceNumber - Sequential number within category
 * @returns {string} Part ID (e.g., FAST-001)
 */
function generatePartId(categoryCode, sequenceNumber) {
  const paddedNumber = String(sequenceNumber).padStart(3, '0');
  return `${categoryCode}-${paddedNumber}`;
}

/**
 * Extract specifications based on category
 * @param {Object} part - Part data from JSON
 * @returns {Array<string>} Array of 4 spec values
 */
function extractSpecs(part) {
  const specs = part.specifications || {};
  const category = part.classified_category_code;

  const spec1 = spec2 = spec3 = spec4 = '';

  switch (category) {
    case 'FAST': // Fasteners
      return [
        specs.thread_size || '',
        specs.length || '',
        specs.fastener_type || '',
        [specs.material, specs.surface_treatment].filter(Boolean).join(', ')
      ];

    case 'GEAR': // Gears
      return [
        specs.teeth ? String(specs.teeth) : '',
        specs.diametral_pitch || '',
        [specs.bore_type, specs.bore_size].filter(Boolean).join(' '),
        specs.material || ''
      ];

    case 'PULLEY': // Pulleys
      return [
        specs.belt_type || '',
        specs.teeth ? String(specs.teeth) : '',
        specs.width || '',
        specs.bore_type || ''
      ];

    case 'BELT': // Belts
      return [
        specs.belt_type || '',
        specs.teeth ? String(specs.teeth) : '',
        specs.width || '',
        ''
      ];

    case 'SPKT': // Sprockets
      return [
        specs.chain_size || '',
        specs.teeth ? String(specs.teeth) : '',
        specs.bore_type || '',
        specs.sprocket_type || ''
      ];

    case 'CHAIN': // Chain
      return [
        specs.chain_size || '',
        specs.component_type || '',
        '',
        ''
      ];

    default:
      // For other categories, leave specs blank for now
      return ['', '', '', ''];
  }
}

/**
 * Format pack quantity for display
 * @param {number} quantity - Numeric quantity
 * @returns {string} Formatted quantity (e.g., "50 Pack", "Each")
 */
function formatPackQuantity(quantity) {
  if (!quantity || quantity === 1) {
    return 'Each';
  }
  return `${quantity} Pack`;
}

/**
 * Format cost to 2 decimal places
 * @param {number} cost - Cost value
 * @returns {number} Formatted cost
 */
function formatCost(cost) {
  return cost ? Number(cost.toFixed(2)) : 0;
}

/**
 * Create notes field from WCP section data
 * @param {Object} part - Part data from JSON
 * @returns {string} Notes string
 */
function createNotes(part) {
  const notes = [];
  if (part.wcp_section) {
    notes.push(`WCP Section: ${part.wcp_section}`);
  }
  if (part.wcp_subsection) {
    notes.push(`Subsection: ${part.wcp_subsection}`);
  }
  return notes.join(' | ');
}

/**
 * Transform JSON part data to Google Sheets row format
 * @param {Object} part - Part data from JSON
 * @param {string} partId - Generated Part ID
 * @returns {Array} Row data array (18 columns)
 */
function transformPartToRow(part, partId) {
  const specs = extractSpecs(part);

  return [
    partId,                                          // A: Part ID
    part.cleaned_name || '',                         // B: Part Name
    CATEGORY_NAMES[part.classified_category_code] || part.classified_category_name, // C: Category
    part.wcp_subsection || '',                       // D: Subcategory
    part.product_code || '',                         // E: Product Code
    specs[0],                                        // F: Spec 1
    specs[1],                                        // G: Spec 2
    specs[2],                                        // H: Spec 3
    specs[3],                                        // I: Spec 4
    formatPackQuantity(part.pack_quantity),          // J: Quantity Per
    formatCost(part.unit_cost),                      // K: Cost
    part.supplier || 'WCP',                          // L: Supplier
    part.supplier_url || '',                         // M: Order Link
    '',                                              // N: Location/Bin (blank for now)
    createNotes(part),                               // O: Notes
    'Active',                                        // P: Status
    CONFIG.DATE_ADDED,                               // Q: Date Added
    CONFIG.ADDED_BY                                  // R: Added By
  ];
}

/**
 * Generate Part IDs for all parts grouped by category
 * @param {Array} parts - Array of part objects
 * @returns {Object} Map of part index to Part ID
 */
function generateAllPartIds(parts) {
  const partIdMap = {};
  const categoryCounters = {};

  // Sort parts by category to ensure sequential IDs within category
  const sortedParts = [...parts].sort((a, b) => {
    return a.classified_category_code.localeCompare(b.classified_category_code);
  });

  sortedParts.forEach((part, idx) => {
    const category = part.classified_category_code;

    // Initialize counter for this category
    if (!categoryCounters[category]) {
      categoryCounters[category] = 1;
    }

    // Generate Part ID
    const partId = generatePartId(category, categoryCounters[category]);

    // Find original index to maintain mapping
    const originalIndex = parts.findIndex(p =>
      p.product_code === part.product_code &&
      !Object.values(partIdMap).includes(p)
    );

    partIdMap[originalIndex] = partId;
    categoryCounters[category]++;
  });

  return { partIdMap, categoryCounters };
}

/**
 * Clear existing data from sheet (keep headers)
 * @param {sheets} sheets - Sheets API client
 */
async function clearSheetData(sheets) {
  console.log('Clearing existing data from sheet...');

  await sheets.spreadsheets.values.clear({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${CONFIG.SHEET_NAME}!A2:R`,
  });

  console.log('Sheet cleared successfully');
}

/**
 * Import data to Google Sheets in batches
 * @param {sheets} sheets - Sheets API client
 * @param {Array<Array>} rows - Row data to import
 * @returns {Promise<Object>} Import statistics
 */
async function importDataInBatches(sheets, rows) {
  const totalRows = rows.length;
  const batchCount = Math.ceil(totalRows / CONFIG.BATCH_SIZE);
  let importedCount = 0;
  const errors = [];

  console.log(`\nImporting ${totalRows} parts in ${batchCount} batches...`);
  console.log(`Batch size: ${CONFIG.BATCH_SIZE} rows`);
  console.log(`Delay between batches: ${CONFIG.BATCH_DELAY_MS}ms\n`);

  for (let i = 0; i < batchCount; i++) {
    const start = i * CONFIG.BATCH_SIZE;
    const end = Math.min(start + CONFIG.BATCH_SIZE, totalRows);
    const batchRows = rows.slice(start, end);

    try {
      console.log(`Batch ${i + 1}/${batchCount}: Importing rows ${start + 1}-${end}...`);

      await sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A2`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: batchRows
        }
      });

      importedCount += batchRows.length;
      console.log(`Batch ${i + 1} completed: ${batchRows.length} rows imported`);

      // Delay between batches to avoid rate limits
      if (i < batchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY_MS));
      }

    } catch (error) {
      console.error(`Error in batch ${i + 1}:`, error.message);
      errors.push({
        batch: i + 1,
        rows: `${start + 1}-${end}`,
        error: error.message
      });
    }
  }

  return { importedCount, errors };
}

/**
 * Validate imported data
 * @param {sheets} sheets - Sheets API client
 * @param {number} expectedCount - Expected number of parts
 * @param {Object} expectedCategoryCounts - Expected counts per category
 * @returns {Promise<Object>} Validation results
 */
async function validateImportedData(sheets, expectedCount, expectedCategoryCounts) {
  console.log('\nValidating imported data...');

  const validation = {
    part_count_correct: false,
    no_duplicate_ids: false,
    required_fields_complete: false,
    category_distribution_matches: false,
    spot_check_passed: false,
    issues: []
  };

  try {
    // Read all data from sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A2:R`,
    });

    const rows = response.data.values || [];

    // Check 1: Part count
    console.log(`Checking part count: ${rows.length} vs expected ${expectedCount}`);
    validation.part_count_correct = rows.length === expectedCount;
    if (!validation.part_count_correct) {
      validation.issues.push(`Part count mismatch: ${rows.length} vs ${expectedCount}`);
    }

    // Check 2: No duplicate Part IDs
    const partIds = rows.map(row => row[0]);
    const uniquePartIds = new Set(partIds);
    validation.no_duplicate_ids = partIds.length === uniquePartIds.size;
    if (!validation.no_duplicate_ids) {
      validation.issues.push(`Duplicate Part IDs found: ${partIds.length - uniquePartIds.size} duplicates`);
    }

    // Check 3: Required fields populated
    let missingFields = 0;
    rows.forEach((row, idx) => {
      // Check Part ID, Part Name, Category, Product Code
      if (!row[0] || !row[1] || !row[2] || !row[4]) {
        missingFields++;
      }
    });
    validation.required_fields_complete = missingFields === 0;
    if (!validation.required_fields_complete) {
      validation.issues.push(`${missingFields} rows have missing required fields`);
    }

    // Check 4: Category distribution
    const actualCategoryCounts = {};
    rows.forEach(row => {
      const partId = row[0];
      const categoryCode = partId.split('-')[0];
      actualCategoryCounts[categoryCode] = (actualCategoryCounts[categoryCode] || 0) + 1;
    });

    let categoryMismatch = false;
    Object.keys(expectedCategoryCounts).forEach(cat => {
      if (actualCategoryCounts[cat] !== expectedCategoryCounts[cat]) {
        categoryMismatch = true;
        validation.issues.push(`Category ${cat}: expected ${expectedCategoryCounts[cat]}, got ${actualCategoryCounts[cat] || 0}`);
      }
    });
    validation.category_distribution_matches = !categoryMismatch;

    // Check 5: Spot check - sample 10 random parts
    console.log('Performing spot check on 10 random parts...');
    const spotCheckIndexes = [];
    for (let i = 0; i < 10; i++) {
      spotCheckIndexes.push(Math.floor(Math.random() * rows.length));
    }

    let spotCheckFailures = 0;
    spotCheckIndexes.forEach(idx => {
      const row = rows[idx];
      // Check basic structure: Part ID format, non-empty name, valid cost
      if (!row[0].match(/^[A-Z]+-\d{3}$/)) spotCheckFailures++;
      if (!row[1] || row[1].length < 3) spotCheckFailures++;
      if (row[10] && (isNaN(row[10]) || row[10] < 0)) spotCheckFailures++;
    });

    validation.spot_check_passed = spotCheckFailures === 0;
    if (!validation.spot_check_passed) {
      validation.issues.push(`Spot check failed: ${spotCheckFailures} validation errors`);
    }

    console.log('Validation completed');

  } catch (error) {
    console.error('Validation error:', error.message);
    validation.issues.push(`Validation error: ${error.message}`);
  }

  return validation;
}

/**
 * Generate validation report
 * @param {Object} stats - Import statistics
 * @param {Object} validation - Validation results
 * @param {Object} categoryCounters - Category counters
 * @param {number} processingTimeSeconds - Total processing time
 */
async function generateValidationReport(stats, validation, categoryCounters, processingTimeSeconds) {
  console.log('\nGenerating validation report...');

  // Generate Part ID ranges
  const partIdRanges = {};
  Object.keys(categoryCounters).sort().forEach(cat => {
    const count = categoryCounters[cat] - 1; // Subtract 1 because counter is incremented
    partIdRanges[cat] = `${cat}-001 to ${cat}-${String(count).padStart(3, '0')}`;
  });

  const report = {
    import_summary: {
      total_parts_imported: stats.importedCount,
      import_date: CONFIG.DATE_ADDED,
      spreadsheet_id: CONFIG.SPREADSHEET_ID,
      sheet_name: CONFIG.SHEET_NAME,
      processing_time_seconds: processingTimeSeconds,
      batch_count: Math.ceil(stats.importedCount / CONFIG.BATCH_SIZE),
      errors: stats.errors.length
    },
    validation_results: validation,
    category_breakdown: Object.keys(categoryCounters)
      .sort()
      .reduce((acc, cat) => {
        acc[cat] = categoryCounters[cat] - 1;
        return acc;
      }, {}),
    part_id_ranges: partIdRanges,
    issues_found: validation.issues,
    batch_errors: stats.errors,
    recommendations: [
      'Location/Bin field needs manual population',
      'Categories BEAR, WIRE, STRUCT, SHAFT need spec extraction enhancement',
      'Consider adding images/photos for parts',
      'Verify all supplier URLs are accessible'
    ]
  };

  await fs.writeFile(
    CONFIG.VALIDATION_REPORT_PATH,
    JSON.stringify(report, null, 2)
  );

  console.log(`Validation report saved to: ${CONFIG.VALIDATION_REPORT_PATH}`);

  return report;
}

/**
 * Main import process
 */
async function main() {
  const startTime = Date.now();

  console.log('========================================');
  console.log('WCP Parts Import to Google Sheets');
  console.log('========================================\n');

  try {
    // Load data files
    console.log('Loading data files...');
    const correctedData = JSON.parse(
      await fs.readFile(CONFIG.CORRECTED_JSON_PATH, 'utf8')
    );

    const parts = correctedData.parts;
    console.log(`Loaded ${parts.length} parts from JSON`);

    // Initialize Google Sheets client
    console.log('\nInitializing Google Sheets API...');
    const sheets = await initializeSheetsClient();
    console.log('Google Sheets API initialized');

    // Generate Part IDs for all parts
    console.log('\nGenerating Part IDs...');
    const { partIdMap, categoryCounters } = generateAllPartIds(parts);
    console.log('Part IDs generated for all categories:');
    Object.keys(categoryCounters).sort().forEach(cat => {
      console.log(`  ${cat}: ${categoryCounters[cat] - 1} parts`);
    });

    // Sort parts by category first
    console.log('\nSorting parts by category...');
    const sortedParts = [...parts].sort((a, b) =>
      a.classified_category_code.localeCompare(b.classified_category_code)
    );

    // Transform parts to rows with sequential Part IDs
    console.log('Transforming parts to sheet rows...');
    const categoryCountersForRows = {};
    const rows = sortedParts.map((part) => {
      const category = part.classified_category_code;

      // Initialize or increment counter for this category
      if (!categoryCountersForRows[category]) {
        categoryCountersForRows[category] = 1;
      }

      const partId = generatePartId(category, categoryCountersForRows[category]);
      categoryCountersForRows[category]++;

      return transformPartToRow(part, partId);
    });
    console.log(`Transformed ${rows.length} parts to rows`);

    // Clear existing data
    await clearSheetData(sheets);

    // Import data in batches
    const importStats = await importDataInBatches(sheets, rows);

    // Validate imported data
    const validation = await validateImportedData(
      sheets,
      parts.length,
      Object.keys(categoryCounters).reduce((acc, cat) => {
        acc[cat] = categoryCounters[cat] - 1;
        return acc;
      }, {})
    );

    // Calculate processing time
    const processingTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    // Generate validation report
    const report = await generateValidationReport(
      importStats,
      validation,
      categoryCounters,
      processingTimeSeconds
    );

    // Display summary
    console.log('\n========================================');
    console.log('IMPORT COMPLETE');
    console.log('========================================');
    console.log(`Total parts imported: ${importStats.importedCount}`);
    console.log(`Processing time: ${processingTimeSeconds}s`);
    console.log(`Batch errors: ${importStats.errors.length}`);
    console.log('\nValidation Results:');
    console.log(`  Part count correct: ${validation.part_count_correct ? 'PASS' : 'FAIL'}`);
    console.log(`  No duplicate IDs: ${validation.no_duplicate_ids ? 'PASS' : 'FAIL'}`);
    console.log(`  Required fields complete: ${validation.required_fields_complete ? 'PASS' : 'FAIL'}`);
    console.log(`  Category distribution matches: ${validation.category_distribution_matches ? 'PASS' : 'FAIL'}`);
    console.log(`  Spot check passed: ${validation.spot_check_passed ? 'PASS' : 'FAIL'}`);

    if (validation.issues.length > 0) {
      console.log('\nIssues Found:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    console.log('\nCategory Breakdown:');
    Object.keys(report.category_breakdown).sort().forEach(cat => {
      console.log(`  ${cat}: ${report.category_breakdown[cat]} parts (${report.part_id_ranges[cat]})`);
    });

    console.log(`\nValidation report: ${CONFIG.VALIDATION_REPORT_PATH}`);
    console.log(`\nSpreadsheet URL: https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`);
    console.log('========================================\n');

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
if (require.main === module) {
  main();
}

module.exports = { main };
