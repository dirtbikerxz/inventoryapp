/**
 * Denham Venom Parts Management System
 * Team 8044 - Main Server-Side Code
 *
 * This Google Apps Script handles all server-side operations for the parts
 * management system including inventory queries, order processing, and part additions.
 */

// Configuration - Update these with your actual spreadsheet IDs
const CONFIG = {
  PARTS_DIRECTORY_ID: '1ttk2hlid22rtA6zcNvN9RrvG24qi-XfiUcdcumafaKo',
  PARTS_ORDERS_ID: '1f-4T0wMjLQKnA-dbFMgUDRKnSuwi0kjdSl91MuRHpeQ',
  PARTS_SHEET_NAME: 'Parts',
  ORDERS_SHEET_NAME: 'Orders',
  STUDENTS_SHEET_NAME: 'Students',
  SPEC_CONFIG_SHEET_NAME: 'Spec Config',
  ADD_PART_PASSWORD: 'venom8044'
};

/**
 * Serves the web application
 * @param {Object} e - Event object containing request parameters
 * @returns {HtmlOutput} The HTML page to display
 */
function doGet(e) {
  try {
    const template = HtmlService.createTemplateFromFile('WebApp');
    return template.evaluate()
      .setTitle('Denham Venom Parts System')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return HtmlService.createHtmlOutput('<h1>Error loading application</h1><p>' + error.toString() + '</p>');
  }
}

/**
 * Gets all unique categories from the parts directory
 * @returns {Array<string>} Sorted array of category names
 */
function getCategories() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const categoryCol = headers.indexOf('Category');

    if (categoryCol === -1) {
      throw new Error('Category column not found');
    }

    const categories = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryCol]) {
        categories.add(data[i][categoryCol].toString().trim());
      }
    }

    return Array.from(categories).sort();
  } catch (error) {
    Logger.log('Error in getCategories: ' + error.toString());
    throw new Error('Failed to retrieve categories: ' + error.message);
  }
}

/**
 * Gets unique subcategories for a given category
 * @param {string} category - The category to filter by
 * @returns {Array<string>} Sorted array of subcategory names
 */
function getSubcategories(category) {
  try {
    if (!category) {
      return [];
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const categoryCol = headers.indexOf('Category');
    const subcategoryCol = headers.indexOf('Subcategory');

    if (categoryCol === -1 || subcategoryCol === -1) {
      throw new Error('Required columns not found');
    }

    const subcategories = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryCol] &&
          data[i][categoryCol].toString().trim() === category &&
          data[i][subcategoryCol]) {
        subcategories.add(data[i][subcategoryCol].toString().trim());
      }
    }

    return Array.from(subcategories).sort();
  } catch (error) {
    Logger.log('Error in getSubcategories: ' + error.toString());
    throw new Error('Failed to retrieve subcategories: ' + error.message);
  }
}

/**
 * Gets parts based on category, subcategory, and optional spec filters
 * @param {Object} filters - Object containing filter criteria
 * @param {string} filters.category - The category to filter by
 * @param {string} filters.subcategory - The subcategory to filter by
 * @param {string} filters.spec1 - Optional spec1 filter value
 * @param {string} filters.spec2 - Optional spec2 filter value
 * @param {string} filters.spec3 - Optional spec3 filter value
 * @param {string} filters.spec4 - Optional spec4 filter value
 * @returns {Array<Object>} Array of matching parts with their details
 */
function getPartsByFilters(filters) {
  try {
    if (!filters || !filters.category || !filters.subcategory) {
      return [];
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Get column indices
    const colIndices = {
      partID: headers.indexOf('Part ID'),
      category: headers.indexOf('Category'),
      subcategory: headers.indexOf('Subcategory'),
      partName: headers.indexOf('Part Name'),
      productCode: headers.indexOf('Product Code'),
      spec1: headers.indexOf('Spec 1'),
      spec2: headers.indexOf('Spec 2'),
      spec3: headers.indexOf('Spec 3'),
      spec4: headers.indexOf('Spec 4'),
      quantityPer: headers.indexOf('Quantity Per'),
      cost: headers.indexOf('Cost'),
      location: headers.indexOf('Location/Bin'),
      supplier: headers.indexOf('Supplier')
    };

    // Validate required columns exist
    for (const [key, index] of Object.entries(colIndices)) {
      if (index === -1) {
        Logger.log('Warning: Column not found: ' + key);
      }
    }

    const parts = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Match category and subcategory
      const matchesCategory = row[colIndices.category] &&
                             row[colIndices.category].toString().trim() === filters.category;
      const matchesSubcategory = row[colIndices.subcategory] &&
                                 row[colIndices.subcategory].toString().trim() === filters.subcategory;

      // Match individual spec filters if provided (empty string means "All")
      let matchesSpec1 = true;
      if (filters.spec1 && filters.spec1.trim()) {
        const rowSpec1 = row[colIndices.spec1] ? row[colIndices.spec1].toString().trim() : '';
        matchesSpec1 = rowSpec1 === filters.spec1;
      }

      let matchesSpec2 = true;
      if (filters.spec2 && filters.spec2.trim()) {
        const rowSpec2 = row[colIndices.spec2] ? row[colIndices.spec2].toString().trim() : '';
        matchesSpec2 = rowSpec2 === filters.spec2;
      }

      let matchesSpec3 = true;
      if (filters.spec3 && filters.spec3.trim()) {
        const rowSpec3 = row[colIndices.spec3] ? row[colIndices.spec3].toString().trim() : '';
        matchesSpec3 = rowSpec3 === filters.spec3;
      }

      let matchesSpec4 = true;
      if (filters.spec4 && filters.spec4.trim()) {
        const rowSpec4 = row[colIndices.spec4] ? row[colIndices.spec4].toString().trim() : '';
        matchesSpec4 = rowSpec4 === filters.spec4;
      }

      if (matchesCategory && matchesSubcategory && matchesSpec1 && matchesSpec2 && matchesSpec3 && matchesSpec4) {
        parts.push({
          partID: row[colIndices.partID] || '',
          category: row[colIndices.category] || '',
          subcategory: row[colIndices.subcategory] || '',
          partName: row[colIndices.partName] || '',
          productCode: row[colIndices.productCode] || '',
          spec1: row[colIndices.spec1] || '',
          spec2: row[colIndices.spec2] || '',
          spec3: row[colIndices.spec3] || '',
          spec4: row[colIndices.spec4] || '',
          quantityPer: row[colIndices.quantityPer] || '',
          unitCost: parseFloat(row[colIndices.cost]) || 0,
          location: row[colIndices.location] || '',
          supplier: row[colIndices.supplier] || ''
        });
      }
    }

    return parts.sort((a, b) => a.partName.localeCompare(b.partName));
  } catch (error) {
    Logger.log('Error in getPartsByFilters: ' + error.toString());
    throw new Error('Failed to retrieve parts: ' + error.message);
  }
}

/**
 * Gets parts by product code (case-insensitive exact match)
 * @param {string} productCode - The product code to search for
 * @returns {Array<Object>} Array of matching parts
 */
function getPartsByProductCode(productCode) {
  try {
    if (!productCode) return [];

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Get column indices (same as getPartsByFilters)
    const colIndices = {
      partID: headers.indexOf('Part ID'),
      category: headers.indexOf('Category'),
      subcategory: headers.indexOf('Subcategory'),
      partName: headers.indexOf('Part Name'),
      productCode: headers.indexOf('Product Code'),
      spec1: headers.indexOf('Spec 1'),
      spec2: headers.indexOf('Spec 2'),
      spec3: headers.indexOf('Spec 3'),
      spec4: headers.indexOf('Spec 4'),
      quantityPer: headers.indexOf('Quantity Per'),
      cost: headers.indexOf('Cost'),
      location: headers.indexOf('Location/Bin'),
      supplier: headers.indexOf('Supplier')
    };

    const parts = [];
    const searchCode = productCode.toLowerCase().trim();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowProductCode = row[colIndices.productCode] ? row[colIndices.productCode].toString().trim().toLowerCase() : '';

      if (rowProductCode === searchCode) {
        parts.push({
          partID: row[colIndices.partID] || '',
          category: row[colIndices.category] || '',
          subcategory: row[colIndices.subcategory] || '',
          partName: row[colIndices.partName] || '',
          productCode: row[colIndices.productCode] || '',
          spec1: row[colIndices.spec1] || '',
          spec2: row[colIndices.spec2] || '',
          spec3: row[colIndices.spec3] || '',
          spec4: row[colIndices.spec4] || '',
          quantityPer: row[colIndices.quantityPer] || '',
          unitCost: parseFloat(row[colIndices.cost]) || 0,
          location: row[colIndices.location] || '',
          supplier: row[colIndices.supplier] || ''
        });
      }
    }

    return parts.sort((a, b) => a.partName.localeCompare(b.partName));
  } catch (error) {
    Logger.log('Error in getPartsByProductCode: ' + error.toString());
    throw new Error('Failed to search by product code: ' + error.message);
  }
}

/**
 * Gets the list of students from the roster
 * @returns {Array<string>} Sorted array of student names
 */
function getStudents() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_ORDERS_ID);
    const sheet = ss.getSheetByName(CONFIG.STUDENTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Students sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const students = [];

    // Assuming first column contains student names, skip header
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        students.push(data[i][0].toString().trim());
      }
    }

    return students.sort();
  } catch (error) {
    Logger.log('Error in getStudents: ' + error.toString());
    throw new Error('Failed to retrieve student list: ' + error.message);
  }
}

/**
 * Submits a new parts order
 * @param {Object} orderData - Object containing order details
 * @returns {Object} Success status and order number
 */
function submitOrder(orderData) {
  try {
    // Validate order data
    if (!orderData || !orderData.studentName || !orderData.items || orderData.items.length === 0) {
      throw new Error('Invalid order data provided');
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_ORDERS_ID);
    const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);

    if (!ordersSheet) {
      throw new Error('Orders sheet not found');
    }

    const orderNumber = getNextOrderNumber();
    const timestamp = new Date();
    const totalCost = orderData.totalCost || 0;
    const priority = orderData.priority || 'Medium';
    const notes = orderData.notes || '';

    // Prepare rows for each item in the order
    // Columns: Order #, Date, Student Name, Part ID, Part Name, Category,
    //          Quantity Requested, Priority, Unit Cost, Total Cost, Status, Notes, Monday ID
    const rows = [];
    for (const item of orderData.items) {
      rows.push([
        orderNumber,
        timestamp,
        orderData.studentName,
        item.partID,
        item.partName,
        item.category,
        parseInt(item.quantity) || 0,
        priority,
        parseFloat(item.unitCost) || 0,
        parseFloat(item.totalCost) || 0,
        'Pending',
        notes,
        ''  // Monday ID - populated by Zapier integration
      ]);
    }

    // Append all rows at once
    if (rows.length > 0) {
      ordersSheet.getRange(ordersSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    // Update inventory quantities in Parts Directory
    updateInventoryQuantities(orderData.items);

    return {
      success: true,
      orderNumber: orderNumber,
      message: 'Order submitted successfully'
    };
  } catch (error) {
    Logger.log('Error in submitOrder: ' + error.toString());
    return {
      success: false,
      message: 'Failed to submit order: ' + error.message
    };
  }
}

/**
 * Submits a custom part request
 * @param {Object} requestData - Custom request data
 * @returns {Object} Result with success status and request ID
 */
function submitCustomRequest(requestData) {
  try {
    // Validate request data
    if (!requestData || !requestData.studentName || !requestData.partName) {
      throw new Error('Invalid request data provided');
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_ORDERS_ID);
    const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);

    if (!ordersSheet) {
      throw new Error('Orders sheet not found');
    }

    // Generate unique custom request ID
    const orderNumber = getNextOrderNumber();
    const customID = getNextCustomRequestID();
    const timestamp = new Date();
    const estimatedCost = requestData.estimatedCost || 0;
    const priority = requestData.priority || 'Medium';

    // Combine justification and link in notes
    const notes = `CUSTOM REQUEST - Justification: ${requestData.justification} | Link: ${requestData.partLink}`;

    // Create order row
    // Columns: Order #, Date, Student Name, Part ID, Part Name, Category,
    //          Quantity Requested, Priority, Unit Cost, Total Cost, Status, Notes, Monday ID
    const row = [
      orderNumber,
      timestamp,
      requestData.studentName,
      customID,
      requestData.partName,
      'Custom Request',
      1, // Quantity: always 1 for custom requests
      priority,
      estimatedCost,
      estimatedCost, // Total cost = unit cost for quantity 1
      'Pending',
      notes,
      '' // Monday ID - populated by Zapier
    ];

    // Append row
    ordersSheet.appendRow(row);

    return {
      success: true,
      requestID: customID,
      orderNumber: orderNumber,
      message: 'Custom request submitted successfully'
    };
  } catch (error) {
    Logger.log('Error in submitCustomRequest: ' + error.toString());
    return {
      success: false,
      message: 'Failed to submit custom request: ' + error.message
    };
  }
}

/**
 * Gets the next custom request ID
 * @returns {string} Next custom request ID (e.g., "CUSTOM-001")
 */
function getNextCustomRequestID() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_ORDERS_ID);
    const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);

    if (!ordersSheet) {
      return 'CUSTOM-001';
    }

    const data = ordersSheet.getDataRange().getValues();
    let maxCustomNum = 0;

    // Find highest CUSTOM-### number
    for (let i = 1; i < data.length; i++) {
      const partID = data[i][3]; // Part ID column
      if (partID && partID.toString().startsWith('CUSTOM-')) {
        const numStr = partID.toString().replace('CUSTOM-', '');
        const num = parseInt(numStr);
        if (!isNaN(num) && num > maxCustomNum) {
          maxCustomNum = num;
        }
      }
    }

    // Generate next ID
    const nextNum = maxCustomNum + 1;
    return 'CUSTOM-' + nextNum.toString().padStart(3, '0');
  } catch (error) {
    Logger.log('Error in getNextCustomRequestID: ' + error.toString());
    return 'CUSTOM-001';
  }
}

/**
 * Updates inventory quantities after an order is placed
 * @param {Array<Object>} items - Array of ordered items
 */
function updateInventoryQuantities(items) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const partIDCol = headers.indexOf('Part ID');
    const quantityCol = headers.indexOf('Quantity in Stock');

    if (partIDCol === -1 || quantityCol === -1) {
      throw new Error('Required columns not found');
    }

    // Create a map of part IDs to ordered quantities
    const orderQuantities = {};
    for (const item of items) {
      orderQuantities[item.partID] = (orderQuantities[item.partID] || 0) + parseInt(item.quantity);
    }

    // Update quantities
    for (let i = 1; i < data.length; i++) {
      const partID = data[i][partIDCol];
      if (partID && orderQuantities[partID]) {
        const currentQty = parseInt(data[i][quantityCol]) || 0;
        const newQty = Math.max(0, currentQty - orderQuantities[partID]);
        sheet.getRange(i + 1, quantityCol + 1).setValue(newQty);
      }
    }
  } catch (error) {
    Logger.log('Error in updateInventoryQuantities: ' + error.toString());
    // Don't throw error to prevent order submission failure
  }
}

/**
 * Submits a request for a new part to be added to inventory
 * @param {Object} partData - Object containing new part request details
 * @returns {Object} Success status and message
 */
function submitNewPartRequest(partData) {
  try {
    // Validate part data
    if (!partData || !partData.partName || !partData.category) {
      throw new Error('Invalid part data provided');
    }

    // Check for duplicates
    const duplicateCheck = checkForDuplicates(partData.partName);
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: 'A similar part already exists: ' + duplicateCheck.existingPart,
        isDuplicate: true
      };
    }

    // Add the part to directory
    const result = addPartToDirectory(partData);

    return result;
  } catch (error) {
    Logger.log('Error in submitNewPartRequest: ' + error.toString());
    return {
      success: false,
      message: 'Failed to submit part request: ' + error.message
    };
  }
}

/**
 * Adds a new part to the parts directory
 * @param {Object} partData - Object containing part details
 * @returns {Object} Success status, part ID, and message
 */
function addPartToDirectory(partData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    // Generate new Part ID
    const partID = generatePartID(partData.category);

    // Prepare the new row matching Parts sheet structure:
    // Part ID, Part Name, Category, Subcategory, Product Code, Spec 1, Spec 2, Spec 3, Spec 4,
    // Quantity Per, Cost, Supplier, Order Link, Location/Bin, Notes, Status, Date Added, Added By
    const newRow = [
      partID,
      partData.partName,
      partData.category,
      partData.subcategory || '',
      partData.productCode || '',
      partData.spec1 || '-',
      partData.spec2 || '-',
      partData.spec3 || '-',
      partData.spec4 || '-',
      parseInt(partData.quantity) || 0,
      parseFloat(partData.unitCost) || 0,
      partData.supplier || '',
      partData.supplierPartNumber || '',
      partData.storageLocation || '',
      partData.notes || '',
      'Active',  // Status
      new Date(),  // Date added
      Session.getActiveUser().getEmail() || 'System'  // Added by
    ];

    // Append the new part
    sheet.appendRow(newRow);

    return {
      success: true,
      partID: partID,
      message: 'Part added successfully with ID: ' + partID
    };
  } catch (error) {
    Logger.log('Error in addPartToDirectory: ' + error.toString());
    return {
      success: false,
      message: 'Failed to add part: ' + error.message
    };
  }
}

/**
 * Generates a sequential Part ID based on category
 * Format: CATEGORY-XXX (e.g., FAST-001, ELEC-015)
 * @param {string} category - The category for the part
 * @returns {string} The generated Part ID
 */
function generatePartID(category) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    // Create category prefix (first 4 letters, uppercase)
    const prefix = category.substring(0, 4).toUpperCase();

    // Get all existing Part IDs
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const partIDCol = headers.indexOf('Part ID');

    if (partIDCol === -1) {
      throw new Error('Part ID column not found');
    }

    // Find highest number for this category prefix
    let maxNumber = 0;
    const prefixPattern = new RegExp('^' + prefix + '-(\\d+)$');

    for (let i = 1; i < data.length; i++) {
      const partID = data[i][partIDCol];
      if (partID) {
        const match = partID.toString().match(prefixPattern);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }

    // Generate next sequential number
    const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
    return prefix + '-' + nextNumber;
  } catch (error) {
    Logger.log('Error in generatePartID: ' + error.toString());
    throw new Error('Failed to generate Part ID: ' + error.message);
  }
}

/**
 * Checks if a part name already exists in the directory
 * @param {string} partName - The part name to check
 * @returns {Object} Object with isUnique flag and existing part info if found
 */
function checkForDuplicates(partName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const partNameCol = headers.indexOf('Part Name');
    const partIDCol = headers.indexOf('Part ID');

    if (partNameCol === -1) {
      throw new Error('Part Name column not found');
    }

    const searchName = partName.toLowerCase().trim();

    // Check for exact or similar matches
    for (let i = 1; i < data.length; i++) {
      const existingName = data[i][partNameCol];
      if (existingName) {
        const existingNameLower = existingName.toString().toLowerCase().trim();

        // Check for exact match or high similarity
        if (existingNameLower === searchName) {
          const existingPartID = data[i][partIDCol] || 'Unknown';
          return {
            isUnique: false,
            existingPart: existingName + ' (' + existingPartID + ')'
          };
        }

        // Check for substring match (potential duplicate)
        if (existingNameLower.includes(searchName) || searchName.includes(existingNameLower)) {
          if (searchName.length > 5 && existingNameLower.length > 5) {
            const existingPartID = data[i][partIDCol] || 'Unknown';
            return {
              isUnique: false,
              existingPart: existingName + ' (' + existingPartID + ')',
              warning: 'Similar part found'
            };
          }
        }
      }
    }

    return { isUnique: true };
  } catch (error) {
    Logger.log('Error in checkForDuplicates: ' + error.toString());
    // Return true to allow operation to continue
    return { isUnique: true };
  }
}

/**
 * Generates the next sequential order number
 * Format: ORD-YYYYMMDD-XXX (e.g., ORD-20250127-001)
 * @returns {string} The generated order number
 */
function getNextOrderNumber() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.PARTS_ORDERS_ID);
    const sheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Orders sheet not found');
    }

    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
    const prefix = 'ORD-' + dateStr + '-';

    // Get all existing order numbers
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderNumCol = headers.indexOf('Order Number');

    if (orderNumCol === -1) {
      // If column not found, return first order of the day
      return prefix + '001';
    }

    // Find highest sequence number for today
    let maxSequence = 0;
    const prefixPattern = new RegExp('^' + prefix.replace(/[-]/g, '\\-') + '(\\d+)$');

    for (let i = 1; i < data.length; i++) {
      const orderNum = data[i][orderNumCol];
      if (orderNum) {
        const match = orderNum.toString().match(prefixPattern);
        if (match) {
          const seq = parseInt(match[1]);
          if (seq > maxSequence) {
            maxSequence = seq;
          }
        }
      }
    }

    // Generate next sequential number
    const nextSequence = (maxSequence + 1).toString().padStart(3, '0');
    return prefix + nextSequence;
  } catch (error) {
    Logger.log('Error in getNextOrderNumber: ' + error.toString());
    // Return a fallback order number
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
    return 'ORD-' + dateStr + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }
}

/**
 * Validates the access password for adding parts
 * @param {string} password - The password to validate
 * @returns {Object} Object with isValid flag
 */
function validateAccess(password) {
  try {
    const isValid = password === CONFIG.ADD_PART_PASSWORD;
    return { isValid: isValid };
  } catch (error) {
    Logger.log('Error in validateAccess: ' + error.toString());
    return { isValid: false };
  }
}

/**
 * Gets specifications options for a given category and subcategory
 * Used for the Add Part form to show existing specifications
 * @param {string} category - The category to filter by
 * @param {string} subcategory - The subcategory to filter by
 * @returns {Array<string>} Array of unique specifications
 */
function getSpecifications(category, subcategory) {
  try {
    if (!category || !subcategory) {
      return [];
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const categoryCol = headers.indexOf('Category');
    const subcategoryCol = headers.indexOf('Subcategory');
    const specificationsCol = headers.indexOf('Specifications');

    if (categoryCol === -1 || subcategoryCol === -1 || specificationsCol === -1) {
      return [];
    }

    const specifications = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryCol] &&
          data[i][categoryCol].toString().trim() === category &&
          data[i][subcategoryCol] &&
          data[i][subcategoryCol].toString().trim() === subcategory &&
          data[i][specificationsCol]) {
        specifications.add(data[i][specificationsCol].toString().trim());
      }
    }

    return Array.from(specifications).sort();
  } catch (error) {
    Logger.log('Error in getSpecifications: ' + error.toString());
    return [];
  }
}

/**
 * Gets spec configuration for a category/subcategory
 * Returns the labels and requirements for each spec field
 * @param {string} category - The category name
 * @param {string} subcategory - The subcategory name
 * @returns {Object} Spec configuration object with labels and requirements
 */
function getSpecConfig(category, subcategory) {
  try {
    if (!category || !subcategory) {
      return null;
    }

    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'specConfig_' + category + '_' + subcategory;
    const cached = cache.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        Logger.log('Cache parse error in getSpecConfig: ' + error.message);
      }
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.SPEC_CONFIG_SHEET_NAME);

    if (!sheet) {
      throw new Error('Spec Config sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Get column indices
    const categoryCol = headers.indexOf('Category');
    const subcategoryCol = headers.indexOf('Subcategory');
    const spec1LabelCol = headers.indexOf('Spec1_Label');
    const spec2LabelCol = headers.indexOf('Spec2_Label');
    const spec3LabelCol = headers.indexOf('Spec3_Label');
    const spec4LabelCol = headers.indexOf('Spec4_Label');
    const spec1RequiredCol = headers.indexOf('Spec1_Required');
    const spec2RequiredCol = headers.indexOf('Spec2_Required');
    const spec3RequiredCol = headers.indexOf('Spec3_Required');
    const spec4RequiredCol = headers.indexOf('Spec4_Required');

    // Find matching row
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryCol] &&
          data[i][categoryCol].toString().trim() === category &&
          data[i][subcategoryCol] &&
          data[i][subcategoryCol].toString().trim() === subcategory) {

        const config = {
          spec1Label: data[i][spec1LabelCol] ? data[i][spec1LabelCol].toString().trim() : '',
          spec2Label: data[i][spec2LabelCol] ? data[i][spec2LabelCol].toString().trim() : '',
          spec3Label: data[i][spec3LabelCol] ? data[i][spec3LabelCol].toString().trim() : '',
          spec4Label: data[i][spec4LabelCol] ? data[i][spec4LabelCol].toString().trim() : '',
          spec1Required: data[i][spec1RequiredCol] === 'Y',
          spec2Required: data[i][spec2RequiredCol] === 'Y',
          spec3Required: data[i][spec3RequiredCol] === 'Y',
          spec4Required: data[i][spec4RequiredCol] === 'Y'
        };

        // Cache for 5 minutes
        try {
          cache.put(cacheKey, JSON.stringify(config), 300);
        } catch (error) {
          Logger.log('Cache storage error: ' + error.message);
        }

        return config;
      }
    }

    // No config found for this category/subcategory combination
    return null;
  } catch (error) {
    Logger.log('Error in getSpecConfig: ' + error.toString());
    throw new Error('Failed to retrieve spec configuration: ' + error.message);
  }
}

/**
 * Gets unique values for a specific spec field for a category/subcategory
 * Used to populate spec filter dropdowns dynamically
 * @param {string} category - The category name
 * @param {string} subcategory - The subcategory name
 * @param {number} specNumber - Which spec (1, 2, 3, or 4)
 * @returns {Array<string>} Sorted unique values for the spec field
 */
function getSpecValues(category, subcategory, specNumber) {
  try {
    if (!category || !subcategory || !specNumber || specNumber < 1 || specNumber > 4) {
      return [];
    }

    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'specValues_' + category + '_' + subcategory + '_' + specNumber;
    const cached = cache.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        Logger.log('Cache parse error in getSpecValues: ' + error.message);
      }
    }

    const ss = SpreadsheetApp.openById(CONFIG.PARTS_DIRECTORY_ID);
    const sheet = ss.getSheetByName(CONFIG.PARTS_SHEET_NAME);

    if (!sheet) {
      throw new Error('Parts sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Get column indices
    const categoryCol = headers.indexOf('Category');
    const subcategoryCol = headers.indexOf('Subcategory');
    const specCol = headers.indexOf('Spec ' + specNumber);

    if (categoryCol === -1 || subcategoryCol === -1 || specCol === -1) {
      return [];
    }

    const values = new Set();

    // Collect unique non-empty values for this spec
    for (let i = 1; i < data.length; i++) {
      if (data[i][categoryCol] &&
          data[i][categoryCol].toString().trim() === category &&
          data[i][subcategoryCol] &&
          data[i][subcategoryCol].toString().trim() === subcategory &&
          data[i][specCol] &&
          data[i][specCol].toString().trim() !== '') {
        values.add(data[i][specCol].toString().trim());
      }
    }

    const result = Array.from(values).sort();

    // Cache for 5 minutes
    try {
      cache.put(cacheKey, JSON.stringify(result), 300);
    } catch (error) {
      Logger.log('Cache storage error: ' + error.message);
    }

    return result;
  } catch (error) {
    Logger.log('Error in getSpecValues: ' + error.toString());
    return [];
  }
}
