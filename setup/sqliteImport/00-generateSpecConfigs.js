const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', '..', 'Testing', 'Bulk_Product_Addition.csv');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'Testing', 'Spreadsheets', 'spec_config_import.csv');

console.log('Step 0: Generate Spec Config CSV from Bulk Product Addition');
console.log('============================================================\n');

// Read the entire CSV file
const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
const lines = csvContent.split('\n');

console.log(`Read ${lines.length} lines from CSV`);

// Category code mapping (same as 02-parseAndLoad.js)
const categoryMapping = {
  'Fasteners': 'FAST',
  'Gears': 'GEAR',
  'Pulleys': 'PULLEY',
  'Belts': 'BELT',
  'Sprockets': 'SPKT',
  'Chain': 'CHAIN',
  'Bearings': 'BEAR',
  'Hardware': 'HDWR',
  'Shafts & Hubs': 'SHAFT',
  'Build Site Tools': 'TOOLS',
  'Control System': 'CTRL',
  'Motors': 'MOTOR',
  'Wiring': 'WIRE',
  'Raw Stock': 'STOCK',
  'Wheels & Casters': 'WHEEL',
  'Wheels': 'WHEEL',
  'Machining Tools': 'TOOLS',
  'Sensors': 'SENSOR'
};

// Helper function to parse CSV line with proper quote handling (same as 02-parseAndLoad.js)
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Helper function to infer Type from part name and category (same as 02-parseAndLoad.js)
function inferTypeFromPart(partName, subcategory, categoryCode) {
  // For Gears
  if (categoryCode === 'GEAR') {
    if (partName.includes('3/8" Hex Bore') || subcategory.includes('3/8')) {
      return '3/8" Hex Bore';
    } else if (partName.includes('1/2" Rounded Hex Bore')) {
      return '1/2" Rounded Hex Bore';
    } else if (partName.includes('1/2" Hex Bore') || subcategory.includes('1/2')) {
      return '1/2" Hex Bore';
    } else if (subcategory.includes('SplineXS')) {
      return 'SplineXS 20DP Gears';
    } else if (subcategory.includes('CIM')) {
      return 'CIM Motor Gears';
    } else if (subcategory.includes('Rack')) {
      if (partName.includes('10DP') || subcategory.includes('10DP')) return '10DP Gear Racks';
      if (partName.includes('20DP') || subcategory.includes('20DP')) return '20DP Gear Racks';
    }
  }

  // For Belts
  if (categoryCode === 'BELT') {
    if (partName.includes('9mm') || subcategory.includes('9mm')) return '9mm Width';
    if (partName.includes('15mm') || subcategory.includes('15mm')) return '15mm Width';
    if (partName.includes('18mm') || subcategory.includes('18mm')) return '18mm Width';
  }

  // For Pulleys
  if (categoryCode === 'PULLEY') {
    if (partName.includes('1/2" Hex') || subcategory.includes('1/2')) return '1/2" Hex Bore';
  }

  // For Sprockets
  if (categoryCode === 'SPKT') {
    if (partName.includes('Motor') || subcategory.includes('Motor')) return 'Motor Pinions';
    if (partName.includes('1/2" Rounded Hex')) return '1/2" Rounded Hex Bore';
    if (partName.includes('1/2" Hex')) return '1/2" Hex Bore';
    if (partName.includes('3/8" Hex')) return '3/8" Hex Bore';
    if (subcategory.includes('SplineXL')) return subcategory.includes('#35') ? '#35 SplineXL Plate Sprockets' : '#25 SplineXL Plate Sprockets';
    if (subcategory.includes('#25H')) return '#25H Standard Chain & Links';
    if (subcategory.includes('Standard Chain')) {
      return subcategory.includes('#35') ? '#35 Standard Chain & Links' : '#25 Standard Chain & Links';
    }
  }

  // For Bearings
  if (categoryCode === 'BEAR') {
    if (partName.includes('Flanged') || subcategory.includes('Flanged')) return 'Flanged';
    if (partName.includes('X-Contact')) return 'X-Contact';
    if (partName.includes('Radial') || subcategory.includes('Radial')) return 'Radial';
    if (partName.includes('Thrust')) return 'Thrust';
    if (partName.includes('Needle')) return 'Needle';
  }

  // For Wheels
  if (categoryCode === 'WHEEL') {
    if (partName.includes('30A')) return '30A Durometer';
    if (partName.includes('45A')) return '45A Durometer';
    if (partName.includes('60A')) return '60A Durometer';
    if (subcategory.includes('Plastic') || subcategory.includes('Vector')) return 'Plastic';
  }

  // For Shafts
  if (categoryCode === 'SHAFT') {
    if (subcategory.includes('Hex') && (partName.includes('Solid') || subcategory.includes('Solid'))) return 'Solid';
    if (subcategory.includes('Hex') && (partName.includes('Hollow') || subcategory.includes('Hollow'))) return 'Hollow';
    if (subcategory.includes('Round Tubing')) return 'Aluminum';
    if (subcategory.includes('SplineXL')) return 'Tube Stock';
  }

  // For Stock
  if (categoryCode === 'STOCK') {
    if (subcategory.includes('SRPP')) return 'Twill';
    if (subcategory.includes('Carbon') && subcategory.includes('Round')) return 'Round Tubing';
  }

  // For Motors
  if (categoryCode === 'MOTOR') {
    if (partName.includes('Kraken') || subcategory.includes('Kraken')) return 'Kraken';
  }

  // For Control
  if (categoryCode === 'CTRL') {
    if (subcategory.includes('PDP') || subcategory.includes('Power')) return 'PDP';
    if (subcategory.includes('Sensor')) return 'CTRE';
    return 'CTRE';
  }

  return 'Standard';
}

// Parse CSV to extract unique category/subcategory/type combinations
const specConfigs = new Set();
let currentCategory = '';
let currentCategoryCode = '';
let currentSubcategory = '';
let currentType = '';
let lastURL = '';
let lineNumber = 0;

for (const line of lines) {
  lineNumber++;

  // Skip only the first header line
  if (lineNumber === 1) continue;

  // Split by comma, handling quoted fields
  const cols = parseCsvLine(line);

  if (cols.length < 4) continue;

  const colA = (cols[0] || '').trim();
  const colB = (cols[1] || '').trim();
  const colC = (cols[2] || '').trim();
  const colD = (cols[3] || '').trim();

  // Skip header row
  if (colA === 'Category' && colB.includes('Subcategory')) {
    continue;
  }

  // Column A: Category
  if (colA && colA !== 'Category') {
    currentCategory = colA;
    currentCategoryCode = categoryMapping[currentCategory] || '';
    currentType = ''; // Reset Type when entering new category

    // Check if same line has Subcategory in Column B
    if (colB) {
      if (colB.includes(':')) {
        const parts = colB.split(':');
        currentSubcategory = parts[0].trim();
        lastURL = parts.slice(1).join(':').trim();
      } else {
        currentSubcategory = colB;
      }
    }
    continue;
  }

  // Column B: Subcategory with optional URL (standalone line)
  if (colB) {
    if (colB.includes(':')) {
      const parts = colB.split(':');
      currentSubcategory = parts[0].trim();
      lastURL = parts.slice(1).join(':').trim();
    } else {
      currentSubcategory = colB;
    }
    continue;
  }

  // Check if Column C has a part (Pattern A: Part in Column C with no Type)
  if (colC.includes('(WCP-')) {
    const partMatch = colC.match(/^(.+?)\(WCP-(\d+)\)\+\$(\d+\.\d+)\s*(.*)$/);
    if (partMatch) {
      const partName = partMatch[1].trim().replace(/�/g, '');

      if (!currentCategory || !currentSubcategory) {
        continue;
      }

      // Infer Type from part characteristics since no explicit Type
      const inferredType = inferTypeFromPart(partName, currentSubcategory, currentCategoryCode);

      // Add to unique set
      const key = `${currentCategoryCode}|${currentCategory}|${currentSubcategory}|${inferredType}`;
      specConfigs.add(key);
    }
    continue;
  }

  // Column C: Type (Pattern B: Type in Column C, Part in Column D)
  if (colC && !colD.includes('(WCP-')) {
    currentType = colC;
    continue;
  }

  // Column D: Part with WCP code (Pattern B)
  if (colD.includes('(WCP-')) {
    const partMatch = colD.match(/^(.+?)\(WCP-(\d+)\)\+\$(\d+\.\d+)\s*(.*)$/);
    if (partMatch) {
      const partName = partMatch[1].trim().replace(/�/g, '');

      if (!currentCategory || !currentSubcategory) {
        continue;
      }

      // Infer Type from part characteristics if not explicitly set
      let inferredType = currentType || 'Standard';

      // Category-specific type inference
      if (!currentType || currentType === 'Standard') {
        inferredType = inferTypeFromPart(partName, currentSubcategory, currentCategoryCode);
      }

      // Add to unique set
      const key = `${currentCategoryCode}|${currentCategory}|${currentSubcategory}|${inferredType}`;
      specConfigs.add(key);
    }
  }
}

console.log(`\nFound ${specConfigs.size} unique category/subcategory/type combinations\n`);

// Convert Set to sorted array
const configArray = Array.from(specConfigs).sort();

// Generate CSV output
const csvLines = ['Category Code,Category Name,Subcategory Name,Type,Spec 1 Label,Spec 2 Label,Spec 3 Label,Spec 4 Label,Spec 5 Label'];

for (const config of configArray) {
  const [categoryCode, categoryName, subcategory, type] = config.split('|');
  // Properly escape CSV fields that contain commas or quotes
  const escapeCsv = (field) => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  csvLines.push(`${escapeCsv(categoryCode)},${escapeCsv(categoryName)},${escapeCsv(subcategory)},${escapeCsv(type)},,,,,`);
}

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created directory: ${outputDir}`);
}

// Write to file
fs.writeFileSync(OUTPUT_PATH, csvLines.join('\n') + '\n', 'utf8');

console.log(`\n====================================`);
console.log(`Generated spec config CSV with ${configArray.length} configurations`);
console.log(`Output file: ${OUTPUT_PATH}`);
console.log(`====================================\n`);

// Display first 10 rows as preview
console.log('Preview of generated spec_config_import.csv:');
console.log('--------------------------------------------');
csvLines.slice(0, 11).forEach(line => console.log(line));
if (csvLines.length > 11) {
  console.log(`... and ${csvLines.length - 11} more rows`);
}
console.log('\nStep 0 Complete: Spec config CSV generated successfully\n');
