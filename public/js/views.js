function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}
function formatShortDate(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}
function formatTimeShort(date = new Date()) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDateOnly(input) {
  if (!input) return "";
  // If we get an ISO-ish string, parse the date portion explicitly to avoid TZ shifts.
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      if (y && m && d) return `${m}/${d}/${String(y).slice(-2)}`;
    }
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  // Use UTC components to avoid local TZ shifting ETA dates.
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const y = String(date.getUTCFullYear()).slice(-2);
  return `${m}/${d}/${y}`;
}
function formatDateMaybe(value) {
  if (!value) return "";
  if (typeof value === "number") return formatDateOnly(value);
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return formatDateOnly(parsed);
  return value;
}
function getTagLabel(id) {
  const t = tagList.find(
    (t) => String(t._id || t.id || t.label) === String(id),
  );
  return t ? t.label : id;
}
function getTagColor(id) {
  const t = tagList.find(
    (t) => String(t._id || t.id || t.label) === String(id),
  );
  return t ? t.color || "#fdd023" : "#fdd023";
}
function getPriorityColor(label) {
  const p = priorityList.find(
    (p) => (p.label || "").toLowerCase() === (label || "").toLowerCase(),
  );
  return p ? p.color || "#fdd023" : "#fdd023";
}
function getStatusTagColor(label) {
  if (!label) return "#fdd023";
  const match = (statusTagList || []).find(
    (s) => (s.label || "").toLowerCase() === (label || "").toLowerCase(),
  );
  return match ? match.color || "#fdd023" : "#fdd023";
}
function defaultStatusTagLabel() {
  if (!statusTagList || !statusTagList.length) return "";
  const sorted = [...statusTagList].sort((a, b) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return (a.label || "").localeCompare(b.label || "");
  });
  return sorted[0]?.label || "";
}
function renderTagChips(ids = []) {
  if (!ids || !ids.length) return "";
  return ids
    .map((tid) => {
      const label = getTagLabel(tid);
      const color = getTagColor(tid);
      return `<span class="tag" style="background:${color}22; border-color:${color}; color:${color};">${escapeHtml(label)}</span>`;
    })
    .join("");
}
function getSelectedTagIds() {
  if (!tagSelect) return [];
  return Array.from(tagSelect.selectedOptions || []).map((o) => o.value);
}
function escapeHtml(str = "") {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let reimbursements = [];
let reimbursementsScope = "all";
let currentOrderInvoices = [];
let activeInvoiceOrderId = null;
let activeInvoiceOrders = [];
let reimbursementsSelected = new Set();
let lastDeletedInvoice = null;
let lastDeletedList = [];
const defaultReimbursementStatusOptions = [
  { value: "requested", label: "Reimbursement requested" },
  { value: "submitted", label: "Reimbursement submitted" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "declined", label: "Declined" },
  { value: "not_requested", label: "Not requested" },
];

function getReimbursementStatusOptions() {
  const list =
    Array.isArray(window?.__reimbursementTags) &&
    window.__reimbursementTags.length
      ? window.__reimbursementTags
      : defaultReimbursementStatusOptions;
  return list.map((o) => ({
    value: o.value || o.label,
    label: o.label || o.value,
    color: o.color,
  }));
}

function primaryFileLink(inv) {
  if (!inv || !Array.isArray(inv.files)) return "";
  const file = inv.files.find(
    (f) => f.driveFileId || f.driveWebViewLink || f.driveDownloadLink,
  );
  if (!file) return "";
  if (file.driveFileId) {
    const id = inv._id || inv.id || "";
    return `/api/invoices/${id}/file/${file.driveFileId}`;
  }
  return file.driveWebViewLink || file.driveDownloadLink || "";
}

function renderGroupInvoiceSummary(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  const totals = items.reduce(
    (acc, o) => {
      const s = o.reimbursementSummary || {};
      acc.count += s.count || 0;
      acc.requestedCount += s.requestedCount || 0;
      if (s.statuses && s.statuses.length) {
        s.statuses.forEach((st) => acc.statuses.add(st));
      }
      if (s.latestStatus) acc.latestStatus = s.latestStatus;
      return acc;
    },
    { count: 0, requestedCount: 0, statuses: new Set(), latestStatus: null },
  );
  if (!totals.count) return "";
  const statuses = getReimbursementStatusOptions();
  const sorted = statuses
    .map((s, idx) => ({ ...s, sort: s.sortOrder ?? idx }))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const highest = sorted[sorted.length - 1]?.value || "reimbursed";
  const allAtHighest = Array.from(totals.statuses).every(
    (st) => st === highest,
  );
  const color = allAtHighest ? "var(--success)" : "var(--danger)";
  return `<span class="tag invoice-summary" style="border-color:${color}; color:${color}; min-width:auto;">Invoices: ${totals.count}</span>`;
}

function createTrackingRow(container, data = {}, partsOptions = []) {
  if (!container) return;
  const row = document.createElement("div");
  row.className = "tracking-row";
  row.innerHTML = `
<select class="input tracking-carrier">
  ${carrierOptions.map((c) => `<option value="${c.value}">${c.label}</option>`).join("")}
</select>
<input class="input tracking-number" placeholder="Tracking number" value="${data.trackingNumber || data.number || ""}" />
<button type="button" class="btn ghost remove-tracking" style="padding:6px 10px;">Remove</button>
<div class="small" style="width:100%;">Parts in this shipment (optional)</div>
<div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:6px; width:100%;">
  <select class="input tracking-parts" multiple size="${Math.min(Math.max(partsOptions.length, 2), 6)}">
    ${partsOptions.map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join("")}
  </select>
  <button type="button" class="btn ghost select-all-parts" style="padding:6px 10px;">Select all</button>
</div>
  `;
  const select = row.querySelector(".tracking-carrier");
  const carrier = (data.carrier || "").toLowerCase();
  if (carrier) select.value = carrier;
  row.querySelector(".remove-tracking").addEventListener("click", () => {
    row.remove();
    if (!container.querySelector(".tracking-row")) {
      createTrackingRow(container, {}, partsOptions);
    }
  });
  const partsSelect = row.querySelector(".tracking-parts");
  const selectAllBtn = row.querySelector(".select-all-parts");
  if (partsSelect && Array.isArray(data.parts)) {
    Array.from(partsSelect.options).forEach((opt) => {
      if (data.parts.includes(opt.value)) opt.selected = true;
    });
  }
  selectAllBtn?.addEventListener("click", () => {
    Array.from(partsSelect.options).forEach((opt) => {
      opt.selected = true;
    });
  });
  container.appendChild(row);
}

function setTrackingRows(container, entries = [], partsOptions = []) {
  if (!container) return;
  container.innerHTML = "";
  const list = Array.isArray(entries) && entries.length ? entries : [];
  if (!list.length) {
    createTrackingRow(container, {}, partsOptions);
    return;
  }
  list.forEach((entry) => createTrackingRow(container, entry, partsOptions));
}

function collectTrackingRows(container) {
  if (!container) return [];
  const rows = Array.from(container.querySelectorAll(".tracking-row"));
  return rows
    .map((row) => {
      const number = row.querySelector(".tracking-number")?.value.trim();
      const carrier = row.querySelector(".tracking-carrier")?.value || "other";
      if (!number) return null;
      const partsSel = row.querySelector(".tracking-parts");
      const parts = partsSel
        ? Array.from(partsSel.selectedOptions).map((o) => o.value)
        : undefined;
      return {
        carrier,
        trackingNumber: number,
        parts: parts && parts.length ? parts : undefined,
      };
    })
    .filter(Boolean);
}

function trackingFromOrder(order) {
  if (!order) return [];
  if (Array.isArray(order.tracking) && order.tracking.length)
    return order.tracking;
  if (order.trackingNumber)
    return [
      {
        carrier: order.carrier || "unknown",
        trackingNumber: order.trackingNumber,
      },
    ];
  return [];
}

function trackingLink(carrier, num, fallback) {
  if (fallback) return fallback;
  if (!num) return "";
  const c = (carrier || "").toLowerCase();
  if (c === "ups")
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
  if (c === "usps")
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
  if (c === "fedex")
    return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(num)}`;
  return "";
}

function attachBackdropClose(el, handler) {
  if (!el || typeof handler !== "function") return;
  let downOnBackdrop = false;
  el.addEventListener("pointerdown", (e) => {
    downOnBackdrop = e.target === el;
  });
  el.addEventListener("pointerup", (e) => {
    if (downOnBackdrop && e.target === el) handler();
    downOnBackdrop = false;
  });
}

function trackingPhase(tracking) {
  const carrierSupported = ["ups", "usps", "fedex"].includes(
    (tracking.carrier || "").toLowerCase(),
  );
  if (tracking.delivered || tracking.cache?.delivered) return "delivered";
  const statusText = (
    tracking.status ||
    tracking.cache?.status ||
    tracking.cache?.summary ||
    ""
  ).toLowerCase();
  if (!carrierSupported) return "unknown";
  if (
    /label|pending|ready for shipment|not shipped|waiting|created/i.test(
      statusText,
    )
  )
    return "pending";
  return "intransit";
}

function renderTrackingBadges(tracking = []) {
  const list = Array.isArray(tracking)
    ? tracking.filter((t) => t && t.trackingNumber)
    : [];
  if (!list.length) return "";
  return `<div class="tracking-badges">${list
    .map((t) => {
      const url = trackingLink(
        t.carrier,
        t.trackingNumber,
        t.trackingUrl || t.cache?.trackingUrl,
      );
      const label = `${(t.carrier || "TRACK").toUpperCase()} ${t.trackingNumber}`;
      const status = t.cache?.status || t.cache?.summary || t.status || "";
      const delivered = Boolean(t.cache?.delivered);
      const deliveredOn = delivered
        ? t.cache?.lastEventTime ||
          t.cache?.deliveredTime ||
          t.deliveredTime ||
          t.lastUpdated ||
          t.lastEvent ||
          t.lastUpdatedAt ||
          t.lastCheckedAt ||
          t.cache?.lastCheckedAt
        : undefined;
      const etaText = !delivered ? t.cache?.eta || t.eta : undefined;
      const subtitleParts = [];
      if (delivered) {
        subtitleParts.push(
          `Delivered${deliveredOn ? " on " + formatDateOnly(deliveredOn) : ""}`,
        );
      } else if (etaText) {
        const etaFmt = formatDateMaybe(etaText);
        subtitleParts.push(`ETA ${etaFmt || etaText}`);
      } else if (status) {
        subtitleParts.push(status);
      } else {
        subtitleParts.push("Refreshing status…");
      }
      const subtitle = subtitleParts.filter(Boolean).join(" · ");
      const safeSubtitle = escapeHtml(subtitle || "");
      const safeLabel = escapeHtml(label || "");
      const phase = trackingPhase(t);
      const badge = `<span class="tag tracking ${phase}" title="${safeSubtitle || "Open tracking"}">${safeLabel}${subtitle ? " · " + safeSubtitle : ""}</span>`;
      return url
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${badge}</a>`
        : badge;
    })
    .join("")}</div>`;
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return `$${num.toFixed(2)}`;
}

function formatReimbursementStatus(status) {
  const options = getReimbursementStatusOptions();
  const found = options.find((o) => o.value === status);
  if (found) return found.label || found.value || "Unknown";
  if (options.length && status === "requested") {
    const first = options[0];
    return first.label || first.value || "Unknown";
  }
  const map = {
    requested: "Reimbursement requested",
    submitted: "Submitted",
    reimbursed: "Reimbursed",
    declined: "Declined",
    not_requested: "Not requested",
  };
  return map[status] || status || "Unknown";
}

function reimbursementStatusColor(status) {
  const options = getReimbursementStatusOptions();
  const found = options.find((o) => o.value === status);
  if (found?.color) return found.color;
  if (options.length && status === "requested" && options[0]?.color)
    return options[0].color;
  switch (status) {
    case "reimbursed":
      return "var(--success)";
    case "submitted":
      return "var(--accent-2)";
    case "requested":
      return "var(--gold)";
    case "declined":
      return "var(--danger)";
    default:
      return "var(--muted)";
  }
}

function invoiceDisplayAmount(inv) {
  return (
    inv?.amount ?? inv?.reimbursementAmount
  );
}

function renderInvoiceFiles(files = [], invoiceId = null) {
  if (!Array.isArray(files) || !files.length) return "";
  return files
    .map((f, idx) => {
      const url =
        f.driveFileId && (invoiceId || window.activeInvoiceId)
          ? `/api/invoices/${invoiceId || window.activeInvoiceId}/file/${f.driveFileId}`
          : f.driveWebViewLink || f.driveDownloadLink;
      const label = f.name || `File ${idx + 1}`;
      return url
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="tag" style="padding:4px 8px;">${escapeHtml(label)}</a>`
        : `<span class="tag" style="padding:4px 8px;">${escapeHtml(label)}</span>`;
    })
    .join(" ");
}

function renderInvoiceStatusChip(status) {
  const color = reimbursementStatusColor(status);
  return `<span class="tag" style="border-color:${color}; color:${color};">${formatReimbursementStatus(status)}</span>`;
}

function renderInvoiceCards(invoices = []) {
  const canManage = Boolean(currentUser?.permissions?.canManageInvoices);
  const canSubmit = Boolean(currentUser?.permissions?.canSubmitInvoices);
  if (!invoices.length) return '<div class="small">No invoices uploaded yet.</div>';
  const userMap =
    Array.isArray(window.__allUsers) && window.__allUsers.length
      ? window.__allUsers.reduce((acc, u) => {
          acc[u._id || u.id] = u.name || u.username || "";
          return acc;
        }, {})
      : {};
  return invoices
    .map((inv) => {
      const amt = invoiceDisplayAmount(inv);
      const statusChip = renderInvoiceStatusChip(
        inv.reimbursementStatus || "not_requested",
      );
      const fileLink = primaryFileLink(inv);
      const recipient =
        inv.reimbursementUserName ||
        userMap[inv.reimbursementUser] ||
        inv.requestedByName ||
        inv.studentName ||
        "";
      return `<div class="card" data-id="${inv._id}" style="margin-bottom:8px;">
        <div class="flex-between" style="align-items:flex-start; gap:8px; flex-wrap:wrap;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div class="page-title" style="font-size:16px;">${statusChip}</div>
            <div class="small">Submitted: ${fmtDate(inv.requestedAt)}</div>
            <div class="small">By: ${escapeHtml(inv.requestedByName || inv.studentName || '')}</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${fileLink ? `<button class="btn ghost" data-action="view-file" data-url="${fileLink}" style="padding:6px 10px;">View file</button>` : ""}
            ${(canManage || canSubmit) ? `<button class="btn ghost" data-action="edit-invoice" data-id="${inv._id}" style="padding:6px 10px;">Edit</button>` : ""}
            ${(canManage || canSubmit) ? `<button class="btn ghost" data-action="delete-invoice" data-id="${inv._id}" style="padding:6px 10px; border-color: var(--danger); color: var(--danger);">Delete</button>` : ""}
          </div>
        </div>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:6px; margin-top:6px;">
          <div class="small">Invoice total: ${amt !== undefined ? formatMoney(amt) : 'n/a'}</div>
          <div class="small">Reimbursement: ${inv.reimbursementRequested ? 'Yes' : 'No'}</div>
          <div class="small">Recipient: ${escapeHtml(recipient)}</div>
          <div class="small">Status: ${formatReimbursementStatus(inv.reimbursementStatus)}</div>
        </div>
        <div class="small" style="margin-top:6px;">${renderInvoiceFiles(inv.files, inv._id || inv.id)}</div>
      </div>`;
    })
    .join("");
}

function showBoardMessage(text, type = "info", timeout = 3500) {
  boardMessage.textContent = text;
  boardMessage.style.borderColor =
    type === "error" ? "var(--danger)" : "var(--border)";
  boardMessage.style.color = type === "error" ? "var(--danger)" : "var(--text)";
  boardMessage.style.display = "block";
  if (showBoardMessage._t) clearTimeout(showBoardMessage._t);
  showBoardMessage._t = setTimeout(() => {
    boardMessage.style.display = "none";
  }, timeout);
}

function matchesSearch(order, term) {
  if (!term) return true;
  const trackingText = (order.tracking || [])
    .map((t) =>
      [t.trackingNumber, t.carrier, t.cache?.status, t.cache?.summary]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const groupTrackingText = (order.group?.tracking || [])
    .map((t) =>
      [t.trackingNumber, t.carrier, t.cache?.status, t.cache?.summary]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const hay = [
    order.partName,
    order.vendorPartNumber,
    order.partLink,
    order.studentName,
    order.supplier,
    order.productCode,
    order.orderNumber,
    order.category,
    order.priority,
    order.group && order.group.title,
    order.group && order.group.trackingNumber,
    trackingText,
    groupTrackingText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(term.toLowerCase());
}

function withinDate(order, start, end) {
  if (!start && !end) return true;
  const ts =
    order.requestedDisplayAt ||
    order.requestedAt ||
    Date.parse(order.createdAt || "") ||
    0;
  if (start && ts < start) return false;
  if (end && ts > end) return false;
  return true;
}

function filteredOrders() {
  const term = globalSearch.value.trim();
  const s = statusFilter.value;
  const v = vendorFilter.value;
  const start = startDate.value ? Date.parse(startDate.value) : null;
  const end = endDate.value
    ? Date.parse(endDate.value) + 24 * 60 * 60 * 1000
    : null; // inclusive
  return orders
    .filter(
      (o) =>
        matchesSearch(o, term) &&
        (!s || o.status === s) &&
        (!v || (o.supplier || "").toLowerCase() === v.toLowerCase()) &&
        withinDate(o, start, end),
    )
    .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
}

async function fetchOrders() {
  if (!currentUser) return;
  const res = await fetch("/api/orders");
  const data = await res.json();
  orders = (data.orders || []).map((o) => ({
    ...o,
    tracking: o.tracking || [],
    group: o.group ? { ...o.group, tracking: o.group.tracking || [] } : null,
    _id: o._id || o.id || o.orderNumber,
  }));
  // Debug tracking payloads for visibility
  console.log(
    "[tracking] orders loaded",
    orders.map((o) => ({
      id: o._id,
      tracking: o.tracking,
      groupTracking: o.group?.tracking,
    })),
  );
  const allTracking = [];
  orders.forEach((o) => {
    (o.tracking || []).forEach((t) => allTracking.push(t));
    (o.group?.tracking || []).forEach((t) => allTracking.push(t));
  });
  const lastChecked = allTracking
    .map(
      (t) =>
        t.lastCheckedAt ||
        t.cache?.lastCheckedAt ||
        t.cache?.lastEventTime ||
        t.lastUpdated,
    )
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const trackingErrors = allTracking
    .map((t) => t.cache?.summary || t.cache?.status || t.status)
    .filter(
      (msg) => msg && /error|missing|invalid|unauthorized|fail/i.test(msg),
    );
  const trackingUpdatedEl = document.getElementById("tracking-updated");
  if (trackingUpdatedEl) {
    const errText = trackingErrors.length
      ? ` · Tracking error: ${trackingErrors[0]}`
      : "";
    trackingUpdatedEl.textContent =
      (lastChecked ? `Tracking updated ${fmtDate(lastChecked)}` : "") + errText;
  }
  buildFilters();
  renderBoard();
  renderTable();
  updateSelectionBar();
  updateUndoRedoUI();
}

async function updateInvoice(invoiceId, payload) {
  const res = await fetch(`/api/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Unable to update invoice");
  }
  return data.invoice;
}

async function deleteInvoice(invoiceId) {
  const res = await fetch(`/api/invoices/${invoiceId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Unable to delete invoice");
  }
  return true;
}

async function loadInvoicesForOrder(orderId) {
  if (!orderId) return;
  const res = await fetch(`/api/invoices?orderId=${encodeURIComponent(orderId)}`);
  const data = await res.json();
  currentOrderInvoices = data.invoices || [];
  renderInvoiceExistingList();
}

function buildFilters() {
  const statusesUnique = Array.from(
    new Set(orders.map((o) => o.status).filter(Boolean)),
  );
  statusFilter.innerHTML = [
    '<option value="">All statuses</option>',
    ...statusesUnique.map((s) => `<option>${s}</option>`),
  ].join("");
  const vendors = Array.from(
    new Set(orders.map((o) => (o.supplier || "").trim()).filter(Boolean)),
  );
  vendorFilter.innerHTML = [
    '<option value="">All vendors</option>',
    ...vendors.map((v) => `<option>${v}</option>`),
  ].join("");
}

function renderReimbursementFilters() {
  if (reimbursementStatusFilter) {
    const current = reimbursementStatusFilter.value || "";
    reimbursementStatusFilter.innerHTML = [
      '<option value="">All statuses</option>',
      ...getReimbursementStatusOptions().map(
        (opt) =>
          `<option value="${opt.value}" ${
            opt.value === current ? "selected" : ""
          }>${opt.label}</option>`,
      ),
    ].join("");
  }
  if (reimbursementScopeFilter) {
    updateReimbursementScopeOptions(reimbursements);
  }
  if (reimbursementVendorFilter) {
    const vendorsSet = new Set();
    (reimbursements || []).forEach((inv) => {
      if (inv.vendor) vendorsSet.add(inv.vendor);
      if (inv.orderId) {
        const order = (orders || []).find((o) => o._id === inv.orderId);
        if (order?.vendor) vendorsSet.add(order.vendor);
        if (order?.supplier) vendorsSet.add(order.supplier);
        if (order?.group?.supplier) vendorsSet.add(order.group.supplier);
      }
    });
    const vendors = Array.from(vendorsSet).sort((a, b) =>
      String(a || "").localeCompare(String(b || "")),
    );
    const current = reimbursementVendorFilter.value || "";
    reimbursementVendorFilter.innerHTML = [
      '<option value="">All vendors</option>',
      ...vendors.map(
        (v) =>
          `<option value="${escapeHtml(v)}"${v === current ? " selected" : ""}>${escapeHtml(v)}</option>`,
      ),
    ].join("");
  }
  if (reimbursementsBulkStatus) {
    reimbursementsBulkStatus.innerHTML = getReimbursementStatusOptions()
      .map(
        (opt) =>
          `<option value="${opt.value}">${escapeHtml(opt.label || opt.value)}</option>`,
      )
      .join("");
  }
}

function updateReimbursementScopeOptions(list = []) {
  if (!reimbursementScopeFilter) return;
  const canViewAll =
    currentUser?.permissions?.canViewInvoices ||
    currentUser?.permissions?.canManageInvoices;
  const userMap = new Map();
  list.forEach((inv) => {
    const id = inv.requestedBy;
    const name = inv.requestedByName || inv.studentName;
    if (id && name) userMap.set(id, name);
  });
  if (!userMap.has(currentUser?._id) && currentUser) {
    userMap.set(
      currentUser._id,
      currentUser.name || currentUser.username || "My invoices",
    );
  }
  const current = reimbursementScopeFilter.value || reimbursementsScope || "all";
  const options = [];
  if (canViewAll) options.push({ value: "all", label: "All invoices" });
  const entries = Array.from(userMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  entries.forEach((opt) => {
    options.push(opt);
  });
  reimbursementScopeFilter.innerHTML = options
    .map(
      (opt) =>
        `<option value="${opt.value}" ${
          opt.value === current ? "selected" : ""
        }>${escapeHtml(opt.label)}</option>`,
    )
    .join("");
  reimbursementsScope = options.find((o) => o.value === current)
    ? current
    : canViewAll
      ? "all"
      : (currentUser?._id || "mine");
  reimbursementScopeFilter.value = reimbursementsScope;
}

function filteredReimbursements() {
  const term = (globalSearch?.value || "").trim().toLowerCase();
  const statusVal = reimbursementStatusFilter?.value || "";
  const vendorVal = reimbursementVendorFilter?.value || "";
  const scopeVal = reimbursementScopeFilter?.value || reimbursementsScope || "";
  return (reimbursements || [])
    .filter((inv) => {
      if (statusVal && inv.reimbursementStatus !== statusVal) return false;
      if (
        vendorVal &&
        (inv.vendor || "").trim().toLowerCase() !==
          vendorVal.trim().toLowerCase()
      )
        return false;
      if (
        scopeVal &&
        scopeVal !== "all" &&
        inv.requestedBy !== scopeVal
      )
        return false;
      if (!term) return true;
      const haystack = [
        inv.orderNumber,
        inv.studentName,
        inv.vendor,
        inv.requestedByName,
        inv.reimbursementStatus,
        ...(inv.files || []).map((f) => f?.name || ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
}

function renderReimbursementsTable() {
  if (!reimbursementsTable) return;
  const canManage = Boolean(currentUser?.permissions?.canManageInvoices);
  const rows = filteredReimbursements();
  if (!rows.length) {
    reimbursementsTable.innerHTML =
      '<div class="small">No invoices found.</div>';
    reimbursementsSelected.clear();
    updateReimbursementsSelectionText();
    return;
  }
  reimbursementsTable.innerHTML = `
    <div class="table-row header" style="font-weight:700; display:grid; grid-template-columns: ${canManage ? "0.5fr " : ""}1.2fr 1fr 0.8fr 1fr 1fr 0.8fr 0.8fr; gap:8px; align-items:center; padding:8px;">
      ${canManage ? "<div></div>" : ""}
      <div>Order</div>
      <div>Person</div>
      <div>Amount</div>
      <div>Status</div>
      <div>Files</div>
      <div>Submitted</div>
      <div>Actions</div>
    </div>
    ${rows
      .map((inv) => {
        const amt = invoiceDisplayAmount(inv);
        const checked = reimbursementsSelected.has(inv._id);
        const statusChip = renderInvoiceStatusChip(
          inv.reimbursementStatus || "not_requested",
        );
        const order =
          (orders || []).find((o) => o._id === inv.orderId) || null;
        const orderName =
          inv.groupTitle ||
          order?.group?.title ||
          order?.partName ||
          order?.vendor ||
          inv.vendor ||
          "";
        return `<div class="table-row" data-id="${inv._id}" style="display:grid; grid-template-columns: ${canManage ? "0.5fr " : ""}1.2fr 1fr 0.8fr 1fr 1fr 0.8fr 0.8fr; gap:8px; align-items:center; padding:8px; border-bottom:1px solid var(--border);">
          ${
            canManage
              ? `<div><input type="checkbox" class="reimb-select" data-id="${inv._id}" ${checked ? "checked" : ""}/></div>`
              : ""
          }
          <div>
            <div class="small">${escapeHtml(orderName || "")}</div>
          </div>
          <div>${escapeHtml(inv.requestedByName || inv.studentName || "")}</div>
          <div>${amt !== undefined ? formatMoney(amt) : ""}</div>
          <div>${statusChip}</div>
          <div class="small">${renderInvoiceFiles(inv.files, inv._id || inv.id)}</div>
          <div class="small">${fmtDate(inv.requestedAt)}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn ghost" data-action="open-invoice" data-order-id="${inv.orderId}" data-order-number="${escapeHtml(inv.orderNumber || "")}" data-vendor="${escapeHtml(inv.vendor || "")}" style="padding:6px 10px;">Details</button>
          </div>
        </div>`;
      })
      .join("")}
  `;
  reimbursementsTable
    .querySelectorAll(".reimb-select")
    .forEach((cb) => {
      cb.onchange = () => {
        const id = cb.dataset.id;
        if (!id) return;
        if (cb.checked) reimbursementsSelected.add(id);
        else reimbursementsSelected.delete(id);
        updateReimbursementsBulkUI();
        updateReimbursementsSelectionText();
      };
    });
  if (canManage) {
    reimbursementsTable
      .querySelectorAll(".table-row")
      .forEach((row) => {
        const id = row.dataset.id;
        if (!id) return;
        row.style.cursor = "pointer";
        row.onclick = (e) => {
          if (e.target.closest("button") || e.target.closest("a")) return;
          const cb = row.querySelector('.reimb-select');
          const checked = reimbursementsSelected.has(id);
          if (checked) {
            reimbursementsSelected.delete(id);
            if (cb) cb.checked = false;
          } else {
            reimbursementsSelected.add(id);
            if (cb) cb.checked = true;
          }
          updateReimbursementsBulkUI();
          updateReimbursementsSelectionText();
        };
      });
  }
  reimbursementsTable
    .querySelectorAll('button[data-action="open-invoice"]')
    .forEach((btn) => {
      btn.onclick = () => {
        const oid = btn.dataset.orderId;
        const order = orders.find((o) => o._id === oid);
        openInvoiceModal(
          order || {
            _id: oid,
            orderNumber: btn.dataset.orderNumber || oid,
            vendor: btn.dataset.vendor,
          },
        );
      };
    });
  updateReimbursementsSelectionText();
}

async function loadReimbursements(statusOverride, scopeOverride) {
  if (!currentUser) return;
  const status = statusOverride ?? reimbursementStatusFilter?.value ?? "";
  const scopeRaw =
    scopeOverride ??
    reimbursementScopeFilter?.value ??
    reimbursementsScope ??
    "all";
  reimbursementsScope = scopeRaw;
  if (reimbursementScopeFilter) {
    const canViewAll =
      currentUser?.permissions?.canViewInvoices ||
      currentUser?.permissions?.canManageInvoices;
    reimbursementScopeFilter.disabled = !canViewAll;
    reimbursementScopeFilter.value = canViewAll ? scopeRaw || "all" : (currentUser?._id || "mine");
  }
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const canViewAll =
    currentUser?.permissions?.canViewInvoices ||
    currentUser?.permissions?.canManageInvoices;
  if (!canViewAll) {
    params.set("requestedBy", currentUser?._id || "");
    reimbursementsScope = currentUser?._id || "mine";
  }
  const res = await fetch(`/api/invoices?${params.toString()}`);
  const data = await res.json();
  reimbursements = data.invoices || [];
  reimbursementsSelected = new Set(
    Array.from(reimbursementsSelected).filter((id) =>
      (reimbursements || []).some((inv) => inv._id === id),
    ),
  );
  updateReimbursementScopeOptions(reimbursements);
  renderReimbursementFilters();
  renderReimbursementsTable();
  updateReimbursementsBulkUI();
}

function updateReimbursementsBulkUI() {
  const canManage = Boolean(currentUser?.permissions?.canManageInvoices);
  const count = reimbursementsSelected.size;
  if (reimbursementsBulk)
    reimbursementsBulk.style.display = canManage && count > 0 ? "flex" : "none";
  if (reimbursementsUndoBtn)
    reimbursementsUndoBtn.style.display =
      canManage && lastDeletedInvoice ? "inline-flex" : "none";
  if (reimbursementsDeleteBtn)
    reimbursementsDeleteBtn.style.display = canManage && count > 0 ? "inline-flex" : "none";
  if (!canManage) return;
  if (reimbursementsBulkCount) {
    reimbursementsBulkCount.textContent = count > 0 ? `${count} selected` : "";
  }
  if (reimbursementsBulkApply) reimbursementsBulkApply.disabled = count === 0;
}

function updateReimbursementsSelectionText() {
  if (!reimbursementsSelection) return;
  const count = reimbursementsSelected.size;
  reimbursementsSelection.textContent =
    count > 0 ? `${count} invoice${count > 1 ? "s" : ""} selected` : "No invoices selected";
  if (reimbursementsBulk) {
    reimbursementsBulk.style.display =
      count > 0 && (currentUser?.permissions?.canManageInvoices || currentUser?.permissions?.canManageOrders)
        ? "flex"
        : "none";
    // Keep controls stacked above delete button for a tighter layout
    reimbursementsBulk.style.alignItems = "flex-end";
  }
}

function renderInvoiceSummary(order) {
  if (!order?.groupId && !(order?.group && order.group._id)) return "";
  const summary = order?.reimbursementSummary || {};
  if (!summary.count) return "";
  const color = reimbursementStatusColor(
    summary.latestStatus || (summary.statuses || [])[0],
  );
  const label = summary.latestStatus
    ? formatReimbursementStatus(summary.latestStatus)
    : "Invoices on file";
  return `<div class="meta" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
    <span class="tag" style="border-color:${color}; color:${color};">Invoices: ${summary.count}${summary.requestedCount ? ` (${summary.requestedCount} to reimburse)` : ""}</span>
    <span class="tag" style="border-color:${color}; color:${color};">${label}</span>
  </div>`;
}

function resetInvoiceForm(keepSelection = true) {
  const savedOrder = invoiceEditorForm?.elements?.orderId?.value;
  const savedGroup = invoiceEditorForm?.elements?.groupId?.value;
  invoiceEditorForm?.reset();
  if (keepSelection && savedOrder && invoiceEditorForm?.elements?.orderId) {
    invoiceEditorForm.elements.orderId.value = savedOrder;
    if (invoiceEditorForm.elements.groupId) {
      invoiceEditorForm.elements.groupId.value = savedGroup || "";
    }
  }
  if (invoiceMessage) {
    invoiceMessage.textContent = "";
    invoiceMessage.className = "small";
  }
  if (invoiceFilesInput) invoiceFilesInput.value = "";
}

function closeInvoiceModal() {
  if (invoiceModal) invoiceModal.style.display = "none";
  if (invoiceCreateModal) invoiceCreateModal.style.display = "none";
}

function renderInvoiceExistingList() {
  if (!invoiceExistingList) return;
  invoiceExistingList.innerHTML = renderInvoiceCards(currentOrderInvoices);
  invoiceExistingList
    .querySelectorAll('button[data-action="edit-invoice"]')
    .forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const inv = currentOrderInvoices.find((x) => x._id === id);
        openInvoiceEditor("edit", inv);
      };
    });
  invoiceExistingList
    .querySelectorAll('a[data-action="view-file"], button[data-action="view-file"]')
    .forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const url = btn.dataset.url;
        if (url) window.open(url, "_blank", "noopener");
      };
    });
  invoiceExistingList
    .querySelectorAll('button[data-action="delete-invoice"]')
    .forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (!id) return;
        openConfirm("Delete this invoice? This cannot be undone.", async () => {
          try {
            if (invoiceMessage) {
              invoiceMessage.textContent = "Deleting invoice...";
              invoiceMessage.className = "small";
            }
            const inv = currentOrderInvoices.find((x) => x._id === id);
            await deleteInvoice(id);
            currentOrderInvoices = currentOrderInvoices.filter(
              (x) => x._id !== id,
            );
            if (inv) {
              lastDeletedInvoice = inv;
              updateReimbursementsBulkUI();
            }
            renderInvoiceExistingList();
            if (invoiceMessage) {
              invoiceMessage.textContent = "Invoice deleted";
              invoiceMessage.className = "success";
            }
          } catch (err) {
            if (invoiceMessage) {
              invoiceMessage.textContent =
                err?.message || "Failed to delete invoice";
              invoiceMessage.className = "error";
            }
            throw err;
          }
        });
      };
    });
}

function setInvoiceTarget(order, ordersList = []) {
  const list = (ordersList && ordersList.length ? ordersList : order ? [order] : [])
    .map((o) => ({
      ...o,
      _id: o._id || o.id || o.orderId,
      groupId: o.groupId || o.group?._id,
    }))
    .filter((o) => o._id);
  if (!list.length) return;
  activeInvoiceOrders = list;
  const target =
    list.find(
      (o) => o._id === (order?._id || order?.id || order?.orderId),
    ) || list[0];
  activeInvoiceOrderId = target?._id || null;
  if (invoiceOrderSelect) {
    invoiceOrderSelect.innerHTML = "";
    if (invoiceOrderSelect.parentElement)
      invoiceOrderSelect.parentElement.style.display = "none";
  }
  if (typeof ensureUserOptions === "function") {
    ensureUserOptions();
  }
  if (invoiceEditorForm?.elements?.orderId) {
    invoiceEditorForm.elements.orderId.value = activeInvoiceOrderId || "";
  }
  if (invoiceEditorForm?.elements?.groupId) {
    invoiceEditorForm.elements.groupId.value =
      target?.groupId || target?.group?._id || "";
  }
  if (invoiceTargetSummary) {
    const parts = [];
    if (target?.orderNumber) parts.push(`Order ${target.orderNumber}`);
    if (target?.group?.title) parts.push(`Group ${target.group.title}`);
    invoiceTargetSummary.textContent =
      parts.filter(Boolean).join(" · ") || "Select an order";
  }
}

function openInvoiceModal(order, orderList = []) {
  if (!invoiceModal) return;
  const list = orderList && orderList.length ? orderList : order ? [order] : [];
  const normalized = list.map((o) => ({
    ...o,
    _id: o._id || o.id || o.orderId,
    groupId: o.groupId || o.group?._id,
  }));
  const target =
    normalized.find(
      (o) => o._id === (order?._id || order?.id || order?.orderId),
    ) || normalized[0] || order;
  activeInvoiceOrders = normalized;
  setInvoiceTarget(target, normalized.length ? normalized : [target]);
  loadInvoicesForOrder(target?._id);
  if (newInvoiceBtn)
    newInvoiceBtn.style.display = currentUser?.permissions?.canSubmitInvoices
      ? "inline-flex"
      : "none";
  if (invoiceModal) invoiceModal.style.display = "flex";
}

function openInvoiceEditor(mode = "create", invoice = null) {
  if (!invoiceEditorForm || !invoiceCreateModal) return;
  window.activeInvoiceId = mode === "edit" && invoice ? invoice._id || invoice.id || invoice.invoiceId : null;
  invoiceEditorForm.reset();
  googleCredentialsFileJson = null;
  if (invoiceEditorForm.elements.mode) invoiceEditorForm.elements.mode.value = mode;
  if (invoiceEditorForm.elements.invoiceId)
    invoiceEditorForm.elements.invoiceId.value = mode === "edit" ? invoice?._id || "" : "";
  if (invoiceEditorTitle)
    invoiceEditorTitle.textContent = mode === "edit"
      ? "Edit Invoice"
      : "New Invoice";
  if (invoiceEditorSubtitle)
    invoiceEditorSubtitle.textContent = invoiceTargetSummary?.textContent || "";
  if (invoiceStatusField) {
    invoiceStatusField.style.display = mode === "edit" ? "block" : "none";
  }
  if (invoiceFileField) {
    invoiceFileField.style.display = mode === "edit" ? "none" : "block";
  }
  if (invoiceStatusSelect) {
    invoiceStatusSelect.innerHTML = getReimbursementStatusOptions()
      .map(
        (opt) =>
          `<option value="${opt.value}" ${
            opt.value === (invoice?.reimbursementStatus || "not_requested")
              ? "selected"
              : ""
          }>${opt.label}</option>`,
      )
      .join("");
    if (!currentUser?.permissions?.canManageInvoices) {
      invoiceStatusSelect.disabled = true;
      invoiceStatusSelect.style.opacity = "0.6";
      invoiceStatusSelect.style.pointerEvents = "none";
      invoiceStatusSelect.title = "You do not have permission to change reimbursement status";
    } else {
      invoiceStatusSelect.disabled = false;
      invoiceStatusSelect.style.opacity = "";
      invoiceStatusSelect.style.pointerEvents = "";
      invoiceStatusSelect.title = "";
    }
  }
  if (invoiceEditorForm.elements.orderId) {
    invoiceEditorForm.elements.orderId.value = activeInvoiceOrderId || "";
  }
  if (invoiceEditorForm.elements.groupId) {
    invoiceEditorForm.elements.groupId.value =
      invoice?.groupId || invoice?.group?._id || "";
  }
  if (mode === "edit" && invoice) {
    const file =
      (invoice.files || []).find(
        (f) => f.driveFileId || f.driveWebViewLink || f.driveDownloadLink,
      ) || invoice.files?.[0];
    if (typeof updateInvoicePreview === "function") {
      const proxiedUrl =
        file?.driveFileId && invoice?._id
          ? `/api/invoices/${invoice._id}/file/${file.driveFileId}`
          : file?.driveWebViewLink || file?.driveDownloadLink;
      updateInvoicePreview(null, {
        url: proxiedUrl,
        mime: file?.mimeType || "",
        name: file?.name || "",
      });
    }
    if (invoiceEditorForm.elements.amount)
      invoiceEditorForm.elements.amount.value =
        invoice.amount ?? "";
    if (invoiceEditorForm.elements.reimbursementRequested)
      invoiceEditorForm.elements.reimbursementRequested.value = String(
        invoice.reimbursementRequested ?? false,
      );
    if (invoiceEditorForm.elements.notes)
      invoiceEditorForm.elements.notes.value = invoice.notes || "";
  } else if (typeof updateInvoicePreview === "function") {
    updateInvoicePreview(null);
  }
  // Sync visibility after values are populated
  if (invoiceStatusField && invoiceEditorForm.elements.reimbursementRequested) {
    const needs =
      invoiceEditorForm.elements.reimbursementRequested.value === "true";
    invoiceStatusField.style.display = needs ? "block" : "none";
  }
  if (invoiceCreateModal) invoiceCreateModal.style.display = "flex";
}

function openEdit(order) {
  editingOrderId = order._id;
  resetCatalogLookup();
  resetCatalogSavePanel();
  syncCatalogSaveUI();
  orderForm.elements.vendor.value = order.vendor || order.supplier || "";
  orderForm.elements.vendorPartNumber.value = order.vendorPartNumber || "";
  orderForm.elements.partLink.value = order.partLink || "";
  if (orderForm.elements.productCode) {
    orderForm.elements.productCode.value = order.productCode || "";
  }
  orderForm.elements.partName.value = order.partName || "";
  orderForm.elements.unitCost.value =
    order.unitCost || order.fetchedPrice || "";
  orderForm.elements.quantityRequested.value = order.quantityRequested || 1;
  orderForm.elements.priority.value = order.priority || "Medium";
  if (manualVendorSelect) {
    const configMatch = findVendorConfig(order.vendor || order.supplier);
    manualVendorSelect.value = configMatch
      ? vendorOptionValue(configMatch)
      : "";
    manualVendorOverride = configMatch || null;
    updateManualVendorHint();
  }
  setOrderSource("manual");
  scheduleCatalogPresenceCheck();
  if (
    currentUser?.permissions?.canEditInventoryCatalog &&
    catalogSaveCategory
  ) {
    catalogSaveCategory.value = order.category || "";
  }
  if (orderTrackingList) setTrackingRows(orderTrackingList, []);
  if (addOrderTracking) addOrderTracking.disabled = true;
  if (orderTrackingList) orderTrackingList.style.display = "none";
  renderTagOptions(order.tags || []);
  renderPriorityOptions();
  orderForm.elements.notes.value = order.notes || "";
  modal.style.display = "flex";
}

function createCard(order) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = false;
  card.dataset.id = order._id;
  card.dataset.vendor = getOrderVendor(order) || "";
  if (selected.has(order._id)) card.classList.add("selected");

  card.innerHTML = `
<div class="flex-between" style="gap:8px;">
  <div>
    <h4>${order.partName || "Untitled part"}</h4>
    <div class="meta">Requested by ${order.studentName || "Unknown"} · ${fmtDate(order.requestedDisplayAt || order.requestedAt)}</div>
  </div>
</div>
<div class="meta">
  ${(() => {
    const unit = order.unitCost ?? order.fetchedPrice;
    const qty = order.quantityRequested || 1;
    const total =
      order.totalCost ??
      (unit !== undefined ? Number((unit * qty).toFixed(2)) : undefined);
    return total !== undefined
      ? "$" + total
      : unit !== undefined
        ? "$" + unit
        : "";
  })()}
  ${order.quantityRequested ? " · x" + order.quantityRequested : ""}
</div>
${order.notes ? `<div class="meta" style="margin-top:4px; white-space:pre-wrap;">Notes: ${escapeHtml(order.notes)}</div>` : ""}
<div class="meta" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
  <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:200px;">
    <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
      ${order.supplier || order.vendor ? `<span class="tag supplier">${order.supplier || order.vendor}</span>` : ""}
      ${order.vendorPartNumber ? `<span class="tag">${order.vendorPartNumber}</span>` : ""}
      ${order.priority ? `<span class="tag priority" style="border-color:${getPriorityColor(order.priority)}; color:${getPriorityColor(order.priority)};">${order.priority}</span>` : ""}
      ${order.group ? `<span class="tag group">Group: ${order.group.title || order.group.supplier || "Grouped"}</span>` : ""}
      ${renderInvoiceSummary(order)}
      ${renderTagChips(order.tags || [])}
      ${
        order.approvalStatus === "approved"
          ? `<span class="tag" style="background:rgba(74,210,143,0.16); color:var(--success);">Approved${order.approvedBy ? " · " + order.approvedBy : ""}</span>`
          : `<span class="tag" style="background:rgba(253,208,35,0.16); color:var(--gold);">Pending approval</span>`
      }
    </div>
    ${renderTrackingBadges(order.group?.tracking && order.group.tracking.length ? order.group.tracking : order.tracking || [])}
  </div>
  <div class="row-actions" style="display:flex; gap:6px; align-self:flex-end; flex-wrap:wrap;">
    ${currentUser?.permissions?.canManagePartRequests ? `<button class="btn ghost" data-action="approve" style="padding:4px 8px;">${order.approvalStatus === "approved" ? "Unapprove" : "Approve"}</button>` : ""}
    ${order.partLink || order.supplierLink ? `<a class="btn ghost" data-action="link" href="${escapeHtml(order.partLink || order.supplierLink)}" target="_blank" rel="noopener noreferrer" style="padding:4px 8px;">Link</a>` : ""}
    ${(currentUser?.permissions?.canSubmitInvoices && (order.groupId || order.group?._id)) ? `<button class="btn ghost" data-action="invoice" style="padding:4px 8px;">Invoices</button>` : ""}
    ${currentUser?.permissions?.canManagePartRequests || (currentUser?.permissions?.canManageOwnPartRequests && isOwnOrder(order)) ? `<button class="btn ghost" data-action="edit" style="padding:4px 8px;">Edit</button>` : ""}
    ${currentUser?.permissions?.canManagePartRequests || (currentUser?.permissions?.canManageOwnPartRequests && isOwnOrder(order)) ? `<button class="btn ghost" data-action="delete" style="padding:4px 8px; color: var(--danger);">Delete</button>` : ""}
  </div>
</div>
  `;
  card.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest("a")) return;
    if (addToOrderMode && addToOrderVendor) {
      showBoardMessage(
        "Tap a grouped order to add these parts.",
        "error",
        2000,
      );
      return;
    }
    toggleSelect(order._id);
  });

  card.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEdit(order);
    });
  });
  card.querySelectorAll('button[data-action="approve"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = order.approvalStatus === "approved" ? "pending" : "approved";
      await approveOrder(order._id, next);
      fetchOrders();
    });
  });
  card.querySelectorAll('button[data-action="invoice"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openInvoiceModal(order);
    });
  });
  card.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      openConfirm("Delete this order?", async () => {
        const snapshot = snapshotOrder(order._id);
        if (order.groupId || order.group?._id) {
          await assignGroup(order._id, undefined);
          await patchStatusOnly(order._id, "Requested");
        }
        await fetch(`/api/orders/${order._id}`, { method: "DELETE" });
        if (snapshot) {
          recordAction({
            undo: {
              type: "restoreOrder",
              payload: {
                order: snapshot,
                groupId: snapshot.groupId || snapshot.group?._id,
              },
            },
            redo: { type: "deleteOrder", payload: { orderId: order._id } },
          });
        }
        fetchOrders();
      });
    });
  });
  card.querySelectorAll('a[data-action="link"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });
  return card;
}

function applyAddTargetStyles(el, vendor, isSelected, isGroup = false) {
  if (!el) return;
  el.classList.remove("add-target-valid", "add-target-disabled");
  if (!addToOrderMode) return;
  if (!isGroup) {
    el.classList.add("add-target-disabled");
    return;
  }
  const canTarget =
    addToOrderVendor && vendor && !isSelected && vendor === addToOrderVendor;
  el.classList.add(canTarget ? "add-target-valid" : "add-target-disabled");
}

function updateToOrderActionsUI() {
  const actionsRow = document.querySelector(
    '.column[data-status="Requested"] .to-order-actions',
  );
  if (!actionsRow) return;
  const selectedOrders = orders.filter((o) => selected.has(o._id));
  const allRequested = selectedOrders.every((o) => o.status === "Requested");
  const sameVendor =
    selectedOrders.length > 0 &&
    allRequested &&
    selectedOrders.every(
      (o) => getOrderVendor(o) === getOrderVendor(selectedOrders[0]),
    );
  const showSelectSameVendor = sameVendor;
  const showSelectAll = selectedOrders.length === 0 || !sameVendor;
  const hasSelection = selected.size > 0;
  const canManageOrders = currentUser?.permissions?.canManageOrders;
  const canManagePartRequests = currentUser?.permissions?.canManagePartRequests;
  const canManageOwnPartRequests =
    currentUser?.permissions?.canManageOwnPartRequests;
  const canDeleteSelected =
    canManagePartRequests ||
    (canManageOwnPartRequests &&
      hasSelection &&
      selectedOrders.every(isOwnOrder));
  [
    selectAllBtn,
    selectSameVendorBtn,
    unselectAllBtn,
    addToOrderBtn,
    groupBtn,
    deleteSelectedBtn,
  ].forEach((btn) => {
    if (!btn) return;
    actionsRow.appendChild(btn);
  });
  if (selectAllBtn)
    selectAllBtn.style.display = showSelectAll ? "inline-flex" : "none";
  if (selectSameVendorBtn)
    selectSameVendorBtn.style.display = showSelectSameVendor
      ? "inline-flex"
      : "none";
  if (unselectAllBtn)
    unselectAllBtn.style.display = hasSelection ? "inline-flex" : "none";
  if (addToOrderBtn)
    addToOrderBtn.style.display =
      hasSelection && sameVendor && canManageOrders ? "inline-flex" : "none";
  if (groupBtn)
    groupBtn.style.display =
      hasSelection && sameVendor && canManageOrders ? "inline-flex" : "none";
  if (deleteSelectedBtn)
    deleteSelectedBtn.style.display =
      hasSelection && canDeleteSelected ? "inline-flex" : "none";
}

function refreshBoardSelectionUI() {
  if (!boardEl) return;
  boardEl.querySelectorAll(".board .card").forEach((card) => {
    const id = card.dataset.id;
    if (id) card.classList.toggle("selected", selected.has(id));
    const vendor = card.dataset.vendor || "";
    const isGroup = Boolean(card.dataset.groupId);
    const isSelected = id ? selected.has(id) : false;
    applyAddTargetStyles(card, vendor, isSelected, isGroup);
  });
  updateToOrderActionsUI();
}

function withScrollRestoration(fn) {
  const sx = window.scrollX;
  const sy = window.scrollY;
  const bScroll = boardEl ? boardEl.scrollTop : null;
  fn();
  window.requestAnimationFrame(() => {
    if (boardEl && bScroll !== null) boardEl.scrollTop = bScroll;
    window.scrollTo(sx, sy);
  });
}

function renderBoard() {
  const savedScrollY = window.scrollY;
  const savedScrollX = window.scrollX;
  const savedBoardScroll = boardEl ? boardEl.scrollTop : null;
  const fo = filteredOrders();
  const groupedByStatus = {};
  const groupMap = {};
  const selectionActions = selectionBar?.querySelector(".selection-actions");
  [
    selectAllBtn,
    selectSameVendorBtn,
    unselectAllBtn,
    groupBtn,
    addToOrderBtn,
    deleteSelectedBtn,
  ].forEach((btn) => {
    if (btn && selectionActions && btn.parentElement !== selectionActions) {
      selectionActions.appendChild(btn);
    }
  });

  fo.forEach((order) => {
    if (order.groupId || order.group?._id) {
      const gid = order.groupId || order.group?._id;
      if (!groupMap[gid]) groupMap[gid] = [];
      groupMap[gid].push(order);
    } else {
      groupedByStatus[order.status] = groupedByStatus[order.status] || [];
      groupedByStatus[order.status].push(order);
    }
  });

  boardEl.innerHTML = "";
  statuses.forEach((col) => {
    const status = col.status;
    const column = document.createElement("div");
    column.className = "column";
    column.dataset.status = col.status;
    column.innerHTML = `
<div class="flex-between" style="align-items:flex-start; gap:8px; flex-wrap:wrap;">
  <div>
    <h3>${col.label} <span class="pill">${(groupedByStatus[col.status] || []).length + Object.values(groupMap).filter((items) => items[0]?.status === col.status).length}</span></h3>
    <div class="small" style="margin-bottom:6px;">${col.hint}</div>
  </div>
  ${col.status === "Requested" ? `<div class="to-order-actions" style="display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;"></div>` : ""}
</div>
<div class="board-drop"></div>
  `;
    const dropArea = column.querySelector(".board-drop");
    const actionsRow = column.querySelector(".to-order-actions");
    if (actionsRow && col.status === "Requested") {
      const selectedOrders = orders.filter((o) => selected.has(o._id));
      const allRequested = selectedOrders.every(
        (o) => o.status === "Requested",
      );
      const sameVendor =
        selectedOrders.length > 0 &&
        allRequested &&
        selectedOrders.every(
          (o) => getOrderVendor(o) === getOrderVendor(selectedOrders[0]),
        );
      const selectAllBtnEl = selectAllBtn;
      const selectSameVendorBtnEl = selectSameVendorBtn;
      const unselectAllBtnEl = unselectAllBtn;
      const groupBtnEl = groupBtn;
      const addToOrderBtnEl = addToOrderBtn;
      const showSelectSameVendor = sameVendor;
      const showSelectAll = selectedOrders.length === 0 || !sameVendor;
      if (selectAllBtnEl) {
        selectAllBtnEl.style.display = showSelectAll ? "inline-flex" : "none";
        actionsRow.appendChild(selectAllBtnEl);
      }
      if (selectSameVendorBtnEl) {
        selectSameVendorBtnEl.style.display = showSelectSameVendor
          ? "inline-flex"
          : "none";
        actionsRow.appendChild(selectSameVendorBtnEl);
      }
      if (unselectAllBtnEl) {
        unselectAllBtnEl.style.display = selected.size ? "inline-flex" : "none";
        actionsRow.appendChild(unselectAllBtnEl);
      }
      if (addToOrderBtnEl) {
        addToOrderBtnEl.style.display =
          selected.size && sameVendor ? "inline-flex" : "none";
        actionsRow.appendChild(addToOrderBtnEl);
      }
      if (groupBtnEl) {
        groupBtnEl.style.display =
          selected.size && sameVendor ? "inline-flex" : "none";
        actionsRow.appendChild(groupBtnEl);
      }
      if (deleteSelectedBtn) {
        deleteSelectedBtn.style.display = selected.size
          ? "inline-flex"
          : "none";
        actionsRow.appendChild(deleteSelectedBtn);
      }
    }

    (groupedByStatus[col.status] || []).forEach((order) => {
      const card = createCard(order);
      applyAddTargetStyles(
        card,
        getOrderVendor(order),
        selected.has(order._id),
        false,
      );
      dropArea.appendChild(card);
    });

    const groupsForStatus = Object.entries(groupMap)
      .filter(([, items]) => items[0]?.status === col.status)
      .sort(([, a], [, b]) => getGroupTimestamp(b) - getGroupTimestamp(a));

    groupsForStatus.forEach(([gid, items]) => {
      const first = items[0];
      const card = document.createElement("div");
      card.className = "card";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "8px";
      card.draggable = false;
      card.dataset.groupId = gid;
      card.dataset.vendor = (
        first.supplier ||
        first.vendor ||
        ""
      ).toLowerCase();
      const vendor = first.supplier || first.vendor || "";
      const total = items.reduce((sum, o) => sum + (o.totalCost || 0), 0);
      const statusTagLabel = first.group?.statusTag || "";
      const statusTagColor = statusTagLabel ? getStatusTagColor(statusTagLabel) : null;
      const trackingList =
        first.group?.tracking && first.group.tracking.length
          ? first.group.tracking
          : trackingFromOrder(first);
      const groupedAt =
        first.group?.requestedDisplayAt || first.group?.createdAt || Date.now();
      const timePart = new Date(groupedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const groupTitle =
        first.group?.title ||
        `${vendor || "Grouped Order"} - ${formatShortDate(new Date(groupedAt))} ${timePart}`;
      card.innerHTML = `
    <div class="flex-between" style="gap:8px;">
      <div>
        <h4>${groupTitle}</h4>
        <div class="meta">Items in order: ${items.length}</div>
        ${first.group?.notes ? `<div class="meta" style="margin-top:4px; white-space:pre-wrap;">Notes: ${escapeHtml(first.group.notes)}</div>` : ""}
      </div>
      <div class="row-actions" style="display:flex; gap:6px;">
        ${supportsVendorExportByName(vendor) ? `<button class="btn ghost" data-action="export-group" style="padding:4px 8px;">Export</button>` : ""}
        ${currentUser?.permissions?.canManageOrders && status === "Ordered" ? `<button class="btn ghost" data-action="advance-group" style="padding:4px 8px;">Advance</button>` : ""}
        ${currentUser?.permissions?.canManageOrders && status === "Received" ? `<button class="btn ghost" data-action="revert-group" style="padding:4px 8px;">Revert</button>` : ""}
        ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="edit-group" style="padding:4px 8px;">Edit</button>` : ""}
        ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="delete-group" style="padding:4px 8px; color: var(--danger);">Delete</button>` : ""}
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          ${vendor ? `<span class="tag supplier">${vendor}</span>` : ""}
          ${statusTagLabel ? `<span class="tag" style="background:${statusTagColor || "var(--panel)"}22; border-color:${statusTagColor || "var(--border)"}; color:${statusTagColor || "var(--text)"};">${escapeHtml(statusTagLabel)}</span>` : ""}
          ${renderGroupInvoiceSummary(items)}
        </div>
        ${renderTrackingBadges(trackingList)}
      </div>
      <div class="muted" style="min-width:80px; text-align:right; align-self:flex-end;">${total ? "$" + total.toFixed(2) : ""}</div>
    </div>
  `;
      applyAddTargetStyles(card, vendor.toLowerCase(), false, true);

      card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest(".group-item"))
          return;
        if (addToOrderMode && addToOrderVendor) {
          const valid = vendor && vendor.toLowerCase() === addToOrderVendor;
          if (valid) {
            addSelectedToGroup(gid, status);
            return;
          }
          showBoardMessage(
            "Vendor mismatch. Pick a matching grouped order.",
            "error",
            2000,
          );
          return;
        }
        openGroupDetailModal(
          {
            id: gid,
            title: groupTitle,
            vendor,
            status,
            statusTag: statusTagLabel,
            statusTagColor,
            tracking: trackingList,
            notes: first.group?.notes || "",
            total,
          },
          items,
        );
      });
      card
        .querySelectorAll('button[data-action="export-group"]')
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            exportOrdersForVendor(items, vendor);
          });
        });

      card
        .querySelectorAll('button[data-action="edit-group"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            openGroupModal({
              id: gid,
              title: first.group?.title || groupTitle,
              tracking: trackingList,
              notes: first.group?.notes || "",
              statusTag: statusTagLabel || "",
            });
          });
        });

      card
        .querySelectorAll('button[data-action="delete-group"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            if (actionBusy) return;
            e.stopPropagation();
            const orderIds = items.map((o) => o._id);
            openConfirm(
              "Delete this group?",
              async (extra) => {
                setActionBusy(true, "Deleting order…");
                const deleteParts = extra?.deleteParts;
                const originalStatus = first.status || "Ordered";
                const originalTracking = trackingList || [];
                const originalNotes = first.group?.notes || "";
                if (deleteParts) {
                  const snapshots = orderIds
                    .map((id) => snapshotOrder(id))
                    .filter(Boolean);
                const groupSnapshot = {
                  title: groupTitle,
                  supplier: vendor || undefined,
                  requestedDisplayAt:
                    first.group?.requestedDisplayAt || first.group?.createdAt,
                  status: originalStatus,
                  tracking: originalTracking,
                  notes: originalNotes,
                  statusTag: statusTagLabel || "",
                };
                await Promise.all(
                  orderIds.map((oid) =>
                    fetch(`/api/orders/${oid}`, { method: "DELETE" }),
                  ),
                  );
                  await fetch(`/api/order-groups/${gid}`, { method: "DELETE" });
                  recordAction({
                    undo: {
                      type: "restoreOrders",
                      payload: { orders: snapshots, group: groupSnapshot },
                    },
                    redo: { type: "deleteOrders", payload: { orderIds } },
                  });
                  fetchOrders();
                  setActionBusy(false);
                  return;
                }
                await Promise.all(
                  orderIds.map(async (oid) => {
                    await assignGroup(oid, undefined);
                    await patchStatusOnly(oid, "Requested");
                  }),
                );
                await fetch(`/api/order-groups/${gid}`, { method: "DELETE" });
                recordAction({
                  undo: {
                    type: "createGroup",
                  payload: {
                    title: groupTitle,
                    supplier: vendor || undefined,
                    requestedDisplayAt:
                      first.group?.requestedDisplayAt ||
                      first.group?.createdAt,
                    orderIds,
                    status: originalStatus,
                    tracking: originalTracking,
                    notes: originalNotes,
                    statusTag: statusTagLabel || "",
                  },
                },
                  redo: {
                    type: "deleteGroup",
                    payload: { groupId: gid, orderIds, status: originalStatus },
                  },
                });
                fetchOrders();
                setActionBusy(false);
              },
              () => {
                const checkboxId = `confirm-delete-orders-${gid}`;
                return {
                  content: `<label class="small" style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="${checkboxId}"> Delete part requests instead of ungrouping</label>`,
                  getValue: () => ({
                    deleteParts: document.getElementById(checkboxId)?.checked,
                  }),
                };
              },
            );
          });
        });
      card
        .querySelectorAll('button[data-action="advance-group"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await updateGroupStatus(gid, "Received");
          });
        });
      card
        .querySelectorAll('button[data-action="revert-group"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await updateGroupStatus(gid, "Ordered");
          });
        });

      card
        .querySelectorAll('button[data-action="edit-part"]')
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const oid = e.target.closest(".group-item").dataset.id;
            const order = orders.find((o) => o._id === oid);
            if (order) openEdit(order);
          });
        });
      card
        .querySelectorAll('button[data-action="remove-part"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const oid = e.target.closest(".group-item").dataset.id;
            openConfirm("Remove this part from the order?", async () => {
              await removePartFromGroup(oid, gid, status);
            });
          });
        });
      card.querySelectorAll('a[data-action="link-part"]').forEach((anchor) => {
        anchor.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      });
      card
        .querySelectorAll('button[data-action="delete-part"]')
        .forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const oid = e.target.closest(".group-item").dataset.id;
            openConfirm("Delete this order?", async () => {
              await fetch(`/api/orders/${oid}`, { method: "DELETE" });
              fetchOrders();
            });
          });
        });

      dropArea.appendChild(card);
    });

    const hasSingles = (groupedByStatus[col.status] || []).length > 0;
    const hasGroups = Object.values(groupMap).some(
      (items) => items[0]?.status === col.status,
    );
    if (!hasSingles && !hasGroups) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No Orders";
      dropArea.appendChild(empty);
    }

    boardEl.appendChild(column);
  });

  if (addToOrderMode && boardEl) {
    boardEl.querySelectorAll(".board .card").forEach((card) => {
      const vendor = card.dataset.vendor || "";
      const isGroup = Boolean(card.dataset.groupId);
      const isSelected = card.dataset.id
        ? selected.has(card.dataset.id)
        : false;
      applyAddTargetStyles(card, vendor, isSelected, isGroup);
    });
  }
  window.requestAnimationFrame(() => {
    if (boardEl && savedBoardScroll !== null)
      boardEl.scrollTop = savedBoardScroll;
    window.scrollTo(savedScrollX, savedScrollY);
  });
  resizeColumns();
}

function renderStockFilters() {
  if (!stockSubteamFilter) return;
  const options = [
    `<option value="all">All locations</option>`,
    `<option value="none">Common Stock</option>`,
  ];
  (stockSubteams || []).forEach((st) => {
    options.push(`<option value="${st._id}">${escapeHtml(st.name)}</option>`);
  });
  stockSubteamFilter.innerHTML = options.join("");
  const desired = selectedStockSubteam || "all";
  const hasOption = Array.from(stockSubteamFilter.options || []).some(
    (opt) => opt.value === desired,
  );
  stockSubteamFilter.value = hasOption ? desired : "all";
}

function setSelectedStockCatalogItem(item) {
  selectedStockCatalogItem = item;
  if (stockCatalogSelected) {
    const path =
      item?.fullPath ||
      item?.catalogFullPath ||
      (item?.categoryPathLabels || []).join(" / ");
    stockCatalogSelected.textContent = item
      ? `Using catalog: ${item.name || ""}${path ? " · " + path : ""}`
      : "Search for a catalog item to track.";
  }
}

function buildStockCard(item, canAdjustStock) {
  const qty = item.quantityOnHand ?? 0;
  const low = item.lowStockThreshold;
  const isEmpty = qty <= 0;
  const isLow = !isEmpty && low !== undefined && qty <= low;
  const card = document.createElement("div");
  card.className = "card stock-card";
  if (isLow) card.classList.add("stock-low");
  if (isEmpty) card.classList.add("stock-empty");
  card.dataset.id = item._id;
  const subteamLabel = item.subteam || "Common Stock";
  const statusText = isEmpty
    ? '<span class="stock-empty-text">Out of stock</span>'
    : isLow
      ? '<span class="stock-low-text">Low</span>'
      : "";
  card.innerHTML = `
  <div class="flex-between" style="gap:8px; align-items:flex-start;">
    <div>
      <h4 style="margin:0 0 6px;">${escapeHtml(item.name)}</h4>
      <div class="meta">
        <span class="stock-chip">${escapeHtml(subteamLabel)}</span>
        ${item.category ? `<span class="stock-chip">${escapeHtml(item.category)}</span>` : ""}
        ${item.location ? `<span class="stock-chip">📍 ${escapeHtml(item.location)}</span>` : ""}
      </div>
      <div class="meta">
        ${item.vendor ? `<span class="tag supplier">${escapeHtml(item.vendor)}</span>` : ""}
        ${item.vendorPartNumber ? `<span class="tag">${escapeHtml(item.vendorPartNumber)}</span>` : ""}
      </div>
    </div>
  </div>
  <div class="stock-row">
    <div class="stock-adjust">
      ${canAdjustStock ? `<button class="btn ghost" data-action="adjust-stock" data-id="${item._id}" data-delta="-1" style="padding:6px 10px;">-</button>` : ""}
      <div class="stock-level">${qty}</div>
      ${canAdjustStock ? `<button class="btn ghost" data-action="adjust-stock" data-id="${item._id}" data-delta="1" style="padding:6px 10px;">+</button>` : ""}
      ${statusText ? `<div style="display:flex; align-items:center; gap:6px; margin-left:4px;">${statusText}</div>` : ""}
    </div>
    <div class="stock-actions" style="margin-left:auto;">
      ${item.supplierLink ? `<a class="btn ghost" href="${escapeHtml(item.supplierLink)}" target="_blank" style="padding:4px 8px;">Link</a>` : ""}
      ${currentUser?.permissions?.canManageStock ? `<button class="btn ghost" data-action="edit-stock" data-id="${item._id}" style="padding:4px 8px;">Edit</button>` : ""}
      ${currentUser?.permissions?.canManageStock ? `<button class="btn ghost" data-action="delete-stock" data-id="${item._id}" style="padding:4px 8px; color: var(--danger);">Untrack</button>` : ""}
      <button class="btn primary" data-action="request-stock" data-id="${item._id}" style="padding:4px 10px;">Request</button>
    </div>
  </div>
`;
  return card;
}

function mergeStockItem(id, changes) {
  const idx = stockItems.findIndex((s) => s._id === id);
  if (idx === -1) return false;
  stockItems[idx] = { ...stockItems[idx], ...changes };
  renderStockGrid();
  return true;
}

function openDeleteStockModal(id) {
  pendingDeleteStockId = id;
  if (stockDeleteMessage)
    stockDeleteMessage.textContent =
      "Are you sure you want to untrack this item?";
  if (stockDeleteModal) stockDeleteModal.style.display = "flex";
}

function openConfirm(message, action, renderExtra) {
  if (!confirmModal) return action?.();
  pendingConfirmAction = action;
  pendingConfirmExtraGetter = null;
  if (confirmMessage) confirmMessage.textContent = message || "Are you sure?";
  if (confirmStatus) {
    confirmStatus.textContent = "";
    confirmStatus.className = "small";
  }
  if (confirmExtra) {
    confirmExtra.style.display = "none";
    confirmExtra.innerHTML = "";
  }
  if (renderExtra && confirmExtra) {
    const res = renderExtra();
    if (res?.content) {
      confirmExtra.innerHTML = res.content;
      confirmExtra.style.display = "block";
    }
    if (typeof res?.getValue === "function") {
      pendingConfirmExtraGetter = res.getValue;
    }
  }
  confirmModal.style.display = "flex";
}

function openVendorExportModal(config = {}) {
  vendorExportData = config;
  if (vendorExportTitle)
    vendorExportTitle.textContent = config.vendorName
      ? `Export to ${config.vendorName}`
      : "Vendor export";
  if (vendorExportDescription)
    vendorExportDescription.textContent =
      config.description ||
      "Copy the list or download the CSV for the vendor quick order form.";
  if (vendorExportText) vendorExportText.value = config.text || "";
  if (vendorExportMessage) {
    const message =
      config.message !== undefined
        ? config.message
        : config.text
          ? "Copy the lines into the vendor quick order form."
          : "";
    vendorExportMessage.textContent = message;
    vendorExportMessage.className = config.messageType
      ? `small ${config.messageType}`
      : "small";
  }
  if (vendorExportModal) vendorExportModal.style.display = "flex";
}

function closeVendorExportModal() {
  vendorExportData = null;
  if (vendorExportMessage) {
    vendorExportMessage.textContent = "";
    vendorExportMessage.className = "small";
  }
  if (vendorExportModal) vendorExportModal.style.display = "none";
}

function renderStockGrid() {
  if (!stockGrid) return;
  if (!currentUser) {
    stockGrid.innerHTML = '<div class="empty">Login to view stock.</div>';
    return;
  }
  if (!stockItems.length) {
    stockGrid.innerHTML =
      '<div class="empty">No stock tracked yet. Add items to start tracking.</div>';
    return;
  }
  stockGrid.innerHTML = "";
  const canAdjustStock =
    currentUser?.permissions?.canEditStock ||
    currentUser?.permissions?.canManageStock;
  const isGrouped = selectedStockSubteam && selectedStockSubteam !== "all";
  stockGrid.classList.toggle("grouped", isGrouped);

  const buildCategoryLabel = (item) => {
    return (item.category || "").trim() || "Uncategorized";
  };

  if (isGrouped) {
    const groups = new Map();
    stockItems.forEach((item) => {
      const label = buildCategoryLabel(item);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });
    const sortedLabels = Array.from(groups.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    sortedLabels.forEach((label) => {
      const wrapper = document.createElement("div");
      wrapper.className = "stock-category-block";
      const title = document.createElement("div");
      title.className = "stock-category-title";
      title.textContent = label;
      const grid = document.createElement("div");
      grid.className = "stock-category-grid";
      const items = groups.get(label) || [];
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      items.forEach((item) =>
        grid.appendChild(buildStockCard(item, canAdjustStock)),
      );
      wrapper.appendChild(title);
      wrapper.appendChild(grid);
      stockGrid.appendChild(wrapper);
    });
  } else {
    stockItems
      .slice()
      .sort(
        (a, b) =>
          (a.subteam || "").localeCompare(b.subteam || "") ||
          (a.name || "").localeCompare(b.name || ""),
      )
      .forEach((item) =>
        stockGrid.appendChild(buildStockCard(item, canAdjustStock)),
      );
  }

  stockGrid
    .querySelectorAll('button[data-action="adjust-stock"]')
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const delta = Number(e.target.dataset.delta);
        if (!id || !Number.isFinite(delta)) return;
        await adjustStockQuantity(id, delta);
      });
    });
  stockGrid
    .querySelectorAll('button[data-action="request-stock"]')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        const item = stockItems.find((s) => s._id === id);
        if (!item) return;
        if (!currentUser?.permissions?.canPlacePartRequests) {
          showBoardMessage("No permission to place part requests.", "error");
          return;
        }
        const requestItem = item.catalogItem || {
          name: item.name,
          vendor: item.vendor,
          vendorPartNumber: item.vendorPartNumber,
          supplierLink: item.supplierLink,
          unitCost: item.unitCost,
          defaultQuantity: 1,
          fullPath: item.catalogFullPath,
        };
        openCatalogRequestModal(requestItem);
      });
    });
  stockGrid
    .querySelectorAll('button[data-action="edit-stock"]')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        const item = stockItems.find((s) => s._id === id);
        if (item) openStockModal(item);
      });
    });
  stockGrid
    .querySelectorAll('button[data-action="delete-stock"]')
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        openDeleteStockModal(id);
      });
    });
}

async function loadStock() {
  if (!stockGrid) return;
  if (!currentUser) {
    stockGrid.innerHTML = '<div class="empty">Login to view stock.</div>';
    return;
  }
  const params = new URLSearchParams();
  const searchTerm = (globalSearch?.value || "").trim();
  if (searchTerm) params.set("search", searchTerm);
  if (
    selectedStockSubteam &&
    selectedStockSubteam !== "all" &&
    selectedStockSubteam !== "none"
  ) {
    params.set("subteamId", selectedStockSubteam);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  stockGrid.innerHTML = '<div class="empty">Loading stock...</div>';
  try {
    const res = await fetch(`/api/stock${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load stock");
    const incoming = data.items || [];
    stockSubteams = data.subteams || stockSubteams;
    renderStockFilters();
    stockItems =
      selectedStockSubteam === "none"
        ? incoming.filter((i) => !i.subteamId)
        : incoming;
    renderStockGrid();
  } catch (err) {
    stockGrid.innerHTML = `<div class="empty">${escapeHtml(err.message || "Failed to load stock")}</div>`;
  }
}

function resetStockModal() {
  if (!stockForm) return;
  stockForm.reset();
  if (stockForm.elements.id) stockForm.elements.id.value = "";
  setSelectedStockCatalogItem(null);
  if (stockCatalogSearch) {
    stockCatalogSearch.value = "";
    stockCatalogSearch.disabled = false;
  }
  if (stockCatalogResults) {
    stockCatalogResults.innerHTML = "";
    stockCatalogResults.style.display = "none";
  }
  if (stockModalMessage) {
    stockModalMessage.textContent = "";
    stockModalMessage.className = "small";
  }
  if (deleteStockBtn) deleteStockBtn.style.display = "none";
  if (stockModalTitle) stockModalTitle.textContent = "Add Stock";
  if (stockModalSubtitle)
    stockModalSubtitle.textContent =
      "Pick a catalog part to track and set the starting quantity.";
  if (stockCategoryInput) stockCategoryInput.value = "";
  if (stockCatalogSelected)
    stockCatalogSelected.textContent = "Search for a catalog item to track.";
}

function openStockModal(item = null) {
  if (!currentUser?.permissions?.canManageStock) {
    showBoardMessage("No permission to configure stock.", "error");
    return;
  }
  if (!stockForm) return;
  resetStockModal();
  renderStockFilters();
  if (stockSubteamSelect) {
    const opts = [`<option value="">Common Stock</option>`].concat(
      (stockSubteams || []).map(
        (st) => `<option value="${st._id}">${escapeHtml(st.name)}</option>`,
      ),
    );
    stockSubteamSelect.innerHTML = opts.join("");
  }
  if (item) {
    stockForm.elements.id.value = item._id || "";
    if (stockQuantityInput) stockQuantityInput.value = item.quantityOnHand ?? 0;
    if (stockLowInput) stockLowInput.value = item.lowStockThreshold ?? "";
    if (stockLocationInput) stockLocationInput.value = item.location || "";
    if (stockCategoryInput) stockCategoryInput.value = item.category || "";
    if (stockNotesInput) stockNotesInput.value = item.notes || "";
    if (stockSubteamSelect)
      stockSubteamSelect.value = item.subteamId
        ? item.subteamId.toString()
        : "";
    setSelectedStockCatalogItem(item.catalogItem || item);
    if (stockCatalogSearch) stockCatalogSearch.disabled = true;
    if (stockModalTitle) stockModalTitle.textContent = "Edit stock item";
    if (stockModalSubtitle)
      stockModalSubtitle.textContent =
        "Update location, thresholds, or counts.";
    if (deleteStockBtn) deleteStockBtn.style.display = "inline-flex";
  } else {
    if (stockSubteamSelect)
      stockSubteamSelect.value =
        selectedStockSubteam && selectedStockSubteam !== "all"
          ? selectedStockSubteam
          : "";
    setSelectedStockCatalogItem(null);
  }
  if (stockModal) stockModal.style.display = "flex";
}

async function saveStockForm(e) {
  e.preventDefault();
  if (!stockForm) return;
  const id = stockForm.elements.id.value || null;
  const quantity = Number(stockQuantityInput?.value || 0);
  const low =
    stockLowInput?.value === "" ? undefined : Number(stockLowInput?.value);
  const subteamId = stockSubteamSelect ? stockSubteamSelect.value : "";
  const location = stockLocationInput?.value?.trim() || undefined;
  const category = stockCategoryInput?.value?.trim() || undefined;
  const notes = stockNotesInput?.value?.trim() || undefined;
  const targetLocationName = subteamId
    ? stockSubteams?.find?.((s) => s._id === subteamId)?.name ||
      "Selected location"
    : "Common Stock";
  const finalizeSuccess = () => {
    if (stockModal) stockModal.style.display = "none";
    showBoardMessage("Stock saved.", "info");
    resetStockModal();
  };
  if (!id && !selectedStockCatalogItem) {
    stockModalMessage.textContent = "Select a catalog item first.";
    stockModalMessage.className = "error";
    return;
  }
  if (stockModalMessage) {
    stockModalMessage.textContent = "Saving...";
    stockModalMessage.className = "small";
  }
  try {
    if (id) {
      const res = await fetch(`/api/stock/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subteamId: subteamId === "" ? null : subteamId,
          quantityOnHand: Number.isFinite(quantity) ? quantity : undefined,
          lowStockThreshold: Number.isFinite(low) ? low : undefined,
          location,
          category,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update stock");
      }
      const subteamName =
        subteamId && stockSubteams?.find?.((s) => s._id === subteamId)?.name;
      const moveOutOfView =
        selectedStockSubteam &&
        selectedStockSubteam !== "all" &&
        selectedStockSubteam !== subteamId &&
        !(selectedStockSubteam === "none" && !subteamId);
      if (moveOutOfView) {
        stockItems = stockItems.filter((s) => s._id !== id);
      } else {
        mergeStockItem(id, {
          subteamId: subteamId || undefined,
          subteam: subteamId ? subteamName || undefined : "Common Stock",
          quantityOnHand: Number.isFinite(quantity) ? quantity : undefined,
          lowStockThreshold: Number.isFinite(low) ? low : undefined,
          location,
          category,
          notes,
        });
      }
      finalizeSuccess();
    } else {
      if (!selectedStockCatalogItem?._id && !selectedStockCatalogItem?.id) {
        if (stockModalMessage) {
          stockModalMessage.textContent = "Select a catalog item first.";
          stockModalMessage.className = "error";
        }
        return;
      }
      const payload = {
        catalogItemId:
          selectedStockCatalogItem?._id || selectedStockCatalogItem?.id,
        subteamId: subteamId === "" ? undefined : subteamId,
        quantityOnHand: Number.isFinite(quantity) ? quantity : 0,
        lowStockThreshold: Number.isFinite(low) ? low : undefined,
        location,
        category,
        notes,
      };
      const execCreate = async () => {
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create stock");
        await loadStock();
      };
      try {
        const checkUrl = `/api/stock?catalogItemId=${encodeURIComponent(payload.catalogItemId)}`;
        const dupRes = await fetch(checkUrl);
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          const items = dupData.items || [];
          const norm = (val) => (val ? val.toString() : "");
          const targetId = norm(subteamId || undefined);
          const sameLocation = items.find(
            (i) => norm(i.subteamId) === targetId,
          );
          if (sameLocation) {
            throw new Error("Item already exists in location");
          }
          const otherLocation = items.find(
            (i) => norm(i.subteamId) !== targetId,
          );
          if (otherLocation) {
            const otherName = otherLocation.subteam || "Common Stock";
            openConfirm(
              `This item already exists in ${otherName}. Add it to ${targetLocationName} as well?`,
              async () => {
                try {
                  if (stockModalMessage) {
                    stockModalMessage.textContent = "Saving...";
                    stockModalMessage.className = "small";
                  }
                  await execCreate();
                  finalizeSuccess();
                } catch (err) {
                  if (stockModalMessage) {
                    stockModalMessage.textContent =
                      err.message || "Failed to save stock";
                    stockModalMessage.className = "error";
                  }
                }
              },
            );
            if (stockModalMessage) {
              stockModalMessage.textContent = "Awaiting confirmation...";
              stockModalMessage.className = "small";
            }
            return;
          }
        }
      } catch (err) {
        if (err?.message === "Item already exists in location") throw err;
        // If the duplicate check fails for network/other reasons, fall through to attempt creation
      }
      await execCreate();
      finalizeSuccess();
    }
  } catch (err) {
    if (stockModalMessage) {
      stockModalMessage.textContent = err.message || "Failed to save stock";
      stockModalMessage.className = "error";
    }
  }
}

async function adjustStockQuantity(id, delta, absolute) {
  if (
    !currentUser?.permissions?.canEditStock &&
    !currentUser?.permissions?.canManageStock
  ) {
    showBoardMessage("No permission to edit stock.", "error");
    return;
  }
  try {
    const res = await fetch(`/api/stock/${id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delta: absolute === undefined ? delta : undefined,
        quantityOnHand: absolute,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update stock");
    const nextQty = data.quantityOnHand;
    if (!mergeStockItem(id, { quantityOnHand: nextQty })) {
      await loadStock();
    }
  } catch (err) {
    showBoardMessage(err.message || "Failed to update stock", "error");
  }
}

async function saveStockThreshold(id, value) {
  if (!currentUser?.permissions?.canManageStock) {
    showBoardMessage("No permission to configure stock.", "error");
    return;
  }
  try {
    await fetch(`/api/stock/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowStockThreshold: value }),
    });
    await loadStock();
  } catch (err) {
    showBoardMessage(err.message || "Failed to save threshold", "error");
  }
}

async function deleteStockItem(id) {
  if (!currentUser?.permissions?.canManageStock) {
    showBoardMessage("No permission to untrack stock.", "error");
    return;
  }
  if (actionBusy) return;
  setActionBusy(true, "Deleting stock…");
  try {
    await fetch(`/api/stock/${id}`, { method: "DELETE" });
    await loadStock();
    showBoardMessage("Stock entry removed.", "info");
  } catch (err) {
    showBoardMessage(err.message || "Failed to remove stock", "error");
  } finally {
    setActionBusy(false);
  }
}

function renderSubteamList() {
  if (!stockSubteamList) return;
  if (!stockSubteams.length) {
    stockSubteamList.innerHTML = '<div class="empty">No locations yet.</div>';
    return;
  }
  stockSubteamList.innerHTML = stockSubteams
    .map(
      (st) => `
<div class="tag-manager-item" data-id="${st._id}">
  <div class="tag-manager-meta" style="flex-wrap:wrap; gap:6px;">
    <div style="font-weight:700;">${escapeHtml(st.name)}</div>
    ${st.description ? `<div class="small">${escapeHtml(st.description)}</div>` : ""}
  </div>
  <div class="flex-between" style="gap:6px;">
    <button class="btn ghost" data-action="edit-subteam" style="padding:6px 10px;">Edit</button>
    <button class="btn ghost" data-action="delete-subteam" style="padding:6px 10px; color: var(--danger);">Delete</button>
  </div>
</div>
  `,
    )
    .join("");
  stockSubteamList
    .querySelectorAll('button[data-action="edit-subteam"]')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".tag-manager-item")?.dataset.id;
        const st = stockSubteams.find((s) => s._id === id);
        if (!st || !stockSubteamForm) return;
        stockSubteamForm.elements.id.value = st._id;
        stockSubteamForm.elements.name.value = st.name || "";
        stockSubteamForm.elements.description.value = st.description || "";
      });
    });
  stockSubteamList
    .querySelectorAll('button[data-action="delete-subteam"]')
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest(".tag-manager-item")?.dataset.id;
        if (!id) return;
        openConfirm(
          "Delete this location? Items will become unassigned.",
          async () => {
            await removeSubteam(id);
          },
        );
      });
    });
}

async function loadSubteams() {
  if (!currentUser) return;
  try {
    const res = await fetch("/api/stock/subteams");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load locations");
    stockSubteams = data.subteams || [];
    renderSubteamList();
    renderStockFilters();
  } catch (err) {
    if (stockSubteamMessage) {
      stockSubteamMessage.textContent =
        err.message || "Failed to load locations";
      stockSubteamMessage.className = "error";
    }
  }
}

function openSubteamsModal() {
  if (!currentUser?.permissions?.canManageStock) return;
  if (stockSubteamMessage) {
    stockSubteamMessage.textContent = "";
    stockSubteamMessage.className = "small";
  }
  stockSubteamForm?.reset();
  renderSubteamList();
  if (stockSubteamsModal) stockSubteamsModal.style.display = "flex";
}

async function saveSubteam(e) {
  e.preventDefault();
  if (!stockSubteamForm) return;
  const id = stockSubteamForm.elements.id.value || null;
  const name = stockSubteamForm.elements.name.value?.trim();
  const description = stockSubteamForm.elements.description.value?.trim();
  if (!name) return;
  if (stockSubteamMessage) {
    stockSubteamMessage.textContent = "Saving...";
    stockSubteamMessage.className = "small";
  }
  try {
    const url = id ? `/api/stock/subteams/${id}` : "/api/stock/subteams";
    const method = id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save location");
    stockSubteamForm.reset();
    await loadSubteams();
    await loadStock();
    if (stockSubteamMessage) {
      stockSubteamMessage.textContent = "Saved.";
      stockSubteamMessage.className = "success";
    }
  } catch (err) {
    if (stockSubteamMessage) {
      stockSubteamMessage.textContent =
        err.message || "Failed to save location";
      stockSubteamMessage.className = "error";
    }
  }
}

async function removeSubteam(id) {
  if (!currentUser?.permissions?.canManageStock) return;
  openConfirm(
    "Delete this location? Items will become unassigned.",
    async () => {
      await fetch(`/api/stock/subteams/${id}`, { method: "DELETE" });
      await loadSubteams();
      await loadStock();
    },
  );
}

async function searchStockCatalog(term) {
  if (!stockCatalogResults) return;
  const q = (term || "").trim();
  if (q.length < 2) {
    stockCatalogResults.style.display = "none";
    stockCatalogResults.innerHTML = "";
    return;
  }
  stockCatalogResults.style.display = "block";
  stockCatalogResults.innerHTML =
    '<div class="small" style="padding:8px 10px;">Searching...</div>';
  try {
    const res = await fetch(
      `/api/catalog/items?search=${encodeURIComponent(q)}&includeDescendants=true`,
    );
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      stockCatalogResults.innerHTML =
        '<div class="small" style="padding:8px 10px;">No matches</div>';
      return;
    }
    stockCatalogResults.innerHTML = items
      .slice(0, 30)
      .map(
        (item) => `
  <div class="tag-picker-option" data-id="${item._id}" style="padding:6px 8px; cursor:pointer; border:1px solid var(--border); border-radius:8px; margin-bottom:4px;">
    <div style="font-weight:700;">${escapeHtml(item.name)}</div>
    <div class="small">${escapeHtml(item.fullPath || (item.categoryPathLabels || []).join(" / ") || "")}${item.vendor ? " · " + escapeHtml(item.vendor) : ""}${item.vendorPartNumber ? " · " + escapeHtml(item.vendorPartNumber) : ""}</div>
  </div>
`,
      )
      .join("");
    stockCatalogResults
      .querySelectorAll(".tag-picker-option")
      .forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.dataset.id;
          const found = items.find((i) => i._id === id);
          if (found) {
            setSelectedStockCatalogItem(found);
            stockCatalogResults.style.display = "none";
            stockCatalogSearch.value = found.name || "";
          }
        });
      });
  } catch (err) {
    stockCatalogResults.innerHTML =
      '<div class="small" style="padding:8px 10px;">Failed to search catalog</div>';
  }
}

function renderTable() {
  const rows = filteredOrders();
  if (!rows.length) {
    tableContainer.innerHTML = '<div class="empty">No orders found.</div>';
    return;
  }

  const header = `
<table>
  <thead>
    <tr>
      <th><input type="checkbox" id="select-all"></th>
      <th>Part</th>
      <th>Status</th>
      <th>Tracking</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Total</th>
      <th>Vendor</th>
      <th>Requested by</th>
    <th>Order placed</th>
    </tr>
  </thead>
  <tbody>
  `;
  const body = rows
    .map(
      (o) => `
<tr data-id="${o._id}">
  <td><input type="checkbox" class="row-check" ${selected.has(o._id) ? "checked" : ""}></td>
  <td>
    <div>${o.partName || ""}</div>
    ${o.vendorPartNumber ? `<div class="small">${o.vendorPartNumber}</div>` : ""}
    ${o.partLink ? `<div class="small"><a href="${o.partLink}" target="_blank">link</a></div>` : ""}
    ${o.tags && o.tags.length ? `<div class="small" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">${renderTagChips(o.tags)}</div>` : ""}
    <div class="small" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
      ${
        o.approvalStatus === "approved"
          ? `<span class="tag" style="background:rgba(74,210,143,0.16); color:var(--success);">Approved${o.approvedBy ? " · " + o.approvedBy : ""}</span>`
          : `<span class="tag" style="background:rgba(253,208,35,0.16); color:var(--gold);">Pending approval</span>`
      }
      ${o.group ? `<span class="tag group">Group</span>` : ""}
    </div>
  </td>
  <td><span class="status-chip status-${o.status || ""}">${o.status || ""}</span></td>
  <td>${renderTrackingBadges(o.group?.tracking || [])}</td>
  <td>${o.quantityRequested || ""}</td>
  <td>${o.unitCost ? "$" + o.unitCost : o.fetchedPrice ? "$" + o.fetchedPrice : ""}</td>
  <td>${(() => {
    const unit = o.unitCost ?? o.fetchedPrice;
    const qty = o.quantityRequested || 1;
    const total =
      o.totalCost ??
      (unit !== undefined ? Number((unit * qty).toFixed(2)) : undefined);
    return total !== undefined ? "$" + total : "";
  })()}</td>
  <td>${o.supplier || o.vendor || ""}</td>
  <td>${o.studentName || ""}</td>
  <td>${fmtDate(o.group?.requestedDisplayAt || o.group?.createdAt || o.requestedDisplayAt || o.requestedAt)}</td>
</tr>
  `,
    )
    .join("");
  tableContainer.innerHTML = header + body + "</tbody></table>";

  tableContainer
    .querySelector("#select-all")
    .addEventListener("change", (e) => {
      const check = e.target.checked;
      rows.forEach((o) => {
        if (check) selected.add(o._id);
        else selected.delete(o._id);
      });
      refreshBoardSelectionUI();
      renderTable();
      updateSelectionBar();
    });
  tableContainer.querySelectorAll(".row-check").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.closest("tr").dataset.id;
      if (e.target.checked) selected.add(id);
      else selected.delete(id);
      refreshBoardSelectionUI();
      updateSelectionBar();
    });
  });
  resizeColumns();
}

function toggleSelect(id) {
  withScrollRestoration(() => {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    refreshBoardSelectionUI();
    if (tableSection && tableSection.style.display !== "none") renderTable();
    updateSelectionBar();
  });
}

const canLeaveRequested = (order) => Boolean(order?.groupId || order?.group);
const isGroupOrder = (order) => Boolean(order?.groupId || order?.group);

async function updateStatus(id, status, tracking) {
  const order = getOrderById(id);
  if (!order) return;
  if (status !== "Requested" && !canLeaveRequested(order)) {
    showBoardMessage("Move the part into an order first.", "error");
    return;
  }
  const trackingList = Array.isArray(tracking)
    ? tracking
    : tracking
      ? [{ carrier: "unknown", trackingNumber: tracking }]
      : undefined;
  await fetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      tracking: trackingList,
      trackingNumber: trackingList?.[0]?.trackingNumber,
    }),
  });
  selected.delete(id);
  await fetchOrders();
}

function updateSelectionBar() {
  const selectedOrders = orders.filter((o) => selected.has(o._id));
  if (selected.size === 0) {
    selectionCount.textContent = "No parts selected";
    groupVendorNote.textContent = "";
    if (deleteSelectedBtn) deleteSelectedBtn.style.display = "none";
    addToOrderMode = false;
    addToOrderVendor = null;
  } else {
    const vendor =
      selectedOrders[0]?.supplier || selectedOrders[0]?.vendor || "Mixed";
    selectionCount.textContent = `${selected.size} selected`;
    groupVendorNote.textContent = `Vendor: ${vendor}${selectedOrders.every((o) => (o.supplier || o.vendor) === (selectedOrders[0]?.supplier || selectedOrders[0]?.vendor)) ? "" : " (mixed - fix selection)"}`;
    if (deleteSelectedBtn) deleteSelectedBtn.style.display = "inline-flex";
    if (
      addToOrderMode &&
      addToOrderVendor &&
      selectedOrders.some((o) => getOrderVendor(o) !== addToOrderVendor)
    ) {
      resetAddToOrderMode();
    }
  }
}

async function createGroup() {
  if (actionBusy) return;
  if (!currentUser?.permissions?.canManageOrders) {
    showBoardMessage("No permission to manage orders.", "error");
    return;
  }
  if (selected.size === 0) return;
  const selectedOrders = orders.filter((o) => selected.has(o._id));
  const baseVendor = selectedOrders[0]?.supplier || selectedOrders[0]?.vendor;
  const mixed = selectedOrders.some(
    (o) => (o.supplier || o.vendor) !== baseVendor,
  );
  if (mixed) {
    showBoardMessage("Select orders from the same vendor to group.", "error");
    return;
  }
  const now = new Date();
  const fallbackTitle = baseVendor
    ? `${baseVendor} - ${formatShortDate(now)} ${formatTimeShort(now)}`
    : `Group - ${formatShortDate(now)} ${formatTimeShort(now)}`;
  const defaultStatusTag = defaultStatusTagLabel();
  setActionBusy(true, "Creating order…");
  try {
    const res = await fetch("/api/order-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fallbackTitle,
        supplier: baseVendor || undefined,
        requestedDisplayAt: now.getTime(),
        statusTag: defaultStatusTag || undefined,
        orderIds: Array.from(selected),
      }),
    });
    const data = await res.json();
    const newGroupId = data.groupId || data._id;
    await Promise.all(
      Array.from(selected).map((id) => patchStatusOnly(id, "Ordered")),
    );
    recordAction({
      undo: { type: "deleteGroup", payload: { groupId: newGroupId } },
      redo: {
        type: "createGroup",
        payload: {
          title: fallbackTitle,
          supplier: baseVendor || undefined,
          requestedDisplayAt: now.getTime(),
          orderIds: Array.from(selected),
          statusTag: defaultStatusTag || undefined,
        },
      },
    });
    selected.clear();
    groupVendorNote.textContent = "Vendor: auto from selection";
    await fetchOrders();
  } finally {
    setActionBusy(false);
  }
}

function resetAddToOrderMode() {
  addToOrderMode = false;
  addToOrderVendor = null;
  refreshBoardSelectionUI();
}

function startAddToOrderMode() {
  if (!currentUser?.permissions?.canManageOrders) {
    showBoardMessage("No permission to manage orders.", "error");
    return;
  }
  if (!selected.size) return;
  withScrollRestoration(() => {
    const selectedOrders = orders.filter((o) => selected.has(o._id));
    const vendor = getOrderVendor(selectedOrders[0]);
    const mixed = selectedOrders.some((o) => getOrderVendor(o) !== vendor);
    if (!vendor || mixed) {
      showBoardMessage(
        "Select parts from the same vendor to add to an order.",
        "error",
      );
      return;
    }
    addToOrderVendor = vendor;
    addToOrderMode = true;
    refreshBoardSelectionUI();
  });
  showBoardMessage(
    "Tap an existing order with the same vendor to add the selected parts.",
    "info",
    3000,
  );
}

async function addSelectedToGroup(groupId, targetStatus) {
  if (!currentUser?.permissions?.canManageOrders) {
    showBoardMessage("No permission to manage orders.", "error");
    return;
  }
  if (!selected.size) return;
  const ids = Array.from(selected);
  setActionBusy(true, "Adding to order…");
  try {
    for (const id of ids) {
      await assignGroup(id, groupId);
      if (targetStatus) await patchStatusOnly(id, targetStatus);
    }
    selected.clear();
    updateSelectionBar();
    resetAddToOrderMode();
    await fetchOrders();
  } finally {
    setActionBusy(false);
  }
}

async function addSelectedToOrder(order) {
  if (!currentUser?.permissions?.canManageOrders) {
    showBoardMessage("No permission to manage orders.", "error");
    return;
  }
  if (!order || !selected.size) return;
  const targetVendor = getOrderVendor(order);
  if (addToOrderVendor && targetVendor !== addToOrderVendor) {
    showBoardMessage("Select an order with the same vendor.", "error");
    return;
  }
  const targetStatus = order.status;
  let groupId = order.groupId || order.group?._id;
  if (!groupId) {
    const now = new Date();
    const title = `${order.supplier || order.vendor || "Order"} - ${formatShortDate(now)} ${formatTimeShort(now)}`;
    const payloadIds = [order._id, ...Array.from(selected)];
    const defaultStatusTag = defaultStatusTagLabel();
    setActionBusy(true, "Adding to order…");
    try {
      const res = await fetch("/api/order-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          supplier: order.supplier || order.vendor || undefined,
          requestedDisplayAt: now.getTime(),
          orderIds: payloadIds,
          statusTag: defaultStatusTag || undefined,
        }),
      });
      const data = await res.json();
      groupId = data.groupId || data._id;
      for (const id of Array.from(selected)) {
        if (targetStatus) await patchStatusOnly(id, targetStatus);
      }
    } finally {
      setActionBusy(false);
    }
  } else {
    setActionBusy(true, "Adding to order…");
    try {
      for (const id of Array.from(selected)) {
        await assignGroup(id, groupId);
        if (targetStatus) await patchStatusOnly(id, targetStatus);
      }
    } finally {
      setActionBusy(false);
    }
  }
  selected.clear();
  updateSelectionBar();
  resetAddToOrderMode();
  await fetchOrders();
}

async function removePartFromGroup(orderId, fromGroupId, fromStatus) {
  const snapshot = snapshotOrder(orderId);
  await assignGroup(orderId, undefined);
  await patchStatusOnly(orderId, "Requested");
  if (snapshot) {
    recordAction({
      undo: {
        type: "updateStatus",
        payload: {
          orderId,
          status: fromStatus || "Ordered",
          groupId: fromGroupId,
        },
      },
      redo: {
        type: "updateStatus",
        payload: { orderId, status: "Requested", groupId: undefined },
      },
    });
  }
  await fetchOrders();
}

function hideGroupDetailModal() {
  if (groupDetailModal) groupDetailModal.style.display = "none";
}

function openGroupDetailModal(groupInfo, items) {
  if (!groupDetailModal) return;
  const gid = groupInfo?.id;
  if (groupDetailTitle) groupDetailTitle.textContent = groupInfo?.title || "Grouped order";
  const statusTagLabel = groupInfo?.statusTag || "";
  const statusTagColor = statusTagLabel ? getStatusTagColor(statusTagLabel) : null;
  if (groupDetailMeta) {
    const chips = [];
    if (groupInfo?.vendor) chips.push(`<span class="group-detail-chip">${escapeHtml(groupInfo.vendor)}</span>`);
    if (statusTagLabel) chips.push(`<span class="group-detail-chip" style="border-color:${statusTagColor || "var(--border)"}; color:${statusTagColor || "var(--text)"}; background:${statusTagColor ? `${statusTagColor}22` : "var(--panel-2)"};">${escapeHtml(statusTagLabel)}</span>`);
    chips.push(`<span class="group-detail-chip">${items.length} part${items.length === 1 ? "" : "s"}</span>`);
    if (groupInfo?.total) chips.push(`<span class="group-detail-chip">$${groupInfo.total.toFixed(2)}</span>`);
    groupDetailMeta.innerHTML = chips.join("");
  }
  if (groupDetailActions) {
    groupDetailActions.innerHTML = `
      ${supportsVendorExportByName(groupInfo?.vendor || "") ? `<button class="btn ghost" data-action="export-group" style="padding:6px 10px;">Export</button>` : ""}
      ${currentUser?.permissions?.canSubmitInvoices ? `<button class="btn ghost" data-action="group-invoices" style="padding:6px 10px;">Invoices</button>` : ""}
      ${currentUser?.permissions?.canManageOrders && groupInfo?.status === "Ordered" ? `<button class="btn ghost" data-action="advance-group" style="padding:6px 10px;">Advance</button>` : ""}
      ${currentUser?.permissions?.canManageOrders && groupInfo?.status === "Received" ? `<button class="btn ghost" data-action="revert-group" style="padding:6px 10px;">Revert</button>` : ""}
      ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="edit-group" style="padding:6px 10px;">Edit</button>` : ""}
      ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="delete-group" style="padding:6px 10px; color:var(--danger);">Delete</button>` : ""}
    `;
  }
  if (groupDetailTracking) {
    groupDetailTracking.innerHTML = renderTrackingBadges(groupInfo?.tracking || []);
  }
  if (groupDetailParts) {
    groupDetailParts.innerHTML = items
      .map(
        (o) => `
      <div class="small group-item" data-id="${o._id}" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border); border-radius:8px; flex-wrap:wrap;">
        <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:260px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="muted" style="font-weight:700;">${o.quantityRequested ? `${o.quantityRequested}x` : ""}</span>
            <span style="font-weight:700;">${o.partName || ""}</span>
            ${o.vendorPartNumber ? `<span class="tag">${o.vendorPartNumber}</span>` : ""}
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${o.studentName ? `<span class="tag" style="background:rgba(79,180,255,0.16); color:var(--accent-2); border-color:var(--border);">${o.studentName}</span>` : ""}
            ${o.priority ? `<span class="tag priority" style="border-color:${getPriorityColor(o.priority)}; color:${getPriorityColor(o.priority)};">${o.priority}</span>` : ""}
            ${renderTagChips(o.tags || [])}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-left:auto;">
          ${o.partLink || o.supplierLink ? `<a class="btn ghost" data-action="link-part" href="${escapeHtml(o.partLink || o.supplierLink)}" target="_blank" rel="noopener noreferrer" style="padding:4px 8px;">Link</a>` : ""}
          ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="edit-part" style="padding:4px 8px;">Edit</button>` : ""}
          ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="remove-part" style="padding:4px 8px;">Remove</button>` : ""}
          ${currentUser?.permissions?.canManageOrders ? `<button class="btn ghost" data-action="delete-part" style="padding:4px 8px; color:var(--danger);">Delete</button>` : ""}
        </div>
      </div>
    `,
      )
      .join("");
  }
  if (groupDetailModal) groupDetailModal.style.display = "flex";

  groupDetailActions
    ?.querySelectorAll("button[data-action]")
    .forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "export-group") {
          exportOrdersForVendor(items, groupInfo.vendor);
        } else if (action === "advance-group") {
          await updateGroupStatus(gid, "Received");
        } else if (action === "revert-group") {
          await updateGroupStatus(gid, "Ordered");
        } else if (action === "group-invoices") {
          openInvoiceModal(items[0], items);
        } else if (action === "edit-group") {
          hideGroupDetailModal();
          openGroupModal({
            id: gid,
            title: groupInfo.title,
            tracking: groupInfo.tracking || [],
            notes: groupInfo.notes || "",
          });
        } else if (action === "delete-group") {
          if (actionBusy) return;
          const orderIds = items.map((o) => o._id);
          openConfirm(
            "Delete this group?",
            async (extra) => {
              setActionBusy(true, "Deleting order…");
              const deleteParts = extra?.deleteParts;
              const originalStatus = groupInfo.status || "Ordered";
              const originalTracking = groupInfo.tracking || [];
              const originalNotes = groupInfo.notes || "";
              if (deleteParts) {
                const snapshots = orderIds
                  .map((id) => snapshotOrder(id))
                  .filter(Boolean);
                const groupSnapshot = {
                  title: groupInfo.title,
                  supplier: groupInfo.vendor || undefined,
                  requestedDisplayAt: items[0]?.group?.requestedDisplayAt || items[0]?.group?.createdAt,
                  status: originalStatus,
                  tracking: originalTracking,
                  notes: originalNotes,
                };
                await Promise.all(
                  orderIds.map((oid) =>
                    fetch(`/api/orders/${oid}`, { method: "DELETE" }),
                  ),
                );
                await fetch(`/api/order-groups/${gid}`, { method: "DELETE" });
                recordAction({
                  undo: {
                    type: "restoreOrders",
                    payload: { orders: snapshots, group: groupSnapshot },
                  },
                  redo: { type: "deleteOrders", payload: { orderIds } },
                });
                fetchOrders();
                setActionBusy(false);
                if (groupDetailModal) groupDetailModal.style.display = "none";
                return;
              }
              await Promise.all(
                orderIds.map(async (oid) => {
                  await assignGroup(oid, undefined);
                  await patchStatusOnly(oid, "Requested");
                }),
              );
              await fetch(`/api/order-groups/${gid}`, { method: "DELETE" });
              recordAction({
                undo: {
                  type: "createGroup",
                  payload: {
                    title: groupInfo.title,
                    supplier: groupInfo.vendor || undefined,
                    requestedDisplayAt:
                      items[0]?.group?.requestedDisplayAt ||
                      items[0]?.group?.createdAt,
                    orderIds,
                    status: originalStatus,
                    tracking: originalTracking,
                    notes: originalNotes,
                  },
                },
                redo: {
                  type: "deleteGroup",
                  payload: { groupId: gid, orderIds, status: originalStatus },
                },
              });
              fetchOrders();
              setActionBusy(false);
              if (groupDetailModal) groupDetailModal.style.display = "none";
            },
            () => {
              const checkboxId = `confirm-delete-orders-${gid}`;
              return {
                content: `<label class="small" style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="${checkboxId}"> Delete part requests instead of ungrouping</label>`,
                getValue: () => ({
                  deleteParts: document.getElementById(checkboxId)?.checked,
                }),
              };
            },
          );
        }
      };
    });

  groupDetailParts
    ?.querySelectorAll("button[data-action],a[data-action]")
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const row = btn.closest(".group-item");
        const oid = row?.dataset?.id;
        const action = btn.dataset.action;
        if (!oid || !action) return;
        if (action === "edit-part") {
          const order = orders.find((o) => o._id === oid);
          if (order) {
            openEdit(order);
          }
        } else if (action === "remove-part") {
          openConfirm("Remove this part from the order?", async () => {
            await removePartFromGroup(oid, gid, groupInfo.status);
            hideGroupDetailModal();
          });
        } else if (action === "delete-part") {
          openConfirm("Delete this order?", async () => {
            await fetch(`/api/orders/${oid}`, { method: "DELETE" });
            fetchOrders();
            hideGroupDetailModal();
          });
        }
      });
    });
}
function selectSameVendorRequested() {
  const current = orders.find((o) => selected.has(o._id));
  if (!current) return;
  const vendor = getOrderVendor(current);
  if (!vendor) return;
  withScrollRestoration(() => {
    orders.forEach((o) => {
      if (o.status === "Requested" && getOrderVendor(o) === vendor) {
        selected.add(o._id);
      }
    });
    updateSelectionBar();
    refreshBoardSelectionUI();
  });
}

// Event wiring
function showOrdersView() {
  document.body.classList.remove("mode-stock");
  document.body.classList.toggle("mode-reimbursements", false);
  const layout =
    reimbursementsViewBtn?.classList.contains("active")
      ? "reimbursements"
      : tableBtn.classList.contains("active")
        ? "table"
        : "board";
  activePrimaryView = layout === "reimbursements" ? "reimbursements" : "orders";
  ordersViewBtn?.classList.add("active");
  stockViewBtn?.classList.remove("active");
  if (ordersLayoutRow) ordersLayoutRow.style.display = "flex";
  if (ordersLayoutToggle) ordersLayoutToggle.style.display = "inline-flex";
  if (selectionBar) selectionBar.style.display = layout === "reimbursements" ? "none" : "";
  if (stockSection) stockSection.style.display = "none";
  if (reimbursementsSection)
    reimbursementsSection.style.display =
      layout === "reimbursements" ? "flex" : "none";
  boardSection.style.display = layout === "board" ? "flex" : "none";
  tableSection.style.display = layout === "table" ? "flex" : "none";
  if (primaryTitle)
    primaryTitle.textContent =
      layout === "reimbursements" ? "Invoices" : "Orders";
  if (primarySubtitle)
    primarySubtitle.textContent =
      layout === "reimbursements"
        ? "Submit receipts and track reimbursement status."
        : "Track parts from request to delivery.";
  updateSearchPlaceholder();
  updateSelectionBar();
  resizeColumns();
  setTimeout(resizeColumns, 30);
}

function showStockView() {
  document.body.classList.add("mode-stock");
  document.body.classList.remove("mode-reimbursements");
  resetAddToOrderMode();
  activePrimaryView = "stock";
  stockViewBtn?.classList.add("active");
  reimbursementsViewBtn?.classList.remove("active");
  ordersViewBtn?.classList.remove("active");
  if (ordersLayoutRow) ordersLayoutRow.style.display = "none";
  if (ordersLayoutToggle) ordersLayoutToggle.style.display = "none";
  if (selectionBar) selectionBar.style.display = "none";
  boardSection.style.display = "none";
  tableSection.style.display = "none";
  if (reimbursementsSection) reimbursementsSection.style.display = "none";
  if (stockSection) stockSection.style.display = "flex";
  if (primaryTitle) primaryTitle.textContent = "Stock";
  if (primarySubtitle)
    primarySubtitle.textContent = "Live view of parts on-hand by location.";
  loadStock();
  updateSearchPlaceholder();
  resizeColumns();
  setTimeout(resizeColumns, 30);
}

function showReimbursementsView() {
  if (typeof switchToReimbursements === "function") {
    switchToReimbursements();
  }
}
