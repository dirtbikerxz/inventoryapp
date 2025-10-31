const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../Testing/Spreadsheets/wcp_final_verified.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const categories = {};
data.parts.forEach(p => {
  if (!categories[p.category_code]) {
    categories[p.category_code] = {
      name: p.category_name,
      count: 0
    };
  }
  categories[p.category_code].count++;
});

console.log('Categories and counts:');
Object.keys(categories).sort().forEach(code => {
  console.log(`${code}: ${categories[code].name} (${categories[code].count} parts)`);
});

console.log('\nTotal parts:', data.parts.length);
