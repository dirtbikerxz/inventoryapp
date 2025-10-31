-- Validation Queries - All queries must return 0 rows for data to be valid

-- Check 1: Steel parts must have "Steel" in subcategory (unless Standard Chain)
SELECT
  'ERROR: Steel part with wrong subcategory' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%Steel%'
AND subcategory NOT LIKE '%Steel%'
AND subcategory NOT LIKE '%Standard Chain%';

-- Check 2: Aluminum parts must have "Aluminum" in subcategory
SELECT
  'ERROR: Aluminum part with wrong subcategory' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%Aluminum%'
AND subcategory NOT LIKE '%Aluminum%';

-- Check 3: #25 chain parts must have "#25" in subcategory or type
SELECT
  'ERROR: #25 part with wrong subcategory/type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%#25%'
AND subcategory NOT LIKE '%#25%'
AND type NOT LIKE '%#25%';

-- Check 4: #35 chain parts must have "#35" in subcategory or type
SELECT
  'ERROR: #35 part with wrong subcategory/type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%#35%'
AND subcategory NOT LIKE '%#35%'
AND type NOT LIKE '%#35%';

-- Check 5: 1/2" hex bore parts must have "1/2" in type
SELECT
  'ERROR: 1/2" bore part with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE (part_name LIKE '%1/2" Hex Bore%' OR part_name LIKE '%1/2" Rounded Hex Bore%')
AND type NOT LIKE '%1/2%';

-- Check 6: 3/8" hex bore parts must have "3/8" in type
SELECT
  'ERROR: 3/8" bore part with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%3/8" Hex Bore%'
AND type NOT LIKE '%3/8%';

-- Check 7: All parts must reference valid spec config
SELECT
  'ERROR: No matching spec config' as error,
  p.part_name,
  p.category_code,
  p.subcategory,
  p.type
FROM parts p
LEFT JOIN spec_configs sc
  ON p.category_code = sc.category_code
  AND p.subcategory = sc.subcategory
  AND p.type = sc.type
WHERE sc.category_code IS NULL;

-- Check 8: No parts should have empty category/subcategory/type
SELECT
  'ERROR: Empty category/subcategory/type' as error,
  part_name,
  category_code,
  subcategory,
  type
FROM parts
WHERE category_code = ''
OR subcategory = ''
OR type = '';

-- Check 9: 30A durometer wheels must have "30A" in type
SELECT
  'ERROR: 30A wheel with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%30A%'
AND category_code = 'WHEEL'
AND type NOT LIKE '%30A%';

-- Check 10: 45A durometer wheels must have "45A" in type
SELECT
  'ERROR: 45A wheel with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%45A%'
AND category_code = 'WHEEL'
AND type NOT LIKE '%45A%';

-- Check 11: 60A durometer wheels must have "60A" in type
SELECT
  'ERROR: 60A wheel with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%60A%'
AND category_code = 'WHEEL'
AND type NOT LIKE '%60A%';

-- Check 12: Flanged bearings must have "Flanged" in type
SELECT
  'ERROR: Flanged bearing with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%Flanged%'
AND category_code = 'BEAR'
AND type NOT LIKE '%Flanged%';

-- Check 13: X-Contact bearings must have "X-Contact" in type
SELECT
  'ERROR: X-Contact bearing with wrong type' as error,
  part_name,
  subcategory,
  type
FROM parts
WHERE part_name LIKE '%X-Contact%'
AND category_code = 'BEAR'
AND type NOT LIKE '%X-Contact%';
