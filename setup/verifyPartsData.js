#!/usr/bin/env node

/**
 * Verify Parts Data Location
 * Check which sheet has the actual parts data
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth.getClient();
}

async function main() {
  console.log('=== Verifying Parts Data Location ===\n');

  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet metadata to list all sheets
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    console.log('Available sheets in spreadsheet:');
    metadata.data.sheets.forEach(sheet => {
      console.log(`  - ${sheet.properties.title}`);
    });

    console.log('\nChecking each sheet for data:\n');

    // Check Parts sheet
    console.log('[Parts Sheet]');
    const partsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parts!A1:Z10'
    });
    const partsRows = partsResponse.data.values || [];
    console.log(`  Rows: ${partsRows.length}`);
    if (partsRows.length > 0) {
      console.log(`  Headers: ${partsRows[0].join(', ')}`);
      console.log(`  Data rows: ${partsRows.length - 1}`);
    }

    // Check Spec Config sheet
    console.log('\n[Spec Config Sheet]');
    const specResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Spec Config!A1:Z10'
    });
    const specRows = specResponse.data.values || [];
    console.log(`  Rows: ${specRows.length}`);
    if (specRows.length > 0) {
      console.log(`  Headers: ${specRows[0].join(', ')}`);
      console.log(`  Data rows: ${specRows.length - 1}`);
    }

    // Check if there are other sheets with "Part" in the name
    const partSheets = metadata.data.sheets.filter(sheet =>
      sheet.properties.title.toLowerCase().includes('part')
    );

    if (partSheets.length > 1) {
      console.log('\n[Other Part-related Sheets]');
      for (const sheet of partSheets) {
        if (sheet.properties.title !== 'Parts' && sheet.properties.title !== 'Spec Config') {
          console.log(`\n[${sheet.properties.title}]`);
          try {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheet.properties.title}!A1:Z10`
            });
            const rows = response.data.values || [];
            console.log(`  Rows: ${rows.length}`);
            if (rows.length > 0) {
              console.log(`  Headers: ${rows[0].join(', ')}`);
              console.log(`  Data rows: ${rows.length - 1}`);
            }
          } catch (error) {
            console.log(`  Error reading sheet: ${error.message}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
