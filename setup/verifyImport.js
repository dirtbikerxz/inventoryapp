const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

async function verifyImport() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A:A',
  });

  const totalRows = response.data.values ? response.data.values.length - 1 : 0;

  console.log('Total parts in sheet:', totalRows);

  const firstThree = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A2:T4',
  });

  console.log('\nFirst 3 parts:');
  firstThree.data.values.forEach((row, index) => {
    console.log('\n' + (index + 1) + '. ' + row[0] + ' - ' + row[1]);
    console.log('   Category: ' + row[2] + ', Type: ' + row[4]);
    console.log('   Specs: [' + row[6] + ', ' + row[7] + ', ' + row[8] + ', ' + row[9] + ', ' + row[10] + ']');
  });

  const lastThree = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A' + totalRows + ':T' + (totalRows + 2),
  });

  console.log('\nLast 3 parts:');
  lastThree.data.values.forEach((row, index) => {
    console.log('\n' + (index + 1) + '. ' + row[0] + ' - ' + row[1]);
    console.log('   Category: ' + row[2] + ', Type: ' + row[4]);
    console.log('   Specs: [' + row[6] + ', ' + row[7] + ', ' + row[8] + ', ' + row[9] + ', ' + row[10] + ']');
  });

  const partWithSpec5 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Parts!A2:T2',
  });

  console.log('\nSample part with Spec 5 (BELT-001):');
  const part = partWithSpec5.data.values[0];
  console.log('ID: ' + part[0]);
  console.log('Name: ' + part[1]);
  console.log('Type: ' + part[4]);
  console.log('Spec 1: ' + part[6]);
  console.log('Spec 2: ' + part[7]);
  console.log('Spec 3: ' + part[8]);
  console.log('Spec 4: ' + part[9]);
  console.log('Spec 5: ' + part[10]);
}

verifyImport().catch(console.error);
