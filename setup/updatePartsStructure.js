#!/usr/bin/env node

/**
 * Phase 1: Update Parts Directory Structure
 *
 * This script updates the Google Sheets structure from 18 columns to 20 columns:
 * - Inserts "Type" column at position E (index 4)
 * - Adds "Spec 5" column at position K (index 10)
 * - Shifts all subsequent columns by 2 positions
 *
 * Old Structure (18 cols): A-R
 * New Structure (20 cols): A-T
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const SPEC_CONFIG_CSV = path.join(__dirname, '..', 'Testing', 'Spreadsheets', 'spec_config_import.csv');

// Column headers for new structure (20 columns)
const NEW_HEADERS = [
  'Part ID',           // A (0)
  'Part Name',         // B (1)
  'Category',          // C (2)
  'Subcategory',       // D (3)
  'Type',              // E (4) - NEW
  'Product Code',      // F (5) - shifted from E
  'Spec 1',            // G (6) - shifted from F
  'Spec 2',            // H (7) - shifted from G
  'Spec 3',            // I (8) - shifted from H
  'Spec 4',            // J (9) - shifted from I
  'Spec 5',            // K (10) - NEW
  'Quantity Per',      // L (11) - shifted from J
  'Cost',              // M (12) - shifted from K
  'Supplier',          // N (13) - shifted from L
  'Order Link',        // O (14) - shifted from M
  'Location/Bin',      // P (15) - shifted from N
  'Notes',             // Q (16) - shifted from O
  'Status',            // R (17) - shifted from P
  'Date Added',        // S (18) - shifted from Q
  'Added By'           // T (19) - shifted from R
];

// Spec Config headers
const SPEC_CONFIG_HEADERS = [
  'Category Code',
  'Category Name',
  'Subcategory Name',
  'Type',
  'Spec 1 Label',
  'Spec 2 Label',
  'Spec 3 Label',
  'Spec 4 Label',
  'Spec 5 Label'
];

/**
 * Authorize with Google Sheets API
 */
async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return auth.getClient();
}

/**
 * Read CSV file and parse into array of arrays
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');

  return lines.map(line => {
    // Simple CSV parsing - handles quoted fields with commas
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  });
}

/**
 * Transform a single row from old structure (18 cols) to new structure (20 cols)
 */
function transformRow(oldRow) {
  // Pad with empty strings if row is shorter than 18 columns
  while (oldRow.length < 18) {
    oldRow.push('');
  }

  const newRow = [
    oldRow[0],  // A: Part ID
    oldRow[1],  // B: Part Name
    oldRow[2],  // C: Category
    oldRow[3],  // D: Subcategory
    '',         // E: Type (NEW - empty)
    oldRow[4],  // F: Product Code (was E)
    oldRow[5],  // G: Spec 1 (was F)
    oldRow[6],  // H: Spec 2 (was G)
    oldRow[7],  // I: Spec 3 (was H)
    oldRow[8],  // J: Spec 4 (was I)
    '',         // K: Spec 5 (NEW - empty)
    oldRow[9],  // L: Quantity Per (was J)
    oldRow[10], // M: Cost (was K)
    oldRow[11], // N: Supplier (was L)
    oldRow[12], // O: Order Link (was M)
    oldRow[13], // P: Location/Bin (was N)
    oldRow[14], // Q: Notes (was O)
    oldRow[15], // R: Status (was P)
    oldRow[16], // S: Date Added (was Q)
    oldRow[17]  // T: Added By (was R)
  ];

  return newRow;
}

/**
 * Main execution function
 */
async function main() {
  console.log('=== Phase 1: Update Parts Directory Structure ===\n');

  try {
    // Step 1: Authorize
    console.log('[1/6] Authorizing with Google Sheets API...');
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Step 2: Read existing Parts data
    console.log('[2/6] Reading existing Parts data...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parts!A:R'
    });

    const rows = response.data.values || [];
    const headerRow = rows[0] || [];
    const dataRows = rows.slice(1);

    console.log(`   Found ${dataRows.length} parts in existing sheet`);
    console.log(`   Current structure: ${headerRow.length} columns`);

    // Validation check
    if (headerRow.length !== 18) {
      console.warn(`   WARNING: Expected 18 columns but found ${headerRow.length}`);
      console.log(`   Current headers: ${headerRow.join(', ')}`);
    }

    // Step 3: Create backup sample
    console.log('[3/6] Creating backup sample...');
    const sampleBefore = dataRows.slice(0, 3);
    console.log('\n   Sample rows BEFORE transformation:');
    sampleBefore.forEach((row, idx) => {
      console.log(`   Row ${idx + 2}: [${row.length} cols] ${row.slice(0, 5).join(' | ')}...`);
    });

    // Step 4: Transform data
    console.log('\n[4/6] Transforming data structure...');
    const transformedData = [NEW_HEADERS];

    for (const row of dataRows) {
      transformedData.push(transformRow(row));
    }

    console.log(`   Transformed ${dataRows.length} data rows`);
    console.log(`   New structure: ${NEW_HEADERS.length} columns`);

    const sampleAfter = transformedData.slice(1, 4);
    console.log('\n   Sample rows AFTER transformation:');
    sampleAfter.forEach((row, idx) => {
      console.log(`   Row ${idx + 2}: [${row.length} cols] ${row.slice(0, 6).join(' | ')}...`);
    });

    // Step 5: Update Parts sheet
    console.log('\n[5/6] Writing transformed data to Parts sheet...');

    // Clear existing data first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parts!A:Z'
    });

    // Write new data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parts!A1',
      valueInputOption: 'RAW',
      resource: {
        values: transformedData
      }
    });

    console.log(`   Successfully wrote ${transformedData.length} rows (including header)`);

    // Step 6: Update Spec Config sheet
    console.log('[6/6] Updating Spec Config sheet...');

    const specConfigData = readCSV(SPEC_CONFIG_CSV);
    console.log(`   Read ${specConfigData.length} rows from CSV (including header)`);

    // Clear existing Spec Config
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Spec Config!A:Z'
    });

    // Write new Spec Config
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Spec Config!A1',
      valueInputOption: 'RAW',
      resource: {
        values: specConfigData
      }
    });

    console.log(`   Successfully wrote ${specConfigData.length} rows to Spec Config`);

    // Validation
    console.log('\n=== VALIDATION REPORT ===');
    console.log(`Total parts BEFORE: ${dataRows.length}`);
    console.log(`Total parts AFTER: ${transformedData.length - 1}`);
    console.log(`Parts preserved: ${dataRows.length === transformedData.length - 1 ? 'YES' : 'NO'}`);
    console.log(`Spec Config rows: ${specConfigData.length - 1} (excluding header)`);
    console.log(`Expected Spec Config rows: 90`);
    console.log(`Spec Config complete: ${specConfigData.length - 1 === 90 ? 'YES' : 'NO'}`);

    console.log('\n=== SAMPLE COMPARISON ===');
    console.log('\nBEFORE (18 columns):');
    if (sampleBefore.length > 0) {
      const sample = sampleBefore[0];
      console.log(`  Part ID: ${sample[0]}`);
      console.log(`  Part Name: ${sample[1]}`);
      console.log(`  Category: ${sample[2]}`);
      console.log(`  Subcategory: ${sample[3]}`);
      console.log(`  Product Code: ${sample[4]}`);
      console.log(`  Specs 1-4: ${sample[5]}, ${sample[6]}, ${sample[7]}, ${sample[8]}`);
    }

    console.log('\nAFTER (20 columns):');
    if (sampleAfter.length > 0) {
      const sample = sampleAfter[0];
      console.log(`  Part ID: ${sample[0]}`);
      console.log(`  Part Name: ${sample[1]}`);
      console.log(`  Category: ${sample[2]}`);
      console.log(`  Subcategory: ${sample[3]}`);
      console.log(`  Type: ${sample[4]} (NEW - empty)`);
      console.log(`  Product Code: ${sample[5]} (shifted from col E)`);
      console.log(`  Specs 1-5: ${sample[6]}, ${sample[7]}, ${sample[8]}, ${sample[9]}, ${sample[10]} (Spec 5 NEW)`);
    }

    console.log('\n=== Phase 1 Complete ===');
    console.log('Status: SUCCESS');
    console.log('Ready for: Phase 2 - Populate Type and Spec 5 columns');

  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error('Phase 1 FAILED:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { transformRow, NEW_HEADERS };
