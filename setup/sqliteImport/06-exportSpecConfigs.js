/**
 * Step 6: Export Spec Configs from SQLite to Google Sheets
 *
 * Exports the 96 spec configurations from parts.db to the "Spec Config" sheet
 * in Google Sheets. These configurations define the metadata structure for
 * different part types across categories.
 */

const sqlite3 = require('sqlite3').verbose();
const { google } = require('googleapis');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, '../../parts.db');
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');
const SHEET_NAME = 'Spec Config';
const CLEAR_RANGE = 'Spec Config!A2:I';
const UPDATE_RANGE = 'Spec Config!A2:I';

/**
 * Read all spec configurations from SQLite database
 */
function readSpecConfigs() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);

    const query = `
      SELECT
        category_code,
        category_name,
        subcategory,
        type,
        spec1_label,
        spec2_label,
        spec3_label,
        spec4_label,
        spec5_label
      FROM spec_configs
      ORDER BY category_code, subcategory, type
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(`Retrieved ${rows.length} spec configurations from database`);
      resolve(rows);
      db.close();
    });
  });
}

/**
 * Format spec configs for Google Sheets
 */
function formatForSheets(specConfigs) {
  return specConfigs.map(config => [
    config.category_code || '',
    config.category_name || '',
    config.subcategory || '',
    config.type || '',
    config.spec1_label || '',
    config.spec2_label || '',
    config.spec3_label || '',
    config.spec4_label || '',
    config.spec5_label || ''
  ]);
}

/**
 * Authenticate with Google Sheets API
 */
async function authenticate() {
  const credentials = require(CREDENTIALS_PATH);
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return await auth.getClient();
}

/**
 * Clear existing spec configs from sheet (preserve header)
 */
async function clearSheet(sheets) {
  console.log(`Clearing existing data from ${CLEAR_RANGE}...`);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: CLEAR_RANGE
  });

  console.log('Existing data cleared');
}

/**
 * Upload spec configs to Google Sheets
 */
async function uploadToSheets(sheets, values) {
  console.log(`Uploading ${values.length} spec configurations to Google Sheets...`);

  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: UPDATE_RANGE,
    valueInputOption: 'RAW',
    resource: {
      values: values
    }
  };

  const response = await sheets.spreadsheets.values.update(request);
  console.log(`Updated ${response.data.updatedRows} rows, ${response.data.updatedColumns} columns`);

  return response.data;
}

/**
 * Verify the upload
 */
async function verifyUpload(sheets) {
  console.log('\nVerifying upload...');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: UPDATE_RANGE
  });

  const rows = response.data.values || [];
  console.log(`Verified ${rows.length} rows in Google Sheets`);

  // Show sample data
  console.log('\nSample configurations:');
  rows.slice(0, 5).forEach((row, idx) => {
    console.log(`${idx + 1}. ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]}`);
  });

  return rows.length;
}

/**
 * Generate summary statistics
 */
function generateSummary(specConfigs, uploadResult) {
  console.log('\n' + '='.repeat(80));
  console.log('SPEC CONFIG EXPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Database Configs:     ${specConfigs.length}`);
  console.log(`Uploaded Rows:        ${uploadResult.updatedRows}`);
  console.log(`Updated Columns:      ${uploadResult.updatedColumns}`);
  console.log(`Updated Cells:        ${uploadResult.updatedCells}`);

  // Count by category
  const byCategory = {};
  specConfigs.forEach(config => {
    const cat = config.category_code;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  console.log('\nConfigurations by Category:');
  Object.keys(byCategory).sort().forEach(cat => {
    console.log(`  ${cat}: ${byCategory[cat]}`);
  });

  console.log('='.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Starting Spec Config Export Process...\n');

    // Step 1: Read from database
    const specConfigs = await readSpecConfigs();

    // Step 2: Format for sheets
    const values = formatForSheets(specConfigs);

    // Step 3: Authenticate
    const authClient = await authenticate();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Step 4: Clear existing data
    await clearSheet(sheets);

    // Step 5: Upload new data
    const uploadResult = await uploadToSheets(sheets, values);

    // Step 6: Verify
    const verifiedCount = await verifyUpload(sheets);

    // Step 7: Summary
    generateSummary(specConfigs, uploadResult);

    console.log('\nSpec Config export completed successfully!');

    if (verifiedCount !== specConfigs.length) {
      console.warn(`\nWARNING: Verified count (${verifiedCount}) doesn't match database count (${specConfigs.length})`);
    }

  } catch (error) {
    console.error('Error during export:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
