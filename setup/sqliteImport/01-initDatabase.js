const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DB_PATH = path.join(__dirname, '..', '..', 'parts.db');
const SCHEMA_PATH = path.join(__dirname, 'createDatabase.sql');
const SPEC_CONFIG_PATH = path.join(__dirname, '..', '..', 'Testing', 'Spreadsheets', 'spec_config_import.csv');

console.log('Step 1: Initialize SQLite Database');
console.log('==================================\n');

// Delete existing database if it exists
if (fs.existsSync(DB_PATH)) {
  console.log('Deleting existing database...');
  fs.unlinkSync(DB_PATH);
}

// Create new database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error creating database:', err.message);
    process.exit(1);
  }
  console.log('Database created:', DB_PATH);
});

// Read and execute schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('Error executing schema:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('Schema created successfully');

  // Load spec configs from CSV
  loadSpecConfigs();
});

function loadSpecConfigs() {
  console.log('\nLoading spec configurations from CSV...');

  const specConfigs = [];
  const stream = fs.createReadStream(SPEC_CONFIG_PATH)
    .pipe(csv())
    .on('data', (row) => {
      // Skip empty rows
      if (!row['Category Code'] || row['Category Code'].trim() === '') {
        return;
      }

      specConfigs.push({
        category_code: row['Category Code'],
        category_name: row['Category Name'],
        subcategory: row['Subcategory Name'],
        type: row['Type'],
        spec1_label: row['Spec 1 Label'] || '',
        spec2_label: row['Spec 2 Label'] || '',
        spec3_label: row['Spec 3 Label'] || '',
        spec4_label: row['Spec 4 Label'] || '',
        spec5_label: row['Spec 5 Label'] || ''
      });
    })
    .on('end', () => {
      console.log(`Parsed ${specConfigs.length} spec configurations`);
      insertSpecConfigs(specConfigs);
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err.message);
      db.close();
      process.exit(1);
    });
}

function insertSpecConfigs(specConfigs) {
  const stmt = db.prepare(`
    INSERT INTO spec_configs (
      category_code,
      category_name,
      subcategory,
      type,
      spec1_label,
      spec2_label,
      spec3_label,
      spec4_label,
      spec5_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  let errorCount = 0;

  specConfigs.forEach((config) => {
    stmt.run(
      config.category_code,
      config.category_name,
      config.subcategory,
      config.type,
      config.spec1_label,
      config.spec2_label,
      config.spec3_label,
      config.spec4_label,
      config.spec5_label,
      (err) => {
        if (err) {
          console.error(`Error inserting spec config: ${err.message}`);
          console.error(`  Category: ${config.category_code}, Subcategory: ${config.subcategory}, Type: ${config.type}`);
          errorCount++;
        } else {
          insertedCount++;
        }
      }
    );
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('Error finalizing statement:', err.message);
      db.close();
      process.exit(1);
    }

    // Verify insertion
    db.get('SELECT COUNT(*) as count FROM spec_configs', (err, row) => {
      if (err) {
        console.error('Error counting spec configs:', err.message);
        db.close();
        process.exit(1);
      }

      console.log(`\nInserted ${insertedCount} spec configurations into database`);
      console.log(`Total spec configs in database: ${row.count}`);

      if (errorCount > 0) {
        console.log(`Errors encountered: ${errorCount}`);
      }

      if (row.count === 0) {
        console.error('\nERROR: No spec configs loaded!');
        db.close();
        process.exit(1);
      }

      console.log('\n========================================');
      console.log('Step 1 Complete: Database initialized');
      console.log(`Database: ${DB_PATH}`);
      console.log(`Spec Configs: ${row.count}`);
      console.log('========================================\n');

      db.close();
    });
  });
}
