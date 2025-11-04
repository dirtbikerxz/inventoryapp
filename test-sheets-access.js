/**
 * Test script to verify Google Sheets API access
 */

const { google } = require('googleapis');
const path = require('path');

// Spreadsheet IDs from your Code.js
const PARTS_DIRECTORY_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const PARTS_ORDERS_ID = '1f-4T0wMjLQKnA-dbFMgUDRKnSuwi0kjdSl91MuRHpeQ';

async function testSheetsAccess() {
  try {
    console.log('Testing Google Sheets API access...\n');

    // Load credentials
    const credentialsPath = path.join(__dirname, 'credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Test 1: Read Parts Directory metadata
    console.log('Test 1: Reading Parts Directory metadata...');
    const partsDir = await sheets.spreadsheets.get({
      spreadsheetId: PARTS_DIRECTORY_ID
    });
    console.log(`✓ Successfully accessed: ${partsDir.data.properties.title}`);
    console.log(`  Sheets: ${partsDir.data.sheets.map(s => s.properties.title).join(', ')}\n`);

    // Test 2: Read Parts Orders metadata
    console.log('Test 2: Reading Parts Orders metadata...');
    const partsOrders = await sheets.spreadsheets.get({
      spreadsheetId: PARTS_ORDERS_ID
    });
    console.log(`✓ Successfully accessed: ${partsOrders.data.properties.title}`);
    console.log(`  Sheets: ${partsOrders.data.sheets.map(s => s.properties.title).join(', ')}\n`);

    // Test 3: Read sample data from Parts sheet
    console.log('Test 3: Reading sample data from Parts sheet...');
    const partsData = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A1:E5'  // First 5 rows, first 5 columns
    });
    console.log(`✓ Retrieved ${partsData.data.values ? partsData.data.values.length : 0} rows`);
    if (partsData.data.values && partsData.data.values.length > 0) {
      console.log('  Headers:', partsData.data.values[0].slice(0, 5));
      console.log(`  Data rows: ${partsData.data.values.length - 1}\n`);
    }

    // Test 4: Count total parts
    console.log('Test 4: Counting total parts...');
    const allParts = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A:A'
    });
    const totalParts = allParts.data.values ? allParts.data.values.length - 1 : 0;
    console.log(`✓ Total parts in directory: ${totalParts}\n`);

    // Test 5: Count total orders
    console.log('Test 5: Counting total orders...');
    const allOrders = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_ORDERS_ID,
      range: 'Orders!A:A'
    });
    const totalOrders = allOrders.data.values ? allOrders.data.values.length - 1 : 0;
    console.log(`✓ Total orders: ${totalOrders}\n`);

    console.log('========================================');
    console.log('ALL TESTS PASSED!');
    console.log('Claude Code has full read access to your Google Sheets!');
    console.log('========================================');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === 403) {
      console.error('\nAccess denied. The service account may need to be granted access to these sheets.');
      console.error('Share the sheets with: dvom-sheets-service@mineral-brand-476416-g8.iam.gserviceaccount.com');
    }
    process.exit(1);
  }
}

testSheetsAccess();
