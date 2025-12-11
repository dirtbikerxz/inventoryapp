    let activeAdminTab = null;
    const ROLE_DEFAULT_PERMS = {
      admin: { canPlacePartRequests: true, canManageOwnPartRequests: true, canManagePartRequests: true, canManageOrders: true, canManageVendors: true, canManageUsers: true, canManageTags: true, canEditInventoryCatalog: true, canEditTrackingSettings: true, canManageStock: true, canEditStock: true, notesNotRequired: true, canImportBulkOrders: true },
      mentor: { canPlacePartRequests: true, canManageOwnPartRequests: true, canManagePartRequests: true, canManageOrders: true, canManageVendors: true, canManageUsers: false, canManageTags: true, canEditInventoryCatalog: true, canEditTrackingSettings: true, canManageStock: true, canEditStock: true, notesNotRequired: true, canImportBulkOrders: false },
      student: { canPlacePartRequests: true, canManageOwnPartRequests: false, canManagePartRequests: false, canManageOrders: false, canManageVendors: false, canManageUsers: false, canManageTags: false, canEditInventoryCatalog: false, canEditTrackingSettings: false, canManageStock: false, canEditStock: false, notesNotRequired: false, canImportBulkOrders: false }
    };
    function computePerms(user) {
      const role = (user?.role || 'student').toLowerCase();
      const defaults = ROLE_DEFAULT_PERMS[role] || ROLE_DEFAULT_PERMS.student;
      const provided = user?.permissions || {};
      // Only fill missing keys with defaults; honor server-provided permissions
      const merged = { ...defaults };
      Object.keys(provided).forEach(k => { merged[k] = provided[k]; });
      return merged;
    }
    const BUILTIN_CAPABILITY_LABELS = {
      productLookup: 'API autofill',
      quickOrderImport: 'Quick order import',
      quickOrderExport: 'Quick order export',
      cartSyncPlanned: 'Cart sync (planned)'
    };
    const VENDOR_CUSTOM_DISPLAY = 'contents';
    let vendorConfigs = [];
    let customVendorConfigs = [];
    let builtinVendorConfigsState = [];
    let currentUser = null;
    let vendorFormMode = 'custom';
    let builtinFieldInputs = [];
    let activeBuiltinVendor = null;
    let vendorImportEntries = [];
    let vendorImportVendor = null;
    let orderSource = 'manual';
    let manualVendorOverride = null;
    let vendorExportData = null;
    let xlsxLoaderPromise = null;
    renderVendorImportPreview();
    const statuses = [
      { label: 'To order', status: 'Requested', hint: 'Parts requests - awaiting purchase' },
      { label: 'Ordered', status: 'Ordered', hint: 'Placed orders - awaiting arrival' },
      { label: 'Arrived', status: 'Received', hint: 'Items received' }
    ];
    const getOrderTimestamp = (order) => {
      if (!order) return 0;
      const raw = order.requestedDisplayAt || order.requestedAt || Date.parse(order.createdAt || '') || 0;
      const num = Number(raw);
      return Number.isFinite(num) ? num : 0;
    };
    const getGroupTimestamp = (ordersInGroup = []) => {
      const first = ordersInGroup[0];
      if (!first) return 0;
      const raw = first.group?.requestedDisplayAt || first.group?.createdAt || getOrderTimestamp(first);
      const num = Number(raw);
      return Number.isFinite(num) ? num : 0;
    };
    const carrierOptions = [
      { value: 'ups', label: 'UPS' },
      { value: 'usps', label: 'USPS' },
      { value: 'fedex', label: 'FedEx' },
      { value: 'other', label: 'Other/Unknown' }
    ];

    const DEFAULT_TRACKING_POLL_MINUTES = 1;
    let trackingPollTimer = null;
    let trackingPollMinutes = DEFAULT_TRACKING_POLL_MINUTES;
    function startTrackingAutoRefresh(minutes = trackingPollMinutes) {
      const next = Math.max(1, Number(minutes) || DEFAULT_TRACKING_POLL_MINUTES);
      trackingPollMinutes = next;
      const ms = next * 60 * 1000;
      if (trackingPollTimer) clearInterval(trackingPollTimer);
      trackingPollTimer = setInterval(() => {
        if (!currentUser) return;
        fetchOrders();
      }, ms);
    }

    const emptyParts = [];
    setTrackingRows(orderTrackingList, [], emptyParts);
    setTrackingRows(groupModalTrackingList, [], emptyParts);
    addOrderTracking?.addEventListener('click', () => createTrackingRow(orderTrackingList, {}, emptyParts));
    addGroupModalTracking?.addEventListener('click', () => createTrackingRow(groupModalTrackingList, {}, emptyParts));

    let orders = [];
    let selected = new Set();
    let expandedGroups = new Set();
    const undoStack = [];
    const redoStack = [];
    let tagList = [];
    let priorityList = [];
    let catalogCategories = [];
    let catalogTree = [];
    let catalogItems = [];
    let catalogLookupMatches = [];
    let selectedCatalogMatch = null;
    let selectedCatalogCategoryId = null;
    let selectedCatalogItemId = null;
    let catalogAlreadySaved = false;
    let catalogAlreadySavedItem = null;
    let catalogPresenceTimer = null;
    let catalogLookupTimer = null;
    let catalogItemSearchTimer = null;
    let activeTagsTab = 'tags';
    let pendingCatalogRequest = null;
    const defaultPriorityLabel = () => {
      const list = priorityList && priorityList.length ? priorityList : defaultPriorities;
      return list.length ? list[0].label : 'Medium';
    };
    const defaultPriorities = [
      { label: 'Low', color: '#5aa0ff', sortOrder: 1 },
      { label: 'Medium', color: '#fdd023', sortOrder: 2 },
      { label: 'High', color: '#ff8b55', sortOrder: 3 },
      { label: 'Urgent', color: '#ff5565', sortOrder: 4 }
    ];
    let catalogNavStack = [];
    let currentCatalogCategoryId = 'root';
    let stockItems = [];
    let stockSubteams = [];
    let selectedStockSubteam = 'all';
    let activePrimaryView = 'orders';
    let selectedStockCatalogItem = null;
    let stockCatalogSearchTimer = null;
    let stockSearchTimer = null;
    let pendingDeleteStockId = null;
    let pendingConfirmAction = null;
    let pendingConfirmExtraGetter = null;
    let actionBusy = false;

    function setActionBusy(busy, text) {
      actionBusy = busy;
      if (!actionOverlay) return;
      actionOverlay.style.display = busy ? 'flex' : 'none';
      if (actionOverlayText) actionOverlayText.textContent = text || 'Working…';
    }
    function setAuthenticated(authenticated) {
      if (appShell) appShell.style.display = authenticated ? '' : 'none';
      if (loginPage) loginPage.style.display = authenticated ? 'none' : 'flex';
    }
    let addToOrderMode = false;
    let addToOrderVendor = null;
    orderSourceManual?.addEventListener('click', () => setOrderSource('manual'));
    orderSourceCatalog?.addEventListener('click', () => setOrderSource('catalog'));
    setOrderSource('manual');
    syncOrderNotesRequirement();
    syncVendorImportVisibility();
    updateManualVendorHint();

    function updateSearchPlaceholder() {
      if (!globalSearch) return;
      globalSearch.placeholder = activePrimaryView === 'stock'
        ? 'Search stock...'
        : 'Search parts, suppliers, users...';
    }

    function updateUndoRedoUI() {
      if (undoBtn) undoBtn.disabled = undoStack.length === 0;
      // redo button removed
    }

    function recordAction(record) {
      undoStack.push(record);
      redoStack.length = 0;
      updateUndoRedoUI();
    }

    async function approveOrder(id, status = 'approved') {
      await fetch(`/api/orders/${id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: status })
      });
    }
    function getOrderById(id) {
      return orders.find(o => o._id === id);
    }
    function getOrderVendor(order) {
      return (order?.supplier || order?.vendor || '').toLowerCase();
    }
    function isOwnOrder(order) {
      if (!order || !currentUser?.name) return false;
      return (order.studentName || '').toLowerCase() === currentUser.name.toLowerCase();
    }
    function snapshotOrder(id) {
      const o = orders.find(o => o._id === id);
      return o ? JSON.parse(JSON.stringify(o)) : null;
    }
    function sanitizeOrderForCreate(order) {
      if (!order) return null;
      const allowed = [
        'category','csvFileLink','department','fetchedName','fetchedPrice','groupId','justification','notes',
        'partCode','partId','partLink','partName','priority','productCode','quantityRequested','status','studentId',
        'studentName','supplier','supplierLink','totalCost','tracking','trackingNumber','unitCost','vendor','vendorPartNumber','requestedDisplayAt',
        'approvalStatus','approvedBy','approvedAt','tags'
      ];
      const clean = {};
      allowed.forEach(k => {
        if (order[k] !== undefined) clean[k] = order[k];
      });
      if (order.requestedAt && !clean.requestedDisplayAt) clean.requestedDisplayAt = order.requestedAt;
      if (Array.isArray(clean.tracking)) {
        clean.tracking = clean.tracking.map(t => {
          const { carrier, trackingNumber, status, eta, trackingUrl, lastCheckedAt, lastUpdated, lastEvent, delivered } = t || {};
          if (!trackingNumber) return null;
          return { carrier: carrier || 'other', trackingNumber, status, eta, trackingUrl, lastCheckedAt, lastUpdated, lastEvent, delivered };
        }).filter(Boolean);
      }
      clean.quantityRequested = Number(clean.quantityRequested || 1);
      clean.unitCost = clean.unitCost !== undefined ? Number(clean.unitCost) : clean.unitCost;
      clean.totalCost = clean.totalCost !== undefined ? Number(clean.totalCost) : clean.totalCost;
      if (!clean.partName) clean.partName = 'Restored order';
      clean.studentName = clean.studentName || 'Restored';
      clean.status = clean.status || 'Requested';
      return clean;
    }

    async function applyStep(step, counterpart) {
      switch (step.type) {
        case 'deleteOrder': {
          await fetch(`/api/orders/${step.payload.orderId}`, { method: 'DELETE' });
          break;
        }
        case 'restoreOrder': {
          const o = sanitizeOrderForCreate(step.payload.order);
          if (!o) break;
          if (step.payload.order?.requestedDisplayAt || step.payload.order?.requestedAt) {
            o.requestedDisplayAt = step.payload.order.requestedDisplayAt || step.payload.order.requestedAt;
          }
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...o,
              groupId: undefined // will reassign after
            })
          });
          const data = await res.json();
          const newId = data.order?.orderId || data.orderId || data.order?._id;
          if (step.payload.groupId && newId) {
            await assignGroup(newId, step.payload.groupId);
          }
          if (counterpart && counterpart.type === 'deleteOrder') {
            counterpart.payload.orderId = newId;
          }
          break;
        }
        case 'updateOrder': {
          await fetch(`/api/orders/${step.payload.orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step.payload.data)
          });
          break;
        }
        case 'updateStatus': {
          await patchStatusOnly(step.payload.orderId, step.payload.status, step.payload.trackingNumber);
          if (step.payload.groupId !== undefined) {
            await assignGroup(step.payload.orderId, step.payload.groupId);
          }
          break;
        }
        case 'bulkStatus': {
          if (Array.isArray(step.payload?.entries)) {
            for (const entry of step.payload.entries) {
              await patchStatusOnly(entry.orderId, entry.status, entry.trackingNumber);
              if (entry.groupId !== undefined) {
                await assignGroup(entry.orderId, entry.groupId);
              }
            }
          }
          break;
        }
        case 'assignGroup': {
          await assignGroup(step.payload.orderId, step.payload.groupId);
          break;
        }
        case 'createGroup': {
      const res = await fetch('/api/order-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: step.payload.title,
              supplier: step.payload.supplier,
              requestedDisplayAt: step.payload.requestedDisplayAt,
              orderIds: step.payload.orderIds
            })
          });
          const data = await res.json();
          const newGroupId = data.groupId || data._id;
          if (Array.isArray(step.payload.orderIds)) {
            for (const oid of step.payload.orderIds) {
              await patchStatusOnly(oid, step.payload.status || 'Ordered');
              await assignGroup(oid, newGroupId);
            }
          }
          if (step.payload.notes || (step.payload.tracking && step.payload.tracking.length)) {
            await fetch(`/api/order-groups/${newGroupId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes: step.payload.notes, tracking: step.payload.tracking })
            });
          }
          if (counterpart && counterpart.type === 'deleteGroup') {
            counterpart.payload.groupId = newGroupId;
          }
          break;
        }
        case 'restoreOrders': {
          const manageOverlay = !actionBusy;
          if (manageOverlay) setActionBusy(true, 'Restoring…');
          if (Array.isArray(step.payload?.orders)) {
            let newGroupId = null;
            if (step.payload.group) {
              const g = step.payload.group;
              try {
                const res = await fetch('/api/order-groups', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: g.title,
                    supplier: g.supplier,
                    requestedDisplayAt: g.requestedDisplayAt,
                    status: g.status || 'Ordered',
                    tracking: g.tracking || [],
                    notes: g.notes || ''
                  })
                });
                const data = await res.json();
                newGroupId = data.groupId || data._id || null;
              } catch (err) {
                console.warn('Failed to recreate group during restore', err);
              }
            }
            for (const o of step.payload.orders) {
              const sanitized = sanitizeOrderForCreate(o);
              if (!sanitized) continue;
              const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...sanitized,
                  groupId: undefined
                })
              });
              const data = await res.json();
              const newId = data.order?.orderId || data.orderId || data.order?._id;
              const targetGroupId = newGroupId || o.groupId || null;
              if (targetGroupId && newId) {
                await assignGroup(newId, targetGroupId);
              }
              if (o.status && newId) {
                await patchStatusOnly(newId, o.status, Array.isArray(o.tracking) ? o.tracking[0]?.trackingNumber : undefined);
              }
            }
          }
          if (manageOverlay) setActionBusy(false);
          break;
        }
        case 'deleteOrders': {
          const manageOverlay = !actionBusy;
          if (manageOverlay) setActionBusy(true, 'Deleting…');
          if (Array.isArray(step.payload?.orderIds)) {
            await Promise.all(step.payload.orderIds.map(oid => fetch(`/api/orders/${oid}`, { method: 'DELETE' })));
          }
          if (manageOverlay) setActionBusy(false);
          break;
        }
        case 'deleteGroup': {
          if (Array.isArray(step.payload?.orderIds)) {
            await Promise.all(step.payload.orderIds.map(async oid => {
              await assignGroup(oid, undefined);
              await patchStatusOnly(oid, 'Requested');
            }));
          }
          await fetch(`/api/order-groups/${step.payload.groupId}`, { method: 'DELETE' });
          break;
        }
        case 'updateGroup': {
          await fetch(`/api/order-groups/${step.payload.groupId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step.payload.data)
          });
          break;
        }
        default:
          break;
      }
    }

    async function doUndo() {
      const record = undoStack.pop();
      if (!record) return;
      if (!actionBusy) setActionBusy(true, 'Working…');
      await applyStep(record.undo, record.redo);
      updateUndoRedoUI();
      await fetchOrders();
      if (actionBusy) setActionBusy(false);
    }

    

const switchToBoard = () => {
  if (activePrimaryView !== 'orders') showOrdersView();
  boardBtn.classList.add('active'); tableBtn.classList.remove('active');
  boardSection.style.display = 'flex'; tableSection.style.display = 'none';
  refreshBoardSelectionUI();
  resizeColumns();
  setTimeout(resizeColumns, 30);
};
const switchToTable = () => {
  if (activePrimaryView !== 'orders') showOrdersView();
  tableBtn.classList.add('active'); boardBtn.classList.remove('active');
  boardSection.style.display = 'none'; tableSection.style.display = 'flex';
  resizeColumns();
  setTimeout(resizeColumns, 30);
};
ordersViewBtn?.addEventListener('click', showOrdersView);
stockViewBtn?.addEventListener('click', showStockView);
boardBtn.addEventListener('click', switchToBoard);
tableBtn.addEventListener('click', switchToTable);
selectSameVendorBtn?.addEventListener('click', selectSameVendorRequested);
boardEl?.addEventListener('click', (e) => {
  if (!addToOrderMode) return;
  if (e.target.closest('.to-order-actions') || e.target.closest('.selection-actions')) return;
  if (!e.target.closest('.card')) {
    resetAddToOrderMode();
    refreshBoardSelectionUI();
  }
});
refreshBtn.addEventListener('click', () => {
  if (activePrimaryView === 'stock') loadStock(); else fetchOrders();
});
undoBtn.addEventListener('click', doUndo);
globalSearch.addEventListener('input', () => {
  if (activePrimaryView === 'stock') {
    clearTimeout(stockSearchTimer);
    stockSearchTimer = setTimeout(() => loadStock(), 250);
  } else {
    renderBoard(); renderTable();
  }
});
statusFilter.addEventListener('change', () => { renderBoard(); renderTable(); });
vendorFilter.addEventListener('change', () => { renderBoard(); renderTable(); });
startDate.addEventListener('change', () => { renderBoard(); renderTable(); });
endDate.addEventListener('change', () => { renderBoard(); renderTable(); });
stockSubteamFilter?.addEventListener('change', () => { selectedStockSubteam = stockSubteamFilter.value; loadStock(); });
  addStockBtn?.addEventListener('click', () => openStockModal());
  manageSubteamsBtn?.addEventListener('click', async () => { await loadSubteams(); openSubteamsModal(); });
  stockForm?.addEventListener('submit', saveStockForm);
addToOrderBtn?.addEventListener('click', () => {
  if (addToOrderMode) resetAddToOrderMode(); else startAddToOrderMode();
});
selectAllBtn?.addEventListener('click', () => {
  withScrollRestoration(() => {
    orders.filter(o => o.status === 'Requested').forEach(o => selected.add(o._id));
    updateSelectionBar();
    refreshBoardSelectionUI();
    if (tableSection && tableSection.style.display !== 'none') renderTable();
  });
});
unselectAllBtn?.addEventListener('click', () => {
  withScrollRestoration(() => {
    selected.clear();
    updateSelectionBar();
    refreshBoardSelectionUI();
    if (tableSection && tableSection.style.display !== 'none') renderTable();
  });
});
  deleteStockBtn?.addEventListener('click', async () => {
    const id = stockForm?.elements?.id?.value;
    if (id) {
      if (stockModal) stockModal.style.display = 'none';
      openDeleteStockModal(id);
  }
});
cancelStockBtn?.addEventListener('click', () => { if (stockModal) stockModal.style.display = 'none'; resetStockModal(); });
closeStockModalBtn?.addEventListener('click', () => { if (stockModal) stockModal.style.display = 'none'; resetStockModal(); });
stockCatalogSearch?.addEventListener('input', () => {
  clearTimeout(stockCatalogSearchTimer);
  stockCatalogSearchTimer = setTimeout(() => searchStockCatalog(stockCatalogSearch.value || ''), 220);
});
stockSubteamForm?.addEventListener('submit', saveSubteam);
clearSubteamFormBtn?.addEventListener('click', () => { stockSubteamForm?.reset(); });
closeSubteamsModal?.addEventListener('click', () => { if (stockSubteamsModal) stockSubteamsModal.style.display = 'none'; });
cancelDeleteStock?.addEventListener('click', () => {
  pendingDeleteStockId = null;
  if (stockDeleteModal) stockDeleteModal.style.display = 'none';
});
confirmDeleteStock?.addEventListener('click', async () => {
  if (!pendingDeleteStockId) return;
  const id = pendingDeleteStockId;
  pendingDeleteStockId = null;
  if (stockDeleteModal) stockDeleteModal.style.display = 'none';
  await deleteStockItem(id);
});
confirmCancel?.addEventListener('click', () => {
  pendingConfirmAction = null;
  if (confirmModal) confirmModal.style.display = 'none';
});
confirmOk?.addEventListener('click', async () => {
  if (!pendingConfirmAction) {
    if (confirmModal) confirmModal.style.display = 'none';
    return;
  }
  try {
  const extra = pendingConfirmExtraGetter ? pendingConfirmExtraGetter() : undefined;
  const result = pendingConfirmAction(extra);
    if (result instanceof Promise) await result;
    if (confirmStatus) confirmStatus.textContent = '';
    if (confirmModal) confirmModal.style.display = 'none';
  } catch (err) {
    if (confirmStatus) {
      confirmStatus.textContent = err.message || 'Action failed';
      confirmStatus.className = 'error';
    }
  } finally {
    pendingConfirmAction = null;
  }
});
groupBtn.addEventListener('click', createGroup);
deleteSelectedBtn?.addEventListener('click', async () => {
  const selectedOrders = orders.filter(o => selected.has(o._id));
  const hasGlobal = currentUser?.permissions?.canManagePartRequests;
  const hasOwn = currentUser?.permissions?.canManageOwnPartRequests && selectedOrders.length > 0 && selectedOrders.every(isOwnOrder);
  if (!hasGlobal && !hasOwn) {
    showBoardMessage('No permission to manage these part requests.', 'error');
    return;
  }
  if (!selected.size) return;
  openConfirm(`Delete ${selected.size} selected item(s)?`, async () => {
    for (const id of Array.from(selected)) {
      const snapshot = snapshotOrder(id);
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (snapshot) {
        recordAction({
          undo: { type: 'restoreOrder', payload: { order: snapshot, groupId: snapshot.groupId || snapshot.group?._id } },
          redo: { type: 'deleteOrder', payload: { orderId: id } }
        });
      }
    }
    selected.clear();
    await fetchOrders();
  });
});
document.getElementById('new-order-btn').addEventListener('click', () => {
  editingOrderId = null;
  orderForm.reset();
  orderForm.elements.quantityRequested.value = 1;
  resetManualVendorOverride();
  renderTagOptions([]);
  renderPriorityOptions();
  resetCatalogLookup();
  resetCatalogSavePanel();
  syncCatalogSaveUI();
  resetVendorImportState(false);
  updateVendorImportInstructions();
  setOrderSource('manual');
  if (orderTrackingList) setTrackingRows(orderTrackingList, []);
  if (addOrderTracking) addOrderTracking.disabled = true;
  if (orderTrackingList) orderTrackingList.style.display = 'none';
  modal.style.display = 'flex';
});
cancelOrder.addEventListener('click', () => { modal.style.display = 'none'; resetCatalogLookup(); resetCatalogSavePanel(); resetVendorImportState(false); updateVendorImportInstructions(); resetManualVendorOverride(); setOrderSource('manual'); });

async function assignGroup(orderId, groupId) {
  return fetch(`/api/orders/${orderId}/group`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: groupId === undefined ? undefined : groupId })
  });
}

async function patchStatusOnly(id, status, tracking) {
  const trackingList = Array.isArray(tracking)
    ? tracking
    : (tracking ? [{ carrier: 'unknown', trackingNumber: tracking }] : undefined);
  await fetch(`/api/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      tracking: trackingList,
      trackingNumber: trackingList?.[0]?.trackingNumber
    })
  });
}

async function moveOrderToStatus(orderId, status) {
  const prev = snapshotOrder(orderId);
  if (!prev) return;
  if (status !== 'Requested' && !canLeaveRequested(prev)) {
    showBoardMessage('Create an order first. Drag into a group to move it.', 'error');
    return;
  }
  if (status === prev.status) return;
  await assignGroup(orderId, undefined);
  await patchStatusOnly(orderId, status);
  recordAction({
    undo: { type: 'updateStatus', payload: { orderId, status: prev?.status, groupId: prev?.groupId || prev?.group?._id } },
    redo: { type: 'updateStatus', payload: { orderId, status, groupId: undefined } }
  });
  await fetchOrders();
  selected.delete(orderId);
  updateSelectionBar();
}

async function updateGroupStatus(groupId, status) {
  const affected = orders.filter(o => (o.groupId && o.groupId === groupId) || (o.group && o.group._id === groupId));
  const snapshot = affected.map(o => ({
    orderId: o._id,
    status: o.status,
    groupId: o.groupId || o.group?._id
  }));
  for (const o of affected) {
    await patchStatusOnly(o._id, status);
  }
  if (snapshot.length) {
    recordAction({
      undo: { type: 'bulkStatus', payload: { entries: snapshot } },
      redo: { type: 'bulkStatus', payload: { entries: affected.map(o => ({ orderId: o._id, status, groupId: o.groupId || o.group?._id })) } }
    });
  }
  await fetchOrders();
}


function fetchOrderDetails(configHint) {
      return async () => {
        const formData = new FormData(orderForm);
        const partInput = orderForm.elements.vendorPartNumber;
        const linkInput = orderForm.elements.partLink;
        const vendorInput = orderForm.elements.vendor;
        let partNum = (formData.get('vendorPartNumber') || '').toString().trim();
        const link = (formData.get('partLink') || '').toString().trim();
        const vendorName = (formData.get('vendor') || '').toString().trim();
        const vendorOverride = manualVendorOverride;
        let config = configHint || vendorOverride || findVendorConfig(vendorName) || detectVendor(partNum, link);
        if (!config && vendorName) config = findVendorConfig(vendorName);
        const vendorKey = (config?.key || config?.slug || config?.vendor || '').toLowerCase();
        if (!partNum && config && link) {
          const extracted = extractPartNumberFromUrl(config, link);
          if (extracted && partInput) {
            partInput.value = extracted;
            partNum = extracted;
          }
        }
        if (!partNum && config?.source === 'builtin' && link) {
          const resolved = await resolveBuiltinVendorPart(config, link);
          if (resolved?.partNumber && partInput) {
            partInput.value = resolved.partNumber;
            partNum = resolved.partNumber;
          }
          if (resolved?.productUrl && linkInput && !linkInput.value) {
            linkInput.value = resolved.productUrl;
          }
        }
        if (config?.vendor && vendorInput && (!vendorInput.value || vendorOverride === config)) {
          vendorInput.value = config.vendor;
        }
        const isBuiltin = config?.source === 'builtin';
        if (isBuiltin && !partNum) {
          orderMessage.textContent = `Enter a part number to fetch from ${config.vendor}.`;
          orderMessage.className = 'error';
          return;
        }
        const url = isBuiltin ? null : (deriveUrl(config, partNum, link) || link);
        if (!isBuiltin && !url) {
          orderMessage.textContent = 'Provide a link or part number (for vendors with part number templates).';
          orderMessage.className = 'error';
          return;
        }
        if (!isBuiltin && config && !config.productUrlTemplate && !link) {
          orderMessage.textContent = 'This vendor needs a link to fetch details.';
          orderMessage.className = 'error';
          return;
        }
        orderMessage.textContent = 'Fetching...';
        orderMessage.className = 'small';
        const body = isBuiltin
          ? { vendorKey: config.key, partNumber: partNum }
          : {
              url,
              selectors: {
                nameSelector: config?.nameSelector,
                priceSelector: config?.priceSelector
              }
            };
        try {
          const res = await fetch('/api/vendors/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Fetch failed');

          const pickName = data.picks?.name || data.candidates?.titles?.[0]?.text;
          const pickPrice = data.picks?.price || data.candidates?.prices?.[0]?.text;
          if (data.message && !pickName && (pickPrice === undefined || pickPrice === null)) {
            throw new Error(data.message);
          }

          if (pickName && !orderForm.elements.partName.value) orderForm.elements.partName.value = pickName;
          const priceNum = parsePrice(pickPrice);
          if (priceNum !== undefined) {
            orderForm.elements.unitCost.value = priceNum;
          }
          if (isBuiltin && data.productUrl && !orderForm.elements.partLink.value) {
            orderForm.elements.partLink.value = data.productUrl;
          } else if (!orderForm.elements.partLink.value && url) {
            orderForm.elements.partLink.value = url;
          }
          if (config?.vendor && orderForm.elements.vendor && !orderForm.elements.vendor.value) {
            orderForm.elements.vendor.value = config.vendor;
          }
          const meta = data.meta || {};
          if (meta.manufacturerPartNumber && orderForm.elements.vendorPartNumber) {
            orderForm.elements.vendorPartNumber.value = meta.manufacturerPartNumber;
          }
          const productCodeInput = orderForm.elements.productCode;
          if (productCodeInput) {
            if (vendorKey === 'digikey') {
              productCodeInput.value = meta.digiKeyProductNumber || '';
            } else {
              productCodeInput.value = '';
            }
          }

          orderMessage.textContent = 'Fetched. Verify fields before submitting.';
          orderMessage.className = 'success';
          await checkCatalogPresence();
        } catch (err) {
          orderMessage.textContent = err.message || 'Fetch failed. Fill manually.';
          orderMessage.className = 'error';
        }
      };
    }

    fetchProduct.addEventListener('click', fetchOrderDetails());

    function flattenCatalogMatches(items = []) {
      return items.map(item => ({
        id: item._id || item.id,
        label: item.name,
        partName: item.name,
        path: item.fullPath || (item.categoryPathLabels || []).join(' / '),
        vendor: item.vendor,
        vendorPartNumber: item.vendorPartNumber,
        productCode: item.productCode,
        supplierLink: item.supplierLink,
        unitCost: item.unitCost,
        defaultQuantity: item.defaultQuantity
      })).slice(0, 40);
    }

    function renderCatalogLookupList() {
      if (!catalogLookupResults) return;
      if (!catalogLookupMatches.length) {
        catalogLookupResults.innerHTML = '<div class="small" style="padding:6px 8px;">No matches yet.</div>';
        catalogLookupResults.style.display = 'block';
        return;
      }
      catalogLookupResults.innerHTML = catalogLookupMatches.map((m, idx) => `
        <div class="tag-picker-option" data-idx="${idx}" style="padding:6px 8px; cursor:pointer; border:1px solid var(--border); border-radius:8px; margin-bottom:4px;">
          <div style="font-weight:700;">${escapeHtml(m.label)}</div>
          <div class="small">${escapeHtml(m.path || '')}${m.vendor ? ' · ' + escapeHtml(m.vendor) : ''}${m.vendorPartNumber ? ' · ' + escapeHtml(m.vendorPartNumber) : ''}</div>
        </div>
      `).join('');
      catalogLookupResults.style.display = 'block';
      catalogLookupResults.querySelectorAll('.tag-picker-option').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.idx);
          const match = catalogLookupMatches[idx];
          if (match) applyCatalogSelection(match);
        });
      });
    }

    async function performCatalogLookup(term) {
      const q = (term || '').trim();
      if (!q) {
        if (catalogLookupResults) catalogLookupResults.style.display = 'none';
        return;
      }
      try {
        const res = await fetch(`/api/catalog/items?search=${encodeURIComponent(q)}&includeDescendants=true`);
        const data = await res.json();
        catalogLookupMatches = flattenCatalogMatches(data.items || []);
        renderCatalogLookupList();
      } catch (err) {
        console.warn('Catalog lookup failed', err);
      }
    }

    function applyCatalogSelection(match) {
      if (!match || !orderForm) return;
      selectedCatalogMatch = match;
      if (orderForm.elements.partName && !orderForm.elements.partName.value) orderForm.elements.partName.value = match.partName || match.label || '';
      if (orderForm.elements.vendor && match.vendor) orderForm.elements.vendor.value = match.vendor;
      if (orderForm.elements.vendorPartNumber && match.vendorPartNumber) orderForm.elements.vendorPartNumber.value = match.vendorPartNumber;
      if (orderForm.elements.productCode) orderForm.elements.productCode.value = match.productCode || '';
      if (orderForm.elements.partLink && match.supplierLink) orderForm.elements.partLink.value = match.supplierLink;
      if (orderForm.elements.unitCost && match.unitCost !== undefined) orderForm.elements.unitCost.value = match.unitCost;
      if (orderForm.elements.quantityRequested && match.defaultQuantity) orderForm.elements.quantityRequested.value = match.defaultQuantity;
      if (catalogLookupSelected) catalogLookupSelected.textContent = `Using catalog: ${match.label}${match.path ? ' · ' + match.path : ''}`;
      if (catalogLookupResults) catalogLookupResults.style.display = 'none';
      if (catalogSaveCategory && match.path) catalogSaveCategory.value = match.path;
      setOrderSource('catalog');
      catalogAlreadySaved = true;
      catalogAlreadySavedItem = match;
      syncCatalogSaveUI();
      scheduleCatalogPresenceCheck();
      renderCatalogRequestTagOptions(getCatalogRequestTagIds());
    }

    function resetCatalogLookup() {
      catalogLookupMatches = [];
      selectedCatalogMatch = null;
      catalogAlreadySaved = false;
      catalogAlreadySavedItem = null;
      if (catalogLookupResults) {
        catalogLookupResults.style.display = 'none';
        catalogLookupResults.innerHTML = '';
      }
      if (catalogLookupSelected) catalogLookupSelected.textContent = '';
      if (catalogLookupInput) catalogLookupInput.value = '';
      syncCatalogSaveUI();
    }

    function toggleCatalogSaveFields(show) {
      if (!catalogSaveFields) return;
      const open = show !== undefined ? show : saveToCatalogToggle?.checked;
      catalogSaveFields.style.display = open ? 'grid' : 'none';
    }

    function resetCatalogSavePanel(clearStatus = true) {
      if (saveToCatalogToggle) saveToCatalogToggle.checked = false;
      if (catalogSaveCategory) catalogSaveCategory.value = '';
      if (catalogSaveSubteam) catalogSaveSubteam.value = '';
      if (catalogSaveType) catalogSaveType.value = '';
      if (catalogSaveMessage) { catalogSaveMessage.textContent = ''; catalogSaveMessage.className = 'small'; }
      if (clearStatus) {
        catalogAlreadySaved = false;
        catalogAlreadySavedItem = null;
        if (catalogSaveStatus) { catalogSaveStatus.textContent = ''; catalogSaveStatus.className = 'small'; }
      }
      toggleCatalogSaveFields(false);
    }

    function syncCatalogSaveUI() {
      const canEdit = currentUser?.permissions?.canEditInventoryCatalog;
      const showToggle = canEdit && !catalogAlreadySaved;
      if (catalogSaveContainer) catalogSaveContainer.style.display = showToggle ? 'block' : 'none';
      if (catalogSaveStatus) {
        if (catalogAlreadySaved) {
          const name = catalogAlreadySavedItem?.name || 'catalog item';
          const path = catalogAlreadySavedItem?.fullPath || (catalogAlreadySavedItem?.categoryPathLabels || []).join(' / ');
          const detail = path ? ` (${path})` : '';
          catalogSaveStatus.textContent = `Already in catalog: ${name}${detail}`;
          catalogSaveStatus.className = 'success small';
        } else {
          catalogSaveStatus.textContent = '';
          catalogSaveStatus.className = 'small';
        }
      }
      if (!showToggle) {
        if (saveToCatalogToggle) saveToCatalogToggle.checked = false;
        toggleCatalogSaveFields(false);
      }
    }

    function normalizeLink(link) {
      return (link || '').trim().replace(/\/+$/, '');
    }

    async function checkCatalogPresence() {
      if (!orderForm || !currentUser) {
        catalogAlreadySaved = false;
        catalogAlreadySavedItem = null;
        syncCatalogSaveUI();
        return;
      }
      const partNum = (orderForm.elements.vendorPartNumber?.value || '').trim();
      const link = (orderForm.elements.partLink?.value || '').trim();
      if (selectedCatalogMatch) {
        catalogAlreadySaved = true;
        catalogAlreadySavedItem = selectedCatalogMatch;
        syncCatalogSaveUI();
        return;
      }
      if (!partNum && !link) {
        catalogAlreadySaved = false;
        catalogAlreadySavedItem = null;
        syncCatalogSaveUI();
        return;
      }
      const terms = [partNum, link].filter(Boolean);
      let found = null;
      for (const term of terms) {
        try {
          const res = await fetch(`/api/catalog/items?search=${encodeURIComponent(term)}&includeDescendants=true`);
          const data = await res.json();
          const items = data.items || [];
          const linkNorm = normalizeLink(link);
          const match = items.find(i => {
            const skuMatch = partNum && (i.vendorPartNumber || '').toLowerCase() === partNum.toLowerCase();
            const linkMatch = linkNorm && normalizeLink(i.supplierLink || '') === linkNorm;
            return skuMatch || linkMatch;
          });
          if (match) {
            found = match;
            break;
          }
        } catch (err) {
          console.warn('catalog presence check failed', err);
        }
      }
      catalogAlreadySaved = Boolean(found);
      catalogAlreadySavedItem = found;
      syncCatalogSaveUI();
    }

    function scheduleCatalogPresenceCheck() {
      clearTimeout(catalogPresenceTimer);
      catalogPresenceTimer = setTimeout(checkCatalogPresence, 250);
    }

    async function saveCurrentOrderToCatalog(force = false) {
      if (!currentUser?.permissions?.canEditInventoryCatalog) return { skipped: true };
      if (!force && !saveToCatalogToggle?.checked) return { skipped: true };
      const name = orderForm?.elements?.partName?.value?.trim();
      if (!name) {
        if (catalogSaveMessage) {
          catalogSaveMessage.textContent = 'Enter a part name before saving to catalog.';
          catalogSaveMessage.className = 'error';
        }
        return { error: 'missing name' };
      }
      const path = (catalogSaveCategory?.value || selectedCatalogMatch?.path || '').split('/').map(p => p.trim()).filter(Boolean);
      const payload = {
        name,
        categoryPath: path,
        subteam: catalogSaveSubteam?.value?.trim() || undefined,
        type: catalogSaveType?.value?.trim() || undefined,
        vendor: orderForm?.elements?.vendor?.value || undefined,
        vendorPartNumber: orderForm?.elements?.vendorPartNumber?.value || undefined,
        supplierLink: orderForm?.elements?.partLink?.value || undefined,
        unitCost: orderForm?.elements?.unitCost?.value ? Number(orderForm.elements.unitCost.value) : undefined,
        aliases: []
      };
      try {
        const res = await fetch('/api/catalog/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        if (catalogSaveMessage) {
          catalogSaveMessage.textContent = 'Saved to catalog.';
          catalogSaveMessage.className = 'success';
        }
        if (currentUser?.permissions?.canEditInventoryCatalog) {
          refreshCatalogView();
        }
        await checkCatalogPresence();
        return { ok: true, id: data.id };
      } catch (err) {
        if (catalogSaveMessage) {
          catalogSaveMessage.textContent = err.message || 'Failed to save to catalog.';
          catalogSaveMessage.className = 'error';
        }
        return { error: err.message };
      }
    }

    saveToCatalogToggle?.addEventListener('change', () => toggleCatalogSaveFields());
    catalogLookupInput?.addEventListener('input', () => {
      clearTimeout(catalogLookupTimer);
      catalogLookupTimer = setTimeout(() => performCatalogLookup(catalogLookupInput.value), 200);
    });
    catalogLookupInput?.addEventListener('focus', () => {
      if (catalogLookupInput.value) performCatalogLookup(catalogLookupInput.value);
    });
    document.addEventListener('click', (e) => {
      if (!catalogLookupResults || !catalogLookupInput) return;
      if (!catalogLookupResults.contains(e.target) && e.target !== catalogLookupInput) {
        catalogLookupResults.style.display = 'none';
      }
    });
    orderForm?.elements?.vendorPartNumber?.addEventListener('input', () => {
      scheduleCatalogPresenceCheck();
      if (orderForm?.elements?.productCode) {
        orderForm.elements.productCode.value = '';
      }
    });
    orderForm?.elements?.partLink?.addEventListener('input', scheduleCatalogPresenceCheck);

    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (orderSource === 'import') {
        if (vendorImportMessage) {
          vendorImportMessage.textContent = 'Use the vendor import controls below to add items.';
          vendorImportMessage.className = 'small error';
        }
        return;
      }
      const formData = new FormData(orderForm);
      const payload = Object.fromEntries(formData.entries());
      payload.quantityRequested = Number(payload.quantityRequested || 0);
      payload.unitCost = payload.unitCost ? Number(payload.unitCost) : undefined;
      payload.fetchedPrice = payload.unitCost || undefined;
      payload.tracking = [];
      payload.trackingNumber = undefined;
      payload.tags = tagSelect ? Array.from(tagSelect.selectedOptions).map(o => o.value) : [];
      payload.vendorPartNumber = (payload.vendorPartNumber || '').trim() || undefined;
      payload.productCode = (payload.productCode || '').trim() || undefined;
      const notesInput = orderForm.elements.notes;
      const notesValue = (notesInput?.value || '').trim();
      if (requiresOrderNotes() && !notesValue) {
        orderMessage.textContent = 'Add notes/justification before submitting.';
        orderMessage.className = 'error';
        notesInput?.focus();
        return;
      }
      payload.notes = notesValue || undefined;
      if (!payload.vendor) {
        const auto = detectVendor(payload.vendorPartNumber, payload.partLink);
        if (auto?.vendor) {
          payload.vendor = auto.vendor;
          if (orderForm?.elements?.vendor) orderForm.elements.vendor.value = auto.vendor;
        }
      }
      payload.supplier = payload.vendor || payload.supplier;
      orderMessage.textContent = 'Submitting...';
      orderMessage.className = 'small';
      try {
        if (editingOrderId) {
          const prev = snapshotOrder(editingOrderId);
          await fetch(`/api/orders/${editingOrderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (prev) {
            recordAction({
              undo: { type: 'updateOrder', payload: { orderId: editingOrderId, data: {
                partName: prev.partName,
                quantityRequested: prev.quantityRequested,
                priority: prev.priority,
                supplier: prev.supplier,
                vendor: prev.vendor,
                partLink: prev.partLink,
                vendorPartNumber: prev.vendorPartNumber,
                trackingNumber: prev.trackingNumber,
                status: prev.status,
                unitCost: prev.unitCost,
                fetchedPrice: prev.fetchedPrice,
                notes: prev.notes
              }}},
              redo: { type: 'updateOrder', payload: { orderId: editingOrderId, data: payload } }
            });
          }
          orderMessage.textContent = 'Order updated.';
        } else {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          const newId = data.order?.orderId || data.orderId || data.order?._id;
          recordAction({
            undo: { type: 'deleteOrder', payload: { orderId: newId } },
            redo: { type: 'restoreOrder', payload: { order: payload } }
          });
          orderMessage.textContent = 'Order created.';
        }
        if (currentUser?.permissions?.canEditInventoryCatalog && saveToCatalogToggle?.checked) {
          await saveCurrentOrderToCatalog(true);
        }
        orderMessage.className = 'success';
        modal.style.display = 'none';
        orderForm.reset();
        resetManualVendorOverride();
        resetCatalogLookup();
        resetCatalogSavePanel();
        editingOrderId = null;
        if (orderTrackingList) setTrackingRows(orderTrackingList, []);
        await fetchOrders();
      } catch (err) {
        orderMessage.textContent = 'Failed to create order';
        orderMessage.className = 'error';
      }
    });

    adminBtn.addEventListener('click', () => {
      adminModal.style.display = 'flex';
      updateAdminTabsVisibility();
      const allowed = allowedAdminTabs();
      if (!allowed.length) { adminModal.style.display = 'none'; return; }
      const target = allowed[0];
      if (allowed.includes('users')) {
        loadUsers();
      }
      if (allowed.includes('roles')) loadRoles();
      if (allowed.includes('tracking')) loadTrackingSettings();
      if (allowed.includes('vendors')) loadVendors();
      showAdminSection(target);
    });
    tagsBtn?.addEventListener('click', () => {
      if (!currentUser) return;
      tagsModal.style.display = 'flex';
      syncTagEditUI();
      loadTags();
      loadPriorityTags();
      showTagsModalTab('tags');
    });
    tagsTabTags?.addEventListener('click', () => showTagsModalTab('tags'));
    tagsTabPriorities?.addEventListener('click', () => showTagsModalTab('priorities'));
    closeTags?.addEventListener('click', () => { tagsModal.style.display = 'none'; });
    closeAdmin.addEventListener('click', () => { adminModal.style.display = 'none'; resetCatalogItemForm(); closeVendorModal(); });
    function updateCatalogEditVisibility() {
      const canEdit = currentUser?.permissions?.canEditInventoryCatalog;
      if (catalogItemForm) catalogItemForm.style.display = canEdit ? catalogItemForm.style.display : 'none';
      if (newCatalogItemBtn) newCatalogItemBtn.style.display = canEdit ? 'inline-flex' : 'none';
      if (deleteCatalogItemBtn) deleteCatalogItemBtn.style.display = canEdit ? 'inline-flex' : 'none';
      if (fetchCatalogProductBtn) fetchCatalogProductBtn.style.display = canEdit ? 'inline-flex' : 'none';
      if (catalogNewCategoryBtn) catalogNewCategoryBtn.style.display = canEdit ? 'inline-flex' : 'none';
    }

    function openCatalogModal() {
      if (!currentUser) return;
      resetCatalogItemForm();
      currentCatalogCategoryId = 'root';
      selectedCatalogCategoryId = null;
      catalogNavStack = [];
      updateCatalogEditVisibility();
      updateCatalogItemHint();
      catalogModal.style.display = 'flex';
      refreshCatalogCategories();
      refreshCatalogItems();
      renderCatalogSaveCategoryOptions();
    }

    catalogBtn.addEventListener('click', openCatalogModal);
    closeCatalog?.addEventListener('click', () => { catalogModal.style.display = 'none'; if (catalogItemModal) catalogItemModal.style.display = 'none'; });
    accountBtn.addEventListener('click', () => {
      accountModal.style.display = 'flex';
    });

    function openGroupModal(data) {
      editingGroupId = data?.id || null;
      groupForm.elements.id.value = data?.id || '';
      groupForm.elements.title.value = data?.title || '';
      const parts = orders.filter(o => o.groupId === data?.id || o.group?._id === data?.id).map(o => ({ id: o._id, label: o.partName || o.vendorPartNumber || o.productCode || o._id }));
      setTrackingRows(groupModalTrackingList, data?.tracking?.length ? data.tracking : (data?.trackingNumber ? [{ carrier: 'unknown', trackingNumber: data.trackingNumber }] : []), parts);
      groupForm.elements.notes.value = data?.notes || '';
      groupMessage.textContent = '';
      groupModal.style.display = 'flex';
    }

    groupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(groupForm);
      const payload = Object.fromEntries(formData.entries());
      const tracking = collectTrackingRows(groupModalTrackingList);
      const id = payload.id;
      groupMessage.textContent = 'Saving...';
      groupMessage.className = 'small';
      try {
        await fetch(`/api/order-groups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.title || undefined,
            trackingNumber: tracking[0]?.trackingNumber || undefined,
            tracking: tracking.length ? tracking : [],
            notes: payload.notes || undefined
          })
        });
        groupMessage.textContent = 'Saved.';
        groupMessage.className = 'success';
        resetGroupModal();
        await fetchOrders();
      } catch (err) {
        groupMessage.textContent = 'Failed to save group';
        groupMessage.className = 'error';
      }
    });

    function renderCustomVendorCard(v) {
      return `
        <div class="card" data-id="${v._id}" data-source="custom" style="margin-bottom:8px;">
          <div class="flex-between">
            <div>
              <h4 style="margin:0 0 4px;">${escapeHtml(v.vendor || '')}</h4>
              <div class="small">${escapeHtml(v.baseUrl || '')}</div>
              <div class="small">Template: ${escapeHtml(v.productUrlTemplate || '')}</div>
              <div class="small">Selectors: ${escapeHtml(v.nameSelector || '-')} | ${escapeHtml(v.priceSelector || '-')}</div>
            </div>
            <div class="flex-between" style="gap:8px;">
              <button class="btn ghost" data-action="edit">Edit</button>
              <button class="btn ghost" data-action="delete" style="color:var(--danger);">Delete</button>
            </div>
          </div>
        </div>
      `;
    }

    function renderBuiltinVendorCard(v) {
      const status = v.requiresCredentials
        ? (v.hasCredentialsConfigured ? 'Configured' : 'Needs credentials')
        : 'Ready';
      return `
        <div class="card" data-key="${v.key}" data-source="builtin" style="margin-bottom:8px;">
          <div class="flex-between" style="gap:8px;">
            <div>
              <h4 style="margin:0 0 4px;">${escapeHtml(v.vendor || '')}</h4>
              <div class="small">${escapeHtml(v.description || '')}</div>
              <div class="small">Status: ${status}</div>
            </div>
            <div class="flex-between" style="gap:8px;">
              <button class="btn ghost" data-action="configure">Configure</button>
            </div>
          </div>
        </div>
      `;
    }

    async function loadVendors() {
      if (!currentUser) return;
      vendorList.textContent = 'Loading...';
      try {
        const res = await fetch('/api/vendors/configs');
        const data = await res.json();
        customVendorConfigs = (data.custom || data.vendors || []).map(v => ({ ...v, source: 'custom' }));
        builtinVendorConfigsState = (data.builtin || []).map(v => ({ ...v, source: 'builtin' }));
        vendorConfigs = customVendorConfigs.concat(builtinVendorConfigsState);
        renderManualVendorOptions();
        renderVendorOptions();
        renderVendorImportOptions();
        const builtinCards = builtinVendorConfigsState.length
          ? builtinVendorConfigsState.map(renderBuiltinVendorCard).join('')
          : '<div class="small">No built-in integrations available yet.</div>';
        const customCards = customVendorConfigs.length
          ? customVendorConfigs.map(renderCustomVendorCard).join('')
          : '<div class="empty">No custom vendor configs yet. Click "New vendor" to add one.</div>';
        vendorList.innerHTML = `
          <div style="margin-bottom:12px;">
            <div class="small" style="text-transform:uppercase; font-weight:700; margin-bottom:4px;">Built-in integrations</div>
            ${builtinCards}
          </div>
          <div>
            <div class="small" style="text-transform:uppercase; font-weight:700; margin-bottom:4px;">Custom scrapers</div>
            ${customCards}
          </div>
        `;

        vendorList.querySelectorAll('button[data-action="configure"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const key = card?.dataset?.key;
            if (!key) return;
            const v = builtinVendorConfigsState.find(x => x.key === key);
            if (!v) return;
            openVendorModal(v);
          });
        });

        vendorList.querySelectorAll('button[data-action="edit"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const id = card.dataset.id;
            const v = customVendorConfigs.find(x => x._id === id);
            if (!v) return;
            openVendorModal(v);
          });
        });

        vendorList.querySelectorAll('button[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.card');
            const id = card.dataset.id;
            if (!id) return;
            openConfirm('Delete this vendor config?', async () => {
              await fetch(`/api/vendors/configs/${id}`, { method: 'DELETE' });
              loadVendors();
            });
          });
        });
      } catch (e) {
        vendorList.textContent = 'Failed to load vendors';
      }
    }

    function categoryPathLabel(cat) {
      if (!cat) return '';
      const path = cat.path || [];
      return path.length ? path.join(' / ') : cat.name || '';
    }

    function currentCategory() {
      if (!currentCatalogCategoryId || currentCatalogCategoryId === 'root') return null;
      return catalogCategories.find(c => String(c._id) === String(currentCatalogCategoryId)) || null;
    }
    function renderCatalogSaveCategoryOptions() {
      if (!catalogSaveCategory) return;
      const options = ['<option value="">Select category</option>'].concat(
        catalogCategories
          .slice()
          .sort((a, b) => (a.path || []).join(' / ').localeCompare((b.path || []).join(' / ')))
          .map(c => `<option value="${(c.path || []).join('/')}">${escapeHtml((c.path || []).join(' / '))}</option>`)
      );
      catalogSaveCategory.innerHTML = options.join('');
    }

    function getDescendantIds(rootId) {
      const set = new Set();
      const walk = (pid) => {
        catalogCategories.filter(c => String(c.parentId || '') === String(pid)).forEach(child => {
          const cid = child._id?.toString();
          if (cid && !set.has(cid)) {
            set.add(cid);
            walk(cid);
          }
        });
      };
      walk(rootId);
      return set;
    }

    function renderEditCategoryParentOptions(cat) {
      if (!catalogCategoryEditForm) return;
      const select = catalogCategoryEditForm.elements.parentId;
      if (!select) return;
      const exclude = new Set([cat?._id?.toString()]);
      getDescendantIds(cat?._id)?.forEach(id => exclude.add(id));
      const options = ['<option value="">(Root)</option>'].concat(
        catalogCategories
          .filter(c => !exclude.has(c._id?.toString()))
          .slice()
          .sort((a, b) => (a.path || []).join(' / ').localeCompare((b.path || []).join(' / ')))
          .map(c => `<option value="${c._id}" ${String(cat?.parentId || '') === String(c._id) ? 'selected' : ''}>${escapeHtml((c.path || []).join(' / ') || c.name || '')}</option>`)
      );
      select.innerHTML = options.join('');
    }

    function renderCatalogCategoriesList() {
      if (!catalogCategoryList) return;
      const cat = currentCategory();
      const parentId = cat?.parentId ? cat.parentId.toString() : null;
      const children = catalogCategories.filter(c => {
        const pid = c.parentId ? c.parentId.toString() : null;
        return pid === (currentCatalogCategoryId === 'root' ? null : currentCatalogCategoryId.toString());
      });
      const pathLabels = cat?.path || [];
      catalogPathDisplay.textContent = pathLabels.length ? pathLabels.join(' / ') : 'Top level';
      catalogBackBtn.style.display = cat ? 'inline-flex' : 'none';
      if (!children.length) {
        catalogCategoryList.className = 'empty';
        catalogCategoryList.textContent = 'No subcategories here.';
        return;
      }
      catalogCategoryList.className = '';
      catalogCategoryList.innerHTML = children.map(c => `
        <div class="card" data-id="${c._id}" style="margin-bottom:6px; cursor:pointer;">
          <div class="flex-between" style="align-items:center; gap:8px;">
            <div>
              <div style="font-weight:700;">${escapeHtml(c.name)}</div>
              <div class="small">${escapeHtml((c.path || []).join(' / '))}</div>
            </div>
            ${currentUser?.permissions?.canEditInventoryCatalog ? `<div class="flex-between" style="gap:6px;">
              <button class="btn ghost" data-action="edit" style="padding:6px 10px;">Edit</button>
              <button class="btn ghost" data-action="delete" style="color:var(--danger); padding:6px 10px;">Delete</button>
            </div>` : ''}
          </div>
        </div>
      `).join('');
      catalogCategoryList.querySelectorAll('.card').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          if (!id) return;
          selectCatalogCategory(id);
        });
        el.querySelectorAll('button[data-action="edit"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = el.dataset.id;
            const cat = catalogCategories.find(c => String(c._id) === String(id));
            if (cat) openEditCategoryModal(cat);
          });
        });
        el.querySelectorAll('button[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = el.dataset.id;
            if (!id) return;
            openConfirm('Delete this category? Subcategories will also be removed if cascade is allowed.', async () => {
              await fetch(`/api/catalog/categories/${id}?cascade=true`, { method: 'DELETE' });
              await refreshCatalogCategories();
              await refreshCatalogItems();
            });
          });
        });
      });
    }

    function openNewCategoryModal() {
      if (!currentUser?.permissions?.canEditInventoryCatalog) return;
      if (catalogCategoryNewForm) catalogCategoryNewForm.reset();
      if (catalogCategoryNewMessage) { catalogCategoryNewMessage.textContent = ''; catalogCategoryNewMessage.className = 'small'; }
      const cat = currentCategory();
      const path = cat?.path?.join(' / ') || (cat?.name || '') || 'Top level';
      if (catalogCategoryNewPath) catalogCategoryNewPath.textContent = `Parent: ${path}`;
      if (catalogCategoryNewModal) catalogCategoryNewModal.style.display = 'flex';
    }

    function openEditCategoryModal(cat) {
      if (!currentUser?.permissions?.canEditInventoryCatalog || !cat) return;
      if (catalogCategoryEditForm) {
        catalogCategoryEditForm.reset();
        catalogCategoryEditForm.elements.id.value = cat._id || cat.id || '';
        catalogCategoryEditForm.elements.name.value = cat.name || '';
      }
      if (catalogCategoryEditMessage) { catalogCategoryEditMessage.textContent = ''; catalogCategoryEditMessage.className = 'small'; }
      if (catalogCategoryEditPath) catalogCategoryEditPath.textContent = (cat.path || []).join(' / ');
      renderEditCategoryParentOptions(cat);
      if (catalogCategoryEditModal) catalogCategoryEditModal.style.display = 'flex';
    }

    async function refreshCatalogCategories() {
      if (catalogCategoryList) catalogCategoryList.textContent = 'Loading categories...';
      try {
        const res = await fetch('/api/catalog/categories');
        const data = await res.json();
        catalogCategories = data.categories || [];
        catalogTree = data.tree || [];
        const exists = currentCatalogCategoryId === 'root' || catalogCategories.some(c => String(c._id) === String(currentCatalogCategoryId));
        if (!exists) {
          currentCatalogCategoryId = 'root';
          selectedCatalogCategoryId = null;
        }
        renderCatalogCategoriesList();
        renderCatalogSaveCategoryOptions();
      } catch (err) {
        if (catalogCategoryList) {
          catalogCategoryList.textContent = 'Failed to load categories';
        }
      }
    }

    function selectCatalogCategory(id) {
      currentCatalogCategoryId = id || 'root';
      selectedCatalogCategoryId = id || null;
      renderCatalogCategoriesList();
      refreshCatalogItems();
      updateCatalogItemHint();
    }
    refreshCatalogCategoriesBtn?.addEventListener('click', refreshCatalogCategories);
    catalogNewCategoryBtn?.addEventListener('click', openNewCategoryModal);
    catalogCategoryNewCancel?.addEventListener('click', () => { catalogCategoryNewModal.style.display = 'none'; });
    catalogCategoryEditCancel?.addEventListener('click', () => { catalogCategoryEditModal.style.display = 'none'; });
    catalogCategoryNewForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = catalogCategoryNewForm.elements.name.value.trim();
      if (!name) return;
      const parentId = currentCatalogCategoryId && currentCatalogCategoryId !== 'root' ? currentCatalogCategoryId : undefined;
      catalogCategoryNewMessage.textContent = 'Creating...';
      catalogCategoryNewMessage.className = 'small';
      try {
        await fetch('/api/catalog/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentId })
        });
        catalogCategoryNewMessage.textContent = 'Created.';
        catalogCategoryNewMessage.className = 'success';
        catalogCategoryNewModal.style.display = 'none';
        await refreshCatalogCategories();
        await refreshCatalogItems();
      } catch (err) {
        catalogCategoryNewMessage.textContent = err.message || 'Failed to create category';
        catalogCategoryNewMessage.className = 'error';
      }
    });
    catalogCategoryEditForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = catalogCategoryEditForm.elements.id.value;
      const name = catalogCategoryEditForm.elements.name.value.trim();
      const parentId = catalogCategoryEditForm.elements.parentId.value || undefined;
      if (!id || !name) return;
      const invalidParents = getDescendantIds(id);
      invalidParents.add(String(id));
      if (parentId && invalidParents.has(String(parentId))) {
        catalogCategoryEditMessage.textContent = 'Cannot move a category into itself or its descendants.';
        catalogCategoryEditMessage.className = 'error';
        return;
      }
      catalogCategoryEditMessage.textContent = 'Saving...';
      catalogCategoryEditMessage.className = 'small';
      try {
        await fetch(`/api/catalog/categories/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentId })
        });
        catalogCategoryEditMessage.textContent = 'Saved.';
        catalogCategoryEditMessage.className = 'success';
        catalogCategoryEditModal.style.display = 'none';
        await refreshCatalogCategories();
        await refreshCatalogItems();
      } catch (err) {
        catalogCategoryEditMessage.textContent = err.message || 'Failed to save category';
        catalogCategoryEditMessage.className = 'error';
      }
    });

    function updateCatalogItemHint() {
      if (!catalogItemHint) return;
      const cat = currentCategory();
      catalogItemHint.textContent = cat ? `Browsing ${categoryPathLabel(cat)}` : 'Browsing top level';
    }

    function resetCatalogItemForm(item = null, showModal = false) {
      if (!catalogItemForm) return;
      catalogItemForm.reset();
      selectedCatalogItemId = null;
      catalogItemMessage.textContent = '';
      catalogItemMessage.className = 'small';
      if (item) {
        catalogItemForm.elements.id.value = item._id || item.id || '';
        catalogItemForm.elements.name.value = item.name || '';
        const pathLabel = Array.isArray(item.categoryPathLabels)
          ? item.categoryPathLabels.join(' / ')
          : (item.fullPath || item.categoryPathLabels || '');
        catalogItemForm.elements.categoryPath.value = pathLabel || '';
        catalogItemForm.elements.subteam.value = item.subteam || '';
        catalogItemForm.elements.type.value = item.type || '';
        catalogItemForm.elements.vendor.value = item.vendor || '';
        catalogItemForm.elements.vendorPartNumber.value = item.vendorPartNumber || '';
        catalogItemForm.elements.supplierLink.value = item.supplierLink || '';
        catalogItemForm.elements.unitCost.value = item.unitCost ?? '';
        catalogItemForm.elements.defaultQuantity.value = item.defaultQuantity ?? '';
        catalogItemForm.elements.aliases.value = (item.aliases || []).join(', ');
        selectedCatalogItemId = item._id || item.id || null;
        if (catalogItemModalHint) catalogItemModalHint.textContent = 'Edit saved part';
      } else {
        if (catalogItemModalHint) catalogItemModalHint.textContent = 'Create a saved part';
      }
      if (catalogItemModal) catalogItemModal.style.display = showModal ? 'flex' : catalogItemModal.style.display;
    }

    function renderCatalogItems() {
      if (!catalogItemList) return;
      if (!catalogItems.length) {
        catalogItemList.className = 'empty';
        catalogItemList.textContent = 'No catalog items yet.';
        return;
      }
      const canEdit = currentUser?.permissions?.canEditInventoryCatalog;
      catalogItemList.className = '';
      catalogItemList.innerHTML = catalogItems.map(item => {
        const path = escapeHtml((item.fullPath || (item.categoryPathLabels || []).join(' / ')) || '');
        const vendor = escapeHtml(item.vendor || '');
        const sku = escapeHtml(item.vendorPartNumber || '');
        return `<div class="card" data-id="${item._id || item.id}" style="margin-bottom:8px;">
          <div class="flex-between" style="gap:8px; align-items:flex-start;">
            <div>
              <h4 style="margin:0 0 4px;">${escapeHtml(item.name)}</h4>
              <div class="small">${path || 'Uncategorized'}</div>
              <div class="small">${vendor || ''} ${sku ? '· ' + sku : ''}</div>
            </div>
            <div class="flex-between" style="gap:6px; flex-wrap:wrap; justify-content:flex-end;">
              ${canEdit ? `<button class="btn ghost" data-action="edit">Edit</button>` : ''}
              ${canEdit ? `<button class="btn ghost" data-action="delete" style="color:var(--danger);">Delete</button>` : ''}
              <button class="btn primary" data-action="request">Request</button>
            </div>
          </div>
        </div>`;
      }).join('');
    catalogItemList.querySelectorAll('button[data-action="request"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('.card')?.dataset.id;
        if (!id) return;
        const item = catalogItems.find(i => String(i._id || i.id) === String(id));
        if (item) openCatalogRequestModal(item);
      });
    });
    if (canEdit) {
      catalogItemList.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('.card')?.dataset.id;
          if (!id) return;
          const item = catalogItems.find(i => String(i._id || i.id) === String(id));
          if (item) resetCatalogItemForm(item, true);
        });
      });
        catalogItemList.querySelectorAll('button[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.closest('.card')?.dataset.id;
            if (!id) return;
            openConfirm('Delete this saved item?', async () => {
              await fetch(`/api/catalog/items/${id}`, { method: 'DELETE' });
              await refreshCatalogItems();
              resetCatalogItemForm();
            });
          });
        });
      }
    }

    async function refreshCatalogItems() {
      if (!currentUser) return;
      catalogItemList.textContent = 'Loading...';
      const params = new URLSearchParams();
      if (currentCatalogCategoryId) params.set('categoryId', currentCatalogCategoryId);
      params.set('includeDescendants', 'false');
      if (catalogItemSearch?.value) params.set('search', catalogItemSearch.value.trim());
      try {
        const res = await fetch(`/api/catalog/items?${params.toString()}`);
        const data = await res.json();
        catalogItems = data.items || [];
        renderCatalogItems();
      } catch (err) {
        catalogItemList.textContent = 'Failed to load catalog items';
      }
    }

    catalogItemForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(catalogItemForm).entries());
      const id = payload.id;
      const aliases = (payload.aliases || '').split(',').map(a => a.trim()).filter(Boolean);
      const body = {
        name: payload.name,
        categoryPath: (payload.categoryPath || '').split('/').map(p => p.trim()).filter(Boolean),
        subteam: payload.subteam || undefined,
        type: payload.type || undefined,
        vendor: payload.vendor || undefined,
        vendorPartNumber: payload.vendorPartNumber || undefined,
        supplierLink: payload.supplierLink || undefined,
        unitCost: payload.unitCost ? Number(payload.unitCost) : undefined,
        defaultQuantity: payload.defaultQuantity ? Number(payload.defaultQuantity) : undefined,
        aliases
      };
      catalogItemMessage.textContent = 'Saving...';
      catalogItemMessage.className = 'small';
      try {
        if (id) {
          await fetch(`/api/catalog/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else {
          await fetch('/api/catalog/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        }
        catalogItemMessage.textContent = 'Saved';
        catalogItemMessage.className = 'success';
        await refreshCatalogItems();
        if (catalogItemModal) catalogItemModal.style.display = 'none';
        if (!id) resetCatalogItemForm();
      } catch (err) {
        catalogItemMessage.textContent = err.message || 'Failed to save item';
        catalogItemMessage.className = 'error';
      }
    });

    cancelCatalogItemBtn?.addEventListener('click', () => { catalogItemModal.style.display = 'none'; resetCatalogItemForm(); });
    deleteCatalogItemBtn?.addEventListener('click', async () => {
      const id = catalogItemForm?.elements.id.value;
      if (!id) return;
      openConfirm('Delete this saved item?', async () => {
        await fetch(`/api/catalog/items/${id}`, { method: 'DELETE' });
        await refreshCatalogItems();
        resetCatalogItemForm();
        if (catalogItemModal) catalogItemModal.style.display = 'none';
      });
    });
    newCatalogItemBtn?.addEventListener('click', () => {
      resetCatalogItemForm({ name: '', categoryPathLabels: currentCategory() ? [categoryPathLabel(currentCategory())] : [] }, true);
    });
    refreshCatalogItemsBtn?.addEventListener('click', () => refreshCatalogItems());
    fetchCatalogProductBtn?.addEventListener('click', fetchCatalogDetails);
    catalogItemSearch?.addEventListener('input', () => {
      clearTimeout(catalogItemSearchTimer);
      catalogItemSearchTimer = setTimeout(refreshCatalogItems, 200);
    });
    catalogBackBtn?.addEventListener('click', () => {
      const cat = currentCategory();
      if (cat?.parentId) {
        selectCatalogCategory(cat.parentId.toString());
      } else {
        currentCatalogCategoryId = 'root';
        selectedCatalogCategoryId = null;
        renderCatalogCategoriesList();
        refreshCatalogItems();
        updateCatalogItemHint();
      }
    });

    function refreshCatalogView() {
      currentCatalogCategoryId = 'root';
      selectedCatalogCategoryId = null;
      renderCatalogCategoriesList();
      refreshCatalogCategories();
      refreshCatalogItems();
      updateCatalogItemHint();
      updateCatalogEditVisibility();
    }

    async function loadTags() {
      try {
        const res = await fetch('/api/tags');
        const data = await res.json();
        tagList = data.tags || [];
        renderTagOptions(getSelectedTagIds());
        renderCatalogRequestTagOptions(getCatalogRequestTagIds());
        renderTagsManager();
        renderBoard();
        renderTable();
      } catch (e) {
        console.warn('Failed to load tags', e);
      }
    }

    async function loadPriorityTags() {
      try {
        const res = await fetch('/api/priority-tags');
        const data = await res.json();
        priorityList = (data.priorities && data.priorities.length ? data.priorities : defaultPriorities) || defaultPriorities;
      renderPriorityOptions();
      renderPriorityManager();
    } catch (e) {
      console.warn('Failed to load priorities', e);
      priorityList = defaultPriorities;
      renderPriorityOptions();
      renderPriorityManager();
    }
      renderCatalogSaveCategoryOptions();
  }

    function renderTagOptions(selected = []) {
      if (!tagSelect) return;
      const selSet = new Set(selected.map(String));
      tagSelect.innerHTML = tagList.map(t => `<option value="${t._id || t.id || t.label}" ${selSet.has(String(t._id || t.id || t.label)) ? 'selected' : ''}>${t.label}</option>`).join('');
      updateTagSelection(selected);
    }

    function updateTagSelection(ids = []) {
      if (tagSelect) {
        const selSet = new Set(ids.map(String));
        Array.from(tagSelect.options || []).forEach(opt => { opt.selected = selSet.has(opt.value); });
      }
      if (tagPickerDisplay) {
        const labels = ids.map(getTagLabel).filter(Boolean);
        tagPickerDisplay.textContent = labels.length ? labels.join(', ') : 'Select tags';
      }
      renderTagDropdownList(ids);
    }

    function renderTagDropdownList(selected = getSelectedTagIds()) {
      if (!tagPickerOptions) return;
      const term = (tagPickerSearch?.value || '').toLowerCase().trim();
      const filtered = tagList.filter(t => !term || (t.label || '').toLowerCase().includes(term));
      const selSet = new Set(selected.map(String));
      tagPickerOptions.innerHTML = filtered.length ? filtered.map(t => {
        const id = String(t._id || t.id || t.label);
        const selectedCls = selSet.has(id) ? 'selected' : '';
        const color = t.color || '#fdd023';
        return `<div class="tag-option ${selectedCls}" data-id="${id}">
          <span class="tag-dot" style="background:${color};"></span>
          <span>${escapeHtml(t.label || id)}</span>
        </div>`;
      }).join('') : `<div class="small" style="padding:8px 10px;">No tags</div>`;
    }

    function toggleTagPanel(open) {
      if (!tagPickerPanel) return;
      const shouldOpen = open !== undefined ? open : tagPickerPanel.style.display !== 'block';
      tagPickerPanel.style.display = shouldOpen ? 'block' : 'none';
    }

    tagPickerDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTagPanel(true);
    });
    document.addEventListener('click', (e) => {
      if (!tagPicker) return;
      if (!tagPicker.contains(e.target)) toggleTagPanel(false);
    });
    tagPickerSearch?.addEventListener('input', () => renderTagDropdownList(getSelectedTagIds()));
    tagPickerOptions?.addEventListener('click', (e) => {
      const row = e.target.closest('.tag-option');
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      const selected = new Set(getSelectedTagIds().map(String));
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      updateTagSelection(Array.from(selected));
    });

    function syncTagEditUI() {
      const canManage = currentUser?.permissions?.canManageTags;
      if (createTagForm) createTagForm.style.display = canManage ? 'flex' : 'none';
      if (createPriorityForm) createPriorityForm.style.display = canManage ? 'flex' : 'none';
    }

    function showTagsModalTab(which) {
      activeTagsTab = which === 'priorities' ? 'priorities' : 'tags';
      if (tagsTabTags) tagsTabTags.classList.toggle('primary', activeTagsTab === 'tags');
      if (tagsTabPriorities) tagsTabPriorities.classList.toggle('primary', activeTagsTab === 'priorities');
      if (tagsSection) tagsSection.style.display = activeTagsTab === 'tags' ? 'block' : 'none';
      if (prioritiesSection) prioritiesSection.style.display = activeTagsTab === 'priorities' ? 'block' : 'none';
    }
    function getCatalogRequestTagIds() {
      if (!catalogRequestTags) return [];
      return Array.from(catalogRequestTags.selectedOptions || []).map(o => o.value);
    }
    function renderCatalogRequestTagOptions(selected = []) {
      if (!catalogRequestTags) return;
      const selSet = new Set(selected.map(String));
      catalogRequestTags.innerHTML = tagList.map(t => {
        const id = t._id || t.id || t.label;
        return `<option value="${id}" ${selSet.has(String(id)) ? 'selected' : ''}>${escapeHtml(t.label || '')}</option>`;
      }).join('');
      updateCatalogRequestTagSelection(selected);
    }
    function updateCatalogRequestTagSelection(ids = []) {
      if (catalogRequestTags) {
        const selSet = new Set(ids.map(String));
        Array.from(catalogRequestTags.options || []).forEach(opt => { opt.selected = selSet.has(opt.value); });
      }
      if (catalogRequestTagPickerDisplay) {
        const labels = ids.map(getTagLabel).filter(Boolean);
        catalogRequestTagPickerDisplay.textContent = labels.length ? labels.join(', ') : 'Select tags';
      }
      renderCatalogRequestTagDropdownList(ids);
    }
    function renderCatalogRequestTagDropdownList(selected = getCatalogRequestTagIds()) {
      if (!catalogRequestTagPickerOptions) return;
      const term = (catalogRequestTagPickerSearch?.value || '').toLowerCase().trim();
      const filtered = tagList.filter(t => !term || (t.label || '').toLowerCase().includes(term));
      const selSet = new Set(selected.map(String));
      catalogRequestTagPickerOptions.innerHTML = filtered.length ? filtered.map(t => {
        const id = String(t._id || t.id || t.label);
        const selectedCls = selSet.has(id) ? 'selected' : '';
        const color = t.color || '#fdd023';
        return `<div class="tag-option ${selectedCls}" data-id="${id}">
          <span class="tag-dot" style="background:${color};"></span>
          <span>${escapeHtml(t.label || id)}</span>
        </div>`;
      }).join('') : `<div class="small" style="padding:8px 10px;">No tags</div>`;
    }
    function toggleCatalogRequestTagPanel(open) {
      if (!catalogRequestTagPickerPanel) return;
      const shouldOpen = open !== undefined ? open : catalogRequestTagPickerPanel.style.display !== 'block';
      catalogRequestTagPickerPanel.style.display = shouldOpen ? 'block' : 'none';
    }

    catalogRequestTagPickerDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCatalogRequestTagPanel(true);
    });
    document.addEventListener('click', (e) => {
      if (!catalogRequestTagPicker) return;
      if (!catalogRequestTagPicker.contains(e.target)) toggleCatalogRequestTagPanel(false);
    });
    catalogRequestTagPickerSearch?.addEventListener('input', () => renderCatalogRequestTagDropdownList(getCatalogRequestTagIds()));
    catalogRequestTagPickerOptions?.addEventListener('click', (e) => {
      const row = e.target.closest('.tag-option');
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      const selected = new Set(getCatalogRequestTagIds().map(String));
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      updateCatalogRequestTagSelection(Array.from(selected));
    });

    function renderTagsManager() {
      if (!tagsList) return;
      syncTagEditUI();
      if (!tagList.length) {
        tagsList.innerHTML = '<div class="empty">No tags yet.</div>';
        return;
      }
      tagsList.innerHTML = tagList.map(t => {
        const id = String(t._id || t.id || t.label);
        const color = t.color || '#fdd023';
        return `<div class="tag-manager-item" data-id="${id}">
          <div class="tag-manager-meta">
            <input type="color" class="tag-color-input inline-color" value="${color}" data-id="${id}" title="Pick color" ${!currentUser?.permissions?.canManageTags ? 'disabled' : ''}/>
            <div>${escapeHtml(t.label || id)}</div>
          </div>
          ${currentUser?.permissions?.canManageTags ? `<button class="btn ghost" data-action="delete-tag" style="color: var(--danger);">Delete</button>` : ''}
        </div>`;
      }).join('');
      if (currentUser?.permissions?.canManageTags) {
        tagsList.querySelectorAll('.tag-color-input').forEach(inp => {
          inp.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            await fetch(`/api/tags/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ color: e.target.value })
            });
            await loadTags();
          });
        });
      }
      tagsList.querySelectorAll('button[data-action="delete-tag"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.closest('.tag-manager-item')?.dataset.id;
          if (!id) return;
          openConfirm('Delete this tag?', async () => {
            await fetch(`/api/tags/${id}`, { method: 'DELETE' });
            await loadTags();
          });
        });
      });
    }

      refreshTagsBtn?.addEventListener('click', () => loadTags());
    createTagForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser?.permissions?.canManageTags) return;
      const label = (tagLabelInput?.value || '').trim();
      const color = tagColorInput?.value || '#fdd023';
      if (!label) return;
      tagsMessage.textContent = 'Saving...';
      tagsMessage.className = 'small';
      try {
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, color })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create tag');
        tagLabelInput.value = '';
        tagsMessage.textContent = 'Tag created';
        tagsMessage.className = 'success';
        await loadTags();
      } catch (err) {
        tagsMessage.textContent = err.message || 'Failed to create tag';
        tagsMessage.className = 'error';
      }
    });

    function renderPriorityOptions() {
      const select = orderForm.elements.priority;
      if (!select) return;
      const list = priorityList && priorityList.length ? priorityList : defaultPriorities;
      const current = select.value || 'Medium';
      select.innerHTML = list.map(p => `<option value="${p.label}">${p.label}</option>`).join('');
      if (list.some(p => p.label === current)) {
        select.value = current;
      } else if (list.length) {
        select.value = list[0].label;
      }
      renderCatalogRequestPriorityOptions();
    }

    function renderCatalogRequestPriorityOptions() {
      if (!catalogRequestPriority) return;
      const list = priorityList && priorityList.length ? priorityList : defaultPriorities;
      const current = catalogRequestPriority.value || defaultPriorityLabel();
      catalogRequestPriority.innerHTML = list.map(p => `<option value="${p.label}">${p.label}</option>`).join('');
      if (list.some(p => p.label === current)) {
        catalogRequestPriority.value = current;
      } else if (list.length) {
        catalogRequestPriority.value = list[0].label;
      }
    }

    function renderPriorityManager() {
      if (!prioritiesList) return;
      syncTagEditUI();
      if (!priorityList.length) {
        prioritiesList.innerHTML = '<div class="empty">No priorities yet.</div>';
        return;
      }
      prioritiesList.innerHTML = priorityList.map(p => {
        const id = p._id || p.id || p.label;
        const color = p.color || '#fdd023';
        const sort = p.sortOrder ?? '';
        return `<div class="tag-manager-item" data-id="${id}">
          <div class="tag-manager-meta" style="gap:12px;">
            <input type="color" class="priority-color-input inline-color" value="${color}" data-id="${id}" title="Pick color" ${!currentUser?.permissions?.canManageTags ? 'disabled' : ''}/>
            <div style="min-width:140px;">${escapeHtml(p.label || '')}</div>
            <input type="number" class="priority-sort-input input" data-id="${id}" value="${sort}" placeholder="Sort" style="width:80px;" ${!currentUser?.permissions?.canManageTags ? 'disabled' : ''}/>
          </div>
          ${currentUser?.permissions?.canManageTags ? `<button class="btn ghost" data-action="delete-priority" style="color: var(--danger);">Delete</button>` : ''}
        </div>`;
      }).join('');
      if (currentUser?.permissions?.canManageTags) {
        prioritiesList.querySelectorAll('.priority-color-input').forEach(inp => {
          inp.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            await fetch(`/api/priority-tags/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ color: e.target.value })
            });
            await loadPriorityTags();
          });
        });
        prioritiesList.querySelectorAll('.priority-sort-input').forEach(inp => {
          inp.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            const sort = Number(e.target.value);
            await fetch(`/api/priority-tags/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sortOrder: Number.isFinite(sort) ? sort : null })
            });
            await loadPriorityTags();
          });
        });
        prioritiesList.querySelectorAll('button[data-action="delete-priority"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.closest('.tag-manager-item')?.dataset.id;
            if (!id) return;
            openConfirm('Delete this priority?', async () => {
              await fetch(`/api/priority-tags/${id}`, { method: 'DELETE' });
              await loadPriorityTags();
            });
          });
        });
      }
    }

    function openCatalogRequestModal(item) {
      pendingCatalogRequest = item;
      if (catalogRequestMessage) {
        catalogRequestMessage.textContent = '';
        catalogRequestMessage.className = 'small';
      }
      if (catalogRequestQty) {
        catalogRequestQty.value = item?.defaultQuantity || 1;
        setTimeout(() => catalogRequestQty.focus(), 50);
      }
      renderCatalogRequestPriorityOptions();
      updateCatalogRequestTagSelection([]);
      if (catalogRequestNotes) catalogRequestNotes.value = '';
      if (catalogRequestSubtitle) {
        const path = item?.fullPath || (item?.categoryPathLabels || []).join(' / ');
        catalogRequestSubtitle.textContent = item ? `${item.name}${path ? ' · ' + path : ''}` : 'Choose quantity and confirm.';
      }
      if (catalogRequestModal) catalogRequestModal.style.display = 'flex';
    }

    async function submitCatalogRequest() {
      const item = pendingCatalogRequest;
      if (!item) return;
      if (!currentUser) {
        showBoardMessage('Login to create an order.', 'error');
        return;
      }
      if (!currentUser.permissions?.canPlacePartRequests) {
        showBoardMessage('No permission to place part requests.', 'error');
        return;
      }
      const qty = Number(catalogRequestQty?.value || item.defaultQuantity || 1);
      if (!Number.isFinite(qty) || qty <= 0) {
        if (catalogRequestMessage) {
          catalogRequestMessage.textContent = 'Enter a valid quantity.';
          catalogRequestMessage.className = 'error';
        }
        return;
      }
      const priority = catalogRequestPriority?.value || defaultPriorityLabel();
      const tags = getCatalogRequestTagIds();
      const notes = catalogRequestNotes?.value?.trim();
      const payload = {
        partName: item.name,
        vendor: item.vendor,
        supplier: item.vendor,
        vendorPartNumber: item.vendorPartNumber,
        partLink: item.supplierLink,
        unitCost: item.unitCost ?? undefined,
        fetchedPrice: item.unitCost ?? undefined,
        quantityRequested: qty,
        status: 'Requested',
        priority,
        tags,
        notes: notes || (item.fullPath ? `From catalog: ${item.fullPath}` : undefined)
      };
      if (catalogRequestMessage) {
        catalogRequestMessage.textContent = 'Creating request...';
        catalogRequestMessage.className = 'small';
      }
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create order');
        if (catalogRequestMessage) {
          catalogRequestMessage.textContent = 'Added to requests.';
          catalogRequestMessage.className = 'success';
        }
        if (catalogRequestModal) catalogRequestModal.style.display = 'none';
        pendingCatalogRequest = null;
        await fetchOrders();
        showBoardMessage('Requested from catalog.', 'info');
      } catch (err) {
        if (catalogRequestMessage) {
          catalogRequestMessage.textContent = err.message || 'Failed to create order';
          catalogRequestMessage.className = 'error';
        }
      }
    }

    refreshPrioritiesBtn?.addEventListener('click', () => loadPriorityTags());
    createPriorityForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser?.permissions?.canManageTags) return;
      const label = (priorityLabelInput?.value || '').trim();
      const color = priorityColorInput?.value || '#fdd023';
      const sortOrder = Number(prioritySortInput?.value);
      if (!label) return;
      prioritiesMessage.textContent = 'Saving...';
      prioritiesMessage.className = 'small';
      try {
        const res = await fetch('/api/priority-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, color, sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create priority');
        priorityLabelInput.value = '';
        prioritySortInput.value = '';
        prioritiesMessage.textContent = 'Priority created';
        prioritiesMessage.className = 'success';
        await loadPriorityTags();
      } catch (err) {
        prioritiesMessage.textContent = err.message || 'Failed to create priority';
        prioritiesMessage.className = 'error';
      }
    });
    confirmCatalogRequest?.addEventListener('click', submitCatalogRequest);
    cancelCatalogRequest?.addEventListener('click', () => { pendingCatalogRequest = null; catalogRequestModal.style.display = 'none'; });
    vendorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = vendorForm.dataset.mode || 'custom';
      if (mode === 'builtin') {
        const integrationKey = vendorForm.elements.integrationKey?.value || activeBuiltinVendor?.key;
        if (!integrationKey) {
          vendorMessage.textContent = 'Missing integration key.';
          vendorMessage.className = 'error';
          return;
        }
        const settings = {};
        for (const field of builtinFieldInputs) {
          const value = field.input.value.trim();
          if (field.required && !value) {
            vendorMessage.textContent = `Enter ${field.label || field.key}`;
            vendorMessage.className = 'error';
            return;
          }
          if (value) settings[field.key] = value;
        }
        vendorMessage.textContent = 'Saving...';
        vendorMessage.className = 'small';
        try {
          await fetch(`/api/vendors/integrations/${integrationKey}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
          });
          vendorMessage.textContent = 'Integration saved.';
          vendorMessage.className = 'success';
          loadVendors();
          closeVendorModal();
        } catch (err) {
          vendorMessage.textContent = 'Failed to save integration';
          vendorMessage.className = 'error';
        }
        return;
      }
      const data = Object.fromEntries(new FormData(vendorForm).entries());
      const id = data.id || undefined;
      if (!data.vendor) {
        vendorMessage.textContent = 'Vendor is required';
        vendorMessage.className = 'error';
        return;
      }
      vendorMessage.textContent = 'Saving...';
      vendorMessage.className = 'small';
      let headersObj;
      if (data.notes) {
        try {
          headersObj = JSON.parse(data.notes);
        } catch (err) {
          vendorMessage.textContent = 'Notes/headers not valid JSON.';
          vendorMessage.className = 'error';
          return;
        }
      }
      const method = id ? 'PATCH' : 'POST';
      const url = id ? `/api/vendors/configs/${id}` : '/api/vendors/configs';
      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor: data.vendor,
            baseUrl: data.baseUrl || undefined,
            productUrlTemplate: data.productUrlTemplate || undefined,
            partNumberExample: data.partNumberExample || undefined,
            partNumberPattern: data.partNumberPattern || undefined,
            nameSelector: data.nameSelector || undefined,
            priceSelector: data.priceSelector || undefined,
            platform: data.platform || undefined,
            notes: data.notes || undefined,
            headers: headersObj
          })
        });
        vendorMessage.textContent = 'Saved.';
        vendorMessage.className = 'success';
        loadVendors();
        closeVendorModal();
      } catch (err) {
        vendorMessage.textContent = 'Failed to save vendor';
        vendorMessage.className = 'error';
      }
    });
    vendorExportCopy?.addEventListener('click', async () => {
      if (!vendorExportData?.text) {
        if (vendorExportMessage) {
          vendorExportMessage.textContent = 'Nothing to copy yet.';
          vendorExportMessage.className = 'small error';
        }
        return;
      }
      try {
        await copyTextToClipboard(vendorExportData.text);
        if (vendorExportMessage) {
          vendorExportMessage.textContent = 'Copied to clipboard.';
          vendorExportMessage.className = 'small success';
        }
      } catch (err) {
        if (vendorExportMessage) {
          vendorExportMessage.textContent = 'Copy failed. Select the text and copy manually.';
          vendorExportMessage.className = 'small error';
        }
      }
    });
    vendorExportDownload?.addEventListener('click', () => {
      if (!vendorExportData?.csv) {
        if (vendorExportMessage) {
          vendorExportMessage.textContent = 'No CSV content available.';
          vendorExportMessage.className = 'small error';
        }
        return;
      }
      downloadTextFile(vendorExportData.filename || 'vendor-export.csv', vendorExportData.csv, 'text/csv;charset=utf-8;');
      if (vendorExportMessage) {
        vendorExportMessage.textContent = 'CSV downloaded.';
        vendorExportMessage.className = 'small success';
      }
    });
    closeVendorExport?.addEventListener('click', () => closeVendorExportModal());

    vendorImportSelect?.addEventListener('change', () => {
      if (!canUseVendorImport()) return;
      const value = (vendorImportSelect.value || '').toLowerCase();
      vendorImportVendor = vendorConfigs.find(v => vendorOptionValue(v) === value) || null;
      if (vendorImportMessage) {
        vendorImportMessage.textContent = '';
        vendorImportMessage.className = 'small';
      }
      vendorImportEntries = [];
      updateVendorImportInstructions();
      renderVendorImportPreview();
    });
    vendorImportParseBtn?.addEventListener('click', () => { handleVendorImportParse(); });
    vendorImportClearBtn?.addEventListener('click', () => {
      resetVendorImportState(false);
      updateVendorImportInstructions();
    });
    vendorImportSubmit?.addEventListener('click', () => { submitVendorImportEntries(); });
    vendorImportPreview?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="remove-import-entry"]');
      if (!btn) return;
      const id = btn.dataset.index;
      vendorImportEntries = vendorImportEntries.filter(entry => String(entry.id) !== String(id));
      renderVendorImportPreview();
    });
    manualVendorSelect?.addEventListener('change', () => {
      const value = (manualVendorSelect.value || '').toLowerCase();
      manualVendorOverride = value ? (vendorConfigs.find(v => vendorOptionValue(v) === value) || null) : null;
      if (manualVendorOverride && orderForm?.elements?.vendor) {
        orderForm.elements.vendor.value = manualVendorOverride.vendor || manualVendorOverride.slug || manualVendorOverride.key || '';
      }
      updateManualVendorHint();
    });

    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(userForm).entries());
      const id = data.id || undefined;
      const payload = {
        username: data.username,
        name: data.name,
        role: data.role,
        active: data.active === 'true',
        permissions: undefined
      };
      if (data.password) payload.password = data.password;
      userMessage.textContent = 'Saving...';
      userMessage.className = 'small';
      const method = id ? 'PATCH' : 'POST';
      const url = id ? `/api/users/${id}` : '/api/users';
      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        userMessage.textContent = 'Saved user.';
        userMessage.className = 'success';
        loadUsers();
        closeUserModal();
      } catch (err) {
        userMessage.textContent = 'Failed to save user';
        userMessage.className = 'error';
      }
    });

    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(passwordForm).entries());
      passwordMessage.textContent = 'Updating...';
      passwordMessage.className = 'small';
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const resp = await res.json();
      if (!res.ok) {
        passwordMessage.textContent = resp.error || 'Failed';
        passwordMessage.className = 'error';
        return;
      }
      passwordMessage.textContent = 'Password updated.';
      passwordMessage.className = 'success';
      passwordForm.reset();
    });

    async function testExtraction() {
      if ((vendorForm?.dataset?.mode || 'custom') === 'builtin') {
        vendorMessage.textContent = 'Built-in vendors use their APIs directly.';
        vendorMessage.className = 'small';
        return;
      }
      const url = testUrl.value.trim();
      if (!url) {
        vendorMessage.textContent = 'Provide a URL to test.';
        vendorMessage.className = 'error';
        return;
      }
      const selectors = {
        nameSelector: vendorForm.elements.nameSelector.value || undefined,
        priceSelector: vendorForm.elements.priceSelector.value || undefined
      };
      const headers = {};
      try {
        const notes = vendorForm.elements.notes.value;
        if (notes) {
          const parsed = JSON.parse(notes);
          Object.assign(headers, parsed);
        }
      } catch (e) {
        vendorMessage.textContent = 'Notes/headers not valid JSON.';
        vendorMessage.className = 'error';
        return;
      }

      const resultsEl = document.getElementById('extract-results');
      resultsEl.textContent = 'Testing...';
      try {
        const res = await fetch('/api/vendors/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, selectors, headers })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        resultsEl.textContent = 'Pick which value looks correct for each field. You can paste CSS selectors (e.g., span.money).';

        if (data.shopify) {
          vendorMessage.textContent = 'Shopify data detected. Name/price auto-filled. Editing selectors will override Shopify.';
          vendorMessage.className = 'small';
          if (data.shopify.vendor && !vendorForm.elements.vendor.value) {
            vendorForm.elements.vendor.value = data.shopify.vendor;
          }
          if (data.shopify.variant?.name && !vendorForm.elements.nameSelector.value) {
            previewName.textContent = data.shopify.variant.name;
          }
          if (data.shopify.variant?.price !== undefined && !vendorForm.elements.priceSelector.value) {
            previewPrice.textContent = data.shopify.variant.price.toFixed(2);
          }
        }

        const trim = (t) => (t && t.length > 120 ? t.slice(0, 120) + '…' : t || '');
        const nameOptions = (data.picks?.name ? [{ text: data.picks.name, selector: selectors.nameSelector }] : []).concat(data.candidates?.titles || []);
        const priceOptions = (data.picks?.price ? [{ text: data.picks.price, selector: selectors.priceSelector }] : []).concat(data.candidates?.prices || []);

        const makeOptions = (opts) => opts.map(c => `<option data-text="${c.text || ''}" title="${c.text || ''}" value="${c.selector || ''}">${trim(c.text)}</option>`).join('');
        pickName.innerHTML = '<option value="">-- choose name --</option>' + makeOptions(nameOptions);
        pickPrice.innerHTML = '<option value="">-- choose price --</option>' + makeOptions(priceOptions);

        const applySelection = (selectEl, fieldName, previewEl) => {
          const apply = () => {
            const selOption = selectEl.options[selectEl.selectedIndex];
            const selSelector = selOption?.value || '';
            const selText = selOption?.dataset?.text || selOption?.title || selOption?.text || '';
            if (selSelector) {
              vendorForm.elements[fieldName].value = selSelector;
            }
            if (previewEl) previewEl.textContent = selText;
          };
          selectEl.addEventListener('change', apply);
          if (selectEl.options.length > 1) {
            selectEl.selectedIndex = 1;
            apply();
          }
        };
        applySelection(pickName, 'nameSelector', previewName);
        applySelection(pickPrice, 'priceSelector', previewPrice);
      } catch (err) {
        resultsEl.textContent = 'Extraction failed. Check URL/headers.';
        vendorMessage.textContent = err.message;
        vendorMessage.className = 'error';
      }
    }

    // Live preview when selectors change (uses current test URL if present)
    const debounce = (fn, ms = 400) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };
    const liveExtract = debounce(() => {
      if (!testUrl.value.trim()) return;
      testExtraction();
    }, 500);

    ['nameSelector', 'priceSelector'].forEach(name => {
      vendorForm.elements[name].addEventListener('input', liveExtract);
    });

    function deriveFromSnippet(snippet) {
      if (!snippet) return '';
      const text = snippet.trim().replace(/;$/, '');
      const qsMatch = text.match(/querySelector(All)?\((['"`])([^'"`]+)\2\)/i);
      if (qsMatch) {
        return qsMatch[3].trim();
      }
      // CSS selector only
      return text;
    }

    applySelector.addEventListener('click', () => {
      const sel = deriveFromSnippet(selectorSnippet.value || '');
      if (!sel) return;
      const target = selectorTarget.value;
      vendorForm.elements[target].value = sel;
      liveExtract();
    });

    function guessRegexFromExample(example) {
      if (!example) return '';
      // If looks like ABC-1234 or AM-4896
      if (/^[A-Za-z]{2,}-\d+$/i.test(example)) {
        const prefix = example.split('-')[0];
        return `^${prefix}-\\d+$`;
      }
      // Alphanumeric with dashes
      if (/^[A-Za-z0-9-]+$/.test(example)) {
        return '^[A-Za-z0-9-]+$';
      }
      return '';
    }

    partExample.addEventListener('blur', () => {
      const guess = guessRegexFromExample(partExample.value.trim());
      if (guess && !partPattern.value) {
        partPattern.value = guess;
      }
    });

    testExtract.addEventListener('click', testExtraction);

    function updateUserUI() {
      if (currentUser) {
        userChip.textContent = `${currentUser.name || currentUser.username || 'User'} · ${currentUser.role || ''}`;
        userChip.style.display = 'inline-flex';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        accountBtn.style.display = 'inline-flex';
        tagsBtn.style.display = 'inline-flex';
        catalogBtn.style.display = 'inline-flex';
      } else {
        userChip.textContent = '';
        userChip.style.display = 'none';
        loginBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        accountBtn.style.display = 'none';
        tagsBtn.style.display = 'none';
        catalogBtn.style.display = 'none';
        adminBtn.style.display = 'none';
      }
      const perms = computePerms(currentUser);
      if (currentUser) currentUser.permissions = perms;
      newOrderBtn.disabled = !perms.canPlacePartRequests;
      adminBtn.style.display = (perms.canManageUsers || perms.canManageVendors || perms.canEditTrackingSettings) ? 'inline-flex' : 'none';
      if (addStockBtn) addStockBtn.style.display = perms.canManageStock ? 'inline-flex' : 'none';
      if (manageSubteamsBtn) manageSubteamsBtn.style.display = perms.canManageStock ? 'inline-flex' : 'none';
      updateAdminTabsVisibility();
      syncCatalogSaveUI();
      updateCatalogEditVisibility();
      syncTagEditUI();
      syncVendorImportVisibility();
      syncOrderNotesRequirement();
    }

    async function loadUsers() {
      if (!currentUser?.permissions?.canManageUsers) {
        userList.innerHTML = '<div class="empty">No access to manage users.</div>';
        return;
      }
      userList.textContent = 'Loading users...';
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        const users = data.users || [];
        if (!users.length) {
          userList.innerHTML = '<div class="empty">No users.</div>';
          return;
        }
        userList.innerHTML = users.map(u => `
          <div class="card" data-id="${u._id}" style="margin-bottom:6px;">
            <div class="flex-between">
              <div>
                <div><strong>${u.username}</strong> (${u.role})</div>
                <div class="small">${u.name || ''}</div>
                <div class="small">Active: ${u.active ? 'Yes' : 'No'}</div>
              </div>
              <div class="flex-between" style="gap:8px;">
                <button class="btn ghost" data-action="edit-user">Edit</button>
                <button class="btn ghost" data-action="delete-user" style="color: var(--danger);">Delete</button>
              </div>
            </div>
          </div>
        `).join('');

        userList.querySelectorAll('button[data-action="edit-user"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const id = card.dataset.id;
            const u = users.find(x => x._id === id);
            if (!u) return;
            openUserModal(u);
          });
        });
        userList.querySelectorAll('button[data-action="delete-user"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.closest('.card')?.dataset.id;
            if (!id) return;
            openConfirm('Delete this user?', async () => {
              await fetch(`/api/users/${id}`, { method: 'DELETE' });
              loadUsers();
            });
          });
        });
      } catch (e) {
        userList.textContent = 'Failed to load users';
      }
    }

    async function loadRoles() {
      if (!currentUser?.permissions?.canManageUsers) {
        roleList.innerHTML = '<div class="empty">No access to manage roles.</div>';
        return;
      }
      roleList.textContent = 'Loading roles...';
      try {
        const res = await fetch('/api/roles');
        const data = await res.json();
        const roles = data.roles || [];
        const combined = {
          admin: { canPlacePartRequests: true, canManageOwnPartRequests: true, canManagePartRequests: true, canManageOrders: true, canManageVendors: true, canManageUsers: true, canManageTags: true, canEditInventoryCatalog: true, canEditTrackingSettings: true, canManageStock: true, canEditStock: true, notesNotRequired: true, canImportBulkOrders: true },
          mentor: { canPlacePartRequests: true, canManageOwnPartRequests: true, canManagePartRequests: true, canManageOrders: true, canManageVendors: true, canManageUsers: false, canManageTags: true, canEditInventoryCatalog: true, canEditTrackingSettings: true, canManageStock: true, canEditStock: true, notesNotRequired: true, canImportBulkOrders: false },
          student: { canPlacePartRequests: true, canManageOwnPartRequests: false, canManagePartRequests: false, canManageOrders: false, canManageVendors: false, canManageUsers: false, canManageTags: false, canEditInventoryCatalog: false, canEditTrackingSettings: false, canManageStock: false, canEditStock: false, notesNotRequired: false, canImportBulkOrders: false }
        };
        roles.forEach(r => { combined[r.role] = { ...(combined[r.role] || {}), ...(r.permissions || {}) }; });

        const renderToggle = (role, key, label) => {
          const disabled = role === 'admin' ? 'disabled' : '';
          return `
          <label class="small" style="display:flex; align-items:center; gap:6px;">
            <input type="checkbox" data-role="${role}" data-key="${key}" ${combined[role]?.[key] ? 'checked' : ''} ${disabled}/>
            ${label}
          </label>`;
        };

        const roleCard = (role) => `
          <div class="card" style="margin-bottom:8px;">
            <div class="page-title" style="font-size:16px;">${role}</div>
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:6px;">
              ${renderToggle(role, 'canEditStock', 'Manage Stock Levels')}
              ${renderToggle(role, 'canPlacePartRequests', 'Place Part Requests')}
              ${renderToggle(role, 'canManagePartRequests', 'Manage Part Requests')}
              ${renderToggle(role, 'canManageOwnPartRequests', 'Manage Own Part Requests')}
              ${renderToggle(role, 'canManageOrders', 'Create and Manage Orders')}
              ${renderToggle(role, 'canManageTags', 'Manage Tags')}
              ${renderToggle(role, 'canEditInventoryCatalog', 'Manage Inventory Catalog')}
              ${renderToggle(role, 'canManageStock', 'Manage Tracked Stock & Locations')}
              ${renderToggle(role, 'canManageVendors', 'Manage Vendors')}
              ${renderToggle(role, 'canManageUsers', 'Manage Users')}
              ${renderToggle(role, 'canEditTrackingSettings', 'Edit Tracking Settings')}
              ${renderToggle(role, 'notesNotRequired', 'Notes/Justification Not Required')}
              ${renderToggle(role, 'canImportBulkOrders', 'Can Import Bulk Orders')}
            </div>
            ${role === 'admin'
              ? `<div class="small" style="margin-top:8px;">Admin permissions are fixed and cannot be changed.</div>`
              : `<div class="flex-between" style="margin-top:8px;">
                  <button class="btn primary" data-action="save-role" data-role="${role}">Save ${role}</button>
                </div>`}
          </div>`;

        roleList.innerHTML = ['admin', 'mentor', 'student'].map(roleCard).join('');
        if (roleMessage) roleMessage.textContent = '';

        roleList.querySelectorAll('button[data-action="save-role"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const role = e.target.dataset.role;
            if (role === 'admin') {
              if (roleMessage) {
                roleMessage.textContent = 'Admin permissions are fixed and cannot be edited.';
                roleMessage.className = 'small';
              }
              return;
            }
            const inputs = roleList.querySelectorAll(`input[data-role="${role}"]`);
            const perms = {};
            inputs.forEach(input => {
              perms[input.dataset.key] = input.checked;
            });
            await fetch(`/api/roles/${role}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permissions: perms })
            });
            if (roleMessage) {
              roleMessage.textContent = `Saved permissions for ${role}.`;
              roleMessage.className = 'success';
            }
          });
        });
      } catch (e) {
        roleList.textContent = 'Failed to load roles';
        if (roleMessage) {
          roleMessage.textContent = 'Failed to load roles.';
          roleMessage.className = 'error';
        }
      }
    }

    async function syncTrackingAutoRefreshFromServer() {
      try {
        const res = await fetch('/api/tracking/settings');
        if (!res.ok) return;
        const data = await res.json();
        const minutes = Number(data.settings?.refreshMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
          startTrackingAutoRefresh(minutes);
        }
      } catch (_) {
        // ignore - auto refresh will keep existing cadence
      }
    }

    async function loadTrackingSettings() {
      if (!trackingSettingsForm) return;
      trackingSettingsMessage.textContent = 'Loading tracking settings...';
      trackingSettingsMessage.className = 'small';
      try {
        const res = await fetch('/api/tracking/settings');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load settings');
        const settings = data.settings || {};
        ['upsClientId','upsClientSecret','uspsUserId','fedexClientId','fedexClientSecret'].forEach(key => {
          if (trackingSettingsForm.elements[key]) {
            trackingSettingsForm.elements[key].value = settings[key] || '';
          }
        });
        if (trackingSettingsForm.elements.refreshMinutes) {
          trackingSettingsForm.elements.refreshMinutes.value = settings.refreshMinutes || 30;
        }
        if (settings.refreshMinutes) {
          startTrackingAutoRefresh(settings.refreshMinutes);
        }
        trackingSettingsMessage.textContent = 'Tracking settings loaded.';
        trackingSettingsMessage.className = 'small';
      } catch (e) {
        trackingSettingsMessage.textContent = e.message || 'Failed to load tracking settings';
        trackingSettingsMessage.className = 'error';
      }
    }

    trackingSettingsForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(trackingSettingsForm).entries());
      payload.refreshMinutes = Number(payload.refreshMinutes || 30);
      if (!Number.isFinite(payload.refreshMinutes) || payload.refreshMinutes <= 0) {
        payload.refreshMinutes = 30;
      }
      trackingSettingsMessage.textContent = 'Saving...';
      trackingSettingsMessage.className = 'small';
      try {
        const res = await fetch('/api/tracking/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save settings');
        trackingSettingsMessage.textContent = 'Saved tracking settings.';
        trackingSettingsMessage.className = 'success';
        startTrackingAutoRefresh(payload.refreshMinutes);
      } catch (err) {
        trackingSettingsMessage.textContent = err.message || 'Failed to save settings';
        trackingSettingsMessage.className = 'error';
      }
    });

    refreshTrackingNow?.addEventListener('click', async () => {
      trackingSettingsMessage.textContent = 'Refreshing tracking now...';
      trackingSettingsMessage.className = 'small';
      try {
        const res = await fetch('/api/tracking/refresh', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to refresh');
        if (data.lastError) {
          trackingSettingsMessage.textContent = `Refresh triggered, but tracking error: ${data.lastError}`;
          trackingSettingsMessage.className = 'error';
        } else {
          trackingSettingsMessage.textContent = 'Refresh triggered. Data will update shortly.';
          trackingSettingsMessage.className = 'success';
        }
        fetchOrders();
      } catch (err) {
        trackingSettingsMessage.textContent = err.message || 'Failed to refresh tracking';
        trackingSettingsMessage.className = 'error';
      }
    });

    function allowedAdminTabs() {
      const tabs = [];
      if (currentUser?.permissions?.canManageUsers) {
        tabs.push('users', 'roles');
      }
      if (currentUser?.permissions?.canEditTrackingSettings) {
        tabs.push('tracking');
      }
      if (currentUser?.permissions?.canManageVendors) {
        tabs.push('vendors');
      }
      return tabs;
    }

    function updateAdminTabsVisibility() {
      const allowed = allowedAdminTabs();
      if (adminTabUsers) adminTabUsers.style.display = currentUser?.permissions?.canManageUsers ? 'inline-flex' : 'none';
      if (adminTabRoles) adminTabRoles.style.display = currentUser?.permissions?.canManageUsers ? 'inline-flex' : 'none';
      if (adminTabTracking) adminTabTracking.style.display = currentUser?.permissions?.canEditTrackingSettings ? 'inline-flex' : 'none';
      if (adminTabVendors) adminTabVendors.style.display = currentUser?.permissions?.canManageVendors ? 'inline-flex' : 'none';
      if (!allowed.includes(activeAdminTab)) {
        activeAdminTab = allowed[0] || null;
      }
      if (adminUsersSection) adminUsersSection.style.display = 'none';
      if (adminRolesSection) adminRolesSection.style.display = 'none';
      if (adminTrackingSection) adminTrackingSection.style.display = 'none';
      if (adminVendorsSection) adminVendorsSection.style.display = 'none';
    }

    function showAdminSection(which) {
      const allowed = allowedAdminTabs();
      if (!allowed.length) return;
      if (!allowed.includes(which)) which = allowed[0];
      activeAdminTab = which;
      adminUsersSection.style.display = which === 'users' ? 'block' : 'none';
      if (adminRolesSection) adminRolesSection.style.display = which === 'roles' ? 'block' : 'none';
      adminTrackingSection.style.display = which === 'tracking' ? 'block' : 'none';
      adminVendorsSection.style.display = which === 'vendors' ? 'block' : 'none';
      [adminTabUsers, adminTabRoles, adminTabTracking, adminTabVendors].forEach(btn => btn?.classList.remove('primary'));
      if (which === 'users') adminTabUsers?.classList.add('primary');
      if (which === 'roles') adminTabRoles?.classList.add('primary');
      if (which === 'tracking') adminTabTracking?.classList.add('primary');
      if (which === 'vendors') adminTabVendors?.classList.add('primary');
    }
    adminTabUsers?.addEventListener('click', () => showAdminSection('users'));
    adminTabRoles?.addEventListener('click', () => { showAdminSection('roles'); loadRoles(); });
    adminTabTracking?.addEventListener('click', () => showAdminSection('tracking'));
    adminTabVendors?.addEventListener('click', () => { showAdminSection('vendors'); loadVendors(); });

    async function fetchMe() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('unauth');
        const data = await res.json();
        currentUser = data.user;
        currentUser.permissions = computePerms(currentUser);
        setAuthenticated(true);
        updateUserUI();
        syncCatalogSaveUI();
        await syncTrackingAutoRefreshFromServer();
        await loadTags();
        await loadPriorityTags();
        fetchOrders();
        await loadStock();
        await loadSubteams();
        loadVendors();
        loadUsers();
        refreshCatalogView();
      } catch {
        currentUser = null;
        setAuthenticated(false);
        updateUserUI();
        resetCatalogSavePanel();
        resetCatalogLookup();
        stockItems = [];
        renderStockGrid();
        renderStockFilters();
      }
    }

    loginBtn.addEventListener('click', () => {
      if (loginMessage) { loginMessage.textContent = ''; loginMessage.style.display = 'none'; }
      if (loginForm) loginForm.reset();
      setAuthenticated(false);
    });
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      setAuthenticated(false);
      if (loginForm) loginForm.reset();
      updateUserUI();
      resetCatalogSavePanel();
      resetCatalogLookup();
      orders = [];
      renderBoard();
      renderTable();
      stockItems = [];
      renderStockGrid();
      stockSubteams = [];
      renderStockFilters();
      showOrdersView();
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData.entries());
      loginMessage.textContent = 'Signing in...';
      loginMessage.className = 'login-status';
      loginMessage.style.display = 'block';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        loginMessage.textContent = data.error || 'Login failed';
        loginMessage.className = 'login-error';
        loginMessage.style.display = 'block';
        return;
      }
      currentUser = data.user;
      currentUser.permissions = computePerms(currentUser);
      loginMessage.textContent = '';
      loginMessage.style.display = 'none';
      if (loginForm) loginForm.reset();
      setAuthenticated(true);
      updateUserUI();
      syncCatalogSaveUI();
      syncTrackingAutoRefreshFromServer();
      await loadTags();
      await loadPriorityTags();
      fetchOrders();
      await loadStock();
      await loadSubteams();
      loadVendors();
      loadUsers();
      refreshCatalogView();
    });

    updateSearchPlaceholder();
    startTrackingAutoRefresh(DEFAULT_TRACKING_POLL_MINUTES);
    fetchMe();
  
