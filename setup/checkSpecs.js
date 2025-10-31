const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo',
    range: 'Parts!A2:I50'
  });

  const rows = response.data.values || [];
  console.log('Sample Parts with Specs:\n');

  const categories = ['FAST', 'GEAR', 'STRUCT', 'SHAFT', 'HDWR', 'PULLEY', 'BELT', 'SPKT'];
  let samplesPerCategory = {};

  rows.forEach((row) => {
    const partId = row[0];
    const category = partId.split('-')[0];

    if (categories.includes(category) && (!samplesPerCategory[category] || samplesPerCategory[category] < 2)) {
      console.log(`${row[0]} - ${row[1]}`);
      console.log(`  Category: ${row[2]}`);
      console.log(`  Spec 1: ${row[5] || '(empty)'}`);
      console.log(`  Spec 2: ${row[6] || '(empty)'}`);
      console.log(`  Spec 3: ${row[7] || '(empty)'}`);
      console.log(`  Spec 4: ${row[8] || '(empty)'}`);
      console.log();
      samplesPerCategory[category] = (samplesPerCategory[category] || 0) + 1;
    }
  });
}

main().catch(console.error);
