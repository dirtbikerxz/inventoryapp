/**
 * Import FRC categories to Google Sheets in alphabetical order
 * Reads frc_new_categories.csv and imports to the Categories sheet
 * with automatic sort ordering
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { parse } = require('csv-parse/sync');

// Configuration
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const SHEET_NAME = 'Categories';
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const CSV_PATH = path.join(__dirname, '../Testing/Spreadsheets/frc_new_categories.csv');
const LOG_PATH = path.join(__dirname, 'categories-import-log.json');

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
 * Read and parse CSV file
 */
function readCategoriesCSV() {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records;
}

/**
 * Sort categories alphabetically by Category name
 */
function sortCategoriesAlphabetically(categories) {
  return categories.sort((a, b) => {
    const nameA = a.Category.toUpperCase();
    const nameB = b.Category.toUpperCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Add sort order to categories
 */
function addSortOrder(categories) {
  return categories.map((category, index) => ({
    ...category,
    SortOrder: index + 1
  }));
}

/**
 * Clear existing data and import categories to Google Sheets
 */
async function importToGoogleSheets(auth, categories) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Prepare data for import
  const headers = ['Category Name', 'Code', 'Description', 'Sort Order'];
  const values = [
    headers,
    ...categories.map(cat => [
      cat.Category,
      cat.Code,
      cat.Description,
      cat.SortOrder
    ])
  ];

  try {
    // Clear existing data (keeping header row)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:Z`,
    });

    console.log('Cleared existing category data');

    // Update with new data
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: values
      }
    });

    console.log(`Imported ${categories.length} categories to Google Sheets`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to import to Google Sheets: ${error.message}`);
  }
}

/**
 * Generate import log
 */
function generateLog(categories, success, error = null) {
  const rowMappings = {};
  categories.forEach((cat, index) => {
    rowMappings[cat.Code] = index + 2; // +2 because row 1 is header
  });

  const log = {
    timestamp: new Date().toISOString(),
    totalCategories: categories.length,
    success: success,
    error: error,
    rowMappings: rowMappings,
    categories: categories.map(cat => ({
      name: cat.Category,
      code: cat.Code,
      sortOrder: cat.SortOrder
    }))
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`Import log written to ${LOG_PATH}`);

  return log;
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting category import process...');
  console.log(`Reading CSV from: ${CSV_PATH}`);

  try {
    // Read categories from CSV
    const categories = readCategoriesCSV();
    console.log(`Read ${categories.length} categories from CSV`);

    // Sort alphabetically
    const sortedCategories = sortCategoriesAlphabetically(categories);
    console.log('Sorted categories alphabetically');

    // Add sort order
    const categoriesWithOrder = addSortOrder(sortedCategories);
    console.log('Added sort order (1-29)');

    // Display sorted list
    console.log('\nCategories in alphabetical order:');
    categoriesWithOrder.forEach(cat => {
      console.log(`  ${cat.SortOrder}. ${cat.Category} (${cat.Code})`);
    });

    // Authenticate and import
    console.log('\nAuthenticating with Google Sheets API...');
    const auth = await authenticate();
    console.log('Authentication successful');

    console.log(`Importing to spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`Sheet name: ${SHEET_NAME}`);

    await importToGoogleSheets(auth, categoriesWithOrder);

    // Generate log
    const log = generateLog(categoriesWithOrder, true);

    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total categories imported: ${log.totalCategories}`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`Sheet name: ${SHEET_NAME}`);
    console.log(`Log file: ${LOG_PATH}`);

  } catch (error) {
    console.error('\n=== IMPORT FAILED ===');
    console.error(`Error: ${error.message}`);

    // Generate error log
    generateLog([], false, error.message);

    process.exit(1);
  }
}

// Run the script
main();
