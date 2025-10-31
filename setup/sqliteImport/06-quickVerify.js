/**
 * Quick Verification Script - Google Sheets Export
 *
 * Performs quick checks to verify the export was successful
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';

async function quickVerify() {
  console.log('\n=== Quick Verification ===\n');

  // Connect to Google Sheets
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Get all data
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A2:T657',
  });

  const parts = response.data.values || [];

  console.log(`Total Parts: ${parts.length}`);

  // Check 1: No duplicate Part IDs
  const partIds = parts.map(r => r[0]);
  const duplicates = partIds.filter((id, idx) => partIds.indexOf(id) !== idx);
  console.log(`Duplicate Part IDs: ${duplicates.length === 0 ? 'None (PASS)' : duplicates.join(', ') + ' (FAIL)'}`);

  // Check 2: All Part IDs follow format
  const invalidIds = partIds.filter(id => !id.match(/^[A-Z]+-\d{3}$/));
  console.log(`Invalid Part ID Format: ${invalidIds.length === 0 ? 'None (PASS)' : invalidIds.length + ' (FAIL)'}`);

  // Check 3: All required columns populated
  let missingData = 0;
  parts.forEach((row, idx) => {
    if (!row[0] || !row[1] || !row[2] || !row[5] || !row[12]) {
      missingData++;
    }
  });
  console.log(`Missing Required Data: ${missingData === 0 ? 'None (PASS)' : missingData + ' parts (FAIL)'}`);

  // Check 4: Category distribution
  const categories = {};
  parts.forEach(row => {
    const cat = row[2];
    if (cat) {
      categories[cat] = (categories[cat] || 0) + 1;
    }
  });

  console.log('\nCategory Distribution:');
  Object.keys(categories).sort().forEach(cat => {
    console.log(`  ${cat}: ${categories[cat]} parts`);
  });

  // Check 5: Specification coverage
  let totalSpecs = 0;
  let possibleSpecs = parts.length * 5;
  parts.forEach(row => {
    for (let i = 6; i <= 10; i++) {
      if (row[i]) totalSpecs++;
    }
  });

  const coverage = ((totalSpecs / possibleSpecs) * 100).toFixed(1);
  console.log(`\nSpecification Coverage: ${coverage}% (${totalSpecs}/${possibleSpecs})`);

  // Check 6: Sample parts
  console.log('\nSample Parts:');
  console.log('\nFirst GEAR:');
  const firstGear = parts.find(r => r[2] === 'Gears');
  if (firstGear) {
    console.log(`  ${firstGear[0]} - ${firstGear[1]}`);
    console.log(`  Specs: [${[firstGear[6], firstGear[7], firstGear[8], firstGear[9], firstGear[10]].filter(s => s).join(', ')}]`);
  }

  console.log('\nFirst BELT:');
  const firstBelt = parts.find(r => r[2] === 'Belts');
  if (firstBelt) {
    console.log(`  ${firstBelt[0]} - ${firstBelt[1]}`);
    console.log(`  Specs: [${[firstBelt[6], firstBelt[7], firstBelt[8], firstBelt[9], firstBelt[10]].filter(s => s).join(', ')}]`);
  }

  console.log('\nFirst FASTENER:');
  const firstFast = parts.find(r => r[2] === 'Fasteners');
  if (firstFast) {
    console.log(`  ${firstFast[0]} - ${firstFast[1]}`);
    console.log(`  Specs: [${[firstFast[6], firstFast[7], firstFast[8], firstFast[9], firstFast[10]].filter(s => s).join(', ')}]`);
  }

  // Final verdict
  console.log('\n=== Verification Results ===\n');
  const allChecksPassed = duplicates.length === 0 && invalidIds.length === 0 && missingData === 0;

  if (allChecksPassed) {
    console.log('STATUS: ALL CHECKS PASSED');
    console.log('The export is verified and ready for production use.');
  } else {
    console.log('STATUS: SOME CHECKS FAILED');
    console.log('Please review the failures above.');
  }

  console.log(`\nView the data: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

quickVerify().catch(console.error);
