const boardEl = document.getElementById("board");
const boardBtn = document.getElementById("board-view-btn");
const tableBtn = document.getElementById("table-view-btn");
const boardSection = document.getElementById("board-section");
const tableSection = document.getElementById("table-section");
const stockSection = document.getElementById("stock-section");
const reimbursementsSection = document.getElementById("reimbursements-section");
const stockGrid = document.getElementById("stock-grid");
const reimbursementsTable = document.getElementById("reimbursements-table");
const stockSubteamFilter = document.getElementById("stock-subteam-filter");
const primaryTitle = document.getElementById("primary-title");
const primarySubtitle = document.getElementById("primary-subtitle");
const ordersViewBtn = document.getElementById("orders-view-btn");
const reimbursementsViewBtn = document.getElementById("reimbursements-view-btn");
const stockViewBtn = document.getElementById("stock-view-btn");
const ordersLayoutRow = document.getElementById("orders-layout-row");
const ordersLayoutToggle = document.getElementById("orders-layout-toggle");
const ordersActions = document.getElementById("orders-actions");
const stockActions = document.getElementById("stock-actions");
const addStockBtn = document.getElementById("add-stock-btn");
const manageSubteamsBtn = document.getElementById("manage-subteams-btn");
const refreshBtn = document.getElementById("refresh-btn");
const globalSearch = document.getElementById("global-search");
const statusFilter = document.getElementById("status-filter");
const vendorFilter = document.getElementById("vendor-filter");
const startDate = document.getElementById("start-date");
const endDate = document.getElementById("end-date");
const tableContainer = document.getElementById("table-container");
const selectionBar = document.getElementById("selection-bar");
const selectionCount = document.getElementById("selection-count");
const groupVendorNote = document.getElementById("group-vendor-note");
const selectAllBtn = document.createElement("button");
selectAllBtn.id = "select-all-btn";
selectAllBtn.className = "btn ghost";
selectAllBtn.textContent = "Select all";
const selectSameVendorBtn = document.createElement("button");
selectSameVendorBtn.id = "select-same-vendor-btn";
selectSameVendorBtn.className = "btn ghost";
selectSameVendorBtn.textContent = "Select Vendor";
const unselectAllBtn = document.createElement("button");
unselectAllBtn.id = "unselect-all-btn";
unselectAllBtn.className = "btn ghost";
unselectAllBtn.textContent = "Unselect all";
const addToOrderBtn = document.createElement("button");
addToOrderBtn.id = "add-to-order-btn";
addToOrderBtn.className = "btn ghost";
addToOrderBtn.textContent = "Add to Order";
const groupBtn = document.createElement("button");
groupBtn.id = "group-btn";
groupBtn.className = "btn primary";
groupBtn.textContent = "Create Order";
const deleteSelectedBtn = document.createElement("button");
deleteSelectedBtn.id = "delete-selected";
deleteSelectedBtn.className = "btn ghost";
deleteSelectedBtn.style.color = "var(--danger)";
deleteSelectedBtn.textContent = "Delete selected";
const undoBtn = document.createElement("button");
undoBtn.className = "btn ghost";
undoBtn.id = "undo-btn";
undoBtn.textContent = "Undo delete";
undoBtn.style.display = "none";
const selectionControls = selectionBar.querySelector(".selection-actions");
if (selectionControls) {
  selectionControls.appendChild(undoBtn);
}
const boardMessage = document.createElement("div");
boardMessage.id = "board-message";
boardMessage.style.position = "fixed";
boardMessage.style.right = "16px";
boardMessage.style.bottom = "16px";
boardMessage.style.background = "var(--panel)";
boardMessage.style.border = "1px solid var(--border)";
boardMessage.style.padding = "10px 14px";
boardMessage.style.borderRadius = "10px";
boardMessage.style.boxShadow = "var(--card-shadow)";
boardMessage.style.display = "none";
boardMessage.style.zIndex = "80";
document.body.appendChild(boardMessage);
const modal = document.getElementById("modal");
const cancelOrder = document.getElementById("cancel-order");
const orderForm = document.getElementById("order-form");
const orderTrackingList = document.getElementById("order-tracking-list");
const addOrderTracking = document.getElementById("add-order-tracking");
const orderMessage = document.getElementById("order-message");
const fetchProduct = document.getElementById("fetch-product");
const newOrderBtn = document.getElementById("new-order-btn");
const tagSelect = document.getElementById("order-tags");
const tagPickerDisplay = document.getElementById("tag-picker-display");
const tagPickerPanel = document.getElementById("tag-picker-panel");
const tagPickerOptions = document.getElementById("tag-picker-options");
const tagPickerSearch = document.getElementById("tag-picker-search");
const tagPicker = document.getElementById("tag-picker");
const refreshTagsBtn = document.getElementById("refresh-tags");
const tagsList = document.getElementById("tags-list");
const tagsMessage = document.getElementById("tags-message");
const tagLabelInput = document.getElementById("tag-label-input");
const tagColorInput = document.getElementById("tag-color-input");
const tagColorRandomBtn = document.getElementById("tag-color-random");
const createTagForm = document.getElementById("create-tag-form");
const tagsTabReimbursements = document.getElementById("tags-tab-reimbursements");
const tagsTabStatus = document.getElementById("tags-tab-status");
const statusesSection = document.getElementById("statuses-section");
const refreshStatusesBtn = document.getElementById("refresh-statuses");
const statusesList = document.getElementById("statuses-list");
const statusesMessage = document.getElementById("statuses-message");
const statusLabelInput = document.getElementById("status-label-input");
const statusColorInput = document.getElementById("status-color-input");
const statusColorRandomBtn = document.getElementById("status-color-random");
const statusSortInput = document.getElementById("status-sort-input");
const createStatusForm = document.getElementById("create-status-form");
const reimbursementTagsSection = document.getElementById("reimbursements-tags-section");
const refreshReimbursementTagsBtn = document.getElementById("refresh-reimbursement-tags");
const reimbursementTagsList = document.getElementById("reimbursement-tags-list");
const reimbursementTagsMessage = document.getElementById("reimbursement-tags-message");
const reimbursementTagLabelInput = document.getElementById("reimbursement-tag-label-input");
const reimbursementTagColorInput = document.getElementById("reimbursement-tag-color-input");
const reimbursementTagColorRandomBtn = document.getElementById("reimbursement-tag-color-random");
const reimbursementTagSortInput = document.getElementById("reimbursement-tag-sort-input");
const createReimbursementTagForm = document.getElementById("create-reimbursement-tag-form");
const adminBtn = document.getElementById("admin-btn");
const adminModal = document.getElementById("admin-modal");
const closeAdmin = document.getElementById("close-admin");
const accountBtn = document.getElementById("account-btn");
const accountModal = document.getElementById("account-modal");
const groupModal = document.getElementById("group-modal");
const closeGroup = document.getElementById("close-group");
const cancelGroup = document.getElementById("cancel-group");
const groupForm = document.getElementById("group-form");
const groupModalTrackingList = document.getElementById(
  "group-modal-tracking-list",
);
const addGroupModalTracking = document.getElementById(
  "add-group-modal-tracking",
);
const groupStatusTagSelect = document.getElementById("group-status-tag");
const groupMessage = document.getElementById("group-message");
const vendorForm = document.getElementById("vendor-form");
const vendorMessage = document.getElementById("vendor-message");
const vendorList = document.getElementById("vendor-list");
const testUrl = document.getElementById("test-url");
const vendorModal = document.getElementById("vendor-modal");
const vendorCustomPanel = document.getElementById("vendor-custom-panel");
const vendorBuiltinPanel = document.getElementById("vendor-builtin-panel");
const builtinFieldsContainer = document.getElementById("builtin-fields");
const builtinVendorDescription = document.getElementById(
  "builtin-vendor-description",
);
const builtinVendorCapabilities = document.getElementById(
  "builtin-vendor-capabilities",
);
const vendorSaveBtn = vendorForm?.querySelector('button[type="submit"]');
const newVendorBtn = document.getElementById("new-vendor-btn");
const closeVendorModalBtn = document.getElementById("close-vendor-modal");
const cancelVendorBtn = document.getElementById("cancel-vendor");
const invoiceModal = document.getElementById("invoice-modal");
const closeInvoiceModalBtn = document.getElementById("close-invoice-modal");
const invoiceForm = document.getElementById("invoice-form");
const invoiceOrderSelect = document.getElementById("invoice-order-select");
const invoiceMessage = document.getElementById("invoice-message");
const invoiceExistingList = document.getElementById("invoice-existing-list");
const invoiceTargetSummary = document.getElementById("invoice-target-summary");
const invoiceCreateModal = document.getElementById("invoice-editor-modal");
const invoiceEditorTitle = document.getElementById("invoice-editor-title");
const invoiceEditorSubtitle = document.getElementById("invoice-editor-subtitle");
const closeInvoiceEditorBtn = document.getElementById("close-invoice-editor");
const invoiceEditorForm = document.getElementById("invoice-editor-form");
const invoiceFilesInput = document.getElementById("invoice-files");
const saveInvoiceBtn = document.getElementById("save-invoice-btn");
const invoiceStatusField = document.getElementById("invoice-status-field");
const invoiceStatusSelect = invoiceEditorForm?.elements?.reimbursementStatus;
const invoiceFileField = document.getElementById("invoice-file-field");
const invoicePreview = document.getElementById("invoice-preview");
const newInvoiceBtn = document.getElementById("new-invoice-btn");
const reimbursementStatusFilter = document.getElementById(
  "reimbursement-status-filter",
);
const reimbursementScopeFilter = document.getElementById(
  "reimbursement-scope-filter",
);
const reimbursementVendorFilter = document.getElementById(
  "reimbursement-vendor-filter",
);
const reimbursementsUndoBtn = document.getElementById(
  "reimbursements-undo",
);
const reimbursementsDeleteBtn = document.getElementById(
  "reimbursements-delete",
);
const refreshReimbursementsBtn = document.getElementById(
  "refresh-reimbursements",
);
const reimbursementsBulk = document.getElementById("reimbursements-bulk");
const reimbursementsBulkStatus = document.getElementById(
  "reimbursements-bulk-status",
);
const reimbursementsBulkApply = document.getElementById(
  "reimbursements-bulk-apply",
);
const reimbursementsBulkCount = document.getElementById(
  "reimbursements-bulk-count",
);
const reimbursementsSelection = document.getElementById(
  "reimbursements-selection",
);
function resizeColumns() {
  window.requestAnimationFrame(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const viewportH = document.documentElement.clientHeight;
    const mainRect = main.getBoundingClientRect();
    const padding = 24;
    const baseAvailable = Math.max(0, viewportH - mainRect.top - padding);
    if (boardSection) {
      const top = boardSection.getBoundingClientRect().top - mainRect.top;
      const available = Math.max(0, baseAvailable - top);
      if (available > 240) {
        boardSection.style.height = `${available}px`;
        boardSection.style.maxHeight = `${available}px`;
      }
    }
    if (tableSection) {
      const top = tableSection.getBoundingClientRect().top - mainRect.top;
      const available = Math.max(0, baseAvailable - top);
      if (available > 240) {
        tableSection.style.height = `${available}px`;
        tableSection.style.maxHeight = `${available}px`;
        const filtersEl = tableSection.querySelector(".filters");
        const filtersH = filtersEl
          ? filtersEl.getBoundingClientRect().height
          : 0;
        const tableAvail = available - filtersH - 24;
        if (tableContainer && tableAvail > 120) {
          tableContainer.style.height = `${tableAvail}px`;
          tableContainer.style.maxHeight = `${tableAvail}px`;
        }
      }
    }
    if (stockSection) {
      const top = stockSection.getBoundingClientRect().top - mainRect.top;
      const available = Math.max(0, baseAvailable - top);
      if (available > 240) {
        stockSection.style.height = `${available}px`;
        stockSection.style.maxHeight = `${available}px`;
        if (stockGrid) {
          stockGrid.style.maxHeight = `${available - 40}px`;
        }
      }
    }
    if (reimbursementsSection) {
      const top =
        reimbursementsSection.getBoundingClientRect().top - mainRect.top;
      const available = Math.max(0, baseAvailable - top);
      if (available > 240) {
        reimbursementsSection.style.height = `${available}px`;
        reimbursementsSection.style.maxHeight = `${available}px`;
        if (reimbursementsTable) {
          reimbursementsTable.style.maxHeight = `${available - 40}px`;
        }
      }
    }
  });
}
window.addEventListener("resize", resizeColumns);
// Initial sizing after DOM paints
setTimeout(resizeColumns, 0);
const testExtract = document.getElementById("test-extract");
const pickName = document.getElementById("pick-name");
const pickPrice = document.getElementById("pick-price");
const previewName = document.getElementById("preview-name");
const previewPrice = document.getElementById("preview-price");
const selectorSnippet = document.getElementById("selector-snippet");
const selectorTarget = document.getElementById("selector-target");
const applySelector = document.getElementById("apply-selector");
const partExample = vendorForm.elements.partNumberExample;
const partPattern = vendorForm.elements.partNumberPattern;
let editingOrderId = null;
let editingGroupId = null;
const appShell = document.getElementById("app-shell");
const loginPage = document.getElementById("login-page");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userChip = document.getElementById("user-chip");
const userList = document.getElementById("user-list");
const userForm = document.getElementById("user-form");
const userMessage = document.getElementById("user-message");
const saveUserBtn = document.getElementById("save-user-btn");
const newUserBtn = document.getElementById("new-user-btn");
const userModal = document.getElementById("user-modal");
const closeUserModalBtn = document.getElementById("close-user-modal");
const cancelUserBtn = document.getElementById("cancel-user");
const groupDetailModal = document.getElementById("group-detail-modal");
const groupDetailTitle = document.getElementById("group-detail-title");
const groupDetailMeta = document.getElementById("group-detail-meta");
const groupDetailActions = document.getElementById("group-detail-actions");
const groupDetailTracking = document.getElementById("group-detail-tracking");
const groupDetailParts = document.getElementById("group-detail-parts");
const closeGroupDetail = document.getElementById("close-group-detail");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");
const roleList = document.getElementById("role-list");
const roleMessage = document.getElementById("role-message");
const trackingSettingsForm = document.getElementById("tracking-settings-form");
const trackingSettingsMessage = document.getElementById(
  "tracking-settings-message",
);
const refreshTrackingNow = document.getElementById("refresh-tracking-now");
const adminTabUsers = document.getElementById("admin-tab-users");
const adminTabRoles = document.getElementById("admin-tab-roles");
const adminTabTracking = document.getElementById("admin-tab-tracking");
const adminTabVendors = document.getElementById("admin-tab-vendors");
const adminTabGoogle = document.getElementById("admin-tab-google");
const adminUsersSection = document.getElementById("admin-users-section");
const adminRolesSection = document.getElementById("admin-roles-section");
const adminTrackingSection = document.getElementById("admin-tracking-section");
const adminVendorsSection = document.getElementById("admin-vendors-section");
const adminGoogleSection = document.getElementById("admin-google-section");
const googleCredentialsForm = document.getElementById("google-credentials-form");
const googleCredentialsFile = document.getElementById("google-credentials-file");
const googleFolderInput = document.getElementById("google-folder-id");
const googleCredentialsMessage = document.getElementById("google-credentials-message");
const googleCredentialsSummary = document.getElementById("google-credentials-summary");
const refreshGoogleCredentialsBtn = document.getElementById("refresh-google-credentials");
const catalogModal = document.getElementById("catalog-modal");
const closeCatalog = document.getElementById("close-catalog");
const catalogBtn = document.getElementById("catalog-btn");
const catalogNewCategoryBtn = document.getElementById("catalog-new-category");
const catalogCategoryNewModal = document.getElementById(
  "catalog-category-new-modal",
);
const catalogCategoryNewForm = document.getElementById(
  "catalog-category-new-form",
);
const catalogCategoryNewMessage = document.getElementById(
  "catalog-category-new-message",
);
const catalogCategoryNewPath = document.getElementById(
  "catalog-category-new-path",
);
const catalogCategoryNewCancel = document.getElementById(
  "catalog-category-new-cancel",
);
const catalogCategoryEditModal = document.getElementById(
  "catalog-category-edit-modal",
);
const catalogCategoryEditForm = document.getElementById(
  "catalog-category-edit-form",
);
const catalogCategoryEditMessage = document.getElementById(
  "catalog-category-edit-message",
);
const catalogCategoryEditPath = document.getElementById(
  "catalog-category-edit-path",
);
const catalogCategoryEditCancel = document.getElementById(
  "catalog-category-edit-cancel",
);
const tagsBtn = document.getElementById("tags-btn");
const tagsModal = document.getElementById("tags-modal");
const closeTags = document.getElementById("close-tags");
const tagsTabTags = document.getElementById("tags-tab-tags");
const tagsTabPriorities = document.getElementById("tags-tab-priorities");
const tagsSection = document.getElementById("tags-section");
const prioritiesSection = document.getElementById("priorities-section");
const catalogRequestModal = document.getElementById("catalog-request-modal");
const cancelCatalogRequest = document.getElementById("cancel-catalog-request");
const confirmCatalogRequest = document.getElementById(
  "confirm-catalog-request",
);
const catalogRequestQty = document.getElementById("catalog-request-qty");
const catalogRequestPriority = document.getElementById(
  "catalog-request-priority",
);
const catalogRequestTags = document.getElementById("catalog-request-tags");
const catalogRequestTagPicker = document.getElementById(
  "catalog-request-tag-picker",
);
const catalogRequestTagPickerDisplay = document.getElementById(
  "catalog-request-tag-picker-display",
);
const catalogRequestTagPickerPanel = document.getElementById(
  "catalog-request-tag-picker-panel",
);
const catalogRequestTagPickerOptions = document.getElementById(
  "catalog-request-tag-picker-options",
);
const catalogRequestTagPickerSearch = document.getElementById(
  "catalog-request-tag-picker-search",
);
const catalogRequestNotes = document.getElementById("catalog-request-notes");
const catalogRequestMessage = document.getElementById(
  "catalog-request-message",
);
const catalogRequestSubtitle = document.getElementById(
  "catalog-request-subtitle",
);
const catalogVendorSelect = document.getElementById("catalog-vendor-select");
const catalogVendorHint = document.getElementById("catalog-vendor-hint");
const stockModal = document.getElementById("stock-modal");
const stockForm = document.getElementById("stock-form");
const stockCatalogSearch = document.getElementById("stock-catalog-search");
const stockCatalogResults = document.getElementById("stock-catalog-results");
const stockCatalogSelected = document.getElementById("stock-catalog-selected");
const stockModalMessage = document.getElementById("stock-modal-message");
const stockModalTitle = document.getElementById("stock-modal-title");
const stockModalSubtitle = document.getElementById("stock-modal-subtitle");
const deleteStockBtn = document.getElementById("delete-stock-btn");
const cancelStockBtn = document.getElementById("cancel-stock");
const closeStockModalBtn = document.getElementById("close-stock-modal");
const stockSubteamSelect = document.getElementById("stock-subteam-select");
const stockQuantityInput = document.getElementById("stock-quantity");
const stockLowInput = document.getElementById("stock-low");
const stockLocationInput = document.getElementById("stock-location");
const stockCategoryInput = document.getElementById("stock-category");
const stockNotesInput = document.getElementById("stock-notes");
const stockSubteamsModal = document.getElementById("stock-subteams-modal");
const stockSubteamList = document.getElementById("stock-subteam-list");
const stockSubteamMessage = document.getElementById("stock-subteam-message");
const newSubteamBtn = document.getElementById("new-subteam-btn");
const closeSubteamsModal = document.getElementById("close-subteams-modal");
const stockSubteamEditorModal = document.getElementById(
  "stock-subteam-editor-modal",
);
const stockSubteamEditorForm = document.getElementById(
  "stock-subteam-editor-form",
);
const stockSubteamEditorTitle = document.getElementById(
  "stock-subteam-editor-title",
);
const stockSubteamEditorMessage = document.getElementById(
  "stock-subteam-editor-message",
);
const closeSubteamEditorBtn = document.getElementById(
  "close-subteam-editor",
);
const cancelSubteamEditorBtn = document.getElementById(
  "cancel-subteam-editor",
);
const stockDeleteModal = document.getElementById("stock-delete-modal");
const stockDeleteMessage = document.getElementById("stock-delete-message");
const cancelDeleteStock = document.getElementById("cancel-delete-stock");
const confirmDeleteStock = document.getElementById("confirm-delete-stock");
const confirmModal = document.getElementById("confirm-modal");
const confirmMessage = document.getElementById("confirm-message");
const confirmStatus = document.getElementById("confirm-status");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmOk = document.getElementById("confirm-ok");
const confirmExtra = document.getElementById("confirm-extra");
const vendorExportModal = document.getElementById("vendor-export-modal");
const vendorExportTitle = document.getElementById("vendor-export-title");
const vendorExportDescription = document.getElementById(
  "vendor-export-description",
);
const vendorExportText = document.getElementById("vendor-export-text");
const vendorExportCopy = document.getElementById("vendor-export-copy");
const vendorExportDownload = document.getElementById("vendor-export-download");
const vendorExportMessage = document.getElementById("vendor-export-message");
const closeVendorExport = document.getElementById("close-vendor-export");
const actionOverlay = document.getElementById("action-overlay");
const actionOverlayText = document.getElementById("action-overlay-text");
const catalogBackBtn = document.getElementById("catalog-back");
const catalogCategoryList = document.getElementById("catalog-category-list");
const catalogPathDisplay = document.getElementById("catalog-path-display");
const refreshPrioritiesBtn = document.getElementById("refresh-priorities");
const prioritiesList = document.getElementById("priorities-list");
const prioritiesMessage = document.getElementById("priorities-message");
const priorityLabelInput = document.getElementById("priority-label-input");
const priorityColorInput = document.getElementById("priority-color-input");
const priorityColorRandomBtn = document.getElementById("priority-color-random");
const prioritySortInput = document.getElementById("priority-sort-input");
const createPriorityForm = document.getElementById("create-priority-form");
const orderSourceManual = document.getElementById("order-source-manual");
const orderSourceCatalog = document.getElementById("order-source-catalog");
const orderSourceImport = document.getElementById("order-source-import");
const orderManualFields = document.querySelectorAll(".order-manual-fields");
const orderCatalogFields = document.querySelectorAll(".order-catalog-fields");
const orderImportFields = document.getElementById("order-import-fields");
const orderStandardFields = document.getElementById("order-standard-fields");
const orderSubmitBar = document.getElementById("order-submit-bar");
const vendorImportSelect = document.getElementById("vendor-import-vendor");
const vendorImportInstructions = document.getElementById(
  "vendor-import-instructions",
);
const vendorImportFile = document.getElementById("vendor-import-file");
const vendorImportText = document.getElementById("vendor-import-text");
const vendorImportParseBtn = document.getElementById("vendor-import-parse");
const vendorImportClearBtn = document.getElementById("vendor-import-clear");
const vendorImportMessage = document.getElementById("vendor-import-message");
const vendorImportPreview = document.getElementById("vendor-import-preview");
const vendorImportActions = document.getElementById("vendor-import-actions");
const vendorImportSummary = document.getElementById("vendor-import-summary");
const vendorImportSubmit = document.getElementById("vendor-import-submit");
const catalogLookupInput = document.getElementById("catalog-lookup");
const catalogLookupResults = document.getElementById("catalog-lookup-results");
const catalogLookupSelected = document.getElementById(
  "catalog-lookup-selected",
);
const catalogSaveContainer = document.getElementById("catalog-save-container");
const catalogSaveFields = document.getElementById("catalog-save-fields");
const saveToCatalogToggle = document.getElementById("save-to-catalog-toggle");
const catalogSaveCategory = document.getElementById("catalog-save-category");
const catalogSaveSubteam = document.getElementById("catalog-save-subteam");
const catalogSaveType = document.getElementById("catalog-save-type");
const catalogSaveMessage = document.getElementById("catalog-save-message");
const catalogSaveStatus = document.getElementById("catalog-save-status");
const refreshCatalogCategoriesBtn = document.getElementById(
  "refresh-catalog-categories",
);
const catalogItemSearch = document.getElementById("catalog-item-search");
const refreshCatalogItemsBtn = document.getElementById("refresh-catalog-items");
const newCatalogItemBtn = document.getElementById("new-catalog-item");
const catalogItemList = document.getElementById("catalog-item-list");
const catalogItemForm = document.getElementById("catalog-item-form");
const catalogItemMessage = document.getElementById("catalog-item-message");
const fetchCatalogProductBtn = document.getElementById("fetch-catalog-product");
const deleteCatalogItemBtn = document.getElementById("delete-catalog-item");
const cancelCatalogItemBtn = document.getElementById("cancel-catalog-item");
const catalogItemHint = document.getElementById("catalog-item-hint");
const catalogItemModal = document.getElementById("catalog-item-modal");
const orderNotesLabel = document.getElementById("order-notes-label");
const catalogItemModalHint = document.getElementById("catalog-item-modal-hint");
const manualVendorSelect = document.getElementById("manual-vendor-select");
const manualVendorHint = document.getElementById("manual-vendor-hint");
