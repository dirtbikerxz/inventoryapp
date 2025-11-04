/**
 * Search for TurnBuckle in the Parts sheet
 */

const { google } = require('googleapis');
const path = require('path');

const PARTS_DIRECTORY_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';

async function searchForTurnBuckle() {
  try {
    console.log('Searching for "TurnBuckle" in Parts sheet...\n');

    const credentialsPath = path.join(__dirname, 'credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all parts data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTS_DIRECTORY_ID,
      range: 'Parts!A:F'  // Part ID, Name, Category, Subcategory, Type, Product Code
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in Parts sheet');
      return;
    }

    const headers = rows[0];
    console.log('Columns:', headers.join(', '), '\n');

    // Search for TurnBuckle (case-insensitive)
    const searchTerm = 'turnbuckle';
    const matches = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const partID = row[0] || '';
      const partName = row[1] || '';
      const category = row[2] || '';
      const subcategory = row[3] || '';
      const type = row[4] || '';
      const productCode = row[5] || '';

      // Check if searchTerm appears in any field
      const rowText = `${partID} ${partName} ${category} ${subcategory} ${type} ${productCode}`.toLowerCase();

      if (rowText.includes(searchTerm)) {
        matches.push({
          row: i + 1,
          partID,
          partName,
          category,
          subcategory,
          type,
          productCode
        });
      }
    }

    if (matches.length === 0) {
      console.log(`❌ NO MATCHES FOUND for "${searchTerm}"`);
      console.log('\nSearched through', rows.length - 1, 'parts');
      console.log('\nTrying partial matches...\n');

      // Try finding similar words
      const similar = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const partName = (row[1] || '').toLowerCase();

        if (partName.includes('turn') || partName.includes('buckle')) {
          similar.push({
            row: i + 1,
            partID: row[0],
            partName: row[1],
            category: row[2]
          });
        }
      }

      if (similar.length > 0) {
        console.log('Found', similar.length, 'similar parts:');
        similar.forEach(p => {
          console.log(`  - ${p.partID}: ${p.partName} (${p.category})`);
        });
      } else {
        console.log('No similar parts found either.');
      }

    } else {
      console.log(`✅ FOUND ${matches.length} MATCH(ES):\n`);
      matches.forEach(match => {
        console.log(`Row ${match.row}:`);
        console.log(`  Part ID: ${match.partID}`);
        console.log(`  Part Name: ${match.partName}`);
        console.log(`  Category: ${match.category}`);
        console.log(`  Subcategory: ${match.subcategory}`);
        console.log(`  Type: ${match.type}`);
        console.log(`  Product Code: ${match.productCode}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

searchForTurnBuckle();
