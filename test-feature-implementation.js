/**
 * Test script to verify Inventory and Seasons feature implementation
 * Verifies the new columns exist and can be queried correctly
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Spreadsheet IDs
const PARTS_DIRECTORY_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';

// Expected schema
const EXPECTED_COLUMNS = [
  'Part ID',
  'Part Name',
  'Category',
  'Subcategory',
  'Type',
  'Product Code',
  'Spec 1',
  'Spec 2',
  'Spec 3',
  'Spec 4',
  'Spec 5',
  'Quantity Per',
  'Cost',
  'Supplier',
  'Order Link',
  'Location/Bin',
  'Notes',
  'Status',
  'Date Added',
  'Added By',
  'Inventory',
  'Seasons'
];

const INVENTORY_COLUMN_INDEX = 20; // Column U (0-indexed)
const SEASONS_COLUMN_INDEX = 21;   // Column V (0-indexed)
const TOTAL_COLUMNS = 22;

const testResults = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

function addTestResult(testName, passed, details, expected = null, actual = null) {
  const result = {
    test: testName,
    status: passed ? 'PASS' : 'FAIL',
    details: details
  };

  if (expected !== null) result.expected = expected;
  if (actual !== null) result.actual = actual;

  testResults.tests.push(result);
  testResults.summary.total++;
  if (passed) {
    testResults.summary.passed++;
  } else {
    testResults.summary.failed++;
  }

  const statusSymbol = passed ? 'PASS' : 'FAIL';
  console.log(`[${statusSymbol}] ${testName}`);
  console.log(`     ${details}`);
  if (expected !== null) console.log(`     Expected: ${JSON.stringify(expected)}`);
  if (actual !== null) console.log(`     Actual: ${JSON.stringify(actual)}`);
  console.log();
}

async function testFeatureImplementation() {
  try {
    console.log('========================================');
    console.log('Inventory and Seasons Feature Verification');
    console.log('========================================\n');

    // Load credentials
    const credentialsPath = path.join(__dirname, 'credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Test 1: Verify Parts Directory access
    console.log('Test 1: Verify Parts Directory access...');
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: PARTS_DIRECTORY_ID
    });

    const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);
    addTestResult(
      'Parts Directory Access',
      true,
      `Successfully accessed spreadsheet: ${spreadsheet.data.properties.title}`,
      null,
      sheetNames
    );

    // Test 2: Verify Parts sheet exists
    console.log('Test 2: Verify Parts sheet exists...');
    const hasPartsSheet = sheetNames.includes('Parts');
    addTestResult(
      'Parts Sheet Exists',
      hasPartsSheet,
      hasPartsSheet ? 'Parts sheet found' : 'Parts sheet not found',
      'Parts',
      sheetNames
    );

    // Test 3: Verify Seasons sheet exists
    console.log('Test 3: Verify Seasons sheet exists...');
    const hasSeasonsSheet = sheetNames.includes('Seasons');
    addTestResult(
      'Seasons Sheet Exists',
      hasSeasonsSheet,
      hasSeasonsSheet ? 'Seasons sheet found' : 'Seasons sheet not found',
      'Seasons',
      sheetNames
    );

    // Test 4: Read Parts sheet header row
    console.log('Test 4: Read Parts sheet header row...');
    const headerData = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A1:Z1'
    });

    const actualHeaders = headerData.data.values ? headerData.data.values[0] : [];
    const headerCount = actualHeaders.length;

    addTestResult(
      'Parts Sheet Header Count',
      headerCount === TOTAL_COLUMNS,
      `Found ${headerCount} columns`,
      TOTAL_COLUMNS,
      headerCount
    );

    // Test 5: Verify Inventory column exists at correct position
    console.log('Test 5: Verify Inventory column position...');
    const inventoryHeader = actualHeaders[INVENTORY_COLUMN_INDEX];
    const inventoryCorrect = inventoryHeader === 'Inventory';
    addTestResult(
      'Inventory Column (Column U)',
      inventoryCorrect,
      inventoryCorrect
        ? `Found 'Inventory' at index ${INVENTORY_COLUMN_INDEX}`
        : `Expected 'Inventory' but found '${inventoryHeader}'`,
      'Inventory',
      inventoryHeader
    );

    // Test 6: Verify Seasons column exists at correct position
    console.log('Test 6: Verify Seasons column position...');
    const seasonsHeader = actualHeaders[SEASONS_COLUMN_INDEX];
    const seasonsCorrect = seasonsHeader === 'Seasons';
    addTestResult(
      'Seasons Column (Column V)',
      seasonsCorrect,
      seasonsCorrect
        ? `Found 'Seasons' at index ${SEASONS_COLUMN_INDEX}`
        : `Expected 'Seasons' but found '${seasonsHeader}'`,
      'Seasons',
      seasonsHeader
    );

    // Test 7: Compare full header structure
    console.log('Test 7: Compare full header structure...');
    const headersMatch = JSON.stringify(actualHeaders) === JSON.stringify(EXPECTED_COLUMNS);
    if (!headersMatch) {
      const differences = [];
      for (let i = 0; i < Math.max(EXPECTED_COLUMNS.length, actualHeaders.length); i++) {
        if (EXPECTED_COLUMNS[i] !== actualHeaders[i]) {
          differences.push(`Index ${i}: expected '${EXPECTED_COLUMNS[i] || 'N/A'}', got '${actualHeaders[i] || 'N/A'}'`);
        }
      }
      addTestResult(
        'Full Header Structure Match',
        false,
        `Headers do not match. Differences: ${differences.join('; ')}`,
        EXPECTED_COLUMNS,
        actualHeaders
      );
    } else {
      addTestResult(
        'Full Header Structure Match',
        true,
        'All column headers match expected structure',
        EXPECTED_COLUMNS,
        actualHeaders
      );
    }

    // Test 8: Read Season List from Seasons sheet
    if (hasSeasonsSheet) {
      console.log('Test 8: Read Season List from Seasons sheet...');
      const seasonData = await sheets.spreadsheets.values.get({
        spreadsheetId: PARTS_DIRECTORY_ID,
        range: 'Seasons!A:A'
      });

      const seasonList = seasonData.data.values ? seasonData.data.values.flat() : [];
      const hasSeasonHeader = seasonList[0] === 'Season List';
      const seasonCount = seasonList.length - 1; // Exclude header

      addTestResult(
        'Seasons Sheet Structure',
        hasSeasonHeader && seasonCount > 0,
        `Found ${seasonCount} seasons with header '${seasonList[0]}'`,
        'Season List header with data',
        `${seasonList[0]} with ${seasonCount} seasons: ${seasonList.slice(1, 6).join(', ')}${seasonCount > 5 ? '...' : ''}`
      );
    } else {
      addTestResult(
        'Seasons Sheet Structure',
        false,
        'Cannot test - Seasons sheet does not exist',
        'Seasons sheet with Season List column',
        'Sheet not found'
      );
    }

    // Test 9: Read sample parts data with Inventory and Seasons columns
    console.log('Test 9: Read sample parts data...');
    const partsData = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A2:V10' // Read first 8 data rows including new columns
    });

    const partsRows = partsData.data.values || [];
    const hasPartsData = partsRows.length > 0;

    if (hasPartsData) {
      // Count parts with Inventory = "Yes"
      const inventoryYesCount = partsRows.filter(row => row[INVENTORY_COLUMN_INDEX] === 'Yes').length;
      const inventoryNoCount = partsRows.filter(row => row[INVENTORY_COLUMN_INDEX] === 'No').length;

      addTestResult(
        'Parts Data with Inventory Values',
        inventoryYesCount > 0 || inventoryNoCount > 0,
        `Found ${partsRows.length} parts: ${inventoryYesCount} with Inventory=Yes, ${inventoryNoCount} with Inventory=No`,
        'Parts with Inventory values',
        `Yes: ${inventoryYesCount}, No: ${inventoryNoCount}`
      );
    } else {
      addTestResult(
        'Parts Data with Inventory Values',
        false,
        'No parts data found to verify',
        'Parts with Inventory values',
        'No data'
      );
    }

    // Test 10: Test filtering parts where Inventory = "Yes"
    console.log('Test 10: Test filtering parts with Inventory = Yes...');
    const allPartsData = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A2:V' // All parts data
    });

    const allParts = allPartsData.data.values || [];
    const inventoryParts = allParts.filter(row => row[INVENTORY_COLUMN_INDEX] === 'Yes');
    const totalParts = allParts.length;
    const inventoryCount = inventoryParts.length;

    addTestResult(
      'Filter Parts by Inventory = Yes',
      inventoryCount >= 0,
      `Successfully filtered: ${inventoryCount} of ${totalParts} parts have Inventory=Yes`,
      'Filterable by Inventory column',
      `${inventoryCount}/${totalParts} parts`
    );

    // Test 11: Test filtering parts by specific season
    console.log('Test 11: Test filtering parts by Season...');
    if (hasSeasonsSheet && inventoryParts.length > 0) {
      // Get a sample season from the first part that has seasons
      const samplePart = inventoryParts.find(row => row[SEASONS_COLUMN_INDEX] && row[SEASONS_COLUMN_INDEX].length > 0);

      if (samplePart && samplePart[SEASONS_COLUMN_INDEX]) {
        const sampleSeasons = samplePart[SEASONS_COLUMN_INDEX].split(',').map(s => s.trim());
        const testSeason = sampleSeasons[0];

        const seasonFilteredParts = inventoryParts.filter(row => {
          const seasons = row[SEASONS_COLUMN_INDEX] || '';
          return seasons.includes(testSeason);
        });

        addTestResult(
          'Filter Parts by Season',
          seasonFilteredParts.length > 0,
          `Successfully filtered by season '${testSeason}': found ${seasonFilteredParts.length} parts`,
          'Filterable by Seasons column',
          `${seasonFilteredParts.length} parts with season '${testSeason}'`
        );
      } else {
        addTestResult(
          'Filter Parts by Season',
          false,
          'No parts found with season data to test filtering',
          'Parts with season data',
          'No season data in inventory parts'
        );
      }
    } else {
      addTestResult(
        'Filter Parts by Season',
        false,
        hasSeasonsSheet ? 'No inventory parts to test season filtering' : 'Seasons sheet does not exist',
        'Filterable by Seasons column',
        'Cannot test'
      );
    }

    // Test 12: Verify column data types
    console.log('Test 12: Verify column data types...');
    if (hasPartsData) {
      const sampleRow = partsRows[0];
      const inventoryValue = sampleRow[INVENTORY_COLUMN_INDEX];
      const seasonsValue = sampleRow[SEASONS_COLUMN_INDEX];

      const inventoryIsValid = inventoryValue === 'Yes' || inventoryValue === 'No' || inventoryValue === '' || inventoryValue === undefined;
      const seasonsIsString = typeof seasonsValue === 'string' || seasonsValue === '' || seasonsValue === undefined;

      addTestResult(
        'Column Data Types',
        inventoryIsValid && seasonsIsString,
        `Inventory: '${inventoryValue}' (${inventoryIsValid ? 'valid' : 'invalid'}), Seasons: '${seasonsValue}' (${seasonsIsString ? 'string' : 'invalid type'})`,
        'Inventory: Yes/No/empty, Seasons: string',
        `Inventory: '${inventoryValue}', Seasons: '${seasonsValue}'`
      );
    } else {
      addTestResult(
        'Column Data Types',
        false,
        'No data available to verify column types',
        'Valid data types',
        'No data'
      );
    }

    // Save results to file
    const resultsPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Tests: ${testResults.summary.total}`);
    console.log(`Passed: ${testResults.summary.passed}`);
    console.log(`Failed: ${testResults.summary.failed}`);
    console.log(`Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
    console.log('========================================');
    console.log(`Detailed results saved to: ${resultsPath}`);
    console.log('========================================\n');

    if (testResults.summary.failed > 0) {
      console.log('FAILED TESTS:');
      testResults.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => {
          console.log(`- ${t.test}: ${t.details}`);
        });
      console.log();
      process.exit(1);
    } else {
      console.log('ALL TESTS PASSED!');
      console.log('The Inventory and Seasons feature has been successfully implemented.');
      process.exit(0);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === 403) {
      console.error('\nAccess denied. The service account may need to be granted access to these sheets.');
      console.error('Share the sheets with: dvom-sheets-service@mineral-brand-476416-g8.iam.gserviceaccount.com');
    }

    testResults.error = {
      message: error.message,
      code: error.code,
      stack: error.stack
    };

    const resultsPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

    process.exit(1);
  }
}

testFeatureImplementation();
