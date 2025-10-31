const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'parts.db');
const CSV_PATH = path.join(__dirname, '..', '..', 'Testing', 'Bulk_Product_Addition.csv');

console.log('Step 2: Parse CSV and Load to SQLite with Validation');
console.log('====================================================\n');

// Read the entire CSV file
const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
const lines = csvContent.split('\n');

console.log(`Read ${lines.length} lines from CSV`);

// Open database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON');

// Category code mapping
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

// Parse CSV with new structure
const parts = [];
let currentCategory = '';
let currentCategoryCode = '';
let currentSubcategory = '';
let currentType = '';
let lastURL = '';
let lineNumber = 0;

for (const line of lines) {
  lineNumber++;

  // Skip only the first header line (West Coast Products Parts)
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
    console.log(`Line ${lineNumber}: Skipping header row`);
    continue;
  }

  // Column A: Category
  if (colA && colA !== 'Category') {
    currentCategory = colA;
    currentCategoryCode = categoryMapping[currentCategory] || '';
    currentType = ''; // Reset Type when entering new category
    console.log(`\nLine ${lineNumber}: Category: ${currentCategory} (${currentCategoryCode})`);

    // Check if same line has Subcategory in Column B
    if (colB) {
      if (colB.includes(':')) {
        const parts = colB.split(':');
        currentSubcategory = parts[0].trim();
        lastURL = parts.slice(1).join(':').trim();
      } else {
        currentSubcategory = colB;
      }
      console.log(`  Line ${lineNumber}: Subcategory: "${currentSubcategory}"${lastURL ? ', URL: ' + lastURL : ''}`);
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
    console.log(`  Line ${lineNumber}: Subcategory: "${currentSubcategory}"${lastURL ? ', URL: ' + lastURL : ''}`);
    continue;
  }

  // Check if Column C has a part (Pattern A: Part in Column C with no Type)
  if (colC.includes('(WCP-')) {
    const partMatch = colC.match(/^(.+?)\(WCP-(\d+)\)\+\$(\d+\.\d+)\s*(.*)$/);
    if (partMatch) {
      const partName = partMatch[1].trim().replace(/�/g, '');
      const productCode = 'WCP-' + partMatch[2];
      const price = parseFloat(partMatch[3]);
      const url = lastURL || `https://wcproducts.com/products/${productCode.toLowerCase()}`;

      if (!currentCategory || !currentSubcategory) {
        console.warn(`  Line ${lineNumber}: WARNING - No category/subcategory context for part: ${partName}`);
        continue;
      }

      // Infer Type from part characteristics since no explicit Type
      const inferredType = inferTypeFromPart(partName, currentSubcategory, currentCategoryCode);

      parts.push({
        part_name: partName,
        product_code: productCode,
        price: price,
        url: url,
        category_code: currentCategoryCode,
        category_name: currentCategory,
        subcategory: currentSubcategory,
        type: inferredType,
        lineNumber: lineNumber
      });
    }
    continue;
  }

  // Column C: Type (Pattern B: Type in Column C, Part in Column D)
  if (colC && !colD.includes('(WCP-')) {
    currentType = colC;
    console.log(`  Line ${lineNumber}: Type: "${currentType}"`);
    continue;
  }

  // Column D: Part with WCP code (Pattern B)
  if (colD.includes('(WCP-')) {
    const partMatch = colD.match(/^(.+?)\(WCP-(\d+)\)\+\$(\d+\.\d+)\s*(.*)$/);
    if (partMatch) {
      const partName = partMatch[1].trim().replace(/�/g, '');
      const productCode = 'WCP-' + partMatch[2];
      const price = parseFloat(partMatch[3]);
      const url = lastURL || `https://wcproducts.com/products/${productCode.toLowerCase()}`;

      if (!currentCategory || !currentSubcategory) {
        console.warn(`  Line ${lineNumber}: WARNING - No category/subcategory context for part: ${partName}`);
        continue;
      }

      // Infer Type from part characteristics if not explicitly set
      let inferredType = currentType || 'Standard';

      // Category-specific type inference
      if (!currentType || currentType === 'Standard') {
        inferredType = inferTypeFromPart(partName, currentSubcategory, currentCategoryCode);
      }

      parts.push({
        part_name: partName,
        product_code: productCode,
        price: price,
        url: url,
        category_code: currentCategoryCode,
        category_name: currentCategory,
        subcategory: currentSubcategory,
        type: inferredType,
        lineNumber: lineNumber
      });
    }
  }
}

console.log(`\n====================================`);
console.log(`Parsed ${parts.length} parts from CSV`);
console.log(`====================================\n`);

// Insert parts into database with constraint validation
insertParts(parts);

function insertParts(parts) {
  const stmt = db.prepare(`
    INSERT INTO parts (
      part_name,
      product_code,
      price,
      url,
      category_code,
      category_name,
      subcategory,
      type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  let errorCount = 0;
  let currentIndex = 0;

  function insertNext() {
    if (currentIndex >= parts.length) {
      // All done
      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing statement:', err.message);
          db.close();
          process.exit(1);
        }

        // Verify insertion
        db.get('SELECT COUNT(*) as count FROM parts', (err, row) => {
          if (err) {
            console.error('Error counting parts:', err.message);
            db.close();
            process.exit(1);
          }

          console.log(`\n====================================`);
          console.log(`Inserted ${insertedCount} parts into database`);
          console.log(`Total parts in database: ${row.count}`);
          if (errorCount > 0) {
            console.log(`Errors encountered: ${errorCount}`);
            console.log(`\nNOTE: Review errors above and fix parser if needed`);
          }
          console.log(`====================================\n`);

          if (errorCount > 0) {
            console.error('FAILED: Some parts had constraint violations');
            db.close();
            process.exit(1);
          }

          if (row.count === 0) {
            console.error('ERROR: No parts loaded!');
            db.close();
            process.exit(1);
          }

          console.log('Step 2 Complete: CSV parsed and loaded successfully');
          console.log('Database constraints enforced - all parts validated\n');

          db.close();
        });
      });
      return;
    }

    const part = parts[currentIndex];
    currentIndex++;

    stmt.run(
      part.part_name,
      part.product_code,
      part.price,
      part.url,
      part.category_code,
      part.category_name,
      part.subcategory,
      part.type,
      (err) => {
        if (err) {
          console.error(`\nCONSTRAINT VIOLATION at line ${part.lineNumber}:`);
          console.error(`Part: ${part.part_name}`);
          console.error(`Category: ${part.category_name} (${part.category_code})`);
          console.error(`Subcategory: ${part.subcategory}`);
          console.error(`Type: ${part.type}`);
          console.error(`Error: ${err.message}\n`);

          errorCount++;
          insertNext();
        } else {
          insertedCount++;
          if (insertedCount % 100 === 0) {
            console.log(`Inserted ${insertedCount} parts...`);
          }
          insertNext();
        }
      }
    );
  }

  insertNext();
}

// Helper function to parse CSV line with proper quote handling
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

// Helper function to infer Type from part name and category
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
