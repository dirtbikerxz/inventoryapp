# DVOM Robotics Parts System Requirements

## Team Information
- **Team Number**: 8044
- **Team Name**: Denham Venom
- **Colors**: 
  - Primary: LSU Purple (#461D7C)
  - Secondary: LSU Gold (#FDD023)
- **Location**: Denham Springs, Louisiana
- **Logo**: [To be added later]

## System Overview
A comprehensive parts ordering and inventory management system for FRC Team 8044, consisting of:
- Google Sheets-based parts directory and order tracking
- Custom Google Apps Script web application for ordering
- Dynamic form with intelligent cascading dropdowns
- Parts directory management form for adding new parts
- Integration capability with Monday.com via Zapier for order management

## Project Structure

### Google Spreadsheets (2 separate sheets)

#### 1. "Denham Venom Parts Directory"
**Purpose**: Master catalog of all available parts

**Sheets/Tabs**:
- **Parts** (Main inventory)
  - Part ID (auto-generated: FAST-001, ELEC-001, etc.)
  - Part Name
  - Category
  - Subcategory
  - Type (for applicable categories)
  - Size/Specification 1 (context-dependent)
  - Specification 2 (context-dependent)
  - Quantity Per (Box of 100, Each, 6ft length, etc.)
  - Cost (per unit)
  - Supplier
  - Order Link
  - Location/Bin
  - Notes (usage restrictions, FRC legal, safety notes)
  - Status (Active/Discontinued)
  - Date Added (auto-timestamp)
  - Added By (from form submission)

- **Categories** (Reference table)
  - Category Name
  - Code
  - Sort Order

#### 2. "Denham Venom Parts Orders"
**Purpose**: Track all part orders and requests

**Sheets/Tabs**:
- **Orders** (Active orders)
  - Order # (auto-generated: ORD-YYYYMMDD-XXX)
  - Date (auto-timestamp)
  - Student Name
  - Part ID
  - Part Name (auto-filled via VLOOKUP)
  - Category (auto-filled via VLOOKUP)
  - Quantity Requested
  - Priority (Low/Medium/High/Urgent)
  - Unit Cost (auto-filled via VLOOKUP)
  - Total Cost (formula: Quantity * Unit Cost)
  - Status (Requested/Approved/Ordered/Received)
  - Notes
  - Monday ID (from Zapier integration)

- **Students** (Team roster)
  - Name
  - Subteam
  - Active (Y/N)

- **New Parts** (Requests for parts not in directory)
  - Date
  - Student Name
  - Part Name
  - Category
  - Estimated Cost
  - Where to Buy
  - Link
  - Status (Pending/Added to Directory/Denied)

## Categories and Subcategorization

### Categories with Codes:
```json
[
  {"name": "Fasteners", "code": "FAST"},
  {"name": "Electronics and Sensors", "code": "ELEC"},
  {"name": "Raw Stock", "code": "STOCK"},
  {"name": "Movement", "code": "MOVE"},
  {"name": "Build Site Equipment", "code": "BSITE"},
  {"name": "Pneumatics", "code": "PNEU"},
  {"name": "Business, Outreach, Media", "code": "BUSI"},
  {"name": "Machining Tools", "code": "MACH"},
  {"name": "Safety Equipment", "code": "SAFE"},
  {"name": "Wiring, Cables, Connectors", "code": "WIRE"}
]
```

### Dynamic Subcategorization System

#### Fasteners Category:
- **Subcategories**: Screws, Nuts, Washers, Rivets, Adhesive
- **For Screws**: 
  - Type: Socket Head, Button Head, Flat Head, Hex Head (dynamically populated from inventory)
  - Size: 8-32, 10-24, 1/4-20, M3, M4, etc. (only shows sizes in inventory)
  - Length: 0.5", 0.75", 1", 1.5", 2" (only shows available lengths)
  - Material: Steel, Stainless Steel, Aluminum (only if in inventory)
- **For Nuts**: 
  - Type: Hex, Lock, Wing (from inventory)
  - Size: Matching thread sizes
  - Material: As available
- **For Washers**: Type, Size, Material as available
- **For Rivets**: Type, Size, Material as available

#### Raw Stock Category:
- **Subcategories**: Aluminum, Polycarbonate, Steel, Other
- **Dynamic specifications**:
  - Form: Sheet, Tube, Angle, Bar, Rod (based on inventory)
  - Size 1: Thickness/Diameter
  - Size 2: Width/Length
  - Only shows materials and sizes actually in stock

#### Wiring, Cables, Connectors Category:
- **Subcategories**: Wires, Cables, Connectors
- **For Wires**:
  - Type: Power, Signal, CAN (from inventory)
  - Gauge: 10AWG, 12AWG, 14AWG, 16AWG, 18AWG (only available gauges)
  - Length: 10ft, 25ft, 50ft, 100ft (only available lengths)
  - Color: As available

## Web Application Forms

### 1. Parts Order Form
**Purpose**: Students order parts from existing directory

#### Features:
1. **Student Selection**: Dropdown populated from Students sheet
2. **Category Selection**: Primary category choice
3. **Dynamic Subcategory**: Shows only if applicable, populated from actual inventory
4. **Smart Part Filtering**: 
   - Cascading dropdowns that narrow based on selections
   - Only shows combinations that exist in inventory
   - Example: Select Fasteners → Screws → 8-32 → Only shows available lengths for 8-32 screws
5. **Part Information Display**:
   - Shows Quantity Per (Box of 100, etc.)
   - Shows unit cost
   - Shows notes/warnings
   - Calculates and displays total cost
6. **Order Details**:
   - Quantity input (validated 1-999)
   - Priority selection (Low/Medium/High/Urgent)
   - Notes field (optional)
7. **New Part Request Option**:
   - Checkbox: "Can't find your part?"
   - Opens additional fields for new part details
   - Required justification field

#### Validation:
- Student must exist in roster
- Quantity must be numeric, 1-999
- All required fields must be filled
- Warning if total cost > $100

### 2. Add Part to Directory Form
**Purpose**: Authorized users add new parts to the directory

#### Access Control:
- Password protection or authorized user list
- Only team captains/officers and advisors

#### Fields:
1. **Part Information**:
   - Part Name (required)
   - Category (dropdown)
   - Subcategory (text input or dropdown based on category)
   - Type (optional, for applicable categories)
   - Size/Spec 1 (optional)
   - Specification 2 (optional)
2. **Purchasing Information**:
   - Quantity Per (required - e.g., "Box of 100", "Each")
   - Cost per unit (required)
   - Supplier (required)
   - Order Link (optional but recommended)
3. **Inventory Information**:
   - Location/Bin (required)
   - Initial Status (Active/Discontinued)
   - Notes (optional - safety, usage, restrictions)
4. **Metadata**:
   - Added By (auto-captured or input)
   - Date Added (auto-timestamp)

#### Features:
- Part ID auto-generation based on category (FAST-001, ELEC-002)
- Duplicate checking (warns if similar part exists)
- Preview before submission
- Success confirmation with new Part ID

### Form Design (Both Forms):
- Mobile-responsive
- LSU Purple header with gold accents
- Team 8044 Denham Venom branding
- Clear, easy-to-read fonts
- Loading spinner during data fetches
- Success/error messages
- Tab navigation between forms

## Technical Implementation

### What Claude Code Will Build:

#### `/src/Code.js` - Main server-side logic
- `doGet(e)` - Serves the web app, routes to correct form based on URL parameter
- `getCategories()` - Returns category list
- `getSubcategories(category)` - Returns dynamic subcategories
- `getPartsByFilters(category, subcategory, specifications)` - Smart filtering
- `getStudents()` - Returns student roster
- `submitOrder(orderData)` - Processes form submission
- `submitNewPartRequest(partData)` - Handles new part requests
- `addPartToDirectory(partData)` - Adds new part to directory
- `generatePartID(category)` - Creates next sequential part ID
- `checkForDuplicates(partName)` - Checks for similar parts
- `getNextOrderNumber()` - Generates order numbers
- `validateAccess(password)` - For add part form security

#### `/src/FormHandler.js` - Form processing
- Form validation functions
- Data sanitization
- Error handling
- Success message generation

#### `/src/DataAccess.js` - Sheet operations
- Read operations with caching
- Write operations with error handling
- VLOOKUP formula management
- Data validation
- Part ID generation logic

#### `/src/WebApp.html` - Complete web interface
- HTML structure with both forms
- Tab/page navigation between Order Form and Add Part Form
- CSS styling with LSU Purple/Gold theme
- JavaScript for dynamic dropdowns
- AJAX calls to server functions
- Real-time cost calculation
- Form validation
- Success/error handling
- Access control for Add Part form

#### `/setup/createSheets.js` - Sheet creation script
- Reads config.json
- Creates both Google Sheets
- Sets up all headers
- Adds formulas
- Sets data validation
- Applies conditional formatting
- Returns spreadsheet IDs

#### `/setup/populateData.js` - Initial data loader
- Reads CSV files from /data
- Populates sheets with sample data
- Validates data integrity

### What YOU Will Do:
1. **Initial Setup**:
   - Run `npm install` to install dependencies
   - Run `clasp login` to authenticate
   - Enable Google Apps Script API at https://script.google.com/home/usersettings

2. **After Claude Code generates files**:
   - Run `npm run setup` to create Google Sheets
   - Copy the generated spreadsheet IDs to Code.js
   - Run `clasp push` to deploy code
   - Run `clasp deploy` to create deployment
   - Run `clasp open --webapp` to test

3. **External Integrations**:
   - Set up Zapier connection between Google Sheets and Monday.com
   - Share form URLs with team (separate links for Order and Add Part forms)
   - Set up access control list or password for Add Part form

## Special Instructions for Claude Code

### IMPORTANT: Use Agents When Necessary
- Use agents for complex multi-file operations
- Use agents for testing and validation
- Use agents for iterative improvements

### Development Approach:
1. Read all files in /setup/config.json and /data/*.csv first
2. Build complete, production-ready code (not examples or templates)
3. Include comprehensive error handling
4. Add JSDoc comments for all functions
5. Make code maintainable and scalable
6. Test all formulas and validations
7. Ensure mobile responsiveness
8. Implement both forms with clear navigation between them

### Dynamic Filtering Implementation:
- The form should query the Parts sheet to build dropdown options
- Never hard-code subcategories or specifications
- Use `getDataRange()` and filter to find unique values
- Cache results for performance
- Only show combinations that actually exist

### Example Dynamic Query:
```javascript
// For Fasteners → Screws → Size options
// Should return only sizes where Category="Fasteners" AND Subcategory="Screws"
// Not hard-coded list
```

### Form Navigation:
- URL parameters to switch between forms: `?form=order` or `?form=addpart`
- Or implement as tabs within single page
- Clear visual distinction between forms
- Breadcrumb or navigation showing current form

## Success Criteria
1. Students can order existing parts in under 30 seconds
2. New parts can be added to directory with all required information
3. Part IDs generate correctly and sequentially
4. No invalid orders can be submitted
5. Dynamic dropdowns show only valid options
6. System handles 5-10 concurrent users smoothly
7. Mobile-friendly interface for both forms
8. Clear audit trail of all orders and who added parts
9. Access control works for Add Part form
10. Monday.com receives all necessary order data via Zapier

## Files to Generate

Claude Code should create/update these files:
- `/src/Code.js` - Complete server code with both form handlers
- `/src/FormHandler.js` - Form processing for both forms
- `/src/DataAccess.js` - Data operations including part management
- `/src/WebApp.html` - Full web interface with both forms
- `/setup/createSheets.js` - Sheet creation
- `/setup/populateData.js` - Data population
- `/setup/config.json` - Updated with team info and structure
- `/data/parts.csv` - Sample parts with new categories
- `/data/categories.csv` - Category reference
- `/data/students.csv` - Sample roster
- `/docs/README.md` - Setup and usage instructions

## Testing Requirements
1. **Order Form Testing**:
   - Test with sample data for all categories
   - Verify cascading dropdowns work correctly
   - Ensure formulas calculate properly
   - Check mobile responsiveness
   - Validate error messages appear
   - Confirm new part requests work

2. **Add Part Form Testing**:
   - Test part ID generation
   - Verify all fields save correctly
   - Check duplicate detection
   - Test access control
   - Verify new parts appear in order form

3. **System Testing**:
   - Test with 5-10 simultaneous users
   - Verify data integrity with concurrent submissions
   - Check that Zapier can access order data correctly
   - Ensure both forms work on mobile devices

## Monday.com Integration Notes
- Order management and status tracking happens in Monday.com
- Google Sheets serves as data source and initial capture
- Zapier handles the data transfer
- No need for complex notification system in Google Apps Script
- Focus on clean data capture and structure