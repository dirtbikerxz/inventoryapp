/**
 * Build Spec Configuration for FRC categories
 * Creates spec field labels for each category defining what Spec 1-4 represent
 * Imports to the Spec Config sheet in Google Sheets
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const SPREADSHEET_ID = '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo';
const CATEGORIES_SHEET = 'Categories';
const SPEC_CONFIG_SHEET = 'Spec Config';
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

/**
 * Spec configuration mapping for each category
 * Defines what Spec 1-4 fields represent for each category code
 */
const SPEC_CONFIGURATIONS = {
  'ADHSV': {
    spec1: 'Adhesive Type',
    spec2: 'Size/Volume',
    spec3: 'Application',
    spec4: 'N/A'
  },
  'POWER': {
    spec1: 'Component Type',
    spec2: 'Voltage/Amperage',
    spec3: 'Model Number',
    spec4: 'N/A'
  },
  'BEAR': {
    spec1: 'Bearing Type',
    spec2: 'Bore Size',
    spec3: 'OD',
    spec4: 'Material'
  },
  'BELT': {
    spec1: 'Belt Type',
    spec2: 'Tooth Count',
    spec3: 'Width',
    spec4: 'N/A'
  },
  'TOOLS': {
    spec1: 'Tool Type',
    spec2: 'Size/Capacity',
    spec3: 'Power Source',
    spec4: 'N/A'
  },
  'BUMP': {
    spec1: 'Material Type',
    spec2: 'Color',
    spec3: 'Dimensions',
    spec4: 'N/A'
  },
  'BIZMED': {
    spec1: 'Item Type',
    spec2: 'Quantity',
    spec3: 'Size',
    spec4: 'N/A'
  },
  'CHAIN': {
    spec1: 'Chain Type',
    spec2: 'Component Type',
    spec3: 'Length/Quantity',
    spec4: 'N/A'
  },
  'CONSUM': {
    spec1: 'Consumable Type',
    spec2: 'Size/Specification',
    spec3: 'Material',
    spec4: 'Quantity'
  },
  'CTRL': {
    spec1: 'Component Type',
    spec2: 'Model',
    spec3: 'Interface',
    spec4: 'N/A'
  },
  'ELEC': {
    spec1: 'Controller Type',
    spec2: 'Model',
    spec3: 'Current Limit',
    spec4: 'Protocol'
  },
  'FAST': {
    spec1: 'Thread Size',
    spec2: 'Length',
    spec3: 'Type',
    spec4: 'Material/Finish'
  },
  'GAME': {
    spec1: 'Element Type',
    spec2: 'Season Year',
    spec3: 'Dimensions',
    spec4: 'N/A'
  },
  'GEAR': {
    spec1: 'Tooth Count',
    spec2: 'Pitch',
    spec3: 'Bore Type',
    spec4: 'Material'
  },
  'HDWR': {
    spec1: 'Hardware Type',
    spec2: 'Size',
    spec3: 'Material',
    spec4: 'Load Capacity'
  },
  'MACH': {
    spec1: 'Tool Type',
    spec2: 'Size/Diameter',
    spec3: 'Material',
    spec4: 'Coating'
  },
  'MOTOR': {
    spec1: 'Motor Model',
    spec2: 'Free Speed',
    spec3: 'Stall Torque',
    spec4: 'N/A'
  },
  'PNEU': {
    spec1: 'Component Type',
    spec2: 'Size/Bore',
    spec3: 'Stroke Length',
    spec4: 'Pressure Rating'
  },
  'PULLEY': {
    spec1: 'Belt Type',
    spec2: 'Tooth Count',
    spec3: 'Width',
    spec4: 'Bore Type'
  },
  'STOCK': {
    spec1: 'Material Type',
    spec2: 'Dimensions',
    spec3: 'Thickness/Gauge',
    spec4: 'Length'
  },
  'SAFETY': {
    spec1: 'Safety Item Type',
    spec2: 'Size',
    spec3: 'Certification',
    spec4: 'N/A'
  },
  'SENSOR': {
    spec1: 'Sensor Type',
    spec2: 'Model',
    spec3: 'Interface',
    spec4: 'Range/Resolution'
  },
  'SHAFT': {
    spec1: 'Shaft Type',
    spec2: 'Diameter',
    spec3: 'Length',
    spec4: 'Material'
  },
  'SPKT': {
    spec1: 'Chain Type',
    spec2: 'Tooth Count',
    spec3: 'Bore Type',
    spec4: 'Sprocket Type'
  },
  'STRUCT': {
    spec1: 'System Type',
    spec2: 'Profile/Size',
    spec3: 'Length',
    spec4: 'Material'
  },
  'WHEEL': {
    spec1: 'Wheel Type',
    spec2: 'Diameter',
    spec3: 'Width',
    spec4: 'Durometer/Material'
  },
  'WIRE': {
    spec1: 'Wire Type',
    spec2: 'Gauge',
    spec3: 'Length',
    spec4: 'Connector Type'
  },
  'PRINT': {
    spec1: 'Material Type',
    spec2: 'Color',
    spec3: 'Weight/Volume',
    spec4: 'Diameter/Type'
  }
};

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
 * Get categories from Google Sheets
 */
async function getCategories(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CATEGORIES_SHEET}!A2:B`,
    });

    const rows = response.data.values || [];
    return rows.map(row => ({
      name: row[0],
      code: row[1]
    }));
  } catch (error) {
    throw new Error(`Failed to read categories: ${error.message}`);
  }
}

/**
 * Check if Spec Config sheet exists, create if not
 */
async function ensureSpecConfigSheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Get spreadsheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const sheetExists = spreadsheet.data.sheets.some(
      sheet => sheet.properties.title === SPEC_CONFIG_SHEET
    );

    if (!sheetExists) {
      console.log(`Creating ${SPEC_CONFIG_SHEET} sheet...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: SPEC_CONFIG_SHEET
              }
            }
          }]
        }
      });
      console.log(`${SPEC_CONFIG_SHEET} sheet created`);
    } else {
      console.log(`${SPEC_CONFIG_SHEET} sheet already exists`);
    }
  } catch (error) {
    throw new Error(`Failed to ensure sheet exists: ${error.message}`);
  }
}

/**
 * Build spec config data from categories
 */
function buildSpecConfigData(categories) {
  const specConfigData = [];

  categories.forEach(category => {
    const config = SPEC_CONFIGURATIONS[category.code];

    if (config) {
      specConfigData.push({
        categoryCode: category.code,
        categoryName: category.name,
        spec1Label: config.spec1,
        spec2Label: config.spec2,
        spec3Label: config.spec3,
        spec4Label: config.spec4
      });
    } else {
      // Default spec labels for unmapped categories
      console.warn(`Warning: No spec config for ${category.code}, using defaults`);
      specConfigData.push({
        categoryCode: category.code,
        categoryName: category.name,
        spec1Label: 'Spec 1',
        spec2Label: 'Spec 2',
        spec3Label: 'Spec 3',
        spec4Label: 'Spec 4'
      });
    }
  });

  return specConfigData;
}

/**
 * Import spec config to Google Sheets
 */
async function importSpecConfig(auth, specConfigData) {
  const sheets = google.sheets({ version: 'v4', auth });

  const headers = [
    'Category Code',
    'Category Name',
    'Spec 1 Label',
    'Spec 2 Label',
    'Spec 3 Label',
    'Spec 4 Label'
  ];

  const values = [
    headers,
    ...specConfigData.map(config => [
      config.categoryCode,
      config.categoryName,
      config.spec1Label,
      config.spec2Label,
      config.spec3Label,
      config.spec4Label
    ])
  ];

  try {
    // Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SPEC_CONFIG_SHEET}!A1:Z`,
    });

    console.log('Cleared existing spec config data');

    // Update with new data
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SPEC_CONFIG_SHEET}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: values
      }
    });

    console.log(`Imported ${specConfigData.length} spec configurations`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to import spec config: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting spec config build process...');

  try {
    // Authenticate
    console.log('Authenticating with Google Sheets API...');
    const auth = await authenticate();
    console.log('Authentication successful');

    // Ensure Spec Config sheet exists
    await ensureSpecConfigSheet(auth);

    // Get categories from Google Sheets
    console.log('\nReading categories from Google Sheets...');
    const categories = await getCategories(auth);
    console.log(`Found ${categories.length} categories`);

    // Build spec config data
    console.log('\nBuilding spec configurations...');
    const specConfigData = buildSpecConfigData(categories);

    // Display spec configs
    console.log('\nSpec Configurations:');
    specConfigData.forEach(config => {
      console.log(`\n${config.categoryName} (${config.categoryCode}):`);
      console.log(`  Spec 1: ${config.spec1Label}`);
      console.log(`  Spec 2: ${config.spec2Label}`);
      console.log(`  Spec 3: ${config.spec3Label}`);
      console.log(`  Spec 4: ${config.spec4Label}`);
    });

    // Import to Google Sheets
    console.log(`\nImporting to spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`Sheet name: ${SPEC_CONFIG_SHEET}`);
    await importSpecConfig(auth, specConfigData);

    console.log('\n=== SPEC CONFIG BUILD COMPLETE ===');
    console.log(`Total spec configurations: ${specConfigData.length}`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`Sheet name: ${SPEC_CONFIG_SHEET}`);

  } catch (error) {
    console.error('\n=== SPEC CONFIG BUILD FAILED ===');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
