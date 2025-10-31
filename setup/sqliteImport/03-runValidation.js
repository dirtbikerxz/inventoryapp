const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'parts.db');
const VALIDATE_SQL_PATH = path.join(__dirname, 'validate.sql');
const REPORT_PATH = path.join(__dirname, '..', '..', 'Testing', 'STEP_3_VALIDATION_REPORT.md');

console.log('Step 3: Run Validation Queries');
console.log('================================\n');

// Read validation queries from SQL file
const sqlContent = fs.readFileSync(VALIDATE_SQL_PATH, 'utf8');

// Split into individual queries (separated by blank lines and comments)
const queries = [];
let currentQuery = '';
let currentCheckNumber = 0;
let currentDescription = '';

for (const line of sqlContent.split('\n')) {
  if (line.trim().startsWith('-- Check')) {
    // Save previous query if exists
    if (currentQuery.trim()) {
      queries.push({
        number: currentCheckNumber,
        description: currentDescription,
        sql: currentQuery.trim()
      });
      currentQuery = '';
    }
    // Extract check number and description
    const match = line.match(/-- Check (\d+): (.+)/);
    if (match) {
      currentCheckNumber = parseInt(match[1]);
      currentDescription = match[2];
    }
  } else if (!line.trim().startsWith('--') && line.trim()) {
    currentQuery += line + '\n';
  } else if (line.trim() === '' && currentQuery.trim()) {
    // End of query
    queries.push({
      number: currentCheckNumber,
      description: currentDescription,
      sql: currentQuery.trim()
    });
    currentQuery = '';
  }
}

// Add last query if exists
if (currentQuery.trim()) {
  queries.push({
    number: currentCheckNumber,
    description: currentDescription,
    sql: currentQuery.trim()
  });
}

console.log(`Loaded ${queries.length} validation queries from validate.sql\n`);

// Open database
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Database opened successfully\n');
});

// Get database statistics
db.get('SELECT COUNT(*) as count FROM parts', (err, row) => {
  if (err) {
    console.error('Error getting part count:', err.message);
    db.close();
    process.exit(1);
  }

  const totalParts = row.count;
  console.log(`Total parts in database: ${totalParts}\n`);

  db.get('SELECT COUNT(*) as count FROM spec_configs', (err, row) => {
    if (err) {
      console.error('Error getting spec config count:', err.message);
      db.close();
      process.exit(1);
    }

    const totalSpecs = row.count;
    console.log(`Total spec configs in database: ${totalSpecs}\n`);
    console.log('Running validation queries...\n');

    // Run all validation queries
    runValidations(queries, totalParts, totalSpecs);
  });
});

function runValidations(queries, totalParts, totalSpecs) {
  const results = [];
  let currentIndex = 0;

  function runNext() {
    if (currentIndex >= queries.length) {
      // All done - generate report
      generateReport(results, totalParts, totalSpecs);
      return;
    }

    const query = queries[currentIndex];
    currentIndex++;

    console.log(`Check ${query.number}: ${query.description}`);

    db.all(query.sql, [], (err, rows) => {
      if (err) {
        console.error(`  ERROR running query: ${err.message}\n`);
        results.push({
          number: query.number,
          description: query.description,
          status: 'ERROR',
          errorCount: -1,
          errors: [],
          queryError: err.message
        });
        runNext();
        return;
      }

      const errorCount = rows.length;
      if (errorCount === 0) {
        console.log(`  PASS - No validation errors found\n`);
        results.push({
          number: query.number,
          description: query.description,
          status: 'PASS',
          errorCount: 0,
          errors: []
        });
      } else {
        console.log(`  FAIL - ${errorCount} validation error(s) found`);
        // Show first 3 examples
        const examples = rows.slice(0, 3);
        examples.forEach((row, idx) => {
          console.log(`    Example ${idx + 1}:`);
          console.log(`      Part: ${row.part_name || 'N/A'}`);
          console.log(`      Subcategory: ${row.subcategory || 'N/A'}`);
          console.log(`      Type: ${row.type || 'N/A'}`);
        });
        if (errorCount > 3) {
          console.log(`    ... and ${errorCount - 3} more`);
        }
        console.log('');

        results.push({
          number: query.number,
          description: query.description,
          status: 'FAIL',
          errorCount: errorCount,
          errors: rows
        });
      }

      runNext();
    });
  }

  runNext();
}

function generateReport(results, totalParts, totalSpecs) {
  console.log('\n====================================');
  console.log('Validation Summary');
  console.log('====================================\n');

  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.status === 'PASS').length;
  const failedChecks = results.filter(r => r.status === 'FAIL').length;
  const errorChecks = results.filter(r => r.status === 'ERROR').length;
  const totalErrors = results.reduce((sum, r) => sum + (r.errorCount > 0 ? r.errorCount : 0), 0);

  console.log(`Total validation checks: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Failed: ${failedChecks}`);
  console.log(`Query Errors: ${errorChecks}`);
  console.log(`Total validation errors found: ${totalErrors}\n`);

  // Show failed checks
  if (failedChecks > 0) {
    console.log('Failed Checks:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  Check ${r.number}: ${r.description} - ${r.errorCount} error(s)`);
    });
    console.log('');
  }

  // Overall assessment
  let overallStatus = 'PASS';
  let canProceed = true;
  if (failedChecks > 0 || errorChecks > 0) {
    overallStatus = 'FAIL';
    canProceed = false;
  }

  console.log(`Overall Status: ${overallStatus}`);
  console.log(`Can proceed to Step 4: ${canProceed ? 'YES' : 'NO'}\n`);

  // Generate markdown report
  const timestamp = new Date().toISOString();
  let report = `# Step 3: SQLite Import Validation Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Database:** parts.db\n\n`;

  report += `## Summary\n\n`;
  report += `- **Total Parts:** ${totalParts}\n`;
  report += `- **Total Spec Configs:** ${totalSpecs}\n`;
  report += `- **Total Validation Checks:** ${totalChecks}\n`;
  report += `- **Passed:** ${passedChecks}\n`;
  report += `- **Failed:** ${failedChecks}\n`;
  report += `- **Query Errors:** ${errorChecks}\n`;
  report += `- **Total Validation Errors:** ${totalErrors}\n`;
  report += `- **Overall Status:** ${overallStatus}\n`;
  report += `- **Can Proceed to Step 4:** ${canProceed ? 'YES' : 'NO'}\n\n`;

  report += `## Validation Checks\n\n`;

  results.forEach(result => {
    report += `### Check ${result.number}: ${result.description}\n\n`;
    report += `**Status:** ${result.status}\n`;

    if (result.status === 'ERROR') {
      report += `**Query Error:** ${result.queryError}\n\n`;
    } else if (result.status === 'PASS') {
      report += `**Result:** No validation errors found\n\n`;
    } else {
      report += `**Errors Found:** ${result.errorCount}\n\n`;

      if (result.errors.length > 0) {
        report += `**Examples:**\n\n`;
        report += `| Part Name | Subcategory | Type |\n`;
        report += `|-----------|-------------|------|\n`;

        const examples = result.errors.slice(0, 5);
        examples.forEach(error => {
          const partName = (error.part_name || 'N/A').replace(/\|/g, '\\|');
          const subcategory = (error.subcategory || 'N/A').replace(/\|/g, '\\|');
          const type = (error.type || 'N/A').replace(/\|/g, '\\|');
          report += `| ${partName} | ${subcategory} | ${type} |\n`;
        });

        if (result.errorCount > 5) {
          report += `\n*... and ${result.errorCount - 5} more errors*\n`;
        }
        report += `\n`;
      }
    }
  });

  report += `## Data Quality Assessment\n\n`;

  if (canProceed) {
    report += `All validation checks passed successfully. The data quality is excellent:\n\n`;
    report += `- All parts reference valid spec configurations\n`;
    report += `- Material designations are consistent with subcategory classifications\n`;
    report += `- Chain sizes (#25, #35) are properly categorized\n`;
    report += `- Bearing types are correctly classified\n`;
    report += `- Wheel durometers match their type designations\n`;
    report += `- Bore sizes are consistent with part names\n`;
    report += `- No empty category, subcategory, or type fields\n\n`;
    report += `The database is ready for Step 4: Specification Extraction.\n\n`;
  } else {
    report += `Validation failures detected. Issues found:\n\n`;

    const failedResults = results.filter(r => r.status === 'FAIL');
    failedResults.forEach(result => {
      report += `- **${result.description}**: ${result.errorCount} error(s)\n`;
    });

    report += `\n### Recommendations\n\n`;
    report += `1. Review the validation errors above\n`;
    report += `2. Update the type inference logic in 02-parseAndLoad.js\n`;
    report += `3. Re-run Step 2 to reload the data with fixes\n`;
    report += `4. Re-run Step 3 to verify all validations pass\n\n`;
    report += `**Do not proceed to Step 4 until all validations pass.**\n\n`;
  }

  report += `## Next Steps\n\n`;

  if (canProceed) {
    report += `Proceed to Step 4: Specification Extraction\n\n`;
    report += `Run: \`node setup/sqliteImport/04-extractSpecifications.js\`\n\n`;
    report += `Step 4 will:\n`;
    report += `- Extract all unique specifications from part names\n`;
    report += `- Populate the spec_values table\n`;
    report += `- Create part_specifications junction records\n`;
    report += `- Validate specification extraction accuracy\n`;
  } else {
    report += `Fix validation errors before proceeding:\n\n`;
    report += `1. Review error examples above\n`;
    report += `2. Update parser logic in \`setup/sqliteImport/02-parseAndLoad.js\`\n`;
    report += `3. Re-run: \`node setup/sqliteImport/02-parseAndLoad.js\`\n`;
    report += `4. Re-validate: \`node setup/sqliteImport/03-runValidation.js\`\n`;
  }

  // Write report to file
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`Report written to: ${REPORT_PATH}\n`);

  console.log('Step 3 Complete\n');

  db.close();

  // Exit with appropriate code
  process.exit(canProceed ? 0 : 1);
}
