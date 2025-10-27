# Claude Code Context - Denham Venom Robotics Parts System

## CRITICAL INSTRUCTIONS FOR CLAUDE CODE
1. **USE AGENTS**: Always use available agents for complex tasks, file operations, and testing
2. **AGENT LIMIT**: Maximum 3 concurrent agents at any time to maintain system stability
3. **NO EMOJIS**: Do not use emojis anywhere - not in code, comments, user interfaces, test data, documentation, or narrative responses
4. **PROFESSIONAL TONE**: Maintain clean, professional communication throughout all components

## Project Overview
Building a parts ordering system for FRC Team 8044 (Denham Venom) using Google Apps Script, Google Sheets, and integration with Monday.com via Zapier.

## Current Project State
- [x] Project structure created
- [x] CLASP configured and working
- [x] Requirements documented in requirements.md
- [ ] Config.json needs team-specific updates
- [ ] Google Sheets creation script needed
- [ ] Apps Script web app not yet built
- [ ] Sample data files empty
- [ ] Monday.com integration pending

## Agent Usage Guidelines
### When to Use Agents:
- **File Operations**: Creating/updating multiple files simultaneously
- **Testing**: Running comprehensive test suites
- **Data Generation**: Creating sample CSV data
- **Code Validation**: Checking syntax and logic across files
- **Documentation**: Updating README and related docs

### Agent Allocation Strategy:
- **Agent 1**: Primary development (Code.js, WebApp.html)
- **Agent 2**: Secondary files (FormHandler.js, DataAccess.js)
- **Agent 3**: Setup scripts and data files
- **Never exceed 3 agents running simultaneously**
- **Wait for agent completion before spawning new ones if at limit**

## Key Files to Read First
1. `requirements.md` - Complete system specifications
2. `setup/config.json` - Project configuration (needs updating)
3. `package.json` - NPM scripts and dependencies

## Tech Stack
- **Frontend**: HTML/CSS/JavaScript in Google Apps Script
- **Backend**: Google Apps Script (JavaScript)
- **Database**: Google Sheets (2 spreadsheets)
- **Deployment**: CLASP (Command Line Apps Script)
- **Integration**: Zapier → Monday.com
- **Version Control**: Git

## Team Branding
- **Team**: 8044 Denham Venom
- **Colors**: LSU Purple (#461D7C), LSU Gold (#FDD023)
- **Location**: Denham Springs, Louisiana
- **Style Guide**: Professional, clean, no decorative elements or emojis

## Project Structure
```
DVOM/
├── requirements.md      # Full specifications
├── claude.md           # This file
├── src/                # Apps Script source
│   ├── Code.js        # Server-side logic (EMPTY)
│   ├── FormHandler.js # Form processing (EMPTY)
│   ├── DataAccess.js  # Sheet operations (EMPTY)
│   ├── WebApp.html    # Web interface (EMPTY)
│   └── appsscript.json # Manifest
├── setup/              # Setup scripts
│   ├── config.json    # Needs team updates
│   ├── createSheets.js # (EMPTY)
│   └── populateData.js # (EMPTY)
├── data/              # Sample data
│   ├── parts.csv      # (EMPTY)
│   ├── categories.csv # (EMPTY)
│   └── students.csv   # (EMPTY)
└── docs/
    └── README.md      # (BASIC)
```

## NPM Scripts Available
- `npm run setup` - Creates Google Sheets (after createSheets.js is written)
- `npm run push` - Deploy code to Google (uses clasp push)
- `npm run pull` - Pull from Google
- `npm run deploy` - Create new deployment
- `npm run open` - Open web app
- `npm run logs` - View execution logs
- `npm run init-data` - Populate initial data

## Development Workflow
1. Make changes to files in /src
2. Run `npm run push` to deploy to Google
3. Run `npm run open` to test
4. Check `npm run logs` for debugging

## Google Sheets Structure

### Sheet 1: "Denham Venom Parts Directory"
- Parts catalog with dynamic subcategories
- Categories: Fasteners, Electronics and Sensors, Raw Stock, Movement, Build Site Equipment, Pneumatics, Business/Outreach/Media, Machining Tools, Safety Equipment, Wiring/Cables/Connectors

### Sheet 2: "Denham Venom Parts Orders"
- Order tracking
- Student roster
- New part requests

## Features to Implement

### Phase 1 - Core System (PRIORITY)
1. Update config.json with team info and categories
2. Create Google Sheets programmatically
3. Build order form with cascading dropdowns
4. Implement dynamic filtering based on inventory
5. Add part submission to Orders sheet

### Phase 2 - Part Management
1. Add Part to Directory form
2. Part ID auto-generation
3. Access control for adding parts
4. Duplicate detection

### Phase 3 - Enhanced Features
1. Subcategory filtering for Fasteners (Size, Type, Length)
2. Raw Stock specifications (Material, Dimensions)
3. Wire specifications (Gauge, Length)
4. Mobile optimization

## Code Style Requirements
- **NO EMOJIS** in any context
- **Clean Comments**: Use professional technical language
- **User Messages**: Clear, concise, no decorative characters
- **Test Data**: Professional part names and descriptions
- **Documentation**: Technical writing style only
- **Success/Error Messages**: Simple text, no symbols
- **Loading Indicators**: Use text like "Loading..." not spinners with emojis

## Important Constraints
- Must handle 5-10 concurrent users
- All dropdowns must be dynamic (pulled from actual inventory)
- Two forms needed: Order Parts and Add Parts
- Integration with Monday.com via Zapier (data structure must support this)
- Mobile-responsive design required
- Professional appearance - no casual or decorative elements

## Authentication & Deployment
- Google account authenticated via CLASP
- Script ID stored in .clasp.json
- Deployment as web app with anonymous access for order form
- Add Part form needs password protection

## Common Tasks for Claude Code

### To build the entire system:
"Read requirements.md and build the complete system according to specifications. Use agents for parallel file creation but limit to 3 concurrent agents."

### To update specific components:
"Update the order form to include subcategory filtering for Fasteners"
"Add mobile responsive CSS to WebApp.html"
"Create the Add Part to Directory form with access control"

### To fix issues:
"Debug why the cascading dropdowns aren't populating"
"Fix VLOOKUP formulas in the Orders sheet"

### To test:
"Add comprehensive error handling to all server functions"
"Create test data for all 10 categories - use professional part names only"

## External Dependencies
- Google Apps Script API (must be enabled)
- Google Sheets API (for setup scripts)
- CLASP (installed globally via npm)
- Zapier account (for Monday.com integration)

## DO NOT MODIFY
- .clasp.json (contains script ID)
- node_modules/ (managed by npm)

## Notes for Claude Code
1. Always read requirements.md first for complete specifications
2. Use agents for parallel work but never exceed 3 concurrent
3. No emojis or decorative characters anywhere in the system
4. The system serves one team, not multiple teams
5. Monday.com handles order management after submission
6. Focus on data capture and structure, not complex workflows
7. Use JSDoc comments for all functions
8. Include error handling for all user inputs
9. Cache Sheet data when possible for performance
10. Maintain professional tone in all user-facing text

## UI Text Standards
### Success Messages:
- Correct: "Order submitted successfully"
- Incorrect: "✅ Order submitted successfully! 🎉"

### Error Messages:
- Correct: "Error: Invalid quantity entered"
- Incorrect: "❌ Oops! That quantity won't work 😕"

### Loading States:
- Correct: "Loading parts catalog..."
- Incorrect: "⏳ Loading parts catalog..."

### Button Text:
- Correct: "Submit Order"
- Incorrect: "Submit Order →"

## Current Issues/Blockers
- None yet - project just initialized

## Testing Checklist
- [ ] Forms load on mobile devices
- [ ] Cascading dropdowns filter correctly
- [ ] Part IDs generate sequentially
- [ ] Orders save to correct sheet
- [ ] VLOOKUP formulas work
- [ ] Access control functions for Add Part form
- [ ] Zapier can read order data
- [ ] No emojis appear anywhere in the system
- [ ] All text maintains professional tone

## Agent Task Distribution Example
```
Agent 1: Create/Update Core Files
- src/Code.js
- src/WebApp.html

Agent 2: Create Supporting Files
- src/FormHandler.js
- src/DataAccess.js

Agent 3: Create Setup and Data Files
- setup/createSheets.js
- setup/populateData.js
- data/*.csv files
```

## Questions for Team
- Logo file/URL needed
- Specific bin/location naming convention?
- Password for Add Part form or user list?
- Supplier preferences?

## Last Updated
[Current date - update when making changes]

## Quick Start for Claude Code
1. Read this file (claude.md)
2. Read requirements.md for full specs
3. Check setup/config.json current state
4. Spawn up to 3 agents for parallel development
5. Build missing components with no emoji usage
6. Test with `npm run push` and `npm run open`
7. Verify professional appearance throughout